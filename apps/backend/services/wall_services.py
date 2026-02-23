from sqlalchemy.orm import Session
from db.models import Wall
from db.schemas import WallCreate

def create_wall(wall: WallCreate, db: Session):
    # Check whether wall already exists
    existing = db.query(Wall).filter(Wall.name == wall.name).first()
    if existing:
        raise ValueError("Wall name already exists!")
    
    db_wall = Wall(**wall.model_dump()) # Create the wall object based on input data
    db.add(db_wall)
    db.commit()
    db.refresh(db_wall)
    return db_wall

def get_wall(wall_id: int, db: Session):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall not found!")
    return wall
