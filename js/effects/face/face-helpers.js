/* WebcamClicks — Shared helpers for face-tracking effects */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';

/* ---------- local scratch canvas (for crops) ---------- */
let SCR = null;
export function scratch(w, h) {
  if (!SCR) {
    SCR = makeCanvas(w, h);
    SCR.gx = SCR.getContext('2d', { willReadFrequently: true });
    SCR.cw = w;
    SCR.ch = h;
  }
  if (SCR.cw !== w || SCR.ch !== h) {
    SCR.width = w;
    SCR.height = h;
    SCR.cw = w;
    SCR.ch = h;
  }
  SCR.gx.setTransform(1, 0, 0, 1, 0, 0);
  SCR.gx.globalAlpha = 1;
  SCR.gx.filter = 'none';
  return SCR;
}

/** Landmark geometry helper. Returns null when there is no face. */
export function geo(frame) {
  const pts = frame.face && frame.face.points;
  const box = frame.face && frame.face.box;
  if (!pts || !box) return null;
  const lEye = cent(pts, LM.LEFT_EYE);
  const rEye = cent(pts, LM.RIGHT_EYE);
  const mouth = cent(pts, LM.MOUTH_OUTER);
  const dx = rEye.x - lEye.x;
  const dy = rEye.y - lEye.y;
  const angle = Math.atan2(dy, dx);
  const eyeDist = Math.max(8, Math.hypot(dx, dy));
  const j0 = pts[0], j16 = pts[16], nose = pts[30];
  const headW = Math.max(eyeDist * 1.6, Math.hypot(j16.x - j0.x, j16.y - j0.y));
  const ux = Math.cos(angle), uy = Math.sin(angle);
  const mx = (j0.x + j16.x) / 2, my = (j0.y + j16.y) / 2;
  const off = (nose.x - mx) * ux + (nose.y - my) * uy;
  const yaw = clamp(off / (0.42 * headW), -1, 1);
  return {
    pts, box, lEye, rEye, mouth,
    nose: pts[30],
    chin: pts[8],
    angle,
    eyeDist,
    headW,
    yaw,
    midEye: { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 }
  };
}

/** Robust exponential pose smoother for jitter-free, zero-freezing tracking */
export function smoothGeo(effect, g, dt, smoothMs = 45) {
  if (!g) { effect._s = null; return null; }
  let s = effect._s;
  if (!s || Math.hypot(g.midEye.x - s.x, g.midEye.y - s.y) > g.eyeDist * 2.2) {
    s = effect._s = {
      x: g.midEye.x,
      y: g.midEye.y,
      a: g.angle,
      eyeDist: g.eyeDist,
      headW: g.headW,
      yaw: g.yaw,
      noseX: g.nose.x,
      noseY: g.nose.y,
      boxX: g.box.x,
      boxY: g.box.y,
      boxW: g.box.width,
      boxH: g.box.height
    };
  } else {
    const al = 1 - Math.exp(-clamp(dt, 1, 100) / smoothMs);
    s.x = lerp(s.x, g.midEye.x, al);
    s.y = lerp(s.y, g.midEye.y, al);
    s.a = lerp(s.a, g.angle, al);
    s.eyeDist = lerp(s.eyeDist, g.eyeDist, al);
    s.headW = lerp(s.headW, g.headW, al);
    s.yaw = lerp(s.yaw, g.yaw, al);
    s.noseX = lerp(s.noseX, g.nose.x, al);
    s.noseY = lerp(s.noseY, g.nose.y, al);
    s.boxX = lerp(s.boxX, g.box.x, al);
    s.boxY = lerp(s.boxY, g.box.y, al);
    s.boxW = lerp(s.boxW, g.box.width, al);
    s.boxH = lerp(s.boxH, g.box.height, al);
  }
  return s;
}

export const passthrough = (fx, frame) => fx.drawImage(frame.src, 0, 0, frame.width, frame.height);
