/* WebcamClicks — AI image upscaler (Swin2SR super-resolution, on-device).
   Without a graphics chip the AI runs on the processor, one core per worker: the image is split into bands that
   several workers process in parallel. "Instant" is a classic sharp resize for when speed matters most. */

import { $, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes, splitName } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), model: $('#up-model'), modelStatus: $('#up-model-status'), run: $('#up-run'),
  bar: $('#up-bar'), fill: $('#up-fill'), cmp: $('#up-compare'), before: $('#up-before'), after: $('#up-after'), split: $('#up-split'),
  out: $('#up-out'), fmt: $('#up-fmt'), dl: $('#up-dl'), info: $('#up-info'), cancel: $('#up-cancel')
};
// input-pixel limits per device: the 4× models are ~50× more work per pixel than the fast one
const LIMIT = { gpu: { instant: 16e6, fast: 4e6, photo: 1.2e6, jpeg: 1.2e6, sharp: 2e6 }, cpu: { instant: 16e6, fast: 0.8e6, photo: 0.25e6, jpeg: 0.25e6, sharp: 0.35e6 } };
const SCALE = { instant: 2, fast: 2, photo: 4, jpeg: 4, sharp: 2 };
const MARGIN = 12;   // overlap between bands so seams are invisible
let hasGpu = false;

let file = null, src = null, result = null, busy = false, cancelled = false;
const models = {};
const store = { get(k, d) { try { return localStorage.getItem(`wc_up_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_up_${k}`, v); } catch (_) { /* ignore */ } } };
els.model.value = store.get('model', '');
const poolSize = () => (hasGpu ? 1 : Math.max(1, Math.min(6, (navigator.hardwareConcurrency || 2) - 1)));
const gpuReady = (navigator.gpu ? navigator.gpu.requestAdapter().catch(() => null) : Promise.resolve(null)).then((a) => {
  hasGpu = !!a;
  if (!els.model.value) els.model.value = hasGpu ? 'photo' : 'fast';
  const note = $('#up-device');
  if (note) note.textContent = hasGpu ? 'Graphics chip found: the 4× models run quickly.' : `No graphics acceleration in this browser: the AI runs on ${poolSize()} processor core${poolSize() > 1 ? 's' : ''} in parallel. “Instant” is immediate; “Fast” takes under a minute for most photos.`;
  if (src) describe();
});

/* ---------------------------------------------------------------- worker pool */
const pool = [];
function getWorker(i) {
  if (pool[i]) return pool[i];
  const w = new Worker(new URL('./upscale-worker.js', import.meta.url), { type: 'module' });
  w.jobs = new Map();
  w.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'model') { if (i === 0) { models[m.key] = { ...(models[m.key] || {}), ...m }; showModel(); } return; }
    const j = w.jobs.get(m.id); if (!j) return;
    if (m.type === 'progress') j.progress(m.done);
    if (m.type === 'done') { w.jobs.delete(m.id); j.resolve(m); }
    if (m.type === 'error') { w.jobs.delete(m.id); j.reject(new Error(m.text)); }
  };
  w.onerror = (e) => { for (const j of w.jobs.values()) j.reject(new Error(e.message || 'The AI worker stopped.')); w.jobs.clear(); };
  pool[i] = w; return w;
}
function stopPool() { pool.splice(0).forEach((w) => w && w.terminate()); }
function showModel() {
  const s = models[els.model.value], el = els.modelStatus;
  el.dataset.state = s ? s.state : '';
  if (els.model.value === 'instant') { el.textContent = 'No download needed.'; return; }
  if (!s) el.textContent = '';
  else if (s.state === 'downloading') el.textContent = `AI model downloading in the background: ${s.total ? Math.round((s.loaded / s.total) * 100) : 0}% (${formatBytes(s.loaded || 0)} of ${formatBytes(s.total || 0)}). One time only.`;
  else if (s.state === 'ready') el.textContent = `✓ AI model ready (${s.device === 'webgpu' ? 'graphics chip' : 'processor'}). Works offline from now on.`;
  else el.textContent = 'The AI model could not be downloaded. It will try again when you upscale.';
}
function preload() {
  const k = els.model.value; if (!k || k === 'instant') { showModel(); return; }
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) { els.modelStatus.textContent = 'Data saver is on: the AI model downloads when you upscale.'; return; }
  if (models[k] && models[k].state !== 'error') return;
  models[k] = { state: 'downloading', loaded: 0, total: 0 }; showModel();
  getWorker(0).postMessage({ type: 'preload', key: k });
}
gpuReady.then(() => (window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(preload, { timeout: 6000 }));
els.model.addEventListener('change', () => { store.set('model', els.model.value); showModel(); preload(); if (src) describe(); });

/* ---------------------------------------------------------------- input */
async function open(f) {
  file = f; result = null; els.dl.disabled = true;
  const bmp = await decodeImage(f);
  src = document.createElement('canvas'); src.width = bmp.width || bmp.naturalWidth; src.height = bmp.height || bmp.naturalHeight;
  src.getContext('2d').drawImage(bmp, 0, 0);
  els.before.src = src.toDataURL(); els.after.src = els.before.src;
  els.cmp.hidden = false; els.run.disabled = false;
  await gpuReady; describe();
  upscale();
}
function inputSize() {
  const k = els.model.value, px = src.width * src.height, s = Math.min(1, Math.sqrt(LIMIT[hasGpu ? 'gpu' : 'cpu'][k] / px));
  return [Math.max(1, Math.round(src.width * s)), Math.max(1, Math.round(src.height * s)), s < 1];
}
function describe() {
  const [w, h, shrunk] = inputSize(), k = SCALE[els.model.value];
  els.info.textContent = `${src.width}×${src.height} → ${w * k}×${h * k}${shrunk ? ` (to keep it quick on this device, the photo is processed at ${w}×${h}: still a ${((w * k) / src.width).toFixed(1)}× enlargement)` : ''}`;
}

/* ---------------------------------------------------------------- instant: classic resize + detail sharpening */
function instant(c) {
  const W = c.width * 2, H = c.height * 2, o = document.createElement('canvas'); o.width = W; o.height = H;
  const g = o.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, W, H);
  const img = g.getImageData(0, 0, W, H), d = img.data, s = new Uint8ClampedArray(d);
  const amt = 0.6;   // unsharp mask on a 3×3 neighbourhood: restores edge crispness lost in interpolation
  for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const i = (y * W + x) * 4;
    for (let ch = 0; ch < 3; ch++) {
      const blur = (s[i - 4 + ch] + s[i + 4 + ch] + s[i - W * 4 + ch] + s[i + W * 4 + ch] + 4 * s[i + ch]) / 8;
      d[i + ch] = s[i + ch] + amt * (s[i + ch] - blur);
    }
  }
  g.putImageData(img, 0, 0); return o;
}

/* ---------------------------------------------------------------- run */
async function upscale() {
  if (!src || busy) return;
  await gpuReady;
  busy = true; cancelled = false; els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%'; els.cancel.hidden = false;
  const t0 = performance.now();
  try {
    const key = els.model.value, [w, h] = inputSize();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d', { willReadFrequently: true }); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    let out;
    if (key === 'instant') out = instant(c);
    else {
      if (!models[key] || models[key].state === 'error') models[key] = { state: 'downloading', loaded: 0, total: 0 };
      showModel();
      if (models[key].state === 'downloading') setStatus(els.status, 'Waiting for the AI model to finish downloading (first time only)…');
      // split into horizontal bands (with overlap) and process them in parallel
      const n = Math.max(1, Math.min(poolSize(), Math.floor(h / 48))), bh = Math.ceil(h / n), done = new Array(n).fill(0);
      const report = () => {
        const p = done.reduce((a, b) => a + b, 0) / n, el = (performance.now() - t0) / 1000, left = p > 0.02 ? (el / p) * (1 - p) : 0;
        els.fill.style.width = `${Math.round(p * 100)}%`;
        setStatus(els.status, `Upscaling on ${n > 1 ? `${n} processor cores` : hasGpu ? 'your graphics chip' : 'your processor'}… ${Math.round(p * 100)}%${p > 0.02 && p < 1 ? ` · about ${left < 60 ? `${Math.max(1, Math.round(left))} s` : `${Math.round(left / 60)} min`} left` : ''}`);
      };
      const parts = await Promise.all(Array.from({ length: n }, (_, i) => {
        const y0 = Math.max(0, i * bh - MARGIN), y1 = Math.min(h, (i + 1) * bh + MARGIN);
        const { data } = g.getImageData(0, y0, w, y1 - y0);
        const wk = getWorker(i), id = `${Date.now()}-${i}`;
        return new Promise((resolve, reject) => {
          wk.jobs.set(id, { resolve, reject, progress: (p) => { done[i] = p; report(); } });
          wk.postMessage({ type: 'run', id, key, data, width: w, height: y1 - y0 }, [data.buffer]);
        }).then((r) => ({ r, i, y0 }));
      }));
      const S = parts[0].r.scale;
      out = document.createElement('canvas'); out.width = w * S; out.height = h * S;
      const og = out.getContext('2d');
      for (const { r, i, y0 } of parts) {   // keep each band's own rows, drop the overlap
        const top = (i * bh - y0) * S, rows = (Math.min(h, (i + 1) * bh) - i * bh) * S;
        og.putImageData(new ImageData(r.data, r.width, r.height), 0, i * bh * S - top, 0, top, r.width, rows);
      }
    }
    // optional smaller output (e.g. 2× from the 4× model: sharper than a 2× model)
    const want = +els.out.value, sc = out.width / w;
    if (want && want < sc) {
      const f = document.createElement('canvas'); f.width = Math.round(src.width * want); f.height = Math.round(src.height * want);
      const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(out, 0, 0, f.width, f.height); result = f;
    } else result = out;
    els.after.src = result.toDataURL('image/png');
    els.dl.disabled = false;
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${result.width}×${result.height}. Drag the slider to compare.`, 'ok');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, cancelled ? 'Cancelled. Try “Instant” or “Fast” for a quicker result.' : /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not download the AI model. Check your connection and try again.' : `Upscaling failed: ${e.message}`, cancelled ? '' : 'err');
  }
  busy = false; els.bar.hidden = true; els.run.disabled = false; els.cancel.hidden = true;
}
els.cancel.addEventListener('click', () => {
  if (!busy) return;
  cancelled = true;
  for (const w of pool) if (w) for (const j of w.jobs.values()) j.reject(new Error('CANCELLED'));
  stopPool(); for (const k of Object.keys(models)) if (models[k].state === 'downloading') delete models[k];
});
els.run.addEventListener('click', upscale);
els.split.addEventListener('input', () => els.cmp.style.setProperty('--split', `${els.split.value}%`));
els.dl.addEventListener('click', async () => {
  if (!result) return;
  const type = els.fmt.value, blob = await canvasToBlob(result, type, 0.93);
  downloadBlob(blob, `${splitName(file.name)[0]}-upscaled-${result.width}x${result.height}.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`);
});
setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => x.type.startsWith('image/') || /\.(heic|heif)$/i.test(x.name)); if (f) open(f).catch((e) => setStatus(els.status, e.message, 'err')); else setStatus(els.status, 'Please choose an image.', 'err'); });
window.__upTest = { get result() { return result; }, get src() { return src; }, models };
