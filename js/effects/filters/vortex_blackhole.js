/* WebcamClicks — vortex_blackhole 2D filter effect */

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

export const vortexBlackholeEffect = {
    id: 'vortex_blackhole', name: 'Gargantua Black Hole', icon: '🕳️', category: 'Cosmic', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 35);

      // Deep cosmic space grade
      fx.save();
      fx.filter = 'contrast(1.4) brightness(0.85) saturate(1.3) hue-rotate(-25deg)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      const bhX = pose.cx;
      const bhY = pose.cy;
      const bhR = Math.max(22, pose.w * 0.38);

      fx.save();
      fx.translate(bhX, bhY);
      fx.rotate(pose.angle * 0.8);
      // Perspective tilt with head yaw
      const diskTilt = 0.28 + pose.yaw * 0.15;

      // 1. Relativistic Accretion Disk (Background Half behind event horizon)
      fx.save();
      fx.scale(1, diskTilt);
      fx.rotate(t * 0.001);
      const diskR = bhR * 2.8;

      // Outer swirling plasma ring
      const diskGrad = fx.createRadialGradient(0, 0, bhR * 1.05, 0, 0, diskR);
      diskGrad.addColorStop(0, '#ffffff');
      diskGrad.addColorStop(0.2, '#fde047');
      diskGrad.addColorStop(0.5, '#ea580c');
      diskGrad.addColorStop(0.8, '#7c2d12');
      diskGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = diskGrad;
      fx.beginPath();
      fx.arc(0, 0, diskR, 0, Math.PI * 2);
      fx.fill();
      fx.restore();

      // 2. Gravitational Lensing Arc (Light bent over the top and bottom of singularity)
      fx.save();
      fx.globalCompositeOperation = 'screen';
      [-1, 1].forEach((dir) => {
        fx.beginPath();
        fx.ellipse(0, dir * bhR * 0.75, bhR * 1.5, bhR * 0.65, 0, 0, Math.PI * 2);
        const lensGrad = fx.createLinearGradient(0, dir * bhR * 1.2, 0, 0);
        lensGrad.addColorStop(0, 'rgba(253, 224, 71, 0.7)');
        lensGrad.addColorStop(0.6, 'rgba(234, 88, 12, 0.4)');
        lensGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
        fx.fillStyle = lensGrad;
        fx.fill();
      });
      fx.restore();

      // 3. Pitch-Black Event Horizon (Singularity Core)
      fx.beginPath();
      fx.arc(0, 0, bhR, 0, Math.PI * 2);
      fx.fillStyle = '#000000';
      fx.shadowColor = '#000000';
      fx.shadowBlur = 15;
      fx.fill();
      fx.shadowBlur = 0;

      // 4. Incandescent Photon Sphere (Thin white-hot orbital ring)
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.5, Math.round(bhR * 0.06));
      fx.shadowColor = '#fef08a';
      fx.shadowBlur = 10;
      fx.beginPath();
      fx.arc(0, 0, bhR * 1.03, 0, Math.PI * 2);
      fx.stroke();
      fx.shadowBlur = 0;

      // 5. Forefront Accretion Disk with Relativistic Doppler Beaming!
      // (Approaching left side is boosted in brightness and bluer; receding right side is dimmer red)
      fx.save();
      fx.scale(1, diskTilt);
      fx.rotate(t * 0.001);

      // Approaching side (Doppler blue-shifted glow)
      const dopplerGrad = fx.createRadialGradient(-bhR * 0.8, 0, 0, -bhR * 0.8, 0, diskR);
      dopplerGrad.addColorStop(0, 'rgba(255, 255, 255, 0.95)');
      dopplerGrad.addColorStop(0.3, 'rgba(56, 189, 248, 0.8)');
      dopplerGrad.addColorStop(0.7, 'rgba(234, 88, 12, 0.3)');
      dopplerGrad.addColorStop(1, 'rgba(0,0,0,0)');
      fx.fillStyle = dopplerGrad;
      fx.beginPath();
      fx.arc(0, 0, diskR, Math.PI * 0.45, Math.PI * 1.55);
      fx.fill();
      fx.restore();

      // 6. Warped Star Dust Infall Particles
      fx.fillStyle = 'rgba(254, 240, 138, 0.85)';
      for (let i = 0; i < 20; i++) {
        const spiralA = t * 0.002 + (i * Math.PI * 2) / 20;
        const spiralR = bhR * 1.1 + ((t * 0.04 + i * 18) % (bhR * 1.8));
        const px = Math.cos(spiralA) * spiralR;
        const py = Math.sin(spiralA) * spiralR * diskTilt;
        fx.beginPath();
        fx.arc(px, py, Math.max(1, bhR * 0.025), 0, Math.PI * 2);
        fx.fill();
      }

      fx.restore();
      fx.restore();
    }
  };

export default vortexBlackholeEffect;
