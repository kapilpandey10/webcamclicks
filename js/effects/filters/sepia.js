/* WebcamClicks — sepia 2D filter effect */

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

export const sepiaEffect = {
    id: 'sepia', name: 'Sepia', icon: '🟤', category: 'Classic', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'sepia(0.85)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  };

export default sepiaEffect;
