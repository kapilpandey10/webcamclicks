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

export const asciiEffect = {
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
  };

export default asciiEffect;
