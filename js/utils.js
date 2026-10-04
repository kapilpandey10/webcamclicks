/* WebcamClicks — shared utilities */

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

export const clamp = (v, min, max) => (v < min ? min : v > max ? max : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const rand = (min, max) => min + Math.random() * (max - min);
export const pick = (arr) => arr[(Math.random() * arr.length) | 0];

/* ---------- localStorage (quota-safe) ---------- */
export const storage = {
  get(key, fallback) {
    try {
      const v = localStorage.getItem(key);
      return v === null ? fallback : JSON.parse(v);
    } catch { return fallback; }
  },
  set(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { return false; }
  },
  remove(key) { try { localStorage.removeItem(key); } catch { /* ignore */ } }
};

/* ---------- Files ---------- */
export function pad2(n) { return String(n).padStart(2, '0'); }

export function timestamp() {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}_${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`;
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export function dataUrlToFile(dataUrl, filename) {
  const [meta, b64] = dataUrl.split(',');
  const mime = (meta.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new File([bytes], filename, { type: mime });
}

/* ---------- Environment ---------- */
export const isMobile = () =>
  /Android|iPhone|iPad|iPod|Mobile|Silk/i.test(navigator.userAgent) ||
  (navigator.maxTouchPoints > 1 && /Mac/.test(navigator.userAgent));

export function friendlyCameraError(err) {
  const name = err && err.name ? err.name : '';
  if (name === 'NotAllowedError' || name === 'PermissionDeniedError')
    return 'Camera access was blocked. Click the camera icon in your browser\'s address bar and allow access, then try again.';
  if (name === 'NotFoundError' || name === 'DevicesNotFoundError')
    return 'No camera was found on this device. Connect a webcam and try again.';
  if (name === 'NotReadableError' || name === 'TrackStartError')
    return 'Your camera is busy. Close other apps or tabs that use it (Zoom, Teams, etc.) and try again.';
  if (name === 'OverconstrainedError')
    return 'This camera does not support the requested settings. Trying again with defaults may help.';
  if (name === 'SecurityError' || location.protocol === 'http:' && location.hostname !== 'localhost')
    return 'Camera access needs a secure connection (HTTPS). Please open the site over https://.';
  return 'Could not start the camera. Please reload the page and try again.';
}

/* ---------- FPS meter ---------- */
export class FpsMeter {
  constructor(intervalMs = 700) {
    this.interval = intervalMs;
    this.frames = 0;
    this.last = performance.now();
    this.fps = 0;
  }
  tick(now) {
    this.frames++;
    const dt = now - this.last;
    if (dt >= this.interval) {
      this.fps = Math.round((this.frames / dt) * 1000);
      this.frames = 0;
      this.last = now;
    }
    return this.fps;
  }
}

/* ---------- Canvas helpers ---------- */
export function makeCanvas(w = 1, h = 1) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/** Draw a source (video/canvas) scaled to fit `dest` using "cover" logic. */
export function drawCover(ctx, src, destW, destH, mirror = false) {
  const sw = src.videoWidth || src.width;
  const sh = src.videoHeight || src.height;
  const scale = Math.max(destW / sw, destH / sh);
  const dw = sw * scale;
  const dh = sh * scale;
  const dx = (destW - dw) / 2;
  const dy = (destH - dh) / 2;
  ctx.save();
  if (mirror) { ctx.translate(destW, 0); ctx.scale(-1, 1); }
  ctx.drawImage(src, dx, dy, dw, dh);
  ctx.restore();
}

/** Rounded-rectangle path (with fallback for older browsers). */
export function roundRect(ctx, x, y, w, h, r) {
  if (typeof ctx.roundRect === 'function') {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    return;
  }
  const rad = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + w, y, x + w, y + h, rad);
  ctx.arcTo(x + w, y + h, x, y + h, rad);
  ctx.arcTo(x, y + h, x, y, rad);
  ctx.arcTo(x, y, x + w, y, rad);
  ctx.closePath();
}

/* ---------- Toast ---------- */
let toastEl = null;
let toastTimer = 0;
export function toast(msg, ms = 2200) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    toastEl.setAttribute('role', 'status');
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), ms);
}
