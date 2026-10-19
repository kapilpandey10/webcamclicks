/* WebcamClicks — anime 2D filter effect */

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

export const animeEffect = {
    id: 'anime', name: 'Anime Sparkles', icon: '✨', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'saturate(1.35) brightness(1.08) contrast(1.05)';
      fx.drawImage(src, 0, 0, w, h);

      const starCount = 14;
      for (let i = 0; i < starCount; i++) {
        const seed = i * 137.5;
        const speed = 0.6 + (i % 4) * 0.25;
        const x = ((seed * 7 + t * 40 * speed) % (w + 60)) - 30;
        const y = ((seed * 11 + Math.sin(t * 1.5 + i) * 60) % (h + 60)) - 30;
        const size = 6 + (Math.sin(t * 4 + i) + 1) * 6;
        const rot = t * 2 + i;

        fx.save();
        fx.translate(x, y);
        fx.rotate(rot);
        fx.fillStyle = i % 2 === 0 ? '#fbcfe8' : '#ffffff';
        fx.shadowColor = '#ec4899';
        fx.shadowBlur = 8;

        fx.beginPath();
        fx.moveTo(0, -size);
        fx.quadraticCurveTo(0, 0, size, 0);
        fx.quadraticCurveTo(0, 0, 0, size);
        fx.quadraticCurveTo(0, 0, -size, 0);
        fx.quadraticCurveTo(0, 0, 0, -size);
        fx.fill();
        fx.restore();
      }
      fx.restore();
    }
  };

export default animeEffect;
