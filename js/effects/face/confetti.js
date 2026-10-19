/* WebcamClicks — confetti face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const confettiEffect = {
    id: 'confetti', name: 'Smile Confetti', icon: '🎊', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;

      if (!this._p) this._p = [];
      const dt = clamp(frame.dt || 16, 1, 60);
      const dtSec = dt / 1000;

      // --- Instant Smile Detector from landmarks + expression fallback ---
      const pts = g.pts;
      const mouthW = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
      const lipLift = ((pts[51].y - pts[48].y) + (pts[51].y - pts[54].y)) / 2;
      const smileScore = (mouthW / g.eyeDist) * 0.7 + (lipLift / g.eyeDist) * 1.6;
      const exprHappy = frame.face && frame.face.expressions ? frame.face.expressions.happy || 0 : 0;
      const isSmiling = smileScore > 0.54 || exprHappy > 0.42;

      // Burst confetti particles when smiling
      if (isSmiling) {
        const cheekL = { x: pts[48].x - g.eyeDist * 0.15, y: pts[48].y - g.eyeDist * 0.1 };
        const cheekR = { x: pts[54].x + g.eyeDist * 0.15, y: pts[54].y - g.eyeDist * 0.1 };

        // Burst 4-6 particles per frame
        for (let i = 0; i < 4; i++) {
          const origin = Math.random() < 0.5 ? cheekL : cheekR;
          const isLeft = origin === cheekL;
          const angle = isLeft ? rand(-2.6, -1.2) : rand(-1.9, -0.5);
          const speed = rand(220, 520);
          this._p.push({
            x: origin.x + rand(-8, 8),
            y: origin.y + rand(-8, 8),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotX: Math.random() * Math.PI * 2,
            rotY: Math.random() * Math.PI * 2,
            rotZ: Math.random() * Math.PI * 2,
            vRotX: rand(-12, 12),
            vRotY: rand(-14, 14),
            vRotZ: rand(-6, 6),
            w: rand(8, 16),
            h: rand(6, 12),
            type: Math.random() < 0.25 ? 'star' : (Math.random() < 0.35 ? 'circle' : 'ribbon'),
            color: pick(['#e11d48', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#fde047', '#38bdf8']),
            age: 0,
            life: rand(800, 1600)
          });
        }
      }

      // --- Update & Render 3D Tumbling Confetti ---
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }

        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.vy += 320 * dtSec; // gravity
        p.vx *= 0.985;       // air resistance
        p.rotX += p.vRotX * dtSec;
        p.rotY += p.vRotY * dtSec;
        p.rotZ += p.vRotZ * dtSec;

        const alpha = clamp(1 - p.age / p.life, 0, 1);
        const scaleX = Math.cos(p.rotX);
        const scaleY = Math.sin(p.rotY);

        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(p.rotZ);
        fx.scale(scaleX, scaleY);
        fx.globalAlpha = alpha;

        // Specular glint when edge faces light
        const facingLight = Math.abs(scaleX * scaleY);
        if (facingLight < 0.15) {
          fx.fillStyle = '#ffffff';
        } else {
          fx.fillStyle = p.color;
        }

        if (p.type === 'circle') {
          fx.beginPath();
          fx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          fx.fill();
        } else if (p.type === 'star') {
          fx.beginPath();
          for (let k = 0; k < 5; k++) {
            const rot = (k * Math.PI * 2) / 5 - Math.PI / 2;
            const rOut = p.w * 0.55;
            const rIn = p.w * 0.24;
            fx.lineTo(Math.cos(rot) * rOut, Math.sin(rot) * rOut);
            fx.lineTo(Math.cos(rot + Math.PI / 5) * rIn, Math.sin(rot + Math.PI / 5) * rIn);
          }
          fx.closePath();
          fx.fill();
        } else {
          fx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        fx.restore();
      }

      if (this._p.length > 350) this._p.splice(0, this._p.length - 350);
    }
  };

export default confettiEffect;
