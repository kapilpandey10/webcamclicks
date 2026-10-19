/* WebcamClicks — prism 2D filter effect */

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

export const prismEffect = {
    id: 'prism', name: 'Prism Flare', icon: '💎', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.drawImage(src, 0, 0, w, h);

      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.55;

      const sweepX = (Math.sin(t * 0.8) * 0.3 + 0.5) * w;
      const rainbow = fx.createLinearGradient(sweepX - 120, 0, sweepX + 120, h);
      rainbow.addColorStop(0, 'rgba(239, 68, 68, 0)');
      rainbow.addColorStop(0.15, 'rgba(239, 68, 68, 0.45)');
      rainbow.addColorStop(0.35, 'rgba(245, 158, 11, 0.45)');
      rainbow.addColorStop(0.5, 'rgba(16, 185, 129, 0.45)');
      rainbow.addColorStop(0.7, 'rgba(59, 130, 246, 0.45)');
      rainbow.addColorStop(0.85, 'rgba(168, 85, 247, 0.45)');
      rainbow.addColorStop(1, 'rgba(168, 85, 247, 0)');

      fx.fillStyle = rainbow;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default prismEffect;
