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
/* WebcamClicks — cyberpunk 2D filter effect (Fixed millisecond time scaling) */

export const cyberpunkEffect = {
  id: 'cyberpunk', name: 'Cyberpunk Neon', icon: '🌆', category: 'Art', perf: 'low',
  render(fx, { src, width: w, height: h, time = 0 }) {
    const t = time * 0.001;
    fx.save();
    fx.filter = 'contrast(1.32) saturate(1.65) hue-rotate(-18deg)';
    fx.drawImage(src, 0, 0, w, h);
    fx.restore();

    fx.save();
    const shift = 3 + Math.sin(t * 3.0) * 2;
    fx.globalCompositeOperation = 'screen';
    fx.globalAlpha = 0.28;
    fx.drawImage(src, -shift, 0, w, h);

    // Enhanced neon gradient with dynamic flicker
    const grad = fx.createLinearGradient(0, 0, w, h);
    grad.addColorStop(0, 'rgba(0, 255, 200, 0.4)'); // cyan
    grad.addColorStop(0.5, 'rgba(255, 20, 147, 0.3)'); // deep pink
    grad.addColorStop(1, 'rgba(255, 255, 0, 0.45)'); // bright yellow
    fx.fillStyle = grad;
    // Apply slight time‑based alpha flicker for a pulsing neon effect
    const flicker = 0.6 + 0.4 * Math.sin(time * 0.5);
    fx.globalAlpha = flicker;
    fx.fillRect(0, 0, w, h);
    // Reset alpha for subsequent operations
    fx.globalAlpha = 1.0;

    fx.globalCompositeOperation = 'source-over';
    fx.globalAlpha = 0.14;
    fx.fillStyle = '#000000';
    for (let y = 0; y < h; y += 4) {
      fx.fillRect(0, y, w, 1.5);
    }
    fx.restore();
  }
};

export default cyberpunkEffect;