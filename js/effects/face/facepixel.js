/* WebcamClicks — facepixel face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const facepixelEffect = {
    id: 'facepixel', name: 'Pixel Face', icon: '🟪', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { src, width: w, height: h } = frame;
      const bx = clamp(g.box.x - 10, 0, w - 10);
      const by = clamp(g.box.y - 10, 0, h - 10);
      const bw = Math.min(g.box.width + 20, w - bx);
      const bh = Math.min(g.box.height + 20, h - by);
      const cell = 10;
      const sc = scratch(Math.max(2, Math.round(bw / cell)), Math.max(2, Math.round(bh / cell)));
      sc.gx.drawImage(src, bx, by, bw, bh, 0, 0, sc.cw, sc.ch);
      fx.imageSmoothingEnabled = false;
      fx.save();
      fx.beginPath();
      fx.ellipse(bx + bw / 2, by + bh / 2, (bw / 2) * 1.04, (bh / 2) * 1.04, 0, 0, Math.PI * 2);
      fx.clip();
      fx.drawImage(sc, 0, 0, sc.cw, sc.ch, bx, by, bw, bh);
      fx.restore();
      fx.imageSmoothingEnabled = true;
    }
  };

export default facepixelEffect;
