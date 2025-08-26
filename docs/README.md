# Ziris Documentation

Welcome to the Ziris docs. Ziris is a full‑stack project with a FastAPI backend and a React (TypeScript) frontend.

- Backend path: `backend/`
- Frontend path: `frontend/zirist/`

Quick links:
- Architecture: `docs/architecture.md`
- Backend guide: `docs/backend.md`
- Frontend guide: `docs/frontend.md`
- API reference: `docs/api.md`
- DevOps & CI: `docs/devops.md`
- Security notes: `docs/security.md`
- Troubleshooting: `docs/troubleshooting.md`

## Quickstart (dev)
1. Backend
   - Run: `uvicorn backend.main:app --reload --port 8000`
   - Seed data with anomalies: `POST /dev/seed?n=800&contamination=0.35`
   - Set thresholds: `POST /thresholds` with `{ temp, press, vib, fumee }`
2. Frontend
   - In `frontend/zirist/`: `npm ci && npm start`
   - Dashboard loads LSTM metrics with rule `k2` (2-of-4) by default: `GET /lstm/metrics?rule=k2`

Notes:
- Thresholds are persisted in DB and used by `/lstm/metrics` to compute TP/FP/TN/FN.
- The `contamination` parameter controls the anomaly rate for seeded data (0..1).

