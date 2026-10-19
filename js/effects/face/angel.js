/* WebcamClicks — angel face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const angelEffect = {
    id: 'angel', name: 'Golden Halo', icon: '😇', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 45);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const bob = Math.sin(t * 0.0032) * (eyeDist * 0.09);
      const hw = eyeDist * 1.05;
      const hh = eyeDist * 0.28;

      fx.save();
      fx.translate(s.x, s.y - eyeDist * 1.45 + bob);
      fx.rotate(s.a * 0.55);
      fx.translate(s.yaw * s.headW * 0.06, 0);

      // 1. Ambient Celestial Glow
      const glowGrad = fx.createRadialGradient(0, 0, hh * 0.4, 0, 0, hw * 1.25);
      glowGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
      glowGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.18)');
      glowGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      fx.fillStyle = glowGrad;
      fx.beginPath();
      fx.ellipse(0, 0, hw * 1.25, hh * 1.5, 0, 0, Math.PI * 2);
      fx.fill();

      // 2. Main 3D Metallic Golden Torus Ring
      fx.beginPath();
      fx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);

      const torusGrad = fx.createLinearGradient(-hw, 0, hw, 0);
      torusGrad.addColorStop(0, '#ca8a04');
      torusGrad.addColorStop(0.25, '#fef08a');
      torusGrad.addColorStop(0.5, '#eab308');
      torusGrad.addColorStop(0.75, '#fef08a');
      torusGrad.addColorStop(1, '#a16207');

      fx.shadowColor = 'rgba(250, 204, 21, 0.9)';
      fx.shadowBlur = 22;
      fx.strokeStyle = torusGrad;
      fx.lineWidth = Math.max(4.5, eyeDist * 0.09);
      fx.stroke();

      // 3. Bright Specular Apex Core Ring
      fx.shadowColor = '#ffffff';
      fx.shadowBlur = 10;
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.8, eyeDist * 0.035);
      fx.beginPath();
      fx.ellipse(0, -hh * 0.15, hw * 0.98, hh * 0.85, 0, 0, Math.PI * 2);
      fx.stroke();
      fx.shadowBlur = 0;

      // 4. Drifting Celestial Sparkles
      for (let i = 0; i < 6; i++) {
        const starAngle = (t * 0.0018 + (i * Math.PI) / 3) % (Math.PI * 2);
        const floatUp = ((t * 0.04 + i * 25) % 40) - 20;
        const sx = Math.cos(starAngle) * (hw + 14);
        const sy = Math.sin(starAngle) * (hh + 8) + floatUp;
        const sparkA = (Math.sin(t * 0.005 + i * 1.5) + 1) * 0.45;

        if (sparkA > 0.1) {
          fx.fillStyle = `rgba(255, 255, 255, ${sparkA})`;
          fx.beginPath();
          fx.arc(sx, sy, Math.max(1.5, 2.5 * sparkA), 0, Math.PI * 2);
          fx.fill();
        }
      }

      fx.restore();
    }
  };

export default angelEffect;
