from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from typing import List
from db.models import User
from sqlalchemy.orm import Session
from db.database import get_db
from db.schemas import WallResponse, WallCreate
from services import wall_services as ws
from core.dependencies import get_current_user
"""
Wall: SQLAlchemy declarative base model representing the wall table
WallResponse: Pydantic base model for validating expected return value when querying the walls table
WallCreate: Pydantic base model for validating creation of a new entry in the walls table
"""

router = APIRouter(prefix="/walls", tags=["Walls"])

@router.get("/me")
def get_my_walls(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return ws.get_current_user_walls(current_user, db)
    except ValueError as e:
        return HTTPException(status_code=404, detail=str(e))
    
@router.post("/", response_model=WallResponse)
def create_wall_endpoint(wall: WallCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        wall_db = ws.create_wall(wall, current_user, db)
        db.commit()
        db.refresh(wall_db)
        return wall_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{wall_id}", response_model=WallResponse)
def get_wall_endpoint(wall_id: int, db: Session = Depends(get_db)):
    try:
        return ws.get_wall(wall_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/", response_model=List[WallResponse])
def get_walls_endpoint(db: Session = Depends(get_db)):
    try:
        return ws.get_all_walls(db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{wall_id}/image")
def get_wall_image(wall_id: int, db: Session = Depends(get_db)):
    try:
        image_path = ws.get_wall_image(wall_id, db)
        return FileResponse(path=image_path, media_type="image/jpeg")
    except ValueError as e:
        raise HTTPException(status_code = 404, detail = str(e))
