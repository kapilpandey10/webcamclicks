/* WebcamClicks — Auto captions: on-device speech recognition (Whisper) with word-level timing,
   12 animated caption styles, editing, translation, SRT/VTT export and burn-in. Nothing is uploaded. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';
import { STYLES, FONTS_CSS, ensureFont, drawCaption, groupWords, wordsFromText, retime, joinWords } from './caption-render.js';

const LANGS = [['', 'Detect automatically'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'],
  ['nl', 'Dutch'], ['hi', 'Hindi'], ['ne', 'Nepali'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'], ['ur', 'Urdu'],
  ['ar', 'Arabic'], ['fa', 'Persian'], ['tr', 'Turkish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['pl', 'Polish'], ['cs', 'Czech'], ['ro', 'Romanian'],
  ['el', 'Greek'], ['he', 'Hebrew'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['vi', 'Vietnamese'], ['th', 'Thai'], ['id', 'Indonesian'],
  ['ms', 'Malay'], ['tl', 'Filipino'], ['sv', 'Swedish'], ['no', 'Norwegian'], ['da', 'Danish'], ['fi', 'Finnish'], ['hu', 'Hungarian']];
const SIZES = { fast: 'tiny', balanced: 'base', accurate: 'small', best: 'large-v3-turbo' };
const LANG_NAME = Object.fromEntries(LANGS);

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), video: $('#cap-video'), overlay: $('#cap-overlay'), stage: $('#cap-stage'),
  model: $('#cap-model'), lang: $('#cap-lang'), task: $('#cap-task'), run: $('#cap-run'), auto: $('#cap-auto'), modelStatus: $('#cap-model-status'),
  bar: $('#cap-bar'), fill: $('#cap-fill'), cues: $('#cap-cues'), add: $('#cap-add'), shift: $('#cap-shift'), shiftBtn: $('#cap-shift-btn'),
  styles: $('#cap-styles'), group: $('#cap-group'), size: $('#cap-size'), pos: $('#cap-pos'), fillC: $('#cap-fillc'), activeC: $('#cap-activec'), upper: $('#cap-upper'),
  srt: $('#cap-srt'), vtt: $('#cap-vtt'), txt: $('#cap-txt'), burn: $('#cap-burn'), importIn: $('#cap-import'),
  detected: $('#cap-detected'), trLang: $('#cap-tr-lang'), trRun: $('#cap-tr-run'), trUndo: $('#cap-tr-undo'), trNote: $('#cap-tr-note'), editor: $('#cap-editor'), info: $('#cap-info')
};

els.lang.innerHTML = LANGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.innerHTML = LANGS.slice(1).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.value = (navigator.language || 'en').slice(0, 2) === 'en' ? 'es' : (navigator.language || 'en').slice(0, 2);
const store = { get(k, d) { try { return localStorage.getItem(`wc_cap_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_cap_${k}`, v); } catch (_) { /* ignore */ } } };
els.model.value = store.get('model', 'balanced');
els.lang.value = store.get('lang', '');
els.lang.addEventListener('change', () => store.set('lang', els.lang.value));
els.auto.checked = store.get('auto', '1') === '1';

// caption fonts (Montserrat, Poppins, Anton, Bangers, Permanent Marker) — only on this page
if (!document.querySelector('link[data-cap-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.capFonts = '1'; document.head.appendChild(l); }

let file = null, cues = [], duration = 0, styleKey = store.get('style', 'pop'), beforeTranslate = null, lastGroup = '';
if (!STYLES[styleKey]) styleKey = 'pop';

/* ---------------------------------------------------------------- speech model: background download */
let worker = null, jobId = 0, job = null;
const modelState = {};   // size → { state, loaded, total, word }
function getWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./captions-worker.js', import.meta.url), { type: 'module' });
  worker.onmessage = (e) => {
    const m = e.data;
    if (m.type === 'model') { modelState[m.size] = { ...(modelState[m.size] || {}), ...m }; showModel(); return; }
    if (!job || m.id !== job.id) return;
    if (m.type === 'status') setStatus(els.status, m.text);
    if (m.type === 'language') showDetected(m.ranked);
    if (m.type === 'debug' && window.__capDebug) console.log('CAPDEBUG ' + JSON.stringify(m));
    if (m.type === 'progress') { els.fill.style.width = `${Math.round(m.done * 100)}%`; setStatus(els.status, `Listening… ${Math.round(m.done * 100)}% · ${m.words} words so far`); }
    if (m.type === 'done') job.resolve(m);
    if (m.type === 'error') job.reject(new Error(m.text));
  };
  worker.onerror = (e) => { if (job) job.reject(new Error(e.message || 'The speech worker stopped.')); };
  return worker;
}
const curSize = () => SIZES[els.model.value] || 'base';
function showModel() {
  const s = modelState[curSize()];
  const el = els.modelStatus;
  if (!s) { el.textContent = ''; el.dataset.state = ''; return; }
  el.dataset.state = s.state;
  if (s.state === 'downloading') el.textContent = `Speech AI downloading in the background: ${s.total ? Math.round((s.loaded / s.total) * 100) : 0}% (${formatBytes(s.loaded || 0)} of ${formatBytes(s.total || 0)}). One time only.`;
  else if (s.state === 'ready') el.textContent = `✓ Speech AI ready${s.word ? ' with word-by-word timing' : ''}. Works offline from now on.`;
  else if (s.state === 'error') el.textContent = 'The speech AI could not be downloaded. It will try again when you generate captions.';
}
function preload() {
  const c = navigator.connection;
  if (c && (c.saveData || /(^|-)2g$/.test(c.effectiveType || ''))) { els.modelStatus.textContent = 'Data saver is on: the speech AI will download when you generate captions.'; return; }
  const size = curSize();
  if (modelState[size] && modelState[size].state !== 'error') return;
  modelState[size] = { state: 'downloading', loaded: 0, total: 0 }; showModel();
  getWorker().postMessage({ type: 'preload', size });
}
// start the download quietly once the page has settled, so captions are instant when a video is added
(window.requestIdleCallback || ((f) => setTimeout(f, 2500)))(preload, { timeout: 6000 });
els.model.addEventListener('change', () => { store.set('model', els.model.value); showModel(); preload(); });
els.auto.addEventListener('change', () => store.set('auto', els.auto.checked ? '1' : '0'));

/* ---------------------------------------------------------------- detected language (with a one-click fix) */
function langLabel(code) { return LANG_NAME[code] || (typeof Intl !== 'undefined' && Intl.DisplayNames ? new Intl.DisplayNames(['en'], { type: 'language' }).of(code) : code); }
function showDetected(ranked) {
  const [top, ...rest] = ranked;
  if (!LANG_NAME[top.code]) els.lang.insertAdjacentHTML('beforeend', `<option value="${top.code}">${langLabel(top.code)}</option>`);
  els.detected.hidden = false;
  els.detected.innerHTML = `Detected language: <b>${langLabel(top.code)}</b> (${Math.round(top.p * 100)}% sure)${rest.length ? `, then ${rest.map((r) => `${langLabel(r.code)} ${Math.round(r.p * 100)}%`).join(', ')}` : ''}. Wrong? Pick the right one in <em>Spoken language</em> and press Generate again.`;
  els.detected.classList.toggle('unsure', top.p < 0.6);
}

/* ---------------------------------------------------------------- load media */
async function openMedia(f) {
  file = f;
  els.editor.hidden = false;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  els.video.classList.toggle('audio-only', f.type.startsWith('audio/'));
  await new Promise((r) => { els.video.onloadedmetadata = r; els.video.onerror = r; });
  duration = isFinite(els.video.duration) ? els.video.duration : 0;
  els.info.textContent = `${f.name} · ${formatBytes(f.size)}${duration ? ` · ${fmtTime(duration)}` : ''}`;
  els.run.disabled = false; els.burn.disabled = !cues.length || f.type.startsWith('audio/');
  sizeOverlay();
  if (els.auto.checked) generate();
  else setStatus(els.status, 'Choose the spoken language (or leave it on automatic) and press Generate captions.');
}

/** Decode the audio track to 16 kHz mono (what Whisper expects). */
async function audio16k() {
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const at = await input.getPrimaryAudioTrack();
  if (!at) throw new Error('This file has no audio track.');
  const first = await at.getFirstTimestamp().catch(() => 0);
  const parts = []; let sr = 48000;
  for await (const wb of new MB.AudioBufferSink(at).buffers()) { parts.push(wb); sr = wb.buffer.sampleRate; }
  const end = parts.length ? parts[parts.length - 1].timestamp - first + parts[parts.length - 1].buffer.duration : 0;
  duration = duration || end;
  const len = Math.max(1, Math.ceil(end * sr)), mono = new Float32Array(len);
  for (const wb of parts) {
    const off = Math.round((wb.timestamp - first) * sr), b = wb.buffer, nch = b.numberOfChannels;
    for (let c = 0; c < nch; c++) { const d = b.getChannelData(c); for (let i = 0; i < d.length && off + i < len; i++) mono[off + i] += d[i] / nch; }
  }
  const ctx = new OfflineAudioContext(1, Math.max(1, Math.ceil(end * 16000)), 16000);
  const buf = ctx.createBuffer(1, len, sr); buf.copyToChannel(mono, 0);
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/* ---------------------------------------------------------------- transcribe */
let busy = false;
async function generate() {
  if (!file || busy) return;
  busy = true; els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%'; els.detected.hidden = true;
  try {
    if (els.model.value === 'best' && !(navigator.gpu && await navigator.gpu.requestAdapter().catch(() => null))) { els.model.value = 'accurate'; setStatus(els.status, 'Best needs a graphics chip (WebGPU), which this browser doesn\'t offer. Using Accurate.'); await new Promise((r) => setTimeout(r, 1200)); }
    setStatus(els.status, 'Reading the audio…');
    const pcm = await audio16k();
    const size = curSize();
    if (!modelState[size] || modelState[size].state === 'error') modelState[size] = { state: 'downloading', loaded: 0, total: 0 };
    showModel();
    if (modelState[size].state === 'downloading') setStatus(els.status, 'Waiting for the speech AI to finish downloading (first time only)…');
    const w = getWorker(), id = ++jobId;
    const result = await new Promise((resolve, reject) => { job = { id, resolve, reject }; w.postMessage({ type: 'run', id, audio: pcm, size, language: els.lang.value, task: els.task.value }, [pcm.buffer]); });
    job = null;
    beforeTranslate = null; els.trUndo.hidden = true;
    lastGroup = groupMode();
    cues = groupWords(result.words, lastGroup);
    renderCues();
    if (cues.length) { els.video.currentTime = Math.max(0, cues[0].start + 0.05); }
    setStatus(els.status, cues.length
      ? `Done: ${result.words.length} words in ${cues.length} captions${result.mode === 'word' ? ', timed word by word' : ''}. Pick a style, check the preview, then export or burn them in.`
      : 'No speech was detected in this file.', cues.length ? 'ok' : 'err');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, e.message === 'NO_LANG' ? 'The spoken language could not be detected. Please choose it under “Spoken language” and press Generate captions.'
      : /Failed to fetch|NetworkError|network error/i.test(e.message) ? `Could not download the speech AI. Check your connection and try again. (${e.message})` : `Captioning failed: ${e.message}`, 'err');
  }
  job = null; busy = false;
  els.bar.hidden = true; els.run.disabled = false;
}
els.run.addEventListener('click', generate);

/* ---------------------------------------------------------------- style picker */
const groupMode = () => (els.group.value === 'auto' ? (STYLES[styleKey].group || 'lines') : els.group.value);
function renderStyleTiles() {
  els.styles.innerHTML = Object.entries(STYLES).map(([k, st]) => {
    const t = (s) => (st.upper ? s.toUpperCase() : s);
    const base = `font-family:'${st.font}',Inter,sans-serif;font-weight:${st.weight};color:${st.fill};${st.stroke ? `-webkit-text-stroke:${Math.max(1, st.strokeW * 10).toFixed(1)}px ${st.stroke};paint-order:stroke fill;` : ''}${st.glow ? `text-shadow:0 0 8px ${st.glow};` : st.shadow ? `text-shadow:0 2px 6px ${st.shadow};` : st.hardShadow ? `text-shadow:2px 2px 0 ${st.hardShadow};` : ''}${st.gradient ? `background:linear-gradient(${st.gradient[0]},${st.gradient[1]});-webkit-background-clip:text;background-clip:text;color:transparent;` : ''}`;
    const act = st.hl === 'box' ? `background:${st.active};color:#fff;border-radius:5px;padding:0 3px;` : `color:${st.cycle ? '#3dff6e' : st.active};${st.gradient ? '-webkit-text-fill-color:' + st.active + ';' : ''}`;
    const inner = `<span style="${base}">${st.lineBox ? `<span style="background:${st.lineBox};padding:1px 5px;border-radius:4px">${t('Say')} <i style="font-style:normal;${act}">${t('hello')}</i></span>` : st.cycle ? `<i style="font-style:normal;${act}">${t('Wow')}</i>` : `${t('Say')} <i style="font-style:normal;${act}">${t('hello')}</i>`}</span>`;
    return `<button type="button" class="cap-tile" role="radio" data-style="${k}" aria-checked="${k === styleKey}"><span class="cap-tile-prev">${inner}</span><small>${escapeHtml(st.name)}</small></button>`;
  }).join('');
}
function applyStyleDefaults() {
  const st = STYLES[styleKey];
  els.fillC.value = st.fill; els.activeC.value = st.active; els.upper.checked = !!st.upper;
  els.activeC.closest('label').querySelector('span').textContent = st.hl === 'box' ? 'Highlight box' : st.cycle ? 'Highlight (unused)' : 'Spoken word';
}
els.styles.addEventListener('click', async (e) => {
  const b = e.target.closest('[data-style]'); if (!b) return;
  styleKey = b.dataset.style; store.set('style', styleKey);
  els.styles.querySelectorAll('[data-style]').forEach((x) => x.setAttribute('aria-checked', String(x === b)));
  applyStyleDefaults(); regroup(); await ensureFont(styleKey); drawOverlay();
});
function regroup() {
  const g = groupMode();
  if (!cues.length || g === lastGroup) return;
  cues = groupWords(cues.flatMap((c) => c.words || wordsFromText(c.text, c.start, c.end)), g); lastGroup = g; renderCues();
}
els.group.addEventListener('change', () => { regroup(); drawOverlay(); });
[els.size, els.pos, els.fillC, els.activeC, els.upper].forEach((x) => x.addEventListener('input', drawOverlay));

/* ---------------------------------------------------------------- cue editor */
const fmtTs = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
const parseTs = (v) => { const p = String(v).replace(',', '.').split(':').map(Number); return p.reduce((a, x) => a * 60 + x, 0); };
function renderCues() {
  els.cues.innerHTML = cues.map((c, i) => `<li class="cue" data-i="${i}">
    <div class="cue-times"><input class="t-input" type="text" value="${fmtTs(c.start)}" data-k="start" aria-label="Start"><span>→</span><input class="t-input" type="text" value="${fmtTs(c.end)}" data-k="end" aria-label="End"></div>
    <textarea class="t-textarea" data-k="text" rows="${c.text.includes('\n') ? 2 : 1}" aria-label="Caption text">${escapeHtml(c.text)}</textarea>
    <div class="cue-acts"><button type="button" class="t-icon-btn" data-a="play" title="Play from here">▶</button><button type="button" class="t-icon-btn" data-a="del" title="Delete">✕</button></div></li>`).join('');
  const has = cues.length > 0;
  [els.srt, els.vtt, els.txt].forEach((b) => (b.disabled = !has));
  els.burn.disabled = !has || !file || file.type.startsWith('audio/');
  els.trRun.disabled = !has;
  drawOverlay();
}
els.cues.addEventListener('input', (e) => {
  const li = e.target.closest('.cue'); if (!li) return;
  const c = cues[+li.dataset.i], k = e.target.dataset.k;
  if (k === 'text') c.text = e.target.value;
  else { const v = parseTs(e.target.value); if (!isFinite(v)) return; c[k] = v; }
  retime(c); drawOverlay();
});
els.cues.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); const li = e.target.closest('.cue'); if (!li) return;
  const i = +li.dataset.i;
  if (b && b.dataset.a === 'del') { cues.splice(i, 1); renderCues(); return; }
  els.video.currentTime = cues[i].start + 0.01;
  if (b && b.dataset.a === 'play') els.video.play();
});
els.add.addEventListener('click', () => {
  const t = els.video.currentTime || 0;
  const c = { start: +t.toFixed(3), end: +(t + 2).toFixed(3), text: 'New caption' }; c.words = wordsFromText(c.text, c.start, c.end);
  cues.push(c); cues.sort((a, b) => a.start - b.start); renderCues();
});
els.shiftBtn.addEventListener('click', () => {
  const d = +els.shift.value || 0;
  cues.forEach((c) => { c.start = Math.max(0, +(c.start + d).toFixed(3)); c.end = Math.max(c.start + 0.2, +(c.end + d).toFixed(3)); (c.words || []).forEach((w) => { w.start = Math.max(0, +(w.start + d).toFixed(3)); w.end = Math.max(w.start + 0.05, +(w.end + d).toFixed(3)); }); });
  renderCues();
});

/* ---------------------------------------------------------------- preview */
const cueAt = (t) => cues.find((c) => t >= c.start && t < c.end);
const opts = () => ({ style: styleKey, size: els.size.value, y: +els.pos.value / 100, fill: els.fillC.value, active: els.activeC.value, upper: els.upper.checked });
const SAMPLE = { start: 0, end: 4, words: [{ text: 'Your', start: 0, end: 0.4 }, { text: ' captions', start: 0.4, end: 1 }, { text: ' look', start: 1, end: 1.3 }, { text: ' like', start: 1.3, end: 1.6 }, { text: ' this', start: 1.6, end: 2 }] };

function sizeOverlay() {
  const r = els.video.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  els.overlay.width = Math.max(1, Math.round(r.width * dpr)); els.overlay.height = Math.max(1, Math.round(r.height * dpr));
  drawOverlay();
}
function drawOverlay() {
  const c = els.overlay, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  if (!file) return;
  const vw = els.video.videoWidth || 16, vh = els.video.videoHeight || 9;
  // letterbox-aware: captions sit on the picture, not on the black bars
  const s = Math.min(c.width / vw, c.height / vh), w = vw * s, h = vh * s;
  g.save(); g.translate((c.width - w) / 2, (c.height - h) / 2);
  const t = els.video.currentTime;
  const cue = cueAt(t);
  if (cue) drawCaption(g, w, h, cue, t, opts());
  else if (!cues.length && els.video.paused) drawCaption(g, w, h, SAMPLE, 0.45, opts());   // show the chosen style before captions exist
  g.restore();
}
let raf = 0;
const tick = () => { drawOverlay(); if (!els.video.paused) raf = requestAnimationFrame(tick); };
els.video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
els.video.addEventListener('seeked', drawOverlay);
els.video.addEventListener('timeupdate', () => { if (els.video.paused) drawOverlay(); });
window.addEventListener('resize', sizeOverlay);
new ResizeObserver(sizeOverlay).observe(els.video);
document.fonts && document.fonts.addEventListener('loadingdone', drawOverlay);

/* ---------------------------------------------------------------- export */
const srtTs = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const base = () => (file ? splitName(file.name)[0] : 'captions');
els.srt.addEventListener('click', () => downloadBlob(new Blob([cues.map((c, i) => `${i + 1}\n${srtTs(c.start)} --> ${srtTs(c.end)}\n${c.text}\n`).join('\n')], { type: 'application/x-subrip;charset=utf-8' }), `${base()}.srt`));
els.vtt.addEventListener('click', () => downloadBlob(new Blob([`WEBVTT\n\n${cues.map((c) => `${srtTs(c.start).replace(',', '.')} --> ${srtTs(c.end).replace(',', '.')}\n${c.text}\n`).join('\n')}`], { type: 'text/vtt;charset=utf-8' }), `${base()}.vtt`));
els.txt.addEventListener('click', () => downloadBlob(new Blob([joinWords(cues.flatMap((c) => c.words || []))
  .replace(/([.!?。！？])\s+/g, '$1\n')], { type: 'text/plain;charset=utf-8' }), `${base()}-transcript.txt`));

/* import existing SRT / VTT to restyle, translate or burn in */
els.importIn.addEventListener('change', async () => {
  const f = els.importIn.files[0]; els.importIn.value = ''; if (!f) return;
  const txt = await f.text();
  const out = [];
  for (const b of txt.replace(/\r/g, '').split(/\n\n+/)) {
    const m = b.match(/(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/);
    if (!m) continue;
    const [a, z] = m[0].split('-->').map((x) => parseTs(x.trim()));
    const text = b.slice(b.indexOf(m[0]) + m[0].length).replace(/^[^\n]*\n/, '').replace(/<[^>]+>/g, '').trim();
    if (text) out.push({ start: a, end: z, text, words: wordsFromText(text, a, z) });
  }
  if (!out.length) { setStatus(els.status, 'No captions found in that file.', 'err'); return; }
  cues = out; lastGroup = 'imported'; beforeTranslate = null; renderCues(); els.editor.hidden = false;
  setStatus(els.status, `Imported ${out.length} captions from ${f.name}. Pick a style; change “Words per caption” to regroup them.`, 'ok');
});

/* burn captions into the video (re-encodes video, copies audio) */
els.burn.addEventListener('click', async () => {
  if (!file || !cues.length) return;
  els.burn.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%';
  try {
    await ensureFont(styleKey);
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    if (!vt) throw new Error('This file has no video to put captions on.');
    const first = await vt.getFirstTimestamp().catch(() => 0);
    const W = vt.displayWidth, H = vt.displayHeight;
    const canvas = new OffscreenCanvas(W, H), g = canvas.getContext('2d');
    const codec = (await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H })) || 'avc';
    const output = new MB.Output({ format: new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
    const o = opts();
    const conv = await MB.Conversion.init({
      input, output,
      video: { codec, bitrate: MB.QUALITY_HIGH, forceTranscode: true, process: (sample) => {
        sample.draw(g, 0, 0, W, H);
        const t = sample.timestamp - first, cue = cueAt(t);
        if (cue) drawCaption(g, W, H, cue, t, o);
        return canvas;
      } }
      // audio is copied as-is when the container allows it (no re-encode, no quality loss)
    });
    if (!conv.isValid) throw new Error('This video can\'t be converted in your browser.');
    const t0 = performance.now();
    conv.onProgress = (p) => { els.fill.style.width = `${Math.round(p * 100)}%`; setStatus(els.status, `Adding captions to the video… ${Math.round(p * 100)}%`); };
    await conv.execute();
    downloadBlob(new Blob([output.target.buffer], { type: 'video/mp4' }), `${base()}-captioned.mp4`);
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s. Your captioned MP4 is downloading.`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, `Could not add captions: ${e.message}`, 'err'); }
  els.bar.hidden = true; els.burn.disabled = false;
});

/* ---------------------------------------------------------------- translation (Chrome's on-device Translator API) */
const hasTranslator = 'Translator' in self;
els.trNote.textContent = hasTranslator
  ? 'Translation runs on your device with your browser\'s built-in translator. The first use of a language pair downloads a small model.'
  : 'Translating to any language needs Chrome 138 or newer on a computer (on-device translator). In any browser you can choose “Translate to English” above before generating captions.';
els.trRun.hidden = !hasTranslator; els.trLang.closest('.t-field').hidden = !hasTranslator;
els.trRun.addEventListener('click', async () => {
  if (!hasTranslator || !cues.length) return;
  els.trRun.disabled = true;
  try {
    let src = els.task.value === 'translate' ? 'en' : els.lang.value;
    if (!src && 'LanguageDetector' in self) {
      const det = await self.LanguageDetector.create();
      const r = await det.detect(cues.slice(0, 20).map((c) => c.text).join(' '));
      src = r && r[0] && r[0].detectedLanguage;
    }
    src = src || 'en';
    const tgt = els.trLang.value;
    if (src === tgt) throw new Error('The captions are already in that language.');
    const avail = await self.Translator.availability({ sourceLanguage: src, targetLanguage: tgt });
    if (avail === 'unavailable') throw new Error(`Your browser can't translate ${src} → ${tgt} on this device yet.`);
    const tr = await self.Translator.create({ sourceLanguage: src, targetLanguage: tgt, monitor(m) { m.addEventListener('downloadprogress', (e) => setStatus(els.status, `Downloading translator… ${Math.round(e.loaded * 100)}%`)); } });
    if (!beforeTranslate) beforeTranslate = JSON.stringify({ cues, lastGroup });
    // translate whole captions (better grammar than word by word), then spread the new words over the same time
    for (let i = 0; i < cues.length; i++) {
      const c = cues[i];
      c.text = (await tr.translate(c.text.replace(/\n/g, ' '))).trim();
      c.words = wordsFromText(c.text, c.start, Math.max(c.start + 0.3, c.end - 0.3));
      if (i % 5 === 0) setStatus(els.status, `Translating ${i + 1} of ${cues.length}…`);
    }
    renderCues(); els.trUndo.hidden = false;
    setStatus(els.status, `Captions translated to ${LANGS.find((l) => l[0] === tgt)?.[1] || tgt}.`, 'ok');
  } catch (e) { setStatus(els.status, e.message, 'err'); }
  els.trRun.disabled = false;
});
els.trUndo.addEventListener('click', () => { if (!beforeTranslate) return; const o = JSON.parse(beforeTranslate); cues = o.cues; lastGroup = o.lastGroup; beforeTranslate = null; els.trUndo.hidden = true; renderCues(); });

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(video|audio)\//.test(x.type) || /\.(mp4|mov|webm|mkv|m4a|mp3|wav|ogg|flac|aac)$/i.test(x.name));
  if (f) openMedia(f); else setStatus(els.status, 'Please choose a video or audio file.', 'err');
});
renderStyleTiles(); applyStyleDefaults(); ensureFont(styleKey).then(drawOverlay);
window.__capTest = { setWords: (w) => { lastGroup = groupMode(); cues = groupWords(w, lastGroup); renderCues(); }, get cues() { return cues; }, groupWords, modelState };
