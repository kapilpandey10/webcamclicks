/* WebcamClicks — on-device speech recognition worker (Whisper via transformers.js).
   - Word-level timestamps with the "_timestamped" Whisper models; falls back to the standard models.
   - Audio is cut at pauses into windows ≤ 24 s, so timings never drift across chunk boundaries.
   - Models download once from the Hugging Face hub and are cached by the browser (works offline after). */

import { planWindows, spreadOverRegions } from './vad.js';

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
  for (const device of gpu ? ['webgpu', 'wasm'] : ['wasm']) {
    tries.push([`onnx-community/whisper-${size}_timestamped`, true, device], [`onnx-community/whisper-${size}`, false, device]);
  }
  let lastErr = null;
  for (const [id, word, device] of tries) {
    const key = `${id}|${device}`;
    try {
      if (!pipes.has(key)) {
        pipes.set(key, T.pipeline('automatic-speech-recognition', id, {
          device,
          dtype: device === 'webgpu' ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
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

async function run({ id, audio, size, language, task }) {
  const post = (m) => self.postMessage({ id, ...m });
  post({ type: 'status', text: 'Preparing the speech model…' });
  const { asr, word, device } = await getAsr(size);
  const sr = 16000;
  const wins = planWindows(audio, sr);
  if (!wins.length) { post({ type: 'done', words: [], mode: word ? 'word' : 'segment' }); return; }
  post({ type: 'status', text: `Listening on your ${device === 'webgpu' ? 'graphics chip' : 'processor'}…` });
  const words = [];
  for (let i = 0; i < wins.length; i++) {
    const w = wins[i], len = w.end - w.start;
    const slice = audio.subarray(Math.floor(w.start * sr), Math.min(audio.length, Math.ceil(w.end * sr)));
    let out;
    try { out = await asr(slice, { return_timestamps: word ? 'word' : true, language: language || null, task: task || 'transcribe' }); }
    catch (e) { if (word) out = await asr(slice, { return_timestamps: true, language: language || null, task: task || 'transcribe' }); else throw e; }
    const chunks = (out.chunks || []).filter((c) => c.text && !NOISE.test(c.text));
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
