import { Link } from 'react-router-dom';
import Logo from '../components/Logo';


export default function NotFound() {
  return (
    <div className="container" style={{ minHeight: '70dvh', display: 'grid', placeItems: 'center' }}>
      <div className="stack gap-16 text-center" style={{ alignItems: 'center' }}>
        <Logo size={62} />
        <div>
          <h1>Page not found</h1>
          <p className="muted mt-8">The page you were looking for does not exist.</p>
        </div>
        <Link to="/dashboard" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  );
}
