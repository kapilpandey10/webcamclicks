/* WebcamClicks — firebreath face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const firebreathEffect = {
  id: 'firebreath',
  name: 'Fire Breath',
  icon: '🐉',
  category: 'Face',
  perf: 'low',
  requiresFace: true,

  render(fx, frame) {
    passthrough(fx, frame);
    const g = geo(frame);
    const s = smoothGeo(this, g, frame.dt || 16.7, 30);
    if (!g || !s) {
      if (this._p) this._p.length = 0;
      return;
    }

    if (!this._p) this._p = [];
    const dt = clamp(frame.dt || 16.7, 1, 50);
    const t = frame.time || performance.now();

    // 1. Precise mouth aperture calculation
    const pts = g.pts;
    const topInner = pts[62] || pts[51];
    const botInner = pts[66] || pts[57];
    const mouthW = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
    const mouthOpenDist = Math.hypot(topInner.x - botInner.x, topInner.y - botInner.y);
    const openRatio = mouthOpenDist / Math.max(12, s.eyeDist);
    const mouthCenter = {
      x: (topInner.x + botInner.x) / 2,
      y: (topInner.y + botInner.y) / 2
    };

    // Activation threshold: 0.22 = opening, 0.40+ = full inferno blast
    const isErupting = openRatio > 0.22;
    const blastPower = clamp((openRatio - 0.22) / 0.22, 0, 1.4);

    // Direction vector of the fire breath: shoots outward along head angle & yaw
    // Downwards along face axis: angle + 90 deg
    const faceDownAngle = s.a + Math.PI / 2;
    const baseDirX = Math.cos(faceDownAngle) + s.yaw * 0.85;
    const baseDirY = Math.sin(faceDownAngle) + 0.28;
    const dirLen = Math.hypot(baseDirX, baseDirY) || 1;
    const ndx = baseDirX / dirLen;
    const ndy = baseDirY / dirLen;

    // Normal vector perpendicular to stream
    const px = -ndy;
    const py = ndx;

    // 2. Spawn multi-layered flame particles when mouth is open
    if (isErupting) {
      this._hasErupted = true;
      const count = Math.round(5 + blastPower * 7);

      for (let i = 0; i < count; i++) {
        const spread = rand(-0.35, 0.35);
        const speed = rand(0.35, 0.85) * (0.8 + blastPower * 0.6) * (s.eyeDist / 70);
        const vx = (ndx + px * spread) * speed;
        const vy = (ndy + py * spread) * speed;

        this._p.push({
          type: 'flame',
          x: mouthCenter.x + rand(-4, 4),
          y: mouthCenter.y + rand(-3, 3),
          vx,
          vy,
          life: rand(420, 780),
          age: 0,
          size: rand(s.eyeDist * 0.16, s.eyeDist * 0.32),
          spin: rand(-0.04, 0.04),
          angle: rand(0, Math.PI * 2),
          hueShift: rand(-15, 15)
        });
      }

      // Spark embers (bright, fast, zippy particles)
      const sparkCount = Math.round(2 + blastPower * 4);
      for (let i = 0; i < sparkCount; i++) {
        const spread = rand(-0.65, 0.65);
        const speed = rand(0.65, 1.35) * (s.eyeDist / 70);
        this._p.push({
          type: 'spark',
          x: mouthCenter.x + rand(-6, 6),
          y: mouthCenter.y + rand(-4, 4),
          vx: (ndx + px * spread) * speed,
          vy: (ndy + py * spread) * speed,
          life: rand(300, 650),
          age: 0,
          size: rand(2.2, 5.0)
        });
      }

      // Smoke puffs
      if (Math.random() < 0.45) {
        this._p.push({
          type: 'smoke',
          x: mouthCenter.x + rand(-10, 10),
          y: mouthCenter.y + rand(-5, 5),
          vx: (ndx + px * rand(-0.3, 0.3)) * rand(0.15, 0.35) * (s.eyeDist / 70),
          vy: (ndy + py * rand(-0.3, 0.3)) * rand(0.15, 0.35) * (s.eyeDist / 70) - 0.08,
          life: rand(700, 1200),
          age: 0,
          size: rand(s.eyeDist * 0.25, s.eyeDist * 0.45)
        });
      }
    } else {
      // Idle embers hovering in mouth
      if (Math.random() < 0.25) {
        this._p.push({
          type: 'idle_spark',
          x: mouthCenter.x + rand(-6, 6),
          y: mouthCenter.y + rand(-3, 3),
          vx: rand(-0.03, 0.03),
          vy: -rand(0.04, 0.12),
          life: rand(250, 450),
          age: 0,
          size: rand(1.5, 3.5)
        });
      }
    }

    // 3. Dynamic Facial Firelight (Illuminates cheeks, chin, and neck with flickering fire glow)
    if (isErupting) {
      fx.save();
      fx.globalCompositeOperation = 'screen';
      const flicker = 0.85 + Math.sin(t * 0.04) * 0.15;
      const lightRadius = s.eyeDist * (1.6 + blastPower * 0.8);
      const faceGlow = fx.createRadialGradient(
        mouthCenter.x, mouthCenter.y, 4,
        mouthCenter.x, mouthCenter.y, lightRadius
      );
      faceGlow.addColorStop(0, `rgba(255, 230, 140, ${0.75 * blastPower * flicker})`);
      faceGlow.addColorStop(0.35, `rgba(249, 115, 22, ${0.45 * blastPower * flicker})`);
      faceGlow.addColorStop(0.7, `rgba(220, 38, 38, ${0.2 * blastPower * flicker})`);
      faceGlow.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = faceGlow;
      fx.beginPath();
      fx.arc(mouthCenter.x, mouthCenter.y, lightRadius, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }

    // 4. Render Billowing Smoke Puffs (Background pass)
    fx.save();
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'smoke') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 0.04;

      const smokeAlpha = Math.sin(k * Math.PI) * 0.28;
      const sg = fx.createRadialGradient(p.x, p.y, 2, p.x, p.y, p.size);
      sg.addColorStop(0, `rgba(50, 45, 55, ${smokeAlpha})`);
      sg.addColorStop(0.6, `rgba(30, 25, 35, ${smokeAlpha * 0.5})`);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = sg;
      fx.beginPath();
      fx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    // 5. Render Core Flame Plumes & Shockwaves (Additive lighter mode)
    fx.save();
    fx.globalCompositeOperation = 'lighter';

    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'flame') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;

      // Air drag & expansion
      p.vx *= 0.985;
      p.vy *= 0.985;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;

      // Plume expands as it travels forward
      const currentRad = p.size * (1 + (1 - k) * 2.4);

      const fg = fx.createRadialGradient(p.x, p.y, currentRad * 0.05, p.x, p.y, currentRad);
      // Color transition: White core -> Radiant yellow -> Intense fiery orange -> Crimson edge
      fg.addColorStop(0, `rgba(255, 255, 240, ${0.95 * k})`);
      fg.addColorStop(0.25, `rgba(254, 240, 138, ${0.85 * k})`);
      fg.addColorStop(0.55, `rgba(249, 115, 22, ${0.65 * k})`);
      fg.addColorStop(0.85, `rgba(225, 29, 72, ${0.35 * k})`);
      fg.addColorStop(1, 'rgba(153, 27, 27, 0)');

      fx.fillStyle = fg;
      fx.beginPath();
      fx.arc(p.x, p.y, currentRad, 0, Math.PI * 2);
      fx.fill();
    }

    // 6. Render Crackling Spark Embers & Motion Streaks
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'spark' && p.type !== 'idle_spark') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;

      const prevX = p.x;
      const prevY = p.y;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.0008 * dt; // subtle gravity

      // Draw spark streak
      fx.strokeStyle = `rgba(254, 240, 138, ${0.9 * k})`;
      fx.lineWidth = Math.max(1, p.size * k);
      fx.lineCap = 'round';
      fx.beginPath();
      fx.moveTo(prevX, prevY);
      fx.lineTo(p.x, p.y);
      fx.stroke();

      // Spark glow head
      fx.fillStyle = `rgba(255, 255, 255, ${k})`;
      fx.beginPath();
      fx.arc(p.x, p.y, p.size * 0.6 * k, 0, Math.PI * 2);
      fx.fill();
    }

    // 7. Searing Mouth Plasma Core (Erupting nozzle origin)
    if (isErupting) {
      const coreRad = Math.max(8, s.eyeDist * 0.28 * blastPower);
      const mouthGlow = fx.createRadialGradient(
        mouthCenter.x, mouthCenter.y, 1,
        mouthCenter.x, mouthCenter.y, coreRad
      );
      mouthGlow.addColorStop(0, '#ffffff');
      mouthGlow.addColorStop(0.3, 'rgba(253, 224, 71, 0.95)');
      mouthGlow.addColorStop(0.65, 'rgba(249, 115, 22, 0.7)');
      mouthGlow.addColorStop(1, 'rgba(239, 68, 68, 0)');
      fx.fillStyle = mouthGlow;
      fx.beginPath();
      fx.arc(mouthCenter.x, mouthCenter.y, coreRad, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    // Pool limit for performance
    if (this._p.length > 280) {
      this._p.splice(0, this._p.length - 280);
    }

    // 8. Helpful Animated Mouth Cue (Only shows until user opens mouth for the first time)
    if (!this._hasErupted) {
      const cueAlpha = 0.75 + Math.sin(t * 0.005) * 0.25;
      fx.save();
      fx.font = `bold ${Math.max(12, Math.round(s.eyeDist * 0.17))}px Outfit, sans-serif`;
      fx.textAlign = 'center';
      fx.textBaseline = 'middle';
      fx.fillStyle = `rgba(254, 240, 138, ${cueAlpha})`;
      fx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      fx.shadowBlur = 8;
      fx.fillText('🔥 Open your mouth to breathe fire! 🔥', mouthCenter.x, mouthCenter.y + s.eyeDist * 0.55);
      fx.restore();
    }
  }
};

export default firebreathEffect;
