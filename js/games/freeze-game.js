/* WebcamClicks — Game: Freeze Pose.
   Hold your pose like a statue for 10 seconds. Any big movement resets
   your progress. Uses face tracking (with motion fallback). */

import { clamp } from '../utils.js';

export const freezePose = {
  id: 'freeze-pose',
  name: 'Freeze Pose',
  icon: '🧊',
  description: 'How still can you be? Hold your pose like a statue for 10 seconds to win.',
  usesFace: true,

  createState() {
    return {
      still: 0,
      need: 10,
      timeLeft: 40,
      last: null,
      status: 'waiting' /* waiting | still | moving | noface */
    };
  },

  init(state, engine) {
    engine.setScore(0);
    engine.setLives(null);
    engine.message('🧊 Freeze Pose', 'Stay perfectly still for 10 seconds. Any big movement resets the timer!', 2800);
  },

  update(state, dt, frame, engine) {
    state.timeLeft -= dt / 1000;
    if (state.timeLeft <= 0) {
      engine.endGame(Math.round(state.still * 10), false);
      return;
    }

    const box = frame.face.box;
    let cx = null;
    let cy = null;
    let faceMode = false;

    if (box) {
      cx = (box.x + box.width / 2) / frame.width;
      cy = (box.y + box.height / 2) / frame.height;
      faceMode = true;
    } else if (frame.motion && frame.motion.level > 0.02) {
      cx = frame.motion.cx;
      cy = frame.motion.cy;
    }

    if (cx == null) {
      state.status = 'noface';
      state.still = Math.max(0, state.still - (dt / 1000) * 2);
      state.last = null;
      return;
    }

    if (state.last) {
      const speed = Math.hypot(cx - state.last.x, cy - state.last.y) / (dt / 1000);
      const threshold = faceMode ? 0.11 : 0.24; /* screen-widths per second */
      if (speed < threshold) {
        state.still += dt / 1000;
        state.status = 'still';
      } else {
        state.still = Math.max(0, state.still - (dt / 1000) * 1.6);
        state.status = 'moving';
      }
    }
    state.last = { x: cx, y: cy };

    engine.setScore(Math.floor(state.still * 10));
    if (state.still >= state.need) {
      engine.endGame(100, true);
    }
  },

  render(state, ctx, frame, engine) {
    const w = frame.width;
    const h = frame.height;
    ctx.fillStyle = 'rgba(5, 5, 12, 0.5)';
    ctx.fillRect(0, 0, w, h);

    const progress = clamp(state.still / state.need, 0, 1);
    const cx = w / 2;
    const cy = h * 0.44;
    const R = h * 0.14;

    /* track */
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = h * 0.02;
    ctx.beginPath();
    ctx.arc(cx, cy, R, 0, Math.PI * 2);
    ctx.stroke();

    /* progress */
    const grad = ctx.createLinearGradient(cx - R, cy, cx + R, cy);
    grad.addColorStop(0, '#00cec9');
    grad.addColorStop(1, '#6c5ce7');
    ctx.strokeStyle = grad;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(cx, cy, R, -Math.PI / 2, -Math.PI / 2 + progress * Math.PI * 2);
    ctx.stroke();

    /* emoji + percent */
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const icon = state.status === 'still' ? '🧊' : state.status === 'noface' ? '🙈' : '💃';
    ctx.font = `${Math.round(h * 0.09)}px serif`;
    ctx.fillText(icon, cx, cy);
    ctx.font = `800 ${Math.round(h * 0.045)}px -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.fillText(`${Math.round(progress * 100)}%`, cx, cy + R + h * 0.055);

    /* status text */
    const msgs = {
      still: ["Hold it… don't move!", 'rgba(46,230,168,0.95)'],
      moving: ['You moved! Freeze again 🫣', 'rgba(255,209,102,0.95)'],
      noface: ['Show your face to the camera', 'rgba(255,209,102,0.95)'],
      waiting: ['Get ready…', 'rgba(255,255,255,0.9)']
    };
    const [msg, color] = msgs[state.status] || msgs.waiting;
    ctx.font = `700 ${Math.round(h * 0.04)}px -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = color;
    ctx.fillText(msg, cx, h * 0.8);

    /* timer */
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.font = `800 ${Math.round(h * 0.045)}px -apple-system, "Segoe UI", sans-serif`;
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillText(`⏱ ${Math.max(0, state.timeLeft).toFixed(0)}s`, w * 0.03, h * 0.04);
  },

  dispose(state, engine) {
    engine.setLives(null);
    engine.hideMessage();
  }
};
