/* WebcamClicks — ghost 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const ghostEffect = {
  id: 'ghost', name: 'Ghost', icon: '👻', category: 'Fun', perf: 'medium',
  render(fx, { src, width, height, time }) {
    fx.filter = 'saturate(0.3) brightness(1.2) contrast(0.9)';
    fx.globalAlpha = 0.7;
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    fx.globalAlpha = 1;
    // Offset ghost trail
    const offset = Math.sin(time * 0.003) * 12;
    fx.globalAlpha = 0.35;
    fx.filter = 'hue-rotate(180deg)';
    fx.drawImage(src, offset, offset, width, height);
    fx.filter = 'none';
    fx.globalAlpha = 1;
  }
};

export default ghostEffect;