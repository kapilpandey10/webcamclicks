/* WebcamClicks — flir_thermal 2D filter effect */

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

export const flirThermalEffect = {
    id: 'flir_thermal', name: 'Military FLIR Predator', icon: '🎯', category: 'Sci-Fi', perf: 'high', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 28);

      // High-precision false-color infrared heatmap
      renderFlirThermal(fx, src, w, h);

      fx.save();
      // Military HUD Tactical Overlay
      fx.strokeStyle = '#ffffff';
      fx.lineWidth = Math.max(1.5, Math.round(w * 0.0025));

      const cx = pose.cx;
      const cy = pose.cy;
      const cr = Math.max(24, pose.eyeDist * 0.6);

      // Live Head-Tracked Precision Target Crosshair
      fx.beginPath();
      fx.moveTo(cx - cr, cy); fx.lineTo(cx - cr * 0.3, cy);
      fx.moveTo(cx + cr * 0.3, cy); fx.lineTo(cx + cr, cy);
      fx.moveTo(cx, cy - cr); fx.lineTo(cx, cy - cr * 0.3);
      fx.moveTo(cx, cy + cr * 0.3); fx.lineTo(cx, cy + cr);
      fx.stroke();

      // Mil-dot tick marks on crosshair
      for (let i = -3; i <= 3; i++) {
        if (i === 0) continue;
        fx.beginPath();
        fx.arc(cx + i * cr * 0.28, cy, 1.5, 0, Math.PI * 2);
        fx.arc(cx, cy + i * cr * 0.28, 1.5, 0, Math.PI * 2);
        fx.fillStyle = '#ffffff';
        fx.fill();
      }

      // Target head-tracking bracket
      const hw = Math.max(pose.w * 0.6, cr * 1.5);
      const hh = Math.max(pose.h * 0.6, cr * 1.8);
      const bl = Math.max(10, Math.round(hw * 0.3));
      fx.strokeStyle = '#facc15';
      fx.lineWidth = 2;
      fx.beginPath(); fx.moveTo(cx - hw, cy - hh + bl); fx.lineTo(cx - hw, cy - hh); fx.lineTo(cx - hw + bl, cy - hh); fx.stroke();
      fx.beginPath(); fx.moveTo(cx + hw - bl, cy - hh); fx.lineTo(cx + hw, cy - hh); fx.lineTo(cx + hw, cy - hh + bl); fx.stroke();
      fx.beginPath(); fx.moveTo(cx - hw, cy + hh - bl); fx.lineTo(cx - hw, cy + hh); fx.lineTo(cx - hw + bl, cy + hh); fx.stroke();
      fx.beginPath(); fx.moveTo(cx + hw - bl, cy + hh); fx.lineTo(cx + hw, cy + hh); fx.lineTo(cx + hw, cy + hh - bl); fx.stroke();

      // Top Azimuth compass tape tracking head center X
      const fs = Math.max(10, Math.round(w * 0.02));
      fx.font = `bold ${fs}px "Courier New", monospace`;
      fx.textAlign = 'center';
      fx.textBaseline = 'top';
      fx.fillStyle = '#ffffff';
      const az = Math.floor(((pose.cx / w) * 360) % 360);
      fx.fillText(`[ ${String((az + 345) % 360).padStart(3, '0')} · · · ${String(az).padStart(3, '0')} · · · ${String((az + 15) % 360).padStart(3, '0')} ]`, w / 2, Math.round(h * 0.04));

      // Elevation ladder on left
      fx.textAlign = 'left';
      const ey0 = cy - cr * 1.5;
      for (let i = 0; i < 5; i++) {
        const ey = ey0 + i * cr * 0.75;
        fx.beginPath();
        fx.moveTo(Math.round(w * 0.05), ey);
        fx.lineTo(Math.round(w * 0.075), ey);
        fx.stroke();
      }

      // Military telemetry text
      fx.fillText(`SENSOR: FLIR-LWIR 850nm`, Math.round(w * 0.05), Math.round(h * 0.04));
      fx.fillText(`GAIN: AUTO (NIGHT-OPS)`, Math.round(w * 0.05), Math.round(h * 0.04) + fs * 1.3);

      const targetTemp = (36.8 + Math.sin(t * 0.003) * 0.4).toFixed(1);
      const estRange = (130 / Math.max(18, pose.eyeDist)).toFixed(1);
      fx.textAlign = 'right';
      fx.fillText(`TGT TEMP: ${targetTemp}°C [HOT-SPOT]`, w - Math.round(w * 0.05), Math.round(h * 0.04));
      fx.fillText(`RNG: ${estRange}M // ELEV: +02°`, w - Math.round(w * 0.05), Math.round(h * 0.04) + fs * 1.3);

      // Blinking red recording indicator
      if ((t % 1000) < 600) {
        fx.fillStyle = '#ef4444';
        fx.beginPath();
        fx.arc(Math.round(w * 0.05), h - Math.round(h * 0.06), 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.textBaseline = 'middle';
        fx.fillText('● REC [IR-HD]', Math.round(w * 0.05) + 16, h - Math.round(h * 0.06));
      }

      // Outer tactical frame border
      fx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
      fx.lineWidth = 2;
      fx.strokeRect(Math.round(w * 0.03), Math.round(h * 0.03), w - Math.round(w * 0.06), h - Math.round(h * 0.06));
      fx.restore();
    }
  };

export default flirThermalEffect;
