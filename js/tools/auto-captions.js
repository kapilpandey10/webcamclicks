/* WebcamClicks — Auto captions: transcribe on-device (Whisper), edit, translate, export SRT/VTT, burn into video. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';

const LANGS = [['', 'Detect automatically'], ['en', 'English'], ['es', 'Spanish'], ['fr', 'French'], ['de', 'German'], ['pt', 'Portuguese'], ['it', 'Italian'],
  ['nl', 'Dutch'], ['hi', 'Hindi'], ['ne', 'Nepali'], ['bn', 'Bengali'], ['ta', 'Tamil'], ['te', 'Telugu'], ['mr', 'Marathi'], ['ur', 'Urdu'],
  ['ar', 'Arabic'], ['fa', 'Persian'], ['tr', 'Turkish'], ['ru', 'Russian'], ['uk', 'Ukrainian'], ['pl', 'Polish'], ['cs', 'Czech'], ['ro', 'Romanian'],
  ['el', 'Greek'], ['he', 'Hebrew'], ['zh', 'Chinese'], ['ja', 'Japanese'], ['ko', 'Korean'], ['vi', 'Vietnamese'], ['th', 'Thai'], ['id', 'Indonesian'],
  ['ms', 'Malay'], ['tl', 'Filipino'], ['sv', 'Swedish'], ['no', 'Norwegian'], ['da', 'Danish'], ['fi', 'Finnish'], ['hu', 'Hungarian']];
const MODELS = { fast: 'onnx-community/whisper-tiny', balanced: 'onnx-community/whisper-base', accurate: 'onnx-community/whisper-small' };

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), video: $('#cap-video'), overlay: $('#cap-overlay'), stage: $('#cap-stage'),
  model: $('#cap-model'), lang: $('#cap-lang'), task: $('#cap-task'), run: $('#cap-run'), bar: $('#cap-bar'), fill: $('#cap-fill'),
  cues: $('#cap-cues'), add: $('#cap-add'), shift: $('#cap-shift'), shiftBtn: $('#cap-shift-btn'), style: $('#cap-style'), size: $('#cap-size'),
  pos: $('#cap-pos'), srt: $('#cap-srt'), vtt: $('#cap-vtt'), txt: $('#cap-txt'), burn: $('#cap-burn'), importIn: $('#cap-import'),
  trWrap: $('#cap-tr-wrap'), trLang: $('#cap-tr-lang'), trRun: $('#cap-tr-run'), trUndo: $('#cap-tr-undo'), trNote: $('#cap-tr-note'), editor: $('#cap-editor'),
  info: $('#cap-info')
};

els.lang.innerHTML = LANGS.map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.innerHTML = LANGS.slice(1).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
els.trLang.value = (navigator.language || 'en').slice(0, 2) === 'en' ? 'es' : (navigator.language || 'en').slice(0, 2);

let file = null, cues = [], duration = 0, worker = null;

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
  setStatus(els.status, 'Choose the spoken language (or leave it on automatic) and press Generate captions.');
  sizeOverlay();
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
  const ctx = new OfflineAudioContext(1, Math.ceil(end * 16000), 16000);
  const buf = ctx.createBuffer(1, len, sr); buf.copyToChannel(mono, 0);
  const src = ctx.createBufferSource(); src.buffer = buf; src.connect(ctx.destination); src.start();
  return (await ctx.startRendering()).getChannelData(0);
}

/* ---------------------------------------------------------------- transcribe */
function startWorker() {
  if (worker) return worker;
  worker = new Worker(new URL('./captions-worker.js', import.meta.url), { type: 'module' });
  return worker;
}

els.run.addEventListener('click', async () => {
  if (!file) return;
  els.run.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%';
  try {
    setStatus(els.status, 'Reading the audio…');
    const pcm = await audio16k();
    const w = startWorker();
    const result = await new Promise((resolve, reject) => {
      w.onmessage = (e) => {
        const m = e.data;
        if (m.type === 'status') setStatus(els.status, m.text);
        if (m.type === 'progress' && m.stage === 'download') { els.fill.style.width = `${Math.round((m.loaded / m.total) * 100)}%`; setStatus(els.status, `Downloading speech model: ${formatBytes(m.loaded)} of ${formatBytes(m.total)} (first time only)…`); }
        if (m.type === 'progress' && m.stage === 'transcribe') els.fill.style.width = `${Math.round(m.done * 100)}%`;
        if (m.type === 'done') resolve(m);
        if (m.type === 'error') reject(new Error(m.text));
      };
      w.postMessage({ audio: pcm, model: MODELS[els.model.value], language: els.lang.value, task: els.task.value }, [pcm.buffer]);
    });
    cues = buildCues(result.chunks, duration);
    renderCues();
    setStatus(els.status, cues.length ? `Done: ${cues.length} captions. Play the video to check them, edit any line, then export.` : 'No speech was detected.', cues.length ? 'ok' : 'err');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, /fetch|network|Failed to load/i.test(e.message) ? 'Could not download the speech model. Check your connection and try again.' : `Captioning failed: ${e.message}`, 'err');
  }
  els.bar.hidden = true; els.run.disabled = false;
});

/** Split Whisper segments into readable captions: ≤ 42 chars per line, ≤ 2 lines, ≤ 6 s. */
export function buildCues(chunks, total) {
  const out = [];
  const noSpaces = (t) => (t.match(/\s/g) || []).length < t.length / 12;
  for (const ch of chunks) {
    const text = (ch.text || '').trim(); if (!text) continue;
    const s = ch.timestamp[0] ?? 0, e = ch.timestamp[1] ?? Math.min(total || s + 5, s + 6);
    const units = noSpaces(text) ? [...text] : text.split(/\s+/);
    const joiner = noSpaces(text) ? '' : ' ';
    const maxLine = noSpaces(text) ? 18 : 42;
    const groups = []; let line = '', lines = [];
    for (const u of units) {
      const next = line ? line + joiner + u : u;
      if (next.length > maxLine && line) { lines.push(line); line = u; if (lines.length === 2) { groups.push(lines.join('\n')); lines = []; } }
      else line = next;
    }
    if (line) lines.push(line);
    if (lines.length) groups.push(lines.join('\n'));
    const totalChars = groups.reduce((a, g) => a + g.length, 0) || 1;
    let t = s;
    for (const g of groups) {
      const d = (e - s) * (g.length / totalChars);
      out.push({ start: +t.toFixed(3), end: +(t + d).toFixed(3), text: g });
      t += d;
    }
  }
  // split anything still longer than 6 s, and remove overlaps
  for (let i = 0; i < out.length; i++) if (i && out[i].start < out[i - 1].end) out[i - 1].end = out[i].start;
  return out;
}

/* ---------------------------------------------------------------- cue editor */
function renderCues() {
  els.cues.innerHTML = cues.map((c, i) => `<li class="cue" data-i="${i}">
    <div class="cue-times"><input class="t-input" type="text" value="${fmtTs(c.start)}" data-k="start" aria-label="Start"><span>→</span><input class="t-input" type="text" value="${fmtTs(c.end)}" data-k="end" aria-label="End"></div>
    <textarea class="t-textarea" data-k="text" rows="2" aria-label="Caption text">${escapeHtml(c.text)}</textarea>
    <div class="cue-acts"><button type="button" class="t-icon-btn" data-a="play" title="Play from here">▶</button><button type="button" class="t-icon-btn" data-a="del" title="Delete">✕</button></div></li>`).join('');
  const has = cues.length > 0;
  [els.srt, els.vtt, els.txt].forEach((b) => (b.disabled = !has));
  els.burn.disabled = !has || !file || file.type.startsWith('audio/');
  els.trRun.disabled = !has;
  drawOverlay();
}
const fmtTs = (t) => { const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = t % 60; return `${h ? `${h}:` : ''}${String(m).padStart(h ? 2 : 1, '0')}:${s.toFixed(2).padStart(5, '0')}`; };
const parseTs = (v) => { const p = String(v).replace(',', '.').split(':').map(Number); return p.reduce((a, x) => a * 60 + x, 0); };

els.cues.addEventListener('input', (e) => {
  const li = e.target.closest('.cue'); if (!li) return;
  const c = cues[+li.dataset.i], k = e.target.dataset.k;
  if (k === 'text') c.text = e.target.value; else { const v = parseTs(e.target.value); if (isFinite(v)) c[k] = v; }
  drawOverlay();
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
  cues.push({ start: t, end: t + 2.5, text: 'New caption' }); cues.sort((a, b) => a.start - b.start); renderCues();
});
els.shiftBtn.addEventListener('click', () => { const d = +els.shift.value || 0; cues.forEach((c) => { c.start = Math.max(0, c.start + d); c.end = Math.max(c.start + 0.2, c.end + d); }); renderCues(); });

/* ---------------------------------------------------------------- caption rendering (preview + burn-in) */
const STYLES = {
  classic: { fill: '#ffffff', box: 'rgba(0,0,0,.72)', stroke: null, weight: 600 },
  bold:    { fill: '#ffffff', box: null, stroke: '#000000', weight: 900 },
  yellow:  { fill: '#ffd400', box: null, stroke: '#000000', weight: 800 },
  minimal: { fill: '#ffffff', box: null, stroke: null, weight: 600, shadow: true },
  brand:   { fill: '#ffffff', box: 'rgba(255,77,46,.92)', stroke: null, weight: 800 }
};
export function drawCaption(ctx, W, H, text, opts) {
  if (!text) return;
  const st = STYLES[opts.style] || STYLES.classic;
  const px = Math.round(Math.min(W, H) * (+opts.size / 1000));
  ctx.save();
  ctx.font = `${st.weight} ${px}px Inter, "Segoe UI", "Noto Sans", "Noto Sans Devanagari", "Noto Sans CJK SC", Arial, sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  const lines = text.split('\n'), lh = px * 1.25;
  const blockH = lines.length * lh;
  const cy = opts.pos === 'top' ? H * 0.1 + blockH / 2 : opts.pos === 'middle' ? H / 2 : H * 0.9 - blockH / 2;
  lines.forEach((ln, i) => {
    const y = cy + (i - (lines.length - 1) / 2) * lh, w = ctx.measureText(ln).width;
    if (st.box) { ctx.fillStyle = st.box; const pad = px * 0.35; ctx.beginPath(); const r = px * 0.2, x0 = W / 2 - w / 2 - pad, y0 = y - lh / 2, bw = w + pad * 2;
      ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + bw, y0, x0 + bw, y0 + lh, r); ctx.arcTo(x0 + bw, y0 + lh, x0, y0 + lh, r); ctx.arcTo(x0, y0 + lh, x0, y0, r); ctx.arcTo(x0, y0, x0 + bw, y0, r); ctx.fill(); }
    if (st.stroke) { ctx.lineWidth = px * 0.16; ctx.lineJoin = 'round'; ctx.strokeStyle = st.stroke; ctx.strokeText(ln, W / 2, y); }
    if (st.shadow) { ctx.shadowColor = 'rgba(0,0,0,.85)'; ctx.shadowBlur = px * 0.3; ctx.shadowOffsetY = px * 0.05; }
    ctx.fillStyle = st.fill; ctx.fillText(ln, W / 2, y);
    ctx.shadowColor = 'transparent';
  });
  ctx.restore();
}
const cueAt = (t) => cues.find((c) => t >= c.start && t < c.end);
const opts = () => ({ style: els.style.value, size: els.size.value, pos: els.pos.value });

function sizeOverlay() {
  const r = els.video.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
  els.overlay.width = Math.max(1, Math.round(r.width * dpr)); els.overlay.height = Math.max(1, Math.round(r.height * dpr));
  drawOverlay();
}
function drawOverlay() {
  const c = els.overlay, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height);
  const vw = els.video.videoWidth || 16, vh = els.video.videoHeight || 9;
  // letterbox-aware: caption sits on the video picture, not the black bars
  const s = Math.min(c.width / vw, c.height / vh), w = vw * s, h = vh * s;
  g.save(); g.translate((c.width - w) / 2, (c.height - h) / 2);
  const cue = cueAt(els.video.currentTime);
  if (cue) drawCaption(g, w, h, cue.text, opts());
  g.restore();
}
let raf = 0;
const tick = () => { drawOverlay(); if (!els.video.paused) raf = requestAnimationFrame(tick); };
els.video.addEventListener('play', () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); });
els.video.addEventListener('seeked', drawOverlay);
els.video.addEventListener('timeupdate', () => { if (els.video.paused) drawOverlay(); });
window.addEventListener('resize', sizeOverlay);
new ResizeObserver(sizeOverlay).observe(els.video);
[els.style, els.size, els.pos].forEach((x) => x.addEventListener('input', drawOverlay));

/* ---------------------------------------------------------------- export */
const srtTs = (t) => { const ms = Math.round(t * 1000); const h = Math.floor(ms / 3600000), m = Math.floor(ms / 60000) % 60, s = Math.floor(ms / 1000) % 60; return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms % 1000).padStart(3, '0')}`; };
const base = () => (file ? splitName(file.name)[0] : 'captions');
els.srt.addEventListener('click', () => downloadBlob(new Blob([cues.map((c, i) => `${i + 1}\n${srtTs(c.start)} --> ${srtTs(c.end)}\n${c.text}\n`).join('\n')], { type: 'application/x-subrip;charset=utf-8' }), `${base()}.srt`));
els.vtt.addEventListener('click', () => downloadBlob(new Blob([`WEBVTT\n\n${cues.map((c) => `${srtTs(c.start).replace(',', '.')} --> ${srtTs(c.end).replace(',', '.')}\n${c.text}\n`).join('\n')}`], { type: 'text/vtt;charset=utf-8' }), `${base()}.vtt`));
els.txt.addEventListener('click', () => downloadBlob(new Blob([cues.map((c) => c.text.replace(/\n/g, ' ')).join('\n')], { type: 'text/plain;charset=utf-8' }), `${base()}-transcript.txt`));

/* import existing SRT / VTT to edit, translate or burn in */
els.importIn.addEventListener('change', async () => {
  const f = els.importIn.files[0]; els.importIn.value = ''; if (!f) return;
  const txt = await f.text();
  const blocks = txt.replace(/\r/g, '').split(/\n\n+/);
  const out = [];
  for (const b of blocks) {
    const m = b.match(/(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}\s*-->\s*(\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3}/);
    if (!m) continue;
    const [a, z] = m[0].split('-->').map((x) => parseTs(x.trim()));
    const text = b.slice(b.indexOf(m[0]) + m[0].length).replace(/^[^\n]*\n/, '').replace(/<[^>]+>/g, '').trim();
    if (text) out.push({ start: a, end: z, text });
  }
  if (!out.length) { setStatus(els.status, 'No captions found in that file.', 'err'); return; }
  cues = out; renderCues(); els.editor.hidden = false;
  setStatus(els.status, `Imported ${out.length} captions from ${f.name}.`, 'ok');
});

/* burn captions into the video (re-encodes video, copies audio) */
els.burn.addEventListener('click', async () => {
  if (!file || !cues.length) return;
  els.burn.disabled = true; els.bar.hidden = false; els.fill.style.width = '0%';
  try {
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
        const cue = cueAt(sample.timestamp - first);
        if (cue) drawCaption(g, W, H, cue.text, o);
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
    cues.forEach((c) => { if (c.orig == null) c.orig = c.text; });
    for (let i = 0; i < cues.length; i++) {
      cues[i].text = (await tr.translate(cues[i].orig.replace(/\n/g, ' '))).trim();
      if (i % 5 === 0) setStatus(els.status, `Translating ${i + 1} of ${cues.length}…`);
    }
    // re-wrap translated lines
    cues.forEach((c) => { c.text = buildCues([{ timestamp: [c.start, c.end], text: c.text }], c.end)[0]?.text || c.text; });
    renderCues(); els.trUndo.hidden = false;
    setStatus(els.status, `Captions translated to ${LANGS.find((l) => l[0] === tgt)?.[1] || tgt}.`, 'ok');
  } catch (e) { setStatus(els.status, e.message, 'err'); }
  els.trRun.disabled = false;
});
els.trUndo.addEventListener('click', () => { cues.forEach((c) => { if (c.orig != null) { c.text = c.orig; delete c.orig; } }); els.trUndo.hidden = true; renderCues(); });

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(video|audio)\//.test(x.type) || /\.(mp4|mov|webm|mkv|m4a|mp3|wav|ogg|flac|aac)$/i.test(x.name));
  if (f) openMedia(f); else setStatus(els.status, 'Please choose a video or audio file.', 'err');
});
window.__capTest = { setCues: (c) => { cues = c; renderCues(); }, buildCues };
