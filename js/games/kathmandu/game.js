/* Kathmandu Streets — HUD, minimap & GPS, traffic fines (speed cameras, police, red-light cameras),
   momo deliveries, recording & photos, menu, main loop. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS, G = KS.G;
  const $ = (id) => document.getElementById(id);
  const coarse = matchMedia('(pointer: coarse)').matches;
  const D = KS.Shop.data, A = KS.audio;
  const hi = D.quality ? D.quality === 'high' : !coarse;
  KS.quality = { level: hi ? 'high' : 'low', shadows: hi, shadowSize: hi ? 2048 : 1024, pixelRatio: Math.min(devicePixelRatio || 1, hi ? 2 : 1.25), peds: hi ? 120 : 55, cars: hi ? 110 : 50 };
  KS.clock = 0; KS.state = 'title';
  A.on = D.sound !== false;

  /* ======================= game state ======================= */
  const Game = (KS.Game = { found: new Set(D.found), mission: null, fineT: 0, target: null, route: null });
  Object.defineProperty(Game, 'money', { get: () => D.cash, set: (v) => (D.cash = v) });
  Game.save = () => { D.found = [...Game.found]; D.sound = A.on; D.quality = KS.quality.level; KS.Shop.save(); };
  Game.notify = (html, cls = '') => {
    const el = document.createElement('div'); el.className = 'note ' + cls; el.innerHTML = html; $('notes').prepend(el);
    setTimeout(() => el.classList.add('out'), 4600); setTimeout(() => el.remove(), 5200);
    while ($('notes').children.length > 4) $('notes').lastChild.remove();
  };
  Game.pay = (n, why) => { D.cash += n; if (n > 0) A.cash(); Game.notify(`${n >= 0 ? '+' : '−'} रु ${Math.abs(n).toLocaleString('en-IN')} <span>${why}</span>`, n >= 0 ? 'good' : 'bad'); Game.save(); };
  Game.giveTokens = (n, why) => { D.tokens += n; Game.notify(`+${n} 🪙 coins <span>${why}</span>`, 'karma'); A.coin(); Game.save(); };
  Game.karma = (d, why) => { D.karma = KS.clamp(D.karma + d, 0, 100); if (Math.abs(d) >= 2) Game.notify(`Karma ${d > 0 ? '+' : ''}${d} <span>${why}</span>`, d > 0 ? 'karma' : 'bad'); };
  Object.defineProperty(Game, 'karmaV', { get: () => D.karma });
  Game.fine = (n, why, force) => {
    if (!force && KS.clock - Game.fineT < 6) return; Game.fineT = KS.clock;
    n = Math.min(KS.MAXFINE || 500, n); A.whistle(0.9); Game.pay(-n, '🚓 Fine: ' + why); KS.Uthao.event('fine'); flash('fine');
  };
  Game.policeNear = (x, z, r) => KS.Peds.police.some((p) => Math.hypot(p.x - x, p.z - z) < r) || KS.Traffic.list.some((v) => v.kind === 'police' && v.ai && Math.hypot(v.x - x, v.z - z) < r * 0.6);
  Game.hurt = (dmg) => {
    const PL = KS.Player; if (PL.mode === 'dead') return; PL.health -= dmg; KS.Cam.shake = 0.3; A.punch(); flash('hurt');
    if (PL.health <= 0 && KS.Battle && KS.Battle.on) { PL.health = 0; if (PL.vehicle) { PL.vehicle.speed = 0; PL.exit(); } KS.Battle.died(); return; }
    if (PL.health <= 0) startFaint();
  };
  /* ---------- fainting, the ambulance, and waking up in Bir Hospital ----------
     At 0% health the player does not teleport: they faint where they fall, an
     ambulance drives over with its siren on, and they wake up in a hospital
     bed in Bir Hospital — eyes opening, blinking, like coming round. */
  const Faint = { on: false, stage: '', t: 0, amb: null };
  Game.faint = Faint;
  function fadeBlack(on) { const el = $('fadeBlack'); if (el) el.style.opacity = on ? '1' : '0'; }
  function blinkEyes() { // eyelids: shut, then open slowly, then two quick blinks
    const el = $('wakeEyes'); if (!el) return;
    el.classList.add('instant'); el.classList.add('closed');
    void el.offsetWidth; el.classList.remove('instant');
    requestAnimationFrame(() => el.classList.remove('closed'));
    setTimeout(() => { el.classList.add('blink'); el.classList.add('closed'); }, 1600);
    setTimeout(() => el.classList.remove('closed'), 1800);
    setTimeout(() => el.classList.add('closed'), 2150);
    setTimeout(() => { el.classList.remove('closed'); el.classList.remove('blink'); }, 2350);
  }
  function startFaint() {
    const PL = KS.Player;
    PL.health = 0;
    if (PL.vehicle) PL.exit();
    PL.mode = 'dead';
    if (PL.person && PL.person.root) { PL.person.root.rotation.set(-Math.PI / 2 * 0.92, PL.h, 0); PL.person.root.position.y = 0.35; }
    KS.Peds.list.forEach((p) => (p.fight = 0));
    Faint.on = true; Faint.stage = 'down'; Faint.t = 0; Faint.amb = null;
    Game.notify('😵 You blacked out…', 'bad');
    const amb = KS.Traffic.spawn('ambulance', PL.x, PL.z, 25, 160);
    if (amb) { KS.Traffic.startChase(amb); Faint.amb = amb; Game.notify('🚑 An ambulance is on its way.', 'good'); }
  }
  function wakeInHospital() {
    const PL = KS.Player, bed = KS.wakeBed || KS.hospital;
    PL.x = bed.x; PL.z = bed.z; PL.y = 0.2; PL.h = bed.h || 0;
    PL.health = 60;
    PL.mode = 'dead'; // still lying — on the ward bed now
    if (PL.person && PL.person.root) { PL.person.root.rotation.set(-Math.PI / 2 * 0.92, PL.h, 0); PL.person.root.position.set(PL.x, 0.95, PL.z); }
    Game.pay(-300, 'Bir Hospital bill');
    Game.notify('🏥 You woke up in Bir Hospital.', 'bad');
    setTimeout(() => { // sit up and get out of bed
      if (PL.mode !== 'dead') return;
      PL.mode = 'foot';
      if (PL.person && PL.person.root) PL.person.root.rotation.set(0, PL.h, 0);
      Game.notify('You can walk out when you are ready — the doctors are in the rooms around you.', 'good');
    }, 2600);
  }
  function faintUpdate(dt) {
    if (!Faint.on) return;
    Faint.t += dt;
    const PL = KS.Player;
    if (Faint.stage === 'down') {
      const amb = Faint.amb;
      if (amb && Math.hypot(amb.x - PL.x, amb.z - PL.z) < 9) { KS.Traffic.endChase(amb); Faint.stage = 'loading'; Faint.t = 0; fadeBlack(true); }
      else if (Faint.t > 25) { Faint.stage = 'loading'; Faint.t = 0; fadeBlack(true); } // no ambulance could reach you: the hospital takes over anyway
    } else if (Faint.stage === 'loading') {
      if (Faint.t > 1.4) { wakeInHospital(); Faint.stage = 'waking'; Faint.t = 0; }
    } else if (Faint.stage === 'waking') {
      if (Faint.t > 0.4) { fadeBlack(false); blinkEyes(); Faint.on = false; Faint.stage = ''; }
    }
  }
  Game.onPunch = (ped) => {
    Game.karma(-4, 'Started a fight');
    if (KS.Law.policeNear(ped.x, ped.z, 45)) KS.Law.raise(1, 'Fighting in public');
  };
  /* a crash hurts — in a car as well as on a bike, and a pile-up hurts more
     than one bump. A short cooldown (1 s) keeps a single multi-car shunt
     from draining all your health at once. The vehicle itself is damaged
     too: it gets slower and smokes, and needs a repair at a petrol station. */
  Game.onCrash = (speed) => {
    if (speed > 6) KS.Uthao.event('crash');
    const v = KS.Player.vehicle, PL = KS.Player;
    if (!v) return;
    if (KS.clock - (PL.crashCool || 0) > 1) {
      PL.crashCool = KS.clock;
      const bike = KS.isBike(v.kind);
      const hurt = bike ? Math.min(18, speed * 0.6) : Math.min(10, speed * 0.35);
      if (speed > 10) Game.hurt(Math.round(hurt));
    }
    // the vehicle takes the hit: damage 0-100, slower and smoking as it grows
    if (KS.Fuel && KS.Fuel.needsFuel(v.kind)) {
      v.damage = Math.min(100, (v.damage || 0) + speed * 1.2);
      if (v.damage >= 100) { KS.Game.notify('💥 Your vehicle is wrecked! It will not drive until repaired at a petrol station.', 'bad'); }
      else if (v.damage > 50 && (!v.smokeT || KS.clock - v.smokeT > 30)) { v.smokeT = KS.clock; KS.Game.notify('💨 Your vehicle is smoking — repair it at a petrol station ⛽.', 'bad'); }
    }
  };
  /* repair the player's vehicle at a petrol station (or the garage): cost
     scales with the damage. Returns the cost, or -1 when nothing is broken. */
  Game.repairCost = (v) => {
    if (!v || !(v.damage > 1)) return -1;
    return Math.round(v.damage * 8);
  };
  Game.repair = (v) => {
    if (!v || !(v.damage > 1)) return -1;
    const cost = Game.repairCost(v);
    if (KS.Shop.data.cash < cost) return -2;
    KS.Shop.data.cash -= cost; v.damage = 0; KS.Shop.save();
    return cost;
  };
  Game.onHardBrake = () => KS.Uthao.event('brake');
  Game.splash = (v) => {
    A.splash(); Game.notify(`Splash! The Bagmati swallowed your ${v.type.name.toLowerCase()}.`, 'bad');
    const PL = KS.Player;
    if (PL.person.root.parent !== PL.scene) PL.scene.add(PL.person.root);
    PL.person.root.visible = true; PL.vehicle = null; PL.mode = 'foot';
    PL.x = v.x; PL.z = Math.abs(v.z - KS.RIVER.z0) < Math.abs(v.z - KS.RIVER.z1) ? KS.RIVER.z0 - 8 : KS.RIVER.z1 + 26; PL.y = 0.3; PL.vy = 0; KS.Cam.want = 4;
    if (v.owned) { KS.Traffic.remove(v); if (KS.Shop.delivered === v) KS.Shop.delivered = null; Game.notify('Your vehicle was fished out; call it again from the Garage.'); }
    else KS.Traffic.recycle(v, PL.x + 300, PL.z - 300);
    KS.Uthao.trip && KS.Uthao.cancel(); PL.rebuild();
  };
  Game.onEnter = (v) => {
    if (v.kind === 'helicopter') {
      if (!D.heliSeen) {
        D.heliSeen = true; Game.save();
        KS.modal('🚁 Flying the helicopter', `<p>Your first flight! This helicopter is yours — no licence needed.</p><p><kbd>W</kbd> / <kbd>S</kbd> fly forward and back · <kbd>A</kbd> / <kbd>D</kbd> turn<br>Hold <kbd>Space</kbd> to climb · hold <kbd>C</kbd> to come down<br><kbd>E</kbd> to get out — land first (hold <kbd>C</kbd> until you touch down).</p><p>It climbs to 200 m, high over Dharahara and the whole valley. Enjoy the view!</p>`, [['Got it — let me fly!', () => KS.modalClose()]]);
      } else Game.notify(`<b>Helicopter</b> <span><kbd>W</kbd>/<kbd>S</kbd> fly · <kbd>A</kbd>/<kbd>D</kbd> turn · hold <kbd>Space</kbd> to climb · hold <kbd>C</kbd> to come down · <kbd>E</kbd> get out (land first)</span>`);
    }
    else Game.notify(`<b>${v.type.name}</b> <span>${coarse ? '' : 'E get out · H horn · R radio · U Uthao app'}</span>`);
    $('speedo').hidden = false; $('vname').textContent = v.type.name;
    if (KS.isBike(v.kind)) KS.Player.rebuild();
    if (v.kind === 'bicycle') KS.Guide.flag('bike', true);
    if (v.ownedId) { D.lastRide = v.ownedId; Game.save(); }
    $('limit').hidden = true;
    KS.Radio.setInVehicle(true); KS.Uthao.render();
  };
  Game.onExit = (v) => {
    $('speedo').hidden = true; KS.Radio.setInVehicle(false);
    // remember how much fuel is left in this vehicle for next time
    if (v.ownedId && v.fuel != null) { const g = KS.Shop.data.garage.find((x) => x.id === v.ownedId); if (g) { g.fuel = Math.round(v.fuel); KS.Shop.save(); } }
    if (KS.isBike(v.kind)) KS.Player.rebuild();
    if (KS.Uthao.trip && KS.Uthao.trip.stage === 'drop' && !KS.Uthao.trip.parcel) { KS.Uthao.cancel(); }
    KS.Uthao.render();
  };
  let wheelT = -10;
  /** eat a fruit from your bag */
  Game.eatFromBag = () => {
    const PL = KS.Player, b = D.bag || {};
    if (!b.fruit) { Game.notify('Your bag is empty. Buy fruit to pack at any fruit stall (E).'); return; }
    if (PL.health >= 100) { Game.notify('Health is already full.'); return; }
    b.fruit--; PL.health = Math.min(100, PL.health + 20); PL.eatT = 1.6; Game.save(); A.coin();
    KS.say(PL.person.root, 'Mmm… 🍎', 1.4, 'calm'); Game.notify(`🍎 +20 health · ${b.fruit} left in the bag`, 'good');
  };
  Game.interact = () => {
    const PL = KS.Player;
    // at a petrol pump, in a vehicle, stopped: fill up, and repair if broken
    if (PL.vehicle && KS.Fuel && Math.abs(PL.vehicle.speed) < 1) {
      const st = KS.Fuel.nearest(PL.x, PL.z, 16);
      if (st) {
        const v = PL.vehicle, cost = KS.Fuel.refuelCost(v), rcost = KS.Game.repairCost(v);
        const opts = [];
        if (cost > 0) opts.push([`⛽ Fill up the tank · रु ${cost}`, () => { const paid = KS.Fuel.refuel(v); if (paid > 0) { A.coin(); Game.notify(`⛽ Filled up at ${st.name} · −रु ${paid}. Tank full.`, 'good'); } KS.modalClose(); }]);
        else opts.push(['⛽ Tank is already full ✔', () => KS.modalClose()]);
        if (rcost > 0) opts.push([`🔧 Repair the ${v.type.name} (${Math.round(v.damage)}% damaged) · रु ${rcost}`, () => { const paid = KS.Game.repair(v); if (paid > 0) { A.coin(); Game.notify(`🔧 Repaired at ${st.name} · −रु ${paid}. Good as new.`, 'good'); } KS.modalClose(); }]);
        opts.push(['Maybe later', () => KS.modalClose()]);
        KS.modal(`⛽ ${st.name}`, `<p>Your ${v.type.name}: fuel <b>${Math.round(v.fuel != null ? v.fuel : 100)}%</b>${rcost > 0 ? ` · damage <b>${Math.round(v.damage)}%</b>` : ' · no damage'}.</p>`, opts);
        return;
      }
    }
    if (KS.trialGround && Math.hypot(PL.x - KS.trialGround.counter.x, PL.z - KS.trialGround.counter.z) < 3.5) { KS.Law.openCounter(); return; }
    if (KS.Weapons && KS.Weapons.nearest(PL.x, PL.z, 3.5)) { KS.Weapons.openShop(KS.Weapons.nearest(PL.x, PL.z, 3.5)); return; }
    if (KS.agent && Math.hypot(PL.x - KS.agent.x, PL.z - KS.agent.z) < 2.6) { KS.Law.agentTalk(); return; }
    if (KS.Mansion.nearBooth(PL)) {
      KS.modal('🎟️ Sadbhav Thakuri Residence · सद्भाव ठकुरी निवास', `<p>"Namaste! A tour of the residence: the grand hall, the dining room, the lounge and library, the upstairs kitchen, bedroom and balcony, the gardens with the fountain and gazebo, and the swimming pool (you may swim)."</p><p>Ticket: <b>रु ${KS.Mansion.price}</b>.</p>`,
        [[KS.Mansion.ticket ? 'You have a ticket ✔' : `Buy a ticket · रु ${KS.Mansion.price}`, () => { KS.modalClose(); KS.Mansion.buy(); }], ['Maybe later', () => KS.modalClose()]]);
      return;
    }
    const lift = (KS.lifts || []).find((l) => Math.hypot(l.x - PL.x, l.z - PL.z) < 3.2 && Math.abs(l.y - PL.y) < 2.5);
    const M = KS.Mountains;
    if (M && M.skiHire && Math.hypot(PL.x - M.skiHire.x, PL.z - M.skiHire.z) < 4) { PL.hireBoard(); return; }
    if (M && M.teaHouse && Math.hypot(PL.x - M.teaHouse.x, PL.z - M.teaHouse.z) < 4) {
      if (D.cash < M.chiyaPrice) { KS.Game.notify(`Hot chiya costs रु ${M.chiyaPrice}.`, 'bad'); return; }
      D.cash -= M.chiyaPrice; PL.health = Math.min(100, PL.health + 20); KS.Game.save && KS.Game.save();
      KS.Game.notify('☕ Hot chiya! Warm and sweet — +20 health.', 'good'); return;
    }
    if (M && M.paraOffice && Math.hypot(PL.x - M.paraOffice.x, PL.z - M.paraOffice.z) < 4) { PL.buyParaTicket(); return; }
    if (M && M.paraTakeoff && PL.paraTicket && Math.hypot(PL.x - M.paraTakeoff.x, PL.z - M.paraTakeoff.z) < 6) { PL.launchParaglider(); return; }
    if (KS.Flight && Math.hypot(PL.x - KS.Flight.counter.x, PL.z - KS.Flight.counter.z) < 4) { KS.Flight.buyTicket(); return; }
    if (KS.Flight && KS.Flight.nearPlane(PL) && KS.Flight.ticket) { KS.Flight.board(); return; }
    if (lift) { flash('photo'); A.ding(); PL.x = lift.to.x; PL.z = lift.to.z; PL.y = lift.to.y; PL.vy = 0; if (lift.to.y > 10) { KS.Guide.flag('lift', true); Game.notify('🗼 Welcome to the Dharahara viewing deck. Look north for the Himalaya.'); KS.Cam.yaw = Math.PI; } return; }
    if (KS.pond && !PL.boat && Math.hypot(PL.x - KS.pond.jetty.x, PL.z - KS.pond.jetty.z) < 2.8) {
      const bt = KS.pondBoats.find((q) => !q.used); if (!bt) { Game.notify('All the boats are out. Wait a moment.'); return; }
      if (D.cash < 100) { Game.notify('Boat hire is रु 100.', 'bad'); return; }
      Game.pay(-100, 'Rowing boat at Rani Pokhari'); PL.boardBoat(bt); Game.notify('🚣 W / S to row, A / D to turn. Come back to the jetty and press E to get off.'); KS.Guide.flag('boat', true); return;
    }
    let stall = null; for (const [x, z] of KS.fruitStalls) if (Math.hypot(x - PL.x, z - PL.z) < 2.6) { stall = [x, z]; break; }
    if (stall) {
      const F = [['🍌 Banana', 'केरा', 20, 12], ['🍊 Orange', 'सुन्तला', 30, 15], ['🍎 Apple', 'स्याउ', 40, 18], ['🥭 Mango', 'आँप', 60, 26], ['🍉 Watermelon slice', 'खरबुजा', 50, 22]];
      KS.modal('🍎 Fruit stall', `<p>"Taja phalphul, dai! Fresh fruit!" Your health: <b>${Math.round(PL.health)}%</b>.</p>`, F.map(([n, np, price, hp]) => [`${n} (${np}) · रु ${price} · +${hp} health`, () => {
        if (D.cash < price) { Game.notify('Not enough cash.', 'bad'); return; }
        D.cash -= price; PL.health = Math.min(100, PL.health + hp); KS.Guide.flag('fruit', true); Game.save(); A.coin(); KS.modalClose();
        PL.eatT = 1.6; KS.say(PL.person.root, 'Mmm… ' + n.split(' ').slice(1).join(' ') + '!', 1.8, 'calm'); Game.notify(`${n} · −रु ${price} · health ${Math.round(PL.health)}%`, 'good');
      }]).concat([['🎒 Pack 3 fruits in your bag for later · रु 90', () => {
        if (D.cash < 90) { Game.notify('Not enough cash.', 'bad'); return; }
        D.cash -= 90; D.bag = D.bag || {}; D.bag.fruit = (D.bag.fruit || 0) + 3; Game.save(); A.coin(); KS.modalClose();
        Game.notify(`🎒 ${D.bag.fruit} fruit in your bag. Press <b>Z</b> (or Eat) any time for +20 health.`, 'good');
      }], ['Maybe later', () => KS.modalClose()]]));
      return;
    }
    for (let wi = 0; wi < KS.prayerWheels.length; wi++) {
      const [x, z] = KS.prayerWheels[wi];
      if (Math.hypot(x - PL.x, z - PL.z) < 2.4) {
        if (KS.clock - wheelT > 2) {
          wheelT = KS.clock; A.prayer(); KS.say(PL.person.root, 'Om mani padme hum 🙏', 2.2, 'calm'); Game.karma(+1, 'Spun a prayer wheel');
          if (KS.prayerWheelDrums && KS.prayerWheelDrums.boost) KS.prayerWheelDrums.boost[wi] = 4; // this wheel spins fast for a while
        }
        return;
      }
    }
    for (const [x, z] of KS.bells) if (Math.hypot(x - PL.x, z - PL.z) < 9) { A.bell(0.8); KS.say(PL.person.root, '🔔 Dong…', 1.5, 'calm'); return; }
    let best = null, bd = 5;
    KS.Peds.forEachNear(PL.x, PL.z, 5, (p) => { const d = Math.hypot(p.x - PL.x, p.z - PL.z); if (d < bd && !p.down) { bd = d; best = p; } });
    if (best) { KS.say(PL.person.root, 'Namaste! 🙏', 1.6, 'calm'); setTimeout(() => KS.say(best.p.root, KS.pick(KS.LINES[best.kind] || KS.LINES.greet), 2.4), 600); }
  };
  let promptOverride = '', promptT = 0;
  Game.prompt = (txt) => { promptOverride = txt; promptT = 0.4; };

  /* ======================= targets & GPS ======================= */
  let target, momoShop, waypoint, bikeMark;
  const MOMO = { x: -128, z: -260 };
  Game.stopFor = (l) => {
    if (l.stop) return l.stop;
    if (l.id === 'swayambhu') return { x: KS.SWAYAMBHU.x + 30, z: KS.SWAYAMBHU.z + 6 };
    if (l.id === 'airport') return { x: 606, z: 9 };
    if (l.id === 'bagmati') return { x: l.x, z: KS.RIVER.z0 - 16 };
    const c = Math.floor((l.x - G.O) / G.B), r = Math.floor((l.z - G.O) / G.B);
    const cands = [[G.line(c) + 10, l.z], [G.line(c + 1) - 10, l.z], [l.x, G.line(r) + 10], [l.x, G.line(r + 1) - 10]];
    let best = cands[0], bd = 1e9; for (const p of cands) { const d = Math.hypot(p[0] - l.x, p[1] - l.z); if (d < bd) { bd = d; best = p; } }
    return { x: best[0], z: best[1] };
  };
  Game.setWaypoint = (x, z) => { waypoint.position.set(x, KS.groundAt(x, z, 100, 200) + 0.05, z); waypoint.visible = true; Game.routeT = 0; };
  Game.acceptMomo = () => { Game.momoPending = true; momoShop.visible = true; Game.setTarget(MOMO.x, MOMO.z, 'Momo House'); Game.notify('🥟 Head to <b>Momo House</b> in Thamel (yellow marker) to collect the order.'); };
  Game.setTarget = (x, z, label) => { target.position.set(x, KS.groundAt(x, z, 100, 200) + 0.02, z); target.visible = true; Game.targetLabel = label; Game.routeT = 0; };
  Game.clearTarget = () => { target.visible = false; Game.route = null; };
  function makeMarker(color) {
    const g = new T.Group();
    const beam = new T.Mesh(new T.CylinderGeometry(0.9, 0.9, 70, 16, 1, true), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.28, depthWrite: false, blending: T.AdditiveBlending, fog: false })); beam.position.y = 35; g.add(beam);
    const ring = new T.Mesh(new T.RingGeometry(2.2, 2.9, 32).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color, transparent: true, opacity: 0.85, side: T.DoubleSide, depthWrite: false })); ring.position.y = 0.32; g.add(ring);
    const arrow = new T.Mesh(new T.ConeGeometry(0.7, 1.4, 4).rotateX(Math.PI), new T.MeshBasicMaterial({ color })); arrow.position.y = 4; g.add(arrow);
    g.userData = { arrow }; g.visible = false; return g;
  }
  function randomLot(px, pz, a, b) { const L = KS.World.lots; for (let i = 0; i < 200; i++) { const l = KS.pick(L), d = Math.hypot(l.x - px, l.z - pz); if (d > a && d < b) return l; } return KS.pick(L); }
  function startMomo() {
    const d = randomLot(MOMO.x, MOMO.z, 200, 460), dist = Math.hypot(d.x - MOMO.x, d.z - MOMO.z), area = KS.districtAt(d.x, d.z).name;
    Game.mission = { type: 'momo', title: 'Hot Momo Delivery', x: d.x, z: d.z, t: Math.round(dist / 6.2 + 30), area };
    Game.setTarget(d.x, d.z, 'Delivery'); momoShop.visible = false;
    Game.notify('🥟 Ten plates of steaming momos. Deliver them to <b>' + area + '</b> before they go cold!'); A.coin();
  }
  function missionUpdate(dt) {
    const PL = KS.Player, m = Game.mission;
    if (!m) { if (Game.momoPending && (PL.mode === 'foot' || (PL.vehicle && KS.isBike(PL.vehicle.kind))) && !KS.Uthao.trip && Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 4) { Game.momoPending = false; startMomo(); } return; }
    m.t -= dt;
    const d = Math.hypot(PL.x - m.x, PL.z - m.z), slow = !PL.vehicle || Math.abs(PL.vehicle.speed) < 2.5;
    const end = () => { Game.mission = null; Game.clearTarget(); momoShop.visible = false; KS.Guide.flag('momo', true); };
    if (d < 4.5 && slow) { const tip = Math.max(0, Math.round(m.t)) * 8; end(); Game.pay(250 + tip, `Momos delivered hot in ${m.area}`); Game.giveTokens(2 + (tip ? 1 : 0), 'Delivery completed'); KS.say(PL.person.root, 'Momo aayo! 🥟', 2); }
    else if (m.t <= 0) { end(); A.fail(); Game.pay(60, 'The momos went cold, half price'); }
  }

  /* ======================= traffic violations ======================= */
  let lastSig = null, honks = [];
  function violations(dt) {
    if (KS.Battle && KS.Battle.on) return; // no police, cameras or fines in Battle mode
    const PL = KS.Player, v = PL.vehicle, Law = KS.Law;
    for (const c of KS.speedCams) { c.cool = Math.max(0, c.cool - dt); c.flash.material.opacity = Math.max(0, c.flash.material.opacity - dt * 3); }
    for (const s2 of KS.signals) if (s2.camFlash) s2.camFlash.material.opacity = Math.max(0, s2.camFlash.material.opacity - dt * 3);
    const heli = v && v.kind === 'helicopter';
    if (v && KS.noDriveAt && KS.noDriveAt(PL.x, PL.z) && v.kind !== 'bicycle' && !(heli && (v.alt || 0) > 3)) Game.prompt('🚫 Pedestrian area: no vehicles beyond the bollards');
    if (v && !heli && Game.limit !== (Game.limit = KS.speedLimit(PL.x, PL.z)) && Game.limit) Game.notify('🏫 School zone: 25 km/h until 16:00');
    if (!v || Law.trial || v.kind === 'bicycle' || v.kind === 'helicopter') { lastSig = null; return; } // no road rules in the sky, and no speed fines at all
    const kmh = Math.abs(v.speed) * 3.6;
    Game.kmh = kmh;
    // red-light cameras at every signal
    const s = KS.Traffic.signalAt(PL.x, PL.z);
    if (s && s !== lastSig) {
      const ax = Math.abs(Math.sin(v.h)) > Math.abs(Math.cos(v.h)) ? 'ew' : 'ns';
      if (s.state[ax] === 'r' && kmh > 5 && v.kind !== 'ambulance') { if (s.camFlash) s.camFlash.material.opacity = 1; flash('cam'); Law.ticket('redlight'); Game.karma(-2, 'Ran a red light'); }
    }
    lastSig = s;
    // wrong side of the road (Nepal drives on the left)
    if (kmh > 12) {
      const O = G.O, B2 = G.B, sx = Math.sin(v.h), sz = Math.cos(v.h);
      const jx = Math.round((PL.x - O) / B2), jz = Math.round((PL.z - O) / B2), Lx = G.line(jx), Lz = G.line(jz);
      let wrong = false;
      if (jz >= 0 && jz <= G.N && Math.abs(PL.z - Lz) < G.roadHalf(jz) - 0.5 && Math.abs(PL.x - Lx) > 14) wrong = (sx > 0.85 && PL.z > Lz + 0.8) || (sx < -0.85 && PL.z < Lz - 0.8);
      if (jx >= 0 && jx <= G.N && Math.abs(PL.x - Lx) < G.roadHalf(jx) - 0.5 && Math.abs(PL.z - Lz) > 14) wrong = wrong || (sz > 0.85 && PL.x < Lx - 0.8) || (sz < -0.85 && PL.x > Lx + 0.8);
      Game.wrongT = wrong ? (Game.wrongT || 0) + dt : 0;
      if (Game.wrongT > 2.5 && Law.policeNear(PL.x, PL.z, 40)) Law.offense('wrongway');
      if (Game.wrongT > 1) Game.prompt('Keep left! You are on the wrong side of the road');
    }
    // Kathmandu's no-horn rule: honking again and again in front of police
    if (Game.honk > 0.39) { honks.push(KS.clock); honks = honks.filter((t) => KS.clock - t < 6); if (honks.length >= 3 && Law.policeNear(PL.x, PL.z, 35)) { honks = []; Law.offense('horn'); } KS.Uthao.event('honk'); }
  }
  /* turn-by-turn directions from the GPS route */
  function navigation() {
    const box = $('navBox'), r = Game.route, PL = KS.Player;
    const tgt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
    if (!r || r.length < 2 || !tgt) { box.hidden = true; return; }
    const total = Math.round(Math.hypot(tgt.x - PL.x, tgt.z - PL.z));
    let msg = '', dist = 0, road = null;
    for (let k = 1; k < r.length - 1; k++) {
      const a = r[k - 1], c = r[k], d = r[k + 1];
      dist += Math.hypot(c[0] - a[0], c[1] - a[1]);
      const ax = c[0] - a[0], az = c[1] - a[1], bx = d[0] - c[0], bz = d[1] - c[1], la = Math.hypot(ax, az), lb = Math.hypot(bx, bz);
      if (la < 1 || lb < 1) continue;
      const cross = (ax * bz - az * bx) / (la * lb), dot = (ax * bx + az * bz) / (la * lb);
      if (dot < 0.7) { msg = dot < -0.7 ? '↩ Make a U-turn' : cross > 0 ? '↱ Turn right' : '↰ Turn left'; road = KS.roadNameAt(c[0] + bx / lb * 20, c[1] + bz / lb * 20); break; }
    }
    if (!msg) { msg = '↑ Continue to your destination'; dist = total; }
    box.hidden = false;
    const html = `<b>${msg.replace('Turn ', '').replace('Continue to your destination', 'Straight on')}</b>${msg.startsWith('↑') ? '' : `<span>${Math.max(10, Math.round(dist / 10) * 10)} m</span>`}${road ? `<span>${road[1].replace(/ · .*/, '')}</span>` : ''}<small>${Game.targetLabel && target.visible ? Game.targetLabel + ' · ' : ''}${total} m</small>`;
    if (box._h !== html) { box._h = html; box.innerHTML = html; } // a slim strip at the top, out of the way of the road
  }
  function flash(kind) { const f = $('flash'); f.className = 'flash ' + kind; void f.offsetWidth; f.classList.add('go'); }

  /* ======================= recording & photos ======================= */
  const Rec = (Game.Rec = { on: false, rec: null, chunks: [], t0: 0 });
  Rec.toggle = () => {
    if (Rec.on) { Rec.rec.stop(); return; }
    const canvas = $('scene');
    if (!canvas.captureStream || !window.MediaRecorder) { Game.notify('Recording is not supported in this browser.', 'bad'); return; }
    const stream = canvas.captureStream(30);
    if (A.streamDest) A.streamDest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
    const types = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
    const mime = types.find((t) => MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(t)) || '';
    try { Rec.rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 6e6 } : undefined); } catch (e) { Game.notify('Could not start recording: ' + e.message, 'bad'); return; }
    Rec.chunks = []; Rec.rec.ondataavailable = (e) => e.data.size && Rec.chunks.push(e.data);
    Rec.rec.onstop = () => {
      Rec.on = false; $('recDot').hidden = true; $('btnRec').classList.remove('on');
      const blob = new Blob(Rec.chunks, { type: Rec.rec.mimeType || 'video/webm' }), url = URL.createObjectURL(blob);
      showMedia(url, 'video', `kathmandu-streets-${Date.now()}.${(Rec.rec.mimeType || '').includes('mp4') ? 'mp4' : 'webm'}`);
    };
    Rec.rec.start(1000); Rec.on = true; Rec.t0 = KS.clock; $('recDot').hidden = false; $('btnRec').classList.add('on');
    Game.notify('⏺ Recording. Press K or the REC button again to stop.');
  };
  Rec.photo = () => { Rec.wantPhoto = true; };
  function takePhoto() {
    Rec.wantPhoto = false; A.shutter(); flash('photo');
    $('scene').toBlob((b) => { if (b) showMedia(URL.createObjectURL(b), 'img', `kathmandu-streets-${Date.now()}.png`); }, 'image/png');
  }
  function showMedia(url, kind, name) {
    const box = $('mediaBox'); box.hidden = false;
    $('mediaView').innerHTML = kind === 'video' ? `<video src="${url}" controls playsinline></video>` : `<img src="${url}" alt="Screenshot from Kathmandu Streets">`;
    const a = $('mediaSave'); a.href = url; a.download = name;
    $('mediaTitle').textContent = kind === 'video' ? 'Your recording' : 'Your photo';
  }

  /* ======================= minimap & map ======================= */
  const B = KS.BOUNDS, MAP = { px: 0.5, W: (B.x1 - B.x0) * 0.5, H: (B.z1 - B.z0) * 0.5 };
  const mx = (x) => (x - B.x0) * MAP.px, mz = (z) => (z - B.z0) * MAP.px;
  function buildMapCanvas() {
    const c = document.createElement('canvas'); c.width = MAP.W; c.height = MAP.H; const g = c.getContext('2d');
    const gr = g.createRadialGradient(mx(0), mz(0), 200, mx(0), mz(0), MAP.W * 0.6);
    gr.addColorStop(0, '#c9cfa0'); gr.addColorStop(0.5, '#9fb27a'); gr.addColorStop(1, '#5f7a4a'); g.fillStyle = gr; g.fillRect(0, 0, MAP.W, MAP.H);
    g.fillStyle = '#a9b97a'; g.beginPath(); g.ellipse(mx(KS.HW.village.x), mz(KS.HW.village.z), 300 * MAP.px, 330 * MAP.px, 0, 0, 7); g.fill();
    g.fillStyle = '#7f9a5a'; g.beginPath(); g.arc(mx(KS.SWAYAMBHU.x), mz(KS.SWAYAMBHU.z), 150 * MAP.px, 0, 7); g.fill();
    g.fillStyle = '#e3dccd'; g.fillRect(mx(-560), mz(-560), 1120 * MAP.px, 1120 * MAP.px);
    const col = { trial: '#c9b48a', city: '#cfc5b3', thamel: '#e2b796', old: '#d6a88c', ason: '#d6a88c', newroad: '#cbbdab', park: '#9cc77a', balaju: '#9cc77a', shankha: '#9cc77a', garden: '#9cc77a', tundikhel: '#a9d17f', tundikhel2: '#a9d17f', palace: '#e9c9b4', singha: '#b9d79a', stadium: '#b3d58a', durbar: '#d98f6f', durbar2: '#d98f6f', boudha: '#efe6d6', pashupati: '#e6c66a', ranipokhari: '#9cc77a', dharahara: '#ddd5c6', hospital: '#f0d6d6' };
    for (let c2 = 0; c2 < G.N; c2++) for (let r = 0; r < G.N; r++) {
      const t = KS.blockType(c2, r); if (t === 'river') continue; const R = KS.World.blockRect(c2, r);
      g.fillStyle = col[t] || '#cfc5b3'; g.fillRect(mx(R.x0), mz(R.z0), (R.x1 - R.x0) * MAP.px, (R.z1 - R.z0) * MAP.px);
    }
    g.fillStyle = '#6fa3c4'; g.fillRect(0, mz(KS.RIVER.z0), MAP.W, (KS.RIVER.z1 - KS.RIVER.z0) * MAP.px);
    g.fillStyle = '#5a8fb3'; g.fillRect(mx(22), mz(-156), 46 * MAP.px, 46 * MAP.px);
    g.fillStyle = '#8e8e94'; g.fillRect(mx(719), mz(-380), 32 * MAP.px, 760 * MAP.px); g.fillRect(mx(610), mz(-90), 60 * MAP.px, 220 * MAP.px);
    for (let i = 0; i <= G.N; i++) { // every grid line is an ordinary street now; the Ring Road is the loop below
      const w = G.roadHalf(i) * 2 * MAP.px;
      g.fillStyle = '#fbfaf4';
      g.fillRect(mx(G.line(i)) - w / 2, mz(-551), w, 1102 * MAP.px); g.fillRect(mx(-551), mz(G.line(i)) - w / 2, 1102 * MAP.px, w);
    }
    // the Ring Road loop, gold like the real Chakrapath on a map, with its connectors
    g.strokeStyle = '#f3d27a'; g.lineWidth = G.RING * MAP.px; g.lineJoin = 'round'; g.lineCap = 'round';
    g.beginPath(); KS.ringLoopPts.forEach((p, i) => (i ? g.lineTo(mx(p.x), mz(p.z)) : g.moveTo(mx(p.x), mz(p.z)))); g.closePath(); g.stroke();
    g.lineWidth = G.ROAD * MAP.px;
    for (const c of KS.ringConnectors) { g.beginPath(); g.moveTo(mx(c.x1), mz(c.z1)); g.lineTo(mx(c.x2), mz(c.z2)); g.stroke(); }
    g.fillStyle = '#fbfaf4'; g.fillRect(mx(KS.SWAYAMBHU.x + 20), mz(-96), (-540 - KS.SWAYAMBHU.x - 20) * MAP.px, 12 * MAP.px); g.fillRect(mx(540), mz(-7), 80 * MAP.px, 14 * MAP.px);
    // Nagdhunga highway and tunnel
    g.fillStyle = '#f3d27a'; g.fillRect(mx(KS.HW.x1), mz(KS.HW.z - 7), (KS.HW.x0 - KS.HW.x1) * MAP.px, 14 * MAP.px);
    g.fillStyle = '#5a5a5a'; g.fillRect(mx(KS.HW.pW), mz(KS.HW.z - 9), (KS.HW.pE - KS.HW.pW) * MAP.px, 18 * MAP.px);
    g.setLineDash([6, 5]); g.strokeStyle = '#f3d27a'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx(KS.HW.pW), mz(KS.HW.z)); g.lineTo(mx(KS.HW.pE), mz(KS.HW.z)); g.stroke(); g.setLineDash([]);
    g.fillStyle = '#d98f6f'; g.fillRect(mx(-176), mz(4), 82 * MAP.px, 172 * MAP.px);
    g.fillStyle = '#e6c66a'; g.fillRect(mx(368), mz(368), 74 * MAP.px, 90 * MAP.px);
    if (KS.TPATHS) { // the road and steps up to Chhahare Jharna, and the stream
      for (const P of KS.TPATHS) { g.strokeStyle = P.id === 'stream' ? '#6fa3c4' : P.id === 'road' ? '#f3d27a' : '#b8a888'; g.lineWidth = P.id === 'road' ? 7 * MAP.px * 2 : 3; g.setLineDash(P.id === 'steps' ? [3, 3] : []); g.beginPath(); P.pts.forEach(([x, z], i) => (i ? g.lineTo(mx(x), mz(z)) : g.moveTo(mx(x), mz(z)))); g.stroke(); }
      g.setLineDash([]); const J = KS.JHARNA; g.fillStyle = '#4f7a3a'; g.beginPath(); g.arc(mx(J.x), mz(J.z), 34 * MAP.px, 0, 7); g.fill(); g.fillStyle = '#6fa3c4'; g.beginPath(); g.arc(mx(J.pool.x), mz(J.pool.z), J.pool.r * MAP.px, 0, 7); g.fill();
    }
    if (KS.policeStation) { g.fillStyle = '#1d3a8a'; g.fillRect(mx(KS.policeStation.x) - 4, mz(KS.policeStation.z) - 4, 8, 8); }
    for (const s of KS.signals) { g.fillStyle = '#c8102e'; g.beginPath(); g.arc(mx(s.x), mz(s.z), 2.5, 0, 7); g.fill(); }
    for (const c3 of KS.speedCams) { g.fillStyle = '#1d4fb8'; g.fillRect(mx(c3.x) - 2.5, mz(c3.z) - 2.5, 5, 5); }
    return c;
  }
  let mapC, mini, miniG, big, bigG;
  const BZ = { z: 1, cx: null, cz: null }; // big map zoom and centre (map pixels)
  Game.miniZoom = 1;
  function bigZoom(f, sx, sy) { // zoom about a screen point (canvas pixels)
    const m = big._map; if (!m) return;
    const px = sx == null ? BZ.cx : (sx - m.ox) / m.scale, pz = sy == null ? BZ.cz : (sy - m.oz) / m.scale;
    const z2 = KS.clamp(BZ.z * f, 1, 10), k2 = z2 / BZ.z; BZ.z = z2;
    BZ.cx = px + (BZ.cx - px) / k2; BZ.cz = pz + (BZ.cz - pz) / k2; clampBZ(); drawBig();
  }
  function clampBZ() { BZ.cx = KS.clamp(BZ.cx, 0, MAP.W); BZ.cz = KS.clamp(BZ.cz, 0, MAP.H); if (BZ.z <= 1.01) { BZ.cx = MAP.W / 2; BZ.cz = MAP.H / 2; } }
  Game.openMap = () => { if (document.exitPointerLock && KS.Input.locked) document.exitPointerLock(); $('bigwrap').hidden = false; if (!BZ.used) { BZ.used = true; BZ.z = 2.5; BZ.cx = mx(KS.Player.x); BZ.cz = mz(KS.Player.z); } drawBig(); };
  Game.mapCenterOnMe = (z) => { BZ.z = z || Math.max(BZ.z, 3); BZ.cx = mx(KS.Player.x); BZ.cz = mz(KS.Player.z); drawBig(); };
  /** a traffic police officer on the map: blue shield with a white star */
  function policeDot(g, x, y, k, alert) {
    g.save(); g.translate(x, y); g.scale(k, k);
    g.fillStyle = alert && Math.sin(KS.clock * 12) > 0 ? '#c8102e' : '#1d3a8a'; g.strokeStyle = '#fff'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -6); g.lineTo(5, -4); g.lineTo(4, 3); g.lineTo(0, 6); g.lineTo(-4, 3); g.lineTo(-5, -4); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(0, -0.3, 1.6, 0, 7); g.fill(); g.restore();
  }
  function drawRoute(g, sx, sz, scale, w) {
    const r = Game.route; if (!r || r.length < 2) return;
    g.strokeStyle = 'rgba(29,110,255,0.92)'; g.lineWidth = w; g.lineJoin = 'round'; g.lineCap = 'round'; g.beginPath();
    r.forEach(([x, z], i) => { const X = sx(x), Z = sz(z); if (i) g.lineTo(X, Z); else g.moveTo(X, Z); }); g.stroke();
  }
  function drawMini() {
    const PL = KS.Player, S = mini.width, R = S / 2, zoom = (PL.vehicle ? 0.8 : 1.25) * Game.miniZoom;
    const g = miniG; g.clearRect(0, 0, S, S);
    g.save(); g.beginPath(); g.arc(R, R, R - 2, 0, 7); g.clip();
    g.fillStyle = '#5f7a4a'; g.fillRect(0, 0, S, S);
    const yaw = KS.Cam.yaw, th = -Math.PI / 2 - Math.atan2(Math.cos(yaw), Math.sin(yaw));
    g.translate(R, R); g.rotate(th); g.scale(zoom, zoom);
    g.drawImage(mapC, -mx(PL.x), -mz(PL.z));
    const lx = (x) => (x - PL.x) * MAP.px, lz = (z) => (z - PL.z) * MAP.px;
    drawRoute(g, lx, lz, 1, 4 / zoom);
    const dot = (x, z, r, c, stroke) => { g.beginPath(); g.arc(lx(x), lz(z), r / zoom, 0, 7); g.fillStyle = c; g.fill(); if (stroke) { g.lineWidth = 2 / zoom; g.strokeStyle = stroke; g.stroke(); } };
    for (const l of KS.landmarks) dot(l.x, l.z, 4, Game.found.has(l.id) ? '#c8102e' : '#ffffff', '#7a1414');
    for (const v of KS.Traffic.list) if ((v.kind === 'police' || v.kind === 'policebike' || v.kind === 'ambulance') && !v.dormant && v.root.visible !== false && Math.hypot(v.x - PL.x, v.z - PL.z) < 300) dot(v.x, v.z, v.chase ? 4 : 3, v.kind === 'ambulance' ? '#ffffff' : '#1d4fb8', v.chase && Math.sin(KS.clock * 12) > 0 ? '#ffffff' : '#c8102e');
    if (!KS.Battle.on) for (const o of KS.Peds.police || []) if (Math.hypot(o.x - PL.x, o.z - PL.z) < 300) policeDot(g, lx(o.x), lz(o.z), 1 / zoom, o.chasing);
    if (KS.Shop.delivered && KS.Shop.delivered !== PL.vehicle) dot(KS.Shop.delivered.x, KS.Shop.delivered.z, 4, '#0f8a7a', '#fff');
    if (momoShop.visible) dot(MOMO.x, MOMO.z, 5, '#f2a516', '#5a3a00');
    if (target.visible) dot(target.position.x, target.position.z, 5.5, '#ffd21f', '#111');
    if (waypoint.visible) dot(waypoint.position.x, waypoint.position.z, 5, '#e23a8a', '#fff');
    const zi = KS.Battle.mapInfo(); if (zi) { g.beginPath(); g.arc(lx(zi.x), lz(zi.z), zi.r * MAP.px, 0, 7); g.lineWidth = 3 / zoom; g.strokeStyle = '#3fa0ff'; g.stroke(); }
    const friends = KS.Net ? KS.Net.visible() : [];
    for (const f of friends) dot(f.x, f.z, 5.5, f.heat > 0 && Math.sin(KS.clock * 12) > 0 ? '#c8102e' : f.color, f.heat > 0 ? '#1d4fb8' : '#fff');
    g.restore();
    for (const f of friends) { // friends outside the minimap: coloured arrow on the rim
      const dx = (f.x - PL.x) * MAP.px * zoom, dz = (f.z - PL.z) * MAP.px * zoom, rx = dx * Math.cos(th) - dz * Math.sin(th), rz = dx * Math.sin(th) + dz * Math.cos(th);
      if (Math.hypot(rx, rz) < R - 8) continue;
      const a2 = Math.atan2(rz, rx); g.save(); g.translate(R + Math.cos(a2) * (R - 10), R + Math.sin(a2) * (R - 10)); g.rotate(a2); g.fillStyle = f.color; g.strokeStyle = '#111'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    }
    const tgt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
    if (tgt) {
      const dx = (tgt.x - PL.x) * MAP.px * zoom, dz = (tgt.z - PL.z) * MAP.px * zoom;
      const rx = dx * Math.cos(th) - dz * Math.sin(th), rz = dx * Math.sin(th) + dz * Math.cos(th), d = Math.hypot(rx, rz);
      if (d > R - 8) { const a = Math.atan2(rz, rx); g.save(); g.translate(R + Math.cos(a) * (R - 10), R + Math.sin(a) * (R - 10)); g.rotate(a); g.fillStyle = target.visible ? '#ffd21f' : '#e23a8a'; g.beginPath(); g.moveTo(8, 0); g.lineTo(-6, -6); g.lineTo(-6, 6); g.fill(); g.restore(); }
    }
    const ph = PL.vehicle ? PL.vehicle.h : PL.h, ax = Math.sin(ph), az = Math.cos(ph);
    const pa = Math.atan2(ax * Math.sin(th) + az * Math.cos(th), ax * Math.cos(th) - az * Math.sin(th));
    g.save(); g.translate(R, R); g.rotate(pa); g.fillStyle = '#fff'; g.strokeStyle = '#c8102e'; g.lineWidth = 2.5;
    g.beginPath(); g.moveTo(9, 0); g.lineTo(-6, -6); g.lineTo(-3, 0); g.lineTo(-6, 6); g.closePath(); g.fill(); g.stroke(); g.restore();
    const na = th - Math.PI / 2; g.font = '700 12px "Barlow Condensed", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.beginPath(); g.arc(R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11), 8, 0, 7); g.fillStyle = '#7a1414'; g.fill(); g.fillStyle = '#fff'; g.fillText('N', R + Math.cos(na) * (R - 11), R + Math.sin(na) * (R - 11) + 1);
  }
  Game.drawBig = () => drawBig();
  function drawBig() {
    const k = devicePixelRatio || 1, W = (big.width = big.clientWidth * k), H = (big.height = big.clientHeight * k), g = bigG;
    const fit = Math.min(W / MAP.W, H / MAP.H) * 0.98, scale = fit * BZ.z;
    if (BZ.cx == null) { BZ.cx = MAP.W / 2; BZ.cz = MAP.H / 2; }
    const ox = W / 2 - BZ.cx * scale, oz = H / 2 - BZ.cz * scale;
    g.imageSmoothingEnabled = BZ.z < 3;
    const wx = (x) => ox + mx(x) * scale, wz = (z) => oz + mz(z) * scale;
    big._map = { scale, ox, oz };
    g.fillStyle = '#2c3a28'; g.fillRect(0, 0, W, H); g.drawImage(mapC, ox, oz, MAP.W * scale, MAP.H * scale);
    drawRoute(g, wx, wz, scale, 4 * k);
    g.font = `600 ${Math.round(12 * k)}px "Barlow Condensed", sans-serif`; g.textAlign = 'center';
    for (const l of KS.landmarks) {
      g.beginPath(); g.arc(wx(l.x), wz(l.z), 5 * k, 0, 7); g.fillStyle = Game.found.has(l.id) ? '#c8102e' : '#fff'; g.fill(); g.strokeStyle = '#7a1414'; g.lineWidth = 2; g.stroke();
      if (l.minor) continue;
      g.fillStyle = 'rgba(20,14,10,0.75)'; const tw = g.measureText(l.name).width + 10; g.fillRect(wx(l.x) - tw / 2, wz(l.z) - 27 * k, tw, 17 * k);
      g.fillStyle = '#fff'; g.fillText(l.name, wx(l.x), wz(l.z) - 15 * k);
    }
    if (!KS.Battle.on) for (const o of KS.Peds.police || []) policeDot(g, wx(o.x), wz(o.z), 1.3 * k, o.chasing);
    for (const v of KS.Traffic.list) if ((v.kind === 'police' || v.kind === 'policebike') && !v.dormant && !KS.Battle.on) { g.beginPath(); g.arc(wx(v.x), wz(v.z), (v.chase ? 6 : 4) * k, 0, 7); g.fillStyle = '#1d4fb8'; g.fill(); g.strokeStyle = '#c8102e'; g.lineWidth = 2; g.stroke(); }
    if (BZ.z >= 3 && KS.roadNameAt) { // street names when zoomed in
      g.font = `600 ${Math.round(11 * k)}px "Barlow Condensed", sans-serif`; g.fillStyle = 'rgba(40,30,20,0.85)';
      const every = BZ.z >= 6 ? 2 : 3;
      for (let i = 1; i < G.N; i++) for (let j = i % every; j < G.N; j += every) {
        const x = G.line(i), z = G.line(j) + 45, n = KS.roadNameAt(x, z); if (!n) continue; const t = n[1].replace(/ · .*/, '');
        const X = wx(x), Z = wz(z); if (X < 0 || X > W || Z < 0 || Z > H) continue;
        g.save(); g.translate(X, Z); g.rotate(Math.PI / 2); g.fillText(t, 0, -4 * k); g.restore();
      }
      for (let j = 1; j < G.N; j++) for (let i = (j + 1) % every; i < G.N; i += every) {
        const x = G.line(i) + 45, z = G.line(j), n = KS.roadNameAt(x, z); if (!n) continue; const t = n[1].replace(/ · .*/, '');
        const X = wx(x), Z = wz(z); if (X < 0 || X > W || Z < 0 || Z > H) continue;
        g.fillText(t, X, Z - 4 * k);
      }
    }
    const zi = KS.Battle.mapInfo(); if (zi) { g.beginPath(); g.arc(wx(zi.x), wz(zi.z), zi.r * MAP.px * scale, 0, 7); g.lineWidth = 3 * k; g.strokeStyle = '#3fa0ff'; g.stroke(); g.fillStyle = 'rgba(63,160,255,0.08)'; g.fill(); }
    if (KS.Drop.phase === 'plane' && KS.Drop.path) { const P = KS.Drop.path; g.setLineDash([8 * k, 6 * k]); g.strokeStyle = '#fff'; g.lineWidth = 2 * k; g.beginPath(); g.moveTo(wx(P[0]), wz(P[1])); g.lineTo(wx(P[2]), wz(P[3])); g.stroke(); g.setLineDash([]); }
    // legend
    g.font = `600 ${Math.round(12 * k)}px "Barlow Condensed", sans-serif`; g.textAlign = 'left';
    const lg = [['#ffd21f', 'You'], ['#1d3a8a', 'Traffic police'], ['#1d4fb8', 'Police car / bike'], ['#c8102e', 'Signal / red-light camera'], ['#1d4fb8', '▪ Speed camera'], ['#e23a8a', 'Your waypoint']].concat(KS.Net && KS.Net.visible().length ? [['#ff4fa3', 'Friends (name below)']] : []);
    g.fillStyle = 'rgba(20,14,10,0.72)'; g.fillRect(8 * k, H - (lg.length * 17 + 12) * k, 168 * k, (lg.length * 17 + 6) * k);
    lg.forEach(([c, t], i) => { const y = H - (lg.length * 17 + 2 - i * 17) * k; g.fillStyle = c; g.beginPath(); g.arc(20 * k, y, 5 * k, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillText(t, 32 * k, y + 4 * k); });
    g.textAlign = 'center';
    if (KS.Net) for (const f of KS.Net.visible()) {
      g.beginPath(); g.arc(wx(f.x), wz(f.z), 7 * k, 0, 7); g.fillStyle = f.color; g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 3; g.stroke();
      g.font = `700 ${Math.round(13 * k)}px "Barlow Condensed", sans-serif`; const tw = g.measureText(f.name).width + 10;
      g.fillStyle = 'rgba(20,14,10,0.85)'; g.fillRect(wx(f.x) - tw / 2, wz(f.z) + 10 * k, tw, 17 * k); g.fillStyle = f.color; g.fillText(f.name, wx(f.x), wz(f.z) + 23 * k);
    }
    const PL = KS.Player; g.beginPath(); g.arc(wx(PL.x), wz(PL.z), 7 * k, 0, 7); g.fillStyle = '#ffd21f'; g.fill(); g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
    for (const [m, c] of [[target, '#ffd21f'], [waypoint, '#e23a8a']]) if (m.visible) { g.beginPath(); g.arc(wx(m.position.x), wz(m.position.z), 7 * k, 0, 7); g.fillStyle = c; g.fill(); }
  }

  /* ======================= setup ======================= */
  let renderer, scene, camera;
  const tmpV = new T.Vector3();
  Game.start = async () => {
    try { if (document.fonts && document.fonts.load) await Promise.race([Promise.all([document.fonts.load('700 40px Mukta'), document.fonts.load('800 40px "Barlow Condensed"')]), new Promise((r) => setTimeout(r, 2500))]); } catch (e) { /* fonts optional */ }
    const canvas = $('scene');
    renderer = new T.WebGLRenderer({ canvas, antialias: KS.quality.level === 'high', powerPreference: 'high-performance' });
    renderer.setPixelRatio(KS.quality.pixelRatio); renderer.setSize(innerWidth, innerHeight);
    renderer.shadowMap.enabled = KS.quality.shadows; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene();
    camera = new T.PerspectiveCamera(62, innerWidth / innerHeight, 0.3, 9500);
    KS.scene = scene; KS.camera = camera; KS.renderer = renderer;
    // the loading screen counts up 1 → 100%: "Downloading content NN%", with a
    // bar. The number follows the real loading stages, and the vehicles — the
    // slowest part — move it from 45% to 78% as each model lands.
    let loadShown = 0, loadTarget = 0;
    const setLoad = (pct, msg) => {
      loadTarget = Math.max(loadTarget, pct);
      if (msg) $('loadmsg').textContent = msg;
    };
    const loadTick = setInterval(() => {
      if (loadShown < loadTarget) {
        loadShown = Math.min(loadTarget, loadShown + 1);
        const bar = $('loadbar') && $('loadbar').firstElementChild, pctEl = $('loadpct');
        if (bar) bar.style.width = loadShown + '%';
        if (pctEl) pctEl.textContent = 'Downloading content ' + loadShown + '%';
      }
    }, 30);
    setLoad(5, 'Laying the Ring Road and the lanes of Thamel…');
    if (KS.Props) { try { await KS.Props.load(); } catch (e) { /* code-built props stay */ } }
    KS.reseed(1); KS.World.build(scene);
    setLoad(20, 'Digging the Nagdhunga tunnel, planting rice terraces…');
    KS.reseed(2); KS.Nature.build(scene);
    KS.Weather.init(scene, renderer);
    if (KS.VehicleModels) {
      KS.VehicleModels.onProgress = (done, total) => setLoad(45 + Math.round((33 * done) / Math.max(1, total)));
      setLoad(45, 'Downloading the vehicles…');
      try { await KS.VehicleModels.load(); } catch (e) { /* code-built vehicles stay */ }
      setLoad(78, 'Vehicles ready.');
      if (KS.VehicleModels.ready) KS.VehicleModels.swapBoats();
    }
    if (KS.VehicleModels) { // say plainly whether the realistic models made it in, so a silent fallback is never a mystery
      const want = ['car', 'sedan', 'suv', 'taxi', 'police', 'pickup', 'truck', 'bus', 'micro', 'minibus', 'ambulance', 'ev', 'tempo', 'bicycle', 'helicopter'];
      const n = want.filter((t) => KS.VehicleModels.models[t]).length;
      KS.modelsLoaded = n; KS.modelsWanted = want.length;
      if (n === 0) {
        const why = location.protocol === 'file:' ? 'the game was opened as a downloaded file — open it from the website instead, so the models can download' : 'the model files could not be downloaded — check the connection and reload';
        KS.log && KS.log('No realistic vehicle models loaded: ' + why);
        /* a passing toast is easy to miss, and with no code-built vehicles left
           an empty street would look like a bug: say it once, properly. */
        setTimeout(() => KS.modal && KS.modal('⚠️ Realistic vehicles did not load',
          `<p>The 3D cars, bikes, buses and tempo could not be downloaded (${why}).</p><p>There are no blocky stand-in vehicles any more, so the streets will look empty until the models load. Play from the live site and reload the page.</p><p><a href="https://kapilpandey10.github.io/webcamclicks/kathmandu-streets.html" target="_blank" rel="noopener">Open the live site</a></p>`,
          [['Got it — let me reload', () => location.reload()], ['Keep playing without vehicles', () => KS.modalClose()]]), 1500);
      } else if (n < want.length) setTimeout(() => Game.notify(`🚗 Realistic vehicles: ${n}/${want.length} models loaded.`), 1500);
    }
    setLoad(82, 'Warming up the sky-drop plane…');
    KS.Player.init(scene); KS.Battle.init(scene); KS.Places.initHeli(scene);
    if (KS.Drop && KS.Drop.loadModel) { try { await KS.Drop.loadModel(); } catch (e) { /* Drop.begin warms it up on demand */ } }
    setLoad(88, 'Waking up the city: pilgrims, porters, cows…');
    KS.reseed(3); KS.Animals.init(scene);
    KS.reseed(4); KS.Peds.init(scene, KS.quality.peds, KS.Player.x, KS.Player.z);
    setLoad(95, 'Starting the traffic lights (and the honking)…');
    KS.reseed(5); KS.Traffic.init(scene, KS.quality.cars, KS.Player.x, KS.Player.z);
    const cyc = KS.Traffic.park('bicycle', -131, -263.2, Math.PI / 2, { owned: true }); if (cyc) cyc.ownedId = 'cycle';
    const sc = KS.Traffic.park('scooter', -124, -263.4, Math.PI / 2, { owned: true }); if (sc) { sc.ownedId = 'sathi'; }
    const sg = D.garage.find((g) => g.id === 'sathi'); KS.Shop.delivered = sc; if (sg && sc) { sc.up = sg.up; sc.horn = sg.horn; }
    KS.Law.data();
    if (KS.Damage && KS.Damage.initRocks) KS.Damage.initRocks(scene); // pushable boulders up on the snow mountain
    KS.Traffic.park('taxi', 6.6, -36, Math.PI); KS.Traffic.park('tempo', -88.6, 60, 0); KS.Traffic.park('pickup', -528, 104, 0);
    if (KS.Heli && KS.Heli.pad) KS.Traffic.park('helicopter', KS.Heli.pad.x, KS.Heli.pad.z, Math.PI); // the one helicopter you can fly yourself
    for (const [k, x, z, h] of KS.mansionCars || []) KS.Traffic.park(k, x, z, h, { color: k === 'sedan' ? 0x111111 : 0x1a1a1a });
    // the mansion gate guards are built in places.js now: they patrol the gate, with a weapon in hand
    KS.Input.init(canvas);
    target = makeMarker(0xffd21f); scene.add(target);
    momoShop = makeMarker(0xf2a516); momoShop.position.set(MOMO.x, 0.22, MOMO.z); momoShop.visible = false; scene.add(momoShop);
    bikeMark = makeMarker(0x2fd060); scene.add(bikeMark);
    waypoint = makeMarker(0xe23a8a); scene.add(waypoint);
    mapC = buildMapCanvas(); mini = $('minimap'); miniG = mini.getContext('2d'); big = $('bigmap'); bigG = big.getContext('2d');
    mini.style.pointerEvents = 'auto'; mini.style.cursor = 'pointer';
    mini.addEventListener('click', () => Game.openMap());
    const dests = $('bigDest');
    for (const l of KS.landmarks.filter((x) => !x.minor || x.id === 'trial' || x.id.startsWith('lot'))) {
      const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'chip'; bt.textContent = l.name;
      bt.onclick = () => { const st = Game.stopFor(l); Game.setWaypoint(st.x, st.z); drawBig(); Game.notify('📍 Route set to <b>' + l.name + '</b>. Follow the blue line.'); };
      dests.appendChild(bt);
    }
    $('bigClear').onclick = () => { waypoint.visible = false; Game.route = null; drawBig(); };
    // big map: drag to pan, wheel or pinch to zoom, tap to set a route
    const ptrs = new Map(); let drag = null;
    const toCanvas = (e) => { const r = big.getBoundingClientRect(), k = devicePixelRatio || 1; return [(e.clientX - r.left) * k, (e.clientY - r.top) * k]; };
    big.addEventListener('wheel', (e) => { e.preventDefault(); const [x, y] = toCanvas(e); bigZoom(e.deltaY < 0 ? 1.25 : 0.8, x, y); }, { passive: false });
    big.addEventListener('pointerdown', (e) => { big.setPointerCapture(e.pointerId); ptrs.set(e.pointerId, toCanvas(e)); drag = { moved: 0, pinch: ptrs.size === 2 ? null : undefined }; });
    big.addEventListener('pointermove', (e) => {
      if (!ptrs.has(e.pointerId) || !drag) return;
      const prev = ptrs.get(e.pointerId), cur = toCanvas(e), m = big._map;
      if (ptrs.size === 1) { BZ.cx -= (cur[0] - prev[0]) / m.scale; BZ.cz -= (cur[1] - prev[1]) / m.scale; drag.moved += Math.hypot(cur[0] - prev[0], cur[1] - prev[1]); ptrs.set(e.pointerId, cur); clampBZ(); drawBig(); return; }
      const [a2, b2] = [...ptrs.values()], d0 = Math.hypot(a2[0] - b2[0], a2[1] - b2[1]);
      ptrs.set(e.pointerId, cur); const [c2, d2] = [...ptrs.values()], d1 = Math.hypot(c2[0] - d2[0], c2[1] - d2[1]);
      drag.moved += 99; if (d0 > 10) bigZoom(d1 / d0, (c2[0] + d2[0]) / 2, (c2[1] + d2[1]) / 2);
    });
    const up = (e) => {
      const was = ptrs.has(e.pointerId); ptrs.delete(e.pointerId);
      if (!was || !drag || ptrs.size) return;
      const k = devicePixelRatio || 1;
      if (drag.moved < 8 * k) { // a tap: route there
        const [cx, cy] = toCanvas(e), m = big._map, x = (cx - m.ox) / m.scale / MAP.px + B.x0, z = (cy - m.oz) / m.scale / MAP.px + B.z0;
        waypoint.position.set(x, KS.heightAt(x, z) + 0.05, z); waypoint.visible = true; if (!target.visible) Game.routeT = 0; Game.notify('📍 Waypoint set. Follow the blue GPS line.'); drawBig();
      }
      drag = null;
    };
    big.addEventListener('pointerup', up); big.addEventListener('pointercancel', (e) => { ptrs.delete(e.pointerId); drag = null; });
    $('mapIn').onclick = () => bigZoom(1.5); $('mapOut').onclick = () => bigZoom(1 / 1.5); $('mapMe').onclick = () => Game.mapCenterOnMe();
    const mz2 = (f) => { Game.miniZoom = KS.clamp(Game.miniZoom * f, 0.4, 3); };
    $('miniIn').onclick = () => mz2(1.4); $('miniOut').onclick = () => mz2(1 / 1.4);
    addEventListener('resize', () => { renderer.setSize(innerWidth, innerHeight); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && KS.state === 'play') pause(true); });
    KS.Radio.onchange = () => { if (KS.state === 'pause') renderRadio(); };
    setLoad(100, 'Ready!'); clearInterval(loadTick);
    $('loading').hidden = true; $('title').hidden = false;
    buildMenu(); KS.Phone.init(); KS.Uthao.render();
    if (!KS.Settings.data().minimap) $('minimap').parentElement.hidden = true;
    requestAnimationFrame(frame);
    window.__ks = { ready: true, buildings: KS.buildingCount, trees: KS.treeCount, vehicles: KS.Traffic.list.length, peds: KS.Peds.list.length };
  };

  function pause(on) {
    if (on && KS.state === 'play') { KS.state = 'pause'; $('menu').hidden = false; Game.openTab2('home'); if (document.exitPointerLock) document.exitPointerLock(); }
    else if (!on && KS.state === 'pause') { KS.state = 'play'; $('menu').hidden = true; }
  }
  Game.pause = pause;
  Game.openTab2 = (tab) => { document.querySelectorAll('[data-tab-btn]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tabBtn === tab))); document.querySelectorAll('[data-tab-panel]').forEach((p) => (p.hidden = p.dataset.tabPanel !== tab)); Game.refreshMenu(); };
  Game.openTab = (tab = 'home') => { pause(true); document.querySelectorAll('[data-tab-btn]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tabBtn === tab))); document.querySelectorAll('[data-tab-panel]').forEach((p) => (p.hidden = p.dataset.tabPanel !== tab)); Game.refreshMenu(); };
  function buildMenu() {
    const wx = $('wxbtns');
    for (const k of KS.Weather.ORDER) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.wx = k; const t = KS.Weather.TYPES[k]; b.innerHTML = `<span>${t.icon}</span>${t.name}`; b.onclick = () => { KS.Weather.auto = false; KS.Weather.set(k); Game.refreshMenu(); }; wx.appendChild(b); }
    const ab = document.createElement('button'); ab.type = 'button'; ab.className = 'chip'; ab.dataset.wx = 'auto'; ab.innerHTML = '<span>↻</span>Changing'; ab.onclick = () => { KS.Weather.auto = true; Game.refreshMenu(); }; wx.appendChild(ab);
    const cams = $('cambtns'); KS.CAMS.forEach((n, i) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip'; b.dataset.cam = i; b.textContent = n; b.onclick = () => { KS.Player.setCam(i); Game.refreshMenu(); }; cams.appendChild(b); });
    $('btnResume').onclick = () => pause(false);
    $('btnSound').onclick = () => { A.setOn(!A.on); Game.save(); Game.refreshMenu(); };
    $('btnQuality').onclick = () => { KS.quality.level = KS.quality.level === 'high' ? 'low' : 'high'; Game.save(); $('qnote').hidden = false; Game.refreshMenu(); };
    $('btnReset').onclick = () => { if ($('btnReset').dataset.armed) { try { localStorage.removeItem('ks-save2'); localStorage.removeItem('ks-save'); } catch (e) { /* ignore */ } location.reload(); } else { $('btnReset').dataset.armed = '1'; $('btnReset').textContent = 'Tap again to erase progress'; } };
    // Free Fire-style character picker on the front page: pick your hero (male
    // or female), then tap a wardrobe top to wear it. The choice saves at once
    // and the player model rebuilds, so the hero you pick is the one you play.
    const renderCharPick = () => {
      const D = KS.Shop.data;
      document.querySelectorAll('.charcard').forEach((c) => c.classList.toggle('sel', c.dataset.gender === D.gender));
      // the big avatar card on the dashboard mirrors the selected hero
      const sel = document.querySelector('.charcard.sel');
      if (sel) { const em = $('avatarEmoji'), nm = $('avatarName'), rl = $('avatarRole'); if (em) em.textContent = sel.querySelector('.char-emoji').textContent; if (nm) nm.textContent = sel.querySelector('.char-name').textContent; if (rl) rl.textContent = sel.querySelector('.char-desc').textContent; }
      const row = $('wardrobeRow'); if (!row) return;
      row.innerHTML = '';
      for (const it of KS.Shop.WARDROBE.filter((w) => w.slot === 'top' && D.items.includes(w.id))) {
        const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (D.wear.top === it.id ? ' sel' : ''); b.textContent = it.name;
        b.onclick = () => { D.wear.top = it.id; KS.Shop.save(); KS.Player && KS.Player.rebuild && KS.Player.rebuild(); renderCharPick(); };
        row.appendChild(b);
      }
      const more = document.createElement('span'); more.className = 'small'; more.style.color = '#b9c2cc'; more.textContent = 'More outfits in the garage (Esc → Garage).';
      row.appendChild(more);
    };
    document.querySelectorAll('.charcard').forEach((c) => { c.onclick = () => { KS.Shop.setGender(c.dataset.gender); renderCharPick(); }; });
    renderCharPick();
    $('btnPlay').onclick = () => {
      A.init(); A.loadDogSamples && A.loadDogSamples(); KS.Radio.load(); $('title').hidden = true; $('hud').hidden = false; if (coarse) $('touch').hidden = false;
      const start = () => {
        const lic = KS.Law.data().lic;
        KS.Guide.render();
        // join the public online world (unless a friend's invite link brought you here, or you turned it off)
        if (!KS.Net.invite && KS.Settings.data().online !== false) setTimeout(() => KS.Net.joinPublic(), 1500);
        if (battle) { KS.Battle.startMatch(); return; }
        KS.Drop.begin({ onLand: () => Game.notify(lic.A ? '🪂 Namaste, Kathmandu! Press <b>C</b> to call your bicycle or scooter here, <b>Q</b> for your phone.' : '🪂 Namaste! You have <b>no licence yet</b>: press <b>C</b> to call your <b>bicycle</b> (no licence needed). <b>Q</b> opens your phone.') });
        Game.notify('✈️ The plane is crossing the valley. Press <b>Space</b> (or Jump) when you want to jump. Tap <b>M</b> to mark where to land.');
      };
      if (KS.Shop.data.seenIntro) { KS.state = 'play'; start(); } else { KS.Shop.data.seenIntro = true; KS.Shop.save(); KS.Cine.play(start); }
    };
    let battle = false;
    $('btnBattle').onclick = () => { battle = true; $('btnPlay').onclick(); };
    // the dashboard: your cash and coins, and the three icon buttons up top
    const tc = $('titleCash'), tt = $('titleTokens');
    if (tc) tc.textContent = 'रु ' + Math.round(KS.Shop.data.cash).toLocaleString('en-IN');
    if (tt) tt.textContent = KS.Shop.data.tokens + ' 🪙';
    const syncTitleSettings = () => {
      const snd = $('tSoundToggle'), q = $('tQualityToggle'), mm = $('tMinimapToggle');
      if (snd) { snd.textContent = A.on ? 'On' : 'Off'; snd.classList.toggle('on', A.on); $('tSound').textContent = A.on ? '🔊' : '🔇'; }
      if (q) { q.textContent = KS.quality.level === 'high' ? 'High' : 'Low'; q.classList.toggle('on', KS.quality.level === 'high'); }
      if (mm) { const on = KS.Settings.data().minimap !== false; mm.textContent = on ? 'On' : 'Off'; mm.classList.toggle('on', on); }
    };
    $('tHow').onclick = () => { const p = $('howtoPanel'); p.hidden = !p.hidden; $('tHow').classList.toggle('on', !p.hidden); if (!p.hidden) { $('titleSettings').hidden = true; $('tSettings').classList.remove('on'); } };
    $('tSettings').onclick = () => { const p = $('titleSettings'); p.hidden = !p.hidden; $('tSettings').classList.toggle('on', !p.hidden); syncTitleSettings(); if (!p.hidden) { $('howtoPanel').hidden = true; $('tHow').classList.remove('on'); } };
    $('tSound').onclick = () => { A.setOn(!A.on); Game.save(); syncTitleSettings(); };
    $('tSoundToggle').onclick = () => { A.setOn(!A.on); Game.save(); syncTitleSettings(); };
    $('tQualityToggle').onclick = () => { KS.quality.level = KS.quality.level === 'high' ? 'low' : 'high'; Game.save(); syncTitleSettings(); };
    $('tMinimapToggle').onclick = () => { const s = KS.Settings.data(); s.minimap = s.minimap === false; Game.save(); syncTitleSettings(); };
    syncTitleSettings();
    $('btnMenu').onclick = () => pause(true);
    $('btnRec').onclick = () => Rec.toggle(); $('btnPhoto').onclick = () => Rec.photo();
    $('btnRadio').onclick = () => Game.toggleRadio();
    $('btnPhone').onclick = () => KS.Uthao.toggle(); $('btnGarage').onclick = () => Game.openTab('garage');
    $('mediaClose').onclick = () => ($('mediaBox').hidden = true);
    document.querySelectorAll('[data-tab-btn]').forEach((b) => (b.onclick = () => Game.openTab(b.dataset.tabBtn)));
    $('radioOff').onclick = () => { KS.Radio.stop(); renderRadio(); };
    $('radioRetry').onclick = () => { KS.Radio.status = 'idle'; KS.Radio.load(); renderRadio(); };
  }
  /** the HUD radio button (and the R key's off state): one tap silences the
      radio, the next tap brings the first station back. */
  Game.toggleRadio = () => {
    const R = KS.Radio;
    if (R.current()) { R.stop(); Game.notify('📻 Radio off'); }
    else { A.init(); const st = R.play(0); Game.notify(st ? `📻 <b>${st.name}</b>` : '📻 Radio off'); }
    if (KS.Phone.app === 'radio') KS.Phone.refresh();
  };
  function renderRadio() {
    const R = KS.Radio, el = $('radioList'); el.innerHTML = '';
    $('radioStatus').textContent = R.status === 'loading' ? 'Finding live stations in Nepal…' : R.status === 'ready' ? `${R.stations.length} live stations from Nepal, via the Radio Browser open directory.` : R.status === 'offline' ? 'Live stations are unavailable right now (offline or blocked). The built-in stations still play.' : 'Live stations load when you start.';
    R.all().forEach((st, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'stn' + (R.idx === i ? ' on' : '');
      b.innerHTML = `<b>${st.live ? '🔴 ' : '🎵 '}${st.name.replace(/</g, '&lt;')}</b><small>${(st.live ? [st.city, st.tags].filter(Boolean).join(' · ') : st.genre + ' · made in-game').replace(/</g, '&lt;')}</small>`;
      b.onclick = () => { A.init(); R.play(i); renderRadio(); Game.notify(KS.Player.vehicle ? `📻 ${st.name}` : `📻 ${st.name} will play when you are in a vehicle.`); };
      el.appendChild(b);
    });
  }
  Game.refreshMenu = () => {
    document.querySelectorAll('[data-wx]').forEach((b) => b.classList.toggle('on', b.dataset.wx === 'auto' ? KS.Weather.auto : !KS.Weather.auto && b.dataset.wx === KS.Weather.type));
    document.querySelectorAll('[data-cam]').forEach((b) => b.classList.toggle('on', +b.dataset.cam === KS.Cam.mode));
    $('btnSound').textContent = A.on ? 'Sound: on' : 'Sound: off';
    $('btnQuality').textContent = 'Graphics: ' + KS.quality.level;
    const list = $('lmlist'); list.innerHTML = '';
    for (const l of KS.landmarks) { const li = document.createElement('li'); li.className = Game.found.has(l.id) ? 'found' : ''; li.innerHTML = `<b>${l.name}</b><span lang="ne">${l.np}</span>`; list.appendChild(li); }
    $('lmcount').textContent = `${Game.found.size} / ${KS.landmarks.length}`;
    $('walletCash').textContent = 'रु ' + Math.round(D.cash).toLocaleString('en-IN'); $('walletTok').textContent = D.tokens + ' 🪙';
    KS.Shop.renderGarage($('garageList')); KS.Shop.renderWardrobe($('wardrobeList')); renderRadio(); KS.Law.renderCard($('licenceCard'));
    KS.Settings.render($('settingsBox'));
    const L = KS.Law.data(), P = KS.Player, lic = ['A', 'B'].map((c) => `<span class="pill ${L.lic[c] && L.suspend <= 0 ? 'ok' : 'no'}">${c} ${L.lic[c] ? (L.suspend > 0 ? 'suspended' : '✔ valid') : '✖ none'}</span>`).join('');
    const fines = L.fines || [], fineTotal = fines.reduce((a, f) => a + f.amount, 0);
    $('homeBox').innerHTML = `<div class="homegrid">
      <div class="hcard"><h4>Licence</h4><div>${lic}</div><small>${L.lic.A || L.lic.B ? (fines.length ? `🧾 ${fines.length} pending fine${fines.length > 1 ? 's' : ''} · रु ${Math.round(fineTotal).toLocaleString('en-IN')} (Phone → Licence to pay)` : 'No pending fines') : 'No licence: bicycle only (or risk a police fine)'}</small>${L.lic.A ? '' : '<button type="button" class="btn small-btn" id="homeLic">Show the way to the licence office</button>'}</div>
      <div class="hcard"><h4>You</h4><div>Health <b>${Math.round(P.health)}%</b> · Karma <b>${Math.round(D.karma)}</b></div><div>Cash <b>रु ${Math.round(D.cash).toLocaleString('en-IN')}</b> · Coins <b>${D.tokens} 🪙</b></div><small>${P.health < 50 ? '❤️ Low! ' : ''}Eat fruit at street stalls (Phone → Food finds the nearest) or rest to heal. Crashes, falls and fights hurt.</small></div>
      <div class="hcard" style="grid-column:1/-1"><h4>Goals · ${KS.GOALS.filter((g) => g.done()).length} / ${KS.GOALS.length}</h4>${KS.Guide.list()}</div>
      <div class="hcard"><h4>Quick</h4><div class="chips"><button type="button" class="chip" data-q="phone">📱 Phone</button><button type="button" class="chip" data-q="map">🗺️ Map</button><button type="button" class="chip" data-q="friends">💬 Play with friends</button><button type="button" class="chip" data-q="bike">🚲 Bring my bicycle</button><button type="button" class="chip" data-q="battle">${KS.Battle.on ? '🌏 Back to the open world' : '⚔️ Battle mode'}</button><button type="button" class="chip" data-q="drop">✈️ Fly & parachute somewhere</button></div></div>
    </div>`;
    const hl = $('homeLic'); if (hl) hl.onclick = () => { Game.setWaypoint(KS.trialGround.counter.x, KS.trialGround.counter.z); pause(false); Game.notify('📍 Follow the blue line to the Trial ground.'); };
    $('homeBox').querySelectorAll('[data-q]').forEach((b) => (b.onclick = () => { const q = b.dataset.q; pause(false); if (q === 'phone') KS.Phone.toggle(true); if (q === 'map') Game.openMap(); if (q === 'friends') { KS.Phone.toggle(true); KS.Phone.openApp('friends'); } if (q === 'bike') KS.Shop.deliver('cycle'); if (q === 'battle') { if (KS.Battle.on) KS.Battle.setMode(false); else KS.Battle.startMatch(); } if (q === 'drop') KS.Drop.begin(); }));
    const s = D.uthao; $('uthaoStats').textContent = `Rating ★ ${KS.Uthao.rating().toFixed(2)} · ${s.trips} trips · रु ${s.earned.toLocaleString('en-IN')} earned`;
    $('btnUthao').textContent = KS.Uthao.online ? 'Go offline' : 'Go online';
  };
  $('btnUthao') && ($('btnUthao').onclick = () => { KS.Uthao.toggle(); Game.refreshMenu(); });
  const fmtTime = (t) => { const h = Math.floor(t), m = Math.floor((t - h) * 60); return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`; };

  /* ======================= the toll expressway (round 15) =======================
     Rs 15 a ride: drive under a toll gantry at the foot of a ramp and the tag
     reader beeps ("tit") and takes the toll. You are only charged when you
     ride up onto the deck — coming back down is free, and you are never
     charged twice for the same ride. */
  KS.Toll = {
    FEE: 15, lastPaid: 0, lastOnDeck: 0, onDeck: false,
    update(dt) {
      const PL = KS.Player; if (!PL || !KS.tollGantries || !KS.tollGantries.length) return;
      const onDeck = (PL.y || 0) > 10 && KS.ringLoopDist && KS.ringLoopDist(PL.x, PL.z) < 12;
      if (onDeck) KS.Toll.lastOnDeck = Date.now();
      KS.Toll.onDeck = onDeck;
      const th = typeof document !== 'undefined' && document.getElementById ? document.getElementById('tollHud') : null;
      if (th) th.hidden = !onDeck;
      if (PL.vehicle) { // only a vehicle can take the ramp
        for (const g of KS.tollGantries) {
          if (Math.hypot(g.x - PL.x, g.z - PL.z) > 7) continue;
          const now = Date.now();
          if (now - KS.Toll.lastPaid < 60000) continue; // one toll per ride
          if (now - KS.Toll.lastOnDeck < 10000) continue; // just came down — free exit
          KS.Toll.lastPaid = now;
          const D = KS.Shop && KS.Shop.data;
          if (D && D.cash >= KS.Toll.FEE) {
            D.cash -= KS.Toll.FEE; KS.Shop.save();
            KS.Game.notify(`🛣️ <b>Tit!</b> Toll tag read at ${g.name} — <b>रु ${KS.Toll.FEE}</b> for the expressway. Fast lane to the other side!`, 'good');
          } else {
            KS.Game.notify(`🛣️ <b>Tit!</b> Toll tag read at ${g.name} — not enough cash for the रु ${KS.Toll.FEE} toll, ride free this time.`, 'good');
          }
          if (KS.audio && KS.audio.beep) KS.audio.beep(1);
          break;
        }
      }
    },
  };

  /* ======================= main loop ======================= */
  const clock = new T.Clock();
  let hudT = 0, miniT = 0, lmT = 0, umbT = 0, lastDistrict = '', titleA = 0;
  const umbGeo = new T.ConeGeometry(0.75, 0.35, 8), umbMats = [0x111111, 0xc8102e, 0x1d4fb8, 0x1f9a4c, 0xf2c418].map((c) => new T.MeshLambertMaterial({ color: c }));
  function frame() {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, clock.getDelta());
    const I = KS.Input, PL = KS.Player, play = KS.state === 'play';
    if (KS.state === 'pause') { if (I.hit('Escape') || I.hit('KeyP')) pause(false); I.endFrame(); renderer.render(scene, camera); return; }
    if (KS.state === 'cine') {
      if (I.hit('Escape') || I.hit('Space') || I.hit('Enter') || I.hit('KeyE')) KS.Cine.skip();
      KS.clock += dt; KS.Weather.update(dt, camera, { focus: tmpV.set(PL.x, PL.y, PL.z) });
      const c2 = { px: PL.x, pz: PL.z, cx: camera.position.x, cz: camera.position.z, night: KS.night, rain: false, player: { x: PL.x, z: PL.z, len: 0.5, wid: 0.6 } };
      KS.Traffic.update(dt, c2); KS.Peds.update(dt, c2); for (const u of KS.timeUniforms) u.value = KS.clock;
      KS.Cine.update(dt, camera); I.endFrame(); renderer.render(scene, camera); return;
    }
    if (KS.state === 'modal') { for (let k = 1; k <= 4; k++) if (I.hit('Digit' + k)) KS.Law.modalKey(k - 1); I.endFrame(); renderer.render(scene, camera); return; }
    KS.clock += dt;
    if (play) {
      if ((I.hit('Escape') && performance.now() - (I.unlockedAt || 0) > 500) || I.hit('KeyP')) pause(true); // the Esc that freed the mouse does not also pause
      if (I.hit('KeyM') || I.hit('KeyMap')) { const b = $('bigwrap'); if (b.hidden) Game.openMap(); else b.hidden = true; }
      if (I.hit('KeyT')) { KS.Weather.auto = false; KS.Weather.next(); Game.notify(`Weather: <b>${KS.Weather.TYPES[KS.Weather.type].name}</b> · press T again to change, Menu → World → Auto to let it change by itself`); }
      if ((I.hit('KeyR') && !KS.Battle.on) || I.hit('KeyRadio')) { A.init(); const st = KS.Radio.next(I.down('ShiftLeft') ? -1 : 1); Game.notify(st ? `📻 <b>${st.name}</b>${PL.vehicle || KS.Radio.onFoot ? '' : ' <span>(plays in vehicles, or turn on earphones in Phone → Radio)</span>'}` : '📻 Radio off'); if (KS.Phone.app === 'radio') KS.Phone.refresh(); }
      if (I.hit('KeyU')) KS.Uthao.toggle();
      if (I.hit('KeyQ') || I.hit('KeyPhone')) KS.Phone.toggle();
      if (I.hit('Backspace') && KS.Phone.open) KS.Phone.home();
      if (I.hit('Enter')) KS.Net.quickChat();
      if (I.hit('KeyK')) Rec.toggle();
      if (I.hit('KeyO') && PL.mode === 'foot' && KS.Mansion) KS.Mansion.toggleWardrobe(); // O opens the wardrobe in the bedroom upstairs
      if (I.hit('KeyC') && !PL.vehicle && PL.mode === 'foot') { // C by the open wardrobe takes the jewellery; anywhere else it calls your vehicle
        if (!(KS.Mansion && KS.Mansion.tryCollect())) KS.Shop.deliver(D.lastRide && D.garage.some((g) => g.id === D.lastRide) ? D.lastRide : 'cycle');
      }
      if (I.hit('KeyJ')) Rec.photo();
      if (I.hit('KeyZ') || I.hit('KeyEat')) Game.eatFromBag();
      if (I.hit('KeyH') || I.hit('KeyHorn')) {
        if (PL.vehicle) { const h = PL.vehicle.horn; A.horn(h && h !== 'standard' ? h : PL.vehicle.kind, 1); Game.honk = 0.4; }
        else { KS.say(PL.person.root, KS.pick(['Oi dai!', 'Namaste!', 'Eh sathi!']), 1.4); Game.honk = 0.4; }
      }
      PL.update(dt);
    }
    KS.Battle.update(dt); KS.Places.update(dt); if (KS.Mountains) KS.Mountains.update(dt);
    if (KS.Damage) KS.Damage.update(dt);
    if (KS.Fuel) KS.Fuel.update(dt); // the fuel-delivery timer
    if (KS.Story) KS.Story.update(dt); // story-mode chapters
    faintUpdate(dt);
    // Tibetan music in the two sacred places: Boudhanath and Swayambhu
    const inSacred = Math.hypot(PL.x - 405, PL.z + 225) < 48 || Math.hypot(PL.x + 700, PL.z + 90) < 70;
    if (inSacred && !(KS.Radio && KS.Radio.playing)) { if (A.tibetanStart) A.tibetanStart(); }
    else if (A.tibetanStop) A.tibetanStop();
    Game.honk = Math.max(0, (Game.honk || 0) - dt);
    KS.Weather.update(dt, camera, { focus: tmpV.set(PL.x, PL.y, PL.z) });
    const ctx = { px: PL.x, pz: PL.z, cx: camera.position.x, cz: camera.position.z, night: KS.night, rain: KS.Weather.wet > 0.3, playerVehicle: PL.vehicle, player: { x: PL.x, z: PL.z, len: PL.len, wid: PL.wid } };
    KS.Traffic.update(dt, ctx);
    if (!D.heliSeen && !D.heliHinted && KS.Heli && KS.Heli.pad && !PL.vehicle && PL.mode === 'foot' && Math.hypot(PL.x - KS.Heli.pad.x, PL.z - KS.Heli.pad.z) < 30) { D.heliHinted = true; Game.save(); Game.notify('🚁 A helicopter you can fly is parked on this pad — walk up and press <b>E</b> to get in. Mind the buildings: fly into one fast and it crashes.'); }
    if (KS.VehicleModels) KS.VehicleModels.tick(dt);
    KS.Peds.update(dt, ctx);
    KS.Animals.update(dt, { px: PL.x, pz: PL.z, playerSpeed: Math.abs(PL.speed), honk: Game.honk > 0.35, inVehicle: !!PL.vehicle, vehicleKind: PL.vehicle && (KS.isBike(PL.vehicle.kind) ? 'bike' : 'car'), night: KS.night });
    for (const u of KS.timeUniforms) u.value = KS.clock;
    if (KS.waterU) {
      const U = KS.waterU, Wx = KS.Weather; U.uTime.value = KS.clock;
      if (Wx.skyU) { U.uSky.value.copy(Wx.skyU.horizon.value); U.uSunDir.value.copy(Wx.skyU.sunDir.value); U.uSun.value = Wx.skyU.sunAmt.value * (1 - Wx.cur.cloud * 0.7); }
      U.uLight.value = 0.3 + 0.7 * KS.day + 0.15 * KS.night;
    }
    for (const h of KS.clockHands) h.hand.rotation.z = h.k === 'h' ? -((KS.time % 12) / 12) * Math.PI * 2 : -(KS.time % 1) * Math.PI * 2;
    // the prayer wheels turn slowly on their own; one the player spun goes faster for a while
    if (KS.prayerWheelDrums && KS.prayerWheelDrums.mesh) {
      const W = KS.prayerWheelDrums, dummy = W._dummy || (W._dummy = new T.Object3D());
      for (let i = 0; i < W.angles.length; i++) {
        W.boost[i] = Math.max(0, (W.boost[i] || 0) - dt * 0.5);
        W.angles[i] += dt * (0.35 + (W.boost[i] || 0));
        dummy.position.set(W.pos[i][0], W.pos[i][1], W.pos[i][2]);
        dummy.rotation.set(0, W.angles[i], 0);
        dummy.updateMatrix();
        W.mesh.setMatrixAt(i, dummy.matrix);
      }
      W.mesh.instanceMatrix.needsUpdate = true;
    }
    const fp = KS.flyingPlane; if (fp) {
      const cyc = KS.clock % 150, rx = KS.runwayX;
      if (cyc < 12) { fp.visible = true; fp.position.set(rx, 2.6, 360); fp.rotation.set(0, Math.PI, 0); }
      else if (cyc < 45) { const t = cyc - 12, z = 360 - 1.4 * t * t, lift = Math.max(0, -z) * 0.16; fp.position.set(rx, 2.6 + lift, z); fp.rotation.set(-Math.min(0.2, lift * 0.004), Math.PI, 0); fp.visible = z > -2600; }
      else if (cyc < 95) fp.visible = false;
      else if (cyc < 130) { const t = (cyc - 95) / 35; fp.visible = true; fp.position.set(rx, KS.lerp(260, 2.6, Math.min(1, t * 1.02)), KS.lerp(2600, 360, t)); fp.rotation.set(0.05, Math.PI, 0); }
      else { const t = cyc - 130; fp.position.set(rx, 2.6, Math.max(-380, 360 - (60 * t - 1.5 * t * t))); fp.rotation.set(0, Math.PI, 0); }
    }
    if (play) {
      missionUpdate(dt); KS.Uthao.update(dt); violations(dt); KS.Law.update(dt); KS.Toll.update(dt); KS.Net.update(dt, camera); KS.Nature.update();
      // the green marker over your bicycle until you have ridden it
      const bike = KS.Traffic.list.find((v) => v.ownedId === 'cycle');
      bikeMark.visible = !!bike && !KS.Guide.flag('bike') && PL.vehicle !== bike;
      if (bikeMark.visible) { bikeMark.position.set(bike.x, bike.y, bike.z); bikeMark.userData.arrow.position.y = 3 + Math.sin(KS.clock * 3) * 0.4; }
      if (KS.schoolLamps) KS.schoolLamps.color.setHex(KS.schoolHours() && Math.floor(KS.clock * 2) % 2 ? 0xffb000 : 0x553300);
      lmT -= dt;
      if (lmT <= 0) {
        lmT = 0.4;
        for (const l of KS.landmarks) if (!Game.found.has(l.id) && Math.hypot(l.x - PL.x, l.z - PL.z) < l.r) {
          Game.found.add(l.id); showCard(l); Game.pay(500, 'Discovered ' + l.name); Game.giveTokens(1, 'New place'); Game.karma(+1, 'Visited ' + l.name);
          if (Game.found.size === KS.landmarks.length) Game.notify('🏆 You have seen every corner of the valley!', 'good');
        }
        for (const [x, z] of KS.bells) { const d = Math.hypot(x - PL.x, z - PL.z); if (d < 30 && KS.chance(0.03)) A.bell(0.4 * (1 - d / 30)); }
      }
      // GPS route refresh
      Game.routeT = (Game.routeT || 0) - dt;
      const gt = target.visible ? target.position : waypoint.visible ? waypoint.position : null;
      if (gt && Game.routeT <= 0) { Game.routeT = 1.5; Game.route = KS.Traffic.route(PL.x, PL.z, gt.x, gt.z); } else if (!gt) Game.route = null;
      umbT -= dt;
      if (umbT <= 0) {
        umbT = 0.6; const wet = KS.Weather.wet > 0.3;
        for (const p of KS.Peds.list) {
          if (!p.p.root.visible || p.mode === 'police' || p.kind === 'monk') continue;
          if (wet && !p.umb && KS.chance(0.7) && p.mode !== 'sit') { p.umb = new T.Mesh(umbGeo, KS.pick(umbMats)); const stick = new T.Mesh(new T.CylinderGeometry(0.02, 0.02, 1, 4), umbMats[0]); stick.position.y = -0.5; p.umb.add(stick); p.umb.position.set(0.25, 2.25, 0.1); p.p.root.add(p.umb); }
          if (p.umb) { p.umb.visible = wet; p.p.busyArm = wet && !p.fight; if (wet) p.p.armR.rotation.x = -2.6; }
        }
      }
      hudT -= dt; if (hudT <= 0) { hudT = 0.2; updateHUD(); }
      miniT -= dt; if (miniT <= 0) { miniT = 1 / 20; drawMini(); }
      for (const m of [target, momoShop, waypoint]) if (m.visible) { m.userData.arrow.position.y = 4 + Math.sin(KS.clock * 3) * 0.5; m.userData.arrow.rotation.y += dt * 2; }
      if (waypoint.visible && Math.hypot(waypoint.position.x - PL.x, waypoint.position.z - PL.z) < 8) { waypoint.visible = false; Game.notify('Waypoint reached.'); }
      PL.updateCamera(camera, dt);
      let crowd = 0; KS.Peds.forEachNear(PL.x, PL.z, 22, () => crowd++);
      let sir = 0; for (const v of KS.Traffic.list) if (v.kind === 'ambulance' && v.ai) sir = Math.max(sir, 1 - Math.hypot(v.x - PL.x, v.z - PL.z) / 160);
      A.update(dt, { density: Math.min(1, KS.Traffic.nearCount(PL.x, PL.z, 60) / 10), crowd, siren: sir, rain: KS.Weather.wet, wind: KS.Weather.cur.wind, speed: Math.abs(PL.speed), vehicle: PL.vehicle, throttle: PL.vehicle ? PL.throttle || 0 : 0 });
    } else {
      titleA += dt * 0.05;
      camera.position.set(-120 + Math.cos(titleA) * 170, 70 + Math.sin(titleA * 0.7) * 10, -120 + Math.sin(titleA) * 170);
      camera.lookAt(-110, 8, -80);
    }
    KS.updateBubbles(dt, camera, innerWidth, innerHeight);
    renderer.render(scene, camera);
    if (Rec.wantPhoto) takePhoto();
    I.endFrame();
  }
  function showCard(l) {
    const c = $('card'); $('cardNp').textContent = l.np; $('cardEn').textContent = l.name; $('cardFact').textContent = l.fact;
    c.hidden = false; c.classList.remove('show'); void c.offsetWidth; c.classList.add('show');
    clearTimeout(showCard.t); showCard.t = setTimeout(() => (c.hidden = true), 4000); // a small toast, not a billboard: gone in 4 s, or tap it away
    c.onclick = () => { clearTimeout(showCard.t); c.hidden = true; };
    A.bell(0.5);
  }
  function updateHUD() {
    const PL = KS.Player, d = KS.districtAt(PL.x, PL.z);
    if (d.name !== lastDistrict) { lastDistrict = d.name; $('locNp').textContent = d.np; $('locEn').textContent = d.name; const el = $('loc'); el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash'); }
    const w = KS.Weather.describe();
    $('clock').textContent = fmtTime(KS.time);
    $('wx').textContent = `${w.icon} ${w.name}`; $('temp').textContent = `${w.temp}°C`;
    const aqi = $('aqi'); aqi.textContent = `AQI ${w.aqi}`; aqi.dataset.level = w.aqi > 150 ? 'bad' : w.aqi > 100 ? 'mid' : 'ok';
    $('money').textContent = 'रु ' + Math.round(D.cash).toLocaleString('en-IN'); $('tokens').textContent = D.tokens + ' 🪙';
    $('karma').style.setProperty('--k', D.karma + '%'); $('karmaV').textContent = Math.round(D.karma);
    $('health').style.setProperty('--h', Math.max(0, PL.health) + '%');
    const bagN = (D.bag && D.bag.fruit) || 0, bg = $('bagHud'); if (bg) { bg.hidden = !bagN; bg.textContent = `🎒 🍎×${bagN} (Z)`; }
    const temp = KS.temperatureAt ? KS.temperatureAt(PL.x, PL.z) : 18, te = $('temp'); if (te) { te.textContent = `🌡️ ${temp}°C`; te.classList.toggle('cold', temp <= 0); }
    if (PL.vehicle) {
      const heli = PL.vehicle.kind === 'helicopter';
      const kmh = Math.round(Math.abs(PL.vehicle.speed) * 3.6), lim = heli ? null : KS.speedLimit(PL.x, PL.z);
      $('kmh').textContent = kmh;
      if (heli) { // a helicopter has no road speed limit: the badge shows altitude instead
        $('limit').hidden = false; $('limit').textContent = Math.round(PL.vehicle.alt || 0); $('limit').classList.remove('over'); $('limit').classList.add('alt'); $('limit').title = 'Altitude (m)';
      } else { $('limit').hidden = !lim; if (lim) { $('limit').textContent = lim; $('limit').classList.toggle('over', kmh > lim + 2); $('limit').classList.remove('alt'); $('limit').title = 'Speed limit'; } }
      const st = KS.Radio.current(); $('radio').textContent = st ? '📻 ' + st.name : '📻 off (R)';
      $('nitro').hidden = !(PL.vehicle.up && PL.vehicle.up.nitro); $('nitro').textContent = PL.nitro > 0 ? '🔥 NITRO' : PL.nitroCool > 0 ? `Nitro ${Math.ceil(PL.nitroCool)}s` : 'Nitro ready (B)';
      // fuel gauge: a little bar under the speed, red when low
      const fl = $('fuel'), fv = KS.Fuel ? KS.Fuel.of(PL.vehicle) : null;
      if (fl) { if (fv == null) fl.hidden = true; else { fl.hidden = false; fl.innerHTML = `⛽ <i style="--f:${Math.round(fv)}%"></i> ${Math.round(fv)}%`; fl.classList.toggle('low', fv < 20); } }
    }
    $('btnRadio').classList.toggle('on', !!KS.Radio.current()); // the HUD radio button shows whether anything is playing
    if (Rec.on) $('recTime').textContent = Math.floor((KS.clock - Rec.t0) / 60) + ':' + String(Math.floor((KS.clock - Rec.t0) % 60)).padStart(2, '0');
    let prompt = '', bh = '';
    if (promptT > 0) { promptT -= 0.2; prompt = promptOverride; }
    else if (!PL.vehicle) {
      const v = KS.Traffic.nearest(PL.x, PL.z, 3.6);
      if (v) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ${v.owned ? 'Ride your' : v.ai ? 'Take the' : 'Ride the'} ${v.type.name.toLowerCase()}`;
      else if (KS.prayerWheels.some(([x, z]) => Math.hypot(x - PL.x, z - PL.z) < 2.4)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Spin the prayer wheel`;
      else if (KS.bells.some(([x, z]) => Math.hypot(x - PL.x, z - PL.z) < 9)) prompt = `<kbd>${coarse ? 'Ring' : 'E'}</kbd> Ring the temple bell 🔔`;
      else if (KS.Weapons && KS.Weapons.nearest(PL.x, PL.z, 3.5)) prompt = `<kbd>${coarse ? 'Shop' : 'E'}</kbd> 🔫 ${KS.Weapons.nearest(PL.x, PL.z, 3.5).name} — buy a weapon`;
      else if (PL.swim) prompt = KS.waterLevel(PL.x, PL.z) != null ? '🏊 Swimming! Walk to the edge or the steps to climb out.' : 'Swimming in the Bagmati… head for the bank!';
      else if (Game.momoPending && Math.hypot(PL.x - MOMO.x, PL.z - MOMO.z) < 12) prompt = 'Step into the beam to collect the <b>momo order</b>';
      else if ((KS.lifts || []).some((l) => Math.hypot(l.x - PL.x, l.z - PL.z) < 3.2 && Math.abs(l.y - PL.y) < 2.5)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ${(KS.lifts.find((l) => Math.hypot(l.x - PL.x, l.z - PL.z) < 3.2 && Math.abs(l.y - PL.y) < 2.5)).label}`;
      else if (KS.Mansion.nearBooth(PL)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> 🎟️ ${KS.Mansion.ticket ? 'Your tour ticket ✔' : `House & garden tour ticket · रु ${KS.Mansion.price}`}`;
      else if (KS.Mansion.wardrobe && KS.Mansion.nearWardrobe(PL) && KS.Mansion.wardrobe.open && KS.Mansion.jewellery.inWardrobe) prompt = `<kbd>${coarse ? 'Take' : 'C'}</kbd> 💎 Take the jewellery`;
      else if (KS.Mansion.wardrobe && KS.Mansion.nearWardrobe(PL)) prompt = `<kbd>${coarse ? 'Open' : 'O'}</kbd> 👗 ${KS.Mansion.wardrobe.open ? 'Close the wardrobe' : 'Open the wardrobe'}`;
      else if (KS.Mountains && KS.Mountains.skiHire && Math.hypot(PL.x - KS.Mountains.skiHire.x, PL.z - KS.Mountains.skiHire.z) < 4) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ⛷️ ${PL.board ? 'You have a board — ride down!' : `Hire a snowboard · रु ${KS.Mountains.skiPrice}`}`;
      else if (KS.Mountains && KS.Mountains.teaHouse && Math.hypot(PL.x - KS.Mountains.teaHouse.x, PL.z - KS.Mountains.teaHouse.z) < 4) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ☕ Hot chiya · रु ${KS.Mountains.chiyaPrice} (+20 health)`;
      else if (KS.Mountains && KS.Mountains.paraOffice && Math.hypot(PL.x - KS.Mountains.paraOffice.x, PL.z - KS.Mountains.paraOffice.z) < 4) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> 🪂 ${PL.paraTicket ? 'You have a ticket — go to the takeoff!' : `Paragliding ticket · रु ${KS.Mountains.paraPrice}`}`;
      else if (KS.Mountains && KS.Mountains.paraTakeoff && PL.paraTicket && Math.hypot(PL.x - KS.Mountains.paraTakeoff.x, PL.z - KS.Mountains.paraTakeoff.z) < 6) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> 🪂 Launch the paraglider!`;
      else if (KS.Flight && Math.hypot(PL.x - KS.Flight.counter.x, PL.z - KS.Flight.counter.z) < 4) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ✈️ ${KS.Flight.ticket ? 'You have a ticket — board the plane!' : `Mountain flight ticket · रु ${KS.Flight.price}`}`;
      else if (KS.Flight && KS.Flight.nearPlane(PL) && KS.Flight.ticket) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ✈️ Board the plane (4 seats)`;
      else if (KS.Net && KS.Net.boardHint && (bh = KS.Net.boardHint())) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> ${bh}`;
      else if (KS.agent && Math.hypot(PL.x - KS.agent.x, PL.z - KS.agent.z) < 2.6) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Talk to the man in sunglasses 🕶️`;
      else if (KS.pond && !PL.boat && Math.hypot(PL.x - KS.pond.jetty.x, PL.z - KS.pond.jetty.z) < 2.8) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Hire a rowing boat (रु 100)`;
      else if (PL.boat && PL.boat.nearJetty) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Get off at the jetty`;
      else if (KS.fruitStalls.some(([x, z]) => Math.hypot(x - PL.x, z - PL.z) < 2.6)) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Buy fruit (health ${Math.round(PL.health)}%)`;
      else if (KS.trialGround && Math.hypot(PL.x - KS.trialGround.counter.x, PL.z - KS.trialGround.counter.z) < 3.5) prompt = `<kbd>${coarse ? 'Ride' : 'E'}</kbd> Licence counter: written test & trial`;
    } else if (KS.Uthao.trip && Math.hypot(PL.x - (KS.Uthao.trip.stage === 'pickup' ? KS.Uthao.trip.from.x : KS.Uthao.trip.to.x), PL.z - (KS.Uthao.trip.stage === 'pickup' ? KS.Uthao.trip.from.z : KS.Uthao.trip.to.z)) < 25) prompt = KS.Uthao.trip.stage === 'pickup' ? 'Stop next to the yellow marker to pick up' : 'Stop at the yellow marker to drop off';
    $('prompt').innerHTML = prompt; $('prompt').hidden = !prompt;
    const so = KS.Story ? KS.Story.objective() : null, mp = $('mission');
    if (so) {
      mp.hidden = false; $('mTitle').textContent = '📖 ' + so.title; $('mObj').textContent = so.obj;
      $('mMeta').textContent = `${Math.round(so.dist)} m${so.t > 0 ? ` · ${Math.max(0, Math.floor(so.t / 60))}:${String(Math.max(0, Math.floor(so.t % 60))).padStart(2, '0')}` : ''}`;
      mp.classList.toggle('urgent', so.t > 0 && so.t < 20);
    } else {
      const m = Game.mission;
      if (m) {
        mp.hidden = false; $('mTitle').textContent = m.title; $('mObj').textContent = `Deliver to ${m.area}`;
        $('mMeta').textContent = `${Math.round(Math.hypot(PL.x - m.x, PL.z - m.z))} m · ${Math.max(0, Math.floor(m.t / 60))}:${String(Math.max(0, Math.floor(m.t % 60))).padStart(2, '0')}`;
        mp.classList.toggle('urgent', m.t < 20);
      } else mp.hidden = true;
    }
    KS.Uthao.tick(); KS.Law.hud(); KS.Guide.render(); KS.Phone.tick(); navigation();
    const rn = KS.roadNameAt(PL.x, PL.z); $('road').textContent = rn ? rn[1] + ' · ' + rn[0] : '';
    $('lowHealth').style.opacity = PL.health < 35 ? String((35 - PL.health) / 35) : '0';
    const yaw = ((KS.Cam.yaw % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    $('himal').hidden = !(Math.abs(yaw - Math.PI) < 0.6 && KS.Weather.cur.mtn > 0.5 && KS.day > 0.3);
    $('camName').textContent = '🎥 ' + KS.CAMS[KS.Cam.mode];
  }

  // If booting fails after the title is already up, the error used to be
  // written into the hidden loader, so the user saw a normal-looking title
  // with dead buttons and no message at all. Show the loader again with the
  // error, so a boot failure is never silent.
  addEventListener('load', () => { Game.start().catch((e) => { console.error(e); $('loadmsg').textContent = 'Could not start 3D: ' + e.message + ' — reload the page and try again.'; $('loading').hidden = false; }); });
})();
