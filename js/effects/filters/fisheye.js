/* WebcamClicks — fisheye 2D filter effect */

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

export const fisheyeEffect = {
    id: 'fisheye', name: 'Y2K Fisheye', icon: '🛹', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      renderFisheye(fx, src, w, h);
    }
  };

export default fisheyeEffect;
