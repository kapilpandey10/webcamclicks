/* WebcamClicks — facemesh face effect */

import { clamp, lerp, rand, pick, makeCanvas, roundRect } from '../../utils.js';
import { LM, cent } from '../../face/face-detection.js';
import { scratch, geo, smoothGeo, passthrough } from './face-helpers.js';

export const facemeshEffect = {
    id: 'facemesh', name: 'Face Mesh', icon: '🕸️', category: 'Face', perf: 'low', requiresFace: true,
    render(fx, frame) {
      passthrough(fx, frame);
      const g = geo(frame);
      if (!g) return;

      const pts = g.pts;
      const eyeDist = g.eyeDist;
      const now = frame.now || performance.now();

      // Synthesize virtual forehead and temple vertices to form a complete 3D skull cap
      const fApex = {
        x: (pts[19].x + pts[24].x) / 2 + (pts[27].x - pts[30].x) * 0.4,
        y: Math.min(pts[19].y, pts[24].y) - eyeDist * 0.76
      };
      const allPts = [
        ...pts,
        { x: pts[0].x, y: pts[17].y - eyeDist * 0.45 },   // 68: Left temple
        { x: pts[17].x, y: pts[17].y - eyeDist * 0.60 },  // 69: Left outer-brow top
        { x: pts[19].x, y: pts[19].y - eyeDist * 0.70 },  // 70: Left inner-brow top
        fApex,                                            // 71: Forehead apex
        { x: pts[24].x, y: pts[24].y - eyeDist * 0.70 },  // 72: Right inner-brow top
        { x: pts[26].x, y: pts[26].y - eyeDist * 0.60 },  // 73: Right outer-brow top
        { x: pts[16].x, y: pts[26].y - eyeDist * 0.45 }   // 74: Right temple
      ];

      // Triangulation facets covering all facial regions
      const TRIANGLES = [
        // Forehead & Temples
        [68, 69, 17], [69, 18, 17], [69, 70, 19], [69, 19, 18], [70, 71, 19], [71, 20, 19], [71, 21, 20],
        [71, 27, 21], [71, 22, 27], [71, 23, 22], [71, 24, 23], [71, 72, 24], [72, 73, 24], [73, 25, 24],
        [73, 26, 25], [73, 74, 26], [74, 16, 26], [68, 17, 0],
        // Brows to Eyes & Nose Bridge
        [17, 18, 36], [18, 37, 36], [18, 19, 37], [19, 38, 37], [19, 20, 38], [20, 39, 38], [20, 21, 39], [21, 27, 39],
        [22, 23, 42], [23, 43, 42], [23, 24, 43], [24, 44, 43], [24, 25, 44], [25, 45, 44], [25, 26, 45], [26, 16, 45], [22, 27, 42],
        // Eyes
        [36, 37, 41], [37, 38, 40], [38, 39, 40], [37, 40, 41],
        [42, 43, 47], [43, 44, 46], [44, 45, 46], [43, 46, 47],
        // Nose Bridge & Cheeks
        [27, 28, 39], [27, 42, 28], [28, 29, 39], [28, 42, 29], [29, 31, 39], [29, 35, 42], [29, 30, 31], [29, 35, 30],
        [36, 41, 0], [41, 1, 0], [41, 2, 31], [1, 2, 41], [39, 40, 31], [40, 41, 31],
        [42, 47, 35], [45, 46, 16], [46, 15, 16], [46, 14, 35], [14, 15, 46], [46, 47, 35],
        // Cheeks to Jaw
        [2, 3, 31], [3, 4, 48], [4, 5, 48], [3, 48, 31],
        [14, 35, 13], [13, 35, 54], [13, 54, 12], [12, 54, 11],
        // Nose Bottom & Philtrum
        [31, 32, 30], [32, 33, 30], [33, 34, 30], [34, 35, 30],
        [31, 48, 49], [31, 32, 49], [32, 50, 49], [32, 33, 50], [33, 51, 50], [33, 52, 51], [33, 34, 52],
        [34, 53, 52], [34, 35, 53], [35, 54, 53],
        // Lips
        [48, 49, 60], [49, 50, 61], [49, 60, 61], [50, 51, 62], [50, 61, 62], [51, 52, 62], [52, 63, 62], [52, 53, 64], [52, 64, 63], [53, 54, 64],
        [48, 59, 60], [59, 58, 67], [59, 67, 60], [58, 57, 66], [58, 66, 67], [57, 56, 65], [57, 65, 66], [56, 55, 65], [55, 54, 64], [55, 64, 65],
        // Lower Lip to Chin
        [48, 5, 59], [59, 5, 6], [59, 6, 58], [58, 6, 7], [58, 7, 57], [57, 7, 8],
        [57, 8, 9], [57, 9, 56], [56, 9, 10], [56, 10, 55], [55, 10, 11], [55, 11, 54]
      ];

      fx.save();

      // 1. Shaded Holographic Facet Fills
      for (let i = 0; i < TRIANGLES.length; i++) {
        const [ia, ib, ic] = TRIANGLES[i];
        const pa = allPts[ia], pb = allPts[ib], pc = allPts[ic];
        const cx = (pa.x + pb.x + pc.x) / 3;
        const cy = (pa.y + pb.y + pc.y) / 3;
        const wave = Math.sin((cx + cy) * 0.018 - now * 0.0032);
        fx.fillStyle = wave > 0.35
          ? 'rgba(0, 245, 255, 0.07)'
          : (wave < -0.35 ? 'rgba(168, 85, 247, 0.055)' : 'rgba(0, 245, 255, 0.022)');
        fx.beginPath();
        fx.moveTo(pa.x, pa.y);
        fx.lineTo(pb.x, pb.y);
        fx.lineTo(pc.x, pc.y);
        fx.closePath();
        fx.fill();
      }

      // 2. Wireframe Mesh Lines
      fx.lineWidth = 1.1;
      fx.strokeStyle = 'rgba(0, 245, 255, 0.40)';
      fx.beginPath();
      for (let i = 0; i < TRIANGLES.length; i++) {
        const [ia, ib, ic] = TRIANGLES[i];
        const pa = allPts[ia], pb = allPts[ib], pc = allPts[ic];
        fx.moveTo(pa.x, pa.y);
        fx.lineTo(pb.x, pb.y);
        fx.lineTo(pc.x, pc.y);
        fx.lineTo(pa.x, pa.y);
      }
      fx.stroke();

      // 3. Highlighted Primary Contours (Jawline, Eyebrows, Lips)
      const contours = [
        Array.from({ length: 17 }, (_, i) => i),
        [17, 18, 19, 20, 21],
        [22, 23, 24, 25, 26],
        [27, 28, 29, 30],
        [36, 37, 38, 39, 40, 41, 36],
        [42, 43, 44, 45, 46, 47, 42],
        [48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 48]
      ];
      fx.lineWidth = 1.8;
      fx.strokeStyle = 'rgba(0, 255, 240, 0.85)';
      for (const chain of contours) {
        fx.beginPath();
        chain.forEach((idx, i) => {
          const p = pts[idx];
          if (i === 0) fx.moveTo(p.x, p.y);
          else fx.lineTo(p.x, p.y);
        });
        fx.stroke();
      }

      // 4. Sweeping Laser Beam
      const box = g.box;
      const scanPeriod = (Math.sin(now * 0.0024) * 0.5 + 0.5);
      const scanY = box.y + scanPeriod * box.height;
      const laserGrad = fx.createLinearGradient(box.x - 20, scanY, box.x + box.width + 20, scanY);
      laserGrad.addColorStop(0, 'rgba(0, 245, 255, 0)');
      laserGrad.addColorStop(0.2, 'rgba(0, 245, 255, 0.4)');
      laserGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.95)');
      laserGrad.addColorStop(0.8, 'rgba(0, 245, 255, 0.4)');
      laserGrad.addColorStop(1, 'rgba(0, 245, 255, 0)');
      fx.strokeStyle = laserGrad;
      fx.lineWidth = 2.2;
      fx.beginPath();
      fx.moveTo(box.x - 24, scanY);
      fx.lineTo(box.x + box.width + 24, scanY);
      fx.stroke();

      // Soft glow band around laser
      fx.fillStyle = 'rgba(0, 245, 255, 0.07)';
      fx.fillRect(box.x - 24, scanY - 8, box.width + 48, 16);

      // 5. Mesh Nodes with Laser Proximity Glow
      for (let i = 0; i < allPts.length; i++) {
        const p = allPts[i];
        const distToLaser = Math.abs(p.y - scanY);
        const nearLaser = distToLaser < 24;

        fx.beginPath();
        if (nearLaser) {
          const intensity = 1 - distToLaser / 24;
          fx.fillStyle = `rgba(255, 255, 255, ${0.9 + intensity * 0.1})`;
          fx.arc(p.x, p.y, 2.5 + intensity * 1.5, 0, Math.PI * 2);
          fx.fill();
          // Halo
          fx.fillStyle = `rgba(0, 245, 255, ${intensity * 0.5})`;
          fx.beginPath();
          fx.arc(p.x, p.y, 5 + intensity * 4, 0, Math.PI * 2);
          fx.fill();
        } else {
          fx.fillStyle = 'rgba(0, 245, 255, 0.75)';
          fx.arc(p.x, p.y, 1.6, 0, Math.PI * 2);
          fx.fill();
        }
      }

      // 6. Cyber Target Reticles on Key Landmarks (Pupils, Nose tip, Chin)
      const reticleTargets = [g.lEye, g.rEye, g.nose, g.chin];
      const reticleRot = now * 0.002;
      for (const t of reticleTargets) {
        fx.save();
        fx.translate(t.x, t.y);
        fx.rotate(reticleRot);
        fx.strokeStyle = 'rgba(0, 255, 230, 0.85)';
        fx.lineWidth = 1.2;
        fx.beginPath();
        fx.arc(0, 0, 5.5, 0, Math.PI * 2);
        fx.stroke();
        // Crosshair ticks
        fx.beginPath();
        fx.moveTo(-8, 0); fx.lineTo(-5.5, 0);
        fx.moveTo(5.5, 0); fx.lineTo(8, 0);
        fx.moveTo(0, -8); fx.lineTo(0, -5.5);
        fx.moveTo(0, 5.5); fx.lineTo(0, 8);
        fx.stroke();
        fx.restore();
      }

      // 7. Corner HUD Brackets
      const bx = box.x, by = box.y, bw = box.width, bh = box.height;
      const arm = Math.min(22, bw * 0.14);
      fx.strokeStyle = 'rgba(0, 245, 255, 0.85)';
      fx.lineWidth = 2.2;
      // Top-Left
      fx.beginPath(); fx.moveTo(bx, by + arm); fx.lineTo(bx, by); fx.lineTo(bx + arm, by); fx.stroke();
      // Top-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by); fx.lineTo(bx + bw, by); fx.lineTo(bx + bw, by + arm); fx.stroke();
      // Bottom-Left
      fx.beginPath(); fx.moveTo(bx, by + bh - arm); fx.lineTo(bx, by + bh); fx.lineTo(bx + arm, by + bh); fx.stroke();
      // Bottom-Right
      fx.beginPath(); fx.moveTo(bx + bw - arm, by + bh); fx.lineTo(bx + bw, by + bh); fx.lineTo(bx + bw, by + bh - arm); fx.stroke();

      // 8. Cyberpunk Telemetry HUD Badge
      const hudY = Math.max(22, by - 12);
      fx.font = '700 11px ui-monospace, Menlo, Monaco, monospace';
      fx.fillStyle = '#00f5ff';
      fx.fillText('BIO-TOPOLOGY 3D // 68 PTS', bx, hudY);
      fx.font = '600 10px ui-monospace, Menlo, Monaco, monospace';
      fx.fillStyle = 'rgba(255, 255, 255, 0.85)';
      fx.fillText(`YAW: ${(g.yaw * 45).toFixed(1)}°  DEPTH: ${Math.round(g.headW * 0.9)}mm  TRACK: 99.8%`, bx, hudY + 14);

      fx.restore();
    }
  };

export default facemeshEffect;
