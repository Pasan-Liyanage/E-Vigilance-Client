import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { useToast } from '../context/ToastContext';
import { useOnline } from '../hooks/useOnline';
import { VEHICLE_TYPES, ISSUE_TYPES, MAX_EVIDENCE_FILES, MAX_FILE_MB } from '../constants';
import { Field, Modal } from '../components/ui';
import CameraCapture from '../components/CameraCapture';
import VoiceRecorder from '../components/VoiceRecorder';
import {
  Camera, Video, Image as ImageIcon, Mic, Car, Calendar, Alert, MapPin, FileText,
  CheckCircle, ChevronLeft, ChevronRight, X, Check, Crosshair, Send, Info, Plus, Clock,
} from '../components/Icons';

const STEPS = [
  { key: 'evidence', label: 'Evidence', icon: Camera },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
  { key: 'when', label: 'Date & time', icon: Calendar },
  { key: 'issue', label: 'Issue', icon: Alert },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'review', label: 'Review', icon: CheckCircle },
];

const DRAFT_KEY = 'evigilance.draft';

/** Local datetime string ("YYYY-MM-DDTHH:mm") for <input type="datetime-local">. */
const toLocalInput = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

const emptyForm = () => ({
  vehicleType: '',
  vehicleNumber: '',
  vehicleModel: '',
  dateTime: toLocalInput(new Date()),
  issueType: '',
  customIssue: '',
  location: '',
  latitude: null,
  longitude: null,
  additionalDetails: '',
});

export default function ReportWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (saved) return { ...emptyForm(), ...saved };
    } catch { /* ignore bad draft */ }
    return emptyForm();
  });
  const [media, setMedia] = useState([]);      // { id, file, url, kind }
  const [voiceNote, setVoiceNote] = useState(null);
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [done, setDone] = useState(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  const set = useCallback((patch) => {
    setForm((f) => ({ ...f, ...patch }));
    setErrors((e) => {
      const next = { ...e };
      Object.keys(patch).forEach((k) => delete next[k]);
      return next;
    });
  }, []);

  // Persist the text part of the draft (files cannot be serialised).
  useEffect(() => {
    if (done) return;
    try { localStorage.setItem(DRAFT_KEY, JSON.stringify(form)); } catch { /* private mode */ }
  }, [form, done]);

  // Mirror media in a ref so the unmount cleanup sees the latest list.
  const mediaRef = useRef(media);
  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  /**
   * Adds picked/captured files. Object URLs and toasts are created here rather
   * than inside the state updater, which React may run twice in StrictMode.
   */
  const addFiles = useCallback((files) => {
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const room = MAX_EVIDENCE_FILES - mediaRef.current.length;
    if (room <= 0) {
      toast.error(`You can attach at most ${MAX_EVIDENCE_FILES} photos or videos.`);
      return;
    }

    const accepted = [];
    for (const file of incoming.slice(0, room)) {
      if (file.size > MAX_FILE_MB * 1024 * 1024) {
        toast.error(`"${file.name}" is larger than ${MAX_FILE_MB} MB and was skipped.`);
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        kind: file.type.startsWith('video/') ? 'video' : 'image',
        url: URL.createObjectURL(file),
      });
    }
    if (incoming.length > room) {
      toast.info(`Only ${room} more file${room === 1 ? '' : 's'} could be added.`);
    }
    if (accepted.length) {
      mediaRef.current = [...mediaRef.current, ...accepted];
      setMedia(mediaRef.current);
    }
  }, [toast]);

  const removeMedia = (id) => {
    const target = mediaRef.current.find((m) => m.id === id);
    if (target) URL.revokeObjectURL(target.url);
    mediaRef.current = mediaRef.current.filter((m) => m.id !== id);
    setMedia(mediaRef.current);
  };

  const resolvedIssue = form.issueType === 'Other' ? form.customIssue.trim() : form.issueType;

  /** Per-step validation. Returns true when the step may be left. */
  const validateStep = useCallback((index) => {
    const e = {};
    if (index === 1) {
      if (!form.vehicleType) e.vehicleType = 'Choose the vehicle type.';
      if (!form.vehicleNumber.trim()) e.vehicleNumber = 'Enter the number plate.';
      else if (form.vehicleNumber.trim().length < 3) e.vehicleNumber = 'That plate looks too short.';
    }
    if (index === 2) {
      const [d = '', t = ''] = String(form.dateTime || '').split('T');
      const when = new Date(`${d}T${t}`);
      if (!d && !t) e.dateTime = 'Pick the date and time this happened.';
      else if (!d) e.dateTime = 'Pick the date this happened.';
      else if (!t) e.dateTime = 'Pick the time this happened.';
      else if (Number.isNaN(when.getTime())) e.dateTime = 'That date and time is not valid.';
      else if (when.getTime() > Date.now() + 60000) {
        e.dateTime = 'The date and time cannot be in the future.';
      }
    }
    if (index === 3) {
      if (!form.issueType) e.issueType = 'Select what the driver did.';
      else if (form.issueType === 'Other' && !form.customIssue.trim()) {
        e.customIssue = 'Describe the violation.';
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form]);

  const next = () => {
    if (!validateStep(step)) return;
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  const back = () => {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  // Only backward jumps are offered; forward steps stay disabled until validated.
  const goTo = (index) => {
    if (index > step) return;
    setErrors({});
    setStep(index);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const submit = async () => {
    // Re-check every gated step before sending.
    for (const i of [1, 2, 3]) {
      if (!validateStep(i)) { setStep(i); return; }
    }
    if (!online) { toast.error('You are offline. Reconnect to submit this report.'); return; }

    setSubmitting(true);
    setProgress(0);

    const fd = new FormData();
    media.forEach((m) => fd.append('evidence', m.file, m.file.name));
    if (voiceNote) fd.append('voiceNote', voiceNote, voiceNote.name);
    fd.append('vehicleType', form.vehicleType);
    fd.append('vehicleNumber', form.vehicleNumber.trim());
    if (form.vehicleModel.trim()) fd.append('vehicleModel', form.vehicleModel.trim());
    fd.append('dateTime', new Date(form.dateTime).toISOString());
    fd.append('issueType', resolvedIssue);
    if (form.location.trim()) fd.append('location', form.location.trim());
    if (form.latitude != null) fd.append('latitude', String(form.latitude));
    if (form.longitude != null) fd.append('longitude', String(form.longitude));
    if (form.additionalDetails.trim()) fd.append('additionalDetails', form.additionalDetails.trim());

    try {
      const res = await api.createReport(fd, setProgress);
      try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
      media.forEach((m) => URL.revokeObjectURL(m.url));
      setDone(res.report);
      toast.success('Your report has been submitted.');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <SuccessView report={done} navigate={navigate} />;

  const Current = [StepEvidence, StepVehicle, StepWhen, StepIssue, StepLocation, StepDetails, StepReview][step];
  const isLast = step === STEPS.length - 1;
  const hasContent = media.length > 0 || voiceNote || form.vehicleNumber || form.issueType;

  return (
    <>
      <div className="wizard-head">
        <div className="container stack gap-12">
          <div className="between gap-10">
            <div className="row gap-10">
              <button
                className="btn btn-ghost btn-icon"
                onClick={() => (hasContent ? setConfirmLeave(true) : navigate('/dashboard'))}
                aria-label="Cancel report"
              >
                <X size={20} />
              </button>
              <div>
                <div className="strong">Report a violation</div>
                <div className="tiny subtle">Step {step + 1} of {STEPS.length} — {STEPS[step].label}</div>
              </div>
            </div>
            <span className="badge badge-brand hide-mobile">
              {Math.round(((step + 1) / STEPS.length) * 100)}%
            </span>
          </div>

          <div className="progress-track">
            <div className="progress-bar" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} />
          </div>

          <div className="steps-rail">
            {STEPS.map((s, i) => (
              <button
                key={s.key}
                className={`step-dot ${i === step ? 'current' : i < step ? 'done' : ''}`}
                onClick={() => goTo(i)}
                disabled={i > step}
              >
                <span className="n">{i < step ? <Check size={12} /> : i + 1}</span>
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="container">
        <div key={step} className="animate-in mt-20">
          <Current
            form={form} set={set} errors={errors}
            media={media} addFiles={addFiles} removeMedia={removeMedia}
            voiceNote={voiceNote} setVoiceNote={setVoiceNote}
            resolvedIssue={resolvedIssue} goTo={goTo} toast={toast}
          />
        </div>

        <div className="wizard-foot">
          {step > 0 && (
            <button className="btn btn-outline" onClick={back} disabled={submitting}>
              <ChevronLeft size={18} /> Back
            </button>
          )}
          {isLast ? (
            <button className="btn btn-primary grow" onClick={submit} disabled={submitting || !online}>
              {submitting
                ? <><span className="spinner" /> {progress > 0 && progress < 100 ? `Uploading ${progress}%` : 'Submitting…'}</>
                : <><Send size={18} /> Submit report</>}
            </button>
          ) : (
            <button className="btn btn-primary grow" onClick={next}>
              Continue <ChevronRight size={18} />
            </button>
          )}
        </div>

        {submitting && progress > 0 && (
          <div className="progress-track" style={{ marginTop: -8 }}>
            <div className="progress-bar" style={{ width: `${progress}%` }} />
          </div>
        )}
      </div>

      <Modal
        open={confirmLeave}
        onClose={() => setConfirmLeave(false)}
        title="Discard this report?"
        footer={
          <>
            <button className="btn btn-outline grow" onClick={() => setConfirmLeave(false)}>Keep editing</button>
            <button
              className="btn btn-danger grow"
              onClick={() => {
                try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
                media.forEach((m) => URL.revokeObjectURL(m.url));
                navigate('/dashboard');
              }}
            >
              Discard
            </button>
          </>
        }
      >
        <p className="muted">
          Your evidence and everything you have entered so far will be lost.
        </p>
      </Modal>
    </>
  );
}

/* ============================ Step 1 - Evidence =========================== */
function StepEvidence({ media, addFiles, removeMedia }) {
  const photoInput = useRef(null);
  const videoInput = useRef(null);
  const [camera, setCamera] = useState(null); // 'photo' | 'video' | null

  return (
    <div className="stack gap-20">
      <div>
        <h2>Add your evidence</h2>
        <p className="muted mt-4">
          Photos and video make a report far more likely to be acted on. You can add up to {MAX_EVIDENCE_FILES} files.
        </p>
      </div>

      <div className="capture-grid">
        <button className="capture-btn" onClick={() => setCamera('photo')}>
          <Camera size={24} /> Take photo
        </button>
        <button className="capture-btn" onClick={() => setCamera('video')}>
          <Video size={24} /> Record video
        </button>
        <button className="capture-btn" onClick={() => photoInput.current?.click()}>
          <ImageIcon size={24} /> Upload photo
        </button>
        <button className="capture-btn" onClick={() => videoInput.current?.click()}>
          <Plus size={24} /> Upload video
        </button>
      </div>

      <input
        ref={photoInput} type="file" accept="image/*" multiple hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />
      <input
        ref={videoInput} type="file" accept="video/*" multiple hidden
        onChange={(e) => { addFiles(e.target.files); e.target.value = ''; }}
      />

      {media.length > 0 && (
        <div className="stack gap-10">
          <div className="between">
            <span className="section-title">Attached ({media.length}/{MAX_EVIDENCE_FILES})</span>
          </div>
          <div className="media-grid">
            {media.map((m) => (
              <div className="media-tile" key={m.id}>
                {m.kind === 'video'
                  ? <video src={m.url} muted playsInline preload="metadata" />
                  : <img src={m.url} alt="Attached evidence" />}
                <span className="tag">
                  {m.kind === 'video' ? <><Video size={9} /> Video</> : <><ImageIcon size={9} /> Photo</>}
                </span>
                <button className="remove" onClick={() => removeMedia(m.id)} aria-label="Remove this file">
                  <X size={14} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card card-pad row gap-12" style={{ alignItems: 'flex-start' }}>
        <Info size={19} className="subtle" style={{ flex: 'none', marginTop: 2 }} />
        <div className="small muted">
          <strong style={{ color: 'var(--text)' }}>Stay safe.</strong> Never record while driving.
          Evidence is optional — you can still submit a report without it.
        </div>
      </div>

      <CameraCapture
        open={camera !== null}
        mode={camera || 'photo'}
        onCapture={(file) => addFiles([file])}
        onClose={() => setCamera(null)}
      />
    </div>
  );
}

/* ============================ Step 2 - Vehicle ============================ */
function StepVehicle({ form, set, errors }) {
  return (
    <div className="stack gap-20">
      <div>
        <h2>Vehicle details</h2>
        <p className="muted mt-4">The number plate is the most important thing to get right.</p>
      </div>

      <div className="stack gap-16">
        <Field label="Vehicle type" required error={errors.vehicleType} htmlFor="vtype">
          <select
            id="vtype"
            className={`select ${errors.vehicleType ? 'invalid' : ''}`}
            value={form.vehicleType}
            onChange={(e) => set({ vehicleType: e.target.value })}
          >
            <option value="">Select a vehicle type…</option>
            {VEHICLE_TYPES.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </Field>

        <Field
          label="Number plate" required error={errors.vehicleNumber}
          hint="For example CBB-9021 or WP CAR-1234" htmlFor="vnum"
        >
          <input
            id="vnum"
            className={`input mono ${errors.vehicleNumber ? 'invalid' : ''}`}
            style={{ textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 600 }}
            placeholder="CBB-9021"
            value={form.vehicleNumber}
            onChange={(e) => set({ vehicleNumber: e.target.value.toUpperCase() })}
            autoCapitalize="characters"
          />
        </Field>

        <Field label="Make and model" hint="Optional — for example Toyota Aqua, white" htmlFor="vmodel">
          <input
            id="vmodel" className="input" placeholder="Toyota Aqua"
            value={form.vehicleModel}
            onChange={(e) => set({ vehicleModel: e.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

/* =========================== Step 3 - Date & time ========================= */
function StepWhen({ form, set, errors }) {
  // `dateTime` stays the single source of truth ("YYYY-MM-DDTHH:mm").
  // Either half may be blank while the user is still filling the form in.
  const [datePart = '', timePart = ''] = String(form.dateTime || '').split('T');
  const todayStr = toLocalInput(new Date()).slice(0, 10);

  const setPart = (which, value) => {
    const d = which === 'date' ? value : datePart;
    const t = which === 'time' ? value : timePart;
    set({ dateTime: !d && !t ? '' : `${d}T${t}` });
  };

  const selected = datePart && timePart ? new Date(`${datePart}T${timePart}`) : null;
  const selectedValid = selected && !Number.isNaN(selected.getTime());

  const quick = [
    { label: 'Just now', minutes: 0 },
    { label: '15 min ago', minutes: 15 },
    { label: '1 hour ago', minutes: 60 },
    { label: 'This morning', at: () => { const d = new Date(); d.setHours(8, 0, 0, 0); return d; } },
  ];

  return (
    <div className="stack gap-20">
      <div>
        <h2>When did it happen?</h2>
        <p className="muted mt-4">Use the exact time if you know it — it helps match CCTV footage.</p>
      </div>

      <div className="stack gap-8">
        <div className="field-pair">
          <Field label="Date" required htmlFor="dt-date">
            <div className="input-group">
              <span className="lead"><Calendar size={18} /></span>
              <input
                id="dt-date" type="date"
                className={`input ${errors.dateTime ? 'invalid' : ''}`}
                value={datePart}
                max={todayStr}
                onChange={(e) => setPart('date', e.target.value)}
              />
            </div>
          </Field>

          <Field label="Time" required htmlFor="dt-time">
            <div className="input-group">
              <span className="lead"><Clock size={18} /></span>
              <input
                id="dt-time" type="time"
                className={`input ${errors.dateTime ? 'invalid' : ''}`}
                value={timePart}
                onChange={(e) => setPart('time', e.target.value)}
              />
            </div>
          </Field>
        </div>

        {errors.dateTime && <span className="error-text">{errors.dateTime}</span>}
      </div>

      <div className="stack gap-10">
        <span className="section-title">Quick pick</span>
        <div className="row gap-8 wrap">
          {quick.map((q) => (
            <button
              key={q.label}
              className="chip"
              onClick={() => {
                const d = q.at ? q.at() : new Date(Date.now() - q.minutes * 60000);
                set({ dateTime: toLocalInput(d) });
              }}
            >
              <Clock size={14} /> {q.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card card-pad row gap-12" style={{ alignItems: 'flex-start' }}>
        <Info size={19} className="subtle" style={{ flex: 'none', marginTop: 2 }} />
        <div className="small muted">
          Selected: <strong style={{ color: 'var(--text)' }}>
            {selectedValid
              ? selected.toLocaleString(undefined, {
                  weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })
              : 'Pick a date and a time'}
          </strong>
        </div>
      </div>
    </div>
  );
}

/* ============================= Step 4 - Issue ============================= */
function StepIssue({ form, set, errors }) {
  return (
    <div className="stack gap-20">
      <div>
        <h2>What happened?</h2>
        <p className="muted mt-4">Pick the option that best describes the violation.</p>
      </div>

      {errors.issueType && <span className="error-text">{errors.issueType}</span>}

      <div className="option-list">
        {ISSUE_TYPES.map((issue) => (
          <button
            key={issue}
            className={`option ${form.issueType === issue ? 'selected' : ''}`}
            onClick={() => set({ issueType: issue })}
          >
            <span className="check"><Check size={13} /></span>
            <span className="grow">{issue}</span>
          </button>
        ))}
      </div>

      {form.issueType === 'Other' && (
        <Field label="Describe the violation" required error={errors.customIssue} htmlFor="custom">
          <input
            id="custom"
            className={`input ${errors.customIssue ? 'invalid' : ''}`}
            placeholder="e.g. Blocking a pedestrian crossing"
            value={form.customIssue}
            onChange={(e) => set({ customIssue: e.target.value })}
            autoFocus
          />
        </Field>
      )}
    </div>
  );
}

/* ============================ Step 5 - Location =========================== */
function StepLocation({ form, set, toast }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');

  const useMyLocation = () => {
    setGeoError('');

    if (!navigator.geolocation) {
      setGeoError('This browser does not support location. Please type the address instead.');
      return;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setGeoError('Location needs a secure (HTTPS) page. Please type the address instead.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        set({ latitude, longitude });

        // Best-effort reverse geocode; the typed address always wins if it fails.
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${latitude}&lon=${longitude}&zoom=17`,
            { headers: { Accept: 'application/json' } }
          );
          const data = await res.json();
          if (data?.display_name) set({ location: data.display_name });
          else set({ location: `${latitude}, ${longitude}` });
        } catch {
          set({ location: `${latitude}, ${longitude}` });
        }

        toast.success('Location captured.');
        setLocating(false);
      },
      (err) => {
        const map = {
          1: 'Location permission was blocked. Allow it in your browser settings, or type the address below.',
          2: 'Your location is unavailable right now. Please type the address below.',
          3: 'Finding your location took too long. Please try again or type the address.',
        };
        setGeoError(map[err.code] || err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const hasCoords = form.latitude != null && form.longitude != null;
  const bbox = hasCoords
    ? [form.longitude - 0.004, form.latitude - 0.003, form.longitude + 0.004, form.latitude + 0.003].join(',')
    : null;

  return (
    <div className="stack gap-20">
      <div>
        <h2>Where did it happen?</h2>
        <p className="muted mt-4">Capture your GPS position, or type the road and area.</p>
      </div>

      <button className="btn btn-primary btn-lg btn-block" onClick={useMyLocation} disabled={locating}>
        {locating ? <><span className="spinner" /> Finding your location…</> : <><Crosshair size={19} /> Use my current location</>}
      </button>

      {geoError && (
        <div className="row gap-8" style={{ alignItems: 'flex-start', color: 'var(--red)' }}>
          <Alert size={17} style={{ flex: 'none', marginTop: 2 }} />
          <span className="small">{geoError}</span>
        </div>
      )}

      {hasCoords && (
        <div className="stack gap-10">
          <div className="map-frame">
            <iframe
              title="Location preview"
              src={`https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${form.latitude},${form.longitude}`}
              loading="lazy"
            />
          </div>
          <div className="between small">
            <span className="mono subtle">{form.latitude}, {form.longitude}</span>
            <button className="btn btn-ghost btn-sm" onClick={() => set({ latitude: null, longitude: null })}>
              <X size={14} /> Clear pin
            </button>
          </div>
        </div>
      )}

      <Field
        label="Address or landmark"
        hint="For example: Galle Road, near Liberty Plaza, Colombo 03"
        htmlFor="loc"
      >
        <textarea
          id="loc" className="textarea" style={{ minHeight: 84 }}
          placeholder="Road name, landmark, town…"
          value={form.location}
          onChange={(e) => set({ location: e.target.value })}
        />
      </Field>
    </div>
  );
}

/* ============================ Step 6 - Details ============================ */
function StepDetails({ form, set, voiceNote, setVoiceNote }) {
  return (
    <div className="stack gap-20">
      <div>
        <h2>Anything else?</h2>
        <p className="muted mt-4">Add context in writing, by voice, or both. Both are optional.</p>
      </div>

      <Field
        label="Additional details"
        hint={`${form.additionalDetails.length}/1000 characters`}
        htmlFor="notes"
      >
        <textarea
          id="notes" className="textarea" maxLength={1000}
          placeholder="Describe what you saw — how it happened, weather and traffic conditions, whether anyone was put at risk…"
          value={form.additionalDetails}
          onChange={(e) => set({ additionalDetails: e.target.value })}
        />
      </Field>

      <div className="stack gap-10">
        <span className="section-title">Voice note</span>
        <VoiceRecorder value={voiceNote} onChange={setVoiceNote} />
      </div>
    </div>
  );
}

/* ============================= Step 7 - Review ============================ */
function StepReview({ form, media, voiceNote, resolvedIssue, goTo }) {
  const rows = [
    { label: 'Evidence', step: 0, value: media.length ? `${media.length} file${media.length === 1 ? '' : 's'} attached` : 'None attached' },
    { label: 'Vehicle', step: 1, value: `${form.vehicleNumber} — ${form.vehicleType}${form.vehicleModel ? ` (${form.vehicleModel})` : ''}` },
    { label: 'Date & time', step: 2, value: Number.isNaN(new Date(form.dateTime).getTime()) ? '—' : new Date(form.dateTime).toLocaleString(undefined, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) },
    { label: 'Violation', step: 3, value: resolvedIssue || '—' },
    { label: 'Location', step: 4, value: form.location || (form.latitude != null ? `${form.latitude}, ${form.longitude}` : 'Not provided') },
    { label: 'Details', step: 5, value: form.additionalDetails || (voiceNote ? 'Voice note attached' : 'None') },
  ];

  return (
    <div className="stack gap-20">
      <div>
        <h2>Check before you send</h2>
        <p className="muted mt-4">Make sure everything is correct. You cannot edit a report after submitting.</p>
      </div>

      {media.length > 0 && (
        <div className="media-grid">
          {media.map((m) => (
            <div className="media-tile" key={m.id}>
              {m.kind === 'video'
                ? <video src={m.url} muted playsInline preload="metadata" />
                : <img src={m.url} alt="Attached evidence" />}
              <span className="tag">{m.kind === 'video' ? 'Video' : 'Photo'}</span>
            </div>
          ))}
        </div>
      )}

      <div className="card card-pad">
        {rows.map((r) => (
          <div className="review-block between gap-12" key={r.label}>
            <div className="grow" style={{ minWidth: 0 }}>
              <div className="ir-label">{r.label}</div>
              <div className="ir-value">{r.value}</div>
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => goTo(r.step)}>Edit</button>
          </div>
        ))}
      </div>

      {voiceNote && (
        <div className="card card-pad row gap-12">
          <span className="mic-btn" style={{ width: 42, height: 42, background: 'var(--green-bg)', color: 'var(--green)', boxShadow: 'none' }}>
            <Mic size={18} />
          </span>
          <span className="grow small strong">Voice note ready to send</span>
        </div>
      )}

      <div className="card card-pad row gap-12" style={{ alignItems: 'flex-start', borderColor: 'var(--brand-200)' }}>
        <Info size={19} style={{ flex: 'none', marginTop: 2, color: 'var(--brand-600)' }} />
        <div className="small muted">
          By submitting you confirm this report is accurate and based on what you witnessed.
          It goes straight to the traffic authority for review.
        </div>
      </div>
    </div>
  );
}

/* ============================== Success view ============================== */
function SuccessView({ report, navigate }) {
  return (
    <div className="container" style={{ minHeight: '75dvh', display: 'grid', placeItems: 'center' }}>
      <div className="stack gap-20 text-center animate-in" style={{ alignItems: 'center', maxWidth: 440 }}>
        <div className="success-badge"><CheckCircle size={44} /></div>
        <div>
          <h1>Report submitted</h1>
          <p className="muted mt-8">
            Thank you. Your report for <strong style={{ color: 'var(--text)' }}>{report.vehicleNumber}</strong> has
            been sent to the traffic authority and is now in progress.
          </p>
        </div>

        <div className="card card-pad stack gap-8" style={{ width: '100%', textAlign: 'left' }}>
          <div className="between">
            <span className="small muted">Reference</span>
            <span className="mono small strong">{String(report._id).slice(-8).toUpperCase()}</span>
          </div>
          <div className="between">
            <span className="small muted">Violation</span>
            <span className="small strong" style={{ textAlign: 'right' }}>{report.issueType}</span>
          </div>
          <div className="between">
            <span className="small muted">Status</span>
            <span className="badge badge-progress"><span className="dot" />In Progress</span>
          </div>
        </div>

        <div className="stack gap-10" style={{ width: '100%' }}>
          <button className="btn btn-primary btn-lg btn-block" onClick={() => navigate(`/reports/${report._id}`)}>
            View this report
          </button>
          <button className="btn btn-outline btn-block" onClick={() => navigate('/dashboard')}>
            Back to dashboard
          </button>
        </div>
      </div>
    </div>
  );
}
