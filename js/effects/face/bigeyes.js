/* WebcamClicks — bigeyes face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const bigeyesEffect = {
    id: 'bigeyes', name: 'Big Eyes', icon: '😳', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { src, width: w, height: h } = frame;
      const r = g.eyeDist * 0.42;
      const k = 1.5;
      for (const eye of [g.lEye, g.rEye]) {
        const sx = clamp(eye.x - r, 0, w - 2 * r);
        const sy = clamp(eye.y - r, 0, h - 2 * r);
        const sw = Math.min(2 * r, w - sx);
        const sh = Math.min(2 * r, h - sy);
        fx.save();
        fx.beginPath();
        fx.arc(eye.x, eye.y, r * k * 0.95, 0, Math.PI * 2);
        fx.clip();
        fx.drawImage(src, sx, sy, sw, sh, eye.x - r * k, eye.y - r * k, sw * k, sh * k);
        fx.restore();
      }
    }
  };

export default bigeyesEffect;
