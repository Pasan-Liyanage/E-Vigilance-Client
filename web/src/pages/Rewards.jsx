import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { LEDGER_META, PAYOUT_META } from '../constants';
import { Badge, EmptyState, Field, Skeleton } from '../components/ui';
import {
  Sparkle, Clock, CheckCircle, Send, Alert, Refresh, Check, Info, ChevronRight,
} from '../components/Icons';

const fmtDate = (d) =>
  new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const fmtPoints = (n) => `${Number(n || 0).toLocaleString()} pts`;
const fmtRupees = (n) => `Rs ${Number(n || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}`;

const BALANCE_TILES = [
  { key: 'available', label: 'Available', icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)' },
  { key: 'pending', label: 'Pending', icon: Clock, color: 'var(--amber)', bg: 'var(--amber-bg)' },
  { key: 'inPayout', label: 'Being paid', icon: Send, color: 'var(--brand-600)', bg: 'var(--brand-50)' },
  { key: 'paidOut', label: 'Paid out', icon: Sparkle, color: 'var(--brand-600)', bg: 'var(--brand-50)' },
];

/** A notice about the account's standing, when it limits rewards. */
function StandingNotice({ rewards }) {
  if (rewards.suspended) {
    return (
      <Notice tone="red" title="Your account is suspended">
        You cannot send reports or receive rewards while it is suspended. Contact Sri Lanka
        Police if you think this is a mistake.
      </Notice>
    );
  }
  if (rewards.excluded) {
    return (
      <Notice tone="red" title="This account no longer receives rewards">
        You can still send reports.
      </Notice>
    );
  }
  if (rewards.frozen) {
    return (
      <Notice tone="amber" title="Payouts are on hold">
        Your account is being reviewed. Your points are kept, and payouts resume when the review ends.
      </Notice>
    );
  }
  return null;
}

function Notice({ tone, title, children }) {
  const color = tone === 'red' ? 'var(--red)' : 'var(--amber)';
  return (
    <section className="card card-pad row gap-12" style={{ alignItems: 'flex-start', borderColor: color }}>
      <Alert size={19} style={{ flex: 'none', marginTop: 2, color }} />
      <div className="small muted">
        <strong style={{ color: 'var(--text)', display: 'block' }}>{title}</strong>
        {children}
      </div>
    </section>
  );
}

/** What is still needed before rewards can be paid (admin docs/16 §3). */
function Eligibility({ eligibility }) {
  const items = [
    { ok: eligibility.phoneVerified, label: 'Mobile number verified' },
    { ok: eligibility.nicVerified, label: 'NIC matches your date of birth' },
    { ok: eligibility.adult, label: '18 years or older' },
  ];
  return (
    <section className="card card-pad stack gap-12">
      <h3>Before rewards can be paid</h3>
      <div className="stack gap-8">
        {items.map((it) => (
          <div className="row gap-10 small" key={it.label}>
            <span style={{ color: it.ok ? 'var(--green)' : 'var(--text-subtle)', display: 'inline-flex' }}>
              {it.ok ? <Check size={16} /> : <Info size={16} />}
            </span>
            <span className={it.ok ? '' : 'muted'}>{it.label}</span>
          </div>
        ))}
      </div>
      {!eligibility.phoneVerified && (
        <Link to="/profile" className="small strong row gap-4">
          Verify your mobile number <ChevronRight size={15} />
        </Link>
      )}
    </section>
  );
}

/** Asks for the available points to be paid to a bank account or a mobile wallet. */
function PayoutForm({ available, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ method: 'bank', accountNumber: '', accountName: '', bankName: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const bank = form.method === 'bank';

  const submit = async (ev) => {
    ev.preventDefault();
    if (busy) return;
    setBusy(true);
    try {
      const res = await api.requestPayout({
        method: form.method,
        accountNumber: form.accountNumber,
        accountName: form.accountName.trim(),
        bankName: bank ? form.bankName.trim() : undefined,
      });
      toast.success(`Payout requested to ${res.account}.`);
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="stack gap-16" onSubmit={submit} noValidate>
      <p className="small muted">
        Ask for your {fmtPoints(available)} to be paid. Requests are paid in weekly batches.
      </p>
      <div className="row gap-8" role="radiogroup" aria-label="Pay to">
        {[{ key: 'bank', label: 'Bank account' }, { key: 'wallet', label: 'Mobile wallet' }].map((m) => (
          <button
            key={m.key} type="button" role="radio" aria-checked={form.method === m.key}
            className={`chip ${form.method === m.key ? 'active' : ''}`}
            onClick={() => setForm((f) => ({ ...f, method: m.key }))}
          >
            {m.label}
          </button>
        ))}
      </div>
      {bank && (
        <Field label="Bank" required htmlFor="bank">
          <input id="bank" className="input" placeholder="Bank of Ceylon" value={form.bankName}
            onChange={set('bankName')} disabled={busy} />
        </Field>
      )}
      <Field label={bank ? 'Account number' : 'Wallet number'} required htmlFor="acct">
        <input id="acct" className="input mono" inputMode="numeric"
          placeholder={bank ? '1234567890' : '077 123 4567'}
          value={form.accountNumber} onChange={set('accountNumber')} disabled={busy} />
      </Field>
      <Field label="Account holder's name" required hint="As the bank or wallet provider has it." htmlFor="acname">
        <input id="acname" className="input" autoComplete="name" value={form.accountName}
          onChange={set('accountName')} disabled={busy} />
      </Field>
      <button className="btn btn-primary" type="submit" style={{ alignSelf: 'flex-start' }} disabled={busy}>
        {busy ? <><span className="spinner" /> Sending…</> : <><Send size={16} /> Ask for payout</>}
      </button>
    </form>
  );
}

export default function Rewards() {
  const [rewards, setRewards] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const res = await api.rewards();
      setRewards(res.rewards);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="container stack gap-20" style={{ maxWidth: 820 }}>
        <Skeleton h={28} w={160} />
        <div className="stats-grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} h={104} r="var(--r-lg)" />)}</div>
        <Skeleton h={180} r="var(--r-lg)" />
      </div>
    );
  }

  if (failed) {
    return (
      <div className="container">
        <div className="card card-pad">
          <EmptyState
            icon={Alert}
            title="Could not load your rewards"
            message="Check your connection and try again."
            action={<button className="btn btn-outline" onClick={load}><Refresh size={17} /> Retry</button>}
          />
        </div>
      </div>
    );
  }

  const { balance, eligibility, ledger, payouts } = rewards;
  const blocked = rewards.suspended || rewards.excluded || rewards.frozen;
  const canRequest =
    !blocked && eligibility.eligible && !rewards.requestOpen && balance.available >= rewards.minPayoutPoints;

  return (
    <div className="container stack gap-20" style={{ maxWidth: 820 }}>
      <div>
        <h1>Rewards</h1>
        <p className="muted small mt-4">
          Points for reports that lead to enforcement action by Sri Lanka Police.
        </p>
      </div>

      <StandingNotice rewards={rewards} />
      {!eligibility.eligible && !rewards.suspended && !rewards.excluded && (
        <Eligibility eligibility={eligibility} />
      )}

      <section className="stats-grid">
        {BALANCE_TILES.map(({ key, label, icon: Icon, color, bg }) => (
          <div className="stat-card" key={key}>
            <div className="stat-icon" style={{ background: bg, color }}><Icon size={19} /></div>
            <div className="stat-value" style={{ fontSize: '1.5rem' }}>{Number(balance[key] || 0).toLocaleString()}</div>
            <div className="stat-label">{label}</div>
          </div>
        ))}
      </section>

      {balance.expiringSoon > 0 && (
        <Notice tone="amber" title={`${fmtPoints(balance.expiringSoon)} expire soon`}>
          Confirmed points expire 12 months after they are confirmed. Ask for a payout before then.
        </Notice>
      )}

      <section className="card card-pad stack gap-12">
        <h3>Payout</h3>
        {rewards.requestOpen ? (
          <p className="small muted">
            Your payout request is being processed. You will see the result under Payouts below.
          </p>
        ) : canRequest ? (
          <PayoutForm available={balance.available} onDone={load} />
        ) : (
          <p className="small muted">
            {blocked
              ? 'Payouts are not available for this account right now.'
              : !eligibility.eligible
              ? 'Payouts open once the checks above are complete.'
              : `You can ask for a payout once you have at least ${fmtPoints(rewards.minPayoutPoints)} available.`}
          </p>
        )}
      </section>

      <section className="stack gap-12">
        <h2 className="section-title">Points</h2>
        {ledger.length === 0 ? (
          <div className="card card-pad">
            <EmptyState
              icon={Sparkle}
              title="No points yet"
              message="When a report you sent leads to a penalty notice or a court case, its points appear here."
            />
          </div>
        ) : (
          <div className="card">
            {ledger.map((l, i) => (
              <div className="card-pad between gap-12" key={`${l.reportNumber}-${i}`}
                style={{ borderTop: i ? '1px solid var(--border)' : 0 }}>
                <div className="grow stack gap-4" style={{ minWidth: 0 }}>
                  <span className="mono small strong">{l.reportNumber}</span>
                  {l.message && <span className="tiny muted">{l.message}</span>}
                  <span className="tiny subtle">{fmtDate(l.at)}</span>
                </div>
                <div className="stack gap-6" style={{ alignItems: 'flex-end', flex: 'none' }}>
                  <span className="strong">{fmtPoints(l.points)}</span>
                  <Badge meta={LEDGER_META} value={l.status} size="sm" />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {payouts.length > 0 && (
        <section className="stack gap-12">
          <h2 className="section-title">Payouts</h2>
          <div className="card">
            {payouts.map((p, i) => (
              <div className="card-pad between gap-12" key={`${p.at}-${i}`}
                style={{ borderTop: i ? '1px solid var(--border)' : 0 }}>
                <div className="grow stack gap-4" style={{ minWidth: 0 }}>
                  <span className="strong">{fmtRupees(p.amount)}</span>
                  <span className="tiny muted">
                    {fmtPoints(p.points)}{p.reference ? ` · Reference ${p.reference}` : ''}
                  </span>
                  {p.message && <span className="tiny muted">{p.message}</span>}
                  <span className="tiny subtle">{fmtDate(p.at)}</span>
                </div>
                <Badge meta={PAYOUT_META} value={p.status} size="sm" />
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="tiny subtle">
        Sri Lanka Police decide each reward. Points stay pending until the case is settled, and
        can be reversed if its outcome changes.
      </p>
    </div>
  );
}
