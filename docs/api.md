# API Reference (summary)

Base URL (dev): `http://127.0.0.1:8000`

- `GET /` → `{ status, service }`
- `GET /health` → `{ status }`
- `GET /dashboard/data` → `DashboardData`
- `GET /sensor/recommendations` → `Recommendation[]`
- `GET /thresholds` → `Thresholds`
- `POST /thresholds` (admin) → `Thresholds`
- `GET /thresholds/suggest` → `Thresholds`
- `POST /dev/seed?n=<int>&contamination=<float>` (user/admin) → `{ inserted }`
  - `n` default 50. `contamination` default 0.1 (0..1). Controls anomaly rate.
- `GET /lstm/metrics?rule=<any|k2|k3|k4>` (user/admin) → `LSTMMetrics`
  - `rule` default `any` (1-of-4). `k2` requires ≥2 metrics above threshold, etc.
- `POST /sensor-data/ingest` (admin) — bulk ingest of rows with optional `anomaly` flags.

Survey (Questionnaire)
- `POST /survey/submit` (user/admin) → `{ status: "ok" }`
  - Body: `{ payload: { /* answers */ } }` where answers contain numeric ratings (1..5), a frequency field, etc.
- `GET /survey/stats` (admin) → `{ total, favorable, by_question_mean, by_question_std, freq_distribution }`
- `POST /survey/seed?n=<int>&favorable_count=<int>` (admin) → `{ inserted, favorable }`

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

Examples (PowerShell)
```powershell
# Seed 800 rows, 35% anomalies
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/dev/seed?n=800&contamination=0.35" -Headers @{Authorization='Bearer <token>'}

# Get LSTM metrics with 2-of-4 rule
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/lstm/metrics?rule=k2" -Headers @{Authorization='Bearer <token>'}

# Submit a survey response (as operator)
$body = @{ payload = @{ global_satisfaction = 5; tech_issues_frequency = 'Rarement'; ease_of_use = 5 } } | ConvertTo-Json -Depth 5
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/survey/submit" -Headers @{Authorization='Bearer <token>'; 'Content-Type'='application/json'} -Body $body

# Get survey stats (admin)
Invoke-RestMethod -Method Get -Uri "http://127.0.0.1:8000/survey/stats" -Headers @{Authorization='Bearer <token>'}

# Seed 20 surveys with 16 favorable (admin)
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/survey/seed?n=20&favorable_count=16" -Headers @{Authorization='Bearer <token>'}
```
