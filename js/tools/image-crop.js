/* WebcamClicks — Crop image: crop box with aspect presets, circle crop, rotate, flip, straighten, exact output size.
   Runs on the device; full-resolution export. */

import { $, $$, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes, splitName, canvasEncoders } from './common.js';
import { CropBox, ASPECTS } from './crop-box.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), stage: $('#ic-stage'), canvas: $('#ic-canvas'), work: $('#ic-work'),
  aspects: $('#ic-aspects'), rotL: $('#ic-rotl'), rotR: $('#ic-rotr'), flipH: $('#ic-fliph'), flipV: $('#ic-flipv'), straight: $('#ic-straight'), straightV: $('#ic-straight-v'),
  outW: $('#ic-w'), outH: $('#ic-h'), lock: $('#ic-lock'), fmt: $('#ic-fmt'), quality: $('#ic-q'), save: $('#ic-save'), reset: $('#ic-reset'), info: $('#ic-info'), bg: $('#ic-bg')
};
let img = null, name = 'image', srcType = 'image/jpeg';
const T = { rot: 0, fh: false, fv: false, angle: 0 };
let aspectKey = 'Free', circle = false;
const cb = new CropBox(els.stage, { onChange: (r) => { syncOut(r); } });

els.aspects.innerHTML = [...ASPECTS.map(([n]) => n), 'Circle'].map((n) => `<button type="button" data-a="${n}" aria-pressed="${n === aspectKey}">${n === 'Circle' ? '◯ Circle' : n}</button>`).join('');
els.aspects.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  aspectKey = b.dataset.a; circle = aspectKey === 'Circle';
  $$('[data-a]', els.aspects).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  els.stage.classList.toggle('circle', circle);
  cb.setAspect(circle ? 1 : (ASPECTS.find(([n]) => n === aspectKey) || [])[1]);
  if (circle && els.fmt.value === 'image/jpeg') els.fmt.value = 'image/png';
  updateQ();
});

/* ---------------------------------------------------------------- source with rotation, flip and straighten applied */
let rotated = null;   // canvas holding the transformed full-resolution image
function buildRotated() {
  const r = T.rot % 180 !== 0, w0 = r ? img.height : img.width, h0 = r ? img.width : img.height;
  const a = (T.angle * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  // straightening rotates a little more and zooms in so no empty corners show
  const zoom = T.angle ? Math.max((w0 * c + h0 * s) / w0, (w0 * s + h0 * c) / h0) : 1;
  const cv = document.createElement('canvas'); cv.width = w0; cv.height = h0;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.translate(w0 / 2, h0 / 2); g.rotate((T.rot * Math.PI) / 180 + a); g.scale((T.fh ? -1 : 1) * zoom, (T.fv ? -1 : 1) * zoom);
  g.drawImage(img, -img.width / 2, -img.height / 2);
  rotated = cv;
}
function preview(keep) {
  buildRotated();
  const maxW = Math.min(1600, rotated.width), k = maxW / rotated.width;
  els.canvas.width = Math.round(rotated.width * k); els.canvas.height = Math.round(rotated.height * k);
  els.canvas.getContext('2d').drawImage(rotated, 0, 0, els.canvas.width, els.canvas.height);
  cb.setSource(rotated.width, rotated.height, keep);
}

async function load(files) {
  const f = files.find((x) => x.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(x.name));
  if (!f) { setStatus(els.status, 'Please choose an image.', 'err'); return; }
  try { img = await decodeImage(f); } catch (_) { setStatus(els.status, 'That image could not be opened.', 'err'); return; }
  name = splitName(f.name || 'image')[0] || 'image';
  srcType = /png|webp|avif/.test(f.type) ? f.type : 'image/jpeg';
  Object.assign(T, { rot: 0, fh: false, fv: false, angle: 0 }); els.straight.value = 0; els.straightV.textContent = '0°';
  if (!els.fmt.dataset.touched) els.fmt.value = srcType === 'image/avif' && !canvasEncoders()['image/avif'] ? 'image/jpeg' : srcType;
  els.work.hidden = false; els.drop.classList.add('compact'); els.save.disabled = false;
  preview(false);
  els.info.textContent = `${f.name} · ${img.width} × ${img.height} · ${formatBytes(f.size)}`;
  setStatus(els.status, 'Drag the box or its corners. Pick a ratio on the right.', 'ok');
  updateQ();
}
setupDropzone(els.drop, els.input, load);

els.rotL.addEventListener('click', () => { if (!img) return; T.rot = (T.rot + 270) % 360; preview(false); });
els.rotR.addEventListener('click', () => { if (!img) return; T.rot = (T.rot + 90) % 360; preview(false); });
els.flipH.addEventListener('click', () => { if (!img) return; T.fh = !T.fh; preview(true); });
els.flipV.addEventListener('click', () => { if (!img) return; T.fv = !T.fv; preview(true); });
let sT = 0;
els.straight.addEventListener('input', () => { els.straightV.textContent = `${els.straight.value}°`; if (!img) return; T.angle = +els.straight.value; clearTimeout(sT); sT = setTimeout(() => preview(true), 30); });
els.reset.addEventListener('click', () => { if (!img) return; Object.assign(T, { rot: 0, fh: false, fv: false, angle: 0 }); els.straight.value = 0; els.straightV.textContent = '0°'; preview(false); });

/* ---------------------------------------------------------------- output size */
let userSized = false;
function syncOut(r) {
  if (!userSized) { els.outW.value = r.w; els.outH.value = r.h; }
  else if (els.lock.checked) els.outH.value = Math.max(1, Math.round((+els.outW.value * r.h) / r.w));
}
els.outW.addEventListener('input', () => { userSized = true; const r = cb.rounded(); if (els.lock.checked) els.outH.value = Math.max(1, Math.round((+els.outW.value * r.h) / r.w)); });
els.outH.addEventListener('input', () => { userSized = true; const r = cb.rounded(); if (els.lock.checked) els.outW.value = Math.max(1, Math.round((+els.outH.value * r.w) / r.h)); });
function updateQ() { els.quality.closest('.t-field').hidden = els.fmt.value === 'image/png'; els.bg.closest('.t-field').hidden = !(circle && els.fmt.value === 'image/jpeg'); }
els.fmt.addEventListener('change', () => { els.fmt.dataset.touched = '1'; updateQ(); });

/* ---------------------------------------------------------------- export */
els.save.addEventListener('click', async () => {
  if (!img) return;
  const r = cb.rounded();
  const W = Math.max(1, Math.min(20000, +els.outW.value || r.w)), H = Math.max(1, Math.min(20000, +els.outH.value || r.h));
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
  const type = els.fmt.value;
  if (type === 'image/jpeg') { g.fillStyle = circle ? els.bg.value : '#fff'; g.fillRect(0, 0, W, H); }
  if (circle) { g.beginPath(); g.ellipse(W / 2, H / 2, W / 2, H / 2, 0, 0, Math.PI * 2); g.clip(); }
  g.drawImage(rotated, r.x, r.y, r.w, r.h, 0, 0, W, H);
  try {
    const blob = await canvasToBlob(c, type, +els.quality.value / 100);
    const ext = { 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' }[type] || 'jpg';
    downloadBlob(blob, `${name}-cropped.${ext}`);
    setStatus(els.status, `Saved ${W} × ${H} ${ext.toUpperCase()} (${formatBytes(blob.size)}).`, 'ok');
  } catch (e) { setStatus(els.status, `Could not save: ${e.message}`, 'err'); }
});
els.quality.addEventListener('input', () => { els.quality.nextElementSibling && (els.quality.nextElementSibling.textContent = `${els.quality.value}%`); });
// formats this browser can write
const enc = canvasEncoders();
[...els.fmt.options].forEach((o) => { if (!enc[o.value]) { o.disabled = true; o.textContent += ' (not supported here)'; } });
window.__icTest = { cb, load, get rect() { return cb.rounded(); } };
