import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useInstallPrompt } from '../hooks/useInstallPrompt';
import { installSheetDismissed } from '../components/InstallPrompt';
import { Skeleton, EmptyState } from '../components/ui';
import ReportCard from '../components/ReportCard';
import {
  Plus, FileText, Clock, CheckCircle, X, Camera, ChevronRight,
  Download, Alert, Refresh,
} from '../components/Icons';

const STAT_TILES = [
  { key: 'total', label: 'Total reports', icon: FileText, color: 'var(--brand-600)', bg: 'var(--brand-50)' },
  { key: 'inProgress', label: 'In progress', icon: Clock, color: 'var(--amber)', bg: 'var(--amber-bg)' },
  { key: 'completed', label: 'Completed', icon: CheckCircle, color: 'var(--green)', bg: 'var(--green-bg)' },
  { key: 'rejected', label: 'Rejected', icon: X, color: 'var(--red)', bg: 'var(--red-bg)' },
];

const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
};

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { canInstall, install } = useInstallPrompt();

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      const [s, r] = await Promise.all([api.stats(), api.listReports({ limit: 4 })]);
      setStats(s.stats);
      setRecent(r.reports || []);
    } catch {
      setFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="container stack gap-24">
      {/* Hero */}
      <section className="hero-card animate-in">
        <p style={{ color: 'rgba(255,255,255,.85)', fontSize: '0.88rem', fontWeight: 550 }}>
          {greeting()},
        </p>
        <h1 style={{ color: '#fff', marginTop: 2 }}>{user?.name?.split(' ')[0] || 'there'}</h1>
        <p style={{ color: 'rgba(255,255,255,.86)', marginTop: 8, maxWidth: 460 }}>
          Spotted a traffic violation? Capture the evidence and file a report in under a minute.
        </p>
        <button
          className="btn btn-lg mt-20"
          style={{ background: '#fff', color: 'var(--brand-700)', borderColor: 'transparent' }}
          onClick={() => navigate('/report')}
        >
          <Camera size={19} /> Report a violation
        </button>
      </section>

      {canInstall && installSheetDismissed() && (
        <div className="install-bar animate-in">
          <Download size={20} style={{ flex: 'none' }} />
          <div className="grow">
            <div className="small strong">Install E-Vigilance</div>
            <div className="tiny">Add it to your home screen for quick, app-like access.</div>
          </div>
          <button className="btn btn-sm btn-primary" onClick={install}>Install</button>
        </div>
      )}

      {/* Stats */}
      <section className="stack gap-12">
        <h2 className="section-title">Your activity</h2>
        <div className="stats-grid">
          {STAT_TILES.map(({ key, label, icon: Icon, color, bg }) => (
            <div className="stat-card" key={key}>
              <div className="stat-icon" style={{ background: bg, color }}>
                <Icon size={19} />
              </div>
              {loading ? (
                <Skeleton h={28} w={54} />
              ) : (
                <div className="stat-value" style={{ color: key === 'total' ? 'var(--text)' : color }}>
                  {stats?.[key] ?? 0}
                </div>
              )}
              <div className="stat-label">{label}</div>
            </div>
          ))}
        </div>
      </section>

      <div className="dash-grid">
        {/* Recent reports */}
        <section className="stack gap-12">
          <div className="between">
            <h2 className="section-title">Recent reports</h2>
            {recent.length > 0 && (
              <Link to="/reports" className="small strong row gap-4">
                View all <ChevronRight size={15} />
              </Link>
            )}
          </div>

          {loading ? (
            <div className="stack gap-10">
              {[0, 1, 2].map((i) => (
                <div className="card card-pad row gap-14" key={i}>
                  <Skeleton h={76} w={76} r="var(--r-md)" />
                  <div className="grow stack gap-8">
                    <Skeleton h={15} w="65%" />
                    <Skeleton h={12} w="45%" />
                    <Skeleton h={12} w="30%" />
                  </div>
                </div>
              ))}
            </div>
          ) : failed ? (
            <div className="card card-pad">
              <EmptyState
                icon={Alert}
                title="Could not load your reports"
                message="Check your connection and try again."
                action={<button className="btn btn-outline" onClick={load}><Refresh size={17} /> Retry</button>}
              />
            </div>
          ) : recent.length === 0 ? (
            <div className="card card-pad">
              <EmptyState
                title="No reports yet"
                message="When you report a violation it will show up here so you can follow its progress."
                action={
                  <Link to="/report" className="btn btn-primary">
                    <Plus size={18} /> File your first report
                  </Link>
                }
              />
            </div>
          ) : (
            <div className="stack gap-10">
              {recent.map((r) => <ReportCard key={r._id} report={r} />)}
            </div>
          )}
        </section>

        {/* Side column */}
        <aside className="stack gap-20">
          <section className="stack gap-12">
            <h2 className="section-title">Quick actions</h2>
            <div className="stack gap-10">
              <Link to="/report" className="action-tile">
                <span className="ai"><Plus size={20} /></span>
                <span className="grow">
                  <span className="strong" style={{ display: 'block' }}>New report</span>
                  <span className="small muted">Photo, video, voice and location</span>
                </span>
                <ChevronRight size={18} className="subtle" />
              </Link>
              <Link to="/reports" className="action-tile">
                <span className="ai"><FileText size={20} /></span>
                <span className="grow">
                  <span className="strong" style={{ display: 'block' }}>My reports</span>
                  <span className="small muted">Check status and details</span>
                </span>
                <ChevronRight size={18} className="subtle" />
              </Link>
            </div>
          </section>

          <section className="card card-pad stack gap-12">
            <h3>Before you report</h3>
            <ul className="stack gap-10 muted small" style={{ paddingLeft: 18, margin: 0 }}>
              <li>Never film while you are driving — stop somewhere safe first.</li>
              <li>Make sure the number plate is readable in at least one photo.</li>
              <li>Add the time and place as accurately as you can.</li>
              <li>Only submit what you saw yourself. False reports may be penalised.</li>
            </ul>
          </section>
        </aside>
      </div>
    </div>
  );
}
