/* WebcamClicks — super8 2D filter effect */

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

export const super8Effect = {
    id: 'super8', name: 'Super 8mm Film', icon: '🎞️', category: 'Vintage', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      // Kodachrome warm color tone
      fx.filter = 'sepia(0.35) contrast(1.18) brightness(1.05) saturate(1.25)';
      // Projector frame gate jitter
      const jitterY = (Math.sin(t * 0.03) * 1.5) | 0;
      fx.drawImage(src, 0, jitterY, w, h);
      fx.restore();

      // Film scratches
      fx.save();
      if (Math.random() < 0.8) {
        fx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        fx.lineWidth = 1;
        const sx = Math.random() * w;
        fx.beginPath();
        fx.moveTo(sx, 0);
        fx.lineTo(sx + (Math.random() * 4 - 2), h);
        fx.stroke();
      }

      // Moving dust particles
      fx.fillStyle = 'rgba(15, 15, 15, 0.5)';
      for (let i = 0; i < 5; i++) {
        fx.beginPath();
        fx.arc(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 0, Math.PI * 2);
        fx.fill();
      }

      // Vintage film gate rounded vignette border
      fx.lineWidth = 18;
      fx.strokeStyle = 'rgba(0, 0, 0, 0.85)';
      fx.strokeRect(0, 0, w, h);
      fx.restore();
    }
  };

export default super8Effect;
