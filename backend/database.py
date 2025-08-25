from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime, Text
from sqlalchemy import text

from datetime import datetime

SQLALCHEMY_DATABASE_URL = "postgresql://postgres:Drckangel0606@localhost:5432/ziris_db"  # Remplace par ton mot de passe

engine = create_engine(SQLALCHEMY_DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    hashed_password = Column(String)
    role = Column(String, default="user")  # 'user' (operator) or 'admin'
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    last_login_at = Column(DateTime, nullable=True)

class SensorData(Base):
    __tablename__ = "sensor_data"
    id = Column(Integer, primary_key=True, index=True)
    timestamp = Column(DateTime, default=datetime.utcnow)
    zone = Column(String, index=True)
    temperature = Column(Float)
    pression = Column(Float)
    vibration = Column(Float)
    fumee = Column(Float)
    flamme = Column(Boolean)
    anomaly = Column(Boolean, default=False)

class Threshold(Base):
    __tablename__ = "thresholds"
    id = Column(Integer, primary_key=True, index=True)
    temp = Column(Float, default=80.0)
    press = Column(Float, default=8.0)
    vib = Column(Float, default=15.0)
    fumee = Column(Float, default=200.0)
    updated_at = Column(DateTime, default=datetime.utcnow)


class AuditLog(Base):
    __tablename__ = "audit_logs"
    id = Column(Integer, primary_key=True, index=True)
    ts = Column(DateTime, default=datetime.utcnow, index=True)
    user_id = Column(Integer, nullable=True, index=True)
    action = Column(String, index=True)  # e.g., login, register, approve_user, set_thresholds, create_suggestion, update_suggestion, retrain, seed, ingest
    details = Column(Text, nullable=True)

class ThresholdHistory(Base):
    __tablename__ = "thresholds_history"
    id = Column(Integer, primary_key=True, index=True)
    temp = Column(Float)
    press = Column(Float)
    vib = Column(Float)
    fumee = Column(Float)
    changed_at = Column(DateTime, default=datetime.utcnow)


class Suggestion(Base):
    __tablename__ = "suggestions"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True)
    role_snapshot = Column(String, default="user")
    category = Column(String, index=True)  # seuils | recommandations | visualisation | donnees | autre
    zone = Column(String, nullable=True)
    sensor_type = Column(String, nullable=True)
    text = Column(Text)
    impact = Column(String, default="Moyen")  # Critique | Élevé | Moyen | Faible
    attachments = Column(Text, nullable=True)  # simple CSV of URLs or base64 refs
    status = Column(String, default="nouveau")  # nouveau | en_cours | resolu | rejete
    tags = Column(String, nullable=True)
    assignee_id = Column(Integer, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow)

def init_db():
    # Keep metadata creation for brand new DBs; prefer Alembic migrations for schema changes
    Base.metadata.create_all(bind=engine)

__all__ = ['engine', 'SessionLocal', 'Base', 'init_db', 'User', 'SensorData', 'Threshold', 'ThresholdHistory', 'Suggestion', 'AuditLog']