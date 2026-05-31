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
