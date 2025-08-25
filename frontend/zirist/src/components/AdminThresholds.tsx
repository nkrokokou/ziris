import React, { useEffect, useState } from 'react';
import { Card, Form, Button, Row, Col, Alert, Spinner } from 'react-bootstrap';
import api from '../api/client';

type Thresholds = { temp: number; press: number; vib: number; fumee: number };

const AdminThresholds: React.FC = () => {
  const [values, setValues] = useState<Thresholds>({ temp: 0, press: 0, vib: 0, fumee: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<Thresholds>('/thresholds');
      setValues(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur chargement seuils');
    } finally {
      setLoading(false);
    }
  };

  const suggest = async () => {
    try {
      const res = await api.get<Thresholds>('/thresholds/suggest');
      setValues(res.data);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur suggestion des seuils');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    try {
      const res = await api.post<Thresholds>('/thresholds', values);
      setValues(res.data);
      setMsg('Seuils enregistrés');
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Échec de l'enregistrement");
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) return <div className="p-3"><Spinner animation="border" size="sm" /> Chargement...</div>;

  return (
    <div className="p-3">
      <h3>Seuils</h3>
      {error && <Alert variant="danger">{error}</Alert>}
      {msg && <Alert variant="success" dismissible onClose={() => setMsg(null)}>{msg}</Alert>}
      <Card className="p-3">
        <Form onSubmit={save}>
          <Row>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Température</Form.Label>
                <Form.Control type="number" value={values.temp}
                  onChange={(e) => setValues({ ...values, temp: parseFloat(e.target.value) })}
                  step="0.1" />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Pression</Form.Label>
                <Form.Control type="number" value={values.press}
                  onChange={(e) => setValues({ ...values, press: parseFloat(e.target.value) })}
                  step="0.1" />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Vibration</Form.Label>
                <Form.Control type="number" value={values.vib}
                  onChange={(e) => setValues({ ...values, vib: parseFloat(e.target.value) })}
                  step="0.1" />
              </Form.Group>
            </Col>
            <Col md={3}>
              <Form.Group className="mb-3">
                <Form.Label>Fumée</Form.Label>
                <Form.Control type="number" value={values.fumee}
                  onChange={(e) => setValues({ ...values, fumee: parseFloat(e.target.value) })}
                  step="0.1" />
              </Form.Group>
            </Col>
          </Row>
          <div className="d-flex gap-2">
            <Button type="submit" variant="primary">Enregistrer</Button>
            <Button type="button" variant="secondary" onClick={suggest}>Suggérer</Button>
            <Button type="button" variant="outline-secondary" onClick={load}>Recharger</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default AdminThresholds;
