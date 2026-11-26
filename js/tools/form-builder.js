/* WebcamClicks — PDF Maker (raw PDF maker + Adobe "Prepare Form" style form builder).
 * Start from a blank page or open any PDF as the background, then build on
 * it: static text, images, rectangles, ellipses, lines, highlights and
 * freehand drawing, plus real AcroForm fields (text, checkbox, radio,
 * dropdown, date, signature, button). Add, duplicate and delete pages,
 * align and layer elements, preview the fillable form, then save — content
 * is drawn into the PDF and fields are written as real AcroForm fields
 * with pdf-lib. Existing AcroForm fields are read back and shown as fields.
 * Everything runs in the browser; the file never leaves the device. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadLib, loadPdfjs, formatBytes } from './common.js';

const els = {
  input: $('#fb-input'), drop: $('#fb-drop'), status: $('#fb-status'),
  editor: $('#fb-editor'), pages: $('#fb-pages'), toolbar: $('#fb-toolbar'),
  palette: $('#fb-palette'), paletteEl: $('#fb-palette-el'), props: $('#fb-props'), propsEmpty: $('#fb-props-empty'),
  undo: $('#fb-undo'), redo: $('#fb-redo'), save: $('#fb-save'),
  previewBtn: $('#fb-preview'), clear: $('#fb-clear'),
  imgInput: $('#fb-img-input'), blankA4: $('#fb-blank-a4'), blankLetter: $('#fb-blank-letter'),
  addPage: $('#fb-add-page'), dupPage: $('#fb-dup-page'), delPage: $('#fb-del-page'),
  zoom: $('#fb-zoom'),
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

/* ---------------- content element types (drawn into the PDF) ---------------- */
const ELEMENT_TYPES = {
  text:      { label: 'Text',      ico: 'T',   defW: 0.32, defH: 0.06 },
  image:     { label: 'Image',     ico: '🖼',  defW: 0.25, defH: null },
  rect:      { label: 'Rectangle', ico: '▭',   defW: 0.2,  defH: 0.12 },
  ellipse:   { label: 'Ellipse',   ico: '○',   defW: 0.2,  defH: 0.12 },
  line:      { label: 'Line',      ico: '╱',   defW: 0.2,  defH: 0.012 },
  highlight: { label: 'Highlight', ico: '🖍',  defW: 0.3,  defH: 0.032 },
  draw:      { label: 'Draw',      ico: '✎',   defW: 0.2,  defH: 0.12 },
};
const FONT_FAMILIES = { sans: 'Helvetica, Arial, sans-serif', serif: 'Georgia, "Times New Roman", serif', mono: '"Courier New", monospace' };
const PAGE_SIZES = { a4: { label: 'A4', w: 595.28, h: 841.89 }, letter: { label: 'Letter', w: 612, h: 792 } };

/* ---------------- state ---------------- */
let pdfBytes = null, pdf = null, file = null;
let pages = [];            // {n, wPt, hPt, rot, dispW, dispH, el, sheet, layer, canvas, pdfPage}
let fields = [];           // field model objects (AcroForm)
let elements = [];         // content element model objects (drawn into the PDF)
let deletedExisting = [];  // origNames of existing fields removed by the user
let sel = null;            // selected field OR element object
let history = [], redoStack = [];
let fid = 0, elid = 0;
let placeType = null;      // {src:'field'|'el', type} being placed, or null
let mode = 'edit';         // 'edit' | 'preview'
let drag = null;           // {kind:'place'|'move'|'resize'|'draw', item, sx, sy, ox, oy, ow, oh}
let counts = {};           // per-type counter for auto names
let existingCount = 0;     // fields read from the PDF
let zoom = 1;              // page display zoom (0.5–1.5)
let clipboard = null;      // copied item (field or element)
let pendingImage = null;   // {dataUrl, type, w, h} chosen for the Image tool

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* ---------------- history ---------------- */
function getState() { return JSON.stringify({ fields, elements, deletedExisting }); }
function applyState(s) {
  const o = JSON.parse(s);
  fields = o.fields; elements = o.elements || []; deletedExisting = o.deletedExisting || [];
  sel = [...fields, ...elements].find(g => sel && g.id === sel.id) || null;
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
async function buildPages() {
  els.pages.innerHTML = '';
  pages = [];
  for (let n = 1; n <= pdf.numPages; n++) {
    const page = await pdf.getPage(n);
    const vp = page.getViewport({ scale: 1 });
    const pg = { n, wPt: vp.width, hPt: vp.height, rot: page.rotate || 0, dispW: vp.width, dispH: vp.height, pdfPage: page };
    pg.el = document.createElement('div');
    pg.el.className = 'pe-page';
    pg.el.dataset.page = n;
    pg.el.innerHTML = `<div class="pe-pagebar"><span>Page ${n}</span><span class="fb-pageops"><button type="button" data-pageop="dup" data-page="${n}" title="Duplicate this page">⧉</button><button type="button" data-pageop="del" data-page="${n}" title="Delete this page">✕</button></span></div>
      <div class="pe-sheet" style="aspect-ratio:${pg.dispW}/${pg.dispH}"><canvas></canvas><div class="pe-layer fb-layer"></div></div>`;
    pg.sheet = pg.el.querySelector('.pe-sheet');
    pg.layer = pg.el.querySelector('.pe-layer');
    pg.canvas = pg.el.querySelector('canvas');
    els.pages.appendChild(pg.el);
    await renderPage(pg);
    pages.push(pg);
  }
  applyZoom();
}
/* Re-open the working bytes after a page operation, keeping the model
   items (fields + elements) and remapping their page numbers. */
async function reopenKeepingItems(newBytes, remap) {
  pdfBytes = newBytes;
  const pdfjs = await loadPdfjs();
  pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  const keepFields = fields.filter(f => remap(f.page) != null);
  const keepEls = elements.filter(g => remap(g.page) != null);
  for (const f of keepFields) f.page = remap(f.page);
  for (const g of keepEls) g.page = remap(g.page);
  fields = keepFields; elements = keepEls;
  if (sel && !fields.includes(sel) && !elements.includes(sel)) sel = null;
  await buildPages();
  drawAll(); renderProps();
}
async function openPdf(f) {
  file = f.name;
  pdfBytes = new Uint8Array(await f.arrayBuffer());
  const pdfjs = await loadPdfjs();
  try { pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise; } catch (e) { setStatus(els.status, 'Could not open that PDF.'); return; }
  pages = []; fields = []; elements = []; deletedExisting = []; sel = null;
  history = []; redoStack = []; fid = 0; elid = 0; counts = {}; existingCount = 0;
  mode = 'edit'; placeType = null; zoom = 1; els.zoom.value = '100'; syncMode();
  els.editor.hidden = false; syncUndo();
  await buildPages();
  existingCount = await loadExistingFields();
  drawAll(); renderProps(); syncUndo();
  const msg = existingCount
    ? `Opened ${file} — ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}, ${existingCount} existing field${existingCount > 1 ? 's' : ''} found. Click a field type, then drag a box on a page.`
    : `Opened ${file} — ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''}. Click a field type, then drag a box on a page to add it.`;
  setStatus(els.status, msg);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
async function renderPage(pg, scale = 2 * zoom) {
  const vp = pg.pdfPage.getViewport({ scale });
  pg.canvas.width = Math.round(vp.width); pg.canvas.height = Math.round(vp.height);
  await pg.pdfPage.render({ canvasContext: pg.canvas.getContext('2d'), viewport: vp }).promise;
}
function applyZoom() {
  for (const pg of pages) pg.el.style.width = zoom === 1 ? '' : (zoom * 100) + '%';
}
async function setZoom(z) {
  zoom = z;
  applyZoom();
  for (const pg of pages) await renderPage(pg);
}
/* Start a brand-new blank PDF — the "raw maker" starting point. */
async function startBlank(sizeKey) {
  const R = await loadLib('pdflib');
  const s = PAGE_SIZES[sizeKey] || PAGE_SIZES.a4;
  const doc = await R.PDFDocument.create();
  doc.addPage([s.w, s.h]);
  const bytes = await doc.save();
  file = `blank-${sizeKey}.pdf`;
  pdfBytes = bytes;
  const pdfjs = await loadPdfjs();
  pdf = await pdfjs.getDocument({ data: pdfBytes.slice() }).promise;
  pages = []; fields = []; elements = []; deletedExisting = []; sel = null;
  history = []; redoStack = []; fid = 0; elid = 0; counts = {}; existingCount = 0;
  mode = 'edit'; placeType = null; zoom = 1; els.zoom.value = '100'; syncMode();
  els.editor.hidden = false; syncUndo();
  await buildPages();
  drawAll(); renderProps();
  setStatus(els.status, `Blank ${s.label} page ready — add text, images, shapes and form fields, then Save PDF. Or drop a PDF above to use it as the background instead.`);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
/* ---------------- page operations ---------------- */
async function pageOp(kind, pageNum) {
  if (!pdf) return;
  const R = await loadLib('pdflib');
  const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
  const total = doc.getPageCount();
  if (kind === 'add') {
    const s = doc.getPage(0).getSize();
    doc.addPage([s.width, s.height]);
    const bytes = await doc.save();
    await reopenKeepingItems(bytes, p => p);
    setStatus(els.status, `Added a blank page — now ${total + 1} pages.`);
  } else if (kind === 'del') {
    if (total <= 1) { setStatus(els.status, 'A PDF needs at least one page.', 'err'); return; }
    doc.removePage(pageNum - 1);
    const bytes = await doc.save();
    await reopenKeepingItems(bytes, p => (p === pageNum ? null : (p > pageNum ? p - 1 : p)));
    setStatus(els.status, `Deleted page ${pageNum} — now ${total - 1} pages.`);
  } else if (kind === 'dup') {
    const [cp] = await doc.copyPages(doc, [pageNum - 1]);
    doc.insertPage(pageNum, cp);
    const bytes = await doc.save();
    // duplicate the model items on that page onto the new page (content
    // elements only — the copied page already carries the form widgets)
    const newEls = elements.filter(g => g.page === pageNum).map(g => ({ ...g, points: g.points ? g.points.map(pt => [...pt]) : undefined, id: `e${++elid}`, page: pageNum + 1 }));
    await reopenKeepingItems(bytes, p => (p > pageNum ? p + 1 : p));
    elements = [...elements, ...newEls];
    drawAll();
    setStatus(els.status, `Duplicated page ${pageNum} — now ${total + 1} pages.`);
  }
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
function newElement(kind, page, x, y, w, h) {
  const el = {
    id: `e${++elid}`, kind, page, x, y, w, h,
    text: 'Double-click to edit', family: 'sans', size: 16, color: '#111111',
    bold: false, italic: false, align: 'left',
    imgData: '', imgType: 'png',
    fill: '#ffffff', stroke: '#111111', strokeWidth: 2, opacity: 1,
    flip: false, points: [],
  };
  if (kind === 'text') { el.text = 'Type your text here'; }
  if (kind === 'highlight') { el.fill = '#ffeb3b'; el.stroke = '#ffeb3b'; el.strokeWidth = 0; el.opacity = 0.4; }
  if (kind === 'line') { el.fill = 'none'; }
  if (kind === 'image' && pendingImage) {
    el.imgData = pendingImage.dataUrl; el.imgType = pendingImage.type;
    const pg = pages[page - 1];
    const aspect = pendingImage.h / pendingImage.w;
    el.h = w * aspect * (pg.dispW / pg.dispH);
  }
  return el;
}
function isField(item) { return item && (item.id[0] === 'f'); }
function deleteField(f) {
  if (!f) return;
  snapshot();
  if (f.existing && f.origName) deletedExisting.push({ origName: f.origName, type: f.type });
  fields = fields.filter(g => g !== f);
  if (sel === f) sel = null;
  drawAll(); renderProps();
}
function deleteItem(item) {
  if (!item) return;
  if (isField(item)) { deleteField(item); return; }
  snapshot();
  elements = elements.filter(g => g !== item);
  if (sel === item) sel = null;
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
function elInner(el) {
  const style = [];
  if (el.kind === 'text') {
    style.push(`font-family:${FONT_FAMILIES[el.family] || FONT_FAMILIES.sans}`);
    style.push(`font-size:${Math.max(6, el.size * 2)}px`);
    style.push(`color:${el.color}`);
    style.push(`font-weight:${el.bold ? 700 : 400}`);
    style.push(`font-style:${el.italic ? 'italic' : 'normal'}`);
    style.push(`text-align:${el.align}`);
    return `<span class="fb-el-text" style="${style.join(';')}">${esc(el.text).replace(/\n/g, '<br>')}</span>`;
  }
  if (el.kind === 'image') {
    return el.imgData ? `<img class="fb-el-img" src="${el.imgData}" alt="">` : '<span class="fb-el-empty">image</span>';
  }
  if (el.kind === 'rect' || el.kind === 'ellipse' || el.kind === 'highlight') {
    const r = el.kind === 'ellipse' ? 'border-radius:50%;' : '';
    style.push(`background:${el.fill === 'none' ? 'transparent' : el.fill}`);
    style.push(`border:${Math.max(0, el.strokeWidth)}px solid ${el.stroke}`);
    style.push(`opacity:${el.opacity}`);
    return `<span class="fb-el-shape" style="${style.join(';')}${r}"></span>`;
  }
  if (el.kind === 'line') {
    const x2 = el.flip ? 0 : 100, y2 = el.flip ? 100 : 100;
    const x1 = el.flip ? 100 : 0, y1 = 0;
    return `<svg class="fb-el-line" viewBox="0 0 100 100" preserveAspectRatio="none"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${el.stroke}" stroke-width="${Math.max(1, el.strokeWidth * 4)}" stroke-linecap="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  if (el.kind === 'draw') {
    if (!el.points.length) return '';
    const pts = el.points.map(([u, v]) => `${((u - el.x) / el.w * 100).toFixed(1)},${((v - el.y) / el.h * 100).toFixed(1)}`).join(' ');
    return `<svg class="fb-el-draw" viewBox="0 0 100 100" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${el.stroke}" stroke-width="${Math.max(1, el.strokeWidth * 4)}" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/></svg>`;
  }
  return '';
}
function drawAll() {
  for (const pg of pages) {
    pg.layer.innerHTML = '';
    for (const el of elements.filter(g => g.page === pg.n)) {
      const d = document.createElement('div');
      d.className = `fb-el fb-el-${el.kind}${el === sel ? ' sel' : ''}`;
      d.dataset.id = el.id;
      Object.assign(d.style, { left: (el.x * 100) + '%', top: (el.y * 100) + '%', width: (el.w * 100) + '%', height: (el.h * 100) + '%' });
      d.innerHTML = elInner(el);
      if (mode === 'edit' && el === sel) {
        d.insertAdjacentHTML('beforeend', '<span class="pe-handle" data-h="se"></span><button class="pe-x" data-x aria-label="Delete element">✕</button>');
      }
      pg.layer.appendChild(d);
    }
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
function defaultSize(pg, type, src = 'field') {
  if (src === 'el') {
    const t = ELEMENT_TYPES[type];
    const w = t.defW;
    const h = t.defH ?? (t.defW * pg.dispW / pg.dispH);
    return { w, h };
  }
  const t = FIELD_TYPES[type];
  const w = t.defW;
  const h = t.defH ?? (t.defW * pg.dispW / pg.dispH);
  return { w, h };
}
function startPlace(e, hit) {
  snapshot();
  if (placeType.src === 'el' && placeType.type === 'draw') {
    const el = newElement('draw', hit.pg.n, hit.u, hit.v, 0.001, 0.001);
    el.points = [[hit.u, hit.v]];
    elements.push(el);
    sel = el;
    drag = { kind: 'draw', item: el, sx: hit.u, sy: hit.v };
    drawAll(); renderProps();
    setStatus(els.status, 'Drawing — drag to draw, release to finish. Press Esc when done.');
    return;
  }
  if (placeType.src === 'el') {
    const t = ELEMENT_TYPES[placeType.type];
    const el = newElement(placeType.type, hit.pg.n, hit.u, hit.v, 0.001, 0.001);
    elements.push(el);
    sel = el;
    drag = { kind: 'place', item: el, sx: hit.u, sy: hit.v };
    drawAll(); renderProps();
    setStatus(els.status, `${t.label} — drag to size it, or just click for a standard size. Press Esc when done.`);
    return;
  }
  const t = FIELD_TYPES[placeType.type];
  const f = newField(placeType.type, hit.pg.n, hit.u, hit.v, 0.001, 0.001);
  fields.push(f);
  sel = f;
  drag = { kind: 'place', item: f, sx: hit.u, sy: hit.v };
  drawAll(); renderProps();
  setStatus(els.status, `${t.label} — drag to size it, or just click for a standard size. Press Esc when done.`);
}
function findItem(id) {
  return fields.find(g => g.id === id) || elements.find(g => g.id === id) || null;
}
function onPointerDown(e) {
  if (!pdf) return;
  const hit = pageFromEvent(e);
  if (!hit) return;
  if (mode === 'preview') return; // controls handle themselves
  if (e.button !== 0) return;
  if (placeType) { startPlace(e, hit); return; }
  const fd = e.target.closest('.fb-field, .fb-el');
  if (e.target.closest('[data-x]')) { const item = fd && findItem(fd.dataset.id); deleteItem(item); return; }
  if (fd) {
    const item = findItem(fd.dataset.id);
    if (!item) return;
    if (sel !== item) { sel = item; renderProps(); drawAll(); }
    snapshot();
    const h = e.target.closest('[data-h]');
    drag = { kind: h ? 'resize' : 'move', item, sx: hit.u, sy: hit.v, ox: item.x, oy: item.y, ow: item.w, oh: item.h };
    e.preventDefault();
    return;
  }
  if (sel) { sel = null; renderProps(); drawAll(); }
}
function onPointerMove(e) {
  if (!drag) return;
  const hit = pageFromEvent(e);
  if (!hit || hit.pg.n !== drag.item.page) return;
  const item = drag.item;
  if (drag.kind === 'draw') {
    item.points.push([hit.u, hit.v]);
    const xs = item.points.map(p => p[0]), ys = item.points.map(p => p[1]);
    item.x = Math.min(...xs); item.y = Math.min(...ys);
    item.w = Math.max(0.004, Math.max(...xs) - item.x);
    item.h = Math.max(0.004, Math.max(...ys) - item.y);
    drawAll();
    return;
  }
  if (drag.kind === 'place') {
    item.x = Math.min(drag.sx, hit.u); item.y = Math.min(drag.sy, hit.v);
    item.w = Math.max(0.008, Math.abs(hit.u - drag.sx));
    item.h = Math.max(0.008, Math.abs(hit.v - drag.sy));
  } else if (drag.kind === 'move') {
    item.x = Math.min(1 - item.w, Math.max(0, drag.ox + (hit.u - drag.sx)));
    item.y = Math.min(1 - item.h, Math.max(0, drag.oy + (hit.v - drag.sy)));
  } else {
    item.w = Math.max(0.008, Math.min(1 - item.x, drag.ow + (hit.u - drag.sx)));
    item.h = Math.max(0.008, Math.min(1 - item.y, drag.oh + (hit.v - drag.sy)));
  }
  drawAll();
}
function onPointerUp(e) {
  if (!drag) return;
  const { item, kind } = drag; drag = null;
  if (kind === 'draw') {
    if (item.points.length < 3 || (item.w < 0.01 && item.h < 0.01)) {
      elements = elements.filter(g => g !== item);
      if (sel === item) sel = null;
    }
    drawAll(); renderProps();
    return;
  }
  if (kind === 'place') {
    if (item.w < 0.01 || item.h < 0.01) {
      const pg = pages[item.page - 1];
      if (isField(item)) {
        const { w, h } = defaultSize(pg, item.type, 'field');
        item.w = w; item.h = h;
      } else {
        const { w, h } = defaultSize(pg, item.kind, 'el');
        item.w = w; item.h = h;
        if (item.kind === 'image' && pendingImage) {
          item.h = w * (pendingImage.h / pendingImage.w) * (pg.dispW / pg.dispH);
        }
      }
      item.x = Math.min(1 - item.w, Math.max(0, item.x)); item.y = Math.min(1 - item.h, Math.max(0, item.y));
    }
    drawAll(); renderProps();
    const label = isField(item) ? FIELD_TYPES[item.type].label : ELEMENT_TYPES[item.kind].label;
    const nm = isField(item) ? ` “${item.name}”` : '';
    setStatus(els.status, `${label}${nm} placed — edit it in the properties panel, or place another.`);
  } else if (kind === 'move' || kind === 'resize') {
    drawAll();
  }
}

/* ---------------- properties panel ---------------- */
function itemOpsHtml(item) {
  return `<div class="fb-ops">
    <button type="button" data-op="dup" title="Duplicate (Ctrl+D)">⧉ Duplicate</button>
    <button type="button" data-op="align-l" title="Align to the left edge">⇤ Left</button>
    <button type="button" data-op="align-c" title="Centre on the page">↔ Centre</button>
    <button type="button" data-op="align-r" title="Align to the right edge">⇥ Right</button>
    <button type="button" data-op="fwd" title="Bring forward">↑ Forward</button>
    <button type="button" data-op="back" title="Send backward">↓ Backward</button>
  </div>`;
}
function renderElementProps(el) {
  const panel = els.props;
  let per = '';
  if (el.kind === 'text') {
    per = `<label class="fb-prop">Text<textarea data-prop="text" rows="4">${esc(el.text)}</textarea></label>
      <label class="fb-prop">Font<select data-prop="family">
        <option value="sans"${el.family === 'sans' ? ' selected' : ''}>Sans</option>
        <option value="serif"${el.family === 'serif' ? ' selected' : ''}>Serif</option>
        <option value="mono"${el.family === 'mono' ? ' selected' : ''}>Mono</option>
      </select></label>
      <label class="fb-prop">Font size (pt)<input type="number" data-prop="size" value="${el.size}" min="6" max="120" step="1"></label>
      <label class="fb-prop">Colour<input type="color" data-prop="color" value="${el.color}"></label>
      <label class="fb-check"><input type="checkbox" data-prop="bold" ${el.bold ? 'checked' : ''}> Bold</label>
      <label class="fb-check"><input type="checkbox" data-prop="italic" ${el.italic ? 'checked' : ''}> Italic</label>
      <label class="fb-prop">Align<select data-prop="align">
        <option value="left"${el.align === 'left' ? ' selected' : ''}>Left</option>
        <option value="center"${el.align === 'center' ? ' selected' : ''}>Centre</option>
        <option value="right"${el.align === 'right' ? ' selected' : ''}>Right</option>
      </select></label>`;
  } else if (el.kind === 'image') {
    per = `<button class="t-btn sm" type="button" data-act="replace-img">↻ Replace image…</button>
      <p class="fb-meta">PNG or JPG, placed at its own aspect ratio. Drag the corner to resize.</p>`;
  } else if (el.kind === 'rect' || el.kind === 'ellipse' || el.kind === 'highlight') {
    per = `<label class="fb-prop">Fill colour<input type="color" data-prop="fill" value="${el.fill === 'none' ? '#ffffff' : el.fill}"></label>
      <label class="fb-check"><input type="checkbox" data-prop="noFill" ${el.fill === 'none' ? 'checked' : ''}> No fill (outline only)</label>
      <label class="fb-prop">Outline colour<input type="color" data-prop="stroke" value="${el.stroke}"></label>
      <label class="fb-prop">Outline width (pt)<input type="number" data-prop="strokeWidth" value="${el.strokeWidth}" min="0" max="20" step="0.5"></label>
      <label class="fb-prop">Opacity<input type="range" data-prop="opacity" value="${el.opacity}" min="0.1" max="1" step="0.05"></label>`;
  } else if (el.kind === 'line') {
    per = `<label class="fb-prop">Colour<input type="color" data-prop="stroke" value="${el.stroke}"></label>
      <label class="fb-prop">Width (pt)<input type="number" data-prop="strokeWidth" value="${el.strokeWidth}" min="0.5" max="20" step="0.5"></label>
      <label class="fb-check"><input type="checkbox" data-prop="flip" ${el.flip ? 'checked' : ''}> Diagonal the other way</label>`;
  } else if (el.kind === 'draw') {
    per = `<label class="fb-prop">Colour<input type="color" data-prop="stroke" value="${el.stroke}"></label>
      <label class="fb-prop">Width (pt)<input type="number" data-prop="strokeWidth" value="${el.strokeWidth}" min="0.5" max="20" step="0.5"></label>`;
  }
  panel.innerHTML = `
    <h3>${ELEMENT_TYPES[el.kind].label}</h3>
    ${per}
    ${itemOpsHtml(el)}
    <p class="fb-meta">Page ${el.page} · Added content (drawn into the PDF on save)</p>
    <button class="btn btn-danger" data-del>Delete</button>`;
  panel.querySelectorAll('[data-prop]').forEach(c => c.addEventListener('change', onPropChange));
  panel.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => itemOp(b.dataset.op)));
  panel.querySelector('[data-del]').addEventListener('click', () => deleteItem(el));
  const rep = panel.querySelector('[data-act="replace-img"]');
  if (rep) rep.addEventListener('click', () => { els.imgInput.dataset.replace = '1'; els.imgInput.click(); });
}
function renderProps() {
  const panel = els.props;
  if (!sel) {
    panel.innerHTML = '';
    els.propsEmpty.classList.remove('hidden');
    return;
  }
  els.propsEmpty.classList.add('hidden');
  if (!isField(sel)) { renderElementProps(sel); return; }
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
    ${itemOpsHtml(f)}
    <p class="fb-meta">Page ${f.page} · ${f.existing ? 'Existing field' : 'New field'}${f.existing && f.origName !== f.name ? ' · renamed' : ''}</p>
    <button class="btn btn-danger" data-del>Delete field</button>`;
  panel.querySelectorAll('[data-prop]').forEach(c => c.addEventListener('change', onPropChange));
  panel.querySelectorAll('[data-op]').forEach(b => b.addEventListener('click', () => itemOp(b.dataset.op)));
  panel.querySelector('[data-del]').addEventListener('click', () => deleteField(f));
}
function uniqueName(v, exclude) {
  let name = v, i = 2;
  const taken = new Set(fields.filter(g => !exclude.includes(g)).map(g => g.name));
  while (taken.has(name)) name = v + ' ' + (i++);
  return name;
}
function onPropChange(e) {
  const item = sel; if (!item) return;
  const c = e.target, k = c.dataset.prop;
  if (!isField(item)) {
    // content element props
    snapshot();
    if (k === 'text') item.text = c.value;
    else if (k === 'family') item.family = c.value;
    else if (k === 'size') item.size = Math.min(120, Math.max(6, Number(c.value) || 16));
    else if (k === 'color' || k === 'fill' || k === 'stroke') item[k] = c.value;
    else if (k === 'noFill') item.fill = c.checked ? 'none' : '#ffffff';
    else if (k === 'strokeWidth') item.strokeWidth = Math.min(20, Math.max(0, Number(c.value) || 0));
    else if (k === 'opacity') item.opacity = Number(c.value);
    else if (k === 'align') item.align = c.value;
    else if (k === 'bold' || k === 'italic' || k === 'flip') item[k] = c.checked;
    drawAll();
    return;
  }
  const f = item;
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

/* ---------------- item operations: duplicate, copy/paste, align, layer ---------------- */
function cloneItem(item) {
  if (isField(item)) {
    const c = { ...item, id: `f${++fid}`, existing: false, origName: '', origRect: null };
    if (item.type === 'radio') { c.name = uniqueName(item.name, [item]); c.group = c.name; }
    else c.name = uniqueName(item.name, [item]);
    return c;
  }
  return { ...item, id: `e${++elid}`, points: item.points ? item.points.map(p => [...p]) : undefined };
}
function duplicateItem(item) {
  if (!item) return;
  snapshot();
  const c = cloneItem(item);
  c.x = Math.min(1 - c.w, c.x + 0.02); c.y = Math.min(1 - c.h, c.y + 0.02);
  if (isField(c)) fields.push(c); else elements.push(c);
  sel = c;
  drawAll(); renderProps();
}
function copyItem(item) {
  if (!item) return;
  clipboard = JSON.parse(JSON.stringify(item));
  setStatus(els.status, 'Copied — paste with Ctrl+V.');
}
function pasteItem() {
  if (!clipboard || !pdf) return;
  snapshot();
  const c = cloneItem(clipboard);
  c.page = sel ? sel.page : (pages.length ? pages[pages.length - 1].n : 1);
  c.x = Math.min(1 - c.w, c.x + 0.03); c.y = Math.min(1 - c.h, c.y + 0.03);
  if (isField(c)) fields.push(c); else elements.push(c);
  sel = c;
  drawAll(); renderProps();
}
function itemOp(op) {
  const item = sel; if (!item) return;
  if (op === 'dup') { duplicateItem(item); return; }
  snapshot();
  const arr = isField(item) ? fields : elements;
  if (op === 'align-l') item.x = 0;
  else if (op === 'align-c') item.x = Math.max(0, (1 - item.w) / 2);
  else if (op === 'align-r') item.x = Math.max(0, 1 - item.w);
  else if (op === 'fwd') {
    const i = arr.indexOf(item);
    if (i >= 0 && i < arr.length - 1) { arr.splice(i, 1); arr.splice(i + 1, 0, item); }
  } else if (op === 'back') {
    const i = arr.indexOf(item);
    if (i > 0) { arr.splice(i, 1); arr.splice(i - 1, 0, item); }
  }
  drawAll();
}

/* ---------------- palette & mode ---------------- */
function setPlaceType(pt) {
  placeType = pt;
  els.palette.querySelectorAll('button').forEach(b => {
    const on = pt && pt.src === 'field' && b.dataset.field === pt.type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  els.paletteEl.querySelectorAll('button').forEach(b => {
    const on = pt && pt.src === 'el' && b.dataset.el === pt.type;
    b.classList.toggle('active', on);
    b.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  els.pages.dataset.placing = pt ? pt.type : '';
  if (pt) {
    const label = pt.src === 'el' ? ELEMENT_TYPES[pt.type].label : FIELD_TYPES[pt.type].label;
    setStatus(els.status, `${label} — drag a box on a page to place it. Esc to stop.`);
  }
}
function syncMode() {
  els.previewBtn.textContent = mode === 'preview' ? '✎ Edit fields' : '▶ Preview form';
  els.previewBtn.setAttribute('aria-pressed', mode === 'preview' ? 'true' : 'false');
  els.palette.querySelectorAll('button').forEach(b => b.disabled = mode === 'preview');
  els.paletteEl.querySelectorAll('button').forEach(b => b.disabled = mode === 'preview');
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
/* ---------------- saving: content elements ---------------- */
function hexToRgb(R, hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
  if (!m) return R.rgb(0, 0, 0);
  const n = parseInt(m[1], 16);
  return R.rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255);
}
function wrapLines(text, font, size, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const test = line ? line + word : word;
      if (font.widthOfTextAtSize(test, size) <= maxW || !line) line = test;
      else { out.push(line.trimEnd()); line = word.trimStart(); }
    }
    out.push(line);
  }
  return out;
}
const LATIN_OK = /^[\u0020-\u007E\u00A0-\u00FF\u2013\u2014\u2018\u2019\u201C\u201D\u2026\u20AC]*$/;
function rasterText(el, boxWpt, boxHpt) {
  // render text to a canvas (any script, any style) and return a PNG data URL
  const scale = 3;
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const css = FONT_FAMILIES[el.family] || FONT_FAMILIES.sans;
  const font = `${el.italic ? 'italic ' : ''}${el.bold ? 700 : 400} ${el.size * scale}px ${css}`;
  const lh = el.size * scale * 1.25;
  // wrap by measuring
  g.font = font;
  const maxW = boxWpt * scale;
  const lines = [];
  for (const para of String(el.text).split('\n')) {
    let line = '';
    for (const word of para.split(/(\s+)/)) {
      if (!word) continue;
      const test = line ? line + word : word;
      if (g.measureText(test).width <= maxW || !line) line = test;
      else { lines.push(line.trimEnd()); line = word.trimStart(); }
    }
    lines.push(line);
  }
  c.width = Math.max(2, Math.ceil(boxWpt * scale));
  c.height = Math.max(2, Math.ceil(Math.min(lines.length * lh, boxHpt * scale)));
  g.font = font; g.fillStyle = el.color; g.textBaseline = 'top';
  lines.forEach((l, i) => {
    if (i * lh >= c.height) return;
    let x = 0;
    const w = g.measureText(l).width;
    if (el.align === 'center') x = (c.width - w) / 2;
    else if (el.align === 'right') x = c.width - w;
    g.fillText(l, x, i * lh);
  });
  return { url: c.toDataURL('image/png'), wPt: c.width / scale, hPt: c.height / scale };
}
function dataUrlBytes(url) {
  const b64 = url.split(',')[1] || '';
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
async function drawElements(R, doc, helv) {
  const STD = {
    sans: [R.StandardFonts.Helvetica, R.StandardFonts.HelveticaBold, R.StandardFonts.HelveticaOblique, R.StandardFonts.HelveticaBoldOblique],
    serif: [R.StandardFonts.TimesRoman, R.StandardFonts.TimesRomanBold, R.StandardFonts.TimesRomanItalic, R.StandardFonts.TimesRomanBoldItalic],
    mono: [R.StandardFonts.Courier, R.StandardFonts.CourierBold, R.StandardFonts.CourierOblique, R.StandardFonts.CourierBoldOblique],
  };
  const docPages = doc.getPages();
  for (const el of elements) {
    const P = docPages[el.page - 1];
    if (!P) continue;
    const pg = pages[el.page - 1];
    const r = boxToPdf(pg, el);
    try {
      if (el.kind === 'text') {
        const fam = STD[el.family] || STD.sans;
        const fontName = fam[(el.bold ? 1 : 0) + (el.italic ? 2 : 0)];
        if (LATIN_OK.test(el.text)) {
          const font = await doc.embedFont(fontName);
          const color = hexToRgb(R, el.color);
          const lines = wrapLines(el.text, font, el.size, r.width);
          const lh = el.size * 1.25;
          lines.forEach((line, i) => {
            const w = font.widthOfTextAtSize(line, el.size);
            let x = r.x;
            if (el.align === 'center') x = r.x + (r.width - w) / 2;
            else if (el.align === 'right') x = r.x + r.width - w;
            P.drawText(line, { x, y: r.y + r.height - el.size - i * lh, size: el.size, font, color });
          });
        } else {
          const im = rasterText(el, r.width, r.height);
          const img = await doc.embedPng(dataUrlBytes(im.url));
          P.drawImage(img, { x: r.x, y: r.y + r.height - im.hPt, width: im.wPt, height: im.hPt });
        }
      } else if (el.kind === 'image' && el.imgData) {
        const img = el.imgType === 'jpg' ? await doc.embedJpg(dataUrlBytes(el.imgData)) : await doc.embedPng(dataUrlBytes(el.imgData));
        P.drawImage(img, { x: r.x, y: r.y, width: r.width, height: r.height });
      } else if (el.kind === 'rect' || el.kind === 'highlight') {
        P.drawRectangle({
          x: r.x, y: r.y, width: r.width, height: r.height,
          color: el.fill === 'none' ? undefined : hexToRgb(R, el.fill),
          borderColor: el.strokeWidth > 0 ? hexToRgb(R, el.stroke) : undefined,
          borderWidth: el.strokeWidth, opacity: el.opacity,
        });
      } else if (el.kind === 'ellipse') {
        P.drawEllipse({
          x: r.x + r.width / 2, y: r.y + r.height / 2, xScale: r.width / 2, yScale: r.height / 2,
          color: el.fill === 'none' ? undefined : hexToRgb(R, el.fill),
          borderColor: el.strokeWidth > 0 ? hexToRgb(R, el.stroke) : undefined,
          borderWidth: el.strokeWidth, opacity: el.opacity,
        });
      } else if (el.kind === 'line') {
        const x1 = el.flip ? r.x + r.width : r.x, y1 = el.flip ? r.y : r.y + r.height;
        const x2 = el.flip ? r.x : r.x + r.width, y2 = el.flip ? r.y + r.height : r.y;
        P.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness: el.strokeWidth, color: hexToRgb(R, el.stroke), opacity: el.opacity });
      } else if (el.kind === 'draw' && el.points.length > 1) {
        const scale = 3;
        const c = document.createElement('canvas'), g = c.getContext('2d');
        c.width = Math.max(2, Math.ceil(r.width * scale));
        c.height = Math.max(2, Math.ceil(r.height * scale));
        g.strokeStyle = el.stroke; g.lineWidth = Math.max(1, el.strokeWidth * scale);
        g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath();
        el.points.forEach(([u, v], i) => {
          const x = (u - el.x) / el.w * c.width, y = (v - el.y) / el.h * c.height;
          if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
        });
        g.stroke();
        const img = await doc.embedPng(dataUrlBytes(c.toDataURL('image/png')));
        P.drawImage(img, { x: r.x, y: r.y, width: r.width, height: r.height });
      }
    } catch (e) { console.warn('draw element failed', el.kind, e); }
  }
}
async function buildFormPdf() {
  const R = await loadLib('pdflib');
  const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
  const form = doc.getForm();
  const helv = await doc.embedFont(R.StandardFonts.Helvetica);
  const docPages = doc.getPages();
  const removedGroups = new Set(), removedSingles = new Set();

  // 0. content elements are drawn into the page content first (under fields)
  await drawElements(R, doc, helv);

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
    const nEl = elements.length;
    const n = fields.length;
    // content elements are now baked into the pages — clear them so a
    // second save does not draw them twice, then re-render from the bytes
    elements = [];
    await reopenKeepingItems(bytes, p => p);
    for (const f of fields) { f.existing = true; f.origName = f.name; f.origRect = boxToPdf(pages[f.page - 1], f); }
    deletedExisting = [];
    history = []; redoStack = []; syncUndo();
    setStatus(els.status, `Saved ${base}-form.pdf — ${n} field${n === 1 ? '' : 's'}${nEl ? ` and ${nEl} added element${nEl === 1 ? '' : 's'} baked in` : ''}. Keep editing the same file, or open another PDF.`);
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
  const pt = { src: 'field', type: b.dataset.field };
  setPlaceType(placeType && placeType.src === 'field' && placeType.type === pt.type ? null : pt);
}));
els.paletteEl.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
  if (mode === 'preview') return;
  const type = b.dataset.el;
  if (type === 'image') { els.imgInput.dataset.replace = ''; els.imgInput.click(); return; }
  const pt = { src: 'el', type };
  setPlaceType(placeType && placeType.src === 'el' && placeType.type === type ? null : pt);
}));
els.imgInput.addEventListener('change', async () => {
  const f = els.imgInput.files && els.imgInput.files[0];
  els.imgInput.value = '';
  if (!f) { els.imgInput.dataset.replace = ''; setPlaceType(null); return; }
  try {
    const dataUrl = await readImageFile(f);
    const replace = els.imgInput.dataset.replace === '1';
    els.imgInput.dataset.replace = '';
    if (replace && sel && !isField(sel) && sel.kind === 'image') {
      snapshot();
      sel.imgData = dataUrl.url; sel.imgType = dataUrl.type;
      drawAll();
      setStatus(els.status, 'Image replaced.');
      return;
    }
    pendingImage = dataUrl;
    setPlaceType({ src: 'el', type: 'image' });
    setStatus(els.status, 'Image ready — drag a box on a page to place it. Esc to stop.');
  } catch (e) {
    setStatus(els.status, 'Could not read that image.', 'err');
  }
});
/* read an image file, downscaling to at most 2000px on a side */
function readImageFile(f) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => {
      try {
        const max = 2000, k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        c.getContext('2d').drawImage(img, 0, 0, w, h);
        URL.revokeObjectURL(url);
        const isPng = /png$/i.test(f.type) || /\.png$/i.test(f.name);
        resolve({ dataUrl: c.toDataURL(isPng ? 'image/png' : 'image/jpeg', 0.92), type: isPng ? 'png' : 'jpg', w, h });
      } catch (e) { reject(e); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('bad image')); };
    img.src = url;
  });
}
els.blankA4.addEventListener('click', () => startBlank('a4'));
els.blankLetter.addEventListener('click', () => startBlank('letter'));
els.addPage.addEventListener('click', () => pageOp('add'));
els.dupPage.addEventListener('click', () => pageOp('dup', sel ? sel.page : pages.length));
els.delPage.addEventListener('click', () => pageOp('del', sel ? sel.page : pages.length));
els.zoom.addEventListener('change', () => setZoom(Number(els.zoom.value) / 100));
els.pages.addEventListener('click', (e) => {
  const op = e.target.closest('[data-pageop]');
  if (op) { e.stopPropagation(); pageOp(op.dataset.pageop, Number(op.dataset.page)); }
});
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
els.save.addEventListener('click', savePdf);
els.previewBtn.addEventListener('click', togglePreview);
els.clear.addEventListener('click', clearPreview);
window.addEventListener('keydown', e => {
  if (e.key === 'Escape' && placeType) { setPlaceType(null); pendingImage = null; return; }
  if (!pdf || mode === 'preview') return;
  const t = e.target;
  if (t.matches('input, textarea, select')) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
  if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'd' && sel) { e.preventDefault(); duplicateItem(sel); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel) { e.preventDefault(); copyItem(sel); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteItem(); return; }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteItem(sel); return; }
  if (sel && e.key.startsWith('Arrow')) {
    e.preventDefault();
    snapshot();
    const step = e.shiftKey ? 0.02 : 0.004;
    if (e.key === 'ArrowLeft') sel.x = Math.max(0, sel.x - step);
    if (e.key === 'ArrowRight') sel.x = Math.min(1 - sel.w, sel.x + step);
    if (e.key === 'ArrowUp') sel.y = Math.max(0, sel.y - step);
    if (e.key === 'ArrowDown') sel.y = Math.min(1 - sel.h, sel.y + step);
    drawAll();
  }
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
window.__fbTest = { get fields() { return fields; }, get elements() { return elements; }, get pages() { return pages; }, get mode() { return mode; }, get zoom() { return zoom; } };
window.__fbLast = { saved: 0 };
