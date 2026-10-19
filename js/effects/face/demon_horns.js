/* WebcamClicks — demon_horns face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const demonHornsEffect = {
    id: 'demon_horns', name: 'Neon Demon Horns', icon: '😈', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 40);
      const t = frame.time || performance.now();
      if (!s) return;

      const ed = s.eyeDist;
      const hw = s.headW;

      // Particle system for rising purple/crimson flame wisps
      if (!this._p) this._p = [];
      const delta = clamp(frame.dt || 16.7, 0, 50);

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * hw * 0.08, 0);

      const hornBaseY = -ed * 0.75;
      const hornSpacing = ed * 0.55;
      const hornH = ed * 1.25;

      // Draw Left and Right Horns
      [-hornSpacing, hornSpacing].forEach((hx, idx) => {
        const dir = idx === 0 ? -1 : 1;
        fx.save();
        fx.translate(hx, hornBaseY);

        // Horn bezier curve
        fx.beginPath();
        fx.moveTo(-dir * ed * 0.12, 0);
        fx.quadraticCurveTo(dir * ed * 0.1, -hornH * 0.45, dir * ed * 0.45, -hornH);
        fx.quadraticCurveTo(dir * ed * 0.05, -hornH * 0.35, dir * ed * 0.12, 0);
        fx.closePath();

        // 3D Obsidian-to-crimson gradient
        const hGrad = fx.createLinearGradient(0, 0, dir * ed * 0.45, -hornH);
        hGrad.addColorStop(0, '#1e1124');
        hGrad.addColorStop(0.5, '#4c0519');
        hGrad.addColorStop(0.85, '#e11d48');
        hGrad.addColorStop(1, '#fda4af');
        fx.fillStyle = hGrad;
        fx.fill();

        // Glowing neon outline
        fx.strokeStyle = '#f43f5e';
        fx.shadowColor = '#f43f5e';
        fx.shadowBlur = 18;
        fx.lineWidth = Math.max(2, ed * 0.04);
        fx.stroke();
        fx.shadowBlur = 0;

        // Metallic horn segments
        fx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        fx.lineWidth = 1;
        for (let i = 1; i <= 3; i++) {
          const sy = -hornH * (i * 0.22);
          const sx = dir * ed * (i * 0.09);
          fx.beginPath();
          fx.moveTo(sx - 6, sy);
          fx.lineTo(sx + 6, sy - 2);
          fx.stroke();
        }
        fx.restore();

        // Spawn rising flame particles from horn tips
        if (Math.random() < 0.45) {
          this._p.push({
            x: s.x + Math.cos(s.a) * (hx + dir * ed * 0.45) - Math.sin(s.a) * (hornBaseY - hornH),
            y: s.y + Math.sin(s.a) * (hx + dir * ed * 0.45) + Math.cos(s.a) * (hornBaseY - hornH),
            vx: (Math.random() - 0.5) * 0.04,
            vy: -rand(0.08, 0.18),
            life: rand(300, 600),
            age: 0,
            r: rand(4, 9)
          });
        }
      });

      // Subtle glowing red reflections on pupils
      const pR = Math.max(3, ed * 0.06);
      [-ed * 0.5, ed * 0.5].forEach((px) => {
        const eg = fx.createRadialGradient(px, 0, 0.5, px, 0, pR * 2);
        eg.addColorStop(0, 'rgba(244, 63, 94, 0.85)');
        eg.addColorStop(0.5, 'rgba(225, 29, 72, 0.35)');
        eg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = eg;
        fx.beginPath();
        fx.arc(px, 0, pR * 2, 0, Math.PI * 2);
        fx.fill();
      });
      fx.restore();

      // Render flame particles in screen space
      fx.save();
      fx.globalCompositeOperation = 'screen';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += delta;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        p.x += p.vx * delta;
        p.y += p.vy * delta;

        const rad = p.r * (1 + (1 - k) * 0.8);
        const g = fx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rad);
        g.addColorStop(0, `rgba(254, 205, 211, ${0.85 * k})`);
        g.addColorStop(0.4, `rgba(225, 29, 72, ${0.65 * k})`);
        g.addColorStop(1, 'rgba(126, 34, 206, 0)');
        fx.fillStyle = g;
        fx.beginPath();
        fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
      if (this._p.length > 80) this._p.splice(0, this._p.length - 80);
    }
  };

export default demonHornsEffect;
