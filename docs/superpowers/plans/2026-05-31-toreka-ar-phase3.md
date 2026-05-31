# トレカAR Phase 3: エフェクト生成 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Generate hologram frame effect as a transparent video (original + mask stacked vertically in a single mp4) using Pillow for frame rendering and ffmpeg for video encoding, with API endpoints and frontend UI for effect selection and generation.

**Architecture:** A new `effect.py` module renders hologram animation frames (rainbow hue-rotating gradient on the card's border region), pipes them to ffmpeg to produce a stacked video (color on top, alpha mask on bottom). Effect routes handle CRUD. The CardDetailPage is updated with an effect generation button and preview.

**Tech Stack:** Pillow, NumPy, ffmpeg (subprocess), existing FastAPI + React

---

## File Structure

### Backend

```
backend/app/
├── effect.py            # CREATE: hologram frame rendering + ffmpeg video generation
├── effect_routes.py     # CREATE: GET /api/effects, POST/DELETE /api/cards/:id/effect
├── main.py              # MODIFY: register effect_routes
```

### Frontend

```
frontend/src/
├── pages/
│   ├── CardDetailPage.tsx         # MODIFY: add effect button + preview
│   ├── CardDetailPage.module.css  # MODIFY: add effect styles
│   ├── EffectPage.tsx             # CREATE: effect selection + generation
│   └── EffectPage.module.css      # CREATE
├── App.tsx                        # MODIFY: add /cards/:id/effect route
```

---

### Task 1: Hologram effect renderer

**Files:**
- Create: `backend/app/effect.py`

- [ ] **Step 1: Create `backend/app/effect.py`**

```python
import subprocess
import tempfile
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw


EFFECT_FPS = 24
EFFECT_DURATION = 3  # seconds
EFFECT_TOTAL_FRAMES = EFFECT_FPS * EFFECT_DURATION
BORDER_RATIO = 0.04  # 4% of card width as border thickness


def _create_border_mask(w: int, h: int) -> np.ndarray:
    """Create a mask where the card's border region is white (255) and interior is black (0)."""
    border = int(w * BORDER_RATIO)
    mask = np.zeros((h, w), dtype=np.uint8)
    # Fill entire mask with white
    mask[:] = 255
    # Cut out the interior (set to black)
    mask[border : h - border, border : w - border] = 0
    return mask


def _render_hologram_frame(
    w: int, h: int, border_mask: np.ndarray, frame_index: int
) -> tuple[np.ndarray, np.ndarray]:
    """Render a single hologram frame.
    Returns (color_rgb array, alpha_mask array) both shape (h, w, 3) and (h, w) respectively.
    """
    # Create rainbow gradient that shifts with frame_index
    hue_offset = (frame_index / EFFECT_TOTAL_FRAMES) * 360
    # Create a diagonal gradient across the card
    y_coords, x_coords = np.mgrid[0:h, 0:w]
    diagonal = (x_coords / w + y_coords / h) / 2  # 0..1 diagonal
    hue = ((diagonal * 360 + hue_offset) % 360).astype(np.float32)
    saturation = np.full((h, w), 0.7, dtype=np.float32)
    value = np.full((h, w), 1.0, dtype=np.float32)

    # Convert HSV to RGB
    hsv = np.stack([hue, saturation, value], axis=-1).astype(np.float32)
    # Manual HSV to RGB conversion
    h_i = (hsv[..., 0] / 60).astype(int) % 6
    f = hsv[..., 0] / 60 - (hsv[..., 0] / 60).astype(int)
    p = hsv[..., 2] * (1 - hsv[..., 1])
    q = hsv[..., 2] * (1 - f * hsv[..., 1])
    t = hsv[..., 2] * (1 - (1 - f) * hsv[..., 1])
    v = hsv[..., 2]

    rgb = np.zeros((h, w, 3), dtype=np.float32)
    for i, (r, g, b) in enumerate(
        [(v, t, p), (q, v, p), (p, v, t), (p, q, v), (t, p, v), (v, p, q)]
    ):
        mask = h_i == i
        rgb[mask, 0] = r[mask]
        rgb[mask, 1] = g[mask]
        rgb[mask, 2] = b[mask]

    color = (rgb * 255).astype(np.uint8)
    # Apply border mask: only show color in border region
    color[border_mask == 0] = 0

    return color, border_mask


def generate_hologram_video(
    card_image_path: Path,
    output_path: Path,
) -> None:
    """Generate a hologram border effect video.
    Output is a stacked video: color on top, alpha mask on bottom.
    """
    card = Image.open(str(card_image_path))
    w, h = card.size
    border_mask = _create_border_mask(w, h)

    # Output dimensions: same width, double height (color + mask stacked)
    out_w, out_h = w, h * 2

    # Use ffmpeg with pipe input
    cmd = [
        "ffmpeg", "-y",
        "-f", "rawvideo",
        "-pix_fmt", "rgb24",
        "-s", f"{out_w}x{out_h}",
        "-r", str(EFFECT_FPS),
        "-i", "pipe:0",
        "-c:v", "libx264",
        "-pix_fmt", "yuv420p",
        "-preset", "fast",
        "-crf", "23",
        str(output_path),
    ]

    output_path.parent.mkdir(parents=True, exist_ok=True)

    proc = subprocess.Popen(cmd, stdin=subprocess.PIPE, stderr=subprocess.PIPE)

    for i in range(EFFECT_TOTAL_FRAMES):
        color, alpha = _render_hologram_frame(w, h, border_mask, i)
        # Convert alpha mask to 3-channel for stacking
        alpha_rgb = np.stack([alpha, alpha, alpha], axis=-1)
        # Stack: color on top, mask on bottom
        frame = np.vstack([color, alpha_rgb])
        proc.stdin.write(frame.tobytes())

    proc.stdin.close()
    proc.wait()

    if proc.returncode != 0:
        stderr = proc.stderr.read().decode()
        raise RuntimeError(f"ffmpeg failed: {stderr}")
```

- [ ] **Step 2: Verify syntax**

Run: `cd backend && python -c "import ast; ast.parse(open('app/effect.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/effect.py
git commit -m "feat: add hologram frame effect renderer with ffmpeg"
```

---

### Task 2: Effect API routes

**Files:**
- Create: `backend/app/effect_routes.py`

- [ ] **Step 1: Create `backend/app/effect_routes.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/effect_routes.py
git commit -m "feat: add effect API routes (list, generate, delete)"
```

---

### Task 3: Register effect router in main.py

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
from app.effect_routes import router as effect_router
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
app.include_router(effect_router)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register effect router in main app"
```

---

### Task 4: Frontend — Effect page

**Files:**
- Create: `frontend/src/pages/EffectPage.tsx`
- Create: `frontend/src/pages/EffectPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/EffectPage.module.css`**

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

.cardPreview {
  max-width: 200px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  display: block;
  margin: 0 auto 24px;
}

.subtitle {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin-bottom: 12px;
}

.effectList {
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-bottom: 24px;
}

.effectCard {
  padding: 16px;
  border-radius: 10px;
  border: 2px solid #e2e8f0;
  background: white;
  cursor: pointer;
  transition: border-color 0.2s;
}

.effectCardSelected {
  border-color: #8b5cf6;
  background-color: #f5f3ff;
}

.effectName {
  font-size: 15px;
  font-weight: 600;
  color: #1e293b;
}

.effectDesc {
  font-size: 13px;
  color: #64748b;
  margin-top: 4px;
}

.generateBtn {
  width: 100%;
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #8b5cf6;
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
}

.generateBtn:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  font-size: 14px;
  margin-bottom: 12px;
}

.success {
  text-align: center;
  color: #22c55e;
  font-weight: 600;
  margin-top: 16px;
}
```

- [ ] **Step 2: Create `frontend/src/pages/EffectPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import { Loading } from '../components/Loading'
import styles from './EffectPage.module.css'

type EffectPreset = {
  id: string
  name: string
  description: string
}

type CardInfo = {
  id: number
  collection_id: number
  name: string
  corrected_url: string
  effect_url: string | null
}

export function EffectPage() {
  const { id } = useParams<{ id: string }>()
  const { token } = useAuth()
  const navigate = useNavigate()

  const [card, setCard] = useState<CardInfo | null>(null)
  const [effects, setEffects] = useState<EffectPreset[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    if (!id) return
    Promise.all([
      apiJson<CardInfo>(`/api/cards/${id}`, token),
      apiJson<EffectPreset[]>('/api/effects', token),
    ]).then(([c, e]) => {
      setCard(c)
      setEffects(e)
      if (e.length > 0) setSelected(e[0].id)
    })
  }, [id, token])

  const handleGenerate = useCallback(async () => {
    if (!selected || !id) return
    setGenerating(true)
    setError('')
    try {
      await apiJson(`/api/cards/${id}/effect`, token, {
        method: 'POST',
        body: JSON.stringify({ effect_id: selected }),
        headers: { 'Content-Type': 'application/json' },
      })
      setDone(true)
      setTimeout(() => navigate(`/cards/${id}`), 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }, [selected, id, token, navigate])

  if (!card) return null

  return (
    <div className={styles.page}>
      <h2 className={styles.title}>Add Effect</h2>
      <img
        src={card.corrected_url}
        alt={card.name}
        className={styles.cardPreview}
      />
      <p className={styles.subtitle}>Select Effect</p>
      <div className={styles.effectList}>
        {effects.map((e) => (
          <div
            key={e.id}
            className={`${styles.effectCard} ${selected === e.id ? styles.effectCardSelected : ''}`}
            onClick={() => setSelected(e.id)}
          >
            <p className={styles.effectName}>{e.name}</p>
            <p className={styles.effectDesc}>{e.description}</p>
          </div>
        ))}
      </div>
      {error && <p className={styles.error}>{error}</p>}
      {generating && <Loading />}
      {done && <p className={styles.success}>Effect generated!</p>}
      {!generating && !done && (
        <button
          className={styles.generateBtn}
          onClick={handleGenerate}
          disabled={!selected}
        >
          Generate Effect
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/EffectPage.tsx frontend/src/pages/EffectPage.module.css
git commit -m "feat: add EffectPage with effect selection and generation"
```

---

### Task 5: Update CardDetailPage + App routes

**Files:**
- Modify: `frontend/src/pages/CardDetailPage.tsx`
- Modify: `frontend/src/pages/CardDetailPage.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Replace `frontend/src/pages/CardDetailPage.module.css`**

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
  text-decoration: none;
  text-align: center;
}

.effectBadge {
  padding: 12px;
  border-radius: 8px;
  background-color: #f5f3ff;
  border: 1px solid #c4b5fd;
  color: #7c3aed;
  font-size: 14px;
  font-weight: 600;
  text-align: center;
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

- [ ] **Step 2: Replace `frontend/src/pages/CardDetailPage.tsx`**

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
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
        {card.effect_url ? (
          <div className={styles.effectBadge}>Effect Applied</div>
        ) : (
          <Link to={`/cards/${card.id}/effect`} className={styles.effectBtn}>
            Add Effect
          </Link>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Delete Card
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Replace `frontend/src/App.tsx`**

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
        <Route path="/cards/:id/effect" element={<EffectPage />} />
        <Route path="/decks" element={<HomePage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && pnpm tsc --noEmit && pnpm build`

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/CardDetailPage.tsx frontend/src/pages/CardDetailPage.module.css frontend/src/App.tsx
git commit -m "feat: update CardDetailPage with effect status and wire up EffectPage route"
```
