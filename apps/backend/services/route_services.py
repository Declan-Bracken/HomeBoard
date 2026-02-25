from sqlalchemy.orm import Session
from db.models import Wall, Route
from db.schemas import RouteCreate

def create_route_on_wall(wall_id: int, route_data: RouteCreate, db: Session):
    existing = db.query(Route).filter(Route.wall_id == wall_id).filter(Route.name == route_data.name).first()

    if existing:
        raise ValueError("Route name already exists on this wall!")

    db_route = Route(
        wall_id=wall_id,
        **route_data.model_dump()
    )

    db.add(db_route)
    db.commit()
    db.refresh(db_route)

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
    return route

def get_all_routes_from_wall(wall_id: int, db: Session):
    wall_exists = db.query(Wall).filter(Wall.id == wall_id).first()
    if not wall_exists:
        raise ValueError("Wall does not exist!")
    
    routes = db.query(Route).filter(Route.wall_id == wall_id).all()
    return routes
