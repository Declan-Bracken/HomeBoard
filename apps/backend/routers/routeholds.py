from fastapi import APIRouter, HTTPException, Depends
from db.database import get_db
from db.schemas import RouteHoldCreate, RouteHoldResponse
import services.routehold_services as rhs
from typing import List
from sqlalchemy.orm import Session

# router address routes through routes, since routeholds will only be added through the creation of a route.
router = APIRouter(prefix = "/routes/{route_id}/routeholds", tags = ["RouteHolds"])

# creation of a route hold
@router.post("/", response_model = RouteHoldResponse)
def create_routehold_endpoint(route_id: int, routehold: RouteHoldCreate, db: Session = Depends(get_db)):
	try:
		return rhs.create_routehold(route_id, routehold, db)
	except ValueError as e:
		raise HTTPException(status_code = 400, detail=str(e))

# getting all route holds
@router.get("/", response_model = List[RouteHoldResponse])
def get_routeholds_endpoint(route_id: int, db: Session = Depends(get_db)):
	try:
		return rhs.get_all_routeholds(route_id, db)
	except ValueError as e:
		raise HTTPException(status_code = 404, detail=str(e))
	
# get a single routehold:
@router.get("/{routehold_id}", response_model = RouteHoldResponse)
def get_routehold_endpoint(route_id: int, routehold_id: int, db: Session = Depends(get_db)):
	try:
		return rhs.get_routehold(route_id, routehold_id, db)
	except ValueError as e:
		raise HTTPException(status_code = 404, detail = str(e))
