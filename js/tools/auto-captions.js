/* WebcamClicks — Auto captions with the browser's own speech recognition (Web Speech API, no AI download),
   12 animated caption styles, caption-file upload, editing, translation, SRT/VTT export and burn-in. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';
import { STYLES, FONTS_CSS, ensureFont, drawCaption, groupWords, wordsFromText, retime, joinWords } from './caption-render.js';
import { planWindows, spreadOverRegions } from './vad.js';

// [code, name, speech-recognition locale]
const LANG_LIST = [['en', 'English', 'en-US'], ['ne', 'Nepali', 'ne-NP'], ['hi', 'Hindi', 'hi-IN'], ['es', 'Spanish', 'es-ES'], ['fr', 'French', 'fr-FR'], ['de', 'German', 'de-DE'],
  ['pt', 'Portuguese', 'pt-BR'], ['it', 'Italian', 'it-IT'], ['nl', 'Dutch', 'nl-NL'], ['bn', 'Bengali', 'bn-IN'], ['ta', 'Tamil', 'ta-IN'], ['te', 'Telugu', 'te-IN'],
  ['mr', 'Marathi', 'mr-IN'], ['gu', 'Gujarati', 'gu-IN'], ['pa', 'Punjabi', 'pa-IN'], ['ur', 'Urdu', 'ur-PK'], ['si', 'Sinhala', 'si-LK'], ['ar', 'Arabic', 'ar-SA'], ['fa', 'Persian', 'fa-IR'],
  ['tr', 'Turkish', 'tr-TR'], ['ru', 'Russian', 'ru-RU'], ['uk', 'Ukrainian', 'uk-UA'], ['pl', 'Polish', 'pl-PL'], ['cs', 'Czech', 'cs-CZ'], ['ro', 'Romanian', 'ro-RO'],
  ['el', 'Greek', 'el-GR'], ['he', 'Hebrew', 'he-IL'], ['zh', 'Chinese (Mandarin)', 'zh-CN'], ['ja', 'Japanese', 'ja-JP'], ['ko', 'Korean', 'ko-KR'], ['vi', 'Vietnamese', 'vi-VN'],
  ['th', 'Thai', 'th-TH'], ['id', 'Indonesian', 'id-ID'], ['ms', 'Malay', 'ms-MY'], ['tl', 'Filipino', 'fil-PH'], ['sv', 'Swedish', 'sv-SE'], ['no', 'Norwegian', 'nb-NO'],
  ['da', 'Danish', 'da-DK'], ['fi', 'Finnish', 'fi-FI'], ['hu', 'Hungarian', 'hu-HU'], ['sw', 'Swahili', 'sw-KE']];
const LANGS = [['', 'Choose the spoken language…'], ...LANG_LIST.map(([k, v]) => [k, v])];
const LANG_NAME = Object.fromEntries(LANGS);
/** Speech-recognition locale for a language, preferring the viewer's own region (es-MX, en-IN…). */
function localeOf(code) {
  const mine = (navigator.languages || [navigator.language || '']).find((l) => String(l).toLowerCase().startsWith(`${code}-`));
  return mine || (LANG_LIST.find((l) => l[0] === code) || [])[2] || code;
}

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), video: $('#cap-video'), overlay: $('#cap-overlay'), stage: $('#cap-stage'),
  lang: $('#cap-lang'), speed: $('#cap-speed'), run: $('#cap-run'), auto: $('#cap-auto'), engine: $('#cap-engine'), live: $('#cap-live'),
  bar: $('#cap-bar'), fill: $('#cap-fill'), cues: $('#cap-cues'), add: $('#cap-add'), shift: $('#cap-shift'), shiftBtn: $('#cap-shift-btn'),
  styles: $('#cap-styles'), group: $('#cap-group'), size: $('#cap-size'), pos: $('#cap-pos'), fillC: $('#cap-fillc'), activeC: $('#cap-activec'), upper: $('#cap-upper'),
  srt: $('#cap-srt'), vtt: $('#cap-vtt'), txt: $('#cap-txt'), burn: $('#cap-burn'), importIn: $('#cap-import'), importIn2: $('#cap-import2'),
  trLang: $('#cap-tr-lang'), trRun: $('#cap-tr-run'), trUndo: $('#cap-tr-undo'), trNote: $('#cap-tr-note'), editor: $('#cap-editor'), info: $('#cap-info')
};

els.lang.innerHTML = LANGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.innerHTML = LANGS.slice(1).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.value = (navigator.language || 'en').slice(0, 2) === 'en' ? 'es' : (navigator.language || 'en').slice(0, 2);
const store = { get(k, d) { try { return localStorage.getItem(`wc_cap_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_cap_${k}`, v); } catch (_) { /* ignore */ } } };
els.lang.value = store.get('lang', '');
if (!LANG_NAME[els.lang.value]) els.lang.value = '';
els.speed.value = store.get('speed', '1');
els.lang.addEventListener('change', () => {
  store.set('lang', els.lang.value); els.lang.classList.remove('need'); showEngine();
  // language picked after the video was added: start right away
  if (els.lang.value && file && !busy && !cues.length && els.auto.checked) generate();
});
els.speed.addEventListener('change', () => store.set('speed', els.speed.value));
const spokenLang = () => els.lang.value;
function askLanguage() {
  els.lang.classList.add('need'); els.lang.focus({ preventScroll: true });
  els.lang.scrollIntoView({ block: 'center', behavior: 'smooth' });
  setStatus(els.status, 'Choose the language spoken in the video (under “Spoken language”). Captions start as soon as you pick it.');
}
els.auto.checked = store.get('auto', '1') === '1';
els.auto.addEventListener('change', () => store.set('auto', els.auto.checked ? '1' : '0'));

// caption fonts (Montserrat, Poppins, Anton, Bangers, Permanent Marker) — only on this page
if (!document.querySelector('link[data-cap-fonts]')) { const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = FONTS_CSS; l.dataset.capFonts = '1'; document.head.appendChild(l); }

let file = null, cues = [], duration = 0, styleKey = store.get('style', 'pop'), beforeTranslate = null, lastGroup = '', fromFile = false;
if (!STYLES[styleKey]) styleKey = 'pop';

/* ---------------------------------------------------------------- the browser's speech recognition */
const Recognition = self.SpeechRecognition || self.webkitSpeechRecognition;
// listening to a video's sound (not the microphone) needs start(audioTrack), which came with SpeechRecognition.available()
const canCaption = !!Recognition && typeof Recognition.available === 'function';
let localOk = {};   // locale → true when the browser can recognise it on this device (no audio leaves the computer)
async function onDevice(locale) {
  if (!canCaption) return false;
  if (localOk[locale] == null) { try { localOk[locale] = (await Recognition.available({ langs: [locale], processLocally: true })) === 'available'; } catch (_) { localOk[locale] = false; } }
  return localOk[locale];
}
/** The browser's name: only Google Chrome and Microsoft Edge include an online speech service. */
function browserName() {
  if (navigator.brave) return 'Brave';
  const ua = navigator.userAgent;
  if (/OPR\//.test(ua)) return 'Opera'; if (/Vivaldi/.test(ua)) return 'Vivaldi'; if (/YaBrowser/.test(ua)) return 'Yandex Browser'; if (/SamsungBrowser/.test(ua)) return 'Samsung Internet';
  const brand = (navigator.userAgentData?.brands || []).map((x) => x.brand).find((x) => !/Not.?A.?Brand|^Chromium$/i.test(x));
  if (brand) return brand;
  if (/Edg\//.test(ua)) return 'Microsoft Edge';
  return /Chrome\//.test(ua) ? 'Chrome' : 'this browser';
}
const isEdge = () => /Edge/.test(browserName());
const hasCloud = () => /^(Google Chrome|Chrome|Microsoft Edge)$/.test(browserName());
const speechService = () => (isEdge() ? 'Microsoft\'s' : 'Google\'s');
async function onDeviceState(locale) { try { return await Recognition.available({ langs: [locale], processLocally: true }); } catch (_) { return 'unavailable'; } }
/** Offer the browser's on-device recogniser (it downloads its own speech pack for the language once). */
async function offerOnDevice(locale, code) {
  const st = canCaption ? await onDeviceState(locale) : 'unavailable';
  if (st !== 'downloadable' && st !== 'downloading') return false;
  els.engine.dataset.state = 'cloud';
  els.engine.innerHTML = `Your browser can recognise ${escapeHtml(LANG_NAME[code])} on this device instead (no internet needed after that; ${escapeHtml(browserName())} downloads its own speech pack once). <button type="button" class="t-btn sm" id="cap-install" style="margin-top:6px">Use on-device recognition</button>`;
  $('#cap-install').addEventListener('click', async (ev) => {
    const btn = ev.currentTarget; btn.disabled = true; btn.textContent = 'Setting up…';
    try {
      const ok = await Recognition.install({ langs: [locale], processLocally: true });
      if (!ok) throw new Error('not installed');
      localOk[locale] = true; await showEngine(); generate();
    } catch (_) { btn.textContent = 'Could not set it up'; }
  });
  return true;
}
async function showEngine() {
  const el = els.engine;
  if (!canCaption) {
    el.dataset.state = 'off';
    el.innerHTML = 'Your browser can\'t turn a video\'s sound into text. Open this page in <b>Chrome</b> or <b>Edge</b> (computer or Android), or upload a caption file you already have.';
    els.run.disabled = true; return;
  }
  const code = els.lang.value; if (!code) { el.textContent = ''; el.dataset.state = ''; return; }
  const local = await onDevice(localeOf(code));
  if (code !== els.lang.value) return;
  el.dataset.state = local ? 'ready' : hasCloud() ? 'cloud' : 'off';
  el.textContent = local
    ? `✓ ${LANG_NAME[code]} is recognised on your device by your browser. Nothing to download, and the sound never leaves your computer.`
    : hasCloud() ? `Uses your browser's speech recognition. Nothing to download; for ${LANG_NAME[code]} ${browserName()} sends the sound (not the video) to ${speechService()} speech service to turn it into text, so you need to be online. Your video file stays on your device.`
    : `${browserName()} usually can't turn speech into text for ${LANG_NAME[code]} (only Google Chrome and Microsoft Edge include a speech service). If it fails, open this page in Chrome or Edge, or upload a caption file.`;
}
showEngine();

/* ---------------------------------------------------------------- load media and caption files */
const CAPTION_RE = /\.(srt|vtt|ass|ssa)$/i;
const MEDIA_RE = /\.(mp4|mov|m4v|webm|mkv|m4a|mp3|wav|ogg|oga|opus|flac|aac)$/i;
async function openMedia(f, { generateNow = true } = {}) {
  if (busy) stopListening();
  file = f;
  els.editor.hidden = false;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  els.video.classList.toggle('audio-only', f.type.startsWith('audio/') || /\.(m4a|mp3|wav|ogg|oga|opus|flac|aac)$/i.test(f.name));
  await new Promise((r) => { els.video.onloadedmetadata = r; els.video.onerror = r; });
  duration = isFinite(els.video.duration) ? els.video.duration : 0;
  tlProgress(null);
  els.info.textContent = `${f.name} · ${formatBytes(f.size)}${duration ? ` · ${fmtTime(duration)}` : ''}`;
  els.run.disabled = !canCaption; els.burn.disabled = !cues.length || els.video.classList.contains('audio-only');
  sizeOverlay(); renderCues();
  if (!generateNow || (fromFile && cues.length)) { setStatus(els.status, cues.length ? `Your ${cues.length} captions are on the video. Pick a style, check the preview, then export or burn them in.` : 'Video loaded.', cues.length ? 'ok' : ''); return; }
  if (!canCaption) { setStatus(els.status, 'This browser can\'t make captions from sound. Use Chrome or Edge, or upload a caption file (SRT, VTT or ASS).', 'err'); return; }
  if (!els.lang.value) askLanguage();
  else if (els.auto.checked) generate();
  else setStatus(els.status, 'Press Generate captions when you are ready.');
}

/** Read SRT, WebVTT or ASS/SSA subtitles into captions. */
function parseCaptions(txt) {
  const parseT = (v) => { const p = String(v).trim().replace(',', '.').split(':').map(Number); return p.reduce((acc, x) => acc * 60 + x, 0); };
  const out = [];
  txt = txt.replace(/^﻿/, '').replace(/\r/g, '');
  if (/^\s*\[Script Info\]/i.test(txt) || /^Dialogue:/m.test(txt)) {   // ASS / SSA
    const fmt = (txt.match(/^\[Events\][\s\S]*?^Format:(.*)$/m) || [])[1];
    const cols = (fmt || 'Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text').split(',').map((c) => c.trim().toLowerCase());
    for (const line of txt.split('\n')) {
      if (!line.startsWith('Dialogue:')) continue;
      const parts = line.slice(9).split(','); const f = {};
      cols.forEach((c, i) => { f[c] = i === cols.length - 1 ? parts.slice(i).join(',') : parts[i]; });
      const text = String(f.text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
      const a = parseT(f.start), z = parseT(f.end);
      if (text && z > a) out.push({ start: a, end: z, text });
    }
  } else {   // SRT / VTT
    for (const b of txt.split(/\n\s*\n/)) {
      const m = b.match(/((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})\s*-->\s*((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})/);
      if (!m) continue;
      const text = b.slice(b.indexOf(m[0]) + m[0].length).replace(/^[^\n]*\n?/, '').replace(/<[^>]+>/g, '').replace(/\{\\[^}]*\}/g, '')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ').trim();
      const a = parseT(m[1]), z = parseT(m[2]);
      if (text && z > a) out.push({ start: a, end: z, text });
    }
  }
  out.sort((x, y) => x.start - y.start);
  out.forEach((c) => { c.words = wordsFromText(c.text, c.start, c.end); });
  return out;
}
async function loadCaptionFile(f) {
  const out = parseCaptions(await f.text());
  if (!out.length) { setStatus(els.status, `No captions found in ${f.name}. SRT, VTT and ASS files work.`, 'err'); return false; }
  if (busy) stopListening();
  cues = out; lastGroup = 'imported'; fromFile = true; beforeTranslate = null; els.trUndo.hidden = true;
  renderCues(); els.editor.hidden = false;
  if (cues.length && els.video.src && els.video.paused) els.video.currentTime = Math.max(0, cues[0].start + 0.05);
  setStatus(els.status, `Loaded ${out.length} captions from ${f.name}${file ? ' onto your video' : '. Now add the video they belong to'}. Pick a style; change “Words per caption” to regroup them.`, 'ok');
  return true;
}
async function handleFiles(files) {
  const capF = files.find((x) => CAPTION_RE.test(x.name));
  const media = files.find((x) => /^(video|audio)\//.test(x.type) || MEDIA_RE.test(x.name));
  if (!capF && !media) { setStatus(els.status, 'Please choose a video or audio file, or a caption file (SRT, VTT, ASS).', 'err'); return; }
  if (capF) await loadCaptionFile(capF);
  if (media) await openMedia(media, { generateNow: !capF });
}
[els.importIn, els.importIn2].forEach((inp) => inp && inp.addEventListener('change', async () => { const fs = [...inp.files]; inp.value = ''; if (fs.length) handleFiles(fs); }));

/** Decode the audio track to 16 kHz mono (used to find where speech is, for timing). */
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

/* ---------------------------------------------------------------- transcribe: play the sound silently into the recogniser */
const cueListBusy = () => els.cues.contains(document.activeElement);
let busy = false, session = null;
function stopListening() { if (session) session.cancel(); }

/**
 * The sound is played (silently, at the chosen speed, pitch kept) into a MediaStream track that the browser's
 * speech recogniser listens to. Each finished phrase is placed where its speech was: between the moment the
 * recogniser first heard it and the moment it finished, snapped to the loud parts of the audio.
 */
function listen({ locale, local, rate, onPhrase, onInterim, onTime }) {
  let cancelled = false, finished = false, rec = null, timer = 0, failed = null, retryDelay = 0;
  const audio = new Audio(); audio.src = els.video.src; audio.preservesPitch = true; audio.playbackRate = rate;
  const ctx = new AudioContext();
  const dest = ctx.createMediaStreamDestination();
  ctx.createMediaElementSource(audio).connect(dest);   // to the recogniser only, not the speakers
  const track = dest.stream.getAudioTracks()[0];
  const done = new Promise((resolve, reject) => {
    const finish = () => { if (finished) return; finished = true; clearInterval(timer); try { rec && rec.stop(); } catch (_) { /* ignore */ } setTimeout(cleanup, 300); };
    const cleanup = () => { audio.pause(); track.stop(); ctx.close().catch(() => {}); if (failed) reject(failed); else if (cancelled) reject(new Error('CANCELLED')); else resolve(); };
    let heardAt = -1, netErrors = 0, heardAny = false;
    const start = () => {
      if (finished) return;
      rec = new Recognition();
      rec.lang = locale; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
      if (local) rec.processLocally = true;
      rec.onresult = (e) => {
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i], t = audio.currentTime;
          heardAny = true; netErrors = 0;
          if (heardAt < 0) heardAt = t;
          if (r.isFinal) { const text = r[0].transcript.trim(); if (text) onPhrase(text, heardAt, t); heardAt = -1; onInterim(''); }
          else onInterim(r[0].transcript);
        }
      };
      rec.onerror = (e) => {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        if (e.error === 'language-not-supported' && local) { local = false; return; }   // try the online service instead
        // the online service drops out now and then: try again (the sound keeps playing), give up if it never answers
        if (e.error === 'network' && !local && ++netErrors <= (heardAny ? 4 : 2)) { retryDelay = 800 * netErrors; return; }
        failed = new Error(e.error === 'network' ? 'NETWORK' : e.error === 'language-not-supported' ? 'LANG' : e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'BLOCKED' : e.error);
        cancelled = true; finish();
      };
      rec.onend = () => { if (finished) { cleanup(); return; } const d = retryDelay; retryDelay = 0; if (d) setTimeout(start, d); else start(); };   // the recogniser stops now and then: keep listening
      try { rec.start(track); } catch (err) { failed = err; finish(); }
    };
    audio.onended = () => setTimeout(finish, 1800 / rate);   // let the last phrase arrive
    audio.onerror = () => { failed = new Error('This file\'s sound can\'t be played in your browser.'); finish(); };
    timer = setInterval(() => onTime(audio.currentTime), 250);
    ctx.resume().then(() => audio.play()).then(start, (err) => { failed = err; finish(); });
    session = { cancel() { cancelled = true; finish(); } };
  });
  return done;
}

async function generate() {
  if (!file) return;
  if (!canCaption) { showEngine(); return; }
  if (!els.lang.value) { askLanguage(); return; }
  if (busy) { stopListening(); return; }   // the button reads “Stop” while listening
  busy = true; fromFile = false;
  els.run.textContent = '■ Stop'; els.bar.hidden = false; els.fill.style.width = '0%'; els.live.hidden = false; els.live.textContent = '';
  const T0 = performance.now(), code = els.lang.value, locale = localeOf(code), rate = +els.speed.value || 1;
  const words = [];
  let regions = null, lastEnd = 0, streamT = 0;
  cues = []; lastGroup = groupMode(); beforeTranslate = null; els.trUndo.hidden = true; renderCues();
  // where the speech is (for word timing): decoded alongside, it is ready long before it is needed
  audio16k().then((pcm) => { regions = planWindows(pcm, 16000).flatMap((w) => w.regions); }).catch(() => { /* timing falls back to when phrases were heard */ });
  const stream = (final) => {
    cues = groupWords(words, lastGroup);
    if (final || !cueListBusy()) renderCues(); else { tlRender(); drawOverlay(); }
  };
  const onPhrase = (text, heard, at) => {
    // the recogniser reports a phrase a moment after it is spoken
    let a = Math.max(lastEnd, heard - 0.9), z = Math.max(a + 0.4, at - 0.25);
    let span = regions ? regions.map(([x, y]) => [Math.max(x, a), Math.min(y, z)]).filter(([x, y]) => y - x > 0.05) : [];
    if (!span.length) span = [[a, z]];
    const toks = /\s/.test(text) ? text.split(/\s+/).map((w, i) => (i || words.length ? ` ${w}` : w)) : [...text].reduce((acc, ch, i) => { if (i % 2) acc[acc.length - 1] += ch; else acc.push(ch); return acc; }, []);
    const ws = spreadOverRegions(toks, span);
    words.push(...ws); lastEnd = ws.length ? ws[ws.length - 1].end : z;
    const now = performance.now(); if (now - streamT > 200) { streamT = now; stream(false); }
  };
  const onInterim = (t) => { els.live.textContent = t ? `Hearing: “${t.trim()}”` : ''; };
  const onTime = (t) => {
    const d = duration || 1, f = Math.min(1, t / d);
    els.fill.style.width = `${Math.round(f * 100)}%`; tlProgress(t);
    const left = Math.max(0, Math.round((d - t) / rate));
    setStatus(els.status, `Listening… ${fmtTime(t)} of ${fmtTime(d)}${left ? ` · about ${left < 90 ? `${left} s` : `${Math.round(left / 60)} min`} left` : ''}. Captions appear as they are heard; you can play the video meanwhile.`);
  };
  try {
    setStatus(els.status, 'Starting your browser\'s speech recognition…');
    await listen({ locale, local: await onDevice(locale), rate, onPhrase, onInterim, onTime });
    stream(true);
    const took = (performance.now() - T0) / 1000;
    if (cues.length && els.video.paused && els.video.currentTime < 0.05) els.video.currentTime = Math.max(0, cues[0].start + 0.05);
    setStatus(els.status, cues.length
      ? `Done in ${took < 90 ? `${took.toFixed(0)} s` : `${(took / 60).toFixed(1)} min`}: ${words.length} words in ${cues.length} captions. Check the timing on the timeline (drag a caption's edge to adjust), pick a style, then export or burn them in.`
      : `No speech was recognised. Check that “Spoken language” is ${LANG_NAME[code]} and that the video has clear speech.`, cues.length ? 'ok' : 'err');
  } catch (e) {
    stream(true);
    if (e.message === 'CANCELLED') setStatus(els.status, cues.length ? `Stopped. ${cues.length} captions so far; press Generate captions to start again.` : 'Stopped.');
    else {
      console.warn(e);
      const offered = e.message === 'NETWORK' || e.message === 'LANG' ? await offerOnDevice(locale, code) : false;
      setStatus(els.status, e.message === 'NETWORK'
        ? (!hasCloud() ? `${browserName()} doesn't include an online speech service, so it can't make captions from sound. Open this page in Google Chrome or Microsoft Edge, or upload a caption file you already have.`
          : `${speechService()} speech service didn't answer. This happens offline, on some office/school networks or VPNs, and in some regions where the service is temporarily unavailable. Try again in a few minutes or on another network (mobile data works too)${offered ? ', or use on-device recognition below' : ''}, or upload a caption file.`)
        : e.message === 'LANG' ? `Your browser can't recognise ${LANG_NAME[code]} speech yet. Try Chrome, or another language.`
        : e.message === 'BLOCKED' ? 'Speech recognition is turned off in this browser (or blocked by a setting or extension).'
        : `Captioning failed: ${e.message}`, 'err');
    }
  } finally {
    busy = false; session = null;
    els.bar.hidden = true; els.live.hidden = true; els.run.textContent = '✨ Generate captions'; tlProgress(null);
  }
}
els.run.addEventListener('click', generate);

/* ---------------------------------------------------------------- timeline (under the video) */
const tl = { wins: [], state: null, zoom: 0, active: -1, drag: null };
const tlEls = { root: $('#cap-tl'), scroll: $('#cap-tl-scroll'), track: $('#cap-tl-track'), ruler: $('#cap-tl-ruler'), prog: $('#cap-tl-prog'), cues: $('#cap-tl-cues'), head: $('#cap-tl-head'), time: $('#cap-tl-time'), zin: $('#cap-tl-in'), zout: $('#cap-tl-out') };
const tlDur = () => Math.max(1, duration || (cues.length ? cues[cues.length - 1].end : 0));
function tlPps() {
  const fit = Math.max(1, tlEls.scroll.clientWidth - 2) / tlDur();
  return Math.min(400, Math.max(fit, 60 * 1.6 ** tl.zoom));   // default ≈ 60 px per second, never narrower than the box
}
/** Show how far listening has got (null hides it). */
function tlProgress(t) {
  if (t == null) { tl.wins = []; tl.state = null; } else { tl.wins = [{ start: 0, end: t }, { start: t, end: tlDur() }]; tl.state = ['done', 'work']; }
  tlRenderProg();
}
function tlRenderProg() {
  const pps = tlPps();
  tlEls.prog.innerHTML = tl.state ? tl.wins.map((w, i) => `<i class="tl-w ${tl.state[i]}" style="left:${w.start * pps}px;width:${(w.end - w.start) * pps}px"></i>`).join('') : '';
  tlEls.root.classList.toggle('working', !!tl.state);
}
function tlRender() {
  if (!tlEls.root) return;
  const pps = tlPps(), d = tlDur();
  tlEls.track.style.width = `${Math.ceil(d * pps)}px`;
  const step = [0.5, 1, 2, 5, 10, 15, 30, 60, 120, 300, 600].find((x) => x * pps >= 56) || 600;
  const lab = (t) => (step < 1 ? `${Math.floor(t / 60)}:${(t % 60).toFixed(1).padStart(4, '0')}` : fmtTime(t));
  let r = ''; for (let t = 0; t <= d + 0.001; t += step) r += `<span style="left:${t * pps}px">${lab(t)}</span>`;
  tlEls.ruler.innerHTML = r;
  tlEls.cues.innerHTML = cues.map((c, i) => `<div class="tl-cue" data-i="${i}" style="left:${c.start * pps}px;width:${Math.max(6, (c.end - c.start) * pps)}px" title="${escapeHtml(c.text)}"><b class="tl-h l" data-h="start"></b><span>${escapeHtml(c.text)}</span><b class="tl-h r" data-h="end"></b></div>`).join('');
  tl.active = -1;
  tlRenderProg(); tlPlayhead();
}
function tlPlayhead(follow) {
  if (!tlEls.root) return;
  const t = els.video.currentTime || 0, pps = tlPps(), x = t * pps;
  tlEls.head.style.transform = `translateX(${x}px)`;
  tlEls.time.textContent = `${fmtTime(t)} / ${fmtTime(tlDur())}`;
  const i = cues.findIndex((c) => t >= c.start && t < c.end);
  if (i !== tl.active) {
    tlEls.cues.querySelector('.tl-cue.on')?.classList.remove('on');
    els.cues.querySelector('.cue.on')?.classList.remove('on');
    if (i >= 0) { tlEls.cues.querySelector(`[data-i="${i}"]`)?.classList.add('on'); els.cues.querySelector(`.cue[data-i="${i}"]`)?.classList.add('on'); }
    tl.active = i;
  }
  const sc = tlEls.scroll;
  if (follow && !tl.drag && (x < sc.scrollLeft + 20 || x > sc.scrollLeft + sc.clientWidth - 40)) sc.scrollLeft = Math.max(0, x - sc.clientWidth * 0.25);
}
const tlTimeAt = (e) => Math.max(0, Math.min(tlDur(), (e.clientX - tlEls.track.getBoundingClientRect().left) / tlPps()));
if (tlEls.root) {
  tlEls.track.addEventListener('pointerdown', (e) => {
    const h = e.target.closest('[data-h]'), cueEl = e.target.closest('.tl-cue');
    if (h && cueEl) {   // drag a caption's start or end
      e.preventDefault(); tlEls.track.setPointerCapture(e.pointerId);
      tl.drag = { i: +cueEl.dataset.i, k: h.dataset.h, el: cueEl };
      return;
    }
    if (cueEl) { const c = cues[+cueEl.dataset.i]; els.video.currentTime = c.start + 0.01; els.cues.querySelector(`.cue[data-i="${cueEl.dataset.i}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    els.video.currentTime = tlTimeAt(e);
    tl.drag = { seek: true }; tlEls.track.setPointerCapture(e.pointerId);
  });
  tlEls.track.addEventListener('pointermove', (e) => {
    const dr = tl.drag; if (!dr) return;
    const t = tlTimeAt(e);
    if (dr.seek) { els.video.currentTime = t; return; }
    const c = cues[dr.i], prev = cues[dr.i - 1], next = cues[dr.i + 1], pps = tlPps();
    if (dr.k === 'start') c.start = +Math.max(prev ? prev.end : 0, Math.min(c.end - 0.2, t)).toFixed(3);
    else c.end = +Math.min(next ? next.start : tlDur(), Math.max(c.start + 0.2, t)).toFixed(3);
    dr.el.style.left = `${c.start * pps}px`; dr.el.style.width = `${(c.end - c.start) * pps}px`;
    dr.moved = true;
  });
  const end = () => { const dr = tl.drag; tl.drag = null; if (dr && dr.moved) { const c = cues[dr.i]; retime(c); renderCues(); els.video.currentTime = (dr.k === 'start' ? c.start : Math.max(c.start, c.end - 0.4)) + 0.01; } };
  tlEls.track.addEventListener('pointerup', end); tlEls.track.addEventListener('pointercancel', end);
  tlEls.track.addEventListener('dblclick', (e) => { const cueEl = e.target.closest('.tl-cue'); if (cueEl) els.cues.querySelector(`.cue[data-i="${cueEl.dataset.i}"] textarea`)?.focus(); });
  const zoom = (dz) => { const t = els.video.currentTime || 0, sc = tlEls.scroll, off = t * tlPps() - sc.scrollLeft; tl.zoom = Math.max(-6, Math.min(4, tl.zoom + dz)); tlRender(); sc.scrollLeft = Math.max(0, t * tlPps() - off); };
  tlEls.zin.addEventListener('click', () => zoom(1)); tlEls.zout.addEventListener('click', () => zoom(-1));
  new ResizeObserver(() => tlRender()).observe(tlEls.scroll);
}

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
  tlRender(); drawOverlay();
}
els.cues.addEventListener('input', (e) => {
  const li = e.target.closest('.cue'); if (!li) return;
  const c = cues[+li.dataset.i], k = e.target.dataset.k;
  if (k === 'text') c.text = e.target.value;
  else { const v = parseTs(e.target.value); if (!isFinite(v)) return; c[k] = v; }
  retime(c); drawOverlay();
  const b = tlEls.cues && tlEls.cues.querySelector(`[data-i="${li.dataset.i}"]`);
  if (b) { const pps = tlPps(); b.style.left = `${c.start * pps}px`; b.style.width = `${Math.max(6, (c.end - c.start) * pps)}px`; b.title = c.text; b.querySelector('span').textContent = c.text; }
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
const tick = () => { drawOverlay(); tlPlayhead(true); if (!els.video.paused) raf = requestAnimationFrame(tick); };
els.video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
els.video.addEventListener('seeked', () => { drawOverlay(); tlPlayhead(!tl.drag); });
els.video.addEventListener('timeupdate', () => { if (els.video.paused) { drawOverlay(); tlPlayhead(false); } });
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
    let src = fromFile ? '' : spokenLang();
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

setupDropzone(els.drop, els.input, handleFiles);
renderStyleTiles(); applyStyleDefaults(); ensureFont(styleKey).then(drawOverlay);
window.__capTest = { setWords: (w) => { lastGroup = groupMode(); cues = groupWords(w, lastGroup); renderCues(); }, get cues() { return cues; }, groupWords, parseCaptions, canCaption };
