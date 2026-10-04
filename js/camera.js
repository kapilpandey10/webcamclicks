/* WebcamClicks — camera engine.
   Owns getUserMedia, the hidden <video>, and the work canvas that every
   frame is drawn onto (the "source" that effects and games read from). */

import { makeCanvas, drawCover, isMobile } from './utils.js';

export class CameraManager {
  constructor() {
    this.video = document.createElement('video');
    this.video.autoplay = true;
    this.video.muted = true;
    this.video.defaultMuted = true;
    this.video.playsInline = true;
    this.video.setAttribute('playsinline', '');
    this.video.setAttribute('aria-hidden', 'true');

    this.stream = null;
    this.active = false;
    this.mirror = true;
    this.facing = 'user';
    this.deviceId = null;
    this.devices = [];

    /* Work canvas: the frame all effects/games read from. */
    this.work = makeCanvas(960, 540);
    this.workCtx = this.work.getContext('2d', { willReadFrequently: true });
    this.width = 960;
    this.height = 540;
  }

  attach(container) {
    container.prepend(this.video);
  }

  async listDevices() {
    try {
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = all.filter((d) => d.kind === 'videoinput');
    } catch { this.devices = []; }
    return this.devices;
  }

  async start() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
    }
    this.stopTracks();

    const video = {
      width: { ideal: 1280 },
      height: { ideal: 720 }
    };
    if (this.deviceId) video.deviceId = { exact: this.deviceId };
    else video.facingMode = { ideal: this.facing };

    this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video });
    this.video.srcObject = this.stream;
    await this.video.play();
    await this._waitForMetadata();

    this._computeWorkSize();
    this.active = true;
    await this.listDevices();
    return true;
  }

  async flip() {
    await this.listDevices();
    if (this.devices.length < 2) return false;

    /* If we don't have device ids yet (labels only appear after permission),
       fall back to toggling facingMode. */
    const ids = this.devices.map((d) => d.deviceId).filter(Boolean);
    if (ids.length >= 2) {
      const current = this.stream && this.stream.getVideoTracks()[0];
      const settings = current ? current.getSettings() : {};
      const curIdx = ids.indexOf(settings.deviceId);
      this.deviceId = ids[(curIdx + 1) % ids.length];
    } else {
      this.facing = this.facing === 'user' ? 'environment' : 'user';
      this.deviceId = null;
    }
    await this.start();
    return true;
  }

  async switchDevice(deviceId) {
    this.deviceId = deviceId;
    await this.start();
    return true;
  }

  getCurrentDeviceId() {
    if (this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track) {
        const s = track.getSettings ? track.getSettings() : {};
        if (s && s.deviceId) return s.deviceId;
      }
    }
    return this.deviceId;
  }

  stop() {
    this.stopTracks();
    this.active = false;
  }

  stopTracks() {
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    try { this.video.srcObject = null; } catch { /* ignore */ }
  }

  toggleMirror() {
    this.mirror = !this.mirror;
    return this.mirror;
  }

  /**
   * Copy the current video frame onto the work canvas (cover-fit + mirror).
   * Returns the work canvas, or null if the video isn't ready yet.
   */
  grabFrame() {
    if (!this.active || this.video.readyState < 2) return null;
    const ctx = this.workCtx;
    const { width: w, height: h } = this;
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.mirror) { ctx.translate(w, 0); ctx.scale(-1, 1); }
    drawCover(ctx, this.video, w, h, false);
    ctx.restore();
    return this.work;
  }

  _computeWorkSize() {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;
    const target = isMobile() ? 640 : 960;
    const scale = Math.min(1, target / Math.max(vw, 1));
    this.width = Math.max(320, Math.round((vw * scale) / 2) * 2);
    this.height = Math.max(180, Math.round((vh * scale) / 2) * 2);
    this.work.width = this.width;
    this.work.height = this.height;
    this.workCtx.imageSmoothingEnabled = true;
  }

  _waitForMetadata() {
    return new Promise((resolve) => {
      if (this.video.videoWidth > 0) return resolve();
      const done = () => resolve();
      this.video.addEventListener('loadedmetadata', done, { once: true });
      setTimeout(done, 2500);
    });
  }
}
