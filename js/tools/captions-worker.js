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
   Small Whisper models often write Hindi, Nepali or Marathi in Urdu/Arabic letters (the spoken languages sound alike).
   For languages that are never written in Arabic script, tokens containing Arabic letters are suppressed. */
const NON_ARABIC_SCRIPT = new Set(['hi', 'ne', 'mr', 'sa', 'bn', 'as', 'gu', 'pa', 'ta', 'te', 'kn', 'ml', 'si', 'or', 'my', 'th', 'lo', 'km', 'bo', 'zh', 'ja', 'ko', 'ru', 'uk', 'be', 'bg', 'sr', 'mk', 'el', 'hy', 'ka', 'he', 'yi', 'am',
  'en', 'es', 'fr', 'de', 'pt', 'it', 'nl', 'pl', 'cs', 'sk', 'ro', 'hu', 'sv', 'no', 'nn', 'da', 'fi', 'et', 'lv', 'lt', 'tr', 'vi', 'id', 'ms', 'tl', 'sw', 'jw', 'su']);
let byteDecoder = null;
function bytesOfToken(tok) {   // GPT-2 byte-level BPE: each character stands for one byte
  if (!byteDecoder) {
    const bs = []; for (let b = 33; b <= 126; b++) bs.push(b); for (let b = 161; b <= 172; b++) bs.push(b); for (let b = 174; b <= 255; b++) bs.push(b);
    const cs = bs.slice(); let n = 0; for (let b = 0; b < 256; b++) if (!bs.includes(b)) { bs.push(b); cs.push(256 + n++); }
    byteDecoder = new Map(cs.map((c, i) => [String.fromCharCode(c), bs[i]]));
  }
  return [...tok].map((c) => byteDecoder.get(c));
}
const arabicCache = new Map();
function arabicTokenIds(asr) {
  if (arabicCache.has(asr)) return arabicCache.get(asr);
  const ids = [];
  try {
    const m = asr.tokenizer.model, vocab = Array.isArray(m.vocab) ? m.vocab : [...(m.tokens_to_ids || new Map()).keys()];
    const toId = (t, i) => (Array.isArray(m.vocab) ? i : m.tokens_to_ids.get(t));
    vocab.forEach((t, i) => {
      if (!t || t.startsWith('<|')) return;
      const b = bytesOfToken(t);
      // UTF-8 lead bytes 0xD8–0xDB encode U+0600–U+06FF (Arabic, Urdu, Persian letters)
      if (b.some((x) => x >= 0xd8 && x <= 0xdb)) ids.push(toId(t, i));
    });
  } catch (e) { console.warn('script guard unavailable', e); }
  arabicCache.set(asr, ids);
  return ids;
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

async function run({ id, audio, size, language: lang0, task }) {
  let language = lang0;
  const post = (m) => self.postMessage({ id, ...m });
  post({ type: 'status', text: 'Preparing the speech model…' });
  const { asr, word, device } = await getAsr(size);
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
  // script guard: languages never written in Arabic letters can't produce them
  let suppress = null;
  if (task !== 'translate' && NON_ARABIC_SCRIPT.has(language)) {
    const extra = arabicTokenIds(asr);
    if (extra.length) suppress = [...new Set([...(asr.model.generation_config.suppress_tokens || []), ...extra])];
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
