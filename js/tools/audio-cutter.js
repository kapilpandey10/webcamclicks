/* WebcamClicks — Audio cutter & ringtone maker: pick a part of a song (or a video's sound) on the waveform,
   add fades, save MP3, M4A, iPhone ringtone (M4R) or WAV. Decoded and encoded on the device. */

import { $, setupDropzone, setStatus, downloadBlob, loadMediabunny, formatBytes, splitName, fmtTime } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $('#ac-work'), wave: $('#ac-wave'), waveWrap: $('#ac-wave-wrap'), info: $('#ac-info'),
  start: $('#ac-start'), end: $('#ac-end'), len: $('#ac-len'), play: $('#ac-play'), fin: $('#ac-fin'), fout: $('#ac-fout'), finV: $('#ac-fin-v'), foutV: $('#ac-fout-v'),
  fmt: $('#ac-fmt'), bitrate: $('#ac-bitrate'), norm: $('#ac-norm'), run: $('#ac-run'), preset: $('#ac-preset'), note: $('#ac-note')
};
let buf = null, name = 'audio', ctx = null, player = null, playStart = 0, raf = 0;
// the ringtone pages use the same cutter with ringtone defaults (main[data-mode] = ringtone | iphone)
const MODE = document.querySelector('main')?.dataset.mode || '';
let stickyNote = '';
if (MODE === 'iphone') { els.preset.value = 'ring30'; els.fmt.value = 'm4r'; els.fin.value = 1; els.fout.value = 2; }
else if (MODE === 'ringtone') { els.preset.value = 'ring30'; els.fmt.value = 'mp3'; els.fin.value = 1; els.fout.value = 2; }
const sel = { a: 0, b: 30 };

/* ---------------------------------------------------------------- decode */
async function decode(file) {
  ctx = ctx || new AudioContext();
  try { return await ctx.decodeAudioData(await file.arrayBuffer()); }
  catch (_) {   // formats the browser can't decode directly (e.g. some MKV/MOV): read the track with mediabunny
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
    const at = await input.getPrimaryAudioTrack(); if (!at) throw new Error('This file has no sound.');
    const first = await at.getFirstTimestamp().catch(() => 0), parts = [];
    for await (const wb of new MB.AudioBufferSink(at).buffers()) parts.push(wb);
    const sr = parts[0].buffer.sampleRate, end = parts.at(-1).timestamp - first + parts.at(-1).buffer.duration;
    const off = new OfflineAudioContext(2, Math.ceil(end * sr), sr);
    for (const wb of parts) { const s = off.createBufferSource(); s.buffer = wb.buffer; s.connect(off.destination); s.start(Math.max(0, wb.timestamp - first)); }
    return off.startRendering();
  }
}
async function open(files) {
  const f = files.find((x) => /^(audio|video)\//.test(x.type) || /\.(mp3|m4a|aac|wav|ogg|oga|opus|flac|mp4|mov|webm|mkv)$/i.test(x.name));
  if (!f) { setStatus(els.status, 'Please choose a song, voice recording or video.', 'err'); return; }
  stop(); setStatus(els.status, 'Reading the sound…');
  try { buf = await decode(f); } catch (e) { setStatus(els.status, e.message || 'This file could not be read.', 'err'); return; }
  name = splitName(f.name)[0] || 'audio';
  els.work.hidden = false; els.drop.classList.add('compact'); els.run.disabled = false;
  els.info.textContent = `${f.name} · ${fmtTime(buf.duration)} · ${buf.numberOfChannels > 1 ? 'stereo' : 'mono'} · ${formatBytes(f.size)}`;
  applyPreset(true);
  drawWave();
  setStatus(els.status, 'Drag the handles (or the highlighted part) on the waveform, then press play to listen.', 'ok');
}
setupDropzone(els.drop, els.input, open);

/* ---------------------------------------------------------------- waveform */
let peaks = null;
function drawWave() {
  if (!buf) return;
  const c = els.wave, dpr = Math.min(2, devicePixelRatio || 1), w = Math.max(200, c.clientWidth), h = c.clientHeight || 140;
  c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
  const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, w, h);
  if (!peaks || peaks.length !== Math.round(w)) {
    const n = Math.round(w), d0 = buf.getChannelData(0), d1 = buf.numberOfChannels > 1 ? buf.getChannelData(1) : d0, step = d0.length / n;
    peaks = new Float32Array(n);
    for (let i = 0; i < n; i++) { let m = 0; const a = Math.floor(i * step), b = Math.min(d0.length, Math.floor((i + 1) * step)); for (let j = a; j < b; j += 4) { const v = Math.max(Math.abs(d0[j]), Math.abs(d1[j])); if (v > m) m = v; } peaks[i] = m; }
    const mx = Math.max(0.01, ...peaks); for (let i = 0; i < n; i++) peaks[i] /= mx;
  }
  const xa = (sel.a / buf.duration) * w, xb = (sel.b / buf.duration) * w;
  for (let i = 0; i < peaks.length; i++) {
    const ph = Math.max(1, peaks[i] * (h - 10)); const inSel = i >= xa && i <= xb;
    g.fillStyle = inSel ? '#ff4d2e' : '#c9ccd4'; g.fillRect(i, (h - ph) / 2, 1, ph);
  }
  g.fillStyle = 'rgba(255,77,46,.10)'; g.fillRect(xa, 0, xb - xa, h);
  [xa, xb].forEach((x) => { g.fillStyle = '#ff4d2e'; g.fillRect(x - 1.5, 0, 3, h); g.beginPath(); g.arc(x, h / 2, 7, 0, Math.PI * 2); g.fill(); });
  if (player) { const t = sel.a + (ctx.currentTime - playStart); const x = (t / buf.duration) * w; g.fillStyle = '#131318'; g.fillRect(x - 1, 0, 2, h); }
}
new ResizeObserver(() => { peaks = null; drawWave(); }).observe(els.waveWrap);
function setSel(a, b, fromInputs) {
  const d = buf.duration;
  a = Math.max(0, Math.min(d - 0.1, a)); b = Math.max(a + 0.1, Math.min(d, b));
  sel.a = a; sel.b = b;
  if (!fromInputs) { els.start.value = a.toFixed(2); els.end.value = b.toFixed(2); }
  els.len.textContent = `${fmtTime(a)} → ${fmtTime(b)} · ${(b - a).toFixed(1)} s`;
  const ring = els.fmt.value === 'm4r' && b - a > 40;
  const msg = ring ? 'iPhone ringtones can be at most 40 seconds: shorten the selection.' : stickyNote;
  els.note.hidden = !msg; els.note.textContent = msg;
  drawWave();
}
let wdrag = null;
els.wave.addEventListener('pointerdown', (e) => {
  if (!buf) return;
  const r = els.wave.getBoundingClientRect(), t = ((e.clientX - r.left) / r.width) * buf.duration, tol = (12 / r.width) * buf.duration;
  const which = Math.abs(t - sel.a) < tol ? 'a' : Math.abs(t - sel.b) < tol ? 'b' : t > sel.a && t < sel.b ? 'move' : 'new';
  wdrag = { which, t0: t, a: sel.a, b: sel.b };
  if (which === 'new') { wdrag.which = 'b'; setSel(t, t + 0.1); wdrag.a = t; }
  els.wave.setPointerCapture(e.pointerId);
});
els.wave.addEventListener('pointermove', (e) => {
  if (!wdrag) return;
  const r = els.wave.getBoundingClientRect(), t = Math.max(0, Math.min(buf.duration, ((e.clientX - r.left) / r.width) * buf.duration));
  if (wdrag.which === 'a') setSel(Math.min(t, sel.b - 0.1), sel.b);
  else if (wdrag.which === 'b') setSel(sel.a, Math.max(t, sel.a + 0.1));
  else { const len = wdrag.b - wdrag.a, a = Math.max(0, Math.min(buf.duration - len, wdrag.a + t - wdrag.t0)); setSel(a, a + len); }
});
els.wave.addEventListener('pointerup', () => { if (wdrag) { wdrag = null; if (player) { stop(); play(); } } });
[els.start, els.end].forEach((x) => x.addEventListener('change', () => buf && setSel(+els.start.value || 0, +els.end.value || buf.duration, true)));
[els.fin, els.fout].forEach((x) => x.addEventListener('input', () => { els.finV.textContent = `${els.fin.value} s`; els.foutV.textContent = `${els.fout.value} s`; }));

function applyPreset(initial) {
  if (!buf) return;
  const p = els.preset.value, d = buf.duration;
  if (p === 'ring30') { const a = initial ? Math.min(Math.max(0, d * 0.3), Math.max(0, d - 30)) : sel.a; setSel(a, Math.min(d, a + 30)); els.fin.value = 1; els.fout.value = 2; }
  else if (p === 'ring40') { const a = initial ? Math.min(Math.max(0, d * 0.3), Math.max(0, d - 40)) : sel.a; setSel(a, Math.min(d, a + 40)); els.fin.value = 1; els.fout.value = 2; }
  else if (p === 'free') setSel(initial ? 0 : sel.a, initial ? Math.min(d, 30) : sel.b);
  els.fin.dispatchEvent(new Event('input'));
}
els.preset.addEventListener('change', () => applyPreset(false));

/* ---------------------------------------------------------------- preview playback */
function play() {
  if (!buf) return;
  stop(); ctx.resume();
  const src = ctx.createBufferSource(), gain = ctx.createGain();
  src.buffer = buf; src.connect(gain).connect(ctx.destination);
  const now = ctx.currentTime, len = sel.b - sel.a, fi = Math.min(+els.fin.value, len / 2), fo = Math.min(+els.fout.value, len / 2);
  gain.gain.setValueAtTime(fi ? 0 : 1, now); if (fi) gain.gain.linearRampToValueAtTime(1, now + fi);
  gain.gain.setValueAtTime(1, now + len - fo); if (fo) gain.gain.linearRampToValueAtTime(0, now + len);
  src.start(now, sel.a, len); src.onended = () => { if (player === src) stop(); };
  player = src; playStart = now; els.play.textContent = '■ Stop';
  const tick = () => { drawWave(); if (player) raf = requestAnimationFrame(tick); }; tick();
}
function stop() { if (player) { const p = player; player = null; try { p.stop(); } catch (_) { /* ended */ } } cancelAnimationFrame(raf); els.play.textContent = '▶ Play selection'; drawWave(); }
els.play.addEventListener('click', () => (player ? stop() : play()));

/* ---------------------------------------------------------------- export */
async function render() {
  const sr = buf.sampleRate, len = sel.b - sel.a, ch = Math.min(2, buf.numberOfChannels);
  const off = new OfflineAudioContext(ch, Math.ceil(len * sr), sr);
  const src = off.createBufferSource(), gain = off.createGain(); src.buffer = buf; src.connect(gain).connect(off.destination);
  const fi = Math.min(+els.fin.value, len / 2), fo = Math.min(+els.fout.value, len / 2);
  gain.gain.setValueAtTime(fi ? 0 : 1, 0); if (fi) gain.gain.linearRampToValueAtTime(1, fi);
  gain.gain.setValueAtTime(1, len - fo); if (fo) gain.gain.linearRampToValueAtTime(0, len);
  src.start(0, sel.a, len);
  const out = await off.startRendering();
  if (els.norm.checked) {   // make it as loud as possible without clipping
    let pk = 0; for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) { const v = Math.abs(d[i]); if (v > pk) pk = v; } }
    const k = pk > 0.001 ? 0.98 / pk : 1; if (k > 1.01) for (let c = 0; c < out.numberOfChannels; c++) { const d = out.getChannelData(c); for (let i = 0; i < d.length; i++) d[i] *= k; }
  }
  return out;
}
els.run.addEventListener('click', async () => {
  if (!buf) return;
  const fmt = els.fmt.value;
  if (fmt === 'm4r' && sel.b - sel.a > 40) { setStatus(els.status, 'iPhone ringtones can be at most 40 seconds. Shorten the selection.', 'err'); return; }
  els.run.disabled = true; stop();
  try {
    setStatus(els.status, 'Cutting…');
    const audio = await render();
    const MB = await loadMediabunny({ mp3: fmt === 'mp3' });
    const map = { mp3: [() => new MB.Mp3OutputFormat(), 'mp3', 'audio/mpeg', 'mp3'], m4a: [() => new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), 'aac', 'audio/mp4', 'm4a'],
      m4r: [() => new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), 'aac', 'audio/mp4', 'm4r'], wav: [() => new MB.WavOutputFormat(), 'pcm-s16', 'audio/wav', 'wav'], ogg: [() => new MB.OggOutputFormat(), 'opus', 'audio/ogg', 'ogg'] };
    const [mk, codec, mime, ext] = map[fmt];
    if ((codec === 'aac' || codec === 'opus') && !(await MB.canEncodeAudio(codec))) throw new Error(`This browser can't create ${fmt.toUpperCase()} files. Choose MP3 (Android ringtone) or use Chrome on Windows or Mac.`);
    const output = new MB.Output({ format: mk(), target: new MB.BufferTarget() });
    const src = new MB.AudioBufferSource({ codec, ...(codec === 'pcm-s16' ? {} : { bitrate: +els.bitrate.value * 1000 }) });
    output.addAudioTrack(src); await output.start();
    // feed in one-second chunks so long files don't stall the page
    const sr = audio.sampleRate, step = sr;
    for (let i = 0; i < audio.length; i += step) {
      const n = Math.min(step, audio.length - i), part = new AudioBuffer({ length: n, numberOfChannels: audio.numberOfChannels, sampleRate: sr });
      for (let c = 0; c < audio.numberOfChannels; c++) part.copyToChannel(audio.getChannelData(c).subarray(i, i + n), c);
      await src.add(part);
    }
    await output.finalize();
    const blob = new Blob([output.target.buffer], { type: mime });
    downloadBlob(blob, `${name}-${fmt === 'm4r' ? 'ringtone' : 'cut'}.${ext}`);
    setStatus(els.status, `Saved ${(sel.b - sel.a).toFixed(1)} s as ${ext.toUpperCase()} (${formatBytes(blob.size)}).${fmt === 'm4r' ? ' On iPhone: open it in GarageBand or drag it onto your iPhone in Finder/iTunes.' : fmt === 'mp3' ? ' On Android: Settings → Sound → Phone ringtone → add.' : ''}`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Could not save.', 'err'); }
  els.run.disabled = false;
});
els.fmt.addEventListener('change', () => { if (buf) setSel(sel.a, sel.b); els.bitrate.closest('.t-field').hidden = els.fmt.value === 'wav'; });
// formats this browser can't encode
(async () => {
  if (!('AudioEncoder' in window)) return;
  const MB = await loadMediabunny().catch(() => null); if (!MB) return;
  for (const [fmt, codec] of [['m4a', 'aac'], ['m4r', 'aac'], ['ogg', 'opus']]) {
    if (!(await MB.canEncodeAudio(codec).catch(() => false))) { const o = els.fmt.querySelector(`option[value="${fmt}"]`); if (o) { o.disabled = true; o.textContent += ' · not available in this browser'; } }
  }
  if (els.fmt.selectedOptions[0]?.disabled) {   // e.g. the iPhone page in a browser that can't write AAC
    if (MODE === 'iphone') { stickyNote = 'This browser can\'t create iPhone ringtone files (M4R). Open this page in Safari, or in Chrome or Edge on Windows or Mac. Meanwhile you can save an MP3.'; els.note.hidden = false; els.note.textContent = stickyNote; }
    els.fmt.value = 'mp3';
  }
})();
document.addEventListener('keydown', (e) => { if (e.code === 'Space' && buf && !/INPUT|TEXTAREA|SELECT|BUTTON/.test(e.target.tagName)) { e.preventDefault(); els.play.click(); } });
window.__acTest = { get sel() { return sel; }, setSel };
