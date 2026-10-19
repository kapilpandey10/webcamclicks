/* WebcamClicks — diamond_prism 2D filter effect */

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

export const diamondPrismEffect = {
    id: 'diamond_prism', name: 'Diamond Crystal Prism', icon: '💎', category: 'Art', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      fx.save();
      fx.drawImage(src, 0, 0, w, h);

      const cx = pose.cx;
      const cy = pose.cy;
      const r = Math.max(pose.w, pose.h) * 0.7;

      // Hexagonal multi-facet refractions centered on head pose
      const facets = 6;
      for (let i = 0; i < facets; i++) {
        const a0 = (i * Math.PI * 2) / facets + pose.angle;
        const a1 = ((i + 1) * Math.PI * 2) / facets + pose.angle;
        const x0 = cx + Math.cos(a0) * r;
        const y0 = cy + Math.sin(a0) * r;
        const x1 = cx + Math.cos(a1) * r;
        const y1 = cy + Math.sin(a1) * r;

        fx.save();
        fx.beginPath();
        fx.moveTo(cx, cy);
        fx.lineTo(x0, y0);
        fx.lineTo(x1, y1);
        fx.closePath();
        fx.clip();

        // Facet refraction reflection with chromatic dispersion
        fx.translate(cx, cy);
        fx.rotate((i % 2 === 0 ? 0.08 : -0.08) * Math.sin(t * 0.001));
        fx.translate(-cx, -cy);

        fx.globalAlpha = 0.85;
        fx.drawImage(src, 0, 0, w, h);

        // Chromatic dispersion at seam
        fx.globalCompositeOperation = 'screen';
        fx.globalAlpha = 0.35;
        fx.drawImage(src, 3, 0, w, h);
        fx.drawImage(src, -3, 0, w, h);
        fx.restore();

        // Facet bevel line
        fx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
        fx.lineWidth = 1.5;
        fx.beginPath();
        fx.moveTo(cx, cy);
        fx.lineTo(x0, y0);
        fx.stroke();
      }

      // Dynamic diamond glint stars at vertex points
      fx.globalCompositeOperation = 'screen';
      for (let i = 0; i < facets; i++) {
        const a = (i * Math.PI * 2) / facets + pose.angle;
        const gx = cx + Math.cos(a) * r;
        const gy = cy + Math.sin(a) * r;
        const gl = (Math.sin(t * 0.004 + i * 1.5) + 1) * 0.5;
        if (gl > 0.5) {
          const spk = Math.max(10, Math.round(w * 0.025)) * gl;
          fx.strokeStyle = '#ffffff';
          fx.lineWidth = 2;
          fx.beginPath();
          fx.moveTo(gx - spk, gy); fx.lineTo(gx + spk, gy);
          fx.moveTo(gx, gy - spk); fx.lineTo(gx, gy + spk);
          fx.stroke();
        }
      }
      fx.restore();
    }
  };

export default diamondPrismEffect;
