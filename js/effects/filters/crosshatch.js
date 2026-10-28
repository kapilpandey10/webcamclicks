/* WebcamClicks — crosshatch 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const crosshatchEffect = {
  id: 'crosshatch', name: 'Crosshatch', icon: '✒️', category: 'Art', perf: 'medium',
  render(fx, { src, width, height }) {
    fx.filter = 'grayscale(0.6) contrast(1.3)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    fx.strokeStyle = 'rgba(0,0,0,0.25)';
    fx.lineWidth = 1.5;
    const step = 12;
    for (let y = 0; y < height; y += step) {
      fx.beginPath(); fx.moveTo(0, y); fx.lineTo(width, y); fx.stroke();
    }
    for (let x = 0; x < width; x += step) {
      fx.beginPath(); fx.moveTo(x, 0); fx.lineTo(x, height); fx.stroke();
    }
  }
};

export default crosshatchEffect;