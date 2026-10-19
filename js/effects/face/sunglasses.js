/* WebcamClicks — sunglasses face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const sunglassesEffect = {
    id: 'sunglasses', name: 'Cool Shades', icon: '🕶️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 35);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const rw = eyeDist * 0.54;
      const rh = rw * 0.78;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * s.headW * 0.05, 0);

      // Glasses shadow on cheek
      fx.save();
      fx.translate(0, rh * 0.15);
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.ellipse((side * eyeDist) / 2, 0, rw * 1.05, rh * 1.05, 0, 0, Math.PI * 2);
        fx.fillStyle = 'rgba(0,0,0,0.22)';
        fx.fill();
      }
      fx.restore();

      // 1. Wayfarer Frames (outer rim)
      for (const side of [-1, 1]) {
        const cx = (side * eyeDist) / 2;
        fx.beginPath();
        fx.moveTo(cx - rw * 0.95 * side, -rh * 0.85);
        fx.lineTo(cx + rw * 0.95 * side, -rh * 0.7);
        fx.quadraticCurveTo(cx + rw * 1.08 * side, rh * 0.2, cx + rw * 0.7 * side, rh * 0.9);
        fx.quadraticCurveTo(cx, rh * 1.05, cx - rw * 0.7 * side, rh * 0.85);
        fx.quadraticCurveTo(cx - rw * 1.05 * side, rh * 0.1, cx - rw * 0.95 * side, -rh * 0.85);
        fx.closePath();

        const frameGrad = fx.createLinearGradient(cx - rw, -rh, cx + rw, rh);
        frameGrad.addColorStop(0, '#1e293b');
        frameGrad.addColorStop(0.5, '#0f172a');
        frameGrad.addColorStop(1, '#020617');
        fx.fillStyle = frameGrad;
        fx.fill();

        // 2. Polarized Lenses (gradient tint)
        fx.save();
        fx.beginPath();
        fx.ellipse(cx, rh * 0.05, rw * 0.82, rh * 0.72, side * 0.06, 0, Math.PI * 2);
        fx.clip();

        const lensGrad = fx.createLinearGradient(0, -rh * 0.7, 0, rh * 0.8);
        lensGrad.addColorStop(0, 'rgba(6, 8, 15, 0.94)');
        lensGrad.addColorStop(0.65, 'rgba(15, 23, 42, 0.88)');
        lensGrad.addColorStop(1, 'rgba(30, 41, 59, 0.82)');
        fx.fillStyle = lensGrad;
        fx.fillRect(cx - rw, -rh, rw * 2, rh * 2);

        // 3. Dynamic Specular Reflection sweep across lenses
        const sweepX = Math.sin(s.a * 2.5 + t * 0.001) * (rw * 0.4);
        fx.beginPath();
        fx.moveTo(cx - rw * 0.5 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.1 + sweepX, -rh * 0.8);
        fx.lineTo(cx - rw * 0.2 + sweepX, rh * 0.8);
        fx.lineTo(cx - rw * 0.8 + sweepX, rh * 0.8);
        fx.closePath();
        fx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        fx.fill();

        // Secondary thin glint line
        fx.beginPath();
        fx.moveTo(cx + rw * 0.25 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.4 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.1 + sweepX, rh * 0.8);
        fx.lineTo(cx - rw * 0.05 + sweepX, rh * 0.8);
        fx.closePath();
        fx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        fx.fill();
        fx.restore();

        // 4. Metallic silver corner rivets
        fx.beginPath();
        fx.arc(cx + side * rw * 0.88, -rh * 0.65, 2.2, 0, Math.PI * 2);
        fx.fillStyle = '#e2e8f0';
        fx.fill();
        fx.strokeStyle = '#64748b';
        fx.lineWidth = 0.8;
        fx.stroke();
      }

      // 5. Sturdy Bridge
      fx.beginPath();
      fx.moveTo(-eyeDist * 0.18, -rh * 0.55);
      fx.quadraticCurveTo(0, -rh * 0.72, eyeDist * 0.18, -rh * 0.55);
      fx.lineWidth = Math.max(3.5, eyeDist * 0.055);
      fx.strokeStyle = '#0f172a';
      fx.lineCap = 'round';
      fx.stroke();

      // Top bridge highlight
      fx.beginPath();
      fx.moveTo(-eyeDist * 0.14, -rh * 0.58);
      fx.quadraticCurveTo(0, -rh * 0.75, eyeDist * 0.14, -rh * 0.58);
      fx.lineWidth = 1.2;
      fx.strokeStyle = 'rgba(255,255,255,0.45)';
      fx.stroke();

      fx.restore();
    }
  };

export default sunglassesEffect;
