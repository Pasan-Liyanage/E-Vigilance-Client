import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Field } from '../components/ui';
import { Mail, Lock, Eye, EyeOff, ChevronRight } from '../components/Icons';
import Logo, { LogoPlate } from '../components/Logo';

export default function Login() {
  const { signIn } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => {
    setForm((f) => ({ ...f, [k]: e.target.value }));
    setErrors((x) => ({ ...x, [k]: undefined }));
  };

  const validate = () => {
    const e = {};
    if (!form.email.trim()) e.email = 'Enter your email address.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) e.email = 'That email does not look right.';
    if (!form.password) e.password = 'Enter your password.';
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const submit = async (ev) => {
    ev.preventDefault();
    if (!validate() || busy) return;

    setBusy(true);
    try {
      const user = await signIn(form.email.trim(), form.password);
      toast.success(`Welcome back, ${user.name.split(' ')[0]}!`);
      navigate(location.state?.from || '/dashboard', { replace: true });
    } catch (err) {
      toast.error(err.message);
      if (err.status === 401) setErrors({ password: 'Incorrect email or password.' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="row gap-10">
          <LogoPlate size={44} />
          <span style={{ fontWeight: 750, fontSize: '1.06rem', letterSpacing: '-0.03em' }}>E-Vigilance</span>
        </div>
        <div>
          <h1 style={{ fontSize: 'clamp(2rem, 3vw, 2.7rem)', color: '#fff' }}>
            Good to see you<br />again.
          </h1>
          <p style={{ color: 'rgba(255,255,255,.86)', maxWidth: 400, marginTop: 14, fontSize: '1.02rem' }}>
            Sign in to file a new report or check where your existing cases stand.
          </p>
        </div>
        <span />
      </aside>

      <main className="auth-main">
        <form className="auth-card stack gap-20" onSubmit={submit} noValidate>
          <div className="stack gap-8">
            <Logo size={52} className="only-mobile" />
            <h1 className="mt-8">Sign in</h1>
            <p className="muted">Enter your details to continue.</p>
          </div>

          <div className="stack gap-16">
            <Field label="Email address" required error={errors.email} htmlFor="email">
              <div className="input-group">
                <span className="lead"><Mail size={18} /></span>
                <input
                  id="email" type="email" inputMode="email" autoComplete="email"
                  className={`input ${errors.email ? 'invalid' : ''}`}
                  placeholder="you@example.com"
                  value={form.email} onChange={set('email')} disabled={busy}
                />
              </div>
            </Field>

            <Field label="Password" required error={errors.password} htmlFor="password">
              <div className="input-group">
                <span className="lead"><Lock size={18} /></span>
                <input
                  id="password" type={showPw ? 'text' : 'password'} autoComplete="current-password"
                  className={`input ${errors.password ? 'invalid' : ''}`}
                  placeholder="Your password"
                  value={form.password} onChange={set('password')} disabled={busy}
                />
                <button
                  type="button" className="trail"
                  onClick={() => setShowPw((s) => !s)}
                  aria-label={showPw ? 'Hide password' : 'Show password'}
                >
                  {showPw ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </Field>
          </div>

          <button className="btn btn-primary btn-lg btn-block" disabled={busy} type="submit">
            {busy ? <><span className="spinner" /> Signing in…</> : <>Sign in <ChevronRight size={18} /></>}
          </button>

          <p className="text-center small muted">
            New to E-Vigilance? <Link to="/signup" className="strong">Create an account</Link>
          </p>
        </form>
      </main>
    </div>
  );
}
