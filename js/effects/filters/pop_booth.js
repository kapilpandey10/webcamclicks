/* WebcamClicks — pop booth 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const popBoothEffect = {
  id: 'pop_booth', name: 'Pop Booth', icon: '📸', category: 'Fun', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(1.6) contrast(1.25) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Polaroid-style frame
    const pad = Math.min(width, height) * 0.05;
    const bottomPad = Math.min(width, height) * 0.14;
    fx.fillStyle = '#fdfdfd';
    fx.fillRect(0, 0, width, height);
    fx.fillStyle = '#fff';
    fx.fillRect(pad, pad, width - pad * 2, height - pad - bottomPad);
    // Draw image inside frame
    fx.drawImage(src, pad, pad, width - pad * 2, height - pad - bottomPad);
  }
};

export default popBoothEffect;