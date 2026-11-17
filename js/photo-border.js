/* WebcamClicks — Photo Border Maker.
   Adds a clean border (and a small webcamclicks.com credit) to one or many photos.
   Everything happens in the browser: files are decoded into <canvas>, never uploaded. */

const CREDIT = 'webcamclicks.com';
const JSZIP_URL = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
const PREVIEW_MAX = 900;
const MAX_ORIGINAL_SIDE = 6000;

const SIZES = {
  original: { label: 'Original', ratio: null },
  square: { label: 'Square 1:1', ratio: 1 },
  portrait: { label: 'Portrait 4:5', ratio: 4 / 5 },
  story: { label: 'Story 9:16', ratio: 9 / 16 },
  landscape: { label: 'Landscape 1.91:1', ratio: 1.91 }
};
const COLORS = {
  white: { bg: '#ffffff', text: 'rgba(17,17,17,0.55)' },
  warm: { bg: '#f6f1e7', text: 'rgba(60,45,30,0.55)' },
  grey: { bg: '#e9e9ea', text: 'rgba(17,17,17,0.55)' },
  black: { bg: '#0d0d0d', text: 'rgba(255,255,255,0.6)' }
};

const state = {
  size: 'portrait',
  style: 'even',
  border: 6,
  color: 'white',
  res: 1080,
  items: [] // { id, file, name, preview (canvas), outUrl, el, error }
};
let nextId = 1;

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------------- decoding ---------------- */

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => resolve({ img, url });
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('unsupported')); };
    img.src = url; // <img> applies EXIF orientation automatically in modern browsers
  });
}

function downscale(img, max) {
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(img.naturalWidth * s));
  c.height = Math.max(1, Math.round(img.naturalHeight * s));
  const x = c.getContext('2d');
  x.imageSmoothingQuality = 'high';
  x.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/* ---------------- layout + render ---------------- */

/**
 * Compute output canvas size and where the photo sits.
 * iw/ih: source size. scaleHint: output scale for "original" (1 = full resolution).
 */
function computeLayout(iw, ih, opts, targetWidth) {
  const pct = (opts.style === 'thin' ? opts.border * 0.5 : opts.border) / 100;
  const ratio = SIZES[opts.size].ratio;

  if (!ratio) {
    // Keep the photo's own shape and simply add the border around it
    const s = targetWidth ? targetWidth / iw : 1;
    const w0 = iw * s;
    const h0 = ih * s;
    const m = Math.round(Math.max(w0, h0) * pct);
    const font = Math.max(11, Math.round(Math.max(w0, h0) * 0.016));
    let bottom = Math.max(m, Math.round(font * 3.4));
    if (opts.style === 'gallery') bottom = Math.max(bottom, m * 3);
    return {
      W: Math.round(w0 + m * 2), H: Math.round(h0 + m + bottom),
      x: m, y: m, w: Math.round(w0), h: Math.round(h0), font, bottom
    };
  }

  const W = targetWidth;
  const H = Math.round(W / ratio);
  const m = Math.round(Math.min(W, H) * pct);
  const font = Math.max(11, Math.round(Math.min(W, H) * 0.02));
  let bottom = Math.max(m, Math.round(font * 3.4));
  if (opts.style === 'gallery') bottom = Math.max(bottom, m * 3);
  const availW = W - m * 2;
  const availH = H - m - bottom;
  const s = Math.min(availW / iw, availH / ih);
  const w = Math.round(iw * s);
  const h = Math.round(ih * s);
  // Centre horizontally; vertically centre inside the area above the caption margin
  const x = Math.round((W - w) / 2);
  const y = Math.round(m + (availH - h) / 2);
  return { W, H, x, y, w, h, font, bottom };
}

function renderBordered(source, iw, ih, opts, targetWidth) {
  const L = computeLayout(iw, ih, opts, targetWidth);
  const c = document.createElement('canvas');
  c.width = L.W;
  c.height = L.H;
  const g = c.getContext('2d');
  const col = COLORS[opts.color];
  g.fillStyle = col.bg;
  g.fillRect(0, 0, L.W, L.H);

  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(source, L.x, L.y, L.w, L.h);

  // Credit line, centred in the bottom margin
  g.fillStyle = col.text;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `500 ${L.font}px Outfit, "Helvetica Neue", Arial, sans-serif`;
  if ('letterSpacing' in g) g.letterSpacing = `${(L.font * 0.16).toFixed(1)}px`;
  const captionY = L.y + L.h + (L.H - (L.y + L.h)) / 2;
  g.fillText(CREDIT, L.W / 2, captionY);
  return c;
}

function outputWidthFor(item, forExport) {
  const ratio = SIZES[state.size].ratio;
  if (!forExport) {
    // previews: keep them light
    return ratio ? 720 : Math.min(720, item.preview.width);
  }
  if (ratio) return state.res;
  return null; // original resolution
}

/* ---------------- UI: list ---------------- */

function addFiles(fileList) {
  const files = [...fileList].filter((f) => f && (f.type.startsWith('image/') || /\.(heic|heif|jpe?g|png|webp|avif)$/i.test(f.name)));
  if (!files.length) return;
  for (const file of files) {
    const item = { id: nextId++, file, name: file.name.replace(/\.[^.]+$/, '') || 'photo', preview: null, outUrl: null, el: null, error: null };
    state.items.push(item);
    createCard(item);
    decodeItem(item);
  }
  updateToolbar();
  $('#pb-results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

async function decodeItem(item) {
  try {
    const { img, url } = await loadImage(item.file);
    item.preview = downscale(img, PREVIEW_MAX);
    item.fullW = img.naturalWidth;
    item.fullH = img.naturalHeight;
    URL.revokeObjectURL(url);
    renderPreview(item);
  } catch {
    item.error = 'This file type can’t be opened in your browser. Try a JPG, PNG or WebP.';
    item.el.classList.add('is-error');
    $('.pb-card-status', item.el).textContent = item.error;
  }
  updateToolbar();
}

function createCard(item) {
  const el = document.createElement('figure');
  el.className = 'pb-card is-loading';
  el.innerHTML = `
    <div class="pb-card-img"><span class="pb-spinner" aria-hidden="true"></span></div>
    <figcaption>
      <span class="pb-card-name"></span>
      <span class="pb-card-status">Processing…</span>
      <span class="pb-card-actions">
        <button type="button" class="pb-btn pb-btn-sm pb-dl" disabled>Download</button>
        <button type="button" class="pb-icon-btn pb-rm" aria-label="Remove photo">✕</button>
      </span>
    </figcaption>`;
  $('.pb-card-name', el).textContent = item.file.name;
  $('.pb-dl', el).addEventListener('click', () => downloadOne(item));
  $('.pb-rm', el).addEventListener('click', () => removeItem(item));
  item.el = el;
  $('#pb-grid').appendChild(el);
}

function renderPreview(item) {
  if (!item.preview) return;
  const c = renderBordered(item.preview, item.preview.width, item.preview.height, state, outputWidthFor(item, false));
  const box = $('.pb-card-img', item.el);
  box.innerHTML = '';
  c.className = 'pb-preview';
  c.setAttribute('role', 'img');
  c.setAttribute('aria-label', `${item.file.name} with border`);
  box.appendChild(c);
  item.el.classList.remove('is-loading');
  const L = computeLayout(item.fullW, item.fullH, state, outputWidthFor(item, true));
  $('.pb-card-status', item.el).textContent = `${L.W} × ${L.H} px · JPG`;
  $('.pb-dl', item.el).disabled = false;
}

function renderAllPreviews() {
  for (const it of state.items) renderPreview(it);
}

function removeItem(item) {
  state.items = state.items.filter((i) => i !== item);
  item.el.remove();
  updateToolbar();
}

function updateToolbar() {
  const ready = state.items.filter((i) => i.preview).length;
  const total = state.items.length;
  $('#pb-results').hidden = total === 0;
  $('#pb-empty-state').hidden = total > 0;
  $('#pb-count').textContent = total === 1 ? '1 photo' : `${total} photos`;
  $('#pb-dl-all').disabled = ready === 0;
  $('#pb-dl-all').textContent = ready > 1 ? `Download all (${ready}) as ZIP` : 'Download';
  const share = $('#pb-share');
  share.hidden = !(navigator.canShare && ready > 0);
}

/* ---------------- export ---------------- */

async function exportBlob(item) {
  const { img, url } = await loadImage(item.file);
  try {
    let source = img;
    let iw = img.naturalWidth;
    let ih = img.naturalHeight;
    const target = outputWidthFor(item, true);
    if (!target && Math.max(iw, ih) > MAX_ORIGINAL_SIDE) {
      source = downscale(img, MAX_ORIGINAL_SIDE);
      iw = source.width;
      ih = source.height;
    }
    const c = renderBordered(source, iw, ih, state, target);
    return await new Promise((res) => c.toBlob(res, 'image/jpeg', 0.95));
  } finally {
    URL.revokeObjectURL(url);
  }
}

function fileNameFor(item) {
  return `${item.name}-border.jpg`;
}

function saveBlob(blob, name) {
  const a = document.createElement('a');
  const url = URL.createObjectURL(blob);
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

async function downloadOne(item) {
  const btn = $('.pb-dl', item.el);
  btn.disabled = true;
  btn.textContent = 'Saving…';
  try {
    saveBlob(await exportBlob(item), fileNameFor(item));
  } finally {
    btn.disabled = false;
    btn.textContent = 'Download';
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (window.JSZip) return resolve();
    const s = document.createElement('script');
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function downloadAll() {
  const items = state.items.filter((i) => i.preview);
  if (!items.length) return;
  if (items.length === 1) return downloadOne(items[0]);
  const btn = $('#pb-dl-all');
  btn.disabled = true;
  try {
    await loadScript(JSZIP_URL);
    const zip = new window.JSZip();
    const used = new Set();
    for (let k = 0; k < items.length; k++) {
      btn.textContent = `Preparing ${k + 1} of ${items.length}…`;
      let name = fileNameFor(items[k]);
      for (let n = 2; used.has(name); n++) name = `${items[k].name}-border-${n}.jpg`;
      used.add(name);
      zip.file(name, await exportBlob(items[k]));
    }
    btn.textContent = 'Zipping…';
    const blob = await zip.generateAsync({ type: 'blob' });
    saveBlob(blob, 'webcamclicks-bordered-photos.zip');
  } catch {
    alert('Sorry, the ZIP could not be created. You can still download photos one by one.');
  } finally {
    updateToolbar();
  }
}

async function shareAll() {
  const items = state.items.filter((i) => i.preview);
  const btn = $('#pb-share');
  btn.disabled = true;
  btn.textContent = 'Preparing…';
  try {
    const files = [];
    for (const it of items) files.push(new File([await exportBlob(it)], fileNameFor(it), { type: 'image/jpeg' }));
    if (navigator.canShare({ files })) await navigator.share({ files });
    else alert('Your browser can’t share these files. Use Download instead.');
  } catch { /* user cancelled */ } finally {
    btn.disabled = false;
    btn.textContent = 'Save / Share';
  }
}

/* ---------------- controls ---------------- */

function bindSegment(name, key, parse = (v) => v) {
  $$(`[data-${name}]`).forEach((b) => {
    b.addEventListener('click', () => {
      state[key] = parse(b.dataset[name]);
      $$(`[data-${name}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      renderAllPreviews();
    });
  });
}

let raf = 0;
function init() {
  bindSegment('size', 'size');
  bindSegment('style', 'style');
  bindSegment('color', 'color');
  bindSegment('res', 'res', Number);

  const range = $('#pb-border');
  const out = $('#pb-border-out');
  range.addEventListener('input', () => {
    state.border = Number(range.value);
    out.textContent = `${range.value}%`;
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(renderAllPreviews);
  });

  const input = $('#pb-input');
  input.addEventListener('change', () => { addFiles(input.files); input.value = ''; });
  $$('.pb-pick').forEach((b) => b.addEventListener('click', () => input.click()));

  const drop = $('#pb-drop');
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('is-over'); }));
  drop.addEventListener('drop', (e) => addFiles(e.dataTransfer.files));
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
  window.addEventListener('paste', (e) => {
    const files = [...(e.clipboardData?.files || [])];
    if (files.length) addFiles(files);
  });

  $('#pb-dl-all').addEventListener('click', downloadAll);
  $('#pb-share').addEventListener('click', shareAll);
  $('#pb-clear').addEventListener('click', () => {
    state.items.forEach((i) => i.el.remove());
    state.items = [];
    updateToolbar();
  });

  // Make sure the caption font is ready before the first render
  if (document.fonts && document.fonts.load) document.fonts.load('500 20px Outfit').then(renderAllPreviews).catch(() => {});
  updateToolbar();
}

init();
