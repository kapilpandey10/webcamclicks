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
    this.video.setAttribute('webkit-playsinline', '');
    this.video.setAttribute('aria-hidden', 'true');

    this.stream = null;
    this.active = false;
    this.mirror = true;
    this.facing = 'user';
    this.deviceId = null;
    this.devices = [];
    this.resolution = '1920x1080';
    this.zoom = 1;
    this._digitalZoom = 1;

    /* Work canvas: the frame all effects/games read from. */
    this.work = makeCanvas(1280, 720);
    this.workCtx = this.work.getContext('2d', { willReadFrequently: true });
    this.width = 1280;
    this.height = 720;
    this.nativeWidth = 1280;
    this.nativeHeight = 720;
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

  async start(requestedResolution = null) {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw Object.assign(new Error('unsupported'), { name: 'NotSupportedError' });
    }
    this.stopTracks();

    if (requestedResolution) {
      this.resolution = requestedResolution;
    }

    let idealW = 1920, idealH = 1080;
    if (this.resolution === '7680x4320') {
      idealW = 7680; idealH = 4320;
    } else if (this.resolution === '3840x2160') {
      idealW = 3840; idealH = 2160;
    } else if (this.resolution === '2560x1440') {
      idealW = 2560; idealH = 1440;
    } else if (this.resolution === '1920x1080' || this.resolution === 'max') {
      idealW = 1920; idealH = 1080;
    } else if (this.resolution === '1280x720') {
      idealW = 1280; idealH = 720;
    } else if (this.resolution === '640x480') {
      idealW = 640; idealH = 480;
    }

    const videoConstraints = {
      width: { ideal: idealW },
      height: { ideal: idealH }
    };
    if (this.deviceId) videoConstraints.deviceId = { exact: this.deviceId };
    else videoConstraints.facingMode = { ideal: this.facing };

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: videoConstraints });
    } catch (err) {
      // If higher resolution requested failed, try standard 720p fallback
      if (idealW > 1280) {
        const fallback = {
          width: { ideal: 1280 },
          height: { ideal: 720 }
        };
        if (this.deviceId) fallback.deviceId = { exact: this.deviceId };
        else fallback.facingMode = { ideal: this.facing };
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: fallback });
      } else {
        throw err;
      }
    }

    this.video.srcObject = this.stream;
    try {
      await this.video.play();
    } catch (playErr) {
      console.warn('[WebcamClicks] video play warning:', playErr);
    }
    await this._waitForMetadata();

    this._computeWorkSize();
    this.active = true;
    await this.listDevices();

    // If max was requested, safely check if hardware supports higher resolution
    if (this.resolution === 'max' && this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track && track.getCapabilities) {
        try {
          const caps = track.getCapabilities();
          if (caps && caps.width && caps.width.max > (this.video.videoWidth || 1920)) {
            await track.applyConstraints({
              width: { ideal: caps.width.max },
              height: { ideal: caps.height.max || Math.round(caps.width.max * 9 / 16) }
            });
            this._computeWorkSize();
          }
        } catch { /* keep working stream */ }
      }
    }

    if (this.zoom > 1) {
      await this.setZoom(this.zoom);
    }

    return true;
  }

  async setResolution(res) {
    if (!res) return false;
    this.resolution = res;
    if (!this.active || !this.stream) return true;

    const track = this.stream.getVideoTracks()[0];
    if (!track) return false;

    let targetW = 1920, targetH = 1080;
    if (res === 'max') {
      const caps = track.getCapabilities ? track.getCapabilities() : null;
      targetW = (caps && caps.width && caps.width.max) ? caps.width.max : 1920;
      targetH = (caps && caps.height && caps.height.max) ? caps.height.max : 1080;
    } else if (res === '7680x4320') { targetW = 7680; targetH = 4320; }
    else if (res === '3840x2160') { targetW = 3840; targetH = 2160; }
    else if (res === '2560x1440') { targetW = 2560; targetH = 1440; }
    else if (res === '1920x1080') { targetW = 1920; targetH = 1080; }
    else if (res === '1280x720') { targetW = 1280; targetH = 720; }
    else if (res === '640x480') { targetW = 640; targetH = 480; }

    try {
      if (track.applyConstraints) {
        await track.applyConstraints({
          width: { ideal: targetW },
          height: { ideal: targetH }
        });
      }
    } catch {
      // If applying constraint in-place fails, restart cleanly
      try {
        await this.start(res);
      } catch {
        await this.start('1920x1080');
      }
    }

    this._computeWorkSize();
    return true;
  }

  getZoomCapabilities() {
    if (!this.stream) return null;
    const track = this.stream.getVideoTracks()[0];
    if (track && track.getCapabilities) {
      try {
        const caps = track.getCapabilities();
        if (caps && 'zoom' in caps) return caps.zoom;
      } catch { /* ignore */ }
    }
    return null;
  }

  async setZoom(level) {
    level = Math.max(1, Math.min(8, Number(level) || 1));
    this.zoom = level;

    const caps = this.getZoomCapabilities();
    if (caps && this.stream) {
      const track = this.stream.getVideoTracks()[0];
      if (track && track.applyConstraints) {
        const hwZoom = Math.min(caps.max, Math.max(caps.min, level));
        try {
          await track.applyConstraints({
            advanced: [{ zoom: hwZoom }]
          });
          if (level <= caps.max) {
            this._digitalZoom = 1;
            return level;
          }
          this._digitalZoom = level / caps.max;
          return level;
        } catch {
          // Hardware constraint failed, fall through to digital zoom
        }
      }
    }

    this._digitalZoom = level;
    return level;
  }

  getResolutionLabel() {
    const w = this.nativeWidth || (this.video && this.video.videoWidth) || this.width;
    const h = this.nativeHeight || (this.video && this.video.videoHeight) || this.height;
    if (w >= 7600) return '8K UHD';
    if (w >= 3800) return '4K UHD';
    if (w >= 2500) return '2K QHD';
    if (w >= 1900) return '1080p FHD';
    if (w >= 1200) return '720p HD';
    return `${w}×${h}`;
  }

  async flip() {
    await this.listDevices();
    if (this.devices.length < 2) return false;

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

  grabFrame() {
    if (!this.active || !this.video) return null;
    if (this.video.readyState < 2 || !this.video.videoWidth || !this.video.videoHeight) {
      return null;
    }

    // Dynamic resolution adjustment if camera reports dimensions after ready
    if (this.nativeWidth !== this.video.videoWidth || this.nativeHeight !== this.video.videoHeight) {
      this._computeWorkSize();
    }

    const ctx = this.workCtx;
    const { width: w, height: h } = this;
    const zoom = Math.max(1, this._digitalZoom || 1);

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (this.mirror) {
      ctx.translate(w, 0);
      ctx.scale(-1, 1);
    }

    const vw = this.video.videoWidth;
    const vh = this.video.videoHeight;

    if (zoom > 1.001) {
      const sw = vw / zoom;
      const sh = vh / zoom;
      const sx = (vw - sw) / 2;
      const sy = (vh - sh) / 2;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(this.video, sx, sy, sw, sh, 0, 0, w, h);
    } else {
      drawCover(ctx, this.video, w, h, false);
    }
    ctx.restore();
    return this.work;
  }

  _computeWorkSize() {
    const vw = this.video.videoWidth || 1280;
    const vh = this.video.videoHeight || 720;
    this.nativeWidth = vw;
    this.nativeHeight = vh;

    const target = isMobile() ? 720 : 1280;
    const scale = Math.min(1, target / Math.max(vw, 1));
    this.width = Math.max(320, Math.round((vw * scale) / 2) * 2);
    this.height = Math.max(180, Math.round((vh * scale) / 2) * 2);
    this.work.width = this.width;
    this.work.height = this.height;
    this.workCtx.imageSmoothingEnabled = true;
    this.workCtx.imageSmoothingQuality = 'high';
  }

  _waitForMetadata() {
    return new Promise((resolve) => {
      if (this.video.videoWidth > 0 && this.video.readyState >= 2) return resolve();
      let done = false;
      let timer = null;
      const onReady = () => {
        if (!done && this.video.videoWidth > 0) {
          done = true;
          clearTimeout(timer);
          this.video.removeEventListener('loadedmetadata', onReady);
          this.video.removeEventListener('canplay', onReady);
          this.video.removeEventListener('playing', onReady);
          this.video.removeEventListener('timeupdate', onReady);
          resolve();
        }
      };
      this.video.addEventListener('loadedmetadata', onReady);
      this.video.addEventListener('canplay', onReady);
      this.video.addEventListener('playing', onReady);
      this.video.addEventListener('timeupdate', onReady);
      timer = setTimeout(() => {
        if (!done) {
          done = true;
          this.video.removeEventListener('loadedmetadata', onReady);
          this.video.removeEventListener('canplay', onReady);
          this.video.removeEventListener('playing', onReady);
          this.video.removeEventListener('timeupdate', onReady);
          resolve();
        }
      }, 1500);
    });
  }
}
