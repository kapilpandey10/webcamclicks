/* Kathmandu Streets — multiplayer with PeerJS (WebRTC): private rooms by code, players see each other,
   text chat, and optional microphone voice chat that gets quieter with distance.
   Signalling uses the free PeerJS cloud server; game data and voice go peer to peer. */
(function () {
  'use strict';
  const T = THREE, KS = window.KS;
  const $ = (id) => document.getElementById(id);
  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const PEERJS = 'https://cdn.jsdelivr.net/npm/peerjs@1.5.4/dist/peerjs.min.js';
  const MAX = 16; // ROUND 28: one world for everyone online, up to 16 players
  const maxPlayers = () => MAX;
  const N = (KS.Net = { state: 'off', room: '', players: new Map(), conns: new Map(), calls: new Map(), inCalls: new Map(), chat: [], unread: 0, mic: null, micOn: false, ptt: false, proximity: true, sendT: 0, lastMsg: 0 });

  /* ROUND 27: how two phones reach each other. Direct first (STUN finds each phone's internet address); when a
     network will not allow that (most mobile data, many offices), the traffic goes through a relay (TURN). PeerJS's
     own relays only listened on UDP 3478, which those networks often block, so players could not meet at all, even
     in a private room. Now the same relays are also tried over TCP, plus a community relay over TLS (port 5349).
     All are free; a relay that is down is skipped by the browser. Your own relay: ?turn=turn:host:port&turnuser=…&turnpass=… */
  const ICE = (() => {
    const list = [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478', 'turn:eu-0.turn.peerjs.com:3478?transport=tcp'], username: 'peerjs', credential: 'peerjsp' },
      { urls: ['turn:freeturn.net:3478', 'turns:freeturn.net:5349'], username: 'free', credential: 'free' },
    ];
    try { const q = new URLSearchParams(location.search); if (q.get('turn')) list.unshift({ urls: q.get('turn'), username: q.get('turnuser') || '', credential: q.get('turnpass') || '' }); } catch (e) { /* ignore */ }
    return list;
  })();
  function options() {
    const q = new URLSearchParams(location.search), o = { config: { iceServers: ICE } };
    if (q.get('peerhost')) { o.host = q.get('peerhost'); o.port = +(q.get('peerport') || 443); o.path = q.get('peerpath') || '/'; o.secure = q.get('peersecure') !== '0'; }
    return o;
  }
  /** the Friends app's connection test: can this device reach the game server, find its internet address, and reach a relay? */
  N.testNet = async () => {
    N.testing = 'Testing your connection… (about 10 s)'; N.render2();
    const out = { server: false, direct: false, relay: false };
    try {
      const pc = new RTCPeerConnection({ iceServers: ICE }); pc.createDataChannel('t');
      pc.onicecandidate = (e) => { const m = e.candidate && / typ (\w+)/.exec(e.candidate.candidate); if (m) { if (m[1] === 'srflx') out.direct = true; if (m[1] === 'relay') out.relay = true; } };
      await pc.setLocalDescription(await pc.createOffer());
      try { await loadLib(); const tp = new window.Peer(undefined, options()); out.server = await new Promise((res) => { tp.on('open', () => res(true)); tp.on('error', () => res(false)); setTimeout(() => res(false), 9000); }); try { tp.destroy(); } catch (e) { /* ignore */ } } catch (e) { /* ignore */ }
      await new Promise((r) => setTimeout(r, 1500)); pc.close();
    } catch (e) { /* ignore */ }
    N.testing = `${out.server ? '✅' : '❌'} Game server ${out.server ? 'reachable' : 'NOT reachable — check your internet'}<br>${out.direct ? '✅' : '⚠️'} Direct connection ${out.direct ? 'possible' : 'blocked on this network'}<br>${out.relay ? '✅' : '❌'} Relay ${out.relay ? 'reachable — you can play with anyone' : 'NOT reachable — here you can only meet players whose network allows direct connections. Try Wi-Fi instead of mobile data, or the other way round.'}`;
    N.render2(); return out;
  };
  function loadLib() {
    if (window.Peer) return Promise.resolve();
    return new Promise((res, rej) => { const s = document.createElement('script'); s.src = PEERJS; s.onload = res; s.onerror = () => rej(new Error('Could not load PeerJS')); document.head.appendChild(s); });
  }
  N.name = () => { const d = KS.Shop.data; return d.netName || (d.netName = 'Rider' + Math.floor(100 + Math.random() * 900)); };

  function common(peer, onErr) {
    peer.on('error', (e) => {
      const t = e && e.type;
      if (onErr && onErr(e)) return;
      N.fail(t === 'network' || t === 'server-error' || t === 'socket-error' ? 'Could not reach the multiplayer server.' : 'Multiplayer error: ' + (t || e));
    });
    // voice: each player sends their own voice on their own outgoing calls; incoming calls are listen-only
    // video: a call with metadata.video is a video call — ask before answering, so the camera only turns on with consent
    peer.on('call', (call) => {
      if (call.metadata && call.metadata.video) {
        const old = N.videoCall; if (old) { try { call.close(); } catch (e) { /* ignore */ } sys('Missed a video call — you are already on one.'); return; }
        const name = (N.players.get(call.peer) || {}).name || 'A mate';
        KS.Game.notify(`📹 <b>${name}</b> is video-calling you…`, 'good');
        KS.modal(`📹 Video call from ${name}`, '<p>They want to video-call you on the game phone. Your camera turns on only if you answer.</p>', [['📹 Answer', () => { KS.modalClose(); N.answerVideoCall(call); }], ['📵 Decline', () => { KS.modalClose(); try { call.close(); } catch (e) { /* ignore */ } }]]);
        return;
      }
      const old = N.inCalls.get(call.peer); if (old) try { old.close(); } catch (e) { /* ignore */ }
      N.inCalls.set(call.peer, call); call.answer();
      call.on('stream', (stream) => attachVoice(call.peer, stream));
      call.on('close', () => { if (N.inCalls.get(call.peer) === call) N.inCalls.delete(call.peer); });
      call.on('error', () => {});
    });
    peer.on('disconnected', () => { if (N.state !== 'off') sys('Connection to the server dropped. Players already here stay connected.'); });
  }
  N.fail = (msg) => { KS.Game.notify('💬 ' + msg, 'bad'); N.leave(true); };

  /* ================= ROUND 28: ONE WORLD FOR EVERYONE =================
     The rules, kept simple:
     1. There is ONE online world. The first player online hosts it; everyone else joins that player.
     2. Nobody is ever sent to a second world. If the host is slow to answer, you keep trying the same world,
        and the Friends app says so.
     3. If the host leaves, closes the game, or is away (tab hidden) for 30 s, the world passes to another player
        by itself: the others reconnect, and the first to reach the server becomes the new host.
     4. Up to 16 players. When it is full, you wait and get in as soon as someone leaves.
     5. The Ring Road Race happens inside this world, on its one track (race.js): up to 10 racers a race,
        anyone else with a ticket races in the next one.
     Connections go through the free PeerJS server only. */
  const WORLD = 'kstreets-world-v1-1';
  N.public = false; N.status = '';
  const WAIT = 15000, WAIT_JOIN = 30000; // a phone on mobile data can need 15-25 s to reach its host
  function setStatus(t) { N.status = t; N.render2(); }
  function clearTimers() { clearTimeout(N.connT); clearTimeout(N.retryT); clearInterval(N.tickT); N.connT = N.retryT = N.tickT = 0; }
  const statusLine = () => N.status + (N.state === 'connecting' && N.connStart ? ` · ${Math.round((Date.now() - N.connStart) / 1000)} s` : '');
  function ticking() { clearInterval(N.tickT); N.connStart = Date.now(); N.tickT = setInterval(() => { if (N.state !== 'connecting') { clearInterval(N.tickT); N.tickT = 0; return; } const e = $('netStatus'); if (e) e.textContent = statusLine(); }, 1000); } // only the status line: typing is not interrupted
  function retryLater(msg) {
    N.leave(true); N.public = true; N.status = msg || '⚠️ The online server is not answering. Trying again in 30 s…'; N.render2();
    N.retryT = setTimeout(() => { if (!N.publicOff && N.state === 'off') N.joinPublic(); }, 30000);
  }
  N.joinPublic = async (tryNo = 1) => {
    if (typeof tryNo !== 'number') tryNo = 1;
    if (N.state !== 'off' || N.publicOff) return;
    clearTimers();
    N.state = 'connecting'; N.public = true; N.joinTry = tryNo; N.room = 'KATHMANDU'; ticking();
    setStatus(tryNo > 1 ? `Still connecting to the world (try ${tryNo})… on mobile data this can take a while.${tryNo > 3 ? ' If it goes on, the host may have closed the game: the world moves to someone else within a minute.' : ''}` : 'Connecting to the online world…');
    try { await loadLib(); } catch (e) { N.public = false; N.fail(e.message); return; }
    let settled = false;
    const peer = (N.peer = new window.Peer(WORLD, options()));
    N.connT = setTimeout(() => { if (!settled && N.peer === peer) { settled = true; retryLater(); } }, WAIT); // the server never answered
    peer.on('open', () => { // nobody is hosting: you are the host now
      settled = true; clearTimers(); N.host = true; N.state = 'host'; N.me = peer.id; N.status = ''; setWorldRole(true);
      sys('🌍 You are online. Everyone who opens the game joins you here in the same Kathmandu.'); N.render2(); publicHello();
    });
    peer.on('connection', (c) => { if (N.conns.size >= MAX - 1) { c.on('open', () => { c.send({ t: 'full' }); setTimeout(() => c.close(), 300); }); return; } wire(c); });
    common(peer, (e) => {
      if (settled) return false;
      if (e.type === 'unavailable-id') { settled = true; clearTimeout(N.connT); try { peer.destroy(); } catch (x) { /* ignore */ } joinAsGuest(tryNo); return true; } // someone hosts it: join them
      settled = true; retryLater(); return true;
    });
  };
  function joinAsGuest(tryNo) {
    N.host = false; N.state = 'connecting';
    const peer = (N.peer = new window.Peer(undefined, options())); let opened = false;
    peer.on('open', () => { opened = true; N.me = peer.id; const c = peer.connect(WORLD, { reliable: true }); wire(c); N.hostId = c.peer; });
    N.connT = setTimeout(() => { // still not in: try the same world again (never another one)
      if (N.state !== 'connecting' || N.peer !== peer) return;
      if (!opened) { retryLater(); return; }
      N.leave(true); N.joinPublic(tryNo + 1);
    }, WAIT_JOIN);
    common(peer, (e) => {
      if (e.type === 'peer-unavailable') { // the host has just gone: try to become the host
        clearTimers(); N.leave(true); setTimeout(() => N.joinPublic(), 300 + Math.random() * 1500); return true;
      }
      return false;
    });
  }
  /** after losing the host, come back automatically (one of you becomes the new host) */
  function rejoinPublic(_n, wait) { N.leave(true); setTimeout(() => { if (!N.publicOff) N.joinPublic(); }, wait); }
  N.cancelConnect = () => { clearTimers(); N.publicOff = true; N.status = ''; N.leave(true); sys('Stopped connecting. You are playing offline.'); };
  /* rule 3: a host who is away (tab hidden) for 30 s hands the world over, and rejoins when back */
  document.addEventListener('visibilitychange', () => {
    clearTimeout(N.awayT);
    if (document.hidden) { if (N.state === 'host' && N.public) N.awayT = setTimeout(() => { if (document.hidden && N.state === 'host') N.handOver(); }, 30000); }
    else if (N.handedOver) { N.handedOver = false; sys('👋 Welcome back — rejoining the world.'); N.joinPublic(); }
  });
  N.handOver = () => { N.handedOver = true; N.leave(true); };
  function publicHello() {
    if (N.toldPublic) return; N.toldPublic = true;
    KS.Game.notify('🌍 You are in the <b>public world</b> with real players. Be kind, and never share personal details. Chat with <b>Enter</b>; mute anyone in Phone → Friends.');
  }
  // a short list of words that are blanked out of names and chat
  const BAD = /\b(fuck\w*|shit\w*|bitch\w*|cunt\w*|dick\w*|nigg\w*|fag\w*|randi\w*|machikne\w*|muji\w*|chikne\w*|lado\w*|puti\w*|kukur ko chhora)\b/gi;
  N.filter = (t) => String(t).replace(BAD, (w) => '*'.repeat(w.length));
  N.blocked = new Set();
  N.toggleBlock = (id) => { if (N.blocked.has(id)) N.blocked.delete(id); else N.blocked.add(id); const p = N.players.get(id); if (p && p.voice) p.voice.g.gain.value = 0; N.render2(); };
  function wire(c) {
    c.on('open', () => {
      N.conns.set(c.peer, c);
      c.send({ t: 'hello', name: N.name(), look: look() });
      if (!N.host) { clearTimers(); N.status = ''; N.state = 'guest'; setWorldRole(false); sys('🌍 You are online with other players — everyone is a coloured dot on your map.'); publicHello(); }
      N.render2(); if (N.micOn) callAll();
    });
    c.on('data', (m) => onData(c, m));
    c.on('close', () => { N.conns.delete(c.peer); if (!N.host && c.peer === N.hostId) { if (N.handedOver) return; sys('The world host left — the world passes to another player. Reconnecting…'); rejoinPublic(1, 400 + Math.random() * 2500); return; } dropPlayer(c.peer); if (N.host) broadcast({ t: 'bye', id: c.peer }); roster(); });
    c.on('error', () => {});
  }
  function broadcast(m, except) { for (const [id, c] of N.conns) if (id !== except && c.open) c.send(m); }
  function roster() { if (!N.host) return; const list = [{ id: N.me, name: N.name() }].concat([...N.players.values()].map((p) => ({ id: p.id, name: p.name }))); broadcast({ t: 'roster', list }); N.roster = list; N.render2(); }
  function onData(c, m) {
    if (!m || typeof m !== 'object') return;
    const from = N.host ? c.peer : m.id || c.peer;
    switch (m.t) {
      case 'full': retryLater(`🌍 The world is full (${MAX} players). You get in as soon as someone leaves — trying again in 30 s.`); break;
      case 'hello': if (N.host) { upsert(c.peer, { name: clean(m.name, 16), look: m.look }); sys(`${clean(m.name, 16)} joined.`); roster(); if (c.open) c.send(worldMsg()); } break;
      case 'roster': N.roster = (m.list || []).slice(0, maxPlayers()); for (const r of N.roster) if (r.id !== N.me) upsert(r.id, { name: clean(r.name, 16) }); for (const id of [...N.players.keys()]) if (!N.roster.some((r) => r.id === id)) dropPlayer(id); N.render2(); if (N.micOn) callAll(); break;
      case 'world': if (!N.host) syncWorld(m); break;
      case 'npc': if (!N.host) { if (KS.Traffic) KS.Traffic.applySnapshot(m.v); if (KS.Peds) KS.Peds.applySnapshot(m.p); if (N.state === 'guest' && KS.Traffic && !KS.Traffic.remote) setWorldRole(false); } break; // the host's traffic and walkers: the same cars, same people, same chase on every screen
      case 'match': case 'shot': case 'hit': case 'kill': case 'boom': case 'pick': // battle: the host passes everything on, then everyone handles it
        if (N.host) broadcast(m, c.peer);
        if (m.t === 'kill' && m.victim) { const p = N.players.get(m.victim); if (p) p.al = false; }
        KS.Battle && KS.Battle.onNet(m); break;
      case 's': if (from === N.me) break; upsert(from, m); if (N.host) broadcast({ ...m, id: c.peer }, c.peer); break;
      case 'c': { if (from === N.me) break; const p = N.players.get(from), name = p ? p.name : clean(m.name, 16); addChat(name, clean(m.text, 200), from); if (N.host) broadcast({ t: 'c', id: c.peer, name, text: clean(m.text, 200) }, c.peer); break; }
      case 'race': if (N.host) broadcast(m, c.peer); KS.Race && KS.Race.onNet(m); break; // the Ring Road Race (race.js): the host passes it on
      case 'bye': dropPlayer(m.id); N.render2(); break;
    }
  }
  const clean = (t, n) => { const s2 = String(t || '').replace(/[\u0000-\u001f]/g, ' ').slice(0, n); return N.filter ? N.filter(s2) : s2; };
  function look() { const o = KS.Player.person && KS.Player.person.cfg; return o ? { top: o.topStyle === 'jacket' ? o.jacket : o.top, bottom: o.bottom, skin: o.skin, hat: o.hat, hatColor: o.hatColor, topStyle: o.topStyle } : null; }

  /* ---------- remote players ---------- */
  const COLORS = ['#ff4fa3', '#3fd4ff', '#a6ff3f', '#ff9a2e', '#b77bff', '#ffe23f', '#3fffb0'];
  /** send to everyone in the room (guests go through the host) */
  N.sendAll = (m) => { if (N.state === 'host') broadcast(m); else if (N.state === 'guest') { const c = N.conns.get(N.hostId); c && c.open && c.send(m); } };
  /* ---------- one shared world: the host's clock and weather ---------- */
  function worldMsg() { const W = KS.Weather; return { t: 'world', time: KS.time, wx: W.type, mode: KS.Settings.data().timeMode || 'fast' }; }
  /** host simulates the city, guests mirror it (see traffic.js / people.js) */
  function setWorldRole(host) {
    if (KS.Traffic) KS.Traffic.setRemote(!host);
    if (KS.Peds) KS.Peds.setRemote(!host);
  }
  /** the host's traffic and walkers near any player, so every screen shows the same city */
  function npcMsg() {
    const P = KS.Player, points = [{ x: P.x, z: P.z }];
    for (const p of N.players.values()) if (p.placed) points.push({ x: p.x, z: p.z });
    return { t: 'npc', v: KS.Traffic ? KS.Traffic.snapshot(points, 240) : [], p: N.npcPed && KS.Peds ? KS.Peds.snapshot(points, 160) : null };
  }
  function syncWorld(m) {
    const W = KS.Weather; N.worldSynced = true; W.auto = false; W.timer = 1e9; N.hostTimeMode = m.mode;
    if (typeof m.time === 'number' && Math.abs(KS.wrapAng(((m.time - KS.time) / 24) * Math.PI * 2)) > 0.02) KS.time = ((m.time % 24) + 24) % 24;
    if (m.wx && W.TYPES[m.wx] && W.type !== m.wx) W.type = m.wx;
  }
  /** local police cars that chase a friend who is wanted, so everyone sees the same chase */
  function netChases(dt, P) {
    for (const p of N.players.values()) {
      p.cops = (p.cops || []).filter((v) => KS.Traffic.list.includes(v));
      const want = p.placed && p.heat > 0 && Math.hypot(p.x - P.x, p.z - P.z) < 600 ? Math.min(3, p.heat + 1) : 0;
      p.copT = (p.copT || 0) - dt;
      if (p.cops.length < want && p.copT <= 0) { p.copT = 1.5; const v = KS.Traffic.spawn(KS.chance(0.4) ? 'policebike' : 'police', p.x, p.z, 70, 160); v.netTarget = p; KS.Traffic.startChase(v); p.cops.push(v); }
      while (p.cops.length > want) { const v = p.cops.pop(); v.netTarget = null; KS.Traffic.endChase(v); }
    }
  }
  /* ---------- sharing a vehicle: bikes carry 2 people, cars, trucks and buses up to 10 ---------- */
  const seatsFor = (kind) => (KS.isBike(kind) ? 1 : 9); // passengers besides the driver
  function driverOf(id) {
    if (id === N.me) { const P = KS.Player, v = P.vehicle; return v ? { x: v.x, y: v.y, z: v.z, h: v.h, kind: v.kind, speed: v.speed } : null; }
    const p = N.players.get(id); return p && p.v && KS.VTYPES[p.v] ? { x: p.x, y: p.y, z: p.z, h: p.h, kind: p.v, speed: 0, name: p.name } : null;
  }
  function seatWorld(D2, seat) {
    const t = KS.VTYPES[D2.kind] || { len: 4.2, wid: 1.8 }; let lx = 0, lz = 0, ly = 0.2;
    if (KS.isBike(D2.kind)) { lz = -0.62; ly = 0.24; }
    else if (t.len > 6) { lz = t.len / 2 - 2.2 - Math.floor((seat - 1) / 2) * 1.05; lx = seat % 2 ? -0.55 : 0.55; ly = 0.6; } // bus and truck rows
    else { const row = seat === 1 ? 0 : 1 + Math.floor((seat - 2) / 3); lz = 0.2 - row * 0.85; lx = seat === 1 ? -0.42 : [-0.5, 0, 0.5][(seat - 2) % 3]; }
    const sh = Math.sin(D2.h), ch = Math.cos(D2.h);
    return { x: D2.x + sh * lz + ch * lx, y: D2.y + ly, z: D2.z + ch * lz - sh * lx };
  }
  function freeSeat(id, kind) { const used = new Set(); for (const p of N.players.values()) if (p.v && p.v.startsWith(`pass:${id}:`)) used.add(+p.v.split(':')[2]); for (let k = 1; k <= seatsFor(kind); k++) if (!used.has(k)) return k; return 0; }
  function nearDriver() {
    const P = KS.Player; if (P.mode !== 'foot' || !(N.state === 'host' || N.state === 'guest')) return null;
    let best = null, bd = 1e9;
    for (const p of N.players.values()) { if (!p.v || !KS.VTYPES[p.v]) continue; const t = KS.VTYPES[p.v], d = Math.hypot(p.x - P.x, p.z - P.z), r = KS.isBike(p.v) ? 2.6 : t.len / 2 + 2; if (d < r && d < bd) { bd = d; best = p; } }
    return best;
  }
  N.boardHint = () => { const p = nearDriver(); if (!p) return ''; const free = freeSeat(p.id, p.v); return free ? `Ride with ${esc(p.name)} (${KS.isBike(p.v) ? 'pillion seat' : `seat ${free + 1} of ${seatsFor(p.v) + 1}`})` : `${esc(p.name)}'s ${KS.VTYPES[p.v].name} is full`; };
  N.tryBoard = () => {
    const p = nearDriver(); if (!p) return false;
    const seat = freeSeat(p.id, p.v); if (!seat) { KS.Game.notify(`${esc(p.name)}'s ${KS.VTYPES[p.v].name} is full.`); return true; }
    const P = KS.Player; P.mode = 'ride'; P.ride = { id: p.id, seat, name: p.name }; P.speed = 0; KS.Cam.want = KS.isBike(p.v) ? 6 : 9;
    KS.Game.notify(`🚗 You are riding with <b>${esc(p.name)}</b>. Press <b>E</b> to get out.`); return true;
  };
  N.rideUpdate = (dt) => {
    const P = KS.Player, R = P.ride, D2 = R && driverOf(R.id), pr = P.person;
    if (!D2) { N.leaveRide(); return; }
    const w = seatWorld(D2, R.seat), bike = KS.isBike(D2.kind);
    P.speed = Math.hypot(w.x - P.x, w.z - P.z) / Math.max(dt, 0.001); P.x = w.x; P.y = w.y; P.z = w.z; P.h = D2.h;
    pr.root.visible = bike; pr.root.position.set(w.x, w.y, w.z); pr.root.rotation.y = D2.h;
    if (bike) { KS.animSit(pr); pr.armL.rotation.x = pr.armR.rotation.x = -0.9; }
    if (KS.Input.hit('KeyE') || KS.Input.hit('KeyEnter')) N.leaveRide();
  };
  N.leaveRide = () => {
    const P = KS.Player, R = P.ride; if (!R) { P.mode = 'foot'; return; }
    const D2 = driverOf(R.id), h = D2 ? D2.h : P.h, side = KS.VTYPES[D2 ? D2.kind : 'car'] ? KS.VTYPES[D2 ? D2.kind : 'car'].wid / 2 + 1 : 1.5;
    let x = P.x + Math.cos(h) * -side, z = P.z - Math.sin(h) * -side; const c = KS.collide(x, z, 0.4, 0, 1); x = c.x; z = c.z;
    P.x = x; P.z = z; P.y = KS.groundAt(x, z, P.y + 1, 1.2); P.vy = 0; P.mode = 'foot'; P.ride = null;
    const pr = P.person; pr.root.visible = true; pr.legL.rotation.x = pr.legR.rotation.x = 0; pr.armL.rotation.x = pr.armR.rotation.x = 0; KS.Cam.want = 4;
  };
  /** friends that have sent a position, for the maps */
  N.visible = () => [...N.players.values()].filter((p) => p.placed);
  /** jump to a friend (on foot, next to them) */
  N.goTo = (id) => {
    const p = N.players.get(id), P = KS.Player; if (!p || !p.placed) { KS.Game.notify('Waiting for their position…'); return; }
    if (P.vehicle) P.exit();
    for (const [ox, oz] of [[2, 0], [-2, 0], [0, 2], [0, -2], [3, 3], [0, 0]]) {
      const c = KS.collide(p.x + ox, p.z + oz, 0.4, p.y, 1.6); if (c.hit && (ox || oz)) continue;
      P.x = p.x + ox; P.z = p.z + oz; P.y = p.y + 0.3; P.vy = 0; break;
    }
    KS.Phone && KS.Phone.toggle(false); KS.Game.notify(`👋 You are next to ${esc(p.name)}.`);
  };
  N.find = (id) => { const p = N.players.get(id); if (!p || !p.placed) return; KS.Game.setWaypoint(p.x, p.z); KS.Game.notify(`📍 Route to ${esc(p.name)}: follow the blue line (the pink dot moves with them).`); N.follow = id; };
  function upsert(id, m) {
    let p = N.players.get(id);
    if (!p) { p = { id, name: m.name || 'Player', x: 0, y: 0, z: 0, h: 0, tx: 0, ty: 0, tz: 0, th: 0, v: '', root: new T.Group(), seen: KS.clock, color: COLORS[N.players.size % COLORS.length] }; KS.scene.add(p.root); N.players.set(id, p); makeTag(p); }
    if (m.name) p.name = clean(m.name, 16);
    if (m.look && !p.person) p.look = m.look;
    if (m.x != null) { p.tx = m.x; p.ty = m.y; p.tz = m.z; p.th = m.h; p.seen = KS.clock; if (!p.placed) { p.x = m.x; p.y = m.y; p.z = m.z; p.h = m.h; p.placed = true; } }
    if (m.look) p.look = m.look;
    if (m.sit != null) p.sit = !!m.sit; // riding the tram or sitting in a home: show them seated
    if (!p.person) buildAvatar(p);
    if (m.v != null && m.v !== p.v) setVehicle(p, m.v);
    p.speaking = !!m.talk;
    if ('al' in m) p.al = m.al; if (m.wp != null) p.wp = m.wp;
    if (m.w != null) { if (m.w > (p.heat || 0) && m.w) sys(`🚨 The police are after ${p.name}!`); p.heat = m.w; }
  }
  function buildAvatar(p) {
    const o = KS.outfitFor('man'), L = p.look || {};
    Object.assign(o, { skin: L.skin || o.skin, topStyle: L.topStyle || 'jacket', jacket: L.top || 0x6d1a8a, top: L.top || 0x6d1a8a, bottom: L.bottom || o.bottom, hat: L.hat || null, hatColor: L.hatColor || 0 });
    if (p.person) p.root.remove(p.person.root);
    p.person = KS.makePerson('man', o); p.root.add(p.person.root); p.person.root.userData.net = true; // friends' chat is never read aloud
  }
  function setVehicle(p, kind) {
    if (p.veh) { p.root.remove(p.veh.root); p.veh = null; }
    p.v = kind;
    if (kind && kind.startsWith('pass:')) { // riding in someone else's vehicle
      const [, drv] = kind.split(':'); if (drv === N.me) KS.Game.notify(`🙋 ${esc(p.name)} got in with you.`);
      p.person.root.position.set(0, 0, 0); return;
    }
    if (kind && KS.VTYPES[kind]) { p.veh = KS.buildVehicle(kind, { rider: false, conductor: false }); if (p.veh) p.root.add(p.veh.root); }
    const bike = kind && KS.isBike(kind);
    p.person.root.visible = !kind || bike;
    if (kind && !bike && !p.veh) p.person.root.visible = false; // their car did not load here: hide them rather than floating them on the road
    if (bike) { p.person.root.position.set(0, 0.18, -0.32); KS.animSit(p.person); p.person.armL.rotation.x = p.person.armR.rotation.x = -1.2; }
    else { p.person.root.position.set(0, 0, 0); p.person.legL.rotation.x = p.person.legR.rotation.x = 0; }
  }
  function dropPlayer(id) { const p = N.players.get(id); if (!p) return; for (const v of p.cops || []) { v.netTarget = null; KS.Traffic.endChase(v); } KS.scene.remove(p.root); p.tag && p.tag.remove(); for (const m of [N.calls, N.inCalls]) { const c = m.get(id); if (c) try { c.close(); } catch (e) { /* ignore */ } m.delete(id); } N.players.delete(id); }
  function makeTag(p) { const el = document.createElement('div'); el.className = 'nametag'; ($('nameTags') || document.body).appendChild(el); p.tag = el; }

  /* ---------- chat ---------- */
  function sys(text) { addChat('', text, null, true); }
  function addChat(name, text, from, system) {
    if (from && N.blocked && N.blocked.has(from)) return; // muted player
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
      N.micOn = true; setTalking(!N.ptt); sys(N.ptt ? 'Microphone on. Hold G to talk.' : 'Microphone on: open mic.');
      callAll(); N.render2();
    } catch (e) {
      const why = !window.isSecureContext ? 'The mic only works on https pages.' : e.name === 'NotAllowedError' ? 'Your browser blocked it: click the 🔒 / ⓘ icon next to the address, allow Microphone, then tap Turn mic on again.' : e.name === 'NotFoundError' ? 'No microphone was found on this device.' : (e.message || e.name);
      KS.Game.notify('🎙 Microphone not available. ' + why, 'bad'); sys('Mic: ' + why); N.render2();
    }
  };
  function setTalking(on) { N.talking = on; if (N.mic) N.mic.getAudioTracks().forEach((t) => (t.enabled = on)); }
  N.setPtt = (on) => { N.ptt = on; setTalking(!on); N.render2(); };
  function callAll() {
    if (!N.peer || !N.mic) return;
    const ids = (N.roster || []).map((r) => r.id).concat([...N.players.keys()]);
    for (const id of new Set(ids)) if (id && id !== N.me && !N.calls.has(id)) {
      const c = N.peer.call(id, N.mic); if (!c) continue;
      N.calls.set(id, c);
      c.on('close', () => { if (N.calls.get(id) === c) N.calls.delete(id); });
      c.on('error', () => {});
    }
  }
  function attachVoice(id, stream) {
    if (!N.players.has(id)) upsert(id, {}); // their call can arrive before their first position update
    const p = N.players.get(id);
    KS.audio.init(); const ctx = KS.audio.ctx; if (!ctx) return;
    const el = new Audio(); el.srcObject = stream; el.muted = true; const pr = el.play(); if (pr && pr.catch) pr.catch(() => {});
    const src = ctx.createMediaStreamSource(stream), g = ctx.createGain(), an = ctx.createAnalyser(); an.fftSize = 256;
    src.connect(an); src.connect(g).connect(KS.audio.bus.voice);
    if (p.voice) { try { p.voice.src.disconnect(); } catch (e) { /* ignore */ } }
    p.voice = { el, src, g, an, buf: new Uint8Array(an.frequencyBinCount) };
  }

  /* ---------- video calls on the game phone ---------- */
  N.videoStream = null; N.videoCall = null; N.videoPeer = null;
  function showVideoUI(name, state) {
    const vc = $('vidCall'); if (!vc) return;
    vc.hidden = false;
    $('vidName').textContent = name || '';
    $('vidState').textContent = state || '';
    KS.Phone && KS.Phone.toggle(true);
  }
  function hideVideoUI() {
    const vc = $('vidCall'); if (!vc) return;
    vc.hidden = true;
    const r = $('vidRemote'), l = $('vidLocal');
    if (r) r.srcObject = null;
    if (l) l.srcObject = null;
  }
  /* get the camera (and mic) for a video call. Returns the stream or null. */
  async function getCamera() {
    try {
      return await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 }, audio: { echoCancellation: true, noiseSuppression: true } });
    } catch (e) {
      const why = !window.isSecureContext ? 'Video calls only work on https pages.' : e.name === 'NotAllowedError' ? 'Your browser blocked the camera: click the 🔒 / ⓘ icon next to the address, allow Camera, then try again.' : e.name === 'NotFoundError' ? 'No camera was found on this device.' : (e.message || e.name);
      KS.Game.notify('📹 Video call not available. ' + why, 'bad');
      return null;
    }
  }
  function wireVideoCall(call, peerId, name) {
    N.videoCall = call; N.videoPeer = peerId;
    call.on('stream', (stream) => {
      const r = $('vidRemote'); if (r) { r.srcObject = stream; const p = r.play(); if (p && p.catch) p.catch(() => {}); }
      $('vidState').textContent = 'Connected — ' + (name || 'your mate');
      // their voice comes through the game audio too, like a voice call
      attachVoice(peerId, stream);
    });
    call.on('close', () => { if (N.videoCall === call) N.endVideoCall(true); });
    call.on('error', () => {});
  }
  /* tap 📹 next to a friend: call them with video */
  N.startVideoCall = async (peerId) => {
    if (!N.peer || N.state === 'off') { KS.Game.notify('📹 Join a room or the public world first, then video-call a mate.', 'bad'); return; }
    if (N.videoCall) { KS.Game.notify('📹 You are already on a video call. End it first.', 'bad'); return; }
    const p = N.players.get(peerId);
    const name = p ? p.name : 'your mate';
    showVideoUI(name, 'Calling…');
    const stream = await getCamera();
    if (!stream) { hideVideoUI(); return; }
    N.videoStream = stream;
    const l = $('vidLocal'); if (l) { l.srcObject = stream; const pr = l.play(); if (pr && pr.catch) pr.catch(() => {}); }
    const call = N.peer.call(peerId, stream, { metadata: { video: true } });
    if (!call) { N.endVideoCall(true); KS.Game.notify('📹 Could not reach them. Try again.', 'bad'); return; }
    wireVideoCall(call, peerId, name);
  };
  /* hang up (or the other side hung up) */
  N.endVideoCall = (silent) => {
    if (N.videoCall) { try { N.videoCall.close(); } catch (e) { /* ignore */ } N.videoCall = null; N.videoPeer = null; }
    if (N.videoStream) { N.videoStream.getTracks().forEach((t) => t.stop()); N.videoStream = null; }
    hideVideoUI();
    if (!silent) KS.Game.notify('📹 Video call ended.');
  };
  /* an incoming video call: ask before answering (and before turning the camera on) */
  N.answerVideoCall = async (call) => {
    const name = (N.players.get(call.peer) || {}).name || 'A mate';
    const stream = await getCamera();
    if (!stream) { try { call.close(); } catch (e) { /* ignore */ } return; }
    N.videoStream = stream;
    const l = $('vidLocal'); if (l) { l.srcObject = stream; const pr = l.play(); if (pr && pr.catch) pr.catch(() => {}); }
    showVideoUI(name, 'Connected — ' + name);
    call.answer(stream);
    wireVideoCall(call, call.peer, name);
  };
  const ve = $('vidEnd'); if (ve) ve.onclick = () => N.endVideoCall();

  N.leave = (silent) => {
    N.endVideoCall(true);
    for (const c of [...N.calls.values(), ...N.inCalls.values()]) try { c.close(); } catch (e) { /* ignore */ }
    for (const c of N.conns.values()) try { c.close(); } catch (e) { /* ignore */ }
    N.calls.clear(); N.inCalls.clear(); N.conns.clear();
    for (const id of [...N.players.keys()]) dropPlayer(id);
    if (N.peer) try { N.peer.destroy(); } catch (e) { /* ignore */ }
    if (N.mic) N.mic.getTracks().forEach((t) => t.stop());
    if (KS.Player.mode === 'ride') N.leaveRide();
    clearTimers(); N.peer = null; N.mic = null; N.micOn = false; N.arrived = false; N.follow = null; N.state = 'off'; setWorldRole(true); // back to playing alone: simulate the city yourself again
    if (N.worldSynced) { N.worldSynced = false; KS.Weather.auto = true; KS.Weather.timer = 60; } N.room = ''; N.roster = null;
    if (!silent) sys('You left the room.');
    N.render2();
  };

  /* ---------- per frame ---------- */
  const v = new T.Vector3();
  N.update = (dt, camera) => {
    if (N.state === 'off' || N.state === 'connecting') return;
    const P = KS.Player, I = KS.Input;
    if (N.micOn && N.ptt) setTalking(!!I.down('KeyG'));
    if (N.el && N.el.isConnected && KS.clock % 1 < dt) N.el.querySelectorAll('[data-dist]').forEach((e) => { const f = N.players.get(e.dataset.dist); if (f && f.placed) e.textContent = Math.round(Math.hypot(f.x - P.x, f.z - P.z)) + ' m'; });
    if (!KS.Traffic || !KS.Traffic.remote) netChases(dt, P); // guests in remote mode skip this: the host's chasers arrive in the snapshots
    if (N.host) { N.worldT = (N.worldT || 0) - dt; if (N.worldT <= 0) { N.worldT = 2; broadcast(worldMsg()); } }
    if (N.host) { // the shared city: traffic 4x a second, walkers every other tick
      N.npcT = (N.npcT || 0) - dt;
      if (N.npcT <= 0) { N.npcT = 0.25; N.npcPed = !N.npcPed; broadcast(npcMsg()); }
    }
    if (!N.host && !N.arrived) { const h = N.players.get(N.hostId); if (h && h.placed) { N.arrived = true; N.goTo(h.id); sys(`You joined ${h.name}. Everyone is on the map as a coloured dot.`); } }
    if (N.follow) { const f = N.players.get(N.follow); if (!f) N.follow = null; else if (KS.clock % 2 < dt) { if (Math.hypot(f.x - P.x, f.z - P.z) < 12) { N.follow = null; KS.Game.notify(`You found ${esc(f.name)}!`); } else KS.Game.setWaypoint(f.x, f.z, true); } }
    N.sendT -= dt;
    if (N.sendT <= 0) {
      N.sendT = 0.1;
      const m = { t: 's', id: N.me, name: N.name(), x: +P.x.toFixed(2), y: +P.y.toFixed(2), z: +P.z.toFixed(2), h: +(P.vehicle ? P.vehicle.h : P.h).toFixed(3), v: P.vehicle ? P.vehicle.kind : P.mode === 'ride' && P.ride ? `pass:${P.ride.id}:${P.ride.seat}` : '', talk: N.micOn && N.talking, sit: P.mode === 'tram' || !!(KS.Homes && KS.Homes.seat) ? 1 : 0, w: KS.Law ? KS.Law.heat : 0, wp: KS.Battle && KS.Battle.armed() ? (KS.Battle.slot === 1 ? KS.Battle.inv.primary.kind : 'pistol') : '', al: KS.Battle && KS.Battle.on && KS.Battle.match && !KS.Battle.match.over ? KS.Battle.alive : undefined, look: KS.clock % 3 < 0.1 ? look() : undefined };
      if (N.host) broadcast(m); else { const c = N.conns.get(N.hostId); c && c.open && c.send(m); }
    }
    for (const p of N.players.values()) {
      if (p.v && p.v.startsWith('pass:') && p.person) { // sit them in the driver's vehicle
        const [, drv, seat] = p.v.split(':'), D2 = driverOf(drv);
        if (D2) { const w = seatWorld(D2, +seat); p.x = p.tx = w.x; p.y = p.ty = w.y; p.z = p.tz = w.z; p.h = p.th = D2.h; p.root.position.set(w.x, w.y, w.z); p.root.rotation.y = D2.h; const bike = KS.isBike(D2.kind); p.person.root.visible = bike; if (bike) { KS.animSit(p.person); p.person.armL.rotation.x = p.person.armR.rotation.x = -0.9; } }
        continue;
      }
      const k = Math.min(1, dt * 10);
      p.x += (p.tx - p.x) * k; p.y += (p.ty - p.y) * k; p.z += (p.tz - p.z) * k; p.h = KS.angLerp(p.h, p.th, k);
      const mv = Math.hypot(p.tx - p.x, p.tz - p.z);
      p.root.position.set(p.x, p.y + (p.v ? 0.02 : 0), p.z); p.root.rotation.y = p.h;
      if (!p.v && p.person && p.sit) { KS.animSit(p.person); KS.sitBent(p.person, true); p.person.root.position.set(0, 0.3, 0); }
      else if (!p.v && p.person) {
        if (p.person.root.position.y) p.person.root.position.set(0, 0, 0);
        KS.animWalk(p.person, dt, mv > 0.05 ? Math.min(8, mv * 10) : 0);
        if (KS.Battle) { KS.Battle.holdGun(p.person, p.wp || null); if (p.wp) { p.person.busyArm = true; p.person.armR.rotation.set(-1.5, 0, 0.05); p.person.armL.rotation.set(-1.35, 0, 0.45); } else p.person.busyArm = false; }
        p.person.inner.rotation.x = p.al === false ? -1.45 : 0; p.person.inner.position.y = p.al === false ? 0.2 : 0;
      }
      const d = Math.hypot(p.x - P.x, p.z - P.z);
      if (p.voice) {
        p.voice.g.gain.value = N.blocked.has(p.id) ? 0 : N.proximity ? KS.clamp(1.2 - d / 55, 0, 1) : 1;
        p.voice.an.getByteFrequencyData(p.voice.buf); let s = 0; for (const b of p.voice.buf) s += b; p.loud = s / p.voice.buf.length > 18;
      }
      // name tag
      const tag = p.tag; v.set(p.x, p.y + (p.v && !KS.isBike(p.v) ? 2.6 : 2.25), p.z).project(camera);
      const vis = v.z < 1 && Math.abs(v.x) < 1.05 && Math.abs(v.y) < 1.05 && d < 160;
      tag.style.display = vis ? 'block' : 'none';
      if (vis) { tag.textContent = (p.heat > 0 ? '🚨 ' : '') + (p.loud || p.speaking ? '🔊 ' : '') + p.name + (d > 25 ? ` · ${Math.round(d)} m` : ''); tag.style.transform = `translate(${((v.x + 1) / 2) * innerWidth}px, ${((1 - v.y) / 2) * innerHeight}px) translate(-50%, -100%)`; }
    }
  };

  /* ---------- UI (phone "Friends" app) ---------- */
  N.render = (el) => { N.el = el; N.unread = 0; N.render2(); };
  N.render2 = () => {
    const el = N.el; if (!el || !el.isConnected || (KS.Phone && KS.Phone.app !== 'friends')) { KS.Phone && KS.Phone.tick && KS.Phone.tick(); return; }
    const on = N.state === 'host' || N.state === 'guest';
    const players = [{ name: N.name() + ' (you)' }].concat([...N.players.values()]);
    el.innerHTML = on ? `
      <div class="roomcode"><span>🌍 Kathmandu online</span><b>${players.length}/${MAX}</b><button type="button" class="chip" id="netCopy">Copy invite link</button></div>
      <p class="ph-muted small">${players.length < 2 ? 'Nobody else is online right now. Everyone who opens the game joins this same world automatically — send friends the invite link.' : `${players.length} players in the world. Everyone is a coloured dot on your map.`} Be kind and never share personal details.</p>
      <ul class="netlist">${[...N.players.values()].map((p) => `<li><i style="background:${p.color}"></i><b>${esc(p.name)}</b><small data-dist="${esc(p.id)}">${p.placed ? Math.round(Math.hypot(p.x - KS.Player.x, p.z - KS.Player.z)) + ' m' : 'connecting…'}</small><button type="button" class="chip" data-find="${esc(p.id)}">📍 Find</button><button type="button" class="chip" data-goto="${esc(p.id)}">🚀 Go to</button><button type="button" class="chip" data-video="${esc(p.id)}">📹 Video call</button><button type="button" class="chip" data-block="${esc(p.id)}">${N.blocked.has(p.id) ? '🔈 Unmute' : '🔇 Mute'}</button></li>`).join('')}</ul>
      <div class="req-btns"><button type="button" class="btn small-btn ${N.micOn ? '' : 'ghost'}" id="netMic">${N.micOn ? '🎙 Mic on' : '🎙 Turn mic on'}</button>
      <label class="set tog"><input type="checkbox" id="netPtt" ${N.ptt ? 'checked' : ''}><span>Push to talk (hold G)</span></label></div>
      <label class="set tog"><input type="checkbox" id="netProx" ${N.proximity ? 'checked' : ''}><span>Voices get quieter with distance</span></label>
      ${N.host ? '<button type="button" class="btn small-btn" id="netBattle">⚔️ Start a battle match for everyone</button>' : '<p class="ph-muted small">⚔️ Battle matches are started by the world host.</p>'}
      <div class="chatlog" id="netLog"></div>
      <form id="netForm" class="chatform"><input id="netText" maxlength="200" placeholder="Message… (Enter)" autocomplete="off" aria-label="Chat message"><button type="submit" class="btn small-btn">Send</button></form>
      <button type="button" class="btn ghost small-btn" id="netTest">🔧 Test my connection</button>${N.testing ? `<p class="ph-muted small">${N.testing}</p>` : ''}
      <button type="button" class="btn ghost small-btn" id="netLeave">Go offline (play alone)</button>`
      : `<div class="req-btns"><button type="button" class="btn small-btn" id="netPublic" ${N.state === 'connecting' ? 'disabled' : ''}>🌍 ${N.state === 'connecting' ? 'Connecting…' : 'Go online — play with everyone'}</button>${N.state === 'connecting' || N.retryT ? '<button type="button" class="btn ghost small-btn" id="netCancel">Cancel</button>' : ''}</div>
      ${N.status ? `<p class="ph-muted small" id="netStatus">${esc(statusLine())}</p>` : ''}
      <ol class="howto"><li>Everyone who is online plays in the <b>same Kathmandu</b> — up to ${MAX} players.</li><li>Send friends the game link: when they open it, they appear next to you on the map.</li><li>Chat with <kbd>Enter</kbd>; tap <b>Turn mic on</b> to talk; <b>📹 Video call</b> a friend from their name.</li><li>Race them on the Ring Road: buy a ticket at the <b>Race HQ booth</b> (रु 50).</li></ol>
      <label class="set"><span>Your name</span><input id="netName" maxlength="16" value="${esc(N.name())}" aria-label="Your name"></label>
      <div class="req-btns"><button type="button" class="btn ghost small-btn" id="netTest">🔧 Test my connection</button></div>${N.testing ? `<p class="ph-muted small">${N.testing}</p>` : ''}
      <p class="ph-muted small">Connections are set up through the free PeerJS server; positions, chat and voice then go directly between players. The microphone is used only after you turn it on.</p>`;
    const b = (id, fn) => { const x = $(id); if (x) x.onclick = fn; };
    const nm = $('netName'); if (nm) nm.onchange = () => { if (nm.value.trim()) { KS.Shop.data.netName = clean(nm.value.trim(), 16); KS.Shop.save(); } };
    b('netLeave', () => { N.publicOff = true; KS.Settings.data().online = false; KS.Shop.save(); N.leave(); });
    b('netCancel', () => N.cancelConnect());
    b('netTest', () => N.testNet());
    b('netPublic', () => { N.publicOff = false; KS.Settings.data().online = true; KS.Shop.save(); N.joinPublic(); });
    el.querySelectorAll('[data-block]').forEach((x) => (x.onclick = () => N.toggleBlock(x.dataset.block)));
    b('netMic', () => N.toggleMic());
    b('netBattle', () => { KS.Phone.toggle(false); KS.Battle.startMatch(); });
    el.querySelectorAll('[data-find]').forEach((x) => (x.onclick = () => N.find(x.dataset.find)));
    el.querySelectorAll('[data-goto]').forEach((x) => (x.onclick = () => N.goTo(x.dataset.goto)));
    el.querySelectorAll('[data-video]').forEach((x) => (x.onclick = () => N.startVideoCall(x.dataset.video)));
    b('netCopy', () => {
      const t = location.origin + location.pathname, msg = `Play Kathmandu Streets with me — open the game and you appear next to me! ${t}`;
      if (navigator.share && matchMedia('(pointer: coarse)').matches) { navigator.share({ title: 'Kathmandu Streets', text: msg, url: t }).catch(() => {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(msg).then(() => KS.Game.notify('🔗 Invite link copied. Paste it to your friends.'), () => KS.Game.notify(t)); else KS.Game.notify(t);
    });
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
