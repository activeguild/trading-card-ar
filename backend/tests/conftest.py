import io

import pytest
from PIL import Image


@pytest.fixture
def test_image_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()
