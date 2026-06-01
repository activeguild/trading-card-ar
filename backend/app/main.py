from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.auth_routes import router as auth_router
from app.card_routes import router as card_router
from app.effect_routes import router as effect_router
from app.ar_routes import router as ar_router
from app.deck_routes import router as deck_router
from app.collection_routes import router as collection_router
from app.database import init_db
from app.model import load_model
from app.routes import router as api_router

UPLOADS_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOADS_DIR.mkdir(exist_ok=True)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
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
app.include_router(ar_router)
app.include_router(deck_router)
app.mount("/uploads", StaticFiles(directory=str(UPLOADS_DIR)), name="uploads")
