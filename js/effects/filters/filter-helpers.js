/* WebcamClicks — Canvas 2D effect library (part 1 of 4).
   Every effect object: { id, name, icon, category, perf, render(fx, frame) }
   `frame` = { src, width, height, time, dt, face, motion, camera } */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';

/* ---------- shared scratch canvas (reused for pixel passes) ---------- */
let SCRATCH = null;
export function ensureScratch(w, h) {
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
export function pixelPass(fx, src, fn) {
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

export const lumOf = (r, g, b) => r * 0.299 + g * 0.587 + b * 0.114;

/* ---------- noise helper ---------- */
export function addNoise(data, amount, mono = true) {
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
export function getGrainPattern(ctx) {
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

export function applyFilmGrain(fx, w, h, opacity = 0.18) {
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
export function getBloomCanvas(w, h) {
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

export function renderHalationBloom(fx, src, w, h, strength = 0.38, tint = 'warm') {
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
export function drawDateStamp(fx, w, h) {
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
export function drawAnamorphicStreak(fx, src, w, h, t) {
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
export function drawBackgroundBokehDiscs(fx, w, h, t) {
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
export function renderShutterMotion(fx, src, w, h, decay = 0.74) {
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
export function renderDreamTrails(fx, src, w, h) {
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
export function renderPortraitBokeh(fx, frame, isSpotlight = false) {
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

export function getFisheyeBuffers(bw, bh) {
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

export function renderFisheye(fx, src, w, h) {
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
export function renderFlirThermal(fx, src, w, h) {
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
export function renderNeonEdgePass(fx, src, w, h, t) {
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
export function drawCausticRays(fx, w, h, t) {
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
export function renderLiquidRainbowPass(fx, src, w, h, t) {
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
export function getHeadPose(frame) {
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

export function smoothPose(effect, p, dt = 16.7, smoothMs = 35) {
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
