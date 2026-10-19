/* WebcamClicks — dreamtrails 2D filter effect */

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

export const dreamtrailsEffect = {
    id: 'dreamtrails', name: 'Dream Trails', icon: '🌀', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      renderDreamTrails(fx, src, w, h);
    }
  };

export default dreamtrailsEffect;
