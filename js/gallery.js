/* WebcamClicks — Gallery.
   Captures are stored as compressed JPEG data URLs in localStorage
   (device-only — nothing is ever uploaded). */

import { storage, downloadDataUrl, timestamp } from './utils.js';

const KEY = 'wc_gallery_v1';
const MAX_ITEMS = 24;
const MAX_WIDTH = 800;

export class Gallery {
  constructor(onChange) {
    this.onChange = onChange || null;
    this.items = storage.get(KEY, []);
    if (!Array.isArray(this.items)) this.items = [];
    this.sessionVideos = [];
  }

  /** Capture the display canvas (scaled down, JPEG). Returns the new item. */
  captureFrom(canvas, effectName) {
    const ratio = Math.min(1, MAX_WIDTH / canvas.width);
    const c = document.createElement('canvas');
    c.width = Math.max(2, Math.round(canvas.width * ratio));
    c.height = Math.max(2, Math.round(canvas.height * ratio));
    const ctx = c.getContext('2d');
    ctx.drawImage(canvas, 0, 0, c.width, c.height);
    const dataUrl = c.toDataURL('image/jpeg', 0.85);

    const item = {
      id: `${Date.now()}-${Math.round(Math.random() * 1e5)}`,
      dataUrl,
      ts: Date.now(),
      effect: effectName || 'Normal'
    };
    this.items.unshift(item);
    while (this.items.length > MAX_ITEMS) this.items.pop();
    this._save();
    return item;
  }

  allItems() {
    return [...this.sessionVideos, ...this.items];
  }

  addVideo(item) {
    const videoItem = { ...item, kind: 'video' };
    this.sessionVideos.unshift(videoItem);
    while (this.sessionVideos.length > 6) {
      const old = this.sessionVideos.pop();
      try { URL.revokeObjectURL(old.url); } catch { /* ignore */ }
    }
    if (this.onChange) this.onChange(this.allItems());
    return videoItem;
  }

  remove(id) {
    const video = this.sessionVideos.find((i) => i.id === id);
    if (video && video.url) {
      try { URL.revokeObjectURL(video.url); } catch { /* ignore */ }
    }
    this.sessionVideos = this.sessionVideos.filter((i) => i.id !== id);
    this.items = this.items.filter((i) => i.id !== id);
    this._save();
  }

  clear() {
    for (const video of this.sessionVideos) {
      try { URL.revokeObjectURL(video.url); } catch { /* ignore */ }
    }
    this.sessionVideos = [];
    this.items = [];
    this._save();
  }

  download(item) {
    if (item.kind === 'video' && item.url) {
      const a = document.createElement('a');
      a.href = item.url;
      a.download = item.filename || `webcamclicks-${timestamp()}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    }
    downloadDataUrl(item.dataUrl, `webcamclicks-${timestamp()}.jpg`);
  }

  _save() {
    let ok = storage.set(KEY, this.items);
    /* If quota is exceeded, drop the oldest photos until it fits. */
    while (!ok && this.items.length > 1) {
      this.items.pop();
      ok = storage.set(KEY, this.items);
    }
    if (this.onChange) this.onChange(this.allItems());
    return ok;
  }
}
