/* Kathmandu Streets — damage: everything has health and can be broken.
   Every prop (bench, chair, plant, computer, bed), every pedestrian, and
   every pushable rock has health. Punches, snowballs and rolling rocks
   damage them; at 0 health a prop topples over broken and a pedestrian
   goes down and stays down. Rocks on the mountain can be pushed: walk into
   one and it rolls away downhill, and anything it hits takes damage. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const D = (KS.Damage = { props: [], rocks: [] });
  const tmpV = new T.Vector3();

  /* ---------------- small particle bursts ---------------- */
  const FX = (KS.FX = {});
  const bursts = [];
  FX.burst = (x, y, z, color, n, size, speed) => {
    if (!KS.scene) return;
    const g = new T.BufferGeometry(), pos = new Float32Array(n * 3), vel = [];
    for (let i = 0; i < n; i++) {
      pos[i * 3] = x; pos[i * 3 + 1] = y; pos[i * 3 + 2] = z;
      const a = KS.r(0, Math.PI * 2), up = KS.r(0.5, 1);
      vel.push([Math.cos(a) * speed * KS.r(0.3, 1), up * speed, Math.sin(a) * speed * KS.r(0.3, 1)]);
    }
    g.setAttribute('position', new T.BufferAttribute(pos, 3));
    const pts = new T.Points(g, new T.PointsMaterial({ color, size, transparent: true, opacity: 0.95 }));
    pts.frustumCulled = false; KS.scene.add(pts);
    bursts.push({ pts, vel, t: 0, life: 0.9 });
  };
  FX.snowBurst = (x, y, z) => FX.burst(x, y, z, 0xffffff, 26, 0.35, 3.2);
  FX.debris = (x, y, z, color) => FX.burst(x, y, z, color || 0x8a7a5a, 22, 0.3, 4);
  FX.update = (dt) => {
    for (let i = bursts.length - 1; i >= 0; i--) {
      const b = bursts[i]; b.t += dt;
      const pos = b.pts.geometry.attributes.position;
      for (let j = 0; j < pos.count; j++) {
        const v = b.vel[j];
        v[1] -= 9 * dt;
        pos.setXYZ(j, pos.getX(j) + v[0] * dt, Math.max(KS.heightAt(pos.getX(j), pos.getZ(j)) + 0.05, pos.getY(j) + v[1] * dt), pos.getZ(j) + v[2] * dt);
      }
      pos.needsUpdate = true;
      b.pts.material.opacity = Math.max(0, 0.95 * (1 - b.t / b.life));
      if (b.t >= b.life) { KS.scene.remove(b.pts); b.pts.geometry.dispose(); b.pts.material.dispose(); bursts.splice(i, 1); }
    }
  };

  /* ---------------- props: register, hit, break ---------------- */
  const PROP_HP = { bench: 60, chair: 40, plant: 30, computer: 40, bed: 80, sign: 50 };
  D.registerProp = (mesh, x, z, name, hp) => {
    if (!mesh) return null;
    const p = { mesh, x, z, r: 0.9, hp: hp || PROP_HP[name] || 40, maxHp: hp || PROP_HP[name] || 40, name, broken: false, y: KS.heightAt(x, z) };
    D.props.push(p); return p;
  };
  D.hitProp = (p, dmg) => {
    if (!p || p.broken) return false;
    p.hp -= dmg;
    if (p.hp > 0) { // a wobble so you can see it took a hit
      p.mesh.rotation.z = (p.mesh.rotation.z || 0) + (KS.chance(0.5) ? 0.12 : -0.12);
      KS.audio && KS.audio.thump && KS.audio.thump();
      return true;
    }
    p.broken = true;
    // topple over: fall on its side and stay broken
    p.mesh.rotation.set(0, p.mesh.rotation.y || 0, Math.PI / 2 * (KS.chance(0.5) ? 1 : -1));
    p.mesh.position.y = Math.max(0.15, p.y + 0.15);
    FX.debris(p.x, p.y + 0.8, p.z, 0x8a7a5a);
    KS.audio && KS.audio.crash && KS.audio.crash(0.5);
    KS.Game && KS.Game.notify(`💥 The ${p.name} broke!`, 'bad');
    return true;
  };
  /** damage the nearest unbroken prop to a point (punch, snowball, rock) */
  D.hitPropAt = (x, z, dmg, range) => {
    let best = null, bd = range || 1.6;
    for (const p of D.props) {
      if (p.broken) continue;
      const d = Math.hypot(p.x - x, p.z - z);
      if (d < bd) { bd = d; best = p; }
    }
    return best ? D.hitProp(best, dmg) : false;
  };
  /** damage a pedestrian: at 0 health they go down and stay down */
  D.hitPed = (ped, dmg, fromX, fromZ) => {
    if (!ped || ped.dead) return false;
    ped.hp = (ped.hp == null ? 100 : ped.hp) - dmg;
    if (ped.hp > 0) { KS.Peds.knock(ped, fromX, fromZ, false); return true; }
    ped.dead = true; ped.down = 1e9; ped.fight = 0; ped.flee = 0;
    ped.p.inner.rotation.x = -1.5; ped.p.inner.position.y = 0.12;
    KS.say(ped.p.root, '…', 2, 'angry');
    KS.audio && KS.audio.punch && KS.audio.punch();
    KS.Game && KS.Game.notify('💀 That pedestrian is down!', 'bad');
    return true;
  };

  /* ---------------- pushable rocks on the mountain ---------------- */
  D.initRocks = (scene) => {
    if (D._rocksDone) return; D._rocksDone = true;
    const P = KS.SNOWPEAK;
    // boulders scattered along the snow road and the ski run, where you can reach them
    const spots = [];
    for (let k = 0; k < 14; k++) {
      const a = KS.r(0, Math.PI * 2), r = KS.r(60, 320);
      spots.push([P.x + Math.cos(a) * r, P.z + Math.sin(a) * r]);
    }
    // a few right beside the snow road so you meet them on the way up
    const road = KS.MOUNTAIN_PATHS.find((p) => p.id === 'snowroad');
    for (let k = 1; k < road.pts.length - 1; k++) {
      const [x, z] = road.pts[k];
      spots.push([x + KS.r(-9, 9), z + KS.r(-9, 9)]);
    }
    for (const [x, z] of spots) {
      const h = KS.heightAt(x, z);
      if (h < 60) continue; // only up on the mountain, not down in the valley
      const s = KS.r(0.5, 1.1);
      const mesh = new T.Mesh(new T.DodecahedronGeometry(s, 0), new T.MeshLambertMaterial({ color: 0x3a3a3e }));
      mesh.position.set(x, h + s * 0.4, z);
      mesh.rotation.set(KS.r(0, 3), KS.r(0, 3), KS.r(0, 3));
      mesh.castShadow = true; scene.add(mesh);
      D.rocks.push({ mesh, x, z, r: s * 1.1, vx: 0, vz: 0, y: h, rolling: false });
    }
  };
  /** the player pushes a rock by walking into it; the rock rolls downhill */
  D.pushRocks = (px, pz, pr, dt) => {
    for (const rk of D.rocks) {
      const dx = rk.x - px, dz = rk.z - pz, d = Math.hypot(dx, dz), rr = pr + rk.r;
      if (d < rr && d > 0.01) {
        const push = (rr - d) * 6;
        rk.vx += (dx / d) * push * dt * 8; rk.vz += (dz / d) * push * dt * 8;
        rk.rolling = true;
      }
    }
  };
  D.update = (dt) => {
    FX.update(dt);
    for (const rk of D.rocks) {
      const sp = Math.hypot(rk.vx, rk.vz);
      if (sp < 0.05 && !rk.rolling) continue;
      // gravity pulls a rolling rock downhill along the slope
      const e = 1.5, gx = (KS.heightAt(rk.x + e, rk.z) - KS.heightAt(rk.x - e, rk.z)) / (2 * e), gz = (KS.heightAt(rk.x, rk.z + e) - KS.heightAt(rk.x, rk.z - e)) / (2 * e);
      rk.vx += -gx * 9 * dt; rk.vz += -gz * 9 * dt;
      // friction and rolling resistance slow it down
      const fr = Math.exp(-1.1 * dt); rk.vx *= fr; rk.vz *= fr;
      rk.x += rk.vx * dt; rk.z += rk.vz * dt;
      const g = KS.heightAt(rk.x, rk.z);
      rk.y = g + rk.r * 0.4;
      // roll: rotate the rock as it moves
      const roll = Math.hypot(rk.vx, rk.vz) * dt / Math.max(0.3, rk.r);
      rk.mesh.rotation.x += roll * (rk.vz / (Math.hypot(rk.vx, rk.vz) || 1));
      rk.mesh.rotation.z -= roll * (rk.vx / (Math.hypot(rk.vx, rk.vz) || 1));
      rk.mesh.position.set(rk.x, rk.y, rk.z);
      // a rolling rock hurts whatever it runs into
      if (Math.hypot(rk.vx, rk.vz) > 2) {
        const ped = KS.Peds && KS.Peds.nearest && KS.Peds.nearest(rk.x, rk.z, rk.r + 0.7);
        if (ped) { D.hitPed(ped, 40, rk.x - rk.vx, rk.z - rk.vz); rk.vx *= 0.5; rk.vz *= 0.5; }
        if (KS.Player && Math.hypot(KS.Player.x - rk.x, KS.Player.z - rk.z) < rk.r + 0.5) {
          KS.Game && KS.Game.hurt(12); KS.Game && KS.Game.notify('🪨 A rock hit you! −12 health', 'bad');
          rk.vx *= 0.4; rk.vz *= 0.4;
        }
        D.hitPropAt(rk.x, rk.z, 40, rk.r + 0.8);
      }
      if (Math.hypot(rk.vx, rk.vz) < 0.1) rk.rolling = false;
    }
  };
})();
