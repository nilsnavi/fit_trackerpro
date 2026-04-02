"""Bootstrap Alembic revision tracking for legacy databases.

If a database already contains application tables but has no `alembic_version` table,
we stamp it to current Alembic head so that subsequent `alembic upgrade head` can run
from a synchronized state.
"""
from __future__ import annotations

import asyncio
import os
import sys

from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import text
from sqlalchemy.ext.asyncio import create_async_engine


def _to_async_url(url: str) -> str:
    if "+asyncpg" in url:
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", "postgresql+asyncpg://", 1)
    return url


async def _run() -> int:
    if len(sys.argv) < 2:
        print("Usage: python bootstrap_alembic_version.py <alembic.ini>", file=sys.stderr)
        return 2

    ini_path = sys.argv[1]
    db_url = os.getenv("DATABASE_URL_SYNC") or os.getenv("DATABASE_URL")
    if not db_url:
        print("DATABASE_URL[_SYNC] is not set", file=sys.stderr)
        return 2

    async_url = _to_async_url(db_url)
    cfg = Config(ini_path)
    script = ScriptDirectory.from_config(cfg)
    heads = script.get_heads()
    if not heads:
        print("No alembic heads found", file=sys.stderr)
        return 2
    head = heads[0]

    engine = create_async_engine(async_url)
    try:
        async with engine.begin() as conn:
            has_alembic_version = bool(
                (await conn.execute(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public' AND table_name = 'alembic_version'
                        )
                        """
                    )
                )).scalar()
            )
            if has_alembic_version:
                print("alembic_version table already exists")
                return 0

            has_users_table = bool(
                (await conn.execute(
                    text(
                        """
                        SELECT EXISTS (
                            SELECT 1
                            FROM information_schema.tables
                            WHERE table_schema = 'public' AND table_name = 'users'
                        )
                        """
                    )
                )).scalar()
            )
            if not has_users_table:
                print("No app tables found; fresh DB bootstrap is not required")
                return 0

            await conn.execute(text("CREATE TABLE IF NOT EXISTS alembic_version (version_num VARCHAR(32) NOT NULL PRIMARY KEY)"))
            await conn.execute(text("DELETE FROM alembic_version"))
            await conn.execute(text("INSERT INTO alembic_version(version_num) VALUES (:version_num)"), {"version_num": head})
            print(f"Bootstrapped alembic_version to head {head}")
            return 0
    finally:
        await engine.dispose()


if __name__ == "__main__":
    raise SystemExit(asyncio.run(_run()))
