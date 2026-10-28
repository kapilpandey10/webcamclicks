/* WebcamClicks — color ghost 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const colorGhostEffect = {
  id: 'color_ghost', name: 'Color Ghost', icon: '👻', category: 'Fun', perf: 'low',
  render(fx, { src, width, height }) {
    fx.globalAlpha = 0.85;
    fx.filter = 'saturate(1.4) hue-rotate(200deg) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    fx.globalAlpha = 1;
  }
};

export default colorGhostEffect;