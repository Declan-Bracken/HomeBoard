from db.models import Base
from db.database import engine
from routers import walls, routes
from fastapi import FastAPI

# Start App
app = FastAPI(title = "Home Board App")
# Create database tables
Base.metadata.create_all(engine)

@app.get("/")
def root():
    return {"message": "Home Board API is running."}

app.include_router(walls.router)
app.include_router(routes.router)
