/* WebcamClicks — cocktail 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const cocktailEffect = {
  id: 'cocktail', name: 'Cocktail', icon: '🍹', category: 'Fun', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(1.8) hue-rotate(280deg) contrast(1.2) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
  }
};

export default cocktailEffect;