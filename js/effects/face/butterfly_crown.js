/* WebcamClicks — butterfly_crown face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const butterflyCrownEffect = {
    id: 'butterfly_crown', name: 'Celestial Butterfly Tiara', icon: '🦋', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 45);
      const t = frame.time || performance.now();
      if (!s) return;

      const ed = s.eyeDist;
      const hw = ed * 1.15;
      const hh = ed * 0.28;

      fx.save();
      fx.translate(s.x, s.y - ed * 0.72);
      fx.rotate(s.a * 0.65);
      fx.translate(s.yaw * s.headW * 0.06, 0);

      // 1. Golden organic vine headband across forehead
      fx.beginPath();
      fx.ellipse(0, 0, hw, hh, 0, Math.PI * 0.05, Math.PI * 0.95);
      const vineGrad = fx.createLinearGradient(-hw, 0, hw, 0);
      vineGrad.addColorStop(0, '#b45309');
      vineGrad.addColorStop(0.5, '#fef08a');
      vineGrad.addColorStop(1, '#b45309');
      fx.strokeStyle = vineGrad;
      fx.lineWidth = Math.max(2, ed * 0.045);
      fx.shadowColor = 'rgba(250, 204, 21, 0.8)';
      fx.shadowBlur = 12;
      fx.stroke();
      fx.shadowBlur = 0;

      // Small glowing gem nodes along tiara
      for (let i = 1; i <= 5; i++) {
        const ga = Math.PI * 0.15 + (i * Math.PI * 0.7) / 6;
        const gx = Math.cos(ga) * hw;
        const gy = Math.sin(ga) * hh;
        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(gx, gy, Math.max(2, ed * 0.035), 0, Math.PI * 2);
        fx.fill();
      }

      // 2. 4 Animated 3D Fluttering Butterflies orbiting around the head
      const bFlies = [
        { hue0: '#67e8f9', hue1: '#06b6d4', size: ed * 0.38, speed: 0.0016, offset: 0 },
        { hue0: '#e879f9', hue1: '#a855f7', size: ed * 0.34, speed: 0.0019, offset: 1.57 },
        { hue0: '#fde047', hue1: '#f97316', size: ed * 0.32, speed: 0.0014, offset: 3.14 },
        { hue0: '#6ee7b7', hue1: '#10b981', size: ed * 0.36, speed: 0.0018, offset: 4.71 }
      ];

      for (let i = 0; i < bFlies.length; i++) {
        const bf = bFlies[i];
        const ang = t * bf.speed + bf.offset;
        const bx = Math.cos(ang) * (hw * 1.35);
        const by = Math.sin(ang) * (hh * 1.5) - ed * 0.45 + Math.sin(t * 0.004 + i) * 12;
        const flap = Math.sin(t * 0.016 + i * 1.8);

        fx.save();
        fx.translate(bx, by);
        fx.rotate(Math.sin(ang) * 0.3);

        const bs = bf.size;
        // Butterfly wings (left and right with perspective flap foreshortening)
        [-1, 1].forEach((dir) => {
          fx.save();
          fx.scale(dir * (0.3 + 0.7 * Math.abs(flap)), 1);

          // Top wing
          fx.beginPath();
          fx.moveTo(0, 0);
          fx.bezierCurveTo(bs * 0.3, -bs * 0.9, bs * 0.9, -bs * 0.7, bs * 0.7, -bs * 0.1);
          fx.bezierCurveTo(bs * 0.5, 0, 0, 0, 0, 0);
          const wg = fx.createLinearGradient(0, 0, bs * 0.8, -bs * 0.8);
          wg.addColorStop(0, '#ffffff');
          wg.addColorStop(0.4, bf.hue0);
          wg.addColorStop(1, bf.hue1);
          fx.fillStyle = wg;
          fx.fill();
          fx.strokeStyle = '#ffffff';
          fx.lineWidth = 1;
          fx.stroke();

          // Bottom wing
          fx.beginPath();
          fx.moveTo(0, 0);
          fx.bezierCurveTo(bs * 0.3, bs * 0.2, bs * 0.7, bs * 0.5, bs * 0.5, bs * 0.8);
          fx.bezierCurveTo(bs * 0.2, bs * 0.6, 0, 0, 0, 0);
          fx.fillStyle = bf.hue1;
          fx.fill();
          fx.restore();
        });

        // Butterfly slim body
        fx.fillStyle = '#0f172a';
        fx.beginPath();
        fx.ellipse(0, 0, 2, bs * 0.3, 0, 0, Math.PI * 2);
        fx.fill();

        // Sparkle dust falling from butterfly
        const spA = (Math.sin(t * 0.006 + i * 2) + 1) * 0.5;
        if (spA > 0.3) {
          fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
          fx.beginPath();
          fx.arc(0, bs * 0.5 + 4, 1.8, 0, Math.PI * 2);
          fx.fill();
        }
        fx.restore();
      }

      fx.restore();
    }
  };

export default butterflyCrownEffect;
