/* WebcamClicks — cyberglitch 2D filter effect */

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

export const cyberglitchEffect = {
    id: 'cyberglitch', name: 'Cyberpunk HUD', icon: '🤖', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      // Cyberpunk Color Grade & Cyan/Magenta Edge Split
      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.45;
      const jx = Math.sin(t * 0.015) * 6;
      fx.filter = 'hue-rotate(180deg) saturate(2.2)';
      fx.drawImage(src, jx, 0, w, h);
      fx.restore();

      // Futuristic Holographic HUD Overlay
      fx.save();
      const cx = w / 2;
      const cy = h / 2;
      const reticleR = Math.min(w, h) * 0.22;

      // Center lock reticle
      fx.strokeStyle = 'rgba(0, 255, 234, 0.75)';
      fx.lineWidth = 1.5;
      fx.beginPath();
      fx.arc(cx, cy, reticleR, 0, Math.PI * 2);
      fx.stroke();

      // Reticle corner brackets
      fx.beginPath();
      fx.moveTo(cx - reticleR - 10, cy - 20); fx.lineTo(cx - reticleR - 10, cy - 35); fx.lineTo(cx - reticleR + 5, cy - 35);
      fx.moveTo(cx + reticleR + 10, cy - 20); fx.lineTo(cx + reticleR + 10, cy - 35); fx.lineTo(cx + reticleR - 5, cy - 35);
      fx.moveTo(cx - reticleR - 10, cy + 20); fx.lineTo(cx - reticleR - 10, cy + 35); fx.lineTo(cx - reticleR + 5, cy + 35);
      fx.moveTo(cx + reticleR + 10, cy + 20); fx.lineTo(cx + reticleR + 10, cy + 35); fx.lineTo(cx + reticleR - 5, cy + 35);
      fx.stroke();

      // Crosshairs
      fx.beginPath();
      fx.moveTo(cx - 12, cy); fx.lineTo(cx + 12, cy);
      fx.moveTo(cx, cy - 12); fx.lineTo(cx, cy + 12);
      fx.stroke();

      // HUD Telemetry Text
      fx.font = '700 11px monospace';
      fx.fillStyle = 'rgba(0, 255, 234, 0.9)';
      fx.fillText('SYS // CYBER-LINK 2.4.9', 16, 28);
      fx.fillText('STATUS: TARGET LOCKED [98.4%]', 16, 44);

      fx.fillStyle = 'rgba(255, 0, 128, 0.9)';
      const sec = Math.floor(t / 1000);
      fx.fillText(`FPS: 60 // SYNC: ${sec % 60}s`, Math.max(16, w - 175), 28);
      fx.fillText('OPTICS: NEURAL-EYE v3', Math.max(16, w - 175), 44);

      // Bottom cyber grid accents
      fx.strokeStyle = 'rgba(255, 0, 128, 0.4)';
      fx.strokeRect(16, h - 36, 120, 20);
      fx.fillStyle = 'rgba(255, 0, 128, 0.2)';
      fx.fillRect(16, h - 36, 60 + Math.sin(t * 0.005) * 40, 20);
      fx.fillStyle = '#ffffff';
      fx.fillText('CORE: OPTIMAL', 24, h - 22);

      // Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.15)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1);
      }
      fx.restore();
    }
  };

export default cyberglitchEffect;
