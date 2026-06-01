# トレカAR Phase 4: ARビューア Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add single-card AR viewing: generate image targets from corrected card images, serve them via public API, display QR codes for sharing, and render AR overlay with transparent video effect using @j1ngzoue/8thwall-react-three-fiber.

**Architecture:** Backend generates 8thwall-compatible image target files (JSON + luminance + thumbnail) during card registration using Pillow. A public (no-auth) AR API serves card data. Frontend adds an AR viewer page using EighthwallCanvas + ImageTracker + custom transparent video shader, and QR codes on the card detail page. 8thwall engine files are copied to frontend/public.

**Tech Stack:** Pillow (image target generation), @j1ngzoue/8thwall-react-three-fiber, @react-three/fiber, three, qrcode.react

---

## File Structure

### Backend

```
backend/app/
├── target.py             # CREATE: generate 8thwall image target files from corrected image
├── card_routes.py        # MODIFY: call target generation after card registration
├── ar_routes.py          # CREATE: public AR API (no auth)
├── main.py               # MODIFY: register ar_routes
```

### Frontend

```
frontend/
├── public/
│   ├── xr.js              # COPY from 8thwall lib
│   ├── xr-tracking.js     # COPY from 8thwall lib
│   └── resources/         # COPY from 8thwall lib (workers)
├── src/
│   ├── components/
│   │   ├── TransparentVideo.tsx  # CREATE: custom R3F component for stacked video
│   │   └── QRModal.tsx           # CREATE: QR code display modal
│   │   └── QRModal.module.css
│   ├── pages/
│   │   ├── ARViewerPage.tsx      # CREATE: single card AR viewer
│   │   ├── ARViewerPage.module.css
│   │   ├── CardDetailPage.tsx    # MODIFY: add QR button
│   │   └── CardDetailPage.module.css  # MODIFY
│   └── App.tsx                   # MODIFY: add /ar/card/:id route
```

---

### Task 1: Image target generator (backend)

**Files:**
- Create: `backend/app/target.py`

- [ ] **Step 1: Create `backend/app/target.py`**

```python
import json
import time
from pathlib import Path

from PIL import Image

THUMBNAIL_HEIGHT = 350
LUMINANCE_HEIGHT = 640


def generate_image_target(
    corrected_path: Path,
    target_dir: Path,
    name: str,
) -> str:
    """Generate 8thwall-compatible image target files from a corrected card image.

    Creates:
      - {name}.json (target metadata)
      - {name}_original.png
      - {name}_cropped.png (same as original for full-card targets)
      - {name}_thumbnail.png (resized to height 350)
      - {name}_luminance.png (grayscale, resized to height 640)

    Returns the relative path to the JSON file from uploads/.
    """
    target_dir.mkdir(parents=True, exist_ok=True)

    img = Image.open(str(corrected_path))
    w, h = img.size

    # Original
    original_name = f"{name}_original.png"
    img.save(str(target_dir / original_name), format="PNG")

    # Cropped (full image for planar card targets)
    cropped_name = f"{name}_cropped.png"
    img.save(str(target_dir / cropped_name), format="PNG")

    # Thumbnail
    thumbnail_name = f"{name}_thumbnail.png"
    thumb_w = int(w * THUMBNAIL_HEIGHT / h)
    thumb = img.resize((thumb_w, THUMBNAIL_HEIGHT), Image.Resampling.LANCZOS)
    thumb.save(str(target_dir / thumbnail_name), format="PNG")

    # Luminance (grayscale)
    luminance_name = f"{name}_luminance.png"
    lum_w = int(w * LUMINANCE_HEIGHT / h)
    lum = img.convert("L").resize((lum_w, LUMINANCE_HEIGHT), Image.Resampling.LANCZOS)
    lum.save(str(target_dir / luminance_name), format="PNG")

    # JSON metadata
    geometry = {
        "top": 0,
        "left": 0,
        "width": w,
        "height": h,
        "isRotated": False,
        "originalWidth": w,
        "originalHeight": h,
    }

    target_data = {
        "imagePath": f"image-targets/{luminance_name}",
        "metadata": None,
        "name": name,
        "type": "PLANAR",
        "properties": geometry,
        "resources": {
            "originalImage": original_name,
            "croppedImage": cropped_name,
            "thumbnailImage": thumbnail_name,
            "luminanceImage": luminance_name,
        },
        "created": int(time.time() * 1000),
        "updated": int(time.time() * 1000),
    }

    json_name = f"{name}.json"
    json_path = target_dir / json_name
    json_path.write_text(json.dumps(target_data, indent=2) + "\n")

    return json_name
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "import ast; ast.parse(open('app/target.py').read()); print('OK')"`

- [ ] **Step 3: Commit**

```bash
git add backend/app/target.py
git commit -m "feat: add 8thwall image target generator"
```

---

### Task 2: Integrate target generation into card registration

**Files:**
- Modify: `backend/app/card_routes.py`

- [ ] **Step 1: Update `backend/app/card_routes.py`**

Add import at the top (after existing imports):
```python
from app.target import generate_image_target
```

In the `register_card` function, after `save_card_images` updates `card.corrected_path`, add target generation:

Find this block:
```python
    card.original_path = original_path
    card.corrected_path = corrected_path
    db.commit()
    db.refresh(card)

    return _card_to_out(card)
```

Replace with:
```python
    card.original_path = original_path
    card.corrected_path = corrected_path
    db.commit()
    db.refresh(card)

    # Generate 8thwall image target
    target_dir = UPLOADS_DIR / "cards" / str(card.id) / "target"
    corrected_abs = UPLOADS_DIR / corrected_path
    generate_image_target(corrected_abs, target_dir, f"card_{card.id}")

    return _card_to_out(card)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/card_routes.py
git commit -m "feat: generate image target on card registration"
```

---

### Task 3: Public AR API routes

**Files:**
- Create: `backend/app/ar_routes.py`

- [ ] **Step 1: Create `backend/app/ar_routes.py`**

```python
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
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/ar_routes.py
git commit -m "feat: add public AR API route (no auth)"
```

---

### Task 4: Register AR router in main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add to `backend/app/main.py`**

Add import:
```python
from app.ar_routes import router as ar_router
```

Add after `app.include_router(effect_router)`:
```python
app.include_router(ar_router)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: register AR router in main app"
```

---

### Task 5: Copy 8thwall engine files to frontend

**Files:**
- Copy: 8thwall engine files to `frontend/public/`

- [ ] **Step 1: Install 8thwall library**

```bash
cd /Users/j1ngzoue/projects/remove-bg/frontend && pnpm add @j1ngzoue/8thwall-react-three-fiber @react-three/fiber three qrcode.react
cd /Users/j1ngzoue/projects/remove-bg/frontend && pnpm add -D @types/three
```

- [ ] **Step 2: Copy engine files**

```bash
cp -r /Users/j1ngzoue/projects/remove-bg/frontend/node_modules/@j1ngzoue/8thwall-react-three-fiber/8thwall/xr.js /Users/j1ngzoue/projects/remove-bg/frontend/public/
cp -r /Users/j1ngzoue/projects/remove-bg/frontend/node_modules/@j1ngzoue/8thwall-react-three-fiber/8thwall/xr-tracking.js /Users/j1ngzoue/projects/remove-bg/frontend/public/
cp -r /Users/j1ngzoue/projects/remove-bg/frontend/node_modules/@j1ngzoue/8thwall-react-three-fiber/8thwall/resources /Users/j1ngzoue/projects/remove-bg/frontend/public/
```

- [ ] **Step 3: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/public/
git commit -m "feat: install 8thwall lib and copy engine files to public"
```

---

### Task 6: Transparent video component

**Files:**
- Create: `frontend/src/components/TransparentVideo.tsx`

- [ ] **Step 1: Create `frontend/src/components/TransparentVideo.tsx`**

This component renders a stacked video (color on top, alpha mask on bottom) as a transparent texture on a plane mesh.

```tsx
import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const vertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const fragmentShader = `
uniform sampler2D videoTexture;
varying vec2 vUv;
void main() {
  // Top half is color, bottom half is alpha mask
  vec2 colorUv = vec2(vUv.x, vUv.y * 0.5 + 0.5);
  vec2 alphaUv = vec2(vUv.x, vUv.y * 0.5);
  vec4 color = texture2D(videoTexture, colorUv);
  float alpha = texture2D(videoTexture, alphaUv).r;
  gl_FragColor = vec4(color.rgb, alpha);
}
`

type Props = {
  src: string
  width: number
  height: number
}

export function TransparentVideo({ src, width, height }: Props) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const textureRef = useRef<THREE.VideoTexture | null>(null)

  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms: {
          videoTexture: { value: null },
        },
        transparent: true,
        side: THREE.DoubleSide,
      }),
    [],
  )

  useEffect(() => {
    const video = document.createElement('video')
    video.src = src
    video.crossOrigin = 'anonymous'
    video.loop = true
    video.muted = true
    video.playsInline = true
    video.autoplay = true
    video.play().catch(() => {})
    videoRef.current = video

    const texture = new THREE.VideoTexture(video)
    texture.minFilter = THREE.LinearFilter
    texture.magFilter = THREE.LinearFilter
    textureRef.current = texture
    material.uniforms.videoTexture.value = texture

    return () => {
      video.pause()
      video.src = ''
      texture.dispose()
    }
  }, [src, material])

  useFrame(() => {
    if (textureRef.current) {
      textureRef.current.needsUpdate = true
    }
  })

  // Scale to match card aspect ratio, normalized to unit scale from ImageTracker
  const aspect = width / height
  const planeHeight = 1
  const planeWidth = planeHeight * aspect

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <planeGeometry args={[planeWidth, planeHeight]} />
      <primitive object={material} attach="material" />
    </mesh>
  )
}
```

- [ ] **Step 2: Verify**

Run: `cd frontend && pnpm tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/TransparentVideo.tsx
git commit -m "feat: add TransparentVideo component with alpha mask shader"
```

---

### Task 7: QR modal component

**Files:**
- Create: `frontend/src/components/QRModal.tsx`
- Create: `frontend/src/components/QRModal.module.css`

- [ ] **Step 1: Create `frontend/src/components/QRModal.module.css`**

```css
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 100;
  padding: 16px;
}

.modal {
  background: white;
  border-radius: 16px;
  padding: 32px;
  text-align: center;
  max-width: 320px;
  width: 100%;
}

.title {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin-bottom: 16px;
}

.qrWrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.hint {
  font-size: 13px;
  color: #64748b;
  margin-bottom: 16px;
}

.closeBtn {
  padding: 8px 24px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  background: none;
  cursor: pointer;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `frontend/src/components/QRModal.tsx`**

```tsx
import { QRCodeSVG } from 'qrcode.react'
import styles from './QRModal.module.css'

type Props = {
  url: string
  onClose: () => void
}

export function QRModal({ url, onClose }: Props) {
  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.title}>Scan to view AR</h3>
        <div className={styles.qrWrapper}>
          <QRCodeSVG value={url} size={200} />
        </div>
        <p className={styles.hint}>Scan this QR code with your phone camera</p>
        <button className={styles.closeBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/QRModal.tsx frontend/src/components/QRModal.module.css
git commit -m "feat: add QRModal component"
```

---

### Task 8: AR viewer page

**Files:**
- Create: `frontend/src/pages/ARViewerPage.tsx`
- Create: `frontend/src/pages/ARViewerPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/ARViewerPage.module.css`**

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

.cardName {
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

- [ ] **Step 2: Create `frontend/src/pages/ARViewerPage.tsx`**

```tsx
import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  EighthwallCanvas,
  EighthwallCamera,
  ImageTracker,
} from '@j1ngzoue/8thwall-react-three-fiber'
import { TransparentVideo } from '../components/TransparentVideo'
import styles from './ARViewerPage.module.css'

type ARCardData = {
  id: number
  name: string
  marker_url: string
  target_url: string
  effect_url: string | null
}

export function ARViewerPage() {
  const { id } = useParams<{ id: string }>()
  const [card, setCard] = useState<ARCardData | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!id) return
    fetch(`/api/ar/card/${id}`)
      .then((res) => {
        if (!res.ok) throw new Error('Card not found')
        return res.json()
      })
      .then((data) => setCard(data))
      .catch((e) => setError(e.message))
  }, [id])

  if (error) {
    return <div className={styles.loading}>{error}</div>
  }

  if (!card) {
    return <div className={styles.loading}>Loading AR...</div>
  }

  return (
    <div className={styles.container}>
      <div className={styles.cardName}>{card.name}</div>
      <EighthwallCanvas
        xrSrc="/xr.js"
        autoStart={true}
        disableWorldTracking={true}
        style={{ width: '100%', height: '100%' }}
      >
        <EighthwallCamera />
        <ImageTracker targetImage={card.target_url}>
          {card.effect_url && (
            <TransparentVideo
              src={card.effect_url}
              width={590}
              height={860}
            />
          )}
        </ImageTracker>
        <ambientLight intensity={1} />
      </EighthwallCanvas>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/pages/ARViewerPage.tsx frontend/src/pages/ARViewerPage.module.css
git commit -m "feat: add ARViewerPage with image tracking and transparent video"
```

---

### Task 9: Update CardDetailPage with QR button + wire routes

**Files:**
- Modify: `frontend/src/pages/CardDetailPage.tsx`
- Modify: `frontend/src/pages/CardDetailPage.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Add QR button style to `frontend/src/pages/CardDetailPage.module.css`**

Add at the end of the file:
```css
.qrBtn {
  padding: 12px;
  border: none;
  border-radius: 8px;
  background-color: #0ea5e9;
  color: white;
  font-size: 15px;
  font-weight: 600;
  cursor: pointer;
}
```

- [ ] **Step 2: Update `frontend/src/pages/CardDetailPage.tsx`**

Replace the entire file:

```tsx
import { useCallback, useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { apiJson, apiFetch } from '../lib/api'
import { QRModal } from '../components/QRModal'
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
  const [showQR, setShowQR] = useState(false)

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

  const arUrl = `${window.location.origin}/ar/card/${card.id}`

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
          <>
            <div className={styles.effectBadge}>Effect Applied</div>
            <button
              className={styles.qrBtn}
              onClick={() => setShowQR(true)}
            >
              Show QR for AR
            </button>
          </>
        ) : (
          <Link to={`/cards/${card.id}/effect`} className={styles.effectBtn}>
            Add Effect
          </Link>
        )}
        <button className={styles.deleteBtn} onClick={handleDelete}>
          Delete Card
        </button>
      </div>
      {showQR && <QRModal url={arUrl} onClose={() => setShowQR(false)} />}
    </div>
  )
}
```

- [ ] **Step 3: Update `frontend/src/App.tsx`**

Replace the entire file:

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
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/ar/card/:id" element={<ARViewerPage />} />
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
git commit -m "feat: add QR button to CardDetailPage and wire AR viewer route"
```
