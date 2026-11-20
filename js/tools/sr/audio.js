/* WebcamClicks screen recorder — audio engine (all on-device).
   denoise()   spectral-subtraction noise removal with a noise profile learned from the quietest frames
   enhance()   voice chain: high-pass, de-mud, presence, air, compressor (OfflineAudioContext)
   normalize() loudness normalisation with a soft peak limiter
   stretch()   WSOLA time-stretch (speed change without chipmunk pitch)
   buildMix()  kept clips → speed → voice gain → music bed with fades + auto-ducking → limiter */

const yieldUI = () => new Promise((r) => setTimeout(r, 0));

/* ---------------------------------------------------------------- FFT (radix-2, in place) */
function fft(re, im, inverse) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = (2 * Math.PI / len) * (inverse ? 1 : -1);
    const wr = Math.cos(ang), wi = Math.sin(ang);
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0;
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2;
        const xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
        re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        const ncr = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = ncr;
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
}

/** Remove steady background noise (hiss, hum, fans, air-con). strength 0..1. */
export async function denoise(x, sr, strength = 0.6, onProgress) {
  const N = sr > 32000 ? 2048 : 1024, H = N / 4, bins = N / 2 + 1;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N));   // sqrt-Hann (analysis + synthesis)
  const frames = Math.max(1, Math.floor((x.length - N) / H) + 1);

  // 1) noise profile: average spectrum of the quietest 10% of frames
  const energy = new Float32Array(frames);
  for (let f = 0; f < frames; f++) { let e = 0; const o = f * H; for (let i = 0; i < N; i += 4) e += x[o + i] * x[o + i]; energy[f] = e; }
  const order = Array.from(energy.keys()).sort((a, b) => energy[a] - energy[b]);
  const quiet = order.slice(0, Math.max(4, Math.floor(frames * 0.1)));
  const noise = new Float32Array(bins);
  const re = new Float32Array(N), im = new Float32Array(N);
  for (const f of quiet) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) noise[k] += Math.hypot(re[k], im[k]) / quiet.length;
  }

  // 2) subtract it frame by frame with smoothed gains (avoids "musical noise")
  const alpha = 1 + strength * 2.2, floor = 0.28 - 0.2 * strength;
  const out = new Float32Array(x.length);
  const norm = new Float32Array(x.length);
  const gPrev = new Float32Array(bins).fill(1), g = new Float32Array(bins);
  for (let f = 0; f < frames; f++) {
    const o = f * H;
    for (let i = 0; i < N; i++) { re[i] = (x[o + i] || 0) * win[i]; im[i] = 0; }
    fft(re, im, false);
    for (let k = 0; k < bins; k++) {
      const mag = Math.hypot(re[k], im[k]) + 1e-9;
      const target = Math.max(floor, 1 - (alpha * noise[k]) / mag);
      g[k] = target > gPrev[k] ? 0.5 * gPrev[k] + 0.5 * target : 0.8 * gPrev[k] + 0.2 * target;   // fast open, slow close
    }
    for (let k = 0; k < bins; k++) {
      const gs = (g[Math.max(0, k - 1)] + 2 * g[k] + g[Math.min(bins - 1, k + 1)]) / 4;   // smooth across frequency
      gPrev[k] = g[k];
      re[k] *= gs; im[k] *= gs;
      if (k > 0 && k < N / 2) { re[N - k] = re[k]; im[N - k] = -im[k]; }
    }
    fft(re, im, true);
    for (let i = 0; i < N; i++) { out[o + i] += re[i] * win[i]; norm[o + i] += win[i] * win[i]; }
    if (f % 600 === 599) { if (onProgress) onProgress(f / frames); await yieldUI(); }
  }
  for (let i = 0; i < out.length; i++) out[i] = norm[i] > 1e-3 ? out[i] / norm[i] : 0;
  return out;
}

/** Broadcast-style voice chain. */
export async function enhance(channels, sr) {
  const len = channels[0].length;
  const ctx = new OfflineAudioContext(channels.length, len, sr);
  const buf = ctx.createBuffer(channels.length, len, sr);
  channels.forEach((c, i) => buf.copyToChannel(c, i));
  const src = ctx.createBufferSource(); src.buffer = buf;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 85; hp.Q.value = 0.7;
  const mud = ctx.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 300; mud.Q.value = 1; mud.gain.value = -2.5;
  const pres = ctx.createBiquadFilter(); pres.type = 'peaking'; pres.frequency.value = 3200; pres.Q.value = 0.9; pres.gain.value = 3;
  const air = ctx.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 9500; air.gain.value = 2;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -24; comp.knee.value = 8; comp.ratio.value = 3.5; comp.attack.value = 0.005; comp.release.value = 0.18;
  src.connect(hp).connect(mud).connect(pres).connect(air).connect(comp).connect(ctx.destination);
  src.start();
  const r = await ctx.startRendering();
  return Array.from({ length: r.numberOfChannels }, (_, i) => r.getChannelData(i).slice());
}

/** Speech-gated RMS normalisation to about −16 dBFS with a soft limiter at −1 dBFS. */
export function normalize(channels, targetDb = -16) {
  const len = channels[0].length, block = 1024;
  const levels = [];
  for (let i = 0; i + block <= len; i += block) {
    let e = 0;
    for (const c of channels) for (let j = i; j < i + block; j++) e += c[j] * c[j];
    levels.push(Math.sqrt(e / (block * channels.length)));
  }
  const sorted = levels.filter((v) => v > 1e-4).sort((a, b) => a - b);
  if (!sorted.length) return channels;
  const speech = sorted.slice(Math.floor(sorted.length * 0.5));    // loudest half ≈ speech
  const rms = Math.sqrt(speech.reduce((a, v) => a + v * v, 0) / speech.length);
  const gain = Math.min(8, Math.pow(10, targetDb / 20) / Math.max(rms, 1e-5));
  return channels.map((c) => { const o = new Float32Array(c.length); for (let i = 0; i < c.length; i++) o[i] = softLimit(c[i] * gain); return o; });
}

function softLimit(v) {
  const t = 0.89;   // −1 dBFS knee
  const a = Math.abs(v);
  if (a <= t) return v;
  return Math.sign(v) * (t + (1 - t) * Math.tanh((a - t) / (1 - t)));
}

/** WSOLA time-stretch: change speed, keep pitch. */
export function stretch(channels, speed) {
  if (Math.abs(speed - 1) < 1e-3) return channels;
  const N = 1024, Hs = N / 2, tol = 256;
  const win = new Float32Array(N);
  for (let i = 0; i < N; i++) win[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const len = channels[0].length, outLen = Math.floor(len / speed) + N;
  const out = channels.map(() => new Float32Array(outLen));
  const mono = new Float32Array(len);
  channels.forEach((c) => { for (let i = 0; i < len; i++) mono[i] += c[i] / channels.length; });
  let prevIn = 0;
  for (let outPos = 0; ; outPos += Hs) {
    const nominal = Math.round(outPos * speed);
    if (nominal + N + tol >= len) break;
    let best = 0;
    if (outPos > 0) {
      const target = prevIn + Hs;
      let bestScore = -Infinity;
      for (let off = -tol; off <= tol; off += 4) {
        const st = nominal + off;
        if (st < 0 || st + N >= len || target + N >= len) continue;
        let sc = 0;
        for (let k = 0; k < Hs; k += 4) sc += mono[target + k] * mono[st + k];
        if (sc > bestScore) { bestScore = sc; best = off; }
      }
    }
    const in0 = Math.max(0, nominal + best);
    for (let c = 0; c < channels.length; c++) { const s = channels[c], d = out[c]; for (let k = 0; k < N; k++) d[outPos + k] += s[in0 + k] * win[k]; }
    prevIn = in0;
  }
  return out.map((c) => c.subarray(0, Math.floor(len / speed)));
}

/** Resample any AudioBuffer to the target rate and channel count (2). */
export async function toRate(buffer, sr) {
  const len = Math.max(1, Math.round(buffer.duration * sr));
  const ctx = new OfflineAudioContext(2, len, sr);
  const src = ctx.createBufferSource(); src.buffer = buffer; src.connect(ctx.destination); src.start();
  const r = await ctx.startRendering();
  return [r.getChannelData(0).slice(), r.getChannelData(1).slice()];
}

export async function decodeAudioFile(file) {
  const ctx = new (window.AudioContext || window.webkitAudioContext)();
  try { return await ctx.decodeAudioData(await file.arrayBuffer()); }
  finally { ctx.close().catch(() => {}); }
}

/** Gain envelope that lowers music while someone talks (attack 80 ms, release 450 ms). */
export function duckEnvelope(voiceMono, sr, depth = 0.28) {
  const win = Math.round(sr * 0.02);
  const env = new Float32Array(voiceMono.length);
  let peak = 0;
  for (let i = 0; i < voiceMono.length; i += win) { let e = 0; for (let j = i; j < Math.min(i + win, voiceMono.length); j++) e += voiceMono[j] * voiceMono[j]; peak = Math.max(peak, Math.sqrt(e / win)); }
  const thr = Math.max(0.004, peak * 0.08);
  const aA = Math.exp(-1 / (0.08 * sr)), aR = Math.exp(-1 / (0.45 * sr));
  let g = 1;
  for (let i = 0; i < voiceMono.length; i += win) {
    let e = 0; const end = Math.min(i + win, voiceMono.length);
    for (let j = i; j < end; j++) e += voiceMono[j] * voiceMono[j];
    const target = Math.sqrt(e / win) > thr ? depth : 1;
    for (let j = i; j < end; j++) { const a = target < g ? aA : aR; g = target + (g - target) * a; env[j] = g; }
  }
  return env;
}

/**
 * Final soundtrack.
 * voice: { sr, ch: [Float32Array...] } in source time (already cleaned if requested)
 * segments: [[start, end], ...] kept source ranges (seconds), speed: playback speed
 */
export function buildMix({ voice, sr, segments, speed = 1, voiceVol = 1, music = null, musicVol = 0.25, duck = true, fadeIn = 1, fadeOut = 2 }) {
  const xf = Math.round(sr * 0.012);   // tiny crossfade at cuts: no clicks
  const total = segments.reduce((a, [s, e]) => a + Math.max(0, Math.round((e - s) * sr)), 0);
  const chs = voice ? Math.min(2, voice.ch.length) : 2;
  let parts = Array.from({ length: chs }, () => new Float32Array(Math.max(1, total)));
  if (voice) {
    let pos = 0;
    for (const [s, e] of segments) {
      const a = Math.round(s * sr), n = Math.max(0, Math.round((e - s) * sr));
      for (let c = 0; c < chs; c++) {
        const src = voice.ch[Math.min(c, voice.ch.length - 1)], dst = parts[c];
        for (let i = 0; i < n; i++) {
          let v = src[a + i] || 0;
          if (i < xf) v *= i / xf;
          if (n - i < xf) v *= (n - i) / xf;
          dst[pos + i] = v;
        }
      }
      pos += n;
    }
  }
  parts = stretch(parts, speed);
  const len = parts[0].length;
  const L = new Float32Array(len), R = new Float32Array(len);
  for (let i = 0; i < len; i++) { L[i] = parts[0][i] * voiceVol; R[i] = parts[Math.min(1, chs - 1)][i] * voiceVol; }
  if (music && musicVol > 0) {
    const env = duck && voice && voiceVol > 0 ? duckEnvelope(L, sr) : null;
    const mL = music[0], mR = music[1] || music[0], mlen = mL.length;
    const fi = Math.round(fadeIn * sr), fo = Math.round(fadeOut * sr);
    for (let i = 0; i < len; i++) {
      let g = musicVol;
      if (i < fi) g *= i / fi;
      if (len - i < fo) g *= (len - i) / fo;
      if (env) g *= env[i];
      const m = i % mlen;
      L[i] += mL[m] * g; R[i] += mR[m] * g;
    }
  }
  for (let i = 0; i < len; i++) { L[i] = softLimit(L[i]); R[i] = softLimit(R[i]); }
  return [L, R];
}
