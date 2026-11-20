/* WebcamClicks — Passport & ID photo maker.
   1. Get a photo (webcam with guide, or upload)
   2. On-device AI: remove the background (selfie segmenter) and find the face (BlazeFace)
   3. Measure the head (crown from the person mask, chin from facial keypoints)
   4. Crop/scale to the chosen document spec at 300 DPI; user can fine-tune
   5. Export a single photo and print-ready sheets
   Nothing leaves the device. */

import { createTask, personMask, MODELS } from './segmentation/vision.js';

const DPI = 300;
const mm = (v) => Math.round((v / 25.4) * DPI);

/* head = crown-to-chin as a fraction of photo height; eyeFromBottom = eye line height fraction (when the spec defines it) */
export const SPECS = [
  { id: 'us', name: 'United States — passport & visa', wMm: 50.8, hMm: 50.8, sizeLabel: '2 × 2 in (51 × 51 mm)', head: [0.50, 0.69], target: 0.60, eyeFromBottom: [0.56, 0.69], eyeTarget: 0.62, bg: '#ffffff' },
  { id: 'uk', name: 'United Kingdom — passport', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.644, 0.756], target: 0.70, bg: '#eceae6' },
  { id: 'schengen', name: 'Schengen / EU — passport & visa', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.70, 0.80], target: 0.74, bg: '#ececec' },
  { id: 'ca', name: 'Canada — passport', wMm: 50, hMm: 70, sizeLabel: '50 × 70 mm', head: [0.443, 0.514], target: 0.48, bg: '#ffffff' },
  { id: 'au', name: 'Australia — passport', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.711, 0.80], target: 0.75, bg: '#ececec' },
  { id: 'in', name: 'India — passport (35 × 45 mm)', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.70, 0.80], target: 0.75, bg: '#ffffff' },
  { id: 'in-visa', name: 'India — visa (2 × 2 in)', wMm: 50.8, hMm: 50.8, sizeLabel: '2 × 2 in (51 × 51 mm)', head: [0.50, 0.69], target: 0.62, bg: '#ffffff' },
  { id: 'cn', name: 'China — passport & visa', wMm: 33, hMm: 48, sizeLabel: '33 × 48 mm', head: [0.583, 0.688], target: 0.64, bg: '#ffffff' },
  { id: 'jp', name: 'Japan — passport', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.711, 0.80], target: 0.75, bg: '#ffffff' },
  { id: 'icao', name: 'Other — standard ICAO 35 × 45 mm', wMm: 35, hMm: 45, sizeLabel: '35 × 45 mm', head: [0.70, 0.80], target: 0.74, bg: '#ffffff' }
];

const BACKGROUNDS = [
  { id: 'spec', name: 'Recommended' },
  { id: '#ffffff', name: 'White' },
  { id: '#f4f3ef', name: 'Off-white' },
  { id: '#e6e7e9', name: 'Light grey' },
  { id: '#dbe7f3', name: 'Light blue' },
  { id: 'keep', name: 'Keep original' }
];

const $ = (s) => document.querySelector(s);
const els = {
  stepGet: $('#pp-step-get'), stepEdit: $('#pp-step-edit'),
  video: $('#pp-video'), camWrap: $('#pp-cam'), camStart: $('#pp-cam-start'), shoot: $('#pp-shoot'),
  countdown: $('#pp-countdown'), upload: $('#pp-upload'), uploadBtn: $('#pp-upload-btn'),
  status: $('#pp-status'), spec: $('#pp-spec'), bg: $('#pp-bg'),
  preview: $('#pp-preview'), guides: $('#pp-guides'),
  zoom: $('#pp-zoom'), offX: $('#pp-offx'), offY: $('#pp-offy'), reset: $('#pp-reset'),
  checks: $('#pp-checks'), dlSingle: $('#pp-dl-single'), dlSheet: $('#pp-dl-sheet'), dlA4: $('#pp-dl-a4'),
  retake: $('#pp-retake'), specInfo: $('#pp-spec-info')
};

let stream = null;
let segmenter = null, faceDetector = null, modelsPromise = null;
let job = null;   // { source canvas, cutout canvas, face, crownY, chinY, eye, ... }

/* ------------------------------------------------------------------ models */

function loadModels() {
  if (!modelsPromise) {
    modelsPromise = Promise.all([
      createTask('ImageSegmenter', {
        baseOptions: { modelAssetPath: MODELS.segmenterSquare },
        runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false
      }),
      createTask('FaceDetector', {
        baseOptions: { modelAssetPath: MODELS.faceDetector },
        runningMode: 'IMAGE', minDetectionConfidence: 0.5
      })
    ]).then(([s, f]) => { segmenter = s; faceDetector = f; })
      .catch((e) => { modelsPromise = null; throw e; });
  }
  return modelsPromise;
}

/* ------------------------------------------------------------------ input */

async function startCamera() {
  setStatus('Starting camera…');
  loadModels().catch(() => {});
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' }, audio: false
    });
  } catch (e) {
    setStatus(e && e.name === 'NotAllowedError'
      ? 'Camera permission was blocked. Allow it in the address bar, or upload a photo instead.'
      : 'No camera available. You can upload a photo instead.', true);
    return;
  }
  els.video.srcObject = stream;
  await els.video.play().catch(() => {});
  els.camWrap.classList.add('live');
  els.camStart.hidden = true;
  els.shoot.hidden = false;
  setStatus('Face the camera, keep a neutral expression, and fit your head inside the oval.');
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  els.camWrap.classList.remove('live');
  els.camStart.hidden = false;
  els.shoot.hidden = true;
}

function shoot() {
  let n = 3;
  els.shoot.disabled = true;
  els.countdown.hidden = false;
  els.countdown.textContent = n;
  const tick = setInterval(() => {
    n--;
    if (n > 0) { els.countdown.textContent = n; return; }
    clearInterval(tick);
    els.countdown.hidden = true;
    els.shoot.disabled = false;
    const v = els.video;
    // the live preview is mirrored like a selfie camera, but passport photos must show you
    // as others see you, so we capture the true (non-mirrored) frame
    const fixed = document.createElement('canvas');
    fixed.width = v.videoWidth; fixed.height = v.videoHeight;
    fixed.getContext('2d').drawImage(v, 0, 0);
    stopCamera();
    process(fixed);
  }, 1000);
}

function onUpload(file) {
  if (!file) return;
  const img = new Image();
  img.onload = () => {
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    URL.revokeObjectURL(img.src);
    stopCamera();
    process(c);
  };
  img.onerror = () => setStatus('That file could not be opened as an image.', true);
  img.src = URL.createObjectURL(file);
}

/* ------------------------------------------------------------------ analysis */

async function process(srcCanvas) {
  setStatus('Analysing your photo on this device…');
  try {
    await loadModels();
  } catch (e) {
    setStatus('Could not load the AI models. Check your connection and try again.', true);
    return;
  }

  // work at up to 1600 px on the long side
  const s = Math.min(1, 1600 / Math.max(srcCanvas.width, srcCanvas.height));
  const src = document.createElement('canvas');
  src.width = Math.round(srcCanvas.width * s); src.height = Math.round(srcCanvas.height * s);
  src.getContext('2d').drawImage(srcCanvas, 0, 0, src.width, src.height);

  const det = faceDetector.detect(src);
  const faces = (det && det.detections) || [];
  if (!faces.length) {
    setStatus('No face found. Use a front-facing photo with your whole head and shoulders visible.', true);
    return;
  }
  faces.sort((a, b) => b.boundingBox.width * b.boundingBox.height - a.boundingBox.width * a.boundingBox.height);
  const face = faces[0];
  const kp = face.keypoints.map((p) => ({ x: p.x * src.width, y: p.y * src.height }));
  // BlazeFace keypoints: 0 right eye, 1 left eye, 2 nose tip, 3 mouth, 4 right ear, 5 left ear
  const eyeR = kp[0], eyeL = kp[1], mouth = kp[3];
  const eye = { x: (eyeR.x + eyeL.x) / 2, y: (eyeR.y + eyeL.y) / 2 };
  const tilt = Math.atan2(eyeL.y - eyeR.y, eyeL.x - eyeR.x) * 180 / Math.PI;
  const chinY = eye.y + (mouth.y - eye.y) * 1.62;   // eye→chin ≈ 1.6 × eye→mouth on adult faces

  // person mask → cut-out
  const segRes = segmenter.segment(src);
  const m = personMask(segRes);
  const mw = m.width, mh = m.height;
  const conf = m.getAsFloat32Array();
  const maskCanvas = document.createElement('canvas');
  maskCanvas.width = mw; maskCanvas.height = mh;
  const mctx = maskCanvas.getContext('2d');
  const mimg = mctx.createImageData(mw, mh);
  for (let i = 0; i < conf.length; i++) {
    let a = (conf[i] - 0.3) / 0.45;
    a = a < 0 ? 0 : a > 1 ? 1 : a;
    mimg.data[i * 4 + 3] = a * a * (3 - 2 * a) * 255;
  }
  mctx.putImageData(mimg, 0, 0);

  // crown: highest person pixel within the face's horizontal span, above the eyes
  const bb = face.boundingBox;
  const x0 = Math.max(0, Math.floor((bb.originX + bb.width * 0.2) / src.width * mw));
  const x1 = Math.min(mw - 1, Math.ceil((bb.originX + bb.width * 0.8) / src.width * mw));
  const eyeRow = Math.floor(eye.y / src.height * mh);
  let crownRow = -1;
  for (let y = 0; y < eyeRow && crownRow < 0; y++) {
    let hits = 0;
    for (let x = x0; x <= x1; x++) if (conf[y * mw + x] > 0.5) hits++;
    if (hits > (x1 - x0 + 1) * 0.12) crownRow = y;
  }
  let crownY = crownRow >= 0 ? (crownRow / mh) * src.height : eye.y - (chinY - eye.y) * 1.05;
  const crownFromMask = crownRow > 1;              // row 0/1 means the head touches the top edge (cut off)
  // big hair-dos: passport rules measure to the top of the head, not the hair — cap the hair allowance
  const minCrown = eye.y - (chinY - eye.y) * 1.25;
  if (crownY < minCrown) crownY = minCrown;
  segRes.close && segRes.close();

  const cutout = document.createElement('canvas');
  cutout.width = src.width; cutout.height = src.height;
  const cc = cutout.getContext('2d');
  cc.drawImage(src, 0, 0);
  cc.globalCompositeOperation = 'destination-in';
  cc.imageSmoothingEnabled = true; cc.imageSmoothingQuality = 'high';
  cc.drawImage(maskCanvas, 0, 0, src.width, src.height);
  cc.globalCompositeOperation = 'source-over';

  // lighting balance: compare left/right halves of the face box
  const lg = src.getContext('2d').getImageData(Math.max(0, bb.originX), Math.max(0, bb.originY),
    Math.max(2, Math.min(bb.width, src.width - bb.originX)), Math.max(2, Math.min(bb.height, src.height - bb.originY)));
  let left = 0, right = 0, nl = 0, nr = 0;
  for (let y = 0; y < lg.height; y += 2) {
    for (let x = 0; x < lg.width; x += 2) {
      const o = (y * lg.width + x) * 4;
      const l = lg.data[o] * 0.299 + lg.data[o + 1] * 0.587 + lg.data[o + 2] * 0.114;
      if (x < lg.width / 2) { left += l; nl++; } else { right += l; nr++; }
    }
  }
  const lAvg = left / nl, rAvg = right / nr;
  const evenness = Math.abs(lAvg - rAvg) / Math.max(1, (lAvg + rAvg) / 2);

  job = {
    src, cutout, eye, crownY, chinY, tilt, evenness, crownFromMask,
    faceX: bb.originX + bb.width / 2, faces: faces.length,
    brightness: (lAvg + rAvg) / 2
  };
  els.zoom.value = 100; els.offX.value = 0; els.offY.value = 0;
  els.stepGet.hidden = true;
  els.stepEdit.hidden = false;
  setStatus('');
  render();
  els.stepEdit.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ------------------------------------------------------------------ layout */

function currentSpec() {
  return SPECS.find((s) => s.id === els.spec.value) || SPECS[0];
}

function bgFor(spec) {
  const v = els.bg.value;
  if (v === 'spec') return spec.bg;
  return v;
}

/** Compute the crop rect (in source pixels) for a spec and the user's adjustments. */
function layout(spec) {
  const W = mm(spec.wMm), H = mm(spec.hMm);
  const headPx = job.chinY - job.crownY;
  const zoom = els.zoom.value / 100;
  const target = spec.target * zoom;
  const scale = (target * H) / headPx;                    // output px per source px
  let topY;
  if (spec.eyeTarget) {
    topY = job.eye.y - (H * (1 - spec.eyeTarget)) / scale; // eye line at the required height
  } else {
    const headOut = target * H;
    const topGap = (H - headOut) * 0.42;                     // a bit more room below the chin than above the crown
    topY = job.crownY - topGap / scale;
  }
  const leftX = job.faceX - (W / 2) / scale;
  const dx = (els.offX.value / 100) * (W / scale) * 0.25;
  const dy = (els.offY.value / 100) * (H / scale) * 0.25;
  return { W, H, scale, x: leftX - dx, y: topY - dy, headOutFrac: (headPx * scale) / H, eyeOutFrac: 1 - ((job.eye.y - (topY - dy)) * scale) / H };
}

function drawPhoto(ctx, spec, L, ox = 0, oy = 0) {
  const bg = bgFor(spec);
  const source = bg === 'keep' ? job.src : job.cutout;
  ctx.save();
  ctx.beginPath(); ctx.rect(ox, oy, L.W, L.H); ctx.clip();
  ctx.fillStyle = bg === 'keep' ? '#ffffff' : bg;
  ctx.fillRect(ox, oy, L.W, L.H);
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(source, ox - L.x * L.scale, oy - L.y * L.scale, source.width * L.scale, source.height * L.scale);
  ctx.restore();
}

function render() {
  if (!job) return;
  const spec = currentSpec();
  const L = layout(spec);
  const c = els.preview;
  c.width = L.W; c.height = L.H;
  const ctx = c.getContext('2d');
  drawPhoto(ctx, spec, L);

  // guides overlay (not exported)
  const g = els.guides;
  g.width = L.W; g.height = L.H;
  const gx = g.getContext('2d');
  gx.clearRect(0, 0, L.W, L.H);
  gx.lineWidth = Math.max(2, L.W / 220);
  gx.setLineDash([L.W / 40, L.W / 60]);
  const lineAt = (fracFromTop, color) => {
    gx.strokeStyle = color; gx.beginPath(); gx.moveTo(0, fracFromTop * L.H); gx.lineTo(L.W, fracFromTop * L.H); gx.stroke();
  };
  const crownOut = (job.crownY - L.y) * L.scale / L.H;
  const chinOut = (job.chinY - L.y) * L.scale / L.H;
  lineAt(crownOut, 'rgba(255,77,46,.9)');
  lineAt(chinOut, 'rgba(255,77,46,.9)');
  if (spec.eyeFromBottom) {
    gx.fillStyle = 'rgba(34,197,94,.14)';
    gx.fillRect(0, (1 - spec.eyeFromBottom[1]) * L.H, L.W, (spec.eyeFromBottom[1] - spec.eyeFromBottom[0]) * L.H);
  }
  gx.setLineDash([]);
  gx.strokeStyle = 'rgba(14,14,18,.25)';
  gx.beginPath(); gx.moveTo(L.W / 2, 0); gx.lineTo(L.W / 2, L.H); gx.stroke();

  els.specInfo.textContent = `${spec.sizeLabel} · ${L.W} × ${L.H} px at ${DPI} DPI · head ${Math.round(spec.head[0] * 100)}–${Math.round(spec.head[1] * 100)}% of height`;
  renderChecks(spec, L);
}

function renderChecks(spec, L) {
  const items = [];
  const head = L.headOutFrac;
  items.push([head >= spec.head[0] && head <= spec.head[1],
    `Head size ${Math.round(head * 100)}% of photo height (needs ${Math.round(spec.head[0] * 100)}–${Math.round(spec.head[1] * 100)}%)`]);
  if (spec.eyeFromBottom) {
    const e = L.eyeOutFrac;
    items.push([e >= spec.eyeFromBottom[0] && e <= spec.eyeFromBottom[1], `Eye line ${Math.round(e * 100)}% from the bottom (needs ${Math.round(spec.eyeFromBottom[0] * 100)}–${Math.round(spec.eyeFromBottom[1] * 100)}%)`]);
  }
  items.push([Math.abs(job.tilt) <= 4, Math.abs(job.tilt) <= 4 ? 'Head is level' : `Head is tilted ${Math.abs(job.tilt).toFixed(1)}°. Keep your eyes level and retake.`]);
  items.push([job.evenness < 0.18, job.evenness < 0.18 ? 'Even lighting on both sides of the face' : 'One side of your face is darker. Face a window or light and retake.']);
  items.push([job.brightness > 70 && job.brightness < 215, job.brightness <= 70 ? 'Photo is too dark. Add light in front of you.' : job.brightness >= 215 ? 'Face is overexposed. Move away from direct light.' : 'Good exposure']);
  items.push([job.faces === 1, job.faces === 1 ? 'Exactly one person in the photo' : 'More than one face found. Only you should be in the photo.']);
  items.push([L.scale <= 1.15, L.scale <= 1.15 ? 'Resolution is high enough for printing' : 'Your face is small in the original. Move closer or use a higher-resolution photo.']);
  items.push([job.crownFromMask, job.crownFromMask ? 'Whole head is in the photo' : 'The top of your head is cut off or hidden. Leave space above your head and retake.']);
  els.checks.innerHTML = items.map(([ok, t]) => `<li class="${ok ? 'ok' : 'warn'}">${ok ? '✔' : '!'} <span>${t}</span></li>`).join('');
}

/* ------------------------------------------------------------------ export */

/** Set 300 DPI in the JPEG JFIF header so printers and online forms read the right physical size. */
function setJpegDpi(bytes, dpi) {
  // JFIF APP0: FF D8 FF E0 len(2) 'JFIF\0' ver(2) units(1) Xdensity(2) Ydensity(2)
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff && bytes[3] === 0xe0 &&
      bytes[6] === 0x4a && bytes[7] === 0x46 && bytes[8] === 0x49 && bytes[9] === 0x46) {
    bytes[13] = 1;
    bytes[14] = dpi >> 8; bytes[15] = dpi & 255;
    bytes[16] = dpi >> 8; bytes[17] = dpi & 255;
  }
  return bytes;
}

function downloadCanvas(canvas, name) {
  canvas.toBlob(async (blob) => {
    const bytes = setJpegDpi(new Uint8Array(await blob.arrayBuffer()), DPI);
    const url = URL.createObjectURL(new Blob([bytes], { type: 'image/jpeg' }));
    const a = document.createElement('a');
    a.href = url; a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }, 'image/jpeg', 0.95);
}

function exportSingle() {
  const spec = currentSpec();
  const L = layout(spec);
  const c = document.createElement('canvas');
  c.width = L.W; c.height = L.H;
  drawPhoto(c.getContext('2d'), spec, L);
  downloadCanvas(c, `passport-photo-${spec.id}-${L.W}x${L.H}.jpg`);
}

function exportSheet(paper) {
  const spec = currentSpec();
  const L = layout(spec);
  const [pw, ph] = paper === 'a4' ? [mm(210), mm(297)] : [6 * DPI, 4 * DPI];   // A4 portrait / 6×4 in landscape
  const gap = mm(3), margin = mm(5);
  const cols = Math.max(1, Math.floor((pw - 2 * margin + gap) / (L.W + gap)));
  const rows = Math.max(1, Math.floor((ph - 2 * margin + gap) / (L.H + gap)));
  const c = document.createElement('canvas');
  c.width = pw; c.height = ph;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, pw, ph);
  const gridW = cols * L.W + (cols - 1) * gap, gridH = rows * L.H + (rows - 1) * gap;
  const ox = Math.round((pw - gridW) / 2), oy = Math.round((ph - gridH) / 2);
  for (let r = 0; r < rows; r++) {
    for (let col = 0; col < cols; col++) {
      const x = ox + col * (L.W + gap), y = oy + r * (L.H + gap);
      drawPhoto(ctx, spec, L, x, y);
      ctx.strokeStyle = '#c9cbd1'; ctx.lineWidth = 1;
      ctx.strokeRect(x - 0.5, y - 0.5, L.W + 1, L.H + 1);   // cut guide
    }
  }
  ctx.fillStyle = '#9a9ca5';
  ctx.font = `${mm(2.2)}px Inter, Arial, sans-serif`;
  ctx.fillText(`${spec.sizeLabel} · ${rows * cols} photos · print at 100% (no scaling) · webcamclicks.com/passport-photo`, margin, ph - mm(2));
  downloadCanvas(c, `passport-photo-sheet-${paper}-${spec.id}.jpg`);
}

/* ------------------------------------------------------------------ ui */

function setStatus(msg, err) {
  els.status.textContent = msg;
  els.status.classList.toggle('err', !!err);
}

function fillSelects() {
  els.spec.innerHTML = SPECS.map((s) => `<option value="${s.id}">${s.name}</option>`).join('');
  els.bg.innerHTML = BACKGROUNDS.map((b) => `<option value="${b.id}">${b.name}</option>`).join('');
  // guess a sensible default from the browser language region
  const lang = (navigator.language || '').toLowerCase();
  const guess = lang.endsWith('-gb') ? 'uk' : lang.endsWith('-ca') ? 'ca' : lang.endsWith('-au') ? 'au'
    : lang.endsWith('-in') || lang.startsWith('hi') ? 'in' : lang.startsWith('zh') ? 'cn' : lang.startsWith('ja') ? 'jp'
    : /^(de|fr|es|it|nl|pt|pl|sv|da|fi|cs|el|hu|ro|sk|sl|bg|hr|lt|lv|et)/.test(lang) && !lang.endsWith('-us') && !lang.endsWith('-br') ? 'schengen' : 'us';
  els.spec.value = guess;
}

fillSelects();
els.camStart.addEventListener('click', startCamera);
els.shoot.addEventListener('click', shoot);
els.uploadBtn.addEventListener('click', () => els.upload.click());
els.upload.addEventListener('change', () => { onUpload(els.upload.files[0]); els.upload.value = ''; });
[els.spec, els.bg].forEach((e) => e.addEventListener('change', render));
[els.zoom, els.offX, els.offY].forEach((e) => e.addEventListener('input', render));
els.reset.addEventListener('click', () => { els.zoom.value = 100; els.offX.value = 0; els.offY.value = 0; render(); });
els.dlSingle.addEventListener('click', exportSingle);
els.dlSheet.addEventListener('click', () => exportSheet('4x6'));
els.dlA4.addEventListener('click', () => exportSheet('a4'));
els.retake.addEventListener('click', () => {
  job = null;
  els.stepEdit.hidden = true;
  els.stepGet.hidden = false;
  setStatus('');
  els.stepGet.scrollIntoView({ behavior: 'smooth', block: 'start' });
});

// drag & drop upload
const drop = $('#pp-drop');
if (drop) {
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => onUpload(e.dataTransfer.files && e.dataTransfer.files[0]));
}

// test hook: process an image URL directly (used by automated checks)
window.__ppProcessUrl = async (url) => {
  const img = new Image(); img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  await process(c);
};
