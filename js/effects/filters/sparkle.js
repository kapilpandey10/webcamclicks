/* WebcamClicks — sparkle 2D filter effect */

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

export const sparkleEffect = {
    id: 'sparkle', name: 'Sparkle', icon: '✨', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt, motion }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p) this._p = [];
      const t = clamp(dt, 0, 50);
      const spawn = 3 + ((Math.random() * 2) | 0) + (motion && motion.level > 0.06 ? 4 : 0);
      for (let i = 0; i < spawn; i++) {
        let x = Math.random() * w;
        let y = Math.random() * h;
        if (motion && motion.level > 0.06 && Math.random() < 0.65) {
          x = motion.cx * w + rand(-60, 60);
          y = motion.cy * h + rand(-60, 60);
        }
        this._p.push({ x, y, life: rand(350, 800), age: 0, r: rand(3, 9) });
      }
      fx.globalCompositeOperation = 'lighter';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += t;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        const s = p.r * k * (0.6 + 0.4 * Math.sin(p.age / 90));
        fx.strokeStyle = `rgba(255,255,210,${0.9 * k})`;
        fx.lineWidth = 1.6;
        fx.beginPath();
        fx.moveTo(p.x - s, p.y); fx.lineTo(p.x + s, p.y);
        fx.moveTo(p.x, p.y - s); fx.lineTo(p.x, p.y + s);
        fx.stroke();
      }
      fx.globalCompositeOperation = 'source-over';
      if (this._p.length > 400) this._p.splice(0, this._p.length - 400);
    }
  };

export default sparkleEffect;
