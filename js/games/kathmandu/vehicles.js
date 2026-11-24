/* Kathmandu Streets — vehicles (forward = +z). Every vehicle is a real GLB
   model loaded by vehicleModels.js: there are no code-built vehicles any more.
   This file owns the vehicle table, the Nepali plates and route boards that
   dress a model, the headlight beams, the siren bars, and the small rider /
   conductor figures that sit on the GLB bikes and buses. If a model file has
   not loaded, buildVehicle returns null and the caller skips that vehicle. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;

  /* top speed (m/s) — every type has its own certain maximum, no two alike:
     a police bike (20) is always faster than any car, a tempo (8.5) always
     the slowest thing with an engine. Traffic, chases and the player's own
     driving all cap at this number (chases get a small pursuit allowance). */
  KS.VTYPES = {
    car: { name: 'Hatchback', len: 3.8, wid: 1.72, speed: 13, accel: 7, turn: 1.9, r: 1.7, seats: 'car' },
    sedan: { name: 'Sedan', len: 4.5, wid: 1.78, speed: 14.5, accel: 7.5, turn: 1.75, r: 1.9, seats: 'car' },
    suv: { name: 'SUV', len: 4.6, wid: 1.9, speed: 15, accel: 7, turn: 1.6, r: 2.0, seats: 'car' },
    ev: { name: 'Electric Car', len: 4.1, wid: 1.8, speed: 16, accel: 10, turn: 1.85, r: 1.8, seats: 'car' },
    taxi: { name: 'Taxi', len: 3.7, wid: 1.66, speed: 13.8, accel: 7, turn: 2.0, r: 1.7, seats: 'car' },
    police: { name: 'Police Jeep', len: 4.4, wid: 1.9, speed: 16.5, accel: 8, turn: 1.8, r: 1.9, seats: 'car' },
    ambulance: { name: 'Ambulance', len: 5.2, wid: 1.95, speed: 17, accel: 7, turn: 1.6, r: 2.2, seats: 'van' },
    micro: { name: 'Micro Bus', len: 5.0, wid: 1.9, speed: 12, accel: 5.5, turn: 1.6, r: 2.1, seats: 'van' },
    minibus: { name: 'Minibus', len: 7.4, wid: 2.2, speed: 11, accel: 4.2, turn: 1.25, r: 2.6, seats: 'bus' },
    bus: { name: 'City Bus', len: 10.6, wid: 2.5, speed: 10, accel: 3.6, turn: 1.0, r: 3.2, seats: 'bus' },
    tempo: { name: 'Safa Tempo', len: 2.6, wid: 1.55, speed: 8.5, accel: 4.5, turn: 2.0, r: 1.3, seats: 'van' },
    truck: { name: 'Painted Truck', len: 8, wid: 2.4, speed: 9, accel: 3.2, turn: 1.1, r: 2.8, seats: 'bus' },
    pickup: { name: 'Pickup', len: 5.0, wid: 1.85, speed: 14.2, accel: 6.5, turn: 1.6, r: 2.1, seats: 'car' },
    bike: { name: 'Commuter Bike', len: 2.0, wid: 0.75, speed: 18, accel: 10, turn: 2.6, r: 0.8, seats: 'bike' },
    sport: { name: 'Sport Bike', len: 2.05, wid: 0.72, speed: 21, accel: 14, turn: 2.7, r: 0.8, seats: 'bike' },
    cruiser: { name: 'Cruiser', len: 2.2, wid: 0.85, speed: 19, accel: 11, turn: 2.3, r: 0.85, seats: 'bike' },
    scooter: { name: 'Scooter', len: 1.8, wid: 0.7, speed: 12.5, accel: 9, turn: 2.8, r: 0.8, seats: 'bike' },
    policebike: { name: 'Police Bike', len: 2.0, wid: 0.8, speed: 20, accel: 12, turn: 2.6, r: 0.8, seats: 'bike' },
    bicycle: { name: 'Bicycle', len: 1.75, wid: 0.6, speed: 5.2, accel: 3.2, turn: 2.6, r: 0.7, seats: 'bike' },
    helicopter: { name: 'Helicopter', len: 9, wid: 2.6, speed: 25, accel: 8, turn: 2.0, r: 3.5, seats: 'heli' },
  };
  const BIKES = { bike: 1, sport: 1, cruiser: 1, scooter: 1, policebike: 1, bicycle: 1 };
  /** licence category needed: A = motorcycle/scooter, B = car/jeep/van/pickup/tempo, G = bus/truck; null = none */
  KS.licenseFor = (kind) => (kind === 'bicycle' || kind === 'helicopter' ? null : ['bike', 'sport', 'cruiser', 'scooter', 'policebike'].includes(kind) ? 'A' : ['bus', 'minibus', 'truck'].includes(kind) ? 'G' : 'B');
  KS.isBike = (k) => !!BIKES[k];

  /* ---------- shared plates & boards ---------- */
  const NP_DIG = '०१२३४५६७८९';
  const npNum = (n) => String(n).split('').map((d) => NP_DIG[+d]).join('');
  const plateCache = { red: [], black: [], green: [], white: [] };
  function plateMat(kind) {
    const arr = plateCache[kind];
    if (arr.length < 5) {
      const bg = { red: '#c41a1a', black: '#111', green: '#1f8a3c', white: '#f4f4f4' }[kind], fg = kind === 'white' ? '#c41a1a' : '#fff';
      const t = KS.tex(128, 48, (g, w, h) => {
        g.fillStyle = bg; g.fillRect(0, 0, w, h); g.strokeStyle = fg; g.lineWidth = 2; g.strokeRect(2, 2, w - 4, h - 4);
        g.fillStyle = fg; g.font = `700 21px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(`बा ${npNum(KS.ri(1, 99))} ${KS.pick(['च', 'प', 'ख', 'क', 'झ', 'ज'])} ${npNum(KS.ri(1000, 9999))}`, w / 2, h / 2 + 2);
      });
      arr.push(new T.MeshBasicMaterial({ map: t }));
    }
    return KS.pick(arr);
  }
  const ROUTES = ['रत्नपार्क - कलंकी', 'लगनखेल - रत्नपार्क', 'कोटेश्वर - बालाजु', 'गोंगबु - सातदोबाटो', 'चाबहिल - कीर्तिपुर', 'बौद्ध - रत्नपार्क', 'नयाँ बसपार्क - भक्तपुर', 'कलंकी - धुनिबेसी', 'सुन्धारा - नागढुङ्गा'];
  KS.ROUTES_EN = ['Ratnapark!', 'Kalanki! Kalanki!', 'Koteshwor!', 'Balaju, Balaju!', 'Lagankhel!', 'Boudha, Chabahil!', 'Nagdhunga! Dhunibesi!'];
  const routeMats = [];
  function routeMat() {
    if (routeMats.length < ROUTES.length) {
      const txt = ROUTES[routeMats.length];
      routeMats.push(new T.MeshBasicMaterial({ map: KS.tex(256, 48, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb02e'; g.font = `700 26px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2); }) }));
    }
    return KS.pick(routeMats);
  }
  const signMats = {};
  /** the destination board for a bus on a fixed route */
  KS.routeSignMat = (txt) => signMats[txt] || (signMats[txt] = new T.MeshBasicMaterial({ map: KS.tex(256, 48, (g, w, h) => { g.fillStyle = '#111'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffb02e'; g.font = `700 26px ${KS.FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(txt, w / 2, h / 2 + 2, w - 10); }) }));
  const headMat = (KS.headMat = new T.MeshBasicMaterial({ color: 0xe8e6da }));
  const tailMat = (KS.tailMat = new T.MeshBasicMaterial({ color: 0x8a1010 }));
  KS.sirenMats = [new T.MeshBasicMaterial({ color: 0xff2020 }), new T.MeshBasicMaterial({ color: 0x2050ff })];

  /** motorbike rider: jacket, helmet with visor, gloves, shoes; optional pillion */
  function rider(b, y, z, o = {}) {
    const jacket = o.jacket || KS.pick([0x2a2f45, 0x1c1c1c, 0x5a4a3a, 0x3a4a3a, 0x7a1a1a, 0x1d3a6a, 0x6b6b5a]);
    const pants = o.pants || KS.pick([0x23283a, 0x2e2e2e, 0x3a3a46]);
    const skin = KS.pick([0xc68d5f, 0xb07a4f, 0xd8a47a]);
    for (const s of [-1, 1]) {
      b.box(s * 0.13, y, z + 0.12, 0.15, 0.17, 0.52, pants);
      b.box(s * 0.15, y - 0.46, z + 0.38, 0.13, 0.5, 0.14, pants);
      b.box(s * 0.15, y - 0.52, z + 0.48, 0.13, 0.1, 0.26, 0x111111);
      b.box(s * 0.22, y + 0.42, z + 0.28, 0.1, 0.1, 0.5, jacket, 0, -0.45);
      b.sphere(s * 0.24, y + 0.32, z + 0.55, 0.06, 0x111111, 1, 6);
    }
    b.cyl(0, y + 0.02, z - 0.02, 0.2, 0.62, jacket, 10, 0.92, 0, 0.18);
    b.box(0, y + 0.66, z + 0.03, 0.09, 0.08, 0.09, skin);
    b.sphere(0, y + 0.84, z + 0.02, 0.165, o.helmet || KS.pick([0xf4f4f4, 0x111111, 0xc81e1e, 0x1d4fb8, 0xf2c418, 0x0f8a7a]), 1.08, 10);
    b.box(0, y + 0.8, z + 0.15, 0.24, 0.1, 0.06, 0x111418); // visor
    if (o.uthao) { b.box(0, y + 0.22, z - 0.21, 0.3, 0.26, 0.02, 0xffffff); b.box(0, y + 0.3, z - 0.22, 0.12, 0.12, 0.02, 0x0f8a7a); }
    if (o.box) { b.box(0, y + 0.05, z - 0.62, 0.48, 0.48, 0.42, 0x0f8a7a); b.box(0, y + 0.3, z - 0.84, 0.3, 0.12, 0.02, 0xffffff); }
  }
  KS.bikeRider = rider;
  function pillion(b, y, z) {
    const sc = KS.pick([0xc8102e, 0xe23a8a, 0xf2a516, 0x7b1fa2, 0x2a6b8a, 0x2f2f3a]);
    const side = KS.chance(0.6); // women often sit side-saddle
    b.cyl(0.04, y, z, 0.19, 0.56, sc, 10, 0.92); b.box(0.04, y + 0.62, z, 0.09, 0.08, 0.09, 0xc68d5f);
    b.sphere(0.04, y + 0.78, z, 0.15, KS.chance(0.5) ? 0x111111 : 0xf4f4f4, 1.05, 8);
    if (side) { b.box(0.3, y - 0.25, z, 0.3, 0.3, 0.32, sc); b.box(0.42, y - 0.62, z, 0.12, 0.42, 0.14, 0xc68d5f); }
    else for (const s of [-1, 1]) b.box(s * 0.14, y - 0.4, z + 0.12, 0.12, 0.45, 0.13, 0x2a2f45);
  }
  KS.bikePillion = pillion;
  /** the conductor hanging out of a bus or micro's front door, calling the route */
  KS.busConductor = (root, W, L) => {
    const b = new KS.Builder(), y = 0.48;
    b.box(W / 2 + 0.25, y + 0.2, L / 2 - 1.5, 0.3, 0.9, 0.2, 0x2a2f45);
    b.box(W / 2 + 0.25, y + 1.1, L / 2 - 1.5, 0.36, 0.6, 0.24, KS.pick([0xd12b2b, 0x1d4fb8, 0xf2c418, 0xffffff]));
    b.sphere(W / 2 + 0.27, y + 1.9, L / 2 - 1.5, 0.13, 0xb07a4f, 1.15, 8);
    b.box(W / 2 + 0.4, y + 1.55, L / 2 - 1.3, 0.08, 0.5, 0.08, 0xb07a4f, 0, 0, -0.9);
    const m = new T.Mesh(b.build(), KS.M.vc); m.castShadow = true; root.add(m); return m;
  };

  /* night lights: a soft pool of light on the road ahead (no fake light cones), glowing lamps and red tail lights.
     Lamp glows of every vehicle are drawn as one point cloud, updated each night frame. */
  const poolTex = (() => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d'), im = g.createImageData(64, 128);
    for (let r = 0; r < 128; r++) for (let q = 0; q < 64; q++) {
      const t = r / 127, u = q / 63 - 0.5, w = 0.16 + 0.3 * t;
      const a = KS.smooth(0, 0.1, t) * Math.pow(1 - t, 1.7) * Math.exp(-(u * u) / (w * w) * 2.2);
      const k = (r * 64 + q) * 4; im.data[k] = 255; im.data[k + 1] = 236; im.data[k + 2] = 196; im.data[k + 3] = Math.round(255 * Math.min(1, a * 1.25));
    }
    g.putImageData(im, 0, 0); const t2 = new T.CanvasTexture(c); return t2;
  })();
  KS.beamPoolMat = new T.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: T.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -6 });
  KS.beamMat = KS.beamPoolMat; // kept for older callers
  const poolGeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
  const glowTex = KS.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.18, 'rgba(255,250,235,0.9)'); gr.addColorStop(0.45, 'rgba(255,230,180,0.25)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
  KS.beams = []; KS.glows = [];
  const MAXG = 900, gPos = new Float32Array(MAXG * 3), gCol = new Float32Array(MAXG * 3), gGeo = new T.BufferGeometry();
  gGeo.setAttribute('position', new T.BufferAttribute(gPos, 3)); gGeo.setAttribute('color', new T.BufferAttribute(gCol, 3)); gGeo.setDrawRange(0, 0);
  KS.glowPoints = new T.Points(gGeo, new T.PointsMaterial({ map: glowTex, size: 0.9, sizeAttenuation: true, vertexColors: true, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: 0 }));
  KS.glowPoints.frustumCulled = false;
  /** root: the vehicle or person; x,y,z: the lamp; small: a hand torch. opt.wid / opt.len: vehicle size for twin lamps and tail lights */
  KS.addBeam = (root, x, y, z, small, opt = {}) => {
    const p = new T.Mesh(poolGeo, KS.beamPoolMat);
    if (small) { p.scale.set(1.8, 1, 4.2); p.position.set(x * 0.5, 0.06 - root.position.y, z + 2.1); }
    else { const big = opt.wid > 1.2; p.scale.set(big ? 5.2 : 3.6, 1, big ? 13 : 10); p.position.set(x, 0.08 - root.position.y, z + (big ? 6.3 : 4.9)); }
    p.visible = false; p.renderOrder = 2; root.add(p); KS.beams.push(p);
    const add = (lx, ly, lz, s, r, g, b) => KS.glows.push({ root, v: new T.Vector3(lx, ly, lz), s, c: [r, g, b] });
    if (small) add(x, y, z, 0.5, 1, 0.95, 0.8);
    else if (opt.wid > 1.2) { const w = opt.wid * 0.36; add(x - w, y, z, 1, 1, 0.97, 0.88); add(x + w, y, z, 1, 1, 0.97, 0.88); if (opt.len) { add(-w, y + 0.05, -opt.len / 2 - 0.03, 0.6, 0.9, 0.05, 0.04); add(w, y + 0.05, -opt.len / 2 - 0.03, 0.6, 0.9, 0.05, 0.04); } }
    else { add(x, y, z, 0.85, 1, 0.97, 0.88); if (opt.len) add(0, y - 0.1, -opt.len / 2, 0.45, 0.9, 0.05, 0.04); }
    return p;
  };
  const wv = new T.Vector3();
  const shown = (o) => { if (!o.parent) return false; for (let k = 0; o && k < 4; k++, o = o.parent) if (!o.visible) return false; return true; };
  /** move the lamp glows to where their vehicles and walkers are (night only) */
  KS.updateGlows = (camPos) => {
    let n = 0;
    for (const L of KS.glows) {
      if (n >= MAXG) break; const r = L.root;
      if (Math.abs(r.position.x - camPos.x) > 260 || Math.abs(r.position.z - camPos.z) > 260 || !shown(r)) continue;
      wv.copy(L.v).applyMatrix4(r.matrixWorld); gPos[n * 3] = wv.x; gPos[n * 3 + 1] = wv.y; gPos[n * 3 + 2] = wv.z;
      gCol[n * 3] = L.c[0] * L.s; gCol[n * 3 + 1] = L.c[1] * L.s; gCol[n * 3 + 2] = L.c[2] * L.s; n++;
    }
    gGeo.setDrawRange(0, n); gGeo.attributes.position.needsUpdate = true; gGeo.attributes.color.needsUpdate = true;
  };
  /** Build a vehicle from its GLB model, dressed and lit. Returns null when
      the model has not loaded — the caller skips that vehicle instead of
      showing a blocky stand-in. There is no code-built vehicle any more. */
  KS.buildVehicle = (type, opt) => {
    const VM = KS.VehicleModels;
    if (!VM || !VM.ready || !VM.has(type, opt || {})) return null;
    const r = VM.build(type, opt || {});
    if (!r) return null;
    KS.addVehicleDressing(r, type, opt || {});
    // headlight pool on the road ahead — not for the helicopter, it would hang in the air
    if (type !== 'helicopter') {
      const VT = KS.VTYPES[type], L = VT.len;
      KS.addBeam(r.root, 0, KS.isBike(type) ? 0.95 : 0.75, L / 2 + 0.05, false, { wid: KS.isBike(type) ? 0.5 : VT.wid, len: L });
    }
    return r;
  };
  /** dress a GLB vehicle the Kathmandu way: Nepali number plate, route board,
      taxi roof sign and a light bar the siren code can flash. The GLB itself
      carries no markings, so these keep it looking like it belongs here. */
  KS.addVehicleDressing = (r, type, opt) => {
    const VT = KS.VTYPES[type], L = VT.len, W = VT.wid;
    if (!KS.isBike(type) && type !== 'helicopter') {
      /* Nepali plates, front and rear, so the plate is never a mystery:
         red for private cars, black for public ones (taxi, tempo), green for EVs. */
      const kind = (type === 'taxi' || type === 'tempo') ? 'black' : type === 'ev' ? 'green' : 'red';
      const rear = new T.Mesh(new T.PlaneGeometry(0.6, 0.23), plateMat(kind));
      rear.position.set(0, 0.5, -L / 2 - 0.03); rear.rotation.y = Math.PI; r.root.add(rear);
      const front = new T.Mesh(new T.PlaneGeometry(0.6, 0.23), plateMat(kind));
      front.position.set(0, 0.5, L / 2 + 0.03); r.root.add(front);
    }
    if (type === 'bus' || type === 'micro' || type === 'minibus') {
      const rb = new T.Mesh(new T.PlaneGeometry(W * 0.75, 0.3), routeMat());
      rb.position.set(0, type === 'bus' ? 2.85 : type === 'minibus' ? 2.2 : 1.85, L / 2 + 0.03);
      r.root.add(rb); r.root.userData.routeBoard = rb;
    }
    if (type === 'taxi') {
      const s = new T.Mesh(new T.BoxGeometry(0.7, 0.22, 0.32), new T.MeshLambertMaterial({ color: 0xf2c418 }));
      s.position.set(0, 1.56, -0.25); r.root.add(s);
    }
    if (type === 'police' || type === 'policebike' || type === 'ambulance') {
      const bike = type === 'policebike', w = bike ? 0.18 : 0.45;
      const y = (r.glbHeight || 1.7) + 0.06, z = type === 'ambulance' ? L / 2 - 0.9 : bike ? -0.6 : -0.25;
      const r1 = new T.Mesh(new T.BoxGeometry(w, 0.16, 0.25), KS.sirenMats[0]);
      r1.position.set(bike ? -0.12 : -0.27, y, z); r.root.add(r1);
      const b1 = new T.Mesh(new T.BoxGeometry(w, 0.16, 0.25), KS.sirenMats[1]);
      b1.position.set(bike ? 0.12 : 0.27, y, z); r.root.add(b1);
      r.sirens.push(r1, b1);
      if (type !== 'ambulance') { const off = new T.MeshBasicMaterial({ color: 0x333344 }); r1.userData.on = r1.material; b1.userData.on = b1.material; r1.material = b1.material = off; }
    }
  };
  /** switch a police vehicle's light bar on or off */
  KS.setSiren = (v, on) => { if (!v.sirens) return; for (const m of v.sirens) if (m.userData.on) { if (on && !m.userData.offMat) m.userData.offMat = m.material; m.material = on ? m.userData.on : m.userData.offMat || m.material; } v.sirenOn = on; };
})();
