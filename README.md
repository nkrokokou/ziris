# Ziris

Full-stack project with a FastAPI backend and a React (TypeScript) frontend.

- Backend: `backend/`
- Frontend: `frontend/zirist/`

## Prerequisites
- Python 3.11+
- Node.js 18+
- PostgreSQL (for local dev)

## Backend — FastAPI

Create a virtual environment and install dependencies:

```powershell
# From repo root
python -m venv backend/venv
.\backend\.venv\Scripts\Activate.ps1  # or backend\venv\Scripts\activate.bat on cmd
# If you have a requirements file, install it; otherwise install directly from source as needed
pip install --upgrade pip
# Example (adjust to your needs):
# pip install fastapi uvicorn[standard] sqlalchemy psycopg2-binary alembic python-jose[cryptography] passlib[bcrypt]
```

Set environment/config as needed, then run:

```powershell
# From repo root
.\backend\venv\Scripts\python .\backend\main.py
# or using uvicorn if configured
# uvicorn backend.main:app --reload --port 8000
```

Health check:
```powershell
curl http://127.0.0.1:8000/health
```

Bootstrap demo users (optional):
```powershell
.\backend\venv\Scripts\python .\backend\bootstrap_users.py
```

## Frontend — React (TypeScript)

```powershell
cd .\frontend\zirist
npm ci
npm start
# Build
npm run build
```

The frontend dev server typically runs at http://localhost:9000

## Linting & Tests
- Frontend: `npm run lint` if configured.
- Backend: if you add tests under `backend/tests/`, you can run them with pytest. Add a `requirements.txt` including pytest for CI support.

## CI
GitHub Actions is configured in `.github/workflows/ci.yml` to:
- Build/lint the frontend
- Set up Python for the backend (runs tests if present)

## Git
This repo uses a single Git repository for both `backend/` and `frontend/zirist/`.

## License
Add your preferred license.
