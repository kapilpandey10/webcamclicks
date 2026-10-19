/* WebcamClicks — demon_horns face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const demonHornsEffect = {
  id: 'demon_horns',
  name: 'Neon Demon Horns',
  icon: '😈',
  category: 'Face',
  perf: 'low',
  requiresFace: true,

  render(fx, frame) {
    passthrough(fx, frame);
    const g = geo(frame);
    const s = smoothGeo(this, g, frame.dt || 16.7, 35);
    const t = frame.time || performance.now();
    if (!s) return;

    const ed = s.eyeDist;
    const hw = s.headW;
    const dt = clamp(frame.dt || 16.7, 1, 50);

    if (!this._p) this._p = [];

    // 1. Dark Hellish Atmospheric Vignette
    fx.save();
    const vig = fx.createRadialGradient(s.x, s.y, ed * 1.5, s.x, s.y, Math.max(frame.width, frame.height) * 0.75);
    vig.addColorStop(0, 'rgba(0, 0, 0, 0)');
    vig.addColorStop(0.65, 'rgba(40, 5, 15, 0.35)');
    vig.addColorStop(1, 'rgba(10, 2, 6, 0.75)');
    fx.fillStyle = vig;
    fx.fillRect(0, 0, frame.width, frame.height);
    fx.restore();

    fx.save();
    fx.translate(s.x, s.y);
    fx.rotate(s.a);
    fx.translate(s.yaw * hw * 0.1, 0);

    // 2. Demonic Eye Transformation (Glowing fiery iris & vertical slit pupils)
    const eyeR = Math.max(5, ed * 0.14);
    [-ed * 0.5, ed * 0.5].forEach((ex, idx) => {
      const eyeDir = idx === 0 ? -1 : 1;
      fx.save();
      fx.translate(ex, 0);

      // Dark shadow socket
      const socket = fx.createRadialGradient(0, 0, 1, 0, 0, eyeR * 1.8);
      socket.addColorStop(0, 'rgba(0, 0, 0, 0.9)');
      socket.addColorStop(0.6, 'rgba(76, 5, 25, 0.5)');
      socket.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = socket;
      fx.beginPath();
      fx.arc(0, 0, eyeR * 1.8, 0, Math.PI * 2);
      fx.fill();

      // Searing Molten Iris
      const iris = fx.createRadialGradient(0, 0, 1, 0, 0, eyeR);
      iris.addColorStop(0, '#fef08a'); // molten gold center
      iris.addColorStop(0.35, '#f97316'); // fiery orange
      iris.addColorStop(0.7, '#e11d48'); // crimson
      iris.addColorStop(1, '#4c0519'); // dark abyss border
      fx.fillStyle = iris;
      fx.beginPath();
      fx.arc(0, 0, eyeR, 0, Math.PI * 2);
      fx.fill();

      // Sharp Vertical Demonic Slit Pupil
      fx.fillStyle = '#050208';
      fx.beginPath();
      fx.ellipse(0, 0, Math.max(1.5, eyeR * 0.18), eyeR * 0.88, 0, 0, Math.PI * 2);
      fx.fill();

      // Gleaming specular pin-prick highlights
      fx.fillStyle = '#ffffff';
      fx.beginPath();
      fx.arc(-eyeR * 0.35, -eyeR * 0.35, Math.max(1.2, eyeR * 0.18), 0, Math.PI * 2);
      fx.fill();

      // Demonic eye shadow wisps from outer corner
      fx.strokeStyle = 'rgba(225, 29, 72, 0.45)';
      fx.lineWidth = 1.8;
      fx.beginPath();
      fx.moveTo(eyeDir * eyeR * 0.9, 0);
      fx.quadraticCurveTo(
        eyeDir * (eyeR * 2.0 + Math.sin(t * 0.008) * 4),
        Math.sin(t * 0.01 + idx) * 5,
        eyeDir * (eyeR * 2.8),
        -eyeR * 0.6
      );
      fx.stroke();

      fx.restore();
    });

    // 3. Occult Glowing Forehead Sigil (Demonic Crest)
    const sigilY = -ed * 0.48;
    const sigilR = ed * 0.18;
    const pulse = 0.8 + Math.sin(t * 0.006) * 0.2;

    fx.save();
    fx.translate(0, sigilY);
    fx.strokeStyle = `rgba(244, 63, 94, ${0.85 * pulse})`;
    fx.shadowColor = '#f43f5e';
    fx.shadowBlur = 12 * pulse;
    fx.lineWidth = Math.max(1.2, ed * 0.022);

    // Inverted Demonic Pentagram
    fx.beginPath();
    for (let i = 0; i < 5; i++) {
      // Inverted star: point down (angle starts at Math.PI / 2)
      const a = Math.PI / 2 + (i * 4 * Math.PI) / 5;
      const x = Math.cos(a) * sigilR;
      const y = Math.sin(a) * sigilR;
      if (i === 0) fx.moveTo(x, y);
      else fx.lineTo(x, y);
    }
    fx.closePath();
    fx.stroke();

    // Surrounding runic circle
    fx.beginPath();
    fx.arc(0, 0, sigilR * 1.15, 0, Math.PI * 2);
    fx.stroke();

    // Molten center dot
    fx.fillStyle = '#fef08a';
    fx.beginPath();
    fx.arc(0, 0, 3, 0, Math.PI * 2);
    fx.fill();
    fx.restore();

    // 4. Render Left & Right Sculpted Magma Horns
    const hornBaseY = -ed * 0.78;
    const hornSpacing = ed * 0.58;
    const hornH = ed * 1.45;

    [-hornSpacing, hornSpacing].forEach((hx, idx) => {
      const dir = idx === 0 ? -1 : 1; // -1 for left, 1 for right
      fx.save();
      fx.translate(hx, hornBaseY);

      // Horn base anchor curve
      const tipX = dir * ed * 0.58;
      const tipY = -hornH;
      const ctrl1X = dir * ed * 0.12;
      const ctrl1Y = -hornH * 0.45;
      const ctrl2X = dir * ed * 0.08;
      const ctrl2Y = -hornH * 0.42;

      // Outer Horn Silhouette Path
      fx.beginPath();
      fx.moveTo(-dir * ed * 0.15, 0); // inner base
      fx.quadraticCurveTo(ctrl1X, ctrl1Y, tipX, tipY); // outer sweeping curve
      fx.quadraticCurveTo(ctrl2X, ctrl2Y, dir * ed * 0.15, 0); // inner return curve
      fx.closePath();

      // Deep Obsidian Base Gradient
      const baseGrad = fx.createLinearGradient(0, 0, tipX, tipY);
      baseGrad.addColorStop(0, '#09050d');
      baseGrad.addColorStop(0.35, '#2a0410');
      baseGrad.addColorStop(0.7, '#881337');
      baseGrad.addColorStop(0.95, '#e11d48');
      baseGrad.addColorStop(1, '#fda4af');
      fx.fillStyle = baseGrad;
      fx.fill();

      // 3D Shading: Ambient Occlusion Inner Shadow
      fx.save();
      fx.clip();
      const shadowGrad = fx.createLinearGradient(-dir * ed * 0.15, 0, dir * ed * 0.15, 0);
      shadowGrad.addColorStop(0, dir === 1 ? 'rgba(0,0,0,0.85)' : 'rgba(255,255,255,0.15)');
      shadowGrad.addColorStop(1, dir === 1 ? 'rgba(255,255,255,0.15)' : 'rgba(0,0,0,0.85)');
      fx.fillStyle = shadowGrad;
      fx.fillRect(-ed * 0.8, -hornH * 1.2, ed * 1.6, hornH * 1.4);

      // Pulsing Molten Lava Veins inside the horn
      const lavaPulse = 0.5 + Math.sin(t * 0.005 + idx) * 0.5;
      fx.strokeStyle = `rgba(251, 146, 60, ${0.75 * lavaPulse})`;
      fx.lineWidth = Math.max(1.5, ed * 0.025);
      fx.shadowColor = '#f97316';
      fx.shadowBlur = 8;
      fx.beginPath();
      fx.moveTo(0, 0);
      fx.quadraticCurveTo(ctrl1X * 0.7 + dir * 4, -hornH * 0.35, tipX * 0.7, -hornH * 0.75);
      fx.stroke();
      fx.shadowBlur = 0;

      // Sculpted Horn Rib Plates (3D grooved ridges)
      const plateCount = 6;
      for (let i = 1; i <= plateCount; i++) {
        const prog = i / (plateCount + 1);
        const py = -hornH * prog;
        const px = dir * ed * (0.58 * Math.pow(prog, 1.4));
        const span = ed * 0.24 * (1 - prog * 0.75);

        // Dark ridge underside
        fx.strokeStyle = 'rgba(10, 2, 8, 0.75)';
        fx.lineWidth = Math.max(1.5, ed * 0.035);
        fx.beginPath();
        fx.moveTo(px - span * 0.5, py + 2);
        fx.quadraticCurveTo(px, py - 3, px + span * 0.5, py + 1);
        fx.stroke();

        // Glowing highlighted ridge crest
        fx.strokeStyle = 'rgba(254, 205, 211, 0.65)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.moveTo(px - span * 0.5, py);
        fx.quadraticCurveTo(px, py - 4, px + span * 0.5, py - 1);
        fx.stroke();
      }
      fx.restore(); // end clip

      // Glowing Neon Crimson Outer Rim
      fx.strokeStyle = '#f43f5e';
      fx.shadowColor = '#f43f5e';
      fx.shadowBlur = 18;
      fx.lineWidth = Math.max(2.2, ed * 0.045);
      fx.stroke();
      fx.shadowBlur = 0;

      // Searing White-Hot Horn Tip
      const tipGrad = fx.createRadialGradient(tipX, tipY, 1, tipX, tipY, ed * 0.16);
      tipGrad.addColorStop(0, '#ffffff');
      tipGrad.addColorStop(0.3, '#fef08a');
      tipGrad.addColorStop(0.7, 'rgba(244, 63, 94, 0.8)');
      tipGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = tipGrad;
      fx.beginPath();
      fx.arc(tipX, tipY, ed * 0.16, 0, Math.PI * 2);
      fx.fill();

      fx.restore();

      // Spawn Swirling Hellfire Embers from Horn Tips
      if (Math.random() < 0.65) {
        const worldAngle = s.a;
        const localTipX = hx + tipX;
        const localTipY = hornBaseY + tipY;
        const wx = s.x + Math.cos(worldAngle) * localTipX - Math.sin(worldAngle) * localTipY;
        const wy = s.y + Math.sin(worldAngle) * localTipX + Math.cos(worldAngle) * localTipY;

        this._p.push({
          x: wx + rand(-4, 4),
          y: wy + rand(-4, 4),
          vx: (Math.random() - 0.5) * 0.08 + dir * 0.02,
          vy: -rand(0.12, 0.28),
          life: rand(450, 850),
          age: 0,
          r: rand(3, 8),
          colorType: Math.random() < 0.65 ? 'crimson' : 'gold'
        });
      }
    });

    fx.restore();

    // 5. Render Rising Screen-Space Hellfire Embers
    fx.save();
    fx.globalCompositeOperation = 'screen';
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt + Math.sin(t * 0.008 + i) * 0.3;
      p.y += p.vy * dt;

      const rad = p.r * (1 + (1 - k) * 0.6);
      const eg = fx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rad);
      if (p.colorType === 'gold') {
        eg.addColorStop(0, `rgba(255, 255, 255, ${k})`);
        eg.addColorStop(0.35, `rgba(254, 240, 138, ${0.9 * k})`);
        eg.addColorStop(0.7, `rgba(249, 115, 22, ${0.6 * k})`);
        eg.addColorStop(1, 'rgba(239, 68, 68, 0)');
      } else {
        eg.addColorStop(0, `rgba(254, 205, 211, ${k})`);
        eg.addColorStop(0.35, `rgba(244, 63, 94, ${0.9 * k})`);
        eg.addColorStop(0.7, `rgba(136, 19, 55, ${0.6 * k})`);
        eg.addColorStop(1, 'rgba(76, 5, 25, 0)');
      }
      fx.fillStyle = eg;
      fx.beginPath();
      fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    if (this._p.length > 120) {
      this._p.splice(0, this._p.length - 120);
    }
  }
};

export default demonHornsEffect;
