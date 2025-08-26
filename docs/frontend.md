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
