/* WebcamClicks — synthwave_outrun 2D filter effect */

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

export const synthwaveOutrunEffect = {
    id: 'synthwave_outrun', name: 'Synthwave 1984', icon: '🌴', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Outrun duotone grade
      fx.filter = 'contrast(1.3) saturate(1.55) hue-rotate(270deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Giant wireframe retro sun on the horizon
      const hy = h * 0.62;
      const sunR = Math.min(w, h) * 0.28;
      const sunX = pose.cx;
      const sunY = hy - sunR * 0.2;

      fx.save();
      fx.beginPath();
      fx.rect(0, 0, w, hy);
      fx.clip();

      const sunGrad = fx.createLinearGradient(sunX, sunY - sunR, sunX, sunY + sunR);
      sunGrad.addColorStop(0, '#fde047');
      sunGrad.addColorStop(0.5, '#f43f5e');
      sunGrad.addColorStop(1, '#a855f7');
      fx.fillStyle = sunGrad;
      fx.beginPath();
      fx.arc(sunX, sunY, sunR, 0, Math.PI * 2);
      fx.fill();

      // Horizontal segmented blind slats on sun
      fx.fillStyle = '#0f051d';
      for (let sY = sunY - sunR * 0.2; sY < sunY + sunR; sY += Math.max(6, sunR * 0.12)) {
        const slatH = Math.max(2, (sY - (sunY - sunR * 0.2)) * 0.1);
        fx.fillRect(sunX - sunR, sY, sunR * 2, slatH);
      }
      fx.restore();

      // 3D Moving perspective road grid on bottom half tracking head position
      fx.save();
      fx.beginPath();
      fx.rect(0, hy, w, h - hy);
      fx.clip();

      const groundGrad = fx.createLinearGradient(0, hy, 0, h);
      groundGrad.addColorStop(0, 'rgba(15, 5, 29, 0.45)');
      groundGrad.addColorStop(1, 'rgba(88, 28, 135, 0.7)');
      fx.fillStyle = groundGrad;
      fx.fillRect(0, hy, w, h - hy);

      fx.strokeStyle = '#ec4899';
      fx.lineWidth = 1.8;
      fx.shadowColor = '#ec4899';
      fx.shadowBlur = 8;

      const speed = (t * 0.08) % 36;
      for (let y = hy + speed; y < h; y += Math.max(16, (y - hy) * 0.35 + 8)) {
        fx.beginPath(); fx.moveTo(0, y); fx.lineTo(w, y); fx.stroke();
      }

      // Vanishing point perspective rays aligned with head X
      const vcx = pose.cx;
      for (let rx = -w * 0.6; rx <= w * 1.6; rx += Math.max(24, w / 9)) {
        fx.beginPath(); fx.moveTo(vcx, hy); fx.lineTo(rx, h); fx.stroke();
      }
      fx.restore();

      // Silhouette palm trees on borders
      fx.fillStyle = '#0f051d';
      const drawPalm = (px, py, flip) => {
        fx.save();
        fx.translate(px, py);
        if (flip) fx.scale(-1, 1);
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.quadraticCurveTo(14, -h * 0.2, 8, -h * 0.38);
        fx.lineTo(16, -h * 0.38);
        fx.quadraticCurveTo(24, -h * 0.2, 10, 0);
        fx.fill();
        for (let a = -0.4; a < 1.2; a += 0.35) {
          fx.beginPath();
          fx.moveTo(12, -h * 0.38);
          fx.quadraticCurveTo(35 * Math.cos(a) + 12, -h * 0.38 + 25 * Math.sin(a), 50 * Math.cos(a) + 12, -h * 0.38 + 50 * Math.sin(a));
          fx.quadraticCurveTo(30 * Math.cos(a) + 12, -h * 0.38 + 18 * Math.sin(a), 12, -h * 0.38);
          fx.fill();
        }
        fx.restore();
      };
      drawPalm(Math.round(w * 0.06), h, false);
      drawPalm(w - Math.round(w * 0.06), h, true);

      // CRT Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      fx.restore();
    }
  };

export default synthwaveOutrunEffect;
