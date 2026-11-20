/* WebcamClicks — PDF to JPG / PNG (pdf.js renders each page on your device). */

import { $, setupDropzone, splitName, downloadBlob, downloadZip, setStatus, loadPdfjs, canvasToBlob, formatBytes } from './common.js';

const els = { drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), grid: $('#t-pages'), fmt: $('#t-fmt'), dpi: $('#t-dpi'),
  quality: $('#t-quality'), run: $('#t-run'), all: $('#t-all'), none: $('#t-none'), info: $('#t-info') };
let pdf = null, file = null, selected = new Set();

async function openPdf(f) {
  const pdfjs = await loadPdfjs();
  file = f;
  setStatus(els.status, 'Opening PDF…');
  const data = new Uint8Array(await f.arrayBuffer());
  const task = pdfjs.getDocument({ data, isEvalSupported: false });
  task.onPassword = (cb, reason) => {
    const pw = prompt(reason === 2 ? 'Wrong password. Try again:' : 'This PDF is password-protected. Enter the password to open it (it stays on your device):');
    if (pw == null) { task.destroy(); setStatus(els.status, 'Cancelled.'); return; }
    cb(pw);
  };
  try { pdf = await task.promise; } catch (e) { if (pdf === null) setStatus(els.status, 'This file could not be opened as a PDF.', 'err'); return; }
  selected = new Set(Array.from({ length: pdf.numPages }, (_, i) => i + 1));
  els.info.textContent = `${f.name} · ${pdf.numPages} page${pdf.numPages > 1 ? 's' : ''} · ${formatBytes(f.size)}`;
  els.grid.innerHTML = Array.from({ length: pdf.numPages }, (_, i) => `<label class="pg"><input type="checkbox" checked data-p="${i + 1}"><canvas data-p="${i + 1}"></canvas><span>${i + 1}</span></label>`).join('');
  els.run.disabled = false; els.all.disabled = els.none.disabled = false;
  setStatus(els.status, `Ready. Pick pages, then convert.`);
  for (let i = 1; i <= Math.min(pdf.numPages, 60); i++) {   // thumbnails
    const page = await pdf.getPage(i);
    const vp = page.getViewport({ scale: 1 }), s = 140 / vp.width;
    const c = els.grid.querySelector(`canvas[data-p="${i}"]`); const v2 = page.getViewport({ scale: s });
    c.width = v2.width; c.height = v2.height;
    await page.render({ canvasContext: c.getContext('2d'), viewport: v2 }).promise;
  }
}

els.grid.addEventListener('change', (e) => { const p = +e.target.dataset.p; if (!p) return; e.target.checked ? selected.add(p) : selected.delete(p); els.run.disabled = !selected.size; });
els.all.addEventListener('click', () => { els.grid.querySelectorAll('input').forEach((i) => { i.checked = true; selected.add(+i.dataset.p); }); els.run.disabled = false; });
els.none.addEventListener('click', () => { els.grid.querySelectorAll('input').forEach((i) => { i.checked = false; }); selected.clear(); els.run.disabled = true; });

els.run.addEventListener('click', async () => {
  if (!pdf || !selected.size) return;
  els.run.disabled = true;
  const type = els.fmt.value, ext = type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg';
  const scale = +els.dpi.value / 72, base = splitName(file.name)[0];
  const pages = [...selected].sort((a, b) => a - b), out = [];
  try {
    for (let k = 0; k < pages.length; k++) {
      setStatus(els.status, `Rendering page ${pages[k]} (${k + 1} of ${pages.length})…`);
      const page = await pdf.getPage(pages[k]);
      const vp = page.getViewport({ scale: Math.min(scale, 8000 / page.getViewport({ scale: 1 }).width) });
      const c = document.createElement('canvas'); c.width = Math.floor(vp.width); c.height = Math.floor(vp.height);
      const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      await page.render({ canvasContext: g, viewport: vp }).promise;
      out.push({ name: `${base}-page-${String(pages[k]).padStart(String(pdf.numPages).length, '0')}.${ext}`, blob: await canvasToBlob(c, type, +els.quality.value / 100) });
      c.width = c.height = 0;
    }
    if (out.length === 1) downloadBlob(out[0].blob, out[0].name); else await downloadZip(out, `${base}-images.zip`);
    setStatus(els.status, `Converted ${out.length} page${out.length > 1 ? 's' : ''} to ${ext.toUpperCase()} at ${els.dpi.value} DPI${out.length > 1 ? ' (ZIP)' : ''}.`, 'ok');
  } catch (e) { setStatus(els.status, e.message || 'Conversion failed.', 'err'); }
  els.run.disabled = false;
});
els.fmt.addEventListener('change', () => { els.quality.closest('.t-field').hidden = els.fmt.value === 'image/png'; });
setupDropzone(els.drop, els.input, (files) => { const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name)); if (f) openPdf(f); else setStatus(els.status, 'Please choose a PDF file.', 'err'); });
