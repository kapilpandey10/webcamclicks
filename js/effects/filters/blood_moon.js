/* WebcamClicks — blood_moon 2D filter effect */

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

export const bloodMoonEffect = {
    id: 'blood_moon', name: 'Gothic Blood Moon', icon: '🩸', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // High-contrast obsidian silver noir with selective red infusion
      fx.filter = 'grayscale(0.9) contrast(1.4) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Blood red rim lighting & vignette directed at head
      fx.globalCompositeOperation = 'screen';
      const bloodGrad = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.4, pose.cx, pose.cy, Math.max(w, h) * 0.65);
      bloodGrad.addColorStop(0, 'rgba(220, 38, 38, 0.45)');
      bloodGrad.addColorStop(0.5, 'rgba(153, 27, 27, 0.25)');
      bloodGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = bloodGrad;
      fx.fillRect(0, 0, w, h);

      // Ominous Blood Moon in upper backdrop
      const moonR = Math.min(w, h) * 0.16;
      const moonX = w * 0.78;
      const moonY = h * 0.22;
      const moonGrad = fx.createRadialGradient(moonX, moonY, moonR * 0.1, moonX, moonY, moonR);
      moonGrad.addColorStop(0, 'rgba(254, 202, 202, 0.85)');
      moonGrad.addColorStop(0.4, 'rgba(239, 68, 68, 0.7)');
      moonGrad.addColorStop(0.85, 'rgba(153, 27, 27, 0.4)');
      moonGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = moonGrad;
      fx.beginPath();
      fx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
      fx.fill();

      // Volumetric curling ground mist
      const mistY = h * 0.75;
      const mistGrad = fx.createLinearGradient(0, mistY, 0, h);
      mistGrad.addColorStop(0, 'rgba(220, 38, 38, 0)');
      mistGrad.addColorStop(1, 'rgba(185, 28, 28, 0.42)');
      fx.fillStyle = mistGrad;
      fx.fillRect(0, mistY, w, h - mistY);

      // Cinematic 2.39:1 widescreen letterbox bars
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = '#060308';
      const barH = Math.round(h * 0.08);
      fx.fillRect(0, 0, w, barH);
      fx.fillRect(0, h - barH, w, barH);

      applyFilmGrain(fx, w, h, 0.24);
      fx.restore();
    }
  };

export default bloodMoonEffect;
