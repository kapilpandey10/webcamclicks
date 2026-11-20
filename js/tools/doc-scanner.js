/* WebcamClicks — Document scanner: camera or photos → auto-detected page → straightened, cleaned scans → PDF.
   All processing happens on the device. */

import { $, setupDropzone, setStatus, splitName, downloadBlob, downloadZip, loadLib, decodeImage, canvasToBlob } from './common.js';
import { detectPage, orderQuad, outputSize, warp, cleanUp } from './doc-scan-core.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), camBtn: $('#ds-cam'), camBox: $('#ds-cambox'), video: $('#ds-video'), camOverlay: $('#ds-camoverlay'),
  capture: $('#ds-capture'), camDone: $('#ds-camdone'), work: $('#ds-work'), stage: $('#ds-stage'), src: $('#ds-src'), svg: $('#ds-svg'),
  auto: $('#ds-auto'), fullBtn: $('#ds-full'), preview: $('#ds-preview'), filter: $('#ds-filter'), rotate: $('#ds-rotate'), del: $('#ds-delete'),
  pages: $('#ds-pages'), size: $('#ds-size'), pdf: $('#ds-pdf'), zip: $('#ds-zip'), autoCap: $('#ds-autocap')
};

let pages = [];   // { id, src (canvas), quad, filter, rot, out (canvas), thumb }
let cur = -1, nid = 0;

/* ---------------------------------------------------------------- add pages */
async function addSource(bmpOrCanvas, name) {
  // keep sources at a sane size (12 MP max) so straightening stays fast on phones
  const w = bmpOrCanvas.width, h = bmpOrCanvas.height, s = Math.min(1, Math.sqrt(12e6 / (w * h)));
  const c = document.createElement('canvas'); c.width = Math.round(w * s); c.height = Math.round(h * s);
  c.getContext('2d').drawImage(bmpOrCanvas, 0, 0, c.width, c.height);
  const { quad, confidence } = detectPage(c);
  const p = { id: ++nid, name, src: c, quad, confidence, filter: els.filter.value || 'color', rot: 0 };
  pages.push(p);
  await render(p);
  select(pages.length - 1);
  return p;
}
async function addFiles(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Please choose photos of documents.', 'err'); return; }
  for (let i = 0; i < imgs.length; i++) {
    setStatus(els.status, `Scanning ${i + 1} of ${imgs.length}…`);
    try { await addSource(await decodeImage(imgs[i]), splitName(imgs[i].name)[0]); } catch (e) { console.warn(e); }
  }
  setStatus(els.status, `${pages.length} page${pages.length > 1 ? 's' : ''}. Drag the corners if the edges aren't right, then download.`, 'ok');
}

/* ---------------------------------------------------------------- processing */
async function render(p) {
  await new Promise((r) => setTimeout(r, 0));   // let the UI paint first
  const [W, H] = outputSize(p.quad);
  let out = warp(p.src, p.quad, W, H);
  if (p.rot) {
    const r = document.createElement('canvas'), q = p.rot % 180;
    r.width = q ? out.height : out.width; r.height = q ? out.width : out.height;
    const g = r.getContext('2d'); g.translate(r.width / 2, r.height / 2); g.rotate((p.rot * Math.PI) / 180); g.drawImage(out, -out.width / 2, -out.height / 2);
    out = r;
  }
  p.out = cleanUp(out, p.filter);
  const t = document.createElement('canvas'), ts = 160 / Math.max(p.out.width, p.out.height);
  t.width = Math.round(p.out.width * ts); t.height = Math.round(p.out.height * ts);
  t.getContext('2d').drawImage(p.out, 0, 0, t.width, t.height);
  p.thumb = t.toDataURL('image/jpeg', 0.8);
  renderPages();
}

/* ---------------------------------------------------------------- editor */
function select(i) {
  cur = i; const p = pages[i];
  els.work.hidden = !p;
  if (!p) { renderPages(); return; }
  els.src.width = p.src.width; els.src.height = p.src.height;
  els.src.getContext('2d').drawImage(p.src, 0, 0);
  els.svg.setAttribute('viewBox', `0 0 ${p.src.width} ${p.src.height}`);
  els.filter.value = p.filter;
  drawQuad(); showPreview(); renderPages();
}
function drawQuad() {
  const p = pages[cur]; if (!p) return;
  const r = Math.max(p.src.width, p.src.height) / 45;
  els.svg.innerHTML = `<path d="M0 0H${p.src.width}V${p.src.height}H0Z M${p.quad.map((q) => q.join(' ')).join(' L')}Z" fill="rgba(14,14,18,.45)" fill-rule="evenodd"/>
    <polygon points="${p.quad.map((q) => q.join(',')).join(' ')}" fill="rgba(255,77,46,.08)" stroke="#ff4d2e" stroke-width="${r / 4}" stroke-linejoin="round"/>
    ${p.quad.map((q, i) => `<circle cx="${q[0]}" cy="${q[1]}" r="${r}" data-h="${i}" fill="#fff" stroke="#ff4d2e" stroke-width="${r / 4}"/>`).join('')}`;
}
function showPreview() {
  const p = pages[cur]; if (!p || !p.out) return;
  els.preview.width = p.out.width; els.preview.height = p.out.height;
  els.preview.getContext('2d').drawImage(p.out, 0, 0);
}
let dragH = -1;
const toImg = (e) => { const r = els.svg.getBoundingClientRect(), p = pages[cur]; return [Math.max(0, Math.min(p.src.width, ((e.clientX - r.left) / r.width) * p.src.width)), Math.max(0, Math.min(p.src.height, ((e.clientY - r.top) / r.height) * p.src.height))]; };
els.svg.addEventListener('pointerdown', (e) => {
  const p = pages[cur]; if (!p) return;
  const h = e.target.closest('[data-h]');
  if (h) dragH = +h.dataset.h;
  else {   // grab the nearest corner
    const pt = toImg(e); let best = Infinity;
    p.quad.forEach((q, i) => { const d = Math.hypot(q[0] - pt[0], q[1] - pt[1]); if (d < best) { best = d; dragH = i; } });
    if (best > Math.max(p.src.width, p.src.height) / 6) { dragH = -1; return; }
  }
  els.svg.setPointerCapture(e.pointerId); e.preventDefault();
});
els.svg.addEventListener('pointermove', (e) => { if (dragH < 0) return; pages[cur].quad[dragH] = toImg(e); drawQuad(); });
const endDrag = async () => { if (dragH < 0) return; dragH = -1; const p = pages[cur]; p.quad = orderQuad(p.quad); drawQuad(); await render(p); showPreview(); };
els.svg.addEventListener('pointerup', endDrag); els.svg.addEventListener('pointercancel', endDrag);

els.auto.addEventListener('click', async () => { const p = pages[cur]; if (!p) return; p.quad = detectPage(p.src).quad; drawQuad(); await render(p); showPreview(); });
els.fullBtn.addEventListener('click', async () => { const p = pages[cur]; if (!p) return; const w = p.src.width, h = p.src.height; p.quad = [[0, 0], [w, 0], [w, h], [0, h]]; drawQuad(); await render(p); showPreview(); });
els.filter.addEventListener('change', async () => { const p = pages[cur]; if (!p) return; p.filter = els.filter.value; setStatus(els.status, 'Applying…'); await render(p); showPreview(); setStatus(els.status, ''); });
els.rotate.addEventListener('click', async () => { const p = pages[cur]; if (!p) return; p.rot = (p.rot + 90) % 360; await render(p); showPreview(); });
els.del.addEventListener('click', () => { if (cur < 0) return; pages.splice(cur, 1); select(Math.min(cur, pages.length - 1)); });

/* ---------------------------------------------------------------- page strip */
function renderPages() {
  els.pages.innerHTML = pages.map((p, i) => `<li class="ds-thumb${i === cur ? ' sel' : ''}" data-i="${i}"><img src="${p.thumb || ''}" alt="Page ${i + 1}"><span>${i + 1}</span>
    <div class="ds-move"><button type="button" data-mv="-1" aria-label="Move earlier" ${i ? '' : 'disabled'}>‹</button><button type="button" data-mv="1" aria-label="Move later" ${i < pages.length - 1 ? '' : 'disabled'}>›</button></div></li>`).join('');
  els.pdf.disabled = els.zip.disabled = !pages.length;
}
els.pages.addEventListener('click', (e) => {
  const li = e.target.closest('.ds-thumb'); if (!li) return;
  const i = +li.dataset.i, mv = e.target.closest('[data-mv]');
  if (mv) { const j = i + +mv.dataset.mv; [pages[i], pages[j]] = [pages[j], pages[i]]; select(j); return; }
  select(i);
});

/* ---------------------------------------------------------------- camera */
let stream = null, camTimer = 0, stable = 0, lastQuad = null;
const snap = document.createElement('canvas');
async function openCamera() {
  try { stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 3840 }, height: { ideal: 2160 } }, audio: false }); }
  catch (e) { setStatus(els.status, e.name === 'NotAllowedError' ? 'Camera permission was blocked.' : 'No camera found. Upload photos instead.', 'err'); return; }
  els.video.srcObject = stream; await els.video.play().catch(() => {});
  els.camBox.hidden = false; els.camBtn.hidden = true;
  setStatus(els.status, 'Hold the page flat and fill the frame. Press Capture (or keep still with auto-capture on).');
  els.camBox.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  camTimer = setInterval(liveDetect, 350);
}
function closeCamera() { clearInterval(camTimer); if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; els.camBox.hidden = true; els.camBtn.hidden = false; }
function liveDetect() {
  const v = els.video; if (!v.videoWidth) return;
  const s = 480 / Math.max(v.videoWidth, v.videoHeight);
  snap.width = Math.round(v.videoWidth * s); snap.height = Math.round(v.videoHeight * s);
  snap.getContext('2d').drawImage(v, 0, 0, snap.width, snap.height);
  const { quad, confidence } = detectPage(snap);
  const c = els.camOverlay; c.width = snap.width; c.height = snap.height;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (confidence < 0.35) { stable = 0; lastQuad = null; return; }
  g.lineWidth = 4; g.strokeStyle = '#3dff6e'; g.fillStyle = 'rgba(61,255,110,.16)';
  g.beginPath(); quad.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath(); g.fill(); g.stroke();
  // auto-capture when the page stays put for ~1 s
  const moved = lastQuad ? Math.max(...quad.map((q, i) => Math.hypot(q[0] - lastQuad[i][0], q[1] - lastQuad[i][1]))) : 99;
  stable = moved < snap.width * 0.015 ? stable + 1 : 0; lastQuad = quad;
  if (els.autoCap.checked && stable >= 3) { stable = -6; capture(); }
}
async function capture() {
  const v = els.video; if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  els.camBox.classList.add('flash'); setTimeout(() => els.camBox.classList.remove('flash'), 180);
  if (navigator.vibrate) navigator.vibrate(40);
  await addSource(c, `scan-${pages.length + 1}`);
  setStatus(els.status, `Page ${pages.length} captured. Capture the next page, or press Done.`, 'ok');
}
els.camBtn.addEventListener('click', openCamera);
els.capture.addEventListener('click', capture);
els.camDone.addEventListener('click', closeCamera);
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) closeCamera(); });

/* ---------------------------------------------------------------- export */
const SIZES = { a4: [595.28, 841.89], letter: [612, 792] };
els.pdf.addEventListener('click', async () => {
  if (!pages.length) return;
  els.pdf.disabled = true; setStatus(els.status, 'Building your PDF…');
  try {
    const R = await loadLib('pdflib');
    const doc = await R.PDFDocument.create();
    doc.setTitle('Scanned document'); doc.setCreator('WebcamClicks Document Scanner'); doc.setProducer('WebcamClicks');
    for (const p of pages) {
      const bw = p.filter === 'bw';
      const blob = await canvasToBlob(p.out, bw ? 'image/png' : 'image/jpeg', 0.85);
      const bytes = new Uint8Array(await blob.arrayBuffer());
      const img = bw ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      let [pw, ph] = SIZES[els.size.value] || [595.28, 595.28 * (p.out.height / p.out.width)];
      if (SIZES[els.size.value] && p.out.width > p.out.height) [pw, ph] = [ph, pw];   // landscape scans get a landscape page
      const page = doc.addPage([pw, ph]);
      const k = Math.min(pw / p.out.width, ph / p.out.height), w = p.out.width * k, h = p.out.height * k;
      page.drawImage(img, { x: (pw - w) / 2, y: (ph - h) / 2, width: w, height: h });
    }
    const out = await doc.save();
    downloadBlob(new Blob([out], { type: 'application/pdf' }), `scan-${new Date().toISOString().slice(0, 10)}.pdf`);
    setStatus(els.status, `PDF with ${pages.length} page${pages.length > 1 ? 's' : ''} downloaded. Want it searchable? Open it in Image to text (OCR).`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Could not build the PDF: ${e.message}`, 'err'); }
  els.pdf.disabled = false;
});
els.zip.addEventListener('click', async () => {
  const files = [];
  for (let i = 0; i < pages.length; i++) files.push({ name: `scan-page-${i + 1}.jpg`, blob: await canvasToBlob(pages[i].out, 'image/jpeg', 0.9) });
  if (files.length === 1) downloadBlob(files[0].blob, files[0].name); else await downloadZip(files, 'scanned-pages.zip');
});

setupDropzone(els.drop, els.input, addFiles);
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) els.camBtn.hidden = true;
window.__dsTest = { get pages() { return pages; }, detectPage };
