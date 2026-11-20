/* WebcamClicks — photo enhancer processing (runs in a module Worker).
   Input: { data (Uint8ClampedArray RGBA), width, height, opts }  →  Output: enhanced RGBA. */

const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

function percentile(hist, total, p) {
  let acc = 0;
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc >= total * p) return i; }
  return 255;
}

function enhance(d, w, h, o) {
  const n = w * h;
  const s = o.strength;   // 0..1 overall

  /* 1) auto levels + white balance (per-channel percentile stretch, blended by strength) */
  if (o.levels || o.color) {
    const hr = new Uint32Array(256), hg = new Uint32Array(256), hb = new Uint32Array(256), hl = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) { hr[d[i]]++; hg[d[i + 1]]++; hb[d[i + 2]]++; hl[(d[i] * 54 + d[i + 1] * 183 + d[i + 2] * 19) >> 8]++; }
    const lo = 0.004, hi = 0.996;
    const chan = [hr, hg, hb].map((hh) => [percentile(hh, n, lo), percentile(hh, n, hi)]);
    const lum = [percentile(hl, n, lo), percentile(hl, n, hi)];
    const luts = chan.map(([a, b], c) => {
      // colour: stretch each channel on its own (neutralises casts); levels only: same stretch for all
      const [x0, x1] = o.color ? [a, b] : lum;
      const lut = new Uint8ClampedArray(256);
      const span = Math.max(24, x1 - x0);
      for (let v = 0; v < 256; v++) { const st = ((v - x0) / span) * 255; lut[v] = clamp8(v + (st - v) * s * 0.9); }
      return lut;
    });
    for (let i = 0; i < d.length; i += 4) { d[i] = luts[0][d[i]]; d[i + 1] = luts[1][d[i + 1]]; d[i + 2] = luts[2][d[i + 2]]; }
  }

  /* 2) exposure: gamma towards a pleasant mid-tone, lift shadows */
  if (o.light) {
    let sum = 0;
    for (let i = 0; i < d.length; i += 16) sum += d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
    const mean = sum / (d.length / 16) / 255;
    const gamma = Math.min(1.6, Math.max(0.6, Math.log(0.46) / Math.log(Math.max(0.05, Math.min(0.95, mean)))));
    const g = 1 + (gamma - 1) * s;
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = Math.pow(v / 255, g);
      x += Math.max(0, 0.18 - x) * 0.35 * s;   // gentle shadow lift
      lut[v] = clamp8(x * 255);
    }
    for (let i = 0; i < d.length; i += 4) { d[i] = lut[d[i]]; d[i + 1] = lut[d[i + 1]]; d[i + 2] = lut[d[i + 2]]; }
  }

  /* 3) vibrance: boost muted colours more than already-saturated ones */
  if (o.vibrance > 0) {
    const vb = o.vibrance * s;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), sat = (mx - mn) / 255;
      const amt = vb * (1 - sat) * 0.8;
      const l = r * 0.299 + g * 0.587 + b * 0.114;
      d[i] = clamp8(l + (r - l) * (1 + amt)); d[i + 1] = clamp8(l + (g - l) * (1 + amt)); d[i + 2] = clamp8(l + (b - l) * (1 + amt));
    }
  }

  /* 4) denoise in YCbCr: edge-preserving on luma, stronger smoothing on chroma */
  if (o.denoise > 0) {
    const Y = new Float32Array(n), Cb = new Float32Array(n), Cr = new Float32Array(n);
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      Y[p] = 0.299 * r + 0.587 * g + 0.114 * b; Cb[p] = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b; Cr[p] = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
    }
    const boxBlur = (src, rad) => {   // separable box blur
      const tmp = new Float32Array(n), out = new Float32Array(n);
      for (let y = 0; y < h; y++) { let acc = 0; const row = y * w; for (let x = -rad; x <= rad; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
        for (let x = 0; x < w; x++) { tmp[row + x] = acc / (2 * rad + 1); acc += src[row + Math.min(w - 1, x + rad + 1)] - src[row + Math.max(0, x - rad)]; } }
      for (let x = 0; x < w; x++) { let acc = 0; for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
        for (let y = 0; y < h; y++) { out[y * w + x] = acc / (2 * rad + 1); acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x]; } }
      return out;
    };
    const cr = Math.max(1, Math.round(1 + o.denoise * 3));
    const Cb2 = boxBlur(Cb, cr), Cr2 = boxBlur(Cr, cr);
    // luma: 5x5 bilateral (range sigma scales with strength)
    const sr = 6 + o.denoise * 22, inv = -1 / (2 * sr * sr);
    const wts = new Float32Array(256); for (let k = 0; k < 256; k++) wts[k] = Math.exp(k * k * inv);
    const sp = [0.6, 0.85, 1, 0.85, 0.6];
    const Y2 = new Float32Array(n);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = Y[y * w + x]; let acc = 0, ws = 0;
      for (let dy = -2; dy <= 2; dy++) { const yy = Math.min(h - 1, Math.max(0, y + dy)) * w;
        for (let dx = -2; dx <= 2; dx++) { const v = Y[yy + Math.min(w - 1, Math.max(0, x + dx))]; const wt = wts[Math.min(255, Math.abs(v - c) | 0)] * sp[dy + 2] * sp[dx + 2]; acc += v * wt; ws += wt; } }
      Y2[y * w + x] = c + (acc / ws - c) * Math.min(1, o.denoise * 1.2);
    }
    for (let p = 0, i = 0; p < n; p++, i += 4) {
      const yv = Y2[p], cb = Cb2[p] - 128, crr = Cr2[p] - 128;
      d[i] = clamp8(yv + 1.402 * crr); d[i + 1] = clamp8(yv - 0.344136 * cb - 0.714136 * crr); d[i + 2] = clamp8(yv + 1.772 * cb);
    }
  }
  return d;
}

/** Unsharp mask on luminance (no colour fringes). */
function sharpen(d, w, h, amount, radius = 1) {
  if (amount <= 0) return d;
  const n = w * h, L = new Float32Array(n);
  for (let p = 0, i = 0; p < n; p++, i += 4) L[p] = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
  // gaussian-ish blur via two box passes
  const blur = (src, rad) => {
    const tmp = new Float32Array(n), out = new Float32Array(n), k = 2 * rad + 1;
    for (let y = 0; y < h; y++) { const row = y * w; let acc = 0; for (let x = -rad; x <= rad; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))];
      for (let x = 0; x < w; x++) { tmp[row + x] = acc / k; acc += src[row + Math.min(w - 1, x + rad + 1)] - src[row + Math.max(0, x - rad)]; } }
    for (let x = 0; x < w; x++) { let acc = 0; for (let y = -rad; y <= rad; y++) acc += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
      for (let y = 0; y < h; y++) { out[y * w + x] = acc / k; acc += tmp[Math.min(h - 1, y + rad + 1) * w + x] - tmp[Math.max(0, y - rad) * w + x]; } }
    return out;
  };
  const B = blur(blur(L, radius), radius);
  for (let p = 0, i = 0; p < n; p++, i += 4) {
    let diff = L[p] - B[p];
    if (Math.abs(diff) < 2) diff = 0;   // threshold: don't sharpen noise
    const add = diff * amount;
    d[i] = clamp8(d[i] + add); d[i + 1] = clamp8(d[i + 1] + add); d[i + 2] = clamp8(d[i + 2] + add);
  }
  return d;
}

self.onmessage = (e) => {
  const { id, data, width, height, opts, stage } = e.data;
  try {
    const out = stage === 'sharpen' ? sharpen(data, width, height, opts.sharpen, opts.radius || 1) : enhance(data, width, height, opts);
    self.postMessage({ id, data: out, width, height }, [out.buffer]);
  } catch (err) { self.postMessage({ id, error: String(err && err.message || err) }); }
};
