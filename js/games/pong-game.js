/* WebcamClicks — Game: Face Pong.
   Your face (or body movement) controls the paddle. Bounce the ball,
   smash all 5 bricks to win. 3 lives. */

import { rand, clamp } from '../utils.js';
import { steerX, dimStage, drawHearts } from './GameManager.js';

const SPEED = 0.00042; /* normalized units per ms */

export const facePong = {
  id: 'face-pong',
  name: 'Face Pong',
  icon: '🏓',
  description: 'Your face moves the paddle. Keep the ball alive and smash all 5 bricks to win!',
  usesFace: true,

  createState() {
    return {
      ball: { x: 0.5, y: 0.32, vx: rand(0.25, 0.5) * SPEED * (Math.random() < 0.5 ? 1 : -1), vy: SPEED * 0.9, trail: [] },
      paddle: 0.5,
      target: 0.5,
      score: 0,
      lives: 3,
      bricks: [0.14, 0.32, 0.5, 0.68, 0.86].map((x) => ({ x, alive: true })),
      flash: 0
    };
  },

  init(state, engine) {
    engine.setScore(0);
    engine.setLives(3);
    engine.message('🏓 Face Pong', 'Move your head to slide the paddle. Clear all 5 bricks!', 2600);
  },

  update(state, dt, frame, engine) {
    dt = clamp(dt, 0, 40);
    state.flash = Math.max(0, state.flash - dt);

    const tx = steerX(frame);
    if (tx != null) state.target = clamp(tx, 0.08, 0.92);
    state.paddle += (state.target - state.paddle) * Math.min(1, (dt / 1000) * 8);

    const b = state.ball;
    const r = 0.02;
    b.x += b.vx * dt;
    b.y += b.vy * dt;

    b.trail.push({ x: b.x, y: b.y });
    if (b.trail.length > 9) b.trail.shift();

    /* walls */
    if (b.x < r) { b.x = r; b.vx = Math.abs(b.vx); }
    if (b.x > 1 - r) { b.x = 1 - r; b.vx = -Math.abs(b.vx); }
    if (b.y < r) { b.y = r; b.vy = Math.abs(b.vy); }

    /* bricks */
    if (b.vy < 0 && b.y - r < 0.17 && b.y > 0.05) {
      for (const br of state.bricks) {
        if (!br.alive) continue;
        if (Math.abs(b.x - br.x) < 0.085) {
          br.alive = false;
          b.vy = Math.abs(b.vy);
          b.y = 0.17 + r;
          state.score += 2;
          state.flash = 160;
          engine.setScore(state.score);
          engine.sound.pop();
          if (state.bricks.every((x) => !x.alive)) {
            engine.endGame(state.score, true);
            return;
          }
          break;
        }
      }
    }

    /* paddle */
    const py = 0.93;
    if (b.vy > 0 && b.y + r >= py && b.y < py + 0.06 && Math.abs(b.x - state.paddle) < 0.14) {
      b.vy = -Math.abs(b.vy) * 1.02;
      b.vx = clamp(b.vx + (b.x - state.paddle) * 0.0018, -0.00075, 0.00075);
      b.y = py - r;
      state.score += 1;
      engine.setScore(state.score);
      engine.sound.score(state.score);
    }

    /* miss */
    if (b.y - r > 1.04) {
      state.lives--;
      engine.setLives(state.lives);
      engine.sound.miss();
      if (state.lives <= 0) {
        engine.endGame(state.score, false);
        return;
      }
      b.x = 0.5;
      b.y = 0.4;
      b.vx = rand(0.25, 0.5) * SPEED * (Math.random() < 0.5 ? 1 : -1);
      b.vy = -SPEED * 0.85;
      b.trail = [];
    }
  },

  render(state, ctx, frame, engine) {
    const w = frame.width;
    const h = frame.height;
    dimStage(ctx, w, h, 0.55);
    const b = state.ball;

    if (state.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${(state.flash / 160) * 0.14})`;
      ctx.fillRect(0, 0, w, h);
    }

    /* bricks */
    for (const br of state.bricks) {
      if (!br.alive) continue;
      const bw = 0.13;
      ctx.fillStyle = 'rgba(108, 92, 231, 0.95)';
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect((br.x - bw / 2) * w, h * 0.08, bw * w, h * 0.07, h * 0.02) : ctx.rect((br.x - bw / 2) * w, h * 0.08, bw * w, h * 0.07);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    /* ball trail */
    for (let i = 0; i < b.trail.length; i++) {
      const t = b.trail[i];
      const k = (i + 1) / b.trail.length;
      ctx.fillStyle = `rgba(0, 206, 201, ${0.25 * k})`;
      ctx.beginPath();
      ctx.arc(t.x * w, t.y * h, 0.02 * h * k * 1.5, 0, Math.PI * 2);
      ctx.fill();
    }

    /* ball */
    ctx.fillStyle = '#00cec9';
    ctx.beginPath();
    ctx.arc(b.x * w, b.y * h, 0.021 * h * 1.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(b.x * w - 3, b.y * h - 3, 0.006 * h, 0, Math.PI * 2);
    ctx.fill();

    /* paddle (with face hint) */
    const px = state.paddle * w;
    const pw = 0.24 * w;
    ctx.fillStyle = '#ff5e6c';
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(px - pw / 2, h * 0.93, pw, h * 0.03, h * 0.015);
    else ctx.rect(px - pw / 2, h * 0.93, pw, h * 0.03);
    ctx.fill();
    ctx.font = `${Math.round(h * 0.035)}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('😎', px, h * 0.945);

    /* HUD */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    drawHearts(ctx, w * 0.03, h * 0.04, state.lives, Math.round(h * 0.04));
  },

  dispose(state, engine) {
    engine.hideMessage();
  }
};
