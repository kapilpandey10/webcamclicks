/* WebcamClicks — shuffle 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const shuffleEffect = {
  id: 'shuffle', name: 'Shuffle', icon: '🔀', category: 'Fun', perf: 'medium',
  render(fx, { src, width, height }) {
    const block = 24;
    pixelPass(fx, src, (data, w, h) => {
      const tmp = new Uint8ClampedArray(data.length);
      for (let y = 0; y < h; y += block) {
        for (let x = 0; x < w; x += block) {
          const sx = (x + (Math.random() * block | 0)) % w;
          const sy = (y + (Math.random() * block | 0)) % h;
          for (let dy = 0; dy < block && y + dy < h; dy++) {
            for (let dx = 0; dx < block && x + dx < w; dx++) {
              const si = ((sy + dy) * w + (sx + dx)) * 4;
              const di = ((y + dy) * w + (x + dx)) * 4;
              data[di] = tmp[si] !== undefined ? tmp[si] : data[si];
              data[di+1] = tmp[si+1] !== undefined ? tmp[si+1] : data[si+1];
              data[di+2] = tmp[si+2] !== undefined ? tmp[si+2] : data[si+2];
              data[di+3] = tmp[si+3] !== undefined ? tmp[si+3] : data[si+3];
            }
          }
        }
      }
    });
  }
};

export default shuffleEffect;