/* WebcamClicks — bloom 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const bloomEffect = {
  id: 'bloom', name: 'Bloom', icon: '✨', category: 'Art', perf: 'medium',
  render(fx, { src, width, height }) {
    fx.filter = 'brightness(1.25) contrast(1.15) saturate(1.3)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Soft bloom overlay
    const b = getBloomCanvas(fx, width, height);
    fx.globalAlpha = 0.35;
    fx.drawImage(b, 0, 0, width, height);
    fx.globalAlpha = 1;
  }
};

export default bloomEffect;