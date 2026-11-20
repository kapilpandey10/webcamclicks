/* WebcamClicks — EffectManager.
   Registry + per-frame compositor for all visual effects with WebGL GPU acceleration. */

import { makeCanvas, isMobile } from '../utils.js';
import { gpuAccelerator } from './webgl-filters.js';

/** Only disable effects on mobile if WebGL acceleration is unavailable AND they use heavy CPU loops. */
export const MOBILE_FALLBACK_DISABLED = new Set([
  'ascii',
  'datamosh'
]);

/** Retired duplicate effects → the effect that replaced them.
    Keeps old share links (#effect=id), saved settings and favorites working. */
export const EFFECT_ALIASES = {
  upside_down: 'flip', cyberglitch: 'cyberpunk_hud', cyber_glitch_vhs: 'vhs', glitch: 'glitch_dimension',
  color_ghost: 'chromatic', neon_contour: 'neon', outline: 'neon', flir_thermal: 'thermal',
  spy_cam: 'nightvision', crosshatch: 'sketch', pop_booth: 'popart', lsd: 'liquid_rainbow',
  spectrum: 'liquid_rainbow', dent: 'pinch', spiral: 'twist', mono_quad: 'mirrorQuad',
  retrowave: 'synthwave_outrun', golden_flare: 'goldenhour', softblur: 'bright', hazy: 'promist',
  halo: 'bright', bloom: 'promist', trail: 'dreamtrails', ghost: 'dreamtrails', silverscreen: 'grayscale',
  zinc: 'grayscale', vintage: 'vintage70s', cocoa: 'sepia', filmgrain: 'super8', xpro: 'lomo',
  supernova_cosmic: 'celestial_nebula', bioluminescent: 'aurora_borealis', underwater_aquarium: 'aurora_borealis',
  berry: 'y2k_digicam', citrus: 'goldenhour', cocktail: 'dreamcore', danger: 'direct_flash',
  envy: 'risograph', glaze: 'dreamcore', hot_pink: 'risograph', mint: 'y2k_digicam', rose: 'dreamcore',
  silk: 'promist', true_blue: 'night_tungsten', switch: 'chromatic', shuffle: 'mosaic', wedge: 'normal',
  fragment: 'kaleidoscope', magazine: 'risograph', smoke: 'promist', filmstrip: 'super8',
  disco: 'disco_lasers', prism: 'diamond_prism',
  vignette: 'portra400', invert: 'neon', alien: 'thermal', xray: 'nightvision', scanlines: 'vhs',
  snow: 'dreamcore', sparkle: 'dreamcore', emojirain: 'normal', hearts: 'sunset_pink', ripple: 'twist',
  mirrorRight: 'mirrorLeft', mirrorTop: 'mirrorLeft', mirrorBottom: 'mirrorLeft', mirrorQuad: 'quadcam',
  split: 'mirrorLeft', flip: 'mirrorLeft', stretch: 'bulge', mosaic: 'dither', pixelate: 'dither',
  arcade8bit: 'dither', matrix: 'glitch_dimension', datamosh: 'pixel_sort', chromatic: 'glitch_dimension',
  motionblur: 'dreamtrails', anime: 'toon_shade', disco_lasers: 'neonnoir', blood_moon: 'film_noir_1940',
  celestial_nebula: 'vortex_blackhole', aurora_borealis: 'vortex_blackhole', golden_stardust: 'goldenhour',
  liquid_rainbow: 'vaporwave', diamond_prism: 'promist', y2k_fairy: 'y2k_digicam', inferno_embers: 'goldenhour',
  studioportrait: 'portraitbokeh'
};

export function resolveEffectId(id) {
  // follow chains (an effect retired in favour of one that was later retired too)
  for (let i = 0; i < 6 && EFFECT_ALIASES[id]; i++) id = EFFECT_ALIASES[id];
  return id;
}

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
    const e = typeof effectOrId === 'string' ? this.get(effectOrId) : effectOrId;
    if (!e) return false;
    if (isMobile()) {
      if (gpuAccelerator.canAccelerate(e.id)) return true;
      if (e.disabledOnMobile || e.desktopOnly || MOBILE_FALLBACK_DISABLED.has(e.id)) {
        return false;
      }
    }
    return true;
  }

  get(id) {
    return this.effects.get(id) || this.effects.get(resolveEffectId(id)) || null;
  }

  list() {
    if (isMobile()) {
      return this.ordered.filter((e) => this.isSupportedOnDevice(e));
    }
    return this.ordered;
  }

  categories() {
    const available = this.list();
    const cats = [...new Set(available.map((e) => e.category))];
    // Surface what's new first
    const order = ['Trending', 'Styles', 'Scenes', 'Face', 'Art', 'Distort'];
    return cats.sort((a, b) => (order.indexOf(a) + 1 || 99) - (order.indexOf(b) + 1 || 99));
  }

  set(id) {
    const e = this.get(id);
    if (!e) return false;
    if (isMobile() && !this.isSupportedOnDevice(e)) {
      return false;
    }
    if (this.current && typeof this.current.destroy === 'function') {
      try {
        this.current.destroy();
      } catch { /* ignore */ }
    }
    this.current = e;
    if (this.onChange) this.onChange(e);
    return true;
  }

  get requiresFace() {
    return !!(this.current && this.current.requiresFace);
  }

  /** Effect uses the face position when available but works without it (no face badge). */
  get followsFace() {
    return !!(this.current && this.current.followsFace);
  }

  get requiresMotion() {
    return !!(this.current && this.current.requiresMotion);
  }

  get currentName() {
    return this.current ? this.current.name : '';
  }

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

    // Normalize frame timestamps so both frame.time and frame.now are always valid numbers
    const nowMs = typeof frame.time === 'number' ? frame.time : (typeof frame.now === 'number' ? frame.now : performance.now());
    frame.time = nowMs;
    frame.now = nowMs;
    if (typeof frame.dt !== 'number') frame.dt = 16.7;

    if (e && e.id !== 'normal') {
      try {
        // Use WebGL GPU shader acceleration whenever available for pixel/distortion filters
        const usedGpu = gpuAccelerator.canAccelerate(e.id) &&
          gpuAccelerator.renderToContext(fx, src, w, h, e.id, nowMs, frame);

        if (!usedGpu) {
          e.render(fx, frame);
        }
      } catch (err) {
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

    const a = this.intensity;
    if (a >= 0.999) {
      ctx.drawImage(this.fx, 0, 0);
    } else if (a > 0) {
      ctx.drawImage(src, 0, 0, w, h);
      ctx.globalAlpha = a;
      ctx.drawImage(this.fx, 0, 0);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(src, 0, 0, w, h);
    }
  }
}