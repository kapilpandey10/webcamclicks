/* WebcamClicks — QR code generator (static codes: they never expire and have no tracking). */

import { $, loadLib, downloadBlob, setStatus } from './common.js';

const els = {
  type: $('#t-qrtype'), fields: $('#t-qrfields'), fg: $('#t-fg'), bg: $('#t-bg'), size: $('#t-size'), sizeVal: $('#t-size-val'),
  margin: $('#t-margin'), ecc: $('#t-ecc'), style: $('#t-style'), canvas: $('#t-qr'), png: $('#t-png'), svg: $('#t-svg'),
  status: $('#t-status'), payload: $('#t-payload')
};

const FORMS = {
  url: [['url', 'Website URL', 'https://example.com', 'url']],
  text: [['text', 'Text', 'Any text up to ~1,000 characters', 'textarea']],
  wifi: [['ssid', 'Network name (SSID)', 'MyHomeWiFi'], ['pass', 'Password', '', 'text'], ['enc', 'Security', 'WPA', 'select:WPA|WEP|nopass'], ['hidden', 'Hidden network', '', 'checkbox']],
  email: [['to', 'Email address', 'name@example.com', 'email'], ['subject', 'Subject', ''], ['body', 'Message', '', 'textarea']],
  phone: [['tel', 'Phone number', '+1 555 123 4567', 'tel']],
  sms: [['tel', 'Phone number', '+1 555 123 4567', 'tel'], ['body', 'Message', '', 'textarea']],
  vcard: [['first', 'First name', ''], ['last', 'Last name', ''], ['org', 'Company', ''], ['title', 'Job title', ''], ['tel', 'Phone', '', 'tel'], ['email', 'Email', '', 'email'], ['url', 'Website', '', 'url']]
};

function buildForm() {
  els.fields.innerHTML = FORMS[els.type.value].map(([k, label, ph, kind = 'text']) => {
    if (kind === 'textarea') return `<label class="t-field">${label}<textarea class="t-textarea" data-k="${k}" rows="3" style="min-height:90px" placeholder="${ph}"></textarea></label>`;
    if (kind === 'checkbox') return `<label class="t-check"><input type="checkbox" data-k="${k}"> ${label}</label>`;
    if (kind.startsWith('select:')) return `<label class="t-field">${label}<select class="t-select" data-k="${k}">${kind.slice(7).split('|').map((o) => `<option>${o}</option>`).join('')}</select></label>`;
    return `<label class="t-field">${label}<input class="t-input" type="${kind}" data-k="${k}" placeholder="${ph}"></label>`;
  }).join('');
  if (els.type.value === 'url') els.fields.querySelector('[data-k="url"]').value = 'https://webcamclicks.com';
  els.fields.querySelectorAll('[data-k]').forEach((n) => n.addEventListener('input', draw));
  draw();
}

const val = (k) => { const n = els.fields.querySelector(`[data-k="${k}"]`); return n ? (n.type === 'checkbox' ? n.checked : n.value.trim()) : ''; };
const esc = (s) => s.replace(/([\\;,:"])/g, '\\$1');

function payload() {
  switch (els.type.value) {
    case 'url': { let u = val('url'); if (u && !/^[a-z]+:/i.test(u)) u = `https://${u}`; return u; }
    case 'text': return val('text');
    case 'wifi': return val('ssid') ? `WIFI:T:${val('enc')};S:${esc(val('ssid'))};${val('enc') !== 'nopass' ? `P:${esc(val('pass'))};` : ''}${val('hidden') ? 'H:true;' : ''};` : '';
    case 'email': {
      if (!val('to')) return '';
      const q = [val('subject') && `subject=${encodeURIComponent(val('subject'))}`, val('body') && `body=${encodeURIComponent(val('body'))}`].filter(Boolean).join('&');
      return `mailto:${val('to')}${q ? `?${q}` : ''}`;
    }
    case 'phone': return val('tel') ? `tel:${val('tel').replace(/[^\d+]/g, '')}` : '';
    case 'sms': return val('tel') ? `SMSTO:${val('tel').replace(/[^\d+]/g, '')}:${val('body')}` : '';
    case 'vcard': {
      if (!val('first') && !val('last')) return '';
      return ['BEGIN:VCARD', 'VERSION:3.0', `N:${val('last')};${val('first')};;;`, `FN:${`${val('first')} ${val('last')}`.trim()}`,
        val('org') && `ORG:${val('org')}`, val('title') && `TITLE:${val('title')}`, val('tel') && `TEL;TYPE=CELL:${val('tel')}`,
        val('email') && `EMAIL:${val('email')}`, val('url') && `URL:${val('url')}`, 'END:VCARD'].filter(Boolean).join('\n');
    }
    default: return '';
  }
}

let matrix = null;   // { n, dark(r,c) }

async function draw() {
  els.sizeVal.textContent = `${els.size.value} px`;
  const data = payload();
  els.payload.textContent = data || '—';
  els.png.disabled = els.svg.disabled = !data;
  const ctx = els.canvas.getContext('2d');
  if (!data) { matrix = null; els.canvas.width = els.canvas.height = 1; setStatus(els.status, 'Fill in the fields to create your QR code.'); return; }
  const qrcode = await loadLib('qrcode');
  let qr;
  try {
    qr = qrcode(0, els.ecc.value);
    qr.addData(unescape(encodeURIComponent(data)), 'Byte');   // UTF-8 bytes
    qr.make();
  } catch (e) { setStatus(els.status, 'That is too much data for a QR code. Shorten it or lower error correction.', 'err'); return; }
  const n = qr.getModuleCount();
  matrix = { n, dark: (r, c) => qr.isDark(r, c) };
  const size = +els.size.value;
  els.canvas.width = els.canvas.height = size;
  render(ctx, size);
  setStatus(els.status, `${n}×${n} modules · ${data.length} characters · scan it with your phone camera to test.`, contrastOk() ? '' : 'err');
  if (!contrastOk()) setStatus(els.status, 'Low contrast: most scanners need a dark code on a light background.', 'err');
}

function lum(hex) {
  const v = parseInt(hex.slice(1), 16), c = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const contrastOk = () => lum(els.bg.value) - lum(els.fg.value) > 0.4;

function cells(size) {
  const m = +els.margin.value, n = matrix.n, total = n + m * 2;
  return { m, n, cell: size / total };
}

function render(ctx, size) {
  const { m, n, cell } = cells(size);
  ctx.fillStyle = els.bg.value; ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = els.fg.value;
  const dots = els.style.value === 'dots';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!matrix.dark(r, c)) continue;
    const x = (c + m) * cell, y = (r + m) * cell;
    const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    if (dots && !finder) { ctx.beginPath(); ctx.arc(x + cell / 2, y + cell / 2, cell * 0.42, 0, Math.PI * 2); ctx.fill(); }
    else ctx.fillRect(Math.floor(x), Math.floor(y), Math.ceil(cell), Math.ceil(cell));
  }
}

function toSvg() {
  const { m, n } = cells(1);
  const total = n + m * 2;
  const dots = els.style.value === 'dots';
  let body = '';
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    if (!matrix.dark(r, c)) continue;
    const finder = (r < 7 && c < 7) || (r < 7 && c >= n - 7) || (r >= n - 7 && c < 7);
    body += dots && !finder ? `<circle cx="${c + m + 0.5}" cy="${r + m + 0.5}" r="0.42"/>` : `<rect x="${c + m}" y="${r + m}" width="1.02" height="1.02"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${total} ${total}" shape-rendering="crispEdges"><rect width="100%" height="100%" fill="${els.bg.value}"/><g fill="${els.fg.value}">${body}</g></svg>`;
}

els.type.addEventListener('change', buildForm);
[els.fg, els.bg, els.size, els.margin, els.ecc, els.style].forEach((e) => e.addEventListener('input', draw));
els.png.addEventListener('click', () => els.canvas.toBlob((b) => downloadBlob(b, `qr-code-${els.type.value}.png`), 'image/png'));
els.svg.addEventListener('click', () => downloadBlob(new Blob([toSvg()], { type: 'image/svg+xml' }), `qr-code-${els.type.value}.svg`));
buildForm();
