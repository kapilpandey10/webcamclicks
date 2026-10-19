/* WebcamClicks — snow 2D filter effect */

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

export const snowEffect = {
    id: 'snow', name: 'Snow', icon: '❄️', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) {
        this._w = w;
        this._p = Array.from({ length: 70 }, () => this._flake(w, h, true));
      }
      const t = clamp(dt, 0, 50);
      fx.fillStyle = 'rgba(255,255,255,0.92)';
      for (const p of this._p) {
        p.y += p.vy * t;
        p.phase += p.sway * t;
        p.x += Math.sin(p.phase) * p.drift;
        if (p.y > h + 8) Object.assign(p, this._flake(w, h, false));
        fx.globalAlpha = p.a;
        fx.beginPath();
        fx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalAlpha = 1;
    },
    _flake(w, h, anyY) {
      return {
        x: Math.random() * w,
        y: anyY ? Math.random() * h : -8,
        r: 1 + Math.random() * 3,
        vy: 0.02 + Math.random() * 0.06,
        drift: 0.25 + Math.random() * 0.5,
        sway: 0.0015 + Math.random() * 0.004,
        phase: Math.random() * 6.28,
        a: 0.5 + Math.random() * 0.5
      };
    }
  };

export default snowEffect;
