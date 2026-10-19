/* WebcamClicks — cyberpunk_hud 2D filter effect */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  pixelPass,
  lumOf,
  addNoise,
  getGrainPattern,
  applyFilmGrain,
  getBloomCanvas,
  renderHalationBloom,
  drawDateStamp,
  drawAnamorphicStreak,
  drawBackgroundBokehDiscs,
  renderShutterMotion,
  renderDreamTrails,
  renderPortraitBokeh,
  getFisheyeBuffers,
  renderFisheye,
  renderFlirThermal,
  renderNeonEdgePass,
  drawCausticRays,
  renderLiquidRainbowPass,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';

export const cyberpunkHudEffect = {
    id: 'cyberpunk_hud', name: 'Cyberpunk HUD 2077', icon: '🤖', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 28);

      fx.save();
      fx.filter = 'contrast(1.22) saturate(1.4) hue-rotate(-15deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Cyber duotone rim lighting
      fx.globalCompositeOperation = 'screen';
      const edgeGrad = fx.createLinearGradient(0, 0, w, h);
      edgeGrad.addColorStop(0, 'rgba(0, 240, 255, 0.22)');
      edgeGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
      edgeGrad.addColorStop(1, 'rgba(255, 0, 128, 0.22)');
      fx.fillStyle = edgeGrad;
      fx.fillRect(0, 0, w, h);

      // Hexagonal AR grid in top corner
      fx.strokeStyle = 'rgba(0, 240, 255, 0.18)';
      fx.lineWidth = 1;
      const hexS = Math.max(14, Math.round(w * 0.03));
      const hexCols = 5, hexRows = 4;
      for (let r = 0; r < hexRows; r++) {
        for (let c = 0; c < hexCols; c++) {
          const hx = w - hexCols * hexS * 1.8 + c * hexS * 1.732 + (r % 2 ? hexS * 0.866 : 0);
          const hy = 24 + r * hexS * 1.5;
          fx.beginPath();
          for (let a = 0; a < 6; a++) {
            const ang = (a * Math.PI) / 3;
            const px = hx + hexS * 0.5 * Math.cos(ang);
            const py = hy + hexS * 0.5 * Math.sin(ang);
            if (a === 0) fx.moveTo(px, py); else fx.lineTo(px, py);
          }
          fx.closePath();
          fx.stroke();
        }
      }

      // Live Head-Tracked Reticle & Lock-On System
      const tx = pose.cx;
      const ty = pose.cy;
      const tr = Math.max(pose.w, pose.h) * 0.58;

      fx.save();
      fx.translate(tx, ty);
      fx.rotate(pose.angle);
      fx.translate(pose.yaw * pose.w * 0.12, 0);

      // Rotating Outer Targeting Ring
      fx.strokeStyle = 'rgba(0, 240, 255, 0.8)';
      fx.lineWidth = Math.max(1.8, Math.round(w * 0.003));
      fx.beginPath();
      fx.arc(0, 0, tr, 0, Math.PI * 2);
      fx.stroke();

      fx.save();
      fx.rotate(t * 0.001);
      fx.strokeStyle = 'rgba(250, 204, 21, 0.9)';
      fx.lineWidth = Math.max(2.2, Math.round(w * 0.004));
      for (let i = 0; i < 4; i++) {
        fx.beginPath();
        fx.arc(0, 0, tr * 1.12, i * Math.PI * 0.5 + 0.12, i * Math.PI * 0.5 + 0.58);
        fx.stroke();
      }
      fx.restore();

      // Corner target brackets [   ] tightly framing head
      const bw = tr * 1.15;
      const bh = tr * 1.15;
      const bl = Math.max(12, Math.round(tr * 0.28));
      fx.strokeStyle = '#00f0ff';
      fx.lineWidth = Math.max(2.4, Math.round(w * 0.004));
      // Top-left
      fx.beginPath(); fx.moveTo(-bw, -bh + bl); fx.lineTo(-bw, -bh); fx.lineTo(-bw + bl, -bh); fx.stroke();
      // Top-right
      fx.beginPath(); fx.moveTo(bw - bl, -bh); fx.lineTo(bw, -bh); fx.lineTo(bw, -bh + bl); fx.stroke();
      // Bottom-left
      fx.beginPath(); fx.moveTo(-bw, bh - bl); fx.lineTo(-bw, bh); fx.lineTo(-bw + bl, bh); fx.stroke();
      // Bottom-right
      fx.beginPath(); fx.moveTo(bw - bl, bh); fx.lineTo(bw, bh); fx.lineTo(bw, bh - bl); fx.stroke();

      // Horizontal scanning laser line tracking face altitude
      const scanY = (Math.sin(t * 0.004) * tr * 0.85);
      const lGrad = fx.createLinearGradient(-bw, scanY, bw, scanY);
      lGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      lGrad.addColorStop(0.5, 'rgba(0, 240, 255, 0.7)');
      lGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = lGrad;
      fx.fillRect(-bw, scanY - 3, bw * 2, 6);

      // Target lock tag
      const fs = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#ff007f';
      fx.textAlign = 'left';
      fx.fillText(pose.hasFace ? '[TGT: HOMINID // LOCKED]' : '[TGT: ACQUIRING...]', -bw, -bh - fs * 1.3);
      fx.restore();

      // Dual pupil tracking crosshairs when face landmarks exist
      if (pose.hasFace && pose.lEye && pose.rEye) {
        [pose.lEye, pose.rEye].forEach((eye) => {
          fx.save();
          fx.translate(eye.x, eye.y);
          fx.rotate(t * 0.003);
          fx.strokeStyle = '#39ff14';
          fx.lineWidth = 1.4;
          const er = Math.max(8, pose.eyeDist * 0.22);
          fx.beginPath();
          fx.arc(0, 0, er, 0, Math.PI * 2);
          fx.stroke();
          fx.beginPath();
          fx.moveTo(-er * 1.3, 0); fx.lineTo(er * 1.3, 0);
          fx.moveTo(0, -er * 1.3); fx.lineTo(0, er * 1.3);
          fx.stroke();
          fx.restore();
        });
      }

      // HUD Telemetry readouts
      const fsHUD = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fsHUD}px "Courier New", monospace`;
      fx.textBaseline = 'top';
      fx.fillStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 6;
      fx.textAlign = 'left';
      fx.fillText('SYS // CYBER-LINK v4.09', Math.round(w * 0.03), Math.round(h * 0.03));
      fx.fillStyle = '#39ff14';
      fx.fillText('● OPTIC STATUS: LOCKED', Math.round(w * 0.03), Math.round(h * 0.03) + fsHUD * 1.3);

      const hdg = Math.floor(((pose.cx / w) * 360) % 360);
      fx.fillStyle = '#facc15';
      fx.textAlign = 'right';
      fx.fillText(`HDG ${String(hdg).padStart(3, '0')}° // FOV 84°`, w - Math.round(w * 0.03), Math.round(h * 0.03));
      fx.fillText(`BIO-SYNC: 99.8% [${(72 + Math.sin(t * 0.004) * 4).toFixed(0)} BPM]`, w - Math.round(w * 0.03), Math.round(h * 0.03) + fsHUD * 1.3);

      // Occasional cyber chromatic glitch line
      if (Math.random() < 0.12) {
        const gy = Math.random() * h;
        fx.fillStyle = 'rgba(255, 0, 128, 0.45)';
        fx.fillRect(0, gy, w, Math.max(2, Math.round(h * 0.01)));
      }
      fx.restore();
    }
  };

export default cyberpunkHudEffect;
