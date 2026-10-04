/* ============================================================
   WebcamClicks — Microphone Test & Diagnostic Engine (mic-test.js)
   Real-time Web Audio API analysis, dB meter, waveform canvas,
   audio playback verification, and comprehensive report generator.
   ============================================================ */

export class MicrophoneTester {
  constructor(options = {}) {
    this.canvas = options.canvas || null;
    this.canvasCtx = this.canvas ? this.canvas.getContext('2d') : null;
    this.onMetrics = options.onMetrics || null;
    this.onStateChange = options.onStateChange || null;

    this.audioCtx = null;
    this.stream = null;
    this.source = null;
    this.analyser = null;
    this.animId = null;

    this.active = false;
    this.devices = [];
    this.selectedDeviceId = '';

    /* Diagnostic accumulators */
    this.peakDb = -Infinity;
    this.minDb = Infinity;
    this.rmsSum = 0;
    this.sampleCount = 0;
    this.clippingCount = 0;
    this.voiceFrequenciesDetected = 0;
    this.startTime = 0;

    /* 5-second sample recorder */
    this.mediaRecorder = null;
    this.recordedChunks = [];
    this.playbackUrl = null;
    this.isRecordingSample = false;
    this.sampleTimer = null;
  }

  async listDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      const all = await navigator.mediaDevices.enumerateDevices();
      this.devices = all.filter((d) => d.kind === 'audioinput');
      return this.devices;
    } catch (e) {
      console.error('Failed to enumerate audio devices:', e);
      return [];
    }
  }

  async start(deviceId = null) {
    this.stop();

    if (deviceId) this.selectedDeviceId = deviceId;

    const audioConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    };
    if (this.selectedDeviceId) {
      audioConstraints.deviceId = { exact: this.selectedDeviceId };
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints,
        video: false
      });
    } catch (err) {
      if (err.name === 'OverconstrainedError' && this.selectedDeviceId) {
        /* Fallback if exact deviceId failed */
        this.stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      } else {
        throw err;
      }
    }

    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    this.audioCtx = new AudioContextClass();
    if (this.audioCtx.state === 'suspended') {
      await this.audioCtx.resume();
    }

    this.source = this.audioCtx.createMediaStreamSource(this.stream);
    this.analyser = this.audioCtx.createAnalyser();
    this.analyser.fftSize = 2048;
    this.analyser.smoothingTimeConstant = 0.8;
    this.source.connect(this.analyser);

    this.active = true;
    this.startTime = Date.now();
    this.peakDb = -90;
    this.minDb = 0;
    this.rmsSum = 0;
    this.sampleCount = 0;
    this.clippingCount = 0;
    this.voiceFrequenciesDetected = 0;

    /* Refresh device list now that permissions are granted and labels are visible */
    await this.listDevices();

    if (this.onStateChange) this.onStateChange(true);
    this._renderLoop();

    return this.getTrackInfo();
  }

  stop() {
    if (this.animId) {
      cancelAnimationFrame(this.animId);
      this.animId = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    if (this.audioCtx) {
      try { this.audioCtx.close(); } catch { /* ignore */ }
      this.audioCtx = null;
    }
    this.active = false;
    if (this.onStateChange) this.onStateChange(false);
  }

  async switchDevice(deviceId) {
    this.selectedDeviceId = deviceId;
    return await this.start(deviceId);
  }

  getTrackInfo() {
    if (!this.stream) return null;
    const track = this.stream.getAudioTracks()[0];
    if (!track) return null;
    const settings = track.getSettings ? track.getSettings() : {};
    return {
      label: track.label || 'Default Microphone',
      deviceId: settings.deviceId || this.selectedDeviceId,
      channelCount: settings.channelCount || 1,
      sampleRate: settings.sampleRate || (this.audioCtx ? this.audioCtx.sampleRate : 48000),
      latency: settings.latency || 0.01,
      echoCancellation: settings.echoCancellation !== false,
      noiseSuppression: settings.noiseSuppression !== false,
      autoGainControl: settings.autoGainControl !== false
    };
  }

  _renderLoop() {
    if (!this.active || !this.analyser) return;

    const bufferLength = this.analyser.frequencyBinCount;
    const timeData = new Uint8Array(bufferLength);
    const freqData = new Uint8Array(bufferLength);

    this.analyser.getByteTimeDomainData(timeData);
    this.analyser.getByteFrequencyData(freqData);

    /* 1. Calculate RMS volume & Decibels */
    let sumSquares = 0;
    let clipping = false;
    for (let i = 0; i < bufferLength; i++) {
      const normalized = (timeData[i] - 128) / 128;
      sumSquares += normalized * normalized;
      if (timeData[i] >= 254 || timeData[i] <= 1) {
        clipping = true;
      }
    }
    const rms = Math.sqrt(sumSquares / bufferLength);
    let db = 20 * Math.log10(rms);
    if (!isFinite(db) || db < -90) db = -90;

    /* Update metrics */
    if (db > this.peakDb) this.peakDb = db;
    if (db < this.minDb && db > -80) this.minDb = db;
    this.rmsSum += rms;
    this.sampleCount++;
    if (clipping) this.clippingCount++;

    /* 2. Frequency Spectrum Analysis */
    let maxFreqVal = 0;
    let dominantBin = 0;
    let voiceEnergy = 0;
    const nyquist = (this.audioCtx ? this.audioCtx.sampleRate : 48000) / 2;
    const binWidth = nyquist / bufferLength;

    for (let i = 0; i < bufferLength; i++) {
      const val = freqData[i];
      if (val > maxFreqVal) {
        maxFreqVal = val;
        dominantBin = i;
      }
      const freq = i * binWidth;
      /* Human vocal frequency range: ~250 Hz - 3500 Hz */
      if (freq >= 250 && freq <= 3500 && val > 40) {
        voiceEnergy += val;
      }
    }
    const dominantFreq = Math.round(dominantBin * binWidth);
    if (voiceEnergy > 500) {
      this.voiceFrequenciesDetected++;
    }

    /* Convert dB to a 0-100 linear percentage for progress meters */
    const volumePercent = Math.min(100, Math.max(0, Math.round(((db + 60) / 60) * 100)));

    if (this.onMetrics) {
      this.onMetrics({
        db: Math.round(db),
        peakDb: Math.round(this.peakDb),
        volumePercent,
        clipping,
        dominantFreq,
        rms: Math.round(rms * 1000) / 1000
      });
    }

    /* 3. Render Canvas Visualizer */
    this._drawVisualizer(timeData, freqData, bufferLength);

    this.animId = requestAnimationFrame(() => this._renderLoop());
  }

  _drawVisualizer(timeData, freqData, bufferLength) {
    if (!this.canvasCtx || !this.canvas) return;
    const ctx = this.canvasCtx;
    const w = this.canvas.width;
    const h = this.canvas.height;

    ctx.clearRect(0, 0, w, h);

    /* Background delicate gradient */
    const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
    bgGrad.addColorStop(0, '#ffffff');
    bgGrad.addColorStop(1, '#fdf2f8');
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, w, h);

    /* Center line */
    ctx.strokeStyle = 'rgba(236, 72, 153, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w, h / 2);
    ctx.stroke();

    /* Frequency Bars in Background */
    const barCount = Math.min(64, bufferLength);
    const barWidth = (w / barCount) * 0.75;
    const barGap = (w / barCount) * 0.25;

    for (let i = 0; i < barCount; i++) {
      const idx = Math.floor(i * (bufferLength / barCount));
      const val = freqData[idx];
      const barHeight = (val / 255) * (h * 0.45);
      const x = i * (barWidth + barGap);
      const y = h - barHeight;

      ctx.fillStyle = 'rgba(244, 114, 182, 0.28)';
      ctx.fillRect(x, y, barWidth, barHeight);
    }

    /* Oscilloscope Waveform */
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = '#db2777';
    ctx.beginPath();

    const sliceWidth = w / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = timeData[i] / 128.0;
      const y = (v * h) / 2;

      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);

      x += sliceWidth;
    }
    ctx.stroke();
  }

  /* Record a 5-second sample phrase for immediate audio playback verification */
  recordSample(durationSec = 5, onTick = null) {
    if (!this.stream || this.isRecordingSample) return Promise.resolve(null);

    return new Promise((resolve) => {
      this.isRecordingSample = true;
      this.recordedChunks = [];
      let remaining = durationSec;

      if (onTick) onTick(remaining);

      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : '';
        this.mediaRecorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
      } catch (e) {
        this.isRecordingSample = false;
        resolve(null);
        return;
      }

      this.mediaRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) this.recordedChunks.push(e.data);
      };

      this.mediaRecorder.onstop = () => {
        this.isRecordingSample = false;
        clearInterval(this.sampleTimer);
        const blob = new Blob(this.recordedChunks, { type: this.mediaRecorder.mimeType || 'audio/webm' });
        if (this.playbackUrl) URL.revokeObjectURL(this.playbackUrl);
        this.playbackUrl = URL.createObjectURL(blob);
        resolve({ blob, url: this.playbackUrl, duration: durationSec });
      };

      this.mediaRecorder.start(200);

      this.sampleTimer = setInterval(() => {
        remaining--;
        if (onTick) onTick(remaining);
        if (remaining <= 0) {
          clearInterval(this.sampleTimer);
          if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
            this.mediaRecorder.stop();
          }
        }
      }, 1000);
    });
  }

  /* Generate comprehensive, professional diagnostic report */
  generateReport() {
    const track = this.getTrackInfo();
    const durationSec = Math.round((Date.now() - this.startTime) / 1000) || 1;
    const avgRms = this.sampleCount > 0 ? this.rmsSum / this.sampleCount : 0;
    let avgDb = 20 * Math.log10(avgRms);
    if (!isFinite(avgDb) || avgDb < -90) avgDb = -90;

    /* Calculate Component Scores */
    let volumeScore = 100;
    if (this.peakDb < -35) volumeScore = 50; // Too quiet
    else if (this.peakDb < -25) volumeScore = 75; // Acceptable but soft
    else if (this.peakDb > -1) volumeScore = 70; // May clip

    let distortionScore = 100;
    if (this.clippingCount > 15) distortionScore = 40;
    else if (this.clippingCount > 0) distortionScore = 75;

    let noiseFloor = Math.round(this.minDb);
    if (noiseFloor > -25) noiseFloor = -35;
    let noiseScore = 95;
    if (noiseFloor > -40) noiseScore = 65; // High background noise
    else if (noiseFloor > -50) noiseScore = 80;

    let voiceClarityScore = 90;
    if (this.voiceFrequenciesDetected < 5) voiceClarityScore = 60; // Little speech detected

    /* Overall composite score (0 - 100) */
    const overallScore = Math.round(
      volumeScore * 0.35 +
      distortionScore * 0.25 +
      noiseScore * 0.20 +
      voiceClarityScore * 0.20
    );

    let status = 'Excellent';
    let statusClass = 'ok';
    let summaryText = 'Your microphone is performing with studio-clear input, healthy volume levels, and minimal background noise.';

    if (overallScore < 60) {
      status = 'Needs Attention';
      statusClass = 'err';
      summaryText = 'Low input volume, clipping, or high ambient noise was detected. Check recommendations below.';
    } else if (overallScore < 80) {
      status = 'Good';
      statusClass = 'warn';
      summaryText = 'Suitable for regular voice and video calls, with minor adjustments recommended.';
    }

    /* Recommendations array */
    const recommendations = [];
    if (this.peakDb < -25) {
      recommendations.push('Increase your microphone input volume in system settings or move closer to the mic.');
    }
    if (this.clippingCount > 0) {
      recommendations.push('Occasional audio distortion/clipping detected. Slightly reduce microphone gain or back away during loud speaking.');
    }
    if (noiseFloor > -45) {
      recommendations.push('Noticeable ambient noise detected. Turn on hardware/software noise cancellation or use a directional headset mic.');
    }
    if (recommendations.length === 0) {
      recommendations.push('No critical issues detected. Your microphone is well calibrated and ready for calls.');
    }

    /* Meeting software readiness */
    const apps = {
      zoom: overallScore >= 65 ? 'Ready' : 'Check Settings',
      meet: overallScore >= 65 ? 'Ready' : 'Check Settings',
      teams: overallScore >= 65 ? 'Ready' : 'Check Settings',
      discord: overallScore >= 70 ? 'Ready' : 'Check Settings',
      podcast: overallScore >= 85 ? 'Studio Quality' : 'Adequate'
    };

    return {
      timestamp: new Date().toISOString(),
      formattedDate: new Date().toLocaleString(),
      durationSec,
      device: track,
      score: overallScore,
      status,
      statusClass,
      summaryText,
      metrics: {
        peakDb: Math.round(this.peakDb),
        avgDb: Math.round(avgDb),
        noiseFloorDb: noiseFloor,
        clippingEvents: this.clippingCount,
        sampleRate: track ? track.sampleRate : 48000,
        channels: track ? (track.channelCount === 2 ? 'Stereo (2 ch)' : 'Mono (1 ch)') : 'Mono',
        echoCancellation: track && track.echoCancellation ? 'Enabled' : 'Disabled',
        noiseSuppression: track && track.noiseSuppression ? 'Enabled' : 'Disabled'
      },
      apps,
      recommendations
    };
  }
}
