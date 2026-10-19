/* WebcamClicks — vaporwave 2D filter effect */

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

export const vaporwaveEffect = {
    id: 'vaporwave', name: 'Vaporwave 90s', icon: '🌴', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.filter = 'saturate(1.7) contrast(1.18)';
      fx.drawImage(src, 0, 0, w, h);

      const grad = fx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, 'rgba(192, 132, 252, 0.35)');
      grad.addColorStop(0.5, 'rgba(244, 114, 182, 0.25)');
      grad.addColorStop(1, 'rgba(56, 189, 248, 0.3)');

      fx.globalCompositeOperation = 'color';
      fx.fillStyle = grad;
      fx.fillRect(0, 0, w, h);

      fx.globalCompositeOperation = 'overlay';
      fx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 2);
      }
      fx.restore();
    }
  };

export default vaporwaveEffect;
