import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Badge, Alert, Spinner, Form, Row, Col, Button, ButtonGroup } from 'react-bootstrap';
import api from '../api/client';

interface SuggestionOut {
  id: number;
  user_id: number;
  role_snapshot: string;
  category: string;
  zone?: string;
  sensor_type?: string;
  text: string;
  impact: string;
  status: string;
  created_at: string;
  updated_at: string;
}

const AdminSuggestions: React.FC = () => {
  const [items, setItems] = useState<SuggestionOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [status, setStatus] = useState('');
  const [category, setCategory] = useState('');
  const [userId, setUserId] = useState('');
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState('created_at.desc');

  const params = useMemo(() => {
    const p: any = { page, page_size: pageSize, sort };
    if (status) p.status = status;
    if (category) p.category = category;
    if (userId) p.user_id = Number(userId);
    if (search) p.search = search;
    return p;
  }, [page, pageSize, status, category, userId, search, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<SuggestionOut[]>('/suggestions', { params });
      setItems(res.data || []);
      const header = (res.headers?.['x-total-count'] ?? res.headers?.['X-Total-Count']) as any;
      if (header) setTotal(Number(header)); else setTotal(0);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur au chargement des suggestions');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const update = async (id: number, status: string) => {
    try {
      await api.patch(`/suggestions/${id}`, { status });
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Échec de la mise à jour");
    }
  };

  if (loading) return <div className="p-3"><Spinner animation="border" size="sm" /> Chargement...</div>;

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Suggestions</h3>
        <div />
      </div>
      <Form className="mb-3">
        <Row className="g-2">
          <Col xs={12} md={3}>
            <Form.Control placeholder="Recherche texte" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={status} onChange={e => { setPage(1); setStatus(e.target.value); }}>
              <option value="">Statut: tous</option>
              <option value="nouveau">nouveau</option>
              <option value="en_cours">en_cours</option>
              <option value="resolu">resolu</option>
              <option value="rejete">rejete</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Control placeholder="Catégorie (ex: seuils)" value={category} onChange={e => { setPage(1); setCategory(e.target.value); }} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Control placeholder="User ID" value={userId} onChange={e => { setPage(1); setUserId(e.target.value); }} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={sort} onChange={e => { setPage(1); setSort(e.target.value); }}>
              <option value="created_at.desc">Créé: récent</option>
              <option value="created_at.asc">Créé: ancien</option>
              <option value="updated_at.desc">MAJ: récent</option>
              <option value="updated_at.asc">MAJ: ancien</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={1}>
            <Form.Select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Form.Select>
          </Col>
        </Row>
      </Form>
      {error && <Alert variant="danger">{error}</Alert>}
      <Table striped bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>User</th>
            <th>Catégorie</th>
            <th>Zone</th>
            <th>Capteur</th>
            <th>Impact</th>
            <th>Texte</th>
            <th>Statut</th>
            <th>Créé</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {items.map(s => (
            <tr key={s.id}>
              <td>{s.id}</td>
              <td>{s.user_id} ({s.role_snapshot})</td>
              <td>{s.category}</td>
              <td>{s.zone || '-'}</td>
              <td>{s.sensor_type || '-'}</td>
              <td><Badge bg={s.impact === 'Critique' ? 'danger' : s.impact === 'Élevé' ? 'warning' : 'secondary'}>{s.impact}</Badge></td>
              <td style={{ maxWidth: 300, whiteSpace: 'pre-wrap' }}>{s.text}</td>
              <td>{s.status}</td>
              <td>{new Date(s.created_at).toLocaleString()}</td>
              <td>
                <Form.Select size="sm" value={s.status} onChange={(e) => update(s.id, e.target.value)}>
                  <option value="nouveau">nouveau</option>
                  <option value="en_cours">en_cours</option>
                  <option value="resolu">resolu</option>
                  <option value="rejete">rejete</option>
                </Form.Select>
              </td>
            </tr>
          ))}
        </tbody>
      </Table>
      <div className="d-flex justify-content-between align-items-center">
        <div>
          Page {page} / {Math.max(1, Math.ceil(total / pageSize))} • Total: {total}
        </div>
        <ButtonGroup>
          <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(p => Math.max(1, p - 1))}>Précédent</Button>
          <Button variant="secondary" size="sm" disabled={page >= Math.max(1, Math.ceil(total / pageSize))} onClick={() => setPage(p => p + 1)}>Suivant</Button>
        </ButtonGroup>
      </div>
    </div>
  );
};

export default AdminSuggestions;
