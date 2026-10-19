/* WebcamClicks — kaleidoscope 2D filter effect */

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

export const kaleidoscopeEffect = {
    id: 'kaleidoscope', name: 'Kaleidoscope', icon: '🔮', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      const cx = w / 2;
      const cy = h / 2;
      const R = Math.hypot(w, h);
      const slices = 8;
      const step = (Math.PI * 2) / slices;
      const rot = (time / 6000) % step;
      const zoom = 1.15;
      fx.save();
      fx.beginPath();
      fx.rect(0, 0, w, h);
      fx.clip();
      fx.translate(cx, cy);
      fx.rotate(rot);
      for (let i = 0; i < slices; i++) {
        fx.save();
        fx.rotate(i * step);
        if (i % 2) fx.scale(-1, 1);
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.arc(0, 0, R, -step / 2, step / 2);
        fx.closePath();
        fx.clip();
        fx.drawImage(src, (-w / 2) * zoom, (-h / 2) * zoom, w * zoom, h * zoom);
        fx.restore();
      }
      fx.restore();
    }
  };

export default kaleidoscopeEffect;
