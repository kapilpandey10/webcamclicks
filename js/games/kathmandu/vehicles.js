/* Kathmandu Streets — vehicle models (forward = +z). Shaped from many small parts: bonnets, sloped glass,
   pillars, wheel arches, mirrors, grilles, bumpers, lamps, plates, riders. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const GLASS = 0x22303a, DARK = 0x1a1a1a, CHROME = 0xc8ccd0, TYRE = 0x141414, RIM = 0xb0b4b8;

  KS.VTYPES = {
    car: { name: 'Hatchback', len: 3.8, wid: 1.72, speed: 13, accel: 7, turn: 1.9, r: 1.7, seats: 'car' },
    sedan: { name: 'Sedan', len: 4.5, wid: 1.78, speed: 14.5, accel: 7.5, turn: 1.75, r: 1.9, seats: 'car' },
    suv: { name: 'SUV', len: 4.6, wid: 1.9, speed: 14, accel: 7, turn: 1.6, r: 2.0, seats: 'car' },
    ev: { name: 'Electric Car', len: 4.1, wid: 1.8, speed: 15, accel: 10, turn: 1.85, r: 1.8, seats: 'car' },
    taxi: { name: 'Taxi', len: 3.7, wid: 1.66, speed: 13, accel: 7, turn: 2.0, r: 1.7, seats: 'car' },
    police: { name: 'Police Jeep', len: 4.4, wid: 1.9, speed: 15, accel: 8, turn: 1.8, r: 1.9, seats: 'car' },
    ambulance: { name: 'Ambulance', len: 5.2, wid: 1.95, speed: 15, accel: 7, turn: 1.6, r: 2.2, seats: 'van' },
    micro: { name: 'Micro Bus', len: 5.0, wid: 1.9, speed: 12, accel: 5.5, turn: 1.6, r: 2.1, seats: 'van' },
    minibus: { name: 'Minibus', len: 7.4, wid: 2.2, speed: 11, accel: 4.2, turn: 1.25, r: 2.6, seats: 'bus' },
    bus: { name: 'City Bus', len: 10.6, wid: 2.5, speed: 10, accel: 3.6, turn: 1.0, r: 3.2, seats: 'bus' },
    tempo: { name: 'Safa Tempo', len: 3.8, wid: 1.55, speed: 8.5, accel: 4.5, turn: 2.0, r: 1.6, seats: 'van' },
    truck: { name: 'Painted Truck', len: 8, wid: 2.4, speed: 9, accel: 3.2, turn: 1.1, r: 2.8, seats: 'bus' },
    pickup: { name: 'Pickup', len: 5.0, wid: 1.85, speed: 13, accel: 6.5, turn: 1.6, r: 2.1, seats: 'car' },
    bike: { name: 'Commuter Bike', len: 2.0, wid: 0.75, speed: 16, accel: 10, turn: 2.6, r: 0.8, seats: 'bike' },
    sport: { name: 'Sport Bike', len: 2.05, wid: 0.72, speed: 21, accel: 14, turn: 2.7, r: 0.8, seats: 'bike' },
    cruiser: { name: 'Cruiser', len: 2.2, wid: 0.85, speed: 18, accel: 11, turn: 2.3, r: 0.85, seats: 'bike' },
    scooter: { name: 'Scooter', len: 1.8, wid: 0.7, speed: 13, accel: 9, turn: 2.8, r: 0.8, seats: 'bike' },
    policebike: { name: 'Police Bike', len: 2.0, wid: 0.8, speed: 19, accel: 12, turn: 2.6, r: 0.8, seats: 'bike' },
    bicycle: { name: 'Bicycle', len: 1.75, wid: 0.6, speed: 5.2, accel: 3.2, turn: 2.6, r: 0.7, seats: 'bike' },
  };
  const BIKES = { bike: 1, sport: 1, cruiser: 1, scooter: 1, policebike: 1, bicycle: 1 };
  /** licence category needed: A = motorcycle/scooter, B = car/jeep/van/pickup/tempo, G = bus/truck; null = none */
  KS.licenseFor = (kind) => (kind === 'bicycle' ? null : ['bike', 'sport', 'cruiser', 'scooter', 'policebike'].includes(kind) ? 'A' : ['bus', 'minibus', 'truck'].includes(kind) ? 'G' : 'B');
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
  let truckMat, ambMat;
  function truckBack() {
    return truckMat || (truckMat = new T.MeshLambertMaterial({ map: KS.tex(256, 160, (g, w, h) => {
      g.fillStyle = '#f2a516'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i++) { g.fillStyle = ['#c81e1e', '#1d4fb8', '#1f9a4c', '#7b1fa2'][i % 4]; g.fillRect(0, i * 6, w, 3); }
      g.fillStyle = '#fff'; g.beginPath(); for (let x = 0; x < w; x += 20) { g.moveTo(x, 150); g.lineTo(x + 10, 135); g.lineTo(x + 20, 150); } g.fill();
      g.fillStyle = '#b3121b'; g.font = '900 34px Impact, sans-serif'; g.textAlign = 'center'; g.fillText('HORN PLEASE', w / 2, 92);
      g.fillStyle = '#1d3a8a'; g.font = `700 22px ${KS.FONT}`; g.fillText('फेरि भेटौँला', w / 2, 122);
      g.fillStyle = '#111'; g.font = '700 16px sans-serif'; g.fillText('USE DIPPER AT NIGHT', w / 2, 58);
    }) }));
  }
  function ambBoard() {
    return ambMat || (ambMat = new T.MeshBasicMaterial({ map: KS.tex(256, 64, (g, w, h) => { g.fillStyle = '#fff'; g.fillRect(0, 0, w, h); g.fillStyle = '#c8102e'; g.font = '800 34px "Barlow Condensed", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('AMBULANCE · एम्बुलेन्स', w / 2, h / 2 + 2); }) }));
  }
  const headMat = (KS.headMat = new T.MeshBasicMaterial({ color: 0xe8e6da }));
  const tailMat = (KS.tailMat = new T.MeshBasicMaterial({ color: 0x8a1010 }));
  KS.sirenMats = [new T.MeshBasicMaterial({ color: 0xff2020 }), new T.MeshBasicMaterial({ color: 0x2050ff })];

  /* ---------- parts ---------- */
  /** wheel whose outer face sits at xOuter (signed) */
  function wheel(b, xOuter, z, r, w) {
    const right = xOuter > 0, o = right ? xOuter : xOuter + w;
    b.cyl(o, r, z, r, w, TYRE, 14, 1, 0, 0, Math.PI / 2);
    b.cyl(right ? xOuter + 0.012 : xOuter + 0.008, r, z, r * 0.58, 0.02, RIM, 10, 1, 0, 0, Math.PI / 2);
  }
  function wheels4(b, W, zf, zr, r, w = 0.22) { for (const z of [zf, zr]) { wheel(b, W / 2 + w * 0.4, z, r, w); wheel(b, -W / 2 - w * 0.4, z, r, w); } }
  function arches(b, W, zs, r, y = 0) { for (const z of zs) for (const s of [-1, 1]) b.box(s * (W / 2 - 0.02), y + r * 1.05, z, 0.06, 0.18, r * 2.5, DARK); }
  function mirrors(b, W, y, z, col) { for (const s of [-1, 1]) { b.box(s * (W / 2 + 0.1), y, z, 0.18, 0.12, 0.08, col); b.box(s * (W / 2 + 0.03), y - 0.02, z - 0.02, 0.06, 0.04, 0.04, DARK); } }
  function lampsF(L, W, y, sx = 0.32, w = 0.34, h = 0.16) { const l = new KS.Builder(); l.box(-W / 2 + sx, y, L / 2 + 0.005, w, h, 0.05, 0xffffff); l.box(W / 2 - sx, y, L / 2 + 0.005, w, h, 0.05, 0xffffff); return l; }
  function lampsR(L, W, y, sx = 0.25, w = 0.28, h = 0.18) { const l = new KS.Builder(); l.box(-W / 2 + sx, y, -L / 2 - 0.005, w, h, 0.05, 0xffffff); l.box(W / 2 - sx, y, -L / 2 - 0.005, w, h, 0.05, 0xffffff); return l; }

  /** a passenger car body: hood, sloped windscreen, cabin with pillars and glass, boot */
  function carBody(b, o) {
    const { L, W, col, H = 0.62, cab = 0.5, cabZ = -0.1, roofH = 0.58, clear = 0.3, boot = 0 } = o;
    b.box(0, clear, 0, W, H, L, col);                                          // lower body
    b.box(0, clear + 0.02, 0, W + 0.02, 0.14, L * 0.62, DARK);                // side skirt
    b.box(0, clear + H - 0.02, L * 0.5 - (L * (0.5 - cab / 2 + cabZ) + 0.0) / 2 - 0.02, W - 0.04, 0.06, L * (0.5 - cab / 2 - cabZ) - 0.2, col, 0, 0.04); // bonnet
    const cy = clear + H, cz = L * cabZ, cl = L * cab;
    b.box(0, cy, cz, W - 0.1, roofH, cl * 0.82, GLASS);                       // glass house
    for (const s of [-1, 1]) {
      b.box(s * (W / 2 - 0.07), cy, cz + cl * 0.42, 0.07, roofH, 0.1, col, 0, 0, 0); // A pillar
      b.box(s * (W / 2 - 0.07), cy, cz, 0.07, roofH, 0.09, col);               // B pillar
      b.box(s * (W / 2 - 0.07), cy, cz - cl * 0.42, 0.08, roofH, 0.14, col);   // C pillar
      b.box(s * (W / 2 + 0.005), clear + H * 0.55, cz + 0.1, 0.01, 0.03, cl * 0.9, DARK); // door line
      b.box(s * (W / 2 + 0.02), clear + H * 0.72, cz + 0.25, 0.03, 0.05, 0.18, CHROME); // handle
    }
    b.box(0, cy + roofH - 0.02, cz, W - 0.14, 0.08, cl * 0.86, col);        // roof
    b.box(0, cy - 0.02, cz + cl * 0.42, W - 0.14, 0.05, 0.75, GLASS, 0, 0.62); // windscreen (sloped)
    b.box(0, cy - 0.02, cz - cl * 0.43, W - 0.16, 0.05, 0.55, GLASS, 0, -0.75); // rear glass
    if (boot) b.box(0, cy - 0.04, -L / 2 + boot / 2, W - 0.06, 0.12, boot, col);
    b.box(0, clear - 0.05, L / 2 - 0.08, W + 0.02, 0.28, 0.16, DARK);       // front bumper
    b.box(0, clear - 0.05, -L / 2 + 0.08, W + 0.02, 0.28, 0.16, DARK);      // rear bumper
    b.box(0, clear + 0.22, L / 2 + 0.005, W * 0.42, 0.18, 0.04, 0x0e0e0e);  // grille
    mirrors(b, W, cy + 0.1, cz + cl * 0.42 - 0.1, col);
  }
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

  /* ---------- builders ---------- */
  function build(type, opt = {}) {
    const t = KS.VTYPES[type], L = t.len, W = t.wid;
    const b = new KS.Builder(), riderB = new KS.Builder(), extra = [], sirens = [];
    let lights = null, tails = null, plate = 'red', route = false, siren = false, color = opt.color;
    switch (type) {
      case 'car': case 'taxi': case 'ev': {
        color = color || (type === 'taxi' ? 0xf4f3ee : type === 'ev' ? KS.pick([0xf4f4f4, 0x2a8a8a, 0x3a5a8a, 0xc8c8cc]) : KS.pick([0xc81e1e, 0xd8d8d8, 0x2a2a2a, 0x1d4fb8, 0x8a8a90, 0xf2f2ee, 0x7a1414, 0x2f6b3a, 0xb8b2a2]));
        carBody(b, { L, W, col: color, H: type === 'ev' ? 0.58 : 0.62, cab: 0.54, cabZ: -0.08, roofH: type === 'ev' ? 0.52 : 0.6 });
        wheels4(b, W, L * 0.31, -L * 0.33, 0.3); arches(b, W, [L * 0.31, -L * 0.33], 0.3);
        if (type === 'taxi') { b.box(0, 1.56, -0.25, 0.7, 0.22, 0.32, 0xf2c418); b.box(0, 0.62, 0, W + 0.03, 0.08, L * 0.7, 0x111111); plate = 'black'; }
        if (type === 'ev') { b.box(0, 0.52, L / 2 - 0.02, W * 0.6, 0.05, 0.04, 0x9fd8ff); plate = 'green'; }
        lights = lampsF(L, W, 0.72); tails = lampsR(L, W, 0.78);
        break;
      }
      case 'sedan': {
        color = color || KS.pick([0xd8d8d8, 0x1a1a1a, 0x2a3a5a, 0x7a1414, 0xf2f2ee, 0x8a8a90]);
        carBody(b, { L, W, col: color, H: 0.6, cab: 0.46, cabZ: -0.04, roofH: 0.56, boot: 0.9 });
        wheels4(b, W, L * 0.32, -L * 0.31, 0.31); arches(b, W, [L * 0.32, -L * 0.31], 0.31);
        lights = lampsF(L, W, 0.72, 0.3, 0.42, 0.13); tails = lampsR(L, W, 0.76, 0.25, 0.4, 0.12);
        break;
      }
      case 'suv': case 'police': {
        color = color || (type === 'police' ? 0x1e3a78 : KS.pick([0xf4f4f4, 0x1a1a1a, 0x4a4a4a, 0x6b5a3a, 0x7a1414, 0x2a4a3a]));
        carBody(b, { L, W, col: color, H: 0.82, cab: 0.66, cabZ: -0.06, roofH: 0.66, clear: 0.42 });
        b.box(-W / 2 + 0.2, 2.34, 0, 0.06, 0.06, L * 0.5, 0x333333); b.box(W / 2 - 0.2, 2.34, 0, 0.06, 0.06, L * 0.5, 0x333333);
        b.cyl(0, 0.75, -L / 2 - 0.05, 0.34, 0.24, TYRE, 12, 1, 0, -Math.PI / 2); // spare wheel
        wheels4(b, W, L * 0.32, -L * 0.3, 0.37, 0.26); arches(b, W, [L * 0.32, -L * 0.3], 0.37);
        if (type === 'police') { b.box(0, 0.86, 0, W + 0.03, 0.14, L * 0.96, 0xf4f4f4); siren = true; plate = 'white'; }
        lights = lampsF(L, W, 0.95, 0.3, 0.36, 0.2); tails = lampsR(L, W, 1.05);
        break;
      }
      case 'pickup': {
        color = color || KS.pick([0xf4f4f4, 0xc81e1e, 0x2a2a2a, 0x8a8a90]);
        b.box(0, 0.45, 0, W, 0.7, L, color); b.box(0, 0.42, 0, W + 0.02, 0.16, L * 0.6, DARK);
        b.box(0, 1.15, L * 0.12, W - 0.08, 0.64, L * 0.36, GLASS); b.box(0, 1.77, L * 0.12, W - 0.12, 0.08, L * 0.34, color);
        for (const s of [-1, 1]) { b.box(s * (W / 2 - 0.06), 1.15, L * 0.29, 0.07, 0.64, 0.1, color); b.box(s * (W / 2 - 0.06), 1.15, -L * 0.05, 0.08, 0.64, 0.12, color); }
        b.box(0, 1.13, L * 0.31, W - 0.14, 0.05, 0.6, GLASS, 0, 0.55);
        b.box(0, 1.15, -L * 0.3, W, 0.42, 0.06, color); b.box(-W / 2 + 0.03, 1.15, -L * 0.3, 0.06, 0.42, L * 0.38, color); b.box(W / 2 - 0.03, 1.15, -L * 0.3, 0.06, 0.42, L * 0.38, color); b.box(0, 1.15, -L / 2 + 0.03, W, 0.42, 0.06, color);
        b.box(0, 0.25, L / 2 - 0.08, W + 0.02, 0.3, 0.16, CHROME); b.box(0, 0.72, L / 2, W * 0.5, 0.26, 0.04, 0x0e0e0e);
        wheels4(b, W, L * 0.33, -L * 0.3, 0.37, 0.26); arches(b, W, [L * 0.33, -L * 0.3], 0.37); mirrors(b, W, 1.3, L * 0.27, color);
        lights = lampsF(L, W, 0.9); tails = lampsR(L, W, 0.95);
        break;
      }
      case 'micro': case 'ambulance': {
        color = color || 0xf4f4f0; const stripe = type === 'ambulance' ? 0xc8102e : KS.pick([0x1d4fb8, 0x1f9a4c, 0xc81e1e, 0xf2a516]);
        b.box(0, 0.38, -0.25, W, 1.75, L - 0.5, color); b.box(0, 0.38, L / 2 - 0.4, W, 1.05, 0.8, color);
        b.box(0, 1.43, L / 2 - 0.62, W - 0.14, 0.7, 0.05, GLASS, 0, 0.42); // sloped windscreen
        b.box(0, 1.25, -0.4, W + 0.02, 0.6, L - 1.8, type === 'ambulance' ? 0xdce6ea : GLASS);
        for (let i = 0; i < 4; i++) b.box(0, 1.25, -L / 2 + 0.7 + i * 0.95, W + 0.03, 0.6, 0.08, color);
        b.box(0, 0.78, 0, W + 0.03, 0.16, L, stripe); b.box(W / 2 + 0.01, 0.5, 0.2, 0.02, 1.35, 0.02, DARK); // sliding door seam
        b.box(0, 0.25, L / 2 - 0.05, W + 0.02, 0.28, 0.14, DARK); b.box(0, 0.25, -L / 2 + 0.06, W + 0.02, 0.28, 0.14, DARK);
        if (type === 'micro') { b.box(0, 2.14, -0.5, W - 0.3, 0.12, L * 0.5, 0x444444); plate = 'black'; route = true; }
        else { siren = true; plate = 'white'; extra.push(['amb', L, W]); }
        wheels4(b, W, L * 0.33, -L * 0.32, 0.33); arches(b, W, [L * 0.33, -L * 0.32], 0.33); mirrors(b, W, 1.35, L / 2 - 0.7, color);
        lights = lampsF(L, W, 0.78, 0.3, 0.36, 0.2); tails = lampsR(L, W, 1.0, 0.18, 0.2, 0.36);
        break;
      }
      case 'bus': case 'minibus': {
        const big = type === 'bus';
        color = color || (big ? KS.pick([0x2f8a4a, 0x1d4fb8, 0xc81e1e, 0x2f8a4a]) : KS.pick([0xf2a516, 0xc81e1e, 0x6d1a8a, 0x1d4fb8, 0xf4f4f0]));
        const H = big ? 2.55 : 2.2, y = 0.48;
        b.box(0, y, 0, W, H, L, color);
        b.box(0, y + H * 0.45, 0.2, W + 0.02, H * 0.38, L - 2.2, GLASS);
        for (let z = -L / 2 + 0.9; z < L / 2 - 1.4; z += 1.15) b.box(0, y + H * 0.45, z, W + 0.03, H * 0.38, 0.12, color); // window pillars
        b.box(0, y + 0.6, L / 2 - 0.02, W - 0.24, H * 0.55, 0.06, GLASS, 0, 0.12); // windscreen
        b.box(0, y + 0.25, 0, W + 0.03, 0.28, L, 0xf4f4f0); b.box(0, y + H * 0.88, 0, W + 0.03, 0.12, L, big ? 0xf4f4f0 : KS.pick([0xf2c418, 0xffffff, 0xc81e1e]));
        b.box(W / 2 + 0.01, y, L / 2 - 1.5, 0.03, H * 0.82, 0.95, 0x2a2a2a); b.box(W / 2 + 0.01, y, -0.6, 0.03, H * 0.82, 0.95, 0x2a2a2a); // doors
        b.box(0, y - 0.2, L / 2 - 0.05, W + 0.02, 0.35, 0.16, DARK);
        if (!big || KS.chance(0.5)) { b.box(0, y + H + 0.02, -0.5, W - 0.2, 0.1, L * 0.6, 0x444444); for (let i = 0; i < 5; i++) b.box(KS.r(-0.6, 0.6), y + H + 0.12, KS.r(-L * 0.28, L * 0.2), KS.r(0.6, 1), KS.r(0.4, 0.8), KS.r(0.6, 1.2), KS.pick([0x1d4fb8, 0xc81e1e, 0x5a4a3a, 0x1f9a4c, 0xf2c418])); }
        const r = big ? 0.5 : 0.42; wheels4(b, W, L * 0.32, -L * 0.3, r, 0.3); arches(b, W, [L * 0.32, -L * 0.3], r);
        mirrors(b, W, y + H * 0.7, L / 2 - 0.3, DARK);
        // conductor hanging out of the front door, calling the route
        if (opt.conductor !== false) { riderB.box(W / 2 + 0.25, y + 0.2, L / 2 - 1.5, 0.3, 0.9, 0.2, 0x2a2f45); riderB.box(W / 2 + 0.25, y + 1.1, L / 2 - 1.5, 0.36, 0.6, 0.24, KS.pick([0xd12b2b, 0x1d4fb8, 0xf2c418, 0xffffff])); riderB.sphere(W / 2 + 0.27, y + 1.9, L / 2 - 1.5, 0.13, 0xb07a4f, 1.15, 8); riderB.box(W / 2 + 0.4, y + 1.55, L / 2 - 1.3, 0.08, 0.5, 0.08, 0xb07a4f, 0, 0, -0.9); }
        plate = 'black'; route = true;
        lights = lampsF(L, W, y + 0.45, 0.35, 0.4, 0.24); tails = lampsR(L, W, y + 0.5, 0.25, 0.28, 0.3);
        break;
      }
      case 'truck': {
        color = color || KS.pick([0xf2a516, 0xc81e1e, 0x1d4fb8, 0x1f9a4c]);
        b.box(0, 0.6, L / 2 - 1.2, W, 2.1, 2.3, color); b.box(0, 1.7, L / 2 - 0.02, W - 0.3, 0.8, 0.1, GLASS);
        b.box(0, 2.7, L / 2 - 1.1, W + 0.1, 0.5, 2.3, 0xf2c418);
        for (let i = 0; i < 5; i++) b.box(-W / 2 + 0.25 + (i * (W - 0.5)) / 4, 2.95, L / 2 - 0.05, 0.25, 0.25, 0.08, [0xc81e1e, 0x1d4fb8, 0x1f9a4c, 0xffffff, 0x7b1fa2][i]);
        b.box(0, 0.6, -1.2, W, 0.25, L - 2.4, 0x5a4a3a); b.box(0, 0.85, -1.2, W, 1.9, L - 2.6, KS.pick([0xc8a050, 0x8a3a2a, 0x2f6b3a]));
        for (let i = 0; i < 4; i++) b.box(0, 1.0 + i * 0.45, -1.2, W + 0.04, 0.08, L - 2.6, KS.pick([0xc81e1e, 0x1d4fb8, 0xf2c418, 0xffffff]));
        for (const z of [L * 0.36, -L * 0.15, -L * 0.36]) { wheel(b, W / 2 + 0.1, z, 0.5, 0.32); wheel(b, -W / 2 - 0.1, z, 0.5, 0.32); }
        mirrors(b, W, 2, L / 2 - 0.3, DARK); plate = 'black'; extra.push(['truck', L, W]);
        lights = lampsF(L, W, 0.95, 0.35, 0.4, 0.25); tails = lampsR(L, W, 0.9);
        break;
      }
      case 'tempo': {
        color = color || 0x2fa84f;
        b.box(0, 0.3, L / 2 - 0.65, W * 0.78, 1.45, 1.2, color); b.box(0, 1.15, L / 2 - 0.02, W * 0.66, 0.5, 0.06, GLASS, 0, 0.15);
        b.box(0, 0.3, -0.5, W, 1.8, L - 1.3, color); b.box(0, 1.25, -0.5, W + 0.02, 0.52, L - 1.6, GLASS);
        for (let i = 0; i < 3; i++) b.box(0, 1.25, -L / 2 + 0.4 + i * 0.75, W + 0.03, 0.52, 0.07, color);
        b.box(0, 2.1, -0.3, W + 0.1, 0.1, L - 0.7, 0xf4f4f4); b.box(0, 0.78, -0.5, W + 0.02, 0.14, L - 1.3, 0xf4f4f4);
        b.box(0, 0.4, -L / 2 + 0.02, W * 0.6, 1.4, 0.04, 0x1a1a1a);
        b.cyl(0.08, 0.28, L / 2 - 0.45, 0.28, 0.16, TYRE, 12, 1, 0, 0, Math.PI / 2);
        wheel(b, W / 2 + 0.08, -L * 0.3, 0.3, 0.2); wheel(b, -W / 2 - 0.08, -L * 0.3, 0.3, 0.2);
        lights = new KS.Builder(); lights.box(0, 1.15, L / 2 + 0.03, 0.28, 0.2, 0.05, 0xffffff); tails = lampsR(L, W, 0.7, 0.15, 0.2, 0.2);
        plate = 'green'; break;
      }
      case 'bicycle': {
        color = color || KS.pick([0x1d4fb8, 0xc81e1e, 0x111111, 0x2f7d32, 0xe0a400, 0x9a9a9a]);
        for (const z of [0.55, -0.55]) { b.cyl(0.03, 0.34, z, 0.34, 0.035, 0x141414, 18, 1, 0, 0, Math.PI / 2); b.cyl(0.035, 0.34, z, 0.3, 0.02, 0xb8b8b8, 12, 1, 0, 0, Math.PI / 2); b.cyl(0.04, 0.34, z, 0.05, 0.06, 0x888888, 8, 1, 0, 0, Math.PI / 2); }
        b.box(0, 0.62, 0.0, 0.04, 0.04, 0.72, color, 0, -0.12);   // top tube
        b.box(0, 0.36, 0.12, 0.04, 0.04, 0.62, color, 0, 0.55);   // down tube
        b.box(0, 0.36, -0.18, 0.04, 0.48, 0.04, color, 0, 0.2);   // seat tube
        b.box(0, 0.34, -0.38, 0.03, 0.03, 0.4, color, 0, 0.05);   // chain stay
        b.box(0, 0.36, -0.36, 0.03, 0.03, 0.45, color, 0, -0.65); // seat stay
        b.box(0, 0.34, 0.5, 0.04, 0.5, 0.04, 0x9a9a9a, 0, -0.32); // fork
        b.box(0, 0.86, -0.22, 0.12, 0.05, 0.24, 0x111111);       // saddle
        b.box(0, 0.92, 0.36, 0.56, 0.03, 0.03, 0x333333);        // bars
        b.cyl(0.08, 0.32, -0.08, 0.1, 0.02, 0x555555, 12, 1, 0, 0, Math.PI / 2); // chainring
        b.box(0, 0.6, -0.62, 0.16, 0.03, 0.28, 0x333333);        // rear carrier
        lights = new KS.Builder(); lights.sphere(0, 0.86, 0.5, 0.05, 0xffffff, 1, 6);
        tails = new KS.Builder(); tails.box(0, 0.62, -0.78, 0.06, 0.04, 0.03, 0xffffff);
        if (opt.rider !== false) rider(riderB, 0.82, -0.25, { helmet: KS.pick([0xf4f4f4, 0x1d4fb8, 0xc81e1e]) });
        plate = null; break;
      }
      default: { // two-wheelers
        color = color || KS.pick([0xc81e1e, 0x111111, 0x1d4fb8, 0xdddddd, 0x2f7d32, 0xe0a400, 0x7b1fa2, 0x6a6a6a]);
        const scooter = type === 'scooter', sport = type === 'sport' || type === 'policebike', cruiser = type === 'cruiser';
        if (type === 'policebike') color = color || 0xf4f4f4;
        const wr = scooter ? 0.26 : cruiser ? 0.36 : 0.33, zf = scooter ? 0.62 : 0.72, zr = scooter ? -0.6 : -0.68;
        for (const z of [zf, zr]) { b.cyl(0.07, wr, z, wr, 0.14, TYRE, 14, 1, 0, 0, Math.PI / 2); b.cyl(0.075, wr, z, wr * 0.55, 0.15, scooter ? 0x888888 : 0x444444, 8, 1, 0, 0, Math.PI / 2); }
        if (scooter) {
          b.box(0, 0.25, -0.25, 0.4, 0.5, 0.95, color); b.box(0, 0.25, 0.38, 0.38, 0.85, 0.18, color, 0, -0.18); b.box(0, 0.2, 0.08, 0.34, 0.1, 0.55, 0x2a2a2a);
          b.box(0, 0.75, -0.25, 0.32, 0.13, 0.72, 0x1a1a1a); b.box(0, 1.0, 0.5, 0.5, 0.12, 0.16, color); b.box(0, 0.3, zf, 0.16, 0.12, 0.42, color);
        } else {
          b.box(0, wr + 0.08, 0, 0.26, 0.32, 0.55, 0x333333); // engine
          b.cyl(0.18, wr * 0.75, -0.25, 0.06, 0.8, CHROME, 8, 1, 0, -Math.PI / 2 + 0.15, 0); // exhaust
          b.box(0, sport ? 0.86 : 0.82, 0.22, 0.32, 0.24, 0.5, color); // tank
          b.box(0, sport ? 0.9 : cruiser ? 0.72 : 0.84, -0.32, 0.28, 0.1, sport ? 0.45 : 0.6, 0x111111); // seat
          b.box(0, wr + 0.3, -0.62, 0.22, 0.12, 0.45, color, 0, sport ? -0.35 : 0); // tail
          b.box(0, wr + 0.12, zf + 0.0, 0.16, 0.05, 0.4, color); // front mudguard
          for (const s of [-1, 1]) b.box(s * 0.08, wr, zf - 0.05, 0.05, 0.75, 0.05, CHROME, 0, -0.35); // fork
          if (sport) { b.box(0, 0.82, 0.62, 0.42, 0.42, 0.28, color, 0, -0.5); b.box(0, 1.12, 0.66, 0.3, 0.16, 0.04, GLASS, 0, -0.6); b.box(-0.17, 0.5, 0.2, 0.04, 0.35, 0.6, color); b.box(0.17, 0.5, 0.2, 0.04, 0.35, 0.6, color); }
          if (cruiser) { b.box(0, 0.68, -0.15, 0.36, 0.08, 0.5, 0x3a2414); b.cyl(-0.12, wr * 0.75, -0.3, 0.06, 0.8, CHROME, 8, 1, 0, -Math.PI / 2 + 0.1, 0); }
          if (!sport) { b.box(0, 0.96, -0.95, 0.3, 0.04, 0.3, 0x333333); } // rear carrier
        }
        b.box(0, sport ? 1.0 : 1.1, scooter ? 0.48 : 0.6, cruiser ? 0.95 : 0.72, 0.05, 0.05, 0x333333); // handlebar
        for (const s of [-1, 1]) { b.box(s * 0.3, 1.18, scooter ? 0.46 : 0.58, 0.02, 0.2, 0.02, 0x333333); b.box(s * 0.31, 1.29, scooter ? 0.46 : 0.58, 0.1, 0.06, 0.03, CHROME); } // mirrors
        lights = new KS.Builder(); lights.sphere(0, scooter ? 0.95 : sport ? 0.9 : 1.0, (scooter ? 0.56 : 0.72) + 0.02, 0.09, 0xffffff, 1, 8);
        tails = new KS.Builder(); tails.box(0, 0.9, -0.82, 0.16, 0.08, 0.04, 0xffffff);
        if (opt.rider !== false) {
          rider(riderB, scooter ? 0.88 : sport ? 0.98 : 0.92, sport ? -0.2 : -0.3, opt.uthao ? { uthao: true, helmet: 0x0f8a7a, jacket: 0x0f8a7a, box: opt.parcel } : type === 'policebike' ? { helmet: 0xf4f4f4, jacket: 0x2c4d8a, pants: 0x1a2440 } : {});
          if (type !== 'policebike' && (opt.pillion || (opt.pillion !== false && KS.chance(0.28)))) pillion(riderB, 1.0, -0.78);
          if (type === 'policebike') { b.box(0, 0.75, -0.75, 0.5, 0.36, 0.34, 0xf4f4f4); b.box(0, 0.9, -0.75, 0.52, 0.08, 0.36, 0x1d4fb8); siren = true; }
        }
        plate = null;
      }
    }
    const root = new T.Group();
    const body = new T.Mesh(b.build(), KS.M.vc); body.castShadow = true; root.add(body);
    if (lights && !lights.empty) root.add(new T.Mesh(lights.build(), headMat));
    if (tails && !tails.empty) root.add(new T.Mesh(tails.build(), tailMat));
    let riderMesh = null;
    if (!riderB.empty) { riderMesh = new T.Mesh(riderB.build(), KS.M.vc); riderMesh.castShadow = true; root.add(riderMesh); }
    if (plate) { const pl = new T.Mesh(new T.PlaneGeometry(0.6, 0.23), plateMat(plate)); pl.position.set(0, 0.5, -L / 2 - 0.03); pl.rotation.y = Math.PI; root.add(pl); }
    if (route) { const rb = new T.Mesh(new T.PlaneGeometry(W * 0.75, 0.3), routeMat()); rb.position.set(0, type === 'micro' ? 1.95 : (type === 'bus' ? 2.85 : 2.5), L / 2 + 0.03); root.add(rb); root.userData.routeBoard = rb; }
    for (const [k] of extra) {
      if (k === 'truck') { const tb = new T.Mesh(new T.PlaneGeometry(W, 1.7), truckBack()); tb.position.set(0, 1.75, -L / 2 + 0.08); tb.rotation.y = Math.PI; root.add(tb); }
      if (k === 'amb') for (const s of [-1, 1]) { const ab = new T.Mesh(new T.PlaneGeometry(L * 0.55, 0.32), ambBoard()); ab.position.set(s * (W / 2 + 0.02), 1.6, -0.3); ab.rotation.y = s * Math.PI / 2; root.add(ab); }
    }
    if (siren) {
      const y = type === 'ambulance' ? 2.2 : 2.38, z = type === 'ambulance' ? L / 2 - 0.9 : -0.25;
      const pb = type === 'policebike', sy = pb ? 1.05 : y, sz = pb ? -0.72 : z, w = pb ? 0.18 : 0.45;
      const r = new T.Mesh(new T.BoxGeometry(w, 0.16, 0.25), KS.sirenMats[0]); r.position.set(pb ? -0.12 : -0.27, sy, sz); root.add(r);
      const bl = new T.Mesh(new T.BoxGeometry(w, 0.16, 0.25), KS.sirenMats[1]); bl.position.set(pb ? 0.12 : 0.27, sy, sz); root.add(bl);
      sirens.push(r, bl);
      if (type !== 'ambulance') { const off = new T.MeshBasicMaterial({ color: 0x333344 }); r.userData.on = r.material; bl.userData.on = bl.material; r.material = bl.material = off; }
    }
    return { root, body, rider: riderMesh, color, siren, sirens };
  }
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
  KS.buildVehicle = (type, opt) => {
    const r = build(type, opt), VT = KS.VTYPES[type], L = VT.len;
    KS.addBeam(r.root, 0, KS.isBike(type) ? 0.95 : 0.75, L / 2 + 0.05, false, { wid: KS.isBike(type) ? 0.5 : VT.wid, len: L });
    return r;
  };
  /** switch a police vehicle's light bar on or off */
  KS.setSiren = (v, on) => { if (!v.sirens) return; for (const m of v.sirens) if (m.userData.on) { if (on && !m.userData.offMat) m.userData.offMat = m.material; m.material = on ? m.userData.on : m.userData.offMat || m.material; } v.sirenOn = on; };
})();
