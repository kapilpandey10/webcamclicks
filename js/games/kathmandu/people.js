/* Kathmandu Streets — people & animals: pedestrians, pilgrims, sadhus, vendors, traffic police, cows, dogs, pigeons, monkeys. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G, P = KS.palette;
  const SKIN = [0xc68d5f, 0xb07a4f, 0xd8a47a, 0x9a6a44, 0xe0b48c, 0xa87048];
  const SKIN_T = [0xf0c8a8, 0xe8b898, 0xf6d6c0, 0x8a5a3a, 0xd9a882];
  const BRIGHT = [0xd12b2b, 0x1d4fb8, 0xf2c418, 0x1f9a4c, 0xe86412, 0x8a2be2, 0xe23a8a, 0x0aa3a3, 0xffffff, 0x333333];
  const DULL = [0x2a2f45, 0x3a3a3a, 0x5a4a3a, 0x6b6b5a, 0x1e2a3a, 0x444c5c, 0x7a6a50];
  const SARI = [0xc8102e, 0xe23a8a, 0xf2a516, 0x7b1fa2, 0x00897b, 0xd84315, 0xffd54f, 0x1565c0];

  const LINES = {
    greet: ['Namaste!', 'Namaskar 🙏', 'K cha dai?', 'Sanchai?', 'Khana khanu bhayo?', 'Aaja jam cha!', 'Chiya khane?'],
    angry: ['Oi! Bistarai!', 'Aankha chaina?', 'Hey! Careful!', 'Ke garya ho?!', 'Hare Shiva!', 'Dhyan dinus na!'],
    tourist: ['Hello! Momo?', 'Which way to Thamel?', 'Namaste! 🙏', 'What a view!', 'Is this Durbar Square?'],
    monk: ['Om mani padme hum', 'Tashi delek 🙏'],
    vendor: ['Momo, momo, taja momo!', 'Taja tarkari!', 'Pashmina, sasto!', 'Chiya, garam chiya!'],
    police: ['Rok! Rok!', 'Side ma lagaunus!', 'License dekhaunus!'],
    sadhu: ['Bam Bam Bhole!', 'Har Har Mahadev', 'Photo? Dakshina!'],
    kid: ['Goal!', 'Dai, ball!', 'Hello! Hello!'],
  };
  KS.LINES = LINES;

  /* ---------------- speech bubbles (DOM, projected) ---------------- */
  const bubbles = [];
  KS.say = (obj, text, dur = 2.6, cls = '') => {
    const layer = document.getElementById('bubbles'); if (!layer) return;
    let b = bubbles.find((x) => x.obj === obj);
    if (!b) { const el = document.createElement('div'); el.className = 'bubble ' + cls; layer.appendChild(el); b = { el, obj }; bubbles.push(b); }
    b.el.textContent = text; b.t = dur; b.el.className = 'bubble ' + cls;
  };
  const _v = new T.Vector3();
  KS.updateBubbles = (dt, camera, W, H) => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t -= dt;
      if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); continue; }
      b.obj.getWorldPosition(_v); _v.y += 2.3; _v.project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      b.el.style.display = vis ? 'block' : 'none';
      if (vis) b.el.style.transform = `translate(${((_v.x + 1) / 2) * W}px, ${((1 - _v.y) / 2) * H}px) translate(-50%, -100%)`;
      b.el.style.opacity = Math.min(1, b.t * 2);
    }
  };

  /* ---------------- person builder ---------------- */
  KS.makePerson = (kind, o = {}) => {
    const body = new KS.Builder(), legL = new KS.Builder(), legR = new KS.Builder(), armL = new KS.Builder(), armR = new KS.Builder();
    const tourist = kind === 'tourist';
    const skin = o.skin || (tourist ? KS.pick(SKIN_T) : KS.pick(SKIN));
    let shirt = KS.pick(BRIGHT.concat(DULL)), pants = KS.pick(DULL), shoe = KS.pick([0x222222, 0x5a3a22, 0xdddddd]);
    let hair = KS.pick([0x111111, 0x1a1410, 0x222222]);
    let robe = null, skirt = null, topi = false, pack = null, longHair = false, beard = null, cap = null, doko = false, bun = false;
    switch (kind) {
      case 'woman': shirt = KS.pick(SARI); longHair = true; if (KS.chance(0.55)) skirt = shirt; else pants = KS.pick([0xf4f0e6, 0x333333, shirt]); break;
      case 'elder': hair = KS.pick([0xcccccc, 0xeeeeee, 0x999999]); shirt = KS.pick([0xf0ece0, 0xd8d0b0, 0x7a6a50]); pants = 0xe8e0cc; topi = KS.chance(0.8); break;
      case 'monk': robe = P.maroon; shirt = KS.chance(0.5) ? P.saffron : P.maroon; skirt = P.maroon; hair = skin; break;
      case 'sadhu': robe = KS.pick([0xe86412, 0xf2a516, 0xd84315]); skirt = robe; shirt = robe; hair = 0x3a3028; beard = 0x8a8070; bun = true; break;
      case 'tourist': shirt = KS.pick([0xd12b2b, 0x1d4fb8, 0x1f9a4c, 0xe86412, 0xf2c418, 0x0aa3a3]); pants = KS.pick([0x6b6b5a, 0x2a2f45, 0xc8b890]); hair = KS.pick([0xd8b860, 0x8a5a2a, 0x3a2a1a, 0xb8b8b0]); pack = KS.pick([0x333333, 0xd12b2b, 0x1d4fb8, 0xe86412]); cap = KS.chance(0.5) ? KS.pick([0xf2e6c8, 0x333333, 0x1d4fb8]) : null; longHair = KS.chance(0.4); break;
      case 'student': shirt = 0xf4f4f4; pants = KS.pick([0x1e2a5a, 0x555555]); pack = KS.pick([0x1d4fb8, 0xd12b2b, 0x333333]); if (KS.chance(0.5)) { skirt = pants; longHair = true; } break;
      case 'porter': shirt = KS.pick(DULL); pants = KS.pick(DULL); doko = true; topi = KS.chance(0.5); break;
      case 'police': shirt = 0x2c4d8a; pants = 0x1a2440; cap = 0xf4f4f4; break;
      case 'kid': shirt = KS.pick(BRIGHT); break;
      case 'player': shirt = 0xc81e1e; pants = 0x2b4a7a; shoe = 0xf4f4f4; pack = 0x222222; topi = true; break;
      default: topi = KS.chance(0.35); if (KS.chance(0.25)) shirt = KS.pick([0x2a2f45, 0x3a3a3a, 0x5a4a3a]); // jacket
    }
    // legs
    for (const [b] of [[legL], [legR]]) {
      if (!skirt) b.box(0, -0.9, 0, 0.17, 0.9, 0.2, pants); else b.box(0, -0.9, 0, 0.14, 0.4, 0.16, skin);
      b.box(0, -0.98, 0.03, 0.19, 0.1, 0.3, shoe);
    }
    // body
    body.box(0, 0.88, 0, 0.42, 0.66, 0.25, shirt);
    if (skirt) body.cyl(0, 0.08, 0, 0.3, 0.84, skirt, 10, 0.68);
    else body.box(0, 0.82, 0, 0.4, 0.14, 0.24, pants);
    if (robe) body.box(0.05, 0.92, 0, 0.47, 0.55, 0.27, robe, 0, 0, 0.35); // shoulder wrap
    if (kind === 'woman' && !skirt) body.box(0, 0.6, 0, 0.44, 0.4, 0.27, shirt); // long kurta
    if (kind === 'police') { body.box(0, 0.96, 0.0, 0.44, 0.3, 0.27, 0xd8ff3a); }
    body.box(0, 1.53, 0, 0.1, 0.06, 0.1, skin); // neck
    body.box(0, 1.58, 0, 0.24, 0.27, 0.24, skin); // head
    body.box(-0.06, 1.69, 0.121, 0.04, 0.03, 0.01, 0x111111); body.box(0.06, 1.69, 0.121, 0.04, 0.03, 0.01, 0x111111); // eyes
    if (hair !== skin) {
      body.box(0, 1.8, -0.01, 0.26, 0.08, 0.26, hair);
      body.box(0, 1.6, -0.12, 0.26, 0.22, 0.04, hair);
      if (longHair) body.box(0, 1.25, -0.14, 0.2, 0.5, 0.05, hair);
      if (bun) body.sphere(0, 1.9, -0.04, 0.1, hair, 1, 6);
    }
    if (beard) body.box(0, 1.46, 0.1, 0.2, 0.22, 0.08, beard);
    if (kind === 'sadhu') body.box(0, 1.74, 0.122, 0.12, 0.04, 0.01, 0xf2c418);
    if (kind === 'woman') body.box(0, 1.71, 0.122, 0.025, 0.025, 0.01, 0xc8102e); // tika
    if (topi) { // dhaka topi
      const tc = KS.pick([0xb81c1c, 0x2a2a2a, 0x7a1fa2, 0x1d4fb8]);
      body.box(0, 1.84, 0, 0.25, 0.13, 0.25, tc, 0, -0.12);
      body.box(0.0, 1.9, 0.02, 0.2, 0.02, 0.2, KS.pick([0xf2c418, 0xffffff, 0x1f9a4c]), 0, -0.12);
    }
    if (cap) { body.box(0, 1.82, 0, 0.27, 0.1, 0.27, cap); body.box(0, 1.84, 0.16, 0.24, 0.03, 0.12, cap); }
    if (pack) body.box(0, 0.95, -0.2, 0.36, tourist ? 0.62 : 0.4, 0.16, pack);
    if (doko) { body.cyl(0, 0.95, -0.32, 0.26, 0.6, 0xa0784a, 8, 1.35); for (let i = 0; i < 3; i++) body.box(KS.r(-0.1, 0.1), 1.45, -0.32, 0.18, 0.15, 0.18, KS.pick([0x5cae3a, 0xe8d23a, 0xd12b2b])); body.box(0, 1.72, 0.0, 0.26, 0.03, 0.26, 0x7a5a3a); }
    // arms
    for (const b of [armL, armR]) {
      b.box(0, -0.58, 0, 0.12, 0.6, 0.14, robe && b === armL ? robe : shirt);
      b.box(0, -0.68, 0, 0.1, 0.1, 0.11, kind === 'police' ? 0xffffff : skin);
    }
    const root = new T.Group();
    const mk = (b, x, y) => { const m = new T.Mesh(b.build(), KS.M.vc); m.position.set(x, y, 0); m.castShadow = true; root.add(m); return m; };
    const torso = mk(body, 0, 0);
    const lL = mk(legL, -0.1, 0.9), lR = mk(legR, 0.1, 0.9), aL = mk(armL, -0.28, 1.48), aR = mk(armR, 0.28, 1.48);
    if (kind === 'kid') root.scale.setScalar(0.66);
    if (kind === 'elder') { torso.rotation.x = 0.12; }
    return { root, torso, legL: lL, legR: lR, armL: aL, armR: aR, kind, phase: KS.r(0, 6), skirt: !!skirt };
  };
  KS.animWalk = (p, dt, speed) => {
    p.phase += dt * (2.2 + speed * 2.4);
    const a = Math.min(0.75, 0.25 + speed * 0.12) * (speed > 0.05 ? 1 : 0);
    const s = Math.sin(p.phase) * a;
    p.legL.rotation.x = s; p.legR.rotation.x = -s; p.armL.rotation.x = -s * 0.8; p.armR.rotation.x = s * 0.8;
    p.armL.rotation.z = 0; p.armR.rotation.z = 0;
    p.torso.position.y = Math.abs(Math.cos(p.phase)) * 0.04 * (a > 0 ? 1 : 0);
  };
  KS.animSit = (p) => { p.legL.rotation.x = p.legR.rotation.x = -1.45; p.armL.rotation.x = p.armR.rotation.x = -0.5; p.root.children.forEach((c) => (c.position.y -= 0)); };

  /* ---------------- pedestrian system ---------------- */
  const Peds = (KS.Peds = { list: [] });
  const walkable = (c, r) => { const t = KS.blockType(c, r); return t !== 'river' && t !== 'outside'; };
  function rectOf(c, r) { const R = KS.World.blockRect(c, r); return { x0: R.x0 + 2, x1: R.x1 - 2, z0: R.z0 + 2, z1: R.z1 - 2 }; }
  function perimPos(ped, out) {
    const R = ped.rect, w = R.x1 - R.x0, d = R.z1 - R.z0, L = 2 * (w + d);
    let s = ((ped.s % L) + L) % L; ped.s = s;
    const o = ped.lat;
    if (s < w) { out.x = R.x0 + s; out.z = R.z0 + o; out.h = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else if (s < w + d) { out.x = R.x1 - o; out.z = R.z0 + (s - w); out.h = ped.dir > 0 ? 0 : Math.PI; }
    else if (s < 2 * w + d) { out.x = R.x1 - (s - w - d); out.z = R.z1 - o; out.h = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else { out.x = R.x0 + o; out.z = R.z1 - (s - 2 * w - d); out.h = ped.dir > 0 ? Math.PI : 0; }
    return out;
  }
  function cornerS(R, k) { const w = R.x1 - R.x0, d = R.z1 - R.z0; return [0, w, w + d, 2 * w + d][k]; }
  const CROSS = { 0: [[0, -1, 3], [-1, 0, 1]], 1: [[0, -1, 2], [1, 0, 0]], 2: [[0, 1, 1], [1, 0, 3]], 3: [[0, 1, 0], [-1, 0, 2]] };
  const AMBIENT_KINDS = ['man', 'man', 'woman', 'woman', 'elder', 'student', 'tourist', 'porter', 'man', 'woman', 'kid', 'monk'];

  function placeAmbient(ped, px, pz, minD, maxD) {
    for (let tries = 0; tries < 30; tries++) {
      const a = KS.r(0, Math.PI * 2), d = KS.r(minD, maxD);
      const { c, r } = G.blockOf(px + Math.cos(a) * d, pz + Math.sin(a) * d);
      if (!walkable(c, r)) continue;
      ped.c = c; ped.r = r; ped.rect = rectOf(c, r);
      ped.s = KS.r(0, 2 * (ped.rect.x1 - ped.rect.x0 + ped.rect.z1 - ped.rect.z0));
      ped.mode = 'walk'; return true;
    }
    return false;
  }

  Peds.init = (scene, count, px, pz) => {
    Peds.scene = scene;
    // ambient walkers that follow the player around the city
    for (let i = 0; i < count; i++) {
      const kind = KS.pick(AMBIENT_KINDS), p = KS.makePerson(kind);
      const ped = { p, kind, mode: 'walk', dir: KS.chance(0.5) ? 1 : -1, lat: KS.r(-1.3, 1.3), speed: kind === 'elder' ? 0.8 : KS.r(1.0, 1.6), ambient: true, x: 0, z: 0, h: 0, y: 0, t: 0 };
      if (kind === 'tourist') ped.speed *= 0.85;
      placeAmbient(ped, px, pz, 10, 240);
      scene.add(p.root); Peds.list.push(ped);
    }
    // pilgrims circling stupas (clockwise kora)
    for (const k of KS.koras) for (let i = 0; i < k.n; i++) {
      const kind = KS.pick(k.kinds), p = KS.makePerson(kind);
      const ped = { p, kind, mode: 'kora', k, a: KS.r(0, Math.PI * 2), rr: KS.r(k.r0, k.r1), speed: KS.r(0.9, 1.3), x: 0, z: 0, h: 0, y: k.y || 0.15, t: 0 };
      scene.add(p.root); Peds.list.push(ped);
    }
    // plaza wanderers
    for (const z of KS.plazas) for (let i = 0; i < z.n; i++) {
      const kind = KS.pick(z.kinds || ['man', 'woman', 'tourist', 'tourist', 'elder', 'kid', 'porter']), p = KS.makePerson(kind);
      const ped = { p, kind, mode: 'plaza', zone: z, x: KS.r(z.x0, z.x1), z: KS.r(z.z0, z.z1), tx: 0, tz: 0, wait: KS.r(0, 4), speed: KS.r(0.8, 1.4), h: 0, y: 0.15, t: 0 };
      ped.tx = ped.x; ped.tz = ped.z;
      scene.add(p.root); Peds.list.push(ped);
    }
    // people sitting on temple steps, sadhus at the ghats
    for (const s of KS.sitSpots) {
      const kind = s[3] || KS.pick(['man', 'elder', 'woman', 'tourist', 'man']), p = KS.makePerson(kind);
      const ped = { p, kind, mode: 'sit', x: s[0], z: s[1], y: s[2], h: Math.PI + KS.r(-0.4, 0.4), t: 0 };
      if (kind === 'sadhu') ped.h = Math.PI;
      KS.animSit(p); scene.add(p.root); Peds.list.push(ped);
    }
    // traffic police on their platforms at busy junctions
    Peds.police = [];
    for (const [i, j] of [[6, 5], [5, 3], [6, 8], [4, 5], [8, 6], [10, 4], [3, 7]]) {
      const x = G.line(i), z = G.line(j), p = KS.makePerson('police');
      const b = new KS.Builder(); b.cyl(x, 0, z, 1.1, 0.5, 0xe8e2d4, 12); b.cyl(x, 0.5, z, 0.06, 2.6, 0x777777, 4); b.cyl(x, 3.1, z, 1.5, 0.5, 0xd12b2b, 10, 0.05);
      scene.add(KS.mesh(b)); KS.addCircle(x, z, 1.1, 0.5);
      const ped = { p, kind: 'police', mode: 'police', x: x + 0.3, z, y: 0.5, h: 0, t: KS.r(0, 6) };
      scene.add(p.root); Peds.list.push(ped); Peds.police.push(ped);
    }
    // football at Tundikhel
    if (KS.football) {
      const ball = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff }));
      ball.position.set(KS.football.x, 0.36, KS.football.z); scene.add(ball);
      Peds.ball = { m: ball, vx: 0, vz: 0, x: KS.football.x, z: KS.football.z };
      for (let i = 0; i < 8; i++) {
        const p = KS.makePerson('kid');
        const ped = { p, kind: 'kid', mode: 'football', x: KS.football.x + KS.r(-10, 10), z: KS.football.z + KS.r(-10, 10), h: 0, y: 0.15, speed: KS.r(2.2, 3.2), t: 0, home: [KS.football.x + KS.r(-14, 14), KS.football.z + KS.r(-12, 12)] };
        scene.add(p.root); Peds.list.push(ped);
      }
    }
  };

  const tmp = { x: 0, z: 0, h: 0 };
  Peds.update = (dt, ctx) => {
    const { px, pz, cx, cz, time } = ctx;
    const ball = Peds.ball;
    if (ball) {
      ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.vx *= 0.985; ball.vz *= 0.985;
      const fx = KS.football.x, fz = KS.football.z;
      if (Math.abs(ball.x - fx) > 26) { ball.vx = -ball.vx; ball.x = fx + Math.sign(ball.x - fx) * 26; }
      if (Math.abs(ball.z - fz) > 22) { ball.vz = -ball.vz; ball.z = fz + Math.sign(ball.z - fz) * 22; }
      ball.m.position.set(ball.x, 0.36, ball.z); ball.m.rotation.x += ball.vz * dt * 3; ball.m.rotation.z -= ball.vx * dt * 3;
    }
    let chaser = null, best = 1e9;
    for (const ped of Peds.list) {
      const dxp = ped.x - cx, dzp = ped.z - cz, d2 = dxp * dxp + dzp * dzp;
      if (ped.ambient && (ped.x - px) ** 2 + (ped.z - pz) ** 2 > 270 * 270) { placeAmbient(ped, px, pz, 140, 240); }
      const vis = d2 < 210 * 210;
      ped.p.root.visible = vis;
      if (!vis && !ped.ambient) continue;
      let moving = 0;
      if (ped.flee > 0) { // knocked aside / dodging a vehicle
        ped.flee -= dt; ped.x += ped.fvx * dt; ped.z += ped.fvz * dt; ped.fvx *= 0.9; ped.fvz *= 0.9; moving = 3;
        const c = KS.collide(ped.x, ped.z, 0.35, ped.y, 1.3); ped.x = c.x; ped.z = c.z;
        if (ped.flee <= 0 && ped.mode === 'walk') { const o = perimPos(ped, tmp); ped.x = o.x; ped.z = o.z; }
      } else switch (ped.mode) {
        case 'walk': {
          if (ped.wait > 0) { ped.wait -= dt; break; }
          const R = ped.rect, w = R.x1 - R.x0, d = R.z1 - R.z0, L = 2 * (w + d);
          const s0 = ped.s; ped.s += ped.dir * ped.speed * dt; moving = ped.speed;
          // reaching a corner: maybe cross the road
          for (let k = 0; k < 4; k++) {
            const cs = cornerS(R, k), a = ((s0 - cs) % L + L) % L, b = ((ped.s - cs) % L + L) % L;
            const passed = ped.dir > 0 ? (a > L - 2 && b < 2) : (a < 2 && b > L - 2);
            if (passed && KS.chance(0.35)) {
              const opt = KS.pick(CROSS[k]), nc = ped.c + opt[0], nr = ped.r + opt[1];
              if (walkable(nc, nr)) {
                const nR = rectOf(nc, nr), o = perimPos(ped, tmp);
                ped.mode = 'cross'; ped.fromX = o.x; ped.fromZ = o.z;
                ped.c = nc; ped.r = nr; ped.rect = nR; ped.s = cornerS(nR, opt[2]);
                const o2 = perimPos(ped, tmp); ped.toX = o2.x; ped.toZ = o2.z; ped.ct = 0;
                ped.cLen = Math.hypot(ped.toX - ped.fromX, ped.toZ - ped.fromZ);
                if (ped.cLen > 40) { ped.mode = 'walk'; }
              }
              break;
            }
          }
          if (ped.mode === 'walk') { const o = perimPos(ped, tmp); ped.x = o.x; ped.z = o.z; ped.h = KS.angLerp(ped.h, o.h, Math.min(1, dt * 8)); }
          if (KS.chance(dt * 0.02)) ped.wait = KS.r(1, 5);
          break;
        }
        case 'cross': {
          // wait at the kerb if a vehicle is close
          if (ped.ct < 0.05 && KS.Traffic && KS.Traffic.nearCount(ped.x, ped.z, 13) > 0) { ped.h = Math.atan2(ped.toX - ped.fromX, ped.toZ - ped.fromZ); break; }
          ped.ct += (ped.speed * 1.15 * dt) / Math.max(1, ped.cLen); moving = ped.speed * 1.2;
          const t = Math.min(1, ped.ct);
          ped.x = ped.fromX + (ped.toX - ped.fromX) * t; ped.z = ped.fromZ + (ped.toZ - ped.fromZ) * t;
          ped.h = Math.atan2(ped.toX - ped.fromX, ped.toZ - ped.fromZ);
          if (t >= 1) { ped.mode = 'walk'; ped.dir = KS.chance(0.5) ? 1 : -1; }
          break;
        }
        case 'kora': {
          const k = ped.k; ped.a += (ped.speed / ped.rr) * dt; moving = ped.speed; // clockwise on the map (east -> south -> west)
          ped.x = k.x + Math.cos(ped.a) * ped.rr; ped.z = k.z + Math.sin(ped.a) * ped.rr;
          ped.h = Math.atan2(-Math.sin(ped.a), Math.cos(ped.a));
          if (ped.kind === 'monk' || ped.kind === 'elder') { ped.p.armR.rotation.x = -0.9; }
          break;
        }
        case 'plaza': {
          const z = ped.zone;
          if (ped.wait > 0) { ped.wait -= dt; break; }
          const dx = ped.tx - ped.x, dz = ped.tz - ped.z, d = Math.hypot(dx, dz);
          if (d < 0.5) { ped.tx = KS.r(z.x0, z.x1); ped.tz = KS.r(z.z0, z.z1); ped.wait = KS.r(0.5, 6); break; }
          const sp = ped.speed; ped.x += (dx / d) * sp * dt; ped.z += (dz / d) * sp * dt; moving = sp;
          const c = KS.collide(ped.x, ped.z, 0.35, ped.y, 1.0); if (c.hit) { ped.tx = KS.r(z.x0, z.x1); ped.tz = KS.r(z.z0, z.z1); } ped.x = c.x; ped.z = c.z;
          ped.h = KS.angLerp(ped.h, Math.atan2(dx, dz), Math.min(1, dt * 6));
          break;
        }
        case 'football': {
          const b = Peds.ball, dx = b.x - ped.x, dz = b.z - ped.z, d = Math.hypot(dx, dz);
          if (d < best) { best = d; chaser = ped; }
          const tx = ped === Peds.lastChaser ? b.x : ped.home[0], tz = ped === Peds.lastChaser ? b.z : ped.home[1];
          const ex = tx - ped.x, ez = tz - ped.z, e = Math.hypot(ex, ez);
          if (e > 0.6) { const sp = ped === Peds.lastChaser ? ped.speed : 1; ped.x += (ex / e) * sp * dt; ped.z += (ez / e) * sp * dt; moving = sp; ped.h = Math.atan2(ex, ez); }
          if (d < 0.7 && Math.hypot(b.vx, b.vz) < 4) { const a = KS.r(0, Math.PI * 2), f = KS.r(6, 12); b.vx = Math.cos(a) * f; b.vz = Math.sin(a) * f; if (KS.chance(0.1)) KS.say(ped.p.root, KS.pick(LINES.kid), 1.5); }
          break;
        }
        case 'police': {
          ped.t += dt; ped.h = Math.floor(ped.t / 6) * (Math.PI / 2);
          ped.p.armR.rotation.z = -1.4 + Math.sin(ped.t * 5) * 0.4; ped.p.armL.rotation.x = Math.sin(ped.t * 2.5) * 0.9 - 0.4;
          break;
        }
      }
      const pr = ped.p.root;
      const gy = ped.mode === 'walk' || ped.mode === 'cross' ? (ped.mode === 'walk' ? 0.22 : 0.06) : ped.y;
      pr.position.set(ped.x, gy, ped.z); pr.rotation.y = ped.h;
      if (ped.mode !== 'sit' && ped.mode !== 'police') KS.animWalk(ped.p, dt, moving);
      // random chatter close to the player
      if (d2 < 100 && KS.chance(dt * 0.12)) {
        const set = ped.kind === 'tourist' ? LINES.tourist : ped.kind === 'monk' ? LINES.monk : ped.kind === 'sadhu' ? LINES.sadhu : ped.kind === 'police' ? LINES.police : ped.kind === 'porter' ? LINES.vendor : LINES.greet;
        KS.say(pr, KS.pick(set), 2.4);
      }
    }
    if (chaser) Peds.lastChaser = chaser;
  };
  /** knock pedestrians out of the way of a moving vehicle / running player. returns number hit hard */
  Peds.bump = (x, z, r, vx, vz, speed) => {
    let hits = 0;
    for (const ped of Peds.list) {
      if (ped.mode === 'sit' || ped.mode === 'police' || !ped.p.root.visible) continue;
      const dx = ped.x - x, dz = ped.z - z, d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      const d = Math.sqrt(d2) || 1;
      if (!(ped.flee > 0)) {
        ped.flee = 0.9; const k = Math.max(3, speed * 0.6);
        ped.fvx = (dx / d) * k + vx * 0.3; ped.fvz = (dz / d) * k + vz * 0.3;
        if (speed > 4) { hits++; KS.say(ped.p.root, KS.pick(LINES.angry), 2.2, 'angry'); }
      }
    }
    return hits;
  };
  /** obstacles for traffic (pedestrians crossing / walking on road) */
  Peds.forEachNear = (x, z, r, fn) => {
    for (const ped of Peds.list) { if (!ped.p.root.visible) continue; const dx = ped.x - x, dz = ped.z - z; if (dx * dx + dz * dz < r * r) fn(ped); }
  };

  /* ---------------- animals ---------------- */
  const Animals = (KS.Animals = { cows: [], dogs: [], monkeys: [] });
  function makeCow() {
    const b = new KS.Builder(), c = KS.pick([0xf2ede4, 0xe8e0d0, 0x8a6a4a, 0x3a3028, 0xd8c8b0]);
    b.box(0, 0.75, 0, 0.7, 0.75, 1.7, c); b.box(0, 1.42, -0.45, 0.4, 0.22, 0.4, c); // hump
    b.box(0, 1.15, 0.95, 0.34, 0.36, 0.5, c); b.box(0, 1.08, 1.22, 0.26, 0.2, 0.12, 0xd8a8a0);
    b.box(-0.18, 1.42, 0.92, 0.05, 0.25, 0.05, 0xd8d0c0, 0, 0, 0.4); b.box(0.18, 1.42, 0.92, 0.05, 0.25, 0.05, 0xd8d0c0, 0, 0, -0.4);
    b.box(0, 1.0, -0.88, 0.05, 0.55, 0.05, c, 0, 0.25);
    if (KS.chance(0.5)) b.box(0, 1.05, 0.95, 0.38, 0.06, 0.05, 0xf2a516); // marigold garland
    const legs = new KS.Builder();
    for (const [x, z] of [[-0.25, 0.6], [0.25, 0.6], [-0.25, -0.6], [0.25, -0.6]]) legs.box(x, 0, z, 0.14, 0.78, 0.14, c);
    const g = new T.Group(), body = new T.Mesh(b.build(), KS.M.vc), lg = new T.Mesh(legs.build(), KS.M.vc);
    body.castShadow = true; g.add(body); g.add(lg);
    return { g, body, legs: lg };
  }
  function makeDog() {
    const b = new KS.Builder(), c = KS.pick([0xb8875a, 0x3a2a1a, 0xd8c0a0, 0x6a4a2a, 0x222222]);
    b.box(0, 0.38, 0, 0.26, 0.26, 0.7, c); b.box(0, 0.55, 0.42, 0.2, 0.2, 0.26, c); b.box(0, 0.5, 0.6, 0.12, 0.1, 0.12, 0x222222);
    b.box(-0.07, 0.68, 0.38, 0.05, 0.1, 0.04, c); b.box(0.07, 0.68, 0.38, 0.05, 0.1, 0.04, c); b.box(0, 0.5, -0.4, 0.05, 0.05, 0.3, c, 0, 0.6);
    for (const [x, z] of [[-0.09, 0.25], [0.09, 0.25], [-0.09, -0.25], [0.09, -0.25]]) b.box(x, 0, z, 0.07, 0.38, 0.07, c);
    const m = new T.Mesh(b.build(), KS.M.vc); m.castShadow = true; const g = new T.Group(); g.add(m); return { g, m };
  }
  function makeMonkey() {
    const b = new KS.Builder(), c = 0x8a6a4a;
    b.box(0, 0.25, 0, 0.22, 0.3, 0.4, c); b.box(0, 0.5, 0.22, 0.18, 0.18, 0.16, c); b.box(0, 0.48, 0.31, 0.12, 0.1, 0.02, 0xd8a890);
    for (const [x, z] of [[-0.08, 0.14], [0.08, 0.14], [-0.08, -0.14], [0.08, -0.14]]) b.box(x, 0, z, 0.06, 0.26, 0.06, c);
    b.box(0, 0.4, -0.35, 0.04, 0.04, 0.4, c, 0, -0.8);
    const m = new T.Mesh(b.build(), KS.M.vc); const g = new T.Group(); g.add(m); return { g };
  }
  Animals.init = (scene) => {
    // sacred cows resting on or strolling along roads
    for (let i = 0; i < 18; i++) {
      const cow = makeCow(), vertical = KS.chance(0.5), li = KS.ri(1, G.N - 1), along = KS.r(-500, 500);
      const off = KS.r(-4, 4);
      const x = vertical ? G.line(li) + off : along, z = vertical ? along : G.line(li) + off;
      if (Math.abs(((along - G.O) % G.B) - 45) > 30) { i--; continue; } // keep away from junctions
      const { c, r } = G.blockOf(x, z); if (KS.blockType(c, r) === 'river') { i--; continue; }
      const lying = KS.chance(0.45);
      cow.x = x; cow.z = z; cow.h = vertical ? (KS.chance(0.5) ? 0 : Math.PI) : (KS.chance(0.5) ? Math.PI / 2 : -Math.PI / 2) + KS.r(-0.4, 0.4);
      cow.lying = lying; cow.vertical = vertical; cow.line = G.line(li); cow.t = KS.r(0, 10);
      if (lying) { cow.legs.visible = false; cow.body.position.y = -0.62; }
      cow.g.position.set(x, 0.05, z); cow.g.rotation.y = cow.h; scene.add(cow.g); Animals.cows.push(cow);
    }
    // street dogs on the sidewalks
    for (let i = 0; i < 26; i++) {
      const d = makeDog(); const c = KS.ri(1, 10), r = KS.ri(0, 10);
      if (KS.blockType(c, r) === 'river') { i--; continue; }
      const R = KS.World.blockRect(c, r);
      d.x = KS.chance(0.5) ? R.x0 + 2 : R.x1 - 2; d.z = KS.r(R.z0 + 3, R.z1 - 3); d.h = KS.r(0, 6); d.home = [d.x, d.z];
      d.sleep = KS.chance(0.6); d.chase = 0; d.bark = 0; d.t = 0;
      d.g.position.set(d.x, 0.22, d.z); d.g.rotation.y = d.h; if (d.sleep) { d.m.rotation.z = 1.4; d.m.position.y = 0.12; }
      scene.add(d.g); Animals.dogs.push(d);
    }
    // monkeys at Swayambhu and Pashupati
    for (const [x, z, r, y] of KS.monkeySpots) for (let i = 0; i < 9; i++) {
      const m = makeMonkey(); m.cx = x; m.cz = z; m.r = r; m.y = y; m.x = x + KS.r(-r, r); m.z = z + KS.r(-r, r); m.tx = m.x; m.tz = m.z; m.hop = 0; m.wait = KS.r(0, 3);
      scene.add(m.g); Animals.monkeys.push(m);
    }
    // pigeon flocks (one instanced mesh)
    const pg = new KS.Builder(); pg.box(0, 0.1, 0, 0.14, 0.13, 0.26, 0x8f96a0); pg.box(0, 0.2, 0.12, 0.09, 0.09, 0.09, 0x6f7a88); pg.box(0, 0.2, 0.17, 0.03, 0.02, 0.05, 0xd8a040);
    const total = KS.pigeonSpots.reduce((a, s) => a + s[2], 0);
    Animals.pigeonMesh = new T.InstancedMesh(pg.build(), KS.M.vc, total); Animals.pigeonMesh.frustumCulled = false; scene.add(Animals.pigeonMesh);
    Animals.pigeons = [];
    for (const [x, z, n] of KS.pigeonSpots) for (let i = 0; i < n; i++) Animals.pigeons.push({ cx: x, cz: z, x: x + KS.r(-7, 7), z: z + KS.r(-7, 7), y: 0.15, h: KS.r(0, 6), fly: 0, vy: 0, a: KS.r(0, 6), t: KS.r(0, 5) });
  };
  const dm = new T.Object3D();
  Animals.update = (dt, ctx) => {
    const { px, pz, playerSpeed, honk, inVehicle, vehicleKind, time } = ctx;
    for (const cow of Animals.cows) {
      cow.t += dt;
      const d = Math.hypot(cow.x - px, cow.z - pz);
      if (honk && d < 16 && !cow.moving) { cow.moving = 3; KS.audio && KS.audio.moo(); KS.say(cow.g, 'Mooo…', 1.8); if (cow.lying) { cow.lying = false; cow.legs.visible = true; cow.body.position.y = 0; } }
      if (cow.moving > 0) { // amble to the roadside
        cow.moving -= dt; const side = cow.vertical ? Math.sign(cow.x - cow.line || 1) : Math.sign(cow.z - cow.line || 1);
        if (cow.vertical) cow.x += side * dt * 0.9; else cow.z += side * dt * 0.9;
        const lim = cow.line + side * 6.2; if (cow.vertical) cow.x = side > 0 ? Math.min(cow.x, lim) : Math.max(cow.x, lim); else cow.z = side > 0 ? Math.min(cow.z, lim) : Math.max(cow.z, lim);
        cow.legs.rotation.x = Math.sin(cow.t * 6) * 0.05;
      }
      cow.g.position.set(cow.x, 0.05, cow.z);
      cow.body.rotation.z = Math.sin(cow.t * 0.7) * 0.02;
    }
    for (const d of Animals.dogs) {
      d.t += dt;
      const dist = Math.hypot(d.x - px, d.z - pz);
      if (inVehicle && vehicleKind === 'bike' && playerSpeed > 6 && dist < 9 && d.chase <= 0 && KS.chance(0.5)) { d.chase = 4; d.sleep = false; d.m.rotation.z = 0; d.m.position.y = 0; }
      if (d.chase > 0) {
        d.chase -= dt; const dx = px - d.x, dz = pz - d.z, e = Math.hypot(dx, dz) || 1, sp = Math.min(playerSpeed + 1, 9);
        if (e > 2.2) { d.x += (dx / e) * sp * dt; d.z += (dz / e) * sp * dt; }
        d.h = Math.atan2(dx, dz); d.m.position.y = Math.abs(Math.sin(d.t * 14)) * 0.12;
        d.bark -= dt; if (d.bark <= 0) { d.bark = 0.6; KS.audio && KS.audio.bark(Math.max(0.1, 1 - e / 40)); KS.say(d.g, 'Bhau! Bhau!', 0.6); }
      } else if (!d.sleep) {
        const hx = d.home[0] - d.x, hz = d.home[1] - d.z, e = Math.hypot(hx, hz);
        if (e > 1) { d.x += (hx / e) * 1.6 * dt; d.z += (hz / e) * 1.6 * dt; d.h = Math.atan2(hx, hz); d.m.position.y = Math.abs(Math.sin(d.t * 8)) * 0.05; }
        else if (KS.chance(dt * 0.05)) { d.sleep = true; d.m.rotation.z = 1.4; d.m.position.y = 0.12; }
      }
      // night barking
      if (ctx.night > 0.6 && dist < 40 && KS.chance(dt * 0.04)) KS.audio && KS.audio.bark(0.3);
      d.g.position.set(d.x, 0.22, d.z); d.g.rotation.y = d.h;
    }
    for (const m of Animals.monkeys) {
      const vis = Math.hypot(m.x - px, m.z - pz) < 150; m.g.visible = vis; if (!vis) continue;
      if (m.wait > 0) { m.wait -= dt; }
      else {
        const dx = m.tx - m.x, dz = m.tz - m.z, e = Math.hypot(dx, dz);
        if (e < 0.3) { m.tx = m.cx + KS.r(-m.r, m.r); m.tz = m.cz + KS.r(-m.r, m.r); m.wait = KS.r(0.3, 3); }
        else { m.x += (dx / e) * 3 * dt; m.z += (dz / e) * 3 * dt; m.hop += dt * 12; m.g.rotation.y = Math.atan2(dx, dz); }
      }
      const gy = m.y != null ? m.y : KS.groundAt(m.x, m.z, 100, 200);
      m.g.position.set(m.x, gy + Math.abs(Math.sin(m.hop)) * 0.35, m.z);
    }
    // pigeons: peck, and burst into the air when someone runs through
    const pm = Animals.pigeonMesh; let i = 0;
    for (const b of Animals.pigeons) {
      b.t += dt;
      const dist = Math.hypot(b.x - px, b.z - pz);
      if (b.fly <= 0 && dist < (playerSpeed > 3 ? 7 : 3)) { b.fly = KS.r(5, 9); b.vy = KS.r(4, 7); b.a = Math.atan2(b.z - b.cz, b.x - b.cx); if (i % 9 === 0) KS.audio && KS.audio.flap(); }
      if (b.fly > 0) {
        b.fly -= dt; b.a += dt * 0.8;
        const tr = 9 + (b.h % 1) * 6, ty = 8 + (b.t % 3);
        b.x += (b.cx + Math.cos(b.a) * tr - b.x) * dt * 1.5; b.z += (b.cz + Math.sin(b.a) * tr - b.z) * dt * 1.5;
        b.y += ((b.fly > 1.5 ? ty : 0.15) - b.y) * dt * 1.6; b.h = b.a + Math.PI;
      } else { b.y = 0.15; if (KS.chance(dt * 0.3)) { b.x += KS.r(-0.3, 0.3); b.z += KS.r(-0.3, 0.3); b.h = KS.r(0, 6); } }
      dm.position.set(b.x, b.y, b.z); dm.rotation.set(b.fly > 0 ? 0 : Math.max(0, Math.sin(b.t * 6)) * 0.5, b.h, b.fly > 0 ? Math.sin(b.t * 30) * 0.4 : 0); dm.updateMatrix();
      pm.setMatrixAt(i++, dm.matrix);
    }
    pm.instanceMatrix.needsUpdate = true;
  };
  Animals.obstacles = (fn) => { for (const c of Animals.cows) fn(c.x, c.z, 1.6, c); };
})();
