import React, { useState } from 'react';
import { Card, Container, Row, Col, Form, Button, Alert } from 'react-bootstrap';
import api from '../api/client';

const OperatorSurvey: React.FC = () => {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);

  // Basic questionnaire fields (ratings 1-5)
  const [form, setForm] = useState({
    global_satisfaction: 4,
    tech_issues_frequency: 'Rarement',
    ease_of_use: 4,
    system_reliability: 4,
    response_time: 4,
    alert_relevance: 4,
    data_quality: 4,
    ergonomics_multidevice: 4,
    design_presentation: 4,
    overall_utility: 4,
    notifications_wanted: [] as string[],
    clarity_instructions: 4,
    incident_resolution_efficiency: 4,
    it_communication_quality: 4,
    incident_resolution_time: 4,
    network_quality: 4,
    comments: ''
  });

  const setField = (k: string, v: any) => setForm((prev) => ({ ...prev, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setOk(null);
    try {
      await api.post('/survey/submit', { payload: form });
      setOk('Merci! Votre réponse a été enregistrée.');
    } catch (err: any) {
      setError(err?.response?.data?.detail || err.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const Rating = (props: { label: string; k: keyof typeof form }) => (
    <Form.Group className="mb-3">
      <Form.Label>{props.label}</Form.Label>
      <Form.Range min={1} max={5} step={1}
        value={Number(form[props.k])}
        onChange={(e) => setField(props.k, Number(e.target.value))}
      />
      <div>Note: <strong>{form[props.k]}</strong></div>
    </Form.Group>
  );

  const Multi = (props: { label: string; k: keyof typeof form; options: string[] }) => (
    <Form.Group className="mb-3">
      <Form.Label>{props.label}</Form.Label>
      <div>
        {props.options.map((opt) => (
          <Form.Check
            inline
            key={opt}
            type="checkbox"
            label={opt}
            checked={Array.isArray(form[props.k]) && (form[props.k] as string[]).includes(opt)}
            onChange={(e) => {
              const arr = new Set<string>(Array.isArray(form[props.k]) ? (form[props.k] as string[]) : []);
              if (e.target.checked) arr.add(opt); else arr.delete(opt);
              setField(props.k, Array.from(arr));
            }}
          />
        ))}
      </div>
    </Form.Group>
  );

  return (
    <Container className="py-4">
      <Row className="justify-content-center">
        <Col md={10} lg={9} xl={8}>
          <Card className="shadow-sm">
            <Card.Body>
              <Card.Title>Questionnaire Opérateur</Card.Title>
              <Card.Text>Votre retour nous aide à améliorer ZIRIS.</Card.Text>
              {error && <Alert variant="danger">{error}</Alert>}
              {ok && <Alert variant="success">{ok}</Alert>}

              <Form onSubmit={onSubmit}>
                <Row>
                  <Col md={6}>
                    <Rating label="Satisfaction globale" k="global_satisfaction" />
                    <Form.Group className="mb-3">
                      <Form.Label>Fréquence des problèmes techniques</Form.Label>
                      <Form.Select value={form.tech_issues_frequency} onChange={(e) => setField('tech_issues_frequency', e.target.value)}>
                        {['Quotidien', 'Hebdomadaire', 'Mensuel', 'Rarement', 'Jamais'].map((opt) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </Form.Select>
                    </Form.Group>
                    <Rating label="Facilité d'utilisation" k="ease_of_use" />
                    <Rating label="Fiabilité du système" k="system_reliability" />
                    <Rating label="Temps de réponse" k="response_time" />
                    <Rating label="Pertinence des alertes" k="alert_relevance" />
                    <Rating label="Qualité des données" k="data_quality" />
                  </Col>
                  <Col md={6}>
                    <Rating label="Ergonomie multi-appareils" k="ergonomics_multidevice" />
                    <Rating label="Design et présentation" k="design_presentation" />
                    <Rating label="Utilité globale" k="overall_utility" />
                    <Multi label="Notifications souhaitées" k="notifications_wanted" options={["Alertes en temps réel", "Recommandations", "Rapports quotidiens"]} />
                    <Rating label="Clarté des consignes" k="clarity_instructions" />
                    <Rating label="Efficacité résolution incidents" k="incident_resolution_efficiency" />
                    <Rating label="Qualité communication IT" k="it_communication_quality" />
                    <Rating label="Délai résolution incidents" k="incident_resolution_time" />
                    <Rating label="Qualité réseau" k="network_quality" />
                  </Col>
                </Row>
                <Form.Group className="mb-3">
                  <Form.Label>Commentaires</Form.Label>
                  <Form.Control as="textarea" rows={3} value={form.comments} onChange={(e) => setField('comments', e.target.value)} />
                </Form.Group>
                <div className="d-flex justify-content-end">
                  <Button type="submit" disabled={submitting}>
                    {submitting ? 'Envoi…' : 'Envoyer'}
                  </Button>
                </div>
              </Form>
            </Card.Body>
          </Card>
        </Col>
      </Row>
    </Container>
  );
};

export default OperatorSurvey;
