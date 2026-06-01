# トレカAR Phase 5: デッキ管理 + マルチマーカーAR Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add deck management (create decks, add cards from collections, max 5 per deck) and multi-marker AR viewing where all cards in a deck are tracked simultaneously with their effects.

**Architecture:** Add Deck and DeckCard ORM models, deck CRUD routes with card assignment, a public deck AR API, and frontend pages for deck list, deck detail (add/remove cards), and a multi-marker AR viewer that loads all deck cards as ImageTracker instances.

**Tech Stack:** SQLAlchemy (existing), FastAPI (existing), React + react-router (existing), @j1ngzoue/8thwall-react-three-fiber (existing)

---

## File Structure

### Backend

```
backend/app/
├── db_models.py        # MODIFY: add Deck, DeckCard models
├── deck_routes.py      # CREATE: CRUD /api/decks, card assignment
├── ar_routes.py        # MODIFY: add GET /api/ar/deck/:id
├── main.py             # MODIFY: register deck_routes
```

### Frontend

```
frontend/src/
├── pages/
│   ├── DecksPage.tsx              # CREATE: deck list + create
│   ├── DecksPage.module.css
│   ├── DeckDetailPage.tsx         # CREATE: deck cards + add from collections
│   ├── DeckDetailPage.module.css
│   ├── DeckARViewerPage.tsx       # CREATE: multi-marker AR viewer
│   └── DeckARViewerPage.module.css
├── App.tsx                        # MODIFY: add deck routes
```

---

### Task 1: Add Deck and DeckCard models

**Files:**
- Modify: `backend/app/db_models.py`

- [ ] **Step 1: Add Deck and DeckCard classes to `backend/app/db_models.py`**

Add these imports to the existing import line (add `UniqueConstraint`):

Change:
```python
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text
```
To:
```python
from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
```

Add a `decks` relationship to the `User` class, after the `collections` relationship:
```python
    decks: Mapped[list["Deck"]] = relationship(
        back_populates="user", cascade="all, delete-orphan"
    )
```

Add these classes at the end of the file:

```python
class Deck(Base):
    __tablename__ = "decks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    name: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=_utcnow)

    user: Mapped["User"] = relationship(back_populates="decks")
    deck_cards: Mapped[list["DeckCard"]] = relationship(
        back_populates="deck", cascade="all, delete-orphan",
        order_by="DeckCard.position",
    )


class DeckCard(Base):
    __tablename__ = "deck_cards"
    __table_args__ = (
        UniqueConstraint("deck_id", "position", name="uq_deck_position"),
        UniqueConstraint("deck_id", "card_id", name="uq_deck_card"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    deck_id: Mapped[int] = mapped_column(Integer, ForeignKey("decks.id"))
    card_id: Mapped[int] = mapped_column(Integer, ForeignKey("cards.id"))
    position: Mapped[int] = mapped_column(Integer)

    deck: Mapped["Deck"] = relationship(back_populates="deck_cards")
    card: Mapped["Card"] = relationship()
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/db_models.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/db_models.py
git commit -m "feat: add Deck and DeckCard models"
```

---

### Task 2: Deck CRUD routes

**Files:**
- Create: `backend/app/deck_routes.py`

- [ ] **Step 1: Create `backend/app/deck_routes.py`**

```python
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
    card_name: str
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
            card_name=dc.card.name,
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
        card_name=card.name,
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/deck_routes.py
git commit -m "feat: add deck CRUD routes with card assignment"
```

---

### Task 3: Add deck AR API + register routers

**Files:**
- Modify: `backend/app/ar_routes.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add deck AR endpoint to `backend/app/ar_routes.py`**

Add `Deck, DeckCard` to the import from db_models:

Change:
```python
from app.db_models import Card
```
To:
```python
from app.db_models import Card, Deck
```

Add this new model and endpoint after the existing `get_ar_card` function:

```python
class ARDeckCardOut(BaseModel):
    id: int
    name: str
    target_url: str
    effect_url: str | None


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
        cards.append(ARDeckCardOut(
            id=card.id,
            name=card.name,
            target_url=f"/uploads/{target_json}",
            effect_url=f"/uploads/{card.effect_path}" if card.effect_path else None,
        ))

    return ARDeckOut(id=deck.id, name=deck.name, cards=cards)
```

- [ ] **Step 2: Add deck router to `backend/app/main.py`**

Add import:
```python
from app.deck_routes import router as deck_router
```

Add after `app.include_router(ar_router)`:
```python
app.include_router(deck_router)
```

- [ ] **Step 3: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/ar_routes.py').read()); ast.parse(open('app/main.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/ar_routes.py backend/app/main.py
git commit -m "feat: add deck AR API and register deck router"
```

---

### Task 4: Frontend — Decks page

**Files:**
- Create: `frontend/src/pages/DecksPage.tsx`
- Create: `frontend/src/pages/DecksPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/DecksPage.module.css`**

```css
.page {
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.addBtn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background-color: #3b82f6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.list {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.card {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  text-decoration: none;
  color: inherit;
}

.cardName {
  font-size: 16px;
  font-weight: 600;
  color: #1e293b;
}

.cardCount {
  font-size: 13px;
  color: #94a3b8;
}

.empty {
  text-align: center;
  color: #94a3b8;
  padding: 48px 0;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 320px;
}

.modalTitle {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.modalInput {
  width: 100%;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  margin-bottom: 16px;
  outline: none;
}

.modalActions {
  display: flex;
  gap: 8px;
  justify-content: flex-end;
}

.modalCancel {
  padding: 8px 16px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: none;
  cursor: pointer;
}

.modalSubmit {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background-color: #3b82f6;
  color: white;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 2: Create `frontend/src/pages/DecksPage.tsx`**

```tsx
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './DecksPage.module.css'

type DeckItem = {
  id: number
  name: string
  card_count: number
}

export function DecksPage() {
  const { token } = useAuth()
  const [decks, setDecks] = useState<DeckItem[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const data = await apiJson<DeckItem[]>('/api/decks', token)
    setDecks(data)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await apiJson('/api/decks', token, {
      method: 'POST',
      body: JSON.stringify({ name: newName.trim() }),
      headers: { 'Content-Type': 'application/json' },
    })
    setNewName('')
    setShowModal(false)
    load()
  }

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>Decks</h2>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + New
        </button>
      </div>
      {decks.length === 0 ? (
        <p className={styles.empty}>No decks yet</p>
      ) : (
        <div className={styles.list}>
          {decks.map((d) => (
            <Link key={d.id} to={`/decks/${d.id}`} className={styles.card}>
              <span className={styles.cardName}>{d.name}</span>
              <span className={styles.cardCount}>{d.card_count}/5 cards</span>
            </Link>
          ))}
        </div>
      )}
      {showModal && (
        <div className={styles.modalOverlay} onClick={() => setShowModal(false)}>
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h3 className={styles.modalTitle}>New Deck</h3>
            <input
              className={styles.modalInput}
              placeholder="Deck name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button type="button" className={styles.modalCancel} onClick={() => setShowModal(false)}>
                Cancel
              </button>
              <button type="submit" className={styles.modalSubmit}>Create</button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DecksPage.tsx frontend/src/pages/DecksPage.module.css
git commit -m "feat: add DecksPage with list and create modal"
```

---

### Task 5: Frontend — Deck detail page

**Files:**
- Create: `frontend/src/pages/DeckDetailPage.tsx`
- Create: `frontend/src/pages/DeckDetailPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/DeckDetailPage.module.css`**

```css
.page {
  padding: 16px;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
}

.actions {
  display: flex;
  gap: 8px;
}

.addBtn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background-color: #3b82f6;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.qrBtn {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background-color: #0ea5e9;
  color: white;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-bottom: 24px;
}

.card {
  position: relative;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.cardImage {
  width: 100%;
  aspect-ratio: 59/86;
  object-fit: cover;
}

.cardName {
  padding: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #1e293b;
  text-align: center;
}

.removeBtn {
  position: absolute;
  top: 4px;
  right: 4px;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 50%;
  background: rgba(239, 68, 68, 0.9);
  color: white;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.empty {
  text-align: center;
  color: #94a3b8;
  padding: 48px 0;
}

.deleteBtn {
  width: 100%;
  padding: 12px;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  background: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
}

.modalOverlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: white;
  border-radius: 12px;
  padding: 24px;
  width: 100%;
  max-width: 360px;
  max-height: 70vh;
  overflow-y: auto;
}

.modalTitle {
  font-size: 18px;
  font-weight: 700;
  margin-bottom: 16px;
}

.pickItem {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  margin-bottom: 8px;
  cursor: pointer;
}

.pickThumb {
  width: 40px;
  height: 58px;
  object-fit: cover;
  border-radius: 4px;
}

.pickName {
  font-size: 14px;
  font-weight: 600;
  color: #1e293b;
}

.modalClose {
  width: 100%;
  padding: 10px;
  margin-top: 8px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: none;
  cursor: pointer;
}
```

- [ ] **Step 2: Create `frontend/src/pages/DeckDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import { QRModal } from '../components/QRModal'
import styles from './DeckDetailPage.module.css'

type CardInDeck = {
  id: number
  card_id: number
  position: number
  card_name: string
  corrected_url: string
  effect_url: string | null
}

type DeckDetail = {
  id: number
  name: string
  cards: CardInDeck[]
}

type PickableCard = {
  id: number
  name: string
  corrected_url: string
}

export function DeckDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [deck, setDeck] = useState<DeckDetail | null>(null)
  const [showPicker, setShowPicker] = useState(false)
  const [pickCards, setPickCards] = useState<PickableCard[]>([])
  const [showQR, setShowQR] = useState(false)

  const load = useCallback(async () => {
    if (!id) return
    const data = await apiJson<DeckDetail>(`/api/decks/${id}`, token)
    setDeck(data)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  const openPicker = async () => {
    // Load all user's cards from all collections
    const collections = await apiJson<{ id: number }[]>('/api/collections', token)
    const allCards: PickableCard[] = []
    for (const col of collections) {
      const cards = await apiJson<PickableCard[]>(
        `/api/cards/by-collection/${col.id}`,
        token,
      )
      allCards.push(...cards)
    }
    // Filter out cards already in deck
    const deckCardIds = new Set(deck?.cards.map((c) => c.card_id) ?? [])
    setPickCards(allCards.filter((c) => !deckCardIds.has(c.id)))
    setShowPicker(true)
  }

  const handleAdd = async (cardId: number) => {
    if (!id) return
    await apiJson(`/api/decks/${id}/cards`, token, {
      method: 'POST',
      body: JSON.stringify({ card_id: cardId }),
      headers: { 'Content-Type': 'application/json' },
    })
    setShowPicker(false)
    load()
  }

  const handleRemove = async (deckCardId: number) => {
    if (!id) return
    await apiFetch(`/api/decks/${id}/cards/${deckCardId}`, token, {
      method: 'DELETE',
    })
    load()
  }

  const handleDeleteDeck = async () => {
    if (!deck || !confirm('Delete this deck?')) return
    await apiFetch(`/api/decks/${deck.id}`, token, { method: 'DELETE' })
    navigate('/decks')
  }

  if (!deck) return null

  const arUrl = `${window.location.origin}/ar/deck/${deck.id}`

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{deck.name}</h2>
        <div className={styles.actions}>
          {deck.cards.length > 0 && (
            <button className={styles.qrBtn} onClick={() => setShowQR(true)}>
              QR
            </button>
          )}
          {deck.cards.length < 5 && (
            <button className={styles.addBtn} onClick={openPicker}>
              + Add
            </button>
          )}
        </div>
      </div>
      {deck.cards.length === 0 ? (
        <p className={styles.empty}>No cards in this deck</p>
      ) : (
        <div className={styles.grid}>
          {deck.cards.map((c) => (
            <div key={c.id} className={styles.card}>
              <button
                className={styles.removeBtn}
                onClick={() => handleRemove(c.id)}
              >
                x
              </button>
              <img
                src={c.corrected_url}
                alt={c.card_name}
                className={styles.cardImage}
              />
              <p className={styles.cardName}>{c.card_name}</p>
            </div>
          ))}
        </div>
      )}
      <button className={styles.deleteBtn} onClick={handleDeleteDeck}>
        Delete Deck
      </button>
      {showPicker && (
        <div className={styles.modalOverlay} onClick={() => setShowPicker(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3 className={styles.modalTitle}>Add Card to Deck</h3>
            {pickCards.length === 0 ? (
              <p>No cards available</p>
            ) : (
              pickCards.map((c) => (
                <div
                  key={c.id}
                  className={styles.pickItem}
                  onClick={() => handleAdd(c.id)}
                >
                  <img
                    src={c.corrected_url}
                    alt={c.name}
                    className={styles.pickThumb}
                  />
                  <span className={styles.pickName}>{c.name}</span>
                </div>
              ))
            )}
            <button
              className={styles.modalClose}
              onClick={() => setShowPicker(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}
      {showQR && <QRModal url={arUrl} onClose={() => setShowQR(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DeckDetailPage.tsx frontend/src/pages/DeckDetailPage.module.css
git commit -m "feat: add DeckDetailPage with card picker and QR"
```

---

### Task 6: Frontend — Deck AR viewer (multi-marker)

**Files:**
- Create: `frontend/src/pages/DeckARViewerPage.tsx`
- Create: `frontend/src/pages/DeckARViewerPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/DeckARViewerPage.module.css`**

```css
.container {
  width: 100vw;
  height: 100dvh;
  position: relative;
}

.loading {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: black;
  color: white;
  font-size: 16px;
  z-index: 10;
}

.deckName {
  position: absolute;
  top: 16px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.6);
  color: white;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 14px;
  font-weight: 600;
  z-index: 5;
  pointer-events: none;
}
```

- [ ] **Step 2: Create `frontend/src/pages/DeckARViewerPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  EighthwallCanvas,
  EighthwallCamera,
  ImageTracker,
} from '@j1ngzoue/8thwall-react-three-fiber'
import { TransparentVideo } from '../components/TransparentVideo'
import styles from './DeckARViewerPage.module.css'

type ARDeckCard = {
  id: number
  name: string
  target_url: string
  effect_url: string | null
}

type ARDeckData = {
  id: number
  name: string
  cards: ARDeckCard[]
}

export function DeckARViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [deck, setDeck] = useState<ARDeckData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/ar/deck/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Deck not found')
        return res.json()
      })
      .then((data) => setDeck(data))
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return <div className={styles.loading}>{error}</div>
  }

  if (!deck) {
    return <div className={styles.loading}>Loading AR...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.deckName}>{deck.name}</div>
      <EighthwallCanvas
        xrSrc="/xr.js"
        autoStart={true}
        disableWorldTracking={true}
        style={{ width: '100%', height: '100%' }}
      >
        <EighthwallCamera />
        {deck.cards.map((card) => (
          <ImageTracker key={card.id} targetImage={card.target_url}>
            {card.effect_url && (
              <TransparentVideo
                src={card.effect_url}
                width={590}
                height={860}
              />
            )}
          </ImageTracker>
        ))}
        <ambientLight intensity={1} />
      </EighthwallCanvas>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/DeckARViewerPage.tsx frontend/src/pages/DeckARViewerPage.module.css
git commit -m "feat: add DeckARViewerPage with multi-marker tracking"
```

---

### Task 7: Wire up all deck routes in App.tsx

**Files:**
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `frontend/src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
import { CollectionsPage } from './pages/CollectionsPage'
import { CollectionDetailPage } from './pages/CollectionDetailPage'
import { CardRegisterPage } from './pages/CardRegisterPage'
import { CardDetailPage } from './pages/CardDetailPage'
import { EffectPage } from './pages/EffectPage'
import { ARViewerPage } from './pages/ARViewerPage'
import { DecksPage } from './pages/DecksPage'
import { DeckDetailPage } from './pages/DeckDetailPage'
import { DeckARViewerPage } from './pages/DeckARViewerPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/ar/card/:id" element={<ARViewerPage />} />
      <Route path="/ar/deck/:id" element={<DeckARViewerPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/collections" replace />} />
        <Route path="/collections" element={<CollectionsPage />} />
        <Route path="/collections/:id" element={<CollectionDetailPage />} />
        <Route
          path="/collections/:id/register"
          element={<CardRegisterPage />}
        />
        <Route path="/cards/:id" element={<CardDetailPage />} />
        <Route path="/cards/:id/effect" element={<EffectPage />} />
        <Route path="/decks" element={<DecksPage />} />
        <Route path="/decks/:id" element={<DeckDetailPage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm tsc --noEmit && pnpm build`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire up deck and deck AR routes in App"
```
