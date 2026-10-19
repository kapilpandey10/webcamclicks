/* WebcamClicks — Royal Crown face effect */

import { clamp, lerp, rand, makeCanvas } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

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

export default crownEffect;
