/* WebcamClicks — Bulk file renamer.
   Template tokens: {name} {n} {date} {time} {folder} {ext}
   Outputs a ZIP of renamed copies (every browser), or renames files in place inside a
   folder the user picks (Chrome/Edge, File System Access API). Nothing is uploaded. */

import { $, setupDropzone, escapeHtml, splitName, downloadZip, setStatus } from './common.js';

const els = {
  drop: $('#t-drop'), input: $('#t-input'), folderInput: $('#t-folder-input'), folderBtn: $('#t-folder-btn'),
  diskBtn: $('#t-disk-btn'), pattern: $('#t-pattern'), find: $('#t-find'), replace: $('#t-replace'),
  regex: $('#t-regex'), matchCase: $('#t-matchcase'), caseSel: $('#t-case'), spaces: $('#t-spaces'),
  start: $('#t-start'), step: $('#t-step'), pad: $('#t-pad'), sort: $('#t-sort'), ext: $('#t-ext'),
  tbody: $('#t-tbody'), zip: $('#t-zip'), apply: $('#t-apply'), clear: $('#t-clear'), status: $('#t-status'), count: $('#t-count')
};

let entries = [];   // { file, handle?, dirHandle? , relPath }
let dirHandle = null;
const INVALID = /[\\/:*?"<>|\u0000-\u001f]/g;

const pad2 = (n) => String(n).padStart(2, '0');
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

function applyCase(s, mode) {
  const words = s.replace(/([a-z])([A-Z])/g, '$1 $2').split(/[\s_\-.]+/).filter(Boolean);
  switch (mode) {
    case 'lower': return s.toLowerCase();
    case 'upper': return s.toUpperCase();
    case 'title': return s.toLowerCase().replace(/(^|[\s_\-.(])(\p{L})/gu, (m, a, b) => a + b.toUpperCase());
    case 'sentence': return s.charAt(0).toUpperCase() + s.slice(1).toLowerCase();
    case 'kebab': return words.join('-').toLowerCase();
    case 'snake': return words.join('_').toLowerCase();
    case 'camel': return words.map((w, i) => i ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w.toLowerCase()).join('');
    default: return s;
  }
}

function sorted() {
  const by = els.sort.value;
  const list = entries.map((e, i) => ({ ...e, i }));
  if (by === 'name') list.sort((a, b) => collator.compare(a.file.name, b.file.name));
  else if (by === 'date') list.sort((a, b) => a.file.lastModified - b.file.lastModified || collator.compare(a.file.name, b.file.name));
  else if (by === 'size') list.sort((a, b) => a.file.size - b.file.size);
  return list;
}

function newNames() {
  const list = sorted();
  const start = parseInt(els.start.value, 10) || 0, step = parseInt(els.step.value, 10) || 1;
  const padN = Math.max(1, Math.min(8, parseInt(els.pad.value, 10) || 1));
  const tpl = els.pattern.value || '{name}';
  let findRe = null;
  if (els.find.value) {
    try {
      findRe = els.regex.checked
        ? new RegExp(els.find.value, els.matchCase.checked ? 'g' : 'gi')
        : new RegExp(els.find.value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), els.matchCase.checked ? 'g' : 'gi');
    } catch (_) { findRe = null; setStatus(els.status, 'That regular expression is not valid.', 'err'); }
  }
  return list.map((e, idx) => {
    const [base, ext0] = splitName(e.file.name);
    const d = new Date(e.file.lastModified || Date.now());
    const folder = (e.relPath || '').split('/').slice(-2, -1)[0] || '';
    let name = tpl
      .replace(/\{name\}/g, base)
      .replace(/\{n(?::(\d+))?\}/g, (m, p) => String(start + idx * step).padStart(p ? +p : padN, '0'))
      .replace(/\{date\}/g, `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`)
      .replace(/\{time\}/g, `${pad2(d.getHours())}-${pad2(d.getMinutes())}-${pad2(d.getSeconds())}`)
      .replace(/\{folder\}/g, folder)
      .replace(/\{ext\}/g, ext0);
    if (findRe) name = name.replace(findRe, els.replace.value);
    name = applyCase(name, els.caseSel.value);
    const sp = els.spaces.value;
    if (sp !== 'keep') name = name.replace(/\s+/g, sp === 'remove' ? '' : sp);
    name = name.replace(INVALID, '-').replace(/^[\s.]+|[\s.]+$/g, '');
    let ext = ext0;
    const em = els.ext.value;
    if (em === 'lower') ext = ext.toLowerCase();
    else if (em === 'upper') ext = ext.toUpperCase();
    else if (em === 'remove') ext = '';
    else if (em === 'jpeg2jpg') ext = /^jpe?g$/i.test(ext) ? 'jpg' : ext.toLowerCase();
    return { e, oldName: e.file.name, newName: (name || 'file') + (ext ? `.${ext}` : '') };
  });
}

function render() {
  const rows = newNames();
  const seen = new Map();
  rows.forEach((r) => { const k = r.newName.toLowerCase(); seen.set(k, (seen.get(k) || 0) + 1); });
  const dups = rows.filter((r) => seen.get(r.newName.toLowerCase()) > 1).length;
  const MAX = 500;
  els.tbody.innerHTML = rows.slice(0, MAX).map((r, i) => {
    const dup = seen.get(r.newName.toLowerCase()) > 1;
    return `<tr class="${dup ? 'dup' : ''}"><td>${i + 1}</td><td class="old">${escapeHtml(r.oldName)}</td><td class="new">${escapeHtml(r.newName)}${dup ? ' ⚠ duplicate' : ''}</td></tr>`;
  }).join('') + (rows.length > MAX ? `<tr><td colspan="3">…and ${rows.length - MAX} more</td></tr>` : '');
  const changed = rows.filter((r) => r.newName !== r.oldName).length;
  els.count.textContent = entries.length ? `${entries.length} files · ${changed} will change${dups ? ` · ${dups} duplicate names` : ''}` : '';
  els.zip.disabled = !entries.length || dups > 0;
  els.apply.hidden = !dirHandle;
  els.apply.disabled = !dirHandle || dups > 0 || !changed;
  if (dups) setStatus(els.status, 'Some new names are identical. Add {n} to the pattern to number them.', 'err');
  else if (els.status.dataset.kind === 'err') setStatus(els.status, '');
  return rows;
}

function addFiles(files, fromFolder) {
  if (!fromFolder) dirHandle = null;
  for (const f of files) entries.push({ file: f, relPath: f.webkitRelativePath || '' });
  setStatus(els.status, `${entries.length} files loaded. Nothing has been changed yet.`);
  render();
}

/* ---------- in-place rename (Chrome/Edge) ---------- */
const canDisk = 'showDirectoryPicker' in window;
if (!canDisk && els.diskBtn) els.diskBtn.hidden = true;

async function openFolder() {
  try {
    dirHandle = await window.showDirectoryPicker({ mode: 'readwrite' });
  } catch (e) { return; }   // user cancelled
  entries = [];
  for await (const [name, h] of dirHandle.entries()) {
    if (h.kind === 'file') entries.push({ file: await h.getFile(), handle: h, relPath: `${dirHandle.name}/${name}` });
  }
  setStatus(els.status, `${entries.length} files in “${dirHandle.name}”. Review the new names, then press Rename files.`);
  render();
}

async function applyOnDisk() {
  const rows = render().filter((r) => r.newName !== r.oldName);
  if (!rows.length || !dirHandle) return;
  if (!confirm(`Rename ${rows.length} files in “${dirHandle.name}”? You can undo by renaming them back, but this tool won't remember the old names after you leave the page.`)) return;
  if (typeof rows[0].e.handle.move !== 'function') {
    setStatus(els.status, 'Your browser can read this folder but not rename files in it. Use “Download as ZIP” instead.', 'err');
    return;
  }
  els.apply.disabled = true;
  const stamp = Date.now().toString(36);
  try {
    // two passes avoid clashes such as a→b while b→a
    for (let i = 0; i < rows.length; i++) await rows[i].e.handle.move(`.wc-tmp-${stamp}-${i}`);
    for (let i = 0; i < rows.length; i++) {
      await rows[i].e.handle.move(rows[i].newName);
      setStatus(els.status, `Renamed ${i + 1} of ${rows.length}…`);
    }
    setStatus(els.status, `Done: ${rows.length} files renamed in “${dirHandle.name}”.`, 'ok');
    entries = [];
    for await (const [name, h] of dirHandle.entries()) if (h.kind === 'file') entries.push({ file: await h.getFile(), handle: h, relPath: `${dirHandle.name}/${name}` });
    render();
  } catch (e) {
    setStatus(els.status, `Stopped: ${e.message}. Some files may have a temporary .wc-tmp name; run the rename again to finish.`, 'err');
  }
}

/* ---------- wiring ---------- */
setupDropzone(els.drop, els.input, (f) => addFiles(f, false));
els.folderBtn.addEventListener('click', () => els.folderInput.click());
els.folderInput.addEventListener('change', () => { addFiles([...els.folderInput.files], false); els.folderInput.value = ''; });
if (els.diskBtn) els.diskBtn.addEventListener('click', openFolder);
['input', 'change'].forEach((ev) => document.querySelectorAll('.t-rename-opt').forEach((n) => n.addEventListener(ev, render)));
document.querySelectorAll('[data-token]').forEach((b) => b.addEventListener('click', () => {
  const t = b.dataset.token, el = els.pattern, s = el.selectionStart ?? el.value.length;
  el.value = el.value.slice(0, s) + t + el.value.slice(el.selectionEnd ?? s);
  el.focus(); el.selectionStart = el.selectionEnd = s + t.length;
  render();
}));
els.clear.addEventListener('click', () => { entries = []; dirHandle = null; setStatus(els.status, ''); render(); });
els.zip.addEventListener('click', async () => {
  const rows = render();
  setStatus(els.status, 'Creating ZIP…');
  try {
    await downloadZip(rows.map((r) => ({ name: r.newName, blob: r.e.file, date: new Date(r.e.file.lastModified) })), 'renamed-files.zip');
    setStatus(els.status, `ZIP downloaded with ${rows.length} renamed files.`, 'ok');
  } catch (e) { setStatus(els.status, e.message, 'err'); }
});
els.apply.addEventListener('click', applyOnDisk);
render();
