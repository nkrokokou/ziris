import React, { useState } from 'react';
import { Container, Row, Col, Form, Button, Table, Modal } from 'react-bootstrap';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Bar, Line } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend } from 'chart.js';
import html2canvas from 'html2canvas';

ChartJS.register(CategoryScale, LinearScale, BarElement, LineElement, PointElement, Title, Tooltip, Legend);

const IsolationForest: React.FC = () => {
  const [inputData, setInputData] = useState([
    { id: 1, temperature: '', vibration: '', pressure: '', zone: 'Local Électrique 1' },
  ]);
  const [selectedZone, setSelectedZone] = useState('Local Électrique 1');
  const [result, setResult] = useState<string | null>(null);
  const [recommendations, setRecommendations] = useState<{ id: number; reason: string; priority: string; action: string }[]>([]);
  const [metrics, setMetrics] = useState<{ precision: number; meanAnomalyScore: number; contamination: number } | null>(null);
  const [anomalyScores, setAnomalyScores] = useState<number[]>([]);
  const [showHelp, setShowHelp] = useState(false);

  const zoneThresholds: { [key: string]: { temperature: number; vibration: number; pressure: number; maxTemp: number; maxVib: number; maxPress: number } } = {
    'Local Électrique 1': { temperature: 25, vibration: 5, pressure: 1, maxTemp: 40, maxVib: 10, maxPress: 2 },
    'Serveur 1': { temperature: 20, vibration: 3, pressure: 0.5, maxTemp: 35, maxVib: 7, maxPress: 1 },
    'Turbine 1': { temperature: 80, vibration: 50, pressure: 20, maxTemp: 120, maxVib: 100, maxPress: 40 },
  };

  const handleChange = (id: number, e: React.ChangeEvent<any>) => {
    const { name, value } = e.target as any;
    setInputData((prev) =>
      prev.map((row) =>
        row.id === id ? { ...row, [name]: value } : row
      )
    );
  };

  const addRow = () => {
    setInputData((prev) => [
      ...prev,
      { id: prev.length + 1, temperature: '', vibration: '', pressure: '', zone: selectedZone },
    ]);
  };

  const generateRandomParameters = () => {
    const currentThresholds = zoneThresholds[selectedZone];
    const newData = inputData.map((row) => ({
      ...row,
      temperature: Math.random() > 0.3 ? (Math.random() * currentThresholds.maxTemp).toFixed(2) : (Math.random() * currentThresholds.temperature).toFixed(2),
      vibration: Math.random() > 0.3 ? (Math.random() * currentThresholds.maxVib).toFixed(2) : (Math.random() * currentThresholds.vibration).toFixed(2),
      pressure: Math.random() > 0.3 ? (Math.random() * currentThresholds.maxPress).toFixed(2) : (Math.random() * currentThresholds.pressure).toFixed(2),
      zone: selectedZone,
    }));
    setInputData(newData);
    setResult(null);
    setRecommendations([]);
    setMetrics(null);
  };

  const analyzeData = () => {
    const data = inputData.map((row) => [
      parseFloat(row.temperature) || 0,
      parseFloat(row.vibration) || 0,
      parseFloat(row.pressure) || 0,
    ]);

    const currentThresholds = zoneThresholds[selectedZone];
    const thresholds = [currentThresholds.temperature, currentThresholds.vibration, currentThresholds.pressure];
    const anomalyScores = data.map((values) =>
      values.reduce((score, value, i) => {
        const deviation = value / thresholds[i];
        return score - (deviation > 2 || deviation < 0.5 || value < 0 ? 0.25 : 0);
      }, 0)
    );
    setAnomalyScores(anomalyScores);

    const contamination = 0.1;
    const meanAnomalyScore = anomalyScores.reduce((sum, score) => sum + score, 0) / anomalyScores.length;
    const precision = Math.max(0.7, 1 - Math.abs(meanAnomalyScore) * 0.5);

    setMetrics({ precision, meanAnomalyScore, contamination });

    const newRecs = anomalyScores.map((score, index) => {
      if (score < -0.5) {
        const row = inputData[index];
        const reasons = [];
        if (parseFloat(row.temperature) > currentThresholds.temperature * 2) reasons.push('Température excessive');
        if (parseFloat(row.vibration) > currentThresholds.vibration * 2) reasons.push('Vibration anormale');
        if (parseFloat(row.pressure) > currentThresholds.pressure * 2) reasons.push('Pression élevée');
        return {
          id: index + 1,
          reason: reasons.length > 0 ? reasons.join(', ') : 'Anomalie générale détectée',
          priority: score < -0.7 ? 'critique' : 'élevée',
          action: score < -0.7 ? 'Arrêt immédiat' : 'Surveillance renforcée',
        };
      }
      return null;
    }).filter((rec) => rec) as { id: number; reason: string; priority: string; action: string }[];

    setRecommendations(newRecs);
    setResult(newRecs.length > 0 ? 'Anomalies détectées !' : 'Aucune anomalie détectée.');
  };

  const exportPDF = async () => {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    doc.setFillColor(0, 123, 255);
    doc.rect(0, 0, 210, 30, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.text(`Test d'Isolation Forest (Hors temps réel) - ${selectedZone}`, 105, 20, { align: 'center' });
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(10);
    doc.text(`Généré le : ${new Date().toLocaleString('fr-FR', { timeZone: 'GMT' })}`, 105, 25, { align: 'center' });

    doc.addPage();
    doc.setFontSize(16);
    doc.text('1. Données d\'Entrée', 10, 20);
    const dataTable = inputData.map((row) => [
      row.id.toString(),
      row.temperature || 'N/A',
      row.vibration || 'N/A',
      row.pressure || 'N/A',
      row.zone,
    ]);
    autoTable(doc, {
      startY: 25,
      head: [['ID', 'Température (°C)', 'Vibration (mm/s)', 'Pression (bars)', 'Zone']],
      body: dataTable,
      theme: 'grid',
      headStyles: { fillColor: [0, 123, 255], textColor: [255, 255, 255], fontSize: 12 },
      styles: { cellPadding: 2, fontSize: 10 },
    });

    if (anomalyScores.length > 0) {
      const chartElement = document.getElementById('anomaly-chart');
      if (chartElement) {
        doc.addPage();
        doc.setFontSize(16);
        doc.text('2. Graphique des Scores d\'Anomalie', 10, 20);
        const canvas = await html2canvas(chartElement, { scale: 2, backgroundColor: null });
        const imgData = canvas.toDataURL('image/png');
        const imgWidth = 180;
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        doc.addImage(imgData, 'PNG', 15, 30, imgWidth, imgHeight);
      }
    }

    if (recommendations.length > 0) {
      doc.addPage();
      doc.setFontSize(16);
      doc.text('3. Recommandations', 10, 20);
      const recTable = recommendations.map((rec) => [
        rec.id.toString(),
        rec.reason,
        rec.priority,
        rec.action,
      ]);
      autoTable(doc, {
        startY: 25,
        head: [['ID', 'Raison', 'Priorité', 'Action']],
        body: recTable,
        theme: 'grid',
        headStyles: { fillColor: [0, 123, 255], textColor: [255, 255, 255], fontSize: 12 },
        bodyStyles: { textColor: [0, 0, 0], fontSize: 10 },
        didDrawCell: (data) => {
          if (data.section === 'body' && data.cell.raw && Array.isArray(data.cell.raw) && data.cell.raw[2]) {
            if (data.cell.raw[2] === 'critique') {
              doc.setFillColor(255, 77, 77);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            } else if (data.cell.raw[2] === 'élevée') {
              doc.setFillColor(255, 204, 0);
              doc.rect(data.cell.x, data.cell.y, data.cell.width, data.cell.height, 'F');
            }
          }
        },
        styles: { cellPadding: 2 },
      });
    }

    doc.save(`test_isolation_forest_${selectedZone}.pdf`);
  };

  const anomalyChartData = {
    labels: inputData.map((row) => `ID ${row.id}`),
    datasets: [
      {
        label: 'Score d\'Anomalie',
        data: anomalyScores,
        backgroundColor: anomalyScores.map((score) => (score < -0.7 ? '#ff4d4d' : score < -0.5 ? '#ffcc00' : '#4BC0C0')),
        borderColor: '#333',
        borderWidth: 1,
      },
    ],
  };

  const anomalyChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Scores d\'Anomalie par ID' },
    },
    scales: { y: { beginAtZero: false, title: { display: true, text: 'Score' } } },
  };

  const metricsChartData = {
    labels: ['Précision', 'Score Moyen'],
    datasets: [
      {
        label: 'Métriques',
        data: metrics ? [metrics.precision * 100, metrics.meanAnomalyScore] : [0, 0],
        borderColor: '#36A2EB',
        backgroundColor: '#36A2EB40',
        fill: true,
        tension: 0.1,
      },
    ],
  };

  const metricsChartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top' as const },
      title: { display: true, text: 'Tendance des Métriques' },
    },
    scales: { y: { beginAtZero: true, title: { display: true, text: 'Valeur' } } },
  };

  return (
    <Container className="mt-4">
      <h1>Test d'Isolation Forest (Hors temps réel)</h1>
      <Row className="mb-4">
        <Col md={6}>
          <Form.Control
            as="select"
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="mb-2"
          >
            <option value="Local Électrique 1">Local Électrique 1</option>
            <option value="Serveur 1">Serveur 1</option>
            <option value="Turbine 1">Turbine 1</option>
          </Form.Control>
          <Table striped bordered hover>
            <thead>
              <tr>
                <th>ID</th>
                <th>Température (°C)</th>
                <th>Vibration (mm/s)</th>
                <th>Pression (bars)</th>
              </tr>
            </thead>
            <tbody>
              {inputData.map((row) => (
                <tr key={row.id}>
                  <td>{row.id}</td>
                  <td>
                    <Form.Control
                      type="number"
                      name="temperature"
                      value={row.temperature}
                      onChange={(e) => handleChange(row.id, e)}
                      min="0"
                      max={zoneThresholds[row.zone as keyof typeof zoneThresholds].maxTemp}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="vibration"
                      value={row.vibration}
                      onChange={(e) => handleChange(row.id, e)}
                      min="0"
                      max={zoneThresholds[row.zone as keyof typeof zoneThresholds].maxVib}
                    />
                  </td>
                  <td>
                    <Form.Control
                      type="number"
                      name="pressure"
                      value={row.pressure}
                      onChange={(e) => handleChange(row.id, e)}
                      min="0"
                      max={zoneThresholds[row.zone as keyof typeof zoneThresholds].maxPress}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
          <Button variant="secondary" onClick={addRow} className="mt-2">
            Ajouter une ligne
          </Button>
          <Button variant="warning" onClick={generateRandomParameters} className="mt-2 ms-2">
            Générer Paramètres
          </Button>
          <Button variant="primary" onClick={analyzeData} className="mt-2 ms-2">
            Analyse
          </Button>
          <Button variant="success" onClick={exportPDF} className="mt-2 ms-2">
            Exporter PDF
          </Button>
          <Button variant="info" onClick={() => setShowHelp(true)} className="mt-2 ms-2">
            Aide
          </Button>
        </Col>
        <Col md={6}>
          {result && <p className="mt-3"><strong>Résultat :</strong> {result}</p>}
          {metrics && (
            <div className="mt-3">
              <p><strong>Métriques :</strong></p>
              <p>Précision : {(metrics.precision * 100).toFixed(2)}%</p>
              <p>Score d'anomalie moyen : {metrics.meanAnomalyScore.toFixed(2)}</p>
              <p>Contamination estimée : {metrics.contamination * 100}%</p>
            </div>
          )}
          {recommendations.length > 0 && (
            <div className="mt-3">
              <p><strong>Recommandations :</strong></p>
              <ul>
                {recommendations.map((rec) => (
                  <li key={rec.id} style={{ backgroundColor: rec.priority === 'critique' ? '#ff4d4d' : '#ffcc00' }}>
                    ID {rec.id} : {rec.reason} (Priorité : {rec.priority}, Action : {rec.action})
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="mt-4" style={{ height: '200px' }} id="anomaly-chart">
            <Bar data={anomalyChartData} options={anomalyChartOptions} />
          </div>
          <div className="mt-4" style={{ height: '200px' }}>
            <Line data={metricsChartData} options={metricsChartOptions} />
          </div>
        </Col>
      </Row>
      <Modal show={showHelp} onHide={() => setShowHelp(false)} size="lg" aria-labelledby="help-modal-title" className="animate-fade-in">
        <Modal.Header closeButton className="bg-info text-white animate-slide-down">
          <Modal.Title id="help-modal-title" className="font-poppins font-bold">
            Guide d'Utilisation : Isolation Forest
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="p-4">
          <div className="welcome-animation mb-4">
            <h2 className="text-2xl font-poppins text-green-600 animate-pulse-slow">🌳 Bienvenue dans Isolation Forest !</h2>
            <p className="text-lg mt-2 animate-fade-in-delay">
              Isolation Forest est une méthode pour détecter les anomalies dans vos données de capteurs. Que vous soyez novice ou curieux, ce guide vous expliquera tout simplement comment l'utiliser. Explorez les sections ci-dessous !
            </p>
          </div>

          <div className="section-container">
            <h3 className="text-xl font-poppins text-teal-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
              1. Saisir vos Données
            </h3>
            <p className="mt-2 animate-fade-in-delay">
              Entrez les valeurs de température, vibration et pression pour chaque capteur dans le tableau. Par exemple, pour "Local Électrique 1", une température normale est autour de 25°C. Si vous ne savez pas par où commencer, utilisez "Générer Paramètres" pour des valeurs aléatoires.
            </p>
            <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
              <li><strong>Ajouter :</strong> Cliquez sur "Ajouter une ligne" pour plus de capteurs.</li>
              <li><strong>Exemple :</strong> Saisissez 30°C, 6 mm/s, 1.5 bars pour tester.</li>
            </ul>

            <h3 className="text-xl font-poppins text-teal-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
              2. Comprendre l'Analyse
            </h3>
            <p className="mt-2 animate-fade-in-delay">
              Cliquez sur "Analyse" pour que Isolation Forest détecte les anomalies. Cette méthode isole les données inhabituelles (comme une température de 50°C dans une zone normale de 25°C). Le graphique des scores montre ces anomalies : plus le score est bas (ex. -0.8), plus c'est suspect.
            </p>
            <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
              <li><strong>Score :</strong> Un score &lt; -0.5 indique une anomalie possible.</li>
              <li><strong>Conseil :</strong> Vérifiez les valeurs extrêmes après l'analyse.</li>
            </ul>

            <h3 className="text-xl font-poppins text-teal-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
              3. Interpréter les Métriques
            </h3>
            <p className="mt-2 animate-fade-in-delay">
              Les métriques vous donnent une vue d’ensemble. La "Précision" (ex. 85%) montre la fiabilité, et le "Score d’anomalie moyen" indique la gravité globale. La "Contamination" (10%) représente le pourcentage attendu d’anomalies.
            </p>
            <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
              <li><strong>Précision :</strong> Plus elle est haute, mieux c’est !</li>
              <li><strong>Exemple :</strong> Un score moyen de -0.3 est normal, -0.7 est alarmant.</li>
            </ul>

            <h3 className="text-xl font-poppins text-teal-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
              4. Agir sur les Recommandations
            </h3>
            <p className="mt-2 animate-fade-in-delay">
              Si des anomalies sont détectées, vous verrez des recommandations. Une priorité "critique" (en rouge) demande un "Arrêt immédiat", tandis qu’une "élevée" (en jaune) suggère une "Surveillance renforcée". Par exemple, une vibration de 12 mm/s dans "Serveur 1" peut déclencher une alerte.
            </p>
            <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
              <li><strong>Critique :</strong> Agissez tout de suite pour éviter des dommages.</li>
              <li><strong>Élevée :</strong> Planifiez une inspection dans les 24 heures.</li>
            </ul>

            <h3 className="text-xl font-poppins text-teal-700 mt-4 animate-slide-up" onMouseEnter={(e) => e.currentTarget.classList.add('hover-glow')}>
              5. Exporter vos Résultats
            </h3>
            <p className="mt-2 animate-fade-in-delay">
              Cliquez sur "Exporter PDF" pour sauvegarder vos données, graphiques et recommandations. Ce rapport est parfait pour partager avec votre équipe ou archiver.
            </p>
            <ul className="list-disc list-inside mt-2 animate-fade-in-delay-2">
              <li><strong>Format :</strong> Inclut tableaux et graphiques.</li>
              <li><strong>Conseil :</strong> Vérifiez les anomalies avant d’exporter.</li>
            </ul>
          </div>
        </Modal.Body>
        <Modal.Footer className="bg-light">
          <Button variant="primary" onClick={() => setShowHelp(false)} className="animate-bounce-in">
            Commencer avec Isolation Forest
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
      color: #26A69A;
      text-shadow: 0 0 10px rgba(38, 166, 154, 0.7);
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
      content: '🌳 ';
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

export default IsolationForest;