/**
 * 360 CAM — Camera Stream & Frame Capture Engine
 * Handles getUserMedia with fallback permissions, high-res frame capture,
 * facing mode switching, and synthetic virtual camera generation for simulator mode.
 */

export class CameraStream {
  constructor(videoElement) {
    this.video = videoElement;
    this.stream = null;
    this.activeTrack = null;
    this.facingMode = 'environment'; // preferred for 360 panoramas
    this.isSimulator = false;
    this.simCanvas = null;
    this.simCtx = null;
    this.simAnimId = null;

    // Camera field of view estimations (degrees)
    // Standard smartphone main wide lens is ~65°-72° horizontal FOV in portrait mode
    this.fovH = 65.0;
    this.fovV = 80.0;
  }

  /**
   * Start camera with progressive fallback
   */
  async startCamera(preferFacing = 'environment') {
    this.stop();
    this.isSimulator = false;
    this.facingMode = preferFacing;

    const constraintsList = [
      // 1. High-resolution rear camera
      {
        video: {
          facingMode: { ideal: this.facingMode },
          width: { ideal: 1920, min: 1280 },
          height: { ideal: 1080, min: 720 },
        },
        audio: false
      },
      // 2. Standard resolution with facingMode
      {
        video: {
          facingMode: { ideal: this.facingMode }
        },
        audio: false
      },
      // 3. Any available video device
      {
        video: true,
        audio: false
      }
    ];

    // Check for secure context (HTTPS / localhost required by iOS Safari)
    const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
    if (!window.isSecureContext && !isLocalhost) {
      throw new Error(
        'HTTPS is required by iOS Safari on local network connections. ' +
        'Please access via HTTPS (e.g. cloudflared tunnel or https:// link).'
      );
    }

    // Polyfill navigator.mediaDevices if missing or legacy
    if (!navigator.mediaDevices) {
      navigator.mediaDevices = {};
    }
    if (!navigator.mediaDevices.getUserMedia) {
      const legacyGUM = navigator.getUserMedia ||
        navigator.webkitGetUserMedia ||
        navigator.mozGetUserMedia ||
        navigator.msGetUserMedia;
      if (legacyGUM) {
        navigator.mediaDevices.getUserMedia = function (c) {
          return new Promise((resolve, reject) => {
            legacyGUM.call(navigator, c, resolve, reject);
          });
        };
      }
    }

    let lastError = null;

    for (const constraints of constraintsList) {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('MediaDevices API not supported in this browser context (HTTPS required)');
        }

        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        this.stream = stream;
        this.video.srcObject = stream;
        this.activeTrack = stream.getVideoTracks()[0];

        // Wait for video metadata to load
        await new Promise((resolve) => {
          if (this.video.readyState >= 2) {
            resolve();
          } else {
            this.video.onloadedmetadata = () => resolve();
          }
        });

        await this.video.play();
        this._estimateFov();
        return { success: true, mode: 'hardware', facingMode: this.facingMode };
      } catch (err) {
        lastError = err;
        console.warn('getUserMedia constraint attempt failed:', constraints, err);
      }
    }

    throw lastError || new Error('Could not access camera.');
  }

  /**
   * Start synthetic virtual camera generator for desktop / simulator mode
   */
  startSimulator(getCurrentOrientationFn) {
    this.stop();
    this.isSimulator = true;

    if (!this.simCanvas) {
      this.simCanvas = document.createElement('canvas');
      this.simCanvas.width = 1080;
      this.simCanvas.height = 1440;
      this.simCtx = this.simCanvas.getContext('2d');
    }

    // Create stream from canvas if supported
    if (this.simCanvas.captureStream) {
      this.stream = this.simCanvas.captureStream(30);
      this.video.srcObject = this.stream;
      this.video.play().catch(() => {});
    }

    const renderVirtualFrame = () => {
      if (!this.isSimulator) return;

      const orient = getCurrentOrientationFn ? getCurrentOrientationFn() : { yaw: 0, pitch: 0, roll: 0 };
      this._drawVirtualScene(orient.yaw, orient.pitch, orient.roll);

      this.simAnimId = requestAnimationFrame(renderVirtualFrame);
    };

    renderVirtualFrame();
    return { success: true, mode: 'simulator' };
  }

  /**
   * Estimate field of view from video dimensions
   */
  _estimateFov() {
    const w = this.video.videoWidth || 1080;
    const h = this.video.videoHeight || 1920;
    const aspect = w / h;

    if (aspect > 1) {
      // Landscape video feed
      this.fovH = 72.0;
      this.fovV = 72.0 / aspect;
    } else {
      // Portrait video feed (standard mobile grip)
      this.fovH = 62.0;
      this.fovV = 62.0 / aspect;
    }
  }

  /**
   * Toggle between rear (environment) and front (user) camera
   */
  async switchCamera() {
    const nextFacing = this.facingMode === 'environment' ? 'user' : 'environment';
    return await this.startCamera(nextFacing);
  }

  /**
   * Capture a full-resolution still frame from current video feed
   * @returns {{ canvas: HTMLCanvasElement, width: number, height: number }}
   */
  captureFrame() {
    const offscreen = document.createElement('canvas');
    const ctx = offscreen.getContext('2d', { willReadFrequently: true });

    if (this.isSimulator && this.simCanvas) {
      offscreen.width = this.simCanvas.width;
      offscreen.height = this.simCanvas.height;
      ctx.drawImage(this.simCanvas, 0, 0);
    } else {
      const vw = this.video.videoWidth || 1080;
      const vh = this.video.videoHeight || 1920;
      offscreen.width = vw;
      offscreen.height = vh;

      // Handle front camera selfie mirror inversion if needed
      if (this.facingMode === 'user') {
        ctx.translate(vw, 0);
        ctx.scale(-1, 1);
      }
      ctx.drawImage(this.video, 0, 0, vw, vh);
    }

    return {
      canvas: offscreen,
      width: offscreen.width,
      height: offscreen.height
    };
  }

  /**
   * Render dynamic synthetic 360 indoor/outdoor spatial environment onto simCanvas
   * Generates a 360 world with mountains, cyber skyline, sun, compass headings, and grid.
   */
  _drawVirtualScene(yaw = 0, pitch = 0, roll = 0) {
    const ctx = this.simCtx;
    const w = this.simCanvas.width;
    const h = this.simCanvas.height;

    ctx.save();

    // Apply roll rotation about center
    ctx.translate(w / 2, h / 2);
    ctx.rotate((roll * Math.PI) / 180);
    ctx.translate(-w / 2, -h / 2);

    // Horizon line moves with pitch
    const pitchOffset = (pitch / (this.fovV / 2)) * (h / 2);
    const horizonY = h / 2 + pitchOffset;

    // Sky gradient
    const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
    skyGrad.addColorStop(0, '#0a192f');
    skyGrad.addColorStop(0.5, '#1e3a8a');
    skyGrad.addColorStop(1, '#f97316');
    ctx.fillStyle = skyGrad;
    ctx.fillRect(0, 0, w, Math.max(0, horizonY));

    // Ground gradient
    const groundGrad = ctx.createLinearGradient(0, horizonY, 0, h);
    groundGrad.addColorStop(0, '#1c1917');
    groundGrad.addColorStop(0.3, '#0f172a');
    groundGrad.addColorStop(1, '#020617');
    ctx.fillStyle = groundGrad;
    ctx.fillRect(0, Math.max(0, horizonY), w, Math.max(0, h - horizonY));

    // Distance Mountains & Skyline projected by yaw
    const normYaw = ((yaw % 360) + 360) % 360; // 0 to 360

    // Draw panoramic landmark features across yaw
    const landmarks = [
      { yaw: 0, label: 'NORTH 360°', color: '#38bdf8', icon: '🏛️ Modern Capitol' },
      { yaw: 45, label: 'NE 045°', color: '#818cf8', icon: '🌲 Alpine Ridge' },
      { yaw: 90, label: 'EAST 090°', color: '#fb923c', icon: '🌅 Sunrise Harbor' },
      { yaw: 135, label: 'SE 135°', color: '#f43f5e', icon: '🗼 Broadcast Tower' },
      { yaw: 180, label: 'SOUTH 180°', color: '#ec4899', icon: '🏙️ Cyber Metropolis' },
      { yaw: 225, label: 'SW 225°', color: '#a855f7', icon: '🌉 Suspension Bridge' },
      { yaw: 270, label: 'WEST 270°', color: '#6366f1', icon: '⛰️ Sunset Peak' },
      { yaw: 315, label: 'NW 315°', color: '#06b6d4', icon: '🛰️ Observatories' }
    ];

    // Draw mountain silhouettes along horizon
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    for (let x = 0; x <= w; x += 30) {
      const worldYaw = normYaw + ((x - w / 2) / (w / 2)) * (this.fovH / 2);
      const mRad = (worldYaw * Math.PI) / 180;
      const mountainH = Math.sin(mRad * 3) * 60 + Math.cos(mRad * 7) * 40 + Math.sin(mRad * 13) * 20;
      ctx.lineTo(x, horizonY - 40 - Math.abs(mountainH));
    }
    ctx.lineTo(w, horizonY);
    ctx.closePath();
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();

    // Draw futuristic buildings and landmark towers
    landmarks.forEach((lm) => {
      let diff = ((lm.yaw - normYaw + 540) % 360) - 180;
      const screenX = w / 2 + (diff / (this.fovH / 2)) * (w / 2);

      if (screenX >= -200 && screenX <= w + 200) {
        // Building / Tower
        ctx.fillStyle = lm.color;
        ctx.globalAlpha = 0.85;

        // Pillar
        const bWidth = 70;
        const bHeight = 220;
        ctx.fillRect(screenX - bWidth / 2, horizonY - bHeight, bWidth, bHeight);

        // Tower antenna
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(screenX, horizonY - bHeight);
        ctx.lineTo(screenX, horizonY - bHeight - 50);
        ctx.stroke();

        // Beacon light
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(screenX, horizonY - bHeight - 52, 6, 0, Math.PI * 2);
        ctx.fill();

        // Label banner
        ctx.globalAlpha = 1.0;
        ctx.fillStyle = 'rgba(0,0,0,0.7)';
        ctx.fillRect(screenX - 80, horizonY - bHeight - 110, 160, 44);
        ctx.strokeStyle = lm.color;
        ctx.lineWidth = 1.5;
        ctx.strokeRect(screenX - 80, horizonY - bHeight - 110, 160, 44);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(lm.label, screenX, horizonY - bHeight - 90);
        ctx.font = '13px sans-serif';
        ctx.fillStyle = lm.color;
        ctx.fillText(lm.icon, screenX, horizonY - bHeight - 74);
      }
    });

    // Ground perspective grid
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
    ctx.lineWidth = 1.5;
    for (let rad = -80; rad <= 80; rad += 20) {
      let diff = ((rad - normYaw + 540) % 360) - 180;
      const screenX = w / 2 + (diff / (this.fovH / 2)) * (w / 2);
      ctx.beginPath();
      ctx.moveTo(screenX, horizonY);
      ctx.lineTo(screenX * 2 - w / 2, h);
      ctx.stroke();
    }

    // Horizon line glow
    ctx.strokeStyle = 'rgba(249, 115, 22, 0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, horizonY);
    ctx.lineTo(w, horizonY);
    ctx.stroke();

    ctx.restore();
  }

  stop() {
    if (this.simAnimId) {
      cancelAnimationFrame(this.simAnimId);
      this.simAnimId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop());
      this.stream = null;
    }
    if (this.video) {
      this.video.srcObject = null;
    }
    this.activeTrack = null;
    this.isSimulator = false;
  }
}
