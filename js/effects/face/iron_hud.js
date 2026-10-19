/* WebcamClicks — iron_hud face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const ironHudEffect = {
    id: 'iron_hud', name: 'Mark-VII Tactical AR HUD', icon: '🪖', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 30);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback: radar sweep grid
        fx.save();
        fx.translate(w / 2, h / 2);
        fx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
        fx.lineWidth = 1.5;
        fx.beginPath();
        fx.arc(0, 0, 60, 0, Math.PI * 2);
        fx.stroke();
        fx.font = 'bold 11px monospace';
        fx.fillStyle = '#06b6d4';
        fx.textAlign = 'center';
        fx.fillText('MARK-VII: SCANNING SECTOR', 0, 85);
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const hw = Math.max(ed * 1.6, s.headW);

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * hw * 0.1, 0);

      // 1. Dual Glowing Arc-Reactor Eye Reticles
      [-ed * 0.5, ed * 0.5].forEach((px) => {
        const er = ed * 0.32;
        fx.save();
        fx.translate(px, 0);

        // Rotating cyan reticle ring
        fx.rotate(t * 0.003);
        fx.strokeStyle = 'rgba(6, 182, 212, 0.85)';
        fx.lineWidth = 2;
        fx.shadowColor = '#00f0ff';
        fx.shadowBlur = 10;
        for (let i = 0; i < 3; i++) {
          fx.beginPath();
          fx.arc(0, 0, er, i * (Math.PI * 2 / 3), i * (Math.PI * 2 / 3) + 1.2);
          fx.stroke();
        }

        // Inner targeting cross
        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(-er * 0.4, 0); fx.lineTo(er * 0.4, 0);
        fx.moveTo(0, -er * 0.4); fx.lineTo(0, er * 0.4);
        fx.stroke();
        fx.restore();
      });

      // 2. Anamorphic Horizontal Lens Flare across eyes
      const flareGrad = fx.createLinearGradient(-hw * 0.9, 0, hw * 0.9, 0);
      flareGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      flareGrad.addColorStop(0.3, 'rgba(0, 240, 255, 0.4)');
      flareGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      flareGrad.addColorStop(0.7, 'rgba(0, 240, 255, 0.4)');
      flareGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = flareGrad;
      fx.fillRect(-hw * 0.9, -2, hw * 1.8, 4);

      // 3. Artificial Horizon Indicator that levels counter to head roll!
      fx.save();
      fx.translate(0, ed * 0.85);
      fx.rotate(-s.a); // Counter-rotates so horizon remains level!
      fx.strokeStyle = '#39ff14';
      fx.lineWidth = 1.5;
      fx.beginPath();
      fx.moveTo(-ed * 0.9, 0); fx.lineTo(-ed * 0.25, 0);
      fx.moveTo(ed * 0.25, 0); fx.lineTo(ed * 0.9, 0);
      fx.stroke();
      // Degree notch marks
      [-ed * 0.7, -ed * 0.5, ed * 0.5, ed * 0.7].forEach((nx) => {
        fx.beginPath();
        fx.moveTo(nx, -4); fx.lineTo(nx, 4);
        fx.stroke();
      });
      fx.restore();

      // 4. Altitude & Power Ladders on Left/Right Temples
      const ladderH = ed * 1.1;
      const fs = Math.max(9, Math.round(ed * 0.12));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.textBaseline = 'middle';

      // Left Ladder (Altitude)
      fx.strokeStyle = 'rgba(0, 240, 255, 0.6)';
      fx.lineWidth = 1.5;
      fx.beginPath();
      fx.moveTo(-hw * 0.75, -ladderH * 0.5);
      fx.lineTo(-hw * 0.75, ladderH * 0.5);
      fx.stroke();
      for (let i = 0; i < 5; i++) {
        const ly = -ladderH * 0.5 + (i * ladderH) / 4;
        fx.beginPath();
        fx.moveTo(-hw * 0.75, ly);
        fx.lineTo(-hw * 0.75 + 8, ly);
        fx.stroke();
      }
      fx.fillStyle = '#00f0ff';
      fx.textAlign = 'right';
      fx.fillText('ALT: 8,420m', -hw * 0.78, -ladderH * 0.3);
      fx.fillText('MACH: 2.4', -hw * 0.78, 0);
      fx.fillText('THRUST: 98%', -hw * 0.78, ladderH * 0.3);

      // Right Ladder (Power / Targeting)
      fx.beginPath();
      fx.moveTo(hw * 0.75, -ladderH * 0.5);
      fx.lineTo(hw * 0.75, ladderH * 0.5);
      fx.stroke();
      for (let i = 0; i < 5; i++) {
        const ly = -ladderH * 0.5 + (i * ladderH) / 4;
        fx.beginPath();
        fx.moveTo(hw * 0.75, ly);
        fx.lineTo(hw * 0.75 - 8, ly);
        fx.stroke();
      }
      fx.fillStyle = '#39ff14';
      fx.textAlign = 'left';
      fx.fillText('JARVIS v4.2', hw * 0.78, -ladderH * 0.3);
      fx.fillText('LOCK: 100%', hw * 0.78, 0);
      fx.fillText('PWR: 100%', hw * 0.78, ladderH * 0.3);

      fx.restore();
    }
  };

export default ironHudEffect;
