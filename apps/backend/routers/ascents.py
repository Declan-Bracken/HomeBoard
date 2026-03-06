from fastapi import APIRouter, Depends, HTTPException
from db.database import get_db
from typing import List
from db.models import User
from sqlalchemy.orm import Session
from db.schemas import AscentCreate, AscentResponse
from services import ascent_services as a_s
from core.dependencies import get_current_user

router = APIRouter(prefix = "/walls/{wall_id}/routes/{route_id}/ascents/", tags=["Ascents"])

@router.post("/", response_model = AscentResponse)
def create_ascent_endpoint(wall_id: int, route_id: int, ascent: AscentCreate,
                           current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        ascent_db = a_s.create_ascent(wall_id, route_id, current_user, ascent, db)
        db.commit()
        db.refresh(ascent_db)
        return ascent_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{ascent_id}", response_model=AscentResponse)
def get_ascent_endpoint(wall_id: int, route_id: int, ascent_id: int, 
                        current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return a_s.get_ascent(wall_id, route_id, current_user, ascent_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/", response_model=List[AscentResponse])
def get_ascents_endpoint(wall_id: int, route_id: int, 
                         current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return a_s.get_all_ascents(wall_id, route_id, current_user, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
