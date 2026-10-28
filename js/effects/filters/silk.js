/* WebcamClicks — silk 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const silkEffect = {
  id: 'silk', name: 'Silk', icon: '🧶', category: 'Art', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'blur(1.2) contrast(1.1) saturate(0.9) brightness(1.05)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
  }
};

export default silkEffect;