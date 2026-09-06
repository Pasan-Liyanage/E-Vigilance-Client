import { useState } from 'react';
import { Link } from 'react-router-dom';
import { StatusBadge } from './ui';
import { Image, Video, Mic, Calendar, MapPin } from './Icons';

const fmtDate = (d) =>
  new Date(d).toLocaleString(undefined, {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });

/** Compact row used in the dashboard and the reports list. */
export default function ReportCard({ report }) {
  const [thumbBroken, setThumbBroken] = useState(false);
  const media = report.evidence?.length ? report.evidence : (report.evidencePath ? [{ url: report.evidencePath, kind: 'image' }] : []);
  const first = media[0];
  const extra = media.length - 1;

  return (
    <Link to={`/reports/${report._id}`} className="report-card">
      <div className="report-thumb">
        {first && !thumbBroken ? (
          first.kind === 'video' ? (
            <>
              <video src={first.url} muted playsInline preload="metadata"
                onError={() => setThumbBroken(true)} />
              <span className="count"><Video size={10} /></span>
            </>
          ) : (
            <img src={first.url} alt="" loading="lazy" onError={() => setThumbBroken(true)} />
          )
        ) : (
          <Image size={22} />
        )}
        {extra > 0 && <span className="count">+{extra}</span>}
      </div>

      <div className="grow stack gap-6" style={{ minWidth: 0 }}>
        <div className="between gap-8">
          <span className="strong truncate">{report.vehicleNumber}</span>
          <StatusBadge status={report.status} size="sm" />
        </div>

        <span className="small muted truncate">{report.issueType}</span>

        <div className="row gap-12 wrap tiny subtle" style={{ minWidth: 0 }}>
          <span className="row gap-4">
            <Calendar size={12} style={{ flex: 'none' }} /> {fmtDate(report.dateTime)}
          </span>
          {report.voiceNote && (
            <span className="row gap-4"><Mic size={12} style={{ flex: 'none' }} /> Voice</span>
          )}
        </div>

        {report.location && (
          <span className="row gap-4 tiny subtle" style={{ minWidth: 0, maxWidth: '100%' }}>
            <MapPin size={12} style={{ flex: 'none' }} />
            <span className="truncate">{report.location}</span>
          </span>
        )}
      </div>
    </Link>
  );
}
