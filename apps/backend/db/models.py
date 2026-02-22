from typing import List
from typing import Optional
from datetime import datetime, timezone
from sqlalchemy import ForeignKey, String, Integer, DateTime
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

class Base(DeclarativeBase):
    pass

class Wall(Base):
    __tablename__ = "walls"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    image_url: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    holds: Mapped[List["Hold"]] = relationship("Hold", back_populates="wall")
    routes: Mapped[List["Route"]] = relationship("Route", backpopulates="wall")

class Route(Base):
    __tablename__ = "routes"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_id: Mapped[int] = mapped_column(Integer, ForeignKey("walls.id"))
    name: Mapped[str] = mapped_column(String, nullable=False)
    grade: Mapped[str] = mapped_column(String)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    wall: Mapped["Wall"] = relationship("Wall", back_populates="routes")
    route_holds: Mapped[List["RouteHolds"]] = relationship("RouteHolds", back_populates="routes")
    ascents: Mapped[List["Ascent"]] = relationship("Ascent", backpopulates="route")

class Hold(Base):
    __tablename__ = "holds"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    wall_id: Mapped[int] = mapped_column(Integer, ForeignKey("walls.id"))
    
    # Relations
    wall: Mapped["Wall"] = relationship("Wall", back_populates="holds")
    route_holds: Mapped[List["RouteHolds"]] = relationship("RouteHolds", back_populates="holds")

class RouteHolds(Base):
    # Used to store which routes utilize which holds. So if a route has 8 holds on it, that will be stored as 8 different rows in this table.
    __tablename__ = "routeholds"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"), nullable=False)
    hold_id: Mapped[int] = mapped_column(Integer, ForeignKey("holds.id"), nullable=False)
    role: Mapped[str] = mapped_column(String, nullable=False)

    # Relations
    routes: Mapped["Route"] = relationship("Route", back_populates="route_holds")
    holds: Mapped["Hold"] = relationship("Hold", back_populates="route_holds")

class User(Base):
    __tablename__ = "users"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    username: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    ascents: Mapped[List["Ascent"]] = relationship('Ascent', back_populates='users')

class Ascent(Base):
    __tablename__ = "ascents"

    # Columns
    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    route_id: Mapped[int] = mapped_column(Integer, ForeignKey("routes.id"))
    user_id: Mapped[int] = mapped_column(Integer, ForeignKey("users.id"))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.now(timezone.utc))

    # Relations
    users: Mapped["User"] = relationship('User', back_populates="ascents")
    route: Mapped["Route"] = relationship('Route', back_populates="ascents")

