from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import Depends

from app.db_models import Card
from app.deps import get_db

router = APIRouter(prefix="/api/ar", tags=["ar"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class ARCardOut(BaseModel):
    id: int
    name: str
    marker_url: str
    target_url: str
    effect_url: str | None


@router.get("/card/{card_id}", response_model=ARCardOut)
def get_ar_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    target_json = f"cards/{card_id}/target/card_{card_id}.json"
    target_abs = UPLOADS_DIR / target_json
    if not target_abs.exists():
        raise HTTPException(status_code=404, detail="Image target not found")

    return ARCardOut(
        id=card.id,
        name=card.name,
        marker_url=f"/uploads/{card.corrected_path}",
        target_url=f"/uploads/{target_json}",
        effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
    )
