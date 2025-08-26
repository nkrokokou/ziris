# Troubleshooting

## Frontend
- `npm ci` fails: ensure `package-lock.json` exists and Node 18+. Try `npm install --legacy-peer-deps` locally and commit the lockfile.
- Build fails on CI with warnings: CI sets `CI=false` during build in the workflow.

## Backend
- `bcrypt` missing: install `passlib[bcrypt]` or `bcrypt`.
- DB issues: verify connection config if you add a real DB. `init_db()` creates tables for dev.

## CI/Submodule
- If `frontend/zirist` shows as a submodule with no `.gitmodules`: either add the submodule URL or convert to a regular folder and commit files.
