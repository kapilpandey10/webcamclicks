/* WebcamClicks — goldenhour 2D filter effect */

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

export const goldenhourEffect = {
    id: 'goldenhour', name: 'Golden Hour', icon: '🌅', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.save();
      fx.filter = 'sepia(0.35) saturate(1.45) contrast(1.1) brightness(1.06)';
      fx.drawImage(src, 0, 0, w, h);

      const flare = fx.createRadialGradient(w * 0.15, h * 0.15, 20, w * 0.25, h * 0.25, w * 0.75);
      flare.addColorStop(0, 'rgba(255, 223, 128, 0.55)');
      flare.addColorStop(0.3, 'rgba(251, 146, 60, 0.28)');
      flare.addColorStop(0.7, 'rgba(236, 72, 153, 0.12)');
      flare.addColorStop(1, 'rgba(0, 0, 0, 0)');

      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = flare;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default goldenhourEffect;
