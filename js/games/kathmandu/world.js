/* Kathmandu Streets — city generation: terrain, river, roads, buildings, shops, wires, trees, mountains. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G, P = KS.palette;
  const W = (KS.World = {});
  KS.nightMats = [];      // materials whose emissiveIntensity follows night
  KS.lampMats = [];       // basic materials that glow at night
  KS.timeUniforms = [];   // { value } uniforms fed with elapsed time
  const SW = 4;           // sidewalk width
  const FLOOR = 3.0;

  W.blockRect = (c, r) => ({
    x0: G.line(c) + G.roadHalf(c), x1: G.line(c + 1) - G.roadHalf(c + 1),
    z0: G.line(r) + G.roadHalf(r), z1: G.line(r + 1) - G.roadHalf(r + 1),
  });

  /* chunked static builders so far-away props get frustum culled */
  const chunks = new Map();
  W.chunk = (x, z, kind = 'vc') => {
    const k = kind + ':' + Math.floor((x + 1400) / 270) + ',' + Math.floor((z + 1400) / 270);
    let b = chunks.get(k); if (!b) chunks.set(k, (b = new KS.Builder())); b.kind = kind; return b;
  };
  W.flushChunks = (scene) => {
    for (const [, b] of chunks) if (!b.empty) scene.add(KS.mesh(b, b.kind === 'dbl' ? KS.M.vcDouble : KS.M.vc, true));
    chunks.clear();
  };

  /* ================= textures ================= */
  function noiseFill(g, w, h, base, amt, n = 1500) {
    g.fillStyle = base; g.fillRect(0, 0, w, h);
    for (let i = 0; i < n; i++) {
      const v = Math.floor(KS.r(-amt, amt));
      g.fillStyle = v > 0 ? `rgba(255,255,255,${v / 255})` : `rgba(0,0,0,${-v / 255})`;
      g.fillRect(KS.r(0, w), KS.r(0, h), KS.r(1, 3), KS.r(1, 3));
    }
  }
  function roadTex(ring) {
    return KS.tex(128, 256, (g, w, h) => {
      noiseFill(g, w, h, '#4a4a4c', 28, 2600);
      // worn edges, dust at the kerb
      const grd = g.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, 'rgba(160,140,110,0.55)'); grd.addColorStop(0.08, 'rgba(160,140,110,0)');
      grd.addColorStop(0.92, 'rgba(160,140,110,0)'); grd.addColorStop(1, 'rgba(160,140,110,0.55)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(235,235,225,0.75)';
      g.fillRect(w * 0.06, 0, 3, h); g.fillRect(w * 0.94 - 3, 0, 3, h);
      if (ring) {
        g.fillStyle = 'rgba(240,200,40,0.9)'; g.fillRect(w / 2 - 5, 0, 3, h); g.fillRect(w / 2 + 2, 0, 3, h);
        g.fillStyle = 'rgba(235,235,225,0.8)';
        for (let y = 0; y < h; y += 64) { g.fillRect(w * 0.27, y, 3, 32); g.fillRect(w * 0.73, y, 3, 32); }
      } else {
        g.fillStyle = 'rgba(235,235,225,0.8)';
        for (let y = 0; y < h; y += 64) g.fillRect(w / 2 - 2, y, 4, 34);
      }
      // patches & cracks
      for (let i = 0; i < 8; i++) { g.fillStyle = `rgba(20,20,20,${KS.r(0.1, 0.3)})`; g.beginPath(); g.ellipse(KS.r(10, w - 10), KS.r(0, h), KS.r(4, 14), KS.r(3, 10), KS.r(0, 3), 0, 7); g.fill(); }
    }, true);
  }

  /* facade atlas: 12 window columns x 16 floors; per-instance UV offsets pick different areas */
  function facade(style, lit) {
    const rng = (function (s) { return function () { s = (s * 16807) % 2147483647; return s / 2147483647; }; })(style * 977 + 13);
    const cols = 12, rows = 16, S = 1024, cw = S / cols, ch = S / rows;
    return KS.tex(S, S, (g) => {
      if (lit) { g.fillStyle = '#000'; g.fillRect(0, 0, S, S); }
      else if (style === 2) { // Newari brick
        g.fillStyle = '#b5583c'; g.fillRect(0, 0, S, S);
        for (let y = 0; y < S; y += 8) for (let x = (y / 8) % 2 ? -10 : 0; x < S; x += 20) {
          const t = 150 + Math.floor(rng() * 50);
          g.fillStyle = `rgb(${t + 30},${t * 0.45},${t * 0.3})`; g.fillRect(x + 1, y + 1, 18, 6);
        }
      } else { noiseFill(g, S, S, '#f4f2ee', 14, 9000); }
      for (let r = 0; r < rows; r++) {
        if (!lit && style !== 2) { g.fillStyle = 'rgba(0,0,0,0.13)'; g.fillRect(0, r * ch + ch - 6, S, 6); g.fillStyle = 'rgba(0,0,0,0.05)'; g.fillRect(0, r * ch, S, 3); }
        if (!lit && style === 2) { g.fillStyle = '#6b2f1f'; g.fillRect(0, r * ch + ch - 5, S, 5); }
        for (let c = 0; c < cols; c++) {
          const kind = rng(), on = rng() < 0.34, warm = rng() < 0.55, x = c * cw, y = r * ch;
          let wx, wy, ww, wh;
          if (style === 2) { ww = cw * 0.46; wh = ch * 0.58; wx = x + (cw - ww) / 2; wy = y + ch * 0.2; }
          else if (kind < 0.12) { continue; }
          else if (kind < 0.35) { ww = cw * 0.72; wh = ch * 0.5; wx = x + (cw - ww) / 2; wy = y + ch * 0.18; }
          else if (kind < 0.5) { ww = cw * 0.36; wh = ch * 0.72; wx = x + (cw - ww) / 2; wy = y + ch * 0.12; }
          else { ww = cw * 0.5; wh = ch * 0.52; wx = x + (cw - ww) / 2; wy = y + ch * 0.18; }
          if (lit) {
            if (!on) continue;
            g.fillStyle = warm ? '#ffc56b' : '#e8f2ff'; g.fillRect(wx + 3, wy + 3, ww - 6, wh - 6);
            g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(wx + 3, wy + 3, (ww - 6) * rng() * 0.5, wh - 6);
            continue;
          }
          if (style === 2) { // carved wooden window
            g.fillStyle = '#3b2414'; g.fillRect(wx - 6, wy - 8, ww + 12, wh + 14);
            g.fillStyle = '#5a3a22'; g.fillRect(wx - 10, wy - 12, ww + 20, 6);
            g.fillStyle = '#1d120a'; g.fillRect(wx, wy, ww, wh);
            g.strokeStyle = '#6e4a2b'; g.lineWidth = 2;
            for (let i = -wh; i < ww; i += 7) { g.beginPath(); g.moveTo(wx + i, wy); g.lineTo(wx + i + wh, wy + wh); g.moveTo(wx + i + wh, wy); g.lineTo(wx + i, wy + wh); g.stroke(); }
            g.strokeStyle = '#3b2414'; g.lineWidth = 3; g.strokeRect(wx, wy, ww, wh);
          } else {
            g.fillStyle = style === 1 ? '#c9cdd0' : '#e2ddd4'; g.fillRect(wx - 4, wy - 4, ww + 8, wh + 10);
            const gl = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
            if (style === 1) { gl.addColorStop(0, '#5c8e8c'); gl.addColorStop(1, '#2b4b4f'); } else { gl.addColorStop(0, '#4a6378'); gl.addColorStop(1, '#1e2b38'); }
            g.fillStyle = gl; g.fillRect(wx, wy, ww, wh);
            g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(wx + 2, wy + 2, ww * 0.3, wh - 4);
            if (style === 0) { g.fillStyle = '#3a3a3a'; for (let i = 1; i < 5; i++) g.fillRect(wx + (ww * i) / 5, wy, 2, wh); }
            else { g.fillStyle = '#9aa'; g.fillRect(wx + ww / 2 - 1, wy, 2, wh); }
            if (rng() < 0.35) { g.fillStyle = KS.pick(['#d33', '#36c', '#ea3', '#3a6', '#c3c']); g.fillRect(wx + 2, wy + 2, ww * 0.35, wh - 4); } // curtain
          }
        }
      }
    }, true);
  }
  function shopTex(kind) {
    return KS.tex(256, 128, (g, w, h) => {
      if (kind === 0 || kind === 4) { // open shop with goods
        g.fillStyle = kind === 4 ? '#3a2a1a' : '#2a2420'; g.fillRect(0, 0, w, h);
        for (let s = 0; s < 4; s++) {
          g.fillStyle = '#6b5236'; g.fillRect(6, 20 + s * 26, w - 12, 3);
          for (let x = 8; x < w - 10; x += KS.r(6, 12)) { g.fillStyle = `hsl(${KS.r(0, 360)},${KS.r(40, 85)}%,${KS.r(35, 65)}%)`; g.fillRect(x, 20 + s * 26 - KS.r(8, 18), KS.r(4, 9), KS.r(8, 18)); }
        }
        if (kind === 4) { g.fillStyle = 'rgba(255,210,120,0.25)'; g.fillRect(0, 0, w, h); }
        g.fillStyle = '#777'; g.fillRect(0, 0, w, 8);
      } else if (kind === 1) { // shutter down
        g.fillStyle = KS.pick(['#8b9096', '#6d7f8f', '#5d7a6a', '#857766']); g.fillRect(0, 0, w, h);
        for (let y = 0; y < h; y += 5) { g.fillStyle = 'rgba(0,0,0,0.22)'; g.fillRect(0, y, w, 1); g.fillStyle = 'rgba(255,255,255,0.12)'; g.fillRect(0, y + 1, w, 1); }
        g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillRect(w / 2 - 8, h - 10, 16, 5);
      } else if (kind === 2) { // fabrics: pashmina / dhaka / clothes
        g.fillStyle = '#2a1a14'; g.fillRect(0, 0, w, h);
        for (let x = 0; x < w; x += 9) { g.fillStyle = `hsl(${KS.r(0, 360)},${KS.r(50, 90)}%,${KS.r(35, 60)}%)`; g.fillRect(x, 8, 8, KS.r(60, 115)); }
      } else { // glass shop / pharmacy
        g.fillStyle = '#cfe4ea'; g.fillRect(0, 0, w, h);
        g.fillStyle = '#e9f4f6'; g.fillRect(8, 10, w - 16, h - 20);
        g.fillStyle = '#999'; for (let x = 0; x <= w; x += 64) g.fillRect(x, 0, 4, h);
        for (let i = 0; i < 20; i++) { g.fillStyle = `hsl(${KS.r(0, 360)},60%,60%)`; g.fillRect(KS.r(10, w - 20), KS.r(20, h - 30), 8, 10); }
      }
    });
  }

  /* shop signs — original names, English + Nepali, Kathmandu sign-painter colours */
  KS.SIGNS = [
    ['MOMO HOUSE', 'मोमो घर'], ['THAKALI KITCHEN', 'थकाली भान्सा'], ['KIRANA PASAL', 'किराना पसल'], ['CHIYA PASAL', 'चिया पसल'],
    ['KHUKURI HOUSE', 'खुकुरी घर'], ['PASHMINA ARTS', 'पश्मिना'], ['TREKKING GEAR', 'ट्रेकिङ सामान'], ['SINGING BOWL CENTRE', 'गाउने कचौरा'],
    ['THANGKA GALLERY', 'थाङ्का कला'], ['NEWARI KHAJA GHAR', 'नेवारी खाजा घर'], ['SEL ROTI CORNER', 'सेल रोटी'], ['LASSI POINT', 'लस्सी'],
    ['MOBILE REPAIR', 'मोबाइल मर्मत'], ['CYBER CAFE', 'साइबर क्याफे'], ['TAILOR & SUITING', 'टेलर्स'], ['FANCY STORES', 'फेन्सी स्टोर्स'],
    ['MEDICAL HALL', 'मेडिकल हल'], ['HARDWARE SUPPLIERS', 'हार्डवेयर'], ['SWEETS BHANDAR', 'मिठाई भण्डार'], ['GUEST HOUSE', 'अतिथि गृह'],
    ['DAL BHAT POWER', 'दाल भात'], ['MONEY EXCHANGE', 'मुद्रा सटही'], ['BAKERY CAFE', 'बेकरी'], ['ROOFTOP RESTRO', 'रुफटप'],
    ['BOOK & STATIONERY', 'किताब पसल'], ['GOLD & SILVER', 'सुन चाँदी'], ['DHAKA TOPI SHOP', 'ढाका टोपी'], ['MOUNTAIN TRAVELS', 'ट्राभल्स'],
    ['BUTTER TEA HOUSE', 'सुन्तला'], ['FRESH HOUSE', 'तरकारी'], ['HOTEL HIMALAYAN VIEW', 'होटल'], ['MASALA CORNER', 'मसला'],
  ];
  const SIGN_COLORS = [['#c81e1e', '#ffe14a'], ['#1d4fb8', '#ffffff'], ['#ffd21f', '#b3121b'], ['#178a43', '#ffffff'], ['#111111', '#ffcc00'], ['#ffffff', '#c3141c'], ['#6d1a8a', '#ffffff'], ['#e86412', '#ffffff']];
  function signTex(i) {
    const [en, np] = KS.SIGNS[i]; const [bg, fg] = SIGN_COLORS[i % SIGN_COLORS.length];
    return KS.tex(512, 160, (g, w, h) => {
      g.fillStyle = bg; g.fillRect(0, 0, w, h);
      g.strokeStyle = fg; g.lineWidth = 6; g.strokeRect(8, 8, w - 16, h - 16);
      g.fillStyle = fg; g.textAlign = 'center'; g.textBaseline = 'middle';
      let fs = 64; g.font = `800 ${fs}px "Barlow Condensed", Impact, sans-serif`;
      while (g.measureText(en).width > w - 50 && fs > 30) { fs -= 4; g.font = `800 ${fs}px "Barlow Condensed", Impact, sans-serif`; }
      g.fillText(en, w / 2, 62);
      g.font = `700 40px ${KS.FONT}`; g.fillText(np, w / 2, 116);
      g.font = '600 18px sans-serif'; g.textAlign = 'right'; g.fillText('01-4' + (100000 + ((i * 7919) % 899999)), w - 22, h - 20);
    });
  }

  /* ================= terrain & water ================= */
  function terrain(scene) {
    const B = KS.BOUNDS, SX = B.x1 - B.x0, SZ = B.z1 - B.z0;
    const segX = Math.round(SX / 8), segZ = Math.round(SZ / 8);
    const geo = new T.PlaneGeometry(SX, SZ, segX, segZ); geo.rotateX(-Math.PI / 2); geo.translate((B.x0 + B.x1) / 2, 0, (B.z0 + B.z1) / 2);
    // the mesh grid, so roads and rails can sit on the VISIBLE ground (see KS.meshHeightAt)
    KS.terrainGrid = { x0: B.x0, z0: B.z0, dx: SX / segX, dz: SZ / segZ, segX, segZ };
    const pos = geo.attributes.position, cols = new Float32Array(pos.count * 3), c = new T.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i), h = KS.heightAt(x, z, true); pos.setY(i, h);
      const m = Math.max(Math.abs(x), Math.abs(z)), n = KS.fbm(x * 0.02, z * 0.02);
      if (z > KS.RIVER.z0 - 14 && z < KS.RIVER.z1 + 14 && h < 0.6) { // riverbanks: wet mud at the waterline, then grey gravel and sand
        const n2 = KS.fbm(x * 0.08, z * 0.08);
        if (h < KS.RIVER.water + 0.25) c.setHex(0x4a3f30).lerp(new T.Color(0x5a4c38), n2);
        else c.setHex(0x9a9282).lerp(new T.Color(0xb0a588), n2).offsetHSL(0, 0, (n - 0.5) * 0.1);
        if (h > -0.2 && n2 > 0.55) c.lerp(new T.Color(0x7a8a4a), 0.6);
      }
      else if (h < -0.5) c.setHex(0x6b5a40);
      else if (h > KS.SNOWLINE) c.setHex(0xf4f6f8).offsetHSL(0, 0, (n - 0.5) * 0.04); // snow above the snow line
      else if (m < 560) c.setHex(0x9f9177).offsetHSL(0, 0, (n - 0.5) * 0.08);
      else if (h > 60) c.setHex(0x3f5f2e).lerp(new T.Color(0x56703c), n);
      else c.setHex(0x7c8e4c).lerp(new T.Color(0x9a9a5c), n).offsetHSL(0, 0, (n - 0.5) * 0.1);
      cols[i * 3] = c.r; cols[i * 3 + 1] = c.g; cols[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new T.BufferAttribute(cols, 3)); geo.computeVertexNormals();
    const m = new T.Mesh(geo, KS.M.vc); m.receiveShadow = true; scene.add(m);

    // Bagmati: murky water that flows, reflects the sky, glints in the sun and foams at the banks
    const R = KS.RIVER;
    KS.waterU = T.UniformsUtils.merge([T.UniformsLib.fog, { uTime: { value: 0 }, uSky: { value: new T.Color(0xbcd6ee) }, uSunDir: { value: new T.Vector3(0.3, 0.8, 0.4) }, uSun: { value: 1 }, uLight: { value: 1 }, uC: { value: new T.Vector2((R.z0 + R.z1) / 2, (R.z1 - R.z0) / 2) } }]);
    KS.waterMat = new T.ShaderMaterial({
      uniforms: KS.waterU, fog: true, transparent: true,
      vertexShader: `varying vec3 vW;
        #include <fog_pars_vertex>
        void main(){
          vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; vec4 mvPosition = viewMatrix * w; gl_Position = projectionMatrix * mvPosition;
          #include <fog_vertex>
        }`,
      fragmentShader: `uniform float uTime, uSun, uLight; uniform vec3 uSky, uSunDir; uniform vec2 uC; varying vec3 vW;
        #include <fog_pars_fragment>
        float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
        float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p){ float a = 0.5, s = 0.0; for (int i = 0; i < 4; i++) { s += a * noise(p); p *= 2.03; a *= 0.5; } return s; }
        void main(){
          float t = uTime;
          vec2 p = vW.xz;
          // ripples carried by the current (the river flows east, faster in the middle)
          float mid = 1.0 - clamp(abs(vW.z - uC.x) / uC.y, 0.0, 1.0);
          vec2 q = vec2(p.x * 0.12 - t * (0.5 + 0.9 * mid), p.y * 0.35);
          float h = fbm(q) * 0.6 + fbm(q * 2.7 + vec2(-t * 0.4, t * 0.1)) * 0.4;
          float hx = fbm(q + vec2(0.05, 0.0)) - fbm(q - vec2(0.05, 0.0)), hz = fbm(q + vec2(0.0, 0.05)) - fbm(q - vec2(0.0, 0.05));
          vec3 n = normalize(vec3(-hx * 2.2, 1.0, -hz * 2.2));
          vec3 V = normalize(cameraPosition - vW);
          float fres = 0.08 + 0.6 * pow(1.0 - max(dot(n, V), 0.0), 4.0);
          vec3 deep = vec3(0.20, 0.25, 0.17), shallow = vec3(0.42, 0.40, 0.28);
          vec3 col = mix(shallow, deep, smoothstep(0.0, 0.7, mid)) * (0.85 + 0.3 * h);
          col = mix(col, uSky * 0.9, fres);
          vec3 Rr = reflect(-normalize(uSunDir), n);
          col += vec3(1.0, 0.95, 0.85) * pow(max(dot(Rr, V), 0.0), 60.0) * 0.8 * uSun;
          // foam: streaks along the banks and around the current
          float edge = smoothstep(0.55, 0.95, 1.0 - mid);
          float foam = smoothstep(0.62, 0.8, fbm(vec2(p.x * 0.35 - t * 1.2, p.y * 0.9))) * (0.25 + 0.75 * edge);
          col = mix(col, vec3(0.86, 0.85, 0.78), foam * 0.55);
          gl_FragColor = vec4(col * uLight, 0.93);
          #include <fog_fragment>
        }`,
    });
    const wg = new T.PlaneGeometry(KS.BOUNDS.x1 - KS.BOUNDS.x0, R.z1 - R.z0 + 14, 1, 1); wg.rotateX(-Math.PI / 2);
    const water = new T.Mesh(wg, KS.waterMat); water.position.set((KS.BOUNDS.x0 + KS.BOUNDS.x1) / 2, R.water, (R.z0 + R.z1) / 2); water.renderOrder = 1; scene.add(water);
    // boulders along the banks and in the shallows
    const rg = new T.DodecahedronGeometry(1, 0), rocks = new T.InstancedMesh(rg, new T.MeshLambertMaterial({ vertexColors: false }), 520), d = new T.Object3D(), rc = new T.Color();
    let n = 0;
    for (let k = 0; k < 3000 && n < 520; k++) {
      const x = KS.r(-1500, 1400), z = KS.r(R.z0 - 2, R.z1 + 2), h = KS.heightAt(x, z);
      if (h > 0.2 || h < R.water - 0.6) continue; // only near the waterline
      if (Math.abs(((x - G.O) % G.B + G.B) % G.B) < 14 || Math.abs(((x - G.O) % G.B + G.B) % G.B - G.B) < 14) continue; // keep clear of bridges
      const s2 = KS.r(0.25, 1.1);
      d.position.set(x, h - s2 * 0.35, z); d.rotation.set(KS.r(0, 3), KS.r(0, 3), KS.r(0, 3)); d.scale.set(s2 * KS.r(0.8, 1.5), s2 * KS.r(0.5, 0.9), s2); d.updateMatrix();
      rocks.setMatrixAt(n, d.matrix); rocks.setColorAt(n, rc.setHSL(KS.r(0.07, 0.12), KS.r(0.05, 0.15), KS.r(0.35, 0.55))); n++;
    }
    rocks.count = n; rocks.receiveShadow = true; rocks.castShadow = KS.quality.shadows; scene.add(rocks);
  }

  /* ================= the Ring Road loop =================
     A ribbon of road following the spline in core.js (22 m wide, the 4-lane
     ring texture), plus a connector ribbon from every loop junction to the
     nearest grid junction, and bridge decks where the loop crosses the
     Bagmati — the same slab-and-pier treatment the grid roads get, so
     vehicles drive over the river on the bridge instead of into the water. */
  function ringRoad(scene, mR, mN) {
    const P = KS.ringLoopPts;
    const ribbon = (pts, width, mat, closed) => {
      const n = pts.length, pos = [], uv = [], idx = [];
      let s = 0;
      for (let i = 0; i < n; i++) {
        const p = pts[i], q = pts[(i + 1) % n];
        const nx = Math.cos(p.h), nz = -Math.sin(p.h); // left of travel
        pos.push(p.x + (nx * width) / 2, 0.07, p.z + (nz * width) / 2, p.x - (nx * width) / 2, 0.07, p.z - (nz * width) / 2);
        uv.push(0, s / 32, 1, s / 32);
        s += Math.hypot(q.x - p.x, q.z - p.z);
      }
      const segs = closed ? n : n - 1;
      for (let i = 0; i < segs; i++) {
        const a = i * 2, b = ((i + 1) % n) * 2;
        idx.push(a, a + 1, b, a + 1, b + 1, b);
      }
      const geo = new T.BufferGeometry();
      geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeVertexNormals();
      const m = new T.Mesh(geo, mat); m.receiveShadow = true; scene.add(m);
    };
    ribbon(P, G.RING, mR, true);
    for (const c of KS.ringConnectors) { // short roads from each junction into the city
      const dx = c.x2 - c.x1, dz = c.z2 - c.z1, h = Math.atan2(dx, dz), pts = [];
      for (let k = 0; k <= 4; k++) pts.push({ x: c.x1 + (dx * k) / 4, z: c.z1 + (dz * k) / 4, h });
      ribbon(pts, G.ROAD, mN, false);
    }
    const b = new KS.Builder();
    for (let i = 0; i < P.length; i++) { // bridge decks over the Bagmati
      const p = P[i];
      if (p.z < KS.RIVER.z0 - 4 || p.z > KS.RIVER.z1 + 4) continue;
      b.box(p.x, -0.7, p.z, 26, 1.45, 26, 0x8d887e);
      b.box(p.x, -3, p.z, 24, 1.8, 2.2, 0x7d786e);
      KS.addBox(p.x, p.z, 26, 26, 0.06, -3);
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
  }

  /* ================= roads, sidewalks, bridges ================= */
  function roads(scene) {
    const tN = roadTex(false), tR = roadTex(true);
    const mN = new T.MeshLambertMaterial({ map: tN, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    const mR = new T.MeshLambertMaterial({ map: tR, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 });
    KS.roadMats = [mN, mR];
    const len = G.HALF * 2 + G.ROAD;
    for (let i = 0; i <= G.N; i++) {
      const w = G.roadHalf(i) * 2, mat = mN; // every grid line is an ordinary street now; the Ring Road is the loop below
      for (let axis = 0; axis < 2; axis++) {
        const geo = new T.PlaneGeometry(w, len); geo.rotateX(-Math.PI / 2);
        const uv = geo.attributes.uv; for (let k = 0; k < uv.count; k++) uv.setY(k, uv.getY(k) * len / 32);
        const m = new T.Mesh(geo, mat); m.receiveShadow = true;
        const y = 0.05 + axis * 0.004;
        if (axis === 0) m.position.set(G.line(i), y, 0); else { m.rotation.y = Math.PI / 2; m.position.set(0, y, G.line(i)); }
        scene.add(m);
      }
    }
    ringRoad(scene, mR, mN);
    // Swayambhu access road climbing the hill, and airport road
    const sw = KS.SWAYAMBHU;
    const climb = new KS.Builder();
    for (let x = -540; x > sw.x + 22; x -= 2) {
      const h0 = KS.heightAt(x, sw.z), h1 = KS.heightAt(x - 2, sw.z);
      climb.box(x - 1, Math.min(h0, h1) - 0.2, sw.z, 2.2, Math.abs(h1 - h0) + 0.32, 12, 0x4c4c4e);
    }
    climb.box(620 - 40, 0.02, 0, 80, 0.06, 14, 0x4a4a4c);
    scene.add(KS.mesh(climb, KS.M.vc, false));

    // sidewalks (raised kerbs) + bridges
    const b = new KS.Builder();
    for (let c = 0; c < G.N; c++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c, r); if (t === 'river') continue;
      const R = W.blockRect(c, r), col = t === 'durbar' || t === 'durbar2' ? 0x9a5a44 : 0xb9b2a4;
      b.box((R.x0 + R.x1) / 2, 0, R.z0 + SW / 2, R.x1 - R.x0, 0.22, SW, col);
      b.box((R.x0 + R.x1) / 2, 0, R.z1 - SW / 2, R.x1 - R.x0, 0.22, SW, col);
      b.box(R.x0 + SW / 2, 0, (R.z0 + R.z1) / 2, SW, 0.22, R.z1 - R.z0 - SW * 2, col);
      b.box(R.x1 - SW / 2, 0, (R.z0 + R.z1) / 2, SW, 0.22, R.z1 - R.z0 - SW * 2, col);
      // kerb paint (black & yellow near big junctions)
      if ((c + r) % 3 === 0) b.box(R.x0 + 0.15, 0, (R.z0 + R.z1) / 2, 0.32, 0.24, R.z1 - R.z0, 0xd8c23a);
    }
    for (let i = 0; i <= G.N; i++) {
      const x = G.line(i), hw = G.roadHalf(i), z0 = KS.RIVER.z0 - 8, z1 = KS.RIVER.z1 + 8, L = z1 - z0;
      b.box(x, -1.4, (z0 + z1) / 2, hw * 2 + 1, 1.45, L, 0x8d887e);
      b.box(x - hw - 0.3, 0.05, (z0 + z1) / 2, 0.5, 1.1, L, 0xd6d0c2);
      b.box(x + hw + 0.3, 0.05, (z0 + z1) / 2, 0.5, 1.1, L, 0xd6d0c2);
      for (let z = z0 + 10; z < z1 - 5; z += 18) b.box(x, -3, z, hw * 2 - 2, 1.8, 2.2, 0x7d786e);
      KS.addBox(x, (z0 + z1) / 2, hw * 2, L, 0.06, -3);
      KS.addBox(x - hw - 0.3, (z0 + z1) / 2, 0.5, L, 1.2, -3);
      KS.addBox(x + hw + 0.3, (z0 + z1) / 2, 0.5, L, 1.2, -3);
    }
    // ghats / stone embankment along the river
    for (let x = -1300; x < 1300; x += 20) {
      b.box(x + 10, -2.6, KS.RIVER.z0 - 1, 20, 2.6, 3, 0x8f8676);
      b.box(x + 10, -2.6, KS.RIVER.z1 + 1, 20, 2.6, 3, 0x8f8676);
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
  }

  /* ================= speed breakers ================= */
  function speedBreakers(scene) {
    /* a raised, striped bump across the road in front of every school and the
       hospital — drivers see it coming and crawl over it. KS.onBreaker is
       the gameplay side: traffic and the player are capped to 3.5 m/s on one. */
    const spots = [];
    for (const sc of KS.SCHOOLS || []) if (!sc.village) spots.push([G.line(sc.c), G.line(sc.r) + 45, 'z']);
    spots.push([G.line(7), G.line(5) + 45, 'z']); // Bir Hospital block
    const b = new KS.Builder();
    KS.speedBreakers = [];
    for (const [x, z, ax] of spots) {
      const alongZ = ax === 'z';
      b.box(x, 0, z, alongZ ? G.ROAD : 1.4, 0.12, alongZ ? 1.4 : G.ROAD, 0x3a3a3c);
      const n = 8, stripe = G.ROAD / n;
      for (let k = 0; k < n; k++) {
        const off = -G.ROAD / 2 + stripe * (k + 0.5);
        b.box(alongZ ? x + off : x, 0.12, alongZ ? z : z + off, alongZ ? stripe - 0.1 : 1.5, 0.02, alongZ ? 1.5 : stripe - 0.1, k % 2 ? 0x111111 : 0xf2c418);
      }
      KS.speedBreakers.push({ x, z, ax });
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
    /** true while a vehicle is on a speed breaker (a short box across the road). */
    KS.onBreaker = (x, z) => {
      for (const s of KS.speedBreakers) {
        if (s.ax === 'z' ? Math.abs(x - s.x) < G.ROAD / 2 + 0.5 && Math.abs(z - s.z) < 1.5 : Math.abs(z - s.z) < G.ROAD / 2 + 0.5 && Math.abs(x - s.x) < 1.5) return true;
      }
      return false;
    };
    /** metres ahead along a heading to the next speed breaker (Infinity if none
        within 15 m) — so traffic can brake for it instead of hitting it flat out. */
    KS.breakerDist = (x, z, h) => {
      const fx = Math.sin(h), fz = Math.cos(h);
      for (let d = 0; d <= 15; d += 0.5) if (KS.onBreaker(x + fx * d, z + fz * d)) return d;
      return Infinity;
    };
  }

  /* ================= the Ring Road, divided ================= */
  function ringMedian(scene) {
    /* the Ring Road is a divided 4-lane road, like the real one: a raised
       concrete median with a yellow cap runs down its middle, broken only at
       the junctions (the loop's named places), so traffic can still turn.
       The median is a solid for vehicles — U-turn at a junction, not over
       it — built as a chain of small circles along the centre line, because
       a diagonal median cannot be an axis-aligned box. It stays steppable
       on foot (top 0.65, on-foot step ~1.0). */
    const P = KS.ringLoopPts, b = new KS.Builder();
    const GAP = 13; // half the gap at each junction, along the loop
    const wayS = KS.RING_LOOP.map((w) => { // arclength of each junction
      let best = Infinity, bs = 0;
      for (let i = 0; i < P.length; i++) {
        const d = Math.hypot(P[i].x - w.x, P[i].z - w.z);
        if (d < best) { best = d; bs = P[i].s; }
      }
      return bs;
    });
    const gapAt = (s) => {
      for (const bs of wayS) {
        const ds = Math.abs(s - bs);
        if (Math.min(ds, KS.ringLoopLen - ds) < GAP) return true;
      }
      return false;
    };
    // visual: short straight chunks of concrete + yellow cap, following the curve
    for (let i = 0; i < P.length; i += 2) {
      const p = P[i], q = P[(i + 2) % P.length];
      const midS = (p.s + Math.hypot(q.x - p.x, q.z - p.z) / 2) % KS.ringLoopLen;
      if (gapAt(midS)) continue;
      const mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2, len = Math.hypot(q.x - p.x, q.z - p.z);
      const h = Math.atan2(q.x - p.x, q.z - p.z);
      b.box(mx, 0, mz, 0.6, 0.6, len + 0.4, 0x9a9a9a, h);
      b.box(mx, 0.6, mz, 0.64, 0.05, len + 0.4, 0xf2c418, h);
    }
    // solid: circles along the centre line (one per sample, skipping the gaps)
    for (let i = 0; i < P.length; i++) {
      const p = P[i];
      if (gapAt(p.s)) continue;
      KS.addCircle(p.x, p.z, 0.55, 0.65, -50);
    }
    scene.add(KS.mesh(b, KS.M.vc, false));
  }

  /* ================= buildings ================= */
  const FLOORS = [2, 3, 4, 5, 6, 7, 8];
  const inst = {}; // key style:floors -> list of {m: Matrix4, color, off}
  const shopInst = [[], [], [], [], []];
  const signInst = KS.SIGNS.map(() => []);
  const balcony = [], tanks = [], cabins = [], rebar = [], solar = [], acs = [];
  W.lots = []; // building fronts (for peds / missions)
  const dummy = new T.Object3D();

  function addBuilding(cx, cz, w, d, floors, style, ry, color, area) {
    const H = floors * FLOOR;
    dummy.position.set(cx, 0, cz); dummy.rotation.set(0, ry, 0); dummy.scale.set(w, H, d); dummy.updateMatrix();
    const k = style + ':' + floors; (inst[k] = inst[k] || []).push({ m: dummy.matrix.clone(), color, off: [KS.ri(0, 3) * 0.25, KS.ri(0, 15) / 16] });
    KS.addBox(cx, cz, w, d, H, -50, ry);
    if (floors >= 6) (W.tall = W.tall || []).push({ cx, cz, w, d, H, ry });
    const fx = Math.sin(ry), fz = Math.cos(ry), rx = Math.cos(ry), rz = -Math.sin(ry);
    const front = (o, y, along = 0) => [cx + fx * (d / 2 + o) + rx * along, y, cz + fz * (d / 2 + o) + rz * along];
    // ground floor shop
    const shopKind = area === 'thamel' ? KS.pick([0, 2, 2, 4, 0, 3]) : area === 'outskirts' ? KS.pick([1, 1, 0, 0, 4]) : KS.pick([0, 0, 1, 2, 3, 4]);
    /* no front doors at the sacred sites: the houses ringing Boudhanath, the
       shrines at Swayambhu and the temples of Durbar Square are not homes
       people step out of — pilgrims walk the kora, they do not emerge from
       the gompa walls. */
    const sacred = Math.hypot(cx - 405, cz + 225) < 55 || Math.hypot(cx + 700, cz + 90) < 60 || Math.hypot(cx + 112, cz - 26) < 60;
    if (!(area === 'outskirts' && KS.chance(0.3))) {
      const [sx, sy, sz] = front(0.12, 0.2); dummy.position.set(sx, sy, sz); dummy.rotation.set(0, ry, 0); dummy.scale.set(w * 0.94, 2.7, 0.3); dummy.updateMatrix();
      shopInst[shopKind].push(dummy.matrix.clone());
      if (!sacred) W.lots.push({ x: sx + fx * 3, z: sz + fz * 3, fx, fz, kind: shopKind });
      // sign board
      if (KS.chance(area === 'outskirts' ? 0.5 : 0.92)) {
        const si = area === 'thamel' ? KS.ri(0, KS.SIGNS.length - 1) : KS.ri(0, KS.SIGNS.length - 1);
        const [gx, gy, gz] = front(0.45, 3.0); const sw = Math.min(w * 0.88, 10);
        dummy.position.set(gx, gy, gz); dummy.rotation.set(0, ry, 0); dummy.scale.set(sw, 1.5, 0.18); dummy.updateMatrix();
        signInst[si].push(dummy.matrix.clone());
      }
      if (area === 'thamel' || (area !== 'outskirts' && KS.chance(0.25))) { // hanging projecting signs
        for (let f = 1; f < Math.min(floors, 4); f++) {
          if (!KS.chance(area === 'thamel' ? 0.8 : 0.35)) continue;
          const [hx, hy, hz] = front(1.3, f * FLOOR + 0.6, KS.r(-w * 0.35, w * 0.35));
          dummy.position.set(hx, hy, hz); dummy.rotation.set(0, ry + Math.PI / 2, 0); dummy.scale.set(2.6, 1.0, 0.14); dummy.updateMatrix();
          signInst[KS.ri(0, KS.SIGNS.length - 1)].push(dummy.matrix.clone());
        }
      }
    }
    // balconies
    if (style !== 2) for (let f = 1; f < floors; f++) {
      if (!KS.chance(0.55)) continue;
      const [bx, by, bz] = front(0.6, f * FLOOR - 0.1, KS.r(-w * 0.2, w * 0.2));
      dummy.position.set(bx, by, bz); dummy.rotation.set(0, ry, 0); dummy.scale.set(KS.r(w * 0.3, w * 0.7), 1.0, 1.2); dummy.updateMatrix();
      balcony.push({ m: dummy.matrix.clone(), color: KS.pick([0xdddddd, 0x9aa, 0xc88, 0x8a6, 0xeeeeee]) });
    }
    if (KS.chance(0.4)) { const [ax, ay, az] = front(0.35, KS.ri(1, floors - 1) * FLOOR + 1.2, KS.r(-w * 0.3, w * 0.3)); dummy.position.set(ax, ay, az); dummy.rotation.set(0, ry, 0); dummy.scale.set(1.1, 0.7, 0.6); dummy.updateMatrix(); acs.push(dummy.matrix.clone()); }
    // roof: black water tanks, solar heaters, stair cabins, rebar of the "next floor later"
    const nt = KS.ri(1, 3);
    for (let i = 0; i < nt; i++) {
      dummy.position.set(cx + KS.r(-w / 3, w / 3), H, cz + KS.r(-d / 3, d / 3)); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.75, 1.6, 0.75); dummy.updateMatrix(); tanks.push(dummy.matrix.clone());
    }
    if (KS.chance(0.55)) { dummy.position.set(cx + KS.r(-w / 4, w / 4), H, cz + KS.r(-d / 4, d / 4)); dummy.rotation.set(0, ry, 0); dummy.scale.set(3.2, 2.6, 3.4); dummy.updateMatrix(); cabins.push({ m: dummy.matrix.clone(), color }); }
    if (KS.chance(0.35)) { dummy.position.set(cx + KS.r(-w / 3, w / 3), H + 0.6, cz + KS.r(-d / 3, d / 3)); dummy.rotation.set(-0.6, ry, 0); dummy.scale.set(2, 0.12, 1.4); dummy.updateMatrix(); solar.push(dummy.matrix.clone()); }
    if (KS.chance(area === 'outskirts' ? 0.6 : 0.3)) {
      for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        dummy.position.set(cx + sx * (w / 2 - 0.4), H, cz + sz * (d / 2 - 0.4)); dummy.rotation.set(0, 0, 0); dummy.scale.set(0.5, KS.r(1, 1.8), 0.5); dummy.updateMatrix(); rebar.push(dummy.matrix.clone());
      }
    }
    return H;
  }

  W.addBuilding = addBuilding;

  function areaParams(t, c, r) {
    const out = c <= 1 || c >= 10 || r <= 1 || r >= 10;
    if (t === 'thamel') return { area: 'thamel', fl: [3, 6], st: [0.5, 0.3, 0.2], lot: [9, 14] };
    if (t === 'old' || t === 'ason') return { area: 'old', fl: [3, 5], st: [0.22, 0.13, 0.65], lot: [8, 12] };
    if (t === 'newroad') return { area: 'newroad', fl: [5, 8], st: [0.25, 0.7, 0.05], lot: [12, 18] };
    if (out) return { area: 'outskirts', fl: [2, 5], st: [0.6, 0.3, 0.1], lot: [11, 18] };
    return { area: 'city', fl: [3, 7], st: [0.55, 0.33, 0.12], lot: [10, 16] };
  }
  function pickStyle(st) { const x = KS.rng(); return x < st[0] ? 0 : x < st[0] + st[1] ? 1 : 2; }
  function splitLen(L, a, b) { const out = []; let p = 0; while (L - p > 0.5) { let w = KS.r(a, b); if (L - p - w < a) w = L - p; out.push([p, w]); p += w; } return out; }

  function buildBlock(c, r) {
    const t = KS.blockType(c, r);
    if (!['city', 'thamel', 'old', 'ason', 'newroad'].includes(t)) return;
    const pr = areaParams(t, c, r);
    const R = W.blockRect(c, r), x0 = R.x0 + SW + 0.3, x1 = R.x1 - SW - 0.3, z0 = R.z0 + SW + 0.3, z1 = R.z1 - SW - 0.3;
    const D = KS.r(13, 17);
    const mk = (cx, cz, w, d, ry) => {
      // the Ring Road cuts through the outer blocks: no building on the road.
      // The margin is the road half-width (11 m) plus the building's own
      // half-diagonal (it is rotated) plus a little air — a fixed 16 m let
      // wide buildings hang over the carriageway.
      if (KS.nearRingRoad(cx, cz, 11 + Math.hypot(w, d) / 2 + 2)) return;
      if (pr.area === 'outskirts' && KS.chance(0.12)) { emptyLot(cx, cz, w, d); return; }
      const style = pickStyle(pr.st);
      let fl = KS.ri(pr.fl[0], pr.fl[1]); if (style === 2) fl = Math.min(fl, 5);
      const color = style === 2 ? KS.pick([0xffffff, 0xf3e2d6, 0xe8d2c2, 0xfff0e6]) : KS.pick(P.walls);
      addBuilding(cx, cz, w, d, fl, style, ry, color, pr.area);
    };
    // north & south rows
    for (const [p, w] of splitLen(x1 - x0, pr.lot[0], pr.lot[1])) {
      const g = KS.r(0, 0.5), d = D - KS.r(0, 2.5);
      mk(x0 + p + w / 2, z0 + d / 2, w - g, d, Math.PI);
      const d2 = D - KS.r(0, 2.5); mk(x0 + p + w / 2, z1 - d2 / 2, w - g, d2, 0);
    }
    for (const [p, w] of splitLen(z1 - z0 - D * 2, pr.lot[0], pr.lot[1])) {
      const g = KS.r(0, 0.5), d = D - KS.r(0, 2.5);
      mk(x0 + d / 2, z0 + D + p + w / 2, w - g, d, -Math.PI / 2);
      const d2 = D - KS.r(0, 2.5); mk(x1 - d2 / 2, z0 + D + p + w / 2, w - g, d2, Math.PI / 2);
    }
    // inner courtyard (Newari "chowk"): shrine, tree, or small houses
    const icx = (x0 + x1) / 2, icz = (z0 + z1) / 2, iw = x1 - x0 - D * 2 - 2, id = z1 - z0 - D * 2 - 2;
    const b = W.chunk(icx, icz);
    b.box(icx, 0, icz, iw, 0.08, id, pr.area === 'old' ? 0x8e4d38 : 0x8d8676);
    const roll = KS.rng();
    // the courtyard shrine is a solid (its tower is 3.2 m wide and 8 m tall):
    // a block the Ring Road cuts through must not have one sitting on the road.
    // (Round 8 caught three of these on the carriageway after the building
    // margin change shifted the random layout.)
    if (pr.area === 'old' || roll < 0.25) { if (!KS.nearRingRoad(icx, icz, 14)) W.smallShrine(b, icx, icz, KS.chance(0.5)); }
    else if (roll < 0.6) { W.tree(icx + KS.r(-5, 5), icz + KS.r(-5, 5), KS.r(5, 8)); W.tree(icx - 8, icz + 6, KS.r(4, 6)); }
    else { mk(icx - iw / 4, icz, iw / 2 - 2, id - 4, 0); }
  }
  function emptyLot(cx, cz, w, d) {
    const b = W.chunk(cx, cz);
    b.box(cx, 0, cz, w, 0.1, d, 0x8a7a5e);
    for (let i = 0; i < 3; i++) b.box(cx + KS.r(-w / 3, w / 3), 0, cz + KS.r(-d / 3, d / 3), KS.r(1.5, 3), KS.r(0.5, 1.2), KS.r(1, 2), 0xa4553a); // brick piles
    b.box(cx + KS.r(-2, 2), 0, cz, 2.5, 0.6, 2.5, 0xb7a98c); // sand
    if (KS.chance(0.5)) W.tree(cx + KS.r(-w / 3, w / 3), cz + KS.r(-d / 3, d / 3), KS.r(4, 7));
  }

  /** small Newari shrine: plinth + 1-2 tier pagoda */
  W.smallShrine = (b, x, z, twoTier) => {
    b.box(x, 0, z, 6, 0.8, 6, 0x8c4a34); b.box(x, 0.8, z, 4.6, 0.6, 4.6, 0x9c5a40);
    b.box(x, 1.4, z, 3.2, 2.6, 3.2, P.brick);
    b.box(x, 1.4, z + 1.62, 1.2, 1.8, 0.1, P.wood);
    b.pyr(x, 4.0, z, 5.6, 1.6, P.roofTile);
    if (twoTier) { b.box(x, 5.2, z, 2, 1.4, 2, P.brick); b.pyr(x, 6.4, z, 3.6, 1.2, P.roofTile); b.cyl(x, 7.4, z, 0.25, 1.2, P.gold, 6, 0.1); }
    else b.cyl(x, 5.4, z, 0.25, 1.1, P.gold, 6, 0.1);
    b.box(x + 2.6, 0, z + 2.6, 0.5, 0.9, 0.5, 0xc0261d); // red-painted stone (Ganesh)
    KS.addBox(x, z, 6, 6, 0.8); KS.addBox(x, z, 4.6, 4.6, 1.4); KS.addBox(x, z, 3.2, 3.2, 8);
  };

  /* ================= trees ================= */
  const trees = [];
  W.tree = (x, z, h = 6, kind) => { if (KS.nearRingRoad(x, z, 13)) return; trees.push({ x, z, h, kind: kind || (KS.chance(0.2) ? 'pine' : 'broad') }); };
  function buildTrees(scene) {
    const trunkG = new T.CylinderGeometry(0.22, 0.35, 1, 6).translate(0, 0.5, 0);
    const leafG = new T.IcosahedronGeometry(1, 1);
    const pineG = new T.ConeGeometry(1, 1, 7).translate(0, 0.5, 0);
    const broad = trees.filter((t) => t.kind === 'broad'), pine = trees.filter((t) => t.kind === 'pine');
    const tr = new T.InstancedMesh(trunkG, new T.MeshLambertMaterial({ color: 0x5b4130 }), trees.length);
    const lf = new T.InstancedMesh(leafG, new T.MeshLambertMaterial({ color: 0xffffff }), broad.length);
    const pn = new T.InstancedMesh(pineG, new T.MeshLambertMaterial({ color: 0xffffff }), Math.max(1, pine.length));
    const col = new T.Color();
    trees.forEach((t, i) => {
      const y = KS.heightAt(t.x, t.z);
      dummy.position.set(t.x, y, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(t.h / 6, t.h * 0.45, t.h / 6); dummy.updateMatrix(); tr.setMatrixAt(i, dummy.matrix);
    });
    broad.forEach((t, i) => {
      const y = KS.heightAt(t.x, t.z);
      dummy.position.set(t.x, y + t.h * 0.62, t.z); dummy.rotation.set(KS.r(0, 3), KS.r(0, 3), 0); dummy.scale.set(t.h * 0.42, t.h * 0.36, t.h * 0.42); dummy.updateMatrix(); lf.setMatrixAt(i, dummy.matrix);
      lf.setColorAt(i, col.setHSL(KS.r(0.22, 0.32), KS.r(0.35, 0.55), KS.r(0.22, 0.34)));
    });
    pine.forEach((t, i) => {
      const y = KS.heightAt(t.x, t.z);
      dummy.position.set(t.x, y + t.h * 0.25, t.z); dummy.rotation.set(0, 0, 0); dummy.scale.set(t.h * 0.28, t.h * 0.95, t.h * 0.28); dummy.updateMatrix(); pn.setMatrixAt(i, dummy.matrix);
      pn.setColorAt(i, col.setHSL(KS.r(0.3, 0.38), 0.4, KS.r(0.16, 0.24)));
    });
    for (const m of [tr, lf, pn]) { m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false; scene.add(m); }
    KS.treeCount = trees.length;
  }

  /* ================= wires, poles, street lamps ================= */
  function streetFurniture(scene) {
    const wirePts = [], flagRope = [];
    const poles = [], lamps = [];
    const sag = (a, b, s, out) => {
      const N = 8;
      for (let i = 0; i < N; i++) {
        const t0 = i / N, t1 = (i + 1) / N;
        const p = (t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t - Math.sin(Math.PI * t) * s, a[2] + (b[2] - a[2]) * t];
        out.push(...p(t0), ...p(t1));
      }
    };
    for (let i = 0; i <= G.N; i++) for (let axis = 0; axis < 2; axis++) {
      const L = G.line(i), off = G.roadHalf(i) + 1.2;
      let prev = null;
      for (let s = -G.HALF + 30; s <= G.HALF - 30; s += 30) {
        const { c, r } = axis === 0 ? G.blockOf(L - off, s) : G.blockOf(s, L - off);
        const bt = KS.blockType(c, r);
        // skip spans crossing the river or plazas
        if (bt === 'river' || (Math.abs(((s - G.O) % G.B)) < 12)) { prev = null; continue; }
        const px = axis === 0 ? L - off : s, pz = axis === 0 ? s : L - off;
        poles.push([px, pz]);
        const dense = bt === 'thamel' || bt === 'old' || bt === 'ason' || bt === 'newroad';
        if (prev) {
          const nw = dense ? KS.ri(6, 11) : KS.ri(3, 5);
          for (let k = 0; k < nw; k++) {
            const h = 6.2 + k * 0.18 + KS.r(-0.1, 0.1), oo = KS.r(-0.3, 0.3);
            const a = [prev[0] + (axis ? 0 : oo), h, prev[1] + (axis ? oo : 0)], b = [px + (axis ? 0 : oo), h + KS.r(-0.2, 0.2), pz + (axis ? oo : 0)];
            sag(a, b, KS.r(0.4, dense ? 1.6 : 0.8), wirePts);
          }
          if (dense && KS.chance(0.5)) { // cross-street cables
            const ox = axis === 0 ? off * 2 : 0, oz = axis === 0 ? 0 : off * 2;
            for (let k = 0; k < 3; k++) sag([px, 6.5 + k * 0.2, pz], [px + ox, 6 + k * 0.3, pz + oz], 0.9, wirePts);
          }
        }
        if (KS.chance(0.55)) lamps.push([px, pz, axis, 1]);
        prev = [px, pz];
      }
    }
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(wirePts, 3));
    scene.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x1a1a1a })));
    const pg = new T.CylinderGeometry(0.14, 0.2, 7.2, 6).translate(0, 3.6, 0);
    const pm = new T.InstancedMesh(pg, new T.MeshLambertMaterial({ color: 0x8f8a80 }), poles.length);
    poles.forEach(([x, z], i) => { dummy.position.set(x, 0, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); pm.setMatrixAt(i, dummy.matrix); KS.addCircle(x, z, 0.25, 7.2); });
    pm.frustumCulled = false; pm.castShadow = true; scene.add(pm);
    // transformers / bundles on some poles
    const tb = new KS.Builder();
    poles.forEach(([x, z]) => { if (KS.chance(0.12)) { tb.box(x, 4.2, z, 0.9, 1.1, 0.7, 0x6b7068); tb.cyl(x + 0.3, 5.3, z, 0.08, 0.5, 0x333333, 5); } if (KS.chance(0.3)) tb.cyl(x, 5.8, z, 0.45, 0.6, 0x222222, 6); });
    scene.add(KS.mesh(tb, KS.M.vc, false));
    // lamps: arm + glowing head
    const arm = new KS.Builder();
    const glowMat = new T.MeshBasicMaterial({ color: 0x555544 }); KS.lampMats.push(glowMat);
    const heads = new T.InstancedMesh(new T.BoxGeometry(0.9, 0.22, 0.45), glowMat, lamps.length);
    const pools = [];
    lamps.forEach(([x, z, axis], i) => {
      const dx = axis === 0 ? 1 : 0, dz = axis === 0 ? 0 : 1;
      arm.box(x + dx * 1.1, 7.0, z + dz * 1.1, axis === 0 ? 2.2 : 0.12, 0.12, axis === 0 ? 0.12 : 2.2, 0x777777);
      dummy.position.set(x + dx * 2.2, 6.9, z + dz * 2.2); dummy.rotation.set(0, axis ? Math.PI / 2 : 0, 0); dummy.scale.set(1, 1, 1); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
      pools.push([x + dx * 2.6, z + dz * 2.6]);
    });
    heads.frustumCulled = false; scene.add(heads); scene.add(KS.mesh(arm, KS.M.vc, false));
    const poolTex = KS.tex(128, 128, (g, w, h) => { const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64); gr.addColorStop(0, 'rgba(255,214,150,0.9)'); gr.addColorStop(1, 'rgba(255,214,150,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const poolMat = new T.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, blending: T.AdditiveBlending, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 });
    KS.poolMat = poolMat;
    const pgeo = new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
    const pl = new T.InstancedMesh(pgeo, poolMat, pools.length);
    pools.forEach(([x, z], i) => { dummy.position.set(x, 0.3, z); dummy.rotation.set(0, 0, 0); dummy.scale.set(18, 1, 18); dummy.updateMatrix(); pl.setMatrixAt(i, dummy.matrix); });
    pl.frustumCulled = false; scene.add(pl);
    KS.lampPositions = pools;
  }

  /* ================= prayer flags ================= */
  const flagB = new KS.Builder(); const ropes = [];
  W.flags = (a, b, sag = 1.2, spacing = 0.9) => {
    const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], L = Math.sqrt(dx * dx + dy * dy + dz * dz);
    const n = Math.max(2, Math.floor(L / spacing)), ry = Math.atan2(dx, dz) + Math.PI / 2;
    let prev = null;
    for (let i = 0; i <= n; i++) {
      const t = i / n, x = a[0] + dx * t, y = a[1] + dy * t - Math.sin(Math.PI * t) * sag, z = a[2] + dz * t;
      if (prev) ropes.push(...prev, x, y, z);
      prev = [x, y, z];
      if (i < n) flagB.box(x, y - 0.62, z, 0.55, 0.6, 0.02, P.flag[i % 5], ry);
    }
  };
  function buildFlags(scene) {
    if (flagB.empty) return;
    const mat = new T.MeshLambertMaterial({ vertexColors: true, side: T.DoubleSide });
    const uT = { value: 0 }; KS.timeUniforms.push(uT);
    mat.onBeforeCompile = (sh) => {
      sh.uniforms.uTime = uT;
      sh.vertexShader = 'uniform float uTime;\n' + sh.vertexShader.replace('#include <begin_vertex>',
        '#include <begin_vertex>\n float ph = position.x*0.35 + position.z*0.35;\n transformed.x += sin(uTime*3.1 + ph)*0.10;\n transformed.z += cos(uTime*2.7 + ph)*0.10;');
    };
    const m = new T.Mesh(flagB.build(), mat); scene.add(m);
    const lg = new T.BufferGeometry(); lg.setAttribute('position', new T.Float32BufferAttribute(ropes, 3));
    scene.add(new T.LineSegments(lg, new T.LineBasicMaterial({ color: 0x777777 })));
  }

  /* ================= parked bikes, stalls, street props ================= */
  function streetProps() {
    for (let c = 0; c < G.N; c++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c, r); if (!['city', 'thamel', 'old', 'ason', 'newroad'].includes(t)) continue;
      const R = W.blockRect(c, r);
      const sides = [[R.x0, R.z0 + 0.8, 1, 0], [R.x0, R.z1 - 0.8, 1, 0], [R.x0 + 0.8, R.z0, 0, 1], [R.x1 - 0.8, R.z0, 0, 1]];
      for (const [sx, sz, ax, az] of sides) {
        const L = ax ? R.x1 - R.x0 : R.z1 - R.z0;
        for (let s = 6; s < L - 6; s += KS.r(1.1, 5)) {
          const x = sx + ax * s, z = sz + az * s, b = W.chunk(x, z);
          const roll = KS.rng();
          if (roll < 0.55) W.parkedBike(b, x, z, ax ? Math.PI / 2 : 0);
          else if (roll < 0.6) W.stall(b, x + az * 1.5, z + ax * 1.5, ax ? 0 : Math.PI / 2);
          else if (roll < 0.63) { b.cyl(x + az * 1.4, 0.2, z + ax * 1.4, 0.4, 0.9, 0x2a6b3a, 8); }
          else s += 6;
        }
      }
    }
  }
  W.parkedBike = (b, x, z, ry) => {
    const col = KS.pick([0xb81c1c, 0x1c1c1c, 0x1d4fb8, 0xdddddd, 0x2f7d32, 0x9a9a9a, 0xe0a400]);
    const s = Math.sin(ry), c = Math.cos(ry), o = (d) => [x + s * d, z + c * d];
    let p = o(0.65); b.cyl(p[0], 0.0, p[1], 0.32, 0.12, 0x151515, 8, 1, ry + Math.PI / 2, 0, Math.PI / 2);
    p = o(-0.65); b.cyl(p[0], 0.0, p[1], 0.32, 0.12, 0x151515, 8, 1, ry + Math.PI / 2, 0, Math.PI / 2);
    b.box(x, 0.32, z, 0.32, 0.4, 1.4, col, ry); b.box(x, 0.72, z, 0.3, 0.12, 0.8, 0x111111, ry);
    p = o(0.6); b.box(p[0], 0.75, p[1], 0.75, 0.06, 0.06, 0x333333, ry);
  };
  KS.fruitStalls = [];
  W.stall = (b, x, z, ry) => { // fruit / vegetable cart with umbrella
    KS.fruitStalls.push([x, z]);
    b.box(x, 0.6, z, 2.4, 0.2, 1.3, 0x7a5232, ry);
    for (let i = 0; i < 10; i++) b.sphere(x + KS.r(-1, 1) * Math.cos(ry), 0.85, z + KS.r(-1, 1) * Math.sin(ry) + KS.r(-0.4, 0.4), 0.18, KS.pick([0xff8c1a, 0xe8d23a, 0xd12b2b, 0x5cae3a, 0xa83e8c]), 1, 6);
    b.box(x, 0, z, 0.1, 0.6, 0.1, 0x444444); b.cyl(x, 0, z, 0.04, 2.6, 0x555555, 4);
    b.cyl(x, 2.4, z, 1.6, 0.5, KS.pick([0x1d4fb8, 0xd12b2b, 0xf2c418, 0x1f9a4c]), 8, 0.05);
  };

  /* ================= Himalaya ================= */
  function mountains(scene) {
    const N = 220, pos = [], col = [], idx = [];
    const peaks = [];
    for (let i = 0; i < 26; i++) peaks.push([KS.r(-6500, 6500), KS.r(650, 1350), KS.r(250, 700)]);
    const hAt = (x) => { let h = 260 + 120 * KS.noise(x * 0.004, 3.1); for (const [px, ph, pw] of peaks) { const d = Math.abs(x - px) / pw; if (d < 1) h = Math.max(h, ph * (1 - d * d * 0.9) + 60 * KS.noise(x * 0.02, 7)); } return h; };
    const c = new T.Color();
    for (let i = 0; i <= N; i++) {
      const x = -7000 + (14000 * i) / N, h = hAt(x);
      const rows = [[-3600, 0], [-3950, h * 0.55], [-4250, h]];
      rows.forEach(([z, y], k) => {
        pos.push(x + (k === 2 ? KS.r(-20, 20) : 0), y, z + KS.r(-40, 40));
        if (k === 0) c.setHex(0x51617a); else if (k === 1) c.setHex(h > 760 ? 0xc9d3e0 : 0x6b7a90); else c.setHex(h > 600 ? 0xffffff : 0x8a97a8);
        col.push(c.r, c.g, c.b);
      });
    }
    for (let i = 0; i < N; i++) for (let k = 0; k < 2; k++) {
      const a = i * 3 + k, b = (i + 1) * 3 + k;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
    const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new T.Float32BufferAttribute(col, 3)); g.setIndex(idx);
    KS.mountainMat = new T.MeshBasicMaterial({ vertexColors: true, fog: false, transparent: true, opacity: 1, depthWrite: false });
    const m = new T.Mesh(g, KS.mountainMat); m.renderOrder = -1; scene.add(m);
    KS.mountains = m;
  }

  /* ================= build instanced city ================= */
  function buildInstanced(scene) {
    const styles = [facade(0, false), facade(1, false), facade(2, false)];
    const lits = [facade(0, true), facade(1, true), facade(2, true)];
    const roofMat = new T.MeshLambertMaterial({ color: 0xaaa59c });
    const patch = (m) => {
      m.onBeforeCompile = (sh) => {
        sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute vec2 aOff;')
          .replace('#include <uv_vertex>', '#include <uv_vertex>\n#ifdef USE_UV\n vUv += aOff;\n#endif');
      };
      m.customProgramCacheKey = () => 'ks-facade';
    };
    const wallMats = styles.map((t, i) => { const m = new T.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: lits[i], emissiveIntensity: 0 }); patch(m); KS.nightMats.push(m); return m; });
    const col = new T.Color();
    for (const k in inst) {
      const [style, floors] = k.split(':').map(Number), list = inst[k];
      const geo = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
      const uv = geo.attributes.uv;
      for (let i = 0; i < uv.count; i++) { if (i >= 8 && i < 16) continue; uv.setXY(i, uv.getX(i) * 0.25, uv.getY(i) * floors / 16); }
      const off = new Float32Array(list.length * 2); list.forEach((b, i) => { off[i * 2] = b.off[0]; off[i * 2 + 1] = b.off[1]; });
      geo.setAttribute('aOff', new T.InstancedBufferAttribute(off, 2));
      const wm = wallMats[style];
      const mesh = new T.InstancedMesh(geo, [wm, wm, roofMat, roofMat, wm, wm], list.length);
      list.forEach((b, i) => { mesh.setMatrixAt(i, b.m); mesh.setColorAt(i, col.setHex(b.color)); });
      mesh.castShadow = mesh.receiveShadow = true; mesh.frustumCulled = false; scene.add(mesh);
    }
    // shopfronts
    const shopEdge = new T.MeshLambertMaterial({ color: 0x3a3330 });
    shopInst.forEach((list, k) => {
      if (!list.length) return;
      const front = new T.MeshLambertMaterial({ map: shopTex(k), emissive: 0xffffff, emissiveMap: k === 1 ? null : null, emissiveIntensity: 0 });
      if (k !== 1) { front.emissiveMap = front.map; KS.nightMats.push(front); front.userData.nightScale = 0.55; }
      const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0), [shopEdge, shopEdge, shopEdge, shopEdge, front, shopEdge], list.length);
      list.forEach((mm, i) => m.setMatrixAt(i, mm)); m.frustumCulled = false; m.receiveShadow = true; scene.add(m);
    });
    // signs
    const signEdge = new T.MeshLambertMaterial({ color: 0x222222 });
    signInst.forEach((list, i) => {
      if (!list.length) return;
      const t = signTex(i);
      const face = new T.MeshLambertMaterial({ map: t, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0 }); face.userData.nightScale = 0.75; KS.nightMats.push(face);
      const m = new T.InstancedMesh(new T.BoxGeometry(1, 1, 1), [signEdge, signEdge, signEdge, signEdge, face, face], list.length);
      list.forEach((mm, k) => m.setMatrixAt(k, mm)); m.frustumCulled = false; scene.add(m);
    });
    const simple = (geo, mat, list, colored, shadow = true) => {
      if (!list.length) return;
      const m = new T.InstancedMesh(geo, mat, list.length);
      list.forEach((it, i) => { m.setMatrixAt(i, colored ? it.m : it); if (colored) m.setColorAt(i, col.setHex(it.color)); });
      m.frustumCulled = false; m.castShadow = shadow; m.receiveShadow = true; scene.add(m);
    };
    const ub = new T.BoxGeometry(1, 1, 1).translate(0, 0.5, 0);
    simple(ub, new T.MeshLambertMaterial({ color: 0xffffff }), balcony, true, false);
    simple(new T.CylinderGeometry(1, 1, 1, 10).translate(0, 0.5, 0), new T.MeshLambertMaterial({ color: 0x1b1b1b }), tanks, false);
    simple(ub, new T.MeshLambertMaterial({ color: 0xffffff }), cabins, true);
    simple(new T.BoxGeometry(0.08, 1, 0.08).translate(0, 0.5, 0), new T.MeshLambertMaterial({ color: 0x4a3328 }), rebar, false, false);
    simple(ub, new T.MeshLambertMaterial({ color: 0x23406a }), solar, false, false);
    simple(ub, new T.MeshLambertMaterial({ color: 0xe8e8e8 }), acs, false, false);
    KS.buildingCount = Object.values(inst).reduce((a, l) => a + l.length, 0);
  }

  /* ================= parks: lawns, paths, benches, fountain, flower beds ================= */
  W.park = (R, seed) => {
    const cx = (R.x0 + R.x1) / 2, cz = (R.z0 + R.z1) / 2, w = R.x1 - R.x0 - SW * 2, d = R.z1 - R.z0 - SW * 2, b = W.chunk(cx, cz);
    b.box(cx, 0, cz, w, 0.14, d, 0x6f9a48);
    b.box(cx, 0.14, cz, 3.4, 0.06, d, 0xc8b89a); b.box(cx, 0.14, cz, w, 0.06, 3.4, 0xc8b89a);
    b.box(cx, 0.14, cz, w * 0.62, 0.05, 2.4, 0xc8b89a, Math.PI / 4); b.box(cx, 0.14, cz, w * 0.62, 0.05, 2.4, 0xc8b89a, -Math.PI / 4);
    b.cyl(cx, 0.14, cz, 6, 0.7, 0xd9d1c0, 18); b.cyl(cx, 0.5, cz, 5.2, 0.3, 0x5a95b0, 18); b.cyl(cx, 0.5, cz, 0.6, 2.4, 0xd9d1c0, 8); b.sphere(cx, 2.9, cz, 0.9, 0xd9d1c0, 0.6, 10);
    KS.addCircle(cx, cz, 6, 0.85);
    for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
      const fx = cx + sx * w * 0.27, fz = cz + sz * d * 0.27;
      b.cyl(fx, 0.14, fz, 4, 0.5, 0x6a4a2a, 14);
      for (let k = 0; k < 14; k++) { const a = (k / 14) * Math.PI * 2; b.sphere(fx + Math.cos(a) * 3, 0.75, fz + Math.sin(a) * 3, 0.42, KS.pick([0xe23a5a, 0xf2c418, 0xffffff, 0xe86412, 0xb04ad0]), 1, 6); }
      W.tree(fx, fz, KS.r(6, 9));
      // benches facing the paths
      for (const t of [-1, 1]) { const bx = cx + sx * 6 + t * 0, bz = cz + sz * (d * 0.5 - 8) * (t > 0 ? 1 : 0.45); W.bench(b, bx + sx * 2.4, bz, sx > 0 ? -Math.PI / 2 : Math.PI / 2); }
    }
    for (let i = 0; i < 22; i++) { const x = KS.r(R.x0 + 8, R.x1 - 8), z = KS.r(R.z0 + 8, R.z1 - 8); if (Math.abs(x - cx) < 4 || Math.abs(z - cz) < 4 || Math.hypot(x - cx, z - cz) < 10) continue; W.tree(x, z, KS.r(5, 10)); }
    for (const [lx, lz] of [[cx - 4, cz - d / 3], [cx + 4, cz + d / 3], [cx - w / 3, cz + 4], [cx + w / 3, cz - 4]]) { b.cyl(lx, 0, lz, 0.1, 4.2, 0x2b2b2b, 6); b.sphere(lx, 4.3, lz, 0.35, 0xfff2c8, 1, 8); }
    KS.plazas && KS.plazas.push({ x0: R.x0 + 9, x1: R.x1 - 9, z0: R.z0 + 9, z1: R.z1 - 9, n: 9, kinds: ['elder', 'kid', 'woman', 'man', 'student', 'jogger'] });
    KS.benches = KS.benches || [];
  };
  W.bench = (b, x, z, ry) => {
    // never on the Ring Road: a bench on the carriageway is a hazard, and
    // the parks near the loop kept putting them there
    if (KS.nearRingRoad(x, z, 14)) return;
    // a real park bench when its model loaded, else the code-built one —
    // the GLB bench is placed at the end of the build, from KS.propBenches
    if (KS.Props && KS.Props.models.bench) { (KS.propBenches = KS.propBenches || []).push([x, z, ry]); }
    else {
      const s = Math.sin(ry), c = Math.cos(ry);
      b.box(x, 0.45, z, 2.2, 0.08, 0.55, 0x8a5a30, ry); b.box(x - s * 0.25, 0.53, z - c * 0.25, 2.2, 0.5, 0.08, 0x8a5a30, ry);
      b.box(x + c * 0.9, 0, z - s * 0.9, 0.08, 0.45, 0.5, 0x333333, ry); b.box(x - c * 0.9, 0, z + s * 0.9, 0.08, 0.45, 0.5, 0x333333, ry);
    }
    (KS.benchSpots = KS.benchSpots || []).push([x + Math.sin(ry) * 0.05, z + Math.cos(ry) * 0.05, ry]);
  };

  /* ================= parks & outskirts greenery ================= */
  function greenery() {
    for (let c = 0; c < G.N; c++) for (let r = 0; r < G.N; r++) {
      if (KS.blockType(c, r) !== 'park') continue;
      W.park(W.blockRect(c, r), c * 31 + r);
    }
    // forest on the valley rim (Shivapuri, Chandragiri, Nagarjun) and fields
    const hwy = (x, z, pad) => x < -540 && Math.abs(z - KS.HW.z) < pad;
    for (let i = 0; i < 2600; i++) {
      const x = KS.r(KS.BOUNDS.x0 + 20, 1380), z = KS.r(-1380, 1380), m = Math.max(Math.abs(x), Math.abs(z));
      if (m < 600 || hwy(x, z, 30)) continue;
      const MS = KS.MANSION; if (x > MS.x0 - 30 && x < MS.x1 + 30 && z > MS.z0 - 30 && z < -548) continue;
      if (Math.hypot(x - KS.HW.village.x, z - KS.HW.village.z) < 300) continue;
      if (z > KS.RIVER.z0 - 12 && z < KS.RIVER.z1 + 12) continue;
      if (x > 560 && x < 840 && Math.abs(z) < 420) continue; // airport
      const sw = KS.SWAYAMBHU; if (Math.hypot(x - sw.x, z - sw.z) < 32) continue;
      if (Math.abs(z - sw.z) < 9 && x > sw.x && x < -540) continue;
      if (m > 820 || KS.chance(0.35)) W.tree(x, z, KS.r(6, 12), m > 950 && KS.chance(0.6) ? 'pine' : 'broad');
    }
    // trees on Swayambhu hill
    const sw = KS.SWAYAMBHU;
    for (let i = 0; i < 180; i++) {
      const a = KS.r(0, Math.PI * 2), d = KS.r(34, 140), x = sw.x + Math.cos(a) * d, z = sw.z + Math.sin(a) * d;
      if (Math.abs(z - sw.z) < 9 && x > sw.x) continue;
      if (Math.abs(x - sw.x) < 6 && z > sw.z) continue; // stairway
      W.tree(x, z, KS.r(6, 11));
    }
    // outskirts village houses scattered in fields
    for (let i = 0; i < 160; i++) {
      const x = KS.r(-1000, 1000), z = KS.r(-1000, 1000), m = Math.max(Math.abs(x), Math.abs(z));
      if (m < 600 || m > 980 || hwy(x, z, 30)) continue;
      if (x > KS.MANSION.x0 - 40 && x < KS.MANSION.x1 + 40 && z > KS.MANSION.z0 - 40 && z < -548) continue;
      if (z > KS.RIVER.z0 - 20 && z < KS.RIVER.z1 + 20) continue;
      if (x > 540 && x < 860 && Math.abs(z) < 440) continue;
      if (Math.hypot(x - sw.x, z - sw.z) < 160) continue;
      if (KS.nearRingRoad(x, z, 22)) continue; // the Ring Road cuts through the outskirts: no house on the road (11 m road half-width + the house's own half-diagonal + air)
      const y = KS.heightAt(x, z), b = W.chunk(x, z), h = KS.ri(2, 4) * FLOOR, w = KS.r(7, 11), d = KS.r(7, 10), ry = KS.r(0, 3);
      b.box(x, y - 1, z, w, h + 1, d, KS.pick(P.walls), ry);
      b.box(x, y + h, z, w + 0.4, 0.3, d + 0.4, 0x9a958a, ry);
      b.cyl(x + 1, y + h + 0.3, z, 0.7, 1.4, 0x1b1b1b, 8);
      KS.addBox(x, z, Math.max(w, d), Math.max(w, d), h + y);
    }
  }

  W.build = (scene) => {
    terrain(scene);
    roads(scene);
    speedBreakers(scene);
    ringMedian(scene);
    for (let c = 0; c < G.N; c++) for (let r = 0; r < G.N; r++) buildBlock(c, r);
    greenery();
    streetProps();
    streetFurniture(scene);
    if (KS.Landmarks) KS.Landmarks.build(scene, W);
    if (KS.Extras) KS.Extras.build(scene, W);
    if (KS.Signs) KS.Signs.build(scene, W);
    if (KS.Places) { KS.Places.buildJharna(scene); KS.Places.buildMansion(scene); }
    if (KS.Mountains) KS.Mountains.build(scene); // the snow peak, the paragliding hill, the trekking path (before the flags are built, so its prayer flags render)
    if (KS.Fuel) KS.Fuel.build(scene); // petrol stations on street corners and the Ring Road
    if (KS.Weapons) KS.Weapons.build(scene); // weapon shops near New Road, Thamel and Chabahil
    // Thamel: prayer flags & festival lights criss-crossing the streets.
    // Each string must span the WHOLE road (16 m) and anchor in the building
    // faces on both sides — a string that starts mid-road reads as flags
    // hanging in thin air. The road along a block edge runs from
    // R.z0 - G.ROAD to R.z0, so the far end sits half a metre past the far
    // edge and the near end half a metre inside the near block.
    for (const [c, r] of [[4, 2], [4, 3], [5, 3], [3, 3]]) {
      const R = W.blockRect(c, r);
      for (let s = R.x0 + 10; s < R.x1 - 5; s += 14) W.flags([s, 9 + KS.r(0, 3), R.z0 - G.ROAD - 0.5], [s + KS.r(-4, 4), 9 + KS.r(0, 3), R.z0 + 0.5], 1.0, 0.8);
      for (let s = R.z0 + 10; s < R.z1 - 5; s += 14) W.flags([R.x0 - G.ROAD - 0.5, 9 + KS.r(0, 3), s], [R.x0 + 0.5, 9 + KS.r(0, 3), s + KS.r(-4, 4)], 1.0, 0.8);
    }
    buildInstanced(scene);
    buildTrees(scene);
    buildFlags(scene);
    // the real park benches: one GLB clone per bench spot recorded while building
    if (KS.Props && KS.Props.models.bench) {
      for (const [x, z, ry] of (KS.propBenches || [])) {
        const m = KS.Props.build('bench'); if (!m) continue;
        m.position.set(x, KS.heightAt(x, z) + 0.05, z); m.rotation.y = ry; scene.add(m);
        if (KS.Damage && KS.Damage.registerProp) KS.Damage.registerProp(m, x, z, 'bench');
      }
    }
    mountains(scene);
    W.flushChunks(scene);
  };
})();
