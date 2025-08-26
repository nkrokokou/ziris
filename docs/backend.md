# Backend Guide (FastAPI)

Location: `backend/`

## Requirements
- Python 3.11+
- See `backend/requirements.txt`

## Setup (Windows PowerShell)
```powershell
python -m venv backend/venv
./backend/venv/Scripts/Activate.ps1
pip install --upgrade pip
pip install -r backend/requirements.txt
```

## Run
```powershell
uvicorn backend.main:app --reload --port 8000
```
Health: `GET http://127.0.0.1:8000/health`

## Configuration
- `ZIRIS_SECRET`: HMAC secret for tokens (set in env for non-dev)

## Notable Endpoints
- `GET /` — service info
- `GET /health` — healthcheck
- `GET /dashboard/data` — aggregated dashboard data
- `GET /sensor/recommendations` — suggested actions based on thresholds
- `GET /thresholds` / `POST /thresholds` — get/set thresholds (admin for POST)
- `GET /thresholds/suggest` — statistical suggestion
- Auth: `/auth/login`, `/auth/register`, `/auth/refresh`, `/auth/logout`, `/auth/me`, `/auth/approve/{id}`, `/auth/reset/*`

## Auth
- Access tokens are HMAC JWT (header.payload.signature) with `HS256`.
- Refresh tokens stored in-memory (dev only). See `Security` for production guidance.

## DB & Migrations
- SQLAlchemy models in `backend/database.py`.
- Alembic in `backend/alembic/`.
- Initialize tables automatically via `init_db()` on startup; use Alembic for schema changes.

## Tests
- Place tests in `backend/tests/`.
- Run: `pytest -q backend/tests`

