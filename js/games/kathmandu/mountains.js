/* Kathmandu Streets — the mountains: the snow peak (Shivapuri) with skiing,
   the paragliding hill, the trekking path with its trekkers and camp, the
   snow stream running down to the Bagmati, Himalayan trees and black rocks. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const M = (KS.Mountains = { skiPrice: 150, paraPrice: 150, chiyaPrice: 50 });
  const U = { uTime: { value: 0 } };
  let snowPts = null, snowVel = null;

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
  function signBoard(scene, text, sub, x, y, z, ry, w = 4.6, h = 1.6, bg = '#1b5e20') {
    const s = new T.Mesh(new T.PlaneGeometry(w, h), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(512, 176, (g, ww, hh) => { g.fillStyle = bg; g.fillRect(0, 0, ww, hh); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, ww - 16, hh - 16); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 56px ${KS.FONT}`; g.fillText(text, ww / 2, 72); g.font = '700 34px "Barlow Condensed", sans-serif'; g.fillText(sub, ww / 2, 134, ww - 30); }) }));
    s.position.set(x, y, z); s.rotation.y = ry; scene.add(s); return s;
  }

  /* ======================= the two mountain roads ======================= */
  function buildRoads(scene) {
    const snow = KS.MOUNTAIN_PATHS.find((p) => p.id === 'snowroad'), para = KS.MOUNTAIN_PATHS.find((p) => p.id === 'pararoad');
    const roadMat = new T.MeshLambertMaterial({ color: 0x55565a, polygonOffset: true, polygonOffsetFactor: -2 });
    scene.add(ribbon(snow, 7, 0.06, roadMat));
    scene.add(ribbon(para, 7, 0.06, roadMat));
    const b = new KS.Builder();
    const s1 = snow.pts[0], s2 = para.pts[0];
    signBoard(scene, 'शिवपुरी हिमाल', 'SHIVAPURI SNOW PEAK →', s1[0] + 5, 2.6, s1[1] - 6, 0.15);
    b.box(s1[0] + 5, 0, s1[1] - 6, 0.15, 2, 0.15, 0x666666);
    signBoard(scene, 'प्याराग्लाइडिङ', 'PARAGLIDING HILL →', s2[0] + 2, 2.6, s2[1] + 6, -0.4);
    b.box(s2[0] + 2, 0, s2[1] + 6, 0.15, 2, 0.15, 0x666666);
    scene.add(KS.mesh(b));
    // a small bridge where the snow stream crosses the snow road, and where the
    // stream meets the Bagmati the water joins the river
    const st = KS.MOUNTAIN_PATHS.find((p) => p.id === 'snowstream');
    const bx = -300, bz = -800, by = KS.heightAt(bx, bz) + 1.1;
    const e = new KS.Builder();
    e.box(bx, by - 0.2, bz, 2.4, 0.2, 8, 0x7a5432); for (const sd of [-1, 1]) e.box(bx + sd * 1.15, by, bz, 0.08, 1, 8, 0x5a3a22);
    scene.add(KS.mesh(e));
    KS.addBox(bx, bz, 2.4, 8, by);
    KS.landmarks.push({ id: 'shivapuri', name: 'Shivapuri Snow Peak', np: 'शिवपुरी हिमाल', x: KS.SNOWPEAK.x, z: KS.SNOWPEAK.z, r: 60, fact: 'The snowy summit north of the city. Drive up the mountain road, hire a snowboard for रु 150, and ride the south face down.' });
    KS.landmarks.push({ minor: true, id: 'parahill', name: 'Paragliding Hill', np: 'प्याराग्लाइडिङ डाँडा', x: KS.PARAGLIDE.x, z: KS.PARAGLIDE.z, r: 40, fact: 'Pay रु 150 at the office, take the paraglider, and glide down to the valley.' });
  }

  /* ======================= the ski area on the snow peak ======================= */
  function buildSki(scene) {
    const P = KS.SNOWPEAK, hx = P.x, hz = P.z + 25, hy = KS.heightAt(hx, hz);
    M.skiHire = { x: hx, z: hz }; M.skiTop = { x: P.x, z: P.z + 10 };
    const b = new KS.Builder();
    // the hire hut: a wooden chalet with a snow-covered roof
    b.box(hx, hy, hz, 5, 3, 4, 0x7a5432); b.roof(hx, hy + 3, hz, 6, 1.6, 0xf4f6f8, 0.3);
    b.box(hx, hy + 1.1, hz + 2.02, 1.2, 1.8, 0.05, 0x2a2a2a); // the door, facing the road
    KS.addBox(hx, hz, 5, 4, hy + 3.2);
    // the tea house next door: hot chiya and momo for cold skiers
    const tx = hx + 12, tz = hz + 2, ty = KS.heightAt(tx, tz);
    M.teaHouse = { x: tx, z: tz };
    b.box(tx, ty, tz, 6, 3, 4.5, 0x8a6a3a); b.roof(tx, ty + 3, tz, 7, 1.6, 0xc8102e, 0.3);
    b.box(tx, ty + 1.1, tz + 2.27, 1.4, 1.8, 0.05, 0x2a2a2a); KS.addBox(tx, tz, 6, 4.5, ty + 3.2);
    for (let k = 0; k < 3; k++) { const x = tx - 6 + k * 3, z = tz + 5, y = KS.heightAt(x, z); b.box(x, y, z, 2, 0.45, 0.5, 0x7a5432); KS.sitSpots.push([x, z, y + 0.45, KS.pick(['tourist', 'trekker', 'man', 'woman'])]); }
    scene.add(KS.mesh(b));
    signBoard(scene, '⛷️ स्की भाडा', 'SKI & SNOWBOARD HIRE · रु 150', hx, hy + 4.6, hz + 2.1, 0, 5.2, 1.8, '#1d3a8a');
    signBoard(scene, '☕ चिया घर', 'TEA HOUSE · HOT CHIYA · रु 50', tx, ty + 4.6, tz + 2.3, 0, 5.2, 1.8, '#7a1f1f');
    // the ski run: a groomed slope down the south face, marked with slalom flags
    const run = [[P.x, P.z + 10], [P.x - 4, P.z + 120], [P.x + 6, P.z + 180], [P.x - 2, P.z + 240]];
    M.skiRun = run;
    const f = new KS.Builder();
    for (let k = 0; k < run.length - 1; k++) {
      const [ax, az] = run[k], [bx, bz] = run[k + 1], L = Math.hypot(bx - ax, bz - az), n = Math.ceil(L / 22);
      for (let i = 0; i <= n; i++) {
        const t = i / n, x = ax + (bx - ax) * t, z = az + (bz - az) * t, y = KS.heightAt(x, z);
        for (const s of [-1, 1]) { f.cyl(x + s * 7, y, z, 0.04, 2.2, 0xdddddd, 4); f.box(x + s * 7, y + 2, z, 0.5, 0.35, 0.02, (i + (s > 0 ? 1 : 0)) % 2 ? 0xc8102e : 0x1d4fb8); }
      }
    }
    scene.add(KS.mesh(f));
    // snowfall over the peak: white points falling, looping back to the top
    const N = 600, pos = new Float32Array(N * 3); snowVel = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = P.x + KS.r(-300, 300); pos[i * 3 + 1] = KS.heightAt(P.x, P.z) + KS.r(0, 140); pos[i * 3 + 2] = P.z + KS.r(-300, 300);
      snowVel[i] = KS.r(1.5, 3.5);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3));
    snowPts = new T.Points(g, new T.PointsMaterial({ color: 0xffffff, size: 0.55, transparent: true, opacity: 0.9 }));
    snowPts.frustumCulled = false; scene.add(snowPts);
    // a temperature sign at the top, so you can see how cold it is up here
    const temp = KS.temperatureAt(P.x, P.z);
    signBoard(scene, `🌡️ ${temp}°C`, `SHIVAPURI ${Math.round(KS.heightAt(P.x, P.z))} m · हिमाल`, P.x + 6, KS.heightAt(P.x + 6, P.z + 6) + 2.6, P.z + 6, -0.5, 4.6, 1.6, '#1d3a8a');
  }

  /* ======================= the paragliding hill ======================= */
  function buildParaglide(scene) {
    const P = KS.PARAGLIDE, hx = P.x, hz = P.z, hy = KS.heightAt(hx, hz);
    M.paraOffice = { x: hx + 14, z: hz + 8 }; M.paraTakeoff = { x: hx, z: hz };
    const b = new KS.Builder();
    // the paragliding office: a hut with a windsock, at the top of the hill
    const ox = hx + 14, oz = hz + 8, oy = KS.heightAt(ox, oz);
    b.box(ox, oy, oz, 4.5, 2.8, 3.5, 0x2a6a8a); b.roof(ox, oy + 2.8, oz, 5.4, 1.4, 0xe86412, 0.3);
    b.box(ox, oy + 1, oz + 1.77, 1.1, 1.7, 0.05, 0x2a2a2a); KS.addBox(ox, oz, 4.5, 3.5, oy + 3);
    b.cyl(ox + 3.5, oy, oz - 2, 0.05, 4.5, 0x999999, 6);
    // a small shop at the top: snacks and a warm drink before you fly
    const sx = hx - 12, sz = hz + 10, sy = KS.heightAt(sx, sz);
    b.box(sx, sy, sz, 4, 2.6, 3, 0x8a6a3a); b.roof(sx, sy + 2.6, sz, 4.8, 1.2, 0x1f8a4c, 0.3); KS.addBox(sx, sz, 4, 3, sy + 2.8);
    scene.add(KS.mesh(b));
    const wind = new T.Mesh(new T.ConeGeometry(0.3, 1.4, 8, 1, true).rotateZ(Math.PI / 2), new T.MeshLambertMaterial({ color: 0xff7a00, side: T.DoubleSide }));
    wind.position.set(ox + 3.5, oy + 4.4, oz - 2); scene.add(wind); M.paraSock = wind;
    signBoard(scene, '🪂 प्याराग्लाइडिङ', 'PARAGLIDING · रु 150 · FLY TO THE VALLEY', ox, oy + 4.2, oz + 1.8, 0, 5.2, 1.8, '#0a8a9a');
    signBoard(scene, '🛍️ पसल', 'HILL SHOP · SNACKS & CHIYA', sx, sy + 3.8, sz + 1.6, 0, 4.2, 1.4, '#7a1f1f');
    // the takeoff: a flat grassy ramp facing the valley, with a windsock
    const t = new KS.Builder();
    t.box(hx, hy - 0.1, hz + 6, 10, 0.3, 14, 0x6a8a4a);
    scene.add(KS.mesh(t));
  }

  /* ======================= trekking: the camp and the prayer flags ======================= */
  function buildTrek(scene) {
    const trek = KS.MOUNTAIN_PATHS.find((p) => p.id === 'trek');
    const cx = -370, cz = -1000, cy = KS.heightAt(cx, cz);
    M.camp = { x: cx, z: cz };
    const b = new KS.Builder();
    // three tents: a triangle of canvas on poles, with a campfire between them
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI * 2, x = cx + Math.cos(a) * 7, z = cz + Math.sin(a) * 7, y = KS.heightAt(x, z);
      b.box(x, y, z, 2.4, 0.06, 2, 0x3a3a3a);
      const roof = new T.Mesh(new T.ConeGeometry(1.7, 1.5, 4), new T.MeshLambertMaterial({ color: [0xc81e1e, 0x1d4fb8, 0xe86412][k] }));
      roof.position.set(x, y + 0.8, z); roof.rotation.y = Math.PI / 4 + a; scene.add(roof);
      b.box(x, y + 0.5, z + 1.1, 0.7, 1, 0.05, 0x222222);
      KS.addBox(x, z, 2.4, 2, y + 1.4);
    }
    // the campfire: stones, logs, and a fire that glows after dark
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; b.cyl(cx + Math.cos(a) * 0.9, cy, cz + Math.sin(a) * 0.9, 0.18, 0.25, 0x777777, 6); }
    b.box(cx - 0.4, cy + 0.15, cz, 0.12, 0.12, 1.2, 0x5a3a22); b.box(cx + 0.4, cy + 0.15, cz, 0.12, 0.12, 1.2, 0x5a3a22);
    const fire = new T.Mesh(new T.ConeGeometry(0.45, 1.1, 8), new T.MeshBasicMaterial({ color: 0xff7a1a }));
    fire.position.set(cx, cy + 0.6, cz); scene.add(fire); M.campFire = fire;
    M.campLight = new T.PointLight(0xff8a2a, 0, 18, 1.6); M.campLight.position.set(cx, cy + 1.2, cz); scene.add(M.campLight);
    scene.add(KS.mesh(b));
    // Himalayan dhoja (prayer flags) along the trekking path and at the summit
    for (let k = 0; k < trek.pts.length - 1; k++) {
      const [ax, az] = trek.pts[k], [bx, bz] = trek.pts[k + 1];
      KS.World.flags([ax, KS.heightAt(ax, az) + 3.2, az], [bx, KS.heightAt(bx, bz) + 3.2, bz], 1.6, 1.1);
    }
    const P = KS.SNOWPEAK;
    KS.World.flags([P.x - 8, KS.heightAt(P.x - 8, P.z) + 3, P.z], [P.x + 8, KS.heightAt(P.x + 8, P.z) + 3, P.z], 1.2, 0.9);
    KS.World.flags([P.x, KS.heightAt(P.x, P.z) + 3, P.z - 8], [P.x, KS.heightAt(P.x, P.z) + 3, P.z + 8], 1.2, 0.9);
    KS.landmarks.push({ minor: true, id: 'trekcamp', name: 'Trekking Camp', np: 'ट्रेकिङ क्याम्प', x: cx, z: cz, r: 12, fact: 'A camp on the trekking path to Shivapuri: three tents, a campfire, and prayer flags all the way to the summit.' });
  }

  /* ======================= the snow stream, down to the Bagmati ======================= */
  function buildStream(scene) {
    const st = KS.MOUNTAIN_PATHS.find((p) => p.id === 'snowstream');
    scene.add(ribbon(st, 4.2, 0.15, streamMat()));
    // rocks along the banks, like the Jharna stream
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0xffffff }), 160), d = new T.Object3D(), c = new T.Color(); let n = 0;
    for (let k = 0; k < 160; k++) {
      const seg = Math.floor(KS.r(0, st.pts.length - 1)), t = KS.r(0, 1), [ax, az, ah] = st.pts[seg], [bx, bz, bh] = st.pts[seg + 1];
      const L = Math.hypot(bx - ax, bz - az), nx = -(bz - az) / L, nz = (bx - ax) / L, side = (KS.chance(0.5) ? 1 : -1) * KS.r(2.6, 5);
      const x = ax + (bx - ax) * t + nx * side, z = az + (bz - az) * t + nz * side;
      d.position.set(x, KS.heightAt(x, z) - 0.2, z); d.rotation.set(KS.r(0, 3), KS.r(0, 3), KS.r(0, 3));
      const s = KS.r(0.3, 1.2); d.scale.set(s * KS.r(0.9, 1.5), s * KS.r(0.6, 1), s); d.updateMatrix();
      rocks.setMatrixAt(n, d.matrix); rocks.setColorAt(n, c.setHSL(KS.r(0.08, 0.14), KS.r(0.05, 0.18), KS.r(0.3, 0.5))); n++;
    }
    rocks.count = n; rocks.castShadow = KS.quality.shadows; scene.add(rocks);
  }

  /* ======================= Himalayan trees and black mountain rocks ======================= */
  function buildNature(scene) {
    const P = KS.SNOWPEAK;
    const clear = (x, z) => { for (const p of KS.MOUNTAIN_PATHS) if (KS.pathNear(p, x, z).d < p.w + 3) return false; return true; };
    // conifers: a trunk and stacked cones, the top one dusted with snow
    const tb = new KS.Builder();
    tb.cyl(0, 0, 0, 0.22, 3, 0x4a3524, 6, 0.7);
    tb.cyl(0, 2.5, 0, 2.2, 4.5, 0x1f4a22, 8, 0); tb.cyl(0, 5, 0, 1.6, 3.5, 0x26582a, 8, 0); tb.cyl(0, 7.2, 0, 1.0, 2.5, 0xf4f6f8, 8, 0);
    const trees = new T.InstancedMesh(tb.build(), KS.M.vc, 260), d = new T.Object3D(); let tn = 0;
    for (let k = 0; k < 1200 && tn < 260; k++) {
      const a = KS.r(0, Math.PI * 2), r = KS.r(60, 480), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, h = KS.heightAt(x, z);
      if (h < 110 || h > KS.SNOWLINE + 20 || !clear(x, z)) continue;
      const s = KS.r(0.8, 1.5); d.position.set(x, h - 0.2, z); d.rotation.set(0, KS.r(0, 6.3), 0); d.scale.set(s, s * KS.r(0.9, 1.25), s); d.updateMatrix();
      trees.setMatrixAt(tn++, d.matrix);
      if (KS.chance(0.35)) KS.addCircle(x, z, 0.35 * s, h + 7);
    }
    trees.count = tn; trees.castShadow = KS.quality.shadows; scene.add(trees);
    // black mountain rocks on the upper slopes
    const rocks = new T.InstancedMesh(new T.DodecahedronGeometry(1, 0), new T.MeshLambertMaterial({ color: 0xffffff }), 140), c = new T.Color(); let rn = 0;
    for (let k = 0; k < 500 && rn < 140; k++) {
      const a = KS.r(0, Math.PI * 2), r = KS.r(40, 380), x = P.x + Math.cos(a) * r, z = P.z + Math.sin(a) * r, h = KS.heightAt(x, z);
      if (h < 190 || !clear(x, z)) continue;
      const s = KS.r(0.8, 3.2); d.position.set(x, h - s * 0.25, z); d.rotation.set(KS.r(0, 3), KS.r(0, 3), KS.r(0, 3)); d.scale.set(s * KS.r(0.9, 1.6), s * KS.r(0.5, 0.9), s); d.updateMatrix();
      rocks.setMatrixAt(rn, d.matrix); rocks.setColorAt(rn, c.setHSL(0.6, KS.r(0.02, 0.08), KS.r(0.08, 0.18))); rn++;
    }
    rocks.count = rn; rocks.castShadow = KS.quality.shadows; scene.add(rocks);
    // monkeys on the mountain roads, and a few more trees along the paragliding road
    KS.monkeySpots.push([-260, -1080, 16, null], [-430, -1220, 14, null], [-950, 230, 16, null]);
    const pb = new KS.Builder();
    pb.cyl(0, 0, 0, 0.28, 9, 0x4a3524, 6, 0.6); pb.sphere(0, 10, 0, 3.4, 0x2f5a22, 0.9, 8); pb.sphere(1.2, 8.6, 0.6, 2.4, 0x3a6a2a, 0.9, 7);
    const pt = new T.InstancedMesh(pb.build(), KS.M.vc, 60); let pn = 0;
    for (let k = 0; k < 300 && pn < 60; k++) {
      const x = KS.r(-1250, -550), z = KS.r(120, 380), h = KS.heightAt(x, z);
      if (h < 20 || !clear(x, z)) continue;
      const s = KS.r(0.7, 1.2); d.position.set(x, h - 0.3, z); d.rotation.set(0, KS.r(0, 6.3), 0); d.scale.set(s, s, s); d.updateMatrix(); pt.setMatrixAt(pn++, d.matrix);
    }
    pt.count = pn; pt.castShadow = KS.quality.shadows; scene.add(pt);
  }

  M.build = (scene) => {
    KS.reseed(77);
    buildRoads(scene); buildSki(scene); buildParaglide(scene); buildTrek(scene); buildStream(scene); buildNature(scene);
  };
  M.update = (dt) => {
    U.uTime.value = KS.clock;
    if (M.paraSock) M.paraSock.rotation.y = Math.sin(KS.clock * 0.3) * 0.6;
    if (M.campFire) { const s = 1 + Math.sin(KS.clock * 7) * 0.12; M.campFire.scale.set(s, 1 + Math.sin(KS.clock * 9) * 0.15, s); }
    if (M.campLight) M.campLight.intensity = (KS.time < 6 || KS.time > 18) ? 1.4 + Math.sin(KS.clock * 7) * 0.3 : 0;
    if (snowPts) {
      const pos = snowPts.geometry.attributes.position, P = KS.SNOWPEAK;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) - snowVel[i] * dt;
        if (y < KS.heightAt(pos.getX(i), pos.getZ(i))) { y = KS.heightAt(P.x, P.z) + KS.r(0, 140); pos.setX(i, P.x + KS.r(-300, 300)); pos.setZ(i, P.z + KS.r(-300, 300)); }
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  };
})();
