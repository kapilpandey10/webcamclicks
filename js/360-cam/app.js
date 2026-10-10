/**
 * 360 CAM — Main Application Controller
 * Coordinates permissions, camera stream, orientation sensors, capture HUD,
 * auto-snap reticle guidance, spherical stitching, and interactive Three.js 360 viewer.
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

    // Core engines
    this.cameraStream = null;
    this.stitcher = new SphericalStitcher({ width: 2048, height: 1024 });
    this.viewer = null;

    // Captured frames array: { canvas, yaw, pitch, roll, fovH, fovV }
    this.capturedFrames = [];
    this.capturedPanoCanvas = null;

    // Target capture nodes configuration
    // 10 nodes spaced every 36° horizontally
    this.nodeCount = 10;
    this.targetNodes = [];

    // Capture settings
    this.autoSnapEnabled = true;
    this.lockSteadyTime = 0;
    this.lockDurationRequired = 500; // ms holding still within reticle before snap
    this.lastFrameTime = performance.now();
    this.activeTargetNode = null;
    this.isSnapping = false;

    // Alignment thresholds (degrees)
    this.yawThreshold = 5.0;
    this.pitchThreshold = 6.5;
    this.rollThreshold = 8.0;

    // Elements cache
    this.dom = {};
  }

  init() {
    this._cacheElements();
    this._initTargetNodes();
    this._bindEvents();

    // Check query params for quick start or demo
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('demo') === '1') {
      this.loadDemoPanorama();
    }

    // Check for Secure Context (iOS Safari blocks getUserMedia on unencrypted LAN HTTP)
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    const isSecure = window.isSecureContext || isLocalhost;
    if (!isSecure && this.dom.sensorNotice) {
      this.dom.sensorNotice.style.display = 'block';
      this.dom.sensorNotice.style.background = 'rgba(239, 68, 68, 0.15)';
      this.dom.sensorNotice.style.borderColor = 'rgba(239, 68, 68, 0.4)';
      this.dom.sensorNotice.style.color = '#fca5a5';
      this.dom.sensorNotice.innerHTML = `⚠️ <strong>HTTPS Required on iPhone:</strong> iOS Safari strictly disables camera &amp; gyroscope access over unencrypted HTTP (<code>${location.host}</code>). Run <code>npm run tunnel</code> on your Mac or access via HTTPS to use your physical camera!`;
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
      captureHud: document.getElementById('capture-hud'),
      horizonBar: document.getElementById('horizon-bar'),
      reticleCenter: document.getElementById('reticle-center'),
      reticleBubble: document.getElementById('reticle-bubble'),
      floatingTargetNode: document.getElementById('floating-target-node'),
      directionArrow: document.getElementById('direction-arrow'),
      directionText: document.getElementById('direction-text'),
      progressRingCircle: document.getElementById('progress-ring-circle'),
      progressText: document.getElementById('progress-text'),
      frameCounterBadge: document.getElementById('frame-counter-badge'),
      hudGuidanceBanner: document.getElementById('hud-guidance-banner'),
      filmstripContainer: document.getElementById('filmstrip-container'),
      radarNodesContainer: document.getElementById('radar-nodes-container'),
      telemetryYaw: document.getElementById('telem-yaw'),
      telemetryPitch: document.getElementById('telem-pitch'),
      telemetryRoll: document.getElementById('telem-roll'),
      manualControlsBar: document.getElementById('manual-controls-bar'),
      landscapeWarning: document.getElementById('landscape-warning'),

      // Action triggers
      btnShutter: document.getElementById('btn-shutter'),
      btnFinishStitch: document.getElementById('btn-finish-stitch'),
      btnCancelCapture: document.getElementById('btn-cancel-capture'),
      btnUndoFrame: document.getElementById('btn-undo-frame'),
      btnResetFrames: document.getElementById('btn-reset-frames'),
      btnSwitchCamera: document.getElementById('btn-switch-camera'),
      btnAutoSnapToggle: document.getElementById('btn-autosnap-toggle'),
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

    this.cameraStream = new CameraStream(this.dom.cameraVideo);
  }

  _initTargetNodes() {
    this.targetNodes = [];
    const step = 360 / this.nodeCount;
    for (let i = 0; i < this.nodeCount; i++) {
      this.targetNodes.push({
        index: i,
        yaw: i * step,
        pitch: 0,
        captured: false,
        thumbnail: null
      });
    }
    this._renderRadarDots();
  }

  _renderRadarDots() {
    if (!this.dom.radarNodesContainer) return;
    this.dom.radarNodesContainer.innerHTML = '';
    this.targetNodes.forEach((node) => {
      const dot = document.createElement('div');
      dot.className = `radar-dot ${node.captured ? 'captured' : ''}`;
      dot.id = `radar-dot-${node.index}`;
      dot.title = `Yaw ${Math.round(node.yaw)}°`;
      this.dom.radarNodesContainer.appendChild(dot);
    });
  }

  _bindEvents() {
    // Setup actions
    this.dom.btnStartCapture?.addEventListener('click', () => this.startCaptureFlow(false));
    this.dom.btnSimulateCapture?.addEventListener('click', () => this.startCaptureFlow(true));
    this.dom.btnTryDemo?.addEventListener('click', () => this.loadDemoPanorama());

    // Capture actions
    this.dom.btnShutter?.addEventListener('click', () => this.snapCurrentFrame());
    this.dom.btnFinishStitch?.addEventListener('click', () => this.startStitchingProcess());
    this.dom.btnCancelCapture?.addEventListener('click', () => this.cancelCaptureSession());
    this.dom.btnUndoFrame?.addEventListener('click', () => this.undoLastFrame());
    this.dom.btnResetFrames?.addEventListener('click', () => this.resetCaptureSession());
    this.dom.btnSwitchCamera?.addEventListener('click', () => this.switchCamera());
    this.dom.btnAutoSnapToggle?.addEventListener('click', () => this.toggleAutoSnap());

    // Manual step buttons for desktop / non-gyro environments
    this.dom.btnManualLeft?.addEventListener('click', () => sensorTracker.setManualOffset(-36, 0));
    this.dom.btnManualRight?.addEventListener('click', () => sensorTracker.setManualOffset(36, 0));
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

    // Touch swipe on capture viewfinder for manual yaw rotation on desktop/laptops
    let touchStartX = 0;
    let touchStartY = 0;
    this.dom.screenCapture?.addEventListener('pointerdown', (e) => {
      touchStartX = e.clientX;
      touchStartY = e.clientY;
    });

    this.dom.screenCapture?.addEventListener('pointermove', (e) => {
      if (e.buttons === 1 && sensorTracker.manualMode) {
        const dx = e.clientX - touchStartX;
        const dy = e.clientY - touchStartY;
        touchStartX = e.clientX;
        touchStartY = e.clientY;
        sensorTracker.setManualOffset(-dx * 0.25, dy * 0.25);
      }
    });

    // Listen to screen orientation changes (portrait vs landscape)
    window.addEventListener('resize', () => this._checkOrientation());
    window.addEventListener('orientationchange', () => this._checkOrientation());
  }

  _checkOrientation() {
    const isLandscape = window.innerWidth > window.innerHeight && window.innerWidth < 1024;
    if (this.dom.landscapeWarning) {
      this.dom.landscapeWarning.style.display = (this.currentState === 'capture' && isLandscape) ? 'flex' : 'none';
    }
    if (this.viewer) {
      this.viewer.onResize();
    }
  }

  /**
   * Transition between screen states
   */
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

    this._checkOrientation();
  }

  /**
   * Start sequential permissions flow and enter capture interface
   */
  async startCaptureFlow(simulate = false) {
    try {
      if (simulate) {
        // Desktop / Simulator Mode
        this.cameraStream.startSimulator(() => sensorTracker.getCurrent());
        sensorTracker.manualMode = true;
      } else {
        // Step 1: Sequential Camera Access
        try {
          await this.cameraStream.startCamera('environment');
        } catch (camErr) {
          console.warn('Camera stream failed, falling back to simulator:', camErr);
          const isHttpsIssue = !window.isSecureContext && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1';
          const alertMsg = isHttpsIssue
            ? `🔒 Camera & Gyroscope Blocked by iOS Safari:\n\nApple strictly disables camera and motion sensors on local HTTP addresses (e.g. ${location.host}).\n\nHow to fix:\nRun "npm run tunnel" on your Mac to get an instant secure HTTPS link, then open that link on your iPhone.\n\nStarting 360 Studio in interactive simulator mode for now.`
            : `Unable to access rear camera (${camErr.message}). Starting 360 Studio in interactive simulator mode.`;
          alert(alertMsg);
          this.cameraStream.startSimulator(() => sensorTracker.getCurrent());
          sensorTracker.manualMode = true;
        }

        // Step 2: Gyroscope & Motion Sensor Access (iOS 13+ requires user gesture)
        const sensorResult = await sensorTracker.requestPermission();
        if (!sensorResult.granted) {
          if (this.dom.sensorNotice) {
            this.dom.sensorNotice.style.display = 'block';
            this.dom.sensorNotice.textContent = 'Notice: Gyroscope permission not granted. Enabled touch & arrow manual navigation mode.';
          }
        }
      }

      // Initialize tracker
      sensorTracker.start();
      sensorTracker.calibrateZero();

      // Reset captures
      this.capturedFrames = [];
      this._initTargetNodes();
      this._updateProgressHud();

      // Enter capture state
      this.setState('capture');

      // Start live HUD render loop
      this._startHudLoop();
    } catch (err) {
      console.error('Start capture flow failed:', err);
      alert('Failed to initialize 360 capture session: ' + err.message);
    }
  }

  _startHudLoop() {
    this.lastFrameTime = performance.now();

    const loop = (timestamp) => {
      if (this.currentState !== 'capture') return;

      const dt = timestamp - this.lastFrameTime;
      this.lastFrameTime = timestamp;

      this._updateHud(dt);
      requestAnimationFrame(loop);
    };

    requestAnimationFrame(loop);
  }

  /**
   * Real-time HUD and Reticle update loop
   */
  _updateHud(dt) {
    const orient = sensorTracker.getCurrent();

    // 1. Update Telemetry displays
    if (this.dom.telemetryYaw) this.dom.telemetryYaw.textContent = `${Math.round(orient.relativeYaw)}°`;
    if (this.dom.telemetryPitch) this.dom.telemetryPitch.textContent = `${Math.round(orient.pitch)}°`;
    if (this.dom.telemetryRoll) this.dom.telemetryRoll.textContent = `${Math.round(orient.roll)}°`;

    // 2. Artificial Horizon Bar (Roll angle rotation)
    if (this.dom.horizonBar) {
      this.dom.horizonBar.style.transform = `translate(-50%, -50%) rotate(${orient.roll}deg)`;
    }

    // 3. Pitch Bubble Level (Vertical offset inside reticle)
    if (this.dom.reticleBubble) {
      const bubbleMaxOffset = 45; // pixels
      const bubbleY = Math.max(-bubbleMaxOffset, Math.min(bubbleMaxOffset, orient.pitch * 3.5));
      const bubbleX = Math.max(-bubbleMaxOffset, Math.min(bubbleMaxOffset, orient.roll * 2.0));
      this.dom.reticleBubble.style.transform = `translate(calc(-50% + ${bubbleX}px), calc(-50% + ${bubbleY}px))`;
    }

    // Show manual controls bar if gyro is unavailable or manual mode active
    if (this.dom.manualControlsBar) {
      this.dom.manualControlsBar.style.display = orient.manualMode ? 'flex' : 'none';
    }

    // 4. Find nearest uncaptured target node
    let nearestNode = null;
    let minDiffYaw = 999;
    let minSignedDiff = 0;

    for (const node of this.targetNodes) {
      if (!node.captured) {
        let diff = ((node.yaw - orient.relativeYaw + 540) % 360) - 180;
        if (Math.abs(diff) < minDiffYaw) {
          minDiffYaw = Math.abs(diff);
          minSignedDiff = diff;
          nearestNode = node;
        }
      }
    }

    this.activeTargetNode = nearestNode;

    // 5. Update Radar dots active highlights
    this.targetNodes.forEach((node) => {
      const dotEl = document.getElementById(`radar-dot-${node.index}`);
      if (dotEl) {
        if (node.captured) {
          dotEl.className = 'radar-dot captured';
        } else if (nearestNode && node.index === nearestNode.index) {
          dotEl.className = 'radar-dot next-target';
        } else {
          dotEl.className = 'radar-dot';
        }
      }
    });

    if (!nearestNode) {
      // All nodes captured!
      if (this.dom.floatingTargetNode) this.dom.floatingTargetNode.style.display = 'none';
      if (this.dom.directionArrow) this.dom.directionArrow.style.display = 'none';
      if (this.dom.hudGuidanceBanner) {
        this.dom.hudGuidanceBanner.textContent = '🎉 All 360° frames captured! Tap Finish to stitch.';
        this.dom.hudGuidanceBanner.classList.add('success');
      }
      return;
    }

    // 6. Calculate in-view projection for active target node
    const fovH = this.cameraStream.fovH || 65;
    const fovV = this.cameraStream.fovV || 80;
    const hudW = this.dom.captureHud?.clientWidth || window.innerWidth;
    const hudH = this.dom.captureHud?.clientHeight || window.innerHeight;

    const diffPitch = nearestNode.pitch - orient.pitch;
    const isInsideFov = Math.abs(minSignedDiff) <= fovH * 0.55;

    if (isInsideFov) {
      // In-view floating target ring
      if (this.dom.floatingTargetNode) {
        this.dom.floatingTargetNode.style.display = 'flex';
        const screenX = hudW / 2 + (minSignedDiff / (fovH / 2)) * (hudW / 2);
        const screenY = hudH / 2 - (diffPitch / (fovV / 2)) * (hudH / 2);
        this.dom.floatingTargetNode.style.left = `${screenX}px`;
        this.dom.floatingTargetNode.style.top = `${screenY}px`;
      }
      if (this.dom.directionArrow) this.dom.directionArrow.style.display = 'none';
    } else {
      // Out-of-view directional turn arrow
      if (this.dom.floatingTargetNode) this.dom.floatingTargetNode.style.display = 'none';
      if (this.dom.directionArrow) {
        this.dom.directionArrow.style.display = 'flex';
        const turnRight = minSignedDiff > 0;
        this.dom.directionArrow.className = `direction-arrow ${turnRight ? 'arrow-right' : 'arrow-left'}`;
        if (this.dom.directionText) {
          this.dom.directionText.textContent = turnRight
            ? `Turn Right ${Math.round(minDiffYaw)}° ➔`
            : `⬅ Turn Left ${Math.round(minDiffYaw)}°`;
        }
      }
    }

    // 7. Alignment Lock Detection
    const isYawAligned = Math.abs(minSignedDiff) <= this.yawThreshold;
    const isPitchAligned = Math.abs(diffPitch) <= this.pitchThreshold;
    const isRollAligned = Math.abs(orient.roll) <= this.rollThreshold;
    const isFullyAligned = isYawAligned && isPitchAligned && isRollAligned;

    if (isFullyAligned) {
      this.dom.reticleCenter?.classList.add('aligned');
      this.dom.floatingTargetNode?.classList.add('aligned');

      this.lockSteadyTime += dt;
      const progressPercent = Math.min(100, (this.lockSteadyTime / this.lockDurationRequired) * 100);

      if (this.dom.hudGuidanceBanner) {
        this.dom.hudGuidanceBanner.textContent = '🎯 ALIGNED — HOLD STEADY...';
        this.dom.hudGuidanceBanner.classList.add('steady');
      }

      // Auto-Snap trigger
      if (this.autoSnapEnabled && this.lockSteadyTime >= this.lockDurationRequired && !this.isSnapping) {
        this.snapCurrentFrame();
      }
    } else {
      this.dom.reticleCenter?.classList.remove('aligned');
      this.dom.floatingTargetNode?.classList.remove('aligned');
      this.lockSteadyTime = 0;

      if (this.dom.hudGuidanceBanner) {
        this.dom.hudGuidanceBanner.classList.remove('steady', 'success');
        if (!isInsideFov) {
          this.dom.hudGuidanceBanner.textContent = minSignedDiff > 0 ? 'Rotate right to next target node' : 'Rotate left to next target node';
        } else if (!isPitchAligned) {
          this.dom.hudGuidanceBanner.textContent = orient.pitch > 0 ? 'Tilt down to level horizon' : 'Tilt up to level horizon';
        } else if (!isRollAligned) {
          this.dom.hudGuidanceBanner.textContent = 'Keep phone upright (no roll tilt)';
        } else {
          this.dom.hudGuidanceBanner.textContent = 'Align reticle with glowing target dot';
        }
      }
    }
  }

  /**
   * Capture still snapshot from camera stream at current orientation
   */
  async snapCurrentFrame() {
    if (this.isSnapping) return;
    this.isSnapping = true;

    try {
      // 1. Shutter sound & haptics
      audioHaptics.triggerCaptureFeedback();

      // Flash animation on viewfinder
      if (this.dom.cameraVideo) {
        this.dom.cameraVideo.classList.add('shutter-flash');
        setTimeout(() => this.dom.cameraVideo?.classList.remove('shutter-flash'), 200);
      }

      // 2. Capture still from video stream
      const snapshot = this.cameraStream.captureFrame();
      const orient = sensorTracker.getCurrent();

      // Find which target node this represents
      let targetNode = this.activeTargetNode;
      if (!targetNode) {
        // Fallback: pick closest node
        targetNode = this.targetNodes.find((n) => !n.captured) || this.targetNodes[0];
      }

      const frameData = {
        canvas: snapshot.canvas,
        yaw: orient.relativeYaw,
        pitch: orient.pitch,
        roll: orient.roll,
        fovH: this.cameraStream.fovH,
        fovV: this.cameraStream.fovV,
        nodeIndex: targetNode ? targetNode.index : this.capturedFrames.length
      };

      this.capturedFrames.push(frameData);

      if (targetNode) {
        targetNode.captured = true;
        // Generate tiny thumbnail for filmstrip
        const thumbCanvas = document.createElement('canvas');
        thumbCanvas.width = 60;
        thumbCanvas.height = 80;
        const tCtx = thumbCanvas.getContext('2d');
        tCtx.drawImage(snapshot.canvas, 0, 0, 60, 80);
        targetNode.thumbnail = thumbCanvas.toDataURL('image/jpeg', 0.7);
      }

      this._updateProgressHud();

      // Check if all nodes are captured
      const allCaptured = this.targetNodes.every((n) => n.captured);
      if (allCaptured) {
        audioHaptics.playCompleteSound();
        audioHaptics.vibrate([80, 50, 120]);
        setTimeout(() => {
          if (confirm('All 360° anchor frames captured! Proceed to stitch panorama now?')) {
            this.startStitchingProcess();
          }
        }, 300);
      }
    } catch (err) {
      console.error('Frame snap error:', err);
    } finally {
      this.lockSteadyTime = 0;
      setTimeout(() => {
        this.isSnapping = false;
      }, 500);
    }
  }

  _updateProgressHud() {
    const total = this.targetNodes.length;
    const count = this.capturedFrames.length;
    const percent = Math.round((count / total) * 100);

    // Frame counter
    if (this.dom.progressText) {
      this.dom.progressText.textContent = `${count}/${total}`;
    }
    if (this.dom.frameCounterBadge) {
      this.dom.frameCounterBadge.textContent = `${count} of ${total} (${percent}%)`;
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
      this.capturedFrames.forEach((frame, idx) => {
        const thumb = document.createElement('div');
        thumb.className = 'filmstrip-thumb';
        thumb.innerHTML = `<canvas width="48" height="64"></canvas><span class="thumb-label">${Math.round(frame.yaw)}°</span>`;
        const c = thumb.querySelector('canvas');
        c.getContext('2d').drawImage(frame.canvas, 0, 0, 48, 64);
        this.dom.filmstripContainer.appendChild(thumb);
      });
    }

    // Enable / Highlight Finish button if at least 4 frames captured
    if (this.dom.btnFinishStitch) {
      if (count >= 4) {
        this.dom.btnFinishStitch.removeAttribute('disabled');
        this.dom.btnFinishStitch.classList.add('ready');
      } else {
        this.dom.btnFinishStitch.setAttribute('disabled', 'true');
        this.dom.btnFinishStitch.classList.remove('ready');
      }
    }

    // Undo button
    if (this.dom.btnUndoFrame) {
      this.dom.btnUndoFrame.style.display = count > 0 ? 'inline-flex' : 'none';
    }
  }

  undoLastFrame() {
    if (this.capturedFrames.length === 0) return;
    const last = this.capturedFrames.pop();
    if (last && typeof last.nodeIndex === 'number' && this.targetNodes[last.nodeIndex]) {
      this.targetNodes[last.nodeIndex].captured = false;
    }
    this._updateProgressHud();
    audioHaptics.vibrate(30);
  }

  resetCaptureSession() {
    if (this.capturedFrames.length > 0 && !confirm('Reset all captured 360 frames and restart?')) {
      return;
    }
    this.capturedFrames = [];
    this._initTargetNodes();
    this._updateProgressHud();
    sensorTracker.calibrateZero();
  }

  cancelCaptureSession() {
    if (this.capturedFrames.length > 0 && !confirm('Cancel 360 capture and return to home screen?')) {
      return;
    }
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

  /**
   * Process and stitch captured frames into an equirectangular panorama
   */
  async startStitchingProcess() {
    if (this.capturedFrames.length < 3) {
      alert('Please capture at least 3 to 4 frames across 360° before stitching.');
      return;
    }

    // Stop camera and sensors during heavy compute
    this.cameraStream.stop();
    sensorTracker.stop();

    this.setState('stitching');

    try {
      const onProgress = (percent, statusText) => {
        if (this.dom.stitchProgressBar) this.dom.stitchProgressBar.style.width = `${percent}%`;
        if (this.dom.stitchProgressPercent) this.dom.stitchProgressPercent.textContent = `${percent}%`;
        if (this.dom.stitchProgressText) this.dom.stitchProgressText.textContent = statusText;
      };

      // Execute Spherical Stitcher
      const panoCanvas = await this.stitcher.stitch(this.capturedFrames, onProgress);
      this.capturedPanoCanvas = panoCanvas;

      // Launch 360 Interactive Viewer
      setTimeout(() => {
        this.open360Viewer(panoCanvas);
      }, 400);
    } catch (err) {
      console.error('Stitching failed:', err);
      alert('Stitching error: ' + err.message);
      this.setState('capture');
      this.cameraStream.startCamera('environment');
      sensorTracker.start();
    }
  }

  /**
   * Initialize and display Three.js 360 Interactive Viewer
   */
  open360Viewer(panoSource) {
    this.setState('viewer');

    if (!this.viewer) {
      this.viewer = new PanoramaViewer(this.dom.panoViewerContainer);
    }

    this.viewer.loadPanorama(panoSource);
    this.viewer.onResize();

    // Set preview image for flat map modal
    if (this.dom.imgFlatMapPreview) {
      this.dom.imgFlatMapPreview.src = panoSource.toDataURL ? panoSource.toDataURL('image/jpeg', 0.85) : panoSource.src;
    }
  }

  /**
   * Load synthetic pre-generated 360 demo scene
   */
  loadDemoPanorama() {
    const demoCanvas = generateDemoPanorama(2048, 1024);
    this.capturedPanoCanvas = demoCanvas;
    this.open360Viewer(demoCanvas);
  }

  /**
   * Download 360 equirectangular photo with Google Photo Sphere / Facebook 360 XMP metadata
   */
  async download360Photo() {
    if (!this.capturedPanoCanvas) return;

    try {
      const btn = this.dom.btnViewerDownload;
      if (btn) btn.textContent = '⏳ Injecting 360 XMP...';

      // Convert canvas to JPEG blob
      const rawBlob = await new Promise((resolve) => {
        this.capturedPanoCanvas.toBlob(resolve, 'image/jpeg', 0.95);
      });

      // Inject GPano metadata
      const finalBlob = await this.stitcher.injectGPanoMetadata(
        rawBlob,
        this.capturedPanoCanvas.width,
        this.capturedPanoCanvas.height
      );

      // Trigger browser file download
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
            title: 'My 360° Panorama Photo',
            text: 'Check out this 360 photo captured with 360 CAM on WebcamClicks!'
          });
          return;
        }
      } catch (err) {
        if (err.name !== 'AbortError') console.warn('Share error:', err);
      }
    }

    // Fallback: copy current page link
    try {
      await navigator.clipboard.writeText(window.location.href);
      alert('Link copied to clipboard! You can share it anywhere.');
    } catch (e) {
      alert('Share not supported on this browser. Use the Download button to save your 360 photo.');
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

// Auto-boot application on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  window.app360 = new ThreeSixtyApp();
  window.app360.init();
});
