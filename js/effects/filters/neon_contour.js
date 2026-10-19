/* WebcamClicks — neon_contour 2D filter effect */

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

export const neonContourEffect = {
    id: 'neon_contour', name: 'Neon Cyber Contour', icon: '⚡', category: 'Sci-Fi', perf: 'high', requiresFace: true,
    render(fx, frame) {
      renderNeonEdgePass(fx, frame.src, frame.width, frame.height, frame.time || frame.now || 0);
    }
  };

export default neonContourEffect;
