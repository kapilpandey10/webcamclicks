/* WebcamClicks — neon 2D filter effect */

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

export const neonEffect = {
    id: 'neon', name: 'Neon Glow', icon: '🟣', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      const gray = new Float32Array(w * h);
      for (let i = 0, p = 0; i < gray.length; i++, p += 4) gray[i] = d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114;
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const p = i * 4;
          const xl = gray[i - (x > 0 ? 1 : 0)];
          const xr = gray[i + (x < w - 1 ? 1 : 0)];
          const yu = gray[i - (y > 0 ? w : 0)];
          const yd = gray[i + (y < h - 1 ? w : 0)];
          const edge = clamp(Math.abs(xr - xl) + Math.abs(yd - yu), 0, 120);
          const glow = edge * 2.1;
          d[p] = clamp(gray[i] * 0.1 + glow * 1.25, 0, 255);
          d[p + 1] = clamp(gray[i] * 0.08 + glow * 0.28, 0, 255);
          d[p + 2] = clamp(gray[i] * 0.14 + glow * 1.6 + 18, 0, 255);
        }
      }
      fx.putImageData(img, 0, 0);
    }
  };

export default neonEffect;
