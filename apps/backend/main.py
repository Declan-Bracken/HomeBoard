from db.models import Base
from db.database import engine
from routers import walls
from fastapi import FastAPI

# Start App
app = FastAPI(title = "Home Board App")
# Create database tables
Base.metadata.create_all(engine)

app.include_router(walls.router)
