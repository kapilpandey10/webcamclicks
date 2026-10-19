/* WebcamClicks — vintageshoot 2D filter effect */

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

export const vintageshootEffect = {
    id: 'vintageshoot', name: 'Vintage Shoot', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      /* 1980s studio glamour photoshoot: soft warm diffusion, flattering skin tones */
      fx.filter = 'contrast(1.12) saturate(1.18) brightness(1.04) sepia(0.18)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.44, 'warm');

      /* Soft Studio Radial Lighting Vignette */
      const vig = fx.createRadialGradient(w * 0.5, h * 0.45, Math.min(w, h) * 0.28, w * 0.5, h * 0.5, Math.max(w, h) * 0.72);
      vig.addColorStop(0, 'rgba(255, 235, 205, 0.12)');
      vig.addColorStop(0.65, 'rgba(180, 110, 60, 0.08)');
      vig.addColorStop(1, 'rgba(25, 12, 5, 0.48)');
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);

      /* Authentic 35mm film grain overlay */
      applyFilmGrain(fx, w, h, 0.18);
      fx.restore();
    }
  };

export default vintageshootEffect;
