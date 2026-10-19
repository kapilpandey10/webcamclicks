/* WebcamClicks — nightvision 2D filter effect */

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

export const nightvisionEffect = {
    id: 'nightvision', name: 'Night Vision', icon: '👁️', category: 'Fun', perf: 'high',
    render(fx, { src, width: w, height: h }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          let v = lumOf(d[i], d[i + 1], d[i + 2]) * 1.4;
          v += (Math.random() * 2 - 1) * 20;
          v = clamp(v, 0, 255);
          d[i] = v * 0.22;
          d[i + 1] = v;
          d[i + 2] = v * 0.34;
        }
      });
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      for (let y = 0; y < h; y += 4) fx.fillRect(0, y, w, 1);
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.7);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(1, 'rgba(0,20,0,0.75)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default nightvisionEffect;
