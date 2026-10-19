/* WebcamClicks — mosaic 2D filter effect */

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

export const mosaicEffect = {
    id: 'mosaic', name: 'Mosaic', icon: '🔷', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const cols = 28;
      const rows = Math.max(2, Math.round((cols * h) / w));
      const sc = ensureScratch(cols, rows);
      sc.gx.drawImage(src, 0, 0, cols, rows);
      fx.imageSmoothingEnabled = false;
      fx.drawImage(sc.canvas, 0, 0, w, h);
      fx.imageSmoothingEnabled = true;
    }
  };

export default mosaicEffect;
