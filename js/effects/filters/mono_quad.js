/* WebcamClicks — mono quad 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const monoQuadEffect = {
  id: 'mono_quad', name: 'Mono Quad', icon: '◻️', category: 'Mirror', perf: 'low',
  render(fx, { src, width, height }) {
    const hw = width * 0.5, hh = height * 0.5;
    fx.filter = 'grayscale(1) contrast(1.2)';
    // Draw 4 quadrants mirrored
    fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
    fx.save(); fx.scale(-1, 1); fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh); fx.restore();
    fx.save(); fx.scale(1, -1); fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh); fx.restore();
    fx.save(); fx.scale(-1, -1); fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh); fx.restore();
    fx.filter = 'none';
  }
};

export default monoQuadEffect;