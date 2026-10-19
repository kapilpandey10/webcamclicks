/* WebcamClicks — neonnoir 2D filter effect */

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

export const neonnoirEffect = {
    id: 'neonnoir', name: 'Neon Noir', icon: '🌆', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'contrast(1.35) saturate(1.5) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const neonGrad = fx.createLinearGradient(0, 0, w, 0);
      neonGrad.addColorStop(0, 'rgba(236, 72, 153, 0.28)');
      neonGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      neonGrad.addColorStop(1, 'rgba(6, 182, 212, 0.32)');
      fx.globalCompositeOperation = 'color-dodge';
      fx.fillStyle = neonGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      drawAnamorphicStreak(fx, src, w, h, t);

      const barH = Math.round(h * 0.09);
      fx.fillStyle = '#06080d';
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.18);
    }
  };

export default neonnoirEffect;
