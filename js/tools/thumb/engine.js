/* WebcamClicks thumbnail studio — document model, rendering and built-in templates.
   A design is plain JSON: { bg, layers[] }. Images live in an asset map (id → canvas) so designs stay small. */

export const W = 1280, H = 720;
export const FONTS = {
  anton: ['Anton', 400, 'Anton (tall)'], montserrat: ['Montserrat', 900, 'Montserrat Black'], bebas: ['Bebas Neue', 400, 'Bebas Neue'],
  bangers: ['Bangers', 400, 'Bangers (comic)'], poppins: ['Poppins', 800, 'Poppins Bold'], oswald: ['Oswald', 700, 'Oswald'],
  luckiest: ['Luckiest Guy', 400, 'Luckiest Guy'], marker: ['Permanent Marker', 400, 'Marker'], archivo: ['Archivo Black', 400, 'Archivo Black'], inter: ['Inter', 800, 'Inter']
};
export const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Archivo+Black&family=Bangers&family=Bebas+Neue&family=Luckiest+Guy&family=Montserrat:wght@800;900&family=Oswald:wght@700&family=Permanent+Marker&family=Poppins:wght@700;800&display=swap';
const FALLBACK = 'Impact, "Arial Black", "Noto Sans", "Noto Sans Devanagari", sans-serif';
export const fontCss = (key, px) => { const [f, w] = FONTS[key] || FONTS.anton; return `${w} ${px}px "${f}", ${FALLBACK}`; };

let nid = 0;
export const uid = () => `l${Date.now().toString(36)}${(nid++).toString(36)}`;

/* ---------------------------------------------------------------- layer factories */
export const text = (o = {}) => ({ id: uid(), type: 'text', name: 'Text', x: 360, y: 200, w: 640, h: 0, rot: 0, opacity: 1, hidden: false, locked: false,
  text: 'YOUR TEXT', font: 'anton', size: 110, color: '#ffffff', color2: '', hl: '#ffe14d', stroke: '#000000', strokeW: 10, shadow: 'rgba(0,0,0,.6)', shadowBlur: 18, shadowY: 6,
  box: '', boxPad: 18, boxRadius: 14, spacing: 0, lineH: 1.02, align: 'left', upper: true, extrude: 0, extrudeColor: '#b3261e', ...o });
export const image = (o = {}) => ({ id: uid(), type: 'image', name: 'Image', x: 900, y: 400, w: 600, h: 640, rot: 0, opacity: 1, hidden: false, locked: false,
  asset: null, role: '', fit: 'contain', outline: 0, outlineColor: '#ffffff', glow: 0, glowColor: '#ffe14d', shadow: 24, flip: false, radius: 0, border: 0, borderColor: '#ffffff',
  bright: 100, contrast: 100, sat: 100, ...o });
export const shape = (o = {}) => ({ id: uid(), type: 'shape', name: 'Shape', x: 640, y: 360, w: 300, h: 160, rot: 0, opacity: 1, hidden: false, locked: false,
  shape: 'rect', fill: '#ff4d2e', fill2: '', stroke: '', strokeW: 8, radius: 18, ...o });

export const defaultBg = () => ({ type: 'gradient', c1: '#1a1d29', c2: '#3a1c71', c3: '', angle: 135, frame: false, asset: null, blur: 30, dim: 30, zoom: 100, pattern: 'none', patternColor: '#ffffff', patternOpacity: 0.12 });

/* ---------------------------------------------------------------- text layout */
const meas = document.createElement('canvas').getContext('2d');
export function layoutText(L) {
  meas.font = fontCss(L.font, L.size);
  if ('letterSpacing' in meas) meas.letterSpacing = `${L.spacing}px`;
  const raw = L.upper ? L.text.toUpperCase() : L.text;
  const lines = [];
  for (const para of raw.split('\n')) {
    const words = para.split(/(\s+)/);
    let line = '';
    for (const w of words) {
      const next = line + w;
      if (line.trim() && meas.measureText(next.replace(/\*/g, '')).width > L.w && w.trim()) { lines.push(line.trimEnd()); line = w.trimStart(); }
      else line = next;
    }
    lines.push(line);
  }
  const lh = L.size * L.lineH;
  const widths = lines.map((l) => meas.measureText(l.replace(/\*/g, '')).width);
  L.h = Math.max(L.size, lines.length * lh + (L.box ? L.boxPad * 2 : 0));
  return { lines, widths, lh };
}

/* ---------------------------------------------------------------- rendering */
const outlineCache = new Map();
function silhouette(asset, color) {
  const k = `${asset.__id || (asset.__id = uid())}|${color}`;
  if (outlineCache.has(k)) return outlineCache.get(k);
  const c = document.createElement('canvas'); c.width = asset.width; c.height = asset.height;
  const g = c.getContext('2d'); g.drawImage(asset, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, c.width, c.height);
  if (outlineCache.size > 40) outlineCache.clear();
  outlineCache.set(k, c); return c;
}
function rrect(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function cover(g, img, x, y, w, h, zoom = 1) { const k = Math.max(w / img.width, h / img.height) * zoom, dw = img.width * k, dh = img.height * k; g.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh); }

export function drawBackground(g, bg, assets, frame) {
  g.save();
  const img = bg.type === 'image' ? (bg.frame ? frame : assets.get(bg.asset)) : null;
  if (img) {
    if (bg.blur > 0) {   // cheap, strong blur: draw small, scale up smoothly
      const q = Math.max(0.015, 0.35 * (1 - bg.blur / 105)), t = document.createElement('canvas'); t.width = Math.max(8, Math.round(W * q)); t.height = Math.max(5, Math.round(H * q));
      cover(t.getContext('2d'), img, 0, 0, t.width, t.height, bg.zoom / 100); g.imageSmoothingQuality = 'high'; g.drawImage(t, 0, 0, W, H);
    } else cover(g, img, 0, 0, W, H, bg.zoom / 100);
    if (bg.dim) { g.fillStyle = `rgba(0,0,0,${bg.dim / 100})`; g.fillRect(0, 0, W, H); }
  } else if (bg.type === 'solid') { g.fillStyle = bg.c1; g.fillRect(0, 0, W, H); }
  else if (bg.type === 'radial') { const r = g.createRadialGradient(W * 0.5, H * 0.45, 40, W * 0.5, H * 0.5, W * 0.75); r.addColorStop(0, bg.c1); if (bg.c3) r.addColorStop(0.5, bg.c3); r.addColorStop(1, bg.c2); g.fillStyle = r; g.fillRect(0, 0, W, H); }
  else {
    const a = (bg.angle * Math.PI) / 180, dx = Math.cos(a) * W / 2, dy = Math.sin(a) * H / 2;
    const gr = g.createLinearGradient(W / 2 - dx, H / 2 - dy, W / 2 + dx, H / 2 + dy); gr.addColorStop(0, bg.c1); if (bg.c3) gr.addColorStop(0.5, bg.c3); gr.addColorStop(1, bg.c2);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }
  // overlays that make thumbnails pop
  g.globalAlpha = bg.patternOpacity;
  if (bg.pattern === 'rays') {
    g.fillStyle = bg.patternColor; const cx = W * 0.5, cy = H * 0.5, n = 24, R = W;
    for (let i = 0; i < n; i += 2) { const a0 = (i / n) * Math.PI * 2, a1 = ((i + 1) / n) * Math.PI * 2; g.beginPath(); g.moveTo(cx, cy); g.lineTo(cx + Math.cos(a0) * R, cy + Math.sin(a0) * R); g.lineTo(cx + Math.cos(a1) * R, cy + Math.sin(a1) * R); g.closePath(); g.fill(); }
  } else if (bg.pattern === 'dots') {
    g.fillStyle = bg.patternColor;
    for (let y = 0; y < H; y += 26) for (let x = 0; x < W; x += 26) { const r = 1 + 6 * (x / W); g.beginPath(); g.arc(x + (y / 26 % 2 ? 13 : 0), y, r, 0, Math.PI * 2); g.fill(); }
  } else if (bg.pattern === 'grid') {
    g.strokeStyle = bg.patternColor; g.lineWidth = 2;
    for (let x = 0; x <= W; x += 64) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); }
    for (let y = 0; y <= H; y += 64) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); }
  } else if (bg.pattern === 'stripes') {
    g.fillStyle = bg.patternColor;
    for (let x = -H; x < W; x += 80) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + 40, H); g.lineTo(x + 40 + H, 0); g.lineTo(x + H, 0); g.closePath(); g.fill(); }
  }
  g.globalAlpha = 1;
  if (bg.pattern === 'vignette' || bg.vignette) { const v = g.createRadialGradient(W / 2, H / 2, H * 0.35, W / 2, H / 2, W * 0.72); v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${Math.min(0.9, bg.patternOpacity * 4)})`); g.fillStyle = v; g.fillRect(0, 0, W, H); }
  g.restore();
}

function drawText(g, L) {
  const { lines, widths, lh } = layoutText(L);
  g.font = fontCss(L.font, L.size);
  if ('letterSpacing' in g) g.letterSpacing = `${L.spacing}px`;
  g.textBaseline = 'alphabetic'; g.lineJoin = 'round';
  const top = -L.h / 2 + (L.box ? L.boxPad : 0), left = -L.w / 2;
  if (L.box) {
    const bw = (L.align === 'left' ? Math.max(...widths) : L.w) + L.boxPad * 2;
    const bx = L.align === 'left' ? left - L.boxPad : L.align === 'right' ? L.w / 2 - bw + L.boxPad : -bw / 2;
    g.save(); g.fillStyle = L.box; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 20; rrect(g, bx, -L.h / 2, bw, L.h, L.boxRadius); g.fill(); g.restore();
  }
  lines.forEach((line, i) => {
    const y = top + lh * i + L.size * 0.86;
    let x = L.align === 'center' ? -widths[i] / 2 : L.align === 'right' ? L.w / 2 - widths[i] : left;
    for (const part of line.split(/(\*[^*]+\*)/).filter(Boolean)) {
      const hl = /^\*.*\*$/.test(part), t = part.replace(/\*/g, ''), pw = g.measureText(t).width;
      for (let d = L.extrude; d > 0; d--) { g.fillStyle = L.extrudeColor; g.fillText(t, x + d * 0.8, y + d); }
      if (L.strokeW > 0) {
        g.save(); if (L.shadowBlur || L.shadowY) { g.shadowColor = L.shadow; g.shadowBlur = L.shadowBlur; g.shadowOffsetY = L.shadowY; }
        g.lineWidth = L.strokeW * 2; g.strokeStyle = L.stroke; g.strokeText(t, x, y); g.restore();
      } else if (L.shadowBlur || L.shadowY) { g.save(); g.shadowColor = L.shadow; g.shadowBlur = L.shadowBlur; g.shadowOffsetY = L.shadowY; g.fillStyle = 'rgba(0,0,0,0.01)'; g.fillText(t, x, y); g.restore(); }
      if (hl) g.fillStyle = L.hl;
      else if (L.color2) { const gr = g.createLinearGradient(0, y - L.size * 0.85, 0, y); gr.addColorStop(0, L.color); gr.addColorStop(1, L.color2); g.fillStyle = gr; }
      else g.fillStyle = L.color;
      if (!L.strokeW && (L.shadowBlur || L.shadowY)) { g.save(); g.shadowColor = L.shadow; g.shadowBlur = L.shadowBlur; g.shadowOffsetY = L.shadowY; g.fillText(t, x, y); g.restore(); }
      else g.fillText(t, x, y);
      x += pw;
    }
  });
}

function drawImageLayer(g, L, assets, frame) {
  const img = L.asset === '@frame' ? frame : assets.get(L.asset);
  if (!img) {   // empty placeholder: "add your photo"
    g.save(); g.fillStyle = 'rgba(255,255,255,.12)'; g.strokeStyle = 'rgba(255,255,255,.7)'; g.setLineDash([14, 10]); g.lineWidth = 4;
    rrect(g, -L.w / 2, -L.h / 2, L.w, L.h, 24); g.fill(); g.stroke(); g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.55)'; g.beginPath(); g.arc(0, -L.h * 0.12, Math.min(L.w, L.h) * 0.16, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(0, L.h * 0.3, Math.min(L.w, L.h) * 0.3, Math.min(L.w, L.h) * 0.2, 0, Math.PI, 0); g.fill();
    g.fillStyle = '#fff'; g.font = '700 30px Inter, sans-serif'; g.textAlign = 'center'; g.fillText(L.role === 'subject' ? 'Your photo' : 'Image', 0, L.h / 2 - 30);
    g.restore(); return;
  }
  // fit inside the box keeping the aspect ratio
  const k = L.fit === 'cover' ? Math.max(L.w / img.width, L.h / img.height) : Math.min(L.w / img.width, L.h / img.height);
  const dw = img.width * k, dh = img.height * k, x = -dw / 2, y = -dh / 2;
  g.save();
  if (L.flip) g.scale(-1, 1);
  if (L.fit === 'cover' || L.radius) { rrect(g, -L.w / 2, -L.h / 2, L.w, L.h, L.radius); g.clip(); }
  if (L.outline > 0) {
    const sil = silhouette(img, L.outlineColor);
    g.save(); if (L.shadow) { g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = L.shadow; }
    for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2; g.drawImage(sil, x + Math.cos(ang) * L.outline, y + Math.sin(ang) * L.outline, dw, dh); }
    g.restore();
  }
  if (L.glow > 0) { g.save(); g.shadowColor = L.glowColor; g.shadowBlur = L.glow; const sil = silhouette(img, L.glowColor); g.drawImage(sil, x, y, dw, dh); g.drawImage(sil, x, y, dw, dh); g.restore(); }
  g.save();
  if (!L.outline && L.shadow) { g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = L.shadow; g.shadowOffsetY = L.shadow / 4; }
  if (L.bright !== 100 || L.contrast !== 100 || L.sat !== 100) g.filter = `brightness(${L.bright}%) contrast(${L.contrast}%) saturate(${L.sat}%)`;
  g.drawImage(img, x, y, dw, dh);
  g.restore();
  g.restore();
  if (L.border > 0) { g.save(); g.lineWidth = L.border; g.strokeStyle = L.borderColor; rrect(g, -L.w / 2, -L.h / 2, L.w, L.h, L.radius); g.stroke(); g.restore(); }
}

function drawShape(g, L) {
  const w = L.w, h = L.h;
  let fill = L.fill;
  if (L.fill2) { const gr = g.createLinearGradient(-w / 2, 0, w / 2, 0); gr.addColorStop(0, L.fill); gr.addColorStop(1, L.fill2); fill = gr; }
  g.fillStyle = fill; g.strokeStyle = L.stroke || L.fill; g.lineWidth = L.strokeW; g.lineJoin = 'round'; g.lineCap = 'round';
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 16; g.shadowOffsetY = 5;
  switch (L.shape) {
    case 'circle': g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); if (L.fill) g.fill(); g.restore(); if (L.stroke) { g.beginPath(); g.ellipse(0, 0, w / 2, h / 2, 0, 0, Math.PI * 2); g.stroke(); } return;
    case 'ring': g.restore(); g.lineWidth = Math.max(6, L.strokeW); g.strokeStyle = L.fill; g.beginPath(); g.ellipse(0, 0, w / 2 - g.lineWidth / 2, h / 2 - g.lineWidth / 2, 0, 0, Math.PI * 2); g.stroke(); return;
    case 'arrow': {
      const t = Math.min(h * 0.38, w * 0.2), head = Math.min(w * 0.42, h * 1.1);
      g.beginPath(); g.moveTo(-w / 2, -t / 2); g.lineTo(w / 2 - head, -t / 2); g.lineTo(w / 2 - head, -h / 2); g.lineTo(w / 2, 0); g.lineTo(w / 2 - head, h / 2); g.lineTo(w / 2 - head, t / 2); g.lineTo(-w / 2, t / 2); g.closePath();
      g.fill(); g.restore(); if (L.stroke) g.stroke(); return;
    }
    case 'burst': {
      const n = 14; g.beginPath();
      for (let i = 0; i < n * 2; i++) { const a = (i / (n * 2)) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 0.72 : 1; g.lineTo(Math.cos(a) * (w / 2) * r, Math.sin(a) * (h / 2) * r); }
      g.closePath(); g.fill(); g.restore(); if (L.stroke) g.stroke(); return;
    }
    case 'line': g.restore(); g.lineWidth = Math.max(4, h); g.strokeStyle = L.fill; g.beginPath(); g.moveTo(-w / 2, 0); g.lineTo(w / 2, 0); g.stroke(); return;
    default: rrect(g, -w / 2, -h / 2, w, h, L.radius); g.fill(); g.restore(); if (L.stroke) { rrect(g, -w / 2, -h / 2, w, h, L.radius); g.stroke(); }
  }
}

export function renderDoc(g, doc, assets, frame) {
  g.save(); g.clearRect(0, 0, W, H);
  drawBackground(g, doc.bg, assets, frame);
  for (const L of doc.layers) {
    if (L.hidden) continue;
    if (L.type === 'text') layoutText(L);
    g.save(); g.globalAlpha = L.opacity; g.translate(L.x, L.y); g.rotate((L.rot * Math.PI) / 180);
    if (L.type === 'text') drawText(g, L); else if (L.type === 'image') drawImageLayer(g, L, assets, frame); else drawShape(g, L);
    g.restore();
  }
  g.restore();
}

/** Point (canvas px) → layer-local coordinates. */
export function toLocal(L, px, py) { const a = (-L.rot * Math.PI) / 180, dx = px - L.x, dy = py - L.y; return [dx * Math.cos(a) - dy * Math.sin(a), dx * Math.sin(a) + dy * Math.cos(a)]; }
export function hit(doc, px, py) {
  for (let i = doc.layers.length - 1; i >= 0; i--) { const L = doc.layers[i]; if (L.hidden) continue; const [lx, ly] = toLocal(L, px, py); if (Math.abs(lx) <= L.w / 2 + 6 && Math.abs(ly) <= L.h / 2 + 6) return L; }
  return null;
}

/* ---------------------------------------------------------------- built-in templates */
const subj = (o) => image({ role: 'subject', asset: '@subject', name: 'Your photo', outline: 10, ...o });
export const TEMPLATES = [
  { id: 'reaction', name: 'Shock reaction', make: () => ({ bg: { ...defaultBg(), type: 'image', frame: true, blur: 40, dim: 35, pattern: 'rays', patternColor: '#ffffff', patternOpacity: 0.1 },
    layers: [subj({ x: 930, y: 420, w: 620, h: 640 }), text({ role: 'headline', name: 'Headline', x: 330, y: 230, w: 600, text: 'I CAN\'T\nBELIEVE *THIS*', size: 120 }), shape({ shape: 'arrow', x: 640, y: 470, w: 230, h: 120, rot: 25, fill: '#ff2d2d' })] }) },
  { id: 'versus', name: 'Versus', make: () => ({ bg: { ...defaultBg(), type: 'solid', c1: '#111' },
    layers: [shape({ x: 320, y: 360, w: 660, h: 760, rot: 0, fill: '#1e66ff', radius: 0 }), shape({ x: 960, y: 360, w: 660, h: 760, fill: '#ff2d55', radius: 0 }), subj({ x: 330, y: 420, w: 560, h: 620, outline: 8 }), image({ role: 'image', x: 950, y: 420, w: 560, h: 620, outline: 8, name: 'Second image' }),
      shape({ shape: 'burst', x: 640, y: 360, w: 230, h: 230, fill: '#ffe14d', stroke: '#000', strokeW: 6 }), text({ x: 640, y: 360, w: 220, text: 'VS', size: 120, align: 'center', color: '#111', stroke: '#fff', strokeW: 6, shadowBlur: 0, shadowY: 0 })] }) },
  { id: 'tutorial', name: 'How-to', make: () => ({ bg: { ...defaultBg(), type: 'gradient', c1: '#0f172a', c2: '#1e3a8a', angle: 120, pattern: 'grid', patternOpacity: 0.07 },
    layers: [subj({ x: 1000, y: 400, w: 520, h: 640, outline: 0, shadow: 30 }), text({ role: 'headline', name: 'Headline', x: 380, y: 200, w: 640, text: 'HOW TO *EDIT*\nLIKE A PRO', size: 104, font: 'montserrat', strokeW: 0 }),
      shape({ x: 230, y: 470, w: 330, h: 80, fill: '#ffe14d', radius: 40 }), text({ x: 230, y: 470, w: 320, text: 'IN 5 MINUTES', size: 46, font: 'poppins', align: 'center', color: '#111', strokeW: 0, shadowBlur: 0, shadowY: 0 })] }) },
  { id: 'beforeafter', name: 'Before / after', make: () => ({ bg: { ...defaultBg(), type: 'solid', c1: '#0e0e12' },
    layers: [image({ x: 320, y: 360, w: 620, h: 700, fit: 'cover', role: 'image', name: 'Before', radius: 22, shadow: 0, bright: 80, sat: 50 }), subj({ x: 960, y: 360, w: 620, h: 700, asset: '@frame', fit: 'cover', outline: 0, radius: 22, shadow: 0, sat: 130, name: 'After' }),
      text({ x: 320, y: 640, w: 560, text: 'BEFORE', size: 80, align: 'center', box: '#000000', strokeW: 0 }), text({ x: 960, y: 640, w: 560, text: '*AFTER*', size: 80, align: 'center', box: '#000000', strokeW: 0 }),
      shape({ shape: 'arrow', x: 640, y: 360, w: 170, h: 110, fill: '#ffe14d' })] }) },
  { id: 'top10', name: 'Top list', make: () => ({ bg: { ...defaultBg(), type: 'radial', c1: '#ff9f1c', c2: '#d00000', pattern: 'rays', patternOpacity: 0.16 },
    layers: [text({ x: 270, y: 330, w: 520, text: '10', size: 420, font: 'anton', color: '#ffe14d', color2: '#ff9f1c', strokeW: 14, extrude: 14, extrudeColor: '#6b0000' }), text({ role: 'headline', name: 'Headline', x: 760, y: 170, w: 760, text: 'THINGS YOU\nNEVER KNEW', size: 96 }), subj({ x: 1010, y: 500, w: 460, h: 520 })] }) },
  { id: 'podcast', name: 'Podcast', make: () => ({ bg: { ...defaultBg(), type: 'gradient', c1: '#111827', c2: '#4c1d95', angle: 0, pattern: 'vignette', patternOpacity: 0.2 },
    layers: [subj({ x: 330, y: 420, w: 560, h: 620, outline: 6 }), image({ role: 'image', x: 950, y: 420, w: 560, h: 620, outline: 6, name: 'Guest' }), shape({ x: 640, y: 92, w: 520, h: 96, fill: '#ef4444', radius: 48 }),
      text({ x: 640, y: 92, w: 500, text: 'EPISODE 42', size: 58, font: 'poppins', align: 'center', strokeW: 0, shadowBlur: 0, shadowY: 0 }), text({ role: 'headline', name: 'Headline', x: 640, y: 640, w: 1100, text: 'THE *TRUTH* ABOUT MONEY', size: 84, align: 'center' })] }) },
  { id: 'gaming', name: 'Gaming neon', make: () => ({ bg: { ...defaultBg(), type: 'gradient', c1: '#05010f', c2: '#1b0036', angle: 90, pattern: 'grid', patternColor: '#a855f7', patternOpacity: 0.18 },
    layers: [subj({ x: 960, y: 400, w: 600, h: 660, outline: 0, glow: 40, glowColor: '#22d3ee' }), text({ role: 'headline', name: 'Headline', x: 360, y: 220, w: 640, text: 'INSANE\n*CLUTCH*', size: 130, font: 'bangers', color: '#ffffff', hl: '#22d3ee', stroke: '#7c3aed', strokeW: 10, shadow: '#a855f7', shadowBlur: 40, shadowY: 0 })] }) },
  { id: 'news', name: 'Breaking news', make: () => ({ bg: { ...defaultBg(), type: 'image', frame: true, blur: 0, dim: 15 },
    layers: [shape({ x: 640, y: 600, w: 1280, h: 150, fill: '#c1121f', radius: 0 }), shape({ x: 190, y: 510, w: 300, h: 70, fill: '#ffffff', radius: 0 }), text({ x: 190, y: 510, w: 290, text: 'BREAKING', size: 48, font: 'oswald', align: 'center', color: '#c1121f', strokeW: 0, shadowBlur: 0, shadowY: 0 }),
      text({ role: 'headline', name: 'Headline', x: 640, y: 605, w: 1180, text: 'THIS CHANGES EVERYTHING', size: 84, font: 'oswald', align: 'left', strokeW: 0, shadowBlur: 0, shadowY: 0 })] }) },
  { id: 'money', name: 'Money / finance', make: () => ({ bg: { ...defaultBg(), type: 'gradient', c1: '#052e16', c2: '#15803d', angle: 160, pattern: 'dots', patternOpacity: 0.12 },
    layers: [text({ role: 'headline', name: 'Headline', x: 360, y: 200, w: 660, text: '$0 → *$10,000*', size: 110, hl: '#a3e635' }), text({ x: 330, y: 400, w: 600, text: 'IN 30 DAYS', size: 80, font: 'montserrat', color: '#ecfccb', strokeW: 6 }), subj({ x: 990, y: 420, w: 560, h: 620 })] }) },
  { id: 'challenge', name: 'Challenge', make: () => ({ bg: { ...defaultBg(), type: 'image', frame: true, blur: 8, dim: 20 },
    layers: [subj({ x: 380, y: 420, w: 640, h: 640 }), shape({ shape: 'ring', x: 950, y: 330, w: 330, h: 330, fill: '#ff2d2d', strokeW: 14 }), shape({ shape: 'arrow', x: 780, y: 520, w: 220, h: 110, rot: -35, fill: '#ff2d2d' }),
      text({ role: 'headline', name: 'Headline', x: 900, y: 610, w: 700, text: '24 HOUR *CHALLENGE*', size: 76, align: 'center', hl: '#ffe14d' })] }) },
  { id: 'minimal', name: 'Clean & minimal', make: () => ({ bg: { ...defaultBg(), type: 'solid', c1: '#f5f1ea' },
    layers: [subj({ x: 940, y: 380, w: 620, h: 700, outline: 0, shadow: 0 }), text({ role: 'headline', name: 'Headline', x: 360, y: 300, w: 600, text: 'The quiet\nproductivity *system*', size: 84, font: 'inter', upper: false, color: '#111111', hl: '#e85d04', strokeW: 0, shadowBlur: 0, shadowY: 0, lineH: 1.08 })] }) },
  { id: 'vlog', name: 'Travel vlog', make: () => ({ bg: { ...defaultBg(), type: 'image', frame: true, blur: 0, dim: 10, pattern: 'vignette', patternOpacity: 0.18 },
    layers: [text({ role: 'headline', name: 'Headline', x: 640, y: 150, w: 1150, text: 'I LIVED IN *TOKYO*', size: 112, align: 'center', font: 'luckiest', hl: '#ff4d6d', strokeW: 9 }), subj({ x: 1040, y: 470, w: 420, h: 520, outline: 9 }),
      shape({ x: 170, y: 640, w: 260, h: 70, fill: '#ffe14d', radius: 35, rot: -4 }), text({ x: 170, y: 640, w: 250, text: '7 DAYS', size: 46, font: 'poppins', align: 'center', color: '#111', strokeW: 0, shadowBlur: 0, shadowY: 0, rot: -4 })] }) },
  { id: 'question', name: 'Big question', make: () => ({ bg: { ...defaultBg(), type: 'gradient', c1: '#ffbe0b', c2: '#fb5607', angle: 45 },
    layers: [text({ x: 1080, y: 330, w: 300, text: '?', size: 520, font: 'anton', color: '#ffffff', strokeW: 0, shadowBlur: 30, extrude: 12, extrudeColor: '#9d0208', align: 'center' }), subj({ x: 420, y: 420, w: 620, h: 640 }), text({ role: 'headline', name: 'Headline', x: 760, y: 620, w: 560, text: 'IS IT *WORTH IT*', size: 72, hl: '#111111', color: '#ffffff' })] }) },
  { id: 'blank', name: 'Blank canvas', make: () => ({ bg: defaultBg(), layers: [] }) }
];
