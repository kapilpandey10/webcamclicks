/* Kathmandu Streets — the law: driving licences (written test + trial), demerit points (12 = suspended),
   camera e-challans, police stops with discretion (warning, challan, apologise, argue), police alerts,
   chases and arrests, hit-and-run, and the licence trials at the Transport Management Office. */
(function () {
  'use strict';
  const KS = window.KS;
  const L = (KS.Law = { heat: 0, stop: null, trial: null, incidents: [], lose: 0, caught: 0, modal: null });
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => 'रु ' + Math.round(n).toLocaleString('en-IN');
  const SUSPEND = 960; // one in-game day, in seconds
  const CAT = { A: 'Motorcycle & scooter', B: 'Car, jeep, pickup & tempo', G: 'Bus & truck' };
  const FEES = { A: 1000, B: 1800, G: 3000 };

  /** riding a bicycle: no fines and no demerit points */
  const onCycle = () => { const v = KS.Player && KS.Player.vehicle; return !!v && v.kind === 'bicycle'; };
  /** a Nepali-style smart licence card (in-game) */
  L.cardHTML = (d) => {
    const P = KS.Shop.data, name = (P.netName || 'Rider').toUpperCase(), issue = new Date(d.issued || Date.now()), exp = new Date(issue); exp.setFullYear(exp.getFullYear() + 5);
    const f = (dt) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const cats = Object.entries(d.lic).filter(([, v]) => v).map(([k]) => k).join(', ') || '—';
    return `<div class="dl"><div class="dlh"><span class="dlflag"></span><div><b lang="ne">यातायात व्यवस्था कार्यालय · काठमाडौं</b><small>Transport Management Office · Kathmandu</small></div></div>
      <div class="dlt"><b lang="ne">सवारी चालक अनुमतिपत्र</b> · <b>DRIVING LICENCE</b></div>
      <div class="dlb"><div class="dlp"><span>👤</span></div><dl>
        <dt>D.L. No.</dt><dd>${d.no}</dd><dt>Name</dt><dd>${name.replace(/[<>&"]/g, '')}</dd><dt>Address</dt><dd>Kathmandu-${d.ward || 17}, Bagmati</dd>
        <dt>Blood group</dt><dd>${d.blood || 'B+'}</dd><dt>Category</dt><dd><b>${cats}</b></dd><dt>Issued / Expires</dt><dd>${f(issue)} · ${f(exp)}</dd></dl></div>
      <div class="dlf"><span>Holder's signature ~~~</span><span>Kathmandu Streets · in-game card</span></div></div>`;
  };
  function D() {
    const d = KS.Shop.data;
    if (!d.law) {
      const veteran = KS.Shop.hadSave; // players from before licences existed keep riding their bikes
      d.law = { lic: { A: veteran, B: false, G: false }, points: 0, suspend: 0, clean: 0, history: [], paid: 0, warnings: 0, cool: { A: 0, B: 0, G: 0 }, no: '01-06-' + String(KS.ri(10000000, 99999999)), blood: KS.pick(['A+', 'B+', 'O+', 'AB+', 'O-', 'B-']), ward: KS.ri(1, 32) };
      KS.Shop.save();
    }
    return d.law;
  }
  L.data = D;
  L.valid = (kind) => { const c = KS.licenseFor(kind); if (!c) return true; const d = D(); return d.suspend <= 0 && !!d.lic[c]; };
  L.missingFor = (kind) => { const c = KS.licenseFor(kind); if (!c) return null; const d = D(); return d.suspend > 0 ? 'suspended' : d.lic[c] ? null : c; };

  /* ---------- offences ---------- */
  const OFF = {
    speeding: (o) => { const over = o.over || 10; return { name: `Speeding: ${Math.round(o.kmh || 0)} km/h in a ${o.limit || 40} zone`, fine: over <= 10 ? 300 : over <= 20 ? 700 : 1500, pts: over <= 10 ? 1 : over <= 20 ? 2 : 4, minor: over <= 10 }; },
    redlight: () => ({ name: 'Jumped a red light', fine: 1000, pts: 3 }),
    horn: () => ({ name: 'Unnecessary horn (no-horn zone)', fine: 200, pts: 0, minor: true }),
    reckless: () => ({ name: 'Reckless driving near pedestrians', fine: 1000, pts: 3 }),
    nolicense: (o) => ({ name: `Driving without a category ${o.cat} licence`, fine: 1500, pts: 0 }),
    suspended: () => ({ name: 'Driving while your licence is suspended', fine: 3000, pts: 0, extend: 480 }),
    accident: () => ({ name: 'Injured a pedestrian (stayed at the scene)', fine: 2500, pts: 6 }),
    wrongway: () => ({ name: 'Driving on the wrong side of the road', fine: 500, pts: 2 }),
  };
  function record(o, how) {
    const d = D(); d.history.unshift({ name: o.name, fine: how === 'warning' ? 0 : o.fine, pts: how === 'warning' ? 0 : o.pts, how, at: new Date().toLocaleDateString() });
    d.history.length = Math.min(d.history.length, 12);
  }
  function addPoints(p) {
    const d = D(); if (!p) return;
    d.points += p; d.clean = 0;
    if (d.points >= 12) {
      d.points = 0; d.suspend = SUSPEND;
      modal('🚫 Licence suspended', `<p>You reached <b>12 demerit points</b>. Your licence is suspended for one day (about 16 minutes of play).</p><p>Ride a bicycle, walk, or take buses. Driving a motor vehicle now is a serious offence.</p>`, [['Understood', close]]);
      KS.audio.fail();
      KS.Uthao && KS.Uthao.online && KS.Uthao.render();
    }
  }
  function charge(o, how) {
    const d = D();
    if (how !== 'warning') { KS.Shop.data.cash -= o.fine; d.paid += o.fine; addPoints(o.pts); if (o.extend) d.suspend += o.extend; }
    else d.warnings++;
    record(o, how); KS.Game.save(); KS.Uthao && KS.Uthao.event('fine');
  }
  /** automatic e-challan from a speed or red-light camera */
  L.ticket = (code, opts = {}) => { if (KS.Battle && KS.Battle.on) return; if (onCycle()) return;
    if (L.trial) return;
    const o = OFF[code](opts); charge(o, 'camera');
    KS.Game.notify(`📸 E-challan: ${o.name} · −${fmt(o.fine)}${o.pts ? ` · ${o.pts} point${o.pts > 1 ? 's' : ''}` : ''}`, 'bad');
    KS.audio.speedcam();
  };
  /** a police officer or patrol saw something: whistle and ask you to pull over */
  L.offense = (code, opts = {}) => { if (KS.Battle && KS.Battle.on) return; if (onCycle()) return;
    if (L.trial || L.heat > 0) return;
    const o = OFF[code](opts); o.code = code;
    if (L.stop) { if (!L.stop.offs.some((x) => x.code === code)) L.stop.offs.push(o); return; }
    const P = KS.Player, off = nearestOfficer(P.x, P.z, 60);
    if (!off) return;
    L.stop = { offs: [o], officer: off, t: 15, still: 0 };
    if (off.v && !off.v.chase) KS.Traffic.startChase(off.v);
    KS.audio.whistle(1); KS.say(off.obj, KS.pick(['Rok! Side ma lagaunus!', 'Oi! Gaadi rok!', 'Pull over, bhai!']), 2.4, 'angry');
  };
  function nearestOfficer(x, z, r) {
    let best = null, bd = r;
    for (const p of KS.Peds.police) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = { ped: p, obj: p.p.root, get x() { return p.x; }, get z() { return p.z; } }; } }
    for (const v of KS.Traffic.list) if ((v.kind === 'police' || v.kind === 'policebike') && v.root.visible && v !== KS.Player.vehicle) { const d = Math.hypot(v.x - x, v.z - z); if (d < bd * 0.8) { bd = d; best = { v, obj: v.root, get x() { return v.x; }, get z() { return v.z; } }; } }
    return best;
  }
  L.policeNear = (x, z, r) => !!nearestOfficer(x, z, r);

  /* ---------- the roadside check ---------- */
  function inspect() {
    const s = L.stop, P = KS.Player, v = P.vehicle, d = D(), offs = s.offs.slice();
    if (v) { const miss = L.missingFor(v.kind); if (miss === 'suspended') offs.push(OFF.suspended()); else if (miss) offs.push(OFF.nolicense({ cat: miss })); }
    const total = offs.reduce((a, o) => a + o.fine, 0), pts = offs.reduce((a, o) => a + o.pts, 0);
    const minorOnly = offs.every((o) => o.minor);
    const mercy = KS.clamp(0.2 + KS.Shop.data.karma / 250 + (d.history.length ? 0 : 0.2) - d.points * 0.03, 0.05, 0.75);
    const finish = (how, mult = 1, extraPts = 0) => {
      close(); if (s.officer.v) KS.Traffic.endChase(s.officer.v); L.stop = null;
      if (how === 'warning') { offs.forEach((o) => record(o, 'warning')); d.warnings++; KS.Game.notify('👮 Warning only: "Ali bistarai, bhai. Yes palta maaf."', 'good'); KS.Game.karma(+1, 'Took the warning politely'); KS.Game.save(); return; }
      offs.forEach((o) => charge({ ...o, fine: Math.round((o.fine * mult) / 50) * 50 }, 'police'));
      addPoints(extraPts);
      KS.Game.notify(`🧾 Challan: −${fmt(Math.round((total * mult) / 50) * 50)}${pts + extraPts ? ` · ${pts + extraPts} points` : ''}`, 'bad'); KS.audio.fail();
      if (offs.some((o) => o.name.startsWith('Driving without') || o.name.startsWith('Driving while'))) KS.Game.notify('Your vehicle stays here. Get a licence at the Transport Management Office.', 'bad');
    };
    const list = offs.map((o) => `<li><span>${o.name}</span><b>${fmt(o.fine)}${o.pts ? ` · ${o.pts} pt` : ''}</b></li>`).join('');
    const lic = v ? (L.valid(v.kind) ? `<p class="ok">Licence checked: valid for this vehicle.</p>` : '') : '';
    if (!offs.length) { modal('👮 Licence check', `<p>"Licence dekhaunus." The officer checks your papers.</p>${lic}<p>"Thik cha. Dhanyabad, jaanus."</p>`, [['Drive on', () => { close(); if (s.officer.v) KS.Traffic.endChase(s.officer.v); L.stop = null; }]]); return; }
    modal('👮 Traffic police check', `<p>"Licence dekhaunus." The officer writes on the challan pad:</p><ul class="challan">${list}</ul>${lic}<p class="small">Points on your licence: ${d.points}/12. Officers often let polite drivers with clean records off with a warning.</p>`, [
      ['Pay the challan', () => finish('pay')],
      ['Say sorry (हजुर, माफ गर्नुस्)', () => { if (minorOnly && Math.random() < mercy + 0.2) finish('warning'); else if (Math.random() < mercy) finish('pay', 0.6); else finish('pay'); }],
      ['Argue', () => { if (Math.random() < 0.18) finish('warning'); else { KS.Game.notify('👮 "Ma sanga bahas? Double challan!"', 'bad'); finish('pay', 1.5, 1); } }],
    ]);
  }

  /* ---------- police alert, chase, arrest ---------- */
  L.raise = (level, why) => { if (KS.Battle && KS.Battle.on) return;
    if (L.trial) return;
    if (L.stop) { if (L.stop.officer.v) KS.Traffic.endChase(L.stop.officer.v); L.stop = null; close(); }
    if (level <= L.heat) { L.lose = 0; return; }
    L.heat = level; L.lose = 0; L.caught = 0; L.why = why;
    KS.Game.notify(`🚨 Police alert: ${why}`, 'bad'); KS.audio.whistle(1);
    const P = KS.Player;
    const have = KS.Traffic.chasers().length;
    KS.Traffic.list.filter((v) => (v.kind === 'police' || v.kind === 'policebike') && !v.chase && v !== P.vehicle && Math.hypot(v.x - P.x, v.z - P.z) < 260)
      .sort((a, b) => Math.hypot(a.x - P.x, a.z - P.z) - Math.hypot(b.x - P.x, b.z - P.z)).slice(0, Math.max(0, level * 2 - have)).forEach((v) => KS.Traffic.startChase(v));
  };
  function arrest() {
    const P = KS.Player, d = D(), h = L.heat, fine = [0, 2000, 4500, 8000][h], pts = [0, 3, 6, 9][h];
    for (const v of KS.Traffic.chasers()) KS.Traffic.endChase(v);
    L.heat = 0; L.caught = 0; L.lose = 0;
    const v = P.vehicle;
    if (v) { P.vehicle.speed = 0; P.exit(); if (P.vehicle) { P.vehicle = null; } if (v.owned) { KS.Traffic.remove(v); if (KS.Shop.delivered === v) KS.Shop.delivered = null; } else KS.Traffic.recycle(v, P.x + 300, P.z + 300); }
    P.x = KS.policeStation.x; P.z = KS.policeStation.z; P.y = 0.2; P.mode = 'foot';
    if (P.person.root.parent !== P.scene) P.scene.add(P.person.root);
    P.person.root.visible = true;
    KS.Shop.data.cash -= fine; d.paid += fine; record({ name: 'Arrested: ' + (L.why || 'police alert'), fine, pts }, 'arrest');
    const susp = h >= 2 && Object.values(d.lic).some(Boolean);
    addPoints(pts); if (susp && d.suspend <= 0) d.suspend = SUSPEND;
    KS.Uthao && KS.Uthao.trip && KS.Uthao.cancel(true);
    KS.Game.save();
    modal('🚔 Arrested', `<p>The police caught you for: <b>${L.why || 'running from the police'}</b>.</p><ul class="challan"><li><span>Penalty</span><b>${fmt(fine)}</b></li><li><span>Demerit points</span><b>${pts}</b></li>${susp ? '<li><span>Licence</span><b>Suspended for a day</b></li>' : ''}</ul><p>You were released from the Metropolitan Police Office at Hanuman Dhoka. ${v && v.owned ? 'Your vehicle was impounded; call it again from the Garage.' : ''}</p>`, [['Walk out', close]]);
    KS.audio.fail();
  }

  /* ---------- injuries & hit-and-run ---------- */
  L.injury = (ped) => {
    const P = KS.Player; if (!P.vehicle) return;
    L.incidents.push({ ped, x: ped.x, z: ped.z, t: 0, stay: 0, amb: null });
    KS.Game.karma(-6, 'Injured a pedestrian'); KS.Uthao && KS.Uthao.event('crash');
    KS.Game.notify('⚠ You hit someone. Stop and stay with them until help arrives, or the police will be after you.', 'bad');
  };
  function incidents(dt) {
    const P = KS.Player;
    for (let i = L.incidents.length - 1; i >= 0; i--) {
      const c = L.incidents[i]; c.t += dt;
      if (c.t > 5 && !c.amb) { c.amb = KS.Traffic.park('ambulance', c.x + 3, c.z + 3, KS.r(0, 6)); }
      const d = Math.hypot(P.x - c.x, P.z - c.z);
      if (d < 25 && Math.abs(P.speed) < 1) c.stay += dt;
      if (c.stay > 8 && !c.done) { c.done = true; charge(OFF.accident(), 'police'); KS.Game.notify(`👮 You stayed with the injured person. Police recorded the accident: −${fmt(2500)} · 6 points`, 'bad'); KS.Game.karma(+3, 'Stayed to help'); }
      if (!c.done && d > 80 && c.t < 40) { c.done = true; L.raise(2, 'Hit and run'); }
      if (!c.ped.injured && c.t > 12) { if (c.amb) KS.Traffic.remove(c.amb); L.incidents.splice(i, 1); }
    }
  }

  /* ---------- licence trials ---------- */
  const QUESTIONS = [
    ['In Nepal you drive on which side of the road?', ['Left', 'Right', 'Either'], 0],
    ['The traffic light turns amber as you approach. You should:', ['Speed up to cross', 'Prepare to stop', 'Honk and go'], 1],
    ['Speed limit in a school zone during school hours:', ['25 km/h', '40 km/h', '60 km/h'], 0],
    ['Who must wear a helmet on a motorcycle?', ['Only the rider', 'Rider and pillion', 'Nobody in the city'], 1],
    ['In a left-hand traffic country you overtake on the:', ['Left', 'Right', 'Pavement'], 1],
    ['A traffic police officer raises an open palm towards you. You:', ['Stop', 'Slow down and pass', 'Flash your lights'], 0],
    ['Using the horn inside the Kathmandu Valley is:', ['Required at every junction', 'Banned except in an emergency', 'Fine at night'], 1],
    ['An ambulance with a siren is behind you. You:', ['Keep your lane', 'Pull aside and let it pass', 'Race it'], 1],
    ['Drink driving in Nepal is:', ['Allowed below one glass', 'Zero tolerance (mapase)', 'Only checked on festivals'], 1],
    ['At a zebra crossing with people waiting you must:', ['Give way to pedestrians', 'Honk so they wait', 'Speed up'], 0],
    ['Talking on a mobile phone while driving is:', ['Allowed with one hand', 'An offence', 'Allowed when stopped at red'], 1],
    ['How many demerit points lead to a suspended licence in this game?', ['6', '12', '20'], 1],
    ['A sacred cow is lying in the road. You:', ['Drive around it slowly', 'Hit the horn and push', 'Stop the traffic for an hour'], 0],
    ['The licence category for a motorcycle or scooter is:', ['A', 'B', 'G'], 0],
  ];
  L.openCounter = () => {
    const d = D();
    const rows = ['A', 'B'].map((c) => `<li><span><b>Category ${c}</b> · ${CAT[c]}</span><b>${d.lic[c] ? '✔ Held' : fmt(FEES[c])}</b></li>`).join('');
    const btns = [];
    for (const c of ['A', 'B']) if (!d.lic[c]) btns.push([d.cool[c] > 0 ? `Retake ${c} now · 3 🪙 (or wait ${Math.ceil(d.cool[c])} s)` : `Apply for ${c}: written test + trial`, () => {
      if (d.cool[c] > 0) { const P = KS.Shop.data; if (P.tokens < 3) { KS.Game.notify('You need 3 coins to skip the wait.', 'bad'); return; } P.tokens -= 3; d.cool[c] = 0; KS.Game.save(); close(); startTrial(c); return; }
      if (KS.Shop.data.cash < FEES[c]) { KS.Game.notify(`The ${c} test costs ${fmt(FEES[c])}.`, 'bad'); return; } KS.Shop.data.cash -= FEES[c]; KS.Game.save(); quiz(c); }]);
    if (Object.values(d.cool).some((x) => x > 0) || d.failed) { d.failed = true; KS.Game.notify('🤫 A man in the queue whispers: "Trial is hard, hai? Look for the man in sunglasses at the little tea stall outside the trial ground fence, south-east corner…"'); }
    btns.push(['Close', close]);
    modal('🪪 Licence counter', `<p>Namaste! Licences are issued after a computer written test and a practical trial on the ground behind this office.</p><ul class="challan">${rows}</ul>${d.suspend > 0 ? `<p class="bad">Your licence is suspended for ${Math.ceil(d.suspend / 60)} more minutes.</p>` : ''}`, btns);
  };
  function quiz(cat) {
    const qs = QUESTIONS.slice().sort(() => Math.random() - 0.5).slice(0, 8); let i = 0, right = 0;
    const ask = () => {
      if (i >= qs.length) {
        if (right >= 6) modal('✅ Written test passed', `<p>You scored <b>${right}/8</b>. Now the trial: ${cat === 'A' ? 'ride the figure-8 between the white lines without stopping, cross the plank ramp, weave the cones and cross the finish line. Follow the yellow guide line and the markers.' : 'pass the two cones, stop on the hill and move off without rolling back, follow the blue guide line round, stop inside the big yellow box facing the finish, then drive to the finish line.'}</p><p class="small">You may touch a pole or cone twice; the third touch fails. Leaving the course for more than 5 seconds or running out of time also fails.</p>`, [['Go to the trial', () => { close(); startTrial(cat); }]]);
        else { D().cool[cat] = 90; modal('❌ Written test failed', `<p>You scored ${right}/8 (6 needed). You can retake it in 90 seconds.</p>`, [['OK', close]]); KS.audio.fail(); }
        return;
      }
      const [q, opts, ans] = qs[i];
      modal(`📝 Written test ${i + 1}/8`, `<p class="q">${q}</p>`, opts.map((o, k) => [o, () => { if (k === ans) { right++; KS.audio.ding(); } else KS.audio.fail(); i++; ask(); }]));
    };
    ask();
  }
  function startTrial(cat) {
    const g = KS.trialGround, P = KS.Player, st = cat === 'A' ? g.bikeStart : g.carStart;
    if (P.vehicle) P.exit();
    const v = KS.Traffic.park(cat === 'A' ? 'bike' : 'car', st.x, st.z, st.h, { color: 0xf4f4f4 }); v.trialVehicle = true; v.type = Object.assign({}, v.type, { name: 'Trial ' + (cat === 'A' ? 'bike' : 'car') });
    P.x = st.x - Math.cos(st.h) * 2; P.z = st.z + Math.sin(st.h) * 2; P.y = 0.2;
    const cps = [];
    if (cat === 'A') {
      const { c1, c2, r } = g.B8;
      for (let k = 1; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; cps.push({ x: c1[0] + Math.sin(a) * r, z: c1[1] + Math.cos(a) * r, r: 2.6, lane: true }); }
      for (let k = 1; k <= 8; k++) { const a = (k / 8) * Math.PI * 2; cps.push({ x: c2[0] + Math.sin(a) * r, z: c2[1] - Math.cos(a) * r, r: 2.6, lane: true }); }
      cps.push({ x: g.plank.x0 - 0.6, z: g.plank.z, r: 1.8, plankStart: true }, { x: (g.plank.x0 + g.plank.x1) / 2, z: g.plank.z, r: 1.8, needY: 0.35 }, { x: g.plank.x1 + 0.8, z: g.plank.z, r: 1.8, plankEnd: true });
      g.slalom.forEach(([x, z], k) => { if (k < 4) cps.push({ x: x + 2.5, z: z + (k % 2 ? 2 : -2), r: 2 }); });
      cps.push({ x: g.bikeFinish.x, z: g.bikeFinish.z, r: 3, finish: true });
    } else {
      g.carCones.forEach((z, k) => cps.push({ x: g.hill.x + (k % 2 ? 2.6 : -2.6), z, r: 2.6 }));
      cps.push({ x: g.hill.x, z: 214, r: 2.8 }, { stopHill: true }, { x: g.hill.x, z: 196, r: 3 }, { park: true }, { x: g.carFinish.x, z: g.carFinish.z, r: 3.2, finish: true });
    }
    L.trial = { cat, v, cps, i: 0, t: 0, started: false, still: 0, hits: 0, out: 0, limit: cat === 'A' ? 240 : 420 };
    KS.Game.setTarget(cps[0].x || g.hill.x, cps[0].z || 213, 'Trial');
    KS.Game.notify(`🏁 Trial ${cat}: get on the white ${cat === 'A' ? 'bike' : 'car'} (E). Follow the yellow markers.`);
  }
  function trialFail(why) {
    const t = L.trial; if (!t || t.over) return; t.over = true;
    D().cool[t.cat] = 90; KS.audio.fail(); KS.Game.clearTarget();
    const cat = t.cat, P = KS.Shop.data;
    modal('❌ Trial failed', `<p>${why}.</p><p>Try again straight away for <b>3 🪙</b> (no new test or fee), or wait 90 seconds and apply again at the counter.</p>`,
      [[`🔁 Retry now · 3 🪙 (you have ${P.tokens})`, () => { if (P.tokens < 3) { KS.Game.notify('You need 3 coins. Collect coins on the streets and rooftops!', 'bad'); return; } P.tokens -= 3; D().cool[cat] = 0; KS.Game.save(); close(); endTrial(); setTimeout(() => startTrial(cat), 450); }], ['OK', () => { close(); endTrial(); }]]);
  }
  function trialPass() {
    const t = L.trial; t.over = true; const d = D(); d.lic[t.cat] = true; KS.Game.save(); KS.audio.cash(); KS.Game.clearTarget();
    KS.Game.giveTokens(3, 'Licence passed');
    modal('🎉 Licence issued!', `<p>You passed the category <b>${t.cat}</b> trial in ${Math.round(t.t)} s.</p>${(d.issued = d.issued || Date.now(), L.cardHTML(d))}<p>Uthao jobs for ${CAT[t.cat].toLowerCase()} are now open to you.</p>`, [['Great!', () => { close(); endTrial(); }]]);
  }
  function endTrial() {
    const t = L.trial; if (!t) return; L.trial = null;
    const P = KS.Player; if (P.vehicle === t.v) P.exit(); if (P.vehicle === t.v) { P.vehicle.speed = 0; }
    setTimeout(() => { if (KS.Player.vehicle !== t.v) KS.Traffic.remove(t.v); }, 400);
  }
  L.trialHit = () => { const t = L.trial; if (!t || !t.started || KS.clock - (t.hitT || -9) < 1.2) return; t.hitT = KS.clock; t.hits++; if (t.hits >= 3) trialFail('You touched the poles or cones three times'); else { KS.audio.fail(); KS.Game.notify(`⚠️ You touched a pole (${t.hits} of 2 allowed). Careful!`, 'bad'); } };
  function trialUpdate(dt) {
    const t = L.trial, P = KS.Player, g = KS.trialGround; if (t.over) return;
    if (P.vehicle !== t.v) { if (t.started) trialFail('You got off the vehicle'); return; }
    if (!t.started) { t.started = true; KS.Game.notify('⏱ Trial started. Go!'); }
    t.t += dt; if (t.t > t.limit) return trialFail('Time is up');
    const v = t.v, sp = Math.abs(v.speed), c = t.cps[t.i];
    if (t.cat === 'A') {
      if (t.i > 0 && !c.finish) { if (sp < 0.3) { t.still += dt; if (t.still > 3) return trialFail('You stopped and put your foot down'); if (t.still > 1.2) KS.Game.prompt('Keep moving! Stopping means putting a foot down'); } else t.still = 0; }
      if (c.lane && t.i > 0) { const { c1, c2, r } = g.B8, e = Math.min(Math.abs(Math.hypot(v.x - c1[0], v.z - c1[1]) - r), Math.abs(Math.hypot(v.x - c2[0], v.z - c2[1]) - r)); if (e > 2.4) return trialFail('You rode outside the figure-8 lane'); if (e > 1.6) KS.Game.prompt('Stay between the white lines!'); }
      if (t.onPlank && v.x > g.plank.x0 + 0.6 && v.x < g.plank.x1 - 0.6 && v.y < 0.2) return trialFail('You fell off the plank');
    } else {
      const A = g.carArea; if (v.x < A.x0 || v.x > A.x1 || v.z < A.z0 || v.z > A.z1 + 1) { t.out += dt; KS.Game.prompt('Out of the course: drive back in!'); if (t.out > 5) return trialFail('You drove out of the course'); } else t.out = 0;
      if (t.hillStop && !t.hillDone) { if (v.z > t.hillStop + 1.3) return trialFail('You rolled back on the hill'); }
    }
    if (c.stopHill) {
      const H = g.hill;
      if (Math.abs(v.x - H.x) < 1.7 && v.z > H.zTop0 && v.z < H.zTop1) { KS.Game.prompt('Hill start: stop completely, then move off without rolling back'); if (sp < 0.3) { t.still += dt; if (t.still > 1.5) { t.hillStop = v.z; next(); KS.audio.ding(); KS.Game.notify('✔ Hill stop. Now move off without rolling back.'); } } else t.still = 0; }
      else if (v.z < H.zTop0 - 0.5) return trialFail('You did not stop on the hill');
      return;
    }
    if (c.park) {
      const B = g.box, inside = Math.abs(v.x - B.x) < 1.3 && Math.abs(v.z - B.z) < 2.1;
      KS.Game.prompt('Follow the blue line round and stop inside the yellow box, facing the finish');
      if (Math.abs(v.x - B.x) < B.w / 2 && Math.abs(v.z - B.z) < B.d / 2 && v.speed < -0.2) t.revIn = true;
      if (inside && Math.abs(KS.wrapAng(v.h)) < 0.5 && sp < 0.3) { t.still += dt; if (t.still > 1) { next(); KS.audio.ding(); KS.Game.notify('✔ Parked. Drive to the finish line.'); } } else if (!(sp < 0.25)) t.still = 0;
      return;
    }
    if (Math.hypot(v.x - c.x, v.z - c.z) < c.r && (!c.needY || v.y > c.needY)) {
      if (c.plankStart) t.onPlank = true; if (c.plankEnd) t.onPlank = false;
      if (t.cps[t.i - 1] && t.cps[t.i - 1].stopHill) t.hillDone = true;
      if (c.x === g.hill.x && c.z < 200) t.hillDone = true;
      if (c.finish) return trialPass();
      next();
    }
    function next() { t.i++; t.still = 0; const n = t.cps[t.i]; if (!n) return; if (n.stopHill) KS.Game.setTarget(g.hill.x, (g.hill.zTop0 + g.hill.zTop1) / 2, 'Hill stop'); else if (n.park) KS.Game.setTarget(g.box.x, g.box.z, 'Parking box'); else KS.Game.setTarget(n.x, n.z, 'Trial'); }
  }

  /* ---------- the secret agent (a "dalal") behind the tea shop: a licence without the trial ---------- */
  L.agentTalk = () => {
    const d = D(), P = KS.Shop.data, PRICE = 15000, need = ['A', 'B'].filter((c) => !d.lic[c]);
    KS.say(KS.agent.root, 'Psst… dai!', 1.6, 'calm');
    if (!need.length) { modal('🕶️ The man in sunglasses', '<p>"You already have everything, dai. You never saw me, hai?"</p>', [['Leave', close]]); return; }
    modal('🕶️ The man in sunglasses', `<p>"Psst… Licence chahiyo? No test, no trial, no line. <b>${fmt(PRICE)}</b> per category, card ready tomorrow… I mean, now."</p><p class="small">"Kasailai nabhannu hai. Don't tell anyone."</p>`,
      need.map((c) => [`Pay ${fmt(PRICE)} for ${c} (${CAT[c]})`, () => {
        if (P.cash < PRICE) { KS.Game.notify(`"Paisa chaina? Come back with ${fmt(PRICE)}."`, 'bad'); return; }
        P.cash -= PRICE; d.lic[c] = true; d.agent = true; d.issued = d.issued || Date.now(); KS.Game.save(); KS.audio.cash();
        modal('🪪 "Here. Fresh card."', `<p>He slips a card into your hand and disappears into the crowd.</p>${L.cardHTML(d)}`, [['Thanks… I think', close]]);
      }]).concat([['No thanks', close]]));
  };

  /* ---------- modal ---------- */
  function modal(title, html, buttons) {
    L.modal = true; KS.state = 'modal'; if (document.exitPointerLock) document.exitPointerLock();
    $('lawTitle').textContent = title; $('lawBody').innerHTML = html;
    const row = $('lawBtns'); row.innerHTML = '';
    buttons.forEach(([label, fn], i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small-btn' + (i ? ' ghost' : ''); b.innerHTML = `${label} <kbd>${i + 1}</kbd>`; b.onclick = fn; row.appendChild(b); });
    $('lawModal').hidden = false; L.buttons = buttons;
  }
  function close() { $('lawModal').hidden = true; L.modal = null; if (KS.state === 'modal') KS.state = 'play'; }
  L.modalKey = (n) => { if (L.buttons && L.buttons[n]) L.buttons[n][1](); };
  L.close = close;
  KS.modal = modal; KS.modalClose = close;

  /* ---------- per-frame ---------- */
  L.update = (dt) => {
    if (KS.Battle && KS.Battle.on) return; // Battle mode: no police at all
    const d = D(), P = KS.Player, v = P.vehicle;
    if (d.suspend > 0) { d.suspend = Math.max(0, d.suspend - dt); if (d.suspend === 0) KS.Game.notify('🪪 Your licence suspension is over. Drive carefully!', 'good'); }
    for (const k in d.cool) d.cool[k] = Math.max(0, d.cool[k] - dt);
    if (v && L.heat === 0 && !L.stop) { d.clean += dt; if (d.clean > 240 && d.points > 0) { d.points--; d.clean = 0; KS.Game.notify('🪪 One demerit point expired for clean driving.', 'good'); } }
    if (L.trial) trialUpdate(dt);
    incidents(dt);
    // roadside stop in progress
    const s = L.stop;
    if (s) {
      s.t -= dt; const dist = Math.hypot(P.x - s.officer.x, P.z - s.officer.z);
      const stopped = !v || Math.abs(v.speed) < 0.6;
      if (stopped && dist < 40) { s.still += dt; if (s.still > 1.2) inspect(); }
      else if (s.t <= 0 || dist > 110) { const o = s.officer; L.stop = null; if (o.v) KS.Traffic.endChase(o.v); L.raise(1, 'Ignored a police stop'); }
    }
    // random licence checks at police posts
    if (v && !s && L.heat === 0 && !L.trial && KS.licenseFor(v.kind) && Math.abs(v.speed) > 2) {
      for (const p of KS.Peds.police) if (Math.hypot(p.x - P.x, p.z - P.z) < 9) { if (!p.checkedT || KS.clock - p.checkedT > 60) { p.checkedT = KS.clock; if (Math.random() < (L.valid(v.kind) ? 0.12 : 0.45)) { L.stop = { offs: [], officer: { ped: p, obj: p.p.root, get x() { return p.x; }, get z() { return p.z; } }, t: 12, still: 0 }; KS.audio.whistle(1); KS.say(p.p.root, 'Rok! Licence check!', 2.2); } } }
    }
    // police alert
    if (L.heat > 0) {
      const chasers = KS.Traffic.chasers();
      if (chasers.length < L.heat * 2 && KS.chance(dt * 0.5)) KS.Traffic.spawnPolice(P.x, P.z);
      let near = 1e9;
      for (const c of chasers) near = Math.min(near, c.dist || 1e9);
      for (const p of KS.Peds.police) if (p.chasing) near = Math.min(near, p.dist || 1e9);
      const slow = !v || Math.abs(v.speed) < 1.5;
      if ((near < 5.5 && slow) || (!v && near < 1.6)) { L.caught += dt; if (L.caught > 1.8) return arrest(); } else L.caught = Math.max(0, L.caught - dt);
      if (near > 110) { L.lose += dt; if (L.lose > 10 + L.heat * 8) { for (const c of chasers) KS.Traffic.endChase(c); L.heat = 0; KS.Game.notify('😮‍💨 You lost the police.', 'good'); } } else L.lose = 0;
    }
  };

  /* ---------- HUD & licence card ---------- */
  L.hud = () => {
    const d = D(), v = KS.Player.vehicle;
    const lic = ['A', 'B'].map((c) => `<span class="${d.lic[c] && d.suspend <= 0 ? 'ok' : 'no'}">${c}</span>`).join('');
    $('lawHud').innerHTML = `<span class="lc">Licence ${lic}</span><span class="pts" title="Demerit points">${'●'.repeat(Math.min(12, d.points))}${'○'.repeat(Math.max(0, 12 - d.points))}</span>${d.suspend > 0 ? `<span class="susp">Suspended ${Math.ceil(d.suspend / 60)} min</span>` : ''}`;
    const w = $('wanted'); w.hidden = L.heat <= 0;
    if (L.heat > 0) w.innerHTML = `🚨 Police alert ${'●'.repeat(L.heat)}${'○'.repeat(3 - L.heat)} <small>${L.lose > 0 ? 'losing them…' : L.why || ''}</small>`;
    const sb = $('stopBanner'); sb.hidden = !L.stop;
    if (L.stop) sb.innerHTML = `🚓 Police signal: pull over and stop near the officer <b>${Math.max(0, Math.ceil(L.stop.t))} s</b>`;
    const tb = $('trialBanner'); tb.hidden = !L.trial || !L.trial.started || L.trial.over;
    if (L.trial && L.trial.started) tb.innerHTML = `🏁 Trial ${L.trial.cat} · step ${Math.min(L.trial.i + 1, L.trial.cps.length)}/${L.trial.cps.length} · <b>${Math.max(0, Math.ceil(L.trial.limit - L.trial.t))} s</b>`;
    if (v && !L.trial && !v.warnedLic) { v.warnedLic = true; const m = L.missingFor(v.kind); if (m) KS.Game.notify(m === 'suspended' ? '⚠ Your licence is suspended. If police stop you: big fine.' : `⚠ You have no category ${m} licence. Police checks will fine you ${fmt(1500)}.`, 'bad'); }
  };
  L.renderCard = (el) => {
    const d = D();
    el.innerHTML = `${d.lic.A || d.lic.B ? L.cardHTML(d) : '<p class="small">No licence yet: ride the bicycle (no licence, no fines) or pass the test at the Trial ground.</p>'}<div class="lcard big">
      <span>Categories: ${['A', 'B', 'G'].map((c) => `${c} ${d.lic[c] ? '✔' : '✖'}`).join(' · ')}</span>
      <span>Demerit points: ${d.points}/12 ${d.suspend > 0 ? `· <b class="bad">Suspended ${Math.ceil(d.suspend / 60)} min</b>` : ''}</span>
      <span>Warnings received: ${d.warnings} · Fines paid: ${fmt(d.paid)}</span></div>
      <h4>Recent record</h4><ul class="challan">${d.history.length ? d.history.map((h) => `<li><span>${h.name} <small>(${h.how})</small></span><b>${h.fine ? fmt(h.fine) : 'warning'}${h.pts ? ` · ${h.pts} pt` : ''}</b></li>`).join('') : '<li><span>Clean record. Keep it that way!</span></li>'}</ul>
      <p class="small">Get licences at the Transport Management Office (map: Trial ground). One demerit point expires every 4 minutes of clean driving. 12 points suspend your licence for one in-game day.</p>`;
  };
})();
