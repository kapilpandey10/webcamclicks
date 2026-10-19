/* WebcamClicks — hearts 2D filter effect */

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

export const heartsEffect = {
    id: 'hearts', name: 'Hearts', icon: '💗', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) { this._w = w; this._p = []; }
      const t = clamp(dt, 0, 50);
      if (Math.random() < 0.3 && this._p.length < 26) {
        this._p.push({ x: Math.random() * w, y: h + 30, vy: -rand(0.05, 0.13), sway: rand(0.001, 0.004), phase: Math.random() * 6.28, s: rand(14, 34), hue: rand(320, 360) });
      }
      fx.textAlign = 'center';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.y += p.vy * t;
        p.phase += p.sway * t;
        if (p.y < -40) { this._p.splice(i, 1); continue; }
        fx.globalAlpha = 0.85;
        fx.font = `${p.s}px serif`;
        fx.fillStyle = `hsl(${p.hue} 90% 62%)`;
        fx.fillText('❤️', p.x + Math.sin(p.phase) * 22, p.y);
      }
      fx.globalAlpha = 1;
      fx.textAlign = 'left';
    }
  };

export default heartsEffect;
