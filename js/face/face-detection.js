/* WebcamClicks — on-device face detection via face-api.js (lazy loaded).
   Nothing is uploaded; all inference happens in the browser. */

import { isMobile } from '../utils.js';

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
    this.result = null;            // { box, points, expressions, age, gender, at }
    this.error = null;

    this.loadedBase = false;
    this.loadedExpressions = false;
    this.loadedAge = false;
    this._loadingBase = null;
    this._loadingExpr = null;
    this._loadingAge = null;

    this.interval = isMobile() ? 9 : 6; // detect every N frames
    this._frame = 0;
    this._pending = false;

    this._opts = null;
  }

  get box() { return this.result ? this.result.box : null; }
  get points() { return this.result ? this.result.points : null; }
  get expressions() { return this.result ? this.result.expressions : null; }
  get age() { return this.result ? this.result.age : null; }
  get gender() { return this.result ? this.result.gender : null; }
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
      this._opts = new faceapi.TinyFaceDetectorOptions({
        inputSize: isMobile() ? 224 : 320,
        scoreThreshold: 0.35
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
   * Throttled detection. Call every animation frame; it runs the async
   * detector only every `interval` frames and caches the last result.
   */
  detect(canvas) {
    if (this.status !== 'ready' || this._pending || !canvas) return;
    this._frame++;
    if (this._frame % this.interval !== 0) return;
    this._pending = true;

    const faceapi = window.faceapi;
    let task = faceapi.detectSingleFace(canvas, this._opts).withFaceLandmarks(true);
    if (this.loadedExpressions) task = task.withFaceExpressions();
    if (this.loadedAge) task = task.withFaceAgeGender();

    task.then((res) => {
      if (res) {
        this.result = {
          box: res.detection ? res.detection.box : res.box,
          points: res.landmarks ? res.landmarks.positions : null,
          expressions: res.expressions || null,
          age: typeof res.age === 'number' ? res.age : null,
          gender: res.gender || null,
          at: performance.now()
        };
      } else {
        this.result = null;
      }
    }).catch(() => { /* transient detection errors are fine */ })
      .finally(() => { this._pending = false; });
  }

  reset() {
    this.result = null;
    this._frame = 0;
  }
}
