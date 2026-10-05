/* WebcamClicks — tiny WebAudio sound engine (no assets needed) */

export const Sound = {
  ac: null,
  enabled: true,

  ensure() {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    if (!this.ac) {
      try { this.ac = new AC(); } catch { return false; }
    }
    if (this.ac.state === 'suspended') this.ac.resume().catch(() => {});
    return true;
  },

  tone(freq = 440, dur = 0.1, type = 'sine', vol = 0.18, when = 0) {
    if (!this.enabled || !this.ensure()) return;
    try {
      const t0 = this.ac.currentTime + when;
      const osc = this.ac.createOscillator();
      const gain = this.ac.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, t0);
      gain.gain.setValueAtTime(vol, t0);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
      osc.connect(gain).connect(this.ac.destination);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
    } catch { /* ignore */ }
  },

  /* Named effects */
  click() { this.tone(660, 0.05, 'triangle', 0.1); },
  pop() { this.tone(760, 0.07, 'square', 0.12); },
  shutter() {
    this.tone(1200, 0.03, 'square', 0.12);
    this.tone(400, 0.05, 'square', 0.1, 0.04);
  },
  score(n = 0) { this.tone(520 + Math.min(n, 12) * 45, 0.11, 'triangle', 0.16); },
  miss() { this.tone(200, 0.16, 'sawtooth', 0.12); },
  fail() {
    this.tone(300, 0.18, 'sawtooth', 0.16);
    this.tone(180, 0.3, 'sawtooth', 0.14, 0.16);
  },
  win() { [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.16, 'triangle', 0.16, i * 0.12)); },
  tick() { this.tone(900, 0.03, 'sine', 0.06); },
  countdownTick(num = 1) {
    const freq = num <= 1 ? 1200 : num === 2 ? 960 : 800;
    this.tone(freq, 0.06, 'sine', 0.15);
  },
  countdownGo() {
    this.tone(1400, 0.08, 'sine', 0.2);
    this.tone(1800, 0.12, 'sine', 0.22, 0.06);
  },
  motorPrint() {
    [180, 220, 260, 240, 200].forEach((f, i) => this.tone(f, 0.05, 'sawtooth', 0.08, i * 0.04));
  }
};
