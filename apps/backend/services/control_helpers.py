from sqlalchemy.orm import Session
from db.models import Wall, WallMember, User, PrivacyEnum

# Access Control Helpers:
def get_member(wall_id: int, user_id: int, db: Session) -> WallMember | None:
    return db.query(WallMember).filter(
        WallMember.wall_id == wall_id,
        WallMember.user_id == user_id
    ).first()

def can_access(wall: Wall, user: User, db: Session):
    if wall.privacy == PrivacyEnum.Public:
        return True
    return get_member(wall.id, user.id, db) is not None

def is_owner(wall: Wall, user: User):
    return wall.created_by == user.username

def assert_access(wall: Wall, user: User, db: Session):
    if not can_access(wall, user, db):
        raise ValueError("You don't have access to this wall!")

def assert_owner(wall: Wall, user: User):
    if not is_owner(wall, user):
        raise ValueError("You do not own this wall!")
