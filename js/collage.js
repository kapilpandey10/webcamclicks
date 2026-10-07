/* WebcamClicks — Photo Booth Collage Generator
   Assembles 2, 3, 4, 5 or 6 multi-shot poses into high-resolution photo strips or studio grids. */

import { makeCanvas, timestamp } from './utils.js';

export const COLLAGE_THEMES = {
  white: {
    id: 'white',
    name: 'Classic White',
    bg: '#ffffff',
    photoBg: '#f8fafc',
    text: '#1e293b',
    subtext: '#64748b',
    border: '#e2e8f0',
    accent: '#ec4899'
  },
  vintage: {
    id: 'vintage',
    name: 'Vintage Film',
    bg: '#f6f1e7',
    photoBg: '#ebdcc9',
    text: '#3b2f2f',
    subtext: '#7d6b5c',
    border: '#dccab3',
    accent: '#d97706'
  },
  pink: {
    id: 'pink',
    name: 'Blush Rose',
    bg: '#fdf2f8',
    photoBg: '#fce7f3',
    text: '#831843',
    subtext: '#be185d',
    border: '#fbcfe8',
    accent: '#db2777'
  },
  noir: {
    id: 'noir',
    name: 'Studio Noir',
    bg: '#0f172a',
    photoBg: '#1e293b',
    text: '#f8fafc',
    subtext: '#94a3b8',
    border: '#334155',
    accent: '#f43f5e'
  },
  vintageshoot: {
    id: 'vintageshoot',
    name: '🎞️ Vintage Shoot',
    bg: '#25201b',
    photoBg: '#1c1714',
    text: '#fef3c7',
    subtext: '#d97706',
    border: '#45372b',
    accent: '#f59e0b'
  },
  polaroid: {
    id: 'polaroid',
    name: '📸 Polaroid 1977',
    bg: '#fcfbf7',
    photoBg: '#f5f3ec',
    text: '#1c1917',
    subtext: '#78716c',
    border: '#e7e5e4',
    accent: '#ef4444'
  }
};

/** Helper to draw a rounded rectangle */
function roundRect(ctx, x, y, w, h, r = 10) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

/** Draws image fitted with "cover" inside a rounded rectangle */
function drawCoverRounded(ctx, img, x, y, w, h, r = 8) {
  ctx.save();
  roundRect(ctx, x, y, w, h, r);
  ctx.clip();

  const iw = img.width || img.videoWidth || 1;
  const ih = img.height || img.videoHeight || 1;
  const targetAspect = w / h;
  const imgAspect = iw / ih;

  let sx = 0, sy = 0, sw = iw, sh = ih;
  if (imgAspect > targetAspect) {
    sw = ih * targetAspect;
    sx = (iw - sw) / 2;
  } else {
    sh = iw / targetAspect;
    sy = (ih - sh) / 2;
  }

  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
  ctx.restore();
}

/**
 * Assembles an array of captured pose canvases/images into a high-res composite collage.
 * @param {Array<CanvasImageSource>} poses - Array of 2 to 6 images/canvases.
 * @param {Object} opts - Theme and metadata options.
 * @returns {Object} { canvas, dataUrl, width, height, theme }
 */
export function generateCollage(poses, opts = {}) {
  const count = poses.length;
  const themeKey = opts.theme || 'white';
  const theme = COLLAGE_THEMES[themeKey] || COLLAGE_THEMES.white;
  const brandName = opts.title || 'WEBCAMCLICKS PHOTO BOOTH';

  const d = new Date();
  const dateFormatted = d.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).toUpperCase();

  let cw = 1200;
  let ch = 1600;
  let layout = 'grid'; // 'strip' | 'grid' | 'duo'

  if (count === 2) {
    layout = 'duo';
    cw = 1200;
    ch = 950;
  } else if (count === 3) {
    layout = 'strip';
    cw = 650;
    ch = 1850;
  } else if (count === 4) {
    layout = 'grid';
    cw = 1200;
    ch = 1450;
  } else if (count === 5 || count === 6) {
    layout = 'grid';
    cw = 1200;
    ch = 1850;
  }

  const canvas = makeCanvas(cw, ch);
  const ctx = canvas.getContext('2d');

  // 1. Draw Background
  ctx.fillStyle = theme.bg;
  ctx.fillRect(0, 0, cw, ch);

  // Subtle outer border
  ctx.lineWidth = 3;
  ctx.strokeStyle = theme.border;
  ctx.strokeRect(10, 10, cw - 20, ch - 20);

  const margin = 32;
  const gap = 20;
  const headerHeight = layout === 'strip' ? 50 : 60;
  const footerHeight = layout === 'strip' ? 120 : 100;

  // 2. Position and render photo frames
  if (layout === 'strip') {
    // Vertical Strip of 3 photos
    const photoW = cw - margin * 2;
    const availH = ch - headerHeight - footerHeight - margin;
    const photoH = (availH - gap * (count - 1)) / count;

    for (let i = 0; i < count; i++) {
      const px = margin;
      const py = margin + headerHeight + i * (photoH + gap);

      // Photo backdrop / shadow
      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = theme.photoBg;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.fill();
      ctx.restore();

      // Draw photo
      drawCoverRounded(ctx, poses[i], px, py, photoW, photoH, 12);

      // Border around photo
      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.stroke();

      // Pose index badge
      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      roundRect(ctx, px + 12, py + 12, 34, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, px + 29, py + 25);
      ctx.restore();
    }
  } else if (layout === 'duo') {
    // 2 Photos Side by Side
    const photoW = (cw - margin * 2 - gap) / 2;
    const photoH = ch - headerHeight - footerHeight;

    for (let i = 0; i < 2; i++) {
      const px = margin + i * (photoW + gap);
      const py = margin + headerHeight;

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = theme.photoBg;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.fill();
      ctx.restore();

      drawCoverRounded(ctx, poses[i], px, py, photoW, photoH, 12);

      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      roundRect(ctx, px + 14, py + 14, 34, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, px + 31, py + 27);
      ctx.restore();
    }
  } else {
    // Grid: 2 Columns, 2 or 3 Rows
    const cols = 2;
    const rows = count <= 4 ? 2 : 3;
    const photoW = (cw - margin * 2 - gap) / cols;
    const availH = ch - headerHeight - footerHeight;
    const photoH = (availH - gap * (rows - 1)) / rows;

    for (let i = 0; i < count; i++) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const px = margin + col * (photoW + gap);
      const py = margin + headerHeight + row * (photoH + gap);

      ctx.save();
      ctx.shadowColor = 'rgba(0, 0, 0, 0.12)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 6;
      ctx.fillStyle = theme.photoBg;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.fill();
      ctx.restore();

      drawCoverRounded(ctx, poses[i], px, py, photoW, photoH, 12);

      ctx.lineWidth = 2;
      ctx.strokeStyle = theme.border;
      roundRect(ctx, px, py, photoW, photoH, 12);
      ctx.stroke();

      ctx.save();
      ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
      roundRect(ctx, px + 14, py + 14, 34, 26, 6);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 14px "Outfit", sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`#${i + 1}`, px + 31, py + 27);
      ctx.restore();
    }
  }

  // 3. Header Stamp
  ctx.save();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = theme.accent;
  ctx.font = '800 13px "Outfit", sans-serif';
  ctx.letterSpacing = '3px';
  ctx.fillText('✨ SPECIAL MOMENTS ✨', cw / 2, margin + headerHeight / 2 - 4);
  ctx.restore();

  // 4. Footer Branding & Date
  const footY = ch - footerHeight / 2 - 4;
  ctx.save();
  ctx.textAlign = 'center';

  // Brand Name
  ctx.font = '800 21px "Outfit", sans-serif';
  ctx.fillStyle = theme.text;
  ctx.letterSpacing = '2px';
  ctx.fillText(brandName, cw / 2, footY - 14);

  // Subtext / Date
  ctx.font = '600 13px "Outfit", sans-serif';
  ctx.fillStyle = theme.subtext;
  ctx.letterSpacing = '1px';
  ctx.fillText(`${dateFormatted} · 100% PRIVATE ON-DEVICE`, cw / 2, footY + 14);
  ctx.restore();

  const dataUrl = canvas.toDataURL('image/jpeg', 0.94);
  return { canvas, dataUrl, width: cw, height: ch, theme: themeKey };
}
