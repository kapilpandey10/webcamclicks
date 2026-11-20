/* WebcamClicks — Background remover for photos of people (on-device MediaPipe selfie segmentation). */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, downloadZip, setStatus, decodeImage, canvasToBlob } from './common.js';
import { createTask, personMask, MODELS } from '../segmentation/vision.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), list: $('#t-list'), status: $('#t-status'), preview: $('#t-preview-canvas'),
  out: $('#t-out'), color: $('#t-color'), edge: $('#t-edge'), run: $('#t-run'), zip: $('#t-zip'), clear: $('#t-clear')
};

let seg = null, segLoading = null;
let items = [];      // { id, file, src canvas, mask canvas, result blob }
let selected = null;

function loadSeg() {
  if (seg) return Promise.resolve(seg);
  if (!segLoading) {
    segLoading = createTask('ImageSegmenter', {
      baseOptions: { modelAssetPath: MODELS.segmenterSquare }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false
    }).then((s) => (seg = s)).catch((e) => { segLoading = null; throw e; });
  }
  return segLoading;
}

function addFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) { setStatus(els.status, 'Please add photos (JPG, PNG or WebP).', 'err'); return; }
  imgs.forEach((file) => items.push({ id: Math.random().toString(36).slice(2), file }));
  loadSeg().catch(() => {});
  render();
  run();
}

function render() {
  els.list.innerHTML = items.map((it) => `<li class="t-item${it === selected ? ' sel' : ''}" data-id="${it.id}">
    ${it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : '<span class="thumb">…</span>'}
    <div><div class="name">${escapeHtml(it.file.name)}</div><div class="meta">${formatBytes(it.file.size)}${it.src ? ` · ${it.src.width}×${it.src.height}` : ''}${it.result ? ` → ${formatBytes(it.result.size)}` : it.error ? ` · <span class="grow">${it.error}</span>` : ''}</div></div>
    <div class="ctrl">${it.result ? '<button class="t-btn sm" data-act="dl" type="button">Download</button>' : ''}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`).join('');
  els.zip.disabled = !items.some((i) => i.result);
  els.run.disabled = !items.length;
}

async function segment(it) {
  const bmp = await decodeImage(it.file);
  const s = Math.min(1, 2400 / Math.max(bmp.width, bmp.height));
  const src = document.createElement('canvas');
  src.width = Math.round(bmp.width * s); src.height = Math.round(bmp.height * s);
  src.getContext('2d').drawImage(bmp, 0, 0, src.width, src.height);
  await loadSeg();
  const res = seg.segment(src);
  const m = personMask(res);
  const conf = m.getAsFloat32Array();
  const mask = document.createElement('canvas');
  mask.width = m.width; mask.height = m.height;
  const mctx = mask.getContext('2d');
  const img = mctx.createImageData(m.width, m.height);
  for (let i = 0; i < conf.length; i++) img.data[i * 4 + 3] = conf[i] * 255;
  mctx.putImageData(img, 0, 0);
  if (res.close) res.close();
  it.src = src; it.rawMask = mask;
}

/** Build the full-size alpha mask with the chosen edge softness. */
function fullMask(it) {
  const { width: w, height: h } = it.src;
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(it.rawMask, 0, 0, w, h);
  // contrast the soft mask: edge slider 0 = soft hair edges, 100 = crisp cut-out
  const k = 1 + (+els.edge.value / 100) * 5;
  const d = g.getImageData(0, 0, w, h);
  for (let i = 3; i < d.data.length; i += 4) {
    let a = d.data[i] / 255;
    a = Math.min(1, Math.max(0, (a - 0.5) * k + 0.5));
    d.data[i] = a * 255;
  }
  g.putImageData(d, 0, 0);
  return c;
}

function composite(it) {
  const { width: w, height: h } = it.src;
  const person = document.createElement('canvas'); person.width = w; person.height = h;
  const p = person.getContext('2d');
  p.drawImage(it.src, 0, 0);
  p.globalCompositeOperation = 'destination-in';
  p.drawImage(fullMask(it), 0, 0);
  const mode = els.out.value;
  if (mode === 'transparent') return person;
  const out = document.createElement('canvas'); out.width = w; out.height = h;
  const o = out.getContext('2d');
  if (mode === 'blur') { o.filter = `blur(${Math.round(Math.max(w, h) / 90)}px)`; o.drawImage(it.src, 0, 0); o.filter = 'none'; }
  else { o.fillStyle = mode === 'white' ? '#ffffff' : els.color.value; o.fillRect(0, 0, w, h); }
  o.drawImage(person, 0, 0);
  return out;
}

async function finalize(it) {
  const c = composite(it);
  const transparent = els.out.value === 'transparent';
  it.result = await canvasToBlob(c, transparent ? 'image/png' : 'image/jpeg', 0.92);
  it.resultName = `${splitName(it.file.name)[0]}-${transparent ? 'no-bg.png' : 'new-bg.jpg'}`;
  const t = document.createElement('canvas'); const s = 96 / Math.max(c.width, c.height);
  t.width = Math.round(c.width * s); t.height = Math.round(c.height * s);
  t.getContext('2d').drawImage(c, 0, 0, t.width, t.height);
  it.thumb = t.toDataURL('image/png');
  if (it === selected || !selected) { selected = it; showPreview(c); }
}

function showPreview(c) {
  els.preview.width = c.width; els.preview.height = c.height;
  els.preview.getContext('2d').drawImage(c, 0, 0);
}

async function run() {
  els.run.disabled = true;
  try { setStatus(els.status, 'Loading the AI model (first time only)…'); await loadSeg(); }
  catch (e) { setStatus(els.status, 'Could not load the AI model. Check your connection and try again.', 'err'); els.run.disabled = false; return; }
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    setStatus(els.status, `Removing background ${i + 1} of ${items.length}…`);
    try { if (!it.src) await segment(it); await finalize(it); it.error = ''; }
    catch (e) { it.error = 'Could not process this image'; }
    render();
    await new Promise((r) => setTimeout(r, 0));
  }
  setStatus(els.status, 'Done. Everything was processed on your device.', 'ok');
  els.run.disabled = false;
}

els.list.addEventListener('click', (e) => {
  const li = e.target.closest('.t-item'); if (!li) return;
  const it = items.find((x) => x.id === li.dataset.id); if (!it) return;
  const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
  if (act === 'rm') { items = items.filter((x) => x !== it); if (selected === it) selected = null; render(); return; }
  if (act === 'dl' && it.result) { downloadBlob(it.result, it.resultName); return; }
  if (it.src) { selected = it; showPreview(composite(it)); render(); }
});

setupDropzone(els.drop, els.input, addFiles);
els.run.addEventListener('click', run);
[els.out, els.color, els.edge].forEach((e) => e.addEventListener('change', () => { if (items.some((i) => i.src)) run(); }));
els.out.addEventListener('change', () => { els.color.closest('.t-field').hidden = els.out.value !== 'color'; });
els.clear.addEventListener('click', () => { items = []; selected = null; render(); setStatus(els.status, ''); els.preview.width = els.preview.height = 1; });
els.zip.addEventListener('click', async () => {
  const files = items.filter((i) => i.result).map((i) => ({ name: i.resultName, blob: i.result }));
  if (files.length === 1) return downloadBlob(files[0].blob, files[0].name);
  try { await downloadZip(files, 'background-removed.zip'); } catch (e) { setStatus(els.status, e.message, 'err'); }
});
els.color.closest('.t-field').hidden = true;
render();
