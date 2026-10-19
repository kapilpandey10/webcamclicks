/* WebcamClicks — ripple 2D filter effect */

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

export const rippleEffect = {
    id: 'ripple', name: 'Ripple', icon: '💧', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.drawImage(src, 0, 0, w, h);
      const slices = 42;
      const sh = h / slices;
      for (let i = 0; i < slices; i++) {
        const sy = i * sh;
        const off = Math.sin(i * 0.5 + time / 260) * (5 + 4 * Math.sin(time / 900));
        fx.drawImage(src, 0, sy, w, sh + 0.6, off, sy, w, sh + 0.6);
      }
    }
  };

export default rippleEffect;
