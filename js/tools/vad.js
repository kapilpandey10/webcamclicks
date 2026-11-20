/* WebcamClicks — simple energy-based speech detection.
   Finds where people are talking and packs those parts into windows of at most ~24 s, cut at pauses,
   so the speech model never has to guess timings across a hard 30-second chunk boundary. */

const FRAME = 0.02;   // 20 ms

export function planWindows(audio, sr = 16000, maxLen = 24) {
  const hop = Math.round(sr * FRAME), n = Math.floor(audio.length / hop);
  if (!n) return [];
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o = i * hop; for (let j = 0; j < hop; j++) { const v = audio[o + j]; s += v * v; } rms[i] = Math.sqrt(s / hop); }
  const sorted = Float32Array.from(rms).sort();
  const q = (p) => sorted[Math.min(n - 1, Math.floor(p * n))];
  const noise = q(0.1), peak = q(0.98);
  if (peak < 0.002) return [];   // silence
  const thr = Math.max(noise * 2.2, noise + (peak - noise) * 0.05, 0.0018);

  // speech frames → regions (merge pauses shorter than 0.4 s, drop blips shorter than 0.12 s)
  let regions = [], s = -1;
  for (let i = 0; i <= n; i++) {
    const on = i < n && rms[i] > thr;
    if (on && s < 0) s = i;
    if (!on && s >= 0) { regions.push([s, i]); s = -1; }
  }
  const merged = [];
  for (const r of regions) { const last = merged[merged.length - 1]; if (last && r[0] - last[1] <= 20) last[1] = r[1]; else merged.push(r.slice()); }
  regions = merged.filter((r) => r[1] - r[0] >= 6);

  // split very long stretches of continuous sound at their quietest moment
  const maxF = Math.round(maxLen / FRAME), pieces = [];
  for (let [a, b] of regions) {
    while (b - a > maxF) {
      let cut = a + maxF, best = Infinity;
      for (let i = a + Math.round(maxF * 0.55); i < a + maxF; i++) if (rms[i] < best) { best = rms[i]; cut = i; }
      pieces.push([a, cut]); a = cut;
    }
    pieces.push([a, b]);
  }
  const total = audio.length / sr;
  const secs = pieces.map(([a, b]) => [Math.max(0, a * FRAME - 0.2), Math.min(total, b * FRAME + 0.25)]);

  // pack neighbouring regions into windows (fewer model calls), never longer than maxLen
  const wins = [];
  for (const [a, b] of secs) {
    const w = wins[wins.length - 1];
    if (w && b - w.start <= maxLen && a - w.end < 3) { w.end = Math.max(w.end, b); w.regions.push([a, b]); }
    else wins.push({ start: a, end: b, regions: [[a, b]] });
  }
  return wins;
}

/** Spread words over the speech regions of a window by length (fallback when the model gives no usable timings). */
export function spreadOverRegions(tokens, regions) {
  const total = regions.reduce((a, [s, e]) => a + (e - s), 0) || 1;
  const weight = tokens.map((w) => w.trim().length + 1), sum = weight.reduce((a, b) => a + b, 0) || 1;
  const at = (f) => { let d = f * total; for (const [s, e] of regions) { if (d <= e - s) return s + d; d -= e - s; } return regions[regions.length - 1][1]; };
  let acc = 0;
  return tokens.map((w, i) => { const s = at(acc / sum); acc += weight[i]; return { text: w, start: +s.toFixed(3), end: +at(acc / sum).toFixed(3) }; });
}
