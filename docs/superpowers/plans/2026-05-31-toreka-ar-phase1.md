# トレカAR Phase 1: 基盤 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the existing remove-bg app with SQLite database, JWT authentication, SPA routing, file serving, and mobile-first layout to serve as the foundation for トレカAR.

**Architecture:** Add SQLAlchemy + SQLite for persistence, JWT auth with httpOnly refresh cookies, react-router for SPA navigation, and a base layout with tab bar for mobile. The existing image processing code (`model.py`, `routes.py`) is preserved and will be integrated into the card registration flow in Phase 2.

**Tech Stack:** SQLAlchemy, bcrypt, PyJWT, react-router-dom

---

## File Structure

### Backend — new files

```
backend/
├── app/
│   ├── database.py       # SQLAlchemy engine, session, Base, init_db
│   ├── db_models.py      # ORM models (User for Phase 1)
│   ├── auth.py           # Password hashing, JWT create/decode
│   ├── deps.py           # FastAPI dependencies (get_db, get_current_user)
│   ├── auth_routes.py    # /api/auth/* endpoints
│   ├── main.py           # MODIFY: add DB init, auth routes, static files, CORS
│   └── routes.py         # MODIFY: (no changes in Phase 1, kept as-is)
├── uploads/              # File storage root (gitignored)
└── tests/
    └── test_auth.py      # Auth endpoint tests
```

### Frontend — new/modified files

```
frontend/src/
├── main.tsx              # MODIFY: add BrowserRouter + AuthProvider
├── App.tsx               # MODIFY: becomes router outlet
├── contexts/
│   └── AuthContext.tsx    # Auth state + token management
├── components/
│   ├── Layout.tsx         # Header + TabBar + Outlet
│   ├── Layout.module.css
│   ├── ProtectedRoute.tsx # Redirect to /login if not authenticated
│   └── (existing components preserved)
├── pages/
│   ├── LoginPage.tsx      # Login form
│   ├── LoginPage.module.css
│   ├── RegisterPage.tsx   # Register form
│   ├── RegisterPage.module.css
│   ├── HomePage.tsx       # Placeholder (collections + decks tabs)
│   └── HomePage.module.css
```

---

### Task 1: Backend DB setup

**Files:**
- Create: `backend/app/database.py`
- Create: `backend/app/db_models.py`
- Modify: `backend/requirements.txt`

- [ ] **Step 1: Add dependencies to `backend/requirements.txt`**

Add these lines after the existing dependencies:

```
sqlalchemy
pyjwt
bcrypt
pydantic[email]
```

- [ ] **Step 2: Create `backend/app/database.py`**

```python
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

DB_PATH = Path(__file__).resolve().parent.parent / "toreka.db"

engine = create_engine(
    f"sqlite:///{DB_PATH}",
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(bind=engine)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
```

- [ ] **Step 3: Create `backend/app/db_models.py`**

```python
from datetime import datetime, timezone

from sqlalchemy import Integer, String, DateTime
from sqlalchemy.orm import Mapped, mapped_column

from app.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    email: Mapped[str] = mapped_column(String, unique=True, index=True)
    password_hash: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(
        DateTime, default=lambda: datetime.now(timezone.utc)
    )
```

- [ ] **Step 4: Verify imports**

Run: `cd backend && python -c "from app.database import Base, init_db; from app.db_models import User; print('OK')"`
Expected: `OK`

- [ ] **Step 5: Commit**

```bash
git add backend/requirements.txt backend/app/database.py backend/app/db_models.py
git commit -m "feat: add SQLite database setup and User model"
```

---

### Task 2: Auth utilities

**Files:**
- Create: `backend/app/auth.py`

- [ ] **Step 1: Create `backend/app/auth.py`**

```python
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

SECRET_KEY = "dev-secret-key-change-in-production"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE = timedelta(minutes=30)
REFRESH_TOKEN_EXPIRE = timedelta(days=7)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


def create_access_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + ACCESS_TOKEN_EXPIRE
    return jwt.encode(
        {"sub": str(user_id), "exp": expire},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def create_refresh_token(user_id: int) -> str:
    expire = datetime.now(timezone.utc) + REFRESH_TOKEN_EXPIRE
    return jwt.encode(
        {"sub": str(user_id), "exp": expire, "type": "refresh"},
        SECRET_KEY,
        algorithm=ALGORITHM,
    )


def decode_token(token: str) -> dict:
    return jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
```

- [ ] **Step 2: Verify**

Run: `cd backend && python -c "from app.auth import hash_password, verify_password, create_access_token; print('OK')"`
Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add backend/app/auth.py
git commit -m "feat: add auth utilities (password hashing, JWT)"
```

---

### Task 3: FastAPI dependencies

**Files:**
- Create: `backend/app/deps.py`

- [ ] **Step 1: Create `backend/app/deps.py`**

```python
from typing import Generator

import jwt as pyjwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.auth import decode_token
from app.database import SessionLocal
from app.db_models import User

security = HTTPBearer()


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
    db: Session = Depends(get_db),
) -> User:
    try:
        payload = decode_token(credentials.credentials)
        user_id = int(payload["sub"])
    except (pyjwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token",
        )
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
        )
    return user
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/deps.py
git commit -m "feat: add FastAPI dependencies (get_db, get_current_user)"
```

---

### Task 4: Auth API routes

**Files:**
- Create: `backend/app/auth_routes.py`

- [ ] **Step 1: Create `backend/app/auth_routes.py`**

```python
import jwt as pyjwt
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel, EmailStr
from sqlalchemy.orm import Session

from app.auth import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)
from app.db_models import User
from app.deps import get_db

router = APIRouter(prefix="/api/auth")

REFRESH_MAX_AGE = 7 * 24 * 3600  # 7 days


class AuthRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


def _set_refresh_cookie(response: Response, user_id: int) -> None:
    token = create_refresh_token(user_id)
    response.set_cookie(
        "refresh_token",
        token,
        httponly=True,
        samesite="lax",
        max_age=REFRESH_MAX_AGE,
    )


@router.post("/register", response_model=TokenResponse)
def register(
    req: AuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == req.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")
    user = User(email=req.email, password_hash=hash_password(req.password))
    db.add(user)
    db.commit()
    db.refresh(user)
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/login", response_model=TokenResponse)
def login(
    req: AuthRequest,
    response: Response,
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.email == req.email).first()
    if not user or not verify_password(req.password, user.password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    request: Request,
    response: Response,
    db: Session = Depends(get_db),
):
    token = request.cookies.get("refresh_token")
    if not token:
        raise HTTPException(status_code=401, detail="No refresh token")
    try:
        payload = decode_token(token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=401, detail="Invalid token type")
        user_id = int(payload["sub"])
    except (pyjwt.InvalidTokenError, KeyError, ValueError):
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    _set_refresh_cookie(response, user.id)
    return TokenResponse(access_token=create_access_token(user.id))


@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"ok": True}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/auth_routes.py
git commit -m "feat: add auth API routes (register, login, refresh, logout)"
```

---

### Task 5: Update backend main.py

**Files:**
- Modify: `backend/app/main.py`
- Modify: `backend/.gitignore` (add toreka.db, uploads/)

- [ ] **Step 1: Replace `backend/app/main.py`**

```python
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth_routes import router as auth_router
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
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
```

- [ ] **Step 2: Update `.gitignore`**

Add these lines to the project root `.gitignore`:

```
# Database
backend/toreka.db

# Uploads
backend/uploads/
```

- [ ] **Step 3: Verify the app starts**

Run: `cd backend && python -c "from app.main import app; print(type(app))"`
Expected: `<class 'fastapi.applications.FastAPI'>`

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py .gitignore
git commit -m "feat: integrate DB init, auth routes, file serving into main app"
```

---

### Task 6: Backend auth tests

**Files:**
- Create: `backend/tests/test_auth.py`
- Modify: `backend/tests/conftest.py`

- [ ] **Step 1: Update `backend/tests/conftest.py`**

Replace the entire file:

```python
import io

import pytest
from PIL import Image
from sqlalchemy import create_engine, StaticPool
from sqlalchemy.orm import sessionmaker

from app.database import Base
from app.deps import get_db
from app.main import app


@pytest.fixture
def test_image_bytes() -> bytes:
    img = Image.new("RGB", (100, 100), color=(255, 0, 0))
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf.read()


@pytest.fixture
def db_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestSession = sessionmaker(bind=engine)
    session = TestSession()
    try:
        yield session
    finally:
        session.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture
def override_db(db_session):
    def _get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = _get_db
    yield
    app.dependency_overrides.clear()
```

- [ ] **Step 2: Create `backend/tests/test_auth.py`**

```python
import pytest
from httpx import ASGITransport, AsyncClient

from app.main import app


@pytest.mark.asyncio
async def test_register(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        response = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"


@pytest.mark.asyncio
async def test_register_duplicate_email(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password456"},
        )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_login(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "password123"},
        )
    assert response.status_code == 200
    assert "access_token" in response.json()


@pytest.mark.asyncio
async def test_login_wrong_password(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        response = await client.post(
            "/api/auth/login",
            json={"email": "test@example.com", "password": "wrong"},
        )
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_refresh(override_db):
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        reg = await client.post(
            "/api/auth/register",
            json={"email": "test@example.com", "password": "password123"},
        )
        cookies = reg.cookies
        response = await client.post(
            "/api/auth/refresh",
            cookies=cookies,
        )
    assert response.status_code == 200
    assert "access_token" in response.json()
```

- [ ] **Step 3: Install dependencies and run tests**

Run:
```bash
cd backend && pip install -r requirements.txt
cd backend && python -m pytest tests/test_auth.py -v
```
Expected: 5 tests pass

- [ ] **Step 4: Commit**

```bash
git add backend/tests/conftest.py backend/tests/test_auth.py
git commit -m "test: add auth endpoint tests"
```

---

### Task 7: Frontend — install react-router and setup routing

**Files:**
- Modify: `frontend/package.json` (install react-router-dom)
- Modify: `frontend/src/main.tsx`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Install react-router-dom**

Run: `cd frontend && pnpm add react-router-dom`

- [ ] **Step 2: Replace `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Replace `frontend/src/App.tsx`**

```tsx
import { Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<p>Home (placeholder)</p>} />
      <Route path="/login" element={<p>Login (placeholder)</p>} />
      <Route path="/register" element={<p>Register (placeholder)</p>} />
    </Routes>
  )
}
```

- [ ] **Step 4: Verify build**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/pnpm-lock.yaml frontend/src/main.tsx frontend/src/App.tsx
git commit -m "feat: add react-router with placeholder routes"
```

---

### Task 8: Frontend — AuthContext

**Files:**
- Create: `frontend/src/contexts/AuthContext.tsx`

- [ ] **Step 1: Create `frontend/src/contexts/AuthContext.tsx`**

```tsx
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'

type AuthState = {
  token: string | null
  isAuthenticated: boolean
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

async function authFetch(
  url: string,
  body?: Record<string, string>,
): Promise<{ access_token: string }> {
  const res = await fetch(url, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  })
  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new Error(data?.detail ?? `Error: ${res.status}`)
  }
  return res.json()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    authFetch('/api/auth/refresh')
      .then((data) => setToken(data.access_token))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const data = await authFetch('/api/auth/login', { email, password })
    setToken(data.access_token)
  }, [])

  const register = useCallback(async (email: string, password: string) => {
    const data = await authFetch('/api/auth/register', { email, password })
    setToken(data.access_token)
  }, [])

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    }).catch(() => {})
    setToken(null)
  }, [])

  return (
    <AuthContext.Provider
      value={{ token, isAuthenticated: !!token, loading, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
```

- [ ] **Step 2: Wrap app with AuthProvider in `frontend/src/main.tsx`**

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add frontend/src/contexts/AuthContext.tsx frontend/src/main.tsx
git commit -m "feat: add AuthContext with JWT token management"
```

---

### Task 9: Frontend — Login and Register pages

**Files:**
- Create: `frontend/src/pages/LoginPage.tsx`
- Create: `frontend/src/pages/LoginPage.module.css`
- Create: `frontend/src/pages/RegisterPage.tsx`
- Create: `frontend/src/pages/RegisterPage.module.css`

- [ ] **Step 1: Create `frontend/src/pages/LoginPage.module.css`**

```css
.page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.card {
  width: 100%;
  max-width: 360px;
}

.title {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 24px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input {
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #3b82f6;
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
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #2563eb;
}

.button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  margin: 0;
}

.link {
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.link a {
  color: #3b82f6;
  text-decoration: none;
}
```

- [ ] **Step 2: Create `frontend/src/pages/LoginPage.tsx`**

```tsx
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './LoginPage.module.css'

export function LoginPage() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Login</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Logging in...' : 'Login'}
          </button>
        </form>
        <p className={styles.link}>
          <Link to="/register">Create an account</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Create `frontend/src/pages/RegisterPage.module.css`**

Same content as `LoginPage.module.css`:

```css
.page {
  min-height: 100dvh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.card {
  width: 100%;
  max-width: 360px;
}

.title {
  text-align: center;
  font-size: 22px;
  font-weight: 700;
  color: #1e293b;
  margin: 0 0 24px;
}

.form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.input {
  padding: 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 16px;
  outline: none;
  transition: border-color 0.2s;
}

.input:focus {
  border-color: #3b82f6;
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
  transition: background-color 0.2s;
}

.button:hover {
  background-color: #2563eb;
}

.button:disabled {
  background-color: #94a3b8;
  cursor: not-allowed;
}

.error {
  color: #ef4444;
  font-size: 14px;
  text-align: center;
  margin: 0;
}

.link {
  text-align: center;
  font-size: 14px;
  color: #64748b;
}

.link a {
  color: #3b82f6;
  text-decoration: none;
}
```

- [ ] **Step 4: Create `frontend/src/pages/RegisterPage.tsx`**

```tsx
import { FormEvent, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './RegisterPage.module.css'

export function RegisterPage() {
  const { register } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      await register(email, password)
      navigate('/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <h1 className={styles.title}>Register</h1>
        <form className={styles.form} onSubmit={handleSubmit}>
          <input
            className={styles.input}
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            className={styles.input}
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
          />
          {error && <p className={styles.error}>{error}</p>}
          <button className={styles.button} type="submit" disabled={submitting}>
            {submitting ? 'Creating account...' : 'Register'}
          </button>
        </form>
        <p className={styles.link}>
          Already have an account? <Link to="/login">Login</Link>
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 5: Commit**

```bash
git add frontend/src/pages/
git commit -m "feat: add Login and Register pages"
```

---

### Task 10: Frontend — Layout, ProtectedRoute, and Home page

**Files:**
- Create: `frontend/src/components/ProtectedRoute.tsx`
- Create: `frontend/src/components/Layout.tsx`
- Create: `frontend/src/components/Layout.module.css`
- Create: `frontend/src/pages/HomePage.tsx`
- Create: `frontend/src/pages/HomePage.module.css`
- Modify: `frontend/src/App.tsx`

- [ ] **Step 1: Create `frontend/src/components/ProtectedRoute.tsx`**

```tsx
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) return null

  if (!isAuthenticated) return <Navigate to="/login" replace />

  return <>{children}</>
}
```

- [ ] **Step 2: Create `frontend/src/components/Layout.module.css`**

```css
.layout {
  display: flex;
  flex-direction: column;
  min-height: 100dvh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #e2e8f0;
  background-color: #fff;
}

.headerTitle {
  font-size: 18px;
  font-weight: 700;
  color: #1e293b;
  margin: 0;
}

.logoutBtn {
  padding: 6px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 6px;
  background: none;
  color: #64748b;
  font-size: 13px;
  cursor: pointer;
}

.main {
  flex: 1;
  overflow-y: auto;
  padding-bottom: 60px;
}

.tabBar {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  border-top: 1px solid #e2e8f0;
  background-color: #fff;
}

.tab {
  flex: 1;
  padding: 10px 0;
  border: none;
  background: none;
  font-size: 13px;
  color: #94a3b8;
  cursor: pointer;
  text-align: center;
  text-decoration: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
}

.tabActive {
  color: #3b82f6;
  font-weight: 600;
}
```

- [ ] **Step 3: Create `frontend/src/components/Layout.tsx`**

```tsx
import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import styles from './Layout.module.css'

export function Layout() {
  const { logout } = useAuth()

  return (
    <div className={styles.layout}>
      <header className={styles.header}>
        <h1 className={styles.headerTitle}>トレカAR</h1>
        <button className={styles.logoutBtn} onClick={logout}>
          Logout
        </button>
      </header>
      <main className={styles.main}>
        <Outlet />
      </main>
      <nav className={styles.tabBar}>
        <NavLink
          to="/collections"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''}`
          }
        >
          Collections
        </NavLink>
        <NavLink
          to="/decks"
          className={({ isActive }) =>
            `${styles.tab} ${isActive ? styles.tabActive : ''}`
          }
        >
          Decks
        </NavLink>
      </nav>
    </div>
  )
}
```

- [ ] **Step 4: Create `frontend/src/pages/HomePage.module.css`**

```css
.page {
  padding: 24px 16px;
  text-align: center;
}

.message {
  color: #64748b;
  font-size: 16px;
}
```

- [ ] **Step 5: Create `frontend/src/pages/HomePage.tsx`**

```tsx
import styles from './HomePage.module.css'

export function HomePage() {
  return (
    <div className={styles.page}>
      <p className={styles.message}>Select a tab below to get started.</p>
    </div>
  )
}
```

- [ ] **Step 6: Replace `frontend/src/App.tsx`**

```tsx
import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { ProtectedRoute } from './components/ProtectedRoute'
import { LoginPage } from './pages/LoginPage'
import { RegisterPage } from './pages/RegisterPage'
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
        <Route path="/collections" element={<HomePage />} />
        <Route path="/decks" element={<HomePage />} />
      </Route>
    </Routes>
  )
}
```

- [ ] **Step 7: Verify build**

Run: `cd frontend && pnpm tsc --noEmit`
Expected: No errors

- [ ] **Step 8: Commit**

```bash
git add frontend/src/
git commit -m "feat: add Layout with tab bar, ProtectedRoute, and Home page"
```

---

### Task 11: Dev environment — LAN access

**Files:**
- Modify: `frontend/vite.config.ts`
- Modify: `Makefile`
- Modify: `frontend/index.html`

- [ ] **Step 1: Update `frontend/vite.config.ts`**

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    proxy: {
      '/api': 'http://localhost:8000',
      '/uploads': 'http://localhost:8000',
    },
  },
})
```

- [ ] **Step 2: Update `Makefile`**

```makefile
.PHONY: setup dev backend frontend

setup:
	cd backend && pip install -r requirements.txt
	cd frontend && pnpm install

dev:
	@$(MAKE) -j2 backend frontend

backend:
	cd backend && uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

frontend:
	cd frontend && pnpm dev
```

- [ ] **Step 3: Update `frontend/index.html`**

```html
<!doctype html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>トレカAR</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 4: Commit**

```bash
git add frontend/vite.config.ts Makefile frontend/index.html
git commit -m "feat: enable LAN access for mobile testing"
```

---

### Task 12: Global styles reset

**Files:**
- Create: `frontend/src/global.css`
- Modify: `frontend/src/main.tsx`

- [ ] **Step 1: Create `frontend/src/global.css`**

```css
*,
*::before,
*::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  -webkit-font-smoothing: antialiased;
  background-color: #f8fafc;
  color: #1e293b;
}
```

- [ ] **Step 2: Import in `frontend/src/main.tsx`**

Add this import at the top of `main.tsx` (before other imports):

```tsx
import './global.css'
```

Full file:

```tsx
import './global.css'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './contexts/AuthContext'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
```

- [ ] **Step 3: Verify build**

Run: `cd frontend && pnpm tsc --noEmit && pnpm build`
Expected: Build succeeds

- [ ] **Step 4: Commit**

```bash
git add frontend/src/global.css frontend/src/main.tsx
git commit -m "feat: add global CSS reset"
```
