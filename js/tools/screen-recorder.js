/* WebcamClicks — Screen recorder + studio editor.
   Record: screen/window/tab + mic/system audio + (separately) webcam. Pointer: always/motion/never.
   Edit:   trim, crop, smart auto-zoom (from on-screen activity) + manual zooms, output aspect,
           background (gradient/solid/blur), padding/radius/shadow, device frame (auto-picked),
           webcam bubble, speed, resolution.
   Export: re-rendered on a canvas in real time with MediaRecorder (MP4 where supported, else WebM).
   Everything stays on the device. */

import { denoise, enhance, normalize, toRate, decodeAudioFile, buildMix } from './sr/audio.js';
import { generateMusic, MUSIC_STYLES } from './sr/music.js';
import { LOOKS, lookFrom, filterString, drawLookOverlay, drawText, textKey, TEXT_STYLES, TEXT_ANIMS, TRANSITIONS, composeTransition } from './sr/fx.js';
import { $, downloadBlob, formatBytes, setStatus } from './common.js';

/* ======================================================================= recording */

const R = {
  start: $('#t-start'), stop: $('#t-stop'), pause: $('#t-pause'), mic: $('#t-mic'), sys: $('#t-sys'), cam: $('#t-cam'),
  cursor: $('#t-cursor-mode'), countdown: $('#t-countdown'), quality: $('#t-quality'), timer: $('#t-timer'),
  status: $('#t-status'), live: $('#t-preview'), unsupported: $('#t-unsupported'), controls: $('#t-controls'),
  recorder: $('#t-rec-panel'), cd: $('#t-cd')
};
const supported = !!(navigator.mediaDevices && navigator.mediaDevices.getDisplayMedia && window.MediaRecorder);
if (!supported) { R.unsupported.hidden = false; R.controls.hidden = true; }

const BITRATE = { standard: 2_500_000, high: 6_000_000, max: 12_000_000 };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

function pickMime(video = true) {
  const opts = video
    ? ['video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm']
    : ['video/webm;codecs=vp9', 'video/webm', 'video/mp4'];
  return opts.find((m) => MediaRecorder.isTypeSupported(m)) || '';
}
const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

let rec = null;   // active recording session

async function startRecording() {
  const cursor = R.cursor.value;
  let display;
  try {
    display = await navigator.mediaDevices.getDisplayMedia({
      video: { frameRate: { ideal: 30 }, width: { ideal: 1920 }, height: { ideal: 1080 }, cursor },
      audio: R.sys.checked,
      selfBrowserSurface: 'exclude', surfaceSwitching: 'include', systemAudio: 'include'
    });
  } catch (e) {
    setStatus(R.status, e && e.name === 'NotAllowedError' ? 'Screen sharing was cancelled.' : `Could not start screen capture (${e && e.name}).`, 'err');
    return;
  }
  const vTrack = display.getVideoTracks()[0];
  const settings = vTrack.getSettings ? vTrack.getSettings() : {};
  let micStream = null, camStream = null;
  if (R.mic.checked) {
    try { micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } }); }
    catch (_) { setStatus(R.status, 'Microphone blocked. Recording without your voice.', 'err'); }
  }
  if (R.cam.checked) {
    try { camStream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 640 }, height: { ideal: 640 }, facingMode: 'user' }, audio: false }); }
    catch (_) { camStream = null; }
  }

  // one mixed audio track
  const tracks = [vTrack];
  const audioIns = [display, micStream].filter((s) => s && s.getAudioTracks().length);
  let audioCtx = null;
  if (audioIns.length === 1) tracks.push(audioIns[0].getAudioTracks()[0]);
  else if (audioIns.length > 1) {
    audioCtx = new AudioContext();
    const dest = audioCtx.createMediaStreamDestination();
    audioIns.forEach((s) => audioCtx.createMediaStreamSource(s).connect(dest));
    tracks.push(dest.stream.getAudioTracks()[0]);
  }

  R.live.srcObject = display; R.live.muted = true; R.live.play().catch(() => {});

  if (R.countdown.checked) {
    R.cd.hidden = false;
    for (let n = 3; n > 0; n--) { R.cd.textContent = n; await sleep(1000); }
    R.cd.hidden = true;
  }

  const mainRec = new MediaRecorder(new MediaStream(tracks), { mimeType: pickMime(true), videoBitsPerSecond: BITRATE[R.quality.value] || BITRATE.high });
  const camRec = camStream ? new MediaRecorder(camStream, { mimeType: pickMime(false), videoBitsPerSecond: 1_500_000 }) : null;
  rec = {
    display, micStream, camStream, audioCtx, mainRec, camRec, mainChunks: [], camChunks: [],
    surface: settings.displaySurface || 'unknown', cursorAsked: cursor, cursorGot: settings.cursor,
    t0: performance.now(), paused: 0, pausedAt: 0, camOffset: 0, timer: 0, stopped: 0
  };
  mainRec.ondataavailable = (e) => { if (e.data.size) rec.mainChunks.push(e.data); };
  if (camRec) camRec.ondataavailable = (e) => { if (e.data.size) rec.camChunks.push(e.data); };
  const done = () => { if (++rec.stopped === (camRec ? 2 : 1)) finishRecording(); };
  mainRec.onstop = done;
  if (camRec) camRec.onstop = done;
  const tMain = performance.now();
  mainRec.start(1000);
  if (camRec) { camRec.start(1000); rec.camOffset = (performance.now() - tMain) / 1000; }
  vTrack.addEventListener('ended', stopRecording);

  rec.timer = setInterval(() => { R.timer.textContent = fmt(elapsed()); }, 250);
  R.start.hidden = true; R.stop.hidden = false; R.pause.hidden = false; R.pause.textContent = 'Pause';
  document.body.classList.add('is-recording');
  let msg = 'Recording… Switch to any tab or app. Press Stop (or the browser\'s “Stop sharing”) when you\'re done.';
  if (cursor !== 'always' && rec.cursorGot && rec.cursorGot !== cursor) msg += ' Note: your browser always records the pointer.';
  setStatus(R.status, msg);
}

const elapsed = () => rec ? (performance.now() - rec.t0 - rec.paused - (rec.pausedAt ? performance.now() - rec.pausedAt : 0)) / 1000 : 0;

function stopRecording() {
  if (!rec) return;
  [rec.mainRec, rec.camRec].forEach((r) => { if (r && r.state !== 'inactive') r.stop(); });
}

function finishRecording() {
  const r = rec;
  clearInterval(r.timer);
  const duration = elapsed();
  [r.display, r.micStream, r.camStream].forEach((s) => s && s.getTracks().forEach((t) => t.stop()));
  if (r.audioCtx) r.audioCtx.close().catch(() => {});
  R.live.srcObject = null;
  R.start.hidden = false; R.stop.hidden = true; R.pause.hidden = true;
  document.body.classList.remove('is-recording');
  rec = null;
  if (!r.mainChunks.length) { setStatus(R.status, 'Nothing was recorded.', 'err'); return; }
  const mainBlob = new Blob(r.mainChunks, { type: r.mainRec.mimeType || 'video/webm' });
  const camBlob = r.camChunks.length ? new Blob(r.camChunks, { type: r.camRec.mimeType || 'video/webm' }) : null;
  setStatus(R.status, `Recorded ${fmt(duration)} (${formatBytes(mainBlob.size)}). Opening the editor…`, 'ok');
  openEditor({ mainBlob, camBlob, duration, surface: r.surface, camOffset: r.camOffset });
}

if (supported) {
  R.start.addEventListener('click', () => {
    startRecording().catch((e) => {
      console.error('[WebcamClicks] screen recorder:', e);
      setStatus(R.status, `Could not start recording: ${e && e.message ? e.message : e}. Try reloading the page (Ctrl/Cmd + Shift + R).`, 'err');
    });
  });
  R.stop.addEventListener('click', stopRecording);
  R.pause.addEventListener('click', () => {
    if (!rec) return;
    const rs = [rec.mainRec, rec.camRec].filter(Boolean);
    if (rec.mainRec.state === 'recording') { rs.forEach((x) => x.pause()); rec.pausedAt = performance.now(); R.pause.textContent = 'Resume'; setStatus(R.status, 'Paused.'); }
    else { rs.forEach((x) => x.resume()); rec.paused += performance.now() - rec.pausedAt; rec.pausedAt = 0; R.pause.textContent = 'Pause'; setStatus(R.status, 'Recording…'); }
  });
}
window.addEventListener('beforeunload', (e) => {
  if (rec || (E && E.dirty)) { e.preventDefault(); e.returnValue = ''; }
});

/* ======================================================================= editor */

const UI = {
  editor: $('#t-editor'), canvas: $('#t-ed-canvas'), stage: $('#t-ed-stage'), cropBox: $('#t-crop-box'),
  play: $('#t-ed-play'), time: $('#t-ed-time'), track: $('#t-ed-track'), trimShade: $('#t-ed-trim'), zoomLane: $('#t-ed-zooms'),
  playhead: $('#t-ed-playhead'), status: $('#t-ed-status'),
  trimIn: $('#t-trim-in'), trimOut: $('#t-trim-out'), setIn: $('#t-set-in'), setOut: $('#t-set-out'),
  cropToggle: $('#t-crop-toggle'), cropAspect: $('#t-crop-aspect'), cropReset: $('#t-crop-reset'),
  autoZoom: $('#t-auto-zoom'), addZoom: $('#t-add-zoom'), zoomPanel: $('#t-zoom-panel'), zoomScale: $('#t-zoom-scale'),
  zoomScaleVal: $('#t-zoom-scale-val'), zoomStart: $('#t-zoom-start'), zoomEnd: $('#t-zoom-end'), zoomDel: $('#t-zoom-del'), zoomCount: $('#t-zoom-count'),
  aspect: $('#t-aspect'), bg: $('#t-bgsel'), bgColor: $('#t-bgcolor'), padding: $('#t-padding'), radius: $('#t-radius'), shadow: $('#t-shadow'),
  frame: $('#t-frame'), camShow: $('#t-cam-show'), camPos: $('#t-cam-pos'), camSize: $('#t-cam-size'), camShape: $('#t-cam-shape'), camWrap: $('#t-cam-settings'),
  speed: $('#t-speed'), res: $('#t-res'), exportBtn: $('#t-export'), exportBar: $('#t-export-bar'), exportFill: $('#t-export-fill'),
  dlRaw: $('#t-dl-raw'), result: $('#t-ed-result'), dlFinal: $('#t-dl-final'), newRec: $('#t-new-rec'),
  sceneLane: $('#t-ed-scenes'), scenePanel: $('#t-scene-panel'), sceneInfo: $('#t-scene-info'), sceneSplit: $('#t-scene-split'),
  sceneDel: $('#t-scene-del'), transStyle: $('#t-trans-style'), transDur: $('#t-trans-dur'), transDurVal: $('#t-trans-dur-val'),
  autoEdit: $('#t-auto-edit'), zoomStrength: $('#t-zoom-strength'), zoomAmount: $('#t-zoom-amount'), introOutro: $('#t-intro-outro'),
  introWrap: $('#t-intro-wrap'), scenesWrap: $('#t-scenes-wrap'),
  clipLane: $('#t-ed-clips'), thumbs: $('#t-ed-thumbs'), waveLane: $('#t-ed-wavelane'), wave: $('#t-ed-wave'), textLane: $('#t-ed-texts'),
  undo: $('#t-undo'), redo: $('#t-redo'), splitBtn: $('#t-split'), clipDel: $('#t-clip-del'), clipInfo: $('#t-clip-info'),
  voiceVol: $('#t-voice-vol'), voiceVolVal: $('#t-voice-vol-val'), voiceMute: $('#t-voice-mute'), clean: $('#t-clean'), cleanStr: $('#t-clean-str'),
  enhance: $('#t-enhance'), audioStatus: $('#t-audio-status'), music: $('#t-music'), musicFile: $('#t-music-file'), musicVol: $('#t-music-vol'),
  musicVolVal: $('#t-music-vol-val'), musicMute: $('#t-music-mute'), duck: $('#t-duck'), fadeIn: $('#t-fade-in'), fadeOut: $('#t-fade-out'),
  look: $('#t-look'), fxB: $('#t-fx-b'), fxC: $('#t-fx-c'), fxS: $('#t-fx-s'), fxW: $('#t-fx-w'), fxV: $('#t-fx-v'), fxReset: $('#t-fx-reset'),
  textAdd: $('#t-text-add'), textPanel: $('#t-text-panel'), textVal: $('#t-text-val'), textSub: $('#t-text-sub'), textSubWrap: $('#t-text-sub-wrap'),
  textStyle: $('#t-text-style'), textPos: $('#t-text-pos'), textAnim: $('#t-text-anim'), textColor: $('#t-text-color'), textStart: $('#t-text-start'),
  textEnd: $('#t-text-end'), textDel: $('#t-text-del')
};

const BGS = {
  brand: ['#ff4d2e', '#ffb36b'], ocean: ['#0ea5e9', '#6366f1'], mint: ['#34d399', '#0ea5e9'], grape: ['#a855f7', '#ec4899'],
  night: ['#0f172a', '#334155'], sand: ['#f5e6c8', '#e7b98c'], paper: ['#f6f7f9', '#e6e7eb']
};

let E = null;   // editor state

/* Frame sources for drawing. Normally the playing <video> elements; during fast export they are
   decoded frames (VideoFrame / canvas) handed in by the encoder loop. */
let SRC = null;
const FX = { filter: 'none', look: null };   // current colour look (set per frame)
const mainSrc = () => (SRC ? SRC.main : E.main);
const camSrc = () => (SRC ? SRC.cam : (E.cam && E.cam.readyState >= 2 ? E.cam : null));
const dimsOf = (s) => [s.videoWidth || s.displayWidth || s.width, s.videoHeight || s.displayHeight || s.height];

function platform() {
  const p = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
  return /mac|iphone|ipad/i.test(p) ? 'mac' : /win/i.test(p) ? 'windows' : 'linux';
}

function autoFrame(surface, vw, vh) {
  if (vh > vw * 1.15) return 'phone';
  const os = platform();
  if (surface === 'browser' || surface === 'window') return os === 'windows' ? 'windows' : 'mac';
  if (surface === 'monitor') return os === 'mac' ? 'laptop' : 'monitor';
  return os === 'windows' ? 'windows' : 'mac';
}

/** MediaRecorder WebM files have no duration; force the browser to compute it. */
function ensureDuration(video, fallback) {
  return new Promise((resolve) => {
    const ok = () => isFinite(video.duration) && video.duration > 0;
    if (ok()) return resolve(video.duration);
    let done = false;
    const finish = () => {
      if (done) return; done = true;
      video.removeEventListener('durationchange', onChange);
      const d = ok() ? video.duration : fallback;
      video.currentTime = 0;
      resolve(d);
    };
    const onChange = () => { if (ok()) finish(); };
    video.addEventListener('durationchange', onChange);
    try { video.currentTime = 1e101; } catch (_) { finish(); }
    setTimeout(finish, 3000);
  });
}

function makeVideo(blob) {
  const v = document.createElement('video');
  v.playsInline = true; v.preload = 'auto'; v.src = URL.createObjectURL(blob); v.crossOrigin = 'anonymous';
  return v;
}
const once = (el, ev) => new Promise((r) => el.addEventListener(ev, r, { once: true }));

async function openEditor({ mainBlob, camBlob, duration, surface, camOffset }) {
  if (E) closeEditor();
  const main = makeVideo(mainBlob);
  main.muted = false;
  await once(main, 'loadedmetadata');
  const dur = await ensureDuration(main, duration);
  if (main.readyState < 2) await Promise.race([once(main, 'loadeddata'), sleep(3000)]);
  let cam = null;
  if (camBlob) { cam = makeVideo(camBlob); cam.muted = true; await once(cam, 'loadedmetadata'); await ensureDuration(cam, duration); }
  const vw = main.videoWidth, vh = main.videoHeight;
  E = {
    main, cam, mainBlob, camBlob, dur, vw, vh, surface, camOffset: camOffset || 0, dirty: true,
    trim: [0, dur], crop: { x: 0, y: 0, w: 1, h: 1 }, cropMode: false,
    zooms: [], sel: null, audio: null, raf: 0, exporting: false, scenes: [], selScene: null, events: null,
    clips: [], selClip: null, texts: [], selText: null, undo: [], redo: [], histNow: '', voice: undefined, hasAudio: true, proc: null, musicData: null
  };
  E.clips = [newClip(0, dur)];
  defaultScenes();
  UI.introWrap.hidden = !cam;
  const note = document.getElementById('t-intro-note'); if (note) note.hidden = !cam;
  UI.scenesWrap.hidden = !cam;
  UI.frame.value = autoFrame(surface, vw, vh);
  UI.aspect.value = vh > vw * 1.15 ? '9:16' : 'auto';
  UI.camWrap.hidden = !cam;
  UI.camShow.checked = !!cam;
  UI.trimIn.max = UI.trimOut.max = dur.toFixed(1);
  UI.trimIn.value = 0; UI.trimOut.value = dur.toFixed(1);
  UI.result.hidden = true;
  R.recorder.hidden = true;
  UI.editor.hidden = false;
  UI.editor.scrollIntoView({ behavior: 'smooth', block: 'start' });
  UI.dlRaw.onclick = () => downloadBlob(mainBlob, `screen-recording-raw.${mainBlob.type.includes('mp4') ? 'mp4' : 'webm'}`);
  main.addEventListener('ended', () => { UI.play.textContent = '▶'; stopPreviewAudio(); });
  renderTimeline();
  updateUndoUi();
  syncTextPanel();
  loop();
  buildTimelineMedia();
  if (UI.music.value !== 'none' || UI.clean.checked || UI.enhance.checked) { ensureMusic(); ensureProcessed(); }
  setStatus(UI.status, `${fmt(dur)} · ${vw}×${vh} · frame picked for your ${surface === 'browser' ? 'browser tab' : surface === 'window' ? 'window' : surface === 'monitor' ? 'screen' : 'recording'}. Try ✨ Auto edit, or edit everything by hand.`);
}

function closeEditor() {
  if (!E) return;
  stopPreviewAudio();
  cancelAnimationFrame(E.raf);
  [E.main, E.cam].forEach((v) => { if (v) { v.pause(); URL.revokeObjectURL(v.src); } });
  if (E.audio) E.audio.ctx.close().catch(() => {});
  E = null;
}

/* ----------------------------------------------------------- layout & rendering */

function aspectOf(v) { const [a, b] = v.split(':').map(Number); return a / b; }

function frameGeom(kind) {
  // chrome sizes as fractions of screen width; wf = total width factor
  switch (kind) {
    case 'mac': case 'windows': return { top: 0.042, side: 0, bottom: 0, wf: 1, extra: 0, radius: 0.012 };
    case 'laptop': return { top: 0.03, side: 0.03, bottom: 0.045, wf: 1.2, extra: 0.035, radius: 0.02 };
    case 'monitor': return { top: 0.022, side: 0.022, bottom: 0.05, wf: 1.044, extra: 0.16, radius: 0.012 };
    case 'phone': return E && contentAspect() > 1
      ? { top: 0.045, side: 0.07, bottom: 0.045, wf: 1.14, extra: 0, radius: 0.07, landscape: true }   // phone turned sideways
      : { top: 0.12, side: 0.05, bottom: 0.12, wf: 1.1, extra: 0, radius: 0.16 };
    default: return { top: 0, side: 0, bottom: 0, wf: 1, extra: 0, radius: 0 };
  }
}

function contentAspect() { return (E.crop.w * E.vw) / (E.crop.h * E.vh); }

function outputSize(maxLong) {
  const g = frameGeom(UI.frame.value);
  const ca = contentAspect();
  const pad = UI.bg.value === 'none' ? 0 : +UI.padding.value / 100;
  let aspect;
  if (UI.aspect.value === 'auto') {
    const tw = g.wf, th = (1 / ca) + g.top + g.bottom + g.extra;
    const p = pad * Math.max(tw, th) * 2;
    aspect = (tw + p) / (th + p);
  } else aspect = aspectOf(UI.aspect.value);
  const res = +UI.res.value;
  let w, h;
  if (aspect >= 1) { h = res; w = res * aspect; } else { w = res; h = res / aspect; }
  if (maxLong && Math.max(w, h) > maxLong) { const s = maxLong / Math.max(w, h); w *= s; h *= s; }
  return [Math.round(w / 2) * 2, Math.round(h / 2) * 2];
}

/** The area inside the background padding. */
function padBox(W, H) {
  const pad = UI.bg.value === 'none' ? 0 : (+UI.padding.value / 100) * Math.min(W, H) * 1.2;
  return { x: pad, y: pad, w: W - pad * 2, h: H - pad * 2, pad };
}

/** Screen rectangle (where the video goes) for a framed screen fitted inside a box. */
function layoutIn(box) {
  const g = frameGeom(UI.frame.value);
  const ca = contentAspect();
  const sw = Math.max(1, Math.min(box.w / g.wf, box.h / (1 / ca + g.top + g.bottom + g.extra)));
  const sh = sw / ca;
  const totalH = sh + sw * (g.top + g.bottom + g.extra);
  return { sx: box.x + (box.w - sw) / 2, sy: box.y + (box.h - totalH) / 2 + sw * g.top, sw, sh, g };
}
function layoutFor(W, H) { return layoutIn(padBox(W, H)); }

function zoomAt(t) {
  let best = null, env = 0;
  for (const z of E.zooms) {
    const ramp = Math.min(0.55, (z.end - z.start) / 3);
    const e = smooth(z.start, z.start + ramp, t) * (1 - smooth(z.end - ramp, z.end, t));
    if (e > env) { env = e; best = z; }
  }
  if (!best) return { s: 1, x: 0.5, y: 0.5 };
  return { s: lerp(1, best.scale, env), x: lerp(0.5, best.x, env), y: lerp(0.5, best.y, env) };
}

function roundRect(ctx, x, y, w, h, r) {
  r = Math.max(0, Math.min(r, w / 2, h / 2));
  ctx.beginPath();
  ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath();
}

let blurCanvas = null;
function drawBackground(ctx, W, H) {
  const v = UI.bg.value;
  if (v === 'none') { ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H); return; }
  if (v === 'solid') { ctx.fillStyle = UI.bgColor.value; ctx.fillRect(0, 0, W, H); return; }
  if (v === 'blur') {
    blurCanvas = blurCanvas || document.createElement('canvas');
    blurCanvas.width = 64; blurCanvas.height = Math.round(64 * H / W);
    const b = blurCanvas.getContext('2d');
    b.drawImage(mainSrc(), 0, 0, blurCanvas.width, blurCanvas.height);
    ctx.save(); ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(blurCanvas, 0, 0, W, H);
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, 0, W, H); ctx.restore();
    return;
  }
  const [a, b] = BGS[v] || BGS.brand;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, a); g.addColorStop(1, b);
  ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
}

function drawFrameChrome(ctx, L) {
  const { sx, sy, sw, sh, g } = L;
  const kind = UI.frame.value;
  const shadow = UI.shadow.checked && UI.bg.value !== 'none';
  const rad = (+UI.radius.value / 100) * Math.min(sw, sh);
  ctx.save();
  if (shadow) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = sw * 0.04; ctx.shadowOffsetY = sw * 0.012; }
  if (kind === 'mac' || kind === 'windows') {
    const top = sw * g.top;
    const r = Math.max(rad, sw * 0.01);
    roundRect(ctx, sx, sy - top, sw, sh + top, r);
    ctx.fillStyle = kind === 'mac' ? '#ececef' : '#f3f3f3'; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (kind === 'mac') {
      ['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(sx + top * (0.55 + i * 0.5), sy - top / 2, top * 0.15, 0, Math.PI * 2); ctx.fill(); });
      ctx.fillStyle = '#ffffff'; roundRect(ctx, sx + sw * 0.25, sy - top * 0.76, sw * 0.5, top * 0.52, top * 0.26); ctx.fill();
    } else {
      ctx.strokeStyle = '#555'; ctx.lineWidth = Math.max(1, top * 0.04);
      const cy = sy - top / 2, s = top * 0.16;
      [[sw - top * 2.6, 'min'], [sw - top * 1.6, 'max'], [sw - top * 0.6, 'x']].forEach(([dx, k]) => {
        const cx = sx + dx; ctx.beginPath();
        if (k === 'min') { ctx.moveTo(cx - s, cy); ctx.lineTo(cx + s, cy); }
        else if (k === 'max') ctx.rect(cx - s, cy - s, s * 2, s * 2);
        else { ctx.moveTo(cx - s, cy - s); ctx.lineTo(cx + s, cy + s); ctx.moveTo(cx + s, cy - s); ctx.lineTo(cx - s, cy + s); }
        ctx.stroke();
      });
      ctx.fillStyle = '#ffffff'; roundRect(ctx, sx + top * 0.5, sy - top * 0.78, sw * 0.4, top * 0.56, top * 0.12); ctx.fill();
    }
  } else if (kind === 'laptop' || kind === 'monitor') {
    const side = sw * g.side, topB = sw * g.top, bot = sw * g.bottom;
    roundRect(ctx, sx - side, sy - topB, sw + side * 2, sh + topB + bot, sw * 0.02);
    ctx.fillStyle = '#1b1c20'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#3a3b40'; ctx.beginPath(); ctx.arc(sx + sw / 2, sy - topB / 2, Math.max(1.5, topB * 0.12), 0, Math.PI * 2); ctx.fill();
    if (kind === 'laptop') {
      const by = sy + sh + bot, bw = sw * g.wf, bh = sw * g.extra;
      ctx.fillStyle = '#c9cbd1'; ctx.beginPath();
      ctx.moveTo(sx + sw / 2 - bw / 2, by); ctx.lineTo(sx + sw / 2 + bw / 2, by);
      ctx.lineTo(sx + sw / 2 + bw / 2 - bh * 0.4, by + bh); ctx.lineTo(sx + sw / 2 - bw / 2 + bh * 0.4, by + bh); ctx.closePath(); ctx.fill();
      ctx.fillStyle = '#a7a9b0'; roundRect(ctx, sx + sw / 2 - sw * 0.08, by, sw * 0.16, bh * 0.35, bh * 0.15); ctx.fill();
    } else {
      const by = sy + sh + bot, nh = sw * g.extra;
      ctx.fillStyle = '#2a2b30'; ctx.fillRect(sx + sw / 2 - sw * 0.04, by, sw * 0.08, nh * 0.8);
      roundRect(ctx, sx + sw / 2 - sw * 0.16, by + nh * 0.8, sw * 0.32, nh * 0.2, nh * 0.08); ctx.fill();
    }
  } else if (kind === 'phone') {
    const side = sw * g.side, topB = sw * g.top, bot = sw * g.bottom;
    roundRect(ctx, sx - side, sy - topB, sw + side * 2, sh + topB + bot, sw * g.radius);
    ctx.fillStyle = '#111215'; ctx.fill();
    ctx.shadowColor = 'transparent';
    ctx.fillStyle = '#000';
    if (g.landscape) roundRect(ctx, sx - side * 0.62, sy + sh * 0.32, side * 0.32, sh * 0.36, side * 0.16);   // island on the side
    else roundRect(ctx, sx + sw * 0.32, sy - topB * 0.62, sw * 0.36, topB * 0.32, topB * 0.16);
    ctx.fill();
  }
  ctx.restore();
}

function screenRadius(L) {
  const kind = UI.frame.value;
  if (kind === 'mac' || kind === 'windows') return 0;   // top bar is rounded; bottom corners follow the window
  if (kind === 'phone') return L.sw * 0.08;
  if (kind === 'laptop' || kind === 'monitor') return L.sw * 0.004;
  return (+UI.radius.value / 100) * Math.min(L.sw, L.sh);
}

/** part: 'all' | 'under' (shadow only, cacheable) | 'over' (video only) */
function drawScreen(ctx, L, t, part = 'all') {
  const z = zoomAt(t);
  const cx = E.crop.x * E.vw, cy = E.crop.y * E.vh, cw = E.crop.w * E.vw, ch = E.crop.h * E.vh;
  const w = cw / z.s, h = ch / z.s;
  const x = clamp(cx + z.x * cw - w / 2, cx, cx + cw - w);
  const y = clamp(cy + z.y * ch - h / 2, cy, cy + ch - h);
  ctx.save();
  const kind = UI.frame.value;
  const shadow = UI.shadow.checked && UI.bg.value !== 'none' && kind === 'none';
  const r = screenRadius(L);
  if (kind === 'mac' || kind === 'windows') {
    const br = Math.max((+UI.radius.value / 100) * Math.min(L.sw, L.sh), L.sw * 0.01);
    ctx.beginPath();
    ctx.moveTo(L.sx, L.sy); ctx.lineTo(L.sx + L.sw, L.sy); ctx.lineTo(L.sx + L.sw, L.sy + L.sh - br);
    ctx.arcTo(L.sx + L.sw, L.sy + L.sh, L.sx + L.sw - br, L.sy + L.sh, br); ctx.lineTo(L.sx + br, L.sy + L.sh);
    ctx.arcTo(L.sx, L.sy + L.sh, L.sx, L.sy + L.sh - br, br); ctx.closePath();
  } else roundRect(ctx, L.sx, L.sy, L.sw, L.sh, r);
  if (shadow && part !== 'over') { ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = L.sw * 0.04; ctx.shadowOffsetY = L.sw * 0.012; ctx.fillStyle = '#000'; ctx.fill(); ctx.restore(); }
  if (part === 'under') { ctx.restore(); return; }
  ctx.clip();
  ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
  ctx.filter = FX.filter;
  ctx.drawImage(mainSrc(), x, y, w, h, L.sx, L.sy, L.sw, L.sh);
  ctx.restore();
}

/* ----------------------------------------------------------- scenes (layouts over time) */

export const LAYOUTS = {
  bubble: 'Screen + bubble', screen: 'Screen only', split: 'Split screen', camera: 'Camera full'
};
const hasCam = () => !!(E && E.cam && UI.camShow.checked);

function bubbleRect(W, H) {
  const size = (+UI.camSize.value / 100) * Math.min(W, H);
  const m = Math.min(W, H) * 0.04;
  const pos = UI.camPos.value;
  const shape = UI.camShape.value;
  return {
    x: pos.includes('l') ? m : W - m - size, y: pos.includes('t') ? m : H - m - size, w: size, h: size,
    r: shape === 'circle' ? size / 2 : shape === 'rounded' ? size * 0.22 : size * 0.04, border: 1
  };
}

/** Where the screen and the camera go for a layout. */
function sceneTargets(layout, W, H) {
  const full = padBox(W, H);
  const k = Math.min(W, H);
  const cardR = k * 0.03;
  const bubble = bubbleRect(W, H);
  if (!hasCam() || layout === 'screen') return { screen: { box: full, a: 1 }, cam: { ...bubble, a: 0 } };
  if (layout === 'camera') return { screen: { box: full, a: 0 }, cam: { x: full.x, y: full.y, w: full.w, h: full.h, r: full.pad ? cardR : 0, border: 0, a: 1 } };
  if (layout === 'split') {
    const gap = Math.max(full.pad * 0.6, k * 0.025);
    if (W >= H) {
      const cw = (full.w - gap) * 0.36;
      return { screen: { box: { x: full.x, y: full.y, w: full.w - cw - gap, h: full.h }, a: 1 },
               cam: { x: full.x + full.w - cw, y: full.y, w: cw, h: full.h, r: cardR, border: 0, a: 1 } };
    }
    const ch = (full.h - gap) * 0.42;
    return { screen: { box: { x: full.x, y: full.y, w: full.w, h: full.h - ch - gap }, a: 1 },
             cam: { x: full.x, y: full.y + full.h - ch, w: full.w, h: ch, r: cardR, border: 0, a: 1 } };
  }
  return { screen: { box: full, a: 1 }, cam: { ...bubble, a: 1 } };   // bubble
}

function mixTargets(A, B, p) {
  const L = (a, b) => lerp(a, b, p);
  const box = (a, b) => ({ x: L(a.x, b.x), y: L(a.y, b.y), w: L(a.w, b.w), h: L(a.h, b.h) });
  // when the camera appears/disappears, keep its geometry from the visible side so it fades in place
  const ca = A.cam.a < 0.01 ? B.cam : A.cam, cb = B.cam.a < 0.01 ? A.cam : B.cam;
  return {
    screen: { box: box(A.screen.box, B.screen.box), a: L(A.screen.a, B.screen.a) },
    cam: { ...box(ca, cb), r: L(ca.r, cb.r), border: L(ca.border, cb.border), a: L(A.cam.a, B.cam.a) }
  };
}

function sceneIndexAt(t) {
  const sc = E.scenes;
  for (let i = 0; i < sc.length; i++) if (t < sc[i].end) return i;
  return sc.length - 1;
}

/** Resolve the scene at time t, including transitions. */
function sceneAt(t, W, H) {
  const sc = E.scenes, i = sceneIndexAt(t), cur = sc[i];
  const d = +UI.transDur.value, style = UI.transStyle.value;
  let A = cur, B = null, b = 0;
  if (i > 0 && t < cur.start + d / 2) { A = sc[i - 1]; B = cur; b = cur.start; }
  else if (i < sc.length - 1 && t > cur.end - d / 2) { A = cur; B = sc[i + 1]; b = cur.end; }
  if (!B || A.layout === B.layout) return { single: sceneTargets(cur.layout, W, H) };
  if (style === 'cut') return { single: sceneTargets(t >= b ? B.layout : A.layout, W, H) };
  const p = smooth(b - d / 2, b + d / 2, t);
  const TA = sceneTargets(A.layout, W, H), TB = sceneTargets(B.layout, W, H);
  return style === 'smooth' ? { single: mixTargets(TA, TB, p) } : { TA, TB, p, style };
}

function drawCamRect(ctx, c, part = 'all') {
  const cam = camSrc();
  if (c.w < 2 || c.h < 2 || (!cam && part !== 'under') || (!E.cam)) return;
  const [vw, vh] = cam ? dimsOf(cam) : [1, 1], ar = c.w / c.h;
  let sw = vw, sh = vw / ar;
  if (sh > vh) { sh = vh; sw = vh * ar; }
  const sx = (vw - sw) / 2, sy = (vh - sh) / 2;
  const m = Math.min(c.w, c.h);
  const bw = c.border * Math.max(2, m * 0.025);
  ctx.save();
  if (part !== 'over') {
    if (UI.bg.value !== 'none' || c.border > 0.5) { ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = m * 0.1; ctx.shadowOffsetY = m * 0.025; }
    roundRect(ctx, c.x, c.y, c.w, c.h, c.r);
    ctx.fillStyle = bw > 0.5 ? '#fff' : '#000'; ctx.fill();
    ctx.shadowColor = 'transparent';
    if (part === 'under') { ctx.restore(); return; }
  }
  roundRect(ctx, c.x + bw, c.y + bw, c.w - bw * 2, c.h - bw * 2, Math.max(0, c.r - bw)); ctx.clip();
  ctx.translate(c.x + c.w, c.y); ctx.scale(-1, 1);   // mirror like a selfie
  ctx.filter = FX.filter;
  ctx.drawImage(cam, sx, sy, sw, sh, bw, bw, c.w - bw * 2, c.h - bw * 2);
  ctx.restore();
}

function drawScene(ctx, T, t, alpha = 1, part = 'all') {
  let L = null;
  if (T.screen.a * alpha > 0.01) {
    ctx.save(); ctx.globalAlpha = T.screen.a * alpha;
    L = layoutIn(T.screen.box);
    if (part !== 'over') drawFrameChrome(ctx, L);
    drawScreen(ctx, L, t, part);
    ctx.restore();
  }
  if (T.cam.a * alpha > 0.01) { ctx.save(); ctx.globalAlpha = T.cam.a * alpha; drawCamRect(ctx, T.cam, part); ctx.restore(); }
  return T.screen.a * alpha > 0.5 ? L : null;
}

/* Static layers (background, device frame, shadows, camera plate) only change when the scene
   or style changes, so they are drawn once into an "underlay" and reused — shadows are costly. */
const underlays = new Map();
function styleKey() {
  return [UI.frame.value, UI.bg.value, UI.bgColor.value, UI.padding.value, UI.radius.value, UI.shadow.checked, UI.camShape.value,
    E.crop.w.toFixed(4), E.crop.h.toFixed(4)].join('|');
}
function targetsKey(T) {
  const r = (v) => Math.round(v * 10) / 10;
  const b = T.screen.box, c = T.cam;
  return [r(b.x), r(b.y), r(b.w), r(b.h), r(T.screen.a), r(c.x), r(c.y), r(c.w), r(c.h), r(c.r), r(c.border), r(c.a)].join(',');
}

function currentLook() {
  return lookFrom(UI.look.value, { brightness: +UI.fxB.value, contrast: +UI.fxC.value, saturation: +UI.fxS.value, warmth: +UI.fxW.value, vignette: +UI.fxV.value });
}

function paintScene(ctx, W, H, t, T) {
  ctx.clearRect(0, 0, W, H);
  drawBackground(ctx, W, H);
  return drawScene(ctx, T, t);
}

/** One scene, with the static layers served from the cached underlay. */
function renderSingle(ctx, W, H, t, T) {
  if (UI.bg.value === 'blur') return paintScene(ctx, W, H, t, T);
  const key = `${W}x${H}|${styleKey()}|${targetsKey(T)}`;
  let u = underlays.get(`${W}x${H}`);
  if (!u || u.key !== key) {
    u = u || { canvas: document.createElement('canvas') };
    u.canvas.width = W; u.canvas.height = H;
    const g = u.canvas.getContext('2d');
    drawBackground(g, W, H);
    drawScene(g, T, t, 1, 'under');
    u.key = key;
    underlays.set(`${W}x${H}`, u);
    if (underlays.size > 3) underlays.delete(underlays.keys().next().value);
  }
  ctx.globalCompositeOperation = 'copy';
  ctx.drawImage(u.canvas, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  return drawScene(ctx, T, t, 1, 'over');
}

const tcans = [];
function tcanvas(i, W, H) {
  const c = tcans[i] || (tcans[i] = { canvas: document.createElement('canvas') });
  if (c.canvas.width !== W || c.canvas.height !== H) { c.canvas.width = W; c.canvas.height = H; c.ctx = c.canvas.getContext('2d'); }
  c.ctx = c.ctx || c.canvas.getContext('2d');
  return c;
}

function renderFrame(ctx, W, H, t) {
  FX.look = currentLook(); FX.filter = filterString(FX.look);
  const S = sceneAt(t, W, H);
  let L;
  if (S.style) {   // fade / dip / slide / zoom / wipe / blur: render both scenes, then blend
    const a = tcanvas(0, W, H), b = tcanvas(1, W, H);
    const la = paintScene(a.ctx, W, H, t, S.TA), lb = paintScene(b.ctx, W, H, t, S.TB);
    composeTransition(ctx, W, H, a.canvas, b.canvas, S.p, S.style);
    L = S.p > 0.5 ? lb || la : la || lb;
  } else L = renderSingle(ctx, W, H, t, S.single);
  drawLookOverlay(ctx, W, H, FX.look);
  for (const it of E.texts) drawText(ctx, W, H, it, t);
  return L;
}

/** Tiny content fingerprint of a frame (48×27, quantised) so visually identical frames match
    even when the recorder stamped them as new frames. */
let sigCanvas = null, sigCtx = null;
function contentSig(img) {
  if (!sigCanvas) { sigCanvas = document.createElement('canvas'); sigCanvas.width = 48; sigCanvas.height = 27; sigCtx = sigCanvas.getContext('2d', { willReadFrequently: true }); }
  sigCtx.drawImage(img, 0, 0, 48, 27);
  const d = sigCtx.getImageData(0, 0, 48, 27).data;
  let h1 = 2166136261, h2 = 0;
  for (let i = 0; i < d.length; i += 4) {
    const v = ((d[i] >> 4) << 8) | ((d[i + 1] >> 4) << 4) | (d[i + 2] >> 4);   // ignore tiny compression noise
    h1 = Math.imul(h1 ^ v, 16777619); h2 = (h2 + v * (i + 1)) | 0;
  }
  return `${h1 >>> 0}:${h2 >>> 0}`;
}

/** A cheap fingerprint of everything that changes between frames (used to skip identical frames). */
function frameKey(t, mainTs, camTs) {
  const z = zoomAt(t), S = sceneAt(t, 2, 2);
  const sk = S.single ? targetsKey(S.single) : `${targetsKey(S.TA)}>${targetsKey(S.TB)}@${S.p.toFixed(3)}${S.style}`;
  return `${mainTs}|${camTs}|${z.s.toFixed(4)},${z.x.toFixed(4)},${z.y.toFixed(4)}|${sk}|${textKey(E.texts, t)}`;
}

/* crop mode: show the raw source frame with the crop rectangle */
function renderCropView(ctx, W, H) {
  ctx.fillStyle = '#0e0e12'; ctx.fillRect(0, 0, W, H);
  ctx.drawImage(E.main, 0, 0, W, H);
}

/* ----------------------------------------------------------- preview loop */

function syncCam() {
  if (!E.cam) return;
  const target = Math.max(0, E.main.currentTime - E.camOffset);
  if (Math.abs(E.cam.currentTime - target) > 0.25) { try { E.cam.currentTime = target; } catch (_) { /* ignore */ } }
  if (!E.main.paused && E.cam.paused) E.cam.play().catch(() => {});
  if (E.main.paused && !E.cam.paused) E.cam.pause();
  E.cam.playbackRate = E.main.playbackRate;
}

function loop() {
  if (!E) return;
  E.raf = requestAnimationFrame(loop);
  if (E.exporting) return;
  const t = E.main.currentTime;
  if (!E.main.paused) {
    const segs = keptSegments();
    const inKept = segs.some(([a, b]) => t >= a - 0.02 && t < b);
    if (!inKept) {
      const nxt = segs.find(([a]) => a > t - 0.02);
      if (nxt) seek(nxt[0]);
      else { E.main.pause(); stopPreviewAudio(); UI.play.textContent = '▶'; }
    }
  }
  syncCam();
  const c = UI.canvas;
  if (E.cropMode) {
    const pw = Math.min(1280, E.vw), ph = Math.round(pw * E.vh / E.vw);
    if (c.width !== pw || c.height !== ph) { c.width = pw; c.height = ph; }
    renderCropView(c.getContext('2d'), pw, ph);
  } else {
    const [w, h] = outputSize(1280);
    if (c.width !== w || c.height !== h) { c.width = w; c.height = h; }
    E.lastLayout = renderFrame(c.getContext('2d'), w, h, t);
  }
  UI.time.textContent = `${fmt(t)} / ${fmt(E.dur)}`;
  if (!E.selScene && E.cam && E._lastSceneIdx !== sceneIndexAt(t)) { E._lastSceneIdx = sceneIndexAt(t); renderTimeline(); }
  UI.playhead.style.left = `${(t / E.dur) * 100}%`;
}

/* ----------------------------------------------------------- audio routing (preview + export) */

const voiceVol = () => (UI.voiceMute.checked ? 0 : +UI.voiceVol.value / 100);
const musicVol = () => (UI.musicMute.checked ? 0 : +UI.musicVol.value / 100);
const procKey = () => `${UI.clean.checked}|${UI.cleanStr.value}|${UI.enhance.checked}`;
const musicKey = () => `${UI.music.value}|${E.musicFileName || ''}`;
const processedActive = () => (UI.clean.checked || UI.enhance.checked) && E.proc && E.proc.key === procKey();
const musicReady = () => UI.music.value !== 'none' && E.musicData && E.musicData.key === musicKey();

function ensureAudio() {
  if (E.audio) return E.audio;
  try {
    const ctx = new AudioContext();
    const src = ctx.createMediaElementSource(E.main);
    const elGain = ctx.createGain(), master = ctx.createGain(), voiceG = ctx.createGain(), musicG = ctx.createGain();
    const dest = ctx.createMediaStreamDestination();
    src.connect(elGain).connect(master);
    voiceG.connect(master); musicG.connect(master);
    master.connect(ctx.destination); master.connect(dest);
    E.audio = { ctx, dest, elGain, master, voiceG, musicG, nodes: [] };
  } catch (_) { E.audio = { ctx: null, dest: null, nodes: [] }; }
  applyGains();
  return E.audio;
}

function applyGains() {
  const a = E && E.audio; if (!a || !a.ctx) return;
  a.elGain.gain.value = processedActive() ? 0 : voiceVol();
  a.voiceG.gain.value = voiceVol();
  a.musicG.gain.value = musicVol() * (UI.duck.checked && voiceVol() > 0 ? 0.55 : 1);   // export ducks precisely; preview approximates
}
function stopPreviewAudio() { const a = E && E.audio; if (!a) return; a.nodes.forEach((n) => { try { n.stop(); } catch (_) { /* ignore */ } }); a.nodes = []; }
function startPreviewAudio() {
  const a = ensureAudio(); if (!a.ctx) return;
  stopPreviewAudio(); applyGains();
  const t = E.main.currentTime, rate = E.main.playbackRate;
  if (processedActive()) {
    const s = a.ctx.createBufferSource(); s.buffer = E.proc.buffer; s.playbackRate.value = rate; s.connect(a.voiceG);
    s.start(0, Math.min(t, E.proc.buffer.duration - 0.01)); a.nodes.push(s);
  }
  if (musicReady()) {
    const s = a.ctx.createBufferSource(); s.buffer = E.musicData.buffer; s.loop = true; s.connect(a.musicG);
    s.start(0, Math.max(0, t - E.trim[0]) % E.musicData.buffer.duration); a.nodes.push(s);
  }
}

const setAudioStatus = (m, kind) => setStatus(UI.audioStatus, m, kind);
const toBuffer = (ch, sr) => { const b = new AudioBuffer({ length: ch[0].length, numberOfChannels: ch.length, sampleRate: sr }); ch.forEach((c, i) => b.copyToChannel(c, i)); return b; };

/** Decode the recording's audio once (used for the waveform, cleaning and the export mix). */
function ensureVoice() {
  if (E.voice !== undefined) return Promise.resolve(E.voice);
  if (!E._voiceP) {
    E._voiceP = (async () => {
      const MB = await loadMediabunny();
      const input = new MB.Input({ source: new MB.BlobSource(E.mainBlob), formats: MB.ALL_FORMATS });
      const at = await input.getPrimaryAudioTrack();
      if (!at) { E.voice = null; E.hasAudio = false; return null; }
      const first = await at.getFirstTimestamp().catch(() => 0);
      const parts = []; let sr = 48000, chs = 1;
      for await (const wb of new MB.AudioBufferSink(at).buffers()) { parts.push(wb); sr = wb.buffer.sampleRate; chs = Math.max(chs, wb.buffer.numberOfChannels); }
      chs = Math.min(2, chs);
      const len = Math.max(1, Math.round(E.dur * sr));
      const ch = Array.from({ length: chs }, () => new Float32Array(len));
      for (const wb of parts) {
        const off = Math.round((wb.timestamp - first) * sr);
        for (let c = 0; c < chs; c++) {
          const src = wb.buffer.getChannelData(Math.min(c, wb.buffer.numberOfChannels - 1));
          for (let i2 = Math.max(0, -off); i2 < src.length && off + i2 < len; i2++) ch[c][off + i2] = src[i2];
        }
      }
      E.voice = { sr, ch }; E.hasAudio = true;
      renderTimeline(true);
      return E.voice;
    })().catch((e) => { console.warn('[WebcamClicks] audio decode failed', e); E.voice = null; return null; });
  }
  return E._voiceP;
}

/** Clean / enhance the voice track (cached per settings). */
async function ensureProcessed() {
  if (!(UI.clean.checked || UI.enhance.checked)) return null;
  const key = procKey();
  if (E.proc && E.proc.key === key) return E.proc;
  const token = (E.procToken = (E.procToken || 0) + 1);
  const v = await ensureVoice();
  if (!v) { setAudioStatus('This recording has no audio to clean.'); return null; }
  let ch = v.ch;
  if (UI.clean.checked) {
    const mono = new Float32Array(ch[0].length);
    ch.forEach((c) => { for (let i = 0; i < c.length; i++) mono[i] += c[i] / ch.length; });
    ch = [await denoise(mono, v.sr, +UI.cleanStr.value / 100, (p) => { if (token === E.procToken) setAudioStatus(`Removing background noise… ${Math.round(p * 100)}%`); })];
  }
  if (token !== E.procToken) return null;
  if (UI.enhance.checked) { setAudioStatus('Enhancing voice…'); ch = await enhance(ch, v.sr); }
  ch = normalize(ch);
  if (token !== E.procToken) return null;
  E.proc = { key, sr: v.sr, ch, buffer: toBuffer(ch, v.sr) };
  setAudioStatus(`${[UI.clean.checked && 'Noise removed', UI.enhance.checked && 'voice enhanced'].filter(Boolean).join(', ')} and loudness levelled. Press play to hear it.`, 'ok');
  if (!E.main.paused) startPreviewAudio(); else applyGains();
  drawWave();
  return E.proc;
}

/** Generate or import the music bed (cached per choice). */
async function ensureMusic() {
  if (UI.music.value === 'none') return null;
  const key = musicKey();
  if (E.musicData && E.musicData.key === key) return E.musicData;
  const v = await ensureVoice();
  const sr = v ? v.sr : 48000;
  let ch;
  if (UI.music.value === 'file') {
    if (!E.musicFile) return null;
    setAudioStatus(`Loading “${E.musicFileName}”…`);
    try { ch = await toRate(await decodeAudioFile(E.musicFile), sr); }
    catch (e) { setAudioStatus('That audio file could not be read. Try MP3, WAV, M4A or OGG.', 'err'); return null; }
  } else {
    setAudioStatus(`Composing ${MUSIC_STYLES[UI.music.value].name} music…`);
    ch = (await generateMusic(UI.music.value, sr)).ch;
  }
  if (musicKey() !== key) return null;
  E.musicData = { key, ch, sr, buffer: toBuffer(ch, sr) };
  setAudioStatus(`Music ready (${UI.music.value === 'file' ? E.musicFileName : `${MUSIC_STYLES[UI.music.value].name}, royalty-free`}). Press play to preview.`, 'ok');
  if (!E.main.paused) startPreviewAudio();
  return E.musicData;
}

/** The finished soundtrack for export (kept clips, speed, cleaning, volume, music, ducking). */
async function exportMix() {
  const v = await ensureVoice();
  const proc = await ensureProcessed();
  const music = await ensureMusic();
  const voice = proc ? { sr: proc.sr, ch: proc.ch } : v;
  if (!voice && !music) return null;
  const sr = voice ? voice.sr : music.sr;
  return {
    sr,
    ch: buildMix({
      voice: voice && voiceVol() > 0 ? voice : null, sr, segments: keptSegments(), speed: +UI.speed.value, voiceVol: voiceVol(),
      music: music ? music.ch : null, musicVol: musicVol(), duck: UI.duck.checked, fadeIn: +UI.fadeIn.value, fadeOut: +UI.fadeOut.value
    })
  };
}

/* ----------------------------------------------------------- clips (split / delete) */

let cid = 0;
const newClip = (start, end) => ({ id: `c${++cid}`, start, end, del: false });
function clipIndexAt(t) { const c = E.clips; for (let i = 0; i < c.length; i++) if (t < c[i].end) return i; return c.length - 1; }

/** Source ranges that make it into the export: kept clips ∩ trim, merged. */
function keptSegments() {
  const out = [];
  for (const c of E.clips) {
    if (c.del) continue;
    const a = Math.max(c.start, E.trim[0]), b = Math.min(c.end, E.trim[1]);
    if (b - a < 0.05) continue;
    if (out.length && Math.abs(out[out.length - 1][1] - a) < 1e-3) out[out.length - 1][1] = b; else out.push([a, b]);
  }
  return out;
}
const outputDuration = () => keptSegments().reduce((a, [s0, e0]) => a + (e0 - s0), 0) / (+UI.speed.value || 1);

function splitClipAt(t) {
  const i = clipIndexAt(t), c = E.clips[i];
  if (t - c.start < 0.15 || c.end - t < 0.15) return null;
  const right = newClip(t, c.end); right.del = c.del;
  c.end = t;
  E.clips.splice(i + 1, 0, right);
  selectOnly('clip', right);
  renderTimeline();
  setStatus(UI.status, `Split at ${fmt(t)}. Press Delete to cut the selected clip, or double-click again to split more.`);
  return right;
}
function toggleClipDeleted(c) {
  if (!c) return;
  const kept = E.clips.filter((x) => !x.del).length;
  if (!c.del && kept <= 1) { setStatus(UI.status, 'You need to keep at least one clip.'); return; }
  c.del = !c.del;
  renderTimeline();
  setStatus(UI.status, c.del ? `Clip ${fmt(c.start)}–${fmt(c.end)} cut. It is skipped in playback and export. Select it and press Delete again to restore.` : 'Clip restored.');
}

/* one selection at a time across lanes */
function selectOnly(kind, item) {
  E.sel = kind === 'zoom' ? item : null;
  E.selScene = kind === 'scene' ? item : null;
  E.selText = kind === 'text' ? item : null;
  E.selClip = kind === 'clip' ? item : null;
  syncTextPanel();
}

/* ----------------------------------------------------------- undo / redo */

function snapshot() {
  return JSON.stringify({ clips: E.clips, zooms: E.zooms, scenes: E.scenes, texts: E.texts, trim: E.trim, crop: E.crop });
}
function recordHistory() {
  const snap = snapshot();
  if (snap === E.histNow) return;
  if (E.histNow) { E.undo.push(E.histNow); if (E.undo.length > 100) E.undo.shift(); }
  E.histNow = snap; E.redo = [];
  updateUndoUi();
}
function restore(snap) {
  const o = JSON.parse(snap);
  Object.assign(E, { clips: o.clips, zooms: o.zooms, scenes: o.scenes, texts: o.texts, trim: o.trim, crop: o.crop });
  selectOnly(null, null);
  E.histNow = snap;
  UI.trimIn.value = E.trim[0].toFixed(1); UI.trimOut.value = E.trim[1].toFixed(1);
  renderTimeline(true);
}
function undo() { if (E && E.undo.length) { E.redo.push(E.histNow); restore(E.undo.pop()); updateUndoUi(); } }
function redo() { if (E && E.redo.length) { E.undo.push(E.histNow); restore(E.redo.pop()); updateUndoUi(); } }
function updateUndoUi() { UI.undo.disabled = !E || !E.undo.length; UI.redo.disabled = !E || !E.redo.length; }

/* ----------------------------------------------------------- timeline */

const LANE_H = { clips: 40, wave: 22, scenes: 22, zooms: 22, texts: 22 };
function renderTimeline(skipHistory) {
  if (!E) return;
  const d = E.dur;
  const pct = (v) => `${(v / d) * 100}%`;
  // lanes stacked top → bottom
  let y = 6;
  const place = (el, key, show = true) => { el.hidden = !show; if (!show) return; el.style.top = `${y}px`; el.style.height = `${LANE_H[key]}px`; y += LANE_H[key] + 4; };
  place(UI.clipLane, 'clips'); UI.thumbs.style.top = UI.clipLane.style.top; UI.thumbs.style.height = UI.clipLane.style.height;
  place(UI.waveLane, 'wave', !!E.hasAudio); UI.wave.style.top = UI.waveLane.style.top;
  place(UI.sceneLane, 'scenes', !!E.cam);
  place(UI.zoomLane, 'zooms');
  place(UI.textLane, 'texts', E.texts.length > 0 || UI.editor.dataset.tab === 'text');
  UI.track.style.height = `${y + 2}px`;
  UI.trimShade.style.left = pct(E.trim[0]); UI.trimShade.style.width = pct(E.trim[1] - E.trim[0]);

  UI.clipLane.innerHTML = E.clips.map((c, i) => `<div class="ed-block ed-clip${c.del ? ' del' : ''}${c === E.selClip ? ' sel' : ''}" data-kind="clip" data-id="${c.id}"
    style="left:${pct(c.start)};width:${pct(c.end - c.start)}" title="Clip ${i + 1} · ${fmt(c.start)}–${fmt(c.end)}${c.del ? ' · cut' : ''} · double-click to split, Delete to cut">${c.del ? '✂ cut' : ''}</div>`).join('');
  UI.zoomLane.innerHTML = E.zooms.map((z) => `<div class="ed-block ed-zoom${z === E.sel ? ' sel' : ''}${z.auto ? ' auto' : ''}" data-kind="zoom" data-id="${z.id}"
    style="left:${pct(z.start)};width:${Math.max(0.6, ((z.end - z.start) / d) * 100)}%" title="Zoom ${z.scale.toFixed(2)}× · ${fmt(z.start)}–${fmt(z.end)} · drag to move, drag edges to resize">${z.scale.toFixed(1)}×</div>`).join('');
  const icons = { bubble: '🫧', screen: '🖥', split: '◧', camera: '🎥' };
  UI.sceneLane.innerHTML = E.scenes.map((sc) => `<div class="ed-block ed-scene sc-${sc.layout}${sc === E.selScene ? ' sel' : ''}" data-kind="scene" data-id="${sc.id}"
    style="left:${pct(sc.start)};width:${pct(sc.end - sc.start)}" title="${LAYOUTS[sc.layout]} · ${fmt(sc.start)}–${fmt(sc.end)}">${icons[sc.layout]} ${LAYOUTS[sc.layout]}</div>`).join('');
  UI.textLane.innerHTML = E.texts.map((tx) => `<div class="ed-block ed-text${tx === E.selText ? ' sel' : ''}" data-kind="text" data-id="${tx.id}"
    style="left:${pct(tx.start)};width:${Math.max(0.6, ((tx.end - tx.start) / d) * 100)}%" title="${TEXT_STYLES[tx.style]} · ${fmt(tx.start)}–${fmt(tx.end)}">T ${tx.text.replace(/[<>&"]/g, '').slice(0, 40)}</div>`).join('');

  const kept = keptSegments(), outDur = outputDuration();
  UI.zoomCount.textContent = `Output ${fmt(outDur)} · ${E.clips.length} clip${E.clips.length > 1 ? 's' : ''}${E.zooms.length ? ` · ${E.zooms.length} zoom${E.zooms.length > 1 ? 's' : ''}` : ''}${E.texts.length ? ` · ${E.texts.length} text` : ''}`;
  UI.zoomPanel.hidden = !E.sel;
  if (E.sel) {
    UI.zoomScale.value = E.sel.scale; UI.zoomScaleVal.textContent = `${E.sel.scale.toFixed(2)}×`;
    UI.zoomStart.value = E.sel.start.toFixed(1); UI.zoomEnd.value = E.sel.end.toFixed(1);
  }
  const cur = E.selScene || E.scenes[sceneIndexAt(E.main.currentTime)];
  UI.sceneInfo.textContent = cur ? `${E.selScene ? 'Selected' : 'At playhead'}: ${fmt(cur.start)}–${fmt(cur.end)} · ${LAYOUTS[cur.layout]}` : '';
  document.querySelectorAll('[data-layout]').forEach((b) => b.setAttribute('aria-pressed', String(!!cur && b.dataset.layout === cur.layout)));
  UI.sceneDel.disabled = E.scenes.length < 2;
  const sc = E.selClip;
  UI.clipDel.disabled = !sc;
  UI.clipDel.textContent = sc && sc.del ? '↺ Restore clip' : '🗑 Delete clip';
  UI.clipInfo.textContent = sc ? `Clip ${fmt(sc.start)}–${fmt(sc.end)}${sc.del ? ' (cut)' : ''}` : `${E.clips.length} clip${E.clips.length > 1 ? 's' : ''} · ${kept.length ? 'double-click the timeline to split' : ''}`;
  if (!skipHistory) recordHistory();
}

function seek(t) {
  if (!E) return;
  E.main.currentTime = clamp(t, 0, E.dur); syncCam();
  if (!E.main.paused) startPreviewAudio();
}

/* track: scrub on empty space; drag blocks to move / drag edges to resize; double-click splits */
let scrubbing = false, blockDrag = null;
const trackTime = (e) => { const r = UI.track.getBoundingClientRect(); return clamp((e.clientX - r.left) / r.width, 0, 1) * E.dur; };
const listFor = (kind) => ({ zoom: E.zooms, scene: E.scenes, text: E.texts, clip: E.clips })[kind];
let lastDown = null;   // our own double-click detection (the lane is re-rendered between clicks)
UI.track.addEventListener('pointerdown', (e) => {
  if (!E) return;
  UI.track.setPointerCapture(e.pointerId);
  const el = e.target.closest('.ed-block');
  const now = performance.now();
  if ((!el || el.dataset.kind === 'clip') && lastDown && now - lastDown.t < 400 && Math.abs(e.clientX - lastDown.x) < 6) {
    lastDown = null;
    splitClipAt(trackTime(e));
    return;
  }
  lastDown = { t: now, x: e.clientX };
  if (!el || el.dataset.kind === 'clip') {
    if (el) { const c = E.clips.find((x) => x.id === el.dataset.id); if (c) selectOnly('clip', c); renderTimeline(true); }
    scrubbing = true; seek(trackTime(e)); return;
  }
  const kind = el.dataset.kind;
  const item = listFor(kind).find((x) => x.id === el.dataset.id);
  const r = el.getBoundingClientRect();
  const edge = e.clientX - r.left < 9 ? 'l' : r.right - e.clientX < 9 ? 'r' : 'move';
  blockDrag = { kind, item, edge, x0: e.clientX, s0: item.start, e0: item.end, rw: UI.track.getBoundingClientRect().width, moved: false };
});
UI.track.addEventListener('pointermove', (e) => {
  if (!E) return;
  if (scrubbing) { seek(trackTime(e)); return; }
  if (!blockDrag) return;
  const b = blockDrag, dt = ((e.clientX - b.x0) / b.rw) * E.dur;
  if (Math.abs(e.clientX - b.x0) > 3) b.moved = true;
  if (!b.moved) return;
  if (b.kind === 'zoom' || b.kind === 'text') {
    const z = b.item, len = b.e0 - b.s0;
    if (b.edge === 'move') { z.start = clamp(b.s0 + dt, 0, E.dur - len); z.end = z.start + len; }
    else if (b.edge === 'l') z.start = clamp(b.s0 + dt, 0, z.end - 0.5);
    else z.end = clamp(b.e0 + dt, z.start + 0.5, E.dur);
    if (b.kind === 'zoom') z.auto = false;
    selectOnly(b.kind, z);
  } else {
    const sc = E.scenes, i = sc.indexOf(b.item);
    // scene edges are shared boundaries: dragging one resizes the neighbour too
    if (b.edge === 'l' && i > 0) { const v = clamp(b.s0 + dt, sc[i - 1].start + 0.5, b.item.end - 0.5); sc[i - 1].end = v; b.item.start = v; }
    else if (b.edge === 'r' && i < sc.length - 1) { const v = clamp(b.e0 + dt, b.item.start + 0.5, sc[i + 1].end - 0.5); sc[i + 1].start = v; b.item.end = v; }
    selectOnly('scene', b.item);
  }
  renderTimeline(true);
});
['pointerup', 'pointercancel'].forEach((ev) => UI.track.addEventListener(ev, () => {
  if (blockDrag && !blockDrag.moved) {
    const it = blockDrag.item, k = blockDrag.kind;
    if (k === 'scene') { selectOnly('scene', E.selScene === it ? null : it); seek(it.start + 0.05); }
    else { selectOnly(k, it); seek(it.start + Math.min(0.6, (it.end - it.start) / 2)); }
  }
  if (blockDrag) { E.zooms.sort((a, b) => a.start - b.start); E.texts.sort((a, b) => a.start - b.start); }
  if (blockDrag || scrubbing) renderTimeline();
  scrubbing = false; blockDrag = null;
}));

/* thumbnails strip + waveform (drawn once, in the background) */
async function buildTimelineMedia() {
  try {
    const MB = await loadMediabunny();
    const input = new MB.Input({ source: new MB.BlobSource(E.mainBlob), formats: MB.ALL_FORMATS });
    const vt = await input.getPrimaryVideoTrack();
    const first = await vt.getFirstTimestamp().catch(() => 0);
    const n = 24, tw = 96, th = Math.round(96 * E.vh / E.vw);
    const strip = UI.thumbs; strip.width = n * tw; strip.height = th;
    const g = strip.getContext('2d');
    const times = Array.from({ length: n }, (_, i) => first + (E.dur * (i + 0.5)) / n);
    let i = 0;
    for await (const sm of new MB.VideoSampleSink(vt).samplesAtTimestamps(times)) {
      if (!E) return;
      if (sm) { g.drawImage(sm.toCanvasImageSource(), i * tw, 0, tw, th); sm.close(); }
      i++;
    }
  } catch (e) { console.warn('[WebcamClicks] thumbnails unavailable', e); }
  try { await ensureVoice(); drawWave(); } catch (e) { console.warn('[WebcamClicks] waveform unavailable', e); }
}

function drawWave() {
  if (!E || !E.voice) return;
  const src = processedActive() ? E.proc : E.voice;   // show the cleaned audio once it's processed
  const c = UI.wave, w = 1200, h = 44;
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  const mono = src.ch[0], step = Math.max(1, Math.floor(mono.length / w));
  g.clearRect(0, 0, w, h);
  g.fillStyle = processedActive() ? '#12b76a' : '#3b82f6';
  for (let x = 0; x < w; x++) {
    let m = 0; const a = x * step;
    for (let k = a; k < a + step && k < mono.length; k += 8) m = Math.max(m, Math.abs(mono[k]));
    const bh = Math.max(1, Math.min(1, m * 1.6) * h);
    g.fillRect(x, (h - bh) / 2, 1, bh);
  }
}

/* scenes */
let sid = 0;
const newScene = (start, end, layout) => ({ id: `s${++sid}`, start, end, layout });
function defaultScenes() { E.scenes = [newScene(0, E.dur, E.cam ? 'bubble' : 'screen')]; E.selScene = null; }

document.querySelectorAll('[data-layout]').forEach((btn) => btn.addEventListener('click', () => {
  if (!E) return;
  const target = E.selScene || E.scenes[sceneIndexAt(E.main.currentTime)];
  target.layout = btn.dataset.layout;
  mergeScenes();
  renderTimeline();
}));
UI.sceneSplit.addEventListener('click', () => {
  if (!E) return;
  const t = E.main.currentTime, i = sceneIndexAt(t), sc = E.scenes[i];
  if (t - sc.start < 0.5 || sc.end - t < 0.5) { setStatus(UI.status, 'Move the playhead at least half a second inside a scene to split it.'); return; }
  const second = newScene(t, sc.end, sc.layout);
  sc.end = t;
  E.scenes.splice(i + 1, 0, second);
  selectOnly('scene', second);
  renderTimeline();
  setStatus(UI.status, `Scene split at ${fmt(t)}. Pick a layout for the selected part.`);
});
UI.sceneDel.addEventListener('click', () => {
  if (!E || E.scenes.length < 2) return;
  const sc = E.selScene || E.scenes[sceneIndexAt(E.main.currentTime)];
  const i = E.scenes.indexOf(sc);
  if (i > 0) E.scenes[i - 1].end = sc.end; else E.scenes[1].start = 0;
  E.scenes.splice(i, 1);
  E.selScene = null;
  renderTimeline();
});
/** Join neighbouring scenes that ended up with the same layout. */
function mergeScenes() {
  for (let i = E.scenes.length - 1; i > 0; i--) {
    if (E.scenes[i].layout === E.scenes[i - 1].layout) {
      E.scenes[i - 1].end = E.scenes[i].end;
      if (E.selScene === E.scenes[i]) E.selScene = E.scenes[i - 1];
      E.scenes.splice(i, 1);
    }
  }
}
UI.transDur.addEventListener('input', () => { UI.transDurVal.textContent = `${(+UI.transDur.value).toFixed(1)}s`; });

UI.play.addEventListener('click', () => {
  if (!E) return;
  ensureAudio(); if (E.audio.ctx && E.audio.ctx.state === 'suspended') E.audio.ctx.resume();
  if (E.main.paused) {
    const segs = keptSegments();
    const t = E.main.currentTime;
    if (!segs.some(([a, b]) => t >= a && t < b - 0.05)) seek((segs.find(([a]) => a > t) || segs[0] || [E.trim[0]])[0]);
    E.main.playbackRate = +UI.speed.value;
    E.main.play().then(startPreviewAudio); UI.play.textContent = '❚❚';
  } else { E.main.pause(); stopPreviewAudio(); UI.play.textContent = '▶'; }
});
document.addEventListener('keydown', (e) => {
  if (!E || UI.editor.hidden || /INPUT|TEXTAREA|SELECT/.test(e.target.tagName)) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? redo() : undo(); return; }
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  if (e.key === ' ') { e.preventDefault(); UI.play.click(); }
  if (e.key === 's' || e.key === 'S') { e.preventDefault(); splitClipAt(E.main.currentTime); }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (E.sel) UI.zoomDel.click();
    else if (E.selText) UI.textDel.click();
    else if (E.selClip) toggleClipDeleted(E.selClip);
  }
  if (e.key === 'ArrowLeft') seek(E.main.currentTime - (e.shiftKey ? 5 : 1));
  if (e.key === 'ArrowRight') seek(E.main.currentTime + (e.shiftKey ? 5 : 1));
});

/* trim */
function setTrim(a, b) {
  a = clamp(a, 0, E.dur - 0.5); b = clamp(b, a + 0.5, E.dur);
  E.trim = [a, b]; UI.trimIn.value = a.toFixed(1); UI.trimOut.value = b.toFixed(1); renderTimeline();
}
UI.trimIn.addEventListener('change', () => setTrim(+UI.trimIn.value, E.trim[1]));
UI.trimOut.addEventListener('change', () => setTrim(E.trim[0], +UI.trimOut.value));
UI.setIn.addEventListener('click', () => setTrim(E.main.currentTime, E.trim[1]));
UI.setOut.addEventListener('click', () => setTrim(E.trim[0], E.main.currentTime));

/* ----------------------------------------------------------- crop */

function placeCropBox() {
  const c = E.crop;
  Object.assign(UI.cropBox.style, { left: `${c.x * 100}%`, top: `${c.y * 100}%`, width: `${c.w * 100}%`, height: `${c.h * 100}%` });
}
function setCropMode(on) {
  E.cropMode = on;
  UI.cropBox.hidden = !on;
  UI.stage.classList.toggle('cropping', on);
  UI.cropToggle.textContent = on ? 'Done cropping' : 'Edit crop';
  UI.cropToggle.classList.toggle('dark', on);
  if (on) placeCropBox();
}
function applyCropAspect() {
  const v = UI.cropAspect.value; if (v === 'free') return;
  const target = aspectOf(v) * (E.vh / E.vw);   // in normalized units: w/h
  const c = E.crop;
  let w = c.w, h = c.w / target;
  if (h > 1) { h = 1; w = target; }
  if (w > 1) { w = 1; h = 1 / target; }
  E.crop = { x: clamp(c.x + (c.w - w) / 2, 0, 1 - w), y: clamp(c.y + (c.h - h) / 2, 0, 1 - h), w, h };
  placeCropBox();
}
UI.cropToggle.addEventListener('click', () => { setCropMode(!E.cropMode); if (!E.cropMode && E.events && E.zooms.some((z) => z.auto)) { planAutoZooms(); renderTimeline(); } });
UI.cropAspect.addEventListener('change', () => { if (!E.cropMode) setCropMode(true); applyCropAspect(); });
UI.cropReset.addEventListener('click', () => { E.crop = { x: 0, y: 0, w: 1, h: 1 }; UI.cropAspect.value = 'free'; placeCropBox(); });

let cropDrag = null;
UI.cropBox.addEventListener('pointerdown', (e) => {
  e.preventDefault(); e.stopPropagation();
  const r = UI.canvas.getBoundingClientRect();
  cropDrag = { h: e.target.dataset.h || 'move', x0: e.clientX, y0: e.clientY, c: { ...E.crop }, rw: r.width, rh: r.height };
  UI.cropBox.setPointerCapture(e.pointerId);
});
UI.cropBox.addEventListener('pointermove', (e) => {
  if (!cropDrag) return;
  const dx = (e.clientX - cropDrag.x0) / cropDrag.rw, dy = (e.clientY - cropDrag.y0) / cropDrag.rh;
  let { x, y, w, h } = cropDrag.c;
  const min = 0.08;
  if (cropDrag.h === 'move') { x = clamp(x + dx, 0, 1 - w); y = clamp(y + dy, 0, 1 - h); }
  else {
    const hh = cropDrag.h;
    if (hh.includes('l')) { const nx = clamp(x + dx, 0, x + w - min); w += x - nx; x = nx; }
    if (hh.includes('r')) w = clamp(w + dx, min, 1 - x);
    if (hh.includes('t')) { const ny = clamp(y + dy, 0, y + h - min); h += y - ny; y = ny; }
    if (hh.includes('b')) h = clamp(h + dy, min, 1 - y);
    const v = UI.cropAspect.value;
    if (v !== 'free') { const target = aspectOf(v) * (E.vh / E.vw); h = Math.min(w / target, 1 - y); w = h * target; }
  }
  E.crop = { x, y, w, h };
  placeCropBox();
});
['pointerup', 'pointercancel'].forEach((ev) => UI.cropBox.addEventListener(ev, () => { cropDrag = null; }));

/* ----------------------------------------------------------- zooms */

let zid = 0;
function addZoom(z) {
  const zz = { id: `z${++zid}`, start: z.start, end: z.end, x: z.x, y: z.y, scale: z.scale, auto: !!z.auto };
  E.zooms.push(zz);
  E.zooms.sort((a, b) => a.start - b.start);
  return zz;
}

UI.addZoom.addEventListener('click', () => {
  const t = E.main.currentTime;
  E.sel = addZoom({ start: clamp(t, 0, E.dur - 1), end: clamp(t + 3, 1, E.dur), x: 0.5, y: 0.5, scale: zoomScaleSetting() });
  renderTimeline();
  setStatus(UI.status, 'Zoom added. Click the preview where it should zoom in.');
});
UI.zoomScale.addEventListener('input', () => { if (E.sel) { E.sel.scale = +UI.zoomScale.value; E.sel.auto = false; renderTimeline(); } });
UI.zoomStart.addEventListener('change', () => { if (E.sel) { E.sel.start = clamp(+UI.zoomStart.value, 0, E.sel.end - 0.5); E.sel.auto = false; renderTimeline(); } });
UI.zoomEnd.addEventListener('change', () => { if (E.sel) { E.sel.end = clamp(+UI.zoomEnd.value, E.sel.start + 0.5, E.dur); E.sel.auto = false; renderTimeline(); } });
UI.zoomDel.addEventListener('click', () => { if (E.sel) { E.zooms = E.zooms.filter((z) => z !== E.sel); E.sel = null; renderTimeline(); } });

/* click on the preview = set zoom focus (when a zoom is selected) */
UI.canvas.addEventListener('click', (e) => {
  if (!E || E.cropMode) return;
  if (E.selText && E.selText.style === 'callout') {
    const rc = UI.canvas.getBoundingClientRect();
    E.selText.x = clamp((e.clientX - rc.left) / rc.width, 0.05, 0.95); E.selText.y = clamp((e.clientY - rc.top) / rc.height, 0.05, 0.95);
    renderTimeline(); return;
  }
  if (!E.lastLayout) return;
  const r = UI.canvas.getBoundingClientRect();
  const px = (e.clientX - r.left) * (UI.canvas.width / r.width), py = (e.clientY - r.top) * (UI.canvas.height / r.height);
  const L = E.lastLayout;
  if (px < L.sx || px > L.sx + L.sw || py < L.sy || py > L.sy + L.sh) return;
  // map through the current zoom so clicking what you see focuses on it
  const z = zoomAt(E.main.currentTime);
  const fx = (px - L.sx) / L.sw, fy = (py - L.sy) / L.sh;
  const vx0 = clamp(z.x - 0.5 / z.s, 0, 1 - 1 / z.s), vy0 = clamp(z.y - 0.5 / z.s, 0, 1 - 1 / z.s);
  const x = vx0 + fx / z.s, y = vy0 + fy / z.s;
  if (!E.sel) {
    const t = E.main.currentTime;
    E.sel = addZoom({ start: clamp(t - 0.3, 0, E.dur - 1), end: clamp(t + 2.7, 1, E.dur), x, y, scale: zoomScaleSetting() });
    setStatus(UI.status, 'Zoom added where you clicked. Adjust its strength and timing on the right.');
  } else { E.sel.x = clamp(x, 0, 1); E.sel.y = clamp(y, 0, 1); E.sel.auto = false; }
  renderTimeline();
});

/* ----------------------------------------------------------- smart auto-zoom (click-like moments only)
   Browsers can't see real clicks outside the page, so we look for what a click does on screen:
   a small area that suddenly changes after being still. Continuous change (typing, video,
   animation) and large changes (scrolling, page loads) are ignored. */

const STRENGTH = { subtle: 1.25, medium: 1.5, strong: 1.8 };
const AMOUNT = { fewer: 3, normal: 0.8, more: 0.3 };   // minimum quiet seconds after one zoom ends before the next may start
const zoomScaleSetting = () => STRENGTH[UI.zoomStrength.value] || 1.25;

async function analyseActivity() {
  if (E.events) return E.events;
  const v = makeVideo(E.mainBlob); v.muted = true;
  await once(v, 'loadedmetadata');
  const W = 192, H = Math.max(2, Math.round(192 * E.vh / E.vw));
  const GW = 24, GH = Math.max(2, Math.round(24 * H / W)), cw = W / GW, ch = H / GH;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  let prev = null, lastT = -1;
  const history = [];       // recent changed-cell grids (~1 s)
  const events = [];
  const sample = () => {
    const t = v.currentTime;
    if (t - lastT < 0.2) return;
    lastT = t;
    g.drawImage(v, 0, 0, W, H);
    const d = g.getImageData(0, 0, W, H).data;
    if (prev) {
      const cells = new Uint16Array(GW * GH);
      let n = 0;
      for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        if (Math.abs(d[i] - prev[i]) + Math.abs(d[i + 1] - prev[i + 1]) + Math.abs(d[i + 2] - prev[i + 2]) > 90) {
          n++; cells[Math.min(GH - 1, (y / ch) | 0) * GW + Math.min(GW - 1, (x / cw) | 0)]++;
        }
      }
      const changed = [];
      for (let k = 0; k < cells.length; k++) if (cells[k] > cw * ch * 0.04) changed.push(k);
      const frac = n / (W * H);
      if (changed.length) {
        let x0 = GW, y0 = GH, x1 = 0, y1 = 0, sx = 0, sy = 0;
        changed.forEach((k) => { const cx = k % GW, cy = (k / GW) | 0; x0 = Math.min(x0, cx); x1 = Math.max(x1, cx); y0 = Math.min(y0, cy); y1 = Math.max(y1, cy); sx += cx; sy += cy; });
        const bbox = ((x1 - x0 + 1) * (y1 - y0 + 1)) / (GW * GH);
        // was this area already busy in the last second? then it's typing/animation, not a click
        let overlap = 0;
        for (const h of history) for (const k of changed) if (h.has(k)) overlap++;
        const quietBefore = overlap <= changed.length * 0.15;
        const fullBusyBefore = history.some((h) => h.size > GW * GH * 0.3);   // scroll / page change just happened
        if (frac > 0.0006 && frac < 0.08 && bbox < 0.15 && quietBefore && !fullBusyBefore) {
          events.push({ t, x: (sx / changed.length + 0.5) / GW, y: (sy / changed.length + 0.5) / GH });
        }
      }
      history.push(new Set(changed));
      if (history.length > 5) history.shift();
    }
    prev = d;
    UI.exportFill.style.width = `${clamp(t / E.dur, 0, 1) * 100}%`;
  };
  UI.exportBar.hidden = false;
  setStatus(UI.status, 'Looking for clicks on screen…');
  await new Promise((resolve) => {
    let stop = false;
    const tick = () => { if (stop) return; sample(); if (v.requestVideoFrameCallback) v.requestVideoFrameCallback(tick); else requestAnimationFrame(tick); };
    v.addEventListener('ended', () => { stop = true; resolve(); }, { once: true });
    v.playbackRate = 8;
    v.play().then(() => tick()).catch(() => { stop = true; resolve(); });
    setTimeout(() => { stop = true; resolve(); }, (E.dur / 8 + 15) * 1000);
  });
  v.pause(); URL.revokeObjectURL(v.src);
  UI.exportBar.hidden = true;
  E.events = events;
  return events;
}

/** Turn click-like moments into short, gentle zooms. Manual zooms are never touched. */
function planAutoZooms() {
  const scale = zoomScaleSetting(), minGap = AMOUNT[UI.zoomAmount.value] || 4;
  const c0 = E.crop;
  const evs = (E.events || [])
    .filter((ev) => ev.x >= c0.x && ev.x <= c0.x + c0.w && ev.y >= c0.y && ev.y <= c0.y + c0.h && ev.t >= E.trim[0] && ev.t <= E.trim[1])
    .map((ev) => ({ t: ev.t, x: (ev.x - c0.x) / c0.w, y: (ev.y - c0.y) / c0.h }));
  E.zooms = E.zooms.filter((z) => !z.auto);
  const manual = E.zooms.slice();
  let last = null, added = 0;
  for (const ev of evs) {
    if (last && ev.t < last.end + 2 && Math.hypot(ev.x - last.x, ev.y - last.y) < 0.2) {
      last.end = Math.min(Math.max(last.end, ev.t + 2), last.start + 6, E.trim[1]);   // another click in the same spot: hold the zoom instead of zooming out and in
      continue;
    }
    if (last && ev.t - 0.35 < last.end + minGap) continue;
    const start = Math.max(E.trim[0], ev.t - 0.35), end = Math.min(E.trim[1], ev.t + 2.1);
    if (end - start < 1.2) continue;
    if (manual.some((z) => z.start < end && z.end > start)) continue;
    last = addZoom({ start, end, x: ev.x, y: ev.y, scale, auto: true });
    added++;
  }
  E.sel = null;
  return added;
}

async function autoZoom() {
  UI.autoZoom.disabled = UI.autoEdit.disabled = true;
  try {
    await analyseActivity();
    const n = planAutoZooms();
    renderTimeline();
    setStatus(UI.status, n ? `Added ${n} gentle zoom${n > 1 ? 's' : ''} on click-like moments. Drag them on the timeline, or change Strength and Amount.` : 'No clear clicks found. Click the preview to add zooms exactly where you want.', n ? 'ok' : '');
    return n;
  } finally { UI.autoZoom.disabled = UI.autoEdit.disabled = false; }
}
UI.autoZoom.addEventListener('click', autoZoom);
[UI.zoomStrength, UI.zoomAmount].forEach((el) => el.addEventListener('change', () => {
  if (!E) return;
  if (E.events) { const n = planAutoZooms(); renderTimeline(); setStatus(UI.status, `${n} auto zoom${n === 1 ? '' : 's'} updated.`); }
  }));

/* ----------------------------------------------------------- auto edit */
UI.autoEdit.addEventListener('click', async () => {
  if (!E) return;
  // scenes: camera intro → screen with bubble → camera outro
  if (E.cam && UI.introOutro.checked && E.dur >= 8) {
    const intro = Math.min(4, Math.max(2, E.dur * 0.12)), outro = E.dur >= 14 ? Math.min(3, E.dur * 0.1) : 0;
    const a = E.trim[0], b = E.trim[1];
    E.scenes = [newScene(0, a + intro, 'camera'), newScene(a + intro, outro ? b - outro : E.dur, 'bubble')];
    if (outro) E.scenes.push(newScene(b - outro, E.dur, 'camera'));
  } else defaultScenes();
  E.selScene = null;
  const n = await autoZoom();
  renderTimeline();
  setStatus(UI.status, `Auto edit done: ${E.cam ? `${E.scenes.length} scene${E.scenes.length > 1 ? 's' : ''}, ` : ''}${n} zoom${n === 1 ? '' : 's'}, ${UI.transStyle.value} transitions. Press play to preview, then tweak anything.`, 'ok');
});

/* ----------------------------------------------------------- settings */

[UI.aspect, UI.bg, UI.bgColor, UI.padding, UI.radius, UI.shadow, UI.frame, UI.camShow, UI.camPos, UI.camSize, UI.camShape, UI.speed, UI.res]
  .forEach((el) => el.addEventListener('input', () => { UI.bgColor.closest('.t-field').hidden = UI.bg.value !== 'solid'; }));
UI.aspect.addEventListener('change', () => {
  if (E && UI.aspect.value === '9:16' && contentAspect() > 1) {
    setStatus(UI.status, 'Tip: your recording is wide. Set Crop shape to 9:16 (Trim & crop) to fill the vertical video, or add zooms so text stays readable on phones.');
  }
});
UI.bgColor.closest('.t-field').hidden = true;

/* ----------------------------------------------------------- tabs */
function setTab(name) {
  UI.editor.dataset.tab = name;
  document.querySelectorAll('[data-tab-btn]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tabBtn === name)));
  document.querySelectorAll('[data-pane]').forEach((p) => { p.hidden = p.dataset.pane !== name; });
  if (E) renderTimeline(true);
}
document.querySelectorAll('[data-tab-btn]').forEach((b) => b.addEventListener('click', () => setTab(b.dataset.tabBtn)));
setTab('edit');

/* ----------------------------------------------------------- clips toolbar + undo */
UI.splitBtn.addEventListener('click', () => { if (E && !splitClipAt(E.main.currentTime)) setStatus(UI.status, 'Move the playhead inside a clip (not right at its edge) to split.'); });
UI.clipDel.addEventListener('click', () => { if (E) toggleClipDeleted(E.selClip); });
UI.undo.addEventListener('click', undo);
UI.redo.addEventListener('click', redo);

/* ----------------------------------------------------------- audio panel */
const pctLabel = (el, out) => { out.textContent = `${el.value}%`; };
UI.voiceVol.addEventListener('input', () => { pctLabel(UI.voiceVol, UI.voiceVolVal); applyGains(); });
UI.musicVol.addEventListener('input', () => { pctLabel(UI.musicVol, UI.musicVolVal); applyGains(); });
[UI.voiceMute, UI.musicMute, UI.duck].forEach((el) => el.addEventListener('change', applyGains));
[UI.clean, UI.enhance].forEach((el) => el.addEventListener('change', async () => {
  if (!E) return;
  UI.cleanStr.disabled = !UI.clean.checked;
  if (!UI.clean.checked && !UI.enhance.checked) { E.procToken = (E.procToken || 0) + 1; setAudioStatus('Original audio.'); applyGains(); drawWave(); if (!E.main.paused) startPreviewAudio(); return; }
  await ensureProcessed();
}));
UI.cleanStr.addEventListener('change', () => { if (E && UI.clean.checked) ensureProcessed(); });
UI.music.addEventListener('change', async () => {
  if (!E) return;
  if (UI.music.value === 'file') { UI.musicFile.click(); return; }
  if (UI.music.value === 'none') { stopPreviewAudio(); if (!E.main.paused) startPreviewAudio(); setAudioStatus('No background music.'); return; }
  await ensureMusic();
});
UI.musicFile.addEventListener('change', async () => {
  const f = UI.musicFile.files && UI.musicFile.files[0];
  UI.musicFile.value = '';
  if (!f) { if (!E.musicFile) UI.music.value = 'none'; return; }
  E.musicFile = f; E.musicFileName = f.name;
  UI.music.value = 'file';
  await ensureMusic();
});

/* ----------------------------------------------------------- effects panel */
const lookControls = [UI.fxB, UI.fxC, UI.fxS, UI.fxW, UI.fxV];
UI.look.innerHTML = Object.entries(LOOKS).map(([k, v]) => `<option value="${k}">${v.name}</option>`).join('');
UI.fxReset.addEventListener('click', () => { UI.look.value = 'none'; lookControls.forEach((c) => { c.value = 0; }); });
UI.transStyle.innerHTML = Object.entries(TRANSITIONS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
UI.transStyle.value = 'smooth';

/* ----------------------------------------------------------- text panel */
let tid = 0;
UI.textStyle.innerHTML = Object.entries(TEXT_STYLES).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
UI.textAnim.innerHTML = Object.entries(TEXT_ANIMS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('');
const POS = { title: [['center', 'Centre'], ['top', 'Top'], ['bottom', 'Bottom']], lower: [['left', 'Left'], ['right', 'Right']], caption: [['bottom', 'Bottom'], ['top', 'Top']], label: [['left', 'Top left'], ['right', 'Top right'], ['bottom', 'Bottom left']], callout: [['free', 'Click the preview to place']] };
function fillPos(style, val) { UI.textPos.innerHTML = POS[style].map(([k, v]) => `<option value="${k}">${v}</option>`).join(''); UI.textPos.value = val && POS[style].some(([k]) => k === val) ? val : POS[style][0][0]; }

function syncTextPanel() {
  const t = E && E.selText;
  UI.textPanel.hidden = !t;
  if (!t) return;
  UI.textVal.value = t.text; UI.textSub.value = t.sub || ''; UI.textStyle.value = t.style; fillPos(t.style, t.pos);
  UI.textAnim.value = t.anim; UI.textColor.value = t.color || (t.style === 'title' || t.style === 'caption' ? '#ffffff' : '#ff4d2e');
  UI.textStart.value = t.start.toFixed(1); UI.textEnd.value = t.end.toFixed(1);
  UI.textSubWrap.hidden = t.style !== 'lower';
}
UI.textAdd.addEventListener('click', () => {
  if (!E) return;
  const t = E.main.currentTime;
  const style = document.querySelector('[data-text-preset][aria-pressed="true"]')?.dataset.textPreset || 'title';
  const defaults = { title: 'Your title', lower: 'Your name', caption: 'Add your caption here', label: 'NEW', callout: 'Click here' };
  const item = { id: `t${++tid}`, start: clamp(t, 0, E.dur - 0.5), end: clamp(t + 3, 0.5, E.dur), text: defaults[style], sub: style === 'lower' ? 'Your role or channel' : '', style, pos: POS[style][0][0], anim: style === 'title' ? 'pop' : style === 'lower' ? 'slide' : 'fade', color: '', x: 0.5, y: 0.3 };
  E.texts.push(item); E.texts.sort((a, b) => a.start - b.start);
  selectOnly('text', item); renderTimeline();
  UI.textVal.focus(); UI.textVal.select();
});
document.querySelectorAll('[data-text-preset]').forEach((b) => b.addEventListener('click', () => {
  document.querySelectorAll('[data-text-preset]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
  if (E && E.selText) { E.selText.style = b.dataset.textPreset; fillPos(E.selText.style); E.selText.pos = UI.textPos.value; syncTextPanel(); renderTimeline(); }
}));
const editText = (fn) => () => { if (!E || !E.selText) return; fn(E.selText); renderTimeline(); };
UI.textVal.addEventListener('input', editText((t) => { t.text = UI.textVal.value; }));
UI.textSub.addEventListener('input', editText((t) => { t.sub = UI.textSub.value; }));
UI.textStyle.addEventListener('change', editText((t) => { t.style = UI.textStyle.value; fillPos(t.style); t.pos = UI.textPos.value; UI.textSubWrap.hidden = t.style !== 'lower'; }));
UI.textPos.addEventListener('change', editText((t) => { t.pos = UI.textPos.value; }));
UI.textAnim.addEventListener('change', editText((t) => { t.anim = UI.textAnim.value; }));
UI.textColor.addEventListener('input', editText((t) => { t.color = UI.textColor.value; }));
UI.textStart.addEventListener('change', editText((t) => { t.start = clamp(+UI.textStart.value, 0, t.end - 0.3); }));
UI.textEnd.addEventListener('change', editText((t) => { t.end = clamp(+UI.textEnd.value, t.start + 0.3, E.dur); }));
UI.textDel.addEventListener('click', () => { if (!E || !E.selText) return; E.texts = E.texts.filter((x) => x !== E.selText); selectOnly(null, null); renderTimeline(); });

/* ----------------------------------------------------------- export */

/* Fast export (default): decode frames directly, render each output frame, hardware-encode with
   WebCodecs and mux to MP4/WebM with mediabunny. No playback, so it runs much faster than real
   time and keeps going in a background tab. Falls back to real-time export when unsupported. */

const MEDIABUNNY_URL = 'https://cdn.jsdelivr.net/npm/mediabunny@1.62.1/dist/bundles/mediabunny.min.mjs';
const EXPORT_FPS = 30;
let mbPromise = null;
const loadMediabunny = () => (mbPromise = mbPromise || import(/* webpackIgnore: true */ MEDIABUNNY_URL).catch((e) => { mbPromise = null; throw e; }));

async function fastExport(W, H, onProgress) {
  if (typeof VideoEncoder === 'undefined' || typeof VideoFrame === 'undefined') throw new Error('WebCodecs not available');
  const MB = await loadMediabunny();
  const speed = +UI.speed.value;
  const segs = keptSegments();
  if (!segs.length) throw new Error('Everything is cut. Restore a clip first.');
  const t0 = segs[0][0], t1 = segs[segs.length - 1][1];
  // output time → source time across the kept clips
  const segOut = []; { let acc = 0; for (const [a, b] of segs) { segOut.push([acc, a, b]); acc += (b - a) / speed; } }
  const outTotal = segOut.length ? segOut[segOut.length - 1][0] + (segs[segs.length - 1][1] - segs[segs.length - 1][0]) / speed : 0;
  const srcAt = (o) => { let s0 = segOut[0]; for (const sg of segOut) { if (o >= sg[0]) s0 = sg; else break; } return Math.min(s0[2] - 1e-3, s0[1] + (o - s0[0]) * speed); };
  let fmt = 'mp4';
  let vcodec = await MB.getFirstEncodableVideoCodec(['avc', 'vp9', 'av1'], { width: W, height: H });
  if (!vcodec) { fmt = 'webm'; vcodec = await MB.getFirstEncodableVideoCodec(['vp9', 'vp8', 'av1'], { width: W, height: H }); }
  if (!vcodec) throw new Error('No video encoder available');

  const input = new MB.Input({ source: new MB.BlobSource(E.mainBlob), formats: MB.ALL_FORMATS });
  const vtrack = await input.getPrimaryVideoTrack();
  if (!vtrack) throw new Error('No video track');
  let camTrack = null;
  if (E.camBlob && hasCam()) camTrack = await new MB.Input({ source: new MB.BlobSource(E.camBlob), formats: MB.ALL_FORMATS }).getPrimaryVideoTrack();

  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const output = new MB.Output({
    format: fmt === 'mp4' ? new MB.Mp4OutputFormat({ fastStart: 'in-memory' }) : new MB.WebMOutputFormat(),
    target: new MB.BufferTarget()
  });
  const bitrate = W * H > 2e6 ? 12_000_000 : W * H > 9e5 ? 8_000_000 : 5_000_000;
  const vsource = new MB.CanvasSource(canvas, { codec: vcodec, bitrate, keyFrameInterval: 2 });
  output.addVideoTrack(vsource, { frameRate: EXPORT_FPS });
  let asource = null;
  const mix = await exportMix();
  if (mix) {
    const acodec = await MB.getFirstEncodableAudioCodec(fmt === 'mp4' ? ['aac', 'opus'] : ['opus', 'vorbis']);
    if (acodec) { asource = new MB.AudioBufferSource({ codec: acodec, bitrate: 128_000 }); output.addAudioTrack(asource); }
  }
  await output.start();

  // ---- video: walk decoded frames in order, emit a frame every 1/30 s of output time
  const firstTs = await vtrack.getFirstTimestamp().catch(() => 0);   // align with the <video> element's timeline
  const mainIt = new MB.VideoSampleSink(vtrack).samples(firstTs + Math.max(0, t0 - 0.5), firstTs + t1 + 0.5);
  const camFirst = camTrack ? await camTrack.getFirstTimestamp().catch(() => 0) : 0;
  const camIt = camTrack ? new MB.VideoSampleSink(camTrack).samples() : null;
  let cur = null, next = (await mainIt.next()).value || null;
  let camCur = null, camNext = camIt ? (await camIt.next()).value || null : null;
  const total = Math.max(1, Math.ceil(outTotal * EXPORT_FPS));
  const started = performance.now();
  let lastKey = '', heldFrom = 0, lastK = -1, sigFor = null, curSig = '';
  try {
    for (let k = 0; k < total; k++) {
      const ts = srcAt(k / EXPORT_FPS);
      while (next && next.timestamp - firstTs <= ts + 1e-4) { if (cur) cur.close(); cur = next; next = (await mainIt.next()).value || null; }
      if (!cur && next) { cur = next; next = (await mainIt.next()).value || null; }
      if (camIt) {
        const tc = ts - E.camOffset;
        while (camNext && camNext.timestamp - camFirst <= tc + 1e-4) { if (camCur) camCur.close(); camCur = camNext; camNext = (await camIt.next()).value || null; }
      }
      if (!cur) break;
      if (cur !== sigFor) { curSig = contentSig(cur.toCanvasImageSource()); sigFor = cur; }
      const fk = frameKey(ts, curSig, camCur && hasCam() ? camCur.timestamp : '');
      // Screen recordings are mostly still. A frame identical to the previous one is not
      // re-rendered or re-encoded: the held frame simply lasts longer (variable frame rate,
      // capped at 1 s so every player and editor stays happy).
      if (fk !== lastKey || k - heldFrom >= EXPORT_FPS) {
        if (k > 0) await vsource.add(heldFrom / EXPORT_FPS, (k - heldFrom) / EXPORT_FPS);   // flush the held frame
        if (fk !== lastKey) {
          SRC = { main: cur.toCanvasImageSource(), cam: camCur ? camCur.toCanvasImageSource() : null };
          renderFrame(ctx, W, H, ts);
          SRC = null;
          lastKey = fk;
        }
        heldFrom = k;
      }
      lastK = k;
      if (k % 15 === 0) onProgress(k / total * (asource ? 0.92 : 1), performance.now() - started, ts - t0);
    }
    if (lastK >= 0) await vsource.add(heldFrom / EXPORT_FPS, (lastK + 1 - heldFrom) / EXPORT_FPS);   // last held frame
  } finally {
    SRC = null;
    [cur, next, camCur, camNext].forEach((x) => x && x.close && x.close());
    if (mainIt.return) await mainIt.return();
    if (camIt && camIt.return) await camIt.return();
  }
  vsource.close();

  // ---- audio: the finished mix (kept clips, speed, cleaning, volume, music + ducking)
  if (asource && mix) {
    onProgress(0.95, performance.now() - started, outTotal * speed);
    const { sr, ch } = mix, step = sr * 5;
    for (let pos = 0; pos < ch[0].length; pos += step) {
      const n = Math.min(step, ch[0].length - pos);
      const buf = new AudioBuffer({ length: n, numberOfChannels: 2, sampleRate: sr });
      buf.copyToChannel(ch[0].subarray(pos, pos + n), 0); buf.copyToChannel(ch[1].subarray(pos, pos + n), 1);
      await asource.add(buf);
    }
    asource.close();
  }
  await output.finalize();
  return new Blob([output.target.buffer], { type: fmt === 'mp4' ? 'video/mp4' : 'video/webm' });
}

/* Real-time export (fallback for browsers without WebCodecs). */
async function realtimeExport(W, H, onProgress) {
  const canvas = document.createElement('canvas'); canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  const audio = ensureAudio();
  if (audio.ctx && audio.ctx.state === 'suspended') await audio.ctx.resume();
  const stream = canvas.captureStream(30);
  if (audio.dest) audio.dest.stream.getAudioTracks().forEach((t) => stream.addTrack(t));
  const bitrate = W * H > 2e6 ? 12_000_000 : W * H > 9e5 ? 8_000_000 : 5_000_000;
  let mr;
  try { mr = new MediaRecorder(stream, { mimeType: pickMime(true), videoBitsPerSecond: bitrate }); } catch (_) { mr = new MediaRecorder(stream); }
  const chunks = [];
  mr.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
  const segs = keptSegments();
  const mix = await exportMix();
  E.main.pause(); E.main.currentTime = segs[0][0];
  await once(E.main, 'seeked');
  syncCam();
  const speed = +UI.speed.value;
  E.main.playbackRate = speed;
  if (E.cam) E.cam.playbackRate = speed;
  const finished = new Promise((resolve) => { mr.onstop = resolve; });
  const started = performance.now();
  let mixNode = null;
  if (mix && audio.ctx) {   // the element is silenced; the finished mix plays into the recording instead
    audio.elGain.gain.value = 0;
    mixNode = audio.ctx.createBufferSource(); mixNode.buffer = toBuffer(mix.ch, mix.sr); mixNode.connect(audio.master); mixNode.start();
  }
  const outTotal = segs.reduce((a, [x, y]) => a + (y - x), 0);
  let segI = 0, doneBefore = 0;
  renderFrame(ctx, W, H, E.main.currentTime);
  mr.start(1000);
  await E.main.play();
  await new Promise((resolve) => {
    const step = () => {
      let t = E.main.currentTime;
      if (t >= segs[segI][1]) {
        doneBefore += segs[segI][1] - segs[segI][0]; segI++;
        if (segI >= segs.length) return resolve();
        E.main.currentTime = segs[segI][0]; t = segs[segI][0];
      }
      syncCam();
      renderFrame(ctx, W, H, t);
      const done = doneBefore + (t - segs[segI][0]);
      onProgress(clamp(done / outTotal, 0, 1), performance.now() - started, done);
      if (E.main.ended) return resolve();
      requestAnimationFrame(step);
    };
    step();
  });
  E.main.pause(); if (E.cam) E.cam.pause();
  if (mixNode) { try { mixNode.stop(); } catch (_) { /* ignore */ } }
  applyGains();
  mr.stop();
  await finished;
  return new Blob(chunks, { type: mr.mimeType || 'video/webm' });
}

UI.exportBtn.addEventListener('click', async () => {
  if (!E || E.exporting) return;
  if (E.cropMode) setCropMode(false);
  const [W, H] = outputSize();
  E.exporting = true;
  E.main.pause(); UI.play.textContent = '▶';
  UI.exportBtn.disabled = true; UI.exportBar.hidden = false; UI.result.hidden = true; UI.exportFill.style.width = '0%';
  const progress = (f, ms, videoSecs) => {
    UI.exportFill.style.width = `${clamp(f, 0, 1) * 100}%`;
    const x = ms > 500 && videoSecs > 0 ? ` · ${(videoSecs * 1000 / ms).toFixed(1)}× faster than real time` : '';
    setStatus(UI.status, `Exporting… ${Math.round(clamp(f, 0, 1) * 100)}%${x}`);
  };
  const t0 = performance.now();
  let blob = null, mode = 'fast';
  try {
    setStatus(UI.status, 'Preparing fast export…');
    blob = await fastExport(W, H, progress);
  } catch (e) {
    console.warn('[WebcamClicks] fast export unavailable, using real-time export:', e);
    mode = 'realtime';
    setStatus(UI.status, 'Exporting in real time (your browser lacks the fast video encoder). Keep this tab visible.');
    try { blob = await realtimeExport(W, H, progress); }
    catch (e2) { setStatus(UI.status, `Export failed: ${e2.message || e2}`, 'err'); }
  }
  E.exporting = false;
  UI.exportBtn.disabled = false; UI.exportBar.hidden = true;
  if (!blob) return;
  const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
  UI.dlFinal.onclick = () => downloadBlob(blob, `screen-recording-${W}x${H}.${ext}`);
  UI.result.hidden = false;
  E.dirty = false;
  const secs = (performance.now() - t0) / 1000;
  setStatus(UI.status, `Export ready in ${secs < 60 ? `${secs.toFixed(1)} s` : `${Math.floor(secs / 60)} min ${Math.round(secs % 60)} s`}: ${W}×${H} · ${formatBytes(blob.size)} · ${ext.toUpperCase()}${mode === 'fast' ? '' : ' (real-time mode)'}.`, 'ok');
});

UI.newRec.addEventListener('click', () => {
  if (E && E.dirty && !confirm('Discard this recording and start a new one?')) return;
  closeEditor();
  UI.editor.hidden = true; R.recorder.hidden = false;
  setStatus(R.status, '');
});

// test hook: open the editor with an existing video blob (used by automated checks)
window.__srOpenEditor = (blob, opts = {}) => openEditor({ mainBlob: blob, camBlob: opts.cam || null, duration: opts.duration || 5, surface: opts.surface || 'browser', camOffset: 0 });
