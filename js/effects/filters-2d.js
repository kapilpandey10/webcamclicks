/* WebcamClicks — Canvas 2D effect library (part 1 of 4).
   Every effect object: { id, name, icon, category, perf, render(fx, frame) }
   `frame` = { src, width, height, time, dt, face, motion, camera } */

import { clamp, rand, pick, makeCanvas } from '../utils.js';

/* ---------- shared scratch canvas (reused for pixel passes) ---------- */
let SCRATCH = null;
function ensureScratch(w, h) {
  if (!SCRATCH) {
    SCRATCH = makeCanvas(w, h);
    SCRATCH.gx = SCRATCH.getContext('2d', { willReadFrequently: true });
    SCRATCH.w = w;
    SCRATCH.h = h;
  }
  if (SCRATCH.w !== w || SCRATCH.h !== h) {
    SCRATCH.width = w;
    SCRATCH.height = h;
    SCRATCH.w = w;
    SCRATCH.h = h;
  }
  SCRATCH.gx.setTransform(1, 0, 0, 1, 0, 0);
  SCRATCH.gx.globalAlpha = 1;
  SCRATCH.gx.globalCompositeOperation = 'source-over';
  SCRATCH.gx.filter = 'none';
  return SCRATCH;
}

/** Read src pixels into `fn(data,w,h)`, then blit the result onto fx. */
function pixelPass(fx, src, fn) {
  const w = fx.canvas.width;
  const h = fx.canvas.height;
  const sc = ensureScratch(w, h);
  sc.gx.drawImage(src, 0, 0, w, h);
  const img = sc.gx.getImageData(0, 0, w, h);
  fn(img.data, w, h);
  fx.putImageData(img, 0, 0);
}

const lumOf = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;

/* ---------- noise helper ---------- */
function addNoise(data, amount, mono = true) {
  const len = data.length;
  if (mono) {
    for (let i = 0; i < len; i += 4) {
      const n = (Math.random() * 2 - 1) * amount;
      data[i] = clamp(data[i] + n, 0, 255);
      data[i + 1] = clamp(data[i + 1] + n, 0, 255);
      data[i + 2] = clamp(data[i + 2] + n, 0, 255);
    }
  } else {
    for (let i = 0; i < len; i += 4) {
      data[i] = clamp(data[i] + (Math.random() * 2 - 1) * amount, 0, 255);
      data[i + 1] = clamp(data[i + 1] + (Math.random() * 2 - 1) * amount, 0, 255);
      data[i + 2] = clamp(data[i + 2] + (Math.random() * 2 - 1) * amount, 0, 255);
    }
  }
}

/* ---------- 35mm film grain pattern (pre-rendered seamless texture, 60 FPS) ---------- */
let GRAIN_CANVAS = null;
let GRAIN_PATTERN = null;
function getGrainPattern(ctx) {
  if (GRAIN_PATTERN) return GRAIN_PATTERN;
  GRAIN_CANVAS = makeCanvas(200, 200);
  const gctx = GRAIN_CANVAS.getContext('2d');
  const imgData = gctx.createImageData(200, 200);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const val = (Math.random() * 255) | 0;
    d[i] = val;
    d[i + 1] = val;
    d[i + 2] = val;
    d[i + 3] = (Math.random() * 50 + 20) | 0;
  }
  gctx.putImageData(imgData, 0, 0);
  GRAIN_PATTERN = ctx.createPattern(GRAIN_CANVAS, 'repeat');
  return GRAIN_PATTERN;
}

function applyFilmGrain(fx, w, h, opacity = 0.18) {
  const pat = getGrainPattern(fx);
  if (!pat) return;
  fx.save();
  fx.globalCompositeOperation = 'overlay';
  fx.globalAlpha = opacity;
  fx.fillStyle = pat;
  const ox = (Math.random() * 200) | 0;
  const oy = (Math.random() * 200) | 0;
  fx.translate(ox, oy);
  fx.fillRect(-200, -200, w + 400, h + 400);
  fx.restore();
}

/* ---------- optical bloom & halation (downscaled glow buffer) ---------- */
let BLOOM_CANVAS = null;
function getBloomCanvas(w, h) {
  const bw = Math.max(2, Math.floor(w / 3));
  const bh = Math.max(2, Math.floor(h / 3));
  if (!BLOOM_CANVAS) {
    BLOOM_CANVAS = makeCanvas(bw, bh);
  }
  if (BLOOM_CANVAS.width !== bw || BLOOM_CANVAS.height !== bh) {
    BLOOM_CANVAS.width = bw;
    BLOOM_CANVAS.height = bh;
  }
  return BLOOM_CANVAS;
}

function renderHalationBloom(fx, src, w, h, strength = 0.38, tint = 'warm') {
  const bc = getBloomCanvas(w, h);
  const bx = bc.getContext('2d');
  bx.setTransform(1, 0, 0, 1, 0, 0);
  bx.clearRect(0, 0, bc.width, bc.height);

  if (tint === 'warm') {
    bx.filter = 'brightness(1.22) contrast(1.3) blur(6px) sepia(0.55)';
  } else if (tint === 'hollywood') {
    bx.filter = 'brightness(1.25) contrast(1.35) blur(7px) saturate(1.4)';
  } else if (tint === 'bw') {
    bx.filter = 'grayscale(1) brightness(1.25) contrast(1.3) blur(6px)';
  } else {
    bx.filter = 'brightness(1.25) contrast(1.25) blur(6px)';
  }
  bx.drawImage(src, 0, 0, bc.width, bc.height);
  bx.filter = 'none';

  fx.save();
  fx.globalCompositeOperation = 'screen';
  fx.globalAlpha = strength;
  fx.drawImage(bc, 0, 0, bc.width, bc.height, 0, 0, w, h);
  fx.restore();
}

/* ---------- 90s vintage date stamp imprint ---------- */
function drawDateStamp(fx, w, h) {
  fx.save();
  const d = new Date();
  const yr = String(d.getFullYear()).slice(-2);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const str = `'${yr} ${mo} ${day}`;

  const fontSize = Math.max(14, Math.round(w * 0.026));
  fx.font = `bold ${fontSize}px "Courier New", Courier, monospace`;
  fx.textAlign = 'right';
  fx.textBaseline = 'bottom';

  const x = w - Math.round(w * 0.04);
  const y = h - Math.round(h * 0.04);

  fx.shadowColor = '#f97316';
  fx.shadowBlur = 8;
  fx.fillStyle = '#ffb300';
  fx.fillText(str, x, y);
  fx.fillStyle = '#fffbeb';
  fx.fillText(str, x, y);
  fx.restore();
}

/* ---------- anamorphic horizontal lens flare streak ---------- */
function drawAnamorphicStreak(fx, src, w, h, t) {
  fx.save();
  fx.globalCompositeOperation = 'screen';
  fx.globalAlpha = 0.42;

  const flareY = h * 0.46 + Math.sin(t * 0.8) * (h * 0.08);
  const streak = fx.createLinearGradient(0, flareY, w, flareY);
  streak.addColorStop(0, 'rgba(0, 180, 255, 0)');
  streak.addColorStop(0.3, 'rgba(0, 220, 255, 0.35)');
  streak.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
  streak.addColorStop(0.7, 'rgba(0, 220, 255, 0.35)');
  streak.addColorStop(1, 'rgba(0, 180, 255, 0)');

  fx.fillStyle = streak;
  fx.fillRect(0, flareY - 1.5, w, 3);
  fx.restore();
}

/* ---------- optical bokeh circular discs ---------- */
function drawBackgroundBokehDiscs(fx, w, h, t) {
  fx.save();
  fx.globalCompositeOperation = 'screen';
  const discs = [
    { x: 0.12, y: 0.22, r: 38, col: 'rgba(255, 220, 150, 0.16)' },
    { x: 0.88, y: 0.18, r: 46, col: 'rgba(180, 240, 255, 0.18)' },
    { x: 0.22, y: 0.78, r: 32, col: 'rgba(255, 180, 200, 0.15)' },
    { x: 0.82, y: 0.72, r: 42, col: 'rgba(255, 230, 160, 0.16)' },
    { x: 0.08, y: 0.52, r: 28, col: 'rgba(200, 255, 220, 0.14)' },
    { x: 0.94, y: 0.44, r: 34, col: 'rgba(240, 200, 255, 0.15)' }
  ];
  for (let i = 0; i < discs.length; i++) {
    const d = discs[i];
    const dx = d.x * w + Math.sin(t * 0.6 + i) * 8;
    const dy = d.y * h + Math.cos(t * 0.7 + i) * 8;
    fx.fillStyle = d.col;
    fx.beginPath();
    fx.arc(dx, dy, d.r, 0, Math.PI * 2);
    fx.fill();
    fx.strokeStyle = d.col;
    fx.lineWidth = 2.5;
    fx.stroke();
  }
  fx.restore();
}

/* ---------- shutter drag motion blur accumulation buffer ---------- */
let MOTION_ACCUM = null;
function renderShutterMotion(fx, src, w, h, decay = 0.74) {
  if (!MOTION_ACCUM || MOTION_ACCUM.width !== w || MOTION_ACCUM.height !== h) {
    MOTION_ACCUM = makeCanvas(w, h);
    const mx = MOTION_ACCUM.getContext('2d');
    mx.drawImage(src, 0, 0, w, h);
  }
  const mx = MOTION_ACCUM.getContext('2d');
  mx.globalCompositeOperation = 'source-over';
  mx.globalAlpha = 1 - decay;
  mx.drawImage(src, 0, 0, w, h);
  mx.globalAlpha = 1;

  fx.drawImage(MOTION_ACCUM, 0, 0, w, h);
}

/* ---------- chromatic dream trails (temporal ghost echo) ---------- */
const TRAIL_FRAMES = [];
function renderDreamTrails(fx, src, w, h) {
  if (TRAIL_FRAMES.length < 3 || TRAIL_FRAMES[0].width !== w || TRAIL_FRAMES[0].height !== h) {
    TRAIL_FRAMES.length = 0;
    for (let i = 0; i < 3; i++) {
      const c = makeCanvas(w, h);
      c.getContext('2d').drawImage(src, 0, 0, w, h);
      TRAIL_FRAMES.push(c);
    }
  }

  const oldest = TRAIL_FRAMES.pop();
  const ox = oldest.getContext('2d');
  ox.drawImage(src, 0, 0, w, h);
  TRAIL_FRAMES.unshift(oldest);

  fx.drawImage(src, 0, 0, w, h);

  fx.save();
  fx.globalCompositeOperation = 'screen';
  fx.globalAlpha = 0.45;
  fx.filter = 'drop-shadow(0 0 10px rgba(255, 50, 100, 0.8)) hue-rotate(330deg)';
  fx.drawImage(TRAIL_FRAMES[1], 0, 0, w, h);

  fx.globalAlpha = 0.38;
  fx.filter = 'drop-shadow(0 0 12px rgba(0, 220, 255, 0.8)) hue-rotate(180deg)';
  fx.drawImage(TRAIL_FRAMES[2], 0, 0, w, h);
  fx.restore();
}

/* ---------- face-aware & radial depth portrait bokeh ---------- */
let portraitState = null;
let portraitScratch = null;
function renderPortraitBokeh(fx, frame, isSpotlight = false) {
  const { src, width: w, height: h, face } = frame;

  let targetCx = w / 2;
  let targetCy = h * 0.46;
  let targetRx = w * 0.27;
  let targetRy = h * 0.44;

  const box = face && face.box;
  if (box && box.width > 20) {
    targetCx = box.x + box.width / 2;
    targetCy = box.y + box.height * 0.68;
    targetRx = Math.max(w * 0.2, box.width * 1.05);
    targetRy = Math.max(h * 0.34, box.height * 1.68);
  }

  if (!portraitState) {
    portraitState = { cx: targetCx, cy: targetCy, rx: targetRx, ry: targetRy };
  } else {
    const alpha = 0.18;
    portraitState.cx += (targetCx - portraitState.cx) * alpha;
    portraitState.cy += (targetCy - portraitState.cy) * alpha;
    portraitState.rx += (targetRx - portraitState.rx) * alpha;
    portraitState.ry += (targetRy - portraitState.ry) * alpha;
  }

  const { cx, cy, rx, ry } = portraitState;

  fx.save();
  fx.filter = isSpotlight ? 'blur(16px) brightness(0.65) saturate(1.1)' : 'blur(15px) brightness(0.96) saturate(1.06)';
  fx.drawImage(src, 0, 0, w, h);
  fx.restore();

  drawBackgroundBokehDiscs(fx, w, h, frame.time || 0);

  if (!portraitScratch || portraitScratch.width !== w || portraitScratch.height !== h) {
    portraitScratch = makeCanvas(w, h);
  }
  const px = portraitScratch.getContext('2d');
  px.setTransform(1, 0, 0, 1, 0, 0);
  px.clearRect(0, 0, w, h);
  px.drawImage(src, 0, 0, w, h);

  px.globalCompositeOperation = 'destination-in';
  const grad = px.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.45, cx, cy, Math.max(rx, ry));
  grad.addColorStop(0, 'rgba(0, 0, 0, 1)');
  grad.addColorStop(0.72, 'rgba(0, 0, 0, 0.96)');
  grad.addColorStop(0.94, 'rgba(0, 0, 0, 0.35)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
  px.fillStyle = grad;
  px.beginPath();
  px.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
  px.fill();
  px.globalCompositeOperation = 'source-over';

  fx.drawImage(portraitScratch, 0, 0);

  fx.save();
  fx.globalCompositeOperation = 'soft-light';
  const light = fx.createRadialGradient(cx, cy, 10, cx, cy, rx * 1.25);
  light.addColorStop(0, isSpotlight ? 'rgba(255, 250, 240, 0.65)' : 'rgba(255, 248, 235, 0.32)');
  light.addColorStop(1, 'rgba(0, 0, 0, 0)');
  fx.fillStyle = light;
  fx.fillRect(0, 0, w, h);
  fx.restore();
}

/* ---------- Y2K skate fisheye deathlens ---------- */
function renderFisheye(fx, src, w, h) {
  fx.save();
  fx.filter = 'contrast(1.3) saturate(1.45) brightness(1.05)';
  fx.drawImage(src, 0, 0, w, h);
  fx.filter = 'none';

  const cx = w / 2;
  const cy = h / 2;
  const maxR = Math.min(w, h) * 0.48;

  fx.save();
  fx.beginPath();
  fx.arc(cx, cy, maxR * 0.65, 0, Math.PI * 2);
  fx.clip();
  fx.drawImage(src, cx - maxR * 0.65, cy - maxR * 0.65, maxR * 1.3, maxR * 1.3,
                   cx - maxR * 0.76, cy - maxR * 0.76, maxR * 1.52, maxR * 1.52);
  fx.restore();

  fx.save();
  const vig = fx.createRadialGradient(cx, cy, maxR * 0.8, cx, cy, maxR * 1.15);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.85, 'rgba(0, 0, 0, 0.85)');
  vig.addColorStop(1, 'rgba(0, 0, 0, 1)');
  fx.fillStyle = vig;
  fx.fillRect(0, 0, w, h);

  fx.beginPath();
  fx.rect(0, 0, w, h);
  fx.arc(cx, cy, maxR, 0, Math.PI * 2, true);
  fx.fillStyle = '#000000';
  fx.fill();
  fx.restore();
}

export const defs2d = [
  /* ============================ VINTAGE ============================ */
  {
    id: 'portra400', name: 'Kodak Portra 400', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.14) brightness(1.06) saturate(1.26)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.38, 'warm');

      fx.save();
      const filmGrad = fx.createLinearGradient(0, 0, w, h);
      filmGrad.addColorStop(0, 'rgba(255, 215, 110, 0.24)');
      filmGrad.addColorStop(0.5, 'rgba(255, 185, 90, 0.14)');
      filmGrad.addColorStop(1, 'rgba(0, 175, 185, 0.16)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = filmGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      const vig = fx.createRadialGradient(w * 0.48, h * 0.44, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.76);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.68, 'rgba(130, 70, 10, 0.14)');
      vig.addColorStop(1, 'rgba(40, 20, 0, 0.48)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.2);
    }
  },
  {
    id: 'vintage70s', name: '1970s Film', icon: '📽️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'sepia(0.24) contrast(1.2) saturate(1.3) brightness(1.04)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      fx.globalCompositeOperation = 'screen';
      const leak = fx.createLinearGradient(0, 0, w * 0.55, h * 0.6);
      leak.addColorStop(0, 'rgba(255, 120, 40, 0.35)');
      leak.addColorStop(0.35, 'rgba(255, 200, 70, 0.22)');
      leak.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = leak;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(50, 25, 0, 0.55)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.25);
    }
  },
  {
    id: 'disposable90s', name: '90s Disposable', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.28) saturate(1.35) brightness(1.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const flashGrad = fx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.45, Math.max(w, h) * 0.7);
      flashGrad.addColorStop(0, 'rgba(255, 255, 240, 0.16)');
      flashGrad.addColorStop(0.65, 'rgba(0, 20, 10, 0.1)');
      flashGrad.addColorStop(1, 'rgba(0, 30, 20, 0.6)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = flashGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      fx.globalCompositeOperation = 'color';
      fx.globalAlpha = 0.14;
      fx.fillStyle = '#065f46';
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.22);
      drawDateStamp(fx, w, h);
    }
  },
  {
    id: 'polaroid', name: 'Polaroid 600', icon: '📷', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.1) brightness(1.08) saturate(1.18) sepia(0.12)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const chemGrad = fx.createLinearGradient(0, 0, 0, h);
      chemGrad.addColorStop(0, 'rgba(255, 240, 200, 0.14)');
      chemGrad.addColorStop(0.7, 'rgba(100, 200, 220, 0.08)');
      chemGrad.addColorStop(1, 'rgba(50, 80, 120, 0.18)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = chemGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      const frameW = Math.round(w * 0.035);
      const frameBot = Math.round(h * 0.09);
      fx.fillStyle = '#f8fafc';
      fx.fillRect(0, 0, w, frameW);
      fx.fillRect(0, 0, frameW, h);
      fx.fillRect(w - frameW, 0, frameW, h);
      fx.fillRect(0, h - frameBot, w, frameBot);

      applyFilmGrain(fx, w, h, 0.16);
    }
  },
  {
    id: 'goldenhour', name: 'Golden Hour', icon: '🌅', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.filter = 'sepia(0.35) saturate(1.45) contrast(1.1) brightness(1.06)';
      fx.drawImage(src, 0, 0, w, h);

      const flare = fx.createRadialGradient(w * 0.15, h * 0.15, 20, w * 0.25, h * 0.25, w * 0.75);
      flare.addColorStop(0, 'rgba(255, 223, 128, 0.55)');
      flare.addColorStop(0.3, 'rgba(251, 146, 60, 0.28)');
      flare.addColorStop(0.7, 'rgba(236, 72, 153, 0.12)');
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');

      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = flare;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },

  /* ============================ CINEMA ============================ */
  {
    id: 'hollywood', name: 'Hollywood Cinema', icon: '🎬', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'contrast(1.22) saturate(1.26) brightness(0.98)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.28, 'hollywood');

      fx.save();
      const toGrad = fx.createLinearGradient(0, 0, 0, h);
      toGrad.addColorStop(0, 'rgba(255, 140, 40, 0.16)');
      toGrad.addColorStop(0.65, 'rgba(255, 110, 20, 0.12)');
      toGrad.addColorStop(1, 'rgba(0, 160, 190, 0.24)');
      fx.globalCompositeOperation = 'color-dodge';
      fx.globalAlpha = 0.42;
      fx.fillStyle = toGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      drawAnamorphicStreak(fx, src, w, h, t);

      const barH = Math.round(h * 0.11);
      fx.fillStyle = '#05070a';
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.14);
    }
  },
  {
    id: 'silverscreen', name: 'Silver Screen', icon: '📽️', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'grayscale(1) contrast(1.36) brightness(1.04)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.42, 'bw');

      fx.save();
      const vig = fx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.28, w / 2, h * 0.45, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.8, 'rgba(0, 0, 0, 0.4)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.28);
    }
  },
  {
    id: 'motionblur', name: 'Motion Blur', icon: '💫', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      renderShutterMotion(fx, src, w, h, 0.74);
    }
  },
  {
    id: 'promist', name: 'Dream Pro-Mist', icon: '✨', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.08) brightness(1.04) saturate(1.15)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.52, 'warm');

      fx.save();
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = 'rgba(255, 235, 210, 0.2)';
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.12);
    }
  },
  {
    id: 'neonnoir', name: 'Neon Noir', icon: '🌆', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'contrast(1.35) saturate(1.5) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const neonGrad = fx.createLinearGradient(0, 0, w, 0);
      neonGrad.addColorStop(0, 'rgba(236, 72, 153, 0.28)');
      neonGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      neonGrad.addColorStop(1, 'rgba(6, 182, 212, 0.32)');
      fx.globalCompositeOperation = 'color-dodge';
      fx.fillStyle = neonGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      drawAnamorphicStreak(fx, src, w, h, t);

      const barH = Math.round(h * 0.09);
      fx.fillStyle = '#06080d';
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.18);
    }
  },

  /* ============================ PORTRAIT ============================ */
  {
    id: 'portraitbokeh', name: 'Portrait Bokeh', icon: '👤', category: 'Portrait', perf: 'low', requiresFace: true,
    render(fx, frame) {
      renderPortraitBokeh(fx, frame, false);
    }
  },
  {
    id: 'studioportrait', name: 'Studio Spotlight', icon: '🎭', category: 'Portrait', perf: 'low', requiresFace: true,
    render(fx, frame) {
      renderPortraitBokeh(fx, frame, true);
    }
  },
  {
    id: 'bright', name: 'Soft Glow', icon: '💡', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'brightness(1.25) contrast(1.06) saturate(1.1)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'pastel', name: 'Pastel', icon: '🎀', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'blur(0.6px) saturate(1.35) brightness(1.16) contrast(0.92)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'softblur', name: 'Soft Focus', icon: '🌫️', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'blur(5px) brightness(1.08)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
      fx.globalAlpha = 0.55;
      fx.drawImage(src, 0, 0, width, height);
      fx.globalAlpha = 1;
    }
  },

  /* ============================ CLASSIC ============================ */
  {
    id: 'normal', name: 'Normal', icon: '🎥', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.drawImage(src, 0, 0, width, height);
    }
  },
  {
    id: 'grayscale', name: 'Black & White', icon: '⚫', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'grayscale(1)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'sepia', name: 'Sepia', icon: '🟤', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'sepia(0.85)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'invert', name: 'Invert', icon: '🔃', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'invert(1)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'contrast', name: 'Punchy', icon: '🎚️', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'contrast(1.45) saturate(1.25)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  },
  {
    id: 'vignette', name: 'Vignette', icon: '⭕', category: 'Classic', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.34, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,0,0,0.78)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },

  /* ============================ VINTAGE CLASSICS ============================ */
  {
    id: 'vintage', name: 'Vintage', icon: '📻', category: 'Vintage', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'sepia(0.55) contrast(1.18) saturate(0.85) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      pixelPass(fx, fx.canvas, (d) => addNoise(d, 10));
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(40,20,0,0.5)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },

  {
    id: 'lomo', name: 'Lomo', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'saturate(1.55) contrast(1.32) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.75, 'rgba(0,0,20,0.25)');
      g.addColorStop(1, 'rgba(0,0,30,0.72)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'xpro', name: 'X-Pro', icon: '🧪', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'hue-rotate(350deg) saturate(1.65) contrast(1.22) brightness(1.03)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
    }
  },
  {
    id: 'oldmovie', name: 'Old Movie', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'sepia(0.5) contrast(1.3) brightness(0.9)';
      fx.drawImage(src, -1 + Math.random() * 2, 0, w, h);
      fx.filter = 'none';
      if (Math.random() < 0.75) {
        fx.strokeStyle = 'rgba(255,255,255,0.26)';
        fx.lineWidth = 1;
        const n = 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const x = Math.random() * w;
          fx.beginPath();
          fx.moveTo(x, 0);
          fx.lineTo(x + rand(-6, 6), h * rand(0.3, 1));
          fx.stroke();
        }
      }
      fx.fillStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`;
      fx.fillRect(0, 0, w, h);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(20,10,0,0.6)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'cocoa', name: 'Cocoa', icon: '🍫', category: 'Vintage', perf: 'high',
    render(fx, { src }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          d[i] = clamp((r * 0.75 + 66 - 128) * 1.12 + 128, 0, 255);
          d[i + 1] = clamp((g * 0.55 + 44 - 110) * 1.1 + 110, 0, 255);
          d[i + 2] = clamp((b * 0.42 + 30 - 96) * 1.08 + 96, 0, 255);
        }
      });
    }
  },
  {
    id: 'filmgrain', name: 'Film Grain', icon: '🎬', category: 'Vintage', perf: 'high',
    render(fx, { src }) {
      pixelPass(fx, src, (d) => {
        addNoise(d, 24);
        for (let i = 0; i < d.length; i += 4) {
          d[i] = clamp((d[i] - 128) * 1.08 + 128, 0, 255);
          d[i + 1] = clamp((d[i + 1] - 128) * 1.08 + 128, 0, 255);
          d[i + 2] = clamp((d[i + 2] - 128) * 1.08 + 128, 0, 255);
        }
      });
    }
  },
  {
    id: 'hazy', name: 'Hazy Days', icon: '🌅', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'brightness(1.18) contrast(0.74) saturate(0.88) sepia(0.18)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      const g = fx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,235,205,0.28)');
      g.addColorStop(0.55, 'rgba(255,235,205,0.04)');
      g.addColorStop(1, 'rgba(255,235,205,0.16)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },

  /* ============================ ART ============================ */
  {
    id: 'dreamtrails', name: 'Dream Trails', icon: '🌀', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      renderDreamTrails(fx, src, w, h);
    }
  },
  {
    id: 'chromatic', name: 'Prism Glitch', icon: '💎', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      const shift = 4 + Math.sin(t * 2) * 2;
      fx.save();
      fx.filter = 'hue-rotate(340deg) saturate(1.4)';
      fx.drawImage(src, -shift, 0, w, h);

      fx.globalCompositeOperation = 'screen';
      fx.filter = 'hue-rotate(180deg) saturate(1.4)';
      fx.drawImage(src, shift, 0, w, h);

      fx.globalCompositeOperation = 'overlay';
      fx.filter = 'contrast(1.1)';
      fx.globalAlpha = 0.6;
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();
    }
  },
  {
    id: 'popart', name: 'Pop Art', icon: '🎨', category: 'Art', perf: 'high',
    render(fx, { src }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const r = d[i], g = d[i + 1], b = d[i + 2];
          const avg = (r + g + b) / 3;
          let nr = clamp(avg + (r - avg) * 2.1, 0, 255);
          let ng = clamp(avg + (g - avg) * 2.1, 0, 255);
          let nb = clamp(avg + (b - avg) * 2.1, 0, 255);
          d[i] = Math.round(clamp(nr, 0, 255) / 64) * 64;
          d[i + 1] = Math.round(clamp(ng, 0, 255) / 64) * 64;
          d[i + 2] = Math.round(clamp(nb, 0, 255) / 64) * 64;
        }
      });
    }
  },
  {
    id: 'comic', name: 'Comic Book', icon: '💥', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = lumOf(d[p], d[p + 1], d[p + 2]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const avg = (d[p] + d[p + 1] + d[p + 2]) / 3;
          let r = avg + (d[p] - avg) * 1.7;
          let g = avg + (d[p + 1] - avg) * 1.7;
          let b = avg + (d[p + 2] - avg) * 1.7;
          r = Math.round(clamp(r, 0, 255) / 64) * 64;
          g = Math.round(clamp(g, 0, 255) / 64) * 64;
          b = Math.round(clamp(b, 0, 255) / 64) * 64;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          if (Math.abs(xr - xl) + Math.abs(yd - yu) > 58) { r = 18; g = 14; b = 28; }
          d[p] = r;
          d[p + 1] = g;
          d[p + 2] = b;
        }
      }
      fx.putImageData(img, 0, 0);
    }
  },

  {
    id: 'sketch', name: 'Pencil Sketch', icon: '✏️', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.filter = 'grayscale(1) contrast(1.05)';
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.filter = 'none';
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = d[p];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          const edge = Math.abs(xr - xl) + Math.abs(yd - yu);
          let v = 248 - edge * 2.4 - (255 - gray[i]) * 0.32;
          v = clamp(v, 0, 255);
          const n = (Math.random() * 2 - 1) * 5;
          d[p] = clamp(v + n + 6, 0, 255);
          d[p + 1] = clamp(v + n + 2, 0, 255);
          d[p + 2] = clamp(v + n - 8, 0, 255);
        }
      }
      fx.putImageData(img, 0, 0);
    }
  },
  {
    id: 'watercolor', name: 'Watercolor', icon: '🖌️', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.filter = 'blur(2.2px) saturate(1.55)';
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.filter = 'none';
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp(Math.round(clamp(d[i], 0, 255) / 51) * 51 + 16 + (Math.random() * 6 - 3), 0, 255);
        d[i + 1] = clamp(Math.round(clamp(d[i + 1], 0, 255) / 51) * 51 + 18 + (Math.random() * 6 - 3), 0, 255);
        d[i + 2] = clamp(Math.round(clamp(d[i + 2], 0, 255) / 51) * 51 + 20 + (Math.random() * 6 - 3), 0, 255);
      }
      fx.putImageData(img, 0, 0);
    }
  },
  {
    id: 'neon', name: 'Neon Glow', icon: '🟣', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          const edge = clamp(Math.abs(xr - xl) + Math.abs(yd - yu), 0, 120);
          const glow = edge * 2.1;
          d[p] = clamp(gray[i] * 0.1 + glow * 1.25, 0, 255);
          d[p + 1] = clamp(gray[i] * 0.08 + glow * 0.28, 0, 255);
          d[p + 2] = clamp(gray[i] * 0.14 + glow * 1.6 + 18, 0, 255);
        }
      }
      fx.putImageData(img, 0, 0);
    }
  },
  {
    id: 'ascii', name: 'ASCII Art', icon: '⌨️', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const CHARS = ' .`:-=+*#%@';
      const rows = 46;
      const cellH = h / rows;
      const cols = Math.max(4, Math.floor(w / (cellH * 0.55)));
      const sc = ensureScratch(cols, rows);
      sc.gx.drawImage(src, 0, 0, cols, rows);
      const d = sc.gx.getImageData(0, 0, cols, rows).data;
      fx.fillStyle = '#04070a';
      fx.fillRect(0, 0, w, h);
      fx.font = `${cellH.toFixed(2)}px "Courier New", ui-monospace, monospace`;
      fx.textBaseline = 'top';
      fx.fillStyle = '#3dff8e';
      for (let y = 0; y < rows; y++) {
        let line = '';
        for (let x = 0; x < cols; x++) {
          const p = (y * cols + x) * 4;
          const lum = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
          line += CHARS[Math.min(CHARS.length - 1, ((lum / 256) * CHARS.length) | 0)];
        }
        fx.fillText(line, 0, y * cellH);
      }
    }
  },
  {
    id: 'mosaic', name: 'Mosaic', icon: '🔷', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const cols = 28;
      const rows = Math.max(2, Math.round((cols * h) / w));
      const sc = ensureScratch(cols, rows);
      sc.gx.drawImage(src, 0, 0, cols, rows);
      fx.imageSmoothingEnabled = false;
      fx.drawImage(sc.canvas, 0, 0, w, h);
      fx.imageSmoothingEnabled = true;
    }
  },
  {
    id: 'pixelate', name: 'Pixelate', icon: '🟦', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const cols = 64;
      const rows = Math.max(2, Math.round((cols * h) / w));
      const sc = ensureScratch(cols, rows);
      sc.gx.drawImage(src, 0, 0, cols, rows);
      fx.imageSmoothingEnabled = false;
      fx.drawImage(sc.canvas, 0, 0, w, h);
      fx.imageSmoothingEnabled = true;
    }
  },

  /* ============================ FUN ============================ */
  {
    id: 'fisheye', name: 'Y2K Fisheye', icon: '🛹', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      renderFisheye(fx, src, w, h);
    }
  },
  {
    id: 'thermal', name: 'Thermal', icon: '🌡️', category: 'Fun', perf: 'high',
    render(fx, { src }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const v = lumOf(d[i], d[i + 1], d[i + 2]) / 255;
          if (v < 0.25) { const t = v / 0.25; d[i] = 40 * t; d[i + 1] = 0; d[i + 2] = 8 + 130 * t; }
          else if (v < 0.5) { const t = (v - 0.25) / 0.25; d[i] = 40 + 155 * t; d[i + 1] = 25 * t; d[i + 2] = 138 - 80 * t; }
          else if (v < 0.75) { const t = (v - 0.5) / 0.25; d[i] = 195 + 60 * t; d[i + 1] = 25 + 125 * t; d[i + 2] = 58 - 38 * t; }
          else { const t = (v - 0.75) / 0.25; d[i] = 255; d[i + 1] = 150 + 105 * t; d[i + 2] = 20 + 215 * t; }
        }
      });
    }
  },
  {
    id: 'xray', name: 'X-Ray', icon: '🦴', category: 'Fun', perf: 'high',
    render(fx, { src, width: w, height: h }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const v = 255 - lumOf(d[i], d[i + 1], d[i + 2]);
          d[i] = clamp(v * 0.42, 0, 255);
          d[i + 1] = clamp(v * 0.68, 0, 255);
          d[i + 2] = clamp(v * 1.3 + 12, 0, 255);
        }
      });
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(120,190,255,0.06)');
      g.addColorStop(1, 'rgba(0,20,60,0.65)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'nightvision', name: 'Night Vision', icon: '👁️', category: 'Fun', perf: 'high',
    render(fx, { src, width: w, height: h }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          let v = lumOf(d[i], d[i + 1], d[i + 2]) * 1.4;
          v += (Math.random() * 2 - 1) * 20;
          v = clamp(v, 0, 255);
          d[i] = v * 0.22;
          d[i + 1] = v;
          d[i + 2] = v * 0.34;
        }
      });
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < h; y += 4) fx.fillRect(0, y, w, 1);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,20,0,0.75)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },
  {
    id: 'alien', name: 'Alien', icon: '👽', category: 'Fun', perf: 'high',
    render(fx, { src }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          d[i] = Math.round(clamp(255 - d[i] * 0.85, 0, 255) / 51) * 51;
          d[i + 1] = Math.round(clamp(255 - d[i + 1] * 0.5, 0, 255) / 51) * 51;
          d[i + 2] = Math.round(clamp(255 - d[i + 2] * 1.0, 0, 255) / 51) * 51;
        }
        addNoise(d, 8);
      });
    }
  },
  {
    id: 'glitch', name: 'Glitch', icon: '📺', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);
      const slices = 3 + ((Math.random() * 4) | 0);
      for (let i = 0; i < slices; i++) {
        const sy = Math.random() * h;
        const sh = 8 + Math.random() * 40;
        const dx = (Math.random() * 40 - 20) * (Math.random() < 0.5 ? 1 : -1);
        fx.drawImage(src, 0, sy, w, sh, dx, sy, w, sh);
      }
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = 0.30;
      fx.filter = 'hue-rotate(300deg) saturate(2)';
      fx.drawImage(src, 5, 0, w, h);
      fx.filter = 'hue-rotate(120deg) saturate(2)';
      fx.drawImage(src, -5, 0, w, h);
      fx.filter = 'none';
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.35) {
        fx.fillStyle = pick(['rgba(255,0,120,0.16)', 'rgba(0,255,220,0.14)', 'rgba(255,255,255,0.12)']);
        fx.fillRect(0, Math.random() * h, w, 3 + Math.random() * 14);
      }
    }
  },

  {
    id: 'vhs', name: 'VHS Tape', icon: '📼', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.drawImage(src, 0, 0, w, h);
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = 0.22;
      fx.filter = 'hue-rotate(310deg) saturate(1.8)';
      fx.drawImage(src, 3, 0, w, h);
      fx.filter = 'hue-rotate(140deg) saturate(1.8)';
      fx.drawImage(src, -3, 0, w, h);
      fx.filter = 'none';
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      const trackY = ((time / 14) % (h + 160)) - 80;
      const grad = fx.createLinearGradient(0, trackY - 40, 0, trackY + 40);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      fx.fillStyle = grad;
      fx.fillRect(0, trackY - 40, w, 80);
      fx.font = '600 16px "Courier New", monospace';
      fx.fillStyle = 'rgba(255,255,255,0.85)';
      fx.fillText('REC', 14, 26);
      if ((time % 900) < 500) {
        fx.fillStyle = 'rgba(255,60,60,0.95)';
        fx.beginPath();
        fx.arc(48, 20, 5, 0, Math.PI * 2);
        fx.fill();
      }
      fx.fillStyle = 'rgba(255,255,255,0.7)';
      fx.textAlign = 'right';
      fx.fillText('PLAY ▶', w - 12, h - 12);
      fx.textAlign = 'left';
    }
  },
  {
    id: 'disco', name: 'Disco', icon: '🪩', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.filter = `hue-rotate(${(time / 12) % 360}deg) saturate(1.5)`;
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      fx.globalCompositeOperation = 'lighter';
      const t = time / 1000;
      const cols = ['rgba(255,60,130,0.30)', 'rgba(60,130,255,0.30)', 'rgba(120,255,120,0.28)'];
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.5 + 0.42 * Math.sin(t * (0.7 + i * 0.23) + i * 2.1));
        const cy = h * (0.5 + 0.4 * Math.cos(t * (0.9 + i * 0.17) + i * 1.7));
        const g = fx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) * 0.45);
        g.addColorStop(0, cols[i]);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = g;
        fx.fillRect(0, 0, w, h);
      }
      fx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.08) {
        fx.fillStyle = 'rgba(255,255,255,0.22)';
        fx.fillRect(0, 0, w, h);
      }
    }
  },
  {
    id: 'scanlines', name: 'CRT Screen', icon: '🖥️', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);
      fx.fillStyle = 'rgba(0,0,0,0.20)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(255,255,255,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  },

  {
    id: 'snow', name: 'Snow', icon: '❄️', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) {
        this._w = w;
        this._p = Array.from({ length: 70 }, () => this._flake(w, h, true));
      }
      const t = clamp(dt, 0, 50);
      fx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const p of this._p) {
        p.y += p.vy * t;
        p.phase += p.sway * t;
        p.x += Math.sin(p.phase) * p.drift;
        if (p.y > h + 8) Object.assign(p, this._flake(w, h, false));
        fx.globalAlpha = p.a;
        fx.beginPath();
        fx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalAlpha = 1;
    },
    _flake(w, h, anyY) {
      return {
        x: Math.random() * w,
        y: anyY ? Math.random() * h : -8,
        r: 1 + Math.random() * 3,
        vy: 0.02 + Math.random() * 0.06,
        drift: 0.25 + Math.random() * 0.5,
        sway: 0.0015 + Math.random() * 0.004,
        phase: Math.random() * 6.28,
        a: 0.5 + Math.random() * 0.5
      };
    }
  },
  {
    id: 'sparkle', name: 'Sparkle', icon: '✨', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt, motion }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p) this._p = [];
      const t = clamp(dt, 0, 50);
      const spawn = 3 + ((Math.random() * 2) | 0) + (motion && motion.level > 0.06 ? 4 : 0);
      for (let i = 0; i < spawn; i++) {
        let x = Math.random() * w;
        let y = Math.random() * h;
        if (motion && motion.level > 0.06 && Math.random() < 0.65) {
          x = motion.cx * w + rand(-60, 60);
          y = motion.cy * h + rand(-60, 60);
        }
        this._p.push({ x, y, life: rand(350, 800), age: 0, r: rand(3, 9) });
      }
      fx.globalCompositeOperation = 'lighter';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += t;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        const s = p.r * k * (0.6 + 0.4 * Math.sin(p.age / 90));
        fx.strokeStyle = `rgba(255,255,210,${0.9 * k})`;
        fx.lineWidth = 1.6;
        fx.beginPath();
        fx.moveTo(p.x - s, p.y); fx.lineTo(p.x + s, p.y);
        fx.moveTo(p.x, p.y - s); fx.lineTo(p.x, p.y + s);
        fx.stroke();
      }
      fx.globalCompositeOperation = 'source-over';
      if (this._p.length > 400) this._p.splice(0, this._p.length - 400);
    }
  },
  {
    id: 'emojirain', name: 'Emoji Rain', icon: '😍', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) {
        this._w = w;
        this._p = [];
      }
      const t = clamp(dt, 0, 50);
      if (Math.random() < 0.35 && this._p.length < 40) {
        this._p.push({ x: Math.random() * w, y: -30, vy: rand(0.06, 0.16), vx: rand(-0.02, 0.02), rot: rand(-0.002, 0.002), a: 0, emoji: pick(['😍', '😎', '🤩', '😂', '🥳', '😜', '🤠', '👻', '🐶', '🦄', '⭐', '🍕', '🎈', '💜']) });
      }
      fx.textAlign = 'center';
      fx.textBaseline = 'middle';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.y += p.vy * t;
        p.x += p.vx * t;
        p.rot += 0.0;
        if (p.y > h + 40) { this._p.splice(i, 1); continue; }
        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(Math.sin(p.y / 80) * 0.3);
        fx.font = '28px serif';
        fx.fillText(p.emoji, 0, 0);
        fx.restore();
      }
      fx.textAlign = 'left';
      fx.textBaseline = 'alphabetic';
    }
  },
  {
    id: 'hearts', name: 'Hearts', icon: '💗', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) { this._w = w; this._p = []; }
      const t = clamp(dt, 0, 50);
      if (Math.random() < 0.3 && this._p.length < 26) {
        this._p.push({ x: Math.random() * w, y: h + 30, vy: -rand(0.05, 0.13), sway: rand(0.001, 0.004), phase: Math.random() * 6.28, s: rand(14, 34), hue: rand(320, 360) });
      }
      fx.textAlign = 'center';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.y += p.vy * t;
        p.phase += p.sway * t;
        if (p.y < -40) { this._p.splice(i, 1); continue; }
        fx.globalAlpha = 0.85;
        fx.font = `${p.s}px serif`;
        fx.fillStyle = `hsl(${p.hue} 90% 62%)`;
        fx.fillText('❤️', p.x + Math.sin(p.phase) * 22, p.y);
      }
      fx.globalAlpha = 1;
      fx.textAlign = 'left';
    }
  },
  {
    id: 'ripple', name: 'Ripple', icon: '💧', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.drawImage(src, 0, 0, w, h);
      const slices = 42;
      const sh = h / slices;
      for (let i = 0; i < slices; i++) {
        const sy = i * sh;
        const off = Math.sin(i * 0.5 + time / 260) * (5 + 4 * Math.sin(time / 900));
        fx.drawImage(src, 0, sy, w, sh + 0.6, off, sy, w, sh + 0.6);
      }
    }
  },

  {
    id: 'kaleidoscope', name: 'Kaleidoscope', icon: '🔮', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h);
      const slices = 8;
      const step = (Math.PI * 2) / slices;
      const rot = (time / 6000) % step;
      const zoom = 1.15;
      fx.save();
      fx.beginPath();
      fx.rect(0, 0, w, h);
      fx.clip();
      fx.translate(cx, cy);
      fx.rotate(rot);
      for (let i = 0; i < slices; i++) {
        fx.save();
        fx.rotate(i * step);
        if (i % 2) fx.scale(-1, 1);
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.arc(0, 0, R, -step / 2, step / 2);
        fx.closePath();
        fx.clip();
        fx.drawImage(src, (-w / 2) * zoom, (-h / 2) * zoom, w * zoom, h * zoom);
        fx.restore();
      }
      fx.restore();
    }
  },

  /* ============================ MIRROR ============================ */
  {
    id: 'mirrorLeft', name: 'Mirror Left', icon: '🪞', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.scale(-1, 1);
      fx.drawImage(src, hw, 0, hw, h, -hw, 0, hw, h);
      fx.restore();
    }
  },
  {
    id: 'mirrorRight', name: 'Mirror Right', icon: '↔️', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.drawImage(src, 0, 0, hw, h, 0, 0, hw, h);
      fx.restore();
    }
  },
  {
    id: 'mirrorTop', name: 'Mirror Top', icon: '⬆️', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hh = h / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.scale(1, -1);
      fx.drawImage(src, 0, hh, w, hh, 0, -hh, w, hh);
      fx.restore();
    }
  },
  {
    id: 'mirrorBottom', name: 'Mirror Bottom', icon: '⬇️', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hh = h / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.translate(0, h);
      fx.scale(1, -1);
      fx.drawImage(src, 0, 0, w, hh, 0, 0, w, hh);
      fx.restore();
    }
  },
  {
    id: 'mirrorQuad', name: 'Mirror Quad', icon: '🔲', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      const hh = h / 2;
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
      fx.save();
      fx.translate(0, h);
      fx.scale(1, -1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
      fx.save();
      fx.translate(w, h);
      fx.scale(-1, -1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
    }
  },
  {
    id: 'split', name: 'Split Screen', icon: '📐', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      fx.drawImage(src, 0, 0, hw, h, 0, 0, hw, h);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.drawImage(src, 0, 0, hw, h, 0, 0, hw, h);
      fx.restore();
    }
  },
  {
    id: 'flip', name: 'Upside-Down', icon: '🙃', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.translate(0, h);
      fx.scale(1, -1);
      fx.drawImage(src, 0, 0, w, h, 0, 0, w, h);
      fx.restore();
    }
  },
  {
    id: 'quadcam', name: 'Quad Cam', icon: '🎛️', category: 'Mirror', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      const hh = h / 2;
      fx.fillStyle = '#000';
      fx.fillRect(0, 0, w, h);
      fx.drawImage(src, 0, 0, hw, hh);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.filter = 'saturate(1.6) contrast(1.15)';
      fx.drawImage(src, 0, 0, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.save();
      fx.filter = 'sepia(0.8) contrast(1.2)';
      fx.drawImage(src, 0, hh, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.save();
      fx.filter = 'invert(1)';
      fx.drawImage(src, hw, hh, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.strokeStyle = 'rgba(255,255,255,0.7)';
      fx.lineWidth = 2;
      fx.beginPath();
      fx.moveTo(hw, 0); fx.lineTo(hw, h);
      fx.moveTo(0, hh); fx.lineTo(w, hh);
      fx.stroke();
    }
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk Neon', icon: '🌆', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.35) saturate(1.8) hue-rotate(-20deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.45;
      const shift = 4 + Math.sin(t * 3) * 2;
      fx.fillStyle = '#06b6d4';
      fx.fillRect(0, 0, w, h);
      fx.globalCompositeOperation = 'overlay';
      fx.drawImage(src, -shift, 0, w, h);
      fx.fillStyle = '#f43f5e';
      fx.fillRect(0, 0, w, h);
      fx.drawImage(src, shift, 0, w, h);

      fx.globalAlpha = 0.18;
      fx.fillStyle = '#000000';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1.5);
      }
      fx.restore();
    }
  },
  {
    id: 'matrix', name: 'Matrix Rain', icon: '💻', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.4) brightness(0.7) hue-rotate(90deg) saturate(2)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      fx.save();
      fx.font = 'bold 15px monospace';
      const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
      const cols = Math.floor(w / 18);

      for (let c = 0; c < cols; c++) {
        const speed = 120 + ((c * 17) % 80);
        const yHead = ((t * speed + c * 47) % (h + 100)) - 50;
        const x = c * 18 + 4;
        for (let row = 0; row < 10; row++) {
          const y = yHead - row * 16;
          if (y > 0 && y < h) {
            const charIdx = (c * 7 + row + Math.floor(t * 5)) % chars.length;
            const alpha = row === 0 ? 0.95 : (1 - row / 10) * 0.7;
            fx.fillStyle = row === 0 ? '#ffffff' : `rgba(34, 197, 94, ${alpha})`;
            fx.fillText(chars[charIdx], x, y);
          }
        }
      }
      fx.restore();
    }
  },
  {
    id: 'goldenhour', name: 'Golden Hour', icon: '🌅', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.filter = 'sepia(0.35) saturate(1.45) contrast(1.1) brightness(1.06)';
      fx.drawImage(src, 0, 0, w, h);

      const flare = fx.createRadialGradient(w * 0.15, h * 0.15, 20, w * 0.25, h * 0.25, w * 0.75);
      flare.addColorStop(0, 'rgba(255, 223, 128, 0.55)');
      flare.addColorStop(0.3, 'rgba(251, 146, 60, 0.28)');
      flare.addColorStop(0.7, 'rgba(236, 72, 153, 0.12)');
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');

      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = flare;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },
  {
    id: 'vaporwave', name: 'Vaporwave 90s', icon: '🌴', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.filter = 'saturate(1.7) contrast(1.18)';
      fx.drawImage(src, 0, 0, w, h);

      const grad = fx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.35)');
      grad.addColorStop(0.5, 'rgba(244, 114, 182, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.3)');

      fx.globalCompositeOperation = 'color';
      fx.fillStyle = grad;
      fx.fillRect(0, 0, w, h);

      fx.globalCompositeOperation = 'overlay';
      fx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 2);
      }
      fx.restore();
    }
  },
  {
    id: 'anime', name: 'Anime Sparkles', icon: '✨', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'saturate(1.35) brightness(1.08) contrast(1.05)';
      fx.drawImage(src, 0, 0, w, h);

      const starCount = 14;
      for (let i = 0; i < starCount; i++) {
        const seed = i * 137.5;
        const speed = 0.6 + (i % 4) * 0.25;
        const x = ((seed * 7 + t * 40 * speed) % (w + 60)) - 30;
        const y = ((seed * 11 + Math.sin(t * 1.5 + i) * 60) % (h + 60)) - 30;
        const size = 6 + (Math.sin(t * 4 + i) + 1) * 6;
        const rot = t * 2 + i;

        fx.save();
        fx.translate(x, y);
        fx.rotate(rot);
        fx.fillStyle = i % 2 === 0 ? '#fbcfe8' : '#ffffff';
        fx.shadowColor = '#ec4899';
        fx.shadowBlur = 8;

        fx.beginPath();
        fx.moveTo(0, -size);
        fx.quadraticCurveTo(0, 0, size, 0);
        fx.quadraticCurveTo(0, 0, 0, size);
        fx.quadraticCurveTo(0, 0, -size, 0);
        fx.quadraticCurveTo(0, 0, 0, -size);
        fx.fill();
        fx.restore();
      }
      fx.restore();
    }
  },
  {
    id: 'disco', name: 'Disco Lasers', icon: '🪩', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      fx.save();
      fx.globalCompositeOperation = 'screen';
      const colors = ['#f43f5e', '#06b6d4', '#eab308', '#a855f7'];
      for (let i = 0; i < 4; i++) {
        const angle = t * (0.8 + i * 0.2) + (i * Math.PI) / 2;
        const lx = w / 2 + Math.cos(angle) * (w * 0.55);
        const ly = h / 2 + Math.sin(angle) * (h * 0.55);

        const beam = fx.createRadialGradient(lx, ly, 10, w / 2, h / 2, w * 0.7);
        beam.addColorStop(0, colors[i % colors.length]);
        beam.addColorStop(0.5, 'rgba(0,0,0,0)');

        fx.globalAlpha = 0.5;
        fx.fillStyle = beam;
        fx.fillRect(0, 0, w, h);
      }
      fx.restore();
    }
  },
  {
    id: 'arcade8bit', name: '8-Bit Arcade', icon: '👾', category: 'Classic', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const pixelSize = 7;
      const smallW = Math.max(2, Math.floor(w / pixelSize));
      const smallH = Math.max(2, Math.floor(h / pixelSize));

      fx.save();
      fx.imageSmoothingEnabled = false;
      fx.drawImage(src, 0, 0, smallW, smallH);
      fx.filter = 'contrast(1.3) saturate(1.4)';
      fx.drawImage(fx.canvas, 0, 0, smallW, smallH, 0, 0, w, h);
      fx.restore();
    }
  },
  {
    id: 'prism', name: 'Prism Flare', icon: '💎', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.55;

      const sweepX = (Math.sin(t * 0.8) * 0.3 + 0.5) * w;
      const rainbow = fx.createLinearGradient(sweepX - 120, 0, sweepX + 120, h);
      rainbow.addColorStop(0, 'rgba(239, 68, 68, 0)');
      rainbow.addColorStop(0.15, 'rgba(239, 68, 68, 0.45)');
      rainbow.addColorStop(0.35, 'rgba(245, 158, 11, 0.45)');
      rainbow.addColorStop(0.5, 'rgba(16, 185, 129, 0.45)');
      rainbow.addColorStop(0.7, 'rgba(59, 130, 246, 0.45)');
      rainbow.addColorStop(0.85, 'rgba(168, 85, 247, 0.45)');
      rainbow.addColorStop(1, 'rgba(168, 85, 247, 0)');

      fx.fillStyle = rainbow;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  }
];

/** Register all Canvas 2D effects into an EffectManager instance. */
export function register2DFilters(manager) {
  manager.registerAll(defs2d);
}





