/* WebcamClicks — find where the speech is in a recording (used to time captions).
   ALL audio is transcribed: windows cover the whole recording back to back, each at most ~28 s and cut at a pause
   near its end (so words are not split). Whisper always works on 30 s blocks, so long windows waste the least work;
   the first window is short so the first captions appear quickly. Loudness is only used to choose those cut points, to
   skip stretches of true silence, and to know roughly where speech is inside a window (timing fallback). */

const FRAME = 0.02;   // 20 ms

/** Speech regions between two times (seconds) — used to re-check a window for untranscribed speech. */
export function speechAfter(win, t) { return win.regions.reduce((acc, [x, y]) => acc + Math.max(0, y - Math.max(x, t)), 0); }

export function planWindows(audio, sr = 16000, { maxLen = 28, pauseAfter = 20, firstLen = 12, firstPause = 5 } = {}) {
  const hop = Math.round(sr * FRAME), n = Math.floor(audio.length / hop);
  if (!n) return [];
  const rms = new Float32Array(n);
  for (let i = 0; i < n; i++) { let s = 0; const o = i * hop; for (let j = 0; j < hop; j++) { const v = audio[o + j]; s += v * v; } rms[i] = Math.sqrt(s / hop); }
  let peak = 0; for (const v of rms) if (v > peak) peak = v;
  if (peak < 0.001) return [];   // the whole file is silent
  const sorted = Float32Array.from(rms).sort();
  const noise = sorted[Math.floor(n * 0.1)];
  // generous speech threshold: anything clearly above the noise floor (quiet voices included)
  // recordings mix loud and quiet speakers, so this is relative to the noise floor more than to the peak
  const thr = Math.max(0.0006, noise * 1.8, peak * 0.005);
  const silentBelow = Math.max(0.0006, peak * 0.004);   // windows quieter than this everywhere are skipped

  const wins = [];
  let a = 0;
  while (a < n - 5) {
    const first = !wins.length;
    const maxF = Math.round((first ? firstLen : maxLen) / FRAME), minF = Math.round(maxF * 0.55), pauseFrom = Math.round((first ? firstPause : pauseAfter) / FRAME);
    let b = Math.min(n, a + maxF);
    if (b < n || b - a > pauseFrom + 150) {   // also split a long final stretch at a pause
      // cut at the first natural pause (≥ 0.3 s of quiet) once the window is long enough
      let cut = -1, run = 0;
      for (let i = a + pauseFrom; i < b; i++) { if (rms[i] < thr) { run++; if (run >= 15) { cut = i - 7; break; } } else run = 0; }
      if (cut < 0 && b === n) cut = b;
      if (cut < 0) {   // no pause: cut at the quietest 100 ms in the last part of the window
        let best = Infinity; cut = b;
        for (let i = a + minF; i < b - 4; i++) { const e = rms[i] + rms[i + 1] + rms[i + 2] + rms[i + 3] + rms[i + 4]; if (e < best) { best = e; cut = i + 2; } }
      }
      b = cut;
    }
    let loud = 0; for (let i = a; i < b; i++) if (rms[i] > silentBelow) { loud++; }
    if (loud > 5) {
      // speech regions inside the window (merged across short pauses), used only if the model gives no timings
      const regions = []; let s = -1;
      for (let i = a; i <= b; i++) {
        const on = i < b && rms[i] > thr;
        if (on && s < 0) s = i;
        if (!on && s >= 0) { const last = regions[regions.length - 1]; if (last && s - last[1] < 25) last[1] = i; else regions.push([s, i]); s = -1; }
      }
      const reg = regions.filter(([x, y]) => y - x >= 5).map(([x, y]) => [x * FRAME, y * FRAME]);
      wins.push({ start: a * FRAME, end: b * FRAME, regions: reg.length ? reg : [[a * FRAME, b * FRAME]] });
    }
    a = b;
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
