/* WebcamClicks — WebGL GPU Shader Filter Accelerator (webgl-filters.js)
   Replaces slow CPU pixel loops with single-pass 60 FPS GPU fragment shaders
   on both mobile (iOS Safari / Android Chrome) and desktop. */

const VERTEX_SHADER = `
  attribute vec2 aPos;
  varying vec2 vUv;
  void main() {
    vUv = vec2(aPos.x * 0.5 + 0.5, 0.5 - aPos.y * 0.5);
    gl_Position = vec4(aPos, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  varying vec2 vUv;
  uniform sampler2D uTex;
  uniform vec2 uRes;
  uniform float uTime;
  uniform int uMode;

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

  // Ironbow / FLIR Thermal palette
  vec3 thermalPalette(float t) {
    t = clamp(t, 0.0, 1.0);
    vec3 c0 = vec3(0.04, 0.02, 0.18);
    vec3 c1 = vec3(0.45, 0.05, 0.58);
    vec3 c2 = vec3(0.92, 0.22, 0.12);
    vec3 c3 = vec3(0.99, 0.78, 0.10);
    vec3 c4 = vec3(1.00, 0.99, 0.92);
    if (t < 0.25) return mix(c0, c1, t * 4.0);
    if (t < 0.50) return mix(c1, c2, (t - 0.25) * 4.0);
    if (t < 0.75) return mix(c2, c3, (t - 0.50) * 4.0);
    return mix(c3, c4, (t - 0.75) * 4.0);
  }

  // Sobel edge magnitude
  float sobelEdge(vec2 uv, float stepScale) {
    vec2 px = stepScale / uRes;
    float tl = luma(sampleClamped(uv + vec2(-px.x, -px.y)));
    float tc = luma(sampleClamped(uv + vec2( 0.0,  -px.y)));
    float tr = luma(sampleClamped(uv + vec2( px.x, -px.y)));
    float ml = luma(sampleClamped(uv + vec2(-px.x,  0.0)));
    float mr = luma(sampleClamped(uv + vec2( px.x,  0.0)));
    float bl = luma(sampleClamped(uv + vec2(-px.x,  px.y)));
    float bc = luma(sampleClamped(uv + vec2( 0.0,   px.y)));
    float br = luma(sampleClamped(uv + vec2( px.x,  px.y)));
    float gx = -tl - 2.0 * ml - bl + tr + 2.0 * mr + br;
    float gy = -tl - 2.0 * tc - tr + bl + 2.0 * bc + br;
    return sqrt(gx * gx + gy * gy);
  }

  void main() {
    vec2 uv = vUv;
    float aspect = uRes.x / max(uRes.y, 1.0);
    vec2 centered = (uv - 0.5) * vec2(aspect, 1.0);
    float dist = length(centered);
    float angle = atan(centered.y, centered.x);

    // 1: Optical Y2K Fisheye with Radial Chromatic Aberration
    if (uMode == 1) {
      vec2 p = (uv - 0.5) * 2.0;
      float r2 = dot(p, p);
      float k = 0.42;
      vec2 uvR = (p * (1.0 + k * r2 * 1.05)) * 0.5 + 0.5;
      vec2 uvG = (p * (1.0 + k * r2 * 1.00)) * 0.5 + 0.5;
      vec2 uvB = (p * (1.0 + k * r2 * 0.95)) * 0.5 + 0.5;
      vec3 col = vec3(sampleClamped(uvR).r, sampleClamped(uvG).g, sampleClamped(uvB).b);
      float vig = smoothstep(1.38, 0.88, length(p));
      gl_FragColor = vec4(col * vig, 1.0);
      return;
    }

    // 2: Bulge
    if (uMode == 2) {
      float radius = 0.48;
      if (dist < radius) {
        float f = pow(1.0 - dist / radius, 2.0) * 0.55;
        centered *= (1.0 - f);
        uv = centered / vec2(aspect, 1.0) + 0.5;
      }
      gl_FragColor = vec4(sampleClamped(uv), 1.0);
      return;
    }

    // 3: Dent / Pinch
    if (uMode == 3) {
      float radius = 0.45;
      if (dist < radius) {
        float f = pow(1.0 - dist / radius, 2.0) * 0.65;
        centered *= (1.0 + f);
        uv = centered / vec2(aspect, 1.0) + 0.5;
      }
      gl_FragColor = vec4(sampleClamped(uv), 1.0);
      return;
    }

    // 4: Swirl / Twist / Spiral
    if (uMode == 4) {
      float radius = 0.52;
      if (dist < radius) {
        float pct = (radius - dist) / radius;
        float theta = pct * pct * 4.2;
        float s = sin(theta);
        float c = cos(theta);
        centered = vec2(
          dot(centered, vec2(c, -s)),
          dot(centered, vec2(s,  c))
        );
        uv = centered / vec2(aspect, 1.0) + 0.5;
      }
      gl_FragColor = vec4(sampleClamped(uv), 1.0);
      return;
    }

    // 5: Water Ripple
    if (uMode == 5) {
      float wave = sin(dist * 38.0 - uTime * 6.0) * 0.012 * smoothstep(0.65, 0.0, dist);
      uv += normalize(centered + 0.0001) * wave;
      vec3 col = sampleClamped(uv);
      col += vec3(0.06, 0.12, 0.18) * max(0.0, wave * 45.0);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
      return;
    }

    // 6: Kaleidoscope (8-way mirror star)
    if (uMode == 6) {
      float segments = 8.0;
      float segAngle = 6.2831853 / segments;
      float a = mod(angle + 3.14159265, segAngle);
      a = abs(a - segAngle * 0.5);
      vec2 kUv = vec2(cos(a), sin(a)) * dist / vec2(aspect, 1.0) + 0.5;
      gl_FragColor = vec4(sampleClamped(kUv), 1.0);
      return;
    }

    vec3 base = sampleClamped(uv);
    float lum = luma(base);

    // 7: Comic Book Pop Art (Sobel Ink + Quantized Palette + Halftone Dots)
    if (uMode == 7) {
      float edge = smoothstep(0.18, 0.42, sobelEdge(uv, 1.5));
      vec3 quant = floor(base * 4.5 + 0.5) / 4.5;
      quant = mix(vec3(luma(quant)), quant, 1.45);
      vec2 grid = fract(gl_FragCoord.xy / 6.0) - 0.5;
      float dotMask = smoothstep(0.36, 0.16, length(grid)) * (1.0 - smoothstep(0.2, 0.78, lum));
      quant *= (1.0 - dotMask * 0.20);
      vec3 outCol = mix(quant, vec3(0.06, 0.05, 0.09), edge);
      gl_FragColor = vec4(outCol, 1.0);
      return;
    }

    // 8: Cyber Neon Glow / Neon Contour
    if (uMode == 8) {
      float edge = smoothstep(0.10, 0.45, sobelEdge(uv, 1.6));
      float hueShift = fract(uv.x * 0.6 + uv.y * 0.4 + uTime * 0.15);
      vec3 neonCol = mix(vec3(0.0, 0.96, 1.0), vec3(1.0, 0.08, 0.65), sin(hueShift * 6.28318) * 0.5 + 0.5);
      vec3 darkBase = base * 0.18;
      vec3 outCol = darkBase + neonCol * edge * 1.45;
      gl_FragColor = vec4(clamp(outCol, 0.0, 1.0), 1.0);
      return;
    }

    // 9: Thermal Heat Vision / FLIR Predator
    if (uMode == 9) {
      float smoothLum = (
        lum +
        luma(sampleClamped(uv + vec2(2.0 / uRes.x, 0.0))) +
        luma(sampleClamped(uv - vec2(2.0 / uRes.x, 0.0)))
      ) / 3.0;
      vec3 heat = thermalPalette(smoothstep(0.05, 0.95, smoothLum));
      float scan = 0.95 + 0.05 * sin(gl_FragCoord.y * 2.0);
      gl_FragColor = vec4(heat * scan, 1.0);
      return;
    }

    // 10: Pencil Sketch / Crosshatch
    if (uMode == 10) {
      float edge = smoothstep(0.08, 0.42, sobelEdge(uv, 1.3));
      float paper = 0.96 - 0.04 * hash12(gl_FragCoord.xy);
      float hatch = (lum < 0.45) ? (0.12 * sin((gl_FragCoord.x + gl_FragCoord.y) * 0.9)) : 0.0;
      float ink = clamp(paper - edge * 0.88 - hatch, 0.08, 0.98);
      gl_FragColor = vec4(vec3(ink, ink * 0.98, ink * 0.94), 1.0);
      return;
    }

    // 11: Watercolor Painting
    if (uMode == 11) {
      vec2 px = 2.5 / uRes;
      vec3 blur = (
        base +
        sampleClamped(uv + vec2(px.x, 0.0)) +
        sampleClamped(uv - vec2(px.x, 0.0)) +
        sampleClamped(uv + vec2(0.0, px.y)) +
        sampleClamped(uv - vec2(0.0, px.y))
      ) * 0.2;
      vec3 quant = floor(blur * 7.0 + 0.5) / 7.0;
      quant = mix(vec3(luma(quant)), quant, 1.35);
      float edge = smoothstep(0.15, 0.50, sobelEdge(uv, 1.5));
      gl_FragColor = vec4(quant * (1.0 - edge * 0.28), 1.0);
      return;
    }

    // 12: Warhol Pop Art (4-Quadrant Silkscreen)
    if (uMode == 12) {
      vec2 qUv = fract(uv * 2.0);
      float qLum = luma(sampleClamped(qUv));
      float stepLum = floor(qLum * 3.0) / 2.0;
      vec3 cA, cB;
      if (uv.x < 0.5 && uv.y < 0.5) {
        cA = vec3(0.95, 0.12, 0.48); cB = vec3(1.0, 0.92, 0.15);
      } else if (uv.x >= 0.5 && uv.y < 0.5) {
        cA = vec3(0.05, 0.75, 0.95); cB = vec3(0.98, 0.35, 0.10);
      } else if (uv.x < 0.5 && uv.y >= 0.5) {
        cA = vec3(0.45, 0.10, 0.88); cB = vec3(0.20, 0.95, 0.55);
      } else {
        cA = vec3(0.10, 0.18, 0.55); cB = vec3(0.98, 0.22, 0.62);
      }
      vec3 outCol = mix(cA, cB, stepLum);
      gl_FragColor = vec4(outCol, 1.0);
      return;
    }

    // 13: Night Vision (Phosphor Green + Vignette + Grain)
    if (uMode == 13) {
      float grain = (hash12(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.14;
      float gVal = clamp(pow(lum, 0.82) * 1.25 + grain, 0.0, 1.0);
      float vig = smoothstep(0.95, 0.32, length(uv - 0.5));
      float scan = 0.92 + 0.08 * sin(gl_FragCoord.y * 2.2);
      vec3 nv = vec3(gVal * 0.18, gVal, gVal * 0.26) * vig * scan;
      gl_FragColor = vec4(nv, 1.0);
      return;
    }

    // 14: X-Ray Negative
    if (uMode == 14) {
      float inv = 1.0 - lum;
      inv = smoothstep(0.1, 0.92, inv);
      vec3 xray = vec3(inv * 0.68, inv * 0.88, min(1.0, inv * 1.15));
      gl_FragColor = vec4(xray, 1.0);
      return;
    }

    // 15: Liquid Rainbow Iridescence
    if (uMode == 15) {
      float wave = lum * 6.28318 + uTime * 1.8 + (uv.x + uv.y) * 3.0;
      vec3 irid = 0.5 + 0.5 * cos(wave + vec3(0.0, 2.094, 4.188));
      vec3 outCol = mix(base, irid, 0.62);
      gl_FragColor = vec4(outCol, 1.0);
      return;
    }

    // 16: Analog 35mm Film + Warm Halation + Grain
    if (uMode == 16) {
      vec2 px = 3.0 / uRes;
      vec3 blur = (
        sampleClamped(uv + vec2(px.x, 0.0)) +
        sampleClamped(uv - vec2(px.x, 0.0)) +
        sampleClamped(uv + vec2(0.0, px.y)) +
        sampleClamped(uv - vec2(0.0, px.y))
      ) * 0.25;
      float halation = smoothstep(0.70, 1.0, luma(blur));
      vec3 col = base + vec3(0.30, 0.08, 0.02) * halation;
      col = smoothstep(0.02, 0.98, col);
      col = mix(col * vec3(0.96, 0.98, 1.05), col * vec3(1.06, 1.01, 0.92), lum);
      col = col * 0.94 + 0.03;
      float grain = (hash12(gl_FragCoord.xy + fract(uTime) * 100.0) - 0.5) * 0.07;
      float vig = smoothstep(0.92, 0.28, length(uv - 0.5));
      gl_FragColor = vec4(clamp((col + grain) * mix(0.74, 1.0, vig), 0.0, 1.0), 1.0);
      return;
    }

    // 17: Alien Bio-Chroma
    if (uMode == 17) {
      vec3 al = vec3(1.0 - base.r * 0.85, 1.0 - base.g * 0.45, 1.0 - base.b);
      al = floor(al * 6.0 + 0.5) / 6.0;
      gl_FragColor = vec4(clamp(al, 0.0, 1.0), 1.0);
      return;
    }

    // 18: Warm Cocoa Matte
    if (uMode == 18) {
      vec3 co = vec3(
        (base.r * 0.78 + 0.24 - 0.5) * 1.12 + 0.5,
        (base.g * 0.58 + 0.16 - 0.43) * 1.10 + 0.43,
        (base.b * 0.44 + 0.11 - 0.38) * 1.08 + 0.38
      );
      gl_FragColor = vec4(clamp(co, 0.0, 1.0), 1.0);
      return;
    }

    gl_FragColor = vec4(base, 1.0);
  }
`;

export const WEBGL_EFFECT_MODES = {
  fisheye: 1,
  bulge: 2,
  pinch: 3,
  twist: 4,
  kaleidoscope: 6,
  comic: 7,
  neon: 8,
  thermal: 9,
  sketch: 10,
  watercolor: 11,
  popart: 12,
  nightvision: 13
};

class WebGLFilterAccelerator {
  constructor() {
    this.canvas = document.createElement('canvas');
    this.gl = null;
    this.program = null;
    this.texture = null;
    this.uRes = null;
    this.uTime = null;
    this.uMode = null;
    this.supported = false;
    this._init();
  }

  _init() {
    try {
      const gl =
        this.canvas.getContext('webgl2', { premultipliedAlpha: false, alpha: false, antialias: false }) ||
        this.canvas.getContext('webgl', { premultipliedAlpha: false, alpha: false, antialias: false });
      if (!gl) return;

      const vs = this._compile(gl, gl.VERTEX_SHADER, VERTEX_SHADER);
      const fs = this._compile(gl, gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
      if (!vs || !fs) return;

      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return;

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

      this.gl = gl;
      this.program = prog;
      this.texture = tex;
      this.uRes = gl.getUniformLocation(prog, 'uRes');
      this.uTime = gl.getUniformLocation(prog, 'uTime');
      this.uMode = gl.getUniformLocation(prog, 'uMode');
      this.supported = true;
    } catch {
      this.supported = false;
    }
  }

  _compile(gl, type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      gl.deleteShader(s);
      return null;
    }
    return s;
  }

  canAccelerate(effectId) {
    return this.supported && Object.prototype.hasOwnProperty.call(WEBGL_EFFECT_MODES, effectId);
  }

  renderToContext(targetCtx, srcCanvas, width, height, effectId, timeMs = 0) {
    const mode = WEBGL_EFFECT_MODES[effectId];
    if (!this.supported || !mode) return false;

    const gl = this.gl;
    if (this.canvas.width !== width || this.canvas.height !== height) {
      this.canvas.width = width;
      this.canvas.height = height;
      gl.viewport(0, 0, width, height);
    }

    gl.useProgram(this.program);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, srcCanvas);

    gl.uniform2f(this.uRes, width, height);
    gl.uniform1f(this.uTime, (timeMs || 0) * 0.001);
    gl.uniform1i(this.uMode, mode);

    gl.drawArrays(gl.TRIANGLES, 0, 6);

    targetCtx.drawImage(this.canvas, 0, 0, width, height);
    return true;
  }
}

export const gpuAccelerator = new WebGLFilterAccelerator();