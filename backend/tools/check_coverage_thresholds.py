import sys
import xml.etree.ElementTree as ET


CRITICAL_PACKAGE_THRESHOLDS = {
    # Security/auth is user-facing critical surface.
    "app.core.security": {"lines": 30, "branches": 20},
    "app.middleware.auth": {"lines": 30, "branches": 20},
    "app.api.deps.auth": {"lines": 30, "branches": 20},
    "app.application.auth_service": {"lines": 30, "branches": 20},
    # Rate limiting / idempotency protects stability and abuse scenarios.
    "app.middleware.rate_limit": {"lines": 25, "branches": 15},
    "app.infrastructure.idempotency": {"lines": 25, "branches": 15},
    # Telegram boundary: signature validation / identity extraction.
    "app.infrastructure.telegram_auth": {"lines": 30, "branches": 20},
    "app.core.request_identity": {"lines": 25, "branches": 15},
    # Request integrity and safe defaults.
    "app.middleware.security_headers": {"lines": 25, "branches": 15},
    "app.middleware.request_correlation": {"lines": 25, "branches": 15},
    "app.middleware.request_logging": {"lines": 25, "branches": 15},
    "app.api.exception_handlers": {"lines": 25, "branches": 15},
    # Core user flows / domain actions.
    "app.application.users_service": {"lines": 25, "branches": 15},
    "app.application.workouts_service": {"lines": 25, "branches": 15},
    # Data access layer.
    "app.infrastructure.repositories": {"lines": 20, "branches": 10},
}


def _pct(rate: str | None) -> float:
    if rate is None:
        return 0.0
    try:
        return float(rate) * 100.0
    except ValueError:
        return 0.0


def _find_best_threshold_for_package(package_name: str) -> tuple[str, dict] | None:
    # Match by most specific prefix (e.g. app.core.security.tokens should match app.core.security)
    best_key = None
    for key in CRITICAL_PACKAGE_THRESHOLDS.keys():
        if package_name == key or package_name.startswith(f"{key}."):
            if best_key is None or len(key) > len(best_key):
                best_key = key
    if best_key is None:
        return None
    return best_key, CRITICAL_PACKAGE_THRESHOLDS[best_key]


def main() -> int:
    if len(sys.argv) != 2:
        print("Usage: python tools/check_coverage_thresholds.py <coverage.xml>")
        return 2

    path = sys.argv[1]
    tree = ET.parse(path)
    root = tree.getroot()

    # coverage.py xml layout: coverage/packages/package[@name, @line-rate, @branch-rate]
    packages = root.findall(".//packages/package")
    if not packages:
        print("No <package> entries found in coverage.xml (unexpected format).")
        return 2

    failures: list[str] = []
    checked: list[tuple[str, float, float, int, int]] = []

    for pkg in packages:
        name = pkg.attrib.get("name", "")
        threshold = _find_best_threshold_for_package(name)
        if threshold is None:
            continue

        matched_key, limits = threshold
        line_pct = _pct(pkg.attrib.get("line-rate"))
        branch_pct = _pct(pkg.attrib.get("branch-rate"))

        # Don't fail CI on packages with 0% coverage yet.
        # We enforce only where tests already exercise the package.
        if line_pct == 0.0 and branch_pct == 0.0:
            continue

        checked.append((name, line_pct, branch_pct, limits["lines"], limits["branches"]))

        if line_pct + 1e-9 < limits["lines"]:
            failures.append(
                f"{name}: lines {line_pct:.1f}% < {limits['lines']}% (threshold key: {matched_key})"
            )
        if branch_pct + 1e-9 < limits["branches"]:
            failures.append(
                f"{name}: branches {branch_pct:.1f}% < {limits['branches']}% (threshold key: {matched_key})"
            )

    if not checked:
        print("No critical packages matched. Nothing to enforce.")
        return 0

    print("Critical coverage thresholds (minimums):")
    for pkg_name, line_pct, branch_pct, min_lines, min_branches in sorted(checked, key=lambda x: x[0]):
        print(f"  - {pkg_name}: lines {line_pct:.1f}% (min {min_lines}%), branches {branch_pct:.1f}% (min {min_branches}%)")

    if failures:
        print("\nCoverage threshold failures:")
        for f in failures:
            print(f"  - {f}")
        return 1

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
