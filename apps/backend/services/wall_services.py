from sqlalchemy.orm import Session
from db.models import Wall
from db.schemas import WallCreate
import os

def create_wall(wall: WallCreate, current_user, db: Session):
    # Check whether wall already exists
    existing = db.query(Wall).filter(Wall.name == wall.name).first()
    if existing:
        raise ValueError("Wall name already exists!")
    
    db_wall = Wall(created_by = current_user.username, **wall.model_dump()) # Create the wall object based on input data
    db.add(db_wall)
    db.flush()
    return db_wall

def get_wall(wall_id: int, db: Session):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall not found!")
    return wall

def get_all_walls(db: Session):
    walls = db.query(Wall)
    return walls

def get_current_user_walls(current_user, db):
    walls = db.query(Wall).filter(Wall.created_by == current_user.username).all()
    return walls

def get_wall_image(wall_id: int, db: Session):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall not found")
    if not wall.image_path:
        raise ValueError("No image uploaded for this wall")
    if not os.path.exists(wall.image_path):
        raise ValueError("Image file not found on disk")
    return wall.image_path
