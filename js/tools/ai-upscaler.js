/* WebcamClicks — AI image upscaler (Swin2SR super-resolution, on-device). */

import { $, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes, splitName } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), model: $('#up-model'), modelStatus: $('#up-model-status'), run: $('#up-run'),
  bar: $('#up-bar'), fill: $('#up-fill'), cmp: $('#up-compare'), before: $('#up-before'), after: $('#up-after'), split: $('#up-split'),
  out: $('#up-out'), fmt: $('#up-fmt'), dl: $('#up-dl'), info: $('#up-info'), cancel: $('#up-cancel'), eta: $('#up-eta')
};
// input-pixel limits per device: the big 4× models are ~50× more work per pixel than the fast one
const LIMIT = { gpu: { fast: 4e6, photo: 1.2e6, jpeg: 1.2e6, sharp: 2e6 }, cpu: { fast: 1.2e6, photo: 0.3e6, jpeg: 0.3e6, sharp: 0.45e6 } };
const SCALE = { fast: 2, photo: 4, jpeg: 4, sharp: 2 };
let hasGpu = false;

let file = null, src = null, result = null, worker = null, job = null, jid = 0;
const models = {};
const store = { get(k, d) { try { return localStorage.getItem(`wc_up_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_up_${k}`, v); } catch (_) { /* ignore */ } } };
els.model.value = store.get('model', '');
// without a graphics chip the big models take minutes: start with the fast one unless the user chose otherwise
const gpuReady = (navigator.gpu ? navigator.gpu.requestAdapter().catch(() => null) : Promise.resolve(null)).then((a) => {
  hasGpu = !!a;
  if (!els.model.value) els.model.value = hasGpu ? 'photo' : 'fast';
  const note = $('#up-device'); if (note) note.textContent = hasGpu ? 'Graphics chip found: the 4× models run quickly.' : 'No graphics acceleration in this browser: “Fast” takes seconds; the 4× models can take a few minutes.';
  if (src) describe();
});

function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./upscale-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'model') { models[m.key] = { ...(models[m.key] || {}), ...m }; showModel(); return; }
    if (!job || m.id !== job.id) return;
    if (m.type === 'status') setStatus(els.status, m.text);
    if (m.type === 'progress') {
      els.fill.style.width = `${Math.round(m.done * 100)}%`;
      const left = m.done > 0 ? (m.elapsed / m.done) * (1 - m.done) : 0;
      setStatus(els.status, `Upscaling… ${Math.round(m.done * 100)}%${m.done < 1 && m.elapsed > 2 ? ` · about ${left < 60 ? `${Math.max(1, Math.round(left))} s` : `${Math.round(left / 60)} min`} left` : ''}`);
    }
    if (m.type === 'done') job.resolve(m);
    if (m.type === 'error') job.reject(new Error(m.text));
  };
  worker.onerror = (e) => job && job.reject(new Error(e.message || 'The AI worker stopped.'));
  return worker;
}
function showModel() {
  const s = models[els.model.value], el = els.modelStatus;
  el.dataset.state = s ? s.state : '';
  if (!s) el.textContent = '';
  else if (s.state === 'downloading') el.textContent = `AI model downloading in the background: ${s.total ? Math.round((s.loaded / s.total) * 100) : 0}% (${formatBytes(s.loaded || 0)} of ${formatBytes(s.total || 0)}). One time only.`;
  else if (s.state === 'ready') el.textContent = `✓ AI model ready (${s.device === 'webgpu' ? 'graphics chip' : 'processor'}). Works offline from now on.`;
  else el.textContent = 'The AI model could not be downloaded. It will try again when you upscale.';
}
function preload() {
  if (!els.model.value) return;
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) { els.modelStatus.textContent = 'Data saver is on: the AI model downloads when you upscale.'; return; }
  const k = els.model.value; if (models[k] && models[k].state !== 'error') return;
  models[k] = { state: 'downloading', loaded: 0, total: 0 }; showModel();
  getWorker().postMessage({ type: 'preload', key: k });
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
  describe();
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

/* ---------------------------------------------------------------- run */
let busy = false;
async function upscale() {
  if (!src || busy) return;
  await gpuReady;
  busy = true; els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%'; els.cancel.hidden = false;
  const t0 = performance.now();
  try {
    const key = els.model.value, [w, h] = inputSize();
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const g = c.getContext('2d'); g.imageSmoothingQuality = 'high'; g.drawImage(src, 0, 0, w, h);
    const { data } = g.getImageData(0, 0, w, h);
    if (!models[key] || models[key].state === 'error') models[key] = { state: 'downloading', loaded: 0, total: 0 };
    showModel();
    if (models[key].state === 'downloading') setStatus(els.status, 'Waiting for the AI model to finish downloading (first time only)…');
    const id = ++jid;
    const r = await new Promise((resolve, reject) => { job = { id, resolve, reject }; getWorker().postMessage({ type: 'run', id, key, data, width: w, height: h }, [data.buffer]); });
    const out = document.createElement('canvas'); out.width = r.width; out.height = r.height;
    out.getContext('2d').putImageData(new ImageData(r.data, r.width, r.height), 0, 0);
    // optional smaller output (e.g. 2× from the 4× model: sharper than a 2× model)
    const want = +els.out.value;
    if (want && want < r.scale) {
      const f = document.createElement('canvas'); f.width = Math.round(src.width * want); f.height = Math.round(src.height * want);
      const fg = f.getContext('2d'); fg.imageSmoothingQuality = 'high'; fg.drawImage(out, 0, 0, f.width, f.height); result = f;
    } else result = out;
    els.after.src = result.toDataURL('image/png');
    els.dl.disabled = false;
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${result.width}×${result.height}. Drag the slider to compare.`, 'ok');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, e.message === 'CANCELLED' ? 'Cancelled. Try “Fast” for a quick result.' : /Failed to fetch|NetworkError/i.test(e.message) ? 'Could not download the AI model. Check your connection and try again.' : `Upscaling failed: ${e.message}`, e.message === 'CANCELLED' ? '' : 'err');
  }
  job = null; busy = false; els.bar.hidden = true; els.run.disabled = false; els.cancel.hidden = true;
}
els.cancel.addEventListener('click', () => {
  if (!job) return;
  const j = job; worker.terminate(); worker = null; for (const k of Object.keys(models)) if (models[k].state === 'downloading') delete models[k];
  j.reject(new Error('CANCELLED'));
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
