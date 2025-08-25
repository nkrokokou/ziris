import numpy as np
from sklearn.ensemble import IsolationForest

def generate_sensor_data(n_samples):
    zones = ['Salle Serveurs', 'Locaux Electriques', 'Zone Turbines', 'Stockage Combustible', 'Controle Commande']
    data = []
    for _ in range(n_samples):
        zone = np.random.choice(zones)
        data.append({
            "zone": zone,
            "temperature": np.random.normal(25, 5),
            "pression": np.random.normal(2, 0.5),
            "vibration": np.random.normal(5, 2),
            "fumee": np.random.normal(50, 20),
            "flamme": np.random.random() < 0.05  # 5% de chance d'avoir une flamme
        })
    return data

def detect_anomalies(data, contamination=0.1, n_estimators=100):
    X = np.array([[d["temperature"], d["pression"], d["vibration"], d["fumee"]] for d in data])
    clf = IsolationForest(contamination=contamination, random_state=42, n_estimators=n_estimators)
    predictions = clf.fit_predict(X)
    for i, pred in enumerate(predictions):
        data[i]["anomaly"] = pred == -1
    return data