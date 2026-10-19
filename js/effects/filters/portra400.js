/* WebcamClicks — portra400 2D filter effect */

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

export const portra400Effect = {
    id: 'portra400', name: 'Kodak Portra 400', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.14) brightness(1.06) saturate(1.26)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.38, 'warm');

      fx.save();
      const filmGrad = fx.createLinearGradient(0, 0, w, h);
      filmGrad.addColorStop(0, 'rgba(255, 215, 110, 0.24)');
      filmGrad.addColorStop(0.5, 'rgba(255, 185, 90, 0.14)');
      filmGrad.addColorStop(1, 'rgba(0, 175, 185, 0.16)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = filmGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      const vig = fx.createRadialGradient(w * 0.48, h * 0.44, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.76);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.68, 'rgba(130, 70, 10, 0.14)');
      vig.addColorStop(1, 'rgba(40, 20, 0, 0.48)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.2);
    }
  };

export default portra400Effect;
