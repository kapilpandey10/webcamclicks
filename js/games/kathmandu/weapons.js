/* Kathmandu Streets — weapon shops and real 3D weapon models (round 9, reworked round 14).
   Three shops on the road near New Road, Chabahil and Thamel sell five real
   3D-model weapons (CC0, from the free 3D Asset Server: the FPS Guns set and
   the Mega Weapon Pack / Tactical Shooter sets). The player holds the GLB in
   the right hand — the grip rotation is per model, because the two packs
   point their barrels in opposite directions (FPS set: muzzle +Z, the other
   two: muzzle -Z) — and can fire it in the open world as well as in Battle
   mode, where the same GLB replaces the old code-built box gun.
   Ammo is unlimited: every gun has a magazine (like Battle mode) and R — or
   an empty magazine — reloads it from an endless reserve. No ammo to buy.
   If a model file cannot be loaded the shop still works and the hand falls
   back to the code-built gun, so a missing file never breaks the game. */
(function () {
  'use strict';
  const KS = window.KS, T = window.THREE;
  const W = (KS.Weapons = {});
  const DIR = 'js/games/kathmandu/models/weapons/';
  /* id, Nepali name, price, Battle kind, target length (m), GLB, muzzle +Z?, magazine size */
  W.WEAPONS = [
    { id: 'pistol', name: 'Service Pistol', np: 'पिस्तोल', price: 2000, kind: 'pistol', len: 0.22, glb: 'pistol.glb', muzzlePosZ: true, ammo: 'light', dmg: 20, rate: 0.28, range: 110, mag: 12, auto: false },
    { id: 'smg', name: 'Compact SMG', np: 'एसएमजी', price: 5000, kind: 'smg', len: 0.42, glb: 'smg.glb', muzzlePosZ: true, ammo: 'light', dmg: 14, rate: 0.09, range: 90, mag: 30, auto: true },
    { id: 'shotgun', name: 'Pump Shotgun', np: 'सटगन', price: 6000, kind: 'shotgun', len: 0.75, glb: 'shotgun.glb', muzzlePosZ: true, ammo: 'shells', dmg: 11, pellets: 8, rate: 0.85, range: 35, mag: 6, auto: false },
    { id: 'ak', name: 'Assault Rifle', np: 'एके राइफल', price: 10000, kind: 'ak', len: 0.70, glb: 'ak.glb', muzzlePosZ: false, ammo: 'heavy', dmg: 24, rate: 0.12, range: 220, mag: 30, auto: true },
    { id: 'sniper', name: 'Bolt Sniper', np: 'स्नाइपर', price: 15000, kind: 'sniper', len: 0.95, glb: 'sniper.glb', muzzlePosZ: false, ammo: 'sniper', dmg: 90, rate: 1.4, range: 500, mag: 5, auto: false },
  ];
  W.byKind = {}; for (const w of W.WEAPONS) W.byKind[w.kind] = w;
  /* Three shops, on clear lots just off the road near each landmark. The front
     faces +Z (toward the road); the building is axis-aligned so its solid is
     exact. Verified clear of buildings by the round-9 diagnostic. */
  W.SHOPS = [
    { id: 'newroad', name: 'New Road Arms', np: 'न्युरोड हतियार पसल', x: -55, z: 50 },
    { id: 'thamel', name: 'Thamel Arms', np: 'ठमेल हतियार पसल', x: -145, z: -310 },
    { id: 'chabahil', name: 'Chabahil Arms', np: 'चाबहिल हतियार पसल', x: 335, z: -520 },
  ];
  W.models = {}; W.ready = false; W.equipped = null; W.owned = {};
  /* rounds in each gun's magazine (unlimited reserve — reload from it with R).
     Battle mode uses the same magazine sizes; the open world shares them. */
  W.mag = {};
  let _loading = null, _cool = 0, _reloadT = 0, _hand = null, _handKind = null;

  /** load the five GLBs once; normalise each to its target length, centred. */
  W.load = () => {
    if (_loading) return _loading;
    _loading = new Promise((resolve) => {
      if (typeof T.GLTFLoader !== 'function') { KS.log && KS.log('GLTFLoader missing — no weapon models'); resolve(false); return; }
      const loader = new T.GLTFLoader();
      let left = W.WEAPONS.length;
      const done = () => { if (--left === 0) { W.ready = true; resolve(true); } };
      for (const w of W.WEAPONS) {
        loader.load(DIR + w.glb, (g) => {
          const wrap = new T.Group(); wrap.add(g.scene);
          const box = new T.Box3().setFromObject(wrap), size = new T.Vector3(); box.getSize(size);
          const s = w.len / Math.max(0.1, size.z); wrap.scale.setScalar(s);
          const b2 = new T.Box3().setFromObject(wrap), c = new T.Vector3(); b2.getCenter(c);
          wrap.position.x -= c.x; wrap.position.z -= c.z; wrap.position.y -= b2.min.y;
          wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          W.models[w.kind] = wrap; done();
        }, undefined, () => { KS.log && KS.log('weapon model failed: ' + w.glb); done(); });
      }
    });
    return _loading;
  };
  /** the grip rotation: the barrel must end up along the arm's -Y (forward
      when aiming) and the sights on top (+Z in the arm's frame). The FPS set
      points its muzzle +Z, so one X turn does it; the other packs point -Z,
      so they first turn 180° about Y (which also mirrors X — invisible on a
      near-symmetric gun). Measured from the models' node data, round 9. */
  function gripRotation(w) {
    const q = new T.Quaternion();
    if (w.muzzlePosZ) q.setFromEuler(new T.Euler(Math.PI / 2, 0, 0));
    else q.setFromEuler(new T.Euler(Math.PI / 2, Math.PI, 0, 'XYZ'));
    return q;
  }
  /** a fresh gun in the hand: the GLB in a wrapper, or null when it did not load.
      The model's origin is at its grip (centred in W.load), so the wrapper
      sits on the hand exactly like the code gun did. */
  W.gunMesh = (kind) => {
    const w = W.byKind[kind], tpl = W.models[kind];
    if (!w || !tpl) return null;
    const wrap = new T.Group(), inner = tpl.clone(true);
    inner.quaternion.copy(gripRotation(w));
    wrap.add(inner); return wrap;
  };
  /** a fresh gun lying flat for the shop display rack: barrel along +X, upright. */
  W.displayMesh = (kind) => {
    const w = W.byKind[kind], tpl = W.models[kind];
    if (!w || !tpl) return null;
    const wrap = new T.Group(), inner = tpl.clone(true);
    inner.rotation.y = w.muzzlePosZ ? -Math.PI / 2 : Math.PI / 2;
    wrap.add(inner); return wrap;
  };
  /** the code-built box gun, for when a GLB is missing (same shape Battle used). */
  W.codeGunMesh = (kind) => {
    const L = { pistol: 0.22, smg: 0.42, ak: 0.7, shotgun: 0.75, sniper: 0.95 }[kind] || 0.3;
    const g = new T.Group();
    const dark = new T.MeshLambertMaterial({ color: 0x1f2124 }), wood = new T.MeshLambertMaterial({ color: 0x6a4424 });
    const body = new T.Mesh(new T.BoxGeometry(0.06, L, 0.1), dark); body.position.y = -L / 2; g.add(body);
    if (kind !== 'pistol') { const st = new T.Mesh(new T.BoxGeometry(0.06, 0.2, 0.12), kind === 'ak' || kind === 'shotgun' ? wood : dark); st.position.set(0, 0.12, -0.02); g.add(st); }
    if (kind === 'ak' || kind === 'smg') { const mg = new T.Mesh(new T.BoxGeometry(0.05, 0.08, 0.18), dark); mg.position.set(0, -L * 0.35, -0.12); mg.rotation.x = 0.3; g.add(mg); }
    if (kind === 'sniper') { const sc = new T.Mesh(new T.CylinderGeometry(0.035, 0.035, 0.3, 8), dark); sc.position.set(0, -0.3, 0.09); g.add(sc); }
    return g;
  };

  /* ---------- the three shops: storefront, sign, display rack, counter ---------- */
  W.build = (scene) => {
    W.load();
    for (const s of W.SHOPS) {
      const b = new KS.Builder();
      /* the shop: a low storefront with a dark glass window and a red band. */
      b.box(s.x, 0, s.z, 12, 5, 4.5, 0x9a7b52);
      b.box(s.x, 5, s.z, 12.4, 0.35, 4.9, 0x5a4632); // roof slab
      b.box(s.x, 3.6, s.z + 2.28, 12.2, 1.4, 0.12, 0x8a2a1a); // red band over the window
      b.box(s.x, 1.6, s.z + 2.28, 10.5, 2.6, 0.1, 0x2a3a4a); // glass window
      b.box(s.x - 5.4, 0, s.z + 2.3, 1, 5, 0.15, 0x5a4632); // side posts
      b.box(s.x + 5.4, 0, s.z + 2.3, 1, 5, 0.15, 0x5a4632);
      b.box(s.x, 0, s.z + 4.2, 4, 1, 1.4, 0x6a4a2a); // counter in front
      scene.add(KS.mesh(b));
      KS.addBox(s.x, s.z, 12, 4.5, 5.2); // the shop itself is solid
      KS.addBox(s.x, s.z + 4.2, 4, 1.4, 1); // the counter is solid
      /* the sign: 🔫 हतियार पसल / WEAPON SHOP + the shop's own name. */
      const sign = new T.Mesh(new T.PlaneGeometry(9, 2.2), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(768, 192, (g, ww, hh) => {
        g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, ww, hh);
        g.strokeStyle = '#d8a028'; g.lineWidth = 6; g.strokeRect(8, 8, ww - 16, hh - 16);
        g.fillStyle = '#d8a028'; g.textAlign = 'center'; g.font = `700 62px ${KS.FONT}`;
        g.fillText('🔫 हतियार पसल', ww / 2, 76);
        g.fillStyle = '#fff'; g.font = '700 44px "Barlow Condensed", sans-serif';
        g.fillText(s.name.toUpperCase() + ' · WEAPONS', ww / 2, 142);
      }) }));
      sign.position.set(s.x, 6.4, s.z + 2.4); scene.add(sign);
      /* the display rack: the five real models on the front wall, with a
         small price board under each. They appear as soon as the GLBs load. */
      s.rackY = 1.7; s.rackZ = s.z + 2.45;
      s.rack = [];
      W.load().then(() => {
        W.WEAPONS.forEach((w, i) => {
          const m = W.displayMesh(w.kind) || W.codeGunMesh(w.kind);
          m.position.set(s.x - 4.4 + i * 2.2, s.rackY, s.rackZ);
          m.scale.setScalar(1.15); scene.add(m); s.rack.push(m);
          const tag = new T.Mesh(new T.PlaneGeometry(1.9, 0.5), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(256, 64, (g, ww, hh) => {
            g.fillStyle = '#fff8e0'; g.fillRect(0, 0, ww, hh);
            g.fillStyle = '#1a1a1a'; g.textAlign = 'center'; g.font = `700 30px ${KS.FONT}`;
            g.fillText(`${w.name} · रु ${w.price.toLocaleString('en-IN')}`, ww / 2, 42);
          }) }));
          tag.position.set(s.x - 4.4 + i * 2.2, s.rackY - 0.55, s.rackZ + 0.05); scene.add(tag);
        });
      });
      s.counter = { x: s.x, z: s.z + 4.2 };
      if (KS.landmarks) KS.landmarks.push({ id: 'weapons-' + s.id, name: s.name + ' 🔫', np: s.np, x: s.x, z: s.z, r: 12, fact: 'Weapon shop. Real 3D-model guns — buy one, hold it, and it works in the open world and in Battle mode.' });
    }
  };
  W.nearest = (x, z, r) => {
    let best = null, bd = r == null ? 1e9 : r;
    for (const s of W.SHOPS) { const d = Math.hypot(s.counter.x - x, s.counter.z - z); if (d < bd) { bd = d; best = s; } }
    return best;
  };
  /* ---------- buying: cash, the arsenal, and the shop modal ---------- */
  W.data = () => {
    const D = KS.Shop && KS.Shop.data; if (!D) return null;
    D.weapons = D.weapons || {};
    D.weaponMag = D.weaponMag || {};
    for (const w of W.WEAPONS) if (D.weapons[w.kind] && D.weaponMag[w.kind] == null) D.weaponMag[w.kind] = w.mag;
    return D;
  };
  W.refresh = () => {
    const D = W.data(); if (!D) return;
    W.owned = D.weapons; W.mag = D.weaponMag;
  };
  W.openShop = (shop) => {
    const D = W.data(); if (!D) return;
    const PL = KS.Player, A = KS.audio;
    const rows = W.WEAPONS.map((w) => {
      const owned = !!D.weapons[w.kind];
      return [`${owned ? '✔ ' : '🔫 '}${w.name} (${w.np}) · रु ${w.price.toLocaleString('en-IN')}${owned ? ' — owned' : ''}`, () => {
        if (owned) { W.equip(w.kind); KS.modalClose(); return; }
        if (D.cash < w.price) { KS.Game.notify('Not enough cash — this one costs रु ' + w.price.toLocaleString('en-IN') + '.', 'bad'); return; }
        D.cash -= w.price; D.weapons[w.kind] = true; D.weaponMag[w.kind] = w.mag;
        KS.Shop.save(); W.refresh(); A && A.coin && A.coin();
        KS.modalClose(); W.equip(w.kind);
        KS.Game.notify(`🔫 ${w.name} is yours — ammo is unlimited, just reload with <b>R</b>. Hold <b>Click</b> to fire, <b>Right-click</b> to aim.`, 'good');
      }];
    });
    const equipRows = W.WEAPONS.filter((w) => D.weapons[w.kind]).map((w) => [`🤲 Hold the ${w.name}`, () => { W.equip(w.kind); KS.modalClose(); }]);
    KS.modal(`🔫 ${shop.name} · ${shop.np}`,
      `<p>"Namaste! Real guns, real prices — no licence needed in the game." Your cash: <b>रु ${Math.round(D.cash).toLocaleString('en-IN')}</b>.${W.equipped ? ` You are holding the <b>${W.byKind[W.equipped].name}</b>.` : ''}</p><p class="small">Ammo is unlimited — every gun has a magazine, reload with R (it reloads itself when empty).</p>`,
      rows.concat(equipRows, [['Put the gun away', () => { W.equip(null); KS.modalClose(); }], ['Maybe later', () => KS.modalClose()]]));
  };
  /* ---------- holding it: the GLB in the right hand, the aim pose ---------- */
  W.equip = (kind) => {
    const PL = KS.Player; if (!PL || !PL.person) return;
    W.refresh(); // make sure the magazines are loaded from the save
    if (_hand) { _hand.parent && _hand.parent.remove(_hand); _hand = null; _handKind = null; }
    W.equipped = kind; if (!kind) { PL.person.busyArm = false; return; }
    const w = W.byKind[kind];
    _hand = W.gunMesh(kind) || W.codeGunMesh(kind);
    _hand.position.set(0, -0.6, 0.07); _hand.scale.setScalar(1.3);
    PL.person.armR.add(_hand); _handKind = kind;
    KS.Game && KS.Game.notify(`🤲 Holding the ${w.name}. Hold <b>Click</b> to fire · <b>Right-click</b> to aim · <b>R</b> reload · <b>1–5</b> switch. Ammo is unlimited.`, 'good');
  };
  W.aimPose = (person, k) => { person.busyArm = true; person.armR.rotation.set(-1.45 * k, 0, -0.12); person.armL.rotation.set(-1.3 * k, 0, 0.5 * k); };
  /* ---------- firing in the open world: hitscan, tracer, and a real hit ---------- */
  let _tracer = null;
  function tracer(a, b2) {
    if (!_tracer) _tracer = [];
    const geo = new T.BufferGeometry().setFromPoints([a.clone(), b2.clone()]);
    const l = new T.Line(geo, new T.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.9 }));
    KS.scene.add(l); _tracer.push({ o: l, t: 0.09 });
  }
  function hitPerson(ox, oy, oz, dx, dy, dz, px, py, pz) {
    /* a ray against a standing person (a vertical capsule): returns the
       distance along the ray, or null. Same test Battle uses. */
    const rx = px - ox, ry = py + 0.9 - oy, rz = pz - oz;
    const t = rx * dx + ry * dy + rz * dz; if (t < 0) return null;
    const cx = ox + dx * t - px, cy = oy + dy * t - (py + 0.9), cz = oz + dz * t - pz;
    const d2 = cx * cx + cz * cz; if (d2 > 0.45 * 0.45 || cy < -0.9 || cy > 0.9) return null;
    return t;
  }
  /** reload the magazine from the endless reserve (1.6 s) */
  W.startReload = () => {
    const w = W.byKind[W.equipped];
    if (!w || _reloadT > 0 || (W.mag[W.equipped] || 0) >= w.mag) return false;
    _reloadT = 1.6; KS.audio && KS.audio.click && KS.audio.click();
    return true;
  };
  W.fire = () => {
    const PL = KS.Player, kind = W.equipped, w = W.byKind[kind];
    if (!PL || !kind || !w || _cool > 0 || _reloadT > 0) return;
    if ((W.mag[kind] || 0) <= 0) { // empty magazine: click, then it reloads itself
      KS.audio && KS.audio.click && KS.audio.click(); _cool = 0.3;
      W.startReload();
      return;
    }
    W.mag[kind]--; _cool = w.rate;
    const D = W.data(); if (D) { D.weaponMag[kind] = W.mag[kind]; KS.Shop.save(); }
    if (W.mag[kind] === 0) W.startReload(); // last round out: reload straight away
    const cam = KS.camera; if (!cam) return;
    const dir = new T.Vector3(); cam.getWorldDirection(dir);
    const o = new T.Vector3().copy(cam.position);
    KS.audio && KS.audio.gun && KS.audio.gun(kind, 1);
    KS.Cam.shake = Math.max(KS.Cam.shake || 0, kind === 'shotgun' || kind === 'sniper' ? 0.08 : 0.03);
    const pellets = w.pellets || 1, spread = 0.008 * (KS.Cam.aim > 0.5 ? 0.25 : 1);
    let hitAny = false;
    for (let k = 0; k < pellets; k++) {
      const d = dir.clone();
      d.x += KS.r(-spread, spread); d.y += KS.r(-spread, spread); d.z += KS.r(-spread, spread); d.normalize();
      let best = null, bt = w.range, bestMansion = null;
      if (KS.Peds) KS.Peds.forEachNear(PL.x, PL.z, w.range, (p) => {
        if (p.down > 0 || p.mode === 'sit') return;
        const t = hitPerson(o.x, o.y, o.z, d.x, d.y, d.z, p.x, p.y || 0, p.z);
        if (t != null && t < bt) { bt = t; best = p; }
      });
      // the household can be shot too (same floor only) — and they shoot back by punching and kicking
      if (KS.Mansion && KS.Mansion.people) for (const mp of KS.Mansion.people) {
        if (mp.down > 0 || mp.dead || Math.abs((mp.y || 0) - PL.y) > 3) continue;
        const t = hitPerson(o.x, o.y, o.z, d.x, d.y, d.z, mp.x, mp.y || 0, mp.z);
        if (t != null && t < bt) { bt = t; bestMansion = mp; best = null; }
      }
      const end = o.clone().addScaledVector(d, bt);
      tracer(o, end);
      if (bestMansion) {
        hitAny = true;
        const dmg = w.dmg * (bt > w.range * 0.6 ? 0.75 : 1);
        KS.Mansion.hitPerson(bestMansion, dmg, PL.x, PL.z);
        if (KS.FX) KS.FX.burst(bestMansion.x, (bestMansion.y || 0) + 1.2, bestMansion.z, 0xaa2211, 6);
      } else if (best) {
        hitAny = true;
        const dmg = w.dmg * (bt > w.range * 0.6 ? 0.75 : 1);
        if (KS.Damage && KS.Damage.hitPed) KS.Damage.hitPed(best, dmg, PL.x, PL.z);
        else if (KS.Peds) KS.Peds.knock(best, PL.x, PL.z, dmg > 50);
        if (KS.FX) KS.FX.burst(best.x, (best.y || 0) + 1.2, best.z, 0xaa2211, 6);
      } else if (bt < w.range - 1 && KS.FX) KS.FX.burst(end.x, end.y, end.z, 0xbcb4a4, 4);
    }
    if (hitAny && KS.Law) KS.Law.raise(1, 'shooting');
  };
  W.update = (dt) => {
    if (_cool > 0) _cool -= dt;
    if (_reloadT > 0) {
      _reloadT -= dt;
      if (_reloadT <= 0) {
        const w = W.byKind[W.equipped];
        if (w) {
          W.mag[W.equipped] = w.mag;
          const D = W.data(); if (D) { D.weaponMag[W.equipped] = w.mag; KS.Shop.save(); }
          KS.Game.notify('🔫 Reloaded.', 'good');
        }
      }
      W.hud(); return;
    }
    const PL = KS.Player; if (!PL || !W.equipped || PL.vehicle || PL.mode !== 'foot') { W.hud(); return; }
    if (KS.Battle && KS.Battle.on) { W.hud(); return; } // Battle mode has its own gun handling
    const I = KS.Input; if (!I) { W.hud(); return; }
    const w = W.byKind[W.equipped];
    const aiming = I.down('Mouse2') || I.down('KeyAim');
    if (aiming) W.aimPose(PL.person, 1);
    else PL.person.busyArm = false; // the walk animation owns the arms again
    if (I.hit('KeyR')) W.startReload();
    if (_cool <= 0 && I.down('Mouse0')) W.fire(); // hold to fire, every gun
    W.hud();
  };
  /** the ammo counter under the crosshair: gun, rounds in the magazine, ∞ reserve */
  W.hud = () => {
    const el = typeof document !== 'undefined' && document.getElementById ? document.getElementById('ammoHud') : null;
    if (!el) return;
    const PL = KS.Player, w = W.byKind[W.equipped];
    if (!w || !PL || PL.vehicle || PL.mode !== 'foot' || (KS.Battle && KS.Battle.on)) { el.hidden = true; return; }
    el.hidden = false;
    const n = W.mag[W.equipped] || 0;
    el.innerHTML = `<b>${w.name}</b><span>${_reloadT > 0 ? 'reloading…' : n + ' / ∞'}</span>`;
    if (el.classList) el.classList.toggle('low', n <= 2 && _reloadT <= 0);
  };
  /* Battle mode reuses the same hand: the GLB replaces the box gun there too. */
  W.battleGunMesh = (kind) => W.gunMesh(kind) || W.codeGunMesh(kind);
})();
