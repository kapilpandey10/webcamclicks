/* WebcamClicks — File metadata viewer & remover (photos, PDFs, video, audio). All on-device. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, setStatus, loadLib, loadMediabunny, decodeImage, canvasToBlob, copyText, fmtTime } from './common.js';

const els = { drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), out: $('#t-out'), actions: $('#t-actions'), clean: $('#t-clean'), json: $('#t-json'), copy: $('#t-copy'), summary: $('#t-summary') };

let current = null;   // { file, kind, groups: [{title, rows:[[k,v,sensitive]]}], raw }

const SENSITIVE = /gps|latitude|longitude|altitude|location|serial|owner|artist|author|creator|copyright|by-?line|camera ?owner|lens ?serial|body ?serial|maker ?note|software|host ?computer|user ?comment|city|country|state|sublocation/i;

function fmtVal(v) {
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.toLocaleString();
  if (v instanceof Uint8Array || ArrayBuffer.isView(v)) return `${v.length} bytes of binary data`;
  if (Array.isArray(v)) return v.length > 12 ? `${v.slice(0, 12).map(fmtVal).join(', ')}, …` : v.map(fmtVal).join(', ');
  if (typeof v === 'object') return Object.entries(v).slice(0, 12).map(([k, x]) => `${k}: ${fmtVal(x)}`).join('; ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
  return String(v);
}

const human = (k) => k.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/* ---------------------------------------------------------------- readers */

async function readImage(file) {
  const exifr = await loadLib('exifr');
  const groups = [];
  let parsed = {};
  try {
    parsed = await exifr.parse(file, { tiff: true, exif: true, gps: true, iptc: true, xmp: true, icc: true, jfif: true, ihdr: true, interop: false, makerNote: false, translateValues: true, reviveValues: true, mergeOutput: false }) || {};
  } catch (_) { parsed = {}; }
  let dims = '';
  try { const b = await decodeImage(file); dims = `${b.width || b.naturalWidth} × ${b.height || b.naturalHeight} px`; if (b.close) b.close(); } catch (_) { /* ignore */ }
  groups.push({ title: 'File', rows: [['Name', file.name], ['Type', file.type || 'unknown'], ['Size', formatBytes(file.size)], ['Dimensions', dims], ['Last modified', new Date(file.lastModified).toLocaleString()]] });
  let gps = null;
  try { gps = await exifr.gps(file); } catch (_) { /* ignore */ }
  if (gps && Number.isFinite(gps.latitude)) {
    const lat = gps.latitude.toFixed(6), lon = gps.longitude.toFixed(6);
    groups.push({ title: '⚠️ Location (GPS)', warn: true, rows: [['Latitude', lat, true], ['Longitude', lon, true], ['Map', `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}" target="_blank" rel="noopener nofollow">Open in OpenStreetMap ↗</a>`, true, true]] });
  }
  const names = { ifd0: 'Camera & image (TIFF)', exif: 'Exposure (EXIF)', gps: 'GPS details', iptc: 'IPTC (captions, credits)', xmp: 'XMP', icc: 'Colour profile (ICC)', jfif: 'JFIF', ihdr: 'PNG header', ifd1: 'Thumbnail' };
  for (const [key, obj] of Object.entries(parsed)) {
    if (!obj || typeof obj !== 'object') continue;
    // colour profiles carry the profile vendor's copyright, not the user's: never flag them
    const rows = Object.entries(obj).filter(([, v]) => v !== undefined && v !== '')
      .filter(([k]) => !(key === 'gps' && /^(latitude|longitude)$/i.test(k)))   // already shown in the Location group
      .map(([k, v]) => [human(k), fmtVal(v), key !== 'icc' && SENSITIVE.test(k)]);
    if (rows.length) groups.push({ title: names[key] || human(key), rows });
  }
  return { kind: 'image', groups, raw: parsed, gps };
}

async function readPdf(file) {
  const PDFLib = await loadLib('pdflib');
  const bytes = await file.arrayBuffer();
  const doc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false });
  const p0 = doc.getPageCount() ? doc.getPage(0).getSize() : null;
  const info = [
    ['Title', doc.getTitle()], ['Author', doc.getAuthor(), true], ['Subject', doc.getSubject()], ['Keywords', doc.getKeywords()],
    ['Creator (app)', doc.getCreator(), true], ['Producer', doc.getProducer(), true],
    ['Created', fmtVal(doc.getCreationDate())], ['Modified', fmtVal(doc.getModificationDate())]
  ].filter(([, v]) => v);
  const hasXmp = !!doc.catalog.get(PDFLib.PDFName.of('Metadata'));
  const groups = [
    { title: 'File', rows: [['Name', file.name], ['Size', formatBytes(file.size)], ['Pages', String(doc.getPageCount())], ['First page size', p0 ? `${Math.round(p0.width)} × ${Math.round(p0.height)} pt (${(p0.width / 72 * 25.4).toFixed(0)} × ${(p0.height / 72 * 25.4).toFixed(0)} mm)` : ''], ['Encrypted', doc.isEncrypted ? 'Yes' : 'No'], ['XMP metadata stream', hasXmp ? 'Present' : 'None', hasXmp]] },
    { title: 'Document properties', rows: info.length ? info.map(([k, v, s]) => [k, v, !!s]) : [['—', 'No document properties set']] }
  ];
  return { kind: 'pdf', groups, raw: Object.fromEntries(info) };
}

async function readMedia(file) {
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const [mime, dur, tags] = await Promise.all([input.getMimeType().catch(() => file.type), input.computeDuration().catch(() => NaN), input.getMetadataTags().catch(() => ({}))]);
  const tracks = await input.getTracks();
  const groups = [{ title: 'File', rows: [['Name', file.name], ['Size', formatBytes(file.size)], ['Container', mime], ['Duration', Number.isFinite(dur) ? fmtTime(dur) : 'unknown'], ['Overall bitrate', Number.isFinite(dur) && dur > 0 ? `${Math.round(file.size * 8 / dur / 1000)} kb/s` : '']] }];
  for (const t of tracks) {
    const rows = [['Codec', t.codec || 'unknown'], ['Language', t.languageCode && t.languageCode !== 'und' ? t.languageCode : '']];
    try {
      const st = await t.computePacketStats(120);
      if (st.averageBitrate) rows.push(['Bitrate (approx.)', `${Math.round(st.averageBitrate / 1000)} kb/s`]);
      if (t.isVideoTrack() && st.averagePacketRate) rows.push(['Frame rate (approx.)', `${st.averagePacketRate.toFixed(2)} fps`]);
    } catch (_) { /* ignore */ }
    if (t.isVideoTrack()) rows.push(['Resolution', `${t.displayWidth} × ${t.displayHeight}`], ['Rotation', `${t.rotation}°`]);
    if (t.isAudioTrack()) rows.push(['Sample rate', `${t.sampleRate} Hz`], ['Channels', String(t.numberOfChannels)]);
    groups.push({ title: `${t.isVideoTrack() ? 'Video' : t.isAudioTrack() ? 'Audio' : 'Other'} track`, rows: rows.filter(([, v]) => v) });
  }
  const tagRows = Object.entries(tags || {}).filter(([k, v]) => v != null && k !== 'raw' && k !== 'images').map(([k, v]) => [human(k), fmtVal(v), SENSITIVE.test(k)]);
  if (tags && tags.images && tags.images.length) tagRows.push(['Embedded images', `${tags.images.length} (cover art)`]);
  if (tags && tags.raw) for (const [k, v] of Object.entries(tags.raw).slice(0, 40)) if (v != null && typeof v !== 'object') tagRows.push([k, fmtVal(v), SENSITIVE.test(k) || /location|xyz|com\.apple\.quicktime\.(make|model|software)/i.test(k)]);
  groups.push({ title: 'Tags', rows: tagRows.length ? tagRows : [['—', 'No tags found']] });
  return { kind: 'media', groups, raw: { mime, duration: dur, tags: Object.fromEntries(Object.entries(tags || {}).filter(([k]) => k !== 'images' && k !== 'raw')) }, input };
}

/* ---------------------------------------------------------------- UI */

function render() {
  const c = current;
  const sens = c.groups.reduce((a, g) => a + g.rows.filter((r) => r[2]).length, 0);
  els.summary.innerHTML = sens
    ? `<strong>${sens} privacy-sensitive field${sens > 1 ? 's' : ''} found</strong>${c.gps ? ', including the exact GPS location where this photo was taken' : ''}. Use “Remove metadata” before sharing.`
    : 'No privacy-sensitive metadata found.';
  els.summary.dataset.kind = sens ? 'err' : 'ok';
  els.out.innerHTML = c.groups.map((g) => `<section class="md-group${g.warn ? ' warn' : ''}"><h3>${escapeHtml(g.title)}</h3><table class="t-table"><tbody>${
    g.rows.map(([k, v, s, isHtml]) => `<tr class="${s ? 'sens' : ''}"><th scope="row">${escapeHtml(k)}</th><td>${isHtml ? v : escapeHtml(v)}</td></tr>`).join('')}</tbody></table></section>`).join('');
  els.actions.hidden = false;
  els.clean.textContent = c.kind === 'media' ? 'Remove tags (copy without metadata)' : 'Remove metadata & download';
}

async function open(file) {
  setStatus(els.status, `Reading ${file.name}…`);
  els.out.innerHTML = ''; els.actions.hidden = true; els.summary.textContent = '';
  try {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImg = file.type.startsWith('image/') || /\.(jpe?g|png|heic|heif|webp|tiff?|avif|gif)$/i.test(file.name);
    const r = isPdf ? await readPdf(file) : isImg ? await readImage(file) : await readMedia(file);
    current = { file, ...r };
    render();
    setStatus(els.status, '');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, 'This file type could not be read. Supported: photos (JPG, PNG, HEIC, WebP, TIFF), PDF, MP4, MOV, WebM, MKV, MP3, M4A, WAV, OGG, FLAC.', 'err');
  }
}

/* ---------------------------------------------------------------- remove */

async function clean() {
  const c = current; if (!c) return;
  const [base, ext] = splitName(c.file.name);
  els.clean.disabled = true;
  try {
    if (c.kind === 'image') {
      const bmp = await decodeImage(c.file);
      const cv = document.createElement('canvas'); cv.width = bmp.width || bmp.naturalWidth; cv.height = bmp.height || bmp.naturalHeight;
      cv.getContext('2d').drawImage(bmp, 0, 0);
      const type = /png/i.test(c.file.type) ? 'image/png' : /webp/i.test(c.file.type) ? 'image/webp' : 'image/jpeg';
      const blob = await canvasToBlob(cv, type, 0.95);
      downloadBlob(blob, `${base}-no-metadata.${type === 'image/png' ? 'png' : type === 'image/webp' ? 'webp' : 'jpg'}`);
      setStatus(els.status, 'Downloaded a clean copy: all EXIF, GPS, camera and software data removed (orientation kept).', 'ok');
    } else if (c.kind === 'pdf') {
      const PDFLib = await loadLib('pdflib');
      const doc = await PDFLib.PDFDocument.load(await c.file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
      const epoch = new Date(0); doc.setCreationDate(epoch); doc.setModificationDate(epoch);
      doc.catalog.delete(PDFLib.PDFName.of('Metadata'));
      const info = doc.context.trailerInfo.Info;
      if (info) { const dict = doc.context.lookup(info); ['Title', 'Author', 'Subject', 'Keywords', 'Creator', 'Producer', 'CreationDate', 'ModDate'].forEach((k) => dict.delete(PDFLib.PDFName.of(k))); }
      const out = await doc.save({ updateFieldAppearances: false });
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `${base}-no-metadata.pdf`);
      setStatus(els.status, 'Downloaded a clean PDF: author, title, software, dates and XMP metadata removed. Page content is unchanged.', 'ok');
    } else {
      const MB = await loadMediabunny();
      const input = new MB.Input({ source: new MB.BlobSource(c.file), formats: MB.ALL_FORMATS });
      const fmtIn = await input.getFormat();
      const isMp4ish = /mp4|quicktime|mov|m4a|m4v/i.test(fmtIn.name || '') || /\.(mp4|mov|m4v|m4a)$/i.test(c.file.name);
      const output = new MB.Output({ format: isMp4ish ? new MB.Mp4OutputFormat() : fmtIn.name && /webm|matroska|mkv/i.test(fmtIn.name) ? new MB.WebMOutputFormat() : new MB.Mp4OutputFormat(), target: new MB.BufferTarget() });
      const conv = await MB.Conversion.init({ input, output, tags: {} });
      if (!conv.isValid) throw new Error('This file cannot be copied without re-encoding.');
      conv.onProgress = (p) => setStatus(els.status, `Copying without metadata… ${Math.round(p * 100)}%`);
      await conv.execute();
      downloadBlob(new Blob([output.target.buffer], { type: output.format.mimeType }), `${base}-no-metadata.${output.format.fileExtension.replace('.', '') || ext}`);
      setStatus(els.status, 'Downloaded a copy without title, artist, location, device or other tags. Audio and video are copied without re-encoding.', 'ok');
    }
  } catch (e) { setStatus(els.status, e.message || 'Could not remove metadata from this file.', 'err'); }
  els.clean.disabled = false;
}

setupDropzone(els.drop, els.input, (files) => open(files[0]));
els.clean.addEventListener('click', clean);
els.json.addEventListener('click', () => current && downloadBlob(new Blob([JSON.stringify({ file: current.file.name, groups: current.groups.map((g) => ({ title: g.title, fields: Object.fromEntries(g.rows.map((r) => [r[0], String(r[1]).replace(/<[^>]+>/g, '')])) })) }, null, 2)], { type: 'application/json' }), `${splitName(current.file.name)[0]}-metadata.json`));
els.copy.addEventListener('click', async () => { if (!current) return; const txt = current.groups.map((g) => `${g.title}\n${g.rows.map((r) => `  ${r[0]}: ${String(r[1]).replace(/<[^>]+>/g, '')}`).join('\n')}`).join('\n\n'); setStatus(els.status, (await copyText(txt)) ? 'Copied.' : 'Copy failed.', 'ok'); });
