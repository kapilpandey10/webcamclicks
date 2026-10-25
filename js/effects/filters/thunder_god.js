/* WebcamClicks — thunder_god 2D filter effect
   Atmospheric storm background with branching lightning bolts, rolling thunder
   sound synthesis, storm clouds, rain, and dramatic flashes. */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch
} from './filter-helpers.js';
import { Sound } from '../../sound.js';

/* ══════════════════════════════════════════════════════════════════════
   SYNTHESISED THUNDER & LIGHTNING SOUND ENGINE
   Uses WebAudio oscillators + noise to produce realistic thunder rumbles,
   lightning crack snaps, and ambient electrical hum — zero audio files.
   ══════════════════════════════════════════════════════════════════════ */
const ThunderSFX = {
  _lastCrack: 0,
  _lastRumble: 0,
  _humNode: null,
  _humGain: null,

  /** Sharp high-freq lightning crack/snap */
  crack(intensity = 1) {
    const now = performance.now();
    if (now - this._lastCrack < 250) return;
    this._lastCrack = now;
    if (!Sound.ensure()) return;
    const ac = Sound.ac;
    try {
      const t0 = ac.currentTime;
      const dur = 0.06 + intensity * 0.04;
      const vol = 0.12 * intensity;

      // White noise burst
      const bufLen = Math.round(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / bufLen, 3);
      }
      const noise = ac.createBufferSource();
      noise.buffer = buf;

      const bp = ac.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2200 + rand(0, 1800);
      bp.Q.value = 0.8;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      noise.connect(bp).connect(gain).connect(ac.destination);
      noise.start(t0);
      noise.stop(t0 + dur + 0.01);

      Sound.tone(1800 + rand(0, 600), 0.025, 'square', 0.06 * intensity);
      Sound.tone(3200 + rand(0, 400), 0.015, 'sine', 0.04 * intensity, 0.005);
    } catch { /* ignore */ }
  },

  /** Deep rolling thunder rumble */
  rumble(intensity = 1) {
    const now = performance.now();
    if (now - this._lastRumble < 600) return;
    this._lastRumble = now;
    if (!Sound.ensure()) return;
    const ac = Sound.ac;
    try {
      const t0 = ac.currentTime;
      const dur = 0.5 + intensity * 0.6;
      const vol = 0.09 * intensity;

      const bufLen = Math.round(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, bufLen, ac.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < bufLen; i++) {
        const env = Math.sin((i / bufLen) * Math.PI) * (1 - (i / bufLen) * 0.3);
        data[i] = (Math.random() * 2 - 1) * env;
      }
      const noise = ac.createBufferSource();
      noise.buffer = buf;

      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 120 + rand(0, 80);
      lp.Q.value = 1.2;

      const gain = ac.createGain();
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.setValueAtTime(vol * 0.8, t0 + dur * 0.3);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      noise.connect(lp).connect(gain).connect(ac.destination);
      noise.start(t0);
      noise.stop(t0 + dur + 0.05);

      Sound.tone(40 + rand(0, 20), dur * 0.7, 'sine', 0.06 * intensity, 0.05);
      Sound.tone(65 + rand(0, 15), dur * 0.5, 'triangle', 0.04 * intensity, 0.12);
    } catch { /* ignore */ }
  },

  /** Constant ambient electrical hum */
  startHum() {
    if (this._humNode) return;
    if (!Sound.ensure()) return;
    const ac = Sound.ac;
    try {
      this._humGain = ac.createGain();
      this._humGain.gain.value = 0;
      this._humGain.connect(ac.destination);

      this._humNode = ac.createOscillator();
      this._humNode.type = 'sawtooth';
      this._humNode.frequency.value = 60;

      const lp = ac.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 200;
      lp.Q.value = 2;

      this._humNode.connect(lp).connect(this._humGain);
      this._humNode.start();
      this._humGain.gain.linearRampToValueAtTime(0.018, ac.currentTime + 0.5);
    } catch { /* ignore */ }
  },

  stopHum() {
    try {
      if (this._humGain) {
        this._humGain.gain.linearRampToValueAtTime(0, Sound.ac.currentTime + 0.3);
      }
      setTimeout(() => {
        try { this._humNode?.stop(); } catch { /* ignore */ }
        this._humNode = null;
        this._humGain = null;
      }, 400);
    } catch { /* ignore */ }
  }
};

/* ══════════════════════════════════════════════════════════════════════
   PROCEDURAL BRANCHING LIGHTNING
   ══════════════════════════════════════════════════════════════════════ */
function drawBranchingBolt(fx, x0, y0, x1, y1, opts = {}) {
  const {
    depth = 0,
    maxDepth = 3,
    segments = 8,
    jitter = 0.35,
    branchChance = 0.32,
    branchScale = 0.55,
    thickness = 2.5,
    glowColor = 'rgba(140, 200, 255, 0.6)',
    coreColor = '#ffffff',
    seed = 0,
    t = 0
  } = opts;

  const dx = x1 - x0, dy = y1 - y0;
  const len = Math.hypot(dx, dy);
  if (len < 3 || depth > maxDepth) return;

  const nx = -dy / len, ny = dx / len;

  const pts = [{ x: x0, y: y0 }];
  for (let i = 1; i < segments; i++) {
    const frac = i / segments;
    const bx = x0 + dx * frac;
    const by = y0 + dy * frac;
    const edgeFade = Math.sin(frac * Math.PI);
    const j = (Math.sin(seed * 7.3 + i * 13.7 + t * 0.02) * 0.5
             + Math.cos(seed * 3.1 + i * 9.1 + t * 0.015) * 0.3
             + (Math.random() - 0.5) * 0.4) * len * jitter * edgeFade;
    pts.push({ x: bx + nx * j, y: by + ny * j });
  }
  pts.push({ x: x1, y: y1 });

  // Glow pass
  const w = thickness * Math.pow(0.6, depth);
  fx.save();
  fx.strokeStyle = glowColor;
  fx.lineWidth = w * 4;
  fx.lineCap = 'round';
  fx.lineJoin = 'round';
  fx.shadowColor = glowColor;
  fx.shadowBlur = 18 - depth * 4;
  fx.beginPath();
  fx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) fx.lineTo(pts[i].x, pts[i].y);
  fx.stroke();
  fx.restore();

  // Core pass
  fx.save();
  fx.strokeStyle = coreColor;
  fx.lineWidth = w;
  fx.lineCap = 'round';
  fx.lineJoin = 'round';
  fx.globalAlpha = clamp(1 - depth * 0.2, 0.3, 1);
  fx.beginPath();
  fx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) fx.lineTo(pts[i].x, pts[i].y);
  fx.stroke();
  fx.restore();

  // Spawn branches
  if (depth < maxDepth) {
    for (let i = 2; i < pts.length - 1; i++) {
      if (Math.random() < branchChance * (1 - depth * 0.25)) {
        const p = pts[i];
        const branchAngle = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6;
        const branchLen = len * branchScale * rand(0.3, 0.7);
        const bx1 = p.x + Math.cos(branchAngle) * branchLen;
        const by1 = p.y + Math.sin(branchAngle) * branchLen;
        drawBranchingBolt(fx, p.x, p.y, bx1, by1, {
          ...opts,
          depth: depth + 1,
          segments: Math.max(3, segments - 2),
          thickness: w * 0.65,
          branchChance: branchChance * 0.5,
          seed: seed + i * 3.7
        });
      }
    }
  }
}

/* ══════════════════════════════════════════════════════════════════════
   PERSISTENT STATE
   ══════════════════════════════════════════════════════════════════════ */
let _raindrops = null;
let _stormClouds = null;
let _strikeTimer = 0;
let _strikeFlash = 0;
let _shakeX = 0;
let _shakeY = 0;
let _activeBolts = [];
let _sfxStarted = false;

function ensureRain(w, h, count = 140) {
  if (_raindrops && _raindrops.length === count) return _raindrops;
  _raindrops = [];
  for (let i = 0; i < count; i++) {
    _raindrops.push({
      x: rand(0, w),
      y: rand(-h, h),
      len: rand(12, 30),
      speed: rand(0.6, 1.4),
      alpha: rand(0.06, 0.2),
      wind: rand(-0.1, -0.03)
    });
  }
  return _raindrops;
}

function ensureClouds(w, h, count = 8) {
  if (_stormClouds && _stormClouds.length === count) return _stormClouds;
  _stormClouds = [];
  for (let i = 0; i < count; i++) {
    _stormClouds.push({
      x: rand(-w * 0.2, w * 1.2),
      y: rand(-h * 0.15, h * 0.25),
      w: rand(w * 0.3, w * 0.7),
      h: rand(h * 0.08, h * 0.2),
      alpha: rand(0.18, 0.45),
      drift: rand(-0.06, 0.06),
      phase: rand(0, Math.PI * 2)
    });
  }
  return _stormClouds;
}

/* ══════════════════════════════════════════════════════════════════════
   MAIN EFFECT
   ══════════════════════════════════════════════════════════════════════ */
export const thunderGodEffect = {
  id: 'thunder_god',
  name: 'Thor Thunder God',
  icon: '⚡',
  category: 'Sci-Fi',
  perf: 'medium',
  requiresFace: false,

  render(fx, frame) {
    const { src, width: w, height: h, time, now, dt } = frame;
    const t = time || now || 0;
    const tSec = t * 0.001;
    const delta = clamp(dt || 16.7, 0, 50);

    // Start ambient hum on first render
    if (!_sfxStarted) {
      _sfxStarted = true;
      ThunderSFX.startHum();
    }

    // ────────────────────────────────────────────────────
    // LIGHTNING STRIKE TIMING (randomised dramatic intervals)
    // ────────────────────────────────────────────────────
    _strikeTimer -= delta;
    if (_strikeTimer <= 0) {
      _strikeFlash = 1.0;
      _strikeTimer = rand(2000, 5500); // next strike in 2–5.5 seconds
      _shakeX = rand(-5, 5);
      _shakeY = rand(-3, 3);

      // Generate new bolt set
      _activeBolts = [];
      const boltCount = Math.round(rand(1, 4));
      for (let i = 0; i < boltCount; i++) {
        // Bolts originate from the top of the frame (sky / clouds)
        const originX = rand(w * 0.05, w * 0.95);
        const originY = rand(-15, h * 0.08);

        // Strike down toward middle or lower portion
        const targetX = originX + rand(-w * 0.25, w * 0.25);
        const targetY = rand(h * 0.5, h * 1.05);

        _activeBolts.push({
          x0: originX,
          y0: originY,
          x1: targetX,
          y1: targetY,
          seed: rand(0, 100),
          life: rand(120, 300),
          age: 0,
          thickness: rand(2, 4.5)
        });
      }

      // ⚡ SOUND: lightning crack + delayed rumble
      const intensity = rand(0.6, 1.0);
      ThunderSFX.crack(intensity);
      setTimeout(() => ThunderSFX.rumble(intensity * 0.8), rand(80, 300));
    }

    // Decay flash and shake
    _strikeFlash *= Math.pow(0.86, delta / 16.7);
    _shakeX *= 0.88;
    _shakeY *= 0.88;

    // Update bolt lifetimes
    for (let i = _activeBolts.length - 1; i >= 0; i--) {
      _activeBolts[i].age += delta;
      if (_activeBolts[i].age >= _activeBolts[i].life) {
        _activeBolts.splice(i, 1);
      }
    }

    // ────────────────────────────────────────────────────
    // 1. BASE VIDEO with storm grading + screen shake
    // ────────────────────────────────────────────────────
    fx.save();
    fx.translate(_shakeX, _shakeY);

    const flashBright = 0.88 + _strikeFlash * 0.55;
    const flashContrast = 1.25 + _strikeFlash * 0.35;
    fx.filter = `contrast(${flashContrast}) brightness(${flashBright}) saturate(${1.1 - _strikeFlash * 0.3}) hue-rotate(-10deg)`;
    fx.drawImage(src, 0, 0, w, h);
    fx.filter = 'none';

    // ────────────────────────────────────────────────────
    // 2. STORM CLOUDS (dark masses at top, lit from within during strikes)
    // ────────────────────────────────────────────────────
    const clouds = ensureClouds(w, h);
    for (const c of clouds) {
      c.x += c.drift * delta * 0.1;
      if (c.x > w * 1.3) c.x = -c.w;
      if (c.x < -c.w * 1.3) c.x = w;

      const pulsate = 1 + Math.sin(tSec * 0.5 + c.phase) * 0.05;
      const ccx = c.x + c.w * 0.5;
      const ccy = c.y + c.h * 0.5;
      const cg = fx.createRadialGradient(ccx, ccy, c.h * 0.2, ccx, ccy, c.w * 0.5 * pulsate);

      if (_strikeFlash > 0.3) {
        cg.addColorStop(0, `rgba(180, 210, 240, ${c.alpha * _strikeFlash * 0.7})`);
        cg.addColorStop(0.4, `rgba(80, 100, 130, ${c.alpha * 0.7})`);
      } else {
        cg.addColorStop(0, `rgba(30, 35, 50, ${c.alpha})`);
        cg.addColorStop(0.4, `rgba(20, 22, 35, ${c.alpha * 0.8})`);
      }
      cg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = cg;
      fx.beginPath();
      fx.ellipse(ccx, ccy, c.w * 0.5 * pulsate, c.h * 0.5 * pulsate, 0, 0, Math.PI * 2);
      fx.fill();
    }

    // ────────────────────────────────────────────────────
    // 3. RAIN (diagonal streaks)
    // ────────────────────────────────────────────────────
    const rain = ensureRain(w, h);
    fx.save();
    fx.globalCompositeOperation = 'screen';
    for (const r of rain) {
      r.y += r.speed * delta;
      r.x += r.wind * delta;
      if (r.y > h + r.len) { r.y = rand(-30, -10); r.x = rand(0, w); }
      if (r.x < -20) r.x = w + 10;

      const alpha = r.alpha + _strikeFlash * 0.1;
      fx.strokeStyle = `rgba(175, 195, 225, ${alpha})`;
      fx.lineWidth = 1;
      fx.beginPath();
      fx.moveTo(r.x, r.y);
      fx.lineTo(r.x + r.wind * r.len * 0.8, r.y + r.len);
      fx.stroke();
    }
    fx.restore();

    // ────────────────────────────────────────────────────
    // 4. LIGHTNING FLASH ILLUMINATION (full-screen)
    // ────────────────────────────────────────────────────
    if (_strikeFlash > 0.05) {
      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.fillStyle = `rgba(186, 220, 253, ${_strikeFlash * 0.35})`;
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }

    // ────────────────────────────────────────────────────
    // 5. BRANCHING LIGHTNING BOLTS
    // ────────────────────────────────────────────────────
    fx.save();
    fx.globalCompositeOperation = 'screen';

    for (const bolt of _activeBolts) {
      const boltK = 1 - bolt.age / bolt.life;
      fx.globalAlpha = boltK;
      drawBranchingBolt(fx, bolt.x0, bolt.y0, bolt.x1, bolt.y1, {
        depth: 0,
        maxDepth: 3,
        segments: 10,
        jitter: 0.3,
        branchChance: 0.35,
        branchScale: 0.5,
        thickness: bolt.thickness * boltK,
        glowColor: `rgba(140, 200, 255, ${0.5 * boltK})`,
        coreColor: `rgba(255, 255, 255, ${boltK})`,
        seed: bolt.seed,
        t
      });

      // Impact glow where bolt meets the ground
      const impactR = 30 + bolt.thickness * 8;
      const ig = fx.createRadialGradient(bolt.x1, bolt.y1, 0, bolt.x1, bolt.y1, impactR * boltK);
      ig.addColorStop(0, `rgba(255, 255, 255, ${0.7 * boltK})`);
      ig.addColorStop(0.25, `rgba(140, 200, 255, ${0.4 * boltK})`);
      ig.addColorStop(0.6, `rgba(80, 120, 200, ${0.15 * boltK})`);
      ig.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = ig;
      fx.beginPath();
      fx.arc(bolt.x1, bolt.y1, impactR * boltK, 0, Math.PI * 2);
      fx.fill();
    }
    fx.globalAlpha = 1;
    fx.restore();

    fx.restore(); // end screen shake translate

    // ────────────────────────────────────────────────────
    // 6. DARK STORM VIGNETTE
    // ────────────────────────────────────────────────────
    fx.save();
    fx.globalCompositeOperation = 'multiply';
    const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(255,255,255,1)');
    vig.addColorStop(0.45, 'rgba(255,255,255,1)');
    vig.addColorStop(0.8, 'rgba(55,60,90,1)');
    vig.addColorStop(1, 'rgba(12,12,25,1)');
    fx.fillStyle = vig;
    fx.fillRect(0, 0, w, h);
    fx.restore();
  },

  /** Clean up audio nodes when effect is deactivated */
  destroy() {
    ThunderSFX.stopHum();
    _sfxStarted = false;
  }
};

export default thunderGodEffect;
