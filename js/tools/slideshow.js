/* WebcamClicks — Slideshow maker (pro): photos + music → MP4.
   12 one-click editing styles, ~35 transitions (random, cycle or one), 17 colour looks, animated overlays and particles,
   motion styles, title / caption / end-card text styles, beat sync, per-photo settings and a full-screen player.
   Everything is drawn on canvas and encoded on the device. */

import { $, $$, setupDropzone, setStatus, downloadBlob, decodeImage, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';
import { generateMusic, MUSIC_STYLES } from './sr/music.js';
import { rng, ease, mkCanvas, LOOKS, bakeLook, TRANSITIONS, TRANSITION_GROUPS, OVERLAYS, drawOverlays, TEXT_STYLES, drawText, FONT_CSS } from './slideshow/fx.js';

const $id = (s) => document.getElementById(s);
const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), work: $id('ss-work'), player: $id('ss-player'), canvas: $id('ss-canvas'), strip: $id('ss-strip'),
  play: $id('ss-play'), seek: $id('ss-seek'), time: $id('ss-time'), fs: $id('ss-fs'), bigplay: $id('ss-bigplay'), add: $id('ss-add'), addIn: $id('ss-add-in'), shuffle: $id('ss-shuffle'), total: $id('ss-total'),
  aspect: $id('ss-aspect'), quality: $id('ss-quality'), tabs: $id('ss-tabs'),
  templates: $id('ss-templates'), surprise: $id('ss-surprise'),
  tmode: $id('ss-tmode'), tdur: $id('ss-tdur'), tdurV: $id('ss-tdur-v'), tlist: $id('ss-tlist'), reshuffle: $id('ss-reshuffle'), tall: $id('ss-tall'),
  looks: $id('ss-looks'), overlays: $id('ss-overlays'), motion: $id('ss-motion'), fit: $id('ss-fit'), bg: $id('ss-bg'),
  per: $id('ss-per'), perV: $id('ss-per-v'),
  title: $id('ss-title'), sub: $id('ss-sub'), tstyles: $id('ss-tstyles'), captions: $id('ss-captions'), endOn: $id('ss-end'), endTitle: $id('ss-end-title'), endSub: $id('ss-end-sub'),
  music: $id('ss-music'), musicIn: $id('ss-music-in'), musicName: $id('ss-music-name'), vol: $id('ss-vol'), fitMusic: $id('ss-fitmusic'), beat: $id('ss-beat'),
  sel: $id('ss-sel'), selName: $id('ss-sel-name'), selCap: $id('ss-sel-cap'), selDur: $id('ss-sel-dur'), selTrans: $id('ss-sel-trans'), selDup: $id('ss-sel-dup'), selDel: $id('ss-sel-del'), selPrev: $id('ss-sel-prev'), selNext: $id('ss-sel-next'),
  run: $id('ss-run'), bar: $id('ss-bar'), fill: $id('ss-fill'), result: $id('ss-result'), resultInfo: $id('ss-result-info'), dl: $id('ss-dl')
};
if (!document.querySelector('link[data-ss-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONT_CSS; l.dataset.ssFonts = '1'; document.head.appendChild(l); }

const ASPECTS = { '9:16': [9, 16], '1:1': [1, 1], '4:5': [4, 5], '16:9': [16, 9] };
const FPS = 30, SR = 48000;
let photos = [];   // { id, img, name, thumb, cap, dur, trans }
let nextId = 1, selId = null;

/* ---------------------------------------------------------------- settings & editing styles */
const S = {
  per: 3, tdur: 0.8, tmode: 'random', tset: new Set(['fade', 'slideL', 'pushL', 'zoomIn', 'circle', 'wipeR', 'blur', 'whip']), tone: 'fade', seed: 1,
  look: 'none', overlays: new Set(['vignette']), motion: 'kb', fit: 'blur', bg: '#111111',
  textStyle: 'clean', captions: true, end: false
};
const TEMPLATES = {
  travel: { name: 'Travel vlog', icon: '✈️', look: 'vivid', overlays: ['vignette'], motion: 'kb', fit: 'blur', t: ['pushL', 'pushR', 'whip', 'slideU', 'zoomIn', 'circle'], tdur: 0.6, per: 2.5, text: 'bold', music: 'upbeat' },
  wedding: { name: 'Wedding', icon: '💍', look: 'rose', overlays: ['petals', 'vignette', 'leaks'], motion: 'kb', fit: 'blur', t: ['fade', 'white', 'blur', 'heart', 'zoomOut'], tdur: 1.2, per: 3.5, text: 'elegant', music: 'ambient' },
  birthday: { name: 'Birthday', icon: '🎂', look: 'vivid', overlays: ['confetti', 'sparkles'], motion: 'kb', fit: 'polaroid', t: ['zoomIn', 'spin', 'drop', 'flash', 'circle'], tdur: 0.7, per: 2.5, text: 'pop', music: 'upbeat' },
  memories: { name: 'Memories', icon: '📼', look: 'vintage', overlays: ['grain', 'dust', 'vignette', 'leaks'], motion: 'kb', fit: 'blur', t: ['black', 'burn', 'fade'], tdur: 1.2, per: 3.5, text: 'typewriter', music: 'lofi' },
  cinematic: { name: 'Cinematic', icon: '🎬', look: 'cinematic', overlays: ['bars', 'grain', 'vignette'], motion: 'in', fit: 'fill', t: ['black', 'fade', 'blur'], tdur: 1.2, per: 4, text: 'elegant', music: 'cinematic' },
  hype: { name: 'Hype / beat', icon: '⚡', look: 'cross', overlays: ['vignette'], motion: 'beat', fit: 'fill', t: ['flash', 'glitch', 'whip', 'zoomIn', 'pixel', 'cut'], tdur: 0.3, per: 1.2, text: 'bold', music: 'upbeat', beat: true },
  love: { name: 'Love story', icon: '💖', look: 'rose', overlays: ['hearts', 'bokeh', 'vignette'], motion: 'kb', fit: 'card', t: ['heart', 'fade', 'white'], tdur: 1, per: 3, text: 'script', music: 'ambient' },
  retro: { name: 'Retro VHS', icon: '📺', look: 'faded', overlays: ['vhs', 'grain'], motion: 'kb', fit: 'fill', t: ['glitch', 'pixel', 'cut', 'blindsH'], tdur: 0.5, per: 2.5, text: 'typewriter', music: 'lofi' },
  holiday: { name: 'Holidays', icon: '🎄', look: 'warm', overlays: ['snow', 'bokeh', 'vignette'], motion: 'kb', fit: 'blur', t: ['fade', 'circle', 'white', 'zoomOut'], tdur: 1, per: 3, text: 'elegant', music: 'ambient' },
  noir: { name: 'Film noir', icon: '🎞️', look: 'noir', overlays: ['grain', 'vignette', 'dust'], motion: 'in', fit: 'fill', t: ['black', 'fade', 'doors'], tdur: 1.1, per: 3.5, text: 'elegant', music: 'cinematic' },
  polaroid: { name: 'Polaroid', icon: '📸', look: 'film', overlays: ['grain'], motion: 'kb', fit: 'polaroid', t: ['drop', 'slideU', 'spin', 'pushL'], tdur: 0.8, per: 3, text: 'script', music: 'lofi' },
  business: { name: 'Business', icon: '💼', look: 'none', overlays: [], motion: 'kb', fit: 'card', t: ['pushL', 'wipeL', 'fade'], tmode: 'cycle', tdur: 0.7, per: 3, text: 'box', music: 'corporate' }
};
let template = 'travel';

/* ---------------------------------------------------------------- photos */
async function addPhotos(files) {
  const imgs = files.filter((f) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp|jpe?g|png)$/i.test(f.name));
  if (!imgs.length) { setStatus(els.status, 'Please add photos.', 'err'); return; }
  setStatus(els.status, `Opening ${imgs.length} photo${imgs.length > 1 ? 's' : ''}…`);
  for (const f of imgs) {
    try {
      let img = await decodeImage(f);
      const k = Math.min(1, 2048 / Math.max(img.width, img.height));
      if (k < 1) img = await createImageBitmap(img, { resizeWidth: Math.round(img.width * k), resizeHeight: Math.round(img.height * k), resizeQuality: 'high' });
      const t = mkCanvas(img.width * (140 / Math.max(img.width, img.height)), img.height * (140 / Math.max(img.width, img.height)));
      t.getContext('2d').drawImage(img, 0, 0, t.width, t.height);
      photos.push({ id: nextId++, img, name: f.name, thumb: t.toDataURL('image/jpeg', 0.7), cap: '', dur: 0, trans: '' });
    } catch (_) { /* skip unreadable files */ }
  }
  els.work.hidden = !photos.length; els.drop.classList.toggle('compact', photos.length > 0); els.run.disabled = !photos.length;
  renderStrip(); renderLooks(); bakeAll(); refit(); seek(0);
  setStatus(els.status, 'Pick an editing style, press ▶ to preview, or ⛶ for full screen.', 'ok');
}
setupDropzone(els.drop, els.input, addPhotos);
els.add.addEventListener('click', () => els.addIn.click());
els.addIn.addEventListener('change', () => { const fs = [...els.addIn.files]; els.addIn.value = ''; if (fs.length) addPhotos(fs); });
els.shuffle.addEventListener('click', () => { for (let i = photos.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [photos[i], photos[j]] = [photos[j], photos[i]]; } renderStrip(); seek(0); });

function renderStrip() {
  els.strip.innerHTML = photos.map((p, i) => `<li class="ss-thumb${p.id === selId ? ' sel' : ''}" data-id="${p.id}" draggable="true" title="${escapeHtml(p.name)}"><img src="${p.thumb}" alt=""><span>${i + 1}</span>${p.cap ? '<em>T</em>' : ''}</li>`).join('');
  syncSel();
}
els.strip.addEventListener('click', (e) => {
  const li = e.target.closest('[data-id]'); if (!li) return;
  selId = +li.dataset.id; renderStrip();
  const i = photos.findIndex((p) => p.id === selId); seek(slideStart(i) + Math.min(tdur(), 0.5) + 0.3);
});
let dragId = null;
els.strip.addEventListener('dragstart', (e) => { const li = e.target.closest('[data-id]'); if (li) { dragId = +li.dataset.id; e.dataTransfer.effectAllowed = 'move'; } });
els.strip.addEventListener('dragover', (e) => { if (dragId != null) e.preventDefault(); });
els.strip.addEventListener('drop', (e) => {
  e.preventDefault(); const li = e.target.closest('[data-id]'); if (dragId == null || !li) return;
  const from = photos.findIndex((p) => p.id === dragId), to = photos.findIndex((p) => p.id === +li.dataset.id);
  const [p] = photos.splice(from, 1); photos.splice(to, 0, p); dragId = null; renderStrip(); refit(); draw();
});

/* per-photo settings */
els.selTrans.innerHTML = `<option value="">Auto (from the style)</option>${Object.entries(TRANSITIONS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('')}`;
els.selDur.innerHTML = `<option value="0">Auto</option>${[1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].map((d) => `<option value="${d}">${d} s</option>`).join('')}`;
const selected = () => photos.find((p) => p.id === selId);
function syncSel() {
  const p = selected(); els.sel.hidden = !p; if (!p) return;
  const i = photos.indexOf(p);
  els.selName.textContent = `Photo ${i + 1} of ${photos.length}`;
  els.selCap.value = p.cap; els.selDur.value = String(p.dur || 0); els.selTrans.value = p.trans || '';
  els.selPrev.disabled = i === 0; els.selNext.disabled = i === photos.length - 1;
}
els.selCap.addEventListener('input', () => { const p = selected(); if (p) { p.cap = els.selCap.value; if (!playing) draw(); } });
els.selCap.addEventListener('change', renderStrip);
els.selDur.addEventListener('change', () => { const p = selected(); if (p) { p.dur = +els.selDur.value; refit(); draw(); } });
els.selTrans.addEventListener('change', () => { const p = selected(); if (p) { p.trans = els.selTrans.value; const i = photos.indexOf(p); seek(Math.max(0, slideStart(i) - 0.4)); } });
els.selDel.addEventListener('click', () => { const i = photos.findIndex((p) => p.id === selId); if (i < 0) return; photos.splice(i, 1); selId = photos[Math.min(i, photos.length - 1)]?.id ?? null; els.run.disabled = !photos.length; renderStrip(); refit(); draw(); });
els.selDup.addEventListener('click', () => { const i = photos.findIndex((p) => p.id === selId); if (i < 0) return; const c = { ...photos[i], id: nextId++ }; photos.splice(i + 1, 0, c); looked.forEach((v, k) => { if (k.startsWith(`${photos[i].id}|`)) looked.set(k.replace(/^\d+\|/, `${c.id}|`), v); }); selId = c.id; renderStrip(); refit(); draw(); });
els.selPrev.addEventListener('click', () => { const i = photos.findIndex((p) => p.id === selId); if (i > 0) { [photos[i - 1], photos[i]] = [photos[i], photos[i - 1]]; renderStrip(); draw(); } });
els.selNext.addEventListener('click', () => { const i = photos.findIndex((p) => p.id === selId); if (i >= 0 && i < photos.length - 1) { [photos[i + 1], photos[i]] = [photos[i], photos[i + 1]]; renderStrip(); draw(); } });

/* ---------------------------------------------------------------- timing (with optional beat sync) */
const bpm = () => (els.music.value !== 'none' && els.music.value !== 'file' && MUSIC_STYLES[els.music.value] ? MUSIC_STYLES[els.music.value].bpm : 0);
function snap(d) { const b = bpm(); if (!els.beat.checked || !b) return d; const beat = 60 / b; return Math.max(2, Math.round(d / beat)) * beat; }
const durOf = (p) => snap(p.dur || S.per);
const END = 3;
function slideList() { const l = photos.map((p, i) => ({ kind: 'photo', i, p, dur: durOf(p) })); if (S.end && photos.length) l.push({ kind: 'end', dur: snap(END) }); return l; }
let SL = [], STARTS = [];
function refit() {
  if (els.fitMusic.checked && music && els.music.value === 'file' && photos.length) {
    const n = photos.length + (S.end ? END / S.per : 0), d = music.duration - 0.2;
    S.per = Math.max(1, Math.min(10, Math.floor((d / n) * 10) / 10)); els.per.value = S.per;
  }
  SL = slideList(); STARTS = []; let acc = 0; for (const s of SL) { STARTS.push(acc); acc += s.dur; }
  els.perV.textContent = `${(+els.per.value).toFixed(1)} s`;
  els.tdurV.textContent = `${S.tdur.toFixed(1)} s`;
  els.total.textContent = photos.length ? `${photos.length} photo${photos.length > 1 ? 's' : ''} · ${fmtTime(total())}` : '';
}
const total = () => (SL.length ? STARTS[STARTS.length - 1] + SL[SL.length - 1].dur : 0);
const slideStart = (i) => STARTS[i] || 0;
const tdur = () => Math.min(S.tdur, ...SL.map((s) => s.dur * 0.45), 2);
function transFor(k) {   // transition into slide k
  const s = SL[k]; if (s && s.kind === 'photo' && s.p.trans) return s.p.trans;
  if (s && s.kind === 'end') return 'fade';
  const list = [...S.tset].filter((x) => TRANSITIONS[x]);
  if (S.tmode === 'one') return S.tone;
  if (!list.length) return 'fade';
  if (S.tmode === 'cycle') return list[(k - 1) % list.length];
  const r = rng(S.seed * 7919 + k * 104729); r(); return list[Math.floor(r() * list.length)];
}

/* ---------------------------------------------------------------- looks: baked per photo (in the background) */
const looked = new Map();   // `${id}|${look}` → canvas
let baking = null;
function imgOf(p) { return looked.get(`${p.id}|${S.look}`) || p.img; }
function bakeAll() {
  const look = S.look; if (look === 'none') return Promise.resolve();
  const job = (async () => {
    for (const p of [...photos]) {
      const key = `${p.id}|${look}`; if (looked.has(key)) continue;
      await new Promise((r) => setTimeout(r, 0));
      if (S.look !== look) return;
      looked.set(key, bakeLook(p.img, look)); bgCache.clear(); if (!playing) draw();
    }
  })();
  baking = job; return job;
}
// mini look previews (first photo)
function renderLooks() {
  const p = photos[0];
  els.looks.innerHTML = Object.entries(LOOKS).map(([k, L]) => `<button type="button" class="ss-look" data-look="${k}" aria-pressed="${k === S.look}"><canvas width="96" height="96"></canvas><small>${L.name}</small></button>`).join('');
  if (!p) return;
  const small = mkCanvas(96, 96), sg = small.getContext('2d'), s = Math.max(96 / p.img.width, 96 / p.img.height);
  sg.drawImage(p.img, (96 - p.img.width * s) / 2, (96 - p.img.height * s) / 2, p.img.width * s, p.img.height * s);
  $$('[data-look]', els.looks).forEach((b) => b.querySelector('canvas').getContext('2d').drawImage(bakeLook(small, b.dataset.look, 96), 0, 0));
}

/* ---------------------------------------------------------------- drawing */
const bgCache = new Map();
function blurredBg(p, W, H) {
  const key = `${p.id}|${S.look}|${W}x${H}`; if (bgCache.has(key)) return bgCache.get(key);
  const im = imgOf(p), c = mkCanvas(W / 4, H / 4), g = c.getContext('2d'), s = Math.max(c.width / im.width, c.height / im.height) * 1.15;
  g.filter = 'blur(10px) brightness(.62) saturate(1.25)'; g.drawImage(im, (c.width - im.width * s) / 2, (c.height - im.height * s) / 2, im.width * s, im.height * s);
  if (bgCache.size > 80) bgCache.clear();
  bgCache.set(key, c); return c;
}
function motion(k, u, t) {   // → { z: zoom, x, y } (pan as fraction of size)
  const m = S.motion, r = rng(SL[k] && SL[k].p ? SL[k].p.id * 31 + 5 : 9); const a = r(), b = r() * Math.PI * 2;
  if (m === 'none') return { z: 1, x: 0, y: 0 };
  if (m === 'in') return { z: 1 + 0.14 * u, x: 0, y: 0 };
  if (m === 'out') return { z: 1.14 - 0.14 * u, x: 0, y: 0 };
  if (m === 'pan') return { z: 1.12, x: (a > 0.5 ? 1 : -1) * 0.05 * (u - 0.5), y: 0 };
  if (m === 'beat') { const beat = 60 / (bpm() || 120), ph = (t % beat) / beat; return { z: 1.04 + 0.05 * Math.exp(-ph * 6), x: 0, y: 0 }; }
  return { z: 1.03 + 0.11 * (a > 0.5 ? u : 1 - u), x: Math.cos(b) * 0.035 * (u - 0.5), y: Math.sin(b) * 0.035 * (u - 0.5) };   // Ken Burns
}
function rrect(g, x, y, w, h, r) { g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
function drawSlide(g, k, t, W, H) {
  const s = SL[k]; if (!s) return;
  const life = s.dur + tdur(), u = Math.max(0, Math.min(1, (t - STARTS[k]) / life));
  if (s.kind === 'end') {
    const last = photos[photos.length - 1]; if (last) g.drawImage(blurredBg(last, W, H), 0, 0, W, H); else { g.fillStyle = '#111'; g.fillRect(0, 0, W, H); }
    g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(0, 0, W, H);
    drawText(g, els.endTitle.value.trim() || 'Thanks for watching', els.endSub.value.trim(), S.textStyle, t - STARTS[k], 99, W, H, 'center', 0.95);
    return;
  }
  const p = s.p, im = imgOf(p), fit = S.fit, mo = motion(k, u, t), base = Math.min(W, H);
  if (fit === 'fill') {
    const sc = Math.max(W / im.width, H / im.height) * mo.z, w = im.width * sc, h = im.height * sc;
    g.drawImage(im, (W - w) / 2 + mo.x * W, (H - h) / 2 + mo.y * H, w, h); return;
  }
  if (fit === 'color') { g.fillStyle = S.bg; g.fillRect(0, 0, W, H); } else g.drawImage(blurredBg(p, W, H), 0, 0, W, H);
  const zc = 1 + (mo.z - 1) * 0.45;   // calmer motion when the whole photo is shown
  if (fit === 'polaroid' || fit === 'card') {
    const pad = fit === 'polaroid' ? 0.045 : 0, bottom = fit === 'polaroid' ? 0.16 : 0;
    const maxW = W * 0.8, maxH = H * 0.74, ar = im.width / im.height;
    let pw = maxW / (1 + 2 * pad), ph = pw / ar; if (ph * (1 + pad + bottom) > maxH) { ph = maxH / (1 + pad + bottom); pw = ph * ar; }
    const cw = pw + 2 * pad * pw, ch = ph + pad * pw + bottom * ph;
    const rot = fit === 'polaroid' ? (rng(p.id * 13 + 1)() - 0.5) * 0.12 : 0;
    g.save(); g.translate(W / 2 + mo.x * W * 0.5, H / 2 + mo.y * H * 0.5); g.rotate(rot); g.scale(zc, zc);
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = base * 0.05; g.shadowOffsetY = base * 0.015;
    if (fit === 'polaroid') { g.fillStyle = '#fbfaf6'; g.fillRect(-cw / 2, -ch / 2, cw, ch); g.shadowColor = 'transparent'; g.drawImage(im, -pw / 2, -ch / 2 + pad * pw, pw, ph);
      if (p.cap && els.captions.checked) { g.fillStyle = '#333'; g.font = `700 ${Math.round(ph * 0.07)}px "Dancing Script", cursive`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(p.cap, 0, ch / 2 - bottom * ph / 2, cw * 0.9); } }
    else { rrect(g, -pw / 2, -ph / 2, pw, ph, base * 0.03); g.fillStyle = '#000'; g.fill(); g.shadowColor = 'transparent'; g.clip(); g.drawImage(im, -pw / 2, -ph / 2, pw, ph); }
    g.restore(); return;
  }
  const sc = Math.min(W / im.width, H / im.height) * zc, w = im.width * sc, h = im.height * sc;
  g.drawImage(im, (W - w) / 2 + mo.x * W * 0.5, (H - h) / 2 + mo.y * H * 0.5, w, h);
}
let bufA = null, bufB = null;
const buf = (b, W, H) => (b && b.width === W && b.height === H ? b : mkCanvas(W, H));
function render(g, t, W, H, frame = Math.floor(t * FPS)) {
  g.save(); g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
  if (!SL.length) { g.restore(); return; }
  let k = STARTS.length - 1; while (k > 0 && STARTS[k] > t) k--;
  const into = t - STARTS[k], T = tdur(), kind = k > 0 ? transFor(k) : 'cut';
  if (k > 0 && T > 0 && into < T && kind !== 'cut') {
    bufA = buf(bufA, W, H); bufB = buf(bufB, W, H);
    const ga = bufA.getContext('2d'), gb = bufB.getContext('2d');
    ga.save(); ga.fillStyle = '#000'; ga.fillRect(0, 0, W, H); drawSlide(ga, k - 1, t, W, H); ga.restore();
    gb.save(); gb.fillStyle = '#000'; gb.fillRect(0, 0, W, H); drawSlide(gb, k, t, W, H); gb.restore();
    const q = into / T; g.save(); (TRANSITIONS[kind] || TRANSITIONS.fade).f(g, bufA, bufB, ease(q), W, H, q); g.restore();
  } else drawSlide(g, k, t, W, H);
  drawOverlays(g, S.overlays, t, W, H, frame);
  // title over the first photo, captions on each photo
  const first = SL[0];
  if (first && first.kind === 'photo' && t < first.dur && (els.title.value.trim() || els.sub.value.trim())) drawText(g, els.title.value.trim(), els.sub.value.trim(), S.textStyle, t, first.dur - t, W, H, 'center');
  const s = SL[k];
  if (s && s.kind === 'photo' && s.p.cap && els.captions.checked && S.fit !== 'polaroid' && !(k === 0 && els.title.value.trim())) {
    const start = k > 0 ? T : 0; drawText(g, '', s.p.cap, S.textStyle, into - start, s.dur - into, W, H, 'bottom', 0.9);
  }
  g.restore();
}

/* ---------------------------------------------------------------- player (inline & full screen) */
let t = 0, playing = false, raf = 0, actx = null, msrc = null, t0 = 0;
const dims = () => { const [a, b] = ASPECTS[els.aspect.value], q = +els.quality.value; return a >= b ? [Math.round((q * a / b) / 2) * 2, q] : [q, Math.round((q * b / a) / 2) * 2]; };
const isFs = () => document.fullscreenElement === els.player || els.player.classList.contains('fake-fs');
function draw() {
  const [W, H] = dims(), c = els.canvas;
  let k = Math.min(1, 720 / Math.max(W, H));
  if (isFs()) { const r = els.player.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1); k = Math.max(0.1, Math.min(1, (r.width * dpr) / W, (r.height * dpr) / H)); }
  const cw = Math.round(W * k), ch = Math.round(H * k);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  render(c.getContext('2d'), t, cw, ch);
  const T = total(); els.time.textContent = `${fmtTime(t)} / ${fmtTime(T)}`; if (!els.seek.matches(':active')) els.seek.value = T ? (t / T) * 1000 : 0;
  els.player.classList.toggle('playing', playing);
}
function seek(x) { t = Math.max(0, Math.min(total(), x)); if (playing) { stop(); play(); } else draw(); }
async function play() {
  if (!photos.length) return;
  if (t >= total() - 0.05) t = 0;
  playing = true; els.play.textContent = '❚❚'; els.player.classList.add('playing');
  const m = await ensureMusic().catch(() => null);
  if (!playing) return;
  actx = actx || new AudioContext(); await actx.resume();
  if (m) { msrc = actx.createBufferSource(); msrc.buffer = m; msrc.loop = true; const gn = actx.createGain(); gn.gain.value = +els.vol.value / 100; msrc.connect(gn).connect(actx.destination); msrc.start(0, t % m.duration); }
  t0 = actx.currentTime - t;
  const tick = () => { if (!playing) return; t = actx.currentTime - t0; if (t >= total()) { t = total(); stop(); draw(); return; } draw(); raf = requestAnimationFrame(tick); };
  tick();
}
function stop() { playing = false; cancelAnimationFrame(raf); if (msrc) { try { msrc.stop(); } catch (_) { /* ended */ } msrc = null; } els.play.textContent = '▶'; els.player.classList.remove('playing'); }
const toggle = () => (playing ? stop() : play());
els.play.addEventListener('click', toggle); els.bigplay.addEventListener('click', toggle);
els.canvas.addEventListener('click', toggle);
els.seek.addEventListener('input', () => seek((els.seek.value / 1000) * total()));
async function fullscreen() {
  if (isFs()) { if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); els.player.classList.remove('fake-fs'); document.documentElement.classList.remove('ss-lock'); }
  else if (els.player.requestFullscreen) { try { await els.player.requestFullscreen(); } catch (_) { els.player.classList.add('fake-fs'); document.documentElement.classList.add('ss-lock'); } }
  else { els.player.classList.add('fake-fs'); document.documentElement.classList.add('ss-lock'); }   // iPhone: full-window instead
  setTimeout(draw, 60);
}
els.fs.addEventListener('click', fullscreen);
document.addEventListener('fullscreenchange', () => { els.fs.textContent = document.fullscreenElement ? '⤡' : '⛶'; setTimeout(draw, 60); });
els.player.addEventListener('dblclick', fullscreen);
let hideT = 0;
els.player.addEventListener('pointermove', () => { els.player.classList.add('show-ui'); clearTimeout(hideT); hideT = setTimeout(() => els.player.classList.remove('show-ui'), 2200); });
document.addEventListener('keydown', (e) => {
  if (!photos.length || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.code === 'Space') { e.preventDefault(); toggle(); }
  else if (e.key === 'f' || e.key === 'F') fullscreen();
  else if (e.key === 'ArrowRight') seek(t + 2); else if (e.key === 'ArrowLeft') seek(t - 2);
  else if (e.key === 'Escape' && els.player.classList.contains('fake-fs')) fullscreen();
});
window.addEventListener('resize', () => { if (isFs() && !playing) draw(); });

/* ---------------------------------------------------------------- panel: tabs, styles, transitions, effects, text */
els.tabs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tab]'); if (!b) return;
  $$('[data-tab]', els.tabs).forEach((x) => x.setAttribute('aria-selected', String(x === b)));
  $$('.ss-pane').forEach((p) => { p.hidden = p.dataset.pane !== b.dataset.tab; });
});
els.templates.innerHTML = Object.entries(TEMPLATES).map(([k, v]) => `<button type="button" class="ss-tpl" data-tpl="${k}" aria-pressed="${k === template}"><span>${v.icon}</span><b>${v.name}</b></button>`).join('');
function applyTemplate(k) {
  const v = TEMPLATES[k]; template = k;
  $$('[data-tpl]', els.templates).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tpl === k)));
  S.look = v.look; S.overlays = new Set(v.overlays); S.motion = v.motion; S.fit = v.fit; S.tset = new Set(v.t); S.tmode = v.tmode || 'random'; S.tdur = v.tdur; S.per = v.per; S.textStyle = v.text;
  els.beat.checked = !!v.beat;
  if (v.music && els.music.value !== 'file') els.music.value = v.music;
  syncControls(); bakeAll(); refit(); ensureMusic().catch(() => {}); seek(0);
}
els.templates.addEventListener('click', (e) => { const b = e.target.closest('[data-tpl]'); if (b) applyTemplate(b.dataset.tpl); });
els.surprise.addEventListener('click', () => {
  const r = Math.random, pick = (a) => a[Math.floor(r() * a.length)];
  const allT = Object.keys(TRANSITIONS).filter((x) => x !== 'cut');
  S.look = pick(Object.keys(LOOKS)); S.overlays = new Set([pick(['vignette', 'grain', 'leaks', 'bokeh']), ...(r() < 0.5 ? [pick(['snow', 'confetti', 'hearts', 'sparkles', 'bubbles', 'petals', 'dust'])] : [])]);
  S.motion = pick(['kb', 'kb', 'in', 'out', 'pan']); S.fit = pick(['blur', 'fill', 'polaroid', 'card']); S.tset = new Set(Array.from({ length: 5 }, () => pick(allT))); S.tmode = 'random'; S.seed = Math.floor(r() * 1e6);
  S.textStyle = pick(Object.keys(TEXT_STYLES)); S.tdur = pick([0.5, 0.8, 1]);
  if (els.music.value !== 'file') els.music.value = pick(Object.keys(MUSIC_STYLES));
  $$('[data-tpl]', els.templates).forEach((b) => b.setAttribute('aria-pressed', 'false'));
  syncControls(); bakeAll(); refit(); ensureMusic().catch(() => {}); seek(0);
  setStatus(els.status, '🎲 New random style! Press ▶ to see it, or try again.', 'ok');
});
// transitions
els.tlist.innerHTML = TRANSITION_GROUPS.map(([g, keys]) => `<p class="ss-tgroup">${g}</p><div class="ss-chips">${keys.map((k) => `<button type="button" class="ss-chip" data-tr="${k}">${TRANSITIONS[k].name}</button>`).join('')}</div>`).join('');
els.tlist.addEventListener('click', (e) => {
  const b = e.target.closest('[data-tr]'); if (!b) return;
  const k = b.dataset.tr;
  if (S.tmode === 'one') S.tone = k; else { if (S.tset.has(k)) S.tset.delete(k); else S.tset.add(k); }
  syncControls(); refit(); previewTransition();
});
function previewTransition() { if (photos.length < 2) return; const k = Math.min(1, SL.length - 1); seek(Math.max(0, STARTS[k] - 0.5)); if (!playing) play(); }
els.tmode.addEventListener('change', () => { S.tmode = els.tmode.value; syncControls(); refit(); draw(); });
els.tdur.addEventListener('input', () => { S.tdur = +els.tdur.value; refit(); if (!playing) draw(); });
els.reshuffle.addEventListener('click', () => { S.seed = Math.floor(Math.random() * 1e6); if (S.tmode !== 'random') { S.tmode = 'random'; } syncControls(); refit(); seek(0); if (!playing) play(); });
els.tall.addEventListener('click', () => { const all = Object.keys(TRANSITIONS).filter((x) => x !== 'cut'); S.tset = S.tset.size >= all.length ? new Set(['fade']) : new Set(all); S.tmode = 'random'; syncControls(); refit(); draw(); });
// effects
els.looks.addEventListener('click', (e) => { const b = e.target.closest('[data-look]'); if (!b) return; S.look = b.dataset.look; syncControls(); bakeAll(); bgCache.clear(); draw(); });
els.overlays.innerHTML = Object.entries(OVERLAYS).map(([k, n]) => `<button type="button" class="ss-chip" data-ov="${k}">${n}</button>`).join('');
els.overlays.addEventListener('click', (e) => { const b = e.target.closest('[data-ov]'); if (!b) return; const k = b.dataset.ov; if (S.overlays.has(k)) S.overlays.delete(k); else S.overlays.add(k); syncControls(); if (!playing) draw(); });
els.motion.addEventListener('change', () => { S.motion = els.motion.value; draw(); });
els.fit.addEventListener('change', () => { S.fit = els.fit.value; els.bg.closest('.t-field').hidden = S.fit !== 'color'; draw(); });
els.bg.addEventListener('input', () => { S.bg = els.bg.value; draw(); });
els.per.addEventListener('input', () => { S.per = +els.per.value; els.fitMusic.checked = false; refit(); if (!playing) draw(); });
// text
els.tstyles.innerHTML = Object.entries(TEXT_STYLES).map(([k, v]) => `<button type="button" class="ss-tstyle" data-ts="${k}"><canvas width="150" height="56"></canvas><small>${v.name}</small></button>`).join('');
function renderTextStyles() { $$('[data-ts]', els.tstyles).forEach((b) => { const c = b.querySelector('canvas'), g = c.getContext('2d'); const gr = g.createLinearGradient(0, 0, 150, 56); gr.addColorStop(0, '#3a3f4b'); gr.addColorStop(1, '#16181d'); g.fillStyle = gr; g.fillRect(0, 0, 150, 56); drawText(g, 'Aa Title', '', b.dataset.ts, 5, 5, 150, 56, 'center', 2.6); }); }
els.tstyles.addEventListener('click', (e) => { const b = e.target.closest('[data-ts]'); if (!b) return; S.textStyle = b.dataset.ts; syncControls(); seek(0.9); });
document.fonts && document.fonts.ready.then(renderTextStyles); renderTextStyles();
setTimeout(renderTextStyles, 1500);
[els.title, els.sub, els.endTitle, els.endSub].forEach((x) => x.addEventListener('input', () => { if (!playing) draw(); }));
els.captions.addEventListener('change', () => draw());
els.endOn.addEventListener('change', () => { S.end = els.endOn.checked; refit(); draw(); });
[els.aspect, els.quality].forEach((x) => x.addEventListener('change', () => { bgCache.clear(); draw(); }));

function syncControls() {
  $$('[data-look]', els.looks).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.look === S.look)));
  $$('[data-ov]', els.overlays).forEach((b) => b.setAttribute('aria-pressed', String(S.overlays.has(b.dataset.ov))));
  $$('[data-tr]', els.tlist).forEach((b) => b.setAttribute('aria-pressed', String(S.tmode === 'one' ? b.dataset.tr === S.tone : S.tset.has(b.dataset.tr))));
  $$('[data-ts]', els.tstyles).forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ts === S.textStyle)));
  els.tmode.value = S.tmode; els.tdur.value = S.tdur; els.motion.value = S.motion; els.fit.value = S.fit; els.per.value = S.per; els.bg.value = S.bg;
  els.bg.closest('.t-field').hidden = S.fit !== 'color';
  els.reshuffle.hidden = S.tmode !== 'random';
  els.tall.textContent = S.tset.size >= Object.keys(TRANSITIONS).length - 1 ? 'Clear' : 'Use all';
}

/* ---------------------------------------------------------------- music */
els.music.innerHTML = `<option value="none">No music</option>${Object.entries(MUSIC_STYLES).map(([k, s]) => `<option value="${k}">${s.name} (built-in, royalty-free)</option>`).join('')}<option value="file">My own song…</option>`;
let music = null, musicKey = '', musicFile = null;
async function ensureMusic() {
  const v = els.music.value;
  els.beat.closest('label').hidden = !bpm();
  if (v === 'none') return null;
  const key = v === 'file' ? `file|${musicFile && musicFile.name}` : v;
  if (music && musicKey === key) return music;
  actx = actx || new AudioContext();
  if (v === 'file') { if (!musicFile) return null; music = await actx.decodeAudioData(await musicFile.arrayBuffer()); }
  else { const { ch } = await generateMusic(v, SR); music = new AudioBuffer({ length: ch[0].length, numberOfChannels: 2, sampleRate: SR }); music.copyToChannel(ch[0], 0); music.copyToChannel(ch[1] || ch[0], 1); }
  musicKey = key; return music;
}
els.music.addEventListener('change', async () => {
  stop();
  if (els.music.value === 'file') { els.musicIn.click(); return; }
  els.musicName.textContent = ''; els.fitMusic.closest('label').hidden = true;
  refit(); draw(); ensureMusic().catch(() => {});
});
els.musicIn.addEventListener('change', async () => {
  const f = els.musicIn.files[0]; els.musicIn.value = '';
  if (!f) { if (!musicFile) els.music.value = 'none'; return; }
  musicFile = f; els.musicName.textContent = `🎵 ${f.name}`; els.fitMusic.closest('label').hidden = false;
  try { await ensureMusic(); refit(); draw(); } catch (_) { setStatus(els.status, 'That song could not be read. Try an MP3 or M4A.', 'err'); els.music.value = 'none'; }
});
els.fitMusic.addEventListener('change', () => { refit(); draw(); });
els.beat.addEventListener('change', () => { refit(); draw(); });
async function soundtrack(T) {
  const m = await ensureMusic(); if (!m) return null;
  const len = Math.round(T * SR), ctx = new OfflineAudioContext(2, len, SR);
  const src = ctx.createBufferSource(); src.buffer = m; src.loop = true;
  const gn = ctx.createGain(), v = +els.vol.value / 100, fo = Math.min(2.5, T / 3);
  gn.gain.setValueAtTime(0, 0); gn.gain.linearRampToValueAtTime(v, Math.min(0.5, T / 4)); gn.gain.setValueAtTime(v, T - fo); gn.gain.linearRampToValueAtTime(0, T);
  src.connect(gn).connect(ctx.destination); src.start(0);
  return ctx.startRendering();
}

/* ---------------------------------------------------------------- export */
els.run.addEventListener('click', async () => {
  if (!photos.length) return;
  stop(); els.run.disabled = true; els.result.hidden = true;
  const t1 = performance.now();
  try {
    setStatus(els.status, 'Preparing photos and fonts…');
    await bakeAll(); await (document.fonts ? Promise.race([document.fonts.ready, new Promise((r) => setTimeout(r, 3000))]) : null);
    const MB = await loadMediabunny();
    const [W, H] = dims(), T = total(), frames = Math.ceil(T * FPS);
    const vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
    if (!vcodec) throw new Error('Your browser has no suitable video encoder.');
    const mp4 = vcodec === 'avc';
    const output = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const canvas = mkCanvas(W, H), g = canvas.getContext('2d'); g.imageSmoothingQuality = 'high';
    const vsrc = new MB.CanvasSource(canvas, { codec: vcodec, bitrate: MB.QUALITY_HIGH, keyFrameInterval: 2 });
    output.addVideoTrack(vsrc, { frameRate: FPS });
    const audio = await soundtrack(T);
    let asrc = null;
    if (audio) { const ac = await MB.getFirstEncodableAudioCodec(mp4 ? ['aac', 'opus'] : ['opus', 'vorbis']); if (ac) { asrc = new MB.AudioBufferSource({ codec: ac, bitrate: 192_000 }); output.addAudioTrack(asrc); } }
    await output.start();
    if (asrc) await asrc.add(audio);
    for (let f = 0; f < frames; f++) {
      render(g, f / FPS, W, H, f);
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

applyTemplate('travel'); renderLooks();
window.__ssTest = { get photos() { return photos; }, total, seek, render, S, applyTemplate, transFor, get SL() { return SL; } };
