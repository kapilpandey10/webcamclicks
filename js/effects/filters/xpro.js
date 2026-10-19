/* WebcamClicks — xpro 2D filter effect */

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

export const xproEffect = {
    id: 'xpro', name: 'X-Pro', icon: '🧪', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'hue-rotate(350deg) saturate(1.65) contrast(1.22) brightness(1.03)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
    }
  };

export default xproEffect;
