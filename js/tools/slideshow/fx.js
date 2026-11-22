/* WebcamClicks — slideshow effects: colour looks (baked once per photo), transitions, animated overlays,
   particles and text styles. Pure canvas 2D, so preview, full screen and export look identical. */

/* ------------------------------------------------------------------ helpers */
export function rng(seed) { let a = seed >>> 0 || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const hash = (n) => { const r = rng(Math.floor(n * 9973) + 7); return r(); };
export const ease = (q) => (q < 0.5 ? 4 * q * q * q : 1 - (-2 * q + 2) ** 3 / 2);
const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
export function mkCanvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }

/* ------------------------------------------------------------------ colour looks (per pixel, baked once per photo) */
// sat, con(trast), bri(ghtness), temp (+warm/−cool), tint (+magenta/−green), fade (lift blacks), sh/hi: shadow/highlight tint [r,g,b] strength, gray, sepia, duo: [dark, light]
export const LOOKS = {
  none: { name: 'Original' },
  vivid: { name: 'Vivid', sat: 1.35, con: 1.1 },
  warm: { name: 'Warm', temp: 18, sat: 1.1 },
  cool: { name: 'Cool', temp: -18, tint: -4 },
  golden: { name: 'Golden hour', temp: 26, sat: 1.15, bri: 6, hi: [255, 200, 120, 0.12] },
  film: { name: 'Film', con: 1.08, fade: 18, sat: 0.92, sh: [20, 40, 60, 0.12], hi: [255, 230, 190, 0.1] },
  cinematic: { name: 'Cinematic', con: 1.12, sat: 0.95, sh: [0, 90, 110, 0.28], hi: [255, 170, 90, 0.18] },
  vintage: { name: 'Vintage', sepia: 0.35, fade: 26, con: 0.95, sat: 0.85, temp: 10 },
  faded: { name: 'Faded matte', fade: 38, con: 0.9, sat: 0.8 },
  moody: { name: 'Moody', bri: -10, con: 1.15, sat: 0.7, sh: [30, 40, 60, 0.2] },
  pastel: { name: 'Pastel', bri: 12, con: 0.85, sat: 0.75, fade: 20, tint: 6 },
  rose: { name: 'Rose', tint: 14, temp: 6, hi: [255, 190, 210, 0.15] },
  bw: { name: 'Black & white', gray: 1, con: 1.12 },
  noir: { name: 'Noir', gray: 1, con: 1.45, bri: -8 },
  sepia: { name: 'Sepia', sepia: 1, con: 1.05 },
  duo: { name: 'Duotone', duo: [[40, 20, 110], [255, 120, 170]] },
  cross: { name: 'Cross process', con: 1.15, sat: 1.25, sh: [0, 60, 120, 0.2], hi: [255, 240, 120, 0.2], tint: -6 }
};
export function bakeLook(img, key, maxSide = 2048) {
  const L = LOOKS[key] || LOOKS.none;
  const k = Math.min(1, maxSide / Math.max(img.width, img.height));
  const c = mkCanvas(img.width * k, img.height * k), g = c.getContext('2d', { willReadFrequently: key !== 'none' });
  g.imageSmoothingQuality = 'high'; g.drawImage(img, 0, 0, c.width, c.height);
  if (key === 'none') return c;
  // a 256-entry curve per channel + per-pixel saturation/toning
  const curve = new Float32Array(256), con = L.con || 1, bri = L.bri || 0, fade = L.fade || 0;
  for (let v = 0; v < 256; v++) { let x = (v - 128) * con + 128 + bri; x = fade + x * (1 - fade / 255); curve[v] = x; }
  const id = g.getImageData(0, 0, c.width, c.height), d = id.data;
  const sat = L.sat ?? 1, temp = L.temp || 0, tint = L.tint || 0, gray = L.gray || 0, sep = L.sepia || 0, sh = L.sh, hi = L.hi, duo = L.duo;
  for (let i = 0; i < d.length; i += 4) {
    let r = curve[d[i]], gg = curve[d[i + 1]], b = curve[d[i + 2]];
    r += temp; b -= temp; gg -= tint; r += tint * 0.3; b += tint * 0.3;
    const lum = 0.299 * r + 0.587 * gg + 0.114 * b;
    if (sat !== 1) { r = lum + (r - lum) * sat; gg = lum + (gg - lum) * sat; b = lum + (b - lum) * sat; }
    if (gray) { r = gg = b = lum; }
    if (sep) { const sr = lum * 1.07 + 20, sg = lum * 0.95 + 8, sb = lum * 0.78; r += (sr - r) * sep; gg += (sg - gg) * sep; b += (sb - b) * sep; }
    if (duo) { const t = clamp(lum / 255); r = duo[0][0] + (duo[1][0] - duo[0][0]) * t; gg = duo[0][1] + (duo[1][1] - duo[0][1]) * t; b = duo[0][2] + (duo[1][2] - duo[0][2]) * t; }
    if (sh) { const w = clamp(1 - lum / 140) * sh[3]; r += (sh[0] - r) * w; gg += (sh[1] - gg) * w; b += (sh[2] - b) * w; }
    if (hi) { const w = clamp((lum - 120) / 135) * hi[3]; r += (hi[0] - r) * w; gg += (hi[1] - gg) * w; b += (hi[2] - b) * w; }
    d[i] = r; d[i + 1] = gg; d[i + 2] = b;   // Uint8ClampedArray clamps
  }
  g.putImageData(id, 0, 0);
  return c;
}

/* ------------------------------------------------------------------ transitions */
// each: (g, A, B, e, W, H, q) — A = outgoing frame canvas, B = incoming, e = eased progress, q = raw progress
const shapeClip = (g, A, B, path) => { g.drawImage(A, 0, 0); g.save(); g.beginPath(); path(); g.clip(); g.drawImage(B, 0, 0); g.restore(); };
function heartPath(g, cx, cy, s) { g.moveTo(cx, cy + s * 0.35); g.bezierCurveTo(cx - s * 1.1, cy - s * 0.35, cx - s * 0.45, cy - s * 1.05, cx, cy - s * 0.45); g.bezierCurveTo(cx + s * 0.45, cy - s * 1.05, cx + s * 1.1, cy - s * 0.35, cx, cy + s * 0.35); }
const slide = (dx, dy) => (g, A, B, e, W, H) => { g.drawImage(A, 0, 0); g.drawImage(B, dx * W * (1 - e), dy * H * (1 - e)); };
const push = (dx, dy) => (g, A, B, e, W, H) => { g.drawImage(A, -dx * W * e, -dy * H * e); g.drawImage(B, dx * W * (1 - e), dy * H * (1 - e)); };
const wipe = (dir) => (g, A, B, e, W, H) => shapeClip(g, A, B, () => (dir === 'l' ? g.rect(W * (1 - e), 0, W * e, H) : dir === 'r' ? g.rect(0, 0, W * e, H) : dir === 'u' ? g.rect(0, H * (1 - e), W, H * e) : g.rect(0, 0, W, H * e)));
let pixA = null;
export const TRANSITIONS = {
  fade: { name: 'Crossfade', f: (g, A, B, e) => { g.drawImage(A, 0, 0); g.globalAlpha = e; g.drawImage(B, 0, 0); g.globalAlpha = 1; } },
  black: { name: 'Fade through black', f: (g, A, B, e, W, H, q) => { g.drawImage(q < 0.5 ? A : B, 0, 0); g.fillStyle = `rgba(0,0,0,${1 - Math.abs(q * 2 - 1)})`; g.fillRect(0, 0, W, H); } },
  white: { name: 'Fade through white', f: (g, A, B, e, W, H, q) => { g.drawImage(q < 0.5 ? A : B, 0, 0); g.fillStyle = `rgba(255,255,255,${1 - Math.abs(q * 2 - 1)})`; g.fillRect(0, 0, W, H); } },
  flash: { name: 'Flash', f: (g, A, B, e, W, H, q) => { g.drawImage(q < 0.5 ? A : B, 0, 0); g.fillStyle = `rgba(255,255,255,${Math.max(0, 1 - Math.abs(q - 0.5) * 4)})`; g.fillRect(0, 0, W, H); } },
  slideL: { name: 'Slide left', f: slide(1, 0) }, slideR: { name: 'Slide right', f: slide(-1, 0) }, slideU: { name: 'Slide up', f: slide(0, 1) }, slideD: { name: 'Slide down', f: slide(0, -1) },
  pushL: { name: 'Push left', f: push(1, 0) }, pushR: { name: 'Push right', f: push(-1, 0) }, pushU: { name: 'Push up', f: push(0, 1) }, pushD: { name: 'Push down', f: push(0, -1) },
  wipeL: { name: 'Wipe left', f: wipe('l') }, wipeR: { name: 'Wipe right', f: wipe('r') }, wipeU: { name: 'Wipe up', f: wipe('u') }, wipeD: { name: 'Wipe down', f: wipe('d') },
  zoomIn: { name: 'Zoom in', f: (g, A, B, e, W, H) => { g.save(); g.translate(W / 2, H / 2); g.scale(1 + e * 0.6, 1 + e * 0.6); g.globalAlpha = 1 - e; g.drawImage(A, -W / 2, -H / 2); g.restore(); g.save(); g.globalAlpha = e; g.translate(W / 2, H / 2); g.scale(0.7 + 0.3 * e, 0.7 + 0.3 * e); g.drawImage(B, -W / 2, -H / 2); g.restore(); } },
  zoomOut: { name: 'Zoom out', f: (g, A, B, e, W, H) => { g.drawImage(A, 0, 0); g.save(); g.globalAlpha = e; g.translate(W / 2, H / 2); g.scale(1.6 - 0.6 * e, 1.6 - 0.6 * e); g.drawImage(B, -W / 2, -H / 2); g.restore(); } },
  circle: { name: 'Circle reveal', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => g.arc(W / 2, H / 2, e * Math.hypot(W, H) / 2, 0, Math.PI * 2)) },
  diamond: { name: 'Diamond', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => { const r = e * (W + H) / 2; g.moveTo(W / 2, H / 2 - r); g.lineTo(W / 2 + r, H / 2); g.lineTo(W / 2, H / 2 + r); g.lineTo(W / 2 - r, H / 2); g.closePath(); }) },
  heart: { name: 'Heart', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => heartPath(g, W / 2, H / 2 + Math.max(W, H) * 0.08 * e, e * Math.max(W, H) * 1.3)) },
  clock: { name: 'Clock wipe', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => { g.moveTo(W / 2, H / 2); g.arc(W / 2, H / 2, Math.hypot(W, H), -Math.PI / 2, -Math.PI / 2 + e * Math.PI * 2); g.closePath(); }) },
  blindsH: { name: 'Blinds', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => { const n = 8, h = H / n; for (let i = 0; i < n; i++) g.rect(0, i * h, W, h * e); }) },
  blindsV: { name: 'Vertical blinds', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => { const n = 8, w = W / n; for (let i = 0; i < n; i++) g.rect(i * w, 0, w * e, H); }) },
  checker: { name: 'Checkerboard', f: (g, A, B, e, W, H) => shapeClip(g, A, B, () => { const n = 6, cw = W / n, ch = H / Math.round(n * H / W); for (let y = 0; y < H; y += ch) for (let x = 0; x < W; x += cw) { const d = ((x / W) + (y / H)) / 2, p = clamp((e * 1.6) - d * 0.6); if (p > 0) g.rect(x + cw * (1 - p) / 2, y + ch * (1 - p) / 2, cw * p, ch * p); } }) },
  doors: { name: 'Doors open', f: (g, A, B, e, W, H) => { g.drawImage(B, 0, 0); g.save(); g.beginPath(); g.rect(0, 0, W / 2, H); g.clip(); g.drawImage(A, -W / 2 * e, 0); g.restore(); g.save(); g.beginPath(); g.rect(W / 2, 0, W / 2, H); g.clip(); g.drawImage(A, W / 2 * e, 0); g.restore(); } },
  flip: { name: 'Flip', f: (g, A, B, e, W, H, q) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const s = Math.abs(Math.cos(q * Math.PI)); g.save(); g.translate(W / 2, 0); g.scale(Math.max(0.001, s), 1); g.drawImage(q < 0.5 ? A : B, -W / 2, 0); g.restore(); } },
  cube: { name: 'Cube', f: (g, A, B, e, W, H) => { g.fillStyle = '#000'; g.fillRect(0, 0, W, H); const k = 1 - 0.12 * Math.sin(e * Math.PI); g.save(); g.translate(0, H * (1 - k) / 2); g.drawImage(A, 0, 0, W, H, -W * e, 0, W * (1 - e) + 1, H * k); g.drawImage(B, 0, 0, W, H, W * (1 - e), 0, W * e + 1, H * k); g.restore(); } },
  spin: { name: 'Spin', f: (g, A, B, e, W, H) => { g.drawImage(A, 0, 0); g.save(); g.globalAlpha = clamp(e * 1.6); g.translate(W / 2, H / 2); g.rotate((1 - e) * -Math.PI / 2); g.scale(0.3 + 0.7 * e, 0.3 + 0.7 * e); g.drawImage(B, -W / 2, -H / 2); g.restore(); } },
  whip: { name: 'Whip pan', f: (g, A, B, e, W, H, q) => { const b = Math.round(Math.sin(q * Math.PI) * W * 0.02); g.save(); if (b > 1) g.filter = `blur(${b}px)`; g.drawImage(A, -W * e, 0); g.drawImage(B, W * (1 - e), 0); g.restore(); } },
  blur: { name: 'Blur dissolve', f: (g, A, B, e, W, H, q) => { const b = Math.round(Math.sin(q * Math.PI) * Math.max(W, H) * 0.02); g.save(); if (b > 1) g.filter = `blur(${b}px)`; g.drawImage(A, 0, 0); g.globalAlpha = e; g.drawImage(B, 0, 0); g.restore(); } },
  pixel: { name: 'Pixelate', f: (g, A, B, e, W, H, q) => { const s = Math.max(1, Math.round((1 - Math.abs(q * 2 - 1)) * 48)); const sw = Math.max(1, Math.round(W / s)), sh = Math.max(1, Math.round(H / s)); pixA = pixA && pixA.width === sw && pixA.height === sh ? pixA : mkCanvas(sw, sh); const pg = pixA.getContext('2d'); pg.drawImage(q < 0.5 ? A : B, 0, 0, sw, sh); g.save(); g.imageSmoothingEnabled = false; g.drawImage(pixA, 0, 0, W, H); g.restore(); } },
  glitch: { name: 'Glitch', f: (g, A, B, e, W, H, q) => { const src = q < 0.5 ? A : B, amp = Math.sin(q * Math.PI); g.drawImage(src, 0, 0); const r = rng(Math.floor(q * 24) + 3), n = 10; for (let i = 0; i < n; i++) { const y = r() * H, h = r() * H * 0.08, dx = (r() - 0.5) * W * 0.2 * amp; g.drawImage(r() < 0.5 ? A : B, 0, y, W, h, dx, y, W, h); } g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.35 * amp; g.drawImage(src, W * 0.012 * amp, 0); g.fillStyle = 'rgba(255,0,80,.12)'; g.fillRect(0, 0, W, H); g.restore(); } },
  burn: { name: 'Film burn', f: (g, A, B, e, W, H, q) => { g.drawImage(A, 0, 0); g.globalAlpha = e; g.drawImage(B, 0, 0); g.globalAlpha = 1; const a = Math.sin(q * Math.PI); g.save(); g.globalCompositeOperation = 'screen'; const gr = g.createRadialGradient(W * (0.2 + 0.6 * q), H * 0.4, 0, W * (0.2 + 0.6 * q), H * 0.4, Math.max(W, H) * 0.9); gr.addColorStop(0, `rgba(255,220,150,${a})`); gr.addColorStop(0.4, `rgba(255,110,40,${a * 0.8})`); gr.addColorStop(1, 'rgba(120,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); } },
  drop: { name: 'Card drop', f: (g, A, B, e, W, H) => { g.drawImage(A, 0, 0); g.fillStyle = `rgba(0,0,0,${0.4 * e})`; g.fillRect(0, 0, W, H); g.save(); const s = 1.15 - 0.15 * e; g.translate(W / 2, H / 2 - H * (1 - e) * 0.6); g.scale(s, s); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = W * 0.05; g.globalAlpha = clamp(e * 2); g.drawImage(B, -W / 2, -H / 2); g.restore(); } },
  cut: { name: 'Cut (none)', f: (g, A, B) => { g.drawImage(B, 0, 0); } }
};
export const TRANSITION_GROUPS = [['Smooth', ['fade', 'black', 'white', 'blur', 'zoomIn', 'zoomOut']], ['Movement', ['slideL', 'slideR', 'slideU', 'slideD', 'pushL', 'pushR', 'pushU', 'pushD', 'whip', 'spin', 'drop', 'cube', 'flip']],
  ['Shapes', ['wipeL', 'wipeR', 'wipeU', 'wipeD', 'circle', 'diamond', 'heart', 'clock', 'blindsH', 'blindsV', 'checker', 'doors']], ['Energetic', ['flash', 'glitch', 'pixel', 'burn']], ['None', ['cut']]];

/* ------------------------------------------------------------------ overlays & particles (drawn on top of every frame) */
let grain = null, lines = null;
function grainTex() { if (grain) return grain; grain = mkCanvas(256, 256); const g = grain.getContext('2d'), id = g.createImageData(256, 256); for (let i = 0; i < id.data.length; i += 4) { const v = Math.random() * 255; id.data[i] = id.data[i + 1] = id.data[i + 2] = v; id.data[i + 3] = 255; } g.putImageData(id, 0, 0); return grain; }
function linesTex() { if (lines) return lines; lines = mkCanvas(4, 4); const g = lines.getContext('2d'); g.fillStyle = 'rgba(0,0,0,.28)'; g.fillRect(0, 0, 4, 1); g.fillRect(0, 2, 4, 1); return lines; }
function particles(g, kind, t, W, H) {
  const base = Math.min(W, H), N = { snow: 70, confetti: 60, hearts: 26, sparkles: 40, bubbles: 24, petals: 30, bokeh: 18 }[kind] || 30;
  const r = rng({ snow: 11, confetti: 23, hearts: 37, sparkles: 41, bubbles: 53, petals: 67, bokeh: 79 }[kind] || 5);
  const COLS = ['#ff4d6d', '#ffd166', '#06d6a0', '#118ab2', '#9b5de5', '#f15bb5', '#fee440'];
  g.save();
  for (let i = 0; i < N; i++) {
    const x0 = r(), y0 = r(), sp = 0.4 + r() * 0.8, sz = r(), ph = r() * 10, col = COLS[Math.floor(r() * COLS.length)];
    if (kind === 'snow') { const y = ((y0 + t * 0.06 * sp) % 1.1) - 0.05, x = x0 + Math.sin(t * 0.8 + ph) * 0.02; g.fillStyle = `rgba(255,255,255,${0.5 + sz * 0.5})`; g.beginPath(); g.arc(x * W, y * H, base * (0.003 + sz * 0.007), 0, Math.PI * 2); g.fill(); }
    else if (kind === 'confetti') { const y = ((y0 + t * 0.12 * sp) % 1.1) - 0.05, x = x0 + Math.sin(t * 1.5 + ph) * 0.03; g.save(); g.translate(x * W, y * H); g.rotate(t * 3 * sp + ph); g.scale(1, Math.cos(t * 4 + ph)); g.fillStyle = col; g.fillRect(-base * 0.008, -base * 0.004, base * 0.016, base * 0.008); g.restore(); }
    else if (kind === 'hearts') { const y = 1.05 - ((y0 + t * 0.05 * sp) % 1.1), x = x0 + Math.sin(t + ph) * 0.03, s = base * (0.012 + sz * 0.02); g.globalAlpha = 0.55 + 0.35 * sz; g.fillStyle = ['#ff4d6d', '#ff8fab', '#ffb3c6', '#ff0054'][i % 4]; g.beginPath(); heartPath(g, x * W, y * H, s); g.fill(); g.globalAlpha = 1; }
    else if (kind === 'sparkles') { const a = Math.max(0, Math.sin(t * 2.4 * sp + ph)); if (a < 0.05) continue; const s = base * (0.006 + sz * 0.014) * a; g.fillStyle = `rgba(255,248,220,${a})`; g.beginPath(); const x = x0 * W, y = y0 * H; g.moveTo(x, y - s * 2); g.quadraticCurveTo(x, y, x + s * 2, y); g.quadraticCurveTo(x, y, x, y + s * 2); g.quadraticCurveTo(x, y, x - s * 2, y); g.quadraticCurveTo(x, y, x, y - s * 2); g.fill(); }
    else if (kind === 'bubbles') { const y = 1.05 - ((y0 + t * 0.06 * sp) % 1.1), x = x0 + Math.sin(t * 0.9 + ph) * 0.02, s = base * (0.01 + sz * 0.03); g.strokeStyle = 'rgba(255,255,255,.6)'; g.lineWidth = Math.max(1, base * 0.0025); g.beginPath(); g.arc(x * W, y * H, s, 0, Math.PI * 2); g.stroke(); g.fillStyle = 'rgba(255,255,255,.18)'; g.beginPath(); g.arc(x * W - s * 0.35, y * H - s * 0.35, s * 0.25, 0, Math.PI * 2); g.fill(); }
    else if (kind === 'petals') { const y = ((y0 + t * 0.07 * sp) % 1.1) - 0.05, x = x0 + Math.sin(t * 1.1 + ph) * 0.05; g.save(); g.translate(x * W, y * H); g.rotate(t * 1.5 + ph); g.fillStyle = `rgba(255,${150 + Math.floor(sz * 60)},${180 + Math.floor(sz * 40)},.85)`; g.beginPath(); g.ellipse(0, 0, base * 0.012, base * 0.006, 0, 0, Math.PI * 2); g.fill(); g.restore(); }
    else if (kind === 'bokeh') { const x = (x0 + t * 0.01 * sp) % 1, y = y0 + Math.sin(t * 0.3 + ph) * 0.02, s = base * (0.03 + sz * 0.07); const gr = g.createRadialGradient(x * W, y * H, 0, x * W, y * H, s); gr.addColorStop(0, `rgba(255,${200 + Math.floor(sz * 55)},150,.35)`); gr.addColorStop(1, 'rgba(255,200,150,0)'); g.globalCompositeOperation = 'screen'; g.fillStyle = gr; g.fillRect(x * W - s, y * H - s, s * 2, s * 2); g.globalCompositeOperation = 'source-over'; }
  }
  g.restore();
}
export const OVERLAYS = { grain: 'Film grain', vignette: 'Vignette', leaks: 'Light leaks', bars: 'Cinematic bars', vhs: 'VHS', dust: 'Dust & scratches', snow: 'Snow', confetti: 'Confetti', hearts: 'Hearts', sparkles: 'Sparkles', bubbles: 'Bubbles', petals: 'Petals', bokeh: 'Bokeh lights' };
export function drawOverlays(g, set, t, W, H, frame) {
  const base = Math.min(W, H);
  if (set.has('leaks')) {
    g.save(); g.globalCompositeOperation = 'screen';
    for (let k = 0; k < 2; k++) { const x = W * (0.5 + 0.5 * Math.sin(t * 0.23 + k * 2.1)), y = H * (0.3 + 0.4 * Math.cos(t * 0.17 + k)), a = 0.22 + 0.18 * Math.sin(t * 0.6 + k * 3), r = Math.max(W, H) * 0.6;
      const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, k ? `rgba(255,80,120,${a})` : `rgba(255,170,60,${a})`); gr.addColorStop(1, 'rgba(255,100,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); }
    g.restore();
  }
  for (const p of ['snow', 'confetti', 'hearts', 'sparkles', 'bubbles', 'petals', 'bokeh']) if (set.has(p)) particles(g, p, t, W, H);
  if (set.has('vhs')) {
    g.save(); g.globalCompositeOperation = 'screen'; g.globalAlpha = 0.25; g.drawImage(g.canvas, base * 0.006, 0); g.restore();
    g.save(); g.fillStyle = g.createPattern(linesTex(), 'repeat'); g.fillRect(0, 0, W, H);
    const by = ((t * 0.35) % 1.2 - 0.1) * H; g.fillStyle = 'rgba(255,255,255,.06)'; g.fillRect(0, by, W, base * 0.03);
    g.fillStyle = 'rgba(255,255,255,.85)'; g.font = `600 ${Math.round(base * 0.035)}px "Space Mono", monospace`; g.textBaseline = 'top';
    g.fillText(`PLAY ▶  ${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`, base * 0.05, base * 0.05); g.restore();
  }
  if (set.has('dust')) {
    const r = rng(frame * 7 + 1); g.save(); g.fillStyle = 'rgba(255,255,255,.5)'; g.strokeStyle = 'rgba(255,255,255,.25)'; g.lineWidth = 1;
    for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(r() * W, r() * H, r() * base * 0.003 + 0.5, 0, Math.PI * 2); g.fill(); }
    if (r() < 0.35) { const x = r() * W; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + (r() - 0.5) * 10, H); g.stroke(); }
    g.restore();
  }
  if (set.has('grain')) { g.save(); g.globalCompositeOperation = 'overlay'; g.globalAlpha = 0.18; const pat = g.createPattern(grainTex(), 'repeat'); const r = rng(frame + 99); g.translate(-r() * 256, -r() * 256); g.fillStyle = pat; g.fillRect(0, 0, W + 256, H + 256); g.restore(); }
  if (set.has('vignette')) { g.save(); const gr = g.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); g.fillStyle = gr; g.fillRect(0, 0, W, H); g.restore(); }
  if (set.has('bars')) { const h = W > H ? (H - W / 2.39) / 2 : H * 0.1; g.fillStyle = '#000'; g.fillRect(0, 0, W, h); g.fillRect(0, H - h, W, h); }
}

/* ------------------------------------------------------------------ text styles */
export const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Dancing+Script:wght@700&family=Montserrat:wght@800&family=Playfair+Display:ital,wght@1,700&family=Poppins:wght@600;800&family=Space+Mono:wght@700&display=swap';
export const TEXT_STYLES = {
  clean: { name: 'Clean', font: '800 {s}px Poppins, Inter, sans-serif', sub: '600 {s}px Poppins, Inter, sans-serif', color: '#fff', anim: 'rise' },
  bold: { name: 'Bold', font: '{s}px Anton, Impact, sans-serif', sub: '600 {s}px Poppins, sans-serif', color: '#fff', upper: true, stroke: '#000', anim: 'pop', scale: 1.25 },
  elegant: { name: 'Elegant', font: 'italic 700 {s}px "Playfair Display", Georgia, serif', sub: '600 {s}px Poppins, sans-serif', color: '#fff8ec', anim: 'fade', spacing: 1 },
  script: { name: 'Script', font: '700 {s}px "Dancing Script", cursive', sub: '600 {s}px Poppins, sans-serif', color: '#fff', anim: 'fade', scale: 1.25 },
  neon: { name: 'Neon', font: '800 {s}px Montserrat, sans-serif', sub: '600 {s}px Poppins, sans-serif', color: '#fff', glow: '#ff2bd6', anim: 'flicker' },
  typewriter: { name: 'Typewriter', font: '700 {s}px "Space Mono", monospace', sub: '700 {s}px "Space Mono", monospace', color: '#fff', anim: 'type', scale: 0.8 },
  pop: { name: 'Comic pop', font: '{s}px Bangers, Impact, sans-serif', sub: '600 {s}px Poppins, sans-serif', color: '#ffe14d', stroke: '#000', anim: 'pop', scale: 1.2 },
  box: { name: 'Label', font: '800 {s}px Poppins, sans-serif', sub: '600 {s}px Poppins, sans-serif', color: '#111', box: '#fff', anim: 'slide' }
};
/** Draw a title (and subtitle). age = seconds since it appeared, left = seconds until it disappears. pos: 'center' | 'bottom'. */
export function drawText(g, title, sub, styleKey, age, left, W, H, pos = 'center', size = 1) {
  const st = TEXT_STYLES[styleKey] || TEXT_STYLES.clean, base = Math.min(W, H) * size;
  const inA = clamp(age / 0.6), outA = clamp(left / 0.45), a = Math.min(inA, outA);
  if (a <= 0) return;
  const fs = Math.round(base * 0.085 * (st.scale || 1)), ss = Math.round(base * 0.04);
  let ty = pos === 'bottom' ? H - base * 0.16 - (sub ? ss * 1.6 : 0) : H * 0.5 - (sub ? ss : 0);
  const shown = (s) => (st.anim === 'type' ? s.slice(0, Math.floor(clamp(age / Math.max(0.6, s.length * 0.06)) * s.length)) : s);
  let T = st.upper ? title.toUpperCase() : title;
  g.save(); g.textAlign = 'center'; g.textBaseline = 'middle'; g.globalAlpha = st.anim === 'flicker' ? a * (age < 0.8 ? (Math.sin(age * 60) > 0 ? 1 : 0.3) : 1) : a;
  const e = ease(inA);
  if (st.anim === 'rise') ty += (1 - e) * base * 0.05;
  let sc = 1; if (st.anim === 'pop') sc = inA < 1 ? 0.6 + 0.55 * Math.sin(inA * Math.PI * 0.75) : 1;
  const sx = st.anim === 'slide' ? -(1 - e) * W * 0.3 : 0;
  if (pos === 'bottom' || st.box) { const gr = g.createLinearGradient(0, ty - base * 0.25, 0, H); gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.55)'); if (!st.box) { g.fillStyle = gr; g.fillRect(0, ty - base * 0.25, W, H - ty + base * 0.25); } }
  g.translate(W / 2 + sx, ty); g.scale(sc, sc);
  if (T) {
    g.font = st.font.replace('{s}', fs);
    const lines = wrapLines(g, shown(T), W * 0.86), lh = fs * 1.12, y0 = -((lines.length - 1) * lh) / 2;
    lines.forEach((l, k) => {
      const y = y0 + k * lh;
      if (st.box) { const w = g.measureText(l).width + fs * 0.6; g.fillStyle = st.box; g.fillRect(-w / 2, y - fs * 0.62, w, fs * 1.24); }
      if (st.glow) { g.shadowColor = st.glow; g.shadowBlur = fs * 0.5; g.fillStyle = st.glow; g.fillText(l, 0, y); g.shadowBlur = fs * 0.2; }
      else if (!st.box) { g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = fs * 0.25; g.shadowOffsetY = fs * 0.04; }
      if (st.stroke) { g.lineJoin = 'round'; g.lineWidth = fs * 0.12; g.strokeStyle = st.stroke; g.strokeText(l, 0, y); }
      g.fillStyle = st.color; g.fillText(l, 0, y); g.shadowBlur = 0; g.shadowOffsetY = 0;
    });
    if (sub) { g.font = st.sub.replace('{s}', ss); g.fillStyle = st.box ? '#fff' : 'rgba(255,255,255,.92)'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = ss * 0.4; g.fillText(shown(sub), 0, y0 + (lines.length - 1) * lh + fs * 0.62 + ss * 1.1); }
  } else if (sub) { g.font = st.sub.replace('{s}', Math.round(ss * 1.3)); g.fillStyle = '#fff'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = ss * 0.5; g.fillText(shown(sub), 0, 0); }
  g.restore();
}
function wrapLines(g, text, maxW) {
  const words = text.split(/\s+/), out = []; let line = '';
  for (const w of words) { const t = line ? `${line} ${w}` : w; if (g.measureText(t).width > maxW && line) { out.push(line); line = w; } else line = t; }
  if (line) out.push(line);
  return out.slice(0, 3);
}
export { hash, clamp, heartPath };
