/* WebcamClicks — Screenshot beautifier: put a screenshot on a gradient with padding, rounded corners,
   a shadow and a window, browser or phone frame. Paste, style, copy or download. Nothing is uploaded. */

import { $, $$, setupDropzone, setStatus, downloadBlob, decodeImage, canvasToBlob, formatBytes, splitName } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), canvas: $('#sb-canvas'), wrap: $('#sb-wrap'),
  bgs: $('#sb-bgs'), c1: $('#sb-c1'), c2: $('#sb-c2'), angle: $('#sb-angle'), frame: $('#sb-frame'), title: $('#sb-title'), titleRow: $('#sb-title-row'),
  pad: $('#sb-pad'), radius: $('#sb-radius'), shadow: $('#sb-shadow'), size: $('#sb-size'), scale: $('#sb-scale'), tilt: $('#sb-tilt'),
  mark: $('#sb-mark'), markPos: $('#sb-markpos'), fmt: $('#sb-fmt'), save: $('#sb-save'), copy: $('#sb-copy'), info: $('#sb-info')
};
const BGS = {
  sunset: ['#ff7e5f', '#feb47b'], ocean: ['#2193b0', '#6dd5ed'], grape: ['#7f53ac', '#647dee'], candy: ['#f857a6', '#ff5858'], mint: ['#43e97b', '#38f9d7'],
  peach: ['#ffecd2', '#fcb69f'], night: ['#0f2027', '#2c5364'], aurora: ['#00c6ff', '#7b2ff7'], lemon: ['#f6d365', '#fda085'], slate: ['#bdc3c7', '#2c3e50'],
  rose: ['#ee9ca7', '#ffdde1'], forest: ['#134e5e', '#71b280'], white: ['#ffffff', '#ffffff'], black: ['#0b0b0f', '#1c1c22'], blur: null, transparent: null
};
const SIZES = { auto: null, '16:9': [1920, 1080], '1:1': [1600, 1600], '4:5': [1080, 1350], '9:16': [1080, 1920], twitter: [1600, 900], linkedin: [1200, 627] };
let img = null, name = 'screenshot', bg = 'aurora';

els.bgs.innerHTML = Object.entries(BGS).map(([k, c]) => `<button type="button" class="sb-bg" data-bg="${k}" aria-label="${k}" title="${k}" style="background:${c ? `linear-gradient(135deg,${c[0]},${c[1]})` : k === 'blur' ? 'radial-gradient(circle at 30% 30%,#9ad,#567)' : 'repeating-conic-gradient(#ccc 0 25%,#fff 0 50%) 0 0/12px 12px'}" aria-pressed="${k === bg}">${k === 'blur' ? '<span>Blur</span>' : ''}</button>`).join('');
els.bgs.addEventListener('click', (e) => {
  const b = e.target.closest('[data-bg]'); if (!b) return;
  bg = b.dataset.bg; if (BGS[bg]) { els.c1.value = BGS[bg][0]; els.c2.value = BGS[bg][1]; }
  $$('[data-bg]', els.bgs).forEach((x) => x.setAttribute('aria-pressed', String(x === b))); draw();
});
[els.c1, els.c2].forEach((x) => x.addEventListener('input', () => { bg = 'custom'; $$('[data-bg]', els.bgs).forEach((y) => y.setAttribute('aria-pressed', 'false')); draw(); }));
[els.angle, els.frame, els.title, els.pad, els.radius, els.shadow, els.size, els.scale, els.tilt, els.mark, els.markPos].forEach((x) => x.addEventListener('input', draw));
els.frame.addEventListener('change', () => { els.titleRow.hidden = !/mac|browser|dark/.test(els.frame.value); });

async function load(files) {
  const f = files.find((x) => x.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(x.name));
  if (!f) { setStatus(els.status, 'Please add an image (or paste a screenshot with Ctrl+V).', 'err'); return; }
  try { img = await decodeImage(f); } catch (_) { setStatus(els.status, 'That image could not be opened.', 'err'); return; }
  name = splitName(f.name || 'screenshot')[0] || 'screenshot';
  els.wrap.hidden = false; els.drop.classList.add('compact');
  els.save.disabled = els.copy.disabled = false;
  draw();
  setStatus(els.status, 'Pick a background and frame. Paste another screenshot any time with Ctrl+V.', 'ok');
}
setupDropzone(els.drop, els.input, load);

/* ---------------------------------------------------------------- drawing */
function rr(g, x, y, w, h, r) { r = Math.max(0, Math.min(r, w / 2, h / 2)); g.beginPath(); g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r); g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath(); }
const FRAME_BAR = { none: 0, mac: 0.045, dark: 0.045, browser: 0.075, phone: 0 };

/** Render at a given scale (1 = full size export). Returns the canvas. */
function render(c, quality = 1) {
  if (!img) return null;
  const iw = img.width, ih = img.height, frame = els.frame.value;
  const base = Math.max(iw, ih), u = base / 1000;   // 1 "unit" scales with the screenshot
  const barH = Math.round(FRAME_BAR[frame] * Math.min(iw, 1600 * u) * (iw > ih ? 1 : 1.2));
  const bez = frame === 'phone' ? Math.round(Math.min(iw, ih) * 0.045) : 0;
  const winW = iw + bez * 2, winH = ih + barH + bez * 2;
  const pad = (+els.pad.value / 100) * Math.max(winW, winH);
  const fixed = SIZES[els.size.value];
  let W, H, k;
  if (fixed) {
    [W, H] = fixed;
    const p = Math.min(0.4, +els.pad.value / 100);
    k = Math.min((W * (1 - 2 * p)) / winW, (H * (1 - 2 * p)) / winH) * (+els.scale.value / 100);
  } else { W = Math.round(winW + pad * 2); H = Math.round(winH + pad * 2); k = +els.scale.value / 100; }
  const W0 = W, H0 = H;
  W = Math.max(1, Math.round(W * quality)); H = Math.max(1, Math.round(H * quality)); k *= quality;
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  g.clearRect(0, 0, W, H);
  // background
  if (bg === 'blur') {
    g.save(); g.filter = `blur(${Math.round(Math.max(W, H) / 30)}px) saturate(1.3) brightness(.9)`;
    const s = Math.max(W / iw, H / ih) * 1.15; g.drawImage(img, (W - iw * s) / 2, (H - ih * s) / 2, iw * s, ih * s); g.restore();
  } else if (bg !== 'transparent') {
    const a = (+els.angle.value * Math.PI) / 180, cx = W / 2, cy = H / 2, L = Math.abs(W * Math.cos(a)) / 2 + Math.abs(H * Math.sin(a)) / 2;
    const grad = g.createLinearGradient(cx - Math.cos(a) * L, cy - Math.sin(a) * L, cx + Math.cos(a) * L, cy + Math.sin(a) * L);
    grad.addColorStop(0, els.c1.value); grad.addColorStop(1, els.c2.value); g.fillStyle = grad; g.fillRect(0, 0, W, H);
  }
  // window
  const ww = winW * k, wh = winH * k, x = (W - ww) / 2, y = (H - wh) / 2;
  const rad = frame === 'phone' ? Math.min(ww, wh) * 0.09 : (+els.radius.value) * u * k * 1.2;
  g.save();
  const tilt = +els.tilt.value;
  if (tilt) { g.translate(W / 2, H / 2); g.transform(1, Math.tan(tilt * Math.PI / 180) * 0.25, Math.tan(-tilt * Math.PI / 180) * 0.15, 1, 0, 0); g.rotate(-tilt * Math.PI / 360); g.translate(-W / 2, -H / 2); }
  const sh = { none: null, soft: [0.22, 0.05, 0.03], strong: [0.45, 0.06, 0.04], hard: [0.55, 0, 0.02], glow: [0.6, 0.06, 0] }[els.shadow.value];
  if (sh) {
    g.save(); rr(g, x, y, ww, wh, rad);
    g.shadowColor = els.shadow.value === 'glow' ? `${els.c2.value}cc` : `rgba(0,0,0,${sh[0]})`; g.shadowBlur = Math.max(ww, wh) * sh[1]; g.shadowOffsetY = Math.max(ww, wh) * sh[2]; g.shadowOffsetX = els.shadow.value === 'hard' ? Math.max(ww, wh) * 0.015 : 0;
    g.fillStyle = '#fff'; g.fill(); g.restore();
  }
  g.save(); rr(g, x, y, ww, wh, rad); g.clip();
  const dark = frame === 'dark';
  if (frame === 'phone') { g.fillStyle = '#111'; g.fillRect(x, y, ww, wh); }
  if (barH) {
    const bh = barH * k;
    g.fillStyle = dark ? '#26262b' : frame === 'browser' ? '#eceef1' : '#f3f3f5'; g.fillRect(x, y, ww, bh);
    const r = bh * (frame === 'browser' ? 0.13 : 0.2), cy = y + (frame === 'browser' ? bh * 0.5 : bh / 2);
    ['#ff5f57', '#febc2e', '#28c840'].forEach((col, i) => { g.fillStyle = col; g.beginPath(); g.arc(x + bh * 0.55 + i * r * 3.3, cy, r, 0, Math.PI * 2); g.fill(); });
    const t = els.title.value.trim();
    if (frame === 'browser') {
      const bx = x + bh * 0.55 + r * 10, bw = Math.min(ww - (bx - x) - bh * 0.5, ww * 0.6), by = y + bh * 0.22, bhh = bh * 0.56;
      g.fillStyle = '#fff'; rr(g, bx, by, bw, bhh, bhh / 2); g.fill();
      g.fillStyle = '#5f6368'; g.font = `500 ${Math.round(bhh * 0.48)}px Inter, system-ui, sans-serif`; g.textBaseline = 'middle';
      g.fillText(`🔒 ${t || 'webcamclicks.com'}`, bx + bhh * 0.5, by + bhh / 2, bw - bhh);
    } else if (t) {
      g.fillStyle = dark ? '#c8c8cf' : '#55575c'; g.font = `600 ${Math.round(bh * 0.36)}px Inter, system-ui, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(t, x + ww / 2, y + bh / 2, ww * 0.6); g.textAlign = 'left';
    }
  }
  const ix = x + bez * k, iy = y + (barH + bez) * k, iW = iw * k, iH = ih * k;
  if (frame === 'phone') { g.save(); rr(g, ix, iy, iW, iH, rad * 0.8); g.clip(); g.drawImage(img, ix, iy, iW, iH); g.restore(); }
  else g.drawImage(img, ix, iy, iW, iH);
  g.restore();
  if (frame === 'phone') { g.lineWidth = Math.max(2, ww * 0.006); g.strokeStyle = '#3a3a3f'; rr(g, x, y, ww, wh, rad); g.stroke(); }
  else if (frame !== 'none') { g.lineWidth = Math.max(1, ww * 0.0012); g.strokeStyle = dark ? 'rgba(255,255,255,.12)' : 'rgba(0,0,0,.08)'; rr(g, x, y, ww, wh, rad); g.stroke(); }
  g.restore();
  // watermark / handle
  const mark = els.mark.value.trim();
  if (mark) {
    const fs = Math.max(1, Math.round(Math.max(W, H) * 0.022)), m = fs * 1.2, pos = els.markPos.value;
    g.font = `700 ${fs}px Inter, system-ui, sans-serif`; g.textBaseline = 'bottom';
    const light = bg === 'transparent' ? false : luminance(els.c1.value) * 0.5 + luminance(els.c2.value) * 0.5 > 0.6;
    g.fillStyle = light ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.85)';
    g.textAlign = pos === 'center' ? 'center' : pos === 'right' ? 'right' : 'left';
    g.fillText(mark, pos === 'center' ? W / 2 : pos === 'right' ? W - m : m, H - m * 0.7);
  }
  return { W: W0, H: H0 };
}
function luminance(hex) { const n = parseInt(hex.slice(1), 16); return (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255; }

let raf = 0;
function draw() {
  cancelAnimationFrame(raf);
  raf = requestAnimationFrame(() => {
    if (!img) return;
    // preview at a lighter resolution, export at full
    const full = measure(); const q = Math.min(1, 1400 / Math.max(full.W, full.H));
    render(els.canvas, q);
    els.info.textContent = `${full.W} × ${full.H} px`;
    els.fmt.querySelector('option[value="image/jpeg"]').disabled = bg === 'transparent';
    if (bg === 'transparent' && els.fmt.value === 'image/jpeg') els.fmt.value = 'image/png';
  });
}
function measure() { return render(document.createElement('canvas'), 0.02) || { W: 0, H: 0 }; }
async function exportBlob() {
  const c = document.createElement('canvas'); render(c, 1);
  return canvasToBlob(c, els.fmt.value, 0.93);
}
els.save.addEventListener('click', async () => {
  const blob = await exportBlob();
  downloadBlob(blob, `${name}-beautified.${els.fmt.value === 'image/png' ? 'png' : els.fmt.value === 'image/webp' ? 'webp' : 'jpg'}`);
  setStatus(els.status, `Saved (${formatBytes(blob.size)}).`, 'ok');
});
els.copy.addEventListener('click', async () => {
  try {
    const c = document.createElement('canvas'); render(c, 1);
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': canvasToBlob(c, 'image/png') })]);
    setStatus(els.status, 'Copied! Paste it into Slack, X, docs or an email.', 'ok');
  } catch (_) { setStatus(els.status, 'Your browser blocked copying images; use Download instead.', 'err'); }
});
window.__sbTest = { load, measure };
