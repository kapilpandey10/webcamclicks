/* WebcamClicks — spy cam 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const spyCamEffect = {
  id: 'spy_cam', name: 'Spy Cam', icon: '🕵️', category: 'Fun', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(0.3) contrast(1.2) brightness(0.9)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Spy cam reticle
    fx.strokeStyle = 'rgba(0,255,0,0.6)';
    fx.lineWidth = 2;
    const cx = width * 0.5, cy = height * 0.5;
    const r = Math.min(width, height) * 0.35;
    fx.beginPath(); fx.arc(cx, cy, r, 0, Math.PI * 2); fx.stroke();
    fx.beginPath(); fx.moveTo(cx - r, cy); fx.lineTo(cx + r, cy); fx.stroke();
    fx.beginPath(); fx.moveTo(cx, cy - r); fx.lineTo(cx, cy + r); fx.stroke();
    // Corner brackets
    const s = 20;
    fx.beginPath();
    fx.moveTo(cx - r, cy - r); fx.lineTo(cx - r + s, cy - r); fx.lineTo(cx - r, cy - r + s);
    fx.moveTo(cx + r, cy - r); fx.lineTo(cx + r - s, cy - r); fx.lineTo(cx + r, cy - r + s);
    fx.moveTo(cx - r, cy + r); fx.lineTo(cx - r + s, cy + r); fx.lineTo(cx - r, cy + r - s);
    fx.moveTo(cx + r, cy + r); fx.lineTo(cx + r - s, cy + r); fx.lineTo(cx + r, cy + r - s);
    fx.stroke();
    // Scanlines
    fx.fillStyle = 'rgba(0,40,0,0.15)';
    for (let y = 0; y < height; y += 4) {
      fx.fillRect(0, y, width, 1);
    }
  }
};

export default spyCamEffect;