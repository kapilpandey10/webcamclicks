/* WebcamClicks ID card maker — document model, data merge, rendering (canvas, 300 DPI), QR & Code 128 barcodes.
   A design is JSON: { size, radius, front: { bg, layers[] }, back: { bg, layers[] } }. Text can contain {{Field}}
   placeholders that are filled from each data row; photos can come from a data column. */

export const DPI = 300;
const mm = (v) => Math.round((v / 25.4) * DPI);
export const SIZES = {
  cr80l: { name: 'ID card, landscape (85.6 × 54 mm)', w: mm(85.6), h: mm(54), mmW: 85.6, mmH: 54 },
  cr80p: { name: 'ID card, portrait (54 × 85.6 mm)', w: mm(54), h: mm(85.6), mmW: 54, mmH: 85.6 },
  badgep: { name: 'Event badge, portrait (3 × 4 in)', w: 900, h: 1200, mmW: 76.2, mmH: 101.6 },
  badgel: { name: 'Event badge, landscape (4 × 3 in)', w: 1200, h: 900, mmW: 101.6, mmH: 76.2 },
  largep: { name: 'Large badge (4 × 6 in)', w: 1200, h: 1800, mmW: 101.6, mmH: 152.4 }
};
export const FONTS = {
  poppins: ['Poppins', 'Poppins'], montserrat: ['Montserrat', 'Montserrat'], inter: ['Inter', 'Inter'], roboto: ['Roboto', 'Roboto'],
  oswald: ['Oswald', 'Oswald'], bebas: ['Bebas Neue', 'Bebas Neue'], playfair: ['Playfair Display', 'Playfair Display'], merriweather: ['Merriweather', 'Merriweather'],
  mono: ['Roboto Mono', 'Roboto Mono'], script: ['Great Vibes', 'Great Vibes (signature)']
};
export const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Great+Vibes&family=Inter:wght@400;600;800&family=Merriweather:wght@400;700&family=Montserrat:wght@500;700;800&family=Oswald:wght@500;700&family=Playfair+Display:wght@600;800&family=Poppins:wght@400;600;700;800&family=Roboto:wght@400;500;700&family=Roboto+Mono:wght@500;700&display=swap';
const FALLBACK = '"Noto Sans", "Noto Sans Devanagari", Arial, sans-serif';
export const fontCss = (L, px) => `${L.italic ? 'italic ' : ''}${L.weight || 600} ${px}px "${(FONTS[L.font] || FONTS.poppins)[0]}", ${FALLBACK}`;

let n = 0;
export const uid = () => `e${Date.now().toString(36)}${(n++).toString(36)}`;

/* ---------------------------------------------------------------- element factories */
export const textEl = (o = {}) => ({ id: uid(), type: 'text', x: 60, y: 60, w: 500, h: 60, text: 'Text', font: 'poppins', size: 44, weight: 600, color: '#111827', align: 'left', upper: false, spacing: 0, lineH: 1.15, italic: false, box: '', boxRadius: 10, fit: true, opacity: 1, locked: false, ...o });
export const imageEl = (o = {}) => ({ id: uid(), type: 'image', x: 60, y: 60, w: 240, h: 300, src: 'photo', asset: null, fit: 'cover', shape: 'rounded', radius: 18, border: 0, borderColor: '#ffffff', opacity: 1, locked: false, ...o });
export const shapeEl = (o = {}) => ({ id: uid(), type: 'shape', x: 0, y: 0, w: 300, h: 120, shape: 'rect', fill: '#1d4ed8', fill2: '', angle: 0, stroke: '', strokeW: 4, radius: 0, opacity: 1, locked: false, ...o });
export const qrEl = (o = {}) => ({ id: uid(), type: 'qr', x: 60, y: 60, w: 200, h: 200, value: '{{ID}}', color: '#111827', bg: '#ffffff', opacity: 1, locked: false, ...o });
export const barcodeEl = (o = {}) => ({ id: uid(), type: 'barcode', x: 60, y: 60, w: 420, h: 110, value: '{{ID}}', color: '#111827', bg: '#ffffff', showText: true, opacity: 1, locked: false, ...o });
export const solidBg = (c = '#ffffff') => ({ type: 'solid', c1: c, c2: c, angle: 135, asset: null, dim: 0, pattern: 'none', patternColor: '#000000', patternOpacity: 0.06 });

/* ---------------------------------------------------------------- data merge */
export const fill = (s, row) => String(s ?? '').replace(/\{\{\s*([^}]+?)\s*\}\}/g, (m, k) => {
  if (!row) return m;
  const key = Object.keys(row).find((c) => c.toLowerCase() === k.toLowerCase());
  return key != null ? String(row[key] ?? '') : '';
});
export const fieldsIn = (s) => [...String(s || '').matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)].map((m) => m[1]);

/* ---------------------------------------------------------------- QR (qrcode-generator) & Code 128 */
export function qrMatrix(QR, text) {
  if (!QR || !text) return null;
  const q = QR(0, 'M'); q.addData(unescape(encodeURIComponent(text))); q.make();
  const n2 = q.getModuleCount(), m = []; for (let r = 0; r < n2; r++) { m.push([]); for (let c = 0; c < n2; c++) m[r].push(q.isDark(r, c)); }
  return m;
}
const C128 = ['212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', '114131', '311141', '411131', '211412', '211214', '211232', '2331112'];
/** Code 128 (set B) bar widths for printable ASCII. */
export function code128(text) {
  const s = String(text || '').replace(/[^\x20-\x7e]/g, ''); if (!s) return null;
  const codes = [104]; for (const ch of s) codes.push(ch.charCodeAt(0) - 32);
  let sum = 104; for (let i = 1; i < codes.length; i++) sum += codes[i] * i;
  codes.push(sum % 103, 106);
  return codes.map((c) => C128[c]).join('').split('').map(Number);
}

/* ---------------------------------------------------------------- rendering */
function rrect(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function grad(g, x, y, w, h, c1, c2, angle) {
  const a = ((angle || 0) * Math.PI) / 180, cx = x + w / 2, cy = y + h / 2, L = Math.abs(w * Math.cos(a)) / 2 + Math.abs(h * Math.sin(a)) / 2;
  const gr = g.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L); gr.addColorStop(0, c1); gr.addColorStop(1, c2); return gr;
}
function pattern(g, kind, W, H, color, opacity) {
  if (kind === 'none') return;
  g.save(); g.globalAlpha = opacity; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = 3;
  if (kind === 'dots') { for (let y = 20; y < H; y += 36) for (let x = 20 + ((y / 36) % 2) * 18; x < W; x += 36) { g.beginPath(); g.arc(x, y, 4, 0, Math.PI * 2); g.fill(); } }
  else if (kind === 'lines') { for (let x = -H; x < W; x += 28) { g.beginPath(); g.moveTo(x, H); g.lineTo(x + H, 0); g.stroke(); } }
  else if (kind === 'grid') { for (let x = 0; x < W; x += 40) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, H); g.stroke(); } for (let y = 0; y < H; y += 40) { g.beginPath(); g.moveTo(0, y); g.lineTo(W, y); g.stroke(); } }
  else if (kind === 'waves') { g.lineWidth = 4; for (let y = 30; y < H + 40; y += 48) { g.beginPath(); for (let x = 0; x <= W; x += 10) g.lineTo(x, y + Math.sin(x / 40) * 10); g.stroke(); } }
  else if (kind === 'hex') { const s = 34, hh = s * Math.sqrt(3); for (let y = 0; y < H + hh; y += hh) for (let x = 0, i = 0; x < W + s * 2; x += s * 1.5, i++) { const yy = y + (i % 2 ? hh / 2 : 0); g.beginPath(); for (let k = 0; k < 6; k++) { const an = (Math.PI / 3) * k; g.lineTo(x + s * Math.cos(an), yy + s * Math.sin(an)); } g.closePath(); g.stroke(); } }
  else if (kind === 'guilloche') { g.lineWidth = 1.6; for (let k = 0; k < 18; k++) { g.beginPath(); for (let t = 0; t <= Math.PI * 2 + 0.01; t += 0.02) { const r = Math.min(W, H) * (0.18 + k * 0.025) + Math.sin(t * 12) * 10; g.lineTo(W / 2 + Math.cos(t) * r * (W / H), H / 2 + Math.sin(t) * r); } g.stroke(); } }
  g.restore();
}
export function drawBg(g, bg, W, H, assets) {
  if (bg.type === 'gradient') g.fillStyle = grad(g, 0, 0, W, H, bg.c1, bg.c2, bg.angle); else g.fillStyle = bg.c1;
  g.fillRect(0, 0, W, H);
  if (bg.type === 'image' && bg.asset && assets[bg.asset]) {
    const im = assets[bg.asset], s = Math.max(W / im.width, H / im.height);
    g.drawImage(im, (W - im.width * s) / 2, (H - im.height * s) / 2, im.width * s, im.height * s);
    if (bg.dim) { g.fillStyle = `rgba(255,255,255,${bg.dim / 100})`; g.fillRect(0, 0, W, H); }
  }
  pattern(g, bg.pattern || 'none', W, H, bg.patternColor || '#000', bg.patternOpacity ?? 0.06);
}
const meas = document.createElement('canvas').getContext('2d');
export function layoutText(L, str) {
  let size = L.size;
  const lines = () => {
    meas.font = fontCss(L, size); if ('letterSpacing' in meas) meas.letterSpacing = `${(L.spacing || 0) * size / 100}px`;
    const out = [];
    for (const para of str.split('\n')) {
      let line = '';
      for (const w of para.split(/(\s+)/)) { const t = line + w; if (line.trim() && meas.measureText(t).width > L.w && w.trim()) { out.push(line.trimEnd()); line = w.trimStart(); } else line = t; }
      out.push(line);
    }
    return out;
  };
  let ls = lines();
  // "fit": shrink long names so they stay inside the box (height) instead of overflowing
  if (L.fit) { let guard = 0; while (guard++ < 40 && size > 8 && (ls.length * size * L.lineH > L.h + 1 || ls.some((l) => meas.measureText(l).width > L.w + 1))) { size *= 0.93; ls = lines(); } }
  return { lines: ls, size };
}
export function drawEl(g, L, row, ctx) {
  const { assets, photoFor, QR } = ctx;
  g.save(); g.globalAlpha = L.opacity ?? 1;
  if (L.type === 'shape') {
    g.fillStyle = L.fill2 ? grad(g, L.x, L.y, L.w, L.h, L.fill, L.fill2, L.angle) : L.fill;
    g.beginPath();
    if (L.shape === 'circle') g.ellipse(L.x + L.w / 2, L.y + L.h / 2, L.w / 2, L.h / 2, 0, 0, Math.PI * 2);
    else if (L.shape === 'wave') { g.moveTo(L.x, L.y + L.h * 0.35); g.bezierCurveTo(L.x + L.w * 0.3, L.y - L.h * 0.15, L.x + L.w * 0.65, L.y + L.h * 0.85, L.x + L.w, L.y + L.h * 0.25); g.lineTo(L.x + L.w, L.y + L.h); g.lineTo(L.x, L.y + L.h); g.closePath(); }
    else if (L.shape === 'wavetop') { g.moveTo(L.x, L.y); g.lineTo(L.x + L.w, L.y); g.lineTo(L.x + L.w, L.y + L.h * 0.7); g.bezierCurveTo(L.x + L.w * 0.65, L.y + L.h * 1.15, L.x + L.w * 0.3, L.y + L.h * 0.3, L.x, L.y + L.h * 0.85); g.closePath(); }
    else if (L.shape === 'slant') { g.moveTo(L.x, L.y); g.lineTo(L.x + L.w, L.y); g.lineTo(L.x + L.w * 0.78, L.y + L.h); g.lineTo(L.x, L.y + L.h); g.closePath(); }
    else if (L.shape === 'arc') { g.moveTo(L.x, L.y); g.lineTo(L.x + L.w, L.y); g.lineTo(L.x + L.w, L.y + L.h * 0.7); g.quadraticCurveTo(L.x + L.w / 2, L.y + L.h * 1.3, L.x, L.y + L.h * 0.7); g.closePath(); }
    else if (L.shape === 'line') { g.rect(L.x, L.y, L.w, Math.max(1, L.h)); }
    else rrect(g, L.x, L.y, L.w, L.h, L.radius || 0);
    g.fill();
    if (L.stroke) { g.lineWidth = L.strokeW; g.strokeStyle = L.stroke; g.stroke(); }
  } else if (L.type === 'text') {
    let str = fill(L.text, row); if (L.upper) str = str.toUpperCase();
    if (str) {
      const { lines, size } = layoutText(L, str);
      g.font = fontCss(L, size); if ('letterSpacing' in g) g.letterSpacing = `${(L.spacing || 0) * size / 100}px`;
      g.textBaseline = 'middle'; g.fillStyle = L.color;
      const lh = size * L.lineH, total = lines.length * lh, y0 = L.y + (L.h - total) / 2 + lh / 2;
      lines.forEach((ln, i) => {
        const w = g.measureText(ln).width, x = L.align === 'center' ? L.x + (L.w - w) / 2 : L.align === 'right' ? L.x + L.w - w : L.x;
        if (L.box) { g.save(); g.fillStyle = L.box; rrect(g, x - size * 0.4, y0 + i * lh - lh / 2 + 2, w + size * 0.8, lh - 4, L.boxRadius); g.fill(); g.restore(); }
        g.fillText(ln, x, y0 + i * lh);
      });
    }
  } else if (L.type === 'image') {
    const im = L.src === 'photo' ? photoFor(row) : L.asset ? assets[L.asset] : null;
    g.save();
    if (L.shape === 'circle') { g.beginPath(); g.ellipse(L.x + L.w / 2, L.y + L.h / 2, L.w / 2, L.h / 2, 0, 0, Math.PI * 2); } else rrect(g, L.x, L.y, L.w, L.h, L.shape === 'rounded' ? L.radius : 0);
    if (im) {
      g.save(); g.clip();
      const s = L.fit === 'contain' ? Math.min(L.w / im.width, L.h / im.height) : Math.max(L.w / im.width, L.h / im.height);
      const w = im.width * s, h = im.height * s;
      // photos: keep the face in frame (portraits are cropped towards the top, not the middle)
      const yOff = L.src === 'photo' && L.fit !== 'contain' ? Math.min(0, (L.h - h) * 0.3) : (L.h - h) / 2;
      g.drawImage(im, L.x + (L.w - w) / 2, L.y + yOff, w, h); g.restore();
    } else if (ctx.placeholders) {
      g.save(); g.clip(); g.fillStyle = '#e5e7eb'; g.fillRect(L.x, L.y, L.w, L.h);
      g.fillStyle = '#9ca3af'; const r = Math.min(L.w, L.h) * 0.22; g.beginPath(); g.arc(L.x + L.w / 2, L.y + L.h * 0.4, r, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(L.x + L.w / 2, L.y + L.h * 0.95, r * 1.8, r * 1.3, 0, 0, Math.PI * 2); g.fill(); g.restore();
    }
    if (L.border) {   // re-trace the frame (the placeholder drawing replaced the current path)
      if (L.shape === 'circle') { g.beginPath(); g.ellipse(L.x + L.w / 2, L.y + L.h / 2, L.w / 2, L.h / 2, 0, 0, Math.PI * 2); } else rrect(g, L.x, L.y, L.w, L.h, L.shape === 'rounded' ? L.radius : 0);
      g.lineWidth = L.border; g.strokeStyle = L.borderColor; g.stroke();
    }
    g.restore();
  } else if (L.type === 'qr') {
    const m = qrMatrix(QR, fill(L.value, row));
    if (m) {
      const s = Math.min(L.w, L.h), cell = s / (m.length + 2);
      g.fillStyle = L.bg; g.fillRect(L.x, L.y, s, s); g.fillStyle = L.color;
      for (let r = 0; r < m.length; r++) for (let c = 0; c < m.length; c++) if (m[r][c]) g.fillRect(L.x + (c + 1) * cell, L.y + (r + 1) * cell, Math.ceil(cell), Math.ceil(cell));
    }
  } else if (L.type === 'barcode') {
    const v = fill(L.value, row), bars = code128(v);
    if (bars) {
      const units = bars.reduce((a, b) => a + b, 0) + 20, u = L.w / units, th = L.showText ? Math.min(L.h * 0.28, 40) : 0;
      g.fillStyle = L.bg; g.fillRect(L.x, L.y, L.w, L.h); g.fillStyle = L.color;
      let x = L.x + u * 10; bars.forEach((b, i) => { if (i % 2 === 0) g.fillRect(x, L.y + 4, b * u + 0.3, L.h - th - 8); x += b * u; });
      if (th) { g.font = `600 ${Math.round(th * 0.85)}px "Roboto Mono", monospace`; g.textAlign = 'center'; g.textBaseline = 'bottom'; g.fillText(v, L.x + L.w / 2, L.y + L.h - 2); }
    }
  }
  g.restore();
}
/** Render one side of a card for one data row. */
export function renderSide(g, doc, side, row, ctx) {
  const { w: W, h: H } = SIZES[doc.size] || SIZES.cr80l, s = doc[side];
  g.save();
  rrect(g, 0, 0, W, H, doc.radius || 0); g.clip();
  drawBg(g, s.bg, W, H, ctx.assets);
  for (const L of s.layers) if (!L.hidden) drawEl(g, L, row, ctx);
  g.restore();
}
