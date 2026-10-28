/* WebcamClicks — filmstrip 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const filmstripEffect = {
  id: 'filmstrip', name: 'Filmstrip', icon: '🎞️', category: 'Classic', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(0.4) contrast(1.3) brightness(0.95)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Filmstrip borders
    const pad = Math.min(width, height) * 0.06;
    fx.fillStyle = '#1a1a1a';
    fx.fillRect(0, 0, width, pad);
    fx.fillRect(0, height - pad, width, pad);
    fx.fillRect(0, 0, pad, height);
    fx.fillRect(width - pad, 0, pad, height);
    // Sprocket holes
    fx.fillStyle = '#333';
    const hole = 6;
    for (let x = pad; x < width - pad; x += 24) {
      fx.fillRect(x, pad - hole, hole, hole);
      fx.fillRect(x, height - pad, hole, hole);
    }
  }
};

export default filmstripEffect;