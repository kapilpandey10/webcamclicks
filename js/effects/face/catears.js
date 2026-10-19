/* WebcamClicks — catears face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const catearsEffect = {
    id: 'catears', name: 'Cat Ears & Whiskers', icon: '🐱', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 40);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const earW = eyeDist * 0.72;
      const earH = eyeDist * 0.95;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);

      // Twitch animation occasionally
      const twitch = Math.sin(t * 0.002) > 0.94 ? Math.sin(t * 0.03) * 0.15 : 0;

      // 1. Render Left & Right Cat Ears
      for (const side of [-1, 1]) {
        const earX = side * eyeDist * 0.85;
        const earY = -eyeDist * 1.05;

        fx.save();
        fx.translate(earX, earY);
        fx.rotate(side * 0.22 + (side === 1 ? twitch : 0));

        // Outer Ear
        fx.beginPath();
        fx.moveTo(-earW * 0.45, earH * 0.35);
        fx.bezierCurveTo(-earW * 0.4, -earH * 0.3, -earW * 0.1, -earH * 0.8, 0, -earH);
        fx.bezierCurveTo(earW * 0.2, -earH * 0.7, earW * 0.45, -earH * 0.2, earW * 0.45, earH * 0.35);
        fx.closePath();

        const catEarGrad = fx.createLinearGradient(-earW * 0.3, 0, earW * 0.3, -earH);
        catEarGrad.addColorStop(0, '#f43f5e');
        catEarGrad.addColorStop(0.5, '#fb7185');
        catEarGrad.addColorStop(1, '#e11d48');
        fx.fillStyle = catEarGrad;
        fx.fill();
        fx.strokeStyle = '#be123c';
        fx.lineWidth = 2.2;
        fx.stroke();

        // Inner Ear Fluff (Plush Pink)
        fx.beginPath();
        fx.moveTo(-earW * 0.25, earH * 0.25);
        fx.bezierCurveTo(-earW * 0.2, -earH * 0.2, 0, -earH * 0.65, 0, -earH * 0.8);
        fx.bezierCurveTo(earW * 0.1, -earH * 0.55, earW * 0.25, -earH * 0.1, earW * 0.25, earH * 0.25);
        fx.closePath();
        fx.fillStyle = '#fed7e2';
        fx.fill();

        // White inner fur wisps
        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 2;
        for (let f = -2; f <= 2; f++) {
          fx.beginPath();
          fx.moveTo(-earW * 0.15, earH * 0.1 + f * 5);
          fx.lineTo(earW * 0.1, earH * 0.05 + f * 6);
          fx.stroke();
        }
        fx.restore();
      }

      // 2. Rosy Cheek Blush
      fx.fillStyle = 'rgba(244, 63, 94, 0.32)';
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.ellipse(side * eyeDist * 0.9, eyeDist * 0.38, eyeDist * 0.28, eyeDist * 0.16, side * 0.08, 0, Math.PI * 2);
        fx.fill();
      }

      // 3. Cute Pink Cat Button Nose
      const ny = eyeDist * 0.42;
      const nw = eyeDist * 0.26;
      const nh = eyeDist * 0.16;

      fx.beginPath();
      fx.moveTo(-nw * 0.5, ny - nh * 0.3);
      fx.quadraticCurveTo(0, ny - nh * 0.5, nw * 0.5, ny - nh * 0.3);
      fx.quadraticCurveTo(nw * 0.45, ny + nh * 0.5, 0, ny + nh * 0.65);
      fx.quadraticCurveTo(-nw * 0.45, ny + nh * 0.5, -nw * 0.5, ny - nh * 0.3);
      fx.closePath();

      const pinkNoseGrad = fx.createRadialGradient(0, ny - nh * 0.2, 1, 0, ny, nw * 0.5);
      pinkNoseGrad.addColorStop(0, '#fbcfe8');
      pinkNoseGrad.addColorStop(0.6, '#ec4899');
      pinkNoseGrad.addColorStop(1, '#db2777');
      fx.fillStyle = pinkNoseGrad;
      fx.fill();

      // Specular shine on nose
      fx.beginPath();
      fx.ellipse(-nw * 0.15, ny - nh * 0.2, nw * 0.14, nh * 0.18, -0.2, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fill();

      // 4. Graceful 6 Whiskers with natural sway
      fx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      fx.lineWidth = Math.max(1.8, eyeDist * 0.032);
      fx.lineCap = 'round';

      for (const side of [-1, 1]) {
        const startX = side * eyeDist * 0.22;
        const wy = ny + eyeDist * 0.05;
        const angles = [-0.18, 0.02, 0.22];

        // Whisker root dots
        fx.fillStyle = 'rgba(225, 29, 72, 0.65)';
        angles.forEach((ang) => {
          fx.beginPath();
          fx.arc(startX, wy + ang * eyeDist * 0.5, 2, 0, Math.PI * 2);
          fx.fill();
        });

        // Curved whiskers
        angles.forEach((ang, idx) => {
          const swayW = Math.sin(t * 0.003 + idx * 0.8) * 3;
          fx.beginPath();
          fx.moveTo(startX, wy + ang * eyeDist * 0.5);
          fx.quadraticCurveTo(
            startX + side * eyeDist * 0.55,
            wy + ang * eyeDist * 0.7 + swayW,
            startX + side * eyeDist * 1.15,
            wy + ang * eyeDist * 1.15 + swayW * 1.5
          );
          fx.stroke();
        });
      }

      fx.restore();
    }
  };

export default catearsEffect;
