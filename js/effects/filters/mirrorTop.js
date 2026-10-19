/* WebcamClicks — mirrorTop 2D filter effect */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  pixelPass,
  lumOf,
  addNoise,
  getGrainPattern,
  applyFilmGrain,
  getBloomCanvas,
  renderHalationBloom,
  drawDateStamp,
  drawAnamorphicStreak,
  drawBackgroundBokehDiscs,
  renderShutterMotion,
  renderDreamTrails,
  renderPortraitBokeh,
  getFisheyeBuffers,
  renderFisheye,
  renderFlirThermal,
  renderNeonEdgePass,
  drawCausticRays,
  renderLiquidRainbowPass,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';

export const mirrorTopEffect = {
    id: 'mirrorTop', name: 'Mirror Top', icon: '⬆️', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hh = h / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.scale(1, -1);
      fx.drawImage(src, 0, hh, w, hh, 0, -hh, w, hh);
      fx.restore();
    }
  };

export default mirrorTopEffect;
