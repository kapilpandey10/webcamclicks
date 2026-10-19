/* WebcamClicks — pastel 2D filter effect */

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

export const pastelEffect = {
    id: 'pastel', name: 'Pastel', icon: '🎀', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'blur(0.6px) saturate(1.35) brightness(1.16) contrast(0.92)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
    }
  };

export default pastelEffect;
