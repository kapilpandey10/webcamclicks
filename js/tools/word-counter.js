/* WebcamClicks — Word counter & text tools (all local; draft saved in this browser only). */

import { $, copyText, setStatus, downloadBlob } from './common.js';

const ta = $('#t-text'), status = $('#t-status'), kw = $('#t-keywords');
const out = {
  words: $('#s-words'), chars: $('#s-chars'), charsNs: $('#s-chars-ns'), sentences: $('#s-sentences'),
  paragraphs: $('#s-paragraphs'), read: $('#s-read'), speak: $('#s-speak'), avg: $('#s-avg')
};
const KEY = 'wc_wordcounter_draft';

const STOP = new Set(('a an and are as at be but by for from has have he her his i in is it its of on or our she so that the their them they this to was we were will with you your not no yes do does did can could would should if then than there here what which who whom when where why how all any each few more most other some such only own same too very just also into over after before about up down out off again further once am been being both because while until against between through during above below me my myself ours ourselves yours yourself yourselves him himself hers herself itself theirs themselves these those let us may might must shall').split(' '));

const seg = typeof Intl !== 'undefined' && Intl.Segmenter ? new Intl.Segmenter(undefined, { granularity: 'word' }) : null;

function wordsOf(text) {
  if (seg) return [...seg.segment(text)].filter((s) => s.isWordLike).map((s) => s.segment);
  return text.match(/[\p{L}\p{N}'’-]+/gu) || [];
}

const fmtTime = (min) => {
  if (min < 1) return `${Math.max(0, Math.round(min * 60))} sec`;
  const m = Math.floor(min), s = Math.round((min - m) * 60);
  return s ? `${m} min ${s} sec` : `${m} min`;
};

function update() {
  const t = ta.value;
  const words = wordsOf(t);
  const wc = words.length;
  out.words.textContent = wc.toLocaleString();
  out.chars.textContent = [...t].length.toLocaleString();
  out.charsNs.textContent = [...t.replace(/\s/g, '')].length.toLocaleString();
  out.sentences.textContent = (t.trim() ? (t.match(/[^.!?。！？]+[.!?。！？]+(\s|$)|[^.!?。！？]+$/g) || []).filter((s) => s.trim()).length : 0).toLocaleString();
  out.paragraphs.textContent = (t.trim() ? t.split(/\n\s*\n/).filter((p) => p.trim()).length : 0).toLocaleString();
  out.read.textContent = fmtTime(wc / 238);
  out.speak.textContent = fmtTime(wc / 140);
  out.avg.textContent = wc ? (words.reduce((a, w) => a + [...w].length, 0) / wc).toFixed(1) : '0';

  const freq = new Map();
  words.forEach((w) => { const k = w.toLowerCase(); if (k.length > 2 && !STOP.has(k) && !/^\d+$/.test(k)) freq.set(k, (freq.get(k) || 0) + 1); });
  const top = [...freq.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  kw.innerHTML = top.length
    ? top.map(([w, n]) => `<li><span>${w.replace(/[<>&]/g, '')}</span><b>${n} · ${((n / wc) * 100).toFixed(1)}%</b></li>`).join('')
    : '<li class="muted">Keyword density appears as you type.</li>';
  try { localStorage.setItem(KEY, t.slice(0, 200000)); } catch (_) { /* ignore */ }
}

const TRANSFORMS = {
  upper: (t) => t.toUpperCase(),
  lower: (t) => t.toLowerCase(),
  title: (t) => t.toLowerCase().replace(/(^|[\s"'(\[{-])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  sentence: (t) => t.toLowerCase().replace(/(^\s*|[.!?]\s+)(\p{L})/gu, (m, a, b) => a + b.toUpperCase()),
  spaces: (t) => t.replace(/[ \t]+/g, ' ').replace(/ *\n */g, '\n').replace(/\n{3,}/g, '\n\n').trim(),
  breaks: (t) => t.replace(/\s*\n\s*/g, ' ').replace(/ {2,}/g, ' ').trim(),
  dedupe: (t) => [...new Set(t.split('\n'))].join('\n'),
  sort: (t) => t.split('\n').sort((a, b) => a.localeCompare(b, undefined, { numeric: true })).join('\n'),
  reverse: (t) => t.split('\n').reverse().join('\n'),
  slug: (t) => t.normalize('NFKD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
};

document.querySelectorAll('[data-tx]').forEach((b) => b.addEventListener('click', () => {
  const fn = TRANSFORMS[b.dataset.tx]; if (!fn) return;
  const { selectionStart: s, selectionEnd: e } = ta;
  if (e > s) ta.setRangeText(fn(ta.value.slice(s, e)), s, e, 'select');   // transform only the selection
  else ta.value = fn(ta.value);
  update();
  ta.focus();
}));

$('#t-copy').addEventListener('click', async () => setStatus(status, (await copyText(ta.value)) ? 'Copied to clipboard.' : 'Copy failed.', 'ok'));
$('#t-download').addEventListener('click', () => downloadBlob(new Blob([ta.value], { type: 'text/plain;charset=utf-8' }), 'text.txt'));
$('#t-clear').addEventListener('click', () => { if (!ta.value || confirm('Clear all text?')) { ta.value = ''; update(); } });

try { const d = localStorage.getItem(KEY); if (d) ta.value = d; } catch (_) { /* ignore */ }
ta.addEventListener('input', update);
update();
