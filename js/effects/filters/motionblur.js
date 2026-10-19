/* WebcamClicks — motionblur 2D filter effect */

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

export const motionblurEffect = {
    id: 'motionblur', name: 'Motion Blur', icon: '💫', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      renderShutterMotion(fx, src, w, h, 0.74);
    }
  };

export default motionblurEffect;
