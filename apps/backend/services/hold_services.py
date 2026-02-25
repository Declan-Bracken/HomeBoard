from sqlalchemy.orm import Session
from db.models import Wall, Hold
from db.schemas import HoldCreate

def create_hold(wall_id: int, hold: HoldCreate, db: Session):
    db_hold = Hold(wall_id = wall_id, **hold.model_dump())

    db.add(db_hold)
    db.commit()
    db.refresh(db_hold)
    return db_hold

def get_hold(wall_id: int, hold_id: int, db: Session):
    wall_exists = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall_exists:
        raise ValueError("Wall does not exist!")
    
    hold = db.query(Hold).filter(Hold.wall_id == wall_id).filter(Hold.id == hold_id).first()
    if not hold:
        raise ValueError("Hold does not exist on specified wall!")
    
    return hold
