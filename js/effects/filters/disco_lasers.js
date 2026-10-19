/* WebcamClicks — disco_lasers 2D filter effect */

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

export const discoLasersEffect = {
    id: 'disco_lasers', name: 'Disco Lasers', icon: '🪩', category: 'Fun', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      fx.save();
      fx.globalCompositeOperation = 'screen';
      const colors = ['#f43f5e', '#06b6d4', '#eab308', '#a855f7'];
      for (let i = 0; i < 4; i++) {
        const angle = t * (0.8 + i * 0.2) + (i * Math.PI) / 2;
        const lx = w / 2 + Math.cos(angle) * (w * 0.55);
        const ly = h / 2 + Math.sin(angle) * (h * 0.55);

        const beam = fx.createRadialGradient(lx, ly, 10, w / 2, h / 2, w * 0.7);
        beam.addColorStop(0, colors[i % colors.length]);
        beam.addColorStop(0.5, 'rgba(0,0,0,0)');

        fx.globalAlpha = 0.5;
        fx.fillStyle = beam;
        fx.fillRect(0, 0, w, h);
      }
      fx.restore();
    }
  };

export default discoLasersEffect;
