import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { STATUS_META } from '../constants';
import { X, Inbox } from './Icons';

/** Coloured status pill for a report. */
export function StatusBadge({ status, size }) {
  const meta = STATUS_META[status] || { cls: 'badge-neutral', label: status || 'Unknown' };
  return (
    <span className={`badge ${meta.cls}`} style={size === 'sm' ? { padding: '3px 9px', fontSize: '0.7rem' } : undefined}>
      <span className="dot" />
      {meta.label}
    </span>
  );
}

/** Bottom-sheet on mobile, centred dialog on desktop. */
export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  // Rendered in a portal: page-level animations and sticky footers create their
  // own stacking contexts, which would otherwise paint over the dialog.
  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className="modal" style={wide ? { maxWidth: 720 } : undefined} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-grab" />
        <div className="modal-head">
          <h3>{title}</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Friendly placeholder for empty lists. */
export function EmptyState({ icon: Icon = Inbox, title, message, action }) {
  return (
    <div className="empty">
      <div className="empty-ico"><Icon size={30} /></div>
      <h3>{title}</h3>
      {message && <p className="muted mt-4" style={{ maxWidth: 380, margin: '6px auto 0' }}>{message}</p>}
      {action && <div className="mt-20">{action}</div>}
    </div>
  );
}

/** Grey shimmering placeholder. */
export const Skeleton = ({ h = 16, w = '100%', r, style }) => (
  <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />
);

/** A labelled read-only row used on the report detail screen. */
export function InfoRow({ icon: Icon, label, value }) {
  return (
    <div className="info-row">
      {Icon && <Icon size={17} className="ir-ico" />}
      <div className="grow">
        <div className="ir-label">{label}</div>
        <div className="ir-value">{value ?? <span className="subtle">Not provided</span>}</div>
      </div>
    </div>
  );
}

/** Text/textarea/select field with label, hint and error handling. */
export function Field({ label, required, hint, error, children, htmlFor }) {
  return (
    <div className="field">
      {label && (
        <label className="label" htmlFor={htmlFor}>
          {label}{required && <span className="req">*</span>}
        </label>
      )}
      {children}
      {error ? <span className="error-text">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}
