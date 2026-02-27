from fastapi import APIRouter, Depends, HTTPException
from db.database import get_db
from typing import List
from sqlalchemy.orm import Session
from db.schemas import AscentCreate, AscentResponse
from services import ascent_services as a_s

router = APIRouter(prefix = "/routes/{route_id}/ascents", tags=["Ascents"])

@router.post("/", response_model = AscentResponse)
def create_ascent_endpoint(route_id: int, ascent: AscentCreate, db: Session = Depends(get_db)):
    try:
        ascent_db = a_s.create_ascent(route_id, ascent, db)
        db.commit()
        db.refresh(ascent_db)
        return ascent_db
    except ValueError as e:
        db.rollback()
        HTTPException(status_code=404, detail=str(e))

@router.get("/{ascent_id}", response_model=AscentResponse)
def get_ascent_endpoint(route_id: int, ascent_id, db: Session = Depends(get_db)):
    try:
        return a_s.get_ascent(route_id, ascent_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/", response_model=List[AscentResponse])
def get_ascents_endpoint(route_id: int, db: Session = Depends(get_db)):
    try:
        return a_s.get_all_ascents(route_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
