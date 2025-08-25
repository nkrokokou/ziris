import React, { useState } from 'react';
import { Form, Button, Alert, Container, Row, Col, Image } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuth } from '../contexts/AuthContext';

const Login: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [showSignup, setShowSignup] = useState(false);
  const [signupData, setSignupData] = useState({ username: '', password: '' });
  const [signupMessage, setSignupMessage] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await api.post('/auth/login', { username, password });
      const token: string = response.data?.access_token;
      if (!token) throw new Error('No token in response');
      login(token);
      setError(null);
      navigate('/dashboard');
    } catch (err: any) {
      const status = err?.response?.status;
      if (status === 403) {
        setError("Compte en attente d'approbation par un administrateur.");
      } else {
        setError('Échec de la connexion. Vérifiez vos identifiants.');
      }
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/auth/register', { username: signupData.username, password: signupData.password });
      setSignupMessage("Inscription soumise ! Votre compte sera approuvé par un administrateur.");
      setShowSignup(false);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Échec de inscription.';
      setSignupMessage(msg);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-900 via-blue-700 to-cyan-500">
      <Container fluid className="p-0">
        <Row className="no-gutters min-h-screen">
          <Col
            md={6}
            className="d-flex align-items-center justify-content-center"
            style={{ backgroundColor: '#0a2540' }}
          >
            <Image
              src="ziris-logo.png"
              alt="ZIRIS Logo"
              fluid
              style={{ maxWidth: '80%', height: 'auto' }}
            />
          </Col>

          <Col
            md={6}
            className="d-flex align-items-center justify-content-center bg-white p-4"
          >
            <div className="w-100" style={{ maxWidth: '400px' }}>
              <h1 className="mb-4 text-3xl font-poppins font-bold text-gray-800">
                ZIRIS - {showSignup ? 'Inscription' : 'Connexion'}
              </h1>

              {!showSignup ? (
                <Form onSubmit={handleLogin}>
                  <Form.Group controlId="formUsername" className="mb-3">
                    <Form.Label>Nom d'utilisateur</Form.Label>
                    <Form.Control
                      type="text"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      placeholder="Entrez votre nom d'utilisateur"
                      required
                    />
                  </Form.Group>

                  <Form.Group controlId="formPassword" className="mb-3">
                    <Form.Label>Mot de passe</Form.Label>
                    <Form.Control
                      type="password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="Entrez votre mot de passe"
                      required
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100 mb-2">
                    Se connecter
                  </Button>

                  {error && <Alert variant="danger">{error}</Alert>}

                  <Button
                    variant="link"
                    className="w-100 text-center"
                    onClick={() => setShowSignup(true)}
                  >
                    S'inscrire
                  </Button>
                </Form>
              ) : (
                <Form onSubmit={handleSignup}>
                  <Form.Group controlId="formSignupUsername" className="mb-3">
                    <Form.Label>Nom d'utilisateur</Form.Label>
                    <Form.Control
                      type="text"
                      value={signupData.username}
                      onChange={e =>
                        setSignupData({ ...signupData, username: e.target.value })
                      }
                      placeholder="Choisissez un nom d'utilisateur"
                      required
                    />
                  </Form.Group>

                  <Form.Group controlId="formSignupPassword" className="mb-3">
                    <Form.Label>Mot de passe</Form.Label>
                    <Form.Control
                      type="password"
                      value={signupData.password}
                      onChange={e =>
                        setSignupData({ ...signupData, password: e.target.value })
                      }
                      placeholder="Choisissez un mot de passe"
                      required
                    />
                  </Form.Group>

                  <Button type="submit" variant="primary" className="w-100 mb-2">
                    S'inscrire
                  </Button>

                  {signupMessage && <Alert variant="info">{signupMessage}</Alert>}

                  <Button
                    variant="link"
                    className="w-100 text-center"
                    onClick={() => {
                      setShowSignup(false);
                      setSignupMessage(null);
                    }}
                  >
                    Retour à la connexion
                  </Button>
                </Form>
              )}
            </div>
          </Col>
        </Row>
      </Container>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap');
        .font-poppins { font-family: 'Poppins', sans-serif; }
      `}</style>
    </div>
  );
};

export default Login;
