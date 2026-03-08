from db.models import Base
from db.database import engine
from routers import walls, routes, holds, users, ascents, routeholds, image_ingestion, auth, search
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware


# Start App
app = FastAPI(title = "Home Board App")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "https://homeboard-dev.up.railway.app"],  # Vite's dev server
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
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
app.include_router(image_ingestion.router)
app.include_router(auth.router)
app.include_router(search.router)

