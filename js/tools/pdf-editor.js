/* WebcamClicks — PDF editor (on-device).
   pdf.js renders pages; edits live as an overlay (text, drawing, highlight, white-out, boxes, images,
   signatures); on save, pdf-lib writes them into the original PDF. Latin text stays real, selectable text;
   other scripts are embedded as sharp images so every language works without font files. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadLib, loadPdfjs, formatBytes } from './common.js';
import { extractLines, sampleColors, removeShowText, removeImages, pageContent, setPageContent } from './pdf-text-edit.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), pages: $('#pe-pages'), tools: $('#pe-tools'), color: $('#pe-color'),
  size: $('#pe-size'), width: $('#pe-width'), font: $('#pe-font'), boldBtn: $('#pe-bold'), italicBtn: $('#pe-italic'), save: $('#pe-save'), undo: $('#pe-undo'), redo: $('#pe-redo'), imgInput: $('#pe-img'), sigModal: $('#pe-sig'),
  sigPad: $('#pe-sigpad'), sigType: $('#pe-sigtext'), sigUse: $('#pe-sig-use'), sigClear: $('#pe-sig-clear'), sigCancel: $('#pe-sig-cancel'),
  info: $('#pe-info'), editor: $('#pe-editor'), zoomOut: $('#pe-zoom-out'), zoomIn: $('#pe-zoom-in'), zoomLabel: $('#pe-zoom-label'),
  fit: $('#pe-fit'), findToggle: $('#pe-find-toggle'), find: $('#pe-find'), findInput: $('#pe-find-input'), findPrev: $('#pe-find-prev'),
  findNext: $('#pe-find-next'), findCount: $('#pe-find-count'), findClose: $('#pe-find-close'), side: $('#pe-side'),
  thumbs: $('#pe-thumbs'), backdrop: $('#pe-backdrop'), sideToggle: $('#pe-side-toggle'), sideClose: $('#pe-side-close'), pageInd: $('#pe-page-ind')
};

let pdfBytes = null, pdf = null, file = null;
let pages = [];          // { n, wPt, hPt, rot, el, layer, svg, deleted, addRot }
let anns = [];           // annotations (coordinates are fractions of the displayed page)
let tool = 'select', sel = null, history = [], redoStack = [], aid = 0, hasText = false, hasImages = false;
let zoom = 1, activePage = 1, findHits = [], findCur = -1, findQuery = '', findToken = 0, pageObs = null;

/** Embedded raster images on a page, as display fractions (from the operator list). */
async function detectImages(pg) {
  pg.images = [];
  if (pg.rot !== 0) return;
  try {
    const pdfjs = await loadPdfjs();
    const OPS = pdfjs.OPS;
    const list = await pg.page.getOperatorList();
    const vp = pg.page.getViewport({ scale: 1 });
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
    const mul6 = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];
    const corner = (x, y) => vp.convertToViewportPoint(x * ctm[0] + y * ctm[2] + ctm[4], x * ctm[1] + y * ctm[3] + ctm[5]);
    const push = () => {
      const ps = [corner(0, 0), corner(1, 0), corner(0, 1), corner(1, 1)];
      const us = ps.map((p) => p[0] / vp.width), vs = ps.map((p) => p[1] / vp.height);
      const u = Math.min(...us), v = Math.min(...vs), w = Math.max(...us) - u, h = Math.max(...vs) - v;
      if (w < 0.005 || h < 0.005) return;   // ignore hairline / degenerate draws
      pg.images.push({ u, v, w, h });
    };
    for (let i = 0; i < list.fnArray.length; i++) {
      const fn = list.fnArray[i], a = list.argsArray[i];
      if (fn === OPS.transform) ctm = mul6(a, ctm);   // cm left-multiplies the CTM (PDF spec), like removeShowText
      else if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject) push();
    }
    // de-duplicate identical boxes (the same image drawn twice at the same spot)
    pg.images = pg.images.filter((im, i) => !pg.images.slice(0, i).some((o) => Math.abs(o.u - im.u) < 0.002 && Math.abs(o.v - im.v) < 0.002 && Math.abs(o.w - im.w) < 0.002 && Math.abs(o.h - im.h) < 0.002));
  } catch (e) { console.warn('image detection skipped on page', pg.n, e); pg.images = []; }
}

/** Display box (fractions of the page) for a text line in PDF user space. */
function lineBox(pg, l) {
  const asc = Math.min(1, Math.max(0.7, l.ascent)), desc = Math.max(-0.35, Math.min(-0.15, l.descent));
  return { ...l, asc, desc, u: (l.x0 - pg.vx0) / pg.wPt, v: (pg.vy1 - (l.y + asc * l.size)) / pg.hPt, w: (l.x1 - l.x0) / pg.wPt, h: ((asc - desc) * l.size) / pg.hPt };
}
const ANN_HTML_TYPES = new Set(['text', 'whiteout', 'highlight', 'rect', 'image', 'edit']);
const CSS_FAMILY = { sans: 'Helvetica, Arial, "Liberation Sans", sans-serif', serif: '"Times New Roman", Times, "Liberation Serif", serif', mono: '"Courier New", Courier, monospace' };

/* ---------------------------------------------------------------- load & render */

async function openPdf(f) {
  file = f;
  setStatus(els.status, 'Opening PDF…');
  pdfBytes = new Uint8Array(await f.arrayBuffer());
  const pdfjs = await loadPdfjs();
  try { pdf = await pdfjs.getDocument({ data: pdfBytes.slice(), isEvalSupported: false, fontExtraProperties: true }).promise; }   // keeps real font names (bold / italic detection)
  catch (e) { setStatus(els.status, /password/i.test(e.message) ? 'This PDF is password-protected. Remove the password first, then edit it.' : 'This file could not be opened as a PDF.', 'err'); return; }
  anns = []; history = []; redoStack = []; sel = null; pages = [];
  updateHistoryButtons();
  els.pages.innerHTML = '';
  els.editor.hidden = false;
  els.info.textContent = `${f.name} · ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${formatBytes(f.size)}`;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const [x0, y0, x1, y1] = page.view;
    const pg = { n: i, wPt: x1 - x0, hPt: y1 - y0, vx0: x0, vy1: y1, rot: page.rotate % 360, dispW: vp1.width, dispH: vp1.height, deleted: false, addRot: 0, lines: [], images: [] };
    const wrap = document.createElement('div');
    wrap.className = 'pe-page'; wrap.dataset.page = i;
    wrap.innerHTML = `<div class="pe-pagebar"><span>Page ${i}</span><button type="button" data-pa="rot" title="Rotate page">⟳ Rotate</button><button type="button" data-pa="del" title="Delete page">🗑 Delete</button></div>
      <div class="pe-sheet" style="aspect-ratio:${vp1.width}/${vp1.height}"><canvas></canvas><svg class="pe-ink" viewBox="0 0 1000 ${Math.round(1000 * vp1.height / vp1.width)}" preserveAspectRatio="none"></svg><div class="pe-layer"></div></div>`;
    els.pages.appendChild(wrap);
    pg.el = wrap; pg.sheet = wrap.querySelector('.pe-sheet'); pg.layer = wrap.querySelector('.pe-layer'); pg.svg = wrap.querySelector('svg'); pg.page = page;
    pages.push(pg);
  }
  await renderVisible();
  // existing text, for "Edit text" (upright pages; fonts are known once the page has rendered)
  let editable = 0;
  for (const pg of pages) {
    if (pg.rot !== 0) continue;
    try { pg.lines = (await extractLines(pg.page)).map((l) => lineBox(pg, l)); editable += pg.lines.length; } catch (e) { console.warn(e); }
    await detectImages(pg);
  }
  hasText = editable > 0;
  hasImages = pages.some((p) => p.images.length > 0);
  setZoom(1, true);
  clearFind(true);
  activePage = 1; updatePageInd(); observePages(); buildThumbs();
  drawAll();
  setStatus(els.status, hasText ? `Pick a tool above. “Edit text” lets you change the existing text${hasImages ? ' and remove pictures' : ''}: click any line${hasImages ? ' or image' : ''}.` : hasImages ? 'Pick a tool above. “Edit text” lets you remove pictures: click any image.' : 'Pick a tool above, then click or drag on a page.');
  els.save.disabled = false;
}

async function renderPage(pg) {
  const w = pg.sheet.clientWidth || 800, dpr = Math.min(2, window.devicePixelRatio || 1);
  const scale = (w * dpr) / pg.dispW;
  if (pg.renderedScale && Math.abs(pg.renderedScale - scale) < 0.05) return;
  const vp = pg.page.getViewport({ scale });
  const c = pg.sheet.querySelector('canvas');
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  await pg.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
  pg.renderedScale = scale;
}
async function renderVisible() { for (const pg of pages) await renderPage(pg); drawAll(); }
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => pages.length && renderVisible(), 250); });

/* ---------------------------------------------------------------- annotations → DOM */

const pxPerPt = (pg) => pg.sheet.clientWidth / pg.dispW;

function drawAll() {
  for (const pg of pages) {
    pg.layer.innerHTML = '';
    pg.svg.innerHTML = '';
    pg.el.classList.toggle('deleted', pg.deleted);
    pg.sheet.style.transform = pg.addRot ? `rotate(${pg.addRot}deg) scale(${pg.addRot % 180 ? pg.dispH / pg.dispW : 1})` : '';
  }
  for (const a of anns) {
    const pg = pages[a.page - 1]; if (!pg) continue;
    if (a.type === 'ink') {
      const H = 1000 * pg.dispH / pg.dispW;
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', a.pts.map(([u, v], i) => `${i ? 'L' : 'M'}${(u * 1000).toFixed(1)} ${(v * H).toFixed(1)}`).join(' '));
      p.setAttribute('stroke', a.color); p.setAttribute('stroke-width', String(a.width * 1000 / pg.dispW)); p.setAttribute('fill', 'none');
      p.setAttribute('stroke-linecap', 'round'); p.setAttribute('stroke-linejoin', 'round'); p.dataset.id = a.id;
      if (a === sel) p.classList.add('sel');
      pg.svg.appendChild(p);
      continue;
    }
    const d = document.createElement('div');
    d.className = `pe-ann pe-${a.type}${a === sel ? ' sel' : ''}`; d.dataset.id = a.id;
    if (a.type === 'edit') {
      const px = pg.sheet.clientHeight * a.h;
      Object.assign(d.style, { left: `${a.x * 100}%`, top: `${a.y * 100}%`, minWidth: `${a.w * 100}%`, height: `${a.h * 100}%`, lineHeight: `${px}px`, fontSize: `${a.size * pxPerPt(pg)}px`,
        fontFamily: CSS_FAMILY[a.family] || CSS_FAMILY.sans, fontWeight: a.bold ? '700' : '400', fontStyle: a.italic ? 'italic' : 'normal', color: a.color, background: a.bg,
        boxShadow: `0 0 0 ${Math.max(1.5, a.size * pxPerPt(pg) * 0.14).toFixed(1)}px ${a.bg}` });   // hides descenders / antialiasing of the old text
      d.contentEditable = a === sel ? 'true' : 'false'; d.spellcheck = false;
      d.textContent = a.text;
      d.addEventListener('input', () => { a.text = d.innerText.replace(/\n+$/, ''); });
      pg.layer.appendChild(d);
      continue;
    }
    Object.assign(d.style, { left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: a.type === 'text' ? 'auto' : `${a.h * 100}%` });
    if (a.type === 'text') {
      d.contentEditable = a === sel ? 'true' : 'false';
      d.textContent = a.text;
      Object.assign(d.style, { fontSize: `${a.size * pxPerPt(pg)}px`, color: a.color, fontWeight: a.bold ? '700' : '400', fontFamily: CSS_FAMILY[a.family] || CSS_FAMILY.sans, fontStyle: a.italic ? 'italic' : 'normal' });
      d.addEventListener('input', () => { a.text = d.innerText; });
      d.addEventListener('blur', () => { if (!a.text.trim()) { anns = anns.filter((x) => x !== a); drawAll(); } });
    } else if (a.type === 'image') d.innerHTML = `<img src="${a.src}" alt="" draggable="false">`;
    else if (a.type === 'whiteout') d.style.background = a.color || '#ffffff';
    else if (a.type === 'highlight') d.style.background = a.color + '66';
    else if (a.type === 'rect') d.style.borderColor = a.color;
    if (a === sel) d.insertAdjacentHTML('beforeend', '<span class="pe-handle" data-h="se"></span><button type="button" class="pe-x" data-x aria-label="Delete">✕</button>');
    pg.layer.appendChild(d);
  }
  if (findHits.length) {
    for (let i = 0; i < findHits.length; i++) {
      const h = findHits[i], pg = pages[h.page - 1]; if (!pg) continue;
      const d = document.createElement('div');
      d.className = `pe-find-hit${i === findCur ? ' cur' : ''}`;
      Object.assign(d.style, { left: `${h.u * 100}%`, top: `${h.v * 100}%`, width: `${h.w * 100}%`, height: `${h.h * 100}%` });
      pg.layer.appendChild(d);
    }
  }
  if (tool === 'edittext') {
    for (const pg of pages) {
      if (pg.deleted || pg.addRot) continue;
      const done = new Set(anns.filter((a) => a.type === 'edit' && a.page === pg.n).map((a) => a.key));
      pg.lines.forEach((l, i) => {
        if (done.has(l.key)) return;
        const t = document.createElement('div');
        t.className = 'pe-tline'; t.dataset.line = i; t.title = 'Click to edit this text';
        Object.assign(t.style, { left: `${l.u * 100}%`, top: `${l.v * 100}%`, width: `${l.w * 100}%`, height: `${l.h * 100}%` });
        pg.layer.appendChild(t);
      });
      (pg.images || []).forEach((im, i) => {
        if (anns.some((a) => a.type === 'whiteout' && a.img && a.page === pg.n && Math.abs(a.x - im.u) < 0.005 && Math.abs(a.y - im.v) < 0.005)) return;   // already removed
        const t = document.createElement('div');
        t.className = 'pe-timg'; t.dataset.img = i; t.title = 'Click to remove this image';
        Object.assign(t.style, { left: `${im.u * 100}%`, top: `${im.v * 100}%`, width: `${im.w * 100}%`, height: `${im.h * 100}%` });
        pg.layer.appendChild(t);
      });
    }
  }
  syncThumbs();
}

/** Turn an existing line of PDF text into an editable box that matches its font, size and colours. */
function startEdit(pg, line, ev) {
  if (!line) return;
  snapshot();
  const c = pg.sheet.querySelector('canvas');
  const { bg, color, uniform } = sampleColors(c, { x: line.u * c.width, y: line.v * c.height, w: line.w * c.width, h: line.h * c.height });
  const a = { id: `a${++aid}`, type: 'edit', page: pg.n, key: line.key, x: line.u, y: line.v, w: line.w, h: line.h, text: line.str, orig: line.str,
    size: +line.size.toFixed(2), color, bg, uniform, family: line.family, bold: line.bold, italic: line.italic,
    base: { x0: line.x0, x1: line.x1, y: line.y, size: line.size, asc: line.asc, desc: line.desc } };
  anns.push(a); sel = a; drawAll();
  syncProps(a);
  const el = pg.layer.querySelector(`[data-id="${a.id}"]`);
  if (!el) return;
  el.contentEditable = 'true'; el.focus();
  // put the caret where the user clicked
  const r = document.caretRangeFromPoint ? document.caretRangeFromPoint(ev.clientX, ev.clientY) : null;
  const s = document.getSelection();
  if (r && el.contains(r.startContainer)) { s.removeAllRanges(); s.addRange(r); } else { s.selectAllChildren(el); s.collapseToEnd(); }
  setStatus(els.status, 'Type to change the text. Font, size and colour are matched to the original. Click another line to edit it.');
}

/** Cover an embedded image with its background colour; saving takes the picture out of the page content when it can. */
function removeImageAt(pg, im) {
  if (!im) return;
  snapshot();
  const c = pg.sheet.querySelector('canvas');
  const { bg } = sampleColors(c, { x: im.u * c.width, y: im.v * c.height, w: im.w * c.width, h: im.h * c.height });
  anns.push({ id: `a${++aid}`, type: 'whiteout', img: true, page: pg.n, x: im.u, y: im.v, w: im.w, h: im.h, color: bg });
  drawAll();
  setStatus(els.status, 'Image removed. It disappears from the saved PDF — the picture itself is taken out where possible, otherwise it is covered with the page colour. Undo brings it back.');
}

/** Show the selected text's font, size and colour in the toolbar controls. */
function syncProps(a) {
  if (!a || (a.type !== 'text' && a.type !== 'edit')) return;
  els.size.value = Math.round(a.size); els.color.value = a.color;
  els.font.value = a.family || 'sans';
  els.boldBtn.setAttribute('aria-pressed', String(!!a.bold));
  els.italicBtn.setAttribute('aria-pressed', String(!!a.italic));
}

function getState() { return { anns, pages: pages.map((p) => [p.deleted, p.addRot]) }; }
function applyState(o) {
  anns = o.anns; o.pages.forEach(([d, r], i) => { pages[i].deleted = d; pages[i].addRot = r; });
  sel = null; drawAll();
}
function updateHistoryButtons() { els.undo.disabled = !history.length; els.redo.disabled = !redoStack.length; }
function snapshot() { history.push(JSON.stringify(getState())); if (history.length > 80) history.shift(); redoStack.length = 0; updateHistoryButtons(); }
function undo() {
  const s = history.pop(); if (!s) return;
  redoStack.push(JSON.stringify(getState()));
  applyState(JSON.parse(s)); updateHistoryButtons();
}
function redo() {
  const s = redoStack.pop(); if (!s) return;
  history.push(JSON.stringify(getState()));
  applyState(JSON.parse(s)); updateHistoryButtons();
}

/* ---------------------------------------------------------------- zoom */

const ZOOMS = [0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3];
function setZoom(z, silent) {
  zoom = Math.min(3, Math.max(0.5, z));
  els.pages.style.setProperty('--pe-zoom', zoom);
  els.zoomLabel.textContent = `${Math.round(zoom * 100)}%`;
  if (!silent) requestAnimationFrame(() => renderVisible());
}
function zoomStep(dir) {
  const cur = ZOOMS.reduce((best, z) => Math.abs(z - zoom) < Math.abs(best - zoom) ? z : best, 1);
  setZoom(ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, ZOOMS.indexOf(cur) + dir))]);
}
els.zoomOut.addEventListener('click', () => zoomStep(-1));
els.zoomIn.addEventListener('click', () => zoomStep(1));
els.zoomLabel.addEventListener('click', () => setZoom(1));
els.fit.addEventListener('click', () => setZoom(1));

/* ---------------------------------------------------------------- thumbnails + page indicator */

function updatePageInd() { els.pageInd.textContent = pdf ? `Page ${activePage} of ${pages.length}` : ''; }
function markActiveThumb() {
  els.thumbs.querySelectorAll('.pe-thumb').forEach((t) => t.classList.toggle('active', +t.dataset.page === activePage));
  const t = els.thumbs.querySelector(`.pe-thumb[data-page="${activePage}"]`);
  if (t) {
    const cr = els.side.getBoundingClientRect(), r = t.getBoundingClientRect();
    if (r.top < cr.top || r.bottom > cr.bottom) els.side.scrollTop += r.top - cr.top - 8;
  }
}
function syncThumbs() {
  els.thumbs.querySelectorAll('.pe-thumb').forEach((t) => {
    const pg = pages[+t.dataset.page - 1]; if (!pg) return;
    t.classList.toggle('deleted', !!pg.deleted);
    const img = t.querySelector('img');
    if (img) img.style.transform = pg.addRot ? `rotate(${pg.addRot}deg)` : '';
  });
}
function scrollToPage(n) {
  const pg = pages[n - 1]; if (!pg) return;
  activePage = n; updatePageInd(); markActiveThumb();
  pg.el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function buildThumbs() {
  els.thumbs.innerHTML = '';
  for (const pg of pages) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'pe-thumb'; b.dataset.page = pg.n;
    b.setAttribute('aria-label', `Go to page ${pg.n}`);
    b.innerHTML = `<span class="pe-thumb-img"></span><span class="pe-thumb-num">Page ${pg.n}</span>`;
    b.addEventListener('click', () => { scrollToPage(pg.n); closeSide(); });
    els.thumbs.appendChild(b);
    try {
      const scale = 140 / pg.dispW, vp = pg.page.getViewport({ scale });
      const c = document.createElement('canvas');
      c.width = Math.max(1, Math.floor(vp.width)); c.height = Math.max(1, Math.floor(vp.height));
      await pg.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const img = document.createElement('img');
      img.src = c.toDataURL('image/jpeg', 0.82); img.alt = `Page ${pg.n}`;
      b.querySelector('.pe-thumb-img').appendChild(img);
    } catch (e) { /* leave the placeholder */ }
    await new Promise((r) => setTimeout(r, 0)); // keep the UI responsive on long PDFs
  }
  markActiveThumb();
}
function observePages() {
  if (pageObs) pageObs.disconnect();
  pageObs = new IntersectionObserver((entries) => {
    for (const en of entries) {
      if (en.isIntersecting) {
        const n = +en.target.dataset.page;
        if (n !== activePage) { activePage = n; updatePageInd(); markActiveThumb(); }
      }
    }
  }, { rootMargin: '-35% 0px -55% 0px', threshold: 0 });
  pages.forEach((p) => pageObs.observe(p.el));
}

/* sidebar drawer (mobile) */
function openSide() { els.side.classList.add('open'); els.backdrop.hidden = false; els.sideToggle.setAttribute('aria-expanded', 'true'); }
function closeSide() { els.side.classList.remove('open'); els.backdrop.hidden = true; els.sideToggle.setAttribute('aria-expanded', 'false'); }
els.sideToggle.addEventListener('click', () => { els.side.classList.contains('open') ? closeSide() : openSide(); });
els.sideClose.addEventListener('click', closeSide);
els.backdrop.addEventListener('click', closeSide);

/* ---------------------------------------------------------------- in-PDF search */

async function getTextItems(pg) {
  if (pg.textItems) return pg.textItems;
  const tc = await pg.page.getTextContent();
  pg.textItems = tc.items.filter((it) => it.str && it.str.trim());
  return pg.textItems;
}
function updateFindCount() {
  els.findCount.textContent = findHits.length ? `${findCur + 1} of ${findHits.length}` : (findQuery ? 'No results' : '');
}
function goToHit(i, scroll = true) {
  if (!findHits.length) { findCur = -1; updateFindCount(); return; }
  findCur = ((i % findHits.length) + findHits.length) % findHits.length;
  if (scroll) { const pg = pages[findHits[findCur].page - 1]; pg && pg.el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  drawAll(); updateFindCount();
}
async function runFind(q) {
  const token = ++findToken;
  findQuery = q; findHits = []; findCur = -1;
  if (!q.trim() || !pdf) { drawAll(); updateFindCount(); return; }
  const needle = q.toLowerCase();
  for (const pg of pages) {
    if (token !== findToken) return; // a newer search started
    if (pg.deleted) continue;
    const items = await getTextItems(pg);
    const vp = pg.page.getViewport({ scale: 1 });
    for (const it of items) {
      const hay = it.str.toLowerCase();
      let idx = 0;
      while ((idx = hay.indexOf(needle, idx)) !== -1) {
        const [a, , , d, e, f] = it.transform;
        const w = it.width || 0, h = Math.abs(d) || Math.abs(a) || 12;
        const frac = it.str.length ? 1 / it.str.length : 0;
        const x0 = e + w * idx * frac, x1 = e + w * (idx + needle.length) * frac;
        const y0 = f - h * 0.25, y1 = f + h * 0.9;
        const [vx0, vy0] = vp.convertToViewportPoint(x0, y1);
        const [vx1, vy1] = vp.convertToViewportPoint(x1, y0);
        findHits.push({ page: pg.n, u: Math.min(vx0, vx1) / vp.width, v: Math.min(vy0, vy1) / vp.height, w: Math.abs(vx1 - vx0) / vp.width, h: Math.abs(vy1 - vy0) / vp.height });
        idx += Math.max(1, needle.length);
      }
    }
  }
  if (token !== findToken) return;
  if (findHits.length) goToHit(0);
  else { drawAll(); updateFindCount(); }
}
function clearFind(silent) {
  findToken++; findHits = []; findCur = -1; findQuery = '';
  els.findInput.value = ''; updateFindCount();
  if (!silent) drawAll();
}
function toggleFind(open) {
  const show = open !== undefined ? open : els.find.hidden;
  els.find.hidden = !show;
  els.findToggle.setAttribute('aria-pressed', String(show));
  if (show) els.findInput.focus();
  else clearFind();
}
let findT = 0;
els.findToggle.addEventListener('click', () => toggleFind());
els.findClose.addEventListener('click', () => toggleFind(false));
els.findInput.addEventListener('input', () => { clearTimeout(findT); findT = setTimeout(() => runFind(els.findInput.value), 200); });
els.findInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') { e.preventDefault(); goToHit(findCur + (e.shiftKey ? -1 : 1)); }
  else if (e.key === 'Escape') { e.preventDefault(); toggleFind(false); }
});
els.findNext.addEventListener('click', () => goToHit(findCur + 1));
els.findPrev.addEventListener('click', () => goToHit(findCur - 1));

/* ---------------------------------------------------------------- interaction */

function pageFromEvent(e) {
  const sheet = e.target.closest('.pe-sheet'); if (!sheet) return null;
  const pg = pages.find((p) => p.sheet === sheet); if (!pg || pg.deleted || pg.addRot) return null;
  const r = sheet.getBoundingClientRect();
  return { pg, u: (e.clientX - r.left) / r.width, v: (e.clientY - r.top) / r.height, r };
}

let drag = null;
els.pages.addEventListener('pointerdown', (e) => {
  const pa = e.target.closest('[data-pa]');
  if (pa) return;
  if (e.target.closest('[data-x]')) { snapshot(); anns = anns.filter((a) => a !== sel); sel = null; drawAll(); return; }
  const hit = pageFromEvent(e); if (!hit) return;
  const tl = e.target.closest('.pe-tline');
  if (tl && tool === 'edittext') { e.preventDefault(); startEdit(hit.pg, hit.pg.lines[+tl.dataset.line], e); return; }
  const ti = e.target.closest('.pe-timg');
  if (ti && tool === 'edittext') { e.preventDefault(); removeImageAt(hit.pg, (hit.pg.images || [])[+ti.dataset.img]); return; }
  const annEl = e.target.closest('.pe-ann, path[data-id]');
  if (tool === 'edittext' && !annEl) { sel = null; drawAll(); return; }
  if (tool === 'select' || (annEl && tool !== 'draw')) {
    if (!annEl) { sel = null; drawAll(); return; }
    const a = anns.find((x) => x.id === annEl.dataset.id); if (!a) return;
    if (sel !== a) { sel = a; drawAll(); }
    syncProps(a);
    if (a.type === 'text' && e.detail >= 2) { const el = hit.pg.layer.querySelector(`[data-id="${a.id}"]`); el && el.focus(); return; }
    if (a.type === 'edit') { const el = hit.pg.layer.querySelector(`[data-id="${a.id}"]`); if (el) { el.contentEditable = 'true'; setTimeout(() => el.focus(), 0); } return; }
    if (a.type === 'ink') return;
    snapshot();
    drag = { mode: e.target.closest('.pe-handle') ? 'resize' : 'move', a, u0: hit.u, v0: hit.v, x0: a.x, y0: a.y, w0: a.w, h0: a.h, r: hit.r };
    els.pages.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }
  e.preventDefault();
  snapshot();
  const color = els.color.value, pg = hit.pg;
  if (tool === 'text') {
    const a = { id: `a${++aid}`, type: 'text', page: pg.n, x: hit.u, y: hit.v - 0.01, w: 0.4, h: 0.04, text: 'Type here', size: +els.size.value, color, family: els.font.value, bold: els.boldBtn.getAttribute('aria-pressed') === 'true', italic: els.italicBtn.getAttribute('aria-pressed') === 'true' };
    anns.push(a); sel = a; drawAll(); setTool('select'); syncProps(a);
    const el = pg.layer.querySelector(`[data-id="${a.id}"]`); if (el) { el.contentEditable = 'true'; el.focus(); document.getSelection().selectAllChildren(el); }
    return;
  }
  if (tool === 'draw') {
    const a = { id: `a${++aid}`, type: 'ink', page: pg.n, pts: [[hit.u, hit.v]], color, width: +els.width.value };
    anns.push(a); drag = { mode: 'ink', a, r: hit.r };
  } else {   // whiteout / highlight / rect: drag a box
    const a = { id: `a${++aid}`, type: tool, page: pg.n, x: hit.u, y: hit.v, w: 0.001, h: 0.001, color: tool === 'whiteout' ? '#ffffff' : tool === 'highlight' ? '#ffd400' : color };
    anns.push(a); sel = a; drag = { mode: 'box', a, u0: hit.u, v0: hit.v, r: hit.r };
  }
  els.pages.setPointerCapture(e.pointerId);
  drawAll();
});
els.pages.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const u = Math.min(1, Math.max(0, (e.clientX - drag.r.left) / drag.r.width)), v = Math.min(1, Math.max(0, (e.clientY - drag.r.top) / drag.r.height));
  const a = drag.a;
  if (drag.mode === 'ink') { a.pts.push([u, v]); }
  else if (drag.mode === 'box') { a.x = Math.min(u, drag.u0); a.y = Math.min(v, drag.v0); a.w = Math.abs(u - drag.u0); a.h = Math.abs(v - drag.v0); }
  else if (drag.mode === 'move') { a.x = Math.min(1 - a.w, Math.max(0, drag.x0 + u - drag.u0)); a.y = Math.min(1 - (a.h || 0.02), Math.max(0, drag.y0 + v - drag.v0)); }
  else if (drag.mode === 'resize') {
    a.w = Math.max(0.02, drag.w0 + u - drag.u0);
    if (a.type === 'image' && a.ratio) a.h = a.w * a.ratio * (pages[a.page - 1].dispW / pages[a.page - 1].dispH);
    else a.h = Math.max(0.01, drag.h0 + v - drag.v0);
  }
  drawAll();
});
const endDrag = () => {
  if (!drag) return;
  const a = drag.a;
  if (drag.mode === 'box' && (a.w < 0.005 || a.h < 0.004)) { anns = anns.filter((x) => x !== a); sel = null; history.pop(); }
  if (drag.mode === 'ink' && a.pts.length < 2) a.pts.push([a.pts[0][0] + 0.001, a.pts[0][1]]);
  drag = null; drawAll();
};
els.pages.addEventListener('pointerup', endDrag);
els.pages.addEventListener('pointercancel', endDrag);

els.pages.addEventListener('click', (e) => {
  const pa = e.target.closest('[data-pa]'); if (!pa) return;
  const pg = pages[+pa.closest('.pe-page').dataset.page - 1];
  snapshot();
  if (pa.dataset.pa === 'del') {
    if (!pg.deleted && pages.filter((p) => !p.deleted).length <= 1) { history.pop(); setStatus(els.status, 'A PDF needs at least one page.', 'err'); return; }
    pg.deleted = !pg.deleted; pa.textContent = pg.deleted ? '↺ Restore' : '🗑 Delete';
  } else pg.addRot = (pg.addRot + 90) % 360;
  drawAll();
});

function setTool(t) {
  tool = t;
  els.tools.querySelectorAll('[data-tool]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === t)));
  els.pages.dataset.tool = t;
  if (t === 'edittext' && pdf && !hasText && !hasImages) setStatus(els.status, 'This PDF has no editable text layer (it is probably a scan). Use Image to text (OCR) to make it searchable first, or add new text with the Text tool.', 'err');
  if (pages.length) drawAll();
}
els.tools.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]'); if (!b) return;
  if (b.dataset.tool === 'image') { els.imgInput.click(); return; }
  if (b.dataset.tool === 'sign') { openSig(); return; }
  setTool(b.dataset.tool);
});
els.undo.addEventListener('click', undo);
els.redo.addEventListener('click', redo);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') { closeSide(); if (!els.find.hidden) toggleFind(false); }
  if (!pdf || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) { e.preventDefault(); undo(); }
  else if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.key.toLowerCase() === 'z' && e.shiftKey))) { e.preventDefault(); redo(); }
  else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') { e.preventDefault(); toggleFind(true); }
  else if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) { e.preventDefault(); zoomStep(1); }
  else if ((e.ctrlKey || e.metaKey) && e.key === '-') { e.preventDefault(); zoomStep(-1); }
  else if ((e.ctrlKey || e.metaKey) && e.key === '0') { e.preventDefault(); setZoom(1); }
  else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); snapshot(); anns = anns.filter((a) => a !== sel); sel = null; drawAll(); }
  else if (e.key === 'Escape') { sel = null; setTool('select'); drawAll(); }
});
[els.color, els.size, els.width].forEach((c) => c.addEventListener('input', () => {
  if (!sel) return;
  if (c === els.color && sel.type !== 'whiteout' && sel.type !== 'image') sel.color = els.color.value;
  if (c === els.size && (sel.type === 'text' || sel.type === 'edit')) sel.size = +els.size.value;
  if (c === els.width && sel.type === 'ink') sel.width = +els.width.value;
  drawAll();
}));
els.font.addEventListener('change', () => {
  if (!sel || (sel.type !== 'text' && sel.type !== 'edit')) return;
  sel.family = els.font.value; drawAll();
});
function toggleStyle(k) {
  const b = k === 'bold' ? els.boldBtn : els.italicBtn;
  const on = b.getAttribute('aria-pressed') !== 'true';
  b.setAttribute('aria-pressed', String(on));
  if (sel && (sel.type === 'text' || sel.type === 'edit')) { sel[k] = on; drawAll(); }
}
els.boldBtn.addEventListener('click', () => toggleStyle('bold'));
els.italicBtn.addEventListener('click', () => toggleStyle('italic'));

/* place an image or signature in the middle of the first visible page */
function visiblePage() {
  const mid = window.innerHeight / 2;
  return pages.filter((p) => !p.deleted).sort((a, b) => Math.abs(a.sheet.getBoundingClientRect().top + a.sheet.clientHeight / 2 - mid) - Math.abs(b.sheet.getBoundingClientRect().top + b.sheet.clientHeight / 2 - mid))[0];
}
function placeImage(src, iw, ih, w = 0.3) {
  const pg = visiblePage(); if (!pg) return;
  snapshot();
  const ratio = ih / iw, h = w * ratio * (pg.dispW / pg.dispH);
  const a = { id: `a${++aid}`, type: 'image', page: pg.n, x: (1 - w) / 2, y: Math.max(0, (1 - h) / 2), w, h, src, ratio };
  anns.push(a); sel = a; setTool('select'); drawAll();
}
els.imgInput.addEventListener('change', () => {
  const f = els.imgInput.files[0]; els.imgInput.value = ''; if (!f) return;
  const img = new Image(); img.onload = () => {
    const c = document.createElement('canvas'); const s = Math.min(1, 1600 / Math.max(img.width, img.height));
    c.width = Math.round(img.width * s); c.height = Math.round(img.height * s); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    placeImage(c.toDataURL(/png/.test(f.type) ? 'image/png' : 'image/jpeg', 0.9), c.width, c.height);
  };
  img.src = URL.createObjectURL(f);
});

/* ---------------------------------------------------------------- signature pad */
let sigDrawing = false, sigInk = false;
function openSig() { els.sigModal.hidden = false; clearSig(); }
function clearSig() { const c = els.sigPad, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height); sigInk = false; els.sigType.value = ''; }
els.sigPad.addEventListener('pointerdown', (e) => { sigDrawing = true; const g = els.sigPad.getContext('2d'), r = els.sigPad.getBoundingClientRect(); g.beginPath(); g.moveTo((e.clientX - r.left) * els.sigPad.width / r.width, (e.clientY - r.top) * els.sigPad.height / r.height); els.sigPad.setPointerCapture(e.pointerId); });
els.sigPad.addEventListener('pointermove', (e) => {
  if (!sigDrawing) return;
  const g = els.sigPad.getContext('2d'), r = els.sigPad.getBoundingClientRect();
  g.lineWidth = 5; g.lineCap = g.lineJoin = 'round'; g.strokeStyle = els.color.value === '#ffffff' ? '#0e0e12' : els.color.value;
  g.lineTo((e.clientX - r.left) * els.sigPad.width / r.width, (e.clientY - r.top) * els.sigPad.height / r.height); g.stroke(); sigInk = true;
});
els.sigPad.addEventListener('pointerup', () => { sigDrawing = false; });
els.sigType.addEventListener('input', () => {
  const c = els.sigPad, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.fillStyle = els.color.value === '#ffffff' ? '#0e0e12' : els.color.value; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = 'italic 96px "Segoe Script","Brush Script MT","Snell Roundhand",cursive'; g.fillText(els.sigType.value, c.width / 2, c.height / 2);
  sigInk = !!els.sigType.value.trim();
});
els.sigClear.addEventListener('click', clearSig);
els.sigCancel.addEventListener('click', () => { els.sigModal.hidden = true; });
els.sigUse.addEventListener('click', () => {
  if (!sigInk) return;
  const c = els.sigPad, g = c.getContext('2d'), d = g.getImageData(0, 0, c.width, c.height).data;
  let x0 = c.width, y0 = c.height, x1 = 0, y1 = 0;
  for (let y = 0; y < c.height; y += 2) for (let x = 0; x < c.width; x += 2) if (d[(y * c.width + x) * 4 + 3] > 10) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
  const pad = 10, cw = x1 - x0 + pad * 2, ch = y1 - y0 + pad * 2;
  const t = document.createElement('canvas'); t.width = cw; t.height = ch;
  t.getContext('2d').drawImage(c, x0 - pad, y0 - pad, cw, ch, 0, 0, cw, ch);
  els.sigModal.hidden = true;
  placeImage(t.toDataURL('image/png'), cw, ch, 0.25);
});

/* ---------------------------------------------------------------- save with pdf-lib */

const hexToRgb = (h, R) => R.rgb(parseInt(h.slice(1, 3), 16) / 255, parseInt(h.slice(3, 5), 16) / 255, parseInt(h.slice(5, 7), 16) / 255);

/** Map a point on the displayed (rotated) page to PDF user space. */
function toPdf(pg, u, v) {
  const W = pg.wPt, H = pg.hPt;
  switch (pg.rot) {
    case 90: return [v * W, u * H];
    case 180: return [(1 - u) * W, v * H];
    case 270: return [(1 - v) * W, (1 - u) * H];
    default: return [u * W, (1 - v) * H];
  }
}
function boxToPdf(pg, a) {
  const [x1, y1] = toPdf(pg, a.x, a.y), [x2, y2] = toPdf(pg, a.x + a.w, a.y + a.h);
  return { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) };
}

function textAsImage(a, pg) {
  const scale = 4;   // render at 4× point size for sharp print
  const c = document.createElement('canvas'), g = c.getContext('2d');
  const font = `${a.italic ? 'italic ' : ''}${a.bold ? 700 : 400} ${a.size * scale}px ${a.css ? `${a.css}, ` : ''}Inter, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", Arial, sans-serif`;
  g.font = font;
  const lines = a.text.split('\n');
  const lw = Math.max(...lines.map((l) => g.measureText(l).width), 1), lh = a.size * scale * 1.25;
  c.width = Math.ceil(lw + 4); c.height = Math.ceil(lh * lines.length + 4);
  g.font = font; g.fillStyle = a.color; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 2, 2 + i * lh));
  return { url: c.toDataURL('image/png'), wPt: c.width / scale, hPt: c.height / scale };
}

const STD = { sans: ['Helvetica', 'HelveticaBold', 'HelveticaOblique', 'HelveticaBoldOblique'], serif: ['TimesRoman', 'TimesRomanBold', 'TimesRomanItalic', 'TimesRomanBoldItalic'], mono: ['Courier', 'CourierBold', 'CourierOblique', 'CourierBoldOblique'] };

/** Names ('/Im1') of the page's image XObjects, from its Resources dictionary. */
function imageXObjectNames(R, doc, page) {
  const names = new Set();
  try {
    const res = page.node.Resources();
    if (!res) return names;
    const xo = res.get(R.PDFName.of('XObject'));
    if (!xo) return names;
    const dict = xo instanceof R.PDFRef ? doc.context.lookup(xo) : xo;
    if (!dict || typeof dict.keys !== 'function') return names;
    for (const key of dict.keys()) {
      const val = dict.get(key);
      const obj = val instanceof R.PDFRef ? doc.context.lookup(val) : val;
      const d = obj && obj.dict ? obj.dict : (obj && typeof obj.get === 'function' ? obj : null);
      if (d && d.get(R.PDFName.of('Subtype')) === R.PDFName.of('Image')) {
        const k = typeof key.decodeText === 'function' ? key.decodeText() : String(key).replace(/^\/+/, '');
        names.add('/' + k);
      }
    }
  } catch (e) { console.warn('could not read image XObjects', e); }
  return names;
}

/** Write all edits into a copy of the PDF. Replaced text is removed from the page content, except for edits in `coverOnly` (covered instead). */
async function buildPdf(R, coverOnly) {
  const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
  const fonts = new Map();
  const font = async (name) => { if (!fonts.has(name)) fonts.set(name, await doc.embedFont(R.StandardFonts[name])); return fonts.get(name); };
  const docPages = doc.getPages();
  const embedCache = new Map();
  const embed = async (url) => {
    if (embedCache.has(url)) return embedCache.get(url);
    const bytes = Uint8Array.from(atob(url.split(',')[1]), (ch) => ch.charCodeAt(0));
    const img = url.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    embedCache.set(url, img); return img;
  };

  // 1b. removed images: take the picture out of the page content where possible (cover rect as fallback)
  const imgRemoved = new Set();   // ann ids whose image was really removed (no cover rect needed)
  const imgAnns = anns.filter((a) => a.type === 'whiteout' && a.img && !pages[a.page - 1].deleted);
  for (const n of new Set(imgAnns.map((a) => a.page))) {
    const mine = imgAnns.filter((a) => a.page === n);
    try {
      const P = docPages[n - 1];
      const names = imageXObjectNames(R, doc, P);
      const boxes = mine.map((a) => { const b = boxToPdf(pages[n - 1], a); return { x0: b.x - 2, y0: b.y - 2, x1: b.x + b.width + 2, y1: b.y + b.height + 2 }; });
      const { bytes, hits } = removeImages(pageContent(R, doc, P), boxes, names);
      if (hits.some((h) => h)) { setPageContent(R, doc, P, bytes); mine.forEach((a, i) => hits[i] && imgRemoved.add(a.id)); }
    } catch (e) { console.warn('image removal skipped on page', n, e); }
  }

  // 1. edited existing text: take the old text out of the page content first (before anything is drawn)
  const edits = anns.filter((a) => a.type === 'edit' && a.text !== a.orig && !pages[a.page - 1].deleted);
  const removed = new Set();
  for (const n of new Set(edits.map((a) => a.page))) {
    const mine = edits.filter((a) => a.page === n && !coverOnly.has(a.id));
    if (!mine.length) continue;
    try {
      const P = docPages[n - 1];
      const boxes = mine.map((a) => ({ x0: a.base.x0 - 1.5, x1: a.base.x1 + 1, y0: a.base.y - a.base.size * 0.4, y1: a.base.y + a.base.size * 0.4 }));
      const { bytes, hits } = removeShowText(pageContent(R, doc, P), boxes);
      if (hits.some((h) => h)) { setPageContent(R, doc, P, bytes); mine.forEach((a, i) => hits[i] && removed.add(a.id)); }
    } catch (e) { console.warn('text removal skipped on page', n, e); }
  }
  for (const a of edits) {
    const P = docPages[a.page - 1], B = a.base;
    if (!removed.has(a.id)) {   // cover the old text with its own background colour
      P.drawRectangle({ x: B.x0 - 0.8, y: B.y + B.desc * B.size - 0.6, width: B.x1 - B.x0 + 1.6, height: (B.asc - B.desc) * B.size + 1.2, color: hexToRgb(a.bg, R) });
    }
    if (!a.text.trim()) continue;
    const f = await font(STD[a.family || 'sans'][(a.bold ? 1 : 0) + (a.italic ? 2 : 0)]);
    const lines = a.text.split('\n');
    let ok = true; try { lines.forEach((l) => f.encodeText(l)); } catch (_) { ok = false; }
    if (ok) lines.forEach((l, i) => P.drawText(l, { x: B.x0, y: B.y - i * a.size * 1.2, size: a.size, font: f, color: hexToRgb(a.color, R) }));
    else {   // characters the standard PDF fonts can't encode: embed as a sharp image
      const im = textAsImage({ ...a, css: CSS_FAMILY[a.family] }), img = await embed(im.url);
      P.drawImage(img, { x: B.x0, y: B.y + B.asc * a.size - im.hPt, width: im.wPt, height: im.hPt });
    }
  }

  // 2. everything else
  for (const a of anns) {
    const pg = pages[a.page - 1]; if (!pg || pg.deleted || a.type === 'edit') continue;
    const P = docPages[a.page - 1], rotD = R.degrees(pg.rot);
    if (a.type === 'ink') {
      const pts = a.pts.map(([u, v]) => toPdf(pg, u, v));
      for (let i = 1; i < pts.length; i++) P.drawLine({ start: { x: pts[i - 1][0], y: pts[i - 1][1] }, end: { x: pts[i][0], y: pts[i][1] }, thickness: a.width, color: hexToRgb(a.color, R), lineCap: R.LineCapStyle.Round });
    } else if (a.type === 'whiteout' || a.type === 'highlight') {
      if (!(a.type === 'whiteout' && a.img && imgRemoved.has(a.id))) {   // image already taken out — nothing to cover
        P.drawRectangle({ ...boxToPdf(pg, a), color: hexToRgb(a.color, R), opacity: a.type === 'highlight' ? 0.4 : 1, blendMode: a.type === 'highlight' ? R.BlendMode.Multiply : undefined });
      }
    } else if (a.type === 'rect') {
      P.drawRectangle({ ...boxToPdf(pg, a), borderColor: hexToRgb(a.color, R), borderWidth: 2 });
    } else if (a.type === 'image') {
      const b = boxToPdf(pg, a), img = await embed(a.src);
      const [ax, ay] = toPdf(pg, a.x, a.y + a.h);   // bottom-left of the box as displayed
      const rotW = pg.rot % 180 ? b.height : b.width, rotH = pg.rot % 180 ? b.width : b.height;
      P.drawImage(img, { x: ax, y: ay, width: rotW, height: rotH, rotate: rotD });
    } else if (a.type === 'text' && a.text.trim()) {
      const latin = /^[ -~ -ÿ\n]*$/.test(a.text);
      if (latin) {
        const f = await font(STD[a.family || 'sans'][(a.bold ? 1 : 0) + (a.italic ? 2 : 0)]);
        a.text.split('\n').forEach((line, i) => {
          const v = a.y + ((i * a.size * 1.25 + a.size * 0.95) / pg.dispH);
          const [x, y] = toPdf(pg, a.x, v);
          P.drawText(line, { x, y, size: a.size, font: f, color: hexToRgb(a.color, R), rotate: rotD });
        });
      } else {
        const im = textAsImage({ ...a, css: CSS_FAMILY[a.family] || CSS_FAMILY.sans }, pg), img = await embed(im.url);
        const [x, y] = toPdf(pg, a.x, a.y + im.hPt / pg.dispH);
        P.drawImage(img, { x, y, width: im.wPt, height: im.hPt, rotate: rotD });
      }
    }
  }
  pages.forEach((pg, i) => { if (pg.addRot) docPages[i].setRotation(R.degrees((pg.rot + pg.addRot) % 360)); });
  for (let i = pages.length - 1; i >= 0; i--) if (pages[i].deleted) doc.removePage(i);
  return { bytes: await doc.save(), removed, imgRemoved };
}

/** After removing text, re-read the saved pages: every untouched line must still be there and the old text gone.
    Returns the edits whose removal went wrong (they are then covered instead). */
async function verifyRemoval(bytes, removed) {
  const bad = new Set();
  const done = anns.filter((a) => removed.has(a.id));
  if (!done.length) return bad;
  const pdfjs = await loadPdfjs();
  const out = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const newIndex = new Map(); let k = 0;
  pages.forEach((pg) => { if (!pg.deleted) newIndex.set(pg.n, ++k); });
  const norm = (t) => t.replace(/\s+/g, '');
  for (const n of new Set(done.map((a) => a.page))) {
    const mine = done.filter((a) => a.page === n);
    try {
      const after = await extractLines(await out.getPage(newIndex.get(n)));
      const editedKeys = new Set(anns.filter((a) => a.type === 'edit' && a.page === n && a.text !== a.orig).map((a) => a.key));
      // untouched text that disappeared → blame the edits on the same baseline
      for (const l of pages[n - 1].lines) {
        if (editedKeys.has(l.key)) continue;
        if (after.some((m) => Math.abs(l.y - m.y) < 0.6 && m.x0 < l.x0 + 2.5 && m.x1 > l.x1 - 2.5 && norm(m.str).includes(norm(l.str)))) continue;
        const culprits = mine.filter((a) => Math.abs(a.base.y - l.y) < l.size * 0.6);
        (culprits.length ? culprits : mine).forEach((a) => bad.add(a.id));
      }
      // old text still there → removal missed part of it
      for (const a of mine) if (!norm(a.text).includes(norm(a.orig)) && after.some((m) => Math.abs(m.y - a.base.y) < 0.6 && norm(m.str).includes(norm(a.orig)))) bad.add(a.id);
    } catch (e) { console.warn(e); mine.forEach((a) => bad.add(a.id)); }
  }
  (out.destroy || out.cleanup || (() => {})).call(out);
  return bad;
}

els.save.addEventListener('click', async () => {
  if (!pdf) return;
  els.save.disabled = true; setStatus(els.status, 'Saving your edits into the PDF…');
  try {
    const R = await loadLib('pdflib');
    // remove old text where it is safe; any edit whose removal touched other text is covered instead (always safe)
    const coverOnly = new Set();
    let { bytes, removed, imgRemoved } = await buildPdf(R, coverOnly);
    for (let round = 0; round < 3; round++) {
      const bad = await verifyRemoval(bytes, removed);
      if (!bad.size) break;
      bad.forEach((id) => coverOnly.add(id));
      ({ bytes, removed, imgRemoved } = await buildPdf(R, coverOnly));
    }
    downloadBlob(new Blob([bytes], { type: 'application/pdf' }), `${splitName(file.name)[0]}-edited.pdf`);
    const nEdits = anns.filter((a) => a.type === 'edit' && a.text !== a.orig).length;
    const nImgs = anns.filter((a) => a.type === 'whiteout' && a.img).length;
    const imgNote = nImgs ? ` ${nImgs} image${nImgs > 1 ? 's' : ''} removed${imgRemoved.size === nImgs ? '' : ` (${imgRemoved.size} taken out, ${nImgs - imgRemoved.size} covered with the page colour)`}.` : '';
    setStatus(els.status, nEdits
      ? `Saved with ${nEdits} text change${nEdits > 1 ? 's' : ''}${removed.size === nEdits ? ': the old text was replaced, so copying and searching find the new wording' : removed.size ? ` (${removed.size} replaced in the text layer, ${nEdits - removed.size} covered with the page colour)` : ': the old text is covered with the page colour'}.${imgNote} Your PDF is downloading.`
      : `Saved.${imgNote} Your edited PDF is downloading.`, 'ok');
    window.__peLast = { removed: removed.size, covered: [...coverOnly].length, imgRemoved: imgRemoved.size };
  } catch (e) {
    console.warn(e);
    setStatus(els.status, /encrypt/i.test(e.message) ? 'This PDF is encrypted. Unlock it first, then edit.' : `Could not save: ${e.message}`, 'err');
  }
  els.save.disabled = false;
});

setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) openPdf(f); else setStatus(els.status, 'Please choose a PDF file.', 'err'); });
setTool('select');
window.__peTest = { get anns() { return anns; }, get pages() { return pages; } };
