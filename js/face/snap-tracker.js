/* WebcamClicks — Snapchat-Style 478-Point 3D Face + 52 Blendshape Tracker (snap-tracker.js)
   Runs 100% on-device via WebGL/WASM using MediaPipe FaceLandmarker. */

const VISION_CDN = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs';
const WASM_ROOT = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm';
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task';

export class SnapFaceTracker {
  constructor() {
    this.landmarker = null;
    this.loading = false;
    this.ready = false;
    this.failed = false;

    this.rawLandmarks = null;
    this.landmarks = null;   // Smoothed 478 points [{x, y, z}] in 0..1 normalized coords
    this.blendshapes = {};   // Map of 52 ARKit expression weights (0.0 to 1.0)
    this.matrix = null;      // 16-element Float32Array 4x4 3D head matrix (for Three.js)
    this.hasFace = false;

    this._lastVideoTs = 0;
    this._lastDetectMs = 0;
  }

  async ensureLoaded() {
    if (this.ready || this.loading || this.failed) return this.ready;
    this.loading = true;
    try {
      const vision = await import(VISION_CDN);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
      this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: {
          modelAssetPath: MODEL_URL,
          delegate: 'GPU'
        },
        runningMode: 'VIDEO',
        numFaces: 1,
        outputFaceBlendshapes: true,
        outputFacialTransformationMatrixes: true,
        minFaceDetectionConfidence: 0.5,
        minFacePresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      });
      this.ready = true;
    } catch (err) {
      // Fallback to CPU delegate if WebGL delegate fails on older mobile GPUs
      try {
        const vision = await import(VISION_CDN);
        const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
        this.landmarker = await vision.FaceLandmarker.createFromOptions(fileset, {
          baseOptions: {
            modelAssetPath: MODEL_URL,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          outputFaceBlendshapes: true,
          outputFacialTransformationMatrixes: true
        });
        this.ready = true;
      } catch (err2) {
        console.warn('[WebcamClicks] SnapFaceTracker load failed:', err2);
        this.failed = true;
      }
    } finally {
      this.loading = false;
    }
    return this.ready;
  }

  /** Run inference on the current camera work canvas and smooth landmarks. */
  update(srcCanvas, nowMs = performance.now(), dtMs = 16.7) {
    if (!this.ready) {
      if (!this.loading && !this.failed) this.ensureLoaded();
      return false;
    }

    // Run neural detection up to ~30 Hz (visual shader still runs at 60 FPS with smoothing)
    if (nowMs - this._lastDetectMs >= 28) {
      this._lastDetectMs = nowMs;
      const monoTs = Math.max(this._lastVideoTs + 1, Math.round(nowMs));
      this._lastVideoTs = monoTs;

      try {
        const res = this.landmarker.detectForVideo(srcCanvas, monoTs);
        if (res && res.faceLandmarks && res.faceLandmarks.length > 0) {
          this.rawLandmarks = res.faceLandmarks[0];
          this.hasFace = true;

          // Parse 52 ARKit blendshapes into fast lookup map
          if (res.faceBlendshapes && res.faceBlendshapes[0] && res.faceBlendshapes[0].categories) {
            const cats = res.faceBlendshapes[0].categories;
            for (let i = 0; i < cats.length; i++) {
              this.blendshapes[cats[i].categoryName] = cats[i].score;
            }
          }

          if (res.facialTransformationMatrixes && res.facialTransformationMatrixes[0]) {
            this.matrix = res.facialTransformationMatrixes[0].data;
          }
        } else {
          this.hasFace = false;
          this.rawLandmarks = null;
          this.landmarks = null;
        }
      } catch (err) {
        // Ignore single-frame detection errors during camera resize
      }
    }

    // Exponential smoothing across all 478 points for rock-steady, Snapchat-smooth tracking
    if (this.hasFace && this.rawLandmarks) {
      const raw = this.rawLandmarks;
      if (!this.landmarks || this.landmarks.length !== raw.length) {
        this.landmarks = raw.map((p) => ({ x: p.x, y: p.y, z: p.z }));
      } else {
        const alpha = 1 - Math.exp(-Math.min(50, Math.max(1, dtMs)) / 28);
        for (let i = 0; i < raw.length; i++) {
          const dst = this.landmarks[i];
          const src = raw[i];
          dst.x += (src.x - dst.x) * alpha;
          dst.y += (src.y - dst.y) * alpha;
          dst.z += (src.z - dst.z) * alpha;
        }
      }
    }

    return this.hasFace;
  }

  bs(name) {
    return this.blendshapes[name] || 0;
  }
}

export const snapTracker = new SnapFaceTracker();