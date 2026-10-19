/* WebcamClicks — supernova_cosmic 2D filter effect */

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

export const supernovaCosmicEffect = {
    id: 'supernova_cosmic', name: 'Cosmic Supernova & Pulsar', icon: '💥', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      fx.filter = 'contrast(1.3) brightness(1.05) saturate(1.4) hue-rotate(15deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const cx = pose.cx;
      const cy = pose.cy;
      const r = Math.max(20, pose.w * 0.5);

      fx.save();
      fx.translate(cx, cy);
      fx.rotate(pose.angle);
      fx.globalCompositeOperation = 'screen';

      // 1. Relativistic Astrophysical Jets shooting along magnetic poles!
      const jetLen = Math.max(w, h) * 0.7;
      [-1, 1].forEach((dir) => {
        const jGrad = fx.createLinearGradient(0, 0, 0, dir * jetLen);
        jGrad.addColorStop(0, '#ffffff');
        jGrad.addColorStop(0.15, 'rgba(56, 189, 248, 0.9)');
        jGrad.addColorStop(0.5, 'rgba(168, 85, 247, 0.4)');
        jGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = jGrad;
        fx.beginPath();
        fx.moveTo(-r * 0.15, 0);
        fx.lineTo(r * 0.15, 0);
        fx.lineTo(r * 0.6, dir * jetLen);
        fx.lineTo(-r * 0.6, dir * jetLen);
        fx.closePath();
        fx.fill();
      });

      // 2. Expanding Supernova Shockwave Rings
      for (let s = 0; s < 3; s++) {
        const ringProgress = ((t * 0.001 + s * 0.33) % 1);
        const ringR = r * (0.8 + ringProgress * 3.5);
        const alpha = (1 - ringProgress) * 0.75;
        fx.strokeStyle = s % 2 === 0 ? `rgba(244, 63, 94, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
        fx.lineWidth = Math.max(2, Math.round(r * 0.05 * (1 - ringProgress)));
        fx.beginPath();
        fx.arc(0, 0, ringR, 0, Math.PI * 2);
        fx.stroke();
      }

      // 3. Central Hyper-Dense Stellar Core (Neutron Star / Pulsar Core)
      const coreR = r * 0.45 * (0.9 + 0.1 * Math.sin(t * 0.008));
      const coreGrad = fx.createRadialGradient(0, 0, 0, 0, 0, coreR * 2.5);
      coreGrad.addColorStop(0, '#ffffff');
      coreGrad.addColorStop(0.25, 'rgba(254, 240, 138, 0.95)');
      coreGrad.addColorStop(0.6, 'rgba(249, 115, 22, 0.6)');
      coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = coreGrad;
      fx.beginPath();
      fx.arc(0, 0, coreR * 2.5, 0, Math.PI * 2);
      fx.fill();

      // 4. Stellar Nursery Sparkles with 4-Point Cross Diffraction Spikes
      for (let i = 0; i < 28; i++) {
        const sa = (i * 137.5 * Math.PI) / 180 + t * 0.0003;
        const sr = r * (0.6 + ((i * 19) % 25) * 0.08);
        const sx = Math.cos(sa) * sr;
        const sy = Math.sin(sa) * sr;
        const sSize = 4 + (Math.sin(t * 0.006 + i) + 1) * 3;

        fx.strokeStyle = i % 2 === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(253, 224, 71, 0.9)';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(sx - sSize, sy); fx.lineTo(sx + sSize, sy);
        fx.moveTo(sx, sy - sSize); fx.lineTo(sx, sy + sSize);
        fx.stroke();
      }

      fx.restore();
      fx.restore();
    }
  };

export default supernovaCosmicEffect;
