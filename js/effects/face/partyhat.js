/* WebcamClicks — partyhat face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const partyhatEffect = {
    id: 'partyhat', name: 'Party Hat', icon: '🥳', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 45);
      if (!s) return;

      const t = frame.time || performance.now();
      const hw = s.eyeDist * 1.1;
      const hh = s.eyeDist * 1.6;
      const rx = hw * 0.52;
      const ry = hw * 0.18;

      fx.save();
      fx.translate(s.x, s.y - s.eyeDist * 1.08);
      fx.rotate(s.a);
      fx.translate(s.yaw * s.headW * 0.08, 0);
      fx.scale(1 - 0.08 * Math.abs(s.yaw), 1);

      // 1. Soft contact shadow on skull/forehead
      fx.save();
      fx.translate(0, 10);
      fx.scale(1, ry / rx);
      const sh = fx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.1);
      sh.addColorStop(0, 'rgba(0,0,0,0.38)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = sh;
      fx.beginPath();
      fx.arc(0, 0, rx * 1.1, 0, Math.PI * 2);
      fx.fill();
      fx.restore();

      // Helper to trace 3D cone with curved elliptical base
      const traceCone = () => {
        fx.beginPath();
        fx.moveTo(-rx, 0);
        fx.lineTo(0, -hh);
        fx.lineTo(rx, 0);
        fx.ellipse(0, 0, rx, ry, 0, 0, Math.PI, false);
        fx.closePath();
      };

      // 2. Base cone body with metallic gradient
      traceCone();
      const bgGrad = fx.createLinearGradient(-rx, 0, rx, 0);
      bgGrad.addColorStop(0, '#be123c');
      bgGrad.addColorStop(0.35, '#f43f5e');
      bgGrad.addColorStop(0.7, '#fb7185');
      bgGrad.addColorStop(1, '#881337');
      fx.fillStyle = bgGrad;
      fx.fill();

      // 3. Crisp metallic spiral candy stripes
      fx.save();
      traceCone();
      fx.clip();

      const numStripes = 6;
      for (let i = -1; i <= numStripes; i++) {
        const yTop = -hh + (i * hh) / numStripes;
        const yBot = yTop + hh * 0.28;
        fx.beginPath();
        fx.moveTo(-rx * 1.2, yBot + ry * 2);
        fx.lineTo(rx * 1.2, yTop - ry * 2);
        fx.lineTo(rx * 1.2, yTop + hh * 0.16 - ry * 2);
        fx.lineTo(-rx * 1.2, yBot + hh * 0.16 + ry * 2);
        fx.closePath();

        const goldS = fx.createLinearGradient(-rx, 0, rx, 0);
        goldS.addColorStop(0, '#b45309');
        goldS.addColorStop(0.3, '#fef08a');
        goldS.addColorStop(0.6, '#f59e0b');
        goldS.addColorStop(1, '#78350f');
        fx.fillStyle = goldS;
        fx.fill();

        fx.strokeStyle = 'rgba(255,255,255,0.6)';
        fx.lineWidth = 2;
        fx.beginPath();
        fx.moveTo(-rx * 1.2, yTop + hh * 0.08 - ry * 2);
        fx.lineTo(rx * 1.2, yBot + hh * 0.08 + ry * 2);
        fx.stroke();
      }

      // 3D cylindrical lighting overlay
      const lightGrad = fx.createLinearGradient(-rx, 0, rx, 0);
      lightGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
      lightGrad.addColorStop(0.28, 'rgba(255,255,255,0.32)');
      lightGrad.addColorStop(0.65, 'rgba(255,255,255,0)');
      lightGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
      fx.fillStyle = lightGrad;
      fx.fillRect(-rx, -hh - 10, rx * 2, hh + ry * 2 + 20);
      fx.restore();

      // 4. Ruffled golden tinsel base trim with beads
      fx.save();
      for (let a = 0; a <= Math.PI; a += 0.14) {
        const bx = Math.cos(a) * rx;
        const by = Math.sin(a) * ry;
        const br = 4.2 * (0.6 + 0.4 * Math.sin(a));
        const bg = fx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
        bg.addColorStop(0, '#fef08a');
        bg.addColorStop(0.6, '#f59e0b');
        bg.addColorStop(1, '#92400e');
        fx.fillStyle = bg;
        fx.beginPath();
        fx.arc(bx, by, br, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();

      // 5. 3D Fluffy Golden Pom-Pom on the apex
      const pomX = 0, pomY = -hh - 6, pomR = hw * 0.16;
      fx.save();
      const pomGrad = fx.createRadialGradient(pomX - pomR * 0.35, pomY - pomR * 0.35, 2, pomX, pomY, pomR);
      pomGrad.addColorStop(0, '#ffffff');
      pomGrad.addColorStop(0.3, '#fef08a');
      pomGrad.addColorStop(0.7, '#f59e0b');
      pomGrad.addColorStop(1, '#b45309');
      fx.fillStyle = pomGrad;
      fx.beginPath();
      fx.arc(pomX, pomY, pomR, 0, Math.PI * 2);
      fx.fill();

      // Pom-pom fluffy fringe wisps
      fx.strokeStyle = '#fde68a';
      fx.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) {
        const fa = (i / 14) * Math.PI * 2 + Math.sin(t * 0.003 + i) * 0.1;
        const fl = pomR * (1.1 + 0.25 * Math.sin(i * 3 + t * 0.004));
        fx.beginPath();
        fx.moveTo(pomX, pomY);
        fx.lineTo(pomX + Math.cos(fa) * fl, pomY + Math.sin(fa) * fl);
        fx.stroke();
      }

      // Sparkle on pom-pom
      const sparkle = (Math.sin(t * 0.005) + 1) * 0.5;
      if (sparkle > 0.4) {
        fx.fillStyle = `rgba(255,255,255,${sparkle * 0.9})`;
        fx.beginPath();
        fx.arc(pomX - pomR * 0.3, pomY - pomR * 0.3, pomR * 0.35, 0, Math.PI * 2);
        fx.fill();
      }

      // 6. Fluttering curling party ribbons attached to the pom-pom
      const ribbons = [
        { color: '#38bdf8', len: hw * 0.9, phase: 0 },
        { color: '#ec4899', len: hw * 1.1, phase: 1.8 },
        { color: '#facc15', len: hw * 0.8, phase: 3.4 }
      ];
      ribbons.forEach((rib) => {
        fx.beginPath();
        fx.moveTo(pomX, pomY);
        let rxCur = pomX;
        let ryCur = pomY;
        const steps = 6;
        for (let j = 1; j <= steps; j++) {
          const frac = j / steps;
          const swayRib = Math.sin(t * 0.004 + rib.phase + j * 0.8) * (14 * frac);
          rxCur = pomX + swayRib + (rib.phase > 2 ? 8 : -8) * frac;
          ryCur = pomY + rib.len * frac;
          fx.lineTo(rxCur, ryCur);
        }
        fx.strokeStyle = rib.color;
        fx.lineWidth = 2.4;
        fx.lineCap = 'round';
        fx.stroke();
      });

      fx.restore();
      fx.restore();
    }
  };

export default partyhatEffect;
