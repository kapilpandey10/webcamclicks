/* WebcamClicks — Crop, rotate & resize video: draw a crop box (9:16, 1:1, 16:9…), rotate, flip, pick a size, export MP4.
   mediabunny + WebCodecs on the device; audio is kept. */

import { $, $$, setupDropzone, setStatus, downloadBlob, loadMediabunny, formatBytes, splitName, fmtTime } from './common.js';
import { CropBox, ASPECTS } from './crop-box.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), stage: $('#vc-stage'), canvas: $('#vc-canvas'), video: $('#vc-video'), work: $('#vc-work'),
  play: $('#vc-play'), seek: $('#vc-seek'), time: $('#vc-time'), aspects: $('#vc-aspects'), rotL: $('#vc-rotl'), rotR: $('#vc-rotr'), flip: $('#vc-flip'),
  size: $('#vc-size'), quality: $('#vc-quality'), mute: $('#vc-mute'), run: $('#vc-run'), bar: $('#vc-bar'), fill: $('#vc-fill'), info: $('#vc-info'), out: $('#vc-out')
};
let file = null, rot = 0, flip = false, aspect = '9:16', duration = 0;
const cb = new CropBox(els.stage, { onChange: () => outInfo() });

els.aspects.innerHTML = ASPECTS.map(([n]) => `<button type="button" data-a="${n}" aria-pressed="${n === aspect}">${n === '9:16' ? '9:16 TikTok/Reels' : n === '1:1' ? '1:1 Square' : n === '16:9' ? '16:9 YouTube' : n === '4:5' ? '4:5 Feed' : n}</button>`).join('');
els.aspects.addEventListener('click', (e) => {
  const b = e.target.closest('[data-a]'); if (!b) return;
  aspect = b.dataset.a; $$('[data-a]', els.aspects).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  cb.setAspect((ASPECTS.find(([n]) => n === aspect) || [])[1]);
});

/* ---------------------------------------------------------------- preview: the frame with rotation & flip */
const v = els.video;
const dims = () => (rot % 180 ? [v.videoHeight, v.videoWidth] : [v.videoWidth, v.videoHeight]);
function draw() {
  if (!v.videoWidth) return;
  const [W, H] = dims(), k = Math.min(1, 1280 / Math.max(W, H)), c = els.canvas;
  const cw = Math.round(W * k), ch = Math.round(H * k);
  if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
  const g = c.getContext('2d');
  g.save(); g.translate(cw / 2, ch / 2); if (flip) g.scale(-1, 1); g.rotate((rot * Math.PI) / 180);   // rotate, then mirror (as the encoder does)
  const vw = v.videoWidth * k, vh = v.videoHeight * k; g.drawImage(v, -vw / 2, -vh / 2, vw, vh); g.restore();
  els.time.textContent = `${fmtTime(v.currentTime)} / ${fmtTime(duration)}`;
  if (!els.seek.matches(':active')) els.seek.value = duration ? (v.currentTime / duration) * 1000 : 0;
}
const loop = () => { draw(); if (!v.paused) (v.requestVideoFrameCallback ? v.requestVideoFrameCallback(loop) : requestAnimationFrame(loop)); };
v.addEventListener('play', () => { els.play.textContent = '❚❚'; loop(); });
v.addEventListener('pause', () => { els.play.textContent = '▶'; });
v.addEventListener('seeked', draw);
els.play.addEventListener('click', () => (v.paused ? v.play() : v.pause()));
els.seek.addEventListener('input', () => { v.currentTime = (els.seek.value / 1000) * duration; });

async function open(files) {
  const f = files.find((x) => /^video\//.test(x.type) || /\.(mp4|mov|m4v|webm|mkv)$/i.test(x.name));
  if (!f) { setStatus(els.status, 'Please choose a video file.', 'err'); return; }
  file = f; rot = 0; flip = false;
  if (v.src) URL.revokeObjectURL(v.src);
  v.src = URL.createObjectURL(f); v.muted = true;
  await new Promise((r) => { v.onloadeddata = r; v.onerror = r; });
  if (!v.videoWidth) { setStatus(els.status, 'This video can\'t be played in your browser.', 'err'); return; }
  duration = v.duration || 0;
  els.work.hidden = false; els.drop.classList.add('compact'); els.run.disabled = false;
  draw(); cb.setSource(...dims()); cb.setAspect((ASPECTS.find(([n]) => n === aspect) || [])[1]);
  els.info.textContent = `${f.name} · ${v.videoWidth} × ${v.videoHeight} · ${fmtTime(duration)} · ${formatBytes(f.size)}`;
  setStatus(els.status, 'Move and resize the box to choose what stays in the picture.', 'ok');
}
setupDropzone(els.drop, els.input, open);
function retransform(keep) { draw(); cb.setSource(...dims(), keep); }
els.rotL.addEventListener('click', () => { rot = (rot + 270) % 360; retransform(false); });
els.rotR.addEventListener('click', () => { rot = (rot + 90) % 360; retransform(false); });
els.flip.addEventListener('click', () => { flip = !flip; retransform(true); });

/** Output size for the crop: the chosen height class, never upscaled; even numbers. */
function outSize(r) {
  const target = +els.size.value, short = Math.min(r.w, r.h);
  const k = target && short > target ? target / short : 1;
  return [Math.max(2, Math.round((r.w * k) / 2) * 2), Math.max(2, Math.round((r.h * k) / 2) * 2)];
}
function outInfo() { if (!file) return; const r = cb.rounded(true), [w, h] = outSize(r); els.out.textContent = `Output: ${w} × ${h}`; }
els.size.addEventListener('change', outInfo);

els.run.addEventListener('click', async () => {
  if (!file) return;
  els.run.disabled = true; v.pause();
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
    const r = cb.rounded(true), [W, H] = outSize(r);
    const codec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
    if (!codec) throw new Error('Your browser has no suitable video encoder.');
    const Q = { high: MB.QUALITY_HIGH, medium: MB.QUALITY_MEDIUM, low: MB.QUALITY_LOW }[els.quality.value];
    const output = new MB.Output({ format: codec === 'avc' ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(), target: new MB.BufferTarget() });
    const whole = r.x === 0 && r.y === 0 && r.w >= dims()[0] - 1 && r.h >= dims()[1] - 1;
    const conv = await MB.Conversion.init({
      input, output, showWarnings: false,
      video: { rotate: rot, flip, ...(whole ? {} : { crop: { left: r.x, top: r.y, width: r.w, height: r.h } }), width: W, height: H, fit: 'fill', codec, bitrate: Q, forceTranscode: true, allowTransformationMetadata: false },
      audio: els.mute.checked ? { discard: true } : {}
    });
    if (!conv.isValid) throw new Error('This video can\'t be converted in your browser.');
    const t0 = performance.now();
    conv.onProgress = (p) => { els.bar.hidden = false; els.fill.style.width = `${Math.round(p * 100)}%`; setStatus(els.status, `Creating your video… ${Math.round(p * 100)}%`); };
    await conv.execute();
    const ext = codec === 'avc' ? 'mp4' : 'webm';
    const blob = new Blob([output.target.buffer], { type: `video/${ext}` });
    downloadBlob(blob, `${splitName(file.name)[0]}-${aspect.replace(':', 'x').toLowerCase()}.${ext}`);
    setStatus(els.status, `Done in ${((performance.now() - t0) / 1000).toFixed(1)} s: ${W} × ${H}, ${formatBytes(blob.size)}. Your video is downloading.`, 'ok');
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Something went wrong.', 'err'); }
  els.bar.hidden = true; els.run.disabled = false;
});
window.__vcTest = { cb, get state() { return { rot, flip, aspect }; } };
