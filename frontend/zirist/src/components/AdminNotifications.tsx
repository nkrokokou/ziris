import React, { useEffect, useRef, useState } from 'react';
import { Alert, Badge, Button, Card, Form, Table } from 'react-bootstrap';

interface Note { id: number; ts: string; text: string }

const AdminNotifications: React.FC = () => {
  const [notes, setNotes] = useState<Note[]>([]);
  const [status, setStatus] = useState<'closed' | 'connecting' | 'open' | 'error'>('closed');
  const [url, setUrl] = useState<string>('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Derive WS url from current host
    const loc = window.location;
    const proto = loc.protocol === 'https:' ? 'wss' : 'ws';
    setUrl(`${proto}://${loc.hostname}:8000/ws/notifications`);
  }, []);

  const connect = () => {
    if (!url) return;
    try {
      setStatus('connecting');
      const ws = new WebSocket(url);
      wsRef.current = ws;
      ws.onopen = () => setStatus('open');
      ws.onerror = () => setStatus('error');
      ws.onclose = () => setStatus('closed');
      ws.onmessage = (ev) => {
        const text = typeof ev.data === 'string' ? ev.data : '';
        setNotes((prev) => [{ id: Date.now(), ts: new Date().toLocaleString(), text }, ...prev].slice(0, 50));
      };
    } catch {
      setStatus('error');
    }
  };

  const disconnect = () => {
    try { wsRef.current?.close(); } catch {}
    wsRef.current = null;
  };

  return (
    <div className="p-3">
      <h3>Administration - Notifications <Badge bg={status === 'open' ? 'success' : status === 'connecting' ? 'warning' : status === 'error' ? 'danger' : 'secondary'}>{status}</Badge></h3>
      <Card className="p-3 mb-3">
        <div className="d-flex align-items-center gap-2 flex-wrap">
          <Form.Control style={{maxWidth: 420}} value={url} onChange={(e) => setUrl(e.target.value)} />
          <Button variant="primary" onClick={connect} disabled={status === 'open' || status === 'connecting'}>Connecter</Button>
          <Button variant="outline-secondary" onClick={disconnect} disabled={status !== 'open'}>Couper</Button>
        </div>
        <Alert variant="info" className="mt-2 mb-0">Ce flux WS envoie "connected" puis "update" en écho. Vous pouvez l'étendre côté backend.</Alert>
      </Card>
      <Card className="p-3">
        <Table striped bordered hover size="sm" responsive>
          <thead>
            <tr>
              <th>Horodatage</th>
              <th>Message</th>
            </tr>
          </thead>
          <tbody>
            {notes.map(n => (
              <tr key={n.id}>
                <td>{n.ts}</td>
                <td style={{whiteSpace: 'pre-wrap'}}>{n.text}</td>
              </tr>
            ))}
          </tbody>
        </Table>
      </Card>
    </div>
  );
};

export default AdminNotifications;
