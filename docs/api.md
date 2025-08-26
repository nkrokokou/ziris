# API Reference (summary)

Base URL (dev): `http://127.0.0.1:8000`

- `GET /` → `{ status, service }`
- `GET /health` → `{ status }`
- `GET /dashboard/data` → `DashboardData`
- `GET /sensor/recommendations` → `Recommendation[]`
- `GET /thresholds` → `Thresholds`
- `POST /thresholds` (admin) → `Thresholds`
- `GET /thresholds/suggest` → `Thresholds`

Auth
- `POST /auth/login` → `TokenResponse { access_token, refresh_token }`
- `POST /auth/register`
- `POST /auth/refresh` → `TokenResponse`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/approve/{user_id}` (admin)
- `POST /auth/reset/request`
- `POST /auth/reset/confirm`

Example curl (login):
```bash
curl -X POST http://127.0.0.1:8000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"demo","password":"demo"}'
```

Use `Authorization: Bearer <token>` for protected endpoints.
