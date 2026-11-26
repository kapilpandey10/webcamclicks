/* WebcamClicks — Form Builder (Adobe "Prepare Form" style).
 * Open a PDF, drop form fields on it (text, checkbox, radio, dropdown,
 * date, signature, button), tune them in the properties panel, preview
 * the fillable form, then save — real AcroForm fields, written with
 * pdf-lib. Existing AcroForm fields are read back and shown as fields.
 * Everything runs in the browser; the file never leaves the device. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadLib, loadPdfjs, formatBytes } from './common.js';

const els = {
  input: $('#fb-input'), drop: $('#fb-drop'), status: $('#fb-status'),
  editor: $('#fb-editor'), pages: $('#fb-pages'), toolbar: $('#fb-toolbar'),
  palette: $('#fb-palette'), props: $('#fb-props'), propsEmpty: $('#fb-props-empty'),
  undo: $('#fb-undo'), redo: $('#fb-redo'), save: $('#fb-save'),
  previewBtn: $('#fb-preview'), clear: $('#fb-clear'),
};

/* ---------------- field types ---------------- */
const FIELD_TYPES = {
  text:      { label: 'Text field',   ico: 'Ab',  defW: 0.28,  defH: 0.038, prefix: 'Text' },
  multiline: { label: 'Text area',    ico: '☰',   defW: 0.28,  defH: 0.12,  prefix: 'Text' },
  checkbox:  { label: 'Checkbox',     ico: '☑',   defW: 0.028, defH: null,  prefix: 'Checkbox' },
  radio:     { label: 'Radio button', ico: '◉',   defW: 0.028, defH: null,  prefix: 'Radio' },
  dropdown:  { label: 'Dropdown',     ico: '▾',   defW: 0.28,  defH: 0.038, prefix: 'Dropdown' },
  date:      { label: 'Date field',   ico: '🗓',  defW: 0.2,   defH: 0.038, prefix: 'Date' },
  signature: { label: 'Signature',    ico: '✍',   defW: 0.3,   defH: 0.07,  prefix: 'Signature' },
  button:    { label: 'Button',       ico: '▣',   defW: 0.18,  defH: 0.045, prefix: 'Button' },
};
const DATE_FORMATS = { 'mm/dd/yyyy': 'MM/DD/YYYY', 'dd/mm/yyyy': 'DD/MM/YYYY', 'yyyy-mm-dd': 'YYYY-MM-DD' };

/* ---------------- state ---------------- */
let pdfBytes = null, pdf = null, file = null;
let pages = [];            // {n, wPt, hPt, rot, dispW, dispH, el, sheet, layer, canvas}
let fields = [];           // field model objects
let deletedExisting = [];  // origNames of existing fields removed by the user
let sel = null;            // selected field object
let history = [], redoStack = [];
let fid = 0;
let placeType = null;      // palette type being placed, or null
let mode = 'edit';         // 'edit' | 'preview'
let drag = null;           // {kind:'place'|'move'|'resize', f, sx, sy, ox, oy, ow, oh}
let counts = {};           // per-type counter for auto names
let existingCount = 0;     // fields read from the PDF

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- history ---------------- */
function getState() { return JSON.stringify({ fields, deletedExisting }); }
function applyState(s) {
  const o = JSON.parse(s);
  fields = o.fields; deletedExisting = o.deletedExisting || [];
  sel = fields.find(f => sel && f.id === sel.id) || null;
  drawAll(); renderProps();
}
function snapshot() { history.push(getState()); if (history.length > 80) history.shift(); redoStack = []; syncUndo(); }
function undo() {
  if (!history.length) return;
  redoStack.push(getState());
  applyState(history.pop());
  setStatus(els.status, 'Undone.'); syncUndo();
}
function redo() {
  if (!redoStack.length) return;
  history.push(getState());
  applyState(redoStack.pop());
  setStatus(els.status, 'Redone.'); syncUndo();
}
function syncUndo() {
  els.undo.disabled = !history.length;
  els.redo.disabled = !redoStack.length;
}

/* ---------------- PDF loading ---------------- */
async function openPdf(f) {
  file = f.name;
  pdfBytes = new Uint8Array(await f.arrayBuffer());
  const pdfjs = await loadPdfjs();
  try { pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise; } catch (e) { setStatus(els.status, 'Could not open that PDF.'); return; }
  pages = []; fields = []; deletedExisting = []; sel = null;
  history = []; redoStack = []; fid = 0; counts = {}; existingCount = 0;
  mode = 'edit'; placeType = null; syncMode();
  els.pages.innerHTML = ''; els.editor.hidden = false; syncUndo();
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const pg = { n, wPt: vp.width, hPt: vp.height, rot: page.rotate || 0, dispW: vp.width, dispH: vp.height };
    pg.el = document.createElement('div');
    pg.el.className = 'pe-page';
    pg.el.dataset.page = n;
    pg.el.innerHTML = `<div class="pe-pagebar"><span>Page ${n}</span></div>
      <div class="pe-sheet" style="aspect-ratio:${pg.dispW}/${pg.dispH}"><canvas></canvas><div class="pe-layer fb-layer"></div></div>`;
    pg.sheet = pg.el.querySelector('.pe-sheet');
    pg.layer = pg.el.querySelector('.pe-layer');
    pg.canvas = pg.el.querySelector('canvas');
    els.pages.appendChild(pg.el);
    await renderPage(pg, page);
    pages.push(pg);
  }
  existingCount = await loadExistingFields();
  drawAll(); renderProps(); syncUndo();
  const msg = existingCount
    ? `Opened ${file} — ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}, ${existingCount} existing field${existingCount > 1 ? 's' : ''} found. Click a field type, then drag a box on a page.`
    : `Opened ${file} — ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}. Click a field type, then drag a box on a page to add it.`;
  setStatus(els.status, msg);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function renderPage(pg, page) {
  const scale = 2, vp = page.getViewport({ scale });
  pg.canvas.width = Math.round(vp.width); pg.canvas.height = Math.round(vp.height);
  await page.render({ canvasContext: pg.canvas.getContext('2d'), viewport: vp }).promise;
}

/* ---------------- coordinates ----------------
 * Display fractions (u right, v down from top-left) <-> PDF points
 * (origin bottom-left, rotation-aware). Inverse of toPdf/boxToPdf. */
function toPdf(pg, u, v) {
  const W = pg.wPt, H = pg.hPt;
  switch (pg.rot) {
    case 90: return [v * W, u * H];
    case 180: return [(1 - u) * W, v * H];
    case 270: return [(1 - v) * W, (1 - u) * H];
    default: return [u * W, (1 - v) * H];
  }
}
function fromPdf(pg, x, y) {
  const W = pg.wPt, H = pg.hPt;
  switch (pg.rot) {
    case 90: return [y / H, x / W];
    case 180: return [1 - x / W, y / H];
    case 270: return [1 - y / H, 1 - x / W];
    default: return [x / W, 1 - y / H];
  }
}
function boxToPdf(pg, f) {
  const [x1, y1] = toPdf(pg, f.x, f.y);
  const [x2, y2] = toPdf(pg, f.x + f.w, f.y + f.h);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}
function boxFromPdf(pg, rect) {
  const [u1, v1] = fromPdf(pg, rect.x, rect.y);
  const [u2, v2] = fromPdf(pg, rect.x + rect.width, rect.y + rect.height);
  return { x: Math.min(u1, u2), y: Math.min(v1, v2), w: Math.abs(u2 - u1), h: Math.abs(v2 - v1) };
}

/* ---------------- fields: model ---------------- */
function nextName(type) {
  const p = FIELD_TYPES[type].prefix;
  counts[type] = (counts[type] || 0) + 1;
  return p + counts[type];
}
function newField(type, page, x, y, w, h) {
  const t = FIELD_TYPES[type];
  const f = {
    id: `f${++fid}`, type, page, x, y, w, h,
    name: nextName(type), tooltip: '', required: false, readonly: false,
    value: '', options: [], group: '', choice: '', checked: false,
    label: '', action: 'none', fontSize: 12, dateFormat: 'mm/dd/yyyy',
    existing: false, origName: '', origRect: null,
  };
  if (type === 'checkbox') { f.choice = 'Yes'; }
  if (type === 'radio') {
    const group = fields.filter(g => g.type === 'radio').map(g => g.name);
    f.group = group.length ? group[group.length - 1] : 'Group1';
    f.name = f.group;
    const inGroup = fields.filter(g => g.type === 'radio' && g.name === f.group).length;
    f.choice = 'Choice' + (inGroup + 1);
    if (inGroup === 0) f.checked = true;
  }
  if (type === 'dropdown') { f.options = ['Option 1', 'Option 2', 'Option 3']; f.value = 'Option 1'; }
  if (type === 'button') { f.label = t.label; }
  return f;
}
function deleteField(f) {
  if (!f) return;
  snapshot();
  if (f.existing && f.origName) deletedExisting.push({ origName: f.origName, type: f.type });
  fields = fields.filter(g => g !== f);
  if (sel === f) sel = null;
  drawAll(); renderProps();
}

/* ---------------- drawing ---------------- */
function fieldInner(f) {
  const name = `<span class="fb-name">${esc(f.name)}</span>`;
  switch (f.type) {
    case 'text': case 'multiline': case 'date':
      return `<span class="fb-ico">${FIELD_TYPES[f.type].ico}</span>${name}<span class="fb-val">${esc(f.value)}</span>`;
    case 'checkbox':
      return `<span class="fb-box">${f.checked ? '✓' : ''}</span>${name}`;
    case 'radio':
      return `<span class="fb-radio">${f.checked ? '●' : ''}</span>${name}<span class="fb-val">${esc(f.choice)}</span>`;
    case 'dropdown':
      return `${name}<span class="fb-val">${esc(f.value)}</span><span class="fb-caret">▾</span>`;
    case 'signature':
      return `<span class="fb-ico">✍</span>${name}<span class="fb-sig">sign here</span>`;
    case 'button':
      return `<span class="fb-btn-label">${esc(f.label || f.name)}</span>`;
    default: return name;
  }
}
function previewControl(f) {
  const ro = f.readonly ? 'readonly' : '';
  const dis = f.readonly ? 'disabled' : '';
  switch (f.type) {
    case 'text':
      return `<input type="text" value="${esc(f.value)}" ${ro} placeholder="${esc(f.tooltip || f.name)}" aria-label="${esc(f.name)}">`;
    case 'multiline':
      return `<textarea ${ro} placeholder="${esc(f.tooltip || f.name)}" aria-label="${esc(f.name)}">${esc(f.value)}</textarea>`;
    case 'date':
      return `<input type="date" ${ro} aria-label="${esc(f.name)}">`;
    case 'checkbox':
      return `<input type="checkbox" ${f.checked ? 'checked' : ''} ${dis} aria-label="${esc(f.name)}">`;
    case 'radio':
      return `<input type="radio" name="fb-${esc(f.name)}" value="${esc(f.choice)}" ${f.checked ? 'checked' : ''} ${dis} aria-label="${esc(f.choice)}">`;
    case 'dropdown':
      return `<select ${dis} aria-label="${esc(f.name)}">${f.options.map(o => `<option${o === f.value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    case 'signature':
      return `<input type="text" class="fb-sig-input" placeholder="Type to sign" ${ro} aria-label="${esc(f.name)}">`;
    case 'button':
      return `<button type="button" data-fb-action="${esc(f.action)}" data-fb-label="${esc(f.label)}">${esc(f.label || f.name)}</button>`;
    default: return '';
  }
}
function drawAll() {
  for (const pg of pages) {
    pg.layer.innerHTML = '';
    for (const f of fields.filter(g => g.page === pg.n)) {
      const d = document.createElement('div');
      d.className = `fb-field fb-${f.type}${f === sel ? ' sel' : ''}${f.required ? ' req' : ''}${mode === 'preview' ? ' pv' : ''}`;
      d.dataset.id = f.id;
      Object.assign(d.style, { left: (f.x * 100) + '%', top: (f.y * 100) + '%', width: (f.w * 100) + '%', height: (f.h * 100) + '%' });
      d.innerHTML = mode === 'preview' ? previewControl(f) : fieldInner(f);
      if (mode === 'edit' && f === sel) {
        d.insertAdjacentHTML('beforeend', '<span class="pe-handle" data-h="se"></span><button class="pe-x" data-x aria-label="Delete field">✕</button>');
      }
      pg.layer.appendChild(d);
    }
  }
  els.pages.dataset.mode = mode;
}

/* ---------------- placement / move / resize ---------------- */
function pageFromEvent(e) {
  const sheet = e.target.closest('.pe-sheet');
  if (!sheet) return null;
  const pg = pages.find(p => p.sheet === sheet);
  if (!pg) return null;
  const r = sheet.getBoundingClientRect();
  return { pg, u: Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), v: Math.min(1, Math.max(0, (e.clientY - r.top) / r.height)) };
}
function defaultSize(pg, type) {
  const t = FIELD_TYPES[type];
  const w = t.defW;
  const h = t.defH ?? (t.defW * pg.dispW / pg.dispH);
  return { w, h };
}
function startPlace(e, hit) {
  snapshot();
  const t = FIELD_TYPES[placeType];
  const f = newField(placeType, hit.pg.n, hit.u, hit.v, 0.001, 0.001);
  fields.push(f);
  sel = f;
  drag = { kind: 'place', f, sx: hit.u, sy: hit.v };
  drawAll(); renderProps();
  setStatus(els.status, `${t.label} — drag to size it, or just click for a standard size. Press Esc when done.`);
}
function onPointerDown(e) {
  if (!pdf) return;
  const hit = pageFromEvent(e);
  if (!hit) return;
  if (mode === 'preview') return; // controls handle themselves
  if (e.button !== 0) return;
  if (placeType) { startPlace(e, hit); return; }
  const fd = e.target.closest('.fb-field');
  if (e.target.closest('[data-x]')) { const f = fields.find(g => g.id === fd.dataset.id); deleteField(f); return; }
  if (fd) {
    const f = fields.find(g => g.id === fd.dataset.id);
    if (!f) return;
    if (sel !== f) { sel = f; renderProps(); drawAll(); }
    snapshot();
    const h = e.target.closest('[data-h]');
    drag = { kind: h ? 'resize' : 'move', f, sx: hit.u, sy: hit.v, ox: f.x, oy: f.y, ow: f.w, oh: f.h };
    e.preventDefault();
    return;
  }
  if (sel) { sel = null; renderProps(); drawAll(); }
}
function onPointerMove(e) {
  if (!drag) return;
  const hit = pageFromEvent(e);
  if (!hit || hit.pg.n !== drag.f.page) return;
  const { f } = drag;
  if (drag.kind === 'place') {
    f.x = Math.min(drag.sx, hit.u); f.y = Math.min(drag.sy, hit.v);
    f.w = Math.max(0.008, Math.abs(hit.u - drag.sx));
    f.h = Math.max(0.008, Math.abs(hit.v - drag.sy));
  } else if (drag.kind === 'move') {
    f.x = Math.min(1 - f.w, Math.max(0, drag.ox + (hit.u - drag.sx)));
    f.y = Math.min(1 - f.h, Math.max(0, drag.oy + (hit.v - drag.sy)));
  } else {
    f.w = Math.max(0.008, Math.min(1 - f.x, drag.ow + (hit.u - drag.sx)));
    f.h = Math.max(0.008, Math.min(1 - f.y, drag.oh + (hit.v - drag.sy)));
  }
  drawAll();
}
function onPointerUp(e) {
  if (!drag) return;
  const { f, kind } = drag; drag = null;
  if (kind === 'place') {
    if (f.w < 0.01 || f.h < 0.01) {
      const pg = pages[f.page - 1];
      const { w, h } = defaultSize(pg, f.type);
      f.w = w; f.h = h;
      f.x = Math.min(1 - w, Math.max(0, f.x)); f.y = Math.min(1 - h, Math.max(0, f.y));
    }
    drawAll(); renderProps();
    setStatus(els.status, `${FIELD_TYPES[f.type].label} “${f.name}” placed — edit it in the properties panel, or place another.`);
  } else if (kind === 'move' || kind === 'resize') {
    drawAll();
  }
}

/* ---------------- properties panel ---------------- */
function renderProps() {
  const panel = els.props;
  if (!sel) {
    panel.innerHTML = '';
    els.propsEmpty.classList.remove('hidden');
    return;
  }
  els.propsEmpty.classList.add('hidden');
  const f = sel;
  const t = FIELD_TYPES[f.type];
  let per = '';
  if (f.type === 'text' || f.type === 'date') {
    per = `<label class="fb-prop">Default text<input data-prop="value" value="${esc(f.value)}" placeholder="Pre-filled text"></label>`;
  }
  if (f.type === 'multiline') {
    per = `<label class="fb-prop">Default text<textarea data-prop="value" rows="3" placeholder="Pre-filled text">${esc(f.value)}</textarea></label>`;
  }
  if (f.type === 'checkbox') {
    per = `<label class="fb-check"><input type="checkbox" data-prop="checked" ${f.checked ? 'checked' : ''}> Checked by default</label>
      <label class="fb-prop">Export value<input data-prop="choice" value="${esc(f.choice || 'Yes')}"></label>`;
  }
  if (f.type === 'radio') {
    per = `<label class="fb-prop">Group name<input data-prop="group" value="${esc(f.name)}"></label>
      <label class="fb-prop">Choice value<input data-prop="choice" value="${esc(f.choice)}"></label>
      <label class="fb-check"><input type="checkbox" data-prop="checked" ${f.checked ? 'checked' : ''}> Selected by default</label>`;
  }
  if (f.type === 'dropdown') {
    per = `<label class="fb-prop">Options <span class="fb-hint">one per line</span><textarea data-prop="options" rows="4">${esc(f.options.join('\n'))}</textarea></label>
      <label class="fb-prop">Default selected<select data-prop="value">${f.options.map(o => `<option${o === f.value ? ' selected' : ''}>${esc(o)}</option>`).join('')}</select></label>`;
  }
  if (f.type === 'button') {
    per = `<label class="fb-prop">Button label<input data-prop="label" value="${esc(f.label)}"></label>
      <label class="fb-prop">Action<select data-prop="action">
        <option value="none"${f.action === 'none' ? ' selected' : ''}>None</option>
        <option value="print"${f.action === 'print' ? ' selected' : ''}>Print the form</option>
        <option value="reset"${f.action === 'reset' ? ' selected' : ''}>Reset the form</option>
      </select></label>`;
  }
  if (f.type === 'date') {
    per += `<label class="fb-prop">Date format<select data-prop="dateFormat">${Object.entries(DATE_FORMATS).map(([v, l]) => `<option value="${v}"${f.dateFormat === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>`;
  }
  const font = (f.type === 'text' || f.type === 'multiline' || f.type === 'dropdown' || f.type === 'date' || f.type === 'button')
    ? `<label class="fb-prop">Font size<input type="number" data-prop="fontSize" value="${f.fontSize}" min="6" max="72" step="1"></label>` : '';
  panel.innerHTML = `
    <h3>${t.label}</h3>
    <label class="fb-prop">Field name<input data-prop="name" value="${esc(f.name)}"></label>
    <label class="fb-prop">Tooltip<input data-prop="tooltip" value="${esc(f.tooltip)}" placeholder="Shown on hover"></label>
    ${per}
    ${font}
    <label class="fb-check"><input type="checkbox" data-prop="required" ${f.required ? 'checked' : ''}> Required field</label>
    <label class="fb-check"><input type="checkbox" data-prop="readonly" ${f.readonly ? 'checked' : ''}> Read-only</label>
    <p class="fb-meta">Page ${f.page} · ${f.existing ? 'Existing field' : 'New field'}${f.existing && f.origName !== f.name ? ' · renamed' : ''}</p>
    <button class="btn btn-danger" data-del>Delete field</button>`;
  panel.querySelectorAll('[data-prop]').forEach(c => c.addEventListener('change', onPropChange));
  panel.querySelector('[data-del]').addEventListener('click', () => deleteField(f));
}
function uniqueName(v, exclude) {
  let name = v, i = 2;
  const taken = new Set(fields.filter(g => !exclude.includes(g)).map(g => g.name));
  while (taken.has(name)) name = v + ' ' + (i++);
  return name;
}
function onPropChange(e) {
  const f = sel; if (!f) return;
  const c = e.target, k = c.dataset.prop;
  snapshot();
  if (k === 'name') {
    const v = (c.value.trim() || f.name);
    if (f.type === 'radio') {
      const group = fields.filter(g => g.type === 'radio' && g.name === f.name);
      const nv = uniqueName(v, group);
      for (const g of group) { g.name = nv; g.group = nv; }
      c.value = nv;
    } else { f.name = uniqueName(v, [f]); c.value = f.name; }
  } else if (k === 'group') {
    const group = fields.filter(g => g.type === 'radio' && g.name === f.name);
    const nv = uniqueName(c.value.trim() || f.name, group);
    for (const g of group) { g.name = nv; g.group = nv; }
    c.value = nv;
  } else if (k === 'checked') {
    f.checked = c.checked;
    if (f.type === 'radio' && c.checked) {
      for (const g of fields) if (g !== f && g.type === 'radio' && g.name === f.name) g.checked = false;
    }
  } else if (k === 'options') {
    f.options = c.value.split('\n').map(s => s.trim()).filter(Boolean);
    if (!f.options.includes(f.value)) f.value = f.options[0] || '';
    // refresh the default select in place (no full re-render, keeps focus)
    const selEl = els.props.querySelector('[data-prop="value"]');
    if (selEl) selEl.innerHTML = f.options.map(o => `<option${o === f.value ? ' selected' : ''}>${esc(o)}</option>`).join('');
  } else if (k === 'fontSize') {
    f.fontSize = Math.min(72, Math.max(6, Number(c.value) || 12));
  } else if (k === 'value') {
    f.value = c.value;
  } else if (k === 'tooltip' || k === 'choice' || k === 'label' || k === 'action' || k === 'dateFormat') {
    f[k] = c.value;
  } else if (k === 'required' || k === 'readonly') {
    f[k] = c.checked;
  }
  drawAll();
}

/* ---------------- palette & mode ---------------- */
function setPlaceType(type) {
  placeType = type;
  els.palette.querySelectorAll('button').forEach(b => {
    const on = b.dataset.field === type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  els.pages.dataset.placing = type || '';
  if (type) setStatus(els.status, `${FIELD_TYPES[type].label} — drag a box on a page to place it. Esc to stop.`);
}
function syncMode() {
  els.previewBtn.textContent = mode === 'preview' ? '✎ Edit fields' : '▶ Preview form';
  els.previewBtn.setAttribute('aria-pressed', mode === 'preview' ? 'true' : 'false');
  els.palette.querySelectorAll('button').forEach(b => b.disabled = mode === 'preview');
  els.clear.classList.toggle('hidden', mode !== 'preview');
  els.pages.dataset.mode = mode;
}
function togglePreview() {
  if (!pdf) return;
  mode = mode === 'preview' ? 'edit' : 'preview';
  if (mode === 'preview') { sel = null; renderProps(); }
  syncMode(); drawAll();
  setStatus(els.status, mode === 'preview' ? 'Preview — fill in the form to test it. Click “Edit fields” to keep building.' : 'Editing — click a field type, then drag a box on a page.');
}
function clearPreview() {
  drawAll();
  setStatus(els.status, 'Preview cleared.');
}

/* ---------------- existing AcroForm fields ---------------- */
async function loadExistingFields() {
  const R = await loadLib('pdflib');
  const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
  const form = doc.getForm();
  const docPages = doc.getPages();
  // key by the ref's string form — widget P() and page ref are different
  // PDFRef objects for the same indirect object, so object identity fails
  const refToPage = new Map(docPages.map((p, i) => [p.ref.toString(), i + 1]));
  let n = 0;
  for (const field of form.getFields()) {
    const name = field.getName();
    // NOTE: constructor.name is mangled in the minified pdf-lib build —
    // use instanceof against the classes exported by the loaded module.
    const isText = field instanceof R.PDFTextField;
    const isCheck = field instanceof R.PDFCheckBox;
    const isDrop = field instanceof R.PDFDropdown || field instanceof R.PDFOptionList;
    const isRadio = field instanceof R.PDFRadioGroup;
    const isBtn = field instanceof R.PDFButton;
    const isSig = field instanceof R.PDFSignature;
    for (const w of field.acroField.getWidgets()) {
      const pageRef = w.P();
      const pageNum = pageRef ? refToPage.get(pageRef.toString()) : null;
      if (!pageNum) continue;
      const rect = w.getRectangle();
      const pg = pages[pageNum - 1];
      if (!pg) continue;
      const box = boxFromPdf(pg, rect);
      if (box.w <= 0.005 || box.h <= 0.005) continue;
      const f = {
        id: `f${++fid}`, page: pageNum, x: box.x, y: box.y, w: box.w, h: box.h,
        name, tooltip: '', required: false, readonly: false,
        value: '', options: [], group: '', choice: '', checked: false,
        label: '', action: 'none', fontSize: 12, dateFormat: 'mm/dd/yyyy',
        existing: true, origName: name,
        origRect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
      };
      try { f.required = field.isRequired(); } catch {}
      try { f.readonly = field.isReadOnly(); } catch {}
      try {
        const tu = field.acroField.dict.get(R.PDFName.of('TU'));
        if (tu && tu.decodeText) f.tooltip = tu.decodeText();
      } catch {}
      if (isText) {
        f.type = field.isMultiline() ? 'multiline' : 'text';
        try { f.value = field.getText() || ''; } catch {}
        try { const da = w.getDefaultAppearance(); if (da && da.fontSize) f.fontSize = Math.round(da.fontSize); } catch {}
      } else if (isCheck) {
        f.type = 'checkbox';
        try { f.checked = field.isChecked(); } catch {}
        const on = w.getOnValue(); f.choice = on ? on.decodeText() : 'Yes';
      } else if (isDrop) {
        f.type = 'dropdown';
        try { f.options = field.getOptions() || []; } catch {}
        try { const s = field.getSelected(); f.value = (Array.isArray(s) ? s[0] : s) || ''; } catch {}
        try { const da = w.getDefaultAppearance(); if (da && da.fontSize) f.fontSize = Math.round(da.fontSize); } catch {}
      } else if (isRadio) {
        f.type = 'radio'; f.group = name;
        try { f.options = field.getOptions() || []; } catch {}
        const on = w.getOnValue();
        let choice = on ? on.decodeText() : '';
        // pdf-lib names radio appearance states by option index ("0", "1");
        // Acrobat names them by the option itself — map an index back
        if (/^\d+$/.test(choice) && f.options[Number(choice)] !== undefined) choice = f.options[Number(choice)];
        f.choice = choice;
        try { f.checked = field.getSelected() === f.choice; } catch {}
      } else if (isBtn) {
        f.type = 'button';
        try {
          const mk = w.dict.get(R.PDFName.of('MK'));
          const mkDict = mk instanceof R.PDFRef ? doc.context.lookup(mk) : mk;
          const ca = mkDict && mkDict.get(R.PDFName.of('CA'));
          if (ca) f.label = ca.decodeText ? ca.decodeText() : String(ca);
        } catch {}
        if (!f.label) f.label = name;
        try {
          const a = w.dict.get(R.PDFName.of('A'));
          const aDict = a instanceof R.PDFRef ? doc.context.lookup(a) : a;
          if (aDict) {
            const s = aDict.get(R.PDFName.of('S'));
            const sName = s && s.decodeText ? s.decodeText() : '';
            if (sName === 'Named') f.action = 'print';
            else if (sName === 'ResetForm') f.action = 'reset';
          }
        } catch {}
      } else if (isSig) {
        f.type = 'signature';
      } else continue;
      fields.push(f); n++;
    }
  }
  return n;
}

/* ---------------- saving ---------------- */
function setButtonAction(R, doc, btn, action) {
  const w = btn.acroField.getWidgets()[0];
  if (!w) return;
  if (action === 'print') w.dict.set(R.PDFName.of('A'), doc.context.obj({ S: 'Named', N: 'Print' }));
  else if (action === 'reset') w.dict.set(R.PDFName.of('A'), doc.context.obj({ S: 'ResetForm' }));
  else w.dict.delete(R.PDFName.of('A'));
}
function setDateFormat(R, doc, tf, format) {
  if (!format) return;
  const aa = doc.context.obj({});
  const fAction = doc.context.obj({ S: 'JavaScript', JS: R.PDFString.of(`AFDate_FormatEx("${format}");`) });
  aa.set(R.PDFName.of('F'), fAction);
  tf.acroField.dict.set(R.PDFName.of('AA'), aa);
}
function createSignatureField(R, doc, form, f, P, r) {
  const dict = doc.context.obj({ FT: 'Sig', Kids: [] });
  const ref = doc.context.register(dict);
  const sig = R.PDFAcroSignature.fromDict(dict, ref);
  sig.setPartialName(f.name);
  form.acroForm.addField(ref);
  // NOTE: do NOT set /Parent here — pdf-lib leaves top-level fields
  // parentless (a /Parent pointing at the AcroForm makes the field's
  // fully-qualified name read "undefined.Signature1").
  const sigField = R.PDFSignature.of(sig, ref, doc);
  if (f.required) sigField.enableRequired();
  if (f.readonly) sigField.enableReadOnly();
  const widget = sigField.createWidget({
    x: r.x, y: r.y, width: r.width, height: r.height,
    borderWidth: 1, borderColor: R.rgb(0.6, 0.6, 0.6), backgroundColor: R.rgb(1, 1, 1),
    rotate: R.degrees(0), page: P.ref,
  });
  const widgetRef = doc.context.register(widget.dict);
  sig.addWidget(widgetRef);
  P.node.addAnnot(widgetRef);
}
function applyCommon(R, doc, field, f) {
  if (f.required) field.enableRequired(); else field.disableRequired();
  if (f.readonly) field.enableReadOnly(); else field.disableReadOnly();
  if (f.tooltip) field.acroField.dict.set(R.PDFName.of('TU'), R.PDFString.of(f.tooltip));
}
function ensureDA(field) {
  if (!field.acroField.getDefaultAppearance()) field.acroField.setDefaultAppearance('0 0 0 rg');
}
function createField(R, doc, form, f, docPages, helv) {
  const P = docPages[f.page - 1];
  const r = boxToPdf(pages[f.page - 1], f);
  const border = { borderColor: R.rgb(0.6, 0.6, 0.6), borderWidth: 1 };
  // addToPage first: it creates the widget and the field's /DA (default
  // appearance) — setFontSize/updateAppearances need that /DA to exist.
  if (f.type === 'text' || f.type === 'multiline' || f.type === 'date') {
    const tf = form.createTextField(f.name);
    if (f.type === 'multiline') tf.enableMultiline();
    tf.addToPage(P, { ...r, textColor: R.rgb(0, 0, 0), ...border });
    if (f.value) tf.setText(f.value);
    if (f.fontSize) tf.setFontSize(f.fontSize);
    applyCommon(R, doc, tf, f);
    tf.updateAppearances(helv);
    if (f.type === 'date') setDateFormat(R, doc, tf, f.dateFormat);
  } else if (f.type === 'checkbox') {
    const cb = form.createCheckBox(f.name);
    cb.addToPage(P, { ...r, ...border });
    if (f.checked) cb.check();
    applyCommon(R, doc, cb, f);
    cb.updateAppearances();
  } else if (f.type === 'dropdown') {
    const dd = form.createDropdown(f.name);
    dd.addToPage(P, { ...r, textColor: R.rgb(0, 0, 0), ...border });
    if (f.options.length) dd.setOptions(f.options);
    if (f.value && f.options.includes(f.value)) dd.select(f.value);
    if (f.fontSize) dd.setFontSize(f.fontSize);
    applyCommon(R, doc, dd, f);
    dd.updateAppearances(helv);
  } else if (f.type === 'radio') {
    // handled as a group in buildFormPdf
  } else if (f.type === 'signature') {
    createSignatureField(R, doc, form, f, P, r);
  } else if (f.type === 'button') {
    const b = form.createButton(f.name);
    b.addToPage(f.label || f.name, P, { ...r, textColor: R.rgb(0, 0, 0), font: helv, ...border });
    if (f.fontSize) b.setFontSize(f.fontSize);
    applyCommon(R, doc, b, f);
    b.updateAppearances(helv);
    setButtonAction(R, doc, b, f.action);
  }
}
function updateExistingField(R, doc, orig, f, docPages, helv) {
  // constructor.name is mangled in the minified pdf-lib build — instanceof
  const isText = orig instanceof R.PDFTextField;
  const isCheck = orig instanceof R.PDFCheckBox;
  const isDrop = orig instanceof R.PDFDropdown || orig instanceof R.PDFOptionList;
  const isBtn = orig instanceof R.PDFButton;
  applyCommon(R, doc, orig, f);
  if (isText) {
    orig.setText(f.value || '');
    if (f.fontSize) { ensureDA(orig); orig.setFontSize(f.fontSize); }
    if (f.type === 'date') setDateFormat(R, doc, orig, f.dateFormat);
    orig.updateAppearances(helv);
  } else if (isCheck) {
    if (f.checked) orig.check(); else orig.uncheck();
    orig.updateAppearances();
  } else if (isDrop) {
    if (f.options.length) orig.setOptions(f.options);
    if (f.value && f.options.includes(f.value)) orig.select(f.value);
    if (f.fontSize) { ensureDA(orig); orig.setFontSize(f.fontSize); }
    orig.updateAppearances(helv);
  } else if (isBtn) {
    const w = orig.acroField.getWidgets()[0];
    if (w) {
      const ac = w.getOrCreateAppearanceCharacteristics();
      ac.setCaptions({ normal: f.label || f.name });
      setButtonAction(R, doc, orig, f.action);
    }
    orig.updateAppearances(helv);
  }
  // moved or resized? update the widget rect
  const r = boxToPdf(pages[f.page - 1], f);
  const o = f.origRect;
  if (o && (Math.abs(r.x - o.x) > 0.5 || Math.abs(r.y - o.y) > 0.5 || Math.abs(r.width - o.width) > 0.5 || Math.abs(r.height - o.height) > 0.5)) {
    const w = orig.acroField.getWidgets()[0];
    if (w) w.setRectangle(r);
  }
}
async function buildFormPdf() {
  const R = await loadLib('pdflib');
  const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
  const form = doc.getForm();
  const helv = await doc.embedFont(R.StandardFonts.Helvetica);
  const docPages = doc.getPages();
  const removedGroups = new Set(), removedSingles = new Set();

  // 1. fields the user deleted
  for (const d of deletedExisting) {
    try { const orig = form.getFieldMaybe(d.origName); if (orig) form.removeField(orig); } catch (e) { console.warn('remove failed', d.origName, e); }
  }
  // 2. radio groups — always remove + recreate from the field divs
  const groups = new Map();
  for (const f of fields) if (f.type === 'radio') {
    if (!groups.has(f.name)) groups.set(f.name, []);
    groups.get(f.name).push(f);
  }
  for (const [gname, divs] of groups) {
    if (divs[0].existing && divs[0].origName && !removedGroups.has(divs[0].origName)) {
      try { const orig = form.getFieldMaybe(divs[0].origName); if (orig) form.removeField(orig); } catch (e) { console.warn(e); }
      removedGroups.add(divs[0].origName);
    }
    const g = form.createRadioGroup(gname);
    if (divs.some(d => d.required)) g.enableRequired();
    for (const d of divs) {
      const r = boxToPdf(pages[d.page - 1], d);
      g.addOptionToPage(d.choice || 'Choice', docPages[d.page - 1], { x: r.x, y: r.y, width: r.width, height: r.height, borderColor: R.rgb(0.6, 0.6, 0.6), borderWidth: 1 });
    }
    const def = divs.find(d => d.checked);
    if (def) g.select(def.choice || 'Choice');
    g.updateAppearances();
  }
  // 3. everything else
  for (const f of fields) {
    if (f.type === 'radio') continue;
    if (f.existing && f.origName && f.origName !== f.name && !removedSingles.has(f.origName)) {
      try { const orig = form.getFieldMaybe(f.origName); if (orig) form.removeField(orig); } catch (e) { console.warn(e); }
      removedSingles.add(f.origName);
      f.existing = false;
    }
    if (f.existing) {
      const orig = form.getFieldMaybe(f.origName);
      if (orig) { updateExistingField(R, doc, orig, f, docPages, helv); continue; }
      f.existing = false;
    }
    createField(R, doc, form, f, docPages, helv);
  }
  return await doc.save();
}
async function savePdf() {
  if (!pdf) return;
  setStatus(els.status, 'Building the fillable PDF…');
  els.save.disabled = true;
  try {
    const bytes = await buildFormPdf();
    const base = splitName(file)[0];
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), base + '-form.pdf');
    // the saved file is now the working copy — later saves build on it
    pdfBytes = bytes;
    for (const f of fields) { f.existing = true; f.origName = f.name; f.origRect = boxToPdf(pages[f.page - 1], f); }
    deletedExisting = [];
    history = []; redoStack = []; syncUndo();
    const n = fields.length;
    setStatus(els.status, `Saved ${base}-form.pdf — ${n} field${n === 1 ? '' : 's'} in the form. Keep editing the same file, or open another PDF.`);
    drawAll(); renderProps();
  } catch (e) {
    console.error(e);
    setStatus(els.status, 'Could not save the form — ' + (e && e.message ? e.message : 'unknown error'));
  } finally { els.save.disabled = false; }
}

/* ---------------- wiring ---------------- */
setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) openPdf(f); else setStatus(els.status, 'Please choose a PDF file.', 'err'); });
els.pages.addEventListener('pointerdown', onPointerDown);
window.addEventListener('pointermove', onPointerMove);
window.addEventListener('pointerup', onPointerUp);
els.palette.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  if (mode === 'preview') return;
  setPlaceType(placeType === b.dataset.field ? null : b.dataset.field);
}));
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.save.addEventListener('click', savePdf);
els.previewBtn.addEventListener('click', togglePreview);
els.clear.addEventListener('click', clearPreview);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && placeType) { setPlaceType(null); return; }
  if (!pdf || mode === 'preview') return;
  const t = e.target;
  if (t.matches('input, textarea, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteField(sel); }
});
els.pages.addEventListener('click', e => {
  const btn = e.target.closest('[data-fb-action]');
  if (!btn) return;
  const action = btn.dataset.fbAction;
  if (action === 'print') window.print();
  else if (action === 'reset') clearPreview();
  else setStatus(els.status, `Button “${btn.dataset.fbLabel}” clicked (no action set).`);
});

/* test hooks */
window.__fbTest = { get fields() { return fields; }, get pages() { return pages; }, get mode() { return mode; } };
window.__fbLast = { saved: 0 };
