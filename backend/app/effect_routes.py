from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, User
from app.deps import get_current_user, get_db
from app.effect import generate_hologram_video

router = APIRouter(prefix="/api", tags=["effects"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"

AVAILABLE_EFFECTS = [
    {"id": "hologram_border", "name": "Hologram Border", "description": "Rainbow hologram effect on card border"},
]


class EffectPreset(BaseModel):
    id: str
    name: str
    description: str


class GenerateRequest(BaseModel):
    effect_id: str


class EffectResult(BaseModel):
    effect_url: str


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


@router.get("/effects", response_model=list[EffectPreset])
def list_effects():
    return AVAILABLE_EFFECTS


@router.post("/cards/{card_id}/effect", response_model=EffectResult)
def generate_effect(
    card_id: int,
    req: GenerateRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _verify_card_ownership(card_id, user, db)

    if req.effect_id not in [e["id"] for e in AVAILABLE_EFFECTS]:
        raise HTTPException(status_code=400, detail="Unknown effect")

    if not card.corrected_path:
        raise HTTPException(status_code=422, detail="Card has no corrected image")

    corrected_abs = UPLOADS_DIR / card.corrected_path
    if not corrected_abs.exists():
        raise HTTPException(status_code=422, detail="Corrected image file not found")

    effect_rel = f"cards/{card_id}/effect.mp4"
    effect_abs = UPLOADS_DIR / effect_rel

    generate_hologram_video(corrected_abs, effect_abs)

    card.effect_path = effect_rel
    db.commit()
    db.refresh(card)

    return EffectResult(effect_url=f"/uploads/{effect_rel}")


@router.delete("/cards/{card_id}/effect", status_code=204)
def delete_effect(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _verify_card_ownership(card_id, user, db)

    if card.effect_path:
        effect_abs = UPLOADS_DIR / card.effect_path
        if effect_abs.exists():
            effect_abs.unlink()
        card.effect_path = None
        db.commit()
