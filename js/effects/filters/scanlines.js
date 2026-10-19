/* WebcamClicks — scanlines 2D filter effect */

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

export const scanlinesEffect = {
    id: 'scanlines', name: 'CRT Screen', icon: '🖥️', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);
      fx.fillStyle = 'rgba(0,0,0,0.20)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.max(w, h) * 0.72);
      g.addColorStop(0, 'rgba(255,255,255,0.03)');
      g.addColorStop(1, 'rgba(0,0,0,0.55)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default scanlinesEffect;
