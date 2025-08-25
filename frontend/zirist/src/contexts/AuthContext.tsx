import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import api from '../api/client';

interface UserInfo { id: number; username: string; role: 'user' | 'admin'; is_active: boolean }

interface AuthContextValue {
  token: string | null;
  isAuthenticated: boolean;
  user: UserInfo | null;
  isAdmin: boolean;
  login: (token: string) => void;
  logout: () => void;
  refreshMe: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem('token'));
  const [user, setUser] = useState<UserInfo | null>(null);

  const login = useCallback((t: string) => {
    setToken(t);
    localStorage.setItem('token', t);
  }, []);

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem('token');
  }, []);

  const refreshMe = useCallback(async () => {
    if (!token) { setUser(null); return; }
    try {
      const res = await api.get('/auth/me');
      setUser(res.data as UserInfo);
    } catch {
      setUser(null);
    }
  }, [token]);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === 'token') {
        setToken(e.newValue);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  // Load /auth/me when token changes
  useEffect(() => {
    refreshMe();
  }, [token, refreshMe]);

  const value = useMemo(() => ({
    token,
    isAuthenticated: !!token,
    user,
    isAdmin: !!user && user.role === 'admin',
    login,
    logout,
    refreshMe,
  }), [token, user, login, logout, refreshMe]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};
