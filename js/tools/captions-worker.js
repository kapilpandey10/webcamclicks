/* WebcamClicks — on-device speech recognition worker (Whisper via transformers.js).
   Models download once from the Hugging Face hub and are cached by the browser. */

const TRANSFORMERS = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2/dist/transformers.min.js';   // self-contained build: bundles onnxruntime-web (the .web build needs a bundler)
let T = null, asr = null, loadedKey = '';

async function webgpuOk() {
  try { return !!(self.navigator.gpu && await self.navigator.gpu.requestAdapter()); } catch (_) { return false; }
}

async function getPipeline(model, progress) {
  if (!T) { T = await import(TRANSFORMERS); T.env.allowLocalModels = false; }
  const gpu = await webgpuOk();
  const key = `${model}|${gpu}`;
  if (asr && loadedKey === key) return { asr, gpu };
  asr = await T.pipeline('automatic-speech-recognition', model, {
    device: gpu ? 'webgpu' : 'wasm',
    dtype: gpu ? { encoder_model: 'fp32', decoder_model_merged: 'q4' } : 'q8',
    progress_callback: (p) => { if (p.status === 'progress' && p.total) progress({ stage: 'download', file: p.file, loaded: p.loaded, total: p.total }); }
  });
  loadedKey = key;
  return { asr, gpu };
}

self.onmessage = async (e) => {
  const { audio, model, language, task } = e.data;
  const post = (m) => self.postMessage(m);
  try {
    post({ type: 'status', text: 'Loading speech model (first time only)…' });
    const { asr: run, gpu } = await getPipeline(model, (p) => post({ type: 'progress', ...p }));
    post({ type: 'status', text: `Transcribing on your ${gpu ? 'graphics chip (WebGPU)' : 'processor'}…` });
    const total = audio.length / 16000;
    const out = await run(audio, {
      return_timestamps: true, chunk_length_s: 30, stride_length_s: 5,
      language: language || null, task: task || 'transcribe',
      chunk_callback: (c) => { if (c && c.offset != null) post({ type: 'progress', stage: 'transcribe', done: Math.min(1, (c.offset + 30) / total) }); }
    });
    post({ type: 'done', text: out.text, chunks: out.chunks || [] });
  } catch (err) {
    post({ type: 'error', text: String(err && err.message || err) });
  }
};
