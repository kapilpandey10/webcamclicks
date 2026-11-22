/* WebcamClicks — Slideshow maker: photos + music → MP4, with slow zoom & pan (Ken Burns), transitions, a title,
   and sizes for Reels, TikTok, YouTube and the feed. Built-in royalty-free music or your own song. All on the device. */

import { $, setupDropzone, setStatus, downloadBlob, decodeImage, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';
import { generateMusic, MUSIC_STYLES } from './sr/music.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $('#ss-work'), canvas: $('#ss-canvas'), strip: $('#ss-strip'),
  play: $('#ss-play'), seek: $('#ss-seek'), time: $('#ss-time'), add: $('#ss-add'), addIn: $('#ss-add-in'),
  aspect: $('#ss-aspect'), per: $('#ss-per'), perV: $('#ss-per-v'), trans: $('#ss-trans'), kb: $('#ss-kb'), fit: $('#ss-fit'), bg: $('#ss-bg'),
  title: $('#ss-title'), sub: $('#ss-sub'), music: $('#ss-music'), musicIn: $('#ss-music-in'), musicName: $('#ss-music-name'), vol: $('#ss-vol'), fitMusic: $('#ss-fitmusic'),
  run: $('#ss-run'), bar: $('#ss-bar'), fill: $('#ss-fill'), result: $('#ss-result'), resultInfo: $('#ss-result-info'), dl: $('#ss-dl'), total: $('#ss-total')
};
const SIZES = { '9:16': [1080, 1920], '1:1': [1080, 1080], '4:5': [1080, 1350], '16:9': [1920, 1080] };
const FPS = 30, SR = 48000;
let photos = [];   // { id, img, name, thumb }
let nextId = 1;
els.music.innerHTML = `<option value="none">No music</option>${Object.entries(MUSIC_STYLES).map(([k, s]) => `<option value="${k}">${s.name} (built-in, royalty-free)</option>`).join('')}<option value="file">My own song…</option>`;
els.music.value = 'upbeat';

/* ---------------------------------------------------------------- photos */
async function addPhotos(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Please add photos.', 'err'); return; }
  setStatus(els.status, `Opening ${imgs.length} photo${imgs.length > 1 ? 's' : ''}…`);
  for (const f of imgs) {
    try {
      let img = await decodeImage(f);
      const k = Math.min(1, 2400 / Math.max(img.width, img.height));   // plenty for 1080p video, easy on memory
      if (k < 1) img = await createImageBitmap(img, { resizeWidth: Math.round(img.width * k), resizeHeight: Math.round(img.height * k), resizeQuality: 'high' });
      const t = document.createElement('canvas'), tk = 120 / Math.max(img.width, img.height); t.width = Math.round(img.width * tk); t.height = Math.round(img.height * tk);
      t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
      photos.push({ id: nextId++, img, name: f.name, thumb: t.toDataURL('image/jpeg', 0.7) });
    } catch (_) { /* skip unreadable files */ }
  }
  bgCache.clear();
  els.work.hidden = !photos.length; els.drop.classList.toggle('compact', photos.length > 0); els.run.disabled = !photos.length;
  renderStrip(); refit(); seek(0);
  setStatus(els.status, 'Press ▶ to preview. Drag photos to reorder; pick a size, transition and music on the right.', 'ok');
}
setupDropzone(els.drop, els.input, addPhotos);
els.add.addEventListener('click', () => els.addIn.click());
els.addIn.addEventListener('change', () => { const fs = [...els.addIn.files]; els.addIn.value = ''; if (fs.length) addPhotos(fs); });
function renderStrip() {
  els.strip.innerHTML = photos.map((p, i) => `<li class="ss-thumb" data-id="${p.id}" draggable="true" title="${escapeHtml(p.name)}"><img src="${p.thumb}" alt=""><span>${i + 1}</span>
    <div class="ss-tctl"><button type="button" data-a="l" aria-label="Move earlier">‹</button><button type="button" data-a="rm" aria-label="Remove">✕</button><button type="button" data-a="r" aria-label="Move later">›</button></div></li>`).join('');
}
els.strip.addEventListener('click', (e) => {
  const li = e.target.closest('[data-id]'); if (!li) return;
  const i = photos.findIndex((p) => p.id === +li.dataset.id), a = e.target.closest('[data-a]')?.dataset.a;
  if (a === 'rm') photos.splice(i, 1);
  else if (a === 'l' && i > 0) [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]];
  else if (a === 'r' && i < photos.length - 1) [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]];
  else { seek(start(i) + 0.01); return; }
  els.run.disabled = !photos.length; renderStrip(); refit(); draw();
});
let dragId = null;
els.strip.addEventListener('dragstart', (e) => { const li = e.target.closest('[data-id]'); if (li) { dragId = +li.dataset.id; e.dataTransfer.effectAllowed = 'move'; } });
els.strip.addEventListener('dragover', (e) => { if (dragId != null) e.preventDefault(); });
els.strip.addEventListener('drop', (e) => {
  e.preventDefault(); const li = e.target.closest('[data-id]'); if (dragId == null || !li) return;
  const from = photos.findIndex((p) => p.id === dragId), to = photos.findIndex((p) => p.id === +li.dataset.id);
  const [p] = photos.splice(from, 1); photos.splice(to, 0, p); dragId = null; renderStrip(); draw();
});

/* ---------------------------------------------------------------- timing */
const per = () => +els.per.value;                 // seconds each photo is on screen
const tr = () => (els.trans.value === 'none' ? 0 : Math.min(1, per() * 0.4));   // transition overlap
const start = (i) => i * per();
const total = () => (photos.length ? photos.length * per() + tr() : 0);
function refit() {
  // "fit to song": spread the photos over the length of your own song
  if (els.fitMusic.checked && music && els.music.value === 'file' && photos.length) {
    // n photos × per + one transition (0.4 × per, at most 1 s) should end just before the song does
    const n = photos.length, d = music.duration - 0.2;
    let p = (d - 1) / n; if (p * 0.4 < 1 || els.trans.value === 'none') p = d / (n + (els.trans.value === 'none' ? 0 : 0.4));
    els.per.value = Math.max(1, Math.min(10, Math.floor(p * 10) / 10)).toFixed(1);
  }
  els.perV.textContent = `${(+els.per.value).toFixed(1)} s`;
  els.total.textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ${fmtTime(total())} video` : '';
}

/* ---------------------------------------------------------------- drawing */
const bgCache = new Map();   // blurred backgrounds for "fit" mode, per photo & size
function rand(seed) { let x = Math.sin(seed * 9301 + 49297) * 233280; return x - Math.floor(x); }
const TRANS = ['fade', 'slide', 'zoom', 'wipe'];
function transOf(i) { const v = els.trans.value; return v === 'mixed' ? TRANS[i % TRANS.length] : v; }
function blurredBg(p, W, H) {
  const key = `${p.id}|${W}x${H}|${els.fit.value}`;
  if (bgCache.has(key)) return bgCache.get(key);
  const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(W / 4)); c.height = Math.max(1, Math.round(H / 4));
  const g = c.getContext('2d'), s = Math.max(c.width / p.img.width, c.height / p.img.height) * 1.2;
  g.filter = 'blur(12px) brightness(.7) saturate(1.2)'; g.drawImage(p.img, (c.width - p.img.width * s) / 2, (c.height - p.img.height * s) / 2, p.img.width * s, p.img.height * s);
  bgCache.set(key, c); return c;
}
/** Draw photo i at time t (seconds since the video start) into a W×H context. */
function drawPhoto(g, i, t, W, H) {
  const p = photos[i]; if (!p) return;
  const life = per() + tr(), u = Math.max(0, Math.min(1, (t - start(i)) / life));
  const fit = els.fit.value;
  if (fit === 'blur') g.drawImage(blurredBg(p, W, H), 0, 0, W, H);
  else if (fit === 'color') { g.fillStyle = els.bg.value; g.fillRect(0, 0, W, H); }
  const cover = fit === 'fill', iw = p.img.width, ih = p.img.height;
  let s = cover ? Math.max(W / iw, H / ih) : Math.min(W / iw, H / ih);
  let dx = 0, dy = 0;
  if (els.kb.checked) {   // slow zoom & pan, different for every photo
    const zin = rand(i + 1) > 0.5, z = 1.04 + 0.1 * (zin ? u : 1 - u);
    const ang = rand(i + 7) * Math.PI * 2, amp = cover ? 0.035 : 0.02;
    s *= z; dx = Math.cos(ang) * amp * W * (u - 0.5); dy = Math.sin(ang) * amp * H * (u - 0.5);
  }
  const w = iw * s, h = ih * s;
  g.drawImage(p.img, (W - w) / 2 + dx, (H - h) / 2 + dy, w, h);
}
function render(g, t, W, H) {
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  const n = photos.length; if (!n) { g.restore(); return; }
  const i = Math.min(n - 1, Math.floor(t / per())), into = t - start(i), T = tr();
  if (i > 0 && T && into < T) {   // transition from photo i-1 to photo i
    const q = into / T, e = q < 0.5 ? 2 * q * q : 1 - (-2 * q + 2) ** 2 / 2, kind = transOf(i);
    drawPhoto(g, i - 1, t, W, H);
    g.save();
    if (kind === 'fade') g.globalAlpha = e;
    else if (kind === 'slide') g.translate(W * (1 - e), 0);
    else if (kind === 'zoom') { g.globalAlpha = e; g.translate(W / 2, H / 2); g.scale(0.85 + 0.15 * e, 0.85 + 0.15 * e); g.translate(-W / 2, -H / 2); }
    else if (kind === 'wipe') { g.beginPath(); g.rect(0, 0, W * e, H); g.clip(); }
    drawPhoto(g, i, t, W, H);
    g.restore();
  } else drawPhoto(g, i, t, W, H);
  // title & subtitle over the first photo (fade out before the second)
  const title = els.title.value.trim(), sub = els.sub.value.trim();
  if ((title || sub) && t < per()) {
    const a = Math.min(1, t / 0.4, (per() - t) / 0.5), base = Math.min(W, H);
    g.globalAlpha = Math.max(0, a);
    const grad = g.createLinearGradient(0, H * 0.45, 0, H); grad.addColorStop(0, 'rgba(0,0,0,0)'); grad.addColorStop(1, 'rgba(0,0,0,.6)');
    g.fillStyle = grad; g.fillRect(0, H * 0.45, W, H * 0.55);
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = base * 0.02;
    let y = H * (W > H ? 0.78 : 0.8);
    if (title) { g.font = `800 ${Math.round(base * 0.085)}px Poppins, Inter, system-ui, sans-serif`; wrap(g, title, W / 2, y - (sub ? base * 0.06 : 0), W * 0.86, base * 0.095); }
    if (sub) { g.font = `500 ${Math.round(base * 0.042)}px Inter, system-ui, sans-serif`; g.fillText(sub, W / 2, y + base * 0.04, W * 0.86); }
  }
  g.restore();
}
function wrap(g, text, x, y, maxW, lh) {
  const words = text.split(/\s+/), lines = []; let line = '';
  for (const w of words) { const tst = line ? `${line} ${w}` : w; if (g.measureText(tst).width > maxW && line) { lines.push(line); line = w; } else line = tst; }
  lines.push(line);
  lines.slice(0, 3).forEach((l, k) => g.fillText(l, x, y - (lines.length - 1 - k) * lh));
}

/* ---------------------------------------------------------------- preview player */
let t = 0, playing = false, raf = 0, actx = null, msrc = null, t0 = 0;
function dims() { return SIZES[els.aspect.value]; }
function draw() {
  const [W, H] = dims(), k = Math.min(1, 640 / Math.max(W, H)), c = els.canvas;
  const cw = Math.round(W * k), ch = Math.round(H * k);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  render(c.getContext('2d'), t, cw, ch);
  const T = total(); els.time.textContent = `${fmtTime(t)} / ${fmtTime(T)}`; els.seek.value = T ? (t / T) * 1000 : 0;
}
function seek(x) { t = Math.max(0, Math.min(total(), x)); if (playing) { stop(); play(); } else draw(); }
async function play() {
  if (!photos.length) return;
  if (t >= total() - 0.05) t = 0;
  playing = true; els.play.textContent = '❚❚';
  const m = await ensureMusic().catch(() => null);
  if (!playing) return;
  actx = actx || new AudioContext(); await actx.resume();
  if (m) { msrc = actx.createBufferSource(); msrc.buffer = m; msrc.loop = els.music.value !== 'file'; const gn = actx.createGain(); gn.gain.value = +els.vol.value / 100; msrc.connect(gn).connect(actx.destination); msrc.start(0, t % m.duration); }
  t0 = actx.currentTime - t;
  const tick = () => { if (!playing) return; t = actx.currentTime - t0; if (t >= total()) { t = total(); stop(); draw(); return; } draw(); raf = requestAnimationFrame(tick); };
  tick();
}
function stop() { playing = false; cancelAnimationFrame(raf); if (msrc) { try { msrc.stop(); } catch (_) { /* ended */ } msrc = null; } els.play.textContent = '▶'; }
els.play.addEventListener('click', () => (playing ? stop() : play()));
els.seek.addEventListener('input', () => seek((els.seek.value / 1000) * total()));
[els.aspect, els.trans, els.kb, els.fit, els.bg, els.title, els.sub].forEach((x) => x.addEventListener('input', () => { bgCache.clear(); refit(); if (!playing) draw(); }));
els.per.addEventListener('input', () => { els.fitMusic.checked = false; refit(); if (!playing) draw(); });
els.bg.closest('.t-field').hidden = els.fit.value !== 'color';
els.fit.addEventListener('change', () => { els.bg.closest('.t-field').hidden = els.fit.value !== 'color'; });

/* ---------------------------------------------------------------- music */
let music = null, musicKey = '', musicFile = null;
async function ensureMusic() {
  const v = els.music.value;
  if (v === 'none') return null;
  const key = v === 'file' ? `file|${musicFile && musicFile.name}` : v;
  if (music && musicKey === key) return music;
  actx = actx || new AudioContext();
  if (v === 'file') {
    if (!musicFile) return null;
    setStatus(els.status, `Loading “${musicFile.name}”…`);
    music = await actx.decodeAudioData(await musicFile.arrayBuffer());
  } else {
    setStatus(els.status, `Composing ${MUSIC_STYLES[v].name} music…`);
    const { ch } = await generateMusic(v, SR);
    music = new AudioBuffer({ length: ch[0].length, numberOfChannels: 2, sampleRate: SR }); music.copyToChannel(ch[0], 0); music.copyToChannel(ch[1] || ch[0], 1);
  }
  musicKey = key; setStatus(els.status, 'Music ready.', 'ok');
  return music;
}
els.music.addEventListener('change', async () => {
  stop();
  if (els.music.value === 'file') { els.musicIn.click(); return; }
  els.musicName.textContent = ''; els.fitMusic.closest('label').hidden = true;
  try { await ensureMusic(); } catch (_) { /* reported on export */ }
});
els.musicIn.addEventListener('change', async () => {
  const f = els.musicIn.files[0]; els.musicIn.value = '';
  if (!f) { if (!musicFile) els.music.value = 'none'; return; }
  musicFile = f; els.musicName.textContent = `🎵 ${f.name}`; els.fitMusic.closest('label').hidden = false;
  try { await ensureMusic(); refit(); draw(); } catch (_) { setStatus(els.status, 'That song could not be read. Try an MP3 or M4A.', 'err'); els.music.value = 'none'; }
});
els.fitMusic.addEventListener('change', () => { refit(); draw(); });
ensureMusic().catch(() => {});   // compose the default track in the background

/** The soundtrack for the whole video: looped or trimmed, faded in and out, at the chosen volume. */
async function soundtrack(T) {
  const m = await ensureMusic(); if (!m) return null;
  const len = Math.round(T * SR), ctx = new OfflineAudioContext(2, len, SR);
  const src = ctx.createBufferSource(); src.buffer = m; src.loop = true;
  const gn = ctx.createGain(), v = +els.vol.value / 100, fo = Math.min(2.5, T / 3);
  gn.gain.setValueAtTime(0, 0); gn.gain.linearRampToValueAtTime(v, Math.min(0.6, T / 4));
  gn.gain.setValueAtTime(v, T - fo); gn.gain.linearRampToValueAtTime(0, T);
  src.connect(gn).connect(ctx.destination); src.start(0);
  return ctx.startRendering();
}

/* ---------------------------------------------------------------- export */
els.run.addEventListener('click', async () => {
  if (!photos.length) return;
  stop(); els.run.disabled = true; els.result.hidden = true;
  const t1 = performance.now();
  try {
    const MB = await loadMediabunny();
    const [W, H] = dims(), T = total(), frames = Math.ceil(T * FPS);
    const vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
    if (!vcodec) throw new Error('Your browser has no suitable video encoder.');
    const mp4 = vcodec === 'avc';
    const output = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const canvas = new OffscreenCanvas(W, H), g = canvas.getContext('2d'); g.imageSmoothingQuality = 'high';
    const vsrc = new MB.CanvasSource(canvas, { codec: vcodec, bitrate: MB.QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(vsrc, { frameRate: FPS });
    const audio = await soundtrack(T);
    let asrc = null;
    if (audio) { const ac = await MB.getFirstEncodableAudioCodec(mp4 ? ['aac', 'opus'] : ['opus', 'vorbis']); if (ac) { asrc = new MB.AudioBufferSource({ codec: ac, bitrate: 192_000 }); output.addAudioTrack(asrc); } }
    await output.start();
    if (asrc) await asrc.add(audio);
    for (let f = 0; f < frames; f++) {
      render(g, f / FPS, W, H);
      await vsrc.add(f / FPS, 1 / FPS);
      if (f % 10 === 0) { els.bar.hidden = false; els.fill.style.width = `${Math.round((f / frames) * 100)}%`; setStatus(els.status, `Creating your video… ${Math.round((f / frames) * 100)}%`); }
    }
    await output.finalize();
    const blob = new Blob([output.target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' }), ext = mp4 ? 'mp4' : 'webm';
    els.result.hidden = false; els.result.querySelector('video').src = URL.createObjectURL(blob);
    els.resultInfo.textContent = `slideshow.${ext} · ${W}×${H} · ${fmtTime(T)} · ${formatBytes(blob.size)} · made in ${((performance.now() - t1) / 1000).toFixed(1)} s`;
    els.dl.onclick = () => downloadBlob(blob, `slideshow-${els.aspect.value.replace(':', 'x')}.${ext}`);
    setStatus(els.status, 'Done! Watch it below, then download.', 'ok');
    els.result.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Could not create the video.', 'err'); }
  els.bar.hidden = true; els.run.disabled = !photos.length;
});
refit();
window.__ssTest = { get photos() { return photos; }, total, seek, render };
