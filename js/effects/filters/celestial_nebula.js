/* WebcamClicks — celestial_nebula 2D filter effect */

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

export const celestialNebulaEffect = {
    id: 'celestial_nebula', name: 'Celestial Nebula', icon: '🌌', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      fx.save();
      // Cosmic color grading: deep indigo shadows, vibrant magenta & turquoise
      fx.filter = 'contrast(1.2) saturate(1.35) hue-rotate(-20deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Head-tracked swirling multi-colored nebula gas clouds
      fx.globalCompositeOperation = 'screen';
      const tSec = t * 0.0006;
      const clouds = [
        { x: pose.cx - pose.w * 0.35 + Math.sin(tSec * 0.8) * 20, y: pose.cy - pose.h * 0.2 + Math.cos(tSec * 0.7) * 20, r: Math.max(w, h) * 0.5, c0: 'rgba(147, 51, 234, 0.42)', c1: 'rgba(0,0,0,0)' },
        { x: pose.cx + pose.w * 0.35 + Math.cos(tSec * 0.9) * 20, y: pose.cy - pose.h * 0.15 + Math.sin(tSec * 0.6) * 20, r: Math.max(w, h) * 0.48, c0: 'rgba(6, 182, 212, 0.38)', c1: 'rgba(0,0,0,0)' },
        { x: pose.cx, y: pose.cy + pose.h * 0.4, r: Math.max(w, h) * 0.45, c0: 'rgba(236, 72, 153, 0.3)', c1: 'rgba(0,0,0,0)' }
      ];
      for (const cl of clouds) {
        const g = fx.createRadialGradient(cl.x, cl.y, 10, cl.x, cl.y, cl.r);
        g.addColorStop(0, cl.c0);
        g.addColorStop(1, cl.c1);
        fx.fillStyle = g;
        fx.fillRect(0, 0, w, h);
      }

      // Celestial starlight aura wrapping around head contour
      const aura = fx.createRadialGradient(pose.cx, pose.cy, pose.eyeDist * 0.5, pose.cx, pose.cy, pose.eyeDist * 2.2);
      aura.addColorStop(0, 'rgba(103, 232, 249, 0.32)');
      aura.addColorStop(0.5, 'rgba(168, 85, 247, 0.18)');
      aura.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = aura;
      fx.fillRect(0, 0, w, h);

      // Starfield generator (cached on this._stars)
      if (!this._stars || this._sw !== w || this._sh !== h) {
        this._sw = w;
        this._sh = h;
        this._stars = Array.from({ length: 65 }, () => ({
          x: Math.random() * w,
          y: Math.random() * h,
          r: 1 + Math.random() * 2.5,
          freq: 0.002 + Math.random() * 0.004,
          phase: Math.random() * Math.PI * 2,
          hue: Math.random() < 0.3 ? '#67e8f9' : (Math.random() < 0.6 ? '#f472b6' : '#ffffff')
        }));
        this._meteor = null;
      }

      // Render twinkling stars
      for (const st of this._stars) {
        const tw = (Math.sin(t * st.freq + st.phase) + 1) * 0.5;
        const alpha = 0.3 + tw * 0.7;
        fx.fillStyle = st.hue;
        fx.globalAlpha = alpha;
        fx.beginPath();
        fx.arc(st.x, st.y, st.r * (0.8 + tw * 0.4), 0, Math.PI * 2);
        fx.fill();

        if (st.r > 2.2 && tw > 0.6) {
          const spk = st.r * 3 * tw;
          fx.strokeStyle = st.hue;
          fx.lineWidth = 1;
          fx.beginPath();
          fx.moveTo(st.x - spk, st.y); fx.lineTo(st.x + spk, st.y);
          fx.moveTo(st.x, st.y - spk); fx.lineTo(st.x, st.y + spk);
          fx.stroke();
        }
      }

      // Shooting star / meteor
      if (!this._meteor && Math.random() < 0.015) {
        this._meteor = {
          x: Math.random() * w * 0.8,
          y: Math.random() * h * 0.3,
          vx: Math.max(12, w * 0.03),
          vy: Math.max(6, h * 0.015),
          len: Math.max(60, w * 0.18),
          life: 300,
          age: 0
        };
      }
      if (this._meteor) {
        const m = this._meteor;
        m.age += delta;
        m.x += m.vx;
        m.y += m.vy;
        const k = 1 - m.age / m.life;
        if (k > 0) {
          const mGrad = fx.createLinearGradient(m.x - m.vx * 3, m.y - m.vy * 3, m.x, m.y);
          mGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
          mGrad.addColorStop(0.8, 'rgba(103, 232, 249, 0.7)');
          mGrad.addColorStop(1, 'rgba(255, 255, 255, 1)');
          fx.strokeStyle = mGrad;
          fx.lineWidth = 2.5;
          fx.beginPath();
          fx.moveTo(m.x - (m.vx / Math.hypot(m.vx, m.vy)) * m.len, m.y - (m.vy / Math.hypot(m.vx, m.vy)) * m.len);
          fx.lineTo(m.x, m.y);
          fx.stroke();
        } else {
          this._meteor = null;
        }
      }

      // Celestial halo vignette
      const halo = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.4, w / 2, h / 2, Math.max(w, h) * 0.75);
      halo.addColorStop(0, 'rgba(0, 0, 0, 0)');
      halo.addColorStop(1, 'rgba(15, 6, 35, 0.65)');
      fx.globalCompositeOperation = 'multiply';
      fx.fillStyle = halo;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }
  };

export default celestialNebulaEffect;
