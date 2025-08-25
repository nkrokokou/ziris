import React, { useState } from 'react';
import { Card, Form, Button, Alert, Row, Col, Badge } from 'react-bootstrap';
import api from '../api/client';

// Simple guided form for operators to submit suggestions
const OperatorSuggestion: React.FC = () => {
  const [category, setCategory] = useState<string>('seuils');
  const [zone, setZone] = useState<string>('A');
  const [sensorType, setSensorType] = useState<string>('temperature');
  const [impact, setImpact] = useState<string>('Moyen');
  const [text, setText] = useState<string>('');
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<boolean>(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null); setError(null); setBusy(true);
    try {
      await api.post('/suggestions', {
        category,
        zone,
        sensor_type: sensorType,
        text,
        impact,
      });
      setMsg('Suggestion envoyée. Merci !');
      setText('');
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Échec de soumission');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-3">
      <h3>Suggestion à l\'administrateur <Badge bg="secondary">Assistant</Badge></h3>
      {msg && <Alert variant="success" dismissible onClose={() => setMsg(null)}>{msg}</Alert>}
      {error && <Alert variant="danger" dismissible onClose={() => setError(null)}>{error}</Alert>}
      <Card className="p-3">
        <Form onSubmit={submit}>
          <Row className="g-3">
            <Col md={4}>
              <Form.Group>
                <Form.Label>Catégorie</Form.Label>
                <Form.Select value={category} onChange={(e) => setCategory(e.target.value)}>
                  <option value="seuils">seuils</option>
                  <option value="recommandations">recommandations</option>
                  <option value="visualisation">visualisation</option>
                  <option value="donnees">donnees</option>
                  <option value="autre">autre</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Zone</Form.Label>
                <Form.Select value={zone} onChange={(e) => setZone(e.target.value)}>
                  <option value="A">A</option>
                  <option value="B">B</option>
                  <option value="C">C</option>
                  <option value="D">D</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Type capteur</Form.Label>
                <Form.Select value={sensorType} onChange={(e) => setSensorType(e.target.value)}>
                  <option value="temperature">temperature</option>
                  <option value="pression">pression</option>
                  <option value="vibration">vibration</option>
                  <option value="fumee">fumee</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={4}>
              <Form.Group>
                <Form.Label>Impact</Form.Label>
                <Form.Select value={impact} onChange={(e) => setImpact(e.target.value)}>
                  <option value="Critique">Critique</option>
                  <option value="Élevé">Élevé</option>
                  <option value="Moyen">Moyen</option>
                  <option value="Faible">Faible</option>
                </Form.Select>
              </Form.Group>
            </Col>
            <Col md={12}>
              <Form.Group>
                <Form.Label>Votre suggestion</Form.Label>
                <Form.Control as="textarea" rows={6} value={text} onChange={(e) => setText(e.target.value)} placeholder="Décrivez votre suggestion ici..." />
              </Form.Group>
            </Col>
          </Row>
          <div className="mt-3 d-flex gap-2">
            <Button type="submit" variant="primary" disabled={busy}>{busy ? 'Envoi...' : 'Envoyer'}</Button>
            <Button type="button" variant="outline-secondary" onClick={() => setText('')} disabled={busy}>Effacer</Button>
          </div>
        </Form>
      </Card>
    </div>
  );
};

export default OperatorSuggestion;
