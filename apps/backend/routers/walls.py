from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse, Response
from typing import List
from db.models import User, Ascent, Route
from sqlalchemy.orm import Session
from db.database import get_db
from db.schemas import (
    WallResponse, WallCreate, WallUpdate,
    WallMemberResponse, InviteMemberRequest,
    WallSearchResult, UserSearchResult
)
from storage.image_storage import download_image
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
    
@router.post("", response_model=WallResponse)
def create_wall_endpoint(wall: WallCreate, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        wall_db = ws.create_wall(wall, current_user, db)
        db.commit()
        db.refresh(wall_db)
        return {
            "id": wall_db.id,
            "name": wall_db.name,
            "privacy": wall_db.privacy,
            "image_path": wall_db.image_path,
            "created_at": wall_db.created_at,
            "created_by": wall_db.created_by,
            "role": "owner",
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.get("/{wall_id}", response_model=WallResponse)
def get_wall_endpoint(wall_id: int, current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    try:
        wall = ws.get_wall_with_access(wall_id, current_user, db)
        membership = ws.get_member(wall_id, current_user.id, db)
        return {
            "id": wall.id,
            "name": wall.name,
            "privacy": wall.privacy,
            "image_path": wall.image_path,
            "created_at": wall.created_at,
            "created_by": wall.created_by,
            "role": membership.role.value if membership else None,
        }
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.patch("/{wall_id}", response_model=WallResponse)
def update_wall_privacy_endpoint(
    wall_id: int,
    update: WallUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        wall = ws.update_wall_privacy(wall_id, update, current_user, db)
        db.commit()
        db.refresh(wall)
        return {
            "id": wall.id,
            "name": wall.name,
            "privacy": wall.privacy,
            "image_path": wall.image_path,
            "created_at": wall.created_at,
            "created_by": wall.created_by,
            "role": "owner",
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=403, detail=str(e))
    
# @router.get("/", response_model=List[WallResponse])
# def get_walls_endpoint(db: Session = Depends(get_db)):
#     try:
#         return ws.get_all_walls(db)
#     except ValueError as e:
#         raise HTTPException(status_code=404, detail=str(e))

@router.get("/{wall_id}/image")
def get_wall_image(
    wall_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        key = ws.get_wall_image(wall_id, current_user, db)
        image_bytes = download_image(key)
        return Response(content=image_bytes, media_type="image/jpeg")
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

# Member Management:
@router.get("/{wall_id}/members", response_model=List[WallMemberResponse])
def get_members_endpoint(
    wall_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        members = ws.get_members(wall_id, current_user, db)
        return [
            {
                "user_id": m.user_id,
                "username": m.member.username,
                "role": m.role.value,
                "created_at": m.created_at,
            }
            for m in members
        ]
    except ValueError as e:
        raise HTTPException(status_code=403, detail=str(e))

@router.post("/{wall_id}/members", response_model=WallMemberResponse)
def invite_member_endpoint(
    wall_id: int,
    body: InviteMemberRequest,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        membership = ws.invite_member(wall_id, body.username, current_user, db)
        db.commit()
        db.refresh(membership)
        return {
            "user_id": membership.user_id,
            "username": membership.member.username,
            "role": membership.role.value,
            "created_at": membership.created_at,
        }
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))

@router.delete("/{wall_id}/members/{user_id}", status_code=204)
def remove_member_endpoint(
    wall_id: int,
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    try:
        ws.remove_member(wall_id, user_id, current_user, db)
        db.commit()
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
