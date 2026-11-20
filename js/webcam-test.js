/* WebcamClicks — Webcam Test & "Meeting Ready" score.
   Measures the real output of the user's camera (not what the spec sheet says):
   delivered resolution, measured frame rate, exposure, highlight/shadow clipping,
   contrast, sharpness and colour cast. Everything runs locally on a downscaled
   copy of the frame; nothing is uploaded. */

const $ = (s) => document.querySelector(s);

const els = {
  video: $('#wt-video'),
  start: $('#wt-start'),
  stop: $('#wt-stop'),
  run: $('#wt-run'),
  device: $('#wt-device'),
  placeholder: $('#wt-placeholder'),
  status: $('#wt-status'),
  score: $('#wt-score'),
  grade: $('#wt-grade'),
  ring: $('#wt-ring-meter'),
  metrics: $('#wt-metrics'),
  tips: $('#wt-tips'),
  copy: $('#wt-copy'),
  download: $('#wt-download'),
  zebra: $('#wt-zebra'),
  overlay: $('#wt-overlay')
};

const SAMPLE_W = 320;            // analysis width (keeps it cheap on phones)
const work = document.createElement('canvas');
const wctx = work.getContext('2d', { willReadFrequently: true });

let stream = null;
let rafId = 0;
let frameTimes = [];
let lastAnalysis = 0;
let live = null;                 // latest smoothed metrics
let runState = null;             // { until, samples: [] } during a 5 s check
let finalReport = null;

/* ------------------------------------------------------------------ camera */

async function listDevices(selectedId) {
  try {
    const devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput');
    els.device.innerHTML = '';
    devices.forEach((d, i) => {
      const o = document.createElement('option');
      o.value = d.deviceId;
      o.textContent = d.label || `Camera ${i + 1}`;
      if (d.deviceId === selectedId) o.selected = true;
      els.device.appendChild(o);
    });
    els.device.hidden = devices.length < 2;
  } catch (_) { /* ignore */ }
}

async function startCamera(deviceId) {
  stopCamera();
  setStatus('Requesting camera access…');
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    setStatus('This browser does not support camera access. Try the latest Chrome, Edge, Firefox or Safari.', true);
    return;
  }
  const video = {
    width: { ideal: 1920 },
    height: { ideal: 1080 },
    frameRate: { ideal: 30 }
  };
  if (deviceId) video.deviceId = { exact: deviceId };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video, audio: false });
  } catch (err) {
    setStatus(friendlyError(err), true);
    return;
  }
  els.video.srcObject = stream;
  await els.video.play().catch(() => {});
  els.placeholder.hidden = true;
  els.start.hidden = true;
  els.stop.hidden = false;
  els.run.disabled = false;
  const track = stream.getVideoTracks()[0];
  await listDevices(track.getSettings().deviceId);
  frameTimes = [];
  live = null;
  setStatus('Camera live. Sit where you normally would for a call, then press “Run 5-second check”.');
  watchFrames();
  rafId = requestAnimationFrame(loop);
}

function stopCamera() {
  cancelAnimationFrame(rafId);
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  els.video.srcObject = null;
  els.placeholder.hidden = false;
  els.start.hidden = false;
  els.stop.hidden = true;
  els.run.disabled = true;
  runState = null;
}

function friendlyError(err) {
  const n = err && err.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') return 'Camera permission was blocked. Click the camera icon in your address bar, allow access and try again.';
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'No camera was found. Check that it is plugged in and not disabled in your system privacy settings.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Your camera is busy. Close Zoom, Teams, Meet, OBS or any other app using it, then try again.';
  return 'The camera could not be started (' + (n || 'unknown error') + ').';
}

/* Count real delivered frames (not rAF ticks) where the browser supports it. */
function watchFrames() {
  const v = els.video;
  if (typeof v.requestVideoFrameCallback !== 'function') return;
  const cb = (now) => {
    if (!stream) return;
    frameTimes.push(now);
    v.requestVideoFrameCallback(cb);
  };
  v.requestVideoFrameCallback(cb);
}

function measuredFps() {
  const now = performance.now();
  frameTimes = frameTimes.filter((t) => now - t < 2000);
  if (frameTimes.length >= 5) {
    const span = frameTimes[frameTimes.length - 1] - frameTimes[0];
    if (span > 0) return ((frameTimes.length - 1) * 1000) / span;
  }
  const s = stream && stream.getVideoTracks()[0].getSettings();
  return s && s.frameRate ? s.frameRate : null;
}

/* --------------------------------------------------------------- analysis */

function analyse() {
  const v = els.video;
  if (!v.videoWidth) return null;
  const h = Math.round((SAMPLE_W * v.videoHeight) / v.videoWidth);
  if (work.width !== SAMPLE_W || work.height !== h) { work.width = SAMPLE_W; work.height = h; }
  wctx.drawImage(v, 0, 0, SAMPLE_W, h);
  const { data } = wctx.getImageData(0, 0, SAMPLE_W, h);
  const n = SAMPLE_W * h;
  const luma = new Float32Array(n);
  let sum = 0, sumSq = 0, r = 0, g = 0, b = 0, hi = 0, lo = 0;
  for (let i = 0, p = 0; p < n; i += 4, p++) {
    const R = data[i], G = data[i + 1], B = data[i + 2];
    const Y = 0.2126 * R + 0.7152 * G + 0.0722 * B;
    luma[p] = Y;
    sum += Y; sumSq += Y * Y;
    r += R; g += G; b += B;
    if (Y >= 250) hi++;
    if (Y <= 6) lo++;
  }
  const mean = sum / n;
  const contrast = Math.sqrt(Math.max(0, sumSq / n - mean * mean));

  // Sharpness: variance of a 4-neighbour Laplacian.
  let lSum = 0, lSq = 0, cnt = 0;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < SAMPLE_W - 1; x++) {
      const p = y * SAMPLE_W + x;
      const L = 4 * luma[p] - luma[p - 1] - luma[p + 1] - luma[p - SAMPLE_W] - luma[p + SAMPLE_W];
      lSum += L; lSq += L * L; cnt++;
    }
  }
  const lMean = lSum / cnt;
  const sharpness = lSq / cnt - lMean * lMean;

  r /= n; g /= n; b /= n;
  const grey = (r + g + b) / 3 || 1;
  const warmth = (r - b) / grey;            // + warm/orange, - cool/blue
  const tint = (g - (r + b) / 2) / grey;    // + green, - magenta

  return {
    brightness: mean,
    contrast,
    sharpness,
    highlights: (hi / n) * 100,
    shadows: (lo / n) * 100,
    warmth,
    tint
  };
}

function smooth(prev, next, k = 0.25) {
  if (!prev) return { ...next };
  const out = {};
  for (const key of Object.keys(next)) out[key] = prev[key] + (next[key] - prev[key]) * k;
  return out;
}

/* ----------------------------------------------------------------- scoring */

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function evaluate(m, fps, res) {
  const items = [];
  const tips = [];
  const px = res.width * res.height;

  // Resolution
  let s = px >= 1920 * 1080 ? 100 : px >= 1280 * 720 ? 78 : px >= 960 * 540 ? 55 : 30;
  items.push({ key: 'Resolution', value: `${res.width}×${res.height}`, score: s, weight: 1.2,
    note: px >= 1920 * 1080 ? 'Full HD or better' : px >= 1280 * 720 ? 'HD (720p)' : 'Below HD' });
  if (px < 1280 * 720) tips.push(['Your camera is delivering less than 720p. Try a different USB port (USB 3), close other camera apps, or use your phone as a webcam.', '/how-to-use-phone-as-webcam']);

  // Frame rate
  if (fps) {
    s = fps >= 28 ? 100 : fps >= 23 ? 80 : fps >= 15 ? 50 : 20;
    items.push({ key: 'Frame rate', value: `${fps.toFixed(1)} fps`, score: s, weight: 1.1,
      note: fps >= 28 ? 'Smooth' : fps >= 23 ? 'Acceptable' : 'Choppy' });
    if (fps < 23) tips.push(['Low frame rate usually means the camera is lengthening exposure in dim light. Add light in front of you and the frame rate will often jump to 30 fps.', '/webcam-lighting-and-setup-guide']);
  }

  // Exposure
  const br = m.brightness;
  s = br >= 95 && br <= 175 ? 100 : br >= 70 && br <= 200 ? 70 : br >= 45 && br <= 220 ? 40 : 15;
  items.push({ key: 'Exposure', value: `${Math.round((br / 255) * 100)}%`, score: s, weight: 1.4,
    note: br < 95 ? 'Too dark' : br > 175 ? 'Too bright' : 'Well exposed' });
  if (br < 95) tips.push(['The image is underexposed. Face a window or put a lamp behind your screen, pointing at your face. Avoid a bright window behind you.', '/webcam-lighting-and-setup-guide']);
  if (br > 175) tips.push(['The image is overexposed. Move away from direct sunlight or lower the lamp brightness.', '/webcam-lighting-and-setup-guide']);

  // Clipping
  const clip = m.highlights + m.shadows;
  s = clip < 1.5 ? 100 : clip < 5 ? 75 : clip < 12 ? 45 : 20;
  items.push({ key: 'Clipping', value: `${m.highlights.toFixed(1)}% / ${m.shadows.toFixed(1)}%`, score: s, weight: 0.8,
    note: 'Blown highlights / crushed shadows' });
  if (m.highlights > 4) tips.push(['Part of the frame is pure white (blown out), often a window or lamp in view. Turn on “Zebra” to see where, then reframe or close the blinds.', null]);

  // Contrast
  const c = m.contrast;
  s = c >= 42 && c <= 80 ? 100 : c >= 30 ? 70 : c >= 20 ? 45 : 20;
  if (c > 80) s = 70;
  items.push({ key: 'Contrast', value: Math.round(c).toString(), score: s, weight: 0.7,
    note: c < 30 ? 'Flat / hazy' : c > 80 ? 'Harsh' : 'Balanced' });
  if (c < 30) tips.push(['The picture looks flat or hazy. Clean the lens with a microfibre cloth and add a light source from one side for depth.', '/how-to-fix-blurry-webcam']);

  // Sharpness
  const sh = m.sharpness;
  s = sh >= 140 ? 100 : sh >= 70 ? 75 : sh >= 30 ? 45 : 20;
  items.push({ key: 'Sharpness', value: Math.round(sh).toString(), score: s, weight: 1.3,
    note: sh >= 140 ? 'Crisp' : sh >= 70 ? 'Slightly soft' : 'Blurry' });
  if (sh < 70) tips.push(['The image is soft. Wipe the lens, sit at least 50 cm (20 in) from the camera so autofocus can lock, and add light: noise reduction smears detail in the dark.', '/how-to-fix-blurry-webcam']);

  // Colour cast
  const cast = Math.max(Math.abs(m.warmth), Math.abs(m.tint) * 1.5);
  s = cast < 0.12 ? 100 : cast < 0.22 ? 75 : cast < 0.35 ? 45 : 20;
  const castName = Math.abs(m.tint) * 1.5 > Math.abs(m.warmth)
    ? (m.tint > 0 ? 'Green tint' : 'Magenta tint')
    : (m.warmth > 0 ? 'Warm / orange' : 'Cool / blue');
  items.push({ key: 'Colour balance', value: cast < 0.12 ? 'Neutral' : castName, score: s, weight: 0.8,
    note: cast < 0.12 ? 'Natural skin tones' : 'Noticeable colour cast' });
  if (cast >= 0.22) tips.push([`There is a ${castName.toLowerCase()} colour cast. Avoid mixing daylight with warm bulbs; use one type of light, or a daylight (5000–5600 K) bulb.`, '/webcam-lighting-and-setup-guide']);

  const wSum = items.reduce((a, i) => a + i.weight, 0);
  const total = Math.round(items.reduce((a, i) => a + i.score * i.weight, 0) / wSum);
  return { items, tips, total };
}

function gradeFor(score) {
  if (score >= 90) return ['Studio ready', 'var(--ok)'];
  if (score >= 75) return ['Meeting ready', 'var(--ok)'];
  if (score >= 55) return ['Needs a tweak', 'var(--warn)'];
  return ['Needs work', 'var(--danger)'];
}

/* -------------------------------------------------------------------- UI */

function render(result, final) {
  const [label, color] = gradeFor(result.total);
  els.score.textContent = result.total;
  els.grade.textContent = final ? label : label + ' (live)';
  els.grade.style.color = color;
  const C = 2 * Math.PI * 52;
  els.ring.style.strokeDasharray = `${C}`;
  els.ring.style.strokeDashoffset = `${C * (1 - result.total / 100)}`;
  els.ring.style.stroke = color;

  els.metrics.innerHTML = result.items.map((i) => {
    const cls = i.score >= 75 ? 'good' : i.score >= 45 ? 'ok' : 'bad';
    return `<div class="wt-metric ${cls}">
      <span class="wt-metric-k">${i.key}</span>
      <span class="wt-metric-v">${i.value}</span>
      <span class="wt-metric-n">${i.note}</span>
      <span class="wt-bar"><span style="width:${i.score}%"></span></span>
    </div>`;
  }).join('');

  if (final) {
    els.tips.innerHTML = result.tips.length
      ? '<h3>How to improve your picture</h3><ol>' + result.tips.map(([t, href]) =>
          `<li>${t}${href ? ` <a href="${href}">Read the guide →</a>` : ''}</li>`).join('') + '</ol>'
      : '<h3>Looking great 🎉</h3><p>No problems detected. Your camera is ready for calls, streaming and recording.</p>';
    els.copy.disabled = false;
    els.download.disabled = false;
  }
}

function drawZebra() {
  const ctx = els.overlay.getContext('2d');
  const w = work.width, h = work.height;
  if (els.overlay.width !== w) { els.overlay.width = w; els.overlay.height = h; }
  ctx.clearRect(0, 0, w, h);
  if (!els.zebra.checked) return;
  const src = wctx.getImageData(0, 0, w, h).data;
  const out = ctx.createImageData(w, h);
  const t = (performance.now() / 60) | 0;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const Y = 0.2126 * src[i] + 0.7152 * src[i + 1] + 0.0722 * src[i + 2];
      if (Y >= 245 && ((x + y + t) & 7) < 4) {
        out.data[i] = 255; out.data[i + 1] = 0; out.data[i + 2] = 90; out.data[i + 3] = 200;
      }
    }
  }
  ctx.putImageData(out, 0, 0);
}

function currentRes() {
  return { width: els.video.videoWidth, height: els.video.videoHeight };
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (now - lastAnalysis < 150) return;           // ~7 analyses per second
  lastAnalysis = now;
  const m = analyse();
  if (!m) return;
  live = smooth(live, m);
  drawZebra();

  if (runState) {
    runState.samples.push(m);
    const left = Math.max(0, Math.ceil((runState.until - now) / 1000));
    setStatus(`Checking… hold still for ${left}s`);
    if (now >= runState.until) finishRun();
    return;
  }
  if (!finalReport) render(evaluate(live, measuredFps(), currentRes()), false);
}

function startRun() {
  if (!stream) return;
  finalReport = null;
  runState = { until: performance.now() + 5000, samples: [] };
  els.run.disabled = true;
  els.copy.disabled = true;
  els.download.disabled = true;
  els.tips.innerHTML = '';
}

function finishRun() {
  const samples = runState.samples;
  runState = null;
  els.run.disabled = false;
  if (!samples.length) return;
  const avg = {};
  for (const k of Object.keys(samples[0])) avg[k] = samples.reduce((a, s) => a + s[k], 0) / samples.length;
  const fps = measuredFps();
  const res = currentRes();
  const result = evaluate(avg, fps, res);
  const track = stream.getVideoTracks()[0];
  finalReport = { result, fps, res, camera: track.label || 'Camera', at: new Date() };
  render(result, true);
  setStatus('Check complete. Change something (light, position, camera) and run it again to compare.');
}

function reportText() {
  if (!finalReport) return '';
  const { result, camera, at } = finalReport;
  const lines = [
    'WebcamClicks Webcam Test Report',
    `Date: ${at.toLocaleString()}`,
    `Camera: ${camera}`,
    `Overall score: ${result.total}/100 (${gradeFor(result.total)[0]})`,
    '',
    ...result.items.map((i) => `${i.key.padEnd(15)} ${i.value.padEnd(16)} ${i.note} (${i.score}/100)`),
    '',
    result.tips.length ? 'Suggestions:' : 'No problems detected.',
    ...result.tips.map(([t], n) => `${n + 1}. ${t}`),
    '',
    'Tested privately in the browser at https://webcamclicks.com/webcam-test'
  ];
  return lines.join('\n');
}

function setStatus(msg, isError) {
  els.status.textContent = msg;
  els.status.classList.toggle('error', !!isError);
}

/* ---------------------------------------------------------------- wiring */

els.start.addEventListener('click', () => startCamera());
els.stop.addEventListener('click', () => { stopCamera(); setStatus('Camera stopped.'); });
els.run.addEventListener('click', startRun);
els.device.addEventListener('change', () => startCamera(els.device.value));
els.copy.addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(reportText()); setStatus('Report copied to clipboard.'); }
  catch (_) { setStatus('Could not copy. Use “Download report” instead.', true); }
});
els.download.addEventListener('click', () => {
  const blob = new Blob([reportText()], { type: 'text/plain' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'webcam-test-report.txt';
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden && runState) { runState = null; els.run.disabled = false; setStatus('Check paused because the tab was hidden. Run it again.'); }
});
