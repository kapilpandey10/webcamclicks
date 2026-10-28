/* WebcamClicks — lsd 2D filter effect (WebcamToy parity) */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch, pixelPass, lumOf, addNoise, getGrainPattern, applyFilmGrain,
  getBloomCanvas, renderHalationBloom, drawDateStamp, drawAnamorphicStreak,
  drawBackgroundBokehDiscs, renderShutterMotion, renderDreamTrails,
  renderPortraitBokeh, getFisheyeBuffers, renderFisheye, renderFlirThermal,
  renderNeonEdgePass, drawCausticRays, renderLiquidRainbowPass,
  getHeadPose, smoothPose
} from './filter-helpers.js';

export const lsdEffect = {
  id: 'lsd', name: 'LSD', icon: '🌀', category: 'Art', perf: 'medium',
  render(fx, { src, width, height, time }) {
    const hue = (time * 0.05) % 360;
    fx.filter = `saturate(2.5) hue-rotate(${hue}deg) contrast(1.4) brightness(1.15)`;
    fx.drawImage(src, 0, 0, width, height);
    fx.filter = 'none';
    // Psychedelic color shift bars
    const barH = height * 0.12;
    const barY = ((time * 0.15) % height);
    fx.fillStyle = `hsla(${hue}, 80%, 50%, 0.3)`;
    fx.fillRect(0, barY, width, barH);
    fx.fillStyle = `hsla(${(hue + 120) % 360}, 80%, 50%, 0.2)`;
    fx.fillRect(0, (barY + height * 0.5) % height, width, barH);
  }
};

export default lsdEffect;