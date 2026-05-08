# ruff: noqa: E402
import asyncio
import os
from typing import AsyncGenerator, Generator
from urllib.parse import unquote

# Let middleware skip rate limits (auth routes allow only 5 req/min otherwise).
os.environ["PYTEST_RUNNING"] = "1"

# Settings load when the app package is imported - choose the test DB first.
_SQLITE_TEST_URL = "sqlite+aiosqlite:///:memory:"
_TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")
_DATABASE_URL = os.environ.get("DATABASE_URL")
if _TEST_DATABASE_URL:
    os.environ["DATABASE_URL"] = _TEST_DATABASE_URL
elif not _DATABASE_URL:
    os.environ["DATABASE_URL"] = _SQLITE_TEST_URL
elif not _DATABASE_URL.startswith(("postgresql://", "postgresql+")):
    raise RuntimeError(
        "Refusing to run backend tests against non-PostgreSQL DATABASE_URL. "
        "Set TEST_DATABASE_URL for an explicit test override, or unset DATABASE_URL "
        "to use in-memory SQLite."
    )

os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:ABCpytest_test_bot_token_value")
os.environ.setdefault("TELEGRAM_WEBAPP_URL", "https://example.com/webapp")
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-at-least-thirty-two-chars")
os.environ["ENVIRONMENT"] = "test"
os.environ["DEBUG"] = "true"

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.engine import URL, make_url
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool, StaticPool

import app.domain.registry  # noqa: F401 — full metadata for create_all
from app.domain.base import Base
from app.infrastructure.database import get_async_db
from app.main import app
from app.settings import settings
from app.tests.telegram_webapp import build_init_data


@compiles(JSONB, "sqlite")
def _compile_jsonb_for_sqlite(*_args, **_kwargs) -> str:
    """Allow SQLite fallback to approximate PostgreSQL JSONB columns."""
    return "JSON"


def _is_postgres_url(url: URL) -> bool:
    return url.drivername.startswith("postgresql")


def _is_sqlite_url(url: URL) -> bool:
    return url.drivername.startswith("sqlite")


def _safe_marker(value: str | None) -> bool:
    if not value:
        return False
    normalized = unquote(value).lower()
    return any(marker in normalized for marker in ("test", "pytest", "ci"))


def _assert_safe_test_database(url: URL) -> None:
    """Guard destructive schema resets from touching production/dev databases."""
    if settings.ENVIRONMENT.strip().lower() == "production":
        raise RuntimeError("Refusing to run tests with ENVIRONMENT=production")

    if _is_sqlite_url(url):
        if str(url) not in {_SQLITE_TEST_URL, "sqlite+aiosqlite://"}:
            raise RuntimeError("SQLite tests must use the in-memory test database")
        return

    if not _is_postgres_url(url):
        raise RuntimeError(f"Unsupported test database driver: {url.drivername}")

    host = (url.host or "").lower()
    local_hosts = {"localhost", "127.0.0.1", "::1", "postgres", "db"}
    if host not in local_hosts and not _safe_marker(host):
        raise RuntimeError(f"Refusing to reset non-local/non-test database host: {host!r}")

    if not (_safe_marker(url.database) or _safe_marker(url.username)):
        raise RuntimeError(
            "Refusing to reset PostgreSQL database without a test marker in "
            "the database name or username"
        )


_test_db_url = make_url(settings.DATABASE_URL)
_assert_safe_test_database(_test_db_url)

_engine_kwargs = {}
if _is_sqlite_url(_test_db_url):
    # One shared in-memory SQLite so multiple HTTP requests in a test see the same DB.
    _engine_kwargs = {
        "connect_args": {"check_same_thread": False},
        "poolclass": StaticPool,
    }
else:
    # pytest-asyncio uses function-scoped loops; do not reuse asyncpg connections across loops.
    _engine_kwargs = {"poolclass": NullPool}

_test_engine = create_async_engine(settings.DATABASE_URL, **_engine_kwargs)
TestingSessionLocal = sessionmaker(
    _test_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def _override_get_async_db() -> AsyncGenerator[AsyncSession, None]:
    async with TestingSessionLocal() as session:
        try:
            yield session
        finally:
            await session.close()


app.dependency_overrides[get_async_db] = _override_get_async_db


@pytest_asyncio.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_database() -> AsyncGenerator[None, None]:
    """Create schema on the same engine used by API dependency override."""
    await _reset_schema()
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await _test_engine.dispose()


async def _reset_schema() -> None:
    """Drop and recreate the test schema after safety checks."""
    _assert_safe_test_database(_test_db_url)
    async with _test_engine.begin() as conn:
        if _is_postgres_url(_test_db_url):
            await conn.execute(text("DROP SCHEMA IF EXISTS public CASCADE"))
            await conn.execute(text("CREATE SCHEMA public"))
            await conn.execute(text("GRANT ALL ON SCHEMA public TO public"))
        else:
            await conn.run_sync(Base.metadata.drop_all)
        await conn.run_sync(Base.metadata.create_all)
        await _create_test_support_tables(conn)


async def _create_test_support_tables(conn) -> None:
    """Create raw-SQL tables used by repositories but not mapped in ORM metadata."""
    await conn.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS feature_flags (
                key VARCHAR(120) PRIMARY KEY,
                enabled BOOLEAN NOT NULL DEFAULT false
            )
            """
        )
    )


async def _clear_data() -> None:
    """Keep committed HTTP-request data from leaking between tests."""
    _assert_safe_test_database(_test_db_url)
    table_names = [table.name for table in reversed(Base.metadata.sorted_tables)]
    if not table_names:
        return

    async with _test_engine.begin() as conn:
        if _is_postgres_url(_test_db_url):
            quoted_names = ", ".join(f'"{name}"' for name in table_names)
            await conn.execute(text(f"TRUNCATE TABLE {quoted_names} RESTART IDENTITY CASCADE"))
        else:
            await conn.execute(text("PRAGMA foreign_keys=OFF"))
            for name in table_names:
                await conn.execute(text(f'DELETE FROM "{name}"'))
            await conn.execute(text("DELETE FROM feature_flags"))
            await conn.execute(text("PRAGMA foreign_keys=ON"))
        await _seed_test_reference_rows(conn)


async def _seed_test_reference_rows(conn) -> None:
    """Seed stable rows that API tests reference by id under real FK enforcement."""
    exercise_ids = (1, 2, 10, 11, 20, 99, 101, 102, 201)
    if _is_postgres_url(_test_db_url):
        for exercise_id in exercise_ids:
            await conn.execute(
                text(
                    """
                    INSERT INTO exercises (
                        id, name, description, category, equipment, muscle_groups,
                        muscle_group, aliases, risk_flags, status, source
                    )
                    VALUES (
                        :id, :name, 'Seed exercise for FK-backed API tests',
                        'strength', '[]'::jsonb, '[]'::jsonb, 'Chest', '[]'::jsonb,
                        '{}'::jsonb, 'active', 'system'
                    )
                    ON CONFLICT (id) DO NOTHING
                    """
                ),
                {"id": exercise_id, "name": f"Seed Exercise {exercise_id}"},
            )
        await conn.execute(text("SELECT setval(pg_get_serial_sequence('exercises', 'id'), 201, true)"))
    else:
        for exercise_id in exercise_ids:
            await conn.execute(
                text(
                    """
                    INSERT OR IGNORE INTO exercises (
                        id, name, description, category, equipment, muscle_groups,
                        muscle_group, aliases, risk_flags, status, source
                    )
                    VALUES (
                        :id, :name, 'Seed exercise for FK-backed API tests',
                        'strength', '[]', '[]', 'Chest', '[]', '{}', 'active', 'system'
                    )
                    """
                ),
                {"id": exercise_id, "name": f"Seed Exercise {exercise_id}"},
            )


@pytest_asyncio.fixture(autouse=True)
async def clean_database(setup_database) -> AsyncGenerator[None, None]:
    """Start each test from an empty schema."""
    await _clear_data()
    yield


@pytest_asyncio.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Optional direct DB session (same engine as HTTP tests)."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    """HTTP client (httpx ≥0.28: ASGI via transport, not app=)."""
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_user_data() -> dict:
    """Sample user data for testing."""
    return {
        "telegram_id": 123456789,
        "username": "testuser",
        "first_name": "Test",
        "last_name": "User",
        "photo_url": "https://example.com/photo.jpg",
    }


@pytest.fixture
def sample_workout_data() -> dict:
    """Sample workout data for testing."""
    return {
        "name": "Morning Workout",
        "type": "strength",
        "exercises": [
            {
                "exercise_id": 1,
                "sets": 3,
                "reps": 10,
                "weight": 50.0,
            }
        ],
        "duration": 3600,
        "notes": "Great workout!",
    }


@pytest.fixture
def mock_telegram_user() -> dict:
    """Telegram WebApp user object (embedded in initData)."""
    return {
        "id": 123456789,
        "first_name": "Test",
        "last_name": "User",
        "username": "testuser",
        "photo_url": "https://t.me/i/userpic/320/testuser.jpg",
        "language_code": "en",
    }


@pytest.fixture
def mock_telegram_auth_body(mock_telegram_user: dict) -> dict:
    """POST /telegram JSON body with valid signed init_data."""
    init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=mock_telegram_user)
    return {"init_data": init_data}


class TestUser:
    """Helper class for test user operations."""

    def __init__(self, client: AsyncClient, telegram_id: int = 123456789):
        self.client = client
        self.telegram_id = telegram_id
        self.token = None

    async def authenticate(self) -> str:
        """Authenticate test user and return token."""
        user_obj = {
            "id": self.telegram_id,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
        }
        init_data = build_init_data(bot_token=settings.TELEGRAM_BOT_TOKEN, user=user_obj)
        response = await self.client.post(
            "/api/v1/users/auth/telegram",
            json={"init_data": init_data},
        )
        assert response.status_code == 200, response.text

        self.token = response.json()["access_token"]
        return self.token

    def get_headers(self) -> dict:
        """Get authorization headers."""
        if not self.token:
            raise ValueError("User not authenticated. Call authenticate() first.")
        return {"Authorization": f"Bearer {self.token}"}


@pytest_asyncio.fixture
async def authenticated_client(client: AsyncClient) -> AsyncClient:
    """Create an authenticated client for testing protected endpoints."""
    # SlowAPI rate limit for /users/auth/telegram is 10/min per IP.
    # Many tests need an authenticated client, so authenticate once per test run and reuse the JWT.
    global _AUTH_TOKEN_CACHE
    if _AUTH_TOKEN_CACHE is not None:
        client.headers.update({"Authorization": f"Bearer {_AUTH_TOKEN_CACHE}"})
        sanity = await client.get("/api/v1/users/me")
        if sanity.status_code == 200:
            return client

    test_user = TestUser(client)
    _AUTH_TOKEN_CACHE = await test_user.authenticate()
    client.headers.update({"Authorization": f"Bearer {_AUTH_TOKEN_CACHE}"})
    return client


# Cached token for authenticated_client fixture (see note above).
_AUTH_TOKEN_CACHE: str | None = None
