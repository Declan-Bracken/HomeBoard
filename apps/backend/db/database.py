from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker
from db.models import Base
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")

engine = create_engine(DATABASE_URL)
# create database session
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# For fast API
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
