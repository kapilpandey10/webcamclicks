/* WebcamClicks — portraitbokeh 2D filter effect
   Premium multi-pass depth-of-field with animated hexagonal bokeh highlights,
   warm halation bloom, and smooth face-tracked subject isolation. */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';

/* ── Persistent state ─────────────────────────────────────────────── */
let _st = null;            // smoothed face tracking state
let _maskCanvas = null;    // offscreen for subject mask compositing
let _blurCanvas = null;    // offscreen for progressive blur passes
let _bokehOrbs = null;     // persistent bokeh disc pool

/* ── Hexagonal bokeh aperture path ────────────────────────────────── */
function hexagonPath(ctx, cx, cy, r, rotation = 0) {
  const sides = 7; // 7-blade aperture (slightly rounded heptagon for organic feel)
  ctx.beginPath();
  for (let i = 0; i <= sides; i++) {
    const a = rotation + (Math.PI * 2 * i) / sides - Math.PI / 2;
    const wobble = 1 + Math.sin(a * 3) * 0.04; // slight organic irregularity
    const px = cx + r * wobble * Math.cos(a);
    const py = cy + r * wobble * Math.sin(a);
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

/* ── Initialize / refresh bokeh orb pool ──────────────────────────── */
function ensureBokehOrbs(w, h, count = 22) {
  if (_bokehOrbs && _bokehOrbs.length === count && _bokehOrbs._w === w) return _bokehOrbs;

  _bokehOrbs = [];
  _bokehOrbs._w = w;
  // Warm / cool / neutral tint palette for cinematic bokeh
  const palette = [
    [255, 235, 180],  // warm gold
    [255, 220, 160],  // amber
    [200, 235, 255],  // cool sky
    [255, 200, 210],  // blush pink
    [220, 255, 230],  // mint
    [240, 210, 255],  // lavender
    [255, 250, 240],  // cream white
    [180, 220, 255],  // soft blue
    [255, 210, 170],  // peach
  ];

  for (let i = 0; i < count; i++) {
    const color = palette[(Math.random() * palette.length) | 0];
    _bokehOrbs.push({
      // Position biased toward edges (avoid centre where subject is)
      x: rand(0, 1),
      y: rand(0, 1),
      edgeBias: rand(0.55, 1),  // how far from centre (used to push toward edges)
      r: rand(12, 55),
      baseAlpha: rand(0.06, 0.22),
      color,
      phase: rand(0, Math.PI * 2),
      driftSpeed: rand(0.15, 0.55),
      driftAmpX: rand(5, 18),
      driftAmpY: rand(4, 14),
      rotSpeed: rand(-0.3, 0.3),
      rotation: rand(0, Math.PI * 2),
      // Depth layer: controls blur and size scaling
      depth: rand(0.3, 1),
      pulseSpeed: rand(0.8, 2.5),
      pulseAmp: rand(0.05, 0.15),
    });
  }
  return _bokehOrbs;
}

/* ── Ensure offscreen canvases ────────────────────────────────────── */
function ensureCanvas(ref, w, h) {
  if (!ref || ref.width !== w || ref.height !== h) {
    ref = makeCanvas(w, h);
    ref._ctx = ref.getContext('2d');
  }
  return ref;
}

export const portraitbokehEffect = {
  id: 'portraitbokeh',
  name: 'Portrait Bokeh',
  icon: '👤',
  category: 'Portrait',
  perf: 'low',
  requiresFace: true,

  render(fx, frame) {
    const { src, width: w, height: h, face } = frame;
    const t = (frame.time || performance.now()) * 0.001;

    // ────────────────────────────────────────────────────
    // 1. FACE TRACKING — smooth elliptical subject region
    // ────────────────────────────────────────────────────
    let targetCx = w / 2;
    let targetCy = h * 0.46;
    let targetRx = w * 0.27;
    let targetRy = h * 0.44;

    const box = face && face.box;
    if (box && box.width > 20) {
      targetCx = box.x + box.width / 2;
      // Shift down so mask covers shoulders+torso
      targetCy = box.y + box.height * 0.62;
      targetRx = Math.max(w * 0.2, box.width * 1.15);
      targetRy = Math.max(h * 0.35, box.height * 1.85);
    }

    // Exponential smoothing for buttery tracking
    if (!_st) {
      _st = { cx: targetCx, cy: targetCy, rx: targetRx, ry: targetRy };
    } else {
      const dt = clamp(frame.dt || 16.7, 1, 60);
      const al = 1 - Math.exp(-dt / 120); // ~120ms time constant for very smooth tracking
      _st.cx = lerp(_st.cx, targetCx, al);
      _st.cy = lerp(_st.cy, targetCy, al);
      _st.rx = lerp(_st.rx, targetRx, al);
      _st.ry = lerp(_st.ry, targetRy, al);
    }
    const { cx, cy, rx, ry } = _st;

    // ────────────────────────────────────────────────────
    // 2. BACKGROUND LAYER — progressive multi-pass blur
    // ────────────────────────────────────────────────────

    // Pass 1: Medium blur (simulates mid-ground defocus)
    fx.save();
    fx.filter = 'blur(8px) saturate(1.08)';
    fx.drawImage(src, 0, 0, w, h);
    fx.restore();

    // Pass 2: Heavy blur over the top (deep background)
    // Use a radial mask to only apply the heaviest blur far from subject
    _blurCanvas = ensureCanvas(_blurCanvas, w, h);
    const bx = _blurCanvas._ctx;
    bx.setTransform(1, 0, 0, 1, 0, 0);
    bx.clearRect(0, 0, w, h);
    bx.filter = 'blur(22px) brightness(0.97) saturate(1.12)';
    bx.drawImage(src, 0, 0, w, h);
    bx.filter = 'none';

    // Mask: fully visible outside the subject ellipse, transparent at centre
    bx.globalCompositeOperation = 'destination-in';
    const depthMask = bx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.6, cx, cy, Math.max(rx, ry) * 1.3);
    depthMask.addColorStop(0, 'rgba(0,0,0,0)');
    depthMask.addColorStop(0.45, 'rgba(0,0,0,0.15)');
    depthMask.addColorStop(0.7, 'rgba(0,0,0,0.7)');
    depthMask.addColorStop(1, 'rgba(0,0,0,1)');
    bx.fillStyle = depthMask;
    bx.fillRect(0, 0, w, h);
    bx.globalCompositeOperation = 'source-over';

    fx.drawImage(_blurCanvas, 0, 0);

    // ────────────────────────────────────────────────────
    // 3. ANIMATED BOKEH HIGHLIGHTS
    // ────────────────────────────────────────────────────
    const orbs = ensureBokehOrbs(w, h);

    fx.save();
    fx.globalCompositeOperation = 'screen';

    for (let i = 0; i < orbs.length; i++) {
      const o = orbs[i];

      // Push orbs away from the subject centre (they belong in the blurred BG)
      const baseX = o.x * w;
      const baseY = o.y * h;
      const toCx = baseX - cx;
      const toCy = baseY - cy;
      const distFromCentre = Math.hypot(toCx, toCy) || 1;
      const pushDir = { x: toCx / distFromCentre, y: toCy / distFromCentre };
      const push = o.edgeBias * Math.max(rx, ry) * 0.4;

      // Animated drift
      const driftX = Math.sin(t * o.driftSpeed + o.phase) * o.driftAmpX;
      const driftY = Math.cos(t * o.driftSpeed * 0.7 + o.phase + 1) * o.driftAmpY;

      const orbX = baseX + pushDir.x * push + driftX;
      const orbY = baseY + pushDir.y * push + driftY;

      // Size pulsing
      const pulse = 1 + Math.sin(t * o.pulseSpeed + o.phase) * o.pulseAmp;
      const orbR = o.r * o.depth * pulse;

      // Fade orbs that are too close to subject
      const dToSubject = Math.hypot((orbX - cx) / rx, (orbY - cy) / ry);
      const proximityFade = clamp((dToSubject - 0.7) / 0.5, 0, 1);
      const alpha = o.baseAlpha * proximityFade;

      if (alpha < 0.01) continue;

      o.rotation += o.rotSpeed * 0.016;
      const [cr, cg, cb] = o.color;

      // Filled hexagonal bokeh with radial gradient
      const grad = fx.createRadialGradient(orbX, orbY, orbR * 0.1, orbX, orbY, orbR);
      grad.addColorStop(0, `rgba(${cr},${cg},${cb},${alpha * 0.9})`);
      grad.addColorStop(0.6, `rgba(${cr},${cg},${cb},${alpha * 0.5})`);
      grad.addColorStop(0.85, `rgba(${cr},${cg},${cb},${alpha * 0.25})`);
      grad.addColorStop(1, `rgba(${cr},${cg},${cb},0)`);
      fx.fillStyle = grad;
      hexagonPath(fx, orbX, orbY, orbR, o.rotation);
      fx.fill();

      // Bright rim ring (cat-eye highlight on aperture edge)
      fx.strokeStyle = `rgba(${Math.min(255, cr + 30)},${Math.min(255, cg + 20)},${Math.min(255, cb + 20)},${alpha * 0.4})`;
      fx.lineWidth = clamp(orbR * 0.08, 0.8, 3);
      fx.stroke();
    }
    fx.restore();

    // ────────────────────────────────────────────────────
    // 4. SHARP SUBJECT LAYER — masked with feathered ellipse
    // ────────────────────────────────────────────────────
    _maskCanvas = ensureCanvas(_maskCanvas, w, h);
    const mx = _maskCanvas._ctx;
    mx.setTransform(1, 0, 0, 1, 0, 0);
    mx.clearRect(0, 0, w, h);

    // Draw the sharp source
    mx.filter = 'contrast(1.03) saturate(1.06)';
    mx.drawImage(src, 0, 0, w, h);
    mx.filter = 'none';

    // Feathered elliptical mask
    mx.globalCompositeOperation = 'destination-in';
    const subjectMask = mx.createRadialGradient(
      cx, cy, Math.min(rx, ry) * 0.35,
      cx, cy, Math.max(rx, ry) * 1.05
    );
    subjectMask.addColorStop(0, 'rgba(0,0,0,1)');
    subjectMask.addColorStop(0.55, 'rgba(0,0,0,1)');
    subjectMask.addColorStop(0.78, 'rgba(0,0,0,0.85)');
    subjectMask.addColorStop(0.92, 'rgba(0,0,0,0.3)');
    subjectMask.addColorStop(1, 'rgba(0,0,0,0)');
    mx.fillStyle = subjectMask;
    mx.beginPath();
    mx.ellipse(cx, cy, rx * 1.05, ry * 1.05, 0, 0, Math.PI * 2);
    mx.fill();
    mx.globalCompositeOperation = 'source-over';

    // Composite sharp subject on top of blurred BG
    fx.drawImage(_maskCanvas, 0, 0);

    // ────────────────────────────────────────────────────
    // 5. WARM HALATION / PORTRAIT BLOOM
    // ────────────────────────────────────────────────────
    fx.save();
    fx.globalCompositeOperation = 'soft-light';

    // Warm centre glow (simulates a pro portrait reflector)
    const bloom = fx.createRadialGradient(cx, cy, 8, cx, cy, rx * 1.4);
    bloom.addColorStop(0, 'rgba(255, 245, 225, 0.30)');
    bloom.addColorStop(0.35, 'rgba(255, 235, 210, 0.18)');
    bloom.addColorStop(0.7, 'rgba(255, 225, 195, 0.06)');
    bloom.addColorStop(1, 'rgba(0,0,0,0)');
    fx.fillStyle = bloom;
    fx.fillRect(0, 0, w, h);

    fx.restore();

    // ────────────────────────────────────────────────────
    // 6. SUBTLE EDGE VIGNETTE (draws eye to subject)
    // ────────────────────────────────────────────────────
    fx.save();
    fx.globalCompositeOperation = 'multiply';
    const vig = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(255,255,255,1)');
    vig.addColorStop(0.5, 'rgba(255,255,255,1)');
    vig.addColorStop(0.85, 'rgba(240,235,230,1)');
    vig.addColorStop(1, 'rgba(180,170,160,1)');
    fx.fillStyle = vig;
    fx.fillRect(0, 0, w, h);
    fx.restore();

    // ────────────────────────────────────────────────────
    // 7. MICRO FILM GRAIN (adds photographic texture)
    // ────────────────────────────────────────────────────
    fx.save();
    fx.globalCompositeOperation = 'overlay';
    fx.globalAlpha = 0.04;
    // Procedural noise via tiny random rects (cheap & effective)
    const grainSize = isMobile() ? 6 : 4;
    for (let gy = 0; gy < h; gy += grainSize) {
      for (let gx = 0; gx < w; gx += grainSize) {
        const v = (Math.random() * 128 + 64) | 0;
        fx.fillStyle = `rgb(${v},${v},${v})`;
        fx.fillRect(gx, gy, grainSize, grainSize);
      }
    }
    fx.restore();
  }
};

export default portraitbokehEffect;
