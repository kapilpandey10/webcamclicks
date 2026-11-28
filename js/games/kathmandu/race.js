/* Kathmandu Streets — the Ring Road Race (round 25).
   A 2-lap race round the whole Ring Road for 2 to 8 players in a room.
   - Race HQ by the start/finish gantry on the west side (Thulo Bharyang to
     Sitapaila): walk or drive up and press E to join. A race needs at least
     2 racers; alone, E gives a solo practice run (no prize).
   - The host runs the lobby (15 s once 2 have joined), puts everyone on a
     staggered grid in identical race cars, and starts the lights: five reds
     come on one a second, then they go out — GO.
   - The race uses the inner carriageway (the left side, as Nepal drives).
     While a race is on, the road is closed: armco barriers along the edge,
     red-and-white water barriers across every side road and median gap,
     traffic and walkers cleared off, and a wall you cannot drive through.
   - On the road: potholes (a jolt and lost speed), water puddles (a splash
     and a twitch), stones (hit one and you bounce off it), chevron speed
     boosters (a 2.4 s kick), painted distance markers every 500 m with boards
     beside them, flags, banners, bunting and a crowd at the start.
   - HUD: lap, position, race time, distance to the finish, a mini race map
     with every racer, and the order. R puts you back on the track.
   Everything is placed from a fixed seed, so every screen has the same
   track. Race messages ride the room's reliable channel (net.js 'race'). */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const RC = (KS.Race = { state: 'idle', list: [], racers: new Map(), boostT: 0, practice: false });
  const LAPS = 2, U_IN = 1.55, U_OUT = 10.05, U_MID = 5.8, LOBBY_MS = 15000, GRID_MS = 7000, PRIZE = [1000, 500, 250];
  const CAR = 'sportscar', TICKET = 50, REFUND_MS = 180000;
  /** where you are playing: 'off' (alone), 'world' (the public world), 'private' (a friends' room), 'race' (the Race Room) */
  const kind = () => (!(KS.Net && (KS.Net.state === 'host' || KS.Net.state === 'guest')) ? 'off' : KS.Net.public ? (KS.Net.pubKind === 'race' ? 'race' : 'world') : 'private');
  const ticket = () => KS.Shop && KS.Shop.data.raceTicket;
  RC.ads = []; // ticket buyers announced in the public world: { name, t }
  let trk = null, s0 = 0, evGroup = null, hq = null, lamps = [], boosterTex = null, flagInst = null, flagBase = [], crowd = [];
  const hazards = [], boosters = [], mouths = [], medGaps = [];
  let hint = null, me = null, car = null, prevVeh = null, hud = null, mapBase = null;
  let clk = 0; // the race clock (ms): game time, so a paused game pauses the race and lap times match the physics
  const now = () => clk;
  const A = () => KS.audio || {};
  const notify = (h, c) => KS.Game && KS.Game.notify(h, c);
  const myId = () => (KS.Net && KS.Net.me && KS.Net.state !== 'off' ? KS.Net.me : 'me');
  const inRoom = () => KS.Net && (KS.Net.state === 'host' || KS.Net.state === 'guest');
  const isHost = () => !inRoom() || KS.Net.state === 'host';
  const nameOf = (id) => (id === myId() ? (KS.Net && KS.Net.name ? KS.Net.name() : 'You') : ((KS.Net && KS.Net.players.get(id)) || {}).name || 'Racer');
  const colorOf = (id) => (id === myId() ? '#ffffff' : ((KS.Net && KS.Net.players.get(id)) || {}).color || '#ff4fa3');
  const rnd = (() => { let a = 20261127; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; })();
  const rr = (a, b) => a + rnd() * (b - a);

  /* ---------- the track: the Ring Road's own samples, s = metres along the loop ---------- */
  function buildTrack() {
    const P = KS.ringLoopPts, n = P.length;
    trk = { n, L: KS.ringLoopLen, X: P.map((p) => p.x), Z: P.map((p) => p.z), S: P.map((p) => p.s) };
  }
  const wrap = (s) => ((s % trk.L) + trk.L) % trk.L;
  function idxAt(s) { let lo = 0, hi = trk.n - 1; while (lo < hi) { const m = (lo + hi + 1) >> 1; if (trk.S[m] <= s) lo = m; else hi = m - 1; } return lo; }
  /** a point on the track: s along the loop, u metres to the left of travel (the race side is u > 0) */
  function at(s, u = 0) {
    s = wrap(s); const { X, Z, S, n, L } = trk, i = idxAt(s), j = (i + 1) % n;
    const seg = (j ? S[j] : L) - S[i], f = seg > 0 ? (s - S[i]) / seg : 0, dx = X[j] - X[i], dz = Z[j] - Z[i], len = Math.hypot(dx, dz) || 1;
    const h = Math.atan2(dx, dz), lx = dz / len, lz = -dx / len;
    return { x: X[i] + dx * f + lx * u, z: Z[i] + dz * f + lz * u, h, lx, lz };
  }
  /** nearest track point to (x, z): returns s, u and the segment */
  function proj(x, z, h0) {
    const { X, Z, S, n } = trk; let best = Infinity, out = null;
    const scan = (i) => {
      const j = (i + 1) % n, dx = X[j] - X[i], dz = Z[j] - Z[i], L2 = dx * dx + dz * dz || 1, t = KS.clamp(((x - X[i]) * dx + (z - Z[i]) * dz) / L2, 0, 1);
      const px = X[i] + dx * t, pz = Z[i] + dz * t, d2 = (x - px) ** 2 + (z - pz) ** 2;
      if (d2 < best) { best = d2; const len = Math.sqrt(L2), lx = dz / len, lz = -dx / len; out = { i, s: S[i] + t * len, u: (x - px) * lx + (z - pz) * lz, lx, lz, h: Math.atan2(dx, dz) }; }
    };
    if (h0 == null) for (let i = 0; i < n; i++) scan(i); else for (let k = -14; k <= 14; k++) scan((h0 + k + n) % n);
    if (h0 != null && best > 400) return proj(x, z); // far from where we last were (a reset, a teleport): search the whole loop
    out.s = wrap(out.s); return out;
  }
  const gy = (x, z) => Math.max(KS.heightAt(x, z), 0); // the Ring Road ribbon is level (0.07), over the Bagmati too
  const ahead = (s, from) => wrap(s - from); // how far s lies past `from`, along the race direction

  /* ---------- canvas textures ---------- */
  function canvasTex(w, h, draw, rep) { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); const t = new T.CanvasTexture(c); t.anisotropy = 4; if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; } return t; }
  const FONT = '"Barlow Condensed", "Arial Narrow", Arial, sans-serif';
  function bannerTex(lines, bg, fg) {
    return canvasTex(1024, 160, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      for (let x = 0; x < w; x += 20) for (let y = 0; y < 2; y++) { g.fillStyle = (x / 20 + y) % 2 ? '#111' : '#fff'; g.fillRect(x, y * 10, 20, 10); g.fillRect(x, h - 20 + y * 10, 20, 10); }
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `800 ${lines.length > 1 ? 58 : 82}px ${FONT}`; g.fillText(lines[0], w / 2, lines.length > 1 ? 62 : h / 2);
      if (lines[1]) { g.font = `700 40px ${FONT}`; g.fillText(lines[1], w / 2, 114); }
    });
  }
  const checkerTex = () => canvasTex(256, 32, (g, w, h) => { for (let x = 0; x < 16; x++) for (let y = 0; y < 2; y++) { g.fillStyle = (x + y) % 2 ? '#141414' : '#f4f4f4'; g.fillRect(x * 16, y * 16, 16, 16); } });
  function paintTex(text) { // road paint: worn white letters on transparent
    return canvasTex(512, 200, (g, w, h) => {
      g.fillStyle = 'rgba(245,245,240,0.92)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.font = `800 150px ${FONT}`; g.fillText(text, w / 2, h / 2 + 6);
      g.globalCompositeOperation = 'destination-out'; for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.5})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 3, 2); }
    });
  }
  const potholeTex = () => canvasTex(128, 128, (g, w, h) => {
    const pts = []; for (let k = 0; k < 18; k++) { const a = (k / 18) * Math.PI * 2, r = 40 + Math.random() * 18; pts.push([w / 2 + Math.cos(a) * r, h / 2 + Math.sin(a) * r]); }
    const path = (sc) => { g.beginPath(); pts.forEach(([x, y], k) => { const X2 = w / 2 + (x - w / 2) * sc, Y2 = h / 2 + (y - h / 2) * sc; k ? g.lineTo(X2, Y2) : g.moveTo(X2, Y2); }); g.closePath(); };
    path(1.12); g.fillStyle = 'rgba(70,68,64,0.85)'; g.fill(); // broken asphalt rim
    path(1); const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, 56); gr.addColorStop(0, '#0e0d0c'); gr.addColorStop(0.7, '#1e1c1a'); gr.addColorStop(1, '#3a3733'); g.fillStyle = gr; g.fill();
    for (let i = 0; i < 70; i++) { g.fillStyle = `rgba(${120 + Math.random() * 60},${115 + Math.random() * 50},${105 + Math.random() * 40},0.8)`; g.fillRect(w / 2 + (Math.random() - 0.5) * 80, h / 2 + (Math.random() - 0.5) * 80, 2, 2); } // gravel
    g.strokeStyle = 'rgba(20,20,20,0.7)'; g.lineWidth = 1.5; for (let i = 0; i < 5; i++) { const a = Math.random() * 7; g.beginPath(); g.moveTo(w / 2 + Math.cos(a) * 50, h / 2 + Math.sin(a) * 50); g.lineTo(w / 2 + Math.cos(a) * 63, h / 2 + Math.sin(a + 0.2) * 63); g.stroke(); } // cracks
  });
  const chevronTex = () => canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = 'rgba(10,12,16,0.88)'; g.fillRect(0, 0, w, h);
    for (let k = 0; k < 3; k++) {
      const y = 30 + k * 82; const gr = g.createLinearGradient(0, y, 0, y + 60); gr.addColorStop(0, '#fff6b0'); gr.addColorStop(1, '#ff8a00'); g.fillStyle = gr;
      g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w - 12, y + 44); g.lineTo(w - 12, y + 66); g.lineTo(w / 2, y + 22); g.lineTo(12, y + 66); g.lineTo(12, y + 44); g.closePath(); g.fill();
    }
  }, true);

  /* ---------- building the event: barriers, flags, hazards, boosters, markers, crowd ---------- */
  function addPlane(group, tex, w, h, x, y, z, ry, flat, opt = {}) {
    const geo = new T.PlaneGeometry(w, h); if (flat) geo.rotateX(-Math.PI / 2);
    const mat = new T.MeshLambertMaterial({ map: tex, transparent: !!opt.transparent, depthWrite: !opt.transparent, side: opt.double ? T.DoubleSide : T.FrontSide, polygonOffset: flat, polygonOffsetFactor: -3, polygonOffsetUnits: -3, emissive: opt.glow ? 0xffffff : 0x000000, emissiveMap: opt.glow ? tex : null, emissiveIntensity: opt.glow || 0 });
    const m = new T.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.y = ry; m.receiveShadow = flat; group.add(m); return m;
  }
  function buildEvent(scene) {
    const { L } = trk;
    evGroup = new T.Group(); evGroup.visible = false; scene.add(evGroup);
    hq = new T.Group(); scene.add(hq);
    const b = new KS.Builder(), hb = new KS.Builder();
    // junctions: the median gaps (all of them) and side-road mouths on the race side
    for (const w of KS.RING_LOOP) {
      const sw = trk.S[w.i]; medGaps.push(sw);
      const c = (KS.ringConnectors || []).find((q) => q.name === w.name);
      if (c) { const p = at(sw), dot = (c.x2 - c.x1) * p.lx + (c.z2 - c.z1) * p.lz; if (dot > 0) mouths.push(sw); }
    }
    const inMouth = (s) => mouths.some((m) => Math.abs(((s - m + L * 1.5) % L) - L / 2) < 15);
    const inGap = (s) => medGaps.some((m) => Math.abs(((s - m + L * 1.5) % L) - L / 2) < 13);
    // armco along the edge; red and white water barriers across side roads
    const STEP = 4;
    for (let s = 0; s < L; s += STEP) {
      const a = at(s, 11.3), c = at(s + STEP, 11.3), mx = (a.x + c.x) / 2, mz = (a.z + c.z) / 2, len = Math.hypot(c.x - a.x, c.z - a.z), ry = Math.atan2(c.x - a.x, c.z - a.z), g = gy(mx, mz);
      if (inMouth(s + STEP / 2)) { b.box(mx, g, mz, 0.6, 0.95, len - 0.15, Math.floor(s / STEP) % 2 ? 0xd12b2b : 0xf2f2f2, ry); continue; }
      b.box(mx, g + 0.42, mz, 0.1, 0.34, len + 0.05, 0xb9bec4, ry); // the W-beam
      b.box(a.x, g, a.z, 0.12, 0.82, 0.12, 0x6f747a, ry); // post
      if (Math.floor(s / STEP) % 6 === 0) b.box(a.x - a.lx * 0.07, g + 0.5, a.z - a.lz * 0.07, 0.04, 0.12, 0.1, 0xff9f1a, ry); // amber reflector
    }
    for (const m of mouths) for (const off of [-15, 15]) { const p = at(m + off, 11.6), g = gy(p.x, p.z); for (let k = 0; k < 3; k++) { b.cyl(p.x - p.lx * k * 0.6, g, p.z - p.lz * k * 0.6, 0.38, 0.26, 0x151515, 10); b.cyl(p.x - p.lx * k * 0.6, g + 0.27, p.z - p.lz * k * 0.6, 0.38, 0.26, 0x151515, 10); b.cyl(p.x - p.lx * k * 0.6, g + 0.54, p.z - p.lz * k * 0.6, 0.38, 0.26, k % 2 ? 0xd12b2b : 0xf2f2f2, 10); } } // tyre stacks
    for (const m of medGaps) for (let s = m - 12; s <= m + 12; s += 2) { const p = at(s, 0.45), c = at(s + 2, 0.45), g = gy(p.x, p.z); b.box((p.x + c.x) / 2, g, (p.z + c.z) / 2, 0.6, 0.95, 1.9, Math.round(s) % 4 < 2 ? 0xd12b2b : 0xf2f2f2, Math.atan2(c.x - p.x, c.z - p.z)); }
    // road-closed signs facing each side road
    const closedTex = bannerTex(['ROAD CLOSED', 'RACE IN PROGRESS · सडक बन्द'], '#d12b2b', '#ffffff');
    for (const m of mouths) { const p = at(m, 12.4), g = gy(p.x, p.z); b.box(p.x, g, p.z, 0.1, 1.6, 0.1, 0x555555, p.h); addPlane(evGroup, closedTex, 3.6, 0.6, p.x, g + 1.9, p.z, p.h - Math.PI / 2, false, { double: true }); }
    // flags behind the barrier, banners on it
    const flagCols = [0xd4202b, 0x1f4fb8, 0xf2c418, 0xf4f4f4, 0x1f8a3c, 0xff7a00];
    const flagPts = [];
    for (let s = 10; s < L; s += 30) { if (inMouth(s)) continue; const p = at(s, 12.3), g = gy(p.x, p.z); b.cyl(p.x, g, p.z, 0.04, 4.6, 0xdedede, 6); flagPts.push({ x: p.x, y: g + 4.1, z: p.z, h: p.h, c: flagCols[flagPts.length % flagCols.length] }); }
    const fgeo = new T.PlaneGeometry(1.4, 0.9); fgeo.translate(0.72, 0, 0);
    flagInst = new T.InstancedMesh(fgeo, new T.MeshLambertMaterial({ side: T.DoubleSide }), flagPts.length);
    const dm = new T.Object3D(), col = new T.Color();
    flagPts.forEach((f, k) => { dm.position.set(f.x, f.y, f.z); dm.rotation.set(0, f.h + Math.PI / 2, 0); dm.updateMatrix(); flagInst.setMatrixAt(k, dm.matrix); flagInst.setColorAt(k, col.setHex(f.c)); flagBase.push(f); });
    evGroup.add(flagInst);
    const banTex = bannerTex(['RING ROAD RACE · चक्रपथ दौड', 'KATHMANDU STREETS · 2 LAPS'], '#0f2a5c', '#ffd23f');
    const bgeo = new T.PlaneGeometry(5.6, 0.62), bmat = new T.MeshLambertMaterial({ map: banTex, side: T.DoubleSide });
    const banPts = []; for (let s = 40; s < L; s += 52) if (!inMouth(s) && !inMouth(s + 4)) banPts.push(s);
    const ban = new T.InstancedMesh(bgeo, bmat, banPts.length);
    banPts.forEach((s, k) => { const p = at(s, 11.22), g = gy(p.x, p.z); dm.position.set(p.x, g + 0.6, p.z); dm.rotation.set(0, p.h - Math.PI / 2, 0); dm.updateMatrix(); ban.setMatrixAt(k, dm.matrix); });
    evGroup.add(ban);
    // the start/finish gantry (always there: it is the Race HQ), with five start lights
    {
      const p0 = at(s0, U_MID), g = gy(p0.x, p0.z), pl = at(s0, -0.2), pr = at(s0, 11.9);
      for (const p of [pl, pr]) { hb.box(p.x, g, p.z, 0.9, 7.2, 0.9, 0x23262b, p0.h); hb.box(p.x, g, p.z, 1.3, 0.5, 1.3, 0x3a3d42, p0.h); }
      const mid = at(s0, 5.85);
      hb.box(mid.x, g + 6.3, mid.z, 12.9, 1.5, 0.7, 0x1a1c20, p0.h);
      const gTex = bannerTex(['RING ROAD RACE', 'START · FINISH  ·  चक्रपथ दौड'], '#c8102e', '#ffffff');
      addPlane(hq, gTex, 12.6, 1.4, mid.x - Math.sin(p0.h) * 0.37, g + 7.05, mid.z - Math.cos(p0.h) * 0.37, p0.h + Math.PI, false, { glow: 0.25 });
      addPlane(hq, gTex, 12.6, 1.4, mid.x + Math.sin(p0.h) * 0.37, g + 7.05, mid.z + Math.cos(p0.h) * 0.37, p0.h, false, { glow: 0.25 });
      for (let k = 0; k < 5; k++) { // the lights hang under the beam, facing the grid
        const lp = at(s0 - 0.45, 3.9 + k * 0.95), mat = new T.MeshBasicMaterial({ color: 0x2a0606 });
        hb.box(lp.x, g + 4.7, lp.z, 0.7, 1.55, 0.35, 0x0c0c0c, p0.h);
        for (const dy of [5.0, 5.6]) { const m = new T.Mesh(new T.SphereGeometry(0.2, 12, 8), mat); m.position.set(lp.x - Math.sin(p0.h) * 0.2, g + dy, lp.z - Math.cos(p0.h) * 0.2); hq.add(m); }
        lamps.push(mat);
      }
      addPlane(hq, checkerTex(), 1.6, 10.2, p0.x, g + 0.085, p0.z, p0.h + Math.PI / 2, true); // the chequered line
      // grid boxes
      for (let k = 0; k < 10; k++) { const q = gridSlot(k), gg = gy(q.x, q.z), sx = Math.sin(q.h), sz = Math.cos(q.h), lx = Math.cos(q.h), lz = -Math.sin(q.h); hb.box(q.x + sx * 2.6, gg + 0.06, q.z + sz * 2.6, 2.4, 0.02, 0.18, 0xf4f4f4, q.h); for (const sd of [-1.15, 1.15]) hb.box(q.x + sx * 2.1 + lx * sd, gg + 0.06, q.z + sz * 2.1 + lz * sd, 0.14, 0.02, 1.1, 0xf4f4f4, q.h); }
      // Race HQ: a tent by the road where you sign up
      const t = at(s0 - 26, 14.5), tg = gy(t.x, t.z);
      for (const [a2, b2] of [[-1.5, -1.5], [1.5, -1.5], [-1.5, 1.5], [1.5, 1.5]]) hb.cyl(t.x + a2, tg, t.z + b2, 0.05, 2.4, 0xcccccc, 6);
      hb.box(t.x, tg + 2.35, t.z, 3.4, 0.3, 3.4, 0xc8102e, p0.h); hb.roof(t.x, tg + 2.65, t.z, 3.4, 1.0, 0xf4f4f4, 0.04);
      hb.box(t.x - Math.cos(p0.h) * 0.9, tg, t.z + Math.sin(p0.h) * 0.9, 0.7, 0.9, 2.2, 0x2a2d33, p0.h); // the sign-up desk
      const hqTex = bannerTex(['RACE HQ 🏁', 'Press E · दौडमा भाग लिनुहोस्'], '#111418', '#ffd23f');
      addPlane(hq, hqTex, 3.2, 0.5, t.x - Math.cos(p0.h) * 1.75, tg + 2.2, t.z + Math.sin(p0.h) * 1.75, p0.h - Math.PI / 2, false, { double: true, glow: 0.3 });
      RC.hq = { x: t.x - Math.cos(p0.h) * 1.5, z: t.z + Math.sin(p0.h) * 1.5 };
      // the ticket booth: a kiosk with a counter on the road side, a lit sign, and a live board of who is waiting
      const bt = at(s0 - 50, 14.9), bg = gy(bt.x, bt.z), lx = Math.cos(p0.h), lz = -Math.sin(p0.h);
      hb.box(bt.x, bg, bt.z, 1.8, 2.5, 2.6, 0x1f4fb8, p0.h); hb.box(bt.x, bg + 2.5, bt.z, 2.4, 0.22, 3.2, 0xffd23f, p0.h);
      hb.box(bt.x - lx * 0.92, bg + 0.95, bt.z - lz * 0.92, 0.05, 1.05, 1.9, 0x0d1724, p0.h); // the ticket window
      hb.box(bt.x - lx * 1.12, bg + 0.92, bt.z - lz * 1.12, 0.45, 0.07, 2.2, 0xd9d9d9, p0.h); // the counter
      const tkTex = bannerTex(['🎟️ RACE TICKETS', `रु ${TICKET} · दौड टिकट`], '#ffd23f', '#111418');
      addPlane(hq, tkTex, 3.0, 0.62, bt.x - lx * 0.2, bg + 3.05, bt.z - lz * 0.2, p0.h - Math.PI / 2, false, { double: true, glow: 0.35 });
      const bd = at(s0 - 45.5, 14.0), bdg = gy(bd.x, bd.z);
      for (const o of [-0.85, 0.85]) hb.box(bd.x + Math.sin(p0.h) * o, bdg, bd.z + Math.cos(p0.h) * o, 0.08, 1.4, 0.08, 0x444444, p0.h);
      RC.boardCv = document.createElement('canvas'); RC.boardCv.width = 512; RC.boardCv.height = 320; RC.boardTex = new T.CanvasTexture(RC.boardCv);
      addPlane(hq, RC.boardTex, 1.9, 1.2, bd.x - lx * 0.05, bdg + 1.95, bd.z - lz * 0.05, p0.h - Math.PI / 2, false, { double: true, glow: 0.45 });
      RC.booth = { x: bt.x - lx * 2.2, z: bt.z - lz * 2.2 };
      // bunting across the road near the start
      const tri = new T.BufferGeometry(); tri.setAttribute('position', new T.Float32BufferAttribute([-0.22, 0, 0, 0.22, 0, 0, 0, -0.42, 0], 3)); tri.computeVertexNormals();
      const bunt = []; for (const ds of [-45, -22, 30, 55]) { const a = at(s0 + ds, -0.6), c = at(s0 + ds, 12.4), ga = gy(a.x, a.z) + 6.2; for (let k = 0; k <= 26; k++) { const f = k / 26, sag = Math.sin(f * Math.PI) * 0.9; bunt.push({ x: a.x + (c.x - a.x) * f, y: ga - sag, z: a.z + (c.z - a.z) * f, h: a.h }); } }
      const bi = new T.InstancedMesh(tri, new T.MeshLambertMaterial({ side: T.DoubleSide }), bunt.length);
      bunt.forEach((q, k) => { dm.position.set(q.x, q.y, q.z); dm.rotation.set(0, q.h, 0); dm.updateMatrix(); bi.setMatrixAt(k, dm.matrix); bi.setColorAt(k, col.setHex(flagCols[k % flagCols.length])); });
      evGroup.add(bi);
    }
    // speed boosters: chevron pads, alternating lanes
    boosterTex = chevronTex(); boosterTex.repeat.set(1, 1.5);
    for (let s = 260, k = 0; s < L - 120; s += 480, k++) {
      const u = k % 2 ? 7.9 : 3.6, p = at(s0 + s, u), g = gy(p.x, p.z);
      const m = addPlane(evGroup, boosterTex, 3.0, 6.0, p.x, g + 0.09, p.z, p.h + Math.PI, true, { transparent: true, glow: 0.9 });
      m.material.emissive.setHex(0xffffff);
      b.box(p.x, g + 0.02, p.z, 3.4, 0.07, 6.4, 0xff8a00, p.h); // the orange frame
      boosters.push({ s: wrap(s0 + s), u, x: p.x, z: p.z, cool: 0 });
    }
    // hazards (placed from the seed, clear of the grid, the boosters and each other)
    const free = (s, gap) => ahead(s, s0 - 110) > 220 && !boosters.some((q) => Math.abs(((s - q.s + L * 1.5) % L) - L / 2) < 22) && !hazards.some((q) => Math.abs(((s - q.s + L * 1.5) % L) - L / 2) < gap);
    const pot = potholeTex(), skyEnv = KS.Props && KS.Props.skyEnv ? KS.Props.skyEnv() : null;
    const puddleMat = new T.MeshPhongMaterial({ color: 0x55606a, specular: 0xb8c4cc, shininess: 140, transparent: true, opacity: 0.84, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3, envMap: skyEnv || null, reflectivity: 0.55 });
    const stoneMats = [0x8a857c, 0x6f6a62, 0x9a9184].map((c) => new T.MeshLambertMaterial({ color: c, flatShading: true }));
    const place = (kind, count, gap) => {
      let tries = 0;
      for (let k = 0; k < count && tries < 600; tries++) {
        const s = wrap(s0 + rr(0, L)); if (!free(s, gap)) continue;
        const u = rr(2.2, 9.4), p = at(s, u), g = gy(p.x, p.z), hz = { kind, s, u, x: p.x, z: p.z, cool: 0 };
        if (kind === 'pothole') { hz.r = rr(0.6, 0.95); addPlane(evGroup, pot, hz.r * 2.5, hz.r * 2.5, p.x, g + 0.088, p.z, rr(0, 6), true, { transparent: true }); }
        if (kind === 'puddle') {
          hz.r = rr(1.3, 2.1); const sh = new T.Shape(); for (let a = 0; a <= 24; a++) { const t = (a / 24) * Math.PI * 2, r2 = hz.r * (0.82 + 0.25 * Math.sin(t * 3 + s) + 0.1 * Math.sin(t * 7)); a ? sh.lineTo(Math.cos(t) * r2 * 1.5, Math.sin(t) * r2) : sh.moveTo(Math.cos(t) * r2 * 1.5, Math.sin(t) * r2); }
          const geo = new T.ShapeGeometry(sh); geo.rotateX(-Math.PI / 2); const m = new T.Mesh(geo, puddleMat); m.position.set(p.x, g + 0.092, p.z); m.rotation.y = p.h + rr(-0.4, 0.4); evGroup.add(m); hz.r *= 1.2;
        }
        if (kind === 'stone') {
          hz.r = rr(0.32, 0.55); const geo = new T.DodecahedronGeometry(hz.r, 1), pos = geo.attributes.position;
          for (let i = 0; i < pos.count; i++) pos.setXYZ(i, pos.getX(i) * rr(0.8, 1.2), pos.getY(i) * rr(0.55, 0.9), pos.getZ(i) * rr(0.8, 1.2));
          geo.computeVertexNormals(); const m = new T.Mesh(geo, stoneMats[k % 3]); m.position.set(p.x, g + hz.r * 0.45, p.z); m.rotation.set(rr(0, 3), rr(0, 6), rr(0, 3)); m.castShadow = true; evGroup.add(m);
        }
        hazards.push(hz); k++;
      }
    };
    place('pothole', 14, 28); place('puddle', 10, 28); place('stone', 16, 18);
    hazards.sort((a, c) => a.s - c.s);
    // distance markers: painted on the road every 500 m, with a board by the barrier
    const board = (text, s, red) => { const p = at(s0 + s, 12.0), g = gy(p.x, p.z); b.box(p.x, g, p.z, 0.1, 2.4, 0.1, 0x777777, p.h); b.box(p.x - p.lx * 0.9, g, p.z - p.lz * 0.9, 0.1, 2.4, 0.1, 0x777777, p.h); addPlane(evGroup, bannerTex([text], red ? '#c8102e' : '#ffffff', red ? '#ffffff' : '#111111'), 2.0, 0.5, p.x - p.lx * 0.45, g + 2.2, p.z - p.lz * 0.45, p.h + Math.PI, false, { double: true }); };
    for (let d = 500; d < L - 150; d += 500) {
      const txt = d % 1000 ? `${(d / 1000).toFixed(1)} KM` : `${d / 1000} KM`, p = at(s0 + d, U_MID), g = gy(p.x, p.z);
      addPlane(evGroup, paintTex(txt), 5.6, 2.2, p.x, g + 0.087, p.z, p.h + Math.PI, true, { transparent: true });
      board(txt, d + 3, false);
    }
    for (const d of [300, 200, 100]) board(`FINISH ${d} M`, -d, true);
    { const p = at(s0 - 200, U_MID), g = gy(p.x, p.z); addPlane(evGroup, paintTex('200 M'), 5.6, 2.2, p.x, g + 0.087, p.z, p.h + Math.PI, true, { transparent: true }); }
    // the crowd behind the barrier at the start
    if (KS.makePerson) for (let k = 0; k < 26; k++) {
      const s = s0 + rr(-40, 36), u = rr(12.9, 15.5), p = at(s, u);
      if (KS.collide(p.x, p.z, 0.35, gy(p.x, p.z), 1).hit) continue;
      const q = KS.makePerson(KS.pick(['man', 'woman', 'student', 'kid', 'man', 'woman'])); q.root.position.set(p.x, gy(p.x, p.z) + 0.05, p.z); q.root.rotation.y = p.h - Math.PI / 2 + rr(-0.5, 0.5); evGroup.add(q.root); crowd.push({ p: q, ph: rr(0, 6) });
    }
    evGroup.add(KS.mesh(b, KS.M.vc, false)); hq.add(KS.mesh(hb, KS.M.vc, false));
    if (KS.landmarks) KS.landmarks.push({ id: 'race-hq', name: 'Ring Road Race HQ 🏁', np: 'चक्रपथ दौड', x: RC.hq.x, z: RC.hq.z, r: 14, fact: 'Sign up for a 2-lap race round the whole Ring Road: needs at least 2 racers. Alone, take a practice run.' });
  }
  /** grid slot k: two columns, staggered, behind the start line */
  function gridSlot(k) { const row = Math.floor(k / 2), c = k % 2; /* 10 boxes: five rows of two */ const p = at(s0 - 9 - row * 9 - c * 4.5, c ? 7.6 : 3.9); return { x: p.x, z: p.z, h: p.h }; }

  /* ---------- HUD ---------- */
  function buildHud() {
    const st = document.createElement('style');
    st.textContent = `
#raceTop{position:absolute;left:50%;top:12px;transform:translateX(-50%);display:flex;gap:10px;align-items:stretch;font-family:${FONT};pointer-events:none}
#raceTop .rc{background:rgba(12,14,18,.82);color:#fff;border-radius:10px;padding:6px 14px;text-align:center;min-width:74px;box-shadow:0 4px 16px rgba(0,0,0,.35)}
#raceTop .rc b{display:block;font-size:26px;line-height:1;font-weight:800}#raceTop .rc small{font-size:12px;letter-spacing:.08em;opacity:.7;text-transform:uppercase}
#raceTop .rc.lobby{min-width:260px;font-size:18px;padding:8px 16px}
#raceSide{position:absolute;right:12px;top:250px;width:196px;pointer-events:none;font-family:${FONT}}
#raceMap{width:196px;height:196px;border-radius:12px;background:rgba(12,14,18,.78);box-shadow:0 4px 16px rgba(0,0,0,.35);display:block}
#raceBoard{margin-top:6px;background:rgba(12,14,18,.78);border-radius:10px;padding:6px 10px;color:#fff;font-size:15px}
#raceBoard div{display:flex;justify-content:space-between;gap:8px}#raceBoard i{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:6px}
#raceBig{position:absolute;left:50%;top:30%;transform:translate(-50%,-50%);font-family:${FONT};font-weight:800;font-size:120px;color:#fff;text-shadow:0 6px 24px rgba(0,0,0,.6);pointer-events:none;white-space:nowrap}
#raceBig.small{font-size:54px}#raceBig.go{color:#3dff7a}#raceBig.warn{color:#ff4040}#raceBig.boost{color:#ffd23f}
#raceLights{position:absolute;left:50%;top:15%;transform:translateX(-50%);display:flex;gap:10px;background:#0b0b0b;padding:10px 14px;border-radius:12px;pointer-events:none}
#raceLights i{width:34px;height:34px;border-radius:50%;background:#2a0606;box-shadow:inset 0 0 6px #000}#raceLights i.on{background:#ff1a1a;box-shadow:0 0 18px #ff1a1a}#raceLights.go i{background:#3dff7a;box-shadow:0 0 18px #3dff7a}
#raceRes{position:absolute;left:50%;top:60%;transform:translate(-50%,-50%);background:rgba(12,14,18,.94);color:#fff;border-radius:16px;padding:18px 24px;min-width:320px;font-family:${FONT};pointer-events:auto;box-shadow:0 12px 40px rgba(0,0,0,.5)}
#raceRes h2{margin:0 0 10px;font-size:32px;color:#ffd23f}#raceRes table{width:100%;border-collapse:collapse;font-size:20px}#raceRes td{padding:4px 6px}#raceRes td:last-child{text-align:right;color:#7dff9a}
#raceRes .me{background:rgba(255,210,63,.15)}#raceRes .rbtns{display:flex;gap:10px;margin-top:14px}#raceRes .rbtns button,#racePad button{flex:1;font:700 18px ${FONT};padding:10px 14px;border-radius:10px;border:0;cursor:pointer;background:#ffd23f;color:#111}#raceRes .rbtns button+button{background:#2b3138;color:#fff}
#racePad{position:absolute;left:50%;top:96px;transform:translateX(-50%);pointer-events:auto;display:flex;gap:8px}#racePad button{background:rgba(12,14,18,.85);color:#fff;font-size:15px;padding:7px 14px}#racePad button.go{background:#3dff7a;color:#0b1a10;font-size:17px;animation:rpulse 1s infinite alternate}@keyframes rpulse{to{transform:scale(1.06)}}#raceRes p{margin:10px 0 0;opacity:.75;font-size:15px}
body.is-touch #raceSide{top:200px;width:140px}body.is-touch #raceMap{width:140px;height:140px}body.is-touch #raceTop .rc b{font-size:20px}`;
    document.head.appendChild(st);
    const root = document.getElementById('hud') || document.body, el = (id, tag = 'div') => { const e = document.createElement(tag); e.id = id; e.hidden = true; root.appendChild(e); return e; };
    hud = { top: el('raceTop'), side: el('raceSide'), big: el('raceBig'), lights: el('raceLights'), res: el('raceRes'), pad: el('racePad') };
    hud.pad.onclick = (e) => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.a === 'switch') RC.switchRoom(); else RC.leaveRoom(); };
    hud.side.innerHTML = '<canvas id="raceMap" width="392" height="392"></canvas><div id="raceBoard"></div>';
    hud.map = hud.side.querySelector('canvas'); hud.board = hud.side.querySelector('#raceBoard');
    hud.lights.innerHTML = '<i></i><i></i><i></i><i></i><i></i>';
    // the track drawn once, the racers on top every frame
    const { X, Z, n } = trk; let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (let i = 0; i < n; i++) { x0 = Math.min(x0, X[i]); x1 = Math.max(x1, X[i]); z0 = Math.min(z0, Z[i]); z1 = Math.max(z1, Z[i]); }
    const S = 392, pad = 26, k = (S - pad * 2) / Math.max(x1 - x0, z1 - z0), ox = pad + (S - pad * 2 - (x1 - x0) * k) / 2, oz = pad + (S - pad * 2 - (z1 - z0) * k) / 2;
    hud.mx = (x) => ox + (x - x0) * k; hud.mz = (z) => oz + (z - z0) * k;
    mapBase = document.createElement('canvas'); mapBase.width = mapBase.height = S; const g = mapBase.getContext('2d');
    g.lineJoin = 'round'; g.beginPath(); for (let i = 0; i <= n; i++) { const j = i % n; i ? g.lineTo(hud.mx(X[j]), hud.mz(Z[j])) : g.moveTo(hud.mx(X[j]), hud.mz(Z[j])); }
    g.strokeStyle = '#3b3f46'; g.lineWidth = 16; g.stroke(); g.strokeStyle = '#8b9098'; g.lineWidth = 9; g.stroke(); g.setLineDash([6, 8]); g.strokeStyle = '#d8dbe0'; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]);
    for (const q of boosters) { g.fillStyle = '#ffb000'; g.beginPath(); g.arc(hud.mx(q.x), hud.mz(q.z), 5, 0, 7); g.fill(); }
    for (const q of hazards) { g.fillStyle = q.kind === 'puddle' ? '#4aa3ff' : q.kind === 'stone' ? '#bbb2a4' : '#ff5a3a'; g.fillRect(hud.mx(q.x) - 2, hud.mz(q.z) - 2, 4, 4); }
    const p = at(s0, U_MID), sx = Math.cos(p.h), sz = -Math.sin(p.h); // the chequered start line
    for (let i = -3; i < 3; i++) { g.fillStyle = i % 2 ? '#fff' : '#111'; g.fillRect(hud.mx(p.x) + sx * i * 4 - 3, hud.mz(p.z) + sz * i * 4 - 3, 6, 6); }
    g.fillStyle = '#ffd23f'; g.font = `700 22px ${FONT}`; g.textAlign = 'center'; g.fillText('START', hud.mx(p.x) + 44, hud.mz(p.z));
  }
  const fmt = (t) => { if (t == null || !isFinite(t)) return '–'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
  const ord = (k) => k + (k % 10 === 1 && k !== 11 ? 'st' : k % 10 === 2 && k !== 12 ? 'nd' : k % 10 === 3 && k !== 13 ? 'rd' : 'th');
  let bigT = 0;
  function big(text, cls = '', t = 1.2) { hud.big.textContent = text; hud.big.className = cls; hud.big.hidden = false; bigT = t; }

  /* ---------- messages ---------- */
  const shared = () => !RC.practice && (kind() === 'private' || kind() === 'race'); // race messages go to the room only here
  function send(m) {
    m.t = 'race'; m.id = myId();
    RC.onNet(m);
    if (shared()) KS.Net.sendAll(m);
  }
  function hostSend(m) { m.t = 'race'; m.id = myId(); RC.onNet(m); if (shared()) KS.Net.sendAll(m); }
  RC.onNet = (m) => {
    const H = isHost() || RC.practice;
    if (m.k === 'ad') { // someone in the public world bought a ticket
      if (m.id !== myId() && kind() === 'world') { const nm = String(m.name || 'A racer').replace(/[<>&]/g, '').slice(0, 16); RC.ads.push({ name: nm, t: Date.now() }); notify(`🏁 <b>${nm}</b> bought a race ticket and is waiting in the <b>Race Room</b> — get yours at the Race HQ booth (रु ${TICKET}) and race them!`, 'good'); }
      return;
    }
    if (kind() === 'world' && !RC.practice) return; // no races in the public world itself: they happen in the Race Room
    switch (m.k) {
      case 'join': if (H && (RC.state === 'idle' || RC.state === 'lobby') && !RC.list.includes(m.id) && RC.list.length < 10) { RC.list.push(m.id); hostLobby(); } break;
      case 'leave': if (H && RC.state === 'lobby') { RC.list = RC.list.filter((q) => q !== m.id); hostLobby(); } break;
      case 'lobby': if (RC.state === 'idle' || RC.state === 'lobby') { RC.state = m.list.length ? 'lobby' : 'idle'; RC.list = m.list; RC.lobbyEnd = m.ms > 0 ? now() + m.ms : 0; RC.practice = false; } break;
      case 'grid': startGrid(m.list, m.ms, !!m.practice); break;
      case 'prog': { const r = RC.racers.get(m.id); if (r && m.id !== myId()) { r.p = m.p; r.lap = m.lap; } break; }
      case 'fin': { const r = RC.racers.get(m.id); if (r && m.time == null) r.gone = true; else if (r && r.fin == null) { r.fin = m.time; r.p = LAPS * trk.L; RC.firstFin = RC.firstFin || now(); const pos = [...RC.racers.values()].filter((q) => q.fin != null).length; if (m.id !== myId() && RC.state === 'race') notify(`🏁 <b>${nameOf(m.id)}</b> finished ${ord(pos)} in ${fmt(m.time)}`); } if (H) hostCheckEnd(); break; }
      case 'results': showResults(m.list); break;
    }
  };
  function hostLobby() {
    if (!isHost()) return;
    const n = RC.list.length;
    if (n >= 2 && !RC.lobbyEnd) RC.lobbyEnd = now() + LOBBY_MS;
    if (n < 2) RC.lobbyEnd = 0;
    const room = inRoom() ? KS.Net.players.size + 1 : 1;
    if (n >= 2 && n >= room && kind() !== 'race') RC.lobbyEnd = Math.min(RC.lobbyEnd, now() + 5000); // all your friends are in: start sooner (the Race Room always waits 15 s for late arrivals)
    hostSend({ k: 'lobby', list: RC.list.slice(), ms: RC.lobbyEnd ? RC.lobbyEnd - now() : -1 });
  }
  function hostCheckEnd() {
    if (!(isHost() || RC.practice) || RC.state !== 'race') return;
    const rs = [...RC.racers.entries()], done = rs.every(([, r]) => r.fin != null || r.gone);
    if (done || (RC.firstFin && now() - RC.firstFin > 60000)) {
      const list = rs.map(([id, r]) => ({ id, name: nameOf(id), time: r.fin == null ? null : r.fin })).sort((a, b) => (a.time == null) - (b.time == null) || a.time - b.time);
      hostSend({ k: 'results', list });
    }
  }

  /* ---------- joining, the grid, the race ---------- */
  RC.racing = () => RC.state === 'grid' || RC.state === 'race';
  RC.frozen = () => RC.state === 'grid' && car && KS.Player.vehicle === car;
  RC.nearHq = () => RC.hq && Math.hypot(KS.Player.x - RC.hq.x, KS.Player.z - RC.hq.z) < 8 && (KS.Player.y || 0) < KS.heightAt(RC.hq.x, RC.hq.z) + 3;
  /** E at the Race HQ: join or leave the lobby, or (alone) start a practice run */
  RC.nearBooth = () => RC.booth && Math.hypot(KS.Player.x - RC.booth.x, KS.Player.z - RC.booth.z) < 6 && (KS.Player.y || 0) < KS.heightAt(RC.booth.x, RC.booth.z) + 3;
  RC.tryE = () => {
    const PL = KS.Player;
    if (!trk || !(PL.mode === 'foot' || PL.mode === 'drive') || RC.racing() || RC.state === 'results') return false;
    if (RC.nearBooth()) { buyTicket(); return true; }
    if (!RC.nearHq()) return false;
    const k = kind();
    if (k === 'private') { // friends race free in their own room
      if (RC.list.includes(myId())) { send({ k: 'leave' }); notify('You left the race lobby.'); }
      else { send({ k: 'join' }); notify('🏁 You joined the <b>Ring Road Race</b>. It starts when at least 2 racers are in.'); }
      return true;
    }
    if (k === 'race') {
      if (RC.list.includes(myId())) notify('🏁 You are on the start list. The race begins 15 s after a second racer joins.');
      else if (ticket()) send({ k: 'join' });
      else notify(`🎟️ You need a ticket for the next race — buy one at the booth (रु ${TICKET}).`, 'bad');
      return true;
    }
    notify(`🏁 Racing real players needs a <b>ticket</b> from the booth next to this tent (रु ${TICKET}). Starting a <b>solo practice run</b> (no prize).`);
    startGrid([myId()], 6000, true); return true;
  };
  /* ---------- tickets and the Race Room ---------- */
  function buyTicket() {
    const D = KS.Shop.data, k = kind();
    if (!ticket()) {
      if ((D.cash || 0) < TICKET) { notify(`🎟️ A race ticket costs रु ${TICKET}. You have रु ${D.cash || 0}.`, 'bad'); return; }
      D.cash -= TICKET; D.raceTicket = { t: Date.now() }; KS.Shop.save(); A().cash && A().cash();
      notify(`🎟️ <b>Race ticket bought</b> (रु ${TICKET}). ` + (k === 'race' ? 'You are on the list for the next race.' : 'Taking you to the <b>Race Room</b>…'), 'good');
    } else if (k !== 'race') notify('🎟️ You already have a ticket. Taking you to the <b>Race Room</b>…');
    if (k === 'race') { if (!RC.list.includes(myId())) send({ k: 'join' }); else notify('🏁 You are already on the start list.'); return; }
    if (!KS.Net || !KS.Net.goRaceRoom) return;
    if (k === 'world') KS.Net.sendAll({ t: 'race', k: 'ad', id: myId(), name: nameOf(myId()) }); // tell the city
    setTimeout(() => KS.Net.goRaceRoom(), k === 'world' ? 700 : 0);
  }
  /** the paddock: where ticket holders wait, behind the barrier by the grid */
  function paddockSpot(k) { const p = at(s0 - 34 - (k % 6) * 1.8, 14.2 + Math.floor(k / 6) * 1.4); return { x: p.x, z: p.z, h: p.h - Math.PI / 2 }; }
  function toPaddock() {
    const PL = KS.Player;
    if (PL.vehicle) { PL.vehicle.speed = 0; PL.vehicle.vx = null; PL.exit(); if (PL.vehicle) { PL.vehicle = null; PL.mode = 'foot'; } }
    if (PL.mode !== 'foot') return;
    const q = paddockSpot(Math.floor(Math.random() * 12)); PL.x = q.x; PL.z = q.z; PL.y = gy(q.x, q.z) + 0.3; PL.vy = 0; PL.h = q.h;
  }
  function enterRoom() {
    RC.state = 'idle'; RC.list = []; RC.lobbyEnd = 0;
    if (KS.Phone && KS.Phone.open) KS.Phone.toggle(false);
    toPaddock();
    if (ticket()) { setTimeout(() => { if (kind() === 'race' && ticket()) send({ k: 'join' }); }, 400); notify('🏁 <b>Race Room</b> — you are in the paddock. The race starts 15 s after a second racer arrives. No one within 3 minutes? Your रु ' + TICKET + ' comes back.', 'good'); }
    else notify('🏁 You are in the Race Room without a ticket — buy one at the booth to race.');
  }
  /** look into Race Rooms 1-6 (not ours) for racers who are waiting. Only a room with more racers waiting, or as many
      and a lower number, is suggested — so two players alone in rooms 1 and 2 do not both switch and miss again. */
  async function scanRooms() {
    RC.scanning = true; RC.scanAt = Date.now();
    const mine = KS.Net.pubN || 1, myWait = RC.list.length; let best = null;
    for (let n = 1; n <= 6; n++) {
      if (n === mine || kind() !== 'race') continue;
      const r = await KS.Net.peekRoom(n, 'race');
      if (!r || r.waiting < 1) continue;
      if (r.waiting > myWait || (r.waiting === myWait && n < mine)) if (!best || r.waiting > best.waiting) best = r;
    }
    RC.scanning = false;
    if (kind() !== 'race' || RC.list.length >= 2 || RC.racing()) return;
    if (best && (!RC.suggest || RC.suggest.n !== best.n)) notify(`🏁 <b>${best.names.join(', ') || 'A racer'}</b> ${best.waiting === 1 ? 'is' : 'are'} waiting in <b>Race Room ${best.n}</b>${best.racing ? ' (race on now — you join the next one)' : ''}. Tap <b>Switch</b> at the top to race them — your ticket goes with you.`, 'good');
    RC.suggest = best;
  }
  RC.switchRoom = () => {
    const r = RC.suggest; if (!r || kind() !== 'race') return;
    if (RC.list.includes(myId())) send({ k: 'leave' });
    RC.suggest = null; RC.state = 'idle'; RC.list = []; RC.lobbyEnd = 0;
    notify(`🏁 Switching to <b>Race Room ${r.n}</b>…`);
    setTimeout(() => KS.Net.switchRace(r.n), 300);
  };
  /** leave the Race Room for the city; an unused ticket is refunded */
  RC.leaveRoom = (why) => {
    const D = KS.Shop.data;
    if (ticket() && !RC.racing()) { D.cash += TICKET; D.raceTicket = null; KS.Shop.save(); notify(`🎟️ ${why || 'Ticket refunded'}: रु ${TICKET} is back in your wallet.`, 'good'); }
    if (RC.list.includes(myId()) && !RC.racing()) send({ k: 'leave' });
    hud.res.hidden = true; if (RC.state === 'results') endResults();
    RC.state = 'idle'; RC.list = [];
    if (KS.Net && KS.Net.backToCity) KS.Net.backToCity();
  };
  RC.raceAgain = () => { hud.res.hidden = true; if (RC.state === 'results') endResults(); if (kind() === 'race') buyTicket(); };
  function startGrid(list, ms, practice) {
    const id = myId(), PL = KS.Player;
    RC.list = list; RC.practice = practice; RC.goAt = now() + ms; RC.firstFin = 0; RC.racers = new Map();
    list.forEach((q) => RC.racers.set(q, { p: 0, lap: 1, fin: null }));
    RC.state = 'grid'; evGroup.visible = true; hud.res.hidden = true; clearRoad(true);
    me = null;
    const slot = list.indexOf(id);
    if (slot < 0) return; // watching: you are not in this one
    if (!practice && kind() === 'race' && KS.Shop.data.raceTicket) { KS.Shop.data.raceTicket = null; KS.Shop.save(); } // the ticket is used
    if (!(PL.mode === 'foot' || PL.mode === 'drive')) { RC.racers.get(id).gone = true; notify('🏁 The race is starting, but you are busy — you sit this one out.'); return; }
    // a fresh race car on your grid box (your own vehicle stays where you left it)
    if (car) { KS.Traffic.remove(car); car = null; }
    let v = null;
    for (const kind of [CAR, 'ev', 'sedan', 'car']) { const vis = KS.buildVehicle(kind, {}); if (vis) { v = { id: ++KS.Traffic._nextId, kind, type: KS.VTYPES[kind], ...vis, lane: {}, ai: false, parked: true, speed: 0, x: 0, y: 0.06, z: 0, h: 0, stuck: 0, lat: 0, side: 0, maxSpeed: KS.VTYPES[kind].speed, fuel: 100, raceCar: true }; break; } }
    if (!v) { RC.racers.get(id).gone = true; notify('The race car has not loaded yet. Try again in a moment.', 'bad'); return; }
    KS.Traffic.list.push(v); KS.Traffic.scene.add(v.root); car = v;
    if (PL.vehicle) { prevVeh = PL.vehicle; PL.vehicle.speed = 0; PL.vehicle.vx = null; PL.exit(); if (PL.vehicle) { PL.vehicle = null; PL.mode = 'foot'; } }
    const q = gridSlot(slot); v.x = q.x; v.z = q.z; v.h = q.h; v.y = gy(q.x, q.z) + 0.02; v.root.position.set(v.x, v.y, v.z); v.root.rotation.set(0, v.h, 0);
    PL.x = v.x; PL.z = v.z; PL.y = v.y; PL.enter(v); v.vx = 0; v.vz = 0; v.yaw = 0; v.speed = 0;
    KS.Cam.yaw = 0; KS.Cam.want = 7.5;
    const pr = proj(v.x, v.z); hint = pr.i;
    me = { grid: q, lastS: pr.s, p: -ahead(s0, pr.s), lap: 1, lapStart: 0, laps: [], fin: null, sendT: 0, resetT: 0, wrongT: 0, boosts: 0 };
    if (me.p < -trk.L / 2) me.p += trk.L;
    big(practice ? 'PRACTICE' : 'GET READY', 'small', 2);
  }
  function clearRoad(force) {
    RC.clearT = (RC.clearT || 0) - 1; if (!force && RC.clearT > 0) return; RC.clearT = 30;
    const PL = KS.Player;
    for (const v of [...KS.Traffic.list]) {
      if (v.raceCar || v === PL.vehicle || v === prevVeh || v.remote || v.express || (v.y || 0) > 3) continue;
      if (KS.ringLoopDist(v.x, v.z) > 12.5) continue;
      if (v.ai) KS.Traffic.recycle(v, PL.x, PL.z); else if (v.parked && !v.owned && !v.ownedId) KS.Traffic.remove(v);
    }
    if (KS.Peds) for (const p of [...KS.Peds.list]) if (!p.remote && p.ambient !== false && KS.ringLoopDist(p.x, p.z) < 11.5) KS.Peds.remove(p);
  }

  /** called from the drive step (player.js), after the car has moved: the walls, the boosters, the hazards */
  RC.drive = (v, dt) => {
    if (v !== car || !me) return;
    if (RC.state === 'grid') { const q = me.grid; v.x = q.x; v.z = q.z; v.vx = 0; v.vz = 0; v.h = q.h; v.yaw = 0; return; }
    v.damage = 0; v.fuel = 100; // race cars take no damage and never run dry
    const p = proj(v.x, v.z, hint); hint = p.i;
    // the walls: the median barrier on one side, the armco on the other
    for (const [lim, sgn] of [[U_IN, 1], [U_OUT, -1]]) {
      const over = (p.u - lim) * -sgn; // > 0: through the wall
      if (over > 0) {
        v.x += p.lx * over * sgn; v.z += p.lz * over * sgn;
        const vl = (v.vx * p.lx + v.vz * p.lz) * sgn; // speed into the wall (negative)
        if (vl < 0) {
          v.vx -= 1.25 * vl * p.lx * sgn; v.vz -= 1.25 * vl * p.lz * sgn; v.vx *= 0.94; v.vz *= 0.94;
          if (-vl > 5) { A().crash && A().crash(Math.min(1, -vl / 22)); KS.Cam.shake = Math.min(0.6, -vl / 26); KS.FX && KS.FX.burst(v.x - p.lx * sgn * 1, v.y + 0.6, v.z - p.lz * sgn * 1, 0xffd080, 10, 0.12, 0.4); }
        }
      }
    }
    const fx = Math.sin(v.h), fz = Math.cos(v.h), sp = Math.hypot(v.vx, v.vz), tf = Math.sin(p.h) * fx + Math.cos(p.h) * fz;
    // boosters
    for (const q of boosters) {
      if (Math.abs(((p.s - q.s + trk.L * 1.5) % trk.L) - trk.L / 2) < 3.2 && Math.abs(p.u - q.u) < 1.9 && now() - q.cool > 1500) {
        q.cool = now(); RC.boostT = 2.4; v.vx += fx * 7; v.vz += fz * 7; me.boosts++;
        A().nitro && A().nitro(); big('BOOST!', 'small boost', 0.8); KS.Challenges && KS.Challenges.emit('boost');
      }
    }
    // hazards
    for (const q of hazards) {
      const ds = Math.abs(((p.s - q.s + trk.L * 1.5) % trk.L) - trk.L / 2); if (ds > 6) continue;
      const d = Math.hypot(v.x - q.x, v.z - q.z), reach = q.r + (q.kind === 'stone' ? v.type.r * 0.55 : 0.85);
      if (d > reach) continue;
      if (q.kind === 'stone') { // a solid: bounce off it
        const nx = (v.x - q.x) / (d || 1), nz = (v.z - q.z) / (d || 1), vn = v.vx * nx + v.vz * nz;
        v.x = q.x + nx * reach; v.z = q.z + nz * reach;
        if (vn < 0) { v.vx -= 1.4 * vn * nx; v.vz -= 1.4 * vn * nz; v.vx *= 0.55; v.vz *= 0.55; if (now() - q.cool > 600) { q.cool = now(); A().crash && A().crash(Math.min(1, -vn / 16)); KS.Cam.shake = Math.min(0.5, 0.15 - vn / 30); KS.FX && KS.FX.burst(q.x, v.y + 0.4, q.z, 0x9a9184, 12, 0.14, 0.6); } }
        continue;
      }
      if (now() - q.cool < 1200) continue; q.cool = now();
      if (q.kind === 'pothole') { v.vx *= 0.72; v.vz *= 0.72; v.vy = Math.max(v.vy || 0, 2.2 + sp * 0.04); v.pitch = (v.pitch || 0) + 0.06; KS.Cam.shake = Math.max(KS.Cam.shake, 0.3); A().thump && A().thump(); KS.FX && KS.FX.burst(q.x, v.y + 0.2, q.z, 0x3a3733, 10, 0.1, 0.5); }
      if (q.kind === 'puddle') { v.vx *= 0.86; v.vz *= 0.86; v.yaw = (v.yaw || 0) + (rnd() < 0.5 ? -1 : 1) * Math.min(1.1, sp * 0.04); KS.Cam.shake = Math.max(KS.Cam.shake, 0.12); A().splash && A().splash(); KS.FX && KS.FX.burst(v.x, v.y + 0.3, v.z, 0xd6e6f2, 26, 0.16, 0.9); }
    }
    if (RC.boostT > 0 && KS.FX && Math.floor(now() / 50) % 2) KS.FX.burst(v.x - fx * v.type.len * 0.55, v.y + 0.45, v.z - fz * v.type.len * 0.55, KS.chance(0.5) ? 0xff9a2e : 0x6fd0ff, 2, 0.1, 0.25);
    // progress along the loop
    let ds = p.s - me.lastS; if (ds > trk.L / 2) ds -= trk.L; if (ds < -trk.L / 2) ds += trk.L;
    me.lastS = p.s; me.p += ds;
    me.wrong = tf < -0.25 && sp > 3;
  };

  function raceTick(dt) {
    const PL = KS.Player, t = (now() - RC.goAt) / 1000;
    if (RC.state === 'grid') {
      const lit = Math.max(0, Math.min(5, Math.floor(t + 6))); // a light a second from 5 s before the start
      lamps.forEach((m, k) => m.color.setHex(k < lit ? 0xff1a1a : 0x2a0606));
      hud.lights.hidden = !me; hud.lights.className = ''; [...hud.lights.children].forEach((e, k) => e.classList.toggle('on', k < lit));
      if (me && lit !== RC.lit) { RC.lit = lit; if (lit > 0) A().beep && A().beep(0.9); if (lit >= 3) big(String(6 - lit), '', 0.9); }
      if (t >= 0) {
        RC.state = 'race'; RC.lit = 0; lamps.forEach((m) => m.color.setHex(0x2a0606));
        if (me) { hud.lights.className = 'go'; setTimeout(() => { hud.lights.hidden = true; }, 900); big('GO!', 'go', 1); A().ding && A().ding(); A().horn && A().horn('police', 0.4); }
      }
    }
    if (RC.state === 'race' && me && me.fin == null) {
      if (PL.vehicle !== car) { // got out: you are out of the race
        RC.racers.get(myId()).gone = true; me = null; notify('🏁 You left your race car — you are out of this race.', 'bad'); send({ k: 'fin', time: null }); return;
      }
      const lap = Math.min(LAPS, Math.floor(Math.max(0, me.p) / trk.L) + 1);
      if (lap > me.lap) { me.laps.push(t - me.lapStart); me.lapStart = t; me.lap = lap; big('FINAL LAP', 'small', 1.6); notify(`⏱️ Lap 1: <b>${fmt(me.laps[0])}</b> — final lap!`); A().ding && A().ding(); }
      if (me.p >= LAPS * trk.L) { // the finish
        me.laps.push(t - me.lapStart); me.fin = t;
        send({ k: 'fin', time: t });
        const pos = [...RC.racers.values()].filter((q) => q.fin != null).length;
        big(RC.practice ? 'FINISH' : ord(pos), 'go', 2.5); A().cash && A().cash();
        if (!RC.practice) { KS.Challenges && KS.Challenges.emit('race'); if (pos === 1) KS.Challenges && KS.Challenges.emit('race_win'); }
        if (RC.practice) { const D = KS.Shop.data, best = Math.min(...me.laps); const old = D.raceBestLap; if (!old || best < old) { D.raceBestLap = best; KS.Shop.save(); } }
      }
      me.sendT -= dt; if (me.sendT <= 0 && !RC.practice) { me.sendT = 0.25; send({ k: 'prog', p: Math.round(me.p), lap: me.lap }); }
      const r = RC.racers.get(myId()); if (r) { r.p = me.p; r.lap = me.lap; }
      if (KS.Input.hit('KeyR') && now() - me.resetT > 3000) { // back on the track, facing the right way
        me.resetT = now(); const p = proj(car.x, car.z, hint), q = at(p.s, KS.clamp(p.u, 3, 8.5));
        car.x = q.x; car.z = q.z; car.h = q.h; car.vx = car.vz = 0; car.yaw = 0; car.speed = 0; car.y = gy(q.x, q.z) + 0.3; car.vy = 0; notify('↩️ Back on the track.');
      }
    }
    if (isHost() && RC.state === 'race') { // drop racers who left the room
      if (inRoom()) for (const [id, r] of RC.racers) if (id !== myId() && !KS.Net.players.has(id) && !r.gone) r.gone = true;
      RC.endT = (RC.endT || 0) - dt; if (RC.endT <= 0) { RC.endT = 1; hostCheckEnd(); }
    }
    clearRoad(false);
  }

  function standings() {
    return [...RC.racers.entries()].map(([id, r]) => ({ id, ...r, p: id === myId() && me ? me.p : r.p })).sort((a, b) => (a.fin == null) - (b.fin == null) || (a.fin != null ? a.fin - b.fin : b.p - a.p));
  }
  function showResults(list) {
    RC.state = 'results'; RC.resultsT = now();
    hud.lights.hidden = true;
    const my = myId(), pos = list.findIndex((q) => q.id === my);
    let prize = 0;
    if (!RC.practice && pos >= 0 && list[pos].time != null) { prize = PRIZE[pos] || 100; KS.Shop.data.cash += prize; KS.Shop.save(); }
    const rows = list.map((q, k) => `<tr class="${q.id === my ? 'me' : ''}"><td>${q.time == null ? '–' : ord(k + 1)}</td><td>${(q.name || 'Racer').replace(/[<>&]/g, '')}</td><td>${q.time == null ? 'DNF' : fmt(q.time)}</td></tr>`).join('');
    const best = KS.Shop.data.raceBestLap;
    hud.res.innerHTML = `<h2>🏁 ${RC.practice ? 'Practice run' : 'Ring Road Race — results'}</h2><table>${rows}</table>` +
      (me && me.laps.length ? `<p>Your laps: ${me.laps.map(fmt).join(' · ')}${RC.practice && best ? ` · best ever ${fmt(best)}` : ''} · boosters ${me.boosts}</p>` : '') +
      (prize ? `<p style="color:#7dff9a;opacity:1;font-size:20px">Prize: रु ${prize.toLocaleString()}</p>` : RC.practice ? '<p>Practice runs pay no prize. Buy a ticket at the booth to race real players for रु 1,000.</p>' : '') +
      (kind() === 'race' ? `<div class="rbtns"><button type="button" id="raceAgain">🎟️ Race again (रु ${TICKET})</button><button type="button" id="raceCity">🏙️ Back to the city</button></div>` : '<p>The race car goes back to the pits in a few seconds.</p>');
    hud.res.hidden = false;
    const ra = document.getElementById('raceAgain'), rc = document.getElementById('raceCity');
    if (ra) ra.onclick = () => RC.raceAgain(); if (rc) rc.onclick = () => RC.leaveRoom();
  }
  function endResults() {
    const PL = KS.Player;
    hud.res.hidden = true; RC.state = 'idle'; RC.list = []; RC.racers = new Map(); RC.lobbyEnd = 0; me = null; evGroup.visible = false;
    if (car) {
      if (PL.vehicle === car) { car.speed = 0; car.vx = 0; car.vz = 0; PL.exit(); if (PL.vehicle === car) { PL.vehicle = null; PL.mode = 'foot'; PL.person.root.visible = true; } }
      KS.Traffic.remove(car); car = null; notify('🏁 The race car went back to the pits.' + (prevVeh && kind() !== 'race' ? ' Your own ride is where you left it.' : ''));
    }
    prevVeh = null;
    if (kind() === 'race') { toPaddock(); if (ticket()) setTimeout(() => { if (kind() === 'race' && ticket()) send({ k: 'join' }); }, 300); } // back to the paddock; a ticket holder who watched goes on the next start list
  }

  /** the live board by the booth: who is waiting for the next race */
  function drawBoard() {
    if (!RC.boardCv || !KS.camera) return;
    const c = KS.camera.position; if (Math.hypot(c.x - RC.booth.x, c.z - RC.booth.z) > 160) return;
    const k = kind(), names = k === 'race' || k === 'private' ? RC.list.map((id) => nameOf(id)) : RC.ads.filter((a) => Date.now() - a.t < REFUND_MS).map((a) => a.name);
    const key = [k, RC.state, names.join(','), RC.lobbyEnd ? Math.ceil((RC.lobbyEnd - now()) / 1000) : ''].join('|'); if (key === RC._boardKey) return; RC._boardKey = key;
    const g = RC.boardCv.getContext('2d'), W = 512, H = 320;
    g.fillStyle = '#0b0f14'; g.fillRect(0, 0, W, H); g.strokeStyle = '#ffd23f'; g.lineWidth = 6; g.strokeRect(3, 3, W - 6, H - 6);
    g.fillStyle = '#ffd23f'; g.font = `800 50px ${FONT}`; g.textAlign = 'left'; g.fillText(RC.racing() ? '🏁 RACE ON' : 'NEXT RACE', 22, 58);
    g.fillStyle = '#cfd6de'; g.font = `600 26px ${FONT}`; g.fillText(`Ring Road · 2 laps · prize रु 1,000`, 22, 96);
    g.fillStyle = '#ffffff'; g.font = `700 32px ${FONT}`; g.fillText(`WAITING ${names.length}/10`, 22, 142);
    g.font = `600 28px ${FONT}`; g.fillStyle = '#7dff9a';
    (names.length ? names.slice(0, 6) : ['— nobody yet: be the first! —']).forEach((nm, i) => { g.fillStyle = names.length ? '#7dff9a' : '#8a939c'; g.fillText(String(nm).slice(0, 18), 22 + (i % 2) * 240, 182 + Math.floor(i / 2) * 36); });
    g.fillStyle = '#ffb000'; g.font = `600 24px ${FONT}`;
    g.fillText(RC.lobbyEnd && RC.state === 'lobby' ? `Starts in ${Math.max(0, Math.ceil((RC.lobbyEnd - now()) / 1000))} s` : `Ticket रु ${TICKET} · starts 15 s after 2 racers`, 22, 296);
    RC.boardTex.needsUpdate = true;
  }

  /* ---------- per frame ---------- */
  let flagT = 0, boardT = 0;
  RC.update = (dt) => {
    if (!trk || !hud) return;
    clk += dt * 1000;
    const PL = KS.Player;
    if (RC.racing()) raceTick(dt);
    if (RC.state === 'results' && now() - RC.resultsT > (kind() === 'race' ? 30000 : 9000)) endResults();
    // the Race Room: arriving, waiting, and the refund if nobody comes
    const rr = kind() === 'race';
    if (rr && !RC.wasRR) enterRoom();
    RC.wasRR = rr;
    if (rr && ticket() && !RC.racing() && RC.list.length < 2 && Date.now() - ticket().t > REFUND_MS) RC.leaveRoom('Nobody else came to race in 3 minutes — ticket refunded');
    // alone in this Race Room? look into the others, and suggest one where someone is waiting
    if (rr && !RC.racing() && RC.state !== 'results' && RC.list.length < 2) {
      RC.aloneT = (RC.aloneT || 0) + dt;
      if (RC.aloneT > 12 && !RC.scanning && Date.now() - (RC.scanAt || 0) > 20000) scanRooms();
    } else { RC.aloneT = 0; RC.suggest = null; }
    if (isHost() && RC.state === 'lobby' && RC.lobbyEnd && now() >= RC.lobbyEnd) {
      const list = RC.list.filter((id) => id === myId() || (KS.Net && KS.Net.players.has(id)));
      if (list.length >= 2) hostSend({ k: 'grid', list, ms: GRID_MS }); else { RC.list = list; RC.lobbyEnd = 0; hostLobby(); }
    }
    if (RC.state === 'lobby' && !inRoom()) { RC.state = 'idle'; RC.list = []; }
    if (RC.racing() && inRoom() === false && !RC.practice) endResults();
    // the HQ prompt
    if (KS.state === 'play' && !RC.racing() && RC.state !== 'results' && (PL.mode === 'foot' || PL.mode === 'drive') && KS.Game) {
      const n = RC.list.length, joined = RC.list.includes(myId()), k = kind();
      if (RC.nearBooth()) KS.Game.prompt(k === 'race' ? (ticket() ? (joined ? '🎟️ You have a ticket and are on the start list' : '🎟️ Press <b>E</b> to go on the start list') : `🎟️ Press <b>E</b> to buy a ticket for the next race · रु ${TICKET}`) : ticket() ? '🎟️ You have a ticket · Press <b>E</b> to go to the <b>Race Room</b>' : `🎟️ Press <b>E</b> to buy a <b>Race Ticket</b> · रु ${TICKET} · race real players in the Race Room · prize रु 1,000`);
      else if (RC.nearHq()) KS.Game.prompt(k === 'private' ? (joined ? `🏁 In the lobby (${n} racer${n === 1 ? '' : 's'}) · Press <b>E</b> to leave` : `🏁 Press <b>E</b> to race your friends · ${n} waiting · 2 laps`) : k === 'race' ? (joined ? `🏁 On the start list · ${n} racer${n === 1 ? '' : 's'}` : '🏁 Buy a ticket at the booth to race') : '🏁 Press <b>E</b> for a solo practice run · race real players with a ticket from the booth 🎟️');
    }
    boardT -= dt; if (boardT <= 0) { boardT = 1; drawBoard(); }
    // animation: boosters scroll, flags flap, the crowd cheers
    if (boosterTex) boosterTex.offset.y = -((now() / 1000) * 1.6) % 1;
    flagT -= dt;
    if (evGroup.visible && flagT <= 0 && flagInst) {
      flagT = 0.08; const dm = RC._dm || (RC._dm = new T.Object3D()), c = KS.camera.position, tt = now() / 1000;
      flagBase.forEach((f, k) => { if (Math.abs(f.x - c.x) + Math.abs(f.z - c.z) > 260) return; dm.position.set(f.x, f.y, f.z); dm.rotation.set(Math.sin(tt * 3 + k) * 0.08, f.h + Math.PI / 2 + Math.sin(tt * 2.3 + k * 1.7) * 0.35, 0); dm.updateMatrix(); flagInst.setMatrixAt(k, dm.matrix); });
      flagInst.instanceMatrix.needsUpdate = true;
    }
    if (evGroup.visible) for (const q of crowd) { const a = RC.state === 'race' || RC.state === 'grid' || RC.state === 'results' ? 1 : 0.2, w = Math.sin(now() / 160 + q.ph); q.p.armL.rotation.x = -2.6 * a + w * 0.4 * a; q.p.armR.rotation.x = -2.6 * a - w * 0.4 * a; q.p.root.position.y += 0; }
    renderHud(dt);
  };
  let mapT = 0;
  function renderHud(dt) {
    const show = RC.state !== 'idle';
    hud.top.hidden = !show; hud.side.hidden = !(RC.racing() || RC.state === 'results');
    hud.pad.hidden = !(kind() === 'race' && !RC.racing() && RC.state !== 'results' && KS.state === 'play');
    if (!hud.pad.hidden) {
      const sg = RC.suggest, html = (sg ? `<button type="button" data-a="switch" class="go">🏁 Switch to Race Room ${sg.n} · ${sg.names.join(', ').replace(/[<>&]/g, '') || sg.waiting + ' waiting'}</button>` : '') + `<button type="button" data-a="leave">🏙️ Leave (refund रु ${TICKET})</button>`;
      if (hud.pad._h !== html) { hud.pad._h = html; hud.pad.innerHTML = html; }
    }
    if (bigT > 0) { bigT -= dt; if (bigT <= 0) hud.big.hidden = true; }
    if (me && me.wrong && RC.state === 'race') { hud.big.textContent = 'WRONG WAY'; hud.big.className = 'small warn'; hud.big.hidden = false; bigT = 0.2; }
    if (!show) return;
    if (RC.state === 'lobby') {
      const n = RC.list.length, left = RC.lobbyEnd ? Math.max(0, Math.ceil((RC.lobbyEnd - now()) / 1000)) : null, tk = ticket();
      const refund = kind() === 'race' && tk && n < 2 ? Math.max(0, Math.ceil((REFUND_MS - (Date.now() - tk.t)) / 1000)) : null;
      const html = `<div class="rc lobby">🏁 ${kind() === 'race' ? 'Race Room ' + (KS.Net.pubN || 1) : 'Race lobby'} · <b style="display:inline;font-size:20px">${n}</b>/10 racer${n === 1 ? '' : 's'} · ${left != null ? `starts in ${left} s` : 'waiting for at least 2'}<br><small style="text-transform:none;letter-spacing:0">${RC.list.map((id) => nameOf(id).replace(/[<>&]/g, '')).join(' · ')}${refund != null ? ` · refund in ${Math.floor(refund / 60)}:${String(refund % 60).padStart(2, '0')}` : ''}</small></div>`;
      if (hud.top._h !== html) { hud.top._h = html; hud.top.innerHTML = html; }
      return;
    }
    const st = standings(), my = myId(), k = st.findIndex((q) => q.id === my), t = Math.max(0, (now() - RC.goAt) / 1000);
    if (me) {
      const lap = me.fin != null ? LAPS : me.lap, left = Math.max(0, LAPS * trk.L - me.p);
      hud.top.innerHTML = `<div class="rc"><small>Lap</small><b>${lap}/${LAPS}</b></div>` + (RC.practice ? '' : `<div class="rc"><small>Pos</small><b>${k + 1}/${st.length}</b></div>`) +
        `<div class="rc"><small>Time</small><b>${fmt(me.fin != null ? me.fin : RC.state === 'grid' ? 0 : t)}</b></div><div class="rc"><small>To finish</small><b>${left >= 1000 ? (left / 1000).toFixed(2) + ' km' : Math.round(left) + ' m'}</b></div>` +
        (RC.boostT > 0 ? '<div class="rc" style="background:#ff8a00"><small>Boost</small><b>🔥</b></div>' : '');
    } else hud.top.innerHTML = `<div class="rc lobby">🏁 Ring Road Race on · ${st.length} racers · ${fmt(t)}</div>`;
    RC.boostT = Math.max(0, RC.boostT - dt);
    mapT -= dt; if (mapT > 0) return; mapT = 0.1;
    const g = hud.map.getContext('2d'); g.clearRect(0, 0, 392, 392); g.drawImage(mapBase, 0, 0);
    const dot = (x, z, c, r, h) => {
      g.save(); g.translate(hud.mx(x), hud.mz(z));
      if (h != null) { g.rotate(-h + Math.PI); g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, -r * 1.4); g.lineTo(r, r); g.lineTo(-r, r); g.closePath(); g.fill(); g.stroke(); }
      else { g.fillStyle = c; g.strokeStyle = '#000'; g.lineWidth = 2; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); g.stroke(); }
      g.restore();
    };
    for (const q of st) { if (q.id === my) continue; const pl = KS.Net && KS.Net.players.get(q.id); if (pl && pl.placed) dot(pl.x, pl.z, pl.color || '#ff4fa3', 8); }
    if (car && KS.Player.vehicle === car) dot(car.x, car.z, '#ffffff', 9, car.h);
    hud.board.innerHTML = st.map((q, i) => `<div><span><i style="background:${colorOf(q.id)}"></i>${i + 1}. ${nameOf(q.id).replace(/[<>&]/g, '')}</span><span>${q.fin != null ? fmt(q.fin) : q.gone ? 'out' : `L${Math.min(LAPS, Math.floor(Math.max(0, q.p) / trk.L) + 1)}`}</span></div>`).join('');
  }

  RC.init = (scene) => {
    if (!KS.ringLoopPts || !KS.ringLoopPts.length) return;
    buildTrack();
    let best = Infinity; trk.X.forEach((x, i) => { const d = (x + 572) ** 2 + (trk.Z[i] + 300) ** 2; if (d < best) { best = d; s0 = trk.S[i]; } }); // the start line: the straight west side, between Thulo Bharyang and Sitapaila
    RC.s0 = s0; RC.L = trk.L; RC.at = at; RC.proj = proj; RC.hazards = hazards; RC.boosters = boosters; RC.gridSlot = gridSlot;
    buildEvent(scene); buildHud();
  };
  RC.me = () => me; RC.car = () => car;
})();
