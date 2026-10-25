import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { REPLY_MAX } from '../constants';
import { StatusBadge, InfoRow, Skeleton, EmptyState } from '../components/ui';
import {
  ChevronLeft, Car, Calendar, MapPin, Alert, FileText, Mic, Image as ImageIcon,
  Play, Clock, Refresh, Info, Download, Send, CheckCircle,
} from '../components/Icons';

const fmtFull = (d) =>
  new Date(d).toLocaleString(undefined, {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

/** Update types that end the report badly, shown with a red marker. */
const NEGATIVE = new Set(['rejected']);

/**
 * The report's journey: its submission, then each update the police wrote,
 * in their own words. Before the police have looked at it, says so.
 */
function Timeline({ report, updates }) {
  const items = [
    { key: 'sent', title: 'Report sent', message: null, at: report.createdAt, cls: 'done' },
    ...updates.map((u, i) => ({
      key: `${u.type}-${i}`,
      title: u.title,
      message: u.message,
      at: u.at,
      cls: NEGATIVE.has(u.type) ? 'rejected' : 'done',
    })),
  ];
  if (!updates.length) {
    items.push({
      key: 'next',
      title: 'Waiting for the police to review it',
      message: 'You will see their updates here.',
      at: null,
      cls: '',
    });
  }

  return (
    <div className="timeline">
      {items.map((it) => (
        <div className={`tl-item ${it.cls}`} key={it.key}>
          <div className="strong small">{it.title}</div>
          {it.message && <div className="small muted mt-4" style={{ whiteSpace: 'pre-line' }}>{it.message}</div>}
          {it.at && <div className="tiny subtle mt-4">{fmtFull(it.at)}</div>}
        </div>
      ))}
    </div>
  );
}

/** The police's open question, and the citizen's one answer to it. */
function QuestionCard({ question, onAnswer }) {
  const [answer, setAnswer] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();

  if (question.answered) {
    return (
      <section className="card card-pad stack gap-8" style={{ borderColor: 'var(--green)' }}>
        <div className="row gap-8">
          <CheckCircle size={18} style={{ color: 'var(--green)' }} />
          <h3>Answer sent</h3>
        </div>
        <p className="small muted">
          Thank you. The police will read your answer and update this report.
        </p>
      </section>
    );
  }

  const send = async () => {
    const text = answer.trim();
    if (text.length < 2 || busy) return;
    setBusy(true);
    try {
      await api.replyToReport(question.reportId, text);
      toast.success('Your answer has been sent.');
      onAnswer();
    } catch (err) {
      toast.error(err.message);
      // 409: answered already, or the question has closed; show the current state.
      if (err.status === 409) onAnswer();
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="card card-pad stack gap-12" style={{ borderColor: 'var(--amber)' }}>
      <div className="row gap-8">
        <Info size={18} style={{ color: 'var(--amber)' }} />
        <h3>The police need more information</h3>
      </div>
      <p className="small" style={{ whiteSpace: 'pre-line' }}>{question.text}</p>
      <label className="label" htmlFor="answer">Your answer</label>
      <textarea
        id="answer" className="textarea" maxLength={REPLY_MAX}
        placeholder="Answer as fully as you can. You can send one answer to this question."
        value={answer} onChange={(e) => setAnswer(e.target.value)} disabled={busy}
      />
      <div className="between gap-12">
        <span className="tiny subtle">{answer.length}/{REPLY_MAX} characters</span>
        <button className="btn btn-primary" onClick={send} disabled={busy || answer.trim().length < 2}>
          {busy ? <><span className="spinner" /> Sending…</> : <><Send size={16} /> Send answer</>}
        </button>
      </div>
    </section>
  );
}

export default function ReportDetail() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [report, setReport] = useState(null);
  // The police's updates, and their open question if there is one.
  const [timeline, setTimeline] = useState({ updates: [], question: null });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [active, setActive] = useState(0);
  // URLs that failed to load - the file was removed or the host is unreachable.
  const [brokenMedia, setBrokenMedia] = useState(() => new Set());
  const markBroken = (url) => setBrokenMedia((s) => new Set(s).add(url));
  // MediaError code for the voice note. 3/4 mean the file arrived but this
  // browser cannot decode it, which is different from it being missing.
  const [voiceError, setVoiceError] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    setVoiceError(0);
    try {
      const [{ report: r }, t] = await Promise.all([
        api.getReport(id),
        // The report still opens if its updates can't be fetched.
        api.reportUpdates(id).catch(() => ({ updates: [], question: null })),
      ]);
      setReport(r);
      setTimeline({ updates: t.updates || [], question: t.question || null });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  const reloadTimeline = useCallback(async () => {
    try {
      const t = await api.reportUpdates(id);
      setTimeline({ updates: t.updates || [], question: t.question || null });
    } catch { /* the current view stays */ }
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
  const { updates, question } = timeline;
  const latest = [...updates].reverse().find((u) => u.type !== 'reward');
  // The police's reference arrives with their first update.
  const reportNumber = updates.find((u) => u.reportNumber)?.reportNumber || null;

  return (
    <div className="container stack gap-20">
      <div className="between gap-12">
        <button className="btn btn-ghost" onClick={() => navigate(-1)}>
          <ChevronLeft size={18} /> Back
        </button>
        <StatusBadge report={report} latestType={latest?.type} />
      </div>

      <div>
        <h1 className="mono" style={{ letterSpacing: '0.02em' }}>{report.vehicleNumber}</h1>
        <p className="muted mt-4">{report.issueType}</p>
      </div>

      {question && <QuestionCard question={{ ...question, reportId: report._id }} onAnswer={reloadTimeline} />}

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
              {voiceError ? (
                <div className="stack gap-8">
                  <span className="small subtle">
                    {voiceError === 3 || voiceError === 4
                      ? "This recording's format can't be played in this browser."
                      : 'This voice note could not be loaded.'}
                  </span>
                  <a className="btn btn-sm btn-outline" style={{ alignSelf: 'flex-start' }}
                    href={report.voiceNote.url} target="_blank" rel="noreferrer" download>
                    <Download size={16} /> Open recording
                  </a>
                </div>
              ) : (
                <audio
                  controls src={report.voiceNote.url} preload="metadata"
                  onError={(e) => setVoiceError(e.currentTarget.error?.code || 2)}
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
            <InfoRow icon={Alert} label="Offence" value={report.issueType} />
            {typeof report.injuries === 'boolean' && (
              <InfoRow icon={Info} label="Anyone hurt" value={report.injuries ? 'Yes' : 'No'} />
            )}
            <InfoRow icon={Calendar} label="When it happened" value={fmtFull(report.occurredAt || report.dateTime)} />
            <InfoRow
              icon={MapPin} label="Location"
              value={
                report.location || (report.latitude != null ? `${report.latitude}, ${report.longitude}` : null)
              }
            />
            {(report.description || report.additionalDetails) && (
              <InfoRow icon={FileText} label="What happened" value={report.description || report.additionalDetails} />
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
            <Timeline report={report} updates={updates} />
            <div className="row gap-10" style={{ alignItems: 'flex-start', paddingTop: 4 }}>
              <Info size={16} className="subtle" style={{ flex: 'none', marginTop: 2 }} />
              <span className="tiny muted">
                Updates are written by Sri Lanka Police and appear here as they review your report.
              </span>
            </div>
          </section>

          <div className="stack gap-4 tiny subtle" style={{ alignItems: 'center' }}>
            {reportNumber && (
              <span>Police reference <span className="mono strong">{reportNumber}</span></span>
            )}
            <span>App reference <span className="mono strong">{String(report._id).slice(-8).toUpperCase()}</span></span>
          </div>
        </aside>
      </div>
    </div>
  );
}
