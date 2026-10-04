/* WebcamClicks — EffectManager.
   Registry + per-frame compositor for all visual effects.

   Rendering pipeline (per frame):
     1. frame.src  = work canvas (camera frame, already mirrored if needed)
     2. effect renders into `fx` (same size as the frame)
     3. manager composites:  display = src, then fx at `intensity` alpha
   Effects never touch the display canvas directly. */

import { makeCanvas } from '../utils.js';

export class EffectManager {
  constructor() {
    this.effects = new Map();
    this.ordered = [];
    this.current = null;
    this.intensity = 1;
    this.onChange = null;

    this.fx = makeCanvas(2, 2);
    this.fxCtx = this.fx.getContext('2d');
  }

  register(def) {
    if (!def || !def.id) return;
    if (this.effects.has(def.id)) return;
    this.effects.set(def.id, def);
    this.ordered.push(def);
  }

  registerAll(defs) {
    defs.forEach((d) => this.register(d));
  }

  get(id) { return this.effects.get(id) || null; }
  list() { return this.ordered; }
  categories() { return [...new Set(this.ordered.map((e) => e.category))]; }

  set(id) {
    const e = this.effects.get(id);
    if (!e) return false;
    this.current = e;
    if (this.onChange) this.onChange(e);
    return true;
  }

  get requiresFace() { return !!(this.current && this.current.requiresFace); }
  get currentName() { return this.current ? this.current.name : ''; }

  _resetFxContext(w, h) {
    if (this.fx.width !== w || this.fx.height !== h) {
      this.fx.width = w;
      this.fx.height = h;
    }
    const fx = this.fxCtx;
    fx.setTransform(1, 0, 0, 1, 0, 0);
    fx.globalAlpha = 1;
    fx.globalCompositeOperation = 'source-over';
    fx.filter = 'none';
    fx.clearRect(0, 0, w, h);
    return fx;
  }

  /** Render one frame onto the display context. */
  render(ctx, frame) {
    const { src, width: w, height: h } = frame;
    const fx = this._resetFxContext(w, h);

    const e = this.current;
    if (e) {
      try {
        e.render(fx, frame);
      } catch (err) {
        /* An effect must never kill the loop — fall back to a clean frame. */
        console.warn('[WebcamClicks] effect error:', e.id, err);
        fx.setTransform(1, 0, 0, 1, 0, 0);
        fx.globalAlpha = 1;
        fx.globalCompositeOperation = 'source-over';
        fx.filter = 'none';
        fx.drawImage(src, 0, 0, w, h);
      }
    } else {
      fx.drawImage(src, 0, 0, w, h);
    }

    /* Composite to the display canvas */
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.filter = 'none';
    ctx.clearRect(0, 0, w, h);
    ctx.drawImage(src, 0, 0, w, h);

    const a = this.intensity;
    if (a >= 0.999) {
      ctx.drawImage(this.fx, 0, 0);
    } else if (a > 0) {
      ctx.globalAlpha = a;
      ctx.drawImage(this.fx, 0, 0);
      ctx.globalAlpha = 1;
    }
  }
}
