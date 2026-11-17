/* WebcamClicks — "Trending" effects.
   Original looks modelled on what people are actually shooting right now:
   Y2K CCD digicams, direct-flash party photos, risograph zines, dithered
   pixel art, dreamcore haze, tungsten night film, pixel sorting and toon shading.
   All are LUT / buffer based (see grade-core.js) and temporally stable — no flicker. */

import { isMobile } from '../../utils.js';
import { pixelPass } from './filter-helpers.js';
import {
  makeGrade, applyGrain, glowPass, vignette, workCanvas, fitDims, clamp8, gradePass
} from './grade-core.js';

// Working resolution for colour-grade passes: plenty for smooth tonal changes, cheap on phones
const GRADE_DIM = () => (isMobile() ? 480 : 640);

const pad2 = (n) => String(n).padStart(2, '0');

/* ======================= Y2K Digicam (CCD) ======================= */

const digicamGrade = makeGrade({
  master: [[0, 10], [50, 58], [128, 150], [196, 226], [232, 252], [255, 255]],
  r: [[0, 0], [128, 126], [255, 255]],
  b: [[0, 8], [128, 134], [255, 248]],
  shadows: [100, 140, 170],
  highlights: [150, 130, 140],
  split: 0.55,
  saturation: 1.14
});

let lumaBuf = new Float32Array(0);

function sharpenLuma(data, w, h, amount) {
  const n = w * h;
  if (lumaBuf.length !== n) lumaBuf = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) lumaBuf[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const p = y * w + x;
      const l = lumaBuf[p];
      const lap = 4 * l - lumaBuf[p - 1] - lumaBuf[p + 1] - lumaBuf[p - w] - lumaBuf[p + w];
      const k = Math.max(-40, Math.min(40, lap * amount));
      const i = p * 4;
      data[i] = clamp8(data[i] + k);
      data[i + 1] = clamp8(data[i + 1] + k);
      data[i + 2] = clamp8(data[i + 2] + k);
    }
  }
}

function drawDigicamStamp(fx, w, h) {
  const d = new Date();
  const str = `${d.getFullYear()}.${pad2(d.getMonth() + 1)}.${pad2(d.getDate())}  ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
  const size = Math.max(12, Math.round(w * 0.024));
  fx.save();
  fx.font = `600 ${size}px "Courier New", ui-monospace, monospace`;
  fx.textAlign = 'right';
  fx.textBaseline = 'bottom';
  fx.shadowColor = 'rgba(255,90,20,0.9)';
  fx.shadowBlur = size * 0.5;
  fx.fillStyle = '#ff8a2a';
  fx.fillText(str, w - w * 0.035, h - h * 0.035);
  fx.restore();
}

export const y2kDigicamEffect = {
  id: 'y2k_digicam', name: 'Y2K Digicam', icon: '📷', category: 'Trending', perf: 'medium',
  description: 'Early-2000s CCD point-and-shoot: bright, slightly clipped highlights, cool shadows, crunchy sensor sharpening, colour noise and an orange date stamp.',
  render(fx, { src, width: w, height: h, time }) {
    // Simulate a ~2–3 MP sensor: process at reduced resolution, then upscale
    const [sw, sh] = fitDims(w, h, isMobile() ? 400 : 560);
    const buf = workCanvas('digicam', sw, sh);
    buf.x.imageSmoothingEnabled = true;
    buf.x.drawImage(src, 0, 0, sw, sh);
    const img = buf.x.getImageData(0, 0, sw, sh);
    digicamGrade(img.data);
    sharpenLuma(img.data, sw, sh, 0.55);
    applyGrain(img.data, sw, sh, time, 7, 1.4);
    buf.x.putImageData(img, 0, 0);

    fx.imageSmoothingEnabled = true;
    fx.drawImage(buf.c, 0, 0, w, h);
    // Highlight blooming typical of small CCD sensors
    glowPass(fx, buf.c, w, h, { filter: 'brightness(0.85) contrast(2.6) blur(5px)', alpha: 0.32, scale: 3 });
    vignette(fx, w, h, 0.22, '0,0,0', 0.55);
    drawDigicamStamp(fx, w, h);
  }
};

/* ======================= Direct Flash ======================= */

// Soft-clipping exposure LUT: input 0..767 (boosted), output 0..255 with a filmic shoulder
const FLASH_CLIP = (() => {
  const t = new Uint8Array(768);
  for (let x = 0; x < 768; x++) {
    const v = x / 255;
    const y = v < 0.7 ? v : 0.7 + (1 - 0.7) * (1 - Math.exp(-(v - 0.7) / 0.3));
    t[x] = clamp8(y * 255);
  }
  return t;
})();

const flashGrade = makeGrade({
  master: [[0, 0], [40, 26], [128, 132], [220, 238], [255, 255]],
  r: [[0, 0], [128, 136], [255, 255]],
  b: [[0, 4], [128, 120], [255, 246]],
  saturation: 1.18
});

let flashGain = new Float32Array(0);
let flashKey = '';

export const directFlashEffect = {
  id: 'direct_flash', name: 'Direct Flash', icon: '⚡', category: 'Trending', perf: 'medium',
  description: 'The on-camera flash party look: a hot, bright subject, a background that falls off into darkness, punchy contrast and glossy highlights.',
  render(fx, frame) {
    const { src, width: w, height: h, time } = frame;
    gradePass(fx, src, w, h, GRADE_DIM(), 'flash', (data, pw, ph) => {
      // Inverse-square style falloff from the subject (cached per resolution)
      const key = pw + 'x' + ph;
      if (flashKey !== key) {
        flashKey = key;
        flashGain = new Float32Array(pw * ph);
        const cx = pw / 2;
        const cy = ph * 0.42;
        const r = Math.min(pw, ph) * 0.42;
        for (let y = 0; y < ph; y++) {
          for (let x = 0; x < pw; x++) {
            const dx = (x - cx) / r;
            const dy = (y - cy) / (r * 1.15);
            const d2 = dx * dx + dy * dy;
            flashGain[y * pw + x] = 0.32 + 1.18 / (1 + d2 * 1.6);
          }
        }
      }
      for (let p = 0, i = 0; p < flashGain.length; p++, i += 4) {
        const g = flashGain[p];
        data[i] = FLASH_CLIP[Math.min(767, (data[i] * g) | 0)];
        data[i + 1] = FLASH_CLIP[Math.min(767, (data[i + 1] * g) | 0)];
        data[i + 2] = FLASH_CLIP[Math.min(767, (data[i + 2] * g * 1.02) | 0)];
      }
      flashGrade(data);
      applyGrain(data, pw, ph, time, 6);
    });
    // Specular sheen on skin and shiny surfaces
    glowPass(fx, fx.canvas, w, h, { filter: 'brightness(0.8) contrast(3.2) blur(3px)', alpha: 0.38, scale: 4 });
    vignette(fx, w, h, 0.55, '0,0,0', 0.35);
  }
};

/* ======================= Risograph Print ======================= */

const PAPER = [246, 241, 230];
const INK_PINK = [255, 72, 176];
const INK_BLUE = [0, 120, 191];
let risoCopy = new Uint8ClampedArray(0);

/** Anti-aliased halftone coverage for a rotated dot grid. */
function dot(x, y, cos, sin, cell, coverage) {
  const u = x * cos + y * sin;
  const v = -x * sin + y * cos;
  const fu = u / cell - Math.floor(u / cell) - 0.5;
  const fv = v / cell - Math.floor(v / cell) - 0.5;
  const dist = Math.sqrt(fu * fu + fv * fv) * cell;
  const radius = Math.sqrt(coverage) * cell * 0.6; // dot area ≈ coverage
  const a = radius - dist + 0.5;
  return a <= 0 ? 0 : a >= 1 ? 1 : a;
}

export const risographEffect = {
  id: 'risograph', name: 'Risograph Print', icon: '🖨️', category: 'Trending', perf: 'high',
  description: 'Two-colour risograph zine print: fluorescent pink and blue halftone inks, slightly mis-registered, on warm uncoated paper.',
  render(fx, { src, width: w, height: h, time }) {
    const [rw, rh] = fitDims(w, h, isMobile() ? 400 : 540);
    const pre = workCanvas('riso-pre', rw, rh);
    pre.x.filter = 'contrast(1.15)';
    pre.x.drawImage(src, 0, 0, rw, rh);
    pre.x.filter = 'none';
    gradePass(fx, pre.c, w, h, Math.max(rw, rh), 'riso', (data, pw, ph) => {
      if (risoCopy.length !== data.length) risoCopy = new Uint8ClampedArray(data.length);
      risoCopy.set(data);
      const cell = Math.max(3, pw / 140);
      const a1 = (15 * Math.PI) / 180;
      const a2 = (75 * Math.PI) / 180;
      const c1 = Math.cos(a1), s1 = Math.sin(a1), c2 = Math.cos(a2), s2 = Math.sin(a2);
      // Mis-registration drifts very slowly, like paper feeding through a drum
      const ox = Math.round(2 + Math.sin(time * 0.0004) * 1.5);
      const oy = Math.round(1 + Math.cos(time * 0.0003) * 1.0);
      const kPink = [1 - INK_PINK[0] / 255, 1 - INK_PINK[1] / 255, 1 - INK_PINK[2] / 255];
      const kBlue = [1 - INK_BLUE[0] / 255, 1 - INK_BLUE[1] / 255, 1 - INK_BLUE[2] / 255];
      for (let y = 0; y < ph; y++) {
        const sy = Math.min(ph - 1, Math.max(0, y - oy));
        for (let x = 0; x < pw; x++) {
          const i = (y * pw + x) * 4;
          const sx = Math.min(pw - 1, Math.max(0, x - ox));
          const j = (sy * pw + sx) * 4;
          // Blue ink absorbs red, pink ink absorbs green — a natural two-ink separation
          const covBlue = Math.pow(Math.max(0, (1 - risoCopy[i] / 255) - 0.12) / 0.88, 1.35);
          const covPink = Math.min(1, Math.pow(Math.max(0, (1 - risoCopy[j + 1] / 255) - 0.06) / 0.94, 0.95) * 1.15);
          const pB = dot(x, y, c1, s1, cell, covBlue);
          const pP = dot(x, y, c2, s2, cell, covPink);
          for (let c = 0; c < 3; c++) {
            data[i + c] = PAPER[c] * (1 - pB * kBlue[c]) * (1 - pP * kPink[c]);
          }
        }
      }
      applyGrain(data, pw, ph, 0, 9); // static paper tooth
    });
  }
};

/* ======================= 1-Bit Dither ======================= */

const BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42, 48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38, 60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41, 51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37, 63, 31, 55, 23, 61, 29, 53, 21
].map((v) => (v + 0.5) / 64);

// Four-tone ramp: midnight ink -> violet -> rose -> cream
const RAMP = [[16, 14, 38], [76, 62, 116], [205, 110, 152], [250, 232, 200]];

export const ditherEffect = {
  id: 'dither', name: 'Pixel Dither', icon: '🟪', category: 'Trending', perf: 'low',
  description: 'Ordered Bayer dithering into a four-tone palette — the chunky, printed-pixel look from indie games and album art.',
  render(fx, { src, width: w, height: h }) {
    const [sw, sh] = fitDims(w, h, 320);
    const buf = workCanvas('dither', sw, sh);
    buf.x.filter = 'contrast(1.2) brightness(1.05)';
    buf.x.drawImage(src, 0, 0, sw, sh);
    buf.x.filter = 'none';
    const img = buf.x.getImageData(0, 0, sw, sh);
    const d = img.data;
    const levels = RAMP.length - 1;
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < sw; x++) {
        const i = (y * sw + x) * 4;
        const l = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) / 255;
        const v = l * levels;
        const base = Math.min(levels - 1, Math.floor(v));
        const idx = v - base > BAYER8[(y & 7) * 8 + (x & 7)] ? base + 1 : base;
        const c = RAMP[idx];
        d[i] = c[0]; d[i + 1] = c[1]; d[i + 2] = c[2];
      }
    }
    buf.x.putImageData(img, 0, 0);
    fx.imageSmoothingEnabled = false;
    fx.drawImage(buf.c, 0, 0, w, h);
    fx.imageSmoothingEnabled = true;
  }
};

/* ======================= Dreamcore Glow ======================= */

const dreamGrade = makeGrade({
  master: [[0, 34], [64, 84], [128, 146], [200, 212], [255, 242]],
  r: [[0, 6], [255, 255]],
  b: [[0, 18], [255, 250]],
  shadows: [150, 118, 190],
  highlights: [175, 140, 128],
  split: 0.7,
  saturation: 0.82
});

export const dreamcoreEffect = {
  id: 'dreamcore', name: 'Dreamcore Glow', icon: '🌫️', category: 'Trending', perf: 'medium',
  description: 'Soft, nostalgic dreamcore haze: lifted lavender shadows, peachy highlights, a heavy bloom and a hazy white edge.',
  render(fx, { src, width: w, height: h, time }) {
    gradePass(fx, src, w, h, GRADE_DIM(), 'dream', (data, pw, ph) => {
      dreamGrade(data);
      applyGrain(data, pw, ph, time, 5);
    });
    glowPass(fx, fx.canvas, w, h, { filter: 'brightness(1.1) blur(10px)', alpha: 0.42, scale: 4 });
    // Slight chromatic fringe for a lens-memory feel
    fx.save();
    fx.globalCompositeOperation = 'screen';
    fx.globalAlpha = 0.12;
    fx.filter = 'hue-rotate(-40deg) blur(1px)';
    fx.drawImage(src, w * 0.004, 0, w, h);
    fx.restore();
    vignette(fx, w, h, 0.55, '255,246,250', 0.42, 'screen');
  }
};

/* ======================= Night Tungsten 800 ======================= */

const tungstenGrade = makeGrade({
  master: [[0, 8], [60, 52], [128, 134], [200, 214], [255, 250]],
  r: [[0, 0], [128, 118], [255, 246]],
  g: [[0, 2], [128, 128], [255, 252]],
  b: [[0, 20], [128, 146], [255, 255]],
  shadows: [90, 150, 165],
  highlights: [160, 130, 120],
  split: 0.6,
  saturation: 1.08
});

export const nightTungstenEffect = {
  id: 'night_tungsten', name: 'Night Tungsten 800', icon: '🌃', category: 'Trending', perf: 'medium',
  description: 'Tungsten-balanced cinema film for night shots: cool teal shadows, red halation glowing around every light source, and visible grain.',
  render(fx, { src, width: w, height: h, time }) {
    gradePass(fx, src, w, h, GRADE_DIM(), 'tungsten', (data, pw, ph) => {
      tungstenGrade(data);
      applyGrain(data, pw, ph, time, 13);
    });
    // Red halation: tight core + wide spill around highlights
    glowPass(fx, src, w, h, { filter: 'brightness(0.7) contrast(4) saturate(0) blur(3px)', tint: '#ff3b1f', alpha: 0.55, scale: 3 });
    glowPass(fx, src, w, h, { filter: 'brightness(0.7) contrast(4) saturate(0) blur(6px)', tint: '#ff5a2a', alpha: 0.4, scale: 8 });
    vignette(fx, w, h, 0.35, '0,8,14', 0.5);
  }
};

/* ======================= Pixel Sort ======================= */

let sortKeys = new Uint32Array(0);
let sortCopy = new Uint8ClampedArray(0);

export const pixelSortEffect = {
  id: 'pixel_sort', name: 'Pixel Sort', icon: '🌈', category: 'Trending', perf: 'high',
  description: 'Glitch-art pixel sorting: bright regions melt downward in sorted streaks while the rest of the image stays intact.',
  render(fx, { src, width: w, height: h, time }) {
    const [sw, sh] = fitDims(w, h, isMobile() ? 300 : 420);
    const buf = workCanvas('pixelsort', sw, sh);
    buf.x.drawImage(src, 0, 0, sw, sh);
    const img = buf.x.getImageData(0, 0, sw, sh);
    const d = img.data;
    if (sortCopy.length !== d.length) sortCopy = new Uint8ClampedArray(d.length);
    sortCopy.set(d);
    if (sortKeys.length < sh) sortKeys = new Uint32Array(sh);
    // Threshold breathes slowly so the streaks grow and recede
    const lo = 0.42 + Math.sin(time * 0.0006) * 0.12;
    const hi = 0.97;
    for (let x = 0; x < sw; x++) {
      let y = 0;
      while (y < sh) {
        // find a span of pixels inside the brightness band
        let start = -1;
        for (; y < sh; y++) {
          const i = (y * sw + x) * 4;
          const l = (sortCopy[i] * 0.299 + sortCopy[i + 1] * 0.587 + sortCopy[i + 2] * 0.114) / 255;
          if (l >= lo && l <= hi) { if (start < 0) start = y; } else if (start >= 0) break;
        }
        if (start < 0) break;
        const end = y;
        const len = end - start;
        if (len > 3) {
          for (let k = 0; k < len; k++) {
            const i = ((start + k) * sw + x) * 4;
            const l = (sortCopy[i] * 77 + sortCopy[i + 1] * 150 + sortCopy[i + 2] * 29) >> 8;
            sortKeys[k] = ((255 - l) << 20) | k; // bright first -> drips downward into darker
          }
          const keys = sortKeys.subarray(0, len).sort();
          for (let k = 0; k < len; k++) {
            const srcRow = start + (keys[k] & 0xfffff);
            const si = (srcRow * sw + x) * 4;
            const di = ((start + k) * sw + x) * 4;
            d[di] = sortCopy[si]; d[di + 1] = sortCopy[si + 1]; d[di + 2] = sortCopy[si + 2];
          }
        }
        y = end + 1;
      }
    }
    buf.x.putImageData(img, 0, 0);
    fx.imageSmoothingEnabled = true;
    fx.drawImage(buf.c, 0, 0, w, h);
  }
};

/* ======================= Toon Shade ======================= */

let toonLuma = new Float32Array(0);

export const toonShadeEffect = {
  id: 'toon_shade', name: 'Toon Shade', icon: '🎨', category: 'Trending', perf: 'high',
  description: 'Cel-shaded cartoon look: smoothed skin, colour banded into flat shading steps and clean ink outlines.',
  render(fx, { src, width: w, height: h }) {
    fx.filter = 'blur(1.4px) saturate(1.3) contrast(1.05)';
    fx.drawImage(src, 0, 0, w, h);
    fx.filter = 'none';
    pixelPass(fx, fx.canvas, (data, pw, ph) => {
      const n = pw * ph;
      if (toonLuma.length !== n) toonLuma = new Float32Array(n);
      for (let p = 0, i = 0; p < n; p++, i += 4) toonLuma[p] = data[i] * 0.299 + data[i + 1] * 0.587 + data[i + 2] * 0.114;
      const bands = 5;
      for (let y = 0; y < ph; y++) {
        for (let x = 0; x < pw; x++) {
          const p = y * pw + x;
          const i = p * 4;
          const l = toonLuma[p] + 0.001;
          // smooth-stepped bands keep shading flat but not aliased
          const v = (l / 255) * bands;
          const f = v - Math.floor(v);
          const s = f < 0.85 ? 0 : (f - 0.85) / 0.15;
          const q = ((Math.floor(v) + s * s * (3 - 2 * s)) / bands) * 255 + 18;
          const k = q / l;
          let r = data[i] * k, g = data[i + 1] * k, b = data[i + 2] * k;
          // Sobel edge -> ink line
          if (x > 0 && y > 0 && x < pw - 1 && y < ph - 1) {
            const tl = toonLuma[p - pw - 1], tc = toonLuma[p - pw], tr = toonLuma[p - pw + 1];
            const ml = toonLuma[p - 1], mr = toonLuma[p + 1];
            const bl = toonLuma[p + pw - 1], bc = toonLuma[p + pw], br = toonLuma[p + pw + 1];
            const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
            const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
            const e = Math.sqrt(gx * gx + gy * gy);
            const ink = e < 70 ? 0 : Math.min(1, (e - 70) / 90);
            r = r * (1 - ink) + 22 * ink;
            g = g * (1 - ink) + 18 * ink;
            b = b * (1 - ink) + 32 * ink;
          }
          data[i] = clamp8(r); data[i + 1] = clamp8(g); data[i + 2] = clamp8(b);
        }
      }
    });
  }
};

export const trendingEffects = [
  y2kDigicamEffect,
  directFlashEffect,
  nightTungstenEffect,
  dreamcoreEffect,
  risographEffect,
  ditherEffect,
  pixelSortEffect,
  toonShadeEffect
];
