import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_segment_returns_person_and_background(test_image_bytes: bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/segment",
            files={"file": ("test.png", test_image_bytes, "image/png")},
        )
    assert response.status_code == 200
    data = response.json()
    assert "person" in data
    assert "background" in data
    assert data["person"].startswith("data:image/png;base64,")
    assert data["background"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_segment_rejects_non_image():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/segment",
            files={"file": ("test.txt", b"not an image", "text/plain")},
        )
    assert response.status_code == 400
