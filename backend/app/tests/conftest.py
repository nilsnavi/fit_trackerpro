import asyncio
import os

# Let middleware skip rate limits (auth routes allow only 5 req/min otherwise).
os.environ["PYTEST_RUNNING"] = "1"

# Settings load when the app package is imported — ensure required env exists.
os.environ.setdefault("DATABASE_URL", "sqlite+aiosqlite:///:memory:")
os.environ.setdefault("TELEGRAM_BOT_TOKEN", "123456:ABCpytest_test_bot_token_value")
os.environ.setdefault("TELEGRAM_WEBAPP_URL", "https://example.com/webapp")
os.environ.setdefault("SECRET_KEY", "pytest-secret-key-at-least-thirty-two-chars")

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool
from typing import AsyncGenerator, Generator

from app.domain.base import Base
import app.domain.registry  # noqa: F401 — full metadata for create_all
from app.infrastructure.database import get_async_db
from app.main import app
from app.tests.telegram_webapp import build_init_data
from app.settings import settings

# One shared in-memory SQLite so multiple HTTP requests in a test see the same DB.
_test_engine = create_async_engine(
    "sqlite+aiosqlite://",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)
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
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with _test_engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


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
    test_user = TestUser(client)
    await test_user.authenticate()
    client.headers.update(test_user.get_headers())
    return client
