/* WebcamClicks — Game: Balloon Pop.
   Track your index finger (or move hand / touch) to aim the needle and pop
   realistic bouncing balloons before the 45-second timer runs out! */

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

export const balloonPop = {
  id: 'balloon-pop',
  name: 'Balloon Pop',
  icon: '🎈',
  description: 'Point your index finger to guide the needle and pop the bouncing balloons!',
  usesFace: false,
  duration: 45,

  createState() {
    return {
      timeLeft: 45,
      score: 0,
      balloons: [],
      particles: [],
      popTexts: [],
      // Needle coordinates (normalized 0..1)
      needleX: 0.5,
      needleY: 0.7,
      targetX: 0.5,
      targetY: 0.7,
      needleAngle: -Math.PI / 4,
      stabAnim: 0,
      // Hand / finger tracking state
      hasFinger: false,
      lastMotionX: 0.5,
      lastMotionY: 0.7,
      // Spawner timer
      spawnIn: 400,
      maxBalloons: 8,
      // Instruction demo
      demoTimer: 3500,
      firstPopDone: false,
      // Canvas interaction cleanup
      _cleanup: null
    };
  },

  init(state, engine) {
    engine.setScore(0);
    state.balloons = [];
    state.particles = [];
    state.popTexts = [];

    // Initial batch of balloons
    for (let i = 0; i < 4; i++) {
      this._spawnBalloon(state, engine, rand(0.15, 0.85), rand(0.3, 0.85));
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
        }
      };
      canvas.addEventListener('pointermove', onPointer);
      canvas.addEventListener('pointerdown', onPointer);
      state._cleanup = () => {
        canvas.removeEventListener('pointermove', onPointer);
        canvas.removeEventListener('pointerdown', onPointer);
      };
    }

    engine.message('🎈 Balloon Pop', 'Point your index finger or tap to pop balloons with the needle!', 2800);
  },

  _spawnBalloon(state, engine, x = null, y = null) {
    const isGold = Math.random() < 0.14;
    const theme = isGold ? BALLOON_THEMES[6] : pick(BALLOON_THEMES.slice(0, 6));
    const r = rand(36, 52);
    state.balloons.push({
      x: x !== null ? x : rand(0.12, 0.88),
      y: y !== null ? y : 1.15, // float up from below
      vx: rand(-0.06, 0.06),
      vy: rand(-0.16, -0.09) * (isGold ? 1.3 : 1),
      r,
      theme,
      isGold,
      swayOffset: rand(0, Math.PI * 2),
      swaySpeed: rand(1.8, 3.2),
      squashX: 1,
      squashY: 1,
      stringLength: r * 1.55,
      points: isGold ? 5 : 1
    });
  },

  update(state, dt, frame, engine) {
    const dtSec = dt / 1000;
    state.timeLeft -= dtSec;
    if (state.timeLeft <= 0) {
      const win = state.score >= 15;
      engine.endGame(state.score, win);
      return;
    }

    // --- Index Finger / Hand Tracking from camera motion ---
    if (frame.motion && frame.motion.level > 0.02) {
      // Find motion peak outside the face area (if face is present)
      const faceBox = frame.face && frame.face.box;
      let motionX = frame.motion.cx;
      let motionY = frame.motion.cy;

      // Check if motion is outside the head (so the face doesn't attract the needle)
      let validFingerMotion = true;
      if (faceBox) {
        const fnx = (faceBox.x + faceBox.width / 2) / frame.width;
        const fny = (faceBox.y + faceBox.height / 2) / frame.height;
        const fnw = (faceBox.width * 0.75) / frame.width;
        const fnh = (faceBox.height * 0.85) / frame.height;
        if (Math.abs(motionX - fnx) < fnw && Math.abs(motionY - fny) < fnh) {
          validFingerMotion = false; // motion is just head moving
        }
      }

      if (validFingerMotion) {
        state.targetX = motionX;
        state.targetY = motionY;
        state.hasFinger = true;
      }
    }

    // Smooth needle movement (anti-jitter low-pass)
    const smooth = Math.min(1, dtSec * 16);
    const prevX = state.needleX;
    const prevY = state.needleY;
    state.needleX = lerp(state.needleX, state.targetX, smooth);
    state.needleY = lerp(state.needleY, state.targetY, smooth);

    // Dynamic needle angle based on movement direction
    const dX = state.needleX - prevX;
    const dY = state.needleY - prevY;
    if (Math.hypot(dX, dY) > 0.002) {
      const targetAngle = Math.atan2(dY, dX) - Math.PI / 2;
      state.needleAngle = lerp(state.needleAngle, targetAngle, 0.2);
    }

    if (state.stabAnim > 0) {
      state.stabAnim = Math.max(0, state.stabAnim - dtSec * 4);
    }

    if (state.demoTimer > 0) {
      state.demoTimer -= dt;
    }

    // --- Balloon Spawning ---
    state.spawnIn -= dt;
    if (state.spawnIn <= 0 && state.balloons.length < state.maxBalloons) {
      state.spawnIn = rand(650, 1100);
      this._spawnBalloon(state, engine);
    }

    const W = frame.width;
    const H = frame.height;
    const needlePxX = state.needleX * W;
    const needlePxY = state.needleY * H;

    // --- Update Balloons ---
    for (let i = state.balloons.length - 1; i >= 0; i--) {
      const b = state.balloons[i];
      b.swayOffset += dtSec * b.swaySpeed;

      // Buoyancy and gentle wind sway
      b.x += (b.vx + Math.sin(b.swayOffset) * 0.04) * dtSec;
      b.y += b.vy * dtSec;

      // Elastic squash recovery
      b.squashX = lerp(b.squashX, 1, dtSec * 8);
      b.squashY = lerp(b.squashY, 1, dtSec * 8);

      const pxX = b.x * W;
      const pxY = b.y * H;
      const r = b.r;

      // Bounce off screen walls
      if (pxX - r < 0) {
        b.x = r / W;
        b.vx = Math.abs(b.vx) * 0.85 + 0.02;
        b.squashX = 0.78; b.squashY = 1.22;
      } else if (pxX + r > W) {
        b.x = (W - r) / W;
        b.vx = -Math.abs(b.vx) * 0.85 - 0.02;
        b.squashX = 0.78; b.squashY = 1.22;
      }

      // Bounce off ceiling
      if (pxY - r < 20) {
        b.y = (20 + r) / H;
        b.vy = Math.abs(b.vy) * 0.6 + 0.04;
        b.squashX = 1.25; b.squashY = 0.75;
      }

      // If fallen below screen and still moving down, remove
      if (b.y > 1.3 && b.vy > 0) {
        state.balloons.splice(i, 1);
        continue;
      }

      // --- Needle Collision Check (POP!) ---
      const dist = Math.hypot(needlePxX - pxX, needlePxY - pxY);
      if (dist < r * 1.05) {
        // POP THIS BALLOON!
        this._popBalloon(state, engine, b, pxX, pxY);
        state.balloons.splice(i, 1);
        state.stabAnim = 1;
        state.firstPopDone = true;
      }
    }

    // --- Update Particles (Rubber pieces & confetti) ---
    for (let i = state.particles.length - 1; i >= 0; i--) {
      const p = state.particles[i];
      p.age += dt;
      if (p.age >= p.life) { state.particles.splice(i, 1); continue; }
      p.x += p.vx * dtSec;
      p.y += p.vy * dtSec;
      p.vy += 380 * dtSec; // gravity
      p.rot += p.vRot * dtSec;
    }

    // --- Update floating score popups ---
    for (let i = state.popTexts.length - 1; i >= 0; i--) {
      const t = state.popTexts[i];
      t.age += dt;
      t.y -= 45 * dtSec;
      if (t.age >= 900) state.popTexts.splice(i, 1);
    }
  },

  _popBalloon(state, engine, b, x, y) {
    state.score += b.points;
    engine.setScore(state.score);

    // Audio effects: POP sound + score chime
    Sound.pop();
    if (b.isGold) {
      Sound.score(state.score);
    }

    // Pop text badge (+1 / +5)
    state.popTexts.push({
      x,
      y: y - b.r * 0.5,
      text: b.isGold ? '+5 GOLD!' : '+1',
      color: b.isGold ? '#fbbf24' : '#ffffff',
      age: 0
    });

    // 8-12 Flying jagged rubber shards
    const count = b.isGold ? 16 : 10;
    for (let k = 0; k < count; k++) {
      const angle = (k / count) * Math.PI * 2 + rand(-0.2, 0.2);
      const speed = rand(160, 420);
      state.particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        rot: Math.random() * Math.PI * 2,
        vRot: rand(-8, 8),
        size: rand(b.r * 0.25, b.r * 0.55),
        aspect: rand(0.3, 0.7),
        color: Math.random() < 0.6 ? b.theme.base : b.theme.light,
        life: rand(450, 750),
        age: 0,
        isShard: true
      });
    }

    // Confetti burst from inside the balloon
    for (let k = 0; k < 12; k++) {
      state.particles.push({
        x,
        y,
        vx: rand(-180, 180),
        vy: rand(-220, 120),
        rot: Math.random() * Math.PI * 2,
        vRot: rand(-12, 12),
        size: rand(4, 8),
        aspect: 0.6,
        color: pick(['#fff', '#fde047', '#38bdf8', '#f472b6', '#4ade80']),
        life: rand(500, 900),
        age: 0,
        isShard: false
      });
    }
  },

  render(state, ctx, frame, engine) {
    const W = frame.width;
    const H = frame.height;

    // --- Render Balloons with 3D Translucent Shading ---
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
      ctx.fillStyle = theme.dark;
      ctx.fill();

      // 3. Balloon 3D spherical latex body
      ctx.beginPath();
      // Realistic tapered balloon silhouette
      ctx.moveTo(0, -r * 1.08);
      ctx.bezierCurveTo(r * 1.12, -r * 1.08, r * 1.18, r * 0.35, r * 0.25, r * 1.04);
      ctx.quadraticCurveTo(0, r * 1.09, -r * 0.25, r * 1.04);
      ctx.bezierCurveTo(-r * 1.18, r * 0.35, -r * 1.12, -r * 1.08, 0, -r * 1.08);
      ctx.closePath();

      // 3D spherical gradient with ambient depth
      const grad = ctx.createRadialGradient(-r * 0.35, -r * 0.38, r * 0.08, 0, 0, r * 1.15);
      grad.addColorStop(0, theme.light);
      grad.addColorStop(0.38, theme.base);
      grad.addColorStop(0.85, theme.dark);
      grad.addColorStop(1, 'rgba(10, 10, 20, 0.65)');
      ctx.fillStyle = grad;
      ctx.fill();

      // Outer rim translucency glow
      ctx.strokeStyle = theme.rim;
      ctx.lineWidth = 2.2;
      ctx.stroke();

      // Golden aura for special balloons
      if (b.isGold) {
        ctx.strokeStyle = 'rgba(254, 240, 138, 0.85)';
        ctx.lineWidth = 3.5;
        ctx.stroke();
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

      ctx.restore();
    });

    // --- Render Popping Shards & Confetti Particles ---
    state.particles.forEach((p) => {
      const alpha = clamp(1 - p.age / p.life, 0, 1);
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;

      if (p.isShard) {
        // Curled jagged rubber shard
        ctx.beginPath();
        ctx.moveTo(-p.size * 0.5, -p.size * 0.2);
        ctx.lineTo(p.size * 0.5, -p.size * 0.4);
        ctx.lineTo(p.size * 0.2, p.size * 0.4);
        ctx.lineTo(-p.size * 0.4, p.size * 0.3);
        ctx.closePath();
        ctx.fill();
      } else {
        // Glitter confetti dot
        ctx.fillRect(-p.size / 2, -p.size * p.aspect / 2, p.size, p.size * p.aspect);
      }
      ctx.restore();
    });

    // --- Render Floating Score Popups ---
    state.popTexts.forEach((t) => {
      const a = clamp(1 - t.age / 900, 0, 1);
      ctx.save();
      ctx.font = 'bold 22px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.shadowColor = 'rgba(0,0,0,0.8)';
      ctx.shadowBlur = 6;
      ctx.fillStyle = t.color;
      ctx.globalAlpha = a;
      ctx.fillText(t.text, t.x, t.y);
      ctx.restore();
    });

    // --- Render Sharp Needle at Finger Coordinates ---
    const nx = state.needleX * W;
    const ny = state.needleY * H;
    const stabOffset = state.stabAnim * 12;

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
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    ctx.restore();

    // 1. Trailing red silk thread from needle eye
    ctx.beginPath();
    ctx.moveTo(0, 48);
    const threadWave = Math.sin((frame.time || performance.now()) * 0.008) * 8;
    ctx.bezierCurveTo(threadWave, 62, -threadWave, 78, threadWave * 0.5, 96);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // 2. Polished chrome needle blade (tapers to sharp 0,0 tip)
    ctx.beginPath();
    ctx.moveTo(0, 0); // Sharp needle point!
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

    // --- Finger Target Reticle (shows where optical tracking detects you) ---
    ctx.save();
    ctx.beginPath();
    ctx.arc(nx, ny, 16, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.stroke();
    ctx.restore();

    // --- On-Screen Game HUD ---
    ctx.save();
    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 6;
    ctx.fillText(`⏱️ ${Math.max(0, Math.ceil(state.timeLeft))}s`, 20, 20);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#fde047';
    ctx.fillText(`🎈 Popped: ${state.score}`, W - 20, 20);
    ctx.restore();

    // --- Interactive Instruction Demo Overlay ---
    if (state.demoTimer > 0 && !state.firstPopDone) {
      const alpha = Math.min(1, state.demoTimer / 800);
      ctx.save();
      ctx.globalAlpha = alpha;

      // Dark frosted banner
      const boxW = Math.min(460, W - 40);
      const boxH = 92;
      const boxX = (W - boxW) / 2;
      const boxY = H * 0.38;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.88)';
      ctx.strokeStyle = 'rgba(244, 63, 94, 0.6)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.roundRect(boxX, boxY, boxW, boxH, 16);
      ctx.fill();
      ctx.stroke();

      // Demo text & pointing finger animation
      const handBob = Math.sin((frame.time || performance.now()) * 0.008) * 8;
      ctx.font = '28px serif';
      ctx.textAlign = 'center';
      ctx.fillText('👉', boxX + 46 + handBob, boxY + 54);

      ctx.font = 'bold 17px Outfit, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillStyle = '#ffffff';
      ctx.fillText('Point your finger to guide the needle & pop balloons!', boxX + 80, boxY + 36);

      ctx.font = '13px Outfit, sans-serif';
      ctx.fillStyle = '#cbd5e1';
      ctx.fillText('Touch screen or move your hand in front of the camera', boxX + 80, boxY + 62);

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
  }
};
