/* WebcamClicks — bright 2D filter effect */

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

export const brightEffect = {
    id: 'bright', name: 'Soft Glow', icon: '💡', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'brightness(1.25) contrast(1.06) saturate(1.1)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  };

export default brightEffect;
