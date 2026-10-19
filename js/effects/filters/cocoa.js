/* WebcamClicks — cocoa 2D filter effect */

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

export const cocoaEffect = {
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
  };

export default cocoaEffect;
