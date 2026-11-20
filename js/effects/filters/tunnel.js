/* WebcamClicks — Warp Tunnel.
   Your face sits in a glowing window at the far end of an endless neon tunnel whose
   walls are built from the live camera image streaming toward you.

   The main renderer is the GPU shader (mode 19 in webgl-filters.js). This CPU version
   is the fallback for browsers without WebGL; it runs at reduced resolution. */

import { ensureScratch, getHeadPose } from './filter-helpers.js';
import { isMobile } from '../../utils.js';

let srcCopy = new Uint8ClampedArray(0);
let smooth = null;

export const tunnelEffect = {
  id: 'tunnel', name: 'Warp Tunnel', icon: '🌀', category: 'Distort', perf: 'medium',
  followsFace: true,
  description: 'Your face in a glowing window at the end of an endless neon tunnel, with walls made from your camera feed rushing toward you.',

  render(fx, frame) {
    const { src, width: W, height: H } = frame;
    const t = (frame.time || 0) * 0.001;

    // work at reduced resolution — this path only runs without WebGL
    const maxDim = isMobile() ? 320 : 480;
    const scale = Math.min(1, maxDim / Math.max(W, H));
    const w = Math.max(64, Math.round(W * scale));
    const h = Math.max(36, Math.round(H * scale));
    const sc = ensureScratch(w, h);
    sc.gx.drawImage(src, 0, 0, w, h);
    const img = sc.gx.getImageData(0, 0, w, h);
    const out = img.data;
    if (srcCopy.length !== out.length) srcCopy = new Uint8ClampedArray(out.length);
    srcCopy.set(out);   // read from a copy so we never sample pixels we've already overwritten

    // smoothed face-centred window
    const pose = getHeadPose(frame);
    const target = { x: pose.cx / W, y: pose.cy / H, r: Math.max(pose.w, pose.h) / H * 0.5 };
    smooth = smooth || { ...target };
    smooth.x += (target.x - smooth.x) * 0.18;
    smooth.y += (target.y - smooth.y) * 0.18;
    smooth.r += (target.r - smooth.r) * 0.18;

    const cx = smooth.x * w, cy = smooth.y * h;
    const R0 = Math.min(0.36, Math.max(0.2, smooth.r * 1.35)) * h * (1 + 0.025 * Math.sin(t * 2.2));
    const travel = t * 0.9;
    const TAU = Math.PI * 2;
    const mirror = (v) => { const m = ((v % 2) + 2) % 2; return m > 1 ? 2 - m : m; };

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.hypot(dx, dy);
        const o = (y * w + x) * 4;
        const ang = Math.atan2(dy, dx);
        const mixN = 0.5 + 0.5 * Math.sin(ang * 2 + t * 1.3);
        const nr = 255 * (1 - mixN) + 25 * mixN, ng = 46 * (1 - mixN) + 235 * mixN, nb = 158 * (1 - mixN) + 255 * mixN;

        if (r < R0) {
          const inner = Math.min(1, (R0 - r) / (0.05 * h));
          const k = 0.72 + 0.28 * inner;
          const rim = Math.max(0, 1 - Math.abs(r - R0 + 2) / 3);
          out[o] = Math.min(255, srcCopy[o] * k + nr * rim);
          out[o + 1] = Math.min(255, srcCopy[o + 1] * k + ng * rim);
          out[o + 2] = Math.min(255, srcCopy[o + 2] * k + nb * rim);
          continue;
        }

        const depth = R0 / r;
        const z = 1 / depth;
        const u = ang / TAU + 0.5;
        const sx = Math.min(w - 1, (mirror(u * 2) * (w - 1)) | 0);
        const sy = Math.min(h - 1, (mirror((z * 0.55 - travel) * 0.5) * (h - 1)) | 0);
        const si = (sy * w + sx) * 4;
        const light = Math.pow(depth, 0.8);
        const shade = 0.18 + 0.82 * light;
        const ringPos = ((z * 0.9 - travel * 1.2) % 1 + 1) % 1;
        const ring = Math.max(0, 1 - Math.abs(ringPos - 0.5) / (0.06 * depth + 0.012));
        const glow = Math.exp(-((r - R0) / h) * 22) * 0.55;
        const n = ring * (0.35 + 0.9 * light) + glow;
        out[o] = Math.min(255, srcCopy[si] * 0.78 * shade + nr * n);
        out[o + 1] = Math.min(255, srcCopy[si + 1] * 0.82 * shade + ng * n);
        out[o + 2] = Math.min(255, srcCopy[si + 2] * shade + nb * n);
      }
    }
    sc.gx.putImageData(img, 0, 0);
    fx.drawImage(sc, 0, 0, w, h, 0, 0, W, H);
  },

  destroy() { smooth = null; }
};

export default tunnelEffect;
