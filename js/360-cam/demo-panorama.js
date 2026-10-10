/**
 * 360 CAM — Built-in Demo Panorama Generator
 * Synthesizes a high-resolution (2048x1024) 2:1 equirectangular panoramic image
 * depicting an architectural sunset metropolis with continuous 360° wrapping.
 */

export function generateDemoPanorama(width = 2048, height = 1024) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  const horizonY = height * 0.52;

  // 1. Sky Gradient from Zenith (top) to Horizon
  const skyGrad = ctx.createLinearGradient(0, 0, 0, horizonY);
  skyGrad.addColorStop(0.0, '#060a17'); // Dark Space Zenith
  skyGrad.addColorStop(0.35, '#1e1b4b'); // Deep Twilight Indigo
  skyGrad.addColorStop(0.65, '#4c0519'); // Crimson Magenta
  skyGrad.addColorStop(0.88, '#9a3412'); // Burnt Terracotta
  skyGrad.addColorStop(1.0, '#f59e0b'); // Golden Sunset Horizon
  ctx.fillStyle = skyGrad;
  ctx.fillRect(0, 0, width, horizonY);

  // 2. Stars in Upper Atmosphere
  ctx.fillStyle = '#ffffff';
  for (let i = 0; i < 280; i++) {
    const sx = Math.random() * width;
    const sy = Math.random() * (horizonY * 0.5);
    const sr = Math.random() * 1.5;
    ctx.globalAlpha = Math.random() * 0.8 + 0.2;
    ctx.beginPath();
    ctx.arc(sx, sy, sr, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1.0;

  // 3. Ground / Ocean Floor with Water Reflections
  const gndGrad = ctx.createLinearGradient(0, horizonY, 0, height);
  gndGrad.addColorStop(0.0, '#1c1917');
  gndGrad.addColorStop(0.1, '#0f172a');
  gndGrad.addColorStop(0.5, '#090d16');
  gndGrad.addColorStop(1.0, '#020408'); // Dark Nadir Nadir
  ctx.fillStyle = gndGrad;
  ctx.fillRect(0, horizonY, width, height - horizonY);

  // 4. Distant Mountain Ranges (wrapped seamlessly across 0 to width)
  ctx.fillStyle = 'rgba(23, 23, 37, 0.7)';
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  for (let x = 0; x <= width; x += 10) {
    const rad = (x / width) * Math.PI * 2;
    const h = Math.sin(rad * 4) * 45 + Math.cos(rad * 6) * 35 + Math.sin(rad * 10) * 18;
    ctx.lineTo(x, horizonY - 30 - Math.abs(h));
  }
  ctx.lineTo(width, horizonY);
  ctx.closePath();
  ctx.fill();

  // 5. 360 Metropolis Skyline with Neon Lit Windows
  const buildingColors = ['#0f172a', '#1e1b4b', '#18181b', '#030712'];
  const neonPalette = ['#06b6d4', '#ec4899', '#f59e0b', '#10b981', '#a855f7'];

  const numBuildings = 64;
  const bWidth = width / numBuildings;

  for (let i = 0; i < numBuildings; i++) {
    const x = i * bWidth;
    const rad = (x / width) * Math.PI * 2;
    // Varied procedural heights with peaks at N, E, S, W
    const heightMod = Math.abs(Math.sin(rad * 2)) * 140 + Math.abs(Math.cos(rad * 3)) * 80 + 90;
    const bHeight = Math.min(horizonY * 0.75, heightMod);
    const topY = horizonY - bHeight;

    ctx.fillStyle = buildingColors[i % buildingColors.length];
    ctx.fillRect(x + 2, topY, bWidth - 4, bHeight);

    // Spire antenna on some towers
    if (i % 4 === 0) {
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(x + bWidth / 2, topY);
      ctx.lineTo(x + bWidth / 2, topY - 35);
      ctx.stroke();

      // Flashing warning red beacon
      ctx.fillStyle = '#ef4444';
      ctx.beginPath();
      ctx.arc(x + bWidth / 2, topY - 36, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Lit windows
    const winColor = neonPalette[i % neonPalette.length];
    ctx.fillStyle = winColor;
    ctx.globalAlpha = 0.65;
    for (let wy = topY + 12; wy < horizonY - 10; wy += 14) {
      for (let wx = x + 6; wx < x + bWidth - 8; wx += 8) {
        if ((wx + wy + i) % 3 !== 0) {
          ctx.fillRect(wx, wy, 4, 6);
        }
      }
    }
    ctx.globalAlpha = 1.0;
  }

  // 6. Water Horizon Highlights & Reflective Glow
  ctx.strokeStyle = 'rgba(245, 158, 11, 0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, horizonY);
  ctx.lineTo(width, horizonY);
  ctx.stroke();

  // 7. Cardinal Direction Compass Guides
  const cardinals = [
    { label: 'NORTH 360°', x: 0 },
    { label: 'NE 045°', x: width * 0.125 },
    { label: 'EAST 090°', x: width * 0.25 },
    { label: 'SE 135°', x: width * 0.375 },
    { label: 'SOUTH 180°', x: width * 0.5 },
    { label: 'SW 225°', x: width * 0.625 },
    { label: 'WEST 270°', x: width * 0.75 },
    { label: 'NW 315°', x: width * 0.875 },
    { label: 'NORTH 360°', x: width }
  ];

  ctx.font = 'bold 22px monospace';
  ctx.textAlign = 'center';
  cardinals.forEach((c) => {
    // Background pill
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.fillRect(c.x - 75, horizonY + 30, 150, 36);
    ctx.strokeStyle = '#06b6d4';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(c.x - 75, horizonY + 30, 150, 36);

    ctx.fillStyle = '#38bdf8';
    ctx.fillText(c.label, c.x, horizonY + 56);
  });

  // 8. Subtle Radial Grid on Ground Floor
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.15)';
  ctx.lineWidth = 1;
  for (let ring = 1; ring <= 6; ring++) {
    const gy = horizonY + ring * 65;
    ctx.beginPath();
    ctx.moveTo(0, gy);
    ctx.lineTo(width, gy);
    ctx.stroke();
  }

  return canvas;
}
