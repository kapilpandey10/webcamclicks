/* WebcamClicks — trix400 2D filter effect */

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

export const trix400Effect = {
    id: 'trix400', name: 'Kodak Tri-X 400', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* High-contrast silver gelatin black-and-white film shoot */
      fx.filter = 'grayscale(1) contrast(1.48) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.26, 'bw');

      /* Rich 400-ISO film grain texture */
      applyFilmGrain(fx, w, h, 0.28);

      /* Corner falloff vignette */
      const vig = fx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.35, w * 0.5, h * 0.5, Math.max(w, h) * 0.68);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.42)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default trix400Effect;
