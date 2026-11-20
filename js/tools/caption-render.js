/* WebcamClicks — animated caption styles: word timing → caption groups → canvas rendering.
   Used for the live preview and, frame by frame, when burning captions into a video. */

export const FONTS_CSS = 'https://fonts.googleapis.com/css2?family=Anton&family=Bangers&family=Montserrat:wght@800;900&family=Permanent+Marker&family=Poppins:wght@700;800&display=swap';

/* hl: what the highlight colour paints — the active word's text, or a box behind it */
export const STYLES = {
  pop:        { name: 'Bold pop', font: 'Montserrat', weight: 900, upper: true, fill: '#ffffff', active: '#ffe14d', hl: 'text', stroke: '#000000', strokeW: 0.2, shadow: 'rgba(0,0,0,.55)', pop: 1, group: '3', scale: 1.05 },
  karaoke:    { name: 'Karaoke', font: 'Poppins', weight: 800, fill: '#ffffff', active: '#3dff6e', hl: 'text', stroke: '#000000', strokeW: 0.16, karaoke: true, group: 'short' },
  box:        { name: 'Highlight box', font: 'Poppins', weight: 800, fill: '#ffffff', active: '#7c3aed', hl: 'box', shadow: 'rgba(0,0,0,.55)', pop: 1, group: '3' },
  oneword:    { name: 'One word', font: 'Anton', weight: 400, upper: true, fill: '#ffffff', active: '#ffe14d', hl: 'text', cycle: true, stroke: '#000000', strokeW: 0.14, pop: 2, group: '1', scale: 1.7 },
  gradient:   { name: 'Gradient', font: 'Montserrat', weight: 900, upper: true, fill: '#ffffff', active: '#ff2d95', hl: 'text', gradient: ['#ffb000', '#ff2d95'], stroke: '#1a0b14', strokeW: 0.14, pop: 1, group: '3' },
  comic:      { name: 'Comic', font: 'Bangers', weight: 400, upper: true, fill: '#ffe14d', active: '#ff4d2e', hl: 'text', stroke: '#111111', strokeW: 0.18, pop: 1, group: '3', scale: 1.2, spacing: 0.04 },
  neon:       { name: 'Neon', font: 'Montserrat', weight: 800, fill: '#e9fbff', active: '#ff7bf2', hl: 'text', glow: '#22d3ee', group: 'short' },
  marker:     { name: 'Marker', font: 'Permanent Marker', weight: 400, fill: '#ffffff', active: '#ff4d2e', hl: 'text', hardShadow: '#000000', tilt: true, group: '3', scale: 1.05 },
  coral:      { name: 'Coral bar', font: 'Poppins', weight: 700, fill: '#ffffff', active: '#0e0e12', hl: 'text', lineBox: '#ff4d2e', group: 'short' },
  typewriter: { name: 'Typewriter', font: 'Inter', weight: 700, fill: '#ffffff', active: '#ffffff', hl: 'text', lineBox: 'rgba(0,0,0,.75)', reveal: true, group: 'lines' },
  classic:    { name: 'Classic subtitle', font: 'Inter', weight: 600, fill: '#ffffff', active: '#ffffff', hl: 'text', lineBox: 'rgba(0,0,0,.72)', group: 'lines', scale: 0.85 },
  minimal:    { name: 'Minimal', font: 'Inter', weight: 600, fill: '#ffffff', active: '#ffffff', hl: 'text', shadow: 'rgba(0,0,0,.9)', group: 'lines', scale: 0.85 }
};
const CYCLE = ['#ffe14d', '#3dff6e', '#ffffff', '#ff5c7a', '#5ce1ff'];

const FALLBACK = 'Inter, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans Arabic", "Noto Sans CJK SC", "PingFang SC", Arial, sans-serif';
export const fontOf = (st, px) => `${st.weight} ${px}px "${st.font}", ${FALLBACK}`;

/** Wait (briefly) for a style's web font so the first frames don't render in a fallback font. */
export async function ensureFont(styleKey) {
  const st = STYLES[styleKey]; if (!st || !document.fonts) return;
  await Promise.race([document.fonts.load(fontOf(st, 40), 'Aa').catch(() => {}), new Promise((r) => setTimeout(r, 2500))]);
}

/* ---------------------------------------------------------------- words & groups */

const spaced = (t) => (t.match(/\s/g) || []).length >= Math.max(1, t.length / 14);

/** Split text into timed words spread over [start, end] by length (used for edits, imports, translations). */
export function wordsFromText(text, start, end) {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  let toks;
  if (spaced(t) || !/[　-鿿가-힯฀-๿]/.test(t)) toks = t.split(' ').map((w) => ` ${w}`);   // leading space = word boundary (trimmed when a caption starts)
  else { toks = []; for (let i = 0; i < t.length; i += 2) toks.push(t.slice(i, i + 2)); }   // CJK / Thai: no spaces between words
  const weight = toks.map((w) => w.trim().length + 1), total = weight.reduce((a, b) => a + b, 0);
  const span = Math.max(0.2, end - start);
  let acc = 0;
  return toks.map((w, i) => { const s = start + (acc / total) * span; acc += weight[i]; return { text: w, start: +s.toFixed(3), end: +(start + (acc / total) * span).toFixed(3) }; });
}

export const joinWords = (ws) => ws.map((w, i) => (i ? w.text : w.text.trimStart())).join('').replace(/\s+/g, ' ').trim();

function wrap(text, max) {
  if (text.length <= max || !/\s/.test(text)) return text;
  const words = text.split(' '); const lines = []; let line = '';
  for (const w of words) { if (line && (line + ' ' + w).length > max) { lines.push(line); line = w; } else line = line ? `${line} ${w}` : w; }
  if (line) lines.push(line);
  if (lines.length > 2) return [lines.slice(0, Math.ceil(lines.length / 2)).join(' '), lines.slice(Math.ceil(lines.length / 2)).join(' ')].join('\n');
  return lines.join('\n');
}

const LIMITS = { 1: { n: 1 }, 2: { n: 2 }, 3: { n: 3, d: 2.6 }, short: { c: 28, d: 3.4 }, lines: { c: 84, d: 6.5 } };

/** Group timed words into captions. mode: '1' | '2' | '3' | 'short' | 'lines'. */
export function groupWords(words, mode) {
  const lim = LIMITS[mode] || LIMITS.lines;
  const out = []; let cur = [];
  const flush = () => { if (cur.length) { const text = joinWords(cur); out.push({ start: cur[0].start, end: cur[cur.length - 1].end, words: cur, text: mode === 'lines' ? wrap(text, 42) : text }); cur = []; } };
  for (const w of words) {
    if (!w.text || !w.text.trim()) continue;
    if (cur.length) {
      const last = cur[cur.length - 1];
      const brk = (lim.n && cur.length >= lim.n)
        || (lim.c && joinWords([...cur, w]).length > lim.c)
        || w.start - last.end > 0.8
        || (lim.d && w.end - cur[0].start > lim.d)
        || (!lim.n && /[.!?。！？…]["'”)\]]?$/.test(last.text.trim()) && joinWords(cur).length > 12);
      if (brk) flush();
    }
    cur.push({ ...w });
  }
  flush();
  // hold each caption a moment after its last word (until the next one starts) to avoid flicker
  for (let i = 0; i < out.length; i++) {
    const nx = out[i + 1], hold = out[i].end + 0.5;
    out[i].end = +(nx ? Math.max(out[i].end, Math.min(hold, nx.start)) : hold).toFixed(3);
    out[i].start = +out[i].start.toFixed(3);
  }
  return out;
}

/** Re-time a caption's words after its text or times were edited. Keeps per-word timing when only spelling changed. */
export function retime(cue) {
  const fresh = wordsFromText(cue.text, cue.start, cue.end);
  const old = cue.words || [];
  if (old.length === fresh.length && old.length) cue.words = old.map((w, i) => ({ ...w, text: fresh[i].text }));
  else cue.words = fresh;
  // keep words inside the caption's time range
  const s = cue.start, e = cue.end, ws = cue.words, s0 = ws[0]?.start ?? s, e0 = ws[ws.length - 1]?.end ?? e;
  if (ws.length && (s0 < s - 0.01 || e0 > e + 0.01)) { const k = (e - s) / Math.max(0.01, e0 - s0); ws.forEach((w) => { w.start = +(s + (w.start - s0) * k).toFixed(3); w.end = +(s + (w.end - s0) * k).toFixed(3); }); }
}

/* ---------------------------------------------------------------- drawing */

const easeOutBack = (p) => 1 + 2.70158 * (p - 1) ** 3 + 1.70158 * (p - 1) ** 2;
function rrect(ctx, x, y, w, h, r) { r = Math.min(r, h / 2, w / 2); ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

/**
 * Draw one caption at time t onto a W×H area.
 * o = { style, size (30–120), y (0–1, vertical centre), fill, active, upper }
 */
export function drawCaption(ctx, W, H, cue, t, o) {
  if (!cue) return;
  const st = STYLES[o.style] || STYLES.pop;
  const fill = o.fill || st.fill, active = o.active || st.active, upper = o.upper ?? !!st.upper;
  const px = Math.max(8, Math.min(W, H) * (+o.size / 1000) * (st.scale || 1));
  const words = cue.words && cue.words.length ? cue.words : wordsFromText(cue.text, cue.start, cue.end);
  ctx.save();
  ctx.font = fontOf(st, px);
  if ('letterSpacing' in ctx) ctx.letterSpacing = st.spacing ? `${(px * st.spacing).toFixed(1)}px` : '0px';
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.lineJoin = 'round';
  // word gap: a little wider for styles whose pop or highlight box would otherwise eat the space
  const space = ctx.measureText(' ').width + px * (st.pop || st.hl === 'box' ? 0.16 : 0.04);
  const toks = [];
  words.forEach((w, i) => { let s = w.text.replace(/\n/g, ' '); const lead = i > 0 && /^\s/.test(s); s = s.trim(); if (!s) return; if (upper) s = s.toUpperCase(); toks.push({ w, s, lead, i, width: ctx.measureText(s).width }); });
  if (!toks.length) { ctx.restore(); return; }
  let idx = -1; toks.forEach((k, j) => { if (k.w.start <= t + 0.01) idx = j; });

  // wrap into lines that fit 88 % of the width; a pop needs a little headroom
  const maxW = W * 0.88 / (st.pop ? 1.08 : 1);
  const lines = []; let cur = [], curW = 0;
  for (const k of toks) {
    const gap = cur.length && k.lead ? space : 0;
    if (cur.length && curW + gap + k.width > maxW) { lines.push({ toks: cur, w: curW }); cur = []; curW = 0; }
    k.x = curW + (cur.length && k.lead ? space : 0); curW = k.x + k.width; cur.push(k);
  }
  if (cur.length) lines.push({ toks: cur, w: curW });
  const widest = Math.max(...lines.map((l) => l.w));
  const shrink = Math.min(1, maxW / widest);
  const lh = px * 1.24, blockH = lines.length * lh * shrink;
  const cy = Math.min(H - blockH / 2 - H * 0.03, Math.max(blockH / 2 + H * 0.03, H * o.y));
  ctx.translate(W / 2, cy); ctx.scale(shrink, shrink);
  const top = -(lines.length * lh) / 2;

  lines.forEach((line, li) => {
    const ly = top + lh * (li + 0.5), lx = -line.w / 2;
    if (st.lineBox) {
      const shown = st.reveal ? line.toks.filter((k) => k.w.start <= t + 0.02) : line.toks;
      if (shown.length) { const last = shown[shown.length - 1], padX = px * 0.38; ctx.fillStyle = st.lineBox; rrect(ctx, lx - padX, ly - lh / 2, last.x + last.width + padX * 2, lh, px * 0.22); ctx.fill(); }
    }
    for (const k of line.toks) {
      if (st.reveal && k.w.start > t + 0.02) continue;
      const j = toks.indexOf(k), isActive = j === idx, isPast = j < idx;
      let color = fill;
      if (st.cycle) color = CYCLE[k.i % CYCLE.length];
      else if (st.hl === 'text' && (isActive || (st.karaoke && isPast))) color = active;
      // pop: the word springs in when it is spoken
      let s = 1;
      if (st.pop && isActive) {
        const p = Math.min(1, Math.max(0, (t - k.w.start) / (st.pop === 2 ? 0.22 : 0.16)));
        s = st.pop === 2 ? 0.72 + 0.28 * easeOutBack(p) : 1 + 0.13 * Math.sin(Math.PI * p);
      }
      ctx.save();
      ctx.translate(lx + k.x + k.width / 2, ly);
      if (s !== 1) ctx.scale(s, s);
      if (st.tilt) ctx.rotate(((k.i % 3) - 1) * 0.035);
      const x = -k.width / 2;
      if (st.hl === 'box' && isActive) { const pad = px * 0.18; ctx.fillStyle = active; rrect(ctx, x - pad, -lh * 0.46, k.width + pad * 2, lh * 0.92, px * 0.2); ctx.fill(); }
      if (st.glow) {
        ctx.shadowColor = isActive ? active : st.glow; ctx.shadowBlur = px * 0.55;
        ctx.fillStyle = color; ctx.fillText(k.s, x, 0); ctx.fillText(k.s, x, 0);
      } else {
        if (st.hardShadow) { ctx.fillStyle = st.hardShadow; ctx.fillText(k.s, x + px * 0.07, px * 0.07); }
        if (st.shadow) { ctx.shadowColor = st.shadow; ctx.shadowBlur = px * 0.28; ctx.shadowOffsetY = px * 0.05; }
        if (st.stroke) { ctx.lineWidth = px * st.strokeW; ctx.strokeStyle = st.stroke; ctx.strokeText(k.s, x, 0); ctx.shadowColor = 'transparent'; }
        if (st.gradient && !isActive) { const g = ctx.createLinearGradient(0, -px / 2, 0, px / 2); g.addColorStop(0, st.gradient[0]); g.addColorStop(1, st.gradient[1]); ctx.fillStyle = g; }
        else ctx.fillStyle = color;
        ctx.fillText(k.s, x, 0);
      }
      ctx.restore();
    }
  });
  ctx.restore();
}
