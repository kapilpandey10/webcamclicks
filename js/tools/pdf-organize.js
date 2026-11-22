/* WebcamClicks — Organize PDF pages: reorder (drag), rotate, delete, duplicate, insert blank pages and
   combine several PDFs, then save. pdf.js draws the thumbnails, pdf-lib writes the new file. */

import { $, $$, setupDropzone, setStatus, downloadBlob, loadLib, loadPdfjs, splitName, formatBytes, escapeHtml } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), grid: $('#po-grid'), bar: $('#po-bar'), info: $('#po-info'),
  selAll: $('#po-selall'), rotL: $('#po-rotl'), rotR: $('#po-rotr'), del: $('#po-del'), dup: $('#po-dup'), blank: $('#po-blank'),
  reverse: $('#po-reverse'), undo: $('#po-undo'), save: $('#po-save'), extract: $('#po-extract'), add: $('#po-add'), addIn: $('#po-add-in'), size: $('#po-size')
};
const sources = [];   // { name, bytes, pdf (pdf.js), count }
let pages = [];       // { id, src, idx, rot, blank?, w, h, thumb? }
let sel = new Set(), anchor = null;
const history = [];
let nextId = 1;

/* ---------------------------------------------------------------- loading */
async function addPdfs(files) {
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!pdfs.length) { setStatus(els.status, 'Please add PDF files.', 'err'); return; }
  const pdfjs = await loadPdfjs();
  for (const f of pdfs) {
    setStatus(els.status, `Opening ${f.name}…`);
    try {
      const bytes = new Uint8Array(await f.arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
      const si = sources.push({ name: f.name, bytes, pdf, count: pdf.numPages }) - 1;
      if (pages.length) snapshot();
      for (let i = 0; i < pdf.numPages; i++) {
        const pg = await pdf.getPage(i + 1);
        const vp = pg.getViewport({ scale: 1 });
        pages.push({ id: nextId++, src: si, idx: i, rot: 0, w: vp.width, h: vp.height, baseRot: pg.rotate || 0 });
      }
    } catch (e) {
      console.warn(e);
      setStatus(els.status, /password/i.test(e.message || e.name) ? `${f.name} is password-protected. Unlock it first, then try again.` : `${f.name} could not be opened (${e.message}).`, 'err');
      continue;
    }
  }
  els.bar.hidden = !pages.length; els.drop.classList.toggle('compact', pages.length > 0);
  render(); drawThumbs();
  setStatus(els.status, `${pages.length} pages. Drag to reorder; click to select, Shift/Ctrl-click for several.`);
}
setupDropzone(els.drop, els.input, addPdfs);
els.add.addEventListener('click', () => els.addIn.click());
els.addIn.addEventListener('change', () => { const fs = [...els.addIn.files]; els.addIn.value = ''; if (fs.length) addPdfs(fs); });

/* ---------------------------------------------------------------- thumbnails (rendered once, lazily, in order) */
let thumbing = false;
async function drawThumbs() {
  if (thumbing) return; thumbing = true;
  try {
    for (const p of pages) {
      if (p.thumb || p.blank) continue;
      const s = sources[p.src];
      const pg = await s.pdf.getPage(p.idx + 1);
      const vp0 = pg.getViewport({ scale: 1 }), scale = 220 / Math.max(vp0.width, vp0.height);
      const vp = pg.getViewport({ scale: scale * Math.min(2, window.devicePixelRatio || 1) });
      const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
      await pg.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
      const url = c.toDataURL('image/jpeg', 0.8);
      for (const q of pages) if (q.src === p.src && q.idx === p.idx) { q.thumb = url; const img = els.grid.querySelector(`[data-id="${q.id}"] img`); if (img) img.src = url; }
    }
  } finally { thumbing = false; }
}

/* ---------------------------------------------------------------- render */
function render() {
  els.grid.innerHTML = pages.map((p, i) => {
    const r = (p.rot % 360 + 360) % 360, portrait = r % 180 === 0;
    const ar = portrait ? `${p.w} / ${p.h}` : `${p.h} / ${p.w}`;
    return `<li class="po-page${sel.has(p.id) ? ' sel' : ''}" data-id="${p.id}" tabindex="0" aria-label="Page ${i + 1}${sel.has(p.id) ? ', selected' : ''}">
      <div class="po-frame"><div class="po-thumb" style="aspect-ratio:${ar};${(portrait ? p.h >= p.w : p.w >= p.h) ? 'height:100%' : 'width:100%'}">${p.blank ? '<span class="po-blank">Blank</span>' : `<img alt="" draggable="false" src="${p.thumb || 'data:image/gif;base64,R0lGODlhAQABAAAAACw='}" style="width:${portrait ? 100 : (p.w / p.h) * 100}%;transform:translate(-50%,-50%) rotate(${r}deg)">`}</div></div>
      <div class="po-meta"><b>${i + 1}</b>${sources.length > 1 && !p.blank ? `<small title="${escapeHtml(sources[p.src].name)}">${escapeHtml(splitName(sources[p.src].name)[0]).slice(0, 14)} p${p.idx + 1}</small>` : ''}</div>
      <div class="po-acts"><button type="button" data-a="rotl" aria-label="Rotate left">⟲</button><button type="button" data-a="rotr" aria-label="Rotate right">⟳</button><button type="button" data-a="del" aria-label="Delete page">✕</button></div>
    </li>`;
  }).join('');
  const n = sel.size;
  els.info.textContent = n ? `${n} of ${pages.length} selected` : `${pages.length} page${pages.length === 1 ? '' : 's'}`;
  [els.rotL, els.rotR, els.del, els.dup, els.extract].forEach((b) => (b.disabled = !n));
  els.save.disabled = !pages.length; els.reverse.disabled = pages.length < 2; els.undo.disabled = !history.length;
  els.selAll.textContent = n === pages.length && n ? 'Select none' : 'Select all';
}
function snapshot() { history.push(JSON.stringify({ pages, sel: [...sel] })); if (history.length > 40) history.shift(); }
const targets = () => (sel.size ? pages.filter((p) => sel.has(p.id)) : []);

/* ---------------------------------------------------------------- actions */
function rotate(list, d) { if (!list.length) return; snapshot(); list.forEach((p) => (p.rot = (p.rot + d + 360) % 360)); render(); }
function remove(list) {
  if (!list.length) return;
  if (list.length === pages.length) { setStatus(els.status, 'A PDF needs at least one page.', 'err'); return; }
  snapshot(); const ids = new Set(list.map((p) => p.id)); pages = pages.filter((p) => !ids.has(p.id)); ids.forEach((id) => sel.delete(id)); render();
}
els.rotL.addEventListener('click', () => rotate(targets(), -90));
els.rotR.addEventListener('click', () => rotate(targets(), 90));
els.del.addEventListener('click', () => remove(targets()));
els.dup.addEventListener('click', () => {
  const t = targets(); if (!t.length) return; snapshot();
  const last = Math.max(...t.map((p) => pages.indexOf(p)));
  const copies = t.map((p) => ({ ...p, id: nextId++ }));
  pages.splice(last + 1, 0, ...copies); sel = new Set(copies.map((p) => p.id)); render();
});
els.blank.addEventListener('click', () => {
  snapshot();
  const t = targets(), at = t.length ? Math.max(...t.map((p) => pages.indexOf(p))) + 1 : pages.length;
  const ref = pages[Math.max(0, at - 1)] || { w: 595.28, h: 841.89 };
  const b = { id: nextId++, blank: true, rot: 0, w: ref.rot % 180 ? ref.h : ref.w, h: ref.rot % 180 ? ref.w : ref.h };
  pages.splice(at, 0, b); sel = new Set([b.id]); render();
});
els.reverse.addEventListener('click', () => { snapshot(); pages.reverse(); render(); });
els.undo.addEventListener('click', () => { if (!history.length) return; const s = JSON.parse(history.pop()); pages = s.pages; sel = new Set(s.sel); render(); drawThumbs(); });
els.selAll.addEventListener('click', () => { sel = sel.size === pages.length ? new Set() : new Set(pages.map((p) => p.id)); render(); });

els.grid.addEventListener('click', (e) => {
  const li = e.target.closest('.po-page'); if (!li || dragMoved) return;
  const id = +li.dataset.id, p = pages.find((x) => x.id === id);
  const a = e.target.closest('[data-a]');
  if (a) { const list = sel.has(id) ? targets() : [p]; if (a.dataset.a === 'del') remove(list); else rotate(list, a.dataset.a === 'rotl' ? -90 : 90); return; }
  if (e.shiftKey && anchor != null) {
    const i0 = pages.findIndex((x) => x.id === anchor), i1 = pages.indexOf(p);
    for (let i = Math.min(i0, i1); i <= Math.max(i0, i1); i++) sel.add(pages[i].id);
  } else if (e.ctrlKey || e.metaKey || window.matchMedia('(pointer: coarse)').matches) { sel.has(id) ? sel.delete(id) : sel.add(id); anchor = id; }
  else { sel = sel.has(id) && sel.size === 1 ? new Set() : new Set([id]); anchor = id; }
  render();
  els.grid.querySelector(`[data-id="${id}"]`)?.focus({ preventScroll: true });
});
// keyboard: arrows move focus, Ctrl+arrows move pages, Delete removes, R rotates
els.grid.addEventListener('keydown', (e) => {
  const li = e.target.closest('.po-page'); if (!li) return;
  const i = pages.findIndex((p) => p.id === +li.dataset.id);
  const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -cols(), ArrowDown: cols() }[e.key];
  if (step) {
    e.preventDefault();
    const j = Math.max(0, Math.min(pages.length - 1, i + step));
    if (e.ctrlKey || e.metaKey) { snapshot(); const [p] = pages.splice(i, 1); pages.splice(j, 0, p); render(); }
    els.grid.querySelector(`[data-id="${pages[j].id}"]`)?.focus();
  } else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove(sel.has(pages[i].id) ? targets() : [pages[i]]); }
  else if (e.key === 'r' || e.key === 'R') rotate(sel.has(pages[i].id) ? targets() : [pages[i]], e.shiftKey ? -90 : 90);
  else if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); li.click(); }
});
document.addEventListener('keydown', (e) => { if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !/input|textarea/i.test(e.target.tagName)) { e.preventDefault(); els.undo.click(); } });
function cols() { const items = [...els.grid.children]; if (items.length < 2) return 1; const top = items[0].offsetTop; return Math.max(1, items.findIndex((x) => x.offsetTop !== top)) || items.length; }

/* ---------------------------------------------------------------- drag to reorder (mouse, pen and touch) */
let drag = null, dragMoved = false;
els.grid.addEventListener('pointerdown', (e) => {
  const li = e.target.closest('.po-page'); if (!li || e.target.closest('[data-a]') || e.button > 0) return;
  drag = { id: +li.dataset.id, x: e.clientX, y: e.clientY, li, pid: e.pointerId, on: false, timer: 0 };
  dragMoved = false;
  if (e.pointerType === 'touch') drag.timer = setTimeout(() => { if (drag) begin(e); }, 280);   // touch: press and hold, so the page can still scroll
});
function begin(e) {
  drag.on = true; dragMoved = true;
  if (!sel.has(drag.id)) { sel = new Set([drag.id]); render(); drag.li = els.grid.querySelector(`[data-id="${drag.id}"]`); }
  drag.ids = pages.filter((p) => sel.has(p.id)).map((p) => p.id);
  drag.ghost = drag.li.cloneNode(true); drag.ghost.classList.add('po-ghost');
  if (drag.ids.length > 1) drag.ghost.insertAdjacentHTML('beforeend', `<span class="po-count">${drag.ids.length}</span>`);
  const r = drag.li.getBoundingClientRect(); drag.ox = e.clientX - r.left; drag.oy = e.clientY - r.top; drag.ghost.style.width = `${r.width}px`;
  document.body.appendChild(drag.ghost);
  els.grid.classList.add('dragging'); drag.ids.forEach((id) => els.grid.querySelector(`[data-id="${id}"]`)?.classList.add('lifted'));
  try { els.grid.setPointerCapture(drag.pid); } catch (_) { /* ignore */ }
  move(e);
}
function move(e) {
  drag.ghost.style.transform = `translate(${e.clientX - drag.ox}px, ${e.clientY - drag.oy}px)`;
  // insertion point: the page under the pointer, before or after it
  const els2 = [...els.grid.children]; let at = pages.length;
  for (let i = 0; i < els2.length; i++) {
    const r = els2[i].getBoundingClientRect();
    if (e.clientY < r.bottom && e.clientX < r.left + r.width / 2 && e.clientY > r.top - 10) { at = i; break; }
    if (e.clientY < r.top - 10) { at = i; break; }
  }
  drag.at = at;
  els2.forEach((x, i) => x.classList.toggle('drop-before', i === at));
  els.grid.classList.toggle('drop-end', at === pages.length);
  // auto-scroll near the window edges
  const m = 60; if (e.clientY < m) scrollBy(0, -12); else if (e.clientY > innerHeight - m) scrollBy(0, 12);
}
els.grid.addEventListener('pointermove', (e) => {
  if (!drag) return;
  if (!drag.on) {
    if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 8) return;
    if (e.pointerType === 'touch') { clearTimeout(drag.timer); drag = null; return; }   // a swipe: let the page scroll
    begin(e);
  }
  e.preventDefault(); move(e);
});
function endDrag() {
  if (!drag) return;
  clearTimeout(drag.timer);
  if (drag.on) {
    drag.ghost.remove(); els.grid.classList.remove('dragging', 'drop-end');
    const at = drag.at ?? pages.length, ids = new Set(drag.ids);
    const before = pages.slice(0, at).filter((p) => !ids.has(p.id)).length;
    const moving = pages.filter((p) => ids.has(p.id)), rest = pages.filter((p) => !ids.has(p.id));
    const next = [...rest.slice(0, before), ...moving, ...rest.slice(before)];
    if (next.some((p, i) => p !== pages[i])) { snapshot(); pages = next; }
    render();
    setTimeout(() => { dragMoved = false; }, 0);
  }
  drag = null;
}
els.grid.addEventListener('pointerup', endDrag); els.grid.addEventListener('pointercancel', endDrag);
els.grid.addEventListener('contextmenu', (e) => { if (drag && drag.on) e.preventDefault(); });

/* ---------------------------------------------------------------- save */
async function build(list) {
  const { PDFDocument, degrees } = await loadLib('pdflib');
  const out = await PDFDocument.create();
  const loaded = new Map();
  for (const p of list) {
    if (p.blank) { const pg = out.addPage([p.w, p.h]); if (p.rot) pg.setRotation(degrees(p.rot)); continue; }
    if (!loaded.has(p.src)) loaded.set(p.src, await PDFDocument.load(sources[p.src].bytes, { ignoreEncryption: true }));
    const [pg] = await out.copyPages(loaded.get(p.src), [p.idx]);
    pg.setRotation(degrees(((pg.getRotation().angle || 0) + p.rot) % 360));
    out.addPage(pg);
  }
  return new Blob([await out.save({ useObjectStreams: true })], { type: 'application/pdf' });
}
async function saveAs(list, suffix) {
  els.save.disabled = els.extract.disabled = true;
  try {
    setStatus(els.status, 'Creating your PDF…');
    const blob = await build(list);
    const base = sources.length ? splitName(sources[0].name)[0] : 'document';
    downloadBlob(blob, `${base}-${suffix}.pdf`);
    setStatus(els.status, `Saved ${list.length} page${list.length === 1 ? '' : 's'} (${formatBytes(blob.size)}).`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Could not save: ${e.message}`, 'err'); }
  render();
}
els.save.addEventListener('click', () => pages.length && saveAs(pages, 'organized'));
els.extract.addEventListener('click', () => { const t = targets(); if (t.length) saveAs(t, 'selected-pages'); });
els.size.addEventListener('input', () => els.grid.style.setProperty('--po-w', `${els.size.value}px`));
render();
window.__poTest = { get pages() { return pages; }, build };
