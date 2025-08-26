# Security Notes

- Tokens: HMAC JWT in-process. For production, prefer a well-tested library and rotate secrets.
- Passwords: bcrypt is preferred; code falls back to SHA-256 if missing (do not use fallback in prod). Ensure `passlib[bcrypt]` or `bcrypt` installed.
- Refresh tokens: stored in-memory → use DB/Redis in production;
- Rate limiting: basic in-memory; replace with a robust solution (Redis + sliding window) for prod.
- CORS: limited to local dev origins in `backend/main.py`. Adjust for production domains.
- Secrets: use environment variables or a secret manager; never commit secrets.
