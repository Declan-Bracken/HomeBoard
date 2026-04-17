# HomeBoard

A full-stack climbing wall management app. Upload a photo of your climbing wall, let ML detect the holds, build routes by selecting holds on an interactive canvas, and log your ascents.

## Features

- **ML Hold Detection** — Roboflow-powered tiled inference detects holds from wall photos with polygon-level precision
- **Interactive Canvas** — Multi-touch gesture support for panning, zooming, and selecting holds on mobile and desktop
- **Route Building** — Create and share routes by selecting detected holds; track sends and attempts
- **Wall Sharing** — Public and private walls with owner/member access control
- **Cloud Storage** — Wall images stored on Backblaze B2

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite, TanStack React Query, Canvas API |
| Backend | FastAPI, SQLAlchemy, Alembic, Pydantic |
| Database | PostgreSQL |
| ML | Roboflow Inference API |
| Storage | Backblaze B2 (S3-compatible) |
| Deploy | Railway (backend + DB), Vercel (frontend) |

## Project Structure

```
apps/
  frontend/   # React 19 + Vite SPA
  backend/    # FastAPI REST API
```

## Getting Started

### Backend

```bash
cd apps/backend
pip install -r requirements.txt

# Required environment variables:
# DATABASE_URL, SECRET_KEY, ROBOFLOW_API_KEY
# B2_KEY_ID, B2_APPLICATION_KEY, B2_BUCKET_NAME, B2_ENDPOINT_URL

alembic upgrade head
uvicorn main:app --reload   # http://localhost:8000
```

### Frontend

```bash
cd apps/frontend
npm install

# Required environment variable:
# VITE_API_URL=http://localhost:8000

npm run dev   # http://localhost:5173
```

## How It Works

1. **Upload** a photo of your climbing wall
2. **Detect** holds automatically via ML (Roboflow tiled inference)
3. **Confirm** the detected holds
4. **Build routes** by tapping/clicking holds on the canvas
5. **Log ascents** and track your progress
