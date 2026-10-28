/* WebcamClicks — magazine 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const magazineEffect = {
  id: 'magazine', name: 'Magazine', icon: '📰', category: 'Art', perf: 'medium',
  render(fx, { src, width, height }) {
    fx.filter = 'grayscale(0.7) contrast(1.5) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Halftone dot pattern
    const dotSize = 4;
    for (let y = 0; y < height; y += dotSize * 2) {
      for (let x = 0; x < width; x += dotSize * 2) {
        const cx = x + dotSize;
        const cy = y + dotSize;
        const radius = dotSize * (0.4 + Math.sin(x * 0.05) * Math.cos(y * 0.05) * 0.3);
        fx.beginPath();
        fx.arc(cx, cy, radius, 0, Math.PI * 2);
        fx.fillStyle = 'rgba(0,0,0,0.25)';
        fx.fill();
      }
    }
  }
};

export default magazineEffect;