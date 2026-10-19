/* WebcamClicks — sketch 2D filter effect */

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

export const sketchEffect = {
    id: 'sketch', name: 'Pencil Sketch', icon: '✏️', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.filter = 'grayscale(1) contrast(1.05)';
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.filter = 'none';
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = d[p];
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          const edge = Math.abs(xr - xl) + Math.abs(yd - yu);
          let v = 248 - edge * 2.4 - (255 - gray[i]) * 0.32;
          v = clamp(v, 0, 255);
          const n = (Math.random() * 2 - 1) * 5;
          d[p] = clamp(v + n + 6, 0, 255);
          d[p + 1] = clamp(v + n + 2, 0, 255);
          d[p + 2] = clamp(v + n - 8, 0, 255);
        }
      }
      fx.putImageData(img, 0, 0);
    }
  };

export default sketchEffect;
