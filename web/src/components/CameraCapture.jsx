import { useCallback, useEffect, useRef, useState } from 'react';
import { Modal } from './ui';
import { Camera, Video, Flip, Alert, X } from './Icons';

/** Picks the first container the browser can actually record. */
function pickMime(candidates) {
  if (typeof MediaRecorder === 'undefined') return '';
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

const VIDEO_MIMES = [
  'video/webm;codecs=vp9,opus',
  'video/webm;codecs=vp8,opus',
  'video/webm',
  'video/mp4',
];

const secureEnough = () =>
  window.isSecureContext ||
  ['localhost', '127.0.0.1'].includes(window.location.hostname);

/**
 * Full-screen camera sheet: live preview, photo snapshot and video recording.
 * Falls back to a clear message (and the caller's file picker) when the
 * browser will not grant camera access.
 */
export default function CameraCapture({ open, mode = 'photo', onCapture, onClose }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);

  const [facing, setFacing] = useState('environment');
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);

  const stop = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      try { recorderRef.current.stop(); } catch { /* already stopped */ }
    }
    recorderRef.current = null;
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) videoRef.current.srcObject = null;
    setReady(false);
    setRecording(false);
    setSeconds(0);
  }, []);

  // Open the camera whenever the sheet is shown or the lens is flipped.
  useEffect(() => {
    if (!open) { stop(); return; }

    let cancelled = false;

    (async () => {
      setError('');
      setReady(false);

      if (!secureEnough()) {
        setError(
          'Your browser only allows the camera on a secure (HTTPS) page. Open the app on localhost or over HTTPS, or use "Upload" instead.'
        );
        return;
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('This browser does not support in-app camera capture. Please use "Upload" instead.');
        return;
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: mode === 'video',
        });
        if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return; }

        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => { /* autoplay guard */ });
        }
        setReady(true);
      } catch (err) {
        if (cancelled) return;
        const map = {
          NotAllowedError: 'Camera permission was blocked. Allow camera access in your browser settings, then try again.',
          NotFoundError: 'No camera was found on this device. Use "Upload" to attach an existing file.',
          NotReadableError: 'The camera is already in use by another app. Close it and try again.',
          OverconstrainedError: 'That camera is not available on this device.',
        };
        setError(map[err.name] || `Could not start the camera: ${err.message}`);
      }
    })();

    return () => { cancelled = true; };
  }, [open, facing, mode, stop]);

  useEffect(() => () => stop(), [stop]);

  /** Grabs the current frame as a JPEG file. */
  const snapPhoto = () => {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      if (!blob) return;
      onCapture(new File([blob], `photo-${Date.now()}.jpg`, { type: 'image/jpeg' }));
      stop();
      onClose();
    }, 'image/jpeg', 0.9);
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;

    const mimeType = pickMime(VIDEO_MIMES);
    let recorder;
    try {
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    } catch {
      setError('Video recording is not supported by this browser. Please use "Upload" instead.');
      return;
    }

    chunksRef.current = [];
    recorder.ondataavailable = (e) => { if (e.data?.size) chunksRef.current.push(e.data); };
    recorder.onstop = () => {
      const type = recorder.mimeType || mimeType || 'video/webm';
      const blob = new Blob(chunksRef.current, { type });
      chunksRef.current = [];
      if (blob.size) {
        const ext = type.includes('mp4') ? 'mp4' : 'webm';
        onCapture(new File([blob], `video-${Date.now()}.${ext}`, { type }));
      }
      stop();
      onClose();
    };

    recorder.start(250);
    recorderRef.current = recorder;
    setRecording(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds((s) => {
        if (s + 1 >= 60) { // hard stop at one minute to keep uploads small
          try { recorder.stop(); } catch { /* noop */ }
          return 60;
        }
        return s + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (recorderRef.current?.state === 'recording') recorderRef.current.stop();
  };

  const close = () => { stop(); onClose(); };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

  return (
    <Modal
      open={open}
      onClose={close}
      title={mode === 'video' ? 'Record video evidence' : 'Take a photo'}
      wide
    >
      {error ? (
        <div className="stack gap-16">
          <div className="row gap-12" style={{ alignItems: 'flex-start', color: 'var(--red)' }}>
            <Alert size={20} style={{ flex: 'none', marginTop: 2 }} />
            <p style={{ color: 'var(--text)' }}>{error}</p>
          </div>
          <button className="btn btn-outline btn-block" onClick={close}>Close</button>
        </div>
      ) : (
        <div className="stack gap-16">
          <div className="camera-stage">
            <video ref={videoRef} playsInline muted autoPlay />
            {recording && (
              <div className="rec-pill"><span className="blink" /> REC {mmss}</div>
            )}
            {!ready && (
              <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', color: '#fff' }}>
                <div className="stack gap-10" style={{ alignItems: 'center' }}>
                  <div className="spinner" />
                  <span className="small">Starting camera…</span>
                </div>
              </div>
            )}
          </div>

          <div className="row" style={{ justifyContent: 'space-between' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => setFacing((f) => (f === 'environment' ? 'user' : 'environment'))}
              disabled={recording}
              aria-label="Switch camera"
              title="Switch camera"
            >
              <Flip size={20} />
            </button>

            {mode === 'video' ? (
              <button
                className={`shutter ${recording ? 'recording' : ''}`}
                onClick={recording ? stopRecording : startRecording}
                disabled={!ready}
                aria-label={recording ? 'Stop recording' : 'Start recording'}
              />
            ) : (
              <button className="shutter" onClick={snapPhoto} disabled={!ready} aria-label="Take photo" />
            )}

            <button className="btn btn-ghost btn-icon" onClick={close} aria-label="Cancel">
              <X size={20} />
            </button>
          </div>

          <p className="tiny subtle text-center">
            {mode === 'video'
              ? recording ? 'Tap the red button to stop. Recording stops automatically at 60 seconds.'
                          : 'Records video with sound, up to 60 seconds.'
              : 'Hold steady and make sure the number plate is readable.'}
          </p>
        </div>
      )}
    </Modal>
  );
}
