/* Kathmandu Streets — input (keyboard, mouse, touch), player on foot and driving, third/first-person camera. */
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
      if (e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT')) return;
      if (PREVENT.includes(e.code)) e.preventDefault();
      if (!e.repeat) I.pressed.add(e.code);
      I.keys[e.code] = true;
    });
    addEventListener('keyup', (e) => { I.keys[e.code] = false; });
    addEventListener('blur', () => { I.keys = {}; });
    let drag = false, lx = 0, ly = 0;
    canvas.addEventListener('mousedown', (e) => {
      drag = true; lx = e.clientX; ly = e.clientY;
      if (KS.state === 'play' && !I.locked && canvas.requestPointerLock) { try { const p = canvas.requestPointerLock(); if (p && p.catch) p.catch(() => {}); } catch (err) { /* pointer lock unavailable */ } }
    });
    addEventListener('mouseup', () => (drag = false));
    addEventListener('mousemove', (e) => {
      if (I.locked) { I.look.dx += e.movementX; I.look.dy += e.movementY; I.lastLook = KS.clock; }
      else if (drag) { I.look.dx += e.clientX - lx; I.look.dy += e.clientY - ly; lx = e.clientX; ly = e.clientY; I.lastLook = KS.clock; }
    });
    document.addEventListener('pointerlockchange', () => { I.locked = document.pointerLockElement === canvas; });
    canvas.addEventListener('wheel', (e) => { I.zoom += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
    // touch: left joystick, right side look, buttons
    const joy = document.getElementById('joy'), knob = document.getElementById('joyKnob');
    let joyId = null, lookId = null, jx = 0, jy = 0, tlx = 0, tly = 0;
    const joyR = () => joy.getBoundingClientRect();
    if (joy) {
      joy.addEventListener('touchstart', (e) => { const t = e.changedTouches[0]; joyId = t.identifier; const r = joyR(); jx = r.left + r.width / 2; jy = r.top + r.height / 2; e.preventDefault(); moveJoy(t); }, { passive: false });
      const moveJoy = (t) => {
        let dx = t.clientX - jx, dy = t.clientY - jy; const m = Math.hypot(dx, dy), R = 46;
        if (m > R) { dx *= R / m; dy *= R / m; }
        I.joy.x = dx / R; I.joy.y = -dy / R; knob.style.transform = `translate(${dx}px, ${dy}px)`;
      };
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

  /* ================= player ================= */
  const PL = (KS.Player = { x: -135, z: -261, y: 0.22, vy: 0, h: 0, speed: 0, mode: 'foot', vehicle: null, swim: false, len: 0.5, wid: 0.6 });
  const cam = (KS.Cam = { yaw: 0, pitch: 0.28, dist: 7, want: 7, mode: 0, shake: 0 });
  const exDrivers = [];
  PL.init = (scene) => {
    PL.person = KS.makePerson('player'); scene.add(PL.person.root);
    PL.scene = scene;
    for (let i = 0; i < 3; i++) { const p = KS.makePerson(KS.pick(['man', 'woman', 'man'])); p.root.visible = false; scene.add(p.root); exDrivers.push({ p, t: 0, x: 0, z: 0, h: 0 }); }
  };
  function ejectDriver(v) {
    const d = exDrivers.find((e) => e.t <= 0) || exDrivers[0];
    const sx = Math.cos(v.h), sz = -Math.sin(v.h);
    d.x = v.x + sx * (v.type.wid / 2 + 0.8); d.z = v.z + sz * (v.type.wid / 2 + 0.8); d.h = Math.atan2(sx, sz); d.t = 14;
    d.p.root.visible = true; d.p.root.position.set(d.x, 0.06, d.z);
    KS.say(d.p.root, KS.pick(['Mero gaadi!! 😡', 'Oi! Chor!', 'Police! Police!', 'Hey! That\'s mine!']), 3, 'angry');
    KS.Game && KS.Game.karma(-3, 'Took a vehicle');
  }
  PL.enter = (v) => {
    if (v.ai && v.speed > 9) return false;
    if (v.ai) ejectDriver(v);
    v.ai = false; v.parked = false; PL.vehicle = v; PL.mode = 'drive'; v.speed = Math.min(v.speed, 3);
    if (v.rider) v.rider.visible = false;
    const bike = v.type.seats === 'bike';
    if (bike) { v.root.add(PL.person.root); PL.person.root.position.set(0, 0.25, -0.3); PL.person.root.rotation.set(0, 0, 0); KS.animSit(PL.person); PL.person.armL.rotation.x = PL.person.armR.rotation.x = -1.2; }
    else PL.person.root.visible = false;
    cam.want = v.type.len > 6 ? 15 : bike ? 6.5 : 9;
    KS.Game && KS.Game.onEnter(v);
    return true;
  };
  PL.exit = () => {
    const v = PL.vehicle; if (!v) return;
    if (Math.abs(v.speed) > 6) return;
    const sx = Math.cos(v.h), sz = -Math.sin(v.h);
    let x = v.x + sx * (v.type.wid / 2 + 0.9), z = v.z + sz * (v.type.wid / 2 + 0.9);
    const c = KS.collide(x, z, 0.4, v.y, 1); x = c.x; z = c.z;
    if (PL.person.root.parent !== PL.scene) PL.scene.add(PL.person.root);
    PL.person.root.visible = true; PL.person.root.rotation.set(0, 0, 0);
    PL.x = x; PL.z = z; PL.y = Math.max(v.y, KS.groundAt(x, z, v.y + 1, 1.2)); PL.h = v.h; PL.vy = 0;
    v.parked = true; v.speed = 0; PL.vehicle = null; PL.mode = 'foot'; cam.want = 7;
    KS.Game && KS.Game.onExit(v);
  };

  const near = [];
  function footUpdate(dt) {
    const a = axis(), run = I.down('ShiftLeft') || I.down('ShiftRight') || I.down('KeyRun');
    const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), rx = -fz, rz = fx;
    let mx = fx * a.y + rx * a.x, mz = fz * a.y + rz * a.x; const m = Math.hypot(mx, mz);
    const top = PL.swim ? 1.6 : run ? 8.2 : 4.2;
    let want = 0;
    if (m > 0.05) { mx /= Math.max(1, m); mz /= Math.max(1, m); want = top * Math.min(1, m); PL.h = KS.angLerp(PL.h, Math.atan2(mx, mz), Math.min(1, dt * 10)); }
    PL.speed += KS.clamp(want - PL.speed, -30 * dt, 18 * dt);
    const dirx = Math.sin(PL.h), dirz = Math.cos(PL.h);
    let nx = PL.x + dirx * PL.speed * dt, nz = PL.z + dirz * PL.speed * dt;
    const c = KS.collide(nx, nz, 0.38, PL.y, 1.05); nx = c.x; nz = c.z;
    PL.x = nx; PL.z = nz;
    // jump & gravity
    if ((I.hit('Space') || I.hit('KeyJump')) && PL.grounded && !PL.swim) { PL.vy = 6.4; PL.grounded = false; }
    PL.vy -= 20 * dt; PL.y += PL.vy * dt;
    let g = KS.groundAt(PL.x, PL.z, PL.y, 1.05);
    PL.swim = g < KS.RIVER.water - 0.6;
    if (PL.swim) g = KS.RIVER.water - 1.25;
    if (PL.y <= g) { PL.y = g; PL.vy = 0; PL.grounded = true; } else PL.grounded = PL.y - g < 0.05;
    // sidewalks are kerbs 22 cm high
    let vy = PL.y;
    if (vy < 0.3 && vy > -0.2) { const b = G2(PL.x, PL.z); if (b) vy = Math.max(vy, 0.22); }
    const pr = PL.person.root; pr.position.set(PL.x, vy, PL.z); pr.rotation.y = PL.h;
    if (PL.swim) { PL.person.armL.rotation.x = Math.sin(KS.clock * 5) * 2; PL.person.armR.rotation.x = -Math.sin(KS.clock * 5) * 2; PL.person.legL.rotation.x = PL.person.legR.rotation.x = 0.3; }
    else KS.animWalk(PL.person, dt, PL.grounded ? PL.speed : 0.01);
    if (!PL.grounded && !PL.swim) { PL.person.legL.rotation.x = -0.5; PL.person.legR.rotation.x = 0.4; }
    if (PL.speed > 3) KS.Peds.bump(PL.x, PL.z, 0.9, dirx * PL.speed, dirz * PL.speed, PL.speed * 0.5);
  }
  // is the point on a raised sidewalk strip?
  function G2(x, z) {
    const G = KS.G; const bx = ((x - G.O) % G.B + G.B) % G.B, bz = ((z - G.O) % G.B + G.B) % G.B;
    const c = Math.floor((x - G.O) / G.B), r = Math.floor((z - G.O) / G.B);
    if (c < 0 || r < 0 || c >= G.N || r >= G.N || KS.blockType(c, r) === 'river') return false;
    const hl = G.roadHalf(c), hr = G.roadHalf(c + 1), ht = G.roadHalf(r), hb = G.roadHalf(r + 1);
    const inX = bx > hl && bx < G.B - hr, inZ = bz > ht && bz < G.B - hb;
    if (!inX || !inZ) return false;
    return bx < hl + 4 || bx > G.B - hr - 4 || bz < ht + 4 || bz > G.B - hb - 4;
  }
  PL.onSidewalk = G2;

  function driveUpdate(dt) {
    const v = PL.vehicle, t = v.type, a = axis();
    const hand = I.down('Space') || I.down('KeyJump');
    const top = t.speed * 1.55 * (KS.Weather.wet > 0.3 ? 0.9 : 1);
    if (a.y > 0.1) v.speed += (v.speed < 0 ? 16 : t.accel * (1 - Math.max(0, v.speed) / top * 0.6)) * a.y * dt;
    else if (a.y < -0.1) v.speed += (v.speed > 0.4 ? -16 : -t.accel * 0.6) * -a.y * dt;
    else v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), (2.2 + Math.abs(v.speed) * 0.25) * dt);
    if (hand) v.speed -= Math.sign(v.speed) * Math.min(Math.abs(v.speed), 12 * dt);
    v.speed = KS.clamp(v.speed, -6, top);
    const grip = KS.clamp(Math.abs(v.speed) / 5, 0, 1) * (hand ? 1.6 : 1) * (1 - Math.min(0.5, Math.abs(v.speed) / (top * 2.4)));
    v.h += -a.x * t.turn * grip * Math.sign(v.speed || 1) * dt;
    const fx = Math.sin(v.h), fz = Math.cos(v.h);
    let nx = v.x + fx * v.speed * dt, nz = v.z + fz * v.speed * dt;
    const c = KS.collide(nx, nz, t.r, v.y, 0.5);
    if (c.hit && Math.abs(v.speed) > 2) { if (Math.abs(v.speed) > 7) { KS.audio && KS.audio.crash(Math.min(1, Math.abs(v.speed) / 20)); cam.shake = 0.5; } v.speed *= -0.25; }
    v.x = c.x; v.z = c.z;
    // other vehicles
    for (const o of KS.Traffic.list) {
      if (o === v || !o.root.visible) continue;
      const dx = o.x - v.x, dz = o.z - v.z, d = Math.hypot(dx, dz), rr = t.r * 0.8 + o.type.r * 0.8;
      if (d < rr && d > 0.01) {
        const push = (rr - d) / d; v.x -= dx * push * 0.6; v.z -= dz * push * 0.6; o.x += dx * push * 0.4; o.z += dz * push * 0.4;
        if (Math.abs(v.speed) > 4) {
          KS.audio && KS.audio.crash(Math.min(1, Math.abs(v.speed) / 18)); cam.shake = 0.35;
          if (o.ai) { o.speed = 0; o.stuck = 0; KS.say(o.root, KS.pick(['Ke garya?!', 'Aankha chaina?!', 'Oi!!', 'Bistarai!']), 2.4, 'angry'); KS.audio && KS.audio.horn(o.kind, 0.8); }
          if (o.kind === 'police' && KS.Game) KS.Game.fine(1500, 'You hit a police jeep');
          KS.Game && KS.Game.karma(-2, 'Collision');
        }
        v.speed *= 0.6;
      }
    }
    // people & cows
    const hits = KS.Peds.bump(v.x, v.z, t.r + 0.9, fx * v.speed, fz * v.speed, Math.abs(v.speed));
    if (hits && KS.Game) { KS.Game.karma(-5 * hits, 'Scared pedestrians'); if (KS.Game.policeNear(v.x, v.z, 70)) KS.Game.fine(500, 'Reckless driving near traffic police'); }
    for (const cow of KS.Animals.cows) {
      const d = Math.hypot(cow.x - v.x, cow.z - v.z);
      if (d < t.r + 1.3) { const k = (t.r + 1.3 - d) / (d || 1); v.x -= (cow.x - v.x) * k; v.z -= (cow.z - v.z) * k; if (Math.abs(v.speed) > 3) { v.speed *= 0.3; KS.say(cow.g, 'MOOO!', 1.6); KS.audio && KS.audio.moo(); KS.Game && KS.Game.karma(-4, 'Bumped a sacred cow'); } }
    }
    // ground following, bridges, falling into the Bagmati
    v.vy = (v.vy || 0) - 22 * dt; v.y += v.vy * dt;
    const g = KS.groundAt(v.x, v.z, v.y, 0.5);
    if (v.y <= g) { v.y = g; v.vy = 0; }
    if (v.y < KS.RIVER.water - 0.9) { KS.Game && KS.Game.splash(v); return; }
    const ahead = KS.groundAt(v.x + fx * 1.5, v.z + fz * 1.5, v.y + 1, 0.6), behind = KS.groundAt(v.x - fx * 1.5, v.z - fz * 1.5, v.y + 1, 0.6);
    v.root.position.set(v.x, v.y + 0.02, v.z); v.root.rotation.set(-Math.atan2(ahead - behind, 3) * 0.8, v.h, 0, 'YXZ');
    if (t.seats === 'bike') { v.root.rotation.z = a.x * 0.32 * Math.min(1, Math.abs(v.speed) / 8); PL.person.legL.rotation.x = PL.person.legR.rotation.x = -1.3; }
    PL.x = v.x; PL.z = v.z; PL.y = v.y; PL.h = v.h; PL.speed = v.speed;
  }

  PL.update = (dt) => {
    if (I.hit('KeyE') || I.hit('KeyF') || I.hit('KeyEnter')) {
      if (PL.mode === 'drive') PL.exit();
      else {
        const v = KS.Traffic.nearest(PL.x, PL.z, 3.6);
        if (v) PL.enter(v); else KS.Game && KS.Game.interact();
      }
    }
    if (PL.mode === 'foot') footUpdate(dt); else driveUpdate(dt);
    // ex-drivers walk away grumbling
    for (const d of exDrivers) {
      if (d.t <= 0) continue; d.t -= dt;
      d.x += Math.sin(d.h) * 1.3 * dt; d.z += Math.cos(d.h) * 1.3 * dt;
      d.p.root.position.set(d.x, 0.06, d.z); d.p.root.rotation.y = d.h; KS.animWalk(d.p, dt, 1.3);
      if (d.t <= 0) d.p.root.visible = false;
    }
    PL.len = PL.vehicle ? PL.vehicle.type.len : 0.5; PL.wid = PL.vehicle ? PL.vehicle.type.wid : 0.6;
  };

  /* ================= camera ================= */
  const tgt = new T.Vector3(), want = new T.Vector3(), probe = [];
  PL.updateCamera = (camera, dt) => {
    if (I.hit('KeyV') || I.hit('KeyCam')) { cam.mode = (cam.mode + 1) % 3; }
    if (I.zoom) cam.want = KS.clamp(cam.want + I.zoom * 1.2, 3, 30);
    cam.yaw -= I.look.dx * 0.0042; cam.pitch = KS.clamp(cam.pitch + I.look.dy * 0.0035, -0.35, 1.25);
    const v = PL.vehicle;
    if (v && KS.clock - I.lastLook > 1.4 && Math.abs(v.speed) > 1) cam.yaw = KS.angLerp(cam.yaw, v.speed >= 0 ? v.h : v.h + Math.PI, Math.min(1, dt * 2.4));
    const h = v ? (v.type.len > 6 ? 3.2 : v.type.seats === 'bike' ? 1.7 : 1.9) : 1.55;
    tgt.set(PL.x, PL.y + h, PL.z);
    if (cam.mode === 2) { // first person
      const fx = Math.sin(cam.yaw), fz = Math.cos(cam.yaw), cp = Math.cos(cam.pitch);
      const eyeY = v ? (v.type.seats === 'bike' ? 1.75 : v.type.len > 6 ? 2.6 : 1.3) : 1.66;
      camera.position.set(PL.x + fx * (v ? (v.type.seats === 'bike' ? 0.1 : 0.4) : 0.15), PL.y + eyeY, PL.z + fz * (v ? 0.4 : 0.15));
      camera.lookAt(camera.position.x + fx * cp * 10, camera.position.y - Math.sin(cam.pitch) * 10 + 1.2, camera.position.z + fz * cp * 10);
      if (!v) PL.person.root.visible = false;
      return;
    }
    if (!v) PL.person.root.visible = true;
    cam.dist += ((cam.mode === 1 ? cam.want * 2.2 : cam.want) - cam.dist) * Math.min(1, dt * 3);
    const cp = Math.cos(cam.pitch), dx = -Math.sin(cam.yaw) * cp, dy = Math.sin(cam.pitch), dz = -Math.cos(cam.yaw) * cp;
    // pull the camera in when a building is behind
    let dist = cam.dist;
    for (let d = 0.6; d <= cam.dist; d += 0.6) {
      const x = tgt.x + dx * d, y = tgt.y + dy * d, z = tgt.z + dz * d;
      KS.solidsNear(x, z, 0.2, probe);
      let blocked = false;
      for (const s of probe) { if (s.top > y && s.base < y && (s.t === 0 ? x > s.x0 && x < s.x1 && z > s.z0 && z < s.z1 : (x - s.cx) ** 2 + (z - s.cz) ** 2 < s.r * s.r)) { blocked = true; break; } }
      if (blocked) { dist = Math.max(0.4, d - 0.6); break; }
    }
    want.set(tgt.x + dx * dist, tgt.y + dy * dist, tgt.z + dz * dist);
    const gy = KS.heightAt(want.x, want.z) + 0.6; if (want.y < gy) want.y = gy;
    camera.position.lerp(want, Math.min(1, dt * (v ? 10 : 14)));
    if (cam.shake > 0) { cam.shake -= dt; camera.position.x += KS.r(-0.3, 0.3) * cam.shake; camera.position.y += KS.r(-0.3, 0.3) * cam.shake; }
    camera.lookAt(tgt);
  };
})();
