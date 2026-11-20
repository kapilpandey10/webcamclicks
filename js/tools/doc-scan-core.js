/* WebcamClicks — document scanner image processing (no libraries):
   page detection (largest bright region → convex hull → best quadrilateral), perspective correction
   (homography + bilinear sampling) and clean-up filters (shadow removal, adaptive black & white). */

/* ---------------------------------------------------------------- detection */

function otsu(hist, total) {
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let sumB = 0, wB = 0, best = 0, thr = 128;
  for (let i = 0; i < 256; i++) {
    wB += hist[i]; if (!wB) continue;
    const wF = total - wB; if (!wF) break;
    sumB += i * hist[i];
    const mB = sumB / wB, mF = (sum - sumB) / wF, v = wB * wF * (mB - mF) ** 2;
    if (v > best) { best = v; thr = i; }
  }
  return thr;
}

function hull(pts) {
  pts.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of pts) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = pts.length - 1; i >= 0; i--) { const p = pts[i]; while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const area = (q) => Math.abs(q.reduce((a, p, i) => { const n = q[(i + 1) % q.length]; return a + p[0] * n[1] - n[0] * p[1]; }, 0)) / 2;

/** Order 4 points: top-left, top-right, bottom-right, bottom-left. */
export function orderQuad(q) {
  const c = [q.reduce((a, p) => a + p[0], 0) / 4, q.reduce((a, p) => a + p[1], 0) / 4];
  const s = q.slice().sort((a, b) => Math.atan2(a[1] - c[1], a[0] - c[0]) - Math.atan2(b[1] - c[1], b[0] - c[0]));   // clockwise from left
  let start = 0, best = Infinity;
  s.forEach((p, i) => { if (p[0] + p[1] < best) { best = p[0] + p[1]; start = i; } });
  return [0, 1, 2, 3].map((i) => s[(start + i) % 4]);
}

/**
 * Find the document in an image. Returns 4 corners in source pixels [[x,y]×4] (TL, TR, BR, BL) and a confidence.
 * src: ImageBitmap | HTMLImageElement | canvas.
 */
export function detectPage(src) {
  const W0 = src.width || src.naturalWidth || src.videoWidth, H0 = src.height || src.naturalHeight || src.videoHeight;
  const s = Math.min(1, 420 / Math.max(W0, H0)), w = Math.max(8, Math.round(W0 * s)), h = Math.max(8, Math.round(H0 * s));
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.filter = 'blur(2px)'; g.drawImage(src, 0, 0, w, h); g.filter = 'none';
  const d = g.getImageData(0, 0, w, h).data;
  // "paper score": bright and unsaturated
  const score = new Uint8Array(w * h), hist = new Uint32Array(256);
  for (let i = 0, j = 0; i < d.length; i += 4, j++) {
    const r = d[i], gg = d[i + 1], b = d[i + 2], mx = Math.max(r, gg, b), mn = Math.min(r, gg, b);
    const v = Math.max(0, Math.min(255, (0.299 * r + 0.587 * gg + 0.114 * b) - (mx - mn) * 0.6));
    score[j] = v; hist[v | 0]++;
  }
  const thr = otsu(hist, w * h);
  // largest connected bright region (4-neighbour flood fill)
  const lab = new Int32Array(w * h).fill(-1), stack = new Int32Array(w * h);
  let bestSize = 0, bestLab = -1, nl = 0;
  for (let p = 0; p < w * h; p++) {
    if (lab[p] !== -1 || score[p] <= thr) continue;
    let sp = 0, size = 0; stack[sp++] = p; lab[p] = nl;
    while (sp) {
      const q = stack[--sp]; size++;
      const x = q % w, y = (q / w) | 0;
      if (x > 0 && lab[q - 1] === -1 && score[q - 1] > thr) { lab[q - 1] = nl; stack[sp++] = q - 1; }
      if (x < w - 1 && lab[q + 1] === -1 && score[q + 1] > thr) { lab[q + 1] = nl; stack[sp++] = q + 1; }
      if (y > 0 && lab[q - w] === -1 && score[q - w] > thr) { lab[q - w] = nl; stack[sp++] = q - w; }
      if (y < h - 1 && lab[q + w] === -1 && score[q + w] > thr) { lab[q + w] = nl; stack[sp++] = q + w; }
    }
    if (size > bestSize) { bestSize = size; bestLab = nl; }
    nl++;
  }
  const full = () => ({ quad: [[W0 * 0.04, H0 * 0.04], [W0 * 0.96, H0 * 0.04], [W0 * 0.96, H0 * 0.96], [W0 * 0.04, H0 * 0.96]], confidence: 0 });
  if (bestLab < 0 || bestSize < w * h * 0.08) return full();
  // boundary points of that region
  const pts = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const q = y * w + x; if (lab[q] !== bestLab) continue;
    if (x === 0 || y === 0 || x === w - 1 || y === h - 1 || lab[q - 1] !== bestLab || lab[q + 1] !== bestLab || lab[q - w] !== bestLab || lab[q + w] !== bestLab) pts.push([x, y]);
  }
  let hl = hull(pts);
  // thin the hull so the 4-point search stays fast
  while (hl.length > 48) hl = hl.filter((_, i) => i % 2 === 0);
  let best = null, bestA = 0;
  const n = hl.length;
  for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) for (let cc = b + 1; cc < n; cc++) for (let e = cc + 1; e < n; e++) {
    const q = [hl[a], hl[b], hl[cc], hl[e]], A = area(q);
    if (A > bestA) { bestA = A; best = q; }
  }
  if (!best) return full();
  // how well does the quad explain the region? (paper is a quadrilateral, clutter is not)
  const fill = bestSize / bestA;
  const quad = orderQuad(best).map(([x, y]) => [x / s, y / s]);
  const coversAll = bestA > w * h * 0.97;
  return { quad, confidence: coversAll ? 0.2 : Math.max(0, Math.min(1, (fill - 0.75) * 4)) };
}

/* ---------------------------------------------------------------- perspective */

/** Homography mapping unit square corners (0,0),(1,0),(1,1),(0,1) → quad. */
function squareToQuad(q) {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3, dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  let g = 0, hh = 0;
  if (Math.abs(dx3) > 1e-9 || Math.abs(dy3) > 1e-9) {
    const den = dx1 * dy2 - dx2 * dy1;
    g = (dx3 * dy2 - dx2 * dy3) / den; hh = (dx1 * dy3 - dx3 * dy1) / den;
  }
  return [x1 - x0 + g * x1, x3 - x0 + hh * x3, x0, y1 - y0 + g * y1, y3 - y0 + hh * y3, y0, g, hh];
}

export function outputSize(q, maxSide = 2480) {
  const d = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
  // average opposite edges (max exaggerates perspective), then snap to a standard paper shape when close
  let w = (d(q[0], q[1]) + d(q[3], q[2])) / 2, h = (d(q[0], q[3]) + d(q[1], q[2])) / 2;
  const r = Math.max(w, h) / Math.min(w, h);
  for (const std of [Math.SQRT2 /* A-series */, 11 / 8.5 /* US Letter */, 85.6 / 53.98 /* ID / bank card */]) {
    if (Math.abs(r - std) / std < 0.09) { if (w > h) w = h * std; else h = w * std; break; }
  }
  const k = Math.min(1.6, maxSide / Math.max(w, h));   // allow a little upsampling for small captures
  return [Math.max(16, Math.round(w * k)), Math.max(16, Math.round(h * k))];
}

/** Straighten the quad from src into a W×H canvas. */
export function warp(src, quad, W, H) {
  const sw = src.width || src.naturalWidth, sh = src.height || src.naturalHeight;
  const sc = document.createElement('canvas'); sc.width = sw; sc.height = sh;
  const sg = sc.getContext('2d', { willReadFrequently: true }); sg.drawImage(src, 0, 0);
  const sd = sg.getImageData(0, 0, sw, sh).data;
  const out = document.createElement('canvas'); out.width = W; out.height = H;
  const og = out.getContext('2d'), img = og.createImageData(W, H), od = img.data;
  const [a, b, c, d, e, f, g, h] = squareToQuad(quad);
  for (let y = 0; y < H; y++) {
    const v = (y + 0.5) / H;
    for (let x = 0; x < W; x++) {
      const u = (x + 0.5) / W, z = g * u + h * v + 1;
      let px = (a * u + b * v + c) / z - 0.5, py = (d * u + e * v + f) / z - 0.5;
      px = Math.max(0, Math.min(sw - 1.001, px)); py = Math.max(0, Math.min(sh - 1.001, py));
      const x0 = px | 0, y0 = py | 0, fx = px - x0, fy = py - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4, o = (y * W + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = sd[i00 + k] + (sd[i10 + k] - sd[i00 + k]) * fx, bot = sd[i01 + k] + (sd[i11 + k] - sd[i01 + k]) * fx;
        od[o + k] = top + (bot - top) * fy;
      }
      od[o + 3] = 255;
    }
  }
  og.putImageData(img, 0, 0);
  return out;
}

/* ---------------------------------------------------------------- clean-up filters */

function boxBlurLuma(L, w, h, r) {
  // separable box blur via running sums on a Float32 luma plane
  const tmp = new Float32Array(w * h), out = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    let s = 0; const row = y * w;
    for (let x = -r; x <= r; x++) s += L[row + Math.min(w - 1, Math.max(0, x))];
    for (let x = 0; x < w; x++) { tmp[row + x] = s / (2 * r + 1); s += L[row + Math.min(w - 1, x + r + 1)] - L[row + Math.max(0, x - r)]; }
  }
  for (let x = 0; x < w; x++) {
    let s = 0;
    for (let y = -r; y <= r; y++) s += tmp[Math.min(h - 1, Math.max(0, y)) * w + x];
    for (let y = 0; y < h; y++) { out[y * w + x] = s / (2 * r + 1); s += tmp[Math.min(h - 1, y + r + 1) * w + x] - tmp[Math.max(0, y - r) * w + x]; }
  }
  return out;
}

/** mode: 'color' (shadow-free, vivid) | 'grey' | 'bw' (crisp text) | 'original'. Works in place on a canvas. */
export function cleanUp(canvas, mode, strength = 1) {
  if (mode === 'original') return canvas;
  const w = canvas.width, h = canvas.height, g = canvas.getContext('2d', { willReadFrequently: true });
  const img = g.getImageData(0, 0, w, h), d = img.data, n = w * h;
  const L = new Float32Array(n);
  for (let i = 0, j = 0; j < n; i += 4, j++) L[j] = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
  // the paper's brightness everywhere (large blur of a "max-ish" version) → divide it out = no shadows
  const r = Math.max(8, Math.round(Math.max(w, h) / 40));
  const bg = boxBlurLuma(L, w, h, r), bg2 = boxBlurLuma(bg, w, h, r);
  if (mode === 'bw') {
    const mean = boxBlurLuma(L, w, h, Math.max(6, Math.round(Math.max(w, h) / 90)));
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const norm = L[j] / Math.max(30, Math.max(bg2[j], mean[j]));
      const ink = L[j] < mean[j] * (0.88 - 0.04 * strength) || norm < 0.55;
      const v = ink ? 0 : 255;
      d[i] = d[i + 1] = d[i + 2] = v;
    }
  } else {
    for (let i = 0, j = 0; j < n; i += 4, j++) {
      const k = 245 / Math.max(40, bg2[j]);   // white-balance the paper to ~245
      for (let c = 0; c < 3; c++) {
        let v = d[i + c] * (1 + (k - 1) * strength);
        v = (v - 18) * 1.08;   // a little contrast so ink is black
        d[i + c] = v < 0 ? 0 : v > 255 ? 255 : v;
      }
      if (mode === 'grey') { const y = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]; d[i] = d[i + 1] = d[i + 2] = y; }
    }
  }
  g.putImageData(img, 0, 0);
  return canvas;
}
