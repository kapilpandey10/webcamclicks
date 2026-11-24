/* Kathmandu Streets — the sky drop (a plane crosses the valley, you jump, free-fall and open a parachute)
   and Battle mode: an open-world shooter with loot, guns, grenades, time bombs, a shrinking safe zone,
   computer opponents when you play alone, and player-versus-player in a multiplayer room. No police in Battle mode. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  /* ======================= the sky drop ======================= */
  const Drop = (KS.Drop = { phase: null });
  const PLANE_ALT = 330; // the drop plane flies at this height and never climbs above it
  const PLANE_LEN = 26; // the real turboprop, scaled to the old plane's size
  let plane, chute, scene;
  /** the real aeroplane: a turboprop commuter by vinish.dev (CC BY 4.0),
      scaled to 26 m long and facing +Z like the old one, with its two
      propellers kept as named pivots so they can still spin. One shared
      load, cloned when a drop starts. */
  Drop.loadModel = () => {
    if (Drop._loading) return Drop._loading;
    Drop._loading = new Promise((resolve) => {
      const done = (m) => { Drop._model = m || null; resolve(Drop._model); };
      if (typeof THREE.GLTFLoader !== 'function') return done(null);
      new THREE.GLTFLoader().load('js/games/kathmandu/models/turboprop-commuter.glb', (g) => {
        const inner = g.scene, box = new T.Box3().setFromObject(inner), size = new T.Vector3();
        box.getSize(size);
        inner.scale.setScalar(PLANE_LEN / Math.max(1, size.z)); // length runs along Z (nose +Z)
        const c = new T.Box3().setFromObject(inner).getCenter(new T.Vector3());
        inner.position.x -= c.x; inner.position.z -= c.z;
        inner.position.y -= new T.Box3().setFromObject(inner).min.y;
        const root = new T.Group(); root.add(inner);
        const props = [];
        root.traverse((o) => { if (/^propeller/i.test(o.name)) props.push(o.name); });
        done({ root, props });
      }, undefined, () => done(null));
    });
    return Drop._loading;
  };
  function buildChute() {
    const g = new T.Group(), cols = [0xc8102e, 0xffffff, 0x1d3a8a, 0xffffff];
    for (let k = 0; k < 8; k++) {
      const seg = new T.Mesh(new T.SphereGeometry(3.4, 6, 6, (k / 8) * Math.PI * 2, Math.PI / 4, 0, Math.PI / 2.6), new T.MeshLambertMaterial({ color: cols[k % 4], side: T.DoubleSide }));
      seg.scale.set(1, 0.55, 1.25); g.add(seg);
    }
    const pts = []; for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; pts.push(Math.cos(a) * 3, 0.6, Math.sin(a) * 3.9, 0, -3.6, 0); }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(pts, 3));
    g.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x444444 })));
    g.visible = false; return g;
  }
  Drop.init = (sc) => {
    scene = sc; chute = buildChute(); scene.add(chute);
    Drop.loadModel().then((m) => {
      if (!m || plane) return;
      plane = m.root.clone(true); plane.visible = false; scene.add(plane);
      KS.plProps = m.props.map((n) => plane.getObjectByName(n)).filter(Boolean);
    });
  };
  Drop.active = () => !!Drop.phase;
  /** start a drop. opts.path = [x0,z0,x1,z1] (shared in a match), opts.onLand */
  Drop.begin = (opts = {}) => {
    const PL = KS.Player; if (PL.vehicle) { PL.vehicle.speed = 0; PL.exit(); if (PL.vehicle) return false; }
    if (PL.boat) { PL.boat.nearJetty = true; PL.leaveBoat(); }
    if (!plane) { // the real plane is still downloading: warm it up, then start
      KS.Game && KS.Game.notify('✈️ Warming up the plane…');
      Drop.loadModel().then((m) => { if (m) Drop.begin(opts); else KS.Game && KS.Game.notify('✈️ The plane could not load — check the connection and reload.'); });
      return true;
    }
    let path = opts.path;
    /* the flight stays inside the map: it crosses the city and never the
       void beyond it, and it never climbs above PLANE_ALT. */
    if (!path) { const a = Math.random() * Math.PI * 2, off = (Math.random() - 0.5) * 300; const cx = -Math.sin(a) * off, cz = Math.cos(a) * off, R = 650; path = [cx - Math.cos(a) * R, cz - Math.sin(a) * R, cx + Math.cos(a) * R, cz + Math.sin(a) * R]; }
    Drop.path = path; Drop.t = 0; Drop.len = Math.hypot(path[2] - path[0], path[3] - path[1]); Drop.onLand = opts.onLand; Drop.phase = 'plane';
    plane.visible = true; PL.mode = 'plane'; PL.person.root.visible = false; PL.vy = 0; PL.speed = 0;
    KS.Cam.want = 30; KS.Cam.pitch = 0.35; KS.Cam.yaw = Math.atan2(path[2] - path[0], path[3] - path[1]);
    KS.audio && KS.audio.planeHum(1);
    $('dropHud').hidden = false;
    return true;
  };
  function jump() {
    const PL = KS.Player; Drop.phase = 'fall'; PL.mode = 'fall';
    PL.person.root.visible = true; PL.vy = 0; Drop.vx = Math.sin(Drop.h0) * 12; Drop.vz = Math.cos(Drop.h0) * 12; Drop.fallT = 0;
    KS.Cam.want = 9; KS.audio && KS.audio.whiz(1.5);
  }
  function openChute() { const PL = KS.Player; Drop.phase = 'chute'; PL.mode = 'chute'; chute.visible = true; chute.scale.set(0.2, 0.2, 0.2); KS.audio && KS.audio.chute(); KS.Cam.want = 11; }
  function land() {
    const PL = KS.Player, p = PL.person; Drop.phase = null; PL.mode = 'foot'; chute.visible = false; plane.visible = false;
    p.inner.rotation.set(0, 0, 0); p.armL.rotation.set(0, 0, 0); p.armR.rotation.set(0, 0, 0); p.legL.rotation.x = p.legR.rotation.x = 0; p.busyArm = false;
    PL.vy = 0; PL.speed = 0; KS.Cam.want = 4; KS.Cam.pitch = 0.22; $('dropHud').hidden = true; KS.audio && KS.audio.planeHum(0);
    const cb = Drop.onLand; Drop.onLand = null; if (cb) cb(); else KS.Game && KS.Game.notify('🪂 Landed! Press <b>C</b> to call your bicycle or vehicle here.');
  }
  Drop.update = (dt) => {
    const PL = KS.Player, I = KS.Input, p = PL.person, path = Drop.path, hud = $('dropHud');
    // the plane keeps flying (and leaves) whatever the player does
    if (plane.visible) {
      Drop.t += dt * 70; const u = Drop.t / Drop.len, x = KS.lerp(path[0], path[2], u), z = KS.lerp(path[1], path[3], u);
      const B = KS.BOUNDS; // hard boundary: the plane can never leave the map or climb
      plane.position.set(KS.clamp(x, B.x0 + 20, B.x1 - 20), PLANE_ALT, KS.clamp(z, B.z0 + 20, B.z1 - 20)); plane.rotation.y = Drop.h0 = Math.atan2(path[2] - path[0], path[3] - path[1]);
      for (const pr of KS.plProps || []) pr.rotation.z += dt * 40;
      if (u > 1.02) { plane.visible = false; KS.audio && KS.audio.planeHum(0); }
      else if (Drop.phase !== 'plane') KS.audio && KS.audio.planeHum(Math.max(0, 1 - Math.hypot(x - PL.x, z - PL.z) / 900));
    }
    const ground = KS.groundAt(PL.x, PL.z, PL.y, 0.6), alt = Math.max(0, PL.y - ground);
    if (Drop.phase === 'plane') {
      PL.x = plane.position.x; PL.z = plane.position.z; PL.y = 326; PL.h = plane.rotation.y;
      const inCity = Math.abs(PL.x) < 650 && Math.abs(PL.z) < 650;
      hud.innerHTML = `✈️ Over ${inCity ? 'the city' : 'the valley'} · <b>${Math.round(PL.y)} m</b><br><kbd>Space</kbd> / Jump: jump out · <kbd>M</kbd>: tap the map to choose where to land`;
      if (I.hit('Space') || I.hit('KeyJump') || I.hit('KeyE') || I.hit('KeyEnter') || Drop.t / Drop.len > 0.92) jump();
      return;
    }
    // steer relative to the camera
    const a = KS.axis(), fx = Math.sin(KS.Cam.yaw), fz = Math.cos(KS.Cam.yaw);
    const mx = fx * a.y - fz * a.x, mz = fz * a.y + fx * a.x; // forward/back + strafe, as on foot
    const m = Math.hypot(mx, mz) || 1;
    if (Drop.phase === 'fall') {
      Drop.fallT += dt;
      const top = 24; Drop.vx = KS.lerp(Drop.vx, (mx / Math.max(1, m)) * top, Math.min(1, dt * 1.5)); Drop.vz = KS.lerp(Drop.vz, (mz / Math.max(1, m)) * top, Math.min(1, dt * 1.5));
      PL.vy = Math.max(-52, PL.vy - 22 * dt);
      p.inner.rotation.x = KS.lerp(p.inner.rotation.x, 1.25, dt * 3); p.busyArm = true;
      p.armL.rotation.set(0, 0, 1.2 + Math.sin(KS.clock * 9) * 0.05); p.armR.rotation.set(0, 0, -1.2 - Math.sin(KS.clock * 9) * 0.05); p.legL.rotation.x = 0.4; p.legR.rotation.x = 0.25;
      hud.innerHTML = `🪂 Free fall · <b>${Math.round(alt)} m</b> · ${Math.round(-PL.vy * 3.6)} km/h<br>Steer with <kbd>W A S D</kbd> · <kbd>Space</kbd>: open the parachute`;
      if ((Drop.fallT > 0.8 && (I.hit('Space') || I.hit('KeyJump'))) || alt < 130) openChute();
    } else {
      const top = 11; Drop.vx = KS.lerp(Drop.vx, (mx / Math.max(1, m)) * top, Math.min(1, dt * 1.2)); Drop.vz = KS.lerp(Drop.vz, (mz / Math.max(1, m)) * top, Math.min(1, dt * 1.2));
      PL.vy = KS.lerp(PL.vy, alt < 6 ? -2.5 : -6, Math.min(1, dt * 2));
      p.inner.rotation.x = KS.lerp(p.inner.rotation.x, 0, dt * 4); p.armL.rotation.set(-2.6, 0, 0.3); p.armR.rotation.set(-2.6, 0, -0.3); p.legL.rotation.x = p.legR.rotation.x = alt < 4 ? -0.3 : 0.1;
      chute.visible = true; const sc = Math.min(1, chute.scale.x + dt * 2.5); chute.scale.set(sc, sc, sc);
      chute.position.set(PL.x, PL.y + 5.6, PL.z); chute.rotation.set(-Drop.vz * 0.01, PL.h, Drop.vx * 0.01);
      hud.innerHTML = `🪂 Parachute · <b>${Math.round(alt)} m</b><br>Steer with <kbd>W A S D</kbd> towards your landing spot`;
    }
    if (Math.hypot(Drop.vx, Drop.vz) > 0.5) PL.h = KS.angLerp(PL.h, Math.atan2(Drop.vx, Drop.vz), Math.min(1, dt * 3));
    let nx = PL.x + Drop.vx * dt, nz = PL.z + Drop.vz * dt; const B = KS.BOUNDS; nx = KS.clamp(nx, B.x0 + 20, B.x1 - 20); nz = KS.clamp(nz, B.z0 + 20, B.z1 - 20);
    const c = KS.collide(nx, nz, 0.4, PL.y, 0.3); PL.x = c.x; PL.z = c.z; PL.y += PL.vy * dt; PL.speed = -PL.vy;
    p.root.position.set(PL.x, PL.y, PL.z); p.root.rotation.y = PL.h;
    const g2 = KS.groundAt(PL.x, PL.z, PL.y + 1, 2);
    if (PL.y <= g2) { PL.y = g2; if (Drop.phase === 'fall') { KS.Game && KS.Game.hurt(35); } land(); }
  };

  /* ======================= the passenger flight: buy a ticket at the
     airport, ride the turboprop yourself. Four seats: you and up to three
     fellow passengers. The plane takes off from the runway, flies a scenic
     circuit over the city and past the snow peak, and lands back at the
     airport. Press E to skip to the landing. */
  const Flight = (KS.Flight = { price: 2000, seats: 4, phase: 'parked', ticket: false });
  const FLIGHT_NAMES = ['Sita', 'Ramesh', 'Anita', 'Bikash', 'Maya', 'Suman', 'Laxmi', 'Deepak'];
  let fplane = null, fpass = [];
  Flight.counter = { x: 624, z: 20 }; // the ticket desk, outside the terminal
  Flight.parkedAt = { x: 735, z: 200 }; // the plane waits on the runway
  Flight.init = (sc) => {
    scene = sc;
    Drop.loadModel().then((m) => {
      if (!m || fplane) return;
      fplane = m.root.clone(true); fplane.visible = true; scene.add(fplane);
      fplane.position.set(Flight.parkedAt.x, 0.3, Flight.parkedAt.z); fplane.rotation.y = Math.PI; // facing north, down the runway
      KS.flightProps = m.props.map((n) => fplane.getObjectByName(n)).filter(Boolean);
    });
  };
  Flight.buyTicket = () => {
    const PL = KS.Player, D = KS.Shop.data;
    if (Flight.ticket) { KS.Game.notify('✈️ You already have a flight ticket — walk to the plane on the runway and press <b>E</b> to board.'); return; }
    if (Math.hypot(PL.x - Flight.counter.x, PL.z - Flight.counter.z) > 4) return;
    if (D.cash < Flight.price) { KS.Game.notify(`A mountain flight ticket costs रु ${Flight.price}.`, 'bad'); return; }
    D.cash -= Flight.price; KS.Game.save && KS.Game.save(); Flight.ticket = true;
    // three fellow passengers, waiting at the terminal
    fpass = [];
    for (let k = 0; k < 3; k++) {
      const kind = KS.pick(['man', 'woman', 'tourist', 'elder']), p = KS.makePerson(kind);
      p.root.position.set(Flight.counter.x + KS.r(-3, 3), 0.2, Flight.counter.z + 4 + k * 2);
      scene.add(p.root);
      fpass.push({ p, kind, name: FLIGHT_NAMES[KS.ri(0, FLIGHT_NAMES.length - 1)], seat: k + 2, boarded: false });
    }
    KS.Game.notify('✈️ Mountain flight ticket bought for रु 2,000! Walk to the plane on the runway and press <b>E</b> to board. Four seats — you and three fellow passengers.', 'good');
  };
  Flight.nearPlane = (PL) => fplane && Flight.phase === 'parked' && Math.hypot(PL.x - Flight.parkedAt.x, PL.z - Flight.parkedAt.z) < 8;
  Flight.board = () => {
    const PL = KS.Player;
    if (!Flight.ticket || !fplane || Flight.phase !== 'parked') return false;
    if (PL.vehicle) PL.exit();
    Flight.ticket = false; Flight.phase = 'takeoff'; Flight.t = 0; Flight.lastH = Math.PI;
    PL.mode = 'flight'; PL.person.root.visible = false; PL.vy = 0; PL.speed = 0;
    for (const f of fpass) { f.boarded = true; f.p.root.visible = false; } // seated inside
    // the scenic circuit: the runway, the city, the snow peak, the valley, home
    const pts = [
      new T.Vector3(735, 0.3, 200), new T.Vector3(735, 0.3, -300), new T.Vector3(600, 120, -500),
      new T.Vector3(0, 220, -600), new T.Vector3(-450, 260, -1250), new T.Vector3(-700, 240, -600),
      new T.Vector3(-800, 200, 0), new T.Vector3(-400, 180, 500), new T.Vector3(400, 150, 550),
      new T.Vector3(735, 60, 500), new T.Vector3(735, 0.3, 200),
    ];
    Flight.curve = new T.CatmullRomCurve3(pts, false, 'centripetal');
    Flight.dur = 150; // about two and a half minutes in the air
    KS.Cam.want = 26; KS.Cam.pitch = 0.3;
    $('dropHud').hidden = false; KS.audio && KS.audio.planeHum(1);
    KS.Game.notify('✈️ Welcome aboard the mountain flight! Four seats, three fellow passengers, and a view of Shivapuri. Press <b>E</b> to skip to the landing.');
    return true;
  };
  Flight.update = (dt) => {
    if (!fplane) return;
    for (const pr of KS.flightProps || []) pr.rotation.z += dt * 40;
    if (Flight.phase === 'parked') return;
    const PL = KS.Player, I = KS.Input;
    Flight.t += dt;
    if ((I.hit('KeyE') || I.hit('KeyEnter')) && Flight.t > 5) { Flight.t = Flight.dur - 8; KS.Game.notify('✈️ The pilot heads back to the airport.'); }
    const u = Math.min(1, Flight.t / Flight.dur);
    const pos = Flight.curve.getPoint(u), nxt = Flight.curve.getPoint(Math.min(1, u + 0.004));
    const h = Math.atan2(nxt.x - pos.x, nxt.z - pos.z), dh = KS.wrapAng(h - (Flight.lastH ?? h)); Flight.lastH = h;
    fplane.position.copy(pos); fplane.rotation.set(0, h, KS.clamp(dh * 8, -0.25, 0.25), 'YXZ');
    PL.x = pos.x; PL.z = pos.z; PL.y = pos.y + 2; PL.h = h;
    if (KS.clock - I.lastLook > 3) KS.Cam.yaw = KS.angLerp(KS.Cam.yaw, h, Math.min(1, dt * 0.8));
    // what you are flying over
    let near = null, nd = 300; for (const l of KS.landmarks) if (!l.minor) { const dd = Math.hypot(l.x - pos.x, l.z - pos.z); if (dd < nd) { nd = dd; near = l; } }
    const left = Math.max(0, Math.ceil(Flight.dur - Flight.t));
    const cap = `✈️ <b>Mountain Flight</b> · ${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')} left · <b>${Math.round(pos.y)} m</b><br>Seat 1A · with ${fpass.map((f) => f.name).join(', ')}${near ? `<br><b>${near.name}</b> <span lang="ne">${near.np}</span><br><small>${near.fact || ''}</small>` : '<br><small>Look around with the mouse or by dragging.</small>'}<br><small><kbd>E</kbd> skip to the landing</small>`;
    const hud = $('dropHud'); if (hud._h !== cap) { hud._h = cap; hud.innerHTML = cap; }
    KS.audio && KS.audio.planeHum(1);
    if (Flight.t >= Flight.dur) {
      // landed: back on foot at the terminal, the fellow passengers walk away
      Flight.phase = 'parked'; Flight.t = 0;
      fplane.position.set(Flight.parkedAt.x, 0.3, Flight.parkedAt.z); fplane.rotation.set(0, Math.PI, 0);
      PL.mode = 'foot'; PL.person.root.visible = true;
      PL.x = 660; PL.z = 20; PL.y = 0.3; PL.vy = 0; KS.Cam.want = 4; KS.Cam.pitch = 0.22;
      $('dropHud').hidden = true; $('dropHud')._h = ''; KS.audio && KS.audio.planeHum(0);
      for (const f of fpass) { f.p.root.visible = true; f.p.root.position.set(660 + KS.r(-4, 4), 0.2, 26 + KS.r(0, 6)); }
      setTimeout(() => { for (const f of fpass) scene.remove(f.p.root); fpass = []; }, 12000);
      KS.Game.notify('✈️ Welcome back to Tribhuvan Airport! धन्यवाद for flying with us.', 'good');
      KS.Game.giveTokens(1, 'Mountain flight');
    }
  };

  /* ======================= coins to collect on the streets and up on the roofs ======================= */
  const Coins = (KS.Coins = { list: [] });
  let coinMesh; const cd = new T.Object3D();
  Coins.init = () => {
    const save = KS.rng; KS.reseed(88);
    const lots = (KS.World.lots || []).filter((l) => Math.abs(l.x) < 540 && Math.abs(l.z) < 440);
    for (let k = 0; k < 70 && lots.length; k++) { const l = lots[Math.floor(KS.rng() * lots.length)]; const x = l.x + l.fx * 2.2, z = l.z + l.fz * 2.2; Coins.list.push({ x, z, y: KS.groundAt(x, z, 50, 60) + 0.9, v: 1 }); }
    const tall = (KS.World.tall || []).slice(); for (let k = 0; k < 45 && tall.length; k++) { const t = tall.splice(Math.floor(KS.rng() * tall.length), 1)[0]; Coins.list.push({ x: t.cx, z: t.cz, y: t.H + 0.9, v: 3, roof: true }); }
    if (KS.dharahara) Coins.list.push({ x: KS.dharahara.x, z: KS.dharahara.z + KS.dharahara.deckR - 0.8, y: KS.dharahara.deck + 0.9, v: 5 });
    KS.rng = save;
    const geo = new T.CylinderGeometry(0.32, 0.32, 0.07, 18).rotateX(Math.PI / 2);
    coinMesh = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ color: 0xf2c418, emissive: 0x6a4a00 }), Coins.list.length); coinMesh.frustumCulled = false; scene.add(coinMesh);
  };
  Coins.update = (dt) => {
    if (!coinMesh) return;
    const PL = KS.Player, r = KS.clock * 2.5, cam = KS.camera.position;
    Coins.list.forEach((c, i) => {
      if (c.taken) { c.respawn -= dt; if (c.respawn <= 0) c.taken = false; }
      const show = !c.taken && Math.abs(c.x - cam.x) + Math.abs(c.z - cam.z) < 220;
      cd.position.set(c.x, c.y + Math.sin(r + i) * 0.12, c.z); cd.rotation.set(0, r + i, 0); cd.scale.setScalar(show ? (c.v > 1 ? 1.5 : 1) : 0); cd.updateMatrix(); coinMesh.setMatrixAt(i, cd.matrix);
      if (show && Math.abs(c.x - PL.x) < 1.1 && Math.abs(c.z - PL.z) < 1.1 && Math.abs(c.y - 0.9 - PL.y) < 1.6) {
        c.taken = true; c.respawn = 240; KS.Shop.data.tokens += c.v; KS.Shop.save(); KS.audio.coin && KS.audio.coin();
        KS.Game.notify(`🪙 +${c.v} coin${c.v > 1 ? 's' : ''}${c.roof ? ' (rooftop bonus!)' : ''}`, 'good');
      }
    });
    coinMesh.instanceMatrix.needsUpdate = true;
  };

  /* ======================= Battle mode ======================= */
  const B = (KS.Battle = { on: false, slot: 0, kills: 0, alive: true, armor: 0, zone: null, match: null, bots: [], loot: [] });
  const W = {
    pistol: { name: 'Pistol', slot: 2, dmg: 20, rate: 0.28, mag: 12, ammo: 'light', range: 110, spread: 0.012, reload: 1.3 },
    smg: { name: 'SMG', slot: 1, dmg: 13, rate: 0.085, mag: 30, ammo: 'light', range: 90, spread: 0.03, reload: 1.8, auto: true },
    ak: { name: 'AK rifle', slot: 1, dmg: 24, rate: 0.12, mag: 30, ammo: 'heavy', range: 220, spread: 0.014, reload: 2.2, auto: true },
    shotgun: { name: 'Shotgun', slot: 1, dmg: 11, pellets: 8, rate: 0.85, mag: 6, ammo: 'shells', range: 35, spread: 0.07, reload: 2.6 },
    sniper: { name: 'Sniper rifle', slot: 1, dmg: 90, rate: 1.4, mag: 5, ammo: 'sniper', range: 500, spread: 0.002, reload: 2.8, zoom: 18 },
  };
  B.W = W;
  const LOOT = [['pistol', 12], ['smg', 11], ['ak', 10], ['shotgun', 8], ['sniper', 4], ['ammo', 20], ['gren', 12], ['bomb', 6], ['med', 13], ['armor', 7]];
  const LOOT_ICON = { pistol: '🔫', smg: '🔫', ak: '🔫', shotgun: '🔫', sniper: '🎯', ammo: '📦', gren: '💣', bomb: '⏱️', med: '➕', armor: '🛡️' };
  B.inv = null;
  function freshInv() { return { primary: null, pistol: { kind: 'pistol', mag: 12 }, res: { light: 24, heavy: 0, shells: 0, sniper: 0 }, gren: 1, bomb: 0, med: 1 }; }
  const cur = () => (B.slot === 1 ? B.inv.primary : B.slot === 2 ? B.inv.pistol : null);
  B.armed = () => B.on && B.alive && (B.slot === 1 || B.slot === 2) && !!cur() && KS.Player.mode === 'foot';

  /* ---------- visuals: guns, tracers, puffs, explosions ---------- */
  const gunGeo = {}, gunMat = new T.MeshLambertMaterial({ color: 0x1f2124 }), woodMat = new T.MeshLambertMaterial({ color: 0x6a4424 });
  function gunMesh(kind) {
    const g = new T.Group(), L = { pistol: 0.22, smg: 0.42, ak: 0.7, shotgun: 0.75, sniper: 0.95 }[kind] || 0.3;
    const body = new T.Mesh(gunGeo[L] || (gunGeo[L] = new T.BoxGeometry(0.06, L, 0.1)), gunMat); body.position.y = -L / 2; g.add(body);
    if (kind !== 'pistol') { const st = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.12), kind === 'ak' || kind === 'shotgun' ? woodMat : gunMat); st.position.set(0, 0.12, -0.02); g.add(st); }
    if (kind === 'ak' || kind === 'smg') { const mg = new T.Mesh(new T.BoxGeometry(0.05, 0.08, 0.18), gunMat); mg.position.set(0, -L * 0.35, -0.12); mg.rotation.x = 0.3; g.add(mg); }
    if (kind === 'sniper') { const sc = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.3, 8), gunMat); sc.position.set(0, -0.3, 0.09); g.add(sc); }
    g.userData.len = L; return g;
  }
  function holdGun(person, kind) {
    if (person.gunKind === kind) return; if (person.gun) { person.gun.parent && person.gun.parent.remove(person.gun); person.gun = null; }
    person.gunKind = kind; if (!kind) return;
    const g = gunMesh(kind); g.position.set(0, -0.6, 0.07); g.scale.setScalar(1.3); person.armR.add(g); person.gun = g;
  }
  B.holdGun = holdGun;
  function aimPose(person, k = 1) { person.busyArm = true; person.armR.rotation.set(-1.45 * k, 0, -0.12); person.armL.rotation.set(-1.3 * k, 0, 0.5 * k); }
  const tracers = [], puffs = [], booms = [];
  const glowTex = KS.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,220,150,0.8)'); gr.addColorStop(1, 'rgba(255,160,60,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  const smokeTex = KS.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(120,115,105,0.9)'); gr.addColorStop(1, 'rgba(120,115,105,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  function tracer(a, b2, col = 0xffe08a) {
    const geo = new T.BufferGeometry().setFromPoints([a.clone(), b2.clone()]), l = new T.Line(geo, new T.LineBasicMaterial({ color: col, transparent: true, opacity: 0.9 }));
    scene.add(l); tracers.push({ o: l, t: 0.09 });
    const f = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); f.position.copy(a); f.scale.set(0.7, 0.7, 0.7); scene.add(f); puffs.push({ o: f, t: 0.06, grow: 0 });
  }
  function puff(p, col = 0xbcb4a4, size = 0.6) { const s = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, color: col, transparent: true, depthWrite: false })); s.position.copy(p); s.scale.set(size, size, size); scene.add(s); puffs.push({ o: s, t: 0.5, grow: 2 }); }
  function boomFx(x, y, z, r) {
    const f = new T.Sprite(new T.SpriteMaterial({ map: glowTex, blending: T.AdditiveBlending, depthWrite: false, transparent: true })); f.position.set(x, y + 1, z); f.scale.set(2, 2, 2); scene.add(f); booms.push({ o: f, t: 0.5, r });
    for (let k = 0; k < 6; k++) puff(new T.Vector3(x + KS.r(-1.5, 1.5), y + KS.r(0.5, 2.5), z + KS.r(-1.5, 1.5)), 0x555048, r * 0.5);
    const l = new T.PointLight(0xffa040, 6, r * 4); l.position.set(x, y + 2, z); scene.add(l); booms.push({ o: l, t: 0.35, light: true });
  }
  function fxUpdate(dt) {
    for (let i = tracers.length - 1; i >= 0; i--) { const t = tracers[i]; t.t -= dt; t.o.material.opacity = Math.max(0, t.t / 0.09); if (t.t <= 0) { scene.remove(t.o); t.o.geometry.dispose(); tracers.splice(i, 1); } }
    for (let i = puffs.length - 1; i >= 0; i--) { const p = puffs[i]; p.t -= dt; const s = p.o.scale.x + p.grow * dt; p.o.scale.set(s, s, s); p.o.position.y += dt * 0.6; p.o.material.opacity = Math.max(0, Math.min(1, p.t * 2)); if (p.t <= 0) { scene.remove(p.o); puffs.splice(i, 1); } }
    for (let i = booms.length - 1; i >= 0; i--) { const b = booms[i]; b.t -= dt; if (b.light) b.o.intensity = Math.max(0, b.t * 18); else { const s = b.r * (1.6 - b.t * 1.6) + 2; b.o.scale.set(s, s, s); b.o.material.opacity = Math.max(0, b.t * 2); } if (b.t <= 0) { scene.remove(b.o); booms.splice(i, 1); } }
  }

  /* ---------- line of fire: the world, vehicles and targets ---------- */
  const near = [], tv = new T.Vector3();
  function blockedAt(x, y, z) {
    if (y < KS.heightAt(x, z) - 0.05) return true;
    KS.solidsNear(x, z, 0.3, near);
    for (const s of near) if (y < s.top && y > s.base && (s.t === 0 ? x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 : (x - s.cx) ** 2 + (z - s.cz) ** 2 < s.r * s.r)) return true;
    for (const v of KS.Traffic.list) {
      const dx = x - v.x, dz = z - v.z; if (dx > 6 || dx < -6 || dz > 6 || dz < -6 || v.dormant || !v.root.visible) continue;
      const sh = Math.sin(v.h), ch = Math.cos(v.h), f = dx * sh + dz * ch, sd = dx * ch - dz * sh;
      if (Math.abs(f) < v.type.len / 2 && Math.abs(sd) < v.type.wid / 2 && y < v.y + (v.type.len > 6 ? 3 : KS.isBike(v.kind) ? 1.2 : 1.6)) return true;
    }
    return false;
  }
  /** first wall/vehicle along a ray between t0 and t1 (null if clear) */
  function march(o, d, t0, t1) { for (let t = t0; t < t1; t += 0.45) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (blockedAt(x, y, z)) return t; } return null; }
  B.losClear = (a, b2) => { tv.subVectors(b2, a); const L = tv.length(); tv.divideScalar(L); return march(a, tv, 0.8, L - 0.8) == null; };
  /** ray against a standing person (vertical capsule from y0 to y0+1.75) */
  function hitPerson(o, d, x, y0, z) {
    const hx = d.x, hz = d.z, hh = hx * hx + hz * hz; if (hh < 1e-6) return null;
    const t = -((o.x - x) * hx + (o.z - z) * hz) / hh; if (t < 0) return null;
    const px = o.x + hx * t - x, pz = o.z + hz * t - z, dist = Math.hypot(px, pz); if (dist > 0.42) return null;
    const y = o.y + d.y * t; if (y < y0 + 0.05 || y > y0 + 1.8) return null;
    return { t: t - Math.sqrt(Math.max(0, 0.42 * 0.42 - dist * dist)) / Math.sqrt(hh), head: y > y0 + 1.5 };
  }

  /* ---------- your weapons ---------- */
  let cool = 0, reloadT = 0, aimK = 0;
  const muzzle = new T.Vector3(), dir = new T.Vector3(), camO = new T.Vector3();
  function muzzlePos(person) { const g = person.gun; if (!g) { person.root.getWorldPosition(muzzle); muzzle.y += 1.4; return muzzle; } g.updateWorldMatrix(true, false); return muzzle.set(0, -g.userData.len, 0).applyMatrix4(g.matrixWorld); }
  function fire() {
    const w = cur(), def = W[w.kind], cam = KS.camera, PL = KS.Player;
    if (w.mag <= 0) { KS.audio.click(); cool = 0.3; if (B.inv.res[def.ammo] > 0) startReload(); return; }
    w.mag--; cool = def.rate;
    cam.getWorldDirection(dir); camO.copy(cam.position);
    const mz = muzzlePos(PL.person).clone(), toPl = (PL.x - camO.x) * dir.x + (PL.y + 1.4 - camO.y) * dir.y + (PL.z - camO.z) * dir.z;
    KS.audio.gun(w.kind, 1); KS.Cam.shake = Math.max(KS.Cam.shake, w.kind === 'shotgun' || w.kind === 'sniper' ? 0.12 : 0.05);
    // recoil kicks the aim up (a lower camera pitch looks higher), then settles back
    const kick = (def.dmg > 50 ? 0.035 : 0.007) * (aimK > 0.5 ? 0.5 : 1); KS.Cam.pitch = Math.max(-0.35, KS.Cam.pitch - kick); B.recoil = (B.recoil || 0) + kick;
    const pellets = def.pellets || 1, spread = def.spread * (aimK > 0.5 ? 0.35 : 1) * (Math.abs(PL.speed) > 1 ? 1.8 : 1);
    let lastEnd = null;
    for (let k = 0; k < pellets; k++) {
      const d = dir.clone(); d.x += KS.r(-spread, spread); d.y += KS.r(-spread, spread); d.z += KS.r(-spread, spread); d.normalize();
      let best = null, bt = def.range;
      for (const bot of B.bots) if (bot.alive) { const h = hitPerson(camO, d, bot.x, bot.y, bot.z); if (h && h.t > toPl - 0.5 && h.t < bt) { bt = h.t; best = { bot, head: h.head }; } }
      if (KS.Net) for (const p of KS.Net.players.values()) if (p.placed && p.al !== false) { const h = hitPerson(camO, d, p.x, p.y, p.z); if (h && h.t > toPl - 0.5 && h.t < bt) { bt = h.t; best = { net: p, head: h.head }; } }
      const wall = march(camO, d, Math.max(0.5, toPl - 0.3), bt);
      const endT = wall != null ? wall : bt, end = camO.clone().addScaledVector(d, endT);
      if (wall != null || !best) { if (endT < def.range - 1) puff(end); best = null; }
      if (best) {
        const dmg = Math.round(def.dmg * (best.head ? 2 : 1) * (endT > def.range * 0.6 ? 0.75 : 1));
        hitMark(best.head);
        if (best.bot) damageBot(best.bot, dmg, best.head);
        else if (best.net) KS.Net.sendAll({ t: 'hit', to: best.net.id, dmg, head: best.head, by: KS.Net.me, byName: KS.Net.name(), wp: w.kind });
      }
      if (k === 0 || KS.chance(0.4)) tracer(mz, end); lastEnd = end;
    }
    if (KS.Net && KS.Net.state !== 'off' && lastEnd) KS.Net.sendAll({ t: 'shot', id: KS.Net.me, a: [mz.x, mz.y, mz.z].map((n) => +n.toFixed(2)), b: [lastEnd.x, lastEnd.y, lastEnd.z].map((n) => +n.toFixed(2)), wp: w.kind });
    KS.Peds.forEachNear(PL.x, PL.z, 45, (p) => { if (!p.down && p.mode !== 'sit' && KS.chance(0.8)) { p.flee = 4; const dx = p.x - PL.x, dz = p.z - PL.z, m = Math.hypot(dx, dz) || 1; p.fvx = (dx / m) * 5.5; p.fvz = (dz / m) * 5.5; } });
    if (w.mag === 0 && B.inv.res[def.ammo] > 0) setTimeout(() => { if (cur() === w) startReload(); }, 250);
  }
  function startReload() {
    const w = cur(); if (!w || reloadT > 0) return; const def = W[w.kind];
    if (w.mag >= def.mag || B.inv.res[def.ammo] <= 0) return;
    reloadT = def.reload; KS.audio.reload();
  }
  function finishReload() { const w = cur(); if (!w) return; const def = W[w.kind], need = def.mag - w.mag, got = Math.min(need, B.inv.res[def.ammo]); w.mag += got; B.inv.res[def.ammo] -= got; }
  function hitMark(head, kill) { const h = $('hitMark'); h.className = kill ? 'kill' : head ? 'head' : ''; h.hidden = false; clearTimeout(h._t); h._t = setTimeout(() => (h.hidden = true), kill ? 500 : 160); }

  /* ---------- grenades and time bombs ---------- */
  const projectiles = [];
  const grenGeo = new T.SphereGeometry(0.12, 8, 6), grenMat = new T.MeshLambertMaterial({ color: 0x3a4a2a }), bombMat = new T.MeshLambertMaterial({ color: 0x8a1010 }), ledMat = new T.MeshBasicMaterial({ color: 0xff2020 });
  function throwGrenade() {
    if (B.inv.gren <= 0) { KS.Game.notify('No grenades left.'); return; }
    B.inv.gren--; const PL = KS.Player; KS.camera.getWorldDirection(dir);
    const m = new T.Mesh(grenGeo, grenMat); scene.add(m);
    const hx = dir.x, hz = dir.z, hm = Math.hypot(hx, hz) || 1; // throw along where you look, in a high arc
    const p = { o: m, x: PL.x + (hx / hm) * 1.2, y: PL.y + 1.8, z: PL.z + (hz / hm) * 1.2, vx: (hx / hm) * 16, vy: Math.max(4, dir.y * 16 + 8), vz: (hz / hm) * 16, fuse: 3, r: 7, dmg: 95, kind: 'gren' };
    projectiles.push(p); KS.audio.swing && KS.audio.swing(); PL.punchT = 0.3; PL.punchA = 0;
  }
  function placeBomb() {
    if (B.inv.bomb <= 0) { KS.Game.notify('No time bombs left.'); return; }
    B.inv.bomb--; const PL = KS.Player, x = PL.x + Math.sin(PL.h) * 0.9, z = PL.z + Math.cos(PL.h) * 0.9, y = KS.groundAt(x, z, PL.y + 0.5, 1);
    const g = new T.Group(), body = new T.Mesh(new T.BoxGeometry(0.4, 0.22, 0.28), bombMat), led = new T.Mesh(new T.SphereGeometry(0.04, 6, 4), ledMat); led.position.set(0.1, 0.13, 0); g.add(body, led); g.position.set(x, y + 0.11, z); scene.add(g);
    projectiles.push({ o: g, led, x, y: y + 0.11, z, vx: 0, vy: 0, vz: 0, fuse: 7, r: 9, dmg: 130, kind: 'bomb', still: true, beep: 0 });
    KS.Game.notify('⏱️ Time bomb planted: 7 seconds. Run!');
  }
  function projUpdate(dt) {
    for (let i = projectiles.length - 1; i >= 0; i--) {
      const p = projectiles[i]; p.fuse -= dt;
      if (!p.still) {
        p.vy -= 18 * dt; let nx = p.x + p.vx * dt, ny = p.y + p.vy * dt, nz = p.z + p.vz * dt;
        const c = KS.collide(nx, nz, 0.12, ny, 0.05); if (c.hit) { p.vx *= -0.4; p.vz *= -0.4; nx = c.x; nz = c.z; }
        const g = KS.groundAt(nx, nz, ny + 0.3, 0.4); if (ny < g + 0.12) { ny = g + 0.12; p.vy = Math.abs(p.vy) > 2 ? -p.vy * 0.35 : 0; p.vx *= 0.6; p.vz *= 0.6; }
        p.x = nx; p.y = ny; p.z = nz; p.o.position.set(p.x, p.y, p.z); p.o.rotation.x += dt * 8;
      } else { p.beep -= dt; if (p.beep <= 0) { p.beep = Math.max(0.12, p.fuse / 7); KS.audio.beep(Math.max(0.15, 1 - Math.hypot(p.x - KS.Player.x, p.z - KS.Player.z) / 40)); p.led.visible = true; } else if (p.beep < 0.06) p.led.visible = false; }
      if (p.fuse <= 0) { scene.remove(p.o); projectiles.splice(i, 1); B.explode(p.x, p.y, p.z, p.r, p.dmg, KS.Net && KS.Net.state !== 'off' ? KS.Net.name() : 'You', true); }
    }
  }
  /** an explosion: local effects and damage; mine=true also tells the other players */
  B.explode = (x, y, z, r, dmg, byName, mine, byId) => {
    boomFx(x, y, z, r); const PL = KS.Player, d = Math.hypot(PL.x - x, PL.y + 1 - y, PL.z - z);
    KS.audio.boom(Math.max(0.1, 1 - d / 160)); KS.Cam.shake = Math.max(KS.Cam.shake, Math.max(0, 0.6 - d / 80));
    if (B.on && B.alive && d < r) damage(dmg * (1 - d / r), mine ? 'your own blast' : byName, mine ? null : byId);
    for (const bot of B.bots) if (bot.alive) { const db = Math.hypot(bot.x - x, bot.z - z); if (db < r) damageBot(bot, dmg * (1 - db / r), false, mine); }
    KS.Peds.forEachNear(x, z, r * 2, (p) => { p.flee = 4; const dx = p.x - x, dz = p.z - z, m = Math.hypot(dx, dz) || 1; p.fvx = (dx / m) * 6; p.fvz = (dz / m) * 6; });
    for (const v of KS.Traffic.list) { const dv = Math.hypot(v.x - x, v.z - z); if (dv < r * 1.2 && v !== PL.vehicle) { v.stunned = 3; v.knockX = ((v.x - x) / (dv || 1)) * 0.8; v.knockZ = ((v.z - z) / (dv || 1)) * 0.8; } }
    if (mine && KS.Net && KS.Net.state !== 'off') KS.Net.sendAll({ t: 'boom', x: +x.toFixed(2), y: +y.toFixed(2), z: +z.toFixed(2), r, dmg, by: KS.Net.me, byName });
  };

  /* ---------- health, armour and elimination ---------- */
  function damage(dmg, byName, byId) {
    if (!B.alive) return;
    if (B.armor > 0) { const a = Math.min(B.armor, dmg * 0.5); B.armor -= a; dmg -= a; }
    B.lastBy = byName; B.lastById = byId; KS.Game.hurt(dmg);
  }
  B.damage = damage;
  B.died = () => {
    if (!B.alive) return; B.alive = false; const PL = KS.Player, p = PL.person;
    PL.mode = 'dead'; p.busyArm = true; p.inner.rotation.x = -1.45; p.inner.position.y = 0.2; holdGun(p, null);
    KS.audio.fail(); B.slot = 0;
    if (KS.Net && KS.Net.state !== 'off') KS.Net.sendAll({ t: 'kill', victim: KS.Net.me, vName: KS.Net.name(), by: B.lastById || null, byName: B.lastBy || 'the zone' });
    feed(`💀 You were eliminated by <b>${esc(B.lastBy || 'the zone')}</b>`);
    const rank = aliveCount() + 1;
    setTimeout(() => endMatch(false, rank), 2500);
  };
  function aliveCount() { let n = B.bots.filter((b) => b.alive).length; if (KS.Net) for (const p of KS.Net.players.values()) if (p.al) n++; return n + (B.alive ? 1 : 0); }
  function feed(html) { KS.Game.notify(html, 'bad'); }

  /* ---------- computer opponents (when you play alone) ---------- */
  const BOT_NAMES = ['Kancha', 'Bire', 'Sano Babu', 'Thulo Dai', 'Maila', 'Saila', 'Kale', 'Gore', 'Jhyape', 'Bhote', 'Raju', 'Dipak'];
  function makeBot(i, x, z) {
    const o = KS.outfitFor('man'); Object.assign(o, { topStyle: 'jacket', jacket: KS.pick([0x3a4a2a, 0x2a2a2a, 0x4a3a2a, 0x2a3a4a]), bottom: 0x2a2a22, hat: KS.chance(0.6) ? 'helmet' : 'beanie', hatColor: 0x3a4a2a, bag: 'backpack', bagColor: 0x2a2a22 });
    const p = KS.makePerson('man', o); scene.add(p.root);
    const kind = KS.pick(['pistol', 'smg', 'ak', 'ak', 'shotgun']); holdGun(p, kind);
    return { p, name: BOT_NAMES[i % BOT_NAMES.length], x, z, y: 0, h: 0, hp: 100, alive: true, wp: kind, cool: KS.r(1, 3), tx: x, tz: z, seeT: 0, sees: false, deadT: 0, strafe: KS.chance(0.5) ? 1 : -1 };
  }
  function damageBot(bot, dmg, head, mine = true) {
    if (!bot.alive) return; bot.hp -= dmg; bot.alert = 6;
    if (bot.hp <= 0) {
      bot.alive = false; bot.deadT = 8; bot.p.inner.rotation.x = -1.45; bot.p.inner.position.y = 0.2; holdGun(bot.p, null);
      if (mine) { B.kills++; hitMark(head, true); feed(`🎯 You eliminated <b>${esc(bot.name)}</b>${head ? ' (headshot)' : ''}`); KS.Game.giveTokens && KS.Game.giveTokens(1, 'Elimination'); }
      spawnLoot(KS.pick(['ammo', 'ammo', 'med', 'gren', bot.wp]), bot.x, bot.z, true);
    }
  }
  function botUpdate(bot, dt) {
    const p = bot.p, PL = KS.Player;
    if (!bot.alive) { bot.deadT -= dt; if (bot.deadT <= 0) p.root.visible = false; return; }
    const dx = PL.x - bot.x, dz = PL.z - bot.z, d = Math.hypot(dx, dz);
    bot.seeT -= dt; if (bot.seeT <= 0) { bot.seeT = 0.4; bot.sees = B.alive && PL.mode !== 'plane' && d < 75 && B.losClear(tv.set(bot.x, bot.y + 1.5, bot.z).clone(), new T.Vector3(PL.x, PL.y + 1.3, PL.z)); }
    let speed = 0, mx = 0, mz = 0;
    const Z = B.zone, zr = Z ? zoneR() : 1e9, outZ = Z && Math.hypot(bot.x - Z.x, bot.z - Z.z) > zr - 10;
    if (bot.sees && !outZ) {
      bot.h = Math.atan2(dx, dz); aimPose(p);
      if (d > 22) { mx = dx / d; mz = dz / d; speed = 2.2; } else { mx = Math.cos(bot.h) * bot.strafe; mz = -Math.sin(bot.h) * bot.strafe; speed = 1.6; if (KS.chance(dt * 0.4)) bot.strafe *= -1; }
      bot.cool -= dt;
      if (bot.cool <= 0) {
        const def = W[bot.wp]; bot.cool = (def.auto ? KS.r(0.25, 0.5) : def.rate + KS.r(0.4, 0.9));
        const from = muzzlePos(p).clone(), hitP = Math.max(0.08, 0.5 - d / 140 - (Math.abs(PL.speed) > 4 ? 0.15 : 0) - (KS.Battle.crouch ? 0.1 : 0));
        const hit = KS.chance(hitP), end = new T.Vector3(PL.x + (hit ? 0 : KS.r(-1.5, 1.5)), PL.y + KS.r(0.6, 1.6), PL.z + (hit ? 0 : KS.r(-1.5, 1.5)));
        tracer(from, end, 0xffb070); KS.audio.gun(bot.wp, Math.max(0.08, 1 - d / 120));
        if (hit) damage(def.dmg * (def.pellets ? 3 : 1) * 0.5, bot.name); else if (d < 30) KS.audio.whiz(0.8);
      }
    } else {
      p.busyArm = false;
      if (outZ) { bot.tx = Z.x + KS.r(-20, 20); bot.tz = Z.z + KS.r(-20, 20); }
      else if (bot.alert > 0 && d < 140) { bot.tx = PL.x; bot.tz = PL.z; }
      let tdx = bot.tx - bot.x, tdz = bot.tz - bot.z, td = Math.hypot(tdx, tdz);
      if (td < 3) { const a = KS.r(0, 6.28), r = Math.min(zr * 0.8, 160); bot.tx = (Z ? Z.x : bot.x) + Math.cos(a) * KS.r(10, r); bot.tz = (Z ? Z.z : bot.z) + Math.sin(a) * KS.r(10, r); tdx = bot.tx - bot.x; tdz = bot.tz - bot.z; td = Math.hypot(tdx, tdz) || 1; }
      mx = tdx / td; mz = tdz / td; speed = outZ ? 4.8 : 3.4; bot.h = KS.angLerp(bot.h, Math.atan2(mx, mz), Math.min(1, dt * 5));
    }
    bot.alert = Math.max(0, (bot.alert || 0) - dt);
    const c = KS.collide(bot.x + mx * speed * dt, bot.z + mz * speed * dt, 0.35, bot.y, 1); if (c.hit && !bot.sees) { bot.tx = bot.x + KS.r(-30, 30); bot.tz = bot.z + KS.r(-30, 30); }
    const o = KS.Traffic.pushOut(c.x, c.z, 0.35); bot.x = o.x; bot.z = o.z; bot.y = KS.groundAt(bot.x, bot.z, bot.y + 0.5, 1);
    if (Z && Math.hypot(bot.x - Z.x, bot.z - Z.z) > zr) { bot.hp -= zoneDps() * dt; if (bot.hp <= 0) damageBot(bot, 1, false, false); }
    p.root.position.set(bot.x, bot.y + 0.04, bot.z); p.root.rotation.y = bot.h; KS.animWalk(p, dt, speed);
    if (bot.sees) aimPose(p);
  }

  /* ---------- loot ---------- */
  const lootGroup = new T.Group();
  const beamMat = new T.MeshBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.35, blending: T.AdditiveBlending, depthWrite: false });
  const ringMat = new T.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.6, side: T.DoubleSide, depthWrite: false });
  const beamGeo = new T.CylinderGeometry(0.05, 0.05, 6, 6, 1, true).translate(0, 3, 0), ringGeo = new T.RingGeometry(0.45, 0.6, 20).rotateX(-Math.PI / 2);
  const crateMat = { ammo: 0x6a5a2a, gren: 0x3a4a2a, bomb: 0x8a1010, med: 0xf4f4f4, armor: 0x2a3a5a };
  function lootModel(kind) {
    const g = new T.Group(); g.add(new T.Mesh(beamGeo, beamMat)); const ring = new T.Mesh(ringGeo, ringMat); ring.position.y = 0.04; g.add(ring);
    const item = W[kind] ? gunMesh(kind) : new T.Mesh(new T.BoxGeometry(0.45, 0.3, 0.35), new T.MeshLambertMaterial({ color: crateMat[kind] || 0x777777 }));
    if (W[kind]) { item.rotation.z = Math.PI / 2; item.position.set(item.userData.len / 2, 0.55, 0); } else { item.position.y = 0.45; if (kind === 'med') { const c = new T.Mesh(new T.BoxGeometry(0.3, 0.32, 0.08), new T.MeshBasicMaterial({ color: 0xc81e1e })); c.position.set(0, 0.45, 0.17); g.add(c); } }
    const spin = new T.Group(); spin.add(item); spin.position.y = 0; g.add(spin); g.userData.spin = spin; return g;
  }
  function spawnLoot(kind, x, z, temp) {
    const y = KS.groundAt(x, z, 50, 60), g = lootModel(kind); g.position.set(x, y + 0.02, z); lootGroup.add(g);
    const L = { kind, x, y, z, g, taken: false, temp, i: B.loot.length }; B.loot.push(L); return L;
  }
  function makeLoot() {
    if (B.lootMade) return; B.lootMade = true; scene.add(lootGroup);
    const save = KS.rng; KS.reseed(77);
    const lots = (KS.World.lots || []).filter((l) => Math.abs(l.x) < 540 && Math.abs(l.z) < 440), total = LOOT.reduce((a, l) => a + l[1], 0);
    for (let k = 0; k < 110 && lots.length; k++) {
      const l = lots[Math.floor(KS.rng() * lots.length)]; let r = KS.rng() * total, kind = 'ammo';
      for (const [kk, w] of LOOT) { r -= w; if (r <= 0) { kind = kk; break; } }
      spawnLoot(kind, l.x + KS.r(-1.5, 1.5), l.z + KS.r(-1.5, 1.5));
    }
    for (const lm of KS.landmarks.filter((x) => !x.minor)) for (let k = 0; k < 2; k++) spawnLoot(KS.pick(['ak', 'sniper', 'armor', 'med', 'gren', 'smg']), lm.x + KS.r(-14, 14), lm.z + KS.r(-14, 14));
    KS.rng = save;
  }
  function pickUp(L, fromNet) {
    if (L.taken) return; L.taken = true; L.g.visible = false; L.respawn = L.temp ? -1 : 120;
    if (fromNet) return;
    const inv = B.inv, k = L.kind; let msg = '';
    if (W[k] && W[k].slot === 1) {
      if (inv.primary && inv.primary.kind === k) { inv.res[W[k].ammo] += W[k].mag; msg = `+${W[k].mag} ${W[k].name} ammo`; }
      else { if (inv.primary) spawnLoot(inv.primary.kind, KS.Player.x + 0.8, KS.Player.z, true); inv.primary = { kind: k, mag: W[k].mag }; inv.res[W[k].ammo] += W[k].mag; msg = `🔫 ${W[k].name} (press 1)`; if (B.slot !== 2) B.slot = 1; }
    } else if (k === 'pistol') { inv.res.light += 12; msg = '+12 pistol rounds'; }
    else if (k === 'ammo') { const t = inv.primary ? W[inv.primary.kind].ammo : 'light', n = { light: 30, heavy: 30, shells: 12, sniper: 10 }[t]; inv.res[t] += n; msg = `📦 +${n} ammo`; }
    else if (k === 'gren') { inv.gren += 2; msg = '💣 +2 grenades (press 3)'; }
    else if (k === 'bomb') { inv.bomb += 1; msg = '⏱️ +1 time bomb (press 4)'; }
    else if (k === 'med') { inv.med += 1; msg = '➕ +1 medkit (press 5)'; }
    else if (k === 'armor') { B.armor = 100; msg = '🛡️ Armour vest: 100'; }
    KS.Game.notify(msg, 'good'); KS.audio.coin && KS.audio.coin();
    if (!L.temp && KS.Net && KS.Net.state !== 'off') KS.Net.sendAll({ t: 'pick', i: L.i });
  }
  function lootUpdate(dt) {
    const PL = KS.Player, cam = KS.camera.position;
    for (const L of B.loot) {
      if (L.taken) { if (L.respawn > 0) { L.respawn -= dt; if (L.respawn <= 0) { L.taken = false; } } continue; }
      const dc = Math.abs(L.x - cam.x) + Math.abs(L.z - cam.z); L.g.visible = dc < 260;
      if (L.g.visible) L.g.userData.spin.rotation.y += dt * 1.5;
      if (B.alive && PL.mode === 'foot' && Math.abs(L.x - PL.x) < 1.4 && Math.abs(L.z - PL.z) < 1.4 && Math.abs(L.y - PL.y) < 1.6) pickUp(L);
    }
  }

  /* ---------- the safe zone ---------- */
  const PH = [[0, 700], [70, 700], [110, 400], [170, 400], [210, 210], [260, 210], [295, 90], [335, 90], [365, 20], [9999, 20]];
  function zoneR() { const t = (KS.clock - B.zone.t0); for (let k = 1; k < PH.length; k++) if (t < PH[k][0]) { const [t0, r0] = PH[k - 1], [t1, r1] = PH[k]; return KS.lerp(r0, r1, (t - t0) / (t1 - t0)); } return 20; }
  function zonePhase() { const t = KS.clock - B.zone.t0; let k = 0; while (k < PH.length - 1 && t >= PH[k + 1][0]) k++; return k; }
  function zoneDps() { return 1.5 + Math.floor(zonePhase() / 2) * 1.8; }
  let zoneWall;
  function zoneUpdate(dt) {
    const Z = B.zone; if (!Z) { if (zoneWall) zoneWall.visible = false; return; }
    if (!zoneWall) { zoneWall = new T.Mesh(new T.CylinderGeometry(1, 1, 1, 96, 1, true), new T.MeshBasicMaterial({ color: 0x3fa0ff, transparent: true, opacity: 0.18, side: T.DoubleSide, depthWrite: false })); scene.add(zoneWall); }
    const r = zoneR(); zoneWall.visible = true; zoneWall.scale.set(r, 260, r); zoneWall.position.set(Z.x, 120, Z.z);
    const PL = KS.Player, out = Math.hypot(PL.x - Z.x, PL.z - Z.z) > r;
    B.outside = out;
    if (out && B.alive && PL.mode !== 'plane') { Z.hurtT = (Z.hurtT || 0) - dt; if (Z.hurtT <= 0) { Z.hurtT = 1; B.lastBy = 'the zone'; B.lastById = null; KS.Game.hurt(zoneDps()); } }
  }

  /* ---------- matches ---------- */
  B.setMode = (on) => {
    if (B.on === on) return; B.on = on; document.body.classList.toggle('battle', on);
    const L = KS.Law; if (on && L) { L.heat = 0; L.stop = null; for (const v of KS.Traffic.chasers()) KS.Traffic.endChase(v); }
    for (const ped of KS.Peds.police || []) { ped.hidden = on; ped.p.root.visible = !on; }
    for (const v of KS.Traffic.list) if ((v.kind === 'police' || v.kind === 'policebike') && v !== KS.Player.vehicle) { v.dormant = on; v.root.visible = !on; }
    if (on && KS.Uthao.online) KS.Uthao.toggle();
    if (on) { makeLoot(); for (const Lt of B.loot) { Lt.g.visible = !Lt.taken; } lootGroup.visible = true; B.inv = B.inv || freshInv(); }
    else { lootGroup.visible = false; B.zone = null; B.match = null; for (const b of B.bots) scene.remove(b.p.root); B.bots = []; holdGun(KS.Player.person, null); KS.Player.person.busyArm = false; B.slot = 0; if (zoneWall) zoneWall.visible = false; }
    $('battleHud').hidden = !on; $('zoneBar').hidden = !on;
    KS.Game.refreshMenu && KS.state === 'pause' && KS.Game.refreshMenu();
  };
  /** start a match (solo, or the host starts it for everyone in the room) */
  B.startMatch = () => {
    const N = KS.Net, inRoom = N && (N.state === 'host' || N.state === 'guest');
    if (inRoom && !N.host) { KS.Game.notify('Only the room host can start a battle. Ask them to tap Start battle.'); return; }
    const a = Math.random() * Math.PI * 2, off = (Math.random() - 0.5) * 500, cx = -Math.sin(a) * off, cz = Math.cos(a) * off;
    const cfg = { x: KS.r(-280, 280), z: KS.r(-320, 260), path: [cx - Math.cos(a) * 1400, cz - Math.sin(a) * 1400, cx + Math.cos(a) * 1400, cz + Math.sin(a) * 1400], solo: !inRoom };
    if (inRoom) N.sendAll({ t: 'match', cfg });
    B.beginMatch(cfg);
  };
  B.beginMatch = (cfg) => {
    if (KS.state !== 'play') { if (KS.state === 'pause') KS.Game.pause(false); if (KS.state === 'modal') KS.modalClose(); }
    B.setMode(true); B.inv = freshInv(); B.slot = 2; B.kills = 0; B.alive = true; B.armor = 0; KS.Player.health = 100;
    const PL = KS.Player, p = PL.person; p.inner.rotation.x = 0; p.inner.position.y = 0;
    for (const L of B.loot) { if (L.temp) { L.taken = true; L.g.visible = false; L.respawn = -1; } else { L.taken = false; } }
    B.zone = { x: cfg.x, z: cfg.z, t0: KS.clock + 25 }; B.match = { solo: cfg.solo, over: false, started: performance.now() / 1000, net: !cfg.solo }; // real seconds, so slow devices still finish matches
    for (const b of B.bots) scene.remove(b.p.root); B.bots = [];
    if (cfg.solo) for (let i = 0; i < 11; i++) { const a2 = KS.r(0, 6.28), r = KS.r(40, 380), bx = cfg.x + Math.cos(a2) * r, bz = cfg.z + Math.sin(a2) * r; const c = KS.collide(bx, bz, 0.5, 0, 1); B.bots.push(makeBot(i, c.x, c.z)); }
    Drop.begin({ path: cfg.path, onLand: () => KS.Game.notify('⚔️ Find weapons (glowing beams), stay inside the blue zone, be the last one standing!') });
    KS.Game.notify(cfg.solo ? '⚔️ Battle! 11 opponents are already on the ground. Jump when you are over a good spot.' : '⚔️ Battle match started for everyone in the room. Jump out of the plane!');
  };
  function endMatch(win, rank) {
    if (!B.match || B.match.over) return; B.match.over = true;
    const coins = win ? 10 : Math.max(1, 6 - rank); KS.Game.giveTokens(coins, win ? 'Battle won' : 'Battle');
    KS.modal(win ? '🏆 Winner! जित्यौ!' : `💀 Eliminated · #${rank}`, `<p>${win ? 'You are the last one standing.' : `You finished <b>#${rank}</b>.`} Eliminations: <b>${B.kills}</b>. +${coins} 🪙</p>`,
      [[KS.Net && KS.Net.state === 'guest' ? 'Wait for the next match' : '⚔️ Play again', () => { KS.modalClose(); if (!(KS.Net && KS.Net.state === 'guest')) B.startMatch(); else revive(); }], ['🌏 Back to the open world', () => { KS.modalClose(); revive(); B.setMode(false); }]]);
  }
  function revive() { const PL = KS.Player, p = PL.person; B.alive = true; PL.health = 100; p.inner.rotation.x = 0; p.inner.position.y = 0; p.busyArm = false; if (PL.mode === 'dead') PL.mode = 'foot'; B.zone = null; if (B.match) B.match.over = true; }
  B.useMed = () => { if (B.inv.med <= 0) return KS.Game.notify('No medkits.'); if (KS.Player.health >= 100) return KS.Game.notify('Health is full.'); B.inv.med--; B.healT = 3; KS.Game.notify('➕ Healing…', 'good'); };

  /* ---------- multiplayer messages ---------- */
  B.onNet = (m) => {
    const N = KS.Net;
    switch (m.t) {
      case 'match': if (!N.host && m.cfg) B.beginMatch(m.cfg); break;
      case 'shot': { const p = N.players.get(m.id); if (!p || !m.a || !m.b) break; tracer(new T.Vector3(...m.a), new T.Vector3(...m.b), 0xffb070); const d = Math.hypot(m.a[0] - KS.Player.x, m.a[2] - KS.Player.z); KS.audio.gun(m.wp, Math.max(0.05, 1 - d / 200)); break; }
      case 'hit': if (m.to === N.me && B.on) { damage(Math.min(200, +m.dmg || 0), m.byName, m.by); B.flashHit(); } break;
      case 'kill': { const mine = m.by === N.me; if (mine) { B.kills++; hitMark(false, true); } feed(`💀 <b>${esc(m.byName || 'Someone')}</b> eliminated <b>${esc(m.vName)}</b>`); const p = N.players.get(m.victim); if (p) p.al = false; break; }
      case 'boom': if (m.by !== N.me) B.explode(m.x, m.y, m.z, m.r, m.dmg, m.byName, false, m.by); break;
      case 'pick': { const L = B.loot[m.i]; if (L) pickUp(L, true); break; }
    }
  };
  B.flashHit = () => {}; // Game.hurt already flashes the screen red

  /* ---------- per frame ---------- */
  B.update = (dt) => {
    fxUpdate(dt); projUpdate(dt); Coins.update(dt);
    if (!B.on) return;
    const I = KS.Input, PL = KS.Player, person = PL.person, play = KS.state === 'play';
    lootUpdate(dt); zoneUpdate(dt);
    for (const bot of B.bots) botUpdate(bot, dt);
    if (B.healT > 0) { B.healT -= dt; PL.health = Math.min(100, PL.health + dt * 18); }
    if (play && B.alive && PL.mode === 'foot') {
      for (let k = 1; k <= 5; k++) if (I.hit('Digit' + k)) {
        if (k === 5) B.useMed(); else if (k === 1 && !B.inv.primary) KS.Game.notify('No main weapon yet: look for the glowing beams.'); else { B.slot = B.slot === k ? 0 : k; reloadT = 0; }
      }
      if (I.hit('KeyWeapon')) { const order = [1, 2, 3, 4, 0].filter((s) => s !== 1 || B.inv.primary); B.slot = order[(order.indexOf(B.slot) + 1) % order.length]; reloadT = 0; }
      if (I.hit('KeyR') || I.hit('KeyReload')) startReload();
      if (I.hit('KeyMed')) B.useMed();
      const firing = I.down('Mouse0') || I.down('KeyFire'), fireHit = I.hit('Mouse0') || I.hit('KeyFire');
      cool -= dt;
      if (B.recoil > 0 && !firing) { const back = Math.min(B.recoil, dt * 0.25); B.recoil -= back; KS.Cam.pitch = Math.min(1.35, KS.Cam.pitch + back); } // recover
      if (reloadT > 0) { reloadT -= dt; if (reloadT <= 0) finishReload(); }
      const w = cur();
      if (w && reloadT <= 0 && cool <= 0 && (W[w.kind].auto ? firing : fireHit)) fire();
      if (B.slot === 3 && fireHit && cool <= 0) { cool = 0.8; throwGrenade(); }
      if (B.slot === 4 && fireHit && cool <= 0) { cool = 1; placeBomb(); }
      const aiming = (I.down('Mouse2') || I.down('KeyAim')) && !!w; aimK = KS.lerp(aimK, aiming ? 1 : 0, Math.min(1, dt * 10));
    } else aimK = KS.lerp(aimK, 0, Math.min(1, dt * 10));
    // field of view while aiming (the sniper scope zooms in)
    const w = cur(), fov = 62 - aimK * (w && W[w.kind].zoom ? 62 - W[w.kind].zoom : 18);
    if (Math.abs(KS.camera.fov - fov) > 0.05) { KS.camera.fov = fov; KS.camera.updateProjectionMatrix(); }
    KS.Cam.aim = aimK;
    // your gun and pose
    if (B.alive && PL.mode === 'foot') { holdGun(person, w ? w.kind : null); if (w) aimPose(person); else if (person.busyArm && !PL.punchA && PL.punchA !== 0) person.busyArm = false; }
    else if (PL.mode !== 'dead') holdGun(person, null);
    // match end (solo: everyone else is down; room: nobody else alive)
    const M = B.match;
    if (M && !M.over && B.alive && performance.now() / 1000 - M.started > 20) {
      if (M.solo && B.bots.every((b) => !b.alive)) endMatch(true, 1);
      if (!M.solo && KS.Net && KS.Net.players.size && ![...KS.Net.players.values()].some((p) => p.al)) endMatch(true, 1);
    }
    hud();
  };
  function hud() {
    const PL = KS.Player, w = cur(), inv = B.inv;
    const slot = (n, label, on, have = true) => `<span class="${B.slot === n ? 'on' : ''} ${have ? '' : 'off'}"><kbd>${n}</kbd>${label}</span>`;
    const ammo = w ? `${w.mag} <small>/ ${inv.res[W[w.kind].ammo]}</small>${reloadT > 0 ? ' <em>reloading…</em>' : ''}` : B.slot === 3 ? `${inv.gren} <small>grenades</small>` : B.slot === 4 ? `${inv.bomb} <small>time bombs</small>` : '<small>fists</small>';
    const html = `<div class="wpn"><b>${w ? W[w.kind].name : B.slot === 3 ? 'Grenade' : B.slot === 4 ? 'Time bomb' : 'Unarmed'}</b><span>${ammo}</span></div>
      <div class="slots">${slot(1, inv.primary ? W[inv.primary.kind].name : '—', 0, !!inv.primary)}${slot(2, 'Pistol')}${slot(3, '💣 ' + inv.gren, 0, inv.gren > 0)}${slot(4, '⏱️ ' + inv.bomb, 0, inv.bomb > 0)}${slot(5, '➕ ' + inv.med, 0, inv.med > 0)}</div>
      ${B.armor > 0 ? `<div class="armor">🛡️ ${Math.round(B.armor)}</div>` : ''}`;
    const bh = $('battleHud'); if (bh._h !== html) { bh._h = html; bh.innerHTML = html; }
    const Z = B.zone, zb = $('zoneBar');
    let zt = '';
    if (Z) { const t = KS.clock - Z.t0, k = zonePhase(), next = PH[Math.min(PH.length - 1, k + 1)][0] - t, shrinking = k % 2 === 1; zt = t < 0 ? `⏳ Zone appears in ${fmtT(-t)}` : shrinking ? `🔵 Zone shrinking… ${fmtT(next)}` : `⏳ Zone shrinks in ${fmtT(next)}`; }
    const zh = `${zt}${zt ? ' · ' : ''}👤 ${aliveCount()} alive · 🎯 ${B.kills}${B.outside ? ' · <b class="bad">OUTSIDE THE ZONE!</b>' : ''}`;
    if (zb._h !== zh) { zb._h = zh; zb.innerHTML = zh; }
    $('crosshair').hidden = !(w && PL.mode === 'foot' && B.alive) && B.slot !== 3;
    $('crosshair').className = aimK > 0.5 ? 'aim' : '';
    $('scope').hidden = !(w && W[w.kind].zoom && aimK > 0.8);
  }
  /** for the maps */
  B.mapInfo = () => (B.zone ? { x: B.zone.x, z: B.zone.z, r: KS.clock < B.zone.t0 ? 700 : zoneR() } : null);
  B.botList = () => B.bots;
  B.init = (sc) => { scene = sc; Drop.init(sc); Flight.init(sc); Coins.init(); };
})();
