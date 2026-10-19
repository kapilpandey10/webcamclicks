/* WebcamClicks — emojirain 2D filter effect */

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

export const emojirainEffect = {
    id: 'emojirain', name: 'Emoji Rain', icon: '😍', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, dt }) {
      fx.drawImage(src, 0, 0, w, h);
      if (!this._p || this._w !== w) {
        this._w = w;
        this._p = [];
      }
      const t = clamp(dt, 0, 50);
      if (Math.random() < 0.35 && this._p.length < 40) {
        this._p.push({ x: Math.random() * w, y: -30, vy: rand(0.06, 0.16), vx: rand(-0.02, 0.02), rot: rand(-0.002, 0.002), a: 0, emoji: pick(['😍', '😎', '🤩', '😂', '🥳', '😜', '🤠', '👻', '🐶', '🦄', '⭐', '🍕', '🎈', '💜']) });
      }
      fx.textAlign = 'center';
      fx.textBaseline = 'middle';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.y += p.vy * t;
        p.x += p.vx * t;
        p.rot += 0.0;
        if (p.y > h + 40) { this._p.splice(i, 1); continue; }
        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(Math.sin(p.y / 80) * 0.3);
        fx.font = '28px serif';
        fx.fillText(p.emoji, 0, 0);
        fx.restore();
      }
      fx.textAlign = 'left';
      fx.textBaseline = 'alphabetic';
    }
  };

export default emojirainEffect;
