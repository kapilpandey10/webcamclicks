/* WebcamClicks — Flagship 35mm Cinema Halation & Live Telemetry Studio Filter (vintageshoot.js)
   Combines a self-contained WebGL 2.0 optical shader (Kodak Vision3 color matrix, red halation bloom,
   radial chromatic dispersion, and procedural film grain) with a real-time RGB/Luma histogram scope
   and face-tracked cinema autofocus HUD. */

import { clamp, lerp, makeCanvas } from '../../utils.js';
import { getHeadPose, smoothPose, applyFilmGrain } from './filter-helpers.js';

const VS_SRC = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FS_SRC = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform float uTime;
  uniform vec2 uFocusPt;

  float luma(vec3 c) {
    return dot(c, vec3(0.2126, 0.7152, 0.0722));
  }

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 sampleClamped(vec2 uv) {
    return texture2D(uTex, clamp(uv, 0.001, 0.999)).rgb;
  }

  void main() {
    vec2 uv = vUv;
    vec2 centerVec = uv - 0.5;
    float distFromCenter = length(centerVec);

    // 1. Subtle Optical Barrel Distortion & Radial Chromatic Dispersion
    float k = 0.055 * dot(centerVec, centerVec);
    vec2 uvR = (centerVec * (1.0 + k * 1.18)) + 0.5;
    vec2 uvG = (centerVec * (1.0 + k * 1.00)) + 0.5;
    vec2 uvB = (centerVec * (1.0 + k * 0.84)) + 0.5;

    vec3 base = vec3(
      sampleClamped(uvR).r,
      sampleClamped(uvG).g,
      sampleClamped(uvB).b
    );

    // 2. Multi-Tap Optical Red Halation (Film emulsion backscatter around bright highlights)
    vec2 px = 3.5 / uRes;
    vec3 ring = (
      sampleClamped(uv + vec2( px.x,  0.0)) +
      sampleClamped(uv + vec2(-px.x,  0.0)) +
      sampleClamped(uv + vec2( 0.0,  px.y)) +
      sampleClamped(uv + vec2( 0.0, -px.y)) +
      sampleClamped(uv + vec2( px.x * 0.7,  px.y * 0.7)) +
      sampleClamped(uv + vec2(-px.x * 0.7,  px.y * 0.7)) +
      sampleClamped(uv + vec2( px.x * 0.7, -px.y * 0.7)) +
      sampleClamped(uv + vec2(-px.x * 0.7, -px.y * 0.7))
    ) * 0.125;

    float highlightMask = smoothstep(0.68, 0.98, luma(ring));
    vec3 col = base + vec3(0.36, 0.09, 0.02) * highlightMask;

    // 3. Kodak Vision3 500T / Portra 400 S-Curve & Split-Tone Color Matrix
    col = smoothstep(0.015, 0.985, col);
    float lum = luma(col);

    vec3 shadowTint = vec3(0.90, 0.97, 1.06); // Cinema cyan-teal shadows
    vec3 midTint    = vec3(1.06, 1.01, 0.94); // Warm skin-flattering midtones
    vec3 highTint   = vec3(1.08, 1.03, 0.90); // Creamy amber highlights

    vec3 graded = mix(col * shadowTint, col * midTint, smoothstep(0.0, 0.55, lum));
    graded = mix(graded, col * highTint, smoothstep(0.50, 1.0, lum));

    // Lifted matte cinema blacks
    graded = graded * 0.93 + vec3(0.028, 0.022, 0.032);

    // 4. Dynamic Light Leak & Anamorphic Horizontal Streak near focus subject
    float leakWave = sin(uv.x * 3.5 + uTime * 0.7) * cos(uv.y * 2.5 - uTime * 0.5);
    float edgeLeak = smoothstep(0.55, 1.0, uv.x + uv.y * 0.35 + leakWave * 0.12);
    graded += vec3(0.22, 0.07, 0.01) * edgeLeak * 0.45;

    float streakY = abs(uv.y - uFocusPt.y);
    float streak = exp(-streakY * 55.0) * exp(-abs(uv.x - uFocusPt.x) * 2.2);
    graded += vec3(0.10, 0.22, 0.34) * streak * 0.45;

    // 5. Luminance-Weighted 35mm Organic Film Grain (strongest in midtones)
    float midWeight = 1.0 - abs(lum - 0.5) * 1.4;
    float noise = (hash12(gl_FragCoord.xy + fract(uTime * 1.37) * 100.0) - 0.5) * 0.075 * max(0.25, midWeight);
    graded += vec3(noise);

    // 6. Natural Panavision Optical Vignette
    float vig = smoothstep(0.95, 0.28, distFromCenter);
    graded *= mix(0.68, 1.0, vig);

    gl_FragColor = vec4(clamp(graded, 0.0, 1.0), 1.0);
  }
`;

let _glState = null;
function getCinemaShader() {
  if (_glState !== null) return _glState;
  try {
    const canvas = document.createElement('canvas');
    const gl =
      canvas.getContext('webgl2', { alpha: false, antialias: false, premultipliedAlpha: false }) ||
      canvas.getContext('webgl', { alpha: false, antialias: false, premultipliedAlpha: false });
    if (!gl) {
      _glState = false;
      return false;
    }

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };

    const vs = compile(gl.VERTEX_SHADER, VS_SRC);
    const fs = compile(gl.FRAGMENT_SHADER, FS_SRC);
    if (!vs || !fs) {
      _glState = false;
      return false;
    }

    const prog = gl.createProgram();
    gl.attachShader(prog, vs);
    gl.attachShader(prog, fs);
    gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      _glState = false;
      return false;
    }

    gl.useProgram(prog);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    const aPos = gl.getAttribLocation(prog, 'aPos');
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    _glState = {
      canvas,
      gl,
      prog,
      tex,
      uRes: gl.getUniformLocation(prog, 'uRes'),
      uTime: gl.getUniformLocation(prog, 'uTime'),
      uFocusPt: gl.getUniformLocation(prog, 'uFocusPt')
    };
    return _glState;
  } catch {
    _glState = false;
    return false;
  }
}

/* Downscaled 48x27 scratch canvas for ultra-fast (<0.08ms) real-time RGB/Luma histogram telemetry */
let _scopeCanvas = null;
let _scopeCtx = null;
function computeLiveHistogram(src) {
  if (!_scopeCanvas) {
    _scopeCanvas = makeCanvas(48, 27);
    _scopeCtx = _scopeCanvas.getContext('2d', { willReadFrequently: true });
  }
  _scopeCtx.drawImage(src, 0, 0, 48, 27);
  const data = _scopeCtx.getImageData(0, 0, 48, 27).data;
  const bins = new Uint16Array(24);
  let rSum = 0, gSum = 0, bSum = 0, lumaSum = 0;
  const count = 48 * 27;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    rSum += r; gSum += g; bSum += b;
    const lum = (r * 77 + g * 150 + b * 29) >> 8;
    lumaSum += lum;
    const bin = Math.min(23, (lum * 24) >> 8);
    bins[bin]++;
  }

  const avgLum = lumaSum / count;
  const ev = ((avgLum - 128) / 64).toFixed(1);
  const ratioRB = (rSum + 1) / (bSum + 1);
  const kelvin = Math.round(clamp(5600 - (ratioRB - 1) * 1400, 3200, 7500) / 50) * 50;

  return { bins, ev: (ev >= 0 ? `+${ev}` : `${ev}`), kelvin };
}

export const vintageshootEffect = {
  id: 'vintageshoot',
  name: '35mm Cinema',
  icon: '🎞️',
  category: 'Styles',
  perf: 'low',
  requiresFace: true,

  render(fx, frame) {
    const { src, width: w, height: h } = frame;
    const nowMs = typeof frame.time === 'number' ? frame.time : (typeof frame.now === 'number' ? frame.now : performance.now());
    const tSec = nowMs * 0.001;
    const dt = clamp(frame.dt || 16.7, 1, 50);

    const rawPose = getHeadPose(frame);
    const pose = smoothPose(this, rawPose, dt, 35);
    const focusU = clamp(pose.cx / Math.max(w, 1), 0.15, 0.85);
    const focusV = clamp(pose.cy / Math.max(h, 1), 0.15, 0.85);

    // 1. Execute WebGL 2.0 Cinema Shader (or high-grade Canvas fallback)
    const shader = getCinemaShader();
    if (shader) {
      const { canvas, gl, prog, tex, uRes, uTime, uFocusPt } = shader;
      if (canvas.width !== w || canvas.height !== h) {
        canvas.width = w;
        canvas.height = h;
        gl.viewport(0, 0, w, h);
      }
      gl.useProgram(prog);
      gl.bindTexture(gl.TEXTURE_2D, tex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);
      gl.uniform2f(uRes, w, h);
      gl.uniform1f(uTime, tSec);
      gl.uniform2f(uFocusPt, focusU, focusV);
      gl.drawArrays(gl.TRIANGLES, 0, 6);

      fx.drawImage(canvas, 0, 0, w, h);
    } else {
      fx.save();
      fx.filter = 'contrast(1.18) saturate(1.14) sepia(0.22)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      applyFilmGrain(fx, w, h, 0.22);
      fx.restore();
    }

    // Skip HUD overlays when rendering tiny 56x56 filter thumbnails
    if (w < 160 || h < 120) return;

    // 2. Cinema 2.39:1 Matte Gate Lines & 35mm Film Edge Code
    fx.save();
    const pad = Math.max(14, Math.round(w * 0.024));
    const fsSmall = Math.max(9, Math.round(w * 0.013));
    const fsMed = Math.max(11, Math.round(w * 0.015));

    // Top & bottom subtle cinema aspect guide lines
    const barH = Math.round(h * 0.065);
    fx.fillStyle = 'rgba(8, 6, 10, 0.58)';
    fx.fillRect(0, 0, w, barH);
    fx.fillRect(0, h - barH, w, barH);

    fx.strokeStyle = 'rgba(245, 158, 11, 0.35)';
    fx.lineWidth = 1;
    fx.beginPath();
    fx.moveTo(0, barH); fx.lineTo(w, barH);
    fx.moveTo(0, h - barH); fx.lineTo(w, h - barH);
    fx.stroke();

    // Top-Left Film Stock & Timecode Metadata
    fx.font = `700 ${fsMed}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    fx.textBaseline = 'middle';
    fx.fillStyle = '#fbbf24';
    fx.fillText('KODAK VISION3 500T · 5219', pad, barH * 0.5);

    // Top-Right Rolling SMPTE Timecode
    const totalFrames = Math.floor(tSec * 24);
    const ff = String(totalFrames % 24).padStart(2, '0');
    const ss = String(Math.floor(tSec) % 60).padStart(2, '0');
    const mm = String(Math.floor(tSec / 60) % 60).padStart(2, '0');
    fx.textAlign = 'right';
    fx.fillStyle = '#f8fafc';
    fx.fillText(`TC 01:${mm}:${ss}:${ff} · 24FPS · 180°`, w - pad, barH * 0.5);

    // 3. Interactive Face-Tracked Cinema Autofocus Brackets
    const afX = pose.cx;
    const afY = pose.cy;
    const afW = clamp(pose.w * 0.72, 70, w * 0.42);
    const afH = clamp(pose.h * 0.78, 70, h * 0.52);
    const corner = Math.max(10, Math.round(afW * 0.14));

    fx.save();
    fx.translate(afX, afY);
    fx.rotate(pose.angle * 0.35);

    fx.strokeStyle = pose.hasFace ? 'rgba(52, 211, 153, 0.85)' : 'rgba(251, 191, 36, 0.75)';
    fx.lineWidth = Math.max(1.5, w * 0.0022);
    const hw = afW * 0.5, hh = afH * 0.5;

    fx.beginPath();
    // Top-Left
    fx.moveTo(-hw, -hh + corner); fx.lineTo(-hw, -hh); fx.lineTo(-hw + corner, -hh);
    // Top-Right
    fx.moveTo(hw - corner, -hh); fx.lineTo(hw, -hh); fx.lineTo(hw, -hh + corner);
    // Bottom-Left
    fx.moveTo(-hw, hh - corner); fx.lineTo(-hw, hh); fx.lineTo(-hw + corner, hh);
    // Bottom-Right
    fx.moveTo(hw - corner, hh); fx.lineTo(hw, hh); fx.lineTo(hw, hh - corner);
    fx.stroke();

    // Center micro crosshair
    fx.beginPath();
    fx.moveTo(-5, 0); fx.lineTo(5, 0);
    fx.moveTo(0, -5); fx.lineTo(0, 5);
    fx.stroke();

    // Distance & Focus Lock Tag
    const distMeters = clamp(1.8 - (pose.eyeDist / Math.max(w, 1)) * 4.2, 0.45, 3.2).toFixed(2);
    fx.font = `700 ${fsSmall}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    fx.textAlign = 'left';
    fx.fillStyle = pose.hasFace ? '#34d399' : '#fbbf24';
    fx.fillText(
      pose.hasFace ? `AF-C LOCK · ${distMeters}m · f/1.4` : `AF-S SPOT · ${distMeters}m · f/1.4`,
      -hw + 4,
      hh + fsSmall + 4
    );
    fx.restore();

    // 4. Live Real-Time Luminance Histogram & Color Telemetry Scope (Bottom-Left)
    if (!this._histData || nowMs - (this._lastHistTime || 0) > 60) {
      this._histData = computeLiveHistogram(src);
      this._lastHistTime = nowMs;
    }
    const { bins, ev, kelvin } = this._histData;

    const scopeW = Math.max(108, Math.round(w * 0.14));
    const scopeH = Math.max(36, Math.round(h * 0.065));
    const scopeX = pad;
    const scopeY = h - barH - scopeH - 10;

    fx.fillStyle = 'rgba(10, 12, 18, 0.72)';
    fx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    fx.lineWidth = 1;
    fx.beginPath();
    fx.roundRect(scopeX, scopeY, scopeW, scopeH, 6);
    fx.fill();
    fx.stroke();

    const barWidth = (scopeW - 12) / 24;
    for (let i = 0; i < 24; i++) {
      const norm = Math.min(1, bins[i] / 180);
      const bh = Math.max(2, norm * (scopeH - 14));
      const bx = scopeX + 6 + i * barWidth;
      const by = scopeY + scopeH - 4 - bh;
      fx.fillStyle = i > 20 ? '#f87171' : (i < 3 ? '#38bdf8' : 'rgba(251, 191, 36, 0.85)');
      fx.fillRect(bx, by, Math.max(1.5, barWidth - 1), bh);
    }

    // Bottom Bar Telemetry Readout
    fx.textAlign = 'left';
    fx.font = `700 ${fsSmall}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    fx.fillStyle = 'rgba(254, 240, 138, 0.92)';
    fx.fillText(`LUMA HISTOGRAM · EV ${ev} · WB ${kelvin}K · ISO 800`, pad, h - barH * 0.5);

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '.');
    fx.textAlign = 'right';
    fx.fillStyle = 'rgba(251, 146, 60, 0.9)';
    fx.fillText(`ANAMORPHIC 35MM · ${dateStr}`, w - pad, h - barH * 0.5);

    fx.restore();
  }
};

export default vintageshootEffect;