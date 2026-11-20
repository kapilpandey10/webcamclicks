/* WebcamClicks — Screen recorder with optional webcam bubble and microphone.
   The webcam bubble is shown in a Picture-in-Picture window that floats above every app,
   so the screen capture records it naturally (no canvas compositing that freezes in
   background tabs). Recording happens locally with MediaRecorder; nothing is uploaded. */

import { $, downloadBlob, formatBytes, setStatus } from './common.js';

const els = {
  start: $('#t-start'), stop: $('#t-stop'), pause: $('#t-pause'), mic: $('#t-mic'), sys: $('#t-sys'), cam: $('#t-cam'),
  quality: $('#t-quality'), timer: $('#t-timer'), status: $('#t-status'), preview: $('#t-preview'), result: $('#t-result'),
  download: $('#t-download'), camVideo: $('#t-camvideo'), unsupported: $('#t-unsupported'), controls: $('#t-controls')
};

const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
if (!supported) { els.unsupported.hidden = false; els.controls.hidden = true; }

let display = null, micStream = null, camStream = null, recorder = null, chunks = [], audioCtx = null;
let t0 = 0, pausedAt = 0, pausedTotal = 0, timerId = 0, lastUrl = null;

function pickMime() {
  const opts = ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'];
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}

const BITRATE = { standard: 2_500_000, high: 6_000_000, max: 12_000_000 };

function fmt(ms) {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

async function start() {
  els.result.hidden = true;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      audio: els.sys.checked,
      selfBrowserSurface: 'include', surfaceSwitching: 'include', systemAudio: 'include'
    });
  } catch (e) {
    setStatus(els.status, e && e.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : `Could not start screen capture (${e && e.name}).`, 'err');
    return;
  }

  if (els.mic.checked) {
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (_) { setStatus(els.status, 'Microphone blocked. Recording without your voice.', 'err'); }
  }
  if (els.cam.checked) {
    try {
      camStream = await navigator.mediaDevices.getUserMedia({ video: { width: 480, height: 480, facingMode: 'user' } });
      els.camVideo.srcObject = camStream;
      await els.camVideo.play();
      if (document.pictureInPictureEnabled) await els.camVideo.requestPictureInPicture().catch(() => {});
    } catch (_) { camStream = null; }
  }

  // mix system + mic audio into one track
  const tracks = [...display.getVideoTracks()];
  const audioIns = [display, micStream].filter((s) => s && s.getAudioTracks().length);
  if (audioIns.length === 1) tracks.push(audioIns[0].getAudioTracks()[0]);
  else if (audioIns.length > 1) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    audioIns.forEach((s) => audioCtx.createMediaStreamSource(s).connect(dest));
    tracks.push(dest.stream.getAudioTracks()[0]);
  }
  const stream = new MediaStream(tracks);
  els.preview.srcObject = display;
  els.preview.muted = true;
  els.preview.play().catch(() => {});

  const mimeType = pickMime();
  try { recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: BITRATE[els.quality.value] || BITRATE.high }); }
  catch (_) { recorder = new MediaRecorder(stream); }
  chunks = [];
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = finish;
  recorder.start(1000);
  display.getVideoTracks()[0].addEventListener('ended', stop);   // user pressed the browser's "Stop sharing"

  t0 = performance.now(); pausedTotal = 0; pausedAt = 0;
  timerId = setInterval(() => { els.timer.textContent = fmt(performance.now() - t0 - pausedTotal - (pausedAt ? performance.now() - pausedAt : 0)); }, 250);
  els.start.hidden = true; els.stop.hidden = false; els.pause.hidden = false; els.pause.textContent = 'Pause';
  document.body.classList.add('is-recording');
  setStatus(els.status, 'Recording… Switch to any tab or app. Press Stop (or the browser\'s Stop sharing) when you\'re done.');
}

function stop() {
  if (recorder && recorder.state !== 'inactive') recorder.stop();
}

function cleanup() {
  [display, micStream, camStream].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
  display = micStream = camStream = null;
  if (document.pictureInPictureElement) document.exitPictureInPicture().catch(() => {});
  if (audioCtx) { audioCtx.close().catch(() => {}); audioCtx = null; }
  clearInterval(timerId);
  els.start.hidden = false; els.stop.hidden = true; els.pause.hidden = true;
  document.body.classList.remove('is-recording');
}

function finish() {
  const type = (recorder && recorder.mimeType) || 'video/webm';
  cleanup();
  if (!chunks.length) { setStatus(els.status, 'Nothing was recorded.', 'err'); return; }
  const blob = new Blob(chunks, { type });
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  els.preview.srcObject = null;
  els.preview.src = lastUrl;
  els.preview.muted = false;
  els.preview.controls = true;
  const ext = type.includes('mp4') ? 'mp4' : 'webm';
  const stamp = new Date().toISOString().slice(0, 16).replace(/[T:]/g, '-');
  els.download.onclick = () => downloadBlob(blob, `screen-recording-${stamp}.${ext}`);
  els.result.hidden = false;
  setStatus(els.status, `Recording ready: ${els.timer.textContent} · ${formatBytes(blob.size)} · ${ext.toUpperCase()}`, 'ok');
}

els.start.addEventListener('click', start);
els.stop.addEventListener('click', stop);
els.pause.addEventListener('click', () => {
  if (!recorder) return;
  if (recorder.state === 'recording') { recorder.pause(); pausedAt = performance.now(); els.pause.textContent = 'Resume'; setStatus(els.status, 'Paused.'); }
  else if (recorder.state === 'paused') { recorder.resume(); pausedTotal += performance.now() - pausedAt; pausedAt = 0; els.pause.textContent = 'Pause'; setStatus(els.status, 'Recording…'); }
});
window.addEventListener('beforeunload', (e) => { if (recorder && recorder.state !== 'inactive') { e.preventDefault(); e.returnValue = ''; } });
