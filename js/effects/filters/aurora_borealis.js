/* WebcamClicks — aurora_borealis 2D filter effect */

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

export const auroraBorealisEffect = {
    id: 'aurora_borealis', name: 'Aurora Borealis', icon: '✨', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      fx.filter = 'contrast(1.18) saturate(1.25) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Layered undulating arctic aurora ribbons
      fx.globalCompositeOperation = 'screen';
      const ribbons = [
        { col: 'rgba(52, 211, 153, 0.42)', freq: 0.012, speed: 0.0012, yBase: h * 0.22, amp: h * 0.12 },
        { col: 'rgba(45, 212, 191, 0.36)', freq: 0.016, speed: 0.0016, yBase: h * 0.30, amp: h * 0.10 },
        { col: 'rgba(192, 132, 252, 0.32)', freq: 0.020, speed: 0.0009, yBase: h * 0.16, amp: h * 0.14 }
      ];

      for (const rb of ribbons) {
        fx.fillStyle = rb.col;
        fx.beginPath();
        fx.moveTo(0, 0);
        for (let x = 0; x <= w; x += Math.max(8, Math.round(w / 40))) {
          const wave = Math.sin(x * rb.freq + t * rb.speed) * rb.amp + Math.cos(x * rb.freq * 0.5 - t * rb.speed * 0.7) * (rb.amp * 0.5);
          fx.lineTo(x, rb.yBase + wave);
        }
        fx.lineTo(w, 0);
        fx.closePath();
        fx.fill();

        // Vertical glowing curtain striations
        const grad = fx.createLinearGradient(0, rb.yBase - rb.amp, 0, rb.yBase + rb.amp * 1.5);
        grad.addColorStop(0, rb.col);
        grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = grad;
        fx.fillRect(0, rb.yBase - rb.amp, w, rb.amp * 2.5);
      }

      // Arctic stars in upper sky
      fx.fillStyle = '#ffffff';
      for (let i = 0; i < 28; i++) {
        const sx = ((i * 137.5) % w);
        const sy = ((i * 89.3) % (h * 0.45));
        const sa = (Math.sin(t * 0.003 + i) + 1) * 0.4 + 0.2;
        fx.globalAlpha = sa;
        fx.beginPath();
        fx.arc(sx, sy, 1.2, 0, Math.PI * 2);
        fx.fill();
      }

      // Atmospheric cool arctic rim lighting over head
      const arcticHead = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.5, pose.cx, pose.cy, pose.eyeDist * 2);
      arcticHead.addColorStop(0, 'rgba(52, 211, 153, 0.18)');
      arcticHead.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = arcticHead;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default auroraBorealisEffect;
