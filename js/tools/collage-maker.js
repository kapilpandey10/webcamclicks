/* WebcamClicks — Collage maker: photos into grid layouts for Instagram, stories and print.
   Drag a photo to move it inside its cell, drop it on another cell to swap; zoom per photo. Nothing is uploaded. */

import { $, $$, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), canvas: $('#cm-canvas'), wrap: $('#cm-wrap'), layouts: $('#cm-layouts'),
  size: $('#cm-size'), gap: $('#cm-gap'), border: $('#cm-border'), radius: $('#cm-radius'), bgc: $('#cm-bg'), fmt: $('#cm-fmt'), save: $('#cm-save'),
  cell: $('#cm-cell'), zoom: $('#cm-zoom'), replace: $('#cm-replace'), replaceIn: $('#cm-replace-in'), remove: $('#cm-remove'), add: $('#cm-add'), addIn: $('#cm-add-in'),
  shuffle: $('#cm-shuffle'), info: $('#cm-info'), cellName: $('#cm-cell-name')
};

// layouts: cells as [x, y, w, h] in a 0–1 box
const g2 = (c, r) => { const out = []; for (let y = 0; y < r; y++) for (let x = 0; x < c; x++) out.push([x / c, y / r, 1 / c, 1 / r]); return out; };
const LAYOUTS = [
  ['2 side by side', g2(2, 1)], ['2 stacked', g2(1, 2)], ['Big + small', [[0, 0, 0.62, 1], [0.62, 0, 0.38, 1]]],
  ['3 columns', g2(3, 1)], ['3 rows', g2(1, 3)], ['1 left + 2 right', [[0, 0, 0.5, 1], [0.5, 0, 0.5, 0.5], [0.5, 0.5, 0.5, 0.5]]],
  ['1 top + 2 below', [[0, 0, 1, 0.55], [0, 0.55, 0.5, 0.45], [0.5, 0.55, 0.5, 0.45]]], ['2×2 grid', g2(2, 2)],
  ['1 big + 3', [[0, 0, 1, 0.64], [0, 0.64, 1 / 3, 0.36], [1 / 3, 0.64, 1 / 3, 0.36], [2 / 3, 0.64, 1 / 3, 0.36]]],
  ['1 left + 3 right', [[0, 0, 0.6, 1], [0.6, 0, 0.4, 1 / 3], [0.6, 1 / 3, 0.4, 1 / 3], [0.6, 2 / 3, 0.4, 1 / 3]]],
  ['4 strips', g2(4, 1)], ['2 + 3', [[0, 0, 0.5, 0.5], [0.5, 0, 0.5, 0.5], [0, 0.5, 1 / 3, 0.5], [1 / 3, 0.5, 1 / 3, 0.5], [2 / 3, 0.5, 1 / 3, 0.5]]],
  ['Centre + 4', [[0.25, 0.25, 0.5, 0.5], [0, 0, 0.75, 0.25], [0.75, 0, 0.25, 0.75], [0.25, 0.75, 0.75, 0.25], [0, 0.25, 0.25, 0.75]]],
  ['3×2 grid', g2(3, 2)], ['2×3 grid', g2(2, 3)], ['1 big + 5', [[0, 0, 2 / 3, 2 / 3], [2 / 3, 0, 1 / 3, 1 / 3], [2 / 3, 1 / 3, 1 / 3, 1 / 3], [0, 2 / 3, 1 / 3, 1 / 3], [1 / 3, 2 / 3, 1 / 3, 1 / 3], [2 / 3, 2 / 3, 1 / 3, 1 / 3]]],
  ['2×4 grid', g2(2, 4)], ['4×2 grid', g2(4, 2)], ['3×3 grid', g2(3, 3)], ['4×4 grid', g2(4, 4)]
];
const SIZES = { square: [2160, 2160], portrait: [2160, 2700], story: [2160, 3840], landscape: [3840, 2160], a4: [2480, 3508], fbcover: [1640, 624] };

let photos = [];   // { img, name }
let layout = 7, cells = [];   // cells: { photo: index|null, zoom, ox, oy }
let selected = -1;

/* ---------------------------------------------------------------- layouts */
function layoutThumbs() {
  els.layouts.innerHTML = LAYOUTS.map(([n, cs], i) => `<button type="button" class="cm-layout" data-l="${i}" aria-pressed="${i === layout}" title="${n}" aria-label="${n}">
    <svg viewBox="0 0 40 40" aria-hidden="true">${cs.map(([x, y, w, h]) => `<rect x="${x * 40 + 1}" y="${y * 40 + 1}" width="${w * 40 - 2}" height="${h * 40 - 2}" rx="2"/>`).join('')}</svg><small>${cs.length}</small></button>`).join('');
}
function setLayout(i) {
  layout = i;
  const n = LAYOUTS[i][1].length, old = cells;
  cells = Array.from({ length: n }, (_, k) => old[k] || { photo: null, zoom: 1, ox: 0, oy: 0 });
  // fill empty cells with photos that aren't shown yet
  const used = new Set(cells.map((c) => c.photo).filter((x) => x != null));
  let next = 0;
  for (const c of cells) { if (c.photo != null) continue; while (next < photos.length && used.has(next)) next++; if (next < photos.length) { c.photo = next; used.add(next); next++; } }
  if (selected >= n) selected = -1;
  $$('[data-l]', els.layouts).forEach((b) => b.setAttribute('aria-pressed', String(+b.dataset.l === i)));
  draw(); syncCell();
}
els.layouts.addEventListener('click', (e) => { const b = e.target.closest('[data-l]'); if (b) setLayout(+b.dataset.l); });

/* ---------------------------------------------------------------- photos */
async function addPhotos(files, intoCell = null) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Please add photos (JPG, PNG, HEIC, WebP).', 'err'); return; }
  setStatus(els.status, `Opening ${imgs.length} photo${imgs.length > 1 ? 's' : ''}…`);
  const first = photos.length;
  for (const f of imgs) { try { photos.push({ img: await decodeImage(f), name: f.name }); } catch (_) { /* skip unreadable files */ } }
  if (photos.length === first) { setStatus(els.status, 'Those photos could not be opened.', 'err'); return; }
  els.wrap.hidden = false; els.drop.classList.add('compact'); els.save.disabled = false;
  if (intoCell != null) { Object.assign(cells[intoCell], { photo: first, zoom: 1, ox: 0, oy: 0 }); draw(); syncCell(); }
  else if (first === 0) {
    // pick a layout that fits the number of photos (the 2×2 grid for four, etc.)
    const n = photos.length, pick = { 1: 0, 2: 0, 3: 5, 4: 7, 5: 11, 6: 13, 7: 16, 8: 16, 9: 18 }[Math.min(n, 9)] ?? (n > 9 ? 19 : 7);
    setLayout(pick);
  } else setLayout(layout);
  setStatus(els.status, 'Drag a photo to move it in its frame, or onto another frame to swap. Click a frame to zoom, replace or remove.', 'ok');
}
setupDropzone(els.drop, els.input, (f) => addPhotos(f));
els.add.addEventListener('click', () => els.addIn.click());
els.addIn.addEventListener('change', () => { const fs = [...els.addIn.files]; els.addIn.value = ''; if (fs.length) addPhotos(fs); });
els.replace.addEventListener('click', () => els.replaceIn.click());
els.replaceIn.addEventListener('change', () => { const fs = [...els.replaceIn.files]; els.replaceIn.value = ''; if (fs.length && selected >= 0) addPhotos(fs.slice(0, 1), selected); });
els.remove.addEventListener('click', () => { if (selected < 0) return; cells[selected].photo = null; draw(); syncCell(); });
els.shuffle.addEventListener('click', () => {
  const ph = cells.map((c) => c.photo); for (let i = ph.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ph[i], ph[j]] = [ph[j], ph[i]]; }
  cells.forEach((c, i) => Object.assign(c, { photo: ph[i], zoom: 1, ox: 0, oy: 0 })); draw();
});
els.zoom.addEventListener('input', () => { if (selected < 0) return; cells[selected].zoom = +els.zoom.value / 100; clampPan(selected); draw(); });
function syncCell() {
  const c = cells[selected];
  els.cell.hidden = !c;
  if (!c) return;
  els.cellName.textContent = c.photo != null ? `Frame ${selected + 1}: ${photos[c.photo].name}` : `Frame ${selected + 1}: empty`;
  els.zoom.value = Math.round(c.zoom * 100); els.zoom.disabled = els.remove.disabled = c.photo == null;
}
[els.size, els.gap, els.border, els.radius, els.bgc].forEach((x) => x.addEventListener('input', draw));

/* ---------------------------------------------------------------- geometry & drawing */
function dims() { return SIZES[els.size.value]; }
function cellRects(W, H) {
  const short = Math.min(W, H), gap = (+els.gap.value / 1000) * short, border = (+els.border.value / 1000) * short;
  return LAYOUTS[layout][1].map(([x, y, w, h]) => {
    const X = border + x * (W - 2 * border), Y = border + y * (H - 2 * border), CW = w * (W - 2 * border), CH = h * (H - 2 * border);
    // half a gap on inner edges only, so outer edges line up with the border
    const l = x > 0.001 ? gap / 2 : 0, t = y > 0.001 ? gap / 2 : 0, r = x + w < 0.999 ? gap / 2 : 0, b = y + h < 0.999 ? gap / 2 : 0;
    return [X + l, Y + t, CW - l - r, CH - t - b];
  });
}
function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
/** Where a cell's photo goes: cover-fit, zoomed, panned (ox/oy are fractions of the spare room, -1…1). */
function placement(c, w, h) {
  const im = photos[c.photo].img, s = Math.max(w / im.width, h / im.height) * c.zoom;
  const dw = im.width * s, dh = im.height * s, sx = (dw - w) / 2, sy = (dh - h) / 2;
  return { dw, dh, dx: -sx + c.ox * sx, dy: -sy + c.oy * sy, sx, sy };
}
function clampPan(i) { const c = cells[i]; c.ox = Math.max(-1, Math.min(1, c.ox)); c.oy = Math.max(-1, Math.min(1, c.oy)); }
function paint(cv, scale, preview) {
  const [W0, H0] = dims(), W = Math.round(W0 * scale), H = Math.round(H0 * scale);
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d'); g.imageSmoothingQuality = 'high';
  g.fillStyle = els.bgc.value; g.fillRect(0, 0, W, H);
  const rad = (+els.radius.value / 1000) * Math.min(W, H);
  cellRects(W, H).forEach(([x, y, w, h], i) => {
    const c = cells[i];
    g.save(); rr(g, x, y, w, h, rad); g.clip();
    if (c && c.photo != null) { const p = placement(c, w, h); g.drawImage(photos[c.photo].img, x + p.dx, y + p.dy, p.dw, p.dh); }
    else if (preview) {
      g.fillStyle = '#e9ebef'; g.fillRect(x, y, w, h); g.fillStyle = '#9aa0a8'; g.font = `600 ${Math.round(Math.min(w, h) * 0.12)}px Inter, system-ui, sans-serif`;
      g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('+', x + w / 2, y + h / 2 - Math.min(w, h) * 0.06);
      g.font = `500 ${Math.round(Math.min(w, h) * 0.06)}px Inter, system-ui, sans-serif`; g.fillText('Add photo', x + w / 2, y + h / 2 + Math.min(w, h) * 0.08);
    }
    g.restore();
    if (preview && i === selected) { g.save(); g.lineWidth = Math.max(3, W * 0.006); g.strokeStyle = '#ff4d2e'; rr(g, x + g.lineWidth / 2, y + g.lineWidth / 2, w - g.lineWidth, h - g.lineWidth, rad); g.stroke(); g.restore(); }
    if (preview && drag && drag.over === i && drag.over !== drag.cell) { g.save(); g.fillStyle = 'rgba(255,77,46,.25)'; rr(g, x, y, w, h, rad); g.fill(); g.restore(); }
  });
  return { W, H };
}
let raf = 0, pscale = 1;
function draw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    const [W0, H0] = dims(); pscale = Math.min(1, 1200 / Math.max(W0, H0));
    paint(els.canvas, pscale, true);
    els.info.textContent = `${W0} × ${H0} px · ${cells.filter((c) => c.photo != null).length} of ${cells.length} frames filled`;
  });
}

/* ---------------------------------------------------------------- interaction: select, pan, swap */
let drag = null;
function hit(e) {
  const r = els.canvas.getBoundingClientRect(), k = els.canvas.width / r.width;
  const px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k;
  const rects = cellRects(els.canvas.width, els.canvas.height);
  const i = rects.findIndex(([x, y, w, h]) => px >= x && px <= x + w && py >= y && py <= y + h);
  return { i, px, py, rect: rects[i], k };
}
els.canvas.addEventListener('pointerdown', (e) => {
  const h = hit(e); if (h.i < 0) return;
  selected = h.i; syncCell();
  const c = cells[h.i];
  if (c.photo == null) { draw(); els.replaceIn.click(); return; }
  els.canvas.setPointerCapture(e.pointerId);
  drag = { cell: h.i, x: e.clientX, y: e.clientY, ox: c.ox, oy: c.oy, over: h.i, moved: false };
  draw();
});
els.canvas.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const h = hit(e), c = cells[drag.cell];
  drag.moved = drag.moved || Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 4;
  drag.over = h.i;
  if (h.i === drag.cell || h.i < 0) {
    const [, , w, hh] = cellRects(els.canvas.width, els.canvas.height)[drag.cell], p = placement(c, w, hh), k = els.canvas.width / els.canvas.getBoundingClientRect().width;
    c.ox = p.sx ? drag.ox + ((e.clientX - drag.x) * k) / p.sx : 0; c.oy = p.sy ? drag.oy + ((e.clientY - drag.y) * k) / p.sy : 0; clampPan(drag.cell);
  } else { c.ox = drag.ox; c.oy = drag.oy; }
  els.canvas.style.cursor = h.i >= 0 && h.i !== drag.cell ? 'copy' : 'grabbing';
  draw();
});
function endDrag() {
  if (!drag) return;
  const { cell, over } = drag;
  if (over >= 0 && over !== cell) {   // swap the two frames' photos
    const a = cells[cell], b = cells[over];
    [a.photo, b.photo] = [b.photo, a.photo]; [a.zoom, b.zoom] = [b.zoom, a.zoom];
    Object.assign(a, { ox: 0, oy: 0 }); Object.assign(b, { ox: 0, oy: 0 }); selected = over; syncCell();
  }
  drag = null; els.canvas.style.cursor = ''; draw();
}
els.canvas.addEventListener('pointerup', endDrag); els.canvas.addEventListener('pointercancel', endDrag);
els.canvas.addEventListener('wheel', (e) => {
  const h = hit(e); if (h.i < 0 || cells[h.i].photo == null) return;
  e.preventDefault(); selected = h.i;
  const c = cells[h.i]; c.zoom = Math.max(1, Math.min(4, c.zoom * (e.deltaY < 0 ? 1.08 : 1 / 1.08))); clampPan(h.i); syncCell(); draw();
}, { passive: false });
// drop photos straight onto a frame
els.canvas.addEventListener('dragover', (e) => e.preventDefault());
els.canvas.addEventListener('drop', (e) => { e.preventDefault(); const fs = [...(e.dataTransfer?.files || [])]; const h = hit(e); if (fs.length) addPhotos(fs, h.i >= 0 && fs.length === 1 ? h.i : null); });

/* ---------------------------------------------------------------- export */
els.fmt.addEventListener('change', draw);
els.save.addEventListener('click', async () => {
  els.save.disabled = true;
  try {
    const sel = selected; selected = -1;
    const c = document.createElement('canvas'); paint(c, 1, false); selected = sel;
    const blob = await canvasToBlob(c, els.fmt.value, 0.92);
    downloadBlob(blob, `collage-${els.size.value}.${els.fmt.value === 'image/png' ? 'png' : 'jpg'}`);
    setStatus(els.status, `Saved ${c.width}×${c.height} (${formatBytes(blob.size)}).`, 'ok');
  } catch (e) { setStatus(els.status, `Could not save: ${e.message}`, 'err'); }
  els.save.disabled = false;
});
layoutThumbs(); setLayout(layout);
window.__cmTest = { addPhotos, setLayout, get cells() { return cells; } };
