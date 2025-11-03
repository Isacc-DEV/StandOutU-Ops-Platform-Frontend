import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client.js';

const decodeToken = token => {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const json = JSON.parse(atob(padded));
    return json;
  } catch (e) {
    console.warn('Failed to decode token', e);
    return null;
  }
};

export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    api.setToken(null);
    setUser(null);
    setLoading(false);
  }, []);

  useEffect(() => {
    api.onUnauthorized(() => {
      logout();
    });
    const token = localStorage.getItem('token');
    if (token) {
      api.setToken(token);
      const decoded = decodeToken(token);
      if (decoded) {
        setUser({ token, ...decoded });
      } else {
        setUser({ token });
      }
    }
    setLoading(false);
    return () => api.onUnauthorized(null);
  }, [logout]);

  return { user, loading, logout };
};
