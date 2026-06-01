from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, Deck, DeckCard, User
from app.deps import get_current_user, get_db

router = APIRouter(prefix="/api/decks", tags=["decks"])

MAX_DECK_SIZE = 5


class DeckCreate(BaseModel):
    name: str


class DeckCardAdd(BaseModel):
    card_id: int


class CardInDeck(BaseModel):
    id: int
    card_id: int
    position: int
    corrected_url: str
    effect_url: str | None


class DeckOut(BaseModel):
    id: int
    name: str
    card_count: int
    created_at: str


class DeckDetailOut(BaseModel):
    id: int
    name: str
    cards: list[CardInDeck]
    created_at: str


def _verify_deck(deck_id: int, user: User, db: Session) -> Deck:
    deck = db.query(Deck).filter(Deck.id == deck_id, Deck.user_id == user.id).first()
    if not deck:
        raise HTTPException(status_code=404, detail="Deck not found")
    return deck


@router.get("", response_model=list[DeckOut])
def list_decks(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    decks = (
        db.query(Deck)
        .filter(Deck.user_id == user.id)
        .order_by(Deck.created_at.desc())
        .all()
    )
    return [
        DeckOut(
            id=d.id,
            name=d.name,
            card_count=len(d.deck_cards),
            created_at=d.created_at.isoformat(),
        )
        for d in decks
    ]


@router.post("", response_model=DeckOut, status_code=201)
def create_deck(
    req: DeckCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = Deck(name=req.name, user_id=user.id)
    db.add(deck)
    db.commit()
    db.refresh(deck)
    return DeckOut(
        id=deck.id,
        name=deck.name,
        card_count=0,
        created_at=deck.created_at.isoformat(),
    )


@router.get("/{deck_id}", response_model=DeckDetailOut)
def get_deck(
    deck_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _verify_deck(deck_id, user, db)
    cards = [
        CardInDeck(
            id=dc.id,
            card_id=dc.card_id,
            position=dc.position,

            corrected_url=f"/uploads/{dc.card.corrected_path}",
            effect_url=f"/uploads/{dc.card.effect_path}" if dc.card.effect_path else None,
        )
        for dc in deck.deck_cards
    ]
    return DeckDetailOut(
        id=deck.id,
        name=deck.name,
        cards=cards,
        created_at=deck.created_at.isoformat(),
    )


@router.post("/{deck_id}/cards", response_model=CardInDeck, status_code=201)
def add_card_to_deck(
    deck_id: int,
    req: DeckCardAdd,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _verify_deck(deck_id, user, db)

    if len(deck.deck_cards) >= MAX_DECK_SIZE:
        raise HTTPException(status_code=400, detail=f"Deck is full (max {MAX_DECK_SIZE})")

    # Verify card belongs to user
    card = db.query(Card).filter(Card.id == req.card_id).first()
    if not card:
        raise HTTPException(status_code=404, detail="Card not found")
    col = db.query(Collection).filter(
        Collection.id == card.collection_id, Collection.user_id == user.id
    ).first()
    if not col:
        raise HTTPException(status_code=404, detail="Card not found")

    # Check duplicate
    existing = db.query(DeckCard).filter(
        DeckCard.deck_id == deck_id, DeckCard.card_id == req.card_id
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="Card already in deck")

    # Next position
    next_pos = max((dc.position for dc in deck.deck_cards), default=0) + 1

    dc = DeckCard(deck_id=deck_id, card_id=req.card_id, position=next_pos)
    db.add(dc)
    db.commit()
    db.refresh(dc)

    return CardInDeck(
        id=dc.id,
        card_id=dc.card_id,
        position=dc.position,
        corrected_url=f"/uploads/{card.corrected_path}",
        effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
    )


@router.delete("/{deck_id}/cards/{deck_card_id}", status_code=204)
def remove_card_from_deck(
    deck_id: int,
    deck_card_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _verify_deck(deck_id, user, db)
    dc = db.query(DeckCard).filter(
        DeckCard.id == deck_card_id, DeckCard.deck_id == deck.id
    ).first()
    if not dc:
        raise HTTPException(status_code=404, detail="Card not in deck")
    db.delete(dc)
    db.commit()


@router.delete("/{deck_id}", status_code=204)
def delete_deck(
    deck_id: int,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    deck = _verify_deck(deck_id, user, db)
    db.delete(deck)
    db.commit()
