/* WebcamClicks — Password generator.
   crypto.getRandomValues with rejection sampling (no modulo bias). Nothing is stored or sent. */

import { $, copyText, setStatus } from './common.js';

const els = {
  out: $('#t-pw'), len: $('#t-len'), lenVal: $('#t-len-val'), upper: $('#t-upper'), lower: $('#t-lower'),
  digits: $('#t-digits'), symbols: $('#t-symbols'), ambiguous: $('#t-ambiguous'), regen: $('#t-regen'), copy: $('#t-copy'),
  meter: $('#t-meter'), meterLabel: $('#t-meter-label'), bits: $('#t-bits'), bulk: $('#t-bulk'), bulkBtn: $('#t-bulk-btn'),
  bulkCopy: $('#t-bulk-copy'), status: $('#t-status')
};

const SETS = { upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', lower: 'abcdefghijklmnopqrstuvwxyz', digits: '0123456789', symbols: '!@#$%^&*()-_=+[]{};:,.?/~' };
const AMBIG = /[Il1O0o|`'"]/g;

function randInt(n) {
  const max = Math.floor(0x100000000 / n) * n;   // reject values that would bias the result
  const buf = new Uint32Array(1);
  do { crypto.getRandomValues(buf); } while (buf[0] >= max);
  return buf[0] % n;
}

function pools() {
  return Object.keys(SETS).filter((k) => els[k].checked).map((k) => (els.ambiguous.checked ? SETS[k].replace(AMBIG, '') : SETS[k]));
}

function generate() {
  const p = pools();
  if (!p.length) return '';
  const len = +els.len.value;
  const all = p.join('');
  const chars = p.map((s) => s[randInt(s.length)]);           // at least one from each chosen set
  while (chars.length < len) chars.push(all[randInt(all.length)]);
  for (let i = chars.length - 1; i > 0; i--) { const j = randInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.slice(0, len).join('');
}

function strength() {
  const size = pools().join('').length;
  const bits = size ? Math.round(+els.len.value * Math.log2(size)) : 0;
  const [label, pct, color] = bits < 40 ? ['Weak', 20, '#d92d20'] : bits < 60 ? ['Fair', 45, '#f79009'] : bits < 80 ? ['Strong', 72, '#12b76a'] : ['Very strong', 100, '#067647'];
  els.meter.style.width = `${pct}%`; els.meter.style.background = color;
  els.meterLabel.textContent = label;
  const years = 2 ** bits / 1e11 / 3.15e7 / 2;   // 100 billion guesses/second, average case
  els.bits.textContent = `${bits} bits of entropy · ${years > 1e9 ? 'billions of years' : years > 1 ? `${Math.round(years).toLocaleString()} years` : 'under a year'} to crack offline at 100 billion guesses/second`;
}

function refresh() {
  els.lenVal.textContent = els.len.value;
  els.out.value = generate();
  strength();
  if (!pools().length) setStatus(els.status, 'Pick at least one character type.', 'err'); else setStatus(els.status, '');
}

[els.len, els.upper, els.lower, els.digits, els.symbols, els.ambiguous].forEach((e) => e.addEventListener('input', refresh));
els.regen.addEventListener('click', refresh);
els.copy.addEventListener('click', async () => setStatus(els.status, (await copyText(els.out.value)) ? 'Password copied. Paste it into your password manager.' : 'Copy failed.', 'ok'));
els.bulkBtn.addEventListener('click', () => { els.bulk.value = Array.from({ length: 10 }, generate).join('\n'); els.bulkCopy.disabled = false; });
els.bulkCopy.addEventListener('click', async () => setStatus(els.status, (await copyText(els.bulk.value)) ? '10 passwords copied.' : 'Copy failed.', 'ok'));
refresh();
