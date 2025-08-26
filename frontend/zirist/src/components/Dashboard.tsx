import React, { useState, useEffect, useRef, useMemo, useCallback, useContext } from 'react';
import { Container, Row, Col, Table, Alert, Form, Button, Card, Modal, Toast, ToastContainer, Badge, Offcanvas } from 'react-bootstrap';
import api from '../api/client';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import { debounce } from 'lodash';
import { DashboardData } from '../types/DashboardData';
import { LSTMMetrics } from '../types/LSTMMetrics';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import zoomPlugin from 'chartjs-plugin-zoom';
import autoTable from 'jspdf-autotable';
import { ThemeContext } from '../index';
import ParticlesBackground from './ParticlesBackground';
import KPIHeader from './KPIHeader';

// Crosshair + sync hover plugin
const crosshairSyncPlugin = {
  id: 'crosshairSync',
  afterDatasetsDraw(chart: any) {
    const active = chart.getActiveElements?.()[0];
    if (!active) return;
    const ctx = chart.ctx;
    const x = chart.getDatasetMeta(active.datasetIndex).data[active.index]?.x;
    if (!x) return;
    ctx.save();
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, chart.chartArea.top);
    ctx.lineTo(x, chart.chartArea.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend, zoomPlugin, crosshairSyncPlugin);

interface Recommendation {
  id: string | number;
  zone: string;
  risk_area: string;
  timestamp: string;
  reasons: string[];
  priority: string;
  recommendation: string;
}

// Shared help content for Offcanvas (compact) and Modal (full)
const HelpContent: React.FC<{ variant: 'compact' | 'full' }> = ({ variant }) => {
  if (variant === 'compact') {
    return (
      <div>
        <div className="mb-3">
          <h6>Rafraîchissement des données</h6>
          <ul>
            <li>Utilisez « Rafraîchir » pour mettre à jour les statistiques et graphiques.</li>
            <li>Le timestamp « Dernière Mise à jour » doit être proche de l'heure actuelle.</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Générer des données (dev)</h6>
          <ul>
            <li>Le bouton « Seeder données (100) » appelle l’API /dev/seed pour insérer 100 points récents.</li>
            <li>Paramètre avancé (API): <code>contamination</code> pour contrôler le taux d'anomalies (ex: <code>/dev/seed?n=800&contamination=0.35</code>).</li>
            <li>Après génération, un rafraîchissement automatique est lancé.</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Notifications et WebSocket</h6>
          <ul>
            <li>Les notifications en haut indiquent les événements (info/avertissement/critique).</li>
            <li>Les messages WebSocket déclenchent aussi un rafraîchissement.</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Seuils critiques</h6>
          <ul>
            <li>Modifiez Temp/Press/Vib/Fumée pour personnaliser les alertes (persisté en base, utilisé par les métriques).</li>
            <li>« Générer seuil critique » propose des seuils, « Appliquer toutes les suggestions » les applique en masse.</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Modèle LSTM</h6>
          <ul>
            <li>« Retrain LSTM » démarre l’apprentissage (statut dans notifications).</li>
            <li>Les scores (TP/FP/TN/FN) utilisent par défaut la règle « 2 sur 4 » (k2): positif si ≥2 métriques dépassent leur seuil.</li>
            <li>API: <code>/lstm/metrics?rule=any|k2|k3|k4</code> permet d’ajuster la règle (le tableau utilise k2).</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Dépannage</h6>
          <ul>
            <li>Si « Dernière Mise à jour » reste ancien: « Seeder données (100) » puis « Rafraîchir ».</li>
            <li>Vérifiez l’onglet Réseau (pas d’erreur 401, bonne URL backend).</li>
          </ul>
        </div>
        <div className="mb-3">
          <h6>Affichage</h6>
          <ul>
            <li>Le bouton « Effets visuels » allège les effets (glow/particules).</li>
          </ul>
        </div>
      </div>
    );
  }
  // Full variant: previous Modal content
  return (
    <div className="p-1">
      <div className="welcome-animation mb-4">
        <h2 className="text-2xl font-poppins text-blue-600 animate-pulse-slow">👋 Découverte de ZIRIS !</h2>
        <p className="text-lg mt-2 animate-fade-in-delay">
          ZIRIS est votre outil pour surveiller une centrale thermique en temps réel. Que vous soyez un débutant ou un expert, cette aide vous guidera pas à pas. Cliquez sur les sections ci-dessous pour en savoir plus !
        </p>
      </div>
      <div className="section-container">
        <h3 className="text-xl font-poppins text-indigo-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
          1. Comprendre le Tableau de Bord
        </h3>
        <p className="mt-2 animate-fade-in-delay">
          Le tableau de bord montre des informations clés comme le nombre total de capteurs, les anomalies détectées, et la dernière mise à jour. Par exemple, si vous voyez 50 capteurs avec 5 anomalies, cela signifie que 10 % de vos capteurs signalent un problème. Utilisez les filtres (zones et types de capteurs) pour vous concentrer sur une zone spécifique.
        </p>
        <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
          <li><strong>Filtrer :</strong> Choisissez une zone (ex. "Zone A") pour voir ses données.</li>
          <li><strong>Rafraîchir :</strong> Cliquez sur "Rafraîchir" pour mettre à jour les données en direct.</li>
        </ul>
        <h3 className="text-xl font-poppins text-indigo-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
          2. Ajuster les Seaux d'Anomalie
        </h3>
        <p className="mt-2 animate-fade-in-delay">
          Les "seaux" vous permettent de définir les seuils au-delà desquels une mesure est considérée comme anormale. Par exemple, si la température dépasse 80°C, elle sera signalée. Modifiez ces valeurs pour adapter ZIRIS à votre centrale :
        </p>
        <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
          <li><strong>Température :</strong> Réglez à 70°C si votre équipement supporte moins de chaleur.</li>
          <li><strong>Conseil :</strong> Testez avec de petites variations et observez les changements dans les recommandations.</li>
        </ul>
        <h3 className="text-xl font-poppins text-indigo-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
          3. Lire les Recommandations
        </h3>
        <p className="mt-2 animate-fade-in-delay">
          Les recommandations vous aident à agir sur les anomalies. Si une zone est marquée "critique" (en rouge), une intervention immédiate est nécessaire. Par exemple, une vibration élevée peut indiquer un problème mécanique.
        </p>
        <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
          <li><strong>Priorité Critique :</strong> Arrêtez l’équipement et inspectez-le.</li>
          <li><strong>Priorité Élevée :</strong> Planifiez une vérification dans les 24 heures.</li>
        </ul>
        <h3 className="text-xl font-poppins text-indigo-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
          4. Retrain du Modèle LSTM
        </h3>
        <p className="mt-2 animate-fade-in-delay">
          Le modèle LSTM prédit les comportements futurs des capteurs. Si les prédictions semblent inexactes (par exemple, une erreur MSE élevée), cliquez sur "Retrain LSTM" pour améliorer ses performances avec les dernières données.
        </p>
        <p className="mt-2 animate-fade-in-delay-2">
          <strong>Exemple :</strong> Après un retrain, la précision peut passer de 85 % à 92 %, rendant les alertes plus fiables.
        </p>
        <h3 className="text-xl font-poppins text-indigo-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
          5. Exporter et Personnaliser
        </h3>
        <p className="mt-2 animate-fade-in-delay">
          Exportez un rapport PDF avec toutes les données et graphiques en cliquant sur "Exporter PDF". Vous pouvez aussi basculer entre les modes clair et sombre pour une expérience confortable.
        </p>
        <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
          <li><strong>PDF :</strong> Utile pour partager avec votre équipe.</li>
          <li><strong>Thème :</strong> Choisissez "Mode Sombre" pour travailler la nuit.</li>
        </ul>
      </div>
    </div>
  );
};

const Dashboard: React.FC = () => {
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedZone, setSelectedZone] = useState('all');
  const [sensorType, setSensorType] = useState('all');
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [lstmMetrics, setLstmMetrics] = useState<LSTMMetrics | null>(null);
  const [thresholds, setThresholds] = useState({ temp: 80, press: 8, vib: 15, fumee: 200 });
  // UI controls
  const [showHelpOffcanvas, setShowHelpOffcanvas] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showEffects, setShowEffects] = useState(true);
  const { theme, toggleTheme } = useContext(ThemeContext);
  const token = localStorage.getItem('token');
  const ws = useRef<WebSocket | null>(null);
  const overviewChartRef = useRef<any>(null);
  const sensorChartRef = useRef<any>(null);
  const zoneChartRef = useRef<any>(null);
  const realTimeChartRef = useRef<any>(null);
  const [realTimePaused, setRealTimePaused] = useState(false);
  const [notifications, setNotifications] = useState<Array<{ id: number; ts: string; message: string; level: 'info' | 'warning' | 'danger' }>>([]);
  const [showDrill, setShowDrill] = useState(false);
  const [selectedRec, setSelectedRec] = useState<Recommendation | null>(null);
  const [loadingRefresh, setLoadingRefresh] = useState(false);
  const [loadingRetrain, setLoadingRetrain] = useState(false);
  const [loadingSeed, setLoadingSeed] = useState(false);

  const [realTimeData, setRealTimeData] = useState({
    timestamps: [] as string[],
    temp: [] as number[],
    press: [] as number[],
    vib: [] as number[],
    fumee: [] as number[],
  });
  const maxDataPoints = 20;

  const removeNotification = useCallback((id: number) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // Load thresholds from backend (defined before useEffect to satisfy TS/lint)
  const loadThresholds = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/thresholds');
      if (res?.data) setThresholds(res.data);
    } catch (err: any) {
      // keep defaults if fails
      console.warn('Chargement seuils échoué', err?.message || err);
    }
  }, [token]);

  const levelVariant = (lvl: 'info' | 'warning' | 'danger') =>
    lvl === 'danger' ? 'danger' : lvl === 'warning' ? 'warning' : 'info';

  const syncHover = useCallback((index: number | null, src?: any) => {
    const charts = [overviewChartRef.current, sensorChartRef.current, zoneChartRef.current, realTimeChartRef.current].filter(Boolean);
    charts.forEach((c: any) => {
      if (!c || c === src) return;
      try {
        if (index === null) {
          c.setActiveElements([]);
          c.update();
          return;
        }
        if (!c.data?.datasets?.length) return;
        const meta = c.getDatasetMeta?.(0);
        const len = meta?.data?.length ?? 0;
        if (!len) return;
        const safeIdx = Math.max(0, Math.min(index, len - 1));
        if (!meta.data[safeIdx]) return;
        c.setActiveElements([{ datasetIndex: 0, index: safeIdx }]);
        c.update();
      } catch (_) {
        // ignore unsafe hover sync for charts not ready
      }
    });
  }, []);
  
  const updateRealTimeData = useCallback((newData: { timestamps: string[]; temp: number[]; press: number[]; vib: number[]; fumee: number[] }) => {
    setRealTimeData((prev) => {
      const updatedData = {
        timestamps: [...prev.timestamps, ...newData.timestamps].slice(-maxDataPoints),
        temp: [...prev.temp, ...newData.temp].slice(-maxDataPoints),
        press: [...prev.press, ...newData.press].slice(-maxDataPoints),
        vib: [...prev.vib, ...newData.vib].slice(-maxDataPoints),
        fumee: [...prev.fumee, ...newData.fumee].slice(-maxDataPoints),
      };
      return updatedData;
    });
  }, [maxDataPoints]);

  const fetchDataImpl = useCallback(async () => {
    if (!token) {
      setError('Token manquant');
      console.log('Token manquant');
      return;
    }
    try {
      const [dashboardResponse, recResponse, lstmResponse] = await Promise.all([
        api.get('/dashboard/data'),
        api.get('/sensor/recommendations'),
        api.get('/lstm/metrics?rule=k2'),
      ]);
      console.log('Dashboard data:', dashboardResponse.data);
      setDashboardData(dashboardResponse.data);
      setRecommendations(recResponse.data);
      setLstmMetrics(lstmResponse.data);
      setError(null);

      // Use freshly fetched data for real-time append, not potentially stale state
      if (dashboardResponse?.data?.zones && selectedZone !== 'all' && !realTimePaused) {
        const zoneData = dashboardResponse.data.zones[selectedZone];
        const latestValues = {
          timestamps: [new Date().toLocaleTimeString()],
          temp: [zoneData.temp || 0],
          press: [zoneData.press || 0],
          vib: [zoneData.vib || 0],
          fumee: [zoneData.fumee || 0],
        };
        updateRealTimeData(latestValues);
      }
    } catch (err: any) {
      setError(`Erreur lors du chargement : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
      console.error('Erreur fetchData:', err);
    }
  }, [token, selectedZone, realTimePaused, updateRealTimeData]);

  const fetchData = useMemo(() => debounce(fetchDataImpl, 500), [fetchDataImpl]);

  useEffect(() => {
    return () => {
      // cancel pending debounced calls on unmount/change
      try { (fetchData as any)?.cancel?.(); } catch (_) {}
    };
  }, [fetchData]);

  

  useEffect(() => {
    if (token) {
      fetchData();
      const interval = setInterval(fetchData, 5000);
      loadThresholds();

      if (!ws.current) {
        const wsProtocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
        const wsHost = window.location.hostname;
        ws.current = new WebSocket(`${wsProtocol}://${wsHost}:8000/ws/notifications`);
        ws.current.onopen = () => console.log('WebSocket connecté');
        ws.current.onmessage = (event) => {
          console.log('Message reçu :', event.data);
          // Try to parse JSON, fallback to string
          let payload: any = null;
          try { payload = JSON.parse(event.data); } catch (_) { /* ignore */ }
          const text: string = payload?.message || payload?.detail || (typeof event.data === 'string' ? event.data : 'Événement reçu');
          const lvl: 'info' | 'warning' | 'danger' = /critique|critical|error|danger/i.test(text)
            ? 'danger'
            : /élevée|warning|alert/i.test(text)
            ? 'warning'
            : 'info';
          const id = Date.now() + Math.floor(Math.random() * 1000);
          setNotifications((prev) => [{ id, ts: new Date().toLocaleTimeString(), message: text, level: lvl }, ...prev].slice(0, 10));
          // Always refresh to keep recommendations and metrics live
          fetchData();
        };
        ws.current.onerror = (error) => {
          console.error('Erreur WebSocket :', error);
          setError('Erreur de connexion WebSocket');
        };
        ws.current.onclose = () => {
          console.log('WebSocket déconnecté');
          ws.current = null;
        };
      }

      return () => {
        clearInterval(interval);
        (fetchData as any).cancel?.();
        if (ws.current) {
          ws.current.close();
          ws.current = null;
        }
      };
    }
  }, [token, fetchData, loadThresholds]);

  const handleThresholdChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const name = e.target.name as 'temp' | 'press' | 'vib' | 'fumee';
    const value = parseFloat(e.target.value) || 0;
    const next = { ...thresholds, [name]: value };
    setThresholds(next);
    // Persist to backend
    try {
      await api.post('/thresholds', next);
    } catch (err: any) {
      setError(`Erreur sauvegarde seuils : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    }
  };

  

  // Suggest critical threshold for a single metric and persist
  const suggestThreshold = async (key: 'temp' | 'press' | 'vib' | 'fumee') => {
    if (!token) {
      setError('Token manquant');
      return;
    }
    try {
      const res = await api.get('/thresholds/suggest');
      if (res?.data && typeof res.data[key] === 'number') {
        const next = { ...thresholds, [key]: res.data[key] };
        setThresholds(next);
        await api.post('/thresholds', next);
        // Feedback toast
        setNotifications((prev) => [
          { id: Date.now(), ts: new Date().toLocaleTimeString(), message: `Seuil ${key} mis à jour: ${res.data[key].toFixed(2)}` , level: 'info' as 'info' | 'warning' | 'danger' },
          ...prev,
        ].slice(0, 10));
        // Refresh recs/data impacted by thresholds
        await refreshNow();
      }
    } catch (err: any) {
      setError(`Erreur suggestion seuil (${key}) : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    }
  };

  // Apply all suggested thresholds at once
  const applyAllSuggestions = async () => {
    if (!token) {
      setError('Token manquant');
      return;
    }
    try {
      const res = await api.get('/thresholds/suggest');
      if (res?.data) {
        const next = {
          temp: Number(res.data.temp) || thresholds.temp,
          press: Number(res.data.press) || thresholds.press,
          vib: Number(res.data.vib) || thresholds.vib,
          fumee: Number(res.data.fumee) || thresholds.fumee,
        };
        setThresholds(next);
        await api.post('/thresholds', next);
        setNotifications((prev) => [
          { id: Date.now(), ts: new Date().toLocaleTimeString(), message: 'Seuils critiques appliqués (toutes métriques).', level: 'info' as 'info' | 'warning' | 'danger' },
          ...prev,
        ].slice(0, 10));
        await refreshNow();
      }
    } catch (err: any) {
      setError(`Erreur application suggestions: ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    }
  };

  const retrainModel = async () => {
    if (!token) {
      setError('Token manquant');
      return;
    }
    setLoadingRetrain(true);
    try {
      await api.get('/retrain-lstm');
      setNotifications((prev) => [
        { id: Date.now(), ts: new Date().toLocaleTimeString(), message: 'Retrain LSTM démarré', level: 'info' as 'info' | 'warning' | 'danger' },
        ...prev,
      ].slice(0, 10));
      fetchData();
    } catch (err: any) {
      setError(`Erreur lors du retrain : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    } finally {
      setLoadingRetrain(false);
    }
  };

  // Immediate refresh (bypasses debounce) for button UX
  const refreshNow = async () => {
    if (!token) {
      setError('Token manquant');
      return;
    }
    setLoadingRefresh(true);
    try {
      const [dashboardResponse, recResponse, lstmResponse] = await Promise.all([
        api.get('/dashboard/data'),
        api.get('/sensor/recommendations'),
        api.get('/lstm/metrics?rule=k2'),
      ]);
      setDashboardData(dashboardResponse.data);
      setRecommendations(recResponse.data);
      setLstmMetrics(lstmResponse.data);
      setError(null);
    } catch (err: any) {
      setError(`Erreur lors du rafraîchissement : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    } finally {
      setLoadingRefresh(false);
    }
  };

  // Génère des données synthétiques (dev) puis rafraîchit le dashboard
  const seedNow = async (n: number = 100) => {
    if (!token) {
      setError('Token manquant');
      return;
    }
    setLoadingSeed(true);
    try {
      await api.post(`/dev/seed?n=${n}`);
      await refreshNow();
      setNotifications((prev) => [
        { id: Date.now(), ts: new Date().toLocaleString(), message: `Données générées (${n}).`, level: 'info' as 'info' | 'warning' | 'danger' },
        ...prev,
      ].slice(0, 5));
    } catch (err: any) {
      setError(`Erreur lors du seeding : ${err.response?.data?.message || err.message || 'Erreur inconnue'}`);
    } finally {
      setLoadingSeed(false);
    }
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // En-tête stylisé
    doc.setFillColor(0, 123, 255); // Bleu primaire comme dans Bootstrap
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text('Rapport Complet ZIRIS - Analyse Critique', 105, 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Généré le : ${new Date().toLocaleString()}`, 105, 25, { align: 'center' });

    // Section 1 : Statistiques globales
    doc.addPage();
    doc.setFontSize(16);
    doc.text('1. Statistiques Globales', 10, 20);
    autoTable(doc, {
      startY: 25,
      head: [['Catégorie', 'Valeur']],
      body: [
        ['Total Capteurs', dashboardData?.total_sensors?.toString() || 'N/A'],
        ['Anomalies', dashboardData?.anomalies?.toString() || 'N/A'],
        ['Dernière Mise à jour', dashboardData?.last_update ? new Date(dashboardData.last_update).toLocaleString() : 'N/A'],
        ['Précision LSTM', lstmMetrics ? `${(lstmMetrics.accuracy * 100).toFixed(2)}%` : 'N/A'],
        ['Erreur Moyenne (MSE)', lstmMetrics ? lstmMetrics.mse.toFixed(2) : 'N/A'],
      ],
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 255], textColor: [255, 255, 255], fontSize: 12 },
      styles: { cellPadding: 2, fontSize: 10 },
    });

    // Section 2 : Données par zone
    doc.addPage();
    doc.setFontSize(16);
    doc.text('2. Données par Zone', 10, 20);
    const zoneData = dashboardData?.zones ? Object.entries(dashboardData.zones).map(([zone, data]) => [
      zone,
      data.total.toString(),
      data.anomalies.toString(),
      data.temp.toFixed(2),
      data.press.toFixed(2),
      data.vib.toFixed(2),
      data.fumee.toFixed(2),
    ]) : [];
    autoTable(doc, {
      startY: 25,
      head: [['Zone', 'Total', 'Anomalies', 'Temp (°C)', 'Pression (bars)', 'Vibration (mm/s)', 'Fumée (ppm)']],
      body: zoneData,
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 255], textColor: [255, 255, 255], fontSize: 12 },
      styles: { cellPadding: 2, fontSize: 10 },
    });

    // Section 3 : Graphiques
    const chartElements = [
      { id: 'chart-overview', title: 'Vue d\'ensemble (Capteurs vs Anomalies)' },
      { id: 'chart-sensor', title: 'Prédictions par Capteur (LSTM)' },
      { id: 'chart-zone', title: 'Anomalies par Zone' },
      { id: 'chart-realtime', title: 'Suivi en Temps Réel' },
      { id: 'chart-cm-counts', title: 'Matrice de Confusion (TP/FP/TN/FN)' },
      { id: 'chart-cm-scores', title: 'Scores de Classification (Precision/Recall/F1)' },
    ];
    let sectionIndex = 1;
    for (const { id, title } of chartElements) {
      const element = document.getElementById(id);
      if (element) {
        const canvas = await html2canvas(element, { scale: 2, backgroundColor: null });
        const imgData = canvas.toDataURL('image/png');
        doc.addPage();
        doc.setFontSize(16);
        doc.text(`3.${sectionIndex}. ${title}`, 10, 20);
        const imgWidth = 180;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        doc.addImage(imgData, 'PNG', 15, 30, imgWidth, imgHeight);
        sectionIndex += 1;
      }
    }

    // Section 4 : Recommandations
    doc.addPage();
    doc.setFontSize(16);
    doc.text('4. Recommandations Critiques', 10, 20);
    const recData = recommendations.map((rec) => [
      rec.zone,
      rec.risk_area,
      new Date(rec.timestamp).toLocaleString(),
      rec.reasons.join(', ') || 'Aucune raison spécifiée',
      rec.priority,
      rec.recommendation,
    ]);
    autoTable(doc, {
      startY: 25,
      head: [['Zone', 'Zone à Risque', 'Date', 'Raisons', 'Priorité', 'Action']],
      body: recData,
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 255], textColor: [255, 255, 255], fontSize: 12 },
      bodyStyles: { textColor: [0, 0, 0], fontSize: 10 },
      styles: { cellPadding: 2 },
      didDrawCell: (data) => {
        if (data.section === 'body' && data.cell.raw && Array.isArray(data.cell.raw) && data.cell.raw[4]) {
          if (data.cell.raw[4] === 'critique') {
            doc.setFillColor(255, 77, 77); // Rouge pour priorité critique
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          } else if (data.cell.raw[4] === 'élevée') {
            doc.setFillColor(255, 204, 0); // Jaune pour priorité élevée
            doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
          }
        }
      },
    });

    // Section 5 : Résumé analytique
    doc.addPage();
    doc.setFontSize(16);
    doc.text('5. Résumé Analytique et Recommandations', 10, 20);
    doc.setFontSize(12);
    doc.text('Analyse :', 10, 30);
    doc.text(
      'Le nombre d\'anomalies détectées indique un potentiel problème critique. Priorisez les zones avec des anomalies élevées (voir section 2). Les prédictions LSTM suggèrent des tendances à surveiller (section 3). En cas de priorité "critique", une intervention immédiate est recommandée.',
      10,
      40
    );
    doc.text('Décision Recommandée :', 10, 60);
    doc.text(
      '1. Arrêter les zones à risque identifiées avec priorité "critique" ou "élevée".\n2. Effectuer une inspection technique dans les 24 heures.\n3. Réévaluer les seuils si les anomalies persistent après retrain du modèle.',
      10,
      70
    );

    // Sauvegarde du PDF
    doc.save('rapport_ziris_analyse_critique.pdf');
  };

  const filteredData = useMemo(() => {
    if (!dashboardData) return { total_sensors: 0, anomalies: 0 };
    if (selectedZone === 'all' && sensorType === 'all') {
      return { total_sensors: dashboardData.total_sensors, anomalies: dashboardData.anomalies };
    }
    return dashboardData.zones
      ? Object.keys(dashboardData.zones).reduce(
          (acc, zoneKey) => {
            const zone = dashboardData.zones[zoneKey];
            return {
              total_sensors: acc.total_sensors + (selectedZone === 'all' || selectedZone === zoneKey ? zone.total : 0),
              anomalies: acc.anomalies + (selectedZone === 'all' || selectedZone === zoneKey ? zone.anomalies : 0),
            };
          },
          { total_sensors: 0, anomalies: 0 }
        )
      : { total_sensors: 0, anomalies: 0 };
  }, [dashboardData, selectedZone, sensorType]);

  const chartData = useMemo(() => ({
    labels: ['Capteurs', 'Anomalies'],
    datasets: [
      {
        label: 'Statistiques',
        data: [filteredData.total_sensors, filteredData.anomalies],
        backgroundColor: ['#36A2EB', '#FF6384'],
        borderColor: ['#36A2EB', '#FF6384'],
        borderWidth: 1,
      },
    ],
  }), [filteredData]);

  const sensorChartData = useMemo(() => ({
    labels: ['Température', 'Pression', 'Vibration', 'Fumée'],
    datasets: [
      {
        label: 'Prédictions LSTM',
        data: lstmMetrics?.prediction || [0, 0, 0, 0],
        fill: false,
        borderColor: '#4BC0C0',
        tension: 0.1,
      },
    ],
  }), [lstmMetrics]);

  const zoneChartData = useMemo(() => ({
    labels: dashboardData?.zones ? Object.keys(dashboardData.zones) : [],
    datasets: [
      {
        label: 'Anomalies par zone',
        data: dashboardData?.zones ? Object.values(dashboardData.zones).map((z) => z.anomalies) : [],
        backgroundColor: '#FF9F40',
        borderColor: '#FF9F40',
        borderWidth: 1,
      },
    ],
  }), [dashboardData]);

  // Confusion matrix counts chart data (TP/FP/TN/FN)
  const cmCountsData = useMemo(() => ({
    labels: ['TP', 'FP', 'TN', 'FN'],
    datasets: [
      {
        label: 'Counts',
        data: lstmMetrics ? [lstmMetrics.tp, lstmMetrics.fp, lstmMetrics.tn, lstmMetrics.fn] : [0, 0, 0, 0],
        backgroundColor: ['#2ecc71', '#e74c3c', '#3498db', '#f1c40f'],
        borderColor: ['#27ae60', '#c0392b', '#2980b9', '#f39c12'],
        borderWidth: 1,
      },
    ],
  }), [lstmMetrics]);

  // Precision/Recall/F1 bar chart data (robust parsing + percentages)
  const cmScoresData = useMemo(() => {
    const toNum = (v: any) => {
      const n = Number(v);
      return Number.isFinite(n) ? n : 0;
    };
    const perc = (v: any) => Math.max(0, Math.min(100, toNum(v) * 100));
    return {
      labels: ['Precision', 'Recall', 'F1'],
      datasets: [
        {
          label: 'Scores (%)',
          data: lstmMetrics ? [perc(lstmMetrics.precision), perc(lstmMetrics.recall), perc(lstmMetrics.f1)] : [0, 0, 0],
          backgroundColor: ['#8e44ad', '#16a085', '#e67e22'],
          borderColor: ['#7d3c98', '#13866b', '#d35400'],
          borderWidth: 1,
        },
      ],
    };
  }, [lstmMetrics]);

  // Base options for charts, memoized to provide a stable reference
  const baseOptions = useMemo(() => ({
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
      title: { display: true, text: 'Vue d\'ensemble', color: theme === 'dark' ? '#e0e0e0' : '#333' },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items: any) => items?.[0]?.label || '',
          label: (ctx: any) => {
            const dsLabel = ctx.dataset?.label || '';
            const val = ctx.parsed?.y ?? ctx.parsed;
            let unit = '';
            if (/Temp/.test(dsLabel)) unit = '°C';
            else if (/Pression/.test(dsLabel)) unit = 'bars';
            else if (/Vibration/.test(dsLabel)) unit = 'mm/s';
            else if (/Fumée/.test(dsLabel)) unit = 'ppm';
            // Delta vs previous point (for time-series only and non-threshold datasets)
            let deltaStr = '';
            const isThreshold = /Seuil/.test(dsLabel);
            if (!isThreshold && Array.isArray(ctx.dataset?.data) && typeof ctx.dataIndex === 'number' && ctx.dataIndex > 0) {
              const prev = ctx.dataset.data[ctx.dataIndex - 1];
              if (typeof prev === 'number') {
                const d = (val as number) - prev;
                if (!Number.isNaN(d) && Number.isFinite(d)) {
                  const sign = d > 0 ? '+' : '';
                  deltaStr = ` (Δ ${sign}${d.toFixed(2)})`;
                }
              }
            }
            return `${dsLabel}: ${val}${unit ? ' ' + unit : ''}${deltaStr}`;
          },
        },
      },
      zoom: {
        pan: { enabled: true, mode: 'x' as const, modifierKey: 'shift' as const },
        zoom: {
          wheel: { enabled: true, modifierKey: 'ctrl' as const },
          pinch: { enabled: true },
          drag: { enabled: true },
          mode: 'x' as const,
          limits: { x: { min: 0 }, y: { min: 'original' as const } },
        },
      },
      decimation: {
        enabled: true,
        algorithm: 'lttb' as const,
        samples: 50,
      },
    },
    onHover: (event: any, elements: any[], chart: any) => {
      const idx = elements?.[0]?.index ?? null;
      syncHover(idx, chart);
    },
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Valeurs' }, ticks: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
      x: { ticks: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
    },
  }), [theme, syncHover]);

  // Specific options for CM charts
  const cmCountsOptions = useMemo(() => ({
    ...baseOptions,
    plugins: { ...baseOptions.plugins, title: { display: true, text: 'Matrice de confusion - Comptes', color: theme === 'dark' ? '#e0e0e0' : '#333' } },
  }), [baseOptions, theme]);

  const cmScoresOptions = useMemo(() => ({
    ...baseOptions,
    plugins: { ...baseOptions.plugins, title: { display: true, text: 'Scores de classification (%)', color: theme === 'dark' ? '#e0e0e0' : '#333' } },
    scales: {
      ...baseOptions.scales,
      y: { ...baseOptions.scales.y, beginAtZero: true, max: 100, ticks: { ...baseOptions.scales.y.ticks, callback: (v: any) => `${v}%` } },
    },
  }), [baseOptions, theme]);

  const realTimeChartData = useMemo(() => ({
    labels: realTimeData.timestamps,
    datasets: [
      {
        label: 'Température (°C)',
        data: realTimeData.temp,
        borderColor: '#FF6384',
        backgroundColor: '#FF638440',
        fill: true,
        tension: 0.1,
        // Highlight segments/points exceeding threshold
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.temp || y1 > thresholds.temp) ? '#ff2d55' : '#FF6384';
          },
          borderWidth: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.temp || y1 > thresholds.temp) ? 3 : 2;
          },
        },
        pointBackgroundColor: (ctx: any) => (ctx?.parsed?.y > thresholds.temp ? '#ff2d55' : '#FF6384'),
        pointRadius: (ctx: any) => (ctx?.parsed?.y > thresholds.temp ? 4 : 2),
      },
      {
        label: 'Pression (bars)',
        data: realTimeData.press,
        borderColor: '#36A2EB',
        backgroundColor: '#36A2EB40',
        fill: true,
        tension: 0.1,
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.press || y1 > thresholds.press) ? '#ff2d55' : '#36A2EB';
          },
          borderWidth: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.press || y1 > thresholds.press) ? 3 : 2;
          },
        },
        pointBackgroundColor: (ctx: any) => (ctx?.parsed?.y > thresholds.press ? '#ff2d55' : '#36A2EB'),
        pointRadius: (ctx: any) => (ctx?.parsed?.y > thresholds.press ? 4 : 2),
      },
      {
        label: 'Vibration (mm/s)',
        data: realTimeData.vib,
        borderColor: '#FF9F40',
        backgroundColor: '#FF9F4040',
        fill: true,
        tension: 0.1,
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.vib || y1 > thresholds.vib) ? '#ff2d55' : '#FF9F40';
          },
          borderWidth: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.vib || y1 > thresholds.vib) ? 3 : 2;
          },
        },
        pointBackgroundColor: (ctx: any) => (ctx?.parsed?.y > thresholds.vib ? '#ff2d55' : '#FF9F40'),
        pointRadius: (ctx: any) => (ctx?.parsed?.y > thresholds.vib ? 4 : 2),
      },
      {
        label: 'Fumée (ppm)',
        data: realTimeData.fumee,
        borderColor: '#4BC0C0',
        backgroundColor: '#4BC0C040',
        fill: true,
        tension: 0.1,
        segment: {
          borderColor: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.fumee || y1 > thresholds.fumee) ? '#ff2d55' : '#4BC0C0';
          },
          borderWidth: (ctx: any) => {
            const y0 = ctx?.p0?.parsed?.y;
            const y1 = ctx?.p1?.parsed?.y;
            return (y0 > thresholds.fumee || y1 > thresholds.fumee) ? 3 : 2;
          },
        },
        pointBackgroundColor: (ctx: any) => (ctx?.parsed?.y > thresholds.fumee ? '#ff2d55' : '#4BC0C0'),
        pointRadius: (ctx: any) => (ctx?.parsed?.y > thresholds.fumee ? 4 : 2),
      },
      // Threshold overlays (horizontal lines)
      {
        label: 'Seuil Temp',
        data: realTimeData.timestamps.map(() => thresholds.temp),
        borderColor: '#FF6384',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
      {
        label: 'Seuil Pression',
        data: realTimeData.timestamps.map(() => thresholds.press),
        borderColor: '#36A2EB',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
      {
        label: 'Seuil Vibration',
        data: realTimeData.timestamps.map(() => thresholds.vib),
        borderColor: '#FF9F40',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
      {
        label: 'Seuil Fumée',
        data: realTimeData.timestamps.map(() => thresholds.fumee),
        borderColor: '#4BC0C0',
        borderDash: [6, 4],
        pointRadius: 0,
        fill: false,
        tension: 0,
      },
    ],
  }), [realTimeData, thresholds]);

  const realTimeOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const, labels: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
      title: { display: true, text: 'Suivi en temps réel des capteurs', color: theme === 'dark' ? '#e0e0e0' : '#333' },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          title: (items: any) => items?.[0]?.label || '',
          label: (ctx: any) => {
            const dsLabel = ctx.dataset?.label || '';
            const val = ctx.parsed?.y ?? ctx.parsed;
            let unit = '';
            if (/Temp/.test(dsLabel)) unit = '°C';
            else if (/Pression/.test(dsLabel)) unit = 'bars';
            else if (/Vibration/.test(dsLabel)) unit = 'mm/s';
            else if (/Fumée/.test(dsLabel)) unit = 'ppm';
            let deltaStr = '';
            const isThreshold = /Seuil/.test(dsLabel);
            if (!isThreshold && Array.isArray(ctx.dataset?.data) && typeof ctx.dataIndex === 'number' && ctx.dataIndex > 0) {
              const prev = ctx.dataset.data[ctx.dataIndex - 1];
              if (typeof prev === 'number') {
                const d = (val as number) - prev;
                if (!Number.isNaN(d) && Number.isFinite(d)) {
                  const sign = d > 0 ? '+' : '';
                  deltaStr = ` (Δ ${sign}${d.toFixed(2)})`;
                }
              }
            }
            return `${dsLabel}: ${val}${unit ? ' ' + unit : ''}${deltaStr}`;
          },
        },
      },
      zoom: {
        pan: { enabled: true, mode: 'x' as const, modifierKey: 'shift' as const },
        zoom: {
          wheel: { enabled: true, modifierKey: 'ctrl' as const },
          pinch: { enabled: true },
          drag: { enabled: true },
          mode: 'x' as const,
          limits: { x: { min: 0 }, y: { min: 'original' as const } },
        },
      },
      decimation: {
        enabled: true,
        algorithm: 'lttb' as const,
        samples: 50,
      },
    },
    onHover: (event: any, elements: any[], chart: any) => {
      const idx = elements?.[0]?.index ?? null;
      syncHover(idx, chart);
    },
    animation: false as const,
    scales: {
      y: { beginAtZero: true, title: { display: true, text: 'Valeurs' }, ticks: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
      x: { ticks: { color: theme === 'dark' ? '#e0e0e0' : '#333' } },
    },
  };

  if (!dashboardData) return <p className="text-center mt-4">Chargement...</p>;

  return (
    <Container className={`mt-4 position-relative ${theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}`}>
      {showEffects && <ParticlesBackground />}
      <h1 className="mb-2">Tableau de bord ZIRIS</h1>
      {error && <Alert variant="danger">{error}</Alert>}
      {/* Real-time ticker */}
      {notifications.length > 0 && (
        <div className="ticker-wrap">
          <div className="ticker">
            {[...notifications, ...notifications].map((n, idx) => (
              <span key={n.id + '-' + idx} className="ticker-item">
                <Badge bg={levelVariant(n.level)}>{n.level.toUpperCase()}</Badge>
                <span>{n.ts} — {n.message}</span>
              </span>
            ))}
          </div>
        </div>
      )}
      {/* Toolbar: Help + Effects toggle */}
      <Row className="mb-3">
        <Col className="d-flex justify-content-end align-items-center gap-2">
          <Form.Check
            type="switch"
            id="toggle-effects"
            label={showEffects ? 'Effets visuels: on' : 'Effets visuels: off'}
            checked={showEffects}
            onChange={(e) => setShowEffects(e.currentTarget.checked)}
          />
          <Button
            variant="outline-info"
            size="sm"
            onClick={() => { setShowHelpModal(false); setShowHelpOffcanvas(true); }}
          >
            Aide
          </Button>
          <Button
            variant="info"
            size="sm"
            onClick={() => { setShowHelpOffcanvas(false); setShowHelpModal(true); }}
          >
            Guide
          </Button>
        </Col>
      </Row>
      {/* Confusion Matrix and Scores */}
      <Row className="mt-4">
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card">
            <Card.Title className="d-flex justify-content-between align-items-center">
              <span>Matrice de confusion (TP/FP/TN/FN)</span>
            </Card.Title>
            <div className="table-responsive mb-2">
              <Table size="sm" bordered className="mb-0">
                <thead>
                  <tr>
                    <th>TP</th>
                    <th>FP</th>
                    <th>TN</th>
                    <th>FN</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td>{lstmMetrics?.tp ?? 0}</td>
                    <td>{lstmMetrics?.fp ?? 0}</td>
                    <td>{lstmMetrics?.tn ?? 0}</td>
                    <td>{lstmMetrics?.fn ?? 0}</td>
                  </tr>
                </tbody>
              </Table>
            </div>
            <div className={`chart-container ${showEffects ? 'chart-glow' : ''}`} style={{ height: '220px' }} id="chart-cm-counts">
              <Bar data={cmCountsData} options={cmCountsOptions} />
            </div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card">
            <Card.Title className="d-flex justify-content-between align-items-center">
              <span>Scores de classification (Precision / Recall / F1)</span>
              <div className="d-flex gap-2">
                <Badge bg="success">Précision: {lstmMetrics ? (Number(lstmMetrics.precision) * 100).toFixed(1) : '0.0'}%</Badge>
                <Badge bg="info">Rappel: {lstmMetrics ? (Number(lstmMetrics.recall) * 100).toFixed(1) : '0.0'}%</Badge>
                <Badge bg="warning" text="dark">F1: {lstmMetrics ? (Number(lstmMetrics.f1) * 100).toFixed(1) : '0.0'}%</Badge>
              </div>
            </Card.Title>
            <div className={`chart-container ${showEffects ? 'chart-glow' : ''}`} style={{ height: '220px' }} id="chart-cm-scores">
              <Bar data={cmScoresData} options={cmScoresOptions} />
            </div>
          </Card>
        </Col>
      </Row>
      

      {/* Aide Offcanvas (compact) */}
      <Offcanvas placement="end" show={showHelpOffcanvas} onHide={() => setShowHelpOffcanvas(false)}>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Aide - Tableau de bord ZIRIS</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          <HelpContent variant="compact" />
        </Offcanvas.Body>
      </Offcanvas>
      <KPIHeader
        items={[
          { label: 'Capteurs', value: filteredData.total_sensors || 0 },
          { label: 'Anomalies', value: filteredData.anomalies || 0 },
          { label: 'Zones', value: dashboardData?.zones ? Object.keys(dashboardData.zones).length : 0 },
          { label: 'Précision LSTM (%)', value: lstmMetrics ? Math.round(lstmMetrics.accuracy * 100) : 0 },
          { label: 'MSE x100', value: lstmMetrics ? Math.round(lstmMetrics.mse * 100) : 0 },
        ]}
      />
      <Row className="mb-4">
        <Col md={4}>
          <Form.Control
            as="select"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="mb-2"
            aria-label="Sélectionner une zone"
          >
            <option value="all">Toutes les zones</option>
            {dashboardData.zones && Object.keys(dashboardData.zones).map((zone) => (
              <option key={zone} value={zone}>{zone}</option>
            ))}
          </Form.Control>
        </Col>
        <Col md={4}>
          <Form.Control
            as="select"
            value={sensorType}
            onChange={(e) => setSensorType(e.target.value)}
            className="mb-2"
            aria-label="Sélectionner un type de capteur"
          >
            <option value="all">Tous les types</option>
            <option value="temp">Température</option>
            <option value="humid">Humidité</option>
            <option value="fumee">Fumée</option>
            <option value="flamme">Flamme</option>
          </Form.Control>
        </Col>
        <Col md={4}>
          <Button variant="info" onClick={refreshNow} className="w-100 mb-2" aria-label="Rafraîchir les données" disabled={loadingRefresh}>
            {loadingRefresh ? 'Rafraîchissement…' : 'Rafraîchir'}
          </Button>
          <Button variant="secondary" onClick={() => seedNow(100)} className="w-100 mb-2" aria-label="Générer des données (dev)" disabled={loadingSeed}>
            {loadingSeed ? 'Génération…' : 'Seeder données (100)'}
          </Button>
          <Button variant="success" onClick={retrainModel} className="w-100" aria-label="Retrain LSTM" disabled={loadingRetrain}>
            {loadingRetrain ? 'Démarrage…' : 'Retrain LSTM'}
          </Button>
        </Col>
      </Row>
      {/* Toasts for live notifications */}
      <ToastContainer position="top-end" className="p-3">
        {notifications.map((n) => (
          <Toast key={n.id} bg={levelVariant(n.level)} onClose={() => removeNotification(n.id)} delay={5000} autohide>
            <Toast.Header closeButton>
              <strong className="me-auto">Notification</strong>
              <small>{n.ts}</small>
            </Toast.Header>
            <Toast.Body className="text-white">{n.message}</Toast.Body>
          </Toast>
        ))}
      </ToastContainer>
      <Row>
        <Col md={7}>
          <div className="table-responsive">
            <Table striped bordered hover className="shadow-sm neon-card">
              <thead className="bg-primary text-white">
                <tr>
                  <th>Total Capteurs</th>
                  <th>Anomalies</th>
                  <th>Dernière Mise à jour</th>
                  <th>Précision LSTM</th>
                  <th>MSE</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>{filteredData.total_sensors}</td>
                  <td>{filteredData.anomalies}</td>
                  <td>{dashboardData.last_update ? new Date(dashboardData.last_update).toLocaleString() : 'N/A'}</td>
                  <td>{lstmMetrics ? `${(lstmMetrics.accuracy * 100).toFixed(2)}%` : 'N/A'}</td>
                  <td>{lstmMetrics ? lstmMetrics.mse.toFixed(2) : 'N/A'}</td>
                </tr>
              </tbody>
            </Table>
          </div>
        </Col>
        <Col md={5}>
          <div className={`chart-container shadow-sm p-3 bg-white rounded neon-card ${showEffects ? 'chart-glow' : ''}`} style={{ height: '200px' }} id="chart-overview" role="img" aria-label="Graphique aperçu: zoom pincement, molette+Ctrl pour zoom, Shift pour déplacer" onDoubleClick={() => overviewChartRef.current?.resetZoom?.()}>
            <Bar ref={overviewChartRef} data={chartData} options={baseOptions} />
          </div>
          <Button size="sm" className="mt-2 neon-btn" onClick={() => overviewChartRef.current?.resetZoom?.()}>
            Réinitialiser le zoom
          </Button>
          <div className="form-text mt-1">Astuce: pincement pour zoomer, molette+Ctrl pour zoom, maintenir Shift pour déplacer</div>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col>
          <Card className="shadow-sm p-3 bg-white rounded neon-card" style={{ height: '320px' }}>
            <Card.Title>Suivi en temps réel des capteurs</Card.Title>
            <div className={`chart-container ${showEffects ? 'chart-glow' : ''}`} style={{ height: '250px', position: 'relative' }} id="chart-realtime" role="img" aria-label="Graphique temps réel: zoom pincement, molette+Ctrl pour zoom, Shift pour déplacer" onDoubleClick={() => realTimeChartRef.current?.resetZoom?.()}>
              <Line ref={realTimeChartRef} data={realTimeChartData} options={realTimeOptions} />
            </div>
            <div className="d-flex gap-2 mt-2">
              <Button size="sm" className="neon-btn" onClick={() => realTimeChartRef.current?.resetZoom?.()}>Reset zoom</Button>
              <Button size="sm" variant={realTimePaused ? 'warning' : 'success'} onClick={() => setRealTimePaused((p) => !p)}>
                {realTimePaused ? 'Reprendre' : 'Pause'}
              </Button>
            </div>
            <div className="form-text mt-1">Astuce: double-clic pour réinitialiser le zoom</div>
          </Card>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card">
            <Card.Title>Prédictions par capteur (Mesure en temps réel)</Card.Title>
            <div className={`chart-container ${showEffects ? 'chart-glow' : ''}`} style={{ height: '200px' }} id="chart-sensor" role="img" aria-label="Graphique capteur: zoom pincement, molette+Ctrl pour zoom, Shift pour déplacer" onDoubleClick={() => sensorChartRef.current?.resetZoom?.()}>
              <Line ref={sensorChartRef} data={sensorChartData} options={baseOptions} />
            </div>
            <Button size="sm" className="mt-2 neon-btn" onClick={() => sensorChartRef.current?.resetZoom?.()}>Reset zoom</Button>
            <div className="form-text mt-1">Astuce: pincement pour zoomer, molette+Ctrl pour zoom</div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card">
            <Card.Title>Graphique par zone (Mesure en temps réel)</Card.Title>
            <div className={`chart-container ${showEffects ? 'chart-glow' : ''}`} style={{ height: '200px' }} id="chart-zone" role="img" aria-label="Graphique zone: zoom pincement, molette+Ctrl pour zoom, Shift pour déplacer" onDoubleClick={() => zoneChartRef.current?.resetZoom?.()}>
              <Bar ref={zoneChartRef} data={zoneChartData} options={baseOptions} />
            </div>
            <Button size="sm" className="mt-2 neon-btn" onClick={() => zoneChartRef.current?.resetZoom?.()}>Reset zoom</Button>
            <div className="form-text mt-1">Astuce: double-clic pour réinitialiser le zoom</div>
          </Card>
        </Col>
      </Row>
      <Row className="mt-4">
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card">
            <Card.Title className="d-flex justify-content-between align-items-center">
              <span>Seaux d'anomalie personnalisés</span>
              <Button size="sm" variant="outline-success" onClick={applyAllSuggestions}>Appliquer toutes les suggestions</Button>
            </Card.Title>
            <Form>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex justify-content-between align-items-center">
                  <span>Température (°C)</span>
                  <Button size="sm" variant="outline-info" onClick={() => suggestThreshold('temp')}>Générer seuil critique</Button>
                </Form.Label>
                <Form.Control type="number" name="temp" value={thresholds.temp} onChange={handleThresholdChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex justify-content-between align-items-center">
                  <span>Pression (bars)</span>
                  <Button size="sm" variant="outline-info" onClick={() => suggestThreshold('press')}>Générer seuil critique</Button>
                </Form.Label>
                <Form.Control type="number" name="press" value={thresholds.press} onChange={handleThresholdChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex justify-content-between align-items-center">
                  <span>Vibration (mm/s)</span>
                  <Button size="sm" variant="outline-info" onClick={() => suggestThreshold('vib')}>Générer seuil critique</Button>
                </Form.Label>
                <Form.Control type="number" name="vib" value={thresholds.vib} onChange={handleThresholdChange} />
              </Form.Group>
              <Form.Group className="mb-3">
                <Form.Label className="d-flex justify-content-between align-items-center">
                  <span>Fumée (ppm)</span>
                  <Button size="sm" variant="outline-info" onClick={() => suggestThreshold('fumee')}>Générer seuil critique</Button>
                </Form.Label>
                <Form.Control type="number" name="fumee" value={thresholds.fumee} onChange={handleThresholdChange} />
              </Form.Group>
            </Form>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="shadow-sm p-3 bg-white rounded neon-card" style={{ maxHeight: '300px', overflowY: 'auto' }}>
            <Card.Title>Recommandations (Basées sur les anomalies)</Card.Title>
            {recommendations.length > 0 ? (
              <ul className="list-group">
                {recommendations.map((rec) => (
                  <li
                    key={rec.id}
                    className="list-group-item"
                    style={{ backgroundColor: rec.priority === 'critique' ? '#ff4d4d' : rec.priority === 'élevée' ? '#ffcc00' : '#ffffff', cursor: 'pointer' }}
                    onClick={() => { setSelectedRec(rec); setShowDrill(true); }}
                  >
                    <strong>Zone:</strong> {rec.zone} <br />
                    <strong>Zone à risque:</strong> {rec.risk_area} <br />
                    <strong>Date:</strong> {new Date(rec.timestamp).toLocaleString()} <br />
                    <strong>Raisons:</strong> {rec.reasons.length > 0 ? rec.reasons.join(', ') : 'Aucune raison spécifiée'} <br />
                    <strong>Priorité:</strong> {rec.priority} <br />
                    <strong>Action:</strong> {rec.recommendation}
                  </li>
                ))}
              </ul>
            ) : (
              <p>Aucune recommandation pour le moment.</p>
            )}
          </Card>
        </Col>
      </Row>
      {/* Drill-down Offcanvas */}
      <Offcanvas show={showDrill} onHide={() => setShowDrill(false)} placement="end" backdrop scroll>
        <Offcanvas.Header closeButton>
          <Offcanvas.Title>Détail de l'anomalie</Offcanvas.Title>
        </Offcanvas.Header>
        <Offcanvas.Body>
          {selectedRec ? (
            <div>
              <p><strong>Zone:</strong> {selectedRec.zone}</p>
              <p><strong>Zone à risque:</strong> {selectedRec.risk_area}</p>
              <p><strong>Horodatage:</strong> {new Date(selectedRec.timestamp).toLocaleString()}</p>
              <p><strong>Priorité:</strong> {selectedRec.priority}</p>
              <p><strong>Raisons:</strong> {selectedRec.reasons.join(', ')}</p>
              <p><strong>Recommandation:</strong> {selectedRec.recommendation}</p>
              <hr />
              <p className="text-muted">Aperçu: valeurs récentes vs seuils. Utilise les charts existants avec surbrillance au survol synchronisé.</p>
            </div>
          ) : (
            <p>Aucune sélection</p>
          )}
        </Offcanvas.Body>
      </Offcanvas>
      <Row className="mt-4">
        <Col>
          <Button variant="info" onClick={() => setShowHelpModal(true)} aria-label="Afficher l'aide (Guide)">
            Aide
          </Button>
          <Button variant="success" onClick={exportPDF} className="ms-2" aria-label="Exporter en PDF">
            Exporter PDF
          </Button>
          <Button
            variant={theme === 'dark' ? 'light' : 'dark'}
            onClick={toggleTheme}
            className="ms-2"
            aria-label="Basculer le thème"
          >
            {theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
          </Button>
        </Col>
      </Row>
      <Modal show={showHelpModal} onHide={() => setShowHelpModal(false)} size="lg" aria-labelledby="help-modal-title" className="animate-fade-in">
        <Modal.Header closeButton className="bg-info text-white animate-slide-down">
          <Modal.Title id="help-modal-title" className="font-poppins font-bold">
            Bienvenue dans l'Aide ZIRIS
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <HelpContent variant="full" />
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="primary" onClick={() => setShowHelpModal(false)} className="animate-bounce-in">
            Fermer et Explorer ZIRIS
          </Button>
        </Modal.Footer>
      </Modal>
      <style>
  {`
    @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');

    .font-poppins {
      font-family: 'Poppins', sans-serif;
    }

    .animate-fade-in {
      animation: fadeIn 0.8s ease-in-out forwards;
      opacity: 0;
    }

    .animate-fade-in-delay {
      animation: fadeIn 1s ease-in-out forwards 0.2s;
      opacity: 0;
    }

    .animate-fade-in-delay-2 {
      animation: fadeIn 1.2s ease-in-out forwards 0.4s;
      opacity: 0;
    }

    .animate-slide-down {
      animation: slideDown 0.6s ease-out forwards;
    }

    .animate-slide-up {
      animation: slideUp 0.6s ease-out forwards;
    }

    .animate-pulse-slow {
      animation: pulseSlow 2s infinite;
    }

    .animate-bounce-in {
      animation: bounceIn 0.5s ease-out;
    }

    .hover-glow {
      color: #4B5EAA;
      text-shadow: 0 0 10px rgba(75, 94, 170, 0.7);
      transition: all 0.3s ease;
    }

    @keyframes fadeIn {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    @keyframes slideDown {
      from { transform: translateY(-20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @keyframes slideUp {
      from { transform: translateY(20px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }

    @keyframes pulseSlow {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.05); }
    }

    @keyframes bounceIn {
      0% { transform: scale(0.9); }
      50% { transform: scale(1.1); }
      100% { transform: scale(1); }
    }

    .welcome-animation h2::before {
      content: '🌟 ';
      animation: spin 2s linear infinite;
    }

    @keyframes spin {
      from { transform: rotate(0deg); }
      to { transform: rotate(360deg); }
    }

    @media (max-width: 768px) {
      .text-2xl { font-size: 1.5rem; }
      .text-xl { font-size: 1.2rem; }
      .text-lg { font-size: 1rem; }
    }
  `}
</style>
    </Container>
  );
};

export default Dashboard;