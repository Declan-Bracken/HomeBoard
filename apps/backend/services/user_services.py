from sqlalchemy.orm import Session
from db.models import User, Ascent, Route, Wall
from db.schemas import UserCreate
from typing import Optional
from core.security import hash_password, verify_password

def create_user(user: UserCreate, db: Session):
    # Check whether user already exists
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise ValueError("User name already exists!")
    
    db_user = User(**user.model_dump()) # Create the user object based on input data
    db.add(db_user)
    db.flush()
    return db_user

def get_user(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found!")
    return user

def get_all_users(db: Session):
    users = db.query(User)
    return users

def get_statistics(user_id: int, db: Session):
    user = get_user(user_id, db)
    # Fetch all ascents with their related route and wall in one query
    ascents = (
        db.query(Ascent)
        .join(Route, Ascent.route_id == Route.id)
        .join(Wall, Route.wall_id == Wall.id)
        .filter(Ascent.user_id == user_id)
        .order_by(Ascent.created_at.desc())
        .all()
    )

    # Build ascent summaries
    ascent_summaries = [
        {
            "date": a.created_at.strftime("%Y-%m-%d"),
            "route_name": a.route.name,
            "wall_name": a.route.wall.name,
            "grade": a.route.grade,
            "n_attempts": a.n_attempts,
            "quality": a.quality,
            "suggested_grade": a.suggested_grade,
        }
        for a in ascents
    ]

    # Flash = sent first try (n_attempts == 1 or None assumed flash)
    flash_grades = [a.route.grade for a in ascents if a.n_attempts == 1]
    redpoint_grades = [a.route.grade for a in ascents]

    # Grade ordering for finding highest
    grade_order = ['Unknown','V0','V1','V2','V3','V4','V5','V6','V7',
                   'V8','V9','V10','V11','V12','V15','V16','V17']

    def highest_grade(grades):
        if not grades:
            return None
        return max(grades, key=lambda g: grade_order.index(g) if g in grade_order else -1)

    return {
        "username": user.username,
        "member_since": user.created_at,
        "ascents": ascent_summaries,
        "highest_flash_grade": highest_grade(flash_grades),
        "highest_redpoint_grade": highest_grade(redpoint_grades),
        "total_sends": len(ascents),
    }

def update_user(user: User, username: Optional[str], email: Optional[str], 
                current_password: Optional[str], new_password: Optional[str], db: Session):
    
    if username and username != user.username:
        existing = db.query(User).filter(User.username == username).first()
        if existing:
            raise ValueError("Username already taken")
        # Update created_by on walls and routes to new username
        db.query(Wall).filter(Wall.created_by == user.username).update({"created_by": username})
        db.query(Route).filter(Route.created_by == user.username).update({"created_by": username})
        user.username = username

    if email and email != user.email:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            raise ValueError("Email already in use")
        user.email = email

    if new_password:
        if not current_password:
            raise ValueError("Current password required")
        if not verify_password(current_password, user.hashed_password):
            raise ValueError("Current password is incorrect")
        user.hashed_password = hash_password(new_password)

    db.commit()
    db.refresh(user)
    return user

def delete_user(user: User, db: Session):
    db.delete(user)
    db.commit()
