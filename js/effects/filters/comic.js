/* WebcamClicks — comic 2D filter effect */

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

export const comicEffect = {
    id: 'comic', name: 'Comic Book', icon: '💥', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = lumOf(d[p], d[p + 1], d[p + 2]);
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const avg = (d[p] + d[p + 1] + d[p + 2]) / 3;
          let r = avg + (d[p] - avg) * 1.7;
          let g = avg + (d[p + 1] - avg) * 1.7;
          let b = avg + (d[p + 2] - avg) * 1.7;
          r = Math.round(clamp(r, 0, 255) / 64) * 64;
          g = Math.round(clamp(g, 0, 255) / 64) * 64;
          b = Math.round(clamp(b, 0, 255) / 64) * 64;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          if (Math.abs(xr - xl) + Math.abs(yd - yu) > 58) { r = 18; g = 14; b = 28; }
          d[p] = r;
          d[p + 1] = g;
          d[p + 2] = b;
        }
      }
      fx.putImageData(img, 0, 0);
    }
  };

export default comicEffect;
