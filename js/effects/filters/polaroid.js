/* WebcamClicks — polaroid 2D filter effect */

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

export const polaroidEffect = {
    id: 'polaroid', name: 'Polaroid 600', icon: '📷', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'contrast(1.1) brightness(1.08) saturate(1.18) sepia(0.12)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      fx.save();
      const chemGrad = fx.createLinearGradient(0, 0, 0, h);
      chemGrad.addColorStop(0, 'rgba(255, 240, 200, 0.14)');
      chemGrad.addColorStop(0.7, 'rgba(100, 200, 220, 0.08)');
      chemGrad.addColorStop(1, 'rgba(50, 80, 120, 0.18)');
      fx.globalCompositeOperation = 'soft-light';
      fx.fillStyle = chemGrad;
      fx.fillRect(0, 0, w, h);
      fx.restore();

      const frameW = Math.round(w * 0.035);
      const frameBot = Math.round(h * 0.09);
      fx.fillStyle = '#f8fafc';
      fx.fillRect(0, 0, w, frameW);
      fx.fillRect(0, 0, frameW, h);
      fx.fillRect(w - frameW, 0, frameW, h);
      fx.fillRect(0, h - frameBot, w, frameBot);

      applyFilmGrain(fx, w, h, 0.16);
    }
  };

export default polaroidEffect;
