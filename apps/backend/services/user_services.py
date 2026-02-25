from sqlalchemy.orm import Session
from db.models import User
from db.schemas import UserCreate

def create_user(user: UserCreate, db: Session):
    # Check whether user already exists
    existing = db.query(User).filter(User.username == user.username).first()
    if existing:
        raise ValueError("User name already exists!")
    
    db_user = User(**user.model_dump()) # Create the user object based on input data
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def get_user(user_id: int, db: Session):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise ValueError("User not found!")
    return user

def get_all_users(db: Session):
    users = db.query(User)
    return users
