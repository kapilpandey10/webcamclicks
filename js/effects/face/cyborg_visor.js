/* WebcamClicks — cyborg_visor face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const cyborgVisorEffect = {
    id: 'cyborg_visor', name: 'Cyber Cyborg Visor', icon: '🥽', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 40);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback: ambient cyber corner brackets when searching for face
        fx.save();
        fx.strokeStyle = 'rgba(0, 240, 255, 0.5)';
        fx.lineWidth = 2;
        const bs = Math.max(16, Math.round(w * 0.04));
        fx.strokeRect(bs, bs, w - bs * 2, h - bs * 2);
        fx.font = 'bold 12px "Courier New", monospace';
        fx.fillStyle = '#00f0ff';
        fx.fillText('OPTIC SCANNER: ACQUIRING TARGET...', bs + 8, bs + 20);
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const hw = Math.max(ed * 1.6, s.headW);
      const vW = hw * 1.05;
      const vH = ed * 0.72;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * hw * 0.1, 0);

      // 1. Visor curved aerodynamic frame
      fx.beginPath();
      fx.moveTo(-vW * 0.5, -vH * 0.4);
      fx.lineTo(vW * 0.5, -vH * 0.4);
      fx.quadraticCurveTo(vW * 0.55, vH * 0.5, 0, vH * 0.55);
      fx.quadraticCurveTo(-vW * 0.55, vH * 0.5, -vW * 0.5, -vH * 0.4);
      fx.closePath();

      // Tinted holographic glass fill
      const vGrad = fx.createLinearGradient(0, -vH * 0.4, 0, vH * 0.55);
      vGrad.addColorStop(0, 'rgba(6, 182, 212, 0.45)');
      vGrad.addColorStop(0.5, 'rgba(15, 23, 42, 0.65)');
      vGrad.addColorStop(1, 'rgba(0, 240, 255, 0.35)');
      fx.fillStyle = vGrad;
      fx.fill();

      // Glowing neon cyan visor rim
      fx.strokeStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 14;
      fx.lineWidth = Math.max(2, ed * 0.04);
      fx.stroke();
      fx.shadowBlur = 0;

      // 2. Horizontal scanning laser beam traversing across visor
      const laserX = (Math.sin(t * 0.003) * 0.45) * vW;
      const lGrad = fx.createLinearGradient(laserX - 12, 0, laserX + 12, 0);
      lGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      lGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.9)');
      lGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = lGrad;
      fx.fillRect(laserX - 12, -vH * 0.4, 24, vH * 0.9);

      // 3. Dual pupil targeting reticles
      const eyeDx = ed * 0.5;
      const pr = ed * 0.28;
      [-eyeDx, eyeDx].forEach((px) => {
        fx.save();
        fx.translate(px, 0);
        fx.rotate(t * 0.002);
        fx.strokeStyle = '#facc15';
        fx.lineWidth = 1.5;
        // Rotating dashed reticle ring
        for (let a = 0; a < 4; a++) {
          fx.beginPath();
          fx.arc(0, 0, pr, a * Math.PI * 0.5 + 0.15, a * Math.PI * 0.5 + 0.6);
          fx.stroke();
        }
        // Center cross
        fx.strokeStyle = '#00f0ff';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(-pr * 0.4, 0); fx.lineTo(pr * 0.4, 0);
        fx.moveTo(0, -pr * 0.4); fx.lineTo(0, pr * 0.4);
        fx.stroke();
        fx.restore();
      });

      // 4. Biometric HUD telemetry labels near temples
      const fs = Math.max(8, Math.round(ed * 0.14));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.textBaseline = 'top';
      fx.fillStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 4;
      fx.fillText('OPTIC: 120 FPS', -vW * 0.46, -vH * 0.32);
      fx.fillText('PUPIL: LOCKED', -vW * 0.46, -vH * 0.32 + fs * 1.3);

      fx.textAlign = 'right';
      fx.fillStyle = '#39ff14';
      fx.fillText('TARGET: HOMINID', vW * 0.46, -vH * 0.32);
      fx.fillText('SYNC: 99.8%', vW * 0.46, -vH * 0.32 + fs * 1.3);

      // 5. Circuit traces extending along cheekbones
      fx.strokeStyle = 'rgba(0, 240, 255, 0.65)';
      fx.lineWidth = 1.5;
      [-vW * 0.5, vW * 0.5].forEach((cx, idx) => {
        const dir = idx === 0 ? -1 : 1;
        fx.beginPath();
        fx.moveTo(cx, 0);
        fx.lineTo(cx + dir * 18, vH * 0.3);
        fx.lineTo(cx + dir * 28, vH * 0.7);
        fx.stroke();
        fx.fillStyle = '#facc15';
        fx.beginPath();
        fx.arc(cx + dir * 28, vH * 0.7, 2, 0, Math.PI * 2);
        fx.fill();
      });

      fx.restore();
    }
  };

export default cyborgVisorEffect;
