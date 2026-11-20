/* WebcamClicks — live background replacement.
   Segments the person in each camera frame on-device (MediaPipe selfie segmenter)
   and composites them over a blurred, recoloured or replaced background.
   The result is an ordinary canvas, so every filter and lens still runs on top. */

import { createTask, personMask, MODELS } from './vision.js';

const BLUR_STEPS = { soft: 10, strong: 20 };
const CAN_FILTER = (() => {
  try { const c = document.createElement('canvas').getContext('2d'); return typeof c.filter === 'string'; }
  catch (_) { return false; }
})();

/* ---------- procedural backdrops (no downloads, any resolution) ---------- */

function radial(ctx, w, h, inner, outer, cx = 0.5, cy = 0.42) {
  const g = ctx.createRadialGradient(w * cx, h * cy, 0, w * cx, h * cy, Math.hypot(w, h) * 0.62);
  g.addColorStop(0, inner);
  g.addColorStop(1, outer);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
}

function bokeh(ctx, w, h, colors, count, seed) {
  let s = seed;
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < count; i++) {
    const r = (0.025 + rnd() * 0.07) * Math.min(w, h);
    const x = rnd() * w, y = rnd() * h;
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const c = colors[i % colors.length];
    g.addColorStop(0, c.replace('A', String(0.55 + rnd() * 0.3)));
    g.addColorStop(0.7, c.replace('A', '0.18'));
    g.addColorStop(1, c.replace('A', '0'));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function noise(ctx, w, h, amount) {
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (Math.random() - 0.5) * amount;
    d[i] += n; d[i + 1] += n; d[i + 2] += n;
  }
  ctx.putImageData(img, 0, 0);
}

export const BACKDROPS = [
  { id: 'off', name: 'Off', kind: 'off', swatch: 'linear-gradient(135deg,#e5e7eb,#f9fafb)' },
  { id: 'blur', name: 'Blur', kind: 'blur', level: 'soft', swatch: 'radial-gradient(circle,#cbd5e1,#94a3b8)' },
  { id: 'blur-strong', name: 'Strong blur', kind: 'blur', level: 'strong', swatch: 'radial-gradient(circle,#94a3b8,#475569)' },
  { id: 'colorpop', name: 'Colour pop', kind: 'colorpop', swatch: 'linear-gradient(90deg,#6b7280 50%,#ff4d2e 50%)' },
  { id: 'studio-white', name: 'White studio', kind: 'paint', swatch: '#ffffff',
    paint: (c, w, h) => { radial(c, w, h, '#ffffff', '#e9eaee'); } },
  { id: 'studio-grey', name: 'Grey studio', kind: 'paint', swatch: 'radial-gradient(circle,#8b8f98,#3b3e45)',
    paint: (c, w, h) => { radial(c, w, h, '#8f939c', '#33363c'); noise(c, w, h, 10); } },
  { id: 'warm-bokeh', name: 'Warm lights', kind: 'paint', swatch: 'radial-gradient(circle,#f59e0b,#3b1d0a)',
    paint: (c, w, h) => { radial(c, w, h, '#4a2a12', '#140904'); bokeh(c, w, h, ['rgba(255,190,90,A)', 'rgba(255,140,60,A)', 'rgba(255,230,170,A)'], 46, 7); } },
  { id: 'neon-city', name: 'Neon night', kind: 'paint', swatch: 'radial-gradient(circle,#7c3aed,#0b0620)',
    paint: (c, w, h) => { radial(c, w, h, '#2a1052', '#07040f', 0.5, 0.7); bokeh(c, w, h, ['rgba(255,60,170,A)', 'rgba(60,200,255,A)', 'rgba(150,90,255,A)'], 52, 13); } },
  { id: 'sunset', name: 'Sunset', kind: 'paint', swatch: 'linear-gradient(180deg,#ff7a59,#ffd36e)',
    paint: (c, w, h) => {
      const g = c.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, '#3b2a6b'); g.addColorStop(0.45, '#ff6f61'); g.addColorStop(0.75, '#ffb36b'); g.addColorStop(1, '#ffe2a8');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      radial(c, w, h, 'rgba(255,240,200,0.55)', 'rgba(255,240,200,0)', 0.5, 0.72);
    } },
  { id: 'ocean', name: 'Ocean', kind: 'paint', swatch: 'linear-gradient(180deg,#0ea5e9,#0f766e)',
    paint: (c, w, h) => {
      const g = c.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, '#0ea5e9'); g.addColorStop(1, '#064e3b');
      c.fillStyle = g; c.fillRect(0, 0, w, h);
      bokeh(c, w, h, ['rgba(180,240,255,A)'], 18, 21);
    } },
  { id: 'color', name: 'Colour', kind: 'color', swatch: 'conic-gradient(#ff4d2e,#facc15,#22c55e,#3b82f6,#a855f7,#ff4d2e)' },
  { id: 'upload', name: 'Your photo', kind: 'image', swatch: 'linear-gradient(135deg,#0e0e12,#5b5f6b)' }
];

/* ---------------------------------------------------------------------------- */

export class BackgroundReplacer {
  constructor() {
    this.backdrop = BACKDROPS[0];
    this.color = '#2563eb';
    this.image = null;
    this.status = 'idle';          // idle | loading | ready | error
    this.onStatus = null;

    this._segmenter = null;
    this._loading = null;
    this._lastTs = 0;
    this._mask = null;             // smoothed Float32Array at model resolution
    this._mw = 0; this._mh = 0;
    this._maskCanvas = document.createElement('canvas');
    this._maskCtx = this._maskCanvas.getContext('2d');
    this._maskImg = null;
    this._person = document.createElement('canvas');
    this._personCtx = this._person.getContext('2d');
    this._out = document.createElement('canvas');
    this._outCtx = this._out.getContext('2d');
    this._bg = document.createElement('canvas');
    this._bgCtx = this._bg.getContext('2d');
    this._bgKey = '';
    this._small = document.createElement('canvas');
    this._smallCtx = this._small.getContext('2d');
  }

  get active() { return this.backdrop.kind !== 'off'; }

  setStatus(s) {
    this.status = s;
    if (this.onStatus) this.onStatus(s);
  }

  async ensureLoaded() {
    if (this._segmenter) return true;
    if (!this._loading) {
      this.setStatus('loading');
      this._loading = createTask('ImageSegmenter', {
        baseOptions: { modelAssetPath: MODELS.segmenterLandscape },
        runningMode: 'VIDEO',
        outputConfidenceMasks: true,
        outputCategoryMask: false
      }).then((seg) => {
        this._segmenter = seg;
        this.setStatus('ready');
        return true;
      }).catch((err) => {
        console.warn('[WebcamClicks] background segmentation failed to load:', err);
        this._loading = null;
        this.setStatus('error');
        return false;
      });
    }
    return this._loading;
  }

  setBackdrop(id) {
    const b = BACKDROPS.find((x) => x.id === id) || BACKDROPS[0];
    this.backdrop = b;
    this._bgKey = '';
    if (b.kind !== 'off') this.ensureLoaded();
  }

  setColor(hex) { this.color = hex; this._bgKey = ''; }

  setImage(img) { this.image = img; this._bgKey = ''; }

  /** Returns a composited canvas, or the original source if inactive / not ready yet. */
  apply(src, nowMs) {
    if (!src || !this.active || !this._segmenter) return src;
    const w = src.width, h = src.height;
    if (!w || !h) return src;

    // MediaPipe needs strictly increasing timestamps
    const ts = Math.max(this._lastTs + 1, Math.round(nowMs));
    this._lastTs = ts;
    let result;
    try {
      result = this._segmenter.segmentForVideo(src, ts);
    } catch (err) {
      console.warn('[WebcamClicks] segmentation error:', err);
      return src;
    }
    const m = personMask(result);
    if (m) this._updateMask(m);
    if (result && result.close) result.close();
    if (!this._mask) return src;

    for (const c of [this._person, this._out]) {
      if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    }

    // 1) person layer = source masked by the upscaled, feathered mask
    const pc = this._personCtx;
    pc.globalCompositeOperation = 'source-over';
    pc.clearRect(0, 0, w, h);
    pc.drawImage(src, 0, 0, w, h);
    pc.globalCompositeOperation = 'destination-in';
    pc.imageSmoothingEnabled = true;
    pc.imageSmoothingQuality = 'high';
    pc.drawImage(this._upscaledMask(), 0, 0, w, h);
    pc.globalCompositeOperation = 'source-over';

    // 2) background
    const oc = this._outCtx;
    this._drawBackground(oc, src, w, h);

    // 3) person on top
    oc.drawImage(this._person, 0, 0);
    return this._out;
  }

  _updateMask(mpMask) {
    const mw = mpMask.width, mh = mpMask.height;
    const data = mpMask.getAsFloat32Array();
    if (!this._mask || this._mw !== mw || this._mh !== mh) {
      this._mask = new Float32Array(data);
      this._mw = mw; this._mh = mh;
      this._maskCanvas.width = mw; this._maskCanvas.height = mh;
      this._maskImg = this._maskCtx.createImageData(mw, mh);
    }
    const sm = this._mask;
    if (!this._alpha || this._alpha.length !== sm.length) { this._alpha = new Float32Array(sm.length); this._tmp = new Float32Array(sm.length); }
    const al = this._alpha, tmp = this._tmp;
    for (let i = 0; i < sm.length; i++) {
      // temporal smoothing: react fast to the person entering, slower when leaving (less flicker)
      const v = data[i];
      sm[i] += (v - sm[i]) * (v > sm[i] ? 0.7 : 0.45);
      // soft threshold keeps hair edges natural while removing background haze
      let a = (sm[i] - 0.28) / 0.5;
      a = a < 0 ? 0 : a > 1 ? 1 : a;
      al[i] = a * a * (3 - 2 * a);
    }
    // separable 3-tap blur feathers the edge so it doesn't stair-step when enlarged
    for (let y = 0; y < mh; y++) {
      const r = y * mw;
      for (let x = 0; x < mw; x++) {
        const l = x > 0 ? al[r + x - 1] : al[r + x], c = al[r + x], rr = x < mw - 1 ? al[r + x + 1] : c;
        tmp[r + x] = (l + 2 * c + rr) * 0.25;
      }
    }
    const px = this._maskImg.data;
    for (let y = 0; y < mh; y++) {
      for (let x = 0; x < mw; x++) {
        const i = y * mw + x;
        const u = y > 0 ? tmp[i - mw] : tmp[i], d = y < mh - 1 ? tmp[i + mw] : tmp[i];
        const o = i * 4;
        px[o] = 255; px[o + 1] = 255; px[o + 2] = 255; px[o + 3] = ((u + 2 * tmp[i] + d) * 0.25) * 255;
      }
    }
    this._maskCtx.putImageData(this._maskImg, 0, 0);
    if (mpMask.close) mpMask.close();
  }

  _upscaledMask() {
    // bilinear 4x first, then the final stretch: noticeably smoother edges than one big jump
    const mw = this._mw * 4, mh = this._mh * 4;
    const c = this._mask4 || (this._mask4 = document.createElement('canvas'));
    if (c.width !== mw || c.height !== mh) { c.width = mw; c.height = mh; this._mask4Ctx = c.getContext('2d'); }
    const g = this._mask4Ctx;
    g.clearRect(0, 0, mw, mh);
    g.imageSmoothingEnabled = true;
    g.imageSmoothingQuality = 'high';
    g.drawImage(this._maskCanvas, 0, 0, mw, mh);
    return c;
  }

  _blurInto(ctx, src, w, h, factor) {
    // Downscale/upscale blur: fast everywhere, including browsers without ctx.filter
    const sw = Math.max(8, Math.round(w / factor)), sh = Math.max(8, Math.round(h / factor));
    if (this._small.width !== sw || this._small.height !== sh) { this._small.width = sw; this._small.height = sh; }
    const s = this._smallCtx;
    s.imageSmoothingEnabled = true;
    s.imageSmoothingQuality = 'high';
    s.drawImage(src, 0, 0, sw, sh);
    s.drawImage(this._small, 0, 0, sw, sh, 1, 1, sw - 2, sh - 2);   // extra soften
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(this._small, 0, 0, w, h);
  }

  _drawBackground(ctx, src, w, h) {
    const b = this.backdrop;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    if (b.kind === 'blur') {
      this._blurInto(ctx, src, w, h, BLUR_STEPS[b.level] || 10);
      return;
    }
    if (b.kind === 'colorpop') {
      if (CAN_FILTER) {
        ctx.filter = 'grayscale(1) brightness(0.92)';
        ctx.drawImage(src, 0, 0, w, h);
        ctx.filter = 'none';
        return;
      }
      ctx.drawImage(src, 0, 0, w, h);
      const img = ctx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
        d[i] = d[i + 1] = d[i + 2] = l * 0.92;
      }
      ctx.putImageData(img, 0, 0);
      return;
    }
    // static backdrops are rendered once per size/choice and cached
    const key = `${b.id}|${w}x${h}|${this.color}|${this.image ? this.image.src || 'img' : ''}`;
    if (key !== this._bgKey) {
      if (this._bg.width !== w || this._bg.height !== h) { this._bg.width = w; this._bg.height = h; }
      const g = this._bgCtx;
      g.clearRect(0, 0, w, h);
      if (b.kind === 'paint') b.paint(g, w, h);
      else if (b.kind === 'color') { g.fillStyle = this.color; g.fillRect(0, 0, w, h); radial(g, w, h, 'rgba(255,255,255,0.18)', 'rgba(0,0,0,0.18)'); }
      else if (b.kind === 'image' && this.image) drawCover(g, this.image, w, h);
      else { g.fillStyle = '#e9eaee'; g.fillRect(0, 0, w, h); }
      this._bgKey = key;
    }
    ctx.drawImage(this._bg, 0, 0);
  }
}

export function drawCover(ctx, img, w, h) {
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const s = Math.max(w / iw, h / ih);
  const dw = iw * s, dh = ih * s;
  ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
}
