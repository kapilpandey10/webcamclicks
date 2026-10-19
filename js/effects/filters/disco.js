/* WebcamClicks — disco 2D filter effect */

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

export const discoEffect = {
    id: 'disco', name: 'Disco', icon: '🪩', category: 'Fun', perf: 'medium',
    render(fx, { src, width: w, height: h, time }) {
      fx.filter = `hue-rotate(${(time / 12) % 360}deg) saturate(1.5)`;
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      fx.globalCompositeOperation = 'lighter';
      const t = time / 1000;
      const cols = ['rgba(255,60,130,0.30)', 'rgba(60,130,255,0.30)', 'rgba(120,255,120,0.28)'];
      for (let i = 0; i < 3; i++) {
        const cx = w * (0.5 + 0.42 * Math.sin(t * (0.7 + i * 0.23) + i * 2.1));
        const cy = h * (0.5 + 0.4 * Math.cos(t * (0.9 + i * 0.17) + i * 1.7));
        const g = fx.createRadialGradient(cx, cy, 4, cx, cy, Math.max(w, h) * 0.45);
        g.addColorStop(0, cols[i]);
        g.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = g;
        fx.fillRect(0, 0, w, h);
      }
      fx.globalCompositeOperation = 'source-over';
      if (Math.random() < 0.08) {
        fx.fillStyle = 'rgba(255,255,255,0.22)';
        fx.fillRect(0, 0, w, h);
      }
    }
  };

export default discoEffect;
