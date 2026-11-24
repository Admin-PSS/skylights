/**
 * Records the 3D canvas (and the show's music + firework sounds) into a video file using MediaRecorder.
 * The HTML controls are not part of the canvas, so they never appear in the video.
 */
const MIME_CANDIDATES = [
  ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'mp4'],
  ['video/mp4;codecs=avc1,mp4a', 'mp4'],
  ['video/mp4', 'mp4'],
  ['video/webm;codecs=vp9,opus', 'webm'],
  ['video/webm;codecs=vp8,opus', 'webm'],
  ['video/webm', 'webm'],
];

export function pickFormat() {
  if (typeof MediaRecorder === 'undefined') return null;
  for (const [mime, ext] of MIME_CANDIDATES) {
    if (MediaRecorder.isTypeSupported(mime)) return { mime, ext };
  }
  return null;
}

export class ShowRecorder {
  constructor(canvas, audio) {
    this.canvas = canvas;
    this.audio = audio;
    this.recorder = null;
    this.onstate = null; // (state, info) => void   state: 'recording' | 'done' | 'error'
  }

  get recording() {
    return !!this.recorder && this.recorder.state === 'recording';
  }

  get elapsed() {
    return this.recording ? (performance.now() - this.t0) / 1000 : 0;
  }

  start({ fps = 30, bitrate = 12e6, withAudio = true } = {}) {
    const fmt = pickFormat();
    if (!fmt) {
      this.onstate?.('error', { message: 'This browser cannot record video. Please use Chrome, Edge or Safari.' });
      return false;
    }
    const stream = this.canvas.captureStream(fps);
    if (withAudio) {
      const a = this.audio.getRecordStream();
      a?.getAudioTracks().forEach((t) => stream.addTrack(t));
    }
    const chunks = [];
    const rec = new MediaRecorder(stream, {
      mimeType: fmt.mime,
      videoBitsPerSecond: bitrate,
      audioBitsPerSecond: 192000,
    });
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getVideoTracks().forEach((t) => t.stop());
      const blob = new Blob(chunks, { type: fmt.mime.split(';')[0] });
      this.onstate?.('done', {
        blob,
        url: URL.createObjectURL(blob),
        ext: fmt.ext,
        mime: blob.type,
        seconds: (performance.now() - this.t0) / 1000,
      });
      this.recorder = null;
    };
    rec.onerror = (e) => this.onstate?.('error', { message: e.error?.message || 'Recording failed.' });
    rec.start(1000);
    this.recorder = rec;
    this.t0 = performance.now();
    this.onstate?.('recording', { ext: fmt.ext });
    return true;
  }

  stop() {
    if (this.recording) this.recorder.stop();
  }
}
