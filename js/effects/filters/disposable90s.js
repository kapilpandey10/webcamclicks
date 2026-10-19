/* WebcamClicks — disposable90s 2D filter effect */

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

export const disposable90sEffect = {
    id: 'disposable90s', name: '90s Disposable', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.28) saturate(1.35) brightness(1.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const flashGrad = fx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.25, w / 2, h * 0.45, Math.max(w, h) * 0.7);
      flashGrad.addColorStop(0, 'rgba(255, 255, 240, 0.16)');
      flashGrad.addColorStop(0.65, 'rgba(0, 20, 10, 0.1)');
      flashGrad.addColorStop(1, 'rgba(0, 30, 20, 0.6)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = flashGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      fx.globalCompositeOperation = 'color';
      fx.globalAlpha = 0.14;
      fx.fillStyle = '#065f46';
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.22);
      drawDateStamp(fx, w, h);
    }
  };

export default disposable90sEffect;
