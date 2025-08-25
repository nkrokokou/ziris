from fastapi.testclient import TestClient

try:
    # Assuming the FastAPI app is defined as `app` in backend/main.py
    from backend.main import app
except Exception as e:
    # If import fails in CI due to PYTHONPATH, adjust path
    import sys
    from pathlib import Path
    repo_root = Path(__file__).resolve().parents[2]
    if str(repo_root) not in sys.path:
        sys.path.insert(0, str(repo_root))
    from backend.main import app  # type: ignore

client = TestClient(app)


def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json().get("status") == "healthy"
