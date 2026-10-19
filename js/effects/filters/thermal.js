/* WebcamClicks — thermal 2D filter effect */

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

export const thermalEffect = {
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
  };

export default thermalEffect;
