from sqlalchemy.orm import Session
from db.models import Wall, Route
from db.schemas import RouteCreate, RouteHoldCreate
from services import routehold_services as rhs
from typing import List
from collections import Counter
from control_helpers import *
from wall_services import get_wall

# CRUD
def create_route_on_wall(wall_id: int, route_data: RouteCreate, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)

    db_route = Route(
        wall_id=wall_id,
        **route_data.model_dump()
    )

    db.add(db_route)
    db.flush()
    return db_route

def get_route_from_wall(wall_id: int, route_id: int, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    
    route = (db.query(Route)
             .filter(Route.id == route_id)
             .filter(Route.wall_id == wall_id).first()
            )

    if not route:
        raise ValueError("Route not found!")
    
    suggestions = [a.suggested_grade for a in route.ascents if a.suggested_grade]
    mode_grade = Counter(suggestions).most_common(1)[0][0] if suggestions else None

    return {
        "id": route.id,
        "wall_id": route.wall_id,
        "name": route.name,
        "grade": route.grade,
        "created_by": route.created_by,
        "created_at": route.created_at,
        "ascent_count": route.ascent_count,
        "description": route.description,
        "mode_suggested_grade": mode_grade,
    }

def get_all_routes_from_wall(wall_id: int, user: User, db: Session):
    wall = get_wall(wall_id, db)
    assert_access(wall, user, db)
    
    routes = db.query(Route).filter(Route.wall_id == wall_id).all()
    return routes

# Orchestration
def create_route_with_holds(wall_id: int, route_data: RouteCreate, user: User, holds_data: List[RouteHoldCreate], db: Session):
    db_route = create_route_on_wall(wall_id, route_data, user, db)
    for hold in holds_data:
        rhs.create_routehold(db_route.id, hold, db)
    return db_route

