/* WebcamClicks — "Styles": professional photo & video looks.
   Every style is a full grading recipe rather than a CSS tint:
     tone curve + per-channel curves + split toning (LUTs, see grade-core.js)
     optional B&W channel mix, flash falloff, skin softening
     luminance-weighted film grain, halation / diffusion bloom, light leaks,
     projector flicker, gate weave, dust & scratches, date stamps
     and frame themes (instant photo, Super 8 gate, 35mm strip, scope letterbox,
     tintype plate, 4:3 academy) that are baked into photos and recordings. */

import { isMobile } from '../../utils.js';
import { makeGrade, applyGrain, glowPass, workCanvas, fitDims, clamp8 } from './grade-core.js';

const MAX_DIM = () => (isMobile() ? 520 : 760);
const pad2 = (n) => String(n).padStart(2, '0');

/* ---------- deterministic per-film-frame randomness ---------- */
function frameIndex(t) {
  return Math.floor((t || 0) / 41.7);
}
function rng(seed) {
  let s = (seed * 2654435761) >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return (s >>> 0) / 4294967296;
  };
}

/* ---------- frame layouts: where the picture goes ---------- */
function layout(frame, w, h) {
  const full = { x: 0, y: 0, w, h };
  switch (frame) {
    case 'instant': {
      const cardH = Math.min(h * 0.92, (w * 0.92) / 0.82);
      const cardW = cardH * 0.82;
      const side = cardW * 0.06;
      const cx = (w - cardW) / 2;
      const cy = (h - cardH) / 2;
      const img = cardW - side * 2;
      return { card: { x: cx, y: cy, w: cardW, h: cardH }, rect: { x: cx + side, y: cy + side, w: img, h: img } };
    }
    case 'super8': {
      const m = Math.min(w, h) * 0.05;
      return { rect: { x: m * 1.6, y: m, w: w - m * 2.6, h: h - m * 2 } };
    }
    case 'strip35': {
      const bar = h * 0.12;
      return { rect: { x: w * 0.012, y: bar, w: w * 0.976, h: h - bar * 2 } };
    }
    case 'scope': {
      // 2.39:1 letterbox (or full frame if already wider)
      const ih = Math.min(h, w / 2.39);
      return { rect: { x: 0, y: (h - ih) / 2, w, h: ih } };
    }
    case 'academy': {
      // 4:3 pillarbox for silent-era footage
      const iw = Math.min(w, h * (4 / 3));
      return { rect: { x: (w - iw) / 2, y: 0, w: iw, h } };
    }
    default:
      return { rect: full };
  }
}

/* ---------- drawing helpers ---------- */
function srcSize(src) {
  return [src.videoWidth || src.naturalWidth || src.width, src.videoHeight || src.naturalHeight || src.height];
}

/** Cover-crop src into (dw,dh) on ctx with an optional sub-pixel offset (gate weave). */
function drawCover(ctx, src, dw, dh, ox = 0, oy = 0) {
  const [sw, sh] = srcSize(src);
  const s = Math.max(dw / sw, dh / sh);
  const cw = dw / s;
  const ch = dh / s;
  ctx.drawImage(src, (sw - cw) / 2, (sh - ch) / 2, cw, ch, ox, oy, dw, dh);
}

function rectVignette(fx, r, strength, color = '0,0,0', inner = 0.45) {
  if (!strength) return;
  const cx = r.x + r.w / 2;
  const cy = r.y + r.h / 2;
  const g = fx.createRadialGradient(cx, cy, Math.min(r.w, r.h) * inner, cx, cy, Math.hypot(r.w, r.h) / 2);
  g.addColorStop(0, `rgba(${color},0)`);
  g.addColorStop(1, `rgba(${color},${strength})`);
  fx.save();
  fx.fillStyle = g;
  fx.fillRect(r.x, r.y, r.w, r.h);
  fx.restore();
}

function lightLeak(fx, r, t, strength, hue = 'warm') {
  const drift = Math.sin(t * 0.00045) * 0.5 + 0.5;
  const pulse = 0.75 + Math.sin(t * 0.0011) * 0.25;
  const cols = hue === 'pink' ? ['255,90,140', '255,170,120'] : ['255,90,30', '255,190,80'];
  fx.save();
  fx.globalCompositeOperation = 'screen';
  const spots = [
    [r.x + r.w * (0.02 + drift * 0.05), r.y + r.h * (0.2 + drift * 0.5), r.h * 0.75, cols[0]],
    [r.x + r.w * 0.98, r.y + r.h * (0.85 - drift * 0.4), r.h * 0.5, cols[1]]
  ];
  for (const [x, y, rad, c] of spots) {
    const g = fx.createRadialGradient(x, y, 0, x, y, rad);
    g.addColorStop(0, `rgba(${c},${0.55 * strength * pulse})`);
    g.addColorStop(0.45, `rgba(${c},${0.22 * strength * pulse})`);
    g.addColorStop(1, `rgba(${c},0)`);
    fx.fillStyle = g;
    fx.fillRect(r.x, r.y, r.w, r.h);
  }
  fx.restore();
}

function dustAndScratches(fx, r, t, amount) {
  const rand = rng(frameIndex(t) + 7);
  fx.save();
  const specks = Math.floor(rand() * 7 * amount);
  for (let i = 0; i < specks; i++) {
    const x = r.x + rand() * r.w;
    const y = r.y + rand() * r.h;
    const size = (0.6 + rand() * 2.2) * (r.w / 640);
    fx.fillStyle = rand() < 0.7 ? 'rgba(10,8,6,0.75)' : 'rgba(255,250,235,0.7)';
    if (rand() < 0.3) {
      // a hair
      fx.strokeStyle = fx.fillStyle;
      fx.lineWidth = Math.max(0.6, size * 0.4);
      fx.beginPath();
      fx.moveTo(x, y);
      fx.quadraticCurveTo(x + size * 6, y + size * 3, x + size * 3, y + size * 10);
      fx.stroke();
    } else {
      fx.beginPath();
      fx.arc(x, y, size, 0, Math.PI * 2);
      fx.fill();
    }
  }
  if (rand() < 0.45 * amount) {
    const x = r.x + rand() * r.w;
    fx.strokeStyle = 'rgba(255,250,230,0.35)';
    fx.lineWidth = Math.max(0.6, r.w / 900);
    fx.beginPath();
    fx.moveTo(x, r.y);
    fx.lineTo(x + (rand() - 0.5) * 6, r.y + r.h);
    fx.stroke();
  }
  fx.restore();
}

function dateStamp(fx, r) {
  const d = new Date();
  const str = `'${String(d.getFullYear()).slice(-2)} ${pad2(d.getMonth() + 1)} ${pad2(d.getDate())}`;
  const size = Math.max(11, Math.round(r.w * 0.034));
  fx.save();
  fx.font = `700 ${size}px "Courier New", ui-monospace, monospace`;
  fx.textAlign = 'right';
  fx.textBaseline = 'bottom';
  fx.shadowColor = 'rgba(255,80,0,0.9)';
  fx.shadowBlur = size * 0.45;
  fx.fillStyle = '#ffa23a';
  fx.fillText(str, r.x + r.w * 0.95, r.y + r.h * 0.95);
  fx.restore();
}

function roundRectPath(ctx, x, y, w, h, r) {
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/* ---------- frame painting ---------- */
function paintBackdrop(fx, frame, L, src, w, h) {
  if (frame === 'instant') {
    // Blurred, dimmed scene behind the print, like a photo resting on a table
    fx.save();
    fx.filter = 'blur(18px) brightness(0.45) saturate(0.8)';
    drawCover(fx, src, w, h);
    fx.restore();
    const c = L.card;
    fx.save();
    fx.shadowColor = 'rgba(0,0,0,0.45)';
    fx.shadowBlur = c.w * 0.06;
    fx.shadowOffsetY = c.w * 0.02;
    fx.fillStyle = '#f5f2ea';
    fx.fillRect(c.x, c.y, c.w, c.h);
    fx.restore();
    // subtle paper tone gradient
    const g = fx.createLinearGradient(c.x, c.y, c.x + c.w, c.y + c.h);
    g.addColorStop(0, 'rgba(255,255,255,0.35)');
    g.addColorStop(1, 'rgba(210,200,180,0.25)');
    fx.fillStyle = g;
    fx.fillRect(c.x, c.y, c.w, c.h);
  } else if (frame && frame !== 'plate') {
    fx.fillStyle = '#060606';
    fx.fillRect(0, 0, w, h);
  }
}

function paintFrameOverlay(fx, frame, L, w, h, t) {
  const r = L.rect;
  if (frame === 'instant') {
    // inner edge shadow so the picture sits *in* the print
    fx.save();
    fx.strokeStyle = 'rgba(0,0,0,0.18)';
    fx.lineWidth = Math.max(1, r.w * 0.004);
    fx.strokeRect(r.x, r.y, r.w, r.h);
    fx.restore();
  } else if (frame === 'super8') {
    // rounded film gate with a soft edge + sprocket hole
    fx.save();
    fx.beginPath();
    fx.rect(0, 0, w, h);
    roundRectPath(fx, r.x, r.y, r.w, r.h, Math.min(r.w, r.h) * 0.07);
    fx.fillStyle = '#060606';
    fx.fill('evenodd');
    fx.restore();
    const hw = r.x * 0.42;
    const hh = h * 0.1;
    fx.save();
    fx.fillStyle = 'rgba(235,228,210,0.9)';
    fx.beginPath();
    roundRectPath(fx, r.x * 0.28, h * 0.5 - hh / 2 + Math.sin(t * 0.004) * 1.5, hw, hh, hw * 0.3);
    fx.fill();
    fx.restore();
  } else if (frame === 'strip35') {
    const bar = r.y;
    fx.fillStyle = '#0b0a09';
    fx.fillRect(0, 0, w, bar);
    fx.fillRect(0, h - bar, w, bar);
    fx.fillRect(0, 0, r.x, h);
    fx.fillRect(r.x + r.w, 0, w - r.x - r.w, h);
    const holeW = bar * 0.34;
    const holeH = bar * 0.42;
    const step = holeW * 2.05;
    fx.fillStyle = '#e9e4d6';
    for (let x = step * 0.4; x < w; x += step) {
      for (const y of [bar * 0.18, h - bar * 0.18 - holeH]) {
        fx.beginPath();
        roundRectPath(fx, x, y, holeW, holeH, holeW * 0.22);
        fx.fill();
      }
    }
    const size = Math.max(9, bar * 0.2);
    fx.font = `700 ${size}px "Courier New", ui-monospace, monospace`;
    fx.fillStyle = '#ff9b2f';
    fx.textBaseline = 'middle';
    fx.textAlign = 'left';
    const n = (frameIndex(t) >> 5) % 36 + 1;
    fx.fillText(`WEBCAMCLICKS 400   ▸ ${n}   ${n}A`, w * 0.06, bar * 0.8);
    fx.textAlign = 'right';
    fx.fillText('◂ SAFETY FILM   W C C', w * 0.94, h - bar * 0.8);
  } else if (frame === 'plate') {
    // tintype: dark, uneven chemical edges and rounded plate corners
    fx.save();
    const g = fx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.32, w / 2, h / 2, Math.hypot(w, h) * 0.52);
    g.addColorStop(0, 'rgba(20,16,10,0)');
    g.addColorStop(0.75, 'rgba(20,16,10,0.55)');
    g.addColorStop(1, 'rgba(12,10,6,0.95)');
    fx.fillStyle = g;
    fx.fillRect(0, 0, w, h);
    fx.beginPath();
    fx.rect(0, 0, w, h);
    roundRectPath(fx, w * 0.02, h * 0.03, w * 0.96, h * 0.94, Math.min(w, h) * 0.05);
    fx.fillStyle = '#16120c';
    fx.fill('evenodd');
    fx.restore();
  }
}

/* ---------- per-pixel pre-steps ---------- */
function monoMix(d, [wr, wg, wb]) {
  for (let i = 0; i < d.length; i += 4) {
    const l = d[i] * wr + d[i + 1] * wg + d[i + 2] * wb;
    d[i] = d[i + 1] = d[i + 2] = l;
  }
}

let flashMap = null;
let flashKey = '';
function flashFalloff(d, w, h, strength) {
  const key = `${w}x${h}`;
  if (flashKey !== key) {
    flashKey = key;
    flashMap = new Float32Array(w * h);
    const cx = w / 2;
    const cy = h * 0.42;
    const rad = Math.min(w, h) * 0.5;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (x - cx) / rad;
        const dy = (y - cy) / (rad * 1.15);
        flashMap[y * w + x] = 1 / (1 + (dx * dx + dy * dy) * 1.4);
      }
    }
  }
  for (let p = 0, i = 0; p < flashMap.length; p++, i += 4) {
    const g = 1 - strength + strength * (0.45 + 0.85 * flashMap[p]);
    d[i] = clamp8(d[i] * g);
    d[i + 1] = clamp8(d[i + 1] * g);
    d[i + 2] = clamp8(d[i + 2] * g);
  }
}

/* ---------- the factory ---------- */
function makeLook(def) {
  const grade = makeGrade(def.grade);
  const o = def.fx || {};
  return {
    id: def.id,
    name: def.name,
    icon: def.icon,
    category: 'Styles',
    perf: 'medium',
    description: def.description,
    render(fx, { src, width: w, height: h, time = 0 }) {
      const L = layout(o.frame, w, h);
      const r = L.rect;
      const [bw, bh] = fitDims(r.w, r.h, MAX_DIM());
      const buf = workCanvas('look', bw, bh);
      const b = buf.x;
      b.imageSmoothingEnabled = true;

      // gate weave: tiny frame-to-frame jitter of the film in the gate
      let ox = 0, oy = 0;
      if (o.weave) {
        const rr = rng(frameIndex(time));
        ox = (rr() - 0.5) * o.weave;
        oy = (rr() - 0.5) * o.weave * 1.6;
      }
      if (ox || oy) { b.fillStyle = '#000'; b.fillRect(0, 0, bw, bh); }
      drawCover(b, src, bw, bh, ox, oy);
      if (o.soften) {
        // skin softening: blend a blurred copy into the mids
        b.save();
        b.globalAlpha = o.soften;
        b.filter = `blur(${Math.max(1.5, bw / 260)}px)`;
        drawCover(b, src, bw, bh, ox, oy);
        b.restore();
      }

      const img = b.getImageData(0, 0, bw, bh);
      const d = img.data;
      if (o.flash) flashFalloff(d, bw, bh, o.flash);
      if (o.mono) monoMix(d, o.mono);
      grade(d);
      if (o.grain) applyGrain(d, bw, bh, time, o.grain, o.chroma || 0);
      b.putImageData(img, 0, 0);

      paintBackdrop(fx, o.frame, L, src, w, h);
      fx.imageSmoothingEnabled = true;
      fx.drawImage(buf.c, 0, 0, bw, bh, r.x, r.y, r.w, r.h);

      if (o.bloom) {
        glowPass(fx, buf.c, w, h, { filter: `brightness(${o.bloom.bright || 1}) blur(${o.bloom.blur || 8}px)`, alpha: o.bloom.alpha, tint: o.bloom.tint, scale: 3, rect: r });
      }
      if (o.halation) {
        glowPass(fx, buf.c, w, h, { filter: 'brightness(0.72) contrast(3.6) saturate(0) blur(4px)', tint: o.halation.tint || '#ff4a1c', alpha: o.halation.alpha, scale: 3, rect: r });
      }
      if (o.leak) lightLeak(fx, r, time, o.leak, o.leakHue);
      if (o.flicker) {
        const k = (rng(frameIndex(time) + 3)() - 0.5) * o.flicker;
        fx.save();
        fx.fillStyle = k > 0 ? `rgba(255,248,230,${k})` : `rgba(0,0,0,${-k})`;
        fx.fillRect(r.x, r.y, r.w, r.h);
        fx.restore();
      }
      rectVignette(fx, r, o.vignette || 0, o.vignetteColor, o.vignetteInner ?? 0.42);
      if (o.dust) dustAndScratches(fx, r, time, o.dust);
      paintFrameOverlay(fx, o.frame, L, w, h, time);
      if (o.stamp) dateStamp(fx, r);
    }
  };
}

/* ======================= the collection ======================= */

const DEFS = [
  {
    id: 'portra400', name: 'Portrait 400', icon: '🎞️',
    description: 'Warm, low-contrast colour negative film made for people: soft skin tones, creamy highlights, gentle pastel greens and fine grain.',
    grade: { master: [[0, 14], [64, 70], [128, 134], [192, 200], [255, 248]], r: [[0, 0], [128, 135], [255, 255]], b: [[0, 6], [128, 121], [255, 238]], shadows: [118, 134, 140], highlights: [156, 136, 112], split: 0.5, saturation: 0.92 },
    fx: { grain: 9, halation: { alpha: 0.16 }, vignette: 0.22 }
  },
  {
    id: 'fujifilm', name: 'Street 400', icon: '📼',
    description: 'Everyday consumer film with cool green-cyan shadows, crisp contrast and punchy blues — the classic street and travel snapshot look.',
    grade: { master: [[0, 8], [64, 58], [128, 130], [192, 206], [255, 250]], g: [[0, 4], [128, 133], [255, 252]], shadows: [100, 150, 140], highlights: [142, 136, 118], split: 0.6, saturation: 1.06 },
    fx: { grain: 11, vignette: 0.25 }
  },
  {
    id: 'slide64', name: 'Slide Film 64', icon: '🟥',
    description: 'Rich slide-film colour: deep blacks, saturated reds and blues, and very fine grain. Bold, glossy and magazine-ready.',
    grade: { master: [[0, 0], [48, 34], [128, 128], [200, 216], [255, 255]], r: [[0, 0], [128, 132], [255, 255]], shadows: [112, 112, 152], highlights: [140, 132, 120], split: 0.4, saturation: 1.28 },
    fx: { grain: 5, vignette: 0.3 }
  },
  {
    id: 'vintage70s', name: '1970s Film', icon: '📽️',
    description: 'A faded 1970s print: lifted blacks, amber-yellow cast, soft contrast, warm light leaks and visible grain.',
    grade: { master: [[0, 40], [128, 140], [255, 236]], r: [[0, 10], [255, 255]], b: [[0, 8], [255, 214]], shadows: [150, 122, 100], highlights: [172, 146, 100], split: 0.6, saturation: 0.84 },
    fx: { grain: 13, leak: 0.7, vignette: 0.35 }
  },
  {
    id: 'disposable90s', name: '90s Disposable', icon: '📸',
    description: 'Cheap disposable camera with the flash on: a bright centre falling into dark edges, green-tinted shadows, heavy grain and an orange date stamp.',
    grade: { master: [[0, 6], [64, 66], [128, 140], [200, 222], [255, 252]], g: [[0, 6], [128, 132], [255, 255]], shadows: [104, 150, 120], highlights: [160, 146, 120], split: 0.55, saturation: 1.18 },
    fx: { flash: 0.85, grain: 15, chroma: 0.6, leak: 0.35, vignette: 0.4, stamp: true }
  },
  {
    id: 'polaroid', name: 'Instant Film', icon: '📷',
    description: 'An instant print, framed: faded cyan shadows, creamy highlights and a soft glow, set in a white instant-photo border over a blurred backdrop.',
    grade: { master: [[0, 30], [128, 136], [255, 238]], shadows: [100, 140, 150], highlights: [166, 150, 120], split: 0.6, saturation: 0.9 },
    fx: { frame: 'instant', grain: 6, bloom: { alpha: 0.16, blur: 7, bright: 1.05 }, vignette: 0.2 }
  },
  {
    id: 'film_strip', name: '35mm Film Strip', icon: '🎞️',
    description: 'Your shot printed as a frame on a strip of 35mm negative film, complete with sprocket holes and orange edge markings.',
    grade: { master: [[0, 12], [64, 66], [128, 134], [192, 202], [255, 246]], r: [[0, 0], [128, 134], [255, 255]], b: [[0, 6], [255, 236]], shadows: [116, 134, 140], highlights: [156, 138, 112], split: 0.5, saturation: 0.95 },
    fx: { frame: 'strip35', grain: 10, halation: { alpha: 0.14 }, vignette: 0.2 }
  },
  {
    id: 'super8', name: 'Super 8', icon: '🎬',
    description: 'Home-movie Super 8: rounded film gate with a sprocket hole, warm faded colour, gate weave, flicker, light leaks and coarse grain. Best for video.',
    grade: { master: [[0, 26], [128, 136], [255, 238]], r: [[0, 6], [255, 255]], b: [[0, 4], [255, 220]], shadows: [140, 120, 110], highlights: [175, 150, 110], split: 0.55, saturation: 0.95 },
    fx: { frame: 'super8', grain: 20, weave: 3, flicker: 0.06, leak: 0.6, vignette: 0.45, dust: 0.6 }
  },
  {
    id: 'goldenhour', name: 'Golden Hour', icon: '🌅',
    description: 'The hour before sunset: warm amber highlights, soft glowing light and gentle contrast that flatters every skin tone.',
    grade: { master: [[0, 10], [128, 138], [255, 252]], r: [[0, 4], [128, 140], [255, 255]], b: [[0, 0], [128, 112], [255, 220]], shadows: [130, 116, 110], highlights: [196, 150, 96], split: 0.6, saturation: 1.08 },
    fx: { grain: 6, bloom: { alpha: 0.28, blur: 9, bright: 1.05, tint: '#ffcc88' }, leak: 0.3, vignette: 0.2 }
  },
  {
    id: 'hollywood', name: 'Teal & Orange', icon: '🎬',
    description: 'The blockbuster grade: teal shadows, warm orange skin, strong contrast and a 2.39:1 cinemascope letterbox.',
    grade: { master: [[0, 4], [64, 54], [128, 130], [192, 210], [255, 250]], shadows: [70, 140, 152], highlights: [192, 142, 96], split: 0.9, saturation: 1.1 },
    fx: { frame: 'scope', grain: 6, halation: { alpha: 0.12 }, vignette: 0.3 }
  },
  {
    id: 'neonnoir', name: 'Neon Night', icon: '🌆',
    description: 'Night-city neon: deep violet shadows, magenta highlights, high contrast and a glowing bloom on every light.',
    grade: { master: [[0, 0], [64, 44], [128, 124], [200, 214], [255, 255]], shadows: [92, 60, 162], highlights: [212, 110, 176], split: 0.85, saturation: 1.18 },
    fx: { grain: 8, bloom: { alpha: 0.4, blur: 10, bright: 0.95, tint: '#ff6ad5' }, vignette: 0.45 }
  },
  {
    id: 'cyberpunk', name: 'Cyberpunk', icon: '🤖',
    description: 'Electric cyan shadows against hot pink highlights, crushed blacks and a neon bloom — straight out of a rainy future city.',
    grade: { master: [[0, 0], [60, 40], [128, 128], [200, 218], [255, 255]], shadows: [50, 160, 180], highlights: [236, 92, 196], split: 1, saturation: 1.22 },
    fx: { grain: 7, bloom: { alpha: 0.38, blur: 9, bright: 0.95 }, vignette: 0.4 }
  },
  {
    id: 'vaporwave', name: 'Vaporwave', icon: '🌴',
    description: 'Pastel pink and cyan, lifted shadows and a soft glow — the dreamy palette of 90s mall aesthetics and lo-fi album art.',
    grade: { master: [[0, 30], [128, 140], [255, 245]], shadows: [80, 124, 204], highlights: [255, 150, 204], split: 0.9, saturation: 1.1 },
    fx: { grain: 5, bloom: { alpha: 0.28, blur: 9, bright: 1.05 }, leak: 0.35, leakHue: 'pink' }
  },
  {
    id: 'promist', name: 'Pro-Mist', icon: '✨',
    description: 'A cinematographer\'s diffusion filter: highlights bloom softly into the frame, contrast relaxes and skin glows, while detail stays sharp.',
    grade: { master: [[0, 16], [128, 132], [255, 248]], shadows: [128, 128, 136], highlights: [146, 136, 124], split: 0.3, saturation: 0.96 },
    fx: { grain: 4, bloom: { alpha: 0.5, blur: 10, bright: 1.12 }, vignette: 0.15 }
  },
  {
    id: 'bright', name: 'Clean Glow', icon: '💡',
    description: 'A flattering everyday look for calls and selfies: gently smoothed skin, brighter mid-tones, clean whites and a subtle glow.',
    grade: { master: [[0, 8], [64, 76], [128, 146], [200, 220], [255, 255]], shadows: [130, 126, 128], highlights: [140, 132, 126], split: 0.25, saturation: 1.03 },
    fx: { soften: 0.4, bloom: { alpha: 0.18, blur: 8, bright: 1.05 } }
  },
  {
    id: 'pastel', name: 'Pastel Matte', icon: '🎀',
    description: 'Soft matte pastels: lifted lilac shadows, rosy highlights and low saturation for a calm, editorial feel.',
    grade: { master: [[0, 52], [128, 150], [255, 236]], shadows: [142, 130, 172], highlights: [176, 150, 150], split: 0.6, saturation: 0.7 },
    fx: { grain: 4 }
  },
  {
    id: 'moody_fade', name: 'Moody Fade', icon: '🌧️',
    description: 'Cool, desaturated and matte: faded blacks, muted colours and a quiet blue-grey mood.',
    grade: { master: [[0, 30], [64, 66], [128, 120], [200, 196], [255, 230]], shadows: [110, 130, 150], highlights: [150, 142, 132], split: 0.55, saturation: 0.72 },
    fx: { grain: 8, vignette: 0.3 }
  },
  {
    id: 'nordic', name: 'Nordic Clean', icon: '🏔️',
    description: 'Bright, airy and cool: clean whites, soft blue shadows and restrained colour, like Scandinavian interiors.',
    grade: { master: [[0, 14], [128, 146], [255, 255]], b: [[0, 6], [128, 136], [255, 255]], r: [[0, 0], [128, 124], [255, 250]], shadows: [118, 132, 150], highlights: [134, 136, 140], split: 0.4, saturation: 0.84 },
    fx: { grain: 3 }
  },
  {
    id: 'sunset_pink', name: 'Sunset Pink', icon: '🌸',
    description: 'Rose-gold highlights over purple shadows with a warm pink light leak — romantic, soft and very shareable.',
    grade: { master: [[0, 14], [128, 136], [255, 250]], shadows: [122, 90, 152], highlights: [255, 152, 142], split: 0.75, saturation: 1.08 },
    fx: { grain: 5, bloom: { alpha: 0.22, blur: 8 }, leak: 0.45, leakHue: 'pink' }
  },
  {
    id: 'matcha', name: 'Matcha', icon: '🍵',
    description: 'Fresh, soft greens and creamy highlights with gently lifted shadows — a calm, natural café palette.',
    grade: { master: [[0, 26], [128, 140], [255, 244]], g: [[0, 4], [128, 136], [255, 252]], shadows: [112, 150, 120], highlights: [172, 166, 140], split: 0.55, saturation: 0.86 },
    fx: { grain: 4 }
  },
  {
    id: 'lomo', name: 'Lomo Cross', icon: '🔆',
    description: 'Cross-processed toy-camera colour: yellow-green highlights, blue-shifted shadows, wild saturation and a heavy vignette.',
    grade: { master: [[0, 0], [64, 52], [128, 132], [200, 216], [255, 255]], r: [[0, 0], [64, 50], [192, 210], [255, 255]], g: [[0, 0], [64, 54], [192, 206], [255, 255]], b: [[0, 40], [255, 200]], saturation: 1.35 },
    fx: { grain: 10, vignette: 0.62, vignetteInner: 0.3 }
  },
  {
    id: 'contrast', name: 'Punchy Vivid', icon: '🎚️',
    description: 'Clean, high-impact colour: deeper blacks, brighter whites and boosted saturation without blowing out skin tones.',
    grade: { master: [[0, 0], [56, 42], [128, 130], [200, 218], [255, 255]], saturation: 1.3 },
    fx: {}
  },
  {
    id: 'bleach_bypass', name: 'Bleach Bypass', icon: '⚙️',
    description: 'The gritty war-film process: silver retained in the print gives low saturation, harsh contrast and a metallic sheen.',
    grade: { master: [[0, 0], [64, 46], [128, 132], [192, 220], [255, 255]], saturation: 0.42 },
    fx: { grain: 10, vignette: 0.35 }
  },
  {
    id: 'grayscale', name: 'Mono', icon: '⚫',
    description: 'Modern, clean black and white with smooth tones, open shadows and very fine grain.',
    grade: { master: [[0, 10], [64, 62], [128, 134], [200, 214], [255, 252]] },
    fx: { mono: [0.33, 0.52, 0.15], grain: 4 }
  },
  {
    id: 'trix400', name: 'Classic B&W 400', icon: '🖤',
    description: 'Gritty 400-speed black-and-white film shot through a red filter: bold contrast, dark skies, bright skin and pronounced grain.',
    grade: { master: [[0, 0], [56, 34], [128, 132], [196, 222], [255, 255]] },
    fx: { mono: [0.52, 0.38, 0.1], grain: 17, vignette: 0.4 }
  },
  {
    id: 'sepia', name: 'Sepia Toned', icon: '🟤',
    description: 'A properly toned print: warm brown shadows, cream highlights and soft contrast, like a sepia-toned photograph from a family album.',
    grade: { master: [[0, 18], [128, 134], [255, 244]], shadows: [112, 80, 48], highlights: [204, 176, 128], split: 1 },
    fx: { mono: [0.36, 0.5, 0.14], grain: 8, vignette: 0.35 }
  },
  {
    id: 'daguerreotype', name: 'Tintype 1890', icon: '🏛️',
    description: 'A Victorian tintype plate: cool silver-olive tones, deep contrast, chemical edge darkening and rounded plate corners.',
    grade: { master: [[0, 10], [64, 50], [128, 136], [200, 214], [255, 236]], shadows: [100, 104, 92], highlights: [176, 178, 160], split: 0.8 },
    fx: { mono: [0.2, 0.6, 0.2], frame: 'plate', grain: 10, dust: 0.4 }
  },
  {
    id: 'oldmovie', name: 'Silent Film', icon: '🎩',
    description: 'A 1920s silent movie: 4:3 frame, flickering exposure, gate weave, dust, hair and scratches on high-contrast black-and-white stock. Best for video.',
    grade: { master: [[0, 12], [64, 52], [128, 136], [200, 222], [255, 244]] },
    fx: { mono: [0.3, 0.58, 0.12], frame: 'academy', grain: 16, weave: 4, flicker: 0.12, dust: 1, vignette: 0.55, vignetteInner: 0.3 }
  }
];

export const lookEffects = DEFS.map(makeLook);
