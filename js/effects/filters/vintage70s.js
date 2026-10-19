/* WebcamClicks — vintage70s 2D filter effect */

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

export const vintage70sEffect = {
    id: 'vintage70s', name: '1970s Film', icon: '📽️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.filter = 'sepia(0.24) contrast(1.2) saturate(1.3) brightness(1.04)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      fx.globalCompositeOperation = 'screen';
      const leak = fx.createLinearGradient(0, 0, w * 0.55, h * 0.6);
      leak.addColorStop(0, 'rgba(255, 120, 40, 0.35)');
      leak.addColorStop(0.35, 'rgba(255, 200, 70, 0.22)');
      leak.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = leak;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      fx.save();
      const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(50, 25, 0, 0.55)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.25);
    }
  };

export default vintage70sEffect;
