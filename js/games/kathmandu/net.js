/* Kathmandu Streets — multiplayer with PeerJS (WebRTC): private rooms by code, players see each other,
   text chat, and optional microphone voice chat that gets quieter with distance.
   Signalling uses the free PeerJS cloud server; game data and voice go peer to peer. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const PREFIX = 'kstreets-room-', MAX = 8;
  const N = (KS.Net = { state: 'off', room: '', players: new Map(), conns: new Map(), calls: new Map(), chat: [], unread: 0, mic: null, micOn: false, ptt: false, proximity: true, sendT: 0, lastMsg: 0 });

  function options() {
    const q = new URLSearchParams(location.search), o = {};
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 443); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') !== '0'; }
    return o;
  }
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEERJS; s.onload = res; s.onerror = () => rej(new Error('Could not load PeerJS')); document.head.appendChild(s); });
  }
  const code = () => Array.from({ length: 5 }, () => 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'[Math.floor(Math.random() * 30)]).join('');
  N.name = () => { const d = KS.Shop.data; return d.netName || (d.netName = 'Rider' + Math.floor(100 + Math.random() * 900)); };

  /* ---------- connect ---------- */
  N.create = async () => {
    if (N.state !== 'off') return;
    N.state = 'connecting'; N.render2();
    try { await loadLib(); } catch (e) { N.fail(e.message); return; }
    N.room = code(); N.host = true;
    const peer = (N.peer = new window.Peer(PREFIX + N.room.toLowerCase(), options()));
    peer.on('open', () => { N.state = 'host'; N.me = peer.id; sys(`Room ${N.room} created. Share the code with friends.`); N.render2(); });
    peer.on('connection', (c) => { if (N.conns.size >= MAX - 1) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } wire(c); });
    common(peer);
  };
  N.join = async (room) => {
    room = String(room || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (N.state !== 'off' || room.length < 4) { if (room.length < 4) KS.Game.notify('Enter the 5-character room code.', 'bad'); return; }
    N.state = 'connecting'; N.render2();
    try { await loadLib(); } catch (e) { N.fail(e.message); return; }
    N.room = room; N.host = false;
    const peer = (N.peer = new window.Peer(undefined, options()));
    peer.on('open', () => { N.me = peer.id; const c = peer.connect(PREFIX + room.toLowerCase(), { reliable: true }); wire(c); N.hostId = c.peer; });
    common(peer);
  };
  function common(peer) {
    peer.on('error', (e) => {
      const t = e && e.type;
      N.fail(t === 'unavailable-id' ? 'That room code is taken. Try again.' : t === 'peer-unavailable' ? 'Room not found. Check the code.' : t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the multiplayer server.' : 'Multiplayer error: ' + (t || e));
    });
    peer.on('call', (call) => {
      const mine = N.calls.get(call.peer);
      if (mine && N.me < call.peer) { call.close(); return; }
      if (mine) mine.close();
      call.answer(N.mic || undefined); hookCall(call);
    });
    peer.on('disconnected', () => { if (N.state !== 'off') sys('Connection to the server dropped. Players already here stay connected.'); });
  }
  N.fail = (msg) => { KS.Game.notify('💬 ' + msg, 'bad'); N.leave(true); };
  function wire(c) {
    c.on('open', () => {
      N.conns.set(c.peer, c);
      c.send({ t: 'hello', name: N.name(), look: look() });
      if (!N.host) { N.state = 'guest'; sys(`Joined room ${N.room}.`); }
      N.render2(); if (N.micOn) callAll();
    });
    c.on('data', (m) => onData(c, m));
    c.on('close', () => { N.conns.delete(c.peer); if (!N.host && c.peer === N.hostId) { sys('The host left. The room has closed.'); N.leave(true); return; } dropPlayer(c.peer); if (N.host) broadcast({ t: 'bye', id: c.peer }); roster(); });
    c.on('error', () => {});
  }
  function broadcast(m, except) { for (const [id, c] of N.conns) if (id !== except && c.open) c.send(m); }
  function roster() { if (!N.host) return; const list = [{ id: N.me, name: N.name() }].concat([...N.players.values()].map((p) => ({ id: p.id, name: p.name }))); broadcast({ t: 'roster', list }); N.roster = list; N.render2(); }
  function onData(c, m) {
    if (!m || typeof m !== 'object') return;
    const from = N.host ? c.peer : m.id || c.peer;
    switch (m.t) {
      case 'full': N.fail('That room is full (8 players).'); break;
      case 'hello': if (N.host) { upsert(c.peer, { name: clean(m.name, 16), look: m.look }); sys(`${clean(m.name, 16)} joined.`); roster(); } break;
      case 'roster': N.roster = (m.list || []).slice(0, MAX); for (const r of N.roster) if (r.id !== N.me) upsert(r.id, { name: clean(r.name, 16) }); for (const id of [...N.players.keys()]) if (!N.roster.some((r) => r.id === id)) dropPlayer(id); N.render2(); if (N.micOn) callAll(); break;
      case 's': if (from === N.me) break; upsert(from, m); if (N.host) broadcast({ ...m, id: c.peer }, c.peer); break;
      case 'c': { if (from === N.me) break; const p = N.players.get(from), name = p ? p.name : clean(m.name, 16); addChat(name, clean(m.text, 200), from); if (N.host) broadcast({ t: 'c', id: c.peer, name, text: clean(m.text, 200) }, c.peer); break; }
      case 'bye': dropPlayer(m.id); N.render2(); break;
    }
  }
  const clean = (t, n) => String(t || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n);
  function look() { const o = KS.Player.person && KS.Player.person.cfg; return o ? { top: o.topStyle === 'jacket' ? o.jacket : o.top, bottom: o.bottom, skin: o.skin, hat: o.hat, hatColor: o.hatColor, topStyle: o.topStyle } : null; }

  /* ---------- remote players ---------- */
  function upsert(id, m) {
    let p = N.players.get(id);
    if (!p) { p = { id, name: m.name || 'Player', x: 0, y: 0, z: 0, h: 0, tx: 0, ty: 0, tz: 0, th: 0, v: '', root: new T.Group(), seen: KS.clock }; KS.scene.add(p.root); N.players.set(id, p); makeTag(p); }
    if (m.name) p.name = clean(m.name, 16);
    if (m.look && !p.person) p.look = m.look;
    if (m.x != null) { p.tx = m.x; p.ty = m.y; p.tz = m.z; p.th = m.h; p.seen = KS.clock; if (!p.placed) { p.x = m.x; p.y = m.y; p.z = m.z; p.h = m.h; p.placed = true; } }
    if (m.look) p.look = m.look;
    if (!p.person) buildAvatar(p);
    if (m.v != null && m.v !== p.v) setVehicle(p, m.v);
    p.speaking = !!m.talk;
  }
  function buildAvatar(p) {
    const o = KS.outfitFor('man'), L = p.look || {};
    Object.assign(o, { skin: L.skin || o.skin, topStyle: L.topStyle || 'jacket', jacket: L.top || 0x6d1a8a, top: L.top || 0x6d1a8a, bottom: L.bottom || o.bottom, hat: L.hat || null, hatColor: L.hatColor || 0 });
    if (p.person) p.root.remove(p.person.root);
    p.person = KS.makePerson('man', o); p.root.add(p.person.root);
  }
  function setVehicle(p, kind) {
    if (p.veh) { p.root.remove(p.veh.root); p.veh = null; }
    p.v = kind;
    if (kind && KS.VTYPES[kind]) { p.veh = KS.buildVehicle(kind, { rider: false, conductor: false }); p.root.add(p.veh.root); }
    const bike = kind && KS.isBike(kind);
    p.person.root.visible = !kind || bike;
    if (bike) { p.person.root.position.set(0, 0.18, -0.32); KS.animSit(p.person); p.person.armL.rotation.x = p.person.armR.rotation.x = -1.2; }
    else { p.person.root.position.set(0, 0, 0); p.person.legL.rotation.x = p.person.legR.rotation.x = 0; }
  }
  function dropPlayer(id) { const p = N.players.get(id); if (!p) return; KS.scene.remove(p.root); p.tag && p.tag.remove(); const c = N.calls.get(id); if (c) c.close(); N.players.delete(id); }
  function makeTag(p) { const el = document.createElement('div'); el.className = 'nametag'; ($('nameTags') || document.body).appendChild(el); p.tag = el; }

  /* ---------- chat ---------- */
  function sys(text) { addChat('', text, null, true); }
  function addChat(name, text, from, system) {
    N.chat.push({ name, text, system, t: Date.now() }); if (N.chat.length > 60) N.chat.shift();
    if (!(KS.Phone && KS.Phone.open && KS.Phone.app === 'friends')) N.unread++;
    const f = $('chatFeed');
    if (f) { const d = document.createElement('div'); d.className = 'cm' + (system ? ' sys' : ''); d.innerHTML = system ? esc(text) : `<b>${esc(name)}</b> ${esc(text)}`; f.appendChild(d); setTimeout(() => d.classList.add('out'), 9000); setTimeout(() => d.remove(), 9600); while (f.children.length > 6) f.firstChild.remove(); }
    const p = from && N.players.get(from); if (p && p.person) KS.say(p.person.root, text, 4);
    if (!system) KS.audio.ding && KS.audio.ding();
    N.renderLog();
  }
  N.send = (text) => {
    text = clean(text, 200).trim(); if (!text || N.state === 'off' || N.state === 'connecting') return;
    if (Date.now() - N.lastMsg < 700) return; N.lastMsg = Date.now();
    const m = { t: 'c', id: N.me, name: N.name(), text };
    if (N.host) broadcast(m); else { const c = N.conns.get(N.hostId); c && c.open && c.send(m); }
    addChat(N.name() + ' (you)', text); N.unread = 0;
    KS.say(KS.Player.person.root, text, 4, 'calm');
  };

  /* ---------- voice ---------- */
  N.toggleMic = async () => {
    if (N.micOn) { N.micOn = false; if (N.mic) N.mic.getTracks().forEach((t) => t.stop()); N.mic = null; for (const c of N.calls.values()) c.close(); N.calls.clear(); sys('Microphone off.'); N.render2(); return; }
    try {
      N.mic = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
      N.micOn = true; setTalking(!N.ptt); sys(N.ptt ? 'Microphone on. Hold G to talk.' : 'Microphone on: open mic.'); callAll(); N.render2();
    } catch (e) { KS.Game.notify('Microphone not available: ' + (e.message || e.name), 'bad'); }
  };
  function setTalking(on) { N.talking = on; if (N.mic) N.mic.getAudioTracks().forEach((t) => (t.enabled = on)); }
  N.setPtt = (on) => { N.ptt = on; setTalking(!on); N.render2(); };
  function callAll() {
    if (!N.peer || !N.mic) return;
    const ids = (N.roster || []).map((r) => r.id).concat([...N.players.keys()]);
    for (const id of new Set(ids)) if (id && id !== N.me && !N.calls.has(id)) hookCall(N.peer.call(id, N.mic));
  }
  function hookCall(call) {
    if (!call) return;
    N.calls.set(call.peer, call);
    call.on('stream', (stream) => {
      const p = N.players.get(call.peer); if (!p) return;
      KS.audio.init(); const ctx = KS.audio.ctx; if (!ctx) return;
      const el = new Audio(); el.srcObject = stream; el.muted = true; const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
      const src = ctx.createMediaStreamSource(stream), g = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
      src.connect(an); src.connect(g).connect(KS.audio.bus.voice);
      if (p.voice) { try { p.voice.src.disconnect(); } catch (e) { /* ignore */ } }
      p.voice = { el, src, g, an, buf: new Uint8Array(an.frequencyBinCount) };
    });
    call.on('close', () => { if (N.calls.get(call.peer) === call) N.calls.delete(call.peer); });
    call.on('error', () => {});
  }

  N.leave = (silent) => {
    for (const c of N.calls.values()) try { c.close(); } catch (e) { /* ignore */ }
    for (const c of N.conns.values()) try { c.close(); } catch (e) { /* ignore */ }
    N.calls.clear(); N.conns.clear();
    for (const id of [...N.players.keys()]) dropPlayer(id);
    if (N.peer) try { N.peer.destroy(); } catch (e) { /* ignore */ }
    if (N.mic) N.mic.getTracks().forEach((t) => t.stop());
    N.peer = null; N.mic = null; N.micOn = false; N.state = 'off'; N.room = ''; N.roster = null;
    if (!silent) sys('You left the room.');
    N.render2();
  };

  /* ---------- per frame ---------- */
  const v = new T.Vector3();
  N.update = (dt, camera) => {
    if (N.state === 'off' || N.state === 'connecting') return;
    const P = KS.Player, I = KS.Input;
    if (N.micOn && N.ptt) setTalking(!!I.down('KeyG'));
    N.sendT -= dt;
    if (N.sendT <= 0) {
      N.sendT = 0.1;
      const m = { t: 's', id: N.me, name: N.name(), x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), h: +(P.vehicle ? P.vehicle.h : P.h).toFixed(3), v: P.vehicle ? P.vehicle.kind : '', talk: N.micOn && N.talking, look: KS.clock % 3 < 0.1 ? look() : undefined };
      if (N.host) broadcast(m); else { const c = N.conns.get(N.hostId); c && c.open && c.send(m); }
    }
    for (const p of N.players.values()) {
      const k = Math.min(1, dt * 10);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.h = KS.angLerp(p.h, p.th, k);
      const mv = Math.hypot(p.tx - p.x, p.tz - p.z);
      p.root.position.set(p.x, p.y + (p.v ? 0.02 : 0), p.z); p.root.rotation.y = p.h;
      if (!p.v && p.person) KS.animWalk(p.person, dt, mv > 0.05 ? Math.min(8, mv * 10) : 0);
      const d = Math.hypot(p.x - P.x, p.z - P.z);
      if (p.voice) {
        p.voice.g.gain.value = N.proximity ? KS.clamp(1.2 - d / 55, 0, 1) : 1;
        p.voice.an.getByteFrequencyData(p.voice.buf); let s = 0; for (const b of p.voice.buf) s += b; p.loud = s / p.voice.buf.length > 18;
      }
      // name tag
      const tag = p.tag; v.set(p.x, p.y + (p.v && !KS.isBike(p.v) ? 2.6 : 2.25), p.z).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && d < 160;
      tag.style.display = vis ? 'block' : 'none';
      if (vis) { tag.textContent = (p.loud || p.speaking ? '🔊 ' : '') + p.name + (d > 25 ? ` · ${Math.round(d)} m` : ''); tag.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`; }
    }
  };

  /* ---------- UI (phone "Friends" app) ---------- */
  N.render = (el) => { N.el = el; N.unread = 0; N.render2(); };
  N.render2 = () => {
    const el = N.el; if (!el || !el.isConnected || (KS.Phone && KS.Phone.app !== 'friends')) { KS.Phone && KS.Phone.tick && KS.Phone.tick(); return; }
    const on = N.state === 'host' || N.state === 'guest';
    const players = [{ name: N.name() + ' (you)' }].concat([...N.players.values()]);
    el.innerHTML = on ? `
      <div class="roomcode"><span>Room</span><b>${N.room}</b><button type="button" class="chip" id="netCopy">Copy</button></div>
      <p class="ph-muted">${players.length} / ${MAX} players: ${players.map((p) => esc(p.name)).join(', ')}</p>
      <div class="req-btns"><button type="button" class="btn small-btn ${N.micOn ? '' : 'ghost'}" id="netMic">${N.micOn ? '🎙 Mic on' : '🎙 Turn mic on'}</button>
      <label class="set tog"><input type="checkbox" id="netPtt" ${N.ptt ? 'checked' : ''}><span>Push to talk (hold G)</span></label></div>
      <label class="set tog"><input type="checkbox" id="netProx" ${N.proximity ? 'checked' : ''}><span>Voices get quieter with distance</span></label>
      <div class="chatlog" id="netLog"></div>
      <form id="netForm" class="chatform"><input id="netText" maxlength="200" placeholder="Message… (Enter)" autocomplete="off" aria-label="Chat message"><button type="submit" class="btn small-btn">Send</button></form>
      <button type="button" class="btn ghost small-btn" id="netLeave">Leave room</button>`
      : `<p>Play with friends: one person creates a room and shares the 5-letter code.</p>
      <label class="set"><span>Your name</span><input id="netName" maxlength="16" value="${esc(N.name())}" aria-label="Your name"></label>
      <div class="req-btns"><button type="button" class="btn small-btn" id="netCreate" ${N.state === 'connecting' ? 'disabled' : ''}>${N.state === 'connecting' ? 'Connecting…' : 'Create room'}</button></div>
      <form id="netJoinForm" class="chatform"><input id="netCode" maxlength="6" placeholder="Room code" autocomplete="off" aria-label="Room code" style="text-transform:uppercase"><button type="submit" class="btn small-btn">Join</button></form>
      <p class="ph-muted small">Rooms are private: only people with the code can join. Only share it with people you know. Connections are set up through the free PeerJS server; positions, chat and voice then go directly between players. The microphone is used only after you turn it on.</p>`;
    const b = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
    b('netCreate', () => { const n = $('netName'); if (n && n.value.trim()) { KS.Shop.data.netName = clean(n.value.trim(), 16); KS.Shop.save(); } N.create(); });
    const jf = $('netJoinForm'); if (jf) jf.onsubmit = (e) => { e.preventDefault(); const n = $('netName'); if (n && n.value.trim()) { KS.Shop.data.netName = clean(n.value.trim(), 16); KS.Shop.save(); } N.join($('netCode').value); };
    b('netLeave', () => N.leave()); b('netMic', () => N.toggleMic());
    b('netCopy', () => { const t = N.room; if (navigator.clipboard) navigator.clipboard.writeText(t).then(() => KS.Game.notify('Room code copied.'), () => KS.Game.notify('Room code: ' + t)); else KS.Game.notify('Room code: ' + t); });
    const pt = $('netPtt'); if (pt) pt.onchange = (e) => N.setPtt(e.target.checked);
    const px = $('netProx'); if (px) px.onchange = (e) => (N.proximity = e.target.checked);
    const f = $('netForm'); if (f) f.onsubmit = (e) => { e.preventDefault(); const i = $('netText'); N.send(i.value); i.value = ''; };
    N.renderLog();
  };
  N.renderLog = () => {
    const log = $('netLog'); if (!log) return;
    log.innerHTML = N.chat.slice(-30).map((c) => `<div class="cm${c.system ? ' sys' : ''}">${c.system ? esc(c.text) : `<b>${esc(c.name)}</b> ${esc(c.text)}`}</div>`).join('');
    log.scrollTop = log.scrollHeight;
  };
  /** quick chat box on the HUD (Enter) */
  N.quickChat = () => {
    if (N.state !== 'host' && N.state !== 'guest') { KS.Phone.toggle(true); KS.Phone.openApp('friends'); return; }
    const box = $('quickChat'), inp = $('quickChatText'); box.hidden = false; inp.value = ''; inp.focus();
    if (document.exitPointerLock) document.exitPointerLock();
    box.onsubmit = (e) => { e.preventDefault(); N.send(inp.value); box.hidden = true; inp.blur(); };
    inp.onkeydown = (e) => { if (e.key === 'Escape') { box.hidden = true; inp.blur(); } e.stopPropagation(); };
  };
})();
