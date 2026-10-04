/* WebcamClicks — GameManager.
   Games are def objects: { id, name, icon, description, usesFace,
   createState(), init(state, engine), update(state, dtMs, frame, engine),
   render(state, ctx, frame, engine), dispose(state, engine) }

   The `engine` is provided by app.js and offers:
   sound, endGame(score, win), setScore(n), setLives(n), message(title, sub),
   hideMessage(), width, height */

export class GameManager {
  constructor(engine) {
    this.engine = engine;
    this.games = new Map();
    this.current = null;
    this.state = null;
  }

  register(def) {
    if (!def || !def.id) return;
    this.games.set(def.id, def);
  }

  registerAll(defs) { defs.forEach((d) => this.register(d)); }

  list() { return [...this.games.values()]; }
  get(id) { return this.games.get(id) || null; }

  get active() { return !!this.current; }
  get currentId() { return this.current ? this.current.id : null; }
  get needsFace() { return !!(this.current && this.current.usesFace); }

  start(id) {
    const def = this.games.get(id);
    if (!def) return false;
    if (this.current) this._cleanup(false);
    this.current = def;
    this.state = def.createState ? def.createState() : {};
    if (this.engine.onStart) this.engine.onStart(def);
    if (def.init) def.init(this.state, this.engine);
    return true;
  }

  update(dt, frame) {
    if (!this.current) return;
    this.current.update(this.state, dt, frame, this.engine);
  }

  render(ctx, frame) {
    if (!this.current) return;
    this.current.render(this.state, ctx, frame, this.engine);
  }

  /** Called by a game via engine.endGame(score, win). */
  end(score, win) {
    if (!this.current) return;
    const def = this.current;
    this._cleanup(true);
    if (this.engine.onEnd) this.engine.onEnd(def, score, win);
  }

  /** Abort without end screen (user pressed exit). */
  abort() {
    if (!this.current) return;
    const def = this.current;
    this._cleanup(true);
    if (this.engine.onEnd) this.engine.onEnd(def, null, null);
  }

  _cleanup(fireStop) {
    const def = this.current;
    if (def && def.dispose) {
      try { def.dispose(this.state, this.engine); } catch { /* ignore */ }
    }
    this.current = null;
    this.state = null;
    if (fireStop && this.engine.onStop) this.engine.onStop(def);
  }
}

/* ---------- shared game helpers ---------- */

/** Face or motion steering: normalized x (0..1) or null. */
export function steerX(frame) {
  const box = frame.face && frame.face.box;
  if (box) return (box.x + box.width / 2) / frame.width;
  if (frame.motion && frame.motion.level > 0.03) return frame.motion.cx;
  return null;
}

export function dimStage(ctx, w, h, alpha = 0.55) {
  ctx.fillStyle = `rgba(5, 5, 12, ${alpha})`;
  ctx.fillRect(0, 0, w, h);
}

export function drawHearts(ctx, x, y, lives, size) {
  ctx.font = `${size}px serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('❤️'.repeat(Math.max(0, lives)), x, y);
}
