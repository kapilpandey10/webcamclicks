/* WebcamClicks — mirrorQuad 2D filter effect */

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

export const mirrorQuadEffect = {
    id: 'mirrorQuad', name: 'Mirror Quad', icon: '🔲', category: 'Mirror', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      const hh = h / 2;
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
      fx.save();
      fx.translate(0, h);
      fx.scale(1, -1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
      fx.save();
      fx.translate(w, h);
      fx.scale(-1, -1);
      fx.drawImage(src, 0, 0, hw, hh, 0, 0, hw, hh);
      fx.restore();
    }
  };

export default mirrorQuadEffect;
