/* WebcamClicks — Background remover with manual refine.
   1. On-device AI (MediaPipe selfie segmentation) makes a first cut-out of people.
   2. Erase / Restore brushes refine it — or start fully manual for objects and pets.
   Strokes are stored as vectors (cheap undo/redo) and layered over the AI mask:
     final alpha = (AI mask ∪ restore strokes) − erase strokes, latest stroke wins.
   Nothing is uploaded. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, downloadZip, setStatus, decodeImage, canvasToBlob } from './common.js';
import { createTask, personMask, MODELS } from '../segmentation/vision.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), list: $('#t-list'), status: $('#t-status'),
  stage: $('#t-stage'), view: $('#t-preview-canvas'), cursor: $('#t-cursor'),
  out: $('#t-out'), color: $('#t-color'), edge: $('#t-edge'), start: $('#t-startfrom'),
  run: $('#t-run'), zip: $('#t-zip'), clear: $('#t-clear'), dlOne: $('#t-dl-one'),
  size: $('#t-brush'), sizeVal: $('#t-brush-val'), soft: $('#t-soft'),
  undo: $('#t-undo'), redo: $('#t-redo'), reset: $('#t-reset'), ghost: $('#t-ghost'),
  zoomIn: $('#t-zoom-in'), zoomOut: $('#t-zoom-out'), zoomFit: $('#t-zoom-fit'), zoomVal: $('#t-zoom-val'),
  editHint: $('#t-edit-hint')
};

let seg = null, segLoading = null;
let items = [];        // { id, file, src, aiMask, strokes[], redo[], result, resultName, thumb, base }
let selected = null;
let tool = 'view';     // view | erase | restore
let zoom = 1;          // 1 = fit

/* ------------------------------------------------------------------ AI */

function loadSeg() {
  if (seg) return Promise.resolve(seg);
  if (!segLoading) {
    segLoading = createTask('ImageSegmenter', {
      baseOptions: { modelAssetPath: MODELS.segmenterSquare }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false
    }).then((s) => (seg = s)).catch((e) => { segLoading = null; throw e; });
  }
  return segLoading;
}

async function prepare(it) {
  const bmp = await decodeImage(it.file);
  const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const src = document.createElement('canvas');
  src.width = Math.round(bmp.width * s); src.height = Math.round(bmp.height * s);
  src.getContext('2d').drawImage(bmp, 0, 0, src.width, src.height);
  it.src = src;
  it.strokes = it.strokes || []; it.redo = it.redo || [];
  it.base = els.start.value;
  if (it.base === 'ai') await segment(it);
}

async function segment(it) {
  await loadSeg();
  const res = seg.segment(it.src);
  const m = personMask(res);
  const conf = m.getAsFloat32Array();
  const mask = document.createElement('canvas');
  mask.width = m.width; mask.height = m.height;
  const mctx = mask.getContext('2d');
  const img = mctx.createImageData(m.width, m.height);
  let cover = 0;
  for (let i = 0; i < conf.length; i++) { img.data[i * 4 + 3] = conf[i] * 255; cover += conf[i]; }
  mctx.putImageData(img, 0, 0);
  if (res.close) res.close();
  it.aiMask = mask;
  it.aiCoverage = cover / conf.length;
}

/* ------------------------------------------------------------------ masks */

function baseMask(it) {
  const { width: w, height: h } = it.src;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  if (it.base === 'keep') { g.fillRect(0, 0, w, h); return c; }
  if (it.base === 'remove' || !it.aiMask) return c;
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(it.aiMask, 0, 0, w, h);
  const k = 1 + (+els.edge.value / 100) * 5;          // edge: soft hair ↔ crisp outline
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) {
    const a = Math.min(1, Math.max(0, (d.data[i] / 255 - 0.5) * k + 0.5));
    d.data[i] = a * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function drawStroke(g, st) {
  g.save();
  g.globalCompositeOperation = st.mode === 'erase' ? 'destination-out' : 'source-over';
  g.strokeStyle = g.fillStyle = '#000';
  g.lineCap = g.lineJoin = 'round';
  g.lineWidth = st.size;
  if (st.soft > 0 && typeof g.filter === 'string') g.filter = `blur(${Math.round(st.size * st.soft * 0.25)}px)`;
  const p = st.pts;
  if (p.length === 1) { g.beginPath(); g.arc(p[0][0], p[0][1], st.size / 2, 0, Math.PI * 2); g.fill(); }
  else { g.beginPath(); g.moveTo(p[0][0], p[0][1]); for (let i = 1; i < p.length; i++) g.lineTo(p[i][0], p[i][1]); g.stroke(); }
  g.restore();
}

/** Final mask = base, then every stroke in order (latest wins).
    Finished strokes are baked into a cached "committed" mask, so while painting only the
    stroke in progress is drawn on top — cost stays flat however many edits there are. */
function finalMask(it) {
  const baseKey = `${it.base}|${els.edge.value}`;
  if (it._baseKey !== baseKey || !it._base) { it._base = baseMask(it); it._baseKey = baseKey; it._cm = null; }
  const n = it.strokes.length;
  const live = drawing && n && it.strokes[n - 1] === drawing ? it.strokes[n - 1] : null;
  const committed = live ? n - 1 : n;
  if (!it._cm || it._cmCount !== committed || it._cmList !== it.strokes[committed - 1]) {
    const c = it._cm || document.createElement('canvas');
    c.width = it._base.width; c.height = it._base.height;
    const g = c.getContext('2d');
    g.clearRect(0, 0, c.width, c.height);
    g.drawImage(it._base, 0, 0);
    for (let i = 0; i < committed; i++) drawStroke(g, it.strokes[i]);
    it._cm = c; it._cmCount = committed; it._cmList = it.strokes[committed - 1];
  }
  if (!live) return it._cm;
  const m = it._live || (it._live = document.createElement('canvas'));
  if (m.width !== it._cm.width || m.height !== it._cm.height) { m.width = it._cm.width; m.height = it._cm.height; }
  const g = m.getContext('2d');
  g.globalCompositeOperation = 'copy';
  g.drawImage(it._cm, 0, 0);
  g.globalCompositeOperation = 'source-over';
  drawStroke(g, live);
  return m;
}

function composite(it, { preview = false } = {}) {
  const { width: w, height: h } = it.src;
  const mask = finalMask(it);
  const person = document.createElement('canvas'); person.width = w; person.height = h;
  const p = person.getContext('2d');
  p.drawImage(it.src, 0, 0);
  p.globalCompositeOperation = 'destination-in';
  p.drawImage(mask, 0, 0);
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  const mode = els.out.value;
  if (mode === 'blur') { o.filter = `blur(${Math.round(Math.max(w, h) / 90)}px)`; o.drawImage(it.src, 0, 0); o.filter = 'none'; }
  else if (mode === 'white') { o.fillStyle = '#ffffff'; o.fillRect(0, 0, w, h); }
  else if (mode === 'color') { o.fillStyle = els.color.value; o.fillRect(0, 0, w, h); }
  if (preview && els.ghost.checked) {
    // show what was removed as a faint red ghost, so it's easy to restore precisely
    const gh = document.createElement('canvas'); gh.width = w; gh.height = h;
    const gg = gh.getContext('2d');
    gg.drawImage(it.src, 0, 0);
    gg.globalCompositeOperation = 'source-atop';
    gg.fillStyle = 'rgba(255, 40, 40, 0.45)'; gg.fillRect(0, 0, w, h);
    gg.globalCompositeOperation = 'destination-out';
    gg.drawImage(mask, 0, 0);
    o.globalAlpha = 0.55; o.drawImage(gh, 0, 0); o.globalAlpha = 1;
  }
  o.drawImage(person, 0, 0);
  return out;
}

/* ------------------------------------------------------------------ view */

let rafPending = false;
function redraw() {
  if (rafPending) return;
  rafPending = true;
  requestAnimationFrame(() => {
    rafPending = false;
    if (!selected || !selected.src) { els.view.width = els.view.height = 1; updateEditUi(); return; }
    const c = composite(selected, { preview: true });
    if (els.view.width !== c.width || els.view.height !== c.height) { els.view.width = c.width; els.view.height = c.height; applyZoom(); }
    els.view.getContext('2d').clearRect(0, 0, c.width, c.height);
    els.view.getContext('2d').drawImage(c, 0, 0);
    updateEditUi();
  });
}

function applyZoom() {
  const wrap = els.stage;
  if (!selected || !selected.src) { els.view.style.width = ''; return; }
  const fitW = Math.min(wrap.clientWidth - 32, (wrap.clientHeight - 32) * (selected.src.width / selected.src.height), selected.src.width);
  els.view.style.width = `${Math.max(40, fitW * zoom)}px`;
  els.view.style.maxWidth = zoom > 1 ? 'none' : '';
  els.view.style.maxHeight = zoom > 1 ? 'none' : '';
  wrap.classList.toggle('zoomed', zoom > 1);
  els.zoomVal.textContent = `${Math.round(zoom * 100)}%`;
}

function updateEditUi() {
  const has = !!(selected && selected.src);
  [els.undo, els.redo, els.reset, els.dlOne].forEach((b) => (b.disabled = !has));
  if (has) {
    els.undo.disabled = !selected.strokes.length;
    els.redo.disabled = !selected.redo.length;
    els.reset.disabled = !selected.strokes.length;
  }
  els.sizeVal.textContent = `${els.size.value}px`;
  document.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === tool)));
  els.stage.dataset.tool = tool;
  els.editHint.textContent = !has ? 'Add a photo to start.'
    : tool === 'view' ? 'Choose Erase or Restore to paint. Tip: E / R / V switch tools, [ and ] change the brush size.'
    : tool === 'erase' ? 'Paint over anything that should be removed.' : 'Paint over parts of the subject that were cut away.';
}

/* ------------------------------------------------------------------ painting */

let drawing = null;   // current stroke

function toImage(e) {
  const r = els.view.getBoundingClientRect();
  return [(e.clientX - r.left) * (els.view.width / r.width), (e.clientY - r.top) * (els.view.height / r.height)];
}

function brushPx() {
  // brush size slider is in screen pixels; convert to image pixels so it feels the same at any zoom
  const r = els.view.getBoundingClientRect();
  return Math.max(1, +els.size.value * (els.view.width / Math.max(1, r.width)));
}

function moveCursor(e) {
  const r = els.stage.getBoundingClientRect();
  const d = +els.size.value;
  els.cursor.style.width = els.cursor.style.height = `${d}px`;
  els.cursor.style.transform = `translate(${e.clientX - r.left - d / 2 + els.stage.scrollLeft}px, ${e.clientY - r.top - d / 2 + els.stage.scrollTop}px)`;
  els.cursor.dataset.mode = tool;
}

els.view.addEventListener('pointerdown', (e) => {
  if (!selected || !selected.src || tool === 'view' || e.button > 0) return;
  e.preventDefault();
  els.view.setPointerCapture(e.pointerId);
  drawing = { mode: tool, size: brushPx(), soft: +els.soft.value / 100, pts: [toImage(e)] };
  selected.strokes.push(drawing);
  selected.redo = [];
  selected.strokeVersion = (selected.strokeVersion || 0) + 1;
  invalidateResult(selected);
  redraw();
});
els.view.addEventListener('pointermove', (e) => {
  if (tool !== 'view') moveCursor(e);
  if (!drawing) return;
  const pts = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
  pts.forEach((pe) => drawing.pts.push(toImage(pe)));
  selected.strokeVersion++;
  redraw();
});
const endStroke = () => { if (drawing) { drawing = null; redraw(); updateEditUi(); render(); } };
els.view.addEventListener('pointerup', endStroke);
els.view.addEventListener('pointercancel', endStroke);
els.stage.addEventListener('pointerleave', () => { els.cursor.style.opacity = '0'; });
els.stage.addEventListener('pointerenter', () => { els.cursor.style.opacity = tool === 'view' ? '0' : '1'; });

/* pan when zoomed in View mode */
let pan = null;
els.stage.addEventListener('pointerdown', (e) => {
  if (tool !== 'view' || zoom <= 1) return;
  pan = { x: e.clientX, y: e.clientY, sl: els.stage.scrollLeft, st: els.stage.scrollTop };
  els.stage.setPointerCapture(e.pointerId);
});
els.stage.addEventListener('pointermove', (e) => {
  if (!pan) return;
  els.stage.scrollLeft = pan.sl - (e.clientX - pan.x);
  els.stage.scrollTop = pan.st - (e.clientY - pan.y);
});
['pointerup', 'pointercancel'].forEach((ev) => els.stage.addEventListener(ev, () => { pan = null; }));

function setTool(t) { tool = t; els.cursor.style.opacity = t === 'view' ? '0' : '1'; updateEditUi(); }
function undo() { if (selected && selected.strokes.length) { selected.redo.push(selected.strokes.pop()); selected.strokeVersion++; invalidateResult(selected); redraw(); render(); } }
function redo() { if (selected && selected.redo.length) { selected.strokes.push(selected.redo.pop()); selected.strokeVersion++; invalidateResult(selected); redraw(); render(); } }
function setZoom(z) {
  const before = zoom;
  zoom = Math.min(8, Math.max(1, z));
  if (zoom !== before) {
    const s = els.stage, cx = (s.scrollLeft + s.clientWidth / 2) / before, cy = (s.scrollTop + s.clientHeight / 2) / before;
    applyZoom();
    s.scrollLeft = cx * zoom - s.clientWidth / 2;
    s.scrollTop = cy * zoom - s.clientHeight / 2;
  }
}

document.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.reset.addEventListener('click', () => { if (selected && selected.strokes.length && confirm('Remove all your brush edits for this photo?')) { selected.redo = selected.strokes.reverse(); selected.strokes = []; selected.strokeVersion++; invalidateResult(selected); redraw(); } });
els.zoomIn.addEventListener('click', () => setZoom(zoom * 1.5));
els.zoomOut.addEventListener('click', () => setZoom(zoom / 1.5));
els.zoomFit.addEventListener('click', () => setZoom(1));
els.size.addEventListener('input', updateEditUi);
els.ghost.addEventListener('change', redraw);
els.stage.addEventListener('wheel', (e) => {
  if (!(e.ctrlKey || e.metaKey) || !selected) return;   // ctrl/⌘ + wheel (and trackpad pinch) zooms
  e.preventDefault();
  setZoom(zoom * (e.deltaY < 0 ? 1.15 : 1 / 1.15));
}, { passive: false });
window.addEventListener('resize', applyZoom);

document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  const k = e.key.toLowerCase();
  if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (k === 'e') setTool('erase');
  else if (k === 'r') setTool('restore');
  else if (k === 'v') setTool('view');
  else if (k === '[') { els.size.value = Math.max(+els.size.min, +els.size.value - 5); updateEditUi(); }
  else if (k === ']') { els.size.value = Math.min(+els.size.max, +els.size.value + 5); updateEditUi(); }
});

/* ------------------------------------------------------------------ list + results */

function invalidateResult(it) { it.result = null; }

async function ensureResult(it) {
  if (it.result) return it;
  const c = composite(it);
  const transparent = els.out.value === 'transparent';
  it.result = await canvasToBlob(c, transparent ? 'image/png' : 'image/jpeg', 0.92);
  it.resultName = `${splitName(it.file.name)[0]}-${transparent ? 'no-bg.png' : 'new-bg.jpg'}`;
  const t = document.createElement('canvas'); const s = 96 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * s); t.height = Math.round(c.height * s);
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  it.thumb = t.toDataURL('image/png');
  return it;
}

function render() {
  els.list.innerHTML = items.map((it) => `<li class="t-item${it === selected ? ' sel' : ''}" data-id="${it.id}">
    ${it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : '<span class="thumb">…</span>'}
    <div><div class="name">${escapeHtml(it.file.name)}</div><div class="meta">${formatBytes(it.file.size)}${it.src ? ` · ${it.src.width}×${it.src.height}` : ''}${it.strokes && it.strokes.length ? ` · ${it.strokes.length} edit${it.strokes.length > 1 ? 's' : ''}` : ''}${it.error ? ` · <span class="grow">${it.error}</span>` : ''}</div></div>
    <div class="ctrl">${it.src ? '<button class="t-btn sm" data-act="dl" type="button">Download</button>' : ''}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`).join('');
  els.zip.disabled = !items.some((i) => i.src);
  els.run.disabled = !items.length;
}

function addFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) { setStatus(els.status, 'Please add photos (JPG, PNG or WebP).', 'err'); return; }
  imgs.forEach((file) => items.push({ id: Math.random().toString(36).slice(2), file, strokes: [], redo: [] }));
  if (els.start.value === 'ai') loadSeg().catch(() => {});
  render();
  run();
}

async function run() {
  els.run.disabled = true;
  if (els.start.value === 'ai' && items.some((i) => !i.src)) {
    try { setStatus(els.status, 'Loading the AI model (first time only)…'); await loadSeg(); }
    catch (e) { setStatus(els.status, 'Could not load the AI model. Choose "Keep whole photo" to work manually, or check your connection.', 'err'); els.run.disabled = false; return; }
  }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    if (it.src) continue;
    setStatus(els.status, `Processing ${i + 1} of ${items.length}…`);
    try { await prepare(it); await ensureResult(it); it.error = ''; }
    catch (e) { it.error = 'Could not process this image'; }
    if (!selected && it.src) select(it);
    render();
    await new Promise((r) => setTimeout(r, 0));
  }
  const lowCover = selected && selected.base === 'ai' && selected.aiCoverage < 0.02;
  setStatus(els.status, lowCover
    ? 'No person found in this photo. Set "Start from" to "Keep whole photo" and erase the background with the brush.'
    : 'Done. Use Erase and Restore to touch up any edges, then download.', lowCover ? 'err' : 'ok');
  els.run.disabled = false;
}

function select(it) { selected = it; zoom = 1; applyZoom(); redraw(); render(); }

els.list.addEventListener('click', async (e) => {
  const li = e.target.closest('.t-item'); if (!li) return;
  const it = items.find((x) => x.id === li.dataset.id); if (!it) return;
  const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
  if (act === 'rm') { items = items.filter((x) => x !== it); if (selected === it) { selected = null; redraw(); } render(); return; }
  if (act === 'dl' && it.src) { await ensureResult(it); render(); downloadBlob(it.result, it.resultName); return; }
  if (it.src) select(it);
});

/* settings that change every result */
const refreshAll = () => { items.forEach(invalidateResult); redraw(); };
els.out.addEventListener('change', () => { els.color.closest('.t-field').hidden = els.out.value !== 'color'; refreshAll(); });
els.color.addEventListener('input', refreshAll);
els.edge.addEventListener('input', refreshAll);
els.start.addEventListener('change', async () => {
  if (!selected || !selected.src) return;
  selected.base = els.start.value;
  if (selected.base === 'ai' && !selected.aiMask) {
    try { setStatus(els.status, 'Running AI cut-out…'); await segment(selected); setStatus(els.status, ''); }
    catch (_) { setStatus(els.status, 'Could not load the AI model.', 'err'); }
  }
  invalidateResult(selected); redraw();
});

setupDropzone(els.drop, els.input, addFiles);
els.run.addEventListener('click', run);
els.clear.addEventListener('click', () => { items = []; selected = null; render(); redraw(); setStatus(els.status, ''); });
els.dlOne.addEventListener('click', async () => { if (!selected) return; await ensureResult(selected); render(); downloadBlob(selected.result, selected.resultName); });
els.zip.addEventListener('click', async () => {
  const ready = items.filter((i) => i.src);
  for (const it of ready) await ensureResult(it);
  render();
  const files = ready.map((i) => ({ name: i.resultName, blob: i.result }));
  if (files.length === 1) return downloadBlob(files[0].blob, files[0].name);
  try { await downloadZip(files, 'background-removed.zip'); } catch (e) { setStatus(els.status, e.message, 'err'); }
});
els.color.closest('.t-field').hidden = true;
render();
updateEditUi();
