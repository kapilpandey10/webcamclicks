/* WebcamClicks — vintage 2D filter effect */

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

export const vintageEffect = {
    id: 'vintage', name: 'Vintage', icon: '📻', category: 'Vintage', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'sepia(0.55) contrast(1.18) saturate(0.85) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      pixelPass(fx, fx.canvas, (d) => addNoise(d, 10));
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(40,20,0,0.5)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default vintageEffect;
