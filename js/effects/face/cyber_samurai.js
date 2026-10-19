/* WebcamClicks — cyber_samurai face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const cyberSamuraiEffect = {
    id: 'cyber_samurai', name: 'Cyber Samurai Oni Mask', icon: '👺', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16.7, 35);
      const t = frame.time || performance.now();
      const w = frame.width;
      const h = frame.height;

      if (!s) {
        // Fallback: floating holographic Oni glyph
        fx.save();
        fx.translate(w / 2, h / 2);
        fx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
        fx.lineWidth = 2;
        fx.strokeRect(-40, -40, 80, 80);
        fx.font = 'bold 12px "Courier New", monospace';
        fx.fillStyle = '#ef4444';
        fx.textAlign = 'center';
        fx.fillText('CYBER SAMURAI: SEEKING WARRIOR', 0, 60);
        fx.restore();
        return;
      }

      const ed = s.eyeDist;
      const hw = Math.max(ed * 1.5, s.headW);
      const mW = hw * 0.95;
      const mH = ed * 1.25;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * hw * 0.12, 0);

      // 1. Forehead Kabuto Golden Horns / Crescent Crest
      fx.save();
      fx.translate(0, -ed * 0.7);
      fx.beginPath();
      fx.moveTo(0, -ed * 0.2);
      fx.bezierCurveTo(ed * 0.4, -ed * 0.7, ed * 0.9, -ed * 0.85, ed * 1.15, -ed * 0.5);
      fx.bezierCurveTo(ed * 0.8, -ed * 0.65, ed * 0.35, -ed * 0.45, 0, -ed * 0.05);
      fx.bezierCurveTo(-ed * 0.35, -ed * 0.45, -ed * 0.8, -ed * 0.65, -ed * 1.15, -ed * 0.5);
      fx.bezierCurveTo(-ed * 0.9, -ed * 0.85, -ed * 0.4, -ed * 0.7, 0, -ed * 0.2);
      fx.closePath();

      const hornGrad = fx.createLinearGradient(0, -ed * 0.85, 0, 0);
      hornGrad.addColorStop(0, '#fef08a');
      hornGrad.addColorStop(0.5, '#eab308');
      hornGrad.addColorStop(1, '#854d0e');
      fx.fillStyle = hornGrad;
      fx.fill();
      fx.strokeStyle = '#fef08a';
      fx.lineWidth = 1.5;
      fx.shadowColor = 'rgba(234, 179, 8, 0.8)';
      fx.shadowBlur = 10;
      fx.stroke();
      fx.shadowBlur = 0;
      fx.restore();

      // 2. Lower Face Oni Armor Plate (Nose bridge down to jaw)
      fx.save();
      fx.translate(0, ed * 0.3);

      // Mask ambient occlusion drop shadow on face
      fx.beginPath();
      fx.moveTo(-mW * 0.5, 0);
      fx.quadraticCurveTo(0, -ed * 0.25, mW * 0.5, 0);
      fx.quadraticCurveTo(mW * 0.52, mH * 0.8, 0, mH * 1.05);
      fx.quadraticCurveTo(-mW * 0.52, mH * 0.8, -mW * 0.5, 0);
      fx.fillStyle = 'rgba(0, 0, 0, 0.35)';
      fx.fill();

      // Main Oni Mask Hull (Lacquered Obsidian / Crimson Plates)
      fx.beginPath();
      fx.moveTo(-mW * 0.48, -ed * 0.05);
      fx.lineTo(-mW * 0.2, -ed * 0.2);
      fx.lineTo(0, -ed * 0.08); // Nose bridge notch
      fx.lineTo(mW * 0.2, -ed * 0.2);
      fx.lineTo(mW * 0.48, -ed * 0.05);
      fx.quadraticCurveTo(mW * 0.5, mH * 0.5, mW * 0.35, mH * 0.85);
      fx.quadraticCurveTo(mW * 0.18, mH * 1.02, 0, mH * 1.04);
      fx.quadraticCurveTo(-mW * 0.18, mH * 1.02, -mW * 0.35, mH * 0.85);
      fx.quadraticCurveTo(-mW * 0.5, mH * 0.5, -mW * 0.48, -ed * 0.05);
      fx.closePath();

      const maskGrad = fx.createLinearGradient(-mW * 0.5, 0, mW * 0.5, mH);
      maskGrad.addColorStop(0, '#1c1917');
      maskGrad.addColorStop(0.3, '#7f1d1d');
      maskGrad.addColorStop(0.7, '#1c1917');
      maskGrad.addColorStop(1, '#0c0a09');
      fx.fillStyle = maskGrad;
      fx.fill();

      fx.strokeStyle = '#ef4444';
      fx.lineWidth = Math.max(1.5, ed * 0.035);
      fx.shadowColor = '#ef4444';
      fx.shadowBlur = 8;
      fx.stroke();
      fx.shadowBlur = 0;

      // 3. Menacing Oni Fangs & Mouth Grill
      const mouthY = mH * 0.55;
      const fangW = ed * 0.12;
      const fangH = ed * 0.26;

      // Golden Demon Fangs (Upper & Lower)
      fx.fillStyle = '#fef08a';
      fx.strokeStyle = '#b45309';
      fx.lineWidth = 1;

      // Upper fangs
      [-ed * 0.22, ed * 0.22].forEach((fxPos) => {
        fx.beginPath();
        fx.moveTo(fxPos - fangW * 0.5, mouthY - fangH * 0.4);
        fx.lineTo(fxPos + fangW * 0.5, mouthY - fangH * 0.4);
        fx.lineTo(fxPos, mouthY + fangH * 0.7);
        fx.closePath();
        fx.fill();
        fx.stroke();
      });

      // Lower fangs
      [-ed * 0.36, ed * 0.36].forEach((fxPos) => {
        fx.beginPath();
        fx.moveTo(fxPos - fangW * 0.4, mouthY + fangH * 0.4);
        fx.lineTo(fxPos + fangW * 0.4, mouthY + fangH * 0.4);
        fx.lineTo(fxPos, mouthY - fangH * 0.5);
        fx.closePath();
        fx.fill();
        fx.stroke();
      });

      // 4. Glowing Neon Cyber Vents on Cheeks
      fx.strokeStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 6;
      fx.lineWidth = 2;
      [-1, 1].forEach((dir) => {
        for (let i = 0; i < 3; i++) {
          const vy = mH * (0.28 + i * 0.14);
          const vx1 = dir * (mW * 0.24 + i * 4);
          const vx2 = dir * (mW * 0.42 + i * 2);
          fx.beginPath();
          fx.moveTo(vx1, vy);
          fx.lineTo(vx2, vy + 4);
          fx.stroke();
        }
      });
      fx.shadowBlur = 0;

      // 5. Cybernetic Japanese Kanji / Clan Sigil on Chin
      fx.font = `bold ${Math.max(10, Math.round(ed * 0.2))}px "Courier New", sans-serif`;
      fx.fillStyle = '#ef4444';
      fx.textAlign = 'center';
      fx.shadowColor = '#ef4444';
      fx.shadowBlur = 6;
      fx.fillText('鬼', 0, mH * 0.88);
      fx.shadowBlur = 0;

      fx.restore();

      // 6. Glowing Crimson Samurai Eyes
      const eyeR = Math.max(3, ed * 0.08);
      [-ed * 0.5, ed * 0.5].forEach((px) => {
        const eyeGrad = fx.createRadialGradient(px, 0, 0, px, 0, eyeR * 2.2);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, '#f43f5e');
        eyeGrad.addColorStop(0.7, 'rgba(225, 29, 72, 0.4)');
        eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = eyeGrad;
        fx.beginPath();
        fx.arc(px, 0, eyeR * 2.2, 0, Math.PI * 2);
        fx.fill();
      });

      fx.restore();
    }
  };

export default cyberSamuraiEffect;
