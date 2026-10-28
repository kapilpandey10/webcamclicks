/* WebcamClicks — wedge 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const wedgeEffect = {
  id: 'wedge', name: 'Wedge', icon: '🧀', category: 'Fun', perf: 'low',
  render(fx, { src, width, height }) {
    fx.filter = 'saturate(0.6) contrast(1.2) brightness(1.1)';
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Wedge overlay shapes
    fx.fillStyle = 'rgba(255,200,100,0.2)';
    fx.beginPath();
    fx.moveTo(0, 0);
    fx.lineTo(width * 0.4, 0);
    fx.lineTo(0, height * 0.4);
    fx.closePath();
    fx.fill();
    fx.fillStyle = 'rgba(100,200,255,0.15)';
    fx.beginPath();
    fx.moveTo(width, height);
    fx.lineTo(width * 0.6, height);
    fx.lineTo(width, height * 0.6);
    fx.closePath();
    fx.fill();
  }
};

export default wedgeEffect;