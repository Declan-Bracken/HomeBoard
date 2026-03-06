from sqlalchemy.orm import Session
from db.models import Hold
from db.schemas import HoldCreate
from control_helpers import *
from wall_services import get_wall

def create_hold(wall_id: int, hold: HoldCreate, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_owner(wall, user)

    db_hold = Hold(wall_id = wall_id, **hold.model_dump())

    db.add(db_hold)
    db.flush()
    return db_hold

def get_hold(wall_id: int, hold_id: int, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    
    hold = db.query(Hold).filter(Hold.wall_id == wall_id).filter(Hold.id == hold_id).first()
    if not hold:
        raise ValueError("Hold does not exist on specified wall!")
    
    return hold

def get_all_holds(wall_id: int, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    
    return db.query(Hold).filter(Hold.wall_id == wall_id).all()
    