/* WebcamClicks — studioportrait 2D filter effect */

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

export const studioportraitEffect = {
    id: 'studioportrait', name: 'Studio Spotlight', icon: '🎭', category: 'Portrait', perf: 'low', requiresFace: true,
    render(fx, frame) {
      renderPortraitBokeh(fx, frame, true);
    }
  };

export default studioportraitEffect;
