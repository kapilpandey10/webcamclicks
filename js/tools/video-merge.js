/* WebcamClicks — Merge videos: join clips (any size or format) into one MP4, in the order you choose.
   Each frame is fitted onto one canvas size; audio is resampled to 48 kHz stereo and joined. All on the device. */

import { $, setupDropzone, setStatus, downloadBlob, loadMediabunny, formatBytes, fmtTime, escapeHtml } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), list: $('#vm-list'), work: $('#vm-work'), total: $('#vm-total'),
  size: $('#vm-size'), fit: $('#vm-fit'), bg: $('#vm-bg'), fade: $('#vm-fade'), quality: $('#vm-quality'), run: $('#vm-run'), bar: $('#vm-bar'), fill: $('#vm-fill'),
  result: $('#vm-result'), resultVideo: $('#vm-result-video'), resultInfo: $('#vm-result-info'), dl: $('#vm-dl')
};
let clips = [];   // { id, file, dur, w, h, audio, thumb }
let nextId = 1;

async function add(files) {
  const vids = files.filter((f) => /^video\//.test(f.type) || /\.(mp4|mov|m4v|webm|mkv)$/i.test(f.name));
  if (!vids.length) { setStatus(els.status, 'Please add video files.', 'err'); return; }
  const MB = await loadMediabunny();
  for (const f of vids) {
    setStatus(els.status, `Reading ${f.name}…`);
    try {
      const input = new MB.Input({ source: new MB.BlobSource(f), formats: MB.ALL_FORMATS });
      const vt = await input.getPrimaryVideoTrack(); if (!vt) throw new Error('no video');
      const c = { id: nextId++, file: f, dur: await input.computeDuration(), w: vt.displayWidth, h: vt.displayHeight, audio: !!(await input.getPrimaryAudioTrack()) };
      try {   // thumbnail from 1 s in
        const first = await vt.getFirstTimestamp().catch(() => 0);
        const sample = await new MB.VideoSampleSink(vt).getSample(first + Math.min(1, c.dur / 3));
        if (sample) { const cv = document.createElement('canvas'), k = 160 / Math.max(c.w, c.h); cv.width = Math.round(c.w * k); cv.height = Math.round(c.h * k); sample.draw(cv.getContext('2d'), 0, 0, cv.width, cv.height); sample.close(); c.thumb = cv.toDataURL('image/jpeg', 0.7); }
      } catch (_) { /* no thumbnail */ }
      clips.push(c);
    } catch (_) { setStatus(els.status, `${f.name} can't be read in your browser.`, 'err'); }
  }
  render();
  if (clips.length) setStatus(els.status, clips.length > 1 ? 'Put the clips in order, choose the size, then merge.' : 'Add at least one more clip to merge.', clips.length > 1 ? 'ok' : '');
}
setupDropzone(els.drop, els.input, add);

function render() {
  els.work.hidden = !clips.length; els.drop.classList.toggle('compact', clips.length > 0);
  els.list.innerHTML = clips.map((c, i) => `<li class="vm-clip" data-id="${c.id}" draggable="true">
    <span class="vm-num">${i + 1}</span>${c.thumb ? `<img src="${c.thumb}" alt="">` : '<span class="vm-nothumb">🎬</span>'}
    <div class="vm-meta"><b title="${escapeHtml(c.file.name)}">${escapeHtml(c.file.name)}</b><small>${fmtTime(c.dur)} · ${c.w}×${c.h}${c.audio ? '' : ' · no sound'} · ${formatBytes(c.file.size)}</small></div>
    <div class="vm-ctrl"><button type="button" class="t-icon-btn" data-a="up" aria-label="Move up" ${i ? '' : 'disabled'}>↑</button><button type="button" class="t-icon-btn" data-a="down" aria-label="Move down" ${i < clips.length - 1 ? '' : 'disabled'}>↓</button><button type="button" class="t-icon-btn" data-a="rm" aria-label="Remove">✕</button></div></li>`).join('');
  const total = clips.reduce((a, c) => a + c.dur, 0);
  els.total.textContent = clips.length ? `${clips.length} clip${clips.length > 1 ? 's' : ''} · ${fmtTime(total)} in total` : '';
  els.run.disabled = clips.length < 2;
  const first = clips[0];
  const o = els.size.querySelector('option[value="first"]'); if (o) o.textContent = first ? `Same as clip 1 (${first.w}×${first.h})` : 'Same as clip 1';
}
els.list.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  const i = clips.findIndex((c) => c.id === +b.closest('[data-id]').dataset.id);
  if (b.dataset.a === 'rm') clips.splice(i, 1);
  else { const j = i + (b.dataset.a === 'up' ? -1 : 1); [clips[i], clips[j]] = [clips[j], clips[i]]; }
  render();
});
// drag to reorder (desktop)
let dragId = null;
els.list.addEventListener('dragstart', (e) => { const li = e.target.closest('[data-id]'); if (!li) return; dragId = +li.dataset.id; li.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
els.list.addEventListener('dragover', (e) => { if (dragId == null) return; e.preventDefault(); const li = e.target.closest('[data-id]'); els.list.querySelectorAll('.over').forEach((x) => x.classList.remove('over')); if (li && +li.dataset.id !== dragId) li.classList.add('over'); });
els.list.addEventListener('drop', (e) => {
  e.preventDefault(); const li = e.target.closest('[data-id]'); if (dragId == null || !li) return;
  const from = clips.findIndex((c) => c.id === dragId), to = clips.findIndex((c) => c.id === +li.dataset.id);
  const [c] = clips.splice(from, 1); clips.splice(to, 0, c); dragId = null; render();
});
els.list.addEventListener('dragend', () => { dragId = null; render(); });

/* ---------------------------------------------------------------- merge */
function outSize() {
  const v = els.size.value, f = clips[0];
  const [w, h] = v === 'first' ? [f.w, f.h] : v.split('x').map(Number);
  const k = Math.min(1, 1920 / Math.max(w, h));   // at most 1920 px on the long side
  return [Math.round((w * k) / 2) * 2, Math.round((h * k) / 2) * 2];
}
const SR = 48000;
/** One clip's sound as 48 kHz stereo (silence if it has none). */
async function clipAudio(MB, input, dur) {
  const len = Math.max(1, Math.round(dur * SR));
  const ctx = new OfflineAudioContext(2, len, SR);
  const at = await input.getPrimaryAudioTrack();
  if (at) {
    const first = await at.getFirstTimestamp().catch(() => 0);
    for await (const wb of new MB.AudioBufferSink(at).buffers()) {
      const src = ctx.createBufferSource(); src.buffer = wb.buffer; src.connect(ctx.destination);
      const t = wb.timestamp - first; if (t < dur) src.start(Math.max(0, t), Math.max(0, -t));
    }
  }
  return ctx.startRendering();
}
els.run.addEventListener('click', async () => {
  if (clips.length < 2) return;
  els.run.disabled = true; els.result.hidden = true;
  const t0 = performance.now();
  try {
    const MB = await loadMediabunny();
    const [W, H] = outSize();
    const vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
    if (!vcodec) throw new Error('Your browser has no suitable video encoder.');
    const mp4 = vcodec === 'avc';
    const acodec = await MB.getFirstEncodableAudioCodec(mp4 ? ['aac', 'opus'] : ['opus', 'vorbis']);
    const output = new MB.Output({ format: mp4 ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const canvas = new OffscreenCanvas(W, H), g = canvas.getContext('2d');
    const Q = { high: MB.QUALITY_HIGH, medium: MB.QUALITY_MEDIUM, low: MB.QUALITY_LOW }[els.quality.value];
    const vsrc = new MB.CanvasSource(canvas, { codec: vcodec, bitrate: Q, keyFrameInterval: 2 });
    output.addVideoTrack(vsrc, { frameRate: 30 });
    const asrc = acodec ? new MB.AudioBufferSource({ codec: acodec, bitrate: 160_000 }) : null;
    if (asrc) output.addAudioTrack(asrc);
    await output.start();
    const total = clips.reduce((a, c) => a + c.dur, 0), fade = els.fade.checked ? 0.35 : 0;
    let offset = 0;
    for (let ci = 0; ci < clips.length; ci++) {
      const c = clips[ci];
      const input = new MB.Input({ source: new MB.BlobSource(c.file), formats: MB.ALL_FORMATS });
      const vt = await input.getPrimaryVideoTrack();
      const first = await vt.getFirstTimestamp().catch(() => 0);
      const fit = els.fit.value;
      const s = fit === 'cover' ? Math.max(W / c.w, H / c.h) : Math.min(W / c.w, H / c.h), dw = c.w * s, dh = c.h * s;
      // video: every frame of the clip, placed at its time in the merged video
      for await (const sm of new MB.VideoSampleSink(vt).samples()) {
        const t = sm.timestamp - first;
        if (t >= c.dur) { sm.close(); break; }
        g.fillStyle = els.bg.value; g.fillRect(0, 0, W, H);
        sm.draw(g, (W - dw) / 2, (H - dh) / 2, dw, dh);
        const dur = Math.max(1 / 120, Math.min(sm.duration || 1 / 30, c.dur - t));
        sm.close();
        if (fade) {   // dip to black between clips
          const a = Math.max(ci > 0 ? 1 - t / fade : 0, ci < clips.length - 1 ? 1 - (c.dur - t) / fade : 0);
          if (a > 0) { g.fillStyle = `rgba(0,0,0,${Math.min(1, a)})`; g.fillRect(0, 0, W, H); }
        }
        await vsrc.add(offset + Math.max(0, t), dur);
        const p = (offset + t) / total; els.bar.hidden = false; els.fill.style.width = `${Math.round(p * 100)}%`;
        setStatus(els.status, `Merging clip ${ci + 1} of ${clips.length}… ${Math.round(p * 100)}%`);
      }
      // audio: the whole clip at 48 kHz stereo, faded at the joins
      if (asrc) {
        const buf = await clipAudio(MB, input, c.dur);
        if (fade) for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch), n = Math.round(fade * SR); for (let i = 0; i < n && i < d.length; i++) { const k = i / n; if (ci > 0) d[i] *= k; if (ci < clips.length - 1) d[d.length - 1 - i] *= k; } }
        await asrc.add(buf);
      }
      offset += c.dur;
    }
    await output.finalize();
    const blob = new Blob([output.target.buffer], { type: mp4 ? 'video/mp4' : 'video/webm' });
    const url = URL.createObjectURL(blob);
    els.resultVideo.src = url; els.result.hidden = false;
    els.resultInfo.textContent = `merged.${mp4 ? 'mp4' : 'webm'} · ${W}×${H} · ${fmtTime(total)} · ${formatBytes(blob.size)} · made in ${((performance.now() - t0) / 1000).toFixed(1)} s`;
    els.dl.onclick = () => downloadBlob(blob, `merged-video.${mp4 ? 'mp4' : 'webm'}`);
    setStatus(els.status, 'Done! Play it below, then download.', 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Merging failed.', 'err'); }
  els.bar.hidden = true; els.run.disabled = clips.length < 2;
});
window.__vmTest = { get clips() { return clips; } };
