/* WebcamClicks — glitch_dimension 2D filter effect
   High-tech cyberpunk reality rupture with multi-phase chromatic channel splitting,
   horizontal slice displacements, inverted dimensional tears, CRT scanline roll,
   and synthesized digital audio crackles. */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';
import { Sound } from '../../sound.js';

/* ══════════════════════════════════════════════════════════════════════
   SYNTHESIZED CYBER GLITCH AUDIO ENGINE
   Produces subtle sci-fi micro-clicks and digital static snaps on glitch bursts.
   ══════════════════════════════════════════════════════════════════════ */
const GlitchSFX = {
  _lastClick: 0,
  _humOsc: null,
  _humGain: null,

  initHum() {
    if (this._humOsc || !Sound.enabled || !Sound.ensure()) return;
    try {
      const ac = Sound.ac;
      const osc = ac.createOscillator();
      const gain = ac.createGain();
      const filter = ac.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(45, ac.currentTime); // Low sub-hum

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(120, ac.currentTime);

      gain.gain.setValueAtTime(0.012, ac.currentTime); // Very subtle ambient

      osc.connect(filter).connect(gain).connect(ac.destination);
      osc.start();
      this._humOsc = osc;
      this._humGain = gain;
    } catch { /* ignore */ }
  },

  stopHum() {
    if (this._humOsc) {
      try {
        this._humGain.gain.linearRampToValueAtTime(0.0001, Sound.ac.currentTime + 0.05);
        setTimeout(() => {
          try { this._humOsc.stop(); this._humOsc.disconnect(); } catch {}
          this._humOsc = null;
          this._humGain = null;
        }, 60);
      } catch {
        this._humOsc = null;
        this._humGain = null;
      }
    }
  },

  /** Sharp digital glitch click/crackle */
  click(intensity = 1) {
    const now = performance.now();
    if (now - this._lastClick < 180) return;
    this._lastClick = now;
    if (!Sound.enabled || !Sound.ensure()) return;
    const ac = Sound.ac;
    try {
      const t0 = ac.currentTime;
      const dur = 0.02 + Math.random() * 0.03;
      const osc = ac.createOscillator();
      const gain = ac.createGain();

      osc.type = Math.random() < 0.5 ? 'square' : 'sawtooth';
      osc.frequency.setValueAtTime(400 + Math.random() * 1600, t0);
      osc.frequency.exponentialRampToValueAtTime(80, t0 + dur);

      const vol = clamp(0.04 * intensity, 0.01, 0.08);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);

      osc.connect(gain).connect(ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    } catch { /* ignore */ }
  }
};

export const glitchDimensionEffect = {
  id: 'glitch_dimension',
  name: 'Glitch Dimension',
  icon: '🌀',
  category: 'Sci-Fi',
  perf: 'medium',
  requiresFace: false,

  _lastSurge: 0,
  _surgeActive: false,
  _surgeEnd: 0,
  _slices: [],
  _blocks: [],

  destroy() {
    GlitchSFX.stopHum();
  },

  render(fx, frame) {
    const { src, width: w, height: h, time, now, dt, face } = frame;
    const t = time || now || performance.now();
    const delta = clamp(dt || 16.7, 0, 50);

    // Subtle sci-fi ambient hum
    GlitchSFX.initHum();

    // Head tracking if available
    let pose = null;
    if (face && face.landmarks && face.landmarks.length > 0) {
      pose = smoothPose(this, getHeadPose(frame), delta, 30);
    }
    const centerPoint = pose ? { x: pose.cx, y: pose.cy } : { x: w * 0.5, y: h * 0.45 };

    // ── Dimensional Surge Phase Management ──
    if (!this._surgeActive && t - this._lastSurge > 1600 + Math.random() * 1400) {
      this._surgeActive = true;
      this._lastSurge = t;
      this._surgeEnd = t + 180 + Math.random() * 220; // 180ms - 400ms tear

      // Trigger audio micro-click
      GlitchSFX.click(1);

      // Generate randomized slice coordinates
      const sliceCount = 8 + Math.floor(Math.random() * 10);
      this._slices = [];
      for (let i = 0; i < sliceCount; i++) {
        this._slices.push({
          y: Math.random() * h,
          h: Math.max(8, Math.random() * (h * 0.14)),
          shift: (Math.random() - 0.5) * (w * (Math.random() < 0.25 ? 0.16 : 0.08)),
          invert: Math.random() < 0.35
        });
      }

      // Generate digital byte corruption blocks
      const blockCount = 4 + Math.floor(Math.random() * 6);
      this._blocks = [];
      const cyberColors = ['#00f0ff', '#ff0055', '#ffe600', '#00ff66', '#ffffff'];
      for (let i = 0; i < blockCount; i++) {
        this._blocks.push({
          x: centerPoint.x + (Math.random() - 0.5) * (w * 0.7),
          y: centerPoint.y + (Math.random() - 0.5) * (h * 0.7),
          w: 24 + Math.random() * 90,
          h: 6 + Math.random() * 28,
          color: pick(cyberColors)
        });
      }
    }

    if (this._surgeActive && t > this._surgeEnd) {
      this._surgeActive = false;
      this._slices = [];
      this._blocks = [];
    }

    const isSurging = this._surgeActive;
    const splitAmp = isSurging ? (w * 0.024) : (w * 0.008 + Math.sin(t * 0.004) * (w * 0.005));

    fx.save();

    // 1. Base Contrast & Cyber Saturation
    fx.filter = isSurging ? 'contrast(1.35) saturate(1.5) brightness(1.05)' : 'contrast(1.22) saturate(1.35)';
    fx.drawImage(src, 0, 0, w, h);
    fx.filter = 'none';

    // 2. Multi-channel Chromatic Displacement (RGB Split)
    // Red channel offset left/up
    fx.save();
    fx.globalCompositeOperation = 'screen';
    fx.globalAlpha = isSurging ? 0.7 : 0.45;
    fx.drawImage(src, -splitAmp, (Math.sin(t * 0.008) * 3), w, h);

    // Cyan / Blue channel offset right/down
    fx.globalAlpha = isSurging ? 0.65 : 0.4;
    fx.drawImage(src, splitAmp, -(Math.sin(t * 0.008) * 3), w, h);
    fx.restore();

    // 3. Dimensional Slice Tearing
    if (isSurging && this._slices.length > 0) {
      fx.save();
      for (const s of this._slices) {
        if (s.invert) {
          // Negative / Solarized dimensional fracture
          fx.globalCompositeOperation = 'difference';
          fx.globalAlpha = 0.85;
          fx.drawImage(src, 0, s.y, w, s.h, s.shift, s.y, w, s.h);
        } else {
          fx.globalCompositeOperation = 'source-over';
          fx.globalAlpha = 0.95;
          fx.drawImage(src, 0, s.y, w, s.h, s.shift, s.y, w, s.h);
        }
      }
      fx.restore();
    }

    // 4. Matrix & Cyberpunk Byte Data Corruption Blocks
    if (isSurging && this._blocks.length > 0) {
      fx.save();
      for (const b of this._blocks) {
        fx.globalCompositeOperation = 'screen';
        fx.globalAlpha = 0.35 + Math.random() * 0.35;
        fx.fillStyle = b.color;
        fx.fillRect(b.x, b.y, b.w, b.h);

        // Cyber scan-strip inside block
        fx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        fx.fillRect(b.x, b.y + b.h * 0.3, b.w, Math.max(1, b.h * 0.2));
      }
      fx.restore();
    }

    // 5. Rolling CRT Scanline Bar
    fx.save();
    const rollY = (t * 0.16) % (h + 80) - 40;
    const barH = Math.max(30, h * 0.08);
    const grad = fx.createLinearGradient(0, rollY, 0, rollY + barH);
    grad.addColorStop(0, 'rgba(0, 240, 255, 0)');
    grad.addColorStop(0.5, 'rgba(0, 240, 255, 0.12)');
    grad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    fx.fillStyle = grad;
    fx.fillRect(0, rollY, w, barH);
    fx.restore();

    // 6. Phosphor Scanline Interlacing
    fx.save();
    fx.globalCompositeOperation = 'source-over';
    fx.globalAlpha = isSurging ? 0.22 : 0.14;
    fx.fillStyle = '#020617';
    const scanStep = isMobile() ? 4 : 3;
    for (let y = 0; y < h; y += scanStep) {
      fx.fillRect(0, y, w, 1);
    }
    fx.restore();

    // 7. Static Flash Spike on Peak Ruptures
    if (isSurging && Math.random() < 0.18) {
      fx.save();
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.28;
      fx.fillStyle = '#ffffff';
      fx.fillRect(0, 0, w, h);
      fx.restore();
    }

    // 8. Cyberpunk Corner UI Telemetry Stamp
    fx.save();
    fx.font = `600 ${Math.max(10, Math.round(w * 0.016))}px monospace`;
    fx.fillStyle = 'rgba(0, 240, 255, 0.75)';
    fx.textBaseline = 'top';
    const glitchStr = isSurging ? 'DIMENSION_RUPTURE // ERR_0x8F' : 'DIMENSION_SYNC // STABLE';
    fx.fillText(`[${glitchStr}]`, 16, 16);
    fx.restore();

    fx.restore();
  }
};

export default glitchDimensionEffect;
