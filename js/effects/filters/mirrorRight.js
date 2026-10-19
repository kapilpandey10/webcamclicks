/* WebcamClicks — mirrorRight 2D filter effect */

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

export const mirrorRightEffect = {
    id: 'mirrorRight', name: 'Mirror Right', icon: '↔️', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      fx.drawImage(src, 0, 0, w, h);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.drawImage(src, 0, 0, hw, h, 0, 0, hw, h);
      fx.restore();
    }
  };

export default mirrorRightEffect;
