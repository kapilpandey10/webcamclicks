/* Kathmandu Streets — sky, day/night cycle, clouds, monsoon rain, thunderstorms, winter fog and smog. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const Wx = (KS.Weather = {});
  Wx.TYPES = {
    clear: { name: 'Clear', np: 'घमाइलो', icon: '☀', cloud: 0.18, dark: 0, rain: 0, near: 260, far: 2600, mtn: 1, wind: 2, temp: 2, aqi: 78 },
    cloudy: { name: 'Cloudy', np: 'बदली', icon: '☁', cloud: 0.7, dark: 0.28, rain: 0, near: 220, far: 1900, mtn: 0.4, wind: 3.5, temp: 0, aqi: 104 },
    haze: { name: 'Dust & Smog', np: 'धुलो धुवाँ', icon: '🌫', cloud: 0.25, dark: 0.12, rain: 0, near: 40, far: 650, mtn: 0.06, wind: 1, temp: 1, aqi: 186, fogColor: 0xbba98c },
    rain: { name: 'Monsoon Rain', np: 'झरी', icon: '🌧', cloud: 0.96, dark: 0.55, rain: 0.6, near: 60, far: 900, mtn: 0, wind: 5, temp: -4, aqi: 42 },
    storm: { name: 'Thunderstorm', np: 'चट्याङ', icon: '⛈', cloud: 1, dark: 0.75, rain: 1, near: 40, far: 600, mtn: 0, wind: 11, temp: -6, aqi: 38, lightning: true },
    fog: { name: 'Winter Fog', np: 'हुस्सु', icon: '🌁', cloud: 0.5, dark: 0.2, rain: 0, near: 6, far: 170, mtn: 0, wind: 0.6, temp: -7, aqi: 142, fogColor: 0xd5dade },
  };
  Wx.ORDER = ['clear', 'cloudy', 'haze', 'rain', 'storm', 'fog'];
  const cur = { cloud: 0.18, dark: 0, rain: 0, near: 260, far: 2600, mtn: 1, wind: 2, temp: 2, aqi: 78, fogMix: 0 };
  Wx.cur = cur; Wx.type = 'clear'; Wx.auto = true; Wx.timer = 160;
  KS.time = 8.5; KS.timeSpeed = 24 / (16 * 60); // a full day in 16 minutes
  let flash = 0, nextBolt = 6, thunderAt = -1, fogColor = new T.Color(0xd5dade), hazeColor = new T.Color(0xbba98c);

  Wx.set = (type) => { Wx.type = type; Wx.timer = KS.r(150, 260); };
  Wx.next = () => Wx.set(Wx.ORDER[(Wx.ORDER.indexOf(Wx.type) + 1) % Wx.ORDER.length]);

  Wx.init = (scene, renderer) => {
    Wx.scene = scene;
    scene.fog = new T.Fog(0xbcd6ee, 260, 2600);
    // sky dome
    Wx.skyU = { top: { value: new T.Color() }, horizon: { value: new T.Color() }, ground: { value: new T.Color(0x6b6a60) }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: new T.Color(0xffeed0) }, sunAmt: { value: 1 }, moonDir: { value: new T.Vector3(0, -1, 0) }, moonAmt: { value: 0 } };
    const sky = new T.Mesh(new T.SphereGeometry(8000, 32, 16), new T.ShaderMaterial({
      uniforms: Wx.skyU, side: T.BackSide, depthWrite: false, fog: false,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `uniform vec3 top, horizon, ground, sunCol, sunDir, moonDir; uniform float sunAmt, moonAmt; varying vec3 vDir;
        void main(){ vec3 d = normalize(vDir); float h = d.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.5)) : mix(horizon, ground, clamp(-h*5.0,0.0,1.0));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunCol * (pow(s, 1400.0) * 3.0 + pow(s, 14.0) * 0.32 + pow(s, 3.0) * 0.08) * sunAmt;
          float m = max(dot(d, normalize(moonDir)), 0.0);
          c += vec3(0.92,0.95,1.0) * (smoothstep(0.99935, 0.9997, m) * 1.25 + pow(m, 400.0) * 0.25 + pow(m, 40.0) * 0.07) * moonAmt;
          gl_FragColor = vec4(c, 1.0); }`,
    }));
    sky.renderOrder = -2; sky.frustumCulled = false; scene.add(sky); Wx.sky = sky;
    // stars
    const sp = [];
    for (let i = 0; i < 1600; i++) { const a = KS.r(0, Math.PI * 2), y = KS.r(0.05, 1), r = Math.sqrt(1 - y * y); sp.push(Math.cos(a) * r * 7000, y * 7000, Math.sin(a) * r * 7000); }
    const sg = new T.BufferGeometry(); sg.setAttribute('position', new T.Float32BufferAttribute(sp, 3));
    Wx.starMat = new T.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false });
    Wx.stars = new T.Points(sg, Wx.starMat); Wx.stars.renderOrder = -1; Wx.stars.frustumCulled = false; scene.add(Wx.stars);
    // lights
    Wx.hemi = new T.HemisphereLight(0xcfe3ff, 0x8a7a60, 0.5); scene.add(Wx.hemi);
    Wx.sun = new T.DirectionalLight(0xfff1d8, 1);
    Wx.sun.castShadow = KS.quality.shadows;
    Wx.sun.shadow.mapSize.set(KS.quality.shadowSize, KS.quality.shadowSize);
    const sc = Wx.sun.shadow.camera; sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 700;
    Wx.sun.shadow.bias = -0.0008;
    scene.add(Wx.sun); scene.add(Wx.sun.target);
    // clouds
    Wx.cloudMat = new T.MeshLambertMaterial({ color: 0xffffff, emissive: 0x888888, transparent: true, opacity: 0.92, fog: false, depthWrite: false });
    Wx.clouds = [];
    for (let i = 0; i < 70; i++) {
      const b = new KS.Builder(), n = KS.ri(5, 9), w = KS.r(60, 160);
      for (let k = 0; k < n; k++) b.sphere(KS.r(-w / 2, w / 2), KS.r(-6, 8), KS.r(-w / 4, w / 4), KS.r(18, 40), 0xffffff, KS.r(0.45, 0.7), 10);
      const m = new T.Mesh(b.build(), Wx.cloudMat); m.position.set(KS.r(-2600, 2600), KS.r(300, 460), KS.r(-2600, 2600)); m.renderOrder = 1;
      m.userData.base = m.position.y; scene.add(m); Wx.clouds.push(m);
    }
    // rain streaks
    const N = 3600; Wx.rainN = N;
    Wx.rainPos = new Float32Array(N * 6); Wx.rainDrops = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { Wx.rainDrops[i * 3] = KS.r(-60, 60); Wx.rainDrops[i * 3 + 1] = KS.r(0, 55); Wx.rainDrops[i * 3 + 2] = KS.r(-60, 60); }
    const rg = new T.BufferGeometry(); rg.setAttribute('position', new T.BufferAttribute(Wx.rainPos, 3));
    Wx.rain = new T.LineSegments(rg, new T.LineBasicMaterial({ color: 0xb4c6d8, transparent: true, opacity: 0.5 }));
    Wx.rain.frustumCulled = false; scene.add(Wx.rain);
    // lightning bolt
    Wx.boltGeo = new T.BufferGeometry(); Wx.boltGeo.setAttribute('position', new T.BufferAttribute(new Float32Array(64 * 6), 3));
    Wx.bolt = new T.LineSegments(Wx.boltGeo, new T.LineBasicMaterial({ color: 0xe8f0ff, fog: false, transparent: true, opacity: 0 }));
    Wx.bolt.frustumCulled = false; scene.add(Wx.bolt);
  };

  const C = (h) => new T.Color(h);
  const SKY = {
    day: [C(0x3f82d8), C(0xbfd8ee)], gold: [C(0x4d70b0), C(0xf4b27c)], dusk: [C(0x232f5c), C(0xd8785e)], night: [C(0x0c1736), C(0x2a3d6e)], // moonlit blue, not black
  };
  const tTop = new T.Color(), tHor = new T.Color(), tmp = new T.Color(), grey = new T.Color(0x8c939a), greyH = new T.Color(0xaeb3b7);
  function skyAt(sunY, top, hor) {
    if (sunY > 0.3) { top.copy(SKY.day[0]); hor.copy(SKY.day[1]); }
    else if (sunY > 0) { const t = sunY / 0.3; top.copy(SKY.gold[0]).lerp(SKY.day[0], t); hor.copy(SKY.gold[1]).lerp(SKY.day[1], t); }
    else if (sunY > -0.18) { const t = -sunY / 0.18; top.copy(SKY.gold[0]).lerp(SKY.dusk[0], t * 0.6).lerp(SKY.night[0], Math.max(0, t - 0.5) * 2); hor.copy(SKY.gold[1]).lerp(SKY.dusk[1], Math.min(1, t * 1.4)).lerp(SKY.night[1], Math.max(0, t - 0.4) / 0.6); }
    else { top.copy(SKY.night[0]); hor.copy(SKY.night[1]); }
  }
  const sunDir = new T.Vector3();
  Wx.update = (dt, camera, ctx) => {
    // weather state machine
    if (Wx.auto) { Wx.timer -= dt; if (Wx.timer <= 0) { const opts = KS.time > 4 && KS.time < 9 ? ['fog', 'haze', 'clear', 'cloudy'] : ['clear', 'clear', 'cloudy', 'haze', 'rain', 'storm']; Wx.set(KS.pick(opts.filter((o) => o !== Wx.type))); } }
    const tgt = Wx.TYPES[Wx.type], k = Math.min(1, dt * 0.25);
    for (const key of ['cloud', 'dark', 'rain', 'near', 'far', 'mtn', 'wind', 'temp', 'aqi']) cur[key] += (tgt[key] - cur[key]) * k;
    cur.fogMix += ((Wx.type === 'fog' ? 1 : 0) - cur.fogMix) * k; cur.hazeMix = (cur.hazeMix || 0) + ((Wx.type === 'haze' ? 1 : 0) - (cur.hazeMix || 0)) * k;
    // time
    const tm = KS.Settings && KS.Settings.data().timeMode;
    if (tm === 'real') { const n = new Date(Date.now() + (5 * 60 + 45) * 60000); KS.time = n.getUTCHours() + n.getUTCMinutes() / 60 + n.getUTCSeconds() / 3600; } // Nepal time, UTC+5:45
    else KS.time = (KS.time + dt * KS.timeSpeed * (tm === 'slow' ? 0.25 : 1)) % 24;
    const th = ((KS.time - 6) / 12) * Math.PI;
    sunDir.set(Math.cos(th), Math.sin(th), 0.42).normalize();
    const sunY = sunDir.y;
    const day = KS.smooth(-0.06, 0.25, sunY), night = 1 - KS.smooth(-0.14, 0.1, sunY);
    KS.night = Math.max(night, cur.dark * 0.35); KS.day = day;
    // sky colours, then weather grading
    skyAt(sunY, tTop, tHor);
    const ov = cur.cloud * 0.85 * (Wx.type === 'clear' ? 0.4 : 1);
    tmp.copy(grey).multiplyScalar(0.35 + day * 0.65); tTop.lerp(tmp, ov * 0.9);
    tmp.copy(greyH).multiplyScalar(0.3 + day * 0.7); tHor.lerp(tmp, ov * 0.85);
    tmp.copy(hazeColor).multiplyScalar(0.25 + day * 0.75); tHor.lerp(tmp, cur.hazeMix * 0.85); tTop.lerp(tmp, cur.hazeMix * 0.5);
    tmp.copy(fogColor).multiplyScalar(0.25 + day * 0.75); tHor.lerp(tmp, cur.fogMix * 0.95); tTop.lerp(tmp, cur.fogMix * 0.8);
    tTop.multiplyScalar(1 - cur.dark * 0.5); tHor.multiplyScalar(1 - cur.dark * 0.45);
    if (flash > 0) { tTop.lerp(C(0xdde6ff), flash * 0.7); tHor.lerp(C(0xdde6ff), flash * 0.7); }
    const U = Wx.skyU;
    U.top.value.copy(tTop); U.horizon.value.copy(tHor); U.ground.value.copy(tHor).multiplyScalar(0.7);
    U.sunDir.value.copy(sunDir); U.sunAmt.value = KS.smooth(-0.1, 0.05, sunY) * (1 - cur.cloud * 0.85);
    U.sunCol.value.setHex(sunY < 0.2 ? 0xffa860 : 0xfff0d0);
    U.moonDir.value.set(-sunDir.x, Math.max(0.25, -sunDir.y), 0.3); U.moonAmt.value = night * (1 - cur.cloud * 0.9);
    Wx.sky.position.copy(camera.position); Wx.stars.position.copy(camera.position);
    Wx.starMat.opacity = night * (1 - cur.cloud) * (1 - cur.hazeMix * 0.6);
    // fog
    const f = Wx.scene.fog; f.color.copy(tHor); f.near = cur.near; f.far = cur.far * (0.7 + 0.3 * (1 - night * 0.4));
    // lights
    const sun = Wx.sun;
    if (sunY > -0.05) {
      sun.color.setHex(sunY < 0.18 ? 0xffb27a : 0xfff1d8); sun.intensity = KS.smooth(-0.05, 0.2, sunY) * (1 - cur.dark * 0.8) * 1.05;
      sun.position.copy(ctx.focus).addScaledVector(sunDir, 400);
    } else {
      sun.color.setHex(0xb4c8ff); sun.intensity = 0.62 * (1 - cur.cloud * 0.6); // moonlight
      sun.position.copy(ctx.focus).add(tmpV.set(-sunDir.x, -sunDir.y, 0.3).normalize().multiplyScalar(400));
    }
    sun.target.position.copy(ctx.focus);
    Wx.hemi.intensity = (0.3 + day * 0.34 + night * 0.28) * (1 - cur.dark * 0.3) + flash * 1.2;
    Wx.hemi.color.copy(tTop).lerp(C(0xffffff), 0.45).lerp(C(0x8ea4e0), night * 0.6); Wx.hemi.groundColor.setHex(0x7a6a50).multiplyScalar(0.45 + day * 0.55);
    // Himalaya: visible on clear days, alpenglow at dawn & dusk, hidden by monsoon cloud and smog
    if (KS.mountainMat) {
      KS.mountainMat.opacity = cur.mtn * (0.35 + 0.65 * day);
      const glow = sunY > -0.05 && sunY < 0.22 ? 1 - Math.abs(sunY - 0.08) / 0.14 : 0;
      KS.mountainMat.color.setRGB(1, 1, 1).lerp(C(0xffa088), Math.max(0, glow) * 0.6).multiplyScalar(0.28 + day * 0.72).lerp(tHor, 0.25 + (1 - cur.mtn) * 0.4);
    }
    // clouds
    const cloudCount = Math.round(cur.cloud * Wx.clouds.length);
    Wx.cloudMat.color.setRGB(1, 1, 1).multiplyScalar(1 - cur.dark * 0.6);
    Wx.cloudMat.emissive.copy(tHor).multiplyScalar(0.55 + flash);
    Wx.clouds.forEach((m, i) => {
      m.visible = i < cloudCount;
      m.position.x += cur.wind * dt * 3; if (m.position.x > camera.position.x + 2700) m.position.x -= 5400;
      if (m.position.x < camera.position.x - 2700) m.position.x += 5400;
      if (Math.abs(m.position.z - camera.position.z) > 2700) m.position.z = camera.position.z + KS.r(-2600, 2600);
      m.position.y = m.userData.base - cur.dark * 120;
    });
    // rain
    const N = Math.floor(Wx.rainN * cur.rain), rp = Wx.rainPos, rd = Wx.rainDrops, cp = camera.position;
    const vx = cur.wind * 0.6, vy = -26, len = 0.045;
    for (let i = 0; i < N; i++) {
      let y = rd[i * 3 + 1] + vy * dt; let x = rd[i * 3] + vx * dt;
      if (y < -2) { y = KS.r(35, 55); x = KS.r(-60, 60); rd[i * 3 + 2] = KS.r(-60, 60); }
      rd[i * 3] = x; rd[i * 3 + 1] = y;
      const wx = cp.x + x, wy = cp.y - 10 + y, wz = cp.z + rd[i * 3 + 2];
      rp[i * 6] = wx; rp[i * 6 + 1] = wy; rp[i * 6 + 2] = wz; rp[i * 6 + 3] = wx - vx * len; rp[i * 6 + 4] = wy - vy * len; rp[i * 6 + 5] = wz;
    }
    Wx.rain.geometry.setDrawRange(0, N * 2); Wx.rain.geometry.attributes.position.needsUpdate = true; Wx.rain.visible = N > 0;
    Wx.rain.material.color.setHex(night > 0.5 ? 0x5a6a7a : 0xb4c6d8);
    // lightning
    flash = Math.max(0, flash - dt * 3.5);
    if (Wx.bolt.material.opacity > 0) Wx.bolt.material.opacity = Math.max(0, Wx.bolt.material.opacity - dt * 5);
    if (Wx.TYPES[Wx.type].lightning && cur.rain > 0.6) {
      nextBolt -= dt;
      if (nextBolt <= 0) {
        nextBolt = KS.r(3, 11); flash = KS.r(0.6, 1);
        const bx = cp.x + KS.r(-900, 900), bz = cp.z + KS.r(-900, 900), dist = Math.hypot(bx - cp.x, bz - cp.z);
        const pa = Wx.boltGeo.attributes.position.array; let x = bx, y = 380, z = bz, n = 0;
        while (y > 0 && n < 60) { const nx = x + KS.r(-30, 30), ny = y - KS.r(12, 28), nz = z + KS.r(-30, 30); pa.set([x, y, z, nx, ny, nz], n * 6); x = nx; y = ny; z = nz; n++; }
        Wx.boltGeo.setDrawRange(0, n * 2); Wx.boltGeo.attributes.position.needsUpdate = true; Wx.bolt.material.opacity = 1;
        thunderAt = dist / 340 + 0.15; Wx.thunderVol = Math.max(0.25, 1 - dist / 1400);
      }
    }
    if (thunderAt > 0) { thunderAt -= dt; if (thunderAt <= 0) KS.audio && KS.audio.thunder(Wx.thunderVol); }
    // night lighting of the city
    const nightGlow = Math.max(night, cur.dark * 0.45 + cur.fogMix * 0.2);
    for (const m of KS.nightMats) m.emissiveIntensity = nightGlow * 0.85 * (m.userData.nightScale || 1);
    for (const m of KS.lampMats) m.color.setRGB(0.33, 0.33, 0.3).lerp(C(0xffe0a0), nightGlow);
    if (KS.poolMat) KS.poolMat.opacity = nightGlow * 0.85;
    if (KS.beamPoolMat) {
      KS.beamPoolMat.opacity = nightGlow * 0.42 * (1 - cur.fogMix * 0.3);
      const on = nightGlow > 0.3; if (on !== Wx.beamsOn) { Wx.beamsOn = on; for (const m of KS.beams) m.visible = on; }
      if (KS.glowPoints) { if (!KS.glowPoints.parent) Wx.scene.add(KS.glowPoints); KS.glowPoints.visible = on; KS.glowPoints.material.opacity = nightGlow; if (on) KS.updateGlows(camera.position); }
    }
    // wet streets
    const wet = cur.rain;
    if (KS.roadMats) for (const m of KS.roadMats) m.color.setScalar(1 - wet * 0.32);
    Wx.wet = wet;
  };
  const tmpV = new T.Vector3();
  Wx.describe = () => { const t = Wx.TYPES[Wx.type]; return { ...t, temp: Math.round(14 + 9 * Math.sin(((KS.time - 9) / 24) * Math.PI * 2) + cur.temp), aqi: Math.round(cur.aqi) }; };
})();
