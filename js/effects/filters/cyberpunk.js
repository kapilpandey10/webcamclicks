/* WebcamClicks — cyberpunk 2D filter effect */

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

export const cyberpunkEffect = {
    id: 'cyberpunk', name: 'Cyberpunk Neon', icon: '🌆', category: 'Art', perf: 'low',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.35) saturate(1.8) hue-rotate(-20deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.45;
      const shift = 4 + Math.sin(t * 3) * 2;
      fx.fillStyle = '#06b6d4';
      fx.fillRect(0, 0, w, h);
      fx.globalCompositeOperation = 'overlay';
      fx.drawImage(src, -shift, 0, w, h);
      fx.fillStyle = '#f43f5e';
      fx.fillRect(0, 0, w, h);
      fx.drawImage(src, shift, 0, w, h);

      fx.globalAlpha = 0.18;
      fx.fillStyle = '#000000';
      for (let y = 0; y < h; y += 4) {
        fx.fillRect(0, y, w, 1.5);
      }
      fx.restore();
    }
  };

export default cyberpunkEffect;
