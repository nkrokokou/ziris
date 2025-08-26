# Ziris

Ziris is a full‑stack project combining a FastAPI backend and a React (TypeScript) frontend.

- Backend: `backend/`
- Frontend: `frontend/zirist/`

## Documentation
See the full docs in `docs/`:
- `docs/architecture.md` — high-level architecture
- `docs/backend.md` — backend setup and usage
- `docs/frontend.md` — frontend setup and scripts
- `docs/api.md` — API reference and examples
- `docs/devops.md` — CI and operational notes
- `docs/security.md` — security considerations
- `docs/troubleshooting.md` — common issues and fixes

## Quick start
Backend (Windows PowerShell):
```powershell
python -m venv backend/venv
./backend/venv/Scripts/Activate.ps1
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```
Frontend:
```powershell
cd frontend/zirist
npm ci
npm start
```
