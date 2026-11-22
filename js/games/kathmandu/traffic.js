/* Kathmandu Streets — vehicles and left-hand traffic AI: cars, taxis, micro buses, buses, Safa tempos, motorbikes, trucks, police jeeps. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const TR = (KS.Traffic = { list: [] });

  KS.VTYPES = {
    car: { name: 'Hatchback', len: 3.9, wid: 1.75, speed: 13, accel: 7, turn: 1.9, r: 1.7, seats: 'car' },
    taxi: { name: 'Taxi', len: 3.8, wid: 1.7, speed: 13, accel: 7, turn: 2.0, r: 1.7, seats: 'car' },
    micro: { name: 'Micro Bus', len: 4.9, wid: 1.9, speed: 12, accel: 5.5, turn: 1.6, r: 2.1, seats: 'van' },
    bus: { name: 'City Bus', len: 10.4, wid: 2.5, speed: 10, accel: 3.6, turn: 1.0, r: 3.2, seats: 'bus' },
    tempo: { name: 'Safa Tempo', len: 3.7, wid: 1.6, speed: 8.5, accel: 4.5, turn: 2.0, r: 1.6, seats: 'van' },
    bike: { name: 'Motorbike', len: 1.9, wid: 0.75, speed: 16, accel: 10, turn: 2.6, r: 0.8, seats: 'bike' },
    scooter: { name: 'Scooter', len: 1.75, wid: 0.7, speed: 13, accel: 9, turn: 2.7, r: 0.8, seats: 'bike' },
    truck: { name: 'Painted Truck', len: 8, wid: 2.4, speed: 9, accel: 3.2, turn: 1.1, r: 2.8, seats: 'bus' },
    police: { name: 'Police Jeep', len: 4.3, wid: 1.9, speed: 15, accel: 8, turn: 1.8, r: 1.9, seats: 'car' },
  };
  const MIX = ['bike', 'bike', 'bike', 'bike', 'scooter', 'scooter', 'bike', 'car', 'car', 'car', 'taxi', 'taxi', 'micro', 'micro', 'tempo', 'tempo', 'bus', 'truck', 'police', 'car', 'bike', 'scooter'];

  /* ---------- small textures ---------- */
  const NP_DIG = '०१२३४५६७८९';
  const npNum = (n) => String(n).split('').map((d) => NP_DIG[+d]).join('');
  const plateMats = { red: [], black: [] };
  function plateMat(kind) {
    const arr = plateMats[kind];
    if (arr.length < 6) {
      const t = KS.tex(128, 48, (g, w, h) => {
        g.fillStyle = kind === 'red' ? '#c41a1a' : '#111'; g.fillRect(0, 0, w, h);
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
        g.fillStyle = '#fff'; g.font = `700 22px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(`बा ${npNum(KS.ri(1, 9))} ${KS.pick(['च', 'प', 'ख', 'क', 'झ'])} ${npNum(KS.ri(1000, 9999))}`, w / 2, h / 2 + 2);
      });
      arr.push(new T.MeshBasicMaterial({ map: t }));
    }
    return KS.pick(arr);
  }
  const ROUTES = ['रत्नपार्क - कलंकी', 'लगनखेल - रत्नपार्क', 'कोटेश्वर - बालाजु', 'गोंगबु - सातदोबाटो', 'चाबहिल - कीर्तिपुर', 'बौद्ध - रत्नपार्क', 'नयाँ बसपार्क - भक्तपुर'];
  const routeMats = [];
  function routeMat() {
    if (routeMats.length < ROUTES.length) {
      const txt = ROUTES[routeMats.length];
      const t = KS.tex(256, 48, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb02e'; g.font = `700 28px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); });
      routeMats.push(new T.MeshBasicMaterial({ map: t }));
    }
    return KS.pick(routeMats);
  }
  let truckMat;
  function truckBack() {
    if (!truckMat) {
      const t = KS.tex(256, 160, (g, w, h) => {
        g.fillStyle = '#f2a516'; g.fillRect(0, 0, w, h);
        for (let i = 0; i < 8; i++) { g.fillStyle = ['#c81e1e', '#1d4fb8', '#1f9a4c', '#7b1fa2'][i % 4]; g.fillRect(0, i * 6, w, 3); }
        g.fillStyle = '#fff'; g.beginPath(); for (let x = 0; x < w; x += 20) { g.moveTo(x, 150); g.lineTo(x + 10, 135); g.lineTo(x + 20, 150); } g.fill();
        g.fillStyle = '#b3121b'; g.font = '900 34px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('HORN PLEASE', w / 2, 92);
        g.fillStyle = '#1d3a8a'; g.font = `700 22px ${KS.FONT}`; g.fillText('फेरि भेटौँला', w / 2, 122);
        g.fillStyle = '#111'; g.font = '700 16px sans-serif'; g.fillText('USE DIPPER AT NIGHT', w / 2, 58);
      });
      truckMat = new T.MeshLambertMaterial({ map: t });
    }
    return truckMat;
  }
  const headMat = new T.MeshBasicMaterial({ color: 0xe8e6da });
  const tailMat = new T.MeshBasicMaterial({ color: 0x8a1010 });
  KS.headMat = headMat; KS.tailMat = tailMat;

  /* ---------- vehicle builders (forward = +z) ---------- */
  function wheelSet(b, halfW, zs, r, w) { for (const z of zs) { b.cyl(halfW + w, r, z, r, w, 0x141414, 10, 1, 0, 0, Math.PI / 2); b.cyl(-halfW, r, z, r, w, 0x141414, 10, 1, 0, 0, Math.PI / 2); b.cyl(halfW + w * 0.5, r, z, r * 0.5, w * 0.2, 0xaaaaaa, 8, 1, 0, 0, Math.PI / 2); } }
  function rider(b, y, z, o = {}) {
    const shirt = o.shirt || KS.pick([0xd12b2b, 0x1d4fb8, 0x333333, 0x2a2f45, 0x6b6b5a, 0xf2c418, 0x1f9a4c]);
    const skin = KS.pick([0xc68d5f, 0xb07a4f, 0xd8a47a]);
    b.box(-0.16, y, z + 0.15, 0.15, 0.18, 0.55, 0x2a2f45); b.box(0.16, y, z + 0.15, 0.15, 0.18, 0.55, 0x2a2f45); // thighs
    b.box(-0.17, y - 0.45, z + 0.42, 0.13, 0.5, 0.14, 0x2a2f45); b.box(0.17, y - 0.45, z + 0.42, 0.13, 0.5, 0.14, 0x2a2f45);
    b.box(0, y + 0.1, z - 0.05, 0.42, 0.6, 0.26, shirt, 0, 0.2);
    b.box(-0.24, y + 0.38, z + 0.3, 0.1, 0.1, 0.55, shirt, 0, -0.5); b.box(0.24, y + 0.38, z + 0.3, 0.1, 0.1, 0.55, shirt, 0, -0.5);
    b.box(0, y + 0.72, z + 0.02, 0.2, 0.08, 0.2, skin);
    if (o.helmet !== false) b.sphere(0, y + 0.86, z + 0.02, 0.17, KS.pick([0xf4f4f4, 0x111111, 0xc81e1e, 0x1d4fb8, 0xf2c418]), 1.05, 8);
    else b.box(0, y + 0.8, z + 0.02, 0.22, 0.22, 0.22, skin);
    if (o.mask) b.box(0, y + 0.74, z + 0.13, 0.16, 0.08, 0.02, 0x5aa0d8); // dust mask
  }
  function build(type) {
    const t = KS.VTYPES[type], b = new KS.Builder(), lights = new KS.Builder(), tails = new KS.Builder(), riderB = new KS.Builder();
    let plateKind = 'red', route = false, color;
    const L = t.len, Wd = t.wid;
    switch (type) {
      case 'car': case 'taxi': case 'police': {
        color = type === 'taxi' ? 0xf2f2ee : type === 'police' ? 0x1e3a78 : KS.pick([0xc81e1e, 0xd8d8d8, 0x2a2a2a, 0x1d4fb8, 0x8a8a90, 0xf2f2ee, 0x7a1414, 0x2f6b3a]);
        const H = type === 'police' ? 0.95 : 0.65;
        b.box(0, 0.32, 0, Wd, H, L, color);
        b.box(0, 0.32 + H, -0.2, Wd - 0.12, 0.62, L * 0.55, 0x1e2a33);
        b.box(0, 0.32 + H + 0.6, -0.2, Wd - 0.16, 0.1, L * 0.55 - 0.1, color);
        for (const s of [-1, 1]) b.box(s * (Wd / 2 - 0.04), 0.32 + H, -0.2, 0.06, 0.62, 0.12, color);
        b.box(0, 0.25, L / 2, Wd, 0.25, 0.12, 0x222222); b.box(0, 0.25, -L / 2, Wd, 0.25, 0.12, 0x222222);
        if (type === 'taxi') { b.box(0, 1.6, -0.3, 0.7, 0.24, 0.35, 0xf2c418); plateKind = 'black'; b.box(0, 0.55, 0, Wd + 0.02, 0.1, L * 0.8, 0x111111); }
        if (type === 'police') { b.box(0, 0.75, 0, Wd + 0.02, 0.14, L * 0.98, 0xf4f4f4); lights.box(-0.3, 1.95, -0.3, 0.5, 0.16, 0.25, 0xffffff); b.box(-0.3, 1.95, -0.3, 0.5, 0.16, 0.25, 0xd12b2b); b.box(0.3, 1.95, -0.3, 0.5, 0.16, 0.25, 0x1d4fb8); }
        wheelSet(b, Wd / 2 - 0.12, [L * 0.32, -L * 0.32], 0.32, 0.24);
        lights.box(-Wd / 2 + 0.3, 0.6, L / 2 + 0.01, 0.35, 0.18, 0.05, 0xffffff); lights.box(Wd / 2 - 0.3, 0.6, L / 2 + 0.01, 0.35, 0.18, 0.05, 0xffffff);
        tails.box(-Wd / 2 + 0.25, 0.65, -L / 2 - 0.01, 0.3, 0.16, 0.05, 0xffffff); tails.box(Wd / 2 - 0.25, 0.65, -L / 2 - 0.01, 0.3, 0.16, 0.05, 0xffffff);
        break;
      }
      case 'micro': {
        color = 0xf4f4f0; const stripe = KS.pick([0x1d4fb8, 0x1f9a4c, 0xc81e1e, 0xf2a516]);
        b.box(0, 0.35, 0, Wd, 1.75, L, color); b.box(0, 1.25, 0.1, Wd + 0.02, 0.6, L - 1.2, 0x1e2a33); b.box(0, 1.3, L / 2 - 0.35, Wd - 0.2, 0.55, 0.62, 0x1e2a33);
        b.box(0, 0.75, 0, Wd + 0.03, 0.18, L, stripe); b.box(0, 2.1, -0.4, Wd - 0.3, 0.2, L * 0.55, 0x444444);
        wheelSet(b, Wd / 2 - 0.12, [L * 0.33, -L * 0.33], 0.34, 0.24);
        lights.box(-Wd / 2 + 0.3, 0.75, L / 2 + 0.01, 0.35, 0.2, 0.05, 0xffffff); lights.box(Wd / 2 - 0.3, 0.75, L / 2 + 0.01, 0.35, 0.2, 0.05, 0xffffff);
        tails.box(-Wd / 2 + 0.2, 0.9, -L / 2 - 0.01, 0.25, 0.3, 0.05, 0xffffff); tails.box(Wd / 2 - 0.2, 0.9, -L / 2 - 0.01, 0.25, 0.3, 0.05, 0xffffff);
        plateKind = 'black'; route = true; break;
      }
      case 'bus': case 'truck': {
        if (type === 'bus') {
          color = KS.pick([0x2f8a4a, 0xc81e1e, 0x1d4fb8, 0xf2a516, 0x6d1a8a]);
          b.box(0, 0.5, 0, Wd, 2.6, L, color); b.box(0, 1.7, 0, Wd + 0.02, 0.9, L - 0.8, 0x1e2a33); b.box(0, 1.7, L / 2 - 0.1, Wd - 0.2, 1.1, 0.24, 0x1e2a33);
          b.box(0, 0.9, 0, Wd + 0.03, 0.22, L, 0xf4f4f0); b.box(0, 1.25, 0, Wd + 0.03, 0.12, L, KS.pick([0xf2c418, 0xffffff, 0xc81e1e]));
          b.box(0, 3.1, 0, Wd - 0.2, 0.12, L * 0.7, 0x444444); for (let i = 0; i < 5; i++) b.box(KS.r(-0.6, 0.6), 3.22, KS.r(-L * 0.3, L * 0.3), KS.r(0.6, 1), KS.r(0.4, 0.8), KS.r(0.6, 1.2), KS.pick([0x1d4fb8, 0xc81e1e, 0x5a4a3a, 0x1f9a4c, 0xf2c418]));
          wheelSet(b, Wd / 2 - 0.14, [L * 0.33, -L * 0.33], 0.5, 0.32);
          plateKind = 'black'; route = true;
        } else {
          color = KS.pick([0xf2a516, 0xc81e1e, 0x1d4fb8, 0x1f9a4c]);
          b.box(0, 0.6, L / 2 - 1.2, Wd, 2.1, 2.3, color); b.box(0, 1.65, L / 2 - 0.02, Wd - 0.3, 0.8, 0.1, 0x1e2a33);
          b.box(0, 2.7, L / 2 - 1.1, Wd + 0.1, 0.5, 2.3, 0xf2c418); // decorated crown
          for (let i = 0; i < 5; i++) b.box(-Wd / 2 + 0.25 + i * (Wd - 0.5) / 4, 2.95, L / 2 - 0.05, 0.25, 0.25, 0.08, [0xc81e1e, 0x1d4fb8, 0x1f9a4c, 0xffffff, 0x7b1fa2][i]);
          b.box(0, 0.6, -1.2, Wd, 0.25, L - 2.4, 0x5a4a3a); b.box(0, 0.85, -1.2, Wd, 1.9, L - 2.6, KS.pick([0xc8a050, 0x8a3a2a, 0x2f6b3a]));
          for (let i = 0; i < 4; i++) b.box(0, 1.0 + i * 0.45, -1.2, Wd + 0.04, 0.08, L - 2.6, KS.pick([0xc81e1e, 0x1d4fb8, 0xf2c418, 0xffffff]));
          wheelSet(b, Wd / 2 - 0.14, [L * 0.36, -L * 0.15, -L * 0.36], 0.5, 0.32);
          plateKind = 'black';
        }
        lights.box(-Wd / 2 + 0.35, 0.95, L / 2 + 0.01, 0.4, 0.25, 0.05, 0xffffff); lights.box(Wd / 2 - 0.35, 0.95, L / 2 + 0.01, 0.4, 0.25, 0.05, 0xffffff);
        tails.box(-Wd / 2 + 0.25, 0.9, -L / 2 - 0.01, 0.3, 0.25, 0.05, 0xffffff); tails.box(Wd / 2 - 0.25, 0.9, -L / 2 - 0.01, 0.3, 0.25, 0.05, 0xffffff);
        break;
      }
      case 'tempo': {
        color = 0x2fa84f;
        b.box(0, 0.3, L / 2 - 0.7, Wd * 0.8, 1.4, 1.3, color); b.box(0, 1.1, L / 2 - 0.08, Wd * 0.7, 0.55, 0.1, 0x1e2a33);
        b.box(0, 0.3, -0.5, Wd, 1.75, L - 1.3, color); b.box(0, 1.25, -0.5, Wd + 0.02, 0.5, L - 1.6, 0x1e2a33);
        b.box(0, 2.05, -0.3, Wd + 0.1, 0.1, L - 0.8, 0xf4f4f4); b.box(0, 0.75, -0.5, Wd + 0.02, 0.15, L - 1.3, 0xf4f4f4);
        b.cyl(0.08, 0.28, L / 2 - 0.5, 0.28, 0.16, 0x141414, 10, 1, 0, 0, Math.PI / 2);
        wheelSet(b, Wd / 2 - 0.1, [-L * 0.3], 0.3, 0.2);
        lights.box(0, 1.25, L / 2 + 0.02, 0.3, 0.2, 0.05, 0xffffff);
        tails.box(-Wd / 2 + 0.15, 0.7, -L / 2 + 0.1, 0.2, 0.2, 0.05, 0xffffff); tails.box(Wd / 2 - 0.15, 0.7, -L / 2 + 0.1, 0.2, 0.2, 0.05, 0xffffff);
        plateKind = 'black'; break;
      }
      case 'bike': case 'scooter': {
        color = KS.pick([0xc81e1e, 0x111111, 0x1d4fb8, 0xdddddd, 0x2f7d32, 0xe0a400, 0x7b1fa2]);
        b.cyl(0.06, 0.34, 0.68, 0.33, 0.12, 0x141414, 10, 1, 0, 0, Math.PI / 2); b.cyl(0.06, 0.34, -0.66, 0.33, 0.12, 0x141414, 10, 1, 0, 0, Math.PI / 2);
        if (type === 'scooter') { b.box(0, 0.3, -0.2, 0.42, 0.5, 1.0, color); b.box(0, 0.3, 0.55, 0.36, 0.9, 0.2, color); b.box(0, 0.8, -0.25, 0.36, 0.12, 0.7, 0x222222); }
        else { b.box(0, 0.4, 0, 0.26, 0.38, 1.0, 0x333333); b.box(0, 0.75, 0.2, 0.36, 0.28, 0.55, color); b.box(0, 0.82, -0.35, 0.3, 0.12, 0.6, 0x111111); b.box(0, 0.25, -0.5, 0.12, 0.12, 0.6, 0x999999); }
        b.box(0, 1.08, 0.62, 0.75, 0.06, 0.06, 0x333333); b.box(0, 0.6, 0.66, 0.08, 0.55, 0.08, 0x777777, 0, 0.35);
        lights.box(0, 1.0, 0.78, 0.18, 0.14, 0.05, 0xffffff); tails.box(0, 0.85, -0.72, 0.16, 0.1, 0.04, 0xffffff);
        rider(riderB, 0.95, -0.3, { mask: KS.chance(0.35) });
        if (KS.chance(0.3)) { // pillion: sitting side-saddle
          const sc = KS.pick([0xc8102e, 0xe23a8a, 0xf2a516, 0x7b1fa2]);
          riderB.box(0.1, 0.95, -0.72, 0.42, 0.6, 0.26, sc); riderB.box(0.1, 1.62, -0.72, 0.2, 0.22, 0.2, 0xc68d5f); riderB.box(0.1, 1.75, -0.74, 0.22, 0.08, 0.22, 0x111111);
          riderB.box(0.35, 0.55, -0.72, 0.3, 0.42, 0.24, sc);
        }
        break;
      }
    }
    const root = new T.Group();
    const body = new T.Mesh(b.build(), KS.M.vc); body.castShadow = true; root.add(body);
    if (!lights.empty) root.add(new T.Mesh(lights.build(), headMat));
    if (!tails.empty) root.add(new T.Mesh(tails.build(), tailMat));
    let riderMesh = null;
    if (!riderB.empty) { riderMesh = new T.Mesh(riderB.build(), KS.M.vc); riderMesh.castShadow = true; root.add(riderMesh); }
    if (type !== 'bike' && type !== 'scooter') {
      const pl = new T.Mesh(new T.PlaneGeometry(0.62, 0.24), plateMat(plateKind)); pl.position.set(0, 0.45, -L / 2 - 0.03); pl.rotation.y = Math.PI; root.add(pl);
      if (route) { const rb = new T.Mesh(new T.PlaneGeometry(Wd * 0.8, 0.3), routeMat()); rb.position.set(0, type === 'bus' ? 2.85 : 1.95, L / 2 + 0.02); root.add(rb); }
      if (type === 'truck') { const tb = new T.Mesh(new T.PlaneGeometry(Wd, 1.7), truckBack()); tb.position.set(0, 1.75, -L / 2 + 0.08); tb.rotation.y = Math.PI; root.add(tb); }
    }
    return { root, body, rider: riderMesh, color };
  }
  KS.buildVehicle = build;

  /* ---------- road graph ---------- */
  const nodes = [], idx = (i, j) => i * (G.N + 1) + j;
  for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) nodes.push({ x: G.line(i), z: G.line(j), i, j, nb: [], ring: i === 0 || i === G.N || j === 0 || j === G.N });
  const blocked = (kind, line, from) => KS.noRoad.some((n) => n[0] === kind && n[1] === line && n[2] === from);
  function link(a, b) { nodes[a].nb.push(b); nodes[b].nb.push(a); }
  TR.initGraph = () => {
    for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) {
      if (i < G.N && !blocked('h', j, i)) link(idx(i, j), idx(i + 1, j));
      if (j < G.N && !blocked('v', i, j)) link(idx(i, j), idx(i, j + 1));
    }
    const sw = nodes.push({ x: KS.SWAYAMBHU.x + 38, z: KS.SWAYAMBHU.z, nb: [], spur: true, hill: true }) - 1; link(sw, idx(0, 5));
    const ap = nodes.push({ x: 614, z: 0, nb: [], spur: true }) - 1; link(ap, idx(12, 6));
    TR.nodes = nodes;
  };
  const margin = (n) => (n.spur ? 0 : n.ring ? 12.5 : 9.5);
  function laneOf(v, a, b, out) {
    const A = nodes[a], B = nodes[b];
    let dx = B.x - A.x, dz = B.z - A.z; const L = Math.hypot(dx, dz); dx /= L; dz /= L;
    const ring = (A.ring && B.ring) && (A.i === B.i || A.j === B.j) && !A.spur && !B.spur;
    const off = (ring ? (v.outer ? 7.2 : 3.4) : 3.5) + v.lat;
    const lx = dz, lz = -dx; // left of travel (Nepal drives on the left)
    out.sx = A.x + dx * margin(A) + lx * off; out.sz = A.z + dz * margin(A) + lz * off;
    out.ex = B.x - dx * margin(B) + lx * off; out.ez = B.z - dz * margin(B) + lz * off;
    out.dx = dx; out.dz = dz; out.len = Math.hypot(out.ex - out.sx, out.ez - out.sz);
    out.hill = A.hill || B.hill;
    return out;
  }

  /* ---------- vehicles ---------- */
  function placeOnRandomEdge(v, px, pz, minD, maxD) {
    for (let tries = 0; tries < 40; tries++) {
      const a = Math.floor(KS.rng() * (G.N + 1) * (G.N + 1)), n = nodes[a];
      const d = Math.hypot(n.x - px, n.z - pz); if (d < minD || d > maxD) continue;
      const b = KS.pick(n.nb); if (b == null) continue;
      v.a = a; v.b = b; v.mode = 'lane'; laneOf(v, a, b, v.lane); v.t = KS.r(0, v.lane.len); v.speed = (v.maxSpeed || v.type.speed) * 0.6;
      return true;
    }
    return false;
  }
  TR.spawn = (type, px, pz, minD = 20, maxD = 260) => {
    const vt = KS.VTYPES[type], vis = build(type);
    const v = { kind: type, type: vt, ...vis, lane: {}, ai: true, speed: 0, t: 0, x: 0, z: 0, y: 0.06, h: 0, stuck: 0, ignore: 0, honkT: KS.r(2, 12), lat: 0, outer: KS.chance(0.4), maxSpeed: vt.speed * KS.r(0.8, 1.1) };
    if (type === 'bike' || type === 'scooter') v.lat = KS.r(-0.6, 1.4);
    placeOnRandomEdge(v, px, pz, minD, maxD);
    TR.list.push(v); TR.scene.add(v.root);
    return v;
  };
  TR.init = (scene, count, px, pz) => {
    TR.scene = scene; TR.initGraph();
    for (let i = 0; i < count; i++) TR.spawn(MIX[i % MIX.length], px, pz, 10, 300);
  };
  /** a parked vehicle the player can take */
  TR.park = (type, x, z, h) => {
    const vt = KS.VTYPES[type], vis = build(type);
    const v = { kind: type, type: vt, ...vis, lane: {}, ai: false, parked: true, speed: 0, x, z, y: 0.06, h, lat: 0, maxSpeed: vt.speed };
    if (v.rider) v.rider.visible = false;
    v.root.position.set(x, v.y, z); v.root.rotation.y = h; TR.list.push(v); TR.scene.add(v.root); return v;
  };
  function startTurn(v) {
    const B = nodes[v.b], from = v.a;
    let opts = B.nb.filter((n) => n !== from);
    if (!opts.length) opts = [from];
    // prefer going straight a bit more often; bikes wander
    const straight = opts.find((n) => { const N = nodes[n]; return Math.abs((N.x - B.x) * v.lane.dz - (N.z - B.z) * v.lane.dx) < 1; });
    let c = straight != null && KS.chance(0.45) ? straight : KS.pick(opts);
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
  const fwd = { x: 0, z: 0 };
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
    KS.Peds.forEachNear(v.x, v.z, look + 4, (p) => test(p.x, p.z, 0.5, 0.6, 'ped'));
    KS.Animals.obstacles((x, z, r) => test(x, z, 1.8, 1.2, 'cow'));
    return { d: best, who };
  }
  TR.update = (dt, ctx) => {
    const { px, pz, cx, cz, night } = ctx;
    for (const v of TR.list) {
      const dCam = Math.hypot(v.x - cx, v.z - cz);
      v.root.visible = dCam < 300 || v === ctx.playerVehicle;
      if (!v.ai) continue;
      // keep traffic around the player
      if (Math.hypot(v.x - px, v.z - pz) > 340 && !v.root.visible) { placeOnRandomEdge(v, px, pz, 130, 300); }
      let target = v.maxSpeed * (v.mode === 'turn' ? (v.type.len < 2 ? 0.8 : 0.5) : 1) * (v.lane.hill ? 0.6 : 1);
      if (ctx.rain) target *= 0.8;
      const ob = obstacleAhead(v, TR.list, ctx);
      if (ob.who && v.ignore <= 0) {
        const lim = Math.max(0, (ob.d - 1.5) * 1.3);
        if (lim < target) target = lim;
        if (v.speed < 0.6) {
          v.stuck += dt;
          if (v.stuck > 0.8 && v.honkT <= 0) { v.honkT = KS.r(1.5, 4); if (dCam < 90) KS.audio && KS.audio.horn(v.kind, Math.max(0.08, 1 - dCam / 90)); }
          if (v.stuck > (ob.who === 'player' || ob.who === 'ped' ? 9 : 4) && ob.who !== 'cow') { v.ignore = 1.6; v.stuck = 0; }
        }
      } else v.stuck = 0;
      if (v.ignore > 0) v.ignore -= dt;
      v.honkT -= dt;
      if (v.honkT < -8 && KS.chance(dt * 0.15)) { v.honkT = KS.r(4, 16); if (dCam < 70) KS.audio && KS.audio.horn(v.kind, Math.max(0.05, 0.6 - dCam / 120)); } // Kathmandu's habitual honk
      const acc = target > v.speed ? v.type.accel : 14;
      v.speed += KS.clamp(target - v.speed, -acc * dt, acc * dt);
      v.t += v.speed * dt;
      if (v.mode === 'lane') {
        const L = v.lane;
        if (v.t >= L.len) { v.t -= L.len; startTurn(v); }
        else { v.x = L.sx + L.dx * v.t; v.z = L.sz + L.dz * v.t; v.h = Math.atan2(L.dx, L.dz); }
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
        if (v.kind === 'bike' || v.kind === 'scooter') v.root.rotation.z = v.mode === 'turn' ? -0.18 : 0;
      }
    }
    // night: brighter lights
    headMat.color.setHex(night > 0.3 ? 0xfff8d8 : 0xd8d6cc); tailMat.color.setHex(night > 0.3 ? 0xff2a2a : 0x8a1010);
  };
  TR.recycle = (v, px, pz) => {
    v.ai = true; v.parked = false; v.vy = 0; if (v.rider) v.rider.visible = true;
    v.root.rotation.set(0, 0, 0, 'XYZ'); placeOnRandomEdge(v, px, pz, 150, 300);
  };
  TR.nearCount = (x, z, r) => { let n = 0; for (const v of TR.list) if (v.ai && v.speed > 1 && Math.abs(v.x - x) < r && Math.abs(v.z - z) < r) n++; return n; };
  TR.nearest = (x, z, r) => { let best = null, bd = r; for (const v of TR.list) { const d = Math.hypot(v.x - x, v.z - z) - v.type.len * 0.35; if (d < bd) { bd = d; best = v; } } return best; };
})();
