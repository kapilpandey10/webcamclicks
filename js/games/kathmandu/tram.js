/* Kathmandu Streets — the city tram (round 19, rebuilt round 21).
   A tram line round the old centre, clockwise on the map: Asan -> Ratna Park
   -> Bhrikutimandap -> New Road. ROUND 21, after riding it for real:
   - it runs in the LEFT kerb lane (Nepal drives on the left), not the middle
     of the road, and stops beside raised platforms on the pavement — no
     more stop shelter in the middle of the road;
   - it obeys the traffic lights: it stops at the stop line on amber and red
     and goes on green;
   - cars behind it queue (traffic.js treats the tram as a vehicle ahead);
   - announcements: "This is Asan — stop 1" when it pulls in, "Next stop:
     Ratna Park — stop 2" when it pulls away (English and Nepali);
   - at every stop the doors on the platform side slide open, passengers
     get off and others get on, then the doors close with a chime;
   - you board by WALKING IN through an open door (Rs 15 is taken
     automatically) and get off by walking out (any movement key) while the
     doors are open; between stops the doors stay shut;
   - inside there are seats, grab poles and ceiling lights — press V for the
     first-person view from your seat.
   The tram is a real 3D model — "Articulated low floor tram" (Modern Rail and
   Metro Network) by 3D Assets, CC0, via https://3d.shep.bot. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const TR = (KS.Tram = { route: [], len: 0, s: 0, v: 0, stops: [], riding: false, FARE: 15, phase: 'run', t: 0, doorK: 0, LEN: 24, people: [], seats: [], walkers: 0, FLOOR: 0.76 });
  const L = (i) => G.line(i);
  const CORNERS = [[L(5), L(4)], [L(7), L(4)], [L(7), L(7)], [L(5), L(7)]]; // street junctions, clockwise
  const R = 9; // corner radius of the street centre line
  const OFF = G.ROAD / 2 - 3.6; // the tram runs this far LEFT of the street centre line: in the left (kerb) lane
  const CAR_W = 2.6;
  let LEN = 24;
  const STOPS = [['Asan', 'असन'], ['Ratna Park', 'रत्नपार्क'], ['Bhrikutimandap', 'भृकुटीमण्डप'], ['New Road', 'न्युरोड']];
  const NP = '०१२३४५६७८९', npNum = (n) => String(n).split('').map((d) => NP[+d]).join('');
  let DOORS = [-0.3, 0, 0.3]; // door positions along the tram (fraction of its length); replaced by the model's own doors once it loads
  const say = (html, near) => { const PL = KS.Player; if (TR.riding || (near && PL && Math.hypot(PL.x - TR.x, PL.z - TR.z) < 60)) KS.Game && KS.Game.notify(html); };

  /* the street centre line: straight runs joined by quarter circles; the track is that line offset to the left */
  function buildRoute() {
    const n = CORNERS.length, mid = [];
    for (let i = 0; i < n; i++) {
      const [ax, az] = CORNERS[i], [bx, bz] = CORNERS[(i + 1) % n], [cx2, cz2] = CORNERS[(i + 2) % n];
      const dx = Math.sign(bx - ax), dz = Math.sign(bz - az), ex = Math.sign(cx2 - bx), ez = Math.sign(cz2 - bz);
      const sx = ax + dx * R, sz = az + dz * R, tx = bx - dx * R, tz = bz - dz * R;
      for (let d = 0; d < Math.hypot(tx - sx, tz - sz); d += 1) mid.push({ x: sx + dx * d, z: sz + dz * d });
      const ox = tx + ex * R, oz = tz + ez * R;
      const a0 = Math.atan2(tz - oz, tx - ox), a1 = Math.atan2(bz + ez * R - oz, bx + ex * R - ox);
      let da = a1 - a0; while (da > Math.PI) da -= 2 * Math.PI; while (da < -Math.PI) da += 2 * Math.PI;
      const steps = Math.ceil(Math.abs(da) * (R + OFF));
      for (let k = 0; k < steps; k++) { const a = a0 + (da * k) / steps; mid.push({ x: ox + Math.cos(a) * R, z: oz + Math.sin(a) * R, corner: true }); }
    }
    const pts = mid.map((p, i) => { // offset every point to the left of travel
      const a = mid[(i - 1 + mid.length) % mid.length], b = mid[(i + 1) % mid.length], h = Math.atan2(b.x - a.x, b.z - a.z);
      return { x: p.x + Math.cos(h) * OFF, z: p.z - Math.sin(h) * OFF, corner: p.corner };
    });
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
  const ahead = (s) => { let d = s - TR.s; while (d < -0.5) d += TR.len; while (d > TR.len) d -= TR.len; return d; };

  TR.build = (scene) => {
    buildRoute();
    const P = TR.route, n = P.length, b = new KS.Builder();
    /* the track: a concrete strip with two grooved rails, flush with the road */
    for (let i = 0; i < n; i += 2) {
      const p = P[i], q = P[(i + 2) % n], mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, h = Math.atan2(q.x - p.x, q.z - p.z), l = Math.hypot(q.x - p.x, q.z - p.z) + 0.1;
      const nx = Math.cos(h), nz = -Math.sin(h);
      b.box(mx, 0.055, mz, 2.4, 0.012, l, 0x8a8780, h);
      for (const u of [-0.72, 0.72]) b.box(mx + nx * u, 0.067, mz + nz * u, 0.08, 0.012, l, 0x9da3a8, h);
      for (const u of [-0.86, -0.58, 0.58, 0.86]) b.box(mx + nx * u, 0.066, mz + nz * u, 0.03, 0.01, l, 0x3a3a3a, h);
    }
    /* overhead line: poles on the kerb (4 m left of the track), an arm out to the wire above the track */
    const wire = [];
    const nearJunction = (x, z) => { for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) if (Math.abs(x - L(i)) < 14 && Math.abs(z - L(j)) < 14) return true; return false; };
    for (let i = 0; i < n; i += 30) {
      const p = P[i]; if (p.corner || nearJunction(p.x, p.z)) continue;
      const lx = Math.cos(p.h), lz = -Math.sin(p.h), px = p.x + lx * 4.0, pz = p.z + lz * 4.0;
      b.cyl(px, 0, pz, 0.13, 6.6, 0x5d646b, 8); KS.addCircle(px, pz, 0.18, 6.6);
      b.box(p.x + lx * 2.0, 6.25, p.z + lz * 2.0, 4.0, 0.09, 0.09, 0x5d646b, p.h + Math.PI / 2);
    }
    for (let i = 0; i < n; i++) { const p = P[i], q = P[(i + 1) % n]; wire.push(p.x, 5.9, p.z, q.x, 5.9, q.z); }
    const wg = new T.BufferGeometry(); wg.setAttribute('position', new T.Float32BufferAttribute(wire, 3));
    scene.add(new T.LineSegments(wg, new T.LineBasicMaterial({ color: 0x222222 })));
    /* stops: on each side, a raised platform at the kerb with a shelter, a numbered sign and a bench */
    const signMats = STOPS.map(([en, np], k) => new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(256, 320, (g, w, h) => {
      g.fillStyle = '#1d4fb8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 10; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 84px sans-serif'; g.fillText('🚋', w / 2, 104);
      g.font = `800 40px ${KS.FONT}`; g.fillText(en, w / 2, 168); g.fillText(np, w / 2, 214);
      g.font = `700 30px ${KS.FONT}`; g.fillText(`STOP ${k + 1} · बिसौनी ${npNum(k + 1)}`, w / 2, 270);
    }) }));
    for (let k = 0; k < 4; k++) {
      // a little past the middle of the side, clear of any mid-block crossing
      const [ax, az] = CORNERS[k], [bx, bz] = CORNERS[(k + 1) % 4];
      const sx = (ax + bx) / 2 + (az === bz ? 22 * Math.sign(bx - ax) : 0), sz = (az + bz) / 2 + (ax === bx ? 22 * Math.sign(bz - az) : 0);
      let best = 0, bd = Infinity; P.forEach((p, i) => { if (p.corner) return; const d = Math.hypot(p.x - sx, p.z - sz); if (d < bd) { bd = d; best = i; } });
      const p = P[best], lx = Math.cos(p.h), lz = -Math.sin(p.h), fx = Math.sin(p.h), fz = Math.cos(p.h);
      // the platform: from the tram's side (1.45 m) out over the kerb, 26 m long, 0.25 m high, with a yellow safety line
      const pu = 1.45, pw = 3.0, pl = 26, px = p.x + lx * (pu + pw / 2), pz = p.z + lz * (pu + pw / 2);
      b.box(px, 0, pz, pw, 0.25, pl, 0xb8b2a6, p.h); b.box(p.x + lx * (pu + 0.25), 0.25, p.z + lz * (pu + 0.25), 0.18, 0.012, pl, 0xf2c418, p.h);
      KS.addBox(px, pz, Math.abs(lx) > 0.5 ? pw : pl, Math.abs(lx) > 0.5 ? pl : pw, 0.25);
      const shx = p.x + lx * 4.6, shz = p.z + lz * 4.6;
      for (const a of [-5, 5]) b.box(shx + fx * a + lx * 0.6, 0.25, shz + fz * a + lz * 0.6, 0.1, 2.5, 0.1, 0x5d646b, p.h);
      b.box(shx + lx * 0.2, 2.75, shz + lz * 0.2, 1.9, 0.1, 10.6, 0x1d4fb8, p.h); // roof
      b.box(shx + lx * 0.85, 0.25, shz + lz * 0.85, 0.06, 1.9, 9.6, 0x9fc6dc, p.h); // glass back wall
      b.box(shx + lx * 0.55, 0.65, shz + lz * 0.55, 0.42, 0.06, 6, 0x8a5a30, p.h); // bench
      const sp = new T.Mesh(new T.PlaneGeometry(1.0, 1.25), signMats[k]); sp.position.set(shx + fx * 6.2, 2.4, shz + fz * 6.2); sp.rotation.y = p.h + Math.PI / 2; scene.add(sp);
      b.cyl(shx + fx * 6.2, 0.25, shz + fz * 6.2, 0.05, 1.6, 0x5d646b, 6);
      TR.stops.push({ s: p.s, k, name: STOPS[k][0], np: STOPS[k][1], x: px, z: pz, h: p.h, waiting: [] });
      if (KS.landmarks) KS.landmarks.push({ id: 'tram-' + k, minor: true, name: `${STOPS[k][0]} tram stop 🚋`, np: STOPS[k][1], x: px, z: pz, r: 10, fact: `Stop ${k + 1} of the city tram. Walk in through an open door to ride (Rs 15, taken automatically).` });
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
    /* the tram: the model, plus an interior and sliding doors on the left (platform) side */
    TR.root = new T.Group(); scene.add(TR.root);
    TR.doors = [];
    if (typeof T.GLTFLoader === 'function') {
      new T.GLTFLoader().load('js/games/kathmandu/models/vehicles/tram.glb', (g) => {
        const lights = []; g.scene.traverse((o) => { if (o.isLight) lights.push(o); }); lights.forEach((o) => o.parent && o.parent.remove(o));
        const wrap = new T.Group(); wrap.add(g.scene);
        let box = new T.Box3().setFromObject(wrap), s = new T.Vector3(); box.getSize(s);
        if (s.x > s.z) { wrap.rotation.y = Math.PI / 2; box = new T.Box3().setFromObject(wrap); box.getSize(s); }
        wrap.scale.setScalar(CAR_W / Math.max(0.1, s.x)); box = new T.Box3().setFromObject(wrap);
        { const s2 = new T.Vector3(); box.getSize(s2); LEN = s2.z; TR.LEN = LEN; }
        const c = new T.Vector3(); box.getCenter(c); wrap.position.set(-c.x, -box.min.y + 0.07, -c.z);
        wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
        TR.root.add(wrap);
        wrap.traverse((o) => { if (o.isMesh && o.name === 'low-floor-tram_0') TR.shell = o; });
        /* ROUND 24: the cabin sits on the model's own floor (0.74 m up; the interior used to be built at 0.36 m, under
           it, so the axles showed), and the doors are the model's own — five pairs of glass leaves per side. The
           platform side is the left of travel (+x here): those doors slide open at stops, and the boarding walk
           uses their positions. */
        wrap.updateMatrixWorld(true); TR.root.updateMatrixWorld(true);
        const inv = new T.Matrix4().copy(TR.root.matrixWorld).invert();
        const doorParts = {};
        wrap.traverse((o) => {
          const m = /^door-([lr])(\d)-([ab])/.exec(o.name || ''); if (!m || !o.isMesh) return;
          const bb = new T.Box3().setFromObject(o).applyMatrix4(inv), c2 = new T.Vector3(); bb.getCenter(c2);
          (doorParts[m[1] + m[2]] = doorParts[m[1] + m[2]] || []).push({ o, leaf: m[3], cx: c2.x, cz: c2.z, z0: o.position.clone() });
        });
        const leftDoors = Object.values(doorParts).filter((parts) => parts[0].cx > 0).sort((p1, p2) => p1[0].cz - p2[0].cz);
        if (leftDoors.length >= 2) {
          DOORS = leftDoors.map((parts) => parts.reduce((t, q) => t + q.cz, 0) / parts.length / LEN);
          for (const parts of leftDoors) {
            const zc = parts.reduce((t, q) => t + q.cz, 0) / parts.length;
            // each leaf slides away from the doorway centre, along the tram: move it in the tram's own space
            const leaves = parts.map((q) => { const dirZ = Math.sign(q.cz - zc) || (q.leaf === 'a' ? -1 : 1); const m = new T.Matrix4().copy(q.o.parent.matrixWorld).invert().multiply(TR.root.matrixWorld); const a0 = new T.Vector3(0, 0, 0).applyMatrix4(m), a1 = new T.Vector3(0, 0, dirZ * 0.62).applyMatrix4(m); return { o: q.o, base: q.z0, slide: a1.sub(a0) }; }); // 0.62 m along the tram, in the leaf's own space
            TR.doors.push({ d: zc / LEN, leaves, model: true });
          }
        }
        // interior: floor, seats facing the aisle, yellow grab poles, a ceiling with light strips — on the model's floor
        const FL = TR.FLOOR, ib = new KS.Builder(), half = LEN / 2 - 1.2;
        ib.box(0, FL - 0.03, 0, CAR_W - 0.3, 0.03, LEN - 1.6, 0x55585c);
        for (let z = -half + 1; z < half - 1; z += 1.6) {
          if (DOORS.some((d) => Math.abs(z - d * LEN) < 1.3)) continue;
          for (const sx of [-0.85, 0.85]) { ib.box(sx, FL, z, 0.5, 0.42, 0.5, 0x1f5fa8); ib.box(sx + Math.sign(sx) * 0.22, FL + 0.42, z, 0.06, 0.55, 0.5, 0x1f5fa8); TR.seats.push({ x: sx, z, h: sx < 0 ? Math.PI / 2 : -Math.PI / 2, who: null }); }
        }
        for (let z = -half; z <= half; z += 2.4) ib.cyl(0.35, FL, z, 0.03, 1.85, 0xf2c418, 6);
        // the cabin lining: light wall panels under the windows (not across the doorways) and a ceiling, so it still
        // reads as a closed car when the shell is hidden from inside
        for (const sx of [-1, 1]) for (let z = -half; z < half; z += 0.8) {
          if (DOORS.some((d) => Math.abs(z + 0.4 - d * LEN) < 0.9)) continue; // the doors face each other on both sides
          ib.box(sx * (CAR_W / 2 - 0.12), FL, z + 0.4, 0.05, 0.9, 0.8, 0xc9ccd0);
        }
        TR.root.add(KS.mesh(ib, KS.M.vc, false));
        const lb = new KS.Builder(); for (const sx of [-0.55, 0.55]) lb.box(sx, 2.85, 0, 0.12, 0.03, LEN - 2.4, 0xffffff);
        TR.root.add(new T.Mesh(lb.build(), new T.MeshBasicMaterial({ color: 0xfff6dc })));
        const ceil = new T.Mesh(new T.BoxGeometry(CAR_W - 0.3, 0.04, LEN - 1.6), new T.MeshLambertMaterial({ color: 0xb8babd, emissive: 0x6a6c70 }));
        ceil.position.set(0, 2.92, 0); TR.root.add(ceil); // lit by its own strips, not the sun
        if (!TR.doors.length) { // a model without named doors: simple sliding panels
          const doorMat = new T.MeshLambertMaterial({ color: 0x2b3a44 });
          for (const d of DOORS) { const leaves = []; for (const side of [-1, 1]) { const leaf = new T.Mesh(new T.BoxGeometry(0.06, 2.0, 0.66), doorMat); leaf.position.set(CAR_W / 2 + 0.01, FL + 1.0, d * LEN + side * 0.33); TR.root.add(leaf); leaves.push({ o: leaf, base: leaf.position.clone(), slide: new T.Vector3(0, 0, side * 0.62) }); } TR.doors.push({ d, leaves }); }
        }
        TR.ready = true;
        for (let i = 0; i < 7; i++) TR.seatNew(KS.pick(['man', 'woman', 'student', 'elder', 'kid', 'woman']));
      }, undefined, () => KS.log && KS.log('tram model failed'));
    }
    /* passengers: a few people waiting at each stop */
    for (const st of TR.stops) for (let i = 0; i < 3; i++) TR.addWaiting(st, KS.pick(['man', 'woman', 'student', 'elder']));
    TR.s = TR.stops[0].s - 60;
    { const f = TR.at(TR.s + LEN * 0.32), r = TR.at(TR.s - LEN * 0.32); TR.x = (f.x + r.x) / 2; TR.z = (f.z + r.z) / 2; TR.h = Math.atan2(f.x - r.x, f.z - r.z); } // a position before the first update
  };
  TR.addWaiting = (st, kind) => {
    if (!KS.makePerson || !KS.scene) return;
    const p = KS.makePerson(kind), fx = Math.sin(st.h), fz = Math.cos(st.h), lx = Math.cos(st.h), lz = -Math.sin(st.h);
    const a = KS.r(-8, 8), u = KS.r(0.6, 1.3);
    const x = st.x + fx * a + lx * u, z = st.z + fz * a + lz * u;
    p.root.position.set(x, 0.25, z); p.root.rotation.y = st.h - Math.PI / 2; KS.scene.add(p.root); // facing the track
    const q = { p, x, z, st, mode: 'wait' }; st.waiting.push(q); TR.people.push(q);
  };
  /* a door's world position: out > 0 is outside the body on the platform side, < 0 inside */
  TR.doorAt = (d, out = 0.9) => {
    const fx = Math.sin(TR.h), fz = Math.cos(TR.h), lx = Math.cos(TR.h), lz = -Math.sin(TR.h);
    return { x: TR.x + fx * d * LEN + lx * (CAR_W / 2 + out), z: TR.z + fz * d * LEN + lz * (CAR_W / 2 + out) };
  };

  /* the traffic light ahead: how far to its stop line (14.5 m before the junction centre, behind the zebra)
     and whether the tram must stop there. Amber works like it does for any driver: stop if you can stop
     comfortably, otherwise you are committed and go through. Red always means stop. */
  function lightAhead() {
    const fx = Math.sin(TR.h), fz = Math.cos(TR.h);
    for (const sg of KS.signals || []) {
      const along = (sg.x - TR.x) * fx + (sg.z - TR.z) * fz, lat = Math.abs((sg.x - TR.x) * fz - (sg.z - TR.z) * fx);
      if (along < LEN / 2 + 9 || along > LEN / 2 + 70 || lat > 10) continue; // not ahead on this street, or already in the junction
      if (TR.commit === sg) return null;
      const ax = Math.abs(fz) > Math.abs(fx) ? 'ns' : 'ew', st = sg.state[ax], d = along - LEN / 2 - 14.5;
      if (st === 'g') return null;
      if (st === 'y' && TR.v * TR.v / (2 * 1.8) > d + 1) { TR.commit = sg; return null; } // too close to stop: go through on amber
      return { d, sg };
    }
    TR.commit = null;
    return null;
  }
  /* a vehicle in the tram's path ahead (cars queue behind the tram, and the tram waits for cars in front of it) */
  function carAhead() {
    const fx = Math.sin(TR.h), fz = Math.cos(TR.h); let best = Infinity;
    for (const v of KS.Traffic.list) {
      if ((v.y || 0) > 2.5 || !v.root.visible) continue;
      const dx = v.x - TR.x, dz = v.z - TR.z, al = dx * fx + dz * fz, lat = Math.abs(dx * fz - dz * fx);
      if (al < LEN / 2 || al > LEN / 2 + 30 || lat > 1.3 + v.type.wid / 2 + 0.3) continue;
      best = Math.min(best, al - LEN / 2 - v.type.len / 2 - 2.5);
    }
    return best;
  }

  TR.update = (dt) => {
    if (!TR.route.length) return;
    const PL = KS.Player;
    let next = null, nd = Infinity;
    for (const st of TR.stops) { if (st === TR.lastStop) continue; const d = ahead(st.s); if (d < nd) { nd = d; next = st; } }
    if (TR.phase === 'run') {
      let want = 8.5;
      want = Math.min(want, Math.sqrt(Math.max(0, 2 * 1.0 * (nd - 0.3))));
      const lt = lightAhead(); TR.red = !!lt;
      if (lt) want = Math.min(want, Math.sqrt(Math.max(0, 2 * 1.8 * Math.max(0, lt.d - 0.3))));
      const car = carAhead(); if (car < Infinity) want = Math.min(want, Math.sqrt(Math.max(0, 2 * 2.0 * Math.max(0, car))));
      const fr = TR.at(TR.s + LEN / 2 + 5);
      if (PL && PL.mode === 'foot' && Math.hypot(PL.x - fr.x, PL.z - fr.z) < 4) { want = 0; if (!TR.bellT || KS.clock - TR.bellT > 2) { TR.bellT = KS.clock; KS.audio && KS.audio.ding && KS.audio.ding(); } }
      if (!isFinite(want)) want = 0;
      TR.v += KS.clamp(want - TR.v, -(TR.red ? 3.2 : 2.4) * dt, 1.0 * dt); // service braking, harder for a red light
      if (!isFinite(TR.v)) TR.v = 0;
      TR.s += Math.max(0, TR.v) * dt;
      if (next && nd < 0.4 && TR.v < 0.3) {
        TR.s = next.s; TR.v = 0; TR.lastStop = next; TR.atStop = next; TR.phase = 'opening'; TR.t = 0;
        say(`🚋 <b>This is ${next.name}</b> — stop ${next.k + 1} · यो <b>${next.np}</b> हो, बिसौनी नं. ${npNum(next.k + 1)}`, true);
        KS.audio && KS.audio.ding && KS.audio.ding();
      }
    } else {
      TR.t += dt; TR.v = 0;
      if (TR.phase === 'opening') { TR.doorK = Math.min(1, TR.doorK + dt / 1.4); if (TR.doorK >= 1) { TR.phase = 'open'; TR.t = 0; TR.exchange(); } }
      else if (TR.phase === 'open') { if (TR.t > 11 && !TR.walkers && !TR.pwalk) { TR.phase = 'closing'; TR.t = 0; KS.audio && KS.audio.beep && KS.audio.beep(1); } }
      else if (TR.phase === 'closing') {
        TR.doorK = Math.max(0, TR.doorK - dt / 1.6);
        if (TR.doorK <= 0) {
          TR.phase = 'run'; TR.atStop = null;
          if (next) say(`🚋 <b>Next stop: ${next.name}</b> — stop ${next.k + 1} · अर्को बिसौनी: <b>${next.np}</b>`, true);
        }
      }
    }
    TR.open = TR.phase === 'open' || (TR.phase === 'opening' && TR.doorK > 0.6);
    /* place the body between its two bogies */
    const f = TR.at(TR.s + LEN * 0.32), r = TR.at(TR.s - LEN * 0.32);
    TR.x = (f.x + r.x) / 2; TR.z = (f.z + r.z) / 2; TR.h = Math.atan2(f.x - r.x, f.z - r.z);
    if (TR.root) { TR.root.position.set(TR.x, 0, TR.z); TR.root.rotation.y = TR.h; }
    TR.updateShell();
    for (const d of TR.doors || []) for (const l of d.leaves) l.o.position.copy(l.base).addScaledVector(l.slide, TR.doorK);
    /* passengers: walking along their path in the tram's own space while they board or get off, seated in between */
    TR.walkers = 0;
    for (let i = TR.people.length - 1; i >= 0; i--) {
      const q = TR.people[i];
      if (q.mode === 'wait' || q.mode === 'seated') continue;
      if (q.mode === 'leave') {
        const dx = q.tx - q.x, dz = q.tz - q.z, d = Math.hypot(dx, dz); q.life -= dt;
        if (d > 0.15) { const k = Math.min(1, (1.3 * dt) / d); q.x += dx * k; q.z += dz * k; q.p.root.rotation.y = Math.atan2(dx, dz); KS.animWalk && KS.animWalk(q.p, dt, 1.3); }
        q.p.root.position.set(q.x, KS.groundAt(q.x, q.z, 1, 1), q.z);
        if (q.life <= 0) { q.p.root.parent && q.p.root.parent.remove(q.p.root); TR.people.splice(i, 1); }
        continue;
      }
      TR.walkers++;
      const r = TR.stepPath(q, dt, 1.4);
      if (r === 'done' && q.mode === 'board') { q.mode = 'seated'; TR.sitAt(q.p, q.seat); }
      else if (r === 'done' && q.mode === 'alight') { // off the tram: back into the world, walking away along the pavement
        const w = TR.toWorld(q.lx, q.lz); KS.scene.add(q.p.root); q.mode = 'leave'; q.x = w.x; q.z = w.z; q.life = 10;
        const a2 = KS.r(-14, 14); q.tx = w.x + Math.cos(TR.h) * 3 + Math.sin(TR.h) * a2; q.tz = w.z - Math.sin(TR.h) * 3 + Math.cos(TR.h) * a2;
      }
    }
    if (PL && PL.mode === 'foot' && TR.ready && TR.open && !TR.pwalk && (PL.y || 0) < 3) {
      const near = DOORS.some((d) => { const dp = TR.doorAt(d, 1); return Math.hypot(PL.x - dp.x, PL.z - dp.z) < 10; });
      if (near && KS.Game && KS.Game.prompt) KS.Game.prompt(`🚋 Press <b>E</b> to board the tram · रु ${TR.FARE} · next: <b>${TR.nextStopName()}</b>`);
    }
    /* the body is solid: push away the player on foot or the player's vehicle */
    const fx = Math.sin(TR.h), fz = Math.cos(TR.h);
    const pushOut = (x, z, rad) => {
      const dx = x - TR.x, dz = z - TR.z, along = dx * fx + dz * fz, lat = dx * fz - dz * fx;
      if (Math.abs(along) > LEN / 2 + rad || Math.abs(lat) > CAR_W / 2 + rad) return null;
      const pushLat = (CAR_W / 2 + rad) * Math.sign(lat || 1), pushAl = (LEN / 2 + rad) * Math.sign(along || 1);
      return Math.abs(pushLat - lat) < Math.abs(pushAl - along) ? { x: TR.x + fx * along + fz * pushLat, z: TR.z + fz * along - fx * pushLat } : { x: TR.x + fx * pushAl + fz * lat, z: TR.z + fz * pushAl - fx * lat };
    };
    if (PL && PL.mode === 'foot' && (PL.y || 0) < 3) {
      if (PL.mode === 'foot') { const q = pushOut(PL.x, PL.z, 0.4); if (q) { PL.x = q.x; PL.z = q.z; } }
    }
    if (PL && PL.vehicle && PL.mode === 'drive' && (PL.vehicle.y || 0) < 3) {
      const v = PL.vehicle, q = pushOut(v.x, v.z, (v.type && v.type.r) || 1);
      if (q) { v.x = q.x; v.z = q.z; if (Math.hypot(v.vx || 0, v.vz || 0) > 5) { KS.audio && KS.audio.crash && KS.audio.crash(0.6); KS.Cam.shake = 0.4; } v.vx = (v.vx || 0) * -0.2; v.vz = (v.vz || 0) * -0.2; }
    }
  };
  /* ---------- tram-local space: x to the left (the door side), z to the front ---------- */
  TR.toWorld = (lx, lz) => { const fx = Math.sin(TR.h), fz = Math.cos(TR.h); return { x: TR.x + fx * lz + Math.cos(TR.h) * lx, z: TR.z + fz * lz - Math.sin(TR.h) * lx }; };
  /* from inside the cabin the body shell's end panels block the aisle: hide it while the camera is in the car */
  TR.updateShell = () => {
    if (!TR.shell || !KS.camera) return;
    const q = KS.camera.position, l = TR.toLocal(q.x, q.z);
    TR.shell.visible = !(Math.abs(l.lx) < CAR_W / 2 && Math.abs(l.lz) < LEN / 2 && q.y < 3.2);
  };
  TR.toLocal = (x, z) => { const dx = x - TR.x, dz = z - TR.z, fx = Math.sin(TR.h), fz = Math.cos(TR.h); return { lx: dx * fz - dz * fx, lz: dx * fx + dz * fz }; };
  const freeSeat = (nearZ) => { let best = null, bd = Infinity; for (const st of TR.seats) { if (st.who) continue; const d = Math.abs(st.z - nearZ) + KS.r(0, 0.5); if (d < bd) { bd = d; best = st; } } return best; };
  /* the walk from outside a door to a seat (and the reverse): out on the platform, the doorway, the aisle, the seat */
  const pathIn = (d, seat) => { const dz = d * LEN; return [[CAR_W / 2 + 0.9, dz], [CAR_W / 2 - 0.3, dz], [0, dz], [0, seat.z], [seat.x * 0.55, seat.z]]; };
  /** walk q (with q.lx/q.lz in tram space and q.path) one step; returns 'done' at the end of the path */
  TR.stepPath = (q, dt, speed) => {
    const tgt = q.path[0]; if (!tgt) return 'done';
    const dx = tgt[0] - q.lx, dz = tgt[1] - q.lz, d = Math.hypot(dx, dz);
    if (d < 0.06) { q.path.shift(); return q.path.length ? 'walk' : 'done'; }
    const k = Math.min(1, (speed * dt) / d); q.lx += dx * k; q.lz += dz * k;
    q.p.root.position.set(q.lx, q.lx > CAR_W / 2 ? 0.25 : TR.FLOOR, q.lz); // on the platform outside, on the cabin floor inside q.p.root.rotation.set(0, Math.atan2(dx, dz), 0); KS.animWalk && KS.animWalk(q.p, dt, speed);
    return 'walk';
  };
  /** sit a person (a child of the tram) on a seat */
  TR.sitAt = (p, seat) => { p.root.position.set(seat.x - Math.sign(seat.x) * 0.05, TR.FLOOR + 0.42 - 0.92 + 0.08, seat.z); p.root.rotation.set(0, seat.h, 0); KS.animSit(p); KS.sitBent(p, true); p.armL.rotation.x = p.armR.rotation.x = -0.6; p.armL.rotation.z = 0.1; p.armR.rotation.z = -0.1; };
  /** a passenger already sitting on board (at the start) */
  TR.seatNew = (kind) => {
    const seat = freeSeat(KS.r(-LEN / 2, LEN / 2)); if (!seat || !KS.makePerson) return;
    const p = KS.makePerson(kind); TR.root.add(p.root); seat.who = p; TR.sitAt(p, seat);
    TR.people.push({ p, seat, mode: 'seated', lx: seat.x, lz: seat.z });
  };
  /* at a stop: a few seated passengers get up and walk out, the people waiting walk in and take seats */
  TR.exchange = () => {
    const st = TR.atStop; if (!st || !KS.makePerson) return;
    const seated = TR.people.filter((q) => q.mode === 'seated' && q.p !== (KS.Player && KS.Player.person));
    for (let i = 0, n = Math.min(seated.length, KS.ri(1, 3)); i < n; i++) {
      const q = seated.splice(Math.floor(KS.rng() * seated.length), 1)[0], d = DOORS.reduce((a, b) => (Math.abs(b * LEN - q.seat.z) < Math.abs(a * LEN - q.seat.z) ? b : a));
      q.seat.who = null; q.mode = 'alight'; q.lx = q.seat.x * 0.55; q.lz = q.seat.z; q.path = pathIn(d, q.seat).reverse().slice(1); q.p.legL.rotation.x = q.p.legR.rotation.x = 0;
    }
    for (const q of st.waiting.splice(0)) {
      const d = KS.pick(DOORS), seat = freeSeat(d * LEN); if (!seat) { st.waiting.push(q); continue; }
      seat.who = q.p; const l = TR.toLocal(q.x, q.z); TR.root.add(q.p.root);
      q.mode = 'board'; q.seat = seat; q.lx = l.lx; q.lz = l.lz; q.path = pathIn(d, seat);
    }
    setTimeout(() => { for (let i = 0, n = KS.ri(1, 3); i < n; i++) TR.addWaiting(st, KS.pick(['man', 'woman', 'student', 'elder', 'kid'])); }, 30000); // new people turn up for the next tram
  };

  /* ---------- you: press E at an open door, walk in and sit down; press E at a stop to walk out ---------- */
  TR.tryBoard = () => {
    const PL = KS.Player;
    if (!TR.ready || !TR.open || PL.mode !== 'foot' || TR.pwalk) return false;
    let best = null, bd = 10;
    for (const d of DOORS) { const dp = TR.doorAt(d, 1); const dd = Math.hypot(PL.x - dp.x, PL.z - dp.z); if (dd < bd) { bd = dd; best = d; } }
    if (best == null) return false;
    const D = KS.Shop && KS.Shop.data;
    if (D) { if (D.cash < TR.FARE) { KS.Game && KS.Game.notify(`🚋 The fare is रु ${TR.FARE} — not enough cash.`, 'bad'); return true; } D.cash -= TR.FARE; KS.Shop.save(); }
    const seat = freeSeat(best * LEN); if (!seat) { KS.Game && KS.Game.notify('🚋 The tram is full — wait for the next one.'); return true; }
    seat.who = PL.person;
    const l = TR.toLocal(PL.x, PL.z);
    TR.pwalk = { dir: 'in', p: PL.person, lx: l.lx, lz: l.lz, path: [[CAR_W / 2 + 0.9, best * LEN - Math.sign(best * LEN - l.lz || 1) * 0.2], ...pathIn(best, seat)], seat };
    TR.root.add(PL.person.root);
    PL.mode = 'tram'; TR.riding = true; KS.Cam.want = 10;
    KS.audio && KS.audio.cash && KS.audio.cash(); KS.Challenges && KS.Challenges.emit('tram');
    KS.Game && KS.Game.notify(`🚋 <b>रु ${TR.FARE}</b> fare paid. Finding you a seat… Next stop: <b>${TR.nextStopName()}</b>.`, 'good');
    return true;
  };
  TR.board = () => TR.tryBoard();
  TR.nextStopName = () => { let best = null, bd = Infinity; for (const st of TR.stops) { if (st === TR.lastStop) continue; const d = ahead(st.s); if (d < bd) { bd = d; best = st; } } return best ? `${best.name} (stop ${best.k + 1})` : ''; };
  TR.rideUpdate = (dt, I) => {
    const PL = KS.Player, w = TR.pwalk;
    if (w) { // walking in or out, automatically
      const r = TR.stepPath(w, dt, 1.6), wp = TR.toWorld(w.lx, w.lz);
      PL.x = wp.x; PL.z = wp.z; PL.y = w.lx > CAR_W / 2 ? 0.25 : TR.FLOOR; PL.h = TR.h + w.p.root.rotation.y;
      if (r === 'done' && w.dir === 'in') { TR.pwalk = null; TR.seat = w.seat; TR.sitAt(PL.person, w.seat); KS.Game && KS.Game.notify('🪑 Seated. Press <b>V</b> to change the view · <b>E</b> at a stop to get off.'); }
      else if (r === 'done' && w.dir === 'out') {
        TR.pwalk = null; TR.riding = false; KS.scene.add(PL.person.root); PL.mode = 'foot'; KS.Cam.want = 4; if (KS.Cam.mode === 2) KS.Cam.mode = 0;
        PL.y = KS.groundAt(PL.x, PL.z, 2, 2); PL.person.root.rotation.set(0, 0, 0);
        KS.Game && KS.Game.notify(`🚋 Welcome to <b>${TR.atStop ? TR.atStop.name : 'the city'}</b>!`);
      }
      return;
    }
    const seat = TR.seat; if (!seat) return;
    const wp = TR.toWorld(seat.x * 0.4, seat.z); PL.x = wp.x; PL.z = wp.z; PL.y = TR.FLOOR - 0.45; // first person: the eye at seated height PL.h = TR.h + seat.h; PL.speed = TR.v;
    TR.sitAt(PL.person, seat);
    if (KS.Game && KS.Game.prompt) KS.Game.prompt(TR.open ? `🚋 <b>${TR.atStop ? TR.atStop.name : ''}</b> — press <b>E</b> to get off · <b>V</b> view` : TR.phase === 'run' ? `🚋 Next stop: <b>${TR.nextStopName()}</b>${TR.red ? ' · 🔴 waiting at the lights' : ''} · <b>V</b> view` : '🚋 Doors closing…');
    if (I.hit('KeyE') || I.hit('KeyEnter')) {
      if (!TR.open) { KS.Game && KS.Game.notify('🚪 The doors are closed — wait for the next stop.'); return; }
      const d = DOORS.reduce((a, b) => (Math.abs(b * LEN - seat.z) < Math.abs(a * LEN - seat.z) ? b : a));
      seat.who = null; TR.seat = null;
      TR.pwalk = { dir: 'out', p: PL.person, lx: seat.x * 0.55, lz: seat.z, path: [...pathIn(d, seat).reverse().slice(1), [CAR_W / 2 + 2.2, d * LEN]] };
      PL.person.legL.rotation.x = PL.person.legR.rotation.x = PL.person.armL.rotation.x = PL.person.armR.rotation.x = 0;
      if (KS.Cam.mode === 2) KS.Cam.mode = 0;
    }
  };
})();
