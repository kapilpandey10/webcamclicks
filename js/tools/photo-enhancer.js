/* WebcamClicks — free photo enhancer (on-device). Heavy pixel work runs in a module Worker. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, downloadZip, setStatus, decodeImage, canvasToBlob } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), list: $('#t-list'), status: $('#t-status'), preset: $('#t-preset'), strength: $('#t-strength'),
  denoise: $('#t-denoise'), sharpen: $('#t-sharpen'), upscale: $('#t-upscale'), format: $('#t-format'), run: $('#t-run'), zip: $('#t-zip'),
  clear: $('#t-clear'), cmp: $('#t-compare'), before: $('#t-before'), after: $('#t-after'), split: $('#t-split'), dl: $('#t-dl-one')
};

const PRESETS = {
  auto:      { strength: 70, denoise: 30, sharpen: 45, levels: true, color: true, light: true, vibrance: 0.35 },
  portrait:  { strength: 60, denoise: 45, sharpen: 25, levels: true, color: true, light: true, vibrance: 0.2 },
  lowlight:  { strength: 85, denoise: 70, sharpen: 30, levels: true, color: true, light: true, vibrance: 0.25 },
  landscape: { strength: 75, denoise: 20, sharpen: 60, levels: true, color: true, light: true, vibrance: 0.55 },
  document:  { strength: 90, denoise: 15, sharpen: 70, levels: true, color: false, light: true, vibrance: 0 }
};

let worker = null, jobId = 0;
const pending = new Map();
function run(stage, img, opts) {
  if (!worker) {
    worker = new Worker(new URL('./enhance-worker.js', import.meta.url), { type: 'module' });
    worker.onmessage = (e) => { const p = pending.get(e.data.id); if (!p) return; pending.delete(e.data.id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data); };
  }
  return new Promise((resolve, reject) => {
    const id = ++jobId; pending.set(id, { resolve, reject });
    worker.postMessage({ id, stage, data: img.data, width: img.width, height: img.height, opts }, [img.data.buffer]);
  });
}

let items = [], selected = null;

function opts() {
  const p = PRESETS[els.preset.value] || PRESETS.auto;
  return { ...p, strength: +els.strength.value / 100, denoise: +els.denoise.value / 100, sharpen: +els.sharpen.value / 100 * 1.4 };
}
els.preset.addEventListener('change', () => {
  const p = PRESETS[els.preset.value];
  els.strength.value = p.strength; els.denoise.value = p.denoise; els.sharpen.value = p.sharpen;
});

async function process(it) {
  const bmp = await decodeImage(it.file);
  const w0 = bmp.width || bmp.naturalWidth, h0 = bmp.height || bmp.naturalHeight;
  const up = +els.upscale.value;
  const cap = up > 1 ? 2400 : 4096;
  const s = Math.min(1, cap / Math.max(w0, h0));
  const w = Math.round(w0 * s), h = Math.round(h0 * s);
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(bmp, 0, 0, w, h);
  if (bmp.close) bmp.close();
  it.beforeUrl = c.toDataURL('image/jpeg', 0.85);
  const o = opts();
  let r = await run('enhance', g.getImageData(0, 0, w, h), o);
  g.putImageData(new ImageData(r.data, w, h), 0, 0);
  let out = c;
  if (up > 1) {
    out = document.createElement('canvas'); out.width = w * up; out.height = h * up;
    const og = out.getContext('2d', { willReadFrequently: true });
    og.imageSmoothingEnabled = true; og.imageSmoothingQuality = 'high';
    og.drawImage(c, 0, 0, out.width, out.height);
    r = await run('sharpen', og.getImageData(0, 0, out.width, out.height), { sharpen: o.sharpen + 0.35, radius: 2 });
    og.putImageData(new ImageData(r.data, out.width, out.height), 0, 0);
  } else if (o.sharpen > 0) {
    r = await run('sharpen', g.getImageData(0, 0, w, h), { sharpen: o.sharpen, radius: 1 });
    g.putImageData(new ImageData(r.data, w, h), 0, 0);
  }
  const fmt = els.format.value === 'same' ? (/png/.test(it.file.type) ? 'image/png' : /webp/.test(it.file.type) ? 'image/webp' : 'image/jpeg') : els.format.value;
  it.result = await canvasToBlob(out, fmt, 0.93);
  it.resultName = `${splitName(it.file.name)[0]}-enhanced${up > 1 ? '-2x' : ''}.${fmt === 'image/png' ? 'png' : fmt === 'image/webp' ? 'webp' : 'jpg'}`;
  it.dims = `${out.width}×${out.height}`;
  it.afterUrl = URL.createObjectURL(it.result);
  const t = document.createElement('canvas'); const ts = 96 / Math.max(out.width, out.height);
  t.width = Math.round(out.width * ts); t.height = Math.round(out.height * ts);
  t.getContext('2d').drawImage(out, 0, 0, t.width, t.height);
  it.thumb = t.toDataURL('image/jpeg', 0.7);
}

function show(it) {
  selected = it;
  els.cmp.hidden = !it || !it.afterUrl;
  if (!it || !it.afterUrl) return;
  els.before.src = it.beforeUrl; els.after.src = it.afterUrl;
  render();
}

function render() {
  els.list.innerHTML = items.map((it) => `<li class="t-item${it === selected ? ' sel' : ''}" data-id="${it.id}">
    ${it.thumb ? `<img class="thumb" src="${it.thumb}" alt="">` : '<span class="thumb">…</span>'}
    <div><div class="name">${escapeHtml(it.file.name)}</div><div class="meta">${formatBytes(it.file.size)}${it.result ? ` → <b>${it.dims}</b> · ${formatBytes(it.result.size)}` : ''}${it.error ? ` · <span class="grow">${escapeHtml(it.error)}</span>` : ''}</div></div>
    <div class="ctrl">${it.result ? '<button class="t-btn sm" data-act="dl" type="button">Download</button>' : ''}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`).join('');
  els.zip.disabled = !items.some((i) => i.result);
  els.run.disabled = !items.length;
}

async function runAll() {
  els.run.disabled = true;
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    setStatus(els.status, `Enhancing ${i + 1} of ${items.length}…`);
    try { it.error = ''; if (it.afterUrl) URL.revokeObjectURL(it.afterUrl); await process(it); if (!selected || selected === it) show(it); }
    catch (e) { console.warn(e); it.error = 'Could not process this image'; }
    render();
  }
  setStatus(els.status, 'Done. Drag the slider on the preview to compare before and after.', 'ok');
  els.run.disabled = false;
}

setupDropzone(els.drop, els.input, (files) => {
  const imgs = files.filter((f) => f.type.startsWith('image/'));
  if (!imgs.length) { setStatus(els.status, 'Please add photos (JPG, PNG, WebP, HEIC in Safari).', 'err'); return; }
  imgs.forEach((file) => items.push({ id: Math.random().toString(36).slice(2), file }));
  render(); runAll();
});
els.run.addEventListener('click', runAll);
els.clear.addEventListener('click', () => { items = []; selected = null; els.cmp.hidden = true; render(); setStatus(els.status, ''); });
els.list.addEventListener('click', (e) => {
  const li = e.target.closest('.t-item'); if (!li) return;
  const it = items.find((x) => x.id === li.dataset.id); if (!it) return;
  const act = e.target.closest('[data-act]') && e.target.closest('[data-act]').dataset.act;
  if (act === 'rm') { items = items.filter((x) => x !== it); if (selected === it) { selected = null; els.cmp.hidden = true; } render(); return; }
  if (act === 'dl' && it.result) { downloadBlob(it.result, it.resultName); return; }
  show(it);
});
els.split.addEventListener('input', () => { els.cmp.style.setProperty('--split', `${els.split.value}%`); });
els.dl.addEventListener('click', () => selected && selected.result && downloadBlob(selected.result, selected.resultName));
els.zip.addEventListener('click', async () => {
  const files = items.filter((i) => i.result).map((i) => ({ name: i.resultName, blob: i.result }));
  if (files.length === 1) return downloadBlob(files[0].blob, files[0].name);
  try { await downloadZip(files, 'enhanced-photos.zip'); } catch (e) { setStatus(els.status, e.message, 'err'); }
});
render();
