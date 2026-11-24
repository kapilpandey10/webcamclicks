/* Kathmandu Streets — street furniture with meaning: street-name plates, overhead direction gantries,
   no-horn and crossing signs, rooftop billboards (made-up brands), parking lots, a bus station,
   bus stops and a walled VIP mansion. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const S = (KS.Signs = {});
  const tex = KS.tex;

  // stylised street names for the grid (approximately where these roads run in Kathmandu)
  const V_NAMES = [['बालाजु मार्ग', 'Balaju Marg'], ['कालीमाटी मार्ग', 'Kalimati Marg'], ['टेकु सडक', 'Teku Road'], ['क्षेत्रपाटी मार्ग', 'Chhetrapati Marg'], ['ठमेल मार्ग', 'Thamel Marg'], ['इन्द्रचोक–असन', 'Indrachowk–Asan Road'], ['कान्तिपथ', 'Kantipath'], ['दरबारमार्ग', 'Durbar Marg'], ['पुतलीसडक', 'Putalisadak'], ['बानेश्वर सडक', 'Baneshwor Road'], ['गौशाला–चाबहिल', 'Gaushala–Chabahil Road'], ['सिनामंगल सडक', 'Sinamangal Road'], ['गौशाला मार्ग', 'Gaushala Marg']];
  const H_NAMES = [['महाराजगञ्ज मार्ग', 'Maharajgunj Marg'], ['लाजिम्पाट सडक', 'Lazimpat Road'], ['त्रिदेवी मार्ग', 'Tridevi Marg'], ['ज्याठा सडक', 'Jyatha Road'], ['रानीपोखरी सडक', 'Rani Pokhari Road'], ['भोटाहिटी–बागबजार', 'Bhotahiti–Bagbazar'], ['खिचापोखरी सडक', 'Khichapokhari Road'], ['न्युरोड', 'New Road'], ['सुन्धारा सडक', 'Sundhara Road'], ['त्रिपुरेश्वर मार्ग', 'Tripureshwor Marg'], ['थापाथली सडक', 'Thapathali Road'], ['बागमती करिडोर', 'Bagmati Corridor'], ['बल्खु मार्ग', 'Balkhu Marg']];
  KS.roadNameAt = (x, z) => {
    const i = Math.round((x - G.O) / G.B), j = Math.round((z - G.O) / G.B);
    const dx = Math.abs(x - G.line(i)), dz = Math.abs(z - G.line(j));
    if (i >= 0 && i <= G.N && dx < G.roadHalf(i) + 1 && (dz > dx || j < 0 || j > G.N)) return V_NAMES[i];
    if (j >= 0 && j <= G.N && dz < G.roadHalf(j) + 1) return H_NAMES[j];
    if (KS.HW && x < -540 && Math.abs(z - KS.HW.z) < 10) return ['पृथ्वी राजमार्ग', 'Prithvi Highway · Nagdhunga'];
    return null;
  };

  function plateTex([np, en], bg = '#1d5f3a') {
    return tex(512, 128, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(6, 6, w - 12, h - 12);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.font = `700 46px ${KS.FONT}`; g.fillText(np, w / 2, 46); g.font = '700 32px "Barlow Condensed", Arial, sans-serif'; g.fillText(en, w / 2, 96);
    });
  }

  /* ---------- street-name plates at every junction, instanced per road ---------- */
  function streetNames(scene) {
    const geo = new T.PlaneGeometry(2.4, 0.6), poleB = new KS.Builder(), dummy = new T.Object3D();
    const lists = { v: V_NAMES.map(() => []), h: H_NAMES.map(() => []) };
    for (let i = 0; i <= G.N; i++) for (let j = 0; j <= G.N; j++) {
      const x = G.line(i) - G.roadHalf(i) - 1.6, z = G.line(j) - G.roadHalf(j) - 1.6;
      poleB.cyl(x, 0, z, 0.06, 3.6, 0x55606a, 6);
      lists.v[i].push([x + 1.3, 3.25, z, Math.PI / 2]); // reads along the vertical road
      lists.h[j].push([x, 2.6, z + 1.3, 0]);
    }
    for (const [key, names] of [['v', V_NAMES], ['h', H_NAMES]]) names.forEach((nm, k) => {
      const L = lists[key][k]; if (!L.length) return;
      const m = new T.InstancedMesh(geo, new T.MeshLambertMaterial({ map: plateTex(nm, nm[1].startsWith('Ring') ? '#1d3a8a' : '#1d5f3a'), side: T.DoubleSide }), L.length);
      L.forEach(([x, y, z, ry], n) => { dummy.position.set(x, y, z); dummy.rotation.set(0, ry, 0); dummy.updateMatrix(); m.setMatrixAt(n, dummy.matrix); });
      m.frustumCulled = false; scene.add(m);
    });
    scene.add(KS.mesh(poleB, KS.M.vc, false));
  }

  /* ---------- "चक्रपथ · <place>" boards at every Ring Road place ---------- */
  function ringBoards(scene) {
    const poleB = new KS.Builder();
    for (const w of KS.RING_LOOP) {
      const { x, z, name } = w;
      const m = Math.hypot(x, z) || 1, ox = x / m, oz = z / m, ry = Math.atan2(ox, oz);
      const px = x + ox * 13.5, pz = z + oz * 13.5;
      poleB.cyl(px, 0, pz, 0.06, 3.6, 0x55606a, 6);
      const board = new T.Mesh(new T.PlaneGeometry(2.4, 0.6), new T.MeshLambertMaterial({ map: plateTex(['चक्रपथ', name], '#1d3a8a'), side: T.DoubleSide }));
      board.position.set(px, 3.25, pz); board.rotation.y = ry; scene.add(board);
    }
    scene.add(KS.mesh(poleB, KS.M.vc, false));
  }

  /* ---------- overhead direction gantries ("… जाने बाटो") ---------- */
  const DEST = [
    ['बौद्ध', 'Boudha', 405, -225], ['ठमेल', 'Thamel', -135, -270], ['विमानस्थल', 'Airport', 690, 0], ['स्वयम्भू', 'Swayambhu', -700, -90],
    ['पशुपति', 'Pashupati', 405, 409], ['रत्नपार्क', 'Ratna Park', 45, -20], ['नागढुङ्गा', 'Nagdhunga', -1200, 90], ['दरबार क्षेत्र', 'Durbar Sq.', -135, 90],
    ['कोटेश्वर', 'Koteshwor', 540, 300], ['बालाजु', 'Balaju', -400, -400], ['सिंहदरबार', 'Singha Durbar', 225, 135],
  ];
  function gantryTex(rows) {
    return tex(768, 300, (g, w, h) => {
      g.fillStyle = '#16603a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 8; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = '#fff'; g.textBaseline = 'middle';
      rows.forEach(([arrow, np, en, km], k) => {
        const y = 58 + k * 92;
        g.font = '900 64px Arial, sans-serif'; g.textAlign = 'center'; g.fillText(arrow, 70, y);
        g.textAlign = 'left'; g.font = `700 46px ${KS.FONT}`; g.fillText(`${np} जाने बाटो`, 130, y - 14);
        g.font = '700 32px "Barlow Condensed", Arial, sans-serif'; g.fillText(en, 132, y + 26);
        g.textAlign = 'right'; g.font = '700 38px "Barlow Condensed", Arial, sans-serif'; g.fillText(km, w - 34, y);
      });
    });
  }
  function gantries(scene) {
    const b = new KS.Builder();
    // [junction i, j, approach direction dx, dz] : the gantry stands before the junction, facing oncoming traffic
    const spots = [[6, 3, 0, 1], [6, 8, 0, -1], [3, 6, 1, 0], [9, 6, -1, 0], [0, 7, 1, 0], [12, 6, -1, 0], [6, 0, 0, 1], [6, 12, 0, -1], [9, 3, -1, 0], [3, 9, 1, 0], [10, 9, 0, -1], [4, 4, 1, 0]];
    for (const [i, j, dx, dz] of spots) {
      const nx = G.line(i), nz = G.line(j), x = nx - dx * 38, z = nz - dz * 38;
      const hw = (dx ? G.roadHalf(j) : G.roadHalf(i)) + 1.2;
      const rx = -dz, rz = dx; // right of travel
      const rows = DEST.map(([np, en, lx, lz]) => {
        const vx = lx - nx, vz = lz - nz, d = Math.hypot(vx, vz), ang = Math.atan2(vx * rx + vz * rz, vx * dx + vz * dz);
        return { np, en, d, arrow: Math.abs(ang) < 0.6 ? '↑' : ang > 0 ? '→' : '←' };
      }).filter((r) => r.d > 150).sort((a, c) => a.d - c.d);
      const pick = []; for (const a of ['↑', '←', '→']) { const r = rows.find((q) => q.arrow === a && !pick.includes(q)); if (r) pick.push(r); }
      while (pick.length < 3 && rows.length) { const r = rows.find((q) => !pick.includes(q)); if (!r) break; pick.push(r); }
      const ry = Math.atan2(-dx, -dz); // board faces the oncoming traffic
      for (const s of [-1, 1]) b.box(x + rx * hw * s, 0, z + rz * hw * s, 0.35, 7.2, 0.35, 0x8a9098);
      b.box(x, 6.9, z, dx ? 0.3 : hw * 2 + 0.4, 0.3, dx ? hw * 2 + 0.4 : 0.3, 0x8a9098);
      for (const s of [-1, 1]) { KS.addCircle(x + rx * hw * s, z + rz * hw * s, 0.3, 7.2); }
      const m = new T.Mesh(new T.PlaneGeometry(7.6, 3), new T.MeshLambertMaterial({ map: gantryTex(pick.map((r) => [r.arrow, r.np, r.en, (r.d * 0.006).toFixed(1) + ' km'])) }));
      m.position.set(x - dx * 0.2, 5.4, z - dz * 0.2); m.rotation.y = ry; scene.add(m);
      const back = new T.Mesh(new T.PlaneGeometry(7.6, 3), new T.MeshLambertMaterial({ color: 0x5a6068 })); back.position.set(x + dx * 0.05, 5.4, z + dz * 0.05); back.rotation.y = ry + Math.PI; scene.add(back);
    }
    scene.add(KS.mesh(b));
  }

  /* ---------- small road signs: no horn, pedestrian crossing, bus stop, parking ---------- */
  function roadSigns(scene) {
    const mk = (draw) => new T.MeshLambertMaterial({ map: tex(128, 128, draw), side: T.DoubleSide, transparent: true, alphaTest: 0.4 });
    const noHorn = mk((g) => { g.fillStyle = '#fff'; g.beginPath(); g.arc(64, 64, 60, 0, 7); g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 12; g.beginPath(); g.arc(64, 64, 54, 0, 7); g.stroke();
      g.fillStyle = '#111'; g.beginPath(); g.moveTo(32, 54); g.lineTo(52, 54); g.lineTo(84, 36); g.lineTo(84, 92); g.lineTo(52, 74); g.lineTo(32, 74); g.fill();
      g.strokeStyle = '#c8102e'; g.lineWidth = 10; g.beginPath(); g.moveTo(26, 26); g.lineTo(102, 102); g.stroke(); });
    const walk = mk((g) => { g.fillStyle = '#1d4fb8'; g.fillRect(4, 4, 120, 120); g.fillStyle = '#fff'; g.beginPath(); g.moveTo(64, 14); g.lineTo(114, 108); g.lineTo(14, 108); g.closePath(); g.fill();
      g.fillStyle = '#111'; g.beginPath(); g.arc(66, 46, 7, 0, 7); g.fill(); g.lineWidth = 6; g.strokeStyle = '#111'; g.beginPath(); g.moveTo(64, 54); g.lineTo(60, 78); g.lineTo(50, 98); g.moveTo(60, 78); g.lineTo(74, 98); g.moveTo(62, 62); g.lineTo(76, 72); g.stroke();
      g.fillStyle = '#111'; for (let k = 0; k < 4; k++) g.fillRect(34 + k * 16, 100, 10, 6); });
    const geo = new T.CircleGeometry(0.42, 20), sq = new T.PlaneGeometry(0.8, 0.8), poles = new KS.Builder();
    const put = (mat, g2, x, z, ry) => { poles.cyl(x, 0, z, 0.05, 2.5, 0x777777, 5); const m = new T.Mesh(g2, mat); m.position.set(x, 2.55, z); m.rotation.y = ry; scene.add(m); };
    for (const sg of KS.signals) put(walk, sq, sg.x + G.roadHalf(sg.i) + 1.4, sg.z - sg.hw - 5, 0);
    for (let k = 0; k < 18; k++) { const i = KS.ri(1, G.N - 1), j = KS.ri(1, G.N - 1); put(noHorn, geo, G.line(i) + G.roadHalf(i) + 1.3, G.line(j) + G.roadHalf(j) + 18, 0); }
    if (KS.hospital) { const j = Math.round((KS.hospital.z - G.O) / G.B), L = G.line(j), z = L + Math.sign(KS.hospital.z - L || 1) * (G.roadHalf(j) + 1.3); for (const s of [-1, 1]) put(noHorn, geo, KS.hospital.x + s * 20, z, 0); }
    scene.add(KS.mesh(poles, KS.M.vc, false));
  }

  /* ---------- rooftop billboards with made-up brands ---------- */
  const ADS = [
    ['#c8102e', '#fff', 'HIMSHIKHAR BANK', 'हरेक गाउँको बैंक · Banking for every village'], ['#0f8a7a', '#fff', 'UTHAO', 'Ride · Deliver · Earn — उठाओ'],
    ['#f2c418', '#111', 'SATHI TELECOM 5G', 'Fast like a Thamel scooter'], ['#1d3a8a', '#fff', 'LALIGURANS PAINTS', 'Colour your home · घर रंगाऔं'],
    ['#3a6a2a', '#fff', 'PHEWA TEA', 'Every morning chiya · बिहानको चिया'], ['#e86412', '#fff', 'SAGAR NOODLES', '2-minute masala magic'],
    ['#555a66', '#fff', 'SHILA CEMENT', 'Strong as the Himalaya'], ['#2fa84f', '#fff', 'BIJULI EV', 'Charge your ride · बिजुलीको सवारी'],
    ['#7a1f3a', '#ffe27a', 'MOMO MASALA No.1', 'The taste of Asan bazaar'], ['#0a8ac8', '#fff', 'VISIT POKHARA', 'Lakes, mountains, paragliding'],
  ];
  function adTex([bg, fg, big, small]) {
    return tex(512, 192, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, bg); gr.addColorStop(1, new T.Color(bg).multiplyScalar(0.7).getStyle()); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(255,255,255,.12)'; g.beginPath(); g.arc(w - 60, 40, 120, 0, 7); g.fill();
      g.fillStyle = fg; g.textAlign = 'left'; g.font = '900 64px "Barlow Condensed", Impact, sans-serif'; g.fillText(big, 26, 92);
      g.font = `600 28px ${KS.FONT}`; g.fillText(small, 28, 146);
    });
  }
  function billboards(scene) {
    const mats = ADS.map((a) => { const t = adTex(a); return new T.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 }); });
    mats.forEach((m) => { m.userData.nightScale = 0.55; KS.nightMats.push(m); });
    const frame = new KS.Builder();
    const tall = (KS.World.tall || []).filter((_, k) => k % 2 === 0).slice(0, 60);
    tall.forEach((t, k) => {
      const fx = Math.sin(t.ry), fz = Math.cos(t.ry), rx = Math.cos(t.ry), rz = -Math.sin(t.ry);
      const x = t.cx + fx * (t.d / 2 - 1.2), z = t.cz + fz * (t.d / 2 - 1.2), y = t.H, w = Math.min(10, t.w * 0.9);
      for (const s of [-1, 1]) frame.box(x + rx * (w / 2 - 0.6) * s, y, z + rz * (w / 2 - 0.6) * s, 0.2, 3.2, 0.2, 0x444444);
      frame.box(x, y + 1.2, z, w + 0.3, 3.9, 0.25, 0x2a2a2a, t.ry);
      const m = new T.Mesh(new T.PlaneGeometry(w, 3.6), mats[k % mats.length]); m.position.set(x + fx * 0.14, y + 3.15, z + fz * 0.14); m.rotation.y = t.ry; scene.add(m);
      for (let i = 0; i < 3; i++) frame.box(x + rx * (i - 1) * w * 0.33 + fx * 0.7, y + 5.1, z + rz * (i - 1) * w * 0.33 + fz * 0.7, 0.4, 0.15, 0.15, 0x888888, t.ry); // lamps
    });
    // tall unipole boards along the Ring Road loop, offset outward from the carriageway
    [[30, -640], [540, 300], [-560, 120], [560, -40]].forEach(([wx, wz], k) => {
      const m = Math.hypot(wx, wz) || 1, ox = wx / m, oz = wz / m, ry = Math.atan2(ox, oz);
      const x = wx + ox * 16, z = wz + oz * 16;
      frame.cyl(x, 0, z, 0.5, 14, 0x777777, 10); frame.box(x, 14, z, 0.4, 0.4, 13, 0x333333, ry + Math.PI / 2);
      const m1 = new T.Mesh(new T.PlaneGeometry(12, 4.5), mats[(k + 3) % mats.length]); m1.position.set(x - ox * 0.25, 16.4, z - oz * 0.25); m1.rotation.y = ry; scene.add(m1);
      const m2 = new T.Mesh(new T.PlaneGeometry(12, 4.5), mats[(k + 6) % mats.length]); m2.position.set(x + ox * 0.25, 16.4, z + oz * 0.25); m2.rotation.y = ry + Math.PI; scene.add(m2);
      KS.addCircle(x, z, 0.6, 14);
    });
    scene.add(KS.mesh(frame, KS.M.vc, false));
  }

  /* ---------- parking lots and the bus station: every vehicle's home ---------- */
  KS.LOTS = [];
  function lots(scene, W) {
    const b = new KS.Builder(), paint = new KS.Builder();
    const make = (c, r, name, np, bus, trucks) => {
      const R = W.blockRect(c, r), x0 = R.x0 + 4, x1 = R.x1 - 4, z0 = R.z0 + 4, z1 = R.z1 - 4;
      b.box((x0 + x1) / 2, 0, (z0 + z1) / 2, x1 - x0, 0.1, z1 - z0, 0x47474a);
      const lot = { name, np, node: KS.Traffic.lotNode(c, r), bus, trucks, bays: [] };
      if (bus) {
        for (let row = 0; row < 3; row++) for (let k = 0; k < 13; k++) { const x = x0 + 6 + k * 4.4, z = z0 + 16 + row * 22; lot.bays.push({ x, z, h: 0, bus: true }); paint.box(x - 2.2, 0.11, z, 0.12, 0.01, 11, 0xf4f4ee); }
        for (let k = 0; k < 4; k++) { const z = z0 + 6 + k * 22; b.box((x0 + x1) / 2, 0.1, z, x1 - x0 - 8, 0.25, 2.2, 0xb9b2a4); b.box((x0 + x1) / 2, 2.8, z, x1 - x0 - 8, 0.12, 3, 0x1d4fb8); for (let q = 0; q < 6; q++) b.box(x0 + 8 + q * 11, 0.35, z, 0.12, 2.45, 0.12, 0x777777); }
        for (let k = 0; k < 4; k++) KS.sitSpots.push([x0 + 10 + k * 12, z0 + 6.6, 0.35, KS.pick(['man', 'woman', 'student', 'porter'])]);
        KS.plazas.push({ x0: x0 + 4, x1: x1 - 4, z0: z0 + 3, z1: z0 + 9, n: 12, kinds: ['man', 'woman', 'porter', 'student', 'tourist', 'elder'] });
      } else {
        for (let row = 0; row < 5; row++) for (let k = 0; k < 18; k++) { const x = x0 + 6 + k * 3.4, z = z0 + 10 + row * 13; lot.bays.push({ x, z, h: row % 2 ? Math.PI : 0 }); paint.box(x - 1.7, 0.11, z, 0.1, 0.01, 5, 0xf4f4ee); }
      }
      b.box(x0 + 3, 0.1, z0 + 3, 3, 2.6, 3, 0xf2e6b8); b.box(x0 + 3, 2.7, z0 + 3, 3.6, 0.2, 3.6, 0x1d4fb8); KS.addBox(x0 + 3, z0 + 3, 3, 3, 2.8);
      const t = tex(512, 128, (g, w, h) => { g.fillStyle = bus ? '#c81e1e' : '#1d4fb8'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 44px ${KS.FONT}`; g.fillText(np, w / 2, 50); g.font = '700 30px "Barlow Condensed", Arial, sans-serif'; g.fillText((bus ? '' : 'P · ') + name.toUpperCase(), w / 2, 100); });
      const sm = new T.Mesh(new T.PlaneGeometry(7, 1.75), new T.MeshLambertMaterial({ map: t, side: T.DoubleSide })); sm.position.set(x0 + 7, 4.2, z0 - 0.6); scene.add(sm);
      b.box(x0 + 3.6, 0, z0 - 0.6, 0.15, 4.2, 0.15, 0x666666); b.box(x0 + 10.4, 0, z0 - 0.6, 0.15, 4.2, 0.15, 0x666666);
      if (trucks) for (let k = 0; k < 8; k++) KS.World.stall(b, x1 - 6 - k * 6, z1 - 4, Math.PI / 2);
      KS.LOTS.push(lot);
      KS.landmarks.push({ id: 'lot' + c + r, minor: true, name, np, x: (x0 + x1) / 2, z: (z0 + z1) / 2, r: 30, fact: bus ? 'Buses, minibuses and tempos rest here between runs; conductors shout the routes.' : 'Cars and bikes from all over the city come home to park here.' });
    };
    make(7, 6, 'Bhrikutimandap Car Park', 'भृकुटीमण्डप पार्किङ', false, false);
    make(8, 6, 'Ratna Park Bus Station', 'रत्नपार्क बसपार्क', true, false);
    make(2, 7, 'Kalimati Market Parking', 'कालीमाटी बजार पार्किङ', false, true);
    scene.add(KS.mesh(b));
    scene.add(new T.Mesh(paint.build(), new T.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -4 })));
  }

  /* ---------- bus stops along the main roads ---------- */
  KS.busStops = [];
  function busStops(scene) {
    const b = new KS.Builder();
    const t = tex(256, 128, (g, w, h) => { g.fillStyle = '#c81e1e'; g.fillRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 46px ${KS.FONT}`; g.fillText('बस स्टप', w / 2, 56); g.font = '700 30px "Barlow Condensed", Arial, sans-serif'; g.fillText('BUS STOP', w / 2, 102); });
    const mat = new T.MeshLambertMaterial({ map: t, side: T.DoubleSide }), geo = new T.PlaneGeometry(1.4, 0.7);
    const stop = (x, z, kx, kz, ry) => { // x,z on the lane; kx,kz the kerb direction
      const sx = x + kx * 6.2, sz = z + kz * 6.2;
      KS.busStops.push({ x, z, kx, kz, sx, sz, count: KS.ri(0, 3), spawnT: KS.r(5, 30), models: [] });
      b.box(sx, 0.2, sz, kx ? 1.6 : 6, 0.1, kz ? 1.6 : 6, 0x888888); b.box(sx + kx * 0.8, 0.2, sz + kz * 0.8, kx ? 0.1 : 6, 2.4, kz ? 0.1 : 6, 0x5a8aa8);
      b.box(sx, 2.6, sz, kx ? 2.2 : 6.4, 0.12, kz ? 2.2 : 6.4, 0xc81e1e);
      const m = new T.Mesh(geo, mat); m.position.set(sx - kz * 3.4, 3.2, sz - kx * 3.4); m.rotation.y = ry; scene.add(m);
      b.box(sx - kz * 3.4, 0, sz - kx * 3.4, 0.08, 3, 0.08, 0x666666);
      if (KS.chance(0.6)) KS.sitSpots.push([sx, sz, 0.3, KS.pick(['man', 'woman', 'student', 'elder', 'office'])]);
    };
    for (const i of [3, 6, 9]) for (const r of [2, 5, 8]) { const x = G.line(i), z = G.line(r) + 45; stop(x + 3.5, z, 1, 0, Math.PI / 2); stop(x - 3.5, z + 6, -1, 0, -Math.PI / 2); }
    for (const j of [3, 7, 9]) for (const c of [2, 5, 8, 10]) { const z = G.line(j), x = G.line(c) + 45; stop(x, z - 3.5, 0, -1, 0); stop(x + 6, z + 3.5, 0, 1, Math.PI); }
    scene.add(KS.mesh(b, KS.M.vc, false));
  }

  /* ---------- a rich family's walled mansion north of the Ring Road ---------- */
  function mansion(scene) {
    const M = KS.MANSION, b = new KS.Builder(), cx = (M.x0 + M.x1) / 2, cz = (M.z0 + M.z1) / 2;
    b.box(M.gx, 0.02, (-551 + M.gz) / 2, 10, 0.06, M.gz + 551, 0x4a4a4c); // access road from the Ring Road
    b.box(cx, 0, cz, M.x1 - M.x0, 0.1, M.z1 - M.z0, 0x74a84a); // lawn
    const wallH = 3.2, gap = 9;
    b.box(cx, 0, M.z0, M.x1 - M.x0, wallH, 0.7, 0xf0ead8); KS.addBox(cx, M.z0, M.x1 - M.x0, 0.7, wallH);
    b.box(M.x0, 0, cz, 0.7, wallH, M.z1 - M.z0, 0xf0ead8); KS.addBox(M.x0, cz, 0.7, M.z1 - M.z0, wallH);
    b.box(M.x1, 0, cz, 0.7, wallH, M.z1 - M.z0, 0xf0ead8); KS.addBox(M.x1, cz, 0.7, M.z1 - M.z0, wallH);
    const lw = (M.gx - gap / 2) - M.x0, rw = M.x1 - (M.gx + gap / 2);
    b.box(M.x0 + lw / 2, 0, M.z1, lw, wallH, 0.7, 0xf0ead8); KS.addBox(M.x0 + lw / 2, M.z1, lw, 0.7, wallH);
    b.box(M.x1 - rw / 2, 0, M.z1, rw, wallH, 0.7, 0xf0ead8); KS.addBox(M.x1 - rw / 2, M.z1, rw, 0.7, wallH);
    for (let x = M.x0; x <= M.x1; x += 6) for (const z of [M.z0, M.z1]) b.sphere(x, wallH + 0.25, z, 0.35, 0xd9a52b, 1, 6); // gold finials
    KS.mansionGate = KS.addBox(M.gx, M.z1, gap, 0.4, 2.8); KS.mansionGate.tag = 'gate'; // the iron gate itself is built (and opened) in places.js
    b.box(M.gx + 7, 0, M.z1 + 3, 2.2, 2.6, 2.2, 0xd8d0c0); b.roof(M.gx + 7, 2.6, M.z1 + 3, 3, 1, 0x7a3524, 0.2); // guard booth
    b.box(M.gx, 0.1, (M.z1 + cz) / 2, 6, 0.06, M.z1 - cz, 0xc8b89a); // driveway
    // the villa: white columns, balconies, red roof, a golden dome
    const vx = cx, vz = cz - 18;
    b.box(vx, 0.1, vz, 44, 0.9, 22, 0xe8e2d4); KS.addBox(vx, vz, 44, 22, 1);
    // ground floor: a hollow shell you can walk into (door in the middle of the front), rooms inside; the upper floor is closed
    const WC = 0xfaf6ee, t = 0.4, top = 13;
    const wall = (x, z, w, d) => { b.box(x, 1, z, w, 5.4, d, WC); KS.addBox(x, z, w, d, top); };
    wall(vx - 10.85, vz + 8.8, 18.3, t); wall(vx + 10.85, vz + 8.8, 18.3, t); b.box(vx, 4.4, vz + 8.8, 3.4, 2, t, WC); // front with the doorway
    wall(vx, vz - 8.8, 40, t); wall(vx - 19.8, vz, t, 18); wall(vx + 19.8, vz, t, 18);
    for (const sx of [-1, 1]) { const x = vx + sx * 7; wall(x, vz - 4.1, t, 9.8); wall(x, vz + 6.1, t, 5.8); b.box(x, 4.2, vz + 2, t, 2.2, 2.4, WC); } // partitions with doorways
    b.box(vx, 6.4, vz, 40, 0.3, 18, 0xe8e2d4); b.box(vx, 6.7, vz, 40, 6.3, 18, WC); KS.addBox(vx, vz, 40, 18, 18, 6.4); // ceiling and the closed upper floor
    b.box(vx, 0, vz + 12.0, 8, 0.35, 1.0, 0xe8e2d4); KS.addBox(vx, vz + 12.0, 8, 1.0, 0.35); b.box(vx, 0, vz + 11.3, 8, 0.7, 0.6, 0xe8e2d4); KS.addBox(vx, vz + 11.3, 8, 0.6, 0.7); // front steps
    KS.MANSION.house = { vx, vz, w: 40, d: 18, floor: 1 };
    b.box(vx, 13, vz, 41, 0.6, 19, 0xd9d1bf); b.roof(vx, 13.6, vz, 44, 4, 0x8a2a1f, 0.4);
    for (let k = 0; k < 10; k++) b.cyl(vx - 18 + k * 4, 1, vz + 9.8, 0.45, 12, 0xffffff, 12);
    b.box(vx, 6.2, vz + 10.5, 40, 0.4, 2.2, 0xd9d1bf); for (let k = 0; k < 40; k++) b.box(vx - 19.5 + k, 6.6, vz + 11.5, 0.08, 1, 0.08, 0xd9a52b);
    for (let f = 0; f < 2; f++) for (let k = 0; k < 8; k++) { const x = vx - 16 + k * 4.6; if (f === 0 && Math.abs(x - vx) < 3) continue; b.box(x, 2.4 + f * 5.4, vz + 9.06, 1.8, 2.8, 0.1, 0x3b5a6a); }
    b.cyl(vx, 17.4, vz, 3.4, 1, 0xd9a52b, 16); b.sphere(vx, 18.4, vz, 3.2, 0xd9a52b, 0.9, 16, true); b.cyl(vx, 21.2, vz, 0.15, 2, 0xd9a52b, 6);
    // fountain, garden, helipad, garage (the swimming pool is built in places.js)
    b.cyl(M.gx, 0.1, cz + 22, 4, 0.8, 0xe8e2d4, 18); b.cyl(M.gx, 0.6, cz + 22, 3.4, 0.3, 0x5a95b0, 18); b.cyl(M.gx, 0.6, cz + 22, 0.4, 3, 0xffffff, 8); KS.addCircle(M.gx, cz + 22, 4, 0.9);
    b.cyl(vx + 32, 0.1, cz + 18, 7, 0.08, 0x666a70, 24); b.box(vx + 32, 0.19, cz + 18, 1, 0.01, 6, 0xf4f4ee); b.box(vx + 30, 0.19, cz + 18, 1, 0.01, 6, 0xf4f4ee); b.box(vx + 34, 0.19, cz + 18, 1, 0.01, 6, 0xf4f4ee); b.box(vx + 32, 0.19, cz + 18, 4, 0.01, 1, 0xf4f4ee);
    b.box(vx + 30, 0, vz, 14, 4, 12, 0xfaf6ee); b.box(vx + 30, 4, vz, 14.4, 0.4, 12.4, 0x8a2a1f); KS.addBox(vx + 30, vz, 14, 12, 4.4);
    for (let k = 0; k < 14; k++) KS.World.tree(M.x0 + 6 + (k % 7) * 3, M.z0 + 6 + Math.floor(k / 7) * 110, 7, 'pine');
    for (let k = 0; k < 10; k++) KS.World.tree(M.x1 - 5, M.z0 + 12 + k * 11, 8);
    scene.add(KS.mesh(b));
    // luxury cars in the drive, guards at the gate
    KS.mansionCars = [['suv', vx + 6, vz + 15, 0.3], ['sedan', vx - 6, vz + 15, -0.3], ['suv', vx + 26, vz + 10, 0]].map(([k, x, z, h]) => [k, x, z, h]);
    KS.mansionGuards = [[M.gx - 6, M.z1 + 2.2], [M.gx + 6, M.z1 + 2.2]];
    // brass nameplate on black marble beside the gate, and a smaller one on the other pillar
    const plate = tex(512, 192, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, '#15151a'); gr.addColorStop(1, '#2a2a30'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d9a52b'; g.lineWidth = 8; g.strokeRect(10, 10, w - 20, h - 20); g.lineWidth = 2; g.strokeRect(22, 22, w - 44, h - 44);
      g.fillStyle = '#e8c15a'; g.textAlign = 'center'; g.font = `700 50px ${KS.FONT}`; g.fillText('सद्भाव ठकुरी निवास', w / 2, 84);
      g.font = '700 38px "Barlow Condensed", Georgia, serif'; g.fillText('SADBHAV THAKURI RESIDENCE', w / 2, 146, w - 60);
    });
    const pm = new T.MeshLambertMaterial({ map: plate });
    for (const [sx, sc] of [[-1, 1], [1, 0.62]]) { const m = new T.Mesh(new T.PlaneGeometry(4.2 * sc, 1.58 * sc), pm); m.position.set(M.gx + sx * 9.4, 2.1, M.z1 + 0.42); scene.add(m); }
    KS.landmarks.push({ id: 'mansion', name: 'Sadbhav Thakuri Residence', np: 'सद्भाव ठकुरी निवास', x: cx, z: cz, r: 50, stop: { x: M.gx + 4, z: M.z1 + 8 }, fact: 'The walled home of the Thakuri family: gold domes, a pool and a helipad. Their VIP guests book Uthao cars and tip well.' });
  }

  S.build = (scene, W) => { lots(scene, W); busStops(scene); streetNames(scene); ringBoards(scene); gantries(scene); roadSigns(scene); billboards(scene); mansion(scene); };
})();
