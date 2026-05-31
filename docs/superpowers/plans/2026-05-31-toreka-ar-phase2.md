# トレカAR Phase 2: コレクション & カード管理 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add collection and card CRUD with image processing (background removal + perspective correction + OCR card name detection), integrating the existing segment/correct pipeline into the card registration flow.

**Architecture:** Add Collection and Card ORM models, collection CRUD routes, a card registration endpoint that chains rembg → perspective correction → OCR → file save, and React pages for collection list, collection detail (card grid), card registration, and card detail.

**Tech Stack:** SQLAlchemy (existing), pytesseract, Pillow, existing rembg/OpenCV pipeline, React + react-router (existing)

---

## File Structure

### Backend — new/modified files

```
backend/
├── app/
│   ├── db_models.py          # MODIFY: add Collection, Card models
│   ├── model.py              # MODIFY: add process_card(), ocr_card_name()
│   ├── collection_routes.py  # CREATE: CRUD /api/collections
│   ├── card_routes.py        # CREATE: CRUD /api/cards
│   ├── main.py               # MODIFY: include new routers
│   └── routes.py             # (unchanged)
├── requirements.txt          # MODIFY: add pytesseract
└── tests/
    ├── test_collections.py   # CREATE
    └── test_cards.py         # CREATE
```

### Frontend — new files

```
frontend/src/
├── lib/
│   └── api.ts                     # CREATE: auth-aware fetch helper
├── pages/
│   ├── CollectionsPage.tsx        # CREATE: collection list + create
│   ├── CollectionsPage.module.css
│   ├── CollectionDetailPage.tsx   # CREATE: card grid
│   ├── CollectionDetailPage.module.css
│   ├── CardRegisterPage.tsx       # CREATE: upload → preview → save
│   ├── CardRegisterPage.module.css
│   ├── CardDetailPage.tsx         # CREATE: card detail view
│   └── CardDetailPage.module.css
├── App.tsx                        # MODIFY: add routes
```

---

### Task 1: Add Collection and Card DB models

**Files:**
- Modify: `backend/app/db_models.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add `pytesseract` to `backend/requirements.txt`**

Add this line at the end:
```
pytesseract
```

- [ ] **Step 2: Replace `backend/app/db_models.py`**

```python
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
```

- [ ] **Step 3: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/db_models.py').read()); print('OK')"`

- [ ] **Step 4: Commit**

```bash
git add backend/app/db_models.py backend/requirements.txt
git commit -m "feat: add Collection and Card models"
```

---

### Task 2: Add process_card and OCR to model.py

**Files:**
- Modify: `backend/app/model.py`

- [ ] **Step 1: Add `process_card` and `ocr_card_name` functions to `backend/app/model.py`**

Add these imports at the top (after existing imports):
```python
from pathlib import Path

import pytesseract
```

Add these functions at the end of the file (after `segment_image`):

```python
def process_card(image: Image.Image) -> tuple[Image.Image, Image.Image | None]:
    """Process a card image: background removal + perspective correction.
    Returns (original_rgb, corrected_or_none).
    """
    image = ImageOps.exif_transpose(image.convert("RGB"))
    person = remove(image, session=_session)
    person_arr = np.array(person)
    corrected = _correct_perspective(image, person_arr[:, :, 3])
    return image, corrected


def ocr_card_name(image: Image.Image) -> str:
    """Extract card name from the top 20% of a corrected card image."""
    w, h = image.size
    top_crop = image.crop((0, 0, w, int(h * 0.2)))
    try:
        text = pytesseract.image_to_string(top_crop, lang="jpn+eng").strip()
        # Take first non-empty line as card name
        for line in text.splitlines():
            line = line.strip()
            if line:
                return line
    except Exception:
        pass
    return ""


def save_card_images(
    card_id: int,
    original: Image.Image,
    corrected: Image.Image,
    uploads_dir: Path,
) -> tuple[str, str]:
    """Save original and corrected images, return relative paths."""
    card_dir = uploads_dir / "cards" / str(card_id)
    card_dir.mkdir(parents=True, exist_ok=True)

    original_path = card_dir / "original.png"
    corrected_path = card_dir / "corrected.png"

    original.save(str(original_path), format="PNG")
    corrected.save(str(corrected_path), format="PNG")

    return (
        f"cards/{card_id}/original.png",
        f"cards/{card_id}/corrected.png",
    )
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/model.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/model.py
git commit -m "feat: add process_card, ocr_card_name, and save_card_images"
```

---

### Task 3: Collection CRUD routes

**Files:**
- Create: `backend/app/collection_routes.py`

- [ ] **Step 1: Create `backend/app/collection_routes.py`**

```python
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Collection, User
from app.deps import get_current_user, get_db

router = APIRouter(prefix="/api/collections", tags=["collections"])


class CollectionCreate(BaseModel):
    name: str


class CollectionOut(BaseModel):
    id: int
    name: str
    card_count: int
    created_at: str

    model_config = {"from_attributes": True}


@router.get("", response_model=list[CollectionOut])
def list_collections(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    cols = (
        db.query(Collection)
        .filter(Collection.user_id == user.id)
        .order_by(Collection.created_at.desc())
        .all()
    )
    return [
        CollectionOut(
            id=c.id,
            name=c.name,
            card_count=len(c.cards),
            created_at=c.created_at.isoformat(),
        )
        for c in cols
    ]


@router.post("", response_model=CollectionOut, status_code=201)
def create_collection(
    req: CollectionCreate,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    col = Collection(name=req.name, user_id=user.id)
    db.add(col)
    db.commit()
    db.refresh(col)
    return CollectionOut(
        id=col.id,
        name=col.name,
        card_count=0,
        created_at=col.created_at.isoformat(),
    )


@router.get("/{collection_id}", response_model=CollectionOut)
def get_collection(
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
    return CollectionOut(
        id=col.id,
        name=col.name,
        card_count=len(col.cards),
        created_at=col.created_at.isoformat(),
    )


@router.delete("/{collection_id}", status_code=204)
def delete_collection(
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
    db.delete(col)
    db.commit()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/collection_routes.py
git commit -m "feat: add collection CRUD routes"
```

---

### Task 4: Card routes

**Files:**
- Create: `backend/app/card_routes.py`

- [ ] **Step 1: Create `backend/app/card_routes.py`**

```python
from pathlib import Path

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.db_models import Card, Collection, User
from app.deps import get_current_user, get_db
from app.model import ocr_card_name, process_card, save_card_images

router = APIRouter(prefix="/api/cards", tags=["cards"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


class CardOut(BaseModel):
    id: int
    collection_id: int
    name: str
    original_url: str
    corrected_url: str
    effect_url: str | None
    created_at: str

    model_config = {"from_attributes": True}


def _card_to_out(card: Card) -> CardOut:
    return CardOut(
        id=card.id,
        collection_id=card.collection_id,
        name=card.name,
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

    # OCR card name from corrected image
    suggested_name = ocr_card_name(corrected)

    # Create card record first to get ID
    card = Card(
        collection_id=collection_id,
        name=suggested_name or "Untitled",
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

    return _card_to_out(card)


@router.patch("/{card_id}", response_model=CardOut)
def update_card(
    card_id: int,
    name: str,
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
    card.name = name
    db.commit()
    db.refresh(card)
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/card_routes.py
git commit -m "feat: add card registration and CRUD routes"
```

---

### Task 5: Register new routers in main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Replace `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth_routes import router as auth_router
from app.card_routes import router as card_router
from app.collection_routes import router as collection_router
from app.database import init_db
from app.model import load_model
from app.routes import router as api_router

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    UPLOADS_DIR.mkdir(exist_ok=True)
    load_model()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(api_router)
app.include_router(collection_router)
app.include_router(card_router)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/main.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register collection and card routers in main app"
```

---

### Task 6: Frontend — API helper

**Files:**
- Create: `frontend/src/lib/api.ts`

- [ ] **Step 1: Create `frontend/src/lib/api.ts`**

```typescript
export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message)
  }
}

export async function apiFetch(
  url: string,
  token: string | null,
  options: RequestInit = {},
): Promise<Response> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string>),
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }
  const res = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  })
  if (!res.ok) {
    const body = await res.json().catch(() => null)
    throw new ApiError(res.status, body?.detail ?? `Error: ${res.status}`)
  }
  return res
}

export async function apiJson<T>(
  url: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  if (
    options.body &&
    typeof options.body === 'string' &&
    !options.headers
  ) {
    options.headers = { 'Content-Type': 'application/json' }
  }
  const res = await apiFetch(url, token, options)
  return res.json()
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/lib/api.ts
git commit -m "feat: add auth-aware API fetch helper"
```

---

### Task 7: Frontend — Collections page

**Files:**
- Create: `frontend/src/pages/CollectionsPage.tsx`
- Create: `frontend/src/pages/CollectionsPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/CollectionsPage.module.css`**

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

- [ ] **Step 2: Create `frontend/src/pages/CollectionsPage.tsx`**

```tsx
import { FormEvent, useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './CollectionsPage.module.css'

type Collection = {
  id: number
  name: string
  card_count: number
  created_at: string
}

export function CollectionsPage() {
  const { token } = useAuth()
  const [collections, setCollections] = useState<Collection[]>([])
  const [showModal, setShowModal] = useState(false)
  const [newName, setNewName] = useState('')

  const load = useCallback(async () => {
    const data = await apiJson<Collection[]>('/api/collections', token)
    setCollections(data)
  }, [token])

  useEffect(() => {
    load()
  }, [load])

  const handleCreate = async (e: FormEvent) => {
    e.preventDefault()
    if (!newName.trim()) return
    await apiJson<Collection>('/api/collections', token, {
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
        <h2 className={styles.title}>Collections</h2>
        <button className={styles.addBtn} onClick={() => setShowModal(true)}>
          + New
        </button>
      </div>
      {collections.length === 0 ? (
        <p className={styles.empty}>No collections yet</p>
      ) : (
        <div className={styles.list}>
          {collections.map((c) => (
            <Link
              key={c.id}
              to={`/collections/${c.id}`}
              className={styles.card}
            >
              <span className={styles.cardName}>{c.name}</span>
              <span className={styles.cardCount}>{c.card_count} cards</span>
            </Link>
          ))}
        </div>
      )}
      {showModal && (
        <div
          className={styles.modalOverlay}
          onClick={() => setShowModal(false)}
        >
          <form
            className={styles.modal}
            onClick={(e) => e.stopPropagation()}
            onSubmit={handleCreate}
          >
            <h3 className={styles.modalTitle}>New Collection</h3>
            <input
              className={styles.modalInput}
              placeholder="Collection name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              autoFocus
            />
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.modalCancel}
                onClick={() => setShowModal(false)}
              >
                Cancel
              </button>
              <button type="submit" className={styles.modalSubmit}>
                Create
              </button>
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
git add frontend/src/pages/CollectionsPage.tsx frontend/src/pages/CollectionsPage.module.css
git commit -m "feat: add CollectionsPage with list and create modal"
```

---

### Task 8: Frontend — Collection detail page (card grid)

**Files:**
- Create: `frontend/src/pages/CollectionDetailPage.tsx`
- Create: `frontend/src/pages/CollectionDetailPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/CollectionDetailPage.module.css`**

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
  text-decoration: none;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}

.card {
  display: flex;
  flex-direction: column;
  background: white;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  text-decoration: none;
  color: inherit;
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
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.empty {
  text-align: center;
  color: #94a3b8;
  padding: 48px 0;
}
```

- [ ] **Step 2: Create `frontend/src/pages/CollectionDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson } from '../lib/api'
import styles from './CollectionDetailPage.module.css'

type CardItem = {
  id: number
  name: string
  corrected_url: string
}

type CollectionInfo = {
  id: number
  name: string
}

export function CollectionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const [collection, setCollection] = useState<CollectionInfo | null>(null)
  const [cards, setCards] = useState<CardItem[]>([])

  const load = useCallback(async () => {
    if (!id) return
    const [col, cardList] = await Promise.all([
      apiJson<CollectionInfo>(`/api/collections/${id}`, token),
      apiJson<CardItem[]>(`/api/cards/by-collection/${id}`, token),
    ])
    setCollection(col)
    setCards(cardList)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  if (!collection) return null

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <h2 className={styles.title}>{collection.name}</h2>
        <Link
          to={`/collections/${id}/register`}
          className={styles.addBtn}
        >
          + Add Card
        </Link>
      </div>
      {cards.length === 0 ? (
        <p className={styles.empty}>No cards yet</p>
      ) : (
        <div className={styles.grid}>
          {cards.map((card) => (
            <Link
              key={card.id}
              to={`/cards/${card.id}`}
              className={styles.card}
            >
              <img
                src={card.corrected_url}
                alt={card.name}
                className={styles.cardImage}
              />
              <span className={styles.cardName}>{card.name}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CollectionDetailPage.tsx frontend/src/pages/CollectionDetailPage.module.css
git commit -m "feat: add CollectionDetailPage with card grid"
```

---

### Task 9: Frontend — Card register page

**Files:**
- Create: `frontend/src/pages/CardRegisterPage.tsx`
- Create: `frontend/src/pages/CardRegisterPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/CardRegisterPage.module.css`**

```css
.page {
  padding: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.uploadArea {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 32px;
  text-align: center;
  cursor: pointer;
  background-color: #f8fafc;
  margin-bottom: 16px;
}

.uploadLabel {
  color: #64748b;
  font-size: 14px;
}

.preview {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  object-fit: contain;
}

.hidden {
  display: none;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.label {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
}

.input {
  width: 100%;
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
}

.correctedPreview {
  max-width: 200px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.button {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #3b82f6;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `frontend/src/pages/CardRegisterPage.tsx`**

```tsx
import { FormEvent, useCallback, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { ApiError } from '../lib/api'
import { Loading } from '../components/Loading'
import styles from './CardRegisterPage.module.css'

type RegisterResult = {
  id: number
  name: string
  corrected_url: string
}

export function CardRegisterPage() {
  const { id: collectionId } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const inputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [result, setResult] = useState<RegisterResult | null>(null)
  const [name, setName] = useState('')
  const [processing, setProcessing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleFile = useCallback((f: File) => {
    setFile(f)
    setPreview(URL.createObjectURL(f))
    setResult(null)
    setError('')
  }, [])

  const handleUpload = useCallback(async () => {
    if (!file || !token) return
    setProcessing(true)
    setError('')
    try {
      const form = new FormData()
      form.append('file', file)
      const res = await fetch(`/api/cards/register/${collectionId}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new ApiError(res.status, body?.detail ?? `Error: ${res.status}`)
      }
      const data: RegisterResult = await res.json()
      setResult(data)
      setName(data.name)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Processing failed')
    } finally {
      setProcessing(false)
    }
  }, [file, token, collectionId])

  const handleSave = async (e: FormEvent) => {
    e.preventDefault()
    if (!result || !token) return
    setSaving(true)
    try {
      await fetch(`/api/cards/${result.id}?name=${encodeURIComponent(name)}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      })
      navigate(`/collections/${collectionId}`)
    } catch {
      setError('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Add Card</h2>

      {!result && (
        <>
          <div
            className={styles.uploadArea}
            onClick={() => inputRef.current?.click()}
          >
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className={styles.hidden}
              onChange={(e) => {
                const f = e.target.files?.[0]
                if (f) handleFile(f)
              }}
            />
            {preview ? (
              <img src={preview} alt="Preview" className={styles.preview} />
            ) : (
              <p className={styles.uploadLabel}>
                Tap to take a photo or select an image
              </p>
            )}
          </div>
          {processing && <Loading />}
          {error && <p className={styles.error}>{error}</p>}
          {file && !processing && (
            <button className={styles.button} onClick={handleUpload}>
              Process Card
            </button>
          )}
        </>
      )}

      {result && (
        <form className={styles.form} onSubmit={handleSave}>
          <img
            src={result.corrected_url}
            alt="Corrected"
            className={styles.correctedPreview}
          />
          <div>
            <p className={styles.label}>Card Name</p>
            <input
              className={styles.input}
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {error && <p className={styles.error}>{error}</p>}
          <button
            className={styles.button}
            type="submit"
            disabled={saving}
          >
            {saving ? 'Saving...' : 'Save Card'}
          </button>
        </form>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CardRegisterPage.tsx frontend/src/pages/CardRegisterPage.module.css
git commit -m "feat: add CardRegisterPage with upload, process, and save flow"
```

---

### Task 10: Frontend — Card detail page

**Files:**
- Create: `frontend/src/pages/CardDetailPage.tsx`
- Create: `frontend/src/pages/CardDetailPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/CardDetailPage.module.css`**

```css
.page {
  padding: 16px;
  max-width: 480px;
  margin: 0 auto;
}

.title {
  font-size: 20px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
  text-align: center;
}

.imageWrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 24px;
}

.image {
  max-width: 280px;
  width: 100%;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
}

.actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.effectBtn {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #8b5cf6;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}

.deleteBtn {
  padding: 12px;
  border: 1px solid #fca5a5;
  border-radius: 8px;
  background: none;
  color: #ef4444;
  font-size: 14px;
  cursor: pointer;
}
```

- [ ] **Step 2: Create `frontend/src/pages/CardDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import styles from './CardDetailPage.module.css'

type CardDetail = {
  id: number
  collection_id: number
  name: string
  corrected_url: string
  effect_url: string | null
}

export function CardDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()
  const [card, setCard] = useState<CardDetail | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    const data = await apiJson<CardDetail>(`/api/cards/${id}`, token)
    setCard(data)
  }, [id, token])

  useEffect(() => {
    load()
  }, [load])

  const handleDelete = async () => {
    if (!card || !confirm('Delete this card?')) return
    await apiFetch(`/api/cards/${card.id}`, token, { method: 'DELETE' })
    navigate(`/collections/${card.collection_id}`)
  }

  if (!card) return null

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>{card.name}</h2>
      <div className={styles.imageWrapper}>
        <img
          src={card.corrected_url}
          alt={card.name}
          className={styles.image}
        />
      </div>
      <div className={styles.actions}>
        <button className={styles.effectBtn} disabled>
          Add Effect (Phase 3)
        </button>
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Delete Card
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/CardDetailPage.tsx frontend/src/pages/CardDetailPage.module.css
git commit -m "feat: add CardDetailPage with delete"
```

---

### Task 11: Wire up routes in App.tsx

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
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
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
        <Route path="/decks" element={<HomePage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 2: Verify build**

Run: `cd frontend && pnpm tsc --noEmit && pnpm build`
Expected: Build succeeds

- [ ] **Step 3: Commit**

```bash
git add frontend/src/App.tsx
git commit -m "feat: wire up collection and card routes in App"
```
