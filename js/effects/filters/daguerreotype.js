/* WebcamClicks — daguerreotype 2D filter effect */

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

export const daguerreotypeEffect = {
    id: 'daguerreotype', name: '1890s Antique', icon: '🏛️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* Antique Victorian tintype / daguerreotype with aged oval plate border */
      fx.filter = 'sepia(0.88) contrast(1.35) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const vig = fx.createRadialGradient(w * 0.5, h * 0.5, Math.min(w, h) * 0.25, w * 0.5, h * 0.5, Math.max(w, h) * 0.65);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(0.7, 'rgba(60, 40, 20, 0.35)');
      vig.addColorStop(1, 'rgba(15, 8, 3, 0.85)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);

      applyFilmGrain(fx, w, h, 0.32);
      fx.restore();
    }
  };

export default daguerreotypeEffect;
