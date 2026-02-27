from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from db.database import get_db
from db.schemas import HoldResponse, HoldCreate
from services import hold_services as hs

router = APIRouter(prefix="/walls/{wall_id}/holds", tags=["Holds"])

@router.post("/", response_model = HoldResponse)
def create_hold_endpoint(wall_id: int, hold: HoldCreate, db: Session = Depends(get_db)):
    try:
        hold_db = hs.create_hold(wall_id, hold, db)
        db.commit()
        db.refresh(hold_db)
        return hold_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code = 400, detail=f"Error encountered during hold creation: {e}")
    
@router.get("/{hold_id}", response_model = HoldResponse)
def get_hold_endpoint(wall_id: int, hold_id: int, db: Session = Depends(get_db)):
    try:
        return hs.get_hold(wall_id, hold_id, db)
    except ValueError as e:
        raise HTTPException(status_code = 404, detail = f"Error retrieving hold details: {e}")

@router.get("/", response_model = List[HoldResponse])
def get_holds_endpoint(wall_id: int, db: Session = Depends(get_db)):
    try:
        return hs.get_all_holds(wall_id, db)
    except ValueError as e:
        raise HTTPException(status_code = 404, detail = f"Error retrieving hold details: {e}")
