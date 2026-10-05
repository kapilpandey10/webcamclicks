/* WebcamClicks — app.js
   Wires together camera, effects, face tracking, games, gallery and UI. */

import { $, clamp, rand, storage, toast, FpsMeter, friendlyCameraError, makeCanvas, downloadDataUrl, dataUrlToFile, timestamp } from './utils.js';
import { Sound } from './sound.js';
import { CameraManager } from './camera.js';
import { MotionDetector } from './motion.js';
import { EffectManager } from './effects/EffectManager.js';
import { register2DFilters } from './effects/filters-2d.js';
import { registerFaceEffects } from './effects/face-effects.js';
import { FaceTracker } from './face/face-detection.js';
import { GameManager } from './games/GameManager.js';
import { motionCatch } from './games/motion-game.js';
import { facePong } from './games/pong-game.js';
import { freezePose } from './games/freeze-game.js';
import { balloonPop } from './games/balloon-pop.js';
import { Gallery } from './gallery.js';
import { shareImage, copyImage, shareVideoBlob } from './share.js';
import { Recorder, downloadClip } from './recorder.js';
import { generateCollage, COLLAGE_THEMES } from './collage.js';

/* ============================ state ============================ */
const settings = storage.get('wc_settings', { mirror: true, sound: true, intensity: 100, effect: 'normal' });
const favs = new Set(storage.get('wc_favs', ['grayscale', 'sepia', 'sunglasses', 'crown', 'vhs', 'glitch']));

const camera = new CameraManager();
const motion = new MotionDetector();
const manager = new EffectManager();
register2DFilters(manager);
registerFaceEffects(manager);

const tracker = new FaceTracker(onFaceStatus);
const gallery = new Gallery(renderGallery);

let recorder = null;
let isRecording = false;

let display = null;
let dctx = null;
let fpsMeter = new FpsMeter();
let lastNow = 0;
let running = false;
let currentCategory = 'All';
let gameMsgTimer = 0;
let lastGameId = null;
let pendingGame = null;
let badgeTick = 0;
let mobileMode = 'photo'; /* 'photo' | 'collage' | 'video' */
let collagePoseCount = 4;
let collageActive = false;
let collagePoses = [];
let currentCollageResult = null;
let collageTheme = 'white';
let countdownActive = false;
let cancelCollageRequested = false;

/* DOM refs (filled in init) */
const el = {};

/* ============================ game engine ============================ */
const gameEngine = {
  sound: Sound,
  setScore(s) {
    if (!el.hudScore) return;
    const t = s == null ? '' : `🏆 ${s}`;
    if (el.hudScore.textContent !== t) el.hudScore.textContent = t;
  },
  setLives() {},
  message(title, sub, ms = 2500) {
    showGameMsg(title, sub, 'ok');
    clearTimeout(gameMsgTimer);
    gameMsgTimer = setTimeout(hideGameMsg, ms);
  },
  hideMessage() { hideGameMsg(); },
  endGame(score, win) { gameMgr.end(score, win); },
  onStart(def) {
    lastGameId = def.id;
    if (el.gameHud) el.gameHud.classList.add('on');
    gameEngine.setScore(0);
  },
  onStop() {
    if (el.gameHud) el.gameHud.classList.remove('on');
  },
  onEnd(def, score, win) {
    if (el.gameHud) el.gameHud.classList.remove('on');
    if (score == null) { hideGameMsg(); return; } /* user aborted */
    if (win) Sound.win(); else Sound.fail();
    showGameMsg(
      win ? '🎉 You win!' : 'Game over',
      `${def.name} · Score: ${score}`,
      'end'
    );
  }
};

const gameMgr = new GameManager(gameEngine);
gameMgr.registerAll([balloonPop, motionCatch, facePong, freezePose]);

/* ============================ init ============================ */
function init() {
  el.stage = $('#camera-stage');
  el.canvas = $('#stage-canvas');
  display = el.canvas;
  dctx = display.getContext('2d');

  el.startOverlay = $('#stage-overlay');
  el.startBtn = $('#start-btn');
  el.stageError = $('#stage-error');
  el.stageErrorMsg = $('#stage-error-msg');
  el.stageRetry = $('#stage-retry');
  el.fpsBadge = $('#fps-badge');
  el.recBadge = $('#rec-badge');
  el.btnRecord = $('#btn-record');
  el.cameraSelect = $('#camera-select');
  el.faceBadge = $('#face-badge');
  el.flash = $('#flash');
  el.categoryTabs = $('#category-tabs');
  el.filterGrid = $('#filter-grid');
  el.panelHint = $('#panel-hint');
  el.intensity = $('#intensity');
  el.gameHud = $('#game-hud');
  el.hudScore = $('#hud-score');
  el.gameMsg = $('#game-msg');
  el.gameMsgTitle = $('#game-msg-title');
  el.gameMsgSub = $('#game-msg-sub');
  el.gameMsgActions = $('#game-msg-actions');
  el.gamesGrid = $('#games-grid');
  el.galleryDrawer = $('#gallery-drawer');
  el.galleryGrid = $('#gallery-grid');
  el.helpModal = $('#help-modal');
  el.settingsModal = $('#settings-modal');
  el.settingsForm = $('#camera-settings-form');
  el.cameraSaveConfirm = $('#camera-save-confirm');
  el.prefCameraSelect = $('#pref-camera-select');
  el.prefResolution = $('#pref-resolution');
  el.prefTimer = $('#pref-timer');
  el.prefPhotoFormat = $('#pref-photo-format');
  el.prefMirror = $('#pref-mirror');
  el.prefSound = $('#pref-sound');

  /* Mobile native app controls & HUD elements */
  el.cameraHudTop = $('#camera-hud-top');
  el.hudBtnFlip = $('#hud-btn-flip');
  el.hudBtnMirror = $('#hud-btn-mirror');
  el.hudBtnSound = $('#hud-btn-sound');
  el.hudBtnSettings = $('#hud-btn-settings');
  el.hudBtnFullscreen = $('#hud-btn-fullscreen');
  el.mobileControlsDeck = $('#mobile-controls-deck');
  el.modePhoto = $('#mode-photo');
  el.modeVideo = $('#mode-video');
  el.mobileFilterCarousel = $('#mobile-filter-carousel');
  el.btnMobileGallery = $('#btn-mobile-gallery');
  el.mobileGalleryPreview = $('#mobile-gallery-preview');
  el.btnMobileShutter = $('#btn-mobile-shutter');
  el.btnMobileEffects = $('#btn-mobile-effects');
  el.btnMobileFlip = $('#btn-mobile-flip');
  el.effectsPanel = $('#effects-panel');
  el.sheetBackdrop = $('#sheet-backdrop');
  el.btnCloseEffectsSheet = $('#btn-close-effects-sheet');
  el.mobileBottomNav = $('#mobile-bottom-nav');
  el.mbNavCamera = $('#mb-nav-camera');
  el.mbNavGames = $('#mb-nav-games');
  el.mbNavGallery = $('#mb-nav-gallery');

  /* On-Camera Countdown & Photo Booth Collage Elements */
  el.cameraCountdown = $('#camera-countdown');
  el.countdownNum = $('#countdown-num');
  el.countdownCaption = $('#countdown-caption');
  el.cdMeter = $('#cd-meter');

  el.collageHud = $('#collage-hud');
  el.collageHudStep = $('#collage-hud-step');
  el.collageHudThumbs = $('#collage-hud-thumbs');
  el.btnCancelCollage = $('#btn-cancel-collage');

  el.btnCollage = $('#btn-collage');
  el.selectCollagePoses = $('#select-collage-poses');
  el.modeCollage = $('#mode-collage');
  el.mobileCollageSelector = $('#mobile-collage-selector');

  el.collageModal = $('#collage-modal');
  el.btnCloseCollageModal = $('#btn-close-collage-modal');
  el.collagePreviewImg = $('#collage-preview-img');
  el.collageThemeButtons = $('#collage-theme-buttons');
  el.btnDownloadCollage = $('#btn-download-collage');
  el.btnGdriveCollage = $('#btn-gdrive-collage');
  el.btnShareCollage = $('#btn-share-collage');
  el.btnCopyCollage = $('#btn-copy-collage');
  el.btnRetakeCollage = $('#btn-retake-collage');

  camera.attach(el.stage);
  camera.mirror = settings.mirror !== false;

  Sound.enabled = settings.sound !== false;
  updateMirrorUI();
  updateSoundBtn();

  if (el.intensity) {
    el.intensity.value = settings.intensity ?? 100;
    manager.intensity = (settings.intensity ?? 100) / 100;
  }

  buildCategoryTabs();
  buildFilterGrid();
  buildMobileCarousel();
  buildGameCards();
  renderGallery(gallery.items);
  wireEvents();
  readHash();

  if (!storage.get('wc_visited', false)) {
    storage.set('wc_visited', true);
    setTimeout(() => toast('Tip: press C to capture, R for a random effect 😉', 4200), 2600);
  }

  requestAnimationFrame(loop);
  tryAutostart();
}

async function tryAutostart() {
  try {
    if (navigator.permissions && navigator.permissions.query) {
      const st = await navigator.permissions.query({ name: 'camera' });
      if (st && st.state === 'granted') startCamera();
    }
  } catch { /* permission API unsupported — wait for the button */ }
}

function saveSettings() {
  settings.effect = manager.current ? manager.current.id : 'normal';
  settings.mirror = camera.mirror;
  settings.sound = Sound.enabled;
  settings.intensity = Math.round(manager.intensity * 100);
  storage.set('wc_settings', settings);
}

async function startCamera() {
  if (camera.active) return;
  el.startBtn.disabled = true;
  el.startBtn.textContent = '⏳ Starting camera…';
  try {
    await camera.start();
    display.width = camera.width;
    display.height = camera.height;
    running = true;
    lastNow = 0;
    el.startOverlay.style.display = 'none';
    el.stageError.style.display = 'none';
    if (el.fpsBadge) el.fpsBadge.style.display = '';
    await updateCameraSelectUI();
    setEffect(settings.effect || 'normal', { save: false });
    if (pendingGame) { startGame(pendingGame); pendingGame = null; }
    Sound.pop();
  } catch (err) {
    el.startBtn.disabled = false;
    el.startBtn.textContent = '🎥 Enable my camera';
    el.stageError.style.display = 'flex';
    el.stageErrorMsg.textContent = friendlyCameraError(err);
  }
}

async function updateCameraSelectUI() {
  if (!el.cameraSelect) return;
  const devices = await camera.listDevices();
  if (devices && devices.length > 1) {
    el.cameraSelect.innerHTML = '';
    const currentId = camera.getCurrentDeviceId();
    devices.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${idx + 1}`;
      if (d.deviceId === currentId) opt.selected = true;
      el.cameraSelect.appendChild(opt);
    });
    el.cameraSelect.style.display = 'inline-block';
  } else {
    el.cameraSelect.style.display = 'none';
  }
}

/* ============================ render loop ============================ */
function loop(now) {
  requestAnimationFrame(loop);
  if (!camera.active) return;

  const dt = clamp(lastNow ? now - lastNow : 16.7, 0, 80);
  lastNow = now;

  const src = camera.grabFrame();
  if (!src) return;

  if (display.width !== camera.width || display.height !== camera.height) {
    display.width = camera.width;
    display.height = camera.height;
  }

  motion.update(src);

  const faceWanted = manager.requiresFace || gameMgr.needsFace;
  if (faceWanted) {
    ensureTrackerBase();
    tracker.detect(src);
  }

  const frame = {
    src,
    width: camera.width,
    height: camera.height,
    time: now,
    dt,
    face: tracker,
    motion,
    camera
  };

  if (gameMgr.active) {
    dctx.drawImage(src, 0, 0);
    gameMgr.update(dt, frame);
    gameMgr.render(dctx, frame);
  } else {
    manager.render(dctx, frame);
  }

  /* FPS badge (throttled by the meter itself) */
  const fps = fpsMeter.tick(now);
  if (fps && el.fpsBadge) el.fpsBadge.textContent = `${fps} fps`;

  /* face badge ~4x/second */
  badgeTick = (badgeTick + 1) % 15;
  if (badgeTick === 0) updateFaceBadge();
}

function ensureTrackerBase() {
  if (!tracker.loadedBase && !tracker._loadingBase) {
    tracker.ensureBase().catch(() => {});
  }
}

/* ============================ face status ============================ */
function onFaceStatus(status, err) {
  if (status === 'error' && err) {
    console.warn('[WebcamClicks] face detection failed:', err);
  }
}

function updateFaceBadge() {
  if (!el.faceBadge) return;
  const relevant = manager.requiresFace || gameMgr.needsFace;
  if (!relevant) { el.faceBadge.style.display = 'none'; return; }
  el.faceBadge.style.display = '';
  if (tracker.status === 'error') {
    el.faceBadge.textContent = '⚠️ Face detection unavailable — check your connection';
    el.faceBadge.className = 'badge err';
  } else if (!tracker.loadedBase) {
    el.faceBadge.textContent = '🧠 Loading face detection…';
    el.faceBadge.className = 'badge warn';
  } else if (tracker.hasFace) {
    el.faceBadge.textContent = '🙂 Face detected';
    el.faceBadge.className = 'badge ok';
  } else {
    el.faceBadge.textContent = '🎯 Center your face in the frame';
    el.faceBadge.className = 'badge warn';
  }
}

/* ============================ effects UI ============================ */
function categories() {
  return ['All', 'Favorites', ...manager.categories()];
}

function buildCategoryTabs() {
  if (!el.categoryTabs) return;
  el.categoryTabs.innerHTML = '';
  for (const cat of categories()) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.dataset.category = cat;
    btn.textContent = cat === 'Favorites' ? '⭐ Favorites' : cat;
    if (cat === currentCategory) btn.classList.add('active');
    btn.addEventListener('click', () => {
      currentCategory = cat;
      buildCategoryTabs();
      buildFilterGrid();
      Sound.click();
    });
    el.categoryTabs.appendChild(btn);
  }
}

function buildFilterGrid() {
  if (!el.filterGrid) return;
  el.filterGrid.innerHTML = '';
  let list = manager.list();
  if (currentCategory === 'Favorites') list = list.filter((e) => favs.has(e.id));
  else if (currentCategory !== 'All') list = list.filter((e) => e.category === currentCategory);

  if (!list.length) {
    const p = document.createElement('p');
    p.className = 'panel-hint';
    p.style.gridColumn = '1 / -1';
    p.textContent = currentCategory === 'Favorites'
      ? 'No favorites yet — tap the ☆ on any filter to save it here.'
      : 'Nothing in this category.';
    el.filterGrid.appendChild(p);
    return;
  }

  for (const effect of list) {
    const tile = document.createElement('button');
    tile.type = 'button';
    tile.className = 'filter-tile';
    tile.dataset.id = effect.id;
    tile.setAttribute('aria-label', `${effect.name} effect`);
    if (manager.current && manager.current.id === effect.id) tile.classList.add('selected');

    const icon = document.createElement('span');
    icon.className = 'ft-icon';
    icon.textContent = effect.icon || '✨';

    const name = document.createElement('span');
    name.className = 'ft-name';
    name.textContent = effect.name;

    const fav = document.createElement('span');
    fav.className = 'ft-fav' + (favs.has(effect.id) ? ' on' : '');
    fav.textContent = favs.has(effect.id) ? '★' : '☆';
    fav.setAttribute('role', 'button');
    fav.setAttribute('aria-label', `Toggle favorite for ${effect.name}`);
    fav.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleFav(effect.id);
    });

    tile.append(fav, icon, name);
    tile.addEventListener('click', () => {
      setEffect(effect.id);
      Sound.click();
    });
    el.filterGrid.appendChild(tile);
  }
}

function buildMobileCarousel() {
  if (!el.mobileFilterCarousel) return;
  el.mobileFilterCarousel.innerHTML = '';
  const list = manager.list();
  for (const eff of list) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'carousel-item';
    btn.dataset.id = eff.id;
    btn.setAttribute('aria-label', `${eff.name} effect`);
    if (manager.current && manager.current.id === eff.id) btn.classList.add('active');

    const iconDiv = document.createElement('div');
    iconDiv.className = 'carousel-icon';
    iconDiv.textContent = eff.icon || '✨';

    const nameSpan = document.createElement('span');
    nameSpan.className = 'carousel-name';
    nameSpan.textContent = eff.name;

    btn.append(iconDiv, nameSpan);
    btn.addEventListener('click', () => {
      setEffect(eff.id, { scrollCarousel: true });
      Sound.click();
      if (navigator.vibrate) try { navigator.vibrate(20); } catch {}
    });
    el.mobileFilterCarousel.appendChild(btn);
  }
}

function setEffect(id, opts = {}) {
  const effect = manager.get(id);
  if (!effect) return;
  manager.set(id);
  const tiles = el.filterGrid ? el.filterGrid.querySelectorAll('.filter-tile') : [];
  tiles.forEach((t) => t.classList.toggle('selected', t.dataset.id === id));

  /* Sync mobile horizontal carousel */
  const carouselItems = el.mobileFilterCarousel ? el.mobileFilterCarousel.querySelectorAll('.carousel-item') : [];
  carouselItems.forEach((ci) => {
    const isCur = ci.dataset.id === id;
    ci.classList.toggle('active', isCur);
    if (isCur && opts.scrollCarousel !== false) {
      ci.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });

  /* load ML models on demand for face effects */
  if (effect.requiresFace) {
    ensureTrackerBase();
    if (effect.needsExpressions) tracker.ensureExpressions().catch(() => {});
    if (effect.needsAge) tracker.ensureAge().catch(() => {});
    updateFaceBadge();
  } else {
    updateFaceBadge();
  }

  if (opts.save !== false) {
    updateHashEffect(id);
    saveSettings();
  }
}

function toggleFav(id) {
  if (!id) return;
  if (favs.has(id)) favs.delete(id); else favs.add(id);
  storage.set('wc_favs', [...favs]);
  buildFilterGrid();
}

function randomEffect() {
  const list = manager.list().filter((e) => e.id !== 'normal');
  const e = list[rand(0, list.length - 1) | 0];
  if (e) {
    setEffect(e.id);
    toast(`${e.icon} ${e.name}`);
  }
}

/* ============================ capture, recording & gallery ============================ */
function formatTime(ms) {
  const totalSec = Math.floor(ms / 1000);
  const mins = Math.floor(totalSec / 60);
  const secs = totalSec % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

function updateRecordUI(recording, elapsedMs = 0) {
  const btn = el.btnRecord || $('#btn-record');
  const badge = el.recBadge || $('#rec-badge');
  const mobShutter = el.btnMobileShutter || $('#btn-mobile-shutter');
  if (btn) {
    if (recording) {
      btn.classList.add('recording');
      btn.innerHTML = `⏹️ <span class="tool-label">Stop (${formatTime(elapsedMs)})</span> <span class="kbd">V</span>`;
      if (badge) {
        badge.style.display = 'inline-block';
        badge.textContent = `REC ${formatTime(elapsedMs)}`;
      }
    } else {
      btn.classList.remove('recording');
      btn.innerHTML = `⏺️ <span class="tool-label">Record</span> <span class="kbd">V</span>`;
      if (badge) badge.style.display = 'none';
    }
  }
  if (mobShutter) {
    mobShutter.classList.toggle('is-recording', recording);
    mobShutter.classList.toggle('video-mode', mobileMode === 'video' || recording);
  }
}

async function toggleRecord() {
  if (!camera.active) {
    toast('🎥 Enable the camera first to record video');
    return;
  }
  if (isRecording) {
    await stopRecording();
  } else {
    await startRecording();
  }
}

async function startRecording() {
  if (isRecording) return;
  if (!display) display = el.canvas || $('#stage-canvas');
  if (!recorder) {
    recorder = new Recorder(display);
  }
  if (!recorder.supported) {
    toast('⚠️ Video recording is not supported in this browser');
    return;
  }

  recorder.onTick = (elapsedMs) => {
    updateRecordUI(true, elapsedMs);
  };

  const started = recorder.start(30);
  if (!started) {
    toast('⚠️ Could not start video recording');
    return;
  }

  isRecording = true;
  updateRecordUI(true, 0);
  Sound.pop();
  toast('⏺️ Recording started (max 60 seconds)');
}

async function stopRecording() {
  if (!isRecording || !recorder) return;
  isRecording = false;
  updateRecordUI(false);
  toast('⏳ Processing video...');

  try {
    const clip = await recorder.stop();
    if (clip && clip.blob) {
      Sound.pop();
      gallery.addVideo({
        id: `${Date.now()}-${Math.round(Math.random() * 1e5)}`,
        url: clip.url,
        blob: clip.blob,
        filename: clip.filename,
        ts: Date.now(),
        effect: manager.currentName || 'Normal'
      });
      toast('🎬 Video recorded! Saved to Gallery.');
    } else {
      toast('⚠️ Recording was empty or cancelled');
    }
  } catch (err) {
    console.error('Record stop error:', err);
    toast('⚠️ Could not save video');
  }
}

/**
 * Performs a cinematic on-camera countdown overlay directly inside #camera-stage.
 * @param {number} seconds - Number of seconds (e.g. 3, 5, 10).
 * @param {string} caption - Optional text caption (e.g. "POSE 1 OF 4", "GET READY").
 * @returns {Promise<boolean>} Resolves true when finished, false if aborted.
 */
async function runCameraCountdown(seconds = 3, caption = 'GET READY') {
  const overlay = el.cameraCountdown || $('#camera-countdown');
  const numEl = el.countdownNum || $('#countdown-num');
  const captionEl = el.countdownCaption || $('#countdown-caption');
  const meterEl = el.cdMeter || $('#cd-meter');
  if (!overlay || !numEl) return true;

  overlay.style.display = 'flex';
  if (captionEl) captionEl.textContent = caption;

  const circumference = 427.26;
  countdownActive = true;

  for (let i = seconds; i > 0; i--) {
    if (cancelCollageRequested) {
      overlay.style.display = 'none';
      countdownActive = false;
      return false;
    }
    numEl.classList.remove('smile');
    numEl.textContent = String(i);
    if (meterEl) {
      meterEl.style.transition = 'none';
      meterEl.style.strokeDashoffset = '0';
      void meterEl.offsetWidth;
      meterEl.style.transition = 'stroke-dashoffset 0.95s linear';
      meterEl.style.strokeDashoffset = String(circumference);
    }
    Sound.countdownTick(i);
    await new Promise(r => setTimeout(r, 1000));
  }

  if (cancelCollageRequested) {
    overlay.style.display = 'none';
    countdownActive = false;
    return false;
  }

  numEl.classList.add('smile');
  numEl.textContent = 'SMILE! 😄';
  Sound.countdownGo();
  await new Promise(r => setTimeout(r, 380));

  overlay.style.display = 'none';
  countdownActive = false;
  return true;
}

async function capture() {
  if (!camera.active) { toast('🎥 Enable the camera first'); return; }
  if (countdownActive || collageActive) return;

  const timerSecs = settings.timer ? parseInt(settings.timer, 10) : 0;
  if (timerSecs > 0) {
    const ok = await runCameraCountdown(timerSecs, 'SMILE FOR THE CAMERA');
    if (!ok) return;
  }

  Sound.shutter();
  if (el.flash) {
    el.flash.classList.remove('go');
    void el.flash.offsetWidth; /* restart animation */
    el.flash.classList.add('go');
  }
  const item = gallery.captureFrom(display, manager.currentName || 'Normal');
  if (item) toast('📸 Saved to your gallery — it never leaves this device');
}

async function startCollageShoot(poseCount = 4) {
  if (!camera.active) {
    toast('🎥 Enable the camera first');
    return;
  }
  if (countdownActive || collageActive || isRecording) return;

  collageActive = true;
  cancelCollageRequested = false;
  collagePoses = [];
  collagePoseCount = parseInt(poseCount, 10) || 4;

  // Setup Collage HUD
  if (el.collageHud) {
    el.collageHud.style.display = 'flex';
    if (el.collageHudStep) el.collageHudStep.textContent = `Pose 1 of ${collagePoseCount}`;
    if (el.collageHudThumbs) {
      el.collageHudThumbs.innerHTML = '';
      for (let i = 0; i < collagePoseCount; i++) {
        const slot = document.createElement('div');
        slot.className = 'hud-thumb-slot';
        slot.id = `hud-slot-${i}`;
        slot.textContent = `#${i + 1}`;
        el.collageHudThumbs.appendChild(slot);
      }
    }
  }

  toast(`🎞️ Photo Booth Started: ${collagePoseCount} Poses! Strike your first pose!`, 3200);

  for (let p = 0; p < collagePoseCount; p++) {
    if (cancelCollageRequested) break;

    if (el.collageHudStep) {
      el.collageHudStep.textContent = `Pose ${p + 1} of ${collagePoseCount}`;
    }

    // 3-second on-camera countdown for each pose
    const ok = await runCameraCountdown(3, `POSE ${p + 1} OF ${collagePoseCount}`);
    if (!ok || cancelCollageRequested) break;

    // Flash + Shutter sound
    Sound.shutter();
    if (el.flash) {
      el.flash.classList.remove('go');
      void el.flash.offsetWidth;
      el.flash.classList.add('go');
    }

    // Capture high-res snapshot of current display canvas
    const snap = makeCanvas(display.width, display.height);
    const sctx = snap.getContext('2d');
    sctx.drawImage(display, 0, 0);
    collagePoses.push(snap);

    // Fill thumb slot
    const slotEl = $(`#hud-slot-${p}`);
    if (slotEl) {
      slotEl.classList.add('filled');
      slotEl.innerHTML = `<img src="${snap.toDataURL('image/jpeg', 0.8)}" alt="Pose ${p + 1}">`;
    }

    // If not the final pose, give user a brief 1.2s break to see their snapshot & prepare next pose
    if (p < collagePoseCount - 1) {
      await new Promise(r => setTimeout(r, 1200));
    }
  }

  if (cancelCollageRequested || collagePoses.length < collagePoseCount) {
    abortCollageShoot();
    return;
  }

  // Final celebration & assembly
  Sound.motorPrint();
  Sound.win();
  if (el.collageHud) el.collageHud.style.display = 'none';
  collageActive = false;

  finishCollageShoot();
}

function abortCollageShoot() {
  cancelCollageRequested = true;
  collageActive = false;
  if (el.cameraCountdown) el.cameraCountdown.style.display = 'none';
  if (el.collageHud) el.collageHud.style.display = 'none';
  collagePoses = [];
  toast('✕ Photo Booth cancelled');
}

function finishCollageShoot() {
  currentCollageResult = generateCollage(collagePoses, {
    theme: collageTheme,
    title: 'WEBCAMCLICKS PHOTO BOOTH'
  });

  // Add to gallery
  gallery.addPhoto(currentCollageResult.dataUrl, `Photo Booth (${collagePoses.length} Poses)`);

  // Display in Modal
  openCollageModal();
  toast('🎉 Photo Booth Collage Complete! Saved to your gallery.', 4000);
}

function openCollageModal() {
  if (!el.collageModal || !currentCollageResult) return;
  if (el.collagePreviewImg) el.collagePreviewImg.src = currentCollageResult.dataUrl;

  // Sync theme buttons
  if (el.collageThemeButtons) {
    const pills = el.collageThemeButtons.querySelectorAll('.theme-pill');
    pills.forEach(p => p.classList.toggle('active', p.dataset.theme === collageTheme));
  }

  el.collageModal.classList.add('on');
}

function closeCollageModal() {
  if (el.collageModal) el.collageModal.classList.remove('on');
}

function setCollageTheme(themeKey) {
  if (!COLLAGE_THEMES[themeKey] || !collagePoses.length) return;
  collageTheme = themeKey;
  currentCollageResult = generateCollage(collagePoses, {
    theme: collageTheme,
    title: 'WEBCAMCLICKS PHOTO BOOTH'
  });
  if (el.collagePreviewImg) el.collagePreviewImg.src = currentCollageResult.dataUrl;
  if (el.collageThemeButtons) {
    const pills = el.collageThemeButtons.querySelectorAll('.theme-pill');
    pills.forEach(p => p.classList.toggle('active', p.dataset.theme === collageTheme));
  }
  Sound.click();
}

async function saveCollageToGoogleDrive() {
  if (!currentCollageResult) return;
  Sound.pop();
  const filename = `webcamclicks-photobooth-${timestamp()}.jpg`;
  const file = dataUrlToFile(currentCollageResult.dataUrl, filename);

  // Try native Web Share (Android & iOS show Google Drive directly)
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My WebcamClicks Photo Booth Collage',
        text: 'Created with WebcamClicks Photo Booth! Save to Google Drive or share with friends.'
      });
      return;
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) {
        /* User dismissed share sheet - continue to web fallback */
      }
    }
  }

  // Desktop / Web Fallback: download file and open Google Drive in new tab
  downloadDataUrl(currentCollageResult.dataUrl, filename);
  window.open('https://drive.google.com/drive/u/0/my-drive', '_blank', 'noopener,noreferrer');
  toast('☁️ Collage downloaded! Drag it into Google Drive to save permanently.', 6000);
}

async function shareCollageOnline() {
  if (!currentCollageResult) return;
  Sound.pop();
  const res = await shareImage(currentCollageResult.dataUrl);
  if (res === 'downloaded') {
    toast('📤 Native sharing not available — downloaded instead');
  } else if (res === 'shared') {
    toast('🎉 Shared successfully!');
  }
}

async function copyCollageToClipboard() {
  if (!currentCollageResult) return;
  Sound.pop();
  const ok = await copyImage(currentCollageResult.dataUrl);
  toast(ok ? '📋 Collage copied to clipboard!' : '📋 Copying not supported on this device');
}

async function openSettingsModal() {
  if (!el.settingsModal) return;
  if (el.prefCameraSelect) {
    const devices = await camera.listDevices();
    el.prefCameraSelect.innerHTML = '<option value="">Default Camera</option>';
    const currentId = camera.getCurrentDeviceId() || settings.deviceId || '';
    devices.forEach((d, idx) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${idx + 1}`;
      if (d.deviceId === currentId) opt.selected = true;
      el.prefCameraSelect.appendChild(opt);
    });
  }
  if (el.prefResolution) el.prefResolution.value = settings.resolution || '1280x720';
  if (el.prefTimer) el.prefTimer.value = String(settings.timer || 0);
  if (el.prefPhotoFormat) el.prefPhotoFormat.value = settings.photoFormat || 'image/jpeg';
  if (el.prefMirror) el.prefMirror.value = String(camera.mirror !== false);
  if (el.prefSound) el.prefSound.value = String(Sound.enabled !== false);
  el.settingsModal.classList.add('on');
}

function closeSettingsModal() {
  if (el.settingsModal) el.settingsModal.classList.remove('on');
}

async function onSaveCameraSettings(e) {
  if (e) e.preventDefault();
  if (el.prefCameraSelect) {
    const chosenDev = el.prefCameraSelect.value;
    settings.deviceId = chosenDev;
    if (chosenDev && camera.active && chosenDev !== camera.getCurrentDeviceId()) {
      try {
        await camera.switchDevice(chosenDev);
        display.width = camera.width;
        display.height = camera.height;
        await updateCameraSelectUI();
      } catch (err) {
        console.warn('Switch device err:', err);
      }
    }
  }
  if (el.prefResolution) settings.resolution = el.prefResolution.value;
  if (el.prefTimer) settings.timer = parseInt(el.prefTimer.value, 10) || 0;
  if (el.prefPhotoFormat) settings.photoFormat = el.prefPhotoFormat.value;
  if (el.prefMirror) {
    settings.mirror = el.prefMirror.value === 'true';
    camera.mirror = settings.mirror;
    setToolActive('#btn-mirror', camera.mirror);
  }
  if (el.prefSound) {
    settings.sound = el.prefSound.value === 'true';
    Sound.enabled = settings.sound;
    setToolActive('#btn-sound', Sound.enabled);
    updateSoundBtn();
  }
  saveSettings();
  if (el.cameraSaveConfirm) {
    const timeStr = new Date().toLocaleTimeString();
    el.cameraSaveConfirm.textContent = `✅ Details Saved Successfully! (${timeStr})`;
    el.cameraSaveConfirm.style.display = 'inline-flex';
    setTimeout(() => {
      if (el.cameraSaveConfirm) el.cameraSaveConfirm.style.display = 'none';
    }, 4000);
  }
  Sound.pop();
}

function renderGallery(items) {
  updateMobileGalleryPreview(items);
  if (!el.galleryGrid) return;
  el.galleryGrid.innerHTML = '';
  if (!items.length) {
    const p = document.createElement('p');
    p.className = 'gallery-empty';
    p.textContent = 'No photos yet. Press 📸 Capture — your photos stay on this device only.';
    el.galleryGrid.appendChild(p);
    return;
  }
  for (const item of items) {
    const div = document.createElement('div');
    div.className = 'gallery-item';

    let media;
    if (item.kind === 'video' && item.url) {
      media = document.createElement('video');
      media.src = item.url;
      media.controls = true;
      media.playsInline = true;
      media.preload = 'metadata';
    } else {
      media = document.createElement('img');
      media.src = item.dataUrl;
      media.loading = 'lazy';
    }
    media.alt = item.kind === 'video'
      ? `Webcam recording with the ${item.effect} effect`
      : `Webcam photo with the ${item.effect} effect`;

    const actions = document.createElement('div');
    actions.className = 'gi-actions';

    const mkBtn = (label, title, fn) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = label;
      b.title = title;
      b.addEventListener('click', fn);
      return b;
    };

    actions.append(
      mkBtn('⬇️', item.kind === 'video' ? 'Download this video' : 'Download this photo', () => {
        gallery.download(item);
        toast('⬇️ Downloading…');
      }),
      mkBtn('📤', item.kind === 'video' ? 'Share this video' : 'Share this photo', async () => {
        const res = item.kind === 'video'
          ? await shareVideoBlob(item.blob, item.filename)
          : await shareImage(item.dataUrl);
        if (res === 'downloaded') toast('📤 Sharing not available — downloaded instead');
      }),
      mkBtn('🗑️', item.kind === 'video' ? 'Delete this video' : 'Delete this photo', () => {
        gallery.remove(item.id);
        toast('🗑️ Deleted');
      })
    );

    if (item.kind === 'photo' || !item.kind) {
      actions.insertBefore(mkBtn('📋', 'Copy to clipboard', async () => {
        const ok = await copyImage(item.dataUrl);
        toast(ok ? '📋 Copied to clipboard' : '📋 Copying is not supported here');
      }), actions.lastChild);
    }

    div.append(media, actions);
    el.galleryGrid.appendChild(div);
  }
}

function openGallery() {
  if (el.galleryDrawer) el.galleryDrawer.classList.add('on');
}

function closeGallery() {
  if (el.galleryDrawer) el.galleryDrawer.classList.remove('on');
}

/* ============================ games UI ============================ */
function buildGameCards() {
  if (!el.gamesGrid) return;
  el.gamesGrid.innerHTML = '';
  for (const g of gameMgr.list()) {
    const card = document.createElement('article');
    card.className = 'game-card';
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Play ${g.name}`);

    const icon = document.createElement('div');
    icon.className = 'gc-icon';
    icon.textContent = g.icon;

    const h3 = document.createElement('h3');
    h3.textContent = g.name;

    const p = document.createElement('p');
    p.textContent = g.description;

    const play = document.createElement('span');
    play.className = 'gc-play';
    play.textContent = '▶ Play now';

    card.append(icon, h3, p, play);
    const go = () => startGame(g.id);
    card.addEventListener('click', go);
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); go(); }
    });
    el.gamesGrid.appendChild(card);
  }
}

function startGame(id) {
  const def = gameMgr.get(id);
  if (!def) return;
  if (!camera.active) {
    pendingGame = id;
    toast('🎥 Enable the camera to play');
    startCamera();
    return;
  }
  const stage = $('#camera');
  if (stage && stage.scrollIntoView) stage.scrollIntoView({ behavior: 'smooth', block: 'start' });
  Sound.click();
  gameMgr.start(id);
  if (gameMgr.needsFace) ensureTrackerBase();
}

function exitGame() {
  if (gameMgr.active) gameMgr.abort();
}

function randomGame() {
  const list = gameMgr.list();
  const g = list[rand(0, list.length - 1) | 0];
  if (g) startGame(g.id);
}

function showGameMsg(title, sub, mode) {
  if (!el.gameMsg) return;
  el.gameMsgTitle.textContent = title;
  el.gameMsgSub.textContent = sub;
  el.gameMsgActions.style.display = mode === 'end' ? 'flex' : 'none';
  el.gameMsg.classList.add('on');
}

function hideGameMsg() {
  if (el.gameMsg) el.gameMsg.classList.remove('on');
}

/* ============================ events & helpers ============================ */
function setToolActive(sel, on) {
  const n = $(sel);
  if (n) n.classList.toggle('active', !!on);
}

function updateMirrorUI() {
  setToolActive('#btn-mirror', camera.mirror);
  const hudMirror = $('#hud-btn-mirror');
  if (hudMirror) hudMirror.classList.toggle('active', camera.mirror);
}

function updateSoundBtn() {
  const b = $('#btn-sound');
  if (b) {
    b.classList.toggle('active', Sound.enabled);
    const icon = b.querySelector('.tool-icon');
    if (icon) icon.textContent = Sound.enabled ? '🔊' : '🔇';
  }
  const hudSound = $('#hud-btn-sound');
  if (hudSound) {
    hudSound.textContent = Sound.enabled ? '🔊' : '🔇';
    hudSound.classList.toggle('active', Sound.enabled);
  }
}

function updateMobileGalleryPreview(items) {
  const preview = el.mobileGalleryPreview || $('#mobile-gallery-preview');
  if (!preview) return;
  if (items && items.length > 0) {
    const latest = items[0];
    if (latest.dataUrl) {
      preview.innerHTML = `<img src="${latest.dataUrl}" alt="Latest snap">`;
      return;
    }
  }
  preview.innerHTML = '🖼️';
}

function openEffectsSheet() {
  if (el.effectsPanel) el.effectsPanel.classList.add('open-sheet');
  if (el.sheetBackdrop) el.sheetBackdrop.classList.add('on');
}

function closeEffectsSheet() {
  if (el.effectsPanel) el.effectsPanel.classList.remove('open-sheet');
  if (el.sheetBackdrop) el.sheetBackdrop.classList.remove('on');
}

function setMobileMode(mode) {
  mobileMode = mode;
  if (el.modePhoto) {
    el.modePhoto.classList.toggle('active', mode === 'photo');
    el.modePhoto.setAttribute('aria-selected', mode === 'photo');
  }
  if (el.modeCollage) {
    el.modeCollage.classList.toggle('active', mode === 'collage');
    el.modeCollage.setAttribute('aria-selected', mode === 'collage');
  }
  if (el.modeVideo) {
    el.modeVideo.classList.toggle('active', mode === 'video');
    el.modeVideo.setAttribute('aria-selected', mode === 'video');
  }
  if (el.mobileCollageSelector) {
    el.mobileCollageSelector.style.display = mode === 'collage' ? 'flex' : 'none';
  }
  const mobShutter = el.btnMobileShutter || $('#btn-mobile-shutter');
  if (mobShutter) {
    mobShutter.classList.toggle('video-mode', mode === 'video');
    mobShutter.classList.toggle('collage-mode', mode === 'collage');
    mobShutter.setAttribute('aria-label',
      mode === 'video' ? 'Record video' :
      mode === 'collage' ? `Start ${collagePoseCount}-pose photo booth collage` :
      'Take photo'
    );
  }
  Sound.click();
}

async function onMobileShutter() {
  if (navigator.vibrate) try { navigator.vibrate(25); } catch {}
  if (mobileMode === 'video') {
    await toggleRecord();
  } else if (mobileMode === 'collage') {
    await startCollageShoot(collagePoseCount);
  } else {
    await capture();
  }
}

function favCurrent() {
  if (!manager.current) return;
  toggleFav(manager.current.id);
  toast(favs.has(manager.current.id) ? '⭐ Added to favorites' : '☆ Removed from favorites');
}

function toggleFullscreen() {
  try {
    if (!document.fullscreenElement) {
      const req = el.stage.requestFullscreen && el.stage.requestFullscreen();
      if (req && req.catch) req.catch(() => toast('Fullscreen is not available'));
    } else if (document.exitFullscreen) {
      document.exitFullscreen();
    }
  } catch { toast('Fullscreen is not available'); }
}

function readHash() {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const eff = params.get('effect');
  const game = params.get('game');
  if (eff && manager.get(eff)) setEffect(eff, { save: true });
  if (game && gameMgr.get(game)) {
    if (camera.active) startGame(game);
    else pendingGame = game;
  }
}

function updateHashEffect(id) {
  try { history.replaceState(null, '', `#effect=${id}`); } catch { /* ignore */ }
}

function onKeyDown(e) {
  if (e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
  const k = e.key.toLowerCase();
  if (k === 'c') { capture(); return; }
  if (k === 'v') { toggleRecord(); return; }
  if (k === 'r') { randomEffect(); return; }
  if (k === 'f') { favCurrent(); return; }
  if (k === 'm') {
    camera.toggleMirror();
    updateMirrorUI();
    saveSettings();
    toast(camera.mirror ? '🪞 Mirror on' : '🪞 Mirror off');
    return;
  }
  if (k === 'g') { randomGame(); return; }
  if (k === 'escape') {
    if (collageActive) { abortCollageShoot(); return; }
    if (el.collageModal && el.collageModal.classList.contains('on')) { closeCollageModal(); return; }
    if (gameMgr.active) { exitGame(); return; }
    if (el.helpModal) el.helpModal.classList.remove('on');
    if (el.settingsModal) el.settingsModal.classList.remove('on');
    closeGallery();
    closeEffectsSheet();
  }
}

function wireEvents() {
  const on = (sel, ev, fn) => {
    const n = $(sel);
    if (n) n.addEventListener(ev, fn);
  };

  on('#start-btn', 'click', startCamera);
  on('#stage-retry', 'click', startCamera);

  /* Desktop Toolbar */
  on('#btn-capture', 'click', capture);
  on('#btn-collage', 'click', () => {
    const poses = el.selectCollagePoses ? parseInt(el.selectCollagePoses.value, 10) : 4;
    startCollageShoot(poses);
  });
  on('#select-collage-poses', 'change', (e) => {
    collagePoseCount = parseInt(e.target.value, 10) || 4;
  });
  on('#btn-record', 'click', toggleRecord);
  on('#btn-random', 'click', randomEffect);
  on('#btn-gallery', 'click', openGallery);
  on('#btn-help', 'click', () => el.helpModal && el.helpModal.classList.add('on'));
  on('#btn-help-close', 'click', () => el.helpModal && el.helpModal.classList.remove('on'));
  on('#help-modal', 'click', (e) => {
    if (e.target === el.helpModal && el.helpModal) el.helpModal.classList.remove('on');
  });

  on('#btn-settings', 'click', openSettingsModal);
  on('#btn-settings-close', 'click', closeSettingsModal);
  on('#settings-modal', 'click', (e) => {
    if (e.target === el.settingsModal && el.settingsModal) closeSettingsModal();
  });
  on('#camera-settings-form', 'submit', onSaveCameraSettings);

  /* Collage HUD & Modal */
  on('#btn-cancel-collage', 'click', abortCollageShoot);
  on('#btn-close-collage-modal', 'click', closeCollageModal);
  on('#collage-modal', 'click', (e) => {
    if (e.target === el.collageModal) closeCollageModal();
  });
  if (el.collageThemeButtons) {
    const themePills = el.collageThemeButtons.querySelectorAll('.theme-pill');
    themePills.forEach(tp => {
      tp.addEventListener('click', () => {
        const theme = tp.dataset.theme;
        if (theme) setCollageTheme(theme);
      });
    });
  }
  on('#btn-download-collage', 'click', () => {
    if (currentCollageResult) {
      downloadDataUrl(currentCollageResult.dataUrl, `webcamclicks-photobooth-${timestamp()}.jpg`);
      toast('⬇️ Collage downloaded!');
    }
  });
  on('#btn-gdrive-collage', 'click', saveCollageToGoogleDrive);
  on('#btn-share-collage', 'click', shareCollageOnline);
  on('#btn-copy-collage', 'click', copyCollageToClipboard);
  on('#btn-retake-collage', 'click', () => {
    closeCollageModal();
    startCollageShoot(collagePoseCount);
  });

  on('#btn-mirror', 'click', () => {
    camera.toggleMirror();
    updateMirrorUI();
    saveSettings();
    toast(camera.mirror ? '🪞 Mirror on' : '🪞 Mirror off');
  });
  on('#btn-sound', 'click', () => {
    Sound.enabled = !Sound.enabled;
    updateSoundBtn();
    saveSettings();
    if (Sound.enabled) Sound.pop();
  });
  on('#btn-fav', 'click', favCurrent);
  on('#btn-flip', 'click', async () => {
    try {
      const ok = await camera.flip();
      display.width = camera.width;
      display.height = camera.height;
      await updateCameraSelectUI();
      toast(ok ? '🔄 Switched camera' : '🔄 Only one camera found');
    } catch { toast('⚠️ Could not switch camera'); }
  });
  on('#camera-select', 'change', async (e) => {
    const devId = e.target.value;
    if (devId && camera.active) {
      try {
        await camera.switchDevice(devId);
        display.width = camera.width;
        display.height = camera.height;
        toast('🔄 Switched camera');
      } catch {
        toast('⚠️ Could not switch to selected camera');
      }
    }
  });
  if (navigator.mediaDevices && navigator.mediaDevices.addEventListener) {
    navigator.mediaDevices.addEventListener('devicechange', updateCameraSelectUI);
  }
  on('#btn-fullscreen', 'click', toggleFullscreen);

  on('#intensity', 'input', (e) => {
    manager.intensity = clamp(parseInt(e.target.value, 10) / 100, 0, 1);
  });
  on('#intensity', 'change', saveSettings);

  on('#btn-exit-game', 'click', exitGame);
  on('#btn-play-again', 'click', () => {
    hideGameMsg();
    if (lastGameId) startGame(lastGameId);
  });
  on('#btn-close-msg', 'click', hideGameMsg);

  on('#btn-gallery-close', 'click', closeGallery);
  on('#gallery-drawer', 'click', (e) => {
    if (e.target === el.galleryDrawer) closeGallery();
  });
  on('#btn-gallery-clear', 'click', () => {
    if (gallery.items.length && window.confirm('Delete all saved photos?')) {
      gallery.clear();
      toast('🗑️ Gallery cleared');
    }
  });

  /* Mobile App Deck Wiring */
  on('#mode-photo', 'click', () => setMobileMode('photo'));
  on('#mode-collage', 'click', () => setMobileMode('collage'));
  on('#mode-video', 'click', () => setMobileMode('video'));
  if (el.mobileCollageSelector) {
    const pills = el.mobileCollageSelector.querySelectorAll('.collage-pill');
    pills.forEach(pill => {
      pill.addEventListener('click', () => {
        pills.forEach(p => p.classList.remove('active'));
        pill.classList.add('active');
        collagePoseCount = parseInt(pill.dataset.poses, 10) || 4;
        if (el.selectCollagePoses) el.selectCollagePoses.value = String(collagePoseCount);
        Sound.click();
      });
    });
  }
  on('#btn-mobile-shutter', 'click', onMobileShutter);
  on('#btn-mobile-gallery', 'click', openGallery);
  on('#btn-mobile-effects', 'click', openEffectsSheet);
  on('#btn-close-effects-sheet', 'click', closeEffectsSheet);
  on('#sheet-backdrop', 'click', closeEffectsSheet);

  on('#btn-mobile-flip', 'click', async () => {
    try {
      const ok = await camera.flip();
      display.width = camera.width;
      display.height = camera.height;
      await updateCameraSelectUI();
      toast(ok ? '🔄 Switched camera' : '🔄 Only one camera found');
    } catch { toast('⚠️ Could not switch camera'); }
  });

  /* Floating Camera HUD (Top Overlay) */
  on('#hud-btn-flip', 'click', async () => {
    try {
      const ok = await camera.flip();
      display.width = camera.width;
      display.height = camera.height;
      await updateCameraSelectUI();
      toast(ok ? '🔄 Switched camera' : '🔄 Only one camera found');
    } catch { toast('⚠️ Could not switch camera'); }
  });

  on('#hud-btn-mirror', 'click', () => {
    camera.toggleMirror();
    updateMirrorUI();
    saveSettings();
    toast(camera.mirror ? '🪞 Mirror on' : '🪞 Mirror off');
  });

  on('#hud-btn-sound', 'click', () => {
    Sound.enabled = !Sound.enabled;
    updateSoundBtn();
    saveSettings();
    if (Sound.enabled) Sound.pop();
  });

  on('#hud-btn-settings', 'click', openSettingsModal);
  on('#hud-btn-fullscreen', 'click', toggleFullscreen);

  /* Mobile Bottom App Navigation */
  on('#mb-nav-camera', 'click', (e) => {
    e.preventDefault();
    const stg = $('#camera');
    if (stg && stg.scrollIntoView) stg.scrollIntoView({ behavior: 'smooth' });
    closeEffectsSheet();
    closeGallery();
  });

  on('#mb-nav-games', 'click', (e) => {
    e.preventDefault();
    const gms = $('#games');
    if (gms && gms.scrollIntoView) gms.scrollIntoView({ behavior: 'smooth' });
    closeEffectsSheet();
    closeGallery();
  });

  on('#mb-nav-gallery', 'click', (e) => {
    e.preventDefault();
    openGallery();
  });

  document.addEventListener('keydown', onKeyDown);
  window.addEventListener('hashchange', readHash);

  updateMirrorUI();
  updateSoundBtn();
}

/* ============================ boot ============================ */
init();

/* Debug handle (harmless in production, handy in the console) */
window.WC = { camera, manager, tracker, motion, gameMgr, gallery, Sound };
