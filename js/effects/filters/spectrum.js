/* WebcamClicks — spectrum 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const spectrumEffect = {
  id: 'spectrum', name: 'Spectrum', icon: '🌈', category: 'Art', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(2.0) hue-rotate(180deg) contrast(1.3) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
  }
};

export default spectrumEffect;