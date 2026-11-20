/* WebcamClicks — Background picker UI for the camera studio.
   Injects a "Background" button into the camera toolbars and a swatch tray over the
   stage, so it works on every page that hosts the studio (English + translations). */

import { BACKDROPS } from './background.js';

const PREF_KEY = 'wc_background_v1';

const CSS = `
.wc-bg-tray{position:absolute;left:12px;right:12px;bottom:12px;z-index:40;display:none;flex-direction:column;gap:8px;
  padding:12px;border-radius:16px;background:rgba(255,255,255,.96);box-shadow:0 12px 40px rgba(14,14,18,.22);
  border:1px solid rgba(14,14,18,.08);font-family:inherit;color:#0e0e12}
.wc-bg-tray.open{display:flex}
.wc-bg-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.wc-bg-head strong{font-size:.95rem;font-weight:800}
.wc-bg-status{font-size:.8rem;color:#5b5f6b;flex:1;text-align:right;margin-right:6px}
.wc-bg-status.err{color:#d92d20}
.wc-bg-close{border:0;background:#f1f2f4;border-radius:999px;width:30px;height:30px;font-size:15px;cursor:pointer;color:#0e0e12}
.wc-bg-list{display:flex;gap:10px;overflow-x:auto;padding:2px 2px 4px;scrollbar-width:thin}
.wc-bg-item{flex:0 0 auto;display:flex;flex-direction:column;align-items:center;gap:5px;background:none;border:0;padding:0;cursor:pointer;
  font:600 .74rem/1.1 inherit;color:#5b5f6b;width:66px}
.wc-bg-sw{width:58px;height:58px;border-radius:14px;border:2px solid rgba(14,14,18,.1);box-shadow:inset 0 0 0 2px #fff;transition:transform .12s}
.wc-bg-item:hover .wc-bg-sw{transform:translateY(-1px)}
.wc-bg-item[aria-pressed="true"]{color:#0e0e12}
.wc-bg-item[aria-pressed="true"] .wc-bg-sw{border-color:#ff4d2e;box-shadow:inset 0 0 0 2px #fff,0 0 0 3px rgba(255,77,46,.25)}
.wc-bg-item:focus-visible{outline:none}
.wc-bg-item:focus-visible .wc-bg-sw{outline:3px solid #ff4d2e;outline-offset:2px}
.wc-bg-note{font-size:.74rem;color:#5b5f6b;margin:0}
.wc-bg-btn-active{background:#ff4d2e !important;color:#fff !important}
`;

export function initBackgroundUI(replacer, { onChange } = {}) {
  const stage = document.getElementById('camera-stage');
  if (!stage) return null;

  const style = document.createElement('style');
  style.textContent = CSS;
  document.head.appendChild(style);

  /* ----- tray ----- */
  const tray = document.createElement('div');
  tray.className = 'wc-bg-tray';
  tray.id = 'wc-bg-tray';
  tray.setAttribute('role', 'dialog');
  tray.setAttribute('aria-label', 'Background');
  tray.innerHTML = `
    <div class="wc-bg-head">
      <strong>Background</strong>
      <span class="wc-bg-status" id="wc-bg-status" aria-live="polite"></span>
      <button class="wc-bg-close" type="button" aria-label="Close background picker">✕</button>
    </div>
    <div class="wc-bg-list" role="group" aria-label="Choose a background"></div>
    <p class="wc-bg-note">AI background runs on your device. Your video never leaves your browser.</p>
    <input type="color" id="wc-bg-color" value="${replacer.color}" hidden>
    <input type="file" id="wc-bg-file" accept="image/*" hidden>`;
  stage.appendChild(tray);

  const list = tray.querySelector('.wc-bg-list');
  const status = tray.querySelector('#wc-bg-status');
  const colorInput = tray.querySelector('#wc-bg-color');
  const fileInput = tray.querySelector('#wc-bg-file');

  BACKDROPS.forEach((b) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'wc-bg-item';
    btn.dataset.id = b.id;
    btn.setAttribute('aria-pressed', 'false');
    btn.innerHTML = `<span class="wc-bg-sw" style="background:${b.swatch}"></span><span>${b.name}</span>`;
    list.appendChild(btn);
  });

  /* ----- toolbar buttons (HUD + desktop console) ----- */
  const toggles = [];
  const hud = document.getElementById('camera-hud-top');
  if (hud) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'hud-btn';
    b.id = 'hud-btn-bg';
    b.title = 'Background (B)';
    b.setAttribute('aria-label', 'Background');
    b.textContent = '🧍';
    const ref = document.getElementById('hud-btn-flip');
    hud.insertBefore(b, ref ? ref.nextSibling : null);
    toggles.push(b);
  }
  const consoleLeft = document.querySelector('.console-sub-group.left');
  if (consoleLeft) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'tool-sub';
    b.id = 'btn-background';
    b.title = 'Replace or blur your background (B)';
    b.innerHTML = '🧍 <span class="sub-label">Background</span> <span class="kbd">B</span>';
    consoleLeft.appendChild(b);
    toggles.push(b);
  }

  /* ----- behaviour ----- */
  function setStatusText(s) {
    status.classList.toggle('err', s === 'error');
    status.textContent = s === 'loading' ? 'Loading AI model…'
      : s === 'error' ? 'Could not load the AI model. Check your connection.'
      : '';
  }
  replacer.onStatus = (s) => { setStatusText(s); refresh(); };

  function refresh() {
    list.querySelectorAll('.wc-bg-item').forEach((el) => {
      el.setAttribute('aria-pressed', String(el.dataset.id === replacer.backdrop.id));
    });
    toggles.forEach((t) => t.classList.toggle('wc-bg-btn-active', replacer.active));
  }

  function save() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({ id: replacer.backdrop.id === 'upload' ? 'off' : replacer.backdrop.id, color: replacer.color }));
    } catch (_) { /* ignore */ }
  }

  function choose(id) {
    replacer.setBackdrop(id);
    refresh();
    save();
    if (onChange) onChange(replacer.backdrop);
  }

  list.addEventListener('click', (e) => {
    const item = e.target.closest('.wc-bg-item');
    if (!item) return;
    const id = item.dataset.id;
    if (id === 'color') { colorInput.click(); choose('color'); return; }
    if (id === 'upload') { fileInput.click(); return; }
    choose(id);
  });

  colorInput.addEventListener('input', () => { replacer.setColor(colorInput.value); save(); });

  fileInput.addEventListener('change', () => {
    const f = fileInput.files && fileInput.files[0];
    if (!f) return;
    const url = URL.createObjectURL(f);
    const img = new Image();
    img.onload = () => { replacer.setImage(img); choose('upload'); };
    img.onerror = () => { status.textContent = 'That file could not be opened as an image.'; };
    img.src = url;
    fileInput.value = '';
  });

  function open(force) {
    const show = typeof force === 'boolean' ? force : !tray.classList.contains('open');
    tray.classList.toggle('open', show);
    if (show && !replacer.active) setStatusText(replacer.status);
  }
  toggles.forEach((t) => t.addEventListener('click', () => open()));
  tray.querySelector('.wc-bg-close').addEventListener('click', () => open(false));

  document.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (/INPUT|TEXTAREA|SELECT/.test(tag) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.key === 'b' || e.key === 'B') open();
    if (e.key === 'Escape' && tray.classList.contains('open')) open(false);
  });

  // restore last choice (uploaded photos are not persisted)
  try {
    const saved = JSON.parse(localStorage.getItem(PREF_KEY) || 'null');
    if (saved) {
      if (saved.color) { replacer.setColor(saved.color); colorInput.value = saved.color; }
      if (saved.id && saved.id !== 'off') replacer.setBackdrop(saved.id);
    }
  } catch (_) { /* ignore */ }
  refresh();

  return { open, choose };
}
