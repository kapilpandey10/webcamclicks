/* WebcamClicks — bioluminescent 2D filter effect */

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

export const bioluminescentEffect = {
    id: 'bioluminescent', name: 'Bioluminescent Ocean', icon: '🌊', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Deep abyssal teal color grade
      fx.filter = 'contrast(1.22) hue-rotate(165deg) saturate(1.4) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Shimmering sunlight water caustics dancing on head
      drawCausticRays(fx, w, h, t);

      // Rising air bubbles & glowing plankton spores
      if (!this._bubbles || this._bw !== w || this._bh !== h) {
        this._bw = w;
        this._bh = h;
        this._bubbles = Array.from({ length: 24 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 3 + Math.random() * 8,
          vy: 0.04 + Math.random() * 0.08,
          sway: 0.002 + Math.random() * 0.004,
          phase: Math.random() * Math.PI * 2,
          glow: Math.random() < 0.5 ? '#22d3ee' : '#34d399'
        }));
      }

      fx.globalCompositeOperation = 'screen';
      for (const b of this._bubbles) {
        b.y -= b.vy * delta;
        b.phase += b.sway * delta;
        const bx = b.x + Math.sin(b.phase) * (b.r * 1.5);
        if (b.y < -20) {
          b.y = h + 20;
          b.x = pose.cx - pose.w * 0.8 + Math.random() * pose.w * 1.6;
        }

        // Bioluminescent radial glow halo
        const bg = fx.createRadialGradient(bx, b.y, 1, bx, b.y, b.r * 2.8);
        bg.addColorStop(0, b.glow);
        bg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = bg;
        fx.beginPath();
        fx.arc(bx, b.y, b.r * 2.8, 0, Math.PI * 2);
        fx.fill();

        // Bubble spherical glass rim & highlight
        fx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(bx, b.y, b.r, 0, Math.PI * 2);
        fx.stroke();

        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(bx - b.r * 0.35, b.y - b.r * 0.35, b.r * 0.25, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
    }
  };

export default bioluminescentEffect;
