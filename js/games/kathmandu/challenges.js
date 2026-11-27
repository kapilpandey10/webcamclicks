/* Kathmandu Streets — challenges, XP and ranks (round 20).
   Three daily challenges (new every day) and two weekly ones (new every
   Monday), picked from a pool that uses the whole city: the tram, the toll
   expressway, the walk-in homes, the skateboard, the bicycle, the Ring Road,
   Uthao rides, the petrol pumps and the snowy summit. Progress is tracked as
   you play (game events and distance travelled), saved with the rest of your
   data, and a finished challenge pays out cash and XP on the spot. XP builds
   your rank, shown on the dashboard. */
(function () {
  'use strict';
  const KS = window.KS;
  const C = (KS.Challenges = {});
  const DAILY = [
    { id: 'tram', ev: 'tram', n: 1, title: 'Ride the city tram', np: 'ट्राम चढ्नुहोस्', cash: 300, xp: 40, icon: '🚋' },
    { id: 'toll', ev: 'toll', n: 1, title: 'Take the City Expressway (pay a toll)', np: 'एक्सप्रेसवे चढ्नुहोस्', cash: 200, xp: 30, icon: '🛣️' },
    { id: 'sit', ev: 'sit', n: 1, title: 'Visit a home and sit down', np: 'घर भित्र बस्नुहोस्', cash: 150, xp: 20, icon: '🛋️' },
    { id: 'skate', ev: 'skate_m', n: 400, unit: 'm', title: 'Skate 400 m', np: '४०० मि. स्केट', cash: 300, xp: 40, icon: '🛹' },
    { id: 'cycle', ev: 'cycle_m', n: 2000, unit: 'm', title: 'Cycle 2 km', np: '२ कि.मि. साइकल', cash: 400, xp: 50, icon: '🚲' },
    { id: 'drive', ev: 'drive_m', n: 5000, unit: 'm', title: 'Drive 5 km', np: '५ कि.मि. ड्राइभ', cash: 400, xp: 50, icon: '🚗' },
    { id: 'express', ev: 'express_m', n: 3000, unit: 'm', title: 'Drive 3 km on the expressway', np: 'एक्सप्रेसवेमा ३ कि.मि.', cash: 500, xp: 60, icon: '🌉' },
    { id: 'ring', ev: 'ring_m', n: 4000, unit: 'm', title: 'Drive 4 km on the Ring Road', np: 'चक्रपथमा ४ कि.मि.', cash: 500, xp: 60, icon: '⭕' },
    { id: 'uthao', ev: 'uthao', n: 3, title: 'Finish 3 Uthao rides', np: '३ उठाओ यात्रा', cash: 600, xp: 70, icon: '📱' },
    { id: 'fuel', ev: 'fuel', n: 1, title: 'Fill up at a petrol pump', np: 'पेट्रोल भर्नुहोस्', cash: 150, xp: 20, icon: '⛽' },
    { id: 'peak', ev: 'peak', n: 1, title: 'Reach the snowy summit', np: 'हिउँ चुचुरोमा पुग्नुहोस्', cash: 500, xp: 60, icon: '🏔️' },
  ];
  const WEEKLY = [
    { id: 'w_drive', ev: 'drive_m', n: 30000, unit: 'm', title: 'Drive 30 km this week', np: '३० कि.मि.', cash: 2500, xp: 250, icon: '🚗' },
    { id: 'w_uthao', ev: 'uthao', n: 20, title: 'Finish 20 Uthao rides', np: '२० उठाओ यात्रा', cash: 3000, xp: 300, icon: '📱' },
    { id: 'w_cycle', ev: 'cycle_m', n: 10000, unit: 'm', title: 'Cycle 10 km this week', np: '१० कि.मि. साइकल', cash: 2000, xp: 200, icon: '🚲' },
    { id: 'w_tram', ev: 'tram', n: 5, title: 'Ride the tram 5 times', np: '५ पटक ट्राम', cash: 1500, xp: 150, icon: '🚋' },
    { id: 'w_express', ev: 'express_m', n: 15000, unit: 'm', title: 'Drive 15 km on the expressway', np: '१५ कि.मि. एक्सप्रेसवे', cash: 2500, xp: 250, icon: '🌉' },
  ];
  const RANKS = [[1, 'Naya Driver', 'नयाँ चालक'], [3, 'Galli Expert', 'गल्ली विज्ञ'], [5, 'Tempo Pro', 'टेम्पो प्रो'], [8, 'Ring Road Raja', 'चक्रपथ राजा'], [12, 'Valley Legend', 'उपत्यका किंवदन्ती']];

  const dayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
  const weekKey = (d = new Date()) => { const t = new Date(d); t.setHours(0, 0, 0, 0); t.setDate(t.getDate() - ((t.getDay() + 6) % 7)); return dayKey(t); }; // the Monday
  const seeded = (str) => { let h = 2166136261; for (const ch of str) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296; };
  const pick = (pool, k, key) => { const r = seeded(key), a = pool.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a.slice(0, k); };

  function state() {
    const D = KS.Shop && KS.Shop.data; if (!D) return null;
    const s = (D.ch = D.ch || { xp: 0, total: {}, done: 0 });
    const dk = dayKey(), wk = weekKey();
    if (s.day !== dk) { s.day = dk; s.daily = {}; s.dailyIds = pick(DAILY, 3, 'd' + dk).map((c) => c.id); }
    if (s.week !== wk) { s.week = wk; s.weekly = {}; s.weeklyIds = pick(WEEKLY, 2, 'w' + wk).map((c) => c.id); }
    return s;
  }
  C.level = (xp) => { let lv = 1; while (xp >= 50 * lv * (lv + 1)) lv++; return lv; };
  C.rank = (lv) => { let r = RANKS[0]; for (const q of RANKS) if (lv >= q[0]) r = q; return r; };
  const list = (s) => [...s.dailyIds.map((id) => [DAILY.find((c) => c.id === id), s.daily]), ...s.weeklyIds.map((id) => [WEEKLY.find((c) => c.id === id), s.weekly])];

  let dirty = 0;
  /** something happened: ev is the event name, amount how much */
  C.emit = (ev, amount = 1) => {
    const s = state(); if (!s) return;
    s.total[ev] = (s.total[ev] || 0) + amount;
    for (const [c, prog] of list(s)) {
      if (!c || c.ev !== ev) continue;
      const p = prog[c.id] || { v: 0, done: false };
      if (p.done) continue;
      p.v = Math.min(c.n, p.v + amount); prog[c.id] = p;
      if (p.v >= c.n) {
        p.done = true; s.done = (s.done || 0) + 1;
        const lv0 = C.level(s.xp); s.xp += c.xp; KS.Shop.data.cash += c.cash;
        KS.Game && KS.Game.notify(`🎯 <b>Challenge complete:</b> ${c.icon} ${c.title} — <b>+रु ${c.cash}</b> · +${c.xp} XP`, 'good');
        KS.audio && KS.audio.cash && KS.audio.cash();
        const lv1 = C.level(s.xp);
        if (lv1 > lv0) { const r = C.rank(lv1); setTimeout(() => KS.Game && KS.Game.notify(`⭐ <b>Level ${lv1}!</b> You are now a <b>${r[1]}</b> (${r[2]}).`, 'good'), 1800); }
        KS.Shop.save(); dirty = 0;
      }
    }
    dirty += 1;
  };
  /* distance: every frame, by how you are travelling */
  let last = null, saveT = 0;
  C.update = (dt) => {
    const PL = KS.Player; if (!PL || KS.state !== 'play') { last = null; return; }
    const here = { x: PL.x, z: PL.z };
    if (last) {
      const d = Math.hypot(here.x - last.x, here.z - last.z);
      if (d > 0.01 && d < 40) { // a jump of more than 40 m in a frame is a teleport, not travel
        const v = PL.vehicle;
        if (PL.mode === 'drive' && v) {
          if (v.kind === 'skateboard') C.emit('skate_m', d);
          else if (v.kind === 'bicycle') C.emit('cycle_m', d);
          else if (v.kind !== 'helicopter') {
            C.emit('drive_m', d);
            if (KS.onExpressway && KS.onExpressway(PL.x, PL.z, PL.y || 0)) C.emit('express_m', d);
            else if ((PL.y || 0) < 3 && KS.ringLoopDist(PL.x, PL.z) < 11.5) C.emit('ring_m', d);
          }
        }
      }
    }
    last = here;
    // the summit: within 120 m of the snow peak and near the top
    const P = KS.SNOWPEAK;
    if (P && !C._peakToday && Math.hypot(PL.x - P.x, PL.z - P.z) < 120 && (PL.y || 0) > KS.heightAt(P.x, P.z) - 45) { C._peakToday = true; C.emit('peak'); }
    saveT += dt; if (saveT > 10 && dirty) { saveT = 0; dirty = 0; KS.Shop.save(); }
  };

  /* ---------- the dashboard ---------- */
  const fmt = (c, v) => (c.unit === 'm' ? (c.n >= 1000 ? `${(v / 1000).toFixed(1)} / ${c.n / 1000} km` : `${Math.round(v)} / ${c.n} m`) : `${v} / ${c.n}`);
  C.render = () => {
    const s = state(); if (!s || typeof document === 'undefined') return;
    const $ = (id) => document.getElementById(id);
    const fill = (el, ids, pool, prog) => {
      if (!el) return;
      el.innerHTML = '';
      for (const id of ids) {
        const c = pool.find((q) => q.id === id); if (!c) continue;
        const p = prog[id] || { v: 0, done: false }, pct = Math.round((p.v / c.n) * 100);
        const li = document.createElement('li'); li.className = 'gd-ch' + (p.done ? ' done' : '');
        li.innerHTML = `<span class="gd-ch-ic" aria-hidden="true">${c.icon}</span><div class="gd-ch-b"><div class="gd-ch-t">${c.title} <span lang="ne">${c.np}</span></div><div class="gd-bar" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><i style="width:${pct}%"></i></div><div class="gd-ch-p">${p.done ? '✅ Done' : fmt(c, p.v)}</div></div><span class="gd-ch-r">+रु ${c.cash}<small>+${c.xp} XP</small></span>`;
        el.appendChild(li);
      }
    };
    fill($('chalDaily'), s.dailyIds, DAILY, s.daily);
    fill($('chalWeekly'), s.weeklyIds, WEEKLY, s.weekly);
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.max(0, Math.floor((mid - now) / 3600000)), mins = Math.max(0, Math.floor(((mid - now) % 3600000) / 60000));
    if ($('chalReset')) $('chalReset').textContent = `New in ${hrs} h ${mins} min`;
    const lv = C.level(s.xp), r = C.rank(lv), lo = 50 * (lv - 1) * lv, hi = 50 * lv * (lv + 1);
    if ($('gdLvl')) $('gdLvl').textContent = lv;
    if ($('gdRankName')) $('gdRankName').innerHTML = `${r[1]} <span lang="ne">${r[2]}</span>`;
    if ($('gdXpBar')) $('gdXpBar').style.width = Math.round(((s.xp - lo) / (hi - lo)) * 100) + '%';
    if ($('gdXpTxt')) $('gdXpTxt').textContent = `${s.xp - lo} / ${hi - lo} XP to level ${lv + 1}`;
    const D = KS.Shop.data, u = D.uthao || { trips: 0, earned: 0 }, T = s.total;
    if ($('gdStats')) $('gdStats').innerHTML = [
      ['Uthao rides', u.trips || 0], ['Earned on Uthao', 'रु ' + Math.round(u.earned || 0).toLocaleString('en-IN')],
      ['Driven', ((T.drive_m || 0) / 1000).toFixed(1) + ' km'], ['Cycled', ((T.cycle_m || 0) / 1000).toFixed(1) + ' km'],
      ['Skated', ((T.skate_m || 0) / 1000).toFixed(1) + ' km'], ['Challenges done', s.done || 0],
    ].map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('');
  };
})();
