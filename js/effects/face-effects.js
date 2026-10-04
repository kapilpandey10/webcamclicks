/* WebcamClicks — face-detection effects.
   All effects here use 68-point landmarks from face-api.js (on-device).
   When no face is visible they fall back to a clean pass-through frame. */

import { clamp, lerp, rand, pick, makeCanvas } from '../utils.js';
import { LM, cent } from '../face/face-detection.js';

/* ---------- local scratch canvas (for crops) ---------- */
let SCR = null;
function scratch(w, h) {
  if (!SCR) {
    SCR = makeCanvas(w, h);
    SCR.gx = SCR.getContext('2d', { willReadFrequently: true });
    SCR.cw = w;
    SCR.ch = h;
  }
  if (SCR.cw !== w || SCR.ch !== h) {
    SCR.width = w;
    SCR.height = h;
    SCR.cw = w;
    SCR.ch = h;
  }
  SCR.gx.setTransform(1, 0, 0, 1, 0, 0);
  SCR.gx.globalAlpha = 1;
  SCR.gx.filter = 'none';
  return SCR;
}

/** Landmark geometry helper. Returns null when there is no face. */
function geo(frame) {
  const pts = frame.face && frame.face.points;
  const box = frame.face && frame.face.box;
  if (!pts || !box) return null;
  const lEye = cent(pts, LM.LEFT_EYE);
  const rEye = cent(pts, LM.RIGHT_EYE);
  const mouth = cent(pts, LM.MOUTH_OUTER);
  const angle = Math.atan2(rEye.y - lEye.y, rEye.x - lEye.x);
  const eyeDist = Math.max(8, Math.hypot(rEye.x - lEye.x, rEye.y - lEye.y));
  return {
    pts, box, lEye, rEye, mouth,
    nose: pts[30],
    chin: pts[8],
    angle,
    eyeDist,
    midEye: { x: (lEye.x + rEye.x) / 2, y: (lEye.y + rEye.y) / 2 }
  };
}

const passthrough = (fx, frame) => fx.drawImage(frame.src, 0, 0, frame.width, frame.height);

export const defsFace = [
  {
    id: 'sunglasses', name: 'Cool Shades', icon: '🕶️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { eyeDist } = g;
      const r = eyeDist * 0.52;
      fx.save();
      fx.translate(g.midEye.x, g.midEye.y);
      fx.rotate(g.angle);
      fx.fillStyle = 'rgba(12,14,26,0.86)';
      fx.strokeStyle = '#0a0a12';
      fx.lineWidth = Math.max(2.5, r * 0.16);
      for (const s of [-1, 1]) {
        fx.beginPath();
        fx.ellipse((s * eyeDist) / 2, 0, r, r * 0.74, 0, 0, Math.PI * 2);
        fx.fill();
        fx.stroke();
      }
      fx.beginPath();
      fx.moveTo(-eyeDist / 2 + r * 0.75, -r * 0.12);
      fx.quadraticCurveTo(0, -r * 0.55, eyeDist / 2 - r * 0.75, -r * 0.12);
      fx.stroke();
      fx.beginPath();
      fx.moveTo(-eyeDist / 2 - r, -r * 0.05);
      fx.lineTo(-eyeDist / 2 - r * 1.6, -r * 0.28);
      fx.moveTo(eyeDist / 2 + r, -r * 0.05);
      fx.lineTo(eyeDist / 2 + r * 1.6, -r * 0.28);
      fx.stroke();
      fx.strokeStyle = 'rgba(255,255,255,0.4)';
      fx.lineWidth = Math.max(1.5, r * 0.12);
      fx.beginPath();
      fx.moveTo(-eyeDist / 2 - r * 0.5, r * 0.32);
      fx.lineTo(-eyeDist / 2 + r * 0.25, -r * 0.38);
      fx.stroke();
      fx.restore();
    }
  },
  {
    id: 'crown', name: 'Royal Crown', icon: '👑', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const cw = g.box.width * 0.68;
      const ch = cw * 0.52;
      fx.save();
      fx.translate(g.box.x + g.box.width / 2, g.box.y + g.box.height * 0.02);
      fx.rotate(g.angle * 0.5);
      fx.beginPath();
      fx.moveTo(-cw / 2, ch * 0.4);
      fx.lineTo(-cw / 2, ch * 0.05);
      fx.lineTo(-cw * 0.32, ch * 0.42);
      fx.lineTo(-cw * 0.16, -ch * 0.1);
      fx.lineTo(0, ch * 0.42);
      fx.lineTo(cw * 0.16, -ch * 0.1);
      fx.lineTo(cw * 0.32, ch * 0.42);
      fx.lineTo(cw / 2, ch * 0.05);
      fx.lineTo(cw / 2, ch * 0.4);
      fx.closePath();
      const grad = fx.createLinearGradient(0, -ch * 0.1, 0, ch * 0.42);
      grad.addColorStop(0, '#ffe27a');
      grad.addColorStop(1, '#f2a51a');
      fx.fillStyle = grad;
      fx.fill();
      fx.strokeStyle = 'rgba(120,70,0,0.8)';
      fx.lineWidth = Math.max(1.4, cw * 0.015);
      fx.stroke();
      fx.fillStyle = '#ff4d6d';
      for (const px of [-cw * 0.16, 0, cw * 0.16]) {
        fx.beginPath();
        fx.arc(px, ch * 0.3, Math.max(2.5, cw * 0.035), 0, Math.PI * 2);
        fx.fill();
      }
      fx.restore();
    }
  },

  {
    id: 'dogears', name: 'Puppy Ears', icon: '🐶', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { eyeDist } = g;
      fx.save();
      fx.translate(g.midEye.x, g.midEye.y);
      fx.rotate(g.angle);
      for (const s of [-1, 1]) {
        fx.save();
        fx.translate(s * eyeDist * 0.85, -eyeDist * 0.9);
        fx.rotate(s * 0.5);
        fx.fillStyle = '#8d5524';
        fx.beginPath();
        fx.ellipse(0, 0, eyeDist * 0.32, eyeDist * 0.62, 0, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#c68642';
        fx.beginPath();
        fx.ellipse(0, eyeDist * 0.08, eyeDist * 0.18, eyeDist * 0.4, 0, 0, Math.PI * 2);
        fx.fill();
        fx.restore();
      }
      fx.restore();
    }
  },
  {
    id: 'mustache', name: 'Mustache', icon: '🥸', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { eyeDist } = g;
      const my = lerp(g.nose.y, g.mouth.y, 0.35);
      fx.save();
      fx.translate(g.nose.x, my);
      fx.rotate(g.angle);
      fx.fillStyle = '#241611';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.26, 0, eyeDist * 0.3, eyeDist * 0.14, -0.3, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.26, 0, eyeDist * 0.3, eyeDist * 0.14, 0.3, 0, Math.PI * 2);
      fx.fill();
      fx.restore();
    }
  },
  {
    id: 'partyhat', name: 'Party Hat', icon: '🥳', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const hw = g.box.width * 0.45;
      const hh = g.box.height * 0.72;
      fx.save();
      fx.translate(g.box.x + g.box.width / 2, g.box.y - hh * 0.1);
      fx.rotate(g.angle * 0.4);
      fx.beginPath();
      fx.moveTo(-hw / 2, 0);
      fx.lineTo(hw / 2, 0);
      fx.lineTo(0, -hh);
      fx.closePath();
      fx.fillStyle = pick(['#ff6b9d', '#6c5ce7', '#00cec9', '#ffa502']);
      fx.fill();
      fx.save();
      fx.clip();
      fx.fillStyle = 'rgba(255,255,255,0.35)';
      const stripes = 4;
      for (let i = -1; i <= stripes + 1; i++) {
        fx.beginPath();
        fx.moveTo(-hw / 2 + (i * hw) / stripes, 0);
        fx.lineTo(-hw / 2 + ((i + 0.5) * hw) / stripes, 0);
        fx.lineTo(-hw / 2 + ((i + 0.5) * hw) / stripes + hw * 0.3, -hh);
        fx.lineTo(-hw / 2 + (i * hw) / stripes + hw * 0.3, -hh);
        fx.closePath();
        fx.fill();
      }
      fx.restore();
      fx.beginPath();
      fx.arc(0, -hh - 4, Math.max(3, hw * 0.12), 0, Math.PI * 2);
      fx.fillStyle = '#ffe27a';
      fx.fill();
      fx.restore();
    }
  },

  {
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
  },
  {
    id: 'faceblur', name: 'Blur Background', icon: '🌀', category: 'Face', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h } = frame;
      fx.filter = 'blur(12px) brightness(0.95)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';
      const g = geo(frame);
      if (!g) return;
      const pad = 1.35;
      const bw = g.box.width * pad;
      const bh = g.box.height * pad;
      const bx = g.box.x - (bw - g.box.width) / 2;
      const by = g.box.y - (bh - g.box.height) / 2;
      fx.save();
      fx.beginPath();
      fx.ellipse(bx + bw / 2, by + bh / 2, bw / 2, bh / 2, 0, 0, Math.PI * 2);
      fx.clip();
      fx.drawImage(src, 0, 0, w, h);
      fx.restore();
    }
  },
  {
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
  },
  {
    id: 'facemesh', name: 'Face Mesh', icon: '🕸️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const pts = g.pts;
      const chains = [
        Array.from({ length: 17 }, (_, i) => i),
        [17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26],
        [27, 28, 29, 30],
        [31, 32, 33, 34, 35],
        [36, 37, 38, 39, 40, 41, 36],
        [42, 43, 44, 45, 46, 47, 42],
        [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48],
        [60, 61, 62, 63, 64, 65, 66, 67, 60]
      ];
      fx.strokeStyle = 'rgba(0,255,200,0.8)';
      fx.lineWidth = 1.5;
      for (const chain of chains) {
        fx.beginPath();
        chain.forEach((idx, i) => {
          const p = pts[idx];
          if (i === 0) fx.moveTo(p.x, p.y);
          else fx.lineTo(p.x, p.y);
        });
        fx.stroke();
      }
      fx.fillStyle = 'rgba(0,255,200,0.95)';
      for (const p of pts) {
        fx.beginPath();
        fx.arc(p.x, p.y, 1.7, 0, Math.PI * 2);
        fx.fill();
      }
    }
  },

  {
    id: 'emotion', name: 'Emotion Meter', icon: '🧠', category: 'Face', perf: 'low', requiresFace: true, needsExpressions: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      const expr = frame.face && frame.face.expressions;
      if (!g || !expr) return;
      const EXPR = {
        happy: ['😄', 'Happy'], sad: ['😢', 'Sad'], angry: ['😠', 'Angry'],
        surprised: ['😮', 'Surprised'], neutral: ['😐', 'Neutral'],
        disgusted: ['🤢', 'Disgusted'], fearful: ['😨', 'Fearful']
      };
      const top = Object.entries(expr).sort((a, b) => b[1] - a[1])[0];
      const [emoji, label] = EXPR[top[0]] || ['🙂', top[0]];
      const text = `${emoji} ${label} ${Math.round(top[1] * 100)}%`;
      fx.font = '700 20px -apple-system, "Segoe UI", sans-serif';
      const tw = fx.measureText(text).width;
      const pad = 14;
      const bw = tw + pad * 2;
      const bh = 42;
      const bx = clamp(g.box.x + g.box.width / 2 - bw / 2, 6, frame.width - bw - 6);
      let by = g.box.y - bh - 14;
      if (by < 6) by = g.box.y + g.box.height + 14;
      fx.save();
      fx.beginPath();
      roundRect(fx, bx, by, bw, bh, 12);
      fx.fillStyle = 'rgba(11, 11, 20, 0.85)';
      fx.fill();
      fx.strokeStyle = 'rgba(255,255,255,0.25)';
      fx.lineWidth = 1.5;
      fx.stroke();
      fx.fillStyle = '#ffffff';
      fx.textAlign = 'center';
      fx.textBaseline = 'middle';
      fx.fillText(text, bx + bw / 2, by + bh / 2 + 1);
      fx.restore();
      fx.textAlign = 'left';
      fx.textBaseline = 'alphabetic';
    }
  },
  {
    id: 'agegender', name: 'Age & Gender', icon: '🔍', category: 'Face', perf: 'low', requiresFace: true, needsAge: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const age = frame.face.age;
      const gender = frame.face.gender;
      if (age == null) return;
      const text = `~${Math.round(age)} yrs · ${gender === 'male' ? 'Male' : 'Female'}`;
      fx.font = '700 20px -apple-system, "Segoe UI", sans-serif';
      const tw = fx.measureText(text).width;
      const pad = 14;
      const bw = tw + pad * 2;
      const bh = 42;
      const bx = clamp(g.box.x + g.box.width / 2 - bw / 2, 6, frame.width - bw - 6);
      const by = clamp(g.box.y + g.box.height + 12, 6, frame.height - bh - 6);
      fx.save();
      fx.beginPath();
      roundRect(fx, bx, by, bw, bh, 12);
      fx.fillStyle = 'rgba(11, 11, 20, 0.85)';
      fx.fill();
      fx.strokeStyle = 'rgba(108, 92, 231, 0.7)';
      fx.lineWidth = 1.5;
      fx.stroke();
      fx.fillStyle = '#ffffff';
      fx.textAlign = 'center';
      fx.textBaseline = 'middle';
      fx.fillText(text, bx + bw / 2, by + bh / 2 + 1);
      fx.restore();
      fx.textAlign = 'left';
      fx.textBaseline = 'alphabetic';
      fx.font = '600 11px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255,255,255,0.55)';
      fx.fillText('AI estimate · for fun only', bx, by + bh + 14);
    }
  },

  {
    id: 'firebreath', name: 'Fire Breath', icon: '🐉', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) { this._p = []; return; }
      if (!this._p) this._p = [];
      const dt = clamp(frame.dt, 0, 50);
      const openRatio = Math.hypot(g.pts[62].x - g.pts[66].x, g.pts[62].y - g.pts[66].y) / g.eyeDist;
      if (openRatio > 0.32) {
        for (let i = 0; i < 5; i++) {
          this._p.push({
            x: g.mouth.x + rand(-6, 6),
            y: g.mouth.y,
            vx: rand(-0.08, 0.08),
            vy: -rand(0.12, 0.42),
            life: rand(450, 900),
            age: 0,
            r: rand(8, 20)
          });
        }
      }
      fx.globalCompositeOperation = 'lighter';
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        const k = 1 - p.age / p.life;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        const rad = p.r * (1 + (1 - k) * 1.7);
        const grad = fx.createRadialGradient(p.x, p.y, 1, p.x, p.y, rad);
        grad.addColorStop(0, `rgba(255,230,140,${0.85 * k})`);
        grad.addColorStop(0.45, `rgba(255,120,40,${0.6 * k})`);
        grad.addColorStop(1, 'rgba(255,40,0,0)');
        fx.fillStyle = grad;
        fx.beginPath();
        fx.arc(p.x, p.y, rad, 0, Math.PI * 2);
        fx.fill();
      }
      fx.globalCompositeOperation = 'source-over';
      if (this._p.length > 300) this._p.splice(0, this._p.length - 300);
    }
  },
  {
    id: 'confetti', name: 'Smile Confetti', icon: '🎊', category: 'Face', perf: 'low', requiresFace: true, needsExpressions: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      if (!this._p) this._p = [];
      const dt = clamp(frame.dt, 0, 50);
      const expr = frame.face && frame.face.expressions;
      const happy = expr ? (expr.happy || 0) : 0;
      if (happy > 0.6) {
        const cx = g.box.x + g.box.width / 2;
        const cy = g.box.y;
        for (let i = 0; i < 3; i++) {
          this._p.push({
            x: cx + rand(-g.box.width / 2, g.box.width / 2),
            y: cy + rand(-10, 10),
            vx: rand(-0.15, 0.15),
            vy: -rand(0.15, 0.4),
            rot: Math.random() * 6.28,
            vr: rand(-0.01, 0.01),
            s: rand(5, 10),
            life: rand(700, 1400),
            age: 0,
            color: pick(['#ff6b9d', '#6c5ce7', '#00cec9', '#ffa502', '#2ee6a8', '#ff5e6c'])
          });
        }
      }
      for (let i = this._p.length - 1; i >= 0; i--) {
        const p = this._p[i];
        p.age += dt;
        if (p.age >= p.life) { this._p.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 0.0006 * dt;
        p.rot += p.vr * dt;
        fx.save();
        fx.translate(p.x, p.y);
        fx.rotate(p.rot);
        fx.globalAlpha = clamp(1 - p.age / p.life + 0.2, 0, 1);
        fx.fillStyle = p.color;
        fx.fillRect(-p.s / 2, -p.s / 2, p.s, p.s * 0.6);
        fx.restore();
      }
      fx.globalAlpha = 1;
      if (this._p.length > 400) this._p.splice(0, this._p.length - 400);
    }
  },
  {
    id: 'catears', name: 'Cat Ears & Whiskers', icon: '🐱', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const { eyeDist } = g;
      fx.save();
      // Draw ears attached to head
      fx.translate(g.midEye.x, g.midEye.y);
      fx.rotate(g.angle);
      for (const s of [-1, 1]) {
        fx.save();
        fx.translate(s * eyeDist * 0.82, -eyeDist * 1.15);
        fx.rotate(s * 0.28);
        // Outer ear
        fx.beginPath();
        fx.moveTo(-eyeDist * 0.35, eyeDist * 0.2);
        fx.lineTo(0, -eyeDist * 0.65);
        fx.lineTo(eyeDist * 0.35, eyeDist * 0.2);
        fx.closePath();
        fx.fillStyle = '#ff758c';
        fx.fill();
        fx.strokeStyle = '#e11d48';
        fx.lineWidth = Math.max(2, eyeDist * 0.04);
        fx.stroke();
        // Inner ear
        fx.beginPath();
        fx.moveTo(-eyeDist * 0.2, eyeDist * 0.15);
        fx.lineTo(0, -eyeDist * 0.45);
        fx.lineTo(eyeDist * 0.2, eyeDist * 0.15);
        fx.closePath();
        fx.fillStyle = '#fed7e2';
        fx.fill();
        fx.restore();
      }
      // Cheeks blush
      fx.fillStyle = 'rgba(244, 63, 94, 0.35)';
      fx.beginPath();
      fx.ellipse(-eyeDist * 0.9, eyeDist * 0.35, eyeDist * 0.3, eyeDist * 0.18, -0.1, 0, Math.PI * 2);
      fx.ellipse(eyeDist * 0.9, eyeDist * 0.35, eyeDist * 0.3, eyeDist * 0.18, 0.1, 0, Math.PI * 2);
      fx.fill();

      // Cute nose
      const noseY = eyeDist * 0.42;
      fx.fillStyle = '#ec4899';
      fx.beginPath();
      fx.moveTo(-eyeDist * 0.14, noseY - eyeDist * 0.05);
      fx.lineTo(eyeDist * 0.14, noseY - eyeDist * 0.05);
      fx.lineTo(0, noseY + eyeDist * 0.08);
      fx.closePath();
      fx.fill();

      // Whiskers
      fx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      fx.lineWidth = Math.max(2, eyeDist * 0.035);
      fx.lineCap = 'round';
      for (const s of [-1, 1]) {
        const startX = s * eyeDist * 0.25;
        const wy = noseY + eyeDist * 0.02;
        for (const angleOffset of [-0.18, 0, 0.18]) {
          fx.beginPath();
          fx.moveTo(startX, wy + angleOffset * eyeDist * 0.5);
          fx.lineTo(startX + s * eyeDist * 0.85, wy + angleOffset * eyeDist * 1.2);
          fx.stroke();
        }
      }
      fx.restore();
    }
  },
  {
    id: 'angel', name: 'Golden Halo', icon: '😇', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const t = frame.time || performance.now();
      const bob = Math.sin(t * 0.0035) * (g.eyeDist * 0.08);
      fx.save();
      // Position above forehead / box top
      const topY = Math.min(g.box.y, g.midEye.y - g.eyeDist * 1.35) + bob;
      fx.translate(g.midEye.x, topY);
      fx.rotate(g.angle * 0.6);

      const hw = g.eyeDist * 0.95;
      const hh = g.eyeDist * 0.26;

      // Glow halo
      fx.shadowColor = 'rgba(255, 215, 0, 0.85)';
      fx.shadowBlur = 18;
      fx.strokeStyle = '#ffd700';
      fx.lineWidth = Math.max(3.5, g.eyeDist * 0.08);
      fx.beginPath();
      fx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      fx.stroke();

      // Inner bright ring
      fx.shadowColor = '#ffffff';
      fx.shadowBlur = 8;
      fx.strokeStyle = '#fffbeb';
      fx.lineWidth = Math.max(1.5, g.eyeDist * 0.03);
      fx.beginPath();
      fx.ellipse(0, 0, hw, hh, 0, 0, Math.PI * 2);
      fx.stroke();

      // Twinkling stars around halo
      fx.shadowBlur = 0;
      fx.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const starAngle = (t * 0.002 + (i * Math.PI) / 2) % (Math.PI * 2);
        const sx = Math.cos(starAngle) * (hw + 10);
        const sy = Math.sin(starAngle) * (hh + 6);
        const sparkSize = 2 + Math.sin(t * 0.006 + i) * 1.5;
        fx.beginPath();
        fx.arc(sx, sy, Math.max(1, sparkSize), 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
    }
  }
];

/** Register all face effects into an EffectManager instance. */
export function registerFaceEffects(manager) {
  manager.registerAll(defsFace);
}



