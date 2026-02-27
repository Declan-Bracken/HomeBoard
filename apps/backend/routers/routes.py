from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from db.database import get_db
from db.schemas import RouteResponse, RouteCreate, RouteHoldCreate
from services import route_services as rs

router = APIRouter(prefix="/walls/{wall_id}/routes", tags=["Routes"])

# Routes:
@router.post("/", response_model=RouteResponse)
def create_route_endpoint(wall_id: int, route: RouteCreate, db: Session = Depends(get_db)):
    try:
        route_db = rs.create_route_on_wall(wall_id, route, db)
        db.commit()
        db.refresh(route_db)
        return route_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{route_id}", response_model=RouteResponse)
def get_route_endpoint(wall_id: int, route_id:int, db: Session = Depends(get_db)):
    try:
        return rs.get_route_from_wall(wall_id, route_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/", response_model=List[RouteResponse])
def get_routes_endpoint(wall_id: int, db: Session = Depends(get_db)):
    return rs.get_all_routes_from_wall(wall_id, db)

# Orchestration:
@router.post("/with-holds", response_model=RouteResponse)
def create_route_with_holds_endpoint(wall_id: int, route: RouteCreate, holds_data: List[RouteHoldCreate], db: Session = Depends(get_db)):
    try:
        route_db = rs.create_route_with_holds(wall_id, route, holds_data, db)
        db.commit()
        db.refresh(route_db)
        return route_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
