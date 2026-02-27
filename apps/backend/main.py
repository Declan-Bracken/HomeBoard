from db.models import Base
from db.database import engine
from routers import walls, routes, holds, users, ascents, routeholds
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
app.include_router(holds.router)
app.include_router(users.router)
app.include_router(ascents.router)
app.include_router(routeholds.router)
