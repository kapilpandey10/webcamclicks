/* WebcamClicks — editing existing PDF text (on-device).
   1. extractLines: pdf.js text runs → editable lines (position, size, font family, bold/italic)
   2. sampleColors: text and background colour under a line, from the rendered page
   3. removeShowText: parses a page's content stream and removes the text-showing operators whose
      origin lies inside the edited lines, so the old text is really gone (not just covered). */

/* ---------------------------------------------------------------- 1. lines */

function fontInfo(page, fontName, style) {
  let name = '';
  try { const fo = page.commonObjs.get(fontName); name = (fo && (fo.name || fo.loadedName)) || ''; } catch (_) { /* not loaded */ }
  const fam = `${name} ${style && style.fontFamily || ''}`;
  const family = /courier|mono|consol|menlo/i.test(fam) ? 'mono'
    : /times|georgia|garamond|cambria|book ?antiqua|palatino|minion|serif/i.test(fam) && !/sans/i.test(fam) ? 'serif' : 'sans';
  return { name: name.replace(/^[A-Z]{6}\+/, ''), family, bold: /bold|black|heavy|semibold|demi/i.test(name), italic: /italic|oblique/i.test(name) };
}

export async function extractLines(page) {
  const tc = await page.getTextContent();
  const runs = [];
  for (const it of tc.items) {
    if (!it.str || !it.str.trim()) continue;   // space-only runs (e.g. between table cells) are re-created from gaps
    const [a, b, c, d, e, f] = it.transform;
    if (Math.abs(b) > 0.01 || Math.abs(c) > 0.01 || a <= 0) continue;   // horizontal, upright text only
    const size = Math.hypot(c, d) || Math.abs(d) || it.height;
    if (!size) continue;
    const st = tc.styles[it.fontName] || {};
    runs.push({ str: it.str, x: e, y: f, w: it.width, size, fontName: it.fontName, ascent: st.ascent || 0.8, descent: st.descent || -0.2, ...fontInfo(page, it.fontName, st) });
  }
  // group runs into lines: same baseline, similar size, close together
  runs.sort((p, q) => (Math.abs(q.y - p.y) > p.size * 0.3 ? q.y - p.y : p.x - q.x));
  const lines = [];
  for (const r of runs) {
    const L = lines.find((l) => Math.abs(l.y - r.y) < l.size * 0.3 && Math.abs(l.size - r.size) < l.size * 0.2 && r.x >= l.x1 - l.size * 0.5 && r.x - l.x1 < l.size * 0.75);   // wider gaps = separate cells or columns
    if (L) {
      const gap = r.x - L.x1;
      L.str += (gap > L.size * 0.18 && !/\s$/.test(L.str) && !/^\s/.test(r.str) ? ' ' : '') + r.str;
      L.x1 = Math.max(L.x1, r.x + r.w); L.runs.push(r);
    } else lines.push({ str: r.str, x0: r.x, x1: r.x + r.w, y: r.y, size: r.size, ascent: r.ascent, descent: r.descent, family: r.family, bold: r.bold, italic: r.italic, font: r.name, runs: [r] });
  }
  // a line is bold / italic when most of its characters are (one bold name shouldn't make the whole line bold)
  const major = (l, k) => { const t = l.runs.reduce((a, r) => a + r.str.length, 0) || 1; return l.runs.filter((r) => r[k]).reduce((a, r) => a + r.str.length, 0) / t > 0.5; };
  return lines.filter((l) => l.str.trim()).map((l, i) => ({ ...l, bold: major(l, 'bold'), italic: major(l, 'italic'), str: l.str.replace(/\s+$/, ''), key: `${i}:${Math.round(l.x0)}:${Math.round(l.y)}` }));
}

/* ---------------------------------------------------------------- 2. colours */

const hex = (r, g, b) => `#${[r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`;

/** box in canvas pixels {x, y, w, h}. Returns { bg, color, uniform }. */
export function sampleColors(canvas, box) {
  const g = canvas.getContext('2d', { willReadFrequently: true });
  const m = 3, x0 = Math.max(0, Math.floor(box.x - m)), y0 = Math.max(0, Math.floor(box.y - m));
  const x1 = Math.min(canvas.width, Math.ceil(box.x + box.w + m)), y1 = Math.min(canvas.height, Math.ceil(box.y + box.h + m));
  if (x1 - x0 < 2 || y1 - y0 < 2) return { bg: '#ffffff', color: '#000000', uniform: true };
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data, W = x1 - x0, H = y1 - y0;
  // background: most common colour on the border ring
  const counts = new Map(), ring = [];
  const add = (x, y) => { const i = (y * W + x) * 4; const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); counts.set(k, (counts.get(k) || 0) + 1); ring.push(i); };
  for (let x = 0; x < W; x++) { add(x, 0); add(x, H - 1); }
  for (let y = 1; y < H - 1; y++) { add(0, y); add(W - 1, y); }
  let best = 0, bk = 0; for (const [k, n] of counts) if (n > best) { best = n; bk = k; }
  let br = 0, bg_ = 0, bb = 0, bn = 0;
  for (const i of ring) { const k = ((d[i] >> 3) << 10) | ((d[i + 1] >> 3) << 5) | (d[i + 2] >> 3); if (k === bk) { br += d[i]; bg_ += d[i + 1]; bb += d[i + 2]; bn++; } }
  br /= bn; bg_ /= bn; bb /= bn;
  const dist = (i) => Math.abs(d[i] - br) + Math.abs(d[i + 1] - bg_) + Math.abs(d[i + 2] - bb);
  const uniform = ring.filter((i) => dist(i) < 40).length / ring.length > 0.85;
  // text colour: the inside pixels that differ most from the background
  const inside = [];
  for (let y = m; y < H - m; y++) for (let x = m; x < W - m; x++) { const i = (y * W + x) * 4; inside.push([dist(i), i]); }
  inside.sort((p, q) => q[0] - p[0]);
  const top = inside.slice(0, Math.max(1, Math.floor(inside.length * 0.06)));
  let color = '#000000';
  if (top.length && top[0][0] > 60) {
    let r = 0, gg = 0, b = 0; for (const [, i] of top) { r += d[i]; gg += d[i + 1]; b += d[i + 2]; }
    color = hex(r / top.length, gg / top.length, b / top.length);
    // anti-aliasing pulls colours towards the background; snap near-black/near-white
    const [cr, cg, cb] = [1, 3, 5].map((o) => parseInt(color.slice(o, o + 2), 16));
    if (cr < 70 && cg < 70 && cb < 70 && Math.max(cr, cg, cb) - Math.min(cr, cg, cb) < 25) color = '#000000';
  }
  return { bg: hex(br, bg_, bb), color, uniform };
}

/* ---------------------------------------------------------------- 3. content stream surgery */

const WS = new Set([0, 9, 10, 12, 13, 32]);
const DELIM = new Set([40, 41, 60, 62, 91, 93, 123, 125, 47, 37]);
const mul = (m, n) => [m[0] * n[0] + m[1] * n[2], m[0] * n[1] + m[1] * n[3], m[2] * n[0] + m[3] * n[2], m[2] * n[1] + m[3] * n[3], m[4] * n[0] + m[5] * n[2] + n[4], m[4] * n[1] + m[5] * n[3] + n[5]];

/** Tokenise a content stream into operations [{op, args, start, end}] (byte offsets). Throws on anything unexpected. */
function parseOps(b) {
  const ops = []; let i = 0, args = [], argStart = -1;
  const n = b.length;
  const skipWs = () => { while (i < n) { if (WS.has(b[i])) i++; else if (b[i] === 37) { while (i < n && b[i] !== 10 && b[i] !== 13) i++; } else break; } };
  const readValue = () => {
    const c = b[i];
    if (c === 40) {   // literal string
      let depth = 0; const s = i;
      for (; i < n; i++) { if (b[i] === 92) { i++; continue; } if (b[i] === 40) depth++; else if (b[i] === 41 && --depth === 0) { i++; break; } }
      return { t: 'str', s };
    }
    if (c === 60 && b[i + 1] === 60) {   // dictionary (inline-image params / marked content)
      let depth = 0; const s = i;
      while (i < n) { if (b[i] === 60 && b[i + 1] === 60) { depth++; i += 2; } else if (b[i] === 62 && b[i + 1] === 62) { depth--; i += 2; if (!depth) break; } else if (b[i] === 40) readValue(); else i++; }
      return { t: 'dict', s };
    }
    if (c === 60) { const s = i; while (i < n && b[i] !== 62) i++; i++; return { t: 'hex', s }; }
    if (c === 91) {   // array
      const s = i; i++; const items = [];
      for (;;) { skipWs(); if (i >= n) throw new Error('unterminated array'); if (b[i] === 93) { i++; break; } items.push(readValue()); }
      return { t: 'arr', s, items };
    }
    if (c === 47) { const s = i; i++; while (i < n && !WS.has(b[i]) && !DELIM.has(b[i])) i++; return { t: 'name', s }; }
    const s = i; while (i < n && !WS.has(b[i]) && !DELIM.has(b[i])) i++;
    if (i === s) { i++; throw new Error(`unexpected byte ${c}`); }
    const tok = String.fromCharCode(...b.subarray(s, i));
    const num = Number(tok);
    if (tok !== '' && !Number.isNaN(num) && /^[+-]?(\d+\.?\d*|\.\d+)$/.test(tok)) return { t: 'num', s, v: num };
    return { t: 'op', s, v: tok };
  };
  while (i < n) {
    skipWs(); if (i >= n) break;
    const v = readValue();
    if (v.t !== 'op') { if (argStart < 0) argStart = v.s; args.push(v); continue; }
    if (v.v === 'true' || v.v === 'false' || v.v === 'null') { if (argStart < 0) argStart = v.s; args.push(v); continue; }
    if (v.v === 'BI') {   // inline image: BI … ID <binary> EI
      const s = argStart >= 0 ? argStart : v.s;
      let j = i; while (j < n - 1 && !(b[j] === 73 && b[j + 1] === 68 && WS.has(b[j - 1]) && (WS.has(b[j + 2]) || j + 2 >= n))) j++;
      j += 3;
      while (j < n - 2 && !(WS.has(b[j - 1]) && b[j] === 69 && b[j + 1] === 73 && (j + 2 >= n || WS.has(b[j + 2]) || DELIM.has(b[j + 2])))) j++;
      i = Math.min(n, j + 2);
      ops.push({ op: 'BI', args: [], start: s, end: i }); args = []; argStart = -1; continue;
    }
    ops.push({ op: v.v, args, start: argStart >= 0 ? argStart : v.s, end: i }); args = []; argStart = -1;
  }
  return ops;
}

/**
 * Remove text-showing operators (Tj, TJ, ', ") whose starting point falls inside one of the boxes.
 * boxes: [{x0, y0, x1, y1}] in PDF user space. Returns { bytes, hits: number[] } (hits per box).
 */
export function removeShowText(bytes, boxes) {
  const ops = parseOps(bytes);
  const hits = boxes.map(() => 0);
  let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
  let tm = [1, 0, 0, 1, 0, 0], tlm = tm.slice(), TL = 0, rise = 0, known = true, lastBox = -1;
  const num = (a) => (a && a.t === 'num' ? a.v : 0);
  const inBox = () => {
    const m = mul(tm, ctm), x = rise * m[2] + m[4], y = rise * m[3] + m[5];
    return boxes.findIndex((bx) => x >= bx.x0 && x <= bx.x1 && y >= bx.y0 && y <= bx.y1);
  };
  const cut = [];   // [start, end, replacement]
  const nextLine = () => { tlm = mul([1, 0, 0, 1, 0, -TL], tlm); tm = tlm.slice(); known = true; lastBox = -1; };
  for (const o of ops) {
    const a = o.args;
    switch (o.op) {
      case 'q': stack.push(ctm.slice()); break;
      case 'Q': ctm = stack.pop() || [1, 0, 0, 1, 0, 0]; break;
      case 'cm': if (a.length === 6) ctm = mul(a.map(num), ctm); break;
      case 'BT': tm = [1, 0, 0, 1, 0, 0]; tlm = tm.slice(); known = true; lastBox = -1; break;
      case 'Tm': if (a.length === 6) { tm = a.map(num); tlm = tm.slice(); known = true; lastBox = -1; } break;
      case 'Td': tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm.slice(); known = true; lastBox = -1; break;
      case 'TD': TL = -num(a[1]); tlm = mul([1, 0, 0, 1, num(a[0]), num(a[1])], tlm); tm = tlm.slice(); known = true; lastBox = -1; break;
      case 'TL': TL = num(a[0]); break;
      case 'Ts': rise = num(a[0]); break;
      case 'T*': nextLine(); break;
      case 'Tj': case 'TJ': case "'": case '"': {
        if (o.op === "'" || o.op === '"') nextLine();
        // after a show, the pen advances by the (unknown) text width: a follow-on show on the same line
        // belongs to the same edited line if the previous one did
        const k = known ? inBox() : lastBox;
        if (k >= 0) {
          hits[k]++;
          // ' and " also move to the next line (and " sets spacing): keep those effects
          const rep = o.op === "'" ? 'T*' : o.op === '"' ? `${num(a[0])} Tw ${num(a[1])} Tc T*` : '';
          cut.push([o.start, o.end, rep]);
        }
        lastBox = k; known = false;
        break;
      }
      default: break;
    }
  }
  if (!cut.length) return { bytes, hits };
  const parts = []; let p = 0;
  const enc = new TextEncoder();
  for (const [s, e, rep] of cut) { parts.push(bytes.subarray(p, s), enc.encode(` ${rep} `)); p = e; }
  parts.push(bytes.subarray(p));
  const out = new Uint8Array(parts.reduce((t, x) => t + x.length, 0)); let o = 0;
  for (const x of parts) { out.set(x, o); o += x.length; }
  return { bytes: out, hits };
}

/** Read all of a page's content streams as one decoded byte array (pdf-lib objects). */
export function pageContent(R, doc, page) {
  const c = page.node.Contents();
  const refs = !c ? [] : c instanceof R.PDFArray ? c.asArray() : [c];
  const chunks = [];
  for (const r of refs) {
    const s = r instanceof R.PDFRef ? doc.context.lookup(r) : r;
    if (!s) continue;
    if (s instanceof R.PDFRawStream) chunks.push(R.decodePDFRawStream(s).decode());
    else if (typeof s.getUnencodedContents === 'function') chunks.push(s.getUnencodedContents());
    else if (s.contents) chunks.push(s.contents);
    else throw new Error('unsupported content stream');
    chunks.push(new Uint8Array([10]));
  }
  const out = new Uint8Array(chunks.reduce((t, x) => t + x.length, 0)); let o = 0;
  for (const x of chunks) { out.set(x, o); o += x.length; }
  return out;
}

export function setPageContent(R, doc, page, bytes) {
  const ref = doc.context.register(doc.context.flateStream(bytes));
  page.node.set(R.PDFName.of('Contents'), ref);
}
