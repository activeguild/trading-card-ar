from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, User
from app.deps import get_current_user, get_db

router = APIRouter(prefix="/api", tags=["effects"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


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


@router.post("/cards/{card_id}/effect", response_model=EffectResult)
def upload_effect(
    card_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = _verify_card_ownership(card_id, user, db)

    effect_rel = f"cards/{card_id}/effect.mp4"
    effect_abs = UPLOADS_DIR / effect_rel
    effect_abs.parent.mkdir(parents=True, exist_ok=True)

    with open(str(effect_abs), "wb") as f:
        f.write(file.file.read())

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
