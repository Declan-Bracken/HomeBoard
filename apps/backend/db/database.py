from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from .models import Base

DATABASE_URL = "insert url"

engine = create_engine(DATABASE_URL, connect_args={"check_same_thread":False})
# create database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# For fast API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
