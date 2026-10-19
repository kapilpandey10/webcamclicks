/* WebcamClicks — underwater_aquarium 2D filter effect */

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

export const underwaterAquariumEffect = {
    id: 'underwater_aquarium', name: 'Deep Ocean Abyss', icon: '🌊', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      // Deep oceanic color grading
      fx.save();
      fx.filter = 'contrast(1.18) brightness(0.9) saturate(1.3) hue-rotate(185deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Deep water caustic sunbeams angling towards head
      fx.globalCompositeOperation = 'screen';
      const beamCount = 6;
      for (let b = 0; b < beamCount; b++) {
        const sweep = Math.sin(t * 0.001 + b * 1.1) * (w * 0.15);
        const bxTop = (b / beamCount) * w + sweep;
        const beamGrad = fx.createLinearGradient(bxTop, 0, pose.cx, pose.cy);
        beamGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
        beamGrad.addColorStop(0.6, 'rgba(6, 182, 212, 0.15)');
        beamGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = beamGrad;
        fx.beginPath();
        fx.moveTo(bxTop - 25, 0);
        fx.lineTo(bxTop + 25, 0);
        fx.lineTo(pose.cx + (b - 3) * 35, h);
        fx.lineTo(pose.cx + (b - 3) * 35 - 30, h);
        fx.closePath();
        fx.fill();
      }

      // Rising oxygen bubbles from mouth/chin
      if (!this._bubbles) this._bubbles = [];
      if (Math.random() < 0.35) {
        this._bubbles.push({
          x: pose.cx + (Math.random() - 0.5) * (pose.w * 0.35),
          y: pose.cy + pose.h * 0.38,
          r: rand(3, 8),
          vy: rand(0.08, 0.18),
          wobble: rand(0, 6.28),
          life: rand(2500, 4500),
          age: 0
        });
      }

      // Update & render bubbles
      for (let i = this._bubbles.length - 1; i >= 0; i--) {
        const bub = this._bubbles[i];
        bub.age += delta;
        if (bub.age >= bub.life || bub.y < -10) {
          this._bubbles.splice(i, 1);
          continue;
        }
        bub.y -= bub.vy * delta;
        const curX = bub.x + Math.sin(t * 0.003 + bub.wobble) * 8;

        fx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(curX, bub.y, bub.r, 0, Math.PI * 2);
        fx.stroke();
        fx.fillStyle = 'rgba(56, 189, 248, 0.2)';
        fx.fill();
        // Highlight
        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(curX - bub.r * 0.35, bub.y - bub.r * 0.35, bub.r * 0.3, 0, Math.PI * 2);
        fx.fill();
      }
      if (this._bubbles.length > 50) this._bubbles.splice(0, this._bubbles.length - 50);

      // 3 Undulating Bioluminescent Jellyfish swimming around head
      const jFlies = [
        { hue: '#67e8f9', size: pose.w * 0.28, speed: 0.0008, radX: pose.w * 0.9, radY: pose.h * 0.6, off: 0 },
        { hue: '#e879f9', size: pose.w * 0.22, speed: 0.0011, radX: pose.w * 0.8, radY: pose.h * 0.5, off: 2.1 },
        { hue: '#6ee7b7', size: pose.w * 0.24, speed: 0.0009, radX: pose.w * 0.95, radY: pose.h * 0.55, off: 4.2 }
      ];

      for (let j = 0; j < jFlies.length; j++) {
        const jf = jFlies[j];
        const ja = t * jf.speed + jf.off;
        const jx = pose.cx + Math.cos(ja) * jf.radX;
        const jy = pose.cy + Math.sin(ja) * jf.radY + Math.sin(t * 0.002 + j) * 15;
        const pulse = Math.sin(t * 0.004 + j * 1.5);
        const js = jf.size;

        fx.save();
        fx.translate(jx, jy);
        fx.rotate(-ja * 0.3);

        // Translucent umbrella bell
        fx.beginPath();
        fx.moveTo(-js * 0.5, 0);
        fx.quadraticCurveTo(0, -js * (0.6 + pulse * 0.15), js * 0.5, 0);
        fx.quadraticCurveTo(0, js * 0.15, -js * 0.5, 0);
        fx.fillStyle = jf.hue;
        fx.globalAlpha = 0.45;
        fx.fill();
        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 1;
        fx.stroke();

        // Glowing rim nodes
        fx.globalAlpha = 0.8;
        for (let n = -2; n <= 2; n++) {
          fx.fillStyle = '#ffffff';
          fx.beginPath();
          fx.arc(n * (js * 0.18), 0, 1.5, 0, Math.PI * 2);
          fx.fill();
        }

        // Flowing tentacles
        fx.strokeStyle = jf.hue;
        fx.lineWidth = 1.2;
        fx.globalAlpha = 0.6;
        for (let tent = -2; tent <= 2; tent++) {
          const tx0 = tent * (js * 0.16);
          fx.beginPath();
          fx.moveTo(tx0, 0);
          fx.quadraticCurveTo(
            tx0 + Math.sin(t * 0.005 + tent) * 8, js * 0.5,
            tx0 + Math.sin(t * 0.004 + tent + 1) * 12, js * 1.1
          );
          fx.stroke();
        }
        fx.restore();
      }

      fx.restore();
    }
  };

export default underwaterAquariumEffect;
