import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Table, Alert, Spinner, Badge, Button, Form, Row, Col, ButtonGroup } from 'react-bootstrap';
import api from '../api/client';

interface AuditLogOut {
  id: number;
  ts: string;
  user_id?: number | null;
  action: string;
  details?: string | null;
}

const AdminAudit: React.FC = () => {
  const [rows, setRows] = useState<AuditLogOut[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [total, setTotal] = useState(0);
  const [action, setAction] = useState<string>('');
  const [userId, setUserId] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sort, setSort] = useState<string>('ts.desc');

  const params = useMemo(() => {
    const p: any = { page, page_size: pageSize, sort };
    if (action) p.action = action;
    if (userId) p.user_id = Number(userId);
    if (dateFrom) p.date_from = dateFrom;
    if (dateTo) p.date_to = dateTo;
    return p;
  }, [page, pageSize, action, userId, dateFrom, dateTo, sort]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.get<AuditLogOut[]>('/admin/audit', { params });
      setRows(res.data || []);
      const header = (res.headers?.['x-total-count'] ?? res.headers?.['X-Total-Count']) as any;
      if (header) setTotal(Number(header)); else setTotal(0);
    } catch (e: any) {
      setError(e?.response?.data?.detail || 'Erreur chargement audit logs');
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => { load(); }, [load]);

  const exportCsv = async () => {
    try {
      const res = await api.get('/admin/audit.csv', { params: { ...params, limit: pageSize }, responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'audit.csv');
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (e) {
      // noop UI error for now
    }
  };

  if (loading) return <div className="p-3"><Spinner animation="border" size="sm" /> Chargement...</div>;

  return (
    <div className="p-3">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h3 className="mb-0">Audit</h3>
        <Button variant="outline-primary" size="sm" onClick={exportCsv}>Exporter CSV</Button>
      </div>
      <Form className="mb-3">
        <Row className="g-2">
          <Col xs={12} md={3}>
            <Form.Control placeholder="Action (ex: login)" value={action} onChange={e => setAction(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Control placeholder="User ID" value={userId} onChange={e => setUserId(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Control type="datetime-local" value={dateFrom} onChange={e => setDateFrom(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Control type="datetime-local" value={dateTo} onChange={e => setDateTo(e.target.value)} />
          </Col>
          <Col xs={6} md={2}>
            <Form.Select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="ts.desc">Tri: plus récent</option>
              <option value="ts.asc">Tri: plus ancien</option>
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
            <th>Horodatage</th>
            <th>User ID</th>
            <th>Action</th>
            <th>Détails</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{new Date(r.ts).toLocaleString()}</td>
              <td>{r.user_id ?? '-'}</td>
              <td><Badge bg="info">{r.action}</Badge></td>
              <td style={{ whiteSpace: 'pre-wrap' }}>{r.details}</td>
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

export default AdminAudit;
