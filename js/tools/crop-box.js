/* WebcamClicks — draggable, resizable crop box over a canvas (used by Crop image and Crop video).
   The rectangle is kept in source pixels; it can be locked to an aspect ratio. Mouse, pen and touch. */

export class CropBox {
  /** @param {HTMLElement} wrap a position:relative element that contains the preview canvas */
  constructor(wrap, { onChange } = {}) {
    this.wrap = wrap; this.onChange = onChange || (() => {});
    this.W = 1; this.H = 1; this.aspect = null; this.rect = { x: 0, y: 0, w: 1, h: 1 };
    this.box = document.createElement('div'); this.box.className = 'cb-box'; this.box.tabIndex = 0;
    this.box.setAttribute('aria-label', 'Crop area: drag to move, drag the corners to resize, arrow keys to nudge');
    this.box.innerHTML = '<span class="cb-grid"></span><span class="cb-size"></span>' + ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'].map((h) => `<i class="cb-h cb-${h}" data-h="${h}"></i>`).join('');
    wrap.appendChild(this.box);
    this.sizeEl = this.box.querySelector('.cb-size');
    this.box.addEventListener('pointerdown', (e) => this.down(e));
    this.box.addEventListener('pointermove', (e) => this.move(e));
    this.box.addEventListener('pointerup', () => this.up()); this.box.addEventListener('pointercancel', () => this.up());
    this.box.addEventListener('keydown', (e) => {
      const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key]; if (!d) return;
      e.preventDefault(); const k = (e.shiftKey ? 10 : 1) / this.scale();
      this.set({ ...this.rect, x: this.rect.x + d[0] * k, y: this.rect.y + d[1] * k });
    });
    new ResizeObserver(() => this.layout()).observe(wrap);
  }
  scale() { const c = this.wrap.querySelector('canvas'); return (c ? c.clientWidth : this.wrap.clientWidth) / this.W; }
  offset() { const c = this.wrap.querySelector('canvas'); return c ? [c.offsetLeft, c.offsetTop] : [0, 0]; }
  setSource(W, H, keep = false) {
    const old = { W: this.W, H: this.H, r: this.rect };
    this.W = W; this.H = H;
    if (keep && old.W > 1) this.set({ x: (old.r.x / old.W) * W, y: (old.r.y / old.H) * H, w: (old.r.w / old.W) * W, h: (old.r.h / old.H) * H }, true);
    else this.reset();
  }
  /** Largest centred box with the current aspect ratio (or the whole frame). */
  reset() {
    let w = this.W, h = this.H;
    if (this.aspect) { if (w / h > this.aspect) w = h * this.aspect; else h = w / this.aspect; }
    this.set({ x: (this.W - w) / 2, y: (this.H - h) / 2, w, h }, true);
  }
  setAspect(a) { this.aspect = a || null; this.reset(); }
  set(r, force) {
    let { x, y, w, h } = r;
    const min = Math.max(8, Math.min(this.W, this.H) * 0.03);
    w = Math.max(min, Math.min(this.W, w)); h = Math.max(min, Math.min(this.H, h));
    if (this.aspect) { if (w / h > this.aspect) w = h * this.aspect; else h = w / this.aspect; }
    x = Math.max(0, Math.min(this.W - w, x)); y = Math.max(0, Math.min(this.H - h, y));
    this.rect = { x, y, w, h };
    this.layout(); this.onChange(this.rounded(), force);
  }
  /** Integer rectangle (even sizes, as video encoders need). */
  rounded(even = false) {
    const r = this.rect, f = even ? (v) => Math.max(2, Math.floor(v / 2) * 2) : (v) => Math.max(1, Math.round(v));
    const x = Math.round(r.x), y = Math.round(r.y);
    return { x, y, w: Math.min(f(r.w), this.W - x), h: Math.min(f(r.h), this.H - y) };
  }
  layout() {
    const k = this.scale(), [ox, oy] = this.offset(), r = this.rect;
    Object.assign(this.box.style, { left: `${ox + r.x * k}px`, top: `${oy + r.y * k}px`, width: `${r.w * k}px`, height: `${r.h * k}px` });
    const rr = this.rounded(); this.sizeEl.textContent = `${rr.w} × ${rr.h}`;
  }
  down(e) {
    e.preventDefault(); this.box.setPointerCapture(e.pointerId); this.box.focus({ preventScroll: true });
    this.drag = { h: e.target.dataset.h || 'move', x: e.clientX, y: e.clientY, r: { ...this.rect } };
    this.box.classList.add('active');
  }
  move(e) {
    const d = this.drag; if (!d) return;
    const k = this.scale(), dx = (e.clientX - d.x) / k, dy = (e.clientY - d.y) / k, r0 = d.r;
    if (d.h === 'move') { this.set({ ...r0, x: r0.x + dx, y: r0.y + dy }); return; }
    let x1 = r0.x, y1 = r0.y, x2 = r0.x + r0.w, y2 = r0.y + r0.h;
    if (d.h.includes('w')) x1 = Math.min(x2 - 8, Math.max(0, x1 + dx));
    if (d.h.includes('e')) x2 = Math.max(x1 + 8, Math.min(this.W, x2 + dx));
    if (d.h.includes('n')) y1 = Math.min(y2 - 8, Math.max(0, y1 + dy));
    if (d.h.includes('s')) y2 = Math.max(y1 + 8, Math.min(this.H, y2 + dy));
    let w = x2 - x1, h = y2 - y1;
    if (this.aspect) {
      // keep the ratio: follow the dragged edge, anchor the opposite side
      if (d.h === 'n' || d.h === 's') w = h * this.aspect; else if (d.h === 'e' || d.h === 'w') h = w / this.aspect;
      else if (w / h > this.aspect) h = w / this.aspect; else w = h * this.aspect;
      // fit inside the frame from the anchor
      const maxW = d.h.includes('w') ? x2 : this.W - x1, maxH = d.h.includes('n') ? y2 : (d.h === 'e' || d.h === 'w') ? this.H - Math.max(0, r0.y + r0.h / 2 - h / 2) : this.H - y1;
      if (w > maxW) { w = maxW; h = w / this.aspect; } if (h > maxH) { h = maxH; w = h * this.aspect; }
      if (d.h.includes('w')) x1 = x2 - w; if (d.h.includes('n')) y1 = y2 - h;
      if (d.h === 'e' || d.h === 'w') y1 = r0.y + r0.h / 2 - h / 2; if (d.h === 'n' || d.h === 's') x1 = r0.x + r0.w / 2 - w / 2;
    }
    this.set({ x: x1, y: y1, w, h });
  }
  up() { this.drag = null; this.box.classList.remove('active'); }
}

/** Common aspect-ratio presets: [label, ratio or null]. */
export const ASPECTS = [['Free', null], ['1:1', 1], ['4:5', 4 / 5], ['9:16', 9 / 16], ['16:9', 16 / 9], ['4:3', 4 / 3], ['3:4', 3 / 4], ['3:2', 3 / 2], ['2:3', 2 / 3]];
