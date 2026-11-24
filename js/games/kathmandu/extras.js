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
    KS.World.smallShrine(b, v.x - 30, HW.z - 48, true); if (KS.bellAt) KS.bellAt(b, v.x - 30 + 6, HW.z - 48, y0(v.x - 24, HW.z - 48)); // the village temple's bell
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
    /* Bir Hospital, hollow and explorable: real walls with a door under the
       emergency canopy, a lobby with a reception desk, and three rooms
       behind it — Emergency, a ward, and a doctor's office. The upper
       floors stay a solid-looking shell above the 4.2 m ceiling. */
    const wall = (x, z, w, d, y0, y1) => { h.box(x, y0, z, w, y1 - y0, d, 0xf2f0ea); KS.addBox(x, z, w, d, y1, y0); };
    wall(125, -38, 12, 0.6, 0, 16); wall(151, -38, 32, 0.6, 0, 16); // south wall, door gap at x 131..135
    wall(133, -38, 4, 0.6, 3, 16); // lintel over the door
    wall(143, -60, 48, 0.6, 0, 16); wall(119, -49, 0.6, 22, 0, 16); wall(167, -49, 0.6, 22, 0, 16);
    h.box(143, 3, -38, 48.4, 0.6, 0.7, 0xc81e1e); h.box(143, 3, -60, 48.4, 0.6, 0.7, 0xc81e1e); // red band
    h.box(119, 3, -49, 0.7, 0.6, 22.4, 0xc81e1e); h.box(167, 3, -49, 0.7, 0.6, 22.4, 0xc81e1e);
    h.box(143, 16, -49, 49, 0.6, 23, 0xd8d4ca); // roof cap
    h.box(143, 4.2, -49, 47, 0.15, 21, 0xf2f0ea); // interior ceiling
    for (let f = 0; f < 4; f++) for (let i = 0; i < 9; i++) h.box(cx - 13 + i * 5.2, 4.6 + f * 2.9, -37.65, 2.6, 1.6, 0.1, 0x5a8aa8);
    for (const wx of [123, 129, 137, 143, 149, 155, 163]) { h.box(wx, 1.8, -38, 2.6, 1.4, 0.7, 0x5a8aa8); h.box(wx, 1.8, -60, 2.6, 1.4, 0.7, 0x5a8aa8); }
    h.box(cx - 2, 0, cz + 11, 14, 4, 5, 0xe8e6e0); h.box(cx - 2, 4, cz + 11, 15, 0.4, 6, 0xc81e1e); // emergency bay canopy
    KS.addBox(cx - 2, cz + 11, 14, 5, 4.4);
    h.box(cx + 8, 12.6, -37.6, 3, 3, 0.2, 0xffffff); h.box(cx + 8, 13.6, -37.55, 2.2, 0.8, 0.1, 0xc81e1e); h.box(cx + 8, 12.9, -37.55, 0.8, 2.2, 0.1, 0xc81e1e);
    // partitions: lobby | rooms (doors to Emergency, the ward and the office), and the two room dividers
    wall(123, -50, 8, 0.4, 0, 4.2); wall(136, -50, 10, 0.4, 0, 4.2); wall(152, -50, 14, 0.4, 0, 4.2); wall(165, -50, 4, 0.4, 0, 4.2);
    wall(129, -50, 4, 0.4, 2.6, 4.2); wall(143, -50, 4, 0.4, 2.6, 4.2); wall(161, -50, 4, 0.4, 2.6, 4.2);
    wall(135, -58, 0.4, 4, 0, 4.2); wall(135, -51.5, 0.4, 3, 0, 4.2); wall(135, -54.5, 0.4, 3, 2.6, 4.2);
    wall(151, -58, 0.4, 4, 0, 4.2); wall(151, -51.5, 0.4, 3, 0, 4.2); wall(151, -54.5, 0.4, 3, 2.6, 4.2);
    scene.add(KS.mesh(h));
    // furniture: real models where they loaded, code-built where they did not
    const f = new KS.Builder();
    const prop = (name, x, z, ry, y) => {
      const m = KS.Props && KS.Props.build(name);
      if (m) { m.position.set(x, (y == null ? 0.13 : y) + 0.05, z); m.rotation.y = ry || 0; scene.add(m); if (KS.Damage && KS.Damage.registerProp) KS.Damage.registerProp(m, x, z, name); return true; }
      return false;
    };
    const bed = (x, z) => { if (!prop('bed', x, z, 0)) { f.box(x, 0, z, 1, 0.5, 2.1, 0xf4f4f4); f.box(x, 0.5, z - 0.8, 0.8, 0.15, 0.4, 0xffffff); f.box(x, 0.15, z, 1.05, 0.12, 2.15, 0x1d4fb8); } KS.addBox(x, z, 1.1, 2.2, 0.9); };
    const chair = (x, z, ry) => { if (!prop('chair', x, z, ry)) { f.box(x, 0.45, z, 0.5, 0.08, 0.5, 0x3a5a8a, ry); f.box(x, 0.53, z, 0.5, 0.5, 0.08, 0x3a5a8a, ry); } };
    const plant = (x, z) => { if (!prop('plant', x, z, 0)) { f.cyl(x, 0, z, 0.25, 0.4, 0x8a5a30, 10); f.sphere(x, 0.7, z, 0.45, 0x2a7a3a, 0.9, 10); } };
    const computer = (x, z, ry, y) => { if (!prop('computer', x, z, ry, y)) f.box(x, y + 0.25, z, 0.5, 0.4, 0.06, 0x111418, ry); };
    // lobby: reception desk + computer, waiting chairs, potted plants
    f.box(143, 0, -48.5, 3, 0.9, 0.8, 0x8a6a3a); computer(143, -48.5, Math.PI, 0.9);
    for (const wx of [124, 130, 156, 162]) chair(wx, -40, Math.PI);
    plant(121, -40); plant(165, -40); plant(150, -47);
    // Emergency: two beds; Ward: three beds (the middle one is where you wake up); Office: desk + computer + chair
    bed(124, -55); bed(130, -55);
    bed(139, -55); bed(143, -55); bed(147, -55);
    f.box(159, 0, -58.5, 2.4, 0.75, 0.8, 0x6a4a2a); computer(159, -58.5, 0, 0.75); chair(159, -57, Math.PI);
    f.box(164, 0, -55, 0.5, 2.2, 3, 0x8a6a3a); f.box(121, 0, -55, 0.5, 2.2, 3, 0x8a6a3a); // shelves in the office and Emergency
    scene.add(KS.mesh(f, KS.M.vc, false));
    KS.wakeBed = { x: 143, z: -55, h: 0 };
    KS.doctorSpots = [[127, -55, 0, 'doctor'], [141, -57, 0, 'doctor'], [149, -57, Math.PI, 'nurse'], [159, -56.5, Math.PI, 'doctor'], [143, -49.3, 0, 'nurse']];
    board(scene, 'वीर अस्पताल', 'BIR HOSPITAL · EMERGENCY', cx - 2, 5.2, cz + 13.6, 0, 8, 2, '#ffffff', '#c81e1e');
    KS.hospital = { x: cx - 2, z: R.z1 - 2 };
    KS.landmarks.push({ id: 'hospital', minor: true, name: 'Bir Hospital', np: 'वीर अस्पताल', x: cx, z: cz, r: 26, stop: { x: cx - 2, z: R.z1 + 2 }, fact: 'Nepal’s oldest hospital. Walk in — the reception, the ward and the doctors’ office are all inside.' });

    /* ---------- Bir Hospital, round 9: a grander entrance, two helipads, a roof lift ----------
       Entrance: a columned portico over the door, glass doors swung open, a big
       lit red cross and an EMERGENCY sign. Ground helipad in the forecourt and
       a rooftop helipad on the roof (the roof is a walkable slab; a glass lift
       on the east wall takes you up and down). More doctors, a pharmacy counter
       and a garden in front. */
    {
      const hb = new KS.Builder();
      /* the portico: two columns and a canopy over the door (x 131..135, z -38). */
      hb.cyl(129.5, 0, -35.5, 0.45, 3.6, 0xf2f0ea, 10); hb.cyl(136.5, 0, -35.5, 0.45, 3.6, 0xf2f0ea, 10);
      hb.box(133, 3.6, -36.5, 10, 0.35, 4.5, 0xc81e1e); // red portico roof
      hb.box(133, 3.9, -36.5, 10.2, 0.15, 4.7, 0x8a2a1a);
      KS.addBox(129.5, -35.5, 0.9, 0.9, 3.6); KS.addBox(136.5, -35.5, 0.9, 0.9, 3.6); // the columns are solid
      /* glass doors, swung open flat against the door frame so the doorway stays clear. */
      hb.box(131.2, 0, -37.6, 0.06, 2.6, 1.1, 0x9ac8e0, Math.PI / 2.4);
      hb.box(134.8, 0, -37.6, 0.06, 2.6, 1.1, 0x9ac8e0, -Math.PI / 2.4);
      /* a big red cross above the entrance, and an EMERGENCY board on the portico. */
      hb.box(133, 4.6, -37.7, 2.4, 0.7, 0.15, 0xffffff); hb.box(133, 4.6, -37.7, 0.7, 2.4, 0.15, 0xffffff);
      hb.box(133, 4.6, -37.62, 2.0, 0.4, 0.1, 0xc81e1e); hb.box(133, 4.6, -37.62, 0.4, 2.0, 0.1, 0xc81e1e);
      /* the forecourt: a red EMERGENCY bay in front of the door and a stretcher. */
      hb.box(133, 0.03, -32, 8, 0.06, 5, 0xc81e1e);
      hb.box(133, 0.05, -32, 7, 0.05, 4, 0x8a2a1a);
      hb.box(140, 0.4, -33, 0.7, 0.15, 2, 0x3a5a8a); hb.box(140, 0.55, -33.8, 0.5, 0.1, 0.3, 0xffffff); // a stretcher by the bay
      /* a pharmacy counter inside the lobby, with its own sign. */
      hb.box(125, 0, -52, 2.6, 1, 0.8, 0x2a6a3a); hb.box(125, 1, -52, 2.8, 0.1, 1, 0x1a4a2a);
      scene.add(KS.mesh(hb));
      board(scene, 'EMERGENCY', 'आपतकालीन · 24 HOURS', 133, 5.6, -34.2, 0, 7, 1.6, '#c81e1e', '#ffffff');
      board(scene, 'फार्मेसी', 'PHARMACY', 125, 2.4, -51.5, 0, 4, 1.2, '#2a6a3a', '#ffffff');
      /* more staff: two extra doctors/nurses on the ward and in the lobby. */
      KS.doctorSpots.push([155, -55, Math.PI, 'nurse'], [133, -49.3, Math.PI, 'doctor']);
      /* the garden in front: benches and plants along the forecourt edges. */
      const gb = new KS.Builder();
      for (const gx of [121, 164]) { gb.box(gx, 0.45, -20, 2.2, 0.08, 0.7, 0x6a4a2a); gb.box(gx, 0.53, -20.3, 2.2, 0.5, 0.08, 0x6a4a2a); gb.cyl(gx - 2.5, 0, -20, 0.3, 0.5, 0x8a5a30, 8); gb.sphere(gx - 2.5, 0.8, -20, 0.55, 0x2a7a3a, 0.9, 8); }
      scene.add(KS.mesh(gb, KS.M.vc, false));
      /* ---------- the ground helipad, in the forecourt (143, -20) ---------- */
      const gp = new KS.Builder();
      gp.cyl(143, 0, -20, 6, 0.08, 0x3a3a3a, 24); // the pad
      gp.cyl(143, 0.09, -20, 5.4, 0.05, 0xf2f2f2, 24); // white ring
      gp.cyl(143, 0.1, -20, 4.9, 0.05, 0x3a3a3a, 24);
      gp.box(143, 0.12, -20, 1.1, 0.05, 5.4, 0xf2f2f2); gp.box(141.4, 0.12, -20, 1.1, 0.05, 5.4, 0xf2f2f2); // the H
      gp.box(143, 0.12, -20, 4.3, 0.05, 1.1, 0xf2f2f2);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; gp.box(143 + Math.cos(a) * 6.3, 0.1, -20 + Math.sin(a) * 6.3, 0.4, 0.18, 0.4, 0xffc81e); }
      gp.cyl(150.5, 0, -13.5, 0.09, 4.2, 0x8a8a8a, 8); // windsock pole
      gp.cyl(150.5, 4.2, -13.5, 0.28, 1.4, 0xff6a1a, 8, 0.35, 0, 0); // windsock cone
      scene.add(KS.mesh(gp, KS.M.vc, false));
      /* ---------- the rooftop helipad, on the roof (130, -49) ---------- */
      KS.addBox(143, -49, 49, 23, 16.3, 15.7); // the roof is a walkable slab
      const rp = new KS.Builder();
      rp.cyl(130, 16.32, -49, 6, 0.08, 0x3a3a3a, 24);
      rp.cyl(130, 16.41, -49, 5.4, 0.05, 0xf2f2f2, 24);
      rp.cyl(130, 16.42, -49, 4.9, 0.05, 0x3a3a3a, 24);
      rp.box(130, 16.44, -49, 1.1, 0.05, 5.4, 0xf2f2f2); rp.box(128.4, 16.44, -49, 1.1, 0.05, 5.4, 0xf2f2f2);
      rp.box(130, 16.44, -49, 4.3, 0.05, 1.1, 0xf2f2f2);
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; rp.box(130 + Math.cos(a) * 6.3, 16.4, -49 + Math.sin(a) * 6.3, 0.4, 0.18, 0.4, 0xffc81e); }
      rp.cyl(160, 16.3, -55, 0.09, 4.2, 0x8a8a8a, 8); // roof windsock
      rp.cyl(160, 20.5, -55, 0.28, 1.4, 0xff6a1a, 8, 0.35, 0, 0);
      /* a rooftop garden on the east end, away from the pad and the lift. */
      for (const [px, pz] of [[152, -56], [158, -44], [163, -54]]) { rp.box(px, 16.3, pz, 1.6, 0.5, 1.6, 0x8a5a30); rp.sphere(px, 17.1, pz, 0.7, 0x2a7a3a, 0.9, 8); }
      scene.add(KS.mesh(rp, KS.M.vc, false));
      /* the glass lift on the east wall: ground <-> roof helipad. */
      const lb = new KS.Builder();
      lb.box(169, 0, -49, 2.4, 16.3, 2.4, 0x9ac8e0);
      lb.box(169, 16.3, -49, 2.8, 0.3, 2.8, 0x5a4632);
      scene.add(KS.mesh(lb, KS.M.vc, false));
      KS.addBox(169, -49, 2.4, 2.4, 16.3);
      (KS.lifts = KS.lifts || []).push(
        { x: 169, z: -46.4, y: 0.6, to: { x: 165, z: -49, y: 16.3 }, label: 'Take the lift to the roof helipad 🚁' },
        { x: 165, z: -49, y: 16.3, to: { x: 169, z: -46.4, y: 0.6 }, label: 'Take the lift down' });
      KS.hospitalHelipads = [{ x: 143, z: -20, y: 0, where: 'ground' }, { x: 130, z: -49, y: 16.3, where: 'roof' }];
      KS.landmarks.push({ id: 'helipad-hospital', name: 'Bir Hospital Helipad', np: 'अस्पताल हेलिप्याड', x: 143, z: -20, r: 10, fact: 'Two helipads at Bir Hospital — one on the ground in front, one on the roof. Fly the helicopter in, or take the glass lift up to the roof.' });
    }

    /* ---------- the sky bridge (आकाशे पुल) over the road in front of Bir Hospital ----------
       A walkable overpass at x 170, crossing the z = 0 road: stairs up both sides,
       a deck at 5 m with railings, and a sign. The deck and every step are thin
       solids, so the player walks up and across on the visible mesh (groundAt
       stands on solid tops); vehicles pass underneath. Verified clear, round 9. */
    {
      const BX = 170, DECK = 5, STEP_RISE = DECK / 14, NSTEPS = 14;
      const bb = new KS.Builder();
      const stepTop = (i) => (i + 1) * STEP_RISE; // step i tops out at (i+1) * rise; the 14th is the deck
      const zN = (i) => -11 - (NSTEPS - 1 - i) * 0.79; // north stair: z -22 .. -11
      const zS = (i) => 11 + (NSTEPS - 1 - i) * 0.79; // south stair: z 11 .. 22
      for (let i = 0; i < NSTEPS; i++) {
        const tN = stepTop(i), tS = stepTop(i);
        bb.box(BX, 0, zN(i), 3, tN, 0.79, 0x8d8676); // north step (a solid slab to its top)
        bb.box(BX, 0, zS(i), 3, tS, 0.79, 0x8d8676); // south step
        KS.addBox(BX, zN(i), 3, 0.79, tN); // full-height step: the visual is a solid staircase
        KS.addBox(BX, zS(i), 3, 0.79, tS);
        /* a handrail on each side of each step (visual; the deck railings are solid). */
        bb.box(BX - 1.6, tN, zN(i), 0.12, 1, 0.79, 0x3a3a3a); bb.box(BX + 1.6, tN, zN(i), 0.12, 1, 0.79, 0x3a3a3a);
        bb.box(BX - 1.6, tS, zS(i), 0.12, 1, 0.79, 0x3a3a3a); bb.box(BX + 1.6, tS, zS(i), 0.12, 1, 0.79, 0x3a3a3a);
      }
      bb.box(BX, DECK - 0.15, 0, 3, 0.3, 22, 0x8d8676); // the deck slab
      KS.addBox(BX, 0, 3, 22, DECK, DECK - 0.3);
      /* solid railings on the deck so nobody walks off the edge (1.2 m tall). */
      bb.box(BX - 1.55, DECK, 0, 0.15, 1.2, 22, 0x3a3a3a); bb.box(BX + 1.55, DECK, 0, 0.15, 1.2, 22, 0x3a3a3a);
      KS.addBox(BX - 1.55, 0, 0.15, 22, DECK + 1.2, DECK); KS.addBox(BX + 1.55, 0, 0.15, 22, DECK + 1.2, DECK);
      /* support columns on the sidewalks, clear of the carriageway. */
      bb.box(BX - 1.4, 0, -9.5, 0.5, DECK, 0.5, 0x6a6a6a); bb.box(BX + 1.4, 0, -9.5, 0.5, DECK, 0.5, 0x6a6a6a);
      bb.box(BX - 1.4, 0, 9.5, 0.5, DECK, 0.5, 0x6a6a6a); bb.box(BX + 1.4, 0, 9.5, 0.5, DECK, 0.5, 0x6a6a6a);
      KS.addBox(BX - 1.4, -9.5, 0.5, 0.5, DECK); KS.addBox(BX + 1.4, -9.5, 0.5, 0.5, DECK);
      KS.addBox(BX - 1.4, 9.5, 0.5, 0.5, DECK); KS.addBox(BX + 1.4, 9.5, 0.5, 0.5, DECK);
      scene.add(KS.mesh(bb));
      board(scene, 'आकाशे पुल', 'SKY BRIDGE · USE THE STAIRS', BX, DECK + 2.2, -11.6, 0, 8, 1.8, '#1b5e20', '#ffffff');
      KS.landmarks.push({ id: 'skybridge', name: 'Sky Bridge', np: 'आकाशे पुल', x: BX, z: 0, r: 14, fact: 'An akase pul over the road by Bir Hospital — walk up the stairs and cross above the traffic.' });
      KS.skyBridge = { x: BX, deck: DECK, z0: -11, z1: 11 };
    }
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
      { // red-light camera on a pole at one corner
        const px = x + G.roadHalf(i) + 3, pz = z + G.roadHalf(j) + 3;
        b.cyl(px, 0, pz, 0.12, 6, 0x9a9a9a, 6); b.box(px - 0.6, 5.8, pz - 0.6, 1.4, 0.12, 0.12, 0x9a9a9a, Math.PI / 4);
        b.box(px - 1.1, 5.4, pz - 1.1, 0.5, 0.4, 0.7, 0xe8e8e0, Math.PI / 4); b.box(px - 1.3, 5.45, pz - 1.3, 0.25, 0.25, 0.1, 0x111111, Math.PI / 4);
        const fl = new T.Mesh(new T.SphereGeometry(0.45, 8, 6), new T.MeshBasicMaterial({ color: 0xff3020, transparent: true, opacity: 0, depthWrite: false }));
        fl.position.set(px - 1.1, 5.6, pz - 1.1); scene.add(fl); sig.camFlash = fl; KS.addCircle(px, pz, 0.25, 6);
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
    // speed cameras
    const flashMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false });
    // "speed camera ahead" warning boards about 90 m before every camera, facing traffic from both directions
    const warnMat = new T.MeshLambertMaterial({ map: KS.tex(256, 192, (g, w, h) => {
      g.fillStyle = '#1d4fb8'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#fff'; g.fillRect(78, 34, 84, 50); g.fillRect(150, 26, 26, 14); g.fillStyle = '#1d4fb8'; g.beginPath(); g.arc(112, 59, 17, 0, 7); g.fill(); g.fillStyle = '#fff'; g.beginPath(); g.arc(112, 59, 9, 0, 7); g.fill();
      g.textAlign = 'center'; g.font = '800 30px "Barlow Condensed", Arial, sans-serif'; g.fillText('SPEED CAMERA AHEAD', w / 2, 118, w - 28);
      g.font = '700 28px Mukta, sans-serif'; g.fillText('अगाडि स्पीड क्यामेरा', w / 2, 156, w - 28);
    }) });
    const warnGeo = new T.PlaneGeometry(2.3, 1.72), backMat = new T.MeshLambertMaterial({ color: 0x8a8a8a });
    for (const c of KS.SPEEDCAMS) for (const d of [-1, 1]) {
      // stand it at the kerb so drivers see it
      const lat = c.ax === 'z' ? c.x : c.z, li = Math.round((lat - G.O) / G.B), L = G.line(li), kerb = L + Math.sign(lat - L) * (G.roadHalf(li) + 0.8);
      const wx = c.ax === 'z' ? kerb : c.x + d * 90, wz = c.ax === 'z' ? c.z + d * 90 : kerb, y = c.hw ? KS.roadH(wx) : 0;
      b.cyl(wx, y, wz, 0.07, 2.4, 0x8a8a8a, 5);
      const m = new T.Mesh(warnGeo, warnMat); m.position.set(wx, y + 3.2, wz); m.rotation.y = c.ax === 'z' ? (d > 0 ? 0 : Math.PI) : d * Math.PI / 2; scene.add(m);
      const back = new T.Mesh(warnGeo, backMat); back.position.copy(m.position); back.rotation.y = m.rotation.y + Math.PI; scene.add(back);
      KS.addCircle(wx, wz, 0.12, y + 3.5);
    }
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

  /* ---------- Transport Management Office & licence trial ground (Nepali style) ---------- */
  function trialGround(scene, W) {
    const R = W.blockRect(9, 8), x0 = R.x0 + 4, x1 = R.x1 - 4, z0 = R.z0 + 4, z1 = R.z1 - 4, b = new KS.Builder(), paint = new KS.Builder();
    b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.12, z1 - z0, 0x9c8a6a); KS.addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, 0.12, -1);
    for (let i = 0; i < 120; i++) b.box(KS.r(x0, x1), 0.12, KS.r(z0, z1), KS.r(0.3, 1.2), 0.01, KS.r(0.3, 1.2), KS.pick([0x8a7a5a, 0xa89878]));
    // fence with a gate on the south side
    const post = (x, z) => b.box(x, 0, z, 0.12, 1.8, 0.12, 0x6a6a6a);
    for (let x = x0; x <= x1; x += 3) { post(x, z0); if (x < 298 || x > 312) post(x, z1); }
    for (let z = z0; z <= z1; z += 3) { post(x0, z); post(x1, z); }
    for (const h of [0.6, 1.2, 1.7]) { b.box((x0 + x1) / 2, h, z0, x1 - x0, 0.03, 0.03, 0x888888); b.box(x0, h, (z0 + z1) / 2, 0.03, 0.03, z1 - z0, 0x888888); b.box(x1, h, (z0 + z1) / 2, 0.03, 0.03, z1 - z0, 0x888888); b.box((x0 + 298) / 2, h, z1, 298 - x0, 0.03, 0.03, 0x888888); b.box((312 + x1) / 2, h, z1, x1 - 312, 0.03, 0.03, 0x888888); }
    KS.addBox((x0 + x1) / 2, z0, x1 - x0, 0.3, 2); KS.addBox(x0, (z0 + z1) / 2, 0.3, z1 - z0, 2); KS.addBox(x1, (z0 + z1) / 2, 0.3, z1 - z0, 2);
    KS.addBox((x0 + 298) / 2, z1, 298 - x0, 0.3, 2); KS.addBox((312 + x1) / 2, z1, x1 - 312, 0.3, 2);
    // office building
    const ox = 296, oz = 200;
    b.box(ox, 0, oz, 24, 7, 9, 0xf2f0ea); b.box(ox, 2.9, oz, 24.1, 0.5, 9.1, 0x1d4fb8); b.box(ox, 7, oz, 24.6, 0.4, 9.6, 0xd8d4ca);
    for (let i = 0; i < 7; i++) { b.box(ox - 10 + i * 3.3, 1, oz + 4.55, 1.6, 1.4, 0.1, 0x5a8aa8); b.box(ox - 10 + i * 3.3, 4.2, oz + 4.55, 1.6, 1.4, 0.1, 0x5a8aa8); }
    b.box(ox, 0, oz + 4.6, 3, 2.4, 0.2, 0x2a2a2a); b.box(ox, 2.4, oz + 5.6, 5, 0.15, 2.4, 0x1d4fb8); // counter window & awning
    KS.addBox(ox, oz, 24, 9, 7.5);
    board(scene, 'यातायात व्यवस्था कार्यालय', 'TRANSPORT MANAGEMENT OFFICE · LICENCE', ox, 6.2, oz + 4.7, 0, 12, 1.6, '#1d4fb8');
    board(scene, 'ट्रायल स्थल', 'TRIAL GROUND', 305, 2.4, z1 + 0.3, Math.PI, 5, 1.4, '#c81e1e');
    b.box(303, 0, z1 + 0.3, 0.15, 2, 0.15, 0x666666); b.box(307, 0, z1 + 0.3, 0.15, 2, 0.15, 0x666666);
    // waiting tent with applicants
    const tx = 290, tz = 250;
    b.box(tx, 2.6, tz, 9, 0.12, 6, 0x1d4fb8); for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) b.box(tx + sx * 4.3, 0, tz + sz * 2.8, 0.1, 2.6, 0.1, 0x777777);
    for (let i = 0; i < 3; i++) { W.bench(b, tx - 2.6 + i * 2.6, tz + 0.5, Math.PI); KS.sitSpots.push([tx - 2.6 + i * 2.6, tz + 0.6, 0.12, KS.pick(['student', 'man', 'woman'])]); }
    KS.plazas.push({ x0: ox - 6, x1: ox + 6, z0: oz + 6, z1: oz + 9, n: 8, kinds: ['student', 'man', 'woman', 'office'] });
    const pole = (x, z, h = 1.25) => { b.cyl(x, 0.12, z, 0.05, h, 0xffffff, 6); for (let k = 0; k < 3; k++) b.cyl(x, 0.12 + k * h / 3, z, 0.055, h / 6, 0xc81e1e, 6); const s2 = KS.addCircle(x, z, 0.12, h); s2.tag = 'trial'; };
    const cone = (x, z) => { b.cyl(x, 0.12, z, 0.25, 0.7, 0xff6a00, 8, 0.12); b.cyl(x, 0.4, z, 0.16, 0.1, 0xffffff, 8, 0.9); const s2 = KS.addCircle(x, z, 0.22, 0.8); s2.tag = 'trial'; };
    const ring = (cx, cz, r, from = 0, to = Math.PI * 2) => { for (let a = from; a < to; a += 0.12) paint.box(cx + Math.sin(a) * r, 0.13, cz + Math.cos(a) * r, 0.12, 0.01, 0.4, 0xf4f4ee, a + Math.PI / 2); };
    // painted guide lines: a dashed yellow line with arrows along the whole route
    const guide = (pts, col = 0xf2c418) => {
      for (let k = 0; k < pts.length - 1; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[k + 1], L = Math.hypot(bx - ax, bz - az), h = Math.atan2(bx - ax, bz - az);
        for (let d = 0.4; d < L; d += 1.6) paint.box(ax + ((bx - ax) * d) / L, 0.135, az + ((bz - az) * d) / L, 0.16, 0.01, 0.9, col, h);
        if (L > 4) { const mx = (ax + bx) / 2, mz = (az + bz) / 2; for (const s3 of [-1, 1]) paint.box(mx - Math.sin(h) * 0.3 + Math.cos(h) * s3 * 0.28, 0.136, mz - Math.cos(h) * 0.3 - Math.sin(h) * s3 * 0.28, 0.14, 0.01, 0.8, col, h - s3 * 0.6); }
      }
    };
    // --- bike course: a wide figure-8, plank ramp, cone slalom
    const B8 = { c1: [296, 219], c2: [296, 231], r: 6 };
    for (const [c, sgn] of [[B8.c1, 1], [B8.c2, -1]]) {
      ring(c[0], c[1], B8.r - 1.6); ring(c[0], c[1], B8.r + 1.6);
      for (let a = 0; a < Math.PI * 2; a += 0.35) paint.box(c[0] + Math.sin(a) * B8.r, 0.135, c[1] + Math.cos(a) * B8.r, 0.1, 0.01, 0.6, 0xf2c418, a + Math.PI / 2); // centre line
      for (let k = 0; k < 12; k++) {
        const a = (k / 12) * Math.PI * 2, nearX = Math.abs(Math.sin(a)) < 0.5 && Math.cos(a) * sgn > 0;
        if (!nearX) pole(c[0] + Math.sin(a) * (B8.r + 2.1), c[1] + Math.cos(a) * (B8.r + 2.1));
        if (k % 3 === 0 && !nearX) pole(c[0] + Math.sin(a) * (B8.r - 2.1), c[1] + Math.cos(a) * (B8.r - 2.1));
      }
    }
    const plank = { x0: 306, x1: 316, z: 242 };
    for (let i = 0; i < 10; i++) {
      const x = plank.x0 + 0.5 + i, h = 0.12 + (i < 4 ? (i + 1) * 0.12 : i > 5 ? (10 - i) * 0.12 : 0.5);
      b.box(x, 0.12, plank.z, 1.02, h - 0.12, 1.2, i % 2 ? 0x8a5a30 : 0x7a4a26); const s2 = KS.addBox(x, plank.z, 1.0, 1.2, h); s2.plank = true;
    }
    paint.box(311, 0.13, plank.z - 1.6, 10, 0.01, 0.12, 0xf4f4ee); paint.box(311, 0.13, plank.z + 1.6, 10, 0.01, 0.12, 0xf4f4ee);
    const slalom = [320, 325, 330, 335, 340].map((x) => [x, 248]);
    for (const [x, z] of slalom) cone(x, z);
    paint.box(345, 0.13, 248, 0.3, 0.01, 5, 0xf4f4ee);
    guide([[284.5, 225], [289, 225]]); guide([[296, 239], [300, 242], [305.5, 242]]); guide([[316.5, 242], [318, 246], [322.5, 250], [327.5, 246], [332.5, 250], [337.5, 246], [342, 248], [345, 248]]);
    // --- car course: two cones, a hill start, room to turn round, a big reverse-parking box
    for (const z of [228, 221]) cone(335, z);
    for (let i = 0; i < 26; i++) {
      const z = 213 - i * 0.62, h = 0.12 + (i < 8 ? (i + 1) * 0.13 : i > 17 ? (26 - i) * 0.13 : 1.04);
      b.box(335, 0.12, z, 5, h - 0.12, 0.64, i % 2 ? 0x8f887a : 0x9e978a); KS.addBox(335, z, 5, 0.62, h);
    }
    for (const s2 of [-1, 1]) { b.box(335 + s2 * 2.65, 0.12, 205, 0.15, 1.5, 16, 0xd8d0c0); KS.addBox(335 + s2 * 2.65, 205, 0.15, 16, 1.6); } // ramp sides (bumping them is not a fail)
    const PB = { x: 322, z: 212, w: 4.4, d: 7.4 };
    for (const [px, pz] of [[PB.x - PB.w / 2, PB.z - PB.d / 2], [PB.x + PB.w / 2, PB.z - PB.d / 2], [PB.x - PB.w / 2, PB.z + PB.d / 2], [PB.x + PB.w / 2, PB.z + PB.d / 2]]) pole(px, pz, 1.4);
    paint.box(PB.x, 0.13, PB.z - PB.d / 2, PB.w, 0.01, 0.14, 0xf2c418); paint.box(PB.x - PB.w / 2, 0.13, PB.z, 0.14, 0.01, PB.d, 0xf2c418); paint.box(PB.x + PB.w / 2, 0.13, PB.z, 0.14, 0.01, PB.d, 0xf2c418);
    paint.box(322, 0.13, 236, 5, 0.01, 0.3, 0xf4f4ee);
    guide([[335, 232], [332.4, 228], [337.6, 221], [335, 216]]); guide([[335, 195], [334, 192.5], [328, 192.5], [322, 196], [322, 201], [322, 205]], 0x9fe0ff); guide([[322, 216], [322, 222], [322, 235]]);
    // a better trial ground: a spectator stand, bunting, numbered station signs, chequered start and finish banners
    for (let k = 0; k < 3; k++) { b.box(331, 0.12, 254.4 + k, 26, 0.35 + k * 0.4, 1, k % 2 ? 0x8a8a8a : 0x9a9a9a); KS.addBox(331, 254.4 + k, 26, 1, 0.47 + k * 0.4); }
    b.box(331, 2.9, 256, 27, 0.1, 3.4, 0xc81e1e); for (const sx of [-13, 0, 13]) b.box(331 + sx, 0.12, 257.6, 0.12, 2.8, 0.12, 0x666666);
    for (let k = 0; k < 9; k++) KS.sitSpots.push([320 + k * 2.6, 254.4 + (k % 3), 0.47 + (k % 3) * 0.4, KS.pick(['student', 'man', 'woman', 'office', 'kid'])]);
    W.flags([x0 + 1, 3.2, z0 + 1], [x1 - 1, 3.2, z0 + 1], 1.0, 0.9); W.flags([x1 - 1, 3.2, z0 + 1], [x1 - 1, 3.2, z1 - 1], 1.0, 0.9); W.flags([x0 + 1, 3.2, z1 - 1], [298, 3.2, z1 - 1], 1.0, 0.9);
    const station = (n, np, en, x, z, ry, bg) => { b.box(x - 1.1, 0.12, z, 0.1, 2.4, 0.1, 0x666666); b.box(x + 1.1, 0.12, z, 0.1, 2.4, 0.1, 0x666666); board(scene, `${n} ${np}`, en, x, 2.2, z, ry, 2.6, 0.82, bg); };
    station('①', 'आठ', 'FIGURE EIGHT', 288, 209, 0, '#1d4fb8'); station('②', 'फल्याक', 'PLANK RAMP', 311, 239.4, 0, '#1d4fb8'); station('③', 'कोन', 'CONE SLALOM', 330, 251.7, Math.PI, '#1d4fb8');
    station('①', 'कोन', 'CAR · CONES', 341, 230, -Math.PI / 2, '#6d1a8a'); station('②', 'उकालो', 'HILL START', 339.5, 205, -Math.PI / 2, '#6d1a8a'); station('③', 'पार्किङ', 'PARKING BOX', 316.5, 212, Math.PI / 2, '#6d1a8a');
    const checker = new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(256, 64, (g, w, h) => { for (let i = 0; i < 16; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#111' : '#fff'; g.fillRect(i * 16, j * 16, 16, 16); } }) });
    const banner = (x, z, ry, w, text) => { for (const sx of [-1, 1]) b.box(x + Math.cos(ry) * sx * w / 2, 0.12, z - Math.sin(ry) * sx * w / 2, 0.14, 3.4, 0.14, 0xdddddd); const m = new T.Mesh(new T.PlaneGeometry(w, 0.5), checker); m.position.set(x, 3.3, z); m.rotation.y = ry; scene.add(m); board(scene, text, null, x, 2.85, z, ry, Math.min(w * 0.6, 3), 0.45, '#c81e1e'); };
    banner(345.5, 248, Math.PI / 2, 5.5, 'FINISH'); banner(322, 236, 0, 6, 'FINISH'); banner(285.6, 225, Math.PI / 2, 4.5, 'START'); banner(335, 234.5, 0, 6, 'START');
    // a tiny tea stall on the pavement outside the south-east corner of the fence, and the man in sunglasses behind it
    { const tx2 = R.x1 - 1.6, tz2 = R.z1 - 6;
      b.box(tx2, 0.2, tz2, 1.2, 0.9, 1.8, 0x7a4a2a); b.box(tx2, 1.1, tz2, 1.3, 0.06, 1.9, 0x5a3a22); b.cyl(tx2, 1.16, tz2 - 0.4, 0.12, 0.3, 0x9a9a9a, 8); b.box(tx2, 2.3, tz2, 1.8, 0.08, 2.4, 0x2a6a3a); for (const sz of [-1, 1]) b.box(tx2 + 0.55, 0.2, tz2 + sz * 1.05, 0.06, 2.1, 0.06, 0x555555);
      KS.addBox(tx2, tz2, 1.2, 1.8, 1.1);
      const o = KS.outfitFor('office'); Object.assign(o, { topStyle: 'jacket', jacket: 0x161616, top: 0x2a2a2a, bottom: 0x1a1a1a, glasses: true, hat: 'cap', hatColor: 0x111111, tie: null });
      const ag = KS.makePerson('office', o); ag.root.position.set(tx2 - 0.2, 0.2, tz2 + 2.1); ag.root.rotation.y = -Math.PI / 2; ag.armL.rotation.x = -0.3; ag.armR.rotation.set(-1.9, 0, -0.3); scene.add(ag.root);
      KS.agent = { root: ag.root, x: tx2 - 0.2, z: tz2 + 2.1 }; }
    // examiners with clipboards
    for (const [ex, ez] of [[289, 236], [331, 230]]) { const p = KS.makePerson('office'); KS.animSit(p); p.legL.rotation.x = p.legR.rotation.x = 0; p.armR.rotation.x = -1.1; p.root.position.set(ex, 0.12, ez); p.root.rotation.y = Math.PI * 0.75; scene.add(p.root); b.box(ex + 0.4, 0, ez + 0.4, 0.6, 0.75, 0.6, 0x5a3a22); }
    scene.add(KS.mesh(b));
    const pm = new T.Mesh(paint.build(), new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4 })); scene.add(pm);
    KS.trialGround = { counter: { x: ox, z: oz + 7 }, area: { x0, x1, z0, z1 }, B8, plank, bikeStart: { x: 284.5, z: 225, h: Math.PI / 2 }, bikeFinish: { x: 345, z: 248 }, slalom,
      carStart: { x: 335, z: 233, h: Math.PI }, carCones: [228, 221], hill: { x: 335, zTop0: 203, zTop1: 208 }, box: PB, carFinish: { x: 322, z: 235 }, carArea: { x0: 312, x1: 349, z0: 190, z1: 239 } };
    KS.landmarks.push({ id: 'trial', name: 'Licence Trial Ground', np: 'ट्रायल स्थल', x: 315, z: 225, r: 34, stop: { x: 305, z: R.z1 + 3 }, fact: 'Pass the written test and the famous "8" trial to get your bike licence; the car trial has a hill start and reverse parking.' });
  }

  /* ---------- schools and school zones (25 km/h, 9:00-16:00) ---------- */
  function schools(scene, W) {
    const lampMat = new T.MeshBasicMaterial({ color: 0x553300 }); KS.schoolLamps = lampMat;
    const signTex = KS.tex(256, 256, (g) => {
      g.fillStyle = '#ffd21f'; g.fillRect(0, 0, 256, 256); g.strokeStyle = '#111'; g.lineWidth = 10; g.strokeRect(8, 8, 240, 240);
      g.fillStyle = '#111'; g.textAlign = 'center'; g.font = `700 34px ${KS.FONT}`; g.fillText('विद्यालय क्षेत्र', 128, 58);
      g.font = '800 30px "Barlow Condensed", Arial, sans-serif'; g.fillText('SCHOOL ZONE', 128, 96);
      g.fillStyle = '#fff'; g.beginPath(); g.arc(128, 160, 46, 0, 7); g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 12; g.stroke();
      g.fillStyle = '#111'; g.font = '800 44px "Barlow Condensed", Arial, sans-serif'; g.fillText('25', 128, 176);
      g.font = '700 22px "Barlow Condensed", Arial, sans-serif'; g.fillText('9:00 – 16:00', 128, 234);
    });
    const signMat = new T.MeshLambertMaterial({ map: signTex, side: T.DoubleSide });
    const b = new KS.Builder();
    const sign = (x, z, ry) => {
      const y = KS.heightAt(x, z);
      b.cyl(x, y, z, 0.06, 3.4, 0x777777, 6);
      const m = new T.Mesh(new T.PlaneGeometry(1.3, 1.3), signMat); m.position.set(x, y + 2.7, z); m.rotation.y = ry; scene.add(m);
      const l = new T.Mesh(new T.SphereGeometry(0.13, 8, 6), lampMat); l.position.set(x, y + 3.5, z); scene.add(l);
    };
    for (const sc of KS.SCHOOLS) {
      if (sc.village) { sign(sc.x1 - 4, KS.HW.z - 9, -Math.PI / 2); sign(sc.x0 + 4, KS.HW.z + 9, Math.PI / 2); continue; }
      const R = W.blockRect(sc.c, sc.r), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      // U-shaped school building, playground, flag
      b.box(cx, 0, R.z0 + 14, 50, 8, 9, 0xf2e6b8); b.box(cx, 3.6, R.z0 + 14, 50.2, 0.5, 9.2, 0x1d4fb8); b.box(cx, 8, R.z0 + 14, 50.8, 0.4, 9.6, 0x9a958a);
      b.box(R.x0 + 12, 0, cz + 4, 9, 8, 30, 0xf2e6b8); b.box(R.x1 - 12, 0, cz + 4, 9, 8, 30, 0xf2e6b8);
      for (let f = 0; f < 2; f++) for (let k = 0; k < 9; k++) b.box(cx - 20 + k * 5, 1.2 + f * 4, R.z0 + 18.55, 2.4, 1.5, 0.1, 0x3b6a9a);
      KS.addBox(cx, R.z0 + 14, 50, 9, 8.4); KS.addBox(R.x0 + 12, cz + 4, 9, 30, 8.4); KS.addBox(R.x1 - 12, cz + 4, 9, 30, 8.4);
      b.box(cx, 0.1, cz + 8, 40, 0.06, 34, 0xa8946c);
      for (const s2 of [-1, 1]) { b.box(cx + s2 * 15, 0.1, cz + 8, 0.12, 2.4, 0.12, 0xf4f4f4); b.box(cx + s2 * 15, 0.1, cz + 11, 0.12, 2.4, 0.12, 0xf4f4f4); b.box(cx + s2 * 15, 2.4, cz + 9.5, 0.12, 0.12, 3.1, 0xf4f4f4); }
      b.cyl(cx - 12, 0.1, cz + 22, 0.1, 9, 0xdddddd, 6); b.box(cx - 11.2, 7, cz + 22, 1.6, 1.1, 0.05, 0xdc143c);
      b.box(cx, 0, R.z1 - 4.4, 50, 1.6, 0.4, 0xd8d0c0); KS.addBox(cx - 15, R.z1 - 4.4, 20, 0.4, 1.6); KS.addBox(cx + 15, R.z1 - 4.4, 20, 0.4, 1.6);
      board(scene, sc.np, sc.name.toUpperCase(), cx, 6.2, R.z0 + 18.7, 0, 13, 1.7, '#1d3a8a');
      KS.plazas.push({ x0: cx - 18, x1: cx + 18, z0: cz - 6, z1: cz + 22, n: 14, kinds: ['kid', 'kid', 'kid', 'student', 'student', 'office'], school: true });
      // warning signs on the pavement at the kerb of each road leading to the school
      const kerb = (i, side) => G.line(i) + side * (G.roadHalf(i) + 1.2);
      sign(kerb(sc.c, 1), R.z0 - 26, 0); sign(kerb(sc.c + 1, -1), R.z1 + 26, Math.PI); sign(R.x0 - 26, kerb(sc.r + 1, -1), Math.PI / 2); sign(R.x1 + 26, kerb(sc.r, 1), -Math.PI / 2);
      KS.landmarks.push({ id: 'school' + sc.c + sc.r, minor: true, name: sc.name, np: sc.np, x: cx, z: cz, r: 30, fact: 'School zone: 25 km/h between 9:00 and 16:00, watched by a speed camera.' });
    }
    scene.add(KS.mesh(b));
  }

  /* ---------- pedestrian-only areas: bollards keep vehicles out, people walk through ---------- */
  KS.noDrive = [];
  function pedZones(scene, W) {
    const b = new KS.Builder();
    const row = (x0, z0, x1, z1) => {
      const L = Math.hypot(x1 - x0, z1 - z0), n = Math.floor(L / 1.55);
      for (let k = 0; k <= n; k++) { const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t, y = KS.heightAt(x, z); b.cyl(x, y, z, 0.13, 0.95, 0x3a3a3a, 8); b.cyl(x, y + 0.75, z, 0.135, 0.12, 0xf2c418, 8); KS.addCircle(x, z, 0.15, y + 0.95).bollard = true; }
    };
    const ring = (x0, z0, x1, z1, name) => { row(x0, z0, x1, z0); row(x1, z0, x1, z1); row(x1, z1, x0, z1); row(x0, z1, x0, z0); KS.noDrive.push({ x0, z0, x1, z1, name }); };
    ring(G.line(4) + 8.6, G.line(6) + 8.6, G.line(5) - 8.6, G.line(8) - 8.6, 'Durbar Square');
    let R = W.blockRect(10, 3); ring(R.x0 + 0.6, R.z0 + 0.6, R.x1 - 0.6, R.z1 - 0.6, 'Boudhanath');
    R = W.blockRect(10, 10); ring(R.x0 + 0.6, R.z0 + 0.6, R.x1 - 0.6, KS.RIVER.z0 - 5, 'Pashupatinath');
    for (const [c, r] of [[6, 5], [6, 6], [8, 3], [2, 9], [1, 1], [8, 1]]) { R = W.blockRect(c, r); ring(R.x0 + 4.4, R.z0 + 4.4, R.x1 - 4.4, R.z1 - 4.4, KS.blockType(c, r) === 'park' ? 'Park' : 'Tundikhel'); }
    R = W.blockRect(6, 7); ring(R.x0 + 4.4, R.z0 + 4.4, R.x1 - 4.4, R.z1 - 4.4, 'Dharahara plaza');
    scene.add(KS.mesh(b, KS.M.vc, false));
    KS.noDriveAt = (x, z) => { for (const n of KS.noDrive) if (x > n.x0 && x < n.x1 && z > n.z0 && z < n.z1) return n; return null; };
  }

  /* ---------- climbable Dharahara (lift to the viewing deck) and stairs up the Boudha platforms ---------- */
  function climbs(scene) {
    const d = KS.dharahara; if (!d) return;
    const b = new KS.Builder();
    // steps up the plinth
    for (let k = 0; k < 4; k++) for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) { const r = 9.6 - k * 0.6, x = d.x + sx * r, z = d.z + sz * r; b.box(x, 0.15, z, sx ? 0.62 : 3.2, 0.3 + k * 0.3, sz ? 0.62 : 3.2, 0xd8d2c4); KS.addBox(x, z, sx ? 0.62 : 3.2, sz ? 0.62 : 3.2, 0.45 + k * 0.3); }
    b.box(d.x, 2.35, d.z + 4.4, 1.8, 2.6, 0.3, 0x3a2a1a); // door
    // viewing deck railing
    const y = d.deck, R = d.deckR;
    for (let k = 0; k < 32; k++) { const a = (k / 32) * Math.PI * 2, x = d.x + Math.sin(a) * R, z = d.z + Math.cos(a) * R; b.box(x, y, z, 0.08, 1.1, 0.08, 0x9a9a9a); KS.addCircle(x, z, 0.5, y + 1.1, y - 0.2); }
    const rail = new T.Mesh(new T.TorusGeometry(R, 0.05, 6, 48), new T.MeshLambertMaterial({ color: 0xb0b0b0 })); rail.rotation.x = Math.PI / 2; rail.position.set(d.x, y + 1.1, d.z); scene.add(rail);
    scene.add(KS.mesh(b));
    // a sign by the door
    const ls = new T.Mesh(new T.PlaneGeometry(1.6, 0.5), new T.MeshBasicMaterial({ map: KS.tex(256, 80, (g, w, h) => { g.fillStyle = '#1d3a8a'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '700 34px "Barlow Condensed", Arial, sans-serif'; g.fillText('▲ LIFT · लिफ्ट', w / 2, 52); }) }));
    ls.position.set(d.x, 5.25, d.z + 4.56); scene.add(ls);
    KS.lifts = [{ x: d.x, z: d.z + 5.2, y: 2.35, to: { x: d.x, z: d.z + (d.room + R) / 2, y: y }, label: 'Take the lift up Dharahara' }, { x: d.x, z: d.z + (d.room + R) / 2, y, to: { x: d.x, z: d.z + 6.4, y: 0.6 }, label: 'Take the lift down' }];
    // Boudha: stairs on the four sides of the mandala platform
    const bo = KS.landmarks.find((l) => l.id === 'boudha');
    if (bo) {
      const s2 = new KS.Builder();
      for (const [sx, sz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) for (let k = 0; k < 9; k++) {
        const dist = 37.6 - k * 0.9, x = bo.x + sx * dist, z = bo.z + sz * dist, h = 0.15 + (k + 1) * 0.47;
        s2.box(x, 0.15, z, sx ? 0.92 : 4, h - 0.15, sz ? 0.92 : 4, 0xeae6dc); KS.addBox(x, z, sx ? 0.92 : 4, sz ? 0.92 : 4, h);
      }
      scene.add(KS.mesh(s2));
    }
  }

  X.build = (scene, W) => {
    schools(scene, W); pedZones(scene, W); climbs(scene);
    highway(scene); village(scene, W); parks(scene, W); trafficControl(scene); trialGround(scene, W);
    // police office at Hanuman Dhoka, where arrested drivers end up
    board(scene, 'महानगरीय प्रहरी कार्यालय', 'METROPOLITAN POLICE OFFICE', -106.45, 5.4, 82, -Math.PI / 2, 7, 1.4, '#1d3a8a');
    KS.policeStation = { x: -113, z: 80 };
  };
})();
