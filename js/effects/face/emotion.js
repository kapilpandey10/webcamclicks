/* WebcamClicks — emotion face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const emotionEffect = {
    id: 'emotion', name: 'Emotion Meter', icon: '🧠', category: 'Face', perf: 'low', requiresFace: true, needsExpressions: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;
      const rawExpr = frame.face && frame.face.expressions;
      const expr = rawExpr || { neutral: 0.85, happy: 0.1, surprised: 0.05 };

      const now = frame.now || performance.now();

      const THEMES = {
        happy: {
          emoji: '😄', title: 'JOY / HAPPINESS',
          color: '#facc15', aura: 'rgba(250, 204, 21, 0.28)',
          vibe: 'Radiating positive energy! ✨', particle: 'star'
        },
        surprised: {
          emoji: '😮', title: 'WOW / SURPRISED',
          color: '#06b6d4', aura: 'rgba(6, 182, 212, 0.32)',
          vibe: 'Mind blown! High alertness! ⚡', particle: 'ripple'
        },
        neutral: {
          emoji: '🧘', title: 'CHILL & ZEN',
          color: '#a855f7', aura: 'rgba(168, 85, 247, 0.22)',
          vibe: 'Unbothered composure & calm 🌿', particle: 'dust'
        },
        sad: {
          emoji: '🥺', title: 'MELANCHOLY',
          color: '#3b82f6', aura: 'rgba(59, 130, 246, 0.26)',
          vibe: 'Warm hug & cozy energy needed ☕', particle: 'mist'
        },
        angry: {
          emoji: '😤', title: 'FIERY FOCUS',
          color: '#ef4444', aura: 'rgba(239, 68, 68, 0.35)',
          vibe: 'Intense drive & powerhouse fire 🔥', particle: 'ember'
        },
        disgusted: {
          emoji: '🤨', title: 'SKEPTICAL / SUS',
          color: '#10b981', aura: 'rgba(16, 185, 129, 0.28)',
          vibe: 'Side-eyeing the vibe 👀', particle: 'ring'
        },
        fearful: {
          emoji: '⚡', title: 'HIGH ALERT',
          color: '#ec4899', aura: 'rgba(236, 72, 153, 0.30)',
          vibe: 'Spidey-senses active & wired! ⚡', particle: 'spark'
        }
      };

      // Smooth expression scores with EMA
      if (!this._scores) this._scores = {};
      for (const [k, v] of Object.entries(expr)) {
        this._scores[k] = lerp(this._scores[k] ?? v, v, 0.15);
      }
      const sorted = Object.entries(this._scores).sort((a, b) => b[1] - a[1]);
      const [topKey, topVal] = sorted[0] || ['neutral', 1];
      const theme = THEMES[topKey] || THEMES.neutral;

      fx.save();

      // 1. Dynamic Glowing Mood Aura Halo around Head
      const auraRadius = g.headW * (0.85 + 0.08 * Math.sin(now * 0.005));
      const auraGrad = fx.createRadialGradient(g.midEye.x, g.midEye.y, g.headW * 0.25, g.midEye.x, g.midEye.y, auraRadius);
      auraGrad.addColorStop(0, theme.aura);
      auraGrad.addColorStop(0.7, theme.aura.replace(/[\d\.]+\)$/, '0.08)'));
      auraGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      fx.fillStyle = auraGrad;
      fx.beginPath();
      fx.arc(g.midEye.x, g.midEye.y, auraRadius, 0, Math.PI * 2);
      fx.fill();

      // 2. Emotion-Reactive Particle Atmosphere
      if (!this._particles) this._particles = [];
      if (this._particles.length < 24 && Math.random() < 0.35) {
        this._particles.push({
          x: g.midEye.x + rand(-g.headW * 0.55, g.headW * 0.55),
          y: g.midEye.y + rand(-g.headW * 0.3, g.headW * 0.5),
          vx: rand(-0.4, 0.4),
          vy: topKey === 'sad' ? rand(0.6, 1.4) : rand(-1.4, -0.4),
          size: rand(4, 9),
          life: 1,
          decay: rand(0.012, 0.022),
          type: theme.particle,
          rot: rand(0, Math.PI * 2),
          vrot: rand(-0.06, 0.06),
          color: theme.color
        });
      }

      for (let i = this._particles.length - 1; i >= 0; i--) {
        const p = this._particles[i];
        p.x += p.vx;
        p.y += p.vy;
        p.rot += p.vrot;
        p.life -= p.decay;
        if (p.life <= 0) {
          this._particles.splice(i, 1);
          continue;
        }
        fx.save();
        fx.globalAlpha = p.life;
        fx.translate(p.x, p.y);
        fx.rotate(p.rot);
        if (p.type === 'star') {
          fx.fillStyle = p.color;
          fx.beginPath();
          for (let s = 0; s < 4; s++) {
            fx.rotate(Math.PI / 2);
            fx.lineTo(p.size, 0);
            fx.lineTo(p.size * 0.25, p.size * 0.25);
          }
          fx.closePath();
          fx.fill();
        } else if (p.type === 'ripple') {
          fx.strokeStyle = p.color;
          fx.lineWidth = 1.5;
          fx.beginPath();
          fx.arc(0, 0, (1 - p.life) * 22 + 4, 0, Math.PI * 2);
          fx.stroke();
        } else {
          fx.fillStyle = p.color;
          fx.beginPath();
          fx.arc(0, 0, p.size * 0.4, 0, Math.PI * 2);
          fx.fill();
        }
        fx.restore();
      }

      // 3. Multi-Emotion Equalizer HUD Card
      const cw = 250;
      const ch = 114;
      let targetX = clamp(g.box.x + g.box.width / 2 - cw / 2, 10, frame.width - cw - 10);
      let targetY = g.box.y - ch - 16;
      if (targetY < 12) targetY = g.box.y + g.box.height + 16;
      if (targetY + ch > frame.height - 10) targetY = frame.height - ch - 10;

      if (!this._cardX) { this._cardX = targetX; this._cardY = targetY; }
      else {
        this._cardX = lerp(this._cardX, targetX, 0.16);
        this._cardY = lerp(this._cardY, targetY, 0.16);
      }
      const cx = this._cardX;
      const cy = this._cardY;

      // Card Body
      roundRect(fx, cx, cy, cw, ch, 14);
      fx.fillStyle = 'rgba(10, 14, 26, 0.90)';
      fx.fill();
      fx.strokeStyle = theme.color + 'aa';
      fx.lineWidth = 1.5;
      fx.stroke();

      // Top glowing color bar
      roundRect(fx, cx, cy, cw, 4, 3);
      fx.fillStyle = theme.color;
      fx.fill();

      // Header: Emoji, Title, Score %
      fx.font = '22px -apple-system, sans-serif';
      fx.fillText(theme.emoji, cx + 12, cy + 28);

      fx.font = '700 13px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = '#ffffff';
      fx.fillText(theme.title, cx + 42, cy + 22);

      fx.font = '800 16px -apple-system, "Segoe UI", sans-serif';
      fx.fillStyle = theme.color;
      fx.textAlign = 'right';
      fx.fillText(`${Math.round(topVal * 100)}%`, cx + cw - 12, cy + 23);
      fx.textAlign = 'left';

      // Vibe tagline
      fx.font = '500 10px -apple-system, sans-serif';
      fx.fillStyle = 'rgba(255, 255, 255, 0.65)';
      fx.fillText(theme.vibe, cx + 42, cy + 35);

      // Multi-Emotion Spectrum Equalizer (Top 3)
      const top3 = sorted.slice(0, 3);
      const startEqY = cy + 50;
      top3.forEach(([key, val], idx) => {
        const itemY = startEqY + idx * 19;
        const itemTheme = THEMES[key] || THEMES.neutral;
        const barW = 120;
        const barH = 6;
        const fillW = Math.max(4, barW * clamp(val, 0, 1));

        // Label
        fx.font = '600 9.5px ui-monospace, Menlo, monospace';
        fx.fillStyle = 'rgba(255, 255, 255, 0.75)';
        fx.fillText(key.toUpperCase().slice(0, 7), cx + 12, itemY + 6);

        // Bar Track
        roundRect(fx, cx + 66, itemY, barW, barH, 3);
        fx.fillStyle = 'rgba(255, 255, 255, 0.12)';
        fx.fill();

        // Bar Fill
        roundRect(fx, cx + 66, itemY, fillW, barH, 3);
        fx.fillStyle = itemTheme.color;
        fx.fill();

        // Percentage
        fx.font = '700 9.5px ui-monospace, Menlo, monospace';
        fx.fillStyle = '#ffffff';
        fx.textAlign = 'right';
        fx.fillText(`${Math.round(val * 100)}%`, cx + cw - 12, itemY + 6);
        fx.textAlign = 'left';
      });

      fx.restore();
    }
  };

export default emotionEffect;
