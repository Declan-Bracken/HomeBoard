from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from db.models import User
from db.database import get_db
from db.schemas import RouteResponse, RouteCreate, RouteWithHoldsCreate
from services import route_services as rs
from core.dependencies import get_current_user

router = APIRouter(prefix="/walls/{wall_id}/routes", tags=["Routes"])

# Routes:
@router.post("", response_model=RouteResponse)
def create_route_endpoint(wall_id: int, route: RouteCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        route_db = rs.create_route_on_wall(wall_id, route, current_user, db)
        db.commit()
        db.refresh(route_db)
        return route_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{route_id}", response_model=RouteResponse)
def get_route_endpoint(wall_id: int, route_id:int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return rs.get_route_from_wall(wall_id, route_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("", response_model=List[RouteResponse])
def get_routes_endpoint(wall_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return rs.get_all_routes_from_wall(wall_id, current_user, db)

# Orchestration:
@router.post("/with-holds", response_model=RouteResponse)
def create_route_with_holds_endpoint(
    wall_id: int,
    payload: RouteWithHoldsCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    try:
        payload.route.created_by = current_user.username
        route_db = rs.create_route_with_holds(wall_id, payload.route, current_user, payload.holds_data, db)
        db.commit()
        db.refresh(route_db)
        return route_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
