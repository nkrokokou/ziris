from sklearn.ensemble import IsolationForest
import pandas as pd
from sqlalchemy.orm import Session
from database import SensorDataDB
from typing import List

def detect_anomalies(db: Session) -> List[int]:
    data = db.query(SensorDataDB).all()
    if not data:
        return []

    df = pd.DataFrame([
        {
            "temperature": d.temperature,
            "pression": d.pression,
            "vibration": d.vibration,
            "fumee": d.fumee
        }
        for d in data
    ])

    model = IsolationForest(contamination=0.1, random_state=42)
    predictions = model.fit_predict(df)

    anomaly_ids = [data[i].id for i, pred in enumerate(predictions) if pred == -1]
    return anomaly_ids

def update_anomalies_in_db(db: Session):
    anomaly_ids = detect_anomalies(db)
    for data in db.query(SensorDataDB).all():
        data.anomaly = data.id in anomaly_ids
    db.commit()