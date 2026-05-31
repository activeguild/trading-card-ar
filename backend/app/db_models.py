from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.database import Base


def _utcnow() -> datetime:
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    collections: Mapped[list["Collection"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )


class Collection(Base):
    __tablename__ = "collections"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="collections")
    cards: Mapped[list["Card"]] = relationship(
        back_populates="collection", cascade="all, delete-orphan"
    )


class Card(Base):
    __tablename__ = "cards"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    collection_id: Mapped[int] = mapped_column(Integer, ForeignKey("collections.id"))
    name: Mapped[str] = mapped_column(String)
    original_path: Mapped[str] = mapped_column(Text)
    corrected_path: Mapped[str] = mapped_column(Text)
    effect_path: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    collection: Mapped["Collection"] = relationship(back_populates="cards")
