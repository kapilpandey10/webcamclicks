/* WebcamClicks — firebreath face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const firebreathEffect = {
    id: 'firebreath', name: 'Fire Breath', icon: '🐉', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) { this._p = []; return; }
      if (!this._p) this._p = [];
      const dt = clamp(frame.dt, 0, 50);
      const openRatio = Math.hypot(g.pts[62].x - g.pts[66].x, g.pts[62].y - g.pts[66].y) / g.eyeDist;
      if (openRatio > 0.32) {
        for (let i = 0; i < 5; i++) {
          this._p.push({
            x: g.mouth.x + rand(-6, 6),
            y: g.mouth.y,
            vx: rand(-0.08, 0.08),
            vy: -rand(0.12, 0.42),
            life: rand(450, 900),
            age: 0,
            r: rand(8, 20)
          });
        }
      }
      fx.globalCompositeOperation = 'lighter';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const rad = p.r * (1 + (1 - k) * 1.7);
        const grad = fx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
        grad.addColorStop(0, `rgba(255,230,140,${0.85 * k})`);
        grad.addColorStop(0.45, `rgba(255,120,40,${0.6 * k})`);
        grad.addColorStop(1, 'rgba(255,40,0,0)');
        fx.fillStyle = grad;
        fx.beginPath();
        fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalCompositeOperation = 'source-over';
      if (this._p.length > 300) this._p.splice(0, this._p.length - 300);
    }
  };

export default firebreathEffect;
