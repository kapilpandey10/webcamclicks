/* WebcamClicks — shared MediaPipe Tasks Vision loader.
   One copy of the library + WASM runtime is shared by background replacement,
   the passport photo tool and anything else that needs on-device vision.
   Models are self-hosted under /assets/models/mediapipe; nothing is uploaded. */

export const VISION_VERSION = '0.10.14';
const VISION_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/vision_bundle.mjs`;
const WASM_ROOT = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VISION_VERSION}/wasm`;

export const MODELS = {
  segmenterLandscape: '/assets/models/mediapipe/selfie_segmenter_landscape.tflite',
  segmenterSquare: '/assets/models/mediapipe/selfie_segmenter.tflite',
  faceDetector: '/assets/models/mediapipe/blaze_face_short_range.tflite'
};

let visionPromise = null;

/** Resolves to { vision, fileset } — loaded once per page. */
export function loadVision() {
  if (!visionPromise) {
    visionPromise = (async () => {
      const vision = await import(/* webpackIgnore: true */ VISION_CDN);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_ROOT);
      return { vision, fileset };
    })().catch((err) => {
      visionPromise = null;   // allow a retry after a network hiccup
      throw err;
    });
  }
  return visionPromise;
}

/** Create a task with the GPU delegate, falling back to CPU on older devices. */
export async function createTask(TaskName, options) {
  const { vision, fileset } = await loadVision();
  const Task = vision[TaskName];
  try {
    return await Task.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'GPU' }
    });
  } catch (_) {
    return Task.createFromOptions(fileset, {
      ...options,
      baseOptions: { ...options.baseOptions, delegate: 'CPU' }
    });
  }
}

/** Pick the person-confidence mask out of a segmentation result. */
export function personMask(result) {
  const masks = result && result.confidenceMasks;
  if (!masks || !masks.length) return null;
  return masks[masks.length - 1];   // selfie models: last category is "person"
}
