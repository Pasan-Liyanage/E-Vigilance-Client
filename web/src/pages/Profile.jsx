import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { api } from '../api/client';
import { Field, Modal, Skeleton } from '../components/ui';
import {
  User, Mail, IdCard, Phone, LogOut, Sun, Moon, Download, Shield,
  FileText, CheckCircle, Clock, X, Check,
} from '../components/Icons';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';

export default function Profile({ theme, onToggleTheme }) {
  const { user, signOut, updateProfile } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const { canInstall, install, installed } = useInstallPrompt();

  const [stats, setStats] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: user?.name || '', phone: user?.phone || '' });
  const [busy, setBusy] = useState(false);
  const [confirmOut, setConfirmOut] = useState(false);

  useEffect(() => {
    api.stats().then((s) => setStats(s.stats)).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    setForm({ name: user?.name || '', phone: user?.phone || '' });
  }, [user]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Your name cannot be empty.'); return; }
    setBusy(true);
    try {
      await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      toast.success('Profile updated.');
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { label: 'Total', value: stats?.total, icon: FileText, color: 'var(--brand-600)' },
    { label: 'In progress', value: stats?.inProgress, icon: Clock, color: 'var(--amber)' },
    { label: 'Completed', value: stats?.completed, icon: CheckCircle, color: 'var(--green)' },
    { label: 'Rejected', value: stats?.rejected, icon: X, color: 'var(--red)' },
  ];

  return (
    <div className="container stack gap-20" style={{ maxWidth: 720 }}>
      <h1>Profile</h1>

      <section className="card card-pad row gap-16">
        <span className="avatar avatar-lg">{initials(user?.name)}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <h2 className="truncate">{user?.name}</h2>
          <p className="muted small truncate">{user?.email}</p>
          <span className="badge badge-brand mt-8"><Shield size={12} /> Verified citizen</span>
        </div>
      </section>

      <section className="stats-grid">
        {tiles.map(({ label, value, icon: Icon, color }) => (
          <div className="stat-card" key={label}>
            <div className="stat-icon" style={{ background: 'var(--surface-3)', color }}>
              <Icon size={18} />
            </div>
            {stats === null ? <Skeleton h={24} w={40} /> : <div className="stat-value" style={{ fontSize: '1.5rem' }}>{value ?? 0}</div>}
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      <section className="card card-pad stack gap-16">
        <div className="between">
          <h3>Account details</h3>
          {!editing && (
            <button className="btn btn-outline btn-sm" onClick={() => setEditing(true)}>Edit</button>
          )}
        </div>

        {editing ? (
          <div className="stack gap-16">
            <Field label="Full name" required htmlFor="pname">
              <div className="input-group">
                <span className="lead"><User size={18} /></span>
                <input id="pname" className="input" value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} disabled={busy} />
              </div>
            </Field>
            <Field label="Phone number" hint="Optional" htmlFor="pphone">
              <div className="input-group">
                <span className="lead"><Phone size={18} /></span>
                <input id="pphone" type="tel" className="input" value={form.phone}
                  placeholder="077 123 4567"
                  onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} disabled={busy} />
              </div>
            </Field>
            <div className="row gap-10">
              <button className="btn btn-outline grow" onClick={() => { setEditing(false); setForm({ name: user.name, phone: user.phone || '' }); }} disabled={busy}>
                Cancel
              </button>
              <button className="btn btn-primary grow" onClick={save} disabled={busy}>
                {busy ? <><span className="spinner" /> Saving…</> : <><Check size={17} /> Save changes</>}
              </button>
            </div>
          </div>
        ) : (
          <div>
            <div className="info-row">
              <User size={17} className="ir-ico" />
              <div className="grow"><div className="ir-label">Full name</div><div className="ir-value">{user?.name}</div></div>
            </div>
            <div className="info-row">
              <Mail size={17} className="ir-ico" />
              <div className="grow"><div className="ir-label">Email</div><div className="ir-value">{user?.email}</div></div>
            </div>
            <div className="info-row">
              <IdCard size={17} className="ir-ico" />
              <div className="grow"><div className="ir-label">NIC</div><div className="ir-value mono">{user?.nic}</div></div>
            </div>
            <div className="info-row">
              <Phone size={17} className="ir-ico" />
              <div className="grow">
                <div className="ir-label">Phone</div>
                <div className="ir-value">{user?.phone || <span className="subtle">Not provided</span>}</div>
              </div>
            </div>
          </div>
        )}
      </section>

      <section className="card card-pad stack gap-4">
        <h3 style={{ marginBottom: 8 }}>Preferences</h3>

        <button className="action-tile" onClick={onToggleTheme} style={{ border: 0, padding: '12px 0' }}>
          <span className="ai">{theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}</span>
          <span className="grow">
            <span className="strong" style={{ display: 'block' }}>Appearance</span>
            <span className="small muted">{theme === 'dark' ? 'Dark mode' : 'Light mode'}</span>
          </span>
        </button>

        {(canInstall || !installed) && (
          <button
            className="action-tile"
            onClick={() => canInstall ? install() : toast.info('Use your browser menu — "Add to Home Screen" — to install.')}
            style={{ border: 0, padding: '12px 0' }}
          >
            <span className="ai"><Download size={20} /></span>
            <span className="grow">
              <span className="strong" style={{ display: 'block' }}>Install app</span>
              <span className="small muted">Install E-Vigilance as an app on this device</span>
            </span>
          </button>
        )}
      </section>

      <button className="btn btn-danger btn-lg btn-block" onClick={() => setConfirmOut(true)}>
        <LogOut size={19} /> Sign out
      </button>

      <p className="tiny subtle text-center">E-Vigilance · Version 1.0.0</p>

      <Modal
        open={confirmOut}
        onClose={() => setConfirmOut(false)}
        title="Sign out?"
        footer={
          <>
            <button className="btn btn-outline grow" onClick={() => setConfirmOut(false)}>Cancel</button>
            <button className="btn btn-danger grow" onClick={() => { signOut(); navigate('/login', { replace: true }); }}>
              Sign out
            </button>
          </>
        }
      >
        <p className="muted">You will need to sign in again to file or track reports.</p>
      </Modal>
    </div>
  );
}
