import React, { useContext } from 'react';
import { Container, Navbar, Nav, Button, NavDropdown } from 'react-bootstrap';
import { useNavigate, Route, Routes, NavLink, Link } from 'react-router-dom';
import Home from './components/Home';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import IsolationForest from './components/IsolationForest';
import { ThemeContext } from './index';
import ProtectedRoute from './routes/ProtectedRoute';
import AdminRoute from './routes/AdminRoute';
import { useAuth } from './contexts/AuthContext';
import AdminUsers from './components/AdminUsers';
import AdminSuggestions from './components/AdminSuggestions';
import AdminAudit from './components/AdminAudit';
import AdminJobs from './components/AdminJobs';
const AdminThresholdsLazy = React.lazy(() => import('./components/AdminThresholds'));
const AdminModelOpsLazy = React.lazy(() => import('./components/AdminModelOps'));
const OperatorSuggestionLazy = React.lazy(() => import('./components/OperatorSuggestion'));
const AdminNotificationsLazy = React.lazy(() => import('./components/AdminNotifications'));

const App: React.FC = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useContext(ThemeContext);
  const { isAuthenticated, isAdmin, logout, user } = useAuth();
  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className={theme === 'dark' ? 'bg-dark text-light' : 'bg-light text-dark'}>
      <Navbar
        bg={theme === 'dark' ? 'dark' : 'light'}
        variant={theme === 'dark' ? 'dark' : 'light'}
        expand="lg"
        className="shadow-sm"
      >
        <Container>
          <Navbar.Brand as={Link} to={isAuthenticated ? '/dashboard' : '/'}>ZIRIS</Navbar.Brand>
          <Navbar.Toggle aria-controls="main-navbar" />
          <Navbar.Collapse id="main-navbar">
          <Nav className="me-auto">
            {isAuthenticated && (
              <NavLink to="/dashboard" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Dashboard</NavLink>
            )}
            {isAuthenticated && (
              <NavLink to="/isolation-forest" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Isolation Forest</NavLink>
            )}
            {isAuthenticated && (
              <NavLink to="/operator/suggest" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>Suggestion</NavLink>
            )}
            {isAuthenticated && isAdmin && (
              <NavDropdown title="Admin" id="admin-nav-dropdown" menuVariant={theme === 'dark' ? 'dark' : undefined}>
                <NavDropdown.Item as={NavLink} to="/admin/users">Utilisateurs</NavDropdown.Item>
                <NavDropdown.Item as={NavLink} to="/admin/suggestions">Suggestions</NavDropdown.Item>
                <NavDropdown.Item as={NavLink} to="/admin/thresholds">Seuils</NavDropdown.Item>
                <NavDropdown.Item as={NavLink} to="/admin/model">Modèle</NavDropdown.Item>
                <NavDropdown.Item as={NavLink} to="/admin/jobs">Jobs</NavDropdown.Item>
                <NavDropdown.Item as={NavLink} to="/admin/audit">Audit</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item as={NavLink} to="/admin/notifications">Notifications</NavDropdown.Item>
              </NavDropdown>
            )}
          </Nav>
          <Nav className="align-items-center">
            {isAuthenticated && user && (
              <div className="d-flex align-items-center me-3">
                <div
                  className={`rounded-circle d-flex align-items-center justify-content-center me-2 ${theme === 'dark' ? 'bg-secondary' : 'bg-primary'}`}
                  style={{ width: 32, height: 32, color: 'white', fontWeight: 600 }}
                  aria-label={`Avatar ${user.username}`}
                >
                  {user.username?.charAt(0)?.toUpperCase() || '?'}
                </div>
                <div className="d-flex flex-column lh-1">
                  <small className="text-muted">Bienvenue</small>
                  <span>
                    <strong>{user.username}</strong>
                    <span className="ms-2 badge bg-info text-dark" aria-label={`Rôle ${user.role}`}>{user.role}</span>
                  </span>
                </div>
              </div>
            )}
            {isAuthenticated && (
              <Button
                onClick={toggleTheme}
                variant="outline-secondary"
                className="me-2"
              >
                {theme === 'dark' ? 'Mode Clair' : 'Mode Sombre'}
              </Button>
            )}
            {isAuthenticated && <Nav.Link onClick={handleLogout}>Déconnexion</Nav.Link>}
          </Nav>
          </Navbar.Collapse>
        </Container>
      </Navbar>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/isolation-forest" element={<IsolationForest />} />
          <Route path="/operator/suggest" element={<React.Suspense fallback={null}><OperatorSuggestionLazy /></React.Suspense>} />
        </Route>
        <Route element={<AdminRoute />}>
          <Route path="/admin/users" element={<AdminUsers />} />
          <Route path="/admin/suggestions" element={<AdminSuggestions />} />
          <Route path="/admin/thresholds" element={<React.Suspense fallback={null}><AdminThresholdsLazy /></React.Suspense>} />
          <Route path="/admin/model" element={<React.Suspense fallback={null}><AdminModelOpsLazy /></React.Suspense>} />
          <Route path="/admin/jobs" element={<AdminJobs />} />
          <Route path="/admin/audit" element={<AdminAudit />} />
          <Route path="/admin/notifications" element={<React.Suspense fallback={null}><AdminNotificationsLazy /></React.Suspense>} />
        </Route>
      </Routes>
    </div>
  );
};

export default App;
