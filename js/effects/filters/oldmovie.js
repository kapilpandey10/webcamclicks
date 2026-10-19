/* WebcamClicks — oldmovie 2D filter effect */

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

export const oldmovieEffect = {
    id: 'oldmovie', name: 'Old Movie', icon: '🎞️', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'sepia(0.5) contrast(1.3) brightness(0.9)';
      fx.drawImage(src, -1 + Math.random() * 2, 0, w, h);
      fx.filter = 'none';
      if (Math.random() < 0.75) {
        fx.strokeStyle = 'rgba(255,255,255,0.26)';
        fx.lineWidth = 1;
        const n = 1 + ((Math.random() * 2) | 0);
        for (let i = 0; i < n; i++) {
          const x = Math.random() * w;
          fx.beginPath();
          fx.moveTo(x, 0);
          fx.lineTo(x + rand(-6, 6), h * rand(0.3, 1));
          fx.stroke();
        }
      }
      fx.fillStyle = `rgba(255,240,200,${0.03 + Math.random() * 0.05})`;
      fx.fillRect(0, 0, w, h);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(20,10,0,0.6)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default oldmovieEffect;
