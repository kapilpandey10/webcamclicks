/* Kathmandu Streets — realistic GLB props: chairs, benches, potted plants,
   computers and hospital beds. Real models, not code-built boxes: the park
   benches, the hospital's waiting chairs and ward beds, the doctors'
   computers and the potted plants around the city are all real 3D models,
   found through the free 3D Asset Server API (https://3d.shep.bot, no key).
   - Park Bench by Polyfork, royalty-free
   - Consultation Chair, Potted Plant, 24" portrait monitor and Adjustable
     Ward Bed by 3D Assets, CC0
   One GLB per prop lives in models/props/ next to this file. Each model is
   normalised once (centred, standing on the ground) and cloned per use.
   If a prop file cannot be loaded, the game falls back to the code-built
   version for that prop — a park is never left without benches. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const DIR = 'js/games/kathmandu/models/props/';
  const MAP = {
    bench: 'bench.glb', chair: 'chair.glb', plant: 'potted-plant.glb',
    computer: 'computer.glb', bed: 'hospital-bed.glb',
    templebell: 'temple-bell.glb', // round 23: "Temple bell on frame" (Indian Bazaar Street and Temple) by 3D Assets, CC0 — stone base, timber frame, a brass bell that swings
  };
  const P = (KS.Props = { ready: false, models: {} });

  function normalise(wrap) {
    const box = new T.Box3().setFromObject(wrap);
    const c = new T.Vector3(); box.getCenter(c);
    wrap.position.x -= c.x; wrap.position.z -= c.z; wrap.position.y -= box.min.y;
    wrap.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  }
  P.load = () => {
    if (P._loading) return P._loading;
    P._loading = new Promise((resolve) => {
      if (typeof T.GLTFLoader !== 'function') { KS.log && KS.log('GLTFLoader missing — no props'); resolve(false); return; }
      const loader = new T.GLTFLoader(), jobs = [];
      for (const [name, file] of Object.entries(MAP)) {
        jobs.push(new Promise((res) => {
          loader.load(DIR + file, (gltf) => {
            { const lights = []; gltf.scene.traverse((o) => { if (o.isLight) lights.push(o); }); lights.forEach((o) => o.parent && o.parent.remove(o)); } // no lamps baked into model files
            const wrap = new T.Group(); wrap.add(gltf.scene);
            normalise(wrap);
            if (name === 'templebell') P.polishBrass(wrap);
            P.models[name] = wrap; res(true);
          }, undefined, () => { KS.log && KS.log('prop model failed: ' + file); res(false); });
        }));
      }
      Promise.all(jobs).then(() => { P.ready = true; resolve(true); });
    });
    return P._loading;
  };
  /* metal needs something to reflect, or it renders dark: a small sky cube
     (blue above, warm haze at the horizon, brown earth below) gives the
     brass its shine and its warm highlights. */
  P.skyEnv = () => {
    if (P._env) return P._env;
    const face = (top, mid, bot) => KS.canvas(64, 64, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, top); gr.addColorStop(0.55, mid); gr.addColorStop(1, bot); g.fillStyle = gr; g.fillRect(0, 0, w, h); });
    const side = face('#7fb0e8', '#f3dcb0', '#6b5a40');
    const env = new T.CubeTexture([side, side, face('#9cc4f0', '#9cc4f0', '#9cc4f0'), face('#5a4a34', '#5a4a34', '#5a4a34'), side, side]);
    env.needsUpdate = true; P._env = env; return env;
  };
  P.polishBrass = (wrap) => {
    wrap.traverse((o) => {
      if (!o.isMesh) return;
      for (const m of [].concat(o.material)) if (m && /brass/i.test(m.name || '')) { m.envMap = P.skyEnv(); m.envMapIntensity = 1.3; m.metalness = 0.95; m.roughness = 0.26; m.color.setRGB(0.86, 0.66, 0.26); m.needsUpdate = true; }
    });
  };
  /** a fresh clone of a prop, or null when its model did not load */
  P.build = (name) => {
    const m = P.models[name]; if (!m) return null;
    return m.clone(true);
  };
  /** size of the normalised model (for placing things on top of it) */
  P.size = (name) => {
    const m = P.models[name]; if (!m) return null;
    const box = new T.Box3().setFromObject(m), s = new T.Vector3(); box.getSize(s);
    return s;
  };
})();
