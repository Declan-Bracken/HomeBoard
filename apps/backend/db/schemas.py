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
    wall_id: int

class RouteCreate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# Ascent

