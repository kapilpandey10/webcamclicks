/* WebcamClicks — spiral 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const spiralEffect = {
  id: 'spiral', name: 'Spiral', icon: '🌀', category: 'Mirror', perf: 'medium',
  render(fx, { src, width, height }) {
    const cx = width * 0.5, cy = height * 0.5;
    const radius = Math.min(width, height) * 0.45;
    const swirl = 1.5;
    pixelPass(fx, src, (data, w, h) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = x - cx * (w / width);
          const dy = y - cy * (h / height);
          const dist = Math.hypot(dx, dy);
          if (dist < radius) {
            const angle = Math.atan2(dy, dx);
            const twist = (1 - dist / radius) * swirl;
            const nx = cx * (w / width) + Math.cos(angle + twist) * dist;
            const ny = cy * (h / height) + Math.sin(angle + twist) * dist;
            const sx = clamp(Math.round(nx), 0, w - 1);
            const sy = clamp(Math.round(ny), 0, h - 1);
            const i = (sy * w + sx) * 4;
            const j = (y * w + x) * 4;
            data[j] = data[i]; data[j+1] = data[i+1]; data[j+2] = data[i+2]; data[j+3] = data[i+3];
          }
        }
      }
    });
  }
};

export default spiralEffect;