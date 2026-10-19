/* WebcamClicks — softblur 2D filter effect */

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

export const softblurEffect = {
    id: 'softblur', name: 'Soft Focus', icon: '🌫️', category: 'Portrait', perf: 'low',
    render(fx, { src, width, height }) {
      fx.filter = 'blur(5px) brightness(1.08)';
      fx.drawImage(src, 0, 0, width, height);
      fx.filter = 'none';
      fx.globalAlpha = 0.55;
      fx.drawImage(src, 0, 0, width, height);
      fx.globalAlpha = 1;
    }
  };

export default softblurEffect;
