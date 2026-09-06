import { Link } from 'react-router-dom';
import { Shield, Camera, MapPin, FileText, ChevronRight } from '../components/Icons';

const FEATURES = [
  { icon: Camera, title: 'Capture real evidence', text: 'Photos, video and a voice note, straight from your phone.' },
  { icon: MapPin, title: 'Pinpoint the location', text: 'Your GPS position is attached automatically.' },
  { icon: FileText, title: 'Follow every case', text: 'Watch each report move from submitted to resolved.' },
];

/** Public landing screen. */
export default function Welcome() {
  return (
    <div className="auth-wrap">
      <aside className="auth-aside">
        <div className="row gap-10">
          <span className="brand-mark" style={{ background: 'rgba(255,255,255,.18)', boxShadow: 'none' }}>
            <Shield size={19} />
          </span>
          <span style={{ fontWeight: 750, fontSize: '1.06rem', letterSpacing: '-0.03em' }}>E-Vigilance</span>
        </div>

        <div className="stack gap-24">
          <h1 style={{ fontSize: 'clamp(2rem, 3vw, 2.7rem)', color: '#fff' }}>
            Safer roads start with<br />what you report.
          </h1>
          <p style={{ color: 'rgba(255,255,255,.86)', maxWidth: 420, fontSize: '1.02rem' }}>
            Report a traffic violation in under a minute, attach the evidence that matters,
            and follow exactly what happens next.
          </p>

          <div className="stack gap-16 mt-8">
            {FEATURES.map(({ icon: Icon, title, text }) => (
              <div className="auth-feature" key={title}>
                <span className="fi"><Icon size={19} /></span>
                <div>
                  <div style={{ fontWeight: 650 }}>{title}</div>
                  <div style={{ color: 'rgba(255,255,255,.78)', fontSize: '0.88rem' }}>{text}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p style={{ color: 'rgba(255,255,255,.6)', fontSize: '0.8rem' }}>
          Reports go directly to the traffic authority dashboard.
        </p>
      </aside>

      <main className="auth-main">
        <div className="auth-card stack gap-24">
          <div className="stack gap-14" style={{ alignItems: 'center', textAlign: 'center' }}>
            <span className="brand-mark" style={{ width: 62, height: 62, borderRadius: 18 }}>
              <Shield size={31} />
            </span>
            <div>
              <h1>Welcome to E-Vigilance</h1>
              <p className="muted mt-8">
                Report traffic violations with photo, video and voice evidence — and track every case you file.
              </p>
            </div>
          </div>

          <div className="stack gap-10">
            <Link to="/signup" className="btn btn-primary btn-lg btn-block">
              Create an account <ChevronRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-outline btn-lg btn-block">
              I already have an account
            </Link>
          </div>

          <p className="tiny subtle text-center">
            By continuing you agree to submit accurate information. False reports may be penalised.
          </p>
        </div>
      </main>
    </div>
  );
}
