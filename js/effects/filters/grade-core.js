/* WebcamClicks — colour-grading core for the "Trending" effects.
   Everything here is lookup-table based, so a full grade costs a few
   array reads per pixel instead of stacked CSS filters:
     - monotone cubic tone curves  -> Uint8Array(256) LUTs
     - split toning (shadow / highlight tint) baked into per-channel LUTs
     - saturation applied around Rec.709 luma
     - temporally stable film grain (precomputed noise, advanced at 24 fps)
     - a reusable downscaled glow buffer for bloom / halation passes */

import { makeCanvas } from '../../utils.js';

/* ---------------- tone curves ---------------- */

/** Monotone cubic (Fritsch–Carlson) curve through [[x,y], ...] in 0..255. */
export function curveLUT(points) {
  const pts = points.slice().sort((a, b) => a[0] - b[0]);
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = new Array(n - 1);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / Math.max(1e-6, xs[i + 1] - xs[i]);
  const m = new Array(n);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) { m[i] = 0; m[i + 1] = 0; continue; }
    const a = m[i] / d[i];
    const b = m[i + 1] / d[i];
    const s = a * a + b * b;
    if (s > 9) {
      const t = 3 / Math.sqrt(s);
      m[i] = t * a * d[i];
      m[i + 1] = t * b * d[i];
    }
  }
  const lut = new Uint8Array(256);
  let seg = 0;
  for (let x = 0; x < 256; x++) {
    if (x <= xs[0]) { lut[x] = clamp8(ys[0]); continue; }
    if (x >= xs[n - 1]) { lut[x] = clamp8(ys[n - 1]); continue; }
    while (seg < n - 2 && x > xs[seg + 1]) seg++;
    const h = xs[seg + 1] - xs[seg];
    const t = (x - xs[seg]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    const y = (2 * t3 - 3 * t2 + 1) * ys[seg] + (t3 - 2 * t2 + t) * h * m[seg] +
      (-2 * t3 + 3 * t2) * ys[seg + 1] + (t3 - t2) * h * m[seg + 1];
    lut[x] = clamp8(y);
  }
  return lut;
}

function clamp8(v) {
  return v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
}

const IDENTITY = [[0, 0], [255, 255]];

/**
 * Build a grade: per-channel LUTs (master curve -> channel curve -> split tone)
 * plus a saturation factor. Returns a function that grades RGBA data in place.
 *
 * opts = {
 *   master, r, g, b : curve points
 *   shadows    : [r,g,b] tint pushed into the darks
 *   highlights : [r,g,b] tint pushed into the brights
 *   split      : 0..1 strength of the split tone
 *   saturation : 1 = unchanged
 * }
 */
export function makeGrade(opts = {}) {
  const master = curveLUT(opts.master || IDENTITY);
  const ch = [curveLUT(opts.r || IDENTITY), curveLUT(opts.g || IDENTITY), curveLUT(opts.b || IDENTITY)];
  const sh = opts.shadows || [128, 128, 128];
  const hi = opts.highlights || [128, 128, 128];
  const split = opts.split ?? 0;
  const sat = opts.saturation ?? 1;

  const luts = [new Uint8Array(256), new Uint8Array(256), new Uint8Array(256)];
  for (let c = 0; c < 3; c++) {
    for (let x = 0; x < 256; x++) {
      let v = ch[c][master[x]];
      const t = v / 255;
      // Shadow weight peaks in the darks, highlight weight in the brights; both fade at the extremes
      const ws = (1 - t) * (1 - t) * t * 4;
      const wh = t * t * (1 - t) * 4;
      v += split * (ws * (sh[c] - 128) + wh * (hi[c] - 128));
      luts[c][x] = clamp8(v);
    }
  }
  const [lr, lg, lb] = luts;

  return function grade(data) {
    const len = data.length;
    if (sat === 1) {
      for (let i = 0; i < len; i += 4) {
        data[i] = lr[data[i]];
        data[i + 1] = lg[data[i + 1]];
        data[i + 2] = lb[data[i + 2]];
      }
      return;
    }
    for (let i = 0; i < len; i += 4) {
      const r = lr[data[i]];
      const g = lg[data[i + 1]];
      const b = lb[data[i + 2]];
      const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      data[i] = clamp8(y + (r - y) * sat);
      data[i + 1] = clamp8(y + (g - y) * sat);
      data[i + 2] = clamp8(y + (b - y) * sat);
    }
  };
}

/* ---------------- film grain ---------------- */

const NOISE_SIZE = 256;
const NOISE = (() => {
  // Deterministic, roughly gaussian noise (sum of 3 uniforms) — no per-frame Math.random
  const a = new Int8Array(NOISE_SIZE * NOISE_SIZE);
  let s = 0x9e3779b9;
  const rnd = () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296);
  };
  for (let i = 0; i < a.length; i++) a[i] = Math.round(((rnd() + rnd() + rnd()) / 3 - 0.5) * 2 * 127);
  return a;
})();

/** Grain offset that advances at 24 fps, like real film frames. */
export function grainSeed(timeMs) {
  const f = Math.floor((timeMs || 0) / 41.7);
  return { ox: (f * 97) & 255, oy: (f * 57) & 255 };
}

/**
 * Luminance-weighted grain: strongest in the mid-tones, gentle in deep shadows
 * and clipped highlights, just like silver-halide film.
 * amount ≈ 0..40, chroma 0..1 adds colour noise (digital sensor look).
 */
// Mid-tone weighted grain strength per luminance (0.35..1.35, peak at mid grey)
const GRAIN_W = (() => {
  const t = new Float32Array(256);
  for (let l = 0; l < 256; l++) t[l] = (0.35 + (l * (255 - l)) / 16256) / 127;
  return t;
})();

export function applyGrain(data, w, h, timeMs, amount = 12, chroma = 0) {
  const { ox, oy } = grainSeed(timeMs);
  for (let y = 0; y < h; y++) {
    const row = ((y + oy) & 255) * NOISE_SIZE;
    let i = y * w * 4;
    for (let x = 0; x < w; x++, i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const l = (r * 77 + g * 150 + b * 29) >> 8;
      const k = NOISE[row + ((x + ox) & 255)] * amount * GRAIN_W[l];
      if (chroma > 0) {
        const c = amount * chroma * (1 - l / 255) / 127;
        data[i] = r + k + NOISE[row + ((x + ox + 101) & 255)] * c;
        data[i + 1] = g + k;
        data[i + 2] = b + k + NOISE[row + ((x + ox + 37) & 255)] * c;
      } else {
        data[i] = r + k;
        data[i + 1] = g + k;
        data[i + 2] = b + k;
      }
    }
  }
}

/** Run fn(data,w,h) on a downscaled copy of src (max side = maxDim) and draw it back smoothly. */
export function gradePass(fx, src, w, h, maxDim, key, fn) {
  const [sw, sh] = fitDims(w, h, maxDim);
  const buf = workCanvas(key, sw, sh);
  buf.x.imageSmoothingEnabled = true;
  buf.x.drawImage(src, 0, 0, sw, sh);
  const img = buf.x.getImageData(0, 0, sw, sh);
  fn(img.data, sw, sh);
  buf.x.putImageData(img, 0, 0);
  fx.imageSmoothingEnabled = true;
  fx.drawImage(buf.c, 0, 0, sw, sh, 0, 0, w, h);
  return buf.c;
}

/* ---------------- glow / halation buffer ---------------- */

const GLOW = { c: null, x: null };

/**
 * Render a blurred, filtered copy of `src` at 1/scale resolution and composite it.
 * filter: CSS filter for the glow source (e.g. 'brightness(.8) contrast(3) blur(6px)')
 * tint: optional colour multiplied into the glow (for red halation, etc.)
 */
export function glowPass(fx, src, w, h, { filter, alpha = 0.4, op = 'screen', tint = null, scale = 4, rect = null }) {
  const gw = Math.max(2, Math.round((rect ? rect.w : w) / scale));
  const gh = Math.max(2, Math.round((rect ? rect.h : h) / scale));
  if (!GLOW.c) {
    GLOW.c = makeCanvas(gw, gh);
    GLOW.x = GLOW.c.getContext('2d');
  }
  if (GLOW.c.width !== gw || GLOW.c.height !== gh) {
    GLOW.c.width = gw;
    GLOW.c.height = gh;
  }
  const g = GLOW.x;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = 'source-over';
  g.globalAlpha = 1;
  g.clearRect(0, 0, gw, gh);
  g.filter = filter || 'blur(4px)';
  g.drawImage(src, 0, 0, gw, gh);
  g.filter = 'none';
  if (tint) {
    g.globalCompositeOperation = 'multiply';
    g.fillStyle = tint;
    g.fillRect(0, 0, gw, gh);
    g.globalCompositeOperation = 'source-over';
  }
  fx.save();
  fx.globalCompositeOperation = op;
  fx.globalAlpha = alpha;
  fx.imageSmoothingEnabled = true;
  if (rect) fx.drawImage(GLOW.c, 0, 0, gw, gh, rect.x, rect.y, rect.w, rect.h);
  else fx.drawImage(GLOW.c, 0, 0, gw, gh, 0, 0, w, h);
  fx.restore();
}

/** Radial vignette. colour as 'r,g,b'. */
export function vignette(fx, w, h, strength = 0.4, color = '0,0,0', inner = 0.45, op = 'source-over') {
  const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * inner, w / 2, h / 2, Math.hypot(w, h) / 2);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  fx.save();
  fx.globalCompositeOperation = op;
  fx.fillStyle = g;
  fx.fillRect(0, 0, w, h);
  fx.restore();
}

/* ---------------- working buffers ---------------- */

const BUFS = new Map();
/** Reusable offscreen canvas + 2D context per key (never reallocates per frame). */
export function workCanvas(key, w, h) {
  let b = BUFS.get(key);
  if (!b) {
    const c = makeCanvas(w, h);
    b = { c, x: c.getContext('2d', { willReadFrequently: true }) };
    BUFS.set(key, b);
  }
  if (b.c.width !== w || b.c.height !== h) {
    b.c.width = w;
    b.c.height = h;
  }
  b.x.setTransform(1, 0, 0, 1, 0, 0);
  b.x.globalAlpha = 1;
  b.x.globalCompositeOperation = 'source-over';
  b.x.filter = 'none';
  return b;
}

/** Fit (w,h) inside maxDim keeping aspect, rounded to even numbers. */
export function fitDims(w, h, maxDim) {
  const s = Math.min(1, maxDim / Math.max(w, h));
  return [Math.max(2, Math.round((w * s) / 2) * 2), Math.max(2, Math.round((h * s) / 2) * 2)];
}

export { clamp8 };
