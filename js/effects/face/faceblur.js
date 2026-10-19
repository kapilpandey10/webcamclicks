/* WebcamClicks — faceblur face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const faceblurEffect = {
    id: 'faceblur', name: 'Blur Background', icon: '🌀', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h } = frame;
      fx.filter = 'blur(15px) brightness(0.96) saturate(1.05)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const g = geo(frame);
      const cx = g ? g.box.x + g.box.width / 2 : w / 2;
      const cy = g ? g.box.y + g.box.height * 0.68 : h * 0.46;
      const rx = g ? Math.max(w * 0.2, g.box.width * 1.05) : w * 0.27;
      const ry = g ? Math.max(h * 0.34, g.box.height * 1.68) : h * 0.44;

      const sc = scratch(w, h);
      sc.gx.drawImage(src, 0, 0, w, h);
      sc.gx.globalCompositeOperation = 'destination-in';
      const grad = sc.gx.createRadialGradient(cx, cy, Math.min(rx, ry) * 0.45, cx, cy, Math.max(rx, ry));
      grad.addColorStop(0, 'rgba(0,0,0,1)');
      grad.addColorStop(0.72, 'rgba(0,0,0,0.96)');
      grad.addColorStop(0.94, 'rgba(0,0,0,0.35)');
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      sc.gx.fillStyle = grad;
      sc.gx.beginPath();
      sc.gx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      sc.gx.fill();
      sc.gx.globalCompositeOperation = 'source-over';

      fx.drawImage(sc, 0, 0);
    }
  };

export default faceblurEffect;
