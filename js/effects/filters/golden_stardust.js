/* WebcamClicks — golden_stardust 2D filter effect */

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

export const goldenStardustEffect = {
    id: 'golden_stardust', name: 'Golden Stardust & Rays', icon: '✨', category: 'Portrait', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Editorial luxury golden hour grade
      fx.filter = 'sepia(0.24) contrast(1.14) brightness(1.06) saturate(1.24)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Warm halation bloom
      renderHalationBloom(fx, src, w, h, 0.42, 'warm');

      // Volumetric diagonal sunbeams converging directly toward user's head
      fx.globalCompositeOperation = 'screen';
      const rayGrad = fx.createLinearGradient(0, 0, pose.cx + w * 0.2, pose.cy + h * 0.2);
      rayGrad.addColorStop(0, 'rgba(254, 240, 138, 0.5)');
      rayGrad.addColorStop(0.4, 'rgba(251, 191, 36, 0.26)');
      rayGrad.addColorStop(0.75, 'rgba(245, 158, 11, 0.12)');
      rayGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = rayGrad;
      fx.beginPath();
      fx.moveTo(0, 0);
      fx.lineTo(w * 0.5, 0);
      fx.lineTo(pose.cx + pose.w, pose.cy + pose.h * 0.5);
      fx.lineTo(pose.cx - pose.w * 0.5, h);
      fx.lineTo(0, h * 0.6);
      fx.fill();

      // Drifting golden bokeh orbs floating in 3D around head
      if (!this._bokeh || this._bw !== w) {
        this._bw = w;
        this._bokeh = Array.from({ length: 22 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 14 + Math.random() * 32,
          vy: 0.03 + Math.random() * 0.05,
          phase: Math.random() * Math.PI * 2,
          col: Math.random() < 0.6 ? 'rgba(254, 240, 138, 0.25)' : 'rgba(251, 191, 36, 0.2)'
        }));
      }

      for (const b of this._bokeh) {
        b.y -= b.vy * delta;
        b.phase += 0.002 * delta;
        if (b.y < -b.r * 2) {
          b.y = h + b.r * 2;
          b.x = pose.cx - pose.w + Math.random() * pose.w * 2;
        }
        const bx = b.x + Math.sin(b.phase) * 16;
        fx.fillStyle = b.col;
        fx.beginPath();
        fx.arc(bx, b.y, b.r, 0, Math.PI * 2);
        fx.fill();

        fx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        fx.lineWidth = 1.2;
        fx.stroke();
      }

      // Twinkling 4-point diamond stardust sparkles on cheekbones & eyes
      for (let i = 0; i < 8; i++) {
        const sx = ((pose.cx - pose.w * 0.6 + i * 42.5 + t * 0.02) % w);
        const sy = ((pose.cy - pose.h * 0.6 + i * 36.2 + Math.sin(t * 0.003 + i) * 20) % h);
        const tw = (Math.sin(t * 0.005 + i * 1.8) + 1) * 0.5;
        if (tw > 0.4) {
          const spk = Math.max(6, Math.round(w * 0.015)) * tw;
          fx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
          fx.lineWidth = 1.5;
          fx.beginPath();
          fx.moveTo(sx - spk, sy); fx.lineTo(sx + spk, sy);
          fx.moveTo(sx, sy - spk); fx.lineTo(sx, sy + spk);
          fx.stroke();
          fx.fillStyle = '#ffffff';
          fx.beginPath();
          fx.arc(sx, sy, 1.5, 0, Math.PI * 2);
          fx.fill();
        }
      }
      fx.restore();
    }
  };

export default goldenStardustEffect;
