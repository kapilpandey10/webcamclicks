/* WebcamClicks — trail 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

let TRAIL_FRAME = null;
export const trailEffect = {
  id: 'trail', name: 'Trail', icon: '🌠', category: 'Art', perf: 'medium',
  render(fx, { src, width, height }) {
    if (!TRAIL_FRAME || TRAIL_FRAME.width !== width || TRAIL_FRAME.height !== height) {
      TRAIL_FRAME = makeCanvas(width, height);
    }
    const ctx = TRAIL_FRAME.getContext('2d');
    ctx.globalAlpha = 0.55;
    ctx.drawImage(TRAIL_FRAME, 0, 0);
    ctx.globalAlpha = 1;
    ctx.drawImage(fx.canvas, 0, 0);
    fx.drawImage(TRAIL_FRAME, 0, 0);
  }
};

export default trailEffect;