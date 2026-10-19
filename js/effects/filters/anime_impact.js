/* WebcamClicks — anime_impact 2D filter effect */

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

export const animeImpactEffect = {
    id: 'anime_impact', name: 'Manga Anime Impact', icon: '💥', category: 'Art', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 22);

      fx.save();
      // Japanese action manga black & white ink style
      fx.filter = 'grayscale(1) contrast(1.75) brightness(1.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Live Head-Tracked Radiating Speed Lines converging directly on head!
      const cx = pose.cx;
      const cy = pose.cy;
      const rMax = Math.hypot(w, h) * 0.6;
      const rMin = Math.max(pose.w, pose.h) * 0.45;
      const lines = 42;

      fx.strokeStyle = '#000000';
      fx.fillStyle = '#000000';
      for (let i = 0; i < lines; i++) {
        const seed = (i * 137.5 + t * 0.012) % (Math.PI * 2);
        const lMin = rMin * (0.85 + Math.sin(i * 3 + t * 0.02) * 0.25);
        const lMax = rMax;
        const spread = (Math.PI * 2) / (lines * 2.5);

        fx.beginPath();
        fx.moveTo(cx + Math.cos(seed) * lMin, cy + Math.sin(seed) * lMin);
        fx.lineTo(cx + Math.cos(seed - spread) * lMax, cy + Math.sin(seed - spread) * lMax);
        fx.lineTo(cx + Math.cos(seed + spread) * lMax, cy + Math.sin(seed + spread) * lMax);
        fx.closePath();
        fx.fill();
      }

      // Manga Action Onomatopoeia Stamp (「ドォォン!!」 / "BOOOM!!") tracking head position
      const fs = Math.max(22, Math.round(w * 0.065));
      fx.font = `900 ${fs}px "Hiragino Kaku Gothic Pro", "Yu Gothic", sans-serif`;
      fx.textBaseline = 'middle';
      fx.textAlign = 'center';

      const stampX = cx + pose.w * 0.65;
      const stampY = cy - pose.h * 0.4;
      fx.save();
      fx.translate(stampX, stampY);
      fx.rotate(pose.angle - 0.15 + Math.sin(t * 0.008) * 0.04);

      // Speed drop shadow
      fx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      fx.fillText('ドォォン!!', 4, 4);

      // Primary bold stroke & fill
      fx.strokeStyle = '#000000';
      fx.lineWidth = Math.max(4, Math.round(w * 0.008));
      fx.strokeText('ドォォン!!', 0, 0);
      fx.fillStyle = '#ffffff';
      fx.fillText('ドォォン!!', 0, 0);
      fx.restore();

      // Comic action panel border
      fx.strokeStyle = '#000000';
      fx.lineWidth = Math.max(4, Math.round(w * 0.008));
      fx.strokeRect(0, 0, w, h);
      fx.restore();
    }
  };

export default animeImpactEffect;
