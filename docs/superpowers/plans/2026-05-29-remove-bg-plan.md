# Remove Background Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upload an image and separate it into person (foreground) and background using U-2-Net human segmentation model, served via a React + FastAPI web app.

**Architecture:** Monorepo with `backend/` (FastAPI + PyTorch U-2-Net inference) and `frontend/` (Vite + React + TypeScript). The frontend uploads an image to `POST /api/segment`, the backend runs U-2-Net inference and returns two Base64-encoded PNG images (person with transparent background, background with transparent person).

**Tech Stack:** Python 3, FastAPI, PyTorch, Pillow, NumPy, React 18, Vite, TypeScript, CSS Modules

---

## File Structure

```
remove-bg/
├── .gitignore
├── backend/
│   ├── app/
│   │   ├── __init__.py          # Empty package marker
│   │   ├── main.py              # FastAPI app, lifespan, CORS
│   │   ├── model.py             # U-2-Net load + inference + image splitting
│   │   └── routes.py            # POST /api/segment endpoint
│   ├── u2net/
│   │   ├── __init__.py          # Empty package marker
│   │   └── u2net.py             # U-2-Net model architecture (from upstream)
│   ├── models/
│   │   └── u2net_human_seg.pth  # Pre-trained weights (gitignored)
│   ├── requirements.txt
│   └── tests/
│       ├── __init__.py
│       ├── conftest.py          # Shared fixtures (test client, test image)
│       └── test_segment.py      # API endpoint tests
├── frontend/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   ├── tsconfig.app.json
│   ├── vite.config.ts
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── App.module.css
│       └── components/
│           ├── Upload.tsx
│           ├── Upload.module.css
│           ├── ResultView.tsx
│           ├── ResultView.module.css
│           ├── Loading.tsx
│           └── Loading.module.css
└── README.md
```

---

### Task 1: Project scaffolding

**Files:**
- Create: `.gitignore`
- Create: `backend/requirements.txt`
- Create: `backend/app/__init__.py`
- Create: `backend/u2net/__init__.py`
- Create: `backend/tests/__init__.py`

- [ ] **Step 1: Create `.gitignore`**

```gitignore
# Models
backend/models/*.pth

# Python
__pycache__/
*.pyc
.venv/
*.egg-info/

# Node
node_modules/
frontend/dist/

# OS
.DS_Store
```

- [ ] **Step 2: Create `backend/requirements.txt`**

```
torch
torchvision
fastapi
uvicorn[standard]
python-multipart
pillow
numpy
pytest
httpx
```

- [ ] **Step 3: Create empty `__init__.py` files**

Create empty files at:
- `backend/app/__init__.py`
- `backend/u2net/__init__.py`
- `backend/tests/__init__.py`

- [ ] **Step 4: Commit**

```bash
git add .gitignore backend/requirements.txt backend/app/__init__.py backend/u2net/__init__.py backend/tests/__init__.py
git commit -m "chore: add project scaffolding"
```

---

### Task 2: U-2-Net model definition

**Files:**
- Create: `backend/u2net/u2net.py`

Copy the U-2-Net model architecture from the upstream repository with deprecation fixes.

- [ ] **Step 1: Create `backend/u2net/u2net.py`**

Copy the full U-2-Net model code from https://github.com/xuebinqin/U-2-Net/blob/master/model/u2net.py with these fixes:
- Replace `F.upsample(src, size=tar.shape[2:], mode='bilinear')` with `F.interpolate(src, size=tar.shape[2:], mode='bilinear', align_corners=False)` in `_upsample_like`
- Replace all `F.sigmoid(x)` with `torch.sigmoid(x)` in both `U2NET.forward` and `U2NETP.forward` return statements
- Fix the typo in `U2NET.forward`: the last return value `F.sigmoid(d7)` must be `torch.sigmoid(d6)` (d7 does not exist)

The file must contain these classes: `REBNCONV`, `RSU7`, `RSU6`, `RSU5`, `RSU4`, `RSU4F`, `U2NET`, `U2NETP`.

- [ ] **Step 2: Verify the model can be imported**

Run: `cd backend && python -c "from u2net.u2net import U2NET; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/u2net/u2net.py
git commit -m "feat: add U-2-Net model architecture"
```

---

### Task 3: Model loading and inference logic

**Files:**
- Create: `backend/app/model.py`

- [ ] **Step 1: Create `backend/app/model.py`**

```python
import io
import base64
from pathlib import Path

import numpy as np
import torch
from PIL import Image
from torchvision import transforms

from u2net.u2net import U2NET

MODEL_PATH = Path(__file__).resolve().parent.parent / "models" / "u2net_human_seg.pth"

_net: U2NET | None = None
_device: torch.device | None = None


def load_model() -> None:
    global _net, _device
    _device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    _net = U2NET(3, 1)
    _net.load_state_dict(torch.load(str(MODEL_PATH), map_location=_device, weights_only=True))
    _net.to(_device)
    _net.eval()


def _normalize_mask(mask: torch.Tensor) -> torch.Tensor:
    ma = torch.max(mask)
    mi = torch.min(mask)
    return (mask - mi) / (ma - mi + 1e-8)


def _predict_mask(image: Image.Image) -> Image.Image:
    original_size = image.size  # (w, h)
    transform = transforms.Compose([
        transforms.Resize((320, 320)),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=[0.485, 0.456, 0.406],
            std=[0.229, 0.224, 0.225],
        ),
    ])
    input_tensor = transform(image).unsqueeze(0).to(_device)

    with torch.no_grad():
        d0, *_ = _net(input_tensor)

    mask = _normalize_mask(d0.squeeze())
    mask_np = (mask.cpu().numpy() * 255).astype(np.uint8)
    mask_image = Image.fromarray(mask_np, mode="L")
    return mask_image.resize(original_size, Image.BILINEAR)


def _image_to_base64(image: Image.Image) -> str:
    buf = io.BytesIO()
    image.save(buf, format="PNG")
    b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    return f"data:image/png;base64,{b64}"


def segment_image(image: Image.Image) -> dict[str, str]:
    image = image.convert("RGB")
    mask = _predict_mask(image)
    mask_np = np.array(mask)

    # Person: original image with background made transparent
    rgba = image.convert("RGBA")
    person = rgba.copy()
    person_arr = np.array(person)
    person_arr[:, :, 3] = mask_np
    person = Image.fromarray(person_arr, "RGBA")

    # Background: original image with person made transparent
    background = rgba.copy()
    bg_arr = np.array(background)
    bg_arr[:, :, 3] = 255 - mask_np
    background = Image.fromarray(bg_arr, "RGBA")

    return {
        "person": _image_to_base64(person),
        "background": _image_to_base64(background),
    }
```

- [ ] **Step 2: Verify module imports**

Run: `cd backend && python -c "from app.model import load_model, segment_image; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/model.py
git commit -m "feat: add model loading and image segmentation logic"
```

---

### Task 4: FastAPI routes

**Files:**
- Create: `backend/app/routes.py`

- [ ] **Step 1: Create `backend/app/routes.py`**

```python
from fastapi import APIRouter, File, HTTPException, UploadFile
from PIL import Image, UnidentifiedImageError

from app.model import segment_image

router = APIRouter(prefix="/api")


@router.post("/segment")
async def segment(file: UploadFile = File(...)):
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="File must be an image")

    try:
        image = Image.open(file.file)
    except UnidentifiedImageError:
        raise HTTPException(status_code=400, detail="Cannot read image file")

    result = segment_image(image)
    return result
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/routes.py
git commit -m "feat: add /api/segment endpoint"
```

---

### Task 5: FastAPI app setup

**Files:**
- Create: `backend/app/main.py`

- [ ] **Step 1: Create `backend/app/main.py`**

```python
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.model import load_model
from app.routes import router


@asynccontextmanager
async def lifespan(app: FastAPI):
    load_model()
    yield


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
```

- [ ] **Step 2: Verify the app can be imported**

Run: `cd backend && python -c "from app.main import app; print(type(app))"`
Expected: `<class 'fastapi.applications.FastAPI'>`

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat: add FastAPI app with lifespan and CORS"
```

---

### Task 6: Backend API test

**Files:**
- Create: `backend/tests/conftest.py`
- Create: `backend/tests/test_segment.py`

- [ ] **Step 1: Create `backend/tests/conftest.py`**

```python
import io

import pytest
from PIL import Image


@pytest.fixture
def test_image_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()
```

- [ ] **Step 2: Create `backend/tests/test_segment.py`**

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_segment_returns_person_and_background(test_image_bytes: bytes):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/segment",
            files={"file": ("test.png", test_image_bytes, "image/png")},
        )
    assert response.status_code == 200
    data = response.json()
    assert "person" in data
    assert "background" in data
    assert data["person"].startswith("data:image/png;base64,")
    assert data["background"].startswith("data:image/png;base64,")


@pytest.mark.asyncio
async def test_segment_rejects_non_image():
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/segment",
            files={"file": ("test.txt", b"not an image", "text/plain")},
        )
    assert response.status_code == 400
```

- [ ] **Step 3: Install dependencies and run tests**

Run: `cd backend && pip install -r requirements.txt && pip install pytest-asyncio`
Run: `cd backend && python -m pytest tests/ -v`
Expected: 2 tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/tests/
git commit -m "test: add API endpoint tests"
```

---

### Task 7: Frontend scaffolding

**Files:**
- Create: `frontend/` via `npm create vite@latest`
- Modify: `frontend/vite.config.ts`

- [ ] **Step 1: Scaffold React + TypeScript project**

Run:
```bash
cd /Users/j1ngzoue/projects/remove-bg
npm create vite@latest frontend -- --template react-ts
cd frontend && npm install
```

- [ ] **Step 2: Update `frontend/vite.config.ts` with proxy**

Replace the contents of `frontend/vite.config.ts` with:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 3: Clean up Vite default files**

Delete the following default files that won't be needed:
- `frontend/src/App.css`
- `frontend/src/index.css`
- `frontend/src/assets/react.svg`
- `frontend/public/vite.svg`

- [ ] **Step 4: Verify dev server starts**

Run: `cd frontend && npx vite --host 0.0.0.0 &` then kill it.
Expected: Server starts without errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/
git commit -m "chore: scaffold frontend with Vite + React + TypeScript"
```

---

### Task 8: Loading component

**Files:**
- Create: `frontend/src/components/Loading.tsx`
- Create: `frontend/src/components/Loading.module.css`

- [ ] **Step 1: Create `frontend/src/components/Loading.module.css`**

```css
.overlay {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  padding: 48px 0;
}

.spinner {
  width: 48px;
  height: 48px;
  border: 4px solid #e2e8f0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.text {
  color: #64748b;
  font-size: 14px;
}
```

- [ ] **Step 2: Create `frontend/src/components/Loading.tsx`**

```tsx
import styles from './Loading.module.css'

export function Loading() {
  return (
    <div className={styles.overlay}>
      <div className={styles.spinner} />
      <p className={styles.text}>Processing...</p>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Loading.tsx frontend/src/components/Loading.module.css
git commit -m "feat: add Loading spinner component"
```

---

### Task 9: Upload component

**Files:**
- Create: `frontend/src/components/Upload.tsx`
- Create: `frontend/src/components/Upload.module.css`

- [ ] **Step 1: Create `frontend/src/components/Upload.module.css`**

```css
.dropzone {
  border: 2px dashed #cbd5e1;
  border-radius: 12px;
  padding: 48px 24px;
  text-align: center;
  cursor: pointer;
  transition: border-color 0.2s, background-color 0.2s;
  background-color: #f8fafc;
}

.dropzone:hover,
.active {
  border-color: #3b82f6;
  background-color: #eff6ff;
}

.label {
  color: #64748b;
  font-size: 16px;
  margin: 0;
}

.sublabel {
  color: #94a3b8;
  font-size: 13px;
  margin: 8px 0 0;
}

.preview {
  max-width: 100%;
  max-height: 300px;
  border-radius: 8px;
  object-fit: contain;
}

.input {
  display: none;
}
```

- [ ] **Step 2: Create `frontend/src/components/Upload.tsx`**

```tsx
import { useCallback, useRef, useState } from 'react'
import styles from './Upload.module.css'

type Props = {
  onSelect: (file: File) => void
  disabled?: boolean
}

export function Upload({ onSelect, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragActive, setDragActive] = useState(false)
  const [preview, setPreview] = useState<string | null>(null)

  const handleFile = useCallback(
    (file: File) => {
      setPreview(URL.createObjectURL(file))
      onSelect(file)
    },
    [onSelect],
  )

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      setDragActive(false)
      const file = e.dataTransfer.files[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (file) handleFile(file)
    },
    [handleFile],
  )

  return (
    <div
      className={`${styles.dropzone} ${dragActive ? styles.active : ''}`}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault()
        setDragActive(true)
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className={styles.input}
        onChange={handleChange}
        disabled={disabled}
      />
      {preview ? (
        <img src={preview} alt="Preview" className={styles.preview} />
      ) : (
        <>
          <p className={styles.label}>Drop an image here or click to select</p>
          <p className={styles.sublabel}>JPEG, PNG</p>
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/Upload.tsx frontend/src/components/Upload.module.css
git commit -m "feat: add Upload component with drag-and-drop"
```

---

### Task 10: ResultView component

**Files:**
- Create: `frontend/src/components/ResultView.tsx`
- Create: `frontend/src/components/ResultView.module.css`

- [ ] **Step 1: Create `frontend/src/components/ResultView.module.css`**

```css
.container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.title {
  font-size: 14px;
  font-weight: 600;
  color: #334155;
  margin: 0;
}

.imageWrapper {
  width: 100%;
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 8px;
  overflow: hidden;
  /* checkerboard pattern to show transparency */
  background-image: linear-gradient(45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(-45deg, #e2e8f0 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #e2e8f0 75%),
    linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
  background-size: 16px 16px;
  background-position: 0 0, 0 8px, 8px -8px, -8px 0;
}

.image {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

.downloadBtn {
  padding: 8px 20px;
  border: none;
  border-radius: 6px;
  background-color: #3b82f6;
  color: white;
  font-size: 13px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.downloadBtn:hover {
  background-color: #2563eb;
}

@media (max-width: 600px) {
  .container {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 2: Create `frontend/src/components/ResultView.tsx`**

```tsx
import styles from './ResultView.module.css'

type Props = {
  person: string
  background: string
}

function download(dataUrl: string, filename: string) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function ResultView({ person, background }: Props) {
  return (
    <div className={styles.container}>
      <div className={styles.card}>
        <p className={styles.title}>Person</p>
        <div className={styles.imageWrapper}>
          <img src={person} alt="Person" className={styles.image} />
        </div>
        <button
          className={styles.downloadBtn}
          onClick={() => download(person, 'person.png')}
        >
          Download
        </button>
      </div>
      <div className={styles.card}>
        <p className={styles.title}>Background</p>
        <div className={styles.imageWrapper}>
          <img src={background} alt="Background" className={styles.image} />
        </div>
        <button
          className={styles.downloadBtn}
          onClick={() => download(background, 'background.png')}
        >
          Download
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/ResultView.tsx frontend/src/components/ResultView.module.css
git commit -m "feat: add ResultView component with download buttons"
```

---

### Task 11: App component — assemble the UI

**Files:**
- Create: `frontend/src/App.module.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/App.module.css`**

```css
.app {
  max-width: 720px;
  margin: 0 auto;
  padding: 32px 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.heading {
  text-align: center;
  font-size: 24px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 32px;
}

.error {
  color: #ef4444;
  text-align: center;
  font-size: 14px;
  margin: 16px 0 0;
}

.divider {
  border: none;
  border-top: 1px solid #e2e8f0;
  margin: 32px 0;
}
```

- [ ] **Step 2: Replace `frontend/src/App.tsx`**

```tsx
import { useCallback, useState } from 'react'
import styles from './App.module.css'
import { Loading } from './components/Loading'
import { ResultView } from './components/ResultView'
import { Upload } from './components/Upload'

type Result = {
  person: string
  background: string
}

export default function App() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const [error, setError] = useState<string | null>(null)

  const handleSelect = useCallback(async (file: File) => {
    setLoading(true)
    setResult(null)
    setError(null)

    const form = new FormData()
    form.append('file', file)

    try {
      const res = await fetch('/api/segment', { method: 'POST', body: form })
      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(body?.detail ?? `Error: ${res.status}`)
      }
      const data: Result = await res.json()
      setResult(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  return (
    <div className={styles.app}>
      <h1 className={styles.heading}>Remove Background</h1>
      <Upload onSelect={handleSelect} disabled={loading} />
      {error && <p className={styles.error}>{error}</p>}
      {loading && <Loading />}
      {result && (
        <>
          <hr className={styles.divider} />
          <ResultView person={result.person} background={result.background} />
        </>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Replace `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

- [ ] **Step 4: Verify the frontend builds**

Run: `cd frontend && npx tsc --noEmit && npx vite build`
Expected: Build succeeds with no type errors.

- [ ] **Step 5: Commit**

```bash
git add frontend/src/
git commit -m "feat: assemble App with Upload, Loading, and ResultView"
```

---

### Task 12: End-to-end manual verification

- [ ] **Step 1: Start backend**

Run: `cd backend && uvicorn app.main:app --reload --port 8000`
Expected: Server starts and prints `Application startup complete`.

- [ ] **Step 2: Start frontend**

Run: `cd frontend && npm run dev`
Expected: Dev server starts at `http://localhost:5173`.

- [ ] **Step 3: Manual test**

1. Open `http://localhost:5173` in a browser
2. Upload a photo containing a person
3. Verify: loading spinner appears during processing
4. Verify: two images appear — "Person" (transparent background) and "Background" (transparent person)
5. Verify: download buttons work for both images
6. Verify: drag-and-drop upload works
7. Verify: uploading a new image resets and re-processes

- [ ] **Step 4: Create README.md**

Create `README.md` with setup instructions (model download, backend start, frontend start).

- [ ] **Step 5: Final commit**

```bash
git add README.md
git commit -m "docs: add README with setup instructions"
```
