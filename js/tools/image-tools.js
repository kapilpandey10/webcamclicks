/* WebcamClicks — bulk image converter / compressor / resizer (one engine, three pages).
   Decodes with createImageBitmap (EXIF orientation honoured), re-encodes with canvas.
   Metadata (GPS location, camera serials) is stripped as a side effect — a privacy win. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, downloadZip, setStatus, canvasEncoders, canvasToBlob, decodeImage } from './common.js';

const MODE = document.querySelector('main').dataset.mode || 'convert';   // convert | compress | resize
const enc = canvasEncoders();
const EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'image/avif': 'avif' };

const els = {
  drop: $('#t-drop'), input: $('#t-input'), list: $('#t-list'), status: $('#t-status'),
  format: $('#t-format'), quality: $('#t-quality'), qualityVal: $('#t-quality-val'),
  resizeMode: $('#t-resize-mode'), resizeVal: $('#t-resize-val'), bg: $('#t-bg'),
  run: $('#t-run'), zip: $('#t-zip'), clear: $('#t-clear'), summary: $('#t-summary')
};

let items = [];   // { id, file, out?: Blob, outName?, w, h, ow, oh, thumb }

/* ---------- options ---------- */
function initOptions() {
  const opts = [['smart', 'Smart (recommended)'], ['same', 'Same as original'], ['image/jpeg', 'JPG'], ['image/png', 'PNG']];
  if (enc['image/webp']) opts.push(['image/webp', 'WebP']);
  if (enc['image/avif']) opts.push(['image/avif', 'AVIF']);
  els.format.innerHTML = opts.map(([v, l]) => `<option value="${v}">${l}</option>`).join('');
  els.format.value = MODE === 'convert' ? (enc['image/webp'] ? 'image/webp' : 'image/jpeg') : MODE === 'compress' ? 'smart' : 'same';
  els.quality.value = MODE === 'compress' ? 72 : 88;
  els.resizeMode.value = MODE === 'resize' ? 'width' : (MODE === 'compress' ? 'longest' : 'none');
  els.resizeVal.value = MODE === 'resize' ? 1280 : 2560;
  syncUi();
}

function syncUi() {
  els.qualityVal.textContent = `${els.quality.value}%`;
  const m = els.resizeMode.value;
  els.resizeVal.disabled = m === 'none';
  els.resizeVal.placeholder = m === 'percent' ? '50' : '1280';
  const unit = document.getElementById('t-resize-unit');
  if (unit) unit.textContent = m === 'percent' ? '%' : 'px';
  els.run.disabled = !items.length;
  els.zip.disabled = !items.some((i) => i.out);
}

/* ---------- list ---------- */
function addFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png|gif|bmp)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Those files are not images.', 'err'); return; }
  for (const file of imgs) items.push({ id: Math.random().toString(36).slice(2), file });
  setStatus(els.status, `${items.length} image${items.length > 1 ? 's' : ''} ready.`);
  render();
}

function render() {
  els.list.innerHTML = items.map((it) => {
    const thumb = it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : `<span class="thumb">${escapeHtml(splitName(it.file.name)[1].toUpperCase() || 'IMG')}</span>`;
    let meta = `${formatBytes(it.file.size)}${it.w ? ` · ${it.w}×${it.h}` : ''}`;
    if (it.error) meta += ` · <span class="grow">${escapeHtml(it.error)}</span>`;
    if (it.out) {
      const pct = Math.round((1 - it.out.size / it.file.size) * 100);
      meta += ` → <b>${formatBytes(it.out.size)}</b> · ${it.ow}×${it.oh} · ${pct >= 0 ? `<span class="save">−${pct}%</span>` : `<span class="grow">+${-pct}%</span>`}`;
    }
    return `<li class="t-item" data-id="${it.id}">${thumb}
      <div><div class="name">${escapeHtml(it.outName || it.file.name)}</div><div class="meta">${meta}</div></div>
      <div class="ctrl">${it.out ? `<button class="t-btn sm" data-act="dl" type="button">Download</button>` : ''}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`;
  }).join('');
  const done = items.filter((i) => i.out);
  if (done.length) {
    const before = done.reduce((a, i) => a + i.file.size, 0), after = done.reduce((a, i) => a + i.out.size, 0);
    els.summary.textContent = `${done.length} file${done.length > 1 ? 's' : ''}: ${formatBytes(before)} → ${formatBytes(after)} (${before >= after ? '−' : '+'}${Math.abs(Math.round((1 - after / before) * 100))}%)`;
  } else {
    els.summary.textContent = '';
  }
  syncUi();
}

els.list.addEventListener('click', (e) => {
  const li = e.target.closest('.t-item'); if (!li) return;
  const it = items.find((x) => x.id === li.dataset.id); if (!it) return;
  const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
  if (act === 'rm') { items = items.filter((x) => x !== it); render(); }
  if (act === 'dl' && it.out) downloadBlob(it.out, it.outName);
});

/* ---------- processing ---------- */
function targetSize(w, h) {
  const m = els.resizeMode.value, v = Math.max(1, parseFloat(els.resizeVal.value) || 0);
  if (m === 'none' || !v) return [w, h];
  let s = 1;
  if (m === 'width') s = v / w;
  else if (m === 'height') s = v / h;
  else if (m === 'longest') s = Math.min(1, v / Math.max(w, h));   // never upscale for "max size"
  else if (m === 'percent') s = v / 100;
  return [Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))];
}

function outType(file) {
  const f = els.format.value;
  // Smart: keep lossy formats as they are; PNG (lossless, can't be compressed by the browser) → WebP, which keeps transparency
  if (f === 'smart') {
    if (file.type === 'image/png' || file.type === 'image/gif' || file.type === 'image/bmp') return enc['image/webp'] ? 'image/webp' : 'image/jpeg';
    return enc[file.type] ? file.type : 'image/jpeg';
  }
  if (f !== 'same') return f;
  if (enc[file.type]) return file.type;
  return 'image/jpeg';   // GIF/BMP/HEIC etc. → JPG
}

async function processOne(it) {
  const bmp = await decodeImage(it.file);
  const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight;
  it.w = w; it.h = h;
  const [ow, oh] = targetSize(w, h);
  const type = outType(it.file);
  let canvas = document.createElement('canvas');
  // step down in halves for big reductions: sharper than one big jump
  let src = bmp, sw = w, sh = h;
  while (sw / 2 >= ow && sh / 2 >= oh) {
    const c = document.createElement('canvas');
    c.width = Math.round(sw / 2); c.height = Math.round(sh / 2);
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high';
    g.drawImage(src, 0, 0, c.width, c.height);
    src = c; sw = c.width; sh = c.height;
  }
  canvas.width = ow; canvas.height = oh;
  const ctx = canvas.getContext('2d');
  if (type === 'image/jpeg') { ctx.fillStyle = els.bg ? els.bg.value : '#ffffff'; ctx.fillRect(0, 0, ow, oh); }
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src, 0, 0, ow, oh);
  const q = type === 'image/png' ? undefined : els.quality.value / 100;
  let blob = await canvasToBlob(canvas, type, q);
  // never make a file bigger for nothing: same format, same size, larger result → keep the original
  if (blob.size >= it.file.size && ow === w && oh === h && type === it.file.type) blob = it.file;
  it.out = blob; it.ow = ow; it.oh = oh;
  const [base] = splitName(it.file.name);
  it.outName = `${base}.${EXT[blob.type] || EXT[type] || 'jpg'}`;
  // tiny thumbnail
  const t = document.createElement('canvas'); const ts = 96 / Math.max(ow, oh);
  t.width = Math.max(1, Math.round(ow * ts)); t.height = Math.max(1, Math.round(oh * ts));
  t.getContext('2d').drawImage(canvas, 0, 0, t.width, t.height);
  it.thumb = t.toDataURL('image/jpeg', 0.7);
  if (bmp.close) bmp.close();
}

async function runAll() {
  els.run.disabled = true;
  let ok = 0;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    setStatus(els.status, `Processing ${i + 1} of ${items.length}…`);
    try { it.error = ''; await processOne(it); ok++; }
    catch (e) { it.error = /heic|heif/i.test(it.file.name) ? 'HEIC is only supported in Safari. Convert on iPhone via Settings → Camera → Most Compatible.' : 'Could not read this image'; }
    render();
    await new Promise((r) => setTimeout(r, 0));   // keep the page responsive
  }
  setStatus(els.status, ok ? `Done: ${ok} image${ok > 1 ? 's' : ''} processed on your device.` : 'No images could be processed.', ok ? 'ok' : 'err');
  syncUi();
}

/* ---------- wiring ---------- */
initOptions();
setupDropzone(els.drop, els.input, addFiles);
[els.quality, els.resizeMode, els.resizeVal, els.format].forEach((e) => e.addEventListener('input', syncUi));
els.run.addEventListener('click', runAll);
els.clear.addEventListener('click', () => { items = []; render(); setStatus(els.status, ''); });
els.zip.addEventListener('click', async () => {
  const files = items.filter((i) => i.out).map((i) => ({ name: i.outName, blob: i.out }));
  if (!files.length) return;
  if (files.length === 1) { downloadBlob(files[0].blob, files[0].name); return; }
  setStatus(els.status, 'Creating ZIP…');
  try { await downloadZip(files, `webcamclicks-images-${MODE}.zip`); setStatus(els.status, 'ZIP downloaded.', 'ok'); }
  catch (e) { setStatus(els.status, e.message, 'err'); }
});
render();
