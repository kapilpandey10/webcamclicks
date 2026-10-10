/**
 * 360 CAM — Primary Application Controller
 * Professional Photosphere Capture Engine with Multi-Tier 3D Spherical Lattice
 * (Zenith Sky, Upper Ring, Horizon Ring, Lower Ring, Nadir Ground),
 * 3D HUD Canvas perspective projection, beacon guidance beam, and 3D mini-globe radar.
 */

import { audioHaptics } from './audio-haptics.js';
import { CameraStream } from './camera-stream.js';
import { sensorTracker } from './sensors.js';
import { SphericalStitcher } from './stitcher.js';
import { PanoramaViewer } from './viewer.js';
import { generateDemoPanorama } from './demo-panorama.js';

class ThreeSixtyApp {
  constructor() {
    // State machine: 'setup' | 'capture' | 'stitching' | 'viewer'
    this.currentState = 'setup';

    // Capture mode: 'sphere' (full 24-node photosphere) | 'horizon' (8-node ring)
    this.captureMode = 'sphere';

    // Core engines
    this.cameraStream = null;
    this.stitcher = new SphericalStitcher({ width: 2048, height: 1024 });
    this.viewer = null;

    // Captured frames: array of { canvas, yaw, pitch, roll, fovH, fovV, nodeIndex }
    this.capturedFrames = [];
    this.capturedPanoCanvas = null;

    // Target spherical nodes lattice
    this.targetNodes = [];
    this.activeTargetNode = null;

    // Capture and alignment settings
    this.autoSnapEnabled = true;
    this.lockSteadyTime = 0;
    this.lockDurationRequired = 450; // ms to hold steady for auto-snap
    this.isSnapping = false;

    // Alignment lock thresholds (degrees)
    this.snapThreshold = 6.5; // degrees distance to center
    this.hasPlayedLockBeep = false;

    // HUD Canvas 2D context
    this.hudCanvas = null;
    this.hudCtx = null;
    this.hudAnimId = null;
    this.lastFrameTime = performance.now();

    // Elements cache
    this.dom = {};
  }

  init() {
    this._cacheElements();
    this._initTargetNodes(this.captureMode);
    this._bindEvents();
    this._setupPointerDrag();

    // Check query params for quick start or demo
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === '1') {
      this.loadDemoPanorama();
    }

    // Check for Secure Context on iOS Safari
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isSecure = window.isSecureContext || isLocalhost;
    if (!isSecure && this.dom.sensorNotice) {
      this.dom.sensorNotice.style.display = 'block';
      this.dom.sensorNotice.style.background = 'rgba(239, 68, 68, 0.15)';
      this.dom.sensorNotice.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      this.dom.sensorNotice.style.color = '#fca5a5';
      this.dom.sensorNotice.innerHTML = `⚠️ <strong>Notice for iPhone:</strong> iOS Safari strictly disables camera and motion sensors over unencrypted local HTTP (<code>${location.host}</code>). Run <code>npm run tunnel</code> on your Mac or access via HTTPS to use your real camera!`;
    }
  }

  _cacheElements() {
    this.dom = {
      // Screens
      screenSetup: document.getElementById('screen-setup'),
      screenCapture: document.getElementById('screen-capture'),
      screenStitching: document.getElementById('screen-stitching'),
      screenViewer: document.getElementById('screen-viewer'),

      // Setup screen elements
      btnStartCapture: document.getElementById('btn-start-capture'),
      btnTryDemo: document.getElementById('btn-try-demo'),
      btnSimulateCapture: document.getElementById('btn-simulate-capture'),
      sensorNotice: document.getElementById('sensor-notice'),

      // Capture HUD
      cameraVideo: document.getElementById('camera-video'),
      hudCanvas: document.getElementById('hud-canvas'),
      captureHud: document.getElementById('capture-hud'),
      hudGuidanceBanner: document.getElementById('hud-guidance-banner'),
      filmstripContainer: document.getElementById('filmstrip-container'),
      progressRingCircle: document.getElementById('progress-ring-circle'),
      progressText: document.getElementById('progress-text'),
      captureStatusSubtext: document.getElementById('capture-status-subtext'),
      landscapeWarning: document.getElementById('landscape-warning'),

      // Telemetry Ribbon
      telemetryHeading: document.getElementById('telem-heading'),
      telemetryElevation: document.getElementById('telem-elevation'),
      telemetryGyroStatus: document.getElementById('telem-gyro-status'),

      // Mode Selector buttons
      btnModeSphere: document.getElementById('btn-mode-sphere'),
      btnModeHorizon: document.getElementById('btn-mode-horizon'),

      // Action triggers
      btnShutter: document.getElementById('btn-shutter'),
      btnFinishStitch: document.getElementById('btn-finish-stitch'),
      btnCancelCapture: document.getElementById('btn-cancel-capture'),
      btnUndoFrame: document.getElementById('btn-undo-frame'),
      btnResetFrames: document.getElementById('btn-reset-frames'),
      btnSwitchCamera: document.getElementById('btn-switch-camera'),
      btnZeroHeading: document.getElementById('btn-zero-heading'),
      btnAutoSnapToggle: document.getElementById('btn-autosnap-toggle'),

      // Stepper controls
      btnManualUp: document.getElementById('btn-manual-up'),
      btnManualDown: document.getElementById('btn-manual-down'),
      btnManualLeft: document.getElementById('btn-manual-left'),
      btnManualRight: document.getElementById('btn-manual-right'),
      btnManualLevel: document.getElementById('btn-manual-level'),

      // Stitching screen
      stitchProgressBar: document.getElementById('stitch-progress-bar'),
      stitchProgressText: document.getElementById('stitch-progress-text'),
      stitchProgressPercent: document.getElementById('stitch-progress-percent'),

      // Viewer screen
      panoViewerContainer: document.getElementById('pano-viewer-container'),
      btnViewerDownload: document.getElementById('btn-viewer-download'),
      btnViewerRetake: document.getElementById('btn-viewer-retake'),
      btnViewerShare: document.getElementById('btn-viewer-share'),
      btnViewerGyro: document.getElementById('btn-viewer-gyro'),
      btnViewerRotate: document.getElementById('btn-viewer-rotate'),
      btnViewerFullscreen: document.getElementById('btn-viewer-fullscreen'),
      btnViewerFlatMap: document.getElementById('btn-viewer-flatmap'),
      modalFlatMap: document.getElementById('modal-flat-map'),
      imgFlatMapPreview: document.getElementById('img-flat-map-preview'),
      btnCloseFlatMap: document.getElementById('btn-close-flat-map'),

      // Desktop layout toggle
      btnSimulatorView: document.getElementById('btn-simulator-view'),
      btnFullscreenView: document.getElementById('btn-fullscreen-view'),
      phoneFrame: document.getElementById('phone-frame'),
      desktopBanner: document.getElementById('desktop-app-banner'),
      btnBannerClose: document.getElementById('btn-banner-close')
    };

    this.hudCanvas = this.dom.hudCanvas;
    if (this.hudCanvas) {
      this.hudCtx = this.hudCanvas.getContext('2d');
    }

    this.cameraStream = new CameraStream(this.dom.cameraVideo);
  }

  /**
   * Construct 3D spherical lattice covering Top, Upper, Horizon, Lower, and Ground
   */
  _initTargetNodes(mode = 'sphere') {
    this.captureMode = mode;
    this.targetNodes = [];
    let id = 0;

    // 1. HORIZON RING (0° pitch, 8 nodes every 45°) - START RIGHT HERE!
    // Starts at eye level so node 0 (yaw 0, pitch 0) is dead center in the viewfinder!
    [0, 45, 90, 135, 180, 225, 270, 315].forEach((yaw) => {
      this.targetNodes.push({ id: id++, yaw, pitch: 0, label: 'Level', captured: false, thumbnail: null });
    });

    if (mode === 'sphere') {
      // 2. UPPER RING (+35° pitch, 6 nodes every 60°)
      [0, 60, 120, 180, 240, 300].forEach((yaw) => {
        this.targetNodes.push({ id: id++, yaw, pitch: 35, label: 'Upper', captured: false, thumbnail: null });
      });

      // 3. LOWER RING (-35° pitch, 6 nodes every 60°)
      [0, 60, 120, 180, 240, 300].forEach((yaw) => {
        this.targetNodes.push({ id: id++, yaw, pitch: -35, label: 'Lower', captured: false, thumbnail: null });
      });

      // 4. ZENITH SKY (+70° pitch, 2 opposite nodes)
      [0, 180].forEach((yaw) => {
        this.targetNodes.push({ id: id++, yaw, pitch: 70, label: 'Sky', captured: false, thumbnail: null });
      });

      // 5. NADIR GROUND (-70° pitch, 2 opposite nodes)
      [0, 180].forEach((yaw) => {
        this.targetNodes.push({ id: id++, yaw, pitch: -70, label: 'Ground', captured: false, thumbnail: null });
      });
    }

    this._updateProgressHud();
  }

  _bindEvents() {
    // Setup actions
    this.dom.btnStartCapture?.addEventListener('click', () => this.startCaptureFlow(false));
    this.dom.btnSimulateCapture?.addEventListener('click', () => this.startCaptureFlow(true));
    this.dom.btnTryDemo?.addEventListener('click', () => this.loadDemoPanorama());

    // Mode Selector
    this.dom.btnModeSphere?.addEventListener('click', () => this.setMode('sphere'));
    this.dom.btnModeHorizon?.addEventListener('click', () => this.setMode('horizon'));

    // Capture actions
    this.dom.btnShutter?.addEventListener('click', () => this.snapCurrentFrame());
    this.dom.btnFinishStitch?.addEventListener('click', () => this.startStitchingProcess());
    this.dom.btnCancelCapture?.addEventListener('click', () => this.cancelCaptureSession());
    this.dom.btnUndoFrame?.addEventListener('click', () => this.undoLastFrame());
    this.dom.btnResetFrames?.addEventListener('click', () => this.resetCaptureSession());
    this.dom.btnSwitchCamera?.addEventListener('click', () => this.switchCamera());
    this.dom.btnZeroHeading?.addEventListener('click', () => this.zeroHeading());
    this.dom.btnAutoSnapToggle?.addEventListener('click', () => this.toggleAutoSnap());

    // Stepper buttons
    this.dom.btnManualUp?.addEventListener('click', () => sensorTracker.setManualOffset(0, 30));
    this.dom.btnManualDown?.addEventListener('click', () => sensorTracker.setManualOffset(0, -30));
    this.dom.btnManualLeft?.addEventListener('click', () => sensorTracker.setManualOffset(-45, 0));
    this.dom.btnManualRight?.addEventListener('click', () => sensorTracker.setManualOffset(45, 0));
    this.dom.btnManualLevel?.addEventListener('click', () => sensorTracker.setManualHeading(sensorTracker.manualYaw, 0));

    // Viewer actions
    this.dom.btnViewerDownload?.addEventListener('click', () => this.download360Photo());
    this.dom.btnViewerRetake?.addEventListener('click', () => this.retakePanorama());
    this.dom.btnViewerShare?.addEventListener('click', () => this.sharePanorama());
    this.dom.btnViewerGyro?.addEventListener('click', () => this.toggleViewerGyro());
    this.dom.btnViewerRotate?.addEventListener('click', () => this.toggleViewerAutoRotate());
    this.dom.btnViewerFullscreen?.addEventListener('click', () => this.toggleFullscreen());
    this.dom.btnViewerFlatMap?.addEventListener('click', () => this.openFlatMapModal());
    this.dom.btnCloseFlatMap?.addEventListener('click', () => this.closeFlatMapModal());

    // Desktop frame toggles
    this.dom.btnSimulatorView?.addEventListener('click', () => this.setSimulatorLayout(true));
    this.dom.btnFullscreenView?.addEventListener('click', () => this.setSimulatorLayout(false));
    this.dom.btnBannerClose?.addEventListener('click', () => {
      if (this.dom.desktopBanner) this.dom.desktopBanner.style.display = 'none';
    });

    // Orientation change
    window.addEventListener('resize', () => this._onWindowResize());
    window.addEventListener('orientationchange', () => this._onWindowResize());
  }

  /**
   * Direct finger swipe / pointer drag on the viewfinder allows immediate rotation
   * on any device (iOS touch, Android touch, desktop mouse)
   */
  _setupPointerDrag() {
    if (!this.hudCanvas) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;

    this.hudCanvas.addEventListener('pointerdown', (e) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      try {
        this.hudCanvas.setPointerCapture(e.pointerId);
      } catch (err) {}
    });

    this.hudCanvas.addEventListener('pointermove', (e) => {
      if (!isDragging) return;
      const dx = e.clientX - startX;
      const dy = e.clientY - startY;
      startX = e.clientX;
      startY = e.clientY;

      // Always allow drag to adjust view when in manual mode or testing
      sensorTracker.setManualOffset(-dx * 0.35, dy * 0.35);
    });

    const endDrag = () => {
      isDragging = false;
    };

    this.hudCanvas.addEventListener('pointerup', endDrag);
    this.hudCanvas.addEventListener('pointercancel', endDrag);
  }

  setMode(mode) {
    if (this.capturedFrames.length > 0) {
      if (!confirm(`Switching mode will reset currently captured frames. Proceed?`)) {
        return;
      }
      this.capturedFrames = [];
    }

    this.captureMode = mode;
    this._initTargetNodes(mode);

    if (this.dom.btnModeSphere) this.dom.btnModeSphere.classList.toggle('active', mode === 'sphere');
    if (this.dom.btnModeHorizon) this.dom.btnModeHorizon.classList.toggle('active', mode === 'horizon');
  }

  zeroHeading() {
    sensorTracker.calibrateZero();
    audioHaptics.vibrate(30);
    if (this.dom.hudGuidanceBanner) {
      this.dom.hudGuidanceBanner.textContent = '🎯 Heading zeroed to current viewpoint!';
    }
  }

  _resizeHudCanvas() {
    if (!this.hudCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.hudCanvas.getBoundingClientRect();
    const w = rect.width || this.hudCanvas.clientWidth || window.innerWidth;
    const h = rect.height || this.hudCanvas.clientHeight || window.innerHeight;

    if (w <= 0 || h <= 0) return;

    this.cssWidth = w;
    this.cssHeight = h;
    this.hudCanvas.width = Math.round(w * dpr);
    this.hudCanvas.height = Math.round(h * dpr);

    if (this.hudCtx) {
      this.hudCtx.resetTransform?.();
      this.hudCtx.scale(dpr, dpr);
    }
  }

  _onWindowResize() {
    this._resizeHudCanvas();
    const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
    if (this.dom.landscapeWarning) {
      this.dom.landscapeWarning.style.display = (this.currentState === 'capture' && isLandscape) ? 'flex' : 'none';
    }
    if (this.viewer) {
      this.viewer.onResize();
    }
  }

  setState(state) {
    this.currentState = state;
    const screens = [
      { id: 'setup', el: this.dom.screenSetup },
      { id: 'capture', el: this.dom.screenCapture },
      { id: 'stitching', el: this.dom.screenStitching },
      { id: 'viewer', el: this.dom.screenViewer }
    ];

    screens.forEach(({ id, el }) => {
      if (el) {
        if (id === state) {
          el.style.display = 'flex';
          el.classList.add('screen-active');
        } else {
          el.style.display = 'none';
          el.classList.remove('screen-active');
        }
      }
    });

    if (state === 'capture') {
      setTimeout(() => this._resizeHudCanvas(), 30);
    }
    this._onWindowResize();
  }

  async startCaptureFlow(simulate = false) {
    try {
      if (simulate) {
        this.cameraStream.startSimulator(() => sensorTracker.getCurrent());
        sensorTracker.manualMode = true;
      } else {
        try {
          await this.cameraStream.startCamera('environment');
        } catch (camErr) {
          console.warn('Camera failed:', camErr);
          const isHttpsIssue = !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
          const alertMsg = isHttpsIssue
            ? `🔒 Camera & Sensors Blocked by iOS Safari:\n\nApple strictly disables camera and motion sensors on local HTTP addresses (e.g. ${location.host}).\n\nHow to fix:\nRun "npm run tunnel" on your Mac to get an instant HTTPS link, then open that link on your iPhone!\n\nStarting 360 Studio in interactive simulator mode for now.`
            : `Unable to access rear camera (${camErr.message}). Starting in interactive simulator mode.`;
          alert(alertMsg);
          this.cameraStream.startSimulator(() => sensorTracker.getCurrent());
          sensorTracker.manualMode = true;
        }

        const sensorResult = await sensorTracker.requestPermission();
        if (!sensorResult.granted) {
          if (this.dom.sensorNotice) {
            this.dom.sensorNotice.style.display = 'block';
            this.dom.sensorNotice.textContent = 'Notice: Gyroscope permission not granted. Enabled touch & arrow manual navigation mode.';
          }
        }
      }

      sensorTracker.start();
      sensorTracker.calibrateZero();

      this.capturedFrames = [];
      this._initTargetNodes(this.captureMode);
      this._updateProgressHud();

      this.setState('capture');
      this._start3DHudLoop();
    } catch (err) {
      console.error('Start capture failed:', err);
      alert('Failed to start capture: ' + err.message);
    }
  }

  _start3DHudLoop() {
    this.lastFrameTime = performance.now();

    const renderLoop = (timestamp) => {
      if (this.currentState !== 'capture') return;

      const dt = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this._render3DHud(dt);
      this.hudAnimId = requestAnimationFrame(renderLoop);
    };

    if (this.hudAnimId) cancelAnimationFrame(this.hudAnimId);
    this.hudAnimId = requestAnimationFrame(renderLoop);
  }

  /**
   * High-Performance 3D HUD Canvas Renderer
   * Projects ALL in-view target dots, beacon guidance beam, reticle, and mini 3D sphere.
   */
  /**
   * High-Performance 3D HUD Canvas Renderer
   * Projects 360° Compass Ribbon Tape, In-view target dots, beacon guidance beam,
   * Pitch attitude gauge, center reticle, and 3D mini-globe radar.
   */
  _render3DHud(dt) {
    if (!this.hudCanvas || !this.hudCtx) return;

    // Verify canvas dimensions without resetting canvas backbuffer every frame
    const currentW = this.hudCanvas.clientWidth || window.innerWidth;
    const currentH = this.hudCanvas.clientHeight || window.innerHeight;
    if (!this.cssWidth || Math.abs(this.cssWidth - currentW) > 2 || Math.abs(this.cssHeight - currentH) > 2) {
      this._resizeHudCanvas();
    }

    const ctx = this.hudCtx;
    const w = this.cssWidth || currentW;
    const h = this.cssHeight || currentH;

    ctx.clearRect(0, 0, w, h);

    const orient = sensorTracker.getCurrent();

    // 1. Update Telemetry Ribbon
    if (this.dom.telemetryHeading) {
      const cardinal = this._getCardinal(orient.relativeYaw);
      this.dom.telemetryHeading.textContent = `🧭 ${Math.round(orient.relativeYaw)}° ${cardinal}`;
    }
    if (this.dom.telemetryElevation) {
      const sign = orient.pitch > 0 ? '+' : '';
      const tag = Math.abs(orient.pitch) < 5 ? 'LEVEL' : orient.pitch > 0 ? 'UP' : 'DOWN';
      this.dom.telemetryElevation.textContent = `📐 ${sign}${Math.round(orient.pitch)}° ${tag}`;
    }
    if (this.dom.telemetryGyroStatus) {
      if (orient.hasGyro && !orient.manualMode) {
        this.dom.telemetryGyroStatus.textContent = '🟢 GYRO SENSORS ACTIVE';
        this.dom.telemetryGyroStatus.style.color = 'var(--cam-green)';
      } else {
        this.dom.telemetryGyroStatus.textContent = '🟡 TOUCH / SWIPE ACTIVE';
        this.dom.telemetryGyroStatus.style.color = 'var(--cam-amber)';
      }
    }

    // 2. Camera Projection Basis Vectors
    const yawRad = ((orient.relativeYaw % 360) * Math.PI) / 180;
    const pitchRad = (orient.pitch * Math.PI) / 180;
    const rollRad = (orient.roll * Math.PI) / 180;

    const fovHRad = ((this.cameraStream.fovH || 65) * Math.PI) / 180;
    const fovVRad = ((this.cameraStream.fovV || 80) * Math.PI) / 180;

    const focalX = (w / 2) / Math.tan(fovHRad / 2);
    const focalY = (h / 2) / Math.tan(fovVRad / 2);

    // Forward, Right, Up vectors
    const cy = Math.cos(yawRad);
    const sy = Math.sin(yawRad);
    const cp = Math.cos(pitchRad);
    const sp = Math.sin(pitchRad);
    const cr = Math.cos(rollRad);
    const sr = Math.sin(rollRad);

    const fwd = { x: sy * cp, y: sp, z: cy * cp };
    const rgt = { x: cy * cr + sy * sp * sr, y: -cp * sr, z: -sy * cr + cy * sp * sr };
    const up = { x: -cy * sr + sy * sp * cr, y: cp * cr, z: sy * sr + cy * sp * cr };

    // 3. Project each target node in 3D
    let nearestNode = null;
    let minDistanceDeg = 999;
    const projectedNodes = [];

    for (const node of this.targetNodes) {
      const nYawRad = ((node.yaw % 360) * Math.PI) / 180;
      const nPitchRad = (node.pitch * Math.PI) / 180;

      // World 3D vector on unit sphere
      const wx = Math.cos(nPitchRad) * Math.sin(nYawRad);
      const wy = Math.sin(nPitchRad);
      const wz = Math.cos(nPitchRad) * Math.cos(nYawRad);

      // Camera coordinates
      const zCam = wx * fwd.x + wy * fwd.y + wz * fwd.z;
      const xCam = wx * rgt.x + wy * rgt.y + wz * rgt.z;
      const yCam = wx * up.x + wy * up.y + wz * up.z;

      // Angular distance on sphere (great-circle distance)
      const dot = Math.max(-1, Math.min(1, zCam));
      const distDeg = (Math.acos(dot) * 180) / Math.PI;

      if (!node.captured && distDeg < minDistanceDeg) {
        minDistanceDeg = distDeg;
        nearestNode = { node, distDeg, zCam, xCam, yCam };
      }

      let screenX = null;
      let screenY = null;
      let inFront = zCam > 0.05;

      if (inFront) {
        screenX = w / 2 + (xCam / zCam) * focalX;
        screenY = h / 2 - (yCam / zCam) * focalY;
      }

      projectedNodes.push({
        node,
        inFront,
        screenX,
        screenY,
        distDeg
      });
    }

    this.activeTargetNode = nearestNode ? nearestNode.node : null;

    // 4. Render All Visible Target Nodes (prominent, high contrast)
    projectedNodes.forEach((p) => {
      if (p.inFront && p.screenX >= -80 && p.screenX <= w + 80 && p.screenY >= -80 && p.screenY <= h + 80) {
        const isTarget = nearestNode && nearestNode.node.id === p.node.id;
        this._drawNodeOnCanvas(ctx, p.screenX, p.screenY, p.node, isTarget, p.distDeg);
      }
    });

    // 5. Draw 3D Beacon Guidance Line to Nearest Target
    if (nearestNode) {
      const targetProj = projectedNodes.find((p) => p.node.id === nearestNode.node.id);
      if (targetProj && targetProj.inFront && targetProj.screenX >= 0 && targetProj.screenX <= w && targetProj.screenY >= 0 && targetProj.screenY <= h) {
        // Glowing laser line connecting center reticle directly to target
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(w / 2, h / 2);
        ctx.lineTo(targetProj.screenX, targetProj.screenY);
        ctx.strokeStyle = 'rgba(6, 182, 212, 0.65)';
        ctx.lineWidth = 2.5;
        ctx.setLineDash([6, 6]);
        ctx.stroke();
        ctx.restore();
      } else {
        // Out-of-FOV Directional Pointer Arrow
        this._drawOffscreenArrow(ctx, w, h, orient, nearestNode.node, nearestNode.distDeg);
      }
    }

    // 6. Draw 360° Scrolling Compass Ribbon Tape
    this._drawCompassTapeRibbon(ctx, w, orient);

    // 7. Draw Pitch Attitude Gauge
    this._drawPitchAttitudeGauge(ctx, w, h, orient);

    // 8. Center Reticle & Level Bubble
    const isAligned = nearestNode && nearestNode.distDeg <= this.snapThreshold;
    this._drawCenterReticle(ctx, w / 2, h / 2, orient, isAligned);

    // 9. Auto-Snap Steady Alignment Countdown & Audio Lock
    if (isAligned && !this.isSnapping) {
      if (!this.hasPlayedLockBeep) {
        audioHaptics.playLockSound();
        audioHaptics.vibrate(40);
        this.hasPlayedLockBeep = true;
      }

      this.lockSteadyTime += dt;
      const progressRatio = Math.min(1.0, this.lockSteadyTime / this.lockDurationRequired);

      // Draw countdown ring around center reticle
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, 46, -Math.PI / 2, -Math.PI / 2 + progressRatio * Math.PI * 2);
      ctx.strokeStyle = '#10b981';
      ctx.lineWidth = 4.5;
      ctx.stroke();

      if (this.dom.hudGuidanceBanner) {
        this.dom.hudGuidanceBanner.textContent = '🎯 ALIGNED — HOLD STEADY...';
        this.dom.hudGuidanceBanner.classList.add('steady');
      }

      if (this.autoSnapEnabled && this.lockSteadyTime >= this.lockDurationRequired) {
        this.snapCurrentFrame();
      }
    } else {
      this.hasPlayedLockBeep = false;
      this.lockSteadyTime = 0;
      if (this.dom.hudGuidanceBanner) {
        this.dom.hudGuidanceBanner.classList.remove('steady');
        if (!nearestNode) {
          this.dom.hudGuidanceBanner.textContent = '🎉 All 360° anchor points captured! Tap Stitch 360.';
          this.dom.hudGuidanceBanner.classList.add('success');
        } else if (nearestNode.node.pitch > 40) {
          this.dom.hudGuidanceBanner.textContent = `▲ Tilt phone up towards the Sky (${Math.round(nearestNode.distDeg)}° away)`;
        } else if (nearestNode.node.pitch < -40) {
          this.dom.hudGuidanceBanner.textContent = `▼ Tilt phone down towards the Ground (${Math.round(nearestNode.distDeg)}° away)`;
        } else {
          this.dom.hudGuidanceBanner.textContent = `Turn slowly to line up with target dot (${Math.round(nearestNode.distDeg)}° away)`;
        }
      }
    }

    // 10. Draw Mini 3D Sphere Radar in Top-Right Corner
    this._drawMiniSphereRadar(ctx, w - 46, 155, orient, this.targetNodes);
  }

  /**
   * Fighter-Jet / Drone Style 360° Compass Ribbon Tape across Top
   */
  _drawCompassTapeRibbon(ctx, w, orient) {
    ctx.save();
    const cx = w / 2;
    const ribbonY = 72;
    const ribbonW = Math.min(w - 24, 340);
    const ribbonH = 40;
    const halfW = ribbonW / 2;

    // Glass backdrop container
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx - halfW, ribbonY - 18, ribbonW, ribbonH, 10);
    } else {
      ctx.rect(cx - halfW, ribbonY - 18, ribbonW, ribbonH);
    }
    ctx.fillStyle = 'rgba(6, 12, 24, 0.88)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Clip region for scrolling tick tape
    ctx.save();
    ctx.beginPath();
    ctx.rect(cx - halfW + 4, ribbonY - 16, ribbonW - 8, ribbonH - 4);
    ctx.clip();

    const pixelsPerDegree = 3.2;
    const heading = orient.relativeYaw;

    const startDeg = Math.floor(heading - halfW / pixelsPerDegree);
    const endDeg = Math.ceil(heading + halfW / pixelsPerDegree);

    for (let deg = startDeg; deg <= endDeg; deg++) {
      const normDeg = ((deg % 360) + 360) % 360;
      const x = cx + (deg - heading) * pixelsPerDegree;

      if (deg % 15 === 0) {
        // Major degree tick
        ctx.beginPath();
        ctx.moveTo(x, ribbonY - 14);
        ctx.lineTo(x, ribbonY - 2);
        ctx.strokeStyle = '#38bdf8';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        let label = `${normDeg}°`;
        if (normDeg === 0) label = 'N (0°)';
        else if (normDeg === 90) label = 'E (90°)';
        else if (normDeg === 180) label = 'S (180°)';
        else if (normDeg === 270) label = 'W (270°)';

        ctx.fillStyle = (normDeg % 90 === 0) ? '#38bdf8' : 'rgba(255, 255, 255, 0.75)';
        ctx.font = 'bold 9px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(label, x, ribbonY + 12);
      } else if (deg % 5 === 0) {
        // Minor tick
        ctx.beginPath();
        ctx.moveTo(x, ribbonY - 10);
        ctx.lineTo(x, ribbonY - 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    }

    // Target pips on ribbon
    this.targetNodes.forEach(node => {
      let diff = ((node.yaw - heading + 540) % 360) - 180;
      const pipX = cx + diff * pixelsPerDegree;
      if (pipX >= cx - halfW + 4 && pipX <= cx + halfW - 4) {
        ctx.beginPath();
        ctx.arc(pipX, ribbonY - 8, node.captured ? 3 : 4, 0, Math.PI * 2);
        ctx.fillStyle = node.captured ? '#10b981' : (this.activeTargetNode?.id === node.id ? '#06b6d4' : '#f59e0b');
        ctx.fill();
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        ctx.stroke();
      }
    });

    ctx.restore(); // finish clip

    // Center indicator chevron pointing down
    ctx.beginPath();
    ctx.moveTo(cx - 6, ribbonY - 18);
    ctx.lineTo(cx + 6, ribbonY - 18);
    ctx.lineTo(cx, ribbonY - 10);
    ctx.closePath();
    ctx.fillStyle = '#06b6d4';
    ctx.fill();

    // Center vertical marker
    ctx.beginPath();
    ctx.moveTo(cx, ribbonY - 10);
    ctx.lineTo(cx, ribbonY + 2);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    // High-visibility Digital Heading Readout Pill right below ribbon
    const cardinal = this._getCardinal(heading);
    const hdgText = `🧭 ${String(Math.round(heading)).padStart(3, '0')}° ${cardinal}`;
    ctx.fillStyle = 'rgba(6, 12, 24, 0.92)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(cx - 56, ribbonY + 26, 112, 22, 6);
    } else {
      ctx.rect(cx - 56, ribbonY + 26, 112, 22);
    }
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.6)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(hdgText, cx, ribbonY + 41);

    ctx.restore();
  }

  /**
   * Pitch Attitude Gauge / Ladder
   */
  _drawPitchAttitudeGauge(ctx, w, h, orient) {
    ctx.save();
    const cy = h / 2;
    const isLevel = Math.abs(orient.pitch) < 3.5;

    // Pitch readout chip on left side
    const pitchText = `📐 PITCH: ${orient.pitch >= 0 ? '+' : ''}${Math.round(orient.pitch)}° ${isLevel ? 'LEVEL' : orient.pitch > 0 ? 'UP' : 'DOWN'}`;
    ctx.fillStyle = isLevel ? 'rgba(16, 185, 129, 0.85)' : 'rgba(6, 12, 24, 0.85)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(20, cy - 14, 140, 26, 6);
    } else {
      ctx.rect(20, cy - 14, 140, 26);
    }
    ctx.fill();
    ctx.strokeStyle = isLevel ? '#10b981' : 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.fillStyle = isLevel ? '#000000' : '#ffffff';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(pitchText, 90, cy + 3);

    ctx.restore();
  }

  /**
   * Render Target Node: Large, High-Contrast, Impossible to miss
   */
  _drawNodeOnCanvas(ctx, x, y, node, isTarget, distDeg = 0) {
    ctx.save();

    if (node.captured) {
      // Captured Green Checkmark Node
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = '#10b981';
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('✓', x, y);

      ctx.font = 'bold 10px monospace';
      ctx.fillStyle = 'rgba(16, 185, 129, 0.9)';
      ctx.fillText('DONE', x, y + 26);
    } else if (isTarget) {
      // Active Target Node: Glowing cyan/amber pulsing ring
      const pulse = Math.sin(performance.now() * 0.008) * 5;
      const radius = 28 + pulse;

      // Dark contrast backplate so it stands out against any background
      ctx.beginPath();
      ctx.arc(x, y, radius + 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.fill();

      // Outer animated radar pulse ring
      ctx.beginPath();
      ctx.arc(x, y, radius + 10, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(6, 182, 212, 0.45)';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Inner target ring
      ctx.beginPath();
      ctx.arc(x, y, radius, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 182, 212, 0.3)';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 3;
      ctx.stroke();

      // Center crosshair pip
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();
      ctx.strokeStyle = '#06b6d4';
      ctx.lineWidth = 2;
      ctx.stroke();

      // Prominent High-Contrast Target Pill Label
      const isStart = node.id === 0 && !node.captured;
      const pillText = isStart
        ? '🎯 START HERE — 0° LEVEL'
        : `🎯 ${node.pitch >= 0 ? '+' : ''}${node.pitch}° ${node.label.toUpperCase()} (${Math.round(distDeg)}°)`;
      ctx.font = 'bold 11px monospace';
      const textW = ctx.measureText(pillText).width + 24;

      ctx.fillStyle = 'rgba(6, 12, 24, 0.94)';
      ctx.beginPath();
      if (ctx.roundRect) {
        ctx.roundRect(x - textW / 2, y + 36, textW, 24, 6);
      } else {
        ctx.rect(x - textW / 2, y + 36, textW, 24);
      }
      ctx.fill();
      ctx.strokeStyle = isStart ? '#f59e0b' : '#06b6d4';
      ctx.lineWidth = 1.5;
      ctx.stroke();

      ctx.fillStyle = isStart ? '#fbbf24' : '#38bdf8';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(pillText, x, y + 48);
    } else {
      // Nearby uncaptured node
      ctx.beginPath();
      ctx.arc(x, y, 16, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(6, 12, 24, 0.65)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
      ctx.lineWidth = 2;
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fillStyle = '#38bdf8';
      ctx.fill();

      // Pitch label
      ctx.font = 'bold 9px monospace';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.textAlign = 'center';
      ctx.fillText(`${node.pitch >= 0 ? '+' : ''}${node.pitch}°`, x, y + 26);
    }

    ctx.restore();
  }

  _drawOffscreenArrow(ctx, w, h, orient, targetNode, distDeg = 0) {
    let diffYaw = ((targetNode.yaw - orient.relativeYaw + 540) % 360) - 180;
    let diffPitch = targetNode.pitch - orient.pitch;

    const angle = Math.atan2(diffPitch, diffYaw); // Angle in radians
    const pad = 75;
    const cx = w / 2;
    const cy = h / 2;

    const arrowX = Math.max(pad, Math.min(w - pad, cx + Math.cos(-angle) * (cx - pad)));
    const arrowY = Math.max(pad + 60, Math.min(h - pad - 80, cy + Math.sin(-angle) * (cy - pad)));

    ctx.save();
    ctx.translate(arrowX, arrowY);

    // Glowing badge
    let guideText = '';
    if (diffPitch > 25) guideText = `▲ Tilt Up ${Math.round(diffPitch)}° to ${targetNode.label}`;
    else if (diffPitch < -25) guideText = `▼ Tilt Down ${Math.round(-diffPitch)}° to ${targetNode.label}`;
    else if (diffYaw > 0) guideText = `Turn Right ${Math.round(diffYaw)}° ➔`;
    else guideText = `⬅ Turn Left ${Math.round(-diffYaw)}°`;

    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'center';
    const textW = ctx.measureText(guideText).width + 28;

    ctx.fillStyle = 'rgba(6, 12, 24, 0.94)';
    ctx.beginPath();
    if (ctx.roundRect) {
      ctx.roundRect(-textW / 2, -18, textW, 36, 8);
    } else {
      ctx.rect(-textW / 2, -18, textW, 36);
    }
    ctx.fill();
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#38bdf8';
    ctx.textBaseline = 'middle';
    ctx.fillText(guideText, 0, 0);

    ctx.restore();
  }

  _drawCenterReticle(ctx, cx, cy, orient, isAligned) {
    ctx.save();

    // Roll rotation
    ctx.translate(cx, cy);
    ctx.rotate((orient.roll * Math.PI) / 180);

    const isLevel = Math.abs(orient.pitch) < 3.5;
    const color = isAligned ? '#10b981' : isLevel ? '#38bdf8' : 'rgba(255, 255, 255, 0.75)';

    // Artificial horizon bar
    ctx.beginPath();
    ctx.moveTo(-65, 0);
    ctx.lineTo(-26, 0);
    ctx.moveTo(26, 0);
    ctx.lineTo(65, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Horizon bar end wings
    ctx.beginPath();
    ctx.moveTo(-65, -6);
    ctx.lineTo(-65, 6);
    ctx.moveTo(65, -6);
    ctx.lineTo(65, 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Center circular reticle
    ctx.beginPath();
    ctx.arc(0, 0, 22, 0, Math.PI * 2);
    ctx.strokeStyle = color;
    ctx.lineWidth = isAligned ? 3.5 : 2;
    ctx.stroke();

    if (isAligned) {
      ctx.fillStyle = 'rgba(16, 185, 129, 0.25)';
      ctx.fill();
    }

    // Center crosshairs
    ctx.beginPath();
    ctx.moveTo(0, -8);
    ctx.lineTo(0, 8);
    ctx.moveTo(-8, 0);
    ctx.lineTo(8, 0);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.restore();
  }

  /**
   * 3D Mini-Globe Radar Widget in top-right corner
   */
  _drawMiniSphereRadar(ctx, cx, cy, orient, nodes) {
    ctx.save();
    const radius = 28;

    // Background sphere
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(6, 10, 20, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(6, 182, 212, 0.5)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Equator line
    ctx.beginPath();
    ctx.ellipse(cx, cy, radius, radius * 0.35, 0, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.stroke();

    // Plot nodes on mini globe
    nodes.forEach((n) => {
      let relYaw = ((n.yaw - orient.relativeYaw + 540) % 360) - 180;
      const yawRad = (relYaw * Math.PI) / 180;
      const pitchRad = (n.pitch * Math.PI) / 180;

      // Simple orthographic projection
      const z = Math.cos(pitchRad) * Math.cos(yawRad);
      if (z > -0.2) {
        const nx = cx + Math.cos(pitchRad) * Math.sin(yawRad) * (radius * 0.85);
        const ny = cy - Math.sin(pitchRad) * (radius * 0.85);

        ctx.beginPath();
        ctx.arc(nx, ny, n.captured ? 2.5 : 1.5, 0, Math.PI * 2);
        ctx.fillStyle = n.captured ? '#10b981' : 'rgba(255, 255, 255, 0.4)';
        ctx.fill();
      }
    });

    // Camera view frustum dot in center
    ctx.beginPath();
    ctx.arc(cx, cy, 3, 0, Math.PI * 2);
    ctx.fillStyle = '#06b6d4';
    ctx.fill();

    ctx.restore();
  }

  _getCardinal(yaw) {
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
    const idx = Math.round((yaw % 360) / 45) % 8;
    return directions[idx];
  }

  /**
   * Snap frame at current orientation (User can tap Shutter anytime!)
   */
  async snapCurrentFrame() {
    if (this.isSnapping) return;
    this.isSnapping = true;

    try {
      audioHaptics.triggerCaptureFeedback();

      if (this.dom.cameraVideo) {
        this.dom.cameraVideo.classList.add('shutter-flash');
        setTimeout(() => this.dom.cameraVideo?.classList.remove('shutter-flash'), 150);
      }

      const snapshot = this.cameraStream.captureFrame();
      const orient = sensorTracker.getCurrent();

      // Find any uncaptured node within 15° of this snapshot
      let matchedNode = null;
      let minDistance = 999;

      for (const node of this.targetNodes) {
        if (!node.captured) {
          let diffYaw = ((node.yaw - orient.relativeYaw + 540) % 360) - 180;
          let diffPitch = node.pitch - orient.pitch;
          const dist = Math.hypot(diffYaw, diffPitch);
          if (dist < minDistance) {
            minDistance = dist;
            if (dist <= 16) {
              matchedNode = node;
            }
          }
        }
      }

      // If no node was strictly within 16°, assign closest or active
      if (!matchedNode && this.activeTargetNode && !this.activeTargetNode.captured) {
        matchedNode = this.activeTargetNode;
      }

      if (matchedNode) {
        matchedNode.captured = true;
      }

      const frameData = {
        canvas: snapshot.canvas,
        yaw: orient.relativeYaw,
        pitch: orient.pitch,
        roll: orient.roll,
        fovH: this.cameraStream.fovH,
        fovV: this.cameraStream.fovV,
        nodeId: matchedNode ? matchedNode.id : this.capturedFrames.length
      };

      this.capturedFrames.push(frameData);
      this._updateProgressHud();

      // Check if all nodes are captured
      const allCaptured = this.targetNodes.every((n) => n.captured);
      if (allCaptured) {
        audioHaptics.playCompleteSound();
        audioHaptics.vibrate([80, 50, 120]);
        setTimeout(() => {
          if (confirm('🎉 All 360° spherical frames captured! Stitch your interactive Photosphere now?')) {
            this.startStitchingProcess();
          }
        }, 300);
      }
    } catch (err) {
      console.error('Frame snap error:', err);
    } finally {
      this.lockSteadyTime = 0;
      this.hasPlayedLockBeep = false;
      setTimeout(() => {
        this.isSnapping = false;
      }, 350);
    }
  }

  _updateProgressHud() {
    const total = this.targetNodes.length;
    const count = this.capturedFrames.length;
    const percent = Math.round((count / total) * 100);

    if (this.dom.progressText) {
      this.dom.progressText.textContent = `${count}/${total}`;
    }

    if (this.dom.captureStatusSubtext) {
      this.dom.captureStatusSubtext.textContent = count >= 4 ? `${count} captured • Ready to stitch!` : `Min 4 frames to stitch (${count}/4)`;
    }

    // Circular progress ring
    if (this.dom.progressRingCircle) {
      const radius = 26;
      const circumference = 2 * Math.PI * radius;
      const offset = circumference - (percent / 100) * circumference;
      this.dom.progressRingCircle.style.strokeDasharray = `${circumference} ${circumference}`;
      this.dom.progressRingCircle.style.strokeDashoffset = `${offset}`;
    }

    // Filmstrip thumbnails
    if (this.dom.filmstripContainer) {
      this.dom.filmstripContainer.innerHTML = '';
      this.capturedFrames.forEach((frame) => {
        const thumb = document.createElement('div');
        thumb.className = 'filmstrip-thumb';
        const sign = frame.pitch >= 0 ? '+' : '';
        thumb.innerHTML = `<canvas width="48" height="64"></canvas><span class="thumb-label">${Math.round(frame.yaw)}°/${sign}${Math.round(frame.pitch)}°</span>`;
        const c = thumb.querySelector('canvas');
        c.getContext('2d').drawImage(frame.canvas, 0, 0, 48, 64);
        this.dom.filmstripContainer.appendChild(thumb);
      });
    }

    // Enable Stitch CTA as soon as >= 4 frames are taken
    if (this.dom.btnFinishStitch) {
      if (count >= 4) {
        this.dom.btnFinishStitch.removeAttribute('disabled');
        this.dom.btnFinishStitch.classList.add('ready');
      } else {
        this.dom.btnFinishStitch.setAttribute('disabled', 'true');
        this.dom.btnFinishStitch.classList.remove('ready');
      }
    }

    if (this.dom.btnUndoFrame) {
      this.dom.btnUndoFrame.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  undoLastFrame() {
    if (this.capturedFrames.length === 0) return;
    const last = this.capturedFrames.pop();
    if (last && typeof last.nodeId === 'number') {
      const n = this.targetNodes.find((item) => item.id === last.nodeId);
      if (n) n.captured = false;
    }
    this._updateProgressHud();
    audioHaptics.vibrate(30);
  }

  resetCaptureSession() {
    if (this.capturedFrames.length > 0 && !confirm('Reset all captured 360 frames and restart?')) {
      return;
    }
    this.capturedFrames = [];
    this._initTargetNodes(this.captureMode);
    this._updateProgressHud();
    sensorTracker.calibrateZero();
  }

  cancelCaptureSession() {
    if (this.capturedFrames.length > 0 && !confirm('Cancel 360 capture and return to home screen?')) {
      return;
    }
    if (this.hudAnimId) cancelAnimationFrame(this.hudAnimId);
    this.cameraStream.stop();
    sensorTracker.stop();
    this.setState('setup');
  }

  toggleAutoSnap() {
    this.autoSnapEnabled = !this.autoSnapEnabled;
    if (this.dom.btnAutoSnapToggle) {
      this.dom.btnAutoSnapToggle.classList.toggle('active', this.autoSnapEnabled);
      this.dom.btnAutoSnapToggle.textContent = this.autoSnapEnabled ? '⚡ Auto-Snap: ON' : '✋ Auto-Snap: OFF';
    }
  }

  async switchCamera() {
    try {
      await this.cameraStream.switchCamera();
    } catch (e) {
      alert('Could not switch camera: ' + e.message);
    }
  }

  async startStitchingProcess() {
    if (this.capturedFrames.length < 3) {
      alert('Please capture at least 3 to 4 frames before stitching.');
      return;
    }

    if (this.hudAnimId) cancelAnimationFrame(this.hudAnimId);
    this.cameraStream.stop();
    sensorTracker.stop();

    this.setState('stitching');

    try {
      const onProgress = (percent, statusText) => {
        if (this.dom.stitchProgressBar) this.dom.stitchProgressBar.style.width = `${percent}%`;
        if (this.dom.stitchProgressPercent) this.dom.stitchProgressPercent.textContent = `${percent}%`;
        if (this.dom.stitchProgressText) this.dom.stitchProgressText.textContent = statusText;
      };

      const panoCanvas = await this.stitcher.stitch(this.capturedFrames, onProgress);
      this.capturedPanoCanvas = panoCanvas;

      setTimeout(() => {
        this.open360Viewer(panoCanvas);
      }, 400);
    } catch (err) {
      console.error('Stitching failed:', err);
      alert('Stitching error: ' + err.message);
      this.setState('capture');
      this.cameraStream.startCamera('environment');
      sensorTracker.start();
      this._start3DHudLoop();
    }
  }

  open360Viewer(panoSource) {
    this.setState('viewer');

    if (!this.viewer) {
      this.viewer = new PanoramaViewer(this.dom.panoViewerContainer);
    }

    this.viewer.loadPanorama(panoSource);
    this.viewer.onResize();

    if (this.dom.imgFlatMapPreview) {
      this.dom.imgFlatMapPreview.src = panoSource.toDataURL ? panoSource.toDataURL('image/jpeg', 0.85) : panoSource.src;
    }
  }

  loadDemoPanorama() {
    const demoCanvas = generateDemoPanorama(2048, 1024);
    this.capturedPanoCanvas = demoCanvas;
    this.open360Viewer(demoCanvas);
  }

  async download360Photo() {
    if (!this.capturedPanoCanvas) return;

    try {
      const btn = this.dom.btnViewerDownload;
      if (btn) btn.textContent = '⏳ Injecting 360 XMP...';

      const rawBlob = await new Promise((resolve) => {
        this.capturedPanoCanvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      const finalBlob = await this.stitcher.injectGPanoMetadata(
        rawBlob,
        this.capturedPanoCanvas.width,
        this.capturedPanoCanvas.height
      );

      const url = URL.createObjectURL(finalBlob);
      const a = document.createElement('a');
      const timeStr = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '');
      a.href = url;
      a.download = `360CAM_Pano_${timeStr}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      if (btn) btn.textContent = '⬇️ Download 360 Photo';
      audioHaptics.vibrate([40, 40]);
    } catch (e) {
      console.error('Download error:', e);
      alert('Failed to download photo: ' + e.message);
    }
  }

  async sharePanorama() {
    if (!this.capturedPanoCanvas) return;

    if (navigator.share && navigator.canShare) {
      try {
        const rawBlob = await new Promise((res) => this.capturedPanoCanvas.toBlob(res, 'image/jpeg', 0.9));
        const file = new File([rawBlob], '360-panorama.jpg', { type: 'image/jpeg' });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: 'My 360° Photosphere',
            text: 'Check out this 360 photo captured with 360 CAM on WebcamClicks!'
          });
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard! You can share it anywhere.');
    } catch (e) {
      alert('Share not supported on this browser. Use Download button to save your 360 photo.');
    }
  }

  retakePanorama() {
    if (confirm('Discard current 360 photo and start a new capture session?')) {
      this.capturedFrames = [];
      this.capturedPanoCanvas = null;
      this.startCaptureFlow(sensorTracker.manualMode);
    }
  }

  toggleViewerGyro() {
    if (!this.viewer) return;
    const active = this.viewer.toggleGyroLook();
    if (this.dom.btnViewerGyro) {
      this.dom.btnViewerGyro.classList.toggle('active', active);
    }
  }

  toggleViewerAutoRotate() {
    if (!this.viewer) return;
    const active = this.viewer.toggleAutoRotate();
    if (this.dom.btnViewerRotate) {
      this.dom.btnViewerRotate.classList.toggle('active', active);
    }
  }

  toggleFullscreen() {
    const el = document.documentElement;
    if (!document.fullscreenElement) {
      if (el.requestFullscreen) el.requestFullscreen().catch(() => {});
    } else {
      if (document.exitFullscreen) document.exitFullscreen().catch(() => {});
    }
  }

  openFlatMapModal() {
    if (this.dom.modalFlatMap) {
      this.dom.modalFlatMap.style.display = 'flex';
    }
  }

  closeFlatMapModal() {
    if (this.dom.modalFlatMap) {
      this.dom.modalFlatMap.style.display = 'none';
    }
  }

  setSimulatorLayout(enableFrame) {
    if (!this.dom.phoneFrame) return;
    if (enableFrame) {
      this.dom.phoneFrame.classList.remove('fullscreen-studio');
      this.dom.btnSimulatorView?.classList.add('active');
      this.dom.btnFullscreenView?.classList.remove('active');
    } else {
      this.dom.phoneFrame.classList.add('fullscreen-studio');
      this.dom.btnSimulatorView?.classList.remove('active');
      this.dom.btnFullscreenView?.classList.add('active');
    }
    if (this.viewer) this.viewer.onResize();
  }
}

// Auto-boot application on DOM ready or immediate if already loaded
function bootApp() {
  if (!window.app360) {
    window.app360 = new ThreeSixtyApp();
    window.app360.init();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootApp);
} else {
  bootApp();
}
