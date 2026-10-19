/* WebcamClicks — quadcam 2D filter effect */

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

export const quadcamEffect = {
    id: 'quadcam', name: 'Quad Cam', icon: '🎛️', category: 'Mirror', perf: 'medium',
    render(fx, { src, width: w, height: h }) {
      const hw = w / 2;
      const hh = h / 2;
      fx.fillStyle = '#000';
      fx.fillRect(0, 0, w, h);
      fx.drawImage(src, 0, 0, hw, hh);
      fx.save();
      fx.translate(w, 0);
      fx.scale(-1, 1);
      fx.filter = 'saturate(1.6) contrast(1.15)';
      fx.drawImage(src, 0, 0, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.save();
      fx.filter = 'sepia(0.8) contrast(1.2)';
      fx.drawImage(src, 0, hh, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.save();
      fx.filter = 'invert(1)';
      fx.drawImage(src, hw, hh, hw, hh);
      fx.filter = 'none';
      fx.restore();
      fx.strokeStyle = 'rgba(255,255,255,0.7)';
      fx.lineWidth = 2;
      fx.beginPath();
      fx.moveTo(hw, 0); fx.lineTo(hw, h);
      fx.moveTo(0, hh); fx.lineTo(w, hh);
      fx.stroke();
    }
  };

export default quadcamEffect;
