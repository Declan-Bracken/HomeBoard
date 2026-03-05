from db.schemas import AscentCreate
from db.models import Ascent, Route
from sqlalchemy.orm import Session
from sqlalchemy import update

def create_ascent(route_id: int, user_id: int, ascent: AscentCreate, db: Session):
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise ValueError("Route does not exist!")
    ascent_db = Ascent(route_id=route_id, user_id = user_id, **ascent.model_dump())
    db.add(ascent_db)
    # Increment ascent count
    db.execute(update(Route).where(Route.id == route_id).values(ascent_count=Route.ascent_count + 1))
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
    ascents = db.query(Ascent).filter(Ascent.route_id == route_id)\
        .order_by(Ascent.created_at.desc()).limit(20).all()
    return [
        {
            "id": a.id,
            "user_id": a.user_id,
            "route_id": a.route_id,
            "created_at": a.created_at,
            "quality": a.quality,
            "suggested_grade": a.suggested_grade,
            "n_attempts": a.n_attempts,
            "username": a.users.username,
        }
        for a in ascents
    ]
