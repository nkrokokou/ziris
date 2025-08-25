import React, { useCallback, useEffect, useState } from 'react';
import { Button, Table, Alert, Spinner, Form, Row, Col } from 'react-bootstrap';
import api from '../api/client';

interface JobSummary {
  id: string;
  type: string;
  status: string;
  progress: number;
  updated_at: string;
}

const AdminJobs: React.FC = () => {
  const [jobs, setJobs] = useState<JobSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [poll, setPoll] = useState<boolean>(true);
  const [nSeed, setNSeed] = useState<number>(200);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<JobSummary[]>('/jobs');
      setJobs(res.data || []);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur lors du chargement des jobs');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    if (!poll) return;
    const t = setInterval(load, 1500);
    return () => clearInterval(t);
  }, [poll, load]);

  const startSeed = async () => {
    setError(null);
    try {
      await api.post('/jobs/seed', null, { params: { n: nSeed } });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Impossible de démarrer le job de seed');
    }
  };

  const startRetrain = async () => {
    setError(null);
    try {
      await api.post('/jobs/retrain');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Impossible de démarrer le job de retrain');
    }
  };

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Jobs</h3>
        <Form.Check
          type="switch"
          id="poll-switch"
          label="Auto-refresh"
          checked={poll}
          onChange={(e) => setPoll(e.currentTarget.checked)}
        />
      </div>

      <Form className="mb-3">
        <Row className="g-2 align-items-end">
          <Col xs={6} md={2}>
            <Form.Label>Nombre à insérer</Form.Label>
            <Form.Control type="number" value={nSeed} min={1} max={10000} onChange={e => setNSeed(Number(e.target.value))} />
          </Col>
          <Col xs="auto">
            <Button variant="primary" onClick={startSeed}>Démarrer Seed</Button>
          </Col>
          <Col xs="auto">
            <Button variant="secondary" onClick={startRetrain}>Démarrer Retrain</Button>
          </Col>
        </Row>
      </Form>

      {error && <Alert variant="danger">{error}</Alert>}
      {loading && <div className="mb-2"><Spinner size="sm" animation="border" /> Chargement...</div>}

      <Table striped bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Statut</th>
            <th>Progress</th>
            <th>Mis à jour</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.id}>
              <td style={{fontFamily:'monospace'}}>{j.id.slice(0, 8)}</td>
              <td>{j.type}</td>
              <td>{j.status}</td>
              <td>{j.progress}%</td>
              <td>{new Date(j.updated_at).toLocaleTimeString()}</td>
            </tr>
          ))}
          {!jobs.length && (
            <tr>
              <td colSpan={5} className="text-center text-muted">Aucun job</td>
            </tr>
          )}
        </tbody>
      </Table>
    </div>
  );
};

export default AdminJobs;
