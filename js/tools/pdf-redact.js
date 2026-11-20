/* WebcamClicks — True PDF redaction. Mark areas by hand or find e-mails, phone numbers, card numbers, IBANs,
   ID numbers and custom words; redacted pages are flattened to images so the hidden text is really gone,
   then the saved file is re-read to verify. Untouched pages keep their real text. All on-device. */

import { $, setupDropzone, setStatus, splitName, downloadBlob, loadLib, loadPdfjs, formatBytes, escapeHtml } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $('#rd-work'), pages: $('#rd-pages'), info: $('#rd-info'),
  find: $('#rd-find'), terms: $('#rd-terms'), email: $('#rd-email'), phone: $('#rd-phone'), card: $('#rd-card'), iban: $('#rd-iban'), ids: $('#rd-ids'),
  list: $('#rd-list'), clear: $('#rd-clear'), style: $('#rd-style'), dpi: $('#rd-dpi'), meta: $('#rd-meta'), save: $('#rd-save'), count: $('#rd-count')
};

let file = null, bytes = null, pdf = null, pages = [];   // { n, page, vp (scale 1), el, layer, items }
let marks = [];   // { id, page, x, y, w, h (fractions), label }
let mid = 0;

/* ---------------------------------------------------------------- open & render */
async function open(f) {
  file = f; bytes = new Uint8Array(await f.arrayBuffer()); marks = []; pages = [];
  const pdfjs = await loadPdfjs();
  try { pdf = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise; }
  catch (e) { setStatus(els.status, /password/i.test(e.message) ? 'This PDF is password-protected. Unlock it first.' : 'This file could not be opened as a PDF.', 'err'); return; }
  els.work.hidden = false; els.pages.innerHTML = '';
  els.info.textContent = `${f.name} · ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${formatBytes(f.size)}`;
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i), vp = page.getViewport({ scale: 1 });
    const el = document.createElement('div'); el.className = 'rd-page'; el.style.aspectRatio = `${vp.width}/${vp.height}`; el.dataset.page = i;
    el.innerHTML = `<canvas></canvas><div class="rd-layer"></div><span class="rd-num">${i}</span>`;
    els.pages.appendChild(el);
    pages.push({ n: i, page, vp, el, layer: el.querySelector('.rd-layer') });
  }
  for (const p of pages) await renderPage(p);
  setStatus(els.status, 'Drag on a page to black out an area, or find personal details automatically on the right.', 'ok');
  drawMarks();
}
async function renderPage(p) {
  const c = p.el.querySelector('canvas'), w = p.el.clientWidth || 700, dpr = Math.min(2, window.devicePixelRatio || 1);
  const vp = p.page.getViewport({ scale: (w * dpr) / p.vp.width });
  c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
  await p.page.render({ canvasContext: c.getContext('2d'), viewport: vp }).promise;
}

/* ---------------------------------------------------------------- marks */
function drawMarks() {
  for (const p of pages) p.layer.innerHTML = marks.filter((m) => m.page === p.n).map((m) => `<div class="rd-mark rd-${els.style.value}" data-id="${m.id}" style="left:${m.x * 100}%;top:${m.y * 100}%;width:${m.w * 100}%;height:${m.h * 100}%" title="${escapeHtml(m.label)}"><button type="button" class="rd-x" data-x="${m.id}" aria-label="Remove">✕</button></div>`).join('');
  const groups = new Map(); marks.forEach((m) => groups.set(m.label, (groups.get(m.label) || 0) + 1));
  els.list.innerHTML = [...groups].map(([l, n]) => `<li><span>${escapeHtml(l)}</span><b>${n}</b><button type="button" class="t-btn sm" data-unmark="${escapeHtml(l)}">Keep</button></li>`).join('') || '<li class="muted">Nothing marked yet.</li>';
  els.count.textContent = marks.length ? `${marks.length} area${marks.length > 1 ? 's' : ''} on ${new Set(marks.map((m) => m.page)).size} page${new Set(marks.map((m) => m.page)).size > 1 ? 's' : ''}` : '';
  els.save.disabled = !marks.length; els.clear.disabled = !marks.length;
}
els.style.addEventListener('change', drawMarks);
els.list.addEventListener('click', (e) => { const b = e.target.closest('[data-unmark]'); if (!b) return; marks = marks.filter((m) => m.label !== b.dataset.unmark); drawMarks(); });
els.clear.addEventListener('click', () => { marks = []; drawMarks(); });

let drag = null;
els.pages.addEventListener('pointerdown', (e) => {
  const x = e.target.closest('[data-x]'); if (x) { marks = marks.filter((m) => m.id !== +x.dataset.x); drawMarks(); return; }
  const el = e.target.closest('.rd-page'); if (!el) return;
  const r = el.getBoundingClientRect(), u = (e.clientX - r.left) / r.width, v = (e.clientY - r.top) / r.height;
  const m = { id: ++mid, page: +el.dataset.page, x: u, y: v, w: 0, h: 0, label: 'Marked by hand' };
  marks.push(m); drag = { m, u, v, r, el };
  el.setPointerCapture(e.pointerId); e.preventDefault();
});
els.pages.addEventListener('pointermove', (e) => {
  if (!drag) return;
  const { m, u, v, r } = drag, U = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width)), V = Math.min(1, Math.max(0, (e.clientY - r.top) / r.height));
  m.x = Math.min(u, U); m.y = Math.min(v, V); m.w = Math.abs(U - u); m.h = Math.abs(V - v); drawMarks();
});
els.pages.addEventListener('pointerup', () => { if (!drag) return; if (drag.m.w < 0.004 || drag.m.h < 0.003) marks = marks.filter((x) => x !== drag.m); drag = null; drawMarks(); });

/* ---------------------------------------------------------------- find personal details */
const luhn = (s) => { const d = s.replace(/\D/g, ''); if (d.length < 13 || d.length > 19) return false; let sum = 0; for (let i = 0; i < d.length; i++) { let v = +d[d.length - 1 - i]; if (i % 2) { v *= 2; if (v > 9) v -= 9; } sum += v; } return sum % 10 === 0; };
function patterns() {
  const P = [];
  if (els.email.checked) P.push(['E-mail addresses', /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi]);
  // phone numbers need a phone-like format: +country code, (area code), a leading 0, or 3-3-4 groups
  if (els.phone.checked) P.push(['Phone numbers', /\+\d[\d\s().-]{6,}\d|\(\d{2,5}\)\s?\d[\d\s.-]{4,}\d|\b0\d{2,4}[\s.-]?\d{3,4}[\s.-]?\d{3,4}\b|\b\d{3}[-.\s]\d{3}[-.\s]\d{4}\b/g, (s) => { const n = s.replace(/\D/g, '').length; return n >= 8 && n <= 15; }]);
  if (els.card.checked) P.push(['Card numbers', /\b(?:\d[ -]?){12,18}\d\b/g, luhn]);
  if (els.iban.checked) P.push(['Bank accounts (IBAN)', /\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]{4}){2,7}(?:[ ]?[A-Z0-9]{1,4})?\b/g]);
  if (els.ids.checked) P.push(['ID numbers', /\b\d{3}-\d{2}-\d{4}\b|\b[A-Z]{5}\d{4}[A-Z]\b|\b\d{4}\s\d{4}\s\d{4}\b|\b[A-Z]{2}\s?\d{2}\s?\d{2}\s?\d{2}\s?[A-D]\b/g]);
  for (const t of els.terms.value.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)) P.push([`“${t}”`, new RegExp(t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/\s+/g, '\\s+'), 'gi')]);
  return P;
}
els.find.addEventListener('click', async () => {
  if (!pdf) return;
  const P = patterns(); if (!P.length) { setStatus(els.status, 'Tick at least one type, or type words to find.', 'err'); return; }
  marks = marks.filter((m) => m.label === 'Marked by hand');
  let found = 0;
  for (const p of pages) {
    const tc = await p.page.getTextContent();
    // one string per page, remembering which text item and character each position came from
    let text = ''; const map = [];
    tc.items.forEach((it, k) => { if (!it.str) return; for (let i = 0; i < it.str.length; i++) { text += it.str[i]; map.push([k, i]); } text += it.hasEOL ? '\n' : ' '; map.push(null); });
    for (const [label, re, ok] of P) {
      for (const m of text.matchAll(re)) {
        if (ok && !ok(m[0])) continue;
        const per = new Map();
        for (let i = m.index; i < m.index + m[0].length; i++) { const at = map[i]; if (!at) continue; const r = per.get(at[0]) || [Infinity, -1]; per.set(at[0], [Math.min(r[0], at[1]), Math.max(r[1], at[1])]); }
        for (const [k, [a, b]] of per) {
          const it = tc.items[k], box = itemBox(p, it, a, b + 1, (tc.styles[it.fontName] || {}).fontFamily);
          if (box) { marks.push({ id: ++mid, page: p.n, ...box, label }); found++; }
        }
      }
    }
  }
  drawMarks();
  setStatus(els.status, found ? `Found and marked ${found} item${found > 1 ? 's' : ''}. Check each page; click ✕ on a box to keep it, or “Keep” to unmark a whole group.` : 'Nothing found. Scanned PDFs have no text layer: draw boxes by hand instead.', found ? 'ok' : 'err');
});
const meas = document.createElement('canvas').getContext('2d');
/** Box around characters a..b of a text run. Character positions are measured with a similar font and scaled
    to the run's real width, so proportional fonts are handled (i and W are not the same width). */
function itemBox(p, it, a, b, family) {
  const m = mul(p.vp.transform, it.transform);
  const fh = Math.hypot(m[2], m[3]); if (!fh) return null;
  const w = it.width * p.vp.scale;
  meas.font = `${fh}px ${/serif/i.test(family || '') && !/sans/i.test(family || '') ? 'Times New Roman, serif' : /mono/i.test(family || '') ? 'Courier New, monospace' : 'Arial, Helvetica, sans-serif'}`;
  const total = meas.measureText(it.str).width || 1, k = w / total;
  const x0 = m[4] + meas.measureText(it.str.slice(0, a)).width * k, x1 = m[4] + meas.measureText(it.str.slice(0, b)).width * k;
  const pad = fh * 0.22;
  return { x: (x0 - pad) / p.vp.width, y: (m[5] - fh * 0.92) / p.vp.height, w: (x1 - x0 + pad * 2) / p.vp.width, h: (fh * 1.18) / p.vp.height };
}
const mul = (a, b) => [a[0] * b[0] + a[2] * b[1], a[1] * b[0] + a[3] * b[1], a[0] * b[2] + a[2] * b[3], a[1] * b[2] + a[3] * b[3], a[0] * b[4] + a[2] * b[5] + a[4], a[1] * b[4] + a[3] * b[5] + a[5]];

/* ---------------------------------------------------------------- save (flatten redacted pages) */
els.save.addEventListener('click', async () => {
  if (!marks.length) return;
  els.save.disabled = true;
  try {
    const R = await loadLib('pdflib');
    const src = await R.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
    const out = await R.PDFDocument.create();
    const red = new Set(marks.map((m) => m.page)), dpi = +els.dpi.value;
    for (const p of pages) {
      if (!red.has(p.n)) { const [cp] = await out.copyPages(src, [p.n - 1]); out.addPage(cp); continue; }
      setStatus(els.status, `Redacting page ${p.n}…`);
      const vp = p.page.getViewport({ scale: dpi / 72 });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await p.page.render({ canvasContext: g, viewport: vp, annotationMode: 1 /* ENABLE: bake comments & form values into the image */ }).promise;
      for (const m of marks.filter((x) => x.page === p.n)) {
        const x = m.x * c.width, y = m.y * c.height, w = m.w * c.width, h = m.h * c.height;
        g.fillStyle = els.style.value === 'white' ? '#ffffff' : '#000000'; g.fillRect(x, y, w, h);
        if (els.style.value === 'label' && h > 10) { g.fillStyle = '#fff'; g.font = `700 ${Math.min(h * 0.6, 28 * dpi / 72)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('REDACTED', x + w / 2, y + h / 2, w * 0.92); }
      }
      const blob = await new Promise((r) => c.toBlob(r, 'image/jpeg', 0.9));
      const img = await out.embedJpg(new Uint8Array(await blob.arrayBuffer()));
      const pw = p.vp.width, ph = p.vp.height;   // displayed size (rotation applied)
      const page = out.addPage([pw, ph]); page.drawImage(img, { x: 0, y: 0, width: pw, height: ph });
    }
    if (!els.meta.checked) {
      const t = src.getTitle(), a = src.getAuthor(); if (t) out.setTitle(t); if (a) out.setAuthor(a);
    }
    out.setProducer('WebcamClicks PDF redaction'); out.setCreator('WebcamClicks');
    const saved = await out.save();
    // verify: the redacted pages must contain no text at all now
    setStatus(els.status, 'Verifying…');
    const pdfjs = await loadPdfjs(), chk = await pdfjs.getDocument({ data: saved.slice(), isEvalSupported: false }).promise;
    let leftover = 0; for (const n of red) { const tc = await (await chk.getPage(n)).getTextContent(); leftover += tc.items.filter((i) => i.str.trim()).length; }
    (chk.destroy || chk.cleanup || (() => {})).call(chk);
    if (leftover) throw new Error('Verification failed: text remained on a redacted page. Nothing was saved.');
    downloadBlob(new Blob([saved], { type: 'application/pdf' }), `${splitName(file.name)[0]}-redacted.pdf`);
    setStatus(els.status, `Saved and verified: ${marks.length} area${marks.length > 1 ? 's' : ''} permanently removed on ${red.size} page${red.size > 1 ? 's' : ''}. Redacted pages are images now (no hidden text); other pages are unchanged.`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Could not save.', 'err'); }
  els.save.disabled = false;
});

setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) open(f); else setStatus(els.status, 'Please choose a PDF.', 'err'); });
window.addEventListener('resize', () => { clearTimeout(window.__rdT); window.__rdT = setTimeout(() => pages.forEach(renderPage), 300); });
window.__rdTest = { get marks() { return marks; } };
