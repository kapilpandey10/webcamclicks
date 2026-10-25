/* WebcamClicks — EffectManager.
   Registry + per-frame compositor for all visual effects.

   Rendering pipeline (per frame):
     1. frame.src  = work canvas (camera frame, already mirrored if needed)
     2. effect renders into `fx` (same size as the frame)
     3. manager composites:  display = src, then fx at `intensity` alpha
   Effects never touch the display canvas directly. */

import { makeCanvas, isMobile } from '../utils.js';

/** Effects that require heavy neural nets or unbuffered full-frame CPU pixel convolution,
 *  which cause browser crashes, freezes, or massive lag on mobile phones. */
export const MOBILE_DISABLED_EFFECTS = new Set([
  // Heavy Neural Networks that crash/fail on mobile WebGL:
  'agegender',        // Age & Gender (requires heavy ageGenderNet)
  'emotion',          // Emotion Meter (requires heavy faceExpressionNet)
  'facemesh',         // Face Mesh (74 vertices + 100+ triangles per frame)

  // Heavy CPU Pixel Convolution / Loops that freeze mobile:
  'neon_contour',     // Neon Cyber Contour (Sobel kernel convolution)
  'flir_thermal',     // Military FLIR Predator (pixel thermal mapping)
  'liquid_rainbow',   // Liquid Rainbow Chrome (thin-film trig pixel loop)
  'comic',            // Comic Book (allocates Float32Array on every frame)
  'sketch',           // Pencil Sketch (allocates Float32Array on every frame)
  'watercolor',       // Watercolor (unbuffered full-frame pixel quantization)
  'ascii',            // ASCII Art (thousands of fillText calls per frame)
  'datamosh',         // Datamosh FX (excessive frame buffer memory allocation)
  'faceblur',         // Blur Background (destination-in blur crashes Safari canvas)
  'xray',             // X-Ray (high-cost per-pixel inversion)
  'alien',            // Alien (high-cost per-pixel remapping)
  'nightvision',      // Night Vision (per-pixel phosphor loop)
  'filmgrain',        // Film Grain (heavy random noise loop per pixel)
  'cocoa',            // Cocoa (unbuffered per-pixel math)
  'thermal',          // Thermal (full-frame per-pixel loop)
  'neon',             // Neon Glow (per-pixel loop)
  'popart'            // Pop Art (per-pixel loop)
]);

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

  isSupportedOnDevice(effectOrId) {
    const e = typeof effectOrId === 'string' ? this.effects.get(effectOrId) : effectOrId;
    if (!e) return false;
    if (isMobile()) {
      if (e.disabledOnMobile || e.desktopOnly || MOBILE_DISABLED_EFFECTS.has(e.id)) {
        return false;
      }
    }
    return true;
  }

  get(id) { return this.effects.get(id) || null; }

  list() {
    if (isMobile()) {
      return this.ordered.filter((e) => this.isSupportedOnDevice(e));
    }
    return this.ordered;
  }

  categories() {
    const available = this.list();
    return [...new Set(available.map((e) => e.category))];
  }

  set(id) {
    const e = this.effects.get(id);
    if (!e) return false;
    if (isMobile() && !this.isSupportedOnDevice(e)) {
      console.warn(`[WebcamClicks] Effect '${id}' is optimized for desktop and disabled on mobile.`);
      return false;
    }
    // Clean up previous effect (e.g. stop audio nodes, free resources)
    if (this.current && typeof this.current.destroy === 'function') {
      try { this.current.destroy(); } catch { /* ignore */ }
    }
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
