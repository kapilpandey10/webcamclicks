/* WebcamClicks — y2k_fairy 2D filter effect */

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

export const y2kFairyEffect = {
    id: 'y2k_fairy', name: 'Y2K Glitter Fairy', icon: '💖', category: 'Fun', perf: 'low', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Dreamy Y2K pastel pink wash
      fx.filter = 'contrast(1.08) brightness(1.1) saturate(1.35) hue-rotate(330deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Soft glow aura around head
      fx.globalCompositeOperation = 'screen';
      const pinkGrad = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.4, pose.cx, pose.cy, Math.max(w, h) * 0.65);
      pinkGrad.addColorStop(0, 'rgba(251, 207, 232, 0.32)');
      pinkGrad.addColorStop(1, 'rgba(244, 114, 182, 0.15)');
      fx.fillStyle = pinkGrad;
      fx.fillRect(0, 0, w, h);

      // Floating 3D metallic chrome hearts orbiting around head
      if (!this._hearts || this._hw !== w) {
        this._hw = w;
        this._hearts = Array.from({ length: 8 }, (_, i) => ({
          ang: (i * Math.PI * 2) / 8,
          s: Math.max(14, Math.round(w * 0.035)) + Math.random() * 10,
          speed: 0.0012 + Math.random() * 0.0006
        }));
      }

      for (let i = 0; i < this._hearts.length; i++) {
        const hr = this._hearts[i];
        const ang = t * hr.speed + hr.ang;
        const rx = Math.max(pose.w * 0.85, 70);
        const ry = Math.max(pose.h * 0.75, 60);
        const hx = pose.cx + Math.cos(ang) * rx;
        const hy = pose.cy + Math.sin(ang) * ry;

        fx.save();
        fx.translate(hx, hy);
        const sc = hr.s / 24;
        fx.scale(sc, sc);

        // Chrome metallic gradient heart
        const hg = fx.createLinearGradient(-12, -12, 12, 12);
        hg.addColorStop(0, '#fdf2f8');
        hg.addColorStop(0.3, '#f472b6');
        hg.addColorStop(0.7, '#ec4899');
        hg.addColorStop(1, '#be185d');
        fx.fillStyle = hg;

        fx.beginPath();
        fx.moveTo(0, 6);
        fx.bezierCurveTo(-12, -6, -20, 10, 0, 24);
        fx.bezierCurveTo(20, 10, 12, -6, 0, 6);
        fx.fill();

        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 1.5;
        fx.stroke();
        fx.restore();
      }

      // Twinkling 4-point Y2K cross star sparkles around face
      for (let i = 0; i < 9; i++) {
        const sx = ((pose.cx - pose.w * 0.7 + i * 42.4 + t * 0.02) % w);
        const sy = ((pose.cy - pose.h * 0.7 + i * 36.5 + Math.sin(t * 0.003 + i) * 25) % h);
        const tw = (Math.sin(t * 0.006 + i * 2) + 1) * 0.5;
        if (tw > 0.35) {
          const spk = Math.max(7, Math.round(w * 0.02)) * tw;
          fx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
          fx.lineWidth = 1.8;
          fx.beginPath();
          fx.moveTo(sx - spk, sy); fx.lineTo(sx + spk, sy);
          fx.moveTo(sx, sy - spk); fx.lineTo(sx, sy + spk);
          fx.stroke();
        }
      }

      // Nostalgic Y2K camera overlay UI
      const fs = Math.max(10, Math.round(w * 0.022));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#fbcfe8';
      fx.textBaseline = 'top';
      fx.shadowColor = '#ec4899';
      fx.shadowBlur = 4;
      fx.fillText('[ PHOTO 03/24 ]', Math.round(w * 0.04), Math.round(h * 0.04));
      fx.textAlign = 'right';
      fx.fillText('💖 BATT 100%', w - Math.round(w * 0.04), Math.round(h * 0.04));

      fx.textAlign = 'center';
      fx.textBaseline = 'bottom';
      fx.fillText('✨ BEAUTY MODE · HIGH ✨', w / 2, h - Math.round(h * 0.04));
      fx.restore();
    }
  };

export default y2kFairyEffect;
