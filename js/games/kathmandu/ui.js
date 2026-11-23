/* Kathmandu Streets — in-game smartphone (apps), settings, getting-started guide, opening cinematic. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => 'रु ' + Math.round(n).toLocaleString('en-IN');
  const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  /* ======================= settings ======================= */
  const S = (KS.Settings = {});
  S.data = () => { const d = KS.Shop.data; d.settings = Object.assign({ sens: 1, invertY: false, minimap: true, guide: true }, d.settings || {}); return d.settings; };
  S.render = (el) => {
    const A = KS.audio, st = S.data();
    const slider = (key, label, val, min = 0, max = 1, step = 0.05) => `<label class="set"><span>${label}</span><input type="range" min="${min}" max="${max}" step="${step}" value="${val}" data-set="${key}" aria-label="${label}"><output>${Math.round((val / max) * 100)}%</output></label>`;
    el.innerHTML = `<div class="setgrid">
      <h4>Sound</h4>
      ${slider('vol.master', 'Master volume', A.vol.master)}${slider('vol.music', 'Radio & music', A.vol.music)}${slider('vol.sfx', 'Sound effects', A.vol.sfx)}${slider('vol.amb', 'City ambience & weather', A.vol.amb)}${slider('vol.voice', 'Voices', A.vol.voice)}
      <label class="set tog"><input type="checkbox" data-set="mute" ${A.on ? '' : 'checked'}><span>Mute everything</span></label>
      <h4>Controls & display</h4>
      ${slider('sens', 'Look sensitivity', st.sens, 0.3, 2, 0.1)}
      <label class="set tog"><input type="checkbox" data-set="invertY" ${st.invertY ? 'checked' : ''}><span>Invert vertical look</span></label>
      <label class="set tog"><input type="checkbox" data-set="minimap" ${st.minimap ? 'checked' : ''}><span>Show minimap</span></label>
      <label class="set tog"><input type="checkbox" data-set="guide" ${st.guide ? 'checked' : ''}><span>Show the getting-started guide</span></label>
      <label class="set tog"><input type="checkbox" data-set="high" ${KS.quality.level === 'high' ? 'checked' : ''}><span>High graphics (shadows, more traffic) · reload to apply</span></label>
    </div>`;
    el.querySelectorAll('[data-set]').forEach((inp) => {
      inp.addEventListener('input', () => {
        const k = inp.dataset.set, v = inp.type === 'checkbox' ? inp.checked : +inp.value;
        if (k.startsWith('vol.')) { A.vol[k.slice(4)] = v; A.applyVolumes(); const o = inp.parentElement.querySelector('output'); if (o) o.textContent = Math.round((v / +inp.max) * 100) + '%'; return; }
        if (k === 'mute') { A.setOn(!v); return; }
        if (k === 'high') { KS.quality.level = v ? 'high' : 'low'; KS.Shop.data.quality = KS.quality.level; KS.Shop.save(); return; }
        st[k] = v; KS.Shop.save();
        if (k === 'sens') { const o = inp.parentElement.querySelector('output'); if (o) o.textContent = Math.round((v / 2) * 100) + '%'; }
        if (k === 'minimap') $('minimap').hidden = !v;
        if (k === 'guide') Guide.render();
      });
    });
  };

  /* ======================= getting started ======================= */
  const Guide = (KS.Guide = {});
  const STEPS = [
    { id: 'bike', text: 'Get on your <b>bicycle</b> (green marker) with <kbd>E</kbd>', done: () => Guide.flag('bike') },
    { id: 'phone', text: 'Open your <b>phone</b> with <kbd>Q</kbd>', done: () => Guide.flag('phone') },
    { id: 'licence', text: 'Get a bike <b>licence</b> at the Trial ground', nav: () => KS.trialGround && KS.Game.setWaypoint(KS.trialGround.counter.x, KS.trialGround.counter.z), done: () => KS.Law.data().lic.A },
    { id: 'job', text: 'Do a <b>delivery</b> or ride (Phone → Jobs or Uthao)', done: () => KS.Shop.data.uthao.trips > 0 || Guide.flag('momo') },
    { id: 'view', text: 'Take the lift up <b>Dharahara</b> for the view', nav: () => KS.dharahara && KS.Game.setWaypoint(KS.dharahara.x, KS.dharahara.z + 7), done: () => Guide.flag('lift') },
  ];
  Guide.flag = (k, set) => { const d = KS.Shop.data; d.guideFlags = d.guideFlags || {}; if (set) { d.guideFlags[k] = true; KS.Shop.save(); } return !!d.guideFlags[k]; };
  Guide.render = () => {
    const el = $('guide'); if (!el) return;
    const st = S.data(), todo = STEPS.filter((s) => !s.done());
    el.hidden = !st.guide || !todo.length || KS.state !== 'play';
    if (el.hidden) return;
    el.innerHTML = `<div class="gh"><b>Getting started</b><button type="button" id="guideHide" aria-label="Hide guide">×</button></div><ol>${STEPS.map((s) => `<li class="${s.done() ? 'done' : ''}">${s.text}${s.nav && !s.done() ? ` <button type="button" class="linkbtn" data-nav="${s.id}">Show me</button>` : ''}</li>`).join('')}</ol>`;
    $('guideHide').onclick = () => { st.guide = false; KS.Shop.save(); Guide.render(); };
    el.querySelectorAll('[data-nav]').forEach((b) => (b.onclick = () => { STEPS.find((s) => s.id === b.dataset.nav).nav(); KS.Game.notify('📍 Waypoint set. Follow the blue GPS line.'); }));
  };

  /* ======================= phone ======================= */
  const Ph = (KS.Phone = { open: false, app: null });
  const APPS = [
    { id: 'uthao', name: 'Uthao', icon: '🛵', color: '#0f8a7a' },
    { id: 'jobs', name: 'Jobs', icon: '💼', color: '#c8962a' },
    { id: 'map', name: 'Map', icon: '🗺️', color: '#2f7d32' },
    { id: 'radio', name: 'Radio', icon: '📻', color: '#c81e1e' },
    { id: 'licence', name: 'Licence', icon: '🪪', color: '#1d3a8a' },
    { id: 'garage', name: 'Garage', icon: '🔑', color: '#555a66' },
    { id: 'food', name: 'Food', icon: '🍎', color: '#b0472e' },
    { id: 'camera', name: 'Camera', icon: '📷', color: '#222831' },
    { id: 'friends', name: 'Friends', icon: '💬', color: '#6d1a8a' },
    { id: 'settings', name: 'Settings', icon: '⚙️', color: '#3a3a46' },
  ];
  Ph.init = () => {
    const home = $('phHome');
    home.innerHTML = APPS.map((a) => `<button type="button" class="app" data-app="${a.id}"><span style="background:${a.color}">${a.icon}</span>${a.name}</button>`).join('');
    home.querySelectorAll('[data-app]').forEach((b) => (b.onclick = () => Ph.openApp(b.dataset.app)));
    $('phoneTab').onclick = () => Ph.toggle();
    $('phBack').onclick = () => Ph.home();
  };
  Ph.toggle = (on) => {
    Ph.open = on == null ? !Ph.open : on;
    $('phone').classList.toggle('closed', !Ph.open);
    if (Ph.open) { Guide.flag('phone', true); if (document.exitPointerLock) document.exitPointerLock(); if (KS.Uthao.request && !Ph.app) Ph.openApp('uthao'); KS.audio.ding && KS.audio.ding(); }
  };
  Ph.home = () => { Ph.app = null; $('phHome').hidden = false; $('phApp').hidden = true; document.querySelectorAll('[data-app-panel]').forEach((p) => (p.hidden = true)); };
  Ph.openApp = (id) => {
    if (id === 'map') { const b = $('bigwrap'); b.hidden = false; KS.Game.drawBig(); return; }
    Ph.app = id; $('phHome').hidden = true; $('phApp').hidden = false;
    $('phAppTitle').textContent = APPS.find((a) => a.id === id).name;
    document.querySelectorAll('[data-app-panel]').forEach((p) => (p.hidden = p.dataset.appPanel !== id));
    Ph.refresh();
  };
  Ph.refresh = () => {
    const id = Ph.app, el = id && document.querySelector(`[data-app-panel="${id}"]`); if (!el) return;
    if (id === 'uthao') { KS.Uthao.render(); return; }
    if (id === 'licence') { KS.Law.renderCard(el); const b = document.createElement('button'); b.type = 'button'; b.className = 'btn small-btn'; b.textContent = 'Navigate to the licence office'; b.onclick = () => { KS.Game.setWaypoint(KS.trialGround.counter.x, KS.trialGround.counter.z); KS.Game.notify('📍 Follow the blue line to the Trial ground. Press E at the counter.'); }; el.appendChild(b); return; }
    if (id === 'settings') { S.render(el); return; }
    if (id === 'friends') { KS.Net ? KS.Net.render(el) : (el.textContent = 'Multiplayer is loading…'); return; }
    if (id === 'radio') {
      const R = KS.Radio, all = R.all();
      el.innerHTML = `<p class="ph-muted">${R.status === 'ready' ? 'Live from Nepal via Radio Browser.' : R.status === 'loading' ? 'Finding live stations…' : 'Live stations unavailable. Built-in stations still play.'}</p>
        <label class="set tog"><input type="checkbox" id="phEar" ${R.onFoot ? 'checked' : ''}><span>Play on earphones while walking</span></label>
        <label class="set"><span>Volume</span><input type="range" id="phVol" min="0" max="1" step="0.05" value="${KS.audio.vol.music}" aria-label="Radio volume"></label>
        <button type="button" class="btn ghost small-btn" id="phOff">Radio off</button><div class="stnlist">${all.map((st, i) => `<button type="button" class="stn ${R.idx === i ? 'on' : ''}" data-i="${i}"><b>${st.live ? '🔴 ' : '🎵 '}${esc(st.name)}</b><small>${esc(st.live ? [st.city, st.tags].filter(Boolean).join(' · ') : st.genre + ' · made in-game')}</small></button>`).join('')}</div>`;
      $('phEar').onchange = (e) => { R.onFoot = e.target.checked; R.volume(); if (R.onFoot && R.el && R.current() && R.current().live) { const p = R.el.play(); if (p && p.catch) p.catch(() => {}); } };
      $('phVol').oninput = (e) => { KS.audio.vol.music = +e.target.value; KS.audio.applyVolumes(); };
      $('phOff').onclick = () => { R.stop(); Ph.refresh(); };
      el.querySelectorAll('[data-i]').forEach((b) => (b.onclick = () => { KS.audio.init(); R.play(+b.dataset.i); Ph.refresh(); }));
      return;
    }
    if (id === 'jobs') {
      const m = KS.Game.mission;
      el.innerHTML = `<div class="joblist">
        <div class="job"><b>🥟 Momo House delivery</b><small>Pick up hot momos in Thamel and deliver them before they go cold. On foot, bicycle or bike.</small>${m ? '<em>In progress</em>' : `<button type="button" class="btn small-btn" data-job="momo">Take the job</button>`}</div>
        <div class="job"><b>🛵 Uthao rides & parcels</b><small>Passengers and parcels across town and to Dhunibesi. Needs the right licence; bicycles can carry food and documents.</small><button type="button" class="btn small-btn" data-job="uthao">Open Uthao</button></div>
        <div class="job"><b>🪪 Driving licence test</b><small>Written test and trial at the Transport Management Office.</small><button type="button" class="btn small-btn" data-job="licence">Navigate</button></div>
      </div>`;
      el.querySelectorAll('[data-job]').forEach((b) => (b.onclick = () => { const j = b.dataset.job; if (j === 'momo') KS.Game.acceptMomo(); if (j === 'uthao') Ph.openApp('uthao'); if (j === 'licence') { KS.Game.setWaypoint(KS.trialGround.counter.x, KS.trialGround.counter.z); KS.Game.notify('📍 Follow the blue line to the Trial ground.'); } Ph.refresh(); }));
      return;
    }
    if (id === 'garage') {
      const D = KS.Shop.data;
      el.innerHTML = `<p class="ph-muted">Your vehicles are brought to the kerb beside you.</p>${D.garage.map((g) => { const sp = KS.Shop.spec(g.id); const need = KS.licenseFor(sp.model); return `<div class="job"><b>${sp.name}</b><small>${need ? 'Needs licence ' + need + (KS.Law.data().lic[need] ? ' ✔' : ' ✖') : 'No licence needed'}</small><button type="button" class="btn small-btn" data-bring="${g.id}">Bring it here</button></div>`; }).join('')}<button type="button" class="btn ghost small-btn" id="phShop">Showroom & upgrades</button>`;
      el.querySelectorAll('[data-bring]').forEach((b) => (b.onclick = () => KS.Shop.deliver(b.dataset.bring)));
      $('phShop').onclick = () => KS.Game.openTab('garage');
      return;
    }
    if (id === 'food') {
      const P = KS.Player;
      el.innerHTML = `<p>Health: <b>${Math.round(P.health)}%</b></p><p class="ph-muted">Fruit stalls with coloured umbrellas line the pavements. Walk up to one and press <kbd>E</kbd> to buy fruit.</p><button type="button" class="btn small-btn" id="phFruit">Navigate to the nearest fruit stall</button>`;
      $('phFruit').onclick = () => { let best = null, bd = 1e9; for (const [x, z] of KS.fruitStalls) { const d = Math.hypot(x - P.x, z - P.z); if (d < bd) { bd = d; best = [x, z]; } } if (best) { KS.Game.setWaypoint(best[0], best[1]); KS.Game.notify(`🍎 Fruit stall ${Math.round(bd)} m away.`); } };
      return;
    }
    if (id === 'camera') {
      el.innerHTML = `<div class="req-btns"><button type="button" class="btn small-btn" id="phPhoto">📷 Photo <kbd>J</kbd></button><button type="button" class="btn small-btn" id="phRec">${KS.Game.Rec.on ? '⏹ Stop' : '⏺ Record'} <kbd>K</kbd></button></div><p class="ph-muted">Camera angle (<kbd>V</kbd>):</p><div class="chips">${KS.CAMS.map((n, i) => `<button type="button" class="chip ${KS.Cam.mode === i ? 'on' : ''}" data-cam="${i}">${n}</button>`).join('')}</div>`;
      $('phPhoto').onclick = () => KS.Game.Rec.photo(); $('phRec').onclick = () => { KS.Game.Rec.toggle(); Ph.refresh(); };
      el.querySelectorAll('[data-cam]').forEach((b) => (b.onclick = () => { KS.Player.setCam(+b.dataset.cam); Ph.refresh(); }));
    }
  };
  Ph.tick = () => {
    const t = KS.time, h = Math.floor(t), m = Math.floor((t - h) * 60);
    $('phTime').textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    const badge = $('phBadge'), req = KS.Uthao.request;
    badge.hidden = !req && !(KS.Net && KS.Net.unread);
    badge.textContent = req ? '1' : KS.Net && KS.Net.unread ? String(KS.Net.unread) : '';
  };

  /* ======================= opening cinematic ======================= */
  const C = (KS.Cine = { on: false });
  const SHOTS = [
    { a: [-900, 260, -500], b: [-300, 160, -360], la: [-150, 20, -250], lb: [-140, 10, -250], d: 6, cap: ['काठमाडौं', 'Kathmandu, Nepal'] },
    { a: [470, 60, -160], b: [340, 45, -290], la: [405, 18, -225], lb: [405, 18, -225], d: 5.5, cap: ['बौद्धनाथ', 'Boudhanath'] },
    { a: [-200, 40, 200], b: [-90, 26, 10], la: [-135, 8, 100], lb: [-130, 8, 60], d: 5.5, cap: ['बसन्तपुर', 'Basantapur Durbar Square'] },
    { a: [-100, 30, -300], b: null, la: [-130, 1, -262], lb: null, d: 4.5, cap: ['ठमेल', 'Your story starts in Thamel'] },
  ];
  const v3 = (a) => new T.Vector3(a[0], a[1], a[2]);
  C.play = (done) => {
    C.on = true; C.i = 0; C.t = 0; C.done = done; KS.state = 'cine';
    $('cine').hidden = false; caption(0);
  };
  function caption(i) { const s = SHOTS[i]; $('cineNp').textContent = s.cap[0]; $('cineEn').textContent = s.cap[1]; const c = $('cineCap'); c.classList.remove('in'); void c.offsetWidth; c.classList.add('in'); }
  C.skip = () => { if (!C.on) return; C.on = false; $('cine').hidden = true; KS.state = 'play'; C.done && C.done(); };
  C.update = (dt, cam) => {
    const P = KS.Player, s = SHOTS[C.i];
    C.t += dt; const u = KS.smooth(0, 1, C.t / s.d);
    const a = v3(s.a), b = s.b ? v3(s.b) : new T.Vector3(P.x - Math.sin(KS.Cam.yaw) * 7, P.y + 3.4, P.z - Math.cos(KS.Cam.yaw) * 7);
    const la = v3(s.la), lb = s.lb ? v3(s.lb) : new T.Vector3(P.x, P.y + 1.4, P.z);
    cam.position.copy(a.lerp(b, u)); cam.lookAt(la.lerp(lb, u));
    if (C.t >= s.d) { C.i++; C.t = 0; if (C.i >= SHOTS.length) return C.skip(); caption(C.i); }
  };
})();
