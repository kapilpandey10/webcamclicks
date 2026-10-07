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
      (typeof this.canvas.captureStream === 'function' ||
       typeof this.canvas.webkitCaptureStream === 'function');
  }

  extension() {
    const type = (this.recorder && this.recorder.mimeType) || this.mimeType || '';
    if (type.includes('mp4')) return 'mp4';
    return 'webm';
  }

  start(fps = 30, audioTrack = null) {
    if (this.recording || !this.supported) return false;

    const captureFn = this.canvas.captureStream || this.canvas.webkitCaptureStream;
    if (!captureFn) return false;

    let canvasStream;
    try {
      canvasStream = captureFn.call(this.canvas, fps);
    } catch {
      try {
        canvasStream = captureFn.call(this.canvas);
      } catch (err) {
        console.error('Canvas captureStream failed:', err);
        return false;
      }
    }

    const tracks = [...canvasStream.getVideoTracks()];
    if (audioTrack) tracks.push(audioTrack);
    const stream = new MediaStream(tracks);
    this._stream = stream;
    this._canvasStream = canvasStream;

    const pixels = (this.canvas.width || 1280) * (this.canvas.height || 720);
    let bps = 4000000;
    if (pixels >= 7680 * 4320 * 0.7) bps = 20000000;
    else if (pixels >= 3840 * 2160 * 0.7) bps = 12000000;
    else if (pixels >= 1920 * 1080 * 0.7) bps = 6000000;

    let rec = null;
    const selectedMime = this.mimeType || pickMimeType();

    if (selectedMime) {
      try {
        rec = new MediaRecorder(stream, { mimeType: selectedMime, videoBitsPerSecond: bps });
      } catch {
        try {
          rec = new MediaRecorder(stream, { mimeType: selectedMime });
        } catch {
          rec = null;
        }
      }
    }

    if (!rec) {
      try {
        rec = new MediaRecorder(stream);
      } catch (err) {
        console.error('MediaRecorder initialization failed:', err);
        return false;
      }
    }

    this.recorder = rec;
    if (rec.mimeType) {
      this.mimeType = rec.mimeType;
    }

    this.chunks = [];
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.chunks.push(e.data);
    };

    try {
      this.recorder.start(250);
    } catch {
      try {
        this.recorder.start();
      } catch (err) {
        console.error('recorder.start failed:', err);
        return false;
      }
    }

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

      // Generate a thumbnail frame from canvas before stopping
      let thumbnail = null;
      try {
        const thumbCanvas = document.createElement('canvas');
        const ratio = Math.min(1, 480 / (this.canvas.width || 480));
        thumbCanvas.width = Math.max(2, Math.round((this.canvas.width || 480) * ratio));
        thumbCanvas.height = Math.max(2, Math.round((this.canvas.height || 360) * ratio));
        const ctx = thumbCanvas.getContext('2d');
        ctx.drawImage(this.canvas, 0, 0, thumbCanvas.width, thumbCanvas.height);
        thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.85);
      } catch (e) {
        console.warn('Could not generate video thumbnail:', e);
      }

      this.recorder.onstop = () => {
        this.recording = false;
        const type = (this.recorder && this.recorder.mimeType) || this.mimeType || 'video/webm';
        const blob = new Blob(this.chunks, { type: type.split(';')[0] });

        try {
          if (this._canvasStream) {
            this._canvasStream.getTracks().forEach((t) => t.stop());
            this._canvasStream = null;
          }
        } catch {}

        if (!blob.size) { resolve(null); return; }
        const url = URL.createObjectURL(blob);
        resolve({
          url,
          blob,
          thumbnail,
          ext: this.extension(),
          filename: `webcamclicks-${timestamp()}.${this.extension()}`
        });
      };

      try {
        if (this.recorder.state !== 'inactive') {
          this.recorder.stop();
        }
      } catch (err) {
        console.error('Error stopping MediaRecorder:', err);
        this.recording = false;
        resolve(null);
      }
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
