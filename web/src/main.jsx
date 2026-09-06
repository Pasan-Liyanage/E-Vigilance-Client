import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import './styles/theme.css';
import './styles/components.css';
import './styles/layout.css';

import App from './App';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

// Apply the saved theme before first paint to avoid a flash.
try {
  const saved = localStorage.getItem('evigilance.theme');
  const dark = saved ? saved === 'dark' : window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
} catch { /* private mode */ }

// import.meta.env.BASE_URL is '/' locally and '/<repo>/' on GitHub Pages.
const basename = import.meta.env.BASE_URL.replace(/\/$/, '');

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter basename={basename}>
      <ToastProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </ToastProvider>
    </BrowserRouter>
  </StrictMode>
);
