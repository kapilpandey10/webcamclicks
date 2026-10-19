/* WebcamClicks — datamosh 2D filter effect */

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

export const datamoshEffect = {
    id: 'datamosh', name: 'Datamosh FX', icon: '🌀', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      fx.drawImage(src, 0, 0, w, h);

      // Macroblock compression tearing simulation
      const blockCount = 8 + Math.floor(Math.random() * 8);
      const blockSize = 32 + ((Math.random() * 32) | 0);
      for (let i = 0; i < blockCount; i++) {
        const bx = Math.floor(Math.random() * (w / blockSize)) * blockSize;
        const by = Math.floor(Math.random() * (h / blockSize)) * blockSize;
        const shiftX = (Math.random() < 0.5 ? 1 : -1) * (16 + Math.random() * 32);
        fx.drawImage(src, bx, by, blockSize, blockSize, bx + shiftX, by, blockSize, blockSize);
      }

      // Chroma ghosting displacement
      if (Math.random() < 0.6) {
        fx.save();
        fx.globalCompositeOperation = 'difference';
        fx.globalAlpha = 0.35;
        fx.drawImage(src, (Math.random() * 12 - 6), (Math.random() * 6 - 3), w, h);
        fx.restore();
      }

      // Codec data burst stripe
      if (Math.random() < 0.3) {
        const stY = Math.random() * h;
        fx.fillStyle = 'rgba(0, 255, 128, 0.35)';
        fx.fillRect(0, stY, w, 6);
      }
    }
  };

export default datamoshEffect;
