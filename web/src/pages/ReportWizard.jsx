import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api/client';
import { DRAFT_KEY } from '../context/AuthContext';
import { DirectUploadUnavailable, isDirectUploadAvailable, uploadDirect } from '../api/directUpload';
import { compressImage } from '../utils/compressImage';
import {
  compressVideo, shouldCompressVideo, canCompressVideo, VideoCompressionCancelled,
} from '../utils/compressVideo';
import { ensureFileType } from '../utils/fileType';
import { useToast } from '../context/ToastContext';
import { useOnline } from '../hooks/useOnline';
import {
  VEHICLE_TYPES, ISSUE_TYPES, MAX_EVIDENCE_FILES, MAX_FILE_MB, MAX_PHOTO_MB, MAX_OFFENCES,
  MAX_REPORT_AGE_DAYS, DESCRIPTION_MIN, DESCRIPTION_MAX,
} from '../constants';
import { Field, Modal, StatusBadge } from '../components/ui';
import CameraCapture from '../components/CameraCapture';
import VoiceRecorder from '../components/VoiceRecorder';
import {
  Camera, Video, Image as ImageIcon, Mic, Car, Calendar, Alert, MapPin, FileText,
  CheckCircle, ChevronLeft, ChevronRight, X, Check, Crosshair, Send, Info, Plus, Clock, Search,
} from '../components/Icons';
import { extractCoordinates, geocodeAddress } from '../utils/coordinates';

const STEPS = [
  { key: 'evidence', label: 'Evidence', icon: Camera },
  { key: 'vehicle', label: 'Vehicle', icon: Car },
  { key: 'when', label: 'Date & time', icon: Calendar },
  { key: 'issue', label: 'Offence', icon: Alert },
  { key: 'location', label: 'Location', icon: MapPin },
  { key: 'details', label: 'Details', icon: FileText },
  { key: 'review', label: 'Review', icon: CheckCircle },
];

const DAY_MS = 24 * 3600 * 1000;

/** Local datetime string ("YYYY-MM-DDTHH:mm") for <input type="datetime-local">. */
const toLocalInput = (date) => {
  const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return d.toISOString().slice(0, 16);
};

/**
 * Identifies this report across retries: if the connection drops after the
 * server stored it, sending again returns the stored report instead of a copy.
 * randomUUID needs a secure page, so plain-HTTP testing on a LAN falls back.
 */
const newReportId = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;

const emptyForm = () => ({
  clientReportId: newReportId(),
  vehicleType: '',
  vehicleNumber: '',
  vehicleModel: '',
  dateTime: toLocalInput(new Date()),
  // Codes from the police's published offences (GET /api/offences).
  offenceIds: [],
  // Used only while the police have published no offences yet.
  issueType: '',
  customIssue: '',
  injuries: null,
  location: '',
  latitude: null,
  longitude: null,
  description: '',
});

/** A saved draft, including one written by the previous version of this screen. */
const readDraft = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
    if (!saved) return emptyForm();
    const { additionalDetails, ...rest } = saved;
    return {
      ...emptyForm(),
      ...rest,
      description: rest.description ?? additionalDetails ?? '',
      clientReportId: rest.clientReportId || newReportId(),
      offenceIds: Array.isArray(rest.offenceIds) ? rest.offenceIds : [],
    };
  } catch {
    return emptyForm();
  }
};

export default function ReportWizard() {
  const navigate = useNavigate();
  const toast = useToast();
  const online = useOnline();

  const [step, setStep] = useState(0);
  const [form, setForm] = useState(readDraft);
  // null while loading; [] when none are published, which falls back to ISSUE_TYPES.
  const [offences, setOffences] = useState(null);
  // A suspended citizen cannot send reports; the server refuses them too.
  const [suspended, setSuspended] = useState(false);
  const [media, setMedia] = useState([]);      // { id, file, url, kind, capturedInApp, capturedAt }
  const [voiceNote, setVoiceNote] = useState(null);
  const [errors, setErrors] = useState({});
  // false, true (working on photos), or { video: true, progress } while a video is optimised.
  const [preparing, setPreparing] = useState(false);
  const optimiseAbort = useRef(null);
  const cancelOptimise = useCallback(() => optimiseAbort.current?.abort(), []);
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

  // The offences to choose from, and whether this citizen may report at all.
  // Neither blocks the screen: if a check fails, the server still applies it.
  useEffect(() => {
    let alive = true;
    api.offences()
      .then(({ offences: list = [] }) => {
        if (!alive) return;
        setOffences(list);
        // A draft may name an offence the police have since withdrawn.
        const codes = new Set(list.map((o) => o.code));
        setForm((f) => {
          const kept = f.offenceIds.filter((c) => codes.has(c));
          return kept.length === f.offenceIds.length ? f : { ...f, offenceIds: kept };
        });
      })
      .catch(() => { if (alive) setOffences([]); });
    api.rewards()
      .then(({ rewards }) => { if (alive) setSuspended(Boolean(rewards?.suspended)); })
      .catch(() => { /* the server refuses a suspended account's report anyway */ });
    return () => { alive = false; };
  }, []);

  // Mirror media in a ref so the unmount cleanup sees the latest list.
  const mediaRef = useRef(media);
  useEffect(() => { mediaRef.current = media; }, [media]);
  useEffect(() => () => mediaRef.current.forEach((m) => URL.revokeObjectURL(m.url)), []);

  /**
   * Adds picked/captured files. Object URLs and toasts are created here rather
   * than inside the state updater, which React may run twice in StrictMode.
   * `capturedInApp` is true for the app's own camera, false for the gallery;
   * the police weigh evidence recorded in the app more (admin docs/11 D11-4).
   */
  const addFiles = useCallback(async (files, { capturedInApp = false } = {}) => {
    const capturedAt = capturedInApp ? new Date().toISOString() : null;
    const incoming = Array.from(files || []);
    if (!incoming.length) return;

    const room = MAX_EVIDENCE_FILES - mediaRef.current.length;
    if (room <= 0) {
      toast.error(`You can attach at most ${MAX_EVIDENCE_FILES} photos or videos.`);
      return;
    }

    setPreparing(true);
    const accepted = [];
    try {
      for (const picked of incoming.slice(0, room)) {
        // Some Android pickers return a File with an empty type; give it one
        // before anything else looks at it.
        const original = ensureFileType(picked, picked.type?.startsWith('video/') ? 'video' : 'image');
        // Large photos are downscaled and large videos re-encoded here, so
        // they upload quickly and fit under the per-file limit.
        let file;
        if (shouldCompressVideo(original)) {
          optimiseAbort.current = new AbortController();
          setPreparing({ video: true, progress: 0 });
          try {
            file = await compressVideo(original, {
              onProgress: (p) => setPreparing({ video: true, progress: p }),
              signal: optimiseAbort.current.signal,
              maxBytes: MAX_FILE_MB * 1024 * 1024,
            });
          } catch (err) {
            if (!(err instanceof VideoCompressionCancelled)) throw err;
            toast.info(`"${picked.name}" was not added.`);
            continue;
          } finally {
            optimiseAbort.current = null;
            setPreparing(true);
          }
        } else {
          file = await compressImage(original);
        }
        const isVideo = file.type.startsWith('video/');
        const limitMb = isVideo ? MAX_FILE_MB : MAX_PHOTO_MB;
        if (file.size > limitMb * 1024 * 1024) {
          toast.error(
            isVideo && canCompressVideo()
              ? `"${picked.name}" is still over ${limitMb} MB after optimising. Please trim it to a shorter clip.`
              : isVideo
              ? `"${picked.name}" is larger than ${limitMb} MB. Please trim it to a shorter clip.`
              : `"${picked.name}" is larger than ${limitMb} MB and was skipped.`
          );
          continue;
        }
        accepted.push({
          id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          file,
          kind: isVideo ? 'video' : 'image',
          url: URL.createObjectURL(file),
          capturedInApp,
          capturedAt,
        });
      }
    } finally {
      setPreparing(false);
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

  // With published offences the report names their codes; without, free text.
  const useSchedule = Boolean(offences?.length);
  const legacyIssue = form.issueType === 'Other' ? form.customIssue.trim() : form.issueType;
  const resolvedIssue = useSchedule
    ? form.offenceIds.map((c) => offences.find((o) => o.code === c)?.name).filter(Boolean).join('; ')
    : legacyIssue;

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
      } else if (Date.now() - when.getTime() > MAX_REPORT_AGE_DAYS * DAY_MS) {
        e.dateTime = `Reports must be about something that happened in the last ${MAX_REPORT_AGE_DAYS} days.`;
      }
    }
    if (index === 3) {
      if (useSchedule) {
        if (!form.offenceIds.length) e.offenceIds = 'Select what the driver did.';
      } else if (!form.issueType) {
        e.offenceIds = 'Select what the driver did.';
      } else if (form.issueType === 'Other' && !form.customIssue.trim()) {
        e.customIssue = 'Describe the violation.';
      }
      if (form.injuries === null) e.injuries = 'Tell us whether anyone was hurt.';
    }
    if (index === 4) {
      // The police are routed to the nearest station from these coordinates,
      // so a typed address alone is not enough.
      if (form.latitude == null || form.longitude == null) {
        e.location = 'Pin the location: tap "Use my current location", or type the address and tap "Find on map".';
      }
    }
    if (index === 5) {
      const text = form.description.trim();
      if (text.length < DESCRIPTION_MIN) {
        e.description = `Describe what happened in at least ${DESCRIPTION_MIN} characters.`;
      } else if (text.length > DESCRIPTION_MAX) {
        e.description = `Keep the description to ${DESCRIPTION_MAX} characters.`;
      }
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }, [form, useSchedule]);

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
    for (const i of [1, 2, 3, 4, 5]) {
      if (!validateStep(i)) { setStep(i); return; }
    }
    if (!online) { toast.error('You are offline. Reconnect to submit this report.'); return; }

    setSubmitting(true);
    setProgress(0);

    // Fields both submission paths share (admin docs/11 §4). The offence
    // codes go as a list in JSON and as JSON text in a multipart form.
    const fields = {
      clientReportId: form.clientReportId,
      vehicleType: form.vehicleType,
      vehicleNumber: form.vehicleNumber.trim(),
      vehicleModel: form.vehicleModel.trim() || undefined,
      occurredAt: new Date(form.dateTime).toISOString(),
      issueType: useSchedule ? undefined : legacyIssue,
      injuries: form.injuries === true,
      location: form.location.trim() || undefined,
      latitude: form.latitude != null ? String(form.latitude) : undefined,
      longitude: form.longitude != null ? String(form.longitude) : undefined,
      description: form.description.trim(),
    };
    const offenceIds = useSchedule ? form.offenceIds : undefined;
    const captureOf = (m) => ({ capturedInApp: m.capturedInApp, capturedAt: m.capturedAt });

    try {
      let res = null;

      if (isDirectUploadAvailable() && (media.length || voiceNote)) {
        // Media goes straight to R2, so serverless body caps never apply.
        // Progress is the combined byte count across every file.
        const totalBytes =
          media.reduce((n, m) => n + m.file.size, 0) + (voiceNote ? voiceNote.size : 0);
        const loaded = new Map();
        const bump = (key, bytes) => {
          loaded.set(key, bytes);
          const sum = [...loaded.values()].reduce((a, b) => a + b, 0);
          setProgress(totalBytes ? Math.min(99, Math.round((sum / totalBytes) * 100)) : 0);
        };

        let uploads = null;
        try {
          const evidence = [];
          for (const m of media) {
            const uploaded = await uploadDirect(m.file, m.kind, (b) => bump(m.id, b));
            evidence.push({ ...uploaded, ...captureOf(m) });
          }
          // Voice notes can only be recorded in the app.
          const voice = voiceNote
            ? { ...(await uploadDirect(voiceNote, 'audio', (b) => bump('voice', b))), capturedInApp: true }
            : null;
          uploads = { evidence, voiceNote: voice };
        } catch (err) {
          if (!(err instanceof DirectUploadUnavailable)) throw err;
          // Fall through to uploading via the API below.
          console.warn('[upload] direct upload unavailable, sending through the API:', err.message);
          setProgress(0);
        }

        if (uploads) {
          setProgress(100);
          res = await api.createReportJson({ ...fields, offenceIds, ...uploads });
        }
      }

      if (!res) {
        const fd = new FormData();
        media.forEach((m) => {
          const f = ensureFileType(m.file, m.kind);
          fd.append('evidence', f, f.name);
        });
        // One entry per evidence file, in the same order.
        if (media.length) fd.append('evidenceMeta', JSON.stringify(media.map(captureOf)));
        if (voiceNote) {
          const v = ensureFileType(voiceNote, 'audio');
          fd.append('voiceNote', v, v.name);
        }
        Object.entries(fields).forEach(([k, v]) => {
          if (v !== undefined) fd.append(k, String(v));
        });
        if (offenceIds) fd.append('offenceIds', JSON.stringify(offenceIds));
        res = await api.createReport(fd, setProgress);
      }

      try { localStorage.removeItem(DRAFT_KEY); } catch { /* private mode */ }
      media.forEach((m) => URL.revokeObjectURL(m.url));
      setDone(res.report);
      // A retry after a dropped connection: the first attempt had arrived.
      toast.success(res.duplicate ? 'This report had already reached the police.' : 'Your report has been submitted.');
    } catch (err) {
      if (err.status === 403 && /suspended/i.test(err.message)) setSuspended(true);
      toast.error(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (done) return <SuccessView report={done} navigate={navigate} />;
  if (suspended) return <SuspendedView />;

  const Current = [StepEvidence, StepVehicle, StepWhen, StepIssue, StepLocation, StepDetails, StepReview][step];
  const isLast = step === STEPS.length - 1;
  const hasContent =
    media.length > 0 || voiceNote || form.vehicleNumber || form.offenceIds.length || form.issueType || form.description;

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
            media={media} addFiles={addFiles} removeMedia={removeMedia} preparing={preparing}
            onCancelOptimise={cancelOptimise}
            voiceNote={voiceNote} setVoiceNote={setVoiceNote}
            offences={offences} useSchedule={useSchedule}
            resolvedIssue={resolvedIssue} goTo={goTo} toast={toast}
          />
        </div>

        <div className="wizard-foot">
          {step > 0 && (
            <button className="btn btn-outline" onClick={back} disabled={submitting}>
              <ChevronLeft size={18} /> Back
            </button>
          )}
          {/* Files still being optimised are not in the report yet, so wait for them. */}
          {isLast ? (
            <button className="btn btn-primary grow" onClick={submit} disabled={submitting || !online || Boolean(preparing)}>
              {submitting
                ? <><span className="spinner" /> {progress > 0 && progress < 100 ? `Uploading ${progress}%` : 'Submitting…'}</>
                : <><Send size={18} /> Submit report</>}
            </button>
          ) : (
            <button className="btn btn-primary grow" onClick={next}
              disabled={Boolean(preparing) || (step === 3 && offences === null)}>
              {preparing ? <><span className="spinner" /> Preparing…</> : <>Continue <ChevronRight size={18} /></>}
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
function StepEvidence({ media, addFiles, removeMedia, preparing, onCancelOptimise }) {
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
        onChange={(e) => { addFiles(e.target.files, { capturedInApp: false }); e.target.value = ''; }}
      />
      <input
        ref={videoInput} type="file" accept="video/*" multiple hidden
        onChange={(e) => { addFiles(e.target.files, { capturedInApp: false }); e.target.value = ''; }}
      />

      {preparing?.video ? (
        <div className="stack gap-8" role="status">
          <div className="between small muted">
            <span className="row gap-10">
              <span className="spinner" style={{ color: 'var(--brand-600)' }} /> Optimising video for upload…
            </span>
            <strong>{Math.round(preparing.progress * 100)}%</strong>
          </div>
          <div className="optimise-bar"><i style={{ width: `${Math.round(preparing.progress * 100)}%` }} /></div>
          <div className="between gap-12">
            <span className="tiny subtle">Large videos are made smaller so they upload faster. Please keep this screen open.</span>
            <button type="button" className="btn btn-sm btn-ghost" onClick={onCancelOptimise}>Cancel</button>
          </div>
        </div>
      ) : preparing && (
        <div className="row gap-10 small muted">
          <span className="spinner" style={{ color: 'var(--brand-600)' }} /> Preparing your files…
        </div>
      )}

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
                <span className="tag" title={m.capturedInApp ? 'Taken with the app' : 'From your gallery'}>
                  {m.kind === 'video' ? <><Video size={9} /> Video</> : <><ImageIcon size={9} /> Photo</>}
                  {m.capturedInApp ? ' · App' : ''}
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
          Photos and videos taken here with the app carry more weight, because the police can see
          when they were recorded. Photos can be up to {MAX_PHOTO_MB} MB and videos up to {MAX_FILE_MB} MB.
          Evidence is optional — you can still submit a report without it.
        </div>
      </div>

      <CameraCapture
        open={camera !== null}
        mode={camera || 'photo'}
        onCapture={(file) => addFiles([file], { capturedInApp: true })}
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
  const earliestStr = toLocalInput(new Date(Date.now() - MAX_REPORT_AGE_DAYS * DAY_MS)).slice(0, 10);

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
        <p className="muted mt-4">
          Use the exact time if you know it — it helps match CCTV footage. Reports must be
          about something from the last {MAX_REPORT_AGE_DAYS} days.
        </p>
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
                min={earliestStr}
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
function StepIssue({ form, set, errors, offences, useSchedule, toast }) {
  const [query, setQuery] = useState('');

  const toggle = (code) => {
    const picked = form.offenceIds.includes(code);
    if (!picked && form.offenceIds.length >= MAX_OFFENCES) {
      toast.info(`You can choose up to ${MAX_OFFENCES} offences.`);
      return;
    }
    set({ offenceIds: picked ? form.offenceIds.filter((c) => c !== code) : [...form.offenceIds, code] });
  };

  const q = query.trim().toLowerCase();
  const shown = useSchedule && q
    ? offences.filter((o) => `${o.name} ${o.description || ''}`.toLowerCase().includes(q))
    : offences || [];

  return (
    <div className="stack gap-20">
      <div>
        <h2>What happened?</h2>
        <p className="muted mt-4">
          {useSchedule
            ? `Choose every offence you saw, up to ${MAX_OFFENCES}.`
            : 'Pick the option that best describes the violation.'}
        </p>
      </div>

      {errors.offenceIds && <span className="error-text">{errors.offenceIds}</span>}

      {offences === null ? (
        <div className="row gap-10 small muted">
          <span className="spinner" style={{ color: 'var(--brand-600)' }} /> Loading the list of offences…
        </div>
      ) : useSchedule ? (
        <>
          {offences.length > 8 && (
            <div className="input-group">
              <span className="lead"><Search size={18} /></span>
              <input className="input" placeholder="Search offences…" value={query}
                onChange={(e) => setQuery(e.target.value)} aria-label="Search offences" />
            </div>
          )}
          <div className="option-list" role="group" aria-label="Offences">
            {shown.map((o) => (
              <button
                key={o.code}
                className={`option ${form.offenceIds.includes(o.code) ? 'selected' : ''}`}
                onClick={() => toggle(o.code)}
                aria-pressed={form.offenceIds.includes(o.code)}
              >
                <span className="check"><Check size={13} /></span>
                <span className="grow stack gap-4" style={{ textAlign: 'left' }}>
                  <span>{o.name}</span>
                  {o.description && <span className="tiny muted">{o.description}</span>}
                </span>
              </button>
            ))}
            {!shown.length && <p className="small muted">No offence matches “{query}”.</p>}
          </div>
        </>
      ) : (
        <>
          <div className="option-list">
            {ISSUE_TYPES.map((issue) => (
              <button
                key={issue}
                className={`option ${form.issueType === issue ? 'selected' : ''}`}
                onClick={() => set({ issueType: issue, offenceIds: [] })}
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
        </>
      )}

      <div className="stack gap-10">
        <span className="section-title">Was anyone hurt?</span>
        {errors.injuries && <span className="error-text">{errors.injuries}</span>}
        <div className="row gap-10">
          {[{ v: true, label: 'Yes' }, { v: false, label: 'No' }].map(({ v, label }) => (
            <button
              key={label}
              className={`option grow ${form.injuries === v ? 'selected' : ''}`}
              onClick={() => set({ injuries: v })}
              aria-pressed={form.injuries === v}
            >
              <span className="check"><Check size={13} /></span>
              <span className="grow">{label}</span>
            </button>
          ))}
        </div>
        {form.injuries === true && <EmergencyNotice />}
      </div>
    </div>
  );
}

/** Shown wherever an emergency may be involved: this app is not monitored live. */
function EmergencyNotice() {
  return (
    <div className="card card-pad row gap-12" style={{ alignItems: 'flex-start', borderColor: 'var(--red)' }}>
      <Alert size={19} style={{ flex: 'none', marginTop: 2, color: 'var(--red)' }} />
      <div className="small muted">
        <strong style={{ color: 'var(--text)' }}>If someone is hurt or in danger, call 119 now.</strong>{' '}
        Reports sent here are not watched around the clock and are not an emergency service.
      </div>
    </div>
  );
}

/* ============================ Step 5 - Location =========================== */
function StepLocation({ form, set, errors, toast }) {
  const [locating, setLocating] = useState(false);
  const [finding, setFinding] = useState(false);
  const [geoError, setGeoError] = useState('');

  /** Pins the typed address: typed coordinates first, else an OpenStreetMap lookup. */
  const findOnMap = async () => {
    setGeoError('');
    const typed = extractCoordinates(form.location);
    if (typed) {
      set(typed);
      toast.success('Location pinned.');
      return;
    }

    setFinding(true);
    try {
      const hit = await geocodeAddress(form.location);
      if (hit) {
        set({ latitude: hit.latitude, longitude: hit.longitude });
        toast.success('Location pinned. Check the map is right.');
      } else {
        setGeoError("We couldn't find that place on the map. Add the road and town, or use your current location.");
      }
    } catch {
      setGeoError("We couldn't look up that address right now. Try again, or use your current location.");
    } finally {
      setFinding(false);
    }
  };

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

      {!hasCoords && (
        <button
          className="btn btn-outline btn-block"
          onClick={findOnMap}
          disabled={finding || !form.location.trim()}
        >
          {finding ? <><span className="spinner" /> Finding on map…</> : <><Search size={17} /> Find on map</>}
        </button>
      )}

      {errors?.location && !hasCoords && <span className="error-text">{errors.location}</span>}
    </div>
  );
}

/* ============================ Step 6 - Details ============================ */
function StepDetails({ form, set, errors, voiceNote, setVoiceNote }) {
  const length = form.description.trim().length;
  return (
    <div className="stack gap-20">
      <div>
        <h2>Describe what happened</h2>
        <p className="muted mt-4">
          A short written account is needed. You can add a voice note as well.
        </p>
      </div>

      <Field
        label="What you saw" required error={errors.description}
        hint={`${length}/${DESCRIPTION_MAX} characters${length < DESCRIPTION_MIN ? ` — at least ${DESCRIPTION_MIN}` : ''}`}
        htmlFor="notes"
      >
        <textarea
          id="notes" className={`textarea ${errors.description ? 'invalid' : ''}`} maxLength={DESCRIPTION_MAX}
          placeholder="Describe what you saw — how it happened, the direction of travel, weather and traffic conditions, whether anyone was put at risk…"
          value={form.description}
          onChange={(e) => set({ description: e.target.value })}
        />
      </Field>

      <div className="stack gap-10">
        <span className="section-title">Voice note (optional)</span>
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
    { label: 'Offence', step: 3, value: resolvedIssue || '—' },
    { label: 'Anyone hurt', step: 3, value: form.injuries === true ? 'Yes' : form.injuries === false ? 'No' : '—' },
    { label: 'Location', step: 4, value: form.location || (form.latitude != null ? `${form.latitude}, ${form.longitude}` : 'Not provided') },
    { label: 'What happened', step: 5, value: form.description.trim() || '—' },
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

      <EmergencyNotice />

      <div className="card card-pad row gap-12" style={{ alignItems: 'flex-start', borderColor: 'var(--brand-200)' }}>
        <Info size={19} style={{ flex: 'none', marginTop: 2, color: 'var(--brand-600)' }} />
        <div className="small muted">
          By submitting you confirm that this report is true and based on what you saw yourself.
          It goes to Sri Lanka Police for review. Knowingly making a false report is an offence,
          and accounts that send false reports may be suspended.
        </div>
      </div>
    </div>
  );
}

/* ============================ Suspended account =========================== */
function SuspendedView() {
  return (
    <div className="container" style={{ minHeight: '60dvh', display: 'grid', placeItems: 'center' }}>
      <div className="card card-pad stack gap-12 text-center" style={{ maxWidth: 460, alignItems: 'center' }}>
        <Alert size={30} style={{ color: 'var(--red)' }} />
        <h2>Your account is suspended</h2>
        <p className="muted small">
          You cannot send reports while your account is suspended. Contact Sri Lanka Police if you
          think this is a mistake. If someone is hurt or in danger, call 119.
        </p>
        <Link to="/dashboard" className="btn btn-outline">Back to dashboard</Link>
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
            been sent to Sri Lanka Police. You can follow its progress, and answer any questions
            they have, under My reports.
          </p>
        </div>

        <div className="card card-pad stack gap-8" style={{ width: '100%', textAlign: 'left' }}>
          <div className="between">
            <span className="small muted">Reference</span>
            <span className="mono small strong">{String(report._id).slice(-8).toUpperCase()}</span>
          </div>
          <div className="between">
            <span className="small muted">Offence</span>
            <span className="small strong" style={{ textAlign: 'right' }}>{report.issueType}</span>
          </div>
          <div className="between">
            <span className="small muted">Progress</span>
            <StatusBadge report={report} />
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
