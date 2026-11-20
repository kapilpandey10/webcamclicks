/* WebcamClicks screen recorder — royalty-free background music, synthesised in the browser.
   Every loop is generated from scratch (oscillators + noise), so there is nothing to license.
   Loops are rendered to an exact number of bars so they repeat seamlessly. */

export const MUSIC_STYLES = {
  lofi:      { name: 'Lo-fi chill', bpm: 78,  bars: 8, chords: [[53, 57, 60, 64], [52, 55, 59, 62], [50, 53, 57, 60], [48, 52, 55, 59]], drums: 'lofi', pad: 'triangle', lead: 'keys', tone: 2200, swing: 0.12 },
  upbeat:    { name: 'Upbeat',      bpm: 118, bars: 8, chords: [[48, 52, 55, 60], [55, 59, 62, 67], [57, 60, 64, 69], [53, 57, 60, 65]], drums: 'pop', pad: 'sawtooth', lead: 'pluck', tone: 5200, swing: 0 },
  ambient:   { name: 'Ambient',     bpm: 66,  bars: 8, chords: [[48, 55, 59, 62, 64], [45, 52, 55, 59, 60], [41, 48, 52, 55, 57], [43, 50, 55, 57, 59]], drums: null, pad: 'sine', lead: 'bell', tone: 3000, swing: 0 },
  corporate: { name: 'Corporate',   bpm: 104, bars: 8, chords: [[48, 52, 55, 60], [45, 52, 57, 60], [41, 48, 53, 57], [43, 50, 55, 59]], drums: 'soft', pad: 'triangle', lead: 'pluck', tone: 4200, swing: 0 },
  cinematic: { name: 'Cinematic',   bpm: 72,  bars: 8, chords: [[45, 52, 57, 60], [41, 48, 53, 57], [48, 55, 60, 64], [43, 50, 55, 59]], drums: 'cine', pad: 'sawtooth', lead: 'bell', tone: 1800, swing: 0 }
};

const hz = (m) => 440 * Math.pow(2, (m - 69) / 12);

function noiseBuffer(ctx, seconds = 1) {
  const b = ctx.createBuffer(1, Math.round(ctx.sampleRate * seconds), ctx.sampleRate);
  const d = b.getChannelData(0);
  let seed = 12345;
  for (let i = 0; i < d.length; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = seed / 0x3fffffff - 1; }
  return b;
}

function reverb(ctx, seconds = 2.6, decay = 2.8) {
  const len = Math.round(ctx.sampleRate * seconds);
  const b = ctx.createBuffer(2, len, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = b.getChannelData(c);
    let seed = 777 + c * 31;
    for (let i = 0; i < len; i++) { seed = (seed * 1103515245 + 12345) & 0x7fffffff; d[i] = (seed / 0x3fffffff - 1) * Math.pow(1 - i / len, decay); }
  }
  const conv = ctx.createConvolver(); conv.buffer = b;
  return conv;
}

function note(ctx, out, { type, freq, t, dur, vol, attack = 0.01, release = 0.2, detune = 0, cutoff = null }) {
  const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq; o.detune.value = detune;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + attack);
  g.gain.setValueAtTime(vol, Math.max(t + attack, t + dur - release));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let node = o;
  if (cutoff) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = cutoff; f.Q.value = 0.6; o.connect(f); node = f; }
  node.connect(g).connect(out);
  o.start(t); o.stop(t + dur + 0.05);
}

function kick(ctx, out, t, vol = 0.9) {
  const o = ctx.createOscillator(), g = ctx.createGain();
  o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
  o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);
}
function snare(ctx, out, nb, t, vol = 0.35, tone = 1800) {
  const s = ctx.createBufferSource(); s.buffer = nb;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = tone; f.Q.value = 0.8;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.18);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5, 0.25);
}
function hat(ctx, out, nb, t, vol = 0.08, len = 0.05) {
  const s = ctx.createBufferSource(); s.buffer = nb;
  const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7000;
  const g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + len);
  s.connect(f).connect(g).connect(out); s.start(t, Math.random() * 0.5, len + 0.02);
}

/** Render one seamless loop. Returns { ch: [L, R], seconds }. */
export async function generateMusic(styleId, sr = 48000) {
  const st = MUSIC_STYLES[styleId] || MUSIC_STYLES.lofi;
  const beat = 60 / st.bpm, bar = beat * 4, seconds = bar * st.bars;
  const tail = 3;   // render a tail, then fold it back onto the start for a seamless loop
  const ctx = new OfflineAudioContext(2, Math.round((seconds + tail) * sr), sr);
  const master = ctx.createGain(); master.gain.value = 0.9;
  const tone = ctx.createBiquadFilter(); tone.type = 'lowpass'; tone.frequency.value = st.tone;
  const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
  master.connect(tone).connect(comp).connect(ctx.destination);
  const verb = reverb(ctx, st.drums ? 1.8 : 3.2); const wet = ctx.createGain(); wet.gain.value = st.drums ? 0.18 : 0.42;
  verb.connect(wet).connect(master);
  const bus = ctx.createGain(); bus.connect(master); bus.connect(verb);
  const nb = noiseBuffer(ctx, 1);

  for (let b = 0; b < st.bars; b++) {
    const chord = st.chords[b % st.chords.length];
    const t0 = b * bar;
    // pad
    chord.forEach((m, i) => note(ctx, bus, { type: st.pad, freq: hz(m), t: t0, dur: bar + 0.05, vol: 0.05 / chord.length * 4, attack: st.drums ? 0.05 : 0.9, release: st.drums ? 0.3 : 1.2, detune: i % 2 ? 6 : -6, cutoff: st.pad === 'sawtooth' ? 1600 : null }));
    // bass
    const root = chord[0] - 12;
    const bassPat = st.drums === 'pop' ? [0, 1, 2, 3, 2.5, 3.5] : st.drums ? [0, 2, 2.5] : [0];
    bassPat.forEach((p) => note(ctx, master, { type: 'triangle', freq: hz(root), t: t0 + p * beat, dur: st.drums ? beat * 0.9 : bar, vol: 0.22, attack: 0.01, release: 0.12 }));
    // lead / arpeggio
    const arp = st.lead === 'bell' ? [0, 2, 1, 3] : st.lead === 'keys' ? [0, 1.5, 2.5, 3] : [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
    arp.forEach((p, i) => {
      const m = chord[(i + b) % chord.length] + 12;
      const sw = (i % 2) ? st.swing * beat : 0;
      if (st.lead === 'pluck') note(ctx, bus, { type: 'square', freq: hz(m), t: t0 + p * beat + sw, dur: beat * 0.45, vol: 0.035, attack: 0.004, release: 0.2, cutoff: 2600 });
      else if (st.lead === 'bell') note(ctx, bus, { type: 'sine', freq: hz(m + 12), t: t0 + p * beat, dur: beat * 1.6, vol: 0.05, attack: 0.005, release: 1.2 });
      else note(ctx, bus, { type: 'triangle', freq: hz(m), t: t0 + p * beat + sw, dur: beat * 0.8, vol: 0.05, attack: 0.008, release: 0.4, cutoff: 1800 });
    });
    // drums
    if (st.drums) {
      for (let q = 0; q < 8; q++) {
        const t = t0 + q * beat / 2 + ((q % 2) ? st.swing * beat : 0);
        if (st.drums === 'cine') { if (q === 0) kick(ctx, master, t, 0.7); if (q === 4 && b % 2) snare(ctx, bus, nb, t, 0.25, 900); continue; }
        if (q === 0 || q === 4 || (st.drums === 'pop' && (q === 2 || q === 6)) || (st.drums === 'lofi' && q === 5)) kick(ctx, master, t, st.drums === 'soft' ? 0.6 : 0.85);
        if (q === 2 || q === 6) snare(ctx, bus, nb, t, st.drums === 'soft' ? 0.18 : 0.3, st.drums === 'lofi' ? 1400 : 2000);
        hat(ctx, master, nb, t, st.drums === 'lofi' ? 0.05 : 0.07);
      }
    }
  }
  const r = await ctx.startRendering();
  const n = Math.round(seconds * sr), tl = r.length - n;
  const ch = [0, 1].map((c) => {
    const d = r.getChannelData(c), o = d.slice(0, n);
    for (let i = 0; i < tl; i++) o[i] += d[n + i];   // fold reverb/release tail into the loop start
    return o;
  });
  return { ch, seconds };
}
