from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import Wall
from db.schemas import WallResponse, WallCreate

"""
Wall: SQLAlchemy declarative base model representing the wall table
WallResponse: Pydantic base model for validating expected return value when querying the walls table
WallCreate: Pydantic base model for validating creation of a new entry in the walls table
"""

router = APIRouter(prefix="/walls", tags=["Walls"])

@router.post("/", response_model=WallResponse)
def create_wall(wall: WallCreate, db: Session = Depends(get_db)):
    # Check whether wall already exists
    existing = db.query(Wall).filter(Wall.name == wall.name).first()
    if existing:
        raise HTTPException(status_code=400, detail="Wall name already exists!")
    
    db_wall = Wall(**wall.model_dump()) # Create the wall object based on input data
    db.add(db_wall)
    db.commit()
    db.refresh(db_wall)
    return db_wall

@router.get("/{wall_id}", response_model=WallResponse)
def get_wall(wall_id: int, db: Session = Depends(get_db)):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise HTTPException(status_code=404, detail="Wall not found!")
    return wall
