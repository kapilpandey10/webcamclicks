/* Kathmandu Streets — left-hand traffic AI: lanes, junction turns, traffic lights, ambulances that get
   right of way, buses that stop anywhere, Uthao riders, the Nagdhunga highway. Models live in vehicles.js. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const TR = (KS.Traffic = { list: [], _nextId: 0, remote: false });
  const MIX = ['bike', 'scooter', 'bike', 'scooter', 'bike', 'uthao', 'scooter', 'car', 'bike', 'sport', 'car', 'taxi', 'scooter', 'micro', 'bike', 'tempo', 'bus', 'car', 'minibus',
    'uthao', 'sedan', 'suv', 'taxi', 'scooter', 'ev', 'bike', 'truck', 'micro', 'police', 'pickup', 'cruiser', 'bus', 'scooter', 'taxi', 'bike', 'car', 'uthao', 'minibus', 'ambulance', 'scooter', 'policebike', 'bicycle', 'bike', 'bicycle', 'policebike', 'scooter'];

  /* ---------- road graph ---------- */
  const nodes = [], idx = (i, j) => i * (G.N + 1) + j;
  for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) nodes.push({ x: G.line(i), z: G.line(j), i, j, nb: [], ring: i === 0 || i === G.N || j === 0 || j === G.N });
  const blocked = (kind, line, from) => KS.noRoad.some((n) => n[0] === kind && n[1] === line && n[2] === from);
  function link(a, b) { nodes[a].nb.push(b); nodes[b].nb.push(a); }
  TR.idx = idx;
  TR.initGraph = () => {
    for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) {
      if (i < G.N && !blocked('h', j, i)) link(idx(i, j), idx(i + 1, j));
      if (j < G.N && !blocked('v', i, j)) link(idx(i, j), idx(i, j + 1));
    }
    const sw = nodes.push({ x: KS.SWAYAMBHU.x + 38, z: KS.SWAYAMBHU.z, nb: [], spur: true, hill: true }) - 1; link(sw, idx(0, 5));
    const ap = nodes.push({ x: 614, z: 0, nb: [], spur: true }) - 1; link(ap, idx(12, 6));
    // Nagdhunga highway: Kalanki -> tunnel -> Dhunibesi
    let prev = idx(0, 7);
    for (const x of [-650, -880, -1200, -1520, -1720, -1980, -2260]) {
      const n = nodes.push({ x, z: KS.HW.z, nb: [], hw: true, hill: true, spur: x === -2260 }) - 1; link(prev, n); prev = n;
    }
    if (KS.MANSION) { const m = nodes.push({ x: KS.MANSION.gx, z: KS.MANSION.gz - 6, nb: [], spur: true }) - 1; link(m, idx(8, 0)); }
    for (const s of KS.signals) { const n = nodes[idx(s.i, s.j)]; n.sig = s; }
    TR.nodes = nodes;
  };
  const margin = (n) => (n.spur || n.hw ? 0 : n.ring ? 12.5 : 9.5);
  function laneOf(v, a, b, out) {
    const A = nodes[a], B = nodes[b], long = v.type && v.type.len > 6 ? 3.5 : 0; // buses & trucks swing wide
    const margin = (n) => (n.spur || n.hw ? 0 : (n.ring ? 12.5 : 9.5) + long);
    let dx = B.x - A.x, dz = B.z - A.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const ring = A.ring && B.ring && (A.i === B.i || A.j === B.j) && !A.spur && !B.spur && !A.hw && !B.hw;
    const off = (ring ? (v.outer ? 7.2 : 3.4) : 3.5) + v.lat;
    const lx = dz, lz = -dx; // left of travel (Nepal drives on the left)
    out.sx = A.x + dx * margin(A) + lx * off; out.sz = A.z + dz * margin(A) + lz * off;
    out.ex = B.x - dx * margin(B) + lx * off; out.ez = B.z - dz * margin(B) + lz * off;
    out.dx = dx; out.dz = dz; out.lx = lx; out.lz = lz; out.len = Math.hypot(out.ex - out.sx, out.ez - out.sz);
    out.hill = A.hill || B.hill; out.hw = A.hw || B.hw;
    return out;
  }
  TR.laneOf = laneOf;

  /* ---------- vehicles ---------- */
  /** put a vehicle on a road. With hidden=true it is placed out of the camera's sight so it never pops in */
  function placeOnRandomEdge(v, px, pz, minD, maxD, hidden) {
    const cam = KS.camera;
    for (let tries = 0; tries < 120; tries++) {
      const a = Math.floor(KS.rng() * nodes.length), n = nodes[a];
      const d = Math.hypot(n.x - px, n.z - pz); if (d < minD || d > maxD) continue;
      if (hidden && cam && Math.hypot(n.x - cam.position.x, n.z - cam.position.z) < 330) continue;
      const b = KS.pick(n.nb); if (b == null) continue;
      v.a = a; v.b = b; v.mode = 'lane'; laneOf(v, a, b, v.lane); v.t = KS.r(0, v.lane.len); v.speed = v.maxSpeed * 0.6; v.side = 0;
      return true;
    }
    return false;
  }
  TR.spawn = (type, px, pz, minD = 20, maxD = 260) => {
    const uthao = type === 'uthao';
    const kind = uthao ? KS.pick(['bike', 'scooter']) : type;
    const vt = KS.VTYPES[kind], vis = KS.buildVehicle(kind, { uthao, pillion: uthao ? KS.chance(0.6) : undefined, parcel: uthao && KS.chance(0.4) });
    if (!vis) return null; // model not loaded: no vehicle, never a blocky stand-in
    const v = { id: ++TR._nextId, kind, type: vt, ...vis, uthao, lane: {}, ai: true, speed: 0, t: 0, x: 0, z: 0, y: 0.06, h: 0, stuck: 0, ignore: 0, honkT: KS.r(2, 12), lat: 0, side: 0, outer: KS.chance(0.4), maxSpeed: vt.speed * KS.r(0.8, 1.1), stopT: 0, callT: KS.r(3, 9) };
    if (KS.isBike(kind)) v.lat = KS.r(-0.6, 1.4);
    if (kind === 'ambulance') v.maxSpeed = vt.speed * 1.15;
    placeOnRandomEdge(v, px, pz, minD, maxD, minD >= 300);
    v.home = homeLot(v); v.roamT = KS.r(40, 200);
    TR.list.push(v); TR.scene.add(v.root);
    return v;
  };
  /* ---------- city bus routes: fixed loops through the bus stops ---------- */
  const ROUTE_DEFS = [
    { np: 'रत्नपार्क - कोटेश्वर', call: ['Ratnapark, Koteshwor!', 'Koteshwor! Koteshwor!'], corners: [[3, 3], [9, 3], [9, 7], [3, 7]] },
    { np: 'कलंकी - चाबहिल', call: ['Kalanki! Chabahil!', 'Chabahil, Chabahil!'], corners: [[6, 2], [10, 2], [10, 9], [6, 9]] },
    { np: 'लगनखेल - बालाजु', call: ['Lagankhel! Balaju!', 'Balaju, Balaju!'], corners: [[2, 3], [6, 3], [6, 9], [2, 9]] },
    { np: 'गोंगबु - सातदोबाटो', call: ['Gongabu! Satdobato!', 'Satdobato, aaunus!'], corners: [[3, 1], [9, 1], [9, 4], [3, 4]] },
  ];
  TR.routes = [];
  function buildRoutes() {
    for (const R of ROUTE_DEFS) {
      const seq = [];
      for (let k = 0; k < R.corners.length; k++) {
        let [i, j] = R.corners[k]; const [i2, j2] = R.corners[(k + 1) % R.corners.length];
        while (i !== i2 || j !== j2) { seq.push(idx(i, j)); i += Math.sign(i2 - i); j += Math.sign(j2 - j); }
      }
      const out = [];
      for (let k = 0; k < seq.length; k++) { // bridge any closed road with the shortest detour
        const a2 = seq[k], b2 = seq[(k + 1) % seq.length]; out.push(a2);
        if (!nodes[a2].nb.includes(b2)) { const p = TR.pathNodes(a2, b2); if (!p) { out.length = 0; break; } out.push(...p.slice(1, -1)); }
      }
      if (out.length > 3 && new Set(out).size === out.length) TR.routes.push({ ...R, nodes: out, buses: 0 });
    }
  }
  function assignRoute(v) {
    if (!TR.routes.length) return;
    const R = TR.routes.reduce((a2, b2) => (b2.buses < a2.buses ? b2 : a2)); R.buses++;
    v.route = R; v.load = KS.ri(3, 18); v.cap = v.kind === 'bus' ? 42 : 24;
    const rb = v.root.userData.routeBoard; if (rb) rb.material = KS.routeSignMat(R.np);
  }
  TR.init = (scene, count, px, pz) => {
    TR.scene = scene; TR.fleetCount = count; TR.initGraph(); buildRoutes();
    // a fixed fleet that lives all over the valley; it is simulated everywhere and only drawn near you
    for (let i = 0; i < count; i++) TR.spawn(MIX[i % MIX.length], 0, 0, 0, 1100);
    for (const v of TR.list) if (v.kind === 'bus' || v.kind === 'minibus') assignRoute(v);
    for (const v of TR.list) if (v.kind === 'micro' || v.kind === 'tempo') { v.load = KS.ri(2, 8); v.cap = v.kind === 'micro' ? 14 : 10; }
    // some start the day parked in their lots
    for (const v of TR.list) if (v.home && KS.chance(0.25)) enterLot(v, true);
  };
  /** a parked vehicle the player can take */
  TR.park = (type, x, z, h, opt = {}) => {
    const vt = KS.VTYPES[type], vis = KS.buildVehicle(type, { rider: false, conductor: false, ...opt });
    if (!vis) return null; // model not loaded: nothing to park
    const v = { id: ++TR._nextId, kind: type, type: vt, ...vis, lane: {}, ai: false, parked: true, speed: 0, x, z, y: KS.groundAt(x, z, 50, 60) + 0.06, h, lat: 0, side: 0, maxSpeed: vt.speed, owned: opt.owned };
    if (v.rider) v.rider.visible = false;
    v.root.position.set(x, v.y, z); v.root.rotation.y = h; TR.list.push(v); TR.scene.add(v.root); return v;
  };
  TR.remove = (v) => { const i = TR.list.indexOf(v); if (i >= 0) TR.list.splice(i, 1); v.root.parent && v.root.parent.remove(v.root); };
  const NARROW = { thamel: 1, old: 1, ason: 1, durbar: 1, durbar2: 1 };
  function narrow(a, b) {
    const A = nodes[a], B = nodes[b]; if (A.i == null || B.i == null) return false;
    const blocks = A.j === B.j ? [[Math.min(A.i, B.i), A.j - 1], [Math.min(A.i, B.i), A.j]] : [[A.i - 1, Math.min(A.j, B.j)], [A.i, Math.min(A.j, B.j)]];
    return blocks.every(([c, r]) => NARROW[KS.blockType(c, r)]);
  }
  function startTurn(v) {
    const B = nodes[v.b], from = v.a;
    let opts = B.nb.filter((n) => n !== from);
    if (!opts.length) opts = [from];
    // cars, buses and trucks mostly stay out of the narrow lanes of Thamel and the old town
    if (!KS.isBike(v.kind) && opts.length > 1) { const wide = opts.filter((n) => !narrow(v.b, n)); if (wide.length && KS.chance(0.85)) opts = wide; }
    // arriving home: pull into the lot
    if (v.path && !v.route && v.b === v.home.node) { v.path = null; if (enterLot(v)) return; }
    const straight = opts.find((n) => { const N = nodes[n]; return Math.abs((N.x - B.x) * v.lane.dz - (N.z - B.z) * v.lane.dx) < 1; });
    let c = straight != null && KS.chance(B.hw ? 1 : 0.45) ? straight : KS.pick(opts);
    if (v.route) { // buses keep to their route; from anywhere else they drive to the nearest point of it
      const rn = v.route.nodes, k = rn.indexOf(v.b);
      if (k >= 0) { v.path = null; const n2 = rn[(k + 1) % rn.length]; if (B.nb.includes(n2)) c = n2; }
      else if (!v.path) { let best = rn[0], bd = 1e9; for (const n of rn) { const d = Math.hypot(nodes[n].x - B.x, nodes[n].z - B.z); if (d < bd) { bd = d; best = n; } } v.path = TR.pathNodes(v.b, best); }
    }
    if (v.path) { const i = v.path.indexOf(v.b); const n2 = i >= 0 ? v.path[i + 1] : null; if (n2 != null && B.nb.includes(n2)) c = n2; else v.path = TR.pathNodes(v.b, v.home.node); }
    const cur = v.lane, nxt = laneOf(v, v.b, c, {});
    const p0x = cur.ex, p0z = cur.ez, p2x = nxt.sx, p2z = nxt.sz;
    let p1x, p1z;
    const dot = cur.dx * nxt.dx + cur.dz * nxt.dz;
    if (dot > 0.9) { p1x = (p0x + p2x) / 2; p1z = (p0z + p2z) / 2; }
    else if (dot < -0.9) { p1x = (p0x + p2x) / 2 + cur.dx * 7; p1z = (p0z + p2z) / 2 + cur.dz * 7; }
    else { const k = (p2x - p0x) * cur.dx + (p2z - p0z) * cur.dz; p1x = p0x + cur.dx * k; p1z = p0z + cur.dz * k; }
    const len = (Math.hypot(p1x - p0x, p1z - p0z) + Math.hypot(p2x - p1x, p2z - p1z) + Math.hypot(p2x - p0x, p2z - p0z)) / 2;
    v.turn = { p0x, p0z, p1x, p1z, p2x, p2z, len: Math.max(1, len), next: c, nxt };
    v.mode = 'turn'; v.t = 0;
  }
  function obstacleAhead(v, others, ctx) {
    const fx = Math.sin(v.h), fz = Math.cos(v.h), look = 6 + v.speed * 1.6, halfW = v.type.wid / 2;
    let best = 1e9, who = null;
    const test = (x, z, len, wid, o, oh) => {
      const rx = x - v.x, rz = z - v.z; if (Math.abs(rx) > look + 14 || Math.abs(rz) > look + 14) return;
      const dh = oh == null ? 0 : oh - v.h, c = Math.abs(Math.cos(dh)), sn = Math.abs(Math.sin(dh));
      const extA = (len / 2) * c + (wid / 2) * sn, extL = (len / 2) * sn + (wid / 2) * c; // the other's footprint, turned to our heading
      const ahead = rx * fx + rz * fz; if (ahead + extA <= 0.3) return;
      const lat = Math.abs(rx * fz - rz * fx);
      if (lat > halfW + extL + 0.2) return;
      const d = ahead - v.type.len / 2 - extA;
      if (d < look && d < best) { best = d; who = o; }
    };
    for (const o of others) if (o !== v && !o.lot) test(o.x, o.z, o.type.len, o.type.wid, o, o.h);
    if (ctx.player) test(ctx.player.x, ctx.player.z, ctx.player.len, ctx.player.wid, 'player', KS.Player.vehicle ? KS.Player.vehicle.h : null);
    KS.Peds.forEachNear(v.x, v.z, look + 4, (p) => { if (!p.down) test(p.x, p.z, 0.5, 0.6, 'ped'); });
    KS.Animals.obstacles((x, z) => test(x, z, 1.8, 1.2, 'cow'));
    return { d: best, who };
  }
  /* traffic light phases: N-S green 10 s, amber 2 s, then E-W */
  const LIT = { r: 0xff2a1a, y: 0xffb000, g: 0x22ff66 }, DIM = [0x3a0000, 0x3a2a00, 0x003a10];
  function updateSignals() {
    for (const s of KS.signals) {
      const t = (KS.clock + s.off) % 24;
      s.state.ns = t < 10 ? 'g' : t < 12 ? 'y' : 'r';
      s.state.ew = t < 12 ? 'r' : t < 22 ? 'g' : 'y';
      for (const ax of ['ns', 'ew']) { const st = s.state[ax], m = s.mats[ax]; m[0].color.setHex(st === 'r' ? LIT.r : DIM[0]); m[1].color.setHex(st === 'y' ? LIT.y : DIM[1]); m[2].color.setHex(st === 'g' ? LIT.g : DIM[2]); }
    }
  }
  TR.signalAt = (x, z) => { for (const s of KS.signals) if (Math.abs(x - s.x) < s.hw + 1 && Math.abs(z - s.z) < s.hw + 1) return s; return null; };

  /* ---------- the same city for everyone: the host simulates traffic, guests mirror it ----------
     In multiplayer the host is the only client that runs the traffic AI. Every 0.25 s it
     broadcasts where every vehicle near a player is; guests throw away their own fleet and
     show the host's vehicles instead, so a police chase is the same cars in the same place
     on every screen. Parked vehicles you can take stay local on every client. */
  TR.setRemote = (on) => {
    if (!!on === !!TR.remote) return;
    TR.remote = !!on;
    if (on) {
      for (const v of [...TR.list]) if (v.ai) TR.remove(v); // the host's fleet replaces ours
    } else {
      for (const v of [...TR.list]) if (v.remote) TR.remove(v);
      TR.refleet();
    }
  };
  /** fresh local fleet after leaving multiplayer (or taking over as host) */
  TR.refleet = () => {
    const P = KS.Player;
    for (let i = 0; i < (TR.fleetCount || 30); i++) TR.spawn(MIX[i % MIX.length], P.x, P.z, 0, 1100);
    for (const v of TR.list) if (v.ai && (v.kind === 'bus' || v.kind === 'minibus')) assignRoute(v);
  };
  /** one entry per vehicle near any player: [id, kind, x, z, heading, speed, chase, siren, target] */
  TR.snapshot = (points, radius) => {
    const out = [], r2 = radius * radius;
    for (const v of TR.list) {
      if (!v.ai || v.dormant || v.lot) continue;
      let near = false;
      for (const p of points) { const dx = v.x - p.x, dz = v.z - p.z; if (dx * dx + dz * dz < r2 || (v.chase && dx * dx + dz * dz < 450 * 450)) { near = true; break; } }
      if (!near) continue;
      const tgt = v.netTarget ? v.netTarget.id : 'host';
      out.push([v.id, v.kind, +v.x.toFixed(1), +v.z.toFixed(1), +v.h.toFixed(2), +v.speed.toFixed(1), v.chase ? 1 : 0, v.sirenOn ? 1 : 0, tgt]);
    }
    return out;
  };
  TR.applySnapshot = (list) => {
    if (!list) return;
    const now = KS.clock, seen = new Set();
    for (const e of list) {
      const [id, kind, x, z, h, speed, chase, siren, target] = e;
      seen.add(id);
      let v = TR.list.find((q) => q.remote && q.netId === id);
      if (!v) {
        if (!KS.VTYPES[kind]) continue;
        const vis = KS.buildVehicle(kind, {});
        if (!vis) continue; // model not loaded on this client: skip the mirror
        v = { id: ++TR._nextId, netId: id, kind, type: KS.VTYPES[kind], ...vis, lane: {}, ai: true, remote: true, speed: 0, x, z, y: 0.06, h, stuck: 0, lat: 0, side: 0, maxSpeed: KS.VTYPES[kind].speed, roamT: 1e9 };
        TR.list.push(v); TR.scene.add(v.root);
      }
      v.net = { x, z, h, speed, chase: !!chase, siren: !!siren, target, t: now };
      v.chase = !!chase; v.netTargetId = target; // readable right away, not only after the next drive step
      if (v.chase) v.dist = Math.hypot(v.x - KS.Player.x, v.z - KS.Player.z);
      if (!!siren !== !!v.sirenOn) KS.setSiren(v, !!siren);
    }
    for (const v of [...TR.list]) if (v.remote && (!seen.has(v.netId) || (v.net && now - v.net.t > 3))) TR.remove(v);
  };
  /** a mirrored vehicle glides towards the host's last reported position */
  function remoteDrive(v, dt) {
    const n = v.net; if (!n) return;
    const k = Math.min(1, dt * 7);
    v.x += (n.x - v.x) * k; v.z += (n.z - v.z) * k; v.h = KS.angLerp(v.h, n.h, k); v.speed = n.speed;
    v.chase = n.chase; v.netTargetId = n.target;
    if (v.chase) v.dist = Math.hypot(v.x - KS.Player.x, v.z - KS.Player.z);
    if (!!n.siren !== !!v.sirenOn) KS.setSiren(v, n.siren);
    v.y = KS.heightAt(v.x, v.z) + 0.06;
    v.root.position.set(v.x, v.y, v.z); v.root.rotation.set(0, v.h, 0);
  }
  TR.startChase = (v) => { if (v.remote) return; /* mirrored chases belong to the host */ v.chase = true; v.ai = true; v.parked = false; v.idlePolice = false; v.stuck = 0; v.rev = 0; KS.setSiren(v, true); if (v.rider) v.rider.visible = true; };
  TR.endChase = (v) => { if (v.remote) return; v.chase = false; KS.setSiren(v, false); v.ai = false; v.parked = true; v.idlePolice = true; v.speed = 0; };
  TR.spawnPolice = (px, pz) => { const v = TR.spawn(KS.chance(0.45) ? 'policebike' : 'police', px, pz, 330, 520); if (!v) return null; TR.startChase(v); return v; };
  TR.chasers = () => TR.list.filter((v) => v.chase && (v.remote ? v.netTargetId === (KS.Net && KS.Net.me) : !v.netTarget));
  function chaseUpdate(v, dt, ctx) {
    const P = v.netTarget || KS.Player, pv = v.netTarget ? null : P.vehicle, heat = v.netTarget ? v.netTarget.heat || 1 : KS.Law ? KS.Law.heat : 1; // netTarget: a friend the police are after
    const tx = P.x + (pv ? Math.sin(pv.h) * pv.speed * 0.6 : 0), tz = P.z + (pv ? Math.cos(pv.h) * pv.speed * 0.6 : 0);
    const dx = tx - v.x, dz = tz - v.z, d = Math.hypot(dx, dz);
    const want = Math.atan2(dx, dz), t = v.type;
    let target = d > 14 ? t.speed * (1.3 + heat * 0.1) : d > 5 ? d * 1.1 : 0;
    if (v.rev > 0) { v.rev -= dt; target = -4; }
    const diff = KS.wrapAng(want - v.h);
    v.h += KS.clamp(diff, -1, 1) * t.turn * 1.4 * Math.min(1, Math.abs(v.speed) / 4 + 0.3) * dt * (v.rev > 0 ? -1 : 1);
    if (Math.abs(diff) > 1.4 && d > 8) target = Math.min(target, 6);
    v.speed += KS.clamp(target - v.speed, -14 * dt, t.accel * 1.2 * dt);
    let nx = v.x + Math.sin(v.h) * v.speed * dt, nz = v.z + Math.cos(v.h) * v.speed * dt;
    const c = KS.collide(nx, nz, t.r, v.y, 0.5);
    if (c.hit && Math.abs(v.speed) > 1) v.speed *= 0.5;
    v.x = c.x; v.z = c.z;
    if (Math.abs(v.speed) < 0.6 && d > 8 && v.rev <= 0) { v.stuck += dt; if (v.stuck > 1.2) { v.rev = 1.2; v.stuck = 0; } } else v.stuck = 0;
    for (const o of TR.list) { if (o === v || !o.root.visible) continue; const ex = o.x - v.x, ez = o.z - v.z, e = Math.hypot(ex, ez), rr = t.r + o.type.r * 0.8; if (e < rr && e > 0.01) { const k = (rr - e) / e; v.x -= ex * k * 0.5; v.z -= ez * k * 0.5; if (!o.chase) { o.x += ex * k * 0.3; o.z += ez * k * 0.3; } } }
    v.vy = (v.vy || 0) - 22 * dt; v.y += v.vy * dt; const g = KS.groundAt(v.x, v.z, v.y, 0.5); if (v.y <= g) { v.y = g; v.vy = 0; }
    if (v.y < KS.RIVER.water - 0.9) { v.y = 0.06; v.x = P.x + 60; v.z = P.z; }
    v.dist = d;
    v.root.position.set(v.x, v.y, v.z); v.root.rotation.set(0, v.h, KS.isBike(v.kind) ? -KS.clamp(diff, -1, 1) * 0.25 : 0);
  }

  /* ---------- parking lots & bus park: every vehicle has a home it returns to ---------- */
  function homeLot(v) {
    const L = KS.LOTS || []; if (!L.length || v.kind === 'police' || v.kind === 'policebike' || v.kind === 'ambulance') return null;
    const bus = v.type.seats === 'bus' || v.kind === 'micro' || v.kind === 'tempo';
    const ok = L.filter((l) => (bus ? l.bus : !l.bus) && (v.kind !== 'truck' || l.trucks));
    return ok.length ? KS.pick(ok) : null;
  }
  TR.pathNodes = (from, to) => {
    const N = nodes.length, dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[from] = 0;
    for (let k = 0; k < N; k++) {
      let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === to) break; done[u] = 1;
      for (const w of nodes[u].nb) { const d = bd + Math.hypot(nodes[w].x - nodes[u].x, nodes[w].z - nodes[u].z); if (d < dist[w]) { dist[w] = d; prev[w] = u; } }
    }
    const p = []; let c = to; while (c >= 0) { p.unshift(c); c = prev[c]; }
    return p[0] === from ? p : null;
  };
  function bez(p0, p1, p2, u) { const iu = 1 - u; return [iu * iu * p0[0] + 2 * iu * u * p1[0] + u * u * p2[0], iu * iu * p0[1] + 2 * iu * u * p1[1] + u * u * p2[1]]; }
  /** drive from the junction into a free bay; quick=true parks instantly (start of day) */
  function enterLot(v, quick) {
    const L = v.home; if (!L) return false;
    const bay = L.bays.find((b) => !b.v && (b.bus === !!(v.type.seats === 'bus' || v.kind === 'micro' || v.kind === 'tempo') || !L.bus)); if (!bay) return false;
    bay.v = v; v.bay = bay; v.speed = 0;
    if (quick) { v.lot = { stage: 'park', t: KS.r(5, 40) }; v.x = bay.x; v.z = bay.z; v.h = bay.h; place(v); return true; }
    const n = nodes[L.node], from = [v.x, v.z];
    v.lot = { stage: 'in', u: 0, p0: from, p1: [n.x + (bay.x - n.x) * 0.15, n.z + (bay.z - n.z) * 0.15], p2: [bay.x, bay.z], len: Math.hypot(bay.x - v.x, bay.z - v.z) + 4 };
    return true;
  }
  function place(v) { v.y = KS.heightAt(v.x, v.z) + 0.06; v.root.position.set(v.x, v.y, v.z); v.root.rotation.set(0, v.h, 0); }
  function lotUpdate(v, dt, dCam) {
    const lt = v.lot;
    if (lt.stage === 'park') {
      lt.t -= dt; if (v.rider) v.rider.visible = false;
      if (lt.t <= 0 && TR.over) lt.t = KS.r(15, 40);
      if (lt.t <= 0) { // leave: back out of the bay to a road leaving the lot junction
        const L = v.home, n = nodes[L.node], b = KS.pick(n.nb), lane = laneOf(v, L.node, b, {});
        if (TR.nearCount(lane.sx, lane.sz, 8) > 0) { lt.t = 2; return; }
        v.lot = { stage: 'out', u: 0, p0: [v.x, v.z], p1: [n.x + (v.x - n.x) * 0.2, n.z + (v.z - n.z) * 0.2], p2: [lane.sx, lane.sz], len: Math.hypot(lane.sx - v.x, lane.sz - v.z) + 4, a: L.node, b };
        if (v.rider) v.rider.visible = true;
      }
      if (v.root.visible) place(v);
      return;
    }
    const sp = lt.stage === 'in' ? 3.2 : 3.8;
    lt.u = Math.min(1, lt.u + (sp * dt) / lt.len);
    const [x, z] = bez(lt.p0, lt.p1, lt.p2, lt.u), [x2, z2] = bez(lt.p0, lt.p1, lt.p2, Math.min(1, lt.u + 0.02));
    v.x = x; v.z = z; if (Math.hypot(x2 - x, z2 - z) > 1e-4) v.h = Math.atan2(x2 - x, z2 - z);
    if (v.root.visible) place(v);
    if (lt.u >= 1) {
      if (lt.stage === 'in') { v.h = v.bay.h; v.lot = { stage: 'park', t: v.type.seats === 'bus' ? KS.r(8, 18) : KS.r(10, 35) }; }
      else { v.bay.v = null; v.bay = null; v.lot = null; v.a = lt.a; v.b = lt.b; v.lane = laneOf(v, lt.a, lt.b, {}); v.t = 0; v.mode = 'lane'; v.speed = 2; }
    }
  }
  TR.lotNode = (i, j) => idx(i, j);
  /** keep a person (circle of radius r) out of vehicle bodies: returns the pushed position */
  const po = { x: 0, z: 0, hit: false, v: null };
  TR.pushOut = (x, z, r, skip) => {
    po.x = x; po.z = z; po.hit = false; po.v = null;
    for (const v of TR.list) {
      if (v === skip || v.dormant || v.lot && v.lot.stage === 'park' && !v.root.visible) continue;
      const dx = po.x - v.x, dz = po.z - v.z; if (dx > 7 || dx < -7 || dz > 7 || dz < -7) continue;
      const sh = Math.sin(v.h), ch = Math.cos(v.h), f = dx * sh + dz * ch, sd = dx * ch - dz * sh;
      const hl = v.type.len / 2 + r, hw = v.type.wid / 2 + r; if (Math.abs(f) >= hl || Math.abs(sd) >= hw) continue;
      const pf = hl - Math.abs(f), ps = hw - Math.abs(sd);
      let nf = f, ns = sd; if (pf < ps) nf = Math.sign(f || 1) * hl; else ns = Math.sign(sd || 1) * hw;
      po.x = v.x + nf * sh + ns * ch; po.z = v.z + nf * ch - ns * sh; po.hit = true; po.v = v;
    }
    return po;
  };

  /* ---------- bus stops: people wait, board and get off ---------- */
  const pool = [], walkers = [], ROLES = ['man', 'woman', 'student', 'elder', 'office', 'woman', 'man'];
  const getPerson = () => { let p = pool.pop(); if (!p) { p = KS.makePerson(KS.pick(ROLES)); TR.scene.add(p.root); } p.root.visible = true; return p; };
  const putPerson = (p) => { p.root.visible = false; pool.push(p); };
  const along = (st) => [Math.abs(st.kz), Math.abs(st.kx)];
  function standAt(st, i) { const [ax, az] = along(st), o = (i % 5) * 0.9 - 1.8; return [st.sx - st.kx * 0.6 + ax * o, st.sz - st.kz * 0.6 + az * o]; }
  function walk(p, x, z, tx, tz, then) { walkers.push({ p, x, z, tx, tz, then }); }
  /** the bus stands at the stop: first people get off, then the queue gets on */
  function busStopUpdate(v, dt, dCam) {
    const S = v.atStop, st = S.st; S.t += dt; S.next -= dt;
    if (S.next > 0) return; S.next = 0.9;
    const fx = Math.sin(v.h), fz = Math.cos(v.h), door = [v.x + st.kx * (v.type.wid / 2 + 0.3) + fx * v.type.len * 0.25, v.z + st.kz * (v.type.wid / 2 + 0.3) + fz * v.type.len * 0.25];
    if (v.alightN > 0) {
      v.alightN--; v.load = Math.max(0, v.load - 1);
      if (dCam < 140) { const p = getPerson(), [sx, sz] = standAt(st, KS.ri(0, 4)), [ax, az] = along(st), d = KS.chance(0.5) ? 1 : -1; walk(p, door[0], door[1], sx, sz, (w) => walk(w.p, sx, sz, sx + ax * d * 14, sz + az * d * 14, (w2) => putPerson(w2.p))); }
      return;
    }
    if (st.count > 0 && v.load < v.cap) {
      st.count--; v.load++;
      const p = st.models.pop(); if (p) walk(p, p.root.position.x, p.root.position.z, door[0], door[1], (w) => putPerson(w.p));
      return;
    }
    if (S.t > 2.5) { v.lastStop = st; v.atStop = null; v.plan = null; }
  }
  let stopT = 0;
  function stopsUpdate(dt, ctx) {
    for (let k = walkers.length - 1; k >= 0; k--) {
      const w = walkers[k], dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz), sp = 1.4;
      if (d < 0.15) { walkers.splice(k, 1); w.then && w.then(w); continue; }
      const m = Math.min(d, sp * dt); w.x += (dx / d) * m; w.z += (dz / d) * m;
      w.p.root.position.set(w.x, KS.heightAt(w.x, w.z) + 0.02, w.z); w.p.root.rotation.y = Math.atan2(dx, dz); KS.animWalk(w.p, dt, sp);
    }
    stopT -= dt; if (stopT > 0) return; stopT = 0.5;
    const cam = KS.camera.position, dens = TR.density();
    for (const st of KS.busStops || []) {
      st.spawnT -= 0.5 * (0.3 + dens);
      if (st.spawnT <= 0) { st.spawnT = KS.r(12, 35); if (st.count < 7) st.count++; }
      const near = Math.abs(st.sx - cam.x) < 150 && Math.abs(st.sz - cam.z) < 150, want = near ? Math.min(st.count, 5) : 0;
      while (st.models.length > want) putPerson(st.models.pop());
      while (st.models.length < want) {
        const p = getPerson(), [x, z] = standAt(st, st.models.length);
        p.root.position.set(x, KS.heightAt(x, z) + 0.02, z); p.root.rotation.y = Math.atan2(-st.kx, -st.kz); KS.animWalk(p, 0, 0); st.models.push(p);
      }
    }
  }

  /* ---------- how many vehicles are out depends on the time of day ----------
     Never a ghost town: even at 3 am at least 45% of the fleet is out, so the streets
     always have something moving near you. */
  TR.density = () => { const H = KS.time; return Math.max(0.45, H < 5 ? 0.12 : H < 6.5 ? 0.3 : H < 7.5 ? 0.6 : H < 10 ? 0.95 : H < 16 ? 0.6 : H < 19.5 ? 0.9 : H < 22 ? 0.42 : 0.18); };
  let balT = 0;
  function balance(dt, ctx) {
    balT -= dt; if (balT > 0) return; balT = 0.4;
    const fleet = TR.list.filter((v) => v.home), cam = KS.camera.position;
    const out = fleet.filter((v) => v.ai && !v.lot && !v.dormant && !v.chase), budget = Math.round(fleet.length * TR.density());
    TR.over = out.length > budget;
    const hidden = (x, z) => Math.hypot(x - cam.x, z - cam.z) > 330;
    if (out.length > budget) { // send one home (out of sight)
      const v = out.find((q) => hidden(q.x, q.z) && q !== ctx.playerVehicle);
      if (v) { v.path = null; if (!enterLot(v, true)) { v.dormant = true; v.root.visible = false; } }
    } else if (out.length < budget - 1) { // bring one out: a sleeping car near you first, so the street fills in where you are
      const p = fleet.find((q) => q.lot && q.lot.stage === 'park' && hidden(nodes[q.home.node].x, nodes[q.home.node].z));
      if (p) p.lot.t = 0;
      else { const d = fleet.find((q) => q.dormant && Math.hypot(q.x - cam.x, q.z - cam.z) < 400); if (d) { d.dormant = false; placeOnRandomEdge(d, ctx.px, ctx.pz, 20, 400, false); } else { const d2 = fleet.find((q) => q.dormant); if (d2) { d2.dormant = false; placeOnRandomEdge(d2, ctx.px, ctx.pz, 0, 1100, true); } } }
    }
  }

  TR.update = (dt, ctx) => {
    const { px, pz, cx, cz, night } = ctx;
    updateSignals();
    const blink = Math.floor(KS.clock * 4) % 2;
    KS.sirenMats[0].color.setHex(blink ? 0xff2020 : 0x400000); KS.sirenMats[1].color.setHex(blink ? 0x001040 : 0x2050ff);
    const ambs = TR.list.filter((v) => v.kind === 'ambulance' && v.ai);
    if (!TR.remote) { balance(dt, ctx); stopsUpdate(dt, ctx); } // the host decides all of this; guests mirror it
    for (const v of TR.list) {
      const dCam = Math.hypot(v.x - cx, v.z - cz);
      v.root.visible = dCam < 300 || v === ctx.playerVehicle || v.chase;
      if (TR.remote && v.remote) { remoteDrive(v, dt); continue; } // the host's vehicle, gliding to its next reported spot
      if (v.idlePolice && !v.ai && dCam > 330) { v.idlePolice = false; TR.recycle(v, px, pz); continue; }
      if (v.lot) { lotUpdate(v, dt, dCam); continue; }
      if (v.dormant) { v.root.visible = false; continue; }
      if (v.chase) { chaseUpdate(v, dt, ctx); continue; }
      if (!v.ai) {
        if (v.knockX || v.knockZ) { // a parked vehicle that was hit slides a little
          const c = KS.collide(v.x + v.knockX, v.z + v.knockZ, v.type.r, v.y, 0.5); v.x = c.x; v.z = c.z; v.knockX *= 0.6; v.knockZ *= 0.6;
          if (Math.abs(v.knockX) + Math.abs(v.knockZ) < 0.01) v.knockX = v.knockZ = 0;
          if (v !== ctx.playerVehicle) { v.root.position.x = v.x; v.root.position.z = v.z; }
        }
        continue;
      }
      if (v.stunned > 0) { v.stunned -= dt; v.speed = Math.max(0, v.speed - 20 * dt); v.knockX = v.knockZ = 0; if (v.root.visible) { v.root.rotation.z = Math.sin(KS.clock * 30) * 0.02 * v.stunned; } continue; }
      v.safeT = (v.safeT || KS.r(0, 0.5)) - dt;
      if (v.safeT <= 0) { // if a vehicle ever ends up inside a building or wall, put it back on a road elsewhere
        v.safeT = 0.5; const c = KS.collide(v.x, v.z, Math.min(1.2, v.type.wid * 0.45), v.y, 2.5);
        if (c.hit && c.solid && !c.solid.bollard && c.solid.top > v.y + 2.5 && v.mode === 'lane') { placeOnRandomEdge(v, px, pz, 0, 1100, true); continue; }
      }
      let target = v.maxSpeed * (v.mode === 'turn' ? (v.type.len < 2.3 ? 0.8 : 0.5) : 1) * (v.lane.hill && !v.lane.hw ? 0.6 : 1);
      if (ctx.rain) target *= 0.8;
      // red lights
      if (v.mode === 'lane' && v.kind !== 'ambulance') {
        const B = nodes[v.b];
        if (B.sig) {
          const st = B.sig.state[Math.abs(v.lane.dx) > 0.5 ? 'ew' : 'ns'], rem = v.lane.len - v.t;
          if (st === 'r' || (st === 'y' && rem > 6)) if (rem < 32 && rem > -1) target = Math.min(target, Math.max(0, (rem - 1.2) * 1.1));
        }
      }
      // buses, micros and tempos stop at bus stops, but only when someone is waiting or wants to get off
      if (v.type.seats === 'bus' || v.kind === 'micro' || v.kind === 'tempo') {
        if (v.atStop) { target = 0; busStopUpdate(v, dt, dCam); }
        else if (v.mode === 'lane' && v.kind !== 'truck') for (const st of KS.busStops || []) {
          if (st === v.lastStop) continue;
          const rx = st.x - v.x, rz = st.z - v.z, ahead = rx * v.lane.dx + rz * v.lane.dz, lat = Math.abs(rx * v.lane.dz - rz * v.lane.dx);
          if (lat > 2.6 || ahead < -0.5 || ahead > 40) continue;
          if (v.plan !== st) { v.plan = st; v.alightN = v.load > 0 && KS.chance(0.6) ? KS.ri(1, Math.min(3, v.load)) : 0; }
          if (!st.count && !v.alightN) { v.lastStop = st; break; } // nobody waiting, nobody getting off: drive past
          target = Math.min(target, Math.max(0, (ahead - 0.5) * 0.7));
          if (ahead < 1.2 && v.speed < 1.5) { v.atStop = { st, t: 0, next: 0.8 }; v.speed = 0; }
          break;
        }
        v.callT -= dt;
        if (v.callT <= 0 && dCam < 30 && v.speed < 3 && v.kind !== 'truck') { v.callT = KS.r(4, 9); KS.say(v.root, KS.pick(v.route ? v.route.call : KS.ROUTES_EN), 2.2); KS.audio && KS.audio.voice(Math.max(0.1, 1 - dCam / 30), 'shout'); }
      }
      // give way to ambulances coming from behind
      let yieldTo = false;
      for (const a of ambs) {
        if (a === v) continue;
        const rx = a.x - v.x, rz = a.z - v.z, d = Math.hypot(rx, rz);
        if (d < 28 && rx * Math.sin(v.h) + rz * Math.cos(v.h) < 0 && Math.cos(a.h - v.h) > 0.7) { yieldTo = true; break; }
      }
      const ob = obstacleAhead(v, TR.list, ctx);
      // overtaking: when stuck behind something that is not moving, pull out to the right and go around it
      if (v.over > 0) { v.over -= dt; if (!ob.who) v.clearT = (v.clearT || 0) + dt; else v.clearT = 0; if (v.clearT > 1.2 || v.mode !== 'lane') v.over = 0; }
      const sideWant = yieldTo ? 1.6 : v.over > 0 ? -3.3 : 0;
      v.side += (sideWant - v.side) * Math.min(1, dt * 1.6);
      if (yieldTo) target *= 0.35;
      if (ob.who) {
        const lim = Math.max(0, (ob.d - 1.5) * 1.3);
        if (lim < target) target = lim;
        if (v.speed < 0.6) {
          v.stuck += dt;
          if (v.stuck > 0.8 && v.honkT <= 0) { v.honkT = KS.r(1.5, 4); if (dCam < 90) KS.audio && KS.audio.horn(v.kind, Math.max(0.08, 1 - dCam / 90)); }
          const still = ob.who === 'cow' || ob.who === 'player' ? !(KS.Player.vehicle && Math.abs(KS.Player.vehicle.speed) > 0.5) || ob.who === 'cow' : ob.who !== 'ped' && (ob.who.parked || !ob.who.ai || ob.who.speed < 0.3);
          if (still && v.stuck > 2.5 && v.mode === 'lane' && !(v.over > 0) && v.lane.len - v.t > 12) { v.over = 9; v.clearT = 0; v.stuck = 0; }
        }
      } else v.stuck = 0;
      // going home: head for the home lot now and then
      v.roamT -= dt;
      if (v.roamT <= 0 && v.home && !v.path && !v.route && v.mode === 'lane' && !v.uthao) { v.roamT = KS.r(80, 260); v.path = TR.pathNodes(v.b, v.home.node); v.pi = 0; }
      v.honkT -= dt;
      if (v.honkT < -8 && KS.chance(dt * 0.15)) { v.honkT = KS.r(4, 16); if (dCam < 70) KS.audio && KS.audio.horn(v.kind, Math.max(0.05, 0.6 - dCam / 120)); }
      const acc = target > v.speed ? v.type.accel : 14;
      v.speed += KS.clamp(target - v.speed, -acc * dt, acc * dt);
      v.t += v.speed * dt;
      if (v.mode === 'lane') {
        const L = v.lane;
        if (v.t >= L.len) { v.t -= L.len; startTurn(v); }
        else { v.x = L.sx + L.dx * v.t + L.lx * v.side; v.z = L.sz + L.dz * v.t + L.lz * v.side; v.h = Math.atan2(L.dx, L.dz); }
      }
      if (v.mode === 'turn') {
        const tr = v.turn, u = Math.min(1, v.t / tr.len), iu = 1 - u;
        v.x = iu * iu * tr.p0x + 2 * iu * u * tr.p1x + u * u * tr.p2x; v.z = iu * iu * tr.p0z + 2 * iu * u * tr.p1z + u * u * tr.p2z;
        const tx = 2 * iu * (tr.p1x - tr.p0x) + 2 * u * (tr.p2x - tr.p1x), tz = 2 * iu * (tr.p1z - tr.p0z) + 2 * u * (tr.p2z - tr.p1z);
        if (tx * tx + tz * tz > 1e-6) v.h = Math.atan2(tx, tz);
        if (u >= 1) { v.t -= tr.len; v.a = v.b; v.b = tr.next; v.lane = tr.nxt; v.mode = 'lane'; }
      }
      v.y = v.lane.hill ? KS.heightAt(v.x, v.z) + 0.06 : 0.06;
      if (v.root.visible) {
        v.root.position.set(v.x, v.y, v.z); v.root.rotation.y = v.h;
        if (v.lane.hill && v.mode === 'lane') v.root.rotation.x = -Math.atan2(KS.heightAt(v.x + Math.sin(v.h), v.z + Math.cos(v.h)) - KS.heightAt(v.x, v.z), 1); else v.root.rotation.x = 0;
        if (KS.isBike(v.kind)) v.root.rotation.z = v.mode === 'turn' ? -0.18 : 0;
      }
    }
    KS.headMat.color.setHex(night > 0.3 ? 0xfff8d8 : 0xd8d6cc); KS.tailMat.color.setHex(night > 0.3 ? 0xff2a2a : 0x8a1010);
  };
  TR.recycle = (v, px, pz) => {
    v.ai = true; v.parked = false; v.vy = 0; v.owned = false; v.lot = null; v.path = null; if (v.rider) v.rider.visible = true;
    v.root.rotation.set(0, 0, 0, 'XYZ'); placeOnRandomEdge(v, px, pz, 0, 1100, true);
  };
  TR.nearCount = (x, z, r) => { let n = 0; for (const v of TR.list) if (v.ai && v.speed > 1 && Math.abs(v.x - x) < r && Math.abs(v.z - z) < r) n++; return n; };
  TR.nearest = (x, z, r) => { let best = null, bd = r; for (const v of TR.list) { const d = Math.hypot(v.x - x, v.z - z) - v.type.len * 0.35; if (d < bd) { bd = d; best = v; } } return best; };

  /* ---------- GPS: shortest path on the road graph ---------- */
  TR.nearestNode = (x, z) => { let best = 0, bd = 1e12; nodes.forEach((n, i) => { const d = (n.x - x) ** 2 + (n.z - z) ** 2; if (d < bd) { bd = d; best = i; } }); return best; };
  TR.route = (x0, z0, x1, z1) => {
    const s = TR.nearestNode(x0, z0), e = TR.nearestNode(x1, z1), N = nodes.length;
    const dist = new Float64Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    dist[s] = 0;
    for (let k = 0; k < N; k++) {
      let u = -1, bd = Infinity; for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd) { bd = dist[i]; u = i; }
      if (u < 0 || u === e) break; done[u] = 1;
      for (const w of nodes[u].nb) { const d = bd + Math.hypot(nodes[w].x - nodes[u].x, nodes[w].z - nodes[u].z); if (d < dist[w]) { dist[w] = d; prev[w] = u; } }
    }
    const path = [[x1, z1]]; let c = e; while (c >= 0) { path.push([nodes[c].x, nodes[c].z]); c = prev[c]; } path.push([x0, z0]);
    return path.reverse();
  };
})();
