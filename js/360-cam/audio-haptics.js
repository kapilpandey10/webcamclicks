/**
 * 360 CAM — Audio & Haptic Feedback System
 * Uses the Web Audio API for synthetic camera shutter sounds and radar lock beeps
 * with zero external audio assets required.
 */

class AudioHaptics {
  constructor() {
    this.audioCtx = null;
    this.soundEnabled = true;
    this.hapticsEnabled = true;
  }

  _initAudio() {
    if (!this.audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        this.audioCtx = new AudioContextClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume();
    }
  }

  /**
   * Mechanical dual-curtain camera shutter sound
   */
  playShutterSound() {
    if (!this.soundEnabled) return;
    try {
      this._initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;

      // Part 1: Front curtain click (burst of filtered white noise + click)
      const bufferSize = this.audioCtx.sampleRate * 0.04;
      const noiseBuffer = this.audioCtx.createBuffer(1, bufferSize, this.audioCtx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = this.audioCtx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = this.audioCtx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(1800, now);
      filter.Q.setValueAtTime(3.0, now);

      const gain = this.audioCtx.createGain();
      gain.gain.setValueAtTime(0.7, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.035);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(this.audioCtx.destination);
      whiteNoise.start(now);

      // Part 2: Rear curtain snap 45ms later
      const osc = this.audioCtx.createOscillator();
      const oscGain = this.audioCtx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(320, now + 0.045);
      osc.frequency.exponentialRampToValueAtTime(80, now + 0.09);

      oscGain.gain.setValueAtTime(0.0, now);
      oscGain.gain.setValueAtTime(0.6, now + 0.045);
      oscGain.gain.exponentialRampToValueAtTime(0.01, now + 0.095);

      osc.connect(oscGain);
      oscGain.connect(this.audioCtx.destination);
      osc.start(now + 0.045);
      osc.stop(now + 0.1);
    } catch (e) {
      console.warn('Audio playShutterSound error:', e);
    }
  }

  /**
   * Futuristic radar lock-in blip when reticle centers on target node
   */
  playLockSound() {
    if (!this.soundEnabled) return;
    try {
      this._initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now); // A5
      osc.frequency.exponentialRampToValueAtTime(1760, now + 0.06); // A6

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.08);
    } catch (e) {
      console.warn('Audio playLockSound error:', e);
    }
  }

  /**
   * Harmonious completion chime when entire 360 circle is captured
   */
  playCompleteSound() {
    if (!this.soundEnabled) return;
    try {
      this._initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const chord = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      chord.forEach((freq, idx) => {
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        const startTime = now + idx * 0.06;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, startTime);

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(0.2, startTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.45);

        osc.connect(gain);
        gain.connect(this.audioCtx.destination);

        osc.start(startTime);
        osc.stop(startTime + 0.5);
      });
    } catch (e) {
      console.warn('Audio playCompleteSound error:', e);
    }
  }

  /**
   * Soft alignment tick
   */
  playTick() {
    if (!this.soundEnabled) return;
    try {
      this._initAudio();
      if (!this.audioCtx) return;

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, now);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      osc.start(now);
      osc.stop(now + 0.025);
    } catch (e) {}
  }

  /**
   * Trigger device haptic vibration
   * @param {number|number[]} pattern
   */
  vibrate(pattern = 50) {
    if (!this.hapticsEnabled) return;
    try {
      if ('vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch (e) {
      // Haptics may be disallowed in certain iframe or policy contexts
    }
  }

  /**
   * Shutter capture feedback (Sound + Haptic)
   */
  triggerCaptureFeedback() {
    this.playShutterSound();
    this.vibrate([40, 30, 40]);
  }

  /**
   * Node lock-in feedback
   */
  triggerLockFeedback() {
    this.playLockSound();
    this.vibrate(25);
  }
}

export const audioHaptics = new AudioHaptics();
