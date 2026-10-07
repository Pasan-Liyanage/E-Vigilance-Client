/**
 * Shrinks large videos in the browser before they are uploaded.
 *
 * Phone cameras record at high bitrates: 30 seconds of 1080p or 4K is easily
 * 50 MB or more, which is slow on mobile data and over the upload limit. This
 * re-encodes such a video to H.264 MP4, choosing the bitrate from the clip's
 * length so the result lands near TARGET_BYTES, and the resolution from that
 * bitrate (720p when there is room, lower for long clips). A number plate
 * stays readable at 720p.
 *
 * It uses the phone's own hardware encoder through WebCodecs, via Mediabunny,
 * which is only downloaded when a large video is attached. Anything it cannot
 * handle (no WebCodecs, a codec the device cannot decode, an encoder that
 * refuses the settings) returns the original file, so this never blocks a
 * report.
 */
const TARGET_BYTES = 20 * 1024 * 1024;
const SKIP_BELOW = 12 * 1024 * 1024;     // already small enough to leave alone
const AUDIO_BPS = 160_000;               // budget for the audio track, which is usually copied as-is
const MIN_VIDEO_BPS = 600_000;
const MAX_VIDEO_BPS = 4_000_000;

/** Longest side of the output, picked from the bitrate the size budget allows. */
const longSideFor = (bps) => (bps >= 2_500_000 ? 1280 : bps >= 1_200_000 ? 960 : 854);

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const even = (n) => Math.max(2, Math.round(n / 2) * 2);

/** True when this browser can re-encode video at all. */
export const canCompressVideo = () =>
  typeof window !== 'undefined' && typeof window.VideoEncoder === 'function' && typeof window.VideoDecoder === 'function';

/** Whether a file is worth compressing. */
export const shouldCompressVideo = (file, skipBelow = SKIP_BELOW) =>
  Boolean(file) && String(file.type).startsWith('video/') && file.size > skipBelow && canCompressVideo();

/** Thrown when the person cancels optimisation, so the caller can drop the file. */
export class VideoCompressionCancelled extends Error {
  constructor() {
    super('Video optimisation was cancelled.');
    this.name = 'VideoCompressionCancelled';
  }
}

/**
 * @param {File} file
 * @param {{
 *   onProgress?: (fraction:number) => void,
 *   signal?: AbortSignal,
 *   targetBytes?: number,
 *   maxBytes?: number,
 *   skipBelow?: number,
 * }} [options] `maxBytes` is the hard upload limit: if the first encode still
 *   exceeds it, one smaller second pass is made.
 * @returns {Promise<File>} a smaller MP4, or the original file when compression
 *   is not possible or would not make it smaller.
 * @throws {VideoCompressionCancelled} when `signal` aborts.
 */
export async function compressVideo(file, {
  onProgress, signal, targetBytes = TARGET_BYTES, maxBytes = Infinity, skipBelow = SKIP_BELOW,
} = {}) {
  if (!shouldCompressVideo(file, skipBelow)) return file;

  let mb;
  try {
    mb = await import('mediabunny');
  } catch {
    return file; // offline before the library was cached
  }
  if (signal?.aborted) throw new VideoCompressionCancelled();

  const input = new mb.Input({ source: new mb.BlobSource(file), formats: mb.ALL_FORMATS });
  try {
    const track = await input.getPrimaryVideoTrack();
    if (!track || !(await track.canDecode())) return file;

    const duration = await input.computeDuration();
    if (!Number.isFinite(duration) || duration <= 0) return file;

    // Spend the size budget on video after setting aside room for audio.
    const videoBps = clamp(Math.floor((targetBytes * 8 * 0.94) / duration - AUDIO_BPS), MIN_VIDEO_BPS, MAX_VIDEO_BPS);
    // displayWidth/Height already account for rotation, so portrait stays portrait.
    const scale = Math.min(1, longSideFor(videoBps) / Math.max(track.displayWidth, track.displayHeight));

    let buffer = await encodePass(mb, input, track, { scale, bps: videoBps, onProgress, signal });
    if (!buffer) return file;

    // Encoders treat the bitrate as a guide, and very busy footage can still
    // overshoot. Only when that breaks the hard limit, try once more, smaller.
    if (buffer.byteLength > maxBytes) {
      const shrink = Math.sqrt((maxBytes * 0.8) / buffer.byteLength);
      const second = await encodePass(mb, input, track, {
        scale: scale * shrink, bps: Math.max(MIN_VIDEO_BPS / 2, videoBps * shrink * shrink), onProgress, signal,
      });
      if (second && second.byteLength < buffer.byteLength) buffer = second;
    }

    if (buffer.byteLength >= file.size) return file;
    const name = `${String(file.name || 'video').replace(/\.[^.]+$/, '')}.mp4`;
    return new File([buffer], name, { type: 'video/mp4', lastModified: Date.now() });
  } catch (err) {
    if (signal?.aborted || err?.name === 'ConversionCanceledError') throw new VideoCompressionCancelled();
    console.warn('[video] compression failed, keeping the original:', err?.message || err);
    return file;
  } finally {
    input.dispose?.();
  }
}

/** One H.264 encode at the given scale and bitrate. Resolves to null when the device cannot do it. */
async function encodePass(mb, input, track, { scale, bps, onProgress, signal }) {
  const width = even(track.displayWidth * scale);
  const height = even(track.displayHeight * scale);
  // A bare number would be read as a 0-1 quality level; the bitrate must be explicit.
  const quality = new mb.Quality({ bitrate: Math.round(bps) });
  if (!(await mb.canEncodeVideo('avc', { width, height, quality }))) return null;

  const output = new mb.Output({
    // Metadata up front, so playback can start before the whole file arrives.
    format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }),
    target: new mb.BufferTarget(),
  });
  const conversion = await mb.Conversion.init({
    input,
    output,
    tracks: 'primary',
    showWarnings: false,
    video: { width, height, fit: 'contain', codec: 'avc', quality },
    // Audio is copied when the MP4 can hold it, and re-encoded otherwise.
    audio: {},
  });
  // Never trade away the sound: a discarded audio track means keep the original.
  if (!conversion.isValid || conversion.discardedTracks.length) return null;

  if (onProgress) conversion.onProgress = (p) => onProgress(Math.min(1, Math.max(0, p)));
  const cancel = () => { conversion.cancel(); };
  signal?.addEventListener('abort', cancel, { once: true });
  try {
    await conversion.execute();
  } finally {
    signal?.removeEventListener('abort', cancel);
  }
  return output.target.buffer;
}
