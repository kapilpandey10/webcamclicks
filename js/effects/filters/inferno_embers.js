/* WebcamClicks — inferno_embers 2D filter effect */

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

export const infernoEmbersEffect = {
    id: 'inferno_embers', name: 'Inferno Fire & Embers', icon: '🔥', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Volcanic smoldering color grade
      fx.filter = 'sepia(0.4) saturate(1.7) contrast(1.22) brightness(1.02)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Fiery ember particle system swirling around head
      if (!this._embers || this._ew !== w) {
        this._ew = w;
        this._embers = Array.from({ length: 45 }, () => ({
          x: Math.random() * w,
          y: h + Math.random() * 40,
          r: 1.5 + Math.random() * 3.5,
          vy: 0.06 + Math.random() * 0.14,
          vx: (Math.random() - 0.5) * 0.03,
          sway: 0.002 + Math.random() * 0.005,
          phase: Math.random() * Math.PI * 2,
          heat: Math.random()
        }));
      }

      fx.globalCompositeOperation = 'screen';

      // Bottom glowing fire rim
      const fireGrad = fx.createLinearGradient(0, h - Math.min(120, h * 0.28), 0, h);
      fireGrad.addColorStop(0, 'rgba(234, 88, 12, 0)');
      fireGrad.addColorStop(0.5, 'rgba(249, 115, 22, 0.35)');
      fireGrad.addColorStop(1, 'rgba(239, 68, 68, 0.65)');
      fx.fillStyle = fireGrad;
      fx.fillRect(0, h - Math.min(120, h * 0.28), w, Math.min(120, h * 0.28));

      for (const p of this._embers) {
        p.y -= p.vy * delta;
        p.phase += p.sway * delta;
        p.x += Math.sin(p.phase) * (delta * 0.08) + p.vx * delta;
        if (p.y < -10) {
          p.y = h + Math.random() * 20;
          p.x = pose.cx - pose.w * 0.8 + Math.random() * pose.w * 1.6;
        }

        const flick = (Math.sin(t * 0.01 + p.phase) + 1) * 0.5;
        const rad = p.r * (0.8 + flick * 0.4);

        const g = fx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rad * 3);
        g.addColorStop(0, p.heat > 0.4 ? '#fef08a' : '#fb923c');
        g.addColorStop(0.5, '#ea580c');
        g.addColorStop(1, 'rgba(220, 38, 38, 0)');

        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(p.x, p.y, rad * 3, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
    }
  };

export default infernoEmbersEffect;
