/* WebcamClicks — sharing helpers (Web Share API, clipboard, download). */

import { dataUrlToFile, downloadDataUrl, timestamp } from './utils.js';

const SHARE_TEXT = 'Made with WebcamClicks 📷 — free webcam filters, face effects & camera games! https://webcamclicks.com';

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Share the photo: native share sheet when possible, otherwise download. */
export async function shareImage(dataUrl) {
  const filename = `webcamclicks-${timestamp()}.jpg`;
  const file = dataUrlToFile(dataUrl, filename);
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: 'My WebcamClicks photo',
        text: SHARE_TEXT
      });
      return 'shared';
    } catch (err) {
      if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return 'cancelled';
    }
  }
  downloadDataUrl(dataUrl, filename);
  return 'downloaded';
}

/** Copy the photo (as PNG) to the clipboard. */
export async function copyImage(dataUrl) {
  try {
    if (!navigator.clipboard || typeof window.ClipboardItem === 'undefined') return false;
    const img = await loadImage(dataUrl);
    const c = document.createElement('canvas');
    c.width = img.width;
    c.height = img.height;
    c.getContext('2d').drawImage(img, 0, 0);
    const png = c.toDataURL('image/png');
    await navigator.clipboard.write([
      new ClipboardItem({ 'image/png': dataUrlToFile(png, 'webcamclicks.png') })
    ]);
    return true;
  } catch {
    return false;
  }
}

/** Share a recorded video blob: native file share when possible, otherwise download. */
export async function shareVideoBlob(blob, filename = `webcamclicks-${timestamp()}.webm`) {
  try {
    const file = new File([blob], filename, { type: blob.type || 'video/webm' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'My WebcamClicks video',
        text: SHARE_TEXT
      });
      return 'shared';
    }
  } catch (err) {
    if (err && (err.name === 'AbortError' || err.name === 'NotAllowedError')) return 'cancelled';
  }
  const url = URL.createObjectURL(blob);
  downloadDataUrl(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'downloaded';
}

/** Open a pre-filled X/Twitter intent (text only — attach manually). */
export function tweetPhoto() {
  const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(SHARE_TEXT)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}
