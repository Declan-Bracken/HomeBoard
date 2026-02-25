from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional

# User
class UserCreate(BaseModel):
    username: str

class UserResponse(BaseModel):
    username: str
    id: int
    created_at: datetime
    
    class Config:
        from_attributes = True

# Wall
class WallBase(BaseModel):
    name: str
    image_url: str
    created_by: str

class WallCreate(WallBase):
    pass

class WallResponse(WallBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Route
class RouteBase(BaseModel):
    name: str
    grade: str
    created_by: str

class RouteCreate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: int
    wall_id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Ascent
class AscentCreate(BaseModel):
    user_id: int

class AscentResponse(BaseModel):
    id: int
    user_id: int
    route_id: int
    created_at: datetime
    # Note: an ascent should probably have an optional attempt count & a recommended grade field
    class Config:
        from_attributes = True

# Hold
class HoldBase(BaseModel):
    x_min: int
    x_max: int
    y_min: int
    y_max: int
    x_center: int
    y_center: int
    confidence: float
    polygon: list

class HoldCreate(HoldBase):
    pass

class HoldResponse(HoldBase):
    id: int
    wall_id: int
    class Config:
        from_attributes = True
