import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import NullPool

from app.main import app
from app.models import Base

# Test database URL (SQLite for testing)
TEST_DATABASE_URL = "sqlite+aiosqlite:///:memory:"

# Create async engine for testing
engine = create_async_engine(
    TEST_DATABASE_URL,
    poolclass=NullPool,
    future=True
)

# Create sessionmaker
TestingSessionLocal = sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)


@pytest_asyncio.fixture(scope="session")
def event_loop() -> Generator[asyncio.AbstractEventLoop, None, None]:
    """Create an instance of the default event loop for the test session."""
    loop = asyncio.get_event_loop_policy().new_event_loop()
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def setup_database() -> AsyncGenerator[None, None]:
    """Set up the test database."""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)


@pytest_asyncio.fixture
async def db_session(setup_database) -> AsyncGenerator[AsyncSession, None]:
    """Create a fresh database session for each test."""
    async with TestingSessionLocal() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(setup_database) -> AsyncGenerator[AsyncClient, None]:
    """Create an HTTP client for testing."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def sample_user_data() -> dict:
    """Sample user data for testing."""
    return {
        "telegram_id": 123456789,
        "username": "testuser",
        "first_name": "Test",
        "last_name": "User",
        "photo_url": "https://example.com/photo.jpg"
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
                "weight": 50.0
            }
        ],
        "duration": 3600,
        "notes": "Great workout!"
    }


@pytest.fixture
def mock_telegram_auth_data() -> dict:
    """Mock Telegram authentication data."""
    return {
        "id": 123456789,
        "first_name": "Test",
        "last_name": "User",
        "username": "testuser",
        "photo_url": "https://t.me/i/userpic/320/testuser.jpg",
        "auth_date": 1234567890,
        "hash": "mock_hash_for_testing"
    }


class TestUser:
    """Helper class for test user operations."""

    def __init__(self, client: AsyncClient, telegram_id: int = 123456789):
        self.client = client
        self.telegram_id = telegram_id
        self.token = None

    async def authenticate(self) -> str:
        """Authenticate test user and return token."""
        auth_data = {
            "id": self.telegram_id,
            "first_name": "Test",
            "last_name": "User",
            "username": "testuser",
            "auth_date": 1234567890,
            "hash": "mock_hash"
        }

        response = await self.client.post("/api/v1/auth/telegram", json=auth_data)
        assert response.status_code == 200

        self.token = response.json()["access_token"]
        return self.token

    def get_headers(self) -> dict:
        """Get authorization headers."""
        if not self.token:
            raise ValueError(
                "User not authenticated. Call authenticate() first.")
        return {"Authorization": f"Bearer {self.token}"}


@pytest_asyncio.fixture
async def authenticated_client(client: AsyncClient) -> AsyncClient:
    """Create an authenticated client for testing protected endpoints."""
    test_user = TestUser(client)
    await test_user.authenticate()
    client.headers.update(test_user.get_headers())
    return client
