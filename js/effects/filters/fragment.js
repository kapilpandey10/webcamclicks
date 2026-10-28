/* WebcamClicks — fragment 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const fragmentEffect = {
  id: 'fragment', name: 'Fragment', icon: '🧩', category: 'Fun', perf: 'medium',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(1.2) contrast(1.15)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Shattered fragment lines
    fx.strokeStyle = 'rgba(255,255,255,0.35)';
    fx.lineWidth = 2;
    const t = Date.now() * 0.001;
    for (let i = 0; i < 8; i++) {
      const x1 = (Math.sin(t + i) * 0.5 + 0.5) * width;
      const y1 = 0;
      const x2 = (Math.cos(t + i * 1.3) * 0.5 + 0.5) * width;
      const y2 = height;
      fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
    }
    for (let i = 0; i < 5; i++) {
      const x1 = 0;
      const y1 = (Math.cos(t + i * 0.9) * 0.5 + 0.5) * height;
      const x2 = width;
      const y2 = (Math.sin(t + i * 1.1) * 0.5 + 0.5) * height;
      fx.beginPath(); fx.moveTo(x1, y1); fx.lineTo(x2, y2); fx.stroke();
    }
  }
};

export default fragmentEffect;