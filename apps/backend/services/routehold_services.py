from db.schemas import RouteHoldCreate
from db.models import RouteHolds, Route, Hold, Wall
from sqlalchemy.orm import Session
from sqlalchemy.exc import IntegrityError

def create_routehold(route_id: int, routehold: RouteHoldCreate, db: Session):
	# Data checks
	route = db.query(Route).filter(Route.id == route_id).first()
	if not route:
		raise ValueError("Route does not exist!")
	hold = db.query(Hold).filter(Hold.id == routehold.hold_id).first()
	if not hold:
		raise ValueError("Hold does not exist!")
	if route.wall_id != hold.wall_id:
		raise ValueError("Route and hold belong to different walls!")
	
	routehold_db = RouteHolds(route_id = route_id, **routehold.model_dump())
	db.add(routehold_db)
	try:
		db.commit()
	except IntegrityError:
		db.rollback()
		raise ValueError("Hold already added to route!")
	db.refresh(routehold_db)
	return routehold_db
	
def get_routehold(route_id: int, routehold_id: int, db: Session):
	route = db.query(Route).filter(Route.id == route_id).first()
	if not route:
		raise ValueError("Route does not exist!")
	return db.query(RouteHolds).filter(RouteHolds.id == routehold_id).first()
	
def get_all_routeholds(route_id: int, db:Session):
	route = db.query(Route).filter(Route.id == route_id).first()
	if not route:
		raise ValueError("Route does not exist!")
	return db.query(RouteHolds).filter(RouteHolds.route_id == route_id).all()
