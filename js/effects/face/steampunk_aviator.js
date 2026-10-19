/* WebcamClicks — steampunk_aviator face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const steampunkAviatorEffect = {
    id: 'steampunk_aviator', name: 'Steampunk Brass Goggles', icon: '🥽', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 35);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback brass goggle preview
        fx.save();
        fx.translate(w / 2, h / 2);
        fx.fillStyle = '#78350f';
        fx.fillRect(-60, -8, 120, 16);
        [-30, 30].forEach((gx) => {
          fx.beginPath();
          fx.arc(gx, 0, 24, 0, Math.PI * 2);
          fx.fillStyle = '#d97706';
          fx.fill();
          fx.strokeStyle = '#fef08a';
          fx.lineWidth = 3;
          fx.stroke();
        });
        fx.font = 'bold 11px monospace';
        fx.fillStyle = '#fef08a';
        fx.textAlign = 'center';
        fx.fillText('STEAMPUNK: CALIBRATING OPTICS', 0, 48);
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const gR = ed * 0.44; // Goggle lens radius
      const rimW = Math.max(3, ed * 0.08);

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * s.headW * 0.08, 0);

      // 1. Leather Headband Strap hugging head
      fx.beginPath();
      fx.moveTo(-s.headW * 0.6, 0);
      fx.lineTo(s.headW * 0.6, 0);
      fx.strokeStyle = '#451a03';
      fx.lineWidth = Math.max(6, ed * 0.16);
      fx.lineCap = 'round';
      fx.stroke();
      // Leather stitching line
      fx.strokeStyle = '#b45309';
      fx.lineWidth = 1;
      fx.setLineDash([3, 3]);
      fx.stroke();
      fx.setLineDash([]);

      // 2. Leather Nose Bridge Connector
      fx.beginPath();
      fx.moveTo(-ed * 0.18, 0);
      fx.quadraticCurveTo(0, -ed * 0.06, ed * 0.18, 0);
      fx.strokeStyle = '#78350f';
      fx.lineWidth = Math.max(5, ed * 0.14);
      fx.stroke();
      // Brass nose bridge buckle
      fx.fillStyle = '#fef08a';
      fx.fillRect(-ed * 0.05, -ed * 0.05, ed * 0.1, ed * 0.1);

      // 3. Left and Right Heavy Brass Ocular Cups
      [-ed * 0.5, ed * 0.5].forEach((cx, idx) => {
        const isRight = idx === 1;

        // Drop shadow behind goggle rim
        fx.beginPath();
        fx.arc(cx, ed * 0.05, gR + rimW, 0, Math.PI * 2);
        fx.fillStyle = 'rgba(0,0,0,0.3)';
        fx.fill();

        // Heavy Brass Outer Rim with Metallic Radial Gradient
        const brassGrad = fx.createRadialGradient(cx - gR * 0.3, -gR * 0.3, gR * 0.2, cx, 0, gR + rimW);
        brassGrad.addColorStop(0, '#fef08a');
        brassGrad.addColorStop(0.35, '#d97706');
        brassGrad.addColorStop(0.7, '#78350f');
        brassGrad.addColorStop(1, '#451a03');

        fx.beginPath();
        fx.arc(cx, 0, gR + rimW, 0, Math.PI * 2);
        fx.fillStyle = brassGrad;
        fx.fill();

        // Rivet Studs around brass rim (8 rivets)
        for (let r = 0; r < 8; r++) {
          const ra = (r * Math.PI) / 4;
          const rx = cx + Math.cos(ra) * (gR + rimW * 0.5);
          const ry = Math.sin(ra) * (gR + rimW * 0.5);
          fx.fillStyle = '#fde68a';
          fx.beginPath();
          fx.arc(rx, ry, Math.max(1.5, ed * 0.025), 0, Math.PI * 2);
          fx.fill();
        }

        // Inner Brass Stepped Lip
        fx.strokeStyle = '#451a03';
        fx.lineWidth = 1.5;
        fx.beginPath();
        fx.arc(cx, 0, gR, 0, Math.PI * 2);
        fx.stroke();

        // 4. Amber Glass Lens with Fresnel reflections
        fx.save();
        fx.beginPath();
        fx.arc(cx, 0, gR, 0, Math.PI * 2);
        fx.clip();

        // Amber lens gradient
        const lensGrad = fx.createRadialGradient(cx, 0, 0, cx, 0, gR);
        lensGrad.addColorStop(0, 'rgba(251, 191, 36, 0.45)');
        lensGrad.addColorStop(0.75, 'rgba(180, 83, 9, 0.7)');
        lensGrad.addColorStop(1, 'rgba(69, 26, 3, 0.88)');
        fx.fillStyle = lensGrad;
        fx.fillRect(cx - gR, -gR, gR * 2, gR * 2);

        // Etched Crosshair Reticle in glass
        fx.strokeStyle = 'rgba(254, 240, 138, 0.35)';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(cx - gR, 0); fx.lineTo(cx + gR, 0);
        fx.moveTo(cx, -gR); fx.lineTo(cx, gR);
        fx.arc(cx, 0, gR * 0.5, 0, Math.PI * 2);
        fx.stroke();

        // Dynamic Specular Glint sweep moving with head angle
        const sweepAngle = s.a * 2 + t * 0.001;
        const gx1 = cx + Math.cos(sweepAngle) * gR * 0.7;
        const gy1 = Math.sin(sweepAngle) * gR * 0.7;
        const glint = fx.createLinearGradient(gx1 - 15, gy1 - 15, gx1 + 15, gy1 + 15);
        glint.addColorStop(0, 'rgba(255,255,255,0)');
        glint.addColorStop(0.5, 'rgba(255,255,255,0.4)');
        glint.addColorStop(1, 'rgba(255,255,255,0)');
        fx.fillStyle = glint;
        fx.fillRect(cx - gR, -gR, gR * 2, gR * 2);

        fx.restore();

        // 5. Spinning Brass Gear Cog on Right Eye Rim!
        if (isRight) {
          fx.save();
          fx.translate(cx + gR * 0.78, -gR * 0.6);
          const gearR = gR * 0.38;
          const gearRot = t * 0.002;
          fx.rotate(gearRot);

          // Gear teeth (10 teeth)
          const teeth = 10;
          fx.beginPath();
          for (let g = 0; g < teeth; g++) {
            const a0 = (g * Math.PI * 2) / teeth;
            const a1 = a0 + Math.PI / teeth * 0.5;
            const rOut = gearR * 1.25;
            const rIn = gearR;
            if (g === 0) fx.moveTo(Math.cos(a0) * rIn, Math.sin(a0) * rIn);
            fx.lineTo(Math.cos(a0) * rOut, Math.sin(a0) * rOut);
            fx.lineTo(Math.cos(a1) * rOut, Math.sin(a1) * rOut);
            fx.lineTo(Math.cos(a1) * rIn, Math.sin(a1) * rIn);
          }
          fx.closePath();
          fx.fillStyle = '#d97706';
          fx.fill();
          fx.strokeStyle = '#fef08a';
          fx.lineWidth = 1;
          fx.stroke();

          // Gear center hole
          fx.beginPath();
          fx.arc(0, 0, gearR * 0.35, 0, Math.PI * 2);
          fx.fillStyle = '#451a03';
          fx.fill();
          fx.stroke();
          fx.restore();
        }
      });

      fx.restore();
    }
  };

export default steampunkAviatorEffect;
