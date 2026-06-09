import json

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, User
from app.deps import get_current_user, get_db

router = APIRouter(prefix="/api", tags=["effects"])


class EffectSettings(BaseModel):
    transition: str | None = None
    borderEffect: str | None = None
    innerEffect: str | None = None
    packType: str = "normal"


class EffectSettingsResult(BaseModel):
    effect_settings: EffectSettings | None


def _verify_card_ownership(card_id: int, user: User, db: Session) -> Card:
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col = db.query(Collection).filter(
        Collection.id == card.collection_id, Collection.user_id == user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Card not found")
    return card


@router.post("/cards/{card_id}/effect-settings", response_model=EffectSettingsResult)
def save_effect_settings(
    card_id: int,
    settings: EffectSettings,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _verify_card_ownership(card_id, user, db)
    card.effect_settings = json.dumps(settings.model_dump())
    db.commit()
    db.refresh(card)
    return EffectSettingsResult(effect_settings=settings)


@router.delete("/cards/{card_id}/effect-settings", status_code=204)
def delete_effect_settings(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _verify_card_ownership(card_id, user, db)
    card.effect_settings = None
    db.commit()
