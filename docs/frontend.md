# Frontend Guide (React + TypeScript)

Location: `frontend/zirist/`

## Requirements
- Node.js 18+
- npm 10+

## Install & Run
```powershell
cd frontend/zirist
npm ci
npm start
```
Build:
```powershell
npm run build
```

## Scripts (`package.json`)
- `start`: CRA dev server
- `build`: production build
- `test`: CRA tests

## Notes
- CRA uses `CI=true` in GitHub Actions which treats warnings as errors. The workflow overrides this to avoid warning-only failures.

## Questionnaire (Survey)
- Operator page: `/operator/survey`
  - Submit ratings (1–5), frequency, notifications, and comments.
  - Calls `POST /survey/submit` with `{ payload: {/* answers */} }` and JWT auth.
- Admin stats page: `/admin/surveys`
  - Loads `GET /survey/stats` and renders charts (means per question, frequency distribution), plus totals.
  - Includes a button to seed 20 responses with 16 favorables via `POST /survey/seed?n=20&favorable_count=16`.
  - Requires admin role.

Auth: the Axios client attaches `Authorization: Bearer <token>` automatically from `localStorage.access_token`.
