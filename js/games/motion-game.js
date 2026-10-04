/* WebcamClicks — Game: Motion Catch.
   Steer the basket with your face (or body movement) and catch the falling
   fruit. Golden stars are worth 5 points; bombs cost a life. */

import { rand, pick, clamp } from '../utils.js';
import { steerX, dimStage, drawHearts } from './GameManager.js';

const FRUIT = ['🍎', '🍌', '🍇', '🍓', '🍊', '🥝'];

export const motionCatch = {
  id: 'motion-catch',
  name: 'Motion Catch',
  icon: '🧺',
  description: 'Steer the basket with your head or body to catch falling fruit. Dodge the bombs!',
  usesFace: true,
  duration: 45,

  createState() {
    return {
      timeLeft: 45,
      score: 0,
      lives: 3,
      items: [],
      basket: 0.5,
      target: 0.5,
      spawnIn: 600,
      hintShown: false
    };
  },

  init(state, engine) {
    engine.setScore(0);
    engine.setLives(3);
    engine.message('🧺 Motion Catch', 'Move your head / body to steer the basket. Catch fruit, dodge 💣!', 2600);
  },

  update(state, dt, frame, engine) {
    state.timeLeft -= dt / 1000;
    if (state.timeLeft <= 0 || state.lives <= 0) {
      const win = state.score >= 10;
      engine.endGame(state.score, win);
      return;
    }

    const tx = steerX(frame);
    if (tx != null) state.target = clamp(tx, 0.06, 0.94);
    const follow = Math.min(1, (dt / 1000) * 7);
    state.basket += (state.target - state.basket) * follow;

    state.spawnIn -= dt;
    if (state.spawnIn <= 0) {
      state.spawnIn = rand(420, 850) * (state.timeLeft < 12 ? 0.7 : 1);
      const bomb = Math.random() < 0.22;
      state.items.push({
        x: rand(0.08, 0.92),
        y: -0.06,
        vy: rand(0.00022, 0.0004) * (1 + (45 - state.timeLeft) * 0.012),
        emoji: bomb ? '💣' : pick(FRUIT),
        points: bomb ? -1 : (Math.random() < 0.12 ? 5 : 1)
      });
    }

    for (let i = state.items.length - 1; i >= 0; i--) {
      const it = state.items[i];
      it.y += it.vy * dt;

      const inCatchZone = it.y >= 0.84 && it.y <= 0.98;
      if (inCatchZone && Math.abs(it.x - state.basket) < 0.11) {
        state.items.splice(i, 1);
        if (it.points < 0) {
          state.lives--;
          engine.setLives(state.lives);
          engine.sound.fail();
        } else {
          state.score += it.points;
          engine.setScore(state.score);
          engine.sound.score(state.score);
        }
      } else if (it.y > 1.06) {
        state.items.splice(i, 1);
        if (it.points > 0) {
          state.lives--;
          engine.setLives(state.lives);
          engine.sound.miss();
        }
      }
    }
  },

  render(state, ctx, frame, engine) {
    const w = frame.width;
    const h = frame.height;
    dimStage(ctx, w, h, 0.55);

    /* items */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `${Math.round(h * 0.075)}px serif`;
    for (const it of state.items) {
      ctx.fillText(it.emoji, it.x * w, it.y * h);
    }

    /* basket */
    const bx = state.basket * w;
    const by = h * 0.9;
    ctx.font = `${Math.round(h * 0.11)}px serif`;
    ctx.fillText('🧺', bx, by);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(bx - w * 0.11, by + h * 0.045);
    ctx.lineTo(bx + w * 0.11, by + h * 0.045);
    ctx.stroke();

    /* HUD */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${Math.round(h * 0.045)}px -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(`⏱ ${Math.max(0, state.timeLeft).toFixed(0)}s`, w * 0.03, h * 0.04);
    drawHearts(ctx, w * 0.03, h * 0.115, state.lives, Math.round(h * 0.04));

    if (!state.hintShown && !frame.face.hasFace) {
      ctx.textAlign = 'center';
      ctx.font = `600 ${Math.round(h * 0.032)}px -apple-system, sans-serif`;
      ctx.fillStyle = 'rgba(255,220,120,0.9)';
      ctx.fillText('Center your face in the frame — or move to steer!', w / 2, h * 0.9);
    }
  },

  dispose(state, engine) {
    engine.hideMessage();
  }
};
