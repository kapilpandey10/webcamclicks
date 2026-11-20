/* WebcamClicks — ascii 2D filter effect */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  pixelPass,
  lumOf,
  addNoise,
  getGrainPattern,
  applyFilmGrain,
  getBloomCanvas,
  renderHalationBloom,
  drawDateStamp,
  drawAnamorphicStreak,
  drawBackgroundBokehDiscs,
  renderShutterMotion,
  renderDreamTrails,
  renderPortraitBokeh,
  getFisheyeBuffers,
  renderFisheye,
  renderFlirThermal,
  renderNeonEdgePass,
  drawCausticRays,
  renderLiquidRainbowPass,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';

const RAMP = " .'`^\",:;Il!i><~+_-?][}{1)(|/tfjrxnuvczXYUJCLQ0OZmwqpdbkhao*#MW&8%B@$";
const TONES = ['#0f5d36', '#22a35c', '#4dffa0', '#e8fff2'];   // dim → bright phosphor
let lumBuf = new Float32Array(0);

export const asciiEffect = {
    id: 'ascii', name: 'ASCII Art', icon: '⌨️', category: 'Art', perf: 'medium',
    description: 'Live terminal-style ASCII art with auto-levels, a 70-character density ramp and glowing phosphor tones.',
    render(fx, { src, width: w, height: h }) {
      const rows = isMobile() ? 40 : 56;
      const cellH = h / rows;
      fx.font = `700 ${cellH.toFixed(2)}px "Courier New", ui-monospace, monospace`;
      const cellW = Math.max(2, fx.measureText('M').width);
      const cols = Math.max(8, Math.floor(w / cellW));
      const sc = ensureScratch(cols, rows);
      sc.gx.drawImage(src, 0, 0, cols, rows);
      const d = sc.gx.getImageData(0, 0, cols, rows).data;

      // auto-levels: stretch the frame's own 2nd–98th percentile range to the full ramp
      const n = cols * rows;
      if (lumBuf.length !== n) lumBuf = new Float32Array(n);
      const hist = new Uint32Array(64);
      for (let i = 0, p = 0; i < n; i++, p += 4) {
        const l = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) / 255;
        lumBuf[i] = l;
        hist[Math.min(63, (l * 64) | 0)]++;
      }
      let acc = 0, lo = 0, hi = 1;
      for (let b = 0; b < 64; b++) { acc += hist[b]; if (acc >= n * 0.02) { lo = b / 64; break; } }
      acc = 0;
      for (let b = 63; b >= 0; b--) { acc += hist[b]; if (acc >= n * 0.02) { hi = (b + 1) / 64; break; } }
      const span = Math.max(0.08, hi - lo);

      // dark terminal with a faint ghost of the picture for depth
      fx.fillStyle = '#020604';
      fx.fillRect(0, 0, w, h);
      fx.globalAlpha = 0.16;
      fx.drawImage(src, 0, 0, w, h);
      fx.globalAlpha = 1;

      fx.textBaseline = 'top';
      const xOff = (w - cols * cellW) / 2;
      const last = RAMP.length - 1;
      const lines = TONES.map(() => new Array(cols));
      for (let y = 0; y < rows; y++) {
        for (let t = 0; t < TONES.length; t++) lines[t].fill(' ');
        for (let x = 0; x < cols; x++) {
          let v = (lumBuf[y * cols + x] - lo) / span;
          v = Math.pow(Math.min(1, Math.max(0, v)), 0.85);
          const ch = RAMP[Math.round(v * last)];
          const tone = Math.min(TONES.length - 1, (v * TONES.length) | 0);
          lines[tone][x] = ch;
        }
        for (let t = 0; t < TONES.length; t++) {
          fx.fillStyle = TONES[t];
          fx.shadowColor = t >= 2 ? 'rgba(77,255,160,0.55)' : 'transparent';
          fx.shadowBlur = t >= 2 ? cellH * 0.5 : 0;
          fx.fillText(lines[t].join(''), xOff, y * cellH);
        }
      }
      fx.shadowBlur = 0;
      fx.shadowColor = 'transparent';
      // CRT scanlines
      fx.fillStyle = 'rgba(0,0,0,0.18)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
    }
  };

export default asciiEffect;
