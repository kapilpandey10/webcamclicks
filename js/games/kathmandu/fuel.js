/* Kathmandu Streets — fuel: petrol stations on street corners and the Ring
   Road, a fuel gauge per vehicle, refuelling, and a fuel-delivery call when
   you run dry. Bicycles need no fuel; the helicopter is exempt (it does not
   land at a petrol pump). */
const F = (KS.Fuel = { stations: [], delivery: null });

/* where the pumps are: three in the city, three just outside the Ring Road
   (the forecourt sits on the outer side of the loop, with its entrance on
   the loop itself). x, z is the centre of the forecourt. */
F.SPOTS = [
  /* the city stations sit on clear corner lots just off the road — NOT in
     the middle of a block, where the forecourt would land on top of houses.
     (Thamel was (-70,-200) and Airport Road was (340,20); both overlapped
     buildings, caught by the round-8 harness.) */
  { x: -75, z: -350, name: 'Thamel Petrol', np: 'ठमेल पेट्रोल' },
  { x: -160, z: 110, name: 'New Road Petrol', np: 'न्यु रोड पेट्रोल' },
  { x: 405, z: 105, name: 'Airport Road Petrol', np: 'एयरपोर्ट रोड पेट्रोल' },
  { x: -190, z: -630, name: 'Samakhusi Petrol', np: 'सामाखुसी पेट्रोल' },
  { x: 480, z: 590, name: 'Kupondole Petrol', np: 'कुपण्डोल पेट्रोल' },
  { x: -590, z: 120, name: 'Kalanki Petrol', np: 'कलंकी पेट्रोल' },
];
/* how much a litre-point costs to refill, by vehicle class (a full tank from
   empty: car ~रु 700, bike ~रु 300, truck/bus ~रु 1000) */
F.PRICE = { bike: 3, car: 7, van: 8, bus: 10, cargo: 8 };
F.DELIVERY_COST = 500; F.DELIVERY_FUEL = 30; F.DELIVERY_WAIT = 10;
/* fuel use: % of a tank per metre driven at full chat. A full tank lasts
   roughly 10 km of driving. Bikes sip (×0.6), trucks and buses gulp (×1.5). */
F.USE = 0.01;
F.mult = (kind) => (KS.isBike && KS.isBike(kind) ? 0.6 : ['truck', 'bus', 'minibus'].includes(kind) ? 1.5 : 1);
F.priceFor = (kind) => {
  const seats = (KS.VTYPES[kind] || {}).seats;
  if (KS.isBike && KS.isBike(kind)) return F.PRICE.bike;
  if (seats === 'bus') return F.PRICE.bus;
  if (seats === 'van') return F.PRICE.van;
  return F.PRICE.car;
};
/* bicycles and the helicopter do not use fuel */
F.needsFuel = (kind) => kind !== 'bicycle' && kind !== 'helicopter';
/* the fuel of the player's current vehicle (0-100), or null when it does not
   use fuel / the player is on foot */
F.of = (v) => {
  if (!v || !F.needsFuel(v.kind)) return null;
  if (v.fuel == null) v.fuel = 100;
  return v.fuel;
};
/* burn fuel while driving; returns true the moment the tank runs dry */
F.burn = (v, dt, speed) => {
  if (!v || !F.needsFuel(v.kind) || v.fuel == null) return false;
  if (speed < 0.5) return false;
  v.fuel = Math.max(0, v.fuel - Math.abs(speed) * dt * F.USE * F.mult(v.kind));
  if (v.fuel <= 0) { v.fuel = 0; return true; }
  return false;
};
F.nearest = (x, z, r = 16) => {
  let best = null, bd = r;
  for (const s of F.stations) { const d = Math.hypot(s.x - x, s.z - z); if (d < bd) { bd = d; best = s; } }
  return best;
};
F.refuelCost = (v) => {
  if (!v || v.fuel == null) return 0;
  return Math.round((100 - v.fuel) * F.priceFor(v.kind));
};
/* fill the tank. Returns the cost, or -1 when there is nothing to fill. */
F.refuel = (v) => {
  if (!v || v.fuel == null || v.fuel >= 99.5) return -1;
  const cost = F.refuelCost(v);
  if (KS.Shop.data.cash < cost) return -2;
  KS.Shop.data.cash -= cost; v.fuel = 100; KS.Shop.save();
  return cost;
};
/* out of fuel on the road: call a fuel delivery (रु 500, +30% in 10 s) */
F.callDelivery = () => {
  const v = KS.Player.vehicle;
  if (!v || !F.needsFuel(v.kind) || F.delivery) return false;
  if (KS.Shop.data.cash < F.DELIVERY_COST) { KS.Game.notify('⛽ Fuel delivery costs रु 500 — you do not have it.', 'bad'); return false; }
  KS.Shop.data.cash -= F.DELIVERY_COST; KS.Shop.save();
  F.delivery = { t: F.DELIVERY_WAIT };
  KS.Game.notify(`📞 Fuel delivery called — a tempo is bringing petrol (रु ${F.DELIVERY_COST}). ${F.DELIVERY_WAIT} seconds…`);
  return true;
};
F.update = (dt) => {
  if (!F.delivery) return;
  F.delivery.t -= dt;
  if (F.delivery.t > 0) return;
  F.delivery = null;
  const v = KS.Player.vehicle;
  if (v && F.needsFuel(v.kind)) { v.fuel = Math.min(100, (v.fuel || 0) + F.DELIVERY_FUEL); KS.Game.notify(`⛽ Fuel delivery arrived! +${F.DELIVERY_FUEL}% fuel.`, 'good'); }
};
/* a station: forecourt, canopy on four posts, two pumps, a sign. The posts
   and pumps are solid so you cannot drive through them. */
F.build = (scene) => {
  const T = KS.THREE || window.THREE;
  for (const s of F.SPOTS) {
    const b = new KS.Builder();
    const y = KS.heightAt(s.x, s.z);
    // forecourt pad
    b.box(s.x, y, s.z, 22, 0.12, 15, 0x8f8f8f);
    // canopy: four posts and a flat roof with a red band
    for (const [ox, oz] of [[-9, -5], [9, -5], [-9, 5], [9, 5]]) {
      b.box(s.x + ox, y, s.z + oz, 0.5, 5.2, 0.5, 0xdddddd);
      KS.addBox(s.x + ox, s.z + oz, 0.7, 0.7, y + 5.2);
    }
    b.box(s.x, y + 5.2, s.z, 20, 0.5, 12, 0xc8102e);
    b.box(s.x, y + 5.5, s.z, 20, 0.3, 12, 0xffffff);
    // two pumps
    for (const ox of [-4, 4]) {
      b.box(s.x + ox, y, s.z, 1.1, 1.5, 0.7, 0xd8232a);
      b.box(s.x + ox, y + 0.9, s.z + 0.36, 0.7, 0.5, 0.05, 0x111111);
      KS.addBox(s.x + ox, s.z, 1.3, 0.9, y + 1.5);
    }
    // sign: ⛽ PETROL on the canopy front
    const sign = new T.Mesh(new T.PlaneGeometry(6, 1.8), new T.MeshLambertMaterial({ side: T.DoubleSide, map: KS.tex(512, 160, (g, ww, hh) => { g.fillStyle = '#c8102e'; g.fillRect(0, 0, ww, hh); g.strokeStyle = '#fff'; g.lineWidth = 6; g.strokeRect(8, 8, ww - 16, hh - 16); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `700 64px ${KS.FONT}`; g.fillText('⛽ पेट्रोल', ww / 2, 74); g.font = '700 36px "Barlow Condensed", sans-serif'; g.fillText('PETROL', ww / 2, 128); }) }));
    sign.position.set(s.x, y + 6.4, s.z + 6.1); scene.add(sign);
    scene.add(KS.mesh(b));
    F.stations.push({ x: s.x, z: s.z, y, name: s.name, np: s.np });
    if (KS.landmarks) KS.landmarks.push({ id: 'petrol-' + s.name.replace(/\W+/g, '-').toLowerCase(), name: s.name + ' ⛽', np: s.np, x: s.x, z: s.z, r: 12, fact: 'Petrol pump. Drive in and press E to fill up.' });
  }
};
