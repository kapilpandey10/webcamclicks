/* WebcamClicks — dogears face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const dogearsEffect = {
    id: 'dogears', name: 'Puppy Ears', icon: '🐶', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 40);
      if (!s) return;

      const dtSec = clamp(frame.dt || 16, 1, 100) / 1000;
      if (!this._sway) this._sway = { aL: 0, vL: 0, aR: 0, vR: 0, lastA: s.a };
      const dAngle = s.a - this._sway.lastA;
      this._sway.lastA = s.a;

      // Realistic spring physics for floppy ears
      this._sway.vL += (-this._sway.aL * 24 - dAngle * 65) * dtSec - this._sway.vL * (6 * dtSec);
      this._sway.aL = clamp(this._sway.aL + this._sway.vL * dtSec, -0.6, 0.6);
      this._sway.vR += (-this._sway.aR * 24 - dAngle * 65) * dtSec - this._sway.vR * (6 * dtSec);
      this._sway.aR = clamp(this._sway.aR + this._sway.vR * dtSec, -0.6, 0.6);

      const eyeDist = s.eyeDist;
      const earW = eyeDist * 0.65;
      const earH = eyeDist * 1.25;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);

      // Render Left & Right Floppy Ears with 3D fur texture and bounce
      for (const side of [-1, 1]) {
        const sway = side === -1 ? this._sway.aL : this._sway.aR;
        const earRootX = side * eyeDist * 0.95;
        const earRootY = -eyeDist * 0.72;

        fx.save();
        fx.translate(earRootX, earRootY);
        fx.rotate(side * 0.28 + sway);

        // 1. Outer Fur Layer with warm golden-retriever gradient
        fx.beginPath();
        fx.moveTo(-earW * 0.35, 0);
        fx.bezierCurveTo(-earW * 0.6, -earH * 0.15, -earW * 0.75, earH * 0.4, -earW * 0.3, earH);
        fx.quadraticCurveTo(0, earH * 1.15, earW * 0.35, earH * 0.95);
        fx.bezierCurveTo(earW * 0.7, earH * 0.5, earW * 0.45, -earH * 0.1, earW * 0.2, 0);
        fx.closePath();

        const furGrad = fx.createLinearGradient(-earW * 0.5, 0, earW * 0.5, earH);
        furGrad.addColorStop(0, '#854d0e');
        furGrad.addColorStop(0.35, '#b45309');
        furGrad.addColorStop(0.7, '#d97706');
        furGrad.addColorStop(1, '#78350f');
        fx.fillStyle = furGrad;
        fx.fill();

        // 2. Inner Ear Velvet Pink Flap
        fx.beginPath();
        fx.moveTo(-earW * 0.18, earH * 0.15);
        fx.bezierCurveTo(-earW * 0.4, earH * 0.4, -earW * 0.35, earH * 0.75, -earW * 0.08, earH * 0.88);
        fx.quadraticCurveTo(earW * 0.08, earH * 0.92, earW * 0.18, earH * 0.82);
        fx.bezierCurveTo(earW * 0.35, earH * 0.6, earW * 0.3, earH * 0.3, earW * 0.12, earH * 0.15);
        fx.closePath();

        const pinkGrad = fx.createLinearGradient(0, earH * 0.15, 0, earH * 0.9);
        pinkGrad.addColorStop(0, '#fca5a5');
        pinkGrad.addColorStop(0.5, '#f43f5e');
        pinkGrad.addColorStop(1, '#9f1239');
        fx.fillStyle = pinkGrad;
        fx.fill();

        // 3. Fold highlight on cartilage
        fx.beginPath();
        fx.ellipse(0, 0, earW * 0.35, earW * 0.14, side * 0.2, 0, Math.PI * 2);
        fx.fillStyle = '#fde68a';
        fx.globalAlpha = 0.55;
        fx.fill();
        fx.globalAlpha = 1;

        fx.restore();
      }

      // 4. Adorable Puppy Button Nose
      const nw = eyeDist * 0.38;
      const nh = eyeDist * 0.26;
      fx.save();
      fx.translate(s.noseX - s.x, s.noseY - s.y);

      // Nose drop shadow
      fx.beginPath();
      fx.ellipse(0, nh * 0.25, nw * 0.52, nh * 0.45, 0, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      fx.fill();

      // Sculpted black leather nose
      fx.beginPath();
      fx.moveTo(-nw * 0.45, -nh * 0.35);
      fx.quadraticCurveTo(0, -nh * 0.55, nw * 0.45, -nh * 0.35);
      fx.bezierCurveTo(nw * 0.55, nh * 0.1, nw * 0.25, nh * 0.5, 0, nh * 0.55);
      fx.bezierCurveTo(-nw * 0.25, nh * 0.5, -nw * 0.55, nh * 0.1, -nw * 0.45, -nh * 0.35);
      fx.closePath();

      const noseGrad = fx.createRadialGradient(-nw * 0.15, -nh * 0.2, 1, 0, 0, nw * 0.6);
      noseGrad.addColorStop(0, '#334155');
      noseGrad.addColorStop(0.4, '#0f172a');
      noseGrad.addColorStop(1, '#020617');
      fx.fillStyle = noseGrad;
      fx.fill();

      // Nostril slits
      for (const nSide of [-1, 1]) {
        fx.beginPath();
        fx.ellipse(nSide * nw * 0.22, nh * 0.1, nw * 0.1, nh * 0.14, nSide * 0.35, 0, Math.PI * 2);
        fx.fillStyle = '#000000';
        fx.fill();
      }

      // Wet leather specular highlight glint
      fx.beginPath();
      fx.ellipse(-nw * 0.15, -nh * 0.22, nw * 0.18, nh * 0.09, -0.25, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fill();

      // Cute whisker freckle dots on muzzle
      fx.fillStyle = 'rgba(30, 41, 59, 0.45)';
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.arc(side * nw * 0.85, nh * 0.45, 1.8, 0, Math.PI * 2);
        fx.arc(side * nw * 1.1, nh * 0.35, 1.8, 0, Math.PI * 2);
        fx.arc(side * nw * 1.0, nh * 0.65, 1.8, 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
      fx.restore();
    }
  };

export default dogearsEffect;
