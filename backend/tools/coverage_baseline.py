import json
import os
import sys
import xml.etree.ElementTree as ET


def _round_down_1(x: float) -> float:
    return float(int(x * 10)) / 10.0


def _pct(rate: str | None) -> float:
    if rate is None:
        return 0.0
    try:
        return float(rate) * 100.0
    except ValueError:
        return 0.0


def _read_json(path: str) -> dict:
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def _write_json(path: str, obj: dict) -> None:
    with open(path, "w", encoding="utf-8") as f:
        json.dump(obj, f, indent=2, ensure_ascii=False)
        f.write("\n")


def _load_packages_coverage(coverage_xml_path: str) -> dict[str, dict[str, float]]:
    tree = ET.parse(coverage_xml_path)
    root = tree.getroot()

    pkgs: dict[str, dict[str, float]] = {}
    for pkg in root.findall(".//packages/package"):
        name = pkg.attrib.get("name", "")
        if not name:
            continue
        pkgs[name] = {
            "lines": _round_down_1(_pct(pkg.attrib.get("line-rate"))),
            "branches": _round_down_1(_pct(pkg.attrib.get("branch-rate"))),
        }
    return pkgs


def _expected_from_baseline(baseline: dict[str, float], slack: dict[str, float], floor: dict[str, float]) -> dict[str, float]:
    return {
        "lines": _round_down_1(max(float(floor.get("lines", 0)), float(baseline["lines"]) - float(slack.get("lines", 0)))),
        "branches": _round_down_1(max(float(floor.get("branches", 0)), float(baseline["branches"]) - float(slack.get("branches", 0)))),
    }


def _best_match(package_name: str, critical_prefixes: list[str]) -> str | None:
    best = None
    for p in critical_prefixes:
        if package_name == p or package_name.startswith(p + "."):
            if best is None or len(p) > len(best):
                best = p
    return best


def cmd_update(frontend_root: str, coverage_xml_path: str) -> int:
    baseline_path = os.path.join(frontend_root, "coverage.baseline.json")
    baseline_file = _read_json(baseline_path)
    critical = list(baseline_file.get("criticalPackages", []))
    baseline_map = dict(baseline_file.get("baseline", {}))

    current = _load_packages_coverage(coverage_xml_path)

    # Store baseline for the critical prefixes themselves (if present),
    # otherwise store a combined (min) coverage across matched subpackages.
    aggregates: dict[str, list[dict[str, float]]] = {p: [] for p in critical}
    for pkg_name, cov in current.items():
        best = _best_match(pkg_name, critical)
        if best is None:
            continue
        aggregates[best].append(cov)

    for prefix, entries in aggregates.items():
        if not entries:
            continue
        baseline_map[prefix] = {
            "lines": min(e["lines"] for e in entries),
            "branches": min(e["branches"] for e in entries),
        }

    baseline_file["baseline"] = baseline_map
    _write_json(baseline_path, baseline_file)
    print(f"Updated baseline: {baseline_path}")
    return 0


def cmd_check(frontend_root: str, coverage_xml_path: str) -> int:
    baseline_path = os.path.join(frontend_root, "coverage.baseline.json")
    baseline_file = _read_json(baseline_path)

    slack = baseline_file.get("slack", {})
    floor = baseline_file.get("minFloor", {})
    critical = list(baseline_file.get("criticalPackages", []))
    baseline_map: dict = baseline_file.get("baseline", {}) or {}

    current = _load_packages_coverage(coverage_xml_path)

    failures: list[str] = []
    checked: list[tuple[str, dict[str, float], dict[str, float]]] = []

    aggregates: dict[str, list[dict[str, float]]] = {p: [] for p in critical}
    for pkg_name, cov in current.items():
        best = _best_match(pkg_name, critical)
        if best is None:
            continue
        aggregates[best].append(cov)

    for prefix, entries in aggregates.items():
        base = baseline_map.get(prefix)
        if base is None or not entries:
            continue
        cur = {
            "lines": min(e["lines"] for e in entries),
            "branches": min(e["branches"] for e in entries),
        }
        exp = _expected_from_baseline(base, slack, floor)
        checked.append((prefix, cur, exp))
        if cur["lines"] + 1e-9 < exp["lines"]:
            failures.append(f"{prefix}: lines {cur['lines']}% < {exp['lines']}% (baseline {base['lines']}%, slack {slack.get('lines', 0)}%)")
        if cur["branches"] + 1e-9 < exp["branches"]:
            failures.append(
                f"{prefix}: branches {cur['branches']}% < {exp['branches']}% (baseline {base['branches']}%, slack {slack.get('branches', 0)}%)"
            )

    if failures:
        print("Coverage regression detected for critical backend packages:")
        for f in failures:
            print(f"  - {f}")
        print("")
        print("Fix:")
        print("  - Improve tests for the affected package(s), or")
        print("  - If the drop is intended, update baseline:")
        print("      cd backend && python tools/coverage_baseline.py update coverage.xml")
        return 1

    if checked:
        print("Backend critical coverage baseline check OK:")
        for pkg_name, cur, exp in sorted(checked, key=lambda x: x[0]):
            print(f"  - {pkg_name}: lines {cur['lines']}% (min {exp['lines']}%), branches {cur['branches']}% (min {exp['branches']}%)")
    else:
        print("No backend baseline entries to check yet (baseline missing).")

    return 0


def main() -> int:
    if len(sys.argv) != 3:
        print("Usage: python tools/coverage_baseline.py <check|update> <coverage.xml>")
        return 2

    cmd = sys.argv[1]
    coverage_xml = sys.argv[2]

    if cmd not in {"check", "update"}:
        print("Usage: python tools/coverage_baseline.py <check|update> <coverage.xml>")
        return 2

    backend_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

    if cmd == "update":
        return cmd_update(backend_root, coverage_xml)
    return cmd_check(backend_root, coverage_xml)


if __name__ == "__main__":
    raise SystemExit(main())

