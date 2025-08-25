import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Button, Badge, Alert, Spinner, Form, Row, Col, ButtonGroup } from 'react-bootstrap';
import api from '../api/client';

interface UserOut {
  id: number;
  username: string;
  role: string;
  is_active: boolean;
  created_at?: string;
  last_login_at?: string;
}

const AdminUsers: React.FC = () => {
  const [users, setUsers] = useState<UserOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [active, setActive] = useState(''); // '', 'true', 'false'
  const [sort, setSort] = useState('id.asc');

  const params = useMemo(() => {
    const p: any = { page, page_size: pageSize, sort };
    if (search) p.search = search;
    if (role) p.role = role;
    if (active) p.is_active = active === 'true';
    return p;
  }, [page, pageSize, search, role, active, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<UserOut[]>('/admin/users', { params });
      setUsers(res.data || []);
      const header = (res.headers?.['x-total-count'] ?? res.headers?.['X-Total-Count']) as any;
      if (header) setTotal(Number(header)); else setTotal(0);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur au chargement des utilisateurs');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const approve = async (id: number) => {
    try {
      await api.post(`/auth/approve/${id}`);
      setActionMsg('Utilisateur approuvé');
      await load();
    } catch (e: any) {
      setError(e?.response?.data?.detail || "Échec de l'approbation");
    }
  };

  if (loading) return <div className="p-3"><Spinner animation="border" size="sm" /> Chargement...</div>;

  return (
    <div className="p-3">
      <h3>Utilisateurs</h3>
      <Form className="mb-3">
        <Row className="g-2">
          <Col xs={12} md={3}>
            <Form.Control placeholder="Recherche username" value={search} onChange={e => { setPage(1); setSearch(e.target.value); }} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={role} onChange={e => { setPage(1); setRole(e.target.value); }}>
              <option value="">Rôle: tous</option>
              <option value="admin">admin</option>
              <option value="user">user</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={active} onChange={e => { setPage(1); setActive(e.target.value); }}>
              <option value="">Actif: tous</option>
              <option value="true">Actif</option>
              <option value="false">Inactif</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={sort} onChange={e => { setPage(1); setSort(e.target.value); }}>
              <option value="id.asc">Tri: ID croissant</option>
              <option value="id.desc">ID décroissant</option>
              <option value="created_at.desc">Créé: récent</option>
              <option value="created_at.asc">Créé: ancien</option>
            </Form.Select>
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </Form.Select>
          </Col>
        </Row>
      </Form>
      {error && <Alert variant="danger">{error}</Alert>}
      {actionMsg && <Alert variant="success" onClose={() => setActionMsg(null)} dismissible>{actionMsg}</Alert>}
      <Table striped bordered hover size="sm" responsive>
        <thead>
          <tr>
            <th>ID</th>
            <th>Username</th>
            <th>Rôle</th>
            <th>Actif</th>
            <th>Créé</th>
            <th>Dernière connexion</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td>{u.id}</td>
              <td>{u.username}</td>
              <td><Badge bg={u.role === 'admin' ? 'danger' : 'secondary'}>{u.role}</Badge></td>
              <td>{u.is_active ? <Badge bg="success">Oui</Badge> : <Badge bg="warning" text="dark">Non</Badge>}</td>
              <td>{u.created_at ? new Date(u.created_at).toLocaleString() : '-'}</td>
              <td>{u.last_login_at ? new Date(u.last_login_at).toLocaleString() : '-'}</td>
              <td>
                {!u.is_active && (
                  <Button size="sm" variant="primary" onClick={() => approve(u.id)}>Approuver</Button>
                )}
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

export default AdminUsers;
