/* WebcamClicks — promist 2D filter effect */

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

export const promistEffect = {
    id: 'promist', name: 'Dream Pro-Mist', icon: '✨', category: 'Cinema', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.08) brightness(1.04) saturate(1.15)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      renderHalationBloom(fx, src, w, h, 0.52, 'warm');

      fx.save();
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = 'rgba(255, 235, 210, 0.2)';
      fx.fillRect(0, 0, w, h);
      fx.restore();

      applyFilmGrain(fx, w, h, 0.12);
    }
  };

export default promistEffect;
