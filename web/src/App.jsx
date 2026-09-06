import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { useTheme } from './hooks/useTheme';
import AppShell from './components/AppShell';
import ProtectedRoute from './components/ProtectedRoute';
import InstallPrompt from './components/InstallPrompt';

import Welcome from './pages/Welcome';
import Login from './pages/Login';
import Signup from './pages/Signup';
import Dashboard from './pages/Dashboard';
import Reports from './pages/Reports';
import ReportDetail from './pages/ReportDetail';
import ReportWizard from './pages/ReportWizard';
import Profile from './pages/Profile';
import NotFound from './pages/NotFound';

/** Redirects signed-in users away from the public pages. */
function PublicOnly({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return null;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const { theme, toggle } = useTheme();

  const shell = (element) => (
    <ProtectedRoute>
      <AppShell theme={theme} onToggleTheme={toggle}>{element}</AppShell>
    </ProtectedRoute>
  );

  return (
    <>
      <InstallPrompt />
      <Routes>
        <Route path="/" element={<PublicOnly><Welcome /></PublicOnly>} />
        <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
        <Route path="/signup" element={<PublicOnly><Signup /></PublicOnly>} />

        <Route path="/dashboard" element={shell(<Dashboard />)} />
        <Route path="/reports" element={shell(<Reports />)} />
        <Route path="/reports/:id" element={shell(<ReportDetail />)} />
        <Route path="/report" element={shell(<ReportWizard />)} />
        <Route path="/profile" element={shell(<Profile theme={theme} onToggleTheme={toggle} />)} />

          <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
