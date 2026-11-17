/* WebcamClicks — Snapchat-Style GPU Liquify, Beauty & Expression Lenses (snapchat-lenses.js)
   Features:
   - Multi-point WebGL GPU Liquify displacement (radial bloat/pinch + directional skin drag)
   - Edge-preserving bilateral skin smoothing (keeps lashes, brows, and hair razor-sharp)
   - Eye-clipped iris color contacts that disappear naturally when you blink
   - 52-Blendshape expression triggers (mouth open, blink, eyebrow raise, smile) */

import { clamp, rand } from '../utils.js';
import { snapTracker } from '../face/snap-tracker.js';

const VERT_SRC = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAG_SRC = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif

  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform vec4 uFaceOval;      // xy = center UV, zw = rx, ry
  uniform float uSmooth;       // 0.0..1.0 bilateral skin retouch
  uniform float uWarmth;       // -0.2..0.3 color grade warmth
  uniform float uContrast;     // 0.9..1.35 contrast
  uniform float uSaturation;   // 0.5..1.5 saturation
  uniform vec4 uWarp[10];      // xy = center UV, z = radius, w = radial strength (+bloat, -pinch)
  uniform vec2 uPush[10];      // xy = directional drag vector in UV space

  vec3 sampleSafe(vec2 uv) {
    return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;
  }

  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  void main() {
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 uv = vUv;

    // 1. Multi-Point GPU Liquify / Face Morph Warp
    for (int i = 0; i < 10; i++) {
      vec4 w = uWarp[i];
      if (w.z > 0.001) {
        vec2 diff = (uv - w.xy) * vec2(aspect, 1.0);
        float dist = length(diff);
        if (dist < w.z) {
          float t = 1.0 - dist / w.z;
          float falloff = t * t * (3.0 - 2.0 * t);
          // Radial bloat (+w.w) or pinch (-w.w)
          uv -= (diff * (falloff * w.w)) / vec2(aspect, 1.0);
          // Directional skin drag (e.g. crying frown, giga-jaw pull)
          uv -= uPush[i] * falloff;
        }
      }
    }

    vec3 col = sampleSafe(uv);

    // 2. Edge-Preserving Bilateral Skin Smoothing (inside face oval only)
    if (uSmooth > 0.01 && uFaceOval.z > 0.01) {
      vec2 fd = (uv - uFaceOval.xy) / uFaceOval.zw;
      float faceMask = smoothstep(1.15, 0.65, length(fd));
      if (faceMask > 0.01) {
        vec2 px = 2.6 / uRes;
        vec3 acc = col;
        float wSum = 1.0;

        vec2 offs[8];
        offs[0] = vec2( 1.0,  0.0);
        offs[1] = vec2(-1.0,  0.0);
        offs[2] = vec2( 0.0,  1.0);
        offs[3] = vec2( 0.0, -1.0);
        offs[4] = vec2( 1.4,  1.4);
        offs[5] = vec2(-1.4,  1.4);
        offs[6] = vec2( 1.4, -1.4);
        offs[7] = vec2(-1.4, -1.4);

        for (int i = 0; i < 8; i++) {
          vec3 s = sampleSafe(uv + offs[i] * px);
          vec3 dc = s - col;
          // Range kernel preserves sharp edges (eyelashes, brows, nostrils)
          float weight = exp(-dot(dc, dc) * 28.0);
          acc += s * weight;
          wSum += weight;
        }

        vec3 blurred = acc / wSum;
        // Subtle glow lift on smoothed skin
        blurred = mix(blurred, pow(blurred, vec3(0.94)), 0.35);
        col = mix(col, blurred, uSmooth * faceMask);
      }
    }

    // 3. Filmic Studio Color Grade
    float l = luma(col);
    col = mix(vec3(l), col, uSaturation);
    col = (col - 0.5) * uContrast + 0.5;
    col += vec3(uWarmth * 0.14, uWarmth * 0.04, -uWarmth * 0.09);

    gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
  }
`;

/* Shared WebGL context for all Snapchat lenses */
let _gpu = null;
function getSnapGPU() {
  if (_gpu !== null) return _gpu;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false }) ||
      canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) { _gpu = false; return false; }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };
    const vs = compile(gl.VERTEX_SHADER, VERT_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FRAG_SRC);
    if (!vs || !fs) { _gpu = false; return false; }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) { _gpu = false; return false; }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    _gpu = {
      canvas,
      gl,
      prog,
      tex,
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uFaceOval: gl.getUniformLocation(prog, 'uFaceOval'),
      uSmooth: gl.getUniformLocation(prog, 'uSmooth'),
      uWarmth: gl.getUniformLocation(prog, 'uWarmth'),
      uContrast: gl.getUniformLocation(prog, 'uContrast'),
      uSaturation: gl.getUniformLocation(prog, 'uSaturation'),
      uWarp: gl.getUniformLocation(prog, 'uWarp[0]'),
      uPush: gl.getUniformLocation(prog, 'uPush[0]'),
      warpArr: new Float32Array(40),
      pushArr: new Float32Array(20)
    };
    return _gpu;
  } catch {
    _gpu = false;
    return false;
  }
}

function runWarpPass(fx, src, w, h, cfg) {
  const gpu = getSnapGPU();
  if (!gpu) {
    fx.drawImage(src, 0, 0, w, h);
    return;
  }
  const { canvas, gl, prog, tex, warpArr, pushArr } = gpu;
  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
    gl.viewport(0, 0, w, h);
  }

  warpArr.fill(0);
  pushArr.fill(0);
  const warps = cfg.warps || [];
  for (let i = 0; i < Math.min(10, warps.length); i++) {
    const wp = warps[i];
    warpArr[i * 4]     = wp.x;
    warpArr[i * 4 + 1] = wp.y;
    warpArr[i * 4 + 2] = wp.r;
    warpArr[i * 4 + 3] = wp.s || 0;
    pushArr[i * 2]     = wp.px || 0;
    pushArr[i * 2 + 1] = wp.py || 0;
  }

  gl.useProgram(prog);
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

  gl.uniform2f(gpu.uRes, w, h);
  const ov = cfg.oval || [0.5, 0.5, 0, 0];
  gl.uniform4f(gpu.uFaceOval, ov[0], ov[1], ov[2], ov[3]);
  gl.uniform1f(gpu.uSmooth, cfg.smooth || 0);
  gl.uniform1f(gpu.uWarmth, cfg.warmth || 0);
  gl.uniform1f(gpu.uContrast, cfg.contrast || 1.0);
  gl.uniform1f(gpu.uSaturation, cfg.saturation || 1.0);
  gl.uniform4fv(gpu.uWarp, warpArr);
  gl.uniform2fv(gpu.uPush, pushArr);

  gl.drawArrays(gl.TRIANGLES, 0, 6);
  fx.drawImage(canvas, 0, 0, w, h);
}

/* MediaPipe 478-point landmark loops */
const LEFT_EYE_LOOP = [33, 7, 163, 144, 145, 153, 154, 155, 133, 173, 157, 158, 159, 160, 161, 246];
const RIGHT_EYE_LOOP = [362, 382, 381, 380, 374, 373, 390, 249, 263, 466, 388, 387, 386, 385, 384, 398];
const OUTER_LIPS = [61, 185, 40, 39, 37, 0, 267, 269, 270, 409, 291, 375, 321, 405, 314, 17, 84, 181, 91, 146];
const INNER_LIPS = [78, 191, 80, 81, 82, 13, 312, 311, 310, 415, 308, 324, 318, 402, 317, 14, 87, 178, 88, 95];

function traceLoop(ctx, lm, indices, w, h) {
  ctx.beginPath();
  for (let i = 0; i < indices.length; i++) {
    const p = lm[indices[i]];
    if (i === 0) ctx.moveTo(p.x * w, p.y * h);
    else ctx.lineTo(p.x * w, p.y * h);
  }
  ctx.closePath();
}

function getFaceMetrics(lm) {
  const lEye = lm[468] || lm[159];
  const rEye = lm[473] || lm[386];
  const nose = lm[1];
  const top = lm[10];
  const chin = lm[152];
  const lJaw = lm[172];
  const rJaw = lm[397];
  const lCheek = lm[234];
  const rCheek = lm[454];
  const lMouth = lm[61];
  const rMouth = lm[291];
  const uLip = lm[13];
  const bLip = lm[14];

  const eyeDist = Math.max(0.04, Math.hypot(rEye.x - lEye.x, rEye.y - lEye.y));
  const faceCx = (lCheek.x + rCheek.x) * 0.5;
  const faceCy = (top.y + chin.y) * 0.5;
  const faceRx = Math.max(0.08, Math.abs(rCheek.x - lCheek.x) * 0.55);
  const faceRy = Math.max(0.10, Math.abs(chin.y - top.y) * 0.54);

  return {
    lEye, rEye, nose, top, chin, lJaw, rJaw, lCheek, rCheek,
    lMouth, rMouth, uLip, bLip, eyeDist,
    oval: [faceCx, faceCy, faceRx, faceRy]
  };
}

function drawEyeClippedIris(fx, lm, loop, irisPt, eyeDistPx, w, h, colorOuter, colorInner, catchlightBoost = 1) {
  fx.save();
  traceLoop(fx, lm, loop, w, h);
  fx.clip();

  const ix = irisPt.x * w;
  const iy = irisPt.y * h;
  const r = Math.max(4, eyeDistPx * 0.145);

  const grad = fx.createRadialGradient(ix, iy, r * 0.25, ix, iy, r);
  grad.addColorStop(0, colorInner);
  grad.addColorStop(0.68, colorOuter);
  grad.addColorStop(1, 'rgba(10, 14, 24, 0.85)');

  fx.globalCompositeOperation = 'color';
  fx.globalAlpha = 0.72;
  fx.fillStyle = grad;
  fx.beginPath();
  fx.arc(ix, iy, r, 0, Math.PI * 2);
  fx.fill();

  // Specular anime/glam studio catchlights
  fx.globalCompositeOperation = 'screen';
  fx.globalAlpha = 0.85 * catchlightBoost;
  fx.fillStyle = '#ffffff';
  fx.beginPath();
  fx.arc(ix - r * 0.34, iy - r * 0.34, Math.max(1.5, r * 0.24 * catchlightBoost), 0, Math.PI * 2);
  fx.fill();
  fx.beginPath();
  fx.arc(ix + r * 0.28, iy + r * 0.25, Math.max(1.0, r * 0.12 * catchlightBoost), 0, Math.PI * 2);
  fx.fill();
  fx.restore();
}

function drawLipMakeup(fx, lm, w, h, color, alpha = 0.42, gloss = 0.35) {
  fx.save();
  fx.beginPath();
  for (let i = 0; i < OUTER_LIPS.length; i++) {
    const p = lm[OUTER_LIPS[i]];
    if (i === 0) fx.moveTo(p.x * w, p.y * h);
    else fx.lineTo(p.x * w, p.y * h);
  }
  fx.closePath();
  // Punch out inner mouth opening using evenodd fill rule
  for (let i = 0; i < INNER_LIPS.length; i++) {
    const p = lm[INNER_LIPS[i]];
    if (i === 0) fx.moveTo(p.x * w, p.y * h);
    else fx.lineTo(p.x * w, p.y * h);
  }
  fx.closePath();

  fx.globalCompositeOperation = 'multiply';
  fx.globalAlpha = alpha;
  fx.fillStyle = color;
  fx.fill('evenodd');

  // Specular lip gloss sheen on lower lip
  if (gloss > 0) {
    const bLip = lm[17];
    const mW = Math.hypot((lm[291].x - lm[61].x) * w, (lm[291].y - lm[61].y) * h);
    fx.globalCompositeOperation = 'screen';
    fx.globalAlpha = gloss;
    fx.fillStyle = '#ffffff';
    fx.beginPath();
    fx.ellipse(bLip.x * w, bLip.y * h - mW * 0.06, mW * 0.22, mW * 0.045, 0, 0, Math.PI * 2);
    fx.fill();
  }
  fx.restore();
}

function drawLoadingPill(fx, w, h) {
  if (w < 160) return;
  fx.save();
  const txt = snapTracker.failed
    ? '⚠️ 3D Face Mesh unavailable on this device'
    : '✨ Loading 478-Point 3D Snap Engine…';
  fx.font = '700 12px "Outfit", sans-serif';
  const tw = fx.measureText(txt).width + 24;
  fx.fillStyle = 'rgba(15, 23, 42, 0.78)';
  fx.beginPath();
  fx.roundRect((w - tw) / 2, h - 46, tw, 30, 15);
  fx.fill();
  fx.fillStyle = '#fef08a';
  fx.textAlign = 'center';
  fx.textBaseline = 'middle';
  fx.fillText(txt, w / 2, h - 31);
  fx.restore();
}

/* ==========================================================================
   1. SNAPCHAT ANIME DOLL GLOW-UP
   Enlarged expressive eyes, V-line jaw slimming, porcelain skin, rosy blush,
   glossy lips, and mouth-open sparkle burst!
   ========================================================================== */
export const snapAnimeLens = {
  id: 'snap_anime',
  name: 'Anime Doll Lens',
  icon: '🌸',
  category: 'Face',
  perf: 'medium',

  render(fx, frame) {
    const { src, width: w, height: h, time = 0, dt = 16.7 } = frame;
    const hasFace = w >= 160 && snapTracker.update(src, time, dt);

    if (!hasFace || !snapTracker.landmarks) {
      runWarpPass(fx, src, w, h, { smooth: 0.35, warmth: 0.08, contrast: 1.06, saturation: 1.15 });
      if (w >= 160 && !snapTracker.ready) drawLoadingPill(fx, w, h);
      return;
    }

    const lm = snapTracker.landmarks;
    const m = getFaceMetrics(lm);
    const eyeDistPx = m.eyeDist * w;
    const aspect = w / Math.max(h, 1);
    const rEye = m.eyeDist * aspect * 0.62;
    const jawOpen = snapTracker.bs('jawOpen');

    // GPU Liquify: Big anime eyes + slim nose + V-line jaw pull inward
    runWarpPass(fx, src, w, h, {
      oval: m.oval,
      smooth: 0.82,
      warmth: 0.12,
      contrast: 1.06,
      saturation: 1.16,
      warps: [
        { x: m.lEye.x, y: m.lEye.y, r: rEye, s: 0.30 },
        { x: m.rEye.x, y: m.rEye.y, r: rEye, s: 0.30 },
        { x: m.nose.x, y: m.nose.y, r: rEye * 0.72, s: -0.18 },
        { x: m.lJaw.x, y: m.lJaw.y, r: rEye * 1.15, s: 0, px: (m.nose.x - m.lJaw.x) * 0.14, py: -0.008 },
        { x: m.rJaw.x, y: m.rJaw.y, r: rEye * 1.15, s: 0, px: (m.nose.x - m.rJaw.x) * 0.14, py: -0.008 },
        { x: m.chin.x, y: m.chin.y, r: rEye * 0.85, s: -0.10, px: 0, py: -0.012 }
      ]
    });

    // Eye-clipped anime violet-sapphire eyes + big sparkle catchlights
    if (snapTracker.bs('eyeBlinkLeft') < 0.65) {
      drawEyeClippedIris(fx, lm, LEFT_EYE_LOOP, m.lEye, eyeDistPx * 1.15, w, h, '#6366f1', '#38bdf8', 1.35);
    }
    if (snapTracker.bs('eyeBlinkRight') < 0.65) {
      drawEyeClippedIris(fx, lm, RIGHT_EYE_LOOP, m.rEye, eyeDistPx * 1.15, w, h, '#6366f1', '#38bdf8', 1.35);
    }

    // Soft pastel pink blush across cheekbones
    fx.save();
    [lm[50], lm[280]].forEach((cheek) => {
      const cx = cheek.x * w, cy = cheek.y * h;
      const br = eyeDistPx * 0.38;
      const bg = fx.createRadialGradient(cx, cy, 2, cx, cy, br);
      bg.addColorStop(0, 'rgba(244, 114, 182, 0.34)');
      bg.addColorStop(1, 'rgba(244, 114, 182, 0)');
      fx.fillStyle = bg;
      fx.beginPath();
      fx.arc(cx, cy, br, 0, Math.PI * 2);
      fx.fill();
    });
    fx.restore();

    // Glossy rose lip tint
    drawLipMakeup(fx, lm, w, h, '#f43f5e', 0.38, 0.45);

    // Interactive trigger: Open mouth spawns floating kawaii sparkles
    if (!this._sparks) this._sparks = [];
    if (jawOpen > 0.25) {
      const mx = ((m.uLip.x + m.bLip.x) * 0.5) * w;
      const my = ((m.uLip.y + m.bLip.y) * 0.5) * h;
      for (let i = 0; i < 3; i++) {
        this._sparks.push({
          x: mx + rand(-18, 18),
          y: my + rand(-10, 10),
          vx: rand(-0.18, 0.18),
          vy: rand(-0.28, -0.06),
          size: rand(5, 13),
          age: 0,
          life: rand(450, 900),
          col: i % 2 ? '#fde047' : '#f472b6'
        });
      }
    }

    fx.save();
    for (let i = this._sparks.length - 1; i >= 0; i--) {
      const p = this._sparks[i];
      p.age += dt;
      if (p.age >= p.life) { this._sparks.splice(i, 1); continue; }
      const k = 1 - p.age / p.life;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      fx.globalAlpha = k;
      fx.fillStyle = p.col;
      const s = p.size * (0.6 + 0.5 * k);
      fx.beginPath();
      fx.moveTo(p.x, p.y - s);
      fx.quadraticCurveTo(p.x, p.y, p.x + s, p.y);
      fx.quadraticCurveTo(p.x, p.y, p.x, p.y + s);
      fx.quadraticCurveTo(p.x, p.y, p.x - s, p.y);
      fx.closePath();
      fx.fill();
    }
    fx.restore();
  }
};

/* ==========================================================================
   2. SNAPCHAT VIRAL CRYING MEME LENS
   Drags mouth corners downward into a trembling pout, swells lower eyelids,
   adds watery specular eye sheen and animated rolling tears!
   ========================================================================== */
export const snapCryingLens = {
  id: 'snap_cry',
  name: 'Crying Face Meme',
  icon: '😭',
  category: 'Face',
  perf: 'medium',

  render(fx, frame) {
    const { src, width: w, height: h, time = 0, dt = 16.7 } = frame;
    const hasFace = w >= 160 && snapTracker.update(src, time, dt);

    if (!hasFace || !snapTracker.landmarks) {
      fx.drawImage(src, 0, 0, w, h);
      if (w >= 160 && !snapTracker.ready) drawLoadingPill(fx, w, h);
      return;
    }

    const lm = snapTracker.landmarks;
    const m = getFaceMetrics(lm);
    const eyeDistPx = m.eyeDist * w;
    const aspect = w / Math.max(h, 1);
    const rBase = m.eyeDist * aspect * 0.55;
    const quiver = Math.sin(time * 0.018) * 0.004;

    // GPU Liquify: Pull mouth corners sharply down, lift inner brows, puff cheeks/eyes
    runWarpPass(fx, src, w, h, {
      oval: m.oval,
      smooth: 0.25,
      warmth: -0.10,
      contrast: 1.08,
      saturation: 0.92,
      warps: [
        // Sad upturned inner eyebrows
        { x: lm[107].x, y: lm[107].y, r: rBase * 0.65, s: 0, px: 0, py: -0.022 },
        { x: lm[336].x, y: lm[336].y, r: rBase * 0.65, s: 0, px: 0, py: -0.022 },
        // Drooping outer eyes
        { x: lm[33].x, y: lm[33].y, r: rBase * 0.55, s: 0.14, px: 0, py: 0.014 },
        { x: lm[263].x, y: lm[263].y, r: rBase * 0.55, s: 0.14, px: 0, py: 0.014 },
        // Deep trembling frown drag on mouth corners
        { x: m.lMouth.x, y: m.lMouth.y, r: rBase * 0.85, s: 0.12, px: 0.006, py: 0.042 + quiver },
        { x: m.rMouth.x, y: m.rMouth.y, r: rBase * 0.85, s: 0.12, px: -0.006, py: 0.042 - quiver },
        // Pouty pushed-up center lower lip
        { x: lm[17].x, y: lm[17].y, r: rBase * 0.55, s: 0.18, px: 0, py: -0.014 }
      ]
    });

    // Reddened nose tip & glossy watery eyes
    fx.save();
    const nx = m.nose.x * w, ny = m.nose.y * h;
    const nr = eyeDistPx * 0.28;
    const ng = fx.createRadialGradient(nx, ny, 2, nx, ny, nr);
    ng.addColorStop(0, 'rgba(239, 68, 68, 0.30)');
    ng.addColorStop(1, 'rgba(239, 68, 68, 0)');
    fx.fillStyle = ng;
    fx.beginPath();
    fx.arc(nx, ny, nr, 0, Math.PI * 2);
    fx.fill();

    // Watery tear wells on lower eyelids
    [lm[145], lm[374]].forEach((lid) => {
      const lx = lid.x * w, ly = lid.y * h;
      const g = fx.createRadialGradient(lx, ly, 1, lx, ly, eyeDistPx * 0.22);
      g.addColorStop(0, 'rgba(224, 242, 254, 0.75)');
      g.addColorStop(0.5, 'rgba(56, 189, 248, 0.32)');
      g.addColorStop(1, 'rgba(56, 189, 248, 0)');
      fx.fillStyle = g;
      fx.beginPath();
      fx.arc(lx, ly, eyeDistPx * 0.22, 0, Math.PI * 2);
      fx.fill();
    });

    // Animated glistening teardrops rolling down cheeks
    if (!this._tears) this._tears = [];
    if (Math.random() < 0.16 && this._tears.length < 12) {
      const origin = Math.random() < 0.5 ? lm[145] : lm[374];
      this._tears.push({
        x: origin.x * w + rand(-4, 4),
        y: origin.y * h + 2,
        vy: rand(0.08, 0.16),
        r: rand(3.2, 5.8),
        age: 0,
        life: rand(900, 1500)
      });
    }

    for (let i = this._tears.length - 1; i >= 0; i--) {
      const tr = this._tears[i];
      tr.age += dt;
      if (tr.age >= tr.life) { this._tears.splice(i, 1); continue; }
      tr.y += tr.vy * dt;
      tr.vy += 0.00018 * dt;
      const a = clamp(1 - tr.age / tr.life, 0, 1);

      fx.save();
      fx.globalAlpha = a * 0.9;
      fx.fillStyle = '#bae6fd';
      fx.beginPath();
      fx.moveTo(tr.x, tr.y - tr.r * 1.6);
      fx.quadraticCurveTo(tr.x + tr.r, tr.y, tr.x, tr.y + tr.r);
      fx.quadraticCurveTo(tr.x - tr.r, tr.y, tr.x, tr.y - tr.r * 1.6);
      fx.fill();

      fx.fillStyle = '#ffffff';
      fx.beginPath();
      fx.arc(tr.x - tr.r * 0.28, tr.y + tr.r * 0.1, tr.r * 0.28, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }
    fx.restore();
  }
};

/* ==========================================================================
   3. SNAPCHAT GIGA-JAW CARICATURE SCULPT
   Dramatic chiseled jawline expansion, furrowed brow, and studio B&W contrast.
   ========================================================================== */
export const snapGigaLens = {
  id: 'snap_giga',
  name: 'Giga-Jaw Sculpt',
  icon: '🗿',
  category: 'Face',
  perf: 'medium',

  render(fx, frame) {
    const { src, width: w, height: h, time = 0, dt = 16.7 } = frame;
    const hasFace = w >= 160 && snapTracker.update(src, time, dt);

    if (!hasFace || !snapTracker.landmarks) {
      runWarpPass(fx, src, w, h, { contrast: 1.32, saturation: 0.08 });
      if (w >= 160 && !snapTracker.ready) drawLoadingPill(fx, w, h);
      return;
    }

    const lm = snapTracker.landmarks;
    const m = getFaceMetrics(lm);
    const aspect = w / Math.max(h, 1);
    const rJaw = m.eyeDist * aspect * 0.85;

    runWarpPass(fx, src, w, h, {
      oval: m.oval,
      smooth: 0.3,
      warmth: 0.02,
      contrast: 1.34,
      saturation: 0.06,
      warps: [
        // Massive square jawline drag outward & down
        { x: m.lJaw.x, y: m.lJaw.y, r: rJaw, s: 0.22, px: (m.lJaw.x - m.nose.x) * 0.26, py: 0.024 },
        { x: m.rJaw.x, y: m.rJaw.y, r: rJaw, s: 0.22, px: (m.rJaw.x - m.nose.x) * 0.26, py: 0.024 },
        // Heavy chiseled chin pull downward
        { x: m.chin.x, y: m.chin.y, r: rJaw * 0.85, s: 0.26, px: 0, py: 0.036 },
        // Hollow sculpted cheeks
        { x: lm[50].x, y: lm[50].y, r: rJaw * 0.55, s: -0.22 },
        { x: lm[280].x, y: lm[280].y, r: rJaw * 0.55, s: -0.22 },
        // Intense furrowed brow
        { x: lm[107].x, y: lm[107].y, r: rJaw * 0.45, s: 0, px: 0, py: 0.015 },
        { x: lm[336].x, y: lm[336].y, r: rJaw * 0.45, s: 0, px: 0, py: 0.015 }
      ]
    });

    // Dramatic monochrome spotlight vignette
    fx.save();
    const vig = fx.createRadialGradient(w * 0.5, h * 0.48, Math.min(w, h) * 0.28, w * 0.5, h * 0.48, Math.max(w, h) * 0.72);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.58)');
    fx.fillStyle = vig;
    fx.fillRect(0, 0, w, h);
    fx.restore();
  }
};

/* ==========================================================================
   4. SNAPCHAT HOLLYWOOD GLAM BEAUTY
   Natural bilateral skin retouch, subtle eye lift, emerald/gold eye lenses,
   soft-light velvet lipstick, and warm ring-light catchlights.
   ========================================================================== */
export const snapGlamLens = {
  id: 'snap_glam',
  name: 'Glam Beauty Pro',
  icon: '✨',
  category: 'Face',
  perf: 'medium',

  render(fx, frame) {
    const { src, width: w, height: h, time = 0, dt = 16.7 } = frame;
    const hasFace = w >= 160 && snapTracker.update(src, time, dt);

    if (!hasFace || !snapTracker.landmarks) {
      runWarpPass(fx, src, w, h, { smooth: 0.55, warmth: 0.14, contrast: 1.07, saturation: 1.12 });
      if (w >= 160 && !snapTracker.ready) drawLoadingPill(fx, w, h);
      return;
    }

    const lm = snapTracker.landmarks;
    const m = getFaceMetrics(lm);
    const eyeDistPx = m.eyeDist * w;
    const aspect = w / Math.max(h, 1);
    const rEye = m.eyeDist * aspect * 0.48;

    runWarpPass(fx, src, w, h, {
      oval: m.oval,
      smooth: 0.78,
      warmth: 0.14,
      contrast: 1.08,
      saturation: 1.12,
      warps: [
        // Subtle natural eye enhancement & brow lift
        { x: m.lEye.x, y: m.lEye.y, r: rEye, s: 0.10 },
        { x: m.rEye.x, y: m.rEye.y, r: rEye, s: 0.10 },
        { x: lm[70].x, y: lm[70].y, r: rEye * 0.8, s: 0, px: 0, py: -0.008 },
        { x: lm[300].x, y: lm[300].y, r: rEye * 0.8, s: 0, px: 0, py: -0.008 }
      ]
    });

    // Emerald-amber contact lenses (disappear naturally on blink)
    if (snapTracker.bs('eyeBlinkLeft') < 0.65) {
      drawEyeClippedIris(fx, lm, LEFT_EYE_LOOP, m.lEye, eyeDistPx, w, h, '#10b981', '#fbbf24', 1.1);
    }
    if (snapTracker.bs('eyeBlinkRight') < 0.65) {
      drawEyeClippedIris(fx, lm, RIGHT_EYE_LOOP, m.rEye, eyeDistPx, w, h, '#10b981', '#fbbf24', 1.1);
    }

    // Velvet berry lipstick + specular gloss
    drawLipMakeup(fx, lm, w, h, '#be185d', 0.34, 0.38);

    // Subtle warm sun-kissed cheekbone highlight
    fx.save();
    fx.globalCompositeOperation = 'screen';
    [lm[50], lm[280], m.nose].forEach((pt, idx) => {
      const px = pt.x * w, py = pt.y * h;
      const r = idx === 2 ? eyeDistPx * 0.14 : eyeDistPx * 0.32;
      const g = fx.createRadialGradient(px, py, 1, px, py, r);
      g.addColorStop(0, idx === 2 ? 'rgba(255, 250, 235, 0.24)' : 'rgba(253, 186, 116, 0.18)');
      g.addColorStop(1, 'rgba(255, 255, 255, 0)');
      fx.fillStyle = g;
      fx.beginPath();
      fx.arc(px, py, r, 0, Math.PI * 2);
      fx.fill();
    });
    fx.restore();
  }
};

export const snapchatLenses = [
  snapAnimeLens,
  snapCryingLens,
  snapGigaLens,
  snapGlamLens
];

export function registerSnapchatLenses(manager) {
  manager.registerAll(snapchatLenses);
}