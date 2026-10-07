import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { INFO_COPY, LANGUAGES, DEFAULT_LANG } from '../i18n/info';
import {
  Shield, CheckCircle, Check, Eye, Camera, Car, MapPin, Send, Phone, Video, Lock, FileText,
  Alert, ChevronLeft, ChevronRight, Mic, Clock, Plus,
} from '../components/Icons';
import { LogoPlate } from '../components/Logo';

const LANG_KEY = 'evigilance.lang';

// Inter has no Sinhala or Tamil glyphs. Noto gives both scripts a consistent
// look across phones; the CSS falls back to system fonts while it loads or
// if it cannot be fetched (offline).
const SCRIPT_FONTS = {
  si: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Sinhala:wght@400;600;700;800&display=swap',
  ta: 'https://fonts.googleapis.com/css2?family=Noto+Sans+Tamil:wght@400;600;700;800&display=swap',
};

function loadScriptFont(lang) {
  const href = SCRIPT_FONTS[lang];
  if (!href || document.querySelector(`link[href="${href}"]`)) return;
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

function readLang() {
  try {
    const saved = localStorage.getItem(LANG_KEY);
    if (INFO_COPY[saved]) return saved;
  } catch { /* private mode */ }
  return DEFAULT_LANG;
}

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** An index that advances on its own every `ms` until paused. Never moves under reduced motion. */
function useAutoCycle(count, ms, paused) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    if (paused || prefersReducedMotion()) return undefined;
    const id = setInterval(() => setIndex((i) => (i + 1) % count), ms);
    return () => clearInterval(id);
  }, [count, ms, paused]);
  return [index, setIndex];
}

// Each card gets one of the brand's tones so the sections do not read as a wall of blue.
const GOALS = [{ icon: Shield, tone: 'blue' }, { icon: CheckCircle, tone: 'green' }, { icon: Eye, tone: 'orange' }];
const STEP_ICONS = [Camera, Car, MapPin, Send];
const STEP_MS = 5000;
const FEATURES = [
  { icon: Phone, tone: 'blue' }, { icon: Video, tone: 'orange' },
  { icon: Lock, tone: 'green' }, { icon: FileText, tone: 'sky' },
];

/** A small, fixed-colour road scene standing in for an evidence photo. */
function RoadScene() {
  return (
    <svg viewBox="0 0 240 132" preserveAspectRatio="xMidYMid slice" role="presentation">
      <defs>
        <linearGradient id="info-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#8cc4ee" />
          <stop offset="1" stopColor="#d9ecfa" />
        </linearGradient>
      </defs>
      <rect width="240" height="132" fill="url(#info-sky)" />
      <circle cx="196" cy="30" r="13" fill="#ffd27a" />
      <path d="M0 64 Q60 46 120 60 T240 56 V132 H0Z" fill="#7fbf8e" />
      <polygon points="104,58 136,58 236,132 4,132" fill="#4a5568" />
      <polygon points="118,64 122,64 123,74 117,74" fill="#f8fafc" />
      <polygon points="116,84 124,84 126,100 114,100" fill="#f8fafc" />
      <polygon points="112,112 128,112 131,132 109,132" fill="#f8fafc" />
      {/* the offending car */}
      <g className="info-car" transform="translate(138 86)">
        <rect x="0" y="10" width="54" height="20" rx="6" fill="#dd3b3b" />
        <path d="M9 10 L16 0 H38 L46 10Z" fill="#b92d2d" />
        <path d="M18 2 H36 L41 9 H13Z" fill="#cfe6f7" />
        <circle cx="13" cy="31" r="6" fill="#1f2937" />
        <circle cx="41" cy="31" r="6" fill="#1f2937" />
        <rect x="47" y="15" width="6" height="4" rx="1" fill="#ffe08a" />
      </g>
    </svg>
  );
}

/** The picture for each step of the "How it works" walkthrough. */
function StepScene({ step, t }) {
  if (step === 0) {
    return (
      <div className="info-scene-photo">
        <div className="info-phone-photo"><RoadScene /><span className="info-shutter" /></div>
        <div className="info-scene-chips">
          <span><Camera size={15} /> 3</span>
          <span><Video size={15} /> 1</span>
          <span><Mic size={15} /> 0:12</span>
        </div>
      </div>
    );
  }
  if (step === 1) {
    return (
      <div className="info-scene-form">
        <div className="info-plate info-plate-lg">CAB · 1234</div>
        <div className="info-phone-row"><Car size={16} /><span>{t.mock.vehicle}</span></div>
        <div className="info-phone-row"><Alert size={16} /><span>{t.violations[1]}</span></div>
        <div className="info-phone-row"><Clock size={16} /><span>05 / 10 · 08:42</span></div>
      </div>
    );
  }
  if (step === 2) {
    return (
      <div className="info-scene-map">
        <span className="info-map-pin"><MapPin size={22} /></span>
        <span className="info-map-label"><MapPin size={14} /> {t.mock.place}</span>
      </div>
    );
  }
  return (
    <ol className="info-scene-status">
      {t.statuses.map((label, i) => (
        <li key={i} className={i < 2 ? 'done' : ''}>
          <span className="info-status-dot">{i < 2 ? <Check size={14} /> : <Clock size={14} />}</span>
          <span>{label}</span>
        </li>
      ))}
    </ol>
  );
}

/** Public landing page: what E-Vigilance is for, in English, Sinhala and Tamil. */
export default function Info() {
  const { isAuthenticated } = useAuth();
  const [lang, setLang] = useState(readLang);
  const t = INFO_COPY[lang];
  const rootRef = useRef(null);

  // Hero phone: walks through the four steps on its own; hovering holds it still.
  const [heroPaused, setHeroPaused] = useState(false);
  const [heroStep] = useAutoCycle(4, 2600, heroPaused);

  // "How it works": advances on its own until the visitor picks a step.
  const [stepAuto, setStepAuto] = useState(true);
  const [step, setStep] = useAutoCycle(4, STEP_MS, !stepAuto);
  const tabRefs = useRef([]);
  const pickStep = (i) => { setStepAuto(false); setStep((i + 4) % 4); };

  const [violation, setViolation] = useState(null);
  const [pledged, setPledged] = useState(() => t.pledges.map(() => false));
  const pledgeCount = pledged.filter(Boolean).length;
  const pledgeDone = pledgeCount === pledged.length;

  // Signed-in visitors skip the sign-up screen and go straight to the app.
  const appPath = isAuthenticated ? '/dashboard' : '/welcome';

  useEffect(() => {
    try { localStorage.setItem(LANG_KEY, lang); } catch { /* private mode */ }
    loadScriptFont(lang);
    const previous = document.title;
    document.title = t.pageTitle;
    return () => { document.title = previous; };
  }, [lang, t.pageTitle]);

  // Sections fade up as they scroll into view. Content stays visible when
  // the observer is unavailable or motion is reduced.
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || !('IntersectionObserver' in window)) return undefined;
    root.classList.add('js-reveal');
    const io = new IntersectionObserver(
      (entries) => entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
      }),
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    root.querySelectorAll('.reveal').forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  // Arrow keys move between steps, and focus moves with the selection.
  const onStepKey = (e) => {
    const delta = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    if (!delta) return;
    e.preventDefault();
    const next = (step + delta + 4) % 4;
    pickStep(next);
    tabRefs.current[next]?.focus();
  };

  const tryApp = (
    <Link to={appPath} className="btn info-cta">
      {t.tryApp} <ChevronRight size={22} />
    </Link>
  );

  const on = (i) => (heroStep === i ? ' is-on' : '');

  return (
    <div className="info" lang={lang} ref={rootRef}>
      <header className="info-top">
        <div className="container between gap-12">
          <Link to="/" className="row gap-10 info-home" aria-label="E-Vigilance">
            <LogoPlate size={38} />
            <span className="info-brand">E-Vigilance</span>
          </Link>
          <div className="info-lang" role="group" aria-label={t.languageLabel}>
            {LANGUAGES.map(({ code, label }) => (
              <button
                key={code}
                type="button"
                lang={code}
                className={code === lang ? 'active' : ''}
                aria-pressed={code === lang}
                onClick={() => setLang(code)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <section className="info-hero">
        <div className="info-glow info-glow-a" />
        <div className="info-glow info-glow-b" />
        <div className="container info-hero-grid">
          <div className="stack gap-20 info-hero-copy">
            <span className="info-eyebrow"><span className="info-pulse" />{t.eyebrow}</span>
            <h1>
              <span>{t.title[0]}</span>{' '}
              <span className="info-title-accent">{t.title[1]}</span>
            </h1>
            <p className="info-law">
              <span className="info-law-icon"><FileText size={18} /></span>
              <span>{t.law}</span>
            </p>
            <p className="info-lead">{t.subtitle}</p>
            <div className="stack gap-12 info-cta-wrap">
              {tryApp}
              <span className="info-note">{t.ctaNote}</span>
            </div>
          </div>

          {/* A complaint in miniature, as it looks on a phone. It plays through the four steps. */}
          <div
            className="info-visual"
            aria-hidden="true"
            onMouseEnter={() => setHeroPaused(true)}
            onMouseLeave={() => setHeroPaused(false)}
          >
            <div className="info-phone">
              <div className="info-phone-notch" />
              <div className="info-phone-screen">
                <div className="info-phone-progress">
                  {[0, 1, 2, 3].map((i) => <i key={i} className={i <= heroStep ? 'is-done' : ''} />)}
                </div>
                <div className="between">
                  <span className="info-phone-app"><LogoPlate size={22} />E-Vigilance</span>
                  <span className={`info-phone-status${on(3)}`}>{t.mock.status}</span>
                </div>
                <div className={`info-phone-photo${on(0)}`}>
                  <RoadScene />
                  <span className="info-phone-count"><Camera size={13} /> 3</span>
                </div>
                <div className={`info-hl${on(1)}`}>
                  <div className="info-plate">CAB · 1234</div>
                  <div className="info-phone-row"><Alert size={15} /><span>{t.violations[1]}</span></div>
                </div>
                <div className={`info-phone-row info-hl${on(2)}`}><MapPin size={15} /><span>{t.mock.place}</span></div>
                <div className="info-phone-row">
                  <Mic size={15} />
                  <span className="info-wave">{Array.from({ length: 16 }, (_, i) => <i key={i} />)}</span>
                  <span className="info-phone-time">0:12</span>
                </div>
              </div>
            </div>
            <div className="info-float info-float-a"><CheckCircle size={17} /> {t.mock.submitted}</div>
            <div className="info-float info-float-b"><MapPin size={16} /> {t.mock.located}</div>
          </div>
        </div>
        <div className="info-road" aria-hidden="true" />
      </section>

      <div className="container">
        <div className="info-stats">
          {t.stats.map((s, i) => (
            <div className="info-stat" key={i}>
              <strong>{s.value}</strong>
              <span>{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <main>
        <section className="info-section">
          <div className="container info-split reveal">
            <div className="info-head">
              <span className="info-kicker" />
              <h2>{t.objectiveTitle}</h2>
              <p className="muted">{t.objectiveText}</p>
            </div>
            <div className="stack gap-14">
              {t.goals.map((g, i) => {
                const { icon: Icon, tone } = GOALS[i];
                return (
                  <div className="info-card info-goal" key={i}>
                    <span className={`info-icon tone-${tone}`}><Icon size={21} /></span>
                    <div className="stack gap-4">
                      <h3>{g.title}</h3>
                      <p className="muted small">{g.text}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="info-section info-section-alt">
          <div className="container stack gap-32">
            <div className="info-head info-head-center reveal">
              <span className="info-kicker" />
              <h2>{t.howTitle}</h2>
            </div>

            <div className="info-stepper reveal">
              <div className="info-step-list" role="tablist" aria-label={t.howTitle} onKeyDown={onStepKey}>
                {t.steps.map((s, i) => {
                  const Icon = STEP_ICONS[i];
                  const active = i === step;
                  return (
                    <button
                      key={i}
                      ref={(el) => { tabRefs.current[i] = el; }}
                      type="button"
                      role="tab"
                      id={`info-step-${i}`}
                      aria-selected={active}
                      aria-controls="info-step-panel"
                      tabIndex={active ? 0 : -1}
                      className={`info-step-btn${active ? ' active' : ''}`}
                      onClick={() => pickStep(i)}
                    >
                      <span className="info-step-dot"><Icon size={22} /><b>{i + 1}</b></span>
                      <span className="info-step-copy">
                        <strong>{s.title}</strong>
                        <span className="info-step-text">{s.text}</span>
                      </span>
                      {active && stepAuto && (
                        <span className="info-step-timer" key={step} style={{ animationDuration: `${STEP_MS}ms` }} />
                      )}
                    </button>
                  );
                })}
              </div>

              <div className="info-step-panel" role="tabpanel" id="info-step-panel" aria-labelledby={`info-step-${step}`}>
                <div className="info-scene" key={step}>
                  <StepScene step={step} t={t} />
                </div>
                <div className="info-step-caption">
                  <span className="info-step-count">{t.stepLabel} {step + 1} / 4</span>
                  <h3>{t.steps[step].title}</h3>
                  <p className="muted small">{t.steps[step].text}</p>
                </div>
                <div className="info-step-nav">
                  <button type="button" className="btn btn-icon btn-outline" aria-label="Previous" onClick={() => pickStep(step - 1)}>
                    <ChevronLeft size={18} />
                  </button>
                  <span className="info-step-pips" aria-hidden="true">
                    {[0, 1, 2, 3].map((i) => <i key={i} className={i === step ? 'active' : ''} />)}
                  </span>
                  <button type="button" className="btn btn-icon btn-outline" aria-label="Next" onClick={() => pickStep(step + 1)}>
                    <ChevronRight size={18} />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="container stack gap-24">
            <div className="info-head info-head-center reveal">
              <span className="info-kicker" />
              <h2>{t.reportTitle}</h2>
              <p className="muted small">{t.reportHint}</p>
            </div>
            <ul className="info-chips reveal">
              {t.violations.map((v, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={violation === i ? 'active' : ''}
                    aria-pressed={violation === i}
                    onClick={() => setViolation(violation === i ? null : i)}
                  >
                    <span className="info-chip-dot">{violation === i ? <Check size={13} /> : <Alert size={13} />}</span>
                    {v}
                  </button>
                </li>
              ))}
            </ul>
            <div className="info-chip-cta-slot" aria-live="polite">
              {violation !== null && (
                <div className="info-chip-cta" key={violation}>
                  <span className="info-icon tone-orange"><Camera size={20} /></span>
                  <div className="grow">
                    <div className="small muted">{t.sawIt}</div>
                    <strong>{t.violations[violation]}</strong>
                  </div>
                  <Link to={appPath} className="btn btn-primary">
                    {t.reportIt} <ChevronRight size={18} />
                  </Link>
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="info-section info-section-alt">
          <div className="container stack gap-32">
            <div className="info-head info-head-center reveal">
              <span className="info-kicker" />
              <h2>{t.featuresTitle}</h2>
            </div>
            <div className="info-grid reveal">
              {t.features.map((f, i) => {
                const { icon: Icon, tone } = FEATURES[i];
                return (
                  <div className="info-card stack gap-12" key={i}>
                    <span className={`info-icon tone-${tone}`}><Icon size={21} /></span>
                    <h3>{f.title}</h3>
                    <p className="muted small">{f.text}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="info-section">
          <div className="container info-pledge-grid reveal">
            <div className="info-card info-pledge">
              <div className="stack gap-6">
                <h2>{t.pledgeTitle}</h2>
                <p className="muted small">{t.pledgeIntro}</p>
              </div>
              <div className="info-pledge-bar" aria-hidden="true">
                <i style={{ width: `${(pledgeCount / pledged.length) * 100}%` }} />
              </div>
              <div className="stack gap-10">
                {t.pledges.map((p, i) => (
                  <label key={i} className={`info-pledge-item${pledged[i] ? ' checked' : ''}`}>
                    <input
                      type="checkbox"
                      checked={pledged[i]}
                      onChange={() => setPledged((arr) => arr.map((v, j) => (j === i ? !v : v)))}
                    />
                    <span className="info-pledge-box"><Check size={15} /></span>
                    <span>{p}</span>
                  </label>
                ))}
              </div>
              <div aria-live="polite">
                {pledgeDone && (
                  <div className="info-pledge-done">
                    <span className="info-pledge-badge"><Shield size={24} /></span>
                    <p>{t.pledgeDone}</p>
                    <Link to={appPath} className="btn btn-primary">{t.tryApp} <ChevronRight size={18} /></Link>
                  </div>
                )}
              </div>
            </div>

            <div className="info-card info-notice">
              <span className="info-icon tone-orange"><Alert size={21} /></span>
              <div className="stack gap-8">
                <h3>{t.responsibleTitle}</h3>
                <p className="muted small">{t.responsibleText}</p>
                <a className="info-emergency" href="tel:119">
                  <Phone size={16} /> {t.emergency}
                </a>
              </div>
            </div>
          </div>
        </section>

        <section className="info-section info-section-alt">
          <div className="container stack gap-24 info-faq-wrap">
            <div className="info-head info-head-center reveal">
              <span className="info-kicker" />
              <h2>{t.faqTitle}</h2>
            </div>
            <div className="stack gap-12 reveal">
              {t.faqs.map((f, i) => (
                <details className="info-faq" name="info-faq" key={i}>
                  <summary>
                    <span>{f.q}</span>
                    <span className="info-faq-icon"><Plus size={18} /></span>
                  </summary>
                  <p className="muted">{f.a}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="info-final">
          <div className="info-glow info-glow-a" />
          <div className="container stack gap-20" style={{ alignItems: 'center', textAlign: 'center', position: 'relative' }}>
            <span className="info-final-icon"><Shield size={26} /></span>
            <h2>{t.finalTitle}</h2>
            {tryApp}
          </div>
          <div className="info-road" aria-hidden="true" />
        </section>
      </main>

      <footer className="info-footer">
        <div className="container stack gap-10" style={{ alignItems: 'center' }}>
          <LogoPlate size={30} />
          <span className="small subtle text-center">{t.footer}</span>
        </div>
      </footer>
    </div>
  );
}
