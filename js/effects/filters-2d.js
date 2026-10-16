/* WebcamClicks — Canvas 2D effect library (part 1 of 4).
   Every effect object: { id, name, icon, category, perf, render(fx, frame) }
   `frame` = { src, width, height, time, dt, face, motion, camera } */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../utils.js';

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

/** Read src pixels into `fn(data,w,h)`, then blit the result onto fx.
 *  Uses adaptive downsampled pixel buffer on mobile/high-res displays for 60 FPS. */
function pixelPass(fx, src, fn) {
  const w = fx.canvas.width;
  const h = fx.canvas.height;

  const maxDim = isMobile() ? 480 : 720;
  if (w > maxDim || h > maxDim) {
    const scale = maxDim / Math.max(w, h);
    const sw = Math.max(160, Math.round((w * scale) / 2) * 2);
    const sh = Math.max(120, Math.round((h * scale) / 2) * 2);
    const sc = ensureScratch(sw, sh);
    sc.gx.drawImage(src, 0, 0, sw, sh);
    const img = sc.gx.getImageData(0, 0, sw, sh);
    fn(img.data, sw, sh);
    sc.gx.putImageData(img, 0, 0);
    fx.drawImage(sc, 0, 0, sw, sh, 0, 0, w, h);
    return;
  }

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

/* ---------- Y2K Beauty Fisheye (Optical spherical barrel + dewy porcelain beauty filter) ---------- */
let FISHEYE_BEAUTY_SRC = null;
let FISHEYE_WARP_CANVAS = null;
let FISHEYE_WARP_CTX = null;
let FISHEYE_LUT = null;
let FISHEYE_LAST_BW = 0;
let FISHEYE_LAST_BH = 0;

function getFisheyeBuffers(bw, bh) {
  if (!FISHEYE_BEAUTY_SRC) {
    FISHEYE_BEAUTY_SRC = makeCanvas(bw, bh);
  } else if (FISHEYE_BEAUTY_SRC.width !== bw || FISHEYE_BEAUTY_SRC.height !== bh) {
    FISHEYE_BEAUTY_SRC.width = bw;
    FISHEYE_BEAUTY_SRC.height = bh;
  }

  if (!FISHEYE_WARP_CANVAS) {
    FISHEYE_WARP_CANVAS = makeCanvas(bw, bh);
    FISHEYE_WARP_CTX = FISHEYE_WARP_CANVAS.getContext('2d');
  } else if (FISHEYE_WARP_CANVAS.width !== bw || FISHEYE_WARP_CANVAS.height !== bh) {
    FISHEYE_WARP_CANVAS.width = bw;
    FISHEYE_WARP_CANVAS.height = bh;
    FISHEYE_WARP_CTX = FISHEYE_WARP_CANVAS.getContext('2d');
  }

  if (FISHEYE_LAST_BW !== bw || FISHEYE_LAST_BH !== bh || !FISHEYE_LUT) {
    FISHEYE_LAST_BW = bw;
    FISHEYE_LAST_BH = bh;
    const total = bw * bh;
    FISHEYE_LUT = new Int32Array(total);
    const cx = bw / 2;
    const cy = bh / 2;
    const maxR = Math.min(bw, bh) * 0.505;

    for (let y = 0; y < bh; y++) {
      const dy = y - cy;
      for (let x = 0; x < bw; x++) {
        const dx = x - cx;
        const r = Math.hypot(dx, dy);
        const idx = y * bw + x;
        const rNorm = r / maxR;

        if (rNorm <= 1.08) {
          const factor = 0.65 + 0.35 * Math.pow(rNorm, 2.2);
          const sx = Math.round(cx + dx * factor);
          const sy = Math.round(cy + dy * factor);
          if (sx >= 0 && sx < bw && sy >= 0 && sy < bh) {
            FISHEYE_LUT[idx] = sy * bw + sx;
          } else {
            FISHEYE_LUT[idx] = -1;
          }
        } else {
          FISHEYE_LUT[idx] = -2;
        }
      }
    }
  }

  return {
    srcCanvas: FISHEYE_BEAUTY_SRC,
    warpCanvas: FISHEYE_WARP_CANVAS,
    warpCtx: FISHEYE_WARP_CTX,
    lut: FISHEYE_LUT
  };
}

function renderFisheye(fx, src, w, h) {
  const aspect = Math.max(0.1, w / h);
  const bw = Math.min(480, w);
  const bh = Math.max(1, Math.round(bw / aspect));

  const { srcCanvas, warpCanvas, warpCtx, lut } = getFisheyeBuffers(bw, bh);
  const bctx = srcCanvas.getContext('2d');

  // Step 1: Beauty skin grading & dewy tone pre-pass
  bctx.setTransform(1, 0, 0, 1, 0, 0);
  bctx.clearRect(0, 0, bw, bh);
  bctx.filter = 'brightness(1.09) contrast(1.03) saturate(1.18) sepia(0.06)';
  bctx.drawImage(src, 0, 0, bw, bh);
  bctx.filter = 'none';

  // Step 2: Porcelain skin smoothing diffusion
  bctx.save();
  bctx.filter = 'blur(4px) brightness(1.14)';
  bctx.globalAlpha = 0.22;
  bctx.globalCompositeOperation = 'screen';
  bctx.drawImage(src, 0, 0, bw, bh);
  bctx.restore();

  // Step 3: Subtle peach blush glow
  const cx = bw / 2;
  const cy = bh / 2;
  const blush = bctx.createRadialGradient(cx, cy, 0, cx, cy, Math.min(bw, bh) * 0.42);
  blush.addColorStop(0, 'rgba(251, 113, 133, 0.09)');
  blush.addColorStop(0.6, 'rgba(244, 114, 182, 0.04)');
  blush.addColorStop(1, 'rgba(244, 114, 182, 0)');
  bctx.fillStyle = blush;
  bctx.fillRect(0, 0, bw, bh);

  // Step 4: True Optical Spherical Barrel Distortion
  const srcImgData = bctx.getImageData(0, 0, bw, bh);
  const warpImgData = warpCtx.createImageData(bw, bh);
  const src32 = new Uint32Array(srcImgData.data.buffer);
  const warp32 = new Uint32Array(warpImgData.data.buffer);
  const total = bw * bh;

  for (let i = 0; i < total; i++) {
    const sIdx = lut[i];
    if (sIdx >= 0) {
      warp32[i] = src32[sIdx];
    } else {
      warp32[i] = 0xFF080608;
    }
  }

  warpCtx.putImageData(warpImgData, 0, 0);

  // Step 5: GPU-smoothed composite to display context
  fx.save();
  fx.setTransform(1, 0, 0, 1, 0, 0);
  fx.imageSmoothingEnabled = true;
  fx.imageSmoothingQuality = 'high';
  fx.drawImage(warpCanvas, 0, 0, bw, bh, 0, 0, w, h);

  // Step 6: Optical vignette & physical lens housing
  const fcx = w / 2;
  const fcy = h / 2;
  const maxFR = Math.min(w, h) * 0.505;

  const vig = fx.createRadialGradient(fcx, fcy, maxFR * 0.68, fcx, fcy, maxFR * 1.04);
  vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
  vig.addColorStop(0.75, 'rgba(6, 4, 10, 0.45)');
  vig.addColorStop(0.94, 'rgba(4, 2, 8, 0.88)');
  vig.addColorStop(1, 'rgba(4, 2, 8, 1)');
  fx.fillStyle = vig;
  fx.fillRect(0, 0, w, h);

  fx.beginPath();
  fx.rect(0, 0, w, h);
  fx.arc(fcx, fcy, maxFR * 1.01, 0, Math.PI * 2, true);
  fx.fillStyle = '#060408';
  fx.fill();

  // Multi-coated glass reflection arcs
  fx.beginPath();
  fx.arc(fcx, fcy, maxFR * 0.98, Math.PI * 1.05, Math.PI * 1.45);
  fx.strokeStyle = 'rgba(236, 72, 153, 0.18)';
  fx.lineWidth = Math.max(2, Math.round(w * 0.004));
  fx.stroke();

  fx.beginPath();
  fx.arc(fcx, fcy, maxFR * 0.96, Math.PI * 1.10, Math.PI * 1.40);
  fx.strokeStyle = 'rgba(56, 189, 248, 0.14)';
  fx.lineWidth = Math.max(1, Math.round(w * 0.002));
  fx.stroke();

  fx.restore();
}

/* ---------- Military FLIR thermal 256-color LUT & render pass ---------- */
const FLIR_LUT_R = new Uint8Array(256);
const FLIR_LUT_G = new Uint8Array(256);
const FLIR_LUT_B = new Uint8Array(256);
(function initFlirLut() {
  for (let i = 0; i < 256; i++) {
    const v = i / 255;
    if (v < 0.2) {
      const k = v / 0.2;
      FLIR_LUT_R[i] = Math.round(10 + k * 18);
      FLIR_LUT_G[i] = Math.round(8 + k * 70);
      FLIR_LUT_B[i] = Math.round(26 + k * 190);
    } else if (v < 0.42) {
      const k = (v - 0.2) / 0.22;
      FLIR_LUT_R[i] = Math.round(28 + k * 10);
      FLIR_LUT_G[i] = Math.round(78 + k * 150);
      FLIR_LUT_B[i] = Math.round(216 + k * 14);
    } else if (v < 0.65) {
      const k = (v - 0.42) / 0.23;
      FLIR_LUT_R[i] = Math.round(38 + k * 212);
      FLIR_LUT_G[i] = Math.round(228 + k * 20);
      FLIR_LUT_B[i] = Math.round(230 - k * 210);
    } else if (v < 0.88) {
      const k = (v - 0.65) / 0.23;
      FLIR_LUT_R[i] = Math.round(250 + k * 5);
      FLIR_LUT_G[i] = Math.round(248 - k * 180);
      FLIR_LUT_B[i] = Math.round(20 - k * 15);
    } else {
      const k = (v - 0.88) / 0.12;
      FLIR_LUT_R[i] = 255;
      FLIR_LUT_G[i] = Math.round(68 + k * 187);
      FLIR_LUT_B[i] = Math.round(5 + k * 250);
    }
  }
})();

let FLIR_SCRATCH = null;
let FLIR_CTX = null;
function renderFlirThermal(fx, src, w, h) {
  const sw = Math.min(360, Math.max(120, Math.floor(w / 2)));
  const sh = Math.min(270, Math.max(90, Math.floor(h / 2)));
  if (!FLIR_SCRATCH || FLIR_SCRATCH.width !== sw || FLIR_SCRATCH.height !== sh) {
    FLIR_SCRATCH = makeCanvas(sw, sh);
    FLIR_CTX = FLIR_SCRATCH.getContext('2d', { willReadFrequently: true });
  }
  FLIR_CTX.drawImage(src, 0, 0, sw, sh);
  const imgData = FLIR_CTX.getImageData(0, 0, sw, sh);
  const d = imgData.data;
  for (let i = 0; i < d.length; i += 4) {
    const lum = (d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8;
    d[i] = FLIR_LUT_R[lum];
    d[i + 1] = FLIR_LUT_G[lum];
    d[i + 2] = FLIR_LUT_B[lum];
  }
  FLIR_CTX.putImageData(imgData, 0, 0);
  fx.drawImage(FLIR_SCRATCH, 0, 0, sw, sh, 0, 0, w, h);
}

/* ---------- Fast Sobel Neon Edge Buffer ---------- */
let SOBEL_CANVAS = null;
let SOBEL_CTX = null;
let SOBEL_OUT_CANVAS = null;
let SOBEL_OUT_CTX = null;
function renderNeonEdgePass(fx, src, w, h, t) {
  const sw = Math.min(320, Math.max(120, Math.floor(w / 3)));
  const sh = Math.min(240, Math.max(90, Math.floor(h / 3)));
  if (!SOBEL_CANVAS || SOBEL_CANVAS.width !== sw || SOBEL_CANVAS.height !== sh) {
    SOBEL_CANVAS = makeCanvas(sw, sh);
    SOBEL_CTX = SOBEL_CANVAS.getContext('2d', { willReadFrequently: true });
    SOBEL_OUT_CANVAS = makeCanvas(sw, sh);
    SOBEL_OUT_CTX = SOBEL_OUT_CANVAS.getContext('2d');
  }
  SOBEL_CTX.drawImage(src, 0, 0, sw, sh);
  const imgData = SOBEL_CTX.getImageData(0, 0, sw, sh);
  const srcD = imgData.data;
  const outImg = SOBEL_OUT_CTX.createImageData(sw, sh);
  const outD = outImg.data;
  const lumBuf = new Uint8Array(sw * sh);
  for (let i = 0, j = 0; i < srcD.length; i += 4, j++) {
    lumBuf[j] = (srcD[i] * 77 + srcD[i + 1] * 150 + srcD[i + 2] * 29) >> 8;
  }
  const hueBase = (t * 0.05) % 360;
  for (let y = 1; y < sh - 1; y++) {
    const row = y * sw;
    for (let x = 1; x < sw - 1; x++) {
      const idx = row + x;
      const gx = (-lumBuf[idx - sw - 1] + lumBuf[idx - sw + 1]) +
                 (-2 * lumBuf[idx - 1] + 2 * lumBuf[idx + 1]) +
                 (-lumBuf[idx + sw - 1] + lumBuf[idx + sw + 1]);
      const gy = (-lumBuf[idx - sw - 1] - 2 * lumBuf[idx - sw] - lumBuf[idx - sw + 1]) +
                 (lumBuf[idx + sw - 1] + 2 * lumBuf[idx + sw] + lumBuf[idx + sw + 1]);
      const mag = Math.min(255, (Math.abs(gx) + Math.abs(gy)) >> 1);
      if (mag > 26) {
        const oIdx = idx * 4;
        const norm = (mag - 26) / 229;
        const hVal = (hueBase + x * 0.45 + y * 0.45) % 360;
        const rad = (hVal * Math.PI) / 180;
        outD[oIdx] = Math.round(clamp(Math.sin(rad) * 127 + 128, 0, 255) * norm);
        outD[oIdx + 1] = Math.round(clamp(Math.sin(rad + 2.09) * 127 + 128, 0, 255) * norm);
        outD[oIdx + 2] = Math.round(clamp(Math.sin(rad + 4.18) * 127 + 128, 0, 255) * norm);
        outD[oIdx + 3] = Math.round(norm * 255);
      }
    }
  }
  SOBEL_OUT_CTX.putImageData(outImg, 0, 0);

  fx.save();
  fx.fillStyle = '#06040d';
  fx.fillRect(0, 0, w, h);

  fx.strokeStyle = 'rgba(6, 182, 212, 0.12)';
  fx.lineWidth = 1;
  const gridStep = Math.max(22, Math.round(w / 16));
  for (let x = 0; x < w; x += gridStep) {
    fx.beginPath(); fx.moveTo(x, 0); fx.lineTo(x, h); fx.stroke();
  }
  for (let y = 0; y < h; y += gridStep) {
    fx.beginPath(); fx.moveTo(0, y); fx.lineTo(w, y); fx.stroke();
  }

  fx.globalCompositeOperation = 'screen';
  fx.filter = 'blur(5px)';
  fx.drawImage(SOBEL_OUT_CANVAS, 0, 0, sw, sh, 0, 0, w, h);
  fx.filter = 'none';
  fx.drawImage(SOBEL_OUT_CANVAS, 0, 0, sw, sh, 0, 0, w, h);
  fx.restore();
}

/* ---------- Shimmering Water Caustics Helper ---------- */
function drawCausticRays(fx, w, h, t) {
  fx.save();
  fx.globalCompositeOperation = 'screen';
  const step = Math.max(16, Math.round(w / 18));
  for (let x = 0; x < w; x += step) {
    const off = Math.sin(x * 0.03 + t * 0.002) * 24 + Math.cos(x * 0.015 - t * 0.003) * 18;
    const g = fx.createLinearGradient(x + off, 0, x - off * 1.5, h);
    g.addColorStop(0, 'rgba(125, 211, 252, 0.22)');
    g.addColorStop(0.5, 'rgba(45, 212, 191, 0.12)');
    g.addColorStop(1, 'rgba(14, 116, 144, 0.02)');
    fx.fillStyle = g;
    fx.beginPath();
    fx.moveTo(x + off - 6, 0);
    fx.lineTo(x + off + 6, 0);
    fx.lineTo(x - off * 1.5 + 24, h);
    fx.lineTo(x - off * 1.5 - 24, h);
    fx.fill();
  }
  fx.restore();
}

/* ---------- Liquid Rainbow thin-film interference pass ---------- */
let IRID_SCRATCH = null;
let IRID_CTX = null;
function renderLiquidRainbowPass(fx, src, w, h, t) {
  const sw = Math.min(320, Math.max(120, Math.floor(w / 2.5)));
  const sh = Math.min(240, Math.max(90, Math.floor(h / 2.5)));
  if (!IRID_SCRATCH || IRID_SCRATCH.width !== sw || IRID_SCRATCH.height !== sh) {
    IRID_SCRATCH = makeCanvas(sw, sh);
    IRID_CTX = IRID_SCRATCH.getContext('2d', { willReadFrequently: true });
  }
  IRID_CTX.drawImage(src, 0, 0, sw, sh);
  const imgData = IRID_CTX.getImageData(0, 0, sw, sh);
  const d = imgData.data;
  const timePhase = t * 0.0018;
  for (let y = 0; y < sh; y++) {
    const row = y * sw;
    for (let x = 0; x < sw; x++) {
      const idx = (row + x) * 4;
      const lum = (d[idx] * 77 + d[idx + 1] * 150 + d[idx + 2] * 29) >> 8;
      const wave = Math.sin(x * 0.035 + timePhase) + Math.cos(y * 0.035 - timePhase * 1.2);
      const phase = (lum * 0.026 + wave * 0.75 + timePhase) * Math.PI * 2;
      const rP = Math.sin(phase) * 127 + 128;
      const gP = Math.sin(phase + 2.09) * 127 + 128;
      const bP = Math.sin(phase + 4.18) * 127 + 128;
      d[idx] = (d[idx] * 0.38 + rP * 0.62) | 0;
      d[idx + 1] = (d[idx + 1] * 0.38 + gP * 0.62) | 0;
      d[idx + 2] = (d[idx + 2] * 0.38 + bP * 0.62) | 0;
    }
  }
  IRID_CTX.putImageData(imgData, 0, 0);

  fx.save();
  fx.filter = 'contrast(1.16) saturate(1.28)';
  fx.drawImage(src, 0, 0, w, h);
  fx.globalCompositeOperation = 'screen';
  fx.globalAlpha = 0.65;
  fx.drawImage(IRID_SCRATCH, 0, 0, sw, sh, 0, 0, w, h);
  fx.globalCompositeOperation = 'overlay';
  fx.globalAlpha = 0.36;
  fx.drawImage(IRID_SCRATCH, 0, 0, sw, sh, 0, 0, w, h);
  fx.restore();
}

/* ---------- Live Head Tracking Pose Extraction ---------- */
function getHeadPose(frame) {
  const face = frame && frame.face;
  const pts = face && face.points;
  const box = face && face.box;
  const w = (frame && frame.width) || 640;
  const h = (frame && frame.height) || 480;
  const t = (frame && (frame.time || frame.now)) || 0;

  if (!pts || !box || box.width < 12) {
    return {
      hasFace: false,
      cx: w * 0.5 + Math.sin(t * 0.001) * (w * 0.02),
      cy: h * 0.46 + Math.cos(t * 0.0012) * (h * 0.02),
      w: Math.min(w, h) * 0.38,
      h: Math.min(w, h) * 0.46,
      angle: 0,
      yaw: 0,
      eyeDist: Math.min(w, h) * 0.18,
      lEye: { x: w * 0.43, y: h * 0.44 },
      rEye: { x: w * 0.57, y: h * 0.44 },
      midEye: { x: w * 0.5, y: h * 0.44 },
      forehead: { x: w * 0.5, y: h * 0.32 },
      chin: { x: w * 0.5, y: h * 0.62 },
      box: { x: w * 0.31, y: h * 0.23, width: w * 0.38, height: h * 0.46 }
    };
  }

  let lx = 0, ly = 0;
  for (let i = 36; i <= 41; i++) {
    const p = pts[i] || pts[0];
    lx += p.x; ly += p.y;
  }
  const lEye = { x: lx / 6, y: ly / 6 };

  let rx = 0, ry = 0;
  for (let i = 42; i <= 47; i++) {
    const p = pts[i] || pts[16];
    rx += p.x; ry += p.y;
  }
  const rEye = { x: rx / 6, y: ry / 6 };

  const dx = rEye.x - lEye.x;
  const dy = rEye.y - lEye.y;
  const angle = Math.atan2(dy, dx);
  const eyeDist = Math.max(10, Math.hypot(dx, dy));

  const nose = pts[30] || { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 + eyeDist * 0.4 };
  const chin = pts[8] || { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 + eyeDist * 1.4 };
  const forehead = pts[27] || { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 - eyeDist * 0.6 };

  const headW = Math.max(eyeDist * 1.8, box.width);
  const headH = Math.max(eyeDist * 2.2, box.height);
  const cx = box.x + box.width * 0.5;
  const cy = box.y + box.height * 0.5;

  const midEyeX = (lEye.x + rEye.x) / 2;
  const midEyeY = (lEye.y + rEye.y) / 2;
  const yaw = clamp((nose.x - midEyeX) / (headW * 0.22), -1, 1);

  return {
    hasFace: true,
    cx,
    cy,
    w: headW,
    h: headH,
    angle,
    yaw,
    eyeDist,
    lEye,
    rEye,
    midEye: { x: midEyeX, y: midEyeY },
    nose,
    chin,
    forehead,
    box
  };
}

function smoothPose(effect, p, dt = 16.7, smoothMs = 35) {
  if (!effect._sp) {
    effect._sp = Object.assign({}, p);
    return effect._sp;
  }
  const sp = effect._sp;
  const alpha = 1 - Math.exp(-clamp(dt, 1, 100) / smoothMs);
  sp.cx = lerp(sp.cx, p.cx, alpha);
  sp.cy = lerp(sp.cy, p.cy, alpha);
  sp.w = lerp(sp.w, p.w, alpha);
  sp.h = lerp(sp.h, p.h, alpha);
  sp.angle = lerp(sp.angle, p.angle, alpha);
  sp.yaw = lerp(sp.yaw, p.yaw, alpha);
  sp.eyeDist = lerp(sp.eyeDist, p.eyeDist, alpha);
  if (p.lEye && sp.lEye) {
    sp.lEye.x = lerp(sp.lEye.x, p.lEye.x, alpha);
    sp.lEye.y = lerp(sp.lEye.y, p.lEye.y, alpha);
  } else sp.lEye = p.lEye;
  if (p.rEye && sp.rEye) {
    sp.rEye.x = lerp(sp.rEye.x, p.rEye.x, alpha);
    sp.rEye.y = lerp(sp.rEye.y, p.rEye.y, alpha);
  } else sp.rEye = p.rEye;
  if (p.midEye && sp.midEye) {
    sp.midEye.x = lerp(sp.midEye.x, p.midEye.x, alpha);
    sp.midEye.y = lerp(sp.midEye.y, p.midEye.y, alpha);
  } else sp.midEye = p.midEye;
  sp.hasFace = p.hasFace;
  return sp;
}

export const defs2d = [
  /* ============================ SCI-FI & CYBER ============================ */
  {
    id: 'cyberpunk_hud', name: 'Cyberpunk HUD 2077', icon: '🤖', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 28);

      fx.save();
      fx.filter = 'contrast(1.22) saturate(1.4) hue-rotate(-15deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Cyber duotone rim lighting
      fx.globalCompositeOperation = 'screen';
      const edgeGrad = fx.createLinearGradient(0, 0, w, h);
      edgeGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      edgeGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      edgeGrad.addColorStop(1, 'rgba(255, 0, 128, 0.22)');
      fx.fillStyle = edgeGrad;
      fx.fillRect(0, 0, w, h);

      // Hexagonal AR grid in top corner
      fx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      fx.lineWidth = 1;
      const hexS = Math.max(14, Math.round(w * 0.03));
      const hexCols = 5, hexRows = 4;
      for (let r = 0; r < hexRows; r++) {
        for (let c = 0; c < hexCols; c++) {
          const hx = w - hexCols * hexS * 1.8 + c * hexS * 1.732 + (r % 2 ? hexS * 0.866 : 0);
          const hy = 24 + r * hexS * 1.5;
          fx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (a * Math.PI) / 3;
            const px = hx + hexS * 0.5 * Math.cos(ang);
            const py = hy + hexS * 0.5 * Math.sin(ang);
            if (a === 0) fx.moveTo(px, py); else fx.lineTo(px, py);
          }
          fx.closePath();
          fx.stroke();
        }
      }

      // Live Head-Tracked Reticle & Lock-On System
      const tx = pose.cx;
      const ty = pose.cy;
      const tr = Math.max(pose.w, pose.h) * 0.58;

      fx.save();
      fx.translate(tx, ty);
      fx.rotate(pose.angle);
      fx.translate(pose.yaw * pose.w * 0.12, 0);

      // Rotating Outer Targeting Ring
      fx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      fx.lineWidth = Math.max(1.8, Math.round(w * 0.003));
      fx.beginPath();
      fx.arc(0, 0, tr, 0, Math.PI * 2);
      fx.stroke();

      fx.save();
      fx.rotate(t * 0.001);
      fx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      fx.lineWidth = Math.max(2.2, Math.round(w * 0.004));
      for (let i = 0; i < 4; i++) {
        fx.beginPath();
        fx.arc(0, 0, tr * 1.12, i * Math.PI * 0.5 + 0.12, i * Math.PI * 0.5 + 0.58);
        fx.stroke();
      }
      fx.restore();

      // Corner target brackets [   ] tightly framing head
      const bw = tr * 1.15;
      const bh = tr * 1.15;
      const bl = Math.max(12, Math.round(tr * 0.28));
      fx.strokeStyle = '#00f0ff';
      fx.lineWidth = Math.max(2.4, Math.round(w * 0.004));
      // Top-left
      fx.beginPath(); fx.moveTo(-bw, -bh + bl); fx.lineTo(-bw, -bh); fx.lineTo(-bw + bl, -bh); fx.stroke();
      // Top-right
      fx.beginPath(); fx.moveTo(bw - bl, -bh); fx.lineTo(bw, -bh); fx.lineTo(bw, -bh + bl); fx.stroke();
      // Bottom-left
      fx.beginPath(); fx.moveTo(-bw, bh - bl); fx.lineTo(-bw, bh); fx.lineTo(-bw + bl, bh); fx.stroke();
      // Bottom-right
      fx.beginPath(); fx.moveTo(bw - bl, bh); fx.lineTo(bw, bh); fx.lineTo(bw, bh - bl); fx.stroke();

      // Horizontal scanning laser line tracking face altitude
      const scanY = (Math.sin(t * 0.004) * tr * 0.85);
      const lGrad = fx.createLinearGradient(-bw, scanY, bw, scanY);
      lGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      lGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.7)');
      lGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = lGrad;
      fx.fillRect(-bw, scanY - 3, bw * 2, 6);

      // Target lock tag
      const fs = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#ff007f';
      fx.textAlign = 'left';
      fx.fillText(pose.hasFace ? '[TGT: HOMINID // LOCKED]' : '[TGT: ACQUIRING...]', -bw, -bh - fs * 1.3);
      fx.restore();

      // Dual pupil tracking crosshairs when face landmarks exist
      if (pose.hasFace && pose.lEye && pose.rEye) {
        [pose.lEye, pose.rEye].forEach((eye) => {
          fx.save();
          fx.translate(eye.x, eye.y);
          fx.rotate(t * 0.003);
          fx.strokeStyle = '#39ff14';
          fx.lineWidth = 1.4;
          const er = Math.max(8, pose.eyeDist * 0.22);
          fx.beginPath();
          fx.arc(0, 0, er, 0, Math.PI * 2);
          fx.stroke();
          fx.beginPath();
          fx.moveTo(-er * 1.3, 0); fx.lineTo(er * 1.3, 0);
          fx.moveTo(0, -er * 1.3); fx.lineTo(0, er * 1.3);
          fx.stroke();
          fx.restore();
        });
      }

      // HUD Telemetry readouts
      const fsHUD = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fsHUD}px "Courier New", monospace`;
      fx.textBaseline = 'top';
      fx.fillStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 6;
      fx.textAlign = 'left';
      fx.fillText('SYS // CYBER-LINK v4.09', Math.round(w * 0.03), Math.round(h * 0.03));
      fx.fillStyle = '#39ff14';
      fx.fillText('● OPTIC STATUS: LOCKED', Math.round(w * 0.03), Math.round(h * 0.03) + fsHUD * 1.3);

      const hdg = Math.floor(((pose.cx / w) * 360) % 360);
      fx.fillStyle = '#facc15';
      fx.textAlign = 'right';
      fx.fillText(`HDG ${String(hdg).padStart(3, '0')}° // FOV 84°`, w - Math.round(w * 0.03), Math.round(h * 0.03));
      fx.fillText(`BIO-SYNC: 99.8% [${(72 + Math.sin(t * 0.004) * 4).toFixed(0)} BPM]`, w - Math.round(w * 0.03), Math.round(h * 0.03) + fsHUD * 1.3);

      // Occasional cyber chromatic glitch line
      if (Math.random() < 0.12) {
        const gy = Math.random() * h;
        fx.fillStyle = 'rgba(255, 0, 128, 0.45)';
        fx.fillRect(0, gy, w, Math.max(2, Math.round(h * 0.01)));
      }
      fx.restore();
    }
  },

  {
    id: 'flir_thermal', name: 'Military FLIR Predator', icon: '🎯', category: 'Sci-Fi', perf: 'high', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 28);

      // High-precision false-color infrared heatmap
      renderFlirThermal(fx, src, w, h);

      fx.save();
      // Military HUD Tactical Overlay
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.5, Math.round(w * 0.0025));

      const cx = pose.cx;
      const cy = pose.cy;
      const cr = Math.max(24, pose.eyeDist * 0.6);

      // Live Head-Tracked Precision Target Crosshair
      fx.beginPath();
      fx.moveTo(cx - cr, cy); fx.lineTo(cx - cr * 0.3, cy);
      fx.moveTo(cx + cr * 0.3, cy); fx.lineTo(cx + cr, cy);
      fx.moveTo(cx, cy - cr); fx.lineTo(cx, cy - cr * 0.3);
      fx.moveTo(cx, cy + cr * 0.3); fx.lineTo(cx, cy + cr);
      fx.stroke();

      // Mil-dot tick marks on crosshair
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        fx.beginPath();
        fx.arc(cx + i * cr * 0.28, cy, 1.5, 0, Math.PI * 2);
        fx.arc(cx, cy + i * cr * 0.28, 1.5, 0, Math.PI * 2);
        fx.fillStyle = '#ffffff';
        fx.fill();
      }

      // Target head-tracking bracket
      const hw = Math.max(pose.w * 0.6, cr * 1.5);
      const hh = Math.max(pose.h * 0.6, cr * 1.8);
      const bl = Math.max(10, Math.round(hw * 0.3));
      fx.strokeStyle = '#facc15';
      fx.lineWidth = 2;
      fx.beginPath(); fx.moveTo(cx - hw, cy - hh + bl); fx.lineTo(cx - hw, cy - hh); fx.lineTo(cx - hw + bl, cy - hh); fx.stroke();
      fx.beginPath(); fx.moveTo(cx + hw - bl, cy - hh); fx.lineTo(cx + hw, cy - hh); fx.lineTo(cx + hw, cy - hh + bl); fx.stroke();
      fx.beginPath(); fx.moveTo(cx - hw, cy + hh - bl); fx.lineTo(cx - hw, cy + hh); fx.lineTo(cx - hw + bl, cy + hh); fx.stroke();
      fx.beginPath(); fx.moveTo(cx + hw - bl, cy + hh); fx.lineTo(cx + hw, cy + hh); fx.lineTo(cx + hw, cy + hh - bl); fx.stroke();

      // Top Azimuth compass tape tracking head center X
      const fs = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.textAlign = 'center';
      fx.textBaseline = 'top';
      fx.fillStyle = '#ffffff';
      const az = Math.floor(((pose.cx / w) * 360) % 360);
      fx.fillText(`[ ${String((az + 345) % 360).padStart(3, '0')} · · · ${String(az).padStart(3, '0')} · · · ${String((az + 15) % 360).padStart(3, '0')} ]`, w / 2, Math.round(h * 0.04));

      // Elevation ladder on left
      fx.textAlign = 'left';
      const ey0 = cy - cr * 1.5;
      for (let i = 0; i < 5; i++) {
        const ey = ey0 + i * cr * 0.75;
        fx.beginPath();
        fx.moveTo(Math.round(w * 0.05), ey);
        fx.lineTo(Math.round(w * 0.075), ey);
        fx.stroke();
      }

      // Military telemetry text
      fx.fillText(`SENSOR: FLIR-LWIR 850nm`, Math.round(w * 0.05), Math.round(h * 0.04));
      fx.fillText(`GAIN: AUTO (NIGHT-OPS)`, Math.round(w * 0.05), Math.round(h * 0.04) + fs * 1.3);

      const targetTemp = (36.8 + Math.sin(t * 0.003) * 0.4).toFixed(1);
      const estRange = (130 / Math.max(18, pose.eyeDist)).toFixed(1);
      fx.textAlign = 'right';
      fx.fillText(`TGT TEMP: ${targetTemp}°C [HOT-SPOT]`, w - Math.round(w * 0.05), Math.round(h * 0.04));
      fx.fillText(`RNG: ${estRange}M // ELEV: +02°`, w - Math.round(w * 0.05), Math.round(h * 0.04) + fs * 1.3);

      // Blinking red recording indicator
      if ((t % 1000) < 600) {
        fx.fillStyle = '#ef4444';
        fx.beginPath();
        fx.arc(Math.round(w * 0.05), h - Math.round(h * 0.06), 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.textBaseline = 'middle';
        fx.fillText('● REC [IR-HD]', Math.round(w * 0.05) + 16, h - Math.round(h * 0.06));
      }

      // Outer tactical frame border
      fx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      fx.lineWidth = 2;
      fx.strokeRect(Math.round(w * 0.03), Math.round(h * 0.03), w - Math.round(w * 0.06), h - Math.round(h * 0.06));
      fx.restore();
    }
  },

  {
    id: 'neon_contour', name: 'Neon Cyber Contour', icon: '⚡', category: 'Sci-Fi', perf: 'high', requiresFace: true,
    render(fx, frame) {
      renderNeonEdgePass(fx, frame.src, frame.width, frame.height, frame.time || frame.now || 0);
    }
  },

  {
    id: 'glitch_dimension', name: 'Glitch Dimension', icon: '🌀', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      fx.save();
      fx.filter = 'contrast(1.28) saturate(1.4)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // RGB split horizontal displacement bursts
      const splitAmount = Math.max(4, Math.round(w * 0.015)) + Math.sin(t * 0.006) * 6;
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.5;
      fx.drawImage(src, -splitAmount, 0, w, h);
      fx.drawImage(src, splitAmount, 0, w, h);

      // Reality-tear slicing block displacements centered around head position
      const sliceCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const sy = pose.cy - pose.h * 0.6 + Math.random() * pose.h * 1.2;
        const sh = Math.max(6, Math.random() * (h * 0.1));
        const shift = (Math.random() - 0.5) * (w * 0.08);
        fx.drawImage(src, 0, sy, w, sh, shift, sy, w, sh);
      }

      // Matrix noise bursts
      fx.globalAlpha = 0.25;
      fx.fillStyle = '#00ff66';
      for (let i = 0; i < 4; i++) {
        const bx = pose.cx - pose.w * 0.5 + Math.random() * pose.w;
        const by = pose.cy - pose.h * 0.5 + Math.random() * pose.h;
        const bw = 30 + Math.random() * 60;
        const bh = 8 + Math.random() * 16;
        fx.fillRect(bx, by, bw, bh);
      }

      // Scanlines & static flash
      fx.globalCompositeOperation = 'source-over';
      fx.globalAlpha = 0.16;
      fx.fillStyle = '#000000';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      if (Math.random() < 0.08) {
        fx.globalAlpha = 0.35;
        fx.fillStyle = '#ffffff';
        fx.fillRect(0, 0, w, h);
      }
      fx.restore();
    }
  },

  /* ============================ THOR ELECTRIC LIGHTNING GOD ============================ */
  {
    id: 'thunder_god', name: 'Thor Thunder God', icon: '⚡', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      // Base video grading: electric hyper-contrast with cool blue undertones
      fx.save();
      const flash = (Math.sin(t * 0.012) > 0.88 && Math.random() < 0.4) ? 0.45 : 0;
      if (flash > 0) {
        fx.filter = 'contrast(1.6) brightness(1.35) saturate(0.8) hue-rotate(-20deg)';
      } else {
        fx.filter = 'contrast(1.35) brightness(0.92) saturate(1.2) hue-rotate(-15deg)';
      }
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Global lightning thunder flash illumination
      if (flash > 0) {
        fx.globalCompositeOperation = 'screen';
        fx.fillStyle = `rgba(186, 230, 253, ${flash})`;
        fx.fillRect(0, 0, w, h);
      }

      // Live electric aura & supercharged eyes
      const tx = pose.cx;
      const ty = pose.cy;
      const tr = Math.max(pose.w, pose.h) * 0.55;

      fx.globalCompositeOperation = 'screen';

      // 1. Glowing electric plasma aura around head
      const auraGrad = fx.createRadialGradient(tx, ty, tr * 0.4, tx, ty, tr * 1.3);
      auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      auraGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.25)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = auraGrad;
      fx.beginPath();
      fx.arc(tx, ty, tr * 1.3, 0, Math.PI * 2);
      fx.fill();

      // 2. High-Voltage Jagged Lightning Arcs striking between screen corners and head!
      const strikeCount = 4 + (flash > 0 ? 4 : 0);
      fx.lineWidth = 2;
      fx.shadowBlur = 12;

      for (let i = 0; i < strikeCount; i++) {
        // Origin near border or random position
        const seed = (t * 0.02 + i * 37) % 100;
        const cornerX = (i % 2 === 0 ? 0 : w) + (Math.sin(seed) * w * 0.2);
        const cornerY = (i < 2 ? 0 : h) + (Math.cos(seed) * h * 0.2);

        // Target near user's head contour
        const targetAng = (i * Math.PI * 2) / strikeCount + Math.sin(t * 0.005 + i) * 0.5;
        const targetX = tx + Math.cos(targetAng) * tr * 0.9;
        const targetY = ty + Math.sin(targetAng) * tr * 0.9;

        // Draw procedural recursive lightning bolt
        fx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#ffffff';
        fx.shadowColor = '#00f0ff';
        fx.beginPath();
        fx.moveTo(cornerX, cornerY);

        let curX = cornerX;
        let curY = cornerY;
        const segments = 9;
        for (let s = 1; s <= segments; s++) {
          const frac = s / segments;
          const baseX = cornerX + (targetX - cornerX) * frac;
          const baseY = cornerY + (targetY - cornerY) * frac;
          // Jitter perpendicular to strike path
          const jitter = (Math.sin(seed * 7 + s * 13 + t * 0.03) * tr * 0.35) * (1 - frac * 0.5);
          curX = baseX + jitter;
          curY = baseY + jitter * 0.5;
          fx.lineTo(curX, curY);
        }
        fx.stroke();
      }
      fx.shadowBlur = 0;

      // 3. Supercharged Glowing Electric Pupils
      const ed = pose.w * 0.42;
      const eyeR = Math.max(4, ed * 0.16);
      [-ed * 0.5, ed * 0.5].forEach((offX) => {
        const ex = tx + Math.cos(pose.angle) * offX - Math.sin(pose.angle) * (-ed * 0.1);
        const ey = ty + Math.sin(pose.angle) * offX + Math.cos(pose.angle) * (-ed * 0.1);

        const eyeGrad = fx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 3);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, '#38bdf8');
        eyeGrad.addColorStop(0.6, '#6366f1');
        eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = eyeGrad;
        fx.beginPath();
        fx.arc(ex, ey, eyeR * 3, 0, Math.PI * 2);
        fx.fill();

        // Horizontal electric flare
        fx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        fx.fillRect(ex - eyeR * 4, ey - 1, eyeR * 8, 2);
      });

      fx.restore();
    }
  },

  /* ============================ SCI-FI STAR WARS HOLOGRAM ============================ */
  {
    id: 'hologram_transmission', name: 'Sci-Fi Hologram Transmission', icon: '📡', category: 'Sci-Fi', perf: 'low', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Monochromatic cyan/blue holographic projection
      fx.save();
      const flicker = 0.92 + Math.sin(t * 0.05) * 0.08 + (Math.random() < 0.04 ? -0.2 : 0);
      fx.filter = `contrast(1.4) brightness(${flicker}) saturate(1.8) hue-rotate(170deg)`;
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Cyan projection overlay
      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = 'rgba(6, 182, 212, 0.28)';
      fx.fillRect(0, 0, w, h);

      // 1. Holographic Projector Cone from bottom edge to head
      const coneGrad = fx.createLinearGradient(w / 2, h, pose.cx, pose.cy);
      coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      coneGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.18)');
      coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = coneGrad;
      fx.beginPath();
      fx.moveTo(w * 0.35, h);
      fx.lineTo(pose.cx - pose.w * 0.6, pose.cy + pose.h * 0.5);
      fx.lineTo(pose.cx + pose.w * 0.6, pose.cy + pose.h * 0.5);
      fx.lineTo(w * 0.65, h);
      fx.closePath();
      fx.fill();

      // 2. Horizontal Transmission Scan Beam traversing across head
      const scanY = (t * 0.12) % (h + 80) - 40;
      const beamGrad = fx.createLinearGradient(0, scanY - 15, 0, scanY + 15);
      beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = beamGrad;
      fx.fillRect(0, scanY - 15, w, 30);

      // 3. Scanline grid
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = 'rgba(0, 15, 30, 0.35)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 2);
      }

      // 4. Hologram OSD Telemetry
      fx.globalCompositeOperation = 'source-over';
      const fs = Math.max(9, Math.round(w * 0.015));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 6;
      fx.fillText('INCOMING TRANSMISSION // ENCRYPT: 4096-BIT', 20, 28);
      fx.fillText(`FEDERATION NET // FREQ: 1420.4 MHz // SNR: ${(96 + Math.sin(t * 0.003) * 3).toFixed(1)} dB`, 20, 28 + fs * 1.4);

      fx.textAlign = 'right';
      fx.fillText(`STATUS: ONLINE`, w - 20, 28);
      fx.fillText(`RESOL: 1080p HOLO-MAT`, w - 20, 28 + fs * 1.4);
      fx.shadowBlur = 0;

      fx.restore();
    }
  },

  /* ============================ COSMIC & CELESTIAL ============================ */
  {
    id: 'celestial_nebula', name: 'Celestial Nebula', icon: '🌌', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Cosmic color grading: deep indigo shadows, vibrant magenta & turquoise
      fx.filter = 'contrast(1.2) saturate(1.35) hue-rotate(-20deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Head-tracked swirling multi-colored nebula gas clouds
      fx.globalCompositeOperation = 'screen';
      const tSec = t * 0.0006;
      const clouds = [
        { x: pose.cx - pose.w * 0.35 + Math.sin(tSec * 0.8) * 20, y: pose.cy - pose.h * 0.2 + Math.cos(tSec * 0.7) * 20, r: Math.max(w, h) * 0.5, c0: 'rgba(147, 51, 234, 0.42)', c1: 'rgba(0,0,0,0)' },
        { x: pose.cx + pose.w * 0.35 + Math.cos(tSec * 0.9) * 20, y: pose.cy - pose.h * 0.15 + Math.sin(tSec * 0.6) * 20, r: Math.max(w, h) * 0.48, c0: 'rgba(6, 182, 212, 0.38)', c1: 'rgba(0,0,0,0)' },
        { x: pose.cx, y: pose.cy + pose.h * 0.4, r: Math.max(w, h) * 0.45, c0: 'rgba(236, 72, 153, 0.3)', c1: 'rgba(0,0,0,0)' }
      ];
      for (const cl of clouds) {
        const g = fx.createRadialGradient(cl.x, cl.y, 10, cl.x, cl.y, cl.r);
        g.addColorStop(0, cl.c0);
        g.addColorStop(1, cl.c1);
        fx.fillStyle = g;
        fx.fillRect(0, 0, w, h);
      }

      // Celestial starlight aura wrapping around head contour
      const aura = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.5, pose.cx, pose.cy, pose.eyeDist * 2.2);
      aura.addColorStop(0, 'rgba(103, 232, 249, 0.32)');
      aura.addColorStop(0.5, 'rgba(168, 85, 247, 0.18)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = aura;
      fx.fillRect(0, 0, w, h);

      // Starfield generator (cached on this._stars)
      if (!this._stars || this._sw !== w || this._sh !== h) {
        this._sw = w;
        this._sh = h;
        this._stars = Array.from({ length: 65 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2.5,
          freq: 0.002 + Math.random() * 0.004,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.3 ? '#67e8f9' : (Math.random() < 0.6 ? '#f472b6' : '#ffffff')
        }));
        this._meteor = null;
      }

      // Render twinkling stars
      for (const st of this._stars) {
        const tw = (Math.sin(t * st.freq + st.phase) + 1) * 0.5;
        const alpha = 0.3 + tw * 0.7;
        fx.fillStyle = st.hue;
        fx.globalAlpha = alpha;
        fx.beginPath();
        fx.arc(st.x, st.y, st.r * (0.8 + tw * 0.4), 0, Math.PI * 2);
        fx.fill();

        if (st.r > 2.2 && tw > 0.6) {
          const spk = st.r * 3 * tw;
          fx.strokeStyle = st.hue;
          fx.lineWidth = 1;
          fx.beginPath();
          fx.moveTo(st.x - spk, st.y); fx.lineTo(st.x + spk, st.y);
          fx.moveTo(st.x, st.y - spk); fx.lineTo(st.x, st.y + spk);
          fx.stroke();
        }
      }

      // Shooting star / meteor
      if (!this._meteor && Math.random() < 0.015) {
        this._meteor = {
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.3,
          vx: Math.max(12, w * 0.03),
          vy: Math.max(6, h * 0.015),
          len: Math.max(60, w * 0.18),
          life: 300,
          age: 0
        };
      }
      if (this._meteor) {
        const m = this._meteor;
        m.age += delta;
        m.x += m.vx;
        m.y += m.vy;
        const k = 1 - m.age / m.life;
        if (k > 0) {
          const mGrad = fx.createLinearGradient(m.x - m.vx * 3, m.y - m.vy * 3, m.x, m.y);
          mGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          mGrad.addColorStop(0.8, 'rgba(103, 232, 249, 0.7)');
          mGrad.addColorStop(1, 'rgba(255, 255, 255, 1)');
          fx.strokeStyle = mGrad;
          fx.lineWidth = 2.5;
          fx.beginPath();
          fx.moveTo(m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len, m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len);
          fx.lineTo(m.x, m.y);
          fx.stroke();
        } else {
          this._meteor = null;
        }
      }

      // Celestial halo vignette
      const halo = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      halo.addColorStop(0, 'rgba(0, 0, 0, 0)');
      halo.addColorStop(1, 'rgba(15, 6, 35, 0.65)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = halo;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },

  {
    id: 'aurora_borealis', name: 'Aurora Borealis', icon: '✨', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      fx.filter = 'contrast(1.18) saturate(1.25) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Layered undulating arctic aurora ribbons
      fx.globalCompositeOperation = 'screen';
      const ribbons = [
        { col: 'rgba(52, 211, 153, 0.42)', freq: 0.012, speed: 0.0012, yBase: h * 0.22, amp: h * 0.12 },
        { col: 'rgba(45, 212, 191, 0.36)', freq: 0.016, speed: 0.0016, yBase: h * 0.30, amp: h * 0.10 },
        { col: 'rgba(192, 132, 252, 0.32)', freq: 0.020, speed: 0.0009, yBase: h * 0.16, amp: h * 0.14 }
      ];

      for (const rb of ribbons) {
        fx.fillStyle = rb.col;
        fx.beginPath();
        fx.moveTo(0, 0);
        for (let x = 0; x <= w; x += Math.max(8, Math.round(w / 40))) {
          const wave = Math.sin(x * rb.freq + t * rb.speed) * rb.amp + Math.cos(x * rb.freq * 0.5 - t * rb.speed * 0.7) * (rb.amp * 0.5);
          fx.lineTo(x, rb.yBase + wave);
        }
        fx.lineTo(w, 0);
        fx.closePath();
        fx.fill();

        // Vertical glowing curtain striations
        const grad = fx.createLinearGradient(0, rb.yBase - rb.amp, 0, rb.yBase + rb.amp * 1.5);
        grad.addColorStop(0, rb.col);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = grad;
        fx.fillRect(0, rb.yBase - rb.amp, w, rb.amp * 2.5);
      }

      // Arctic stars in upper sky
      fx.fillStyle = '#ffffff';
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 89.3) % (h * 0.45));
        const sa = (Math.sin(t * 0.003 + i) + 1) * 0.4 + 0.2;
        fx.globalAlpha = sa;
        fx.beginPath();
        fx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        fx.fill();
      }

      // Atmospheric cool arctic rim lighting over head
      const arcticHead = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.5, pose.cx, pose.cy, pose.eyeDist * 2);
      arcticHead.addColorStop(0, 'rgba(52, 211, 153, 0.18)');
      arcticHead.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = arcticHead;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },

  {
    id: 'bioluminescent', name: 'Bioluminescent Ocean', icon: '🌊', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Deep abyssal teal color grade
      fx.filter = 'contrast(1.22) hue-rotate(165deg) saturate(1.4) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Shimmering sunlight water caustics dancing on head
      drawCausticRays(fx, w, h, t);

      // Rising air bubbles & glowing plankton spores
      if (!this._bubbles || this._bw !== w || this._bh !== h) {
        this._bw = w;
        this._bh = h;
        this._bubbles = Array.from({ length: 24 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 3 + Math.random() * 8,
          vy: 0.04 + Math.random() * 0.08,
          sway: 0.002 + Math.random() * 0.004,
          phase: Math.random() * Math.PI * 2,
          glow: Math.random() < 0.5 ? '#22d3ee' : '#34d399'
        }));
      }

      fx.globalCompositeOperation = 'screen';
      for (const b of this._bubbles) {
        b.y -= b.vy * delta;
        b.phase += b.sway * delta;
        const bx = b.x + Math.sin(b.phase) * (b.r * 1.5);
        if (b.y < -20) {
          b.y = h + 20;
          b.x = pose.cx - pose.w * 0.8 + Math.random() * pose.w * 1.6;
        }

        // Bioluminescent radial glow halo
        const bg = fx.createRadialGradient(bx, b.y, 1, bx, b.y, b.r * 2.8);
        bg.addColorStop(0, b.glow);
        bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = bg;
        fx.beginPath();
        fx.arc(bx, b.y, b.r * 2.8, 0, Math.PI * 2);
        fx.fill();

        // Bubble spherical glass rim & highlight
        fx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(bx, b.y, b.r, 0, Math.PI * 2);
        fx.stroke();

        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(bx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
    }
  },

  /* ============================ GARGANTUA BLACK HOLE ============================ */
  {
    id: 'vortex_blackhole', name: 'Gargantua Black Hole', icon: '🕳️', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Deep cosmic space grade
      fx.save();
      fx.filter = 'contrast(1.4) brightness(0.85) saturate(1.3) hue-rotate(-25deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const bhX = pose.cx;
      const bhY = pose.cy;
      const bhR = Math.max(22, pose.w * 0.38);

      fx.save();
      fx.translate(bhX, bhY);
      fx.rotate(pose.angle * 0.8);
      // Perspective tilt with head yaw
      const diskTilt = 0.28 + pose.yaw * 0.15;

      // 1. Relativistic Accretion Disk (Background Half behind event horizon)
      fx.save();
      fx.scale(1, diskTilt);
      fx.rotate(t * 0.001);
      const diskR = bhR * 2.8;

      // Outer swirling plasma ring
      const diskGrad = fx.createRadialGradient(0, 0, bhR * 1.05, 0, 0, diskR);
      diskGrad.addColorStop(0, '#ffffff');
      diskGrad.addColorStop(0.2, '#fde047');
      diskGrad.addColorStop(0.5, '#ea580c');
      diskGrad.addColorStop(0.8, '#7c2d12');
      diskGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = diskGrad;
      fx.beginPath();
      fx.arc(0, 0, diskR, 0, Math.PI * 2);
      fx.fill();
      fx.restore();

      // 2. Gravitational Lensing Arc (Light bent over the top and bottom of singularity)
      fx.save();
      fx.globalCompositeOperation = 'screen';
      [-1, 1].forEach((dir) => {
        fx.beginPath();
        fx.ellipse(0, dir * bhR * 0.75, bhR * 1.5, bhR * 0.65, 0, 0, Math.PI * 2);
        const lensGrad = fx.createLinearGradient(0, dir * bhR * 1.2, 0, 0);
        lensGrad.addColorStop(0, 'rgba(253, 224, 71, 0.7)');
        lensGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.4)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = lensGrad;
        fx.fill();
      });
      fx.restore();

      // 3. Pitch-Black Event Horizon (Singularity Core)
      fx.beginPath();
      fx.arc(0, 0, bhR, 0, Math.PI * 2);
      fx.fillStyle = '#000000';
      fx.shadowColor = '#000000';
      fx.shadowBlur = 15;
      fx.fill();
      fx.shadowBlur = 0;

      // 4. Incandescent Photon Sphere (Thin white-hot orbital ring)
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.5, Math.round(bhR * 0.06));
      fx.shadowColor = '#fef08a';
      fx.shadowBlur = 10;
      fx.beginPath();
      fx.arc(0, 0, bhR * 1.03, 0, Math.PI * 2);
      fx.stroke();
      fx.shadowBlur = 0;

      // 5. Forefront Accretion Disk with Relativistic Doppler Beaming!
      // (Approaching left side is boosted in brightness and bluer; receding right side is dimmer red)
      fx.save();
      fx.scale(1, diskTilt);
      fx.rotate(t * 0.001);

      // Approaching side (Doppler blue-shifted glow)
      const dopplerGrad = fx.createRadialGradient(-bhR * 0.8, 0, 0, -bhR * 0.8, 0, diskR);
      dopplerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      dopplerGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
      dopplerGrad.addColorStop(0.7, 'rgba(234, 88, 12, 0.3)');
      dopplerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = dopplerGrad;
      fx.beginPath();
      fx.arc(0, 0, diskR, Math.PI * 0.45, Math.PI * 1.55);
      fx.fill();
      fx.restore();

      // 6. Warped Star Dust Infall Particles
      fx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      for (let i = 0; i < 20; i++) {
        const spiralA = t * 0.002 + (i * Math.PI * 2) / 20;
        const spiralR = bhR * 1.1 + ((t * 0.04 + i * 18) % (bhR * 1.8));
        const px = Math.cos(spiralA) * spiralR;
        const py = Math.sin(spiralA) * spiralR * diskTilt;
        fx.beginPath();
        fx.arc(px, py, Math.max(1, bhR * 0.025), 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
      fx.restore();
    }
  },

  /* ============================ COSMIC SUPERNOVA & PULSAR ============================ */
  {
    id: 'supernova_cosmic', name: 'Cosmic Supernova & Pulsar', icon: '💥', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      fx.filter = 'contrast(1.3) brightness(1.05) saturate(1.4) hue-rotate(15deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const cx = pose.cx;
      const cy = pose.cy;
      const r = Math.max(20, pose.w * 0.5);

      fx.save();
      fx.translate(cx, cy);
      fx.rotate(pose.angle);
      fx.globalCompositeOperation = 'screen';

      // 1. Relativistic Astrophysical Jets shooting along magnetic poles!
      const jetLen = Math.max(w, h) * 0.7;
      [-1, 1].forEach((dir) => {
        const jGrad = fx.createLinearGradient(0, 0, 0, dir * jetLen);
        jGrad.addColorStop(0, '#ffffff');
        jGrad.addColorStop(0.15, 'rgba(56, 189, 248, 0.9)');
        jGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
        jGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = jGrad;
        fx.beginPath();
        fx.moveTo(-r * 0.15, 0);
        fx.lineTo(r * 0.15, 0);
        fx.lineTo(r * 0.6, dir * jetLen);
        fx.lineTo(-r * 0.6, dir * jetLen);
        fx.closePath();
        fx.fill();
      });

      // 2. Expanding Supernova Shockwave Rings
      for (let s = 0; s < 3; s++) {
        const ringProgress = ((t * 0.001 + s * 0.33) % 1);
        const ringR = r * (0.8 + ringProgress * 3.5);
        const alpha = (1 - ringProgress) * 0.75;
        fx.strokeStyle = s % 2 === 0 ? `rgba(244, 63, 94, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
        fx.lineWidth = Math.max(2, Math.round(r * 0.05 * (1 - ringProgress)));
        fx.beginPath();
        fx.arc(0, 0, ringR, 0, Math.PI * 2);
        fx.stroke();
      }

      // 3. Central Hyper-Dense Stellar Core (Neutron Star / Pulsar Core)
      const coreR = r * 0.45 * (0.9 + 0.1 * Math.sin(t * 0.008));
      const coreGrad = fx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.5);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.25, 'rgba(254, 240, 138, 0.95)');
      coreGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.6)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = coreGrad;
      fx.beginPath();
      fx.arc(0, 0, coreR * 2.5, 0, Math.PI * 2);
      fx.fill();

      // 4. Stellar Nursery Sparkles with 4-Point Cross Diffraction Spikes
      for (let i = 0; i < 28; i++) {
        const sa = (i * 137.5 * Math.PI) / 180 + t * 0.0003;
        const sr = r * (0.6 + ((i * 19) % 25) * 0.08);
        const sx = Math.cos(sa) * sr;
        const sy = Math.sin(sa) * sr;
        const sSize = 4 + (Math.sin(t * 0.006 + i) + 1) * 3;

        fx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(253, 224, 71, 0.9)';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(sx - sSize, sy); fx.lineTo(sx + sSize, sy);
        fx.moveTo(sx, sy - sSize); fx.lineTo(sx, sy + sSize);
        fx.stroke();
      }

      fx.restore();
      fx.restore();
    }
  },

  /* ============================ DEEP OCEAN ABYSS ============================ */
  {
    id: 'underwater_aquarium', name: 'Deep Ocean Abyss', icon: '🌊', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      // Deep oceanic color grading
      fx.save();
      fx.filter = 'contrast(1.18) brightness(0.9) saturate(1.3) hue-rotate(185deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Deep water caustic sunbeams angling towards head
      fx.globalCompositeOperation = 'screen';
      const beamCount = 6;
      for (let b = 0; b < beamCount; b++) {
        const sweep = Math.sin(t * 0.001 + b * 1.1) * (w * 0.15);
        const bxTop = (b / beamCount) * w + sweep;
        const beamGrad = fx.createLinearGradient(bxTop, 0, pose.cx, pose.cy);
        beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        beamGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.15)');
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = beamGrad;
        fx.beginPath();
        fx.moveTo(bxTop - 25, 0);
        fx.lineTo(bxTop + 25, 0);
        fx.lineTo(pose.cx + (b - 3) * 35, h);
        fx.lineTo(pose.cx + (b - 3) * 35 - 30, h);
        fx.closePath();
        fx.fill();
      }

      // Rising oxygen bubbles from mouth/chin
      if (!this._bubbles) this._bubbles = [];
      if (Math.random() < 0.35) {
        this._bubbles.push({
          x: pose.cx + (Math.random() - 0.5) * (pose.w * 0.35),
          y: pose.cy + pose.h * 0.38,
          r: rand(3, 8),
          vy: rand(0.08, 0.18),
          wobble: rand(0, 6.28),
          life: rand(2500, 4500),
          age: 0
        });
      }

      // Update & render bubbles
      for (let i = this._bubbles.length - 1; i >= 0; i--) {
        const bub = this._bubbles[i];
        bub.age += delta;
        if (bub.age >= bub.life || bub.y < -10) {
          this._bubbles.splice(i, 1);
          continue;
        }
        bub.y -= bub.vy * delta;
        const curX = bub.x + Math.sin(t * 0.003 + bub.wobble) * 8;

        fx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(curX, bub.y, bub.r, 0, Math.PI * 2);
        fx.stroke();
        fx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        fx.fill();
        // Highlight
        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(curX - bub.r * 0.35, bub.y - bub.r * 0.35, bub.r * 0.3, 0, Math.PI * 2);
        fx.fill();
      }
      if (this._bubbles.length > 50) this._bubbles.splice(0, this._bubbles.length - 50);

      // 3 Undulating Bioluminescent Jellyfish swimming around head
      const jFlies = [
        { hue: '#67e8f9', size: pose.w * 0.28, speed: 0.0008, radX: pose.w * 0.9, radY: pose.h * 0.6, off: 0 },
        { hue: '#e879f9', size: pose.w * 0.22, speed: 0.0011, radX: pose.w * 0.8, radY: pose.h * 0.5, off: 2.1 },
        { hue: '#6ee7b7', size: pose.w * 0.24, speed: 0.0009, radX: pose.w * 0.95, radY: pose.h * 0.55, off: 4.2 }
      ];

      for (let j = 0; j < jFlies.length; j++) {
        const jf = jFlies[j];
        const ja = t * jf.speed + jf.off;
        const jx = pose.cx + Math.cos(ja) * jf.radX;
        const jy = pose.cy + Math.sin(ja) * jf.radY + Math.sin(t * 0.002 + j) * 15;
        const pulse = Math.sin(t * 0.004 + j * 1.5);
        const js = jf.size;

        fx.save();
        fx.translate(jx, jy);
        fx.rotate(-ja * 0.3);

        // Translucent umbrella bell
        fx.beginPath();
        fx.moveTo(-js * 0.5, 0);
        fx.quadraticCurveTo(0, -js * (0.6 + pulse * 0.15), js * 0.5, 0);
        fx.quadraticCurveTo(0, js * 0.15, -js * 0.5, 0);
        fx.fillStyle = jf.hue;
        fx.globalAlpha = 0.45;
        fx.fill();
        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 1;
        fx.stroke();

        // Glowing rim nodes
        fx.globalAlpha = 0.8;
        for (let n = -2; n <= 2; n++) {
          fx.fillStyle = '#ffffff';
          fx.beginPath();
          fx.arc(n * (js * 0.18), 0, 1.5, 0, Math.PI * 2);
          fx.fill();
        }

        // Flowing tentacles
        fx.strokeStyle = jf.hue;
        fx.lineWidth = 1.2;
        fx.globalAlpha = 0.6;
        for (let tent = -2; tent <= 2; tent++) {
          const tx0 = tent * (js * 0.16);
          fx.beginPath();
          fx.moveTo(tx0, 0);
          fx.quadraticCurveTo(
            tx0 + Math.sin(t * 0.005 + tent) * 8, js * 0.5,
            tx0 + Math.sin(t * 0.004 + tent + 1) * 12, js * 1.1
          );
          fx.stroke();
        }
        fx.restore();
      }

      fx.restore();
    }
  },

  /* ============================ VINTAGE & RETRO ============================ */
  {
    id: 'retro_camcorder', name: '90s Hi8 Camcorder', icon: '📹', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      fx.save();
      // Analog magnetic tape grade
      fx.filter = 'contrast(1.12) brightness(1.04) saturate(1.18) sepia(0.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Analog tape chroma delay (R/B color separation)
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.35;
      fx.drawImage(src, 2.5, 0, w, h);
      fx.drawImage(src, -2.5, 0, w, h);
      fx.globalCompositeOperation = 'source-over';
      fx.globalAlpha = 1;

      // Moving magnetic tracking error bar
      const trackY = (t * 0.08) % (h + 180) - 90;
      const trackGrad = fx.createLinearGradient(0, trackY - 30, 0, trackY + 30);
      trackGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      trackGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
      trackGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      fx.fillStyle = trackGrad;
      fx.fillRect(0, trackY - 30, w, 60);

      // Horizontal scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      // Live Head-Tracked 90s Autofocus Bracket [   ]
      const afW = Math.max(28, pose.w * 0.45);
      const afH = Math.max(28, pose.h * 0.45);
      const afL = Math.max(8, afW * 0.3);
      fx.strokeStyle = pose.hasFace ? '#22c55e' : 'rgba(255, 255, 255, 0.7)';
      fx.lineWidth = 2;
      const ax = pose.cx;
      const ay = pose.cy;
      fx.beginPath(); fx.moveTo(ax - afW, ay - afH + afL); fx.lineTo(ax - afW, ay - afH); fx.lineTo(ax - afW + afL, ay - afH); fx.stroke();
      fx.beginPath(); fx.moveTo(ax + afW - afL, ay - afH); fx.lineTo(ax + afW, ay - afH); fx.lineTo(ax + afW, ay - afH + afL); fx.stroke();
      fx.beginPath(); fx.moveTo(ax - afW, ay + afH - afL); fx.lineTo(ax - afW, ay + afH); fx.lineTo(ax - afW + afL, ay + afH); fx.stroke();
      fx.beginPath(); fx.moveTo(ax + afW - afL, ay + afH); fx.lineTo(ax + afW, ay + afH); fx.lineTo(ax + afW, ay + afH - afL); fx.stroke();

      // Authentic 90s Camcorder OSD
      const fs = Math.max(12, Math.round(w * 0.026));
      fx.font = `bold ${fs}px "Courier New", Courier, monospace`;
      fx.fillStyle = '#ffffff';
      fx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      fx.shadowBlur = 4;
      fx.textBaseline = 'top';

      // Top-left: Flashing red recording dot + SP
      const pad = Math.round(w * 0.04);
      if ((t % 900) < 550) {
        fx.fillStyle = '#ef4444';
        fx.beginPath();
        fx.arc(pad + 8, pad + fs * 0.5, 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.fillText('REC   SP', pad + 24, pad);
      } else {
        fx.fillText('      SP', pad + 24, pad);
      }

      // Top-right: Battery gauge
      fx.textAlign = 'right';
      fx.fillText('[■■■■] BATT', w - pad, pad);

      // Bottom-left: Zoom gauge & AF status
      fx.textAlign = 'left';
      fx.textBaseline = 'bottom';
      fx.fillText(pose.hasFace ? 'AF-LOCK  [ W ----|---- T ]' : 'AF-SEARCH [ W ----|---- T ]', pad, h - pad);

      // Bottom-right: Live 1998 Date & Time stamp with ticking seconds
      const nowD = new Date();
      const s = String(nowD.getSeconds()).padStart(2, '0');
      const m = String(nowD.getMinutes()).padStart(2, '0');
      const hr = String(nowD.getHours() % 12 || 12).padStart(2, '0');
      const ampm = nowD.getHours() >= 12 ? 'PM' : 'AM';
      fx.textAlign = 'right';
      fx.fillStyle = '#ffb300';
      fx.fillText(`OCT 16, 1998  ${hr}:${m}:${s} ${ampm}`, w - pad, h - pad);
      fx.restore();
    }
  },

  {
    id: 'synthwave_outrun', name: 'Synthwave 1984', icon: '🌴', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Outrun duotone grade
      fx.filter = 'contrast(1.3) saturate(1.55) hue-rotate(270deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Giant wireframe retro sun on the horizon
      const hy = h * 0.62;
      const sunR = Math.min(w, h) * 0.28;
      const sunX = pose.cx;
      const sunY = hy - sunR * 0.2;

      fx.save();
      fx.beginPath();
      fx.rect(0, 0, w, hy);
      fx.clip();

      const sunGrad = fx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
      sunGrad.addColorStop(0, '#fde047');
      sunGrad.addColorStop(0.5, '#f43f5e');
      sunGrad.addColorStop(1, '#a855f7');
      fx.fillStyle = sunGrad;
      fx.beginPath();
      fx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      fx.fill();

      // Horizontal segmented blind slats on sun
      fx.fillStyle = '#0f051d';
      for (let sY = sunY - sunR * 0.2; sY < sunY + sunR; sY += Math.max(6, sunR * 0.12)) {
        const slatH = Math.max(2, (sY - (sunY - sunR * 0.2)) * 0.1);
        fx.fillRect(sunX - sunR, sY, sunR * 2, slatH);
      }
      fx.restore();

      // 3D Moving perspective road grid on bottom half tracking head position
      fx.save();
      fx.beginPath();
      fx.rect(0, hy, w, h - hy);
      fx.clip();

      const groundGrad = fx.createLinearGradient(0, hy, 0, h);
      groundGrad.addColorStop(0, 'rgba(15, 5, 29, 0.45)');
      groundGrad.addColorStop(1, 'rgba(88, 28, 135, 0.7)');
      fx.fillStyle = groundGrad;
      fx.fillRect(0, hy, w, h - hy);

      fx.strokeStyle = '#ec4899';
      fx.lineWidth = 1.8;
      fx.shadowColor = '#ec4899';
      fx.shadowBlur = 8;

      const speed = (t * 0.08) % 36;
      for (let y = hy + speed; y < h; y += Math.max(16, (y - hy) * 0.35 + 8)) {
        fx.beginPath(); fx.moveTo(0, y); fx.lineTo(w, y); fx.stroke();
      }

      // Vanishing point perspective rays aligned with head X
      const vcx = pose.cx;
      for (let rx = -w * 0.6; rx <= w * 1.6; rx += Math.max(24, w / 9)) {
        fx.beginPath(); fx.moveTo(vcx, hy); fx.lineTo(rx, h); fx.stroke();
      }
      fx.restore();

      // Silhouette palm trees on borders
      fx.fillStyle = '#0f051d';
      const drawPalm = (px, py, flip) => {
        fx.save();
        fx.translate(px, py);
        if (flip) fx.scale(-1, 1);
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.quadraticCurveTo(14, -h * 0.2, 8, -h * 0.38);
        fx.lineTo(16, -h * 0.38);
        fx.quadraticCurveTo(24, -h * 0.2, 10, 0);
        fx.fill();
        for (let a = -0.4; a < 1.2; a += 0.35) {
          fx.beginPath();
          fx.moveTo(12, -h * 0.38);
          fx.quadraticCurveTo(35 * Math.cos(a) + 12, -h * 0.38 + 25 * Math.sin(a), 50 * Math.cos(a) + 12, -h * 0.38 + 50 * Math.sin(a));
          fx.quadraticCurveTo(30 * Math.cos(a) + 12, -h * 0.38 + 18 * Math.sin(a), 12, -h * 0.38);
          fx.fill();
        }
        fx.restore();
      };
      drawPalm(Math.round(w * 0.06), h, false);
      drawPalm(w - Math.round(w * 0.06), h, true);

      // CRT Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      fx.restore();
    }
  },

  /* ============================ ANALOG 1988 VHS TAPE GLITCH ============================ */
  {
    id: 'cyber_glitch_vhs', name: 'Analog 1988 VHS Glitch', icon: '📼', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Vintage magnetic VHS color profile
      fx.save();
      fx.filter = 'contrast(1.15) brightness(1.02) saturate(1.25) sepia(0.06)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // 1. Magnetic Tape Horizontal Glitch Band tracking head altitude!
      const glitchY = (pose.cy - pose.h * 0.4 + Math.sin(t * 0.003) * (pose.h * 0.8));
      const glitchH = Math.max(16, Math.round(pose.h * 0.22));
      const shiftX = Math.sin(t * 0.02) * 18;

      // Displaced slice with chromatic split
      fx.save();
      fx.beginPath();
      fx.rect(0, glitchY, w, glitchH);
      fx.clip();

      // Red channel shift
      fx.globalAlpha = 0.7;
      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = '#ff0055';
      fx.drawImage(src, shiftX, 0, w, h);

      // Cyan channel shift
      fx.fillStyle = '#00ffff';
      fx.drawImage(src, -shiftX, 0, w, h);
      fx.restore();

      // 2. Head-Switching Noise Band at bottom of frame (Standard VCR tracking artifact)
      const noiseH = Math.max(14, Math.round(h * 0.035));
      fx.save();
      fx.fillStyle = '#000000';
      fx.fillRect(0, h - noiseH, w, noiseH);
      for (let n = 0; n < 40; n++) {
        const nx = Math.random() * w;
        const nw = rand(8, 45);
        fx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#475569';
        fx.fillRect(nx, h - noiseH + Math.random() * noiseH, nw, 2);
      }
      fx.restore();

      // 3. Realistic 1988 VCR On-Screen Display (OSD)
      fx.save();
      const fs = Math.max(11, Math.round(w * 0.022));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#22c55e';
      fx.shadowColor = '#22c55e';
      fx.shadowBlur = 6;

      // Play indicator
      fx.fillText('► PLAY', 28, 38);

      // Live 1988 timecode
      const sec = Math.floor(t * 0.001) % 60;
      const min = Math.floor(t * 0.001 / 60) % 60;
      const tc = `SP  0:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      fx.fillText(tc, 28, 38 + fs * 1.4);

      // Blinking REC dot
      if (Math.sin(t * 0.005) > 0) {
        fx.fillStyle = '#ef4444';
        fx.shadowColor = '#ef4444';
        fx.beginPath();
        fx.arc(w - 75, 32, 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.fillText('REC', w - 62, 36);
      }

      // Tracking indicator
      fx.fillStyle = '#22c55e';
      fx.textAlign = 'right';
      fx.fillText('TRACKING: AUTO', w - 28, h - noiseH - 12);
      fx.restore();

      fx.restore();
    }
  },

  /* ============================ CINEMA & EDITORIAL ============================ */
  {
    id: 'golden_stardust', name: 'Golden Stardust & Rays', icon: '✨', category: 'Portrait', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Editorial luxury golden hour grade
      fx.filter = 'sepia(0.24) contrast(1.14) brightness(1.06) saturate(1.24)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Warm halation bloom
      renderHalationBloom(fx, src, w, h, 0.42, 'warm');

      // Volumetric diagonal sunbeams converging directly toward user's head
      fx.globalCompositeOperation = 'screen';
      const rayGrad = fx.createLinearGradient(0, 0, pose.cx + w * 0.2, pose.cy + h * 0.2);
      rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
      rayGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.26)');
      rayGrad.addColorStop(0.75, 'rgba(245, 158, 11, 0.12)');
      rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = rayGrad;
      fx.beginPath();
      fx.moveTo(0, 0);
      fx.lineTo(w * 0.5, 0);
      fx.lineTo(pose.cx + pose.w, pose.cy + pose.h * 0.5);
      fx.lineTo(pose.cx - pose.w * 0.5, h);
      fx.lineTo(0, h * 0.6);
      fx.fill();

      // Drifting golden bokeh orbs floating in 3D around head
      if (!this._bokeh || this._bw !== w) {
        this._bw = w;
        this._bokeh = Array.from({ length: 22 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 14 + Math.random() * 32,
          vy: 0.03 + Math.random() * 0.05,
          phase: Math.random() * Math.PI * 2,
          col: Math.random() < 0.6 ? 'rgba(254, 240, 138, 0.25)' : 'rgba(251, 191, 36, 0.2)'
        }));
      }

      for (const b of this._bokeh) {
        b.y -= b.vy * delta;
        b.phase += 0.002 * delta;
        if (b.y < -b.r * 2) {
          b.y = h + b.r * 2;
          b.x = pose.cx - pose.w + Math.random() * pose.w * 2;
        }
        const bx = b.x + Math.sin(b.phase) * 16;
        fx.fillStyle = b.col;
        fx.beginPath();
        fx.arc(bx, b.y, b.r, 0, Math.PI * 2);
        fx.fill();

        fx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        fx.lineWidth = 1.2;
        fx.stroke();
      }

      // Twinkling 4-point diamond stardust sparkles on cheekbones & eyes
      for (let i = 0; i < 8; i++) {
        const sx = ((pose.cx - pose.w * 0.6 + i * 42.5 + t * 0.02) % w);
        const sy = ((pose.cy - pose.h * 0.6 + i * 36.2 + Math.sin(t * 0.003 + i) * 20) % h);
        const tw = (Math.sin(t * 0.005 + i * 1.8) + 1) * 0.5;
        if (tw > 0.4) {
          const spk = Math.max(6, Math.round(w * 0.015)) * tw;
          fx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          fx.lineWidth = 1.5;
          fx.beginPath();
          fx.moveTo(sx - spk, sy); fx.lineTo(sx + spk, sy);
          fx.moveTo(sx, sy - spk); fx.lineTo(sx, sy + spk);
          fx.stroke();
          fx.fillStyle = '#ffffff';
          fx.beginPath();
          fx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          fx.fill();
        }
      }
      fx.restore();
    }
  },

  {
    id: 'blood_moon', name: 'Gothic Blood Moon', icon: '🩸', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // High-contrast obsidian silver noir with selective red infusion
      fx.filter = 'grayscale(0.9) contrast(1.4) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Blood red rim lighting & vignette directed at head
      fx.globalCompositeOperation = 'screen';
      const bloodGrad = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.4, pose.cx, pose.cy, Math.max(w, h) * 0.65);
      bloodGrad.addColorStop(0, 'rgba(220, 38, 38, 0.45)');
      bloodGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.25)');
      bloodGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = bloodGrad;
      fx.fillRect(0, 0, w, h);

      // Ominous Blood Moon in upper backdrop
      const moonR = Math.min(w, h) * 0.16;
      const moonX = w * 0.78;
      const moonY = h * 0.22;
      const moonGrad = fx.createRadialGradient(moonX, moonY, moonR * 0.1, moonX, moonY, moonR);
      moonGrad.addColorStop(0, 'rgba(254, 202, 202, 0.85)');
      moonGrad.addColorStop(0.4, 'rgba(239, 68, 68, 0.7)');
      moonGrad.addColorStop(0.85, 'rgba(153, 27, 27, 0.4)');
      moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = moonGrad;
      fx.beginPath();
      fx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      fx.fill();

      // Volumetric curling ground mist
      const mistY = h * 0.75;
      const mistGrad = fx.createLinearGradient(0, mistY, 0, h);
      mistGrad.addColorStop(0, 'rgba(220, 38, 38, 0)');
      mistGrad.addColorStop(1, 'rgba(185, 28, 28, 0.42)');
      fx.fillStyle = mistGrad;
      fx.fillRect(0, mistY, w, h - mistY);

      // Cinematic 2.39:1 widescreen letterbox bars
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = '#060308';
      const barH = Math.round(h * 0.08);
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.24);
      fx.restore();
    }
  },

  {
    id: 'inferno_embers', name: 'Inferno Fire & Embers', icon: '🔥', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Volcanic smoldering color grade
      fx.filter = 'sepia(0.4) saturate(1.7) contrast(1.22) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Fiery ember particle system swirling around head
      if (!this._embers || this._ew !== w) {
        this._ew = w;
        this._embers = Array.from({ length: 45 }, () => ({
          x: Math.random() * w,
          y: h + Math.random() * 40,
          r: 1.5 + Math.random() * 3.5,
          vy: 0.06 + Math.random() * 0.14,
          vx: (Math.random() - 0.5) * 0.03,
          sway: 0.002 + Math.random() * 0.005,
          phase: Math.random() * Math.PI * 2,
          heat: Math.random()
        }));
      }

      fx.globalCompositeOperation = 'screen';

      // Bottom glowing fire rim
      const fireGrad = fx.createLinearGradient(0, h - Math.min(120, h * 0.28), 0, h);
      fireGrad.addColorStop(0, 'rgba(234, 88, 12, 0)');
      fireGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)');
      fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0.65)');
      fx.fillStyle = fireGrad;
      fx.fillRect(0, h - Math.min(120, h * 0.28), w, Math.min(120, h * 0.28));

      for (const p of this._embers) {
        p.y -= p.vy * delta;
        p.phase += p.sway * delta;
        p.x += Math.sin(p.phase) * (delta * 0.08) + p.vx * delta;
        if (p.y < -10) {
          p.y = h + Math.random() * 20;
          p.x = pose.cx - pose.w * 0.8 + Math.random() * pose.w * 1.6;
        }

        const flick = (Math.sin(t * 0.01 + p.phase) + 1) * 0.5;
        const rad = p.r * (0.8 + flick * 0.4);

        const g = fx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rad * 3);
        g.addColorStop(0, p.heat > 0.4 ? '#fef08a' : '#fb923c');
        g.addColorStop(0.5, '#ea580c');
        g.addColorStop(1, 'rgba(220, 38, 38, 0)');

        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(p.x, p.y, rad * 3, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
    }
  },

  /* ============================ 1940s CLASSIC FILM NOIR ============================ */
  {
    id: 'film_noir_1940', name: '1940s Film Noir Detective', icon: '🕵️', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      // Chiaroscuro high-contrast black & white grading
      fx.save();
      fx.filter = 'grayscale(1) contrast(1.65) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // 1. Live Head-Tracked Oval Spotlight following detective's face
      const spotGrad = fx.createRadialGradient(
        pose.cx, pose.cy, Math.max(15, pose.w * 0.35),
        pose.cx, pose.cy, Math.max(w, h) * 0.65
      );
      spotGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      spotGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
      fx.fillStyle = spotGrad;
      fx.fillRect(0, 0, w, h);

      // 2. Venetian Blind Shadow Slats casting dramatic diagonal stripes
      fx.save();
      fx.rotate(-0.25);
      fx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      const slatH = Math.max(14, Math.round(h * 0.055));
      const slatGap = Math.max(12, Math.round(h * 0.045));
      const totalH = h * 1.5;
      for (let y = -h * 0.3; y < totalH; y += slatH + slatGap) {
        fx.fillRect(-w * 0.3, y, w * 1.6, slatH);
      }
      fx.restore();

      // 3. Realistic curling cigarette smoke wisps drifting past head
      if (!this._smoke) this._smoke = [];
      if (Math.random() < 0.4) {
        this._smoke.push({
          x: pose.cx + (Math.random() - 0.5) * (pose.w * 0.3),
          y: pose.cy + pose.h * 0.3,
          r: rand(10, 24),
          vx: rand(-0.02, 0.02),
          vy: -rand(0.06, 0.14),
          age: 0,
          life: rand(1800, 3200)
        });
      }

      fx.save();
      fx.globalCompositeOperation = 'screen';
      for (let i = this._smoke.length - 1; i >= 0; i--) {
        const sm = this._smoke[i];
        sm.age += delta;
        if (sm.age >= sm.life) {
          this._smoke.splice(i, 1);
          continue;
        }
        const k = 1 - sm.age / sm.life;
        sm.x += sm.vx * delta + Math.sin(t * 0.003 + sm.age * 0.004) * 0.6;
        sm.y += sm.vy * delta;
        const curR = sm.r * (1 + (1 - k) * 1.5);

        const sg = fx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, curR);
        sg.addColorStop(0, `rgba(255, 255, 255, ${0.28 * k})`);
        sg.addColorStop(0.6, `rgba(200, 200, 200, ${0.12 * k})`);
        sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = sg;
        fx.beginPath();
        fx.arc(sm.x, sm.y, curR, 0, Math.PI * 2);
        fx.fill();
      }
      if (this._smoke.length > 40) this._smoke.splice(0, this._smoke.length - 40);
      fx.restore();

      // 4. Subtle 35mm silver halide film grain
      fx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let g = 0; g < 120; g++) {
        fx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }

      fx.restore();
    }
  },

  /* ============================ ART & REFRACTION ============================ */
  {
    id: 'liquid_rainbow', name: 'Liquid Rainbow Chrome', icon: '🌈', category: 'Art', perf: 'high', requiresFace: true,
    render(fx, frame) {
      renderLiquidRainbowPass(fx, frame.src, frame.width, frame.height, frame.time || frame.now || 0);
    }
  },

  {
    id: 'diamond_prism', name: 'Diamond Crystal Prism', icon: '💎', category: 'Art', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      fx.save();
      fx.drawImage(src, 0, 0, w, h);

      const cx = pose.cx;
      const cy = pose.cy;
      const r = Math.max(pose.w, pose.h) * 0.7;

      // Hexagonal multi-facet refractions centered on head pose
      const facets = 6;
      for (let i = 0; i < facets; i++) {
        const a0 = (i * Math.PI * 2) / facets + pose.angle;
        const a1 = ((i + 1) * Math.PI * 2) / facets + pose.angle;
        const x0 = cx + Math.cos(a0) * r;
        const y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r;
        const y1 = cy + Math.sin(a1) * r;

        fx.save();
        fx.beginPath();
        fx.moveTo(cx, cy);
        fx.lineTo(x0, y0);
        fx.lineTo(x1, y1);
        fx.closePath();
        fx.clip();

        // Facet refraction reflection with chromatic dispersion
        fx.translate(cx, cy);
        fx.rotate((i % 2 === 0 ? 0.08 : -0.08) * Math.sin(t * 0.001));
        fx.translate(-cx, -cy);

        fx.globalAlpha = 0.85;
        fx.drawImage(src, 0, 0, w, h);

        // Chromatic dispersion at seam
        fx.globalCompositeOperation = 'screen';
        fx.globalAlpha = 0.35;
        fx.drawImage(src, 3, 0, w, h);
        fx.drawImage(src, -3, 0, w, h);
        fx.restore();

        // Facet bevel line
        fx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        fx.lineWidth = 1.5;
        fx.beginPath();
        fx.moveTo(cx, cy);
        fx.lineTo(x0, y0);
        fx.stroke();
      }

      // Dynamic diamond glint stars at vertex points
      fx.globalCompositeOperation = 'screen';
      for (let i = 0; i < facets; i++) {
        const a = (i * Math.PI * 2) / facets + pose.angle;
        const gx = cx + Math.cos(a) * r;
        const gy = cy + Math.sin(a) * r;
        const gl = (Math.sin(t * 0.004 + i * 1.5) + 1) * 0.5;
        if (gl > 0.5) {
          const spk = Math.max(10, Math.round(w * 0.025)) * gl;
          fx.strokeStyle = '#ffffff';
          fx.lineWidth = 2;
          fx.beginPath();
          fx.moveTo(gx - spk, gy); fx.lineTo(gx + spk, gy);
          fx.moveTo(gx, gy - spk); fx.lineTo(gx, gy + spk);
          fx.stroke();
        }
      }
      fx.restore();
    }
  },

  {
    id: 'anime_impact', name: 'Manga Anime Impact', icon: '💥', category: 'Art', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 22);

      fx.save();
      // Japanese action manga black & white ink style
      fx.filter = 'grayscale(1) contrast(1.75) brightness(1.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Live Head-Tracked Radiating Speed Lines converging directly on head!
      const cx = pose.cx;
      const cy = pose.cy;
      const rMax = Math.hypot(w, h) * 0.6;
      const rMin = Math.max(pose.w, pose.h) * 0.45;
      const lines = 42;

      fx.strokeStyle = '#000000';
      fx.fillStyle = '#000000';
      for (let i = 0; i < lines; i++) {
        const seed = (i * 137.5 + t * 0.012) % (Math.PI * 2);
        const lMin = rMin * (0.85 + Math.sin(i * 3 + t * 0.02) * 0.25);
        const lMax = rMax;
        const spread = (Math.PI * 2) / (lines * 2.5);

        fx.beginPath();
        fx.moveTo(cx + Math.cos(seed) * lMin, cy + Math.sin(seed) * lMin);
        fx.lineTo(cx + Math.cos(seed - spread) * lMax, cy + Math.sin(seed - spread) * lMax);
        fx.lineTo(cx + Math.cos(seed + spread) * lMax, cy + Math.sin(seed + spread) * lMax);
        fx.closePath();
        fx.fill();
      }

      // Manga Action Onomatopoeia Stamp (「ドォォン!!」 / "BOOOM!!") tracking head position
      const fs = Math.max(22, Math.round(w * 0.065));
      fx.font = `900 ${fs}px "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif`;
      fx.textBaseline = 'middle';
      fx.textAlign = 'center';

      const stampX = cx + pose.w * 0.65;
      const stampY = cy - pose.h * 0.4;
      fx.save();
      fx.translate(stampX, stampY);
      fx.rotate(pose.angle - 0.15 + Math.sin(t * 0.008) * 0.04);

      // Speed drop shadow
      fx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      fx.fillText('ドォォン!!', 4, 4);

      // Primary bold stroke & fill
      fx.strokeStyle = '#000000';
      fx.lineWidth = Math.max(4, Math.round(w * 0.008));
      fx.strokeText('ドォォン!!', 0, 0);
      fx.fillStyle = '#ffffff';
      fx.fillText('ドォォン!!', 0, 0);
      fx.restore();

      // Comic action panel border
      fx.strokeStyle = '#000000';
      fx.lineWidth = Math.max(4, Math.round(w * 0.008));
      fx.strokeRect(0, 0, w, h);
      fx.restore();
    }
  },

  /* ============================ FUN & Y2K ============================ */
  {
    id: 'y2k_fairy', name: 'Y2K Glitter Fairy', icon: '💖', category: 'Fun', perf: 'low', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Dreamy Y2K pastel pink wash
      fx.filter = 'contrast(1.08) brightness(1.1) saturate(1.35) hue-rotate(330deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Soft glow aura around head
      fx.globalCompositeOperation = 'screen';
      const pinkGrad = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.4, pose.cx, pose.cy, Math.max(w, h) * 0.65);
      pinkGrad.addColorStop(0, 'rgba(251, 207, 232, 0.32)');
      pinkGrad.addColorStop(1, 'rgba(244, 114, 182, 0.15)');
      fx.fillStyle = pinkGrad;
      fx.fillRect(0, 0, w, h);

      // Floating 3D metallic chrome hearts orbiting around head
      if (!this._hearts || this._hw !== w) {
        this._hw = w;
        this._hearts = Array.from({ length: 8 }, (_, i) => ({
          ang: (i * Math.PI * 2) / 8,
          s: Math.max(14, Math.round(w * 0.035)) + Math.random() * 10,
          speed: 0.0012 + Math.random() * 0.0006
        }));
      }

      for (let i = 0; i < this._hearts.length; i++) {
        const hr = this._hearts[i];
        const ang = t * hr.speed + hr.ang;
        const rx = Math.max(pose.w * 0.85, 70);
        const ry = Math.max(pose.h * 0.75, 60);
        const hx = pose.cx + Math.cos(ang) * rx;
        const hy = pose.cy + Math.sin(ang) * ry;

        fx.save();
        fx.translate(hx, hy);
        const sc = hr.s / 24;
        fx.scale(sc, sc);

        // Chrome metallic gradient heart
        const hg = fx.createLinearGradient(-12, -12, 12, 12);
        hg.addColorStop(0, '#fdf2f8');
        hg.addColorStop(0.3, '#f472b6');
        hg.addColorStop(0.7, '#ec4899');
        hg.addColorStop(1, '#be185d');
        fx.fillStyle = hg;

        fx.beginPath();
        fx.moveTo(0, 6);
        fx.bezierCurveTo(-12, -6, -20, 10, 0, 24);
        fx.bezierCurveTo(20, 10, 12, -6, 0, 6);
        fx.fill();

        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 1.5;
        fx.stroke();
        fx.restore();
      }

      // Twinkling 4-point Y2K cross star sparkles around face
      for (let i = 0; i < 9; i++) {
        const sx = ((pose.cx - pose.w * 0.7 + i * 42.4 + t * 0.02) % w);
        const sy = ((pose.cy - pose.h * 0.7 + i * 36.5 + Math.sin(t * 0.003 + i) * 25) % h);
        const tw = (Math.sin(t * 0.006 + i * 2) + 1) * 0.5;
        if (tw > 0.35) {
          const spk = Math.max(7, Math.round(w * 0.02)) * tw;
          fx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          fx.lineWidth = 1.8;
          fx.beginPath();
          fx.moveTo(sx - spk, sy); fx.lineTo(sx + spk, sy);
          fx.moveTo(sx, sy - spk); fx.lineTo(sx, sy + spk);
          fx.stroke();
        }
      }

      // Nostalgic Y2K camera overlay UI
      const fs = Math.max(10, Math.round(w * 0.022));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#fbcfe8';
      fx.textBaseline = 'top';
      fx.shadowColor = '#ec4899';
      fx.shadowBlur = 4;
      fx.fillText('[ PHOTO 03/24 ]', Math.round(w * 0.04), Math.round(h * 0.04));
      fx.textAlign = 'right';
      fx.fillText('💖 BATT 100%', w - Math.round(w * 0.04), Math.round(h * 0.04));

      fx.textAlign = 'center';
      fx.textBaseline = 'bottom';
      fx.fillText('✨ BEAUTY MODE · HIGH ✨', w / 2, h - Math.round(h * 0.04));
      fx.restore();
    }
  },

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
  {
    id: 'vintageshoot', name: 'Vintage Shoot', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* 1980s studio glamour photoshoot: soft warm diffusion, flattering skin tones */
      fx.filter = 'contrast(1.12) saturate(1.18) brightness(1.04) sepia(0.18)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.44, 'warm');

      /* Soft Studio Radial Lighting Vignette */
      const vig = fx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(255, 235, 205, 0.12)');
      vig.addColorStop(0.65, 'rgba(180, 110, 60, 0.08)');
      vig.addColorStop(1, 'rgba(25, 12, 5, 0.48)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);

      /* Authentic 35mm film grain overlay */
      applyFilmGrain(fx, w, h, 0.18);
      fx.restore();
    }
  },
  {
    id: 'trix400', name: 'Kodak Tri-X 400', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* High-contrast silver gelatin black-and-white film shoot */
      fx.filter = 'grayscale(1) contrast(1.48) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.26, 'bw');

      /* Rich 400-ISO film grain texture */
      applyFilmGrain(fx, w, h, 0.28);

      /* Corner falloff vignette */
      const vig = fx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },
  {
    id: 'fujifilm', name: 'Fuji Superia', icon: '📼', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* Japanese 35mm film: cool emerald shadows with rich warm skin highlights */
      fx.filter = 'contrast(1.18) saturate(1.32) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.32, 'warm');

      const tint = fx.createLinearGradient(0, 0, 0, h);
      tint.addColorStop(0, 'rgba(255, 220, 180, 0.12)');
      tint.addColorStop(0.7, 'rgba(34, 197, 94, 0.08)');
      tint.addColorStop(1, 'rgba(6, 95, 70, 0.22)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = tint;
      fx.fillRect(0, 0, w, h);

      applyFilmGrain(fx, w, h, 0.2);
      fx.restore();
    }
  },
  {
    id: 'daguerreotype', name: '1890s Antique', icon: '🏛️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* Antique Victorian tintype / daguerreotype with aged oval plate border */
      fx.filter = 'sepia(0.88) contrast(1.35) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const vig = fx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.7, 'rgba(60, 40, 20, 0.35)');
      vig.addColorStop(1, 'rgba(15, 8, 3, 0.85)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);

      applyFilmGrain(fx, w, h, 0.32);
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
    id: 'glitch', name: 'Cyber Glitch', icon: '⚡', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      // 1. Dynamic RGB Split / Chromatic Aberration
      const shiftMagnitude = (Math.random() < 0.25 ? 16 : 6) + Math.sin(t * 0.02) * 5;
      fx.save();
      fx.globalCompositeOperation = 'screen';
      
      // Magenta/Red channel shift
      fx.globalAlpha = 0.65;
      fx.filter = 'hue-rotate(300deg) saturate(2.4)';
      fx.drawImage(src, shiftMagnitude, 0, w, h);
      
      // Cyan/Blue channel shift
      fx.globalAlpha = 0.65;
      fx.filter = 'hue-rotate(160deg) saturate(2.4)';
      fx.drawImage(src, -shiftMagnitude, 0, w, h);
      fx.restore();

      // 2. Horizontal slice tear jitter
      const sliceCount = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const sy = Math.random() * h;
        const sh = 4 + Math.random() * 26;
        const dx = (Math.random() * 36 - 18) * (Math.random() < 0.5 ? 1 : -1);
        fx.drawImage(src, 0, sy, w, sh, dx, sy, w, sh);
      }

      // 3. Digital noise bars
      if (Math.random() < 0.45) {
        const barY = Math.random() * h;
        const barH = 2 + Math.random() * 10;
        fx.fillStyle = pick(['rgba(0, 255, 234, 0.4)', 'rgba(255, 0, 128, 0.4)', 'rgba(255, 255, 255, 0.3)']);
        fx.fillRect(0, barY, w, barH);
      }

      // 4. CRT Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1.5);
      }
    }
  },

  {
    id: 'cyberglitch', name: 'Cyberpunk HUD', icon: '🤖', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      // Cyberpunk Color Grade & Cyan/Magenta Edge Split
      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.45;
      const jx = Math.sin(t * 0.015) * 6;
      fx.filter = 'hue-rotate(180deg) saturate(2.2)';
      fx.drawImage(src, jx, 0, w, h);
      fx.restore();

      // Futuristic Holographic HUD Overlay
      fx.save();
      const cx = w / 2;
      const cy = h / 2;
      const reticleR = Math.min(w, h) * 0.22;

      // Center lock reticle
      fx.strokeStyle = 'rgba(0, 255, 234, 0.75)';
      fx.lineWidth = 1.5;
      fx.beginPath();
      fx.arc(cx, cy, reticleR, 0, Math.PI * 2);
      fx.stroke();

      // Reticle corner brackets
      fx.beginPath();
      fx.moveTo(cx - reticleR - 10, cy - 20); fx.lineTo(cx - reticleR - 10, cy - 35); fx.lineTo(cx - reticleR + 5, cy - 35);
      fx.moveTo(cx + reticleR + 10, cy - 20); fx.lineTo(cx + reticleR + 10, cy - 35); fx.lineTo(cx + reticleR - 5, cy - 35);
      fx.moveTo(cx - reticleR - 10, cy + 20); fx.lineTo(cx - reticleR - 10, cy + 35); fx.lineTo(cx - reticleR + 5, cy + 35);
      fx.moveTo(cx + reticleR + 10, cy + 20); fx.lineTo(cx + reticleR + 10, cy + 35); fx.lineTo(cx + reticleR - 5, cy + 35);
      fx.stroke();

      // Crosshairs
      fx.beginPath();
      fx.moveTo(cx - 12, cy); fx.lineTo(cx + 12, cy);
      fx.moveTo(cx, cy - 12); fx.lineTo(cx, cy + 12);
      fx.stroke();

      // HUD Telemetry Text
      fx.font = '700 11px monospace';
      fx.fillStyle = 'rgba(0, 255, 234, 0.9)';
      fx.fillText('SYS // CYBER-LINK 2.4.9', 16, 28);
      fx.fillText('STATUS: TARGET LOCKED [98.4%]', 16, 44);

      fx.fillStyle = 'rgba(255, 0, 128, 0.9)';
      const sec = Math.floor(t / 1000);
      fx.fillText(`FPS: 60 // SYNC: ${sec % 60}s`, Math.max(16, w - 175), 28);
      fx.fillText('OPTICS: NEURAL-EYE v3', Math.max(16, w - 175), 44);

      // Bottom cyber grid accents
      fx.strokeStyle = 'rgba(255, 0, 128, 0.4)';
      fx.strokeRect(16, h - 36, 120, 20);
      fx.fillStyle = 'rgba(255, 0, 128, 0.2)';
      fx.fillRect(16, h - 36, 60 + Math.sin(t * 0.005) * 40, 20);
      fx.fillStyle = '#ffffff';
      fx.fillText('CORE: OPTIMAL', 24, h - 22);

      // Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1);
      }
      fx.restore();
    }
  },

  {
    id: 'datamosh', name: 'Datamosh FX', icon: '🌀', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);

      // Macroblock compression tearing simulation
      const blockCount = 8 + Math.floor(Math.random() * 8);
      const blockSize = 32 + ((Math.random() * 32) | 0);
      for (let i = 0; i < blockCount; i++) {
        const bx = Math.floor(Math.random() * (w / blockSize)) * blockSize;
        const by = Math.floor(Math.random() * (h / blockSize)) * blockSize;
        const shiftX = (Math.random() < 0.5 ? 1 : -1) * (16 + Math.random() * 32);
        fx.drawImage(src, bx, by, blockSize, blockSize, bx + shiftX, by, blockSize, blockSize);
      }

      // Chroma ghosting displacement
      if (Math.random() < 0.6) {
        fx.save();
        fx.globalCompositeOperation = 'difference';
        fx.globalAlpha = 0.35;
        fx.drawImage(src, (Math.random() * 12 - 6), (Math.random() * 6 - 3), w, h);
        fx.restore();
      }

      // Codec data burst stripe
      if (Math.random() < 0.3) {
        const stY = Math.random() * h;
        fx.fillStyle = 'rgba(0, 255, 128, 0.35)';
        fx.fillRect(0, stY, w, 6);
      }
    }
  },

  {
    id: 'anamorphic', name: 'Anamorphic Cine', icon: '💎', category: 'Classic', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      // Base frame with cinematic grade
      fx.save();
      fx.filter = 'contrast(1.15) saturate(1.22)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      // Hollywood Anamorphic Cyan Flare Streak
      fx.save();
      fx.globalCompositeOperation = 'screen';
      const streakY = h * (0.45 + Math.sin(t * 0.001) * 0.06);
      const flare = fx.createLinearGradient(0, streakY - 14, 0, streakY + 14);
      flare.addColorStop(0, 'rgba(6, 182, 212, 0)');
      flare.addColorStop(0.5, 'rgba(56, 189, 248, 0.65)');
      flare.addColorStop(1, 'rgba(6, 182, 212, 0)');
      fx.fillStyle = flare;
      fx.fillRect(0, streakY - 14, w, 28);

      // Intense core highlight
      fx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      fx.fillRect(w * 0.1, streakY - 1.5, w * 0.8, 3);

      // Subtle anamorphic vignette
      const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  },

  {
    id: 'retrowave', name: '80s Retrowave', icon: '🌆', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.25) saturate(1.4) hue-rotate(275deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      // Neon purple horizon gradient
      fx.save();
      const horizonY = h * 0.65;
      const sunset = fx.createLinearGradient(0, horizonY, 0, h);
      sunset.addColorStop(0, 'rgba(236, 72, 153, 0.1)');
      sunset.addColorStop(1, 'rgba(168, 85, 247, 0.35)');
      fx.fillStyle = sunset;
      fx.fillRect(0, horizonY, w, h - horizonY);

      // Neon perspective wireframe grid on lower third
      fx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      fx.lineWidth = 1.5;
      const speed = (t * 0.05) % 30;
      for (let y = horizonY + speed; y < h; y += 24) {
        fx.beginPath();
        fx.moveTo(0, y);
        fx.lineTo(w, y);
        fx.stroke();
      }
      // Perspective rays
      const vcx = w / 2;
      for (let x = -w * 0.5; x <= w * 1.5; x += w / 8) {
        fx.beginPath();
        fx.moveTo(vcx, horizonY);
        fx.lineTo(x, h);
        fx.stroke();
      }

      // Scanlines & CRT timestamp
      fx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      fx.font = '700 14px "Courier New", monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fillText('PLAY ▶ 00:84:19', 16, 26);
      fx.restore();
    }
  },

  {
    id: 'super8', name: 'Super 8mm Film', icon: '🎞️', category: 'Vintage', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      // Kodachrome warm color tone
      fx.filter = 'sepia(0.35) contrast(1.18) brightness(1.05) saturate(1.25)';
      // Projector frame gate jitter
      const jitterY = (Math.sin(t * 0.03) * 1.5) | 0;
      fx.drawImage(src, 0, jitterY, w, h);
      fx.restore();

      // Film scratches
      fx.save();
      if (Math.random() < 0.8) {
        fx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        fx.lineWidth = 1;
        const sx = Math.random() * w;
        fx.beginPath();
        fx.moveTo(sx, 0);
        fx.lineTo(sx + (Math.random() * 4 - 2), h);
        fx.stroke();
      }

      // Moving dust particles
      fx.fillStyle = 'rgba(15, 15, 15, 0.5)';
      for (let i = 0; i < 5; i++) {
        fx.beginPath();
        fx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
        fx.fill();
      }

      // Vintage film gate rounded vignette border
      fx.lineWidth = 18;
      fx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      fx.strokeRect(0, 0, w, h);
      fx.restore();
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
    id: 'golden_flare', name: 'Golden Flare', icon: '🌅', category: 'Vintage', perf: 'low',
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
    id: 'disco_lasers', name: 'Disco Lasers', icon: '🪩', category: 'Fun', perf: 'low',
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





