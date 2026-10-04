/* WebcamClicks — lightweight motion detector (frame differencing).
   Works on any device, no ML models needed. Used by games and motion effects. */

import { makeCanvas } from './utils.js';

export class MotionDetector {
  constructor(cols = 12, rows = 9) {
    this.w = 64;
    this.h = 48;
    this.cols = cols;
    this.rows = rows;
    this.canvas = makeCanvas(this.w, this.h);
    this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
    this.prev = null;
    this.gray = new Float32Array(this.w * this.h);
    this.energy = 0;          // total motion (0..~255*3072)
    this.level = 0;           // normalized 0..1
    this.cx = 0.5;            // motion centroid (0..1)
    this.cy = 0.5;
    this.zones = new Float32Array(cols * rows); // per-zone energy, row-major
    this.frame = 0;
  }

  /** Update from a source canvas/video. Call once per animation frame (drawn). */
  update(src) {
    this.frame++;
    const { w, h } = this;
    this.ctx.drawImage(src, 0, 0, w, h);
    let data;
    try { data = this.ctx.getImageData(0, 0, w, h).data; } catch { return; }

    const gray = this.gray;
    for (let i = 0, p = 0; i < gray.length; i++, p += 4) {
      gray[i] = data[p] * 0.299 + data[p + 1] * 0.587 + data[p + 2] * 0.114;
    }

    const prev = this.prev;
    if (prev) {
      const { cols, rows } = this;
      const zw = w / cols;
      const zh = h / rows;
      this.energy = 0;
      let sum = 0, sx = 0, sy = 0;
      const zones = this.zones;
      zones.fill(0);

      for (let y = 0; y < h; y++) {
        const zy = Math.min(rows - 1, (y / zh) | 0);
        const rowOff = zy * cols;
        for (let x = 0; x < w; x++) {
          const i = y * w + x;
          const diff = Math.abs(gray[i] - prev[i]);
          if (diff > 16) {
            const v = diff - 16;
            sum += v;
            sx += x * v;
            sy += y * v;
            const zx = Math.min(cols - 1, (x / zw) | 0);
            if (v > zones[rowOff + zx]) zones[rowOff + zx] = v;
          }
        }
      }

      this.energy = sum;
      this.level = Math.min(1, sum / (w * h * 24));
      if (sum > 0) {
        this.cx = sx / sum / w;
        this.cy = sy / sum / h;
      }
    }
    this.prev = Float32Array.from(gray);
  }

  /** Motion energy for a normalized zone (x, y in 0..1). */
  zoneAt(x, y) {
    const zx = Math.max(0, Math.min(this.cols - 1, (x * this.cols) | 0));
    const zy = Math.max(0, Math.min(this.rows - 1, (y * this.rows) | 0));
    return this.zones[zy * this.cols + zx];
  }

  reset() {
    this.prev = null;
    this.energy = 0;
    this.level = 0;
    this.cx = 0.5;
    this.cy = 0.5;
    this.zones.fill(0);
  }
}
