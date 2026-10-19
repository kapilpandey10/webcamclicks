/* WebcamClicks — silverscreen 2D filter effect */

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

export const silverscreenEffect = {
    id: 'silverscreen', name: 'Silver Screen', icon: '📽️', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'grayscale(1) contrast(1.36) brightness(1.04)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.42, 'bw');

      fx.save();
      const vig = fx.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.28, w / 2, h * 0.45, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.8, 'rgba(0, 0, 0, 0.4)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.85)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.28);
    }
  };

export default silverscreenEffect;
