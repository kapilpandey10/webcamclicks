/* Kathmandu Streets — the city tram (round 19).
   A tram line round the old centre: a one-way loop along the street centre
   lines from Asan east to Ratna Park, south past Tundikhel and Bhrikutimandap,
   west along New Road, and north again past Indra Chowk — clockwise on the
   map. The rails sit in the middle of the road, between the two traffic
   lanes (Nepal drives on the left, so cars never share the tram's strip);
   overhead line poles stand on the left kerb with an arm out to the contact
   wire. Four stops with shelters and blue TRAM STOP signs. The tram itself is
   a real 3D model — "Articulated low floor tram" (Modern Rail and Metro
   Network) by 3D Assets, CC0, via the free 3D Asset Server (https://3d.shep.bot).
   It dwells 12 s at each stop, rings its bell at anyone on the track, and
   you can ride it: press E beside it while it is stopped (fare Rs 20), and E
   again at any stop to get off. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const TR = (KS.Tram = { route: [], len: 0, s: 0, v: 0, dwell: 6, stops: [], riding: false, FARE: 20 });
  const L = (i) => G.line(i);
  /* the loop's corners (street junctions), clockwise: Asan -> Ratna Park -> Bhrikutimandap -> New Road */
  const CORNERS = [[L(5), L(4)], [L(7), L(4)], [L(7), L(7)], [L(5), L(7)]];
  const R = 9; // corner radius inside the junction
  let LEN = 24; const CAR_W = 2.6; // the tram's length (set from the model, scaled to a real 2.6 m width) and width
  const STOPS = [['Asan', 'असन'], ['Ratna Park', 'रत्नपार्क'], ['Bhrikutimandap', 'भृकुटीमण्डप'], ['New Road', 'न्युरोड']];

  /* the route: straight runs joined by quarter circles, sampled every metre */
  function buildRoute() {
    const n = CORNERS.length, pts = [];
    for (let i = 0; i < n; i++) {
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % n], [cx2, cz2] = CORNERS[(i + 2) % n];
      const dx = Math.sign(bx - ax), dz = Math.sign(bz - az), ex = Math.sign(cx2 - bx), ez = Math.sign(cz2 - bz);
      const sx = ax + dx * R, sz = az + dz * R, tx = bx - dx * R, tz = bz - dz * R;
      const L2 = Math.hypot(tx - sx, tz - sz);
      for (let d = 0; d < L2; d += 1) pts.push({ x: sx + dx * d, z: sz + dz * d });
      // quarter turn at corner b, from heading (dx,dz) to (ex,ez)
      const ox = bx - dx * R + ex * R, oz = bz - dz * R + ez * R; // centre of the arc
      const a0 = Math.atan2(tz - oz, tx - ox), a1 = Math.atan2(bz + ez * R - oz, bx + ex * R - ox);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const steps = Math.ceil(Math.abs(da) * R);
      for (let k = 0; k < steps; k++) { const a = a0 + (da * k) / steps; pts.push({ x: ox + Math.cos(a) * R, z: oz + Math.sin(a) * R }); }
    }
    let s = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; p.s = s; p.h = Math.atan2(q.x - p.x, q.z - p.z); s += Math.hypot(q.x - p.x, q.z - p.z); }
    TR.route = pts; TR.len = s;
  }
  TR.at = (s) => {
    const P = TR.route, n = P.length; s = ((s % TR.len) + TR.len) % TR.len;
    let lo = 0, hi = n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (P[m].s <= s) lo = m; else hi = m - 1; }
    const a = P[lo], b = P[(lo + 1) % n], seg = (lo + 1 < n ? b.s : TR.len) - a.s, t = seg > 0 ? (s - a.s) / seg : 0;
    return { x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t, h: a.h };
  };

  TR.build = (scene) => {
    buildRoute();
    const P = TR.route, n = P.length;
    /* the track: a concrete strip with two steel rails, flush with the road */
    const b = new KS.Builder();
    for (let i = 0; i < n; i += 2) {
      const p = P[i], q = P[(i + 2) % n], mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, h = Math.atan2(q.x - p.x, q.z - p.z), l = Math.hypot(q.x - p.x, q.z - p.z) + 0.1;
      const nx = Math.cos(h), nz = -Math.sin(h);
      b.box(mx, 0.055, mz, 2.4, 0.012, l, 0x8a8780, h);
      for (const u of [-0.72, 0.72]) b.box(mx + nx * u, 0.067, mz + nz * u, 0.08, 0.012, l, 0x9da3a8, h);
      for (const u of [-0.86, -0.58, 0.58, 0.86]) b.box(mx + nx * u, 0.066, mz + nz * u, 0.03, 0.01, l, 0x3a3a3a, h); // the grooves
    }
    /* overhead line: a pole on the left kerb every 30 m with an arm out to
       the contact wire 5.9 m up — none in the junction mouths */
    const wire = [];
    const nearJunction = (x, z) => { for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) if (Math.abs(x - L(i)) < 13 && Math.abs(z - L(j)) < 13) return true; return false; };
    for (let i = 0; i < n; i += 30) {
      const p = P[i]; if (nearJunction(p.x, p.z)) continue;
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), px = p.x + lx * 8.6, pz = p.z + lz * 8.6;
      b.cyl(px, 0, pz, 0.13, 6.6, 0x5d646b, 8); KS.addCircle(px, pz, 0.18, 6.6);
      b.box((px + p.x) / 2, 6.25, (pz + p.z) / 2, 8.6, 0.09, 0.09, 0x5d646b, p.h + Math.PI / 2);
    }
    for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; wire.push(p.x, 5.9, p.z, q.x, 5.9, q.z); }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wire, 3));
    scene.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0x222222 })));
    /* stops: midway along each side, a shelter on the left pavement */
    const signTex = KS.tex(256, 256, (g, w, h) => {
      g.fillStyle = '#1d4fb8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 110px sans-serif'; g.fillText('🚋', w / 2, 128);
      g.font = `700 34px ${KS.FONT}`; g.fillText('TRAM STOP', w / 2, 180); g.fillText('ट्राम बिसौनी', w / 2, 222);
    });
    const signMat = new T.MeshLambertMaterial({ map: signTex, side: T.DoubleSide });
    for (let k = 0; k < 4; k++) {
      const [ax, az] = CORNERS[k], [bx, bz] = CORNERS[(k + 1) % 4], sx = (ax + bx) / 2, sz = (az + bz) / 2;
      let best = 0, bd = Infinity; P.forEach((p, i) => { const d = Math.hypot(p.x - sx, p.z - sz); if (d < bd) { bd = d; best = i; } });
      const p = P[best], lx = Math.cos(p.h), lz = -Math.sin(p.h), x = p.x + lx * 10.2, z = p.z + lz * 10.2;
      b.box(x, 0, z, 1.6, 0.02, 7, 0x9a9a9a, p.h);
      for (const a of [-3, 3]) { b.box(x + Math.sin(p.h) * a + lx * 0.6, 0, z + Math.cos(p.h) * a + lz * 0.6, 0.1, 2.6, 0.1, 0x5d646b, p.h); }
      b.box(x + lx * 0.2, 2.6, z + lz * 0.2, 1.9, 0.1, 7.2, 0x1d4fb8, p.h); // roof
      b.box(x + lx * 0.7, 0.4, z + lz * 0.7, 0.4, 0.06, 5, 0x8a5a30, p.h); // bench
      const sp = new T.Mesh(new T.PlaneGeometry(1.1, 1.1), signMat); sp.position.set(x + Math.sin(p.h) * 4.2, 2.4, z + Math.cos(p.h) * 4.2); sp.rotation.y = p.h + Math.PI / 2; scene.add(sp);
      b.cyl(x + Math.sin(p.h) * 4.2, 0, z + Math.cos(p.h) * 4.2, 0.05, 1.9, 0x5d646b, 6);
      TR.stops.push({ s: p.s, name: STOPS[k][0], np: STOPS[k][1], x, z });
      if (KS.landmarks) KS.landmarks.push({ id: 'tram-' + k, minor: true, name: `${STOPS[k][0]} tram stop 🚋`, np: STOPS[k][1], x, z, r: 8, fact: 'The city tram stops here. Press E beside it while it waits to ride (Rs 20).' });
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
    /* the tram model */
    TR.root = new T.Group(); scene.add(TR.root);
    if (typeof T.GLTFLoader === 'function') {
      new T.GLTFLoader().load('js/games/kathmandu/models/vehicles/tram.glb', (g) => {
        const lights = []; g.scene.traverse((o) => { if (o.isLight) lights.push(o); }); lights.forEach((o) => o.parent && o.parent.remove(o)); // models exported with their own lamps (one home model carried a 3x sun): never let them light our world
        const wrap = new T.Group(); wrap.add(g.scene);
        let box = new T.Box3().setFromObject(wrap), s = new T.Vector3(); box.getSize(s);
        if (s.x > s.z) { wrap.rotation.y = Math.PI / 2; box = new T.Box3().setFromObject(wrap); box.getSize(s); } // long side along +z
        wrap.scale.setScalar(CAR_W / Math.max(0.1, s.x)); box = new T.Box3().setFromObject(wrap); { const s2 = new T.Vector3(); box.getSize(s2); LEN = s2.z; TR.LEN = LEN; }
        const c = new T.Vector3(); box.getCenter(c); wrap.position.set(-c.x, -box.min.y + 0.07, -c.z);
        wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        TR.root.add(wrap); TR.ready = true;
      }, undefined, () => KS.log && KS.log('tram model failed'));
    }
    TR.s = TR.stops[0].s - 40; TR.dwell = 0;
  };

  TR.update = (dt) => {
    if (!TR.route.length) return;
    const PL = KS.Player;
    /* the next stop ahead, and how far */
    let next = null, nd = Infinity;
    for (const st of TR.stops) { if (st === TR.lastStop && TR.dwell <= 0) continue; let d = st.s - TR.s; if (d < -0.5) d += TR.len; if (d < nd) { nd = d; next = st; } } // the stop it just left is behind it
    if (TR.dwell > 0) { TR.dwell -= dt; TR.v = 0; TR.atStop = TR.lastStop; }
    else {
      TR.atStop = null;
      let want = 8.5; // 30 km/h in the city
      want = Math.min(want, Math.sqrt(Math.max(0, 2 * 1.0 * (nd - 0.3)))); // brake smoothly into the stop
      // someone on the track ahead: slow, stop, ring the bell
      const ahead = TR.at(TR.s + LEN / 2 + 5);
      if (PL && PL.mode === 'foot' && Math.hypot(PL.x - ahead.x, PL.z - ahead.z) < 4) { want = 0; if (!TR.bellT || KS.clock - TR.bellT > 2) { TR.bellT = KS.clock; KS.audio && KS.audio.ding && KS.audio.ding(); } }
      TR.v += KS.clamp(want - TR.v, -1.6 * dt, 1.0 * dt);
      TR.s += TR.v * dt;
      if (nd < 0.4 && TR.v < 0.3) { TR.s = next.s; TR.v = 0; TR.dwell = 12; TR.lastStop = next; TR.atStop = next; }
    }
    /* place the body between its two bogies, so it swings through the corners like a real tram */
    const f = TR.at(TR.s + LEN * 0.32), r = TR.at(TR.s - LEN * 0.32);
    TR.x = (f.x + r.x) / 2; TR.z = (f.z + r.z) / 2; TR.h = Math.atan2(f.x - r.x, f.z - r.z);
    TR.root.position.set(TR.x, 0, TR.z); TR.root.rotation.y = TR.h;
    /* a pedestrian in its way is pushed aside (the tram never goes through anyone) */
    if (PL && PL.mode === 'foot') {
      const fx = Math.sin(TR.h), fz = Math.cos(TR.h), dx = PL.x - TR.x, dz = PL.z - TR.z, along = dx * fx + dz * fz, lat = dx * fz - dz * fx;
      if (Math.abs(along) < LEN / 2 && Math.abs(lat) < CAR_W / 2 + 0.4 && (PL.y || 0) < 3) { const push = (CAR_W / 2 + 0.4) * Math.sign(lat || 1); PL.x = TR.x + fx * along + fz * push; PL.z = TR.z + fz * along - fx * push; }
    }
  };

  /* boarding and riding */
  TR.tryBoard = () => {
    const PL = KS.Player;
    if (!TR.ready || !TR.atStop || PL.mode !== 'foot') return false;
    if (Math.hypot(PL.x - TR.x, PL.z - TR.z) > LEN / 2 + 3) return false;
    const D = KS.Shop && KS.Shop.data;
    if (D) { if (D.cash < TR.FARE) { KS.Game && KS.Game.notify(`🚋 The fare is रु ${TR.FARE} — not enough cash.`, 'bad'); return true; } D.cash -= TR.FARE; KS.Shop.save(); }
    PL.mode = 'tram'; TR.riding = true; KS.Cam.want = 14;
    KS.Game && KS.Game.notify(`🚋 Fare रु ${TR.FARE} paid. Next stop: <b>${TR.nextStopName()}</b>. Press <b>E</b> at any stop to get off.`, 'good');
    return true;
  };
  TR.nextStopName = () => { let best = null, bd = Infinity; for (const st of TR.stops) { let d = st.s - TR.s; if (d < 1) d += TR.len; if (d < bd) { bd = d; best = st; } } return best ? best.name : ''; };
  TR.rideUpdate = (dt, I) => {
    const PL = KS.Player, p = PL.person;
    PL.x = TR.x; PL.z = TR.z; PL.y = 0.35; PL.h = TR.h; PL.speed = TR.v;
    p.root.position.set(TR.x + Math.cos(TR.h) * 0.6, 0.45 - 0.92 + 0.5, TR.z - Math.sin(TR.h) * 0.6); p.root.rotation.set(0, TR.h, 0); KS.animSit(p);
    if (KS.Game && KS.Game.prompt) KS.Game.prompt(TR.atStop ? `🚋 <b>${TR.atStop.name}</b> — press <b>E</b> to get off` : `🚋 Next stop: <b>${TR.nextStopName()}</b>`);
    if ((I.hit('KeyE') || I.hit('KeyEnter')) && TR.atStop) {
      const lx = Math.cos(TR.h), lz = -Math.sin(TR.h);
      PL.mode = 'foot'; TR.riding = false; KS.Cam.want = 4;
      PL.x = TR.x + lx * 3.2; PL.z = TR.z + lz * 3.2; PL.y = KS.groundAt(PL.x, PL.z, 5, 6);
      p.legL.rotation.x = p.legR.rotation.x = p.armL.rotation.x = p.armR.rotation.x = 0;
      KS.Game && KS.Game.notify(`🚋 Welcome to ${TR.atStop.name}!`);
    }
  };
})();
