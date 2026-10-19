/* WebcamClicks — hollywood 2D filter effect */

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

export const hollywoodEffect = {
    id: 'hollywood', name: 'Hollywood Cinema', icon: '🎬', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'contrast(1.22) saturate(1.26) brightness(0.98)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.28, 'hollywood');

      fx.save();
      const toGrad = fx.createLinearGradient(0, 0, 0, h);
      toGrad.addColorStop(0, 'rgba(255, 140, 40, 0.16)');
      toGrad.addColorStop(0.65, 'rgba(255, 110, 20, 0.12)');
      toGrad.addColorStop(1, 'rgba(0, 160, 190, 0.24)');
      fx.globalCompositeOperation = 'color-dodge';
      fx.globalAlpha = 0.42;
      fx.fillStyle = toGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      drawAnamorphicStreak(fx, src, w, h, t);

      const barH = Math.round(h * 0.11);
      fx.fillStyle = '#05070a';
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.14);
    }
  };

export default hollywoodEffect;
