/* WebcamClicks — elven_tiara face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const elvenTiaraEffect = {
    id: 'elven_tiara', name: 'Ethereal Forest Elf Tiara', icon: '🧝', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 40);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback: centered silver tiara preview
        fx.save();
        fx.translate(w / 2, h / 2);
        fx.strokeStyle = '#e2e8f0';
        fx.lineWidth = 2;
        fx.beginPath();
        fx.ellipse(0, 0, 50, 20, 0, 0, Math.PI * 2);
        fx.stroke();
        fx.fillStyle = '#38bdf8';
        fx.beginPath();
        fx.arc(0, -10, 5, 0, Math.PI * 2);
        fx.fill();
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const hw = Math.max(ed * 1.5, s.headW);

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * hw * 0.08, 0);

      // 1. Pointed Luminous Elven Ears on Sides of Head!
      [-hw * 0.52, hw * 0.52].forEach((ex, idx) => {
        const dir = idx === 0 ? -1 : 1;
        fx.save();
        fx.translate(ex, -ed * 0.15);

        // Pointed elf ear outer curve
        fx.beginPath();
        fx.moveTo(0, ed * 0.3);
        fx.quadraticCurveTo(dir * ed * 0.2, ed * 0.1, dir * ed * 0.55, -ed * 0.45); // Sharp elven tip!
        fx.quadraticCurveTo(dir * ed * 0.15, -ed * 0.25, 0, -ed * 0.1);
        fx.closePath();

        // Soft skin/glow gradient
        const earGrad = fx.createLinearGradient(0, 0, dir * ed * 0.55, -ed * 0.45);
        earGrad.addColorStop(0, 'rgba(254, 215, 170, 0.7)');
        earGrad.addColorStop(0.7, 'rgba(251, 146, 60, 0.6)');
        earGrad.addColorStop(1, '#ffffff');
        fx.fillStyle = earGrad;
        fx.fill();

        fx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fx.lineWidth = 1.5;
        fx.shadowColor = 'rgba(167, 243, 208, 0.8)';
        fx.shadowBlur = 6;
        fx.stroke();
        fx.shadowBlur = 0;
        fx.restore();
      });

      // 2. Silver Mithril Filigree Tiara across Forehead
      const tiaraY = -ed * 0.65;
      const tW = ed * 1.1;
      const tH = ed * 0.24;

      fx.save();
      fx.translate(0, tiaraY);

      // Organic curved arch
      fx.beginPath();
      fx.ellipse(0, 0, tW, tH, 0, Math.PI * 0.08, Math.PI * 0.92);
      const silverGrad = fx.createLinearGradient(-tW, 0, tW, 0);
      silverGrad.addColorStop(0, '#94a3b8');
      silverGrad.addColorStop(0.5, '#ffffff');
      silverGrad.addColorStop(1, '#94a3b8');
      fx.strokeStyle = silverGrad;
      fx.lineWidth = Math.max(2, ed * 0.04);
      fx.shadowColor = 'rgba(255, 255, 255, 0.9)';
      fx.shadowBlur = 8;
      fx.stroke();
      fx.shadowBlur = 0;

      // Delicate leaves along tiara
      for (let l = 1; l <= 5; l++) {
        const la = Math.PI * 0.15 + (l * Math.PI * 0.7) / 6;
        const lx = Math.cos(la) * tW;
        const ly = Math.sin(la) * tH;
        fx.fillStyle = '#6ee7b7';
        fx.beginPath();
        fx.ellipse(lx, ly, ed * 0.06, ed * 0.03, la - Math.PI / 2, 0, Math.PI * 2);
        fx.fill();
      }

      // 3. Central Starlight Teardrop Diamond Gem on Forehead
      const gemGrad = fx.createRadialGradient(0, tH * 0.8, 0, 0, tH * 0.8, ed * 0.14);
      gemGrad.addColorStop(0, '#ffffff');
      gemGrad.addColorStop(0.4, '#38bdf8');
      gemGrad.addColorStop(1, '#0284c7');
      fx.fillStyle = gemGrad;
      fx.beginPath();
      fx.arc(0, tH * 0.8, ed * 0.08, 0, Math.PI * 2);
      fx.fill();
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = 1;
      fx.stroke();

      // 4-point Diamond Starlight Sparkle
      const sparkSize = ed * 0.22 * (0.8 + 0.2 * Math.sin(t * 0.005));
      fx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      fx.lineWidth = 1.5;
      fx.beginPath();
      fx.moveTo(0, tH * 0.8 - sparkSize); fx.lineTo(0, tH * 0.8 + sparkSize);
      fx.moveTo(-sparkSize, tH * 0.8); fx.lineTo(sparkSize, tH * 0.8);
      fx.stroke();

      fx.restore();

      // 4. Bioluminescent Forest Fireflies orbiting around the head
      for (let f = 0; f < 7; f++) {
        const fa = t * 0.002 + f * 0.95;
        const fr = hw * (0.65 + 0.25 * Math.sin(t * 0.001 + f));
        const fxPos = Math.cos(fa) * fr;
        const fyPos = Math.sin(fa) * (ed * 0.7) - ed * 0.35 + Math.sin(t * 0.003 + f) * 15;
        const glow = fx.createRadialGradient(fxPos, fyPos, 0, fxPos, fyPos, 12);
        glow.addColorStop(0, '#ffffff');
        glow.addColorStop(0.35, '#6ee7b7');
        glow.addColorStop(1, 'rgba(16, 185, 129, 0)');
        fx.fillStyle = glow;
        fx.beginPath();
        fx.arc(fxPos, fyPos, 12, 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
    }
  };

export default elvenTiaraEffect;
