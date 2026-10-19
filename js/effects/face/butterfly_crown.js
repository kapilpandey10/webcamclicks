/* WebcamClicks — butterfly_crown face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const butterflyCrownEffect = {
  id: 'butterfly_crown',
  name: 'Celestial Butterfly Tiara',
  icon: '🦋',
  category: 'Face',
  perf: 'low',
  requiresFace: true,

  render(fx, frame) {
    passthrough(fx, frame);
    const g = geo(frame);
    const s = smoothGeo(this, g, frame.dt || 16.7, 35);
    const t = frame.time || performance.now();
    if (!s) return;

    const ed = s.eyeDist;
    const hw = ed * 1.25;
    const hh = ed * 0.32;
    const dt = clamp(frame.dt || 16.7, 1, 50);

    if (!this._sparks) this._sparks = [];

    // 1. Ethereal Fairy Skin Glow (Soft radiant highlight on forehead and cheekbones)
    fx.save();
    fx.globalCompositeOperation = 'screen';
    const skinGlow = fx.createRadialGradient(s.x, s.y - ed * 0.45, 10, s.x, s.y - ed * 0.45, ed * 1.1);
    skinGlow.addColorStop(0, 'rgba(254, 240, 138, 0.28)');
    skinGlow.addColorStop(0.5, 'rgba(244, 114, 182, 0.12)');
    skinGlow.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = skinGlow;
    fx.beginPath();
    fx.arc(s.x, s.y - ed * 0.45, ed * 1.1, 0, Math.PI * 2);
    fx.fill();
    fx.restore();

    fx.save();
    fx.translate(s.x, s.y - ed * 0.72);
    fx.rotate(s.a * 0.7);
    fx.translate(s.yaw * s.headW * 0.08, 0);

    // 2. Intricate Elven Filigree Golden Vine Crown
    // A. Intertwined organic golden vine strands
    fx.save();
    [-1, 1].forEach((dir) => {
      // Main Arching Vine
      fx.beginPath();
      fx.moveTo(0, -hh * 0.4);
      fx.bezierCurveTo(dir * hw * 0.35, -hh * 0.8, dir * hw * 0.7, -hh * 0.2, dir * hw, hh * 0.55);

      const vineGrad = fx.createLinearGradient(0, -hh, dir * hw, hh);
      vineGrad.addColorStop(0, '#fef08a'); // luminous gold
      vineGrad.addColorStop(0.4, '#eab308');
      vineGrad.addColorStop(0.8, '#ca8a04');
      vineGrad.addColorStop(1, '#713f12');
      fx.strokeStyle = vineGrad;
      fx.lineWidth = Math.max(2, ed * 0.042);
      fx.shadowColor = 'rgba(250, 204, 21, 0.75)';
      fx.shadowBlur = 10;
      fx.stroke();
      fx.shadowBlur = 0;

      // Secondary interlaced delicate filigree tendril
      fx.beginPath();
      fx.moveTo(0, -hh * 0.2);
      fx.bezierCurveTo(dir * hw * 0.25, -hh * 0.1, dir * hw * 0.55, -hh * 0.7, dir * hw * 0.9, hh * 0.3);
      fx.strokeStyle = 'rgba(254, 240, 138, 0.75)';
      fx.lineWidth = Math.max(1.2, ed * 0.022);
      fx.stroke();

      // Golden Filigree Leaves sprouting along the vine
      const leafCount = 4;
      for (let l = 1; l <= leafCount; l++) {
        const u = l / (leafCount + 1);
        const lx = dir * hw * u;
        const ly = -hh * 0.5 + Math.sin(u * Math.PI) * hh * 0.4;
        const leafAngle = dir * (0.3 + u * 0.6);

        fx.save();
        fx.translate(lx, ly);
        fx.rotate(leafAngle);
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.quadraticCurveTo(dir * 6, -10, 0, -18);
        fx.quadraticCurveTo(-dir * 6, -10, 0, 0);
        fx.fillStyle = '#fde047';
        fx.shadowColor = '#eab308';
        fx.shadowBlur = 6;
        fx.fill();
        fx.strokeStyle = '#ca8a04';
        fx.lineWidth = 1;
        fx.stroke();
        fx.restore();
      }
    });

    // B. Central Majestic Crystal Gem Setting
    const centerPulse = 0.85 + Math.sin(t * 0.007) * 0.15;
    fx.save();
    fx.translate(0, -hh * 0.35);

    // Glowing gem halo
    const gemGlow = fx.createRadialGradient(0, 0, 1, 0, 0, ed * 0.18);
    gemGlow.addColorStop(0, `rgba(255, 255, 255, ${centerPulse})`);
    gemGlow.addColorStop(0.35, `rgba(103, 232, 249, ${0.8 * centerPulse})`);
    gemGlow.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = gemGlow;
    fx.beginPath();
    fx.arc(0, 0, ed * 0.18, 0, Math.PI * 2);
    fx.fill();

    // Teardrop Crystal Gem
    fx.beginPath();
    fx.moveTo(0, -ed * 0.16);
    fx.quadraticCurveTo(ed * 0.09, -ed * 0.05, ed * 0.07, ed * 0.08);
    fx.quadraticCurveTo(0, ed * 0.15, -ed * 0.07, ed * 0.08);
    fx.quadraticCurveTo(-ed * 0.09, -ed * 0.05, 0, -ed * 0.16);
    fx.closePath();
    const gemGrad = fx.createLinearGradient(-ed * 0.07, -ed * 0.16, ed * 0.07, ed * 0.15);
    gemGrad.addColorStop(0, '#ffffff');
    gemGrad.addColorStop(0.3, '#a5f3fc');
    gemGrad.addColorStop(0.7, '#06b6d4');
    gemGrad.addColorStop(1, '#0e7490');
    fx.fillStyle = gemGrad;
    fx.fill();
    fx.strokeStyle = '#ffffff';
    fx.lineWidth = 1.2;
    fx.stroke();

    // 4-Point Star Glint on Gem
    const glintSize = ed * 0.14 * centerPulse;
    fx.strokeStyle = '#ffffff';
    fx.lineWidth = 1.6;
    fx.beginPath();
    fx.moveTo(-glintSize, 0); fx.lineTo(glintSize, 0);
    fx.moveTo(0, -glintSize); fx.lineTo(0, glintSize);
    fx.stroke();
    fx.restore();
    fx.restore();

    // 3. Five Ethereal 3D Animated Butterflies
    const butterflies = [
      {
        name: 'Morpho Blue',
        c0: '#ffffff', c1: '#38bdf8', c2: '#0284c7', c3: '#0f172a',
        size: ed * 0.44,
        speed: 0.0016,
        flapSpeed: 0.018,
        pathA: 1.45, pathB: 0.75,
        offset: 0,
        heightOffset: -ed * 0.35
      },
      {
        name: 'Sunset Monarch',
        c0: '#ffffff', c1: '#fbbf24', c2: '#f97316', c3: '#7c2d12',
        size: ed * 0.38,
        speed: 0.0019,
        flapSpeed: 0.022,
        pathA: 1.25, pathB: 0.95,
        offset: 1.26,
        heightOffset: -ed * 0.58
      },
      {
        name: 'Amethyst Fairy',
        c0: '#ffffff', c1: '#e879f9', c2: '#a855f7', c3: '#581c87',
        size: ed * 0.36,
        speed: 0.0014,
        flapSpeed: 0.019,
        pathA: 1.55, pathB: 0.65,
        offset: 2.51,
        heightOffset: -ed * 0.25
      },
      {
        name: 'Emerald Nymph',
        c0: '#ffffff', c1: '#6ee7b7', c2: '#10b981', c3: '#064e3b',
        size: ed * 0.35,
        speed: 0.0021,
        flapSpeed: 0.024,
        pathA: 1.15, pathB: 0.85,
        offset: 3.77,
        heightOffset: -ed * 0.50
      },
      {
        name: 'Golden Sunburst',
        c0: '#ffffff', c1: '#fef08a', c2: '#eab308', c3: '#854d0e',
        size: ed * 0.33,
        speed: 0.0017,
        flapSpeed: 0.020,
        pathA: 1.35, pathB: 1.05,
        offset: 5.02,
        heightOffset: -ed * 0.42
      }
    ];

    butterflies.forEach((b, idx) => {
      // Graceful 3D Lemniscate / Figure-8 Orbital Flight Path
      const ang = t * b.speed + b.offset;
      const bx = Math.sin(ang) * (hw * b.pathA);
      const by = Math.sin(ang * 2) * (hh * b.pathB) + b.heightOffset + Math.sin(t * 0.003 + idx) * 10;

      // Realistic non-linear wing flapping: fast upstroke, gliding downstroke
      const flapPhase = t * b.flapSpeed + idx * 1.4;
      const flap = Math.sin(flapPhase);
      const wingScale = 0.2 + 0.8 * Math.abs(flap);

      // Flight banking / tilt
      const flightTilt = Math.cos(ang) * 0.35;

      fx.save();
      fx.translate(bx, by);
      fx.rotate(flightTilt);

      const bs = b.size;

      // Render Left & Right Wings with 3D Perspective Foreshortening
      [-1, 1].forEach((side) => {
        fx.save();
        fx.scale(side * wingScale, 1);

        // A. Forewing (Upper Wing) with Stained-Glass Contours
        fx.beginPath();
        fx.moveTo(0, -bs * 0.1);
        fx.bezierCurveTo(bs * 0.35, -bs * 1.05, bs * 0.95, -bs * 0.85, bs * 0.85, -bs * 0.2);
        fx.bezierCurveTo(bs * 0.75, bs * 0.05, bs * 0.25, -bs * 0.05, 0, 0);
        fx.closePath();

        const wg = fx.createRadialGradient(bs * 0.2, -bs * 0.4, 2, bs * 0.4, -bs * 0.4, bs * 0.9);
        wg.addColorStop(0, b.c0); // iridescent white highlight
        wg.addColorStop(0.3, b.c1);
        wg.addColorStop(0.7, b.c2);
        wg.addColorStop(1, b.c3);
        fx.fillStyle = wg;
        fx.fill();

        // White pearl wing margin spots
        fx.fillStyle = '#ffffff';
        [0.85, 0.7, 0.55].forEach((up, sidx) => {
          fx.beginPath();
          fx.arc(bs * up, -bs * (0.3 + sidx * 0.2), Math.max(1, bs * 0.04), 0, Math.PI * 2);
          fx.fill();
        });

        // Delicate golden wing vein
        fx.strokeStyle = 'rgba(255, 255, 255, 0.65)';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(0, -bs * 0.05);
        fx.quadraticCurveTo(bs * 0.4, -bs * 0.4, bs * 0.75, -bs * 0.55);
        fx.stroke();

        // B. Hindwing (Lower Wing) with Scalloped Edge
        fx.beginPath();
        fx.moveTo(0, 0);
        fx.bezierCurveTo(bs * 0.35, bs * 0.15, bs * 0.75, bs * 0.45, bs * 0.55, bs * 0.85);
        fx.bezierCurveTo(bs * 0.35, bs * 0.95, bs * 0.1, bs * 0.5, 0, 0);
        fx.closePath();

        const hg = fx.createLinearGradient(0, 0, bs * 0.6, bs * 0.8);
        hg.addColorStop(0, b.c1);
        hg.addColorStop(0.65, b.c2);
        hg.addColorStop(1, b.c3);
        fx.fillStyle = hg;
        fx.fill();
        fx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        fx.lineWidth = 0.8;
        fx.stroke();

        fx.restore();
      });

      // Butterfly Velvet Body & Antennae
      fx.fillStyle = '#090d16';
      fx.beginPath();
      fx.ellipse(0, 0, Math.max(1.5, bs * 0.07), bs * 0.32, 0, 0, Math.PI * 2);
      fx.fill();

      // Antennae with glowing pearl tips
      [-1, 1].forEach((dir) => {
        fx.strokeStyle = '#fef08a';
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(dir * 1, -bs * 0.25);
        fx.quadraticCurveTo(dir * bs * 0.25, -bs * 0.55, dir * bs * 0.35, -bs * 0.65);
        fx.stroke();

        // Tip pearl
        fx.fillStyle = '#ffffff';
        fx.beginPath();
        fx.arc(dir * bs * 0.35, -bs * 0.65, 1.8, 0, Math.PI * 2);
        fx.fill();
      });

      // Spawn falling luminous fairy dust trails
      if (Math.random() < 0.45) {
        this._sparks.push({
          x: s.x + bx + rand(-6, 6),
          y: s.y - ed * 0.72 + by + bs * 0.4,
          vx: (Math.random() - 0.5) * 0.04,
          vy: rand(0.04, 0.12), // gently drifts down
          life: rand(450, 850),
          age: 0,
          color: b.c1,
          size: rand(1.8, 3.8)
        });
      }

      fx.restore();
    });

    fx.restore();

    // 4. Render Falling Shimmering Fairy Dust Trails & Twinkle Stars
    fx.save();
    fx.globalCompositeOperation = 'screen';
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const p = this._sparks[i];
      p.age += dt;
      if (p.age >= p.life) { this._sparks.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const alpha = Math.sin(k * Math.PI) * 0.95;
      const rad = p.size * (0.8 + 0.4 * Math.sin(t * 0.01 + i));

      // Twinkle 4-point star on prominent dust particles
      if (i % 3 === 0) {
        fx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
        fx.lineWidth = 1;
        fx.beginPath();
        fx.moveTo(p.x - rad * 1.8, p.y); fx.lineTo(p.x + rad * 1.8, p.y);
        fx.moveTo(p.x, p.y - rad * 1.8); fx.lineTo(p.x, p.y + rad * 1.8);
        fx.stroke();
      }

      const dg = fx.createRadialGradient(p.x, p.y, 0.5, p.x, p.y, rad);
      dg.addColorStop(0, '#ffffff');
      dg.addColorStop(0.4, p.color);
      dg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = dg;
      fx.beginPath();
      fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    if (this._sparks.length > 90) {
      this._sparks.splice(0, this._sparks.length - 90);
    }
  }
};

export default butterflyCrownEffect;
