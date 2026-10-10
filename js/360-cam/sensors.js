/**
 * 360 CAM — Sensor & Orientation Tracking Engine
 * Provides ultra-responsive 3D orientation tracking for iOS Safari (webkitCompassHeading)
 * and Android (deviceorientationabsolute / deviceorientation), with immediate calibration,
 * robust touch/drag simulation fallback, and zero-lag responsiveness.
 */

export class SensorTracker {
  constructor() {
    this.hasGyro = false;
    this.isListening = false;
    this.permissionGranted = false;

    // Current orientation in degrees
    this.yaw = 0;       // 0° to 360° (Compass heading / Azimuth)
    this.pitch = 0;     // -90° (straight down) to +90° (straight up)
    this.roll = 0;      // -180° to +180° (Device roll tilt)

    // Calibration offset (sets current heading & pitch as 0° reference)
    this.referenceYaw = 0;
    this.referencePitch = 0;
    this.relativeYaw = 0;
    this.relativePitch = 0;

    // Manual touch/drag fallback & offset adjustments
    this.manualMode = false;
    this.manualYawOffset = 0;
    this.manualPitchOffset = 0;
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.manualRoll = 0;

    // Responsiveness filter: 0.65 provides crisp, instant response with minimal jitter
    this.smoothFactor = 0.65;

    // Listeners
    this._onOrientation = this._handleDeviceOrientation.bind(this);
    this._listeners = new Set();
  }

  /**
   * Request permission (required on iOS Safari 13+ inside a user click gesture)
   */
  async requestPermission() {
    if (
      typeof DeviceOrientationEvent !== 'undefined' &&
      typeof DeviceOrientationEvent.requestPermission === 'function'
    ) {
      try {
        const state = await DeviceOrientationEvent.requestPermission();
        if (state === 'granted') {
          this.permissionGranted = true;
          return { granted: true, ios: true };
        } else {
          return { granted: false, error: 'Permission denied by iOS user' };
        }
      } catch (err) {
        return { granted: false, error: err.message };
      }
    }

    // Android, desktop, or non-iOS browsers grant automatically
    this.permissionGranted = true;
    return { granted: true, ios: false };
  }

  /**
   * Start listening to device orientation with high-priority absolute events
   */
  start() {
    if (this.isListening) return;

    // 1. Android Chrome absolute compass heading
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener('deviceorientationabsolute', this._onOrientation, true);
    }
    // 2. Standard device orientation (iOS WebKit + Android fallback)
    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this._onOrientation, true);
    }

    this.isListening = true;

    // If no gyro data received within 800ms, enable manual mode
    setTimeout(() => {
      if (!this.hasGyro) {
        this.manualMode = true;
        this._notify();
      }
    }, 800);
  }

  /**
   * Stop listening
   */
  stop() {
    if (!this.isListening) return;
    if ('ondeviceorientationabsolute' in window) {
      window.removeEventListener('deviceorientationabsolute', this._onOrientation, true);
    }
    window.removeEventListener('deviceorientation', this._onOrientation, true);
    this.isListening = false;
  }

  /**
   * Calibrate reference heading to current phone direction
   */
  calibrateZero() {
    this.referenceYaw = this.yaw;
    this.referencePitch = this.pitch;
    this.manualYawOffset = 0;
    this.manualPitchOffset = 0;
    this._calculateRelative();
    this._notify();
  }

  /**
   * Set manual relative offset (useful for touch drag or stepper buttons)
   */
  setManualOffset(deltaYaw = 0, deltaPitch = 0) {
    this.manualYawOffset = ((this.manualYawOffset + deltaYaw) % 360 + 360) % 360;
    this.manualPitchOffset = Math.max(-88, Math.min(88, this.manualPitchOffset + deltaPitch));

    if (!this.hasGyro) {
      this.manualMode = true;
    }
    this._calculateRelative();
    this._notify();
  }

  /**
   * Set manual absolute angles
   */
  setManualHeading(yaw, pitch = 0) {
    this.referenceYaw = 0;
    this.referencePitch = 0;
    this.yaw = 0;
    this.pitch = 0;
    this.manualYawOffset = ((yaw % 360) + 360) % 360;
    this.manualPitchOffset = Math.max(-88, Math.min(88, pitch));
    this.manualMode = true;

    this._calculateRelative();
    this._notify();
  }

  /**
   * Internal DeviceOrientationEvent handler
   */
  _handleDeviceOrientation(event) {
    if (event.alpha === null && event.beta === null && event.gamma === null) {
      return;
    }

    this.hasGyro = true;

    // --- 1. YAW (Compass Heading) ---
    let targetYaw = 0;
    if (typeof event.webkitCompassHeading === 'number' && !isNaN(event.webkitCompassHeading)) {
      targetYaw = event.webkitCompassHeading;
    } else {
      // Android / standard: alpha is 0-360 counterclockwise, invert to clockwise
      targetYaw = (360 - (event.alpha || 0)) % 360;
    }

    // --- 2. PITCH (Front-to-back tilt) ---
    // When held vertically upright (portrait): beta ≈ 90°
    // Tilting up to ceiling: beta decreases to 0° (Zenith pitch = +90°)
    // Tilting down to floor: beta increases to 180° (Nadir pitch = -90°)
    const beta = event.beta || 90;
    const targetPitch = Math.max(-90, Math.min(90, 90 - beta));

    // --- 3. ROLL (Left-to-right sideways tilt) ---
    const targetRoll = event.gamma || 0;

    // Apply fast responsive smoothing
    this.yaw = this._smoothAngle(this.yaw, targetYaw, this.smoothFactor);
    this.pitch = this.pitch + (targetPitch - this.pitch) * this.smoothFactor;
    this.roll = this.roll + (targetRoll - this.roll) * this.smoothFactor;

    this._calculateRelative();
    this._notify();
  }

  _calculateRelative() {
    this.relativeYaw = ((this.yaw - this.referenceYaw + this.manualYawOffset + 720) % 360);
    const netPitch = (this.pitch - (this.referencePitch || 0)) + this.manualPitchOffset;
    this.relativePitch = Math.max(-88, Math.min(88, netPitch));
  }

  _smoothAngle(curr, target, factor) {
    let diff = ((target - curr + 540) % 360) - 180;
    return ((curr + diff * factor) % 360 + 360) % 360;
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify() {
    const data = this.getCurrent();
    this._listeners.forEach((cb) => cb(data));
  }

  getCurrent() {
    return {
      yaw: this.yaw,
      pitch: this.relativePitch !== undefined ? this.relativePitch : this.pitch,
      roll: this.roll,
      relativeYaw: this.relativeYaw,
      hasGyro: this.hasGyro,
      manualMode: this.manualMode
    };
  }
}

export const sensorTracker = new SensorTracker();
