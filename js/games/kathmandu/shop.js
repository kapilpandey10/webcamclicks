/* Kathmandu Streets — economy: cash (रु) from jobs, coins from completed jobs; vehicle showroom, upgrades,
   paint and horns; wardrobe bought with coins; save game in this browser. */
(function () {
  'use strict';
  const KS = window.KS;
  const S = (KS.Shop = {});
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* storage blocked */ } } };
  S.store = store;

  S.VEHICLES = [
    { id: 'cycle', model: 'bicycle', name: 'City Bicycle', price: 0, cls: 'cycle', blurb: 'No licence needed. Parcel jobs, and your ride while suspended.' },
    { id: 'sathi', model: 'scooter', name: 'Sathi 110 Scooter', price: 0, cls: 'moto', blurb: 'Your first ride. Nimble in Thamel traffic.' },
    { id: 'chitwan', model: 'bike', name: 'Chitwan 150 Commuter', price: 6000, cls: 'moto', blurb: 'The bike every rider in Nepal knows: cheap, tough, quick.' },
    { id: 'rapti', model: 'sport', name: 'Rapti 220 Sport', price: 16000, cls: 'moto', blurb: 'Fairing, clip-ons and serious acceleration.' },
    { id: 'himal', model: 'cruiser', name: 'Himal 350 Cruiser', price: 22000, cls: 'moto', blurb: 'Low seat and a thump you feel on the Ring Road.' },
    { id: 'safa', model: 'tempo', name: 'Safa Tempo EV', price: 18000, cls: 'cargo', blurb: 'Electric three-wheeler for small cargo jobs.' },
    { id: 'bagmati', model: 'car', name: 'Bagmati Hatch', price: 28000, cls: 'car', blurb: 'Small car for Uthao rides with luggage and families.' },
    { id: 'bijuli', model: 'ev', name: 'Bijuli EV', price: 38000, cls: 'car', blurb: 'Quiet, instant torque, green number plate.' },
    { id: 'bhariya', model: 'pickup', name: 'Bhariya Pickup', price: 40000, cls: 'cargo', blurb: 'Gas cylinders, furniture and vegetables from the village.' },
    { id: 'annapurna', model: 'sedan', name: 'Annapurna Sedan', price: 45000, cls: 'car', blurb: 'Comfortable, so VIP passengers tip better.' },
    { id: 'everest', model: 'suv', name: 'Everest SUV', price: 65000, cls: 'car', blurb: 'High seat, big tyres, made for the Nagdhunga road.' },
    { id: 'sagarmatha', model: 'sportscar', name: 'Sagarmatha GT', price: 120000, cls: 'car', blurb: 'The fastest car in Kathmandu. A GT coupe that outruns police bikes.' },
  ];
  S.UPGRADES = [
    { key: 'engine', name: 'Engine tune', max: 3, cost: (v) => Math.max(1500, v.price * 0.18), desc: '+12% top speed and pull per level' },
    { key: 'brakes', name: 'Brakes', max: 3, cost: (v) => Math.max(1000, v.price * 0.1), desc: 'Stop harder (passengers still hate it)' },
    { key: 'handling', name: 'Tyres & handling', max: 3, cost: (v) => Math.max(1000, v.price * 0.1), desc: 'Sharper steering on wet roads' },
    { key: 'nitro', name: 'Nitro boost', max: 1, cost: () => 5000, desc: 'Press B for a 3-second boost' },
  ];
  S.HORNS = [{ id: 'standard', name: 'Standard', price: 0 }, { id: 'musical', name: 'Musical truck horn', price: 800 }, { id: 'pressure', name: 'Pressure horn', price: 1200 }];
  S.PAINT = [null, 0xc81e1e, 0x111111, 0xf4f4f4, 0x1d4fb8, 0x0f8a7a, 0xf2a516, 0x6d1a8a, 0x2f6b3a, 0x8a8a90];

  S.WARDROBE = [
    { id: 'top_bomber', slot: 'top', name: 'Red bomber jacket', tokens: 0, set: { topStyle: 'jacket', jacket: 0xc81e1e, top: 0x222222 } },
    { id: 'top_uthao', slot: 'top', name: 'Uthao rider jacket', tokens: 0, set: { topStyle: 'jacket', jacket: 0x0f8a7a, top: 0xf4f4f4 } },
    { id: 'top_shirt', slot: 'top', name: 'White shirt', tokens: 4, set: { topStyle: 'shirt', top: 0xf4f2ec } },
    { id: 'top_jersey', slot: 'top', name: 'Football jersey', tokens: 8, set: { topStyle: 'tshirt', top: 0xc8102e } },
    { id: 'top_hoodie', slot: 'top', name: 'Black hoodie', tokens: 10, set: { topStyle: 'jacket', jacket: 0x1c1c1c, top: 0x333333 } },
    { id: 'top_kurta', slot: 'top', name: 'Teal kurta', tokens: 12, set: { topStyle: 'kurta', top: 0x0f6b6b } },
    { id: 'top_kurtha', slot: 'top', name: 'Red kurtha', tokens: 12, set: { topStyle: 'kurta', top: 0xc8102e } },
    { id: 'top_blouse', slot: 'top', name: 'Floral blouse', tokens: 8, set: { topStyle: 'blouse', top: 0xe8a0b0 } },
    { id: 'top_trek', slot: 'top', name: 'Trekking jacket', tokens: 15, set: { topStyle: 'jacket', jacket: 0xe86412, top: 0xe0e0e0 } },
    { id: 'top_daura', slot: 'top', name: 'Daura suruwal & coat', tokens: 25, set: { topStyle: 'daura', top: 0xf2ede0, coat: 0x2a2a2a, bottom: 0xf2ede0, bottomStyle: 'suruwal' } },
    { id: 'top_leather', slot: 'top', name: 'Leather jacket', tokens: 30, set: { topStyle: 'jacket', jacket: 0x3a2414, top: 0x111111 } },
    { id: 'bot_jeans', slot: 'bottom', name: 'Blue jeans', tokens: 0, set: { bottom: 0x2b4a7a, bottomStyle: 'pants' } },
    { id: 'bot_sari', slot: 'bottom', name: 'Red sari', tokens: 15, set: { bottom: 0x7a1f1f, bottomStyle: 'sari', scarf: 0xe9dcc4 } },
    { id: 'bot_skirt', slot: 'bottom', name: 'Pleated skirt', tokens: 8, set: { bottom: 0x2a2a4a, bottomStyle: 'skirt' } },
    { id: 'bot_black', slot: 'bottom', name: 'Black trousers', tokens: 4, set: { bottom: 0x1e1e22, bottomStyle: 'pants' } },
    { id: 'bot_cargo', slot: 'bottom', name: 'Cargo pants', tokens: 7, set: { bottom: 0x6b6b4a, bottomStyle: 'pants' } },
    { id: 'bot_shorts', slot: 'bottom', name: 'Shorts', tokens: 4, set: { bottom: 0x3a3a46, bottomStyle: 'shorts' } },
    { id: 'hat_none', slot: 'hat', name: 'No hat', tokens: 0, set: { hat: null } },
    { id: 'hat_topi', slot: 'hat', name: 'Dhaka topi', tokens: 6, set: { hat: 'topi', hatColor: 0xa8323a } },
    { id: 'hat_cap', slot: 'hat', name: 'Cap', tokens: 4, set: { hat: 'cap', hatColor: 0x1d4fb8 } },
    { id: 'hat_beanie', slot: 'hat', name: 'Woolly beanie', tokens: 5, set: { hat: 'beanie', hatColor: 0xc8962a } },
    { id: 'hat_sun', slot: 'hat', name: 'Sun hat', tokens: 7, set: { hat: 'sunhat', hatColor: 0xe9dcc4 } },
    { id: 'hel_white', slot: 'helmet', name: 'White helmet', tokens: 0, set: { helmet: 0xf4f4f4 } },
    { id: 'hel_teal', slot: 'helmet', name: 'Uthao helmet', tokens: 0, set: { helmet: 0x0f8a7a } },
    { id: 'hel_black', slot: 'helmet', name: 'Matte black helmet', tokens: 3, set: { helmet: 0x1a1a1a } },
    { id: 'hel_red', slot: 'helmet', name: 'Racing red helmet', tokens: 5, set: { helmet: 0xc81e1e } },
    { id: 'hel_gold', slot: 'helmet', name: 'Gold helmet', tokens: 20, set: { helmet: 0xd9a52b } },
    { id: 'eye_none', slot: 'glasses', name: 'No glasses', tokens: 0, set: { glasses: false } },
    { id: 'eye_sun', slot: 'glasses', name: 'Sunglasses', tokens: 4, set: { glasses: true } },
    { id: 'hair_short', slot: 'hair', name: 'Short hair', tokens: 0, set: { hairStyle: 'short' } },
    { id: 'hair_long', slot: 'hair', name: 'Long hair', tokens: 3, set: { hairStyle: 'long' } },
    { id: 'hair_bun', slot: 'hair', name: 'Top knot', tokens: 3, set: { hairStyle: 'bun' } },
    { id: 'hair_bald', slot: 'hair', name: 'Shaved', tokens: 2, set: { hairStyle: 'bald' } },
    { id: 'bag_pack', slot: 'bag', name: 'Backpack', tokens: 0, set: { bag: 'backpack', bagColor: 0x222222 } },
    { id: 'bag_none', slot: 'bag', name: 'No bag', tokens: 0, set: { bag: null } },
  ];
  S.SKINS = [0xc8916a, 0xb98159, 0xd6a27c, 0xa87250, 0xe0b18c, 0x9c6a48];
  S.SLOTS = [['top', 'Tops'], ['bottom', 'Trousers'], ['hat', 'Hats'], ['helmet', 'Riding helmets'], ['glasses', 'Eyewear'], ['hair', 'Hair'], ['bag', 'Bags']];

  const saved = store.get('ks-save2', null) || {};
  S.hadSave = !!saved.garage || !!store.get('ks-save', null);
  const old = store.get('ks-save', {});
  const D = (S.data = Object.assign({
    cash: old.money != null ? old.money : 2500, tokens: 10, karma: old.karma != null ? old.karma : 50, found: old.found || [],
    garage: [{ id: 'cycle', up: { engine: 0, brakes: 0, handling: 0, nitro: 0 }, horn: 'standard', paint: null }, { id: 'sathi', up: { engine: 0, brakes: 0, handling: 0, nitro: 0 }, horn: 'standard', paint: null }],
    items: ['top_bomber', 'top_uthao', 'bot_jeans', 'hat_none', 'hel_white', 'hel_teal', 'eye_none', 'hair_short', 'bag_pack', 'bag_none'],
    wear: { top: 'top_bomber', bottom: 'bot_jeans', hat: 'hat_none', helmet: 'hel_white', glasses: 'eye_none', hair: 'hair_short', bag: 'bag_pack' }, skin: 0xb98159,
    gender: 'male', // the main character: 'male' or 'female' — picked on the front page, like Free Fire
    uthao: { trips: 0, ratingSum: 0, ratingN: 0, earned: 0 }, sound: old.sound !== false, quality: old.quality,
  }, saved));
  S.save = () => store.set('ks-save2', D);
  if (!D.garage.some((g) => g.id === 'cycle')) D.garage.unshift({ id: 'cycle', up: { engine: 0, brakes: 0, handling: 0, nitro: 0 }, horn: 'standard', paint: null });

  /** pick the main character's gender on the front page; the body rebuilds at once */
  S.setGender = (g) => {
    if (g !== 'male' && g !== 'female') return;
    D.gender = g; S.save();
    if (KS.Player && KS.Player.rebuild) KS.Player.rebuild();
  };
  S.playerOutfit = () => {
    const female = D.gender === 'female';
    const o = KS.outfitFor(female ? 'woman' : 'man');
    Object.assign(o, { skin: D.skin, hair: 0x161210, moustache: false, glasses: false, hat: null, bag: null, coat: null, height: female ? 0.97 : 1.02, build: 1, shoes: 0xf4f4f4 });
    if (female) { o.hairStyle = 'long'; o.tika = true; }
    for (const slot in D.wear) { const it = S.WARDROBE.find((w) => w.id === D.wear[slot]); if (it && slot !== 'helmet') Object.assign(o, it.set); }
    if (female && D.wear.hair === 'hair_short') o.hairStyle = 'long'; // the default short hair is a boy's cut; a female hero wears her hair long unless she picks otherwise
    const v = KS.Player && KS.Player.vehicle;
    if (v && KS.isBike(v.kind)) { const h = S.WARDROBE.find((w) => w.id === D.wear.helmet); o.hat = 'helmet'; o.hatColor = h ? h.set.helmet : 0xf4f4f4; }
    return o;
  };
  S.owns = (id) => D.garage.some((g) => g.id === id);
  S.spec = (id) => S.VEHICLES.find((v) => v.id === id);

  /** bring an owned vehicle to the kerb next to the player */
  S.deliver = (id) => {
    const g = D.garage.find((x) => x.id === id), spec = S.spec(id), PL = KS.Player;
    if (!g || !spec) return;
    if (PL.vehicle && PL.vehicle.owned) { KS.Game.notify('Get out of your current vehicle first.'); return; }
    if (S.delivered) { KS.Traffic.remove(S.delivered); S.delivered = null; }
    const a = KS.Cam.yaw + Math.PI / 2;
    let x = PL.x + Math.sin(a) * 3, z = PL.z + Math.cos(a) * 3;
    const c = KS.collide(x, z, KS.VTYPES[spec.model].r, PL.y, 0.5); x = c.x; z = c.z;
    const v = KS.Traffic.park(spec.model, x, z, KS.Cam.yaw, { owned: true, color: g.paint || undefined });
    if (!v) { KS.Game.notify('⚠️ The realistic vehicle models did not load, so your vehicle could not be delivered. Open the game from the website and reload.', 'bad'); return; }
    v.up = g.up; v.horn = g.horn; v.ownedId = id; v.fuel = g.fuel != null ? g.fuel : 100; v.type = Object.assign({}, v.type, { name: spec.name });
    S.delivered = v;
    KS.Game.notify(`🔑 Your <b>${spec.name}</b> is parked next to you.`); KS.audio.ding();
  };
  function buyVehicle(spec) {
    if (S.owns(spec.id)) return S.deliver(spec.id);
    if (D.cash < spec.price) return KS.Game.notify(`You need रु ${spec.price.toLocaleString('en-IN')} for the ${spec.name}.`, 'bad');
    D.cash -= spec.price; D.garage.push({ id: spec.id, up: { engine: 0, brakes: 0, handling: 0, nitro: 0 }, horn: 'standard', paint: null });
    S.save(); KS.audio.cash(); KS.Game.notify(`🎉 Bought the <b>${spec.name}</b>!`, 'good'); S.deliver(spec.id);
  }
  function upgrade(id, key) {
    const g = D.garage.find((x) => x.id === id), spec = S.spec(id), u = S.UPGRADES.find((x) => x.key === key);
    if (g.up[key] >= u.max) return;
    const cost = Math.round(u.cost(spec) * (g.up[key] + 1) / 100) * 100;
    if (D.cash < cost) return KS.Game.notify(`${u.name} costs रु ${cost.toLocaleString('en-IN')}.`, 'bad');
    D.cash -= cost; g.up[key]++; S.save(); KS.audio.cash(); KS.Game.notify(`🔧 ${spec.name}: ${u.name} level ${g.up[key]}`, 'good');
    if (S.delivered && S.delivered.ownedId === id) S.delivered.up = g.up;
  }
  function paint(id, color) {
    const g = D.garage.find((x) => x.id === id); if (D.cash < 500) return KS.Game.notify('Paint costs रु 500.', 'bad');
    D.cash -= 500; g.paint = color; S.save(); KS.Game.notify('🎨 Repainted. Call the vehicle again to see it.', 'good');
    if (S.delivered && S.delivered.ownedId === id && KS.Player.vehicle !== S.delivered) S.deliver(id);
  }
  function horn(id, h) {
    const g = D.garage.find((x) => x.id === id), hs = S.HORNS.find((x) => x.id === h);
    if (g.horns && g.horns.includes(h)) { g.horn = h; S.save(); KS.audio.horn(h === 'standard' ? 'car' : h); return; }
    if (D.cash < hs.price) return KS.Game.notify(`That horn costs रु ${hs.price}.`, 'bad');
    D.cash -= hs.price; g.horns = (g.horns || ['standard']).concat(h); g.horn = h; S.save(); KS.audio.horn(h === 'standard' ? 'car' : h);
    if (S.delivered && S.delivered.ownedId === id) S.delivered.horn = h;
  }
  function wear(item) {
    if (!D.items.includes(item.id)) {
      if (D.tokens < item.tokens) return KS.Game.notify(`You need ${item.tokens} coins for the ${item.name}. Finish jobs to earn coins.`, 'bad');
      D.tokens -= item.tokens; D.items.push(item.id); KS.audio.coin(); KS.Game.notify(`👕 Bought: ${item.name}`, 'good');
    }
    D.wear[item.slot] = item.id; S.save(); KS.Player.rebuild();
  }

  /* ---------- UI ---------- */
  const fmt = (n) => 'रु ' + Math.round(n).toLocaleString('en-IN');
  const hex = (c) => '#' + c.toString(16).padStart(6, '0');
  S.renderGarage = (el) => {
    el.innerHTML = '';
    for (const spec of S.VEHICLES) {
      const owned = D.garage.find((g) => g.id === spec.id), t = KS.VTYPES[spec.model];
      const card = document.createElement('div'); card.className = 'shopcard' + (owned ? ' owned' : '');
      const kmh = Math.round(t.speed * 1.55 * 3.6 * (owned ? 1 + owned.up.engine * 0.12 : 1));
      card.innerHTML = `<div class="sc-top"><b>${spec.name}</b><span class="tag">${spec.cls === 'cycle' ? 'No licence' : spec.cls === 'moto' ? 'Licence A' : 'Licence B'}</span></div>
        <p>${spec.blurb}</p><div class="stats"><span>Top ${kmh} km/h</span><span>Uthao: ${spec.cls === 'cycle' ? 'food & document parcels' : spec.cls === 'moto' ? 'rides, small parcels' : spec.cls === 'car' ? 'rides, luggage, families' : 'cargo, village produce'}</span></div>`;
      const row = document.createElement('div'); row.className = 'sc-actions';
      const main = document.createElement('button'); main.type = 'button'; main.className = 'btn small-btn';
      main.textContent = owned ? 'Bring it here' : spec.price ? 'Buy ' + fmt(spec.price) : 'Free';
      main.onclick = () => { buyVehicle(spec); KS.Game.refreshMenu(); }; row.appendChild(main);
      card.appendChild(row);
      if (owned && spec.cls !== 'cycle') {
        const ups = document.createElement('div'); ups.className = 'ups';
        for (const u of S.UPGRADES) {
          const lvl = owned.up[u.key], b = document.createElement('button'); b.type = 'button'; b.className = 'chip';
          const cost = Math.round(u.cost(spec) * (lvl + 1) / 100) * 100;
          b.innerHTML = `${u.name} <small>${'●'.repeat(lvl)}${'○'.repeat(u.max - lvl)}</small> ${lvl < u.max ? fmt(cost) : '<small>max</small>'}`; b.title = u.desc; b.disabled = lvl >= u.max;
          b.onclick = () => { upgrade(spec.id, u.key); KS.Game.refreshMenu(); }; ups.appendChild(b);
        }
        const hr = document.createElement('div'); hr.className = 'ups';
        for (const h of S.HORNS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (owned.horn === h.id ? ' on' : ''); const have = !h.price || (owned.horns || []).includes(h.id); b.innerHTML = `📯 ${h.name} ${have ? '' : '<small>' + fmt(h.price) + '</small>'}`; b.onclick = () => { horn(spec.id, h.id); KS.Game.refreshMenu(); }; hr.appendChild(b); }
        const pr = document.createElement('div'); pr.className = 'swatches'; pr.innerHTML = '<small>Paint रु 500:</small>';
        for (const c of S.PAINT) { if (c == null) continue; const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (owned.paint === c ? ' on' : ''); b.style.background = hex(c); b.setAttribute('aria-label', 'Paint ' + hex(c)); b.onclick = () => { paint(spec.id, c); KS.Game.refreshMenu(); }; pr.appendChild(b); }
        card.append(ups, hr, pr);
      }
      el.appendChild(card);
    }
  };
  S.renderWardrobe = (el) => {
    el.innerHTML = '';
    const sk = document.createElement('div'); sk.className = 'wslot'; sk.innerHTML = '<h4>Skin tone</h4>';
    const sw = document.createElement('div'); sw.className = 'swatches';
    for (const c of S.SKINS) { const b = document.createElement('button'); b.type = 'button'; b.className = 'sw' + (D.skin === c ? ' on' : ''); b.style.background = hex(c); b.setAttribute('aria-label', 'Skin tone'); b.onclick = () => { D.skin = c; S.save(); KS.Player.rebuild(); KS.Game.refreshMenu(); }; sw.appendChild(b); }
    sk.appendChild(sw); el.appendChild(sk);
    for (const [slot, label] of S.SLOTS) {
      const box = document.createElement('div'); box.className = 'wslot'; box.innerHTML = `<h4>${label}</h4>`;
      const row = document.createElement('div'); row.className = 'chips';
      for (const it of S.WARDROBE.filter((w) => w.slot === slot)) {
        const have = D.items.includes(it.id), b = document.createElement('button'); b.type = 'button'; b.className = 'chip' + (D.wear[slot] === it.id ? ' on' : '');
        const col = it.set.jacket || it.set.top || it.set.bottom || it.set.hatColor || it.set.helmet;
        b.innerHTML = `${col ? `<i class="dot" style="background:${hex(col)}"></i>` : ''}${it.name}${have ? '' : ` <small>🪙 ${it.tokens}</small>`}`;
        b.onclick = () => { wear(it); KS.Game.refreshMenu(); }; row.appendChild(b);
      }
      box.appendChild(row); el.appendChild(box);
    }
  };
})();
