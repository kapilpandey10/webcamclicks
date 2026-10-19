/* WebcamClicks — lomo 2D filter effect */

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

export const lomoEffect = {
    id: 'lomo', name: 'Lomo', icon: '📸', category: 'Vintage', perf: 'low',
    render(fx, { src, width: w, height: h }) {
      fx.filter = 'saturate(1.55) contrast(1.32) brightness(0.96)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.22, w / 2, h / 2, Math.max(w, h) * 0.62);
      g.addColorStop(0, 'rgba(0,0,0,0)');
      g.addColorStop(0.75, 'rgba(0,0,20,0.25)');
      g.addColorStop(1, 'rgba(0,0,30,0.72)');
      fx.fillStyle = g;
      fx.fillRect(0, 0, w, h);
    }
  };

export default lomoEffect;
