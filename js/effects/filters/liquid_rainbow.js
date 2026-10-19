/* WebcamClicks — liquid_rainbow 2D filter effect */

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

export const liquidRainbowEffect = {
    id: 'liquid_rainbow', name: 'Liquid Rainbow Chrome', icon: '🌈', category: 'Art', perf: 'high', requiresFace: true,
    render(fx, frame) {
      renderLiquidRainbowPass(fx, frame.src, frame.width, frame.height, frame.time || frame.now || 0);
    }
  };

export default liquidRainbowEffect;
