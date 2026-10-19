/* WebcamClicks — hologram_transmission 2D filter effect */

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

export const hologramTransmissionEffect = {
    id: 'hologram_transmission', name: 'Sci-Fi Hologram Transmission', icon: '📡', category: 'Sci-Fi', perf: 'low', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Monochromatic cyan/blue holographic projection
      fx.save();
      const flicker = 0.92 + Math.sin(t * 0.05) * 0.08 + (Math.random() < 0.04 ? -0.2 : 0);
      fx.filter = `contrast(1.4) brightness(${flicker}) saturate(1.8) hue-rotate(170deg)`;
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Cyan projection overlay
      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = 'rgba(6, 182, 212, 0.28)';
      fx.fillRect(0, 0, w, h);

      // 1. Holographic Projector Cone from bottom edge to head
      const coneGrad = fx.createLinearGradient(w / 2, h, pose.cx, pose.cy);
      coneGrad.addColorStop(0, 'rgba(0, 240, 255, 0.45)');
      coneGrad.addColorStop(0.4, 'rgba(6, 182, 212, 0.18)');
      coneGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = coneGrad;
      fx.beginPath();
      fx.moveTo(w * 0.35, h);
      fx.lineTo(pose.cx - pose.w * 0.6, pose.cy + pose.h * 0.5);
      fx.lineTo(pose.cx + pose.w * 0.6, pose.cy + pose.h * 0.5);
      fx.lineTo(w * 0.65, h);
      fx.closePath();
      fx.fill();

      // 2. Horizontal Transmission Scan Beam traversing across head
      const scanY = (t * 0.12) % (h + 80) - 40;
      const beamGrad = fx.createLinearGradient(0, scanY - 15, 0, scanY + 15);
      beamGrad.addColorStop(0, 'rgba(0, 240, 255, 0)');
      beamGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.7)');
      beamGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
      fx.fillStyle = beamGrad;
      fx.fillRect(0, scanY - 15, w, 30);

      // 3. Scanline grid
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = 'rgba(0, 15, 30, 0.35)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 2);
      }

      // 4. Hologram OSD Telemetry
      fx.globalCompositeOperation = 'source-over';
      const fs = Math.max(9, Math.round(w * 0.015));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.fillStyle = '#00f0ff';
      fx.shadowColor = '#00f0ff';
      fx.shadowBlur = 6;
      fx.fillText('INCOMING TRANSMISSION // ENCRYPT: 4096-BIT', 20, 28);
      fx.fillText(`FEDERATION NET // FREQ: 1420.4 MHz // SNR: ${(96 + Math.sin(t * 0.003) * 3).toFixed(1)} dB`, 20, 28 + fs * 1.4);

      fx.textAlign = 'right';
      fx.fillText(`STATUS: ONLINE`, w - 20, 28);
      fx.fillText(`RESOL: 1080p HOLO-MAT`, w - 20, 28 + fs * 1.4);
      fx.shadowBlur = 0;

      fx.restore();
    }
  };

export default hologramTransmissionEffect;
