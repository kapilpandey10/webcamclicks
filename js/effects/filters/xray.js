/* WebcamClicks — xray 2D filter effect */

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

export const xrayEffect = {
    id: 'xray', name: 'X-Ray', icon: '🦴', category: 'Fun', perf: 'high',
    render(fx, { src, width: w, height: h }) {
      pixelPass(fx, src, (d) => {
        for (let i = 0; i < d.length; i += 4) {
          const v = 255 - lumOf(d[i], d[i + 1], d[i + 2]);
          d[i] = clamp(v * 0.42, 0, 255);
          d[i + 1] = clamp(v * 0.68, 0, 255);
          d[i + 2] = clamp(v * 1.3 + 12, 0, 255);
        }
      });
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.75);
      g.addColorStop(0, 'rgba(120,190,255,0.06)');
      g.addColorStop(1, 'rgba(0,20,60,0.65)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default xrayEffect;
