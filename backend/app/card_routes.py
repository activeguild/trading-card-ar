from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, User
from app.deps import get_current_user, get_db
from app.model import process_card, save_card_images
from app.target import generate_image_target

router = APIRouter(prefix="/api/cards", tags=["cards"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class CardOut(BaseModel):
    id: int
    collection_id: int
    original_url: str
    corrected_url: str
    effect_url: str | None
    created_at: str

    model_config = {"from_attributes": True}


def _card_to_out(card: Card) -> CardOut:
    return CardOut(
        id=card.id,
        collection_id=card.collection_id,
        original_url=f"/uploads/{card.original_path}",
        corrected_url=f"/uploads/{card.corrected_path}",
        effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
        created_at=card.created_at.isoformat(),
    )


@router.get("/by-collection/{collection_id}", response_model=list[CardOut])
def list_cards(
    collection_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == user.id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")
    return [_card_to_out(c) for c in col.cards]


@router.post("/register/{collection_id}", response_model=CardOut, status_code=201)
def register_card(
    collection_id: int,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = (
        db.query(Collection)
        .filter(Collection.id == collection_id, Collection.user_id == user.id)
        .first()
    )
    if not col:
        raise HTTPException(status_code=404, detail="Collection not found")

    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image = Image.open(file.file)
        image.load()
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Cannot read image file")

    original, corrected = process_card(image)
    if corrected is None:
        raise HTTPException(
            status_code=422,
            detail="Could not detect card corners for perspective correction",
        )

    # Create card record first to get ID
    card = Card(
        collection_id=collection_id,
        original_path="",
        corrected_path="",
    )
    db.add(card)
    db.commit()
    db.refresh(card)

    # Save images and update paths
    original_path, corrected_path = save_card_images(
        card.id, original, corrected, UPLOADS_DIR
    )
    card.original_path = original_path
    card.corrected_path = corrected_path
    db.commit()
    db.refresh(card)

    # Generate 8thwall image target
    target_dir = UPLOADS_DIR / "cards" / str(card.id) / "target"
    corrected_abs = UPLOADS_DIR / corrected_path
    generate_image_target(corrected_abs, target_dir, f"card_{card.id}")

    return _card_to_out(card)



@router.get("/{card_id}", response_model=CardOut)
def get_card(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col = db.query(Collection).filter(
        Collection.id == card.collection_id, Collection.user_id == user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Card not found")
    return _card_to_out(card)


@router.delete("/{card_id}", status_code=204)
def delete_card(
    card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    card = db.query(Card).filter(Card.id == card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col = db.query(Collection).filter(
        Collection.id == card.collection_id, Collection.user_id == user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Card not found")
    db.delete(card)
    db.commit()
