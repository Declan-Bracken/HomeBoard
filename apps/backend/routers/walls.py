from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Wall
from db.schemas import WallResponse, WallCreate
from services import wall_services as ws
"""
Wall: SQLAlchemy declarative base model representing the wall table
WallResponse: Pydantic base model for validating expected return value when querying the walls table
WallCreate: Pydantic base model for validating creation of a new entry in the walls table
"""

router = APIRouter(prefix="/walls", tags=["Walls"])

@router.post("/", response_model=WallResponse)
def create_wall_endpoint(wall: WallCreate, db: Session = Depends(get_db)):
    try:
        return ws.create_wall(wall, db)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{wall_id}", response_model=WallResponse)
def get_wall_endpoint(wall_id: int, db: Session = Depends(get_db)):
    try:
        return ws.get_wall(db, wall_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
