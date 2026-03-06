from sqlalchemy.orm import Session
from db.models import Wall, WallMember, User, RoleEnum, PrivacyEnum
from db.schemas import WallCreate, WallUpdate
import os
from control_helpers import *


# Wall CRUD
def create_wall(wall: WallCreate, current_user, db: Session):
    # Check whether wall already exists
    existing = db.query(Wall).filter(Wall.name == wall.name).filter(Wall.created_by == current_user.username).first()
    if existing:
        raise ValueError("Wall name already exists!")
    
    # Add wall to db
    db_wall = Wall(created_by = current_user.username, **wall.model_dump()) # Create the wall object based on input data
    db.add(db_wall)
    db.flush()

    # Add membership
    membership = WallMember(wall_id = db_wall.id, user_id = current_user.id, role = RoleEnum.owner)
    db.add(membership)
    db.flush()

    return db_wall

def get_wall(wall_id: int, db: Session):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall not found!")
    return wall

def get_wall_with_access(wall_id: int, current_user: User, db: Session) -> Wall:
    wall = get_wall(wall_id, db)
    assert_access(wall, current_user, db)
    return wall

def update_wall_privacy(wall_id: int, update: WallUpdate, current_user: User, db: Session) -> Wall:
    wall = get_wall(wall_id, db)
    assert_owner(wall, current_user)
    wall.privacy = PrivacyEnum(update.privacy)
    db.flush()
    return wall

def get_current_user_walls(current_user: User, db: Session) -> list:
    """Return all walls the user owns or is a member of, with role attached."""
    memberships = (
        db.query(WallMember)
        .filter(WallMember.user_id == current_user.id)
        .all()
    )
    results = []
    for m in memberships:
        wall = m.wall
        # Attach role as a non-column attribute for the schema to pick up
        wall_dict = {
            "id": wall.id,
            "name": wall.name,
            "privacy": wall.privacy,
            "image_path": wall.image_path,
            "created_at": wall.created_at,
            "created_by": wall.created_by,
            "role": m.role.value,
        }
        results.append(wall_dict)
    return results

def get_wall_image(wall_id: int, current_user: User, db: Session) -> str:
    wall = get_wall(wall_id, db)
    assert_access(wall, current_user, db)
    if not wall.image_path:
        raise ValueError("No image uploaded for this wall")
    if not os.path.exists(wall.image_path):
        raise ValueError("Image file not found on disk")
    return wall.image_path

# ─── Member management ────────────────────────────────────────────────────────

def get_members(wall_id: int, current_user: User, db: Session) -> list[WallMember]:
    wall = get_wall(wall_id, db)
    assert_access(wall, current_user, db)
    return db.query(WallMember).filter(WallMember.wall_id == wall_id).all()

def invite_member(wall_id: int, username: str, current_user: User, db: Session) -> WallMember:
    wall = get_wall(wall_id, db)
    assert_owner(wall, current_user)

    target = db.query(User).filter(User.username == username).first()
    if not target:
        raise ValueError(f"User '{username}' not found")

    existing = get_member(wall_id, target.id, db)
    if existing:
        raise ValueError(f"'{username}' is already a member of this wall")

    membership = WallMember(wall_id=wall_id, user_id=target.id, role=RoleEnum.member)
    db.add(membership)
    db.flush()
    return membership

def remove_member(wall_id: int, user_id: int, current_user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_owner(wall, current_user)

    if user_id == current_user.id:
        raise ValueError("Owner cannot remove themselves from the wall")

    membership = get_member(wall_id, user_id, db)
    if not membership:
        raise ValueError("User is not a member of this wall")

    db.delete(membership)
    db.flush()

# ─── Search / discovery ───────────────────────────────────────────────────────

def search_walls(query: str, db: Session) -> list[Wall]:
    """Search public walls by name."""
    return (
        db.query(Wall)
        .filter(
            Wall.privacy == PrivacyEnum.Public,
            Wall.name.ilike(f"%{query}%")
        )
        .limit(20)
        .all()
    )

def search_users(query: str, db: Session) -> list[User]:
    """Search users by username, returning up to 20 results."""
    return (
        db.query(User)
        .filter(User.username.ilike(f"%{query}%"))
        .limit(20)
        .all()
    )
