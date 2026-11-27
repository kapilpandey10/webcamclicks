/* Kathmandu Streets — walk-in homes (round 19).
   Ten family houses you can walk into, in two little neighbourhoods just
   outside the city: Samakhusi Homes (north, facing the city's northern edge
   street) and Satdobato Homes (south, past the Bagmati). Each house has a
   door that swings open as you come up to it, a living room with a sofa, an
   armchair and a TV, a kitchen corner and a dining table, and a bedroom with
   a double bed, a wardrobe and a study desk. Walk up to any seat and press E
   to sit down; E again (or walk away) to stand up.
   The furniture is real 3D models, loaded once and cloned per house:
   - "Glam Velvet Sofa" and "Chair Damask Purplegold" by Wayfair (Khronos
     glTF sample assets), CC BY 4.0
   - double bed and dining table (Cozy Home Interiors) and a TV by 3D Assets,
     CC0, found through the free 3D Asset Server (https://3d.shep.bot)
   - the dining and desk chairs and the potted plants are the game's own prop
     models (props.js). */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const HM = (KS.Homes = { list: [], seats: [], seat: null, doors: [], models: {} });
  const DIR = 'js/games/kathmandu/models/props/';
  /* model -> [file, size of its largest horizontal side in metres] */
  const FILES = { sofa: ['GlamVelvetSofa.glb', 2.2], armchair: ['ChairDamaskPurplegold.glb', 0.82], bed: ['home-bed.glb', 2.15], table: ['dining-table.glb', 1.3], tv: ['tv.glb', 0.7] };
  const W2 = 5.5, D2 = 4.5, FL = 0.3, CEIL = 3.2; // half width, half depth, floor top, ceiling
  /* [x, row]: row -1 = the north row (fronts face south onto the street), +1 = the south row (fronts face north) */
  const PLOTS = [[50, -1], [65, -1], [80, -1], [95, -1], [30, 1], [45, 1], [60, 1], [140, 1], [155, 1], [170, 1]];
  const WALLS = [0xf3d9c4, 0xf6e7a8, 0xd8e6c6, 0xbfd8e8, 0xf0c48a, 0xf4b6b6, 0xe9c6dd, 0xffd7a0];

  function loadModels() {
    if (HM._loading) return HM._loading;
    HM._loading = new Promise((resolve) => {
      if (typeof T.GLTFLoader !== 'function') { resolve(false); return; }
      const loader = new T.GLTFLoader(), jobs = [];
      for (const [name, [file, size]] of Object.entries(FILES)) {
        jobs.push(new Promise((res) => loader.load(DIR + file, (g) => {
          const lights = []; g.scene.traverse((o) => { if (o.isLight) lights.push(o); }); lights.forEach((o) => o.parent && o.parent.remove(o)); // models exported with their own lamps (one home model carried a 3x sun): never let them light our world
          const wrap = new T.Group(); wrap.add(g.scene);
          let box = new T.Box3().setFromObject(wrap); const s = new T.Vector3(); box.getSize(s);
          wrap.scale.setScalar(size / Math.max(s.x, s.z, 0.01));
          box = new T.Box3().setFromObject(wrap); const c = new T.Vector3(); box.getCenter(c);
          wrap.position.set(-c.x, -box.min.y, -c.z);
          const outer = new T.Group(); outer.add(wrap);
          outer.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          HM.models[name] = outer; res(true);
        }, undefined, () => { KS.log && KS.log('home model failed: ' + file); res(false); })));
      }
      Promise.all(jobs).then(() => resolve(true));
    });
    return HM._loading;
  }

  HM.build = (scene) => {
    const b = new KS.Builder(), glass = new KS.Builder(), glow = new KS.Builder();
    const lampMat = new T.MeshBasicMaterial({ color: 0x555544 }); KS.lampMats.push(lampMat);
    const furniture = []; // placed when the models arrive
    PLOTS.forEach(([px, row], k) => {
      const cz = row < 0 ? -563.5 : 563.5, rot = row < 0 ? 0 : Math.PI, sgn = row < 0 ? 1 : -1;
      if (KS.nearRingRoad(px, cz, 14)) return;
      const W = (lx, lz) => [px + lx * sgn, cz + lz * sgn]; // local -> world (front of the house is local +z)
      const box = (lx, y, lz, w, h, d, col) => { const [x, z] = W(lx, lz); b.box(x, y, z, w, h, d, col, rot); };
      const solid = (lx, lz, w, d, top, base = -50) => { const [x, z] = W(lx, lz); KS.addBox(x, z, w, d, top, base); };
      const wall = WALLS[k % WALLS.length], trim = 0xf6f3ec;
      // plinth and floor
      box(0, 0, 0, W2 * 2 + 0.4, FL, D2 * 2 + 0.4, 0xb9b2a4); solid(0, 0, W2 * 2 + 0.4, D2 * 2 + 0.4, FL);
      box(-2.2, FL, 0, 6.3, 0.012, 8.6, 0xc9a27a); // wooden floor in the living room
      box(3.2, FL, 0, 4.2, 0.012, 8.6, 0xd8cdb8); // tiles in the bedroom
      box(0, 0, D2 + 1.4, 1.6, 0.15, 2.4, 0xa8a196); // front step and path
      // walls: back, sides, front with the door (1.3 m) in the middle
      const H = CEIL - FL, y0 = FL;
      const wallBox = (lx, lz, w, d) => { box(lx, y0, lz, w, H, d, wall); solid(lx, lz, w, d, CEIL + 3.4); };
      const LINING = 0xcdbba0; // the inside of the outer walls: warm plaster, not the bright outside paint
      box(0, y0, -D2 + 0.21, W2 * 2 - 0.4, H, 0.02, LINING); box(-W2 + 0.21, y0, 0, 0.02, H, D2 * 2 - 0.4, LINING); box(W2 - 0.21, y0, 0, 0.02, H, D2 * 2 - 0.4, LINING);
      box(-3.075, y0, D2 - 0.21, 4.85, H, 0.02, LINING); box(3.075, y0, D2 - 0.21, 4.85, H, 0.02, LINING);
      wallBox(0, -D2 + 0.1, W2 * 2, 0.2);
      wallBox(-W2 + 0.1, 0, 0.2, D2 * 2);
      wallBox(W2 - 0.1, 0, 0.2, D2 * 2);
      wallBox(-3.075, D2 - 0.1, 4.85, 0.2);
      wallBox(3.075, D2 - 0.1, 4.85, 0.2);
      box(0, FL + 2.2, D2 - 0.1, 1.3, H - 2.2, 0.2, wall); // over the door
      // inner partition between living room and bedroom, with a doorway
      box(1.0, y0, -1.35, 0.14, H, 5.9, 0xd9ccb4); solid(1.0, -1.35, 0.14, 5.9, CEIL);
      box(1.0, y0, 3.55, 0.14, H, 1.7, 0xd9ccb4); solid(1.0, 3.55, 0.14, 1.7, CEIL);
      box(1.0, FL + 2.1, 2.2, 0.14, H - 2.1, 1.0, 0xd9ccb4);
      // windows (glass panels on both faces) and frames
      for (const [lx, lz, w] of [[-3.4, D2, 1.6], [3.3, D2, 1.8], [-2.6, -D2, 1.4], [3.4, -D2, 1.4]]) {
        const [x, z] = W(lx, lz);
        glass.box(x, FL + 1.0, z, w, 1.25, 0.26, 0x4a6a80, rot);
        box(lx, FL + 0.92, lz, w + 0.3, 0.1, 0.34, trim); box(lx, FL + 2.27, lz, w + 0.3, 0.1, 0.34, trim);
      }
      // ceiling, upper storey (not furnished), roof
      box(0, CEIL, 0, W2 * 2 + 0.4, 0.25, D2 * 2 + 0.4, trim);
      box(0, CEIL + 0.25, 0, W2 * 2, 2.9, D2 * 2, wall);
      for (const lx of [-3.4, 0, 3.3]) { const [x, z] = W(lx, D2 + 0.01); glass.box(x, CEIL + 1.2, z, 1.4, 1.2, 0.12, 0x4a6a80, rot); }
      box(0, CEIL + 3.15, 0, W2 * 2 + 0.3, 0.2, D2 * 2 + 0.3, trim);
      box(0, CEIL + 3.35, -D2 + 0.1, W2 * 2, 0.8, 0.15, wall); box(0, CEIL + 3.35, D2 - 0.1, W2 * 2, 0.8, 0.15, wall);
      box(-W2 + 0.1, CEIL + 3.35, 0, 0.15, 0.8, D2 * 2, wall); box(W2 - 0.1, CEIL + 3.35, 0, 0.15, 0.8, D2 * 2, wall);
      { const [x, z] = W(3.5, -2.5); b.cyl(x, CEIL + 3.35, z, 0.65, 1.3, 0x1b1b1b, 10); } // the black water tank on every Kathmandu roof
      solid(0, 0, W2 * 2, D2 * 2, CEIL + 3.4, CEIL); // the upper storey is solid above the ceiling
      // interior: kitchen counter with a gas stove and a cylinder, wardrobe, desk, rug, puja shelf, ceiling lamps
      box(-4.15, FL, -D2 + 0.5, 2.3, 0.9, 0.6, 0x8a6a4a); box(-4.15, FL + 0.9, -D2 + 0.5, 2.4, 0.05, 0.66, 0xd6d0c4);
      box(-4.6, FL + 0.95, -D2 + 0.5, 0.6, 0.08, 0.4, 0x222222); box(-3.2, FL, -D2 + 0.9, 0.34, 0.6, 0.34, 0xc8102e);
      solid(-4.15, -D2 + 0.5, 2.3, 0.6, FL + 0.95);
      box(1.7, FL, -D2 + 0.45, 1.1, 2.0, 0.55, 0x6b4a2e); box(1.7, FL + 0.1, -D2 + 0.74, 0.02, 1.8, 0.02, 0x3b2414); solid(1.7, -D2 + 0.45, 1.1, 0.55, FL + 2.0);
      box(4.5, FL, D2 - 0.7, 1.3, 0.75, 0.6, 0x7a5a3a); solid(4.5, D2 - 0.7, 1.3, 0.6, FL + 0.75);
      box(-2.4, FL + 0.013, 0.6, 2.4, 0.01, 1.8, 0x8e2b2b);
      box(-W2 + 0.35, FL + 1.6, -1.8, 0.35, 0.05, 0.7, 0x8a6a4a); box(-W2 + 0.35, FL + 1.65, -1.8, 0.2, 0.35, 0.25, 0xd9a52b); // puja shelf with a brass idol
      for (const [lx, lz] of [[-2.2, 0], [3.2, 0]]) { const [x, z] = W(lx, lz); glow.box(x, CEIL - 0.08, z, 0.9, 0.06, 0.9, 0xffffff, rot); }
      // the door: a leaf hinged on the left of the opening, swinging inwards
      const [hx, hz] = W(-0.65, D2 - 0.1);
      const leaf = new T.Mesh(new T.BoxGeometry(1.3, 2.2, 0.06).translate(0.65, 1.1, 0), new T.MeshLambertMaterial({ color: 0x5a3a22 }));
      const pivot = new T.Group(); pivot.position.set(hx, FL, hz); pivot.rotation.y = rot; pivot.add(leaf); scene.add(pivot);
      const [dx, dz] = W(0, D2);
      HM.doors.push({ pivot, x: dx, z: dz, rot, open: 0, sgn });
      // seats and furniture (local position, heading in house space: 0 = facing the front)
      const seat = (lx, lz, y, h, name) => { const [x, z] = W(lx, lz); HM.seats.push({ x, z, y, h: h + rot, name }); };
      furniture.push({ W, rot, items: [
        { m: 'sofa', lx: -4.75, lz: 0.6, h: Math.PI / 2, solid: [0.95, 2.2, 0.45] },
        { m: 'tv', lx: 0.55, lz: 0.6, h: -Math.PI / 2, y: FL + 0.55, stand: true },
        { m: 'armchair', lx: -2.0, lz: 3.1, h: Math.PI + 0.6, solid: [0.8, 0.8, 0.45] },
        { m: 'table', lx: -1.6, lz: -2.4, h: 0, solid: [1.3, 0.8, 0.75] },
        { m: 'chair', lx: -1.6, lz: -1.55, h: Math.PI, prop: true },
        { m: 'chair', lx: -1.6, lz: -3.25, h: 0, prop: true },
        { m: 'bed', lx: 3.6, lz: -3.2, h: 0, solid: [1.6, 2.1, 0.55] },
        { m: 'chair', lx: 4.5, lz: 2.75, h: 0, prop: true },
        { m: 'plant', lx: -W2 + 0.55, lz: D2 - 0.55, h: 0, prop: true },
      ] });
      seat(-4.55, 0.15, FL + 0.44, Math.PI / 2, 'sofa'); seat(-4.55, 1.05, FL + 0.44, Math.PI / 2, 'sofa');
      seat(-2.05, 3.0, FL + 0.46, Math.PI + 0.6, 'armchair');
      seat(-1.6, -1.55, FL + 0.47, Math.PI, 'chair'); seat(-1.6, -3.25, FL + 0.47, 0, 'chair');
      seat(3.6, -1.9, FL + 0.55, 0, 'bed'); seat(4.5, 2.75, FL + 0.47, 0, 'chair');
      HM.list.push({ x: px, z: cz, row });
    });
    scene.add(KS.mesh(b, KS.M.vc, true));
    scene.add(new T.Mesh(glass.build(), new T.MeshLambertMaterial({ color: 0x5b7f96, transparent: true, opacity: 0.55, depthWrite: false })));
    scene.add(new T.Mesh(glow.build(), lampMat));
    if (KS.landmarks) {
      KS.landmarks.push({ id: 'homes-north', name: 'Samakhusi Homes 🏠', np: 'सामाखुसी घरहरू', x: 72, z: -563, r: 40, fact: 'Family houses you can walk into. Press E by a sofa, chair or bed to sit down.' });
      KS.landmarks.push({ id: 'homes-south', name: 'Satdobato Homes 🏠', np: 'सातदोबाटो घरहरू', x: 100, z: 563, r: 80, fact: 'Family houses you can walk into. Press E by a sofa, chair or bed to sit down.' });
    }
    loadModels().then(() => {
      for (const f of furniture) for (const it of f.items) {
        const src = it.prop ? KS.Props && KS.Props.build(it.m) : HM.models[it.m] && HM.models[it.m].clone(true);
        const [x, z] = f.W(it.lx, it.lz);
        if (it.stand) { const st = new KS.Builder(); st.box(x, FL, z, 0.5, it.y - FL, 1.4, 0x3b2a1e, f.rot + it.h); scene.add(KS.mesh(st)); KS.addBox(x, z, 0.6, 1.4, it.y); }
        if (it.solid) KS.addBox(x, z, Math.abs(Math.sin(f.rot + it.h)) > 0.5 ? it.solid[0] : it.solid[1], Math.abs(Math.sin(f.rot + it.h)) > 0.5 ? it.solid[1] : it.solid[0], FL + it.solid[2]);
        if (!src) continue;
        src.position.set(x, it.y || FL, z); src.rotation.y = f.rot + it.h; scene.add(src);
      }
    });
  };

  /* on foot: doors, sitting. Returns true while you are seated (the player does not walk then). */
  HM.footHook = (dt, I) => {
    const PL = KS.Player;
    for (const d of HM.doors) { // swing open when someone is within 3 m of the doorway
      const near = Math.hypot(PL.x - d.x, PL.z - d.z) < 3.2;
      d.open += ((near ? 1 : 0) - d.open) * Math.min(1, dt * 4);
      d.pivot.rotation.y = d.rot + d.open * 1.6; // swings inwards
    }
    const s = HM.seat;
    if (s) {
      const move = I.down('KeyW') || I.down('KeyS') || I.down('KeyA') || I.down('KeyD') || I.down('ArrowUp') || I.down('ArrowDown');
      if (I.hit('KeyE') || I.hit('KeyEnter') || move) { HM.stand(); return !move; }
      const p = PL.person;
      PL.x = s.x; PL.z = s.z; PL.y = s.y - 0.46; PL.h = s.h; PL.speed = 0;
      p.root.position.set(s.x - Math.sin(s.h) * 0.12, s.y - 0.92 + 0.05, s.z - Math.cos(s.h) * 0.12); p.root.rotation.set(0, s.h, 0);
      KS.animSit(p); p.legL.rotation.x = p.legR.rotation.x = -1.2; p.armL.rotation.x = p.armR.rotation.x = -0.75; // thighs forward, feet down towards the floor p.torso.rotation.x = s.name === 'bed' ? 0.05 : -0.05;
      if (KS.Game && KS.Game.prompt) KS.Game.prompt('🪑 Sitting — press <b>E</b> or walk to stand up');
      return true;
    }
    let best = null, bd = 1.5;
    for (const q of HM.seats) { const d = Math.hypot(q.x - PL.x, q.z - PL.z); if (d < bd && Math.abs((PL.y || 0) - (q.y - 0.46)) < 1.2) { bd = d; best = q; } }
    if (best) {
      if (KS.Game && KS.Game.prompt) KS.Game.prompt(`🪑 Press <b>E</b> to sit on the ${best.name}`);
      if (I.hit('KeyE') || I.hit('KeyEnter')) { HM.seat = best; PL.speed = 0; KS.Challenges && KS.Challenges.emit('sit'); return true; }
    }
    return false;
  };
  HM.stand = () => {
    const s = HM.seat, PL = KS.Player; HM.seat = null; if (!s) return;
    PL.x = s.x + Math.sin(s.h) * 0.75; PL.z = s.z + Math.cos(s.h) * 0.75; PL.y = s.y - 0.46;
    const p = PL.person; p.torso.rotation.x = 0; p.legL.rotation.x = p.legR.rotation.x = 0; p.armL.rotation.x = p.armR.rotation.x = 0;
  };
})();
