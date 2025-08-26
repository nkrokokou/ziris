# Architecture

- Web frontend: React + TypeScript (Create React App) in `frontend/zirist/`.
- Backend API: FastAPI app in `backend/main.py`, using SQLAlchemy and Alembic.
- Database: SQLAlchemy models with Alembic migrations (RDBMS-agnostic; `psycopg2-binary` suggests PostgreSQL in dev).
- Auth: Lightweight HMAC JWT in `backend/main.py` with refresh tokens (dev-grade, see Security).
- Observability: Minimal health and audit logging in DB via `AuditLog` model.

Data flow:
- The frontend calls the backend API (e.g., `/dashboard/data`, `/thresholds`, `/sensor/recommendations`).
- Backend aggregates from `SensorData` and returns typed responses with Pydantic models.
- Thresholds are configurable via `/thresholds` and used for recommendations.

Key modules (backend):
- `backend/main.py`: FastAPI app, routes, auth, thresholds, jobs.
- `backend/database.py`: session, models (`SensorData`, `User`, `Threshold`, etc.), `init_db()`.
- `backend/alembic/`: migrations.

