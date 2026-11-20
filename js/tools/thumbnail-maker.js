/* WebcamClicks — YouTube thumbnail maker: best-frame finder, AI person cut-out with sticker outline,
   bold headline styles, badges, backgrounds; 1280×720 JPG under YouTube's 2 MB limit. All on-device. */

import { $, setupDropzone, setStatus, downloadBlob, loadMediabunny, decodeImage, canvasToBlob, formatBytes, splitName } from './common.js';
import { createTask, personMask, MODELS } from '../segmentation/vision.js';
import { FONTS_CSS } from './caption-render.js';

const W = 1280, H = 720;
const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), cv: $('#tm-canvas'), mini: $('#tm-mini'), work: $('#tm-work'),
  frames: $('#tm-frames'), seek: $('#tm-seek'), video: $('#tm-video'), useFrame: $('#tm-useframe'), vidBox: $('#tm-vidbox'),
  text: $('#tm-text'), font: $('#tm-font'), size: $('#tm-size'), fill: $('#tm-fill'), hl: $('#tm-hl'), stroke: $('#tm-stroke'), upper: $('#tm-upper'),
  cutout: $('#tm-cutout'), outline: $('#tm-outline'), outlineC: $('#tm-outlinec'), scale: $('#tm-scale'), flip: $('#tm-flip'),
  bg: $('#tm-bg'), bgC1: $('#tm-bgc1'), bgC2: $('#tm-bgc2'), dim: $('#tm-dim'), blur: $('#tm-blur'),
  badge: $('#tm-badge'), badgeC: $('#tm-badgec'), tpl: $('#tm-templates'), jpg: $('#tm-jpg'), png: $('#tm-png')
};
if (!document.querySelector('link[data-cap-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.capFonts = '1'; document.head.appendChild(l); }

const S = {
  src: null,        // canvas: the chosen frame / photo
  cut: null,        // canvas: person cut-out (RGBA), cropped to the person
  subj: { x: 0.7, y: 1, scale: 0.95 },     // bottom-centre anchor, fraction of canvas; scale = height fraction
  txt: { x: 0.05, y: 0.12, w: 0.55 },       // top-left of the text block; w = max width fraction
  name: 'thumbnail'
};

/* ---------------------------------------------------------------- sources */
let video = null;   // { file, duration, MB, vt }
async function openFile(f) {
  S.name = splitName(f.name)[0];
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name)) return openVideo(f);
  const bmp = await decodeImage(f);
  els.vidBox.hidden = true;
  await useSource(bmp);
}
async function openVideo(f) {
  setStatus(els.status, 'Finding the best frames…');
  els.vidBox.hidden = false;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  if (!vt) { setStatus(els.status, 'This file has no video.', 'err'); return; }
  const duration = await input.computeDuration(), first = await vt.getFirstTimestamp().catch(() => 0);
  video = { f, duration };
  els.seek.max = duration; els.seek.step = 0.04;
  // score ~24 candidate frames: sharpness, exposure and a visible face
  const N = Math.min(24, Math.max(6, Math.round(duration))), times = Array.from({ length: N }, (_, i) => first + duration * (0.03 + 0.94 * (i / (N - 1))));
  const det = await createTask('FaceDetector', { baseOptions: { modelAssetPath: MODELS.faceDetector }, runningMode: 'IMAGE', minDetectionConfidence: 0.5 }).catch(() => null);
  const cands = [];
  const small = document.createElement('canvas'); small.width = 320; small.height = Math.round(320 * vt.displayHeight / vt.displayWidth);
  const sg = small.getContext('2d', { willReadFrequently: true });
  let i = 0;
  for await (const sm of new MB.VideoSampleSink(vt).samplesAtTimestamps(times)) {
    if (sm) {
      const full = document.createElement('canvas'); full.width = vt.displayWidth; full.height = vt.displayHeight;
      full.getContext('2d').drawImage(sm.toCanvasImageSource(), 0, 0);
      sg.drawImage(full, 0, 0, small.width, small.height);
      const sc = scoreFrame(sg, small.width, small.height, det ? det.detect(small) : null);
      cands.push({ t: times[i] - first, canvas: full, score: sc.score, face: sc.face });
      sm.close();
    }
    if (++i % 4 === 0) setStatus(els.status, `Finding the best frames… ${Math.round((i / N) * 100)}%`);
  }
  if (det && det.close) det.close();
  // best 6, spread out in time
  cands.sort((a, b) => b.score - a.score);
  const picks = [];
  for (const c of cands) { if (picks.every((p) => Math.abs(p.t - c.t) > duration / 20)) picks.push(c); if (picks.length === 6) break; }
  els.frames.innerHTML = picks.map((p, k) => `<button type="button" class="tm-frame" data-k="${k}" title="${p.t.toFixed(1)} s"><img src="${thumbUrl(p.canvas)}" alt="Frame at ${p.t.toFixed(1)} s"></button>`).join('');
  els.frames.onclick = (e) => { const b = e.target.closest('[data-k]'); if (b) { els.seek.value = picks[+b.dataset.k].t; useSource(picks[+b.dataset.k].canvas); } };
  if (picks.length) { els.seek.value = picks[0].t; await useSource(picks[0].canvas); }
  setStatus(els.status, `Picked the sharpest frame${picks[0] && picks[0].face ? ' with a clear face' : ''}.${els.cutout.checked && !S.cut ? ' No person could be cut out of it, so it is used as the background; try another frame.' : ''} Choose another suggestion or scrub to any moment.`, 'ok');
}
function thumbUrl(c) { const t = document.createElement('canvas'); t.width = 240; t.height = Math.round(240 * c.height / c.width); t.getContext('2d').drawImage(c, 0, 0, t.width, t.height); return t.toDataURL('image/jpeg', 0.75); }
function scoreFrame(g, w, h, faces) {
  const d = g.getImageData(0, 0, w, h).data, L = new Float32Array(w * h);
  let sum = 0; for (let i = 0, j = 0; j < L.length; i += 4, j++) { L[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; sum += L[j]; }
  let lap = 0; for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const k = y * w + x, v = 4 * L[k] - L[k - 1] - L[k + 1] - L[k - w] - L[k + w]; lap += v * v; }
  const sharp = Math.log10(1 + lap / ((w - 2) * (h - 2))), mean = sum / L.length;
  let face = 0; for (const f of (faces && faces.detections) || []) face = Math.max(face, (f.boundingBox.width / w) * (f.categories?.[0]?.score ?? 1));
  return { score: sharp + face * 8 - Math.abs(mean - 125) / 60, face };
}
els.seek.addEventListener('input', () => { els.video.currentTime = +els.seek.value; });
els.useFrame.addEventListener('click', () => {
  const v = els.video; if (!v.videoWidth) return;
  const c = document.createElement('canvas'); c.width = v.videoWidth; c.height = v.videoHeight; c.getContext('2d').drawImage(v, 0, 0);
  useSource(c);
});

/* ---------------------------------------------------------------- AI cut-out */
let seg = null;
async function useSource(img) {
  const c = document.createElement('canvas'), k = Math.min(1, 2200 / Math.max(img.width, img.height));
  c.width = Math.round(img.width * k); c.height = Math.round(img.height * k); c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  S.src = c; S.cut = null;
  els.work.hidden = false;
  render();
  if (els.cutout.checked) await cutOut();
}
async function cutOut() {
  if (!S.src) return;
  setStatus(els.status, 'Cutting out the person…');
  try {
    if (!seg) seg = await createTask('ImageSegmenter', { baseOptions: { modelAssetPath: MODELS.segmenterSquare }, runningMode: 'IMAGE', outputConfidenceMasks: true, outputCategoryMask: false });
    const res = seg.segment(S.src), m = personMask(res), conf = m.getAsFloat32Array();
    const mk = document.createElement('canvas'); mk.width = m.width; mk.height = m.height;
    const mg = mk.getContext('2d'), id = mg.createImageData(m.width, m.height);
    let cover = 0;
    for (let i = 0; i < conf.length; i++) { const a = Math.min(1, Math.max(0, (conf[i] - 0.35) * 3)); id.data[i * 4 + 3] = a * 255; cover += a; }
    mg.putImageData(id, 0, 0); if (res.close) res.close();
    if (cover / conf.length < 0.02) { S.cut = null; setStatus(els.status, 'No person found in this frame: the photo is used as the background.', 'err'); render(); return; }
    // person = source masked by the (smoothly upscaled) mask, cropped to its bounding box
    const full = document.createElement('canvas'); full.width = S.src.width; full.height = S.src.height;
    const fg = full.getContext('2d'); fg.imageSmoothingQuality = 'high';
    fg.drawImage(mk, 0, 0, full.width, full.height); fg.globalCompositeOperation = 'source-in'; fg.drawImage(S.src, 0, 0);
    const d = fg.getImageData(0, 0, full.width, full.height).data;
    let x0 = full.width, y0 = full.height, x1 = 0, y1 = 0;
    for (let y = 0; y < full.height; y += 2) for (let x = 0; x < full.width; x += 2) if (d[(y * full.width + x) * 4 + 3] > 40) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    const cut = document.createElement('canvas'); cut.width = x1 - x0 + 1; cut.height = y1 - y0 + 1;
    cut.getContext('2d').drawImage(full, x0, y0, cut.width, cut.height, 0, 0, cut.width, cut.height);
    S.cut = cut;
    setStatus(els.status, 'Done. Drag the person or the text to move them; edit everything on the right.', 'ok');
  } catch (e) { console.warn(e); S.cut = null; setStatus(els.status, 'The AI cut-out could not run on this device; the photo is used as the background.', 'err'); }
  render();
}
els.cutout.addEventListener('change', () => (els.cutout.checked && !S.cut ? cutOut() : render()));

/* ---------------------------------------------------------------- templates */
const TEMPLATES = {
  right: { subj: { x: 0.72, y: 1, scale: 0.98 }, txt: { x: 0.04, y: 0.1, w: 0.52 }, bg: 'photo', align: 'left' },
  left: { subj: { x: 0.28, y: 1, scale: 0.98 }, txt: { x: 0.46, y: 0.1, w: 0.5 }, bg: 'photo', align: 'left' },
  center: { subj: { x: 0.5, y: 1, scale: 0.9 }, txt: { x: 0.05, y: 0.05, w: 0.9 }, bg: 'gradient', align: 'center' },
  bold: { subj: { x: 0.76, y: 1.02, scale: 1.08 }, txt: { x: 0.04, y: 0.22, w: 0.56 }, bg: 'color', align: 'left' }
};
let align = 'left';
els.tpl.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tpl]'); if (!b) return;
  const t = TEMPLATES[b.dataset.tpl]; S.subj = { ...t.subj }; S.txt = { ...t.txt }; els.bg.value = t.bg; align = t.align; els.scale.value = Math.round(t.subj.scale * 100);
  els.tpl.querySelectorAll('[data-tpl]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  render();
});

/* ---------------------------------------------------------------- rendering */
const FONTS = { anton: ['Anton', 400], montserrat: ['Montserrat', 900], bangers: ['Bangers', 400], poppins: ['Poppins', 800], marker: ['Permanent Marker', 400] };
let boxes = { txt: null, subj: null };
function render() {
  const g = els.cv.getContext('2d'); els.cv.width = W; els.cv.height = H;
  g.clearRect(0, 0, W, H);
  // background
  const bg = els.bg.value;
  if (bg === 'photo' && S.src) {
    const k = Math.max(W / S.src.width, H / S.src.height), dw = S.src.width * k, dh = S.src.height * k;
    const b = +els.blur.value;
    if (b > 0) {
      const t = document.createElement('canvas'), q = Math.max(0.02, 1 - b / 110); t.width = Math.max(8, Math.round(W * q * 0.25)); t.height = Math.max(8, Math.round(H * q * 0.25));
      t.getContext('2d').drawImage(S.src, (t.width - dw * t.width / W) / 2, (t.height - dh * t.height / H) / 2, dw * t.width / W, dh * t.height / H);
      g.imageSmoothingQuality = 'high'; g.drawImage(t, 0, 0, W, H);
    } else g.drawImage(S.src, (W - dw) / 2, (H - dh) / 2, dw, dh);
    g.fillStyle = `rgba(0,0,0,${+els.dim.value / 100})`; g.fillRect(0, 0, W, H);
  } else if (bg === 'gradient') {
    const gr = g.createLinearGradient(0, 0, W, H); gr.addColorStop(0, els.bgC1.value); gr.addColorStop(1, els.bgC2.value); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  } else { g.fillStyle = els.bgC1.value; g.fillRect(0, 0, W, H); }
  // person
  boxes.subj = null;
  if (S.cut && els.cutout.checked) {
    const h = H * (+els.scale.value / 100), w = (S.cut.width / S.cut.height) * h;
    const x = S.subj.x * W - w / 2, y = S.subj.y * H - h;
    const flip = els.flip.checked;
    const draw = (img) => { g.save(); if (flip) { g.translate(x + w, y); g.scale(-1, 1); g.drawImage(img, 0, 0, w, h); } else g.drawImage(img, x, y, w, h); g.restore(); };
    const ow = +els.outline.value;
    if (ow > 0) {   // sticker outline: the silhouette, filled with a colour, stamped around in a circle
      const sil = document.createElement('canvas'); sil.width = S.cut.width; sil.height = S.cut.height;
      const sg = sil.getContext('2d'); sg.drawImage(S.cut, 0, 0); sg.globalCompositeOperation = 'source-in'; sg.fillStyle = els.outlineC.value; sg.fillRect(0, 0, sil.width, sil.height);
      const r = ow * (h / 720);
      g.save(); g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = r * 2.2;
      for (let a = 0; a < 16; a++) { const ang = (a / 16) * Math.PI * 2; g.save(); g.translate(Math.cos(ang) * r, Math.sin(ang) * r); draw(sil); g.restore(); }
      g.restore();
    } else { g.save(); g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 30; draw(S.cut); g.restore(); }
    draw(S.cut);
    boxes.subj = [x, y, w, h];
  }
  // headline
  boxes.txt = null;
  const raw = els.text.value.trim();
  if (raw) {
    const [fam, weight] = FONTS[els.font.value] || FONTS.anton;
    const lines = (els.upper.checked ? raw.toUpperCase() : raw).split('\n').slice(0, 4);
    const maxW = S.txt.w * W;
    let px = +els.size.value * 1.4;
    const font = (p) => `${weight} ${p}px "${fam}", Impact, "Arial Black", sans-serif`;
    g.font = font(px);
    const plain = (l) => l.replace(/\*/g, '');
    while (px > 24 && Math.max(...lines.map((l) => g.measureText(plain(l)).width)) > maxW) { px -= 2; g.font = font(px); }
    const lh = px * 1.04;
    let y = S.txt.y * H + px * 0.88;
    const strokeW = px * (+els.stroke.value / 100);
    g.lineJoin = 'round'; g.textBaseline = 'alphabetic';
    let bw = 0;
    for (const line of lines) {
      const lw = g.measureText(plain(line)).width; bw = Math.max(bw, lw);
      let x = S.txt.x * W + (align === 'center' ? (maxW - lw) / 2 : 0);
      for (const part of line.split(/(\*[^*]+\*)/).filter(Boolean)) {
        const hl = /^\*.*\*$/.test(part), t = part.replace(/\*/g, ''), pw = g.measureText(t).width;
        if (strokeW > 0) { g.save(); g.shadowColor = 'rgba(0,0,0,.55)'; g.shadowBlur = px * 0.18; g.shadowOffsetY = px * 0.06; g.lineWidth = strokeW * 2; g.strokeStyle = '#000'; g.strokeText(t, x, y); g.restore(); }
        g.fillStyle = hl ? els.hl.value : els.fill.value; g.fillText(t, x, y);
        x += pw;
      }
      y += lh;
    }
    boxes.txt = [S.txt.x * W, S.txt.y * H, align === 'center' ? maxW : bw, lh * lines.length];
  }
  // badge
  const badge = els.badge.value.trim();
  if (badge) {
    g.font = '800 46px Poppins, "Arial Black", sans-serif';
    const tw = g.measureText(badge.toUpperCase()).width, bx = W - tw - 70, by = 30;
    g.save(); g.translate(bx + tw / 2 + 22, by + 34); g.rotate(-0.05);
    g.fillStyle = els.badgeC.value; g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 16;
    const rw = tw + 44, rh = 68; g.beginPath(); g.roundRect(-rw / 2, -rh / 2, rw, rh, 14); g.fill();
    g.shadowColor = 'transparent'; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(badge.toUpperCase(), 0, 3); g.restore();
  }
  // the size it is seen at in search results and sidebars
  const m = els.mini.getContext('2d'); m.imageSmoothingQuality = 'high'; m.drawImage(els.cv, 0, 0, els.mini.width, els.mini.height);
}
document.fonts && document.fonts.addEventListener('loadingdone', render);
['input', 'change'].forEach((ev) => [els.text, els.font, els.size, els.fill, els.hl, els.stroke, els.upper, els.outline, els.outlineC, els.scale, els.flip, els.bg, els.bgC1, els.bgC2, els.dim, els.blur, els.badge, els.badgeC].forEach((c) => c.addEventListener(ev, render)));

/* ---------------------------------------------------------------- drag to move */
let drag = null;
const pt = (e) => { const r = els.cv.getBoundingClientRect(); return [((e.clientX - r.left) / r.width) * W, ((e.clientY - r.top) / r.height) * H]; };
const inside = (b, [x, y]) => b && x >= b[0] && x <= b[0] + b[2] && y >= b[1] && y <= b[1] + b[3];
els.cv.addEventListener('pointerdown', (e) => {
  const p = pt(e);
  if (inside(boxes.txt, p)) drag = { what: 'txt', p, o: { ...S.txt } };
  else if (inside(boxes.subj, p)) drag = { what: 'subj', p, o: { ...S.subj } };
  else return;
  els.cv.setPointerCapture(e.pointerId); e.preventDefault();
});
els.cv.addEventListener('pointermove', (e) => {
  const p = pt(e);
  els.cv.style.cursor = drag || inside(boxes.txt, p) || inside(boxes.subj, p) ? 'move' : 'default';
  if (!drag) return;
  const dx = (p[0] - drag.p[0]) / W, dy = (p[1] - drag.p[1]) / H;
  S[drag.what] = { ...drag.o, x: drag.o.x + dx, y: drag.o.y + dy };
  render();
});
els.cv.addEventListener('pointerup', () => { drag = null; });
els.cv.addEventListener('wheel', (e) => { if (!inside(boxes.subj, pt(e))) return; e.preventDefault(); els.scale.value = Math.max(30, Math.min(160, +els.scale.value - Math.sign(e.deltaY) * 4)); render(); }, { passive: false });

/* ---------------------------------------------------------------- export */
els.jpg.addEventListener('click', async () => {
  render();
  let q = 0.92, blob = await canvasToBlob(els.cv, 'image/jpeg', q);
  while (blob.size > 1.95 * 1024 * 1024 && q > 0.5) { q -= 0.07; blob = await canvasToBlob(els.cv, 'image/jpeg', q); }   // YouTube's limit is 2 MB
  downloadBlob(blob, `${S.name}-thumbnail.jpg`);
  setStatus(els.status, `Saved a 1280×720 JPG (${formatBytes(blob.size)}), ready to upload in YouTube Studio.`, 'ok');
});
els.png.addEventListener('click', async () => { render(); downloadBlob(await canvasToBlob(els.cv, 'image/png'), `${S.name}-thumbnail.png`); });

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(image|video)\//.test(x.type) || /\.(heic|heif|mp4|mov|webm|mkv)$/i.test(x.name));
  if (f) openFile(f).catch((e) => setStatus(els.status, e.message, 'err')); else setStatus(els.status, 'Please choose a photo or a video.', 'err');
});
// start with a usable canvas even before a photo is added
els.work.hidden = false; render();
window.__tmTest = { S, render, get boxes() { return boxes; } };
