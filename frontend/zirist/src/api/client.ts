import axios from 'axios';

// Zero-dependency, runtime-safe base URL resolution
const getBaseUrl = (): string => {
  // 1) Window global override (optional): (window as any).__API_URL__
  if (typeof window !== 'undefined' && (window as any).__API_URL__) {
    return (window as any).__API_URL__ as string;
  }
  // 2) Infer from current host: assume backend on same host, port 8000
  if (typeof window !== 'undefined' && window.location) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000`;
  }
  // 3) Fallback for non-browser contexts
  return 'http://localhost:8000';
};

const api = axios.create({ baseURL: getBaseUrl() });

// Request: attach Authorization from localStorage
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response: auto-logout on 401
api.interceptors.response.use(
  (res) => res,
  (error) => {
    if (error?.response?.status === 401) {
      localStorage.removeItem('token');
      // best-effort redirect
      if (typeof window !== 'undefined') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;
