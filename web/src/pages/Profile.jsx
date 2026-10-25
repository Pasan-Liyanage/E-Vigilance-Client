import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { api } from '../api/client';
import { Field, Modal, Skeleton } from '../components/ui';
import {
  User, Mail, IdCard, Phone, LogOut, Sun, Moon, Download, Shield, Lock, Calendar,
  FileText, CheckCircle, Clock, Check, Info, Alert, Trash, Sparkle, ChevronRight,
} from '../components/Icons';

const initials = (name = '') =>
  name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'U';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });

/** Seconds before another code may be asked for (the server allows one a minute). */
const RESEND_SECONDS = 60;

/** Small pill showing whether one detail has been checked. */
function CheckPill({ ok, okLabel, notLabel }) {
  return (
    <span className={`badge ${ok ? 'badge-completed' : 'badge-neutral'}`}>
      {ok ? <Check size={12} /> : <Info size={12} />} {ok ? okLabel : notLabel}
    </span>
  );
}

/**
 * Demo mode (SMS_PROVIDER=demo): no text message is sent, so the code is shown
 * here instead, always marked as a demonstration.
 */
function DemoNotice({ code }) {
  return (
    <div className="card card-pad stack gap-6" style={{ borderStyle: 'dashed', borderColor: 'var(--amber)' }}>
      <span className="badge badge-progress" style={{ alignSelf: 'flex-start' }}>Demo mode</span>
      {code ? (
        <span className="small">
          No text message was sent. Your code is{' '}
          <strong className="mono" style={{ letterSpacing: '0.2em', fontSize: '1.05rem' }}>{code}</strong>
        </span>
      ) : (
        <span className="small muted">
          No text message is sent in demo mode. The code will be shown here. It is valid for 10 minutes.
        </span>
      )}
    </div>
  );
}

/** Confirms the mobile number with a one-time code sent by text message. */
function PhoneVerification({ user, onEdit }) {
  const { verifyPhone } = useAuth();
  const toast = useToast();
  const [sentTo, setSentTo] = useState(null);
  // Demo mode only: the server returns the code instead of texting it.
  const [demoCode, setDemoCode] = useState(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (!wait) return undefined;
    const id = setTimeout(() => setWait((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [wait]);

  if (!user.phone) {
    return (
      <p className="small muted">
        Add your mobile number to verify it.{' '}
        <button className="btn btn-ghost btn-sm" onClick={onEdit}>Add number</button>
      </p>
    );
  }
  if (!user.smsAvailable) {
    return (
      <p className="small muted">
        Verification by text message is not available yet. You can still send reports;
        verification will open here when it is.
      </p>
    );
  }

  const send = async () => {
    setBusy(true);
    try {
      const res = await api.sendPhoneCode();
      setSentTo(res.sentTo);
      setDemoCode(res.demoCode || null);
      setCode('');
      setWait(RESEND_SECONDS);
      toast.success(res.demoCode ? 'Demo code ready.' : `Code sent to ${res.sentTo}.`);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    if (!/^\d{6}$/.test(code) || busy) return;
    setBusy(true);
    try {
      await verifyPhone(code);
      toast.success('Your mobile number is verified.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (!sentTo) {
    return (
      <div className="stack gap-10">
        {user.smsDemo ? <DemoNotice /> : (
          <p className="small muted">
            We will send a 6-digit code to {user.phone}. It is valid for 10 minutes.
          </p>
        )}
        <button className="btn btn-primary" style={{ alignSelf: 'flex-start' }} onClick={send} disabled={busy}>
          {busy ? <><span className="spinner" /> Sending…</> : <><Phone size={16} /> Send code</>}
        </button>
      </div>
    );
  }

  return (
    <div className="stack gap-12">
      {demoCode && <DemoNotice code={demoCode} />}
      <Field label={demoCode ? 'Enter the code' : `Code sent to ${sentTo}`} htmlFor="otp">
        <input
          id="otp" className="input mono" inputMode="numeric" autoComplete="one-time-code"
          maxLength={6} placeholder="123456" style={{ letterSpacing: '0.3em', fontWeight: 650 }}
          value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))} disabled={busy}
        />
      </Field>
      <div className="row gap-10 wrap">
        <button className="btn btn-primary" onClick={verify} disabled={busy || code.length !== 6}>
          {busy ? <><span className="spinner" /> Checking…</> : <><Check size={16} /> Verify</>}
        </button>
        <button className="btn btn-ghost" onClick={send} disabled={busy || wait > 0}>
          {wait > 0 ? `Send a new code in ${wait}s` : 'Send a new code'}
        </button>
      </div>
    </div>
  );
}

/** Deletes the account once the password confirms it is the owner asking. */
function DeleteAccount({ open, onClose }) {
  const { deleteAccount } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const close = () => {
    if (busy) return;
    setPassword('');
    setError('');
    onClose();
  };

  const confirm = async () => {
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await deleteAccount(password);
      toast.success('Your account has been deleted.');
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Delete your account?"
      footer={
        <>
          <button className="btn btn-outline grow" onClick={close} disabled={busy}>Cancel</button>
          <button className="btn btn-danger grow" onClick={confirm} disabled={busy || !password}>
            {busy ? <><span className="spinner" /> Deleting…</> : <><Trash size={16} /> Delete account</>}
          </button>
        </>
      }
    >
      <div className="stack gap-14">
        <ul className="stack gap-8 small muted" style={{ paddingLeft: 18, margin: 0 }}>
          <li>Your name, email, NIC, mobile number and date of birth are removed, and you can no longer sign in.</li>
          <li>Reports you have sent stay with Sri Lanka Police as evidence, without your personal details.</li>
          <li>Reward points that have not been paid out will not be paid.</li>
          <li>This cannot be undone.</li>
        </ul>
        <Field label="Enter your password to confirm" error={error} htmlFor="del-pw">
          <div className="input-group">
            <span className="lead"><Lock size={18} /></span>
            <input
              id="del-pw" type="password" autoComplete="current-password"
              className={`input ${error ? 'invalid' : ''}`}
              value={password} onChange={(e) => setPassword(e.target.value)} disabled={busy}
            />
          </div>
        </Field>
      </div>
    </Modal>
  );
}

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
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    api.stats().then((s) => setStats(s.stats)).catch(() => setStats(null));
  }, []);

  useEffect(() => {
    setForm({ name: user?.name || '', phone: user?.phone || '' });
  }, [user]);

  const save = async () => {
    if (!form.name.trim()) { toast.error('Your name cannot be empty.'); return; }
    if (!form.phone.trim()) { toast.error('Enter your mobile number.'); return; }
    setBusy(true);
    try {
      const changedPhone = form.phone.trim() !== (user.phone || '');
      const fresh = await updateProfile({ name: form.name.trim(), phone: form.phone.trim() });
      toast.success(
        changedPhone && !fresh.phoneVerified
          ? 'Profile updated. Verify your new mobile number below.'
          : 'Profile updated.'
      );
      setEditing(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const tiles = [
    { label: 'Total', value: stats?.total, icon: FileText, color: 'var(--brand-600)' },
    { label: 'Answer needed', value: stats?.waiting, icon: Info, color: 'var(--amber)' },
    { label: 'Being reviewed', value: stats?.review, icon: Clock, color: 'var(--brand-600)' },
    { label: 'Closed', value: stats?.closed, icon: CheckCircle, color: 'var(--green)' },
  ];

  return (
    <div className="container stack gap-20" style={{ maxWidth: 720 }}>
      <h1>Profile</h1>

      <section className="card card-pad row gap-16">
        <span className="avatar avatar-lg">{initials(user?.name)}</span>
        <div className="grow" style={{ minWidth: 0 }}>
          <h2 className="truncate">{user?.name}</h2>
          <p className="muted small truncate">{user?.email}</p>
          <div className="row gap-6 wrap mt-8">
            <CheckPill ok={user?.phoneVerified} okLabel="Mobile verified" notLabel="Mobile not verified" />
            <CheckPill ok={user?.nicVerified} okLabel="NIC confirmed" notLabel="NIC not confirmed" />
          </div>
        </div>
      </section>

      {!user?.phoneVerified && (
        <section className="card card-pad stack gap-12">
          <div className="row gap-8">
            <Shield size={18} style={{ color: 'var(--brand-600)' }} />
            <h3>Verify your mobile number</h3>
          </div>
          <PhoneVerification user={user} onEdit={() => setEditing(true)} />
        </section>
      )}

      {user && !user.nicVerified && (
        <section className="card card-pad row gap-12" style={{ alignItems: 'flex-start' }}>
          <Alert size={18} style={{ flex: 'none', marginTop: 2, color: 'var(--amber)' }} />
          <div className="small muted">
            <strong style={{ color: 'var(--text)' }}>Your NIC and date of birth do not match.</strong>{' '}
            You can still send reports, but rewards are paid only when the date of birth on
            your account matches your NIC number.
          </div>
        </section>
      )}

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
            <Field label="Mobile number" required hint="A new number has to be verified again." htmlFor="pphone">
              <div className="input-group">
                <span className="lead"><Phone size={18} /></span>
                <input id="pphone" type="tel" inputMode="tel" className="input" value={form.phone}
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
              <Calendar size={17} className="ir-ico" />
              <div className="grow">
                <div className="ir-label">Date of birth</div>
                <div className="ir-value">
                  {user?.dateOfBirth ? fmtDate(user.dateOfBirth) : <span className="subtle">Not provided</span>}
                </div>
              </div>
            </div>
            <div className="info-row">
              <Phone size={17} className="ir-ico" />
              <div className="grow">
                <div className="ir-label">Mobile number</div>
                <div className="ir-value">{user?.phone || <span className="subtle">Not provided</span>}</div>
              </div>
            </div>
            <p className="tiny subtle mt-8">
              Your NIC and date of birth cannot be changed after the account is created.
            </p>
          </div>
        )}
      </section>

      <Link to="/rewards" className="action-tile card card-pad">
        <span className="ai"><Sparkle size={20} /></span>
        <span className="grow">
          <span className="strong" style={{ display: 'block' }}>Rewards</span>
          <span className="small muted">Points earned from your reports, and payouts</span>
        </span>
        <ChevronRight size={18} className="subtle" />
      </Link>

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

      <section className="card card-pad stack gap-10">
        <h3>Delete account</h3>
        <p className="small muted">
          Removes your personal details from E-Vigilance. Reports you have sent stay with the police.
        </p>
        <button className="btn btn-outline" style={{ alignSelf: 'flex-start', color: 'var(--red)' }}
          onClick={() => setConfirmDelete(true)}>
          <Trash size={16} /> Delete my account
        </button>
      </section>

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
        <p className="muted">
          You will need to sign in again to send or follow reports. A report you have started
          but not sent will be discarded.
        </p>
      </Modal>

      <DeleteAccount open={confirmDelete} onClose={() => setConfirmDelete(false)} />
    </div>
  );
}
