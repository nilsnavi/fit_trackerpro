from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

from sqlalchemy import text

from app.infrastructure.database import AsyncSessionLocal


DEFAULT_DATA_DIR = Path(__file__).resolve().parents[2] / "reference_data"


def _sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _load_json(path: Path) -> Any:
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def _iter_ndjson(path: Path) -> Iterable[dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


@dataclass(frozen=True)
class Dataset:
    name: str
    file: str


def _load_manifest(data_dir: Path) -> tuple[str, list[Dataset]]:
    manifest = _load_json(data_dir / "manifest.json")
    version = str(manifest["version"])
    datasets = [Dataset(name=d["name"], file=d["file"]) for d in manifest["datasets"]]
    return version, datasets


async def _upsert_ref_table(
    *,
    session,
    table: str,
    rows: list[dict[str, Any]],
) -> None:
    if not rows:
        return

    # Normalize payload: keep only known columns per table.
    if table == "ref_exercise_category":
        allowed = {"code", "label", "icon", "sort_order", "is_active", "metadata"}
    elif table in {"ref_muscle_group", "ref_equipment", "ref_exercise_status"}:
        allowed = {"code", "label", "sort_order", "is_active", "metadata"}
    else:
        raise ValueError(f"Unsupported ref table: {table}")

    normalized: list[dict[str, Any]] = []
    for r in rows:
        item = {k: r.get(k) for k in allowed if k in r}
        item.setdefault("metadata", {})
        normalized.append(item)

    cols = sorted({k for r in normalized for k in r.keys()})
    if "code" not in cols:
        raise ValueError(f"{table}: missing required field 'code'")

    insert_cols = ", ".join(cols)
    values_cols = ", ".join(f":{c}" for c in cols)

    update_cols = [c for c in cols if c != "code"]
    update_set = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)

    sql = f"""
        INSERT INTO {table} ({insert_cols})
        VALUES ({values_cols})
        ON CONFLICT (code) DO UPDATE
        SET {update_set}
    """
    await session.execute(text(sql), normalized)


async def _upsert_exercises(*, session, rows: list[dict[str, Any]]) -> dict[str, int]:
    if not rows:
        return {"upserted": 0, "archived": 0}

    normalized: list[dict[str, Any]] = []
    slugs: list[str] = []
    for r in rows:
        slug = r.get("slug")
        if not slug or not isinstance(slug, str):
            raise ValueError("exercises: each row must have string 'slug'")
        slugs.append(slug)
        normalized.append(
            {
                "slug": slug,
                "name": r.get("name"),
                "description": r.get("description"),
                "category": r.get("category"),
                "equipment": json.dumps(r.get("equipment") or []),
                "muscle_groups": json.dumps(r.get("muscle_groups") or []),
                "risk_flags": json.dumps(r.get("risk_flags") or {}),
                "media_url": r.get("media_url"),
                "status": r.get("status") or "active",
                "metadata": json.dumps(r.get("metadata") or {}),
            }
        )

    # Upsert system exercises by slug.
    upsert_sql = """
        INSERT INTO exercises (
            slug, source, name, description, category,
            equipment, muscle_groups, risk_flags, media_url, status, author_user_id
        )
        VALUES (
            :slug, 'system', :name, :description, :category,
            CAST(:equipment AS jsonb), CAST(:muscle_groups AS jsonb), CAST(:risk_flags AS jsonb),
            :media_url, :status, NULL
        )
        ON CONFLICT (slug) WHERE source = 'system' AND slug IS NOT NULL
        DO UPDATE SET
            name = EXCLUDED.name,
            description = EXCLUDED.description,
            category = EXCLUDED.category,
            equipment = EXCLUDED.equipment,
            muscle_groups = EXCLUDED.muscle_groups,
            risk_flags = EXCLUDED.risk_flags,
            media_url = EXCLUDED.media_url,
            status = EXCLUDED.status,
            source = 'system',
            author_user_id = NULL
    """
    await session.execute(text(upsert_sql), normalized)

    # Archive system exercises missing from dataset.
    archive_sql = """
        UPDATE exercises
        SET status = 'archived'
        WHERE source = 'system' AND slug IS NOT NULL
          AND NOT (slug = ANY(:slugs))
          AND status != 'archived'
    """
    result = await session.execute(text(archive_sql), {"slugs": slugs})
    archived = int(result.rowcount or 0)

    return {"upserted": len(normalized), "archived": archived}


async def apply_reference_data(*, data_dir: Path, dry_run: bool, check: bool) -> int:
    version, datasets = _load_manifest(data_dir)

    checksums = {d.name: _sha256_file(data_dir / d.file) for d in datasets}
    overall_checksum = hashlib.sha256(
        ("\n".join(f"{name}:{chk}" for name, chk in sorted(checksums.items()))).encode("utf-8")
    ).hexdigest()

    async with AsyncSessionLocal() as session:
        # If requested, enforce drift check: applied record must match current checksum.
        if check:
            q = text(
                """
                SELECT checksum
                FROM reference_data_applied
                WHERE dataset_name = 'manifest' AND dataset_version = :version
                ORDER BY applied_at DESC
                LIMIT 1
                """
            )
            r = await session.execute(q, {"version": version})
            prev = r.scalar_one_or_none()
            if prev != overall_checksum:
                raise SystemExit(
                    f"reference data drift: expected applied checksum {prev!r}, current {overall_checksum!r} (version {version})"
                )
            return 0

        if dry_run:
            return 0

        # Upsert ref datasets first (stable codes).
        for d in datasets:
            if d.name.startswith("ref_"):
                rows = _load_json(data_dir / d.file)
                await _upsert_ref_table(session=session, table=d.name, rows=rows)

        # Then exercises (system catalog).
        for d in datasets:
            if d.name == "exercises":
                rows = list(_iter_ndjson(data_dir / d.file))
                await _upsert_exercises(session=session, rows=rows)

        # Record applied checksum (manifest-level).
        await session.execute(
            text(
                """
                INSERT INTO reference_data_applied (dataset_name, dataset_version, checksum, app_version, dry_run)
                VALUES ('manifest', :version, :checksum, :app_version, :dry_run)
                ON CONFLICT (dataset_name, dataset_version, checksum) DO NOTHING
                """
            ),
            {
                "version": version,
                "checksum": overall_checksum,
                "app_version": os.getenv("APP_VERSION") or os.getenv("GIT_COMMIT_SHA"),
                "dry_run": dry_run,
            },
        )

        await session.commit()
        return 0


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(prog="seed_reference_data")
    p.add_argument(
        "--data-dir",
        default=os.getenv("REFERENCE_DATA_DIR") or str(DEFAULT_DATA_DIR),
        help="Directory containing manifest.json and datasets",
    )
    sub = p.add_subparsers(dest="command", required=True)

    apply_p = sub.add_parser("apply", help="Apply reference data (idempotent upsert)")
    apply_p.add_argument("--dry-run", action="store_true", help="Validate inputs but do not write to DB")

    check_p = sub.add_parser("check", help="Fail if DB state doesn't match current dataset checksum")
    check_p.add_argument("--strict", action="store_true", help="Reserved for future use")

    return p.parse_args()


def main() -> None:
    args = _parse_args()
    data_dir = Path(args.data_dir).resolve()
    if not (data_dir / "manifest.json").exists():
        raise SystemExit(f"reference data dir not found or missing manifest.json: {data_dir}")

    if args.command == "apply":
        asyncio.run(apply_reference_data(data_dir=data_dir, dry_run=bool(args.dry_run), check=False))
        return
    if args.command == "check":
        asyncio.run(apply_reference_data(data_dir=data_dir, dry_run=False, check=True))
        return
    raise SystemExit(f"Unknown command: {args.command}")


if __name__ == "__main__":
    main()

