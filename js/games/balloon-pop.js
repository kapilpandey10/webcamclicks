/* WebcamClicks — Game: Balloon Pop (Advanced).
   Palm + fingertip optical tracking guides the needle. Pop bouncing balloons,
   chain combos, grab gold/rainbow bonuses, avoid bombs — all before time runs out!
   100% on-device, private, no external models. */

import { rand, pick, clamp, lerp } from '../utils.js';
import { Sound } from '../sound.js';
import { dimStage } from './GameManager.js';

/* ---------- Balloon color palettes (translucent latex with 3D gloss) ---------- */
const BALLOON_THEMES = [
  { name: 'ruby', base: '#e11d48', light: '#fda4af', dark: '#881337', rim: '#f43f5e' },
  { name: 'blue', base: '#2563eb', light: '#93c5fd', dark: '#1e3a8a', rim: '#3b82f6' },
  { name: 'emerald', base: '#059669', light: '#6ee7b7', dark: '#064e3b', rim: '#10b981' },
  { name: 'purple', base: '#7c3aed', light: '#c4b5fd', dark: '#4c1d95', rim: '#8b5cf6' },
  { name: 'amber', base: '#d97706', light: '#fde68a', dark: '#78350f', rim: '#f59e0b' },
  { name: 'pink', base: '#db2777', light: '#fbcfe8', dark: '#831843', rim: '#ec4899' },
  { name: 'gold', base: '#ca8a04', light: '#fef08a', dark: '#713f12', rim: '#eab308', special: true }
];

/* ---------- Balloon kinds ---------- */
// weight = spawn weight, points, special flags
const BALLOON_KINDS = [
  { name: 'normal', weight: 58, points: 1, danger: false, freeze: false, special: false, speedMult: 1.0, sizeMult: 1.0 },
  { name: 'gold', weight: 16, points: 5, danger: false, freeze: false, special: true, speedMult: 0.9, sizeMult: 1.15 },
  { name: 'bomb', weight: 12, points: -25, danger: true, freeze: false, special: false, speedMult: 1.15, sizeMult: 1.05 },
  { name: 'ice', weight: 8, points: 3, danger: false, freeze: true, special: false, speedMult: 0.8, sizeMult: 1.1 },
  { name: 'rainbow', weight: 3, points: 15, danger: false, freeze: false, special: true, speedMult: 0.7, sizeMult: 1.25 }
];

const TOTAL_WEIGHT = BALLOON_KINDS.reduce((s, k) => s + k.weight, 0);

function pickKind() {
  let roll = Math.random() * TOTAL_WEIGHT;
  for (const k of BALLOON_KINDS) {
    roll -= k.weight;
    if (roll <= 0) return k;
  }
  return BALLOON_KINDS[0];
}

function pickTheme(kind) {
  if (kind.name === 'gold') return BALLOON_THEMES[6];
  if (kind.name === 'rainbow') return pick(BALLOON_THEMES.slice(0, 6));
  return pick(BALLOON_THEMES.slice(0, 6));
}

/* ---------- Optical palm / fingertip tracker (frame-difference zones) ---------- */
// Uses the MotionDetector's per-zone energy grid (cols x rows) to locate:
//   - palm: broad, sustained hand motion -> weighted centroid of active zones
//   - fingertip: sharp, localized high-energy peak -> single brightest zone
// Fully private, runs on the camera work canvas, no model downloads.

function trackHand(state, frame) {
  const motion = frame.motion;
  if (!motion || motion.level <= 0.015) return null;
  const zones = motion.zones;
  const cols = motion.cols || 12;
  const rows = motion.rows || 9;

  // Find zones above a threshold relative to the max energy (adaptive).
  let max = 0;
  for (let i = 0; i < zones.length; i++) if (zones[i] > max) max = zones[i];
  if (max < 6) return null; // nothing meaningful moving
  const thr = max * 0.35;

  let sx = 0, sy = 0, sw = 0;
  for (let y = 0; y < rows; y++) {
    const rowOff = y * cols;
    for (let x = 0; x < cols; x++) {
      const v = zones[rowOff + x];
      if (v > thr) {
        const w = v;
        sx += (x + 0.5) / cols * w;
        sy += (y + 0.5) / rows * w;
        sw += w;
      }
    }
  }
  if (sw <= 0) return null;
  return { x: sx / sw, y: sy / sw, strength: Math.min(1, max / 60) };
}

function trackFingertip(state, frame) {
  const motion = frame.motion;
  if (!motion) return null;
  const zones = motion.zones;
  const cols = motion.cols || 12;
  const rows = motion.rows || 9;

  // Fingertip = single sharpest local peak (high energy vs its neighbors).
  let best = null, bestScore = -1;
  for (let y = 1; y < rows - 1; y++) {
    const rowOff = y * cols;
    for (let x = 1; x < cols - 1; x++) {
      const v = zones[rowOff + x];
      if (v < 8) continue;
      // contrast against 8 neighbors
      let nSum = 0;
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (dx === 0 && dy === 0) continue;
          nSum += zones[rowOff + dy * cols + dx];
        }
      }
      const avgN = nSum / 8;
      const score = v - avgN * 0.9; // peak sharpness
      if (score > bestScore) {
        bestScore = score;
        best = { x: (x + 0.5) / cols, y: (y + 0.5) / rows, strength: Math.min(1, v / 40) };
      }
    }
  }
  // Require a reasonably sharp peak to call it a fingertip.
  return best && bestScore > 6 ? best : null;
}


export const balloonPop = {
  id: 'balloon-pop',
  name: 'Balloon Pop',
  icon: '🎈',
  description: 'Track your palm & index finger to pop balloons, chain combos & avoid bombs!',
  usesFace: false,
  duration: 45,

  createState() {
    return {
      timeLeft: 45,
      score: 0,
      lives: 3,
      level: 1,
      combo: 0,
      comboTimer: 0,
      bestCombo: 0,
      balloons: [],
      particles: [],
      popTexts: [],
      screenshake: 0,
      freezeTimer: 0, // ice balloon active: slows all balloons
      // Needle coordinates (normalized 0..1)
      needleX: 0.5,
      needleY: 0.7,
      targetX: 0.5,
      targetY: 0.7,
      palmX: 0.5,
      palmY: 0.7,
      fingertipX: 0.5,
      fingertipY: 0.7,
      needleAngle: -Math.PI / 4,
      stabAnim: 0,
      // Hand / finger tracking state
      hasFinger: false,
      useFingertip: false,
      lastMotionX: 0.5,
      lastMotionY: 0.7,
      // Spawner
      spawnIn: 500,
      maxBalloons: 7,
      // Instruction demo
      demoTimer: 3500,
      firstPopDone: false,
      // Canvas interaction cleanup
      _cleanup: null
    };
  },

  init(state, engine) {
    engine.setScore(0);
    if (engine.setLives) engine.setLives(state.lives);
    state.balloons = [];
    state.particles = [];
    state.popTexts = [];
    state.score = 0;
    state.lives = 3;
    state.level = 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.bestCombo = 0;
    state.timeLeft = 45;
    state.screenshake = 0;
    state.freezeTimer = 0;

    // Initial batch
    for (let i = 0; i < 4; i++) {
      this._spawnBalloon(state, engine, rand(0.18, 0.82), rand(0.35, 0.85));
    }

    // Attach mouse / touch listener to stage canvas for instant universal response
    const canvas = engine.canvas || document.getElementById('stage-canvas');
    if (canvas) {
      const onPointer = (e) => {
        const rect = canvas.getBoundingClientRect();
        if (rect.width > 0 && rect.height > 0) {
          state.targetX = clamp((e.clientX - rect.left) / rect.width, 0.05, 0.95);
          state.targetY = clamp((e.clientY - rect.top) / rect.height, 0.05, 0.95);
          state.hasFinger = true;
          state.useFingertip = false;
        }
      };
      canvas.addEventListener('pointermove', onPointer);
      canvas.addEventListener('pointerdown', onPointer);
      state._cleanup = () => {
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerdown', onPointer);
      };
    }

    engine.message('🎈 Balloon Pop', 'Move your palm & point your index finger to pop balloons! Avoid the 💣 bombs!', 3000);
  },

  _spawnBalloon(state, engine, x = null, y = null) {
    const kind = pickKind();
    const isGold = kind.special && kind.name !== 'rainbow';
    const isRainbow = kind.name === 'rainbow';
    const isBomb = kind.danger;
    const isIce = kind.freeze;
    const theme = pickTheme(kind);
    const baseR = rand(34, 50) * kind.sizeMult;
    const r = clamp(baseR, 28, 62);
    const speed = 0.10 + rand(0.04, 0.14) * kind.speedMult;

    state.balloons.push({
      x: x !== null ? x : rand(0.12, 0.88),
      y: y !== null ? y : 1.18, // float up from below
      vx: rand(-0.07, 0.07) * kind.speedMult,
      vy: -rand(0.10, 0.18) * kind.speedMult,
      r,
      theme,
      kind,
      isGold,
      isBomb,
      isIce,
      isRainbow,
      points: kind.points,
      swayOffset: rand(0, Math.PI * 2),
      swaySpeed: rand(1.6, 3.4) * kind.speedMult,
      squashX: 1,
      squashY: 1,
      stringLength: r * 1.55,
      hueOffset: rand(0, 360), // for rainbow cycling
      alive: true
    });
  },

  _popBalloon(state, engine, b, x, y) {
    // Bombs: penalize & lose a life (do NOT award points)
    if (b.isBomb) {
      state.lives = Math.max(0, state.lives - 1);
      state.combo = 0;
      state.comboTimer = 0;
      state.screenshake = 18;
      Sound.fail();
      state.popTexts.push({
        x, y: y - b.r * 0.5, text: 'BOOM! -1 Life', color: '#ef4444', age: 0
      });
      if (engine.setLives) engine.setLives(state.lives);
      if (state.lives <= 0) {
        engine.endGame(state.score, false);
      }
      // bomb shrapnel (dark red)
      const count = 14;
      for (let k = 0; k < count; k++) {
        const angle = (k / count) * Math.PI * 2 + rand(-0.3, 0.3);
        const speed = rand(140, 500);
        state.particles.push({
          x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
          rot: Math.random() * Math.PI * 2, vRot: rand(-10, 10),
          size: rand(b.r * 0.2, b.r * 0.5), aspect: rand(0.3, 0.7),
          color: pick(['#ef4444', '#7f1d1d', '#991b1b', '#fca5a5']),
          life: rand(500, 800), age: 0, isShard: true
        });
      }
      return;
    }

    // Normal scoring
    state.score += b.points;
    engine.setScore(state.score);

    // Combo
    const now = Date.now();
    state.combo++;
    state.comboTimer = 700;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;

    // Ice balloon: freeze all other balloons briefly
    if (b.isIce) {
      state.freezeTimer = 2500;
      state.popTexts.push({ x, y: y - b.r * 0.5, text: '+3 ICE!', color: '#67e8f9', age: 0 });
    } else if (b.isGold) {
      state.popTexts.push({ x, y: y - b.r * 0.5, text: '+5 GOLD!', color: '#fbbf24', age: 0 });
      Sound.score(state.score);
    } else if (b.isRainbow) {
      state.popTexts.push({ x, y: y - b.r * 0.5, text: '+15 RAINBOW!', color: '#a78bfa', age: 0 });
      Sound.score(state.score);
    } else {
      state.popTexts.push({ x, y: y - b.r * 0.5, text: '+1', color: '#ffffff', age: 0 });
    }
    state.firstPopDone = true;

    // Audio
    Sound.pop();
    if (state.combo >= 2 && state.combo % 3 === 0) Sound.score(state.score);

    // Screen shake proportional
    state.screenshake = Math.min(22, state.screenshake + 6);

    // 10-16 flying rubber shards
    const count = b.isGold || b.isRainbow ? 16 : 12;
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2 + rand(-0.25, 0.25);
      const speed = rand(150, 460);
      state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vRot: rand(-9, 9),
        size: rand(b.r * 0.22, b.r * 0.55),
        aspect: rand(0.3, 0.7),
        color: Math.random() < 0.6 ? b.theme.base : b.theme.light,
        life: rand(450, 750), age: 0, isShard: true
      });
    }

    // Confetti burst
    for (let k = 0; k < 14; k++) {
      state.particles.push({
        x, y,
        vx: rand(-200, 200),
        vy: rand(-240, 140),
        rot: Math.random() * Math.PI * 2,
        vRot: rand(-14, 14),
        size: rand(4, 9),
        aspect: 0.6,
        color: pick(['#fff', '#fde047', '#38bdf8', '#f472b6', '#4ade80', '#a78bfa']),
        life: rand(500, 950), age: 0, isShard: false
      });
    }
  },
  update(state, dt, frame, engine) {
    const dtSec = dt / 1000;

    // --- Difficulty scaling by level (every 12 points) ---
    const targetLevel = 1 + Math.floor(state.score / 12);
    if (targetLevel > state.level) {
      state.level = targetLevel;
      state.maxBalloons = Math.min(16, 7 + state.level * 2);
      engine.message(`⚡ Level ${state.level}`, 'Faster & more balloons!', 1500);
    }
    const speedMult = 1 + (state.level - 1) * 0.18;
    const spawnBase = Math.max(450, 900 - (state.level - 1) * 90);

    state.timeLeft -= dtSec;
    if (state.timeLeft <= 0) {
      const win = state.score >= 20;
      engine.endGame(state.score, win);
      return;
    }

    // Combo decay
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.freezeTimer > 0) {
      state.freezeTimer -= dt;
    }
    if (state.screenshake > 0) {
      state.screenshake = Math.max(0, state.screenshake - dtSec * 22);
    }

    // --- Palm + fingertip optical tracking ---
    const palm = trackHand(state, frame);
    const fingertip = trackFingertip(state, frame);

    let trackingX = null, trackingY = null, trackingConf = 0, useTip = false;

    // Prefer the fingertip (index finger) when a sharp peak exists; else palm.
    if (fingertip && fingertip.strength > 0.35) {
      trackingX = fingertip.x;
      trackingY = fingertip.y;
      trackingConf = fingertip.strength;
      useTip = true;
    } else if (palm && palm.strength > 0.3) {
      trackingX = palm.x;
      trackingY = palm.y;
      trackingConf = palm.strength;
      useTip = false;
    }

    // Apply mirror correction so hand moves same direction as on-screen needle
    if (trackingX !== null) {
      const mirroredX = 1 - trackingX;
      state.targetX = mirroredX;
      state.targetY = trackingY;
      state.hasFinger = true;
      state.useFingertip = useTip;
      state.lastMotionX = mirroredX;
      state.lastMotionY = trackingY;
      if (useTip) {
        state.fingertipX = mirroredX;
        state.fingertipY = trackingY;
      } else {
        state.palmX = mirroredX;
        state.palmY = trackingY;
      }
    }

    // Smooth needle movement (adaptive smoothing: faster when confident)
    const smoothBase = Math.min(1, dtSec * 14);
    const smooth = lerp(smoothBase, Math.min(1, dtSec * 26), trackingConf);
    const prevX = state.needleX;
    const prevY = state.needleY;
    state.needleX = lerp(state.needleX, state.targetX, smooth);
    state.needleY = lerp(state.needleY, state.targetY, smooth);

    // Dynamic needle angle based on movement direction
    const dX = state.needleX - prevX;
    const dY = state.needleY - prevY;
    if (Math.hypot(dX, dY) > 0.0015) {
      const targetAngle = Math.atan2(dY, dX) - Math.PI / 2;
      state.needleAngle = lerp(state.needleAngle, targetAngle, 0.22);
    }

    if (state.stabAnim > 0) {
      state.stabAnim = Math.max(0, state.stabAnim - dtSec * 5);
    }

    if (state.demoTimer > 0) {
      state.demoTimer -= dt;
    }

    // --- Balloon Spawning ---
    state.spawnIn -= dt;
    const canSpawn = state.balloons.length < state.maxBalloons && state.timeLeft > 0;
    if (state.spawnIn <= 0 && canSpawn) {
      state.spawnIn = rand(spawnBase, spawnBase + 450);
      this._spawnBalloon(state, engine);
    }

    const W = frame.width;
    const H = frame.height;
    const needlePxX = state.needleX * W;
    const needlePxY = state.needleY * H;
    const freezeSlow = state.freezeTimer > 0 ? 0.45 : 1.0;

    // --- Update Balloons ---
    for (let i = state.balloons.length - 1; i >= 0; i--) {
      const b = state.balloons[i];
      if (!b.alive) { state.balloons.splice(i, 1); continue; }

      b.swayOffset += dtSec * b.swaySpeed;

      // Buoyancy + wind sway (slowed when frozen)
      b.x += (b.vx + Math.sin(b.swayOffset) * 0.04) * dtSec * freezeSlow;
      b.y += b.vy * dtSec * freezeSlow;

      // Elastic squash recovery
      b.squashX = lerp(b.squashX, 1, dtSec * 9);
      b.squashY = lerp(b.squashY, 1, dtSec * 9);

      const pxX = b.x * W;
      const pxY = b.y * H;
      const r = b.r;

      // Bounce off walls
      if (pxX - r < 0) {
        b.x = r / W;
        b.vx = Math.abs(b.vx) * 0.8 + 0.02;
        b.squashX = 0.75; b.squashY = 1.25;
      } else if (pxX + r > W) {
        b.x = (W - r) / W;
        b.vx = -Math.abs(b.vx) * 0.8 - 0.02;
        b.squashX = 0.75; b.squashY = 1.25;
      }

      // Bounce off ceiling
      if (pxY - r < 20) {
        b.y = (20 + r) / H;
        b.vy = Math.abs(b.vy) * 0.55 + 0.04;
        b.squashX = 1.3; b.squashY = 0.7;
      }

      // Remove fallen balloons
      if (b.y > 1.4 && b.vy > 0) {
        state.balloons.splice(i, 1);
        continue;
      }

      // --- Needle Collision (POP!) ---
      const dist = Math.hypot(needlePxX - pxX, needlePxY - pxY);
      if (dist < r * 1.05) {
        this._popBalloon(state, engine, b, pxX, pxY);
        b.alive = false;
        state.balloons.splice(i, 1);
        state.stabAnim = 1;
      }
    }

    // --- Update Particles ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.age += dt;
      if (p.age >= p.life) { state.particles.splice(i, 1); continue; }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 400 * dtSec; // gravity
      p.rot += p.vRot * dtSec;
      p.vx *= 0.985; // air drag
    }

    // --- Floating score popups ---
    for (let i = state.popTexts.length - 1; i >= 0; i--) {
      const t = state.popTexts[i];
      t.age += dt;
      t.y -= 50 * dtSec;
      if (t.age >= 900) state.popTexts.splice(i, 1);
    }
  },

  render(state, ctx, frame, engine) {
    const W = frame.width;
    const H = frame.height;
    const now = frame.time || performance.now();

    // Apply screen shake
    let shakeX = 0, shakeY = 0;
    if (state.screenshake > 0) {
      shakeX = (Math.random() - 0.5) * state.screenshake * 2.5;
      shakeY = (Math.random() - 0.5) * state.screenshake * 2.5;
    }
    ctx.save();
    ctx.translate(shakeX, shakeY);

    // --- Background gradient ---
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#0f172a');
    bg.addColorStop(0.5, '#1e293b');
    bg.addColorStop(1, '#0f172a');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);
    // subtle vignette
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, W);
    vignette.addColorStop(0.7, 'rgba(0,0,0,0)');
    vignette.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // --- Render Balloons ---
    state.balloons.forEach((b) => {
      const bx = b.x * W;
      const by = b.y * H;
      const r = b.r;
      const theme = b.theme;

      ctx.save();
      ctx.translate(bx, by);
      ctx.scale(b.squashX, b.squashY);

      // 1. Dangling curly string
      ctx.beginPath();
      ctx.moveTo(0, r * 1.08);
      const sway = Math.sin(b.swayOffset * 1.5) * (r * 0.25);
      ctx.bezierCurveTo(sway * 0.8, r * 1.4, -sway, r * 1.8, sway * 0.5, r * 1.08 + b.stringLength);
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.lineWidth = 1.6;
      ctx.stroke();

      // 2. Bottom rubber knot
      ctx.beginPath();
      ctx.moveTo(-r * 0.12, r * 1.02);
      ctx.lineTo(r * 0.12, r * 1.02);
      ctx.lineTo(r * 0.06, r * 1.14);
      ctx.lineTo(-r * 0.06, r * 1.14);
      ctx.closePath();
      ctx.fillStyle = b.isBomb ? '#450a0a' : theme.dark;
      ctx.fill();

      // 3. Balloon 3D spherical latex body
      ctx.beginPath();
      ctx.moveTo(0, -r * 1.08);
      ctx.bezierCurveTo(r * 1.12, -r * 1.08, r * 1.18, r * 0.35, r * 0.25, r * 1.04);
      ctx.quadraticCurveTo(0, r * 1.09, -r * 0.25, r * 1.04);
      ctx.bezierCurveTo(-r * 1.18, r * 0.35, -r * 1.12, -r * 1.08, 0, -r * 1.08);
      ctx.closePath();

      // Rainbow cycle for rainbow balloons
      let base = theme.base, light = theme.light, dark = theme.dark, rim = theme.rim;
      if (b.isRainbow) {
        const t = (now * 0.003 + b.hueOffset * 0.01) % (Math.PI * 2);
        const h = (Math.sin(t) * 120 + 180);
        base = `hsl(${h}, 90%, 55%)`;
        light = `hsl(${h}, 90%, 75%)`;
        dark = `hsl(${h}, 90%, 35%)`;
        rim = '#fff';
      } else if (b.isGold) {
        const pulse = 1 + Math.sin(now * 0.006) * 0.06;
        rim = 'rgba(254, 240, 138, 0.9)';
        ctx.lineWidth = 3.5 * pulse;
      }

      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.38, r * 0.08, 0, 0, r * 1.15);
      grad.addColorStop(0, light);
      grad.addColorStop(0.38, base);
      grad.addColorStop(0.85, dark);
      grad.addColorStop(1, 'rgba(10, 10, 20, 0.65)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer rim translucency glow
      ctx.strokeStyle = rim;
      ctx.lineWidth = ctx.lineWidth || 2.2;
      ctx.stroke();

      // Golden aura for special balloons
      if (b.isGold || b.isRainbow) {
        ctx.save();
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.18, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(255, 255, 255, ${0.15 + Math.sin(now * 0.005) * 0.08})`;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();
      }

      // 4. Glossy Specular Reflection (primary light glint)
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(-r * 0.36, -r * 0.42, r * 0.26, r * 0.12, -0.65, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.88)';
      ctx.fill();
      // Secondary tiny spark glint
      ctx.beginPath();
      ctx.arc(-r * 0.16, -r * 0.54, Math.max(1.8, r * 0.05), 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.fill();
      // Bottom-right rim reflection bounce
      ctx.beginPath();
      ctx.ellipse(r * 0.45, r * 0.35, r * 0.24, r * 0.06, 0.75, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
      ctx.fill();
      ctx.restore();

      // Bomb fuse / fuse spark
      if (b.isBomb) {
        ctx.save();
        ctx.translate(0, -r * 1.06);
        ctx.rotate(-0.3);
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(Math.sin(now * 0.01) * 2 - 4, -r * 0.35);
        ctx.strokeStyle = '#fbbf24';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.stroke();
        // fuse spark
        ctx.beginPath();
        ctx.arc(-4 + Math.sin(now * 0.01) * 2, -r * 0.35, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = '#fbbf24';
        ctx.fill();
        ctx.restore();
      }

      ctx.restore();
    });

    // --- Render Popping Shards & Confetti ---
    state.particles.forEach((p) => {
      const alpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.isShard) {
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, -p.size * 0.2);
        ctx.lineTo(p.size * 0.5, -p.size * 0.4);
        ctx.lineTo(p.size * 0.2, p.size * 0.4);
        ctx.lineTo(-p.size * 0.4, p.size * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(-p.size / 2, -p.size * p.aspect / 2, p.size, p.size * p.aspect);
      }
      ctx.restore();
    });

    // --- Render Floating Score Popups ---
    state.popTexts.forEach((t) => {
      const a = clamp(1 - t.age / 900, 0, 1);
      ctx.save();
      ctx.font = 'bold 21px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.85)';
      ctx.shadowBlur = 7;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = a;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });

    // --- Palm & Fingertip Tracking Reticle ---
    const nx = state.needleX * W;
    const ny = state.needleY * H;
    const showPalm = state.hasFinger && !state.useFingertip;
    const showTip = state.useFingertip;

    if (showPalm) {
      const px = state.palmX * W;
      const py = state.palmY * H;
      const pulse = 1 + Math.sin(now * 0.012) * 0.18;
      ctx.save();
      ctx.translate(px, py);
      // outer palm ring
      ctx.beginPath();
      ctx.arc(0, 0, 24 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.75)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([6, 6]);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#6366f1';
      ctx.fill();
      ctx.restore();
    } else if (showTip) {
      const tx = state.fingertipX * W;
      const ty = state.fingertipY * H;
      const pulse = 1 + Math.sin(now * 0.015) * 0.22;
      ctx.save();
      ctx.translate(tx, ty);
      // fingertip target dot
      ctx.beginPath();
      ctx.arc(0, 0, 10 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = '#34d399';
      ctx.fill();
      ctx.beginPath();
      ctx.arc(0, 0, 16 * pulse, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(52, 211, 153, 0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.stroke();
      ctx.restore();
    }

    // --- Sharp Needle at Finger Coordinates ---
    const stabOffset = state.stabAnim * 14;
    ctx.save();
    ctx.translate(nx, ny);
    ctx.rotate(state.needleAngle);
    ctx.translate(0, -stabOffset);

    // Needle drop shadow
    ctx.save();
    ctx.translate(5, 8);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(3.5, 48);
    ctx.lineTo(-3.5, 48);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.35)';
    ctx.fill();
    ctx.restore();

    // 1. Trailing red silk thread from needle eye
    ctx.beginPath();
    ctx.moveTo(0, 48);
    const threadWave = Math.sin(now * 0.008) * 8;
    ctx.bezierCurveTo(threadWave, 62, -threadWave, 78, threadWave * 0.5, 96);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Polished chrome needle blade
    ctx.beginPath();
    ctx.moveTo(0, 0); // Sharp needle point
    ctx.lineTo(3.2, 44);
    ctx.arc(0, 46, 3.2, 0, Math.PI);
    ctx.lineTo(-3.2, 44);
    ctx.closePath();

    const metalGrad = ctx.createLinearGradient(-3.2, 0, 3.2, 0);
    metalGrad.addColorStop(0, '#64748b');
    metalGrad.addColorStop(0.28, '#ffffff');
    metalGrad.addColorStop(0.65, '#cbd5e1');
    metalGrad.addColorStop(1, '#334155');
    ctx.fillStyle = metalGrad;
    ctx.fill();

    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Golden needle eyelet
    ctx.beginPath();
    ctx.ellipse(0, 44, 1.2, 3.2, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#1e293b';
    ctx.fill();

    // 4. Sharp glint star at needle tip
    ctx.beginPath();
    ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#67e8f9';
    ctx.shadowBlur = 8;
    ctx.fill();
    ctx.restore();

    // --- On-Screen Game HUD ---
    ctx.save();
    ctx.font = 'bold 21px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`⏱️ ${Math.max(0, Math.ceil(state.timeLeft))}s`, 20, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`🎈 ${state.score}`, W - 20, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = state.lives <= 1 ? '#ef4444' : '#ffffff';
    ctx.fillText(`❤️ ${state.lives}`, W - 20, 46);

    // Level & combo
    ctx.textAlign = 'left';
    ctx.fillStyle = '#a78bfa';
    ctx.fillText(`Lvl ${state.level}`, 20, 46);
    if (state.combo >= 2) {
      ctx.fillStyle = '#fbbf24';
      ctx.fillText(`COMBO x${state.combo}`, 20, 72);
    }
    ctx.restore();

    ctx.restore(); // end shake

    // --- Interactive Instruction Demo Overlay ---
    if (state.demoTimer > 0 && !state.firstPopDone) {
      const alpha = Math.min(1, state.demoTimer / 800);
      ctx.save();
      ctx.globalAlpha = alpha;

      const boxW = Math.min(520, W - 40);
      const boxH = 104;
      const boxX = (W - boxW) / 2;
      const boxY = H * 0.40;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
      ctx.strokeStyle = 'rgba(99, 102, 241, 0.5)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 18);
      ctx.fill();
      ctx.stroke();

      const handBob = Math.sin(now * 0.008) * 8;
      ctx.font = '30px serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = state.useFingertip ? '#34d399' : '#6366f1';
      ctx.fillText(state.useFingertip ? '👆' : '🖐️', boxX + 50 + handBob, boxY + 60);

      ctx.font = 'bold 18px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Move your palm & point your index finger to pop balloons!', boxX + 90, boxY + 38);

      ctx.font = '13px Outfit, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Avoid the 💣 bombs — they cost a life. Chain pops for COMBO xN!', boxX + 90, boxY + 66);

      ctx.restore();
    }
  },

  dispose(state, engine) {
    if (state._cleanup) {
      state._cleanup();
      state._cleanup = null;
    }
    state.balloons = [];
    state.particles = [];
    state.popTexts = [];
  }
};
