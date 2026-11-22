/* WebcamClicks — Meme generator: your photo (or a webcam snap) + classic meme layouts, draggable outlined text,
   emoji stickers and effects (deep fry, B&W…). Copy or download as JPG/PNG. Nothing is uploaded. */

import { $, $$, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes, escapeHtml } from './common.js';

const $id = (s) => document.getElementById(s);
const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $id('mg-work'), stage: $id('mg-stage'), canvas: $id('mg-canvas'), sel: $id('mg-sel'),
  layouts: $id('mg-layouts'), texts: $id('mg-texts'), addText: $id('mg-addtext'), stickers: $id('mg-stickers'), fx: $id('mg-fx'),
  font: $id('mg-font'), size: $id('mg-size'), color: $id('mg-color'), stroke: $id('mg-stroke'), strokeW: $id('mg-strokew'), upper: $id('mg-upper'), align: $id('mg-align'),
  slotIn: $id('mg-slot-in'), cam: $id('mg-cam'), camBox: $id('mg-cambox'), camVideo: $id('mg-camvideo'), snap: $id('mg-snap'), camClose: $id('mg-camclose'),
  blank: $id('mg-blank'), fmt: $id('mg-fmt'), save: $id('mg-save'), copy: $id('mg-copy'), info: $id('mg-info'), del: $id('mg-del'), slotBtns: $id('mg-slotbtns')
};
if (!document.querySelector('link[data-mg-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = 'https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Montserrat:wght@800&family=Oswald:wght@700&family=Permanent+Marker&family=Playfair+Display:wght@700&display=swap'; l.dataset.mgFonts = '1'; document.head.appendChild(l); }

const FONTS = { impact: ['Impact', 'Impact, Anton, "Arial Black", sans-serif', 400, 'Impact (classic)'], arial: ['Arial', 'Arial, Helvetica, sans-serif', 700, 'Arial bold (caption)'], montserrat: ['Montserrat', 'Montserrat, sans-serif', 800, 'Montserrat'],
  oswald: ['Oswald', 'Oswald, sans-serif', 700, 'Oswald'], comic: ['Bangers', 'Bangers, "Comic Sans MS", cursive', 400, 'Comic'], marker: ['Marker', '"Permanent Marker", cursive', 400, 'Marker'], serif: ['Serif', '"Playfair Display", Georgia, "Times New Roman", serif', 700, 'Serif (poster)'] };
const STICKERS = ['😂', '🤣', '😭', '💀', '🔥', '😎', '🤔', '👀', '🙄', '😳', '🥲', '🤡', '💯', '👍', '👎', '🙏', '❤️', '💔', '🎉', '⭐', '⚡', '🚀', '💸', '🧠', '🗿', '🐸', '🐶', '🐱', '🍕', '☕', '✅', '❌', '⚠️', '❓', '💥', '🎯'];
const meas = document.createElement('canvas').getContext('2d');
let images = [];   // per slot: canvas | null
let layout = 'classic', texts = [], stickers = [], selId = null, fx = 'none', nid = 1, slotSel = 0;

/* ---------------------------------------------------------------- layouts */
const T = (o) => ({ id: nid++, text: '', x: 0, y: 0, w: 900, size: 84, font: 'impact', color: '#ffffff', stroke: '#000000', strokeW: 8, upper: true, align: 'center', ...o });
const LAYOUTS = {
  classic: { name: 'Top & bottom', slots: 1, build: (a) => { const W = 1080, H = Math.round(W * a(0)); return { W, H, bg: '#000', slots: [[0, 0, W, H]], fills: [], texts: [T({ text: 'TOP TEXT', x: 40, y: H * 0.03, w: W - 80, size: Math.round(W * 0.085) }), T({ text: 'BOTTOM TEXT', x: 40, y: H * 0.97 - W * 0.1, w: W - 80, size: Math.round(W * 0.085), anchor: 'bottom' })] }; } },
  caption: { name: 'Caption on top', slots: 1, build: (a) => { const W = 1080, ih = Math.round(W * a(0)), bar = 230; return { W, H: bar + ih, bg: '#fff', slots: [[0, bar, W, ih]], fills: [[0, 0, W, bar, '#ffffff']], texts: [T({ text: 'When you finally fix the bug and three new ones appear', x: 50, y: 40, w: W - 100, size: 54, font: 'arial', color: '#111111', strokeW: 0, upper: false, align: 'left', box: [0, 0, W, bar] })] }; } },
  compare: { name: 'This vs that', slots: 2, build: () => { const W = 1080, H = 1080, h = H / 2; return { W, H, bg: '#fff', slots: [[0, 0, W / 2, h], [0, h, W / 2, h]], fills: [[W / 2, 0, W / 2, H, '#ffffff'], [0, h - 2, W, 4, '#e5e7eb']], texts: [T({ text: 'Doing it the hard way', x: W / 2 + 40, y: h / 2 - 60, w: W / 2 - 80, size: 58, font: 'arial', color: '#111', strokeW: 0, upper: false }), T({ text: 'Using a free online tool', x: W / 2 + 40, y: h + h / 2 - 60, w: W / 2 - 80, size: 58, font: 'arial', color: '#111', strokeW: 0, upper: false })] }; } },
  side: { name: 'Side by side', slots: 2, build: () => { const W = 1200, H = 700; return { W, H, bg: '#000', slots: [[0, 0, W / 2 - 3, H], [W / 2 + 3, 0, W / 2 - 3, H]], fills: [], texts: [T({ text: 'EXPECTATION', x: 20, y: 24, w: W / 2 - 40, size: 72 }), T({ text: 'REALITY', x: W / 2 + 20, y: 24, w: W / 2 - 40, size: 72 })] }; } },
  comic: { name: '4-panel comic', slots: 4, build: () => { const W = 1080, H = 1080, g = 10, s = (W - g * 3) / 2; const sl = [[g, g, s, s], [g * 2 + s, g, s, s], [g, g * 2 + s, s, s], [g * 2 + s, g * 2 + s, s, s]]; return { W, H, bg: '#000', slots: sl, fills: [], texts: ['Me at 9 am', 'Me at noon', 'Me at 5 pm', 'Me at 11 pm'].map((t, i) => T({ text: t, x: sl[i][0] + 16, y: sl[i][1] + s - 90, w: s - 32, size: 52 })) }; } },
  poster: { name: 'Motivational poster', slots: 1, build: (a) => { const W = 1080, iw = 900, ih = Math.round(iw * Math.min(1.1, a(0))), H = 90 + ih + 330; return { W, H, bg: '#000', slots: [[90, 90, iw, ih]], fills: [], frame: [90, 90, iw, ih], texts: [T({ text: 'PERSEVERANCE', x: 60, y: 90 + ih + 50, w: W - 120, size: 96, font: 'serif', color: '#fff', strokeW: 0, upper: true, spacing: 8 }), T({ text: 'Because giving up is not an option. Probably.', x: 90, y: 90 + ih + 185, w: W - 180, size: 40, font: 'arial', color: '#e5e5e5', strokeW: 0, upper: false })] }; } }
};
let L = null;   // built layout
function aspect(i) { const im = images[i]; return im ? Math.max(0.35, Math.min(2.2, im.height / im.width)) : 0.75; }
function build(keepText) {
  const old = texts.map((t) => t.text);
  L = LAYOUTS[layout].build(aspect);
  const n = LAYOUTS[layout].slots; images = Array.from({ length: n }, (_, i) => images[i] || null);
  texts = L.texts; if (keepText) texts.forEach((t, i) => { if (old[i] != null && old[i] !== '') t.text = old[i]; });
  if (keepText === 'sticky') { /* keep stickers */ } else stickers = stickers.filter((s) => s.x < L.W && s.y < L.H);
  els.canvas.width = L.W; els.canvas.height = L.H; selId = null;
  renderTexts(); renderSlots(); draw();
}

/* ---------------------------------------------------------------- images & effects */
const fried = new Map();
async function fry(c) {
  if (fried.has(c)) return fried.get(c);
  const o = document.createElement('canvas'); o.width = c.width; o.height = c.height; const g = o.getContext('2d');
  g.filter = 'saturate(2.6) contrast(1.6) brightness(1.08)'; g.drawImage(c, 0, 0); g.filter = 'none';
  const d = g.getImageData(0, 0, o.width, o.height); for (let i = 0; i < d.data.length; i += 4) { const n = (Math.random() - 0.5) * 60; d.data[i] += n; d.data[i + 1] += n * 0.6; d.data[i + 2] -= n * 0.4; } g.putImageData(d, 0, 0);
  // crunch it with very low-quality JPEG, twice
  let src = o;
  for (let k = 0; k < 2; k++) { const b = await canvasToBlob(src, 'image/jpeg', 0.08); const bm = await createImageBitmap(b); const t = document.createElement('canvas'); t.width = o.width; t.height = o.height; t.getContext('2d').drawImage(bm, 0, 0); src = t; }
  fried.set(c, src); return src;
}
const FX = { none: 'Original', fry: '🍟 Deep fried', bw: 'Black & white', vintage: 'Vintage', vivid: 'Vivid', invert: 'Inverted', blur: 'Blurry' };
const FX_FILTER = { bw: 'grayscale(1) contrast(1.2)', vintage: 'sepia(.6) contrast(1.05) saturate(.9)', vivid: 'saturate(1.6) contrast(1.15)', invert: 'invert(1)', blur: 'blur(4px)' };
els.fx.innerHTML = Object.entries(FX).map(([k, n]) => `<button type="button" class="ss-chip" data-fx="${k}" aria-pressed="${k === fx}">${n}</button>`).join('');
els.fx.addEventListener('click', async (e) => { const b = e.target.closest('[data-fx]'); if (!b) return; fx = b.dataset.fx; $$('[data-fx]', els.fx).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); if (fx === 'fry') { for (const im of images) if (im) await fry(im); } draw(); });

async function toCanvas(file) {
  const im = await decodeImage(file), k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
  c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); return c;
}
async function addImages(files, slot = null) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|webp|avif)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Please add an image (or paste one with Ctrl+V).', 'err'); return; }
  const first = !L;
  if (first) { if (imgs.length >= 4) layout = 'comic'; else if (imgs.length >= 2) layout = 'side'; }
  let k = slot ?? (images.findIndex((x) => !x) >= 0 ? images.findIndex((x) => !x) : 0);
  for (const f of imgs) { try { const c = await toCanvas(f); images[k] = c; k = (k + 1) % LAYOUTS[layout].slots; } catch (_) { setStatus(els.status, `${f.name} could not be opened.`, 'err'); } }
  start();
}
function start() {
  els.work.hidden = false; els.drop.classList.add('compact'); els.save.disabled = els.copy.disabled = false;
  build(true); syncLayoutBtns();
  setStatus(els.status, 'Edit the texts on the right; drag them (or stickers) on the image. Click a picture area to replace it.', 'ok');
  if (fx === 'fry') Promise.all(images.filter(Boolean).map(fry)).then(draw);
}
setupDropzone(els.drop, els.input, (f) => addImages(f));
els.blank.addEventListener('click', () => { const c = document.createElement('canvas'); c.width = 1080; c.height = 810; const g = c.getContext('2d'); g.fillStyle = '#ffffff'; g.fillRect(0, 0, c.width, c.height); images = [c]; layout = 'caption'; start(); });
els.slotIn.addEventListener('change', () => { const fs = [...els.slotIn.files]; els.slotIn.value = ''; if (fs.length) addImages(fs, slotSel); });

/* webcam snapshot */
let camStream = null;
els.cam.addEventListener('click', async () => {
  try { camStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 960 } } }); els.camVideo.srcObject = camStream; els.camBox.hidden = false; await els.camVideo.play(); }
  catch (e) { setStatus(els.status, e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site and try again.' : 'No camera is available.', 'err'); }
});
const closeCam = () => { if (camStream) camStream.getTracks().forEach((t) => t.stop()); camStream = null; els.camBox.hidden = true; };
els.camClose.addEventListener('click', closeCam);
els.snap.addEventListener('click', () => {
  const v = els.camVideo, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d'); g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(v, 0, 0); closeCam();
  if (!L) images = [c]; else images[slotSel] = c;
  start();
});

/* ---------------------------------------------------------------- drawing */
function lines(t, size) {
  meas.font = fontCss(t, size); if ('letterSpacing' in meas) meas.letterSpacing = `${t.spacing || 0}px`;
  const raw = t.upper ? t.text.toUpperCase() : t.text, out = [];
  for (const para of raw.split('\n')) { let line = ''; for (const w of para.split(/(\s+)/)) { const s = line + w; if (line.trim() && meas.measureText(s).width > t.w && w.trim()) { out.push(line.trimEnd()); line = w.trimStart(); } else line = s; } out.push(line); }
  return out;
}
const fontCss = (t, size) => { const f = FONTS[t.font] || FONTS.impact; return `${f[2]} ${size}px ${f[1]}`; };
/** Text auto-shrinks so it never covers more than ~a third of the image. */
function layoutText(t) {
  let size = t.size, ls = lines(t, size);
  const maxH = t.box ? t.box[3] - 60 : L.H * 0.34;
  while (size > 14 && (ls.length * size * 1.12 > maxH || ls.some((l) => meas.measureText(l).width > t.w + 2))) { size = Math.round(size * 0.92); ls = lines(t, size); }
  const h = ls.length * size * 1.12;
  let y = t.y; if (t.anchor === 'bottom') y = t.y + t.size * 1.12 - h; if (t.box) y = t.box[1] + (t.box[3] - h) / 2;
  return { ls, size, h, y };
}
function textBounds(t) { const { h, y } = layoutText(t); return { x: t.x, y, w: t.w, h: Math.max(h, 20) }; }
function draw() {
  if (!L) return;
  const g = els.canvas.getContext('2d'), W = L.W, H = L.H;
  g.fillStyle = L.bg; g.fillRect(0, 0, W, H);
  for (const [x, y, w, h, c] of L.fills) { g.fillStyle = c; g.fillRect(x, y, w, h); }
  L.slots.forEach(([x, y, w, h], i) => {
    let im = images[i];
    g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
    if (!im) { g.fillStyle = '#d1d5db'; g.fillRect(x, y, w, h); g.fillStyle = '#6b7280'; g.font = `700 ${Math.round(Math.min(w, h) * 0.08)}px Inter, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+ Add image', x + w / 2, y + h / 2); }
    else {
      if (fx === 'fry' && fried.has(im)) im = fried.get(im);
      if (FX_FILTER[fx]) g.filter = FX_FILTER[fx];
      const s = Math.max(w / im.width, h / im.height); g.drawImage(im, x + (w - im.width * s) / 2, y + (h - im.height * s) / 2, im.width * s, im.height * s); g.filter = 'none';
    }
    g.restore();
  });
  if (L.frame) { const [x, y, w, h] = L.frame; g.strokeStyle = '#fff'; g.lineWidth = 4; g.strokeRect(x - 10, y - 10, w + 20, h + 20); }
  for (const t of texts) {
    if (!t.text.trim()) continue;
    const { ls, size, y } = layoutText(t);
    g.save(); g.font = fontCss(t, size); if ('letterSpacing' in g) g.letterSpacing = `${t.spacing || 0}px`; g.textBaseline = 'top'; g.lineJoin = 'round'; g.miterLimit = 2;
    ls.forEach((ln, k) => {
      const w = g.measureText(ln).width, x = t.align === 'left' ? t.x : t.align === 'right' ? t.x + t.w - w : t.x + (t.w - w) / 2, yy = y + k * size * 1.12;
      if (t.strokeW > 0) { g.lineWidth = Math.max(1, t.strokeW * size / 84); g.strokeStyle = t.stroke; g.strokeText(ln, x, yy); }
      g.fillStyle = t.color; g.fillText(ln, x, yy);
    });
    g.restore();
  }
  for (const s of stickers) { g.save(); g.font = `${s.size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.translate(s.x, s.y); g.rotate(s.rot || 0); g.fillText(s.emoji, 0, 0); g.restore(); }
  placeSel();
  els.info.textContent = `${W} × ${H} px`;
}
document.fonts && document.fonts.addEventListener('loadingdone', () => draw());

/* ---------------------------------------------------------------- selection & dragging */
const k = () => els.canvas.clientWidth / els.canvas.width;
function boundsOf(id) { const t = texts.find((x) => x.id === id); if (t) return textBounds(t); const s = stickers.find((x) => x.id === id); if (s) return { x: s.x - s.size / 2, y: s.y - s.size / 2, w: s.size, h: s.size }; return null; }
function placeSel() {
  const b = selId != null ? boundsOf(selId) : null; els.sel.hidden = !b; if (!b) return;
  const s = k(), ox = els.canvas.offsetLeft, oy = els.canvas.offsetTop;
  Object.assign(els.sel.style, { left: `${ox + b.x * s}px`, top: `${oy + b.y * s}px`, width: `${b.w * s}px`, height: `${b.h * s}px` });
  els.del.hidden = false;
}
function toC(e) { const r = els.canvas.getBoundingClientRect(), s = els.canvas.width / r.width; return [(e.clientX - r.left) * s, (e.clientY - r.top) * s]; }
let drag = null;
els.stage.addEventListener('pointerdown', (e) => {
  if (!L) return;
  const [x, y] = toC(e), handle = e.target.closest('[data-h]');
  let id = null;
  if (handle && selId != null) id = selId;
  else {
    for (let i = stickers.length - 1; i >= 0; i--) { const s = stickers[i]; if (Math.abs(x - s.x) < s.size / 2 && Math.abs(y - s.y) < s.size / 2) { id = s.id; break; } }
    if (id == null) for (let i = texts.length - 1; i >= 0; i--) { const b = textBounds(texts[i]); if (texts[i].text.trim() && x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) { id = texts[i].id; break; } }
  }
  selId = id; syncControls(); placeSel();
  if (id == null) {   // a picture area: select it for replacing
    const i = L.slots.findIndex(([sx, sy, sw, sh]) => x >= sx && x <= sx + sw && y >= sy && y <= sy + sh);
    if (i >= 0) { slotSel = i; renderSlots(); if (!images[i]) els.slotIn.click(); }
    els.del.hidden = true; return;
  }
  e.preventDefault(); els.stage.setPointerCapture(e.pointerId);
  const t = texts.find((q) => q.id === id), s = stickers.find((q) => q.id === id);
  drag = { id, handle: !!handle, x, y, o: t ? { x: t.x, y: t.y, w: t.w, size: t.size } : { x: s.x, y: s.y, size: s.size } };
});
els.stage.addEventListener('pointermove', (e) => {
  if (!drag) return; const [x, y] = toC(e), dx = x - drag.x, dy = y - drag.y;
  const t = texts.find((q) => q.id === drag.id), s = stickers.find((q) => q.id === drag.id);
  if (t) { if (drag.handle) t.w = Math.max(80, drag.o.w + dx); else { t.x = drag.o.x + dx; t.y = drag.o.y + dy; t.anchor = ''; t.box = null; } }
  if (s) { if (drag.handle) s.size = Math.max(24, drag.o.size + Math.max(dx, dy) * 1.4); else { s.x = drag.o.x + dx; s.y = drag.o.y + dy; } }
  draw();
});
const endDrag = () => { drag = null; };
els.stage.addEventListener('pointerup', endDrag); els.stage.addEventListener('pointercancel', endDrag);
els.del.addEventListener('click', () => { texts = texts.filter((t) => t.id !== selId); stickers = stickers.filter((s) => s.id !== selId); selId = null; els.del.hidden = true; renderTexts(); draw(); });
document.addEventListener('keydown', (e) => { if ((e.key === 'Delete' || e.key === 'Backspace') && selId != null && !/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) { e.preventDefault(); els.del.click(); } });

/* ---------------------------------------------------------------- panel */
els.layouts.innerHTML = Object.entries(LAYOUTS).map(([k2, v]) => `<button type="button" class="mg-layout" data-layout="${k2}"><span class="mg-ico mg-${k2}"></span><small>${v.name}</small></button>`).join('');
const syncLayoutBtns = () => $$('[data-layout]', els.layouts).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.layout === layout)));
els.layouts.addEventListener('click', (e) => { const b = e.target.closest('[data-layout]'); if (!b) return; layout = b.dataset.layout; syncLayoutBtns(); build(true); els.work.hidden = false; els.save.disabled = els.copy.disabled = false; });
function renderTexts() {
  els.texts.innerHTML = texts.map((t, i) => `<div class="mg-text${t.id === selId ? ' sel' : ''}" data-id="${t.id}"><textarea class="t-textarea" rows="1" data-id="${t.id}" placeholder="Text ${i + 1}">${escapeHtml(t.text)}</textarea><button type="button" class="t-icon-btn" data-rm="${t.id}" aria-label="Remove text">✕</button></div>`).join('');
}
els.texts.addEventListener('input', (e) => { const t = texts.find((q) => q.id === +e.target.dataset.id); if (t) { t.text = e.target.value; draw(); } });
els.texts.addEventListener('focusin', (e) => { const id = +e.target.dataset.id; if (id) { selId = id; syncControls(); placeSel(); $$('.mg-text', els.texts).forEach((x) => x.classList.toggle('sel', +x.dataset.id === id)); } });
els.texts.addEventListener('click', (e) => { const r = e.target.closest('[data-rm]'); if (r) { texts = texts.filter((t) => t.id !== +r.dataset.rm); selId = null; renderTexts(); draw(); } });
els.addText.addEventListener('click', () => {
  if (!L) return; const base = texts.find((t) => t.id === selId) || texts[0] || T({});
  const t = T({ ...base, id: nid++, text: 'NEW TEXT', x: L.W * 0.1, y: L.H * 0.45, w: L.W * 0.8, anchor: '', box: null }); texts.push(t); selId = t.id; renderTexts(); syncControls(); draw();
  els.texts.querySelector(`textarea[data-id="${t.id}"]`)?.select();
});
els.stickers.innerHTML = STICKERS.map((s) => `<button type="button" data-st="${s}">${s}</button>`).join('');
els.stickers.addEventListener('click', (e) => { const b = e.target.closest('[data-st]'); if (!b || !L) return; const s = { id: nid++, emoji: b.dataset.st, x: L.W * (0.3 + Math.random() * 0.4), y: L.H * (0.3 + Math.random() * 0.4), size: Math.round(Math.min(L.W, L.H) * 0.18) }; stickers.push(s); selId = s.id; draw(); });
els.font.innerHTML = Object.entries(FONTS).map(([k2, f]) => `<option value="${k2}">${f[3]}</option>`).join('');
function syncControls() {
  const t = texts.find((q) => q.id === selId) || texts[0]; if (!t) return;
  els.font.value = t.font; els.size.value = t.size; els.color.value = t.color; els.stroke.value = t.stroke; els.strokeW.value = t.strokeW; els.upper.checked = t.upper; els.align.value = t.align;
}
function applyStyle(all) {
  const targets = all ? texts : texts.filter((q) => q.id === selId).concat(selId == null ? texts : []);
  for (const t of targets) { t.font = els.font.value; t.size = +els.size.value; t.color = els.color.value; t.stroke = els.stroke.value; t.strokeW = +els.strokeW.value; t.upper = els.upper.checked; t.align = els.align.value; }
  draw();
}
[els.font, els.size, els.color, els.stroke, els.strokeW, els.upper, els.align].forEach((x) => x.addEventListener('input', () => applyStyle(false)));
$id('mg-apply-all').addEventListener('click', () => applyStyle(true));
function renderSlots() {
  const n = LAYOUTS[layout].slots;
  els.slotBtns.innerHTML = Array.from({ length: n }, (_, i) => `<button type="button" class="t-btn sm" data-slot="${i}">${n > 1 ? `Picture ${i + 1}: ` : ''}${images[i] ? 'replace' : 'add'}</button>`).join('');
}
els.slotBtns.addEventListener('click', (e) => { const b = e.target.closest('[data-slot]'); if (!b) return; slotSel = +b.dataset.slot; els.slotIn.click(); });

/* ---------------------------------------------------------------- export */
async function exportCanvas() { const s = selId; selId = null; if (fx === 'fry') for (const im of images) if (im) await fry(im); draw(); const c = document.createElement('canvas'); c.width = els.canvas.width; c.height = els.canvas.height; c.getContext('2d').drawImage(els.canvas, 0, 0); selId = s; placeSel(); return c; }
els.save.addEventListener('click', async () => {
  const c = await exportCanvas(), type = els.fmt.value, blob = await canvasToBlob(c, type, 0.92);
  downloadBlob(blob, `meme.${type === 'image/png' ? 'png' : 'jpg'}`); setStatus(els.status, `Saved (${formatBytes(blob.size)}).`, 'ok');
});
els.copy.addEventListener('click', async () => {
  try { const c = await exportCanvas(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(c, 'image/png') })]); setStatus(els.status, 'Copied! Paste it into WhatsApp Web, Discord, X or Slack.', 'ok'); }
  catch (_) { setStatus(els.status, 'Your browser blocked copying images; use Download instead.', 'err'); }
});
new ResizeObserver(() => placeSel()).observe(els.stage);
window.__mgTest = { get texts() { return texts; }, get layout() { return layout; }, get images() { return images; } };
