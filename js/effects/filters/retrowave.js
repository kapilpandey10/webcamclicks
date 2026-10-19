/* WebcamClicks — retrowave 2D filter effect */

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

export const retrowaveEffect = {
    id: 'retrowave', name: '80s Retrowave', icon: '🌆', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.25) saturate(1.4) hue-rotate(275deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      // Neon purple horizon gradient
      fx.save();
      const horizonY = h * 0.65;
      const sunset = fx.createLinearGradient(0, horizonY, 0, h);
      sunset.addColorStop(0, 'rgba(236, 72, 153, 0.1)');
      sunset.addColorStop(1, 'rgba(168, 85, 247, 0.35)');
      fx.fillStyle = sunset;
      fx.fillRect(0, horizonY, w, h - horizonY);

      // Neon perspective wireframe grid on lower third
      fx.strokeStyle = 'rgba(236, 72, 153, 0.55)';
      fx.lineWidth = 1.5;
      const speed = (t * 0.05) % 30;
      for (let y = horizonY + speed; y < h; y += 24) {
        fx.beginPath();
        fx.moveTo(0, y);
        fx.lineTo(w, y);
        fx.stroke();
      }
      // Perspective rays
      const vcx = w / 2;
      for (let x = -w * 0.5; x <= w * 1.5; x += w / 8) {
        fx.beginPath();
        fx.moveTo(vcx, horizonY);
        fx.lineTo(x, h);
        fx.stroke();
      }

      // Scanlines & CRT timestamp
      fx.fillStyle = 'rgba(0, 0, 0, 0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      fx.font = '700 14px "Courier New", monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fillText('PLAY ▶ 00:84:19', 16, 26);
      fx.restore();
    }
  };

export default retrowaveEffect;
