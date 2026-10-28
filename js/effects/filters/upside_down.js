/* WebcamClicks — upside-down 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const upsideDownEffect = {
  id: 'upside_down', name: 'Upside-Down', icon: '🙃', category: 'Mirror', perf: 'low',
  render(fx, { src, width, height }) {
    fx.save();
    fx.translate(0, height);
    fx.scale(1, -1);
    fx.drawImage(src, 0, 0, width, height);
    fx.restore();
  }
};

export default upsideDownEffect;