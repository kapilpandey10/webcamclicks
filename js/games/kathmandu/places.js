/* Kathmandu Streets — special places:
   Chhahare Jharna, a tall waterfall in the hills towards Nuwakot (rocks, a plunge pool, a stream, mist,
   jungle steps and a road up from the Ring Road), and the one helicopter on the Dharahara helipad. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const $ = (id) => document.getElementById(id);
  const Pl = (KS.Places = {});
  const U = { uTime: { value: 0 } };

  /* ======================= Chhahare Jharna ======================= */
  const J = KS.JHARNA;
  const fallMat = () => new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false, side: T.DoubleSide,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float y = vUv.y * 9.0 + uTime * 2.6, x = vUv.x * 14.0;
        float s = n(vec2(x, y)) * 0.6 + n(vec2(x * 2.3, y * 1.7 + 3.0)) * 0.4;
        float edge = smoothstep(0.0, 0.18, vUv.x) * smoothstep(1.0, 0.82, vUv.x);
        vec3 col = mix(vec3(0.62, 0.74, 0.78), vec3(0.97, 0.99, 1.0), s);
        gl_FragColor = vec4(col, (0.45 + 0.5 * s) * edge * smoothstep(0.0, 0.06, vUv.y));
      }`,
  });
  const streamMat = () => new T.ShaderMaterial({
    uniforms: U, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uTime; varying vec2 vUv;
      float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
      float n(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
      void main(){
        float s = n(vec2(vUv.x * 4.0, vUv.y * 0.9 - uTime * 1.8)) * 0.6 + n(vec2(vUv.x * 9.0, vUv.y * 2.0 - uTime * 2.6)) * 0.4;
        float foam = smoothstep(0.62, 0.8, s);
        vec3 col = mix(vec3(0.28, 0.42, 0.42), vec3(0.55, 0.68, 0.66), s); col = mix(col, vec3(0.93, 0.95, 0.94), foam);
        float edge = smoothstep(0.0, 0.2, vUv.x) * smoothstep(1.0, 0.8, vUv.x);
        gl_FragColor = vec4(col, (0.72 + 0.25 * foam) * edge);
      }`,
  });
  /** a ribbon that follows a path on the ground: width w, y = path height + lift */
  function ribbon(P, w, lift, mat) {
    const pos = [], uv = [], idx = []; let along = 0;
    const pts = []; for (let k = 0; k < P.pts.length - 1; k++) { const [ax, az, ah] = P.pts[k], [bx, bz, bh] = P.pts[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 2); for (let i = 0; i < n; i++) { const t = i / n; pts.push([ax + (bx - ax) * t, az + (bz - az) * t, ah + (bh - ah) * t]); } }
    pts.push(P.pts[P.pts.length - 1]);
    pts.forEach((p, i) => {
      const q = pts[Math.min(pts.length - 1, i + 1)], o = pts[Math.max(0, i - 1)], dx = q[0] - o[0], dz = q[1] - o[1], L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
      if (i) along += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]);
      for (const s of [-1, 1]) { const x = p[0] + nx * s * w / 2, z = p[1] + nz * s * w / 2; pos.push(x, Math.max(p[2], KS.heightAt(x, z) - 0.5) + lift, z); uv.push(s < 0 ? 0 : 1, along / w); }
      if (i) { const b = (i - 1) * 2; idx.push(b, b + 2, b + 1, b + 1, b + 2, b + 3); }
    });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    return new T.Mesh(g, mat);
  }
  const mist = [];
  let smokeTex;
  Pl.buildJharna = (scene) => {
    const b = new KS.Builder(), rng = KS.rng; KS.reseed(31);
    const H = J.top - J.base, fx = J.x, fz = J.cliffZ;
    // the cliff: big rough blocks of rock in an arc behind the pool, mossy at the edges
    for (let k = 0; k < 15; k++) {
      const a = -0.9 + (k / 14) * 1.8, r = 26 + KS.r(-2, 3), x = fx + Math.sin(a) * r, z = J.pool.z - Math.cos(a) * r - 4;
      const w = KS.r(9, 15), d = KS.r(8, 14), top = J.top - Math.abs(a) * 26 + KS.r(-6, 4);
      b.box(x, J.base - 3, z, w, top - J.base + 3, d, KS.pick([0x6a645a, 0x5e5a52, 0x77705f, 0x5a5f4a]), a + KS.r(-0.2, 0.2));
      KS.addBox(x, z, w * 0.9, d * 0.9, top);
      if (KS.chance(0.7)) b.box(x + KS.r(-2, 2), top - 0.5, z + KS.r(-2, 2), w * 0.8, 1.2, d * 0.8, 0x3f6a2a, a);
    }
    // ledges the water tumbles over
    for (let k = 0; k < 5; k++) b.box(fx + KS.r(-2, 2), J.base + 8 + k * 12, fz + 3, KS.r(5, 8), 1.2, 3, 0x5a564c);
    // pool rim, boulders, the stream banks
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0xffffff }), 360), d = new T.Object3D(), c = new T.Color(); let n = 0;
    const rock = (x, z, s, y) => { if (n >= 360) return; d.position.set(x, (y != null ? y : KS.heightAt(x, z)) - s * 0.3, z); d.rotation.set(KS.r(0, 3), KS.r(0, 3), KS.r(0, 3)); d.scale.set(s * KS.r(0.9, 1.5), s * KS.r(0.6, 1), s); d.updateMatrix(); rocks.setMatrixAt(n, d.matrix); rocks.setColorAt(n, c.setHSL(KS.r(0.08, 0.14), KS.r(0.05, 0.18), KS.r(0.3, 0.5))); n++; };
    for (let k = 0; k < 70; k++) { const a = KS.r(0, Math.PI * 2), r = J.pool.r + KS.r(-1.5, 3); rock(J.pool.x + Math.cos(a) * r, J.pool.z + Math.sin(a) * r, KS.r(0.6, 2.4)); }
    for (let k = 0; k < 18; k++) rock(fx + KS.r(-5, 5), J.pool.z - KS.r(4, 9), KS.r(1, 3), J.base - 1);
    const S = KS.TPATHS.find((p) => p.id === 'stream');
    for (let k = 0; k < 220; k++) { const seg = Math.floor(KS.r(0, S.pts.length - 1)), t = KS.r(0, 1), [ax, az, ah] = S.pts[seg], [bx, bz, bh] = S.pts[seg + 1]; const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L, side = KS.chance(0.85) ? (KS.chance(0.5) ? 1 : -1) * KS.r(2.2, 4.5) : KS.r(-1.2, 1.2); rock(ax + (bx - ax) * t + nx * side, az + (bz - az) * t + nz * side, KS.r(0.3, 1.3), Math.abs(side) < 1.5 ? ah + (bh - ah) * t - 0.4 : undefined); }
    rocks.count = n; rocks.castShadow = KS.quality.shadows; rocks.receiveShadow = true; scene.add(rocks);
    // stone steps through the jungle, with a rope railing
    const St = KS.TPATHS.find((p) => p.id === 'steps');
    for (let k = 0; k < St.pts.length - 1; k++) {
      const [ax, az, ah] = St.pts[k], [bx, bz, bh] = St.pts[k + 1], L = Math.hypot(bx - ax, bz - az), ry = Math.atan2(bx - ax, bz - az), steps = Math.ceil(L / 1.1);
      for (let i = 0; i < steps; i++) { const t = i / steps, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = ah + (bh - ah) * t; b.box(x, y - 0.4, z, 2.6, 0.55, 1.0, i % 2 ? 0x8a8070 : 0x958b7a, ry); if (i % 3 === 0) for (const s of [-1, 1]) b.box(x + Math.cos(ry) * s * 1.6, y, z - Math.sin(ry) * s * 1.6, 0.12, 1.1, 0.12, 0x5a3a22); }
    }
    // parking and a sign at the end of the road
    const P = J.park; b.cyl(P.x, P.h - 0.05, P.z, P.r, 0.2, 0x6f6a62, 20);
    const rd = KS.TPATHS.find((p) => p.id === 'road');
    scene.add(ribbon(rd, 7, 0.06, new T.MeshLambertMaterial({ color: 0x55565a, polygonOffset: true, polygonOffsetFactor: -2 })));
    const sign = new T.Mesh(new T.PlaneGeometry(4.6, 1.6), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(512, 176, (g, w, h) => { g.fillStyle = '#1b5e20'; g.fillRect(0, 0, w, h); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 60px ${KS.FONT}`; g.fillText('छहरे झरना', w / 2, 74); g.font = '700 36px "Barlow Condensed", sans-serif'; g.fillText('CHHAHARE JHARNA · NUWAKOT →', w / 2, 136, w - 30); }) }));
    sign.position.set(P.x + 5, P.h + 2.6, P.z - 6); sign.rotation.y = 0.15; // faces you as you drive up the road scene.add(sign); b.box(P.x + 5, P.h, P.z - 6, 0.15, 2, 0.15, 0x666666);
    const s2 = sign.clone(); s2.position.set(-84, 2.6, -560); s2.rotation.y = 0; scene.add(s2); b.box(-84, 0, -560, 0.15, 2, 0.15, 0x666666);
    scene.add(KS.mesh(b));
    // water: the fall itself (two layers), the pool and the stream
    const f1 = new T.Mesh(new T.PlaneGeometry(9, H + 3), fallMat()); f1.position.set(fx, J.base + H / 2, fz + 5.5); scene.add(f1);
    const f2 = new T.Mesh(new T.PlaneGeometry(14, H + 3), fallMat()); f2.position.set(fx + 0.6, J.base + H / 2, fz + 6.5); f2.material.opacity = 0.5; scene.add(f2);
    const pool = new T.Mesh(new T.CircleGeometry(J.pool.r + 1, 32).rotateX(-Math.PI / 2), streamMat()); pool.position.set(J.pool.x, J.base - 0.55, J.pool.z); scene.add(pool);
    scene.add(ribbon(S, 4.2, 0.2, streamMat()));
    // mist and spray at the foot of the fall
    smokeTex = KS.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,0.75)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    for (let k = 0; k < 40; k++) { const s3 = new T.Sprite(new T.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 })); scene.add(s3); mist.push({ s: s3, t: KS.r(0, 6) }); }
    // the jungle: tall sal trees and bamboo clumps around the glen and the steps
    const tb = new KS.Builder(); tb.cyl(0, 0, 0, 0.28, 9, 0x4a3524, 6, 0.6); tb.sphere(0, 10, 0, 3.4, 0x2f5a22, 0.9, 8); tb.sphere(1.2, 8.6, 0.6, 2.4, 0x3a6a2a, 0.9, 7); tb.sphere(-1, 9, -0.8, 2.2, 0x284e1c, 0.9, 7);
    const trees = new T.InstancedMesh(tb.build(), KS.M.vc, 420); let tn = 0;
    const clear = (x, z) => { if (Math.hypot(x - J.x, z - J.z) < 34 || Math.hypot(x - P.x, z - P.z) < P.r + 3) return false; for (const p of KS.TPATHS) if (KS.pathNear(p, x, z).d < p.w + 2.5) return false; return true; };
    for (let k = 0; k < 2000 && tn < 420; k++) {
      const x = KS.r(-280, -10), z = KS.r(-1180, -880); if (!clear(x, z)) continue;
      const s4 = KS.r(0.7, 1.35); d.position.set(x, KS.heightAt(x, z) - 0.3, z); d.rotation.set(0, KS.r(0, 6.3), 0); d.scale.set(s4, s4 * KS.r(0.9, 1.3), s4); d.updateMatrix(); trees.setMatrixAt(tn++, d.matrix);
      if (KS.chance(0.4)) KS.addCircle(x, z, 0.4 * s4, KS.heightAt(x, z) + 8);
    }
    trees.count = tn; trees.castShadow = KS.quality.shadows; scene.add(trees);
    // ferns and grass between them
    if (KS.Nature) { KS.Nature.region(-260, -30, -1150, -900, 0.06, null, (x, z) => !clear(x, z) && Math.hypot(x - J.x, z - J.z) < 30); KS.Nature.region(J.x - 30, J.x + 30, J.z - 6, J.z + 30, 0.25, null, (x, z) => Math.hypot(x - J.pool.x, z - J.pool.z) < J.pool.r + 1.5); }
    // more to see: a side fall, a wooden footbridge, a viewpoint, a tea stall with visitors, prayer flags, a rainbow in the spray
    { const e = new KS.Builder();
      const f3 = new T.Mesh(new T.PlaneGeometry(3.2, 34), fallMat()); f3.position.set(fx + 15, J.base + 17, fz + 9); f3.rotation.y = -0.45; scene.add(f3);
      e.box(fx + 15, J.base + 33, fz + 8.5, 6, 2, 4, 0x5a564c);
      // footbridge over the stream just below the pool
      const s0 = S.pts[1], s1 = S.pts[2], bx = (s0[0] + s1[0]) / 2, bz = (s0[1] + s1[1]) / 2, by = Math.max(s0[2], s1[2]) + 1.3, ry = Math.atan2(s1[0] - s0[0], s1[1] - s0[1]) + Math.PI / 2;
      e.box(bx, by - 0.2, bz, 2.2, 0.2, 9, 0x7a5432, ry); for (const sd of [-1, 1]) { e.box(bx + Math.cos(ry) * sd * 1.05, by, bz - Math.sin(ry) * sd * 1.05, 0.08, 1, 9, 0x5a3a22, ry); }
      for (let k = -4; k <= 4; k++) for (const sd of [-1, 1]) e.box(bx + Math.cos(ry) * sd * 1.05 + Math.sin(ry) * k, by - 0.2, bz - Math.sin(ry) * sd * 1.05 + Math.cos(ry) * k, 0.1, 1.1, 0.1, 0x5a3a22);
      for (let k = -4; k <= 4; k += 1) KS.addBox(bx + Math.sin(ry) * k, bz + Math.cos(ry) * k, 2.2, 1.2, by);
      // viewpoint deck on the east side
      const vx = J.x + 26, vz = J.z - 2, vy = KS.heightAt(vx, vz) + 0.3;
      e.box(vx, vy - 0.3, vz, 6, 0.3, 5, 0x7a5432); KS.addBox(vx, vz, 6, 5, vy); for (let k = 0; k < 7; k++) e.box(vx - 3, vy, vz - 2.5 + k * 0.8, 0.08, 1, 0.08, 0x5a3a22);
      const vb = new T.Mesh(new T.PlaneGeometry(2.6, 0.7), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(256, 70, (g, w, h) => { g.fillStyle = '#5a3a22'; g.fillRect(0, 0, w, h); g.fillStyle = '#ffe9a8'; g.textAlign = 'center'; g.font = `700 30px ${KS.FONT}`; g.fillText('दृश्य स्थल · VIEWPOINT', w / 2, 46, w - 12); }) }));
      vb.position.set(vx + 2.6, vy + 1.6, vz + 2.6); scene.add(vb);
      // tea stall and benches in the meadow, with visitors enjoying the spray
      const tx = J.x - 18, tz = J.z + 14, ty = KS.heightAt(tx, tz);
      e.box(tx, ty, tz, 3, 1, 1.6, 0x7a4a2a); e.box(tx, ty + 2.4, tz, 3.6, 0.08, 2.6, 0xc8102e); for (const sx of [-1, 1]) e.box(tx + sx * 1.7, ty, tz + 1.2, 0.08, 2.4, 0.08, 0x555555); KS.addBox(tx, tz, 3, 1.6, ty + 1);
      for (let k = 0; k < 4; k++) { const x = J.x - 10 + k * 6, z = J.z + 20 + (k % 2) * 3, y = KS.heightAt(x, z); e.box(x, y, z, 2, 0.45, 0.5, 0x7a5432); KS.sitSpots.push([x, z, y + 0.45, KS.pick(['tourist', 'man', 'woman', 'student', 'kid'])]); }
      KS.plazas.push({ x0: J.x - 22, x1: J.x + 18, z0: J.z + 6, z1: J.z + 26, n: 10, kinds: ['tourist', 'tourist', 'man', 'woman', 'student', 'kid', 'elder'] });
      scene.add(KS.mesh(e));
      KS.World.flags([J.x - 30, J.base + 9, J.z + 4], [J.x + 22, J.base + 11, J.z - 6], 2.4, 0.9);
      // a rainbow that shows in the spray when the sun is out
      const rb = new T.Mesh(new T.TorusGeometry(16, 1.4, 8, 48, Math.PI), new T.ShaderMaterial({ transparent: true, depthWrite: false, side: T.DoubleSide, uniforms: { uA: { value: 0.3 } },
        vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
        fragmentShader: 'uniform float uA; varying vec3 vP; void main(){ float r = (length(vP.xy) - 14.6) / 2.8; vec3 c = 0.5 + 0.5 * cos(6.2832 * (r * 0.9 + vec3(0.0, 0.33, 0.67))); gl_FragColor = vec4(c, uA * smoothstep(0.0, 0.2, r) * smoothstep(1.0, 0.8, r)); }' }));
      rb.position.set(J.x, J.base + 2, J.pool.z + 4); scene.add(rb); Pl.rainbow = rb;
    }
    KS.swimZones = KS.swimZones || []; KS.swimZones.push({ x: J.pool.x, z: J.pool.z, r: J.pool.r, water: J.base - 0.55 });
    KS.landmarks.push({ id: 'jharna', name: 'Chhahare Jharna', np: 'छहरे झरना', x: J.x, z: J.z, r: 45, stop: { x: P.x, z: P.z }, fact: 'A tall waterfall in the green hills towards Nuwakot. Park at the end of the road and take the stone steps through the jungle.' });
    KS.rng = rng;
  };
  Pl.updateJharna = (dt) => {
    U.uTime.value = KS.clock;
    const PL = KS.Player, dist = Math.hypot(PL.x - J.x, PL.z - J.z);
    if (KS.audio && KS.audio.waterfall) KS.audio.waterfall(Math.max(0, 1 - dist / 220));
    if (Pl.rainbow) Pl.rainbow.material.uniforms.uA.value = 0.32 * (KS.day || 1) * (1 - (KS.Weather.cur.cloud || 0) * 0.8);
    if (dist > 400) { for (const m of mist) m.s.visible = false; return; }
    for (const m of mist) {
      m.t += dt; if (m.t > 6) m.t -= 6; const u = m.t / 6, a = m.t * 1.7 + mist.indexOf(m);
      m.s.visible = true; m.s.position.set(J.cliffZ ? J.x + Math.sin(a) * (3 + u * 14) : 0, J.base + 1 + u * 16, J.pool.z - 4 + Math.cos(a) * (2 + u * 9));
      const sc = 4 + u * 12; m.s.scale.set(sc, sc, sc); m.s.material.opacity = Math.sin(u * Math.PI) * 0.35;
    }
  };

  /* ======================= the one helicopter: Dharahara helipad =======================
     There is a single helicopter in the city, parked on the helipad by Dharahara,
     and you fly it yourself. It can crash: fly into a building fast, or slam into
     a hillside, and it goes down in smoke — you take a heavy hit, and a
     replacement is flown in after half a minute. */
  const Heli = (KS.Heli = {});
  const crashFx = []; // smoke + fire sprites from a crash, rising and fading
  let crashSmokeTex = null, crashFireTex = null;
  Pl.initHeli = (scene) => {
    const d = KS.dharahara; if (!d) return;
    const pad = (Heli.pad = { x: d.x + 24, z: d.z - 2 }); // the only pad, in the plaza by Dharahara
    const b = new KS.Builder();
    b.cyl(pad.x, 0.15, pad.z, 8, 0.12, 0x6e6e70, 28); b.cyl(pad.x, 0.27, pad.z, 7.2, 0.01, 0xf2c418, 28); b.cyl(pad.x, 0.28, pad.z, 6.8, 0.01, 0x6e6e70, 28);
    b.box(pad.x - 1.6, 0.29, pad.z, 0.5, 0.01, 5, 0xffffff); b.box(pad.x + 1.6, 0.29, pad.z, 0.5, 0.01, 5, 0xffffff); b.box(pad.x, 0.29, pad.z, 3.2, 0.01, 0.5, 0xffffff);
    b.cyl(pad.x + 9.5, 0.15, pad.z - 6, 0.05, 4.5, 0x999999, 6); // windsock pole
    scene.add(KS.mesh(b));
    const wind = new T.Mesh(new T.ConeGeometry(0.3, 1.4, 8, 1, true).rotateZ(Math.PI / 2), new T.MeshLambertMaterial({ color: 0xff7a00, side: T.DoubleSide }));
    wind.position.set(pad.x + 9.5, 4.4, pad.z - 6); scene.add(wind); Heli.sock = wind;
    const sign = new T.Mesh(new T.PlaneGeometry(3.2, 1.1), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(512, 176, (g, w, h) => { g.fillStyle = '#1a1a1a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#f2c418'; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = '800 64px "Barlow Condensed", sans-serif'; g.fillText('🚁 HELIPAD', w / 2, 78); g.font = `600 34px ${KS.FONT}`; g.fillText('हेलिप्याड · Fly it yourself', w / 2, 136, w - 24); }) }));
    sign.position.set(pad.x + 9.5, 5.4, pad.z - 6); sign.rotation.y = Math.PI / 2; scene.add(sign);
    KS.landmarks.push({ minor: true, id: 'helipad', name: 'Helipad', np: 'हेलिप्याड', x: pad.x, z: pad.z, r: 10, fact: 'The only helicopter in the city. Fly it yourself — but mind the buildings: fly into one fast and it crashes.' });
    // the crash sprites: a soft round puff, tinted smoke or fire
    const puff = (col) => KS.tex(64, 64, (g) => { const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); });
    crashSmokeTex = puff('rgba(40,40,40,0.7)'); crashFireTex = puff('rgba(255,140,30,0.9)');
  };
  /** a crash: a fireball and a column of smoke where the helicopter went down */
  Heli.crash = (x, y, z) => {
    const scene = KS.scene; if (!scene || !crashSmokeTex) return;
    for (let k = 0; k < 14; k++) {
      const fire = k < 5, s = new T.Sprite(new T.SpriteMaterial({ map: fire ? crashFireTex : crashSmokeTex, transparent: true, depthWrite: false, opacity: 0.95 }));
      s.position.set(x + KS.r(-2, 2), y + KS.r(0, 2), z + KS.r(-2, 2));
      const sc = fire ? KS.r(4, 7) : KS.r(3, 6); s.scale.set(sc, sc, sc);
      scene.add(s); crashFx.push({ s, t: KS.r(0, 0.4), life: fire ? 1.2 : KS.r(6, 9), vy: fire ? 2 : KS.r(2.5, 4.5), fire });
    }
    Heli.respawnT = 30; // a replacement is flown in after half a minute
  };
  Heli.update = (dt) => {
    if (Heli.sock) Heli.sock.rotation.y = Math.sin(KS.clock * 0.3) * 0.6;
    for (let i = crashFx.length - 1; i >= 0; i--) {
      const f = crashFx[i]; f.t += dt; const u = f.t / f.life;
      if (u >= 1) { KS.scene.remove(f.s); f.s.material.dispose(); crashFx.splice(i, 1); continue; }
      f.s.position.y += f.vy * dt; f.s.material.opacity = f.fire ? Math.max(0, 0.95 * (1 - u * 1.4)) : 0.55 * Math.sin(Math.min(1, u * 3) * Math.PI * 0.5) * (1 - u);
      const sc = f.s.scale.x + (f.fire ? 2 : 6) * dt; f.s.scale.set(sc, sc, sc);
    }
    if (Heli.respawnT != null) {
      Heli.respawnT -= dt;
      if (Heli.respawnT <= 0) {
        Heli.respawnT = null;
        if (KS.Traffic && KS.Heli.pad) { KS.Traffic.park('helicopter', KS.Heli.pad.x, KS.Heli.pad.z, Math.PI); KS.Game && KS.Game.notify('🚁 A replacement helicopter has been flown in — it is on the helipad.', 'good'); }
      }
    }
  };
  /* ======================= Sadbhav Thakuri Residence: a रु 50 tour ======================= */
  const Man = (KS.Mansion = { price: 50, ticket: false, seen: new Set() });
  const poolMat = () => new T.ShaderMaterial({ uniforms: U, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vP = w.xz; gl_Position = projectionMatrix * viewMatrix * w; }',
    fragmentShader: `uniform float uTime; varying vec2 vP;
      void main(){ float c = sin(vP.x * 2.1 + uTime * 1.3) * sin(vP.y * 1.7 - uTime * 1.1) + sin((vP.x + vP.y) * 3.3 + uTime * 2.0) * 0.5;
        vec3 col = mix(vec3(0.15, 0.62, 0.78), vec3(0.75, 0.95, 1.0), smoothstep(0.6, 1.4, c)); gl_FragColor = vec4(col, 0.82); }` });
  let gateBars, drops, dropPos, guards = [];
  Pl.buildMansion = (scene) => {
    const M = KS.MANSION, H = M.house; if (!H) return;
    const { vx, vz } = H, cx = (M.x0 + M.x1) / 2, cz = (M.z0 + M.z1) / 2, b = new KS.Builder(), y0 = H.floor;
    // --- inside the house: marble floor, a grand hall, a dining room and a lounge
    const marble = KS.tex(128, 128, (g, w, h) => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { g.fillStyle = (i + j) % 2 ? '#e9e4da' : '#c9c1b2'; g.fillRect(i * 32, j * 32, 32, 32); } });
    marble.repeat.set(10, 4.5); const fl = new T.Mesh(new T.PlaneGeometry(39.2, 17.2).rotateX(-Math.PI / 2), new T.MeshLambertMaterial({ map: marble })); fl.position.set(vx, y0 + 0.02, vz); scene.add(fl);
    // grand hall (centre)
    b.box(vx, y0 + 0.03, vz + 2, 4, 0.02, 13, 0x8a1020); // red carpet to the door
    // the grand staircase (up to the open upper floor) — every step is a solid you can climb
    for (let k = 0; k < 10; k++) { b.box(vx, y0 + k * 0.52, vz - 4.6 - k * 0.42, 4.6, 0.52, 0.42, k % 2 ? 0xd9d1bf : 0xe8e2d4); KS.addBox(vx, vz - 4.6 - k * 0.42, 4.6, 0.42, y0 + (k + 1) * 0.52, y0 + k * 0.52); }
    for (const sx of [-1, 1]) b.box(vx + sx * 2.4, y0 + 0.5, vz - 6.6, 0.12, 5, 4.4, 0xd9a52b);
    for (const sx of [-1, 1]) { b.box(vx + sx * 4.2, y0, vz + 3, 1, 0.8, 3.4, 0x6a1a1a); b.box(vx + sx * 4.7, y0 + 0.8, vz + 3, 0.3, 0.6, 3.4, 0x6a1a1a); KS.addBox(vx + sx * 4.2, vz + 3, 1.2, 3.4, y0 + 2); } // sofas
    b.box(vx, y0, vz + 3, 2.2, 0.45, 1.2, 0x3a2414); b.cyl(vx, y0 + 0.45, vz + 3, 0.25, 0.4, 0xd9a52b, 10); KS.addBox(vx, vz + 3, 2.2, 1.2, y0 + 1.6); // coffee table & vase
    b.box(vx - 6.6, y0 + 2.2, vz - 4, 0.1, 1.8, 2.6, 0xd9a52b); b.box(vx - 6.54, y0 + 2.4, vz - 4, 0.1, 1.4, 2.2, 0x2a4a6a); // a painting
    b.box(vx + 6.6, y0 + 2.2, vz - 4, 0.1, 1.8, 2.6, 0xd9a52b); b.box(vx + 6.54, y0 + 2.4, vz - 4, 0.1, 1.4, 2.2, 0x6a3a2a);
    for (const sx of [-1, 1]) { b.cyl(vx + sx * 5.5, y0, vz + 7.5, 0.4, 0.7, 0x7a4a2a, 10); b.sphere(vx + sx * 5.5, y0 + 1.4, vz + 7.5, 0.8, 0x2f6a2a, 1, 8); } // potted palms
    b.cyl(vx, y0 + 4.6, vz + 1, 1.3, 0.15, 0xd9a52b, 16); for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; b.cyl(vx + Math.cos(a) * 1.2, y0 + 3.9, vz + 1 + Math.sin(a) * 1.2, 0.03, 0.7, 0xd9a52b, 4); } // chandelier frame
    // dining room (west)
    const dx = vx - 13;
    b.box(dx, y0, vz, 2, 0.85, 8, 0x4a2a16); KS.addBox(dx, vz, 2, 8, y0 + 2);
    for (let k = 0; k < 5; k++) for (const sx of [-1, 1]) { b.box(dx + sx * 1.5, y0, vz - 3 + k * 1.5, 0.6, 0.5, 0.6, 0x6a3a1a); b.box(dx + sx * 1.8, y0 + 0.5, vz - 3 + k * 1.5, 0.1, 0.8, 0.6, 0x6a3a1a); b.cyl(dx + sx * 0.6, y0 + 0.86, vz - 3 + k * 1.5, 0.22, 0.03, 0xffffff, 10); }
    b.box(dx, y0, vz - 8, 5, 1.6, 0.6, 0x3a2414); b.box(dx - 6, y0 + 2.2, vz, 0.1, 1.6, 3, 0xd9a52b); b.box(dx - 5.94, y0 + 2.4, vz, 0.1, 1.2, 2.6, 0x3a6a3a);
    // lounge (east): a piano, a big bed, bookshelves
    const lx = vx + 13;
    b.box(lx + 2.5, y0, vz - 5, 3, 0.6, 4, 0xf0ece0); b.box(lx + 2.5, y0 + 0.6, vz - 6.8, 3, 1.4, 0.3, 0x6a1a2a); b.box(lx + 2.5, y0 + 0.6, vz - 4.5, 2.8, 0.25, 2.8, 0xe8e0d0); KS.addBox(lx + 2.5, vz - 5, 3, 4, y0 + 2);
    b.box(lx - 3, y0, vz + 4, 2.2, 1, 1.4, 0x111111); b.box(lx - 3, y0 + 1, vz + 3.5, 2.2, 0.06, 0.4, 0xf4f4f4); b.box(lx - 3, y0 + 1, vz + 4.6, 2.2, 0.9, 0.2, 0x111111); KS.addBox(lx - 3, vz + 4, 2.2, 1.4, y0 + 2);
    for (let k = 0; k < 3; k++) { b.box(lx + 6.4, y0, vz - 1 + k * 2, 0.6, 3.2, 1.9, 0x4a2a16); for (let r = 0; r < 4; r++) b.box(lx + 6.1, y0 + 0.4 + r * 0.75, vz - 1 + k * 2, 0.08, 0.5, 1.7, KS.pick([0x8a2a1a, 0x1a3a6a, 0x2a5a2a, 0xa8862a])); }
    KS.addBox(lx + 6.4, vz + 1, 0.6, 6, y0 + 3.2);
    b.box(lx, y0 + 0.03, vz, 6, 0.02, 4, 0x2a3a6a);
    scene.add(KS.mesh(b, KS.M.vc, false));
    // --- level 2 (floor at y2): kitchen (west), bedroom (centre), toilet (east), and the front balcony
    const y2 = H.floor2 || 6.7, u = new KS.Builder(); // the kitchen sits over the dining room (dx) and the toilet over the lounge (lx)
    // kitchen: terracotta tiles, a counter with stove and sink, a fridge, a table with chairs
    u.box(dx, y2 + 0.01, vz, 12, 0.02, 16, 0xc47a3a);
    u.box(161.2, y2, vz - 2, 1, 1, 10, 0x8a6a4a); KS.addBox(161.2, vz - 2, 1, 10, y2 + 1, y2);
    u.box(161.2, y2 + 1, vz - 4, 0.8, 0.06, 1.2, 0x1a1a1a); for (const dz of [-4.4, -3.6]) u.cyl(161.2, y2 + 1.05, vz + dz, 0.16, 0.03, 0x333333, 8);
    u.box(161.2, y2 + 1, vz + 2, 0.8, 0.15, 1, 0xffffff); u.cyl(161.2, y2 + 1.2, vz + 1.6, 0.04, 0.4, 0x8a8a90, 6);
    u.box(161.5, y2, vz - 7.5, 1.2, 2.2, 1, 0xf0f0f0); KS.addBox(161.5, vz - 7.5, 1.2, 1, y2 + 2.2, y2);
    u.cyl(dx, y2, vz + 2, 1.1, 0.08, 0x6a4a2a, 12); u.cyl(dx, y2, vz + 2, 0.12, 0.8, 0x4a2a16, 8); KS.addBox(dx, vz + 2, 2.2, 2.2, y2 + 0.9, y2);
    for (const [cx2, cz2] of [[dx - 1.8, vz + 2], [dx + 1.8, vz + 2], [dx, vz + 0.2], [dx, vz + 3.8]]) { u.box(cx2, y2, cz2, 0.55, 0.45, 0.55, 0x6a3a1a); u.box(cx2, y2 + 0.45, cz2, 0.55, 0.5, 0.1, 0x6a3a1a); }
    u.cyl(dx, y2 + 2.8, vz + 2, 0.3, 0.3, 0xd9a52b, 8);
    // bedroom: a red rug, a big double bed with pillows, bedside tables, a dresser with a mirror
    u.box(vx, y2 + 0.01, vz + 2, 5, 0.02, 3.5, 0x8a1020);
    u.box(184, y2, vz - 6.5, 2.2, 0.5, 2.6, 0x6a3a1a); u.box(184, y2 + 0.5, vz - 6.5, 2, 0.25, 2.4, 0xf0ece0); u.box(184, y2 + 0.75, vz - 6, 2, 0.12, 1.4, 0x2a4a6a);
    u.box(183.4, y2 + 0.75, vz - 7.6, 0.8, 0.2, 0.5, 0xffffff); u.box(184.6, y2 + 0.75, vz - 7.6, 0.8, 0.2, 0.5, 0xffffff);
    u.box(184, y2, vz - 7.9, 2.2, 1.2, 0.15, 0x4a2a16); KS.addBox(184, vz - 6.5, 2.2, 2.6, y2 + 1, y2);
    for (const sx of [-1, 1]) { u.box(184 + sx * 1.6, y2, vz - 7.6, 0.6, 0.6, 0.6, 0x6a4a2a); u.cyl(184 + sx * 1.6, y2 + 0.75, vz - 7.6, 0.12, 0.3, 0xd9a52b, 8); }
    u.box(174.5, y2, vz - 8, 2, 1, 0.6, 0x6a4a2a); u.box(174.5, y2 + 1.8, vz - 8.2, 1.2, 1, 0.05, 0xcfe0e8);
    // toilet: blue tiles, a toilet, a sink with a mirror, a shower, towels
    u.box(lx, y2 + 0.01, vz, 12, 0.02, 16, 0x9ec8d8);
    u.cyl(lx - 3, y2, vz - 6, 0.45, 0.4, 0xffffff, 10); u.box(lx - 3, y2 + 0.4, vz - 6.6, 0.7, 0.6, 0.25, 0xffffff); KS.addBox(lx - 3, vz - 6, 1, 1, y2 + 0.8, y2);
    u.box(lx + 3, y2, vz - 6, 1, 0.9, 0.6, 0xffffff); u.box(lx + 3, y2 + 1.6, vz - 6.3, 0.9, 0.9, 0.05, 0xcfe0e8); KS.addBox(lx + 3, vz - 6, 1, 0.6, y2 + 1, y2);
    u.box(lx + 4, y2, vz + 3, 0.05, 2.2, 2, 0xbfe0e8); u.cyl(lx + 4, y2 + 2.2, vz + 3, 0.15, 0.1, 0x8a8a90, 8); u.box(lx + 4, y2 + 0.01, vz + 3, 1.6, 0.06, 1.6, 0xffffff);
    u.box(lx - 4, y2 + 1.2, vz + 2, 0.05, 0.06, 1.2, 0x8a8a90); u.box(lx - 4, y2 + 1.2, vz + 2, 0.5, 0.7, 0.06, 0xe23a5a);
    // balcony furniture: two chairs, a table, a plant (the slab and railings are in signs.js)
    for (const sx of [-1, 1]) { u.box(vx + sx * 6, 6.6, vz + 10.5, 0.6, 0.9, 0.6, 0x8a6a4a); u.box(vx + sx * 6, 6.6 + 0.9, vz + 10.8, 0.6, 0.6, 0.1, 0x8a6a4a); }
    u.cyl(vx, 6.6, vz + 10.5, 0.5, 0.08, 0x6a4a2a, 10); u.cyl(vx, 6.6, vz + 10.5, 0.08, 0.7, 0x4a2a16, 8); KS.addBox(vx, vz + 10.5, 1, 1, 7.4, 6.6);
    u.cyl(vx + 8, 6.6, vz + 10.5, 0.35, 0.6, 0x7a4a2a, 10); u.sphere(vx + 8, 6.6 + 1.1, vz + 10.5, 0.6, 0x2f6a2a, 1, 8);
    scene.add(KS.mesh(u, KS.M.vc, false));
    Man.light2 = new T.PointLight(0xffe0b0, 0, 32, 1.4); Man.light2.position.set(vx, y2 + 4, vz); scene.add(Man.light2);
    // --- the bedroom wardrobe: double doors (O opens them) and bright jewellery inside (C collects it)
    const wx = vx - 4, wz = vz - 8.2;
    const wd = new KS.Builder();
    wd.box(wx, y2, wz - 0.32, 2.2, 2.4, 0.06, 0x4a2a16); wd.box(wx - 1.07, y2, wz, 0.06, 2.4, 0.7, 0x4a2a16); wd.box(wx + 1.07, y2, wz, 0.06, 2.4, 0.7, 0x4a2a16);
    wd.box(wx, y2 + 2.37, wz, 2.2, 0.06, 0.7, 0x4a2a16); wd.box(wx, y2, wz, 2.2, 0.06, 0.7, 0x4a2a16);
    wd.box(wx, y2 + 0.8, wz, 2, 0.05, 0.6, 0x6a4a2a); wd.box(wx, y2 + 1.6, wz, 2, 0.05, 0.6, 0x6a4a2a);
    scene.add(KS.mesh(wd, KS.M.vc, false));
    KS.addBox(wx, wz, 2.2, 0.7, y2 + 2.4, y2); // the wardrobe is a solid you cannot walk through
    const doorMat = new T.MeshLambertMaterial({ color: 0x5a3420 });
    const knobMat = new T.MeshLambertMaterial({ color: 0xd9a52b });
    const mkDoor = (hingeX, dir) => {
      const g = new T.Group(); g.position.set(hingeX, y2, wz + 0.35);
      const panel = new T.Mesh(new T.BoxGeometry(1.05, 2.3, 0.06), doorMat); panel.position.set(dir * 0.525, 1.15, 0); g.add(panel);
      const knob = new T.Mesh(new T.SphereGeometry(0.05, 8, 6), knobMat); knob.position.set(dir * 0.95, 1.15, 0.06); g.add(knob);
      scene.add(g); return g;
    };
    Man.wardrobe = { x: wx, z: wz, y: y2, open: false, doorK: 0, doorL: mkDoor(wx - 1.1, 1), doorR: mkDoor(wx + 1.1, -1) };
    const goldMat = new T.MeshBasicMaterial({ color: 0xffd21f });
    const gemCols = [0xff3a5a, 0x3aa0ff, 0x2fd060, 0xff7ad9, 0x00e5d4];
    const jewels = new T.Group(); jewels.position.set(wx, y2, wz);
    for (let k = 0; k < 3; k++) { const n = new T.Mesh(new T.TorusGeometry(0.16, 0.03, 6, 16), goldMat); n.position.set(-0.6 + k * 0.6, 1.9, 0.1); jewels.add(n); }
    for (let k = 0; k < 5; k++) { const g = new T.Mesh(new T.OctahedronGeometry(0.13), new T.MeshBasicMaterial({ color: gemCols[k] })); g.position.set(-0.7 + k * 0.35, 1.05, 0.1); jewels.add(g); }
    for (let k = 0; k < 3; k++) { const b2 = new T.Mesh(new T.BoxGeometry(0.32, 0.09, 0.14), goldMat); b2.position.set(-0.4 + k * 0.4, 0.32, 0.1); jewels.add(b2); }
    jewels.visible = false; scene.add(jewels);
    Man.wardrobeLight = new T.PointLight(0xffc860, 0, 5, 1.2); Man.wardrobeLight.position.set(wx, y2 + 1.6, wz + 0.8); scene.add(Man.wardrobeLight);
    Man.jewels = jewels;
    Man.jewellery = { inWardrobe: true, inHands: false };
    // a little gold bundle to carry in the hand once you collect the jewellery
    const hb = new T.Group();
    for (let k = 0; k < 3; k++) { const s = new T.Mesh(new T.SphereGeometry(0.09, 8, 6), goldMat); s.position.set((k - 1) * 0.12, 0.05, 0); hb.add(s); }
    const hg = new T.Mesh(new T.OctahedronGeometry(0.11), new T.MeshBasicMaterial({ color: 0xff3a5a })); hg.position.set(0, 0.18, 0); hb.add(hg);
    Man.handJewels = hb;
    // warm light inside; glowing chandelier bulbs
    const glow = new T.MeshBasicMaterial({ color: 0xfff2c0 });
    for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2, m = new T.Mesh(new T.SphereGeometry(0.12, 8, 6), glow); m.position.set(vx + Math.cos(a) * 1.2, y0 + 3.85, vz + 1 + Math.sin(a) * 1.2); scene.add(m); }
    Man.light = new T.PointLight(0xffe0b0, 0, 28, 1.4); Man.light.position.set(vx, y0 + 4, vz + 1); scene.add(Man.light);
    // --- the raised swimming pool with steps up, steps inside and a diving board
    const px = vx - 14, pz = cz + 16, PW = 16, PD = 8, e = new KS.Builder();
    e.box(px, 0.05, pz, PW, 0.1, PD, 0x2a8ab0);
    for (const [ox, oz, w, d] of [[0, -PD / 2, PW + 1, 0.5], [0, PD / 2, PW + 1, 0.5], [-PW / 2, 0, 0.5, PD + 1], [PW / 2, 0, 0.5, PD + 1]]) { e.box(px + ox, 0, pz + oz, w, 1.65, d, 0xf2eee4); KS.addBox(px + ox, pz + oz, w, d, 1.65); }
    for (let k = 0; k < 2; k++) { e.box(px + PW / 2 + 0.8 + (1 - k) * 0.7, 0, pz, 0.7, 0.55 * (k + 1), 2.4, 0xe8e2d4); KS.addBox(px + PW / 2 + 0.8 + (1 - k) * 0.7, pz, 0.7, 2.4, 0.55 * (k + 1)); } // steps up, outside
    for (let k = 0; k < 2; k++) { e.box(px + PW / 2 - 0.6 - k * 0.8, 0, pz, 0.8, 0.9 - k * 0.4, 2.4, 0xe8e2d4); KS.addBox(px + PW / 2 - 0.6 - k * 0.8, pz, 0.8, 2.4, 0.9 - k * 0.4); } // steps inside
    e.box(px - PW / 2 + 1.5, 1.65, pz, 3, 0.12, 0.6, 0x2a6a8a); e.box(px - PW / 2 + 0.3, 0, pz, 0.4, 1.8, 0.6, 0xe8e2d4);
    for (let k = 0; k < 4; k++) { e.box(px - 5 + k * 3.4, 0, pz + PD / 2 + 2.2, 1.8, 0.35, 0.7, 0xffffff); e.box(px - 5 + k * 3.4, 0.35, pz + PD / 2 + 2.5, 1.8, 0.5, 0.12, 0xffffff); } // sun loungers
    // --- the garden: flower beds, hedges, a gazebo, lamps
    for (let k = 0; k < 8; k++) { const x = M.gx - 28 + k * 8, z = cz + 32; e.box(x, 0, z, 5, 0.35, 2, 0x6a4a2a); for (let f = 0; f < 6; f++) e.sphere(x - 2 + f * 0.8, 0.5, z + KS.r(-0.6, 0.6), 0.28, KS.pick([0xe23a5a, 0xf2c418, 0xffffff, 0xb83ae2, 0xff7a1a]), 1, 6); }
    for (const sx of [-1, 1]) { e.box(M.gx + sx * 7, 0, (M.z1 + cz) / 2 + 6, 1, 1.1, 40, 0x2f6a2a); KS.addBox(M.gx + sx * 7, (M.z1 + cz) / 2 + 6, 1, 40, 1.1); }
    const gzx = M.x1 - 18, gzz = cz + 30; e.cyl(gzx, 0, gzz, 4, 0.3, 0xe8e2d4, 8); for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; e.cyl(gzx + Math.cos(a) * 3.5, 0.3, gzz + Math.sin(a) * 3.5, 0.15, 3, 0xffffff, 6); } e.roof(gzx, 3.3, gzz, 8, 1.8, 0x8a2a1f, 0.3);
    for (let k = 0; k < 6; k++) { e.cyl(M.gx + (k % 2 ? 4 : -4), 0, M.z1 - 8 - Math.floor(k / 2) * 14, 0.06, 3, 0x222222, 6); e.sphere(M.gx + (k % 2 ? 4 : -4), 3.1, M.z1 - 8 - Math.floor(k / 2) * 14, 0.25, 0xfff2c0, 1, 8); }
    // ticket window on the guard booth
    e.box(M.gx + 7, 1, M.z1 + 4.12, 1.2, 0.9, 0.05, 0x1a2a3a);
    scene.add(KS.mesh(e));
    const water = new T.Mesh(new T.PlaneGeometry(PW - 0.6, PD - 0.6).rotateX(-Math.PI / 2), poolMat()); water.position.set(px, 1.45, pz); scene.add(water);
    KS.swimZones = KS.swimZones || []; KS.swimZones.push({ x0: px - PW / 2 + 0.25, x1: px + PW / 2 - 0.25, z0: pz - PD / 2 + 0.25, z1: pz + PD / 2 - 0.25, water: 1.45 });
    const tb = new T.Mesh(new T.PlaneGeometry(2.4, 0.8), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(256, 86, (g, w, h) => { g.fillStyle = '#15151a'; g.fillRect(0, 0, w, h); g.strokeStyle = '#d9a52b'; g.lineWidth = 4; g.strokeRect(4, 4, w - 8, h - 8); g.fillStyle = '#e8c15a'; g.textAlign = 'center'; g.font = '700 26px "Barlow Condensed", sans-serif'; g.fillText('🎟️ HOUSE & GARDEN TOUR', w / 2, 36, w - 16); g.font = `600 24px ${KS.FONT}`; g.fillText('भ्रमण टिकट · रु 50', w / 2, 70); }) }));
    tb.position.set(M.gx + 7, 2.2, M.z1 + 4.15); scene.add(tb);
    // --- the fountain: water jets and falling drops
    const fz = cz + 22, N2 = 90; dropPos = new Float32Array(N2 * 3); Man.drops = Array.from({ length: N2 }, () => ({ t: Math.random() * 1.6, a: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 0.6 }));
    const dg = new T.BufferGeometry(); dg.setAttribute('position', new T.BufferAttribute(dropPos, 3));
    drops = new T.Points(dg, new T.PointsMaterial({ color: 0xdff4ff, size: 0.16, transparent: true, opacity: 0.85 })); drops.frustumCulled = false; scene.add(drops);
    const bowl = new T.Mesh(new T.CircleGeometry(3.3, 24).rotateX(-Math.PI / 2), poolMat()); bowl.position.set(M.gx, 0.92, fz); scene.add(bowl);
    Man.fountain = { x: M.gx, z: fz };
    // --- the iron gate: slides open when you have a ticket
    gateBars = new T.Group(); const barM = new T.MeshLambertMaterial({ color: 0x1a1a1a }), goldM = new T.MeshLambertMaterial({ color: 0xd9a52b });
    for (let k = 0; k < 9; k++) { const bar = new T.Mesh(new T.BoxGeometry(0.08, 2.8, 0.08), barM); bar.position.set(-4 + k, 1.4, 0); gateBars.add(bar); const tip = new T.Mesh(new T.ConeGeometry(0.08, 0.25, 6), goldM); tip.position.set(-4 + k, 2.9, 0); gateBars.add(tip); }
    const rail = new T.Mesh(new T.BoxGeometry(8.6, 0.12, 0.1), barM); rail.position.y = 1.2; gateBars.add(rail); gateBars.position.set(M.gx, 0, M.z1); scene.add(gateBars);
    // --- the tour stops and the security team
    Man.stops = [{ id: 'hall', name: 'the grand hall', x: vx, z: vz + 1, r: 5 }, { id: 'dining', name: 'the dining room', x: vx - 13, z: vz, r: 5 }, { id: 'lounge', name: 'the lounge and library', x: vx + 13, z: vz, r: 5 },
      { id: 'kitchen', name: 'the upstairs kitchen', x: vx - 13, z: vz, r: 5, y: y2 }, { id: 'bedroom', name: 'the upstairs bedroom', x: vx, z: vz, r: 5, y: y2 },
      { id: 'fountain', name: 'the fountain', x: M.gx, z: fz, r: 7 }, { id: 'pool', name: 'the swimming pool', x: px, z: pz, r: 11 }, { id: 'gazebo', name: 'the garden gazebo', x: gzx, z: gzz, r: 7 }];
    const loops = [[[M.gx - 10, M.z1 - 6], [M.gx - 10, cz + 8], [M.x0 + 8, cz + 8], [M.x0 + 8, M.z1 - 6]], [[M.gx + 10, M.z1 - 6], [M.x1 - 8, M.z1 - 6], [M.x1 - 8, cz], [M.gx + 26, cz], [M.gx + 26, cz + 20]], [[vx - 22, vz + 11], [vx + 22, vz + 11], [vx + 22, M.z0 + 8], [vx - 22, M.z0 + 8]], [[vx - 2, vz + 6], [vx - 2, vz - 2], [vx + 12, vz - 1], [vx - 12, vz - 1]]];
    for (const loop of loops) {
      const o = KS.outfitFor('office'); Object.assign(o, { topStyle: 'jacket', jacket: 0x111111, top: 0xffffff, tie: 0x111111, glasses: true, hat: null });
      const g = KS.makePerson('office', o); scene.add(g.root);
      const inside = loop === loops[3];
      guards.push({ p: g, loop, i: 0, x: loop[0][0], z: loop[0][1], y: inside ? y0 : 0.1, wait: KS.r(0, 3), sayT: 0, mansion: true, kind: 'guard', hp: 100, down: 0, fight: 0, punchT: 0, kickT: 0 });
    }
    // the two gate guards: they walk left and right along the gate, a weapon in hand
    for (const [x0, x1] of [[M.gx - 10, M.gx], [M.gx, M.gx + 10]]) {
      const o = KS.outfitFor('office'); Object.assign(o, { topStyle: 'jacket', jacket: 0x111111, top: 0xffffff, tie: 0x111111, glasses: true, hat: null });
      const g = KS.makePerson('office', o); scene.add(g.root);
      guards.push({ p: g, mode: 'line', x0, x1, z: M.z1 + 2.2, dir: x0 === M.gx - 10 ? 1 : -1, x: (x0 + x1) / 2, y: 0.1, wait: 0, sayT: 0, mansion: true, kind: 'guard', hp: 100, down: 0, fight: 0, punchT: 0, kickT: 0, gate: true });
    }
    // the staff upstairs: a cook in the kitchen and a housekeeper in the bedroom — they fight back too
    for (const [kind, role, loop] of [
      ['cook', 'man', [[dx - 3, vz - 2], [dx + 3, vz - 2], [dx + 3, vz + 4], [dx - 3, vz + 4]]],
      ['housekeeper', 'woman', [[vx - 5, vz + 2], [vx + 5, vz + 2], [vx + 5, vz - 4], [vx - 5, vz - 4]]],
    ]) {
      const g = KS.makePerson(role, KS.outfitFor(role)); scene.add(g.root);
      guards.push({ p: g, loop, i: 0, x: loop[0][0], z: loop[0][1], y: y2, wait: KS.r(0, 3), sayT: 0, mansion: true, kind, hp: 100, down: 0, fight: 0, punchT: 0, kickT: 0 });
    }
    Man.people = guards;
    KS.landmarks.push({ minor: true, id: 'mansiontour', name: 'Thakuri Residence tour', np: 'निवास भ्रमण', x: M.gx + 7, z: M.z1 + 5, r: 6, fact: 'Buy a रु 50 ticket at the guard booth to tour the house, the garden, the fountain and the swimming pool.' });
  };
  Man.nearBooth = (P) => { const M = KS.MANSION; return Math.hypot(P.x - (M.gx + 7), P.z - (M.z1 + 5.2)) < 2.4; };
  Man.buy = () => {
    const D = KS.Shop.data;
    if (Man.ticket) { KS.Game.notify('🎟️ You already have a ticket. Enjoy the tour!'); return; }
    if (D.cash < Man.price) { KS.Game.notify(`The tour ticket is रु ${Man.price}.`, 'bad'); return; }
    D.cash -= Man.price; Man.ticket = true; Man.seen.clear(); KS.audio.coin && KS.audio.coin(); KS.Game.save && KS.Game.save();
    KS.Game.notify('🎟️ Welcome to the Sadbhav Thakuri Residence! See <b>the grand hall, dining room, lounge, the upstairs kitchen and bedroom, the fountain, swimming pool and gazebo</b>. You may swim in the pool.', 'good');
  };
  /** a member of the household is hit (punch or gunshot): they go down, get up
      fighting, and your tour ticket is cancelled on the spot. */
  Man.hitPerson = (mp, dmg, fromX, fromZ) => {
    if (!mp || mp.dead) return false;
    mp.hp = (mp.hp == null ? 100 : mp.hp) - dmg;
    if (mp.hp > 0) {
      mp.down = 2.2; mp.fight = 0; mp.getUpFight = true;
      const dx = mp.x - fromX, dz = mp.z - fromZ, d = Math.hypot(dx, dz) || 1;
      mp.x += (dx / d) * 0.8; mp.z += (dz / d) * 0.8;
      KS.say(mp.p.root, KS.pick(['Aija! Aija!', 'Ma pani dekhauchhu!', 'Ke herchas?!']), 1.8, 'angry');
      KS.audio && KS.audio.punch && KS.audio.punch();
      Man.cancelTicket('you attacked a member of the household');
      return true;
    }
    mp.dead = true; mp.down = 1e9; mp.fight = 0;
    mp.p.inner.rotation.x = -1.5; mp.p.inner.position.y = 0.12;
    KS.say(mp.p.root, '…', 2, 'angry');
    KS.audio && KS.audio.punch && KS.audio.punch();
    KS.Game && KS.Game.notify('💀 A member of the household is down!', 'bad');
    Man.cancelTicket('you attacked a member of the household');
    return true;
  };
  /** lose the tour ticket for misbehaving: the gate closes behind you and the
      household turns on you. The gate never traps anyone inside, though. */
  Man.cancelTicket = (reason) => {
    if (!Man.ticket) return;
    Man.ticket = false;
    KS.Game.notify(`🎟️ Your tour ticket has been CANCELLED — ${reason}.`, 'bad');
    KS.audio && KS.audio.whistle && KS.audio.whistle(1);
    const PL = KS.Player;
    for (const g of guards) if (!g.dead && g.down <= 0 && Math.hypot(g.x - PL.x, g.z - PL.z) < 30 && Math.abs(g.y - PL.y) < 4) { g.fight = 9; g.down = 0; g.p.inner.rotation.x = 0; g.p.inner.position.y = 0; }
  };
  Man.nearWardrobe = (PL) => { const W = Man.wardrobe; return W && Math.hypot(PL.x - W.x, PL.z - W.z) < 2.6 && Math.abs(PL.y - W.y) < 2.5; };
  /** O by the bedroom wardrobe: swing the double doors open or shut. */
  Man.toggleWardrobe = () => {
    const PL = KS.Player, W = Man.wardrobe;
    if (!W || !Man.nearWardrobe(PL)) return false;
    W.open = !W.open;
    KS.audio && KS.audio.ding && KS.audio.ding();
    KS.Game.notify(W.open ? '👗 The wardrobe swings open — gold necklaces, bright gems and gold bars!' : '👗 You closed the wardrobe.', W.open ? 'good' : '');
    return true;
  };
  /** C by the open wardrobe: take the jewellery into your hands. */
  Man.tryCollect = () => {
    const PL = KS.Player, W = Man.wardrobe;
    if (!W || !Man.nearWardrobe(PL) || !W.open || !Man.jewellery.inWardrobe) return false;
    Man.jewellery.inWardrobe = false; Man.jewellery.inHands = true;
    Man.jewels.visible = false; Man.wardrobeLight.intensity = 0;
    if (PL.person && PL.person.armR) { Man.handJewels.position.set(0, -0.5, 0.07); PL.person.armR.add(Man.handJewels); }
    KS.audio && KS.audio.coin && KS.audio.coin();
    KS.Game.notify('💎 You pocketed the jewellery. Get out quietly — and do not let the guard at the gate see it in your hands…', 'good');
    return true;
  };
  /** arrested while carrying the jewellery: it is confiscated. */
  Man.onArrest = () => {
    if (!Man.jewellery.inHands) return;
    Man.jewellery.inHands = false;
    if (Man.handJewels.parent) Man.handJewels.parent.remove(Man.handJewels);
    KS.Game.notify('💎 The police confiscated the stolen jewellery.', 'bad');
  };
  Man.update = (dt) => {
    const M = KS.MANSION; if (!M || !gateBars) return;
    const PL = KS.Player, near = Math.abs(PL.x - (M.x0 + M.x1) / 2) < 140 && Math.abs(PL.z - (M.z0 + M.z1) / 2) < 140;
    const inside = PL.x > M.x0 + 0.5 && PL.x < M.x1 - 0.5 && PL.z > M.z0 + 0.5 && PL.z < M.z1 - 0.5;
    // the gate slides open for ticket holders — and it never traps anyone inside
    const open = (Man.ticket || inside) ? 1 : 0; Man.gateK = KS.lerp(Man.gateK || 0, open, Math.min(1, dt * 1.5)); gateBars.position.x = M.gx + Man.gateK * 8.6; KS.mansionGate.top = Man.gateK > 0.6 ? -1 : 2.8;
    if (Man.light) Man.light.intensity = near ? 1.5 : 0;
    if (Man.light2) Man.light2.intensity = near ? 1.2 : 0;
    // the wardrobe doors swing open and shut, and the jewellery glows inside
    if (Man.wardrobe) {
      const W = Man.wardrobe, target = W.open ? 1 : 0;
      W.doorK += Math.max(-1, Math.min(1, target - W.doorK)) * Math.min(1, dt * 3);
      W.doorL.rotation.y = -W.doorK * 1.9; W.doorR.rotation.y = W.doorK * 1.9;
      const show = W.doorK > 0.3 && Man.jewellery.inWardrobe;
      Man.jewels.visible = show; Man.wardrobeLight.intensity = show ? 1.6 : 0;
    }
    // the jewellery in your hands follows the player's hand (the player model is rebuilt when the outfit changes)
    if (Man.jewellery.inHands && PL.person && PL.person.armR && Man.handJewels.parent !== PL.person.armR) { Man.handJewels.position.set(0, -0.5, 0.07); PL.person.armR.add(Man.handJewels); }
    // got away? far enough from the gate with the jewellery in your hands: a clean getaway pays रु 500
    if (Man.jewellery.inHands && Math.hypot(PL.x - M.gx, PL.z - M.z1) > 100) {
      Man.jewellery.inHands = false; if (Man.handJewels.parent) Man.handJewels.parent.remove(Man.handJewels);
      KS.Game.pay(500, 'You got away with the Thakuri jewellery!'); KS.audio.coin && KS.audio.coin();
      Man.jewelChecked = false;
    }
    // leaving with the jewellery: a guard at the gate may notice it
    if (Man.jewellery.inHands && !Man.jewelChecked && Man.wasInside && !inside) {
      Man.jewelChecked = true;
      const gateNear = guards.some((g) => g.gate && !g.dead && Math.hypot(g.x - PL.x, g.z - PL.z) < 10);
      if (Math.random() < (gateNear ? 0.8 : 0.35)) {
        KS.Game.notify('👮 The guard at the gate spotted the jewellery in your hands! "CHOR! CHOR!"', 'bad');
        KS.audio.whistle && KS.audio.whistle(1);
        Man.cancelTicket('the guard spotted the jewellery in your hands');
        KS.Law && KS.Law.raise(2, 'Jewellery theft at the Thakuri residence');
        for (const g of guards) if (g.gate && !g.dead) { g.fight = 9; g.down = 0; g.p.inner.rotation.x = 0; g.p.inner.position.y = 0; }
      } else KS.Game.notify('👀 You slipped past the gate with the jewellery. Now run — get 100 m away!', 'good');
    }
    Man.wasInside = inside;
    if (!near) { if (drops) drops.visible = false; return; }
    // fountain drops
    drops.visible = true; const F = Man.fountain;
    Man.drops.forEach((d, i) => { d.t += dt; if (d.t > 1.6) d.t -= 1.6; const r = d.t * 1.8 * d.s, y = 1 + 4.2 * d.t - 4.9 * d.t * d.t * 1.6; dropPos[i * 3] = F.x + Math.cos(d.a) * r; dropPos[i * 3 + 1] = Math.max(0.9, y + 1.8); dropPos[i * 3 + 2] = F.z + Math.sin(d.a) * r; });
    drops.geometry.attributes.position.needsUpdate = true;
    // the household: dead, down, fighting, patrolling
    for (const g of guards) {
      if (g.dead) { g.p.root.position.set(g.x, g.y, g.z); continue; }
      if (g.gate && !g.gun && KS.Weapons && KS.Weapons.battleGunMesh) { g.gun = KS.Weapons.battleGunMesh('smg'); if (g.gun) { g.gun.scale.setScalar(1.3); g.gun.position.set(0, -0.6, 0.07); g.p.armR.add(g.gun); } }
      const dx = PL.x - g.x, dz = PL.z - g.z, pd = Math.hypot(dx, dz), sameFloor = Math.abs(PL.y - g.y) < 3;
      if (g.down > 0) {
        g.down -= dt;
        g.p.inner.rotation.x = KS.lerp(g.p.inner.rotation.x, -1.5, Math.min(1, dt * 6)); g.p.inner.position.y = KS.lerp(g.p.inner.position.y, 0.12, Math.min(1, dt * 6));
        if (g.down <= 0) {
          g.p.inner.rotation.x = 0; g.p.inner.position.y = 0;
          if (g.getUpFight && pd < 15 && sameFloor && PL.mode === 'foot') { g.fight = 9; g.getUpFight = false; KS.say(g.p.root, KS.pick(['Ma pani dekhauchhu!', 'Tero ticket cancel!', 'Chor!']), 2, 'angry'); }
          g.getUpFight = false;
        }
        g.p.root.position.set(g.x, g.y, g.z); continue;
      }
      if (g.fight > 0) {
        g.fight -= dt;
        if (pd > 18 || PL.vehicle || !sameFloor || g.fight <= 0) { g.fight = 0; g.p.inner.rotation.x = 0; g.p.inner.position.y = 0; }
        else {
          g.punchT = Math.max(0, g.punchT - dt); g.kickT = Math.max(0, g.kickT - dt);
          if (pd > 1.1) { const sp = 3.2; g.x += (dx / pd) * sp * dt; g.z += (dz / pd) * sp * dt; g.p.root.rotation.y = Math.atan2(dx, dz); KS.animWalk(g.p, dt, sp); }
          if (pd <= 1.1 && g.punchT <= 0) { g.punchT = 1.1; g.punchA = 0; KS.Game.hurt(KS.r(6, 11)); KS.Game.notify('👊 A member of the household punched you!', 'bad'); KS.audio && KS.audio.punch && KS.audio.punch(); }
          else if (pd > 1.1 && pd <= 2.4 && g.kickT <= 0) { g.kickT = 1.6; g.kickA = 0; KS.Game.hurt(KS.r(8, 14)); KS.Game.notify('🦶 A member of the household kicked you!', 'bad'); KS.audio && KS.audio.punch && KS.audio.punch(); }
          if (g.punchA != null) { g.punchA += dt * 4; g.p.busyArm = true; KS.animPunch(g.p, g.punchA); if (g.punchA >= 1) { g.punchA = null; g.p.busyArm = false; } }
          if (g.kickA != null) { g.kickA += dt * 3; KS.animKick(g.p, g.kickA); if (g.kickA >= 1) { g.kickA = null; g.p.legR.rotation.x = 0; g.p.legL.rotation.x = 0; } }
          const cc = KS.collide(g.x, g.z, 0.3, g.y, 1.0); g.x = cc.x; g.z = cc.z;
          g.p.root.position.set(g.x, g.y, g.z); continue;
        }
      }
      // patrol: a loop of waypoints, or a line back and forth along the gate
      if (g.mode === 'line') {
        if (g.wait > 0) { g.wait -= dt; KS.animWalk(g.p, dt, 0); }
        else { const sp = 1.1, tx = g.dir > 0 ? g.x1 : g.x0; g.x += g.dir * sp * dt; g.p.root.rotation.y = g.dir > 0 ? Math.PI / 2 : -Math.PI / 2; KS.animWalk(g.p, dt, sp); if (g.dir > 0 ? g.x >= g.x1 : g.x <= g.x0) { g.x = tx; g.dir = -g.dir; g.wait = KS.r(1, 2); } }
      } else if (g.wait > 0) { g.wait -= dt; KS.animWalk(g.p, dt, 0); g.p.root.rotation.y += Math.sin(KS.clock * 0.7) * dt * 0.4; }
      else { const [tx, tz] = g.loop[g.i], dx2 = tx - g.x, dz2 = tz - g.z, d2 = Math.hypot(dx2, dz2); if (d2 < 0.4) { g.i = (g.i + 1) % g.loop.length; g.wait = KS.r(1.5, 4); } else { const sp = 1.25; g.x += (dx2 / d2) * sp * dt; g.z += (dz2 / d2) * sp * dt; g.p.root.rotation.y = Math.atan2(dx2, dz2); KS.animWalk(g.p, dt, sp); } }
      g.p.root.position.set(g.x, g.y, g.z);
      g.sayT -= dt; const pd2 = Math.hypot(PL.x - g.x, PL.z - g.z);
      if (pd2 < 4 && g.sayT <= 0) { g.sayT = 12; KS.say(g.p.root, KS.pick(Man.ticket ? ['Namaste! Enjoy the tour.', 'Please do not touch the paintings.', 'The pool is open, sir.', 'Welcome to the residence.'] : ['Ticket please! रु 50 at the booth.', 'Sorry, ticket holders only.']), 2.4); }
    }
    // climbed over the wall without a ticket: escorted out — unless the household is already fighting you
    if (inside && !Man.ticket && PL.mode === 'foot' && !guards.some((g) => g.fight > 0)) {
      KS.audio.whistle && KS.audio.whistle(1); PL.x = M.gx + 3; PL.z = M.z1 + 4; PL.y = 0.2; PL.vy = 0; PL.climb = null;
      KS.Game.notify('👮 Security: "No ticket, no entry!" You are walked back to the gate. Tickets (रु 50) at the guard booth.', 'bad');
    }
    if (inside && Man.ticket) for (const st of Man.stops) if (!Man.seen.has(st.id) && (st.y == null || Math.abs(PL.y - st.y) < 2) && Math.hypot(PL.x - st.x, PL.z - st.z) < st.r) {
      Man.seen.add(st.id); KS.Game.notify(`🏛️ You saw ${st.name} (${Man.seen.size}/${Man.stops.length})`, 'good');
      if (Man.seen.size === Man.stops.length) { KS.Game.giveTokens(2, 'Mansion tour complete'); KS.Game.notify('🏆 Tour complete! Thank you for visiting the Sadbhav Thakuri Residence.', 'good'); }
    }
  };

  Pl.update = (dt) => { Pl.updateJharna(dt); Heli.update(dt); Man.update(dt); };
})();
