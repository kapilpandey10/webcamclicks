/* ============================================================
   WebcamClicks — Dual Webcam Side-by-Side Comparison Engine (compare.js)
   Runs two concurrent camera streams on a single screen, computes
   live resolution & FPS, and captures synchronized comparison shots.
   ============================================================ */

import { FpsMeter, downloadDataUrl, timestamp } from './utils.js';

export class DualWebcamComparator {
  constructor(options = {}) {
    this.videoA = options.videoA;
    this.videoB = options.videoB;
    this.onMetricsA = options.onMetricsA || null;
    this.onMetricsB = options.onMetricsB || null;

    this.streamA = null;
    this.streamB = null;
    this.deviceIdA = null;
    this.deviceIdB = null;

    this.fpsMeterA = new FpsMeter();
    this.fpsMeterB = new FpsMeter();

    this.mirrorA = false;
    this.mirrorB = false;

    this.active = false;
    this.animId = null;
    this.devices = [];
  }

  async listDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = all.filter((d) => d.kind === 'videoinput');
      return this.devices;
    } catch {
      return [];
    }
  }

  async startCameraA(deviceId = null) {
    if (this.streamA) {
      this.streamA.getTracks().forEach((t) => t.stop());
      this.streamA = null;
    }
    this.deviceIdA = deviceId;

    const constraints = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };
    if (deviceId) constraints.video.deviceId = { exact: deviceId };

    this.streamA = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoA.srcObject = this.streamA;
    await this.videoA.play();
    await this._waitMetadata(this.videoA);
    this._startLoop();
    return this.getSpecsA();
  }

  async startCameraB(deviceId = null) {
    if (this.streamB) {
      this.streamB.getTracks().forEach((t) => t.stop());
      this.streamB = null;
    }
    this.deviceIdB = deviceId;

    const constraints = {
      video: {
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    };
    if (deviceId) constraints.video.deviceId = { exact: deviceId };

    this.streamB = await navigator.mediaDevices.getUserMedia(constraints);
    this.videoB.srcObject = this.streamB;
    await this.videoB.play();
    await this._waitMetadata(this.videoB);
    this._startLoop();
    return this.getSpecsB();
  }

  async startBoth(devIdA = null, devIdB = null) {
    await this.listDevices();
    if (!devIdA && this.devices.length > 0) devIdA = this.devices[0].deviceId;
    if (!devIdB && this.devices.length > 1) devIdB = this.devices[1].deviceId;
    else if (!devIdB && this.devices.length > 0) devIdB = this.devices[0].deviceId;

    await this.startCameraA(devIdA);
    try {
      await this.startCameraB(devIdB);
    } catch (err) {
      console.warn('Could not start second camera stream:', err);
    }
    this.active = true;
    return { a: this.getSpecsA(), b: this.getSpecsB() };
  }

  stopAll() {
    if (this.animId) cancelAnimationFrame(this.animId);
    if (this.streamA) {
      this.streamA.getTracks().forEach((t) => t.stop());
      this.streamA = null;
    }
    if (this.streamB) {
      this.streamB.getTracks().forEach((t) => t.stop());
      this.streamB = null;
    }
    this.active = false;
  }

  _waitMetadata(video) {
    return new Promise((resolve) => {
      if (video.videoWidth && video.videoHeight) {
        resolve();
        return;
      }
      const onMeta = () => {
        video.removeEventListener('loadedmetadata', onMeta);
        resolve();
      };
      video.addEventListener('loadedmetadata', onMeta);
      setTimeout(resolve, 800);
    });
  }

  _startLoop() {
    if (this.animId) return;
    const loop = (now) => {
      if (this.streamA && this.videoA.readyState >= 2) {
        const fpsA = this.fpsMeterA.tick(now);
        if (this.onMetricsA) this.onMetricsA(this.getSpecsA(fpsA));
      }
      if (this.streamB && this.videoB.readyState >= 2) {
        const fpsB = this.fpsMeterB.tick(now);
        if (this.onMetricsB) this.onMetricsB(this.getSpecsB(fpsB));
      }
      this.animId = requestAnimationFrame(loop);
    };
    this.animId = requestAnimationFrame(loop);
  }

  getSpecsA(fps = 0) {
    return this._extractSpecs(this.streamA, this.videoA, fps);
  }

  getSpecsB(fps = 0) {
    return this._extractSpecs(this.streamB, this.videoB, fps);
  }

  _extractSpecs(stream, video, fps = 0) {
    if (!stream || !video) return null;
    const track = stream.getVideoTracks()[0];
    const settings = track && track.getSettings ? track.getSettings() : {};
    const width = video.videoWidth || settings.width || 0;
    const height = video.videoHeight || settings.height || 0;
    const ratio = width && height ? (width / height > 1.5 ? '16:9' : '4:3') : '—';
    return {
      label: track ? track.label || 'Webcam' : 'No Camera',
      deviceId: settings.deviceId,
      width,
      height,
      resolution: width && height ? `${width} × ${height}` : 'Loading…',
      ratio,
      fps: Math.round(fps || settings.frameRate || 0)
    };
  }

  /* Capture single side-by-side comparison image */
  captureSideBySide(labelA = 'Camera 1', labelB = 'Camera 2') {
    const wA = this.videoA.videoWidth || 640;
    const hA = this.videoA.videoHeight || 480;
    const wB = this.videoB.videoWidth || 640;
    const hB = this.videoB.videoHeight || 480;

    const targetH = Math.max(hA, hB, 480);
    const scaledWA = Math.round(wA * (targetH / hA));
    const scaledWB = Math.round(wB * (targetH / hB));
    const totalW = scaledWA + scaledWB;

    const canvas = document.createElement('canvas');
    canvas.width = totalW;
    canvas.height = targetH + 60; // Extra room for label bar
    const ctx = canvas.getContext('2d');

    // Header bar
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, totalW, 60);

    ctx.font = 'bold 20px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`WebcamClicks Dual Comparison — ${new Date().toLocaleDateString()}`, 24, 38);

    // Camera A
    ctx.save();
    if (this.mirrorA) {
      ctx.translate(scaledWA, 60);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoA, 0, 0, scaledWA, targetH);
    } else {
      ctx.drawImage(this.videoA, 0, 60, scaledWA, targetH);
    }
    ctx.restore();

    // Camera B
    ctx.save();
    if (this.mirrorB) {
      ctx.translate(totalW, 60);
      ctx.scale(-1, 1);
      ctx.drawImage(this.videoB, 0, 0, scaledWB, targetH);
    } else {
      ctx.drawImage(this.videoB, scaledWA, 60, scaledWB, targetH);
    }
    ctx.restore();

    // Divider line
    ctx.strokeStyle = '#ec4899';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(scaledWA, 60);
    ctx.lineTo(scaledWA, targetH + 60);
    ctx.stroke();

    // Specs overlays on bottom of images
    ctx.fillStyle = 'rgba(15, 23, 42, 0.82)';
    ctx.fillRect(16, targetH + 60 - 52, scaledWA - 32, 40);
    ctx.fillRect(scaledWA + 16, targetH + 60 - 52, scaledWB - 32, 40);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 15px Outfit, sans-serif';
    ctx.fillText(`${labelA}: ${wA}×${hA}`, 26, targetH + 60 - 27);
    ctx.fillText(`${labelB}: ${wB}×${hB}`, scaledWA + 26, targetH + 60 - 27);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    downloadDataUrl(dataUrl, `webcam-comparison-${timestamp()}.jpg`);
    return dataUrl;
  }
}
