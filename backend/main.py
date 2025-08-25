 

from fastapi import FastAPI, Depends, HTTPException, status, Header, Path, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi import WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Dict, List, Optional, Any
from datetime import datetime, timedelta
import hmac, hashlib, base64, json, os
import threading, time, uuid
import secrets

from .database import SessionLocal, init_db, SensorData, User, Threshold, ThresholdHistory, Suggestion, AuditLog

app = FastAPI(title="Ziris Backend", version="0.1.0")

# Allow local frontend during dev (adjust origins as needed)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5173",
        "http://localhost:5173",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
        "http://127.0.0.1:9000",
        "http://localhost:9000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def log_action(db: Session, action: str, user_id: Optional[int] = None, details: Optional[dict] = None) -> None:
    try:
        entry = AuditLog(
            user_id=user_id,
            action=action,
            details=json.dumps(details or {}, ensure_ascii=False),
            ts=datetime.utcnow(),
        )
        db.add(entry)
        db.commit()
    except Exception:
        db.rollback()


@app.on_event("startup")
def on_startup():
    # Ensure tables exist
    init_db()
    # Ensure default users exist for dev login
    db = SessionLocal()
    try:
        # helper hashing
        def _hash(pw: str) -> str:
            # Prefer bcrypt if available
            try:
                from bcrypt import gensalt  # type: ignore
                return hash_password(pw)
            except Exception:
                return hashlib.sha256((pw or "").encode("utf-8")).hexdigest()

        demo = db.query(User).filter(User.username == "demo").first()
        if not demo:
            demo = User(username="demo", hashed_password=_hash("demo"), role="user", is_active=True)
            db.add(demo)

        admin = db.query(User).filter(User.username == "admin").first()
        if not admin:
            admin = User(username="admin", hashed_password=_hash("admin"), role="admin", is_active=True)
            db.add(admin)
        db.commit()
    finally:
        db.close()


@app.get("/")
def read_root():
    return {"status": "ok", "service": "ziris-backend"}


@app.get("/health")
def health():
    return {"status": "healthy"}


@app.get("/sensor-data")
def list_sensor_data(db: Session = Depends(get_db)):
    rows = db.query(SensorData).order_by(SensorData.id.desc()).limit(100).all()
    return [
        {
            "id": r.id,
            "timestamp": r.timestamp.isoformat() if r.timestamp else None,
            "zone": r.zone,
            "temperature": r.temperature,
            "pression": r.pression,
            "vibration": r.vibration,
            "fumee": r.fumee,
            "flamme": r.flamme,
            "anomaly": r.anomaly,
        }
        for r in rows
    ]


# ----------------------
# Auth & RBAC utilities (HMAC-JWT minimal) + security enhancements
# ----------------------

SECRET_KEY = os.getenv("ZIRIS_SECRET", "change-this-secret-key")
ALG = "HS256"

# In-memory stores (dev-grade). For production, persist in DB/Redis.
FAILED_LOGINS: Dict[str, Dict[str, int]] = {}
RATE_BUCKETS: Dict[str, List[float]] = {}
REFRESH_TOKENS: Dict[str, Dict[str, Optional[datetime]]] = {}  # user_id -> {token: expires_at}
BLACKLISTED_REFRESH: set[str] = set()
RESET_TOKENS: Dict[str, Dict[str, Any]] = {}  # token -> {user_id, expires_at}

# Bcrypt hashing helpers
try:
    import bcrypt  # type: ignore

    def hash_password(pw: str) -> str:
        salt = bcrypt.gensalt(rounds=12)
        return bcrypt.hashpw(pw.encode("utf-8"), salt).decode("utf-8")

    def verify_password(pw: str, hashed: str) -> bool:
        try:
            return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
        except Exception:
            return False
except Exception:
    bcrypt = None  # type: ignore

    def hash_password(_pw: str) -> str:
        # Fallback to SHA-256 with clear error to install bcrypt
        # This keeps the app running but is not recommended.
        return hashlib.sha256((_pw or "").encode("utf-8")).hexdigest()

    def verify_password(pw: str, hashed: str) -> bool:
        return hashlib.sha256(pw.encode("utf-8")).hexdigest() == hashed

def _b64url_encode(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")

def _b64url_decode(data: str) -> bytes:
    padding = '=' * (-len(data) % 4)
    return base64.urlsafe_b64decode(data + padding)

def create_token(payload: dict, exp_minutes: int = 60) -> str:
    header = {"typ": "JWT", "alg": ALG}
    to_sign = payload.copy()
    to_sign["exp"] = int((datetime.utcnow() + timedelta(minutes=exp_minutes)).timestamp())
    header_b64 = _b64url_encode(json.dumps(header, separators=(',', ':')).encode('utf-8'))
    payload_b64 = _b64url_encode(json.dumps(to_sign, separators=(',', ':')).encode('utf-8'))
    signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
    sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
    sig_b64 = _b64url_encode(sig)
    return f"{header_b64}.{payload_b64}.{sig_b64}"

def decode_token(token: str) -> dict:
    try:
        header_b64, payload_b64, sig_b64 = token.split('.')
        signing_input = f"{header_b64}.{payload_b64}".encode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), signing_input, hashlib.sha256).digest()
        if not hmac.compare_digest(expected_sig, _b64url_decode(sig_b64)):
            raise ValueError("Invalid signature")
        payload = json.loads(_b64url_decode(payload_b64).decode('utf-8'))
        if int(payload.get('exp', 0)) < int(datetime.utcnow().timestamp()):
            raise ValueError("Token expired")
        return payload
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")


# --- Simple rate limiting for auth endpoints (dev) ---
def _rate_limit(key: str, max_hits: int, per_seconds: int) -> None:
    now = datetime.utcnow().timestamp()
    window_start = now - per_seconds
    hits = RATE_BUCKETS.setdefault(key, [])
    # drop old
    RATE_BUCKETS[key] = [t for t in hits if t >= window_start]
    if len(RATE_BUCKETS[key]) >= max_hits:
        raise HTTPException(status_code=429, detail="Too many requests")
    RATE_BUCKETS[key].append(now)


def get_current_user(authorization: Optional[str] = Header(default=None), db: Session = Depends(get_db)) -> User:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not authenticated")
    token = authorization.split(" ", 1)[1]
    # Back-compat for legacy dummy tokens
    if token.startswith("dummy-"):
        username = token.split("-", 1)[1]
        user = db.query(User).filter(User.username == username).first()
        if not user or not user.is_active:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")
        return user
    payload = decode_token(token)
    uid = payload.get("sub")
    user = db.query(User).filter(User.id == uid).first()
    if not user or not user.is_active:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Inactive or unknown user")
    return user


def require_role(*roles: str):
    def _dep(user: User = Depends(get_current_user)) -> User:
        if roles and user.role not in roles:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Forbidden")
        return user
    return _dep


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    refresh_token: Optional[str] = None


class LoginPayload(BaseModel):
    username: str
    password: str


class RegisterPayload(BaseModel):
    username: str
    password: str


class RefreshPayload(BaseModel):
    refresh_token: str


class ResetRequestPayload(BaseModel):
    username: str


class ResetConfirmPayload(BaseModel):
    token: str
    new_password: str


@app.post("/auth/login", response_model=TokenResponse)
def login(payload: LoginPayload, db: Session = Depends(get_db), x_forwarded_for: Optional[str] = Header(default=None)):
    # rate limit by username and IP (basic)
    ip = (x_forwarded_for or "").split(",")[0].strip() or "unknown"
    _rate_limit(f"login:{ip}", max_hits=10, per_seconds=60)
    _rate_limit(f"login-user:{payload.username}", max_hits=10, per_seconds=60)
    u = db.query(User).filter(User.username == payload.username).first()
    if not u:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if not verify_password(payload.password, u.hashed_password):
        # Backward-compat: allow legacy SHA-256 hashes and upgrade to bcrypt
        legacy = hashlib.sha256(payload.password.encode('utf-8')).hexdigest()
        if legacy != u.hashed_password:
            raise HTTPException(status_code=401, detail="Invalid credentials")
        # If bcrypt available, upgrade the stored hash
        try:
            if bcrypt is not None:
                u.hashed_password = hash_password(payload.password)
                db.commit()
        except Exception:
            pass
    if not u.is_active:
        raise HTTPException(status_code=403, detail="Account pending approval")
    token = create_token({"sub": u.id, "username": u.username, "role": u.role}, exp_minutes=120)
    # issue refresh token (14 days)
    rtoken = secrets.token_urlsafe(48)
    expires = datetime.utcnow() + timedelta(days=14)
    store = REFRESH_TOKENS.setdefault(str(u.id), {})
    store[rtoken] = expires
    u.last_login_at = datetime.utcnow()
    db.commit()
    try:
        log_action(db, "login", user_id=u.id, details={"username": u.username})
    except Exception:
        pass
    return TokenResponse(access_token=token, refresh_token=rtoken)


@app.post("/auth/register")
def register(payload: RegisterPayload, db: Session = Depends(get_db), x_forwarded_for: Optional[str] = Header(default=None)):
    ip = (x_forwarded_for or "").split(",")[0].strip() or "unknown"
    _rate_limit(f"register:{ip}", max_hits=5, per_seconds=60)
    if not payload.username or not payload.password:
        raise HTTPException(status_code=400, detail="Missing username or password")
    exists = db.query(User).filter(User.username == payload.username).first()
    if exists:
        raise HTTPException(status_code=400, detail="Username already exists")
    # Require bcrypt for secure hashing
    if bcrypt is None:
        raise HTTPException(status_code=500, detail="bcrypt not installed on server. Please install 'bcrypt' package.")
    user = User(username=payload.username, hashed_password=hash_password(payload.password), role="user", is_active=False)
    db.add(user)
    db.commit()
    try:
        log_action(db, "register", user_id=user.id, details={"username": user.username})
    except Exception:
        pass
    return {"status": "pending_approval"}


@app.post("/auth/refresh", response_model=TokenResponse)
def refresh(payload: RefreshPayload, db: Session = Depends(get_db)):
    # find refresh token owner
    token = payload.refresh_token
    if token in BLACKLISTED_REFRESH:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    owner_id: Optional[str] = None
    for uid, tokens in REFRESH_TOKENS.items():
        if token in tokens:
            owner_id = uid
            exp = tokens[token]
            if exp and exp < datetime.utcnow():
                BLACKLISTED_REFRESH.add(token)
                del tokens[token]
                raise HTTPException(status_code=401, detail="Refresh token expired")
            break
    if not owner_id:
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    u = db.query(User).filter(User.id == int(owner_id)).first()
    if not u or not u.is_active:
        raise HTTPException(status_code=401, detail="User inactive")
    # rotate: blacklist old, issue new refresh
    BLACKLISTED_REFRESH.add(token)
    del REFRESH_TOKENS[owner_id][token]
    new_refresh = secrets.token_urlsafe(48)
    REFRESH_TOKENS.setdefault(owner_id, {})[new_refresh] = datetime.utcnow() + timedelta(days=14)
    # new access
    access = create_token({"sub": u.id, "username": u.username, "role": u.role}, exp_minutes=120)
    try:
        log_action(db, "refresh", user_id=u.id, details={})
    except Exception:
        pass
    return TokenResponse(access_token=access, refresh_token=new_refresh)


@app.post("/auth/logout")
def logout(payload: RefreshPayload):
    tok = payload.refresh_token
    # blacklist and remove from store
    BLACKLISTED_REFRESH.add(tok)
    for uid, tokens in list(REFRESH_TOKENS.items()):
        if tok in tokens:
            del tokens[tok]
            if not tokens:
                del REFRESH_TOKENS[uid]
            break
    return {"status": "logged_out"}


@app.post("/auth/reset/request")
def reset_request(payload: ResetRequestPayload, db: Session = Depends(get_db)):
    u = db.query(User).filter(User.username == payload.username).first()
    # Always respond ok to avoid username probing
    if u:
        token = secrets.token_urlsafe(48)
        RESET_TOKENS[token] = {"user_id": u.id, "expires_at": datetime.utcnow() + timedelta(hours=2)}
        try:
            log_action(db, "reset_request", user_id=u.id, details={})
        except Exception:
            pass
        # In production, email the token link to the user.
    return {"status": "ok"}


@app.post("/auth/reset/confirm")
def reset_confirm(payload: ResetConfirmPayload, db: Session = Depends(get_db)):
    rec = RESET_TOKENS.get(payload.token)
    if not rec:
        raise HTTPException(status_code=400, detail="Invalid token")
    if rec["expires_at"] < datetime.utcnow():
        del RESET_TOKENS[payload.token]
        raise HTTPException(status_code=400, detail="Token expired")
    u = db.query(User).filter(User.id == rec["user_id"]).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    if bcrypt is None:
        raise HTTPException(status_code=500, detail="bcrypt not installed on server. Please install 'bcrypt' package.")
    u.hashed_password = hash_password(payload.new_password)
    db.commit()
    try:
        log_action(db, "reset_confirm", user_id=u.id, details={})
    except Exception:
        pass
    # Invalidate all refresh tokens for the user
    uid = str(u.id)
    for t in list(REFRESH_TOKENS.get(uid, {}).keys()):
        BLACKLISTED_REFRESH.add(t)
    REFRESH_TOKENS[uid] = {}
    # cleanup token
    del RESET_TOKENS[payload.token]
    return {"status": "password_updated"}


@app.get("/auth/me")
def me(user: User = Depends(get_current_user)):
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


@app.post("/auth/approve/{user_id}")
def approve_user(user_id: int = Path(..., gt=0), _: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    u = db.query(User).filter(User.id == user_id).first()
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    u.is_active = True
    db.commit()
    try:
        log_action(db, "approve_user", user_id=u.id, details={"approved_user_id": u.id})
    except Exception:
        pass
    return {"status": "approved"}


# ----------------------
# Dynamic thresholds (in-memory)
# ----------------------

class Thresholds(BaseModel):
    temp: float
    press: float
    vib: float
    fumee: float


# Defaults (align with previous hard-coded values)
DEFAULT_THRESHOLDS: Thresholds = Thresholds(temp=80.0, press=8.0, vib=15.0, fumee=200.0)
CURRENT_THRESHOLDS: Thresholds = Thresholds(**DEFAULT_THRESHOLDS.dict())


@app.get("/thresholds", response_model=Thresholds)
def get_thresholds(user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):
    row = db.query(Threshold).order_by(Threshold.id.asc()).first()
    if row:
        return Thresholds(temp=row.temp or 0.0, press=row.press or 0.0, vib=row.vib or 0.0, fumee=row.fumee or 0.0)
    # fallback to defaults
    return CURRENT_THRESHOLDS


@app.post("/thresholds", response_model=Thresholds)
def set_thresholds(payload: Thresholds, user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    # clamp to non-negative
    temp = max(0.0, float(payload.temp))
    press = max(0.0, float(payload.press))
    vib = max(0.0, float(payload.vib))
    fumee = max(0.0, float(payload.fumee))

    row = db.query(Threshold).order_by(Threshold.id.asc()).first()
    if not row:
        row = Threshold(temp=temp, press=press, vib=vib, fumee=fumee, updated_at=datetime.utcnow())
        db.add(row)
    else:
        row.temp = temp
        row.press = press
        row.vib = vib
        row.fumee = fumee
        row.updated_at = datetime.utcnow()
    # history
    db.add(ThresholdHistory(temp=temp, press=press, vib=vib, fumee=fumee, changed_at=datetime.utcnow()))
    db.commit()
    try:
        log_action(db, "set_thresholds", user_id=user.id, details={"temp": temp, "press": press, "vib": vib, "fumee": fumee})
    except Exception:
        pass
    return Thresholds(temp=temp, press=press, vib=vib, fumee=fumee)


@app.get("/thresholds/suggest", response_model=Thresholds)
def suggest_thresholds(user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):
    """Suggests thresholds based on mean + 2*std of recent data."""
    rows = db.query(SensorData).order_by(SensorData.timestamp.desc()).limit(500).all()
    import math

    def stats(values: List[float]) -> float:
        vals = [float(v) for v in values if v is not None]
        if not vals:
            return 0.0
        n = len(vals)
        mean = sum(vals) / n
        var = sum((x - mean) ** 2 for x in vals) / max(n, 1)
        std = math.sqrt(var)
        return max(0.0, mean + 2.0 * std)

    sugg = Thresholds(
        temp=stats([r.temperature or 0.0 for r in rows]),
        press=stats([r.pression or 0.0 for r in rows]),
        vib=stats([r.vibration or 0.0 for r in rows]),
        fumee=stats([r.fumee or 0.0 for r in rows]),
    )
    return sugg

# ----------------------
# Dashboard data schema
# ----------------------

class ZoneData(BaseModel):
    total: int
    anomalies: int
    temp: float
    press: float
    vib: float
    fumee: float


class DashboardData(BaseModel):
    total_sensors: int
    anomalies: int
    zones: Dict[str, ZoneData]
    last_update: Optional[str] = None


@app.get("/dashboard/data", response_model=DashboardData)
def get_dashboard_data(user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):

    # Aggregate data
    rows = db.query(SensorData).all()
    total = len(rows)
    anomalies = sum(1 for r in rows if r.anomaly)
    zones: Dict[str, ZoneData] = {}
    latest_ts: Optional[datetime] = None

    from collections import defaultdict

    agg = defaultdict(lambda: {"count": 0, "anoms": 0, "temp": 0.0, "press": 0.0, "vib": 0.0, "fumee": 0.0})
    for r in rows:
        z = r.zone or "Unknown"
        agg[z]["count"] += 1
        agg[z]["anoms"] += 1 if r.anomaly else 0
        agg[z]["temp"] += float(r.temperature or 0.0)
        agg[z]["press"] += float(r.pression or 0.0)
        agg[z]["vib"] += float(r.vibration or 0.0)
        agg[z]["fumee"] += float(r.fumee or 0.0)
        if r.timestamp and (latest_ts is None or r.timestamp > latest_ts):
            latest_ts = r.timestamp

    for z, a in agg.items():
        c = max(a["count"], 1)
        zones[z] = ZoneData(
            total=a["count"],
            anomalies=a["anoms"],
            temp=a["temp"]/c,
            press=a["press"]/c,
            vib=a["vib"]/c,
            fumee=a["fumee"]/c,
        )

    return DashboardData(
        total_sensors=total,
        anomalies=anomalies,
        zones=zones,
        last_update=latest_ts.isoformat() if latest_ts else None,
    )


# ----------------------
# Recommendations
# ----------------------

class Recommendation(BaseModel):
    id: int
    zone: str
    risk_area: str
    timestamp: str
    reasons: List[str]
    priority: str
    recommendation: str


@app.get("/sensor/recommendations", response_model=List[Recommendation])
def get_recommendations(user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):
    # load thresholds from DB or defaults
    thr_row = db.query(Threshold).order_by(Threshold.id.asc()).first()
    thr = Thresholds(
        temp=(thr_row.temp if thr_row else CURRENT_THRESHOLDS.temp),
        press=(thr_row.press if thr_row else CURRENT_THRESHOLDS.press),
        vib=(thr_row.vib if thr_row else CURRENT_THRESHOLDS.vib),
        fumee=(thr_row.fumee if thr_row else CURRENT_THRESHOLDS.fumee),
    )
    rows = db.query(SensorData).order_by(SensorData.timestamp.desc()).limit(50).all()
    recs: List[Recommendation] = []
    for r in rows:
        reasons: List[str] = []
        priority = "normale"
        # Use dynamic thresholds (DB-backed)
        if (r.temperature or 0) > thr.temp:
            reasons.append("Température élevée")
        if (r.pression or 0) > thr.press:
            reasons.append("Pression élevée")
        if (r.vibration or 0) > thr.vib:
            reasons.append("Vibration élevée")
        if (r.fumee or 0) > thr.fumee:
            reasons.append("Fumée élevée")
        if r.flamme:
            reasons.append("Présence de flamme")
        if r.anomaly:
            reasons.append("Anomalie détectée")

        if any(k in reasons for k in ["Présence de flamme"]):
            priority = "critique"
        elif any(k in reasons for k in ["Température élevée", "Pression élevée", "Vibration élevée", "Fumée élevée"]):
            priority = "élevée"

        if reasons:
            recs.append(Recommendation(
                id=r.id,
                zone=r.zone or "Unknown",
                risk_area=(r.zone or "Unknown"),
                timestamp=(r.timestamp.isoformat() if r.timestamp else datetime.utcnow().isoformat()),
                reasons=reasons,
                priority=priority,
                recommendation=(
                    "Intervention immédiate requise" if priority == "critique" else
                    "Inspecter la zone dans les 24h" if priority == "élevée" else
                    "Surveiller"
                ),
            ))

    return recs


# ----------------------
# Data ingestion & seeding (dev helpers)
# ----------------------

class SensorItem(BaseModel):
    zone: str
    temperature: float
    pression: float
    vibration: float
    fumee: float
    flamme: Optional[bool] = False
    anomaly: Optional[bool] = False
    timestamp: Optional[str] = None  # ISO8601; if absent, use now


@app.post("/sensor-data/ingest")
def ingest_sensor_data(payload: List[SensorItem], user: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    """Ingest explicit sensor rows. Useful to push fresh data during development/tests."""
    from datetime import datetime

    inserted = 0
    for p in payload:
        try:
            ts = None
            if p.timestamp:
                try:
                    ts = datetime.fromisoformat(p.timestamp)
                except Exception:
                    ts = datetime.utcnow()
            else:
                ts = datetime.utcnow()

            row = SensorData(
                timestamp=ts,
                zone=p.zone,
                temperature=float(p.temperature),
                pression=float(p.pression),
                vibration=float(p.vibration),
                fumee=float(p.fumee),
                flamme=bool(p.flamme),
                anomaly=bool(p.anomaly),
            )
            db.add(row)
            inserted += 1
        except Exception:
            # skip bad row
            continue
    db.commit()
    try:
        log_action(db, "ingest", user_id=user.id, details={"inserted": inserted})
    except Exception:
        pass
    return {"inserted": inserted}


@app.post("/dev/seed")
def seed_sensor_data(n: int = 50, user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):
    """Generate and insert N synthetic sensor rows with current timestamps."""
    from datetime import datetime
    try:
        from .data_generator import generate_sensor_data, detect_anomalies
    except Exception:
        # If the generator is unavailable, insert nothing
        return {"inserted": 0, "detail": "data_generator not available"}

    data = generate_sensor_data(max(1, int(n)))
    data = detect_anomalies(data)
    for d in data:
        row = SensorData(
            timestamp=datetime.utcnow(),
            zone=d.get("zone") or "Unknown",
            temperature=float(d.get("temperature") or 0.0),
            pression=float(d.get("pression") or 0.0),
            vibration=float(d.get("vibration") or 0.0),
            fumee=float(d.get("fumee") or 0.0),
            flamme=bool(d.get("flamme") or False),
            anomaly=bool(d.get("anomaly") or False),
        )
        db.add(row)
    db.commit()
    try:
        log_action(db, "seed", user_id=user.id, details={"n": len(data)})
    except Exception:
        pass
    return {"inserted": len(data)}


# ----------------------
# LSTM metrics (placeholder)
# ----------------------

class LSTMMetrics(BaseModel):
    accuracy: float
    mse: float
    prediction: List[float]


@app.get("/lstm/metrics", response_model=LSTMMetrics)
def get_lstm_metrics(user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):

    rows = db.query(SensorData).order_by(SensorData.timestamp.desc()).limit(100).all()
    if not rows:
        return LSTMMetrics(accuracy=0.9, mse=0.05, prediction=[0, 0, 0, 0])

    n = len(rows)
    avg_temp = sum(float(r.temperature or 0) for r in rows) / n
    avg_press = sum(float(r.pression or 0) for r in rows) / n
    avg_vib = sum(float(r.vibration or 0) for r in rows) / n
    avg_fumee = sum(float(r.fumee or 0) for r in rows) / n
    # Placeholder metrics derived from variability
    var = sum(
        (float(r.temperature or 0) - avg_temp) ** 2 +
        (float(r.pression or 0) - avg_press) ** 2 +
        (float(r.vibration or 0) - avg_vib) ** 2 +
        (float(r.fumee or 0) - avg_fumee) ** 2
        for r in rows
    ) / max(n, 1)
    mse = min(var / 1000.0, 10.0)
    accuracy = max(0.5, 1.0 - mse / 10.0)
    return LSTMMetrics(accuracy=accuracy, mse=mse, prediction=[avg_temp, avg_press, avg_vib, avg_fumee])


# ----------------------
# Retrain endpoint (placeholder)
# ----------------------

class SimpleMessage(BaseModel):
    status: str


@app.get("/retrain-lstm", response_model=SimpleMessage)
def retrain_lstm(user: User = Depends(require_role("admin"))):
    # Here you could trigger background training jobs
    try:
        db = SessionLocal()
        log_action(db, "retrain", user_id=user.id, details={})
    except Exception:
        pass
    finally:
        try:
            db.close()
        except Exception:
            pass
    return SimpleMessage(status="retraining_started")


# ----------------------
# Background Jobs (in-process, threaded)
# ----------------------

class JobInfo(BaseModel):
    id: str
    type: str
    status: str  # queued | running | completed | failed
    progress: int = 0  # 0-100
    created_at: datetime
    updated_at: datetime
    params: Optional[dict] = None
    error: Optional[str] = None


JOBS: Dict[str, JobInfo] = {}
JOB_LOCK = threading.Lock()


def _update_job(jid: str, **fields: Any) -> None:
    with JOB_LOCK:
        job = JOBS.get(jid)
        if not job:
            return
        for k, v in fields.items():
            setattr(job, k, v)
        job.updated_at = datetime.utcnow()
        JOBS[jid] = job


def _run_seed_job(jid: str, n: int) -> None:
    _update_job(jid, status="running", progress=0)
    db = SessionLocal()
    try:
        # reuse generator if available to keep logic consistent
        try:
            from .data_generator import generate_sensor_data, detect_anomalies  # type: ignore
            data = generate_sensor_data(max(1, int(n)))
            data = detect_anomalies(data)
        except Exception:
            data = []

        total = len(data) if data else n
        inserted = 0
        for i in range(total or 1):
            try:
                if data:
                    d = data[i]
                    row = SensorData(
                        timestamp=datetime.utcnow(),
                        zone=d.get("zone") or "Unknown",
                        temperature=float(d.get("temperature") or 0.0),
                        pression=float(d.get("pression") or 0.0),
                        vibration=float(d.get("vibration") or 0.0),
                        fumee=float(d.get("fumee") or 0.0),
                        flamme=bool(d.get("flamme") or False),
                        anomaly=bool(d.get("anomaly") or False),
                    )
                else:
                    # fallback deterministic data
                    row = SensorData(
                        timestamp=datetime.utcnow(),
                        zone="Z1",
                        temperature=20.0,
                        pression=1.0,
                        vibration=0.5,
                        fumee=5.0,
                        flamme=False,
                        anomaly=False,
                    )
                db.add(row)
                inserted += 1
            except Exception as e:
                # best-effort, continue
                _ = str(e)
            if (i + 1) % 25 == 0:
                db.commit()
            _update_job(jid, progress=int(((i + 1) / max(total, 1)) * 100))
            time.sleep(0.01)
        db.commit()
        try:
            log_action(db, "job_seed", user_id=None, details={"inserted": inserted})
        except Exception:
            pass
        _update_job(jid, status="completed", progress=100)
    except Exception as e:
        _update_job(jid, status="failed", error=str(e))
    finally:
        try:
            db.close()
        except Exception:
            pass


def _run_retrain_job(jid: str) -> None:
    _update_job(jid, status="running", progress=0)
    db = SessionLocal()
    try:
        steps = 20
        for i in range(steps):
            time.sleep(0.1)
            _update_job(jid, progress=int(((i + 1) / steps) * 100))
        try:
            log_action(db, "job_retrain", user_id=None, details={})
        except Exception:
            pass
        _update_job(jid, status="completed", progress=100)
    except Exception as e:
        _update_job(jid, status="failed", error=str(e))
    finally:
        try:
            db.close()
        except Exception:
            pass


class JobStartResponse(BaseModel):
    job_id: str
    status: str


@app.post("/jobs/seed", response_model=JobStartResponse)
def start_seed_job(n: int = 200, _: User = Depends(require_role("admin"))):
    jid = uuid.uuid4().hex
    now = datetime.utcnow()
    with JOB_LOCK:
        JOBS[jid] = JobInfo(id=jid, type="seed", status="queued", progress=0, created_at=now, updated_at=now, params={"n": n})
    t = threading.Thread(target=_run_seed_job, args=(jid, n), daemon=True)
    t.start()
    return JobStartResponse(job_id=jid, status="queued")


@app.post("/jobs/retrain", response_model=JobStartResponse)
def start_retrain_job(_: User = Depends(require_role("admin"))):
    jid = uuid.uuid4().hex
    now = datetime.utcnow()
    with JOB_LOCK:
        JOBS[jid] = JobInfo(id=jid, type="retrain", status="queued", progress=0, created_at=now, updated_at=now)
    t = threading.Thread(target=_run_retrain_job, args=(jid,), daemon=True)
    t.start()
    return JobStartResponse(job_id=jid, status="queued")


class JobSummary(BaseModel):
    id: str
    type: str
    status: str
    progress: int
    updated_at: datetime


@app.get("/jobs", response_model=List[JobSummary])
def list_jobs(_: User = Depends(require_role("admin"))):
    with JOB_LOCK:
        return [JobSummary(id=j.id, type=j.type, status=j.status, progress=j.progress, updated_at=j.updated_at) for j in JOBS.values()]


@app.get("/jobs/{job_id}", response_model=JobInfo)
def get_job(job_id: str, _: User = Depends(require_role("admin"))):
    with JOB_LOCK:
        j = JOBS.get(job_id)
        if not j:
            raise HTTPException(status_code=404, detail="Job not found")
        return j


# ----------------------
# Suggestions endpoints
# ----------------------

class SuggestionIn(BaseModel):
    category: str
    zone: Optional[str] = None
    sensor_type: Optional[str] = None
    text: str
    impact: str
    attachments: Optional[str] = None


class SuggestionOut(BaseModel):
    id: int
    user_id: int
    role_snapshot: str
    category: str
    zone: Optional[str]
    sensor_type: Optional[str]
    text: str
    impact: str
    status: str
    created_at: datetime
    updated_at: datetime


@app.post("/suggestions", response_model=SuggestionOut)
def create_suggestion(payload: SuggestionIn, user: User = Depends(require_role("user", "admin")), db: Session = Depends(get_db)):
    s = Suggestion(
        user_id=user.id,
        role_snapshot=user.role,
        category=payload.category,
        zone=payload.zone,
        sensor_type=payload.sensor_type,
        text=payload.text,
        impact=payload.impact,
        attachments=payload.attachments or None,
        status="nouveau",
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.add(s)
    db.commit()
    db.refresh(s)
    try:
        log_action(db, "create_suggestion", user_id=user.id, details={"suggestion_id": s.id, "category": s.category})
    except Exception:
        pass
    return SuggestionOut(
        id=s.id,
        user_id=s.user_id,
        role_snapshot=s.role_snapshot,
        category=s.category,
        zone=s.zone,
        sensor_type=s.sensor_type,
        text=s.text,
        impact=s.impact,
        status=s.status,
        created_at=s.created_at,
        updated_at=s.updated_at,
    )


@app.get("/suggestions", response_model=List[SuggestionOut])
def list_suggestions(
    _: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
    response: Response = None,
    page: int = 1,
    page_size: int = 50,
    status: Optional[str] = None,
    category: Optional[str] = None,
    user_id: Optional[int] = None,
    search: Optional[str] = None,
    sort: Optional[str] = "created_at.desc",
):
    q = db.query(Suggestion)
    if status:
        q = q.filter(Suggestion.status == status)
    if category:
        q = q.filter(Suggestion.category == category)
    if user_id:
        q = q.filter(Suggestion.user_id == user_id)
    if search:
        like = f"%{search}%"
        q = q.filter(Suggestion.text.ilike(like))
    # sorting
    if sort == "created_at.asc":
        q = q.order_by(Suggestion.created_at.asc())
    elif sort == "updated_at.asc":
        q = q.order_by(Suggestion.updated_at.asc())
    elif sort == "updated_at.desc":
        q = q.order_by(Suggestion.updated_at.desc())
    else:
        q = q.order_by(Suggestion.created_at.desc())
    total = q.count()
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 200))
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    try:
        if response is not None:
            response.headers["X-Total-Count"] = str(total)
    except Exception:
        pass
    return [
        SuggestionOut(
            id=r.id,
            user_id=r.user_id,
            role_snapshot=r.role_snapshot,
            category=r.category,
            zone=r.zone,
            sensor_type=r.sensor_type,
            text=r.text,
            impact=r.impact,
            status=r.status,
            created_at=r.created_at,
            updated_at=r.updated_at,
        ) for r in rows
    ]


class SuggestionUpdate(BaseModel):
    status: Optional[str] = None
    tags: Optional[str] = None
    assignee_id: Optional[int] = None


@app.patch("/suggestions/{sid}", response_model=SuggestionOut)
def update_suggestion(sid: int, payload: SuggestionUpdate, _: User = Depends(require_role("admin")), db: Session = Depends(get_db)):
    r = db.query(Suggestion).filter(Suggestion.id == sid).first()
    if not r:
        raise HTTPException(status_code=404, detail="Not found")
    if payload.status is not None:
        r.status = payload.status
    if payload.tags is not None:
        r.tags = payload.tags
    if payload.assignee_id is not None:
        r.assignee_id = payload.assignee_id
    r.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(r)
    try:
        log_action(db, "update_suggestion", user_id=_.id if isinstance(_, User) else None, details={"suggestion_id": r.id, "status": r.status})
    except Exception:
        pass
    return SuggestionOut(
        id=r.id, user_id=r.user_id, role_snapshot=r.role_snapshot, category=r.category, zone=r.zone, sensor_type=r.sensor_type,
        text=r.text, impact=r.impact, status=r.status, created_at=r.created_at, updated_at=r.updated_at
    )


# ----------------------
# Admin: users listing
# ----------------------

class UserOut(BaseModel):
    id: int
    username: str
    role: str
    is_active: bool
    created_at: Optional[datetime] = None
    last_login_at: Optional[datetime] = None


@app.get("/admin/users", response_model=List[UserOut])
def list_users(
    _: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
    response: Response = None,
    page: int = 1,
    page_size: int = 50,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    sort: Optional[str] = "id.asc",
):
    q = db.query(User)
    if search:
        like = f"%{search}%"
        q = q.filter(User.username.ilike(like))
    if role:
        q = q.filter(User.role == role)
    if is_active is not None:
        q = q.filter(User.is_active == is_active)
    # sorting
    if sort == "id.desc":
        q = q.order_by(User.id.desc())
    elif sort == "created_at.desc":
        q = q.order_by(User.created_at.desc())
    elif sort == "created_at.asc":
        q = q.order_by(User.created_at.asc())
    else:
        q = q.order_by(User.id.asc())
    total = q.count()
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 200))
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    try:
        if response is not None:
            response.headers["X-Total-Count"] = str(total)
    except Exception:
        pass
    return [
        UserOut(
            id=u.id,
            username=u.username,
            role=u.role,
            is_active=bool(u.is_active),
            created_at=u.created_at,
            last_login_at=u.last_login_at,
        ) for u in rows
    ]


# ----------------------
# Admin: audit logs
# ----------------------

class AuditLogOut(BaseModel):
    id: int
    ts: datetime
    user_id: Optional[int]
    action: str
    details: Optional[str] = None


@app.get("/admin/audit", response_model=List[AuditLogOut])
def list_audit(
    _: User = Depends(require_role("admin")),
    db: Session = Depends(get_db),
    response: Response = None,
    page: int = 1,
    page_size: int = 200,
    action: Optional[str] = None,
    user_id: Optional[int] = None,
    date_from: Optional[str] = None,
    date_to: Optional[str] = None,
    sort: Optional[str] = "ts.desc",
):
    q = db.query(AuditLog)
    if action:
        q = q.filter(AuditLog.action == action)
    if user_id:
        q = q.filter(AuditLog.user_id == user_id)
    # date filters (ISO8601)
    try:
        if date_from:
            q = q.filter(AuditLog.ts >= datetime.fromisoformat(date_from))
        if date_to:
            q = q.filter(AuditLog.ts <= datetime.fromisoformat(date_to))
    except Exception:
        pass
    # sorting
    if sort == "ts.asc":
        q = q.order_by(AuditLog.ts.asc())
    else:
        q = q.order_by(AuditLog.ts.desc())
    total = q.count()
    page = max(1, int(page))
    page_size = max(1, min(int(page_size), 1000))
    rows = q.offset((page - 1) * page_size).limit(page_size).all()
    try:
        if response is not None:
            response.headers["X-Total-Count"] = str(total)
    except Exception:
        pass
    return [AuditLogOut(id=r.id, ts=r.ts, user_id=r.user_id, action=r.action, details=r.details) for r in rows]


@app.get("/admin/audit.csv")
def export_audit_csv(_: User = Depends(require_role("admin")), db: Session = Depends(get_db), limit: int = 1000):
    rows = db.query(AuditLog).order_by(AuditLog.ts.desc()).limit(max(1, min(limit, 10000))).all()
    import csv
    import io
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "ts", "user_id", "action", "details"]) 
    for r in rows:
        writer.writerow([r.id, (r.ts.isoformat() if r.ts else ""), (r.user_id or ""), r.action, (r.details or "")])
    csv_data = buf.getvalue()
    headers = {"Content-Disposition": "attachment; filename=audit.csv"}
    return Response(content=csv_data, media_type="text/csv", headers=headers)


# ----------------------
# WebSocket notifications (basic)
# ----------------------

@app.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    # Authenticate via query param token=?
    token = websocket.query_params.get("token") if hasattr(websocket, "query_params") else None
    if not token:
        await websocket.close(code=1008)
        return
    try:
        payload = decode_token(token)
        if not payload.get("sub"):
            await websocket.close(code=1008)
            return
    except Exception:
        await websocket.close(code=1008)
        return
    await websocket.accept()
    try:
        # Send a welcome message so the frontend can react
        await websocket.send_text("connected")
        while True:
            # Keep the connection alive by awaiting messages
            _ = await websocket.receive_text()
            # Echo back or notify
            await websocket.send_text("update")
    except WebSocketDisconnect:
        # Client disconnected
        pass
