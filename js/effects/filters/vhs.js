/* WebcamClicks — vhs 2D filter effect */

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

export const vhsEffect = {
    id: 'vhs', name: 'VHS Tape', icon: '📼', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.drawImage(src, 0, 0, w, h);
      fx.globalCompositeOperation = 'lighter';
      fx.globalAlpha = 0.22;
      fx.filter = 'hue-rotate(310deg) saturate(1.8)';
      fx.drawImage(src, 3, 0, w, h);
      fx.filter = 'hue-rotate(140deg) saturate(1.8)';
      fx.drawImage(src, -3, 0, w, h);
      fx.filter = 'none';
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';
      fx.fillStyle = 'rgba(0,0,0,0.16)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);
      const trackY = ((time / 14) % (h + 160)) - 80;
      const grad = fx.createLinearGradient(0, trackY - 40, 0, trackY + 40);
      grad.addColorStop(0, 'rgba(255,255,255,0)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.16)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      fx.fillStyle = grad;
      fx.fillRect(0, trackY - 40, w, 80);
      fx.font = '600 16px "Courier New", monospace';
      fx.fillStyle = 'rgba(255,255,255,0.85)';
      fx.fillText('REC', 14, 26);
      if ((time % 900) < 500) {
        fx.fillStyle = 'rgba(255,60,60,0.95)';
        fx.beginPath();
        fx.arc(48, 20, 5, 0, Math.PI * 2);
        fx.fill();
      }
      fx.fillStyle = 'rgba(255,255,255,0.7)';
      fx.textAlign = 'right';
      fx.fillText('PLAY ▶', w - 12, h - 12);
      fx.textAlign = 'left';
    }
  };

export default vhsEffect;
