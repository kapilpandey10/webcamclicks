/* WebcamClicks — switch 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const switchEffect = {
  id: 'switch', name: 'Switch', icon: '🔘', category: 'Fun', perf: 'medium',
  render(fx, { src, width, height, time }) {
    // Channel-switching RGB split effect
    const phase = (time * 0.002) % 1;
    fx.drawImage(src, 0, 0, width, height);
    fx.globalAlpha = 0.4;
    fx.globalCompositeOperation = 'lighter';
    fx.filter = 'none';
    if (phase < 0.33) {
      fx.fillStyle = 'rgba(255,0,0,0.5)';
    } else if (phase < 0.66) {
      fx.fillStyle = 'rgba(0,255,0,0.5)';
    } else {
      fx.fillStyle = 'rgba(0,0,255,0.5)';
    }
    fx.fillRect(0, 0, width, height);
    fx.globalCompositeOperation = 'source-over';
    fx.globalAlpha = 1;
  }
};

export default switchEffect;