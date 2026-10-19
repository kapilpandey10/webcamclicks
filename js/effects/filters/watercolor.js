/* WebcamClicks — watercolor 2D filter effect */

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

export const watercolorEffect = {
    id: 'watercolor', name: 'Watercolor', icon: '🖌️', category: 'Art', perf: 'high',
    render(fx, { src }) {
      const w = fx.canvas.width;
      const h = fx.canvas.height;
      const sc = ensureScratch(w, h);
      sc.gx.filter = 'blur(2.2px) saturate(1.55)';
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.filter = 'none';
      const img = sc.gx.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        d[i] = clamp(Math.round(clamp(d[i], 0, 255) / 51) * 51 + 16 + (Math.random() * 6 - 3), 0, 255);
        d[i + 1] = clamp(Math.round(clamp(d[i + 1], 0, 255) / 51) * 51 + 18 + (Math.random() * 6 - 3), 0, 255);
        d[i + 2] = clamp(Math.round(clamp(d[i + 2], 0, 255) / 51) * 51 + 20 + (Math.random() * 6 - 3), 0, 255);
      }
      fx.putImageData(img, 0, 0);
    }
  };

export default watercolorEffect;
