/* WebcamClicks — thunder_god 2D filter effect */

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

export const thunderGodEffect = {
    id: 'thunder_god', name: 'Thor Thunder God', icon: '⚡', category: 'Sci-Fi', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 30);

      // Base video grading: electric hyper-contrast with cool blue undertones
      fx.save();
      const flash = (Math.sin(t * 0.012) > 0.88 && Math.random() < 0.4) ? 0.45 : 0;
      if (flash > 0) {
        fx.filter = 'contrast(1.6) brightness(1.35) saturate(0.8) hue-rotate(-20deg)';
      } else {
        fx.filter = 'contrast(1.35) brightness(0.92) saturate(1.2) hue-rotate(-15deg)';
      }
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Global lightning thunder flash illumination
      if (flash > 0) {
        fx.globalCompositeOperation = 'screen';
        fx.fillStyle = `rgba(186, 230, 253, ${flash})`;
        fx.fillRect(0, 0, w, h);
      }

      // Live electric aura & supercharged eyes
      const tx = pose.cx;
      const ty = pose.cy;
      const tr = Math.max(pose.w, pose.h) * 0.55;

      fx.globalCompositeOperation = 'screen';

      // 1. Glowing electric plasma aura around head
      const auraGrad = fx.createRadialGradient(tx, ty, tr * 0.4, tx, ty, tr * 1.3);
      auraGrad.addColorStop(0, 'rgba(56, 189, 248, 0.45)');
      auraGrad.addColorStop(0.5, 'rgba(129, 140, 248, 0.25)');
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = auraGrad;
      fx.beginPath();
      fx.arc(tx, ty, tr * 1.3, 0, Math.PI * 2);
      fx.fill();

      // 2. High-Voltage Jagged Lightning Arcs striking between screen corners and head!
      const strikeCount = 4 + (flash > 0 ? 4 : 0);
      fx.lineWidth = 2;
      fx.shadowBlur = 12;

      for (let i = 0; i < strikeCount; i++) {
        // Origin near border or random position
        const seed = (t * 0.02 + i * 37) % 100;
        const cornerX = (i % 2 === 0 ? 0 : w) + (Math.sin(seed) * w * 0.2);
        const cornerY = (i < 2 ? 0 : h) + (Math.cos(seed) * h * 0.2);

        // Target near user's head contour
        const targetAng = (i * Math.PI * 2) / strikeCount + Math.sin(t * 0.005 + i) * 0.5;
        const targetX = tx + Math.cos(targetAng) * tr * 0.9;
        const targetY = ty + Math.sin(targetAng) * tr * 0.9;

        // Draw procedural recursive lightning bolt
        fx.strokeStyle = i % 2 === 0 ? '#38bdf8' : '#ffffff';
        fx.shadowColor = '#00f0ff';
        fx.beginPath();
        fx.moveTo(cornerX, cornerY);

        let curX = cornerX;
        let curY = cornerY;
        const segments = 9;
        for (let s = 1; s <= segments; s++) {
          const frac = s / segments;
          const baseX = cornerX + (targetX - cornerX) * frac;
          const baseY = cornerY + (targetY - cornerY) * frac;
          // Jitter perpendicular to strike path
          const jitter = (Math.sin(seed * 7 + s * 13 + t * 0.03) * tr * 0.35) * (1 - frac * 0.5);
          curX = baseX + jitter;
          curY = baseY + jitter * 0.5;
          fx.lineTo(curX, curY);
        }
        fx.stroke();
      }
      fx.shadowBlur = 0;

      // 3. Supercharged Glowing Electric Pupils
      const ed = pose.w * 0.42;
      const eyeR = Math.max(4, ed * 0.16);
      [-ed * 0.5, ed * 0.5].forEach((offX) => {
        const ex = tx + Math.cos(pose.angle) * offX - Math.sin(pose.angle) * (-ed * 0.1);
        const ey = ty + Math.sin(pose.angle) * offX + Math.cos(pose.angle) * (-ed * 0.1);

        const eyeGrad = fx.createRadialGradient(ex, ey, 0, ex, ey, eyeR * 3);
        eyeGrad.addColorStop(0, '#ffffff');
        eyeGrad.addColorStop(0.3, '#38bdf8');
        eyeGrad.addColorStop(0.6, '#6366f1');
        eyeGrad.addColorStop(1, 'rgba(0,0,0,0)');
        fx.fillStyle = eyeGrad;
        fx.beginPath();
        fx.arc(ex, ey, eyeR * 3, 0, Math.PI * 2);
        fx.fill();

        // Horizontal electric flare
        fx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        fx.fillRect(ex - eyeR * 4, ey - 1, eyeR * 8, 2);
      });

      fx.restore();
    }
  };

export default thunderGodEffect;
