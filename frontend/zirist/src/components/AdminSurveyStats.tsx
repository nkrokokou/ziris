import React, { useEffect, useMemo, useState } from 'react';
import { Container, Row, Col, Card, Button, Alert, Table } from 'react-bootstrap';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import api from '../api/client';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface SurveyStatsDto {
  total: number;
  favorable: number;
  by_question_mean: Record<string, number>;
  by_question_std: Record<string, number>;
  freq_distribution: Record<string, number>;
}

const AdminSurveyStats: React.FC = () => {
  const [data, setData] = useState<SurveyStatsDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get('/survey/stats');
      setData(res.data);
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const seed = async () => {
    setLoading(true);
    setError(null);
    try {
      await api.post('/survey/seed?n=20&favorable_count=16');
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const barMeans = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.by_question_mean);
    const means = labels.map((k) => data.by_question_mean[k]);
    return {
      labels,
      datasets: [{
        label: 'Moyenne (1-5)',
        data: means,
        backgroundColor: 'rgba(54, 162, 235, 0.5)'
      }]
    };
  }, [data]);

  const barFreq = useMemo(() => {
    if (!data) return null;
    const labels = Object.keys(data.freq_distribution);
    const vals = labels.map((k) => data.freq_distribution[k]);
    return {
      labels,
      datasets: [{
        label: 'Fréquence problèmes techniques',
        data: vals,
        backgroundColor: 'rgba(255, 159, 64, 0.5)'
      }]
    };
  }, [data]);

  return (
    <Container className="py-4">
      <Row>
        <Col>
          <div className="d-flex align-items-center justify-content-between mb-3">
            <h3>Statistiques Questionnaire</h3>
            <div>
              <Button className="me-2" onClick={load} disabled={loading}>Rafraîchir</Button>
              <Button variant="secondary" onClick={seed} disabled={loading}>Seeder 20 (16 favorables)</Button>
            </div>
          </div>
          {error && <Alert variant="danger">{error}</Alert>}
        </Col>
      </Row>

      {data && (
        <>
          <Row className="mb-3">
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Body>
                  <Card.Title>Résumé</Card.Title>
                  <Table borderless size="sm" className="mb-0">
                    <tbody>
                      <tr><td>Total réponses</td><td><strong>{data.total}</strong></td></tr>
                      <tr><td>Favorables (≥ 4)</td><td><strong>{data.favorable}</strong></td></tr>
                    </tbody>
                  </Table>
                </Card.Body>
              </Card>
            </Col>
            <Col md={6}>
              <Card className="shadow-sm">
                <Card.Body>
                  <Card.Title>Fréquence problèmes techniques</Card.Title>
                  {barFreq && <Bar data={barFreq} />}
                </Card.Body>
              </Card>
            </Col>
          </Row>
          <Row>
            <Col>
              <Card className="shadow-sm">
                <Card.Body>
                  <Card.Title>Moyennes par question</Card.Title>
                  {barMeans && <Bar data={barMeans} />}
                </Card.Body>
              </Card>
            </Col>
          </Row>
        </>
      )}
    </Container>
  );
};

export default AdminSurveyStats;
