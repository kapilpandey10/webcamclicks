/* Kathmandu Streets — Uthao driver app: go online, accept ride and parcel requests, pick up, drop off,
   get rated. Each passenger type has wants (hurry, gentle driving, no honking, luggage needs a car…). */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const U = (KS.Uthao = { online: false, request: null, trip: null, nextReq: 4 });
  const $ = (id) => document.getElementById(id);

  // kind -> model used for the person; cls: which vehicles can take it
  U.TYPES = {
    student: { icon: '🎒', name: 'Student', person: 'student', mult: 0.8, cls: ['moto', 'car'], wants: 'Cheap and quick to campus', lines: ['Dai, college late bhayo!', 'Thank you dai!'] },
    office: { icon: '💼', name: 'Office worker', person: 'office', mult: 1.1, cls: ['moto', 'car'], hurry: 0.75, wants: 'In a hurry: tips if you are early', lines: ['Meeting cha, chito please!', 'Perfect timing!'] },
    tourist: { icon: '🧳', name: 'Tourist with luggage', person: 'tourist', mult: 1.4, cls: ['car'], landmark: true, wants: 'Needs a car for the suitcases; tips well', lines: ['Namaste! To the hotel please.', 'Dhanyabad! Great ride!'] },
    backpacker: { icon: '🎒', name: 'Backpacker', person: 'tourist', mult: 1.2, cls: ['moto', 'car'], landmark: true, wants: 'Wants to see a famous place', lines: ['Can you take me to the temple?', 'Awesome, thanks!'] },
    grandma: { icon: '👵', name: 'Hajurama', person: 'grandma', mult: 1.0, cls: ['moto', 'car'], gentle: 3, wants: 'Drive gently: no speeding, no hard braking', lines: ['Bistarai hai babu…', 'Jug jug jiyos, babu!'] },
    monk: { icon: '🧘', name: 'Monk', person: 'monk', mult: 1.0, cls: ['moto', 'car'], noHonk: 3, landmark: 'boudha', wants: 'Please do not honk', lines: ['Tashi delek. To the stupa, please.', 'Om mani padme hum 🙏'] },
    vip: { icon: '👔', name: 'Business VIP', person: 'office', mult: 1.7, cls: ['car'], strict: true, gentle: 1.5, wants: 'Pays big, rates strictly', lines: ['Singha Durbar. Quickly and smoothly.', 'Acceptable.'] },
    family: { icon: '👩‍👧', name: 'Mother & child', person: 'woman', mult: 1.2, cls: ['car'], gentle: 2, wants: 'Car only, careful driving', lines: ['Hospital ma check-up cha.', 'Dhanyabad bhai!'] },
    party: { icon: '🎉', name: 'Night out', person: 'man', mult: 1.3, cls: ['moto', 'car'], night: true, tip: 1.5, wants: 'Leaving Thamel at night; tips generously', lines: ['Thamel bata ghar, dai!', 'Ramro ride! Tip linus!'] },
    patient: { icon: '🤒', name: 'Unwell passenger', person: 'elder', mult: 1.3, cls: ['car'], urgent: true, gentle: 1.5, toHospital: true, wants: 'Urgent: hospital, fast but smooth', lines: ['Aspatal… chito…', 'Dhanyabad, babu.'] },
    villager: { icon: '🧺', name: 'Villager to Dhunibesi', person: 'farmer', mult: 1.0, cls: ['moto', 'car', 'cargo'], village: true, wants: 'Long trip through the Nagdhunga tunnel', lines: ['Gaun jane, Dhunibesi!', 'Gaun ma swagat cha!'] },
  };
  U.PARCELS = {
    food: { icon: '🥟', name: 'Hot momo order', cls: ['cycle', 'moto', 'car'], mult: 0.9, hurry: 0.6, wants: 'Deliver while hot' },
    docs: { icon: '📄', name: 'Documents', cls: ['cycle', 'moto', 'car'], mult: 1.0, wants: 'Office papers' },
    fragile: { icon: '🏺', name: 'Fragile pottery', cls: ['moto', 'car', 'cargo'], mult: 1.3, fragile: 3, wants: 'Every bump costs you' },
    medicine: { icon: '💊', name: 'Medicine', cls: ['moto', 'car'], mult: 1.3, urgent: true, toHospital: true, wants: 'Urgent to the hospital' },
    cylinder: { icon: '🛢️', name: 'Gas cylinders', cls: ['cargo'], mult: 1.5, wants: 'Heavy: pickup or tempo only' },
    furniture: { icon: '🛋️', name: 'Furniture', cls: ['cargo'], mult: 1.8, fragile: 1.5, wants: 'Big load: pickup only' },
    veg: { icon: '🥬', name: 'Village vegetables', cls: ['cargo'], mult: 1.6, fromVillage: true, wants: 'From Dhunibesi farms to Kalimati market' },
  };
  const clsOf = (v) => { if (!v) return null; if (v.kind === 'bicycle') return 'cycle'; if (v.kind === 'policebike' || v.trialVehicle) return null; if (KS.isBike(v.kind)) return 'moto'; if (['pickup', 'tempo', 'truck', 'micro'].includes(v.kind)) return 'cargo'; if (['bus', 'minibus', 'ambulance', 'police'].includes(v.kind)) return null; return 'car'; };
  U.clsOf = clsOf;
  const KALIMATI = { x: -430, z: 225, name: 'Kalimati Market' };

  function randomLot(px, pz, a, b) { const L = KS.World.lots; for (let i = 0; i < 300; i++) { const l = KS.pick(L), d = Math.hypot(l.x - px, l.z - pz); if (d > a && d < b) return l; } return KS.pick(L); }
  function landmarkStop(l) { return l.stop || KS.Game.stopFor(l); }
  function destFor(t, from) {
    if (t.toHospital) return { x: KS.hospital.x, z: KS.hospital.z + 6, name: 'City Hospital' };
    if (t.landmark === 'boudha') { const l = KS.landmarks.find((x) => x.id === 'boudha'); return { ...landmarkStop(l), name: l.name }; }
    if (t.village) { const s = KS.pick(KS.villageSpots); return { x: s.x, z: s.z, name: 'Dhunibesi Village' }; }
    if (t.fromVillage) return { ...KALIMATI };
    if (t.landmark || KS.chance(0.4)) {
      const opts = KS.landmarks.filter((l) => { const s = landmarkStop(l); const d = Math.hypot(s.x - from.x, s.z - from.z); return d > 250 && d < 1000 && l.id !== 'village'; });
      if (opts.length) { const l = KS.pick(opts); return { ...landmarkStop(l), name: l.name }; }
    }
    const l = randomLot(from.x, from.z, 280, 850); return { x: l.x, z: l.z, name: KS.districtAt(l.x, l.z).name };
  }
  function makeRequest() {
    const PL = KS.Player, v = PL.vehicle, cls = clsOf(v); if (!cls || !KS.Law.valid(v.kind)) return null;
    const parcel = cls === 'cycle' || KS.chance(cls === 'cargo' ? 0.85 : 0.32);
    const pool = Object.entries(parcel ? U.PARCELS : U.TYPES).filter(([k, t]) => t.cls.includes(cls) && (!t.night || KS.night > 0.5));
    if (!pool.length) return null;
    const [key, t] = KS.pick(pool);
    let from;
    if (t.fromVillage || (t.village && KS.chance(0.4))) { const s = KS.pick(KS.villageSpots); from = { x: s.x, z: s.z }; }
    else if (t.night) { const l = randomLot(-135, -270, 0, 90); from = { x: l.x, z: l.z }; }
    else { const l = randomLot(PL.x, PL.z, 60, 330); from = { x: l.x, z: l.z }; }
    let to = destFor(t, from);
    if (t.village && Math.hypot(from.x - KS.HW.village.x, from.z - KS.HW.village.z) < 400) { const l = randomLot(-100, 0, 0, 400); to = { x: l.x, z: l.z, name: KS.districtAt(l.x, l.z).name }; }
    const dist = Math.hypot(to.x - from.x, to.z - from.z), pick = Math.hypot(from.x - PL.x, from.z - PL.z);
    const base = cls === 'cycle' ? [50, 0.3] : cls === 'moto' ? [60, 0.35] : cls === 'car' ? [100, 0.5] : [180, 0.7];
    const fare = Math.round(((base[0] + dist * base[1]) * t.mult * (KS.night > 0.6 ? 1.2 : 1)) / 10) * 10;
    const pace = cls === 'cycle' ? 5 : cls === 'moto' ? 9.5 : cls === 'car' ? 8.5 : 7.2;
    return { key, t, parcel, from, to, dist, pick, fare, eta: Math.round(dist / pace / (t.hurry || 1) + 25), expires: 15 };
  }

  U.toggle = () => {
    U.online = !U.online;
    if (U.online) { const c = clsOf(KS.Player.vehicle); KS.Game.notify(c ? '🟢 Uthao: online. Ride requests will pop up here.' : '🟢 Uthao: online. Get on a bike, into a car or a cargo vehicle to receive jobs.'); U.nextReq = 3; KS.audio.ding(); }
    else { U.request = null; if (U.trip) U.cancel(true); KS.Game.notify('⚪ Uthao: offline.'); }
    U.render();
  };
  U.accept = () => {
    const r = U.request; if (!r) return; U.request = null;
    U.trip = { ...r, stage: 'pickup', comfort: 100, age: 0, honks: 0 };
    KS.Game.setTarget(r.from.x, r.from.z, r.parcel ? 'Parcel pickup' : 'Passenger');
    KS.Game.notify(`${r.t.icon} Accepted: ${r.t.name}. Head to the pickup.`); KS.audio.ding(); U.render();
  };
  U.decline = () => { U.request = null; U.nextReq = KS.r(5, 9); U.render(); };
  U.cancel = (silent) => {
    if (!U.trip) return; removeRider(); U.trip = null; KS.Game.clearTarget();
    if (!silent) { U.rate(1); KS.Game.notify('❌ Trip cancelled. Your rating took a hit.', 'bad'); KS.audio.fail(); }
    U.render();
  };
  U.rate = (stars) => { const s = KS.Shop.data.uthao; s.ratingSum += stars; s.ratingN++; KS.Shop.save(); };
  U.rating = () => { const s = KS.Shop.data.uthao; return s.ratingN ? s.ratingSum / s.ratingN : 5; };

  /* comfort events, reported by the game */
  U.event = (kind, amount = 1) => {
    const tr = U.trip; if (!tr || tr.stage !== 'drop') return;
    const t = tr.t || {};
    if (kind === 'crash') { tr.comfort -= 18 * (t.fragile || 1) * (t.gentle ? 1.3 : 1); if (!tr.parcel) KS.say(KS.Player.person.root, KS.pick(['Aiya! Dhyan dinus!', 'Hey! Careful!', 'Ke garnu bhayo?!']), 2, 'angry'); }
    if (kind === 'brake') tr.comfort -= 6 * (t.gentle || 1);
    if (kind === 'honk') { tr.honks++; if (t.noHonk) { tr.comfort -= 4 * t.noHonk; KS.Game.notify('🧘 "Please, no horn…"'); } }
    if (kind === 'speed') tr.comfort -= 0.5 * amount * (t.gentle || 1);
    if (kind === 'fine') tr.comfort -= 15;
  };

  /* passenger visuals */
  function spawnRider(tr) {
    const v = KS.Player.vehicle;
    if (tr.parcel) {
      const b = new KS.Builder(); b.box(0, 0, 0, 0.5, 0.42, 0.42, 0x0f8a7a); b.box(0, 0.42, 0, 0.52, 0.04, 0.44, 0xffffff);
      tr.mesh = new T.Mesh(b.build(), KS.M.vc);
    } else {
      const p = KS.makePerson(tr.t.person); tr.person = p; tr.mesh = p.root;
      if (v && KS.isBike(v.kind)) { KS.animSit(p); p.armL.rotation.x = p.armR.rotation.x = -0.9; }
    }
    if (v && KS.isBike(v.kind)) { tr.mesh.position.set(0, tr.parcel ? 0.98 : 0.25, tr.parcel ? -0.95 : -0.85); v.root.add(tr.mesh); }
    else if (v) { tr.mesh.visible = false; v.root.add(tr.mesh); }
  }
  function removeRider() { const tr = U.trip; if (tr && tr.mesh && tr.mesh.parent) tr.mesh.parent.remove(tr.mesh); }
  const walkers = [];
  function walker(kind, x, z, tx, tz, line) {
    const p = KS.makePerson(kind); p.root.position.set(x, KS.groundAt(x, z, 60, 80) + 0.06, z); KS.scene.add(p.root);
    walkers.push({ p, x, z, tx, tz, t: 3 }); if (line) KS.say(p.root, line, 2.6);
  }

  U.update = (dt) => {
    const PL = KS.Player, v = PL.vehicle, cls = clsOf(v);
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i]; w.t -= dt; const dx = w.tx - w.x, dz = w.tz - w.z, d = Math.hypot(dx, dz);
      if (d > 0.3) { w.x += (dx / d) * 1.4 * dt; w.z += (dz / d) * 1.4 * dt; w.p.root.rotation.y = Math.atan2(dx, dz); KS.animWalk(w.p, dt, 1.4); }
      w.p.root.position.set(w.x, KS.groundAt(w.x, w.z, 60, 80) + 0.06, w.z);
      if (w.t <= 0) { KS.scene.remove(w.p.root); walkers.splice(i, 1); }
    }
    if (!U.online) return;
    if (!U.trip) {
      if (U.request) { U.request.expires -= dt; if (U.request.expires <= 0) U.decline(); }
      else if (cls) { U.nextReq -= dt; if (U.nextReq <= 0) { U.request = makeRequest(); U.nextReq = KS.r(6, 12); if (U.request) { KS.audio.ding(); U.render(); } } }
      if (KS.Input.hit('KeyY') || KS.Input.hit('KeyAccept')) U.accept();
      if (KS.Input.hit('KeyN') && U.request) U.decline();
      return;
    }
    const tr = U.trip; tr.age += dt;
    if (KS.Input.hit('KeyX')) return U.cancel();
    if (tr.stage === 'drop' && v && !tr.t.cls.includes(clsOf(v))) { /* changed vehicle mid-trip */ }
    const sp = v ? Math.abs(v.speed) : 99;
    if (tr.stage === 'pickup') {
      const d = Math.hypot(PL.x - tr.from.x, PL.z - tr.from.z);
      if (d < 8 && v && sp < 2 && tr.t.cls.includes(cls)) {
        tr.stage = 'drop'; tr.t0 = KS.clock; KS.Game.setTarget(tr.to.x, tr.to.z, tr.to.name);
        if (!tr.parcel) { walker(tr.t.person, tr.from.x, tr.from.z, PL.x, PL.z, KS.pick(tr.t.lines.slice(0, 1))); setTimeout(() => { walkers.length && KS.scene.remove(walkers[walkers.length - 1].p.root); walkers.pop(); spawnRider(tr); }, 1300); }
        else spawnRider(tr);
        KS.Game.notify(`${tr.t.icon} ${tr.parcel ? 'Parcel collected' : tr.t.name + ' is on board'}. Drop at <b>${tr.to.name}</b>. ${tr.t.wants}.`);
        U.render();
      } else if (d < 8 && v && !tr.t.cls.includes(cls)) KS.Game.prompt('This job needs a ' + tr.t.cls.join(' or ') + ' vehicle');
    } else {
      // speeding discomfort
      if (v) { const lim = KS.speedLimit(PL.x, PL.z), kmh = sp * 3.6, gentleLim = tr.t.gentle ? Math.min(lim, 35) : lim + 8; if (kmh > gentleLim) U.event('speed', dt * 2); }
      const d = Math.hypot(PL.x - tr.to.x, PL.z - tr.to.z);
      if (d < 9 && v && sp < 2.2) {
        const used = KS.clock - tr.t0, late = used / tr.eta;
        let stars = KS.clamp(Math.round(tr.comfort / 20), 1, 5);
        if (late > 1.5) stars--; if (late < 0.8 && tr.t.hurry) stars = Math.min(5, stars + 1);
        if (tr.t.strict && tr.comfort < 90) stars--;
        stars = KS.clamp(stars, 1, 5);
        let tip = 0;
        if (stars >= 4) tip = Math.round(tr.fare * (stars === 5 ? 0.2 : 0.08) * (tr.t.tip || 1) / 10) * 10;
        if (tr.t.urgent && late < 1) tip += 150;
        const tokens = stars + (tr.t.village || tr.t.fromVillage ? 3 : 0);
        removeRider();
        if (!tr.parcel) walker(tr.t.person, PL.x + Math.cos(PL.h) * 1.6, PL.z - Math.sin(PL.h) * 1.6, tr.to.x + KS.r(-8, 8), tr.to.z + KS.r(-8, 8), stars >= 4 ? tr.t.lines[1] : KS.pick(['Hmm.', 'Next time drive better.', 'Ali bistarai chalaunus.']));
        const s = KS.Shop.data.uthao; s.trips++; s.earned += tr.fare + tip; U.rate(stars);
        KS.Game.pay(tr.fare + tip, `Uthao ${tr.parcel ? 'delivery' : 'ride'} · ${'★'.repeat(stars)}${'☆'.repeat(5 - stars)}${tip ? ' incl. tip' : ''}`);
        KS.Game.giveTokens(tokens, 'Trip completed');
        U.trip = null; KS.Game.clearTarget(); U.nextReq = 5; U.render();
      }
    }
  };

  U.render = () => {
    const el = $('phone'); if (!el) return;
    el.classList.toggle('on', U.online);
    const s = KS.Shop.data.uthao, PL = KS.Player, cls = clsOf(PL.vehicle);
    let body = '';
    if (!U.online) body = `<p class="ph-muted">Go online to get ride and parcel requests.</p>`;
    else if (U.request) {
      const r = U.request;
      body = `<div class="req"><div class="req-h"><span class="req-ic">${r.t.icon}</span><div><b>${r.t.name}</b><small>${r.t.wants}</small></div></div>
        <div class="req-row"><span>Pickup ${Math.round(r.pick)} m</span><span>Trip ${(r.dist / 1000).toFixed(1)} km</span></div>
        <div class="req-row"><span>→ ${r.to.name}</span><b>रु ${r.fare}</b></div>
        <div class="req-btns"><button type="button" class="btn small-btn" id="uAccept">Accept <kbd>Y</kbd></button><button type="button" class="btn ghost small-btn" id="uDecline">Skip <kbd>N</kbd></button></div></div>`;
    } else if (U.trip) {
      const t = U.trip;
      body = `<div class="req"><div class="req-h"><span class="req-ic">${t.t.icon}</span><div><b>${t.stage === 'pickup' ? 'Go to pickup' : 'Drop at ' + t.to.name}</b><small>${t.t.wants}</small></div></div>
        <div class="req-row"><span id="uMeta"></span><b>रु ${t.fare}</b></div>
        <div class="req-btns"><button type="button" class="btn ghost small-btn" id="uCancel">Cancel <kbd>X</kbd></button></div></div>`;
    } else {
      const miss = PL.vehicle && KS.Law.missingFor(PL.vehicle.kind);
      body = `<p class="ph-muted">${miss === 'suspended' ? 'Your licence is suspended. Bicycle parcel jobs only.' : miss ? `Uthao needs a valid category ${miss} licence for this vehicle. Get one at the Transport Management Office, or use a bicycle for parcels.` : cls ? 'Waiting for requests…' : 'Get on a bicycle, bike, car or cargo vehicle to receive jobs.'}</p>`;
    }
    $('phBody').innerHTML = body;
    $('phStats').textContent = `★ ${U.rating().toFixed(1)} · ${s.trips} trips · रु ${s.earned.toLocaleString('en-IN')}`;
    const a = $('uAccept'), d = $('uDecline'), c = $('uCancel');
    if (a) a.onclick = U.accept; if (d) d.onclick = U.decline; if (c) c.onclick = () => U.cancel();
  };
  U.tick = () => { // called from HUD refresh
    const m = $('uMeta'), tr = U.trip; if (!m || !tr) return;
    const PL = KS.Player, tgt = tr.stage === 'pickup' ? tr.from : tr.to, d = Math.round(Math.hypot(PL.x - tgt.x, PL.z - tgt.z));
    m.textContent = tr.stage === 'pickup' ? `${d} m away` : `${d} m · comfort ${Math.max(0, Math.round(tr.comfort))}%`;
    if (U.request) { const b = $('phBody').querySelector('.req'); if (b) b.style.setProperty('--left', (U.request.expires / 15) * 100 + '%'); }
  };
})();
