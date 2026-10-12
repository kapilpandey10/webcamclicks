/* WebcamClicks — on-device face detection via face-api.js (lazy loaded).
   Nothing is uploaded; all inference happens in the browser. */

import { isMobile, lerp, clamp } from '../utils.js';

const SCRIPT_URL = 'https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js';
const MODEL_URL = 'https://cdn.jsdelivr.net/gh/justadudewhohacks/face-api.js@master/weights';

/* 68-point landmark index groups */
export const LM = {
  LEFT_EYE: [36, 37, 38, 39, 40, 41],
  RIGHT_EYE: [42, 43, 44, 45, 46, 47],
  NOSE: [27, 28, 29, 30],
  MOUTH_OUTER: [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59],
  MOUTH_INNER_TOP: 62,
  MOUTH_INNER_BOTTOM: 66,
  CHIN: 8,
  FOREHEAD: 27
};

export function cent(points, idxs) {
  let x = 0, y = 0;
  for (const i of idxs) { x += points[i].x; y += points[i].y; }
  return { x: x / idxs.length, y: y / idxs.length };
}

let scriptPromise = null;
function loadScript() {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.faceapi) return resolve(window.faceapi);
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.onload = () => (window.faceapi ? resolve(window.faceapi) : reject(new Error('faceapi missing')));
    s.onerror = () => reject(new Error('faceapi script failed to load'));
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export class FaceTracker {
  constructor(onStatus) {
    this.status = 'off';           // off | loading | ready | error
    this.onStatus = onStatus || null;
    this.result = null;            // { box, points, expressions, age, gender, genderProbability, at }
    this.error = null;

    this.loadedBase = false;
    this.loadedExpressions = false;
    this.loadedAge = false;
    this._loadingBase = null;
    this._loadingExpr = null;
    this._loadingAge = null;

    this._pending = false;
    this._lastDetectTime = 0;
    this._lastSeenAt = 0;

    // Real-time smoothed interpolation state (updated every frame for 60fps tracking)
    this._smoothBox = null;
    this._smoothPoints = null;

    this._opts = null;
  }

  get box() { return this._smoothBox || (this.result ? this.result.box : null); }
  get points() { return this._smoothPoints || (this.result ? this.result.points : null); }
  get expressions() { return this.result ? this.result.expressions : null; }
  get age() { return this.result ? this.result.age : null; }
  get gender() { return this.result ? this.result.gender : null; }
  get genderProbability() { return this.result ? this.result.genderProbability : null; }
  get hasFace() { return !!(this.result && this.result.box); }

  _setStatus(s, err = null) {
    this.status = s;
    this.error = err;
    if (this.onStatus) this.onStatus(s, err);
  }

  /** Load script + tiny detector + 68-point landmarks. */
  ensureBase() {
    if (this.loadedBase) return Promise.resolve(true);
    if (this._loadingBase) return this._loadingBase;
    this._setStatus('loading');
    this._loadingBase = (async () => {
      const faceapi = await loadScript();
      await faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
      await faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
      // Fast, responsive detector options
      this._opts = new faceapi.TinyFaceDetectorOptions({
        inputSize: isMobile() ? 192 : 256,
        scoreThreshold: 0.3
      });
      this.loadedBase = true;
      this._setStatus('ready');
      return true;
    })().catch((err) => {
      this._loadingBase = null;
      this._setStatus('error', err);
      throw err;
    });
    return this._loadingBase;
  }

  ensureExpressions() {
    if (this.loadedExpressions) return Promise.resolve(true);
    if (this._loadingExpr) return this._loadingExpr;
    this._loadingExpr = (async () => {
      await this.ensureBase();
      const faceapi = window.faceapi;
      await faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL);
      this.loadedExpressions = true;
      return true;
    })().catch((err) => { this._loadingExpr = null; throw err; });
    return this._loadingExpr;
  }

  ensureAge() {
    if (this.loadedAge) return Promise.resolve(true);
    if (this._loadingAge) return this._loadingAge;
    this._loadingAge = (async () => {
      await this.ensureBase();
      const faceapi = window.faceapi;
      await faceapi.nets.ageGenderNet.loadFromUri(MODEL_URL);
      this.loadedAge = true;
      return true;
    })().catch((err) => { this._loadingAge = null; throw err; });
    return this._loadingAge;
  }

  /**
   * High-responsiveness async detector. Initiates as soon as previous task
   * completes (throttled to a sleek ~20fps, zero idle delay).
   */
  detect(canvas) {
    if (this.status !== 'ready' || this._pending || !canvas) return;
    const now = performance.now();
    const minCooldown = isMobile() ? 65 : 40;
    if (this._lastDetectTime && (now - this._lastDetectTime < minCooldown)) return;

    this._pending = true;
    this._lastDetectTime = now;

    const faceapi = window.faceapi;
    let task = faceapi.detectSingleFace(canvas, this._opts).withFaceLandmarks(true);
    if (this.loadedExpressions && typeof task.withFaceExpressions === 'function') {
      task = task.withFaceExpressions();
    }
    // face-api.js uses withAgeAndGender()
    if (this.loadedAge && typeof task.withAgeAndGender === 'function') {
      task = task.withAgeAndGender();
    }

    task.then((res) => {
      const finishTime = performance.now();
      if (res) {
        this.result = {
          box: res.detection ? res.detection.box : res.box,
          points: res.landmarks ? res.landmarks.positions : null,
          expressions: res.expressions || null,
          age: typeof res.age === 'number' ? res.age : null,
          gender: res.gender || null,
          genderProbability: typeof res.genderProbability === 'number' ? res.genderProbability : null,
          at: finishTime
        };
        this._lastSeenAt = finishTime;
      } else {
        // Keep last known face for a grace period (~350ms) to prevent flickering during blinks or quick turns
        if (!this._lastSeenAt || (finishTime - this._lastSeenAt > 350)) {
          this.result = null;
        }
      }
    }).catch(() => {
      /* transient detection errors are caught safely */
    }).finally(() => {
      this._pending = false;
    });
  }

  /**
   * Real-time 60fps exponential pose & landmark interpolation.
   * Eliminates all jitter, lag, and stepping between detection frames.
   */
  update(dt = 16.7) {
    if (!this.result) {
      if (!this._lastSeenAt || (performance.now() - this._lastSeenAt > 350)) {
        this._smoothBox = null;
        this._smoothPoints = null;
      }
      return;
    }
    const alpha = 1 - Math.exp(-clamp(dt, 1, 100) / 28); // ~28ms response: lightning fast & buttery smooth

    // Smooth bounding box
    const tb = this.result.box;
    if (tb) {
      if (!this._smoothBox) {
        this._smoothBox = { x: tb.x, y: tb.y, width: tb.width, height: tb.height };
      } else {
        this._smoothBox.x = lerp(this._smoothBox.x, tb.x, alpha);
        this._smoothBox.y = lerp(this._smoothBox.y, tb.y, alpha);
        this._smoothBox.width = lerp(this._smoothBox.width, tb.width, alpha);
        this._smoothBox.height = lerp(this._smoothBox.height, tb.height, alpha);
      }
    }

    // Smooth 68 landmark points
    const tp = this.result.points;
    if (tp && tp.length) {
      if (!this._smoothPoints || this._smoothPoints.length !== tp.length) {
        this._smoothPoints = tp.map((p) => ({ x: p.x, y: p.y }));
      } else {
        for (let i = 0; i < tp.length; i++) {
          this._smoothPoints[i].x = lerp(this._smoothPoints[i].x, tp[i].x, alpha);
          this._smoothPoints[i].y = lerp(this._smoothPoints[i].y, tp[i].y, alpha);
        }
      }
    }
  }

  reset() {
    this.result = null;
    this._smoothBox = null;
    this._smoothPoints = null;
    this._lastSeenAt = 0;
    this._lastDetectTime = 0;
  }
}
