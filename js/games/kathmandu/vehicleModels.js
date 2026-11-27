/* Kathmandu Streets — realistic GLB vehicles. No code-built vehicles remain:
   every vehicle type on the road is a real 3D model, cloned per vehicle.
   Models by vinish.dev (https://vinish.dev/free-3d-models/), CC BY 4.0;
   the auto rickshaw (tempo) and commuter scooter by 3D Assets, CC0, and the
   touring motorcycle by Polyfork, royalty-free — all found through the free
   3D Asset Server API (https://3d.shep.bot, no key needed). One GLB per
   vehicle type lives in models/vehicles/ next to this file.
   Each model is normalised once (scaled to the game's length for its type, centred,
   wheels on the ground) and then cloned for every vehicle that needs it, so the
   files are only downloaded once. A custom paint colour is applied by tinting
   the model's own Paint material, so bought cars stay realistic too.
   If a model file cannot be loaded the vehicle simply does not spawn, and the
   game says so on screen — there is no silent fallback to a blocky vehicle. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const DIR = 'js/games/kathmandu/models/vehicles/';
  /* game type -> GLB file. The minibus and the bus share the city bus model at
     different sizes; the ambulance is the delivery van. The tempo is a real
     auto rickshaw (CC0, 596 triangles) — the three-wheeler Kathmandu runs on. */
  const MAP = {
    car: 'hatchback-01.glb', sedan: 'sedan-01.glb', suv: 'suv-01.glb',
    taxi: 'taxi-01.glb', police: 'police-car-01.glb', pickup: 'pickup-truck-01.glb',
    truck: 'box-truck-01.glb', bus: 'city-bus-01.glb', micro: 'delivery-van-01.glb',
    minibus: 'city-bus-01.glb', ambulance: 'delivery-van-01.glb', ev: 'sports-car-01.glb', sportscar: 'sportscar.glb',
    tempo: 'auto-rickshaw.glb',
    bicycle: 'bicycle.glb', helicopter: 'helicopter.glb',
    skateboard: 'skateboard.glb', // CC0, 3D Assets (Skate Park and Street Sports)
  };
  /* the detailed bikes are heavy (57k–88k triangles), so they are only ever used
     for the player's own bike — never for traffic. Traffic bikes use light
     models instead (touring motorcycle 3,340 tris, commuter scooter 4,976),
     so a street full of bikes stays cheap. */
  const PLAYER_BIKES = {
    scooter: 'scooter.glb', bike: 'street-motorcycle.glb', sport: 'street-motorcycle.glb',
    cruiser: 'street-motorcycle.glb', policebike: 'street-motorcycle.glb',
  };
  const TRAFFIC_BIKES = {
    scooter: 'commuter-scooter.glb', bike: 'touring-motorcycle.glb', sport: 'touring-motorcycle.glb',
    cruiser: 'touring-motorcycle.glb', policebike: 'touring-motorcycle.glb',
  };
  const BOAT_FILE = 'rowboat.glb';
  const VM = (KS.VehicleModels = { ready: false, models: {}, boat: null });

  function normalise(wrap, targetLen) {
    const box = new T.Box3().setFromObject(wrap);
    const size = new T.Vector3(); box.getSize(size);
    const s = targetLen / Math.max(0.1, size.z);
    wrap.scale.setScalar(s);
    const box2 = new T.Box3().setFromObject(wrap);
    const c = new T.Vector3(); box2.getCenter(c);
    wrap.position.x -= c.x; wrap.position.z -= c.z; wrap.position.y -= box2.min.y;
    wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
    const box3 = new T.Box3().setFromObject(wrap);
    const size3 = new T.Vector3(); box3.getSize(size3);
    return size3.y; // height after scaling, for light bars and route boards
  }
  function collect(wrap) {
    const wheels = [], oars = [];
    let mainRotor = null, tailRotor = null, bodyColor = null;
    wrap.traverse((o) => {
      /* the wheel nodes are pivots (Groups on the vinish cars, plain Object3Ds
         on the rickshaw / touring bike / scooter / sports car); their child
         meshes are named after the model, so only the pivot itself spins.
         Names vary by source: Wheel_FL, Wheel_Front, wheel-front,
         wheel-rear-l, wheel-f, wheel-front-right… */
      if (/^wheel([-_](fl|fr|rl|rr|front|rear|f|r))?([-_](left|right|l|r))?$/i.test(o.name) && (o.type === 'Group' || o.type === 'Object3D')) wheels.push(o.name);
      if (o.name === 'Main_Rotor') mainRotor = o.name;
      if (o.name === 'Tail_Rotor') tailRotor = o.name;
      if (/^Oar_[LR]$/.test(o.name)) oars.push(o.name);
      if (o.name === 'Body' && o.isMesh && o.material && o.material.color) bodyColor = o.material.color.getHex();
    });
    return { wheels, oars, mainRotor, tailRotor, bodyColor };
  }
  function cloneEntry(entry) {
    const root = entry.wrap.clone(true);
    const find = (name) => (name ? root.getObjectByName(name) : null);
    return {
      root,
      wheels: entry.parts.wheels.map(find).filter(Boolean),
      oars: entry.parts.oars.map(find).filter(Boolean),
      mainRotor: find(entry.parts.mainRotor),
      tailRotor: find(entry.parts.tailRotor),
    };
  }

  /** load every mapped model. Resolves when all attempts finished; a model that
      fails to load simply stays missing — its vehicle never spawns. Safe to call twice. */
  VM.load = () => {
    if (VM._loading) return VM._loading;
    VM._loading = new Promise((resolve) => {
      if (typeof T.GLTFLoader !== 'function') { KS.log && KS.log('GLTFLoader missing — no vehicles'); resolve(false); return; }
      const loader = new T.GLTFLoader();
      const jobs = [];
      const seen = {};
      const queue = (file, key, targetLen) => {
        if (seen[file]) { jobs.push(seen[file].then((e) => { VM.models[key] = e; })); return; }
        const p = new Promise((res) => {
          loader.load(DIR + file, (gltf) => {
            { const lights = []; gltf.scene.traverse((o) => { if (o.isLight) lights.push(o); }); lights.forEach((o) => o.parent && o.parent.remove(o)); } // no lamps baked into model files
            const wrap = new T.Group(); wrap.add(gltf.scene);
            const height = normalise(wrap, targetLen);
            res({ wrap, parts: collect(wrap), height, file, anims: gltf.animations || [] });
          }, undefined, () => { KS.log && KS.log('vehicle model failed: ' + file); res(null); });
        });
        seen[file] = p;
        jobs.push(p.then((e) => { if (e) VM.models[key] = e; }));
      };
      for (const type in MAP) queue(MAP[type], type, (KS.VTYPES[type] || { len: 4 }).len);
      for (const type in PLAYER_BIKES) queue(PLAYER_BIKES[type], 'own:' + type, (KS.VTYPES[type] || { len: 2 }).len);
      for (const type in TRAFFIC_BIKES) queue(TRAFFIC_BIKES[type], 'traf:' + type, (KS.VTYPES[type] || { len: 2 }).len);
      queue(BOAT_FILE, 'boat', 2.6);
      // report progress as each model lands, so the loading screen can count
      // up honestly instead of guessing: game.js sets VM.onProgress.
      const total = jobs.length; let done = 0;
      const tracked = jobs.map((j) => j.then(() => { done++; if (VM.onProgress) VM.onProgress(done, total); }));
      Promise.all(tracked).then(() => {
        VM.boat = VM.models.boat || null;
        VM.ready = true;
        resolve(true);
      });
    });
    return VM._loading;
  };

  /** true when this vehicle should be built from its GLB. A custom paint colour
      no longer forces a code-built vehicle: the model's own Paint material is
      tinted instead (see VM.build). The bicycle is cheap (9k triangles) so it
      is always GLB; bikes use the detailed model for the player's own bike and
      the light model for traffic. */
  VM.has = (type, opt = {}) => {
    if (!VM.ready) return false;
    if (type === 'bicycle' || type === 'skateboard') return !!VM.models[type];
    if (KS.isBike(type)) return !!VM.models[(opt.owned ? 'own:' : 'traf:') + type];
    return !!VM.models[type];
  };

  /** tint every Paint material of a cloned vehicle to the chosen colour.
      Only the material literally named Paint (or paint) is tinted — Paint2
      is the second tone (white roof, van box) and stays as the model made it.
      The clone shares materials with the source model, so each tinted material
      is cloned first, or every car of that type would change colour too. */
  function tintPaint(root, color) {
    const done = new Map();
    root.traverse((o) => {
      if (!o.isMesh || !o.material || !/^paint$/i.test(o.material.name || '')) return;
      let m = done.get(o.material);
      if (!m) { m = o.material.clone(); m.color.setHex(color); done.set(o.material, m); }
      o.material = m;
    });
  }

  /** a fresh clone of the model for `type`, in the shape buildVehicle's callers
      expect: { root, body, rider, color, siren, sirens, glb, wheels, mainRotor, tailRotor }. */
  VM.build = (type, opt = {}) => {
    const key = type === 'bicycle' || type === 'skateboard' ? type : KS.isBike(type) ? ((opt.owned ? 'own:' : 'traf:') + type) : type;
    const entry = VM.models[key];
    if (!entry) return null;
    const c = cloneEntry(entry);
    if (opt.color != null) tintPaint(c.root, opt.color);
    let riderMesh = null;
    if (KS.isBike(type) && opt.rider !== false && KS.bikeRider) {
      /* a traffic bike with no rider is a ghost bike: build the small code
         rider figure and sit it on the seat. The player's own bike hides it
         (the player's own character sits there instead). */
      const rb = new KS.Builder();
      const uthao = opt.uthao ? { uthao: true, helmet: 0x0f8a7a, jacket: 0x0f8a7a, box: opt.parcel } : {};
      KS.bikeRider(rb, 0.78, -0.3, uthao);
      if (opt.pillion && KS.bikePillion) KS.bikePillion(rb, 0.85, -0.62);
      riderMesh = new T.Mesh(rb.build(), KS.M.vc); riderMesh.castShadow = true; c.root.add(riderMesh);
    }
    if ((type === 'bus' || type === 'minibus' || type === 'micro') && opt.conductor !== false && KS.busConductor) {
      const cb = KS.busConductor(c.root, KS.VTYPES[type].wid, KS.VTYPES[type].len);
      if (cb) riderMesh = cb;
    }
    return {
      root: c.root, body: null, rider: riderMesh,
      color: entry.parts.bodyColor != null ? entry.parts.bodyColor : 0x888888,
      siren: false, sirens: [], glb: true, glbHeight: entry.height,
      wheels: c.wheels, mainRotor: c.mainRotor, tailRotor: c.tailRotor,
    };
  };

  /** the tour helicopter at Dharahara: a clone with its rotor nodes exposed, so
      places.js can spin them exactly like the code-built one. */
  VM.makeHeli = () => {
    const r = VM.build('helicopter', {});
    if (!r) return null;
    return { root: r.root, rotor: r.mainRotor, tailRotor: r.tailRotor };
  };

  /** swap the three Rani Pokhari rowing boats to the GLB rowboat, keeping the same
      boat objects (and their oar interface) that player.js drives. */
  VM.swapBoats = () => {
    if (!VM.boat || !KS.pondBoats) return 0;
    let n = 0;
    for (const b of KS.pondBoats) {
      const c = cloneEntry(VM.boat);
      while (b.g.children.length) b.g.remove(b.g.children[0]);
      b.g.add(c.root);
      if (c.oars.length === 2) b.oars = c.oars;
      n++;
    }
    return n;
  };

  /** spin the wheels of every GLB vehicle on the road, and the rotors of the
      helicopter the player is flying. Called once a frame from game.js. */
  VM.tick = (dt) => {
    if (!VM.ready || !KS.Traffic) return;
    const PL = KS.Player;
    for (const v of KS.Traffic.list) {
      if (!v.root || !v.root.parent) continue;
      if (v.wheels && v.wheels.length && v.speed) {
        const w = (v.speed * dt) / 0.35;
        for (const n of v.wheels) n.rotation.x += w;
      }
      if (v.kind === 'helicopter' && v.mainRotor && PL && PL.vehicle === v) {
        v.mainRotor.rotation.y += dt * 25;
        if (v.tailRotor) v.tailRotor.rotation.x += dt * 60;
      }
    }
  };
})();
