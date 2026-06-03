from pathlib import Path

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session
from fastapi import Depends

from app.db_models import Card, Deck
from app.deps import get_db

router = APIRouter(prefix="/api/ar", tags=["ar"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class AREffectSettings(BaseModel):
    hologram: bool = True
    neon: bool = True
    glow: bool = True
    glow_color: list[float] = [0.66, 0.33, 0.97]


class ARCardOut(BaseModel):
    id: int
    marker_url: str
    target_url: str
    effect_url: str | None
    effect_settings: AREffectSettings | None


@router.get("/card/{card_id}", response_model=ARCardOut)
def get_ar_card(card_id: int, db: Session = Depends(get_db)):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")

    target_json = f"cards/{card_id}/target/card_{card_id}.json"
    target_abs = UPLOADS_DIR / target_json
    if not target_abs.exists():
        raise HTTPException(status_code=404, detail="Image target not found")

    import json
    settings = None
    if card.effect_settings:
        settings = AREffectSettings(**json.loads(card.effect_settings))

    return ARCardOut(
        id=card.id,
        marker_url=f"/uploads/{card.corrected_path}",
        target_url=f"/uploads/{target_json}",
        effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
        effect_settings=settings,
    )


class ARDeckCardOut(BaseModel):
    id: int
    marker_url: str
    target_url: str
    effect_url: str | None
    effect_settings: AREffectSettings | None


class ARDeckOut(BaseModel):
    id: int
    name: str
    cards: list[ARDeckCardOut]


@router.get("/deck/{deck_id}", response_model=ARDeckOut)
def get_ar_deck(deck_id: int, db: Session = Depends(get_db)):
    deck = db.query(Deck).filter(Deck.id == deck_id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")

    cards = []
    for dc in deck.deck_cards:
        card = dc.card
        target_json = f"cards/{card.id}/target/card_{card.id}.json"
        target_abs = UPLOADS_DIR / target_json
        if not target_abs.exists():
            continue
        import json
        card_settings = None
        if card.effect_settings:
            card_settings = AREffectSettings(**json.loads(card.effect_settings))
        cards.append(ARDeckCardOut(
            id=card.id,
            marker_url=f"/uploads/{card.corrected_path}",
            target_url=f"/uploads/{target_json}",
            effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
            effect_settings=card_settings,
        ))

    return ARDeckOut(id=deck.id, name=deck.name, cards=cards)
