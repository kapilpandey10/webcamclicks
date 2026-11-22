/* Kathmandu Streets — audio, HUD, minimap, missions (momo delivery, taxi fares, landmark tour), main loop. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const $ = (id) => document.getElementById(id);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } } };
  const saved = store.get('ks-save', {});
  const hi = saved.quality ? saved.quality === 'high' : !coarse;
  KS.quality = { level: hi ? 'high' : 'low', shadows: hi, shadowSize: hi ? 2048 : 1024, pixelRatio: Math.min(devicePixelRatio || 1, hi ? 2 : 1.25), peds: hi ? 120 : 55, cars: hi ? 120 : 60 };
  KS.clock = 0; KS.state = 'title';

  /* ======================= audio ======================= */
  const A = (KS.audio = { on: saved.sound !== false, station: 0 });
  let ctx, master, noiseBuf, city, rainN, windN, eng, lastHorn = 0;
  A.init = () => {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = A.on ? 0.75 : 0; master.connect(ctx.destination);
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const loop = (type, f, q = 0.7) => { const s = ctx.createBufferSource(); s.buffer = noiseBuf; s.loop = true; const fl = ctx.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q; const g = ctx.createGain(); g.gain.value = 0; s.connect(fl).connect(g).connect(master); s.start(); return { g, fl }; };
    city = loop('lowpass', 380); rainN = loop('highpass', 1600); windN = loop('bandpass', 320, 0.4);
    const o = ctx.createOscillator(), o2 = ctx.createOscillator(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; f.type = 'lowpass'; f.frequency.value = 600; g.gain.value = 0;
    o.connect(f); o2.connect(f); f.connect(g).connect(master); o.start(); o2.start();
    eng = { o, o2, f, g };
  };
  A.toggle = () => { A.on = !A.on; if (master) master.gain.value = A.on ? 0.75 : 0; Game.save(); return A.on; };
  function tone(freq, dur, type = 'sine', vol = 0.1, when = 0, slide, attack = 0.01) {
    if (!ctx || !A.on) return;
    const t = ctx.currentTime + when, o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t); if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + attack); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master); o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur, vol, freq, type = 'lowpass', when = 0, q = 0.8) {
    if (!ctx || !A.on) return;
    const t = ctx.currentTime + when, s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq; f.Q.value = q;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master); s.start(t, Math.random()); s.stop(t + dur + 0.05);
  }
  A.horn = (kind, vol = 1) => {
    if (!ctx) return; const now = ctx.currentTime; if (now - lastHorn < 0.09) return; lastHorn = now;
    if (kind === 'bike' || kind === 'scooter') { tone(760, 0.11, 'square', 0.06 * vol); tone(760, 0.11, 'square', 0.06 * vol, 0.16); }
    else if (kind === 'tempo') tone(610, 0.28, 'square', 0.07 * vol);
    else if (kind === 'bus' || kind === 'truck') { [523, 659, 784, 880, 784, 659].forEach((f, i) => tone(f, 0.14, 'sawtooth', 0.045 * vol, i * 0.12)); } // the musical horn of Nepali trucks
    else { tone(415, 0.38, 'square', 0.05 * vol); tone(523, 0.38, 'square', 0.04 * vol); }
  };
  A.moo = () => { tone(150, 1.1, 'sawtooth', 0.06, 0, 105, 0.15); };
  A.bark = (vol = 1) => { noise(0.1, 0.16 * vol, 900, 'bandpass'); tone(420, 0.09, 'square', 0.04 * vol, 0, 260); };
  A.flap = () => noise(0.5, 0.06, 2600, 'bandpass', 0, 0.5);
  A.thunder = (vol = 1) => { noise(0.25, 0.4 * vol, 1400, 'lowpass'); noise(4, 0.8 * vol, 160, 'lowpass', 0.05); };
  A.bell = (vol = 0.5) => { [523, 1318, 2093, 2794].forEach((f, i) => tone(f, 3.2 - i * 0.6, 'sine', (0.08 / (i + 1)) * vol, 0, null, 0.003)); };
  A.crash = (vol = 1) => { noise(0.4, 0.5 * vol, 900); tone(80, 0.35, 'sine', 0.4 * vol, 0, 40); };
  A.splash = () => { noise(1.4, 0.5, 700); noise(0.6, 0.3, 2400, 'bandpass', 0.1); };
  A.coin = () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.3, 'square', 0.05, 0.08); };
  A.prayer = () => { tone(196, 1.6, 'triangle', 0.05, 0, null, 0.2); tone(294, 1.6, 'sine', 0.03, 0.05, null, 0.2); A.bell(0.25); };

  /* procedural radio: two original stations */
  const STATIONS = [null,
    { name: 'Radio Thamel 99.9', genre: 'Folk', bpm: 132, scale: [0, 2, 4, 7, 9, 12, 14], root: 293.66, lead: 'sine' },
    { name: 'Himal FM 103.6', genre: 'Lo-fi', bpm: 78, scale: [0, 3, 5, 7, 10, 12, 15], root: 220, lead: 'triangle' },
  ];
  let nextBeat = 0, beat = 0, phrase = [];
  function radioTick() {
    const st = STATIONS[A.station]; if (!ctx || !st || !A.on || !Game.radioAudible) return;
    const spb = 60 / st.bpm / 2;
    if (nextBeat < ctx.currentTime) nextBeat = ctx.currentTime + 0.05;
    while (nextBeat < ctx.currentTime + 0.25) {
      const w = nextBeat - ctx.currentTime, b = beat % 16;
      if (st.genre === 'Folk') { // madal: dhin . ta dhin . ta
        if (b % 6 === 0 || b % 6 === 3) tone(95, 0.22, 'sine', 0.12, w, 60);
        if (b % 6 === 2 || b % 6 === 5) noise(0.06, 0.09, 2400, 'bandpass', w);
        if (b % 8 === 0) tone(st.root / 2, spb * 8, 'sawtooth', 0.012, w, null, 0.2);
      } else {
        if (b % 8 === 0) tone(60, 0.3, 'sine', 0.15, w, 40);
        if (b % 8 === 4) noise(0.15, 0.08, 1800, 'bandpass', w);
        if (b % 2 === 1) noise(0.03, 0.03, 7000, 'highpass', w);
        if (b === 0) [0, 3, 7].forEach((s) => tone(st.root * Math.pow(2, s / 12) / 2, spb * 15, 'triangle', 0.02, w, null, 0.3));
      }
      if (b === 0 && beat % 32 === 0) { phrase = []; let d = 2; for (let i = 0; i < 16; i++) { d = KS.clamp(d + KS.ri(-2, 2), 0, st.scale.length - 1); phrase.push(KS.chance(0.72) ? st.scale[d] : null); } }
      const n = phrase[b]; if (n != null && (st.genre === 'Folk' || b % 2 === 0)) tone(st.root * Math.pow(2, n / 12), spb * 1.8, st.lead, 0.05, w, null, 0.03);
      nextBeat += spb; beat++;
    }
  }
  A.update = (dt, s) => {
    if (!ctx) return;
    city.g.gain.value = 0.035 + s.density * 0.05; rainN.g.gain.value = s.rain * 0.18; windN.g.gain.value = Math.min(0.12, s.wind * 0.01 + s.speed * 0.002);
    if (s.vehicle) {
      const bike = s.vehicle.type.seats === 'bike', sp = Math.abs(s.vehicle.speed);
      const base = bike ? 70 : s.vehicle.type.len > 6 ? 38 : 52, gear = sp % 7;
      eng.o.frequency.value = base + gear * (bike ? 14 : 8) + sp * (bike ? 3 : 1.6); eng.o2.frequency.value = eng.o.frequency.value * 0.5;
      eng.f.frequency.value = 300 + s.throttle * 700 + sp * 20; eng.g.gain.value = 0.025 + s.throttle * 0.03;
    } else eng.g.gain.value = 0;
    radioTick();
  };

  /* ======================= game state & HUD ======================= */
  const Game = (KS.Game = { money: saved.money != null ? saved.money : 2500, karmaV: saved.karma != null ? saved.karma : 50, found: new Set(saved.found || []), mission: null, fineT: 0, radioAudible: false });
  Game.save = () => store.set('ks-save', { money: Game.money, karma: Game.karmaV, found: [...Game.found], sound: A.on, quality: KS.quality.level });
  Game.notify = (html, cls = '') => {
    const el = document.createElement('div'); el.className = 'note ' + cls; el.innerHTML = html; $('notes').prepend(el);
    setTimeout(() => el.classList.add('out'), 4200); setTimeout(() => el.remove(), 4800);
    while ($('notes').children.length > 4) $('notes').lastChild.remove();
  };
  Game.pay = (n, why) => { Game.money += n; if (n > 0) A.coin(); Game.notify(`${n >= 0 ? '+' : '−'} रु ${Math.abs(n).toLocaleString('en-IN')} <span>${why}</span>`, n >= 0 ? 'good' : 'bad'); Game.save(); };
  Game.karma = (d, why) => { Game.karmaV = KS.clamp(Game.karmaV + d, 0, 100); if (Math.abs(d) >= 2) Game.notify(`Karma ${d > 0 ? '+' : ''}${d} <span>${why}</span>`, d > 0 ? 'karma' : 'bad'); };
  Game.fine = (n, why) => { if (KS.clock - Game.fineT < 8) return; Game.fineT = KS.clock; Game.pay(-n, '🚓 Fine: ' + why); };
  Game.policeNear = (x, z, r) => KS.Peds.police.some((p) => Math.hypot(p.x - x, p.z - z) < r) || KS.Traffic.list.some((v) => v.kind === 'police' && v.ai && Math.hypot(v.x - x, v.z - z) < r * 0.6);
  Game.splash = (v) => {
    A.splash(); Game.notify(`Splash! The Bagmati swallowed your ${v.type.name.toLowerCase()}.`, 'bad');
    const PL = KS.Player; PL.exit && (v.speed = 0);
    if (KS.Player.person.root.parent !== KS.Player.scene) KS.Player.scene.add(KS.Player.person.root);
    KS.Player.person.root.visible = true; PL.vehicle = null; PL.mode = 'foot';
    const zBank = Math.abs(v.z - KS.RIVER.z0) < Math.abs(v.z - KS.RIVER.z1) ? KS.RIVER.z0 - 8 : KS.RIVER.z1 + 26;
    PL.x = v.x; PL.z = zBank; PL.y = 0.3; PL.vy = 0; KS.Cam.want = 7;
    KS.Traffic.recycle(v, PL.x + 300, PL.z - 300);
    if (Game.mission && Game.mission.type === 'taxi') endMission(false, 'The passenger swam to the bank, without paying.');
  };
  Game.onEnter = (v) => {
    Game.notify(`<b>${v.type.name}</b> <span>${coarse ? '' : 'E to get out · H horn · R radio'}</span>`);
    $('speedo').hidden = false; $('vname').textContent = v.type.name;
    if (v.kind === 'taxi' && !Game.mission) setTimeout(() => { if (KS.Player.vehicle === v && !Game.mission) startTaxi(); }, 1500);
  };
  Game.onExit = (v) => {
    $('speedo').hidden = true;
    if (Game.mission && Game.mission.type === 'taxi') endMission(false, 'You left the taxi. The passenger walked off.');
  };
  let wheelT = -10;
  Game.interact = () => {
    const PL = KS.Player;
    for (const [x, z] of KS.prayerWheels) if (Math.hypot(x - PL.x, z - PL.z) < 2.4) {
      if (KS.clock - wheelT > 2) { wheelT = KS.clock; A.prayer(); KS.say(PL.person.root, 'Om mani padme hum 🙏', 2.2, 'calm'); Game.karma(+1, 'Spun a prayer wheel'); if (!Game.wheelTip) { Game.wheelTip = true; Game.notify('Prayer wheels: walk clockwise and press E to spin.'); } }
      return;
    }
    for (const [x, z] of KS.bells) if (Math.hypot(x - PL.x, z - PL.z) < 9) { A.bell(0.8); KS.say(PL.person.root, '🔔 Dong…', 1.5, 'calm'); return; }
    let best = null, bd = 5;
    KS.Peds.forEachNear(PL.x, PL.z, 5, (p) => { const d = Math.hypot(p.x - PL.x, p.z - PL.z); if (d < bd) { bd = d; best = p; } });
    if (best) { KS.say(PL.person.root, 'Namaste! 🙏', 1.6, 'calm'); setTimeout(() => KS.say(best.p.root, KS.pick(best.kind === 'tourist' ? KS.LINES.tourist : best.kind === 'monk' ? KS.LINES.monk : KS.LINES.greet), 2.4), 600); }
  };

  /* ======================= markers & missions ======================= */
  function makeMarker(color) {
    const g = new T.Group();
    const beamMat = new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: T.AdditiveBlending, fog: false });
    const beam = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 70, 16, 1, true), beamMat); beam.position.y = 35; g.add(beam);
    const ring = new T.Mesh(new T.RingGeometry(2.2, 2.9, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false }));
    ring.position.y = 0.32; g.add(ring);
    const arrow = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 4).rotateX(Math.PI), new T.MeshBasicMaterial({ color })); arrow.position.y = 4; g.add(arrow);
    g.userData = { ring, arrow }; g.visible = false; return g;
  }
  let target, momoShop, taxiStand, waypoint;
  const MOMO = { x: -128, z: -260 };
  function setTarget(x, z, label) { target.position.set(x, KS.groundAt(x, z, 100, 200) + 0.02, z); target.visible = true; Game.targetLabel = label; }
  function stopFor(l) {
    if (l.id === 'swayambhu') return { x: KS.SWAYAMBHU.x + 30, z: KS.SWAYAMBHU.z + 6 };
    if (l.id === 'airport') return { x: 606, z: 9 };
    if (l.id === 'bagmati') return { x: l.x, z: KS.RIVER.z0 - 16 };
    // nearest kerb on the surrounding roads
    const c = Math.floor((l.x - G.O) / G.B), r = Math.floor((l.z - G.O) / G.B);
    const cands = [[G.line(c) + 10, l.z], [G.line(c + 1) - 10, l.z], [l.x, G.line(r) + 10], [l.x, G.line(r + 1) - 10]];
    let best = cands[0], bd = 1e9; for (const p of cands) { const d = Math.hypot(p[0] - l.x, p[1] - l.z); if (d < bd) { bd = d; best = p; } }
    return { x: best[0], z: best[1] };
  }
  function randomLot(px, pz, a, b) {
    const L = KS.World.lots;
    for (let i = 0; i < 200; i++) { const l = KS.pick(L), d = Math.hypot(l.x - px, l.z - pz); if (d > a && d < b) return l; }
    return KS.pick(L);
  }
  function startMomo() {
    const d = randomLot(MOMO.x, MOMO.z, 200, 460), dist = Math.hypot(d.x - MOMO.x, d.z - MOMO.z);
    const area = KS.districtAt(d.x, d.z).name;
    Game.mission = { type: 'momo', title: 'Hot Momo Delivery', x: d.x, z: d.z, t: Math.round(dist / 6.2 + 30), area, total: Math.round(dist / 6.2 + 30) };
    setTarget(d.x, d.z, 'Delivery'); momoShop.visible = false;
    Game.notify('🥟 Ten plates of steaming momos. Deliver them to <b>' + area + '</b> before they go cold!');
    A.coin();
  }
  function startTaxi() {
    const PL = KS.Player, l = randomLot(PL.x, PL.z, 60, 200);
    Game.mission = { type: 'taxi', stage: 'pickup', title: 'Taxi Fare', x: l.x, z: l.z, t: 120, passenger: null };
    setTarget(l.x, l.z, 'Passenger');
    Game.notify('🚕 Meter on. A passenger is waiting in <b>' + KS.districtAt(l.x, l.z).name + '</b>.');
  }
  function endMission(ok, msg, pay = 0) {
    const m = Game.mission; if (!m) return;
    if (m.passenger) { m.passenger.root.parent && m.passenger.root.parent.remove(m.passenger.root); }
    Game.mission = null; target.visible = false; momoShop.visible = true;
    if (pay) Game.pay(pay, msg); else Game.notify(msg, ok ? 'good' : 'bad');
    if (ok) Game.karma(+2, 'Good service');
  }
  function missionUpdate(dt) {
    const PL = KS.Player, m = Game.mission;
    if (!m) {
      if (PL.mode === 'foot' || (PL.vehicle && PL.vehicle.type.seats === 'bike')) if (Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 3) startMomo();
      return;
    }
    m.t -= dt;
    const d = Math.hypot(PL.x - m.x, PL.z - m.z), slow = !PL.vehicle || Math.abs(PL.vehicle.speed) < 2.5;
    if (m.type === 'momo') {
      if (d < 4.5 && slow) { const tip = Math.max(0, Math.round(m.t)) * 8; endMission(true, `Momos delivered hot in ${m.area}` + (tip ? ' (with tip)' : ''), 250 + tip); KS.say(PL.person.root, 'Momo aayo! 🥟', 2); }
      else if (m.t <= 0) { endMission(false, 'The momos went cold. The customer paid half.', 0); Game.pay(60, 'Cold momo, half price'); }
    } else if (m.type === 'taxi') {
      if (!PL.vehicle || PL.vehicle.kind !== 'taxi') return;
      if (m.stage === 'pickup') {
        if (d < 7 && slow) {
          const lm = KS.pick(KS.landmarks.filter((l) => { const s = stopFor(l); const dd = Math.hypot(s.x - PL.x, s.z - PL.z); return dd > 260 && dd < 800; })) || KS.landmarks[0];
          const s = stopFor(lm), dist = Math.hypot(s.x - PL.x, s.z - PL.z);
          m.stage = 'drop'; m.x = s.x; m.z = s.z; m.dest = lm; m.fare = Math.round((100 + dist * 0.55) / 10) * 10; m.t = Math.round(dist / 9 + 40);
          setTarget(s.x, s.z, lm.name);
          Game.notify(`🧳 Passenger: "${KS.pick(['Dai, ', 'Bhai, ', 'Please, '])}${lm.name} jane, chito!" Fare रु ${m.fare}`);
        } else if (m.t <= 0) { endMission(false, 'The passenger took a micro bus instead.'); }
      } else if (d < 9 && slow) {
        const bonus = m.t > 0 ? Math.round(m.t * 2) : 0;
        endMission(true, `Fare to ${m.dest.name}` + (bonus ? ' + tip' : ''), m.fare + bonus);
        setTimeout(() => { if (KS.Player.vehicle && KS.Player.vehicle.kind === 'taxi' && !Game.mission) startTaxi(); }, 4000);
      }
    }
  }

  /* ======================= minimap ======================= */
  const MAP = { S: 1400, px: 0.5 }; // pre-rendered map: 2800 m at 0.5 px/m
  function buildMapCanvas() {
    const c = document.createElement('canvas'); c.width = c.height = MAP.S; const g = c.getContext('2d');
    const w2p = (v) => (v + 1400) * MAP.px;
    const gr = g.createRadialGradient(MAP.S / 2, MAP.S / 2, 200, MAP.S / 2, MAP.S / 2, MAP.S * 0.7);
    gr.addColorStop(0, '#c9cfa0'); gr.addColorStop(0.5, '#9fb27a'); gr.addColorStop(1, '#5f7a4a'); g.fillStyle = gr; g.fillRect(0, 0, MAP.S, MAP.S);
    g.fillStyle = '#7f9a5a'; g.beginPath(); g.arc(w2p(KS.SWAYAMBHU.x), w2p(KS.SWAYAMBHU.z), 150 * MAP.px, 0, 7); g.fill();
    g.fillStyle = '#e3dccd'; g.fillRect(w2p(-560), w2p(-560), 1120 * MAP.px, 1120 * MAP.px);
    const col = { city: '#cfc5b3', thamel: '#e2b796', old: '#d6a88c', ason: '#d6a88c', newroad: '#cbbdab', park: '#9cc77a', garden: '#9cc77a', tundikhel: '#a9d17f', tundikhel2: '#a9d17f', palace: '#e9c9b4', singha: '#b9d79a', stadium: '#b3d58a', durbar: '#d98f6f', durbar2: '#d98f6f', boudha: '#efe6d6', pashupati: '#e6c66a', ranipokhari: '#9cc77a', dharahara: '#ddd5c6' };
    for (let c2 = 0; c2 < G.N; c2++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c2, r); if (t === 'river') continue; const R = KS.World.blockRect(c2, r);
      g.fillStyle = col[t] || '#cfc5b3'; g.fillRect(w2p(R.x0), w2p(R.z0), (R.x1 - R.x0) * MAP.px, (R.z1 - R.z0) * MAP.px);
    }
    g.fillStyle = '#6fa3c4'; g.fillRect(0, w2p(KS.RIVER.z0), MAP.S, (KS.RIVER.z1 - KS.RIVER.z0) * MAP.px);
    g.fillStyle = '#5a8fb3'; g.fillRect(w2p(22), w2p(-158), 46 * MAP.px, 46 * MAP.px);
    g.fillStyle = '#8e8e94'; g.fillRect(w2p(719), w2p(-380), 32 * MAP.px, 760 * MAP.px); g.fillRect(w2p(610), w2p(-90), 60 * MAP.px, 220 * MAP.px);
    for (let i = 0; i <= G.N; i++) {
      const ring = i === 0 || i === G.N, w = G.roadHalf(i) * 2 * MAP.px;
      g.fillStyle = ring ? '#f3d27a' : '#fbfaf4';
      g.fillRect(w2p(G.line(i)) - w / 2, w2p(-551), w, 1102 * MAP.px); g.fillRect(w2p(-551), w2p(G.line(i)) - w / 2, 1102 * MAP.px, w);
    }
    g.fillStyle = '#fbfaf4'; g.fillRect(w2p(KS.SWAYAMBHU.x + 20), w2p(-96), (-540 - KS.SWAYAMBHU.x - 20) * MAP.px, 12 * MAP.px); g.fillRect(w2p(540), w2p(-7), 80 * MAP.px, 14 * MAP.px);
    // durbar square plaza paints over the road between its blocks
    g.fillStyle = '#d98f6f'; g.fillRect(w2p(-176), w2p(4), 82 * MAP.px, 172 * MAP.px);
    g.fillStyle = '#e6c66a'; g.fillRect(w2p(368), w2p(368), 74 * MAP.px, 90 * MAP.px);
    return c;
  }
  let mapC, mini, miniG, big, bigG;
  function drawMini() {
    const PL = KS.Player, S = mini.width, R = S / 2, zoom = PL.vehicle ? 0.8 : 1.25; // canvas px per pre-map px
    const g = miniG; g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
    g.fillStyle = '#5f7a4a'; g.fillRect(0, 0, S, S);
    const yaw = KS.Cam.yaw, th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    g.translate(R, R); g.rotate(th); g.scale(zoom, zoom);
    const mx = (PL.x + 1400) * MAP.px, mz = (PL.z + 1400) * MAP.px;
    g.drawImage(mapC, -mx, -mz);
    const dot = (x, z, r, c, stroke) => { g.beginPath(); g.arc((x - PL.x) * MAP.px, (z - PL.z) * MAP.px, r / zoom, 0, 7); g.fillStyle = c; g.fill(); if (stroke) { g.lineWidth = 2 / zoom; g.strokeStyle = stroke; g.stroke(); } };
    for (const l of KS.landmarks) dot(l.x, l.z, 4, Game.found.has(l.id) ? '#c8102e' : '#ffffff', '#7a1414');
    for (const v of KS.Traffic.list) if (v.kind === 'police' && Math.hypot(v.x - PL.x, v.z - PL.z) < 260) dot(v.x, v.z, 2.6, '#1d4fb8');
    if (momoShop.visible) dot(MOMO.x, MOMO.z, 5, '#f2a516', '#5a3a00');
    if (target.visible) dot(target.position.x, target.position.z, 5.5, '#ffd21f', '#111');
    if (waypoint.visible) dot(waypoint.position.x, waypoint.position.z, 5, '#e23a8a', '#fff');
    g.restore();
    // edge arrow towards an off-map target
    const tgt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
    if (tgt) {
      const dx = (tgt.x - PL.x) * MAP.px * zoom, dz = (tgt.z - PL.z) * MAP.px * zoom;
      const rx = dx * Math.cos(th) - dz * Math.sin(th), rz = dx * Math.sin(th) + dz * Math.cos(th), d = Math.hypot(rx, rz);
      if (d > R - 8) { const a = Math.atan2(rz, rx); g.save(); g.translate(R + Math.cos(a) * (R - 10), R + Math.sin(a) * (R - 10)); g.rotate(a); g.fillStyle = target.visible ? '#ffd21f' : '#e23a8a'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.fill(); g.restore(); }
    }
    // player arrow
    const ph = (PL.vehicle ? PL.vehicle.h : PL.h), ax = Math.sin(ph), az = Math.cos(ph);
    const pa = Math.atan2(ax * Math.sin(th) + az * Math.cos(th), ax * Math.cos(th) - az * Math.sin(th));
    g.save(); g.translate(R, R); g.rotate(pa); g.fillStyle = '#fff'; g.strokeStyle = '#c8102e'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    // north
    const na = th - Math.PI / 2; g.fillStyle = '#fff'; g.font = '700 12px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11), 8, 0, 7); g.fillStyle = '#7a1414'; g.fill(); g.fillStyle = '#fff'; g.fillText('N', R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11) + 1);
  }
  function drawBig() {
    const W = big.width = big.clientWidth * (devicePixelRatio || 1), H = big.height = big.clientHeight * (devicePixelRatio || 1);
    const g = bigG;
    const scale = Math.min(W, H) / (1500 * MAP.px), cx = W / 2, cz = H / 2, wx = (x) => cx + x * MAP.px * scale, wz = (z) => cz + z * MAP.px * scale;
    big._scale = scale; big._cx = cx; big._cz = cz;
    g.fillStyle = '#2c3a28'; g.fillRect(0, 0, W, H);
    g.drawImage(mapC, wx(-1400), wz(-1400), MAP.S * scale, MAP.S * scale);
    g.font = `600 ${Math.round(12 * (devicePixelRatio || 1))}px "Barlow Condensed", sans-serif`; g.textAlign = 'center';
    for (const l of KS.landmarks) {
      g.beginPath(); g.arc(wx(l.x), wz(l.z), 6 * (devicePixelRatio || 1), 0, 7); g.fillStyle = Game.found.has(l.id) ? '#c8102e' : '#fff'; g.fill(); g.strokeStyle = '#7a1414'; g.lineWidth = 2; g.stroke();
      if (l.minor) continue;
      g.fillStyle = 'rgba(20,14,10,0.75)'; const tw = g.measureText(l.name).width + 10; g.fillRect(wx(l.x) - tw / 2, wz(l.z) - 30 * (devicePixelRatio || 1), tw, 18 * (devicePixelRatio || 1));
      g.fillStyle = '#fff'; g.fillText(l.name, wx(l.x), wz(l.z) - 17 * (devicePixelRatio || 1));
    }
    const PL = KS.Player; g.beginPath(); g.arc(wx(PL.x), wz(PL.z), 8 * (devicePixelRatio || 1), 0, 7); g.fillStyle = '#ffd21f'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
    if (target.visible) { g.beginPath(); g.arc(wx(target.position.x), wz(target.position.z), 7 * (devicePixelRatio || 1), 0, 7); g.fillStyle = '#ffd21f'; g.fill(); }
    if (waypoint.visible) { g.beginPath(); g.arc(wx(waypoint.position.x), wz(waypoint.position.z), 7 * (devicePixelRatio || 1), 0, 7); g.fillStyle = '#e23a8a'; g.fill(); }
  }

  /* ======================= setup ======================= */
  let renderer, scene, camera;
  const tmpV = new T.Vector3();
  Game.start = async () => {
    try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('700 40px Mukta'), document.fonts.load('800 40px "Barlow Condensed"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts optional */ }
    const canvas = $('scene');
    renderer = new T.WebGLRenderer({ canvas, antialias: KS.quality.level === 'high', powerPreference: 'high-performance' });
    renderer.setPixelRatio(KS.quality.pixelRatio); renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = KS.quality.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 9500);
    KS.scene = scene; KS.camera = camera; KS.renderer = renderer;
    const step = (msg) => { $('loadmsg').textContent = msg; return new Promise((r) => setTimeout(r, 30)); };
    await step('Laying the Ring Road and the lanes of Thamel…');
    KS.World.build(scene);
    await step('Waking up the city: pilgrims, porters, cows…');
    KS.Weather.init(scene, renderer);
    KS.Player.init(scene);
    KS.Peds.init(scene, KS.quality.peds, KS.Player.x, KS.Player.z);
    KS.Animals.init(scene);
    await step('Starting the traffic (and the honking)…');
    KS.Traffic.init(scene, KS.quality.cars, KS.Player.x, KS.Player.z);
    KS.Traffic.park('bike', -124, -263.4, Math.PI / 2);
    KS.Traffic.park('scooter', -139, -263.4, -Math.PI / 2);
    KS.Traffic.park('taxi', 6.6, -36, Math.PI);
    KS.Traffic.park('bus', 6.9, -56, Math.PI);
    KS.Traffic.park('tempo', -88.6, 60, 0);
    KS.Input.init(canvas);
    target = makeMarker(0xffd21f); scene.add(target);
    momoShop = makeMarker(0xf2a516); momoShop.position.set(MOMO.x, 0.22, MOMO.z); momoShop.visible = true; scene.add(momoShop);
    waypoint = makeMarker(0xe23a8a); scene.add(waypoint);
    // a stand-in "Momo House" sign above the start marker
    mapC = buildMapCanvas(); mini = $('minimap'); miniG = mini.getContext('2d'); big = $('bigmap'); bigG = big.getContext('2d');
    big.addEventListener('click', (e) => {
      const r = big.getBoundingClientRect(), k = devicePixelRatio || 1, x = ((e.clientX - r.left) * k - big._cx) / (MAP.px * big._scale), z = ((e.clientY - r.top) * k - big._cz) / (MAP.px * big._scale);
      waypoint.position.set(x, KS.heightAt(x, z) + 0.05, z); waypoint.visible = true; Game.notify('Waypoint set. Follow the pink arrow.'); drawBig();
    });
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && KS.state === 'play') pause(true); });
    $('loading').hidden = true; $('title').hidden = false;
    buildMenu();
    requestAnimationFrame(frame);
    window.__ks = { ready: true, buildings: KS.buildingCount, trees: KS.treeCount, vehicles: KS.Traffic.list.length, peds: KS.Peds.list.length };
  };

  function pause(on) {
    if (on && KS.state === 'play') { KS.state = 'pause'; $('menu').hidden = false; refreshMenu(); if (document.exitPointerLock) document.exitPointerLock(); }
    else if (!on && KS.state === 'pause') { KS.state = 'play'; $('menu').hidden = true; }
  }
  Game.pause = pause;
  function buildMenu() {
    const wx = $('wxbtns');
    for (const k of KS.Weather.ORDER) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.wx = k; const t = KS.Weather.TYPES[k]; b.innerHTML = `<span>${t.icon}</span>${t.name}`; b.onclick = () => { KS.Weather.auto = false; KS.Weather.set(k); refreshMenu(); }; wx.appendChild(b); }
    const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'chip'; ab.dataset.wx = 'auto'; ab.innerHTML = '<span>↻</span>Changing'; ab.onclick = () => { KS.Weather.auto = true; refreshMenu(); }; wx.appendChild(ab);
    $('timeRange').addEventListener('input', (e) => { KS.time = +e.target.value; refreshMenu(); });
    $('btnResume').onclick = () => pause(false);
    $('btnSound').onclick = () => { A.toggle(); refreshMenu(); };
    $('btnQuality').onclick = () => { KS.quality.level = KS.quality.level === 'high' ? 'low' : 'high'; Game.save(); $('qnote').hidden = false; refreshMenu(); };
    $('btnPlay').onclick = () => { A.init(); KS.state = 'play'; $('title').hidden = true; $('hud').hidden = false; if (coarse) $('touch').hidden = false; Game.notify('Namaste! Walk into the <b>orange beam</b> to deliver momos, or take any vehicle with <b>E</b>.'); };
    $('btnMenu').onclick = () => pause(true);
  }
  function refreshMenu() {
    document.querySelectorAll('[data-wx]').forEach((b) => b.classList.toggle('on', b.dataset.wx === 'auto' ? KS.Weather.auto : !KS.Weather.auto && b.dataset.wx === KS.Weather.type));
    $('timeRange').value = KS.time.toFixed(1); $('timeVal').textContent = fmtTime(KS.time);
    $('btnSound').textContent = A.on ? 'Sound: on' : 'Sound: off';
    $('btnQuality').textContent = 'Graphics: ' + (KS.quality.level === 'high' ? 'high' : 'low');
    const list = $('lmlist'); list.innerHTML = '';
    for (const l of KS.landmarks) { const li = document.createElement('li'); li.className = Game.found.has(l.id) ? 'found' : ''; li.innerHTML = `<b>${l.name}</b><span lang="ne">${l.np}</span>`; list.appendChild(li); }
    $('lmcount').textContent = `${Game.found.size} / ${KS.landmarks.length}`;
  }
  const fmtTime = (t) => { const h = Math.floor(t), m = Math.floor((t - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  /* ======================= main loop ======================= */
  const clock = new T.Clock();
  let hudT = 0, miniT = 0, lmT = 0, umbT = 0, bellT = 0, lastDistrict = '', titleA = 0;
  const umbGeo = new T.ConeGeometry(0.75, 0.35, 8), umbMats = [0x111111, 0xc8102e, 0x1d4fb8, 0x1f9a4c, 0xf2c418].map((c) => new T.MeshLambertMaterial({ color: c }));
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const I = KS.Input, PL = KS.Player, play = KS.state === 'play';
    if (KS.state === 'pause') { if (I.hit('Escape') || I.hit('KeyP')) pause(false); I.endFrame(); renderer.render(scene, camera); return; }
    KS.clock += dt;
    if (play) {
      if (I.hit('Escape') || I.hit('KeyP')) pause(true);
      if (I.hit('KeyM') || I.hit('KeyMap')) { const b = $('bigwrap'); b.hidden = !b.hidden; if (!b.hidden) drawBig(); }
      if (I.hit('KeyT')) { KS.Weather.auto = false; KS.Weather.next(); Game.notify(`Weather: <b>${KS.Weather.TYPES[KS.Weather.type].name}</b>`); }
      if (I.hit('KeyN')) { KS.time = (KS.time + 3) % 24; Game.notify('Fast-forward 3 hours → ' + fmtTime(KS.time)); }
      if (I.hit('KeyR') && PL.vehicle) { A.station = (A.station + 1) % STATIONS.length; const st = STATIONS[A.station]; Game.notify(st ? `📻 <b>${st.name}</b> <span>${st.genre}</span>` : '📻 Radio off'); }
      if (I.hit('KeyH') || I.hit('KeyHorn')) {
        if (PL.vehicle) { A.horn(PL.vehicle.kind, 1); Game.honk = 0.4; }
        else { KS.say(PL.person.root, KS.pick(['Oi dai!', 'Namaste!', 'Eh sathi!']), 1.4); Game.honk = 0.4; }
      }
      PL.update(dt);
    }
    Game.honk = Math.max(0, (Game.honk || 0) - dt);
    const focus = tmpV.set(PL.x, PL.y, PL.z);
    KS.Weather.update(dt, camera, { focus });
    const ctx = { px: PL.x, pz: PL.z, cx: camera.position.x, cz: camera.position.z, night: KS.night, rain: KS.Weather.wet > 0.3, playerVehicle: PL.vehicle, player: { x: PL.x, z: PL.z, len: PL.len, wid: PL.wid } };
    KS.Traffic.update(dt, ctx);
    KS.Peds.update(dt, ctx);
    KS.Animals.update(dt, { px: PL.x, pz: PL.z, playerSpeed: Math.abs(PL.speed), honk: Game.honk > 0.35, inVehicle: !!PL.vehicle, vehicleKind: PL.vehicle && PL.vehicle.type.seats, night: KS.night });
    for (const u of KS.timeUniforms) u.value = KS.clock;
    if (KS.waterTex) KS.waterTex.offset.x = (KS.clock * 0.004) % 1;
    for (const h of KS.clockHands) h.hand.rotation.z = h.k === 'h' ? -((KS.time % 12) / 12) * Math.PI * 2 : -((KS.time % 1)) * Math.PI * 2;
    // aircraft: take off, vanish into the clouds, come back to land
    const fp = KS.flyingPlane; if (fp) {
      const cyc = KS.clock % 150, rx = KS.runwayX;
      if (cyc < 12) { fp.visible = true; fp.position.set(rx, 2.6, 360); fp.rotation.set(0, Math.PI, 0); }
      else if (cyc < 45) { const t = cyc - 12, z = 360 - 1.4 * t * t; const lift = Math.max(0, -z - 0) * 0.16; fp.position.set(rx, 2.6 + lift, z); fp.rotation.set(-Math.min(0.2, lift * 0.004), Math.PI, 0); fp.visible = z > -2600; }
      else if (cyc < 95) fp.visible = false;
      else if (cyc < 130) { const t = (cyc - 95) / 35, z = KS.lerp(2600, 360, t); fp.visible = true; fp.position.set(rx, KS.lerp(260, 2.6, Math.min(1, t * 1.02)), z); fp.rotation.set(0.05, Math.PI, 0); }
      else { const t = cyc - 130, z = 360 - (60 * t - 1.5 * t * t); fp.position.set(rx, 2.6, Math.max(-380, z)); fp.rotation.set(0, Math.PI, 0); }
    }
    if (play) {
      missionUpdate(dt);
      // landmark discovery
      lmT -= dt;
      if (lmT <= 0) {
        lmT = 0.4;
        for (const l of KS.landmarks) if (!Game.found.has(l.id) && Math.hypot(l.x - PL.x, l.z - PL.z) < l.r) {
          Game.found.add(l.id); showCard(l); Game.pay(500, 'Discovered ' + l.name); Game.karma(+1, 'Visited ' + l.name);
          if (Game.found.size === KS.landmarks.length) Game.notify('🏆 You have seen every corner of Kathmandu!', 'good');
        }
        // temple bells nearby
        for (const [x, z] of KS.bells) { const d = Math.hypot(x - PL.x, z - PL.z); if (d < 30 && KS.chance(0.03)) A.bell(0.4 * (1 - d / 30)); }
      }
      // umbrellas when it rains
      umbT -= dt;
      if (umbT <= 0) {
        umbT = 0.6; const wet = KS.Weather.wet > 0.3;
        for (const p of KS.Peds.list) {
          if (!p.p.root.visible || p.mode === 'police' || p.kind === 'monk') continue;
          if (wet && !p.umb && KS.chance(0.7) && p.mode !== 'sit') { p.umb = new T.Mesh(umbGeo, KS.pick(umbMats)); const stick = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 1, 4), umbMats[0]); stick.position.y = -0.5; p.umb.add(stick); p.umb.position.set(0.25, 2.25, 0.1); p.p.root.add(p.umb); }
          if (p.umb) { p.umb.visible = wet; if (wet) { p.p.armR.rotation.x = -2.6; } }
        }
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHUD(); }
      miniT -= dt; if (miniT <= 0) { miniT = 1 / 20; drawMini(); }
      // markers bob
      for (const m of [target, momoShop, waypoint]) if (m.visible) { m.userData.arrow.position.y = 4 + Math.sin(KS.clock * 3) * 0.5; m.userData.arrow.rotation.y += dt * 2; }
      if (waypoint.visible && Math.hypot(waypoint.position.x - PL.x, waypoint.position.z - PL.z) < 8) { waypoint.visible = false; Game.notify('Waypoint reached.'); }
      PL.updateCamera(camera, dt);
      const dens = KS.Traffic.nearCount(PL.x, PL.z, 60);
      Game.radioAudible = !!PL.vehicle;
      A.update(dt, { density: Math.min(1, dens / 10), rain: KS.Weather.wet, wind: KS.Weather.cur.wind, speed: Math.abs(PL.speed), vehicle: PL.vehicle, throttle: PL.vehicle ? Math.abs((I.down('KeyW') || I.down('ArrowUp') || I.joy.y > 0.2) ? 1 : 0) : 0 });
    } else {
      // title screen: slow aerial orbit over the old city
      titleA += dt * 0.05;
      camera.position.set(-120 + Math.cos(titleA) * 170, 70 + Math.sin(titleA * 0.7) * 10, -120 + Math.sin(titleA) * 170);
      camera.lookAt(-110, 8, -80);
    }
    KS.updateBubbles(dt, camera, innerWidth, innerHeight);
    renderer.render(scene, camera);
    I.endFrame();
  }
  function showCard(l) {
    const c = $('card'); $('cardNp').textContent = l.np; $('cardEn').textContent = l.name; $('cardFact').textContent = l.fact;
    c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(showCard.t); showCard.t = setTimeout(() => (c.hidden = true), 6500);
    A.bell(0.5);
  }
  function updateHUD() {
    const PL = KS.Player, d = KS.districtAt(PL.x, PL.z);
    if (d.name !== lastDistrict) { lastDistrict = d.name; $('locNp').textContent = d.np; $('locEn').textContent = d.name; const el = $('loc'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    const w = KS.Weather.describe();
    $('clock').textContent = fmtTime(KS.time);
    $('wx').textContent = `${w.icon} ${w.name}`; $('temp').textContent = `${w.temp}°C`;
    const aqi = $('aqi'); aqi.textContent = `AQI ${w.aqi}`; aqi.dataset.level = w.aqi > 150 ? 'bad' : w.aqi > 100 ? 'mid' : 'ok';
    $('money').textContent = 'रु ' + Game.money.toLocaleString('en-IN');
    $('karma').style.setProperty('--k', Game.karmaV + '%'); $('karmaV').textContent = Math.round(Game.karmaV);
    if (PL.vehicle) { $('kmh').textContent = Math.round(Math.abs(PL.vehicle.speed) * 3.6); const st = STATIONS[A.station]; $('radio').textContent = st ? '📻 ' + st.name : ''; }
    // prompts
    let prompt = '';
    if (!PL.vehicle) {
      const v = KS.Traffic.nearest(PL.x, PL.z, 3.6);
      if (v) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ${v.ai ? 'Take' : 'Ride'} the ${v.type.name.toLowerCase()}`;
      else if (KS.prayerWheels.some(([x, z]) => Math.hypot(x - PL.x, z - PL.z) < 2.4)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Spin the prayer wheel`;
      else if (PL.swim) prompt = 'Swimming in the Bagmati… head for the bank!';
      else if (Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 12 && !Game.mission) prompt = 'Step into the orange beam: <b>Momo House</b> delivery job';
    } else if (Game.mission && Game.mission.type === 'taxi' && Game.mission.stage === 'pickup' && Math.hypot(PL.x - Game.mission.x, PL.z - Game.mission.z) < 20) prompt = 'Stop next to the passenger';
    $('prompt').innerHTML = prompt; $('prompt').hidden = !prompt;
    const m = Game.mission, mp = $('mission');
    if (m) {
      mp.hidden = false; $('mTitle').textContent = m.title;
      const dist = Math.round(Math.hypot(PL.x - m.x, PL.z - m.z));
      $('mObj').textContent = m.type === 'momo' ? `Deliver to ${m.area}` : m.stage === 'pickup' ? 'Pick up the passenger' : `Drop at ${m.dest.name} · रु ${m.fare}`;
      $('mMeta').textContent = `${dist} m · ${Math.max(0, Math.floor(m.t / 60))}:${String(Math.max(0, Math.floor(m.t % 60))).padStart(2, '0')}`;
      mp.classList.toggle('urgent', m.t < 20);
    } else mp.hidden = true;
    // Himalaya hint when looking north on a clear day
    const yaw = ((KS.Cam.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2), north = Math.abs(yaw - Math.PI) < 0.6;
    $('himal').hidden = !(north && KS.Weather.cur.mtn > 0.5 && KS.day > 0.3);
  }

  addEventListener('load', () => { Game.start().catch((e) => { $('loadmsg').textContent = 'Could not start 3D: ' + e.message; console.error(e); }); });
})();
