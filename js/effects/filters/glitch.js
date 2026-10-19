/* WebcamClicks — glitch 2D filter effect */

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

export const glitchEffect = {
    id: 'glitch', name: 'Cyber Glitch', icon: '⚡', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      // 1. Dynamic RGB Split / Chromatic Aberration
      const shiftMagnitude = (Math.random() < 0.25 ? 16 : 6) + Math.sin(t * 0.02) * 5;
      fx.save();
      fx.globalCompositeOperation = 'screen';
      
      // Magenta/Red channel shift
      fx.globalAlpha = 0.65;
      fx.filter = 'hue-rotate(300deg) saturate(2.4)';
      fx.drawImage(src, shiftMagnitude, 0, w, h);
      
      // Cyan/Blue channel shift
      fx.globalAlpha = 0.65;
      fx.filter = 'hue-rotate(160deg) saturate(2.4)';
      fx.drawImage(src, -shiftMagnitude, 0, w, h);
      fx.restore();

      // 2. Horizontal slice tear jitter
      const sliceCount = 3 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const sy = Math.random() * h;
        const sh = 4 + Math.random() * 26;
        const dx = (Math.random() * 36 - 18) * (Math.random() < 0.5 ? 1 : -1);
        fx.drawImage(src, 0, sy, w, sh, dx, sy, w, sh);
      }

      // 3. Digital noise bars
      if (Math.random() < 0.45) {
        const barY = Math.random() * h;
        const barH = 2 + Math.random() * 10;
        fx.fillStyle = pick(['rgba(0, 255, 234, 0.4)', 'rgba(255, 0, 128, 0.4)', 'rgba(255, 255, 255, 0.3)']);
        fx.fillRect(0, barY, w, barH);
      }

      // 4. CRT Scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.12)';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1.5);
      }
    }
  };

export default glitchEffect;
