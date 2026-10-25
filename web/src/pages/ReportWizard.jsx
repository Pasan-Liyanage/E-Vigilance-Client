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
  VEHICLE_TYPES, FALLBACK_ISSUES, MAX_EVIDENCE_FILES, MAX_FILE_MB, MAX_PHOTO_MB, MAX_OFFENCES,
  appliesToVehicle, currentVehicleLabel, vehicleNoun, vehicleTypeOf,
  MAX_REPORT_AGE_DAYS, DESCRIPTION_MIN, DESCRIPTION_MAX,
} from '../constants';
import { Field, Modal, StatusBadge } from '../components/ui';
import CameraCapture from '../components/CameraCapture';
import VoiceRecorder from '../components/VoiceRecorder';
import {
  Camera, Video, Image as ImageIcon, Mic, Car, Calendar, Alert, MapPin, FileText,
  CheckCircle, ChevronLeft, ChevronRight, X, Check, Crosshair, Send, Info, Plus, Clock, Search,
} from '../components/Icons';
import { addressOf, insideSriLanka, searchPlaces } from '../utils/coordinates';
import { photoLocation } from '../utils/photoLocation';
import LocationMap from '../components/LocationMap';

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
  // The address was filled in from the pin, so a new pin may replace it.
  locationAutoAddress: false,
  latitude: null,
  longitude: null,
  // How the pin was set (gps, photo, map, link, coordinates), the GPS
  // accuracy in metres, and whether the citizen confirmed the exact spot.
  locationSource: null,
  locationAccuracy: null,
  locationConfirmed: false,
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
      vehicleType: currentVehicleLabel(rest.vehicleType ?? ''),
      // A choice from an earlier built-in list is asked again.
      issueType: FALLBACK_ISSUES.some((i) => i.name === rest.issueType) ? rest.issueType : '',
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
  // null while loading; [] when none are published, which falls back to FALLBACK_ISSUES.
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

  // A new vehicle type drops offences that can't happen with it, and says so:
  // from the published list, or the built-in one when that couldn't load.
  useEffect(() => {
    const type = vehicleTypeOf(form.vehicleType);
    const noun = vehicleNoun(form.vehicleType);
    if (offences?.length && form.offenceIds.length) {
      const dropped = form.offenceIds
        .map((c) => offences.find((o) => o.code === c))
        .filter((o) => o && !appliesToVehicle(o, type));
      if (dropped.length) {
        set({ offenceIds: form.offenceIds.filter((c) => !dropped.some((o) => o.code === c)) });
        toast.info(`Removed ${dropped.map((o) => `"${o.name}"`).join(', ')}: it doesn't apply to ${noun}.`);
      }
    }
    const issue = FALLBACK_ISSUES.find((i) => i.name === form.issueType);
    if (issue && !appliesToVehicle(issue, type)) {
      set({ issueType: '' });
      toast.info(`Removed "${issue.name}": it doesn't apply to ${noun}.`);
    }
    // Runs when the vehicle or the list changes, not on every offence picked.
  }, [form.vehicleType, offences]);

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
        // Where a gallery photo was taken, read before compressing drops it.
        // Offered on the location step; never used unless the citizen picks it.
        const place = capturedInApp ? null : await photoLocation(original);
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
          place,
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
  // Only offences that can happen with the chosen vehicle ("No helmet" isn't
  // offered for a car). The server and the admin system check the same.
  const vehicleType = vehicleTypeOf(form.vehicleType);
  const fittingOffences = offences ? offences.filter((o) => appliesToVehicle(o, vehicleType)) : null;
  const fittingIssues = FALLBACK_ISSUES.filter((i) => appliesToVehicle(i, vehicleType));
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
        const misfit = form.offenceIds
          .map((c) => offences.find((o) => o.code === c))
          .find((o) => o && !appliesToVehicle(o, vehicleType));
        if (!form.offenceIds.length) e.offenceIds = 'Select what the driver did.';
        else if (misfit) {
          e.offenceIds = `"${misfit.name}" doesn't apply to ${vehicleNoun(form.vehicleType)}. Remove it, or go back and correct the vehicle type.`;
        }
      } else if (!form.issueType) {
        e.offenceIds = 'Select what the driver did.';
      } else if (!fittingIssues.some((i) => i.name === form.issueType)) {
        e.offenceIds = `"${form.issueType}" doesn't apply to ${vehicleNoun(form.vehicleType)}. Choose again, or go back and correct the vehicle type.`;
      } else if (form.issueType === 'Other' && !form.customIssue.trim()) {
        e.customIssue = 'Describe the violation.';
      }
      if (form.injuries === null) e.injuries = 'Tell us whether anyone was hurt.';
    }
    if (index === 4) {
      // The police are routed to the nearest station from these coordinates,
      // so a typed address alone is not enough.
      if (form.latitude == null || form.longitude == null) {
        e.location = 'Place the pin: use your location, search for the place, or tap the map.';
      } else if (!insideSriLanka(form.latitude, form.longitude)) {
        e.location = 'The pin must be in Sri Lanka.';
      } else if (!form.locationConfirmed) {
        e.location = 'Check the pin on the map, then confirm it is exactly where it happened.';
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
  }, [form, useSchedule, offences, vehicleType, fittingIssues]);

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
      locationSource: form.locationSource || undefined,
      locationAccuracy: form.locationAccuracy != null ? String(form.locationAccuracy) : undefined,
      locationConfirmed: form.locationConfirmed === true,
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
            offences={fittingOffences} issues={fittingIssues} useSchedule={useSchedule}
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
function StepIssue({ form, set, errors, offences, issues, useSchedule, toast }) {
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
          {form.vehicleType && form.vehicleType !== 'Other'
            ? `Only offences that apply to ${vehicleNoun(form.vehicleType)} are listed. `
            : ''}
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
            {issues.map(({ name }) => (
              <button
                key={name}
                className={`option ${form.issueType === name ? 'selected' : ''}`}
                onClick={() => set({ issueType: name, offenceIds: [] })}
              >
                <span className="check"><Check size={13} /></span>
                <span className="grow">{name}</span>
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

/** How each way of setting the pin is described to the citizen (and in triage). */
const SOURCE_TEXT = {
  gps: "Your phone's location",
  photo: 'Where your photo was taken',
  map: 'Placed on the map',
  link: 'From a Google Maps link',
  coordinates: 'From coordinates',
};

/** A GPS fix less precise than this, in metres, needs a careful look. */
const ROUGH_GPS_M = 100;

function StepLocation({ form, set, errors, toast, media }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [searching, setSearching] = useState(false);
  const [paste, setPaste] = useState('');
  const [resolving, setResolving] = useState(false);
  // A link that only gave the map's centre, not a dropped pin.
  const [roughLink, setRoughLink] = useState(false);
  // undefined while unknown; null when HQ will choose.
  const [station, setStation] = useState(undefined);
  const latest = useRef(0);

  const hasCoords = form.latitude != null && form.longitude != null;
  const photos = media.filter((m) => m.place);

  /**
   * Puts the pin somewhere. Every new pin has to be confirmed again. The
   * address is filled in for the citizen unless they typed their own.
   */
  const pin = async (latitude, longitude, source, accuracy = null) => {
    setGeoError('');
    set({ latitude, longitude, locationSource: source, locationAccuracy: accuracy, locationConfirmed: false });
    if (form.location.trim() && !form.locationAutoAddress) return;
    const ticket = ++latest.current;
    const label = await addressOf(latitude, longitude);
    if (label && ticket === latest.current) set({ location: label, locationAutoAddress: true });
  };

  // Which police station the pin falls to, as the admin system will decide.
  useEffect(() => {
    if (!hasCoords) { setStation(undefined); return undefined; }
    let alive = true;
    const id = setTimeout(() => {
      api.stationFor(form.latitude, form.longitude)
        .then(({ station: s }) => { if (alive) setStation(s); })
        .catch(() => { if (alive) setStation(undefined); });
    }, 400);
    return () => { alive = false; clearTimeout(id); };
  }, [form.latitude, form.longitude, hasCoords]);

  const useMyLocation = () => {
    setGeoError('');
    if (!navigator.geolocation) {
      setGeoError('This browser does not support location. Search for the place, or paste a Google Maps link.');
      return;
    }
    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setGeoError('Location needs a secure (HTTPS) page. Search for the place, or paste a Google Maps link.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const latitude = Number(coords.latitude.toFixed(6));
        const longitude = Number(coords.longitude.toFixed(6));
        setLocating(false);
        if (!insideSriLanka(latitude, longitude)) {
          setGeoError('Your location is outside Sri Lanka. Search for the place, or place the pin on the map.');
          return;
        }
        setRoughLink(false);
        pin(latitude, longitude, 'gps', Math.round(coords.accuracy));
      },
      (err) => {
        const message = {
          1: 'Location permission was blocked. Allow it in your browser settings, or search for the place.',
          2: 'Your location is unavailable right now. Search for the place, or place the pin on the map.',
          3: 'Finding your location took too long. Try again, or search for the place.',
        };
        setGeoError(message[err.code] || err.message);
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  };

  const search = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearching(true);
    setGeoError('');
    try {
      const found = await searchPlaces(query);
      setResults(found);
      if (!found.length) setGeoError('No place in Sri Lanka matches that. Try a road and town, such as "Peradeniya Road, Kandy".');
    } catch {
      setGeoError("We couldn't search right now. Try again, or use your current location.");
    } finally {
      setSearching(false);
    }
  };

  const choose = (place) => {
    setResults(null);
    setRoughLink(false);
    pin(place.latitude, place.longitude, 'map');
    toast.info('Now move the pin to the exact spot.');
  };

  const usePaste = async (e) => {
    e.preventDefault();
    if (!paste.trim()) return;
    setResolving(true);
    setGeoError('');
    try {
      const { place } = await api.resolveLocation(paste);
      pin(place.latitude, place.longitude, /https?:\/\//i.test(paste) ? 'link' : 'coordinates');
      setRoughLink(!place.exact);
      setPaste('');
      toast.success('Pin placed. Check it on the map.');
    } catch (err) {
      setGeoError(err.message);
    } finally {
      setResolving(false);
    }
  };

  const rough = form.locationSource === 'gps' && form.locationAccuracy > ROUGH_GPS_M;

  return (
    <div className="stack gap-20">
      <div>
        <h2>Where did it happen?</h2>
        <p className="muted mt-4">
          The pin decides which police station receives your report, so place it exactly where it happened.
        </p>
      </div>

      <button className="btn btn-primary btn-lg btn-block" onClick={useMyLocation} disabled={locating}>
        {locating ? <><span className="spinner" /> Finding your location…</> : <><Crosshair size={19} /> I'm there now: use my location</>}
      </button>

      {photos.length > 0 && (
        <div className="stack gap-8">
          {photos.slice(0, 3).map((m, i) => (
            <button key={m.id} className="btn btn-outline btn-block" onClick={() => { setRoughLink(false); pin(m.place.latitude, m.place.longitude, 'photo'); }}>
              <ImageIcon size={17} /> Use where {photos.length > 1 ? `photo ${i + 1}` : 'your photo'} was taken
            </button>
          ))}
        </div>
      )}

      <form className="stack gap-8" onSubmit={search}>
        <label className="label" htmlFor="place-q">Or search for the place</label>
        <div className="row gap-8">
          <div className="input-group grow">
            <span className="lead"><Search size={18} /></span>
            <input id="place-q" className="input" placeholder="Road, junction or landmark, and town"
              value={query} onChange={(e) => setQuery(e.target.value)} />
          </div>
          <button className="btn btn-outline" type="submit" disabled={searching || !query.trim()}>
            {searching ? <span className="spinner" /> : 'Search'}
          </button>
        </div>
      </form>

      {results?.length > 0 && (
        <div className="place-results" role="list" aria-label="Places found">
          {results.map((p) => (
            <button key={`${p.latitude},${p.longitude}`} role="listitem" onClick={() => choose(p)}>
              <span className="small">{p.label}</span>
            </button>
          ))}
        </div>
      )}

      {geoError && (
        <div className="row gap-8" role="alert" style={{ alignItems: 'flex-start', color: 'var(--red)' }}>
          <Alert size={17} style={{ flex: 'none', marginTop: 2 }} />
          <span className="small">{geoError}</span>
        </div>
      )}

      <div className="stack gap-8">
        <LocationMap
          latitude={form.latitude}
          longitude={form.longitude}
          accuracy={form.locationSource === 'gps' ? form.locationAccuracy : null}
          onPick={(lat, lng) => { setRoughLink(false); pin(lat, lng, 'map'); }}
        />
        <span className="tiny subtle">Tap the map to place the pin, or drag it to the exact spot. Zoom in to check.</span>
      </div>

      {hasCoords && (
        <div className="stack gap-12">
          <div className="between gap-12 small">
            <span className="mono subtle">{form.latitude}, {form.longitude}</span>
            <span className="subtle" style={{ textAlign: 'right' }}>
              {SOURCE_TEXT[form.locationSource] || 'Pinned'}
              {form.locationSource === 'gps' && form.locationAccuracy != null ? ` · within about ${form.locationAccuracy} m` : ''}
            </span>
          </div>

          {rough && (
            <div className="card card-pad row gap-10" style={{ alignItems: 'flex-start', borderColor: 'var(--amber)' }}>
              <Alert size={17} style={{ flex: 'none', marginTop: 2, color: 'var(--amber)' }} />
              <span className="small muted">
                Your phone only knows your position to within about {form.locationAccuracy} m. Drag the pin to the exact spot.
              </span>
            </div>
          )}
          {roughLink && (
            <div className="card card-pad row gap-10" style={{ alignItems: 'flex-start', borderColor: 'var(--amber)' }}>
              <Alert size={17} style={{ flex: 'none', marginTop: 2, color: 'var(--amber)' }} />
              <span className="small muted">
                That link only shows where the map was centred, not a dropped pin. Move the pin to the exact spot.
              </span>
            </div>
          )}

          {station !== undefined && (
            <div className="row gap-10 small" style={{ alignItems: 'flex-start' }}>
              <MapPin size={17} style={{ flex: 'none', marginTop: 2, color: 'var(--brand-600)' }} />
              {station ? (
                <span>
                  {station.by === 'area' ? 'Police station for this area: ' : 'Nearest police station: '}
                  <strong>{station.name}</strong>
                  {station.by === 'nearest' && station.distanceKm != null ? ` (${station.distanceKm} km away)` : ''}
                  <span className="tiny subtle" style={{ display: 'block' }}>
                    Sri Lanka Police may pass it to another station.
                  </span>
                </span>
              ) : (
                <span className="muted">Sri Lanka Police will choose the station for this place.</span>
              )}
            </div>
          )}

          <label className={`pin-check ${form.locationConfirmed ? 'checked' : ''}`}>
            <input
              type="checkbox"
              checked={Boolean(form.locationConfirmed)}
              onChange={(e) => set({ locationConfirmed: e.target.checked })}
            />
            <span className="stack gap-4">
              <strong className="small">The pin is exactly where it happened</strong>
              <span className="tiny muted">
                Zoom in and check the road and junction. A wrong pin can send your report to the wrong police station.
              </span>
            </span>
          </label>
        </div>
      )}

      <details className="card card-pad">
        <summary className="small strong" style={{ cursor: 'pointer' }}>Paste a Google Maps link or coordinates</summary>
        <form className="stack gap-10 mt-12" onSubmit={usePaste}>
          <p className="tiny muted">
            In Google Maps, press and hold the exact spot to drop a pin, tap Share, then Copy link, and paste it here.
            Coordinates such as 6.9271, 79.8612 work too.
          </p>
          <div className="row gap-8">
            <input className="input grow" placeholder="https://maps.app.goo.gl/…" value={paste}
              onChange={(e) => setPaste(e.target.value)} aria-label="Google Maps link or coordinates" />
            <button className="btn btn-outline" type="submit" disabled={resolving || !paste.trim()}>
              {resolving ? <span className="spinner" /> : 'Use'}
            </button>
          </div>
        </form>
      </details>

      <Field label="Address or landmark" hint="Optional. Helps the officer find the place, e.g. near Liberty Plaza." htmlFor="loc">
        <textarea
          id="loc" className="textarea" style={{ minHeight: 72 }}
          placeholder="Road name, landmark, town…"
          value={form.location}
          onChange={(e) => set({ location: e.target.value, locationAutoAddress: false })}
        />
      </Field>

      {errors?.location && <span className="error-text">{errors.location}</span>}
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
    {
      label: 'Location',
      step: 4,
      value: form.latitude != null
        ? `${form.location || `${form.latitude}, ${form.longitude}`} (${SOURCE_TEXT[form.locationSource] || 'pinned'}${form.locationConfirmed ? ', confirmed' : ''})`
        : 'Not pinned',
    },
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
