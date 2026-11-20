/* WebcamClicks — OCR: image / scanned PDF / webcam → editable text (tesseract.js, on-device). */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadLib, loadPdfjs, copyText, decodeImage } from './common.js';

const LANGS = [
  ['eng', 'English'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'], ['por', 'Portuguese'], ['ita', 'Italian'], ['nld', 'Dutch'],
  ['hin', 'Hindi'], ['nep', 'Nepali'], ['ben', 'Bengali'], ['tam', 'Tamil'], ['tel', 'Telugu'], ['mar', 'Marathi'], ['urd', 'Urdu'],
  ['ara', 'Arabic'], ['fas', 'Persian'], ['tur', 'Turkish'], ['rus', 'Russian'], ['ukr', 'Ukrainian'], ['pol', 'Polish'], ['ces', 'Czech'],
  ['ron', 'Romanian'], ['ell', 'Greek'], ['heb', 'Hebrew'], ['chi_sim', 'Chinese (Simplified)'], ['chi_tra', 'Chinese (Traditional)'],
  ['jpn', 'Japanese'], ['kor', 'Korean'], ['vie', 'Vietnamese'], ['tha', 'Thai'], ['ind', 'Indonesian'], ['msa', 'Malay'], ['fil', 'Filipino'],
  ['swe', 'Swedish'], ['nor', 'Norwegian'], ['dan', 'Danish'], ['fin', 'Finnish'], ['hun', 'Hungarian']
];

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), lang: $('#t-lang'), lang2: $('#t-lang2'), text: $('#t-text'),
  copy: $('#t-copy'), txt: $('#t-txt'), pdf: $('#t-pdf'), preview: $('#t-preview'), cam: $('#t-cam'), camBox: $('#t-cambox'),
  camVideo: $('#t-camvideo'), snap: $('#t-snap'), conf: $('#t-conf'), bar: $('#t-bar'), fill: $('#t-fill'), clean: $('#t-cleanup')
};

els.lang.innerHTML = LANGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.lang2.innerHTML = '<option value="">None</option>' + LANGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const guess = (navigator.language || 'en').slice(0, 2);
const map = { es: 'spa', fr: 'fra', de: 'deu', pt: 'por', it: 'ita', nl: 'nld', hi: 'hin', ne: 'nep', bn: 'ben', ar: 'ara', ru: 'rus', zh: 'chi_sim', ja: 'jpn', ko: 'kor', tr: 'tur', pl: 'pol', uk: 'ukr', vi: 'vie', th: 'tha', id: 'ind' };
els.lang.value = map[guess] || 'eng';

let worker = null, workerLangs = '', lastPdf = [], lastName = 'text';

async function getWorker() {
  const langs = [els.lang.value, els.lang2.value].filter(Boolean).join('+');
  const T = await loadLib('tesseract');
  const logger = (m) => {
    if (m.status && /loading|initializ/i.test(m.status)) setStatus(els.status, `${m.status.replace(/^./, (c) => c.toUpperCase())}… ${Math.round((m.progress || 0) * 100)}% (first time per language only)`);
    if (m.status === 'recognizing text') { els.bar.hidden = false; els.fill.style.width = `${Math.round(m.progress * 100)}%`; }
  };
  if (!worker) { worker = await T.createWorker(langs, 1, { logger }); workerLangs = langs; }
  else if (workerLangs !== langs) { setStatus(els.status, 'Loading language…'); await worker.reinitialize(langs); workerLangs = langs; }
  return worker;
}

/** Light pre-processing that helps OCR on phone photos: greyscale + contrast stretch, upscale small images. */
function prepare(bmp) {
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
  const s = Math.min(3000 / Math.max(w0, h0), Math.max(1, 1600 / Math.max(w0, h0)));
  const c = document.createElement('canvas'); c.width = Math.round(w0 * s); c.height = Math.round(h0 * s);
  const g = c.getContext('2d', { willReadFrequently: true });
  g.imageSmoothingQuality = 'high'; g.drawImage(bmp, 0, 0, c.width, c.height);
  if (els.clean.checked) {
    const im = g.getImageData(0, 0, c.width, c.height), d = im.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { const l = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8; d[i] = l; hist[l]++; }
    let acc = 0, lo = 0, hi = 255; const n = d.length / 4;
    for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break; } }
    acc = 0; for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break; } }
    const span = Math.max(20, hi - lo);
    for (let i = 0; i < d.length; i += 4) { const v = Math.min(255, Math.max(0, ((d[i] - lo) / span) * 255)); d[i] = d[i + 1] = d[i + 2] = v; }
    g.putImageData(im, 0, 0);
  }
  return c;
}

async function recognizeCanvases(canvases, name) {
  els.text.value = ''; lastPdf = []; lastName = name;
  els.copy.disabled = els.txt.disabled = els.pdf.disabled = true;
  try {
    const w = await getWorker();
    const parts = []; let confSum = 0;
    for (let i = 0; i < canvases.length; i++) {
      setStatus(els.status, canvases.length > 1 ? `Reading page ${i + 1} of ${canvases.length}…` : 'Reading text…');
      const { data } = await w.recognize(canvases[i], {}, { text: true, pdf: true });
      parts.push(data.text.trim());
      if (data.pdf) lastPdf.push(new Uint8Array(data.pdf));
      confSum += data.confidence || 0;
      els.text.value = parts.join('\n\n— page break —\n\n');
    }
    const conf = Math.round(confSum / canvases.length);
    els.conf.textContent = `Confidence ${conf}%${conf < 70 ? ' · try “Clean up image”, a sharper photo or the right language' : ''}`;
    els.copy.disabled = els.txt.disabled = !els.text.value.trim(); els.pdf.disabled = !lastPdf.length;
    setStatus(els.status, els.text.value.trim() ? `Done: ${els.text.value.trim().split(/\s+/).length} words found. You can edit the text below.` : 'No text found. Is the image sharp and the right way up?', els.text.value.trim() ? 'ok' : 'err');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'OCR failed.', 'err'); }
  els.bar.hidden = true;
}

async function handleFile(f) {
  if (/pdf$/i.test(f.type) || /\.pdf$/i.test(f.name)) {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: new Uint8Array(await f.arrayBuffer()), isEvalSupported: false }).promise;
    const max = Math.min(doc.numPages, 30), canvases = [];
    for (let i = 1; i <= max; i++) {
      setStatus(els.status, `Rendering page ${i} of ${max}…`);
      const page = await doc.getPage(i), vp = page.getViewport({ scale: 2.5 });
      const c = document.createElement('canvas'); c.width = vp.width; c.height = vp.height;
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      canvases.push(prepare(c));
    }
    showPreview(canvases[0]);
    if (doc.numPages > max) setStatus(els.status, `Reading the first ${max} of ${doc.numPages} pages…`);
    return recognizeCanvases(canvases, splitName(f.name)[0]);
  }
  if (!f.type.startsWith('image/')) { setStatus(els.status, 'Please choose an image (JPG, PNG, WebP…) or a PDF.', 'err'); return; }
  const c = prepare(await decodeImage(f));
  showPreview(c);
  return recognizeCanvases([c], splitName(f.name)[0]);
}
function showPreview(c) { els.preview.hidden = false; els.preview.src = c.toDataURL('image/jpeg', 0.7); }

/* webcam: hold a page up to the camera */
let camStream = null;
els.cam.addEventListener('click', async () => {
  if (camStream) { camStream.getTracks().forEach((t) => t.stop()); camStream = null; els.camBox.hidden = true; els.cam.textContent = '📷 Use webcam'; return; }
  try { camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'environment' } }); }
  catch (_) { setStatus(els.status, 'Camera blocked or not available.', 'err'); return; }
  els.camVideo.srcObject = camStream; await els.camVideo.play(); els.camBox.hidden = false; els.cam.textContent = '✕ Close webcam';
});
els.snap.addEventListener('click', () => {
  const v = els.camVideo, c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight;
  c.getContext('2d').drawImage(v, 0, 0);
  const p = prepare(c); showPreview(p); recognizeCanvases([p], 'webcam-capture');
});

els.copy.addEventListener('click', async () => setStatus(els.status, (await copyText(els.text.value)) ? 'Text copied.' : 'Copy failed.', 'ok'));
els.txt.addEventListener('click', () => downloadBlob(new Blob([els.text.value], { type: 'text/plain;charset=utf-8' }), `${lastName}-ocr.txt`));
els.pdf.addEventListener('click', async () => {
  if (!lastPdf.length) return;
  if (lastPdf.length === 1) return downloadBlob(new Blob([lastPdf[0]], { type: 'application/pdf' }), `${lastName}-searchable.pdf`);
  const R = await loadLib('pdflib'); const out = await R.PDFDocument.create();
  for (const b of lastPdf) { const d = await R.PDFDocument.load(b); (await out.copyPages(d, d.getPageIndices())).forEach((p) => out.addPage(p)); }
  downloadBlob(new Blob([await out.save()], { type: 'application/pdf' }), `${lastName}-searchable.pdf`);
});
setupDropzone(els.drop, els.input, (files) => handleFile(files[0]));
