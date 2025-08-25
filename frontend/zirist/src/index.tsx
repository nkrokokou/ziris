import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import './styles/neon.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import { BrowserRouter } from 'react-router-dom';
import { createContext, useState, useEffect } from 'react';
import { AuthProvider } from './contexts/AuthContext';

export const ThemeContext = createContext({
  theme: 'dark',
  toggleTheme: () => {},
});

const AppWrapper: React.FC = () => {
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.body.className = theme;
  }, [theme]);

  const toggleTheme = () => setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      <div className={theme}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </div>
    </ThemeContext.Provider>
  );
};

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);
root.render(
  <BrowserRouter>
    <AppWrapper />
  </BrowserRouter>
);