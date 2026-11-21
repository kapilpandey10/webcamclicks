/* WebcamClicks — on-device speech recognition worker (Whisper via transformers.js).
   - Word-level timestamps with the "_timestamped" Whisper models; falls back to the standard models.
   - Audio is cut at pauses into windows ≤ 24 s, so timings never drift across chunk boundaries.
   - Models download once from the Hugging Face hub and are cached by the browser (works offline after). */

import { planWindows, spreadOverRegions, speechAfter } from './vad.js';

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';   // self-contained build: bundles onnxruntime-web (the .web build needs a bundler)
let T = null, gpuOk = null;
const pipes = new Map();      // key → Promise<pipeline>
const loaded = new Map();     // file → [loaded, total] (download progress across all model files)

async function webgpuOk() {
  if (gpuOk == null) { try { gpuOk = !!(self.navigator.gpu && await self.navigator.gpu.requestAdapter()); } catch (_) { gpuOk = false; } }
  return gpuOk;
}

function onProgress(size) {
  return (p) => {
    if (p.status !== 'progress' || !p.total) return;
    loaded.set(`${size}|${p.file}`, [p.loaded, p.total]);
    let l = 0, t = 0; for (const [k, [a, b]] of loaded) if (k.startsWith(`${size}|`)) { l += a; t += b; }
    self.postMessage({ type: 'model', size, state: 'downloading', loaded: l, total: t });
  };
}

/** Load the best available model for this size: word-timestamped first, then standard; WebGPU first, then WASM. */
async function getAsr(size) {
  if (!T) { T = await import(TRANSFORMERS); T.env.allowLocalModels = false; }
  const gpu = await webgpuOk();
  const tries = [];
  const big = /large/.test(size);
  for (const device of gpu ? ['webgpu', 'wasm'] : ['wasm']) {
    if (big && device === 'wasm') continue;   // the large model is far too slow without a graphics chip
    tries.push([`onnx-community/whisper-${size}_timestamped`, true, device], [`onnx-community/whisper-${size}`, false, device]);
  }
  if (!tries.length) throw new Error('The Best model needs a graphics chip (WebGPU). Choose Accurate instead.');
  let lastErr = null;
  for (const [id, word, device] of tries) {
    const key = `${id}|${device}`;
    try {
      if (!pipes.has(key)) {
        pipes.set(key, T.pipeline('automatic-speech-recognition', id, {
          device,
          dtype: device === 'webgpu' ? { encoder_model: big ? 'fp16' : 'fp32', decoder_model_merged: 'q4' } : 'q8',
          progress_callback: onProgress(size)
        }));
      }
      const asr = await pipes.get(key);
      self.postMessage({ type: 'model', size, state: 'ready', word, device });
      return { asr, word, device };
    } catch (e) {
      pipes.delete(key); lastErr = e;
      if (/fetch|network|Failed to load|NetworkError|ERR_/i.test(String(e && e.message)) && !word) break;   // offline: don't keep trying
    }
  }
  throw lastErr || new Error('Speech model unavailable');
}

/**
 * Whisper's language identification (what OpenAI's detect_language does): encode up to three speech windows,
 * read the decoder's scores for every language token after <|startoftranscript|>, and add them up.
 * transformers.js would otherwise silently assume English when no language is given.
 */
async function detectLanguage(asr, audio, wins, sr) {
  const gc = asr.model.generation_config || {}, langs = Object.entries(gc.lang_to_id || {});
  if (!langs.length || gc.decoder_start_token_id == null) return null;
  const picks = wins.map((w) => ({ w, speech: w.regions.reduce((a, [x, y]) => a + (y - x), 0) })).sort((a, b) => b.speech - a.speech).slice(0, 3);
  const score = new Map();
  for (const { w, speech } of picks) {
    const slice = audio.subarray(Math.floor(w.start * sr), Math.min(audio.length, Math.ceil(Math.min(w.end, w.start + 30) * sr)));
    const { input_features } = await asr.processor(slice);
    const dec = new T.Tensor('int64', BigInt64Array.from([BigInt(gc.decoder_start_token_id)]), [1, 1]);
    const out = await asr.model({ input_features, decoder_input_ids: dec });
    const lg = out.logits.data, V = out.logits.dims[out.logits.dims.length - 1], off = lg.length - V;   // scores for the next token
    const vals = langs.map(([, id]) => Number(lg[off + id])), mx = Math.max(...vals);
    const ex = vals.map((v) => Math.exp(v - mx)), sum = ex.reduce((a, b) => a + b, 0);
    langs.forEach(([tok], i) => score.set(tok, (score.get(tok) || 0) + (ex[i] / sum) * speech));
  }
  const total = [...score.values()].reduce((a, b) => a + b, 0) || 1;
  const ranked = [...score].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([tok, v]) => ({ code: tok.replace(/[<|>]/g, ''), p: v / total }));
  return ranked;
}

/* ---------------------------------------------------------------- script guard
   Smaller Whisper models often write Hindi or Nepali in Urdu, Arabic or even Cyrillic letters. For languages with
   their own script, every token that could produce letters of ANOTHER script is suppressed, so the text can only
   come out in the right alphabet (plus Latin letters, digits and punctuation for names and numbers).
   Scripts are described by their UTF-8 bytes: 2-byte lead bytes, or the second byte after 0xE0 / 0xE1. */
const SCRIPTS = {
  deva: { e0: [0xa4, 0xa5] }, beng: { e0: [0xa6, 0xa7] }, guru: { e0: [0xa8, 0xa9] }, gujr: { e0: [0xaa, 0xab] }, orya: { e0: [0xac, 0xad] },
  taml: { e0: [0xae, 0xaf] }, telu: { e0: [0xb0, 0xb1] }, knda: { e0: [0xb2, 0xb3] }, mlym: { e0: [0xb4, 0xb5] }, sinh: { e0: [0xb6, 0xb7] },
  thai: { e0: [0xb8, 0xb9] }, laoo: { e0: [0xba, 0xbb] }, tibt: { e0: [0xbc, 0xbd, 0xbe, 0xbf] }, mymr: { e1: [0x80, 0x81, 0x82] }, geor: { two: [0x10a0], e1: [0x83] },
  ethi: { e1: [0x88, 0x89, 0x8a, 0x8b, 0x8c, 0x8d] }, khmr: { e1: [0x9e, 0x9f] },
  arab: { two: [0xd8, 0xd9, 0xda, 0xdb, 0xdd] }, hebr: { two: [0xd6, 0xd7] }, cyrl: { two: [0xd0, 0xd1, 0xd2, 0xd3, 0xd4] }, grek: { two: [0xcd, 0xce, 0xcf] }, armn: { two: [0xd4, 0xd5, 0xd6] }
};
const LANG_SCRIPT = { hi: 'deva', ne: 'deva', mr: 'deva', sa: 'deva', bn: 'beng', as: 'beng', pa: 'guru', gu: 'gujr', or: 'orya', ta: 'taml', te: 'telu', kn: 'knda', ml: 'mlym', si: 'sinh',
  th: 'thai', lo: 'laoo', bo: 'tibt', my: 'mymr', ka: 'geor', am: 'ethi', km: 'khmr', ar: 'arab', ur: 'arab', fa: 'arab', ps: 'arab', sd: 'arab', ug: 'arab', he: 'hebr', yi: 'hebr',
  ru: 'cyrl', uk: 'cyrl', be: 'cyrl', bg: 'cyrl', sr: 'cyrl', mk: 'cyrl', kk: 'cyrl', mn: 'cyrl', tg: 'cyrl', tt: 'cyrl', ba: 'cyrl', el: 'grek', hy: 'armn' };
let byteDecoder = null;
function bytesOfToken(tok) {   // GPT-2 byte-level BPE: each character stands for one byte
  if (!byteDecoder) {
    const bs = []; for (let b = 33; b <= 126; b++) bs.push(b); for (let b = 161; b <= 172; b++) bs.push(b); for (let b = 174; b <= 255; b++) bs.push(b);
    const cs = bs.slice(); let n = 0; for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
    byteDecoder = new Map(cs.map((c, i) => [String.fromCharCode(c), bs[i]]));
  }
  return [...tok].map((c) => byteDecoder.get(c));
}
/** Is this token able to produce letters outside the allowed script? (unknowable partial sequences are allowed) */
function foreign(bytes, sc) {
  const two = new Set(sc.two || []), e0 = new Set(sc.e0 || []), e1 = new Set(sc.e1 || []);
  for (let i = 0; i < bytes.length; i++) {
    const b = bytes[i];
    if (b == null || b < 0x80) continue;                       // ASCII: Latin letters, digits, punctuation
    if (b >= 0x80 && b <= 0xbf) continue;                      // continuation byte (checked with its lead byte)
    if (b === 0xc2) continue;                                  // Latin-1 punctuation (« » ° nbsp)
    if (b >= 0xc3 && b <= 0xdf) { if (!two.has(b)) return true; continue; }
    if (b === 0xe0) { const n = bytes[i + 1]; if (n != null && !e0.has(n)) return true; continue; }
    if (b === 0xe1) { const n = bytes[i + 1]; if (n != null && !e1.has(n)) return true; continue; }
    if (b === 0xe2) continue;                                  // general punctuation, currency (… “ ” – ₹)
    return true;                                               // CJK, emoji and everything else
  }
  return false;
}
const guardCache = new Map();
function scriptGuard(asr, language) {
  const sc = SCRIPTS[LANG_SCRIPT[language]]; if (!sc) return null;
  const key = `${language}`; if (guardCache.has(key)) return guardCache.get(key);
  const ids = [];
  try {
    const vocab = asr.tokenizer.get_vocab ? asr.tokenizer.get_vocab() : null;
    const entries = vocab instanceof Map ? [...vocab] : vocab ? Object.entries(vocab) : [];
    for (const [tok, id] of entries) { if (!tok.startsWith('<|') && foreign(bytesOfToken(tok), sc)) ids.push(id); }
  } catch (e) { console.warn('script guard unavailable', e); }
  const out = ids.length ? ids : null;
  guardCache.set(key, out);
  return out;
}

/* ---------------------------------------------------------------- hallucination guards */
// phrases Whisper invents at the end of a window or on silence (learned from subtitle files)
const HALLUCINATIONS = /ご視聴ありがとうございました|ご覧いただきありがとうございます|チャンネル登録|字幕由.*?提供|Amara\.org|Sous-titrage|Untertitel (der|im Auftrag)|Продолжение следует|Субтитры (сделал|создавал)|구독과 좋아요|시청해 주셔서 감사합니다|請不吝點贊|訂閱|Thank you for watching\.?\s*$/gi;
function looping(words) {
  const t = words.map((w) => w.text.trim().toLowerCase()).filter(Boolean);
  if (t.length < 8) return false;
  let run = 1; for (let i = 1; i < t.length; i++) { run = t[i] === t[i - 1] ? run + 1 : 1; if (run >= 4) return true; }
  return new Set(t).size / t.length < 0.3;
}
/** Remove words that belong to a hallucinated phrase (phrases span several word chunks). */
function dropPhrases(chunks) {
  let text = ''; const at = [];
  chunks.forEach((c, i) => { for (let k = 0; k < c.text.length; k++) at.push(i); text += c.text; });
  const bad = new Set();
  for (const m of text.matchAll(HALLUCINATIONS)) for (let k = m.index; k < m.index + m[0].length; k++) if (/\S/.test(text[k])) bad.add(at[k]);
  return bad.size ? chunks.filter((_, i) => !bad.has(i)) : chunks;
}
function collapseRepeats(chunks) {
  const out = []; let run = 0;
  for (const c of chunks) { const k = c.text.trim().toLowerCase(); run = out.length && out[out.length - 1].text.trim().toLowerCase() === k ? run + 1 : 0; if (run < 2) out.push(c); }
  return out;
}

const NOISE = /^\s*[[(♪*].*[\])♪*]\s*$|\[BLANK_AUDIO\]/i;   // "[Music]", "(applause)", "♪ … ♪"

function validWords(chunks, len) {
  if (!chunks || !chunks.length) return false;
  let prev = -1, distinct = new Set();
  for (const c of chunks) {
    const [s, e] = c.timestamp || [];
    if (!Number.isFinite(s) || s < -0.2 || s > len + 0.5 || (Number.isFinite(e) && e < s - 0.05) || s < prev - 0.3) return false;
    prev = s; distinct.add(Math.round(s * 10));
  }
  return chunks.length < 4 || distinct.size > chunks.length * 0.4;
}

const tokensOf = (text) => {
  const t = String(text || '').replace(/\s+/g, ' ').trim(); if (!t) return [];
  if (/\s/.test(t)) return t.split(' ').map((w) => ` ${w}`);
  const out = []; for (let i = 0; i < t.length; i += 2) out.push(t.slice(i, i + 2)); return out;
};

// languages the tiny and base models transcribe well; for all others a bigger model is used automatically
const WELL_SUPPORTED = new Set(['en', 'es', 'fr', 'de', 'it', 'pt', 'nl', 'ru', 'ja', 'zh', 'ko', 'pl', 'tr', 'sv', 'ca', 'id', 'uk', 'cs', 'ro', 'da', 'no', 'fi', 'hu', 'el', 'vi', 'ms']);

async function run({ id, audio, size, language: lang0, task, autoUpgrade = true }) {
  let language = lang0;
  const post = (m) => self.postMessage({ id, ...m });
  post({ type: 'status', text: 'Preparing the speech model…' });
  let { asr, word, device } = await getAsr(size);
  const sr = 16000;
  const wins = planWindows(audio, sr);
  if (!wins.length) { post({ type: 'done', words: [], mode: word ? 'word' : 'segment' }); return; }
  if (!language) {
    post({ type: 'status', text: 'Detecting the spoken language…' });
    let ranked = null;
    try { ranked = await detectLanguage(asr, audio, wins, sr); } catch (e) { console.warn('language detection failed', e); }
    if (!ranked || !ranked.length) throw new Error('NO_LANG');
    language = ranked[0].code;
    post({ type: 'language', ranked });
  }
  if (autoUpgrade && /^(tiny|base)$/.test(size) && !WELL_SUPPORTED.has(language)) {
    const up = (await webgpuOk()) ? 'large-v3-turbo' : 'small';
    post({ type: 'status', text: `This language needs a larger speech model for good text. Switching to ${up === 'small' ? 'Accurate' : 'Best'} (one-time download)…` });
    try { ({ asr, word, device } = await getAsr(up)); post({ type: 'upgraded', size: up }); }
    catch (e) { if (up !== 'small') { try { ({ asr, word, device } = await getAsr('small')); post({ type: 'upgraded', size: 'small' }); } catch (_) { /* keep the current model */ } } }
  }
  // script guard: the text can only come out in the language's own alphabet
  let suppress = null;
  if (task !== 'translate') {
    const extra = scriptGuard(asr, language);
    if (extra) { suppress = [...new Set([...(asr.model.generation_config.suppress_tokens || []), ...extra])]; post({ type: 'debug', text: `script guard: ${extra.length} tokens suppressed for ${language}`, win: [0, 0], n: 0 }); }
  }
  post({ type: 'status', text: `Listening on your ${device === 'webgpu' ? 'graphics chip' : 'processor'}…` });
  const words = [];
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i], len = w.end - w.start;
    const slice = audio.subarray(Math.floor(w.start * sr), Math.min(audio.length, Math.ceil(w.end * sr)));
    const opts = { language, task: task || 'transcribe' };
    if (suppress) opts.suppress_tokens = suppress;
    let out;
    try { out = await asr(slice, { ...opts, return_timestamps: word ? 'word' : true }); }
    catch (e) { if (word) out = await asr(slice, { ...opts, return_timestamps: true }); else throw e; }
    if (looping(out.chunks || [])) {   // stuck in a loop: decode again with some randomness (Whisper's temperature fallback)
      try { const again = await asr(slice, { ...opts, return_timestamps: word ? 'word' : true, do_sample: true, temperature: 0.4, top_k: 0, no_repeat_ngram_size: 3 }); if (!looping(again.chunks || [])) out = again; } catch (_) { /* keep the first result */ }
    }
    out.text = String(out.text || '').replace(HALLUCINATIONS, '');
    const chunks = collapseRepeats(dropPhrases((out.chunks || []).filter((c) => c.text && !NOISE.test(c.text))));
    post({ type: 'debug', win: [w.start, w.end], text: out.text, n: (out.chunks || []).length, valid: word ? validWords(chunks, len) : null, first: (out.chunks || []).slice(0, 3), last: (out.chunks || []).slice(-2) });
    const first = words.length;
    if (word && validWords(chunks, len)) {
      for (const c of chunks) {
        const s = w.start + c.timestamp[0], e = w.start + (Number.isFinite(c.timestamp[1]) ? c.timestamp[1] : c.timestamp[0] + 0.35);
        words.push({ text: c.text, start: +s.toFixed(3), end: +Math.max(s + 0.05, e).toFixed(3) });
      }
    } else if (!word && chunks.length > 1 && chunks.every((c) => Number.isFinite(c.timestamp?.[0]))) {
      for (const c of chunks) {
        const s = w.start + c.timestamp[0], e = w.start + (Number.isFinite(c.timestamp[1]) ? c.timestamp[1] : len);
        words.push(...spreadOverRegions(tokensOf(c.text), [[s, Math.max(s + 0.2, e)]]));
      }
    } else {
      words.push(...spreadOverRegions(tokensOf(String(out.text || '').replace(NOISE, '')), w.regions));
    }
    // the first word of a new window needs a leading space in space-separated languages
    if (first > 0 && words[first] && !/^\s/.test(words[first].text) && (/^\s/.test(words[first - 1].text) || /^\s/.test(words[first + 1]?.text || ''))) words[first].text = ` ${words[first].text}`;
    // Whisper occasionally stops after a sentence: if clear speech follows the last word, transcribe the rest again
    const lastEnd = words.length > first ? words[words.length - 1].end : w.start;
    if (lastEnd < w.end - 1.5 && lastEnd > w.start + 0.5 && speechAfter(w, lastEnd + 0.4) > 1 && !w.retry) {
      wins.splice(i + 1, 0, { start: lastEnd + 0.05, end: w.end, regions: w.regions.map(([x, y]) => [Math.max(x, lastEnd), y]).filter(([x, y]) => y > x), retry: true });
    }
    post({ type: 'progress', done: (i + 1) / wins.length, words: words.length });
  }
  post({ type: 'done', words, mode: word ? 'word' : 'segment' });
}

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === 'preload') {
    try { await getAsr(m.size); } catch (err) { self.postMessage({ type: 'model', size: m.size, state: 'error', error: String(err && err.message || err) }); }
    return;
  }
  if (m.type === 'run') {
    try { await run(m); }
    catch (err) { self.postMessage({ id: m.id, type: 'error', text: String(err && err.message || err) }); }
  }
};
