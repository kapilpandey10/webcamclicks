/* WebcamClicks — Password-protect a PDF (AES encryption on your device, via a pdf-lib fork with encryption). */

import { $, setupDropzone, splitName, downloadBlob, setStatus, loadEsm, formatBytes } from './common.js';

const els = { drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), info: $('#t-info'), pw: $('#t-pw'), pw2: $('#t-pw2'), show: $('#t-show'),
  owner: $('#t-owner'), print: $('#t-print'), copy: $('#t-copy'), edit: $('#t-edit'), annot: $('#t-annot'), run: $('#t-run'), meter: $('#t-meter') };
let file = null;

function strength(pw) {
  let pool = 0; if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/\d/.test(pw)) pool += 10; if (/[^A-Za-z0-9]/.test(pw)) pool += 30;
  const bits = pw.length * Math.log2(Math.max(pool, 1));
  return bits < 35 ? ['Weak', '#d92d20', 25] : bits < 55 ? ['OK', '#f79009', 55] : bits < 75 ? ['Strong', '#12b76a', 80] : ['Very strong', '#067647', 100];
}
function sync() {
  const pw = els.pw.value;
  const [label, color, pct] = strength(pw);
  els.meter.style.setProperty('--w', `${pw ? pct : 0}%`); els.meter.style.setProperty('--c', color); els.meter.dataset.label = pw ? label : '';
  els.run.disabled = !file || pw.length < 4 || pw !== els.pw2.value;
  if (pw && els.pw2.value && pw !== els.pw2.value) setStatus(els.status, 'The passwords don\'t match.', 'err');
  else if (els.status.dataset.kind === 'err') setStatus(els.status, '');
}
[els.pw, els.pw2].forEach((e) => e.addEventListener('input', sync));
els.show.addEventListener('change', () => { els.pw.type = els.pw2.type = els.show.checked ? 'text' : 'password'; });

setupDropzone(els.drop, els.input, (files) => {
  const f = files.find((x) => /pdf$/i.test(x.type) || /\.pdf$/i.test(x.name));
  if (!f) { setStatus(els.status, 'Please choose a PDF file.', 'err'); return; }
  file = f; els.info.textContent = `${f.name} · ${formatBytes(f.size)}`; setStatus(els.status, 'Now choose a password.'); sync(); els.pw.focus();
});

els.run.addEventListener('click', async () => {
  els.run.disabled = true;
  setStatus(els.status, 'Encrypting…');
  try {
    const { PDFDocument } = await loadEsm('pdflibCrypt');
    let doc;
    try { doc = await PDFDocument.load(await file.arrayBuffer()); }
    catch (e) { throw new Error(/encrypt/i.test(e.message) ? 'This PDF is already password-protected.' : 'This file could not be read as a PDF.'); }
    const owner = els.owner.value || (els.pw.value + crypto.getRandomValues(new Uint32Array(2)).join('-'));
    doc.encrypt({
      algorithm: 'AES-256', userPassword: els.pw.value, ownerPassword: owner,
      permissions: { printing: els.print.checked ? 'highResolution' : false, copying: els.copy.checked, modifying: els.edit.checked,
        annotating: els.annot.checked, fillingForms: els.annot.checked, contentAccessibility: true, documentAssembly: els.edit.checked }
    });
    const out = await doc.save({ useObjectStreams: false });
    downloadBlob(new Blob([out], { type: 'application/pdf' }), `${splitName(file.name)[0]}-protected.pdf`);
    setStatus(els.status, 'Done. Your protected PDF is downloading. Keep the password safe: it can\'t be recovered.', 'ok');
  } catch (e) { setStatus(els.status, e.message || 'Encryption failed.', 'err'); }
  sync();
});
