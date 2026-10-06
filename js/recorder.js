/* WebcamClicks — Recorder.
   Records the processed display canvas (with the live effect applied) as a
   WebM/MP4 clip, saved to the gallery and/or downloaded. */

import { timestamp } from './utils.js';

function pickMimeType() {
  const candidates = [
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
    'video/mp4'
  ];
  if (typeof MediaRecorder === 'undefined') return '';
  for (const type of candidates) {
    try {
      if (MediaRecorder.isTypeSupported(type)) return type;
    } catch { /* ignore */ }
  }
  return '';
}

export class Recorder {
  constructor(canvas) {
    this.canvas = canvas;
    this.recorder = null;
    this.chunks = [];
    this.mimeType = pickMimeType();
    this.startedAt = 0;
    this.recording = false;
    this.onTick = null;
    this.tickTimer = 0;
    this.maxMs = 60000;
    this._maxTimer = 0;
  }

  get supported() {
    return typeof MediaRecorder !== 'undefined' &&
      typeof this.canvas.captureStream === 'function';
  }

  extension() {
    if (this.mimeType.includes('mp4')) return 'mp4';
    return 'webm';
  }

  start(fps = 30, audioTrack = null) {
    if (this.recording || !this.supported) return false;
    const canvasStream = this.canvas.captureStream(fps);
    const tracks = [...canvasStream.getVideoTracks()];
    if (audioTrack) tracks.push(audioTrack);
    const pixels = this.canvas.width * this.canvas.height;
    let bps = 4000000;
    if (pixels >= 7680 * 4320 * 0.7) bps = 24000000;
    else if (pixels >= 3840 * 2160 * 0.7) bps = 16000000;
    else if (pixels >= 1920 * 1080 * 0.7) bps = 8000000;
    const options = this.mimeType ? { mimeType: this.mimeType, videoBitsPerSecond: bps } : undefined;
    try {
      this.recorder = new MediaRecorder(stream, options);
    } catch {
      return false;
    }
    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };
    this.recorder.start(250);
    this.recording = true;
    this.startedAt = Date.now();
    this.tickTimer = setInterval(() => {
      if (this.onTick) this.onTick(this.elapsedMs());
    }, 250);
    clearTimeout(this._maxTimer);
    this._maxTimer = setTimeout(() => this.stop(), this.maxMs);
    return true;
  }

  elapsedMs() {
    return this.recording ? Date.now() - this.startedAt : 0;
  }

  stop() {
    return new Promise((resolve) => {
      clearInterval(this.tickTimer);
      clearTimeout(this._maxTimer);
      if (!this.recorder || !this.recording) {
        this.recording = false;
        resolve(null);
        return;
      }
      this.recorder.onstop = () => {
        this.recording = false;
        const type = this.mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type: type.split(';')[0] });
        if (!blob.size) { resolve(null); return; }
        const url = URL.createObjectURL(blob);
        resolve({
          url,
          blob,
          ext: this.extension(),
          filename: `webcamclicks-${timestamp()}.${this.extension()}`
        });
      };
      try {
        this.recorder.stop();
      } catch {
        this.recording = false;
        resolve(null);
      }
      this.recorder.stream && this.recorder.stream.getTracks().forEach((t) => t.stop());
    });
  }
}

/** Download a recorded clip object { url, filename }. */
export function downloadClip(clip) {
  const a = document.createElement('a');
  a.href = clip.url;
  a.download = clip.filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}
