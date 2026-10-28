/* WebcamClicks — halo 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const haloEffect = {
  id: 'halo', name: 'Halo', icon: '😇', category: 'Fun', perf: 'medium',
  render(fx, { src, width, height, face }) {
    fx.drawImage(src, 0, 0, width, height);
    if (face && face.box) {
      const { x, y, width: bw, height: bh } = face.box;
      const cx = x + bw * 0.5;
      const cy = y - bh * 0.15;
      const r = Math.min(bw, bh) * 0.35;
      const gradient = fx.createRadialGradient(cx, cy, 0, cx, cy, r);
      gradient.addColorStop(0, 'rgba(255,220,120,0.6)');
      gradient.addColorStop(0.6, 'rgba(255,200,80,0.2)');
      gradient.addColorStop(1, 'rgba(255,200,80,0)');
      fx.fillStyle = gradient;
      fx.beginPath();
      fx.arc(cx, cy, r, 0, Math.PI * 2);
      fx.fill();
      // Inner glow
      fx.fillStyle = 'rgba(255,240,180,0.3)';
      fx.beginPath();
      fx.arc(cx, cy, r * 0.5, 0, Math.PI * 2);
      fx.fill();
    }
  }
};

export default haloEffect;