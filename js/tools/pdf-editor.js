/* WebcamClicks — PDF editor (on-device).
   pdf.js renders pages; edits live as an overlay (text, drawing, highlight, white-out, boxes, images,
   signatures); on save, pdf-lib writes them into the original PDF. Latin text stays real, selectable text;
   other scripts are embedded as sharp images so every language works without font files. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadLib, loadPdfjs, formatBytes } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), pages: $('#pe-pages'), tools: $('#pe-tools'), color: $('#pe-color'),
  size: $('#pe-size'), width: $('#pe-width'), save: $('#pe-save'), undo: $('#pe-undo'), imgInput: $('#pe-img'), sigModal: $('#pe-sig'),
  sigPad: $('#pe-sigpad'), sigType: $('#pe-sigtext'), sigUse: $('#pe-sig-use'), sigClear: $('#pe-sig-clear'), sigCancel: $('#pe-sig-cancel'),
  info: $('#pe-info'), editor: $('#pe-editor')
};

let pdfBytes = null, pdf = null, file = null;
let pages = [];          // { n, wPt, hPt, rot, el, layer, svg, deleted, addRot }
let anns = [];           // annotations (coordinates are fractions of the displayed page)
let tool = 'select', sel = null, history = [], aid = 0;
const ANN_HTML_TYPES = new Set(['text', 'whiteout', 'highlight', 'rect', 'image']);

/* ---------------------------------------------------------------- load & render */

async function openPdf(f) {
  file = f;
  setStatus(els.status, 'Opening PDF…');
  pdfBytes = new Uint8Array(await f.arrayBuffer());
  const pdfjs = await loadPdfjs();
  try { pdf = await pdfjs.getDocument({ data: pdfBytes.slice(), isEvalSupported: false }).promise; }
  catch (e) { setStatus(els.status, /password/i.test(e.message) ? 'This PDF is password-protected. Remove the password first, then edit it.' : 'This file could not be opened as a PDF.', 'err'); return; }
  anns = []; history = []; sel = null; pages = [];
  els.pages.innerHTML = '';
  els.editor.hidden = false;
  els.info.textContent = `${f.name} · ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${formatBytes(f.size)}`;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const vp1 = page.getViewport({ scale: 1 });
    const [x0, y0, x1, y1] = page.view;
    const pg = { n: i, wPt: x1 - x0, hPt: y1 - y0, rot: page.rotate % 360, dispW: vp1.width, dispH: vp1.height, deleted: false, addRot: 0 };
    const wrap = document.createElement('div');
    wrap.className = 'pe-page'; wrap.dataset.page = i;
    wrap.innerHTML = `<div class="pe-pagebar"><span>Page ${i}</span><button type="button" data-pa="rot" title="Rotate page">⟳ Rotate</button><button type="button" data-pa="del" title="Delete page">🗑 Delete</button></div>
      <div class="pe-sheet" style="aspect-ratio:${vp1.width}/${vp1.height}"><canvas></canvas><svg class="pe-ink" viewBox="0 0 1000 ${Math.round(1000 * vp1.height / vp1.width)}" preserveAspectRatio="none"></svg><div class="pe-layer"></div></div>`;
    els.pages.appendChild(wrap);
    pg.el = wrap; pg.sheet = wrap.querySelector('.pe-sheet'); pg.layer = wrap.querySelector('.pe-layer'); pg.svg = wrap.querySelector('svg'); pg.page = page;
    pages.push(pg);
  }
  await renderVisible();
  setStatus(els.status, 'Pick a tool above, then click or drag on a page.');
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
    Object.assign(d.style, { left: `${a.x * 100}%`, top: `${a.y * 100}%`, width: `${a.w * 100}%`, height: a.type === 'text' ? 'auto' : `${a.h * 100}%` });
    if (a.type === 'text') {
      d.contentEditable = a === sel ? 'true' : 'false';
      d.textContent = a.text;
      Object.assign(d.style, { fontSize: `${a.size * pxPerPt(pg)}px`, color: a.color, fontWeight: a.bold ? '700' : '400' });
      d.addEventListener('input', () => { a.text = d.innerText; });
      d.addEventListener('blur', () => { if (!a.text.trim()) { anns = anns.filter((x) => x !== a); drawAll(); } });
    } else if (a.type === 'image') d.innerHTML = `<img src="${a.src}" alt="" draggable="false">`;
    else if (a.type === 'highlight') d.style.background = a.color + '66';
    else if (a.type === 'rect') d.style.borderColor = a.color;
    if (a === sel) d.insertAdjacentHTML('beforeend', '<span class="pe-handle" data-h="se"></span><button type="button" class="pe-x" data-x aria-label="Delete">✕</button>');
    pg.layer.appendChild(d);
  }
}

function snapshot() { history.push(JSON.stringify({ anns, pages: pages.map((p) => [p.deleted, p.addRot]) })); if (history.length > 80) history.shift(); els.undo.disabled = false; }
function undo() {
  const s = history.pop(); if (!s) return;
  const o = JSON.parse(s); anns = o.anns; o.pages.forEach(([d, r], i) => { pages[i].deleted = d; pages[i].addRot = r; });
  sel = null; drawAll(); els.undo.disabled = !history.length;
}

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
  const annEl = e.target.closest('.pe-ann, path[data-id]');
  if (tool === 'select' || (annEl && tool !== 'draw')) {
    if (!annEl) { sel = null; drawAll(); return; }
    const a = anns.find((x) => x.id === annEl.dataset.id); if (!a) return;
    if (sel !== a) { sel = a; drawAll(); }
    if (a.type === 'text' && e.detail >= 2) { const el = hit.pg.layer.querySelector(`[data-id="${a.id}"]`); el && el.focus(); return; }
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
    const a = { id: `a${++aid}`, type: 'text', page: pg.n, x: hit.u, y: hit.v - 0.01, w: 0.4, h: 0.04, text: 'Type here', size: +els.size.value, color, bold: false };
    anns.push(a); sel = a; drawAll(); setTool('select');
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
}
els.tools.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tool]'); if (!b) return;
  if (b.dataset.tool === 'image') { els.imgInput.click(); return; }
  if (b.dataset.tool === 'sign') { openSig(); return; }
  setTool(b.dataset.tool);
});
els.undo.addEventListener('click', undo);
document.addEventListener('keydown', (e) => {
  if (!pdf || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); undo(); }
  if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); snapshot(); anns = anns.filter((a) => a !== sel); sel = null; drawAll(); }
  if (e.key === 'Escape') { sel = null; setTool('select'); drawAll(); }
});
[els.color, els.size, els.width].forEach((c) => c.addEventListener('input', () => {
  if (!sel) return;
  if (c === els.color && sel.type !== 'whiteout' && sel.type !== 'image') sel.color = els.color.value;
  if (c === els.size && sel.type === 'text') sel.size = +els.size.value;
  if (c === els.width && sel.type === 'ink') sel.width = +els.width.value;
  drawAll();
}));

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
  const font = `${a.bold ? 700 : 400} ${a.size * scale}px Inter, "Segoe UI", "Noto Sans", Arial, sans-serif`;
  g.font = font;
  const lines = a.text.split('\n');
  const lw = Math.max(...lines.map((l) => g.measureText(l).width), 1), lh = a.size * scale * 1.25;
  c.width = Math.ceil(lw + 4); c.height = Math.ceil(lh * lines.length + 4);
  g.font = font; g.fillStyle = a.color; g.textBaseline = 'top';
  lines.forEach((l, i) => g.fillText(l, 2, 2 + i * lh));
  return { url: c.toDataURL('image/png'), wPt: c.width / scale, hPt: c.height / scale };
}

els.save.addEventListener('click', async () => {
  if (!pdf) return;
  els.save.disabled = true; setStatus(els.status, 'Saving your edits into the PDF…');
  try {
    const R = await loadLib('pdflib');
    const doc = await R.PDFDocument.load(pdfBytes, { updateMetadata: false });
    const helv = await doc.embedFont(R.StandardFonts.Helvetica), helvB = await doc.embedFont(R.StandardFonts.HelveticaBold);
    const docPages = doc.getPages();
    const embedCache = new Map();
    const embed = async (url) => {
      if (embedCache.has(url)) return embedCache.get(url);
      const bytes = Uint8Array.from(atob(url.split(',')[1]), (ch) => ch.charCodeAt(0));
      const img = url.startsWith('data:image/png') ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
      embedCache.set(url, img); return img;
    };
    for (const a of anns) {
      const pg = pages[a.page - 1]; if (!pg || pg.deleted) continue;
      const P = docPages[a.page - 1], rotD = R.degrees(pg.rot);
      if (a.type === 'ink') {
        const pts = a.pts.map(([u, v]) => toPdf(pg, u, v));
        for (let i = 1; i < pts.length; i++) P.drawLine({ start: { x: pts[i - 1][0], y: pts[i - 1][1] }, end: { x: pts[i][0], y: pts[i][1] }, thickness: a.width, color: hexToRgb(a.color, R), lineCap: R.LineCapStyle.Round });
      } else if (a.type === 'whiteout' || a.type === 'highlight') {
        P.drawRectangle({ ...boxToPdf(pg, a), color: hexToRgb(a.color, R), opacity: a.type === 'highlight' ? 0.4 : 1, blendMode: a.type === 'highlight' ? R.BlendMode.Multiply : undefined });
      } else if (a.type === 'rect') {
        P.drawRectangle({ ...boxToPdf(pg, a), borderColor: hexToRgb(a.color, R), borderWidth: 2 });
      } else if (a.type === 'image') {
        const b = boxToPdf(pg, a), img = await embed(a.src);
        const [ax, ay] = toPdf(pg, a.x, a.y + a.h);   // bottom-left of the box as displayed
        const rotW = pg.rot % 180 ? b.height : b.width, rotH = pg.rot % 180 ? b.width : b.height;
        P.drawImage(img, { x: ax, y: ay, width: rotW, height: rotH, rotate: rotD });
      } else if (a.type === 'text' && a.text.trim()) {
        const latin = /^[ -~ -ÿ\n]*$/.test(a.text);
        if (latin) {
          const lines = a.text.split('\n');
          lines.forEach((line, i) => {
            const v = a.y + ((i * a.size * 1.25 + a.size * 0.95) / pg.dispH);
            const [x, y] = toPdf(pg, a.x, v);
            P.drawText(line, { x, y, size: a.size, font: a.bold ? helvB : helv, color: hexToRgb(a.color, R), rotate: rotD });
          });
        } else {
          const im = textAsImage(a, pg), img = await embed(im.url);
          const [x, y] = toPdf(pg, a.x, a.y + im.hPt / pg.dispH);
          P.drawImage(img, { x, y, width: im.wPt, height: im.hPt, rotate: rotD });
        }
      }
    }
    pages.forEach((pg, i) => { if (pg.addRot) docPages[i].setRotation(R.degrees((pg.rot + pg.addRot) % 360)); });
    for (let i = pages.length - 1; i >= 0; i--) if (pages[i].deleted) doc.removePage(i);
    const out = await doc.save();
    downloadBlob(new Blob([out], { type: 'application/pdf' }), `${splitName(file.name)[0]}-edited.pdf`);
    setStatus(els.status, 'Saved. Your edited PDF is downloading.', 'ok');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, /encrypt/i.test(e.message) ? 'This PDF is encrypted. Unlock it first, then edit.' : `Could not save: ${e.message}`, 'err');
  }
  els.save.disabled = false;
});

setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) openPdf(f); else setStatus(els.status, 'Please choose a PDF file.', 'err'); });
setTool('select');
window.__peTest = { get anns() { return anns; }, get pages() { return pages; } };
