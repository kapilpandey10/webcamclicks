/* WebcamClicks — chromatic 2D filter effect */

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
/* WebcamClicks — chromatic 2D filter effect (Fixed millisecond time scaling) */

export const chromaticEffect = {
  id: 'chromatic', name: 'Prism Glitch', icon: '💎', category: 'Art', perf: 'low',
  render(fx, { src, width: w, height: h, time = 0 }) {
    const t = time * 0.001;
    const shift = 4 + Math.sin(t * 2.5) * 2.5;
    fx.save();
    fx.filter = 'hue-rotate(340deg) saturate(1.4)';
    fx.drawImage(src, -shift, 0, w, h);

    fx.globalCompositeOperation = 'screen';
    fx.filter = 'hue-rotate(180deg) saturate(1.4)';
    fx.drawImage(src, shift, 0, w, h);

    fx.globalCompositeOperation = 'overlay';
    fx.filter = 'contrast(1.1)';
    fx.globalAlpha = 0.6;
    fx.drawImage(src, 0, 0, w, h);
    fx.restore();
  }
};

export default chromaticEffect;