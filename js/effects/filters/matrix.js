/* WebcamClicks — matrix 2D filter effect */

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

export const matrixEffect = {
    id: 'matrix', name: 'Matrix Rain', icon: '💻', category: 'Art', perf: 'medium',
    render(fx, { src, width: w, height: h, time: t }) {
      fx.save();
      fx.filter = 'contrast(1.4) brightness(0.7) hue-rotate(90deg) saturate(2)';
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();

      fx.save();
      fx.font = 'bold 15px monospace';
      const chars = '0123456789ABCDEFｦｱｳｴｵｶｷｹｺｻｼｽｾｿﾀﾂﾃﾅﾆﾇﾈﾊﾋﾎﾏﾐﾑﾒﾓﾔﾕﾗﾘﾜ';
      const cols = Math.floor(w / 18);

      for (let c = 0; c < cols; c++) {
        const speed = 120 + ((c * 17) % 80);
        const yHead = ((t * speed + c * 47) % (h + 100)) - 50;
        const x = c * 18 + 4;
        for (let row = 0; row < 10; row++) {
          const y = yHead - row * 16;
          if (y > 0 && y < h) {
            const charIdx = (c * 7 + row + Math.floor(t * 5)) % chars.length;
            const alpha = row === 0 ? 0.95 : (1 - row / 10) * 0.7;
            fx.fillStyle = row === 0 ? '#ffffff' : `rgba(34, 197, 94, ${alpha})`;
            fx.fillText(chars[charIdx], x, y);
          }
        }
      }
      fx.restore();
    }
  };

export default matrixEffect;
