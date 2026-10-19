/* WebcamClicks — blood_moon 2D filter effect */

import { clamp, lerp, rand, pick, makeCanvas, isMobile } from '../../utils.js';
import {
  ensureScratch,
  pixelPass,
  lumOf,
  addNoise,
  getGrainPattern,
  applyFilmGrain,
  getBloomCanvas,
  renderHalationBloom,
  drawDateStamp,
  drawAnamorphicStreak,
  drawBackgroundBokehDiscs,
  renderShutterMotion,
  renderDreamTrails,
  renderPortraitBokeh,
  getFisheyeBuffers,
  renderFisheye,
  renderFlirThermal,
  renderNeonEdgePass,
  drawCausticRays,
  renderLiquidRainbowPass,
  getHeadPose,
  smoothPose
} from './filter-helpers.js';

export const bloodMoonEffect = {
  id: 'blood_moon',
  name: 'Gothic Blood Moon',
  icon: '🩸',
  category: 'Cinema',
  perf: 'medium',
  requiresFace: true,

  render(fx, frame) {
    const { src, width: w, height: h, time, now, dt } = frame;
    const t = time || now || performance.now();
    const delta = clamp(dt || 16.7, 1, 50);
    const pose = smoothPose(this, getHeadPose(frame), delta, 35);

    fx.save();

    // 1. High-Contrast Gothic Noir Base (Desaturated monochrome with deep crushed obsidian blacks)
    fx.filter = 'grayscale(0.88) contrast(1.42) brightness(0.92)';
    fx.drawImage(src, 0, 0, w, h);
    fx.filter = 'none';

    // 2. Dramatic Crimson Backlight Wrap & Rim Light on Subject
    fx.save();
    fx.globalCompositeOperation = 'screen';
    const headX = pose.hasFace ? pose.cx : w * 0.5;
    const headY = pose.hasFace ? pose.cy : h * 0.5;
    const headSpread = pose.hasFace ? pose.eyeDist * 2.8 : Math.min(w, h) * 0.5;

    const rimLight = fx.createRadialGradient(headX, headY, headSpread * 0.35, headX, headY, headSpread * 1.5);
    rimLight.addColorStop(0, 'rgba(239, 68, 68, 0.42)');
    rimLight.addColorStop(0.5, 'rgba(153, 27, 27, 0.22)');
    rimLight.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fx.fillStyle = rimLight;
    fx.fillRect(0, 0, w, h);
    fx.restore();

    // 3. Photorealistic Eclipsed Gothic Blood Moon in Upper Sky
    const moonR = Math.min(w, h) * 0.17;
    const moonX = w * 0.80;
    const moonY = h * 0.21;

    fx.save();
    // A. Outer Atmospheric Corona & Red Light Shafts
    fx.globalCompositeOperation = 'screen';
    const coronaR = moonR * 2.4;
    const corona = fx.createRadialGradient(moonX, moonY, moonR * 0.7, moonX, moonY, coronaR);
    corona.addColorStop(0, 'rgba(239, 68, 68, 0.45)');
    corona.addColorStop(0.35, 'rgba(185, 28, 28, 0.25)');
    corona.addColorStop(0.7, 'rgba(127, 29, 29, 0.1)');
    corona.addColorStop(1, 'rgba(0, 0, 0, 0)');
    fx.fillStyle = corona;
    fx.beginPath();
    fx.arc(moonX, moonY, coronaR, 0, Math.PI * 2);
    fx.fill();

    // Horizontal Anamorphic Red Lens Streak piercing across the Blood Moon
    const streakGrad = fx.createLinearGradient(0, moonY, w, moonY);
    streakGrad.addColorStop(0, 'rgba(239, 68, 68, 0)');
    streakGrad.addColorStop(0.65, 'rgba(239, 68, 68, 0.18)');
    streakGrad.addColorStop(0.8, 'rgba(254, 202, 202, 0.45)');
    streakGrad.addColorStop(0.95, 'rgba(239, 68, 68, 0.18)');
    streakGrad.addColorStop(1, 'rgba(239, 68, 68, 0)');
    fx.fillStyle = streakGrad;
    fx.fillRect(0, moonY - 2, w, 4);

    // B. Lunar Sphere Surface with Basalt Maria & Crater Textures
    fx.globalCompositeOperation = 'source-over';
    fx.save();
    fx.beginPath();
    fx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    fx.clip();

    // Deep Blood Red Base Lunar Gradient
    const moonBase = fx.createRadialGradient(moonX - moonR * 0.25, moonY - moonR * 0.25, 2, moonX, moonY, moonR);
    moonBase.addColorStop(0, '#fecdd3'); // searing pale pink-white hotspot
    moonBase.addColorStop(0.2, '#f87171'); // vibrant blood crimson
    moonBase.addColorStop(0.6, '#b91c1c'); // deep maroon
    moonBase.addColorStop(0.9, '#450a0a'); // dark shadow limb
    moonBase.addColorStop(1, '#1c0505'); // eclipse edge
    fx.fillStyle = moonBase;
    fx.fillRect(moonX - moonR, moonY - moonR, moonR * 2, moonR * 2);

    // Lunar Maria (Dark basalt seas on the lunar face)
    const mariaPuffs = [
      { x: -0.22, y: -0.15, r: 0.32, a: 0.35 },
      { x: 0.18, y: -0.28, r: 0.28, a: 0.30 },
      { x: -0.15, y: 0.25, r: 0.38, a: 0.40 },
      { x: 0.22, y: 0.18, r: 0.25, a: 0.32 },
      { x: 0.05, y: -0.05, r: 0.22, a: 0.25 }
    ];
    mariaPuffs.forEach((m) => {
      const mx = moonX + m.x * moonR;
      const my = moonY + m.y * moonR;
      const mr = m.r * moonR;
      const mg = fx.createRadialGradient(mx, my, 1, mx, my, mr);
      mg.addColorStop(0, `rgba(30, 4, 8, ${m.a})`);
      mg.addColorStop(0.7, `rgba(45, 6, 12, ${m.a * 0.6})`);
      mg.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = mg;
      fx.beginPath();
      fx.arc(mx, my, mr, 0, Math.PI * 2);
      fx.fill();
    });

    // C. Translucent Gothic Clouds Drifting across the Moon
    const cloudSpeed = t * 0.0004;
    const cloudOffset = (cloudSpeed * w * 0.5) % (moonR * 4);
    const cloudY = moonY + Math.sin(t * 0.001) * 8;
    const cg = fx.createLinearGradient(moonX - moonR, cloudY, moonX + moonR, cloudY + moonR * 0.5);
    cg.addColorStop(0, 'rgba(15, 2, 6, 0.7)');
    cg.addColorStop(0.5, 'rgba(35, 5, 12, 0.45)');
    cg.addColorStop(1, 'rgba(10, 1, 4, 0.65)');
    fx.fillStyle = cg;
    fx.beginPath();
    fx.ellipse(moonX - moonR * 0.5 + cloudOffset * 0.5, cloudY, moonR * 1.2, moonR * 0.35, 0.15, 0, Math.PI * 2);
    fx.fill();

    fx.restore(); // end moon clip

    // Glowing Crimson Lunar Rim Outline
    fx.strokeStyle = 'rgba(254, 202, 202, 0.85)';
    fx.lineWidth = 1.5;
    fx.shadowColor = '#ef4444';
    fx.shadowBlur = 12;
    fx.beginPath();
    fx.arc(moonX, moonY, moonR, 0, Math.PI * 2);
    fx.stroke();
    fx.shadowBlur = 0;
    fx.restore();

    // 4. Distant Flock of Silhouette Bats Flying Across the Moon
    fx.save();
    const batCount = 6;
    for (let i = 0; i < batCount; i++) {
      const batPhase = t * 0.0008 + (i * 1.85);
      const batProgress = (batPhase) % 1.0;

      // Bat flight vector: sweeping from upper-left toward moon and beyond
      const bx = (w * 0.3) + batProgress * (w * 0.85) + Math.sin(t * 0.003 + i) * 15;
      const by = (h * 0.08) + Math.sin(batProgress * Math.PI) * (h * 0.18) + (i * 16);
      const batScale = Math.min(w, h) * (0.016 + (i % 3) * 0.005);

      // Wing flap animation
      const flap = Math.sin(t * 0.022 + i * 2.1);

      fx.save();
      fx.translate(bx, by);
      fx.rotate(0.15 + flap * 0.08);

      // Gothic Bat Silhouette Wings
      fx.fillStyle = '#050106';
      fx.beginPath();
      fx.moveTo(0, 0); // bat body
      // Left wing
      fx.quadraticCurveTo(-batScale * 1.4, -batScale * (1.2 + flap * 0.8), -batScale * 2.4, -batScale * (0.4 - flap * 0.4));
      fx.quadraticCurveTo(-batScale * 1.6, batScale * 0.6, -batScale * 0.6, batScale * 0.3);
      fx.lineTo(0, batScale * 0.8); // tail
      // Right wing
      fx.lineTo(batScale * 0.6, batScale * 0.3);
      fx.quadraticCurveTo(batScale * 1.6, batScale * 0.6, batScale * 2.4, -batScale * (0.4 - flap * 0.4));
      fx.quadraticCurveTo(batScale * 1.4, -batScale * (1.2 + flap * 0.8), 0, 0);
      fx.closePath();
      fx.fill();
      fx.restore();
    }
    fx.restore();

    // 5. Cinematic Volumetric Rolling Ground Fog
    fx.save();
    const fogBaseY = h * 0.68;
    const waveCount = 3;

    for (let layer = 0; layer < waveCount; layer++) {
      const ly = fogBaseY + layer * (h * 0.09);
      const speed = 0.0012 + layer * 0.0008;
      const alpha = 0.22 + layer * 0.15;

      fx.beginPath();
      fx.moveTo(0, h);
      fx.lineTo(0, ly);

      const segments = 12;
      const step = w / segments;
      for (let s = 0; s <= segments; s++) {
        const sx = s * step;
        const wave = Math.sin(t * speed + s * 0.8 + layer * 2) * 14;
        fx.lineTo(sx, ly + wave);
      }

      fx.lineTo(w, h);
      fx.closePath();

      const fogGrad = fx.createLinearGradient(0, ly, 0, h);
      fogGrad.addColorStop(0, `rgba(185, 28, 28, ${alpha * 0.4})`);
      fogGrad.addColorStop(0.4, `rgba(153, 27, 27, ${alpha * 0.8})`);
      fogGrad.addColorStop(1, `rgba(69, 10, 10, ${alpha * 1.2})`);
      fx.fillStyle = fogGrad;
      fx.fill();
    }
    fx.restore();

    // 6. Occult Vampire Blood Tear / Eye Highlight (When face detected)
    if (pose.hasFace && pose.lEye && pose.rEye) {
      fx.save();
      // Glowing deep ruby eyes
      [pose.lEye, pose.rEye].forEach((eye) => {
        const eg = fx.createRadialGradient(eye.x, eye.y, 0.5, eye.x, eye.y, pose.eyeDist * 0.14);
        eg.addColorStop(0, 'rgba(254, 202, 202, 0.95)');
        eg.addColorStop(0.4, 'rgba(239, 68, 68, 0.65)');
        eg.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = eg;
        fx.beginPath();
        fx.arc(eye.x, eye.y, pose.eyeDist * 0.14, 0, Math.PI * 2);
        fx.fill();
      });

      // Subtle crimson tear running down left cheek
      const tearLen = pose.eyeDist * (0.65 + Math.sin(t * 0.003) * 0.1);
      fx.strokeStyle = 'rgba(185, 28, 28, 0.85)';
      fx.lineWidth = Math.max(1.5, pose.eyeDist * 0.025);
      fx.lineCap = 'round';
      fx.beginPath();
      fx.moveTo(pose.lEye.x + 2, pose.lEye.y + pose.eyeDist * 0.15);
      fx.quadraticCurveTo(
        pose.lEye.x + 4,
        pose.lEye.y + tearLen * 0.5,
        pose.lEye.x + 1,
        pose.lEye.y + tearLen
      );
      fx.stroke();
      fx.restore();
    }

    // 7. Widescreen 2.39:1 Anamorphic Cinematic Letterbox Bars
    fx.save();
    fx.globalCompositeOperation = 'source-over';
    fx.fillStyle = '#060207';
    const barH = Math.round(h * 0.085);
    fx.fillRect(0, 0, w, barH);
    fx.fillRect(0, h - barH, w, barH);
    fx.restore();

    // 8. 35mm Gritty Film Grain
    applyFilmGrain(fx, w, h, 0.26);

    fx.restore();
  }
};

export default bloodMoonEffect;
