/* Kathmandu Streets — input (keyboard, mouse, touch), player on foot and driving, punches, health,
   vehicle upgrades and nitro, seven camera angles. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;

  /* ================= input ================= */
  const I = (KS.Input = { keys: {}, pressed: new Set(), look: { dx: 0, dy: 0 }, joy: { x: 0, y: 0 }, zoom: 0, lastLook: -10, locked: false });
  const PREVENT = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'];
  I.down = (c) => I.keys[c] || false;
  I.hit = (c) => I.pressed.has(c);
  I.endFrame = () => { I.pressed.clear(); I.look.dx = I.look.dy = 0; I.zoom = 0; };
  I.init = (canvas) => {
    addEventListener('keydown', (e) => {
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA')) return;
      if (PREVENT.includes(e.code)) e.preventDefault();
      if (!e.repeat) I.pressed.add(e.code);
      I.keys[e.code] = true;
    });
    addEventListener('keyup', (e) => { I.keys[e.code] = false; });
    addEventListener('blur', () => { I.keys = {}; });
    let drag = false, lx = 0, ly = 0;
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    addEventListener('mouseup', (e) => { I.keys['Mouse' + e.button] = false; });
    canvas.addEventListener('mousedown', (e) => {
      if (I.locked) { I.keys['Mouse' + e.button] = true; I.pressed.add('Mouse' + e.button); } // fire / aim while the mouse controls the camera
      drag = true; lx = e.clientX; ly = e.clientY;
      if (KS.state === 'play' && !I.locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* not available */ } }
    });
    addEventListener('mouseup', () => (drag = false));
    addEventListener('mousemove', (e) => {
      if (I.locked) { I.look.dx += KS.clamp(e.movementX, -120, 120); I.look.dy += KS.clamp(e.movementY, -120, 120); I.lastLook = KS.clock; }
      else if (drag) { I.look.dx += e.clientX - lx; I.look.dy += e.clientY - ly; lx = e.clientX; ly = e.clientY; I.lastLook = KS.clock; }
    });
    const hint = (t, ms) => { const h = document.getElementById('mouseHint'); if (!h || matchMedia('(pointer: coarse)').matches) return; h.textContent = t; h.hidden = false; clearTimeout(I.hintT); I.hintT = setTimeout(() => (h.hidden = true), ms); };
    document.addEventListener('pointerlockchange', () => {
      const was = I.locked; I.locked = document.pointerLockElement === canvas;
      if (I.locked) hint('🖱 Mouse controls the camera · press Alt (or Esc) to free the cursor', 3500);
      else if (was) { I.unlockedAt = performance.now(); I.keys = {}; if (KS.state === 'play') hint('Cursor free · click the game to control the camera again', 3500); }
    });
    // Alt frees the cursor without pausing (to click the phone, map or buttons)
    addEventListener('keydown', (e) => { if ((e.code === 'AltLeft' || e.code === 'AltRight') && I.locked) { e.preventDefault(); document.exitPointerLock(); } });
    canvas.addEventListener('wheel', (e) => { I.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    let joyId = null, lookId = null, jx = 0, jy = 0, tlx = 0, tly = 0;
    if (joy) {
      const moveJoy = (t) => {
        let dx = t.clientX - jx, dy = t.clientY - jy; const m = Math.hypot(dx, dy), R = 46;
        if (m > R) { dx *= R / m; dy *= R / m; }
        I.joy.x = dx / R; I.joy.y = -dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
      joy.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; joyId = t.identifier; const r = joy.getBoundingClientRect(); jx = r.left + r.width / 2; jy = r.top + r.height / 2; e.preventDefault(); moveJoy(t); }, { passive: false });
      addEventListener('touchmove', (e) => {
        for (const t of e.changedTouches) {
          if (t.identifier === joyId) moveJoy(t);
          else if (t.identifier === lookId) { I.look.dx += (t.clientX - tlx) * 1.6; I.look.dy += (t.clientY - tly) * 1.2; tlx = t.clientX; tly = t.clientY; I.lastLook = KS.clock; }
        }
      }, { passive: false });
      const end = (e) => { for (const t of e.changedTouches) { if (t.identifier === joyId) { joyId = null; I.joy.x = I.joy.y = 0; knob.style.transform = ''; } if (t.identifier === lookId) lookId = null; } };
      addEventListener('touchend', end); addEventListener('touchcancel', end);
      canvas.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; if (lookId == null) { lookId = t.identifier; tlx = t.clientX; tly = t.clientY; } e.preventDefault(); }, { passive: false });
    }
    document.querySelectorAll('[data-key]').forEach((btn) => {
      const code = btn.dataset.key;
      const on = (e) => { e.preventDefault(); I.keys[code] = true; I.pressed.add(code); btn.classList.add('on'); };
      const off = (e) => { e.preventDefault(); I.keys[code] = false; btn.classList.remove('on'); };
      btn.addEventListener('touchstart', on, { passive: false }); btn.addEventListener('touchend', off, { passive: false });
      btn.addEventListener('mousedown', on); btn.addEventListener('mouseup', off); btn.addEventListener('mouseleave', off);
    });
  };
  const axis = () => {
    let x = (I.down('KeyD') || I.down('ArrowRight') ? 1 : 0) - (I.down('KeyA') || I.down('ArrowLeft') ? 1 : 0);
    let y = (I.down('KeyW') || I.down('ArrowUp') ? 1 : 0) - (I.down('KeyS') || I.down('ArrowDown') ? 1 : 0);
    if (I.joy.x || I.joy.y) { x = I.joy.x; y = I.joy.y; }
    return { x, y };
  };
  KS.axis = axis;

  /* ================= player ================= */
  const PL = (KS.Player = { x: -135, z: -261, y: 0.22, vy: 0, h: 0, speed: 0, mode: 'foot', vehicle: null, swim: false, len: 0.5, wid: 0.6, health: 100, punchT: 0, nitro: 0, nitroCool: 0, stepPh: 0 });
  KS.CAMS = ['Shoulder', 'Far chase', 'First person', 'Hood', 'Drone', 'Cinematic', 'Side'];
  const cam = (KS.Cam = { yaw: 0, pitch: 0.22, dist: 4, want: 4, mode: 0, shake: 0, orbit: 0, side: 0.6 });
  const exDrivers = [];
  PL.init = (scene) => {
    PL.scene = scene; PL.rebuild();
    // a real torch for you and real headlights for whatever you drive (other lights are faked with beams)
    PL.torch = new T.SpotLight(0xfff2d0, 0, 32, 0.5, 0.55, 1.3); PL.torch.target = new T.Object3D(); scene.add(PL.torch, PL.torch.target);
    PL.headlight = new T.SpotLight(0xfff6e2, 0, 70, 0.62, 0.45, 1.1); PL.headlight.target = new T.Object3D(); scene.add(PL.headlight, PL.headlight.target);
    for (let i = 0; i < 3; i++) { const p = KS.makePerson(KS.pick(['man', 'woman', 'office'])); p.root.visible = false; scene.add(p.root); exDrivers.push({ p, t: 0, x: 0, z: 0, h: 0 }); }
  };
  /** rebuild the player's body from the wardrobe outfit */
  PL.rebuild = () => {
    const old = PL.person, parent = old ? old.root.parent : PL.scene;
    const p = KS.makePerson('player', KS.Shop ? KS.Shop.playerOutfit() : KS.outfitFor('man'));
    if (old) { p.root.position.copy(old.root.position); p.root.rotation.copy(old.root.rotation); p.root.visible = old.root.visible; parent && parent.remove(old.root); }
    (parent || PL.scene).add(p.root); PL.person = p;
    if (PL.vehicle && KS.isBike(PL.vehicle.kind)) seatOnBike();
  };
  function seatOnBike() { const p = PL.person; p.root.position.set(0, 0.18, -0.32); p.root.rotation.set(0, 0, 0); KS.animSit(p); p.armL.rotation.x = p.armR.rotation.x = -1.2; p.legL.rotation.x = p.legR.rotation.x = -1.3; }
  function ejectDriver(v) {
    const d = exDrivers.find((e) => e.t <= 0) || exDrivers[0];
    const sx = Math.cos(v.h), sz = -Math.sin(v.h);
    d.x = v.x + sx * (v.type.wid / 2 + 0.8); d.z = v.z + sz * (v.type.wid / 2 + 0.8); d.h = Math.atan2(sx, sz); d.t = 14;
    d.p.root.visible = true; d.p.root.position.set(d.x, v.y, d.z);
    KS.say(d.p.root, KS.pick(['Mero gaadi!! 😡', 'Oi! Chor!', 'Police! Police!', 'Hey! That\'s mine!']), 3, 'angry');
    KS.Game && KS.Game.karma(-3, 'Took a vehicle');
    if (KS.Law && KS.Law.policeNear(v.x, v.z, 60)) KS.Law.raise(1, 'Vehicle theft');
  }
  PL.enter = (v) => {
    if (v.ai && v.speed > 9) return false;
    if (v.ai) ejectDriver(v);
    if (PL.umbrella) closeUmbrella();
    v.ai = false; v.parked = false; PL.vehicle = v; PL.mode = 'drive'; v.speed = Math.min(v.speed, 3); v.vx = null; v.lot = null; if (v.bay) { v.bay.v = null; v.bay = null; }
    if (v.rider) v.rider.visible = false;
    if (KS.isBike(v.kind)) { v.root.add(PL.person.root); seatOnBike(); }
    else PL.person.root.visible = false;
    cam.want = v.type.len > 6 ? 15 : KS.isBike(v.kind) ? 6.5 : 9;
    KS.Game && KS.Game.onEnter(v);
    return true;
  };
  PL.exit = () => {
    const v = PL.vehicle; if (!v) return;
    if (Math.abs(v.speed) > 6) return;
    if (v.kind === 'helicopter') { KS.audio && KS.audio.heli && KS.audio.heli(0); v.alt = 0; v.vy = 0; v.vx = 0; v.vz = 0; }
    if (v.root.rotation.z) v.root.rotation.z = 0;
    const sx = Math.cos(v.h), sz = -Math.sin(v.h);
    let x = v.x + sx * (v.type.wid / 2 + 0.9), z = v.z + sz * (v.type.wid / 2 + 0.9);
    const c = KS.collide(x, z, 0.4, v.y, 1); x = c.x; z = c.z;
    if (PL.person.root.parent !== PL.scene) PL.scene.add(PL.person.root);
    PL.person.root.visible = true; PL.person.root.rotation.set(0, 0, 0); PL.person.legL.rotation.x = PL.person.legR.rotation.x = 0;
    PL.x = x; PL.z = z; PL.y = Math.max(v.y, KS.groundAt(x, z, v.y + 1, 1.2)); PL.h = v.h; PL.vy = 0;
    v.parked = true; v.speed = 0; v.vx = null; PL.vehicle = null; PL.mode = 'foot'; cam.want = 4;
    KS.Game && KS.Game.onExit(v);
  };

  /* ---------- rowing boats on Rani Pokhari ---------- */
  PL.boardBoat = (b) => {
    b.used = true; PL.boat = b; PL.mode = 'boat'; b.speed = 0;
    const p = PL.person; b.g.add(p.root); p.root.position.set(0, 0.25, -0.35); p.root.rotation.set(0, Math.PI, 0); // rowers face the stern
    p.legL.rotation.x = p.legR.rotation.x = -1.3;
    PL.x = b.x; PL.z = b.z; PL.y = -0.3; cam.want = 6;
  };
  PL.leaveBoat = () => {
    const b = PL.boat; if (!b) return;
    if (!b.nearJetty) { KS.Game && KS.Game.notify('Row back to the wooden jetty by the gate to get off.'); return; }
    const p = PL.person, J = KS.pond.jetty; PL.scene.add(p.root); p.root.rotation.set(0, 0, 0); p.legL.rotation.x = p.legR.rotation.x = 0; p.armL.rotation.x = p.armR.rotation.x = 0;
    PL.x = J.x - 1.2; PL.z = J.z; PL.y = 0.3; PL.vy = 0; PL.mode = 'foot'; PL.boat = null; cam.want = 4;
    b.used = false; b.speed = 0; b.x = b.home.x; b.z = b.home.z; b.h = 0; b.g.position.set(b.x, -0.62, b.z); b.g.rotation.set(0, 0, 0);
  };
  function boatUpdate(dt) {
    const b = PL.boat, P = KS.pond, a = axis(), p = PL.person;
    b.speed += (a.y * 2.4 - b.speed * 0.8) * dt; b.turn += (-a.x * 1.1 - b.turn) * Math.min(1, dt * 3);
    b.h += b.turn * dt * (0.4 + Math.min(1, Math.abs(b.speed)));
    let nx = b.x + Math.sin(b.h) * b.speed * dt, nz = b.z + Math.cos(b.h) * b.speed * dt;
    const lim = P.S / 2 - 1.8, isl = P.island + 0.6;
    const blocked = (x, z) => Math.abs(x - P.cx) > lim || Math.abs(z - P.cz) > lim || (Math.abs(x - P.cx) < isl && Math.abs(z - P.cz) < isl) || (Math.abs(x - P.cx) < P.causeway + 0.9 && z > P.cz);
    if (blocked(nx, nz)) { b.speed *= -0.3; nx = b.x; nz = b.z; KS.Cam.shake = 0.1; }
    b.x = nx; b.z = nz; b.ph += dt * (1.5 + Math.abs(a.y) * 2.5);
    b.g.position.set(b.x, -0.62 + Math.sin(KS.clock * 1.7) * 0.03, b.z); b.g.rotation.set(Math.sin(KS.clock * 1.3) * 0.02, b.h, Math.sin(KS.clock * 1.1) * 0.025);
    const stroke = Math.abs(a.y) > 0.1 || Math.abs(a.x) > 0.1 ? Math.sin(b.ph * 2) : 0;
    b.oars.forEach((o, i) => { o.rotation.y = (i ? -1 : 1) * stroke * 0.5; o.rotation.z = (i ? -1 : 1) * (0.15 + Math.max(0, stroke) * 0.12); });
    p.armL.rotation.x = p.armR.rotation.x = -1.2 + stroke * 0.5;
    PL.x = b.x; PL.z = b.z; PL.y = -0.3; PL.h = b.h; PL.speed = Math.abs(b.speed);
    b.nearJetty = Math.hypot(b.x - P.jetty.x - 1.5, b.z - P.jetty.z) < 3.2;
    const st2 = Math.floor(b.ph / Math.PI); if (stroke && st2 !== b.lastSt) { b.lastSt = st2; KS.audio && KS.audio.paddle && KS.audio.paddle(); }
  }

  /* climbing: jump at a wall and keep pushing forward to climb it, pulling yourself up onto the roof */
  function climbUpdate(dt) {
    const C = PL.climb, a = axis(), p = PL.person, s = C.solid;
    if ((I.hit('Space') && C.t > 0.3) || a.y < -0.3) { PL.climb = null; PL.vy = 0; PL.person.busyArm = false; PL.x -= Math.sin(PL.h) * 0.3; PL.z -= Math.cos(PL.h) * 0.3; return true; } // let go
    C.t += dt;
    if (a.y > 0.2) { PL.y += 2.6 * dt; C.ph += dt * 7; }
    p.busyArm = true; const sw = Math.sin(C.ph);
    p.armL.rotation.set(-2.8 + sw * 0.35, 0, 0.15); p.armR.rotation.set(-2.8 - sw * 0.35, 0, -0.15); p.legL.rotation.x = -0.6 + sw * 0.5; p.legR.rotation.x = -0.6 - sw * 0.5;
    p.inner.rotation.x = 0.05;
    if (PL.y >= s.top - 0.15) { // over the top: pull up and step onto the roof
      PL.y = s.top; PL.x += Math.sin(PL.h) * 0.9; PL.z += Math.cos(PL.h) * 0.9; PL.climb = null; PL.vy = 0; p.busyArm = false; KS.audio && KS.audio.step(true);
      KS.Game && KS.Game.notify && s.top > 12 && KS.Game.notify('🧗 On the roof! Look around for coins.');
    }
    p.root.position.set(PL.x, PL.y, PL.z); p.root.rotation.y = PL.h; PL.speed = 0;
    return true;
  }
  /* ---------- umbrella: float down from roofs and jumps ----------
     X opens it while you are falling; it also opens by itself when you fall off
     something high, so a jump off a roof never ends in a hard landing. */
  let umbMesh = null;
  function openUmbrella() {
    if (PL.umbrella) return;
    if (!umbMesh) {
      umbMesh = new THREE.Group();
      const canopy = new THREE.Mesh(new THREE.ConeGeometry(1.15, 0.5, 8, 1, true), new THREE.MeshLambertMaterial({ color: 0xd12b2b, side: THREE.DoubleSide }));
      umbMesh.add(canopy);
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.35, 6), new THREE.MeshLambertMaterial({ color: 0x8a8a90 })); tip.position.y = 0.42; umbMesh.add(tip);
      const stick = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1.15, 6), new THREE.MeshLambertMaterial({ color: 0x5a4632 })); stick.position.y = -0.55; umbMesh.add(stick);
      umbMesh.visible = false; PL.scene.add(umbMesh);
    }
    PL.umbrella = true; umbMesh.visible = true; KS.audio && KS.audio.chute && KS.audio.chute();
  }
  function closeUmbrella() { PL.umbrella = false; if (umbMesh) umbMesh.visible = false; }
  function footUpdate(dt) {
    if (PL.climb) { climbUpdate(dt); return; }
    const a = axis(), run = I.down('ShiftLeft') || I.down('ShiftRight') || I.down('KeyRun');
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
    let mx = fx * a.y + rx * a.x, mz = fz * a.y + rz * a.x; const m = Math.hypot(mx, mz);
    const top = PL.swim ? 1.6 : run ? 8.2 : 4.2;
    let want = 0;
    const strafe = KS.Battle && KS.Battle.armed() && cam.mode !== 2;
    if (strafe) { PL.h = KS.angLerp(PL.h, cam.yaw, Math.min(1, dt * 16)); if (m > 0.05) { mx /= Math.max(1, m); mz /= Math.max(1, m); want = top * Math.min(1, m) * (KS.Cam.aim > 0.5 ? 0.55 : 0.85); PL.moveA = Math.atan2(mx, mz) - PL.h; } }
    else if (m > 0.05 && cam.mode !== 2) { mx /= Math.max(1, m); mz /= Math.max(1, m); want = top * Math.min(1, m); PL.h = KS.angLerp(PL.h, Math.atan2(mx, mz), Math.min(1, dt * 10)); }
    else if (cam.mode === 2 && Math.abs(a.y) + Math.abs(a.x) > 0.05) { PL.h = cam.yaw; want = top * Math.min(1, Math.hypot(a.x, a.y)); const ang = Math.atan2(-a.x, a.y); PL.moveA = ang; }
    PL.speed += KS.clamp(want - PL.speed, -30 * dt, 18 * dt);
    const ma = cam.mode === 2 || strafe ? PL.h + (PL.moveA || 0) : PL.h;
    const dirx = Math.sin(ma), dirz = Math.cos(ma);
    let nx = PL.x + dirx * PL.speed * dt, nz = PL.z + dirz * PL.speed * dt;
    const c = KS.collide(nx, nz, 0.38, PL.y, 1.05); nx = c.x; nz = c.z;
    if (KS.Traffic.pushOut && PL.y < 2.5) { const o = KS.Traffic.pushOut(nx, nz, 0.38); if (o.hit) { const c2 = KS.collide(o.x, o.z, 0.38, PL.y, 1.05); nx = c2.x; nz = c2.z; } } // buses, cars and bikes are solid
    PL.x = nx; PL.z = nz;
    // jumping at a wall that is too high to step on starts a climb
    if ((I.hit('Space') || I.hit('KeyJump')) && c.hit && c.solid && c.solid.top > PL.y + 1.05 && c.solid.top < PL.y + 60 && c.solid.base <= PL.y + 0.5 && !PL.swim && !(KS.Battle && KS.Battle.armed() && KS.Cam.aim > 0.5)) {
      PL.climb = { solid: c.solid, t: 0, ph: 0 }; const sx = c.solid.t === 1 ? c.solid.cx : KS.clamp(PL.x, c.solid.x0, c.solid.x1), sz = c.solid.t === 1 ? c.solid.cz : KS.clamp(PL.z, c.solid.z0, c.solid.z1);
      PL.h = Math.atan2(sx - PL.x, sz - PL.z); KS.Game && KS.Game.notify && !PL.climbTold && (PL.climbTold = true, KS.Game.notify('🧗 Climbing: hold <b>W</b> to climb, <b>S</b> or <b>Space</b> to let go.'));
      return;
    }
    if ((I.hit('Space') || I.hit('KeyJump')) && PL.grounded && !PL.swim) { PL.vy = 6.4; PL.grounded = false; }
    // umbrella: X opens it while falling; it also opens by itself when you fall off something high
    if (!PL.grounded && !PL.swim && !PL.umbrella) {
      const drop = PL.y - KS.groundAt(PL.x, PL.z, PL.y, 1.05);
      if (I.hit('KeyX') && PL.vy < -1) openUmbrella();
      else if (PL.vy < -8 && drop > 10) { openUmbrella(); KS.Game && KS.Game.notify('☂️ Umbrella open — steer with <b>W A S D</b>, press <b>X</b> to fold it.'); }
      else if (PL.vy < -8 && drop > 8 && !PL.umbTold) { PL.umbTold = true; KS.Game && KS.Game.notify('☂️ Falling fast — press <b>X</b> to open your umbrella!'); }
    }
    if (PL.umbrella) {
      if (I.hit('KeyX')) closeUmbrella();
      else {
        PL.vy += (-2.4 - PL.vy) * Math.min(1, dt * 3); // float down gently, no hard landing
        if (Math.hypot(a.x, a.y) > 0.05) { const ang = Math.atan2(-a.x, a.y) + cam.yaw; PL.x += Math.sin(ang) * 4.5 * dt; PL.z += Math.cos(ang) * 4.5 * dt; PL.h = ang; }
      }
    } else PL.vy -= 20 * dt;
    PL.y += PL.vy * dt;
    let g = KS.groundAt(PL.x, PL.z, PL.y, 1.05);
    const wl = KS.waterLevel(PL.x, PL.z), lvl = wl != null ? wl : KS.RIVER.water; // pools and the waterfall pool, else the river
    PL.swim = g < lvl - 0.6;
    if (PL.swim) g = lvl - 1.25;
    if (PL.y <= g) {
      // a hard landing hurts: about 6 m is a bad fall, 15 m can knock you out
      if (PL.vy < -11.5 && !PL.swim) { const dmg = Math.round((-PL.vy - 11.5) * 6.5); KS.Game && KS.Game.hurt(dmg); KS.Game && KS.Game.notify(`🤕 Hard landing! −${dmg} health`, 'bad'); }
      if (PL.umbrella) closeUmbrella(); // folded on landing
      PL.y = g; PL.vy = 0; PL.grounded = true;
    } else PL.grounded = PL.y - g < 0.05;
    let vy = PL.y;
    if (vy < 0.3 && vy > -0.2 && onSidewalk(PL.x, PL.z)) vy = Math.max(vy, 0.22);
    const pr = PL.person.root; pr.position.set(PL.x, vy, PL.z); pr.rotation.y = PL.h;
    if (PL.umbrella && umbMesh) { umbMesh.position.set(PL.x, PL.y + 2.5, PL.z); umbMesh.rotation.set(0.1, PL.h, 0); }
    const p = PL.person;
    if (PL.swim) { p.armL.rotation.x = Math.sin(KS.clock * 5) * 2; p.armR.rotation.x = -Math.sin(KS.clock * 5) * 2; p.legL.rotation.x = p.legR.rotation.x = 0.3; }
    else KS.animWalk(p, dt, PL.grounded ? PL.speed : 0.01);
    if (!PL.grounded && !PL.swim) { p.legL.rotation.x = -0.7; p.legR.rotation.x = 0.35; if (!p.busyArm) { p.armL.rotation.set(-0.9, 0, 0.5); p.armR.rotation.set(-0.6, 0, -0.5); } }
    // footsteps
    if (PL.grounded && PL.speed > 0.5) { const ph = Math.floor(p.phase / Math.PI); if (ph !== PL.stepPh) { PL.stepPh = ph; KS.audio && KS.audio.step(PL.speed > 6); } }
    // punch
    PL.punchT = Math.max(0, PL.punchT - dt);
    if ((I.hit('KeyF') || I.hit('KeyHit')) && PL.punchT <= 0 && !PL.swim && !(KS.Battle && KS.Battle.armed())) {
      PL.punchT = 0.45; PL.punchA = 0; KS.audio && KS.audio.swing();
      setTimeout(() => { const ped = KS.Peds.punch(PL.x, PL.z, PL.h); if (ped && KS.Game) KS.Game.onPunch(ped); }, 120);
    }
    if (PL.punchA != null) { PL.punchA += dt * 3.2; p.busyArm = true; KS.animPunch(p, PL.punchA); if (PL.punchA >= 1) { PL.punchA = null; p.busyArm = false; } }
    if (PL.speed > 3) KS.Peds.bump(PL.x, PL.z, 0.9, dirx * PL.speed, dirz * PL.speed, PL.speed * 0.5);
    // idle animations: check the phone, look around, stretch; eating fruit
    const still = PL.speed < 0.1 && PL.grounded && !PL.swim && Math.abs(a.x) + Math.abs(a.y) < 0.05;
    PL.idleT = still ? (PL.idleT || 0) + dt : 0;
    if (PL.eatT > 0) { PL.eatT -= dt; p.busyArm = true; p.armR.rotation.x = -2.2 + Math.sin(KS.clock * 9) * 0.15; p.armR.rotation.z = 0.35; if (PL.eatT <= 0) p.busyArm = false; }
    else if (PL.idleT > 6 && PL.punchA == null) {
      const k = Math.floor((PL.idleT - 6) / 5) % 3, t = (PL.idleT - 6) % 5; p.busyArm = true;
      if (!PL.phoneProp) { PL.phoneProp = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.14, 0.012), new THREE.MeshLambertMaterial({ color: 0x111418, emissive: 0x1a2a4a })); PL.phoneProp.position.set(0.02, -0.7, 0.05); PL.phoneProp.rotation.x = 1.2; }
      if (PL.phoneProp.parent !== p.armR) p.armR.add(PL.phoneProp);
      PL.phoneProp.visible = k === 0;
      if (k === 0) { p.armR.rotation.x = -1.15; p.armR.rotation.z = 0.62; p.armL.rotation.x = -0.35; p.torso.rotation.x = 0.1; } // looks at the phone in hand
      else if (k === 1) { p.armR.rotation.x = 0; p.armR.rotation.z = 0; p.torso.rotation.y = Math.sin(t * 1.3) * 0.5; p.torso.rotation.x = 0; } // looks around
      else { const u = Math.sin(Math.min(1, t / 1.5) * Math.PI); p.armL.rotation.x = p.armR.rotation.x = -2.8 * u; p.armL.rotation.z = p.armR.rotation.z = 0; } // stretches
    } else if (p.busyArm && PL.punchA == null && !(PL.eatT > 0)) { p.busyArm = false; p.torso.rotation.x = 0; }
    if (PL.phoneProp && (PL.idleT <= 6 || PL.eatT > 0)) PL.phoneProp.visible = false;
  }
  function onSidewalk(x, z) {
    const G = KS.G; const bx = ((x - G.O) % G.B + G.B) % G.B, bz = ((z - G.O) % G.B + G.B) % G.B;
    const c = Math.floor((x - G.O) / G.B), r = Math.floor((z - G.O) / G.B);
    if (c < 0 || r < 0 || c >= G.N || r >= G.N || KS.blockType(c, r) === 'river') return false;
    const hl = G.roadHalf(c), hr = G.roadHalf(c + 1), ht = G.roadHalf(r), hb = G.roadHalf(r + 1);
    if (!(bx > hl && bx < G.B - hr && bz > ht && bz < G.B - hb)) return false;
    return bx < hl + 4 || bx > G.B - hr - 4 || bz < ht + 4 || bz > G.B - hb - 4;
  }
  PL.onSidewalk = onSidewalk;

  /* ---------- vehicle physics: momentum, grip and sliding, weight, body roll & dive ---------- */
  const MASS = { bicycle: 0.12, bike: 0.25, scooter: 0.22, sport: 0.27, cruiser: 0.3, policebike: 0.27, car: 1.1, taxi: 1.1, ev: 1.4, sedan: 1.3, suv: 1.8, police: 1.8, pickup: 1.8, micro: 1.9, ambulance: 2.1, tempo: 0.9, minibus: 3.5, bus: 6, truck: 7, helicopter: 3.5 };
  KS.massOf = (k) => MASS[k] || 1;
  function driveUpdate(dt) {
    const v = PL.vehicle, t = v.type, a = axis(), up = v.up || { engine: 0, brakes: 0, handling: 0, nitro: 0 }, bike = KS.isBike(v.kind), m1 = KS.massOf(v.kind);
    const hand = I.down('Space') || I.down('KeyJump');
    const eng = 1 + up.engine * 0.12, brk = 1 + up.brakes * 0.25, hdl = 1 + up.handling * 0.12;
    PL.nitroCool = Math.max(0, PL.nitroCool - dt);
    if ((I.hit('KeyB') || I.hit('KeyNitro')) && up.nitro && PL.nitroCool <= 0) { PL.nitro = 3; PL.nitroCool = 18; KS.Game && KS.Game.notify('🔥 Nitro!'); KS.audio && KS.audio.nitro(); }
    PL.nitro = Math.max(0, PL.nitro - dt);
    const boost = PL.nitro > 0 ? 1.45 : 1, wet = KS.Weather.wet > 0.3;
    const top = t.speed * 1.55 * eng * boost * (wet ? 0.9 : 1);
    if (v.vx == null) { v.vx = Math.sin(v.h) * v.speed; v.vz = Math.cos(v.h) * v.speed; v.yaw = 0; v.roll = 0; v.pitch = 0; }
    let fx = Math.sin(v.h), fz = Math.cos(v.h), rx = -fz, rz = fx;
    let vf = v.vx * fx + v.vz * fz, vl = v.vx * rx + v.vz * rz;
    const vf0 = vf;
    // engine and brakes act along the wheels
    if (a.y > 0.1) vf += (vf < 0 ? 16 * brk : t.accel * eng * boost * (1 - Math.max(0, vf) / top * 0.6)) * a.y * dt;
    else if (a.y < -0.1) { vf += (vf > 0.4 ? -16 * brk : -t.accel * 0.6) * -a.y * dt; if (vf0 > 9 && KS.Game) KS.Game.onHardBrake(); }
    else vf -= Math.sign(vf) * Math.min(Math.abs(vf), (1.6 + Math.abs(vf) * 0.22) * dt); // rolling resistance & air drag
    if (hand) vf -= Math.sign(vf) * Math.min(Math.abs(vf), (bike ? 9 : 6) * brk * dt);
    vf = KS.clamp(vf, -6, top);
    // steering builds a yaw rate; momentum lags behind the new heading, tyres pull it back
    const steer = KS.clamp(Math.abs(vf) / 5, 0, 1) * (1 - Math.min(0.5, Math.abs(vf) / (top * 2.4))) * (hand ? 1.4 : 1);
    v.yaw += (-a.x * t.turn * hdl * steer * Math.sign(vf || 1) - v.yaw) * Math.min(1, dt * (bike ? 10 : 7));
    v.h += v.yaw * dt;
    v.vx = fx * vf + rx * vl; v.vz = fz * vf + rz * vl;
    fx = Math.sin(v.h); fz = Math.cos(v.h); rx = -fz; rz = fx;
    vf = v.vx * fx + v.vz * fz; vl = v.vx * rx + v.vz * rz;
    const grip = (bike ? 13 : 8.5) * hdl * (wet ? 0.6 : 1) * (hand && !bike ? 0.16 : 1);
    vl *= Math.exp(-grip * dt);
    v.vx = fx * vf + rx * vl; v.vz = fz * vf + rz * vl;
    // tyre squeal & skid marks when sliding
    if (Math.abs(vl) > 3 && Math.abs(vf) > 5 && !bike) { if (KS.clock - (PL.squealT || 0) > 0.25) { PL.squealT = KS.clock; KS.audio && KS.audio.screech && KS.audio.screech(Math.min(1, Math.abs(vl) / 8)); } KS.Skid && KS.Skid.add(v.x - fx * t.len * 0.35, v.z - fz * t.len * 0.35, v.h, t.wid); }
    // move and collide with buildings, walls, poles (bounce off with some energy loss)
    const nx = v.x + v.vx * dt, nz = v.z + v.vz * dt;
    const c = KS.collide(nx, nz, t.r, v.y, 0.5);
    if (c.hit && c.solid && c.solid.tag === 'trial') KS.Law.trialHit();
    if (c.hit) {
      let nnx = c.x - nx, nnz = c.z - nz; const nl = Math.hypot(nnx, nnz) || 1; nnx /= nl; nnz /= nl;
      const vn = v.vx * nnx + v.vz * nnz;
      if (vn < 0) {
        v.vx -= 1.3 * vn * nnx; v.vz -= 1.3 * vn * nnz; v.vx *= 0.85; v.vz *= 0.85;
        const impact = -vn;
        if (impact > 6) { KS.audio && KS.audio.crash(Math.min(1, impact / 20)); cam.shake = Math.min(0.7, impact / 25); KS.Game && KS.Game.onCrash(impact); }
      }
    }
    v.x = c.x; v.z = c.z;
    // other vehicles: push by weight (a bus barely notices a scooter)
    for (const o of KS.Traffic.list) {
      if (o === v || !o.root.visible) continue;
      const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz), rr = t.r * 0.8 + o.type.r * 0.8;
      if (d < rr && d > 0.01) {
        const nxo = dx / d, nzo = dz / d, m2 = KS.massOf(o.kind) * (o.ai && !o.chase ? 1.5 : 1), sep = rr - d;
        v.x -= nxo * sep * (m2 / (m1 + m2)); v.z -= nzo * sep * (m2 / (m1 + m2));
        const ov = o.ai ? o.speed : 0, ovx = Math.sin(o.h) * ov, ovz = Math.cos(o.h) * ov;
        const rel = (v.vx - ovx) * nxo + (v.vz - ovz) * nzo;
        if (rel > 0) {
          const j = (1.3 * rel) / (1 / m1 + 1 / m2);
          v.vx -= (j / m1) * nxo; v.vz -= (j / m1) * nzo;
          o.knockX = (o.knockX || 0) + (j / m2) * nxo * 0.25; o.knockZ = (o.knockZ || 0) + (j / m2) * nzo * 0.25;
          if (o.ai) { o.speed *= Math.max(0, 1 - (j / m2) * 0.08); o.stunned = Math.min(3, (j / m2) * 0.3); }
          if (rel > 4) {
            KS.audio && KS.audio.crash(Math.min(1, rel / 18)); cam.shake = Math.min(0.6, rel / 25);
            if (o.ai) { KS.say(o.root, KS.pick(['Ke garya?!', 'Aankha chaina?!', 'Oi!!', 'Bistarai!']), 2.4, 'angry'); KS.audio && KS.audio.horn(o.kind, 0.8); }
            if (KS.Game) { KS.Game.onCrash(rel); if ((o.kind === 'police' || o.kind === 'policebike') && rel > 7) KS.Law.raise(2, 'Rammed a police vehicle'); KS.Game.karma(-2, 'Collision'); }
          }
        }
      }
    }
    vf = v.vx * Math.sin(v.h) + v.vz * Math.cos(v.h);
    const hits = KS.Peds.bump(v.x, v.z, t.r + 0.9, v.vx, v.vz, Math.abs(vf));
    if (hits && KS.Game) { KS.Game.karma(-3 * hits, 'Hit pedestrians'); KS.Game.onCrash(10); if (KS.Law.policeNear(v.x, v.z, 60)) KS.Law.offense('reckless'); }
    for (const cow of KS.Animals.cows) {
      const d = Math.hypot(cow.x - v.x, cow.z - v.z);
      if (d < t.r + 1.3) { const k = (t.r + 1.3 - d) / (d || 1); v.x -= (cow.x - v.x) * k; v.z -= (cow.z - v.z) * k; if (Math.abs(vf) > 3) { v.vx *= 0.3; v.vz *= 0.3; KS.say(cow.g, 'MOOO!', 1.6); KS.audio && KS.audio.moo(1); KS.Game && KS.Game.karma(-4, 'Bumped a sacred cow'); } }
    }
    v.vy = (v.vy || 0) - 22 * dt; v.y += v.vy * dt;
    const g = KS.groundAt(v.x, v.z, v.y, 0.5);
    if (v.y <= g) { if (v.vy < -6) cam.shake = 0.3; v.y = g; v.vy = 0; }
    if (v.y < KS.RIVER.water - 0.9) { KS.Game && KS.Game.splash(v); return; }
    // body motion: dive under braking, squat when accelerating, roll in corners (bikes lean in)
    const accel = (vf - vf0) / Math.max(dt, 1e-3), latG = vf * v.yaw;
    v.pitch += (KS.clamp(-accel * (bike ? 0.004 : 0.009), -0.07, 0.07) - v.pitch) * Math.min(1, dt * 6);
    v.roll += ((bike ? KS.clamp(-latG * 0.045, -0.6, 0.6) : KS.clamp(latG * 0.008, -0.09, 0.09)) - v.roll) * Math.min(1, dt * 5);
    const ahead = KS.groundAt(v.x + Math.sin(v.h) * 1.5, v.z + Math.cos(v.h) * 1.5, v.y + 1, 0.6), behind = KS.groundAt(v.x - Math.sin(v.h) * 1.5, v.z - Math.cos(v.h) * 1.5, v.y + 1, 0.6);
    const bump = Math.abs(vf) > 1 ? Math.sin(KS.clock * 23 + v.x) * 0.004 * Math.min(1, Math.abs(vf) / 10) : 0;
    v.root.position.set(v.x, v.y + 0.02 + bump, v.z); v.root.rotation.set(-Math.atan2(ahead - behind, 3) * 0.8 + v.pitch, v.h, v.roll, 'YXZ');
    v.speed = vf;
    if (bike) {
      if (v.kind === 'bicycle') { PL.pedal = (PL.pedal || 0) + vf * dt * 2.2; PL.person.legL.rotation.x = -1.05 + Math.sin(PL.pedal) * 0.55; PL.person.legR.rotation.x = -1.05 - Math.sin(PL.pedal) * 0.55; }
      else PL.person.legL.rotation.x = PL.person.legR.rotation.x = -1.3;
    }
    PL.x = v.x; PL.z = v.z; PL.y = v.y; PL.h = v.h; PL.speed = vf;
    PL.throttle = a.y > 0.1 ? a.y : 0;
  }

  /* ---------- helicopter: fly the Sadbhav Air machine parked at Dharahara ----------
     W/S: fly forward and back · A/D: turn · hold Space: climb · hold C: come down.
     Buildings only matter when you are low; above them you fly straight over. */
  function heliUpdate(dt) {
    const v = PL.vehicle, t = v.type, a = axis();
    if (v.alt == null) { v.alt = 0; v.vy = 0; v.vx = 0; v.vz = 0; }
    const up = I.down('Space') || I.down('KeyJump'), down = I.down('KeyC');
    const wantVy = up ? 5 : down ? -5 : 0;
    v.vy += (wantVy - v.vy) * Math.min(1, dt * 2.5);
    v.alt = Math.max(0, Math.min(200, v.alt + v.vy * dt));
    if (v.alt === 0 && v.vy < 0) v.vy = 0;
    const fx = Math.sin(v.h), fz = Math.cos(v.h);
    v.vx += fx * a.y * 9 * dt; v.vz += fz * a.y * 9 * dt;
    v.h += -a.x * 1.1 * dt;
    const drag = Math.exp(-0.6 * dt); v.vx *= drag; v.vz *= drag;
    const sp = Math.hypot(v.vx, v.vz), top = 26;
    if (sp > top) { v.vx *= top / sp; v.vz *= top / sp; }
    let nx = v.x + v.vx * dt, nz = v.z + v.vz * dt;
    if (v.alt < 3) { const c = KS.collide(nx, nz, t.r, v.y, 0.5); nx = c.x; nz = c.z; if (c.hit) { v.vx *= 0.5; v.vz *= 0.5; } }
    v.x = nx; v.z = nz;
    v.y = KS.groundAt(v.x, v.z, v.y, 0.5) + v.alt;
    const fwd = v.vx * fx + v.vz * fz;
    v.pitch = v.pitch || 0; v.roll = v.roll || 0;
    v.pitch += (KS.clamp(-fwd * 0.006, -0.12, 0.08) - v.pitch) * Math.min(1, dt * 4);
    v.roll += (KS.clamp(a.x * 0.12, -0.15, 0.15) - v.roll) * Math.min(1, dt * 4);
    v.root.position.set(v.x, v.y + 0.02, v.z);
    v.root.rotation.set(v.pitch, v.h, v.roll, 'YXZ');
    v.speed = Math.hypot(v.vx, v.vz);
    PL.x = v.x; PL.z = v.z; PL.y = v.y; PL.h = v.h; PL.speed = v.speed;
    KS.audio && KS.audio.heli && KS.audio.heli(1);
  }

  PL.update = (dt) => {
    if (PL.mode === 'plane' || PL.mode === 'fall' || PL.mode === 'chute') { KS.Drop.update(dt); PL.len = 0.5; PL.wid = 0.6; PL.torch.intensity = 0; PL.headlight.intensity = 0; return; }
    if (PL.mode === 'dead') { PL.speed = 0; return; }
    if (PL.mode === 'heli') { PL.len = 0.5; PL.wid = 0.6; PL.speed = 0; return; } // flown by Sadbhav Air (places.js)
    if (PL.mode === 'ride') { KS.Net && KS.Net.rideUpdate(dt); return; } // a passenger in a friend's vehicle
    if (I.hit('KeyE') || I.hit('KeyEnter')) {
      if (PL.mode === 'boat') PL.leaveBoat();
      else if (PL.mode === 'drive' && PL.vehicle && PL.vehicle.kind === 'helicopter' && (PL.vehicle.alt || 0) > 1) KS.Game && KS.Game.notify('🚁 Land first — hold <b>C</b> to come down, then press <b>E</b>.', 'bad');
      else if (PL.mode === 'drive') PL.exit();
      else if (!(KS.Net && KS.Net.tryBoard && KS.Net.tryBoard())) { const v = KS.Traffic.nearest(PL.x, PL.z, 3.6); if (v) PL.enter(v); else KS.Game && KS.Game.interact(); }
    }
    if (PL.mode === 'ride') return; // just got into a friend's vehicle (net.js moves you from the next frame)
    if (PL.mode === 'foot') footUpdate(dt); else if (PL.mode === 'boat') boatUpdate(dt); else if (PL.vehicle) { if (PL.vehicle.kind === 'helicopter') heliUpdate(dt); else driveUpdate(dt); }
    PL.health = Math.min(100, PL.health + dt * (KS.Battle && KS.Battle.on ? 0.3 : 2.5)); // in Battle mode medkits heal, not time
    for (const d of exDrivers) {
      if (d.t <= 0) continue; d.t -= dt;
      d.x += Math.sin(d.h) * 1.3 * dt; d.z += Math.cos(d.h) * 1.3 * dt;
      d.p.root.position.set(d.x, KS.groundAt(d.x, d.z, 50, 60) + 0.06, d.z); d.p.root.rotation.y = d.h; KS.animWalk(d.p, dt, 1.3);
      if (d.t <= 0) d.p.root.visible = false;
    }
    PL.len = PL.vehicle ? PL.vehicle.type.len : 0.5; PL.wid = PL.vehicle ? PL.vehicle.type.wid : 0.6;
    if (I.hit('KeyL')) { PL.torchOff = !PL.torchOff; KS.Game && KS.Game.notify(PL.torchOff ? '🔦 Torch off' : '🔦 Torch on'); }
    const dark = KS.night > 0.4, fx = Math.sin(PL.h), fz = Math.cos(PL.h), v = PL.vehicle;
    PL.torch.intensity = !v && dark && !PL.torchOff ? 2.4 : 0;
    if (PL.torch.intensity) { PL.torch.position.set(PL.x + fx * 0.3, PL.y + 1.35, PL.z + fz * 0.3); PL.torch.target.position.set(PL.x + fx * 9, PL.y, PL.z + fz * 9); }
    PL.headlight.intensity = v && dark ? (KS.isBike(v.kind) ? 2.2 : 3) : 0;
    if (PL.headlight.intensity) { const L = v.type.len / 2; PL.headlight.position.set(v.x + fx * L, v.y + 0.9, v.z + fz * L); PL.headlight.target.position.set(v.x + fx * (L + 22), v.y, v.z + fz * (L + 22)); }
  };

  /* ================= camera ================= */
  const tgt = new T.Vector3(), want = new T.Vector3(), probe = [];
  function clearPath(dx, dy, dz, maxD) {
    for (let d = 0.6; d <= maxD; d += 0.6) {
      const x = tgt.x + dx * d, y = tgt.y + dy * d, z = tgt.z + dz * d;
      KS.solidsNear(x, z, 0.2, probe);
      for (const s of probe) if (s.top > y && s.base < y && (s.t === 0 ? x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 : (x - s.cx) ** 2 + (z - s.cz) ** 2 < s.r * s.r)) return Math.max(0.4, d - 0.6);
    }
    return maxD;
  }
  PL.setCam = (m) => { cam.mode = (m + KS.CAMS.length) % KS.CAMS.length; KS.Game && KS.Game.notify('🎥 Camera: <b>' + KS.CAMS[cam.mode] + '</b>' + (cam.mode === 2 && !PL.vehicle ? ' — first-person, so your character is hidden. Press <b>V</b> for a third-person view.' : '')); };
  PL.updateCamera = (camera, dt) => {
    if (I.hit('KeyV') || I.hit('KeyCam')) PL.setCam(cam.mode + 1);
    if (I.zoom) cam.want = KS.clamp(cam.want + I.zoom * 1.2, 2.5, 30);
    const st = KS.Settings ? KS.Settings.data() : { sens: 1 }, sens = st.sens || 1;
    cam.yaw -= I.look.dx * 0.0042 * sens; cam.pitch = KS.clamp(cam.pitch + I.look.dy * 0.0035 * sens * (st.invertY ? -1 : 1), -0.35, 1.35);
    const v = PL.vehicle, bike = v && KS.isBike(v.kind);
    // driving: the camera settles in behind the vehicle only when you have not looked around for a while
    if (v && KS.clock - I.lastLook > 2.5 && Math.abs(v.speed) > 2 && cam.mode !== 5) cam.yaw = KS.angLerp(cam.yaw, v.speed >= 0 ? v.h : v.h + Math.PI, Math.min(1, dt * 1.3));
    const h = v ? (v.type.len > 6 ? 3.2 : bike ? 1.7 : 1.9) : 1.6;
    tgt.set(PL.x, PL.y + h, PL.z);
    // over-the-right-shoulder framing on foot, centred in vehicles
    cam.side += ((v || cam.mode !== 0 ? 0 : 0.6 + (cam.aim || 0) * 0.25) - cam.side) * Math.min(1, dt * 6);
    if (cam.side > 0.01) { tgt.x += -Math.cos(cam.yaw) * cam.side; tgt.z += Math.sin(cam.yaw) * cam.side; }
    PL.person.root.visible = !(cam.mode === 2 && !v) && !(v && !bike);
    const mode = cam.mode, heading = v ? v.h : PL.h, fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), cp = Math.cos(cam.pitch);
    if (mode === 2 || mode === 3) { // first person / hood or over-the-shoulder
      let ex, ey, ez, lx, lz;
      if (mode === 2) {
        const eyeY = v ? (bike ? 1.75 : v.type.len > 6 ? 2.6 : 1.3) : 1.66;
        ex = PL.x + fx * (v ? (bike ? 0.1 : 0.4) : 0.15); ey = PL.y + eyeY; ez = PL.z + fz * (v ? 0.4 : 0.15); lx = fx; lz = fz;
      } else if (v) { const hx = Math.sin(heading), hz = Math.cos(heading); ex = PL.x + hx * (v.type.len * 0.42); ey = PL.y + (bike ? 1.3 : v.type.len > 6 ? 2.9 : 1.35); ez = PL.z + hz * (v.type.len * 0.42); lx = Math.sin(cam.yaw); lz = Math.cos(cam.yaw); }
      else { const rx = -fz, rz = fx; ex = PL.x - fx * 1.6 + rx * 0.55; ey = PL.y + 1.85; ez = PL.z - fz * 1.6 + rz * 0.55; lx = fx; lz = fz; }
      camera.position.set(ex, ey, ez);
      camera.lookAt(ex + lx * cp * 10, ey - Math.sin(cam.pitch - 0.2) * 10, ez + lz * cp * 10);
      return;
    }
    let dx, dy, dz, dist;
    if (mode === 4) { // drone: high and looking down
      dist = 38 + cam.want * 2; dx = -fx * 0.35; dy = 1; dz = -fz * 0.35; const m = Math.hypot(dx, dy, dz); dx /= m; dy /= m; dz /= m;
    } else if (mode === 5) { // cinematic slow orbit
      cam.orbit += dt * 0.25; const a = heading + cam.orbit; dist = 12 + Math.sin(cam.orbit * 0.7) * 4;
      dx = Math.sin(a); dy = 0.25 + Math.sin(cam.orbit * 0.5) * 0.12; dz = Math.cos(a); const m = Math.hypot(dx, dy, dz); dx /= m; dy /= m; dz /= m;
    } else if (mode === 6) { // side tracking shot
      dist = v ? v.type.len * 1.8 + 5 : 6; dx = Math.cos(heading); dy = 0.18; dz = -Math.sin(heading); const m = Math.hypot(dx, dy, dz); dx /= m; dy /= m; dz /= m;
    } else {
      cam.dist += ((mode === 1 ? cam.want * 2.2 : cam.want) * (1 - (cam.aim || 0) * 0.4) - cam.dist) * Math.min(1, dt * 6);
      dist = cam.dist; dx = -fx * cp; dy = Math.sin(cam.pitch); dz = -fz * cp;
    }
    // walls between you and the camera pull it in quickly; it eases back out slowly (no jumping)
    const clear = clearPath(dx, dy, dz, dist);
    cam.cur = cam.cur == null ? clear : clear < cam.cur ? KS.lerp(cam.cur, clear, Math.min(1, dt * 18)) : KS.lerp(cam.cur, clear, Math.min(1, dt * 2.5));
    dist = Math.min(dist, cam.cur);
    want.set(tgt.x + dx * dist, tgt.y + dy * dist, tgt.z + dz * dist);
    const gy = KS.heightAt(want.x, want.z) + 0.6; if (want.y < gy) want.y = gy;
    camera.position.lerp(want, Math.min(1, dt * (mode >= 4 ? 4 : v ? 10 : 14)));
    if (cam.shake > 0) { cam.shake -= dt; camera.position.x += KS.r(-0.3, 0.3) * cam.shake; camera.position.y += KS.r(-0.3, 0.3) * cam.shake; }
    camera.lookAt(tgt);
  };
})();
