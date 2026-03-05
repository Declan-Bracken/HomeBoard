import enum
from typing import Optional, List
from datetime import datetime, timezone
from sqlalchemy import UniqueConstraint, ForeignKey, String, Integer, DateTime, Float, JSON, Enum
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Wall(Base):
    __tablename__ = "walls"
    __table_args__ = (
        UniqueConstraint("name", "created_by", name="uq_wall_creator"),
    )
    
    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    image_path: Mapped[str] = mapped_column(String, nullable=True)
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.username"), index = True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    holds: Mapped[List["Hold"]] = relationship("Hold", back_populates="wall", cascade="all, delete-orphan")
    routes: Mapped[List["Route"]] = relationship("Route", back_populates="wall", cascade="all, delete-orphan")
    user: Mapped["User"] = relationship("User", back_populates="created_walls") # wall only has one creator

# Likely want a wall versions table to store different hold configurations for the same wall without needing to register a new wall

# defines the set of optional grades a route can take on
class GradeEnum(str, enum.Enum):
    Unknown = "Unknown"
    V0 = "V0"
    V1 = "V1"
    V2 = "V2"
    V3 = "V3"
    V4 = "V4"
    V5 = "V5"
    V6 = "V6"
    V7 = "V7"
    V8 = "V8"
    V9 = "V9"
    V10 = "V10"
    V11 = "V11"
    V12 = "V12"
    V15 = "V15"
    V16 = "V16"
    V17 = "V17"

class Route(Base):
    __tablename__ = "routes"
    __table_args__ = (
        UniqueConstraint("wall_id", "name", name="uq_route_wall_name"),
    )

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_id: Mapped[int] = mapped_column(Integer, ForeignKey("walls.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[GradeEnum] = mapped_column(Enum(GradeEnum), nullable=True, default = "Unknown")
    created_by: Mapped[str] = mapped_column(String, ForeignKey("users.username"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))
    description: Mapped[Optional[str]] = mapped_column(String, nullable = True)
    ascent_count: Mapped[int] = mapped_column(Integer, nullable = False, default = 0, server_default="0")

    # Relations
    wall: Mapped["Wall"] = relationship("Wall", back_populates="routes")
    hold_associations: Mapped[List["RouteHolds"]] = relationship("RouteHolds", back_populates="route", cascade="all, delete-orphan") # Delte hold associations if route is deleted
    ascents: Mapped[List["Ascent"]] = relationship("Ascent", back_populates="route", cascade="all, delete-orphan") # Delte ascents if route is deleted
    creator: Mapped["User"] = relationship("User", back_populates="created_routes")

class Hold(Base):
    __tablename__ = "holds"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_id: Mapped[int] = mapped_column(Integer, ForeignKey("walls.id"), index=True)
    # Derived from model segmentation
    x_min: Mapped[int] = mapped_column(Integer)
    x_max: Mapped[int] = mapped_column(Integer)
    y_min: Mapped[int] = mapped_column(Integer)
    y_max: Mapped[int] = mapped_column(Integer)
    x_center: Mapped[int] = mapped_column(Integer)
    y_center: Mapped[int] = mapped_column(Integer)
    confidence: Mapped[float] = mapped_column(Float, nullable=True)
    polygon: Mapped[list] = mapped_column(JSON, nullable=True)
    
    # Relations
    wall: Mapped["Wall"] = relationship("Wall", back_populates="holds")
    route_associations: Mapped[List["RouteHolds"]] = relationship("RouteHolds", 
                                                                  back_populates="hold",
                                                                  cascade="all, delete-orphan")

# Defines set of values that a hold's role can take on
class HoldRoleEnum(str, enum.Enum):
    start = "start"
    end = "end"
    foot = "foot"
    any = "any"

class RouteHolds(Base):
    # Used to store which routes utilize which holds. So if a route has 8 holds on it, that will be stored as 8 different rows in this table.
    __tablename__ = "routeholds"
    __table_args__ = (
        UniqueConstraint("route_id", "hold_id", name="uq_route_hold"),
    )

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), index=True, nullable=False)
    hold_id: Mapped[int] = mapped_column(Integer, ForeignKey("holds.id"), index=True, nullable=False)
    role: Mapped[HoldRoleEnum] = mapped_column(Enum(HoldRoleEnum), nullable=False)

    # Relations
    route: Mapped["Route"] = relationship("Route", back_populates="hold_associations")
    hold: Mapped["Hold"] = relationship("Hold", back_populates="route_associations")

class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        UniqueConstraint("username", name="uq_username"),
    )
    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    email: Mapped[str] = mapped_column(String, nullable=False, unique=True)
    hashed_password: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    ascents: Mapped[List["Ascent"]] = relationship('Ascent', back_populates='users')
    created_walls: Mapped[List["Wall"]] = relationship("Wall", back_populates='user')
    created_routes: Mapped[List["Route"]] = relationship("Route", back_populates='creator')

class Ascent(Base):
    __tablename__ = "ascents"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), index=True)
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"), index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))
    quality: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)  # 1-5
    suggested_grade: Mapped[Optional[GradeEnum]] = mapped_column(Enum(GradeEnum), nullable=True)
    n_attempts: Mapped[Optional[int]] = mapped_column(Integer, nullable = True)
    notes: Mapped[Optional[str]] = mapped_column(String, nullable = True)
    
    # Relations
    users: Mapped["User"] = relationship('User', back_populates="ascents")
    route: Mapped["Route"] = relationship('Route', back_populates="ascents")

