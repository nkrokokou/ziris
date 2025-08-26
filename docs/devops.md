# DevOps & CI

Workflow: `.github/workflows/ci.yml`

Jobs:
- __frontend__
  - Node 18, diagnostics
  - Conditional npm steps if `package.json` exists
  - `npm ci` with robust fallbacks
  - Lint if configured
  - Build with `CI=false`
- __backend__
  - Python 3.11
  - Installs from `backend/requirements.txt` if present
  - Runs tests in `backend/tests/` if present

Manual run: workflow_dispatch enabled.
Concurrency: cancels in-progress runs per ref.
