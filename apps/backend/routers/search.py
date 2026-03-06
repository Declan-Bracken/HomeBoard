# routers/search.py
from fastapi import APIRouter, Depends, Query
from typing import List
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.schemas import WallSearchResult, UserSearchResult
from services import wall_services as ws
from core.dependencies import get_current_user

router = APIRouter(prefix="/search", tags=["Search"])

@router.get("/walls", response_model=List[WallSearchResult])
def search_walls(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    walls = ws.search_walls(q, db)
    return [
        {
            "id": w.id,
            "name": w.name,
            "created_by": w.created_by,
            "created_at": w.created_at,
            "route_count": len(w.routes),
        }
        for w in walls
    ]

@router.get("/users", response_model=List[UserSearchResult])
def search_users(
    q: str = Query(..., min_length=1),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    users = ws.search_users(q, db)
    results = []
    for u in users:
        public_walls = [
            {
                "id": w.id,
                "name": w.name,
                "created_by": w.created_by,
                "created_at": w.created_at,
                "route_count": len(w.routes),
            }
            for w in u.created_walls
            if w.privacy.value == "Public"
        ]
        results.append({
            "username": u.username,
            "created_at": u.created_at,
            "total_sends": len(u.ascents),
            "public_walls": public_walls,
        })
    return results
