import React, { useState } from 'react';
import { Card, Button, Form, Alert, Spinner, Row, Col } from 'react-bootstrap';
import api from '../api/client';

const AdminModelOps: React.FC = () => {
  const [seedN, setSeedN] = useState<number>(100);
  const [ingestPayload, setIngestPayload] = useState<string>('[\n  {"zone":"A","temperature":70,"pression":5,"vibration":3,"fumee":50,"flamme":false,"anomaly":false}\n]');
  const [loading, setLoading] = useState<boolean>(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const doSeed = async () => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const res = await api.post(`/dev/seed?n=${seedN}`);
      setMsg(`Seed ok: ${res.data?.inserted ?? 0} lignes.`);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Échec seed');
    } finally { setLoading(false); }
  };

  const doRetrain = async () => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const res = await api.get('/retrain-lstm');
      setMsg(res.data?.status || 'Retrain démarré');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Échec retrain');
    } finally { setLoading(false); }
  };

  const doIngest = async () => {
    setLoading(true); setMsg(null); setError(null);
    try {
      const data = JSON.parse(ingestPayload);
      const res = await api.post('/sensor-data/ingest', data);
      setMsg(`Ingest ok: ${res.data?.inserted ?? 0} lignes.`);
    } catch (e: any) {
      setError(e?.message || e?.response?.data?.detail || 'Échec ingest (JSON?)');
    } finally { setLoading(false); }
  };

  return (
    <div className="p-3">
      <h3>Modèle & Données</h3>
      {msg && <Alert variant="success" dismissible onClose={() => setMsg(null)}>{msg}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}

      <Row className="g-3">
        <Col md={6}>
          <Card className="p-3">
            <h5>Seed données (dev)</h5>
            <div className="d-flex align-items-center gap-2">
              <Form.Control type="number" value={seedN} onChange={(e) => setSeedN(parseInt(e.target.value || '0', 10))} style={{maxWidth:120}} />
              <Button onClick={doSeed} disabled={loading}>{loading ? <Spinner size="sm" animation="border" /> : 'Générer'}</Button>
            </div>
          </Card>
        </Col>
        <Col md={6}>
          <Card className="p-3">
            <h5>Retrain LSTM</h5>
            <Button onClick={doRetrain} disabled={loading}>{loading ? <Spinner size="sm" animation="border" /> : 'Lancer retrain'}</Button>
          </Card>
        </Col>
        <Col md={12}>
          <Card className="p-3">
            <h5>Ingest JSON</h5>
            <Form.Control as="textarea" rows={8} value={ingestPayload} onChange={(e) => setIngestPayload(e.target.value)} />
            <div className="mt-2">
              <Button onClick={doIngest} disabled={loading}>{loading ? <Spinner size="sm" animation="border" /> : 'Envoyer'}</Button>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default AdminModelOps;
