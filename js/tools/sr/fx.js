/* WebcamClicks screen recorder — looks, text overlays and transitions. */

/* ---------------------------------------------------------------- colour looks */
export const LOOKS = {
  none:      { name: 'None',      b: 1,    c: 1,    s: 1,    warm: 0,     vig: 0,    gray: 0, sepia: 0 },
  vivid:     { name: 'Vivid',     b: 1.03, c: 1.12, s: 1.35, warm: 0.04,  vig: 0.12, gray: 0, sepia: 0 },
  cinematic: { name: 'Cinematic', b: 0.97, c: 1.18, s: 0.92, warm: 0.08,  vig: 0.35, gray: 0, sepia: 0 },
  warm:      { name: 'Warm',      b: 1.02, c: 1.04, s: 1.1,  warm: 0.16,  vig: 0.1,  gray: 0, sepia: 0 },
  cool:      { name: 'Cool',      b: 1.0,  c: 1.06, s: 1.0,  warm: -0.16, vig: 0.1,  gray: 0, sepia: 0 },
  bw:        { name: 'B&W',       b: 1.02, c: 1.15, s: 1,    warm: 0,     vig: 0.25, gray: 1, sepia: 0 },
  vintage:   { name: 'Vintage',   b: 1.04, c: 0.92, s: 0.85, warm: 0.1,   vig: 0.4,  gray: 0, sepia: 0.35 },
  soft:      { name: 'Soft',      b: 1.06, c: 0.9,  s: 0.95, warm: 0.04,  vig: 0.05, gray: 0, sepia: 0 }
};

/** Effective look = preset adjusted by the sliders (each slider is −100..100, 0 = preset value). */
export function lookFrom(preset, adj) {
  const p = LOOKS[preset] || LOOKS.none;
  return {
    b: p.b * (1 + adj.brightness / 250), c: p.c * (1 + adj.contrast / 200), s: p.s * (1 + adj.saturation / 100),
    warm: p.warm + adj.warmth / 300, vig: Math.max(0, p.vig + adj.vignette / 100), gray: p.gray, sepia: p.sepia
  };
}

export function isNeutral(L) {
  return Math.abs(L.b - 1) < 1e-3 && Math.abs(L.c - 1) < 1e-3 && Math.abs(L.s - 1) < 1e-3 && Math.abs(L.warm) < 1e-3 && L.vig < 1e-3 && !L.gray && !L.sepia;
}

/** CSS filter string applied while drawing the video (GPU-accelerated in browsers). */
export function filterString(L) {
  if (isNeutral(L)) return 'none';
  return `brightness(${L.b.toFixed(3)}) contrast(${L.c.toFixed(3)}) saturate(${L.s.toFixed(3)})${L.gray ? ` grayscale(${L.gray})` : ''}${L.sepia ? ` sepia(${L.sepia})` : ''}`;
}

/** Warmth tint + vignette over the whole frame. */
export function drawLookOverlay(ctx, W, H, L) {
  if (Math.abs(L.warm) > 1e-3) {
    ctx.save();
    ctx.globalCompositeOperation = 'soft-light';
    ctx.globalAlpha = Math.min(0.6, Math.abs(L.warm) * 2.2);
    ctx.fillStyle = L.warm > 0 ? '#ff9a3c' : '#3c8cff';
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }
  if (L.vig > 1e-3) {
    const g = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.hypot(W, H) * 0.6);
    g.addColorStop(0, 'rgba(0,0,0,0)');
    g.addColorStop(1, `rgba(0,0,0,${Math.min(0.8, L.vig).toFixed(3)})`);
    ctx.save(); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); ctx.restore();
  }
}

/* ---------------------------------------------------------------- text overlays */
export const TEXT_STYLES = {
  title:   'Title',
  lower:   'Lower third',
  caption: 'Caption',
  label:   'Label',
  callout: 'Callout'
};
export const TEXT_ANIMS = { fade: 'Fade', pop: 'Pop', slide: 'Slide up', type: 'Typewriter', none: 'None' };

const ease = (x) => 1 - Math.pow(1 - Math.max(0, Math.min(1, x)), 3);

function wrapLines(ctx, text, maxW) {
  const out = [];
  for (const para of String(text).split('\n')) {
    const words = para.split(/\s+/);
    let line = '';
    for (const w of words) {
      const test = line ? `${line} ${w}` : w;
      if (ctx.measureText(test).width > maxW && line) { out.push(line); line = w; } else line = test;
    }
    out.push(line);
  }
  return out;
}

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

/** Draw one text item at time t (source seconds). */
export function drawText(ctx, W, H, item, t, accent = '#ff4d2e') {
  if (t < item.start || t > item.end || !item.text.trim()) return;
  const k = Math.min(W, H);
  const inP = ease((t - item.start) / 0.45), outP = ease((item.end - t) / 0.35);
  const vis = Math.min(inP, outP);
  let alpha = 1, dy = 0, scale = 1, text = item.text;
  switch (item.anim) {
    case 'fade': alpha = vis; break;
    case 'pop': alpha = Math.min(1, vis * 1.5); scale = 0.85 + 0.15 * vis + (inP < 1 ? Math.sin(inP * Math.PI) * 0.06 : 0); break;
    case 'slide': alpha = vis; dy = (1 - vis) * k * 0.05; break;
    case 'type': alpha = outP; text = item.text.slice(0, Math.ceil(item.text.length * Math.min(1, (t - item.start) / Math.max(0.6, Math.min(2.5, item.text.length * 0.05))))); break;
    default: alpha = 1;
  }
  if (alpha <= 0.01) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  const font = (px, wgt = 800) => `${wgt} ${Math.round(px)}px Inter, "Segoe UI", Arial, sans-serif`;
  const pos = item.pos || 'auto';
  const st = item.style;
  if (st === 'title') {
    const px = k * 0.085;
    ctx.font = font(px);
    const lines = wrapLines(ctx, text, W * 0.82);
    const lh = px * 1.12, total = lines.length * lh;
    const cy = pos === 'top' ? H * 0.18 : pos === 'bottom' ? H * 0.8 : H / 2;
    ctx.translate(W / 2, cy + dy); ctx.scale(scale, scale);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,.45)'; ctx.shadowBlur = px * 0.35; ctx.shadowOffsetY = px * 0.06;
    ctx.fillStyle = item.color || '#ffffff';
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  } else if (st === 'lower') {
    const px = k * 0.042, sub = (item.sub || '').trim();
    ctx.font = font(px);
    const w1 = ctx.measureText(text).width;
    ctx.font = font(px * 0.62, 600);
    const w2 = sub ? ctx.measureText(sub).width : 0;
    const padX = px * 0.6, bw = Math.max(w1, w2) + padX * 2 + px * 0.25, bh = px * (sub ? 2.35 : 1.6);
    const x = pos === 'right' ? W - bw - k * 0.05 : k * 0.05, y = H - bh - k * 0.07 + dy;
    ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = px * 0.5;
    ctx.fillStyle = 'rgba(14,14,18,.88)'; rr(ctx, x, y, bw * (item.anim === 'slide' || item.anim === 'fade' ? 1 : Math.max(0.05, vis)), bh, px * 0.25); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = item.color || accent; ctx.fillRect(x, y, px * 0.22, bh);
    ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'left';
    ctx.fillStyle = '#fff'; ctx.font = font(px); ctx.fillText(text, x + padX + px * 0.1, y + px * 1.15);
    if (sub) { ctx.fillStyle = '#c7c9d1'; ctx.font = font(px * 0.62, 600); ctx.fillText(sub, x + padX + px * 0.1, y + px * 1.95); }
  } else if (st === 'caption') {
    const px = k * 0.045;
    ctx.font = font(px, 700);
    const lines = wrapLines(ctx, text, W * 0.8);
    const lh = px * 1.3, bw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + px * 1.2, bh = lines.length * lh + px * 0.6;
    const y = (pos === 'top' ? k * 0.06 : H - bh - k * 0.06) + dy;
    ctx.translate(W / 2, y + bh / 2); ctx.scale(scale, scale);
    ctx.fillStyle = 'rgba(0,0,0,.72)'; rr(ctx, -bw / 2, -bh / 2, bw, bh, px * 0.3); ctx.fill();
    ctx.fillStyle = item.color || '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, 0, (i - (lines.length - 1) / 2) * lh));
  } else if (st === 'callout') {
    const px = k * 0.05;
    ctx.font = font(px);
    const tw = ctx.measureText(text).width, bw = tw + px * 1.4, bh = px * 1.7;
    const cx = (item.x ?? 0.5) * W, cy = (item.y ?? 0.3) * H;
    ctx.translate(cx, cy + dy); ctx.scale(scale, scale);
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = px * 0.6; ctx.shadowOffsetY = px * 0.1;
    ctx.fillStyle = item.color || accent; rr(ctx, -bw / 2, -bh / 2, bw, bh, bh / 2); ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, 0, px * 0.04);
  } else {   // label
    const px = k * 0.032;
    ctx.font = font(px, 700);
    const bw = ctx.measureText(text).width + px * 1.2, bh = px * 1.8;
    const x = pos === 'right' ? W - bw - k * 0.04 : k * 0.04, y = (pos === 'bottom' ? H - bh - k * 0.04 : k * 0.04) + dy;
    ctx.fillStyle = item.color || accent; rr(ctx, x, y, bw, bh, bh / 2); ctx.fill();
    ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.fillText(text, x + px * 0.6, y + bh / 2 + px * 0.04);
  }
  ctx.restore();
}

/** Animation progress fingerprint for frame-skipping in export. */
export function textKey(items, t) {
  let k = '';
  for (const it of items) {
    if (t < it.start || t > it.end) continue;
    const p = Math.min(1, (t - it.start) / 0.45, (it.end - t) / 0.35, it.anim === 'type' ? (t - it.start) / 2.5 : 1);
    k += `${it.id}:${p.toFixed(3)};`;
  }
  return k;
}

/* ---------------------------------------------------------------- transitions */
export const TRANSITIONS = { smooth: 'Smooth move', fade: 'Fade', dip: 'Dip to black', slide: 'Slide', zoom: 'Zoom', wipe: 'Circle wipe', blur: 'Blur', cut: 'Cut' };

/** Combine two fully rendered frames a → b at progress p (0..1). */
export function composeTransition(ctx, W, H, a, b, p, style) {
  ctx.save();
  ctx.clearRect(0, 0, W, H);
  switch (style) {
    case 'dip': {
      ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      if (p < 0.5) { ctx.globalAlpha = 1 - p * 2; ctx.drawImage(a, 0, 0); } else { ctx.globalAlpha = (p - 0.5) * 2; ctx.drawImage(b, 0, 0); }
      break;
    }
    case 'slide': {
      const e = p * p * (3 - 2 * p);
      ctx.drawImage(a, -W * e, 0); ctx.drawImage(b, W * (1 - e), 0);
      break;
    }
    case 'zoom': {
      ctx.drawImage(a, 0, 0);
      const s = 0.8 + 0.2 * p;
      ctx.globalAlpha = Math.min(1, p * 1.6);
      ctx.translate(W / 2, H / 2); ctx.scale(s, s); ctx.drawImage(b, -W / 2, -H / 2);
      break;
    }
    case 'wipe': {
      ctx.drawImage(a, 0, 0);
      ctx.beginPath(); ctx.arc(W / 2, H / 2, Math.hypot(W, H) * 0.5 * p, 0, Math.PI * 2); ctx.clip();
      ctx.drawImage(b, 0, 0);
      break;
    }
    case 'blur': {
      const r = Math.round(Math.sin(p * Math.PI) * Math.min(W, H) * 0.02);
      if (typeof ctx.filter === 'string' && r > 0) ctx.filter = `blur(${r}px)`;
      ctx.globalAlpha = 1; ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = p; ctx.drawImage(b, 0, 0);
      break;
    }
    default: {   // fade
      ctx.drawImage(a, 0, 0);
      ctx.globalAlpha = p; ctx.drawImage(b, 0, 0);
    }
  }
  ctx.restore();
}
