from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from db.models import User
from db.database import get_db
from db.schemas import UserRouteRelationResponse, UserRouteRelationUpdate
from services import route_services as rs
from core.dependencies import get_current_user

router = APIRouter("/routes", tags=["Relations"])

# Get all relations for current user on a wall — before /{wall_id}/routes/{route_id}
@router.get("/my_relations", response_model=List[UserRouteRelationResponse])
def get_my_relations(wall_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return rs.get_wall_relations_for_user(wall_id, user, db)

# Upsert relation for a single route
@router.post("/{route_id}/relations", response_model=UserRouteRelationResponse)
def upsert_relation(route_id: int, body: UserRouteRelationUpdate, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return rs.upsert_route_relation(route_id, user, body.liked, body.todo, db)

@router.get("/{route_id}/relations", response_model=UserRouteRelationResponse)
def get_my_relation(route_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return rs.get_relation(route_id, user, db)
    except ValueError as e:
        raise HTTPException(status_code = 400, detail = str(e))
    