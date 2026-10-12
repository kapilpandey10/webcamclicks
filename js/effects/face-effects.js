/* WebcamClicks — face-detection effects.
   All effects here use 68-point landmarks from face-api.js (on-device).
   When no face is visible they fall back to a clean pass-through frame. */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../utils.js';
import { LM, cent } from '../face/face-detection.js';

/* ---------- local scratch canvas (for crops) ---------- */
let SCR = null;
function scratch(w, h) {
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
function geo(frame) {
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
function smoothGeo(effect, g, dt, smoothMs = 45) {
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

const passthrough = (fx, frame) => fx.drawImage(frame.src, 0, 0, frame.width, frame.height);

/* ==========================================================================
   Royal Crown (premium) — Cached sprite, pose smoothing, glint & sparkles
   ========================================================================== */

/* ---------- tweakables ---------- */
export const CROWN_CFG = {
  lift: 1.05,    // front/bottom edge of the band, in eye-distances above the eye line
  widthK: 0.98,  // crown width relative to jaw-to-jaw head width
  dome: true,    // velvet cap + arch + orb & cross (false = open "tiara" style crown)
  glint: true,   // periodic light sweep across the gold
  sparkle: true, // twinkles on the gems
  smoothMs: 55   // pose smoothing time-constant (higher = steadier, lower = snappier)
};

/* ---------- sprite geometry (1 unit = 1 sprite pixel; origin = centre of the band's bottom rim) ---------- */
const RX = 300;          // band half-width
const RY = 46;           // perspective depth of the rim ellipse
const BH = 120;          // band wall height
const SW = 700, TOP = 480, BOT = 80, SH = TOP + BOT;
const ORG_X = SW / 2, ORG_Y = TOP;
const D2R = Math.PI / 180;

const ell = (x) => RY * Math.sqrt(Math.max(0, 1 - (x / RX) ** 2)); // rim curvature at x
const PT_DEG = [-72, -36, 0, 36, 72];
const PT_H = [118, 168, 212, 168, 118];
const PT_PEARL = [14, 17, 21, 17, 14];
const VAL_DEG = [-90, -54, -18, 18, 54, 90];
const VAL_H = [8, 30, 36, 36, 30, 8];

const PTS = PT_DEG.map((d, i) => {
  const x = RX * Math.sin(d * D2R);
  return { x, y: -BH + ell(x) - PT_H[i], r: PT_PEARL[i], d };
});
const VAL = VAL_DEG.map((d, i) => {
  const x = RX * Math.sin(d * D2R);
  return { x, y: -BH + ell(x) - VAL_H[i] };
});

const DOME_H = 205, DOME_A = RX * 0.96, DOME_Y0 = -BH + 4;
const APEX_Y = DOME_Y0 - DOME_H;

/* ---------- small drawing helpers ---------- */
function goldGrad(c, x0, x1) {
  const g = c.createLinearGradient(x0, 0, x1, 0);
  [[0, '#6e4204'], [0.07, '#b07a14'], [0.2, '#f4cf62'], [0.3, '#fff0b0'], [0.4, '#e9b73a'],
   [0.56, '#c48a1a'], [0.7, '#93600c'], [0.8, '#d9a02a'], [0.87, '#f6d776'], [0.95, '#a06a0e'],
   [1, '#60380a']].forEach(([o, col]) => g.addColorStop(o, col));
  return g;
}

function goldBall(c, x, y, r) {
  const g = c.createRadialGradient(x - r * 0.35, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, '#fff6c8');
  g.addColorStop(0.45, '#e9b43a');
  g.addColorStop(1, '#7a4a05');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
}

function pearl(c, x, y, r) {
  c.save();
  c.fillStyle = 'rgba(40,20,0,0.35)';
  c.beginPath();
  c.arc(x + r * 0.12, y + r * 0.2, r * 1.05, 0, Math.PI * 2);
  c.fill();
  const g = c.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.05, x, y, r);
  g.addColorStop(0, '#ffffff');
  g.addColorStop(0.35, '#f7f2ea');
  g.addColorStop(0.75, '#d6cdbf');
  g.addColorStop(1, '#8f8777');
  c.fillStyle = g;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  const rose = c.createRadialGradient(x + r * 0.4, y + r * 0.5, 0, x + r * 0.4, y + r * 0.5, r * 0.8);
  rose.addColorStop(0, 'rgba(238,184,200,0.45)');
  rose.addColorStop(1, 'rgba(238,184,200,0)');
  c.fillStyle = rose;
  c.beginPath();
  c.arc(x, y, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.9)';
  c.beginPath();
  c.ellipse(x - r * 0.35, y - r * 0.4, r * 0.22, r * 0.13, -0.7, 0, Math.PI * 2);
  c.fill();
  c.restore();
}

const GEMS = {
  ruby: { light: '#ff7185', base: '#d0102c', dark: '#5e0414' },
  sapphire: { light: '#8ab4ff', base: '#1c4fd6', dark: '#071d57' },
  emerald: { light: '#86f5b8', base: '#10a05a', dark: '#034a29' },
  diamond: { light: '#ffffff', base: '#cfe6ff', dark: '#7f9fc8' }
};

/** Faceted gem in a gold bezel. hw/hh = half width / height of the stone. */
function gem(c, x, y, hw, hh, col, bezel = true) {
  if (bezel) {
    c.fillStyle = '#4a2a02';
    c.beginPath();
    c.ellipse(x, y, hw + 8, hh + 8, 0, 0, Math.PI * 2);
    c.fill();
    const bg = c.createLinearGradient(0, y - hh - 7, 0, y + hh + 7);
    bg.addColorStop(0, '#fff0b0');
    bg.addColorStop(0.5, '#d9a02c');
    bg.addColorStop(1, '#7d4d07');
    c.fillStyle = bg;
    c.beginPath();
    c.ellipse(x, y, hw + 6.5, hh + 6.5, 0, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#2e1900';
    c.beginPath();
    c.ellipse(x, y, hw + 2.5, hh + 2.5, 0, 0, Math.PI * 2);
    c.fill();
  }
  const N = 8;
  const V = (k, s) => ({
    x: x + hw * s * Math.cos((k * 360 / N) * D2R),
    y: y + hh * s * Math.sin((k * 360 / N) * D2R)
  });
  const poly = (pts) => {
    c.beginPath();
    pts.forEach((p, i) => (i ? c.lineTo(p.x, p.y) : c.moveTo(p.x, p.y)));
    c.closePath();
  };
  const outer = Array.from({ length: N }, (_, k) => V(k, 1));
  const inner = Array.from({ length: N }, (_, k) => V(k, 0.52));

  c.save();
  poly(outer);
  c.clip();
  const bg = c.createRadialGradient(x - hw * 0.2, y - hh * 0.25, 0, x, y, Math.max(hw, hh) * 1.15);
  bg.addColorStop(0, col.light);
  bg.addColorStop(0.55, col.base);
  bg.addColorStop(1, col.dark);
  c.fillStyle = bg;
  c.fillRect(x - hw - 2, y - hh - 2, 2 * hw + 4, 2 * hw + 4);

  // crown facets, lit from the top-left
  for (let k = 0; k < N; k++) {
    const k2 = (k + 1) % N;
    const am = ((k + 0.5) * 360 / N) * D2R;
    const lit = Math.cos(am) * -0.6 + Math.sin(am) * -0.8;
    poly([outer[k], outer[k2], inner[k2], inner[k]]);
    c.fillStyle = lit > 0 ? `rgba(255,255,255,${0.5 * lit})` : `rgba(0,0,0,${0.42 * -lit})`;
    c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.32)';
    c.lineWidth = 1;
    c.stroke();
  }
  // table
  poly(inner);
  const tg = c.createLinearGradient(x - hw * 0.5, y - hh * 0.5, x + hw * 0.5, y + hh * 0.5);
  tg.addColorStop(0, 'rgba(255,255,255,0.6)');
  tg.addColorStop(0.5, 'rgba(255,255,255,0.08)');
  tg.addColorStop(1, 'rgba(0,0,0,0.25)');
  c.fillStyle = tg;
  c.fill();
  c.strokeStyle = 'rgba(255,255,255,0.45)';
  c.lineWidth = 1;
  c.stroke();
  c.restore();

  // glints
  c.fillStyle = 'rgba(255,255,255,0.88)';
  c.beginPath();
  c.ellipse(x - hw * 0.34, y - hh * 0.38, hw * 0.2, hh * 0.11, -0.6, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = 'rgba(255,255,255,0.45)';
  c.beginPath();
  c.arc(x + hw * 0.42, y + hh * 0.42, Math.max(1, hw * 0.07), 0, Math.PI * 2);
  c.fill();
}

/* ---------- shape tracers ---------- */
const curveUp = (c, v, p) => c.quadraticCurveTo(p.x + (v.x - p.x) * 0.2, v.y + (p.y - v.y) * 0.1, p.x, p.y);
const curveDown = (c, p, v) => c.quadraticCurveTo(p.x + (v.x - p.x) * 0.2, v.y + (p.y - v.y) * 0.1, v.x, v.y);

function traceFront(c) {
  c.beginPath();
  c.moveTo(VAL[0].x, VAL[0].y);
  for (let i = 0; i < PTS.length; i++) {
    curveUp(c, VAL[i], PTS[i]);
    curveDown(c, PTS[i], VAL[i + 1]);
  }
  c.lineTo(RX, 0);
  c.ellipse(0, 0, RX, RY, 0, 0, Math.PI, false);
  c.closePath();
}

function traceDome(c) {
  c.moveTo(-DOME_A, DOME_Y0);
  c.bezierCurveTo(-DOME_A, DOME_Y0 - DOME_H * 1.05, -DOME_A * 0.42, APEX_Y, 0, APEX_Y);
  c.bezierCurveTo(DOME_A * 0.42, APEX_Y, DOME_A, DOME_Y0 - DOME_H * 1.05, DOME_A, DOME_Y0);
}

/* ---------- sprite construction ---------- */
let SPRITE = null;

function buildSprite() {
  const cv = makeCanvas(SW, SH);
  const c = cv.getContext('2d');
  const mask = makeCanvas(SW, SH);
  const m = mask.getContext('2d');
  const sparks = [];

  c.translate(ORG_X, ORG_Y);
  m.translate(ORG_X, ORG_Y);
  m.fillStyle = '#fff';
  m.strokeStyle = '#fff';

  /* 1. soft contact shadow under the band (falls on the forehead) */
  c.save();
  c.translate(0, 34);
  c.scale(1, 40 / RX);
  const sh = c.createRadialGradient(0, 0, 0, 0, 0, RX * 1.02);
  sh.addColorStop(0, 'rgba(0,0,0,0.42)');
  sh.addColorStop(0.6, 'rgba(0,0,0,0.22)');
  sh.addColorStop(1, 'rgba(0,0,0,0)');
  c.fillStyle = sh;
  c.beginPath();
  c.arc(0, 0, RX * 1.02, 0, Math.PI * 2);
  c.fill();
  c.restore();

  /* 2. velvet cap, gold arch, orb & cross */
  if (CROWN_CFG.dome) {
    c.save();
    c.beginPath();
    traceDome(c);
    c.closePath();
    const vg = c.createRadialGradient(-DOME_A * 0.25, DOME_Y0 - DOME_H * 0.7, 10, 0, DOME_Y0 - DOME_H * 0.3, DOME_A * 1.05);
    vg.addColorStop(0, '#d11a38');
    vg.addColorStop(0.55, '#92092a');
    vg.addColorStop(1, '#430313');
    c.fillStyle = vg;
    c.fill();
    c.clip();
    const sheen = c.createLinearGradient(-DOME_A, 0, DOME_A, 0);
    sheen.addColorStop(0, 'rgba(0,0,0,0.35)');
    sheen.addColorStop(0.28, 'rgba(255,130,150,0.22)');
    sheen.addColorStop(0.5, 'rgba(255,255,255,0)');
    sheen.addColorStop(0.8, 'rgba(0,0,0,0.12)');
    sheen.addColorStop(1, 'rgba(0,0,0,0.4)');
    c.fillStyle = sheen;
    c.fillRect(-DOME_A, APEX_Y - 4, DOME_A * 2, DOME_H + 20);
    // faint velvet folds
    c.lineWidth = 6;
    for (let i = -3; i <= 3; i++) {
      const fx0 = i * DOME_A * 0.27;
      c.strokeStyle = `rgba(0,0,0,${0.07 + (i % 2 ? 0.04 : 0)})`;
      c.beginPath();
      c.moveTo(fx0 * 0.6, APEX_Y + 6);
      c.quadraticCurveTo(fx0 * 1.05, DOME_Y0 - DOME_H * 0.5, fx0, DOME_Y0);
      c.stroke();
    }
    c.restore();

    // gold ridge following the dome outline (reads as the arch)
    c.save();
    c.lineJoin = 'round';
    c.beginPath(); traceDome(c);
    c.strokeStyle = '#5b3504'; c.lineWidth = 24; c.stroke();
    c.beginPath(); traceDome(c);
    c.strokeStyle = goldGrad(c, -DOME_A, DOME_A); c.lineWidth = 19; c.stroke();
    c.save();
    c.translate(-2, -3);
    c.beginPath(); traceDome(c);
    c.strokeStyle = 'rgba(255,248,200,0.55)'; c.lineWidth = 5; c.stroke();
    c.restore();
    c.restore();
    m.lineWidth = 22; m.beginPath(); traceDome(m); m.stroke();

    // centre rib
    const rib = c.createLinearGradient(-10, 0, 10, 0);
    rib.addColorStop(0, '#6e4204'); rib.addColorStop(0.35, '#fff0b0'); rib.addColorStop(0.7, '#c48a1a'); rib.addColorStop(1, '#6e4204');
    c.fillStyle = rib;
    c.fillRect(-10, APEX_Y - 4, 20, 90);
    m.fillRect(-10, APEX_Y - 4, 20, 90);

    // orb
    const orbR = 25, orbY = APEX_Y - 16;
    goldBall(c, 0, orbY, orbR);
    c.strokeStyle = 'rgba(70,40,0,0.6)'; c.lineWidth = 2;
    c.beginPath(); c.ellipse(0, orbY, orbR, orbR * 0.22, 0, 0, Math.PI); c.stroke();
    c.strokeStyle = 'rgba(255,240,180,0.5)';
    c.beginPath(); c.ellipse(0, orbY + 2.5, orbR, orbR * 0.22, 0, 0, Math.PI); c.stroke();
    m.beginPath(); m.arc(0, orbY, orbR, 0, Math.PI * 2); m.fill();

    // cross bottony
    const cy = orbY - orbR - 40;
    const bar = c.createLinearGradient(-8, 0, 8, 0);
    bar.addColorStop(0, '#7a4a05'); bar.addColorStop(0.4, '#ffe9a0'); bar.addColorStop(0.7, '#d29a22'); bar.addColorStop(1, '#6e4204');
    c.fillStyle = bar;
    c.fillRect(-8, cy - 36, 16, 78);
    m.fillRect(-8, cy - 36, 16, 78);
    const hbar = c.createLinearGradient(0, cy - 8, 0, cy + 8);
    hbar.addColorStop(0, '#fff0b0'); hbar.addColorStop(0.5, '#d9a02c'); hbar.addColorStop(1, '#7a4a05');
    c.fillStyle = hbar;
    c.fillRect(-32, cy - 8, 64, 16);
    m.fillRect(-32, cy - 8, 64, 16);
    for (const [bx, by] of [[0, cy - 38], [-34, cy], [34, cy]]) {
      goldBall(c, bx, by, 11);
      m.beginPath(); m.arc(bx, by, 11, 0, Math.PI * 2); m.fill();
    }
    gem(c, 0, cy, 6, 6, GEMS.ruby, false);
    sparks.push({ x: 0, y: cy, r: 16 });
  }

  /* 3. gold body (band + five spires) */
  c.save();
  c.fillStyle = goldGrad(c, -RX, RX);
  traceFront(c);
  c.fill();
  m.fillStyle = '#fff';
  traceFront(m);
  m.fill();

  c.save();
  traceFront(c);
  c.clip();
  const vs = c.createLinearGradient(0, -BH - 230, 0, RY);
  vs.addColorStop(0, 'rgba(255,240,190,0.16)');
  vs.addColorStop(0.55, 'rgba(0,0,0,0)');
  vs.addColorStop(1, 'rgba(40,20,0,0.40)');
  c.fillStyle = vs;
  c.fillRect(-RX, -BH - 240, RX * 2, BH + 240 + RY + 2);
  traceFront(c);
  c.strokeStyle = 'rgba(255,244,190,0.55)';
  c.lineWidth = 9;
  c.stroke();

  /* 4. grooves + beaded rims (clipped to the body) */
  const groove = (yc) => {
    c.beginPath();
    c.ellipse(0, yc, RX - 1, RY, 0, 0, Math.PI);
    c.strokeStyle = 'rgba(70,40,0,0.7)'; c.lineWidth = 2.4; c.stroke();
    c.beginPath();
    c.ellipse(0, yc + 2.6, RX - 1, RY, 0, 0, Math.PI);
    c.strokeStyle = 'rgba(255,240,180,0.55)'; c.lineWidth = 1.7; c.stroke();
  };
  groove(-BH + 19);
  groove(-20);

  const bead = (x, y, r) => goldBall(c, x, y, r);
  for (let d = -86; d <= 86; d += 3.2) {
    const x = RX * Math.sin(d * D2R);
    const cs = Math.cos(d * D2R);
    const r = 5.4 * (0.5 + 0.5 * cs);
    bead(x, ell(x) - 10, r);
    bead(x, -BH + ell(x) + 9.5, r);
  }

  /* 5. engraved inlay on every spire */
  PTS.forEach((p, i) => {
    const w = Math.max(7, 0.55 * Math.min(Math.abs(p.x - VAL[i].x), Math.abs(p.x - VAL[i + 1].x)));
    const by = -BH + ell(p.x) + 2;
    const ty = p.y + 34;
    const trace = () => {
      c.beginPath();
      c.moveTo(p.x - w, by);
      c.quadraticCurveTo(p.x - w * 0.2, by + (ty - by) * 0.1, p.x, ty);
      c.quadraticCurveTo(p.x + w * 0.2, by + (ty - by) * 0.1, p.x + w, by);
    };
    trace(); c.fillStyle = 'rgba(110,62,0,0.16)'; c.fill();
    trace(); c.strokeStyle = 'rgba(80,44,0,0.6)'; c.lineWidth = 2.2; c.stroke();
    c.save(); c.translate(1.6, 1.8);
    trace(); c.strokeStyle = 'rgba(255,240,180,0.5)'; c.lineWidth = 1.5; c.stroke();
    c.restore();
  });
  c.restore(); // end clip

  /* 6. jewels + pearls on the band */
  const jewels = [
    { d: 0, hw: 37, hh: 31, col: GEMS.ruby },
    { d: -36, hw: 31, hh: 27, col: GEMS.sapphire },
    { d: 36, hw: 31, hh: 27, col: GEMS.sapphire },
    { d: -72, hw: 26, hh: 24, col: GEMS.emerald },
    { d: 72, hw: 26, hh: 24, col: GEMS.emerald }
  ];
  // pearls between the stones (drawn first so the bezels sit on top)
  for (const d of [-54, -18, 18, 54]) {
    const x = RX * Math.sin(d * D2R);
    const cs = Math.cos(d * D2R);
    const y = -BH / 2 + ell(x);
    pearl(c, x, y, 11 * (0.55 + 0.45 * cs));
  }
  for (const j of jewels) {
    const x = RX * Math.sin(j.d * D2R);
    const cs = Math.max(0.42, Math.cos(j.d * D2R));
    const y = -BH / 2 + ell(x);
    gem(c, x, y, j.hw * cs, j.hh, j.col);
    sparks.push({ x: x - j.hw * cs * 0.3, y: y - j.hh * 0.35, r: 11 + j.hw * 0.35 * cs });
  }
  // small brilliants inside the three tallest spires
  for (const i of [1, 2, 3]) {
    const p = PTS[i];
    gem(c, p.x, p.y + 84, 8, 8, GEMS.diamond, false);
    sparks.push({ x: p.x - 2, y: p.y + 82, r: 12 });
  }

  /* 7. pearl-tipped finials */
  for (const p of PTS) {
    const pr = p.r;
    pearl(c, p.x, p.y - pr * 0.45, pr);
    const cg = c.createLinearGradient(p.x - pr, 0, p.x + pr, 0);
    cg.addColorStop(0, '#7a4a05'); cg.addColorStop(0.4, '#ffe9a0'); cg.addColorStop(1, '#8a5a0b');
    c.fillStyle = cg;
    c.strokeStyle = 'rgba(70,40,0,0.7)';
    c.lineWidth = 1.5;
    c.beginPath();
    c.ellipse(p.x, p.y + pr * 0.25, pr * 0.95, pr * 0.4, 0, 0, Math.PI * 2);
    c.fill();
    c.stroke();
    sparks.push({ x: p.x - pr * 0.3, y: p.y - pr * 0.8, r: pr * 1.1 });
  }

  /* 8. outline */
  traceFront(c);
  c.strokeStyle = '#5a3504';
  c.lineWidth = 2.4;
  c.lineJoin = 'round';
  c.stroke();
  c.restore();

  return { cv, mask, sparks };
}

/* ---------- per-frame helpers ---------- */
let GLINT = null;
function glintCanvas() {
  if (!GLINT) {
    GLINT = makeCanvas(SW, SH);
    GLINT.gx = GLINT.getContext('2d');
  }
  return GLINT;
}

function starburst(fx, x, y, r, a) {
  fx.globalAlpha = a;
  const g = fx.createRadialGradient(x, y, 0, x, y, r * 0.55);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  fx.fillStyle = g;
  fx.beginPath();
  fx.arc(x, y, r * 0.55, 0, Math.PI * 2);
  fx.fill();
  fx.fillStyle = '#fff';
  for (const [len, rot] of [[r, 0], [r, Math.PI / 2], [r * 0.6, Math.PI / 4], [r * 0.6, -Math.PI / 4]]) {
    fx.save();
    fx.translate(x, y);
    fx.rotate(rot);
    fx.beginPath();
    fx.moveTo(-len, 0);
    fx.lineTo(0, len * 0.09);
    fx.lineTo(len, 0);
    fx.lineTo(0, -len * 0.09);
    fx.closePath();
    fx.fill();
    fx.restore();
  }
}

/** Landmark pose of the head (null if no usable face). */
function headPose(frame) {
  const pts = frame.face && frame.face.points;
  if (!pts) return null;
  const lEye = cent(pts, LM.LEFT_EYE);
  const rEye = cent(pts, LM.RIGHT_EYE);
  const dx = rEye.x - lEye.x;
  const dy = rEye.y - lEye.y;
  const eyeDist = Math.hypot(dx, dy);
  if (eyeDist < 8) return null;
  const angle = Math.atan2(dy, dx);
  const ux = Math.cos(angle), uy = Math.sin(angle);   // head "right"
  const upx = Math.sin(angle), upy = -Math.cos(angle); // head "up"
  const j0 = pts[0], j16 = pts[16], nose = pts[30];
  const headW = Math.max(eyeDist * 1.6, Math.hypot(j16.x - j0.x, j16.y - j0.y));
  const mx = (j0.x + j16.x) / 2, my = (j0.y + j16.y) / 2;
  const off = (nose.x - mx) * ux + (nose.y - my) * uy;
  const yaw = clamp(off / (0.42 * headW), -1, 1);
  const k = (headW * CROWN_CFG.widthK) / (2 * RX);
  const lift = CROWN_CFG.lift * eyeDist + RY * k; // base-ring centre sits RY*k above the front edge
  const midx = (lEye.x + rEye.x) / 2, midy = (lEye.y + rEye.y) / 2;
  return {
    x: midx + upx * lift,
    y: midy + upy * lift,
    a: angle,
    k,
    yaw,
    headW,
    eyeDist
  };
}

export const crownEffect = {
  id: 'crown', name: 'Royal Crown', icon: '👑', category: 'Face', perf: 'low', requiresFace: true,
  render(fx, frame) {
    fx.drawImage(frame.src, 0, 0, frame.width, frame.height);
    const target = headPose(frame);
    if (!target) { this._s = null; return; }
    if (!SPRITE) SPRITE = buildSprite();

    // --- smooth the pose (exponential low-pass, frame-rate independent) ---
    const dt = clamp(frame.dt || 16, 1, 100);
    let s = this._s;
    if (!s || Math.hypot(target.x - s.x, target.y - s.y) > target.eyeDist * 2.2) {
      s = this._s = { ...target };
    } else {
      const al = 1 - Math.exp(-dt / CROWN_CFG.smoothMs);
      s.x = lerp(s.x, target.x, al);
      s.y = lerp(s.y, target.y, al);
      s.a = lerp(s.a, target.a, al);
      s.k = lerp(s.k, target.k, al);
      s.yaw = lerp(s.yaw, target.yaw, al);
      s.headW = lerp(s.headW, target.headW, al);
    }

    const t = frame.time || performance.now();
    fx.save();
    fx.translate(s.x, s.y);
    fx.rotate(s.a);
    fx.translate(s.yaw * s.headW * 0.09, 0);                // crown slides with a head turn
    fx.scale(s.k * (1 - 0.1 * Math.abs(s.yaw)), s.k);       // …and narrows slightly
    fx.imageSmoothingEnabled = true;
    fx.imageSmoothingQuality = 'high';
    fx.drawImage(SPRITE.cv, -ORG_X, -ORG_Y);

    // --- gold glint sweep (every ~4.2 s, lasts ~0.9 s), masked to the gold only ---
    if (CROWN_CFG.glint) {
      const PERIOD = 4200, DUR = 900;
      const ph = (t % PERIOD) / DUR;
      if (ph < 1) {
        const gc = glintCanvas();
        const g = gc.gx;
        g.globalCompositeOperation = 'source-over';
        g.clearRect(0, 0, SW, SH);
        const e = ph * ph * (3 - 2 * ph);
        const x0 = lerp(-140, SW + 140, e);
        const lg = g.createLinearGradient(x0 - 80, 0, x0 + 80, 120);
        lg.addColorStop(0, 'rgba(255,255,235,0)');
        lg.addColorStop(0.5, 'rgba(255,255,235,0.9)');
        lg.addColorStop(1, 'rgba(255,255,235,0)');
        g.fillStyle = lg;
        g.fillRect(0, 0, SW, SH);
        g.globalCompositeOperation = 'destination-in';
        g.drawImage(SPRITE.mask, 0, 0);
        g.globalCompositeOperation = 'source-over';
        fx.globalCompositeOperation = 'lighter';
        fx.globalAlpha = 0.75;
        fx.drawImage(gc, -ORG_X, -ORG_Y);
        fx.globalAlpha = 1;
        fx.globalCompositeOperation = 'source-over';
      }
    }

    // --- gem twinkles ---
    if (CROWN_CFG.sparkle) {
      fx.globalCompositeOperation = 'lighter';
      SPRITE.sparks.forEach((sp, i) => {
        const w = Math.sin(t * 0.0021 + i * 1.7);
        const a = w > 0.82 ? ((w - 0.82) / 0.18) ** 1.5 : 0;
        if (a > 0.03) starburst(fx, sp.x, sp.y, sp.r * (0.8 + 0.5 * a), a * 0.95);
      });
      fx.globalAlpha = 1;
      fx.globalCompositeOperation = 'source-over';
    }
    fx.restore();
  }
};

export const defsFace = [
  {
    id: 'sunglasses', name: 'Cool Shades', icon: '🕶️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 35);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const rw = eyeDist * 0.54;
      const rh = rw * 0.78;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);
      fx.translate(s.yaw * s.headW * 0.05, 0);

      // Glasses shadow on cheek
      fx.save();
      fx.translate(0, rh * 0.15);
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.ellipse((side * eyeDist) / 2, 0, rw * 1.05, rh * 1.05, 0, 0, Math.PI * 2);
        fx.fillStyle = 'rgba(0,0,0,0.22)';
        fx.fill();
      }
      fx.restore();

      // 1. Wayfarer Frames (outer rim)
      for (const side of [-1, 1]) {
        const cx = (side * eyeDist) / 2;
        fx.beginPath();
        fx.moveTo(cx - rw * 0.95 * side, -rh * 0.85);
        fx.lineTo(cx + rw * 0.95 * side, -rh * 0.7);
        fx.quadraticCurveTo(cx + rw * 1.08 * side, rh * 0.2, cx + rw * 0.7 * side, rh * 0.9);
        fx.quadraticCurveTo(cx, rh * 1.05, cx - rw * 0.7 * side, rh * 0.85);
        fx.quadraticCurveTo(cx - rw * 1.05 * side, rh * 0.1, cx - rw * 0.95 * side, -rh * 0.85);
        fx.closePath();

        const frameGrad = fx.createLinearGradient(cx - rw, -rh, cx + rw, rh);
        frameGrad.addColorStop(0, '#1e293b');
        frameGrad.addColorStop(0.5, '#0f172a');
        frameGrad.addColorStop(1, '#020617');
        fx.fillStyle = frameGrad;
        fx.fill();

        // 2. Polarized Lenses (gradient tint)
        fx.save();
        fx.beginPath();
        fx.ellipse(cx, rh * 0.05, rw * 0.82, rh * 0.72, side * 0.06, 0, Math.PI * 2);
        fx.clip();

        const lensGrad = fx.createLinearGradient(0, -rh * 0.7, 0, rh * 0.8);
        lensGrad.addColorStop(0, 'rgba(6, 8, 15, 0.94)');
        lensGrad.addColorStop(0.65, 'rgba(15, 23, 42, 0.88)');
        lensGrad.addColorStop(1, 'rgba(30, 41, 59, 0.82)');
        fx.fillStyle = lensGrad;
        fx.fillRect(cx - rw, -rh, rw * 2, rh * 2);

        // 3. Dynamic Specular Reflection sweep across lenses
        const sweepX = Math.sin(s.a * 2.5 + t * 0.001) * (rw * 0.4);
        fx.beginPath();
        fx.moveTo(cx - rw * 0.5 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.1 + sweepX, -rh * 0.8);
        fx.lineTo(cx - rw * 0.2 + sweepX, rh * 0.8);
        fx.lineTo(cx - rw * 0.8 + sweepX, rh * 0.8);
        fx.closePath();
        fx.fillStyle = 'rgba(255, 255, 255, 0.22)';
        fx.fill();

        // Secondary thin glint line
        fx.beginPath();
        fx.moveTo(cx + rw * 0.25 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.4 + sweepX, -rh * 0.8);
        fx.lineTo(cx + rw * 0.1 + sweepX, rh * 0.8);
        fx.lineTo(cx - rw * 0.05 + sweepX, rh * 0.8);
        fx.closePath();
        fx.fillStyle = 'rgba(255, 255, 255, 0.38)';
        fx.fill();
        fx.restore();

        // 4. Metallic silver corner rivets
        fx.beginPath();
        fx.arc(cx + side * rw * 0.88, -rh * 0.65, 2.2, 0, Math.PI * 2);
        fx.fillStyle = '#e2e8f0';
        fx.fill();
        fx.strokeStyle = '#64748b';
        fx.lineWidth = 0.8;
        fx.stroke();
      }

      // 5. Sturdy Bridge
      fx.beginPath();
      fx.moveTo(-eyeDist * 0.18, -rh * 0.55);
      fx.quadraticCurveTo(0, -rh * 0.72, eyeDist * 0.18, -rh * 0.55);
      fx.lineWidth = Math.max(3.5, eyeDist * 0.055);
      fx.strokeStyle = '#0f172a';
      fx.lineCap = 'round';
      fx.stroke();

      // Top bridge highlight
      fx.beginPath();
      fx.moveTo(-eyeDist * 0.14, -rh * 0.58);
      fx.quadraticCurveTo(0, -rh * 0.75, eyeDist * 0.14, -rh * 0.58);
      fx.lineWidth = 1.2;
      fx.strokeStyle = 'rgba(255,255,255,0.45)';
      fx.stroke();

      fx.restore();
    }
  },
  /* ---------- Royal Crown (premium) ---------- */
  crownEffect,

  {
    id: 'dogears', name: 'Puppy Ears', icon: '🐶', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 40);
      if (!s) return;

      const dtSec = clamp(frame.dt || 16, 1, 100) / 1000;
      if (!this._sway) this._sway = { aL: 0, vL: 0, aR: 0, vR: 0, lastA: s.a };
      const dAngle = s.a - this._sway.lastA;
      this._sway.lastA = s.a;

      // Realistic spring physics for floppy ears
      this._sway.vL += (-this._sway.aL * 24 - dAngle * 65) * dtSec - this._sway.vL * (6 * dtSec);
      this._sway.aL = clamp(this._sway.aL + this._sway.vL * dtSec, -0.6, 0.6);
      this._sway.vR += (-this._sway.aR * 24 - dAngle * 65) * dtSec - this._sway.vR * (6 * dtSec);
      this._sway.aR = clamp(this._sway.aR + this._sway.vR * dtSec, -0.6, 0.6);

      const eyeDist = s.eyeDist;
      const earW = eyeDist * 0.65;
      const earH = eyeDist * 1.25;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);

      // Render Left & Right Floppy Ears with 3D fur texture and bounce
      for (const side of [-1, 1]) {
        const sway = side === -1 ? this._sway.aL : this._sway.aR;
        const earRootX = side * eyeDist * 0.95;
        const earRootY = -eyeDist * 0.72;

        fx.save();
        fx.translate(earRootX, earRootY);
        fx.rotate(side * 0.28 + sway);

        // 1. Outer Fur Layer with warm golden-retriever gradient
        fx.beginPath();
        fx.moveTo(-earW * 0.35, 0);
        fx.bezierCurveTo(-earW * 0.6, -earH * 0.15, -earW * 0.75, earH * 0.4, -earW * 0.3, earH);
        fx.quadraticCurveTo(0, earH * 1.15, earW * 0.35, earH * 0.95);
        fx.bezierCurveTo(earW * 0.7, earH * 0.5, earW * 0.45, -earH * 0.1, earW * 0.2, 0);
        fx.closePath();

        const furGrad = fx.createLinearGradient(-earW * 0.5, 0, earW * 0.5, earH);
        furGrad.addColorStop(0, '#854d0e');
        furGrad.addColorStop(0.35, '#b45309');
        furGrad.addColorStop(0.7, '#d97706');
        furGrad.addColorStop(1, '#78350f');
        fx.fillStyle = furGrad;
        fx.fill();

        // 2. Inner Ear Velvet Pink Flap
        fx.beginPath();
        fx.moveTo(-earW * 0.18, earH * 0.15);
        fx.bezierCurveTo(-earW * 0.4, earH * 0.4, -earW * 0.35, earH * 0.75, -earW * 0.08, earH * 0.88);
        fx.quadraticCurveTo(earW * 0.08, earH * 0.92, earW * 0.18, earH * 0.82);
        fx.bezierCurveTo(earW * 0.35, earH * 0.6, earW * 0.3, earH * 0.3, earW * 0.12, earH * 0.15);
        fx.closePath();

        const pinkGrad = fx.createLinearGradient(0, earH * 0.15, 0, earH * 0.9);
        pinkGrad.addColorStop(0, '#fca5a5');
        pinkGrad.addColorStop(0.5, '#f43f5e');
        pinkGrad.addColorStop(1, '#9f1239');
        fx.fillStyle = pinkGrad;
        fx.fill();

        // 3. Fold highlight on cartilage
        fx.beginPath();
        fx.ellipse(0, 0, earW * 0.35, earW * 0.14, side * 0.2, 0, Math.PI * 2);
        fx.fillStyle = '#fde68a';
        fx.globalAlpha = 0.55;
        fx.fill();
        fx.globalAlpha = 1;

        fx.restore();
      }

      // 4. Adorable Puppy Button Nose
      const nw = eyeDist * 0.38;
      const nh = eyeDist * 0.26;
      fx.save();
      fx.translate(s.noseX - s.x, s.noseY - s.y);

      // Nose drop shadow
      fx.beginPath();
      fx.ellipse(0, nh * 0.25, nw * 0.52, nh * 0.45, 0, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(0,0,0,0.22)';
      fx.fill();

      // Sculpted black leather nose
      fx.beginPath();
      fx.moveTo(-nw * 0.45, -nh * 0.35);
      fx.quadraticCurveTo(0, -nh * 0.55, nw * 0.45, -nh * 0.35);
      fx.bezierCurveTo(nw * 0.55, nh * 0.1, nw * 0.25, nh * 0.5, 0, nh * 0.55);
      fx.bezierCurveTo(-nw * 0.25, nh * 0.5, -nw * 0.55, nh * 0.1, -nw * 0.45, -nh * 0.35);
      fx.closePath();

      const noseGrad = fx.createRadialGradient(-nw * 0.15, -nh * 0.2, 1, 0, 0, nw * 0.6);
      noseGrad.addColorStop(0, '#334155');
      noseGrad.addColorStop(0.4, '#0f172a');
      noseGrad.addColorStop(1, '#020617');
      fx.fillStyle = noseGrad;
      fx.fill();

      // Nostril slits
      for (const nSide of [-1, 1]) {
        fx.beginPath();
        fx.ellipse(nSide * nw * 0.22, nh * 0.1, nw * 0.1, nh * 0.14, nSide * 0.35, 0, Math.PI * 2);
        fx.fillStyle = '#000000';
        fx.fill();
      }

      // Wet leather specular highlight glint
      fx.beginPath();
      fx.ellipse(-nw * 0.15, -nh * 0.22, nw * 0.18, nh * 0.09, -0.25, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fill();

      // Cute whisker freckle dots on muzzle
      fx.fillStyle = 'rgba(30, 41, 59, 0.45)';
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.arc(side * nw * 0.85, nh * 0.45, 1.8, 0, Math.PI * 2);
        fx.arc(side * nw * 1.1, nh * 0.35, 1.8, 0, Math.PI * 2);
        fx.arc(side * nw * 1.0, nh * 0.65, 1.8, 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
      fx.restore();
    }
  },
  {
    id: 'mustache', name: 'Mustache', icon: '🥸', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 35);
      if (!s) return;
      const eyeDist = s.eyeDist;
      const my = lerp(s.noseY, (g.mouth ? g.mouth.y : s.noseY + eyeDist * 0.4), 0.38);
      fx.save();
      fx.translate(s.noseX, my);
      fx.rotate(s.a);
      fx.fillStyle = '#1c1917';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.26, 0, eyeDist * 0.32, eyeDist * 0.15, -0.28, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.26, 0, eyeDist * 0.32, eyeDist * 0.15, 0.28, 0, Math.PI * 2);
      fx.fill();
      // Silky hair sheen
      fx.fillStyle = 'rgba(255,255,255,0.18)';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.24, -eyeDist * 0.04, eyeDist * 0.24, eyeDist * 0.05, -0.28, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.24, -eyeDist * 0.04, eyeDist * 0.24, eyeDist * 0.05, 0.28, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }
  },
  {
    id: 'partyhat', name: 'Party Hat', icon: '🥳', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 45);
      if (!s) return;

      const t = frame.time || performance.now();
      const hw = s.eyeDist * 1.1;
      const hh = s.eyeDist * 1.6;
      const rx = hw * 0.52;
      const ry = hw * 0.18;

      fx.save();
      fx.translate(s.x, s.y - s.eyeDist * 1.08);
      fx.rotate(s.a);
      fx.translate(s.yaw * s.headW * 0.08, 0);
      fx.scale(1 - 0.08 * Math.abs(s.yaw), 1);

      // 1. Soft contact shadow on skull/forehead
      fx.save();
      fx.translate(0, 10);
      fx.scale(1, ry / rx);
      const sh = fx.createRadialGradient(0, 0, 0, 0, 0, rx * 1.1);
      sh.addColorStop(0, 'rgba(0,0,0,0.38)');
      sh.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = sh;
      fx.beginPath();
      fx.arc(0, 0, rx * 1.1, 0, Math.PI * 2);
      fx.fill();
      fx.restore();

      // Helper to trace 3D cone with curved elliptical base
      const traceCone = () => {
        fx.beginPath();
        fx.moveTo(-rx, 0);
        fx.lineTo(0, -hh);
        fx.lineTo(rx, 0);
        fx.ellipse(0, 0, rx, ry, 0, 0, Math.PI, false);
        fx.closePath();
      };

      // 2. Base cone body with metallic gradient
      traceCone();
      const bgGrad = fx.createLinearGradient(-rx, 0, rx, 0);
      bgGrad.addColorStop(0, '#be123c');
      bgGrad.addColorStop(0.35, '#f43f5e');
      bgGrad.addColorStop(0.7, '#fb7185');
      bgGrad.addColorStop(1, '#881337');
      fx.fillStyle = bgGrad;
      fx.fill();

      // 3. Crisp metallic spiral candy stripes
      fx.save();
      traceCone();
      fx.clip();

      const numStripes = 6;
      for (let i = -1; i <= numStripes; i++) {
        const yTop = -hh + (i * hh) / numStripes;
        const yBot = yTop + hh * 0.28;
        fx.beginPath();
        fx.moveTo(-rx * 1.2, yBot + ry * 2);
        fx.lineTo(rx * 1.2, yTop - ry * 2);
        fx.lineTo(rx * 1.2, yTop + hh * 0.16 - ry * 2);
        fx.lineTo(-rx * 1.2, yBot + hh * 0.16 + ry * 2);
        fx.closePath();

        const goldS = fx.createLinearGradient(-rx, 0, rx, 0);
        goldS.addColorStop(0, '#b45309');
        goldS.addColorStop(0.3, '#fef08a');
        goldS.addColorStop(0.6, '#f59e0b');
        goldS.addColorStop(1, '#78350f');
        fx.fillStyle = goldS;
        fx.fill();

        fx.strokeStyle = 'rgba(255,255,255,0.6)';
        fx.lineWidth = 2;
        fx.beginPath();
        fx.moveTo(-rx * 1.2, yTop + hh * 0.08 - ry * 2);
        fx.lineTo(rx * 1.2, yBot + hh * 0.08 + ry * 2);
        fx.stroke();
      }

      // 3D cylindrical lighting overlay
      const lightGrad = fx.createLinearGradient(-rx, 0, rx, 0);
      lightGrad.addColorStop(0, 'rgba(0,0,0,0.3)');
      lightGrad.addColorStop(0.28, 'rgba(255,255,255,0.32)');
      lightGrad.addColorStop(0.65, 'rgba(255,255,255,0)');
      lightGrad.addColorStop(1, 'rgba(0,0,0,0.45)');
      fx.fillStyle = lightGrad;
      fx.fillRect(-rx, -hh - 10, rx * 2, hh + ry * 2 + 20);
      fx.restore();

      // 4. Ruffled golden tinsel base trim with beads
      fx.save();
      for (let a = 0; a <= Math.PI; a += 0.14) {
        const bx = Math.cos(a) * rx;
        const by = Math.sin(a) * ry;
        const br = 4.2 * (0.6 + 0.4 * Math.sin(a));
        const bg = fx.createRadialGradient(bx - br * 0.3, by - br * 0.3, 1, bx, by, br);
        bg.addColorStop(0, '#fef08a');
        bg.addColorStop(0.6, '#f59e0b');
        bg.addColorStop(1, '#92400e');
        fx.fillStyle = bg;
        fx.beginPath();
        fx.arc(bx, by, br, 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();

      // 5. 3D Fluffy Golden Pom-Pom on the apex
      const pomX = 0, pomY = -hh - 6, pomR = hw * 0.16;
      fx.save();
      const pomGrad = fx.createRadialGradient(pomX - pomR * 0.35, pomY - pomR * 0.35, 2, pomX, pomY, pomR);
      pomGrad.addColorStop(0, '#ffffff');
      pomGrad.addColorStop(0.3, '#fef08a');
      pomGrad.addColorStop(0.7, '#f59e0b');
      pomGrad.addColorStop(1, '#b45309');
      fx.fillStyle = pomGrad;
      fx.beginPath();
      fx.arc(pomX, pomY, pomR, 0, Math.PI * 2);
      fx.fill();

      // Pom-pom fluffy fringe wisps
      fx.strokeStyle = '#fde68a';
      fx.lineWidth = 1.6;
      for (let i = 0; i < 14; i++) {
        const fa = (i / 14) * Math.PI * 2 + Math.sin(t * 0.003 + i) * 0.1;
        const fl = pomR * (1.1 + 0.25 * Math.sin(i * 3 + t * 0.004));
        fx.beginPath();
        fx.moveTo(pomX, pomY);
        fx.lineTo(pomX + Math.cos(fa) * fl, pomY + Math.sin(fa) * fl);
        fx.stroke();
      }

      // Sparkle on pom-pom
      const sparkle = (Math.sin(t * 0.005) + 1) * 0.5;
      if (sparkle > 0.4) {
        fx.fillStyle = `rgba(255,255,255,${sparkle * 0.9})`;
        fx.beginPath();
        fx.arc(pomX - pomR * 0.3, pomY - pomR * 0.3, pomR * 0.35, 0, Math.PI * 2);
        fx.fill();
      }

      // 6. Fluttering curling party ribbons attached to the pom-pom
      const ribbons = [
        { color: '#38bdf8', len: hw * 0.9, phase: 0 },
        { color: '#ec4899', len: hw * 1.1, phase: 1.8 },
        { color: '#facc15', len: hw * 0.8, phase: 3.4 }
      ];
      ribbons.forEach((rib) => {
        fx.beginPath();
        fx.moveTo(pomX, pomY);
        let rxCur = pomX;
        let ryCur = pomY;
        const steps = 6;
        for (let j = 1; j <= steps; j++) {
          const frac = j / steps;
          const swayRib = Math.sin(t * 0.004 + rib.phase + j * 0.8) * (14 * frac);
          rxCur = pomX + swayRib + (rib.phase > 2 ? 8 : -8) * frac;
          ryCur = pomY + rib.len * frac;
          fx.lineTo(rxCur, ryCur);
        }
        fx.strokeStyle = rib.color;
        fx.lineWidth = 2.4;
        fx.lineCap = 'round';
        fx.stroke();
      });

      fx.restore();
      fx.restore();
    }
  },

  {
    id: 'bigeyes', name: 'Big Eyes', icon: '😳', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { src, width: w, height: h } = frame;
      const r = g.eyeDist * 0.42;
      const k = 1.5;
      for (const eye of [g.lEye, g.rEye]) {
        const sx = clamp(eye.x - r, 0, w - 2 * r);
        const sy = clamp(eye.y - r, 0, h - 2 * r);
        const sw = Math.min(2 * r, w - sx);
        const sh = Math.min(2 * r, h - sy);
        fx.save();
        fx.beginPath();
        fx.arc(eye.x, eye.y, r * k * 0.95, 0, Math.PI * 2);
        fx.clip();
        fx.drawImage(src, sx, sy, sw, sh, eye.x - r * k, eye.y - r * k, sw * k, sh * k);
        fx.restore();
      }
    }
  },
  {
    id: 'faceblur', name: 'Blur Background', icon: '🌀', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h } = frame;
      fx.filter = 'blur(15px) brightness(0.96) saturate(1.05)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const g = geo(frame);
      const cx = g ? g.box.x + g.box.width / 2 : w / 2;
      const cy = g ? g.box.y + g.box.height * 0.68 : h * 0.46;
      const rx = g ? Math.max(w * 0.2, g.box.width * 1.05) : w * 0.27;
      const ry = g ? Math.max(h * 0.34, g.box.height * 1.68) : h * 0.44;

      const sc = scratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.globalCompositeOperation = 'destination-in';
      const grad = sc.gx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.45, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.72, 'rgba(0,0,0,0.96)');
      grad.addColorStop(0.94, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sc.gx.fillStyle = grad;
      sc.gx.beginPath();
      sc.gx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      sc.gx.fill();
      sc.gx.globalCompositeOperation = 'source-over';

      fx.drawImage(sc, 0, 0);
    }
  },
  {
    id: 'facepixel', name: 'Pixel Face', icon: '🟪', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { src, width: w, height: h } = frame;
      const bx = clamp(g.box.x - 10, 0, w - 10);
      const by = clamp(g.box.y - 10, 0, h - 10);
      const bw = Math.min(g.box.width + 20, w - bx);
      const bh = Math.min(g.box.height + 20, h - by);
      const cell = 10;
      const sc = scratch(Math.max(2, Math.round(bw / cell)), Math.max(2, Math.round(bh / cell)));
      sc.gx.drawImage(src, bx, by, bw, bh, 0, 0, sc.cw, sc.ch);
      fx.imageSmoothingEnabled = false;
      fx.save();
      fx.beginPath();
      fx.ellipse(bx + bw / 2, by + bh / 2, (bw / 2) * 1.04, (bh / 2) * 1.04, 0, 0, Math.PI * 2);
      fx.clip();
      fx.drawImage(sc, 0, 0, sc.cw, sc.ch, bx, by, bw, bh);
      fx.restore();
      fx.imageSmoothingEnabled = true;
    }
  },
  {
    id: 'facemesh', name: 'Face Mesh', icon: '🕸️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;

      const pts = g.pts;
      const eyeDist = g.eyeDist;
      const now = frame.now || performance.now();

      // Synthesize virtual forehead and temple vertices to form a complete 3D skull cap
      const fApex = {
        x: (pts[19].x + pts[24].x) / 2 + (pts[27].x - pts[30].x) * 0.4,
        y: Math.min(pts[19].y, pts[24].y) - eyeDist * 0.76
      };
      const allPts = [
        ...pts,
        { x: pts[0].x, y: pts[17].y - eyeDist * 0.45 },   // 68: Left temple
        { x: pts[17].x, y: pts[17].y - eyeDist * 0.60 },  // 69: Left outer-brow top
        { x: pts[19].x, y: pts[19].y - eyeDist * 0.70 },  // 70: Left inner-brow top
        fApex,                                            // 71: Forehead apex
        { x: pts[24].x, y: pts[24].y - eyeDist * 0.70 },  // 72: Right inner-brow top
        { x: pts[26].x, y: pts[26].y - eyeDist * 0.60 },  // 73: Right outer-brow top
        { x: pts[16].x, y: pts[26].y - eyeDist * 0.45 }   // 74: Right temple
      ];

      // Triangulation facets covering all facial regions
      const TRIANGLES = [
        // Forehead & Temples
        [68, 69, 17], [69, 18, 17], [69, 70, 19], [69, 19, 18], [70, 71, 19], [71, 20, 19], [71, 21, 20],
        [71, 27, 21], [71, 22, 27], [71, 23, 22], [71, 24, 23], [71, 72, 24], [72, 73, 24], [73, 25, 24],
        [73, 26, 25], [73, 74, 26], [74, 16, 26], [68, 17, 0],
        // Brows to Eyes & Nose Bridge
        [17, 18, 36], [18, 37, 36], [18, 19, 37], [19, 38, 37], [19, 20, 38], [20, 39, 38], [20, 21, 39], [21, 27, 39],
        [22, 23, 42], [23, 43, 42], [23, 24, 43], [24, 44, 43], [24, 25, 44], [25, 45, 44], [25, 26, 45], [26, 16, 45], [22, 27, 42],
        // Eyes
        [36, 37, 41], [37, 38, 40], [38, 39, 40], [37, 40, 41],
        [42, 43, 47], [43, 44, 46], [44, 45, 46], [43, 46, 47],
        // Nose Bridge & Cheeks
        [27, 28, 39], [27, 42, 28], [28, 29, 39], [28, 42, 29], [29, 31, 39], [29, 35, 42], [29, 30, 31], [29, 35, 30],
        [36, 41, 0], [41, 1, 0], [41, 2, 31], [1, 2, 41], [39, 40, 31], [40, 41, 31],
        [42, 47, 35], [45, 46, 16], [46, 15, 16], [46, 14, 35], [14, 15, 46], [46, 47, 35],
        // Cheeks to Jaw
        [2, 3, 31], [3, 4, 48], [4, 5, 48], [3, 48, 31],
        [14, 35, 13], [13, 35, 54], [13, 54, 12], [12, 54, 11],
        // Nose Bottom & Philtrum
        [31, 32, 30], [32, 33, 30], [33, 34, 30], [34, 35, 30],
        [31, 48, 49], [31, 32, 49], [32, 50, 49], [32, 33, 50], [33, 51, 50], [33, 52, 51], [33, 34, 52],
        [34, 53, 52], [34, 35, 53], [35, 54, 53],
        // Lips
        [48, 49, 60], [49, 50, 61], [49, 60, 61], [50, 51, 62], [50, 61, 62], [51, 52, 62], [52, 63, 62], [52, 53, 64], [52, 64, 63], [53, 54, 64],
        [48, 59, 60], [59, 58, 67], [59, 67, 60], [58, 57, 66], [58, 66, 67], [57, 56, 65], [57, 65, 66], [56, 55, 65], [55, 54, 64], [55, 64, 65],
        // Lower Lip to Chin
        [48, 5, 59], [59, 5, 6], [59, 6, 58], [58, 6, 7], [58, 7, 57], [57, 7, 8],
        [57, 8, 9], [57, 9, 56], [56, 9, 10], [56, 10, 55], [55, 10, 11], [55, 11, 54]
      ];

      fx.save();

      // 1. Shaded Holographic Facet Fills
      for (let i = 0; i < TRIANGLES.length; i++) {
        const [ia, ib, ic] = TRIANGLES[i];
        const pa = allPts[ia], pb = allPts[ib], pc = allPts[ic];
        const cx = (pa.x + pb.x + pc.x) / 3;
        const cy = (pa.y + pb.y + pc.y) / 3;
        const wave = Math.sin((cx + cy) * 0.018 - now * 0.0032);
        fx.fillStyle = wave > 0.35
          ? 'rgba(0, 245, 255, 0.07)'
          : (wave < -0.35 ? 'rgba(168, 85, 247, 0.055)' : 'rgba(0, 245, 255, 0.022)');
        fx.beginPath();
        fx.moveTo(pa.x, pa.y);
        fx.lineTo(pb.x, pb.y);
        fx.lineTo(pc.x, pc.y);
        fx.closePath();
        fx.fill();
      }

      // 2. Wireframe Mesh Lines
      fx.lineWidth = 1.1;
      fx.strokeStyle = 'rgba(0, 245, 255, 0.40)';
      fx.beginPath();
      for (let i = 0; i < TRIANGLES.length; i++) {
        const [ia, ib, ic] = TRIANGLES[i];
        const pa = allPts[ia], pb = allPts[ib], pc = allPts[ic];
        fx.moveTo(pa.x, pa.y);
        fx.lineTo(pb.x, pb.y);
        fx.lineTo(pc.x, pc.y);
        fx.lineTo(pa.x, pa.y);
      }
      fx.stroke();

      // 3. Highlighted Primary Contours (Jawline, Eyebrows, Lips)
      const contours = [
        Array.from({ length: 17 }, (_, i) => i),
        [17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26],
        [27, 28, 29, 30],
        [36, 37, 38, 39, 40, 41, 36],
        [42, 43, 44, 45, 46, 47, 42],
        [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48]
      ];
      fx.lineWidth = 1.8;
      fx.strokeStyle = 'rgba(0, 255, 240, 0.85)';
      for (const chain of contours) {
        fx.beginPath();
        chain.forEach((idx, i) => {
          const p = pts[idx];
          if (i === 0) fx.moveTo(p.x, p.y);
          else fx.lineTo(p.x, p.y);
        });
        fx.stroke();
      }

      // 4. Sweeping Laser Beam
      const box = g.box;
      const scanPeriod = (Math.sin(now * 0.0024) * 0.5 + 0.5);
      const scanY = box.y + scanPeriod * box.height;
      const laserGrad = fx.createLinearGradient(box.x - 20, scanY, box.x + box.width + 20, scanY);
      laserGrad.addColorStop(0, 'rgba(0, 245, 255, 0)');
      laserGrad.addColorStop(0.2, 'rgba(0, 245, 255, 0.4)');
      laserGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      laserGrad.addColorStop(0.8, 'rgba(0, 245, 255, 0.4)');
      laserGrad.addColorStop(1, 'rgba(0, 245, 255, 0)');
      fx.strokeStyle = laserGrad;
      fx.lineWidth = 2.2;
      fx.beginPath();
      fx.moveTo(box.x - 24, scanY);
      fx.lineTo(box.x + box.width + 24, scanY);
      fx.stroke();

      // Soft glow band around laser
      fx.fillStyle = 'rgba(0, 245, 255, 0.07)';
      fx.fillRect(box.x - 24, scanY - 8, box.width + 48, 16);

      // 5. Mesh Nodes with Laser Proximity Glow
      for (let i = 0; i < allPts.length; i++) {
        const p = allPts[i];
        const distToLaser = Math.abs(p.y - scanY);
        const nearLaser = distToLaser < 24;

        fx.beginPath();
        if (nearLaser) {
          const intensity = 1 - distToLaser / 24;
          fx.fillStyle = `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`;
          fx.arc(p.x, p.y, 2.5 + intensity * 1.5, 0, Math.PI * 2);
          fx.fill();
          // Halo
          fx.fillStyle = `rgba(0, 245, 255, ${intensity * 0.5})`;
          fx.beginPath();
          fx.arc(p.x, p.y, 5 + intensity * 4, 0, Math.PI * 2);
          fx.fill();
        } else {
          fx.fillStyle = 'rgba(0, 245, 255, 0.75)';
          fx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
          fx.fill();
        }
      }

      // 6. Cyber Target Reticles on Key Landmarks (Pupils, Nose tip, Chin)
      const reticleTargets = [g.lEye, g.rEye, g.nose, g.chin];
      const reticleRot = now * 0.002;
      for (const t of reticleTargets) {
        fx.save();
        fx.translate(t.x, t.y);
        fx.rotate(reticleRot);
        fx.strokeStyle = 'rgba(0, 255, 230, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(0, 0, 5.5, 0, Math.PI * 2);
        fx.stroke();
        // Crosshair ticks
        fx.beginPath();
        fx.moveTo(-8, 0); fx.lineTo(-5.5, 0);
        fx.moveTo(5.5, 0); fx.lineTo(8, 0);
        fx.moveTo(0, -8); fx.lineTo(0, -5.5);
        fx.moveTo(0, 5.5); fx.lineTo(0, 8);
        fx.stroke();
        fx.restore();
      }

      // 7. Corner HUD Brackets
      const bx = box.x, by = box.y, bw = box.width, bh = box.height;
      const arm = Math.min(22, bw * 0.14);
      fx.strokeStyle = 'rgba(0, 245, 255, 0.85)';
      fx.lineWidth = 2.2;
      // Top-Left
      fx.beginPath(); fx.moveTo(bx, by + arm); fx.lineTo(bx, by); fx.lineTo(bx + arm, by); fx.stroke();
      // Top-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by); fx.lineTo(bx + bw, by); fx.lineTo(bx + bw, by + arm); fx.stroke();
      // Bottom-Left
      fx.beginPath(); fx.moveTo(bx, by + bh - arm); fx.lineTo(bx, by + bh); fx.lineTo(bx + arm, by + bh); fx.stroke();
      // Bottom-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by + bh); fx.lineTo(bx + bw, by + bh); fx.lineTo(bx + bw, by + bh - arm); fx.stroke();

      // 8. Cyberpunk Telemetry HUD Badge
      const hudY = Math.max(22, by - 12);
      fx.font = '700 11px ui-monospace, Menlo, Monaco, monospace';
      fx.fillStyle = '#00f5ff';
      fx.fillText('BIO-TOPOLOGY 3D // 68 PTS', bx, hudY);
      fx.font = '600 10px ui-monospace, Menlo, Monaco, monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fillText(`YAW: ${(g.yaw * 45).toFixed(1)}°  DEPTH: ${Math.round(g.headW * 0.9)}mm  TRACK: 99.8%`, bx, hudY + 14);

      fx.restore();
    }
  },

  {
    id: 'emotion', name: 'Emotion Meter', icon: '🧠', category: 'Face', perf: 'low', requiresFace: true, needsExpressions: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const expr = frame.face && frame.face.expressions;
      if (!g || !expr) return;

      const now = frame.now || performance.now();

      const THEMES = {
        happy: {
          emoji: '😄', title: 'JOY / HAPPINESS',
          color: '#facc15', aura: 'rgba(250, 204, 21, 0.28)',
          vibe: 'Radiating positive energy! ✨', particle: 'star'
        },
        surprised: {
          emoji: '😮', title: 'WOW / SURPRISED',
          color: '#06b6d4', aura: 'rgba(6, 182, 212, 0.32)',
          vibe: 'Mind blown! High alertness! ⚡', particle: 'ripple'
        },
        neutral: {
          emoji: '🧘', title: 'CHILL & ZEN',
          color: '#a855f7', aura: 'rgba(168, 85, 247, 0.22)',
          vibe: 'Unbothered composure & calm 🌿', particle: 'dust'
        },
        sad: {
          emoji: '🥺', title: 'MELANCHOLY',
          color: '#3b82f6', aura: 'rgba(59, 130, 246, 0.26)',
          vibe: 'Warm hug & cozy energy needed ☕', particle: 'mist'
        },
        angry: {
          emoji: '😤', title: 'FIERY FOCUS',
          color: '#ef4444', aura: 'rgba(239, 68, 68, 0.35)',
          vibe: 'Intense drive & powerhouse fire 🔥', particle: 'ember'
        },
        disgusted: {
          emoji: '🤨', title: 'SKEPTICAL / SUS',
          color: '#10b981', aura: 'rgba(16, 185, 129, 0.28)',
          vibe: 'Side-eyeing the vibe 👀', particle: 'ring'
        },
        fearful: {
          emoji: '⚡', title: 'HIGH ALERT',
          color: '#ec4899', aura: 'rgba(236, 72, 153, 0.30)',
          vibe: 'Spidey-senses active & wired! ⚡', particle: 'spark'
        }
      };

      // Smooth expression scores with EMA
      if (!this._scores) this._scores = {};
      for (const [k, v] of Object.entries(expr)) {
        this._scores[k] = lerp(this._scores[k] ?? v, v, 0.15);
      }
      const sorted = Object.entries(this._scores).sort((a, b) => b[1] - a[1]);
      const [topKey, topVal] = sorted[0] || ['neutral', 1];
      const theme = THEMES[topKey] || THEMES.neutral;

      fx.save();

      // 1. Dynamic Glowing Mood Aura Halo around Head
      const auraRadius = g.headW * (0.85 + 0.08 * Math.sin(now * 0.005));
      const auraGrad = fx.createRadialGradient(g.midEye.x, g.midEye.y, g.headW * 0.25, g.midEye.x, g.midEye.y, auraRadius);
      auraGrad.addColorStop(0, theme.aura);
      auraGrad.addColorStop(0.7, theme.aura.replace(/[\d\.]+\)$/, '0.08)'));
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = auraGrad;
      fx.beginPath();
      fx.arc(g.midEye.x, g.midEye.y, auraRadius, 0, Math.PI * 2);
      fx.fill();

      // 2. Emotion-Reactive Particle Atmosphere
      if (!this._particles) this._particles = [];
      if (this._particles.length < 24 && Math.random() < 0.35) {
        this._particles.push({
          x: g.midEye.x + rand(-g.headW * 0.55, g.headW * 0.55),
          y: g.midEye.y + rand(-g.headW * 0.3, g.headW * 0.5),
          vx: rand(-0.4, 0.4),
          vy: topKey === 'sad' ? rand(0.6, 1.4) : rand(-1.4, -0.4),
          size: rand(4, 9),
          life: 1,
          decay: rand(0.012, 0.022),
          type: theme.particle,
          rot: rand(0, Math.PI * 2),
          vrot: rand(-0.06, 0.06),
          color: theme.color
        });
      }

      for (let i = this._particles.length - 1; i >= 0; i--) {
        const p = this._particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life -= p.decay;
        if (p.life <= 0) {
          this._particles.splice(i, 1);
          continue;
        }
        fx.save();
        fx.globalAlpha = p.life;
        fx.translate(p.x, p.y);
        fx.rotate(p.rot);
        if (p.type === 'star') {
          fx.fillStyle = p.color;
          fx.beginPath();
          for (let s = 0; s < 4; s++) {
            fx.rotate(Math.PI / 2);
            fx.lineTo(p.size, 0);
            fx.lineTo(p.size * 0.25, p.size * 0.25);
          }
          fx.closePath();
          fx.fill();
        } else if (p.type === 'ripple') {
          fx.strokeStyle = p.color;
          fx.lineWidth = 1.5;
          fx.beginPath();
          fx.arc(0, 0, (1 - p.life) * 22 + 4, 0, Math.PI * 2);
          fx.stroke();
        } else {
          fx.fillStyle = p.color;
          fx.beginPath();
          fx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
          fx.fill();
        }
        fx.restore();
      }

      // 3. Multi-Emotion Equalizer HUD Card
      const cw = 250;
      const ch = 114;
      let targetX = clamp(g.box.x + g.box.width / 2 - cw / 2, 10, frame.width - cw - 10);
      let targetY = g.box.y - ch - 16;
      if (targetY < 12) targetY = g.box.y + g.box.height + 16;
      if (targetY + ch > frame.height - 10) targetY = frame.height - ch - 10;

      if (!this._cardX) { this._cardX = targetX; this._cardY = targetY; }
      else {
        this._cardX = lerp(this._cardX, targetX, 0.16);
        this._cardY = lerp(this._cardY, targetY, 0.16);
      }
      const cx = this._cardX;
      const cy = this._cardY;

      // Card Body
      roundRect(fx, cx, cy, cw, ch, 14);
      fx.fillStyle = 'rgba(10, 14, 26, 0.90)';
      fx.fill();
      fx.strokeStyle = theme.color + 'aa';
      fx.lineWidth = 1.5;
      fx.stroke();

      // Top glowing color bar
      roundRect(fx, cx, cy, cw, 4, 3);
      fx.fillStyle = theme.color;
      fx.fill();

      // Header: Emoji, Title, Score %
      fx.font = '22px -apple-system, sans-serif';
      fx.fillText(theme.emoji, cx + 12, cy + 28);

      fx.font = '700 13px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = '#ffffff';
      fx.fillText(theme.title, cx + 42, cy + 22);

      fx.font = '800 16px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = theme.color;
      fx.textAlign = 'right';
      fx.fillText(`${Math.round(topVal * 100)}%`, cx + cw - 12, cy + 23);
      fx.textAlign = 'left';

      // Vibe tagline
      fx.font = '500 10px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      fx.fillText(theme.vibe, cx + 42, cy + 35);

      // Multi-Emotion Spectrum Equalizer (Top 3)
      const top3 = sorted.slice(0, 3);
      const startEqY = cy + 50;
      top3.forEach(([key, val], idx) => {
        const itemY = startEqY + idx * 19;
        const itemTheme = THEMES[key] || THEMES.neutral;
        const barW = 120;
        const barH = 6;
        const fillW = Math.max(4, barW * clamp(val, 0, 1));

        // Label
        fx.font = '600 9.5px ui-monospace, Menlo, monospace';
        fx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        fx.fillText(key.toUpperCase().slice(0, 7), cx + 12, itemY + 6);

        // Bar Track
        roundRect(fx, cx + 66, itemY, barW, barH, 3);
        fx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        fx.fill();

        // Bar Fill
        roundRect(fx, cx + 66, itemY, fillW, barH, 3);
        fx.fillStyle = itemTheme.color;
        fx.fill();

        // Percentage
        fx.font = '700 9.5px ui-monospace, Menlo, monospace';
        fx.fillStyle = '#ffffff';
        fx.textAlign = 'right';
        fx.fillText(`${Math.round(val * 100)}%`, cx + cw - 12, itemY + 6);
        fx.textAlign = 'left';
      });

      fx.restore();
    }
  },

  {
    id: 'agegender', name: 'Age & Gender', icon: '🔍', category: 'Face', perf: 'low', requiresFace: true, needsAge: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;

      const rawAge = frame.face.age;
      const rawGender = frame.face.gender || 'neutral';
      const rawConf = frame.face.genderProbability ?? 0.95;
      if (rawAge == null) return;

      const now = frame.now || performance.now();

      // Exponential moving average for silky-smooth, jitter-free stabilization
      if (!this._age) this._age = rawAge;
      else this._age = lerp(this._age, rawAge, 0.05);

      if (!this._conf) this._conf = rawConf;
      else this._conf = lerp(this._conf, rawConf, 0.08);

      const dispAge = Math.round(this._age);
      const dispConf = Math.round(this._conf * 100);
      const isMale = rawGender === 'male';

      // Fun generation classifications & vibe tags
      let genTitle = 'GEN Z';
      let genIcon = '✨';
      let genVibe = 'Main Character Energy';
      let genBadgeColor = '#a855f7';

      if (dispAge < 13) {
        genTitle = 'GEN ALPHA';
        genIcon = '🚀';
        genVibe = 'Curious Explorer';
        genBadgeColor = '#fbbf24';
      } else if (dispAge <= 26) {
        genTitle = 'GEN Z';
        genIcon = '✨';
        genVibe = 'Main Character Vibe';
        genBadgeColor = '#a855f7';
      } else if (dispAge <= 42) {
        genTitle = 'MILLENNIAL';
        genIcon = '🌟';
        genVibe = 'Peak Living & Aesthetic';
        genBadgeColor = '#06b6d4';
      } else if (dispAge <= 58) {
        genTitle = 'GEN X';
        genIcon = '⚡';
        genVibe = 'Iconic Boss Energy';
        genBadgeColor = '#f59e0b';
      } else {
        genTitle = 'LEGEND';
        genIcon = '👑';
        genVibe = 'Distinguished Icon';
        genBadgeColor = '#e11d48';
      }

      fx.save();

      const bx = g.box.x, by = g.box.y, bw = g.box.width, bh = g.box.height;

      // 1. Futuristic Corner Reticles [   ]
      const arm = Math.min(24, bw * 0.15);
      fx.strokeStyle = '#00f5ff';
      fx.lineWidth = 2.4;
      // Top-Left
      fx.beginPath(); fx.moveTo(bx, by + arm); fx.lineTo(bx, by); fx.lineTo(bx + arm, by); fx.stroke();
      // Top-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by); fx.lineTo(bx + bw, by); fx.lineTo(bx + bw, by + arm); fx.stroke();
      // Bottom-Left
      fx.beginPath(); fx.moveTo(bx, by + bh - arm); fx.lineTo(bx, by + bh); fx.lineTo(bx + arm, by + bh); fx.stroke();
      // Bottom-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by + bh); fx.lineTo(bx + bw, by + bh); fx.lineTo(bx + bw, by + bh - arm); fx.stroke();

      // 2. High-Tech Laser Scanline
      const scanPeriod = ((now * 0.16) % bh) / bh;
      const scanY = by + scanPeriod * bh;
      const scanGrad = fx.createLinearGradient(bx, scanY, bx + bw, scanY);
      scanGrad.addColorStop(0, 'rgba(0, 245, 255, 0)');
      scanGrad.addColorStop(0.3, 'rgba(0, 245, 255, 0.6)');
      scanGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      scanGrad.addColorStop(0.7, 'rgba(0, 245, 255, 0.6)');
      scanGrad.addColorStop(1, 'rgba(0, 245, 255, 0)');
      fx.strokeStyle = scanGrad;
      fx.lineWidth = 2;
      fx.beginPath(); fx.moveTo(bx, scanY); fx.lineTo(bx + bw, scanY); fx.stroke();

      // 3. Eye & Chin Biometric Crosshairs
      const targets = [
        { pt: g.lEye, label: 'L-EYE' },
        { pt: g.rEye, label: 'R-EYE' },
        { pt: g.chin, label: 'CHIN' }
      ];
      fx.font = '600 8.5px ui-monospace, Menlo, monospace';
      fx.fillStyle = 'rgba(0, 245, 255, 0.8)';
      fx.strokeStyle = 'rgba(0, 245, 255, 0.85)';
      fx.lineWidth = 1;
      for (const t of targets) {
        fx.beginPath();
        fx.moveTo(t.pt.x - 4, t.pt.y); fx.lineTo(t.pt.x + 4, t.pt.y);
        fx.moveTo(t.pt.x, t.pt.y - 4); fx.lineTo(t.pt.x, t.pt.y + 4);
        fx.stroke();
        fx.fillText(t.label, t.pt.x + 6, t.pt.y + 3);
      }

      // 4. Biometric ID Badge Card
      const cw = 268;
      const ch = 118;
      let targetX = clamp(bx + bw / 2 - cw / 2, 10, frame.width - cw - 10);
      let targetY = by + bh + 16;
      if (targetY + ch > frame.height - 10) targetY = by - ch - 16;
      if (targetY < 12) targetY = 12;

      if (!this._cardX) { this._cardX = targetX; this._cardY = targetY; }
      else {
        this._cardX = lerp(this._cardX, targetX, 0.16);
        this._cardY = lerp(this._cardY, targetY, 0.16);
      }
      const cx = this._cardX;
      const cy = this._cardY;

      // Card Background & Neon Border
      roundRect(fx, cx, cy, cw, ch, 14);
      fx.fillStyle = 'rgba(8, 12, 24, 0.90)';
      fx.fill();
      fx.strokeStyle = 'rgba(0, 245, 255, 0.45)';
      fx.lineWidth = 1.5;
      fx.stroke();

      // Top Header: Status bar with pulsing green dot
      fx.fillStyle = '#10b981';
      fx.beginPath();
      fx.arc(cx + 16, cy + 16, 3.5, 0, Math.PI * 2);
      fx.fill();

      fx.font = '700 9.5px ui-monospace, Menlo, monospace';
      fx.fillStyle = 'rgba(0, 245, 255, 0.9)';
      fx.fillText('BIOMETRIC SCAN // ACTIVE', cx + 26, cy + 19);

      fx.font = '600 9.5px ui-monospace, Menlo, monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      fx.textAlign = 'right';
      fx.fillText('BIO-ID #4092', cx + cw - 14, cy + 19);
      fx.textAlign = 'left';

      // Age Hero Display
      fx.font = '800 24px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = '#ffffff';
      fx.fillText(`~${dispAge}`, cx + 14, cy + 48);

      fx.font = '600 12px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255, 255, 255, 0.55)';
      fx.fillText('YRS', cx + 16 + fx.measureText(`~${dispAge}`).width + 4, cy + 48);

      // Generation Badge Pill
      const badgeText = `${genIcon} ${genTitle}`;
      fx.font = '700 11px -apple-system, "Segoe UI", sans-serif';
      const badgeW = fx.measureText(badgeText).width + 16;
      const badgeX = cx + cw - badgeW - 14;
      const badgeY = cy + 30;

      roundRect(fx, badgeX, badgeY, badgeW, 22, 6);
      fx.fillStyle = genBadgeColor + '22';
      fx.fill();
      fx.strokeStyle = genBadgeColor + '88';
      fx.lineWidth = 1;
      fx.stroke();

      fx.fillStyle = genBadgeColor;
      fx.fillText(badgeText, badgeX + 8, badgeY + 15);

      // Gender & Confidence Row
      const genderSymbol = isMale ? '♂ Male' : '♀ Female';
      fx.font = '600 12px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = '#ffffff';
      fx.fillText(genderSymbol, cx + 14, cy + 76);

      // Confidence Bar
      const confTrackW = 75;
      const confTrackX = cx + 80;
      const confY = cy + 69;
      roundRect(fx, confTrackX, confY, confTrackW, 6, 3);
      fx.fillStyle = 'rgba(255, 255, 255, 0.14)';
      fx.fill();

      roundRect(fx, confTrackX, confY, Math.max(4, confTrackW * (dispConf / 100)), 6, 3);
      fx.fillStyle = '#38bdf8';
      fx.fill();

      fx.font = '600 10px ui-monospace, Menlo, monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      fx.fillText(`${dispConf}%`, confTrackX + confTrackW + 8, cy + 76);

      // Vibe Tag
      fx.font = '500 10.5px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255, 255, 255, 0.7)';
      fx.fillText(`Vibe: ${genVibe}`, cx + 14, cy + 96);

      // Tiny Disclaimer
      fx.font = '500 8.5px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255, 255, 255, 0.4)';
      fx.textAlign = 'right';
      fx.fillText('AI estimate · 100% on-device', cx + cw - 14, cy + 110);
      fx.textAlign = 'left';

      fx.restore();
    }
  },

  {
    id: 'firebreath', name: 'Fire Breath', icon: '🐉', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) { this._p = []; return; }
      if (!this._p) this._p = [];
      const dt = clamp(frame.dt, 0, 50);
      const openRatio = Math.hypot(g.pts[62].x - g.pts[66].x, g.pts[62].y - g.pts[66].y) / g.eyeDist;
      if (openRatio > 0.32) {
        for (let i = 0; i < 5; i++) {
          this._p.push({
            x: g.mouth.x + rand(-6, 6),
            y: g.mouth.y,
            vx: rand(-0.08, 0.08),
            vy: -rand(0.12, 0.42),
            life: rand(450, 900),
            age: 0,
            r: rand(8, 20)
          });
        }
      }
      fx.globalCompositeOperation = 'lighter';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const rad = p.r * (1 + (1 - k) * 1.7);
        const grad = fx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
        grad.addColorStop(0, `rgba(255,230,140,${0.85 * k})`);
        grad.addColorStop(0.45, `rgba(255,120,40,${0.6 * k})`);
        grad.addColorStop(1, 'rgba(255,40,0,0)');
        fx.fillStyle = grad;
        fx.beginPath();
        fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalCompositeOperation = 'source-over';
      if (this._p.length > 300) this._p.splice(0, this._p.length - 300);
    }
  },
  {
    id: 'confetti', name: 'Smile Confetti', icon: '🎊', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;

      if (!this._p) this._p = [];
      const dt = clamp(frame.dt || 16, 1, 60);
      const dtSec = dt / 1000;

      // --- Instant Smile Detector from landmarks + expression fallback ---
      const pts = g.pts;
      const mouthW = Math.hypot(pts[54].x - pts[48].x, pts[54].y - pts[48].y);
      const lipLift = ((pts[51].y - pts[48].y) + (pts[51].y - pts[54].y)) / 2;
      const smileScore = (mouthW / g.eyeDist) * 0.7 + (lipLift / g.eyeDist) * 1.6;
      const exprHappy = frame.face && frame.face.expressions ? frame.face.expressions.happy || 0 : 0;
      const isSmiling = smileScore > 0.54 || exprHappy > 0.42;

      // Burst confetti particles when smiling
      if (isSmiling) {
        const cheekL = { x: pts[48].x - g.eyeDist * 0.15, y: pts[48].y - g.eyeDist * 0.1 };
        const cheekR = { x: pts[54].x + g.eyeDist * 0.15, y: pts[54].y - g.eyeDist * 0.1 };

        // Burst 4-6 particles per frame
        for (let i = 0; i < 4; i++) {
          const origin = Math.random() < 0.5 ? cheekL : cheekR;
          const isLeft = origin === cheekL;
          const angle = isLeft ? rand(-2.6, -1.2) : rand(-1.9, -0.5);
          const speed = rand(220, 520);
          this._p.push({
            x: origin.x + rand(-8, 8),
            y: origin.y + rand(-8, 8),
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            rotX: Math.random() * Math.PI * 2,
            rotY: Math.random() * Math.PI * 2,
            rotZ: Math.random() * Math.PI * 2,
            vRotX: rand(-12, 12),
            vRotY: rand(-14, 14),
            vRotZ: rand(-6, 6),
            w: rand(8, 16),
            h: rand(6, 12),
            type: Math.random() < 0.25 ? 'star' : (Math.random() < 0.35 ? 'circle' : 'ribbon'),
            color: pick(['#e11d48', '#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#fde047', '#38bdf8']),
            age: 0,
            life: rand(800, 1600)
          });
        }
      }

      // --- Update & Render 3D Tumbling Confetti ---
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }

        p.x += p.vx * dtSec;
        p.y += p.vy * dtSec;
        p.vy += 320 * dtSec; // gravity
        p.vx *= 0.985;       // air resistance
        p.rotX += p.vRotX * dtSec;
        p.rotY += p.vRotY * dtSec;
        p.rotZ += p.vRotZ * dtSec;

        const alpha = clamp(1 - p.age / p.life, 0, 1);
        const scaleX = Math.cos(p.rotX);
        const scaleY = Math.sin(p.rotY);

        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(p.rotZ);
        fx.scale(scaleX, scaleY);
        fx.globalAlpha = alpha;

        // Specular glint when edge faces light
        const facingLight = Math.abs(scaleX * scaleY);
        if (facingLight < 0.15) {
          fx.fillStyle = '#ffffff';
        } else {
          fx.fillStyle = p.color;
        }

        if (p.type === 'circle') {
          fx.beginPath();
          fx.arc(0, 0, p.w * 0.45, 0, Math.PI * 2);
          fx.fill();
        } else if (p.type === 'star') {
          fx.beginPath();
          for (let k = 0; k < 5; k++) {
            const rot = (k * Math.PI * 2) / 5 - Math.PI / 2;
            const rOut = p.w * 0.55;
            const rIn = p.w * 0.24;
            fx.lineTo(Math.cos(rot) * rOut, Math.sin(rot) * rOut);
            fx.lineTo(Math.cos(rot + Math.PI / 5) * rIn, Math.sin(rot + Math.PI / 5) * rIn);
          }
          fx.closePath();
          fx.fill();
        } else {
          fx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        }
        fx.restore();
      }

      if (this._p.length > 350) this._p.splice(0, this._p.length - 350);
    }
  },
  {
    id: 'catears', name: 'Cat Ears & Whiskers', icon: '🐱', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 40);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const earW = eyeDist * 0.72;
      const earH = eyeDist * 0.95;

      fx.save();
      fx.translate(s.x, s.y);
      fx.rotate(s.a);

      // Twitch animation occasionally
      const twitch = Math.sin(t * 0.002) > 0.94 ? Math.sin(t * 0.03) * 0.15 : 0;

      // 1. Render Left & Right Cat Ears
      for (const side of [-1, 1]) {
        const earX = side * eyeDist * 0.85;
        const earY = -eyeDist * 1.05;

        fx.save();
        fx.translate(earX, earY);
        fx.rotate(side * 0.22 + (side === 1 ? twitch : 0));

        // Outer Ear
        fx.beginPath();
        fx.moveTo(-earW * 0.45, earH * 0.35);
        fx.bezierCurveTo(-earW * 0.4, -earH * 0.3, -earW * 0.1, -earH * 0.8, 0, -earH);
        fx.bezierCurveTo(earW * 0.2, -earH * 0.7, earW * 0.45, -earH * 0.2, earW * 0.45, earH * 0.35);
        fx.closePath();

        const catEarGrad = fx.createLinearGradient(-earW * 0.3, 0, earW * 0.3, -earH);
        catEarGrad.addColorStop(0, '#f43f5e');
        catEarGrad.addColorStop(0.5, '#fb7185');
        catEarGrad.addColorStop(1, '#e11d48');
        fx.fillStyle = catEarGrad;
        fx.fill();
        fx.strokeStyle = '#be123c';
        fx.lineWidth = 2.2;
        fx.stroke();

        // Inner Ear Fluff (Plush Pink)
        fx.beginPath();
        fx.moveTo(-earW * 0.25, earH * 0.25);
        fx.bezierCurveTo(-earW * 0.2, -earH * 0.2, 0, -earH * 0.65, 0, -earH * 0.8);
        fx.bezierCurveTo(earW * 0.1, -earH * 0.55, earW * 0.25, -earH * 0.1, earW * 0.25, earH * 0.25);
        fx.closePath();
        fx.fillStyle = '#fed7e2';
        fx.fill();

        // White inner fur wisps
        fx.strokeStyle = '#ffffff';
        fx.lineWidth = 2;
        for (let f = -2; f <= 2; f++) {
          fx.beginPath();
          fx.moveTo(-earW * 0.15, earH * 0.1 + f * 5);
          fx.lineTo(earW * 0.1, earH * 0.05 + f * 6);
          fx.stroke();
        }
        fx.restore();
      }

      // 2. Rosy Cheek Blush
      fx.fillStyle = 'rgba(244, 63, 94, 0.32)';
      for (const side of [-1, 1]) {
        fx.beginPath();
        fx.ellipse(side * eyeDist * 0.9, eyeDist * 0.38, eyeDist * 0.28, eyeDist * 0.16, side * 0.08, 0, Math.PI * 2);
        fx.fill();
      }

      // 3. Cute Pink Cat Button Nose
      const ny = eyeDist * 0.42;
      const nw = eyeDist * 0.26;
      const nh = eyeDist * 0.16;

      fx.beginPath();
      fx.moveTo(-nw * 0.5, ny - nh * 0.3);
      fx.quadraticCurveTo(0, ny - nh * 0.5, nw * 0.5, ny - nh * 0.3);
      fx.quadraticCurveTo(nw * 0.45, ny + nh * 0.5, 0, ny + nh * 0.65);
      fx.quadraticCurveTo(-nw * 0.45, ny + nh * 0.5, -nw * 0.5, ny - nh * 0.3);
      fx.closePath();

      const pinkNoseGrad = fx.createRadialGradient(0, ny - nh * 0.2, 1, 0, ny, nw * 0.5);
      pinkNoseGrad.addColorStop(0, '#fbcfe8');
      pinkNoseGrad.addColorStop(0.6, '#ec4899');
      pinkNoseGrad.addColorStop(1, '#db2777');
      fx.fillStyle = pinkNoseGrad;
      fx.fill();

      // Specular shine on nose
      fx.beginPath();
      fx.ellipse(-nw * 0.15, ny - nh * 0.2, nw * 0.14, nh * 0.18, -0.2, 0, Math.PI * 2);
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fill();

      // 4. Graceful 6 Whiskers with natural sway
      fx.strokeStyle = 'rgba(255, 255, 255, 0.92)';
      fx.lineWidth = Math.max(1.8, eyeDist * 0.032);
      fx.lineCap = 'round';

      for (const side of [-1, 1]) {
        const startX = side * eyeDist * 0.22;
        const wy = ny + eyeDist * 0.05;
        const angles = [-0.18, 0.02, 0.22];

        // Whisker root dots
        fx.fillStyle = 'rgba(225, 29, 72, 0.65)';
        angles.forEach((ang) => {
          fx.beginPath();
          fx.arc(startX, wy + ang * eyeDist * 0.5, 2, 0, Math.PI * 2);
          fx.fill();
        });

        // Curved whiskers
        angles.forEach((ang, idx) => {
          const swayW = Math.sin(t * 0.003 + idx * 0.8) * 3;
          fx.beginPath();
          fx.moveTo(startX, wy + ang * eyeDist * 0.5);
          fx.quadraticCurveTo(
            startX + side * eyeDist * 0.55,
            wy + ang * eyeDist * 0.7 + swayW,
            startX + side * eyeDist * 1.15,
            wy + ang * eyeDist * 1.15 + swayW * 1.5
          );
          fx.stroke();
        });
      }

      fx.restore();
    }
  },
  {
    id: 'angel', name: 'Golden Halo', icon: '😇', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 45);
      if (!s) return;

      const t = frame.time || performance.now();
      const eyeDist = s.eyeDist;
      const bob = Math.sin(t * 0.0032) * (eyeDist * 0.09);
      const hw = eyeDist * 1.05;
      const hh = eyeDist * 0.28;

      fx.save();
      fx.translate(s.x, s.y - eyeDist * 1.45 + bob);
      fx.rotate(s.a * 0.55);
      fx.translate(s.yaw * s.headW * 0.06, 0);

      // 1. Ambient Celestial Glow
      const glowGrad = fx.createRadialGradient(0, 0, hh * 0.4, 0, 0, hw * 1.25);
      glowGrad.addColorStop(0, 'rgba(254, 240, 138, 0.35)');
      glowGrad.addColorStop(0.5, 'rgba(250, 204, 21, 0.18)');
      glowGrad.addColorStop(1, 'rgba(234, 179, 8, 0)');
      fx.fillStyle = glowGrad;
      fx.beginPath();
      fx.ellipse(0, 0, hw * 1.25, hh * 1.5, 0, 0, Math.PI * 2);
      fx.fill();

      // 2. Main 3D Metallic Golden Torus Ring
      fx.beginPath();
      fx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);

      const torusGrad = fx.createLinearGradient(-hw, 0, hw, 0);
      torusGrad.addColorStop(0, '#ca8a04');
      torusGrad.addColorStop(0.25, '#fef08a');
      torusGrad.addColorStop(0.5, '#eab308');
      torusGrad.addColorStop(0.75, '#fef08a');
      torusGrad.addColorStop(1, '#a16207');

      fx.shadowColor = 'rgba(250, 204, 21, 0.9)';
      fx.shadowBlur = 22;
      fx.strokeStyle = torusGrad;
      fx.lineWidth = Math.max(4.5, eyeDist * 0.09);
      fx.stroke();

      // 3. Bright Specular Apex Core Ring
      fx.shadowColor = '#ffffff';
      fx.shadowBlur = 10;
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.8, eyeDist * 0.035);
      fx.beginPath();
      fx.ellipse(0, -hh * 0.15, hw * 0.98, hh * 0.85, 0, 0, Math.PI * 2);
      fx.stroke();
      fx.shadowBlur = 0;

      // 4. Drifting Celestial Sparkles
      for (let i = 0; i < 6; i++) {
        const starAngle = (t * 0.0018 + (i * Math.PI) / 3) % (Math.PI * 2);
        const floatUp = ((t * 0.04 + i * 25) % 40) - 20;
        const sx = Math.cos(starAngle) * (hw + 14);
        const sy = Math.sin(starAngle) * (hh + 8) + floatUp;
        const sparkA = (Math.sin(t * 0.005 + i * 1.5) + 1) * 0.45;

        if (sparkA > 0.1) {
          fx.fillStyle = `rgba(255, 255, 255, ${sparkA})`;
          fx.beginPath();
          fx.arc(sx, sy, Math.max(1.5, 2.5 * sparkA), 0, Math.PI * 2);
          fx.fill();
        }
      }

      fx.restore();
    }
  }
];

/** Register all face effects into an EffectManager instance. */
export function registerFaceEffects(manager) {
  manager.registerAll(defsFace);
}



