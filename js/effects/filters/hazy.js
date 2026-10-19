/* WebcamClicks — hazy 2D filter effect */

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

export const hazyEffect = {
    id: 'hazy', name: 'Hazy Days', icon: '🌅', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'brightness(1.18) contrast(0.74) saturate(0.88) sepia(0.18)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      const g = fx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,235,205,0.28)');
      g.addColorStop(0.55, 'rgba(255,235,205,0.04)');
      g.addColorStop(1, 'rgba(255,235,205,0.16)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default hazyEffect;
