/* WebcamClicks — anamorphic 2D filter effect */

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

export const anamorphicEffect = {
    id: 'anamorphic', name: 'Anamorphic Cine', icon: '💎', category: 'Classic', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      // Base frame with cinematic grade
      fx.save();
      fx.filter = 'contrast(1.15) saturate(1.22)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      // Hollywood Anamorphic Cyan Flare Streak
      fx.save();
      fx.globalCompositeOperation = 'screen';
      const streakY = h * (0.45 + Math.sin(t * 0.001) * 0.06);
      const flare = fx.createLinearGradient(0, streakY - 14, 0, streakY + 14);
      flare.addColorStop(0, 'rgba(6, 182, 212, 0)');
      flare.addColorStop(0.5, 'rgba(56, 189, 248, 0.65)');
      flare.addColorStop(1, 'rgba(6, 182, 212, 0)');
      fx.fillStyle = flare;
      fx.fillRect(0, streakY - 14, w, 28);

      // Intense core highlight
      fx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      fx.fillRect(w * 0.1, streakY - 1.5, w * 0.8, 3);

      // Subtle anamorphic vignette
      const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.7);
      vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
      vig.addColorStop(1, 'rgba(0, 0, 0, 0.45)');
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = vig;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default anamorphicEffect;
