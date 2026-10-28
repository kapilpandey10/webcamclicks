/* WebcamClicks — stretch 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const stretchEffect = {
  id: 'stretch', name: 'Stretch', icon: '🧍', category: 'Mirror', perf: 'medium',
  render(fx, { src, width, height }) {
    const cx = width * 0.5;
    const strength = 0.5;
    pixelPass(fx, src, (data, w, h) => {
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const dx = (x - cx * (w / width)) / (cx * (w / width));
          const stretch = 1 + Math.abs(dx) * strength;
          const nx = cx * (w / width) + dx * cx * (w / width) * stretch;
          const sx = clamp(Math.round(nx), 0, w - 1);
          const i = (y * w + sx) * 4;
          const j = (y * w + x) * 4;
          data[j] = data[i]; data[j+1] = data[i+1]; data[j+2] = data[i+2]; data[j+3] = data[i+3];
        }
      }
    });
  }
};

export default stretchEffect;