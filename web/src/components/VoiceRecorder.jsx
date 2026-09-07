import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, Trash, Alert } from './Icons';

const AUDIO_MIMES = [
  'audio/webm;codecs=opus',
  'audio/webm',
  'audio/mp4',
  'audio/ogg;codecs=opus',
];

const BARS = 28;
const MAX_SECONDS = 120;

const pickMime = () => {
  if (typeof MediaRecorder === 'undefined') return '';
  return AUDIO_MIMES.find((t) => MediaRecorder.isTypeSupported(t)) || '';
};

const secureEnough = () =>
  window.isSecureContext || ['localhost', '127.0.0.1'].includes(window.location.hostname);

/**
 * Records a short voice note describing the incident.
 * Shows a live level meter while recording and a player once finished.
 */
export default function VoiceRecorder({ value, onChange }) {
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const audioCtxRef = useRef(null);
  const rafRef = useRef(null);
  const timerRef = useRef(null);

  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [levels, setLevels] = useState(() => Array(BARS).fill(4));
  const [error, setError] = useState('');
  const [previewUrl, setPreviewUrl] = useState(null);

  // Keep an object URL in step with the recorded file.
  useEffect(() => {
    if (!value) { setPreviewUrl(null); return; }
    const url = URL.createObjectURL(value);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [value]);

  const teardown = useCallback(() => {
    if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (audioCtxRef.current) { audioCtxRef.current.close().catch(() => {}); audioCtxRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach((t) => t.stop()); streamRef.current = null; }
    recorderRef.current = null;
    setLevels(Array(BARS).fill(4));
  }, []);

  useEffect(() => () => teardown(), [teardown]);

  const start = async () => {
    setError('');

    if (!secureEnough()) {
      setError('Microphone access needs a secure (HTTPS) page. Open the app on localhost or over HTTPS.');
      return;
    }
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setError('Voice recording is not supported in this browser.');
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      });
      streamRef.current = stream;

      // Live level meter
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        const ctx = new AudioCtx();
        audioCtxRef.current = ctx;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 256;
        ctx.createMediaStreamSource(stream).connect(analyser);
        const data = new Uint8Array(analyser.frequencyBinCount);

        const tick = () => {
          analyser.getByteFrequencyData(data);
          const step = Math.floor(data.length / BARS) || 1;
          setLevels(
            Array.from({ length: BARS }, (_, i) => {
              let sum = 0;
              for (let j = 0; j < step; j++) sum += data[i * step + j] || 0;
              return Math.max(4, Math.min(34, (sum / step / 255) * 46));
            })
          );
          rafRef.current = requestAnimationFrame(tick);
        };
        tick();
      }

      const mimeType = pickMime();
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        const type = recorder.mimeType || mimeType || 'audio/webm';
        const blob = new Blob(chunksRef.current, { type });
        chunksRef.current = [];
        if (blob.size) {
          const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
          // Always give the file a concrete type - a blank one makes the
          // browser omit Content-Type on upload.
          onChange(
            new File([blob], `voice-note-${Date.now()}.${ext}`, { type: type || 'audio/webm' })
          );
        }
        teardown();
        setRecording(false);
      };

      recorder.start(250);
      recorderRef.current = recorder;
      setRecording(true);
      setSeconds(0);
      timerRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s + 1 >= MAX_SECONDS) { try { recorder.stop(); } catch { /* noop */ } return MAX_SECONDS; }
          return s + 1;
        });
      }, 1000);
    } catch (err) {
      const map = {
        NotAllowedError: 'Microphone permission was blocked. Allow it in your browser settings and try again.',
        NotFoundError: 'No microphone was found on this device.',
        NotReadableError: 'The microphone is being used by another app.',
      };
      setError(map[err.name] || `Could not start recording: ${err.message}`);
      teardown();
    }
  };

  const stop = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const clear = () => { onChange(null); setSeconds(0); };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  if (value && !recording) {
    return (
      <div className="stack gap-10">
        <div className="recorder">
          <div className="mic-btn" style={{ background: 'var(--green-bg)', color: 'var(--green)', boxShadow: 'none' }}>
            <Mic size={22} />
          </div>
          <div className="grow stack gap-6">
            <span className="small strong">Voice note attached</span>
            {previewUrl && <audio controls src={previewUrl} preload="metadata" />}
          </div>
          <button className="btn btn-ghost btn-icon" onClick={clear} aria-label="Delete voice note" title="Delete">
            <Trash size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="stack gap-10">
      <div className="recorder">
        <button
          className={`mic-btn ${recording ? 'recording' : ''}`}
          onClick={recording ? stop : start}
          aria-label={recording ? 'Stop recording' : 'Start recording a voice note'}
          type="button"
        >
          <Mic size={22} />
        </button>

        <div className="grow">
          {recording ? (
            <>
              <div className="wave" aria-hidden="true">
                {levels.map((h, i) => <span key={i} style={{ height: `${h}px` }} />)}
              </div>
              <span className="tiny subtle mono">{mmss} / 02:00 — tap the mic to stop</span>
            </>
          ) : (
            <div className="stack gap-4">
              <span className="small strong">Add a voice note</span>
              <span className="tiny subtle">Describe what you saw, in your own words (optional)</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="row gap-8" style={{ alignItems: 'flex-start', color: 'var(--red)' }}>
          <Alert size={16} style={{ flex: 'none', marginTop: 2 }} />
          <span className="small">{error}</span>
        </div>
      )}
    </div>
  );
}
