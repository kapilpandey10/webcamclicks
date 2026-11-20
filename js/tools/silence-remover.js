/* WebcamClicks — Silence remover: finds pauses in talking videos (or audio) and exports a version with
   jump cuts. Audio is crossfaded at every cut so there are no clicks. All on-device (mediabunny + WebCodecs). */

import { $, setupDropzone, setStatus, downloadBlob, formatBytes, fmtTime, loadMediabunny, splitName } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $('#sl-work'), video: $('#sl-video'), wave: $('#sl-wave'),
  thr: $('#sl-thr'), thrVal: $('#sl-thr-val'), minSil: $('#sl-min'), minVal: $('#sl-min-val'), pad: $('#sl-pad'), padVal: $('#sl-pad-val'),
  stats: $('#sl-stats'), preview: $('#sl-preview'), run: $('#sl-run'), bar: $('#sl-bar'), fill: $('#sl-fill'), info: $('#sl-info'), res: $('#sl-res')
};

let file = null, audio = null /* {ch:[L,R], sr} */, env = null /* dB per 10 ms */, noise = -60, peakDb = -6, keep = [], duration = 0, hasVideo = false;
const HOP = 0.01;

/* ---------------------------------------------------------------- load */
async function open(f) {
  file = f; keep = []; audio = null;
  els.work.hidden = false; els.run.disabled = true;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  setStatus(els.status, 'Reading the audio…');
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack(), at = await input.getPrimaryAudioTrack();
    if (!at) throw new Error('This file has no sound to analyse.');
    hasVideo = !!vt;
    els.video.classList.toggle('audio-only', !hasVideo);
    duration = await input.computeDuration();
    if (duration > 3 * 3600) throw new Error('Files longer than 3 hours are too big to process in the browser.');
    const first = await at.getFirstTimestamp().catch(() => 0);
    const sr = at.sampleRate, n = Math.ceil(duration * sr) + sr;
    const L = new Float32Array(n), R = new Float32Array(n);
    for await (const wb of new MB.AudioBufferSink(at).buffers()) {
      const off = Math.round((wb.timestamp - first) * sr), b = wb.buffer, c0 = b.getChannelData(0), c1 = b.numberOfChannels > 1 ? b.getChannelData(1) : c0;
      if (off < 0 || off >= n) continue;
      L.set(c0.subarray(0, Math.min(c0.length, n - off)), off); R.set(c1.subarray(0, Math.min(c1.length, n - off)), off);
    }
    audio = { ch: [L.subarray(0, Math.ceil(duration * sr)), R.subarray(0, Math.ceil(duration * sr))], sr };
    analyse();
    els.info.textContent = `${f.name} · ${formatBytes(f.size)} · ${fmtTime(duration)}${vt ? ` · ${vt.displayWidth}×${vt.displayHeight}` : ' · audio only'}`;
    els.res.closest('.t-field').hidden = !hasVideo;
    els.run.disabled = false;
    setStatus(els.status, 'Silences are marked in red. Adjust the sliders, preview, then export.', 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'This file could not be read.', 'err'); }
}

/* ---------------------------------------------------------------- detection */
function analyse() {
  const { ch, sr } = audio, hop = Math.round(sr * HOP), frames = Math.floor(ch[0].length / hop);
  env = new Float32Array(frames);
  for (let f = 0; f < frames; f++) {
    let s = 0; const o = f * hop;
    for (let i = o; i < o + hop; i++) { const v = (ch[0][i] + ch[1][i]) * 0.5; s += v * v; }
    env[f] = 10 * Math.log10(s / hop + 1e-10);
  }
  const sorted = Float32Array.from(env).sort();
  noise = sorted[Math.floor(sorted.length * 0.1)];
  const speech = sorted[Math.floor(sorted.length * 0.85)];
  peakDb = sorted[Math.floor(sorted.length * 0.995)];
  // default threshold: a quarter of the way from the noise floor to speech level
  const auto = Math.round(Math.max(-70, Math.min(-20, noise + (speech - noise) * 0.28)));
  els.thr.value = auto;
  update();
}
function computeKeep() {
  const thr = +els.thr.value, minSil = +els.minSil.value, pad = +els.pad.value;
  const loud = (f) => env[f] > thr;
  // silent runs ≥ minSil become cuts, shrunk by the padding on both sides
  const cuts = []; let s = -1;
  for (let f = 0; f <= env.length; f++) {
    const q = f < env.length && !loud(f);
    if (q && s < 0) s = f;
    if (!q && s >= 0) { const a = s * HOP, b = f * HOP; if (b - a >= minSil) cuts.push([a + (s ? pad : 0), f >= env.length ? duration : b - pad]); s = -1; }
  }
  keep = []; let t = 0;
  for (const [a, b] of cuts) { if (b - a < 0.05) continue; if (a > t) keep.push([t, a]); t = b; }
  if (t < duration) keep.push([t, duration]);
  keep = keep.filter(([a, b]) => b - a > 0.06);
}
function update() {
  els.thrVal.textContent = `${els.thr.value} dB`; els.minVal.textContent = `${(+els.minSil.value).toFixed(2)} s`; els.padVal.textContent = `${(+els.pad.value).toFixed(2)} s`;
  if (!env) return;
  computeKeep();
  const kept = keep.reduce((a, [x, y]) => a + (y - x), 0);
  els.stats.innerHTML = `<b>${fmtTime(duration - kept)}</b> of silence removed in <b>${Math.max(0, keep.length - 1)}</b> cuts · new length <b>${fmtTime(kept)}</b> (${Math.round((1 - kept / duration) * 100)}% shorter)`;
  drawWave();
}
[els.thr, els.minSil, els.pad].forEach((x) => x.addEventListener('input', update));

function drawWave() {
  const c = els.wave, dpr = window.devicePixelRatio || 1, W = c.width = c.clientWidth * dpr, H = c.height = c.clientHeight * dpr, g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(217,45,32,.16)';
  let t = 0;
  for (const [a, b] of keep) { if (a > t) g.fillRect((t / duration) * W, 0, ((a - t) / duration) * W, H); t = b; }
  if (t < duration) g.fillRect((t / duration) * W, 0, W - (t / duration) * W, H);
  const lo = noise - 6, hi = Math.max(lo + 10, peakDb + 3);
  for (let x = 0; x < W; x++) {
    const a = Math.floor((x / W) * env.length), b = Math.max(a + 1, Math.floor(((x + 1) / W) * env.length));
    let m = -120; for (let f = a; f < b; f++) if (env[f] > m) m = env[f];
    const h = Math.max(1, ((m - lo) / (hi - lo)) * H * 0.95);
    g.fillStyle = m > +els.thr.value ? '#ff4d2e' : '#c5c9d2';
    g.fillRect(x, (H - h) / 2, 1, h);
  }
  const ty = H / 2 - (((+els.thr.value - lo) / (hi - lo)) * H * 0.95) / 2;
  g.strokeStyle = 'rgba(14,14,18,.5)'; g.setLineDash([4 * dpr, 4 * dpr]); g.beginPath(); g.moveTo(0, ty); g.lineTo(W, ty); g.moveTo(0, H - ty); g.lineTo(W, H - ty); g.stroke(); g.setLineDash([]);
  const p = (els.video.currentTime / duration) * W; g.fillStyle = '#0e0e12'; g.fillRect(p, 0, 2 * dpr, H);
}
window.addEventListener('resize', () => env && drawWave());
els.wave.addEventListener('pointerdown', (e) => { const r = els.wave.getBoundingClientRect(); els.video.currentTime = ((e.clientX - r.left) / r.width) * duration; });

/* preview: playback skips the parts that will be cut */
els.video.addEventListener('timeupdate', () => {
  if (env) drawWave();
  if (!els.preview.checked || els.video.paused || !keep.length) return;
  const t = els.video.currentTime;
  if (!keep.some(([a, b]) => t >= a && t < b - 0.02)) {
    const next = keep.find(([a]) => a > t);
    if (next) els.video.currentTime = next[0]; else els.video.pause();
  }
});

/* ---------------------------------------------------------------- export */
function keptAudio() {
  const { ch, sr } = audio, fade = Math.round(sr * 0.012);
  const total = keep.reduce((a, [x, y]) => a + Math.round((y - x) * sr), 0);
  const out = [new Float32Array(total), new Float32Array(total)];
  let o = 0;
  for (const [a, b] of keep) {
    const s = Math.round(a * sr), n = Math.round((b - a) * sr);
    for (let c = 0; c < 2; c++) {
      const seg = ch[c].subarray(s, s + n);
      out[c].set(seg, o);
      for (let i = 0; i < fade && i < n / 2; i++) { const k = i / fade; out[c][o + i] *= k; out[c][o + n - 1 - i] *= k; }   // micro-fades: no clicks at cuts
    }
    o += n;
  }
  return out;
}

els.run.addEventListener('click', async () => {
  if (!file || !keep.length) return;
  els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%';
  const t0 = performance.now();
  try {
    const MB = await loadMediabunny({ mp3: !hasVideo });
    const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    const outAudio = keptAudio(), sr = audio.sr, outDur = outAudio[0].length / sr;
    const base = splitName(file.name)[0];
    if (!vt) {   // audio only → MP3
      const output = new MB.Output({ format: new MB.Mp3OutputFormat(), target: new MB.BufferTarget() });
      const src = new MB.AudioBufferSource({ codec: 'mp3', bitrate: 192_000 }); output.addAudioTrack(src);
      await output.start();
      await addAudio(src, outAudio, sr, (p) => progress(p));
      await output.finalize();
      downloadBlob(new Blob([output.target.buffer], { type: 'audio/mpeg' }), `${base}-no-silence.mp3`);
    } else {
      const maxH = +els.res.value || 99999;
      const sc = Math.min(1, maxH / Math.min(vt.displayWidth, vt.displayHeight));
      const W = Math.round(vt.displayWidth * sc / 2) * 2, H = Math.round(vt.displayHeight * sc / 2) * 2;
      const vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
      if (!vcodec) throw new Error('Your browser has no video encoder. Try Chrome, Edge or Safari.');
      const acodec = await MB.getFirstEncodableAudioCodec(['aac', 'opus']);
      const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
      const canvas = new OffscreenCanvas(W, H), g = canvas.getContext('2d');
      const vsrc = new MB.CanvasSource(canvas, { codec: vcodec, bitrate: W * H > 2e6 ? 10_000_000 : W * H > 9e5 ? 6_000_000 : 3_000_000, keyFrameInterval: 2 });
      output.addVideoTrack(vsrc);
      let asrc = null; if (acodec) { asrc = new MB.AudioBufferSource({ codec: acodec, bitrate: 160_000 }); output.addAudioTrack(asrc); }
      await output.start();
      const first = await vt.getFirstTimestamp().catch(() => 0);
      const sink = new MB.VideoSampleSink(vt);
      let outT = 0;
      for (const [a, b] of keep) {
        for await (const s of sink.samples(first + a, first + b)) {
          const ts = s.timestamp - first;
          const st = Math.max(a, ts), en = Math.min(b, ts + (s.duration || 1 / 30));
          if (en > st + 1e-4) {
            g.drawImage(s.toCanvasImageSource(), 0, 0, W, H);
            await vsrc.add(outT + (st - a), en - st);
          }
          s.close();
        }
        outT += b - a;
        progress((outT / outDur) * (asrc ? 0.9 : 1));
      }
      vsrc.close();
      if (asrc) await addAudio(asrc, outAudio, sr, (p) => progress(0.9 + p * 0.1));
      await output.finalize();
      downloadBlob(new Blob([output.target.buffer], { type: 'video/mp4' }), `${base}-no-silence.mp4`);
    }
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${fmtTime(duration)} → ${fmtTime(outDur)}. Your file is downloading.`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Export failed: ${e.message}`, 'err'); }
  els.bar.hidden = true; els.run.disabled = false;
});
function progress(p) { els.fill.style.width = `${Math.round(p * 100)}%`; setStatus(els.status, `Cutting out the silences… ${Math.round(p * 100)}%`); }
async function addAudio(src, ch, sr, onP) {
  const step = sr * 5;
  for (let pos = 0; pos < ch[0].length; pos += step) {
    const n = Math.min(step, ch[0].length - pos), buf = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
    buf.copyToChannel(ch[0].subarray(pos, pos + n), 0); buf.copyToChannel(ch[1].subarray(pos, pos + n), 1);
    await src.add(buf); onP(pos / ch[0].length);
  }
  src.close();
}

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(video|audio)\//.test(x.type) || /\.(mp4|mov|m4v|webm|mkv|mp3|m4a|wav|ogg|flac)$/i.test(x.name));
  if (f) open(f); else setStatus(els.status, 'Please choose a video or audio file.', 'err');
});
update();
window.__slTest = { get keep() { return keep; }, get noise() { return noise; } };
