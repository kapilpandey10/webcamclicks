/* WebcamClicks — Voice typing: speak and the browser's speech recognition types for you.
   Text is saved only in this browser. Needs Google Chrome (or Edge / Safari, which have speech recognition). */

import { $, setStatus, downloadBlob, copyText, escapeHtml } from './common.js';

// [label, locale]
const LANGS = [['English (United States)', 'en-US'], ['English (United Kingdom)', 'en-GB'], ['English (India)', 'en-IN'], ['English (Australia)', 'en-AU'],
  ['Nepali', 'ne-NP'], ['Hindi', 'hi-IN'], ['Bengali', 'bn-IN'], ['Urdu', 'ur-PK'], ['Tamil', 'ta-IN'], ['Telugu', 'te-IN'], ['Marathi', 'mr-IN'], ['Gujarati', 'gu-IN'],
  ['Punjabi', 'pa-IN'], ['Sinhala', 'si-LK'], ['Spanish (Spain)', 'es-ES'], ['Spanish (Mexico)', 'es-MX'], ['Spanish (United States)', 'es-US'], ['French', 'fr-FR'],
  ['German', 'de-DE'], ['Portuguese (Brazil)', 'pt-BR'], ['Portuguese (Portugal)', 'pt-PT'], ['Italian', 'it-IT'], ['Dutch', 'nl-NL'], ['Arabic', 'ar-SA'], ['Persian', 'fa-IR'],
  ['Turkish', 'tr-TR'], ['Russian', 'ru-RU'], ['Ukrainian', 'uk-UA'], ['Polish', 'pl-PL'], ['Czech', 'cs-CZ'], ['Romanian', 'ro-RO'], ['Greek', 'el-GR'], ['Hebrew', 'he-IL'],
  ['Chinese (Mandarin, Simplified)', 'zh-CN'], ['Chinese (Mandarin, Traditional)', 'zh-TW'], ['Cantonese', 'yue-Hant-HK'], ['Japanese', 'ja-JP'], ['Korean', 'ko-KR'],
  ['Vietnamese', 'vi-VN'], ['Thai', 'th-TH'], ['Indonesian', 'id-ID'], ['Malay', 'ms-MY'], ['Filipino', 'fil-PH'], ['Swedish', 'sv-SE'], ['Norwegian', 'nb-NO'],
  ['Danish', 'da-DK'], ['Finnish', 'fi-FI'], ['Hungarian', 'hu-HU'], ['Swahili', 'sw-KE']];

const els = {
  lang: $('#vt-lang'), mic: $('#vt-mic'), micLabel: $('#vt-mic-label'), text: $('#vt-text'), live: $('#vt-live'), status: $('#t-status'),
  copy: $('#vt-copy'), dl: $('#vt-download'), clear: $('#vt-clear'), undo: $('#vt-undo'), count: $('#vt-count'), cmds: $('#vt-cmds'),
  caps: $('#vt-caps'), note: $('#vt-note'), level: $('#vt-level')
};
const store = { get(k, d) { try { return localStorage.getItem(`wc_vt_${k}`) ?? d; } catch (_) { return d; } }, set(k, v) { try { localStorage.setItem(`wc_vt_${k}`, v); } catch (_) { /* ignore */ } } };

els.lang.innerHTML = LANGS.map(([n, l]) => `<option value="${l}">${escapeHtml(n)}</option>`).join('');
const guess = () => { for (const l of navigator.languages || [navigator.language || 'en-US']) { const hit = LANGS.find(([, x]) => x.toLowerCase() === String(l).toLowerCase()) || LANGS.find(([, x]) => x.slice(0, 2) === String(l).slice(0, 2)); if (hit) return hit[1]; } return 'en-US'; };
els.lang.value = store.get('lang', '') || guess();
if (!els.lang.value) els.lang.value = 'en-US';
els.cmds.checked = store.get('cmds', '1') === '1';
els.caps.checked = store.get('caps', '1') === '1';
els.text.value = store.get('text', '');

/* ---------------------------------------------------------------- support */
const Recognition = self.SpeechRecognition || self.webkitSpeechRecognition;
function browserName() {
  if (navigator.brave) return 'Brave';
  const ua = navigator.userAgent;
  if (/OPR\//.test(ua)) return 'Opera'; if (/Vivaldi/.test(ua)) return 'Vivaldi'; if (/YaBrowser/.test(ua)) return 'Yandex Browser'; if (/Firefox\//.test(ua)) return 'Firefox';
  return '';
}
const blocked = !Recognition || !!browserName();   // these browsers have no speech service behind the API
if (blocked) {
  els.note.hidden = false;
  els.note.innerHTML = `<b>Google Chrome is required to use this feature.</b> ${browserName() || 'This browser'} can't turn speech into text. Open this page in Chrome (computer or Android). Safari and Edge work too.`;
  els.mic.disabled = true;
}

/* ---------------------------------------------------------------- editing helpers */
const history = [];
function snapshot() { history.push(els.text.value); if (history.length > 50) history.shift(); els.undo.disabled = false; }
function save() { store.set('text', els.text.value); updateCount(); }
function updateCount() {
  const t = els.text.value.trim();
  const words = t ? (t.match(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu) || []).length : 0;
  els.count.textContent = `${words} word${words === 1 ? '' : 's'} · ${els.text.value.length} characters`;
  const has = els.text.value.length > 0;
  els.copy.disabled = els.dl.disabled = els.clear.disabled = !has;
}
els.text.addEventListener('input', save);

// spoken punctuation & commands (English)
const CMDS = [
  [/\s*\b(new paragraph)\b\s*/gi, '\n\n'], [/\s*\b(new line|next line)\b\s*/gi, '\n'],
  [/\s*\b(full stop|period)\b/gi, '.'], [/\s*\bcomma\b/gi, ','], [/\s*\bquestion mark\b/gi, '?'], [/\s*\b(exclamation mark|exclamation point)\b/gi, '!'],
  [/\s*\bcolon\b/gi, ':'], [/\s*\bsemicolon\b/gi, ';'], [/\s*\b(dash|hyphen)\b\s*/gi, ' - '], [/\s*\bopen (bracket|parenthesis)\s*/gi, ' ('], [/\s*\bclose (bracket|parenthesis)\b/gi, ')'],
  [/\s*\b(open quote|quote)\s*/gi, ' "'], [/\s*\b(close quote|unquote|end quote)\b/gi, '"'], [/\bsmiley face\b/gi, ':)']
];
// Nepali / Hindi sentence end
const DEVANAGARI_CMDS = [[/\s*(पूर्णविराम|पूर्ण विराम)/g, '।'], [/\s*(अल्पविराम)/g, ','], [/\s*(प्रश्नवाचक चिन्ह)/g, '?'], [/\s*(नयाँ लाइन|नई लाइन)\s*/g, '\n']];

function polish(chunk, before) {
  let t = chunk;
  if (els.cmds.checked) {
    if (/^en/.test(els.lang.value)) for (const [re, rep] of CMDS) t = t.replace(re, rep);
    if (/^(ne|hi|mr)/.test(els.lang.value)) for (const [re, rep] of DEVANAGARI_CMDS) t = t.replace(re, rep);
  }
  t = t.replace(/\s+([.,?!:;)])/g, '$1').replace(/[ \t]+/g, ' ');
  if (els.caps.checked) {
    // capital letter at the start of the text and after . ? ! or a new line (scripts with capitals only)
    const startOfSentence = !before.trim() || /[.?!।]\s*$|\n\s*$/.test(before);
    if (startOfSentence) t = t.replace(/^(\s*)(\p{Ll})/u, (m, s, c) => s + c.toUpperCase());
    t = t.replace(/([.?!]\s+|\n\s*)(\p{Ll})/gu, (m, s, c) => s + c.toUpperCase());
  }
  return t;
}
/** Insert dictated text at the cursor (or the end), with sensible spacing. */
function insert(raw) {
  const el = els.text;
  const atEnd = document.activeElement !== el;
  const s = atEnd ? el.value.length : el.selectionStart, e = atEnd ? el.value.length : el.selectionEnd;
  const before = el.value.slice(0, s), after = el.value.slice(e);
  let t = polish(raw.trim(), before);
  if (!t) return;
  const noSpaceScripts = /^(zh|ja|th|yue)/.test(els.lang.value);
  if (before && !/[\s(“"]$/.test(before) && !/^[\s.,?!:;)।]/.test(t) && !noSpaceScripts) t = ` ${t}`;
  if (after && !/^[\s.,?!:;)]/.test(after) && !/\s$/.test(t) && !noSpaceScripts) t += ' ';
  snapshot();
  el.value = before + t + after;
  const pos = before.length + t.length;
  if (!atEnd) el.setSelectionRange(pos, pos); else el.scrollTop = el.scrollHeight;
  save();
}

/* ---------------------------------------------------------------- listening */
let rec = null, on = false, starting = false, netErrors = 0, meter = null;
function setMic(state) {
  els.mic.dataset.state = state;
  els.mic.setAttribute('aria-pressed', String(state === 'on'));
  els.micLabel.textContent = state === 'on' ? 'Listening… tap to stop' : state === 'wait' ? 'Starting…' : 'Tap to start speaking';
}
async function startMeter() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    const ctx = new AudioContext(); const an = ctx.createAnalyser(); an.fftSize = 512;
    ctx.createMediaStreamSource(stream).connect(an);
    const buf = new Uint8Array(an.fftSize);
    const tick = () => {
      if (!meter) return;
      an.getByteTimeDomainData(buf); let pk = 0; for (const v of buf) pk = Math.max(pk, Math.abs(v - 128));
      els.level.style.setProperty('--lv', Math.min(1, pk / 70).toFixed(2));
      meter.raf = requestAnimationFrame(tick);
    };
    meter = { stream, ctx, raf: 0 }; tick();
  } catch (_) { /* the level ring is only decoration */ }
}
function stopMeter() { if (!meter) return; cancelAnimationFrame(meter.raf); meter.stream.getTracks().forEach((t) => t.stop()); meter.ctx.close().catch(() => {}); meter = null; els.level.style.setProperty('--lv', 0); }

function startRec() {
  rec = new Recognition();
  rec.lang = els.lang.value; rec.continuous = true; rec.interimResults = true; rec.maxAlternatives = 1;
  rec.onstart = () => { starting = false; setMic('on'); setStatus(els.status, `Listening in ${els.lang.selectedOptions[0].text}. Speak naturally; pause briefly between sentences.`); };
  rec.onresult = (e) => {
    netErrors = 0;
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) insert(r[0].transcript); else interim += r[0].transcript;
    }
    els.live.textContent = interim;
  };
  rec.onerror = (e) => {
    if (e.error === 'no-speech' || e.error === 'aborted') return;
    if (e.error === 'network' && ++netErrors <= 2) return;   // retry on end
    stop();
    setStatus(els.status, e.error === 'not-allowed' || e.error === 'service-not-allowed' ? 'Microphone access was blocked. Allow the microphone for this site (the icon in the address bar) and try again.'
      : e.error === 'audio-capture' ? 'No microphone was found. Plug one in or check your sound settings.'
      : e.error === 'network' ? 'The speech service didn\'t answer. Google Chrome is required, and you need to be online. Some networks and VPNs block it: try another network.'
      : e.error === 'language-not-supported' ? 'This language isn\'t available in your browser. Try another, or use Google Chrome.' : `Voice typing stopped: ${e.error}`, 'err');
  };
  rec.onend = () => { els.live.textContent = ''; if (on) setTimeout(() => { if (on) { try { startRec(); } catch (_) { stop(); } } }, netErrors ? 700 : 50); };   // keep listening through pauses
  rec.start();
}
function start() {
  if (blocked || on) return;
  on = true; starting = true; setMic('wait'); netErrors = 0;
  try { startRec(); } catch (e) { stop(); setStatus(els.status, `Could not start: ${e.message}`, 'err'); return; }
  startMeter();
}
function stop() {
  on = false; starting = false;
  try { rec && rec.stop(); } catch (_) { /* ignore */ }
  stopMeter(); setMic('off'); els.live.textContent = '';
  if (els.status.dataset.kind !== 'err') setStatus(els.status, els.text.value ? 'Stopped. Edit the text, then copy or download it.' : '');
}
els.mic.addEventListener('click', () => (on || starting ? stop() : start()));
document.addEventListener('keydown', (e) => {   // Ctrl/Cmd + Shift + Space toggles the mic
  if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.code === 'Space') { e.preventDefault(); els.mic.click(); }
});
els.lang.addEventListener('change', () => { store.set('lang', els.lang.value); if (on) { stop(); start(); } });
els.cmds.addEventListener('change', () => store.set('cmds', els.cmds.checked ? '1' : '0'));
els.caps.addEventListener('change', () => store.set('caps', els.caps.checked ? '1' : '0'));

/* ---------------------------------------------------------------- actions */
els.copy.addEventListener('click', async () => { const ok = await copyText(els.text.value); setStatus(els.status, ok ? 'Copied to the clipboard.' : 'Could not copy; select the text and press Ctrl+C.', ok ? 'ok' : 'err'); });
els.dl.addEventListener('click', () => {
  const name = `voice-typing-${new Date().toISOString().slice(0, 10)}.txt`;
  downloadBlob(new Blob([els.text.value.replace(/\n/g, '\r\n')], { type: 'text/plain;charset=utf-8' }), name);
});
els.clear.addEventListener('click', () => { snapshot(); els.text.value = ''; save(); els.text.focus(); });
els.undo.addEventListener('click', () => { if (!history.length) return; els.text.value = history.pop(); els.undo.disabled = !history.length; save(); });
els.undo.disabled = true;
setMic('off'); updateCount();
window.__vtTest = { insert, polish };
