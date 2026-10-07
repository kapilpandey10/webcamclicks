/* ============================================================
   WebcamClicks — Professional Cinema Camera (js/pro-camera.js)
   Mobile cinema camera engine with cinematic aspect ratios:
   1.85:1 Flat, 2.39:1 Scope, 16:9, 4:3 Vintage Box, IMAX (1.43:1 & 1.90:1)
   ============================================================ */

import { CameraManager } from './camera.js';
import { Recorder } from './recorder.js';
import { Sound } from './sound.js';
import { timestamp, downloadDataUrl } from './utils.js';

/* Theatrical & Cinema Aspect Ratios */
export const RATIOS = {
  'flat': {
    id: 'flat',
    name: '1.85:1 Flat',
    ratio: 1.85,
    tag: '1.85:1',
    desc: 'The standard theatrical widescreen format used in U.S. cinemas for spherical lens productions.'
  },
  'scope': {
    id: 'scope',
    name: '2.39:1 Scope',
    ratio: 2.39,
    tag: '2.39:1',
    desc: 'The ultra-wide anamorphic format commonly used for epics, action films, and sweeping landscapes.'
  },
  '16x9': {
    id: '16x9',
    name: '16:9 (1.78:1)',
    ratio: 16 / 9,
    tag: '16:9',
    desc: 'The universal standard for modern high-definition televisions, computer monitors, and online streaming.'
  },
  '4x3': {
    id: '4x3',
    name: '4:3 (1.33:1)',
    ratio: 4 / 3,
    tag: '4:3',
    desc: 'The classic vintage box format used in early silent cinema and old televisions, occasionally used today for nostalgic effect.'
  },
  'imax143': {
    id: 'imax143',
    name: 'IMAX (1.43:1)',
    ratio: 1.43,
    tag: '1.43:1',
    desc: 'A much taller format that provides a grand, vertically immersive field of view in specialized theaters.'
  },
  'imax190': {
    id: 'imax190',
    name: 'IMAX Digital (1.90:1)',
    ratio: 1.90,
    tag: '1.90:1',
    desc: 'The modern theatrical IMAX digital format with extended vertical immersion.'
  },
  'vertical': {
    id: 'vertical',
    name: '9:16 Vertical Reel',
    ratio: 9 / 16,
    tag: '9:16',
    desc: 'Full-bleed vertical cinematic format for mobile reels, stories, and social cinema.'
  }
};

/* Color Grading Profiles (LUTs) */
const LUTS = {
  'rec709': { name: 'REC.709', filter: 'none' },
  'tealorange': { name: 'SCOPEX', filter: 'contrast(1.15) saturate(1.2) hue-rotate(-12deg)' },
  'portra400': { name: 'PORTRA 35mm', filter: 'sepia(0.2) contrast(1.08) brightness(1.04) saturate(1.1)' },
  'trixnoir': { name: 'TRI-X NOIR', filter: 'grayscale(1) contrast(1.4) brightness(0.96)' },
  'goldenhour': { name: '3200K WARM', filter: 'sepia(0.35) saturate(1.25) contrast(1.05)' },
  'cyberpunk': { name: 'CYBERPUNK', filter: 'contrast(1.25) saturate(1.4) hue-rotate(185deg)' }
};

export class ProCameraApp {
  constructor() {
    this.camera = new CameraManager();
    this.displayCanvas = document.getElementById('pro-canvas');
    this.dctx = this.displayCanvas ? this.displayCanvas.getContext('2d') : null;
    
    // Hidden cropped recording canvas
    this.recCanvas = document.createElement('canvas');
    this.recCtx = this.recCanvas.getContext('2d');
    
    this.recorder = null;
    this.isRecording = false;
    this.recAudioStream = null;
    
    // Audio VU Meter Analyser
    this.audioContext = null;
    this.analyser = null;
    this.audioData = null;

    // Active state
    this.currentRatioKey = 'scope'; // Default to cinematic 2.39:1 Scope
    this.currentLutKey = 'rec709';
    this.cameraMode = 'photo'; // 'photo' | 'video'
    this.exposureEV = 0.0;
    this.gridMode = 0; // 0 = off, 1 = thirds, 2 = crosshair
    this.matteStyle = 'solid'; // 'solid' | 'translucent'
    this.flashMode = 'auto'; // 'auto' | 'off' | 'on'
    this.zoomLevel = 1;

    // Gallery session
    this.gallery = [];

    // DOM Elements
    this.dom = {
      wrapper: document.getElementById('pro-page-wrapper'),
      ratioBtn: document.getElementById('btn-ratio-picker'),
      ratioLabel: document.getElementById('ratio-label'),
      matteTop: document.getElementById('matte-top'),
      matteBottom: document.getElementById('matte-bottom'),
      matteLeft: document.getElementById('matte-left'),
      matteRight: document.getElementById('matte-right'),
      framingGrid: document.getElementById('framing-grid'),
      focusReticle: document.getElementById('focus-reticle'),
      screenFlash: document.getElementById('screen-flash'),
      shutterBtn: document.getElementById('master-shutter-btn'),
      modePhoto: document.getElementById('mode-photo'),
      modeVideo: document.getElementById('mode-video'),
      btnFlip: document.getElementById('deck-flip-btn'),
      btnThumb: document.getElementById('deck-thumb-btn'),
      thumbImg: document.getElementById('deck-thumb-img'),
      thumbBadge: document.getElementById('deck-thumb-badge'),
      fpsBadge: document.getElementById('telem-fps'),
      resBadge: document.getElementById('telem-res'),
      recBadge: document.getElementById('telem-rec'),
      vuBars: document.querySelectorAll('.vu-bar'),
      backdrop: document.getElementById('pro-sheet-backdrop'),
      ratioSheet: document.getElementById('ratio-sheet'),
      gallerySheet: document.getElementById('gallery-sheet'),
      ratioList: document.getElementById('ratio-cards-list'),
      galleryGrid: document.getElementById('gallery-items-grid'),
      startOverlay: document.getElementById('pro-start-overlay'),
      btnStartOverlay: document.getElementById('btn-start-camera-overlay'),
      guideSheet: document.getElementById('guide-sheet'),
      btnInfoGuide: document.getElementById('btn-info-guide'),
      btnGridToggle: document.getElementById('btn-grid-toggle'),
      btnMatteToggle: document.getElementById('btn-matte-toggle'),
      btnFlashToggle: document.getElementById('btn-flash-toggle'),
      lutChips: document.querySelectorAll('.lut-chip'),
      zoomPills: document.querySelectorAll('.zoom-pill'),
      btnSimulatorView: document.getElementById('btn-simulator-view'),
      btnFullscreenView: document.getElementById('btn-fullscreen-view'),
      btnBannerClose: document.getElementById('btn-banner-close'),
      desktopBanner: document.getElementById('desktop-app-banner')
    };

    this.running = false;
    this.lastFrameTime = performance.now();
    this.fpsCounter = 30;
    this.frameCount = 0;
  }

  async init() {
    this.setupEventListeners();
    this.renderRatioList();
    this.updateRatioUI();
    this.updateMatte();

    window.addEventListener('resize', () => this.updateMatte());

    try {
      await this.startCamera();
    } catch (err) {
      console.warn('Pro Camera init: Waiting for user gesture to enable camera', err);
    }

    this.running = true;
    requestAnimationFrame((t) => this.renderLoop(t));
  }

  async startCamera() {
    try {
      await this.camera.start('max');
      if (this.dom.resBadge) {
        this.dom.resBadge.textContent = this.camera.getResolutionLabel();
      }
      if (this.dom.startOverlay) {
        this.dom.startOverlay.classList.add('hidden');
      }
      this.initAudioVU();
      this.updateMatte();
      return true;
    } catch (err) {
      console.error('Camera start failed:', err);
      if (this.dom.startOverlay) {
        this.dom.startOverlay.classList.remove('hidden');
      }
      return false;
    }
  }

  async initAudioVU() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return;
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      if (!this.audioContext) this.audioContext = new AC();
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      this.micStream = stream;
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 64;
      source.connect(this.analyser);
      this.audioData = new Uint8Array(this.analyser.frequencyBinCount);
    } catch (err) {
      // Audio access optional; fails silently
    }
  }

  updateAudioVU() {
    if (!this.analyser || !this.audioData || !this.dom.vuBars || this.dom.vuBars.length === 0) return;
    this.analyser.getByteFrequencyData(this.audioData);
    let sum = 0;
    for (let i = 0; i < this.audioData.length; i++) {
      sum += this.audioData[i];
    }
    const avg = sum / this.audioData.length;
    const level = Math.min(1, avg / 128); // 0.0 to 1.0

    const barCount = this.dom.vuBars.length;
    const litCount = Math.round(level * barCount);

    this.dom.vuBars.forEach((bar, idx) => {
      bar.classList.toggle('lit', idx < litCount);
    });
  }

  renderLoop(time) {
    if (!this.running) return;

    // Calculate live FPS
    this.frameCount++;
    if (time - this.lastFrameTime >= 1000) {
      this.fpsCounter = Math.round((this.frameCount * 1000) / (time - this.lastFrameTime));
      this.frameCount = 0;
      this.lastFrameTime = time;
      if (this.dom.fpsBadge) {
        this.dom.fpsBadge.textContent = `${this.fpsCounter} FPS`;
      }
    }

    this.updateAudioVU();

    // Render frame to canvas
    if (this.camera.active && this.displayCanvas && this.dctx) {
      const frame = this.camera.grabFrame();
      if (frame) {
        const vw = this.displayCanvas.clientWidth || 400;
        const vh = this.displayCanvas.clientHeight || 700;
        if (this.displayCanvas.width !== vw || this.displayCanvas.height !== vh) {
          this.displayCanvas.width = vw;
          this.displayCanvas.height = vh;
          this.updateMatte();
        }

        const ctx = this.dctx;
        ctx.save();
        
        // Color LUT profile & exposure EV
        const lut = LUTS[this.currentLutKey] || LUTS.rec709;
        const exposureMultiplier = Math.pow(2, this.exposureEV);
        let filterStr = lut.filter === 'none' ? '' : lut.filter;
        if (Math.abs(this.exposureEV) > 0.01) {
          filterStr += ` brightness(${exposureMultiplier.toFixed(2)})`;
        }
        ctx.filter = filterStr.trim() || 'none';

        // Draw camera frame with cover fill
        const imgW = frame.width;
        const imgH = frame.height;
        const scale = Math.max(vw / imgW, vh / imgH);
        const nw = imgW * scale;
        const nh = imgH * scale;
        const dx = (vw - nw) / 2;
        const dy = (vh - nh) / 2;

        ctx.drawImage(frame, dx, dy, nw, nh);
        ctx.restore();

        // If recording video, draw cropped cinema frame to recCanvas
        if (this.isRecording && this.recCtx) {
          const crop = this.getCropCoordinates(vw, vh);
          if (crop.w > 0 && crop.h > 0) {
            if (this.recCanvas.width !== crop.w || this.recCanvas.height !== crop.h) {
              this.recCanvas.width = crop.w;
              this.recCanvas.height = crop.h;
            }
            this.recCtx.drawImage(this.displayCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
          }
        }
      }
    }

    requestAnimationFrame((t) => this.renderLoop(t));
  }

  /* Compute aspect ratio letterbox/pillarbox crop */
  getCropCoordinates(viewportW, viewportH) {
    const target = RATIOS[this.currentRatioKey] || RATIOS.scope;
    const targetRatio = target.ratio;
    const viewportRatio = viewportW / viewportH;

    let cropW = viewportW;
    let cropH = viewportH;
    let cropX = 0;
    let cropY = 0;

    if (viewportRatio > targetRatio) {
      // Viewport is wider than target ratio -> Pillarbox (bars on left/right)
      cropW = Math.round(viewportH * targetRatio);
      cropX = Math.round((viewportW - cropW) / 2);
    } else {
      // Viewport is taller than target ratio -> Letterbox (bars on top/bottom)
      cropH = Math.round(viewportW / targetRatio);
      cropY = Math.round((viewportH - cropH) / 2);
    }

    return { x: cropX, y: cropY, w: cropW, h: cropH };
  }

  updateMatte() {
    if (!this.displayCanvas) return;
    const vw = this.displayCanvas.clientWidth || window.innerWidth;
    const vh = this.displayCanvas.clientHeight || window.innerHeight;
    const crop = this.getCropCoordinates(vw, vh);

    const barH = Math.max(0, crop.y);
    const barW = Math.max(0, crop.x);

    if (this.dom.matteTop) this.dom.matteTop.style.height = `${barH}px`;
    if (this.dom.matteBottom) this.dom.matteBottom.style.height = `${barH}px`;
    if (this.dom.matteLeft) this.dom.matteLeft.style.width = `${barW}px`;
    if (this.dom.matteRight) this.dom.matteRight.style.width = `${barW}px`;

    // Position top matte below top bar if needed
    const isTranslucent = this.matteStyle === 'translucent';
    [this.dom.matteTop, this.dom.matteBottom, this.dom.matteLeft, this.dom.matteRight].forEach((el) => {
      if (el) el.classList.toggle('translucent', isTranslucent);
    });
  }

  setRatio(ratioKey) {
    if (!RATIOS[ratioKey]) return;
    this.currentRatioKey = ratioKey;
    this.updateRatioUI();
    this.updateMatte();
    this.closeSheets();
    Sound.pop();
    if (navigator.vibrate) try { navigator.vibrate(20); } catch {}
  }

  updateRatioUI() {
    const cur = RATIOS[this.currentRatioKey] || RATIOS.scope;
    if (this.dom.ratioLabel) {
      this.dom.ratioLabel.textContent = cur.tag;
    }
    // Update active state in ratio modal
    if (this.dom.ratioList) {
      const cards = this.dom.ratioList.querySelectorAll('.ratio-card');
      cards.forEach((c) => {
        c.classList.toggle('active', c.dataset.ratioKey === this.currentRatioKey);
      });
    }
  }

  renderRatioList() {
    if (!this.dom.ratioList) return;
    this.dom.ratioList.innerHTML = '';
    Object.values(RATIOS).forEach((r) => {
      const card = document.createElement('div');
      card.className = `ratio-card ${r.id === this.currentRatioKey ? 'active' : ''}`;
      card.dataset.ratioKey = r.id;

      // Preview box shape
      const isWide = r.ratio >= 1;
      const previewW = isWide ? 40 : Math.round(40 * r.ratio);
      const previewH = isWide ? Math.round(40 / r.ratio) : 40;

      card.innerHTML = `
        <div class="ratio-shape-preview">
          <div class="shape-box" style="width:${previewW}px; height:${previewH}px;"></div>
        </div>
        <div class="ratio-card-info">
          <div class="ratio-card-title">${r.name}</div>
          <div class="ratio-card-desc">${r.desc}</div>
        </div>
      `;
      card.addEventListener('click', () => this.setRatio(r.id));
      this.dom.ratioList.appendChild(card);
    });
  }

  /* Tap to focus reticle */
  handleStageTap(e) {
    const rect = this.displayCanvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (this.dom.focusReticle) {
      this.dom.focusReticle.style.left = `${x}px`;
      this.dom.focusReticle.style.top = `${y}px`;
      this.dom.focusReticle.classList.add('active');
      Sound.tone(880, 0.06, 'sine', 0.15);
      if (navigator.vibrate) try { navigator.vibrate(15); } catch {}

      clearTimeout(this._reticleTimer);
      this._reticleTimer = setTimeout(() => {
        if (this.dom.focusReticle) this.dom.focusReticle.classList.remove('active');
      }, 2400);
    }
  }

  /* Shutter Action (Photo or Video) */
  async onShutterClick() {
    if (!this.camera.active) {
      await this.startCamera();
      return;
    }

    if (this.cameraMode === 'video') {
      await this.toggleVideoRecord();
    } else {
      await this.takePhoto();
    }
  }

  /* Capture High-Res Photo cropped to selected Aspect Ratio */
  async takePhoto() {
    if (navigator.vibrate) try { navigator.vibrate([25, 20, 25]); } catch {}
    Sound.shutter();

    // Flash animation
    if (this.dom.screenFlash && (this.flashMode === 'on' || this.flashMode === 'auto')) {
      this.dom.screenFlash.classList.add('fire');
      setTimeout(() => this.dom.screenFlash.classList.remove('fire'), 120);
    }

    const vw = this.displayCanvas.width;
    const vh = this.displayCanvas.height;
    const crop = this.getCropCoordinates(vw, vh);

    // Render cropped high-resolution photo
    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = Math.max(2, crop.w);
    photoCanvas.height = Math.max(2, crop.h);
    const pctx = photoCanvas.getContext('2d');
    pctx.drawImage(this.displayCanvas, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);

    const dataUrl = photoCanvas.toDataURL('image/jpeg', 0.95);
    const ratioInfo = RATIOS[this.currentRatioKey] || RATIOS.scope;

    const item = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e4)}`,
      kind: 'photo',
      dataUrl,
      ratio: ratioInfo.tag,
      ratioName: ratioInfo.name,
      filename: `pro-camera-${ratioInfo.id}-${timestamp()}.jpg`,
      ts: Date.now()
    };

    this.gallery.unshift(item);
    this.updateGalleryThumbnail(item);
    this.renderGallerySheet();
  }

  /* Video Recording cropped to Aspect Ratio */
  async toggleVideoRecord() {
    if (this.isRecording) {
      await this.stopVideoRecord();
    } else {
      await this.startVideoRecord();
    }
  }

  async startVideoRecord() {
    if (this.isRecording) return;
    const vw = this.displayCanvas.width;
    const vh = this.displayCanvas.height;
    const crop = this.getCropCoordinates(vw, vh);

    this.recCanvas.width = Math.max(2, crop.w);
    this.recCanvas.height = Math.max(2, crop.h);

    this.recorder = new Recorder(this.recCanvas);
    if (!this.recorder.supported) {
      alert('Video recording is not supported in this browser.');
      return;
    }

    // Capture microphone audio track
    let audioTrack = null;
    if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const tracks = audioStream.getAudioTracks();
        if (tracks && tracks.length > 0) {
          audioTrack = tracks[0];
          this.recAudioStream = audioStream;
        }
      } catch {
        // Continue video-only if mic denied
      }
    }

    this.recorder.onTick = (ms) => {
      const sec = Math.floor(ms / 1000);
      const m = Math.floor(sec / 60);
      const s = sec % 60;
      const str = `REC ${m}:${s < 10 ? '0' : ''}${s}`;
      if (this.dom.recBadge) {
        this.dom.recBadge.textContent = str;
        this.dom.recBadge.style.display = 'inline-block';
      }
    };

    const ok = this.recorder.start(30, audioTrack);
    if (!ok) {
      if (this.recAudioStream) {
        this.recAudioStream.getTracks().forEach((t) => t.stop());
        this.recAudioStream = null;
      }
      return;
    }

    this.isRecording = true;
    Sound.pop();
    if (navigator.vibrate) try { navigator.vibrate([40, 20, 40]); } catch {}

    if (this.dom.shutterBtn) {
      this.dom.shutterBtn.classList.add('is-recording');
    }
    if (this.dom.recBadge) {
      this.dom.recBadge.style.display = 'inline-block';
      this.dom.recBadge.textContent = 'REC 0:00';
    }
  }

  async stopVideoRecord() {
    if (!this.isRecording || !this.recorder) return;
    this.isRecording = false;

    if (this.dom.shutterBtn) {
      this.dom.shutterBtn.classList.remove('is-recording');
    }
    if (this.dom.recBadge) {
      this.dom.recBadge.style.display = 'none';
    }

    if (this.recAudioStream) {
      try {
        this.recAudioStream.getTracks().forEach((t) => t.stop());
      } catch {}
      this.recAudioStream = null;
    }

    try {
      const clip = await this.recorder.stop();
      if (clip && clip.blob) {
        Sound.pop();
        const ratioInfo = RATIOS[this.currentRatioKey] || RATIOS.scope;
        const item = {
          id: `${Date.now()}-${Math.round(Math.random() * 1e4)}`,
          kind: 'video',
          url: clip.url,
          blob: clip.blob,
          thumbnail: clip.thumbnail || null,
          dataUrl: clip.thumbnail || null,
          ratio: ratioInfo.tag,
          ratioName: ratioInfo.name,
          filename: `pro-camera-${ratioInfo.id}-${timestamp()}.${clip.ext || 'webm'}`,
          ts: Date.now()
        };
        this.gallery.unshift(item);
        this.updateGalleryThumbnail(item);
        this.renderGallerySheet();
      }
    } catch (err) {
      console.error('Stop recording failed:', err);
    }
  }

  updateGalleryThumbnail(latest) {
    if (!this.dom.btnThumb || !latest) return;
    const src = latest.dataUrl || latest.thumbnail;
    if (src && this.dom.thumbImg) {
      this.dom.thumbImg.src = src;
      this.dom.thumbImg.style.display = 'block';
    }
    if (this.dom.thumbBadge) {
      this.dom.thumbBadge.textContent = this.gallery.length;
      this.dom.thumbBadge.style.display = 'inline-block';
    }
  }

  renderGallerySheet() {
    if (!this.dom.galleryGrid) return;
    this.dom.galleryGrid.innerHTML = '';

    if (this.gallery.length === 0) {
      this.dom.galleryGrid.innerHTML = `
        <div style="grid-column: 1/-1; text-align:center; padding:40px 10px; color:var(--pro-muted);">
          <div style="font-size:2rem; margin-bottom:8px;">🎬</div>
          <p>No captures yet.<br>Press the Shutter button to shoot cinematic photos or video clips.</p>
        </div>
      `;
      return;
    }

    this.gallery.forEach((item) => {
      const card = document.createElement('div');
      card.className = 'gallery-card';

      let mediaHtml = '';
      if (item.kind === 'video') {
        mediaHtml = `<video src="${item.url}" playsinline preload="metadata" ${item.thumbnail ? `poster="${item.thumbnail}"` : ''} controls></video>`;
      } else {
        mediaHtml = `<img src="${item.dataUrl}" alt="Pro capture">`;
      }

      card.innerHTML = `
        ${mediaHtml}
        <span class="gallery-card-badge">${item.ratio}</span>
        <div class="gallery-card-actions">
          <button class="gallery-action-btn" title="Download" data-action="download">⬇️</button>
          <button class="gallery-action-btn" title="Delete" data-action="delete">🗑️</button>
        </div>
      `;

      card.querySelector('[data-action="download"]').addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.kind === 'video' && item.url) {
          const a = document.createElement('a');
          a.href = item.url;
          a.download = item.filename;
          a.click();
        } else if (item.dataUrl) {
          downloadDataUrl(item.dataUrl, item.filename);
        }
      });

      card.querySelector('[data-action="delete"]').addEventListener('click', (e) => {
        e.stopPropagation();
        if (item.url) {
          try { URL.revokeObjectURL(item.url); } catch {}
        }
        this.gallery = this.gallery.filter((g) => g.id !== item.id);
        if (this.gallery.length > 0) {
          this.updateGalleryThumbnail(this.gallery[0]);
        } else if (this.dom.thumbBadge) {
          this.dom.thumbBadge.style.display = 'none';
          if (this.dom.thumbImg) this.dom.thumbImg.style.display = 'none';
        }
        this.renderGallerySheet();
      });

      this.dom.galleryGrid.appendChild(card);
    });
  }

  setCameraMode(mode) {
    if (this.cameraMode === mode) return;
    this.cameraMode = mode;
    Sound.click();
    if (this.dom.modePhoto) this.dom.modePhoto.classList.toggle('active', mode === 'photo');
    if (this.dom.modeVideo) this.dom.modeVideo.classList.toggle('active', mode === 'video');

    if (this.dom.shutterBtn) {
      this.dom.shutterBtn.classList.toggle('video-mode', mode === 'video');
    }
  }

  setZoom(level) {
    this.zoomLevel = level;
    this.camera.setZoom(level);
    Sound.click();
    if (this.dom.zoomPills) {
      this.dom.zoomPills.forEach((p) => {
        p.classList.toggle('active', parseFloat(p.dataset.zoom) === level);
      });
    }
  }

  setLut(lutKey) {
    if (!LUTS[lutKey]) return;
    this.currentLutKey = lutKey;
    Sound.click();
    if (this.dom.lutChips) {
      this.dom.lutChips.forEach((c) => {
        c.classList.toggle('active', c.dataset.lut === lutKey);
      });
    }
  }

  toggleGrid() {
    this.gridMode = (this.gridMode + 1) % 3; // 0 = off, 1 = thirds, 2 = crosshair
    Sound.click();
    if (this.dom.framingGrid) {
      this.dom.framingGrid.classList.toggle('active', this.gridMode > 0);
      const crosshair = this.dom.framingGrid.querySelector('.grid-crosshair');
      if (crosshair) crosshair.style.display = this.gridMode === 2 ? 'block' : 'none';
    }
    if (this.dom.btnGridToggle) {
      this.dom.btnGridToggle.classList.toggle('active', this.gridMode > 0);
    }
  }

  toggleMatteStyle() {
    this.matteStyle = this.matteStyle === 'solid' ? 'translucent' : 'solid';
    Sound.click();
    this.updateMatte();
    if (this.dom.btnMatteToggle) {
      this.dom.btnMatteToggle.classList.toggle('active', this.matteStyle === 'solid');
    }
  }

  toggleFlash() {
    this.flashMode = this.flashMode === 'auto' ? 'on' : this.flashMode === 'on' ? 'off' : 'auto';
    Sound.click();
    if (this.dom.btnFlashToggle) {
      this.dom.btnFlashToggle.textContent = this.flashMode === 'off' ? '⚡' : this.flashMode === 'on' ? '💡' : '⚡';
      this.dom.btnFlashToggle.classList.toggle('active', this.flashMode !== 'off');
    }
  }

  openRatioSheet() {
    this.closeSheets();
    if (this.dom.backdrop) this.dom.backdrop.classList.add('on');
    if (this.dom.ratioSheet) this.dom.ratioSheet.classList.add('on');
    Sound.click();
  }

  openGallerySheet() {
    this.closeSheets();
    if (this.dom.backdrop) this.dom.backdrop.classList.add('on');
    if (this.dom.gallerySheet) this.dom.gallerySheet.classList.add('on');
    this.renderGallerySheet();
    Sound.click();
  }

  openGuideSheet() {
    this.closeSheets();
    if (this.dom.backdrop) this.dom.backdrop.classList.add('on');
    if (this.dom.guideSheet) this.dom.guideSheet.classList.add('on');
    Sound.click();
  }

  closeSheets() {
    if (this.dom.backdrop) this.dom.backdrop.classList.remove('on');
    if (this.dom.ratioSheet) this.dom.ratioSheet.classList.remove('on');
    if (this.dom.gallerySheet) this.dom.gallerySheet.classList.remove('on');
    if (this.dom.guideSheet) this.dom.guideSheet.classList.remove('on');
  }

  setupEventListeners() {
    // Mode switcher
    if (this.dom.modePhoto) this.dom.modePhoto.addEventListener('click', () => this.setCameraMode('photo'));
    if (this.dom.modeVideo) this.dom.modeVideo.addEventListener('click', () => this.setCameraMode('video'));

    // Shutter button
    if (this.dom.shutterBtn) this.dom.shutterBtn.addEventListener('click', () => this.onShutterClick());

    // Flip Camera front/back
    if (this.dom.btnFlip) {
      this.dom.btnFlip.addEventListener('click', async () => {
        Sound.pop();
        if (navigator.vibrate) try { navigator.vibrate(20); } catch {}
        await this.camera.flip();
        this.updateMatte();
      });
    }

    // Ratio picker button
    if (this.dom.ratioBtn) this.dom.ratioBtn.addEventListener('click', () => this.openRatioSheet());

    // Gallery button
    if (this.dom.btnThumb) this.dom.btnThumb.addEventListener('click', () => this.openGallerySheet());

    // Bottom sheet backdrop & close buttons
    if (this.dom.backdrop) this.dom.backdrop.addEventListener('click', () => this.closeSheets());
    document.querySelectorAll('.sheet-close-btn').forEach((b) => {
      b.addEventListener('click', () => this.closeSheets());
    });

    // Top Controls
    if (this.dom.btnGridToggle) this.dom.btnGridToggle.addEventListener('click', () => this.toggleGrid());
    if (this.dom.btnMatteToggle) this.dom.btnMatteToggle.addEventListener('click', () => this.toggleMatteStyle());
    if (this.dom.btnFlashToggle) this.dom.btnFlashToggle.addEventListener('click', () => this.toggleFlash());
    if (this.dom.btnInfoGuide) this.dom.btnInfoGuide.addEventListener('click', () => this.openGuideSheet());

    // Tap to Start Camera Overlay (Mobile gesture friendly)
    if (this.dom.btnStartOverlay) {
      this.dom.btnStartOverlay.addEventListener('click', (e) => {
        e.stopPropagation();
        this.startCamera();
      });
    }
    if (this.dom.startOverlay) {
      this.dom.startOverlay.addEventListener('click', () => this.startCamera());
    }

    // Stage Tap to Focus
    const stage = document.getElementById('camera-stage-container');
    if (stage) {
      stage.addEventListener('click', (e) => this.handleStageTap(e));
      stage.addEventListener('touchstart', (e) => this.handleStageTap(e), { passive: true });
    }

    // LUT chips
    if (this.dom.lutChips) {
      this.dom.lutChips.forEach((chip) => {
        chip.addEventListener('click', () => this.setLut(chip.dataset.lut));
      });
    }

    // Zoom dial pills
    if (this.dom.zoomPills) {
      this.dom.zoomPills.forEach((pill) => {
        pill.addEventListener('click', () => this.setZoom(parseFloat(pill.dataset.zoom)));
      });
    }

    // Desktop Simulator toggles
    if (this.dom.btnSimulatorView && this.dom.btnFullscreenView) {
      this.dom.btnSimulatorView.addEventListener('click', () => {
        this.dom.wrapper.classList.remove('fullscreen-mode');
        this.dom.btnSimulatorView.classList.add('active');
        this.dom.btnFullscreenView.classList.remove('active');
        this.updateMatte();
      });
      this.dom.btnFullscreenView.addEventListener('click', () => {
        this.dom.wrapper.classList.add('fullscreen-mode');
        this.dom.btnFullscreenView.classList.add('active');
        this.dom.btnSimulatorView.classList.remove('active');
        this.updateMatte();
      });
    }

    if (this.dom.btnBannerClose && this.dom.desktopBanner) {
      this.dom.btnBannerClose.addEventListener('click', () => {
        this.dom.desktopBanner.style.display = 'none';
      });
    }

    // Keyboard shortcuts
    window.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const k = e.key.toLowerCase();
      if (k === ' ' || k === 'c') {
        e.preventDefault();
        this.onShutterClick();
      } else if (k === 'v') {
        e.preventDefault();
        this.setCameraMode('video');
        this.onShutterClick();
      } else if (k === 'escape') {
        this.closeSheets();
      }
    });
  }
}

// Bootstrap
document.addEventListener('DOMContentLoaded', () => {
  const app = new ProCameraApp();
  app.init();
});
