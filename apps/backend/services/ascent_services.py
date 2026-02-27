from db.schemas import AscentCreate
from db.models import Ascent, Route
from sqlalchemy.orm import Session

def create_ascent(route_id: int, ascent: AscentCreate, db: Session):
    route_exists = db.query(Route).filter(Route.id == route_id).first()
    if not route_exists:
        raise ValueError("Route does not exist!")

    ascent_db = Ascent(route_id=route_id, **ascent.model_dump())
    db.add(ascent_db)
    db.flush()
    return ascent_db

def get_ascent(route_id: int, ascent_id: int, db: Session):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise ValueError("Route does not exist!")
    ascent = db.query(Ascent).filter(Ascent.id == ascent_id).first()
    if not ascent:
        raise ValueError("Ascent log does not exist!")
    return ascent

def get_all_ascents(route_id: int, db: Session):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise ValueError("Route does not exist!")
    
    return route.ascents
