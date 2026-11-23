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
    city = loop('lowpass', 380); rainN = loop('highpass', 1600); windN = loop('bandpass', 320, 0.4);
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
    if (KS.isBike(kind)) { tone(760, 0.11, 'square', 0.06 * vol); tone(760, 0.11, 'square', 0.06 * vol, 0.16); }
    else if (kind === 'tempo') tone(610, 0.28, 'square', 0.07 * vol);
    else if (kind === 'bus' || kind === 'truck' || kind === 'minibus' || kind === 'musical') [523, 659, 784, 880, 784, 659].forEach((f, i) => tone(f, 0.14, 'sawtooth', 0.045 * vol, i * 0.12));
    else if (kind === 'pressure') { tone(330, 0.6, 'sawtooth', 0.07 * vol); tone(392, 0.6, 'sawtooth', 0.05 * vol); }
    else { tone(415, 0.38, 'square', 0.05 * vol); tone(523, 0.38, 'square', 0.04 * vol); }
  };
  A.moo = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.setValueAtTime(155, t); o.frequency.linearRampToValueAtTime(128, t + 1.1); f.type = 'bandpass'; f.frequency.setValueAtTime(380, t); f.frequency.linearRampToValueAtTime(620, t + 0.6); f.Q.value = 3; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.28 * vol, t + 0.25); g.gain.linearRampToValueAtTime(0.0001, t + 1.2); o.connect(f).connect(g).connect(bus.sfx); o.start(t); o.stop(t + 1.3); };
  A.bark = (vol = 1, big) => { if (!ctx || !A.on) return; const p = big ? 0.6 : 1; for (let k = 0; k < (KS.chance(0.5) ? 2 : 1); k++) { const w = k * 0.22; tone(520 * p, 0.12, 'sawtooth', 0.12 * vol, w, 230 * p, 0.005); noise(0.09, 0.14 * vol, 1100 * p, 'bandpass', w, 2); } };
  A.growl = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain(), l = ctx.createOscillator(), lg = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 85; l.frequency.value = 28; lg.gain.value = 0.12 * vol; l.connect(lg).connect(g.gain); f.type = 'lowpass'; f.frequency.value = 500; g.gain.setValueAtTime(0.12 * vol, t); g.gain.linearRampToValueAtTime(0.0001, t + 0.9); o.connect(f).connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 1); l.stop(t + 1); };
  A.hoof = (vol = 1) => { noise(0.05, 0.12 * vol, 1700, 'bandpass', 0, 3); tone(110, 0.06, 'sine', 0.08 * vol); };
  A.cowbell = (vol = 1) => { tone(540, 0.35, 'square', 0.025 * vol); tone(812, 0.3, 'square', 0.018 * vol); };
  A.bleat = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), f = ctx.createBiquadFilter(), g = ctx.createGain(); o.type = 'sawtooth'; o.frequency.value = 420; l.frequency.value = 9; lg.gain.value = 40; l.connect(lg).connect(o.frequency); f.type = 'bandpass'; f.frequency.value = 1300; f.Q.value = 2; g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16 * vol, t + 0.05); g.gain.linearRampToValueAtTime(0.0001, t + 0.6); o.connect(f).connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 0.7); l.stop(t + 0.7); };
  A.cluck = (vol = 1) => { for (let i = 0; i < 3; i++) { tone(720 + i * 30, 0.05, 'square', 0.04 * vol, i * 0.09); noise(0.04, 0.04 * vol, 1500, 'bandpass', i * 0.09); } };
  A.whistle = (vol = 1) => { if (!ctx || !A.on) return; const t = now(), o = ctx.createOscillator(), l = ctx.createOscillator(), lg = ctx.createGain(), g = ctx.createGain(); o.frequency.value = 2900; l.frequency.value = 26; lg.gain.value = 180; l.connect(lg).connect(o.frequency); g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.06 * vol, t + 0.03); g.gain.setValueAtTime(0.06 * vol, t + 0.45); g.gain.linearRampToValueAtTime(0.0001, t + 0.55); o.connect(g).connect(bus.sfx); o.start(t); l.start(t); o.stop(t + 0.6); l.stop(t + 0.6); };
  A.flap = () => noise(0.5, 0.06, 2600, 'bandpass', 0, 0.5);
  A.thunder = (vol = 1) => { noise(0.25, 0.4 * vol, 1400, 'lowpass'); noise(4, 0.8 * vol, 160, 'lowpass', 0.05); };
  A.bell = (vol = 0.5) => { [523, 1318, 2093, 2794].forEach((f, i) => tone(f, 3.2 - i * 0.6, 'sine', (0.08 / (i + 1)) * vol, 0, null, 0.003)); };
  A.crash = (vol = 1) => { noise(0.4, 0.5 * vol, 900); tone(80, 0.35, 'sine', 0.4 * vol, 0, 40); noise(0.6, 0.15 * vol, 4000, 'highpass', 0.05); };
  A.splash = () => { noise(1.4, 0.5, 700); noise(0.6, 0.3, 2400, 'bandpass', 0.1); };
  A.screech = (vol = 1) => { noise(0.28, 0.18 * vol, 2600, 'bandpass', 0, 6); tone(1250, 0.25, 'sawtooth', 0.025 * vol, 0, 1150); };
  A.coin = () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.3, 'square', 0.05, 0.08); };
  A.cash = () => { [1046, 1318, 1568, 2093].forEach((f, i) => tone(f, 0.18, 'triangle', 0.06, i * 0.06)); };
  A.fail = () => { tone(330, 0.25, 'square', 0.05); tone(247, 0.4, 'square', 0.05, 0.22); };
  A.prayer = () => { tone(196, 1.6, 'triangle', 0.05, 0, null, 0.2); tone(294, 1.6, 'sine', 0.03, 0.05, null, 0.2); A.bell(0.25); };
  A.step = (run) => noise(0.06, run ? 0.05 : 0.03, run ? 500 : 350, 'lowpass');
  A.punch = () => { tone(95, 0.12, 'sine', 0.35, 0, 50); noise(0.08, 0.25, 1200, 'bandpass'); };
  A.swing = () => noise(0.15, 0.06, 1800, 'bandpass', 0, 1.5);
  A.nitro = () => { noise(1.2, 0.3, 900, 'bandpass', 0, 0.6); tone(120, 1.0, 'sawtooth', 0.08, 0, 260); };
  A.shutter = () => { noise(0.04, 0.3, 3000, 'highpass'); noise(0.05, 0.25, 2500, 'highpass', 0.08); };
  A.speedcam = () => { A.shutter(); tone(1760, 0.15, 'square', 0.04, 0.12); };
  A.ding = () => { tone(1568, 0.25, 'sine', 0.08); tone(2093, 0.4, 'sine', 0.06, 0.12); };
  A.update = (dt, s) => {
    if (!ctx) return;
    city.g.gain.value = 0.03 + s.density * 0.05; crowd.g.gain.value = Math.min(0.06, s.crowd * 0.012);
    rainN.g.gain.value = s.rain * 0.18; windN.g.gain.value = Math.min(0.12, s.wind * 0.01 + s.speed * 0.002);
    siren.gain.value = s.siren * 0.06;
    if (s.vehicle) {
      const bike = KS.isBike(s.vehicle.kind), sp = Math.abs(s.vehicle.speed), ev = s.vehicle.kind === 'ev';
      const base = ev ? 180 : bike ? 70 : s.vehicle.type.len > 6 ? 38 : 52, gear = sp % 7;
      eng.o.frequency.value = ev ? base + sp * 30 : base + gear * (bike ? 14 : 8) + sp * (bike ? 3 : 1.6); eng.o2.frequency.value = eng.o.frequency.value * 0.5;
      eng.f.frequency.value = (ev ? 900 : 300) + s.throttle * 700 + sp * 20; eng.g.gain.value = (ev ? 0.008 : 0.025) + s.throttle * (ev ? 0.01 : 0.03);
    } else eng.g.gain.value = 0;
    Fallback.tick(s.vehicle || R.onFoot);
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
