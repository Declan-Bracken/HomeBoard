from fastapi import APIRouter, Depends, HTTPException
from typing import List
from sqlalchemy.orm import Session
from db.database import get_db
from db.models import User
from db.schemas import UserResponse, UserCreate, UserProfileResponse
from services import user_services as us
from core.dependencies import get_current_user

router = APIRouter(prefix="/users", tags=["Users"])

@router.post("/", response_model=UserResponse)
def create_user_endpoint(user: UserCreate, db: Session = Depends(get_db)):
    try:
        user_db = us.create_user(user, db)
        db.commit()
        db.refresh(user_db)
        return user_db
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{user_id}", response_model=UserResponse)
def get_user_endpoint(user_id: int, db: Session = Depends(get_db)):
    try:
        return us.get_user(user_id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/", response_model=List[UserResponse])
def get_users_endpoint(db: Session = Depends(get_db)):
    try:
        return us.get_all_users(db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/me/profile", response_model = UserProfileResponse)
def get_user_statistics(user_id: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        return us.get_statistics(user_id.id, db)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
