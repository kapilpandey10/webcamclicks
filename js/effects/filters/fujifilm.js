/* WebcamClicks — fujifilm 2D filter effect */

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

export const fujifilmEffect = {
    id: 'fujifilm', name: 'Fuji Superia', icon: '📼', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* Japanese 35mm film: cool emerald shadows with rich warm skin highlights */
      fx.filter = 'contrast(1.18) saturate(1.32) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.32, 'warm');

      const tint = fx.createLinearGradient(0, 0, 0, h);
      tint.addColorStop(0, 'rgba(255, 220, 180, 0.12)');
      tint.addColorStop(0.7, 'rgba(34, 197, 94, 0.08)');
      tint.addColorStop(1, 'rgba(6, 95, 70, 0.22)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = tint;
      fx.fillRect(0, 0, w, h);

      applyFilmGrain(fx, w, h, 0.2);
      fx.restore();
    }
  };

export default fujifilmEffect;
