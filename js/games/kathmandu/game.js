/* Kathmandu Streets — HUD, minimap & GPS, traffic fines (speed cameras, police, red-light cameras),
   momo deliveries, recording & photos, menu, main loop. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const $ = (id) => document.getElementById(id);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const D = KS.Shop.data, A = KS.audio;
  const hi = D.quality ? D.quality === 'high' : !coarse;
  KS.quality = { level: hi ? 'high' : 'low', shadows: hi, shadowSize: hi ? 2048 : 1024, pixelRatio: Math.min(devicePixelRatio || 1, hi ? 2 : 1.25), peds: hi ? 130 : 55, cars: hi ? 150 : 70 };
  KS.clock = 0; KS.state = 'title';
  A.on = D.sound !== false;

  /* ======================= game state ======================= */
  const Game = (KS.Game = { found: new Set(D.found), mission: null, fineT: 0, target: null, route: null });
  Object.defineProperty(Game, 'money', { get: () => D.cash, set: (v) => (D.cash = v) });
  Game.save = () => { D.found = [...Game.found]; D.sound = A.on; D.quality = KS.quality.level; KS.Shop.save(); };
  Game.notify = (html, cls = '') => {
    const el = document.createElement('div'); el.className = 'note ' + cls; el.innerHTML = html; $('notes').prepend(el);
    setTimeout(() => el.classList.add('out'), 4600); setTimeout(() => el.remove(), 5200);
    while ($('notes').children.length > 4) $('notes').lastChild.remove();
  };
  Game.pay = (n, why) => { D.cash += n; if (n > 0) A.cash(); Game.notify(`${n >= 0 ? '+' : '−'} रु ${Math.abs(n).toLocaleString('en-IN')} <span>${why}</span>`, n >= 0 ? 'good' : 'bad'); Game.save(); };
  Game.giveTokens = (n, why) => { D.tokens += n; Game.notify(`+${n} 🪙 coins <span>${why}</span>`, 'karma'); A.coin(); Game.save(); };
  Game.karma = (d, why) => { D.karma = KS.clamp(D.karma + d, 0, 100); if (Math.abs(d) >= 2) Game.notify(`Karma ${d > 0 ? '+' : ''}${d} <span>${why}</span>`, d > 0 ? 'karma' : 'bad'); };
  Object.defineProperty(Game, 'karmaV', { get: () => D.karma });
  Game.fine = (n, why, force) => {
    if (!force && KS.clock - Game.fineT < 6) return; Game.fineT = KS.clock;
    A.whistle(0.9); Game.pay(-n, '🚓 Fine: ' + why); KS.Uthao.event('fine'); flash('fine');
  };
  Game.policeNear = (x, z, r) => KS.Peds.police.some((p) => Math.hypot(p.x - x, p.z - z) < r) || KS.Traffic.list.some((v) => v.kind === 'police' && v.ai && Math.hypot(v.x - x, v.z - z) < r * 0.6);
  Game.hurt = (dmg) => {
    const PL = KS.Player; PL.health -= dmg; KS.Cam.shake = 0.3; A.punch(); flash('hurt');
    if (PL.health <= 0) {
      PL.health = 100; if (PL.vehicle) PL.exit();
      PL.x = KS.hospital.x; PL.z = KS.hospital.z + 6; PL.y = 0.2;
      Game.pay(-800, 'You blacked out. Hospital bill'); Game.notify('🏥 You woke up at the City Hospital.', 'bad');
      KS.Peds.list.forEach((p) => (p.fight = 0));
    }
  };
  Game.onPunch = (ped) => {
    Game.karma(-4, 'Started a fight');
    if (Game.policeNear(ped.x, ped.z, 45)) Game.fine(2000, 'Fighting in public', true);
  };
  Game.onCrash = (speed) => { if (speed > 6) KS.Uthao.event('crash'); };
  Game.onHardBrake = () => KS.Uthao.event('brake');
  Game.splash = (v) => {
    A.splash(); Game.notify(`Splash! The Bagmati swallowed your ${v.type.name.toLowerCase()}.`, 'bad');
    const PL = KS.Player;
    if (PL.person.root.parent !== PL.scene) PL.scene.add(PL.person.root);
    PL.person.root.visible = true; PL.vehicle = null; PL.mode = 'foot';
    PL.x = v.x; PL.z = Math.abs(v.z - KS.RIVER.z0) < Math.abs(v.z - KS.RIVER.z1) ? KS.RIVER.z0 - 8 : KS.RIVER.z1 + 26; PL.y = 0.3; PL.vy = 0; KS.Cam.want = 7;
    if (v.owned) { KS.Traffic.remove(v); if (KS.Shop.delivered === v) KS.Shop.delivered = null; Game.notify('Your vehicle was fished out; call it again from the Garage.'); }
    else KS.Traffic.recycle(v, PL.x + 300, PL.z - 300);
    KS.Uthao.trip && KS.Uthao.cancel(); PL.rebuild();
  };
  Game.onEnter = (v) => {
    Game.notify(`<b>${v.type.name}</b> <span>${coarse ? '' : 'E get out · H horn · R radio · U Uthao app'}</span>`);
    $('speedo').hidden = false; $('vname').textContent = v.type.name;
    if (KS.isBike(v.kind)) KS.Player.rebuild();
    KS.Radio.setInVehicle(true); KS.Uthao.render();
  };
  Game.onExit = (v) => {
    $('speedo').hidden = true; KS.Radio.setInVehicle(false);
    if (KS.isBike(v.kind)) KS.Player.rebuild();
    if (KS.Uthao.trip && KS.Uthao.trip.stage === 'drop' && !KS.Uthao.trip.parcel) { KS.Uthao.cancel(); }
    KS.Uthao.render();
  };
  let wheelT = -10;
  Game.interact = () => {
    const PL = KS.Player;
    for (const [x, z] of KS.prayerWheels) if (Math.hypot(x - PL.x, z - PL.z) < 2.4) {
      if (KS.clock - wheelT > 2) { wheelT = KS.clock; A.prayer(); KS.say(PL.person.root, 'Om mani padme hum 🙏', 2.2, 'calm'); Game.karma(+1, 'Spun a prayer wheel'); }
      return;
    }
    for (const [x, z] of KS.bells) if (Math.hypot(x - PL.x, z - PL.z) < 9) { A.bell(0.8); KS.say(PL.person.root, '🔔 Dong…', 1.5, 'calm'); return; }
    let best = null, bd = 5;
    KS.Peds.forEachNear(PL.x, PL.z, 5, (p) => { const d = Math.hypot(p.x - PL.x, p.z - PL.z); if (d < bd && !p.down) { bd = d; best = p; } });
    if (best) { KS.say(PL.person.root, 'Namaste! 🙏', 1.6, 'calm'); setTimeout(() => KS.say(best.p.root, KS.pick(KS.LINES[best.kind] || KS.LINES.greet), 2.4), 600); }
  };
  let promptOverride = '', promptT = 0;
  Game.prompt = (txt) => { promptOverride = txt; promptT = 0.4; };

  /* ======================= targets & GPS ======================= */
  let target, momoShop, waypoint;
  const MOMO = { x: -128, z: -260 };
  Game.stopFor = (l) => {
    if (l.stop) return l.stop;
    if (l.id === 'swayambhu') return { x: KS.SWAYAMBHU.x + 30, z: KS.SWAYAMBHU.z + 6 };
    if (l.id === 'airport') return { x: 606, z: 9 };
    if (l.id === 'bagmati') return { x: l.x, z: KS.RIVER.z0 - 16 };
    const c = Math.floor((l.x - G.O) / G.B), r = Math.floor((l.z - G.O) / G.B);
    const cands = [[G.line(c) + 10, l.z], [G.line(c + 1) - 10, l.z], [l.x, G.line(r) + 10], [l.x, G.line(r + 1) - 10]];
    let best = cands[0], bd = 1e9; for (const p of cands) { const d = Math.hypot(p[0] - l.x, p[1] - l.z); if (d < bd) { bd = d; best = p; } }
    return { x: best[0], z: best[1] };
  };
  Game.setTarget = (x, z, label) => { target.position.set(x, KS.groundAt(x, z, 100, 200) + 0.02, z); target.visible = true; Game.targetLabel = label; Game.routeT = 0; };
  Game.clearTarget = () => { target.visible = false; Game.route = null; };
  function makeMarker(color) {
    const g = new T.Group();
    const beam = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 70, 16, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: T.AdditiveBlending, fog: false })); beam.position.y = 35; g.add(beam);
    const ring = new T.Mesh(new T.RingGeometry(2.2, 2.9, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false })); ring.position.y = 0.32; g.add(ring);
    const arrow = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 4).rotateX(Math.PI), new T.MeshBasicMaterial({ color })); arrow.position.y = 4; g.add(arrow);
    g.userData = { arrow }; g.visible = false; return g;
  }
  function randomLot(px, pz, a, b) { const L = KS.World.lots; for (let i = 0; i < 200; i++) { const l = KS.pick(L), d = Math.hypot(l.x - px, l.z - pz); if (d > a && d < b) return l; } return KS.pick(L); }
  function startMomo() {
    const d = randomLot(MOMO.x, MOMO.z, 200, 460), dist = Math.hypot(d.x - MOMO.x, d.z - MOMO.z), area = KS.districtAt(d.x, d.z).name;
    Game.mission = { type: 'momo', title: 'Hot Momo Delivery', x: d.x, z: d.z, t: Math.round(dist / 6.2 + 30), area };
    Game.setTarget(d.x, d.z, 'Delivery'); momoShop.visible = false;
    Game.notify('🥟 Ten plates of steaming momos. Deliver them to <b>' + area + '</b> before they go cold!'); A.coin();
  }
  function missionUpdate(dt) {
    const PL = KS.Player, m = Game.mission;
    if (!m) { if ((PL.mode === 'foot' || (PL.vehicle && KS.isBike(PL.vehicle.kind))) && !KS.Uthao.trip && Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 3) startMomo(); return; }
    m.t -= dt;
    const d = Math.hypot(PL.x - m.x, PL.z - m.z), slow = !PL.vehicle || Math.abs(PL.vehicle.speed) < 2.5;
    const end = () => { Game.mission = null; Game.clearTarget(); momoShop.visible = true; };
    if (d < 4.5 && slow) { const tip = Math.max(0, Math.round(m.t)) * 8; end(); Game.pay(250 + tip, `Momos delivered hot in ${m.area}`); Game.giveTokens(2 + (tip ? 1 : 0), 'Delivery completed'); KS.say(PL.person.root, 'Momo aayo! 🥟', 2); }
    else if (m.t <= 0) { end(); A.fail(); Game.pay(60, 'The momos went cold, half price'); }
  }

  /* ======================= traffic violations ======================= */
  let lastSig = null;
  function violations(dt) {
    const PL = KS.Player, v = PL.vehicle; if (!v) { lastSig = null; return; }
    const kmh = Math.abs(v.speed) * 3.6, lim = KS.speedLimit(PL.x, PL.z);
    Game.limit = lim; Game.kmh = kmh;
    for (const c of KS.speedCams) {
      c.cool = Math.max(0, c.cool - dt); c.flash.material.opacity = Math.max(0, c.flash.material.opacity - dt * 3);
      if (c.cool <= 0 && Math.hypot(PL.x - c.x, PL.z - c.z) < 16 && kmh > lim + 5) {
        c.cool = 10; c.flash.material.opacity = 1; A.speedcam(); flash('cam');
        Game.fine(Math.round((500 + (kmh - lim) * 40) / 50) * 50, `Speed camera: ${Math.round(kmh)} km/h in a ${lim} zone`, true);
      }
    }
    if (kmh > lim + 12 && Game.policeNear(PL.x, PL.z, 45)) Game.fine(1000, `Police clocked you at ${Math.round(kmh)} km/h (limit ${lim})`);
    // red-light cameras at signalled junctions
    const s = KS.Traffic.signalAt(PL.x, PL.z);
    if (s && s !== lastSig) {
      const ax = Math.abs(Math.sin(v.h)) > Math.abs(Math.cos(v.h)) ? 'ew' : 'ns';
      if (s.state[ax] === 'r' && kmh > 5 && v.kind !== 'ambulance') { A.speedcam(); flash('cam'); Game.fine(1500, 'Red-light camera: you jumped the signal', true); Game.karma(-2, 'Ran a red light'); }
    }
    lastSig = s;
    if (Game.honk > 0.35 && v) KS.Uthao.event('honk');
  }
  function flash(kind) { const f = $('flash'); f.className = 'flash ' + kind; void f.offsetWidth; f.classList.add('go'); }

  /* ======================= recording & photos ======================= */
  const Rec = (Game.Rec = { on: false, rec: null, chunks: [], t0: 0 });
  Rec.toggle = () => {
    if (Rec.on) { Rec.rec.stop(); return; }
    const canvas = $('scene');
    if (!canvas.captureStream || !window.MediaRecorder) { Game.notify('Recording is not supported in this browser.', 'bad'); return; }
    const stream = canvas.captureStream(30);
    if (A.streamDest) A.streamDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    try { Rec.rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined); } catch (e) { Game.notify('Could not start recording: ' + e.message, 'bad'); return; }
    Rec.chunks = []; Rec.rec.ondataavailable = (e) => e.data.size && Rec.chunks.push(e.data);
    Rec.rec.onstop = () => {
      Rec.on = false; $('recDot').hidden = true; $('btnRec').classList.remove('on');
      const blob = new Blob(Rec.chunks, { type: Rec.rec.mimeType || 'video/webm' }), url = URL.createObjectURL(blob);
      showMedia(url, 'video', `kathmandu-streets-${Date.now()}.${(Rec.rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);
    };
    Rec.rec.start(1000); Rec.on = true; Rec.t0 = KS.clock; $('recDot').hidden = false; $('btnRec').classList.add('on');
    Game.notify('⏺ Recording. Press K or the REC button again to stop.');
  };
  Rec.photo = () => { Rec.wantPhoto = true; };
  function takePhoto() {
    Rec.wantPhoto = false; A.shutter(); flash('photo');
    $('scene').toBlob((b) => { if (b) showMedia(URL.createObjectURL(b), 'img', `kathmandu-streets-${Date.now()}.png`); }, 'image/png');
  }
  function showMedia(url, kind, name) {
    const box = $('mediaBox'); box.hidden = false;
    $('mediaView').innerHTML = kind === 'video' ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="Screenshot from Kathmandu Streets">`;
    const a = $('mediaSave'); a.href = url; a.download = name;
    $('mediaTitle').textContent = kind === 'video' ? 'Your recording' : 'Your photo';
  }

  /* ======================= minimap & map ======================= */
  const B = KS.BOUNDS, MAP = { px: 0.5, W: (B.x1 - B.x0) * 0.5, H: (B.z1 - B.z0) * 0.5 };
  const mx = (x) => (x - B.x0) * MAP.px, mz = (z) => (z - B.z0) * MAP.px;
  function buildMapCanvas() {
    const c = document.createElement('canvas'); c.width = MAP.W; c.height = MAP.H; const g = c.getContext('2d');
    const gr = g.createRadialGradient(mx(0), mz(0), 200, mx(0), mz(0), MAP.W * 0.6);
    gr.addColorStop(0, '#c9cfa0'); gr.addColorStop(0.5, '#9fb27a'); gr.addColorStop(1, '#5f7a4a'); g.fillStyle = gr; g.fillRect(0, 0, MAP.W, MAP.H);
    g.fillStyle = '#a9b97a'; g.beginPath(); g.ellipse(mx(KS.HW.village.x), mz(KS.HW.village.z), 300 * MAP.px, 330 * MAP.px, 0, 0, 7); g.fill();
    g.fillStyle = '#7f9a5a'; g.beginPath(); g.arc(mx(KS.SWAYAMBHU.x), mz(KS.SWAYAMBHU.z), 150 * MAP.px, 0, 7); g.fill();
    g.fillStyle = '#e3dccd'; g.fillRect(mx(-560), mz(-560), 1120 * MAP.px, 1120 * MAP.px);
    const col = { city: '#cfc5b3', thamel: '#e2b796', old: '#d6a88c', ason: '#d6a88c', newroad: '#cbbdab', park: '#9cc77a', balaju: '#9cc77a', shankha: '#9cc77a', garden: '#9cc77a', tundikhel: '#a9d17f', tundikhel2: '#a9d17f', palace: '#e9c9b4', singha: '#b9d79a', stadium: '#b3d58a', durbar: '#d98f6f', durbar2: '#d98f6f', boudha: '#efe6d6', pashupati: '#e6c66a', ranipokhari: '#9cc77a', dharahara: '#ddd5c6', hospital: '#f0d6d6' };
    for (let c2 = 0; c2 < G.N; c2++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c2, r); if (t === 'river') continue; const R = KS.World.blockRect(c2, r);
      g.fillStyle = col[t] || '#cfc5b3'; g.fillRect(mx(R.x0), mz(R.z0), (R.x1 - R.x0) * MAP.px, (R.z1 - R.z0) * MAP.px);
    }
    g.fillStyle = '#6fa3c4'; g.fillRect(0, mz(KS.RIVER.z0), MAP.W, (KS.RIVER.z1 - KS.RIVER.z0) * MAP.px);
    g.fillStyle = '#5a8fb3'; g.fillRect(mx(22), mz(-156), 46 * MAP.px, 46 * MAP.px);
    g.fillStyle = '#8e8e94'; g.fillRect(mx(719), mz(-380), 32 * MAP.px, 760 * MAP.px); g.fillRect(mx(610), mz(-90), 60 * MAP.px, 220 * MAP.px);
    for (let i = 0; i <= G.N; i++) {
      const ring = i === 0 || i === G.N, w = G.roadHalf(i) * 2 * MAP.px;
      g.fillStyle = ring ? '#f3d27a' : '#fbfaf4';
      g.fillRect(mx(G.line(i)) - w / 2, mz(-551), w, 1102 * MAP.px); g.fillRect(mx(-551), mz(G.line(i)) - w / 2, 1102 * MAP.px, w);
    }
    g.fillStyle = '#fbfaf4'; g.fillRect(mx(KS.SWAYAMBHU.x + 20), mz(-96), (-540 - KS.SWAYAMBHU.x - 20) * MAP.px, 12 * MAP.px); g.fillRect(mx(540), mz(-7), 80 * MAP.px, 14 * MAP.px);
    // Nagdhunga highway and tunnel
    g.fillStyle = '#f3d27a'; g.fillRect(mx(KS.HW.x1), mz(KS.HW.z - 7), (KS.HW.x0 - KS.HW.x1) * MAP.px, 14 * MAP.px);
    g.fillStyle = '#5a5a5a'; g.fillRect(mx(KS.HW.pW), mz(KS.HW.z - 9), (KS.HW.pE - KS.HW.pW) * MAP.px, 18 * MAP.px);
    g.setLineDash([6, 5]); g.strokeStyle = '#f3d27a'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx(KS.HW.pW), mz(KS.HW.z)); g.lineTo(mx(KS.HW.pE), mz(KS.HW.z)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#d98f6f'; g.fillRect(mx(-176), mz(4), 82 * MAP.px, 172 * MAP.px);
    g.fillStyle = '#e6c66a'; g.fillRect(mx(368), mz(368), 74 * MAP.px, 90 * MAP.px);
    for (const s of KS.signals) { g.fillStyle = '#c8102e'; g.beginPath(); g.arc(mx(s.x), mz(s.z), 2.5, 0, 7); g.fill(); }
    for (const c3 of KS.speedCams) { g.fillStyle = '#1d4fb8'; g.fillRect(mx(c3.x) - 2.5, mz(c3.z) - 2.5, 5, 5); }
    return c;
  }
  let mapC, mini, miniG, big, bigG;
  function drawRoute(g, sx, sz, scale, w) {
    const r = Game.route; if (!r || r.length < 2) return;
    g.strokeStyle = 'rgba(29,110,255,0.92)'; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
    r.forEach(([x, z], i) => { const X = sx(x), Z = sz(z); if (i) g.lineTo(X, Z); else g.moveTo(X, Z); }); g.stroke();
  }
  function drawMini() {
    const PL = KS.Player, S = mini.width, R = S / 2, zoom = PL.vehicle ? 0.8 : 1.25;
    const g = miniG; g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
    g.fillStyle = '#5f7a4a'; g.fillRect(0, 0, S, S);
    const yaw = KS.Cam.yaw, th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    g.translate(R, R); g.rotate(th); g.scale(zoom, zoom);
    g.drawImage(mapC, -mx(PL.x), -mz(PL.z));
    const lx = (x) => (x - PL.x) * MAP.px, lz = (z) => (z - PL.z) * MAP.px;
    drawRoute(g, lx, lz, 1, 4 / zoom);
    const dot = (x, z, r, c, stroke) => { g.beginPath(); g.arc(lx(x), lz(z), r / zoom, 0, 7); g.fillStyle = c; g.fill(); if (stroke) { g.lineWidth = 2 / zoom; g.strokeStyle = stroke; g.stroke(); } };
    for (const l of KS.landmarks) dot(l.x, l.z, 4, Game.found.has(l.id) ? '#c8102e' : '#ffffff', '#7a1414');
    for (const v of KS.Traffic.list) if ((v.kind === 'police' || v.kind === 'ambulance') && Math.hypot(v.x - PL.x, v.z - PL.z) < 260) dot(v.x, v.z, 2.6, v.kind === 'police' ? '#1d4fb8' : '#ffffff', '#c8102e');
    if (KS.Shop.delivered && KS.Shop.delivered !== PL.vehicle) dot(KS.Shop.delivered.x, KS.Shop.delivered.z, 4, '#0f8a7a', '#fff');
    if (momoShop.visible) dot(MOMO.x, MOMO.z, 5, '#f2a516', '#5a3a00');
    if (target.visible) dot(target.position.x, target.position.z, 5.5, '#ffd21f', '#111');
    if (waypoint.visible) dot(waypoint.position.x, waypoint.position.z, 5, '#e23a8a', '#fff');
    g.restore();
    const tgt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
    if (tgt) {
      const dx = (tgt.x - PL.x) * MAP.px * zoom, dz = (tgt.z - PL.z) * MAP.px * zoom;
      const rx = dx * Math.cos(th) - dz * Math.sin(th), rz = dx * Math.sin(th) + dz * Math.cos(th), d = Math.hypot(rx, rz);
      if (d > R - 8) { const a = Math.atan2(rz, rx); g.save(); g.translate(R + Math.cos(a) * (R - 10), R + Math.sin(a) * (R - 10)); g.rotate(a); g.fillStyle = target.visible ? '#ffd21f' : '#e23a8a'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.fill(); g.restore(); }
    }
    const ph = PL.vehicle ? PL.vehicle.h : PL.h, ax = Math.sin(ph), az = Math.cos(ph);
    const pa = Math.atan2(ax * Math.sin(th) + az * Math.cos(th), ax * Math.cos(th) - az * Math.sin(th));
    g.save(); g.translate(R, R); g.rotate(pa); g.fillStyle = '#fff'; g.strokeStyle = '#c8102e'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    const na = th - Math.PI / 2; g.font = '700 12px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11), 8, 0, 7); g.fillStyle = '#7a1414'; g.fill(); g.fillStyle = '#fff'; g.fillText('N', R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11) + 1);
  }
  function drawBig() {
    const k = devicePixelRatio || 1, W = (big.width = big.clientWidth * k), H = (big.height = big.clientHeight * k), g = bigG;
    const scale = Math.min(W / MAP.W, H / MAP.H) * 0.98, ox = (W - MAP.W * scale) / 2, oz = (H - MAP.H * scale) / 2;
    const wx = (x) => ox + mx(x) * scale, wz = (z) => oz + mz(z) * scale;
    big._map = { scale, ox, oz };
    g.fillStyle = '#2c3a28'; g.fillRect(0, 0, W, H); g.drawImage(mapC, ox, oz, MAP.W * scale, MAP.H * scale);
    drawRoute(g, wx, wz, scale, 4 * k);
    g.font = `600 ${Math.round(12 * k)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center';
    for (const l of KS.landmarks) {
      g.beginPath(); g.arc(wx(l.x), wz(l.z), 5 * k, 0, 7); g.fillStyle = Game.found.has(l.id) ? '#c8102e' : '#fff'; g.fill(); g.strokeStyle = '#7a1414'; g.lineWidth = 2; g.stroke();
      if (l.minor) continue;
      g.fillStyle = 'rgba(20,14,10,0.75)'; const tw = g.measureText(l.name).width + 10; g.fillRect(wx(l.x) - tw / 2, wz(l.z) - 27 * k, tw, 17 * k);
      g.fillStyle = '#fff'; g.fillText(l.name, wx(l.x), wz(l.z) - 15 * k);
    }
    const PL = KS.Player; g.beginPath(); g.arc(wx(PL.x), wz(PL.z), 7 * k, 0, 7); g.fillStyle = '#ffd21f'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
    for (const [m, c] of [[target, '#ffd21f'], [waypoint, '#e23a8a']]) if (m.visible) { g.beginPath(); g.arc(wx(m.position.x), wz(m.position.z), 7 * k, 0, 7); g.fillStyle = c; g.fill(); }
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
    await step('Digging the Nagdhunga tunnel, planting rice terraces…');
    KS.Weather.init(scene, renderer);
    KS.Player.init(scene);
    await step('Waking up the city: pilgrims, porters, cows…');
    KS.Peds.init(scene, KS.quality.peds, KS.Player.x, KS.Player.z);
    KS.Animals.init(scene);
    await step('Starting the traffic lights (and the honking)…');
    KS.Traffic.init(scene, KS.quality.cars, KS.Player.x, KS.Player.z);
    KS.Traffic.park('scooter', -124, -263.4, Math.PI / 2, { owned: true }).ownedId = 'sathi';
    KS.Shop.delivered = KS.Traffic.list[KS.Traffic.list.length - 1]; KS.Shop.delivered.up = D.garage[0].up; KS.Shop.delivered.horn = D.garage[0].horn;
    KS.Traffic.park('taxi', 6.6, -36, Math.PI); KS.Traffic.park('bus', 6.9, -56, Math.PI); KS.Traffic.park('tempo', -88.6, 60, 0); KS.Traffic.park('pickup', -528, 104, 0);
    KS.Input.init(canvas);
    target = makeMarker(0xffd21f); scene.add(target);
    momoShop = makeMarker(0xf2a516); momoShop.position.set(MOMO.x, 0.22, MOMO.z); momoShop.visible = true; scene.add(momoShop);
    waypoint = makeMarker(0xe23a8a); scene.add(waypoint);
    mapC = buildMapCanvas(); mini = $('minimap'); miniG = mini.getContext('2d'); big = $('bigmap'); bigG = big.getContext('2d');
    big.addEventListener('click', (e) => {
      const r = big.getBoundingClientRect(), k = devicePixelRatio || 1, m = big._map;
      const x = ((e.clientX - r.left) * k - m.ox) / m.scale / MAP.px + B.x0, z = ((e.clientY - r.top) * k - m.oz) / m.scale / MAP.px + B.z0;
      waypoint.position.set(x, KS.heightAt(x, z) + 0.05, z); waypoint.visible = true; if (!target.visible) Game.routeT = 0; Game.notify('📍 Waypoint set. Follow the blue GPS line.'); drawBig();
    });
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && KS.state === 'play') pause(true); });
    KS.Radio.onchange = () => { if (KS.state === 'pause') renderRadio(); };
    $('loading').hidden = true; $('title').hidden = false;
    buildMenu(); KS.Uthao.render();
    requestAnimationFrame(frame);
    window.__ks = { ready: true, buildings: KS.buildingCount, trees: KS.treeCount, vehicles: KS.Traffic.list.length, peds: KS.Peds.list.length };
  };

  function pause(on) {
    if (on && KS.state === 'play') { KS.state = 'pause'; $('menu').hidden = false; Game.refreshMenu(); if (document.exitPointerLock) document.exitPointerLock(); }
    else if (!on && KS.state === 'pause') { KS.state = 'play'; $('menu').hidden = true; }
  }
  Game.pause = pause;
  Game.openTab = (tab) => { pause(true); document.querySelectorAll('[data-tab-btn]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tabBtn === tab))); document.querySelectorAll('[data-tab-panel]').forEach((p) => (p.hidden = p.dataset.tabPanel !== tab)); Game.refreshMenu(); };
  function buildMenu() {
    const wx = $('wxbtns');
    for (const k of KS.Weather.ORDER) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.wx = k; const t = KS.Weather.TYPES[k]; b.innerHTML = `<span>${t.icon}</span>${t.name}`; b.onclick = () => { KS.Weather.auto = false; KS.Weather.set(k); Game.refreshMenu(); }; wx.appendChild(b); }
    const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'chip'; ab.dataset.wx = 'auto'; ab.innerHTML = '<span>↻</span>Changing'; ab.onclick = () => { KS.Weather.auto = true; Game.refreshMenu(); }; wx.appendChild(ab);
    const cams = $('cambtns'); KS.CAMS.forEach((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cam = i; b.textContent = n; b.onclick = () => { KS.Player.setCam(i); Game.refreshMenu(); }; cams.appendChild(b); });
    $('timeRange').addEventListener('input', (e) => { KS.time = +e.target.value; Game.refreshMenu(); });
    $('btnResume').onclick = () => pause(false);
    $('btnSound').onclick = () => { A.setOn(!A.on); Game.save(); Game.refreshMenu(); };
    $('btnQuality').onclick = () => { KS.quality.level = KS.quality.level === 'high' ? 'low' : 'high'; Game.save(); $('qnote').hidden = false; Game.refreshMenu(); };
    $('btnReset').onclick = () => { if ($('btnReset').dataset.armed) { try { localStorage.removeItem('ks-save2'); localStorage.removeItem('ks-save'); } catch (e) { /* ignore */ } location.reload(); } else { $('btnReset').dataset.armed = '1'; $('btnReset').textContent = 'Tap again to erase progress'; } };
    $('btnPlay').onclick = () => { A.init(); KS.Radio.load(); KS.state = 'play'; $('title').hidden = true; $('hud').hidden = false; if (coarse) $('touch').hidden = false; Game.notify('Namaste! Your scooter is parked beside you (<b>E</b>). Press <b>U</b> to go online as an Uthao driver.'); };
    $('btnMenu').onclick = () => pause(true);
    $('btnRec').onclick = () => Rec.toggle(); $('btnPhoto').onclick = () => Rec.photo();
    $('btnPhone').onclick = () => KS.Uthao.toggle(); $('btnGarage').onclick = () => Game.openTab('garage');
    $('mediaClose').onclick = () => ($('mediaBox').hidden = true);
    document.querySelectorAll('[data-tab-btn]').forEach((b) => (b.onclick = () => Game.openTab(b.dataset.tabBtn)));
    $('radioOff').onclick = () => { KS.Radio.stop(); renderRadio(); };
    $('radioRetry').onclick = () => { KS.Radio.status = 'idle'; KS.Radio.load(); renderRadio(); };
  }
  function renderRadio() {
    const R = KS.Radio, el = $('radioList'); el.innerHTML = '';
    $('radioStatus').textContent = R.status === 'loading' ? 'Finding live stations in Nepal…' : R.status === 'ready' ? `${R.stations.length} live stations from Nepal, via the Radio Browser open directory.` : R.status === 'offline' ? 'Live stations are unavailable right now (offline or blocked). The built-in stations still play.' : 'Live stations load when you start.';
    R.all().forEach((st, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'stn' + (R.idx === i ? ' on' : '');
      b.innerHTML = `<b>${st.live ? '🔴 ' : '🎵 '}${st.name.replace(/</g, '&lt;')}</b><small>${(st.live ? [st.city, st.tags].filter(Boolean).join(' · ') : st.genre + ' · made in-game').replace(/</g, '&lt;')}</small>`;
      b.onclick = () => { A.init(); R.play(i); renderRadio(); Game.notify(KS.Player.vehicle ? `📻 ${st.name}` : `📻 ${st.name} will play when you are in a vehicle.`); };
      el.appendChild(b);
    });
  }
  Game.refreshMenu = () => {
    document.querySelectorAll('[data-wx]').forEach((b) => b.classList.toggle('on', b.dataset.wx === 'auto' ? KS.Weather.auto : !KS.Weather.auto && b.dataset.wx === KS.Weather.type));
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('on', +b.dataset.cam === KS.Cam.mode));
    $('timeRange').value = KS.time.toFixed(1); $('timeVal').textContent = fmtTime(KS.time);
    $('btnSound').textContent = A.on ? 'Sound: on' : 'Sound: off';
    $('btnQuality').textContent = 'Graphics: ' + KS.quality.level;
    const list = $('lmlist'); list.innerHTML = '';
    for (const l of KS.landmarks) { const li = document.createElement('li'); li.className = Game.found.has(l.id) ? 'found' : ''; li.innerHTML = `<b>${l.name}</b><span lang="ne">${l.np}</span>`; list.appendChild(li); }
    $('lmcount').textContent = `${Game.found.size} / ${KS.landmarks.length}`;
    $('walletCash').textContent = 'रु ' + Math.round(D.cash).toLocaleString('en-IN'); $('walletTok').textContent = D.tokens + ' 🪙';
    KS.Shop.renderGarage($('garageList')); KS.Shop.renderWardrobe($('wardrobeList')); renderRadio();
    const s = D.uthao; $('uthaoStats').textContent = `Rating ★ ${KS.Uthao.rating().toFixed(2)} · ${s.trips} trips · रु ${s.earned.toLocaleString('en-IN')} earned`;
    $('btnUthao').textContent = KS.Uthao.online ? 'Go offline' : 'Go online';
  };
  $('btnUthao') && ($('btnUthao').onclick = () => { KS.Uthao.toggle(); Game.refreshMenu(); });
  const fmtTime = (t) => { const h = Math.floor(t), m = Math.floor((t - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  /* ======================= main loop ======================= */
  const clock = new T.Clock();
  let hudT = 0, miniT = 0, lmT = 0, umbT = 0, lastDistrict = '', titleA = 0;
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
      if (I.hit('KeyT')) { if (I.down('ShiftLeft') || I.down('ShiftRight')) { KS.time = (KS.time + 3) % 24; Game.notify('Skipped 3 hours → ' + fmtTime(KS.time)); } else { KS.Weather.auto = false; KS.Weather.next(); Game.notify(`Weather: <b>${KS.Weather.TYPES[KS.Weather.type].name}</b>`); } }
      if (I.hit('KeyR') || I.hit('KeyRadio')) { A.init(); const st = KS.Radio.next(I.down('ShiftLeft') ? -1 : 1); Game.notify(st ? `📻 <b>${st.name}</b>${PL.vehicle ? '' : ' <span>(plays in vehicles)</span>'}` : '📻 Radio off'); }
      if (I.hit('KeyU') || I.hit('KeyPhone')) KS.Uthao.toggle();
      if (I.hit('KeyK')) Rec.toggle();
      if (I.hit('KeyJ')) Rec.photo();
      if (I.hit('KeyH') || I.hit('KeyHorn')) {
        if (PL.vehicle) { const h = PL.vehicle.horn; A.horn(h && h !== 'standard' ? h : PL.vehicle.kind, 1); Game.honk = 0.4; }
        else { KS.say(PL.person.root, KS.pick(['Oi dai!', 'Namaste!', 'Eh sathi!']), 1.4); Game.honk = 0.4; }
      }
      PL.update(dt);
    }
    Game.honk = Math.max(0, (Game.honk || 0) - dt);
    KS.Weather.update(dt, camera, { focus: tmpV.set(PL.x, PL.y, PL.z) });
    const ctx = { px: PL.x, pz: PL.z, cx: camera.position.x, cz: camera.position.z, night: KS.night, rain: KS.Weather.wet > 0.3, playerVehicle: PL.vehicle, player: { x: PL.x, z: PL.z, len: PL.len, wid: PL.wid } };
    KS.Traffic.update(dt, ctx);
    KS.Peds.update(dt, ctx);
    KS.Animals.update(dt, { px: PL.x, pz: PL.z, playerSpeed: Math.abs(PL.speed), honk: Game.honk > 0.35, inVehicle: !!PL.vehicle, vehicleKind: PL.vehicle && (KS.isBike(PL.vehicle.kind) ? 'bike' : 'car'), night: KS.night });
    for (const u of KS.timeUniforms) u.value = KS.clock;
    if (KS.waterTex) KS.waterTex.offset.x = (KS.clock * 0.004) % 1;
    for (const h of KS.clockHands) h.hand.rotation.z = h.k === 'h' ? -((KS.time % 12) / 12) * Math.PI * 2 : -(KS.time % 1) * Math.PI * 2;
    const fp = KS.flyingPlane; if (fp) {
      const cyc = KS.clock % 150, rx = KS.runwayX;
      if (cyc < 12) { fp.visible = true; fp.position.set(rx, 2.6, 360); fp.rotation.set(0, Math.PI, 0); }
      else if (cyc < 45) { const t = cyc - 12, z = 360 - 1.4 * t * t, lift = Math.max(0, -z) * 0.16; fp.position.set(rx, 2.6 + lift, z); fp.rotation.set(-Math.min(0.2, lift * 0.004), Math.PI, 0); fp.visible = z > -2600; }
      else if (cyc < 95) fp.visible = false;
      else if (cyc < 130) { const t = (cyc - 95) / 35; fp.visible = true; fp.position.set(rx, KS.lerp(260, 2.6, Math.min(1, t * 1.02)), KS.lerp(2600, 360, t)); fp.rotation.set(0.05, Math.PI, 0); }
      else { const t = cyc - 130; fp.position.set(rx, 2.6, Math.max(-380, 360 - (60 * t - 1.5 * t * t))); fp.rotation.set(0, Math.PI, 0); }
    }
    if (play) {
      missionUpdate(dt); KS.Uthao.update(dt); violations(dt);
      lmT -= dt;
      if (lmT <= 0) {
        lmT = 0.4;
        for (const l of KS.landmarks) if (!Game.found.has(l.id) && Math.hypot(l.x - PL.x, l.z - PL.z) < l.r) {
          Game.found.add(l.id); showCard(l); Game.pay(500, 'Discovered ' + l.name); Game.giveTokens(1, 'New place'); Game.karma(+1, 'Visited ' + l.name);
          if (Game.found.size === KS.landmarks.length) Game.notify('🏆 You have seen every corner of the valley!', 'good');
        }
        for (const [x, z] of KS.bells) { const d = Math.hypot(x - PL.x, z - PL.z); if (d < 30 && KS.chance(0.03)) A.bell(0.4 * (1 - d / 30)); }
      }
      // GPS route refresh
      Game.routeT = (Game.routeT || 0) - dt;
      const gt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
      if (gt && Game.routeT <= 0) { Game.routeT = 1.5; Game.route = KS.Traffic.route(PL.x, PL.z, gt.x, gt.z); } else if (!gt) Game.route = null;
      umbT -= dt;
      if (umbT <= 0) {
        umbT = 0.6; const wet = KS.Weather.wet > 0.3;
        for (const p of KS.Peds.list) {
          if (!p.p.root.visible || p.mode === 'police' || p.kind === 'monk') continue;
          if (wet && !p.umb && KS.chance(0.7) && p.mode !== 'sit') { p.umb = new T.Mesh(umbGeo, KS.pick(umbMats)); const stick = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 1, 4), umbMats[0]); stick.position.y = -0.5; p.umb.add(stick); p.umb.position.set(0.25, 2.25, 0.1); p.p.root.add(p.umb); }
          if (p.umb) { p.umb.visible = wet; p.p.busyArm = wet && !p.fight; if (wet) p.p.armR.rotation.x = -2.6; }
        }
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHUD(); }
      miniT -= dt; if (miniT <= 0) { miniT = 1 / 20; drawMini(); }
      for (const m of [target, momoShop, waypoint]) if (m.visible) { m.userData.arrow.position.y = 4 + Math.sin(KS.clock * 3) * 0.5; m.userData.arrow.rotation.y += dt * 2; }
      if (waypoint.visible && Math.hypot(waypoint.position.x - PL.x, waypoint.position.z - PL.z) < 8) { waypoint.visible = false; Game.notify('Waypoint reached.'); }
      PL.updateCamera(camera, dt);
      let crowd = 0; KS.Peds.forEachNear(PL.x, PL.z, 22, () => crowd++);
      let sir = 0; for (const v of KS.Traffic.list) if (v.kind === 'ambulance' && v.ai) sir = Math.max(sir, 1 - Math.hypot(v.x - PL.x, v.z - PL.z) / 160);
      A.update(dt, { density: Math.min(1, KS.Traffic.nearCount(PL.x, PL.z, 60) / 10), crowd, siren: sir, rain: KS.Weather.wet, wind: KS.Weather.cur.wind, speed: Math.abs(PL.speed), vehicle: PL.vehicle, throttle: PL.vehicle ? PL.throttle || 0 : 0 });
    } else {
      titleA += dt * 0.05;
      camera.position.set(-120 + Math.cos(titleA) * 170, 70 + Math.sin(titleA * 0.7) * 10, -120 + Math.sin(titleA) * 170);
      camera.lookAt(-110, 8, -80);
    }
    KS.updateBubbles(dt, camera, innerWidth, innerHeight);
    renderer.render(scene, camera);
    if (Rec.wantPhoto) takePhoto();
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
    $('money').textContent = 'रु ' + Math.round(D.cash).toLocaleString('en-IN'); $('tokens').textContent = D.tokens + ' 🪙';
    $('karma').style.setProperty('--k', D.karma + '%'); $('karmaV').textContent = Math.round(D.karma);
    $('health').style.setProperty('--h', Math.max(0, PL.health) + '%');
    if (PL.vehicle) {
      const kmh = Math.round(Math.abs(PL.vehicle.speed) * 3.6), lim = KS.speedLimit(PL.x, PL.z);
      $('kmh').textContent = kmh; $('limit').textContent = lim; $('limit').classList.toggle('over', kmh > lim + 2);
      const st = KS.Radio.current(); $('radio').textContent = st ? '📻 ' + st.name : '📻 off (R)';
      $('nitro').hidden = !(PL.vehicle.up && PL.vehicle.up.nitro); $('nitro').textContent = PL.nitro > 0 ? '🔥 NITRO' : PL.nitroCool > 0 ? `Nitro ${Math.ceil(PL.nitroCool)}s` : 'Nitro ready (B)';
    }
    if (Rec.on) $('recTime').textContent = Math.floor((KS.clock - Rec.t0) / 60) + ':' + String(Math.floor((KS.clock - Rec.t0) % 60)).padStart(2, '0');
    let prompt = '';
    if (promptT > 0) { promptT -= 0.2; prompt = promptOverride; }
    else if (!PL.vehicle) {
      const v = KS.Traffic.nearest(PL.x, PL.z, 3.6);
      if (v) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ${v.owned ? 'Ride your' : v.ai ? 'Take the' : 'Ride the'} ${v.type.name.toLowerCase()}`;
      else if (KS.prayerWheels.some(([x, z]) => Math.hypot(x - PL.x, z - PL.z) < 2.4)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Spin the prayer wheel`;
      else if (PL.swim) prompt = 'Swimming in the Bagmati… head for the bank!';
      else if (Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 12 && !Game.mission) prompt = 'Step into the orange beam: <b>Momo House</b> delivery job';
    } else if (KS.Uthao.trip && Math.hypot(PL.x - (KS.Uthao.trip.stage === 'pickup' ? KS.Uthao.trip.from.x : KS.Uthao.trip.to.x), PL.z - (KS.Uthao.trip.stage === 'pickup' ? KS.Uthao.trip.from.z : KS.Uthao.trip.to.z)) < 25) prompt = KS.Uthao.trip.stage === 'pickup' ? 'Stop next to the yellow marker to pick up' : 'Stop at the yellow marker to drop off';
    $('prompt').innerHTML = prompt; $('prompt').hidden = !prompt;
    const m = Game.mission, mp = $('mission');
    if (m) {
      mp.hidden = false; $('mTitle').textContent = m.title; $('mObj').textContent = `Deliver to ${m.area}`;
      $('mMeta').textContent = `${Math.round(Math.hypot(PL.x - m.x, PL.z - m.z))} m · ${Math.max(0, Math.floor(m.t / 60))}:${String(Math.max(0, Math.floor(m.t % 60))).padStart(2, '0')}`;
      mp.classList.toggle('urgent', m.t < 20);
    } else mp.hidden = true;
    KS.Uthao.tick();
    const yaw = ((KS.Cam.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    $('himal').hidden = !(Math.abs(yaw - Math.PI) < 0.6 && KS.Weather.cur.mtn > 0.5 && KS.day > 0.3);
    $('camName').textContent = '🎥 ' + KS.CAMS[KS.Cam.mode];
  }

  addEventListener('load', () => { Game.start().catch((e) => { $('loadmsg').textContent = 'Could not start 3D: ' + e.message; console.error(e); }); });
})();
