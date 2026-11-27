/* Kathmandu Streets — sound. Everything is synthesised with Web Audio (horns, engines, voices, dogs, cows,
   goats, hens, whistles, sirens, rain, thunder), plus live Nepali radio from the open Radio Browser directory. */
(function () {
  'use strict';
  const KS = window.KS;
  const A = (KS.audio = { on: true, ready: false });
  let ctx, master, noiseBuf, city, crowd, rainN, windN, eng, siren, lastHorn = 0, voices = 0, bus = {}, curBus = null;
  /** mixer settings: 0..1 per channel */
  A.vol = Object.assign({ master: 0.8, music: 0.75, sfx: 0.9, amb: 0.7, voice: 0.9 }, (KS.Shop && KS.Shop.data.settings && KS.Shop.data.settings.vol) || {});
  A.applyVolumes = () => {
    if (master) master.gain.value = A.on ? A.vol.master : 0;
    for (const k of ['music', 'sfx', 'amb', 'voice']) if (bus[k]) bus[k].gain.value = A.vol[k];
    KS.Radio && KS.Radio.volume();
    if (KS.Shop) { KS.Shop.data.settings = KS.Shop.data.settings || {}; KS.Shop.data.settings.vol = A.vol; KS.Shop.save(); }
  };
  A.init = (on) => {
    if (on != null) A.on = on;
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = A.on ? A.vol.master : 0; master.connect(ctx.destination);
    for (const k of ['music', 'sfx', 'amb', 'voice']) { bus[k] = ctx.createGain(); bus[k].gain.value = A.vol[k]; bus[k].connect(master); }
    A.ctx = ctx; A.bus = bus;
    try { A.streamDest = ctx.createMediaStreamDestination(); master.connect(A.streamDest); } catch (e) { /* no recording audio */ }
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, f, q = 0.7) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(bus.amb); s.start(); return { g, fl }; };
    city = loop('lowpass', 380); rainN = loop('bandpass', 1300, 0.5); windN = loop('bandpass', 320, 0.4);
    crowd = loop('bandpass', 700, 1.6); // murmur of a crowd, amplitude-modulated below
    const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.frequency.value = 3.3; lg.gain.value = 0.5; lfo.connect(lg).connect(crowd.fl.frequency); lfo.start();
    const mk = () => { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(bus.sfx); o.start(); o2.start(); return { o, o2, f, g }; };
    eng = mk();
    const so = ctx.createOscillator(), sg = ctx.createGain(), sl = ctx.createOscillator(), slg = ctx.createGain();
    so.type = 'square'; so.frequency.value = 900; sl.frequency.value = 0.9; slg.gain.value = 280; sl.connect(slg).connect(so.frequency); sg.gain.value = 0;
    const sf = ctx.createBiquadFilter(); sf.type = 'lowpass'; sf.frequency.value = 2200; so.connect(sf).connect(sg).connect(bus.sfx); so.start(); sl.start();
    siren = sg; A.ready = true;
  };
  A.setOn = (on) => { A.on = on; A.applyVolumes(); };
  const now = () => ctx.currentTime;
  function tone(freq, dur, type = 'sine', vol = 0.1, when = 0, slide, attack = 0.01, dest) {
    if (!ctx || !A.on) return;
    const t = now() + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, vol), t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(dest || curBus || bus.sfx); o.start(t); o.stop(t + dur + 0.05); return o;
  }
  function noise(dur, vol, freq, type = 'lowpass', when = 0, q = 0.8) {
    if (!ctx || !A.on) return;
    const t = now() + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(Math.max(0.0002, vol), t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(curBus || bus.sfx); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  /* formant "voice": a buzzy source through two vowel filters, syllable by syllable — sounds like talk */
  const VOWELS = [[730, 1090], [270, 2290], [570, 840], [530, 1840], [300, 870], [660, 1720]];
  A.voice = (vol = 1, style = 'talk', pitch) => {
    if (!ctx || !A.on || voices > 3 || vol < 0.05) return;
    voices++; setTimeout(() => voices--, 1400);
    const f0 = pitch || KS.pick([110, 125, 140, 200, 220, 240]), syl = style === 'shout' ? 4 : KS.ri(3, 7), sd = style === 'angry' ? 0.09 : 0.13;
    const t0 = now(), src = ctx.createOscillator(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), out = ctx.createGain();
    src.type = 'sawtooth'; f1.type = f2.type = 'bandpass'; f1.Q.value = 6; f2.Q.value = 9;
    src.connect(f1); src.connect(f2); f1.connect(g); f2.connect(g); g.connect(out).connect(bus.voice);
    out.gain.value = vol * (style === 'shout' ? 0.5 : style === 'angry' ? 0.42 : 0.28);
    g.gain.setValueAtTime(0.0001, t0);
    for (let i = 0; i < syl; i++) {
      const t = t0 + i * sd, v = KS.pick(VOWELS), up = style === 'shout' ? 1.5 : 1;
      src.frequency.setValueAtTime(f0 * up * KS.r(0.9, 1.15) * (i === syl - 1 ? 0.85 : 1), t);
      f1.frequency.setValueAtTime(v[0], t); f2.frequency.setValueAtTime(v[1], t);
      g.gain.linearRampToValueAtTime(1, t + sd * 0.3); g.gain.linearRampToValueAtTime(0.15, t + sd * 0.95);
    }
    g.gain.linearRampToValueAtTime(0.0001, t0 + syl * sd + 0.05);
    src.start(t0); src.stop(t0 + syl * sd + 0.1);
  };
  A.horn = (kind, vol = 1) => {
    if (!ctx) return; if (now() - lastHorn < 0.09) return; lastHorn = now();
    if (kind === 'bicycle') { for (const w of [0, 0.13]) { tone(2350, 0.5, 'sine', 0.05 * vol, w, null, 0.002); tone(3180, 0.35, 'sine', 0.025 * vol, w, null, 0.002); } }
    else if (KS.isBike(kind)) { tone(760, 0.11, 'square', 0.06 * vol); tone(760, 0.11, 'square', 0.06 * vol, 0.16); }
    else if (kind === 'tempo') tone(610, 0.28, 'square', 0.07 * vol);
    else if (kind === 'bus' || kind === 'truck' || kind === 'minibus' || kind === 'musical') [523, 659, 784, 880, 784, 659].forEach((f, i) => tone(f, 0.14, 'sawtooth', 0.045 * vol, i * 0.12));
    else if (kind === 'pressure') { tone(330, 0.6, 'sawtooth', 0.07 * vol); tone(392, 0.6, 'sawtooth', 0.05 * vol); }
    else { tone(415, 0.38, 'square', 0.05 * vol); tone(523, 0.38, 'square', 0.04 * vol); }
  };
  A.moo = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(155, t); o.frequency.linearRampToValueAtTime(128, t + 1.1); f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(620, t + 0.6); f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28 * vol, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 1.2); o.connect(f).connect(g).connect(bus.sfx); o.start(t); o.stop(t + 1.3); };
  /* dogs: real recordings when the site provides them (sounds/dogs.json lists CC0 files), otherwise a
     physically modelled bark: a pitch-swept voiced burst through two mouth formants, a breathy onset, and street echo */
  const dogSamples = [];
  A.loadDogSamples = async () => {
    if (!ctx || A.dogTried) return; A.dogTried = true;
    try {
      const r = await fetch('sounds/dogs.json', { cache: 'force-cache' }); if (!r.ok) return;
      const list = ((await r.json()).files || []).slice(0, 8);
      for (const f of list) { try { const b = await (await fetch('sounds/' + String(f.file || f).replace(/[^a-z0-9._-]/gi, ''))).arrayBuffer(); dogSamples.push({ buf: await ctx.decodeAudioData(b), big: !!f.big }); } catch (e) { /* skip a bad file */ } }
    } catch (e) { /* no recordings: use the modelled bark */ }
  };
  function playSample(buf, vol, rate) { const s = ctx.createBufferSource(), g = ctx.createGain(); s.buffer = buf; s.playbackRate.value = rate; g.gain.value = vol; s.connect(g).connect(bus.sfx); s.start(); }
  function oneBark(t, f0, vol, big) {
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), f1 = ctx.createBiquadFilter(), f2 = ctx.createBiquadFilter(), mix = ctx.createGain();
    const d = big ? 0.24 : 0.13;
    o.type = 'sawtooth'; o2.type = 'square';
    o.frequency.setValueAtTime(f0 * 0.75, t); o.frequency.linearRampToValueAtTime(f0 * 1.18, t + d * 0.25); o.frequency.exponentialRampToValueAtTime(f0 * 0.62, t + d);
    o2.frequency.setValueAtTime(f0 * 0.75 * 1.004, t); o2.frequency.linearRampToValueAtTime(f0 * 1.18, t + d * 0.25); o2.frequency.exponentialRampToValueAtTime(f0 * 0.6, t + d);
    f1.type = 'bandpass'; f1.frequency.setValueAtTime(big ? 620 : 950, t); f1.frequency.linearRampToValueAtTime(big ? 820 : 1350, t + d * 0.3); f1.Q.value = 3;
    f2.type = 'bandpass'; f2.frequency.value = big ? 1900 : 2700; f2.Q.value = 5;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.012); g.gain.setValueAtTime(vol * 0.8, t + d * 0.45); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(mix); o2.connect(mix); mix.gain.value = 0.6; mix.connect(f1); mix.connect(f2); f1.connect(g); f2.connect(g);
    // street echo
    const dl = ctx.createDelay(0.5), fb = ctx.createGain(), wet = ctx.createGain(); dl.delayTime.value = 0.09 + Math.random() * 0.05; fb.gain.value = 0.28; wet.gain.value = 0.35;
    g.connect(bus.sfx); g.connect(dl); dl.connect(fb).connect(dl); dl.connect(wet).connect(bus.sfx);
    o.start(t); o2.start(t); o.stop(t + d + 0.05); o2.stop(t + d + 0.05);
    noise(0.05, vol * 0.5, big ? 900 : 1500, 'bandpass', t - now(), 1.5); // breathy "h" onset
  }
  A.bark = (vol = 1, big) => {
    if (!ctx || !A.on) return; A.loadDogSamples();
    const n = KS.chance(0.35) ? 1 : KS.chance(0.6) ? 2 : 3;
    const pool = dogSamples.filter((x) => !!x.big === !!big), smp = pool.length ? pool : dogSamples;
    for (let k = 0; k < n; k++) {
      const w = k * (big ? KS.r(0.28, 0.4) : KS.r(0.17, 0.28));
      if (smp.length) { const sm = KS.pick(smp); setTimeout(() => playSample(sm.buf, vol * 0.9, KS.r(0.92, 1.08) * (big && !sm.big ? 0.85 : 1)), w * 1000); continue; }
      oneBark(now() + w, (big ? KS.r(190, 260) : KS.r(380, 520)) * KS.r(0.95, 1.05), 0.16 * vol, big);
    }
  };
  A.growl = (vol = 1) => {
    if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain();
    o.type = 'sawtooth'; o.frequency.setValueAtTime(95, t); o.frequency.linearRampToValueAtTime(82, t + 1.1); l.frequency.value = 31; lg.gain.value = 0.09 * vol; l.connect(lg).connect(g.gain);
    f.type = 'bandpass'; f.frequency.value = 520; f.Q.value = 1.4; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.1 * vol, t + 0.15); g.gain.linearRampToValueAtTime(0.0001, t + 1.2);
    o.connect(f).connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 1.3); l.stop(t + 1.3); noise(1.1, 0.03 * vol, 400, 'bandpass', 0, 2);
  };
  A.howl = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(420, t); o.frequency.linearRampToValueAtTime(720, t + 0.6); o.frequency.linearRampToValueAtTime(640, t + 2); o.frequency.linearRampToValueAtTime(380, t + 2.6); f.type = 'bandpass'; f.frequency.value = 900; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.07 * vol, t + 0.4); g.gain.linearRampToValueAtTime(0.0001, t + 2.7); o.connect(f).connect(g).connect(bus.sfx); o.start(t); o.stop(t + 2.8); };
  /* battle sounds */
  A.gun = (kind, vol = 1) => {
    if (!ctx || !A.on) return; vol = Math.max(0.03, vol);
    const P = { pistol: [0.14, 1800, 0.35, 120], smg: [0.08, 2200, 0.28, 140], ak: [0.12, 1500, 0.45, 95], shotgun: [0.3, 900, 0.6, 70], sniper: [0.45, 1300, 0.7, 60] }[kind] || [0.12, 1600, 0.4, 100];
    noise(P[0], P[2] * vol, P[1], 'bandpass', 0, 0.7); noise(P[0] * 2.5, P[2] * 0.6 * vol, 500, 'lowpass'); tone(P[3], P[0] * 1.5, 'sine', P[2] * 0.6 * vol, 0, P[3] * 0.5, 0.002);
    if (kind === 'sniper' || kind === 'shotgun') noise(1.2, 0.08 * vol, 700, 'lowpass', 0.12); // echo off the buildings
  };
  A.boom = (vol = 1) => { if (!ctx || !A.on) return; noise(0.2, 0.7 * vol, 2500, 'bandpass', 0, 0.5); noise(2.2, 0.9 * vol, 220, 'lowpass'); tone(55, 0.9, 'sine', 0.6 * vol, 0, 28, 0.003); noise(2.5, 0.12 * vol, 900, 'lowpass', 0.25); };
  A.beep = (vol = 0.6) => tone(1900, 0.07, 'square', 0.04 * vol);
  A.click = () => noise(0.03, 0.06, 3000, 'highpass');
  A.reload = () => { noise(0.05, 0.07, 2500, 'bandpass', 0, 2); noise(0.06, 0.08, 1800, 'bandpass', 0.35, 2); noise(0.04, 0.09, 3200, 'bandpass', 0.7, 2); };
  A.whiz = (vol = 1) => noise(0.12, 0.05 * vol, 3500, 'bandpass', 0, 3);
  A.chute = () => { noise(0.5, 0.25, 600, 'lowpass'); noise(0.3, 0.12, 1500, 'bandpass', 0.05, 1); };
  /** helicopter: the thump of the rotor blades and the whine of the turbine (0 = off) */
  A.heli = (v) => {
    if (!ctx) return;
    if (!A.heliN) {
      const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 420; const g = ctx.createGain(); g.gain.value = 0;
      const lfo = ctx.createOscillator(), lg = ctx.createGain(); lfo.type = 'square'; lfo.frequency.value = 17; lg.gain.value = 0.5; lfo.connect(lg).connect(g.gain);
      const am = ctx.createGain(); am.gain.value = 0; s.connect(f).connect(g).connect(am).connect(bus.sfx); s.start(); lfo.start();
      const t = ctx.createOscillator(), tg = ctx.createGain(); t.frequency.value = 1350; t.type = 'sine'; tg.gain.value = 0; t.connect(tg).connect(bus.sfx); t.start();
      A.heliN = { am, g, base: 0.5, tg };
      g.gain.value = 0.5;
    }
    A.heliN.am.gain.setTargetAtTime(A.on ? v * 0.55 : 0, now(), 0.4); A.heliN.tg.gain.setTargetAtTime(A.on ? v * 0.012 : 0, now(), 0.4);
  };
  /** the roar and hiss of a waterfall (0 = far away) */
  A.waterfall = (v) => {
    if (!ctx) return;
    if (!A.fallN) { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; const f2 = ctx.createBiquadFilter(); f2.type = 'highpass'; f2.frequency.value = 2500; const g = ctx.createGain(), g2 = ctx.createGain(); g.gain.value = g2.gain.value = 0; s.connect(f).connect(g).connect(bus.amb); s.connect(f2).connect(g2).connect(bus.amb); s.start(); A.fallN = { g, g2 }; }
    const k = A.on ? v * v : 0; A.fallN.g.gain.setTargetAtTime(k * 0.35, now(), 0.5); A.fallN.g2.gain.setTargetAtTime(k * 0.06, now(), 0.5);
  };
  /** a steady engine drone for the drop plane (0 = off) */
  A.planeHum = (v) => {
    if (!ctx) return;
    if (!A.hum) { const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 72; o2.type = 'sawtooth'; o2.frequency.value = 74.5; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0; o.connect(f); o2.connect(f); f.connect(g).connect(bus.sfx); o.start(); o2.start(); A.hum = g; }
    A.hum.gain.setTargetAtTime(A.on ? v * 0.12 : 0, now(), 0.3);
  };
  A.hoof = (vol = 1) => { noise(0.05, 0.12 * vol, 1700, 'bandpass', 0, 3); tone(110, 0.06, 'sine', 0.08 * vol); };
  A.cowbell = (vol = 1) => { tone(540, 0.35, 'square', 0.025 * vol); tone(812, 0.3, 'square', 0.018 * vol); };
  A.bleat = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 420; l.frequency.value = 9; lg.gain.value = 40; l.connect(lg).connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.6); o.connect(f).connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7); };
  A.cluck = (vol = 1) => { for (let i = 0; i < 3; i++) { tone(720 + i * 30, 0.05, 'square', 0.04 * vol, i * 0.09); noise(0.04, 0.04 * vol, 1500, 'bandpass', i * 0.09); } };
  A.whistle = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(); o.frequency.value = 2900; l.frequency.value = 26; lg.gain.value = 180; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vol, t + 0.03); g.gain.setValueAtTime(0.06 * vol, t + 0.45); g.gain.linearRampToValueAtTime(0.0001, t + 0.55); o.connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6); };
  A.flap = () => noise(0.5, 0.06, 2600, 'bandpass', 0, 0.5);
  A.thunder = (vol = 1) => { noise(0.25, 0.2 * vol, 1400, 'lowpass'); noise(3.5, 0.4 * vol, 160, 'lowpass', 0.05); };
  A.bell = (vol = 0.5) => { [523, 1318, 2093, 2794].forEach((f, i) => tone(f, 3.2 - i * 0.6, 'sine', (0.08 / (i + 1)) * vol, 0, null, 0.003)); };
  A.crash = (vol = 1) => { noise(0.4, 0.5 * vol, 900); tone(80, 0.35, 'sine', 0.4 * vol, 0, 40); noise(0.6, 0.15 * vol, 4000, 'highpass', 0.05); };
  A.explosion = () => { noise(0.3, 0.7, 900); tone(60, 1.2, 'sine', 0.5, 0, 30); noise(2.2, 0.5, 220, 'lowpass', 0.05); noise(0.8, 0.2, 4000, 'highpass', 0.02); }; // a helicopter going down: a deep boom and a long rumble
  /* ---------- Tibetan music: a low drone, singing bowls and a slow flute,
     for Boudhanath and Swayambhu. It starts when you walk in and stops when
     you leave; it is quiet, and it stays off while the radio is playing. */
  let tib = null;
  A.tibetanStart = () => {
    if (!ctx || !A.on || tib) return;
    const g = ctx.createGain(); g.gain.value = 0; g.connect(bus.music); g.gain.setTargetAtTime(0.5, now(), 1.5);
    const drone = [55, 82.5].map((f) => { const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = f; const og = ctx.createGain(); og.gain.value = 0.05; o.connect(og).connect(g); o.start(); return o; });
    const notes = [523.25, 587.33, 659.25, 783.99, 880, 1046.5]; // C major pentatonic, high and airy
    let step = 0;
    const play = () => {
      if (!tib) return;
      const t = now();
      if (step % 4 === 0) { // a singing bowl every fourth beat
        [392, 587.33, 784].forEach((f, i) => { const o = ctx.createOscillator(), og = ctx.createGain(); o.type = 'sine'; o.frequency.value = f; og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.05 / (i + 1), t + 0.02); og.gain.exponentialRampToValueAtTime(0.0001, t + 6); o.connect(og).connect(g); o.start(t); o.stop(t + 6.2); });
      }
      if (step % 2 === 1) { // a flute note on the off-beats, wandering up and down the scale
        const f = notes[Math.floor(Math.random() * notes.length)];
        const o = ctx.createOscillator(), og = ctx.createGain(), vib = ctx.createOscillator(), vg = ctx.createGain();
        o.type = 'sine'; o.frequency.value = f; vib.frequency.value = 5.5; vg.gain.value = 6; vib.connect(vg).connect(o.frequency);
        og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.07, t + 0.3); og.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
        o.connect(og).connect(g); o.start(t); vib.start(t); o.stop(t + 3); vib.stop(t + 3);
      }
      step++;
      tib.timer = setTimeout(play, 2600);
    };
    tib = { g, drone, timer: setTimeout(play, 400) };
  };
  A.tibetanStop = () => {
    if (!tib) return;
    const t = tib; tib = null; clearTimeout(t.timer);
    t.g.gain.setTargetAtTime(0, now(), 0.6);
    setTimeout(() => { t.drone.forEach((o) => { try { o.stop(); } catch (e) { /* already stopped */ } }); t.g.disconnect(); }, 2500);
  };
  A.thump = () => { if (!ctx || !A.on) return; noise(0.12, 0.35, 300); tone(65, 0.14, 'sine', 0.4, 0, 38); }; // the dull thud of a wheel over a speed breaker
  A.paddle = () => { noise(0.35, 0.05, 700, 'bandpass', 0, 1.5); noise(0.15, 0.025, 2400, 'bandpass', 0.05, 2); };
  A.splash = () => { noise(1.4, 0.5, 700); noise(0.6, 0.3, 2400, 'bandpass', 0.1); };
  A.screech = (vol = 1) => { noise(0.28, 0.18 * vol, 2600, 'bandpass', 0, 6); tone(1250, 0.25, 'sawtooth', 0.025 * vol, 0, 1150); };
  A.coin = () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.3, 'square', 0.05, 0.08); };
  A.cash = () => { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.06)); };
  A.fail = () => { tone(330, 0.25, 'square', 0.05); tone(247, 0.4, 'square', 0.05, 0.22); };
  A.prayer = () => { tone(196, 1.6, 'triangle', 0.05, 0, null, 0.2); tone(294, 1.6, 'sine', 0.03, 0.05, null, 0.2); A.bell(0.25); };
  A.step = (run) => noise(0.06, run ? 0.05 : 0.03, run ? 500 : 350, 'lowpass');
  A.punch = () => { tone(95, 0.12, 'sine', 0.35, 0, 50); noise(0.08, 0.25, 1200, 'bandpass'); };
  A.swing = () => noise(0.15, 0.06, 1800, 'bandpass', 0, 1.5);
  A.snow = () => noise(0.25, 0.12, 3000, 'highpass'); // scooping snow into a ball: a soft crunch
  A.throw = () => noise(0.3, 0.1, 1600, 'bandpass', 0, 2); // the whoosh of a snowball leaving your hand
  A.splat = () => { noise(0.18, 0.3, 900, 'lowpass'); tone(180, 0.1, 'sine', 0.15, 0, 90); }; // a snowball bursting on impact
  A.nitro = () => { noise(1.2, 0.3, 900, 'bandpass', 0, 0.6); tone(120, 1.0, 'sawtooth', 0.08, 0, 260); };
  A.shutter = () => { noise(0.04, 0.3, 3000, 'highpass'); noise(0.05, 0.25, 2500, 'highpass', 0.08); };
  A.speedcam = () => { A.shutter(); tone(1760, 0.15, 'square', 0.04, 0.12); };
  A.ding = () => { tone(1568, 0.25, 'sine', 0.08); tone(2093, 0.4, 'sine', 0.06, 0.12); };
  A.update = (dt, s) => {
    if (!ctx) return;
    city.g.gain.value = 0.03 + s.density * 0.05; crowd.g.gain.value = Math.min(0.06, s.crowd * 0.012);
    rainN.g.gain.value = s.rain * 0.055; // soft patter, not a roar windN.g.gain.value = Math.min(0.12, s.wind * 0.01 + s.speed * 0.002);
    siren.gain.value = s.siren * 0.06;
    if (s.vehicle && (s.vehicle.kind === 'bicycle' || s.vehicle.kind === 'skateboard')) { // no engine: chain whirr while pedalling, freewheel ticks while coasting
      eng.g.gain.value = 0;
      const sp = Math.abs(s.vehicle.speed);
      if (sp > 0.8) {
        A.cyT = (A.cyT || 0) - dt * (s.throttle > 0.1 ? 2.2 + sp * 0.35 : 6 + sp * 1.6);
        if (A.cyT <= 0) { A.cyT = 1; if (s.throttle > 0.1) noise(0.09, 0.018, 1800 + sp * 60, 'bandpass', 0, 3); else noise(0.012, 0.03, 5200, 'highpass'); }
      }
    } else if (s.vehicle) {
      const bike = KS.isBike(s.vehicle.kind), sp = Math.abs(s.vehicle.speed), ev = s.vehicle.kind === 'ev';
      const base = ev ? 180 : bike ? 70 : s.vehicle.type.len > 6 ? 38 : 52, gear = sp % 7;
      eng.o.frequency.value = ev ? base + sp * 30 : base + gear * (bike ? 14 : 8) + sp * (bike ? 3 : 1.6); eng.o2.frequency.value = eng.o.frequency.value * 0.5;
      eng.f.frequency.value = (ev ? 900 : 300) + s.throttle * 700 + sp * 20; eng.g.gain.value = (ev ? 0.008 : 0.025) + s.throttle * (ev ? 0.01 : 0.03);
    } else eng.g.gain.value = 0;
    Fallback.tick(s.vehicle || R.onFoot);
  };

  /* ---------- spoken voices: the browser's free built-in text-to-speech (Web Speech API) ----------
     Nepali lines are written in Devanagari for Nepali / Hindi voices; nothing is sent anywhere by the game. */
  const DEV = {
    'Namaste!': 'नमस्ते!', 'Namaskar': 'नमस्कार', 'K cha dai?': 'के छ दाइ?', 'Sanchai?': 'सन्चै?', 'Khana khanu bhayo?': 'खाना खानुभयो?', 'Aaja jam cha!': 'आज जाम छ!', 'Chiya khane?': 'चिया खाने?',
    'Oi! Bistarai!': 'ओई! बिस्तारै!', 'Aankha chaina?': 'आँखा छैन?', 'Ke garya ho?!': 'के गर्‍या हो?', 'Hare Shiva!': 'हरे शिव!', 'Dhyan dinus na!': 'ध्यान दिनुस् न!',
    'Aiya!': 'आइया!', 'Ke gareko?!': 'के गरेको?', 'Aama!': 'आमा!', 'Police bolau?!': 'पुलिस बोलाऊँ?', 'Aija! Aija!': 'आइज! आइज!', 'Ma pani dekhauchhu!': 'म पनि देखाउँछु!', 'Ke herchas?!': 'के हेर्छस्?',
    'Bachau!': 'बचाऊ!', 'Police! Police!': 'पुलिस! पुलिस!', 'Bhaag!': 'भाग!', 'Om mani padme hum': 'ओम मणि पद्मे हुँ', 'Tashi delek': 'टासी देलेक',
    'Momo, momo, taja momo!': 'मम, मम, ताजा मम!', 'Taja tarkari!': 'ताजा तरकारी!', 'Pashmina, sasto!': 'पश्मिना, सस्तो!', 'Chiya, garam chiya!': 'चिया, गरम चिया!',
    'Rok! Rok!': 'रोक! रोक!', 'Side ma lagaunus!': 'साइडमा लगाउनुस्!', 'License dekhaunus!': 'लाइसेन्स देखाउनुस्!', 'Rok! Licence check!': 'रोक! लाइसेन्स चेक!',
    'Bam Bam Bhole!': 'बम बम भोले!', 'Har Har Mahadev': 'हर हर महादेव', 'Photo? Dakshina!': 'फोटो? दक्षिणा!', 'Goal!': 'गोल!', 'Dai, ball!': 'दाइ, बल!',
    'Dhan ramro bhayo!': 'धान राम्रो भयो!', 'Bazaar jane ho?': 'बजार जाने हो?', 'Gaun ma swagat!': 'गाउँमा स्वागत!', 'Ke garya?!': 'के गर्‍या?', 'Oi!!': 'ओई!', 'Bistarai!': 'बिस्तारै!',
    'Ratnapark!': 'रत्नपार्क!', 'Kalanki! Kalanki!': 'कलंकी! कलंकी!', 'Koteshwor!': 'कोटेश्वर!', 'Balaju, Balaju!': 'बालाजु, बालाजु!', 'Lagankhel!': 'लगनखेल!', 'Boudha, Chabahil!': 'बौद्ध, चाबहिल!', 'Nagdhunga! Dhunibesi!': 'नागढुंगा! धुनिबेसी!',
    'Ratnapark, Koteshwor!': 'रत्नपार्क, कोटेश्वर!', 'Koteshwor! Koteshwor!': 'कोटेश्वर! कोटेश्वर!', 'Kalanki! Chabahil!': 'कलंकी! चाबहिल!', 'Chabahil, Chabahil!': 'चाबहिल, चाबहिल!', 'Lagankhel! Balaju!': 'लगनखेल! बालाजु!',
    'Gongabu! Satdobato!': 'गोंगबु! सातदोबाटो!', 'Satdobato, aaunus!': 'सातदोबाटो, आउनुस्!', 'Thank you, doctor saab…': 'धन्यवाद डाक्टर साब', 'Mooo…': '',
  };
  const Sp = (KS.Speech = { last: 0 });
  const synth = typeof window !== 'undefined' && window.speechSynthesis;
  let ttsVoices = [];
  const loadVoices = () => { try { ttsVoices = synth ? synth.getVoices() : []; } catch (e) { ttsVoices = []; } };
  if (synth) { loadVoices(); try { synth.addEventListener('voiceschanged', loadVoices); } catch (e) { synth.onvoiceschanged = loadVoices; } }
  const find = (lang) => ttsVoices.find((v) => v.lang && v.lang.toLowerCase().replace('_', '-').startsWith(lang));
  Sp.voiceFor = (dev) => (dev ? find('ne') || find('hi') : null) || find('en-in') || find('en');
  Sp.enabled = () => !!synth && KS.Settings && KS.Settings.data().tts !== false && A.on;
  /** speak a line; returns true when a real voice was used */
  Sp.say = (text, o = {}) => {
    if (!Sp.enabled() || !ttsVoices.length) return false;
    const now2 = performance.now(); if (synth.speaking && now2 - Sp.last < 2600) return false; // one voice at a time, like real conversation
    let t = String(text).replace(/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/gu, '').trim(); if (!t) return false;
    const dev = DEV[t] != null ? DEV[t] : DEV[t.replace(/[!?.…]+$/, '')]; if (dev === '') return false;
    const v = Sp.voiceFor(dev && (find('ne') || find('hi')));
    const u = new SpeechSynthesisUtterance(dev && v && /^(ne|hi)/i.test(v.lang) ? dev : t);
    if (v) { u.voice = v; u.lang = v.lang; }
    const w = o.who || {};
    u.pitch = w.kid ? 1.7 : w.f ? (w.old ? 1.15 : 1.35) : w.old ? 0.75 : 0.9 + Math.random() * 0.15;
    u.rate = (w.old ? 0.85 : w.kid ? 1.15 : 1.02) * (o.angry ? 1.12 : 1);
    u.volume = KS.clamp((1 - (o.dist || 0) / 26) * A.vol.voice * A.vol.master, 0.05, 1);
    try { if (synth.speaking) synth.cancel(); synth.speak(u); Sp.last = now2; return true; } catch (e) { return false; }
  };

  /* ---------- procedural stations (used offline or when no live stream plays) ---------- */
  const Fallback = { list: [{ name: 'Radio Thamel 99.9 (built-in)', genre: 'Folk', bpm: 132, scale: [0, 2, 4, 7, 9, 12, 14], root: 293.66, lead: 'sine' }, { name: 'Himal FM 103.6 (built-in)', genre: 'Lo-fi', bpm: 78, scale: [0, 3, 5, 7, 10, 12, 15], root: 220, lead: 'triangle' }], cur: null, next: 0, beat: 0, phrase: [] };
  Fallback.tick = (inVehicle) => {
    const st = Fallback.cur; if (!ctx || !st || !A.on || !inVehicle) return;
    const spb = 60 / st.bpm / 2; curBus = bus.music;
    if (Fallback.next < now()) Fallback.next = now() + 0.05;
    while (Fallback.next < now() + 0.25) {
      const w = Fallback.next - now(), b = Fallback.beat % 16;
      if (st.genre === 'Folk') { if (b % 6 === 0 || b % 6 === 3) tone(95, 0.22, 'sine', 0.12, w, 60); if (b % 6 === 2 || b % 6 === 5) noise(0.06, 0.09, 2400, 'bandpass', w); if (b % 8 === 0) tone(st.root / 2, spb * 8, 'sawtooth', 0.012, w, null, 0.2); }
      else { if (b % 8 === 0) tone(60, 0.3, 'sine', 0.15, w, 40); if (b % 8 === 4) noise(0.15, 0.08, 1800, 'bandpass', w); if (b % 2 === 1) noise(0.03, 0.03, 7000, 'highpass', w); if (b === 0) [0, 3, 7].forEach((s) => tone((st.root * Math.pow(2, s / 12)) / 2, spb * 15, 'triangle', 0.02, w, null, 0.3)); }
      if (b === 0 && Fallback.beat % 32 === 0) { Fallback.phrase = []; let d = 2; for (let i = 0; i < 16; i++) { d = KS.clamp(d + KS.ri(-2, 2), 0, st.scale.length - 1); Fallback.phrase.push(KS.chance(0.72) ? st.scale[d] : null); } }
      const n = Fallback.phrase[b]; if (n != null && (st.genre === 'Folk' || b % 2 === 0)) tone(st.root * Math.pow(2, n / 12), spb * 1.8, st.lead, 0.05, w, null, 0.03);
      Fallback.next += spb; Fallback.beat++;
    }
    curBus = null;
  };

  /* ---------- live radio from Nepal via the Radio Browser open API (radio-browser.info) ---------- */
  const R = (KS.Radio = { stations: [], idx: -1, status: 'idle', el: null, playing: false });
  const MIRRORS = ['https://de1.api.radio-browser.info', 'https://at1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://fi1.api.radio-browser.info'];
  R.load = async () => {
    if (R.status === 'loading' || R.status === 'ready') return;
    R.status = 'loading';
    for (const m of MIRRORS) {
      try {
        const ctl = new AbortController(), to = setTimeout(() => ctl.abort(), 6000);
        const res = await fetch(m + '/json/stations/bycountrycodeexact/NP?hidebroken=true&order=clickcount&reverse=true&limit=120', { signal: ctl.signal });
        clearTimeout(to); if (!res.ok) continue;
        const data = await res.json(), seen = new Set();
        R.stations = data.filter((s) => (s.url_resolved || s.url || '').startsWith('https://') && s.name && !seen.has(s.name.trim().toLowerCase()) && seen.add(s.name.trim().toLowerCase()))
          .slice(0, 50).map((s) => ({ name: s.name.trim().replace(/\s+/g, ' '), url: s.url_resolved || s.url, tags: (s.tags || '').split(',').slice(0, 3).join(' · '), city: s.state || '', live: true, favicon: s.favicon }));
        if (R.stations.length) { R.status = 'ready'; R.onchange && R.onchange(); return; }
      } catch (e) { /* try the next mirror */ }
    }
    R.status = 'offline'; R.onchange && R.onchange();
  };
  R.all = () => R.stations.concat(Fallback.list);
  R.current = () => (R.idx >= 0 ? R.all()[R.idx] : null);
  R.volume = () => { if (R.el) R.el.volume = A.on && (R.inVehicle || R.onFoot) ? KS.clamp(A.vol.master * A.vol.music, 0, 1) : 0; };
  R.play = (i) => {
    const all = R.all();
    if (i == null || i < 0 || !all.length) { R.stop(); return null; }
    R.idx = ((i % all.length) + all.length) % all.length;
    const st = all[R.idx];
    Fallback.cur = null;
    if (st.live) {
      if (!R.el) { R.el = new Audio(); R.el.preload = 'none'; R.el.addEventListener('error', () => { if (R.current() && R.current().live) { KS.Game && KS.Game.notify('📻 ' + R.current().name + ' is off the air, tuning the next one…'); R.play(R.idx + 1); } }); }
      R.el.src = st.url; R.volume();
      const p = R.el.play(); if (p && p.catch) p.catch(() => {});
    } else { if (R.el) R.el.pause(); Fallback.cur = st; }
    R.onchange && R.onchange();
    return st;
  };
  R.stop = () => { R.idx = -1; Fallback.cur = null; if (R.el) { R.el.pause(); R.el.removeAttribute('src'); R.el.load(); } R.onchange && R.onchange(); };
  R.next = (d = 1) => { if (R.status === 'idle') R.load(); const n = R.all().length; if (R.idx + d >= n) return R.play(-1) || R.stop(); return R.play(R.idx < 0 ? 0 : R.idx + d); };
  R.setInVehicle = (v) => { if (R.inVehicle === v) return; R.inVehicle = v; R.volume(); if (R.onFoot) return; if (R.el && R.current() && R.current().live) { if (v) { const p = R.el.play(); if (p && p.catch) p.catch(() => {}); } else R.el.pause(); } };
})();
