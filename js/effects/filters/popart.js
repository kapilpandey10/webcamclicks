/* WebcamClicks — popart 2D filter effect */

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

export const popartEffect = {
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
  };

export default popartEffect;
