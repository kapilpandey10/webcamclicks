/* WebcamClicks — glitch_dimension 2D filter effect */

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

export const glitchDimensionEffect = {
    id: 'glitch_dimension', name: 'Glitch Dimension', icon: '🌀', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      fx.save();
      fx.filter = 'contrast(1.28) saturate(1.4)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // RGB split horizontal displacement bursts
      const splitAmount = Math.max(4, Math.round(w * 0.015)) + Math.sin(t * 0.006) * 6;
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.5;
      fx.drawImage(src, -splitAmount, 0, w, h);
      fx.drawImage(src, splitAmount, 0, w, h);

      // Reality-tear slicing block displacements centered around head position
      const sliceCount = 6 + Math.floor(Math.random() * 5);
      for (let i = 0; i < sliceCount; i++) {
        const sy = pose.cy - pose.h * 0.6 + Math.random() * pose.h * 1.2;
        const sh = Math.max(6, Math.random() * (h * 0.1));
        const shift = (Math.random() - 0.5) * (w * 0.08);
        fx.drawImage(src, 0, sy, w, sh, shift, sy, w, sh);
      }

      // Matrix noise bursts
      fx.globalAlpha = 0.25;
      fx.fillStyle = '#00ff66';
      for (let i = 0; i < 4; i++) {
        const bx = pose.cx - pose.w * 0.5 + Math.random() * pose.w;
        const by = pose.cy - pose.h * 0.5 + Math.random() * pose.h;
        const bw = 30 + Math.random() * 60;
        const bh = 8 + Math.random() * 16;
        fx.fillRect(bx, by, bw, bh);
      }

      // Scanlines & static flash
      fx.globalCompositeOperation = 'source-over';
      fx.globalAlpha = 0.16;
      fx.fillStyle = '#000000';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      if (Math.random() < 0.08) {
        fx.globalAlpha = 0.35;
        fx.fillStyle = '#ffffff';
        fx.fillRect(0, 0, w, h);
      }
      fx.restore();
    }
  };

export default glitchDimensionEffect;
