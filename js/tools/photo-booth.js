/* WebcamClicks — Photo booth: photo strips, animated GIFs and boomerangs from the webcam.
   Everything is captured and encoded in the browser. */

import { $, $$, setStatus, downloadBlob, loadEsm, loadMediabunny, canvasToBlob, formatBytes } from './common.js';

const els = {
  stage: $('#pb-stage'), video: $('#pb-video'), count: $('#pb-count'), flash: $('#pb-flash'), idle: $('#pb-idle'),
  start: $('#pb-start'), shoot: $('#pb-shoot'), camera: $('#pb-camera'), status: $('#t-status'),
  modes: $('#pb-modes'), filters: $('#pb-filters'), shape: $('#pb-shape'), mirror: $('#pb-mirror'), timer: $('#pb-timer'),
  stripOpts: $('#pb-strip-opts'), layout: $('#pb-layout'), frameC: $('#pb-framec'), caption: $('#pb-caption'), date: $('#pb-date'),
  motionOpts: $('#pb-motion-opts'), len: $('#pb-len'), out: $('#pb-out'),
  result: $('#pb-result'), resultMedia: $('#pb-result-media'), resultInfo: $('#pb-result-info'), save: $('#pb-save'), again: $('#pb-again'),
  gallery: $('#pb-gallery'), sound: $('#pb-sound')
};
const store = { get(k, d) { try { return localStorage.getItem(`wc_pb_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_pb_${k}`, v); } catch (_) { /* ignore */ } } };

const FILTERS = {
  none: ['Normal', 'none'], bw: ['B&W', 'grayscale(1) contrast(1.15)'], vintage: ['Vintage', 'sepia(.55) contrast(1.05) saturate(.85) brightness(1.05)'],
  warm: ['Warm', 'sepia(.25) saturate(1.3) hue-rotate(-8deg) brightness(1.04)'], cool: ['Cool', 'saturate(1.1) hue-rotate(12deg) brightness(1.03)'],
  vivid: ['Vivid', 'saturate(1.6) contrast(1.1)'], fade: ['Faded', 'contrast(.85) brightness(1.1) saturate(.8)'], noir: ['Noir', 'grayscale(1) contrast(1.6) brightness(.9)']
};
const SHAPES = { square: [1, 1], portrait: [4, 5], wide: [16, 9], story: [9, 16] };
let mode = store.get('mode', 'strip'), filter = store.get('filter', 'none'), stream = null, busy = false, result = null;
const takes = [];   // { blob, name, url, kind }

/* ---------------------------------------------------------------- UI setup */
els.filters.innerHTML = Object.entries(FILTERS).map(([k, [n]]) => `<button type="button" class="pb-filter" data-f="${k}" aria-pressed="${k === filter}">${n}</button>`).join('');
function setMode(m) {
  mode = m; store.set('mode', m);
  $$('[data-mode]', els.modes).forEach((b) => b.setAttribute('aria-checked', String(b.dataset.mode === m)));
  els.stripOpts.hidden = m !== 'strip'; els.motionOpts.hidden = m === 'strip';
  els.shoot.textContent = m === 'strip' ? '📸 Take 4 photos' : m === 'gif' ? '🎞️ Record GIF' : '🔁 Record boomerang';
  els.out.querySelector('option[value="mp4"]').disabled = false;
  if (m === 'gif') els.out.value = 'gif';
  applyPreview();
}
els.modes.addEventListener('click', (e) => { const b = e.target.closest('[data-mode]'); if (b && !busy) setMode(b.dataset.mode); });
els.filters.addEventListener('click', (e) => {
  const b = e.target.closest('[data-f]'); if (!b) return;
  filter = b.dataset.f; store.set('filter', filter);
  $$('[data-f]', els.filters).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); applyPreview();
});
els.mirror.checked = store.get('mirror', '1') === '1';
els.shape.value = store.get('shape', 'square');
[els.mirror, els.shape].forEach((x) => x.addEventListener('change', () => { store.set('mirror', els.mirror.checked ? '1' : '0'); store.set('shape', els.shape.value); applyPreview(); }));
function applyPreview() {
  els.video.style.filter = FILTERS[filter][1];
  els.video.style.transform = els.mirror.checked ? 'scaleX(-1)' : '';
  const [a, b] = mode === 'strip' ? [4, 3] : SHAPES[els.shape.value];
  els.stage.style.setProperty('--ar', `${a} / ${b}`);
}

/* ---------------------------------------------------------------- camera */
async function startCamera(deviceId) {
  try {
    if (stream) stream.getTracks().forEach((t) => t.stop());
    stream = await navigator.mediaDevices.getUserMedia({ video: { ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: 'user' }), width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
    els.video.srcObject = stream; await els.video.play().catch(() => {});
    els.stage.classList.add('live'); els.shoot.disabled = false; els.start.hidden = true;
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    if (cams.length > 1) {
      els.camera.hidden = false;
      const cur = stream.getVideoTracks()[0].getSettings().deviceId;
      els.camera.innerHTML = cams.map((c, i) => `<option value="${c.deviceId}" ${c.deviceId === cur ? 'selected' : ''}>${c.label || `Camera ${i + 1}`}</option>`).join('');
    }
    setStatus(els.status, 'Camera ready. Strike a pose!');
  } catch (e) {
    setStatus(els.status, e.name === 'NotAllowedError' ? 'Camera access was blocked. Allow the camera for this site (the icon in the address bar) and try again.' : e.name === 'NotFoundError' ? 'No camera was found.' : `Could not start the camera: ${e.message}`, 'err');
  }
}
els.start.addEventListener('click', () => startCamera());
els.camera.addEventListener('change', () => startCamera(els.camera.value));

/* ---------------------------------------------------------------- capture helpers */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let actx = null;
function beep(freq = 880, dur = 0.08, vol = 0.15) {
  if (!els.sound.checked) return;
  try { actx = actx || new AudioContext(); const o = actx.createOscillator(), g = actx.createGain(); o.frequency.value = freq; g.gain.value = vol; o.connect(g).connect(actx.destination); o.start(); g.gain.exponentialRampToValueAtTime(0.0001, actx.currentTime + dur); o.stop(actx.currentTime + dur + 0.02); } catch (_) { /* ignore */ }
}
function shutter() { beep(1400, 0.05, 0.2); setTimeout(() => beep(700, 0.07, 0.15), 50); els.flash.classList.remove('go'); void els.flash.offsetWidth; els.flash.classList.add('go'); }
async function countdown(sec) {
  for (let s = sec; s > 0; s--) { els.count.textContent = s; els.count.hidden = false; beep(660, 0.06); await sleep(1000); }
  els.count.hidden = true;
}
/** Draw the current camera frame into a w×h box (cover crop, mirror, filter). */
function grab(g, x, y, w, h) {
  const v = els.video, vw = v.videoWidth, vh = v.videoHeight;
  const s = Math.max(w / vw, h / vh), sw = w / s, sh = h / s, sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  g.save(); g.beginPath(); g.rect(x, y, w, h); g.clip();
  g.filter = FILTERS[filter][1];
  if (els.mirror.checked) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(v, sx, sy, sw, sh, 0, 0, w, h); }
  else g.drawImage(v, sx, sy, sw, sh, x, y, w, h);
  g.restore();
}

/* ---------------------------------------------------------------- photo strip */
async function shootStrip() {
  const shots = [];
  const W = 900, H = 675;   // each photo, 4:3
  for (let i = 0; i < 4; i++) {
    setStatus(els.status, `Photo ${i + 1} of 4…`);
    await countdown(i === 0 ? +els.timer.value : Math.min(3, +els.timer.value || 2));
    const c = document.createElement('canvas'); c.width = W; c.height = H; grab(c.getContext('2d'), 0, 0, W, H);
    shutter(); shots.push(c); await sleep(450);
  }
  const layout = els.layout.value, frame = els.frameC.value, pad = 40, gap = 28;
  const cols = layout === 'grid' ? 2 : layout === 'row' ? 4 : 1, rows = 4 / cols;
  const foot = els.caption.value.trim() || els.date.checked ? 150 : pad;
  const out = document.createElement('canvas');
  out.width = pad * 2 + cols * W + (cols - 1) * gap; out.height = pad + rows * H + (rows - 1) * gap + foot;
  const g = out.getContext('2d');
  g.fillStyle = frame; g.fillRect(0, 0, out.width, out.height);
  shots.forEach((s, i) => { const cx = i % cols, cy = Math.floor(i / cols); g.drawImage(s, pad + cx * (W + gap), pad + cy * (H + gap)); });
  const light = luminance(frame) > 0.5;
  g.fillStyle = light ? '#1a1a1a' : '#ffffff'; g.textAlign = 'center';
  const cap = els.caption.value.trim(), date = els.date.checked ? new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const fy = out.height - foot;
  if (cap) { g.font = `700 ${Math.min(72, Math.round(out.width / Math.max(8, cap.length) * 1.6))}px Poppins, Inter, system-ui, sans-serif`; g.fillText(cap, out.width / 2, fy + (date ? 78 : 95)); }
  if (date) { g.globalAlpha = 0.7; g.font = `500 ${cap ? 34 : 44}px Inter, system-ui, sans-serif`; g.fillText(date, out.width / 2, fy + (cap ? 126 : 92)); g.globalAlpha = 1; }
  const blob = await canvasToBlob(out, 'image/jpeg', 0.92);
  return { blob, name: `photo-strip-${stamp()}.jpg`, kind: 'image', info: `${out.width}×${out.height} JPG` };
}
function luminance(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }
const stamp = () => new Date().toISOString().slice(0, 19).replace(/[T:]/g, '-');

/* ---------------------------------------------------------------- GIF & boomerang */
async function recordFrames(seconds, fps, w, h) {
  const frames = [], n = Math.round(seconds * fps);
  els.stage.classList.add('rec');
  const t0 = performance.now();
  for (let i = 0; i < n; i++) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; grab(c.getContext('2d'), 0, 0, w, h); frames.push(c);
    const next = t0 + ((i + 1) * 1000) / fps; await sleep(Math.max(0, next - performance.now()));
  }
  els.stage.classList.remove('rec');
  return frames;
}
async function encodeGif(frames, fps) {
  const { GIFEncoder, quantize, applyPalette } = await loadEsm('gifenc');
  const enc = GIFEncoder(), w = frames[0].width, h = frames[0].height;
  // one shared palette from a few frames keeps colours steady (no flicker) and the file small
  const sample = document.createElement('canvas'); sample.width = w; sample.height = h * 3; const sg = sample.getContext('2d', { willReadFrequently: true });
  [0, Math.floor(frames.length / 2), frames.length - 1].forEach((k, i) => sg.drawImage(frames[k], 0, h * i));
  const palette = quantize(sg.getImageData(0, 0, w, h * 3).data, 256, { format: 'rgb565' });
  for (let i = 0; i < frames.length; i++) {
    const data = frames[i].getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;
    enc.writeFrame(applyPalette(data, palette, 'rgb565'), w, h, { palette, delay: Math.round(1000 / fps), repeat: 0 });
    if (i % 4 === 0) { setStatus(els.status, `Creating GIF… ${Math.round((i / frames.length) * 100)}%`); await sleep(0); }
  }
  enc.finish();
  return new Blob([enc.bytes()], { type: 'image/gif' });
}
async function encodeMp4(frames, fps, loops) {
  const MB = await loadMediabunny();
  const w = frames[0].width, h = frames[0].height;
  const codec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: w, height: h });
  if (!codec) throw new Error('Your browser can\'t make videos; choose GIF instead.');
  const canvas = new OffscreenCanvas(w, h), g = canvas.getContext('2d');
  const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
  const src = new MB.CanvasSource(canvas, { codec, bitrate: 4_000_000, keyFrameInterval: 1 });
  output.addVideoTrack(src, { frameRate: fps }); await output.start();
  let k = 0;
  for (let l = 0; l < loops; l++) for (const f of frames) { g.drawImage(f, 0, 0); await src.add(k / fps, 1 / fps); k++; }
  await output.finalize();
  return new Blob([output.target.buffer], { type: 'video/mp4' });
}
async function shootMotion() {
  const [a, b] = SHAPES[els.shape.value], long = 540, w = Math.round((a >= b ? long : long * a / b) / 2) * 2, h = Math.round((a >= b ? long * b / a : long) / 2) * 2;
  const secs = +els.len.value, fps = mode === 'gif' ? 10 : 20;
  await countdown(+els.timer.value);
  setStatus(els.status, 'Recording… move!');
  beep(990, 0.12);
  let frames = await recordFrames(secs, fps, w, h);
  beep(520, 0.12);
  if (mode === 'boomerang') frames = [...frames, ...frames.slice(1, -1).reverse()];   // forwards, then backwards
  const fmt = els.out.value;
  setStatus(els.status, fmt === 'gif' ? 'Creating GIF…' : 'Creating video…');
  const blob = fmt === 'gif' ? await encodeGif(frames, mode === 'boomerang' ? fps : fps) : await encodeMp4(frames, fps, mode === 'boomerang' ? 4 : 2);
  return { blob, name: `${mode}-${stamp()}.${fmt}`, kind: fmt === 'gif' ? 'image' : 'video', info: `${w}×${h} ${fmt.toUpperCase()}` };
}

/* ---------------------------------------------------------------- shoot / results */
els.shoot.addEventListener('click', async () => {
  if (busy || !stream) return;
  busy = true; els.shoot.disabled = true; els.modes.classList.add('locked');
  try {
    const r = mode === 'strip' ? await shootStrip() : await shootMotion();
    showResult(r);
    setStatus(els.status, 'Done! Save it, or take another.', 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Something went wrong.', 'err'); }
  els.count.hidden = true; els.stage.classList.remove('rec');
  busy = false; els.shoot.disabled = false; els.modes.classList.remove('locked');
});
function showResult(r) {
  r.url = URL.createObjectURL(r.blob); result = r; takes.unshift(r);
  els.result.hidden = false;
  els.resultMedia.innerHTML = r.kind === 'video' ? `<video src="${r.url}" autoplay loop muted playsinline></video>` : `<img src="${r.url}" alt="Your ${mode === 'strip' ? 'photo strip' : mode}">`;
  els.resultInfo.textContent = `${r.info} · ${formatBytes(r.blob.size)}`;
  els.gallery.innerHTML = takes.slice(0, 12).map((t, i) => `<button type="button" class="pb-take" data-i="${i}" aria-label="Open take ${i + 1}">${t.kind === 'video' ? `<video src="${t.url}" muted playsinline></video>` : `<img src="${t.url}" alt="">`}</button>`).join('');
  els.result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}
els.gallery.addEventListener('click', (e) => { const b = e.target.closest('[data-i]'); if (!b) return; const t = takes[+b.dataset.i]; takes.splice(+b.dataset.i, 1); showResult(t); });
els.save.addEventListener('click', () => result && downloadBlob(result.blob, result.name));
els.again.addEventListener('click', () => els.shoot.click());

els.sound.checked = store.get('sound', '1') === '1';
els.sound.addEventListener('change', () => store.set('sound', els.sound.checked ? '1' : '0'));
setMode(mode); applyPreview();
if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { els.start.disabled = true; setStatus(els.status, 'This browser can\'t use a camera.', 'err'); }
window.__pbTest = { setMode, get takes() { return takes; } };
