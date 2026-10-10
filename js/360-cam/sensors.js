/**
 * 360 CAM — Sensor & Orientation Tracking Engine
 * Handles DeviceOrientationEvent with iOS 13+ permission flow,
 * alpha/beta/gamma sensor normalization, calibration zeroing,
 * and manual drag/step fallback for desktop testing.
 */

export class SensorTracker {
  constructor() {
    this.hasGyro = false;
    this.isListening = false;
    this.permissionGranted = false;

    // Smoothed sensor readings
    this.yaw = 0;       // 0° to 360° (Heading)
    this.pitch = 0;     // -90° to +90° (Tilt up/down)
    this.roll = 0;      // -180° to +180° (Sideways tilt)

    // Calibration
    this.referenceYaw = 0;
    this.relativeYaw = 0;

    // Manual simulation fallback
    this.manualMode = false;
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.manualRoll = 0;

    // Low-pass filter weights
    this.smoothFactor = 0.25;

    // Listeners
    this._onOrientation = this._handleDeviceOrientation.bind(this);
    this._listeners = new Set();
  }

  /**
   * Request permission (required on iOS Safari 13+)
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
          return { granted: false, error: 'Permission denied by user' };
        }
      } catch (err) {
        return { granted: false, error: err.message };
      }
    }

    // Android, desktop Chrome, or non-iOS browsers grant automatically
    this.permissionGranted = true;
    return { granted: true, ios: false };
  }

  /**
   * Start listening to device orientation
   */
  start() {
    if (this.isListening) return;

    if (window.DeviceOrientationEvent) {
      window.addEventListener('deviceorientation', this._onOrientation, true);
      this.isListening = true;

      // Check after 600ms if we actually received sensor events
      setTimeout(() => {
        if (!this.hasGyro) {
          console.log('No gyro events received within 600ms. Enabling manual fallback.');
          this.manualMode = true;
          this._notify();
        }
      }, 600);
    } else {
      this.manualMode = true;
      this._notify();
    }
  }

  /**
   * Stop listening
   */
  stop() {
    if (!this.isListening) return;
    window.removeEventListener('deviceorientation', this._onOrientation, true);
    this.isListening = false;
  }

  /**
   * Calibrate reference yaw to current phone heading (sets current heading as 0°)
   */
  calibrateZero() {
    this.referenceYaw = this.yaw;
    this.manualYaw = 0;
    this.manualPitch = 0;
    this.manualRoll = 0;
    this._calculateRelative();
    this._notify();
  }

  /**
   * Manual heading adjustment (useful for desktop / fallback testing)
   */
  setManualOffset(deltaYaw = 0, deltaPitch = 0) {
    this.manualYaw = (this.manualYaw + deltaYaw + 360) % 360;
    this.manualPitch = Math.max(-80, Math.min(80, this.manualPitch + deltaPitch));

    if (this.manualMode) {
      this.yaw = this.manualYaw;
      this.pitch = this.manualPitch;
      this.roll = 0;
      this._calculateRelative();
      this._notify();
    }
  }

  /**
   * Set absolute manual heading
   */
  setManualHeading(yaw, pitch = 0) {
    this.manualYaw = ((yaw % 360) + 360) % 360;
    this.manualPitch = Math.max(-80, Math.min(80, pitch));

    this.yaw = this.manualYaw;
    this.pitch = this.manualPitch;
    this.roll = 0;
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
    this.manualMode = false;

    // Normalizing angles
    // In portrait mode:
    // alpha: 0 to 360 (compass heading / yaw)
    // beta: -180 to 180 (front-to-back tilt / pitch). When phone is held vertical upright, beta ≈ 90°.
    // gamma: -90 to 90 (left-to-right tilt / roll).
    const rawAlpha = event.alpha || 0;
    const rawBeta = event.beta || 0;
    const rawGamma = event.gamma || 0;

    // Normalize pitch so 0° is a level vertical phone (pointing at horizon)
    // When held vertically: beta = 90° -> pitch = 0°
    // Tilted up toward sky: beta < 90° -> pitch > 0°
    // Tilted down toward ground: beta > 90° -> pitch < 0°
    const targetPitch = 90 - rawBeta;
    const targetRoll = rawGamma;
    const targetYaw = 360 - rawAlpha; // Normalize to clockwise 0-360

    // Smooth values using circular distance for yaw
    this.yaw = this._smoothAngle(this.yaw, targetYaw, this.smoothFactor);
    this.pitch = this.pitch + (targetPitch - this.pitch) * this.smoothFactor;
    this.roll = this.roll + (targetRoll - this.roll) * this.smoothFactor;

    this._calculateRelative();
    this._notify();
  }

  _calculateRelative() {
    this.relativeYaw = ((this.yaw - this.referenceYaw + 360) % 360);
  }

  _smoothAngle(curr, target, factor) {
    let diff = ((target - curr + 540) % 360) - 180;
    return (curr + diff * factor + 360) % 360;
  }

  subscribe(callback) {
    this._listeners.add(callback);
    return () => this._listeners.delete(callback);
  }

  _notify() {
    const data = {
      yaw: this.yaw,
      pitch: this.pitch,
      roll: this.roll,
      relativeYaw: this.relativeYaw,
      hasGyro: this.hasGyro,
      manualMode: this.manualMode
    };
    this._listeners.forEach((cb) => cb(data));
  }

  getCurrent() {
    return {
      yaw: this.yaw,
      pitch: this.pitch,
      roll: this.roll,
      relativeYaw: this.relativeYaw,
      hasGyro: this.hasGyro,
      manualMode: this.manualMode
    };
  }
}

export const sensorTracker = new SensorTracker();
