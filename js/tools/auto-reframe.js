/* WebcamClicks — Auto-reframe: landscape video → vertical (9:16), square or 4:5, following the speaker's face.
   Face detection: MediaPipe (self-hosted model). Smoothing like a camera operator. Export: mediabunny + WebCodecs. */

import { $, setupDropzone, setStatus, downloadBlob, formatBytes, fmtTime, loadMediabunny, splitName } from './common.js';
import { createTask, MODELS } from '../segmentation/vision.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $('#rf-work'), video: $('#rf-video'), box: $('#rf-box'), wrap: $('#rf-wrap'),
  prev: $('#rf-preview'), aspect: $('#rf-aspect'), mode: $('#rf-mode'), nudge: $('#rf-nudge'), size: $('#rf-size'), run: $('#rf-run'),
  bar: $('#rf-bar'), fill: $('#rf-fill'), info: $('#rf-info'), nudgeWrap: $('#rf-nudge-wrap')
};
const ASPECTS = { '9:16': 9 / 16, '1:1': 1, '4:5': 4 / 5 };
const STEP = 0.2;   // analyse 5 frames per second

let file = null, W = 0, H = 0, duration = 0, track = [];   // track: [{ t, cx, cy, found }]
let path = [];   // smoothed crop centre (fraction of width) per STEP

/* ---------------------------------------------------------------- load & analyse */
async function open(f) {
  file = f; track = []; path = [];
  els.work.hidden = false; els.run.disabled = true;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('This file has no video.');
    W = vt.displayWidth; H = vt.displayHeight; duration = await input.computeDuration();
    els.info.textContent = `${f.name} · ${formatBytes(f.size)} · ${fmtTime(duration)} · ${W}×${H}`;
    if (H > W) setStatus(els.status, 'This video is already vertical. Reframing works best on landscape videos.', 'err');
    setStatus(els.status, 'Loading face detection…');
    const det = await createTask('FaceDetector', { baseOptions: { modelAssetPath: MODELS.faceDetector }, runningMode: 'IMAGE', minDetectionConfidence: 0.45 });
    const first = await vt.getFirstTimestamp().catch(() => 0);
    const times = []; for (let t = 0; t < duration; t += STEP) times.push(first + t);
    const s = Math.min(1, 1280 / W), cw = Math.round(W * s), ch = Math.round(H * s);
    const c = document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d', { willReadFrequently: true });
    let i = 0;
    for await (const sm of new MB.VideoSampleSink(vt).samplesAtTimestamps(times)) {
      const t = i * STEP; let best = null;
      if (sm) {
        best = findFace(det, sm.toCanvasImageSource(), c, g, cw, ch); sm.close();
      }
      track.push(best ? { t, cx: (best.originX + best.width / 2) / cw, cy: (best.originY + best.height / 2) / ch, w: best.width / cw, found: true } : { t, found: false });
      if (++i % 10 === 0) setStatus(els.status, `Finding the speaker… ${Math.round((i / times.length) * 100)}%`);
    }
    det.close && det.close(); tileMode = false;
    const found = track.filter((x) => x.found).length;
    buildPath();
    els.run.disabled = false;
    setStatus(els.status, found ? `Face found in ${Math.round((found / track.length) * 100)}% of the video. Play to preview the new framing, then export.` : 'No face found: the crop stays centred. Use the position slider to aim it.', found ? 'ok' : 'err');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'This video could not be read.', 'err'); }
}

/** Largest face in a frame. The model works at 128 px, so small faces (podcasts, wide shots) are also searched
    for in overlapping zoomed-in tiles; boxes are returned in the coordinates of the whole frame (cw×ch). */
const tile = document.createElement('canvas'); tile.width = tile.height = 384;
let tileMode = false;   // once faces are only found in tiles, keep using tiles
function findFace(det, src, c, g, cw, ch) {
  let best = null;
  const take = (b, ox, oy, k) => { const bb = { originX: ox + b.originX * k, originY: oy + b.originY * k, width: b.width * k, height: b.height * k }; if (!best || bb.width * bb.height > best.width * best.height) best = bb; };
  g.drawImage(src, 0, 0, cw, ch);
  if (!tileMode) for (const d of det.detect(c).detections || []) take(d.boundingBox, 0, 0, 1);
  if (best) return best;
  const side = Math.round(ch * 0.62), stepX = side * 0.55, stepY = ch - side;
  const tg = tile.getContext('2d', { willReadFrequently: true });
  for (let y = 0; y <= ch - side + 1; y += Math.max(1, stepY)) {
    for (let x = 0; x <= cw - side + stepX - 1; x += stepX) {
      const tx = Math.min(x, cw - side);
      tg.drawImage(c, tx, y, side, side, 0, 0, tile.width, tile.height);
      for (const d of det.detect(tile).detections || []) take(d.boundingBox, tx, y, side / tile.width);
      if (tx >= cw - side) break;
    }
    if (stepY <= 0) break;
  }
  if (best) tileMode = true;
  return best;
}

/* ---------------------------------------------------------------- camera path */
function cropSize() {
  const a = ASPECTS[els.aspect.value];
  let cw = H * a, ch = H; if (cw > W) { cw = W; ch = W / a; }
  return [cw, ch];
}
function buildPath() {
  const n = track.length; if (!n) { path = []; return; }
  // fill gaps: interpolate between detections, hold at the ends
  const raw = new Float32Array(n), idx = track.map((x, i) => (x.found ? i : -1)).filter((i) => i >= 0);
  if (!idx.length) raw.fill(0.5);
  else for (let i = 0; i < n; i++) {
    const a = [...idx].reverse().find((j) => j <= i), b = idx.find((j) => j >= i);
    if (a == null) raw[i] = track[b].cx; else if (b == null) raw[i] = track[a].cx;
    else raw[i] = a === b ? track[a].cx : track[a].cx + (track[b].cx - track[a].cx) * ((i - a) / (b - a));
  }
  const mode = els.mode.value, nudge = +els.nudge.value / 100;
  let p = new Float32Array(n);
  if (mode === 'center' || mode === 'blur') p.fill(0.5 + nudge * 0.5);
  else if (mode === 'steady') {
    // like a camera operator: hold the shot until the speaker leaves the middle third of the frame
    const [cw] = cropSize(), dz = (cw / W) * 0.18;
    let hold = raw[0];
    for (let i = 0; i < n; i++) { if (Math.abs(raw[i] - hold) > dz) hold = raw[i]; p[i] = hold; }
    p = zeroPhase(p, 0.55);   // ease the moves
  } else p = zeroPhase(raw, 0.22);
  if (mode !== 'center' && mode !== 'blur') for (let i = 0; i < n; i++) p[i] += nudge * 0.15;
  path = Array.from(p);
}
function zeroPhase(x, a) {   // forward + backward exponential smoothing: smooth, no lag
  const f = new Float32Array(x.length), b = new Float32Array(x.length);
  f[0] = x[0]; for (let i = 1; i < x.length; i++) f[i] = f[i - 1] + a * (x[i] - f[i - 1]);
  b[x.length - 1] = f[x.length - 1]; for (let i = x.length - 2; i >= 0; i--) b[i] = b[i + 1] + a * (f[i] - b[i + 1]);
  return b;
}
function cropAt(t) {
  const [cw, ch] = cropSize();
  let c = 0.5;
  if (path.length) { const f = Math.min(path.length - 1, Math.max(0, t / STEP)), i = Math.floor(f), j = Math.min(path.length - 1, i + 1); c = path[i] + (path[j] - path[i]) * (f - i); }
  const x = Math.max(0, Math.min(W - cw, c * W - cw / 2)), y = (H - ch) / 2;
  return [x, y, cw, ch];
}
function outSize() {
  const a = ASPECTS[els.aspect.value], [cw, ch] = cropSize();
  if (els.size.value === 'native') return [Math.round(cw / 2) * 2, Math.round(ch / 2) * 2];
  const w = 1080; return [w, Math.round(w / a / 2) * 2];
}

/* ---------------------------------------------------------------- drawing (preview + export) */
const tiny = document.createElement('canvas');
function drawFrame(g, src, t, OW, OH) {
  if (els.mode.value === 'blur') {
    // whole frame on top of a blurred, zoomed copy of itself
    tiny.width = 48; tiny.height = Math.max(8, Math.round((48 * OH) / OW));
    const tg = tiny.getContext('2d'), k = Math.max(tiny.width / W, tiny.height / H);
    tg.drawImage(src, (tiny.width - W * k) / 2, (tiny.height - H * k) / 2, W * k, H * k);
    g.imageSmoothingQuality = 'high'; g.drawImage(tiny, 0, 0, OW, OH);
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, OW, OH);
    const s = Math.min(OW / W, OH / H) * 1.0, dw = W * s, dh = H * s;
    g.drawImage(src, (OW - dw) / 2, (OH - dh) / 2, dw, dh);
    return;
  }
  const [x, y, cw, ch] = cropAt(t);
  g.drawImage(src, x, y, cw, ch, 0, 0, OW, OH);
}

function preview() {
  if (!W) return;
  const t = els.video.currentTime, [cw, ch] = cropSize(), [x, y] = cropAt(t);
  const blur = els.mode.value === 'blur';
  els.box.hidden = blur;
  Object.assign(els.box.style, { left: `${(x / W) * 100}%`, top: `${(y / H) * 100}%`, width: `${(cw / W) * 100}%`, height: `${(ch / H) * 100}%` });
  const [OW, OH] = outSize(), pw = 270, ph = Math.round((pw * OH) / OW);
  if (els.prev.width !== pw || els.prev.height !== ph) { els.prev.width = pw; els.prev.height = ph; }
  if (els.video.readyState >= 2) drawFrame(els.prev.getContext('2d'), els.video, t, pw, ph);
}
let raf = 0;
const loop = () => { preview(); if (!els.video.paused) raf = requestAnimationFrame(loop); };
els.video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(loop); });
['seeked', 'loadeddata', 'timeupdate'].forEach((ev) => els.video.addEventListener(ev, () => { if (els.video.paused) preview(); }));
[els.aspect, els.mode, els.nudge, els.size].forEach((c) => c.addEventListener('input', () => { els.nudgeWrap.querySelector('span').textContent = els.mode.value === 'smooth' || els.mode.value === 'steady' ? 'Aim offset' : 'Position'; buildPath(); preview(); }));

/* ---------------------------------------------------------------- export */
els.run.addEventListener('click', async () => {
  if (!file) return;
  els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%';
  const t0 = performance.now();
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack(), first = await vt.getFirstTimestamp().catch(() => 0);
    const [OW, OH] = outSize();
    const codec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: OW, height: OH });
    if (!codec) throw new Error('Your browser has no suitable video encoder.');
    const canvas = new OffscreenCanvas(OW, OH), g = canvas.getContext('2d');
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const conv = await MB.Conversion.init({
      input, output, showWarnings: false,
      video: { processedWidth: OW, processedHeight: OH, codec, bitrate: MB.QUALITY_HIGH, forceTranscode: true,
        process: (sample) => { drawFrame(g, sample.toCanvasImageSource(), sample.timestamp - first, OW, OH); return canvas; } }
    });
    if (!conv.isValid) throw new Error('This video can\'t be converted in your browser.');
    conv.onProgress = (p) => { els.fill.style.width = `${Math.round(p * 100)}%`; setStatus(els.status, `Reframing… ${Math.round(p * 100)}%`); };
    await conv.execute();
    const tag = { '9:16': 'vertical', '1:1': 'square', '4:5': '4x5' }[els.aspect.value];
    downloadBlob(new Blob([output.target.buffer], { type: 'video/mp4' }), `${splitName(file.name)[0]}-${tag}.mp4`);
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${OW}×${OH} MP4 ready for Reels, TikTok and Shorts.`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Export failed: ${e.message}`, 'err'); }
  els.bar.hidden = true; els.run.disabled = false;
});

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => x.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(x.name));
  if (f) open(f); else setStatus(els.status, 'Please choose a video file.', 'err');
});
window.__rfTest = { get track() { return track; }, get path() { return path; }, cropAt };
