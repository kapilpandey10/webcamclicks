/* WebcamClicks — video & audio converters (MP4→MP3/WAV/M4A/FLAC, compressor, trimmer, GIF maker).
   One engine, four pages (main[data-mode] = mp3 | compress | trim | gif). Uses mediabunny + WebCodecs;
   nothing is uploaded. */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadMediabunny, loadEsm, formatBytes, fmtTime } from './common.js';

const MODE = document.querySelector('main').dataset.mode;
const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), video: $('#vt-video'), work: $('#vt-work'), info: $('#vt-info'),
  start: $('#vt-start'), end: $('#vt-end'), setStart: $('#vt-set-start'), setEnd: $('#vt-set-end'), run: $('#vt-run'),
  bar: $('#vt-bar'), fill: $('#vt-fill'), result: $('#vt-result'), resultInfo: $('#vt-result-info'), dl: $('#vt-dl'), gifPreview: $('#vt-gif'),
  format: $('#vt-format'), bitrate: $('#vt-bitrate'), res: $('#vt-res'), quality: $('#vt-quality'), mute: $('#vt-mute'),
  precise: $('#vt-precise'), fps: $('#vt-fps'), width: $('#vt-width'), range: $('#vt-range')
};
let file = null, duration = 0, lastUrl = null;

/* ---------------------------------------------------------------- load */
async function open(f) {
  file = f;
  if (els.video.src) URL.revokeObjectURL(els.video.src);
  els.video.src = URL.createObjectURL(f);
  els.video.classList.toggle('audio-only', f.type.startsWith('audio/'));
  els.result.hidden = true;
  setStatus(els.status, 'Reading file…');
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
    duration = await input.computeDuration();
    const vt = await input.getPrimaryVideoTrack(), at = await input.getPrimaryAudioTrack();
    els.info.textContent = `${f.name} · ${formatBytes(f.size)} · ${fmtTime(duration)}${vt ? ` · ${vt.displayWidth}×${vt.displayHeight}` : ''}${at ? ' · with audio' : ' · no audio'}`;
    if (MODE === 'mp3' && !at) throw new Error('This file has no audio track.');
    if ((MODE === 'compress' || MODE === 'gif' || MODE === 'trim') && !vt && MODE !== 'trim') throw new Error('This file has no video.');
  } catch (e) { setStatus(els.status, e.message || 'This file could not be read.', 'err'); els.run.disabled = true; return; }
  els.work.hidden = false;
  els.start.value = '0'; els.end.value = (MODE === 'gif' ? Math.min(duration, 5) : duration).toFixed(2);
  syncRange();
  els.run.disabled = false;
  setStatus(els.status, MODE === 'gif' ? 'Pick up to 20 seconds, then create the GIF.' : 'Ready.');
}

function syncRange() {
  const s = Math.max(0, +els.start.value || 0), e = Math.min(duration, +els.end.value || duration);
  if (els.range) els.range.textContent = `${fmtTime(s)} → ${fmtTime(e)} (${(e - s).toFixed(1)} s)`;
}
[els.start, els.end].forEach((x) => x && x.addEventListener('input', syncRange));
els.setStart && els.setStart.addEventListener('click', () => { els.start.value = els.video.currentTime.toFixed(2); syncRange(); });
els.setEnd && els.setEnd.addEventListener('click', () => { els.end.value = els.video.currentTime.toFixed(2); syncRange(); });

function trimRange() {
  const s = Math.max(0, +els.start.value || 0), e = Math.min(duration, +els.end.value || duration);
  if (e - s < 0.1) throw new Error('The end must be after the start.');
  return s > 0.01 || e < duration - 0.01 ? { start: s, end: e } : undefined;
}

function progress(p, label) { els.bar.hidden = false; els.fill.style.width = `${Math.round(p * 100)}%`; setStatus(els.status, `${label}… ${Math.round(p * 100)}%`); }

function done(blob, name, extra = '') {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  const pct = Math.round((1 - blob.size / file.size) * 100);
  els.resultInfo.textContent = `${name} · ${formatBytes(blob.size)}${MODE === 'compress' ? ` (${pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`})` : ''}${extra}`;
  els.dl.onclick = () => downloadBlob(blob, name);
  els.result.hidden = false;
  if (els.gifPreview) { els.gifPreview.hidden = MODE !== 'gif'; if (MODE === 'gif') els.gifPreview.src = lastUrl; }
  els.bar.hidden = true;
  setStatus(els.status, 'Done.', 'ok');
}

/* ---------------------------------------------------------------- converters */
async function toAudio() {
  const fmt = els.format.value;
  const MB = await loadMediabunny({ mp3: fmt === 'mp3' });
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const map = {
    mp3: [() => new MB.Mp3OutputFormat(), 'mp3', 'audio/mpeg'],
    wav: [() => new MB.WavOutputFormat(), 'pcm-s16', 'audio/wav'],
    m4a: [() => new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), 'aac', 'audio/mp4'],
    ogg: [() => new MB.OggOutputFormat(), 'opus', 'audio/ogg'],
    flac: [() => new MB.FlacOutputFormat(), 'flac', 'audio/flac']
  };
  const [mk, codec, mime] = map[fmt];
  if (fmt !== 'wav' && fmt !== 'mp3' && !(await MB.canEncodeAudio(codec))) throw new Error(`Your browser can't encode ${fmt.toUpperCase()}. Choose MP3 or WAV.`);
  const output = new MB.Output({ format: mk(), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({ input, output, video: { discard: true }, audio: { codec, bitrate: fmt === 'wav' || fmt === 'flac' ? undefined : +els.bitrate.value * 1000, forceTranscode: true }, trim: trimRange(), showWarnings: false });
  if (!conv.isValid) throw new Error('This audio can\'t be converted in your browser.');
  conv.onProgress = (p) => progress(p, 'Extracting audio');
  await conv.execute();
  const ext = fmt === 'm4a' ? 'm4a' : fmt;
  done(new Blob([output.target.buffer], { type: mime }), `${splitName(file.name)[0]}.${ext}`);
}

async function compress() {
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  const target = +els.res.value;
  const scale = target && Math.min(vt.displayWidth, vt.displayHeight) > target ? target / Math.min(vt.displayWidth, vt.displayHeight) : 1;
  const W = Math.round(vt.displayWidth * scale / 2) * 2, H = Math.round(vt.displayHeight * scale / 2) * 2;
  const webm = els.format.value === 'webm';
  const codec = await MB.getFirstEncodableVideoCodec(webm ? ['vp9', 'vp8', 'av1'] : ['avc', 'hevc', 'vp9'], { width: W, height: H });
  if (!codec) throw new Error('Your browser has no suitable video encoder.');
  const Q = { high: MB.QUALITY_HIGH, medium: MB.QUALITY_MEDIUM, low: MB.QUALITY_LOW, tiny: MB.QUALITY_VERY_LOW }[els.quality.value];
  const output = new MB.Output({ format: webm ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
  const conv = await MB.Conversion.init({
    input, output, trim: trimRange(), showWarnings: false,
    video: { width: W, height: H, fit: 'fill', codec, bitrate: Q, forceTranscode: true },   // W×H already keeps the aspect ratio
    audio: els.mute.checked ? { discard: true } : {}   // copy the audio when the container allows; it's a tiny share of the size
  });
  if (!conv.isValid) throw new Error('This video can\'t be converted in your browser.');
  conv.onProgress = (p) => progress(p, 'Compressing');
  const t0 = performance.now();
  await conv.execute();
  done(new Blob([output.target.buffer], { type: webm ? 'video/webm' : 'video/mp4' }), `${splitName(file.name)[0]}-compressed.${webm ? 'webm' : 'mp4'}`, ` · ${W}×${H} · ${((performance.now() - t0) / 1000).toFixed(1)} s`);
}

async function trim() {
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const range = trimRange() || { start: 0, end: duration };
  const fmtIn = await input.getFormat();
  const webm = /webm|matroska/i.test(fmtIn.name || '') || /\.webm$/i.test(file.name);
  const audioOnly = !(await input.getPrimaryVideoTrack());
  const output = new MB.Output({ format: audioOnly ? new MB.Mp4OutputFormat() : webm ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new MB.BufferTarget() });
  // if a re-encode happens (precise mode, or a container that can't be cut losslessly), match the source's
  // bitrate instead of the encoder default so the trimmed clip is never bigger than the original
  const srcBps = (file.size * 8) / Math.max(1, duration);
  const bitrate = Math.max(400_000, Math.min(20_000_000, Math.round(srcBps * 1.15)));
  const conv = await MB.Conversion.init({ input, output, trim: range, showWarnings: false, video: els.precise.checked ? { forceTranscode: true, bitrate } : webm ? { bitrate } : undefined });   // MP4 fast mode = lossless copy
  if (!conv.isValid) throw new Error('This file can\'t be trimmed in your browser.');
  conv.onProgress = (p) => progress(p, 'Trimming');
  await conv.execute();
  const ext = audioOnly ? 'm4a' : webm ? 'webm' : 'mp4';
  done(new Blob([output.target.buffer], { type: output.format.mimeType }), `${splitName(file.name)[0]}-trimmed.${ext}`, ` · ${(range.end - range.start).toFixed(1)} s`);
}

async function gif() {
  const MB = await loadMediabunny();
  const { GIFEncoder, quantize, applyPalette } = await loadEsm('gifenc');
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const vt = await input.getPrimaryVideoTrack();
  const first = await vt.getFirstTimestamp().catch(() => 0);
  const s = Math.max(0, +els.start.value || 0), e = Math.min(duration, +els.end.value || duration, s + 20);
  const fps = +els.fps.value, W = Math.min(+els.width.value, vt.displayWidth), H = Math.round(W * vt.displayHeight / vt.displayWidth / 2) * 2;
  const times = []; for (let t = s; t < e; t += 1 / fps) times.push(first + t);
  const c = new OffscreenCanvas(W, H), g = c.getContext('2d', { willReadFrequently: true });
  const enc = GIFEncoder();
  let palette = null, i = 0;
  for await (const sm of new MB.VideoSampleSink(vt).samplesAtTimestamps(times)) {
    if (sm) { sm.draw(g, 0, 0, W, H); sm.close(); }
    const { data } = g.getImageData(0, 0, W, H);
    if (!palette || i % 30 === 0) palette = quantize(data, 256, { format: 'rgb565' });   // refresh palette every 30 frames
    enc.writeFrame(applyPalette(data, palette, 'rgb565'), W, H, { palette, delay: Math.round(1000 / fps), repeat: 0 });
    i++;
    if (i % 5 === 0) { progress(i / times.length, 'Creating GIF'); await new Promise((r) => setTimeout(r, 0)); }
  }
  enc.finish();
  done(new Blob([enc.bytes()], { type: 'image/gif' }), `${splitName(file.name)[0]}.gif`, ` · ${W}×${H} · ${times.length} frames`);
}

els.run.addEventListener('click', async () => {
  if (!file) return;
  els.run.disabled = true; els.result.hidden = true;
  try { await ({ mp3: toAudio, compress, trim, gif })[MODE](); }
  catch (e) { console.warn(e); els.bar.hidden = true; setStatus(els.status, e.message || 'Conversion failed.', 'err'); }
  els.run.disabled = false;
});
if (els.format && MODE === 'mp3') {
  els.format.addEventListener('change', () => { els.bitrate.closest('.t-field').hidden = ['wav', 'flac'].includes(els.format.value); });
  // grey out formats this browser can't encode (e.g. AAC on Linux, FLAC in most browsers) instead of failing after a click
  (async () => {
    if (!('AudioEncoder' in window)) return;
    const MB = await loadMediabunny().catch(() => null); if (!MB) return;
    for (const [fmt, codec] of [['m4a', 'aac'], ['ogg', 'opus'], ['flac', 'flac']]) {
      const ok = await MB.canEncodeAudio(codec).catch(() => false);
      const opt = els.format.querySelector(`option[value="${fmt}"]`);
      if (!ok && opt) { opt.disabled = true; opt.textContent += ' · not supported in this browser'; }
    }
  })();
}

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /^(video|audio)\//.test(x.type) || /\.(mp4|mov|m4v|webm|mkv|avi|m4a|mp3|wav|ogg|flac|aac)$/i.test(x.name));
  if (f) open(f); else setStatus(els.status, 'Please choose a video or audio file.', 'err');
});
