import { Outlet, useLocation, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth.js';

export default function Guard() {
  const { user, loading } = useAuth();
  const loc = useLocation();

  if (loading) return null;
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />;
  return <Outlet />;
}
