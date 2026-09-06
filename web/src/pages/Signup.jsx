import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field } from '../components/ui';
import { Shield, Mail, Lock, User, IdCard, Phone, Eye, EyeOff, ChevronRight, Check } from '../components/Icons';

/** Sri Lankan NIC: 9 digits + V/X, or the 12-digit form. */
const NIC_RE = /^(\d{9}[VvXx]|\d{12})$/;

const strength = (pw) => {
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[A-Z]/.test(pw) && /[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return Math.min(score, 4);
};
const STRENGTH_LABEL = ['Too short', 'Weak', 'Fair', 'Good', 'Strong'];
const STRENGTH_COLOR = ['var(--red)', 'var(--red)', 'var(--amber)', 'var(--sky)', 'var(--green)'];

export default function Signup() {
  const { signUp } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();

  const [form, setForm] = useState({ name: '', email: '', nic: '', phone: '', password: '', confirm: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim()) e.name = 'Enter your full name.';
    else if (form.name.trim().length < 3) e.name = 'That name looks too short.';

    if (!form.email.trim()) e.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'That email does not look right.';

    if (!form.nic.trim()) e.nic = 'Enter your NIC number.';
    else if (!NIC_RE.test(form.nic.trim())) e.nic = 'Use 9 digits and a letter (e.g. 991234567V) or 12 digits.';

    if (form.phone.trim() && !/^[0-9+\-\s()]{9,15}$/.test(form.phone.trim())) {
      e.phone = 'That phone number does not look right.';
    }

    if (!form.password) e.password = 'Choose a password.';
    else if (form.password.length < 6) e.password = 'Use at least 6 characters.';

    if (form.confirm !== form.password) e.confirm = 'The two passwords do not match.';

    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate() || busy) return;

    setBusy(true);
    try {
      const user = await signUp({
        name: form.name.trim(),
        email: form.email.trim(),
        nic: form.nic.trim().toUpperCase(),
        phone: form.phone.trim() || undefined,
        password: form.password,
      });
      toast.success(`Account created. Welcome, ${user.name.split(' ')[0]}!`);
      navigate('/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message);
      if (/email/i.test(err.message)) setErrors({ email: err.message });
      else if (/nic/i.test(err.message)) setErrors({ nic: err.message });
    } finally {
      setBusy(false);
    }
  };

  const score = strength(form.password);

  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="row gap-10">
          <span className="brand-mark" style={{ background: 'rgba(255,255,255,.18)', boxShadow: 'none' }}>
            <Shield size={19} />
          </span>
          <span style={{ fontWeight: 750, fontSize: '1.06rem', letterSpacing: '-0.03em' }}>E-Vigilance</span>
        </div>
        <div>
          <h1 style={{ fontSize: 'clamp(2rem, 3vw, 2.7rem)', color: '#fff' }}>
            Every report<br />makes a difference.
          </h1>
          <p style={{ color: 'rgba(255,255,255,.86)', maxWidth: 400, marginTop: 14, fontSize: '1.02rem' }}>
            Create your account once, then report a violation in under a minute.
          </p>
          <div className="stack gap-10 mt-24">
            {['Free to use', 'Your details stay private', 'Track every case you file'].map((t) => (
              <div className="row gap-10" key={t} style={{ color: 'rgba(255,255,255,.9)' }}>
                <Check size={17} /> <span className="small">{t}</span>
              </div>
            ))}
          </div>
        </div>
        <span />
      </aside>

      <main className="auth-main">
        <form className="auth-card stack gap-20" onSubmit={submit} noValidate>
          <div className="stack gap-8">
            <span className="brand-mark only-mobile" style={{ width: 52, height: 52, borderRadius: 16 }}>
              <Shield size={26} />
            </span>
            <h1 className="mt-8">Create your account</h1>
            <p className="muted">It takes less than a minute.</p>
          </div>

          <div className="stack gap-16">
            <Field label="Full name" required error={errors.name} htmlFor="name">
              <div className="input-group">
                <span className="lead"><User size={18} /></span>
                <input id="name" className={`input ${errors.name ? 'invalid' : ''}`} autoComplete="name"
                  placeholder="Nimal Perera" value={form.name} onChange={set('name')} disabled={busy} />
              </div>
            </Field>

            <Field label="Email address" required error={errors.email} htmlFor="email">
              <div className="input-group">
                <span className="lead"><Mail size={18} /></span>
                <input id="email" type="email" inputMode="email" autoComplete="email"
                  className={`input ${errors.email ? 'invalid' : ''}`}
                  placeholder="you@example.com" value={form.email} onChange={set('email')} disabled={busy} />
              </div>
            </Field>

            <Field label="NIC number" required error={errors.nic}
              hint="Sri Lankan NIC — 991234567V or 199912345678" htmlFor="nic">
              <div className="input-group">
                <span className="lead"><IdCard size={18} /></span>
                <input id="nic" className={`input ${errors.nic ? 'invalid' : ''}`}
                  placeholder="991234567V" value={form.nic} onChange={set('nic')} disabled={busy} />
              </div>
            </Field>

            <Field label="Phone number" error={errors.phone} hint="Optional — helps the authority reach you" htmlFor="phone">
              <div className="input-group">
                <span className="lead"><Phone size={18} /></span>
                <input id="phone" type="tel" inputMode="tel" autoComplete="tel"
                  className={`input ${errors.phone ? 'invalid' : ''}`}
                  placeholder="077 123 4567" value={form.phone} onChange={set('phone')} disabled={busy} />
              </div>
            </Field>

            <Field label="Password" required error={errors.password} htmlFor="pw">
              <div className="input-group">
                <span className="lead"><Lock size={18} /></span>
                <input id="pw" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  className={`input ${errors.password ? 'invalid' : ''}`}
                  placeholder="At least 6 characters" value={form.password} onChange={set('password')} disabled={busy} />
                <button type="button" className="trail" onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}>
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
              {form.password && (
                <div className="row gap-8 mt-4">
                  <div className="progress-track grow">
                    <div className="progress-bar"
                      style={{ width: `${(score / 4) * 100}%`, background: STRENGTH_COLOR[score] }} />
                  </div>
                  <span className="tiny" style={{ color: STRENGTH_COLOR[score], fontWeight: 650 }}>
                    {STRENGTH_LABEL[score]}
                  </span>
                </div>
              )}
            </Field>

            <Field label="Confirm password" required error={errors.confirm} htmlFor="confirm">
              <div className="input-group">
                <span className="lead"><Lock size={18} /></span>
                <input id="confirm" type={showPw ? 'text' : 'password'} autoComplete="new-password"
                  className={`input ${errors.confirm ? 'invalid' : ''}`}
                  placeholder="Repeat your password" value={form.confirm} onChange={set('confirm')} disabled={busy} />
              </div>
            </Field>
          </div>

          <button className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
            {busy ? <><span className="spinner" /> Creating account…</> : <>Create account <ChevronRight size={18} /></>}
          </button>

          <p className="text-center small muted">
            Already registered? <Link to="/login" className="strong">Sign in</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
