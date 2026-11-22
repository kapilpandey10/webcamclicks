/* Kathmandu Streets — Nagdhunga highway & tunnel, Dhunibesi village, Balaju, Shankha Park, hospital,
   traffic signals, zebra crossings, speed-limit signs and speed cameras. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G, P = KS.palette, HW = KS.HW;
  const X = (KS.Extras = {});
  KS.signals = []; KS.speedCams = []; KS.villageSpots = []; KS.goatSpots = [];

  function board(scene, text, sub, x, y, z, ry, w, h, bg = '#1b5e20', fg = '#ffffff') {
    const t = KS.tex(512, 160, (g, W, H) => {
      g.fillStyle = bg; g.fillRect(0, 0, W, H); g.strokeStyle = fg; g.lineWidth = 5; g.strokeRect(8, 8, W - 16, H - 16);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 54px ${KS.FONT}`; g.fillText(text, W / 2, sub ? 62 : H / 2 + 4);
      if (sub) { g.font = '700 34px "Barlow Condensed", sans-serif'; g.fillText(sub, W / 2, 118); }
    });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ map: t, side: T.DoubleSide }));
    m.position.set(x, y, z); m.rotation.y = ry; scene.add(m); return m;
  }

  /* ---------- Nagdhunga highway + tunnel ---------- */
  function highway(scene) {
    const b = new KS.Builder(), z = HW.z;
    for (let x = HW.x0 - 3; x > HW.x1; x -= 3) {
      const h0 = KS.roadH(x), h1 = KS.roadH(x - 3), lo = Math.min(h0, h1);
      b.box(x - 1.5, lo - 1.2, z, 3.05, 1.0, 14.2, 0x3a3a3c); // road bed
      const tun = x < HW.pE && x > HW.pW;
      if (!tun && Math.floor(x / 3) % 2 === 0) for (const s of [-1, 1]) { b.box(x, h0, z + s * 7.6, 0.15, 0.8, 0.15, 0x777777); b.box(x - 1.5, h0 + 0.6, z + s * 7.6, 3.05, 0.3, 0.08, 0xc8c8c8); }
    }
    // continuous asphalt surface following the grade
    const pos = [], idx = [];
    for (let x = HW.x0 + 2, i = 0; x >= HW.x1; x -= 3, i++) {
      const y = KS.roadH(x) + 0.05; pos.push(x, y, z - 7, x, y, z + 7);
      if (i) { const a = (i - 1) * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); rg.setIndex(idx); rg.computeVertexNormals();
    const uv = []; for (let i = 0; i < pos.length / 6; i++) uv.push(0, i * 3 / 32, 1, i * 3 / 32); rg.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
    const road = new T.Mesh(rg, KS.roadMats ? KS.roadMats[0] : new T.MeshLambertMaterial({ color: 0x48484b, side: T.DoubleSide }));
    road.material.side = T.DoubleSide; road.receiveShadow = true; scene.add(road);
    // tunnel shell
    const L = 20;
    for (let x = HW.pE; x > HW.pW; x -= L) {
      const mx = x - L / 2, y0 = KS.roadH(mx) - 0.6;
      b.box(mx, y0, z - 7.9, L + 0.2, 9, 0.8, 0x8b877e); b.box(mx, y0, z + 7.9, L + 0.2, 9, 0.8, 0x8b877e);
      b.box(mx, y0 + 0.6, z - 7.45, L + 0.2, 1.1, 0.1, 0xd2a32a); b.box(mx, y0 + 0.6, z + 7.45, L + 0.2, 1.1, 0.1, 0xd2a32a); // kerb stripe
      b.box(mx, y0 + 9, z, L + 0.2, 0.8, 16.6, 0x6e6b64);
      if (Math.round(x) % 120 === 0) { b.cyl(mx, y0 + 7.4, z - 2.5, 0.6, 2.2, 0x9a9a9a, 10, 1, 0, 0, Math.PI / 2); b.cyl(mx, y0 + 7.4, z + 2.5, 0.6, 2.2, 0x9a9a9a, 10, 1, 0, 0, Math.PI / 2); } // jet fans
      b.box(mx, y0 + 2.2, z - 7.44, 0.9, 0.5, 0.05, 0x1f9a4c); // emergency exit signs
    }
    KS.addBox((HW.pE + HW.pW) / 2, z - 8, HW.pE - HW.pW, 1, 500); KS.addBox((HW.pE + HW.pW) / 2, z + 8, HW.pE - HW.pW, 1, 500);
    const lampB = new KS.Builder();
    for (let x = HW.pE - 6; x > HW.pW; x -= 12) { const y = KS.roadH(x) + 8.25; lampB.box(x, y, z - 3, 3, 0.15, 0.4, 0xffffff); lampB.box(x, y, z + 3, 3, 0.15, 0.4, 0xffffff); }
    scene.add(new T.Mesh(lampB.build(), new T.MeshBasicMaterial({ color: 0xfff1c8 })));
    // portals
    for (const [px, dir] of [[HW.pE, 1], [HW.pW, -1]]) {
      const y = KS.roadH(px), fx = px - dir * 2;
      b.box(fx, y - 2, z - 12.2, 4, 24, 8.4, 0xb9b3a6); b.box(fx, y - 2, z + 12.2, 4, 24, 8.4, 0xb9b3a6);
      b.box(fx, y + 8.6, z, 4, 13.4, 16.1, 0xb9b3a6); b.box(fx + dir * 2.05, y + 8.2, z, 0.2, 0.6, 16.2, 0xd2a32a);
      for (let i = 0; i < 6; i++) b.box(fx + dir * 2.05, y - 1 + i * 3.6, z - 12.2, 0.12, 0.2, 8.4, 0x8f897c);
      KS.addBox(fx, z - 12.2, 4, 8.4, y + 30); KS.addBox(fx, z + 12.2, 4, 8.4, y + 30);
      board(scene, 'नागढुङ्गा सुरुङमार्ग', 'NAGDHUNGA TUNNEL', fx + dir * 2.15, y + 13.4, z, dir > 0 ? Math.PI / 2 : -Math.PI / 2, 11, 3.4);
    }
    // direction signs on the way out of Kalanki
    board(scene, 'नागढुङ्गा · धुनिबेसी', 'NAGDHUNGA · DHUNIBESI ←', -575, 6.2, z - 8.5, Math.PI / 2, 7, 2.2);
    b.box(-575, 0, z - 9.5, 0.25, 5.2, 0.25, 0x777777); b.box(-575, 0, z - 7.5, 0.25, 5.2, 0.25, 0x777777);
    board(scene, 'काठमाडौं', 'KATHMANDU →', -1660, KS.roadH(-1660) + 6.2, z + 8.5, -Math.PI / 2, 6, 2.2);
    b.box(-1660, KS.roadH(-1660), z + 9.5, 0.25, 5.2, 0.25, 0x777777); b.box(-1660, KS.roadH(-1660), z + 7.5, 0.25, 5.2, 0.25, 0x777777);
    scene.add(KS.mesh(b, KS.M.vc, false));
    KS.landmarks.push({ id: 'tunnel', name: 'Nagdhunga Tunnel', np: 'नागढुङ्गा सुरुङमार्ग', x: (HW.pE + HW.pW) / 2, z: HW.z, r: 40, stop: { x: HW.pE + 30, z: HW.z - 5 }, fact: 'Nepal\'s first road tunnel cuts under the Nagdhunga pass, the western gateway out of the valley.' });
  }

  /* ---------- Dhunibesi village ---------- */
  function village(scene, W) {
    const v = HW.village, b = new KS.Builder(), y0 = (x, z) => KS.heightAt(x, z);
    const house = (x, z, ry, floors, kind) => {
      const y = y0(x, z) - 0.6, w = KS.r(7, 10), d = KS.r(6, 8), fh = 2.8;
      const low = kind === 'tamang' ? 0xe9e1cf : 0xa4532e;
      b.box(x, y, z, w, fh + 0.6, d, low, ry); b.box(x, y + fh + 0.6, z, w, fh * (floors - 1), d, kind === 'tamang' ? 0xe9e1cf : 0xf1e9d8, ry);
      b.box(x, y + 0.6, z, w + 0.05, 0.4, d + 0.05, 0x7a3a20, ry);
      const s = Math.sin(ry), c = Math.cos(ry);
      for (let f = 0; f < floors; f++) for (const o of [-w / 3, 0, w / 3]) { if (f === 0 && o === 0) continue; b.box(x + s * (d / 2 + 0.05) + c * o, y + 1.6 + f * fh, z + c * (d / 2 + 0.05) - s * o, 1.1, 1.2, 0.12, 0x3b2414, ry); }
      b.box(x + s * (d / 2 + 0.05), y + 0.6, z + c * (d / 2 + 0.05), 1.2, 2.1, 0.12, 0x2a1a10, ry);
      const top = y + 0.6 + fh * floors;
      b.roof(x, top, z, Math.max(w, d) + 1.6, 2.2, kind === 'tin' ? 0x7f8f9a : kind === 'tamang' ? 0x5a4a3a : 0x8a3a24, 0.15);
      b.box(x + s * (d / 2 + 1.4), y, z + c * (d / 2 + 1.4), w, 0.5, 2.6, 0x9a8a70, ry); // porch
      KS.addBox(x, z, Math.max(w, d), Math.max(w, d), top + 2);
      if (kind === 'tamang') KS.World.flags([x - 3, top + 3, z], [x + 3, top + 2, z + 8], 1, 0.8);
      KS.villageSpots.push({ x: x + s * (d / 2 + 4), z: z + c * (d / 2 + 4) });
    };
    // houses lining the highway, then scattered up the slopes
    for (let i = 0; i < 16; i++) {
      const x = v.x + 230 - i * 30 + KS.r(-4, 4);
      if (Math.abs(x - v.x) < 18) continue;
      house(x, HW.z - 22 - KS.r(0, 6), Math.PI, KS.ri(2, 3), KS.pick(['brick', 'brick', 'tin', 'tamang']));
      house(x + 12, HW.z + 22 + KS.r(0, 6), 0, KS.ri(2, 3), KS.pick(['brick', 'tin', 'tin', 'tamang']));
    }
    for (let i = 0; i < 26; i++) {
      const a = KS.r(0, Math.PI * 2), d = KS.r(90, 320), x = v.x + Math.cos(a) * d, z = v.z + Math.sin(a) * d;
      if (Math.abs(z - HW.z) < 40) continue;
      house(x, z, Math.atan2(v.x - x, v.z - z), KS.ri(1, 2), KS.pick(['brick', 'tin', 'tamang']));
    }
    // rice terraces stepping up the hillsides
    for (let ring = 0; ring < 14; ring++) {
      const rad = 250 + ring * 22;
      for (let a = 0; a < Math.PI * 2; a += 0.09) {
        const x = v.x + Math.cos(a) * rad, z = v.z + Math.sin(a) * rad * 1.1;
        if (Math.abs(z - HW.z) < 34 || x > HW.pW - 30) continue;
        const h = y0(x, z), step = Math.floor(h / 1.6) * 1.6;
        const col = KS.chance(0.15) ? 0xc9b25a : ring % 3 === 0 ? 0x7da23e : 0x8fb04a;
        b.box(x, step - 3, z, 21, 3 + 0.25, 21, col, -a);
        b.box(x, step + 0.2, z, 21, 0.25, 0.5, 0x6a5a3a, -a);
      }
    }
    // chautari: stone resting platform under a peepal tree, by the road
    const cx = v.x, cz = HW.z - 16, cy = y0(cx, cz);
    b.cyl(cx, cy - 0.5, cz, 6, 1.3, 0x8f887a, 16); b.cyl(cx, cy + 0.8, cz, 4.6, 0.7, 0x9e978a, 16);
    KS.addCircle(cx, cz, 6, cy + 0.8); KS.addCircle(cx, cz, 4.6, cy + 1.5);
    KS.World.tree(cx, cz, 16);
    for (let i = 0; i < 5; i++) KS.sitSpots.push([cx + Math.cos(i * 1.2) * 5.5, cz + Math.sin(i * 1.2) * 5.5, cy + 0.8, i === 0 ? 'elder' : undefined]);
    // tea shop & bus stop
    const tx = v.x + 40, tz = HW.z - 15, ty = y0(tx, tz);
    b.box(tx, ty - 0.5, tz, 8, 3.4, 6, 0xd8c8a0); b.box(tx, ty + 2.9, tz + 1.2, 9, 0.2, 8.6, 0x7f8f9a);
    for (const o of [-2.5, 2.5]) W.bench(b, tx + o, tz + 5, 0);
    board(scene, 'चिया पसल', 'TEA SHOP', tx, ty + 3.6, tz + 3.05, 0, 4, 1.2, '#c81e1e', '#ffe14a');
    KS.addBox(tx, tz, 8, 6, ty + 3.5);
    b.box(v.x - 60, y0(v.x - 60, HW.z + 10) - 0.4, HW.z + 10, 6, 0.5, 2.4, 0x777777); b.box(v.x - 60, y0(v.x - 60, HW.z + 10) + 2.6, HW.z + 10, 6.4, 0.15, 3, 0x1d4fb8);
    board(scene, 'धुनिबेसी बसपार्क', 'DHUNIBESI', v.x - 60, y0(v.x - 60, HW.z + 10) + 3.4, HW.z + 8.6, 0, 4.6, 1.2, '#1d4fb8');
    // village temple & school
    KS.World.smallShrine(b, v.x - 30, HW.z - 48, true); KS.bells.push([v.x - 30, HW.z - 48]);
    const sx = v.x + 110, sz = HW.z + 60, sy = y0(sx, sz);
    b.box(sx, sy - 0.5, sz, 26, 4, 8, 0xf2e6b8); b.roof(sx, sy + 3.5, sz, 28, 1.6, 0x7f8f9a, 0.6); KS.addBox(sx, sz, 26, 8, sy + 5);
    for (let i = 0; i < 6; i++) b.box(sx - 10 + i * 4, sy + 1, sz - 4.05, 1.6, 1.4, 0.1, 0x3b6a9a);
    board(scene, 'श्री धुनिबेसी मा.वि.', 'SCHOOL', sx, sy + 3.2, sz - 4.1, Math.PI, 7, 1.4, '#ffffff', '#1d3a8a');
    scene.add(KS.mesh(b));
    KS.plazas.push({ x0: v.x - 150, x1: v.x + 150, z0: HW.z - 34, z1: HW.z - 12, n: 14, y: null, kinds: ['farmer', 'farmer', 'elder', 'woman', 'kid', 'porter'] });
    KS.plazas.push({ x0: v.x - 150, x1: v.x + 150, z0: HW.z + 12, z1: HW.z + 34, n: 10, y: null, kinds: ['farmer', 'woman', 'kid', 'elder'] });
    KS.goatSpots.push([v.x + 60, HW.z - 70], [v.x - 120, HW.z + 80], [v.x + 160, HW.z - 30]);
    KS.landmarks.push({ id: 'village', name: 'Dhunibesi Village', np: 'धुनिबेसी गाउँ', x: v.x, z: HW.z, r: 70, stop: { x: v.x + 20, z: HW.z - 9 }, fact: 'Beyond the pass: terraced rice fields, a chautari under the peepal tree and a tea shop by the highway.' });
  }

  /* ---------- Balaju water garden, Shankha Park, hospital ---------- */
  function parks(scene, W) {
    let R = W.blockRect(1, 1), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    W.park(R, 7);
    const b = new KS.Builder();
    // Baisdhara: 22 stone water spouts along a wall above a long trough
    const wz = R.z0 + 9;
    b.box(cx, 0, wz - 1.2, 56, 3.4, 1.4, 0x8f887a); b.box(cx, 0, wz + 0.6, 56, 0.6, 2.2, 0x6f6a60); b.box(cx, 0.6, wz + 0.6, 54, 0.05, 1.8, 0x4f8a9a);
    KS.addBox(cx, wz - 1.2, 56, 1.4, 3.4); KS.addBox(cx, wz + 0.6, 56, 2.2, 0.6);
    for (let i = 0; i < 22; i++) { const x = cx - 25.2 + i * 2.4; b.box(x, 1.6, wz - 0.4, 0.4, 0.4, 0.7, P.gold); b.box(x, 0.65, wz + 0.05, 0.12, 1.0, 0.12, 0x9fd4e8); }
    KS.World.smallShrine(b, cx + 22, cz + 14, false);
    scene.add(KS.mesh(b));
    KS.landmarks.push({ id: 'balaju', name: 'Balaju Water Garden', np: 'बालाजु बाइसधारा', x: cx, z: cz, r: 32, fact: 'Famous for Baisdhara, a row of 22 stone water spouts, and a sleeping Vishnu statue.' });

    R = W.blockRect(8, 1); cx = (R.x0 + R.x1) / 2; cz = (R.z0 + R.z1) / 2;
    W.park(R, 11);
    const c = new KS.Builder();
    c.cyl(cx, 2.9, cz, 1.4, 3.2, 0xf6f2ea, 12, 0.15, 0, 0.35); c.sphere(cx, 3.6, cz + 0.4, 1.5, 0xf6f2ea, 0.8, 12); c.cyl(cx, 3.4, cz + 0.6, 0.7, 1.6, 0xe8c9a8, 10, 0.2, 0, 1.2);
    scene.add(KS.mesh(c));
    KS.landmarks.push({ id: 'shankha', name: 'Shankha Park', np: 'शंख पार्क', x: cx, z: cz, r: 30, fact: 'A neighbourhood park named after the conch shell, with lawns, benches and a fountain.' });

    R = W.blockRect(7, 5); cx = (R.x0 + R.x1) / 2; cz = (R.z0 + R.z1) / 2;
    const h = new KS.Builder();
    h.box(cx, 0.1, cz, R.x1 - R.x0 - 8, 0.06, R.z1 - R.z0 - 8, 0x8d8676);
    h.box(cx + 8, 0, cz - 4, 48, 16, 22, 0xf2f0ea); h.box(cx + 8, 3, cz - 4, 48.2, 0.6, 22.2, 0xc81e1e); h.box(cx + 8, 16, cz - 4, 49, 0.6, 23, 0xd8d4ca);
    for (let f = 0; f < 4; f++) for (let i = 0; i < 9; i++) h.box(cx - 13 + i * 5.2, 4.6 + f * 2.9, cz + 7.05, 2.6, 1.6, 0.1, 0x5a8aa8);
    h.box(cx - 2, 0, cz + 11, 14, 4, 5, 0xe8e6e0); h.box(cx - 2, 4, cz + 11, 15, 0.4, 6, 0xc81e1e); // emergency bay canopy
    h.box(cx + 8, 12.6, cz + 7.2, 3, 3, 0.2, 0xffffff); h.box(cx + 8, 13.6, cz + 7.35, 2.2, 0.8, 0.1, 0xc81e1e); h.box(cx + 8, 12.9, cz + 7.35, 0.8, 2.2, 0.1, 0xc81e1e);
    KS.addBox(cx + 8, cz - 4, 48, 22, 16.6); KS.addBox(cx - 2, cz + 11, 14, 5, 4.4);
    scene.add(KS.mesh(h));
    board(scene, 'अस्पताल', 'HOSPITAL · EMERGENCY', cx - 2, 5.2, cz + 13.6, 0, 8, 2, '#ffffff', '#c81e1e');
    KS.hospital = { x: cx - 2, z: R.z1 - 2 };
    KS.landmarks.push({ id: 'hospital', minor: true, name: 'City Hospital', np: 'अस्पताल', x: cx, z: cz, r: 26, stop: { x: cx - 2, z: R.z1 + 2 }, fact: 'Emergency patients are urgent fares: get them here fast and gently.' });
  }

  /* ---------- traffic lights, zebra crossings, speed-limit signs, speed cameras ---------- */
  function trafficControl(scene) {
    const b = new KS.Builder(), zebra = new KS.Builder();
    const lampGeo = new T.SphereGeometry(0.17, 8, 6);
    for (const [i, j] of KS.SIGNALS) {
      const x = G.line(i), z = G.line(j), hw = Math.max(G.roadHalf(i), G.roadHalf(j));
      const sig = { i, j, x, z, hw, off: (i * 7 + j * 3) % 24, state: { ns: 'g', ew: 'r' }, mats: { ns: [], ew: [] } };
      for (const ax of ['ns', 'ew']) for (const c of [0x3a0000, 0x3a2a00, 0x003a10]) sig.mats[ax].push(new T.MeshBasicMaterial({ color: c }));
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const px = x + sx * (G.roadHalf(i) + 1.4), pz = z + sz * (G.roadHalf(j) + 1.4);
        b.cyl(px, 0, pz, 0.12, 4.6, 0x333333, 6); KS.addCircle(px, pz, 0.2, 4.6);
        for (const ax of ['ns', 'ew']) {
          const hx = px + (ax === 'ns' ? 0 : sx * 0.35), hz = pz + (ax === 'ns' ? sz * 0.35 : 0);
          b.box(hx, 3.3, hz, ax === 'ns' ? 0.5 : 0.3, 1.5, ax === 'ns' ? 0.3 : 0.5, 0x1a1a1a);
          for (let k = 0; k < 3; k++) {
            const l = new T.Mesh(lampGeo, sig.mats[ax][k]);
            l.position.set(hx + (ax === 'ns' ? 0 : sx * 0.16), 4.5 - k * 0.45, hz + (ax === 'ns' ? sz * 0.16 : 0)); scene.add(l);
          }
        }
      }
      for (const [dx, dz] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) { // zebra crossings on each approach
        const d = hw + 3.2;
        for (let k = -3; k <= 3; k++) {
          if (dx === 0) zebra.box(x + k * 2.1, 0.075, z + dz * d, 1.1, 0.02, 3.2, 0xf4f4ee);
          else zebra.box(x + dx * d, 0.075, z + k * 2.1, 3.2, 0.02, 1.1, 0xf4f4ee);
        }
      }
      KS.signals.push(sig);
    }
    // speed-limit signs a little after junctions
    const signMats = {};
    const signMat = (lim) => signMats[lim] || (signMats[lim] = new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(128, 128, (g) => {
      g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 14; g.beginPath(); g.arc(64, 64, 52, 0, 7); g.stroke();
      g.fillStyle = '#111'; g.font = '800 52px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(String(lim), 64, 68);
    }), transparent: true, alphaTest: 0.5 }));
    const signGeo = new T.CircleGeometry(0.55, 20);
    const place = (x, z, ry, lim, y = 0) => {
      b.cyl(x, y, z, 0.05, 2.6, 0x777777, 5);
      const m = new T.Mesh(signGeo, signMat(lim)); m.position.set(x, y + 2.6, z); m.rotation.y = ry; scene.add(m);
    };
    for (let i = 0; i <= G.N; i++) for (let j = 0; j < G.N; j += 2) {
      const lim = KS.speedLimit(G.line(i) + 1, G.line(j) + 45), x = G.line(i) - G.roadHalf(i) - 1.2, z = G.line(j) + G.roadHalf(j) + 14;
      if (KS.blockType(Math.max(0, i - 1), j) !== 'river') place(x, z, 0, lim);
      const lim2 = KS.speedLimit(G.line(j) + 45, G.line(i) + 1), x2 = G.line(j) + G.roadHalf(j) + 14, z2 = G.line(i) + G.roadHalf(i) + 1.2;
      if (KS.blockType(j, Math.min(G.N - 1, i)) !== 'river') place(x2, z2, Math.PI / 2, lim2);
    }
    place(-600, HW.z - 8.6, Math.PI / 2, 60, KS.roadH(-600)); place(HW.pE + 20, HW.z - 8.6, Math.PI / 2, 50, KS.roadH(HW.pE + 20)); place(-1690, HW.z + 8.6, -Math.PI / 2, 60, KS.roadH(-1690));
    // speed cameras
    const flashMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    for (const c of KS.SPEEDCAMS) {
      const y = c.hw ? KS.roadH(c.x) : 0;
      b.cyl(c.x, y, c.z, 0.14, 5.4, 0x9a9a9a, 6); b.box(c.x, y + 5.2, c.z, 0.7, 0.55, 0.9, 0xe8e8e0); b.box(c.x, y + 5.3, c.z + (c.ax === 'z' ? 0.5 : 0), 0.3, 0.3, 0.1, 0x111111);
      b.box(c.x, y + 3.2, c.z, 0.08, 0.9, 0.7, 0x1d4fb8);
      const fl = new T.Mesh(new T.SphereGeometry(0.6, 8, 6), flashMat.clone()); fl.position.set(c.x, y + 5.5, c.z); scene.add(fl);
      KS.speedCams.push({ ...c, y, flash: fl, cool: 0 });
      KS.addCircle(c.x, c.z, 0.3, y + 6);
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
    const zm = new T.Mesh(zebra.build(), new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -5, polygonOffsetUnits: -5 }));
    zm.receiveShadow = true; scene.add(zm);
  }

  X.build = (scene, W) => {
    highway(scene); village(scene, W); parks(scene, W); trafficControl(scene);
  };
})();
