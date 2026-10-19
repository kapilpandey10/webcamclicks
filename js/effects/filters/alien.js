/* WebcamClicks — alien 2D filter effect */

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

export const alienEffect = {
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
  };

export default alienEffect;
