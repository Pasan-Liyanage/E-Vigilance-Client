import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield } from './Icons';

/** Blocks a route until the session has been restored/validated. */
export default function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ minHeight: '100dvh', display: 'grid', placeItems: 'center' }}>
        <div className="stack gap-14" style={{ alignItems: 'center' }}>
          <div className="brand-mark" style={{ width: 52, height: 52, borderRadius: 15 }}>
            <Shield size={27} />
          </div>
          <div className="spinner" style={{ color: 'var(--brand-600)' }} />
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return children;
}
