/* WebcamClicks — arcade8bit 2D filter effect */

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

export const arcade8bitEffect = {
    id: 'arcade8bit', name: '8-Bit Arcade', icon: '👾', category: 'Classic', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      const pixelSize = 7;
      const smallW = Math.max(2, Math.floor(w / pixelSize));
      const smallH = Math.max(2, Math.floor(h / pixelSize));

      fx.save();
      fx.imageSmoothingEnabled = false;
      fx.drawImage(src, 0, 0, smallW, smallH);
      fx.filter = 'contrast(1.3) saturate(1.4)';
      fx.drawImage(fx.canvas, 0, 0, smallW, smallH, 0, 0, w, h);
      fx.restore();
    }
  };

export default arcade8bitEffect;
