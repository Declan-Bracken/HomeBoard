from sqlalchemy.orm import Session
from db.models import Wall, Route
from db.schemas import RouteCreate, RouteHoldCreate
from services import routehold_services as rhs
from typing import List
from collections import Counter

# CRUD
def create_route_on_wall(wall_id: int, route_data: RouteCreate, db: Session):
    wall = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall:
        raise ValueError("Wall does not exist!")
    route_existing = db.query(Route).filter(Route.wall_id == wall_id).filter(Route.name == route_data.name).first()
    if route_existing:
        raise ValueError("Route name already exists on this wall!")

    db_route = Route(
        wall_id=wall_id,
        **route_data.model_dump()
    )

    db.add(db_route)
    db.flush()
    return db_route

def get_route_from_wall(wall_id: int, route_id: int, db: Session):
    wall_exists = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall_exists:
        raise ValueError("Wall does not exist!")
    
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

def get_all_routes_from_wall(wall_id: int, db: Session):
    wall_exists = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall_exists:
        raise ValueError("Wall does not exist!")
    
    routes = db.query(Route).filter(Route.wall_id == wall_id).all()
    return routes

# Orchestration
def create_route_with_holds(wall_id: int, route_data: RouteCreate, holds_data: List[RouteHoldCreate], db: Session):
    db_route = create_route_on_wall(wall_id, route_data, db)
    for hold in holds_data:
        rhs.create_routehold(db_route.id, hold, db)
    return db_route

