import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useOnline } from '../hooks/useOnline';
import { Shield, Home, FileText, Plus, User, Sun, Moon, WifiOff, LogOut } from './Icons';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';

/** Top bar + mobile tab bar wrapper used by every signed-in screen. */
export default function AppShell({ children, theme, onToggleTheme }) {
  const { user, signOut } = useAuth();
  const online = useOnline();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleSignOut = () => {
    signOut();
    navigate('/login', { replace: true });
  };

  return (
    <div className="app-shell">
      {!online && (
        <div className="offline-bar">
          <WifiOff size={15} /> You are offline - showing your last saved data
        </div>
      )}

      <header className="topbar">
        <div className="container topbar-inner">
          <Link to="/dashboard" className="brand">
            <span className="brand-mark"><Shield size={19} /></span>
            <span>E-Vigilance</span>
          </Link>

          <nav className="nav-links grow">
            <NavLink to="/dashboard" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Home size={17} /> Dashboard
            </NavLink>
            <NavLink to="/reports" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <FileText size={17} /> My Reports
            </NavLink>
            <NavLink to="/report" className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}>
              <Plus size={17} /> New Report
            </NavLink>
          </nav>

          <div className="row gap-8" style={{ marginLeft: 'auto' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={onToggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
            </button>

            <button
              className="btn btn-ghost btn-icon hide-mobile"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={18} />
            </button>

            <Link to="/profile" aria-label="Your profile" title={user?.name}>
              <span className="avatar">{initials(user?.name)}</span>
            </Link>
          </div>
        </div>
      </header>

      <main className="page">{children}</main>

      <nav className="tabbar">
        <NavLink to="/dashboard" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <Home size={21} /><span>Home</span>
        </NavLink>
        <NavLink to="/reports" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <FileText size={21} /><span>Reports</span>
        </NavLink>
        <NavLink to="/report" className="tab" aria-label="New report">
          <span className="tab-fab"><Plus size={24} /></span>
        </NavLink>
        <NavLink to="/profile" className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}>
          <User size={21} /><span>Profile</span>
        </NavLink>
      </nav>
    </div>
  );
}
