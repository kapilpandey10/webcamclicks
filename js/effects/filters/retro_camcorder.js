/* WebcamClicks — retro_camcorder 2D filter effect */

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

export const retroCamcorderEffect = {
    id: 'retro_camcorder', name: '90s Hi8 Camcorder', icon: '📹', category: 'Vintage', perf: 'medium', requiresFace: true,
    render(fx, frame) {
      const { src, width: w, height: h, time, now, dt } = frame;
      const t = time || now || 0;
      const delta = clamp(dt || 16.7, 0, 50);
      const pose = smoothPose(this, getHeadPose(frame), delta, 40);

      fx.save();
      // Analog magnetic tape grade
      fx.filter = 'contrast(1.12) brightness(1.04) saturate(1.18) sepia(0.08)';
      fx.drawImage(src, 0, 0, w, h);
      fx.filter = 'none';

      // Analog tape chroma delay (R/B color separation)
      fx.globalCompositeOperation = 'screen';
      fx.globalAlpha = 0.35;
      fx.drawImage(src, 2.5, 0, w, h);
      fx.drawImage(src, -2.5, 0, w, h);
      fx.globalCompositeOperation = 'source-over';
      fx.globalAlpha = 1;

      // Moving magnetic tracking error bar
      const trackY = (t * 0.08) % (h + 180) - 90;
      const trackGrad = fx.createLinearGradient(0, trackY - 30, 0, trackY + 30);
      trackGrad.addColorStop(0, 'rgba(255, 255, 255, 0)');
      trackGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.22)');
      trackGrad.addColorStop(1, 'rgba(255, 255, 255, 0)');
      fx.fillStyle = trackGrad;
      fx.fillRect(0, trackY - 30, w, 60);

      // Horizontal scanlines
      fx.fillStyle = 'rgba(0, 0, 0, 0.14)';
      for (let y = 0; y < h; y += 3) fx.fillRect(0, y, w, 1);

      // Live Head-Tracked 90s Autofocus Bracket [   ]
      const afW = Math.max(28, pose.w * 0.45);
      const afH = Math.max(28, pose.h * 0.45);
      const afL = Math.max(8, afW * 0.3);
      fx.strokeStyle = pose.hasFace ? '#22c55e' : 'rgba(255, 255, 255, 0.7)';
      fx.lineWidth = 2;
      const ax = pose.cx;
      const ay = pose.cy;
      fx.beginPath(); fx.moveTo(ax - afW, ay - afH + afL); fx.lineTo(ax - afW, ay - afH); fx.lineTo(ax - afW + afL, ay - afH); fx.stroke();
      fx.beginPath(); fx.moveTo(ax + afW - afL, ay - afH); fx.lineTo(ax + afW, ay - afH); fx.lineTo(ax + afW, ay - afH + afL); fx.stroke();
      fx.beginPath(); fx.moveTo(ax - afW, ay + afH - afL); fx.lineTo(ax - afW, ay + afH); fx.lineTo(ax - afW + afL, ay + afH); fx.stroke();
      fx.beginPath(); fx.moveTo(ax + afW - afL, ay + afH); fx.lineTo(ax + afW, ay + afH); fx.lineTo(ax + afW, ay + afH - afL); fx.stroke();

      // Authentic 90s Camcorder OSD
      const fs = Math.max(12, Math.round(w * 0.026));
      fx.font = `bold ${fs}px "Courier New", Courier, monospace`;
      fx.fillStyle = '#ffffff';
      fx.shadowColor = 'rgba(0, 0, 0, 0.85)';
      fx.shadowBlur = 4;
      fx.textBaseline = 'top';

      // Top-left: Flashing red recording dot + SP
      const pad = Math.round(w * 0.04);
      if ((t % 900) < 550) {
        fx.fillStyle = '#ef4444';
        fx.beginPath();
        fx.arc(pad + 8, pad + fs * 0.5, 6, 0, Math.PI * 2);
        fx.fill();
        fx.fillStyle = '#ffffff';
        fx.fillText('REC   SP', pad + 24, pad);
      } else {
        fx.fillText('      SP', pad + 24, pad);
      }

      // Top-right: Battery gauge
      fx.textAlign = 'right';
      fx.fillText('[■■■■] BATT', w - pad, pad);

      // Bottom-left: Zoom gauge & AF status
      fx.textAlign = 'left';
      fx.textBaseline = 'bottom';
      fx.fillText(pose.hasFace ? 'AF-LOCK  [ W ----|---- T ]' : 'AF-SEARCH [ W ----|---- T ]', pad, h - pad);

      // Bottom-right: Live 1998 Date & Time stamp with ticking seconds
      const nowD = new Date();
      const s = String(nowD.getSeconds()).padStart(2, '0');
      const m = String(nowD.getMinutes()).padStart(2, '0');
      const hr = String(nowD.getHours() % 12 || 12).padStart(2, '0');
      const ampm = nowD.getHours() >= 12 ? 'PM' : 'AM';
      fx.textAlign = 'right';
      fx.fillStyle = '#ffb300';
      fx.fillText(`OCT 16, 1998  ${hr}:${m}:${s} ${ampm}`, w - pad, h - pad);
      fx.restore();
    }
  };

export default retroCamcorderEffect;
