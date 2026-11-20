/* WebcamClicks — Voice recorder with one-click clean-up: noise removal, hum removal, voice enhance,
   loudness levelling, silence trimming. Record or import; export MP3/WAV/OGG. All on-device. */

import { $, setupDropzone, setStatus, downloadBlob, formatBytes, fmtTime, loadMediabunny, splitName } from './common.js';
import { denoise, enhance, normalize } from './sr/audio.js';

const els = {
  mic: $('#vr-mic'), rec: $('#vr-rec'), pause: $('#vr-pause'), stop: $('#vr-stop'), timer: $('#vr-timer'), meter: $('#vr-meter'),
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), edit: $('#vr-edit'), wave: $('#vr-wave'), sel: $('#vr-sel'),
  noise: $('#vr-noise'), noiseAmt: $('#vr-noise-amt'), hum: $('#vr-hum'), enh: $('#vr-enhance'), level: $('#vr-level'), autotrim: $('#vr-autotrim'),
  process: $('#vr-process'), audio: $('#vr-audio'), ab: $('#vr-ab'), format: $('#vr-format'), dl: $('#vr-dl'), info: $('#vr-info'), bar: $('#vr-bar'), fill: $('#vr-fill'),
  browserNs: $('#vr-browserns')
};

let raw = null;      // { ch: Float32Array (mono), sr, name }
let clean = null;    // processed Float32Array
let trim = [0, 1];   // fractions of raw
let showing = 'clean';

/* ---------------------------------------------------------------- recording */
let stream = null, recorder = null, chunks = [], t0 = 0, paused = 0, pauseAt = 0, timer = 0, analyser = null, actx = null, raf = 0;

async function listMics() {
  try {
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'audioinput');
    const cur = els.mic.value;
    els.mic.innerHTML = devs.map((d, i) => `<option value="${d.deviceId}">${d.label || `Microphone ${i + 1}`}</option>`).join('');
    if (cur) els.mic.value = cur;
  } catch (_) { /* ignore */ }
}
function pickMime() { return ['audio/webm;codecs=opus', 'audio/mp4', 'audio/ogg;codecs=opus', 'audio/webm'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || ''; }

async function startRec() {
  const ns = els.browserNs.checked;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { deviceId: els.mic.value ? { exact: els.mic.value } : undefined, echoCancellation: ns, noiseSuppression: ns, autoGainControl: ns, channelCount: 1, sampleRate: 48000 } });
  } catch (e) { setStatus(els.status, e.name === 'NotAllowedError' ? 'Microphone permission was blocked. Allow it in the address bar and try again.' : 'No microphone found.', 'err'); return; }
  listMics();
  actx = new AudioContext(); analyser = actx.createAnalyser(); analyser.fftSize = 2048;
  actx.createMediaStreamSource(stream).connect(analyser);
  chunks = [];
  recorder = new MediaRecorder(stream, { mimeType: pickMime(), audioBitsPerSecond: 192000 });
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  recorder.onstop = finishRec;
  recorder.start(500);
  t0 = performance.now(); paused = 0;
  timer = setInterval(tickTimer, 200);
  els.rec.hidden = true; els.pause.hidden = false; els.stop.hidden = false; els.mic.disabled = true;
  document.body.classList.add('vr-recording');
  setStatus(els.status, 'Recording… speak normally, about a hand-width from the microphone.');
  drawMeter();
}
function tickTimer() {
  const now = recorder && recorder.state === 'paused' ? pauseAt : performance.now();
  els.timer.textContent = fmtTime((now - t0 - paused) / 1000);
}
els.pause.addEventListener('click', () => {
  if (!recorder) return;
  if (recorder.state === 'recording') { recorder.pause(); pauseAt = performance.now(); els.pause.textContent = '▶ Resume'; setStatus(els.status, 'Paused.'); }
  else { recorder.resume(); paused += performance.now() - pauseAt; els.pause.textContent = '❚❚ Pause'; setStatus(els.status, 'Recording…'); }
});
els.rec.addEventListener('click', startRec);
els.stop.addEventListener('click', () => { if (recorder && recorder.state !== 'inactive') recorder.stop(); });

function drawMeter() {
  const c = els.meter, g = c.getContext('2d'), buf = new Float32Array(analyser.fftSize);
  const W = c.width = c.clientWidth * (window.devicePixelRatio || 1), H = c.height = c.clientHeight * (window.devicePixelRatio || 1);
  const step = () => {
    if (!analyser) return;
    analyser.getFloatTimeDomainData(buf);
    let peak = 0, sum = 0; for (const v of buf) { peak = Math.max(peak, Math.abs(v)); sum += v * v; }
    const db = 20 * Math.log10(Math.sqrt(sum / buf.length) + 1e-6);
    g.clearRect(0, 0, W, H);
    g.strokeStyle = peak > 0.97 ? '#d92d20' : '#ff4d2e'; g.lineWidth = 2 * (window.devicePixelRatio || 1); g.beginPath();
    for (let i = 0; i < buf.length; i += 4) { const x = (i / buf.length) * W, y = H / 2 + buf[i] * H * 0.45; i ? g.lineTo(x, y) : g.moveTo(x, y); }
    g.stroke();
    g.fillStyle = 'rgba(14,14,18,.55)'; g.font = `${12 * (window.devicePixelRatio || 1)}px Inter, sans-serif`;
    g.fillText(peak > 0.97 ? 'Too loud: move back a little' : db < -45 ? 'Very quiet: move closer' : `${Math.round(db)} dB`, 8, 16 * (window.devicePixelRatio || 1));
    raf = requestAnimationFrame(step);
  };
  step();
}

async function finishRec() {
  clearInterval(timer); cancelAnimationFrame(raf);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  if (actx) actx.close().catch(() => {});
  analyser = null; stream = null;
  els.rec.hidden = false; els.pause.hidden = true; els.stop.hidden = true; els.pause.textContent = '❚❚ Pause'; els.mic.disabled = false;
  document.body.classList.remove('vr-recording');
  const blob = new Blob(chunks, { type: (recorder && recorder.mimeType) || 'audio/webm' }); recorder = null;
  await loadAudio(blob, `recording-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}`);
}

/* ---------------------------------------------------------------- load & display */
async function loadAudio(blob, name) {
  setStatus(els.status, 'Reading the audio…');
  try {
    const ctx = new AudioContext();
    let buf;
    try { buf = await ctx.decodeAudioData(await blob.arrayBuffer()); } finally { ctx.close().catch(() => {}); }
    const n = buf.numberOfChannels, mono = new Float32Array(buf.length);
    for (let c = 0; c < n; c++) { const d = buf.getChannelData(c); for (let i = 0; i < d.length; i++) mono[i] += d[i] / n; }
    raw = { ch: mono, sr: buf.sampleRate, name };
    trim = [0, 1]; clean = null; showing = 'raw';
    els.edit.hidden = false;
    els.info.textContent = `${fmtTime(mono.length / buf.sampleRate)} · ${buf.sampleRate / 1000} kHz`;
    drawWave(); setPlayback();
    setStatus(els.status, 'Choose the clean-up options and press Clean up. Drag the edges of the waveform to trim.', 'ok');
    if (els.process && raw) await processAudio();
  } catch (e) { console.warn(e); setStatus(els.status, 'This audio could not be decoded by your browser.', 'err'); }
}

function drawWave() {
  if (!raw) return;
  const c = els.wave, dpr = window.devicePixelRatio || 1, W = c.width = c.clientWidth * dpr, H = c.height = c.clientHeight * dpr;
  const g = c.getContext('2d'); g.clearRect(0, 0, W, H);
  const draw = (data, color, alpha, from, to) => {
    g.fillStyle = color; g.globalAlpha = alpha;
    const len = data.length, x0 = Math.floor(from * W), x1 = Math.ceil(to * W);
    for (let x = x0; x < x1; x++) {
      const a = Math.floor(((x - x0) / (x1 - x0)) * len), b = Math.max(a + 1, Math.floor(((x + 1 - x0) / (x1 - x0)) * len));
      let mn = 1, mx = -1; for (let i = a; i < b; i += Math.max(1, ((b - a) / 64) | 0)) { const v = data[i] || 0; if (v < mn) mn = v; if (v > mx) mx = v; }
      g.fillRect(x, H / 2 + mn * H * 0.48, 1, Math.max(1, (mx - mn) * H * 0.48));
    }
    g.globalAlpha = 1;
  };
  draw(raw.ch, '#9aa0ab', clean ? 0.45 : 1, 0, 1);
  if (clean) draw(clean, '#ff4d2e', 1, trim[0], trim[1]);
  els.sel.style.left = `${trim[0] * 100}%`; els.sel.style.width = `${(trim[1] - trim[0]) * 100}%`;
}
window.addEventListener('resize', drawWave);

// trim by dragging the selection edges
let dragEdge = -1;
els.wave.parentElement.addEventListener('pointerdown', (e) => {
  if (!raw) return;
  const r = els.wave.getBoundingClientRect(), f = (e.clientX - r.left) / r.width;
  dragEdge = Math.abs(f - trim[0]) < Math.abs(f - trim[1]) ? 0 : 1;
  els.wave.parentElement.setPointerCapture(e.pointerId); move(e);
});
const move = (e) => {
  if (dragEdge < 0) return;
  const r = els.wave.getBoundingClientRect(), f = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
  if (dragEdge === 0) trim[0] = Math.min(f, trim[1] - 0.01); else trim[1] = Math.max(f, trim[0] + 0.01);
  els.sel.style.left = `${trim[0] * 100}%`; els.sel.style.width = `${(trim[1] - trim[0]) * 100}%`;
};
els.wave.parentElement.addEventListener('pointermove', move);
els.wave.parentElement.addEventListener('pointerup', async () => { if (dragEdge < 0) return; dragEdge = -1; if (clean) await processAudio(); else setPlayback(); });

/* ---------------------------------------------------------------- clean-up chain */
function goertzel(x, sr, f, from, n) {
  const k = 2 * Math.cos((2 * Math.PI * f) / sr); let s1 = 0, s2 = 0;
  for (let i = from; i < from + n && i < x.length; i++) { const s = x[i] + k * s1 - s2; s2 = s1; s1 = s; }
  return s1 * s1 + s2 * s2 - k * s1 * s2;
}
function detectHum(x, sr) {
  const n = Math.round(sr * 0.5), score = { 50: 0, 60: 0 };
  for (let from = 0; from + n < x.length && from < sr * 60; from += n * 3) {
    for (const f of [50, 60]) {
      const p = goertzel(x, sr, f, from, n) + goertzel(x, sr, f * 2, from, n) + goertzel(x, sr, f * 3, from, n);
      const ref = goertzel(x, sr, f + 7, from, n) + goertzel(x, sr, f * 2 + 9, from, n) + goertzel(x, sr, f * 3 + 11, from, n);
      score[f] += Math.log10((p + 1e-9) / (ref + 1e-9));
    }
  }
  const best = score[50] > score[60] ? 50 : 60;
  return score[best] > 2 ? best : 0;
}
async function removeHum(x, sr, base) {
  const ctx = new OfflineAudioContext(1, x.length, sr), b = ctx.createBuffer(1, x.length, sr); b.copyToChannel(x, 0);
  const src = ctx.createBufferSource(); src.buffer = b; let node = src;
  for (let h = 1; h <= 6 && base * h < sr / 2; h++) { const n = ctx.createBiquadFilter(); n.type = 'notch'; n.frequency.value = base * h; n.Q.value = 25; node.connect(n); node = n; }
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 70; node.connect(hp); hp.connect(ctx.destination);
  src.start(); return (await ctx.startRendering()).getChannelData(0).slice();
}
function silenceBounds(x, sr) {
  const blk = Math.round(sr * 0.02); let peak = 0; for (let i = 0; i < x.length; i += 7) peak = Math.max(peak, Math.abs(x[i]));
  const thr = Math.max(0.004, peak * 0.06);
  const loud = (i) => { let m = 0; for (let j = i; j < i + blk && j < x.length; j++) m = Math.max(m, Math.abs(x[j])); return m > thr; };
  let a = 0, b = x.length; while (a < x.length && !loud(a)) a += blk; while (b > a && !loud(b - blk)) b -= blk;
  return [Math.max(0, a - sr * 0.2), Math.min(x.length, b + sr * 0.3)];
}

let busy = false;
async function processAudio() {
  if (!raw || busy) return;
  busy = true; els.process.disabled = true; els.bar.hidden = false; els.fill.style.width = '5%';
  try {
    const { sr } = raw;
    let x = raw.ch.slice(Math.floor(trim[0] * raw.ch.length), Math.ceil(trim[1] * raw.ch.length));
    const steps = [];
    if (els.autotrim.checked) { const [a, b] = silenceBounds(x, sr); if (a > 0 || b < x.length) { x = x.slice(a, b); steps.push('silence trimmed'); } }
    let hum = els.hum.value === 'auto' ? detectHum(x, sr) : +els.hum.value;
    if (hum) { setStatus(els.status, `Removing ${hum} Hz hum…`); x = await removeHum(x, sr, hum); steps.push(`${hum} Hz hum removed`); }
    els.fill.style.width = '20%';
    if (els.noise.checked) {
      setStatus(els.status, 'Removing background noise…');
      x = await denoise(x, sr, +els.noiseAmt.value / 100, (p) => { els.fill.style.width = `${20 + p * 60}%`; });
      steps.push('noise removed');
    }
    if (els.enh.checked) { setStatus(els.status, 'Enhancing the voice…'); [x] = await enhance([x], sr); steps.push('voice enhanced'); }
    if (els.level.checked) { [x] = normalize([x], -16); steps.push('loudness levelled'); }
    els.fill.style.width = '100%';
    clean = x; showing = 'clean';
    drawWave(); setPlayback();
    setStatus(els.status, steps.length ? `Done: ${steps.join(', ')}. Press play to compare with the original.` : 'Done. No clean-up options selected.', 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Clean-up failed: ${e.message}`, 'err'); }
  els.bar.hidden = true; els.process.disabled = false; busy = false;
}
els.process.addEventListener('click', processAudio);
[els.noise, els.noiseAmt, els.hum, els.enh, els.level, els.autotrim].forEach((c) => c.addEventListener('change', () => { if (raw) processAudio(); }));

/* ---------------------------------------------------------------- playback & export */
function wav(x, sr) {
  const b = new ArrayBuffer(44 + x.length * 2), v = new DataView(b), w = (o, s) => [...s].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  w(0, 'RIFF'); v.setUint32(4, 36 + x.length * 2, true); w(8, 'WAVE'); w(12, 'fmt '); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, sr, true); v.setUint32(28, sr * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, x.length * 2, true);
  for (let i = 0; i < x.length; i++) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x[i])) * 0x7fff, true);
  return new Blob([b], { type: 'audio/wav' });
}
let url = null;
const current = () => (showing === 'clean' && clean ? clean : raw.ch.slice(Math.floor(trim[0] * raw.ch.length), Math.ceil(trim[1] * raw.ch.length)));
function setPlayback() {
  if (!raw) return;
  const t = els.audio.currentTime, playing = !els.audio.paused;
  if (url) URL.revokeObjectURL(url);
  url = URL.createObjectURL(wav(current(), raw.sr));
  els.audio.src = url;
  els.audio.onloadedmetadata = () => { els.audio.currentTime = Math.min(t, els.audio.duration || 0); if (playing) els.audio.play(); };
  els.ab.textContent = showing === 'clean' && clean ? 'Hear original' : 'Hear cleaned';
  els.ab.disabled = !clean;
  els.dl.disabled = false;
}
els.ab.addEventListener('click', () => { showing = showing === 'clean' ? 'raw' : 'clean'; setPlayback(); });

els.dl.addEventListener('click', async () => {
  if (!raw) return;
  const x = current(), sr = raw.sr, fmt = els.format.value, base = splitName(raw.name)[0] || raw.name;
  els.dl.disabled = true;
  try {
    if (fmt === 'wav') { downloadBlob(wav(x, sr), `${base}.wav`); }
    else {
      setStatus(els.status, 'Encoding…');
      const MB = await loadMediabunny({ mp3: fmt === 'mp3' });
      const codec = fmt === 'mp3' ? 'mp3' : 'opus';
      if (codec === 'opus' && !(await MB.canEncodeAudio('opus'))) throw new Error('Your browser can\'t make OGG files. Choose MP3 or WAV.');
      const output = new MB.Output({ format: fmt === 'mp3' ? new MB.Mp3OutputFormat() : new MB.OggOutputFormat(), target: new MB.BufferTarget() });
      const src = new MB.AudioBufferSource({ codec, bitrate: fmt === 'mp3' ? 160_000 : 96_000 });
      output.addAudioTrack(src);
      await output.start();
      const ab = new AudioBuffer({ length: x.length, numberOfChannels: 1, sampleRate: sr }); ab.copyToChannel(x, 0);
      await src.add(ab);
      await output.finalize();
      const blob = new Blob([output.target.buffer], { type: fmt === 'mp3' ? 'audio/mpeg' : 'audio/ogg' });
      downloadBlob(blob, `${base}.${fmt}`);
      setStatus(els.status, `Saved ${base}.${fmt} (${formatBytes(blob.size)}).`, 'ok');
    }
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Could not save the audio.', 'err'); }
  els.dl.disabled = false;
});

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(audio|video)\//.test(x.type) || /\.(mp3|m4a|wav|ogg|opus|flac|aac|webm|mp4|mov)$/i.test(x.name));
  if (f) loadAudio(f, splitName(f.name)[0]); else setStatus(els.status, 'Please choose an audio or video file.', 'err');
});
if (!navigator.mediaDevices || !window.MediaRecorder) { els.rec.disabled = true; setStatus(els.status, 'Recording isn\'t supported in this browser. You can still clean up an audio file.'); }
listMics();
window.addEventListener('beforeunload', (e) => { if (recorder) { e.preventDefault(); e.returnValue = ''; } });
window.__vrTest = { get raw() { return raw; }, get clean() { return clean; }, detectHum, wav };
