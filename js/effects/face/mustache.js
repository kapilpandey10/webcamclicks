/* WebcamClicks — mustache face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const mustacheEffect = {
    id: 'mustache', name: 'Mustache', icon: '🥸', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const s = smoothGeo(this, g, frame.dt || 16, 35);
      if (!s) return;
      const eyeDist = s.eyeDist;
      const my = lerp(s.noseY, (g.mouth ? g.mouth.y : s.noseY + eyeDist * 0.4), 0.38);
      fx.save();
      fx.translate(s.noseX, my);
      fx.rotate(s.a);
      fx.fillStyle = '#1c1917';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.26, 0, eyeDist * 0.32, eyeDist * 0.15, -0.28, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.26, 0, eyeDist * 0.32, eyeDist * 0.15, 0.28, 0, Math.PI * 2);
      fx.fill();
      // Silky hair sheen
      fx.fillStyle = 'rgba(255,255,255,0.18)';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.24, -eyeDist * 0.04, eyeDist * 0.24, eyeDist * 0.05, -0.28, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.24, -eyeDist * 0.04, eyeDist * 0.24, eyeDist * 0.05, 0.28, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }
  };

export default mustacheEffect;
