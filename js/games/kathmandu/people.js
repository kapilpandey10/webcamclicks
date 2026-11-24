/* Kathmandu Streets — people & animals. Characters are built from rounded parts with faces, hair styles and
   Nepali clothing (kurta suruwal, sari, daura suruwal with dhaka topi, school uniforms, monks' robes),
   with curated colour palettes per role. Also: fighting reactions, cows, dogs, goats, chickens, pigeons, monkeys. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G, P = KS.palette;
  const SKIN = [0xc8916a, 0xb98159, 0xd6a27c, 0xa87250, 0xe0b18c, 0xbd8a63, 0x9c6a48];
  const SKIN_T = [0xf1cfb4, 0xe9bd9c, 0xf6dcc8, 0x8a5a3a, 0xd9a882, 0xc8946e];
  const HAIR = [0x161210, 0x1c1612, 0x221a14, 0x2a2018];
  const SHIRTS = [0xf4f2ec, 0xdfe7ef, 0xc9d6e6, 0xe9e1cf, 0x8aa0b8, 0x5a6a7a, 0x7a2a2a, 0x2f4a6a, 0xd8cfb8, 0x6a7a5a];
  const PANTS = [0x23283a, 0x2e2e2e, 0x3a3a46, 0x4a4a52, 0x6b5f4a, 0x1e2a3a, 0x3a3328];
  const JACKETS = [0x1c1c1c, 0x3a2a20, 0x23314a, 0x4a4a3a, 0x5a1e1e, 0x2f3f2f];
  const KURTA = [0x7a1f3a, 0x0f6b6b, 0xc8962a, 0xd88aa8, 0xe9dcc4, 0x23315a, 0x8a3a6a, 0x3a6a3a, 0xb0472e, 0x5a2a6a];
  const SARI = [0xb3122e, 0xd0306a, 0xe08a1a, 0x1f7a5a, 0x6a1f7a, 0xc8102e, 0x2a5aa8, 0xa83a1a];
  const LINES = {
    greet: ['Namaste!', 'Namaskar 🙏', 'K cha dai?', 'Sanchai?', 'Khana khanu bhayo?', 'Aaja jam cha!', 'Chiya khane?'],
    angry: ['Oi! Bistarai!', 'Aankha chaina?', 'Hey! Careful!', 'Ke garya ho?!', 'Hare Shiva!', 'Dhyan dinus na!'],
    hurt: ['Aiya!', 'Ow!', 'Ke gareko?!', 'Aama!', 'Police bolau?!'],
    fight: ['Aija! Aija!', 'Ma pani dekhauchhu!', 'Ke herchas?!'],
    flee: ['Bachau!', 'Police! Police!', 'Bhaag!'],
    tourist: ['Hello! Momo?', 'Which way to Thamel?', 'Namaste! 🙏', 'What a view!', 'Is this Durbar Square?'],
    monk: ['Om mani padme hum', 'Tashi delek 🙏'],
    vendor: ['Momo, momo, taja momo!', 'Taja tarkari!', 'Pashmina, sasto!', 'Chiya, garam chiya!'],
    police: ['Rok! Rok!', 'Side ma lagaunus!', 'License dekhaunus!'],
    sadhu: ['Bam Bam Bhole!', 'Har Har Mahadev', 'Photo? Dakshina!'],
    kid: ['Goal!', 'Dai, ball!', 'Hello! Hello!'],
    farmer: ['Dhan ramro bhayo!', 'Bazaar jane ho?', 'Gaun ma swagat!'],
  };
  KS.LINES = LINES;

  /* ---------------- speech bubbles (DOM, projected) ---------------- */
  const bubbles = [];
  KS.say = (obj, text, dur = 2.6, cls = '') => {
    const layer = document.getElementById('bubbles'); if (!layer) return;
    let b = bubbles.find((x) => x.obj === obj);
    if (!b) { const el = document.createElement('div'); el.className = 'bubble ' + cls; layer.appendChild(el); b = { el, obj }; bubbles.push(b); }
    b.el.textContent = text; b.t = dur; b.el.className = 'bubble ' + cls;
    if (KS.audio && KS.Player && obj.getWorldPosition) {
      obj.getWorldPosition(_v); const d = Math.hypot(_v.x - KS.Player.x, _v.z - KS.Player.z);
      if (d < 26 && obj !== (KS.Player.person && KS.Player.person.root)) {
        // a real (browser text-to-speech) voice when available, otherwise the synthesised murmur
        const spoken = KS.Speech && !(obj.userData && obj.userData.net) && KS.Speech.say(text, { dist: d, who: obj.userData && obj.userData.voice, angry: cls === 'angry' });
        if (!spoken) KS.audio.voice(1 - d / 26, cls === 'angry' ? 'angry' : 'talk');
      }
    }
  };
  const _v = new T.Vector3();
  KS.updateBubbles = (dt, camera, W, H) => {
    for (let i = bubbles.length - 1; i >= 0; i--) {
      const b = bubbles[i]; b.t -= dt;
      if (b.t <= 0) { b.el.remove(); bubbles.splice(i, 1); continue; }
      b.obj.getWorldPosition(_v); _v.y += 2.3; _v.project(camera);
      const vis = _v.z < 1 && Math.abs(_v.x) < 1.1 && Math.abs(_v.y) < 1.1;
      b.el.style.display = vis ? 'block' : 'none';
      if (vis) b.el.style.transform = `translate(${((_v.x + 1) / 2) * W}px, ${((1 - _v.y) / 2) * H}px) translate(-50%, -100%)`;
      b.el.style.opacity = Math.min(1, b.t * 2);
    }
  };

  /* ---------------- outfits ---------------- */
  /** a coherent outfit for a role. Fields are read by makePerson. */
  KS.outfitFor = (kind) => {
    const P_ = KS.pick, c = KS.chance;
    const o = { kind, skin: P_(SKIN), hair: P_(HAIR), hairStyle: 'short', top: P_(SHIRTS), topStyle: 'shirt', bottom: P_(PANTS), bottomStyle: 'pants', shoes: P_([0x1a1a1a, 0x3a2414, 0x5a3a22]), hat: null, hatColor: 0, bag: null, scarf: null, glasses: false, build: KS.r(0.95, 1.05), height: KS.r(0.95, 1.04) };
    switch (kind) {
      case 'woman':
        o.hairStyle = P_(['braid', 'bun', 'long', 'long']); o.height *= 0.94; o.tika = true;
        if (c(0.55)) { o.topStyle = 'kurta'; o.top = P_(KURTA); o.bottom = P_([0xf2ede0, 0xe9dcc4, 0x23283a, o.top]); o.bottomStyle = 'suruwal'; o.scarf = P_([0xf2ede0, 0xd8b8a0, 0xc8962a, 0x7a1f3a, 0x23315a]); }
        else { o.topStyle = 'blouse'; o.top = P_(SARI); o.bottomStyle = 'sari'; o.bottom = o.top; o.scarf = o.top; }
        o.shoes = P_([0x3a2414, 0x8a5a3a, 0xc8a080]); if (c(0.3)) o.bag = 'handbag'; break;
      case 'elder':
        o.hair = P_([0xd8d8d0, 0xb8b8b0, 0xeeeeea]); o.hairStyle = c(0.3) ? 'bald' : 'short'; o.height *= 0.96;
        if (c(0.6)) { o.topStyle = 'daura'; o.top = P_([0xf2ede0, 0xe6dcc8, 0xd8ccb0]); o.bottom = o.top; o.bottomStyle = 'suruwal'; o.coat = P_([0x2a2a2a, 0x3a3328, 0x23314a]); o.hat = 'topi'; }
        else { o.top = P_([0x8a7a60, 0x5a5a5a, 0xe9e1cf]); o.hat = c(0.6) ? 'topi' : null; o.cane = true; }
        break;
      case 'grandma':
        o.hair = P_([0xd8d8d0, 0xb8b8b0]); o.hairStyle = 'bun'; o.height *= 0.9; o.topStyle = 'blouse'; o.top = P_([0x7a1f1f, 0x3a2a4a, 0x2a4a3a]); o.bottomStyle = 'sari'; o.bottom = P_([0x5a1a1a, 0x2a2a3a, 0x6a3a1a]); o.scarf = 0xe9dcc4; o.tika = true; o.cane = true; break;
      case 'office':
        o.top = P_([0xf4f2ec, 0xdfe7ef, 0xc9d6e6, 0xf0e8f0]); o.bottom = P_([0x23283a, 0x2e2e2e, 0x3a3a46]); o.tie = P_([0x7a1f1f, 0x1d3a6a, 0x2a2a2a]); o.lanyard = true; if (c(0.4)) { o.topStyle = 'jacket'; o.jacket = P_([0x23283a, 0x2e2e2e]); } break;
      case 'student':
        o.top = 0xf4f4f4; o.bottom = P_([0x1e2a5a, 0x4a4a52]); o.tie = 0x7a1f1f; o.bag = 'backpack'; o.bagColor = P_([0x1d4fb8, 0xc81e1e, 0x333333]); o.height *= 0.93;
        if (c(0.5)) { o.bottomStyle = 'skirt'; o.hairStyle = P_(['braid', 'bun']); } break;
      case 'tourist':
        o.skin = P_(SKIN_T); o.hair = P_([0xd8b860, 0x8a5a2a, 0x3a2a1a, 0xb8b8b0, 0xc89a5a]); o.hairStyle = c(0.4) ? 'long' : 'short';
        o.topStyle = 'jacket'; o.jacket = P_([0xc81e1e, 0x1d4fb8, 0xe86412, 0x1f8a4c, 0xf2c418, 0x0a8a9a]); o.top = 0xe0e0e0;
        o.bottom = P_([0x6b6b5a, 0x2a2f45, 0xc8b890]); if (c(0.3)) o.bottomStyle = 'shorts'; o.bag = 'backpack'; o.bagColor = P_([0x333333, 0x4a5a3a, 0xc81e1e, 0x1d4fb8]);
        o.hat = c(0.5) ? P_(['cap', 'sunhat']) : null; o.hatColor = P_([0xf2e6c8, 0x333333, 0x1d4fb8]); o.glasses = c(0.5); o.height *= KS.r(1, 1.08); o.shoes = 0x5a4a3a; break;
      case 'monk':
        o.hairStyle = 'bald'; o.hair = o.skin; o.topStyle = 'robe'; o.top = P.maroon; o.bottom = P.maroon; o.bottomStyle = 'skirt'; o.vest = P.saffron; o.shoes = 0x5a3a22; break;
      case 'sadhu':
        o.hairStyle = 'bun'; o.hair = 0x3a3028; o.beard = 0x8a8070; o.topStyle = 'robe'; o.top = KS.pick([0xe86412, 0xf2a516, 0xd84315]); o.bottom = o.top; o.bottomStyle = 'skirt'; o.tilak = true; o.shoes = o.skin; break;
      case 'porter':
        o.top = P_([0x5a5a4a, 0x6a5a40, 0x4a4a52]); o.bottom = P_([0x3a3328, 0x4a4a42]); o.bottomStyle = 'shorts'; o.bag = 'doko'; o.hat = c(0.5) ? 'topi' : null; o.shoes = o.skin; break;
      case 'farmer':
        if (c(0.5)) { o.topStyle = 'blouse'; o.top = P_([0x7a1f1f, 0x2a4a3a, 0x6a3a6a]); o.bottomStyle = 'sari'; o.bottom = P_([0x5a2a1a, 0x2a3a2a, 0x3a2a4a]); o.hairStyle = 'braid'; o.patuka = 0xe9dcc4; o.tika = true; }
        else { o.top = P_([0xe9e1cf, 0x8a7a60, 0x5a6a5a]); o.bottom = P_([0x3a3328, 0x4a4a42]); o.bottomStyle = 'shorts'; o.hat = c(0.5) ? 'topi' : null; o.gamcha = 0xc8102e; }
        o.bag = c(0.5) ? 'doko' : null; o.shoes = o.skin; break;
      case 'police':
        o.top = 0x3a5a8a; o.bottom = 0x1a2440; o.hat = 'cap'; o.hatColor = 0x1a2440; o.vestHi = true; o.gloves = 0xffffff; o.shoes = 0x111111; break;
      case 'doctor':
        o.coat = 0xffffff; o.lanyard = true; o.top = 0x9fc4e8; o.bottom = 0x23283a; o.glasses = c(0.5); o.shoes = 0x111111; break;
      case 'nurse':
        o.top = 0xe8f0f8; o.bottom = 0x2a4a6a; o.lanyard = true; o.glasses = c(0.3); o.shoes = 0x1a1a1a; break;
      case 'trekker': // a Himalayan trekker: bright shell jacket, warm hat, backpack and a walking stick
        o.topStyle = 'jacket'; o.jacket = P_([0xc81e1e, 0x1d4fb8, 0xe86412, 0x1f8a4c, 0xf2c418, 0x0a8a9a]); o.top = 0xe0e0e0;
        o.bottom = P_([0x2a2f45, 0x4a3a2a, 0x333333]); o.bag = 'backpack'; o.bagColor = P_([0x333333, 0x4a5a3a, 0xc81e1e, 0x1d4fb8]);
        o.hat = 'beanie'; o.hatColor = P_([0xc81e1e, 0x1d4fb8, 0xf2c418, 0x333333]); o.cane = true; o.shoes = 0x3a2414; break;
      case 'jogger':
        o.topStyle = 'tshirt'; o.top = P_([0xc81e1e, 0x1d4fb8, 0xf4f4f4, 0x1f8a4c, 0x333333]); o.bottom = P_([0x222222, 0x23283a]); o.shoes = 0xf4f4f4; o.hat = c(0.3) ? 'cap' : null; o.hatColor = 0x222222; break;
      case 'kid':
        o.topStyle = 'tshirt'; o.top = P_([0xd12b2b, 0x1d4fb8, 0xf2c418, 0x1f9a4c, 0xe86412, 0xf4f4f4]); o.bottomStyle = 'shorts'; o.bottom = P_([0x23283a, 0x6b5f4a, 0x2a4a6a]); o.height = 0.62; o.shoes = 0xf4f4f4; break;
      case 'uthao':
        o.topStyle = 'jacket'; o.jacket = 0x0f8a7a; o.top = 0xf4f4f4; o.hat = 'helmet'; o.hatColor = 0x0f8a7a; break;
      default: // man
        if (c(0.3)) { o.topStyle = 'jacket'; o.jacket = P_(JACKETS); }
        else if (c(0.25)) o.topStyle = 'tshirt';
        if (c(0.22)) { o.hat = 'topi'; }
        if (c(0.12)) o.glasses = true;
        if (c(0.15)) o.moustache = true;
    }
    if (o.hat === 'topi') o.hatColor = KS.pick([0xa8323a, 0x2a2a2a, 0x6a2a6a, 0x23315a]);
    return o;
  };

  /* ---------------- person builder ---------------- */
  KS.makePerson = (kind, cfg) => {
    const o = cfg || KS.outfitFor(kind);
    const body = new KS.Builder(), legL = new KS.Builder(), legR = new KS.Builder(), armL = new KS.Builder(), armR = new KS.Builder();
    const skin = o.skin, top = o.topStyle, longTop = top === 'kurta' || top === 'daura' || top === 'robe';
    const skirt = o.bottomStyle === 'sari' || o.bottomStyle === 'skirt';
    const lip = new T.Color(skin).multiplyScalar(0.72).getHex(), shade = new T.Color(skin).multiplyScalar(0.88).getHex();
    // legs (pivot at hip, y = 0.92)
    for (const b of [legL, legR]) {
      if (skirt) b.cyl(0, -0.88, 0, 0.045, 0.4, skin, 8, 1.1);
      else if (o.bottomStyle === 'shorts') { b.cyl(0, -0.5, 0, 0.075, 0.5, o.bottom, 8, 1.15); b.cyl(0, -0.88, 0, 0.048, 0.4, skin, 8, 1.3); }
      else b.cyl(0, -0.88, 0, 0.058, 0.9, o.bottom, 8, 1.45);
      b.ell(0, -0.9, 0.05, 0.055, 0.04, 0.13, o.shoes, 8);
    }
    // hips & torso
    if (!skirt) body.ecyl(0, 0.84, 0, 0.17, 0.11, 0.16, o.bottom, 10, 1.05);
    if (skirt) body.cyl(0, 0.04, 0, o.bottomStyle === 'sari' ? 0.25 : 0.22, 0.92, o.bottom, 12, o.bottomStyle === 'sari' ? 0.66 : 0.72);
    const torsoCol = top === 'jacket' ? o.jacket : o.top;
    body.ecyl(0, 0.9, 0, 0.165, 0.105, 0.5, torsoCol, 12, 1.2);
    body.ell(-0.19, 1.37, 0, 0.065, 0.055, 0.07, torsoCol, 8); body.ell(0.19, 1.37, 0, 0.065, 0.055, 0.07, torsoCol, 8);
    if (top === 'jacket') { body.box(0, 1.02, 0.112, 0.08, 0.34, 0.01, o.top); body.box(0, 0.9, 0.0, 0.36, 0.06, 0.25, new T.Color(o.jacket).multiplyScalar(0.8).getHex()); }
    if (longTop) body.cyl(0, top === 'robe' ? 0.12 : 0.5, 0, 0.2, top === 'robe' ? 0.8 : 0.42, o.top, 12, 0.85);
    if (o.coat) { body.ecyl(0, 0.9, 0, 0.172, 0.112, 0.46, o.coat, 12, 1.18); body.box(0, 1.05, 0.118, 0.06, 0.3, 0.01, o.top); }
    if (o.vest) body.ecyl(0, 0.95, 0.005, 0.168, 0.108, 0.38, o.vest, 12, 1.15);
    if (top === 'robe') body.box(0.05, 0.98, 0, 0.42, 0.5, 0.25, o.top, 0, 0, 0.42); // shoulder wrap
    if (o.vestHi) { body.ecyl(0, 0.95, 0.005, 0.17, 0.112, 0.38, 0xd8ff3a, 12, 1.15); body.box(0, 1.1, 0.115, 0.34, 0.03, 0.01, 0xd0d0d0); }
    if (o.tie) body.box(0, 1.02, 0.113, 0.035, 0.33, 0.012, o.tie);
    if (o.lanyard) { body.box(0, 1.08, 0.114, 0.012, 0.24, 0.01, 0x1d4fb8); body.box(0, 0.95, 0.116, 0.06, 0.08, 0.01, 0xf4f4f4); }
    if (o.scarf) { body.box(0.02, 1.02, 0.0, 0.07, 0.46, 0.226, o.scarf, 0, 0, -0.5); body.box(-0.16, 0.92, -0.06, 0.06, 0.46, 0.02, o.scarf); }
    if (o.patuka) body.ecyl(0, 0.88, 0, 0.175, 0.118, 0.12, o.patuka, 12);
    if (o.gamcha) body.box(-0.16, 1.2, 0, 0.1, 0.3, 0.22, o.gamcha);
    // neck & head
    body.cyl(0, 1.41, 0, 0.048, 0.09, skin, 8);
    body.ell(0, 1.6, 0.005, 0.098, 0.122, 0.108, skin, 14);
    body.ell(-0.098, 1.6, -0.005, 0.02, 0.035, 0.025, shade, 6); body.ell(0.098, 1.6, -0.005, 0.02, 0.035, 0.025, shade, 6); // ears
    for (const s of [-1, 1]) {
      body.ell(s * 0.038, 1.625, 0.093, 0.019, 0.011, 0.008, 0xf6f3ee, 8);
      body.ell(s * 0.038, 1.625, 0.099, 0.008, 0.008, 0.004, 0x2a1a10, 6);
      body.box(s * 0.04, 1.648, 0.096, 0.036, 0.008, 0.01, new T.Color(o.hair === skin ? 0x2a1a10 : o.hair).getHex()); // brows
    }
    body.ell(0, 1.59, 0.105, 0.014, 0.024, 0.016, shade, 6); // nose
    body.box(0, 1.545, 0.098, 0.04, 0.01, 0.008, lip); // mouth
    if (o.moustache) body.box(0, 1.562, 0.1, 0.05, 0.012, 0.008, 0x1a1410);
    if (o.beard) body.ell(0, 1.51, 0.06, 0.08, 0.08, 0.06, o.beard, 8);
    if (o.tika) body.ell(0, 1.656, 0.103, 0.008, 0.008, 0.004, 0xc8102e, 6);
    if (o.tilak) body.box(0, 1.665, 0.104, 0.05, 0.014, 0.006, 0xf2c418);
    if (o.glasses) { body.box(0, 1.625, 0.106, 0.13, 0.03, 0.01, 0x111111); }
    // hair
    const H = o.hair;
    if (o.hairStyle !== 'bald') {
      body.ell(0, 1.64, -0.008, 0.106, 0.1, 0.112, H, 12);
      body.ell(0, 1.69, 0.035, 0.094, 0.045, 0.078, H, 10); // fringe line
      if (o.hairStyle === 'long') body.box(0, 1.26, -0.08, 0.2, 0.42, 0.06, H);
      if (o.hairStyle === 'braid') { body.cyl(0, 1.0, -0.11, 0.028, 0.52, H, 6, 1.4); body.ell(0, 0.98, -0.11, 0.022, 0.03, 0.022, 0xc8102e, 6); }
      if (o.hairStyle === 'bun') body.ell(0, 1.66, -0.12, 0.06, 0.06, 0.06, H, 8);
    }
    if (o.hat === 'topi') { body.ecyl(0, 1.68, -0.005, 0.104, 0.11, 0.1, o.hatColor, 10, 0.86, -0.12); body.ecyl(0, 1.7, 0.0, 0.106, 0.112, 0.05, KS.pick([0xf2c418, 0xe8e0d0, 0x1f9a4c]), 10, 0.95, -0.12); }
    if (o.hat === 'cap') { body.sphere(0, 1.66, 0, 0.112, o.hatColor, 0.72, 10, true); body.box(0, 1.68, 0.11, 0.18, 0.015, 0.11, o.hatColor); }
    if (o.hat === 'sunhat') { body.cyl(0, 1.68, 0, 0.19, 0.015, o.hatColor, 12); body.cyl(0, 1.69, 0, 0.11, 0.09, o.hatColor, 10, 0.9); }
    if (o.hat === 'beanie') body.sphere(0, 1.64, 0, 0.115, o.hatColor, 0.95, 10, true);
    if (o.hat === 'helmet') { body.sphere(0, 1.6, 0, 0.145, o.hatColor, 1.05, 12); body.box(0, 1.57, 0.12, 0.2, 0.08, 0.04, 0x111418); }
    if (o.bag === 'backpack') { body.box(0, 0.98, -0.17, 0.3, o.kind === 'tourist' ? 0.55 : 0.38, 0.14, o.bagColor || 0x333333); body.box(0, 1.1, -0.245, 0.2, 0.1, 0.02, 0x222222); }
    if (o.bag === 'doko') { body.cyl(0, 0.95, -0.3, 0.2, 0.62, 0xa0784a, 10, 1.4); for (let i = 0; i < 3; i++) body.ell(KS.r(-0.1, 0.1), 1.55, -0.3, 0.1, 0.07, 0.1, KS.pick([0x5cae3a, 0xe8d23a, 0xd12b2b, 0x8a6a3a]), 6); body.box(0, 1.68, 0.02, 0.22, 0.025, 0.22, 0x7a5a3a); }
    if (o.bag === 'handbag') body.box(0.2, 0.86, 0.02, 0.06, 0.18, 0.22, KS.pick([0x3a2414, 0x7a1f3a, 0x111111]));
    // arms (pivot at shoulder y = 1.42)
    const sleeveCol = top === 'jacket' ? o.jacket : o.coat || o.top, shortSleeve = top === 'tshirt' || top === 'blouse';
    for (const b of [armL, armR]) {
      if (shortSleeve) { b.cyl(0, -0.24, 0, 0.05, 0.25, sleeveCol, 8, 1.15); b.cyl(0, -0.62, 0, 0.036, 0.4, skin, 8, 1.3); }
      else b.cyl(0, -0.62, 0, 0.04, 0.63, top === 'robe' && b === armR ? skin : sleeveCol, 8, 1.35);
      b.ell(0, -0.66, 0.01, 0.034, 0.05, 0.026, o.gloves || skin, 6);
    }
    if (o.cane) armR.cyl(0, -1.4, 0.04, 0.012, 0.8, 0x5a3a22, 5);
    const root = new T.Group(), inner = new T.Group(); root.add(inner);
    const mk = (b, x, y) => { const m = new T.Mesh(b.build(), KS.M.vc); m.position.set(x, y, 0); m.castShadow = true; inner.add(m); return m; };
    const torso = mk(body, 0, 0);
    const lL = mk(legL, -0.085, 0.92), lR = mk(legR, 0.085, 0.92), aL = mk(armL, -0.2, 1.41), aR = mk(armR, 0.2, 1.41);
    inner.scale.set(o.build, o.height, o.build);
    if (kind === 'kid') inner.scale.setScalar(0.66);
    if (kind === 'elder' || kind === 'grandma') torso.rotation.x = 0.1;
    if (skirt) { lL.position.z = lR.position.z = 0; }
    root.userData.voice = { f: skirt || o.hairStyle === 'braid' || o.hairStyle === 'bun' || o.hairStyle === 'long', kid: kind === 'kid', old: kind === 'elder' || kind === 'grandma' };
    return { root, inner, torso, legL: lL, legR: lR, armL: aL, armR: aR, kind, phase: KS.r(0, 6), skirt, cfg: o };
  };
  KS.animWalk = (p, dt, speed) => {
    // walk and run cycles: longer strides, bent swinging arms, a forward lean and more bounce when running; breathing when still
    const run = KS.smooth(3.5, 7.5, speed), moving = speed > 0.05;
    p.phase += dt * (2.2 + speed * (2.2 - run * 0.55));
    const a = Math.min(0.95, 0.22 + speed * 0.11 + run * 0.12) * (moving ? 1 : 0), s = Math.sin(p.phase) * a;
    p.legL.rotation.x = s * (p.skirt ? 0.4 : 1); p.legR.rotation.x = -s * (p.skirt ? 0.4 : 1);
    if (!p.busyArm) { const k = 0.75 + run * 0.45; p.armL.rotation.x = -s * k - run * 0.25; p.armR.rotation.x = s * k - run * 0.25; p.armL.rotation.z = 0.06 + run * 0.12; p.armR.rotation.z = -0.06 - run * 0.12; }
    p.torso.position.y = moving ? Math.abs(Math.cos(p.phase)) * (0.035 + run * 0.045) : Math.sin(KS.clock * 1.9 + p.phase) * 0.006;
    p.torso.rotation.y = Math.sin(p.phase) * (0.05 + run * 0.05) * (moving ? 1 : 0);
    const lean = moving ? 0.03 + run * 0.14 : 0;
    p.inner.rotation.x += (lean - p.inner.rotation.x) * Math.min(1, dt * 6);
  };
  KS.animSit = (p) => { p.legL.rotation.x = p.legR.rotation.x = -1.45; p.armL.rotation.x = p.armR.rotation.x = -0.5; };
  KS.animPunch = (p, t) => { p.armR.rotation.x = -1.55 * Math.sin(Math.min(1, t) * Math.PI); p.armR.rotation.z = 0.2; };

  /* ---------------- pedestrian system ---------------- */
  const Peds = (KS.Peds = { list: [], _nextId: 0, remote: false, ambientCount: 0 });
  const walkable = (c, r) => { const t = KS.blockType(c, r); return t !== 'river' && t !== 'outside'; };
  function rectOf(c, r) { const R = KS.World.blockRect(c, r); return { x0: R.x0 + 2, x1: R.x1 - 2, z0: R.z0 + 2, z1: R.z1 - 2 }; }
  function perimPos(ped, out) {
    const R = ped.rect, w = R.x1 - R.x0, d = R.z1 - R.z0, L = 2 * (w + d);
    let s = ((ped.s % L) + L) % L; ped.s = s;
    const o = ped.lat;
    if (s < w) { out.x = R.x0 + s; out.z = R.z0 + o; out.h = ped.dir > 0 ? Math.PI / 2 : -Math.PI / 2; }
    else if (s < w + d) { out.x = R.x1 - o; out.z = R.z0 + (s - w); out.h = ped.dir > 0 ? 0 : Math.PI; }
    else if (s < 2 * w + d) { out.x = R.x1 - (s - w - d); out.z = R.z1 - o; out.h = ped.dir > 0 ? -Math.PI / 2 : Math.PI / 2; }
    else { out.x = R.x0 + o; out.z = R.z1 - (s - 2 * w - d); out.h = ped.dir > 0 ? Math.PI : 0; }
    return out;
  }
  function cornerS(R, k) { const w = R.x1 - R.x0, d = R.z1 - R.z0; return [0, w, w + d, 2 * w + d][k]; }
  const CROSS = { 0: [[0, -1, 3], [-1, 0, 1]], 1: [[0, -1, 2], [1, 0, 0]], 2: [[0, 1, 1], [1, 0, 3]], 3: [[0, 1, 0], [-1, 0, 2]] };
  const AMBIENT_KINDS = ['man', 'man', 'woman', 'woman', 'elder', 'student', 'tourist', 'porter', 'man', 'woman', 'kid', 'monk', 'office', 'office', 'woman', 'grandma', 'student'];

  function placeAmbient(ped, px, pz, minD, maxD) {
    for (let tries = 0; tries < 30; tries++) {
      const a = KS.r(0, Math.PI * 2), d = KS.r(minD, maxD);
      const { c, r } = G.blockOf(px + Math.cos(a) * d, pz + Math.sin(a) * d);
      if (!walkable(c, r)) continue;
      ped.c = c; ped.r = r; ped.rect = rectOf(c, r);
      ped.s = KS.r(0, 2 * (ped.rect.x1 - ped.rect.x0 + ped.rect.z1 - ped.rect.z0));
      ped.mode = 'walk'; return true;
    }
    return false;
  }
  // front doors (shop/house fronts) for people coming and going
  function nearDoor(x, z, r) { let best = null, bd = r; for (const l of KS.World.lots) { const d = Math.abs(l.x - x) + Math.abs(l.z - z); if (d < bd) { bd = d; best = l; } } return best; }
  function sFrom(R, x, z) {
    const w = R.x1 - R.x0, d = R.z1 - R.z0, cx = KS.clamp(x, R.x0, R.x1), cz = KS.clamp(z, R.z0, R.z1);
    const dl = [Math.abs(cz - R.z0), Math.abs(cx - R.x1), Math.abs(cz - R.z1), Math.abs(cx - R.x0)], k = dl.indexOf(Math.min(...dl));
    return [cx - R.x0, w + (cz - R.z0), w + d + (R.x1 - cx), 2 * w + d + (R.z1 - cz)][k];
  }
  /** bring an ambient walker back: out of sight, or stepping out of a front door nearby */
  function respawn(ped, px, pz, fromDoor) {
    ped.going = false; ped.p.root.visible = true;
    if (fromDoor || KS.chance(0.35)) {
      for (let t = 0; t < 20; t++) {
        const l = KS.pick(KS.World.lots), d = Math.hypot(l.x - px, l.z - pz);
        if (d < 40 || d > 200) continue;
        const { c, r } = G.blockOf(l.x, l.z); if (!walkable(c, r)) continue;
        ped.c = c; ped.r = r; ped.rect = rectOf(c, r); ped.mode = 'door';
        ped.x = l.x - l.fx * 2.6; ped.z = l.z - l.fz * 2.6; ped.tx = l.x + l.fx * 0.6; ped.tz = l.z + l.fz * 0.6; ped.dir = KS.chance(0.5) ? 1 : -1;
        return;
      }
    }
    placeAmbient(ped, px, pz, 215, 262);
  }
  const add = (scene, ped) => {
    if (ped.id == null) ped.id = ++Peds._nextId; // mirrored walkers keep their own local id; the host's id lives in ped.netId
    if (ped.hp == null) ped.hp = 100; // every bot has health: punches, snowballs and rolling rocks can hurt them, and at 0 they go down
    // about one in four people carries a torch after dark
    if ((ped.ambient || ped.mode === 'plaza') && KS.chance(0.28) && KS.addBeam) { const t = new T.Mesh(new T.CylinderGeometry(0.03, 0.04, 0.18, 6).rotateX(Math.PI / 2), new T.MeshBasicMaterial({ color: 0xfff6d0 })); t.position.set(0.24, 0.95, 0.22); ped.p.root.add(t); KS.addBeam(ped.p.root, 0.24, 0.95, 0.32, true); }
    ped.home = ped.mode; scene.add(ped.p.root); Peds.list.push(ped); return ped; };
  Peds.init = (scene, count, px, pz) => {
    Peds.scene = scene; Peds.ambientCount = count;
    for (let i = 0; i < count; i++) {
      const kind = KS.pick(AMBIENT_KINDS), p = KS.makePerson(kind);
      add(scene, { p, kind, mode: 'walk', dir: KS.chance(0.5) ? 1 : -1, lat: KS.r(-1.3, 1.3), speed: kind === 'elder' || kind === 'grandma' ? 0.75 : kind === 'office' ? 1.6 : KS.r(1.0, 1.5), ambient: true, x: 0, z: 0, h: 0, y: 0, t: 0 });
      placeAmbient(Peds.list[Peds.list.length - 1], px, pz, 10, 240);
    }
    for (const k of KS.koras) for (let i = 0; i < k.n; i++) {
      const kind = KS.pick(k.kinds), p = KS.makePerson(kind);
      add(scene, { p, kind, mode: 'kora', k, a: KS.r(0, Math.PI * 2), rr: KS.r(k.r0, k.r1), speed: KS.r(0.9, 1.3), x: 0, z: 0, h: 0, y: k.y || 0.15, t: 0 });
    }
    for (const z of KS.plazas) for (let i = 0; i < z.n; i++) {
      const kind = KS.pick(z.kinds || ['man', 'woman', 'tourist', 'tourist', 'elder', 'kid', 'porter']), p = KS.makePerson(kind === 'jogger' ? 'jogger' : kind);
      const ped = add(scene, { p, kind, mode: 'plaza', zone: z, x: KS.r(z.x0, z.x1), z: KS.r(z.z0, z.z1), tx: 0, tz: 0, wait: KS.r(0, 4), speed: kind === 'jogger' ? 2.6 : KS.r(0.8, 1.4), h: 0, y: 0.15, t: 0 });
      ped.tx = ped.x; ped.tz = ped.z;
    }
    for (const s of KS.sitSpots) {
      const kind = s[3] || KS.pick(['man', 'elder', 'woman', 'tourist', 'man', 'grandma']), p = KS.makePerson(kind);
      KS.animSit(p); add(scene, { p, kind, mode: 'sit', x: s[0], z: s[1], y: s[2], h: Math.PI + KS.r(-0.4, 0.4), t: 0 });
    }
    for (const [bx, bz, ry] of (KS.benchSpots || [])) {
      if (!KS.chance(0.45)) continue;
      const p = KS.makePerson(KS.pick(['elder', 'woman', 'man', 'student', 'grandma'])); KS.animSit(p);
      add(scene, { p, kind: p.kind, mode: 'sit', x: bx, z: bz, y: 0.05, h: ry, t: 0 });
    }
    for (const [dx, dz, dh, dkind] of (KS.doctorSpots || [])) { // Bir Hospital staff: local, standing at their posts
      const p = KS.makePerson(dkind);
      add(scene, { p, kind: dkind, mode: 'stand', x: dx, z: dz, y: 0.15, h: dh, t: 0, gT: KS.r(2, 6) });
    }
    // Himalayan trekkers on the trekking path (never more than 20), and people
    // walking the two mountain roads. They follow their path and turn round at
    // the ends; they are local, so they are never respawned into the city.
    if (KS.MOUNTAIN_PATHS) {
      const trek = KS.MOUNTAIN_PATHS.find((p) => p.id === 'trek'), snow = KS.MOUNTAIN_PATHS.find((p) => p.id === 'snowroad'), para = KS.MOUNTAIN_PATHS.find((p) => p.id === 'pararoad');
      const walkers = [];
      for (let i = 0; i < 14; i++) walkers.push(['trekker', trek]); // the trekking party, well under the 20-person limit
      for (let i = 0; i < 4; i++) walkers.push([KS.pick(['man', 'woman', 'tourist', 'elder']), snow]);
      for (let i = 0; i < 3; i++) walkers.push([KS.pick(['man', 'woman', 'tourist']), para]);
      for (const [kind, path] of walkers) {
        const p = KS.makePerson(kind), pi = KS.ri(0, path.pts.length - 1), [sx, sz] = path.pts[pi];
        add(scene, { p, kind, mode: 'trek', path, pi, dir: KS.chance(0.5) ? 1 : -1, x: sx + KS.r(-1, 1), z: sz + KS.r(-1, 1), y: KS.heightAt(sx, sz) + 0.02, h: KS.r(0, 6.3), speed: KS.r(0.9, 1.3), t: 0 });
      }
    }
    Peds.police = [];
    for (const [i, j] of [[6, 5], [5, 3], [6, 8]]) { // posts on the corner kerb, out of the traffic
      const x = G.line(i) + G.roadHalf(i) + 2.2, z = G.line(j) + G.roadHalf(j) + 2.2, p = KS.makePerson('police');
      const b = new KS.Builder(); b.cyl(x, 0, z, 1.1, 0.5, 0xe8e2d4, 12); b.cyl(x, 0.5, z, 0.06, 2.6, 0x777777, 4); b.cyl(x, 3.1, z, 1.5, 0.5, 0xd12b2b, 10, 0.05);
      scene.add(KS.mesh(b)); KS.addCircle(x, z, 1.1, 0.5);
      Peds.police.push(add(scene, { p, kind: 'police', mode: 'police', x: x + 0.3, z, y: 0.5, h: 0, t: KS.r(0, 6) }));
    }
    // two officers on foot patrol, walking the pavements near the player and checking traffic
    for (let i = 0; i < 2; i++) {
      const p = KS.makePerson('police');
      const ped = add(scene, { p, kind: 'police', mode: 'walk', patrol: true, dir: i ? 1 : -1, lat: 0.6, speed: 1.05, ambient: true, x: 0, z: 0, h: 0, y: 0, t: 0 });
      placeAmbient(ped, px, pz, 30, 160); Peds.police.push(ped);
    }
    if (KS.football) {
      const ball = new T.Mesh(new T.SphereGeometry(0.22, 10, 8), new T.MeshLambertMaterial({ color: 0xffffff }));
      ball.position.set(KS.football.x, 0.36, KS.football.z); scene.add(ball);
      Peds.ball = { m: ball, vx: 0, vz: 0, x: KS.football.x, z: KS.football.z };
      for (let i = 0; i < 8; i++) {
        const p = KS.makePerson('kid');
        add(scene, { p, kind: 'kid', mode: 'football', x: KS.football.x + KS.r(-10, 10), z: KS.football.z + KS.r(-10, 10), h: 0, y: 0.15, speed: KS.r(2.2, 3.2), t: 0, homeXY: [KS.football.x + KS.r(-14, 14), KS.football.z + KS.r(-12, 12)] });
      }
    }
  };

  /** two neighbours stop for a chat instead of walking past each other */
  function tryChat(ped) {
    if (ped.chatT || ped.patrol) return;
    for (const o of Peds.list) {
      if (o === ped || o.mode !== 'walk' || o.chatT || o.fight || o.flee || o.patrol) continue;
      const dx = o.x - ped.x, dz = o.z - ped.z;
      if (dx * dx + dz * dz > 9) continue;
      const t = KS.r(12, 40);
      ped.mode = 'chat'; ped.chatT = t; ped.chatWith = o;
      o.mode = 'chat'; o.chatT = t; o.chatWith = ped;
      return;
    }
  }

  /* ---------- the same people for everyone (see traffic.js): guests mirror the host's walkers ----------
     Only the ambient walkers differ per client — the kora circles, plaza crowds, sitters and police
     posts are placed from the same world data, so they stay local on every client. */
  const PED_MODE = { walk: 1, cross: 2, door: 3, plaza: 4, kora: 5, sit: 6, chat: 7 };
  const PED_MODE_BACK = { 1: 'walk', 2: 'cross', 3: 'door', 4: 'plaza', 5: 'kora', 6: 'sit', 7: 'chat' };
  Peds.setRemote = (on) => {
    if (!!on === !!Peds.remote) return;
    Peds.remote = !!on;
    if (on) {
      for (const ped of [...Peds.list]) if (ped.ambient && !ped.remote) Peds.remove(ped);
      if (Peds.police) Peds.police = Peds.police.filter((p) => Peds.list.includes(p)); // dropped patrol officers leave the police list too
    } else {
      for (const ped of [...Peds.list]) if (ped.remote) Peds.remove(ped);
      Peds.refill();
    }
  };
  Peds.remove = (ped) => { const i = Peds.list.indexOf(ped); if (i >= 0) Peds.list.splice(i, 1); if (ped.p && ped.p.root.parent) ped.p.root.parent.remove(ped.p.root); };
  Peds.refill = (px, pz) => {
    const P = KS.Player, scene = Peds.scene; if (!scene) return;
    px = px == null ? P.x : px; pz = pz == null ? P.z : pz;
    let n = Peds.list.filter((p) => p.ambient).length;
    while (n < Peds.ambientCount) {
      const kind = KS.pick(AMBIENT_KINDS), p = KS.makePerson(kind);
      add(scene, { p, kind, mode: 'walk', dir: KS.chance(0.5) ? 1 : -1, lat: KS.r(-1.3, 1.3), speed: kind === 'elder' || kind === 'grandma' ? 0.75 : kind === 'office' ? 1.6 : KS.r(1.0, 1.5), ambient: true, x: 0, z: 0, h: 0, y: 0, t: 0 });
      placeAmbient(Peds.list[Peds.list.length - 1], px, pz, 10, 240);
      n++;
    }
    // the two foot-patrol officers come back too
    let patrol = Peds.list.filter((p) => p.patrol).length;
    while (patrol < 2) {
      const p = KS.makePerson('police');
      const ped = add(scene, { p, kind: 'police', mode: 'walk', patrol: true, dir: patrol ? 1 : -1, lat: 0.6, speed: 1.05, ambient: true, x: 0, z: 0, h: 0, y: 0, t: 0 });
      placeAmbient(ped, px, pz, 30, 160); if (Peds.police) Peds.police.push(ped);
      patrol++;
    }
  };
  /** [id, kind, x, z, heading, speed, mode] for ambient walkers near any player */
  Peds.snapshot = (points, radius) => {
    const out = [], r2 = radius * radius;
    for (const ped of Peds.list) {
      if (!ped.ambient || ped.fight || ped.flee || ped.down > 0) continue;
      const m = PED_MODE[ped.mode]; if (!m) continue;
      let near = false;
      for (const p of points) { const dx = ped.x - p.x, dz = ped.z - p.z; if (dx * dx + dz * dz < r2) { near = true; break; } }
      if (!near) continue;
      const sp = ped.mode === 'walk' ? ped.speed : ped.mode === 'cross' ? ped.speed * 1.2 : 0;
      out.push([ped.id, ped.kind, +ped.x.toFixed(1), +ped.z.toFixed(1), +ped.h.toFixed(2), +sp.toFixed(1), m]);
    }
    return out;
  };
  Peds.applySnapshot = (list) => {
    if (!list || !Peds.scene) return;
    const now = KS.clock, seen = new Set();
    for (const e of list) {
      const [id, kind, x, z, h, speed, mode] = e;
      seen.add(id);
      let ped = Peds.list.find((q) => q.remote && q.netId === id);
      if (!ped) {
        const p = KS.makePerson(kind);
        ped = add(Peds.scene, { p, kind, mode: PED_MODE_BACK[mode] || 'walk', dir: 1, lat: 0, speed, ambient: false, remote: true, netId: id, x, z, h, y: 0.06, t: 0 });
      }
      ped.net = { x, z, h, speed, mode: PED_MODE_BACK[mode] || 'walk', t: now };
    }
    for (const ped of [...Peds.list]) if (ped.remote && (!seen.has(ped.netId) || (ped.net && now - ped.net.t > 3.5))) Peds.remove(ped);
  };
  function remotePed(ped, dt) {
    const n = ped.net; if (!n) return;
    const k = Math.min(1, dt * 7);
    ped.x += (n.x - ped.x) * k; ped.z += (n.z - ped.z) * k; ped.h = KS.angLerp(ped.h, n.h, k);
    ped.p.root.position.set(ped.x, ped.y || 0.06, ped.z); ped.p.root.rotation.y = ped.h;
    KS.animWalk(ped.p, dt, n.speed);
  }

  const tmp = { x: 0, z: 0, h: 0 };
  Peds.update = (dt, ctx) => {
    const { px, pz, cx, cz } = ctx;
    const ball = Peds.ball;
    if (ball) {
      ball.x += ball.vx * dt; ball.z += ball.vz * dt; ball.vx *= 0.985; ball.vz *= 0.985;
      const fx = KS.football.x, fz = KS.football.z;
      if (Math.abs(ball.x - fx) > 26) { ball.vx = -ball.vx; ball.x = fx + Math.sign(ball.x - fx) * 26; }
      if (Math.abs(ball.z - fz) > 22) { ball.vz = -ball.vz; ball.z = fz + Math.sign(ball.z - fz) * 22; }
      ball.m.position.set(ball.x, 0.36, ball.z); ball.m.rotation.x += ball.vz * dt * 3; ball.m.rotation.z -= ball.vx * dt * 3;
    }
    let chaser = null, best = 1e9;
    for (const ped of Peds.list) {
      const dxp = ped.x - cx, dzp = ped.z - cz, d2 = dxp * dxp + dzp * dzp;
      if (ped.ambient && !ped.fight && (ped.x - px) ** 2 + (ped.z - pz) ** 2 > 270 * 270) { respawn(ped, px, pz); ped.down = 0; ped.dead = false; ped.hp = 100; ped.flee = 0; ped.p.inner.rotation.x = 0; }
      const vis = d2 < 210 * 210;
      ped.p.root.visible = vis;
      if (!vis && !ped.ambient) continue;
      if (ped.hidden) { ped.p.root.visible = false; continue; } // police are off duty in Battle mode
      if (Peds.remote && ped.remote) { if (vis) remotePed(ped, dt); continue; } // the host's walker, gliding to its next reported spot
      let moving = 0;
      const pr = ped.p.root;
      if (ped.down > 0) { // knocked over: lie, then get up — unless dead, then stay down
        if (ped.dead) { ped.p.inner.rotation.x = -1.5; ped.p.inner.position.y = 0.12; pr.position.set(ped.x, ped.y || 0.06, ped.z); continue; }
        ped.down -= dt;
        ped.p.inner.rotation.x = KS.lerp(ped.p.inner.rotation.x, -1.5, Math.min(1, dt * 10)); ped.p.inner.position.y = 0.12;
        if (ped.down <= 0 && ped.injured) { ped.injured = false; ped.p.inner.rotation.x = 0; ped.p.inner.position.y = 0; KS.say(pr, 'Thank you, doctor saab…', 2); }
        else if (ped.down <= 0) {
          ped.p.inner.rotation.x = 0; ped.p.inner.position.y = 0;
          if (ped.kind !== 'grandma' && ped.kind !== 'kid' && ped.kind !== 'elder' && ped.kind !== 'monk' && KS.chance(0.4)) { ped.fight = 9; KS.say(pr, KS.pick(LINES.fight), 2, 'angry'); }
          else { ped.flee = 4; ped.fvx = (ped.x - px); ped.fvz = (ped.z - pz); const m = Math.hypot(ped.fvx, ped.fvz) || 1; ped.fvx *= 5 / m; ped.fvz *= 5 / m; KS.say(pr, KS.pick(LINES.flee), 2, 'angry'); }
        }
        pr.position.set(ped.x, ped.y || 0.06, ped.z); continue;
      }
      if (ped.fight > 0) { // fight back
        ped.fight -= dt; ped.punchT = (ped.punchT || 0) - dt;
        const dx = px - ped.x, dz = pz - ped.z, d = Math.hypot(dx, dz);
        ped.h = Math.atan2(dx, dz);
        if (d > 18 || KS.Player.vehicle) ped.fight = 0;
        else if (d > 1.1) { ped.x += (dx / d) * 3.2 * dt; ped.z += (dz / d) * 3.2 * dt; moving = 3.2; }
        else if (ped.punchT <= 0) { ped.punchT = 1.1; ped.punchA = 0; KS.Game && KS.Game.hurt(KS.r(6, 11), ped); }
        if (ped.punchA != null) { ped.punchA += dt * 4; ped.p.busyArm = true; KS.animPunch(ped.p, ped.punchA); if (ped.punchA >= 1) { ped.punchA = null; ped.p.busyArm = false; } }
        const c = KS.collide(ped.x, ped.z, 0.35, ped.y || 0, 1.0); ped.x = c.x; ped.z = c.z;
        if (ped.fight <= 0) { ped.flee = 2; ped.fvx = -dx; ped.fvz = -dz; }
      } else if (ped.flee > 0) {
        ped.flee -= dt; ped.x += ped.fvx * dt; ped.z += ped.fvz * dt; moving = Math.hypot(ped.fvx, ped.fvz);
        ped.h = Math.atan2(ped.fvx, ped.fvz);
        const c = KS.collide(ped.x, ped.z, 0.35, ped.y || 0, 1.3); ped.x = c.x; ped.z = c.z;
        if (ped.flee <= 0 && ped.mode === 'walk') { const o = perimPos(ped, tmp); ped.x = o.x; ped.z = o.z; }
      } else if (ped.patrol && (moving = policeChase(ped, dt, px, pz, pr)) >= 0) {
        // patrol officer chasing
      } else switch ((moving = 0, ped.patrolWas && (placeAmbient(ped, px, pz, 20, 60), ped.patrolWas = false), ped.mode)) {
        case 'door': { // walking between a front door and the pavement
          const dx = ped.tx - ped.x, dz = ped.tz - ped.z, d = Math.hypot(dx, dz); moving = 1.1;
          if (d < 0.35) { if (ped.going) { ped.p.root.visible = false; respawn(ped, px, pz, true); } else { ped.mode = 'walk'; ped.s = sFrom(ped.rect, ped.x, ped.z); } break; }
          ped.x += (dx / d) * 1.1 * dt; ped.z += (dz / d) * 1.1 * dt; ped.h = Math.atan2(dx, dz); ped.y = 0.22;
          break;
        }
        case 'walk': {
          if (ped.wait > 0) { ped.wait -= dt; break; }
          if (ped.kind !== 'police' && KS.chance(dt * 0.006)) { // go home through the nearest front door
            const door = nearDoor(ped.x, ped.z, 14);
            if (door) { ped.mode = 'door'; ped.going = true; ped.tx = door.x - door.fx * 2.6; ped.tz = door.z - door.fz * 2.6; break; }
          }
          const R = ped.rect, w = R.x1 - R.x0, d = R.z1 - R.z0, L = 2 * (w + d);
          const s0 = ped.s; ped.s += ped.dir * ped.speed * dt; moving = ped.speed;
          for (let k = 0; k < 4; k++) {
            const cs = cornerS(R, k), a = ((s0 - cs) % L + L) % L, b = ((ped.s - cs) % L + L) % L;
            const passed = ped.dir > 0 ? (a > L - 2 && b < 2) : (a < 2 && b > L - 2);
            if (passed && KS.chance(0.6)) { // cross to the next block more often: people go places, they don't loop one block forever
              const opt = KS.pick(CROSS[k]), nc = ped.c + opt[0], nr = ped.r + opt[1];
              if (walkable(nc, nr)) {
                const nR = rectOf(nc, nr), o = perimPos(ped, tmp);
                ped.mode = 'cross'; ped.fromX = o.x; ped.fromZ = o.z;
                ped.c = nc; ped.r = nr; ped.rect = nR; ped.s = cornerS(nR, opt[2]);
                const o2 = perimPos(ped, tmp); ped.toX = o2.x; ped.toZ = o2.z; ped.ct = 0;
                ped.cLen = Math.hypot(ped.toX - ped.fromX, ped.toZ - ped.fromZ);
                if (ped.cLen > 40) ped.mode = 'walk';
              }
              break;
            }
          }
          if (ped.mode === 'walk') { const o = perimPos(ped, tmp); ped.x = o.x; ped.z = o.z; ped.h = KS.angLerp(ped.h, o.h, Math.min(1, dt * 8)); }
          if (KS.chance(dt * 0.02)) ped.wait = KS.r(1, 5);
          if (KS.chance(dt * 0.01)) tryChat(ped); // neighbours stop for a chat instead of walking past each other
          break;
        }
        case 'cross': {
          if (ped.ct < 0.05) {
            const sig = KS.Traffic && KS.Traffic.signalAt((ped.fromX + ped.toX) / 2, (ped.fromZ + ped.toZ) / 2);
            if ((KS.Traffic && KS.Traffic.nearCount(ped.x, ped.z, 13) > 0) || (sig && sig.state[Math.abs(ped.toX - ped.fromX) > 1 ? 'ns' : 'ew'] === 'g')) { ped.h = Math.atan2(ped.toX - ped.fromX, ped.toZ - ped.fromZ); break; }
          }
          /* never walk through a vehicle: if the next step lands inside a bus
             or a car, wait at the kerb for a gap instead of marching through
             it (the old code advanced the crossing clock regardless, so the
             walker popped out of the far side of a stopped bus). */
          const step = (ped.speed * 1.15 * dt) / Math.max(1, ped.cLen), nt = Math.min(1, ped.ct + step);
          const nx = ped.fromX + (ped.toX - ped.fromX) * nt, nz = ped.fromZ + (ped.toZ - ped.fromZ) * nt;
          if (KS.Traffic && KS.Traffic.pushOut && KS.Traffic.pushOut(nx, nz, 0.4).hit) {
            ped.crossWait = (ped.crossWait || 0) + dt; ped.h = Math.atan2(ped.toX - ped.fromX, ped.toZ - ped.fromZ);
            if (ped.crossWait > 8) { ped.mode = 'walk'; ped.dir = KS.chance(0.5) ? 1 : -1; ped.crossWait = 0; } // give up: something is parked on the crossing
            break;
          }
          ped.crossWait = 0;
          ped.ct += step; moving = ped.speed * 1.2;
          const t = Math.min(1, ped.ct);
          ped.x = ped.fromX + (ped.toX - ped.fromX) * t; ped.z = ped.fromZ + (ped.toZ - ped.fromZ) * t;
          ped.h = Math.atan2(ped.toX - ped.fromX, ped.toZ - ped.fromZ);
          if (t >= 1) { ped.mode = 'walk'; ped.dir = KS.chance(0.5) ? 1 : -1; }
          break;
        }
        case 'chat': {
          ped.chatT -= dt;
          const o = ped.chatWith;
          if (ped.chatT <= 0 || !o || o.mode !== 'chat') { ped.mode = 'walk'; ped.chatWith = null; ped.p.busyArm = false; break; }
          ped.h = Math.atan2(o.x - ped.x, o.z - ped.z);
          ped.gT = (ped.gT || KS.r(0, 9)) + dt; // talk with the hands
          if (ped.kind !== 'monk' && ped.kind !== 'kid') { ped.p.busyArm = true; ped.p.armR.rotation.x = -0.45 - Math.max(0, Math.sin(ped.gT * 2.6)) * 0.7; ped.p.armL.rotation.x = -0.2 - Math.max(0, Math.sin(ped.gT * 1.9 + 1)) * 0.4; }
          break;
        }
        case 'kora': {
          const k = ped.k; ped.a += (ped.speed / ped.rr) * dt; moving = ped.speed;
          ped.x = k.x + Math.cos(ped.a) * ped.rr; ped.z = k.z + Math.sin(ped.a) * ped.rr;
          ped.h = Math.atan2(-Math.sin(ped.a), Math.cos(ped.a));
          if (ped.kind === 'monk' || ped.kind === 'elder' || ped.kind === 'grandma') { ped.p.busyArm = true; ped.p.armR.rotation.x = -0.9; }
          break;
        }
        case 'trek': { // trekkers and mountain-road walkers: follow their path, turn round at the ends
          const pts = ped.path.pts, n = pts.length;
          const tx = pts[ped.pi][0], tz = pts[ped.pi][1], dx = tx - ped.x, dz = tz - ped.z, d = Math.hypot(dx, dz);
          if (d < 1.2) {
            ped.pi += ped.dir;
            if (ped.pi >= n) { ped.pi = n - 2; ped.dir = -1; }
            else if (ped.pi < 0) { ped.pi = 1; ped.dir = 1; }
          } else {
            moving = ped.speed; ped.x += (dx / d) * ped.speed * dt; ped.z += (dz / d) * ped.speed * dt;
            ped.h = KS.angLerp(ped.h, Math.atan2(dx, dz), Math.min(1, dt * 6));
          }
          ped.y = KS.heightAt(ped.x, ped.z) + 0.02;
          break;
        }
        case 'plaza': {
          const z = ped.zone;
          if (ped.wait > 0) { // standing and chatting: talk with the hands
            ped.wait -= dt; ped.gT = (ped.gT || KS.r(0, 9)) + dt;
            if (ped.kind !== 'monk' && ped.kind !== 'kid') { ped.p.busyArm = true; ped.p.armR.rotation.x = -0.45 - Math.max(0, Math.sin(ped.gT * 2.6)) * 0.7; ped.p.armR.rotation.z = 0.15; ped.p.armL.rotation.x = -0.2 - Math.max(0, Math.sin(ped.gT * 1.9 + 1)) * 0.4; }
            if (ped.wait <= 0) ped.p.busyArm = false;
            break;
          }
          const dx = ped.tx - ped.x, dz = ped.tz - ped.z, d = Math.hypot(dx, dz);
          if (d < 0.5) { ped.tx = KS.r(z.x0, z.x1); ped.tz = KS.r(z.z0, z.z1); ped.wait = ped.kind === 'jogger' ? 0 : KS.r(0.5, 6); break; }
          const sp = ped.speed; ped.x += (dx / d) * sp * dt; ped.z += (dz / d) * sp * dt; moving = sp;
          const c = KS.collide(ped.x, ped.z, 0.35, ped.y, 1.0); if (c.hit) { ped.tx = KS.r(z.x0, z.x1); ped.tz = KS.r(z.z0, z.z1); } ped.x = c.x; ped.z = c.z;
          ped.h = KS.angLerp(ped.h, Math.atan2(dx, dz), Math.min(1, dt * 6));
          if (z.y === null) ped.y = KS.heightAt(ped.x, ped.z) + 0.02;
          break;
        }
        case 'football': {
          const b = Peds.ball, dx = b.x - ped.x, dz = b.z - ped.z, d = Math.hypot(dx, dz);
          if (d < best) { best = d; chaser = ped; }
          const tx = ped === Peds.lastChaser ? b.x : ped.homeXY[0], tz = ped === Peds.lastChaser ? b.z : ped.homeXY[1];
          const ex = tx - ped.x, ez = tz - ped.z, e = Math.hypot(ex, ez);
          if (e > 0.6) { const sp = ped === Peds.lastChaser ? ped.speed : 1; ped.x += (ex / e) * sp * dt; ped.z += (ez / e) * sp * dt; moving = sp; ped.h = Math.atan2(ex, ez); }
          if (d < 0.7 && Math.hypot(b.vx, b.vz) < 4) { const a = KS.r(0, Math.PI * 2), f = KS.r(6, 12); b.vx = Math.cos(a) * f; b.vz = Math.sin(a) * f; if (KS.chance(0.1)) KS.say(ped.p.root, KS.pick(LINES.kid), 1.5); }
          break;
        }
        case 'stand': { // doctors and nurses: stay at their post, turn to look around now and then
          ped.gT = (ped.gT || KS.r(2, 6)) - dt;
          if (ped.gT <= 0) { ped.h += KS.r(-0.6, 0.6); ped.gT = KS.r(3, 8); }
          break;
        }
        case 'police': {
          if (ped.postX == null) { ped.postX = ped.x; ped.postZ = ped.z; ped.postY = ped.y; }
          const pd = Math.hypot(px - ped.x, pz - ped.z);
          const m2 = policeChase(ped, dt, px, pz, pr); if (m2 >= 0) { moving = m2; break; }
          if (ped.chasing) { // walk back to the post
            const bx = ped.postX - ped.x, bz = ped.postZ - ped.z, bd = Math.hypot(bx, bz);
            if (bd > 0.5) { ped.x += (bx / bd) * 1.6 * dt; ped.z += (bz / bd) * 1.6 * dt; ped.h = Math.atan2(bx, bz); moving = 1.6; ped.p.busyArm = false; break; }
            ped.chasing = false; ped.y = ped.postY;
          }
          ped.dist = pd;
          ped.t += dt; ped.h = Math.floor(ped.t / 6) * (Math.PI / 2);
          ped.p.busyArm = true; ped.p.armR.rotation.z = -1.4 + Math.sin(ped.t * 5) * 0.4; ped.p.armL.rotation.x = Math.sin(ped.t * 2.5) * 0.9 - 0.4;
          if (Math.floor(ped.t * 0.5) !== Math.floor((ped.t - dt) * 0.5) && d2 < 900 && KS.chance(0.35)) KS.audio && KS.audio.whistle(Math.max(0.1, 1 - Math.sqrt(d2) / 30));
          break;
        }
      }
      if (moving > 0 && d2 < 25000 && ped.mode !== 'sit' && KS.Traffic && KS.Traffic.pushOut) { const o = KS.Traffic.pushOut(ped.x, ped.z, 0.32); if (o.hit) { ped.x = o.x; ped.z = o.z; } } // walk around vehicles, not through them
      const gy = ped.mode === 'walk' && !ped.flee && !ped.fight ? 0.22 : ped.mode === 'cross' ? 0.06 : ped.y || 0.06;
      pr.position.set(ped.x, gy, ped.z); pr.rotation.y = ped.h;
      if (ped.mode !== 'sit' && (ped.mode !== 'police' || ped.fight || ped.chasing)) KS.animWalk(ped.p, dt, moving);
      if (d2 < 100 && !ped.fight && KS.chance(dt * 0.1)) {
        const set = LINES[ped.kind] || (ped.kind === 'porter' ? LINES.vendor : ped.kind === 'grandma' || ped.kind === 'elder' ? LINES.greet : LINES.greet);
        KS.say(pr, KS.pick(set), 2.4);
      }
    }
    if (chaser) Peds.lastChaser = chaser;
  };
  /** police officer leaves their post or patrol to run after the player during a police alert. returns speed, or -1 if not chasing */
  function policeChase(ped, dt, px, pz, pr) {
    const heat = KS.Law ? KS.Law.heat : 0, pdx = px - ped.x, pdz = pz - ped.z, pd = Math.hypot(pdx, pdz);
    ped.dist = pd;
    if (!(heat > 0 && pd < 75)) { if (ped.patrol && ped.chasing) { ped.chasing = false; ped.patrolWas = true; } return -1; }
    ped.chasing = true; ped.y = 0.06; let moving = 0;
    if (pd > 1.0) { const sp = KS.Player.vehicle ? 6.5 : 5.2; ped.x += (pdx / pd) * sp * dt; ped.z += (pdz / pd) * sp * dt; moving = sp; }
    ped.h = Math.atan2(pdx, pdz); const c = KS.collide(ped.x, ped.z, 0.35, 0, 1.0); ped.x = c.x; ped.z = c.z;
    ped.p.busyArm = false; ped.whT = (ped.whT || 0) - dt; if (ped.whT <= 0) { ped.whT = 2.5; KS.audio && KS.audio.whistle(Math.max(0.15, 1 - pd / 60)); KS.say(pr, KS.pick(['Rok! Police!', 'Oi! Rok!', 'Bhaagna sakdainas!']), 1.4, 'angry'); }
    return moving;
  }
  /** knock a pedestrian down (from a punch or a vehicle) */
  Peds.knock = (ped, fromX, fromZ, hard) => {
    ped.down = hard ? 28 : 2.2; ped.flee = 0; ped.fight = 0; ped.injured = !!hard;
    if (hard && KS.Law) KS.Law.injury(ped);
    const dx = ped.x - fromX, dz = ped.z - fromZ, d = Math.hypot(dx, dz) || 1;
    ped.x += (dx / d) * 0.8; ped.z += (dz / d) * 0.8; ped.h = Math.atan2(-dx, -dz);
    KS.say(ped.p.root, KS.pick(LINES.hurt), 1.8, 'angry');
    KS.audio && KS.audio.punch();
  };
  Peds.punch = (x, z, h) => {
    const fx = Math.sin(h), fz = Math.cos(h); let best = null, bd = 1.9;
    for (const ped of Peds.list) {
      if (!ped.p.root.visible || ped.down > 0 || ped.mode === 'sit') continue;
      const dx = ped.x - x, dz = ped.z - z, d = Math.hypot(dx, dz);
      if (d < bd && (dx * fx + dz * fz) / (d || 1) > 0.3) { bd = d; best = ped; }
    }
    if (best) {
      // a punch hurts: 25 damage, and at 0 health the pedestrian stays down
      if (KS.Damage && KS.Damage.hitPed) KS.Damage.hitPed(best, 25, x, z);
      else Peds.knock(best, x, z, false);
      // bystanders scatter
      Peds.forEachNear(best.x, best.z, 12, (p) => { if (p !== best && !p.down && !p.fight && p.mode !== 'sit' && p.mode !== 'police' && KS.chance(0.6)) { p.flee = 3; const dx = p.x - x, dz = p.z - z, m = Math.hypot(dx, dz) || 1; p.fvx = (dx / m) * 5; p.fvz = (dz / m) * 5; if (KS.chance(0.3)) KS.say(p.p.root, KS.pick(LINES.flee), 1.6, 'angry'); } });
    }
    return best;
  };
  Peds.bump = (x, z, r, vx, vz, speed) => {
    let hits = 0;
    for (const ped of Peds.list) {
      if (ped.mode === 'sit' || (ped.mode === 'police' && !ped.chasing) || !ped.p.root.visible || ped.down > 0) continue;
      const dx = ped.x - x, dz = ped.z - z, d2 = dx * dx + dz * dz;
      if (d2 > r * r) continue;
      const d = Math.sqrt(d2) || 1;
      if (speed > 8) { Peds.knock(ped, x, z, true); hits++; continue; }
      if (!(ped.flee > 0)) {
        ped.flee = 0.9; const k = Math.max(3, speed * 0.6);
        ped.fvx = (dx / d) * k + vx * 0.3; ped.fvz = (dz / d) * k + vz * 0.3;
        if (speed > 4) { hits++; KS.say(ped.p.root, KS.pick(LINES.angry), 2.2, 'angry'); }
      }
    }
    return hits;
  };
  Peds.forEachNear = (x, z, r, fn) => {
    for (const ped of Peds.list) { if (!ped.p.root.visible) continue; const dx = ped.x - x, dz = ped.z - z; if (dx * dx + dz * dz < r * r) fn(ped); }
  };
  /** the nearest pedestrian to a point (for snowballs and thrown things) */
  Peds.nearest = (x, z, r) => {
    let best = null, bd = r;
    for (const ped of Peds.list) {
      if (!ped.p.root.visible || ped.down > 0) continue;
      const d = Math.hypot(ped.x - x, ped.z - z);
      if (d < bd) { bd = d; best = ped; }
    }
    return best;
  };

  /* ---------------- animals ---------------- */
  const Animals = (KS.Animals = { cows: [], dogs: [], monkeys: [], goats: [], hens: [] });
  function quad(o) { // generic four-legged animal with separate legs for walking
    const b = new KS.Builder(), c = o.color, L = o.len, H = o.h;
    b.ell(0, H, 0, o.wid / 2, H * 0.32, L / 2, c, 10);
    if (o.hump) b.ell(0, H * 1.28, L * 0.28, o.wid * 0.3, H * 0.18, L * 0.14, c, 8);
    b.ell(0, H * 1.12, L * 0.62, o.wid * 0.28, H * 0.22, L * 0.2, c, 8); // head
    b.ell(0, H * 1.04, L * 0.76, o.wid * 0.18, H * 0.12, L * 0.08, o.muzzle || 0xd8a8a0, 8);
    for (const s of [-1, 1]) b.ell(s * o.wid * 0.3, H * 1.24, L * 0.58, o.wid * 0.08, H * 0.04, L * 0.04, c, 6); // ears
    if (o.horns) for (const s of [-1, 1]) b.cyl(s * o.wid * 0.15, H * 1.3, L * 0.58, 0.03, H * 0.3, 0xd8d0c0, 6, 0.3, 0, 0, -s * 0.5);
    b.cyl(0, H * 0.95, -L * 0.48, 0.025, H * 0.6, c, 5, 0.6, 0, -2.7); // tail
    if (o.garland) b.ecyl(0, H * 0.9, L * 0.48, o.wid * 0.3, o.wid * 0.12, 0.08, 0xf2a516, 10);
    if (o.bell) b.sphere(0, H * 0.8, L * 0.5, 0.06, 0xc9a23a, 1, 6);
    const g = new T.Group(), body = new T.Mesh(b.build(), KS.M.vc); body.castShadow = true; g.add(body);
    const legs = [];
    for (const [x, z] of [[-1, 1], [1, 1], [-1, -1], [1, -1]]) {
      const lb = new KS.Builder(); lb.cyl(0, -H * 0.82, 0, o.leg, H * 0.82, c, 6, 1.2); lb.box(0, -H * 0.82, 0, o.leg * 2, 0.04, o.leg * 2.2, 0x2a2a2a);
      const m = new T.Mesh(lb.build(), KS.M.vc); m.position.set(x * o.wid * 0.3, H * 0.82, z * L * 0.33); g.add(m); legs.push(m);
    }
    return { g, body, legs, H };
  }
  const walkLegs = (a, ph, amp) => { a.legs.forEach((l, i) => (l.rotation.x = Math.sin(ph + (i === 0 || i === 3 ? 0 : Math.PI)) * amp)); };
  Animals.init = (scene) => {
    for (let i = 0; i < 20; i++) {
      const vertical = KS.chance(0.5), li = KS.ri(1, G.N - 1), along = KS.r(-500, 500), off = KS.r(-4, 4);
      const x = vertical ? G.line(li) + off : along, z = vertical ? along : G.line(li) + off;
      if (Math.abs(((along - G.O) % G.B) - 45) > 30) { i--; continue; }
      const { c, r } = G.blockOf(x, z); if (KS.blockType(c, r) === 'river') { i--; continue; }
      const cow = quad({ color: KS.pick([0xf2ede4, 0xe8e0d0, 0x8a6a4a, 0x3a3028, 0xd8c8b0]), len: 1.9, wid: 0.75, h: 0.95, leg: 0.06, hump: true, horns: true, garland: KS.chance(0.5), bell: KS.chance(0.6) });
      Object.assign(cow, { x, z, h: vertical ? (KS.chance(0.5) ? 0 : Math.PI) : (KS.chance(0.5) ? Math.PI / 2 : -Math.PI / 2), vertical, line: G.line(li), t: KS.r(0, 10), mode: KS.pick(['lie', 'stand', 'walk', 'walk', 'walk']), modeT: KS.r(10, 50), ph: 0, dirSign: KS.chance(0.5) ? 1 : -1, sp: KS.r(0.6, 0.95) });
      if (cow.mode === 'lie') { cow.legs.forEach((l) => (l.visible = false)); cow.body.position.y = -0.62; }
      cow.g.position.set(x, 0.05, z); cow.g.rotation.y = cow.h; scene.add(cow.g); Animals.cows.push(cow);
    }
    for (let i = 0; i < 30; i++) {
      const c = KS.ri(1, 10), r = KS.ri(0, 10);
      if (KS.blockType(c, r) === 'river') { i--; continue; }
      const R = KS.World.blockRect(c, r);
      const d = quad({ color: KS.pick([0xb8875a, 0x3a2a1a, 0xd8c0a0, 0x6a4a2a, 0x222222, 0xc8a070]), len: 0.75, wid: 0.28, h: 0.42, leg: 0.035, muzzle: 0x222222 });
      Object.assign(d, { x: KS.chance(0.5) ? R.x0 + 2 : R.x1 - 2, z: KS.r(R.z0 + 3, R.z1 - 3), h: KS.r(0, 6), sleep: KS.chance(0.55), chase: 0, bark: 0, t: 0, ph: 0, big: KS.chance(0.3) });
      d.homeXY = [d.x, d.z];
      if (d.sleep) { d.body.rotation.z = 1.3; d.body.position.y = -0.22; d.legs.forEach((l) => (l.visible = false)); }
      d.g.position.set(d.x, 0.22, d.z); d.g.rotation.y = d.h; scene.add(d.g); Animals.dogs.push(d);
    }
    for (const [x, z, r, y] of KS.monkeySpots) for (let i = 0; i < 9; i++) {
      const m = quad({ color: 0x8a6a4a, len: 0.42, wid: 0.2, h: 0.28, leg: 0.025, muzzle: 0xd8a890 });
      Object.assign(m, { cx: x, cz: z, r, y, x: x + KS.r(-r, r), z: z + KS.r(-r, r), hop: 0, wait: KS.r(0, 3) }); m.tx = m.x; m.tz = m.z;
      scene.add(m.g); Animals.monkeys.push(m);
    }
    for (const [x, z] of KS.goatSpots || []) {
      for (let i = 0; i < 5; i++) { const gt = quad({ color: KS.pick([0xf2ede4, 0x3a3028, 0x8a6a4a]), len: 0.85, wid: 0.32, h: 0.55, leg: 0.03, horns: true, muzzle: 0x3a3028 }); Object.assign(gt, { cx: x, cz: z, x: x + KS.r(-8, 8), z: z + KS.r(-8, 8), t: KS.r(0, 9), wait: 0, ph: 0 }); gt.tx = gt.x; gt.tz = gt.z; scene.add(gt.g); Animals.goats.push(gt); }
      for (let i = 0; i < 6; i++) { const hb = new KS.Builder(), c = KS.pick([0xf4f4f0, 0x8a4a2a, 0x2a2a2a]); hb.ell(0, 0.22, 0, 0.1, 0.1, 0.14, c, 8); hb.ell(0, 0.34, 0.1, 0.05, 0.06, 0.05, c, 6); hb.box(0, 0.37, 0.12, 0.02, 0.04, 0.04, 0xc81e1e); hb.box(0, 0.32, 0.15, 0.02, 0.015, 0.04, 0xe8a020); hb.box(-0.03, 0, 0, 0.015, 0.14, 0.015, 0xe8a020); hb.box(0.03, 0, 0, 0.015, 0.14, 0.015, 0xe8a020);
        const g = new T.Group(); g.add(new T.Mesh(hb.build(), KS.M.vc)); const hen = { g, cx: x, cz: z, x: x + KS.r(-6, 6), z: z + KS.r(-6, 6), t: KS.r(0, 5) }; scene.add(g); Animals.hens.push(hen); }
    }
    const pg = new KS.Builder(); pg.ell(0, 0.12, 0, 0.07, 0.07, 0.13, 0x8f96a0, 8); pg.ell(0, 0.21, 0.1, 0.045, 0.045, 0.045, 0x6f7a88, 6); pg.box(0, 0.2, 0.15, 0.02, 0.015, 0.04, 0xd8a040); pg.box(0, 0.16, 0.06, 0.08, 0.02, 0.05, 0x5f8a7a);
    const total = KS.pigeonSpots.reduce((a, s) => a + s[2], 0);
    Animals.pigeonMesh = new T.InstancedMesh(pg.build(), KS.M.vc, total); Animals.pigeonMesh.frustumCulled = false; scene.add(Animals.pigeonMesh);
    Animals.pigeons = [];
    for (const [x, z, n] of KS.pigeonSpots) for (let i = 0; i < n; i++) Animals.pigeons.push({ cx: x, cz: z, x: x + KS.r(-7, 7), z: z + KS.r(-7, 7), y: 0.15, h: KS.r(0, 6), fly: 0, a: KS.r(0, 6), t: KS.r(0, 5) });
  };
  const dm = new T.Object3D();
  Animals.update = (dt, ctx) => {
    const { px, pz, playerSpeed, honk, inVehicle, vehicleKind } = ctx;
    const A = KS.audio;
    for (const cow of Animals.cows) {
      cow.t += dt;
      const d = Math.hypot(cow.x - px, cow.z - pz);
      if (honk && d < 16 && !cow.moving) { cow.moving = 3; A && A.moo(1 - d / 20); KS.say(cow.g, 'Mooo…', 1.8); if (cow.mode === 'lie') { cow.mode = 'stand'; cow.legs.forEach((l) => (l.visible = true)); cow.body.position.y = 0; } }
      if (cow.moving > 0) {
        cow.moving -= dt; const side = cow.vertical ? Math.sign(cow.x - cow.line || 1) : Math.sign(cow.z - cow.line || 1);
        if (cow.vertical) cow.x += side * dt * 0.9; else cow.z += side * dt * 0.9;
        const lim = cow.line + side * 6.2; if (cow.vertical) cow.x = side > 0 ? Math.min(cow.x, lim) : Math.max(cow.x, lim); else cow.z = side > 0 ? Math.min(cow.z, lim) : Math.max(cow.z, lim);
        cow.ph += dt * 5; walkLegs(cow, cow.ph, 0.35);
      } else {
        // a cow's day: amble along the road, stop to graze or chew, lie down for a while, get up again
        cow.modeT -= dt;
        if (cow.modeT <= 0) {
          const next = cow.mode === 'walk' ? KS.pick(['stand', 'stand', 'lie', 'walk']) : cow.mode === 'lie' ? 'stand' : KS.pick(['walk', 'walk', 'lie']);
          if (next === 'lie') { cow.legs.forEach((l) => (l.visible = false)); cow.body.position.y = -0.62; } else if (cow.mode === 'lie') { cow.legs.forEach((l) => (l.visible = true)); cow.body.position.y = 0; }
          cow.mode = next; cow.modeT = next === 'walk' ? KS.r(25, 70) : next === 'lie' ? KS.r(20, 45) : KS.r(6, 16);
          if (next === 'walk' && KS.chance(0.3)) cow.dirSign = -cow.dirSign;
        }
        if (cow.mode === 'walk') {
          // blocked by a vehicle or person right in front? wait patiently
          const dirx = cow.vertical ? 0 : cow.dirSign, dirz = cow.vertical ? cow.dirSign : 0;
          let blocked = Math.hypot(cow.x + dirx * 2.4 - px, cow.z + dirz * 2.4 - pz) < 2;
          if (!blocked && KS.Traffic) for (const v of KS.Traffic.list) if (Math.abs(v.x - cow.x - dirx * 3) < 2.4 && Math.abs(v.z - cow.z - dirz * 3) < 2.4) { blocked = true; break; }
          const sp = blocked ? 0 : cow.sp;
          cow.x += dirx * sp * dt; cow.z += dirz * sp * dt; cow.h = KS.angLerp(cow.h, Math.atan2(dirx, dirz), Math.min(1, dt * 2));
          if (sp) { cow.ph += dt * 4.5 * sp / 0.7; walkLegs(cow, cow.ph, 0.3); if (d < 24 && Math.floor(cow.ph / Math.PI) !== Math.floor((cow.ph - dt * 4.5) / Math.PI)) A && A.hoof(1 - d / 24); }
          cow.body.rotation.x = Math.sin(cow.ph * 0.5) * 0.03;
          const al = cow.vertical ? cow.z : cow.x, m = ((al - G.O) % G.B + G.B) % G.B, jl = G.line(Math.round((al - G.O) / G.B));
          if (cow.turnAt != null) { // crossing into the junction, then turning onto the other road
            if ((al - cow.turnAt) * cow.dirSign >= 0) {
              cow.vertical = !cow.vertical; cow.line = jl; cow.dirSign = KS.chance(0.5) ? 1 : -1; cow.turnAt = null; cow.skip = 26;
              const na = cow.vertical ? cow.z : cow.x; if (Math.abs(na + cow.dirSign * 40) > 520) cow.dirSign = -cow.dirSign;
            }
          } else if (cow.skip > 0) cow.skip -= sp * dt;
          else if (m < 18 || m > G.B - 18) {
            const ahead = (jl - al) * cow.dirSign > 0, inRange = Math.abs(jl) < 500;
            if (ahead && inRange && KS.chance(0.6)) cow.turnAt = jl + KS.r(-4, 4);
            else { cow.dirSign = -cow.dirSign; cow.skip = 6; }
          }
        } else if (cow.mode === 'stand') { // grazing: head bobs down to the verge
          cow.body.rotation.x = Math.max(0, Math.sin(cow.t * 0.9)) * 0.12;
          if (KS.chance(dt * 0.15)) cow.h += KS.r(-0.4, 0.4);
        } else cow.body.rotation.x = 0;
      }
      if (cow.bell && d < 18 && cow.mode !== 'lie' && KS.chance(dt * 0.8)) A && A.cowbell(1 - d / 18);
      if (d < 14 && KS.chance(dt * 0.03)) { A && A.moo(1 - d / 18); }
      cow.g.position.set(cow.x, 0.05, cow.z); cow.g.rotation.y = cow.h;
      cow.body.rotation.z = Math.sin(cow.t * 0.7) * 0.02;
    }
    for (const dg of Animals.dogs) {
      dg.t += dt;
      const dist = Math.hypot(dg.x - px, dg.z - pz);
      // bikes get chased; anyone walking close gets barked at
      // street dogs guard their own patch: a short chase, then a long rest
      dg.tired = Math.max(0, (dg.tired || 0) - dt);
      if (inVehicle && vehicleKind === 'bike' && playerSpeed > 6 && dist < 9 && dg.chase <= 0 && dg.tired <= 0 && KS.chance(0.5)) { dg.chase = KS.r(2.5, 4); wake(dg); }
      if (dg.sleep && dist < (playerSpeed > 3 ? 7 : 3.5)) { wake(dg); dg.alert = 4; }
      if (!dg.sleep && dist < 11 && dg.chase <= 0 && dg.tired <= 0 && !(dg.alert > 0)) dg.alert = KS.r(4, 7); // bark for a few seconds, not forever
      dg.bark -= dt;
      if (dg.chase > 0) {
        dg.chase -= dt; const dx = px - dg.x, dz = pz - dg.z, e = Math.hypot(dx, dz) || 1, sp = Math.min(playerSpeed * 0.9, 7.5);
        if (Math.hypot(dg.x - dg.homeXY[0], dg.z - dg.homeXY[1]) > 35 || e > 18) dg.chase = 0; // end of its territory: give up
        if (dg.chase <= 0) { dg.tired = KS.r(25, 50); dg.alert = 0; }
        if (e > 2.2) { dg.x += (dx / e) * sp * dt; dg.z += (dz / e) * sp * dt; }
        dg.h = Math.atan2(dx, dz); dg.ph += dt * 16; walkLegs(dg, dg.ph, 0.7);
        if (dg.bark <= 0) { dg.bark = KS.r(0.35, 0.7); A && A.bark(Math.max(0.1, 1 - e / 40), dg.big); KS.say(dg.g, 'Bhau! Bhau!', 0.6); }
      } else if (dg.alert > 0) { // stand and bark at you
        dg.alert -= dt; dg.h = KS.angLerp(dg.h, Math.atan2(px - dg.x, pz - dg.z), Math.min(1, dt * 6));
        if (dist < 11 && dg.bark <= 0) { dg.bark = KS.r(0.5, 1.4); if (KS.chance(0.25)) A && A.growl(1 - dist / 12); else A && A.bark(1 - dist / 14, dg.big); KS.say(dg.g, KS.pick(['Bhau!', 'Woof!', 'Grrr…']), 0.7); }
        if (dist > 14 || dg.alert <= 0) { dg.alert = 0; dg.tired = Math.max(dg.tired, 8); }
      } else if (!dg.sleep) {
        const hx = dg.homeXY[0] - dg.x, hz = dg.homeXY[1] - dg.z, e = Math.hypot(hx, hz);
        if (e > 1) { dg.x += (hx / e) * 1.6 * dt; dg.z += (hz / e) * 1.6 * dt; dg.h = Math.atan2(hx, hz); dg.ph += dt * 8; walkLegs(dg, dg.ph, 0.5); }
        else if (KS.chance(dt * 0.05)) { dg.sleep = true; dg.body.rotation.z = 1.3; dg.body.position.y = -0.22; dg.legs.forEach((l) => (l.visible = false)); }
      }
      if (ctx.night > 0.6 && dist < 40 && KS.chance(dt * 0.03)) A && A.bark(0.25, dg.big);
      if (ctx.night > 0.7 && dist < 120 && KS.chance(dt * 0.004)) A && A.howl(Math.max(0.15, 0.6 - dist / 200)); // the night chorus of Kathmandu's street dogs
      dg.g.position.set(dg.x, 0.22, dg.z); dg.g.rotation.y = dg.h;
    }
    function wake(dg) { dg.sleep = false; dg.body.rotation.z = 0; dg.body.position.y = 0; dg.legs.forEach((l) => (l.visible = true)); }
    for (const m of Animals.monkeys) {
      const vis = Math.hypot(m.x - px, m.z - pz) < 150; m.g.visible = vis; if (!vis) continue;
      if (m.wait > 0) m.wait -= dt;
      else {
        const dx = m.tx - m.x, dz = m.tz - m.z, e = Math.hypot(dx, dz);
        if (e < 0.3) { m.tx = m.cx + KS.r(-m.r, m.r); m.tz = m.cz + KS.r(-m.r, m.r); m.wait = KS.r(0.3, 3); }
        else { m.x += (dx / e) * 3 * dt; m.z += (dz / e) * 3 * dt; m.hop += dt * 12; m.g.rotation.y = Math.atan2(dx, dz); }
      }
      const gy = m.y != null ? m.y : KS.groundAt(m.x, m.z, 100, 200);
      m.g.position.set(m.x, gy + Math.abs(Math.sin(m.hop)) * 0.35, m.z);
    }
    for (const gt of Animals.goats) {
      const d = Math.hypot(gt.x - px, gt.z - pz); gt.g.visible = d < 200; if (!gt.g.visible) continue;
      gt.t += dt;
      if (gt.wait > 0) gt.wait -= dt;
      else { const dx = gt.tx - gt.x, dz = gt.tz - gt.z, e = Math.hypot(dx, dz); if (e < 0.4) { gt.tx = gt.cx + KS.r(-10, 10); gt.tz = gt.cz + KS.r(-10, 10); gt.wait = KS.r(1, 6); } else { gt.x += (dx / e) * 0.9 * dt; gt.z += (dz / e) * 0.9 * dt; gt.g.rotation.y = Math.atan2(dx, dz); gt.ph += dt * 6; walkLegs(gt, gt.ph, 0.35); } }
      if (d < 14 && KS.chance(dt * 0.08)) A && A.bleat(1 - d / 16);
      gt.g.position.set(gt.x, KS.heightAt(gt.x, gt.z), gt.z);
    }
    for (const h of Animals.hens) {
      const d = Math.hypot(h.x - px, h.z - pz); h.g.visible = d < 120; if (!h.g.visible) continue;
      h.t += dt; if (KS.chance(dt * 0.6)) { h.x = KS.clamp(h.x + KS.r(-0.8, 0.8), h.cx - 8, h.cx + 8); h.z = KS.clamp(h.z + KS.r(-0.8, 0.8), h.cz - 8, h.cz + 8); h.g.rotation.y = KS.r(0, 6); }
      if (d < (playerSpeed > 3 ? 5 : 2)) { const dx = h.x - px, dz = h.z - pz, m = Math.hypot(dx, dz) || 1; h.x += (dx / m) * 4 * dt; h.z += (dz / m) * 4 * dt; if (KS.chance(dt * 3)) A && A.cluck(0.6); }
      else if (d < 12 && KS.chance(dt * 0.06)) A && A.cluck(1 - d / 14);
      h.g.position.set(h.x, KS.heightAt(h.x, h.z) + Math.max(0, Math.sin(h.t * 9)) * 0.03, h.z); h.g.children[0].rotation.x = Math.max(0, Math.sin(h.t * 3)) * 0.5;
    }
    const pm = Animals.pigeonMesh; let i = 0;
    for (const b of Animals.pigeons) {
      b.t += dt;
      const dist = Math.hypot(b.x - px, b.z - pz);
      if (b.fly <= 0 && dist < (playerSpeed > 3 ? 7 : 3)) { b.fly = KS.r(5, 9); b.a = Math.atan2(b.z - b.cz, b.x - b.cx); if (i % 9 === 0) A && A.flap(); }
      if (b.fly > 0) {
        b.fly -= dt; b.a += dt * 0.8;
        const tr = 9 + (b.h % 1) * 6, ty = 8 + (b.t % 3);
        b.x += (b.cx + Math.cos(b.a) * tr - b.x) * dt * 1.5; b.z += (b.cz + Math.sin(b.a) * tr - b.z) * dt * 1.5;
        b.y += ((b.fly > 1.5 ? ty : 0.15) - b.y) * dt * 1.6; b.h = b.a + Math.PI;
      } else { b.y = 0.15; if (KS.chance(dt * 0.3)) { b.x += KS.r(-0.3, 0.3); b.z += KS.r(-0.3, 0.3); b.h = KS.r(0, 6); } }
      dm.position.set(b.x, b.y, b.z); dm.rotation.set(b.fly > 0 ? 0 : Math.max(0, Math.sin(b.t * 6)) * 0.5, b.h, b.fly > 0 ? Math.sin(b.t * 30) * 0.4 : 0); dm.updateMatrix();
      pm.setMatrixAt(i++, dm.matrix);
    }
    pm.instanceMatrix.needsUpdate = true;
  };
  Animals.obstacles = (fn) => { for (const c of Animals.cows) fn(c.x, c.z, 1.6, c); };
})();
