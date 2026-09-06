import { Link } from 'react-router-dom';
import { Shield } from '../components/Icons';

export default function NotFound() {
  return (
    <div className="container" style={{ minHeight: '70dvh', display: 'grid', placeItems: 'center' }}>
      <div className="stack gap-16 text-center" style={{ alignItems: 'center' }}>
        <span className="brand-mark" style={{ width: 60, height: 60, borderRadius: 18 }}>
          <Shield size={30} />
        </span>
        <div>
          <h1>Page not found</h1>
          <p className="muted mt-8">The page you were looking for does not exist.</p>
        </div>
        <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
