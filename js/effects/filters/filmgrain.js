/* WebcamClicks — filmgrain 2D filter effect */

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

export const filmgrainEffect = {
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
  };

export default filmgrainEffect;
