/* WebcamClicks — Compress PDF: shrink the photos and scans inside a PDF (downscale + JPEG) while text, links and
   vector graphics stay exactly as they are. "Maximum" turns each page into a compact image (for scans).
   pdf-lib rewrites the file, pdf.js renders pages; nothing leaves the device. */

import { $, setupDropzone, setStatus, downloadBlob, downloadZip, loadLib, loadPdfjs, formatBytes, splitName, escapeHtml } from './common.js';

const els = { drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), list: $('#pc-list'), level: $('#pc-level'), run: $('#pc-run'), all: $('#pc-all'), meta: $('#pc-meta'), gray: $('#pc-gray') };
const LEVELS = { light: { px: 2400, q: 0.82 }, medium: { px: 1600, q: 0.7 }, strong: { px: 1100, q: 0.55 }, max: { dpi: 100, q: 0.6 } };
let items = [];   // { id, file, out?, state }
let nextId = 1;

function add(files) {
  const pdfs = files.filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name));
  if (!pdfs.length) { setStatus(els.status, 'Please add PDF files.', 'err'); return; }
  pdfs.forEach((f) => items.push({ id: nextId++, file: f, state: 'ready' }));
  render(); setStatus(els.status, 'Choose a compression level and press Compress.');
}
setupDropzone(els.drop, els.input, add);
function render() {
  els.list.innerHTML = items.map((it) => {
    const out = it.out, pct = out ? Math.round((1 - out.size / it.file.size) * 100) : 0;
    const res = it.state === 'done' ? (out.size < it.file.size ? `<b class="pc-good">${formatBytes(out.size)}</b> <span class="pc-pct">−${pct}%</span>` : '<span class="muted">Already compact: kept the original</span>')
      : it.state === 'work' ? `<span class="muted">${escapeHtml(it.msg || 'Compressing…')}</span>` : it.state === 'err' ? `<span class="pc-err">${escapeHtml(it.msg)}</span>` : '';
    return `<li class="t-item" data-id="${it.id}"><span class="thumb">PDF</span><div><div class="name">${escapeHtml(it.file.name)}</div><div class="meta">${formatBytes(it.file.size)} ${res ? '→ ' + res : ''}</div>
      ${it.state === 'work' ? `<div class="sr-progress"><div style="width:${Math.round((it.p || 0) * 100)}%"></div></div>` : ''}</div>
      <div class="ctrl">${it.state === 'done' ? '<button class="t-btn sm primary" data-act="dl" type="button">Download</button>' : ''}<button class="t-icon-btn" data-act="rm" type="button" aria-label="Remove">✕</button></div></li>`;
  }).join('');
  els.run.disabled = !items.some((i) => i.state !== 'work') || !items.length;
  els.all.hidden = items.filter((i) => i.state === 'done').length < 2;
}
els.list.addEventListener('click', (e) => {
  const b = e.target.closest('[data-act]'); if (!b) return;
  const it = items.find((x) => x.id === +b.closest('[data-id]').dataset.id);
  if (b.dataset.act === 'rm') { items = items.filter((x) => x !== it); render(); }
  if (b.dataset.act === 'dl') downloadBlob(it.out, outName(it));
});
const outName = (it) => `${splitName(it.file.name)[0]}-compressed.pdf`;
els.all.addEventListener('click', () => downloadZip(items.filter((i) => i.state === 'done').map((i) => ({ name: outName(i), blob: i.out })), 'compressed-pdfs.zip'));

/* ---------------------------------------------------------------- image re-compression */
async function inflate(bytes) {
  const ds = new DecompressionStream('deflate');
  const out = await new Response(new Blob([bytes]).stream().pipeThrough(ds)).arrayBuffer();
  return new Uint8Array(out);
}
/** Undo PNG row filters (FlateDecode /Predictor ≥ 10). */
function unpredict(data, w, comps, bpc = 8) {
  const bpp = Math.max(1, (comps * bpc) / 8), row = Math.ceil((w * comps * bpc) / 8), out = new Uint8Array(row * Math.floor(data.length / (row + 1)));
  let prev = new Uint8Array(row);
  for (let y = 0, i = 0; i + row < data.length + 1 && y * row < out.length; y++) {
    const ft = data[i++], cur = out.subarray(y * row, (y + 1) * row);
    for (let x = 0; x < row; x++) {
      const raw = data[i++], a = x >= bpp ? cur[x - bpp] : 0, b = prev[x], c = x >= bpp ? prev[x - bpp] : 0;
      let v = raw;
      if (ft === 1) v = raw + a; else if (ft === 2) v = raw + b; else if (ft === 3) v = raw + ((a + b) >> 1);
      else if (ft === 4) { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); v = raw + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c); }
      cur[x] = v & 255;
    }
    prev = cur;
  }
  return out;
}
function components(cs, ctx, P) {
  if (!cs) return 0;
  if (cs === P.PDFName.of('DeviceRGB') || cs === P.PDFName.of('CalRGB')) return 3;
  if (cs === P.PDFName.of('DeviceGray') || cs === P.PDFName.of('CalGray')) return 1;
  if (cs instanceof P.PDFArray && cs.get(0) === P.PDFName.of('ICCBased')) { const st = ctx.lookup(cs.get(1)); const n = st && st.dict && st.dict.get(P.PDFName.of('N')); return n ? n.asNumber() : 0; }
  return 0;   // CMYK, Indexed, Lab, DeviceN…: left untouched (re-encoding could shift colours)
}
async function shrinkImages(doc, P, lvl, gray, onP) {
  const ctx = doc.context, N = (n) => P.PDFName.of(n);
  const imgs = [];
  for (const [ref, obj] of ctx.enumerateIndirectObjects()) if (obj instanceof P.PDFRawStream && obj.dict.get(N('Subtype')) === N('Image')) imgs.push([ref, obj]);
  let done = 0, changed = 0;
  for (const [ref, obj] of imgs) {
    onP(done++ / Math.max(1, imgs.length));
    try {
      const d = obj.dict;
      if (d.get(N('ImageMask')) || d.get(N('Decode'))) continue;
      const w = d.get(N('Width')).asNumber(), h = d.get(N('Height')).asNumber();
      if (w * h < 120 * 120) continue;   // icons and tiny images: not worth it
      let filter = d.get(N('Filter')); if (filter instanceof P.PDFArray) filter = filter.size() === 1 ? filter.get(0) : null;
      const comps = components(ctx.lookup(d.get(N('ColorSpace'))) || d.get(N('ColorSpace')), ctx, P);
      if (comps !== 1 && comps !== 3) continue;
      const bpc = d.get(N('BitsPerComponent'))?.asNumber() || 8;
      let source;
      if (filter === N('DCTDecode')) source = await createImageBitmap(new Blob([obj.contents], { type: 'image/jpeg' }));
      else if (filter === N('FlateDecode') && bpc === 8) {
        let px = await inflate(obj.contents);
        const parms = ctx.lookup(d.get(N('DecodeParms')));
        const pred = parms && parms.get ? parms.get(N('Predictor'))?.asNumber() : 1;
        if (pred >= 10) px = unpredict(px, w, comps); else if (pred > 1) continue;
        if (px.length < w * h * comps) continue;
        const id = new ImageData(w, h);
        for (let i = 0, j = 0; i < w * h; i++, j += comps) { const r = px[j], gg = comps === 3 ? px[j + 1] : r, b = comps === 3 ? px[j + 2] : r; id.data[i * 4] = r; id.data[i * 4 + 1] = gg; id.data[i * 4 + 2] = b; id.data[i * 4 + 3] = 255; }
        source = await createImageBitmap(id);
      } else continue;
      const k = Math.min(1, lvl.px / Math.max(w, h)), W = Math.max(1, Math.round(w * k)), H = Math.max(1, Math.round(h * k));
      const c = new OffscreenCanvas(W, H), g = c.getContext('2d');
      g.imageSmoothingQuality = 'high';
      if (gray) g.filter = 'grayscale(1)';
      g.drawImage(source, 0, 0, W, H); source.close && source.close();
      const jpg = new Uint8Array(await (await c.convertToBlob({ type: 'image/jpeg', quality: lvl.q })).arrayBuffer());
      if (jpg.length >= obj.contents.length * 0.92) continue;   // no real gain: keep the original
      const nd = d.clone(ctx);
      nd.set(N('Filter'), N('DCTDecode')); nd.set(N('Width'), P.PDFNumber.of(W)); nd.set(N('Height'), P.PDFNumber.of(H));
      nd.set(N('BitsPerComponent'), P.PDFNumber.of(8)); nd.set(N('ColorSpace'), N('DeviceRGB')); nd.delete(N('DecodeParms')); nd.delete(N('Length'));
      ctx.assign(ref, P.PDFRawStream.of(nd, jpg));
      changed++;
    } catch (e) { /* unusual image: leave it as it is */ }
  }
  return { total: imgs.length, changed };
}
/** Maximum: every page becomes one JPEG at the chosen DPI. */
async function rasterize(bytes, lvl, gray, onP) {
  const pdfjs = await loadPdfjs(), P = await loadLib('pdflib');
  const src = await pdfjs.getDocument({ data: bytes.slice(), isEvalSupported: false }).promise;
  const out = await P.PDFDocument.create();
  for (let i = 1; i <= src.numPages; i++) {
    onP((i - 1) / src.numPages);
    const page = await src.getPage(i), vp1 = page.getViewport({ scale: 1 }), vp = page.getViewport({ scale: lvl.dpi / 72 });
    const c = document.createElement('canvas'); c.width = Math.ceil(vp.width); c.height = Math.ceil(vp.height);
    const g = c.getContext('2d'); g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: g, viewport: vp }).promise;
    if (gray) { g.filter = 'grayscale(1)'; g.drawImage(c, 0, 0); }
    const jpg = await out.embedJpg(new Uint8Array(await (await new Promise((r) => c.toBlob(r, 'image/jpeg', lvl.q))).arrayBuffer()));
    out.addPage([vp1.width, vp1.height]).drawImage(jpg, { x: 0, y: 0, width: vp1.width, height: vp1.height });
  }
  return out.save({ useObjectStreams: true });
}

async function compress(it) {
  const lvl = LEVELS[els.level.value], gray = els.gray.checked;
  const bytes = new Uint8Array(await it.file.arrayBuffer());
  const onP = (p) => { it.p = p; render(); };
  let outBytes;
  if (lvl.dpi) { it.msg = 'Turning pages into images…'; outBytes = await rasterize(bytes, lvl, gray, onP); }
  else {
    const P = await loadLib('pdflib');
    let doc;
    try { doc = await P.PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false }); }
    catch (e) { throw new Error(/encrypt/i.test(e.message) ? 'This PDF is password-protected. Unlock it first.' : 'This PDF could not be read.'); }
    it.msg = 'Shrinking images…';
    await shrinkImages(doc, P, lvl, gray, onP);
    if (els.meta.checked) { doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setProducer(''); doc.setCreator(''); }
    outBytes = await doc.save({ useObjectStreams: true });
  }
  const blob = new Blob([outBytes], { type: 'application/pdf' });
  it.out = blob.size < it.file.size ? blob : it.file;
}

els.run.addEventListener('click', async () => {
  els.run.disabled = true;
  for (const it of items) {
    if (it.state === 'work') continue;
    it.state = 'work'; it.p = 0; it.msg = 'Compressing…'; render();
    try { await compress(it); it.state = 'done'; }
    catch (e) { console.warn(e); it.state = 'err'; it.msg = e.message || 'Failed'; }
    render();
  }
  const done = items.filter((i) => i.state === 'done'), before = done.reduce((a, i) => a + i.file.size, 0), after = done.reduce((a, i) => a + i.out.size, 0);
  if (done.length) setStatus(els.status, `${formatBytes(before)} → ${formatBytes(after)} (${Math.max(0, Math.round((1 - after / before) * 100))}% smaller).${after >= before * 0.97 ? ' These PDFs were already well compressed; try Strong or Maximum.' : ''}`, 'ok');
  render();
});
window.__pcTest = { get items() { return items; } };
