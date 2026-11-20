/* WebcamClicks — YouTube thumbnail studio: layers (text, photos, AI cut-outs, shapes, emoji), free move / resize /
   rotate with snapping, rich text effects, backgrounds & patterns, 14 templates + your own saved templates,
   undo/redo, autosave, best-frame finder for videos, 1280×720 export under 2 MB. All on-device. */

import { $, setupDropzone, setStatus, downloadBlob, loadMediabunny, decodeImage, canvasToBlob, formatBytes, splitName, escapeHtml } from './common.js';
import { createTask, personMask, MODELS } from '../segmentation/vision.js';
import { W, H, FONTS, FONTS_CSS, TEMPLATES, renderDoc, layoutText, hit, toLocal, text, image, shape, defaultBg, uid } from './thumb/engine.js';

const $$ = (s) => [...document.querySelectorAll(s)];
const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), cv: $('#tb-canvas'), ov: $('#tb-overlay'), stage: $('#tb-stage'),
  props: $('#tb-props'), layers: $('#tb-layers'), tpls: $('#tb-tpls'), mytpls: $('#tb-mytpls'), frames: $('#tb-frames'), vidBox: $('#tb-vidbox'),
  video: $('#tb-video'), seek: $('#tb-seek'), useFrame: $('#tb-useframe'), imgIn: $('#tb-imgin'), emoji: $('#tb-emoji'), shapeMenu: $('#tb-shapes'),
  mini: $('#tb-mini'), dark: $('#tb-dark'), safe: $('#tb-safe'), tplName: $('#tb-tplname'), tplImport: $('#tb-tplimport')
};
if (!document.querySelector('link[data-thumb-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.thumbFonts = '1'; document.head.appendChild(l); }

let doc = TEMPLATES[0].make();
const assets = new Map();     // id → canvas ('@subject' = AI cut-out of your photo)
let frame = null;             // your photo / video frame (canvas)
let sel = null, name = 'thumbnail';

/* ---------------------------------------------------------------- render loop */
let dirty = true;
const g = els.cv.getContext('2d'), og = els.ov.getContext('2d');
function render() { dirty = true; }
function frameLoop() {
  if (dirty) {
    dirty = false;
    renderDoc(g, doc, assets, frame);
    drawOverlay();
    const m = els.mini.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(els.cv, 0, 0, els.mini.width, els.mini.height);
    const d = els.dark.getContext('2d'); d.imageSmoothingQuality = 'high'; d.drawImage(els.cv, 0, 0, els.dark.width, els.dark.height);
  }
  requestAnimationFrame(frameLoop);
}
let guides = [];
function drawOverlay() {
  og.clearRect(0, 0, W, H);
  const k = W / (els.ov.clientWidth || W);   // keep handles the same size on screen
  if (els.safe.checked) {   // YouTube covers the bottom-right corner with the video length
    og.fillStyle = 'rgba(0,0,0,.75)'; og.beginPath(); og.roundRect(W - 150, H - 70, 130, 52, 8); og.fill();
    og.fillStyle = '#fff'; og.font = '700 34px Inter, sans-serif'; og.textAlign = 'center'; og.textBaseline = 'middle'; og.fillText('12:34', W - 85, H - 43);
  }
  og.strokeStyle = '#ff2d95'; og.lineWidth = 2 * k; og.setLineDash([8 * k, 6 * k]);
  for (const [x1, y1, x2, y2] of guides) { og.beginPath(); og.moveTo(x1, y1); og.lineTo(x2, y2); og.stroke(); }
  og.setLineDash([]);
  if (!sel || sel.hidden) return;
  og.save(); og.translate(sel.x, sel.y); og.rotate((sel.rot * Math.PI) / 180);
  og.strokeStyle = sel.locked ? '#9aa0ab' : '#ff4d2e'; og.lineWidth = 2.5 * k; og.strokeRect(-sel.w / 2, -sel.h / 2, sel.w, sel.h);
  if (!sel.locked) {
    og.fillStyle = '#fff';
    for (const [x, y] of corners(sel)) { og.beginPath(); og.arc(x, y, 9 * k, 0, Math.PI * 2); og.fill(); og.stroke(); }
    const [hx, hy] = rotHandle(sel, k), sgn = Math.sign(hy);
    og.beginPath(); og.moveTo(0, sgn * sel.h / 2); og.lineTo(hx, hy - sgn * 6 * k); og.stroke();
    og.beginPath(); og.arc(hx, hy, 10 * k, 0, Math.PI * 2); og.fillStyle = '#ff4d2e'; og.fill();
  }
  og.restore();
}
/** Rotate-handle position (layer-local). Flips below the layer when it would be off the top of the canvas. */
function rotHandle(L, k) {
  const a = (L.rot * Math.PI) / 180, d = L.h / 2 + 40 * k, topY = L.y - d * Math.cos(a);
  return topY < 14 * k ? [0, d] : [0, -d];
}
const corners = (L) => [[-L.w / 2, -L.h / 2], [L.w / 2, -L.h / 2], [L.w / 2, L.h / 2], [-L.w / 2, L.h / 2]];

/* ---------------------------------------------------------------- history & autosave */
let hist = [], fut = [], histT = 0, pending = false;
const snap = () => JSON.stringify(doc);
function commit(immediate) {
  clearTimeout(histT); pending = true;
  const f = () => { pending = false; const s = snap(); if (hist[hist.length - 1] !== s) { hist.push(s); if (hist.length > 80) hist.shift(); fut = []; } updateUndo(); autosave(); };
  if (immediate) f(); else histT = setTimeout(f, 350);
}
function restore(s) { const id = sel && sel.id; doc = JSON.parse(s); sel = doc.layers.find((l) => l.id === id) || null; refresh(); }
function flush() { if (pending) commit(true); }
function undo() { flush(); if (hist.length < 2) return; fut.push(hist.pop()); restore(hist[hist.length - 1]); updateUndo(); autosave(); }
function redo() { flush(); if (!fut.length) return; const s = fut.pop(); hist.push(s); restore(s); updateUndo(); autosave(); }
function updateUndo() { $('#tb-undo').disabled = hist.length < 2; $('#tb-redo').disabled = !fut.length; }

/* IndexedDB: autosave + my templates (images are stored once per design as compressed data URLs) */
const idb = new Promise((res) => { try { const r = indexedDB.open('wc-thumb', 1); r.onupgradeneeded = () => { r.result.createObjectStore('kv'); r.result.createObjectStore('tpl', { keyPath: 'id' }); }; r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (_) { res(null); } });
const tx = async (store, mode, fn) => { const db = await idb; if (!db) return null; return new Promise((res) => { const t = db.transaction(store, mode), s = t.objectStore(store); const r = fn(s); t.oncomplete = () => res(r && r.result); t.onerror = () => res(null); }); };
function usedAssets(d) { const ids = new Set(d.layers.filter((l) => l.type === 'image' && l.asset && !l.asset.startsWith('@')).map((l) => l.asset)); if (d.bg.asset) ids.add(d.bg.asset); return [...ids]; }
const toUrl = (c) => c.toDataURL(hasAlpha(c) ? 'image/png' : 'image/jpeg', 0.88);
function hasAlpha(c) { try { const d = c.getContext('2d').getImageData(0, 0, Math.min(40, c.width), Math.min(40, c.height)).data; for (let i = 3; i < d.length; i += 4) if (d[i] < 250) return true; } catch (_) { /* ignore */ } return false; }
async function fromUrl(u) { const img = new Image(); img.src = u; await img.decode(); const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight; c.getContext('2d').drawImage(img, 0, 0); return c; }
let saveT = 0;
function autosave() {
  clearTimeout(saveT);
  saveT = setTimeout(async () => {
    const pack = { doc, assets: Object.fromEntries(usedAssets(doc).filter((id) => assets.get(id)).map((id) => [id, toUrl(assets.get(id))])) };
    if (frame) pack.frame = frame.toDataURL('image/jpeg', 0.85);
    if (assets.get('@subject')) pack.subject = assets.get('@subject').toDataURL('image/png');
    await tx('kv', 'readwrite', (s) => s.put(pack, 'autosave'));
  }, 800);
}
async function loadAutosave() {
  const pack = await tx('kv', 'readonly', (s) => s.get('autosave')); if (!pack || !pack.doc) return false;
  for (const [id, u] of Object.entries(pack.assets || {})) assets.set(id, await fromUrl(u));
  if (pack.frame) frame = await fromUrl(pack.frame);
  if (pack.subject) assets.set('@subject', await fromUrl(pack.subject));
  doc = pack.doc; return true;
}

/* ---------------------------------------------------------------- your photo / video */
let seg = null;
async function setPhoto(c, cut = true) {
  const k = Math.min(1, 2000 / Math.max(c.width, c.height)), f = document.createElement('canvas');
  f.width = Math.round(c.width * k); f.height = Math.round(c.height * k); f.getContext('2d').drawImage(c, 0, 0, f.width, f.height);
  frame = f; render();
  if (cut) await cutOut();
  commit(true);
}
async function cutOut() {
  if (!frame) return;
  setStatus(els.status, 'Cutting you out of the background (AI)…');
  try {
    if (!seg) seg = await createTask('ImageSegmenter', { baseOptions: { modelAssetPath: MODELS.segmenterSquare }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    const c = await cutCanvas(frame);
    if (!c) { assets.delete('@subject'); setStatus(els.status, 'No person found in this photo. The photo is still used as the background; add images with “+ Image”.', 'err'); render(); return; }
    assets.set('@subject', c);
    setStatus(els.status, 'Done. Click anything on the thumbnail to edit it; drag to move, corners to resize, the dot to rotate.', 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, 'The AI cut-out could not run on this device.', 'err'); }
  render();
}
async function cutCanvas(src) {
  const res = seg.segment(src), m = personMask(res), conf = m.getAsFloat32Array();
  const mk = document.createElement('canvas'); mk.width = m.width; mk.height = m.height;
  const id = mk.getContext('2d').createImageData(m.width, m.height); let cover = 0;
  for (let i = 0; i < conf.length; i++) { const a = Math.min(1, Math.max(0, (conf[i] - 0.35) * 3)); id.data[i * 4 + 3] = a * 255; cover += a; }
  mk.getContext('2d').putImageData(id, 0, 0); if (res.close) res.close();
  if (cover / conf.length < 0.02) return null;
  const full = document.createElement('canvas'); full.width = src.width; full.height = src.height;
  const fg = full.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(mk, 0, 0, full.width, full.height); fg.globalCompositeOperation = 'source-in'; fg.drawImage(src, 0, 0);
  const d = fg.getImageData(0, 0, full.width, full.height).data; let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
  for (let y = 0; y < full.height; y += 2) for (let x = 0; x < full.width; x += 2) if (d[(y * full.width + x) * 4 + 3] > 40) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const cut = document.createElement('canvas'); cut.width = Math.max(1, x1 - x0 + 1); cut.height = Math.max(1, y1 - y0 + 1);
  cut.getContext('2d').drawImage(full, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
  return cut;
}
async function openFile(f) {
  name = splitName(f.name)[0];
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) return openVideo(f);
  const bmp = await decodeImage(f); const c = document.createElement('canvas'); c.width = bmp.width || bmp.naturalWidth; c.height = bmp.height || bmp.naturalHeight; c.getContext('2d').drawImage(bmp, 0, 0);
  els.vidBox.hidden = true; await setPhoto(c);
}
async function openVideo(f) {
  setStatus(els.status, 'Finding the best frames…'); els.vidBox.hidden = false;
  if (els.video.src) URL.revokeObjectURL(els.video.src); els.video.src = URL.createObjectURL(f);
  const MB = await loadMediabunny(), input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack(); if (!vt) { setStatus(els.status, 'This file has no video.', 'err'); return; }
  const duration = await input.computeDuration(), first = await vt.getFirstTimestamp().catch(() => 0);
  els.seek.max = duration;
  const N = Math.min(24, Math.max(6, Math.round(duration))), times = Array.from({ length: N }, (_, i) => first + duration * (0.03 + 0.94 * (i / (N - 1))));
  const det = await createTask('FaceDetector', { baseOptions: { modelAssetPath: MODELS.faceDetector }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 }).catch(() => null);
  const small = document.createElement('canvas'); small.width = 320; small.height = Math.round(320 * vt.displayHeight / vt.displayWidth);
  const sg = small.getContext('2d', { willReadFrequently: true }), cands = []; let i = 0;
  for await (const sm of new MB.VideoSampleSink(vt).samplesAtTimestamps(times)) {
    if (sm) {
      const full = document.createElement('canvas'); full.width = vt.displayWidth; full.height = vt.displayHeight; full.getContext('2d').drawImage(sm.toCanvasImageSource(), 0, 0); sm.close();
      sg.drawImage(full, 0, 0, small.width, small.height);
      cands.push({ t: times[i] - first, canvas: full, ...scoreFrame(sg, small.width, small.height, det ? det.detect(small) : null) });
    }
    if (++i % 4 === 0) setStatus(els.status, `Finding the best frames… ${Math.round((i / N) * 100)}%`);
  }
  if (det && det.close) det.close();
  cands.sort((a, b) => b.score - a.score);
  const picks = []; for (const c of cands) { if (picks.every((p) => Math.abs(p.t - c.t) > duration / 20)) picks.push(c); if (picks.length === 6) break; }
  els.frames.innerHTML = picks.map((p, k) => `<button type="button" class="tm-frame" data-k="${k}"><img src="${thumbUrl(p.canvas)}" alt="Frame at ${p.t.toFixed(1)} s"></button>`).join('');
  els.frames.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) setPhoto(picks[+b.dataset.k].canvas); };
  if (picks.length) await setPhoto(picks[0].canvas);
  setStatus(els.status, `Picked the best frame${picks[0] && picks[0].face ? ' with a clear face' : ''}${assets.get('@subject') ? '' : ' (no person could be cut out of it)'}. Try the other suggestions or scrub to any moment.`, 'ok');
}
function thumbUrl(c) { const t = document.createElement('canvas'); t.width = 240; t.height = Math.round(240 * c.height / c.width); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.75); }
function scoreFrame(gg, w, h, faces) {
  const d = gg.getImageData(0, 0, w, h).data, L = new Float32Array(w * h); let sum = 0;
  for (let i = 0, j = 0; j < L.length; i += 4, j++) { L[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += L[j]; }
  let lap = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x, v = 4 * L[k] - L[k - 1] - L[k + 1] - L[k - w] - L[k + w]; lap += v * v; }
  let face = 0; for (const f of (faces && faces.detections) || []) face = Math.max(face, f.boundingBox.width / w);
  return { score: Math.log10(1 + lap / ((w - 2) * (h - 2))) + face * 8 - Math.abs(sum / L.length - 125) / 60, face };
}
els.seek.addEventListener('input', () => { els.video.currentTime = +els.seek.value; });
els.useFrame.addEventListener('click', () => { const v = els.video; if (!v.videoWidth) return; const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0); setPhoto(c); });

/* ---------------------------------------------------------------- adding things */
function add(L) { doc.layers.push(L); sel = L; refresh(); commit(true); }
$('#tb-add-text').addEventListener('click', () => add(text({ x: W / 2, y: H / 2, w: 760, text: 'NEW *TEXT*', size: 100, align: 'center' })));
$('#tb-add-image').addEventListener('click', () => els.imgIn.click());
els.imgIn.addEventListener('change', async () => {
  const f = els.imgIn.files[0]; els.imgIn.value = ''; if (!f) return;
  const bmp = await decodeImage(f), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas');
  c.width = Math.round((bmp.width || bmp.naturalWidth) * k); c.height = Math.round((bmp.height || bmp.naturalHeight) * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  const id = uid(); assets.set(id, c);
  // fill an empty image slot of the template if there is one, otherwise add a new layer
  const slot = doc.layers.find((l) => l.type === 'image' && l.role === 'image' && !assets.get(l.asset));
  if (slot) { slot.asset = id; sel = slot; refresh(); commit(true); }
  else { const s = Math.min(500 / c.width, 500 / c.height); add(image({ asset: id, x: W / 2, y: H / 2, w: c.width * s, h: c.height * s, name: splitName(f.name)[0].slice(0, 24), outline: 0, shadow: 20 })); }
});
els.shapeMenu.addEventListener('click', (e) => {
  const b = e.target.closest('[data-shape]'); if (!b) return;
  const k = b.dataset.shape, o = { shape: k, name: b.textContent.trim() };
  if (k === 'arrow') Object.assign(o, { w: 260, h: 140, fill: '#ff2d2d' });
  if (k === 'circle' || k === 'ring' || k === 'burst') Object.assign(o, { w: 260, h: 260, fill: k === 'burst' ? '#ffe14d' : '#ff2d2d' });
  if (k === 'line') Object.assign(o, { w: 400, h: 12, fill: '#ffffff' });
  if (k === 'rect') Object.assign(o, { w: 420, h: 110, fill: '#ffe14d', radius: 18 });
  els.shapeMenu.closest('details').open = false;
  add(shape(o));
});
const EMOJI = '😱😮🤯😂🤣😍🥵🥶😡🤔🙄😭🔥💯⚠️❌✅⭐💰💸💎🚀🎯📈📉🏆👀👉👆🤑🤫😴💀👻🎮📱💻🎬🎤🍔⏰❤️💔'.match(/\p{Extended_Pictographic}️?/gu);
els.emoji.innerHTML = EMOJI.map((e) => `<button type="button" data-e="${e}">${e}</button>`).join('');
els.emoji.addEventListener('click', (e) => { const b = e.target.closest('[data-e]'); if (!b) return; els.emoji.closest('details').open = false; add(text({ text: b.dataset.e, font: 'inter', size: 180, upper: false, strokeW: 0, shadowBlur: 24, shadowY: 8, x: W / 2, y: H / 2, w: 240, align: 'center', name: `Emoji ${b.dataset.e}` })); });

/* ---------------------------------------------------------------- pointer: select, move, resize, rotate, pinch */
const toCanvas = (e) => { const r = els.ov.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
let drag = null; const pts = new Map();
els.ov.addEventListener('pointerdown', (e) => {
  pts.set(e.pointerId, toCanvas(e));
  els.ov.setPointerCapture(e.pointerId);
  if (pts.size === 2 && sel && !sel.locked) {   // pinch: resize + rotate
    const [a, b] = [...pts.values()];
    drag = { mode: 'pinch', d0: Math.hypot(a[0] - b[0], a[1] - b[1]), a0: Math.atan2(b[1] - a[1], b[0] - a[0]), L0: { ...sel } };
    return;
  }
  const p = toCanvas(e), k = W / els.ov.clientWidth, tol = 18 * k;
  if (sel && !sel.locked && !sel.hidden) {
    const [lx, ly] = toLocal(sel, p[0], p[1]);
    const [hx, hy] = rotHandle(sel, k);
    if (Math.hypot(lx - hx, ly - hy) < tol * 1.2) { drag = { mode: 'rotate', flip: hy > 0 }; e.preventDefault(); return; }
    const ci = corners(sel).findIndex(([cx, cy]) => Math.hypot(lx - cx, ly - cy) < tol);
    if (ci >= 0) { drag = { mode: 'scale', ci, L0: { ...sel }, r0: Math.hypot(lx, ly) }; e.preventDefault(); return; }
  }
  const L = hit(doc, p[0], p[1]);
  sel = L; refresh();
  if (L && !L.locked) { drag = { mode: 'move', p0: p, x0: L.x, y0: L.y }; e.preventDefault(); }
  if (e.detail === 2 && L && L.type === 'text') { const ta = els.props.querySelector('[data-k="text"]'); if (ta) { ta.focus(); ta.select(); } }
});
els.ov.addEventListener('pointermove', (e) => {
  if (pts.has(e.pointerId)) pts.set(e.pointerId, toCanvas(e));
  if (!drag || !sel) return;
  const p = toCanvas(e);
  if (drag.mode === 'pinch' && pts.size === 2) {
    const [a, b] = [...pts.values()], f = Math.hypot(a[0] - b[0], a[1] - b[1]) / drag.d0;
    applyScale(drag.L0, f); sel.rot = drag.L0.rot + ((Math.atan2(b[1] - a[1], b[0] - a[0]) - drag.a0) * 180) / Math.PI;
  } else if (drag.mode === 'move') {
    let x = drag.x0 + p[0] - drag.p0[0], y = drag.y0 + p[1] - drag.p0[1];
    guides = []; const S = 10 * (W / els.ov.clientWidth);
    const xs = [[W / 2, 0], [sel.w / 2, -1], [W - sel.w / 2, 1]], ys = [[H / 2, 0], [sel.h / 2, -1], [H - sel.h / 2, 1]];
    for (const L of doc.layers) if (L !== sel && !L.hidden) { xs.push([L.x, 2]); ys.push([L.y, 2]); }
    for (const [v] of xs) if (Math.abs(x - v) < S && !e.shiftKey) { x = v; guides.push([x === v && v === W / 2 ? W / 2 : x, 0, x, H]); break; }
    for (const [v] of ys) if (Math.abs(y - v) < S && !e.shiftKey) { y = v; guides.push([0, y, W, y]); break; }
    sel.x = x; sel.y = y;
  } else if (drag.mode === 'scale') {
    const [lx, ly] = toLocal(drag.L0, p[0], p[1]);
    applyScale(drag.L0, Math.max(0.05, Math.hypot(lx, ly) / drag.r0), e.shiftKey ? [Math.abs(lx) / (drag.L0.w / 2), Math.abs(ly) / (drag.L0.h / 2)] : null);
  } else if (drag.mode === 'rotate') {
    let a = (Math.atan2(p[1] - sel.y, p[0] - sel.x) * 180) / Math.PI + (drag.flip ? -90 : 90);
    for (const s of [0, 90, 180, 270, -90, 360]) if (Math.abs(a - s) < 4) a = s;
    sel.rot = Math.round(a * 10) / 10;
  }
  render(); syncProps();
});
function applyScale(L0, f, free) {
  if (sel.type === 'text') { sel.size = Math.max(12, Math.round(L0.size * f)); sel.w = Math.max(60, L0.w * f); sel.strokeW = +(L0.strokeW * f).toFixed(1); sel.extrude = Math.round(L0.extrude * f); }
  else if (free && sel.type === 'shape') { sel.w = Math.max(10, L0.w * free[0]); sel.h = Math.max(6, L0.h * free[1]); }
  else { sel.w = Math.max(10, L0.w * f); sel.h = Math.max(6, L0.h * f); }
}
const endPtr = (e) => { pts.delete(e.pointerId); if (drag) { drag = null; guides = []; render(); commit(); renderLayers(); } };
els.ov.addEventListener('pointerup', endPtr); els.ov.addEventListener('pointercancel', endPtr);
els.ov.addEventListener('wheel', (e) => { if (!sel || sel.locked) return; e.preventDefault(); const L0 = { ...sel }; applyScale(L0, e.deltaY < 0 ? 1.05 : 0.95); render(); syncProps(); commit(); }, { passive: false });

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  const mod = e.ctrlKey || e.metaKey;
  if (mod && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if (mod && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (!sel) return;
  if (mod && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicate(); return; }
  if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); return; }
  if (e.key === 'Escape') { sel = null; refresh(); return; }
  const n = e.shiftKey ? 10 : 2, mv = { ArrowLeft: [-n, 0], ArrowRight: [n, 0], ArrowUp: [0, -n], ArrowDown: [0, n] }[e.key];
  if (mv && !sel.locked) { e.preventDefault(); sel.x += mv[0]; sel.y += mv[1]; render(); commit(); }
});
function duplicate() { if (!sel) return; const c = JSON.parse(JSON.stringify(sel)); c.id = uid(); c.x += 30; c.y += 30; c.name = `${sel.name} copy`; doc.layers.splice(doc.layers.indexOf(sel) + 1, 0, c); sel = c; refresh(); commit(true); }
function removeSel() { if (!sel) return; doc.layers = doc.layers.filter((l) => l !== sel); sel = null; refresh(); commit(true); }
function move(dir) { if (!sel) return; const i = doc.layers.indexOf(sel), j = dir === 'top' ? doc.layers.length - 1 : dir === 'bottom' ? 0 : i + dir; if (j < 0 || j >= doc.layers.length) return; doc.layers.splice(i, 1); doc.layers.splice(j, 0, sel); refresh(); commit(true); }
$('#tb-undo').addEventListener('click', undo); $('#tb-redo').addEventListener('click', redo);
$('#tb-dup').addEventListener('click', duplicate); $('#tb-del').addEventListener('click', removeSel);
$('#tb-fwd').addEventListener('click', () => move(1)); $('#tb-back').addEventListener('click', () => move(-1));
els.safe.addEventListener('change', render);

/* ---------------------------------------------------------------- property panels (generated from a schema) */
const FONT_OPTS = Object.entries(FONTS).map(([k, v]) => [k, v[2]]);
const SCHEMA = {
  text: [['Text', [['text', 'Text', 'textarea', { hint: 'Put *stars* around words to highlight them' }]]],
    ['Font', [['font', 'Font', 'select', FONT_OPTS], ['size', 'Size', 'range', [20, 400]], ['upper', 'CAPITALS', 'check'], ['align', 'Align', 'select', [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']]], ['spacing', 'Letter spacing', 'range', [-10, 40]], ['lineH', 'Line height', 'range', [0.7, 1.6, 0.02]], ['w', 'Box width', 'range', [60, 1280]]]],
    ['Colour', [['color', 'Text', 'color'], ['color2', 'Gradient to', 'color?'], ['hl', '*Highlight*', 'color']]],
    ['Effects', [['strokeW', 'Outline', 'range', [0, 30]], ['stroke', 'Outline colour', 'color'], ['shadowBlur', 'Shadow blur', 'range', [0, 80]], ['shadowY', 'Shadow drop', 'range', [-20, 40]], ['shadow', 'Shadow colour', 'color'], ['extrude', '3D depth', 'range', [0, 30]], ['extrudeColor', '3D colour', 'color'], ['box', 'Background box', 'color?'], ['boxPad', 'Box padding', 'range', [0, 60]], ['boxRadius', 'Box corners', 'range', [0, 60]]]],
    ['Layer', [['rot', 'Rotation', 'range', [-180, 180]], ['opacity', 'Opacity', 'range', [0.05, 1, 0.01]]]]],
  image: [['Photo', [['asset', 'Image', 'asset'], ['fit', 'Fit', 'select', [['contain', 'Whole image'], ['cover', 'Fill the box (crop)']]], ['flip', 'Mirror', 'check']]],
    ['Sticker look', [['outline', 'Outline', 'range', [0, 40]], ['outlineColor', 'Outline colour', 'color'], ['glow', 'Glow', 'range', [0, 90]], ['glowColor', 'Glow colour', 'color'], ['shadow', 'Shadow', 'range', [0, 80]]]],
    ['Adjust', [['bright', 'Brightness', 'range', [40, 180]], ['contrast', 'Contrast', 'range', [40, 200]], ['sat', 'Saturation', 'range', [0, 250]]]],
    ['Frame', [['radius', 'Corners', 'range', [0, 200]], ['border', 'Border', 'range', [0, 40]], ['borderColor', 'Border colour', 'color']]],
    ['Layer', [['rot', 'Rotation', 'range', [-180, 180]], ['opacity', 'Opacity', 'range', [0.05, 1, 0.01]]]]],
  shape: [['Shape', [['shape', 'Type', 'select', [['rect', 'Rectangle / bar'], ['circle', 'Circle'], ['ring', 'Ring'], ['arrow', 'Arrow'], ['burst', 'Burst'], ['line', 'Line']]], ['fill', 'Fill', 'color'], ['fill2', 'Gradient to', 'color?'], ['stroke', 'Outline', 'color?'], ['strokeW', 'Outline width', 'range', [0, 40]], ['radius', 'Corners', 'range', [0, 200]]]],
    ['Layer', [['rot', 'Rotation', 'range', [-180, 180]], ['opacity', 'Opacity', 'range', [0.05, 1, 0.01]]]]],
  bg: [['Background', [['type', 'Style', 'select', [['gradient', 'Gradient'], ['radial', 'Spotlight gradient'], ['solid', 'Solid colour'], ['image', 'Photo']]], ['c1', 'Colour 1', 'color'], ['c2', 'Colour 2', 'color'], ['c3', 'Middle colour', 'color?'], ['angle', 'Angle', 'range', [0, 360]]]],
    ['Photo background', [['frame', 'Use my photo / video frame', 'check'], ['asset', 'Or another image', 'asset'], ['blur', 'Blur', 'range', [0, 100]], ['dim', 'Darken', 'range', [0, 90]], ['zoom', 'Zoom', 'range', [100, 250]]]],
    ['Overlay', [['pattern', 'Pattern', 'select', [['none', 'None'], ['rays', 'Sun rays'], ['dots', 'Halftone dots'], ['grid', 'Grid'], ['stripes', 'Stripes'], ['vignette', 'Vignette']]], ['patternColor', 'Pattern colour', 'color'], ['patternOpacity', 'Strength', 'range', [0, 0.6, 0.01]]]]]
};
function field(obj, [k, label, kind, opt]) {
  const v = obj[k];
  if (kind === 'textarea') return `<label class="t-field">${label}${opt && opt.hint ? `<small>${opt.hint}</small>` : ''}<textarea class="t-textarea" rows="3" data-k="${k}">${escapeHtml(v)}</textarea></label>`;
  if (kind === 'select') return `<label class="t-field">${label}<select class="t-select" data-k="${k}">${opt.map(([a, b]) => `<option value="${a}"${String(v) === String(a) ? ' selected' : ''}>${b}</option>`).join('')}</select></label>`;
  if (kind === 'check') return `<label class="t-check"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}> ${label}</label>`;
  if (kind === 'color') return `<label class="tb-color">${label}<input type="color" data-k="${k}" value="${toHex(v)}"></label>`;
  if (kind === 'color?') return `<label class="tb-color">${label}<span><input type="checkbox" data-on="${k}"${v ? ' checked' : ''} aria-label="Use ${label}"><input type="color" data-k="${k}" value="${toHex(v || '#ffffff')}"${v ? '' : ' disabled'}></span></label>`;
  if (kind === 'asset') return `<div class="t-field">${label}<div class="t-actions" style="margin:0"><button type="button" class="t-btn sm" data-pick="${k}">Choose image…</button>${obj === doc.bg ? '' : '<button type="button" class="t-btn sm" data-cutout>✂ Remove background (AI)</button>'}</div></div>`;
  const [mn, mx, st] = opt; return `<label class="t-field tb-range">${label}<span><input class="t-range" type="range" data-k="${k}" min="${mn}" max="${mx}" step="${st || 1}" value="${v}"><output>${fmtN(v)}</output></span></label>`;
}
const fmtN = (v) => (typeof v === 'number' ? (Number.isInteger(v) ? v : v.toFixed(2)) : v);
function toHex(c) { if (/^#[0-9a-f]{6}$/i.test(c)) return c; const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(c || ''); return m ? `#${[m[1], m[2], m[3]].map((x) => (+x).toString(16).padStart(2, '0')).join('')}` : '#000000'; }
function renderProps() {
  const obj = sel || doc.bg, sch = sel ? SCHEMA[sel.type] : SCHEMA.bg;
  const head = sel ? `<div class="tb-prophead"><input class="t-input" data-name value="${escapeHtml(sel.name)}" aria-label="Layer name"><button type="button" class="t-btn sm" data-desel>Background</button></div>`
    : '<p class="muted tb-hint">Click anything on the thumbnail to edit it. These are the background settings.</p>';
  els.props.innerHTML = head + sch.map(([title, fields], i) => `<details class="tb-sec"${i < 2 ? ' open' : ''}><summary>${title}</summary>${fields.map((f) => field(obj, f)).join('')}</details>`).join('');
}
function syncProps() { const obj = sel || doc.bg; els.props.querySelectorAll('[data-k]').forEach((el) => { const v = obj[el.dataset.k]; if (el.type === 'range' && document.activeElement !== el) { el.value = v; const o = el.parentElement.querySelector('output'); if (o) o.textContent = fmtN(v); } }); }
els.props.addEventListener('input', (e) => {
  const obj = sel || doc.bg, t = e.target;
  if (t.dataset.name !== undefined) { sel.name = t.value; renderLayers(); commit(); return; }
  if (t.dataset.on) { const c = els.props.querySelector(`[data-k="${t.dataset.on}"]`); c.disabled = !t.checked; obj[t.dataset.on] = t.checked ? c.value : ''; render(); commit(); return; }
  const k = t.dataset.k; if (!k) return;
  let v = t.type === 'checkbox' ? t.checked : t.type === 'range' ? +t.value : t.value;
  if (k === 'type' && v === 'image' && !obj.asset) obj.frame = true;
  obj[k] = v;
  if (t.type === 'range') { const o = t.parentElement.querySelector('output'); if (o) o.textContent = fmtN(v); }
  render(); commit();
  if (k === 'type' || k === 'shape') renderProps();
});
els.props.addEventListener('click', async (e) => {
  if (e.target.closest('[data-desel]')) { sel = null; refresh(); return; }
  const pick = e.target.closest('[data-pick]');
  if (pick) {
    const inp = document.createElement('input'); inp.type = 'file'; inp.accept = 'image/*,.heic';
    inp.onchange = async () => { const f = inp.files[0]; if (!f) return; const bmp = await decodeImage(f), k = Math.min(1, 2000 / Math.max(bmp.width, bmp.height)), c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k); c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height); const id = uid(); assets.set(id, c); const obj = sel || doc.bg; obj.asset = id; if (!sel) { obj.type = 'image'; obj.frame = false; } refresh(); commit(true); };
    inp.click(); return;
  }
  if (e.target.closest('[data-cutout]') && sel && sel.type === 'image') {
    const src = sel.asset === '@subject' || sel.asset === '@frame' ? frame : assets.get(sel.asset); if (!src) return;
    setStatus(els.status, 'Removing the background…');
    if (!seg) seg = await createTask('ImageSegmenter', { baseOptions: { modelAssetPath: MODELS.segmenterSquare }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    const c = await cutCanvas(src);
    if (!c) { setStatus(els.status, 'No person found in this image. The AI cut-out works on people.', 'err'); return; }
    const id = uid(); assets.set(id, c); sel.asset = id; sel.fit = 'contain'; render(); commit(true); setStatus(els.status, 'Background removed.', 'ok');
  }
});

/* ---------------------------------------------------------------- layers panel */
const TYPE_ICO = { text: 'T', image: '🖼', shape: '◼' };
function renderLayers() {
  els.layers.innerHTML = doc.layers.slice().reverse().map((L) => `<li class="${L === sel ? 'sel' : ''}" data-id="${L.id}"><span class="tb-lt">${TYPE_ICO[L.type]}</span><span class="tb-ln">${escapeHtml(L.type === 'text' ? L.text.replace(/\*/g, '').slice(0, 28) || L.name : L.name)}</span>
    <button type="button" data-act="vis" title="${L.hidden ? 'Show' : 'Hide'}" aria-label="${L.hidden ? 'Show' : 'Hide'}">${L.hidden ? '◌' : '👁'}</button><button type="button" data-act="lock" title="${L.locked ? 'Unlock' : 'Lock'}" aria-label="${L.locked ? 'Unlock' : 'Lock'}">${L.locked ? '🔒' : '🔓'}</button>
    <button type="button" data-act="up" aria-label="Bring forward">▲</button><button type="button" data-act="down" aria-label="Send backward">▼</button></li>`).join('') + '<li class="tb-bgrow' + (sel ? '' : ' sel') + '" data-id="bg"><span class="tb-lt">▦</span><span class="tb-ln">Background</span></li>';
}
els.layers.addEventListener('click', (e) => {
  const li = e.target.closest('li'); if (!li) return;
  if (li.dataset.id === 'bg') { sel = null; refresh(); return; }
  const L = doc.layers.find((l) => l.id === li.dataset.id); const act = e.target.closest('[data-act]');
  if (act) {
    const a = act.dataset.act;
    if (a === 'vis') L.hidden = !L.hidden; if (a === 'lock') L.locked = !L.locked;
    if (a === 'up' || a === 'down') { sel = L; move(a === 'up' ? 1 : -1); return; }
    refresh(); commit(true); return;
  }
  sel = L; refresh();
});
function refresh() { render(); renderProps(); renderLayers(); }

/* ---------------------------------------------------------------- templates: built-in + mine */
const thumbOf = (d) => { const c = document.createElement('canvas'); c.width = W; c.height = H; renderDoc(c.getContext('2d'), d, assets, frame); const t = document.createElement('canvas'); t.width = 320; t.height = 180; t.getContext('2d').drawImage(c, 0, 0, 320, 180); return t.toDataURL('image/jpeg', 0.8); };
function renderTemplates() { els.tpls.innerHTML = TEMPLATES.map((t) => `<button type="button" class="tb-tpl" data-tpl="${t.id}"><img alt="" src="${thumbOf(t.make())}"><span>${escapeHtml(t.name)}</span></button>`).join(''); }
function applyTemplate(d) {
  // keep your text: the first text layer of the old design replaces the template's first headline
  const oldText = doc.layers.find((l) => l.role === 'headline') || doc.layers.filter((l) => l.type === 'text' && l.text.length > 3).sort((a, b) => b.size * b.text.length - a.size * a.text.length)[0];
  doc = d;
  const newText = doc.layers.find((l) => l.role === 'headline');
  if (oldText && newText && keepText.checked) newText.text = oldText.text;
  sel = null; refresh(); commit(true);
}
const keepText = $('#tb-keeptext');
els.tpls.addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) applyTemplate(TEMPLATES.find((t) => t.id === b.dataset.tpl).make()); });

async function renderMine() {
  const list = (await tx('tpl', 'readonly', (s) => s.getAll())) || [];
  els.mytpls.innerHTML = list.length ? list.sort((a, b) => b.at - a.at).map((t) => `<div class="tb-tpl mine"><button type="button" data-mine="${t.id}"><img alt="" src="${t.thumb}"><span>${escapeHtml(t.name)}</span></button><div class="tb-tplacts"><button type="button" class="t-btn sm" data-exp="${t.id}" title="Download to share">⬇</button><button type="button" class="t-btn sm" data-rm="${t.id}" title="Delete">✕</button></div></div>`).join('')
    : '<p class="muted">Design something you like, then save it here to reuse your style on every video.</p>';
}
async function packDoc() { return { name: els.tplName.value.trim() || 'My template', doc: JSON.parse(snap()), assets: Object.fromEntries(usedAssets(doc).filter((id) => assets.get(id)).map((id) => [id, toUrl(assets.get(id))])) }; }
$('#tb-savetpl').addEventListener('click', async () => {
  const p = await packDoc(); p.id = uid(); p.at = Date.now(); p.thumb = thumbOf(doc);
  await tx('tpl', 'readwrite', (s) => s.put(p)); await renderMine();
  setStatus(els.status, `Saved “${p.name}” to My templates (in this browser). Use ⬇ to share it as a file.`, 'ok');
});
async function useMine(p) { for (const [id, u] of Object.entries(p.assets || {})) if (!assets.get(id)) assets.set(id, await fromUrl(u)); applyTemplate(JSON.parse(JSON.stringify(p.doc))); }
els.mytpls.addEventListener('click', async (e) => {
  const m = e.target.closest('[data-mine]'), ex = e.target.closest('[data-exp]'), rm = e.target.closest('[data-rm]');
  const id = (m || ex || rm || {}).dataset; if (!id) return;
  const p = await tx('tpl', 'readonly', (s) => s.get(id.mine || id.exp || id.rm));
  if (m && p) await useMine(p);
  if (ex && p) downloadBlob(new Blob([JSON.stringify({ webcamclicksThumbnailTemplate: 1, ...p })], { type: 'application/json' }), `${p.name.replace(/[^\w -]+/g, '').trim() || 'template'}.wctemplate.json`);
  if (rm && p && confirm(`Delete “${p.name}”?`)) { await tx('tpl', 'readwrite', (s) => s.delete(p.id)); renderMine(); }
});
els.tplImport.addEventListener('change', async () => {
  const f = els.tplImport.files[0]; els.tplImport.value = ''; if (!f) return;
  try {
    const p = JSON.parse(await f.text()); if (!p.doc || !Array.isArray(p.doc.layers)) throw new Error('bad');
    p.id = uid(); p.at = Date.now(); if (!p.thumb) p.thumb = ''; await tx('tpl', 'readwrite', (s) => s.put(p)); await useMine(p); renderMine();
    setStatus(els.status, `Imported “${p.name}”.`, 'ok');
  } catch (_) { setStatus(els.status, 'That file is not a WebcamClicks thumbnail template.', 'err'); }
});

/* ---------------------------------------------------------------- tabs (panels) */
$$('.tb-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => {
  $$('.tb-tabs [data-tab]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $$('.tb-panel').forEach((p) => { p.hidden = p.dataset.panel !== b.dataset.tab; });
}));

/* ---------------------------------------------------------------- export */
async function exportCanvas() { const c = document.createElement('canvas'); c.width = W; c.height = H; renderDoc(c.getContext('2d'), doc, assets, frame); return c; }
$('#tb-jpg').addEventListener('click', async () => {
  const c = await exportCanvas(); let q = 0.93, blob = await canvasToBlob(c, 'image/jpeg', q);
  while (blob.size > 1.95 * 1024 * 1024 && q > 0.5) { q -= 0.07; blob = await canvasToBlob(c, 'image/jpeg', q); }
  downloadBlob(blob, `${name}-thumbnail.jpg`); setStatus(els.status, `Saved a 1280×720 JPG (${formatBytes(blob.size)}), ready for YouTube Studio.`, 'ok');
});
$('#tb-png').addEventListener('click', async () => downloadBlob(await canvasToBlob(await exportCanvas(), 'image/png'), `${name}-thumbnail.png`));

/* ---------------------------------------------------------------- start */
setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /^(image|video)\//.test(x.type) || /\.(heic|heif|mp4|mov|webm|mkv)$/i.test(x.name)); if (f) openFile(f).catch((e) => setStatus(els.status, e.message, 'err')); else setStatus(els.status, 'Please choose a photo or a video.', 'err'); });
document.fonts && document.fonts.addEventListener('loadingdone', () => { render(); renderTemplates(); });
(async () => {
  if (await loadAutosave()) setStatus(els.status, 'Your last design was restored (saved in this browser).', 'ok');
  hist = [snap()]; updateUndo(); refresh(); renderTemplates(); renderMine(); frameLoop();
})();
window.__tbTest = { get doc() { return doc; }, set doc(d) { doc = d; refresh(); }, get sel() { return sel; }, assets, TEMPLATES, applyTemplate, undo, redo };
