from db.schemas import AscentCreate
from db.models import Ascent, Route, User
from sqlalchemy.orm import Session
from sqlalchemy import update
from services.control_helpers import *
from services.wall_services import get_wall

def create_ascent(wall_id: int, route_id: int, user: User, ascent: AscentCreate, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise ValueError("Route does not exist!")
    ascent_db = Ascent(route_id=route_id, user_id = user.id, **ascent.model_dump())
    db.add(ascent_db)
    # Increment ascent count
    db.execute(update(Route).where(Route.id == route_id).values(ascent_count=Route.ascent_count + 1))
    db.flush()
    return ascent_db

def get_ascent(wall_id: int, route_id: int, user: User, ascent_id: int, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    route = db.query(Route).filter(Route.id == route_id).first()
    if not route:
        raise ValueError("Route does not exist!")
    ascent = db.query(Ascent).filter(Ascent.id == ascent_id).first()
    if not ascent:
        raise ValueError("Ascent log does not exist!")
    return ascent

def get_all_ascents(wall_id: int, route_id: int, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
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
