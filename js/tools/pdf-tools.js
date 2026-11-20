/* WebcamClicks — PDF tools: images → PDF, merge PDFs, split/extract pages.
   Uses pdf-lib in the browser; files never leave the device. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, downloadZip, setStatus, loadLib, decodeImage, canvasToBlob } from './common.js';

const MODE = document.querySelector('main').dataset.mode;   // jpg2pdf | merge | split
const els = {
  drop: $('#t-drop'), input: $('#t-input'), list: $('#t-list'), status: $('#t-status'),
  run: $('#t-run'), clear: $('#t-clear'),
  pageSize: $('#t-pagesize'), orient: $('#t-orient'), margin: $('#t-margin'),
  splitMode: $('#t-splitmode'), ranges: $('#t-ranges'), every: $('#t-every'), pages: $('#t-pages')
};
let items = [];   // { id, file, pages? }

const PAGE = { a4: [595.28, 841.89], letter: [612, 792] };

function addFiles(files) {
  const okType = MODE === 'jpg2pdf' ? (f) => f.type.startsWith('image/') : (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name);
  const good = files.filter(okType);
  if (!good.length) { setStatus(els.status, MODE === 'jpg2pdf' ? 'Please add image files.' : 'Please add PDF files.', 'err'); return; }
  if (MODE === 'split') items = [];
  for (const f of (MODE === 'split' ? good.slice(0, 1) : good)) items.push({ id: Math.random().toString(36).slice(2), file: f });
  setStatus(els.status, '');
  render();
  if (MODE !== 'jpg2pdf') countPages();
}

async function countPages() {
  const { PDFDocument } = await loadLib('pdflib');
  for (const it of items) {
    if (it.pages != null) continue;
    try {
      const doc = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true });
      it.pages = doc.getPageCount();
    } catch (e) { it.pages = 0; it.error = 'Not a readable PDF'; }
  }
  render();
}

function render() {
  els.list.innerHTML = items.map((it, i) => {
    const [, ext] = splitName(it.file.name);
    const meta = `${formatBytes(it.file.size)}${it.pages ? ` · ${it.pages} page${it.pages > 1 ? 's' : ''}` : ''}${it.error ? ` · <span class="grow">${it.error}</span>` : ''}`;
    const thumb = it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : `<span class="thumb">${escapeHtml((ext || 'PDF').toUpperCase())}</span>`;
    const move = MODE === 'split' ? '' : `<button class="t-icon-btn" data-act="up" type="button" aria-label="Move up" ${i === 0 ? 'disabled' : ''}>↑</button><button class="t-icon-btn" data-act="down" type="button" aria-label="Move down" ${i === items.length - 1 ? 'disabled' : ''}>↓</button>`;
    return `<li class="t-item" data-id="${it.id}">${thumb}<div><div class="name">${i + 1}. ${escapeHtml(it.file.name)}</div><div class="meta">${meta}</div></div>
      <div class="ctrl">${move}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`;
  }).join('');
  if (MODE === 'jpg2pdf') items.forEach(makeThumb);
  if (els.pages) els.pages.textContent = items[0] && items[0].pages ? `This PDF has ${items[0].pages} pages.` : '';
  els.run.disabled = MODE === 'merge' ? items.length < 2 : !items.length;
}

async function makeThumb(it) {
  if (it.thumb || it._t) return;
  it._t = true;
  try {
    const bmp = await decodeImage(it.file);
    const c = document.createElement('canvas'); const s = 96 / Math.max(bmp.width, bmp.height);
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
    it.thumb = c.toDataURL('image/jpeg', 0.7);
    render();
  } catch (_) { /* ignore */ }
}

els.list.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const id = b.closest('.t-item').dataset.id;
  const i = items.findIndex((x) => x.id === id);
  if (b.dataset.act === 'rm') items.splice(i, 1);
  if (b.dataset.act === 'up' && i > 0) [items[i - 1], items[i]] = [items[i], items[i - 1]];
  if (b.dataset.act === 'down' && i < items.length - 1) [items[i + 1], items[i]] = [items[i], items[i + 1]];
  render();
});

/* ---------- images → PDF ---------- */
async function imagesToPdf() {
  const { PDFDocument } = await loadLib('pdflib');
  const doc = await PDFDocument.create();
  doc.setProducer('WebcamClicks'); doc.setCreator('webcamclicks.com/jpg-to-pdf');
  const margin = { none: 0, small: 18, large: 42 }[els.margin.value] ?? 18;
  for (let i = 0; i < items.length; i++) {
    setStatus(els.status, `Adding image ${i + 1} of ${items.length}…`);
    const bmp = await decodeImage(items[i].file);
    // re-encode through canvas so phone-photo rotation (EXIF) is baked in, cap at 3000 px
    const s = Math.min(1, 3000 / Math.max(bmp.width, bmp.height));
    const c = document.createElement('canvas');
    c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
    const g = c.getContext('2d');
    const isPng = items[i].file.type === 'image/png';
    if (!isPng) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
    g.drawImage(bmp, 0, 0, c.width, c.height);
    const bytes = new Uint8Array(await (await canvasToBlob(c, isPng ? 'image/png' : 'image/jpeg', 0.92)).arrayBuffer());
    const img = isPng ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    let pw, ph;
    if (els.pageSize.value === 'fit') { pw = img.width * 0.75 + margin * 2; ph = img.height * 0.75 + margin * 2; }
    else {
      [pw, ph] = PAGE[els.pageSize.value];
      const o = els.orient.value;
      if (o === 'landscape' || (o === 'auto' && img.width > img.height)) [pw, ph] = [ph, pw];
    }
    const page = doc.addPage([pw, ph]);
    const scale = Math.min((pw - margin * 2) / img.width, (ph - margin * 2) / img.height);
    const w = img.width * scale, h = img.height * scale;
    page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    await new Promise((r) => setTimeout(r, 0));
  }
  const out = await doc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), items.length === 1 ? `${splitName(items[0].file.name)[0]}.pdf` : 'images.pdf');
  setStatus(els.status, `PDF created with ${items.length} page${items.length > 1 ? 's' : ''} (${formatBytes(out.length)}).`, 'ok');
}

/* ---------- merge ---------- */
async function mergePdfs() {
  const { PDFDocument } = await loadLib('pdflib');
  const doc = await PDFDocument.create();
  let pages = 0;
  for (let i = 0; i < items.length; i++) {
    setStatus(els.status, `Merging ${i + 1} of ${items.length}…`);
    let src;
    try { src = await PDFDocument.load(await items[i].file.arrayBuffer(), { ignoreEncryption: true }); }
    catch (e) { throw new Error(`“${items[i].file.name}” could not be read (it may be password-protected).`); }
    const copied = await doc.copyPages(src, src.getPageIndices());
    copied.forEach((p) => doc.addPage(p));
    pages += copied.length;
  }
  const out = await doc.save();
  downloadBlob(new Blob([out], { type: 'application/pdf' }), 'merged.pdf');
  setStatus(els.status, `Merged ${items.length} PDFs into one file with ${pages} pages (${formatBytes(out.length)}).`, 'ok');
}

/* ---------- split ---------- */
function parseRanges(text, max) {
  const out = [];
  for (const part of text.split(',').map((s) => s.trim()).filter(Boolean)) {
    const m = part.match(/^(\d+)\s*(?:-\s*(\d+|end))?$/i);
    if (!m) throw new Error(`“${part}” is not a page or range like 2-5.`);
    const a = +m[1], b = m[2] ? (m[2].toLowerCase() === 'end' ? max : +m[2]) : a;
    if (a < 1 || b > max || a > b) throw new Error(`Range ${part} is outside 1–${max}.`);
    out.push([a, b]);
  }
  if (!out.length) throw new Error('Enter the pages to extract, e.g. 1-3, 5.');
  return out;
}

async function splitPdf() {
  const { PDFDocument } = await loadLib('pdflib');
  const it = items[0];
  const src = await PDFDocument.load(await it.file.arrayBuffer(), { ignoreEncryption: true });
  const n = src.getPageCount();
  const base = splitName(it.file.name)[0];
  const make = async (indices) => {
    const d = await PDFDocument.create();
    (await d.copyPages(src, indices)).forEach((p) => d.addPage(p));
    return new Blob([await d.save()], { type: 'application/pdf' });
  };
  const mode = els.splitMode.value;
  if (mode === 'extract') {
    const idx = [];
    parseRanges(els.ranges.value, n).forEach(([a, b]) => { for (let p = a; p <= b; p++) idx.push(p - 1); });
    downloadBlob(await make(idx), `${base}-pages.pdf`);
    setStatus(els.status, `Extracted ${idx.length} page${idx.length > 1 ? 's' : ''} into a new PDF.`, 'ok');
    return;
  }
  const groups = [];
  if (mode === 'ranges') parseRanges(els.ranges.value, n).forEach(([a, b]) => groups.push([a, b]));
  else {
    const k = mode === 'each' ? 1 : Math.max(1, parseInt(els.every.value, 10) || 1);
    for (let a = 1; a <= n; a += k) groups.push([a, Math.min(n, a + k - 1)]);
  }
  const files = [];
  for (let g = 0; g < groups.length; g++) {
    const [a, b] = groups[g];
    setStatus(els.status, `Creating file ${g + 1} of ${groups.length}…`);
    const idx = []; for (let p = a; p <= b; p++) idx.push(p - 1);
    files.push({ name: `${base}-${a === b ? `p${a}` : `p${a}-${b}`}.pdf`, blob: await make(idx) });
  }
  await downloadZip(files, `${base}-split.zip`);
  setStatus(els.status, `Split into ${files.length} PDFs (downloaded as a ZIP).`, 'ok');
}

/* ---------- wiring ---------- */
setupDropzone(els.drop, els.input, addFiles);
els.clear.addEventListener('click', () => { items = []; render(); setStatus(els.status, ''); });
els.run.addEventListener('click', async () => {
  els.run.disabled = true;
  try {
    if (MODE === 'jpg2pdf') await imagesToPdf();
    else if (MODE === 'merge') await mergePdfs();
    else await splitPdf();
  } catch (e) { setStatus(els.status, e.message || 'Something went wrong.', 'err'); }
  els.run.disabled = false;
});
if (els.splitMode) {
  const sync = () => {
    const m = els.splitMode.value;
    document.getElementById('t-ranges-wrap').hidden = !(m === 'extract' || m === 'ranges');
    document.getElementById('t-every-wrap').hidden = m !== 'every';
  };
  els.splitMode.addEventListener('change', sync); sync();
}
if (els.pageSize) els.pageSize.addEventListener('change', () => { els.orient.disabled = els.pageSize.value === 'fit'; });
render();
