/* Kathmandu Streets — landmarks: Durbar Square, Boudha, Swayambhu, Pashupati, Dharahara, Rani Pokhari, palaces, stadium, airport. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G, P = KS.palette;
  const L = (KS.Landmarks = {});
  KS.landmarks = [];
  KS.prayerWheels = []; KS.bells = []; KS.pigeonSpots = []; KS.monkeySpots = []; KS.sitSpots = [];
  KS.koras = []; KS.plazas = []; KS.clockHands = []; KS.noRoad = [];
  const add = (o) => KS.landmarks.push(o);

  /* ---------- helpers ---------- */
  function plinth(b, x, z, w, steps, sh, color, shrink = 1.6, y0 = 0, d) {
    let y = y0;
    for (let i = 0; i < steps; i++) {
      const sw = w - i * shrink, sd = (d || w) - i * shrink;
      b.box(x, y, z, sw, sh, sd, i % 2 ? color : new T.Color(color).multiplyScalar(0.9).getHex());
      KS.addBox(x, z, sw, sd, y + sh);
      y += sh;
    }
    return y;
  }
  /** Newari pagoda: brick walls, tiered flared roofs, wooden struts, golden pinnacle */
  function pagoda(b, x, y, z, w, tiers, o = {}) {
    const roofC = o.roof || P.roofTile, wallC = o.wall || P.brick;
    let wall = w, cy = y;
    for (let t = 0; t < tiers; t++) {
      const wh = t === 0 ? o.h0 || 4.2 : 2.6;
      b.box(x, cy, z, wall, wh, wall, wallC);
      if (t === 0) for (let s = 0; s < 4; s++) { // carved doors on each side
        const a = (s * Math.PI) / 2, fx = Math.sin(a), fz = Math.cos(a);
        b.box(x + fx * wall / 2, cy, z + fz * wall / 2, wall * 0.42, wh * 0.72, 0.25, P.wood, a);
        b.box(x + fx * (wall / 2 + 0.05), cy + wh * 0.72, z + fz * (wall / 2 + 0.05), wall * 0.6, 0.35, 0.3, P.gold, a);
      }
      cy += wh;
      const rw = wall * (o.overhang || 1.85), rh = rw * 0.24;
      // struts
      for (let s = 0; s < 4; s++) { const a = (s * Math.PI) / 2; b.box(x + Math.sin(a) * (wall / 2 + 0.6), cy - 1.6, z + Math.cos(a) * (wall / 2 + 0.6), wall * 0.8, 1.6, 0.18, P.woodLight, a, 0, 0); }
      b.roof(x, cy - 0.35, z, rw, rh, roofC, 0.28);
      b.box(x, cy - 0.45, z, rw * 0.98, 0.12, rw * 0.98, o.trim || 0x3a2a1a); // eave edge
      cy += rh * 0.72;
      wall *= 0.68;
    }
    b.cyl(x, cy - 0.4, z, Math.max(0.5, wall * 0.25), 0.8, P.gold, 8);
    b.cyl(x, cy + 0.4, z, Math.max(0.35, wall * 0.18), 2.6, P.gold, 8, 0.12);
    b.sphere(x, cy + 1.2, z, Math.max(0.4, wall * 0.2), P.gold, 1, 8);
    KS.addBox(x, z, w, w, cy + 3);
    KS.bells.push([x, z]);
    return cy;
  }
  function eyesTexture() {
    return KS.tex(256, 256, (g, w, h) => {
      g.fillStyle = '#e7c35a'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#f6f1e4'; g.fillRect(0, 40, w, 200);
      g.lineCap = 'round';
      for (const sx of [-1, 1]) {
        const cx = w / 2 + sx * 62, cy = 120;
        g.strokeStyle = '#111'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(cx - 46, cy - 34); g.quadraticCurveTo(cx, cy - 58, cx + 46, cy - 34); g.stroke(); // brow
        g.fillStyle = '#fff'; g.beginPath(); g.moveTo(cx - 42, cy); g.quadraticCurveTo(cx, cy - 34, cx + 42, cy); g.quadraticCurveTo(cx, cy + 22, cx - 42, cy); g.fill();
        g.lineWidth = 5; g.stroke();
        g.fillStyle = '#2a5fb0'; g.beginPath(); g.arc(cx + sx * 4, cy - 6, 13, 0, 7); g.fill();
        g.fillStyle = '#111'; g.beginPath(); g.arc(cx + sx * 4, cy - 6, 6, 0, 7); g.fill();
      }
      // stylised curl between the eyes
      g.strokeStyle = '#b3121b'; g.lineWidth = 8; g.beginPath(); g.arc(w / 2, 150, 14, Math.PI * 1.1, Math.PI * 2.2); g.lineTo(w / 2, 200); g.stroke();
      g.fillStyle = '#b3121b'; g.beginPath(); g.arc(w / 2, 82, 7, 0, 7); g.fill();
    });
  }
  let eyesMat;
  function stupa(scene, b, x, y, z, R, o = {}) {
    b.cyl(x, y, z, R * 1.12, 1.4, P.white, 28);
    b.cyl(x, y + 1.4, z, R * 1.04, 1.0, P.white, 28);
    b.sphere(x, y + 2.2, z, R, P.white, 0.78, 26, true);
    // saffron paint arcs over the dome
    for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI * 2; b.box(x + Math.sin(a) * R * 0.55, y + 2.2 + R * 0.55, z + Math.cos(a) * R * 0.55, 0.5, R * 0.3, 0.3, 0xe8a23a, a, 0.7); }
    const hy = y + 2.2 + R * 0.78 - 0.4, hs = R * 0.42;
    b.box(x, hy, z, hs, hs * 0.85, hs, 0xe7c35a);
    // eyes on 4 sides
    if (!eyesMat) eyesMat = new T.MeshLambertMaterial({ map: eyesTexture() });
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2, pl = new T.Mesh(new T.PlaneGeometry(hs * 0.98, hs * 0.8), eyesMat);
      pl.position.set(x + Math.sin(a) * (hs / 2 + 0.03), hy + hs * 0.42, z + Math.cos(a) * (hs / 2 + 0.03)); pl.rotation.y = a; scene.add(pl);
    }
    let sy = hy + hs * 0.85, sw = hs * 0.92;
    b.box(x, sy, z, hs * 1.15, 0.5, hs * 1.15, P.goldDark); sy += 0.5;
    for (let i = 0; i < 13; i++) { const th = R * 0.075; b.box(x, sy, z, sw, th * 0.85, sw, i % 2 ? P.gold : P.goldDark); sy += th; sw *= 0.9; }
    b.cyl(x, sy, z, sw * 1.4, 0.6, P.gold, 12, 0.5); sy += 0.6;
    b.cyl(x, sy, z, sw * 0.4, R * 0.3, P.gold, 8, 0.2); sy += R * 0.3;
    b.sphere(x, sy, z, sw * 0.3, P.gold, 1, 8);
    KS.addCircle(x, z, R * 1.12, y + R * 1.5);
    return sy;
  }
  function textBoard(scene, text, x, y, z, ry, w = 8, h = 1.6, bg = '#7a1414', fg = '#ffe9a8') {
    const t = KS.tex(512, 104, (g, W, H) => { g.fillStyle = bg; g.fillRect(0, 0, W, H); g.fillStyle = fg; g.font = `700 54px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(text, W / 2, H / 2 + 4); });
    const m = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ map: t })); m.position.set(x, y, z); m.rotation.y = ry; scene.add(m);
  }
  function brickPaving(scene, x0, x1, z0, z1, y = 0.15, tint = '#a5553c') {
    const t = KS.tex(128, 128, (g, w, h) => {
      g.fillStyle = '#6a2f20'; g.fillRect(0, 0, w, h);
      for (let yy = 0; yy < h; yy += 8) for (let xx = (yy / 8) % 2 ? -8 : 0; xx < w; xx += 16) { g.fillStyle = tint; g.globalAlpha = KS.r(0.75, 1); g.fillRect(xx + 1, yy + 1, 14, 6); }
      g.globalAlpha = 1;
    }, true);
    t.repeat.set((x1 - x0) / 6, (z1 - z0) / 6);
    const m = new T.Mesh(new T.PlaneGeometry(x1 - x0, z1 - z0).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: t, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }));
    m.position.set((x0 + x1) / 2, y, (z0 + z1) / 2); m.receiveShadow = true; scene.add(m);
    KS.addBox((x0 + x1) / 2, (z0 + z1) / 2, x1 - x0, z1 - z0, y, -1);
  }
  function grass(b, x0, x1, z0, z1, y = 0.12, c = 0x6f9a48) { b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, y, z1 - z0, c); }
  function wall(b, x0, x1, z0, z1, h, c, gap) {
    const t = 0.6;
    b.box((x0 + x1) / 2, 0, z0, x1 - x0, h, t, c); KS.addBox((x0 + x1) / 2, z0, x1 - x0, t, h);
    if (gap) { const gw = gap; const l = (x1 - x0 - gw) / 2; b.box(x0 + l / 2, 0, z1, l, h, t, c); b.box(x1 - l / 2, 0, z1, l, h, t, c); KS.addBox(x0 + l / 2, z1, l, t, h); KS.addBox(x1 - l / 2, z1, l, t, h); }
    else { b.box((x0 + x1) / 2, 0, z1, x1 - x0, h, t, c); KS.addBox((x0 + x1) / 2, z1, x1 - x0, t, h); }
    b.box(x0, 0, (z0 + z1) / 2, t, h, z1 - z0, c); KS.addBox(x0, (z0 + z1) / 2, t, z1 - z0, h);
    b.box(x1, 0, (z0 + z1) / 2, t, h, z1 - z0, c); KS.addBox(x1, (z0 + z1) / 2, t, z1 - z0, h);
  }
  function columns(b, x0, x1, z, y, h, n, c = 0xf7f4ec) { for (let i = 0; i < n; i++) { const x = x0 + ((x1 - x0) * i) / (n - 1); b.cyl(x, y, z, 0.45, h, c, 10); } }
  function wheels(b, cx, cz, r, n, y) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
      b.cyl(x, y + 0.4, z, 0.32, 0.9, 0xc9a23a, 10); b.cyl(x, y + 1.3, z, 0.07, 0.25, 0x444444, 4);
      KS.prayerWheels.push([x, z]);
    }
  }

  /* ================= Basantapur Durbar Square ================= */
  function durbar(scene, W) {
    const x0 = G.line(4) + 8, x1 = G.line(5) - 8, z0 = G.line(6) + 8, z1 = G.line(8) - 8;
    brickPaving(scene, x0 - 4, x1 + 4, z0 - 4, z1 + 4);
    KS.noRoad.push(['h', 7, 4]); // road segment z=line(7) from col 4 to 5 is pedestrian plaza
    KS.plazas.push({ x0: x0 + 2, x1: x1 - 2, z0: z0 + 2, z1: z1 - 2, n: 26 });
    const b = new KS.Builder();
    // Taleju temple — tallest, on a 12-step plinth
    let y = plinth(b, -112, 26, 22, 9, 0.9, 0x8c4a34, 1.4);
    pagoda(b, -112, y, 26, 8.5, 3, { roof: P.gold, overhang: 1.75 });
    // Maju Dega — 9 stepped plinth where people sit
    y = plinth(b, -142, 112, 18, 9, 0.75, 0x9a5a40, 1.3);
    pagoda(b, -142, y, 112, 6.5, 3, {});
    for (let i = 0; i < 9; i++) KS.sitSpots.push([-142 + KS.r(-7, 7), 112 + 9 - i * 0.6, 0.75 * (i % 5 + 1)]);
    // Trailokya Mohan Narayan
    y = plinth(b, -160, 92, 13, 5, 0.8, 0x8c4a34, 1.2);
    pagoda(b, -160, y, 92, 5.5, 3, {});
    // Kasthamandap — wide 3-tier pavilion
    y = plinth(b, -158, 152, 22, 2, 0.7, 0x8c4a34, 1.5);
    b.box(-158, y, 152, 17, 4, 17, P.brick);
    for (let i = -2; i <= 2; i++) for (const s of [-1, 1]) { b.cyl(-158 + i * 3.6, y, 152 + s * 8.4, 0.35, 4, P.wood, 6); b.cyl(-158 + s * 8.4, y, 152 + i * 3.6, 0.35, 4, P.wood, 6); }
    pagoda(b, -158, y + 4, 152, 15, 3, { h0: 2.6, overhang: 1.45 });
    // Shiva-Parvati temple: rectangular house temple
    y = plinth(b, -128, 92, 16, 2, 0.8, 0x8c4a34, 1.2, 0, 12);
    b.box(-128, y, 92, 12, 6, 8, P.brick);
    for (let i = -2; i <= 2; i++) b.box(-128 + i * 2.3, y + 3.2, 96.05, 1.4, 1.6, 0.2, P.wood);
    b.roof(-128, y + 6, 92, 14, 2.6, P.roofTile, 0.4);
    KS.addBox(-128, 92, 12, 8, y + 9);
    // Kumari Ghar — house of the living goddess: brick + carved windows
    b.box(-108, 0, 132, 18, 10.5, 16, P.brick);
    for (let f = 0; f < 3; f++) for (let i = -2; i <= 2; i++) b.box(-117.1, 1.8 + f * 3.2, 132 + i * 3, 0.3, 1.9, 1.8, P.wood);
    b.box(-117.2, 0, 132, 0.4, 2.6, 2.2, 0x2a1a10); // door
    b.box(-118, 0, 129, 2.4, 1.6, 1.4, P.white); b.box(-118, 0, 135, 2.4, 1.6, 1.4, P.white); // stone lions
    b.roof(-108, 10.5, 132, 20, 2.4, P.roofTile, 0.6);
    KS.addBox(-108, 132, 18, 16, 13);
    textBoard(scene, 'कुमारी घर', -117.4, 11.4, 132, -Math.PI / 2, 6, 1.1);
    // Gaddi Baithak — white neoclassical wing
    b.box(-122, 0, 64, 26, 10, 10, P.white);
    columns(b, -133, -111, 58.6, 0.6, 8, 8);
    b.box(-122, 9, 58.4, 26, 1, 1.6, 0xe6e0d2);
    b.box(-122, 10, 64, 27, 0.8, 11, 0xd2cbbb);
    KS.addBox(-122, 64, 26, 10, 10.8);
    // Basantapur tower (Nautalle) and Hanuman Dhoka palace along the east side
    b.box(-104, 0, 48, 10, 18, 10, P.brick);
    for (let f = 1; f < 6; f++) for (const s of [-1, 1]) b.box(-104 + s * 5.05, f * 3, 48, 0.2, 1.8, 6, P.wood);
    pagoda(b, -104, 18, 48, 9, 4, { h0: 2.6, overhang: 1.5 });
    b.box(-103, 0, 80, 6, 9, 40, P.brick); KS.addBox(-103, 80, 6, 40, 11);
    for (let i = 0; i < 6; i++) b.box(-106.1, 3, 64 + i * 6, 0.3, 2, 2.6, P.wood);
    b.roof(-103, 9, 80, 9, 2, P.roofTile, 0.5);
    b.box(-106.2, 0, 72, 0.4, 3.6, 3, P.gold); // Golden gate of Hanuman Dhoka
    b.box(-107.5, 0, 76.5, 1.2, 2.2, 1.2, 0xc81e1e); // Hanuman statue (red cloak, umbrella)
    b.cyl(-107.5, 2.2, 76.5, 1.1, 0.5, 0xd12b2b, 8, 0.1); KS.addBox(-107.5, 76.5, 1.2, 1.2, 2.4);
    // Kal Bhairav relief
    b.box(-150, 0, 40, 4, 1, 2, 0x5a5048); b.box(-150, 1, 40, 3, 4.5, 1.2, 0x23211f); b.box(-150, 3.8, 40.62, 1.6, 1.4, 0.05, 0xf2c418);
    KS.addBox(-150, 40, 4, 2, 5.5);
    // Basantapur Dabali: handicraft sellers' mats with bowls, masks, beads
    for (let i = 0; i < 16; i++) {
      const x = KS.r(-170, -132), z = KS.r(8, 30);
      b.box(x, 0.16, z, 2.4, 0.04, 1.6, KS.pick([0xb3121b, 0x1d4fb8, 0x6d1a8a, 0x178a43]));
      for (let k = 0; k < 6; k++) b.cyl(x + KS.r(-1, 1), 0.2, z + KS.r(-0.6, 0.6), 0.2, 0.18, KS.pick([0xc9a23a, 0x9a7020, 0x333333, 0xb33]), 8, 0.6);
    }
    // little shrines & bell
    W.smallShrine(b, -165, 60, false); W.smallShrine(b, -132, 40, true);
    b.box(-126.5, 0, 22, 0.4, 5, 0.4, 0x222222); b.box(-129.5, 0, 22, 0.4, 5, 0.4, 0x222222); b.box(-128, 5, 22, 3.6, 0.4, 0.5, 0x222222); b.cyl(-128, 3.2, 22, 0.8, 1.7, 0x6b5a2a, 10, 0.6);
    KS.addBox(-128, 22, 3.6, 0.6, 5.4); KS.bells.push([-128, 22]);
    scene.add(KS.mesh(b));
    KS.pigeonSpots.push([-140, 20, 40], [-130, 130, 26], [-150, 70, 22]);
    for (let i = 0; i < 8; i++) KS.sitSpots.push([-112 + KS.r(-9, 9), 26 + 11 - i * 0.2, 0.9 * KS.ri(1, 5)]);
    add({ id: 'durbar', name: 'Basantapur Durbar Square', np: 'बसन्तपुर दरबार क्षेत्र', x: -135, z: 90, r: 45, fact: 'Royal square of the Malla and Shah kings, full of pagoda temples. A UNESCO World Heritage Site.' });
    add({ minor: true, id: 'kasthamandap', name: 'Kasthamandap', np: 'काष्ठमण्डप', x: -158, z: 152, r: 16, fact: 'The wooden pavilion that legend says gave Kathmandu its name. Rebuilt after the 2015 earthquake.' });
    add({ minor: true, id: 'kumari', name: 'Kumari Ghar', np: 'कुमारी घर', x: -110, z: 132, r: 14, fact: 'Home of the Kumari, the living goddess, with some of the finest carved windows in the city.' });
  }

  /* ================= Boudhanath ================= */
  function boudha(scene, W) {
    const cx = (G.line(10) + G.line(11)) / 2, cz = (G.line(3) + G.line(4)) / 2;
    const R = W.blockRect(10, 3);
    brickPaving(scene, R.x0, R.x1, R.z0, R.z1, 0.15, '#b9a58a');
    const b = new KS.Builder();
    let y = 0.15;
    for (const [s, h] of [[60, 1.4], [50, 1.4], [42, 1.4]]) {
      b.box(cx, y, cz, s, h, s, P.white); b.box(cx, y, cz, s * 0.78, h, s * 1.12, P.white); b.box(cx, y, cz, s * 1.12, h, s * 0.78, P.white);
      b.box(cx, y + h - 0.1, cz, s + 0.4, 0.2, s + 0.4, 0xd7d0c2);
      KS.addBox(cx, cz, s * 0.78, s * 1.12, y + h); KS.addBox(cx, cz, s * 1.12, s * 0.78, y + h); KS.addBox(cx, cz, s, s, y + h);
      y += h;
    }
    const top = stupa(scene, b, cx, y, cz, 17);
    wheels(b, cx, cz, 34.5, 72, 0.15);
    // prayer flags from the spire to the platform
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      KS.World.flags([cx, top - 6, cz], [cx + Math.sin(a) * 31, 2.6, cz + Math.cos(a) * 31], 3, 1.1);
    }
    // monastery (gompa) on a corner: white walls, maroon band, golden roof
    b.box(R.x1 - 9, 0, R.z1 - 9, 14, 9, 12, P.white); b.box(R.x1 - 9, 7.4, R.z1 - 9, 14.2, 1.6, 12.2, P.maroon);
    b.roof(R.x1 - 9, 9, R.z1 - 9, 16, 3, P.gold, 0.45); KS.addBox(R.x1 - 9, R.z1 - 9, 14, 12, 12);
    // ring of houses on the other corners
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1]]) {
      const hx = cx + sx * 33, hz = cz + sz * 33;
      W.addBuilding(hx, hz, 8, 8, KS.ri(4, 5), KS.ri(0, 1), Math.atan2(sx, sz) + Math.PI, KS.pick(P.walls), 'thamel');
    }
    scene.add(KS.mesh(b));
    KS.koras.push({ x: cx, z: cz, r0: 32, r1: 36, n: 34, kinds: ['monk', 'monk', 'woman', 'man', 'tourist', 'elder'] });
    KS.pigeonSpots.push([cx, cz + 34, 30]);
    add({ id: 'boudha', name: 'Boudhanath Stupa', np: 'बौद्धनाथ स्तूप', x: cx, z: cz, r: 40, fact: 'One of the largest stupas in the world. Walk clockwise with the pilgrims and spin the prayer wheels.' });
  }

  /* ================= Swayambhunath ================= */
  function swayambhu(scene, W) {
    const s = KS.SWAYAMBHU, b = new KS.Builder();
    const y0 = s.top;
    b.box(s.x, y0 - 0.5, s.z, 48, 0.7, 48, 0xa49a88);
    KS.addBox(s.x, s.z, 48, 48, y0 + 0.2, y0 - 3);
    const top = stupa(scene, b, s.x, y0 + 0.2, s.z, 9.5);
    wheels(b, s.x, s.z, 13.6, 40, y0 + 0.2);
    b.cyl(s.x, y0 + 0.2, s.z - 17.5, 1.4, 0.5, P.gold, 12); // vajra platform
    b.box(s.x, y0 + 0.7, s.z - 17.5, 3, 0.7, 0.7, P.gold);
    // twin white shikharas
    for (const sx of [-1, 1]) {
      const x = s.x + sx * 8, z = s.z - 14;
      b.box(x, y0 + 0.2, z, 4, 3, 4, P.white); b.cyl(x, y0 + 3.2, z, 2.2, 7, P.white, 8, 0.25); b.cyl(x, y0 + 10.2, z, 0.4, 1.6, P.gold, 6, 0.1);
      KS.addBox(x, z, 4, 4, y0 + 12);
    }
    // shrines, monastery and butter-lamp houses around the platform
    W.smallShrine(b, s.x + 17, s.z + 16, true); W.smallShrine(b, s.x - 17, s.z + 16, false);
    b.box(s.x - 17, y0 - 0.2, s.z - 4, 9, 7, 12, P.white); b.box(s.x - 17, y0 + 5.6, s.z - 4, 9.2, 1.2, 12.2, P.maroon); b.roof(s.x - 17, y0 + 6.8, s.z - 4, 11, 2.6, P.gold, 0.4);
    KS.addBox(s.x - 17, s.z - 4, 9, 12, y0 + 9.5);
    // long stairway down the south slope
    for (let z = s.z + 24; z < s.z + 150; z += 1.6) {
      const h = KS.heightAt(s.x, z); b.box(s.x, h - 0.6, z, 5, 0.75, 1.7, 0x8f887a);
      if (Math.floor(z) % 12 < 2) { b.box(s.x - 3.2, h, z, 0.4, 1.6, 0.4, 0x6b6458); b.box(s.x + 3.2, h, z, 0.4, 1.6, 0.4, 0x6b6458); }
    }
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      KS.World.flags([s.x, top - 3, s.z], [s.x + Math.sin(a) * 23, y0 + 2.5, s.z + Math.cos(a) * 23], 2.2, 1.0);
    }
    scene.add(KS.mesh(b));
    KS.monkeySpots.push([s.x, s.z, 20, y0 + 0.2], [s.x + 4, s.z + 60, 18, null]);
    KS.koras.push({ x: s.x, z: s.z, r0: 15, r1: 18, n: 12, y: y0 + 0.2, kinds: ['monk', 'tourist', 'woman', 'elder'] });
    add({ id: 'swayambhu', name: 'Swayambhunath', np: 'स्वयम्भूनाथ', x: s.x, z: s.z, r: 34, fact: 'The "Monkey Temple": a hilltop stupa more than 1,500 years old, watching over the whole valley.' });
  }

  /* ================= Pashupatinath & Bagmati ghats ================= */
  function pashupati(scene, W) {
    const R = W.blockRect(10, 10), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2 + 4;
    brickPaving(scene, R.x0, R.x1, R.z0, KS.RIVER.z0 - 4, 0.15, '#9a9184');
    KS.noRoad.push(['h', 11, 10]);
    const b = new KS.Builder();
    wall(b, cx - 24, cx + 24, cz - 26, cz + 22, 3.2, 0xe7e1d3, 8);
    let y = plinth(b, cx, cz, 22, 2, 0.8, 0x9a9184, 1.6);
    b.box(cx, y, cz, 11, 5.2, 11, 0xe9e2d0);
    for (let s = 0; s < 4; s++) { const a = (s * Math.PI) / 2; b.box(cx + Math.sin(a) * 5.55, y, cz + Math.cos(a) * 5.55, 3.4, 3.8, 0.2, 0xc8ccd0, a); } // silver doors
    y += 5.2;
    b.roof(cx, y - 0.4, cz, 20, 4.6, P.gold, 0.32); b.box(cx, y + 3, cz, 7, 2.6, 7, 0xe9e2d0); b.roof(cx, y + 5.4, cz, 12, 3, P.gold, 0.25);
    b.cyl(cx, y + 8.2, cz, 0.6, 3.4, P.gold, 8, 0.15);
    KS.addBox(cx, cz, 11, 11, y + 12); KS.bells.push([cx, cz]);
    // golden Nandi bull at the west door
    b.box(cx - 15, 0.15, cz, 3, 1.2, 1.6, 0x5a5048); b.box(cx - 15, 1.35, cz, 2.6, 1.3, 1.1, P.gold); b.box(cx - 13.6, 2.2, cz, 0.9, 0.9, 0.8, P.gold);
    KS.addBox(cx - 15, cz, 3, 1.6, 3.2);
    // ghats: stone steps into the Bagmati
    const gz0 = KS.RIVER.z0 - 6;
    for (let i = 0; i < 6; i++) { const yy = 0.15 - i * 0.42, zz = gz0 + i * 1.6; b.box(cx, yy - 0.42, zz, 70, 0.42, 1.7, i % 2 ? 0x8f887a : 0x9e978a); KS.addBox(cx, zz, 70, 1.7, yy, -4); }
    for (let i = 0; i < 4; i++) { b.box(cx - 24 + i * 16, 0.15, gz0 - 3, 5, 0.6, 3.4, 0x7d776c); } // cremation platforms (aryaghat)
    // row of small white shrines along the bank
    for (let i = 0; i < 11; i++) { const x = R.x0 + 4 + i * 6.6, z = R.z0 + 6; b.box(x, 0.15, z, 3.2, 2.6, 3.2, P.white); b.cyl(x, 2.75, z, 1.4, 3, P.white, 6, 0.2); b.cyl(x, 5.7, z, 0.2, 0.9, P.gold, 5, 0.1); KS.addBox(x, z, 3.2, 3.2, 6.5); }
    // trees of the Mrigasthali forest
    for (let i = 0; i < 10; i++) KS.World.tree(KS.r(cx + 27, R.x1 - 2), KS.r(R.z0 + 10, R.z1 - 6), KS.r(7, 11));
    scene.add(KS.mesh(b));
    KS.firePits = [[cx - 24, gz0 - 3], [cx - 8, gz0 - 3], [cx + 8, gz0 - 3]];
    KS.monkeySpots.push([cx + 14, cz - 16, 14, null]);
    for (let i = 0; i < 6; i++) KS.sitSpots.push([cx + KS.r(-30, 30), gz0 + 0.6, 0.15, 'sadhu']);
    KS.plazas.push({ x0: R.x0 + 2, x1: R.x1 - 2, z0: cz + 22, z1: gz0 - 1, n: 10, kinds: ['woman', 'elder', 'man', 'sadhu'] });
    add({ id: 'pashupati', name: 'Pashupatinath Temple', np: 'पशुपतिनाथ मन्दिर', x: cx, z: cz, r: 32, fact: 'The most sacred Hindu temple of Lord Shiva in Nepal, on the banks of the holy Bagmati.' });
  }

  /* ================= Dharahara & Sundhara ================= */
  function dharahara(scene, W) {
    const R = W.blockRect(6, 7), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    brickPaving(scene, R.x0 + 4, R.x1 - 4, R.z0 + 4, R.z1 - 4, 0.15, '#bdb3a2');
    const b = new KS.Builder();
    b.cyl(cx, 0.15, cz, 9, 1.2, 0xd8d2c4, 8); b.cyl(cx, 1.35, cz, 6.5, 1, 0xe8e2d6, 8);
    let y = 2.35, r = 4.6;
    for (let i = 0; i < 11; i++) { b.cyl(cx, y, cz, r, 5.6, P.white, 8, 0.97); y += 5.6; r *= 0.97; if (i % 3 === 2) b.cyl(cx, y - 0.3, cz, r + 0.9, 0.5, 0xd9d3c6, 8); }
    b.cyl(cx, y, cz, r + 1.8, 0.8, 0xd9d3c6, 8); b.cyl(cx, y + 0.8, cz, r + 0.6, 4, 0xeeeeee, 8); // observation deck
    b.roof(cx, y + 4.8, cz, (r + 2.6) * 1.4, 3, P.gold, 0.3);
    b.cyl(cx, y + 7.4, cz, 0.7, 6, P.gold, 8, 0.12);
    // walkable: plinth, tower body up to the deck, the deck ring, the glass room on top
    KS.addCircle(cx, cz, 9, 1.35); KS.addCircle(cx, cz, 6.5, 2.35); KS.addCircle(cx, cz, 4.7, y + 0.8);
    KS.addCircle(cx, cz, r + 1.8, y + 0.8, y - 1); KS.addCircle(cx, cz, r + 0.6, y + 12, y + 0.8);
    KS.dharahara = { x: cx, z: cz, deck: y + 0.8, deckR: r + 1.7, room: r + 0.6 };
    // stump of the old tower
    b.cyl(cx + 22, 0.15, cz + 18, 3.2, 6, 0xe4dccc, 8, 0.95); KS.addCircle(cx + 22, cz + 18, 3.2, 6.2);
    // Sundhara stone water spout: sunken pit with a golden spout
    b.box(cx - 22, -2, cz + 20, 10, 2.1, 10, 0x6b6458); b.box(cx - 22, 0, cz + 15.6, 1, 0.8, 1, P.gold);
    b.box(cx - 22, -1.95, cz + 20, 8, 0.1, 8, 0x4a6b6a);
    scene.add(KS.mesh(b));
    KS.dharaharaTop = y + 0.8;
    KS.plazas.push({ x0: R.x0 + 6, x1: R.x1 - 6, z0: R.z0 + 6, z1: R.z1 - 6, n: 12 });
    add({ id: 'dharahara', name: 'Dharahara', np: 'धरहरा', x: cx, z: cz, r: 22, fact: 'The rebuilt Dharahara tower. The original, built in 1832, fell in the 2015 earthquake.' });
  }

  /* ================= Rani Pokhari & Ghantaghar ================= */
  function ranipokhari(scene, W) {
    const R = W.blockRect(6, 4), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2 + 2, S = 46;
    const b = new KS.Builder();
    // lawn round the pond (not over it), and a sunken basin so the water shows
    const h2 = S / 2 + 0.5;
    grass(b, R.x0 + 4, R.x1 - 4, R.z0 + 4, cz - h2); grass(b, R.x0 + 4, R.x1 - 4, cz + h2, R.z1 - 4);
    grass(b, R.x0 + 4, cx - h2, cz - h2, cz + h2); grass(b, cx + h2, R.x1 - 4, cz - h2, cz + h2);
    b.box(cx, -1.6, cz, S, 0.1, S, 0x2e4a42);
    const pond = new T.Mesh(new T.PlaneGeometry(S - 1, S - 1).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ color: 0x4f7f7a, transparent: true, opacity: 0.9 }));
    pond.position.set(cx, -0.5, cz); scene.add(pond);
    // railing all round, with a gate on the south side onto the causeway
    const G2 = 1.9, half = (S + 1) / 2, sw = half - G2;
    for (const [dx, dz, w, d] of [[0, -S / 2, S + 1, 1], [-G2 - sw / 2, S / 2, sw, 1], [G2 + sw / 2, S / 2, sw, 1], [-S / 2, 0, 1, S + 1], [S / 2, 0, 1, S + 1]]) b.box(cx + dx, -1.6, cz + dz, w, 2.4, d, 0xcfc8b8);
    b.box(cx, -1.6, cz + S / 2, G2 * 2, 1.9, 1, 0xcfc8b8); // the gate threshold sits level with the causeway
    KS.addBox(cx, cz - S / 2, S + 1, 1, 1.6, -3); KS.addBox(cx - S / 2, cz, 1, S + 1, 1.6, -3); KS.addBox(cx + S / 2, cz, 1, S + 1, 1.6, -3);
    KS.addBox(cx - G2 - sw / 2, cz + S / 2, sw, 1, 1.6, -3); KS.addBox(cx + G2 + sw / 2, cz + S / 2, sw, 1, 1.6, -3);
    for (let i = 0; i < 40; i++) { const t = i / 40; for (const [px, pz, south] of [[cx - S / 2 + S * t, cz - S / 2], [cx - S / 2 + S * t, cz + S / 2, true], [cx - S / 2, cz - S / 2 + S * t], [cx + S / 2, cz - S / 2 + S * t]]) if (!(south && Math.abs(px - cx) < G2)) b.box(px, 0.8, pz, 0.1, 0.9, 0.1, 0x223322); }
    for (const sx of [-1, 1]) { b.box(cx + sx * G2, 0.8, cz + S / 2, 0.35, 1.6, 0.35, 0xcfc8b8); b.sphere(cx + sx * G2, 2.5, cz + S / 2, 0.25, P.gold, 1, 8); } // gate posts
    // low rails along the causeway and round the island, so you do not walk on water (gap at the boat jetty)
    for (const sx of [-1, 1]) { b.box(cx + sx * 1.65, 0.05, cz + S / 4 + 3, 0.1, 0.8, S / 2 - 6, 0x8a7a5a); KS.addBox(cx + sx * 1.65, cz + S / 4 + 3, 0.15, S / 2 - 6, 1.3, -2); }
    for (const [dx, dz, w, d] of [[0, -5.1, 10.2, 0.15], [-5.1, 0, 0.15, 10.2], [5.1, 0, 0.15, 10.2]]) { b.box(cx + dx, 0.05, cz + dz, w, 0.8, d, 0x8a7a5a); KS.addBox(cx + dx, cz + dz, w, d, 1.3, -2); }
    for (const sx of [-1, 1]) { b.box(cx + sx * 3.4, 0.05, cz + 5.1, 3.4, 0.8, 0.15, 0x8a7a5a); KS.addBox(cx + sx * 3.4, cz + 5.1, 3.4, 0.15, 1.3, -2); }
    // boat jetty: wooden landing beside the causeway, near the gate
    const jz = cz + S / 2 - 5;
    b.box(cx + 2.9, -0.25, jz, 2.6, 0.3, 3.2, 0x7a5a3a); KS.addBox(cx + 2.9, jz, 2.6, 3.2, 0.05, -2);
    b.box(cx + 4.3, -0.25, jz, 0.1, 1.2, 3.2, 0x5a4026); KS.addBox(cx + 4.25, jz, 0.15, 3.2, 1.3, -2);
    KS.pond = { cx, cz, S, y: -0.5, jetty: { x: cx + 2.6, z: jz }, island: 6.6, causeway: 2.4 };
    KS.pondBoats = [];
    const boatCols = [0xc81e1e, 0x1d4fb8, 0xf2c418];
    for (let k = 0; k < 3; k++) {
      const g = new T.Group(), hb = new KS.Builder(), col = boatCols[k];
      hb.box(0, 0, 0, 1.3, 0.35, 2.6, col); hb.box(0, 0, 1.55, 0.8, 0.35, 0.5, col); hb.box(0, 0, -1.5, 0.9, 0.35, 0.4, col);
      hb.box(0, 0.08, 0, 1.1, 0.28, 2.4, 0x5a4026); hb.box(0, 0.3, 0.2, 1.2, 0.06, 0.35, 0xd8c8a0); hb.box(0, 0.3, -0.9, 1.2, 0.06, 0.35, 0xd8c8a0);
      g.add(new T.Mesh(hb.build(), KS.M.vc));
      const oars = [-1, 1].map((sx) => { const o = new T.Group(); o.position.set(sx * 0.62, 0.42, 0.2); const ob = new KS.Builder(); ob.box(sx * 0.9, 0, 0, 1.8, 0.05, 0.06, 0xb08850); ob.box(sx * 1.75, 0, 0, 0.35, 0.03, 0.22, 0xb08850); o.add(new T.Mesh(ob.build(), KS.M.vc)); g.add(o); return o; });
      const x = cx + 5.6 + k * 1.6, z = jz - 2 + k * 0.4; g.position.set(x, -0.62, z); scene.add(g);
      KS.pondBoats.push({ g, oars, x, z, h: 0, home: { x, z }, speed: 0, turn: 0, ph: 0 });
    }
    // causeway & white shrine (Balgopaleshwor)
    b.box(cx, -0.2, cz + S / 4, 3.2, 0.5, S / 2, 0xe8e2d4); KS.addBox(cx, cz + S / 4, 3.2, S / 2, 0.3, -2);
    b.box(cx, -0.4, cz, 10, 0.7, 10, 0xe8e2d4); KS.addBox(cx, cz, 10, 10, 0.3, -2);
    b.box(cx, 0.3, cz, 5, 4, 5, P.white); b.sphere(cx, 4.3, cz, 2.6, P.white, 1.1, 14, true); b.cyl(cx, 7, cz, 0.3, 1.4, P.gold, 6, 0.1);
    KS.addBox(cx, cz, 5, 5, 8);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) { b.box(cx + sx * 4, 0.3, cz + sz * 4, 1, 1.4, 1, 0xd8d0c0); b.box(cx + sx * 4, 1.7, cz + sz * 4, 0.6, 0.9, 1.1, 0xf0ece0); } // elephants
    // Ghantaghar clock tower
    const gx = R.x1 - 8, gz = R.z0 + 7;
    b.box(gx, 0, gz, 5, 22, 5, 0xf4f0e6); b.box(gx, 22, gz, 5.8, 1, 5.8, 0xddd6c8); b.box(gx, 23, gz, 4, 4, 4, 0xf4f0e6); b.sphere(gx, 27, gz, 2.2, 0xf4f0e6, 1, 10, true); b.cyl(gx, 29, gz, 0.15, 1.5, P.gold, 4);
    KS.addBox(gx, gz, 5, 5, 30);
    const faceT = KS.tex(128, 128, (g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#222'; g.lineWidth = 5; g.stroke(); for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.fillStyle = '#222'; g.fillRect(64 + Math.sin(a) * 48 - 3, 64 - Math.cos(a) * 48 - 3, 6, 6); } });
    const faceM = new T.MeshLambertMaterial({ map: faceT, transparent: true }), handM = new T.MeshBasicMaterial({ color: 0x111111 });
    for (let s = 0; s < 4; s++) {
      const a = (s * Math.PI) / 2, fx = Math.sin(a), fz = Math.cos(a);
      const f = new T.Mesh(new T.PlaneGeometry(3.4, 3.4), faceM); f.position.set(gx + fx * 2.52, 18.5, gz + fz * 2.52); f.rotation.y = a; scene.add(f);
      for (const [len, k] of [[1.0, 'h'], [1.45, 'm']]) {
        const pivot = new T.Group(); pivot.position.set(gx + fx * 2.56, 18.5, gz + fz * 2.56); pivot.rotation.y = a;
        const hand = new T.Mesh(new T.BoxGeometry(0.14, len, 0.04).translate(0, len / 2, 0), handM); pivot.add(hand); scene.add(pivot);
        KS.clockHands.push({ hand, k });
      }
    }
    scene.add(KS.mesh(b));
    KS.bells.push([cx, cz]);
    add({ id: 'ranipokhari', name: 'Rani Pokhari', np: 'रानी पोखरी', x: cx, z: cz, r: 34, fact: 'The "Queen\'s Pond", built in 1670 by King Pratap Malla, with a white shrine on its island.' });
    add({ minor: true, id: 'ghantaghar', name: 'Ghantaghar', np: 'घण्टाघर', x: gx, z: gz, r: 10, fact: 'The clock tower of Trichandra College. Its hands follow the in-game time.' });
  }

  /* ================= Tundikhel & Ratna Park ================= */
  function tundikhel(scene, W) {
    const b = new KS.Builder();
    for (const r of [5, 6]) {
      const R = W.blockRect(6, r); grass(b, R.x0 + 4, R.x1 - 4, R.z0 + 4, R.z1 - 4, 0.14, 0x78a04c);
      for (let i = 0; i < 12; i++) { KS.World.tree(R.x0 + 7, KS.r(R.z0 + 8, R.z1 - 8), KS.r(6, 9)); KS.World.tree(R.x1 - 7, KS.r(R.z0 + 8, R.z1 - 8), KS.r(6, 9)); }
    }
    // Ratna Park bus stop shelters along the west side
    for (let i = 0; i < 3; i++) { const z = -70 + i * 20; b.box(11, 0.2, z, 2.6, 0.5, 8, 0x777777); b.box(12.4, 0.2, z, 0.15, 2.6, 8, 0x335577); b.box(11, 2.8, z, 3, 0.12, 8.4, 0x1d4fb8); KS.addBox(12.4, z, 0.3, 8, 3); }
    // national flag on a tall pole in the middle of Tundikhel
    const fx = 45, fz = -45;
    b.cyl(fx, 0, fz, 0.2, 18, 0xdddddd, 8); KS.addCircle(fx, fz, 0.4, 18);
    const ft = KS.tex(256, 320, (g) => {
      g.clearRect(0, 0, 256, 320);
      const path = () => { g.beginPath(); g.moveTo(10, 10); g.lineTo(240, 150); g.lineTo(80, 150); g.lineTo(240, 310); g.lineTo(10, 310); g.closePath(); };
      path(); g.fillStyle = '#003893'; g.fill();
      g.save(); g.translate(14, 18); g.scale(0.88, 0.9); path(); g.fillStyle = '#dc143c'; g.fill(); g.restore();
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(70, 92, 26, 0, Math.PI); g.fill(); // moon
      for (let i = 0; i < 8; i++) { const a = (i / 8) * Math.PI; g.beginPath(); g.arc(70 + Math.cos(a) * 26, 80 - Math.sin(a) * 6, 4, 0, 7); g.fill(); }
      g.beginPath(); g.arc(70, 240, 22, 0, 7); g.fill(); // sun
      for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.moveTo(70 + Math.cos(a) * 20, 240 + Math.sin(a) * 20); g.lineTo(70 + Math.cos(a + 0.26) * 34, 240 + Math.sin(a + 0.26) * 34); g.lineTo(70 + Math.cos(a + 0.52) * 20, 240 + Math.sin(a + 0.52) * 20); g.fill(); }
    });
    const fm = new T.MeshLambertMaterial({ map: ft, transparent: true, alphaTest: 0.3, side: T.DoubleSide });
    const uT = { value: 0 }; KS.timeUniforms.push(uT);
    fm.onBeforeCompile = (sh) => { sh.uniforms.uTime = uT; sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n transformed.z += sin(uTime*4.0 + position.x*1.6) * 0.25 * (position.x + 1.6) / 3.2;'); };
    const flag = new T.Mesh(new T.PlaneGeometry(3.2, 4, 12, 4), fm); flag.position.set(fx + 1.6, 15.4, fz); scene.add(flag);
    scene.add(KS.mesh(b));
    const R1 = W.blockRect(6, 5), R2 = W.blockRect(6, 6);
    KS.plazas.push({ x0: R1.x0 + 8, x1: R1.x1 - 8, z0: R1.z0 + 8, z1: R1.z1 - 8, n: 14, kinds: ['kid', 'kid', 'man', 'student', 'woman'] });
    KS.plazas.push({ x0: R2.x0 + 8, x1: R2.x1 - 8, z0: R2.z0 + 8, z1: R2.z1 - 8, n: 10, kinds: ['kid', 'man', 'student', 'elder'] });
    KS.football = { x: 45, z: 40 };
    add({ id: 'tundikhel', name: 'Tundikhel & Ratna Park', np: 'टुँडिखेल', x: 45, z: -20, r: 40, fact: 'The city\'s great open ground. Buses for the whole valley leave from Ratna Park beside it.' });
  }

  /* ================= Narayanhiti, Garden of Dreams, Singha Durbar, Stadium ================= */
  function palaces(scene, W) {
    const b = new KS.Builder();
    // Narayanhiti Palace Museum
    let R = W.blockRect(6, 2), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
    grass(b, R.x0 + 4, R.x1 - 4, R.z0 + 4, R.z1 - 4, 0.12, 0x6c9846);
    wall(b, R.x0 + 4.5, R.x1 - 4.5, R.z0 + 4.5, R.z1 - 4.5, 2.6, 0xd9b8a0, 10);
    b.box(cx, 0, cz - 12, 54, 11, 14, 0xe6a98f); b.box(cx, 11, cz - 12, 55, 0.8, 15, 0xc98d74);
    for (let i = 0; i < 10; i++) b.box(cx - 24 + i * 5.3, 2, cz - 4.9, 2.2, 6, 0.2, 0x3a2a24);
    b.box(cx, 0, cz - 12, 10, 26, 10, 0xe6a98f); b.roof(cx, 26, cz - 12, 15, 3.5, 0x7a3524, 0.5); b.box(cx, 29.5, cz - 12, 6, 3.5, 6, 0xe6a98f); b.roof(cx, 33, cz - 12, 9, 2.6, 0x7a3524, 0.2);
    KS.addBox(cx, cz - 12, 54, 14, 12); KS.addBox(cx, cz - 12, 10, 10, 36);
    b.cyl(cx, 0.12, cz + 16, 4, 0.8, 0xd8d0c0, 14); b.cyl(cx, 0.6, cz + 16, 3.4, 0.3, 0x5c8ea0, 14); b.cyl(cx, 0.6, cz + 16, 0.3, 2.4, 0xd8d0c0, 6);
    KS.addCircle(cx, cz + 16, 4, 0.9);
    add({ id: 'narayanhiti', name: 'Narayanhiti Palace Museum', np: 'नारायणहिटी दरबार', x: cx, z: cz, r: 34, fact: 'The former royal palace, opened to the public as a museum in 2008.' });

    // Garden of Dreams
    R = W.blockRect(5, 2); cx = (R.x0 + R.x1) / 2; cz = (R.z0 + R.z1) / 2;
    grass(b, R.x0 + 4, R.x1 - 4, R.z0 + 4, R.z1 - 4, 0.13, 0x6aa040);
    wall(b, R.x0 + 4.5, R.x1 - 4.5, R.z0 + 4.5, R.z1 - 4.5, 3.2, 0xf0d070, 8);
    for (let i = -2; i <= 2; i++) { b.box(cx + i * 12, 0.13, cz + 8, 8, 0.9, 1.2, 0x2f6b2a); b.box(cx + i * 12, 0.13, cz + 18, 8, 0.9, 1.2, 0x2f6b2a); for (let k = 0; k < 4; k++) b.sphere(cx + i * 12 + KS.r(-3, 3), 1.2, cz + 13 + KS.r(-2, 2), 0.5, KS.pick([0xe23a5a, 0xf2c418, 0xf6f0f0, 0xe86412]), 1, 6); }
    b.box(cx, -0.3, cz - 4, 22, 0.5, 9, 0x4f8a8f); b.box(cx, 0.13, cz - 4, 23, 0.35, 10, 0xe8e2d4);
    b.box(cx, 0.13, cz - 18, 18, 0.8, 9, 0xf4f0e6); columns(b, cx - 8, cx + 8, cz - 13.8, 0.93, 5, 6); b.box(cx, 5.9, cz - 18, 18.6, 1, 9.6, 0xf4f0e6); b.box(cx, 6.9, cz - 18, 14, 0.8, 7, 0xe8e2d4);
    KS.addBox(cx, cz - 18, 18, 9, 8);
    for (let i = 0; i < 10; i++) KS.World.tree(KS.r(R.x0 + 8, R.x1 - 8), R.z1 - KS.r(6, 12), KS.r(6, 9));
    KS.plazas.push({ x0: R.x0 + 8, x1: R.x1 - 8, z0: cz + 4, z1: R.z1 - 8, n: 8, kinds: ['tourist', 'tourist', 'woman', 'man'] });
    add({ id: 'garden', name: 'Garden of Dreams', np: 'स्वप्न बगैंचा', x: cx, z: cz, r: 30, fact: 'A neo-classical garden from the 1920s, a quiet oasis a few steps from Thamel.' });

    // Singha Durbar
    R = W.blockRect(8, 7); cx = (R.x0 + R.x1) / 2; cz = (R.z0 + R.z1) / 2;
    grass(b, R.x0 + 4, R.x1 - 4, R.z0 + 4, R.z1 - 4, 0.12, 0x76a24a);
    wall(b, R.x0 + 4.5, R.x1 - 4.5, R.z0 + 4.5, R.z1 - 4.5, 2.6, 0xf4f0e6);
    b.box(cx + 14, 0, cz, 22, 14, 62, P.white); b.box(cx + 14, 14, cz, 23, 1, 63, 0xe0dacb);
    for (let f = 0; f < 3; f++) for (let i = 0; i < 14; i++) b.box(cx + 2.9, 1.4 + f * 4.4, cz - 28 + i * 4.3, 0.2, 2.4, 1.6, 0x34495a);
    b.box(cx + 1, 0, cz, 6, 13, 18, 0xf6f3ea); for (let i = 0; i < 6; i++) b.cyl(cx - 2, 0, cz - 7.5 + i * 3, 0.6, 12.5, 0xf6f3ea, 10);
    b.box(cx - 2.5, 12.5, cz, 3, 2, 18.5, 0xebe5d8); b.roof(cx - 1, 14.5, cz, 18, 3, 0xebe5d8, 0.05);
    KS.addBox(cx + 14, cz, 22, 62, 15); KS.addBox(cx + 1, cz, 9, 18, 15);
    b.cyl(cx - 20, 0.12, cz, 5, 0.9, 0xd8d0c0, 16); b.cyl(cx - 20, 0.7, cz, 4.4, 0.3, 0x5c8ea0, 16); b.cyl(cx - 20, 0.7, cz, 0.5, 3, 0xd8d0c0, 8); KS.addCircle(cx - 20, cz, 5, 1);
    textBoard(scene, 'सिंहदरबार', cx - 2.6, 11, cz, -Math.PI / 2, 10, 1.6, '#ffffff', '#1d3a8a');
    add({ id: 'singha', name: 'Singha Durbar', np: 'सिंहदरबार', x: cx, z: cz, r: 36, fact: 'The government secretariat. When built in 1908 it was said to be the largest palace in Asia.' });

    // Dasharath Stadium
    R = W.blockRect(5, 9); cx = (R.x0 + R.x1) / 2; cz = (R.z0 + R.z1) / 2;
    b.box(cx, 0, cz, 52, 0.14, 54, 0xb0472e); b.box(cx, 0, cz, 40, 0.2, 44, 0x5f9a3a);
    for (let i = 0; i < 5; i++) b.box(cx, 0.2, cz - 20 + i * 9, 40, 0.02, 4.5, 0x6aa744);
    for (const [dx, dz, w, d] of [[0, -28.5, 56, 5], [0, 28.5, 56, 5], [-27.5, 0, 5, 52], [27.5, 0, 5, 52]]) {
      for (let k = 0; k < 5; k++) { const sx = dx ? Math.sign(dx) * k * 0.8 : 0, sz = dz ? Math.sign(dz) * k * 0.8 : 0; b.box(cx + dx + sx, 0, cz + dz + sz, w, 1.2 + k * 1.3, d - k * 0.9, k % 2 ? 0xc8c2b4 : 0x1d4fb8); }
      KS.addBox(cx + dx, cz + dz, w, d, 7.5);
    }
    const flMat = new T.MeshBasicMaterial({ color: 0x777766 }); KS.lampMats.push(flMat);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      b.box(cx + sx * 32, 0, cz + sz * 32, 0.8, 26, 0.8, 0x888888); KS.addBox(cx + sx * 32, cz + sz * 32, 0.8, 0.8, 26);
      const fl = new T.Mesh(new T.BoxGeometry(4, 2.4, 0.5), flMat); fl.position.set(cx + sx * 32, 27, cz + sz * 32); fl.lookAt(cx, 0, cz); scene.add(fl);
    }
    add({ id: 'stadium', name: 'Dasharath Stadium', np: 'दशरथ रंगशाला', x: cx, z: cz, r: 36, fact: 'Nepal\'s national stadium, packed with crowds for football and cricket.' });
    scene.add(KS.mesh(b));
  }

  /* ================= Tribhuvan International Airport ================= */
  function airport(scene, W) {
    const b = new KS.Builder();
    const rx = 735;
    const rt = KS.tex(128, 512, (g, w, h) => {
      g.fillStyle = '#3d3d40'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#eee'; for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 3, y, 6, 34);
      g.fillRect(6, 0, 4, h); g.fillRect(w - 10, 0, 4, h);
    }, true);
    rt.repeat.set(1, 8);
    const rw = new T.Mesh(new T.PlaneGeometry(32, 760).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: rt, polygonOffset: true, polygonOffsetFactor: -2 }));
    rw.position.set(rx, 0.06, 0); rw.receiveShadow = true; scene.add(rw);
    for (const z of [-372, 372]) for (let i = -5; i <= 5; i++) b.box(rx + i * 2.6, 0.07, z, 1.4, 0.02, 10, 0xeeeeee);
    b.box(680, 0.04, 0, 60, 0.04, 220, 0x55555a); // apron
    b.box(700, 0.04, 0, 12, 0.03, 700, 0x4c4c50); // taxiway
    // terminal: brick facade, tiered roofs
    b.box(640, 0, 20, 30, 12, 110, 0xa4553a); b.box(640, 12, 20, 32, 0.8, 112, 0x6e2f22);
    for (let i = 0; i < 4; i++) b.roof(640, 12.8, -20 + i * 26, 22, 4, P.roofTile, 0.35);
    for (let i = 0; i < 18; i++) b.box(655.2, 2, -32 + i * 6, 0.2, 7, 4, 0x2d4a5c);
    KS.addBox(640, 20, 30, 110, 17);
    // control tower
    b.cyl(640, 0, -70, 3, 30, 0xd8d2c4, 10); b.cyl(640, 30, -70, 5.5, 4, 0x3b6a7a, 8); b.roof(640, 34, -70, 11, 2.4, 0x6e2f22, 0.3);
    KS.addCircle(640, -70, 3, 36);
    // hangar
    b.box(650, 0, 120, 34, 12, 26, 0xc8c8c8); b.cyl(650, 12, 120, 13, 34, 0xb0b0b0, 12, 1, 0, 0, Math.PI / 2);
    KS.addBox(650, 120, 34, 26, 18);
    // perimeter fence
    for (let z = -390; z <= 390; z += 6) { b.box(780, 0, z, 0.15, 2.4, 0.15, 0x777777); b.box(602, 0, z, 0.15, 2.4, 0.15, 0x777777); }
    scene.add(KS.mesh(b));
    textBoard(scene, 'त्रिभुवन अन्तर्राष्ट्रिय विमानस्थल', 624.8, 10, 20, -Math.PI / 2, 26, 2.6, '#7a1414', '#ffffff');
    // aircraft (generic livery)
    KS.makePlane = (big) => {
      const p = new KS.Builder(), s = big ? 1.6 : 1;
      p.cyl(0, 0, 0, 1.6 * s, 26 * s, 0xf4f4f4, 12, 1, 0, Math.PI / 2, 0);
      p.sphere(0, 0, 26 * s, 1.6 * s, 0xf4f4f4, 1, 10);
      p.cyl(0, 0, 0, 1.6 * s, 3 * s, 0xf4f4f4, 12, 0.3, 0, -Math.PI / 2, 0);
      p.box(0, -0.4 * s, 12 * s, 26 * s, 0.35 * s, 5 * s, 0xe8e8e8);
      p.box(0, 0, -1 * s, 9 * s, 0.3 * s, 2.6 * s, 0xe8e8e8);
      p.box(0, 0.6 * s, -0.5 * s, 0.4 * s, 5 * s, 3.2 * s, 0xc81e1e);
      p.box(0, 2.6 * s, -0.4 * s, 0.45 * s, 1.6 * s, 2.4 * s, 0x1d4fb8);
      p.box(0, -0.3 * s, 13 * s, 3.4 * s, 0.4 * s, 26 * s, 0x1d4fb8, 0); // belly stripe
      for (const sx of [-1, 1]) p.cyl(sx * 5 * s, -1.6 * s, 11 * s, 0.8 * s, 3.6 * s, 0xcccccc, 10, 1, 0, Math.PI / 2, 0);
      for (let i = 0; i < 14; i++) for (const sx of [-1, 1]) p.box(sx * 1.55 * s, 0.4 * s, 4 * s + i * 1.4 * s, 0.1, 0.5 * s, 0.6 * s, 0x223344);
      const m = new T.Mesh(p.build(), KS.M.vc); m.castShadow = true;
      return m;
    };
    const parked = KS.makePlane(true); parked.position.set(672, 2.6, 40); parked.rotation.y = Math.PI; scene.add(parked);
    KS.addBox(672, 20, 40, 44, 5);
    const parked2 = KS.makePlane(false); parked2.position.set(672, 1.8, -40); parked2.rotation.y = Math.PI; scene.add(parked2);
    KS.addBox(672, -50, 26, 28, 4);
    KS.flyingPlane = KS.makePlane(true); scene.add(KS.flyingPlane);
    KS.runwayX = rx;
    add({ id: 'airport', name: 'Tribhuvan International Airport', np: 'त्रिभुवन अन्तर्राष्ट्रिय विमानस्थल', x: 690, z: 0, r: 70, fact: 'Nepal\'s main international airport, 1,338 m above sea level, with Himalayan views on approach.' });
  }

  L.build = (scene, W) => {
    durbar(scene, W); boudha(scene, W); swayambhu(scene, W); pashupati(scene, W);
    dharahara(scene, W); ranipokhari(scene, W); tundikhel(scene, W); palaces(scene, W); airport(scene, W);
    add({ id: 'thamel', name: 'Thamel', np: 'ठमेल', x: -135, z: -270, r: 60, fact: 'The traveller\'s quarter: trekking shops, momo cafes, prayer flags over every lane.' });
    add({ id: 'ason', name: 'Asan Tole', np: 'असन टोल', x: -45, z: -135, r: 32, fact: 'The oldest bazaar in town, selling spices, rice and festival goods for centuries.' });
    add({ minor: true, id: 'newroad', name: 'New Road', np: 'न्युरोड', x: -45, z: 90, r: 40, fact: 'The shopping street rebuilt after the great 1934 earthquake.' });
    add({ id: 'bagmati', name: 'Bagmati River', np: 'बागमती नदी', x: -200, z: 495, r: 40, fact: 'The holy river of the valley. Bridges join Kathmandu to Patan on the far bank.' });
  };
})();
