/* WebcamClicks — cyber_glitch_vhs 2D filter effect */

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

export const cyberGlitchVhsEffect = {
    id: 'cyber_glitch_vhs', name: 'Analog 1988 VHS Glitch', icon: '📼', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Vintage magnetic VHS color profile
      fx.save();
      fx.filter = 'contrast(1.15) brightness(1.02) saturate(1.25) sepia(0.06)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // 1. Magnetic Tape Horizontal Glitch Band tracking head altitude!
      const glitchY = (pose.cy - pose.h * 0.4 + Math.sin(t * 0.003) * (pose.h * 0.8));
      const glitchH = Math.max(16, Math.round(pose.h * 0.22));
      const shiftX = Math.sin(t * 0.02) * 18;

      // Displaced slice with chromatic split
      fx.save();
      fx.beginPath();
      fx.rect(0, glitchY, w, glitchH);
      fx.clip();

      // Red channel shift
      fx.globalAlpha = 0.7;
      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = '#ff0055';
      fx.drawImage(src, shiftX, 0, w, h);

      // Cyan channel shift
      fx.fillStyle = '#00ffff';
      fx.drawImage(src, -shiftX, 0, w, h);
      fx.restore();

      // 2. Head-Switching Noise Band at bottom of frame (Standard VCR tracking artifact)
      const noiseH = Math.max(14, Math.round(h * 0.035));
      fx.save();
      fx.fillStyle = '#000000';
      fx.fillRect(0, h - noiseH, w, noiseH);
      for (let n = 0; n < 40; n++) {
        const nx = Math.random() * w;
        const nw = rand(8, 45);
        fx.fillStyle = Math.random() < 0.5 ? '#ffffff' : '#475569';
        fx.fillRect(nx, h - noiseH + Math.random() * noiseH, nw, 2);
      }
      fx.restore();

      // 3. Realistic 1988 VCR On-Screen Display (OSD)
      fx.save();
      const fs = Math.max(11, Math.round(w * 0.022));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#22c55e';
      fx.shadowColor = '#22c55e';
      fx.shadowBlur = 6;

      // Play indicator
      fx.fillText('► PLAY', 28, 38);

      // Live 1988 timecode
      const sec = Math.floor(t * 0.001) % 60;
      const min = Math.floor(t * 0.001 / 60) % 60;
      const tc = `SP  0:${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      fx.fillText(tc, 28, 38 + fs * 1.4);

      // Blinking REC dot
      if (Math.sin(t * 0.005) > 0) {
        fx.fillStyle = '#ef4444';
        fx.shadowColor = '#ef4444';
        fx.beginPath();
        fx.arc(w - 75, 32, 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.fillText('REC', w - 62, 36);
      }

      // Tracking indicator
      fx.fillStyle = '#22c55e';
      fx.textAlign = 'right';
      fx.fillText('TRACKING: AUTO', w - 28, h - noiseH - 12);
      fx.restore();

      fx.restore();
    }
  };

export default cyberGlitchVhsEffect;
