import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { CheckCircle, Alert, Info, X } from '../components/Icons';

const ToastContext = createContext(null);

const ICONS = { success: CheckCircle, error: Alert, info: Info };

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
    const timer = timers.current.get(id);
    if (timer) { clearTimeout(timer); timers.current.delete(id); }
  }, []);

  const push = useCallback((message, type = 'info', duration = 4200) => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t.slice(-2), { id, message, type }]);
    timers.current.set(id, setTimeout(() => dismiss(id), duration));
    return id;
  }, [dismiss]);

  const value = useMemo(() => ({
    toast: push,
    success: (m, d) => push(m, 'success', d),
    error: (m, d) => push(m, 'error', d ?? 5600),
    info: (m, d) => push(m, 'info', d),
  }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toast-wrap" role="status" aria-live="polite">
        {toasts.map((t) => {
          const Icon = ICONS[t.type] || Info;
          return (
            <div key={t.id} className={`toast toast-${t.type}`}>
              <Icon size={18} className="ico" />
              <span className="grow">{t.message}</span>
              <button className="close" onClick={() => dismiss(t.id)} aria-label="Dismiss">
                <X size={15} />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
};
