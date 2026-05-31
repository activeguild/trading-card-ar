import io

import pytest
from PIL import Image
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.deps import get_db
from app.main import app


@pytest.fixture
def test_image_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def override_db(db_session):
    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.clear()
