/* WebcamClicks — smoke 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const smokeEffect = {
  id: 'smoke', name: 'Smoke', icon: '💨', category: 'Art', perf: 'medium',
  render(fx, { src, width, height, time }) {
    fx.filter = 'saturate(0.4) brightness(0.9) contrast(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Smoke wisps
    fx.fillStyle = 'rgba(200,200,210,0.15)';
    const t = time * 0.002;
    for (let i = 0; i < 5; i++) {
      const x = (Math.sin(t + i * 0.7) * 0.5 + 0.5) * width;
      const y = height - (Math.cos(t * 0.5 + i) * 0.5 + 0.5) * height * 0.4;
      const r = Math.min(width, height) * (0.15 + Math.sin(t + i) * 0.1);
      const grad = fx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(220,220,230,0.4)');
      grad.addColorStop(1, 'rgba(220,220,230,0)');
      fx.fillStyle = grad;
      fx.beginPath();
      fx.arc(x, y, r, 0, Math.PI * 2);
      fx.fill();
    }
  }
};

export default smokeEffect;