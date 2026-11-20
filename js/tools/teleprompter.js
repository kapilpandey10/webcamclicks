/* WebcamClicks — Online teleprompter with webcam recording (all local). */

import { $, downloadBlob, setStatus, formatBytes, fmtTime } from './common.js';

const els = {
  stage: $('#tp-stage'), video: $('#tp-video'), scroller: $('#tp-scroller'), text: $('#tp-text'), script: $('#tp-script'),
  start: $('#tp-start'), camBtn: $('#tp-cam'), rec: $('#tp-rec'), stop: $('#tp-stopbtn'), speed: $('#tp-speed'), speedVal: $('#tp-speed-val'),
  size: $('#tp-size'), mirror: $('#tp-mirror'), mirrorCam: $('#tp-mirrorcam'), band: $('#tp-band'), opacity: $('#tp-opacity'),
  cd: $('#tp-cd'), status: $('#t-status'), timer: $('#tp-timer'), result: $('#tp-result'), playback: $('#tp-playback'), dl: $('#tp-dl'),
  full: $('#tp-full'), reset: $('#tp-reset'), wpmInfo: $('#tp-wpm'), quality: $('#tp-quality'), align: $('#tp-align')
};
const KEY = 'wc_teleprompter_script';

/* ---------------------------------------------------------------- script & look */
try { els.script.value = localStorage.getItem(KEY) || els.script.value; } catch (_) { /* ignore */ }
function syncText() {
  els.text.innerHTML = els.script.value.split(/\n{2,}/).map((p) => `<p>${p.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])).replace(/\n/g, '<br>')}</p>`).join('');
  const words = els.script.value.trim().split(/\s+/).filter(Boolean).length;
  els.wpmInfo.textContent = `${words} words · about ${fmtTime(words / (+els.speed.value || 140) * 60)} at this speed`;
  try { localStorage.setItem(KEY, els.script.value); } catch (_) { /* ignore */ }
}
function syncLook() {
  els.text.style.fontSize = `min(${els.size.value}px, ${(els.size.value * 0.2).toFixed(2)}cqw)`;   // shrinks on narrow (phone) stages
  els.text.style.textAlign = els.align.value;
  els.scroller.classList.toggle('mirrored', els.mirror.checked);
  els.video.classList.toggle('mirrored', els.mirrorCam.checked);
  els.stage.style.setProperty('--band', `${els.band.value}%`);
  els.stage.style.setProperty('--shade', String(+els.opacity.value / 100));
  els.speedVal.textContent = `${els.speed.value} wpm`;
  syncText();
}
['input', 'change'].forEach((ev) => [els.size, els.mirror, els.mirrorCam, els.band, els.opacity, els.speed, els.align].forEach((c) => c.addEventListener(ev, syncLook)));
els.script.addEventListener('input', syncText);

/* ---------------------------------------------------------------- scrolling */
let scrolling = false, raf = 0, last = 0, pos = 0;
function pxPerSecond() {
  // convert words-per-minute into pixels: measure average words per line height
  const words = Math.max(1, els.script.value.trim().split(/\s+/).length);
  const h = els.text.scrollHeight;
  return (h / words) * (+els.speed.value / 60);
}
function step(t) {
  if (!scrolling) return;
  const dt = last ? (t - last) / 1000 : 0; last = t;
  pos += pxPerSecond() * dt;
  const max = els.text.scrollHeight - els.scroller.clientHeight * 0.35;
  if (pos >= max) { pos = max; pause(); setStatus(els.status, 'End of script.'); }
  els.text.style.transform = `translateY(${-pos}px)`;
  raf = requestAnimationFrame(step);
}
function play() { if (scrolling) return; scrolling = true; last = 0; raf = requestAnimationFrame(step); els.start.textContent = '❚❚ Pause'; }
function pause() { scrolling = false; cancelAnimationFrame(raf); els.start.textContent = '▶ Scroll'; }
function resetScroll() { pause(); pos = 0; els.text.style.transform = 'translateY(0)'; }
els.start.addEventListener('click', () => (scrolling ? pause() : play()));
els.reset.addEventListener('click', resetScroll);
els.stage.addEventListener('wheel', (e) => { e.preventDefault(); pos = Math.max(0, pos + e.deltaY * 0.6); els.text.style.transform = `translateY(${-pos}px)`; }, { passive: false });
document.addEventListener('keydown', (e) => {
  if (/INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if (e.key === ' ') { e.preventDefault(); scrolling ? pause() : play(); }
  if (e.key === 'ArrowUp') { e.preventDefault(); els.speed.value = Math.min(+els.speed.max, +els.speed.value + 10); syncLook(); }
  if (e.key === 'ArrowDown') { e.preventDefault(); els.speed.value = Math.max(+els.speed.min, +els.speed.value - 10); syncLook(); }
  if (e.key === 'Home') resetScroll();
});
els.full.addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else els.stage.requestFullscreen && els.stage.requestFullscreen(); });

/* ---------------------------------------------------------------- camera & recording */
let stream = null, rec = null, chunks = [], t0 = 0, timer = 0, lastUrl = null;
const QUALITY = { '720': [1280, 720, 4_000_000], '1080': [1920, 1080, 8_000_000] };

async function startCam() {
  if (stream) return true;
  const [w, h] = QUALITY[els.quality.value];
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: w }, height: { ideal: h }, facingMode: 'user' }, audio: { echoCancellation: true, noiseSuppression: true } });
  } catch (e) { setStatus(els.status, e.name === 'NotAllowedError' ? 'Camera or microphone permission was blocked.' : 'No camera found.', 'err'); return false; }
  els.video.srcObject = stream; await els.video.play().catch(() => {});
  els.stage.classList.add('live'); els.camBtn.textContent = '✕ Camera off'; els.rec.disabled = false;
  return true;
}
function stopCam() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; els.video.srcObject = null; els.stage.classList.remove('live'); els.camBtn.textContent = '📷 Camera on'; els.rec.disabled = true; }
els.camBtn.addEventListener('click', () => (stream ? stopCam() : startCam()));
els.quality.addEventListener('change', () => { if (stream && !rec) { stopCam(); startCam(); } });

function pickMime() {
  return ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

els.rec.addEventListener('click', async () => {
  if (!(await startCam())) return;
  els.result.hidden = true; resetScroll();
  els.rec.disabled = true;
  for (let n = 3; n > 0; n--) { els.cd.hidden = false; els.cd.textContent = n; await new Promise((r) => setTimeout(r, 1000)); }
  els.cd.hidden = true;
  chunks = [];
  try { rec = new MediaRecorder(stream, { mimeType: pickMime(), videoBitsPerSecond: QUALITY[els.quality.value][2] }); }
  catch (_) { rec = new MediaRecorder(stream); }
  rec.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  rec.onstop = finish;
  rec.start(1000);
  t0 = performance.now();
  timer = setInterval(() => { els.timer.textContent = `● ${fmtTime((performance.now() - t0) / 1000)}`; }, 250);
  els.timer.hidden = false; els.stop.hidden = false; els.rec.hidden = true;
  play();
  setStatus(els.status, 'Recording. Read naturally; Space pauses the text, ↑ ↓ change the speed.');
});
els.stop.addEventListener('click', () => { if (rec && rec.state !== 'inactive') rec.stop(); });

function finish() {
  clearInterval(timer); pause();
  els.timer.hidden = true; els.stop.hidden = true; els.rec.hidden = false; els.rec.disabled = false;
  const type = (rec && rec.mimeType) || 'video/webm'; rec = null;
  const blob = new Blob(chunks, { type });
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  els.playback.src = lastUrl; els.result.hidden = false;
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  els.dl.onclick = () => downloadBlob(blob, `teleprompter-recording-${new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-')}.${ext}`);
  setStatus(els.status, `Recording ready: ${fmtTime((performance.now() - t0) / 1000)} · ${formatBytes(blob.size)} · ${ext.toUpperCase()}. Want captions? Open it in the auto-caption tool.`, 'ok');
  els.result.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
window.addEventListener('beforeunload', (e) => { if (rec) { e.preventDefault(); e.returnValue = ''; } });
syncLook();
