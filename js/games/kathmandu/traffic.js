/* Kathmandu Streets — left-hand traffic AI: lanes, junction turns, traffic lights, ambulances that get
   right of way, buses that stop anywhere, Uthao riders, the Nagdhunga highway. Models live in vehicles.js. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const TR = (KS.Traffic = { list: [] });
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
    for (const s of KS.signals) { const n = nodes[idx(s.i, s.j)]; n.sig = s; }
    TR.nodes = nodes;
  };
  const margin = (n) => (n.spur || n.hw ? 0 : n.ring ? 12.5 : 9.5);
  function laneOf(v, a, b, out) {
    const A = nodes[a], B = nodes[b];
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
  function placeOnRandomEdge(v, px, pz, minD, maxD) {
    for (let tries = 0; tries < 60; tries++) {
      const a = Math.floor(KS.rng() * nodes.length), n = nodes[a];
      const d = Math.hypot(n.x - px, n.z - pz); if (d < minD || d > maxD) continue;
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
    const v = { kind, type: vt, ...vis, uthao, lane: {}, ai: true, speed: 0, t: 0, x: 0, z: 0, y: 0.06, h: 0, stuck: 0, ignore: 0, honkT: KS.r(2, 12), lat: 0, side: 0, outer: KS.chance(0.4), maxSpeed: vt.speed * KS.r(0.8, 1.1), stopT: 0, callT: KS.r(3, 9) };
    if (KS.isBike(kind)) v.lat = KS.r(-0.6, 1.4);
    if (kind === 'ambulance') v.maxSpeed = vt.speed * 1.15;
    placeOnRandomEdge(v, px, pz, minD, maxD);
    TR.list.push(v); TR.scene.add(v.root);
    return v;
  };
  TR.init = (scene, count, px, pz) => {
    TR.scene = scene; TR.initGraph();
    for (let i = 0; i < count; i++) TR.spawn(MIX[i % MIX.length], px, pz, 10, 300);
  };
  /** a parked vehicle the player can take */
  TR.park = (type, x, z, h, opt = {}) => {
    const vt = KS.VTYPES[type], vis = KS.buildVehicle(type, { rider: false, conductor: false, ...opt });
    const v = { kind: type, type: vt, ...vis, lane: {}, ai: false, parked: true, speed: 0, x, z, y: KS.groundAt(x, z, 50, 60) + 0.06, h, lat: 0, side: 0, maxSpeed: vt.speed, owned: opt.owned };
    if (v.rider) v.rider.visible = false;
    v.root.position.set(x, v.y, z); v.root.rotation.y = h; TR.list.push(v); TR.scene.add(v.root); return v;
  };
  TR.remove = (v) => { const i = TR.list.indexOf(v); if (i >= 0) TR.list.splice(i, 1); v.root.parent && v.root.parent.remove(v.root); };
  function startTurn(v) {
    const B = nodes[v.b], from = v.a;
    let opts = B.nb.filter((n) => n !== from);
    if (!opts.length) opts = [from];
    const straight = opts.find((n) => { const N = nodes[n]; return Math.abs((N.x - B.x) * v.lane.dz - (N.z - B.z) * v.lane.dx) < 1; });
    const c = straight != null && KS.chance(B.hw ? 1 : 0.45) ? straight : KS.pick(opts);
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
    const test = (x, z, len, wid, o) => {
      const rx = x - v.x, rz = z - v.z; if (Math.abs(rx) > look + 12 || Math.abs(rz) > look + 12) return;
      const ahead = rx * fx + rz * fz; if (ahead <= 0) return;
      const lat = Math.abs(rx * fz - rz * fx);
      if (lat > halfW + wid / 2 + 0.25) return;
      const d = ahead - v.type.len / 2 - len / 2;
      if (d < look && d < best) { best = d; who = o; }
    };
    for (const o of others) if (o !== v) test(o.x, o.z, o.type.len, o.type.wid, o);
    if (ctx.player) test(ctx.player.x, ctx.player.z, ctx.player.len, ctx.player.wid, 'player');
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

  /* ---------- police pursuit ---------- */
  TR.startChase = (v) => { v.chase = true; v.ai = true; v.parked = false; v.idlePolice = false; v.stuck = 0; v.rev = 0; KS.setSiren(v, true); if (v.rider) v.rider.visible = true; };
  TR.endChase = (v) => { v.chase = false; KS.setSiren(v, false); v.ai = false; v.parked = true; v.idlePolice = true; v.speed = 0; };
  TR.spawnPolice = (px, pz) => { const v = TR.spawn(KS.chance(0.45) ? 'policebike' : 'police', px, pz, 110, 200); TR.startChase(v); return v; };
  TR.chasers = () => TR.list.filter((v) => v.chase);
  function chaseUpdate(v, dt, ctx) {
    const P = KS.Player, pv = P.vehicle, heat = KS.Law ? KS.Law.heat : 1;
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

  TR.update = (dt, ctx) => {
    const { px, pz, cx, cz, night } = ctx;
    updateSignals();
    const blink = Math.floor(KS.clock * 4) % 2;
    KS.sirenMats[0].color.setHex(blink ? 0xff2020 : 0x400000); KS.sirenMats[1].color.setHex(blink ? 0x001040 : 0x2050ff);
    const ambs = TR.list.filter((v) => v.kind === 'ambulance' && v.ai);
    for (const v of TR.list) {
      const dCam = Math.hypot(v.x - cx, v.z - cz);
      v.root.visible = dCam < 300 || v === ctx.playerVehicle || v.chase;
      if (v.idlePolice && !v.ai && Math.hypot(v.x - px, v.z - pz) > 260) { v.idlePolice = false; TR.recycle(v, px, pz); continue; }
      if (v.chase) { chaseUpdate(v, dt, ctx); continue; }
      if (!v.ai) continue;
      if (Math.hypot(v.x - px, v.z - pz) > 340 && !v.root.visible) { placeOnRandomEdge(v, px, pz, 130, 300); }
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
      // buses and micros stop anywhere to pick people up
      if (v.type.seats === 'bus' || v.kind === 'micro' || v.kind === 'tempo') {
        if (v.stopT > 0) { v.stopT -= dt; target = 0; }
        else if (v.mode === 'lane' && KS.chance(dt * 0.025)) v.stopT = KS.r(3, 7);
        v.callT -= dt;
        if (v.callT <= 0 && dCam < 30 && v.speed < 3 && v.kind !== 'truck') { v.callT = KS.r(4, 9); KS.say(v.root, KS.pick(KS.ROUTES_EN), 2.2); KS.audio && KS.audio.voice(Math.max(0.1, 1 - dCam / 30), 'shout'); }
      }
      // give way to ambulances coming from behind
      let yieldTo = false;
      for (const a of ambs) {
        if (a === v) continue;
        const rx = a.x - v.x, rz = a.z - v.z, d = Math.hypot(rx, rz);
        if (d < 28 && rx * Math.sin(v.h) + rz * Math.cos(v.h) < 0 && Math.cos(a.h - v.h) > 0.7) { yieldTo = true; break; }
      }
      v.side += ((yieldTo ? 1.6 : 0) - v.side) * Math.min(1, dt * 2);
      if (yieldTo) target *= 0.35;
      const ob = obstacleAhead(v, TR.list, ctx);
      if (ob.who && v.ignore <= 0) {
        const lim = Math.max(0, (ob.d - 1.5) * 1.3);
        if (lim < target) target = lim;
        if (v.speed < 0.6) {
          v.stuck += dt;
          if (v.stuck > 0.8 && v.honkT <= 0) { v.honkT = KS.r(1.5, 4); if (dCam < 90) KS.audio && KS.audio.horn(v.kind, Math.max(0.08, 1 - dCam / 90)); }
          if (v.stuck > (ob.who === 'player' || ob.who === 'ped' ? 9 : v.kind === 'ambulance' ? 2 : 4) && ob.who !== 'cow') { v.ignore = 1.6; v.stuck = 0; }
        }
      } else v.stuck = 0;
      if (v.ignore > 0) v.ignore -= dt;
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
    v.ai = true; v.parked = false; v.vy = 0; v.owned = false; if (v.rider) v.rider.visible = true;
    v.root.rotation.set(0, 0, 0, 'XYZ'); placeOnRandomEdge(v, px, pz, 150, 300);
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
