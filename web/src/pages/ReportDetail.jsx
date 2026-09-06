import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { StatusBadge, InfoRow, Skeleton, EmptyState } from '../components/ui';
import {
  ChevronLeft, Car, Calendar, MapPin, Alert, FileText, Mic, Image as ImageIcon,
  Video, Play, Clock, CheckCircle, X, Refresh, Info,
} from '../components/Icons';

const fmtFull = (d) =>
  new Date(d).toLocaleString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/** Status journey shown as a vertical timeline. */
function Timeline({ report }) {
  const submitted = { label: 'Report submitted', at: report.createdAt, done: true };
  const review = {
    label: 'Under review by the authority',
    at: report.status !== 'In Progress' ? report.updatedAt : null,
    done: true,
  };

  const final =
    report.status === 'Completed'
      ? { label: 'Resolved', at: report.updatedAt, done: true, cls: 'done' }
      : report.status === 'Rejected'
      ? { label: 'Rejected', at: report.updatedAt, done: true, cls: 'rejected' }
      : { label: 'Awaiting decision', at: null, done: false, cls: '' };

  const items = [
    { ...submitted, cls: 'done' },
    { ...review, cls: report.status === 'In Progress' ? 'done' : 'done' },
    final,
  ];

  return (
    <div className="timeline">
      {items.map((it, i) => (
        <div className={`tl-item ${it.cls}`} key={i}>
          <div className="strong small">{it.label}</div>
          <div className="tiny subtle">
            {it.at ? fmtFull(it.at) : 'Pending'}
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  // URLs that failed to load - the file was removed or the host is unreachable.
  const [brokenMedia, setBrokenMedia] = useState(() => new Set());
  const markBroken = (url) => setBrokenMedia((s) => new Set(s).add(url));

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const { report: r } = await api.getReport(id);
      setReport(r);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <div className="container stack gap-20">
        <Skeleton h={20} w={120} />
        <Skeleton h={260} r="var(--r-lg)" />
        <div className="stack gap-10">
          <Skeleton h={16} w="55%" /><Skeleton h={16} w="40%" /><Skeleton h={16} w="65%" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container">
        <div className="card card-pad">
          <EmptyState
            icon={Alert}
            title="Could not open this report"
            message={error}
            action={
              <div className="row gap-10" style={{ justifyContent: 'center' }}>
                <button className="btn btn-outline" onClick={load}><Refresh size={17} /> Retry</button>
                <Link to="/reports" className="btn btn-primary">Back to reports</Link>
              </div>
            }
          />
        </div>
      </div>
    );
  }

  const media = report.evidence?.length
    ? report.evidence
    : report.evidencePath
    ? [{ url: report.evidencePath, kind: 'image', storage: 'legacy' }]
    : [];
  const current = media[Math.min(active, media.length - 1)];

  return (
    <div className="container stack gap-20">
      <div className="between gap-12">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
        <StatusBadge status={report.status} />
      </div>

      <div>
        <h1 className="mono" style={{ letterSpacing: '0.02em' }}>{report.vehicleNumber}</h1>
        <p className="muted mt-4">{report.issueType}</p>
      </div>

      <div className="detail-grid">
        <div className="stack gap-16">
          {media.length > 0 ? (
            <div className="stack gap-10">
              <div className="media-main">
                {brokenMedia.has(current.url) ? (
                  <div className="media-missing">
                    <ImageIcon size={26} />
                    <span className="small strong">Evidence unavailable</span>
                    <span className="tiny">This file is no longer stored on the server.</span>
                  </div>
                ) : current.kind === 'video' ? (
                  <video
                    src={current.url} controls playsInline preload="metadata"
                    onError={() => markBroken(current.url)}
                  />
                ) : (
                  <img
                    src={current.url} alt="Submitted evidence"
                    onError={() => markBroken(current.url)}
                  />
                )}
              </div>

              {media.length > 1 && (
                <div className="thumb-strip">
                  {media.map((m, i) => (
                    <button
                      key={i}
                      className={`thumb ${i === active ? 'active' : ''}`}
                      onClick={() => setActive(i)}
                      aria-label={`View evidence ${i + 1}`}
                    >
                      {brokenMedia.has(m.url) ? (
                        <ImageIcon size={16} />
                      ) : m.kind === 'video' ? (
                        <>
                          <video src={m.url} muted playsInline preload="metadata"
                            onError={() => markBroken(m.url)} />
                          <span className="kind"><Play size={14} /></span>
                        </>
                      ) : (
                        <img src={m.url} alt="" loading="lazy" onError={() => markBroken(m.url)} />
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="card card-pad">
              <EmptyState icon={ImageIcon} title="No media attached" message="This report was submitted without photos or video." />
            </div>
          )}

          {report.voiceNote?.url && (
            <div className="card card-pad stack gap-10">
              <div className="row gap-8">
                <Mic size={17} className="subtle" />
                <span className="section-title">Voice note</span>
              </div>
              {brokenMedia.has(report.voiceNote.url) ? (
                <span className="small subtle">This voice note is no longer stored on the server.</span>
              ) : (
                <audio
                  controls src={report.voiceNote.url} preload="metadata"
                  onError={() => markBroken(report.voiceNote.url)}
                />
              )}
            </div>
          )}
        </div>

        <aside className="stack gap-16">
          <section className="card card-pad">
            <h3 style={{ marginBottom: 6 }}>Report details</h3>
            <InfoRow icon={Car} label="Vehicle"
              value={`${report.vehicleType}${report.vehicleModel ? ` — ${report.vehicleModel}` : ''}`} />
            <InfoRow icon={Alert} label="Violation" value={report.issueType} />
            <InfoRow icon={Calendar} label="When it happened" value={fmtFull(report.dateTime)} />
            <InfoRow
              icon={MapPin} label="Location"
              value={
                report.location || (report.latitude != null ? `${report.latitude}, ${report.longitude}` : null)
              }
            />
            {report.additionalDetails && (
              <InfoRow icon={FileText} label="Additional details" value={report.additionalDetails} />
            )}
            <InfoRow icon={Clock} label="Submitted" value={fmtFull(report.createdAt)} />
          </section>

          {report.latitude != null && report.longitude != null && (
            <section className="card" style={{ overflow: 'hidden' }}>
              <div className="map-frame" style={{ border: 0, borderRadius: 0 }}>
                <iframe
                  title="Report location"
                  loading="lazy"
                  src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                    [report.longitude - 0.004, report.latitude - 0.003, report.longitude + 0.004, report.latitude + 0.003].join(',')
                  }&layer=mapnik&marker=${report.latitude},${report.longitude}`}
                />
              </div>
              <div className="card-pad between">
                <span className="mono tiny subtle">{report.latitude}, {report.longitude}</span>
                <a
                  className="small strong"
                  href={`https://www.openstreetmap.org/?mlat=${report.latitude}&mlon=${report.longitude}#map=17/${report.latitude}/${report.longitude}`}
                  target="_blank" rel="noreferrer"
                >
                  Open map
                </a>
              </div>
            </section>
          )}

          <section className="card card-pad stack gap-14">
            <h3>Progress</h3>
            <Timeline report={report} />
            <div className="row gap-10" style={{ alignItems: 'flex-start', paddingTop: 4 }}>
              <Info size={16} className="subtle" style={{ flex: 'none', marginTop: 2 }} />
              <span className="tiny muted">
                Status changes are made by the traffic authority and appear here automatically.
              </span>
            </div>
          </section>

          <div className="row gap-8 tiny subtle" style={{ justifyContent: 'center' }}>
            Reference <span className="mono strong">{String(report._id).slice(-8).toUpperCase()}</span>
          </div>
        </aside>
      </div>
    </div>
  );
}
