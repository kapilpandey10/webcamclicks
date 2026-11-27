/* Kathmandu Streets — core helpers: random, grid, terrain, solids, geometry builder, textures. */
(function () {
  'use strict';
  const T = THREE;
  const KS = (window.KS = window.KS || {});

  /* ---------- random ---------- */
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  KS.rng = mulberry32(20261122);
  /** restart the world generator: every device builds the same city, people and animals whatever its graphics setting */
  KS.reseed = (n) => { KS.rng = mulberry32(20261122 + n * 7919); };
  KS.r = (a = 0, b = 1) => a + (b - a) * KS.rng();
  KS.ri = (a, b) => Math.floor(a + (b - a + 1) * KS.rng());
  KS.pick = (arr) => arr[Math.floor(KS.rng() * arr.length)];
  KS.chance = (p) => KS.rng() < p;
  KS.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  KS.lerp = (a, b, t) => a + (b - a) * t;
  KS.smooth = (a, b, x) => { const t = KS.clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  KS.wrapAng = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };
  KS.angLerp = (a, b, t) => a + KS.wrapAng(b - a) * t;

  /* ---------- city grid ----------
     12 x 12 blocks of 90 m. Road centre lines at x,z = -540 + i*90. Every grid
     line is an ordinary 16 m street now; the Ring Road is the loop below, not
     the square the grid used to draw. Nepal drives on the LEFT. */
  const G = (KS.G = { N: 12, B: 90, O: -540, ROAD: 16, RING: 22, HALF: 540 });
  G.line = (i) => G.O + i * G.B;
  G.roadHalf = () => G.ROAD / 2;
  G.blockOf = (x, z) => ({ c: Math.floor((x - G.O) / G.B), r: Math.floor((z - G.O) / G.B) });

  /* ---------- the Ring Road, traced from the real map ----------
     The real Chakrapath (27 km) runs through these junctions, north ->
     west -> south -> east: Basundhara, Samakhusi, Gongabu (New Bus Park),
     Machhapokhari, Balaju, Banasthali, Thulo Bharyang, Sitapaila, Kalanki,
     Balkhu (on the Bagmati), Ekantakuna, Satdobato, Gwarko, Balkumari,
     Koteshwor, Sinamangal (beside the airport), Gaushala, Chabahil,
     Dhumbarahi and Narayan Gopal Chowk (Maharajgunj).
     Their real latitude/longitude was projected to metres and scaled
     (1 : 6.2) so Kalanki meets the Nagdhunga highway and Sinamangal sits on
     the airport fence. The shape is the real one: the dome over the north
     through Basundhara, the long straight west side from Sitapaila to
     Kalanki, the bulge south through Lalitpur to Satdobato, the straight
     east side along the airport. Where the real line would have cut into
     the game's city blocks, Swayambhu hill, the airport or the Thakuri
     mansion, the curve was eased outward just enough to clear them
     (scratch fit: a relaxation that pulls every point back to its real
     position). RING_SHAPE is the traced centre line (control points of a
     closed Catmull-Rom spline); RING_LOOP holds the named junctions, with
     the grid junction (gi, gj) each one's connector road leads to (Balkhu
     is on the bridge and Basundhara is far out in the north: no connector).
     The road ribbon, the median, the traffic nodes, the minimap, the signs
     and the expressway above all read the same samples. */
  KS.RING_SHAPE = [
    [188, -781], [175, -778], [147, -768], [120, -758], [91, -737], [63, -712], [38, -695], [26, -688], [16, -682], [-4, -674],
    [-21, -668], [-37, -663], [-53, -660], [-69, -657], [-78, -656], [-86, -655], [-104, -655], [-123, -657], [-141, -658], [-158, -657],
    [-174, -653], [-181, -649], [-187, -643], [-198, -629], [-207, -611], [-217, -592], [-229, -576], [-249, -572], [-261, -572], [-275, -572],
    [-306, -572], [-342, -572], [-382, -572], [-424, -572], [-469, -572], [-493, -572], [-516, -572], [-561, -569], [-572, -534], [-572, -490],
    [-572, -450], [-572, -412], [-572, -394], [-572, -376], [-572, -341], [-572, -307], [-572, -273], [-572, -237], [-572, -199], [-572, -180],
    [-572, -159], [-573, -114], [-576, -66], [-582, -18], [-580, 28], [-574, 72], [-572, 93], [-572, 114], [-572, 156], [-572, 206],
    [-572, 268], [-572, 351], [-572, 456], [-572, 516], [-562, 567], [-450, 572], [-354, 572], [-280, 572], [-222, 572], [-173, 573],
    [-151, 582], [-130, 595], [-86, 627], [-37, 658], [13, 684], [60, 703], [102, 713], [120, 714], [137, 712], [164, 698],
    [185, 674], [204, 645], [221, 616], [240, 590], [250, 580], [261, 574], [289, 572], [318, 572], [348, 572], [381, 572],
    [418, 572], [439, 572], [461, 572], [510, 572], [560, 569], [572, 524], [572, 470], [572, 417], [572, 391], [572, 364],
    [572, 307], [572, 249], [573, 192], [577, 139], [578, 90], [576, 68], [574, 46], [572, 6], [572, -35], [572, -77],
    [572, -121], [572, -166], [572, -188], [572, -210], [572, -249], [572, -283], [572, -315], [572, -348], [572, -385], [572, -406],
    [572, -429], [572, -480], [572, -537], [550, -572], [497, -572], [454, -576], [441, -587], [432, -600], [415, -630], [400, -658],
    [383, -685], [365, -708], [346, -729], [335, -738], [325, -746], [302, -760], [278, -772], [253, -779], [227, -784], [201, -783],
  ];
  KS.RING_LOOP = [
    { name: 'Basundhara', np: 'बसुन्धरा', x: 188, z: -781 },
    { name: 'Samakhusi', np: 'सामाखुसी', x: 26, z: -688, gi: 6, gj: 0 },
    { name: 'Gongabu', np: 'गोंगबु', x: -78, z: -656, gi: 5, gj: 0 },
    { name: 'Machhapokhari', np: 'माछापोखरी', x: -181, z: -649, gi: 4, gj: 0 },
    { name: 'Balaju', np: 'बालाजु', x: -261, z: -572, gi: 3, gj: 0 },
    { name: 'Banasthali', np: 'वनस्थली', x: -493, z: -572, gi: 1, gj: 0 },
    { name: 'Thulo Bharyang', np: 'ठूलो भर्याङ', x: -572, z: -394, gi: 0, gj: 2 },
    { name: 'Sitapaila', np: 'सीतापाइला', x: -572, z: -180, gi: 0, gj: 4 },
    { name: 'Kalanki', np: 'कलंकी', x: -572, z: 93, gi: 0, gj: 7 },
    { name: 'Balkhu', np: 'बल्खु', x: -572, z: 516 },
    { name: 'Ekantakuna', np: 'एकान्तकुना', x: -151, z: 582, gi: 4, gj: 12 },
    { name: 'Satdobato', np: 'सातदोबाटो', x: 120, z: 714, gi: 7, gj: 12 },
    { name: 'Gwarko', np: 'ग्वार्को', x: 250, z: 580, gi: 9, gj: 12 },
    { name: 'Balkumari', np: 'बालकुमारी', x: 439, z: 572, gi: 11, gj: 12 },
    { name: 'Koteshwor', np: 'कोटेश्वर', x: 572, z: 391, gi: 12, gj: 10 },
    { name: 'Sinamangal', np: 'सिनामंगल', x: 576, z: 68, gi: 12, gj: 7 },
    { name: 'Gaushala', np: 'गौशाला', x: 572, z: -188, gi: 12, gj: 4 },
    { name: 'Chabahil', np: 'चाबहिल', x: 572, z: -406, gi: 12, gj: 1 },
    { name: 'Dhumbarahi', np: 'धुम्बाराही', x: 441, z: -587, gi: 11, gj: 0 },
    { name: 'Narayan Gopal Chowk', np: 'नारायण गोपाल चोक', x: 335, z: -738, gi: 10, gj: 0 },
  ];
  KS.ringLoopPts = (() => {
    const W = KS.RING_SHAPE.map(([x, z]) => ({ x, z })), n = W.length, PER = 4, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = W[(i - 1 + n) % n], p1 = W[i], p2 = W[(i + 1) % n], p3 = W[(i + 2) % n];
      for (let k = 0; k < PER; k++) {
        const t = k / PER, t2 = t * t, t3 = t2 * t;
        out.push({
          x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
          z: 0.5 * ((2 * p1.z) + (-p0.z + p2.z) * t + (2 * p0.z - 5 * p1.z + 4 * p2.z - p3.z) * t2 + (-p0.z + 3 * p1.z - 3 * p2.z + p3.z) * t3),
        });
      }
    }
    // heading at each sample, and arclength (for the median gaps at junctions)
    let s = 0;
    for (let i = 0; i < out.length; i++) {
      const a = out[i], b = out[(i + 1) % out.length];
      a.h = Math.atan2(b.x - a.x, b.z - a.z); a.s = s; s += Math.hypot(b.x - a.x, b.z - a.z);
    }
    KS.ringLoopLen = s; // total loop length in metres
    return out;
  })();
  /* a coarse grid of the loop segments near each 32 m cell, so a distance
     query scans a handful of segments instead of all ~560 (the terrain asks
     once per vertex). Only segments within 48 m of a cell are listed: the
     callers compare the result against 25 m or less, so "no segment listed"
     returns a large value, which is safe. */
  const RC = 32, RPAD = 48, ringCells = new Map();
  KS.ringBox = { x0: Infinity, x1: -Infinity, z0: Infinity, z1: -Infinity };
  {
    const P = KS.ringLoopPts;
    for (let i = 0; i < P.length; i++) {
      const a = P[i], b = P[(i + 1) % P.length];
      const x0 = Math.min(a.x, b.x) - RPAD, x1 = Math.max(a.x, b.x) + RPAD, z0 = Math.min(a.z, b.z) - RPAD, z1 = Math.max(a.z, b.z) + RPAD;
      KS.ringBox.x0 = Math.min(KS.ringBox.x0, x0); KS.ringBox.x1 = Math.max(KS.ringBox.x1, x1);
      KS.ringBox.z0 = Math.min(KS.ringBox.z0, z0); KS.ringBox.z1 = Math.max(KS.ringBox.z1, z1);
      for (let cx = Math.floor(x0 / RC); cx <= Math.floor(x1 / RC); cx++) for (let cz = Math.floor(z0 / RC); cz <= Math.floor(z1 / RC); cz++) {
        const k = cx * 10007 + cz; let arr = ringCells.get(k); if (!arr) ringCells.set(k, (arr = [])); arr.push(i);
      }
    }
  }
  /** distance from a point to the Ring Road centre line (true segment distance) */
  KS.ringLoopDist = (x, z) => {
    const B = KS.ringBox;
    if (x < B.x0 || x > B.x1 || z < B.z0 || z > B.z1) return 1e9;
    const segs = ringCells.get(Math.floor(x / RC) * 10007 + Math.floor(z / RC));
    if (!segs) return 1e9;
    const P = KS.ringLoopPts; let best = Infinity;
    for (const i of segs) {
      const a = P[i], b = P[(i + 1) % P.length], dx = b.x - a.x, dz = b.z - a.z, L2 = dx * dx + dz * dz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / L2)) : 0;
      const ex = a.x + u * dx - x, ez = a.z + u * dz - z, d = ex * ex + ez * ez;
      if (d < best) best = d;
    }
    return Math.sqrt(best);
  };
  /* each junction sits exactly on the traced line: snap it to the nearest sample */
  for (const w of KS.RING_LOOP) {
    let best = Infinity, bi = 0;
    KS.ringLoopPts.forEach((p, i) => { const d = (p.x - w.x) ** 2 + (p.z - w.z) ** 2; if (d < best) { best = d; bi = i; } });
    w.x = KS.ringLoopPts[bi].x; w.z = KS.ringLoopPts[bi].z; w.i = bi;
  }
  /** the connector road from each junction to its grid junction (traced so none crosses the river, the airport, Swayambhu or the mansion) */
  KS.ringConnectors = KS.RING_LOOP.filter((w) => w.gi !== undefined).map((w) => (
    { name: w.name, np: w.np, x1: w.x, z1: w.z, x2: G.line(w.gi), z2: G.line(w.gj), gi: w.gi, gj: w.gj }
  ));
  /** true while a point is on the Ring Road or one of its connectors (for keeping buildings, trees and benches off the road) */
  KS.nearRingRoad = (x, z, r) => {
    if (KS.ringLoopDist(x, z) < r) return true;
    for (const c of KS.ringConnectors) {
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1, L2 = dx * dx + dz * dz;
      const u = L2 > 0 ? Math.max(0, Math.min(1, ((x - c.x1) * dx + (z - c.z1) * dz) / L2)) : 0;
      if (Math.hypot(c.x1 + u * dx - x, c.z1 + u * dz - z) < r) return true;
    }
    return false;
  };

  /* block layout: [col,row] -> type. col runs west->east, row runs north->south */
  const layout = {};
  const set = (c, r, t) => (layout[c + ',' + r] = t);
  for (let c = 0; c < G.N; c++) set(c, 11, 'river');
  set(4, 2, 'thamel'); set(4, 3, 'thamel'); set(5, 3, 'thamel'); set(3, 3, 'thamel');
  set(5, 2, 'garden');
  set(6, 2, 'palace');
  set(6, 4, 'ranipokhari');
  set(4, 4, 'old'); set(5, 4, 'ason'); set(3, 4, 'old'); set(3, 5, 'old'); set(4, 5, 'old'); set(5, 5, 'old');
  set(3, 6, 'old'); set(3, 7, 'old'); set(4, 8, 'old');
  set(4, 6, 'durbar'); set(4, 7, 'durbar2');
  set(5, 6, 'newroad'); set(5, 7, 'newroad');
  set(6, 5, 'tundikhel'); set(6, 6, 'tundikhel2');
  set(6, 7, 'dharahara');
  set(8, 7, 'singha');
  set(5, 9, 'stadium');
  set(10, 3, 'boudha');
  set(10, 10, 'pashupati');
  set(8, 3, 'park');
  set(2, 9, 'park');
  set(1, 1, 'balaju');
  set(8, 1, 'shankha');
  set(7, 5, 'hospital');
  set(9, 8, 'trial');
  set(7, 6, 'parking'); set(8, 6, 'buspark'); set(2, 7, 'parking');
  KS.blockType = (c, r) => {
    if (c < 0 || r < 0 || c >= G.N || r >= G.N) return 'outside';
    return layout[c + ',' + r] || 'city';
  };

  /* ---------- districts (for HUD location names) ---------- */
  KS.districts = [
    { name: 'Garden of Dreams', np: 'स्वप्न बगैंचा', x0: -90, x1: 0, z0: -360, z1: -270 },
    { name: 'Thamel', np: 'ठमेल', x0: -270, x1: 0, z0: -360, z1: -180 },
    { name: 'Narayanhiti', np: 'नारायणहिटी', x0: 0, x1: 90, z0: -360, z1: -270 },
    { name: 'Rani Pokhari', np: 'रानीपोखरी', x0: 0, x1: 90, z0: -180, z1: -90 },
    { name: 'Asan Tole', np: 'असन टोल', x0: -90, x1: 0, z0: -180, z1: -90 },
    { name: 'Indra Chowk', np: 'इन्द्रचोक', x0: -270, x1: -90, z0: -180, z1: 0 },
    { name: 'Basantapur Durbar Square', np: 'बसन्तपुर दरबार क्षेत्र', x0: -180, x1: -90, z0: 0, z1: 180 },
    { name: 'New Road', np: 'न्युरोड', x0: -90, x1: 0, z0: 0, z1: 180 },
    { name: 'Tundikhel · Ratna Park', np: 'टुँडिखेल', x0: 0, x1: 90, z0: -90, z1: 90 },
    { name: 'Sundhara · Dharahara', np: 'सुन्धारा', x0: 0, x1: 90, z0: 90, z1: 180 },
    { name: 'Singha Durbar', np: 'सिंहदरबार', x0: 180, x1: 270, z0: 90, z1: 180 },
    { name: 'Tripureshwor', np: 'त्रिपुरेश्वर', x0: -90, x1: 90, z0: 180, z1: 450 },
    { name: 'Boudha', np: 'बौद्ध', x0: 270, x1: 540, z0: -360, z1: -90 },
    { name: 'Pashupati · Gaushala', np: 'पशुपति', x0: 270, x1: 540, z0: 270, z1: 450 },
    { name: 'Nagdhunga Tunnel', np: 'नागढुङ्गा सुरुङमार्ग', x0: -1510, x1: -890, z0: 70, z1: 110 },
    { name: 'Dhunibesi Village', np: 'धुनिबेसी गाउँ', x0: -2700, x1: -1510, z0: -600, z1: 700 },
    { name: 'Nagdhunga Highway', np: 'नागढुङ्गा सडक', x0: -890, x1: -548, z0: 60, z1: 120 },
    { name: 'Balaju Water Garden', np: 'बालाजु बाइसधारा', x0: -450, x1: -360, z0: -450, z1: -360 },
    { name: 'Shankha Park', np: 'शंख पार्क', x0: 180, x1: 270, z0: -450, z1: -360 },
    { name: 'Bir Hospital area', np: 'अस्पताल', x0: 90, x1: 180, z0: -90, z1: 0 },
    { name: 'Transport Office · Trial ground', np: 'यातायात कार्यालय · ट्रायल स्थल', x0: 270, x1: 360, z0: 180, z1: 270 },
    { name: 'Sadbhav Thakuri Residence', np: 'सद्भाव ठकुरी निवास', x0: 110, x1: 250, z0: -740, z1: -560 },
    { name: 'Bhrikutimandap Car Park', np: 'भृकुटीमण्डप पार्किङ', x0: 90, x1: 180, z0: 0, z1: 90 },
    { name: 'Ratna Park Bus Station', np: 'रत्नपार्क बसपार्क', x0: 180, x1: 270, z0: 0, z1: 90 },
    { name: 'Kalimati Market', np: 'कालीमाटी तरकारी बजार', x0: -360, x1: -270, z0: 90, z1: 180 },
    { name: 'Kalanki', np: 'कलंकी', x0: -570, x1: -510, z0: 40, z1: 140 },
    { name: 'Bagmati River', np: 'बागमती नदी', x0: -2700, x1: 1400, z0: 452, z1: 532 },
    { name: 'Swayambhu', np: 'स्वयम्भू', x0: -860, x1: -560, z0: -260, z1: 80 },
    { name: 'Tribhuvan Airport', np: 'त्रिभुवन विमानस्थल', x0: 560, x1: 820, z0: -380, z1: 380 },
    { name: 'Baneshwor', np: 'बानेश्वर', x0: 90, x1: 540, z0: 0, z1: 270 },
    { name: 'Lazimpat', np: 'लाजिम्पाट', x0: -90, x1: 270, z0: -540, z1: -360 },
    { name: 'Balaju', np: 'बालाजु', x0: -540, x1: -90, z0: -540, z1: -360 },
    { name: 'Kalimati', np: 'कालीमाटी', x0: -540, x1: -270, z0: -90, z1: 450 },
    { name: 'Chabahil', np: 'चाबहिल', x0: 90, x1: 540, z0: -360, z1: 0 },
    { name: 'Ring Road', np: 'चक्रपथ', x0: -600, x1: 600, z0: -800, z1: 730 }, // the traced loop reaches Basundhara in the north and Satdobato in the south
    { name: 'Kathmandu Valley', np: 'काठमाडौं उपत्यका', x0: -9999, x1: 9999, z0: -9999, z1: 9999 },
  ];
  KS.districtAt = (x, z) => {
    for (const d of KS.districts) if (x >= d.x0 && x < d.x1 && z >= d.z0 && z < d.z1) return d;
    return KS.districts[KS.districts.length - 1];
  };

  /* ---------- terrain ---------- */
  function hash2(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
  function vnoise(x, z) {
    const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
    const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
    const a = hash2(xi, zi), b = hash2(xi + 1, zi), c = hash2(xi, zi + 1), d = hash2(xi + 1, zi + 1);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  KS.noise = vnoise;
  KS.fbm = (x, z) => vnoise(x, z) * 0.55 + vnoise(x * 2.1, z * 2.1) * 0.3 + vnoise(x * 4.3, z * 4.3) * 0.15;

  KS.RIVER = { z0: 462, z1: 528, bed: -2.6, water: -1.1 };
  KS.SWAYAMBHU = { x: -700, z: -90, top: 46, flat: 30, foot: 150 };
  /* Nagdhunga highway: west from Kalanki on the Ring Road, through the tunnel, down to Dhunibesi village */
  const HW = (KS.HW = { z: 90, x0: -548, x1: -2350, pE: -900, pW: -1500, village: { x: -2050, z: 90 } });
  KS.MANSION = { x0: 120, x1: 240, z0: -735, z1: -605, gx: 180, gz: -605 };
  KS.BOUNDS = { x0: -2700, x1: 1400, z0: -1400, z1: 1400 };
  KS.roadH = (x) => {
    if (x > -560) return 0;
    if (x > HW.pE) return 14 * KS.smooth(-560, HW.pE, x);
    if (x > HW.pW) return 14 + 12 * ((HW.pE - x) / (HW.pE - HW.pW));
    if (x > -1650) return 26 - 4 * KS.smooth(HW.pW, -1650, x);
    return 22;
  };
  KS.inTunnel = (x, z) => x < HW.pE && x > HW.pW && Math.abs(z - HW.z) < 8;
  /* Chhahare Jharna, a waterfall in the hills to the north (towards Nuwakot): a glen with a plunge pool, a stream
     running down the hillside, a road up from the Ring Road and stone steps through the jungle */
  const J = (KS.JHARNA = { x: -150, z: -1066, base: 70, pool: { x: -150, z: -1080, r: 11 }, cliffZ: -1094, top: 142, park: { x: -100, z: -996, h: 58, r: 13 } });
  const TPATHS = (KS.TPATHS = [
    { id: 'road', w: 5, pts: [[-90, -548, 0], [-90, -800, 0], [-94, -900, 24], [-100, -988, 58]] },
    { id: 'steps', w: 1.8, pts: [[-100, -1000, 58], [-117, -1015, 61], [-132, -1031, 65], [-146, -1046, 69.6]] },
    { id: 'stream', w: 2.4, bed: true, pts: [[-150, -1070, 69.4], [-162, -1052, 66], [-176, -1030, 60], [-190, -1000, 50], [-202, -965, 39], [-210, -930, 28], [-214, -890, 16]] },
  ]);
  for (const P of TPATHS) { const xs = P.pts.map((p) => p[0]), zs = P.pts.map((p) => p[1]), m = P.w + 8; P.bx0 = Math.min(...xs) - m; P.bx1 = Math.max(...xs) + m; P.bz0 = Math.min(...zs) - m; P.bz1 = Math.max(...zs) + m; }
  /** the water level where you can swim (pools, the waterfall pool), or null */
  KS.waterLevel = (x, z) => {
    for (const w of KS.swimZones || []) if (w.r ? (x - w.x) ** 2 + (z - w.z) ** 2 < w.r * w.r : x > w.x0 && x < w.x1 && z > w.z0 && z < w.z1) return w.water;
    return null;
  };
  /** distance from (x,z) to a polyline: { d, h (interpolated height), u (0..1 along) } */
  KS.pathNear = (P, x, z) => {
    let best = { d: 1e9, h: 0 };
    for (let k = 0; k < P.pts.length - 1; k++) {
      const [ax, az, ah] = P.pts[k], [bx, bz, bh] = P.pts[k + 1], dx = bx - ax, dz = bz - az, L2 = dx * dx + dz * dz;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / L2)), px = ax + dx * t, pz = az + dz * t, d = Math.hypot(x - px, z - pz);
      if (d < best.d) best = { d, h: ah + (bh - ah) * t, k, t };
    }
    return best;
  };
  // heights follow the natural hillside (worked out once): the road climbs with the hill, the stream runs just below it
  let shaped = false;
  function shapeInit() {
    shaped = true; const n0 = (x, z) => natural0(x, z);
    J.base = Math.round(Math.min(n0(J.x, J.z), n0(J.x, J.z - 20)) - 12); J.top = J.base + 72;
    J.park.h = Math.round(n0(J.park.x, J.park.z) * 10) / 10;
    const R = TPATHS[0].pts; for (let k = 2; k < R.length; k++) R[k][2] = n0(R[k][0], R[k][1]); R[R.length - 1][2] = J.park.h;
    const St = TPATHS[1].pts; St[0][2] = J.park.h; St[St.length - 1][2] = J.base - 0.2; for (let k = 1; k < St.length - 1; k++) St[k][2] = KS.lerp(J.park.h, J.base, k / (St.length - 1)) * 0.5 + n0(St[k][0], St[k][1]) * 0.5;
    const Sm = TPATHS[2].pts; Sm[0][2] = J.base - 0.6; for (let k = 1; k < Sm.length; k++) Sm[k][2] = Math.min(Sm[k - 1][2] - 0.4, n0(Sm[k][0], Sm[k][1]) - 1.2);
  }
  function shapeNorth(x, z, h) {
    if (z > -540 || x < -300 || x > 40) return h;
    if (!shaped) shapeInit();
    const dj = Math.hypot(x - J.x, z - J.z); if (dj < 62) h = KS.lerp(h, J.base, KS.smooth(62, 38, dj));
    const dk = Math.hypot(x - J.park.x, z - J.park.z); if (dk < J.park.r + 6) h = KS.lerp(h, J.park.h, KS.smooth(J.park.r + 6, J.park.r, dk));
    for (const P of TPATHS) {
      if (x < P.bx0 || x > P.bx1 || z < P.bz0 || z > P.bz1) continue;
      const n = KS.pathNear(P, x, z), edge = P.w + 22; if (n.d > edge) continue;
      const tgt = P.bed ? n.h - 0.8 * Math.max(0, 1 - n.d / P.w) : n.h;
      h = KS.lerp(h, tgt, KS.smooth(edge, P.w, n.d));
    }
    const dp = Math.hypot(x - J.pool.x, z - J.pool.z); if (dp < J.pool.r + 4) h = KS.lerp(h, J.base - 1.8, KS.smooth(J.pool.r + 4, J.pool.r - 2, dp));
    return h;
  }
  function natural(x, z) { return shapePaths(x, z, shapeNorth(x, z, natural0(x, z))); }
  function natural0(x, z) {
    let h = 0;
    // valley rim hills (Shivapuri, Nagarjun, Chandragiri, Phulchoki)
    const m = Math.max(Math.abs(x), Math.abs(z));
    if (m > 820) h += (m - 820) * 0.42 * (0.65 + 0.6 * KS.fbm(x * 0.004, z * 0.004));
    // beyond the Nagdhunga pass: the Dhunibesi basin with terraced slopes
    if (x < -1350) {
      const v = HW.village, d = Math.hypot(x - v.x, (z - v.z) * 0.9);
      const basin = 22 + Math.max(0, d - 240) * 0.36 + 6 * KS.fbm(x * 0.01, z * 0.01);
      h = KS.lerp(h, basin, KS.smooth(-1350, -1720, x));
    }
    // the snow peak (Shivapuri) and the paragliding hill: smooth cones on the rim
    const ds = Math.hypot(x - KS.SNOWPEAK.x, z - KS.SNOWPEAK.z);
    if (ds < 500) h += KS.SNOWPEAK.bump * Math.exp(-(ds * ds) / (2 * KS.SNOWPEAK.sigma * KS.SNOWPEAK.sigma));
    const dp = Math.hypot(x - KS.PARAGLIDE.x, z - KS.PARAGLIDE.z);
    if (dp < 400) h += KS.PARAGLIDE.bump * Math.exp(-(dp * dp) / (2 * KS.PARAGLIDE.sigma * KS.PARAGLIDE.sigma));
    // Swayambhu hill
    const sw = KS.SWAYAMBHU;
    const dx = x - sw.x, dz = z - sw.z, d = Math.sqrt(dx * dx + dz * dz);
    if (d < sw.foot) h = Math.max(h, sw.top * (1 - KS.smooth(sw.flat, sw.foot, d)));
    // Bagmati river channel
    const R = KS.RIVER;
    if (z > R.z0 - 2 && z < R.z1 + 2) {
      // the banks wander a little (inside the channel), with gravel bars here and there
      const e0 = R.z0 + 2 + 4 * (0.5 + 0.5 * Math.sin(x * 0.013 + 1.3)) + 3 * KS.fbm(x * 0.02, 3.1), e1 = R.z1 - 2 - 4 * (0.5 + 0.5 * Math.sin(x * 0.011 + 4.2)) - 3 * KS.fbm(x * 0.02, 7.7);
      const bank = Math.min(KS.smooth(e0 - 4, e0 + 6, z), 1 - KS.smooth(e1 - 6, e1 + 4, z));
      let bed = R.bed;
      const bar = KS.smooth(0.6, 0.7, KS.fbm(x * 0.006, z * 0.03 + 11)) * Math.min(KS.smooth(e0 + 6, e0 + 14, z), 1 - KS.smooth(e1 - 14, e1 - 6, z));
      bed = KS.lerp(bed, -0.75, bar);
      h = h * (1 - bank) + bed * bank;
    }
    return h;
  }
  /** ground height. forMesh: the visible terrain (the hill stays solid over the tunnel) */
  KS.heightAt = (x, z, forMesh) => {
    let h = natural(x, z);
    if (x < HW.x0 && x > HW.x1) {
      const dz = Math.abs(z - HW.z), tun = x < HW.pE - 6 && x > HW.pW + 6;
      if (forMesh && tun) return h;
      if (dz < 8) return KS.roadH(x);
      if (dz < 26 && !tun) return KS.lerp(KS.roadH(x), h, KS.smooth(8, 26, dz));
    }
    /* the Ring Road cuts its own flat corridor: the valley floor is already
       flat, but the loop grazes the foot of Swayambhu hill on the west side,
       so the ground is levelled within 14 m of the centre line. */
    const rd = KS.ringLoopDist(x, z);
    if (rd < 22) h = KS.lerp(0, h, KS.smooth(14, 22, rd));
    return h;
  };

  /* ---------- the snow mountain (Shivapuri) and the paragliding hill ----------
     Two new peaks on the valley rim: a snowy summit in the north, and a
     paragliding hill in the west. The snow line is where the ground turns
     white; the temperature falls about 7°C for every 100 m you climb. */
  KS.SNOWPEAK = { x: -450, z: -1250, bump: 180, sigma: 280 };
  KS.PARAGLIDE = { x: -1200, z: 300, bump: 70, sigma: 200 };
  KS.SNOWLINE = 240;
  KS.temperatureAt = (x, z) => Math.round(18 - KS.heightAt(x, z) * 0.07);
  /** the height of the VISIBLE terrain mesh at a point. The mesh is a grid of
      heightAt() samples every ~8 m, so between vertices it is a flat triangle
      that can sit a metre or two above or below the analytic heightAt().
      Roads, guardrails and anything that must sit ON the visible ground use
      this, not heightAt(), or they sink under the hillside and disappear. */
  KS.meshHeightAt = (x, z) => {
    const g = KS.terrainGrid;
    if (!g) return KS.heightAt(x, z);
    const fx = (x - g.x0) / g.dx, fz = (z - g.z0) / g.dz;
    const ix = Math.max(0, Math.min(g.segX - 1, Math.floor(fx))), iz = Math.max(0, Math.min(g.segZ - 1, Math.floor(fz)));
    const tx = Math.min(1, Math.max(0, fx - ix)), tz = Math.min(1, Math.max(0, fz - iz));
    const H = (i, j) => KS.heightAt(g.x0 + i * g.dx, g.z0 + j * g.dz, true);
    const h00 = H(ix, iz), h10 = H(ix + 1, iz), h01 = H(ix, iz + 1), h11 = H(ix + 1, iz + 1);
    return (h00 * (1 - tx) + h10 * tx) * (1 - tz) + (h01 * (1 - tx) + h11 * tx) * tz;
  };
  /* mountain paths: a road up to the snow peak, a road up to the paragliding
     hill, and a trekking path to the summit. The ground is flattened near
     them, like the Jharna road, so the roads and the trail are walkable. */
  const MOUNTAIN_PATHS = (KS.MOUNTAIN_PATHS = [
    { id: 'snowroad', w: 6, pts: [[-100, -996, 0], [-200, -1015, 0], [-300, -1000, 0], [-360, -1060, 0], [-280, -1110, 0], [-200, -1140, 0], [-280, -1190, 0], [-380, -1210, 0], [-440, -1230, 0], [-450, -1235, 0]] },
    { id: 'pararoad', w: 6, pts: [[-560, 150, 0], [-650, 130, 0], [-750, 180, 0], [-850, 160, 0], [-950, 230, 0], [-1050, 210, 0], [-1100, 270, 0], [-1180, 295, 0], [-1200, 300, 0]] },
    { id: 'trek', w: 2.2, pts: [[-400, -600, 0], [-380, -800, 0], [-360, -1000, 0], [-380, -1150, 0], [-430, -1230, 0]] },
    { id: 'snowstream', w: 3, bed: true, pts: [[-450, -1245, 0], [-400, -1150, 0], [-300, -1080, 0], [-200, -1060, 0], [-180, -1000, 0], [-220, -900, 0], [-300, -800, 0], [-400, -700, 0], [-500, -600, 0], [-560, -450, 0], [-580, -300, 0], [-600, -150, 0], [-610, 0, 0], [-620, 150, 0], [-630, 300, 0], [-640, 450, 0], [-650, 495, 0]] },
  ]);
  for (const P of MOUNTAIN_PATHS) { const xs = P.pts.map((p) => p[0]), zs = P.pts.map((p) => p[1]), m = P.w + 24; P.bx0 = Math.min(...xs) - m; P.bx1 = Math.max(...xs) + m; P.bz0 = Math.min(...zs) - m; P.bz1 = Math.max(...zs) + m; }
  let mountainsShaped = false;
  function shapeMountains() {
    mountainsShaped = true;
    for (const P of MOUNTAIN_PATHS) for (const p of P.pts) p[2] = natural0(p[0], p[1]);
    // the snow stream only ever flows downhill, to the Bagmati
    const S = MOUNTAIN_PATHS.find((p) => p.id === 'snowstream');
    for (let k = 1; k < S.pts.length; k++) S.pts[k][2] = Math.min(S.pts[k - 1][2] - 0.4, natural0(S.pts[k][0], S.pts[k][1]) - 1.2);
  }
  function shapePaths(x, z, h) {
    if (!mountainsShaped) shapeMountains();
    for (const P of MOUNTAIN_PATHS) {
      if (x < P.bx0 || x > P.bx1 || z < P.bz0 || z > P.bz1) continue;
      const n = KS.pathNear(P, x, z), edge = P.w + 22; if (n.d > edge) continue;
      const tgt = P.bed ? n.h - 0.8 * Math.max(0, 1 - n.d / P.w) : n.h;
      h = KS.lerp(h, tgt, KS.smooth(edge, P.w, n.d));
    }
    return h;
  }
  KS.SIGNALS = [[6, 4], [7, 7], [8, 8], [9, 6], [4, 9], [2, 6], [7, 3], [9, 9], [0, 7], [12, 6], [6, 12], [6, 0], [3, 2], [8, 10]];
  KS.SPEEDCAMS = [{ x: G.line(2) + 12, z: G.line(4) + 45, ax: 'z' }, { x: G.line(7) + 45, z: G.line(1) + 12, ax: 'x' }, { x: G.line(10) - 12, z: G.line(10) + 45, ax: 'z' }, { x: G.line(3) + 45, z: G.line(10) - 12, ax: 'x' }];

  /* speed limits in km/h (Nepal: 40 in the city, less in the old core, more on the Ring Road & highway) */
  /* Speed limits apply only in school zones during school hours (9:00-16:00): 25 km/h. Elsewhere: drive to conditions. */
  KS.SCHOOLS = [
    { c: 2, r: 4, name: 'Saraswati Secondary School', np: 'सरस्वती माध्यमिक विद्यालय' },
    { c: 7, r: 1, name: 'Gyanodaya School', np: 'ज्ञानोदय विद्यालय' },
    { c: 9, r: 10, name: 'Shanti Shiksha Sadan', np: 'शान्ति शिक्षा सदन' },
    { c: 3, r: 9, name: 'Janata Secondary School', np: 'जनता माध्यमिक विद्यालय' },
  ];
  KS.SCHOOLS.forEach((sc) => { set(sc.c, sc.r, 'school'); sc.x0 = G.line(sc.c) - 30; sc.x1 = G.line(sc.c + 1) + 30; sc.z0 = G.line(sc.r) - 30; sc.z1 = G.line(sc.r + 1) + 30; });
  KS.SCHOOLS.push({ village: true, name: 'Dhunibesi School', np: 'धुनिबेसी विद्यालय', x0: HW.village.x + 60, x1: HW.village.x + 165, z0: HW.z - 14, z1: HW.z + 90 });
  KS.schoolHours = () => KS.time >= 9 && KS.time < 16;
  KS.schoolZoneAt = (x, z) => { for (const s of KS.SCHOOLS) if (x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1) return s; return null; };
  /* ---------- the elevated toll expressway (round 19) ----------
     Not on top of the Ring Road any more: a "+" of elevated road over the
     rooftops through the middle of the city, 22 m up, like the urban
     expressways of Bangkok or Delhi. The north-south line runs over the
     middle of the blocks at x = -225 (Balaju -> Thamel -> the old town ->
     Kalimati), the east-west line over the middle of the blocks at z = 225
     (Kalimati -> Teku -> Baneshwor). Each end comes down a 200 m ramp onto
     the city's edge street, with a toll plaza at the foot. The lines avoid
     every tall landmark (Durbar Square, Dharahara, the palace, Rani
     Pokhari, the stadium). The houses under the deck are kept below it, and
     none stands where a pier goes (world.js asks KS.tollUnder). */
  const TOLL = (KS.TOLL = { H: 22, DW: 14, RAMP: 200, lines: [
    { id: 'ns', axis: 'z', c: -225, a: -532, b: 442, flatA: -332, flatB: 250, names: [['Balaju', 'बालाजु'], ['Teku', 'टेकु']] },
    { id: 'ew', axis: 'x', c: 225, a: -532, b: 532, flatA: -332, flatB: 332, names: [['Kalimati', 'कालीमाटी'], ['Baneshwor', 'बानेश्वर']] },
  ] });
  /** deck height of a line at position t along it (ramps fall linearly to the street at both ends) */
  TOLL.yAt = (L, t) => (t < L.a || t > L.b ? null : t < L.flatA ? TOLL.H * (t - L.a) / (L.flatA - L.a) : t > L.flatB ? TOLL.H * (L.b - t) / (L.b - L.flatB) : TOLL.H);
  /** the deck surface height over a point, or null when the point is not under the expressway */
  KS.tollY = (x, z, pad = 0) => {
    let best = null;
    for (const L of TOLL.lines) {
      const t = L.axis === 'z' ? z : x, u = L.axis === 'z' ? x - L.c : z - L.c;
      if (Math.abs(u) > TOLL.DW / 2 + pad) continue;
      const y = TOLL.yAt(L, t); if (y === null) continue;
      if (best === null || y > best) best = y;
    }
    return best;
  };
  /* piers: in the middle of each street the line crosses (never in a
     junction: the lines cross the streets mid-way between junctions) and in
     the middle of each block, wherever the deck is more than 5 m up */
  TOLL.piers = [];
  for (const L of TOLL.lines) {
    for (let i = 0; i <= G.N; i++) for (const t of [G.line(i), G.line(i) + G.B / 2]) {
      if (t <= L.a + 40 || t >= L.b - 30) continue;
      if (t > KS.RIVER.z0 - 6 && t < KS.RIVER.z1 + 6 && L.axis === 'z') continue; // no pier in the Bagmati
      const y = TOLL.yAt(L, t); if (y === null || y < 5) continue;
      const px = L.axis === 'z' ? L.c : t, pz = L.axis === 'z' ? t : L.c;
      if (Math.hypot(px - TOLL.lines[0].c, pz - TOLL.lines[1].c) < 10) continue; // the crossing of the two lines: one shared slab, no pier in the middle
      TOLL.piers.push({ x: px, z: pz, y, line: L.id });
    }
  }
  /** for a building footprint (centre, half extents): the lowest deck above it (null if none) and whether a pier stands in it */
  KS.tollUnder = (cx, cz, hw, hd) => {
    let minY = null;
    for (const L of TOLL.lines) {
      const tc = L.axis === 'z' ? cz : cx, uc = L.axis === 'z' ? cx : cz, ht = L.axis === 'z' ? hd : hw, hu = L.axis === 'z' ? hw : hd;
      if (Math.abs(uc - L.c) > TOLL.DW / 2 + 1 + hu) continue;
      for (const t of [tc - ht, tc, tc + ht]) { const y = TOLL.yAt(L, t); if (y !== null && (minY === null || y < minY)) minY = y; }
      if (tc + ht >= L.a && tc - ht <= L.a) minY = 0; // the ramp lands here
      if (tc + ht >= L.b && tc - ht <= L.b) minY = 0;
    }
    const pier = TOLL.piers.some((p) => Math.abs(p.x - cx) < hw + 2 && Math.abs(p.z - cz) < hd + 2);
    return { minY, pier };
  };
  /* the toll expressway is an 80 km/h road: you are on it when you are up on its deck or ramps */
  KS.onExpressway = (x, z, y) => { if (!(y > 1.5)) return false; const d = KS.tollY(x, z); return d !== null && y > d - 1.2 && y < d + 4; };
  KS.speedLimit = (x, z, y) => (KS.schoolHours() && KS.schoolZoneAt(x, z) ? 25 : (y !== undefined && KS.onExpressway(x, z, y) ? 80 : null));

  /* ---------- solids: boxes / circles with a top height, on a spatial hash ---------- */
  const CELL = 32;
  const grid = new Map();
  const key = (cx, cz) => cx * 73856093 ^ cz * 19349663;
  KS.solids = [];
  function insert(s) {
    KS.solids.push(s);
    s.ref = s;
    const a = Math.floor(s.x0 / CELL), b = Math.floor(s.x1 / CELL), c = Math.floor(s.z0 / CELL), d = Math.floor(s.z1 / CELL);
    for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) {
      const k = key(i, j); let arr = grid.get(k); if (!arr) grid.set(k, (arr = [])); arr.push(s);
    }
      return s;
  }
  KS.addBox = (cx, cz, w, d, top, base = -50, rotY = 0) => {
    if (rotY) { // approximate rotated boxes by their axis-aligned bounds when rotated ~90deg
      const c = Math.abs(Math.cos(rotY)), s = Math.abs(Math.sin(rotY));
      const nw = w * c + d * s, nd = w * s + d * c; w = nw; d = nd;
    }
    return insert({ t: 0, x0: cx - w / 2, x1: cx + w / 2, z0: cz - d / 2, z1: cz + d / 2, top, base });
  };
  KS.addCircle = (cx, cz, r, top, base = -50) => insert({ t: 1, cx, cz, r, x0: cx - r, x1: cx + r, z0: cz - r, z1: cz + r, top, base });
  const seen = new Set();
  KS.solidsNear = (x, z, r, out) => {
    out.length = 0; seen.clear();
    const a = Math.floor((x - r) / CELL), b = Math.floor((x + r) / CELL), c = Math.floor((z - r) / CELL), d = Math.floor((z + r) / CELL);
    for (let i = a; i <= b; i++) for (let j = c; j <= d; j++) {
      const arr = grid.get(key(i, j)); if (!arr) continue;
      for (const s of arr) if (!seen.has(s)) { seen.add(s); out.push(s); }
    }
    return out;
  };
  const near = [];
  function inside(s, x, z, pad) {
    if (s.t === 0) return x > s.x0 - pad && x < s.x1 + pad && z > s.z0 - pad && z < s.z1 + pad;
    const dx = x - s.cx, dz = z - s.cz; return dx * dx + dz * dz < (s.r + pad) * (s.r + pad);
  }
  /** ground height at a point for something standing at height y (steps up to `step`). */
  KS.groundAt = (x, z, y, step) => {
    // the visible ground: the terrain mesh can sit a metre or two above the
    // analytic heightAt() on the mountain, and anything standing on heightAt()
    // alone sinks under the hillside. Take the higher of the two.
    let g = KS.heightAt(x, z);
    if (KS.meshHeightAt) { const mh = KS.meshHeightAt(x, z); if (mh > g) g = mh; }
    KS.solidsNear(x, z, 0.5, near);
    for (const s of near) if (s.top <= y + step && inside(s, x, z, 0) && s.top > g) g = s.top;
    return g;
  };
  /** move a circle to (x,z): push out of solids too tall to step on. returns {x,z,hit} */
  const res = { x: 0, z: 0, hit: false, solid: null };
  KS.collide = (x, z, r, y, step) => {
    res.hit = false; res.solid = null;
    KS.solidsNear(x, z, r + 1, near);
    for (let pass = 0; pass < 2; pass++) {
      for (const s of near) {
        if (s.top <= y + step || s.base > y + 2.5) continue;
        if (s.t === 0) {
          const cx = KS.clamp(x, s.x0, s.x1), cz = KS.clamp(z, s.z0, s.z1);
          let dx = x - cx, dz = z - cz; const d2 = dx * dx + dz * dz;
          if (d2 < r * r) {
            res.hit = true; res.solid = s;
            if (d2 > 1e-8) { const d = Math.sqrt(d2); x = cx + (dx / d) * r; z = cz + (dz / d) * r; }
            else { // centre inside: exit through nearest side
              const l = x - s.x0, rr = s.x1 - x, u = z - s.z0, dd = s.z1 - z, m = Math.min(l, rr, u, dd);
              if (m === l) x = s.x0 - r; else if (m === rr) x = s.x1 + r; else if (m === u) z = s.z0 - r; else z = s.z1 + r;
            }
          }
        } else {
          const dx = x - s.cx, dz = z - s.cz, d = Math.sqrt(dx * dx + dz * dz), m = s.r + r;
          if (d < m) { res.hit = true; res.solid = s; const k = d > 1e-6 ? m / d : 0; x = s.cx + (d > 1e-6 ? dx * k : m); z = s.cz + dz * k; }
        }
      }
    }
    res.x = x; res.z = z; return res;
  };

  /* ---------- merged vertex-coloured geometry builder ---------- */
  const unitCache = {};
  function unit(name, make, flat) {
    if (!unitCache[name]) { let g = make(); g = g.index ? g.toNonIndexed() : g; if (flat) g.computeVertexNormals(); unitCache[name] = g; }
    return unitCache[name];
  }
  const _m = new T.Matrix4(), _q = new T.Quaternion(), _e = new T.Euler(), _p = new T.Vector3(), _s = new T.Vector3(), _v = new T.Vector3(), _n = new T.Matrix3(), _c = new T.Color();
  class Builder {
    constructor() { this.p = []; this.n = []; this.c = []; }
    addGeo(g, m, color) {
      const pos = g.attributes.position, nor = g.attributes.normal;
      _n.getNormalMatrix(m); _c.set(color);
      for (let i = 0; i < pos.count; i++) {
        _v.fromBufferAttribute(pos, i).applyMatrix4(m); this.p.push(_v.x, _v.y, _v.z);
        _v.fromBufferAttribute(nor, i).applyMatrix3(_n).normalize(); this.n.push(_v.x, _v.y, _v.z);
        this.c.push(_c.r, _c.g, _c.b);
      }
      return this;
    }
    mat(x, y, z, sx, sy, sz, rx = 0, ry = 0, rz = 0) {
      _e.set(rx, ry, rz); _q.setFromEuler(_e); _p.set(x, y, z); _s.set(sx, sy, sz);
      return _m.compose(_p, _q, _s);
    }
    /** box centred at x,z with bottom at y */
    box(x, y, z, w, h, d, color, ry = 0, rx = 0, rz = 0) {
      return this.addGeo(unit('box', () => new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0)), this.mat(x, y, z, w, h, d, rx, ry, rz), color);
    }
    /** cylinder/cone frustum, bottom at y. taper = top radius / bottom radius */
    cyl(x, y, z, r, h, color, seg = 10, taper = 1, ry = 0, rx = 0, rz = 0) {
      const g = unit('cyl' + seg + '_' + taper.toFixed(3), () => new T.CylinderGeometry(taper, 1, 1, seg, 1).translate(0, 0.5, 0), seg <= 6);
      return this.addGeo(g, this.mat(x, y, z, r, h, r, rx, ry, rz), color);
    }
    /** pyramid roof (4-sided cone rotated 45deg) */
    pyr(x, y, z, w, h, color, ry = 0) {
      const g = unit('pyr', () => new T.ConeGeometry(Math.SQRT1_2, 1, 4, 1).rotateY(Math.PI / 4).translate(0, 0.5, 0), true);
      return this.addGeo(g, this.mat(x, y, z, w, h, w, 0, ry, 0), color);
    }
    /** elliptical cylinder/frustum (rx across, rz deep), bottom at y */
    ecyl(x, y, z, rx, rz, h, color, seg = 10, taper = 1, rotX = 0, ry = 0) {
      const g = unit('cyl' + seg + '_' + taper.toFixed(3), () => new T.CylinderGeometry(taper, 1, 1, seg, 1).translate(0, 0.5, 0), seg <= 6);
      return this.addGeo(g, this.mat(x, y, z, rx, h, rz, rotX, ry, 0), color);
    }
    /** ellipsoid */
    ell(x, y, z, rx, ry, rz, color, seg = 10) {
      const g = unit('sph' + seg, () => new T.SphereGeometry(1, seg, Math.max(4, seg >> 1)));
      return this.addGeo(g, this.mat(x, y, z, rx, ry, rz), color);
    }
    /** flared pagoda roof: truncated square pyramid, side w at the eaves */
    roof(x, y, z, w, h, color, taper = 0.3) { return this.cyl(x, y, z, w * Math.SQRT1_2, h, color, 4, taper, Math.PI / 4); }
    sphere(x, y, z, r, color, sy = 1, seg = 10, half = false) {
      const g = unit('sph' + seg + (half ? 'h' : ''), () => new T.SphereGeometry(1, seg, Math.max(4, seg >> 1), 0, Math.PI * 2, 0, half ? Math.PI / 2 : Math.PI));
      return this.addGeo(g, this.mat(x, y, z, r, r * sy, r), color);
    }
    build() {
      const g = new T.BufferGeometry();
      g.setAttribute('position', new T.Float32BufferAttribute(this.p, 3));
      g.setAttribute('normal', new T.Float32BufferAttribute(this.n, 3));
      g.setAttribute('color', new T.Float32BufferAttribute(this.c, 3));
      g.computeBoundingSphere();
      return g;
    }
    get empty() { return this.p.length === 0; }
  }
  KS.Builder = Builder;

  /* ---------- materials ---------- */
  KS.M = {
    vc: new T.MeshLambertMaterial({ vertexColors: true }),
    vcDouble: new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide }),
    glow: new T.MeshBasicMaterial({ color: 0xffe2a0 }),
  };
  KS.mesh = (b, mat = KS.M.vc, shadow = true) => {
    const m = new T.Mesh(b.build(), mat);
    m.castShadow = shadow; m.receiveShadow = true; m.matrixAutoUpdate = false; m.updateMatrix();
    return m;
  };

  /* ---------- canvas textures ---------- */
  KS.canvas = (w, h, draw) => { const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h); return c; };
  KS.tex = (w, h, draw, rep) => {
    const t = new T.CanvasTexture(KS.canvas(w, h, draw));
    if (rep) { t.wrapS = t.wrapT = T.RepeatWrapping; }
    t.anisotropy = 4;
    return t;
  };
  KS.FONT = '"Mukta", "Noto Sans Devanagari", "Nirmala UI", "Mangal", system-ui, sans-serif';

  KS.palette = {
    brick: 0x9c4a32, brickDark: 0x7a3524, wood: 0x3b2414, woodLight: 0x5a3a22, gold: 0xd9a52b, goldDark: 0xa87914,
    white: 0xf1ede4, stone: 0xb9b3a6, roofTile: 0x6e2f22, maroon: 0x6d1a1f, saffron: 0xe88a1a,
    flag: [0x2456c8, 0xf4f4f0, 0xd2262e, 0x1f9a4c, 0xf2c418],
    walls: [0xf3d9c4, 0xf6e7a8, 0xe8b7a0, 0xd8e6c6, 0xbfd8e8, 0xf0c48a, 0xe3e0d6, 0xf4b6b6, 0xcfe0b4, 0xf6f0e4, 0xe9c6dd, 0xd6d0ec, 0xffd7a0, 0xc8e4d8],
  };
})();
