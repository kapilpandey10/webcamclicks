/* WebcamClicks — firebreath face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

/* ── Simplex-ish 2D noise for turbulence ──────────────────────────── */
const _P = new Uint8Array(512);
(function initPerm() {
  const p = new Uint8Array(256);
  for (let i = 0; i < 256; i++) p[i] = i;
  for (let i = 255; i > 0; i--) {
    const j = (Math.random() * (i + 1)) | 0;
    const t = p[i]; p[i] = p[j]; p[j] = t;
  }
  for (let i = 0; i < 512; i++) _P[i] = p[i & 255];
})();

function _fade(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
function _grad(h, x, y) {
  const v = (h & 1) === 0 ? x : y;
  return (h & 2) === 0 ? v : -v;
}
function noise2(x, y) {
  const X = Math.floor(x) & 255, Y = Math.floor(y) & 255;
  const xf = x - Math.floor(x), yf = y - Math.floor(y);
  const u = _fade(xf), v = _fade(yf);
  const aa = _P[_P[X] + Y], ab = _P[_P[X] + Y + 1];
  const ba = _P[_P[X + 1] + Y], bb = _P[_P[X + 1] + Y + 1];
  return lerp(
    lerp(_grad(aa, xf, yf), _grad(ba, xf - 1, yf), u),
    lerp(_grad(ab, xf, yf - 1), _grad(bb, xf - 1, yf - 1), u),
    v
  );
}

function fbm(x, y, octaves = 3) {
  let val = 0, amp = 1, freq = 1, max = 0;
  for (let i = 0; i < octaves; i++) {
    val += noise2(x * freq, y * freq) * amp;
    max += amp;
    amp *= 0.5;
    freq *= 2;
  }
  return val / max;
}

/* ── Blackbody-inspired color temperature ramp ────────────────────── */
function fireColor(temp, alpha) {
  // temp 0 = cool smoke/crimson, 1 = white-hot core
  let r, g, b;
  if (temp > 0.85) {
    // White-hot core
    r = 255;
    g = lerp(240, 255, (temp - 0.85) / 0.15);
    b = lerp(200, 250, (temp - 0.85) / 0.15);
  } else if (temp > 0.6) {
    // Bright yellow
    r = 255;
    g = lerp(180, 240, (temp - 0.6) / 0.25);
    b = lerp(60, 200, (temp - 0.6) / 0.25);
  } else if (temp > 0.35) {
    // Orange
    r = lerp(230, 255, (temp - 0.35) / 0.25);
    g = lerp(80, 180, (temp - 0.35) / 0.25);
    b = lerp(10, 60, (temp - 0.35) / 0.25);
  } else if (temp > 0.15) {
    // Red-orange
    r = lerp(180, 230, (temp - 0.15) / 0.2);
    g = lerp(25, 80, (temp - 0.15) / 0.2);
    b = lerp(5, 10, (temp - 0.15) / 0.2);
  } else {
    // Dark crimson / dying ember
    r = lerp(60, 180, temp / 0.15);
    g = lerp(8, 25, temp / 0.15);
    b = lerp(2, 5, temp / 0.15);
  }
  return `rgba(${r | 0},${g | 0},${b | 0},${alpha})`;
}

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
    if (!this._windPhase) this._windPhase = rand(0, 100);
    const dt = clamp(frame.dt || 16.7, 1, 50);
    const t = frame.time || performance.now();
    const tSec = t * 0.001;

    // 1. Precise mouth aperture calculation
    const pts = g.pts;
    const topInner = pts[62] || pts[51];
    const botInner = pts[66] || pts[57];
    const topOuter = pts[51];
    const botOuter = pts[57];
    const mouthW = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
    const mouthOpenDist = Math.hypot(topInner.x - botInner.x, topInner.y - botInner.y);
    const openRatio = mouthOpenDist / Math.max(12, s.eyeDist);
    const mouthCenter = {
      x: (topInner.x + botInner.x) / 2,
      y: (topInner.y + botInner.y) / 2
    };

    // Activation threshold with hysteresis
    const wasErupting = this._isErupting || false;
    const threshold = wasErupting ? 0.17 : 0.22;
    const isErupting = openRatio > threshold;
    this._isErupting = isErupting;

    // Smooth the blast power for more organic ramping
    const rawPower = clamp((openRatio - 0.17) / 0.28, 0, 1.5);
    this._smoothPower = lerp(this._smoothPower || 0, isErupting ? rawPower : 0, 1 - Math.exp(-dt / 80));
    const blastPower = this._smoothPower;

    // Direction vector of the fire breath
    const faceDownAngle = s.a + Math.PI / 2;
    // Add subtle wind turbulence to direction
    const windTurb = fbm(tSec * 0.8, this._windPhase, 2) * 0.12;
    const baseDirX = Math.cos(faceDownAngle + windTurb) + s.yaw * 0.85;
    const baseDirY = Math.sin(faceDownAngle + windTurb) + 0.28;
    const dirLen = Math.hypot(baseDirX, baseDirY) || 1;
    const ndx = baseDirX / dirLen;
    const ndy = baseDirY / dirLen;

    // Normal vector perpendicular to stream
    const px = -ndy;
    const py = ndx;

    const scale = s.eyeDist / 70;

    // 2. Spawn multi-layered flame particles when mouth is open
    if (isErupting) {
      this._hasErupted = true;

      // ── Core flame plumes (large, billowing, organic shapes) ──
      const coreCount = Math.round(4 + blastPower * 8);
      for (let i = 0; i < coreCount; i++) {
        const spread = rand(-0.4, 0.4) * (1 + blastPower * 0.3);
        const speed = rand(0.38, 0.92) * (0.75 + blastPower * 0.65) * scale;
        const turb = fbm(tSec * 2 + i * 0.7, this._windPhase + i, 2);
        const vx = (ndx + px * (spread + turb * 0.08)) * speed;
        const vy = (ndy + py * (spread + turb * 0.08)) * speed;
        // Temperature: particles near center are hotter
        const temp = clamp(1.0 - Math.abs(spread) * 1.5 + rand(-0.1, 0.15), 0.3, 1.0);

        this._p.push({
          type: 'flame',
          x: mouthCenter.x + rand(-3, 3) + px * spread * mouthW * 0.15,
          y: mouthCenter.y + rand(-2, 2) + py * spread * mouthW * 0.15,
          vx,
          vy,
          life: rand(380, 720),
          age: 0,
          size: rand(s.eyeDist * 0.14, s.eyeDist * 0.34),
          spin: rand(-0.035, 0.035),
          angle: rand(0, Math.PI * 2),
          temp,
          turbSeed: rand(0, 100),
          flickerPhase: rand(0, Math.PI * 2),
          drag: rand(0.978, 0.992)
        });
      }

      // ── Secondary wispy flames (smaller, faster, fills gaps) ──
      const wispCount = Math.round(2 + blastPower * 5);
      for (let i = 0; i < wispCount; i++) {
        const spread = rand(-0.55, 0.55);
        const speed = rand(0.55, 1.1) * (0.8 + blastPower * 0.5) * scale;
        this._p.push({
          type: 'wisp',
          x: mouthCenter.x + rand(-5, 5),
          y: mouthCenter.y + rand(-3, 3),
          vx: (ndx + px * spread) * speed,
          vy: (ndy + py * spread) * speed,
          life: rand(200, 450),
          age: 0,
          size: rand(s.eyeDist * 0.06, s.eyeDist * 0.15),
          temp: clamp(0.7 + rand(-0.2, 0.3), 0.5, 1.0),
          turbSeed: rand(0, 100),
          drag: rand(0.96, 0.985)
        });
      }

      // ── Spark embers (bright, fast, zippy particles with trails) ──
      const sparkCount = Math.round(2 + blastPower * 5);
      for (let i = 0; i < sparkCount; i++) {
        const spread = rand(-0.7, 0.7);
        const speed = rand(0.7, 1.5) * scale;
        this._p.push({
          type: 'spark',
          x: mouthCenter.x + rand(-5, 5),
          y: mouthCenter.y + rand(-3, 3),
          vx: (ndx + px * spread) * speed,
          vy: (ndy + py * spread) * speed,
          life: rand(280, 600),
          age: 0,
          size: rand(2.0, 4.8),
          trail: [],
          trailMax: Math.round(rand(4, 8))
        });
      }

      // ── Smoke puffs (volumetric, lazy, drifting) ──
      if (Math.random() < 0.55 + blastPower * 0.2) {
        const smokeSpread = rand(-0.35, 0.35);
        this._p.push({
          type: 'smoke',
          x: mouthCenter.x + rand(-8, 8) + ndx * s.eyeDist * rand(0.8, 2.0),
          y: mouthCenter.y + rand(-5, 5) + ndy * s.eyeDist * rand(0.8, 2.0),
          vx: (ndx + px * smokeSpread) * rand(0.08, 0.22) * scale - 0.02,
          vy: (ndy + py * smokeSpread) * rand(0.08, 0.22) * scale - 0.06,
          life: rand(800, 1500),
          age: 0,
          size: rand(s.eyeDist * 0.3, s.eyeDist * 0.6),
          rotation: rand(0, Math.PI * 2),
          rotSpeed: rand(-0.0015, 0.0015),
          turbSeed: rand(0, 100)
        });
      }

      // ── Heat distortion particles (invisible, warp the area) ──
      if (Math.random() < 0.3) {
        this._p.push({
          type: 'heat',
          x: mouthCenter.x + ndx * rand(15, 60) * scale,
          y: mouthCenter.y + ndy * rand(15, 60) * scale,
          vx: ndx * rand(0.12, 0.3) * scale,
          vy: ndy * rand(0.12, 0.3) * scale,
          life: rand(400, 800),
          age: 0,
          size: rand(s.eyeDist * 0.3, s.eyeDist * 0.55)
        });
      }
    } else {
      // ── Idle: subtle ember glow in the mouth ──
      if (Math.random() < 0.3) {
        this._p.push({
          type: 'idle_spark',
          x: mouthCenter.x + rand(-5, 5),
          y: mouthCenter.y + rand(-2, 2),
          vx: rand(-0.025, 0.025),
          vy: -rand(0.03, 0.1),
          life: rand(280, 500),
          age: 0,
          size: rand(1.5, 3.8),
          flickerPhase: rand(0, Math.PI * 2)
        });
      }
      // Idle inner mouth glow ember
      if (Math.random() < 0.15) {
        this._p.push({
          type: 'idle_glow',
          x: mouthCenter.x + rand(-4, 4),
          y: mouthCenter.y + rand(-2, 2),
          vx: rand(-0.01, 0.01),
          vy: rand(-0.02, 0.01),
          life: rand(400, 700),
          age: 0,
          size: rand(s.eyeDist * 0.08, s.eyeDist * 0.18)
        });
      }
    }

    // ─────────────────────────────────────────────────────────
    // 3. RENDER PASSES
    // ─────────────────────────────────────────────────────────

    // ── PASS A: Volumetric Smoke (background, normal blending) ──
    fx.save();
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'smoke') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;

      // Turbulent drift
      const turb = fbm(p.x * 0.008 + p.turbSeed, p.y * 0.008 + tSec * 0.5, 2);
      p.vx += turb * 0.003 * dt;
      p.vy -= 0.002 * dt; // buoyancy
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.size += dt * 0.06;
      p.rotation += p.rotSpeed * dt;

      // Multi-layer smoke: slightly warm-tinted near source, grey further out
      const warmth = k > 0.6 ? (k - 0.6) / 0.4 : 0;
      const smokeAlpha = Math.sin(k * Math.PI) * 0.22;
      const rr = (40 + warmth * 30) | 0;
      const gg = (35 + warmth * 15) | 0;
      const bb = (45 - warmth * 10) | 0;

      fx.save();
      fx.translate(p.x, p.y);
      fx.rotate(p.rotation);
      fx.globalAlpha = smokeAlpha;

      const sg = fx.createRadialGradient(0, 0, p.size * 0.1, 0, 0, p.size);
      sg.addColorStop(0, `rgb(${rr},${gg},${bb})`);
      sg.addColorStop(0.5, `rgba(${rr - 10},${gg - 10},${bb}, 0.6)`);
      sg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = sg;
      fx.beginPath();
      // Irregular smoke blob using ellipse + slight distortion
      fx.ellipse(0, 0, p.size, p.size * (0.7 + turb * 0.3), turb * 0.5, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }
    fx.restore();

    // ── PASS B: Dynamic Face Illumination ──
    if (isErupting || blastPower > 0.02) {
      fx.save();
      fx.globalCompositeOperation = 'screen';

      // Primary fire glow on face
      const flicker = 0.8 + fbm(tSec * 3, this._windPhase, 2) * 0.2;
      const lightRadius = s.eyeDist * (1.5 + blastPower * 1.0);
      const power = clamp(blastPower, 0, 1);

      const faceGlow = fx.createRadialGradient(
        mouthCenter.x, mouthCenter.y, 2,
        mouthCenter.x + ndx * lightRadius * 0.15, mouthCenter.y + ndy * lightRadius * 0.15, lightRadius
      );
      faceGlow.addColorStop(0, `rgba(255, 235, 160, ${0.7 * power * flicker})`);
      faceGlow.addColorStop(0.25, `rgba(255, 180, 60, ${0.5 * power * flicker})`);
      faceGlow.addColorStop(0.5, `rgba(240, 100, 30, ${0.3 * power * flicker})`);
      faceGlow.addColorStop(0.8, `rgba(200, 40, 20, ${0.12 * power * flicker})`);
      faceGlow.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = faceGlow;
      fx.beginPath();
      fx.arc(mouthCenter.x, mouthCenter.y, lightRadius, 0, Math.PI * 2);
      fx.fill();

      // Secondary rim light (catches chin and jawline)
      const rimGlow = fx.createRadialGradient(
        mouthCenter.x + ndx * s.eyeDist * 0.3,
        mouthCenter.y + ndy * s.eyeDist * 0.3,
        1,
        mouthCenter.x + ndx * s.eyeDist * 0.3,
        mouthCenter.y + ndy * s.eyeDist * 0.3,
        s.eyeDist * 0.9
      );
      rimGlow.addColorStop(0, `rgba(255, 200, 80, ${0.35 * power * flicker})`);
      rimGlow.addColorStop(0.6, `rgba(255, 120, 30, ${0.15 * power * flicker})`);
      rimGlow.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = rimGlow;
      fx.beginPath();
      fx.arc(
        mouthCenter.x + ndx * s.eyeDist * 0.3,
        mouthCenter.y + ndy * s.eyeDist * 0.3,
        s.eyeDist * 0.9, 0, Math.PI * 2
      );
      fx.fill();

      fx.restore();
    }

    // ── PASS C: Core Flame Plumes (additive blending) ──
    fx.save();
    fx.globalCompositeOperation = 'lighter';

    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'flame') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      const ageRatio = p.age / p.life;

      // Turbulent displacement (fire never moves in straight lines)
      const turbX = fbm(p.turbSeed + tSec * 1.5, p.y * 0.01, 3) * 0.15;
      const turbY = fbm(p.x * 0.01, p.turbSeed + tSec * 1.5, 3) * 0.15;

      // Variable drag
      p.vx = p.vx * p.drag + turbX * dt * 0.05;
      p.vy = p.vy * p.drag + turbY * dt * 0.05;
      // Buoyancy increases as flame ages (hot air rises)
      p.vy -= 0.0012 * dt * ageRatio;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.angle += p.spin * dt;

      // Flame cools as it ages
      const currentTemp = p.temp * k;
      // Flicker: rapid brightness variation
      const flicker = 0.85 + Math.sin(tSec * 18 + p.flickerPhase) * 0.08
                     + fbm(tSec * 6 + p.turbSeed, p.flickerPhase, 2) * 0.07;

      // Size: expands, then shrinks at the end
      const sizeEnvelope = k > 0.3 ? (1 + ageRatio * 2.2) : (k / 0.3) * (1 + ageRatio * 2.2);
      const currentRad = p.size * sizeEnvelope;

      // Draw flame with teardrop-ish shape
      fx.save();
      fx.translate(p.x, p.y);
      fx.rotate(p.angle);

      const fg = fx.createRadialGradient(0, 0, currentRad * 0.03, 0, 0, currentRad);
      // Multi-stop blackbody gradient
      const a = k * flicker;
      fg.addColorStop(0, fireColor(clamp(currentTemp + 0.15, 0, 1), 0.95 * a));
      fg.addColorStop(0.15, fireColor(currentTemp, 0.85 * a));
      fg.addColorStop(0.4, fireColor(currentTemp * 0.75, 0.6 * a));
      fg.addColorStop(0.7, fireColor(currentTemp * 0.45, 0.3 * a));
      fg.addColorStop(0.9, fireColor(currentTemp * 0.2, 0.1 * a));
      fg.addColorStop(1, 'rgba(80,10,0,0)');

      fx.fillStyle = fg;
      fx.beginPath();
      // Slightly organic shape via ellipse with turbulence-driven aspect ratio
      const aspect = 0.65 + Math.abs(turbX) * 2;
      fx.ellipse(0, 0, currentRad * aspect, currentRad, turbX * 2, 0, Math.PI * 2);
      fx.fill();

      fx.restore();
    }

    // ── PASS D: Wispy secondary flames ──
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'wisp') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;

      const turb = fbm(p.turbSeed + tSec * 2, p.y * 0.015, 2);
      p.vx *= p.drag;
      p.vy *= p.drag;
      p.vx += turb * 0.08 * dt * 0.03;
      p.vy -= 0.001 * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const currentTemp = p.temp * k;
      const rad = p.size * (1 + (1 - k) * 1.8);
      const a = k * k; // Quadratic fade for wisps

      const wg = fx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
      wg.addColorStop(0, fireColor(clamp(currentTemp + 0.1, 0, 1), 0.8 * a));
      wg.addColorStop(0.4, fireColor(currentTemp * 0.7, 0.5 * a));
      wg.addColorStop(1, 'rgba(100,20,0,0)');
      fx.fillStyle = wg;
      fx.beginPath();
      fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
      fx.fill();
    }

    // ── PASS E: Spark Embers with motion trails ──
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'spark' && p.type !== 'idle_spark') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;

      const prevX = p.x;
      const prevY = p.y;

      // Sparks get turbulent displacement
      if (p.type === 'spark') {
        const turb = fbm(p.x * 0.02 + tSec, p.y * 0.02, 2);
        p.vx += turb * 0.02 * dt * 0.05;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 0.001 * dt; // gravity

      // Update trail history
      if (p.trail) {
        p.trail.push({ x: p.x, y: p.y, k });
        if (p.trail.length > p.trailMax) p.trail.shift();
      }

      // Draw spark trail (fading tail)
      if (p.trail && p.trail.length > 1) {
        for (let j = 1; j < p.trail.length; j++) {
          const segK = (j / p.trail.length) * k;
          const prev = p.trail[j - 1];
          const cur = p.trail[j];
          fx.strokeStyle = fireColor(0.7 + segK * 0.3, 0.6 * segK);
          fx.lineWidth = Math.max(0.5, p.size * segK * 0.6);
          fx.lineCap = 'round';
          fx.beginPath();
          fx.moveTo(prev.x, prev.y);
          fx.lineTo(cur.x, cur.y);
          fx.stroke();
        }
      }

      // Draw spark streak
      const streakColor = p.type === 'idle_spark'
        ? fireColor(0.65 + Math.sin(tSec * 12 + (p.flickerPhase || 0)) * 0.15, 0.85 * k)
        : fireColor(0.8, 0.9 * k);
      fx.strokeStyle = streakColor;
      fx.lineWidth = Math.max(0.8, p.size * k);
      fx.lineCap = 'round';
      fx.beginPath();
      fx.moveTo(prevX, prevY);
      fx.lineTo(p.x, p.y);
      fx.stroke();

      // Spark glow head
      const headRad = p.size * 0.7 * k;
      const hg = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, headRad * 2.5);
      hg.addColorStop(0, `rgba(255, 255, 240, ${k})`);
      hg.addColorStop(0.4, `rgba(255, 220, 100, ${0.5 * k})`);
      hg.addColorStop(1, 'rgba(255,100,20,0)');
      fx.fillStyle = hg;
      fx.beginPath();
      fx.arc(p.x, p.y, headRad * 2.5, 0, Math.PI * 2);
      fx.fill();
    }

    // ── PASS F: Idle mouth glow embers ──
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'idle_glow') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;

      const a = Math.sin(k * Math.PI) * 0.5;
      const ig = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      ig.addColorStop(0, `rgba(255, 160, 40, ${a})`);
      ig.addColorStop(0.5, `rgba(200, 60, 10, ${a * 0.4})`);
      ig.addColorStop(1, 'rgba(100,20,0,0)');
      fx.fillStyle = ig;
      fx.beginPath();
      fx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      fx.fill();
    }

    // ── PASS G: Inner Mouth Inferno Core ──
    if (isErupting || blastPower > 0.05) {
      const power = clamp(blastPower, 0, 1);
      const flicker = 0.88 + fbm(tSec * 5, this._windPhase + 50, 2) * 0.12;

      // Searing plasma nozzle
      const coreRad = Math.max(6, s.eyeDist * 0.3 * power);
      const mouthGlow = fx.createRadialGradient(
        mouthCenter.x, mouthCenter.y, 0,
        mouthCenter.x, mouthCenter.y, coreRad
      );
      mouthGlow.addColorStop(0, `rgba(255, 255, 255, ${0.95 * flicker * power})`);
      mouthGlow.addColorStop(0.15, `rgba(255, 250, 230, ${0.9 * flicker * power})`);
      mouthGlow.addColorStop(0.35, `rgba(255, 220, 80, ${0.75 * flicker * power})`);
      mouthGlow.addColorStop(0.6, `rgba(250, 130, 30, ${0.5 * flicker * power})`);
      mouthGlow.addColorStop(0.85, `rgba(220, 50, 20, ${0.2 * flicker * power})`);
      mouthGlow.addColorStop(1, 'rgba(150, 20, 10, 0)');
      fx.fillStyle = mouthGlow;
      fx.beginPath();
      fx.arc(mouthCenter.x, mouthCenter.y, coreRad, 0, Math.PI * 2);
      fx.fill();

      // Directional blast cone glow (extends from mouth in fire direction)
      const coneLen = s.eyeDist * (0.5 + power * 0.8);
      const coneGlow = fx.createRadialGradient(
        mouthCenter.x + ndx * coneLen * 0.3,
        mouthCenter.y + ndy * coneLen * 0.3,
        2,
        mouthCenter.x + ndx * coneLen * 0.3,
        mouthCenter.y + ndy * coneLen * 0.3,
        coneLen * 0.6
      );
      coneGlow.addColorStop(0, `rgba(255, 200, 60, ${0.4 * power * flicker})`);
      coneGlow.addColorStop(0.5, `rgba(255, 120, 20, ${0.2 * power * flicker})`);
      coneGlow.addColorStop(1, 'rgba(200,40,10,0)');
      fx.fillStyle = coneGlow;
      fx.beginPath();
      fx.arc(
        mouthCenter.x + ndx * coneLen * 0.3,
        mouthCenter.y + ndy * coneLen * 0.3,
        coneLen * 0.6, 0, Math.PI * 2
      );
      fx.fill();
    } else if (!this._hasErupted) {
      // Idle mouth inner warmth (hint that fire is ready)
      const idleFlicker = 0.5 + Math.sin(tSec * 3) * 0.15 + fbm(tSec * 2, this._windPhase, 2) * 0.1;
      const idleRad = s.eyeDist * 0.18;
      const ig = fx.createRadialGradient(
        mouthCenter.x, mouthCenter.y, 0,
        mouthCenter.x, mouthCenter.y, idleRad
      );
      ig.addColorStop(0, `rgba(255, 140, 40, ${0.4 * idleFlicker})`);
      ig.addColorStop(0.5, `rgba(200, 50, 10, ${0.2 * idleFlicker})`);
      ig.addColorStop(1, 'rgba(100,20,5,0)');
      fx.fillStyle = ig;
      fx.beginPath();
      fx.arc(mouthCenter.x, mouthCenter.y, idleRad, 0, Math.PI * 2);
      fx.fill();
    }

    // ── PASS H: Heat distortion shimmer (subtle screen-blend) ──
    fx.save();
    fx.globalCompositeOperation = 'overlay';
    for (let i = this._p.length - 1; i >= 0; i--) {
      const p = this._p[i];
      if (p.type !== 'heat') continue;
      p.age += dt;
      if (p.age >= p.life) { this._p.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy -= 0.001 * dt;
      p.size += dt * 0.03;

      const shimmer = Math.sin(tSec * 20 + p.x * 0.1) * 0.5 + 0.5;
      const heatAlpha = Math.sin(k * Math.PI) * 0.08 * shimmer;

      const hg = fx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
      hg.addColorStop(0, `rgba(255, 240, 200, ${heatAlpha})`);
      hg.addColorStop(0.5, `rgba(255, 200, 150, ${heatAlpha * 0.5})`);
      hg.addColorStop(1, 'rgba(255,180,100,0)');
      fx.fillStyle = hg;
      fx.beginPath();
      fx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      fx.fill();
    }
    fx.restore();

    fx.restore(); // Close the 'lighter' compositing scope

    // Pool limit for performance
    if (this._p.length > 350) {
      this._p.splice(0, this._p.length - 350);
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
