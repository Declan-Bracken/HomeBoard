# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

HomeBoard is a full-stack climbing wall management app. Users create walls (with ML-detected holds from photos), define routes by selecting holds, and log ascents. The core interactive UX is a canvas-based hold visualization with multi-touch gesture support.

## Commands

### Frontend (`apps/frontend`)
```bash
npm run dev      # Dev server at localhost:5173
npm run build    # Production build
npm run lint     # ESLint
```

### Backend (`apps/backend`)
```bash
uvicorn main:app --reload          # Dev server at localhost:8000
alembic upgrade head               # Apply DB migrations
alembic revision --autogenerate -m "description"  # Generate migration
```

### Backend environment variables required
`DATABASE_URL`, `SECRET_KEY`, `ROBOFLOW_API_KEY`, `B2_KEY_ID`, `B2_APPLICATION_KEY`, `B2_BUCKET_NAME`, `B2_ENDPOINT_URL`

### Frontend environment variable
`VITE_API_URL` — backend base URL

## Architecture

### Monorepo layout
```
apps/
  frontend/   # React 19 + Vite SPA
  backend/    # FastAPI + SQLAlchemy REST API
```

### Backend structure
- **`main.py`** — FastAPI app init, CORS config, router registration
- **`routers/`** — Thin HTTP layer; each file maps to a resource (walls, routes, ascents, holds, users, auth, search, routerelations, image_ingestion)
- **`services/`** — All business logic lives here; routers call service functions
- **`db/models.py`** — SQLAlchemy ORM (8 tables: User, Wall, Route, Hold, RouteHolds, Ascent, WallMember, UserRouteRelation)
- **`db/schemas.py`** — Pydantic request/response models
- **`core/security.py`** — Password hashing (SHA256 + bcrypt) and JWT creation/validation
- **`core/dependencies.py`** — OAuth2 FastAPI dependency for protected routes
- **`ml/segmentation.py`** — Roboflow SDK integration for hold detection
- **`storage/image_storage.py`** — Backblaze B2 via S3-compatible API

### Frontend structure
- **`App.jsx`** — Route definitions and JWT-based auth guards
- **`main.jsx`** — React Query provider setup
- **`api/axios.js`** — Axios instance; adds JWT from localStorage, redirects 401s to `/auth`
- **`pages/`** — One file per route (`WallPage`, `WallDetailPage`, `RouteCreatePage`, `RouteDetailPage`, `HomePage`, `ProfilePage`, `AuthPage`)
- **`components/HoldCanvas.jsx`** — Core interactive canvas for hold visualization, drawing, and selection. Most of the multi-touch gesture logic lives here.

### Data flow
1. React pages use TanStack React Query (`useQuery`/`useMutation`) for all server state
2. Queries go through the Axios instance which injects the JWT
3. FastAPI routes validate the token via `get_current_user` dependency, then delegate to service functions
4. Services interact with the DB via SQLAlchemy sessions and call external APIs (Roboflow, B2) as needed

### Access control model
- **Wall privacy**: `Private` (owner + invited members only) or `Public` (world-readable)
- **Roles**: `owner` vs `member` on the `WallMember` join table
- Access checks are centralized in `services/control_helpers.py`
- Routes and holds inherit wall access; only owners can create/edit routes

### ML hold detection flow
1. User uploads wall image → stored in Backblaze B2 (`image_ingestion` router)
2. Backend calls Roboflow inference API → returns bounding boxes and polygons for detected holds
3. Frontend previews holds overlaid on the image
4. User confirms → holds saved to the `holds` table with coordinates

### Deployment
- Backend: Docker container on Railway; `procfile` uses `uvicorn` with `--proxy-headers`
- Frontend: Vercel (Railway and Vercel origins are CORS-whitelisted in `main.py`)
- Database: PostgreSQL on Railway
