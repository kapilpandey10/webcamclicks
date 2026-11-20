/* WebcamClicks Tools — shared helpers.
   Every tool runs locally: files are read with the File API and never uploaded. */

export const LIBS = {
  jszip: { url: 'https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js', global: 'JSZip' },
  pdflib: { url: 'https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js', global: 'PDFLib' },
  qrcode: { url: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', global: 'qrcode' },
  exifr: { url: 'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/full.umd.js', global: 'exifr' },
  tesseract: { url: 'https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js', global: 'Tesseract' },
  mp3: { url: 'https://cdn.jsdelivr.net/npm/@mediabunny/mp3-encoder@1.62.1/dist/bundles/mediabunny-mp3-encoder.min.js', global: 'MediabunnyMp3Encoder' }
};

/* ES-module libraries (pinned, loaded only when a tool needs them) */
export const ESM = {
  mediabunny: 'https://cdn.jsdelivr.net/npm/mediabunny@1.62.1/dist/bundles/mediabunny.min.mjs',
  pdfjs: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.min.mjs',
  pdfjsWorker: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@6.5.438/build/pdf.worker.min.mjs',
  pdflibCrypt: 'https://cdn.jsdelivr.net/npm/@cantoo/pdf-lib@2.11.1/dist/pdf-lib.esm.min.js',   // pdf-lib fork with encryption
  transformers: 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js',
  gifenc: 'https://cdn.jsdelivr.net/npm/gifenc@1.0.3/dist/gifenc.esm.js'
};
const esmCache = {};
export function loadEsm(key) {
  if (!esmCache[key]) esmCache[key] = import(/* webpackIgnore: true */ ESM[key]).catch((e) => { delete esmCache[key]; throw new Error(`Could not load a required component (${key}). Check your connection.`); });
  return esmCache[key];
}

/** pdf.js, configured with its worker. */
export async function loadPdfjs() {
  const pdfjs = await loadEsm('pdfjs');
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = ESM.pdfjsWorker;
  return pdfjs;
}

/** mediabunny + (optionally) its MP3 encoder extension. */
export async function loadMediabunny({ mp3 = false } = {}) {
  const MB = await loadEsm('mediabunny');
  if (mp3 && !window.__mp3Registered) {
    window.Mediabunny = MB;   // the encoder bundle looks for this global
    const ext = await loadLib('mp3');
    ext.registerMp3Encoder();
    window.__mp3Registered = true;
  }
  return MB;
}

/** Format seconds as 1:02:03 / 2:03. */
export function fmtTime(s) {
  s = Math.max(0, s);
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = Math.floor(s % 60);
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}

const loading = {};
/** Load a UMD library once and resolve with its global. */
export function loadLib(key) {
  const lib = LIBS[key];
  if (window[lib.global]) return Promise.resolve(window[lib.global]);
  if (!loading[key]) {
    loading[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = lib.url;
      s.async = true;
      s.crossOrigin = 'anonymous';
      s.onload = () => (window[lib.global] ? resolve(window[lib.global]) : reject(new Error(`${key} missing`)));
      s.onerror = () => { delete loading[key]; reject(new Error(`Could not load ${key}. Check your connection.`)); };
      document.head.appendChild(s);
    });
  }
  return loading[key];
}

export const $ = (s, root = document) => root.querySelector(s);
export const $$ = (s, root = document) => [...root.querySelectorAll(s)];

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '—';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function splitName(name) {
  const i = name.lastIndexOf('.');
  return i > 0 ? [name.slice(0, i), name.slice(i + 1)] : [name, ''];
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Zip [{name, blob}] and download. Duplicate names get " (2)" etc. */
export async function downloadZip(files, zipName) {
  const JSZip = await loadLib('jszip');
  const zip = new JSZip();
  const used = new Set();
  for (const f of files) {
    let name = f.name;
    if (used.has(name.toLowerCase())) {
      const [b, e] = splitName(name);
      let i = 2;
      while (used.has(`${b} (${i})${e ? '.' + e : ''}`.toLowerCase())) i++;
      name = `${b} (${i})${e ? '.' + e : ''}`;
    }
    used.add(name.toLowerCase());
    zip.file(name, f.blob, f.date ? { date: f.date } : undefined);
  }
  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  downloadBlob(blob, zipName);
}

/** Wire a drop zone + hidden file input. onFiles receives an array of File. */
export function setupDropzone(zone, input, onFiles) {
  const pick = () => input.click();
  zone.addEventListener('click', (e) => { if (!e.target.closest('button, a, input, label')) pick(); });
  zone.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  ['dragenter', 'dragover'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.add('over'); }));
  ['dragleave', 'dragend', 'drop'].forEach((ev) => zone.addEventListener(ev, (e) => { e.preventDefault(); zone.classList.remove('over'); }));
  zone.addEventListener('drop', (e) => {
    const files = [...(e.dataTransfer && e.dataTransfer.files || [])];
    if (files.length) onFiles(files);
  });
  input.addEventListener('change', () => {
    const files = [...(input.files || [])];
    input.value = '';
    if (files.length) onFiles(files);
  });
  // paste images from the clipboard
  document.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData && e.clipboardData.files || [])];
    if (files.length && input.accept && files.some((f) => matchesAccept(f, input.accept))) onFiles(files);
  });
}

export function matchesAccept(file, accept) {
  if (!accept) return true;
  return accept.split(',').map((s) => s.trim().toLowerCase()).some((a) =>
    a.endsWith('/*') ? file.type.startsWith(a.slice(0, -1)) : a.startsWith('.') ? file.name.toLowerCase().endsWith(a) : file.type === a);
}

export function setStatus(el, msg, kind) {
  if (!el) return;
  el.textContent = msg || '';
  el.dataset.kind = kind || '';
}

export async function copyText(text) {
  try { await navigator.clipboard.writeText(text); return true; }
  catch (_) {
    const ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    const ok = document.execCommand('copy'); ta.remove();
    return ok;
  }
}

/** Which image encoders does this browser's canvas support? */
export function canvasEncoders() {
  const c = document.createElement('canvas');
  c.width = c.height = 1;
  const test = (t) => { try { return c.toDataURL(t).startsWith(`data:${t}`); } catch (_) { return false; } };
  return { 'image/jpeg': true, 'image/png': true, 'image/webp': test('image/webp'), 'image/avif': test('image/avif') };
}

export function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Encoding failed'))), type, quality));
}

/** Decode any browser-supported image file, honouring EXIF orientation. */
export async function decodeImage(file) {
  if ('createImageBitmap' in window) {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch (_) { /* fall through */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => { resolve(img); };
    img.onerror = () => reject(new Error('Unsupported image'));
    img.src = URL.createObjectURL(file);
  });
}
