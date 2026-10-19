/* WebcamClicks — astral_mandala face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const astralMandalaEffect = {
    id: 'astral_mandala', name: 'Astral Spirit Mandala', icon: '🕉️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 40);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback: centered rotating cosmic mandala
        fx.save();
        fx.translate(w / 2, h / 2);
        fx.rotate(t * 0.0005);
        fx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
        fx.lineWidth = 1.5;
        for (let i = 0; i < 6; i++) {
          fx.strokeRect(-50, -50, 100, 100);
          fx.rotate(Math.PI / 6);
        }
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const mR = ed * 2.2; // Mandala radius behind head

      // 1. Giant Sacred Geometry Mandala behind the head (Screen Blend for ethereal luminescence)
      fx.save();
      // Counter-parallax: shifts slightly opposite to head motion to create 3D holographic depth!
      fx.translate(s.x - s.yaw * ed * 0.25, s.y - ed * 0.3);
      fx.rotate(t * 0.0006);
      fx.globalCompositeOperation = 'screen';

      // Outer golden aura
      const aura = fx.createRadialGradient(0, 0, mR * 0.3, 0, 0, mR * 1.15);
      aura.addColorStop(0, 'rgba(245, 158, 11, 0.35)');
      aura.addColorStop(0.5, 'rgba(168, 85, 247, 0.22)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = aura;
      fx.beginPath();
      fx.arc(0, 0, mR * 1.15, 0, Math.PI * 2);
      fx.fill();

      // Multi-layered Sacred Geometry Rings
      fx.strokeStyle = 'rgba(254, 240, 138, 0.7)';
      fx.lineWidth = Math.max(1.2, ed * 0.02);

      // Concentric circles
      [0.35, 0.55, 0.75, 0.95].forEach((kr) => {
        fx.beginPath();
        fx.arc(0, 0, mR * kr, 0, Math.PI * 2);
        fx.stroke();
      });

      // 12-Fold Sacred Flower of Life Petals
      const petals = 12;
      for (let p = 0; p < petals; p++) {
        const pa = (p * Math.PI * 2) / petals;
        const px = Math.cos(pa) * (mR * 0.55);
        const py = Math.sin(pa) * (mR * 0.55);
        fx.beginPath();
        fx.arc(px, py, mR * 0.55, 0, Math.PI * 2);
        fx.stroke();
      }

      // Intersecting Golden Triangles (Star Dodecagram)
      for (let st = 0; st < 4; st++) {
        fx.save();
        fx.rotate((st * Math.PI) / 6);
        fx.beginPath();
        for (let a = 0; a < 3; a++) {
          const ta = (a * Math.PI * 2) / 3 - Math.PI / 2;
          const tx = Math.cos(ta) * (mR * 0.92);
          const ty = Math.sin(ta) * (mR * 0.92);
          if (a === 0) fx.moveTo(tx, ty); else fx.lineTo(tx, ty);
        }
        fx.closePath();
        fx.stroke();
        fx.restore();
      }
      fx.restore();

      // 2. Mystic Glowing Third Eye on Forehead
      fx.save();
      const thirdEyeY = s.y - ed * 0.45;
      fx.translate(s.x, thirdEyeY);
      fx.rotate(s.a);
      fx.translate(s.yaw * ed * 0.1, 0);

      const eyeW = ed * 0.32;
      const eyeH = ed * 0.18;

      // Ethereal vertical spirit beam
      const bGrad = fx.createLinearGradient(0, -eyeH * 3, 0, eyeH);
      bGrad.addColorStop(0, 'rgba(56, 189, 248, 0)');
      bGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.45)');
      bGrad.addColorStop(1, 'rgba(254, 240, 138, 0.7)');
      fx.fillStyle = bGrad;
      fx.fillRect(-2, -eyeH * 4, 4, eyeH * 4);

      // Third Eye Golden Almond Rim
      fx.beginPath();
      fx.moveTo(-eyeW * 0.5, 0);
      fx.quadraticCurveTo(0, -eyeH, eyeW * 0.5, 0);
      fx.quadraticCurveTo(0, eyeH, -eyeW * 0.5, 0);
      fx.closePath();
      fx.fillStyle = '#0f172a';
      fx.fill();
      fx.strokeStyle = '#fef08a';
      fx.lineWidth = 2;
      fx.shadowColor = '#facc15';
      fx.shadowBlur = 8;
      fx.stroke();
      fx.shadowBlur = 0;

      // Mystic Sapphire / Opal Iris
      const irisGrad = fx.createRadialGradient(0, 0, 0, 0, 0, eyeH * 0.7);
      irisGrad.addColorStop(0, '#ffffff');
      irisGrad.addColorStop(0.3, '#38bdf8');
      irisGrad.addColorStop(0.7, '#7c3aed');
      irisGrad.addColorStop(1, '#0f172a');
      fx.fillStyle = irisGrad;
      fx.beginPath();
      fx.arc(0, 0, eyeH * 0.65, 0, Math.PI * 2);
      fx.fill();

      // Slit pupil
      fx.fillStyle = '#ffffff';
      fx.beginPath();
      fx.ellipse(0, 0, 1.5, eyeH * 0.4, 0, 0, Math.PI * 2);
      fx.fill();

      // Floating golden spirit dust drifting upwards from third eye
      for (let m = 0; m < 6; m++) {
        const ma = t * 0.003 + m * 1.05;
        const mx = Math.sin(ma) * (eyeW * 0.7);
        const my = -((t * 0.04 + m * 24) % (ed * 1.2));
        fx.fillStyle = 'rgba(254, 240, 138, 0.8)';
        fx.beginPath();
        fx.arc(mx, my, Math.max(1, ed * 0.02), 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
    }
  };

export default astralMandalaEffect;
