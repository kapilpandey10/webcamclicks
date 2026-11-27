/* Kathmandu Streets — traffic on the City Expressway, and its LED boards (round 22).
   The toll road had no traffic at all. Now cars, taxis, SUVs, vans and the
   odd bus drive it: they come up a ramp from the edge of the city, slow to
   walking pace through the toll plaza (the tag reader beeps them through),
   cruise the deck at 55-75 km/h in two lanes each way (keep left, overtake on
   the right), yield at the crossing of the two lines, keep their distance
   from the car in front (and from you), and leave down the ramp at the far
   end. A car that leaves comes back up another ramp out of your sight.
   The toll plazas carry animated amber LED boards: the face towards the
   cars coming up scrolls "TOLL रु 15 · CITY EXPRESSWAY · 80 KM/H", the face
   towards the cars coming down thanks them and names the area below. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const EX = (KS.Express = { cars: [], boards: [] });
  const KINDS = ['car', 'sedan', 'taxi', 'suv', 'car', 'sedan', 'micro', 'taxi', 'suv', 'ev', 'pickup', 'bus'];
  const LANES = [5.0, 1.9]; // left (keep-left) lane and overtaking lane, metres left of the deck centre for your direction
  const N = 14;

  /* a point on a line: t along it, u to the left of travel along +t */
  const pt = (L, t, u) => (L.axis === 'z' ? { x: L.c + u, z: t } : { x: t, z: L.c - u });
  const headOf = (L, dir) => (L.axis === 'z' ? (dir > 0 ? 0 : Math.PI) : dir > 0 ? Math.PI / 2 : -Math.PI / 2);

  function spawn(car, far) {
    const TL = KS.TOLL, cam = KS.camera ? KS.camera.position : { x: 0, z: 0 };
    for (let tries = 0; tries < 40; tries++) {
      const L = KS.pick(TL.lines), dir = KS.chance(0.5) ? 1 : -1;
      let t;
      if (far) t = KS.r(L.flatA + 20, L.flatB - 20); // anywhere on the deck (at the start)
      else t = dir > 0 ? L.a - 4 : L.b + 4; // at the foot of the entry ramp
      const p = pt(L, t, 0);
      if (!far && Math.hypot(p.x - cam.x, p.z - cam.z) < 140) continue; // never pop in where you can see it
      if (far && Math.hypot(p.x - cam.x, p.z - cam.z) < 90) continue;
      Object.assign(car, { L, dir, t, lane: far ? KS.pick(LANES) : LANES[0], v: far ? 16 : 6, want: KS.r(15.5, 20.5) });
      return true;
    }
    return false;
  }

  EX.init = (scene) => {
    if (!KS.TOLL || !KS.buildVehicle) return;
    for (let i = 0; i < N; i++) {
      const kind = KINDS[i % KINDS.length], vis = KS.buildVehicle(kind, { rider: false });
      if (!vis) continue;
      const vt = KS.VTYPES[kind];
      const car = { id: 'x' + i, kind, type: vt, ...vis, express: true, ai: false, parked: false, speed: 0, x: 0, y: 0, z: 0, h: 0, lane: {}, lat: 0 };
      if (!spawn(car, true)) continue;
      car.laneU = car.lane;
      scene.add(car.root); KS.Traffic.list.push(car); EX.cars.push(car);
    }
    EX.buildBoards(scene);
  };

  EX.update = (dt) => {
    if (!EX.cars.length) return;
    const TL = KS.TOLL, PL = KS.Player, cam = KS.camera.position;
    const X0 = TL.lines[0].c, Z0 = TL.lines[1].c; // the crossing
    for (const c of EX.cars) {
      const L = c.L, dir = c.dir;
      // the car ahead in the same lane and direction (or you, if you are on the road in front)
      let gap = Infinity;
      for (const o of EX.cars) { if (o === c || o.L !== L || o.dir !== dir || Math.abs(o.laneU - c.laneU) > 1.5) continue; const d = (o.t - c.t) * dir; if (d > 0 && d < gap) gap = d - (o.type.len + c.type.len) / 2; }
      if (PL && (PL.y || 0) > 0.8) {
        const pa = L.axis === 'z' ? PL.z : PL.x, pu = (L.axis === 'z' ? PL.x - L.c : L.c - PL.z) * dir, d = (pa - c.t) * dir;
        if (d > 0 && Math.abs(pu - c.lane) < 1.8 && Math.abs(((L.axis === 'z' ? PL.x : PL.z) - L.c)) < 8) gap = Math.min(gap, d - c.type.len / 2 - 2.5);
      }
      let want = c.want;
      const y = TL.yAt(L, c.t) || 0, onRamp = y < TL.H - 0.05;
      if (onRamp) want = Math.min(want, 13);
      // the toll plaza at the foot of the entry ramp: through it at walking pace
      const plaza = dir > 0 ? L.a + 24 : L.b - 24, toPlaza = (plaza - c.t) * dir;
      if (toPlaza > -8 && toPlaza < 40) want = Math.min(want, Math.max(4, Math.sqrt(16 + 2 * 1.5 * Math.max(0, toPlaza))));
      // the crossing: the east-west line gives way to the north-south line
      if (L.axis === 'x') {
        const toX = (X0 - c.t) * dir;
        const busy = EX.cars.some((o) => o.L !== L && Math.abs(o.t - Z0) < 22);
        if (busy && toX > 9 && toX < 40) want = Math.min(want, Math.sqrt(2 * 3 * Math.max(0, toX - 10)));
      }
      if (gap < Infinity) want = Math.min(want, Math.max(0, (gap - 4) * 0.9));
      c.v += KS.clamp(want - c.v, -6 * dt, 2.2 * dt); if (c.v < 0) c.v = 0;
      c.t += c.v * dir * dt;
      // change to the overtaking lane when stuck behind a slow car, back to the left when clear
      c.laneT = (c.laneT || 0) - dt;
      if (c.laneT <= 0 && !onRamp) { c.laneT = 3; if (gap < 30 && c.v < c.want - 3 && c.lane === LANES[0]) c.lane = LANES[1]; else if (gap > 60 && c.lane === LANES[1]) c.lane = LANES[0]; }
      if (onRamp) c.lane = LANES[0];
      c.laneU = (c.laneU == null ? c.lane : c.laneU + KS.clamp(c.lane - c.laneU, -1.2 * dt, 1.2 * dt));
      // off the far end: back to an entry ramp somewhere you cannot see
      if ((dir > 0 && c.t > L.b + 6) || (dir < 0 && c.t < L.a - 6)) { spawn(c, false); c.laneU = c.lane; continue; }
      const p = pt(L, c.t, c.laneU * dir), y2 = TL.yAt(L, c.t + dir * 2) || 0, y1 = TL.yAt(L, c.t - dir * 2) || 0;
      c.x = p.x; c.z = p.z; c.y = (TL.yAt(L, Math.min(L.b, Math.max(L.a, c.t))) || 0) + 0.06; c.h = headOf(L, dir); c.speed = c.v;
      c.root.position.set(c.x, c.y, c.z); c.root.rotation.set(-Math.atan2(y2 - y1, 4), c.h, 0, 'YXZ');
      c.root.visible = Math.hypot(c.x - cam.x, c.z - cam.z) < 420;
    }
    EX.updateBoards(dt);
  };

  /* ---------- the animated LED boards at the toll plazas ---------- */
  EX.buildBoards = (scene) => {
    for (const g of KS.tollGantries || []) {
      const ramp = (KS.expressway.ramps || []).find((r) => r.name === g.name); if (!ramp) continue;
      const hUp = ramp.h, fx = Math.sin(hUp), fz = Math.cos(hUp), y = KS.groundAt(g.x, g.z, 30, 40);
      for (const face of ['in', 'out']) {
        const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96;
        const tex = new T.CanvasTexture(cv); tex.anisotropy = 4;
        const m = new T.Mesh(new T.PlaneGeometry(12, 2.25), new T.MeshBasicMaterial({ map: tex }));
        const s = face === 'in' ? -1 : 1; // 'in' faces the cars coming up (they arrive from the foot side)
        m.position.set(g.x + fx * 5.62 * s, y + 7.55, g.z + fz * 5.62 * s); m.rotation.y = face === 'in' ? hUp + Math.PI : hUp;
        const frame = new T.Mesh(new T.BoxGeometry(12.5, 2.7, 0.3), new T.MeshLambertMaterial({ color: 0x202224 }));
        frame.position.set(g.x + fx * 5.45 * s, y + 7.55, g.z + fz * 5.45 * s); frame.rotation.y = hUp;
        scene.add(frame); scene.add(m);
        const msg = face === 'in'
          ? `TOLL रु 15  ·  CITY EXPRESSWAY  ·  MAX 80 KM/H  ·  शुभ यात्रा  ·  KEEP LEFT  ·  `
          : `THANK YOU  ·  धन्यवाद  ·  WELCOME TO ${g.name.toUpperCase()}  ·  ${g.np}  ·  SLOW DOWN  ·  `;
        EX.boards.push({ cv, tex, msg, x: g.x, z: g.z, off: KS.r(0, 400), arrow: face === 'in' });
      }
    }
  };
  let boardT = 0;
  EX.updateBoards = (dt) => {
    boardT += dt; if (boardT < 0.06) return; const step = boardT; boardT = 0;
    const cam = KS.camera.position;
    for (const bd of EX.boards) {
      if (Math.hypot(bd.x - cam.x, bd.z - cam.z) > 260) continue; // only the boards you can read
      const g = bd.cv.getContext('2d'), w = bd.cv.width, h = bd.cv.height;
      g.fillStyle = '#050505'; g.fillRect(0, 0, w, h);
      g.font = `700 58px "Barlow Condensed", ${KS.FONT}`; g.textBaseline = 'middle';
      const tw = g.measureText(bd.msg).width; bd.off = (bd.off + step * 110) % tw;
      g.fillStyle = '#ffb000'; g.shadowColor = '#ff8a00'; g.shadowBlur = 10;
      const left = bd.arrow ? 96 : 8;
      g.save(); g.beginPath(); g.rect(left, 0, w - left - 8, h); g.clip();
      for (let x = left - bd.off; x < w; x += tw) g.fillText(bd.msg, x, h / 2 + 3);
      g.restore(); g.shadowBlur = 0;
      if (bd.arrow) { // a blinking green arrow: this lane is open
        g.fillStyle = Math.floor(KS.clock * 2) % 2 ? '#38ff6a' : '#0e3a18';
        g.beginPath(); g.moveTo(48, 14); g.lineTo(80, 48); g.lineTo(60, 48); g.lineTo(60, 84); g.lineTo(36, 84); g.lineTo(36, 48); g.lineTo(16, 48); g.closePath(); g.fill();
      }
      g.fillStyle = 'rgba(0,0,0,0.55)'; // the LED matrix: a dark grid over the text
      for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 1, h);
      for (let y = 0; y < h; y += 4) g.fillRect(0, y, w, 1);
      bd.tex.needsUpdate = true;
    }
  };
})();
