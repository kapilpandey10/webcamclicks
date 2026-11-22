/* WebcamClicks — ID card maker: design front & back on a canvas editor, bind text, photos, QR codes and barcodes to
   data fields, import a spreadsheet (CSV / Excel) and a folder of photos, then export every card as PNG (300 DPI),
   a ZIP, or a print-ready PDF sheet with cut marks. Everything stays in the browser. */

import { $, $$, setStatus, downloadBlob, downloadZip, decodeImage, canvasToBlob, loadLib, escapeHtml, splitName } from './common.js';
import { SIZES, FONTS, FONTS_CSS, fill, fieldsIn, renderSide, textEl, imageEl, shapeEl, qrEl, barcodeEl, solidBg, uid } from './idcard/engine.js';
import { TEMPLATES, SAMPLE_COLUMNS, SAMPLE_ROWS } from './idcard/templates.js';

const $id = (s) => document.getElementById(s);
const E = (id) => $id(`ic-${id}`);
if (!document.querySelector('link[data-ic-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.icFonts = '1'; document.head.appendChild(l); }
const store = { get(k, d) { try { return localStorage.getItem(`wc_ic_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_ic_${k}`, v); return true; } catch (_) { return false; } } };

/* ---------------------------------------------------------------- state */
let doc = null;                 // { size, radius, front, back }
let side = 'front', selId = null, rowIdx = 0;
let columns = [...SAMPLE_COLUMNS], rows = SAMPLE_ROWS.map((r) => ({ ...r })), usingSample = true;
const assets = {};              // id → canvas (logos, backgrounds, signatures)
const photos = new Map();       // normalised file name → canvas
let QR = null;
loadLib('qrcode').then((q) => { QR = q; draw(); renderTemplates(); }).catch(() => {});
const ctxFor = (placeholders) => ({ assets, QR, placeholders, photoFor });
const status = (m, k) => setStatus($id('t-status'), m, k);

function photoKey(s) { return String(s || '').trim().toLowerCase().replace(/\.(jpe?g|png|webp|heic|heif|gif|bmp|avif)$/i, ''); }
function photoCol() { return columns.find((c) => /^(photo|picture|image|pic|photo ?file|img)$/i.test(c)) || null; }
function photoFor(row) {
  if (!row) return null;
  const col = photoCol();
  if (col && row[col]) { const p = photos.get(photoKey(row[col])); if (p) return p; }
  if (row.__photo) return photos.get(row.__photo) || null;
  // no photo column: match a photo named like the ID or the name
  for (const c of columns) { const p = photos.get(photoKey(row[c])); if (p) return p; }
  return null;
}
const cur = () => doc[side];
const sel = () => cur().layers.find((l) => l.id === selId) || null;
const size = () => SIZES[doc.size] || SIZES.cr80l;

/* ---------------------------------------------------------------- history */
const hist = []; let future = [];
const snap = () => JSON.stringify(doc);
function commit() { hist.push(lastSnap); if (hist.length > 60) hist.shift(); future = []; lastSnap = snap(); autosave(); }
let lastSnap = '';
function undo() { if (!hist.length) return; future.push(snap()); doc = JSON.parse(hist.pop()); lastSnap = snap(); selId = null; refresh(); }
function redo() { if (!future.length) return; hist.push(snap()); doc = JSON.parse(future.pop()); lastSnap = snap(); selId = null; refresh(); }
let saveT = 0;
function autosave() { clearTimeout(saveT); saveT = setTimeout(() => store.set('draft', JSON.stringify({ doc, assets: assetsJson() })), 600); }
function assetsJson() { const o = {}; for (const [k, c] of Object.entries(assets)) { try { o[k] = c.toDataURL('image/png'); } catch (_) { /* ignore */ } } return o; }
async function loadAssets(o) { for (const [k, url] of Object.entries(o || {})) { try { const im = new Image(); im.src = url; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; c.getContext('2d').drawImage(im, 0, 0); assets[k] = c; } catch (_) { /* ignore */ } } }

/* ---------------------------------------------------------------- templates */
function useTemplate(key) {
  const t = TEMPLATES[key], s = SIZES[t.size], made = t.make(s.w, s.h);
  doc = { size: t.size, radius: 28, template: key, front: made.front, back: made.back };
  side = 'front'; selId = null; commit(); refresh();
  $$('[data-tpl]', E('templates')).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tpl === key)));
}
function renderTemplates() {
  const box = E('templates'); if (!box) return;
  if (!box.children.length) box.innerHTML = Object.entries(TEMPLATES).map(([k, t]) => `<button type="button" class="ic-tpl" data-tpl="${k}" aria-pressed="false"><canvas></canvas><small>${escapeHtml(t.name)}</small></button>`).join('');
  $$('[data-tpl]', box).forEach((b) => {
    const t = TEMPLATES[b.dataset.tpl], s = SIZES[t.size], c = b.querySelector('canvas'), k = 220 / Math.max(s.w, s.h);
    c.width = Math.round(s.w * k); c.height = Math.round(s.h * k);
    const g = c.getContext('2d'); g.scale(k, k);
    renderSide(g, { size: t.size, radius: 28, ...t.make(s.w, s.h) }, 'front', SAMPLE_ROWS[0], ctxFor(true));
  });
}
E('templates').addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) { useTemplate(b.dataset.tpl); status(`“${TEMPLATES[b.dataset.tpl].name}” applied. Click any element on the card to edit it.`, 'ok'); } });

/* ---------------------------------------------------------------- canvas editor */
const canvas = E('canvas'), stage = E('stage'), selBox = E('sel'), guideV = E('guide-v'), guideH = E('guide-h');
function draw() {
  if (!doc) return;
  const s = size();
  if (canvas.width !== s.w || canvas.height !== s.h) { canvas.width = s.w; canvas.height = s.h; }
  const g = canvas.getContext('2d'); g.clearRect(0, 0, s.w, s.h);
  renderSide(g, doc, side, rows[rowIdx], ctxFor(true));
  placeSel();
}
const scale = () => canvas.clientWidth / size().w;
function placeSel() {
  const L = sel(); selBox.hidden = !L; if (!L) return;
  const k = scale(), ox = canvas.offsetLeft, oy = canvas.offsetTop;
  Object.assign(selBox.style, { left: `${ox + L.x * k}px`, top: `${oy + L.y * k}px`, width: `${Math.max(4, L.w * k)}px`, height: `${Math.max(4, L.h * k)}px` });
  selBox.classList.toggle('locked', !!L.locked);
}
new ResizeObserver(() => placeSel()).observe(stage);
function hitTest(x, y) { const ls = cur().layers; for (let i = ls.length - 1; i >= 0; i--) { const L = ls[i]; if (!L.hidden && x >= L.x && x <= L.x + L.w && y >= L.y && y <= L.y + Math.max(L.h, 6)) return L; } return null; }
let drag = null;
function toCard(e) { const r = canvas.getBoundingClientRect(), k = size().w / r.width; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; }
stage.addEventListener('pointerdown', (e) => {
  if (!doc || e.button > 0) return;
  const handle = e.target.closest('[data-h]');
  const [x, y] = toCard(e);
  let L = handle ? sel() : hitTest(x, y);
  if (!handle) { selId = L ? L.id : null; renderLayers(); renderProps(); placeSel(); }
  if (!L || L.locked) return;
  e.preventDefault(); stage.setPointerCapture(e.pointerId);
  drag = { h: handle ? handle.dataset.h : 'move', x, y, o: { x: L.x, y: L.y, w: L.w, h: L.h }, moved: false };
});
stage.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const L = sel(); if (!L) return;
  const [x, y] = toCard(e), dx = x - drag.x, dy = y - drag.y, o = drag.o, s = size(), snapD = 8 / scale();
  drag.moved = true;
  let gx = null, gy = null;
  if (drag.h === 'move') {
    let nx = o.x + dx, ny = o.y + dy;
    // snap the element's centre / edges to the card's centre and edges
    const cx = nx + L.w / 2, cy = ny + L.h / 2;
    if (Math.abs(cx - s.w / 2) < snapD) { nx = s.w / 2 - L.w / 2; gx = s.w / 2; }
    if (Math.abs(cy - s.h / 2) < snapD) { ny = s.h / 2 - L.h / 2; gy = s.h / 2; }
    if (Math.abs(nx) < snapD) nx = 0; if (Math.abs(ny) < snapD) ny = 0;
    if (Math.abs(nx + L.w - s.w) < snapD) nx = s.w - L.w; if (Math.abs(ny + L.h - s.h) < snapD) ny = s.h - L.h;
    L.x = Math.round(nx); L.y = Math.round(ny);
  } else {
    const h = drag.h; let { x: X, y: Y, w: Wd, h: Ht } = o;
    if (h.includes('e')) Wd = Math.max(10, o.w + dx); if (h.includes('s')) Ht = Math.max(6, o.h + dy);
    if (h.includes('w')) { Wd = Math.max(10, o.w - dx); X = o.x + o.w - Wd; } if (h.includes('n')) { Ht = Math.max(6, o.h - dy); Y = o.y + o.h - Ht; }
    if ((L.type === 'qr' || (L.type === 'image' && L.shape === 'circle' && e.shiftKey)) && h.length === 2) { const m = Math.max(Wd, Ht); Wd = Ht = m; }
    Object.assign(L, { x: Math.round(X), y: Math.round(Y), w: Math.round(Wd), h: Math.round(Ht) });
  }
  guideV.hidden = gx == null; guideH.hidden = gy == null;
  if (gx != null) guideV.style.left = `${canvas.offsetLeft + gx * scale()}px`;
  if (gy != null) guideH.style.top = `${canvas.offsetTop + gy * scale()}px`;
  draw(); syncGeom();
});
const endDrag = () => { if (drag && drag.moved) commit(); drag = null; guideV.hidden = guideH.hidden = true; };
stage.addEventListener('pointerup', endDrag); stage.addEventListener('pointercancel', endDrag);
stage.addEventListener('dblclick', () => { const L = sel(); if (L) { showTab('edit'); setTimeout(() => $('#ic-props textarea, #ic-props input[type=text]')?.focus(), 50); } });
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  const L = sel();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (!L) return;
  const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key];
  if (d && !L.locked) { e.preventDefault(); const k = e.shiftKey ? 10 : 1; L.x += d[0] * k; L.y += d[1] * k; draw(); syncGeom(); commit(); }
  else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); removeSel(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd') { e.preventDefault(); duplicateSel(); }
});

/* ---------------------------------------------------------------- side / record navigation */
E('side').addEventListener('click', (e) => { const b = e.target.closest('[data-side]'); if (!b) return; side = b.dataset.side; selId = null; refresh(); });
E('prev').addEventListener('click', () => { if (rowIdx > 0) { rowIdx--; refreshRecord(); } });
E('next').addEventListener('click', () => { if (rowIdx < rows.length - 1) { rowIdx++; refreshRecord(); } });
function refreshRecord() {
  E('rec').textContent = rows.length ? `${rowIdx + 1} / ${rows.length}` : '0 / 0';
  const r = rows[rowIdx]; E('rec-name').textContent = r ? (r[columns[0]] || '') : '';
  E('prev').disabled = rowIdx <= 0; E('next').disabled = rowIdx >= rows.length - 1;
  $$('#ic-table tbody tr').forEach((tr, i) => tr.classList.toggle('cur', i === rowIdx));
  draw();
}

/* ---------------------------------------------------------------- elements */
function add(L) { const s = size(); L.x = Math.round(Math.min(L.x, s.w - L.w)); L.y = Math.round(Math.min(L.y, s.h - L.h)); cur().layers.push(L); selId = L.id; commit(); refresh(); showTab('edit'); }
E('add').addEventListener('click', (e) => {
  const b = e.target.closest('[data-add]'); if (!b || !doc) return;
  const s = size(), k = s.h / 638, c = { x: s.w * 0.1, y: s.h * 0.4 };
  const kind = b.dataset.add;
  if (kind === 'text') add(textEl({ ...c, w: s.w * 0.5, h: 60 * k, text: 'New text', size: Math.round(40 * k) }));
  else if (kind === 'field') add(textEl({ ...c, w: s.w * 0.5, h: 60 * k, text: `{{${columns[0] || 'Name'}}}`, size: Math.round(40 * k), weight: 700 }));
  else if (kind === 'photo') add(imageEl({ ...c, w: s.h * 0.4, h: s.h * 0.5, src: 'photo' }));
  else if (kind === 'logo') pickImage((id) => add(imageEl({ ...c, w: s.h * 0.3, h: s.h * 0.3, src: 'asset', asset: id, fit: 'contain', shape: 'rect' })));
  else if (kind === 'signature') pickImage((id) => add(imageEl({ ...c, w: s.w * 0.3, h: s.h * 0.15, src: 'asset', asset: id, fit: 'contain', shape: 'rect' })), true);
  else if (kind === 'rect') add(shapeEl({ ...c, w: s.w * 0.4, h: s.h * 0.15, fill: '#2563eb', radius: 12 }));
  else if (kind === 'circle') add(shapeEl({ ...c, w: s.h * 0.25, h: s.h * 0.25, shape: 'circle', fill: '#f59e0b' }));
  else if (kind === 'line') add(shapeEl({ ...c, w: s.w * 0.5, h: 4, shape: 'line', fill: '#111827' }));
  else if (kind === 'band') add(shapeEl({ x: 0, y: 0, w: s.w, h: s.h * 0.22, shape: 'wavetop', fill: '#2563eb', fill2: '#7c3aed', angle: 0 }));
  else if (kind === 'qr') add(qrEl({ ...c, w: s.h * 0.3, h: s.h * 0.3, value: `{{${columns.includes('ID') ? 'ID' : columns[0]}}}` }));
  else if (kind === 'barcode') add(barcodeEl({ ...c, w: s.w * 0.45, h: s.h * 0.17, value: `{{${columns.includes('ID') ? 'ID' : columns[0]}}}` }));
});
const imgIn = E('img-in'); let imgCb = null, imgTrim = false;
function pickImage(cb, trim = false) { imgCb = cb; imgTrim = trim; imgIn.click(); }
imgIn.addEventListener('change', async () => {
  const f = imgIn.files[0]; imgIn.value = ''; if (!f || !imgCb) return;
  try {
    const im = await decodeImage(f), k = Math.min(1, 1600 / Math.max(im.width, im.height)), c = document.createElement('canvas');
    c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); const g = c.getContext('2d'); g.drawImage(im, 0, 0, c.width, c.height);
    if (imgTrim) {   // signatures: make the white paper transparent
      const d = g.getImageData(0, 0, c.width, c.height); for (let i = 0; i < d.data.length; i += 4) { const l = (d.data[i] + d.data[i + 1] + d.data[i + 2]) / 3; if (l > 200) d.data[i + 3] = 0; else if (l > 140) d.data[i + 3] = Math.round(255 * (200 - l) / 60); } g.putImageData(d, 0, 0);
    }
    const id = uid(); assets[id] = c; imgCb(id); autosave();
  } catch (_) { status('That image could not be opened.', 'err'); }
  imgCb = null;
});
function removeSel() { const L = sel(); if (!L) return; cur().layers = cur().layers.filter((x) => x !== L); selId = null; commit(); refresh(); }
function duplicateSel() { const L = sel(); if (!L) return; const c = { ...JSON.parse(JSON.stringify(L)), id: uid(), x: L.x + 20, y: L.y + 20 }; cur().layers.push(c); selId = c.id; commit(); refresh(); }
function renderLayers() {
  const NAMES = { text: 'Text', image: 'Image', shape: 'Shape', qr: 'QR code', barcode: 'Barcode' };
  E('layers').innerHTML = cur().layers.map((L, i) => ({ L, i })).reverse().map(({ L, i }) => {
    const label = L.type === 'text' ? L.text.replace(/\n/g, ' ').slice(0, 28) : L.type === 'image' ? (L.src === 'photo' ? 'Photo (from data)' : 'Image') : L.type === 'shape' ? `Shape · ${L.shape}` : `${NAMES[L.type]} · ${L.value}`;
    return `<li class="${L.id === selId ? 'sel' : ''}${L.hidden ? ' off' : ''}" data-id="${L.id}"><span>${escapeHtml(label || NAMES[L.type])}</span>
      <button type="button" data-la="up" title="Bring forward" ${i === cur().layers.length - 1 ? 'disabled' : ''}>↑</button><button type="button" data-la="down" title="Send backward" ${i === 0 ? 'disabled' : ''}>↓</button>
      <button type="button" data-la="hide" title="${L.hidden ? 'Show' : 'Hide'}">${L.hidden ? '◌' : '●'}</button><button type="button" data-la="lock" title="${L.locked ? 'Unlock' : 'Lock'}">${L.locked ? '🔒' : '🔓'}</button></li>`;
  }).join('');
}
E('layers').addEventListener('click', (e) => {
  const li = e.target.closest('[data-id]'); if (!li) return;
  const ls = cur().layers, i = ls.findIndex((l) => l.id === li.dataset.id), L = ls[i], a = e.target.closest('[data-la]')?.dataset.la;
  if (a === 'up' && i < ls.length - 1) [ls[i], ls[i + 1]] = [ls[i + 1], ls[i]];
  else if (a === 'down' && i > 0) [ls[i], ls[i - 1]] = [ls[i - 1], ls[i]];
  else if (a === 'hide') L.hidden = !L.hidden;
  else if (a === 'lock') L.locked = !L.locked;
  else { selId = L.id; showTab('edit'); }
  if (a) commit();
  refresh();
});

/* ---------------------------------------------------------------- properties panel */
const fieldOptions = () => `<option value="">+ Insert field…</option>${columns.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('')}`;
const fontOptions = (v) => Object.entries(FONTS).map(([k, f]) => `<option value="${k}" ${k === v ? 'selected' : ''}>${f[1]}</option>`).join('');
const num = (k, label, v, min, max, step = 1) => `<label class="t-field">${label}<input class="t-input" type="number" data-p="${k}" value="${v}" min="${min}" max="${max}" step="${step}"></label>`;
const col = (k, label, v) => `<label class="t-field"><span>${label}</span><input type="color" data-p="${k}" value="${/^#[0-9a-f]{6}$/i.test(v) ? v : '#000000'}"></label>`;
const chk = (k, label, v) => `<label class="t-check"><input type="checkbox" data-p="${k}" ${v ? 'checked' : ''}> ${label}</label>`;
const selc = (k, label, v, opts) => `<label class="t-field">${label}<select class="t-select" data-p="${k}">${opts.map(([a, b]) => `<option value="${a}" ${a === v ? 'selected' : ''}>${b}</option>`).join('')}</select></label>`;
function renderProps() {
  const L = sel(), box = E('props');
  if (!L) { box.innerHTML = '<p class="muted">Click an element on the card to edit it, or add one from <b>Elements</b>.</p>'; return; }
  let h = '';
  if (L.type === 'text') h = `<label class="t-field">Text <textarea class="t-textarea" data-p="text" rows="2">${escapeHtml(L.text)}</textarea></label>
    <select class="t-select ic-insert" data-insert="text">${fieldOptions()}</select>
    <div class="t-row">${selc('font', 'Font', L.font, Object.entries(FONTS).map(([k, f]) => [k, f[1]]))}${selc('weight', 'Weight', String(L.weight), [['400', 'Regular'], ['500', 'Medium'], ['600', 'Semibold'], ['700', 'Bold'], ['800', 'Extra bold']])}</div>
    <div class="t-row">${num('size', 'Size', L.size, 6, 400)}${selc('align', 'Align', L.align, [['left', 'Left'], ['center', 'Centre'], ['right', 'Right']])}</div>
    <div class="t-row cap-colors">${col('color', 'Colour', L.color)}${col('box', 'Highlight', L.box || '#ffffff')}<label class="t-check" style="align-self:end"><input type="checkbox" data-p="boxOn" ${L.box ? 'checked' : ''}> Highlight</label></div>
    <div class="t-row">${num('spacing', 'Letter spacing', L.spacing, -10, 60)}${num('lineH', 'Line height', L.lineH, 0.8, 2.5, 0.05)}</div>
    ${chk('upper', 'CAPITALS', L.upper)}${chk('italic', 'Italic', L.italic)}${chk('fit', 'Shrink long text to fit the box', L.fit)}`;
  else if (L.type === 'image') h = `${selc('src', 'Image', L.src, [['photo', 'Photo from data (per person)'], ['asset', 'Same image on every card (logo, signature)']])}
    ${L.src === 'asset' ? '<button class="t-btn sm" type="button" data-act="replace">Upload / replace image</button>' : `<p class="muted" style="font-size:.8rem">Photos are matched by the <b>${escapeHtml(photoCol() || 'Photo')}</b> column (file name), or by ID / name. <button class="t-btn sm" type="button" data-act="rowphoto">Set photo for this person</button></p>`}
    <div class="t-row">${selc('fit', 'Fit', L.fit, [['cover', 'Fill the frame'], ['contain', 'Whole image']])}${selc('shape', 'Shape', L.shape, [['rect', 'Square corners'], ['rounded', 'Rounded'], ['circle', 'Circle / oval']])}</div>
    <div class="t-row">${num('radius', 'Corner radius', L.radius, 0, 300)}${num('border', 'Border', L.border, 0, 60)}</div>${col('borderColor', 'Border colour', L.borderColor)}`;
  else if (L.type === 'shape') h = `${selc('shape', 'Shape', L.shape, [['rect', 'Rectangle'], ['circle', 'Circle / oval'], ['line', 'Line'], ['wavetop', 'Wave header'], ['wave', 'Wave footer'], ['arc', 'Curved header'], ['slant', 'Slanted band']])}
    <div class="t-row cap-colors">${col('fill', 'Colour', L.fill)}${col('fill2', 'Gradient to', L.fill2 || L.fill)}<label class="t-check" style="align-self:end"><input type="checkbox" data-p="gradOn" ${L.fill2 ? 'checked' : ''}> Gradient</label></div>
    <div class="t-row">${num('angle', 'Gradient angle', L.angle, 0, 360)}${num('radius', 'Corner radius', L.radius, 0, 400)}</div>
    <div class="t-row cap-colors">${col('stroke', 'Outline', L.stroke || '#000000')}${num('strokeW', 'Outline width', L.strokeW, 0, 40)}<label class="t-check" style="align-self:end"><input type="checkbox" data-p="strokeOn" ${L.stroke ? 'checked' : ''}> Outline</label></div>`;
  else h = `<label class="t-field">${L.type === 'qr' ? 'QR code content' : 'Barcode value'} <input class="t-input" type="text" data-p="value" value="${escapeHtml(L.value)}"></label>
    <select class="t-select ic-insert" data-insert="value">${fieldOptions()}</select>
    <p class="muted" style="font-size:.78rem">${L.type === 'qr' ? 'Tip: a link like https://example.com/staff/{{ID}} makes the QR open a verification page.' : 'Code 128: letters, numbers and symbols.'}</p>
    <div class="t-row cap-colors">${col('color', 'Colour', L.color)}${col('bg', 'Background', L.bg)}</div>${L.type === 'barcode' ? chk('showText', 'Show the value under the bars', L.showText) : ''}`;
  h += `<div class="t-row">${num('x', 'X', Math.round(L.x), -2000, 4000)}${num('y', 'Y', Math.round(L.y), -2000, 4000)}</div>
    <div class="t-row">${num('w', 'Width', Math.round(L.w), 4, 4000)}${num('h', 'Height', Math.round(L.h), 1, 4000)}</div>
    <label class="t-field">Opacity <input class="t-range" type="range" data-p="opacity" min="0.1" max="1" step="0.05" value="${L.opacity ?? 1}"></label>
    <div class="t-actions" style="margin-top:4px"><button class="t-btn sm" type="button" data-act="center-h">↔ Centre</button><button class="t-btn sm" type="button" data-act="center-v">↕ Centre</button><button class="t-btn sm" type="button" data-act="dup">Duplicate</button><button class="t-btn sm" type="button" data-act="del">Delete</button></div>`;
  box.innerHTML = h;
}
function syncGeom() { const L = sel(); if (!L) return; for (const k of ['x', 'y', 'w', 'h']) { const i = E('props').querySelector(`[data-p="${k}"]`); if (i && document.activeElement !== i) i.value = Math.round(L[k]); } }
E('props').addEventListener('input', (e) => {
  const L = sel(), t = e.target, k = t.dataset.p; if (!L || !k) return;
  if (k === 'boxOn') L.box = t.checked ? (E('props').querySelector('[data-p="box"]').value) : '';
  else if (k === 'box') { if (E('props').querySelector('[data-p="boxOn"]').checked) L.box = t.value; }
  else if (k === 'gradOn') L.fill2 = t.checked ? E('props').querySelector('[data-p="fill2"]').value : '';
  else if (k === 'fill2') { if (E('props').querySelector('[data-p="gradOn"]').checked) L.fill2 = t.value; }
  else if (k === 'strokeOn') L.stroke = t.checked ? E('props').querySelector('[data-p="stroke"]').value : '';
  else if (k === 'stroke') { if (E('props').querySelector('[data-p="strokeOn"]').checked) L.stroke = t.value; }
  else if (t.type === 'checkbox') L[k] = t.checked;
  else if (t.type === 'number' || t.type === 'range') { if (t.value !== '') L[k] = +t.value; }
  else L[k] = k === 'weight' ? +t.value : t.value;
  draw(); if (k === 'text' || k === 'value') renderLayers();
  clearTimeout(E('props').__t); E('props').__t = setTimeout(commit, 400);
});
E('props').addEventListener('change', (e) => {
  const t = e.target, L = sel(); if (!L) return;
  if (t.dataset.insert) { if (t.value) { const area = E('props').querySelector(`[data-p="${t.dataset.insert}"]`), ins = `{{${t.value}}}`; const pos = area.selectionStart ?? area.value.length; area.value = area.value.slice(0, pos) + ins + area.value.slice(area.selectionEnd ?? pos); area.dispatchEvent(new Event('input', { bubbles: true })); t.value = ''; } return; }
  if (t.dataset.p === 'src' || t.dataset.p === 'shape') renderProps();
});
E('props').addEventListener('click', (e) => {
  const a = e.target.closest('[data-act]')?.dataset.act, L = sel(); if (!a || !L) return;
  const s = size();
  if (a === 'del') removeSel(); else if (a === 'dup') duplicateSel();
  else if (a === 'center-h') { L.x = Math.round((s.w - L.w) / 2); commit(); draw(); syncGeom(); }
  else if (a === 'center-v') { L.y = Math.round((s.h - L.h) / 2); commit(); draw(); syncGeom(); }
  else if (a === 'replace') pickImage((id) => { L.asset = id; commit(); draw(); });
  else if (a === 'rowphoto') E('photo1-in').click();
});
E('photo1-in').addEventListener('change', async () => {
  const f = E('photo1-in').files[0]; E('photo1-in').value = ''; if (!f) return;
  await addPhotos([f]); const r = rows[rowIdx], pc = photoCol() || 'Photo';
  if (!columns.includes(pc)) { columns.push(pc); rows.forEach((x) => { if (!(pc in x)) x[pc] = ''; }); }
  r[pc] = f.name; renderTable(); draw();
});

/* ---------------------------------------------------------------- card settings */
function renderCard() {
  const bg = cur().bg;
  E('size').value = doc.size; E('radius').value = doc.radius;
  E('bgtype').value = bg.type; E('bgc1').value = bg.c1.startsWith('#') ? bg.c1 : '#ffffff'; E('bgc2').value = (bg.c2 || '#ffffff').startsWith('#') ? bg.c2 : '#ffffff'; E('bgangle').value = bg.angle || 0;
  E('pattern').value = bg.pattern || 'none'; E('patc').value = bg.patternColor || '#000000'; E('pato').value = Math.round((bg.patternOpacity ?? 0.06) * 100);
  E('bgc2').closest('.t-field').hidden = bg.type !== 'gradient'; E('bgangle').closest('.t-field').hidden = bg.type !== 'gradient'; E('bgimg').hidden = bg.type !== 'image';
}
E('size').innerHTML = Object.entries(SIZES).map(([k, s]) => `<option value="${k}">${s.name}</option>`).join('');
E('size').addEventListener('change', () => {
  const o = size(), n = SIZES[E('size').value], kx = n.w / o.w, ky = n.h / o.h, k = Math.min(kx, ky);
  for (const sd of ['front', 'back']) for (const L of doc[sd].layers) { L.x *= kx; L.y *= ky; L.w *= kx; L.h *= ky; if (L.size) L.size = Math.round(L.size * k); if (L.border) L.border *= k; }
  doc.size = E('size').value; commit(); refresh();
});
E('radius').addEventListener('input', () => { doc.radius = +E('radius').value; draw(); clearTimeout(E('radius').__t); E('radius').__t = setTimeout(commit, 400); });
['bgtype', 'bgc1', 'bgc2', 'bgangle', 'pattern', 'patc', 'pato'].forEach((id) => E(id).addEventListener('input', () => {
  const bg = cur().bg;
  bg.type = E('bgtype').value; bg.c1 = E('bgc1').value; bg.c2 = E('bgc2').value; bg.angle = +E('bgangle').value; bg.pattern = E('pattern').value; bg.patternColor = E('patc').value; bg.patternOpacity = +E('pato').value / 100;
  if (bg.type === 'image' && !bg.asset) E('bgimg').click();
  renderCard(); draw(); clearTimeout(E('pato').__t); E('pato').__t = setTimeout(commit, 400);
}));
E('bgimg').addEventListener('click', (e) => { if (e.target === E('bgimg')) pickImage((id) => { cur().bg.asset = id; cur().bg.type = 'image'; commit(); renderCard(); draw(); }); });
E('copyback').addEventListener('click', () => { doc.back.bg = JSON.parse(JSON.stringify(doc.front.bg)); commit(); if (side === 'back') refresh(); status('Back background now matches the front.', 'ok'); });

/* ---------------------------------------------------------------- data: CSV / Excel / manual, photos */
function parseCSV(text) {
  const out = []; let row = [], f = '', q = false;
  const sep = (text.split('\n')[0].match(/;/g) || []).length > (text.split('\n')[0].match(/,/g) || []).length ? ';' : text.includes('\t') && !text.includes(',') ? '\t' : ',';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
    else if (c === '"') q = true; else if (c === sep) { row.push(f); f = ''; } else if (c === '\n' || c === '\r') { if (c === '\r' && text[i + 1] === '\n') i++; row.push(f); f = ''; if (row.some((x) => x.trim())) out.push(row); row = []; } else f += c;
  }
  row.push(f); if (row.some((x) => x.trim())) out.push(row);
  return out;
}
function setData(table) {
  if (!table.length) { status('No rows found in that file.', 'err'); return; }
  const head = table[0].map((h, i) => String(h || '').trim() || `Column ${i + 1}`);
  columns = head; rows = table.slice(1).map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] == null ? '' : String(r[i]).trim()])));
  usingSample = false; rowIdx = 0;
  const missing = new Set(); for (const sd of ['front', 'back']) for (const L of doc[sd].layers) for (const f of fieldsIn(L.text || L.value)) if (!columns.some((c) => c.toLowerCase() === f.toLowerCase())) missing.add(f);
  renderTable(); refreshRecord(); renderProps();
  status(`Loaded ${rows.length} people with ${columns.length} columns.${missing.size ? ` The design uses fields not in your data: ${[...missing].map((m) => `{{${m}}}`).join(', ')}. Rename the columns, or edit those texts.` : ' All fields in the design are matched.'}`, missing.size ? '' : 'ok');
}
E('data-in').addEventListener('change', async () => {
  const f = E('data-in').files[0]; E('data-in').value = ''; if (!f) return;
  try {
    if (/\.(xlsx|xls|ods)$/i.test(f.name)) {
      const XLSX = await loadLib('xlsx'), wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      setData(XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: false, defval: '' }));
    } else setData(parseCSV(await f.text()));
  } catch (e) { console.warn(e); status(`Could not read ${f.name}: ${e.message}`, 'err'); }
});
async function addPhotos(files) {
  let n = 0;
  for (const f of files) {
    if (!/^image\//.test(f.type) && !/\.(heic|heif|jpe?g|png|webp)$/i.test(f.name)) continue;
    try { const im = await decodeImage(f), k = Math.min(1, 900 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); photos.set(photoKey(f.name), c); n++; } catch (_) { /* skip */ }
  }
  // no column links photos to people yet: give them out in row order
  if (!photoCol() && n && n === files.length) { const keys = files.map((f) => photoKey(f.name)); const free = rows.filter((r) => !photoFor(r)); free.forEach((r, i) => { if (keys[i]) r.__photo = keys[i]; }); }
  const matched = rows.filter((r) => photoFor(r)).length;
  status(`${n} photo${n === 1 ? '' : 's'} added · ${matched} of ${rows.length} people have a photo.${matched < rows.length ? ` Name each photo like the person's ${photoCol() ? `“${photoCol()}” value` : 'ID'} (e.g. EMP-1042.jpg) to match it automatically.` : ''}`, matched ? 'ok' : '');
  renderTable(); draw();
}
E('photos-in').addEventListener('change', async () => { const fs = [...E('photos-in').files]; E('photos-in').value = ''; if (fs.length) await addPhotos(fs); });
E('sample-csv').addEventListener('click', () => {
  const esc = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : v);
  const csv = [SAMPLE_COLUMNS.join(','), ...SAMPLE_ROWS.map((r) => SAMPLE_COLUMNS.map((c) => esc(c === 'Photo' ? `${r.ID}.jpg` : r[c])).join(','))].join('\n');
  downloadBlob(new Blob([csv], { type: 'text/csv;charset=utf-8' }), 'id-cards-sample.csv');
});
function renderTable() {
  const t = E('table');
  t.innerHTML = `<thead><tr><th>#</th>${columns.map((c, i) => `<th><span contenteditable="true" data-col="${i}" spellcheck="false">${escapeHtml(c)}</span><button type="button" data-delcol="${i}" title="Delete column">✕</button></th>`).join('')}<th></th></tr></thead>
    <tbody>${rows.map((r, ri) => `<tr class="${ri === rowIdx ? 'cur' : ''}"><td class="ic-rn"><button type="button" data-go="${ri}" title="Show this card">${ri + 1}</button>${photoFor(r) ? '<span title="Has a photo">📷</span>' : ''}</td>${columns.map((c) => `<td contenteditable="true" data-r="${ri}" data-c="${escapeHtml(c)}" spellcheck="false">${escapeHtml(r[c] ?? '')}</td>`).join('')}<td><button type="button" data-delrow="${ri}" title="Delete row">✕</button></td></tr>`).join('')}</tbody>`;
  E('data-info').textContent = `${rows.length} ${rows.length === 1 ? 'person' : 'people'} · ${columns.length} fields${usingSample ? ' (sample data: replace it with your own)' : ''}`;
}
E('table').addEventListener('input', (e) => {
  const td = e.target.closest('[data-r]'), th = e.target.closest('[data-col]');
  if (td) { rows[+td.dataset.r][td.dataset.c] = td.textContent; if (+td.dataset.r === rowIdx) draw(); usingSample = false; }
  if (th) {
    const i = +th.dataset.col, old = columns[i], nw = th.textContent.trim(); if (!nw || nw === old) return;
    columns[i] = nw; rows.forEach((r) => { r[nw] = r[old]; delete r[old]; });
    $$(`[data-c="${CSS.escape(old)}"]`, E('table')).forEach((x) => { x.dataset.c = nw; }); draw();
  }
});
E('table').addEventListener('click', (e) => {
  const go = e.target.closest('[data-go]'), dr = e.target.closest('[data-delrow]'), dc = e.target.closest('[data-delcol]');
  if (go) { rowIdx = +go.dataset.go; refreshRecord(); }
  else if (dr) { rows.splice(+dr.dataset.delrow, 1); rowIdx = Math.min(rowIdx, Math.max(0, rows.length - 1)); renderTable(); refreshRecord(); }
  else if (dc) { const c = columns.splice(+dc.dataset.delcol, 1)[0]; rows.forEach((r) => delete r[c]); renderTable(); draw(); renderProps(); }
});
E('addrow').addEventListener('click', () => { rows.push(Object.fromEntries(columns.map((c) => [c, '']))); rowIdx = rows.length - 1; renderTable(); refreshRecord(); E('table').querySelector('tbody tr:last-child td[contenteditable]')?.focus(); });
E('addcol').addEventListener('click', () => { let n = 'New field', i = 2; while (columns.includes(n)) n = `New field ${i++}`; columns.push(n); rows.forEach((r) => { r[n] = ''; }); renderTable(); renderProps(); });
E('clear-data').addEventListener('click', () => { rows = [Object.fromEntries(columns.map((c) => [c, '']))]; usingSample = false; rowIdx = 0; renderTable(); refreshRecord(); });

/* ---------------------------------------------------------------- export */
async function cardCanvas(row, sd, scale = 1) {
  const s = size(), c = document.createElement('canvas'); c.width = Math.round(s.w * scale); c.height = Math.round(s.h * scale);
  const g = c.getContext('2d'); g.scale(scale, scale); renderSide(g, doc, sd, row, ctxFor(false)); return c;
}
const nameFor = (row, i) => { const key = E('namecol').value; const base = (key && row[key]) || `card-${i + 1}`; return String(base).replace(/[\\/:*?"<>|]+/g, '-').trim().slice(0, 80) || `card-${i + 1}`; };
const sidesWanted = () => (E('sides').value === 'both' ? ['front', 'back'] : [E('sides').value]);
async function fontsReady() { if (document.fonts) await Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]); }
E('png').addEventListener('click', async () => {
  await fontsReady();
  for (const sd of sidesWanted()) downloadBlob(await canvasToBlob(await cardCanvas(rows[rowIdx], sd), 'image/png'), `${nameFor(rows[rowIdx] || {}, rowIdx)}-${sd}.png`);
  status('Downloaded at 300 DPI, ready to print.', 'ok');
});
E('zip').addEventListener('click', async () => {
  if (!rows.length) return; await fontsReady();
  const files = []; const btn = E('zip'); btn.disabled = true;
  try {
    for (let i = 0; i < rows.length; i++) {
      for (const sd of sidesWanted()) files.push({ name: `${nameFor(rows[i], i)}${sidesWanted().length > 1 ? `-${sd}` : ''}.png`, blob: await canvasToBlob(await cardCanvas(rows[i], sd), 'image/png') });
      if (i % 3 === 0) { status(`Creating card ${i + 1} of ${rows.length}…`); await new Promise((r) => setTimeout(r, 0)); }
    }
    await downloadZip(files, 'id-cards.zip');
    status(`${files.length} PNG files (300 DPI) in id-cards.zip.`, 'ok');
  } catch (e) { status(`Could not create the ZIP: ${e.message}`, 'err'); }
  btn.disabled = false;
});
E('pdf').addEventListener('click', async () => {
  if (!rows.length) return; await fontsReady();
  const btn = E('pdf'); btn.disabled = true;
  try {
    const { PDFDocument, rgb } = await loadLib('pdflib');
    const pdf = await PDFDocument.create(), s = size(), pt = (v) => (v / 25.4) * 72;
    const [PW, PH] = E('paper').value === 'letter' ? [612, 792] : [595.28, 841.89], cw = pt(s.mmW), ch = pt(s.mmH), gap = pt(4), margin = pt(10);
    const cols = Math.max(1, Math.floor((PW - 2 * margin + gap) / (cw + gap))), rws = Math.max(1, Math.floor((PH - 2 * margin + gap) / (ch + gap))), per = cols * rws;
    const ox = (PW - (cols * cw + (cols - 1) * gap)) / 2, oy = (PH - (rws * ch + (rws - 1) * gap)) / 2;
    const marks = (page, x, y) => { const L = pt(3), c = rgb(0.6, 0.6, 0.6); for (const [ax, ay] of [[x, y], [x + cw, y], [x, y + ch], [x + cw, y + ch]]) { page.drawLine({ start: { x: ax - L - 2, y: ay }, end: { x: ax - 2, y: ay }, thickness: 0.3, color: c }); page.drawLine({ start: { x: ax + 2, y: ay }, end: { x: ax + L + 2, y: ay }, thickness: 0.3, color: c }); page.drawLine({ start: { x: ax, y: ay - L - 2 }, end: { x: ax, y: ay - 2 }, thickness: 0.3, color: c }); page.drawLine({ start: { x: ax, y: ay + 2 }, end: { x: ax, y: ay + L + 2 }, thickness: 0.3, color: c }); } };
    for (let p0 = 0; p0 < rows.length; p0 += per) {
      for (const sd of sidesWanted()) {
        const page = pdf.addPage([PW, PH]);
        for (let j = 0; j < per && p0 + j < rows.length; j++) {
          const cx = j % cols, cy = Math.floor(j / cols);
          // backs are mirrored left-to-right so they line up with the fronts when printed double-sided
          const col = sd === 'back' ? cols - 1 - cx : cx;
          const x = ox + col * (cw + gap), y = PH - oy - (cy + 1) * ch - cy * gap;
          const png = await pdf.embedPng(await (await canvasToBlob(await cardCanvas(rows[p0 + j], sd), 'image/png')).arrayBuffer());
          page.drawImage(png, { x, y, width: cw, height: ch }); marks(page, x, y);
        }
        status(`Laying out cards ${Math.min(rows.length, p0 + per)} of ${rows.length}…`); await new Promise((r) => setTimeout(r, 0));
      }
    }
    downloadBlob(new Blob([await pdf.save()], { type: 'application/pdf' }), 'id-cards-print.pdf');
    status(`Print sheet ready: ${per} cards per page, true size (${s.mmW} × ${s.mmH} mm), with cut marks. Print at 100% (“Actual size”).`, 'ok');
  } catch (e) { console.warn(e); status(`Could not create the PDF: ${e.message}`, 'err'); }
  btn.disabled = false;
});
// designs: save / load (browser + file)
E('save-design').addEventListener('click', () => {
  const name = prompt('Name this design:', TEMPLATES[doc.template]?.name || 'My ID card'); if (!name) return;
  const all = JSON.parse(store.get('designs', '{}')); all[name] = { doc, assets: assetsJson(), at: Date.now() };
  if (!store.set('designs', JSON.stringify(all))) { status('Your browser storage is full; use “Download design file” instead.', 'err'); return; }
  renderSaved(); status(`Saved “${name}” in this browser.`, 'ok');
});
function renderSaved() {
  const all = JSON.parse(store.get('designs', '{}')), keys = Object.keys(all);
  E('saved').innerHTML = keys.length ? keys.map((k) => `<li><button type="button" data-load="${escapeHtml(k)}">${escapeHtml(k)}</button><button type="button" data-del="${escapeHtml(k)}" aria-label="Delete">✕</button></li>`).join('') : '<li class="muted">No saved designs yet.</li>';
}
E('saved').addEventListener('click', async (e) => {
  const all = JSON.parse(store.get('designs', '{}')), l = e.target.closest('[data-load]'), d = e.target.closest('[data-del]');
  if (l) { const v = all[l.dataset.load]; await loadAssets(v.assets); doc = v.doc; side = 'front'; selId = null; commit(); refresh(); status(`Loaded “${l.dataset.load}”.`, 'ok'); }
  if (d && confirm(`Delete “${d.dataset.del}”?`)) { delete all[d.dataset.del]; store.set('designs', JSON.stringify(all)); renderSaved(); }
});
E('dl-design').addEventListener('click', () => downloadBlob(new Blob([JSON.stringify({ webcamclicksIdCard: 1, doc, assets: assetsJson() })], { type: 'application/json' }), 'id-card-design.json'));
E('design-in').addEventListener('change', async () => {
  const f = E('design-in').files[0]; E('design-in').value = ''; if (!f) return;
  try { const v = JSON.parse(await f.text()); if (!v.doc || !v.doc.front) throw new Error('not an ID card design'); await loadAssets(v.assets); doc = v.doc; side = 'front'; selId = null; commit(); refresh(); status('Design loaded.', 'ok'); }
  catch (e) { status(`That file isn't an ID card design (${e.message}).`, 'err'); }
});

/* ---------------------------------------------------------------- tabs & refresh */
function showTab(t) { $$('[data-tab]', E('tabs')).forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === t))); $$('.ic-pane').forEach((p) => { p.hidden = p.dataset.pane !== t; }); }
E('tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
function refresh() {
  $$('[data-side]', E('side')).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.side === side)));
  E('namecol').innerHTML = columns.map((c) => `<option value="${escapeHtml(c)}" ${/name/i.test(c) ? 'selected' : ''}>${escapeHtml(c)}</option>`).join('');
  renderCard(); renderLayers(); renderProps(); refreshRecord();
}
document.fonts && document.fonts.addEventListener('loadingdone', () => { draw(); renderTemplates(); });

(async () => {
  renderTemplates(); renderSaved(); renderTable();
  const draft = store.get('draft', null);
  if (draft) { try { const v = JSON.parse(draft); await loadAssets(v.assets); doc = v.doc; lastSnap = snap(); refresh(); status('Your last design was restored. Pick a template to start over.'); return; } catch (_) { /* fall through */ } }
  useTemplate('corporate');
})();
window.__icTest = { get doc() { return doc; }, get rows() { return rows; }, get columns() { return columns; }, photoFor, useTemplate, setData };
