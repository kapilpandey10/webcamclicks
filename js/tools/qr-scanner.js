/* WebcamClicks — QR & barcode scanner (camera or image). On-device: the browser's BarcodeDetector when it
   supports the formats, otherwise ZXing compiled to WebAssembly. Nothing is uploaded. */

import { $, setupDropzone, setStatus, escapeHtml, copyText, downloadBlob, loadEsm, decodeImage, ESM } from './common.js';

const els = {
  video: $('#qr-video'), overlay: $('#qr-overlay'), stage: $('#qr-stage'), start: $('#qr-start'), cam: $('#qr-camera'), torch: $('#qr-torch'),
  results: $('#qr-results'), history: $('#qr-history'), clearHist: $('#qr-clear'), drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'),
  beep: $('#qr-beep'), multi: $('#qr-multi')
};
const HKEY = 'wc_qr_history';

/* ---------------------------------------------------------------- decoders */
let zx = null, native = null;
async function zxing() {
  if (!zx) {
    zx = loadEsm('zxing').then((m) => {
      const base = ESM.zxing.replace(/es\/reader\/index\.js$/, 'reader/');
      m.prepareZXingModule({ overrides: { locateFile: (path, prefix) => (path.endsWith('.wasm') ? base + path : prefix + path) }, fireImmediately: true });
      return m;
    });
  }
  return zx;
}
async function nativeDetector() {
  if (native !== null) return native;
  native = false;
  try {
    if ('BarcodeDetector' in window) {
      const f = await window.BarcodeDetector.getSupportedFormats();
      if (f.includes('qr_code') && f.length > 4) native = new window.BarcodeDetector({ formats: f });
    }
  } catch (_) { native = false; }
  return native;
}
const NAMES = { qr_code: 'QR code', ean_13: 'EAN-13', ean_8: 'EAN-8', upc_a: 'UPC-A', upc_e: 'UPC-E', code_128: 'Code 128', code_39: 'Code 39', code_93: 'Code 93', codabar: 'Codabar', itf: 'ITF', data_matrix: 'Data Matrix', aztec: 'Aztec', pdf417: 'PDF417',
  QRCode: 'QR code', MicroQRCode: 'Micro QR', rMQRCode: 'rMQR', Code128: 'Code 128', Code39: 'Code 39', Code93: 'Code 93', DataMatrix: 'Data Matrix', DataBar: 'DataBar', DataBarExpanded: 'DataBar Expanded', DataBarLimited: 'DataBar Limited', DXFilmEdge: 'DX film edge', MaxiCode: 'MaxiCode' };
const fmtName = (f) => NAMES[f] || NAMES[String(f).toLowerCase().replace(/[-\s]/g, '_')] || String(f);

/** Detect codes in a canvas / image. Returns [{ format, text, points:[[x,y]…] }]. */
async function detect(source, w, h) {
  const nd = await nativeDetector();
  if (nd) {
    try {
      const r = await nd.detect(source);
      return r.map((c) => ({ format: fmtName(c.format), text: c.rawValue, points: (c.cornerPoints || []).map((p) => [p.x, p.y]) }));
    } catch (_) { /* fall back to ZXing */ }
  }
  const m = await zxing();
  const c = source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas ? source : (() => { const cv = document.createElement('canvas'); cv.width = w; cv.height = h; cv.getContext('2d').drawImage(source, 0, 0, w, h); return cv; })();
  const img = c.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, c.width, c.height);
  const r = await m.readBarcodes(img, { tryHarder: true, maxNumberOfSymbols: els.multi.checked ? 8 : 1, formats: [] });
  return r.filter((x) => x.isValid).map((x) => ({ format: fmtName(x.format), text: x.text, points: x.position ? ['topLeft', 'topRight', 'bottomRight', 'bottomLeft'].map((k) => [x.position[k].x, x.position[k].y]) : [] }));
}

/* ---------------------------------------------------------------- understanding the content */
function parse(text, format) {
  const t = text.trim();
  if (/^WIFI:/i.test(t)) {
    const get = (k) => { const m = new RegExp(`[;:]${k}:((?:\\\\.|[^;])*)`, 'i').exec(t); return m ? m[1].replace(/\\(.)/g, '$1') : ''; };
    return { type: 'Wi-Fi network', rows: [['Network', get('S')], ['Password', get('P') || '(none)'], ['Security', get('T') || 'Open'], ['Hidden', /H:true/i.test(t) ? 'Yes' : '']], copy: get('P'), copyLabel: 'Copy password' };
  }
  if (/^BEGIN:VCARD/i.test(t) || /^MECARD:/i.test(t)) {
    const field = (re) => (t.match(re) || [])[1] || '';
    const name = field(/\nFN[^:]*:(.+)/i) || field(/MECARD:N:([^;]+)/i) || field(/\nN[^:]*:([^\n]+)/i).replace(/;/g, ' ').trim();
    return { type: 'Contact', rows: [['Name', name], ['Phone', field(/\nTEL[^:]*:(.+)/i) || field(/TEL:([^;]+)/i)], ['E-mail', field(/\nEMAIL[^:]*:(.+)/i) || field(/EMAIL:([^;]+)/i)], ['Organisation', field(/\nORG[^:]*:(.+)/i)], ['Website', field(/\nURL[^:]*:(.+)/i) || field(/URL:([^;]+)/i)]],
      vcf: /^BEGIN:VCARD/i.test(t) ? t : `BEGIN:VCARD\nVERSION:3.0\nFN:${name}\nTEL:${field(/TEL:([^;]+)/i)}\nEMAIL:${field(/EMAIL:([^;]+)/i)}\nEND:VCARD`, name };
  }
  if (/^BEGIN:VEVENT|^BEGIN:VCALENDAR/i.test(t)) return { type: 'Calendar event', rows: [['Event', (t.match(/SUMMARY:(.+)/i) || [])[1] || ''], ['Starts', (t.match(/DTSTART[^:]*:(.+)/i) || [])[1] || '']], ics: t.includes('VCALENDAR') ? t : `BEGIN:VCALENDAR\nVERSION:2.0\n${t}\nEND:VCALENDAR` };
  if (/^mailto:/i.test(t)) return { type: 'E-mail', rows: [['To', decodeURIComponent(t.slice(7).split('?')[0])]], link: t, linkLabel: 'Write e-mail' };
  if (/^(tel|sms|smsto):/i.test(t)) return { type: /^tel/i.test(t) ? 'Phone number' : 'Text message', rows: [['Number', t.split(':')[1]]], link: t.replace(/^smsto:/i, 'sms:'), linkLabel: /^tel/i.test(t) ? 'Call' : 'Send SMS' };
  if (/^geo:/i.test(t)) { const [lat, lon] = t.slice(4).split(/[,?]/); return { type: 'Location', rows: [['Coordinates', `${lat}, ${lon}`]], link: `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}`, linkLabel: 'Open map' }; }
  if (/^upi:\/\//i.test(t)) { const u = new URL(t); return { type: 'UPI payment', rows: [['Payee', u.searchParams.get('pn') || ''], ['UPI ID', u.searchParams.get('pa') || ''], ['Amount', u.searchParams.get('am') || 'not set']], warn: 'Check the payee name and UPI ID carefully before paying.' }; }
  if (/^https?:\/\/\S+$/i.test(t) || /^www\.\S+$/i.test(t)) {
    const url = /^www\./i.test(t) ? `https://${t}` : t; let host = '';
    try { host = new URL(url).hostname; } catch (_) { /* ignore */ }
    const short = /^(bit\.ly|tinyurl\.com|t\.co|goo\.gl|ow\.ly|is\.gd|rb\.gy|cutt\.ly|shorturl\.at|qrco\.de)$/i.test(host);
    return { type: 'Website link', rows: [['Website', host], ['Full link', url]], link: url, linkLabel: `Open ${host}`,
      warn: /^http:/i.test(url) ? 'This link is not secure (http).' : short ? 'This is a shortened link: the real destination is hidden until you open it.' : /xn--/.test(host) ? 'This address uses look-alike international characters. Be careful.' : '' };
  }
  if (/^(EAN|UPC)/i.test(format) || /^\d{8,14}$/.test(t) && /EAN|UPC|ITF/i.test(format)) return { type: 'Product barcode', rows: [['Number', t]], link: `https://www.google.com/search?q=${encodeURIComponent(t)}`, linkLabel: 'Search this product' };
  return { type: 'Text', rows: [['Text', t]] };
}

/* ---------------------------------------------------------------- results & history */
let history = [];
try { history = JSON.parse(localStorage.getItem(HKEY) || '[]'); } catch (_) { history = []; }
const saveHist = () => { try { localStorage.setItem(HKEY, JSON.stringify(history.slice(0, 50))); } catch (_) { /* ignore */ } };

function card(code) {
  const p = parse(code.text, code.format);
  const rows = p.rows.filter(([, v]) => v).map(([k, v]) => `<tr><th>${escapeHtml(k)}</th><td>${escapeHtml(v)}</td></tr>`).join('');
  const acts = [`<button type="button" class="t-btn sm" data-copy="${escapeHtml(code.text)}">Copy</button>`];
  if (p.copy) acts.push(`<button type="button" class="t-btn sm" data-copy="${escapeHtml(p.copy)}">${escapeHtml(p.copyLabel)}</button>`);
  if (p.link) acts.unshift(`<a class="t-btn sm primary" href="${escapeHtml(p.link)}" target="_blank" rel="noopener noreferrer nofollow">${escapeHtml(p.linkLabel)} ↗</a>`);
  if (p.vcf) acts.push(`<button type="button" class="t-btn sm" data-dl="vcf">Save contact</button>`);
  if (p.ics) acts.push(`<button type="button" class="t-btn sm" data-dl="ics">Add to calendar</button>`);
  return `<li class="qr-card" data-text="${escapeHtml(code.text)}" data-format="${escapeHtml(code.format)}"><div class="qr-card-h"><b>${escapeHtml(p.type)}</b><small>${escapeHtml(code.format)}${code.time ? ` · ${new Date(code.time).toLocaleString()}` : ''}</small></div>
    <table class="t-table">${rows}</table>${p.warn ? `<p class="qr-warn">⚠️ ${escapeHtml(p.warn)}</p>` : ''}<div class="t-actions">${acts.join('')}</div></li>`;
}
function showResults(codes) { els.results.innerHTML = codes.map(card).join(''); }
function renderHistory() {
  els.history.innerHTML = history.length ? history.map(card).join('') : '<li class="muted">Codes you scan appear here (stored only in this browser).</li>';
  els.clearHist.hidden = !history.length;
}
function remember(codes) {
  for (const c of codes) {
    history = history.filter((h) => h.text !== c.text);
    history.unshift({ ...c, points: undefined, time: Date.now() });
  }
  saveHist(); renderHistory();
}
[els.results, els.history].forEach((list) => list.addEventListener('click', async (e) => {
  const cp = e.target.closest('[data-copy]');
  if (cp) { setStatus(els.status, (await copyText(cp.dataset.copy)) ? 'Copied.' : 'Copy failed.', 'ok'); return; }
  const dl = e.target.closest('[data-dl]'); if (!dl) return;
  const li = dl.closest('.qr-card'), p = parse(li.dataset.text, li.dataset.format);
  if (dl.dataset.dl === 'vcf') downloadBlob(new Blob([p.vcf], { type: 'text/vcard' }), `${(p.name || 'contact').replace(/[^\w ]+/g, '').trim() || 'contact'}.vcf`);
  else downloadBlob(new Blob([p.ics], { type: 'text/calendar' }), 'event.ics');
}));
els.clearHist.addEventListener('click', () => { history = []; saveHist(); renderHistory(); });

let audioCtx = null;
function beep() {
  if (navigator.vibrate) navigator.vibrate(60);
  if (!els.beep.checked) return;
  try {
    audioCtx = audioCtx || new AudioContext();
    const o = audioCtx.createOscillator(), g = audioCtx.createGain();
    o.frequency.value = 1320; g.gain.setValueAtTime(0.15, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
    o.connect(g).connect(audioCtx.destination); o.start(); o.stop(audioCtx.currentTime + 0.13);
  } catch (_) { /* ignore */ }
}

/* ---------------------------------------------------------------- camera */
let stream = null, running = false, lastText = '', lastAt = 0, busy = false;
const work = document.createElement('canvas');
async function listCameras() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    els.cam.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${escapeHtml(d.label || `Camera ${i + 1}`)}</option>`).join('');
    els.cam.hidden = devs.length < 2;
    const cur = stream && stream.getVideoTracks()[0].getSettings().deviceId; if (cur) els.cam.value = cur;
  } catch (_) { /* ignore */ }
}
async function startCamera(deviceId) {
  stopCamera();
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: deviceId ? { deviceId: { exact: deviceId }, width: { ideal: 1920 }, height: { ideal: 1080 } } : { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
  } catch (e) { setStatus(els.status, e.name === 'NotAllowedError' ? 'Camera permission was blocked. Allow it in the address bar, or scan an image instead.' : 'No camera found. You can still scan an image.', 'err'); return; }
  els.video.srcObject = stream; await els.video.play().catch(() => {});
  els.stage.classList.add('live'); els.start.textContent = '■ Stop camera';
  const track = stream.getVideoTracks()[0], caps = track.getCapabilities ? track.getCapabilities() : {};
  els.torch.hidden = !caps.torch;
  listCameras();
  setStatus(els.status, 'Point the camera at a QR code or barcode.');
  running = true; loop();
}
function stopCamera() {
  running = false;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null; els.video.srcObject = null; els.stage.classList.remove('live'); els.start.textContent = '📷 Start camera'; els.torch.hidden = true;
  const g = els.overlay.getContext('2d'); g.clearRect(0, 0, els.overlay.width, els.overlay.height);
}
async function loop() {
  if (!running) return;
  const v = els.video;
  if (v.videoWidth && !busy) {
    busy = true;
    const s = Math.min(1, 1280 / Math.max(v.videoWidth, v.videoHeight));
    work.width = Math.round(v.videoWidth * s); work.height = Math.round(v.videoHeight * s);
    work.getContext('2d', { willReadFrequently: true }).drawImage(v, 0, 0, work.width, work.height);
    try {
      const codes = await detect(work, work.width, work.height);
      drawBoxes(codes, s);
      if (codes.length) {
        const key = codes.map((c) => c.text).join('|');
        if (key !== lastText || Date.now() - lastAt > 4000) { beep(); showResults(codes); remember(codes); setStatus(els.status, `Found ${codes.length} code${codes.length > 1 ? 's' : ''}.`, 'ok'); }
        lastText = key; lastAt = Date.now();
      }
    } catch (e) { console.warn(e); }
    busy = false;
  }
  setTimeout(() => requestAnimationFrame(loop), 120);
}
function drawBoxes(codes, s) {
  const c = els.overlay, v = els.video;
  c.width = v.videoWidth; c.height = v.videoHeight;
  const g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  g.lineWidth = Math.max(4, c.width / 200); g.strokeStyle = '#3dff6e'; g.fillStyle = 'rgba(61,255,110,.18)'; g.lineJoin = 'round';
  for (const code of codes) {
    if (code.points.length < 3) continue;
    g.beginPath(); code.points.forEach(([x, y], i) => (i ? g.lineTo(x / s, y / s) : g.moveTo(x / s, y / s))); g.closePath(); g.fill(); g.stroke();
  }
}
els.start.addEventListener('click', () => (stream ? stopCamera() : startCamera()));
els.cam.addEventListener('change', () => startCamera(els.cam.value));
let torchOn = false;
els.torch.addEventListener('click', async () => { const t = stream && stream.getVideoTracks()[0]; if (!t) return; torchOn = !torchOn; try { await t.applyConstraints({ advanced: [{ torch: torchOn }] }); } catch (_) { /* ignore */ } els.torch.setAttribute('aria-pressed', String(torchOn)); });
document.addEventListener('visibilitychange', () => { if (document.hidden && stream) stopCamera(); });

/* ---------------------------------------------------------------- images */
async function scanFiles(files) {
  const all = [];
  for (const f of files) {
    try {
      const bmp = await decodeImage(f);
      const w = bmp.width || bmp.naturalWidth, h = bmp.height || bmp.naturalHeight, s = Math.min(1, 2400 / Math.max(w, h));
      const cv = document.createElement('canvas'); cv.width = Math.round(w * s); cv.height = Math.round(h * s);
      cv.getContext('2d', { willReadFrequently: true }).drawImage(bmp, 0, 0, cv.width, cv.height);
      let codes = await detect(cv, cv.width, cv.height);
      if (!codes.length && s < 1) {   // small codes in big photos: try full resolution
        cv.width = w; cv.height = h; cv.getContext('2d').drawImage(bmp, 0, 0); codes = await detect(cv, w, h);
      }
      all.push(...codes);
    } catch (e) { console.warn(e); }
  }
  if (all.length) { showResults(all); remember(all); beep(); setStatus(els.status, `Found ${all.length} code${all.length > 1 ? 's' : ''}.`, 'ok'); }
  else setStatus(els.status, 'No QR code or barcode found. Try a sharper, closer, well-lit image.', 'err');
}
setupDropzone(els.drop, els.input, (files) => scanFiles(files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif)$/i.test(f.name))));
renderHistory();
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { els.start.disabled = true; setStatus(els.status, 'This browser has no camera access. Scan an image instead.'); }
window.__qrTest = { parse, detect };
