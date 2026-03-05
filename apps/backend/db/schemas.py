from pydantic import BaseModel
from datetime import datetime
from typing import List, Optional, Literal

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

class WallCreate(WallBase):
    pass

class WallResponse(WallBase):
    id: int
    image_path: str | None = None
    created_at: datetime
    created_by: str

    class Config:
        from_attributes = True

# Route
class RouteBase(BaseModel):
    name: str
    grade: str
    created_by: str
    description: Optional[str] = None

class RouteCreate(RouteBase):
    pass

class RouteResponse(RouteBase):
    id: int
    wall_id: int
    created_at: datetime
    ascent_count: int = 0
    mode_suggested_grade: str | None = None

    class Config:
        from_attributes = True

# Ascent
class AscentCreate(BaseModel):
    quality: Optional[int] = None      # 1-5
    suggested_grade: Optional[str] = None
    n_attempts: Optional[int] = None
    notes: Optional[str] = None

class AscentResponse(BaseModel):
    id: int
    user_id: int
    route_id: int
    created_at: datetime
    quality: Optional[int] = None      # 1-5
    suggested_grade: Optional[str] = None
    n_attempts: Optional[int] = None
    username: Optional[str] = None
    notes: Optional[str] = None
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
    confidence: float | None = None
    polygon: list

class HoldCreate(HoldBase):
    pass

class HoldResponse(HoldBase):
    id: int
    wall_id: int
    class Config:
        from_attributes = True

class ConfirmHoldsPayload(BaseModel):
    holds: List[HoldCreate]
    image_path: str

class RouteHoldCreate(BaseModel):
	# Specify fields and types (exclude anything that must be used for filtering)
	# leave route_id out
	hold_id: int
	role: Literal["start", "end", "foot", "any"]

class RouteWithHoldsCreate(BaseModel):
    route: RouteCreate
    holds_data: List[RouteHoldCreate]
    
class RouteHoldResponse(BaseModel):
	# Specify any fields in RouteHoldCreate + any created by the database
	id: int
	route_id: int
	hold_id: int
	role: str

	class Config:
		from_attributes = True

# For ascent and user statistics:
class AscentSummary(BaseModel):
    date: str  # "2026-03-04"
    route_name: str
    wall_name: str
    grade: str
    n_attempts: Optional[int] = None
    quality: Optional[int] = None
    suggested_grade: Optional[str] = None

class UserProfileResponse(BaseModel):
    username: str
    member_since: datetime
    ascents: List[AscentSummary]
    highest_flash_grade: Optional[str] = None
    highest_redpoint_grade: Optional[str] = None
    total_sends: int
