import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_register(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password456"},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_login_wrong_password(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        cookies = reg.cookies
        response = await client.post(
            "/api/auth/refresh",
            cookies=cookies,
        )
    assert response.status_code == 200
    assert "access_token" in response.json()
