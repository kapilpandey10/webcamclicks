/* Kathmandu Streets — nature details: wind-swayed grass tufts on lawns, parks, the village and hillsides;
   junkiri (fireflies) that drift and blink over grass and riverbanks at night. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const N = (KS.Nature = {});
  const wind = { value: 0 }; KS.timeUniforms.push(wind);

  function grassTexture() {
    return KS.tex(128, 128, (g, w, h) => {
      g.clearRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = 8 + Math.random() * (w - 16), top = 10 + Math.random() * 50, lean = (Math.random() - 0.5) * 30, bw = 3 + Math.random() * 4;
        const gr = g.createLinearGradient(0, h, 0, top);
        gr.addColorStop(0, '#2f4a1c'); gr.addColorStop(0.6, '#5f8a34'); gr.addColorStop(1, Math.random() < 0.3 ? '#a8b860' : '#7da844');
        g.fillStyle = gr; g.beginPath(); g.moveTo(x - bw, h); g.quadraticCurveTo(x + lean * 0.3, (h + top) / 2, x + lean, top); g.lineTo(x + bw, h); g.closePath(); g.fill();
      }
    });
  }
  let grassMat;
  function material() {
    if (grassMat) return grassMat;
    grassMat = new T.MeshLambertMaterial({ map: grassTexture(), alphaTest: 0.45, side: T.DoubleSide, vertexColors: false });
    grassMat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = wind;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        #ifdef USE_INSTANCING
          vec4 wp = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
        #else
          vec4 wp = vec4(0.0);
        #endif
        float sway = sin(uTime * 1.7 + wp.x * 0.15 + wp.z * 0.11) * 0.5 + sin(uTime * 3.1 + wp.x * 0.4) * 0.2;
        transformed.x += sway * 0.12 * uv.y; transformed.z += sway * 0.07 * uv.y;`);
    };
    return grassMat;
  }
  function tuftGeometry() {
    const pos = [], uv = [], idx = [];
    for (let k = 0; k < 3; k++) {
      const a = (k / 3) * Math.PI, c = Math.cos(a) * 0.32, s = Math.sin(a) * 0.32, b = pos.length / 3;
      pos.push(-c, 0, -s, c, 0, s, c, 0.5, s, -c, 0.5, -s); uv.push(0, 0, 1, 0, 1, 1, 0, 1); idx.push(b, b + 1, b + 2, b, b + 2, b + 3);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new T.Float32BufferAttribute(uv, 2)); g.setIndex(idx);
    g.computeVertexNormals(); const n = g.attributes.normal; for (let i = 0; i < n.count; i++) n.setXYZ(i, 0, 1, 0); // light like the ground
    return g;
  }
  const regions = [];
  /** a rectangle of lawn: x0..x1, z0..z1, density per m², ground y (null = terrain) and keep-out test */
  N.region = (x0, x1, z0, z1, density, y, skip) => regions.push({ x0, x1, z0, z1, density, y, skip });
  N.build = (scene) => {
    const W = KS.World, base = tuftGeometry(), mat = material(), dummy = new T.Object3D(), col = new T.Color();
    const lawn = (c, r, y, inset = 6, dens = 0.32, skip) => { const R = W.blockRect(c, r); N.region(R.x0 + inset, R.x1 - inset, R.z0 + inset, R.z1 - inset, dens, y, skip); };
    for (let c = 0; c < G.N; c++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c, r), R = W.blockRect(c, r), cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2;
      const parkSkip = (x, z) => Math.abs(x - cx) < 2.4 || Math.abs(z - cz) < 2.4 || Math.hypot(x - cx, z - cz) < 7.5 || Math.abs(Math.abs(x - cx) - Math.abs(z - cz)) < 1.6;
      if (t === 'park' || t === 'balaju' || t === 'shankha') lawn(c, r, 0.14, 5.5, 0.3, parkSkip);
      if (t === 'tundikhel' || t === 'tundikhel2') lawn(c, r, 0.14, 6, 0.24, (x, z) => Math.hypot(x - 45, z + 45) < 2);
      if (t === 'garden' || t === 'palace' || t === 'singha') lawn(c, r, 0.13, 6, 0.18, (x, z) => KS.solidsNear(x, z, 0.3, []).some((s) => s.top > 0.5));
    }
    const v = KS.HW.village;
    N.region(v.x - 260, v.x + 240, KS.HW.z - 220, KS.HW.z - 40, 0.035, null);
    N.region(v.x - 260, v.x + 240, KS.HW.z + 40, KS.HW.z + 240, 0.035, null);
    const sw = KS.SWAYAMBHU; N.region(sw.x - 140, sw.x + 140, sw.z - 140, sw.z + 140, 0.03, null, (x, z) => Math.hypot(x - sw.x, z - sw.z) < 32 || Math.abs(z - sw.z) < 9);
    // riverbanks and outskirts meadows
    N.region(-900, 900, KS.RIVER.z1 + 26, KS.RIVER.z1 + 60, 0.03, null);
    // reeds and grass along both banks, down to the waterline
    for (let x = -1400; x < 1400; x += 200) { N.region(x, x + 200, KS.RIVER.z0 - 6, KS.RIVER.z0 + 14, 0.09, null); N.region(x, x + 200, KS.RIVER.z1 - 14, KS.RIVER.z1 + 6, 0.09, null); }
    for (let i = 0; i < 40; i++) { const a = KS.r(0, Math.PI * 2), d = KS.r(620, 820), x = Math.cos(a) * d, z = Math.sin(a) * d; if (x > 560 && x < 840 && Math.abs(z) < 420) continue; if (z > KS.RIVER.z0 - 20 && z < KS.RIVER.z1 + 20) continue; N.region(x - 20, x + 20, z - 20, z + 20, 0.12, null); }
    let total = 0;
    for (const R of regions) {
      const count = Math.min(5000, Math.round((R.x1 - R.x0) * (R.z1 - R.z0) * R.density * (KS.quality.level === 'high' ? 1 : 0.4)));
      if (count < 4) continue;
      const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, geo = base.clone();
      geo.boundingSphere = new T.Sphere(new T.Vector3(0, 0, 0), Math.hypot(R.x1 - R.x0, R.z1 - R.z0) / 2 + 2);
      const m = new T.InstancedMesh(geo, mat, count); let n = 0;
      for (let i = 0; i < count * 1.3 && n < count; i++) {
        const x = KS.r(R.x0, R.x1), z = KS.r(R.z0, R.z1);
        if (R.skip && R.skip(x, z)) continue;
        if (KS.HW && x < -540 && Math.abs(z - KS.HW.z) < 26) continue;
        const y = R.y != null ? R.y : KS.heightAt(x, z);
        if (y < -0.4) continue;
        const s = KS.r(0.7, 1.5);
        dummy.position.set(x - cx, y - 0.02, z - cz); dummy.rotation.set(0, KS.r(0, 6.3), 0); dummy.scale.set(s, s * KS.r(0.8, 1.4), s); dummy.updateMatrix();
        m.setMatrixAt(n, dummy.matrix); m.setColorAt(n, col.setHSL(KS.r(0.2, 0.28), KS.r(0.35, 0.6), KS.r(0.5, 0.75))); n++;
      }
      if (!n) continue;
      m.count = n; m.position.set(cx, 0, cz); m.receiveShadow = true; scene.add(m); total += n;
    }
    KS.grassCount = total;
    fireflies(scene); Skid.init(scene);
  };

  /* ---------- junkiri: fireflies ---------- */
  function fireflies(scene) {
    const spots = [];
    for (const R of regions) { const n = Math.min(60, Math.round((R.x1 - R.x0) * (R.z1 - R.z0) * 0.004)); for (let i = 0; i < n; i++) spots.push([KS.r(R.x0, R.x1), KS.r(R.z0, R.z1), R.y]); }
    for (let i = 0; i < 160; i++) spots.push([KS.r(-1200, 1200), KS.RIVER.z0 - KS.r(4, 14), 0]);
    const n = spots.length, pos = new Float32Array(n * 3), ph = new Float32Array(n);
    spots.forEach(([x, z, y], i) => { pos[i * 3] = x; pos[i * 3 + 1] = (y != null ? y : KS.heightAt(x, z)) + KS.r(0.4, 2.2); pos[i * 3 + 2] = z; ph[i] = KS.r(0, 100); });
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('phase', new T.BufferAttribute(ph, 1));
    N.ffU = { uTime: wind, uNight: { value: 0 }, uScale: { value: innerHeight / 2 } };
    const m = new T.ShaderMaterial({
      uniforms: N.ffU, transparent: true, depthWrite: false, blending: T.AdditiveBlending,
      vertexShader: `attribute float phase; uniform float uTime; uniform float uScale; varying float vA;
        void main(){ vec3 p = position; float t = uTime * 0.35 + phase;
          p.x += sin(t * 1.3) * 1.6 + sin(t * 3.7) * 0.3; p.y += sin(t * 2.1) * 0.5; p.z += cos(t * 1.1) * 1.6;
          vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
          vA = pow(max(0.0, sin(uTime * 2.2 + phase * 3.0)), 3.0);
          gl_PointSize = clamp(uScale * 0.12 / -mv.z, 1.5, 9.0); }`,
      fragmentShader: `uniform float uNight; varying float vA;
        void main(){ float d = length(gl_PointCoord - 0.5); float a = smoothstep(0.5, 0.0, d);
          gl_FragColor = vec4(0.85, 1.0, 0.35, a * vA * uNight); }`,
    });
    const pts = new T.Points(g, m); pts.frustumCulled = false; scene.add(pts); N.fireflies = pts;
  }
  /* skid marks: a ring buffer of dark streaks on the road */
  const Skid = (KS.Skid = { n: 400, i: 0, last: {} });
  Skid.init = (scene) => {
    const g = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    Skid.mesh = new T.InstancedMesh(g, new T.MeshBasicMaterial({ color: 0x111111, transparent: true, opacity: 0.55, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -7 }), Skid.n);
    const m = new T.Matrix4().makeScale(0, 0, 0); for (let k = 0; k < Skid.n; k++) Skid.mesh.setMatrixAt(k, m);
    Skid.mesh.frustumCulled = false; scene.add(Skid.mesh); Skid.d = new T.Object3D();
  };
  Skid.add = (x, z, h, w) => {
    if (!Skid.mesh) return;
    const d = Skid.d, y = KS.heightAt(x, z) + 0.07, ox = Math.cos(h) * w * 0.42, oz = -Math.sin(h) * w * 0.42;
    for (const s2 of [-1, 1]) { d.position.set(x + ox * s2, y, z + oz * s2); d.rotation.set(0, h, 0); d.scale.set(0.22, 1, 0.9); d.updateMatrix(); Skid.mesh.setMatrixAt(Skid.i, d.matrix); Skid.i = (Skid.i + 1) % Skid.n; }
    Skid.mesh.instanceMatrix.needsUpdate = true;
  };
  N.update = () => {
    if (!N.ffU) return;
    const nightOK = KS.night > 0.55 && KS.Weather.cur.rain < 0.3 && KS.Weather.cur.fogMix < 0.5;
    N.ffU.uNight.value += ((nightOK ? 1 : 0) - N.ffU.uNight.value) * 0.02;
    N.fireflies.visible = N.ffU.uNight.value > 0.01;
  };
})();
