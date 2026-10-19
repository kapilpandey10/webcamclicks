/* WebcamClicks — film_noir_1940 2D filter effect */

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

export const filmNoir1940Effect = {
    id: 'film_noir_1940', name: '1940s Film Noir Detective', icon: '🕵️', category: 'Cinema', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      // Chiaroscuro high-contrast black & white grading
      fx.save();
      fx.filter = 'grayscale(1) contrast(1.65) brightness(0.92)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // 1. Live Head-Tracked Oval Spotlight following detective's face
      const spotGrad = fx.createRadialGradient(
        pose.cx, pose.cy, Math.max(15, pose.w * 0.35),
        pose.cx, pose.cy, Math.max(w, h) * 0.65
      );
      spotGrad.addColorStop(0, 'rgba(0, 0, 0, 0)');
      spotGrad.addColorStop(0.5, 'rgba(0, 0, 0, 0.45)');
      spotGrad.addColorStop(1, 'rgba(0, 0, 0, 0.88)');
      fx.fillStyle = spotGrad;
      fx.fillRect(0, 0, w, h);

      // 2. Venetian Blind Shadow Slats casting dramatic diagonal stripes
      fx.save();
      fx.rotate(-0.25);
      fx.fillStyle = 'rgba(0, 0, 0, 0.42)';
      const slatH = Math.max(14, Math.round(h * 0.055));
      const slatGap = Math.max(12, Math.round(h * 0.045));
      const totalH = h * 1.5;
      for (let y = -h * 0.3; y < totalH; y += slatH + slatGap) {
        fx.fillRect(-w * 0.3, y, w * 1.6, slatH);
      }
      fx.restore();

      // 3. Realistic curling cigarette smoke wisps drifting past head
      if (!this._smoke) this._smoke = [];
      if (Math.random() < 0.4) {
        this._smoke.push({
          x: pose.cx + (Math.random() - 0.5) * (pose.w * 0.3),
          y: pose.cy + pose.h * 0.3,
          r: rand(10, 24),
          vx: rand(-0.02, 0.02),
          vy: -rand(0.06, 0.14),
          age: 0,
          life: rand(1800, 3200)
        });
      }

      fx.save();
      fx.globalCompositeOperation = 'screen';
      for (let i = this._smoke.length - 1; i >= 0; i--) {
        const sm = this._smoke[i];
        sm.age += delta;
        if (sm.age >= sm.life) {
          this._smoke.splice(i, 1);
          continue;
        }
        const k = 1 - sm.age / sm.life;
        sm.x += sm.vx * delta + Math.sin(t * 0.003 + sm.age * 0.004) * 0.6;
        sm.y += sm.vy * delta;
        const curR = sm.r * (1 + (1 - k) * 1.5);

        const sg = fx.createRadialGradient(sm.x, sm.y, 0, sm.x, sm.y, curR);
        sg.addColorStop(0, `rgba(255, 255, 255, ${0.28 * k})`);
        sg.addColorStop(0.6, `rgba(200, 200, 200, ${0.12 * k})`);
        sg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = sg;
        fx.beginPath();
        fx.arc(sm.x, sm.y, curR, 0, Math.PI * 2);
        fx.fill();
      }
      if (this._smoke.length > 40) this._smoke.splice(0, this._smoke.length - 40);
      fx.restore();

      // 4. Subtle 35mm silver halide film grain
      fx.fillStyle = 'rgba(255, 255, 255, 0.04)';
      for (let g = 0; g < 120; g++) {
        fx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
      }

      fx.restore();
    }
  };

export default filmNoir1940Effect;
