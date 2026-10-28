/* WebcamClicks — outline 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const outlineEffect = {
  id: 'outline', name: 'Outline', icon: '📐', category: 'Art', perf: 'medium',
  render(fx, { src, width, height }) {
    // High-contrast edge outline effect
    fx.filter = 'grayscale(1) contrast(10) brightness(0.5)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Fill negative space
    fx.fillStyle = 'rgba(255,255,255,0.9)';
    fx.globalCompositeOperation = 'source-atop';
    fx.fillRect(0, 0, width, height);
    fx.globalCompositeOperation = 'source-over';
  }
};

export default outlineEffect;