/* WebcamClicks — File metadata viewer & remover. Reads (nearly) everything a file says about itself:
   photos (EXIF, GPS, IPTC, XMP, ICC, maker data, thumbnails, C2PA / AI markers, PNG text), PDFs (info, XMP,
   fonts, links, forms, attachments, JavaScript, revisions), Office & OpenDocument files (authors, editors,
   company, editing time, comments, tracked changes, hidden sheets, external links), EPUB, ZIP, SVG/HTML,
   fonts, audio and video. All on-device. */

import { $, setupDropzone, formatBytes, escapeHtml, splitName, downloadBlob, setStatus, loadLib, loadMediabunny, decodeImage, canvasToBlob, copyText, fmtTime } from './common.js';

const els = { drop: $('#t-drop'), input: $('#t-input'), status: $('#t-status'), out: $('#t-out'), actions: $('#t-actions'), clean: $('#t-clean'), json: $('#t-json'), copy: $('#t-copy'), summary: $('#t-summary') };

let current = null;   // { file, kind, groups: [{title, warn, rows:[[k, v, sensitive, isHtml]]}] }
const urls = [];      // object URLs for previews (revoked on the next file)

const SENSITIVE = /gps|latitude|longitude|altitude|location|serial|owner|artist|author|creator|copyright|by-?line|maker ?note|software|host ?computer|user ?comment|city|country|state|sublocation|modified ?by|last ?author|company|manager|template|printed|editing|person|initials|email|e-mail|user|producer|generator|path|docname|export|prompt|parameters|uuid|document ?id|instance ?id|history|camera ?model|lens ?model|body|^make$|^model$|lens ?make/i;

function fmtVal(v) {
  if (v == null) return '';
  if (v instanceof Date) return isNaN(v) ? '' : v.toLocaleString();
  if (v instanceof Uint8Array || ArrayBuffer.isView(v) || v instanceof ArrayBuffer) return `${v.byteLength ?? v.length} bytes of binary data`;
  if (Array.isArray(v)) return v.length > 16 ? `${v.slice(0, 16).map(fmtVal).join(', ')}, … (${v.length} items)` : v.map(fmtVal).join(', ');
  if (typeof v === 'object') return Object.entries(v).slice(0, 20).map(([k, x]) => `${k}: ${fmtVal(x)}`).join('; ');
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : String(+v.toFixed(6));
  return String(v);
}
const human = (k) => String(k).replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
const row = (k, v, sens, html) => [k, html ? v : fmtVal(v), sens == null ? SENSITIVE.test(k) : !!sens, !!html];
const group = (title, rows, warn) => ({ title, rows: rows.filter((r) => r && r[1] !== '' && r[1] != null), warn });
const ascii = (b, s = 0, e = b.length) => { let o = ''; for (let i = s; i < e; i++) o += String.fromCharCode(b[i]); return o; };
const imgRow = (k, blob, note) => { const u = URL.createObjectURL(blob); urls.push(u); return row(k, `<img class="md-thumb" src="${u}" alt="">${note ? `<br><small>${escapeHtml(note)}</small>` : ''}`, true, true); };

/* ---------------------------------------------------------------- what is this file, really? */

function sniff(b, name) {
  const s4 = ascii(b, 0, 4), s12 = ascii(b, 0, 12), ext = (name.split('.').pop() || '').toLowerCase();
  const eq = (...x) => x.every((v, i) => b[i] === v);
  if (eq(0xff, 0xd8, 0xff)) return { label: 'JPEG image', fam: 'image', ext: 'jpg' };
  if (eq(0x89, 0x50, 0x4e, 0x47)) return { label: 'PNG image', fam: 'image', ext: 'png' };
  if (s4 === 'GIF8') return { label: 'GIF image', fam: 'image', ext: 'gif' };
  if (s4 === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return { label: 'WebP image', fam: 'image', ext: 'webp' };
  if (s4 === 'RIFF' && ascii(b, 8, 12) === 'WAVE') return { label: 'WAV audio', fam: 'media', ext: 'wav' };
  if (s4 === 'RIFF' && ascii(b, 8, 12) === 'AVI ') return { label: 'AVI video', fam: 'media', ext: 'avi' };
  if (ascii(b, 4, 8) === 'ftyp') {
    const brand = ascii(b, 8, 12);
    if (/heic|heix|hevc|mif1|msf1|avif|avis/.test(brand)) return { label: `${/avi/.test(brand) ? 'AVIF' : 'HEIC/HEIF'} image (${brand})`, fam: 'image', ext: /avi/.test(brand) ? 'avif' : 'heic' };
    if (/^qt/.test(brand)) return { label: 'QuickTime video (MOV)', fam: 'media', ext: 'mov' };
    if (/M4A|M4B/.test(brand)) return { label: `MPEG-4 audio (${brand.trim()})`, fam: 'media', ext: 'm4a' };
    if (/crx/.test(brand)) return { label: 'Canon CR3 raw photo', fam: 'image', ext: 'cr3' };
    return { label: `MPEG-4 video (${brand.trim()})`, fam: 'media', ext: 'mp4' };
  }
  if (eq(0x49, 0x49, 0x2a, 0x00) || eq(0x4d, 0x4d, 0x00, 0x2a)) return { label: /cr2|nef|arw|dng|orf|rw2|pef|srw/.test(ext) ? `${ext.toUpperCase()} raw photo` : 'TIFF image', fam: 'image', ext: 'tif' };
  if (s4 === '%PDF') return { label: `PDF document (version ${ascii(b, 5, 8)})`, fam: 'pdf', ext: 'pdf' };
  if (eq(0x50, 0x4b, 0x03, 0x04) || eq(0x50, 0x4b, 0x05, 0x06)) return { label: 'ZIP-based file', fam: 'zip', ext: 'zip' };
  if (eq(0x1a, 0x45, 0xdf, 0xa3)) return { label: 'Matroska / WebM video', fam: 'media', ext: ext === 'webm' ? 'webm' : 'mkv' };
  if (s4 === 'OggS') return { label: 'Ogg audio/video', fam: 'media', ext: 'ogg' };
  if (s4 === 'fLaC') return { label: 'FLAC audio', fam: 'media', ext: 'flac' };
  if (ascii(b, 0, 3) === 'ID3' || (b[0] === 0xff && (b[1] & 0xe0) === 0xe0 && /mp3|mp2/.test(ext))) return { label: 'MP3 audio', fam: 'media', ext: 'mp3' };
  if (b[0] === 0xff && (b[1] & 0xf6) === 0xf0) return { label: 'AAC audio', fam: 'media', ext: 'aac' };
  if (s4 === 'wOFF') return { label: 'WOFF web font', fam: 'font', ext: 'woff' };
  if (s4 === 'wOF2') return { label: 'WOFF2 web font', fam: 'font2', ext: 'woff2' };
  if (eq(0, 1, 0, 0) || s4 === 'OTTO' || s4 === 'true') return { label: s4 === 'OTTO' ? 'OpenType font' : 'TrueType font', fam: 'font', ext: s4 === 'OTTO' ? 'otf' : 'ttf' };
  if (eq(0xd0, 0xcf, 0x11, 0xe0)) return { label: 'Legacy Microsoft Office file (DOC/XLS/PPT/MSG)', fam: 'other', ext };
  if (s4 === 'Rar!') return { label: 'RAR archive', fam: 'other', ext: 'rar' };
  if (eq(0x37, 0x7a, 0xbc, 0xaf)) return { label: '7-Zip archive', fam: 'other', ext: '7z' };
  if (ascii(b, 0, 2) === 'MZ') return { label: 'Windows program (EXE/DLL)', fam: 'other', ext: 'exe' };
  if (ascii(b, 0, 2) === 'BM') return { label: 'BMP image', fam: 'image', ext: 'bmp' };
  if (s12.startsWith('{\\rtf')) return { label: 'Rich Text document', fam: 'other', ext: 'rtf' };
  const text = ascii(b, 0, Math.min(b.length, 1024)).replace(/^﻿|^ï»¿/, '').trimStart().toLowerCase();
  if (/^<\?xml[^>]*>\s*(<!--[\s\S]*?-->\s*)*(<!doctype svg[^>]*>\s*)?<svg|^<svg/.test(text) || ext === 'svg') return { label: 'SVG vector image', fam: 'svg', ext: 'svg' };
  if (/^<!doctype html|^<html/.test(text) || /^html?$/.test(ext)) return { label: 'HTML page', fam: 'html', ext: 'html' };
  if (/^<\?xml/.test(text)) return { label: 'XML document', fam: 'svg', ext: 'xml' };
  return { label: 'Unknown / plain data', fam: 'other', ext };
}

async function fileGroup(file, kind) {
  const rows = [row('Name', file.name, false), row('Real type (from contents)', kind.label, false), row('Type reported by the system', file.type || 'unknown', false),
    row('Size', `${formatBytes(file.size)} (${file.size.toLocaleString()} bytes)`, false), row('Last modified (on this device)', new Date(file.lastModified).toLocaleString(), false)];
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  const same = { jpg: ['jpg', 'jpeg', 'jpe', 'jfif'], tif: ['tif', 'tiff', 'dng', 'cr2', 'nef', 'arw', 'orf', 'rw2', 'pef', 'srw'], zip: ['zip', 'docx', 'xlsx', 'pptx', 'docm', 'xlsm', 'pptm', 'odt', 'ods', 'odp', 'odg', 'epub', 'jar', 'apk', 'xpi', 'kmz', 'cbz', 'ipa', 'aar', '3mf', 'vsdx'], mp4: ['mp4', 'm4v', 'mov', '3gp'], heic: ['heic', 'heif', 'hif'], mkv: ['mkv', 'webm'], webm: ['webm', 'mkv'], ogg: ['ogg', 'oga', 'ogv', 'opus'], html: ['html', 'htm', 'xhtml'], svg: ['svg', 'xml', 'svgz'], xml: ['xml', 'svg', 'rss', 'atom', 'plist', 'kml', 'gpx'], ttf: ['ttf', 'otf'], otf: ['otf', 'ttf'] };
  if (kind.ext && ext && !(same[kind.ext] || [kind.ext]).includes(ext) && kind.fam !== 'other') rows.push(row('⚠️ Extension mismatch', `The name ends in .${ext} but the contents are ${kind.label}.`, true));
  if (file.size <= 1.5e9 && crypto.subtle) {
    const buf = await file.arrayBuffer();
    const hex = (h) => [...new Uint8Array(h)].map((x) => x.toString(16).padStart(2, '0')).join('');
    rows.push(row('SHA-256', hex(await crypto.subtle.digest('SHA-256', buf)), false), row('SHA-1', hex(await crypto.subtle.digest('SHA-1', buf)), false));
  }
  return group('File', rows);
}

/* ---------------------------------------------------------------- images */

async function readImage(file, kind) {
  const groups = [];
  const exifr = await loadLib('exifr');
  let parsed = {};
  try {
    parsed = await exifr.parse(file, { tiff: true, exif: true, gps: true, interop: true, ifd1: true, iptc: true, xmp: true, icc: true, jfif: true, ihdr: true,
      makerNote: true, userComment: true, multiSegment: true, translateKeys: true, translateValues: true, reviveValues: true, sanitize: true, mergeOutput: false }) || {};
  } catch (_) { parsed = {}; }
  let dims = '';
  try { const b = await decodeImage(file); dims = `${b.width || b.naturalWidth} × ${b.height || b.naturalHeight} px`; if (b.close) b.close(); } catch (_) { dims = 'Your browser can\'t display this format'; }
  groups.push(group('Image', [row('Dimensions', dims, false)]));

  let gps = null;
  try { gps = await exifr.gps(file); } catch (_) { /* ignore */ }
  if (gps && Number.isFinite(gps.latitude)) {
    const lat = gps.latitude.toFixed(6), lon = gps.longitude.toFixed(6);
    groups.push(group('⚠️ Location (GPS)', [row('Latitude', lat, true), row('Longitude', lon, true), row('Map', `<a href="https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=16/${lat}/${lon}" target="_blank" rel="noopener nofollow">Open in OpenStreetMap ↗</a>`, true, true)], true));
  }
  // embedded thumbnail: can show the photo before it was cropped or edited
  try {
    const th = await exifr.thumbnail(file);
    if (th && th.byteLength > 100) groups.push(group('⚠️ Embedded thumbnail', [imgRow('Preview stored inside the file', new Blob([th], { type: 'image/jpeg' }), 'Cameras and editors store a small copy of the photo. After cropping or blurring, it can still show the original.')], true));
  } catch (_) { /* none */ }

  const names = { ifd0: 'Camera & image (TIFF)', exif: 'Exposure & capture (EXIF)', gps: 'GPS details', interop: 'Interoperability', ifd1: 'Thumbnail info', iptc: 'IPTC (captions, credits, keywords)', xmp: 'XMP (editing software & history)', icc: 'Colour profile (ICC)', jfif: 'JFIF', ihdr: 'PNG header', makerNote: 'Maker notes (camera-specific)' };
  for (const [key, obj] of Object.entries(parsed)) {
    if (!obj || typeof obj !== 'object') continue;
    const rows = [];
    const walk = (o, prefix) => {
      for (const [k, v] of Object.entries(o)) {
        if (v === undefined || v === '' || (key === 'gps' && /^(latitude|longitude)$/i.test(k))) continue;
        const label = prefix ? `${prefix} › ${human(k)}` : human(k);
        if (v && typeof v === 'object' && !Array.isArray(v) && !(v instanceof Date) && !ArrayBuffer.isView(v) && Object.keys(v).length && rows.length < 400) walk(v, label);
        else rows.push(row(label, v, key !== 'icc' && SENSITIVE.test(`${label}`)));
      }
    };
    walk(obj, '');
    if (rows.length) groups.push(group(names[key] || human(key), rows));
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (kind.ext === 'jpg') groups.push(...jpegStructure(bytes));
  if (kind.ext === 'png') groups.push(...await pngStructure(bytes));
  // AI / provenance markers anywhere in the file
  const text = ascii(bytes, 0, Math.min(bytes.length, 4 * 1024 * 1024));
  const ai = [];
  if (/c2pa|jumb|contentauth/i.test(text)) ai.push(row('Content Credentials (C2PA)', 'Present. A signed record of how the image was made or edited (camera, AI generator, editing apps).', true));
  const dst = text.match(/DigitalSourceType[^>]*?(trainedAlgorithmicMedia|compositeWithTrainedAlgorithmicMedia|algorithmicMedia|digitalCapture|compositeSynthetic)/i);
  if (dst) ai.push(row('Digital source type', /algorithmic|synthetic/i.test(dst[1]) ? `${dst[1]}: declared as AI-generated or AI-edited` : dst[1], true));
  for (const tool of ['DALL-E', 'DALL·E', 'Midjourney', 'Stable Diffusion', 'Adobe Firefly', 'Firefly', 'ComfyUI', 'Automatic1111', 'NovelAI', 'Imagen', 'Ideogram', 'Leonardo', 'GPT-4o', 'OpenAI', 'Gemini']) {
    if (text.includes(tool)) { ai.push(row('Mentions AI tool', tool, true)); break; }
  }
  if (ai.length) groups.push(group('⚠️ AI & provenance', ai, true));
  return { kind: 'image', groups, gps };
}

function jpegStructure(b) {
  const segs = [], comments = [];
  const names = { 0xe0: 'APP0 (JFIF)', 0xe1: 'APP1 (EXIF / XMP)', 0xe2: 'APP2 (ICC / FlashPix / MPF)', 0xeb: 'APP11 (JUMBF / C2PA)', 0xec: 'APP12 (Ducky)', 0xed: 'APP13 (Photoshop / IPTC)', 0xee: 'APP14 (Adobe)', 0xfe: 'COM (comment)' };
  let i = 2;
  while (i + 4 < b.length && b[i] === 0xff) {
    const m = b[i + 1]; if (m === 0xda || m === 0xd9) break;
    const len = (b[i + 2] << 8) | b[i + 3];
    if (m >= 0xe0 && m <= 0xef || m === 0xfe) segs.push(`${names[m] || `APP${m - 0xe0}`}: ${formatBytes(len)}`);
    if (m === 0xfe) comments.push(new TextDecoder().decode(b.subarray(i + 4, i + 2 + len)).replace(/\0+$/, ''));
    i += 2 + len;
  }
  const out = [group('File structure (JPEG segments)', segs.map((s, k) => row(`Segment ${k + 1}`, s, /COM|APP13|APP11/.test(s))))];
  if (comments.length) out.push(group('⚠️ Comments', comments.map((c, k) => row(`Comment ${k + 1}`, c, true)), true));
  return out;
}

async function inflate(data) {
  for (const fmt of ['deflate', 'deflate-raw']) {
    try { const ds = new DecompressionStream(fmt); const w = ds.writable.getWriter(); w.write(data); w.close(); return new Uint8Array(await new Response(ds.readable).arrayBuffer()); } catch (_) { /* try next */ }
  }
  return new Uint8Array();
}

async function pngStructure(b) {
  const chunks = [], texts = [];
  let i = 8;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  while (i + 8 <= b.length) {
    const len = dv.getUint32(i), type = ascii(b, i + 4, i + 8), data = b.subarray(i + 8, i + 8 + len);
    chunks.push(`${type}: ${formatBytes(len)}`);
    if (type === 'tEXt') { const z = data.indexOf(0); texts.push([ascii(data, 0, z), new TextDecoder('latin1').decode(data.subarray(z + 1))]); }
    if (type === 'zTXt') { const z = data.indexOf(0); texts.push([ascii(data, 0, z), new TextDecoder().decode(await inflate(data.subarray(z + 2)))]); }
    if (type === 'iTXt') {
      const z = data.indexOf(0), comp = data[z + 1]; let p = z + 3;
      p = data.indexOf(0, p) + 1; p = data.indexOf(0, p) + 1;   // language tag, translated keyword
      const body = data.subarray(p);
      texts.push([ascii(data, 0, z), new TextDecoder().decode(comp ? await inflate(body) : body)]);
    }
    if (type === 'IEND') break;
    i += 12 + len;
  }
  const out = [group('File structure (PNG chunks)', chunks.slice(0, 60).map((c, k) => row(`Chunk ${k + 1}`, c, /tEXt|zTXt|iTXt|eXIf|caBX/.test(c))))];
  const tx = texts.filter(([k]) => k !== 'XML:com.adobe.xmp');
  if (tx.length) out.push(group('⚠️ Text stored in the image', tx.map(([k, v]) => row(/^parameters$|^prompt$|^workflow$/i.test(k) ? `${k} (AI generation settings)` : k, v.length > 3000 ? `${v.slice(0, 3000)}…` : v, true)), true));
  return out;
}

/* ---------------------------------------------------------------- PDF */

async function readPdf(file) {
  const R = await loadLib('pdflib');
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await R.PDFDocument.load(bytes, { ignoreEncryption: true, updateMetadata: false, throwOnInvalidObject: false });
  const ctx = doc.context, N = (n) => R.PDFName.of(n);
  const look = (o) => (o instanceof R.PDFRef ? ctx.lookup(o) : o);
  const str = (o) => { o = look(o); if (!o) return ''; if (o instanceof R.PDFString || o instanceof R.PDFHexString) { try { return o.decodeText(); } catch (_) { return o.asString(); } } if (o instanceof R.PDFName) return o.decodeText ? o.decodeText() : o.asString(); if (o instanceof R.PDFNumber) return String(o.asNumber()); if (o instanceof R.PDFBool) return String(o.asBoolean ? o.asBoolean() : o); return o.toString(); };
  const pdfDate = (s) => { const m = /D:(\d{4})(\d\d)?(\d\d)?(\d\d)?(\d\d)?(\d\d)?([Z+-])?(\d\d)?'?(\d\d)?/.exec(s); if (!m) return s; const d = new Date(Date.UTC(+m[1], (+m[2] || 1) - 1, +m[3] || 1, +m[4] || 0, +m[5] || 0, +m[6] || 0)); let off = 0; if (m[7] === '+' || m[7] === '-') off = (m[7] === '+' ? 1 : -1) * ((+m[8] || 0) * 60 + (+m[9] || 0)); return `${new Date(d.getTime() - off * 60000).toLocaleString()} (time zone UTC${m[7] === 'Z' || !m[7] ? '' : `${m[7]}${m[8]}:${m[9] || '00'}`})`; };
  const groups = [];
  const head = ascii(bytes, 0, 16).match(/%PDF-(\d\.\d)/);
  const eofs = (ascii(bytes, 0, bytes.length).match(/%%EOF/g) || []).length;
  const pages = doc.getPages();
  const sizes = new Map(); pages.forEach((p) => { const { width, height } = p.getSize(); const k = `${Math.round(width)} × ${Math.round(height)} pt (${(width / 72 * 25.4).toFixed(0)} × ${(height / 72 * 25.4).toFixed(0)} mm)`; sizes.set(k, (sizes.get(k) || 0) + 1); });
  const trailer = ctx.trailerInfo;
  const idArr = look(trailer.ID);
  const docId = idArr && idArr.asArray ? idArr.asArray().map((x) => (x.asString ? x.asString() : String(x)).replace(/[<>]/g, '')).join(' / ') : '';
  const enc = look(trailer.Encrypt);
  groups.push(group('Document', [
    row('PDF version', head ? head[1] : '', false), row('Pages', pages.length, false),
    ...[...sizes].map(([k, n]) => row(n === pages.length ? 'Page size' : `Page size (${n} pages)`, k, false)),
    row('Objects', ctx.enumerateIndirectObjects().length, false),
    row('Saved versions (incremental updates)', eofs > 1 ? `${eofs}. Earlier versions of this document may still be recoverable from the file.` : '1', eofs > 1),
    row('File identifier', docId, true), row('Language', str(doc.catalog.get(N('Lang'))), false),
    row('Tagged (accessible)', doc.catalog.get(N('MarkInfo')) ? 'Yes' : 'No', false),
    row('Encrypted', enc ? `Yes (${str(enc.get(N('Filter')))}, revision ${str(enc.get(N('R')))})` : 'No', false)
  ]));

  const info = look(trailer.Info);
  if (info && info.entries) {
    const rows = info.entries().map(([k, v]) => { const key = k.decodeText ? k.decodeText() : k.asString().slice(1); let val = str(v); if (/Date$/.test(key)) val = pdfDate(val); return row(key === 'ModDate' ? 'Modified' : key === 'CreationDate' ? 'Created' : key, val, /Author|Creator|Producer|Company|Manager|SourceModified|Owner/i.test(key) || !/^(Title|Subject|Keywords|Trapped|CreationDate|ModDate)$/.test(key)); });
    groups.push(group('Document properties (Info)', rows.length ? rows : [row('—', 'None set', false)]));
  }

  const md = look(doc.catalog.get(N('Metadata')));
  if (md) {
    try {
      const xml = new TextDecoder().decode(md instanceof R.PDFRawStream ? R.decodePDFRawStream(md).decode() : md.getContents());
      groups.push(group('XMP metadata', xmpRows(xml)));
    } catch (_) { groups.push(group('XMP metadata', [row('XMP stream', 'Present (could not be decoded)', true)])); }
  }

  // walk every object once
  const fonts = new Map(), images = [], uris = new Set(), annotCounts = new Map(), comments = [], fields = [], files = [], layers = [];
  let js = false, pieceInfo = false, thumbs = 0, sigs = 0, xfa = false;
  for (const [, o] of ctx.enumerateIndirectObjects()) {
    const d = o instanceof R.PDFDict ? o : o && o.dict instanceof R.PDFDict ? o.dict : null;
    if (!d) continue;
    const type = str(d.get(N('Type'))).replace('/', ''), sub = str(d.get(N('Subtype'))).replace('/', '');
    if (type === 'Font' && d.get(N('BaseFont'))) {
      const name = str(d.get(N('BaseFont'))).replace('/', ''), fd = look(d.get(N('FontDescriptor')));
      const embedded = fd && fd.get && (fd.get(N('FontFile')) || fd.get(N('FontFile2')) || fd.get(N('FontFile3')));
      const clean = name.replace(/^[A-Z]{6}\+/, '');
      if (sub !== 'Type0' || !fonts.has(clean)) fonts.set(clean, `${sub}${embedded ? ', embedded' : sub === 'Type0' ? '' : ', not embedded'}${/^[A-Z]{6}\+/.test(name) ? ' (subset)' : ''}`);
    }
    if (sub === 'Image' && o.dict) images.push(`${str(d.get(N('Width')))}×${str(d.get(N('Height')))} ${str(d.get(N('Filter'))).replace(/[/[\]]/g, '') || 'raw'}`);
    if (type === 'Annot' || d.get(N('Rect')) && d.get(N('Subtype')) && !type) {
      if (sub) annotCounts.set(sub, (annotCounts.get(sub) || 0) + 1);
      const A = look(d.get(N('A')));
      if (A && A.get && A.get(N('URI'))) uris.add(str(A.get(N('URI'))));
      if (A && A.get && /JavaScript/.test(str(A.get(N('S'))))) js = true;
      if (d.get(N('T')) && sub !== 'Widget') comments.push(`${str(d.get(N('T')))}${d.get(N('Contents')) ? `: ${str(d.get(N('Contents'))).slice(0, 200)}` : ''}`);
    }
    if (d.get(N('FT'))) { const ft = str(d.get(N('FT'))).replace('/', ''); if (ft === 'Sig') sigs++; fields.push(`${str(d.get(N('T')))} (${ft})${d.get(N('V')) && ft !== 'Sig' ? ` = ${str(d.get(N('V'))).slice(0, 120)}` : ''}`); }
    if (type === 'Filespec' || d.get(N('EF'))) files.push(`${str(d.get(N('UF')) || d.get(N('F')))}${d.get(N('Desc')) ? ` (${str(d.get(N('Desc')))})` : ''}`);
    if (type === 'OCG') layers.push(str(d.get(N('Name'))));
    if (/JavaScript/.test(str(d.get(N('S')))) || d.get(N('JS'))) js = true;
    if (d.get(N('PieceInfo'))) pieceInfo = true;
    if (d.get(N('Thumb'))) thumbs++;
  }
  const af = look(doc.catalog.get(N('AcroForm')));
  if (af && af.get && af.get(N('XFA'))) xfa = true;
  const names = look(doc.catalog.get(N('Names')));
  if (names && names.get && names.get(N('JavaScript'))) js = true;
  const sec = [];
  if (js) sec.push(row('JavaScript', 'Yes: this PDF contains scripts that can run when opened', true));
  if (files.length) sec.push(row('Attached files', files.join('\n'), true));
  if (xfa) sec.push(row('XFA form', 'Yes (dynamic form)', false));
  if (sigs) sec.push(row('Digital signatures', `${sigs} signature field${sigs > 1 ? 's' : ''}`, true));
  if (pieceInfo) sec.push(row('Private application data (PieceInfo)', 'Yes: hidden data saved by Illustrator, Photoshop or other editors', true));
  if (thumbs) sec.push(row('Page thumbnails stored', thumbs, false));
  if (sec.length) groups.push(group('⚠️ Hidden content & security', sec, sec.some((r) => r[2])));
  if (fonts.size) groups.push(group(`Fonts (${fonts.size})`, [...fonts].sort().map(([n, d]) => row(n, d, false))));
  const area = (s) => { const [w, h] = s.split(' ')[0].split('×').map(Number); return (w || 0) * (h || 0); };
  if (images.length) groups.push(group(`Images (${images.length})`, [row('Largest', images.slice().sort((a, b) => area(b) - area(a))[0], false), row('All', images.slice(0, 40).join(', '), false)]));
  if (annotCounts.size || uris.size || comments.length) groups.push(group('Annotations & links', [...[...annotCounts].map(([k, n]) => row(`${k} annotations`, n, false)), ...[...uris].slice(0, 40).map((u, k) => row(`Link ${k + 1}`, u, false)), ...comments.slice(0, 40).map((c, k) => row(`Comment ${k + 1} (author: text)`, c, true))]));
  if (fields.length) groups.push(group(`Form fields (${fields.length})`, fields.slice(0, 60).map((f, k) => row(`Field ${k + 1}`, f, /=/.test(f)))));
  if (layers.length) groups.push(group('Layers', layers.map((l, k) => row(`Layer ${k + 1}`, l, false))));
  return { kind: 'pdf', groups };
}

function xmpRows(xml) {
  const dom = new DOMParser().parseFromString(xml.replace(/^[^<]*/, ''), 'application/xml');
  const rows = [];
  const walk = (el, path) => {
    for (const a of el.attributes || []) if (!/^xmlns|^rdf:|^x:xmptk|^xml:/.test(a.name)) rows.push(row(path ? `${path} › ${a.name}` : a.name, a.value));
    const kids = [...el.children];
    if (!kids.length && el.textContent.trim() && !/^rdf:/.test(el.tagName)) rows.push(row(path || el.tagName, el.textContent.trim()));
    if (!kids.length && el.textContent.trim() && /^rdf:li$/.test(el.tagName)) rows.push(row(path, el.textContent.trim()));
    for (const k of kids) {
      const name = /^(rdf:|x:xmpmeta)/.test(k.tagName) ? path : path ? `${path} › ${k.tagName}` : k.tagName;
      walk(k, name);
    }
  };
  walk(dom.documentElement, '');
  return rows.slice(0, 400);
}

/* ---------------------------------------------------------------- Office, OpenDocument, EPUB, ZIP */

const xmlDoc = (t) => new DOMParser().parseFromString(t, 'application/xml');
const leafRows = (dom, sensAll) => [...dom.documentElement.children].filter((e) => !e.children.length && e.textContent.trim()).map((e) => row(e.tagName.replace(/^\w+:/, ''), /date|created|modified|printed/i.test(e.tagName) && !isNaN(Date.parse(e.textContent)) ? new Date(e.textContent).toLocaleString() : e.textContent.trim(), sensAll || undefined));

async function readZip(file) {
  const JSZip = await loadLib('jszip');
  const zip = await JSZip.loadAsync(file);
  const names = Object.keys(zip.files);
  const has = (n) => !!zip.file(n);
  const text = async (n) => (zip.file(n) ? zip.file(n).async('string') : '');
  const groups = [];
  const authorsIn = (xml, re) => { const s = new Map(); for (const m of xml.matchAll(re)) s.set(m[1], (s.get(m[1]) || 0) + 1); return s; };
  let kind = 'zip';

  if (has('[Content_Types].xml')) {   // Office Open XML
    kind = 'ooxml';
    const app = names.find((n) => /^word\//.test(n)) ? 'Word document' : names.find((n) => /^xl\//.test(n)) ? 'Excel workbook' : names.find((n) => /^ppt\//.test(n)) ? 'PowerPoint presentation' : names.find((n) => /^visio\//.test(n)) ? 'Visio drawing' : 'Office document';
    groups.push(group('Office document', [row('Kind', app, false), row('Macros (VBA)', names.some((n) => /vbaProject\.bin$/i.test(n)) ? 'Yes: contains macros' : 'No', names.some((n) => /vbaProject\.bin$/i.test(n)))]));
    if (has('docProps/core.xml')) groups.push(group('Core properties (author, dates)', leafRows(xmlDoc(await text('docProps/core.xml'))).map((r) => (/creator|lastModifiedBy|lastPrinted|revision/i.test(r[0]) ? [r[0], r[1], true, false] : r))));
    if (has('docProps/app.xml')) {
      const rows = leafRows(xmlDoc(await text('docProps/app.xml'))).map((r) => (r[0] === 'TotalTime' ? [`Total editing time`, `${r[1]} minutes`, true, false] : r));
      groups.push(group('Application properties', rows));
    }
    if (has('docProps/custom.xml')) {
      const dom = xmlDoc(await text('docProps/custom.xml'));
      groups.push(group('⚠️ Custom properties', [...dom.getElementsByTagName('*')].filter((e) => e.localName === 'property').map((e) => row(e.getAttribute('name'), e.textContent.trim(), true)), true));
    }
    const people = [];
    for (const n of names.filter((x) => /(comments|commentsExtended|commentsIds|people|document|threadedComment\d*|commentAuthors|persons\/person)\.xml$|\/comments\d*\.xml$|\/threadedComments\/|\/persons\//.test(x))) {
      const xml = await text(n);
      const a = authorsIn(xml, /(?:w:author|author|displayName|name)="([^"]{1,80})"/g);
      const tagA = authorsIn(xml, /<author>([^<]{1,80})<\/author>/g);
      const role = /comment/i.test(n) ? 'Comment author' : /people|person/i.test(n) ? 'Person' : 'Tracked-change author';
      for (const [who, c] of [...a, ...tagA]) people.push(row(`${role} (${n.split('/').pop()})`, `${who}${c > 1 ? ` (${c}×)` : ''}`, true));
      const emails = new Set([...xml.matchAll(/userId="([^"]+@[^"]+)"/g)].map((m) => m[1]));
      emails.forEach((e) => people.push(row('Account (e-mail)', e, true)));
    }
    if (people.length) groups.push(group('⚠️ People: comment & revision authors', people.slice(0, 80), true));
    if (has('word/document.xml')) {
      const d = await text('word/document.xml');
      const ins = (d.match(/<w:ins\b/g) || []).length, del = (d.match(/<w:del\b/g) || []).length, com = (d.match(/<w:commentReference/g) || []).length;
      const rsids = (await text('word/settings.xml')).match(/<w:rsid\b/g) || [];
      groups.push(group('Word content', [row('Tracked insertions', ins, ins > 0), row('Tracked deletions (deleted text is still in the file)', del, del > 0), row('Comments', com, com > 0), row('Editing sessions (revision IDs)', rsids.length, false), row('Hidden text runs', (d.match(/<w:vanish\/>/g) || []).length, (d.match(/<w:vanish\/>/g) || []).length > 0)]));
    }
    if (has('xl/workbook.xml')) {
      const wb = await text('xl/workbook.xml');
      const sheets = [...wb.matchAll(/<sheet\b[^>]*name="([^"]+)"[^>]*?(?:state="(\w+)")?[^>]*\/>/g)].map((m) => row(`Sheet: ${m[1]}`, m[2] ? `${m[2]} ⚠️` : 'visible', !!m[2]));
      const defined = [...wb.matchAll(/<definedName[^>]*name="([^"]+)"[^>]*>([^<]*)</g)].map((m) => row(`Named range ${m[1]}`, m[2], false));
      groups.push(group('Workbook', [...sheets, ...defined.slice(0, 30), row('Data connections', has('xl/connections.xml') ? 'Yes: links to external data sources' : '', true)]));
    }
    if (has('ppt/presentation.xml')) {
      const slides = names.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n));
      let hidden = 0; for (const s of slides) if (/<p:sld[^>]*show="0"/.test(await text(s))) hidden++;
      const notes = names.filter((n) => /^ppt\/notesSlides\/notesSlide\d+\.xml$/.test(n)).length;
      groups.push(group('Presentation', [row('Slides', slides.length, false), row('Hidden slides', hidden, hidden > 0), row('Slides with speaker notes', notes, notes > 0)]));
    }
    const ext = [];
    for (const n of names.filter((x) => /\.rels$/.test(x))) for (const m of (await text(n)).matchAll(/Target="([^"]+)"[^>]*TargetMode="External"|TargetMode="External"[^>]*Target="([^"]+)"/g)) ext.push(m[1] || m[2]);
    const tmpl = (await text('word/_rels/settings.xml.rels')).match(/attachedTemplate[^>]*Target="([^"]+)"/);
    if (ext.length || tmpl) groups.push(group('⚠️ External links & file paths', [...(tmpl ? [row('Attached template', tmpl[1], true)] : []), ...[...new Set(ext)].slice(0, 50).map((u, k) => row(`Link ${k + 1}`, decodeURIComponent(u), /^file:|^\\\\|[A-Z]:\\|\/Users\/|\/home\//i.test(u)))], true));
    const media = names.filter((n) => /\/(media|embeddings)\//.test(n));
    if (media.length) groups.push(group(`Embedded files & media (${media.length})`, media.slice(0, 60).map((n) => row(n.split('/').slice(-2).join('/'), formatBytes(zip.files[n]._data ? zip.files[n]._data.uncompressedSize : 0), /embeddings/.test(n)))));
    if (names.some((n) => /printerSettings/.test(n))) groups.push(group('Printer settings', [row('Printer settings stored', 'Yes: may include the printer name', true)]));
    const thumb = names.find((n) => /^docProps\/thumbnail\.(jpe?g|png|wmf|emf)$/i.test(n));
    if (thumb && /jpe?g|png/i.test(thumb)) groups.push(group('⚠️ Embedded thumbnail', [imgRow('Preview of the first page', await zip.file(thumb).async('blob'))], true));
  } else if (has('meta.xml') || has('mimetype') && /opendocument/.test(await text('mimetype'))) {   // OpenDocument
    kind = 'odf';
    const mt = await text('mimetype');
    const dom = xmlDoc(await text('meta.xml'));
    const meta = [...dom.getElementsByTagName('*')].find((e) => e.localName === 'meta');
    const rows = [row('Kind', mt || 'OpenDocument', false)];
    if (meta) for (const e of meta.children) {
      if (e.localName === 'document-statistic') { for (const a of e.attributes) rows.push(row(human(a.localName), a.value, false)); continue; }
      if (e.localName === 'user-defined') { rows.push(row(`Custom: ${e.getAttribute('meta:name')}`, e.textContent, true)); continue; }
      if (e.localName === 'editing-duration') { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:([\d.]+)S)?/.exec(e.textContent) || []; rows.push(row('Total editing time', `${(+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0)} minutes`, true)); continue; }
      rows.push(row(human(e.localName), /date/.test(e.localName) ? new Date(e.textContent).toLocaleString() : e.textContent, /creator|generator|editing|printed/i.test(e.localName) || undefined));
    }
    groups.push(group('OpenDocument metadata', rows));
    const th = names.find((n) => /^Thumbnails\/thumbnail\.png$/.test(n));
    if (th) groups.push(group('⚠️ Embedded thumbnail', [imgRow('Preview of the first page', await zip.file(th).async('blob'))], true));
  } else if (has('META-INF/container.xml')) {   // EPUB
    kind = 'epub';
    const opfPath = ((await text('META-INF/container.xml')).match(/full-path="([^"]+)"/) || [])[1];
    const dom = opfPath ? xmlDoc(await text(opfPath)) : null;
    const md = dom && [...dom.getElementsByTagName('*')].find((e) => e.localName === 'metadata');
    if (md) groups.push(group('E-book metadata', [...md.children].map((e) => row(e.getAttribute('property') || e.getAttribute('name') || e.tagName.replace(/^dc:/, ''), e.textContent.trim() || e.getAttribute('content') || '', /creator|contributor|publisher|rights|identifier/i.test(e.tagName) || undefined))));
  }
  // every ZIP: entries, dates, comment
  const entries = names.map((n) => zip.files[n]).filter((f) => !f.dir);
  const dates = entries.map((f) => f.date).filter((d) => d && d.getFullYear() > 1981).sort((a, b) => a - b);
  const total = entries.reduce((a, f) => a + (f._data ? f._data.uncompressedSize : 0), 0);
  groups.push(group(`Archive contents (${entries.length} files)`, [
    row('Uncompressed size', formatBytes(total), false),
    row('Oldest file date', dates[0] ? dates[0].toLocaleString() : '', true), row('Newest file date', dates.length ? dates[dates.length - 1].toLocaleString() : '', true),
    row('Archive comment', zip.comment || '', true),
    ...entries.slice(0, kind === 'zip' ? 80 : 25).map((f) => row(f.name, `${formatBytes(f._data ? f._data.uncompressedSize : 0)}${f.date && f.date.getFullYear() > 1981 ? ` · ${f.date.toLocaleString()}` : ''}${f.comment ? ` · ${f.comment}` : ''}`, false))
  ]));
  return { kind, groups, zip };
}

/* ---------------------------------------------------------------- SVG / XML / HTML */

async function readMarkup(file, fam) {
  const t = await file.text();
  const groups = [];
  const comments = [...t.matchAll(/<!--([\s\S]*?)-->/g)].map((m) => m[1].trim()).filter(Boolean);
  if (fam === 'html') {
    const dom = new DOMParser().parseFromString(t, 'text/html');
    const rows = [row('Title', dom.title, false), row('Language', dom.documentElement.lang, false)];
    dom.querySelectorAll('meta[name],meta[property],meta[http-equiv]').forEach((m) => rows.push(row(m.getAttribute('name') || m.getAttribute('property') || m.getAttribute('http-equiv'), m.getAttribute('content'))));
    const scripts = [...dom.querySelectorAll('script[src]')].map((s) => s.getAttribute('src'));
    groups.push(group('Page metadata', rows));
    if (scripts.length) groups.push(group('External scripts', scripts.slice(0, 40).map((s, k) => row(`Script ${k + 1}`, s, false))));
  } else {
    const dom = new DOMParser().parseFromString(t, 'image/svg+xml');
    const root = dom.documentElement, rows = [];
    for (const a of root.attributes) if (/^(sodipodi|inkscape):|^(version|width|height|viewBox|id)$/.test(a.name)) rows.push(row(a.name, a.value, /docname|export|version/i.test(a.name)));
    dom.querySelectorAll('*').forEach((e) => { for (const a of e.attributes) if (/export-filename|export-xdpi|sodipodi:docname|absref/.test(a.name)) rows.push(row(`${e.tagName} ${a.name}`, a.value, true)); });
    groups.push(group('Document', [row('Elements', dom.getElementsByTagName('*').length, false), row('Embedded raster images', (t.match(/data:image\//g) || []).length, false), ...rows]));
    const md = [...dom.getElementsByTagName('*')].filter((e) => e.localName === 'metadata' || e.localName === 'title' || e.localName === 'desc');
    const mrows = [];
    md.forEach((m) => { if (m.localName !== 'metadata') { mrows.push(row(m.localName, m.textContent.trim())); return; } m.querySelectorAll('*').forEach((e) => { if (!e.children.length && e.textContent.trim()) mrows.push(row(e.tagName, e.textContent.trim())); for (const a of e.attributes) if (/resource|about/.test(a.name) && a.value) mrows.push(row(`${e.tagName} ${a.name}`, a.value, false)); }); });
    if (mrows.length) groups.push(group('Metadata', mrows));
  }
  if (comments.length) groups.push(group('⚠️ Comments in the file', comments.slice(0, 30).map((c, k) => row(`Comment ${k + 1}`, c.slice(0, 500), /generator|illustrator|inkscape|figma|sketch|created|author|by /i.test(c))), true));
  return { kind: fam, groups, text: t };
}

/* ---------------------------------------------------------------- fonts */

async function readFont(file, kind) {
  let b = new Uint8Array(await file.arrayBuffer());
  const tables = new Map();
  const dv = () => new DataView(b.buffer, b.byteOffset, b.byteLength);
  if (kind.ext === 'woff') {
    const d = dv(), num = d.getUint16(12);
    for (let i = 0; i < num; i++) {
      const o = 44 + i * 20, tag = ascii(b, o, o + 4), off = d.getUint32(o + 4), comp = d.getUint32(o + 8), orig = d.getUint32(o + 12);
      tables.set(tag, comp < orig ? await inflate(b.subarray(off, off + comp)) : b.subarray(off, off + orig));
    }
  } else {
    const d = dv(), num = d.getUint16(4);
    for (let i = 0; i < num; i++) { const o = 12 + i * 16; tables.set(ascii(b, o, o + 4), b.subarray(d.getUint32(o + 8), d.getUint32(o + 8) + d.getUint32(o + 12))); }
  }
  const names = ['Copyright', 'Family', 'Style', 'Unique ID', 'Full name', 'Version', 'PostScript name', 'Trademark', 'Manufacturer', 'Designer', 'Description', 'Vendor URL', 'Designer URL', 'License', 'License URL', '', 'Typographic family', 'Typographic style', 'Compatible full name', 'Sample text'];
  const rows = [], seen = new Set();
  const nt = tables.get('name');
  if (nt) {
    b = nt; const d = dv(), count = d.getUint16(2), strOff = d.getUint16(4);
    for (let i = 0; i < count; i++) {
      const o = 6 + i * 12, pid = d.getUint16(o), id = d.getUint16(o + 6), len = d.getUint16(o + 8), off = d.getUint16(o + 10);
      const raw = b.subarray(strOff + off, strOff + off + len);
      const s = pid === 3 || pid === 0 ? new TextDecoder('utf-16be').decode(raw) : ascii(raw);
      const key = names[id] || `Name ${id}`;
      if (!s.trim() || seen.has(key)) continue; seen.add(key);
      rows.push(row(key, s, /Manufacturer|Designer|License|Unique ID|Vendor/i.test(key)));
    }
  }
  return { kind: 'font', groups: [group('Font naming table', rows.length ? rows : [row('—', 'No naming table found', false)]), group('Tables', [row('Tables', [...tables.keys()].join(', '), false)])] };
}

/* ---------------------------------------------------------------- audio & video */

async function readMedia(file) {
  const MB = await loadMediabunny();
  const input = new MB.Input({ source: new MB.BlobSource(file), formats: MB.ALL_FORMATS });
  const [mime, dur, tags] = await Promise.all([input.getMimeType().catch(() => file.type), input.computeDuration().catch(() => NaN), input.getMetadataTags().catch(() => ({}))]);
  const tracks = await input.getTracks();
  const groups = [group('Media', [row('Container', mime, false), row('Duration', Number.isFinite(dur) ? fmtTime(dur) : 'unknown', false), row('Overall bitrate', Number.isFinite(dur) && dur > 0 ? `${Math.round(file.size * 8 / dur / 1000)} kb/s` : '', false), row('Tracks', tracks.length, false)])];
  for (const t of tracks) {
    const rows = [row('Codec', t.codec || 'unknown', false), row('Language', t.languageCode && t.languageCode !== 'und' ? t.languageCode : '', false)];
    try { if (t.getCodecParameterString) rows.push(row('Codec string', await t.getCodecParameterString(), false)); } catch (_) { /* ignore */ }
    try {
      const st = await t.computePacketStats(120);
      if (st.averageBitrate) rows.push(row('Bitrate (approx.)', `${Math.round(st.averageBitrate / 1000)} kb/s`, false));
      if (t.isVideoTrack() && st.averagePacketRate) rows.push(row('Frame rate (approx.)', `${st.averagePacketRate.toFixed(2)} fps`, false));
    } catch (_) { /* ignore */ }
    if (t.isVideoTrack()) rows.push(row('Resolution', `${t.displayWidth} × ${t.displayHeight}`, false), row('Coded size', `${t.codedWidth} × ${t.codedHeight}`, false), row('Rotation', `${t.rotation}°`, false));
    if (t.isAudioTrack()) rows.push(row('Sample rate', `${t.sampleRate} Hz`, false), row('Channels', t.numberOfChannels, false));
    groups.push(group(`${t.isVideoTrack() ? 'Video' : t.isAudioTrack() ? 'Audio' : 'Other'} track ${t.id ?? ''}`, rows));
  }
  const tagRows = Object.entries(tags || {}).filter(([k, v]) => v != null && k !== 'raw' && k !== 'images').map(([k, v]) => row(human(k), v, SENSITIVE.test(k) || /date|comment|description/i.test(k)));
  if (tags && tags.raw) for (const [k, v] of Object.entries(tags.raw).slice(0, 200)) if (v != null) tagRows.push(row(k, v instanceof Uint8Array ? `${v.length} bytes` : typeof v === 'object' ? JSON.stringify(v).slice(0, 300) : v, SENSITIVE.test(k) || /location|xyz|©xyz|make|model|software|encoder|handler|com\.apple|com\.android/i.test(k)));
  if (tags && tags.images && tags.images.length) tags.images.slice(0, 3).forEach((im, k) => tagRows.push(imgRow(`Embedded picture ${k + 1}${im.kind ? ` (${im.kind})` : ''}`, new Blob([im.data], { type: im.mimeType || 'image/jpeg' }))));
  groups.push(group('Tags', tagRows.length ? tagRows : [row('—', 'No tags found', false)]));
  return { kind: 'media', groups };
}

/* ---------------------------------------------------------------- UI */

function render() {
  const c = current;
  const sens = c.groups.reduce((a, g) => a + g.rows.filter((r) => r[2]).length, 0);
  els.summary.innerHTML = sens
    ? `<strong>${sens} privacy-sensitive field${sens > 1 ? 's' : ''} found</strong>${c.gps ? ', including the exact GPS location where this photo was taken' : ''}.${c.cleanable ? ' Use “Remove metadata” before sharing.' : ''}`
    : 'No privacy-sensitive metadata found.';
  els.summary.dataset.kind = sens ? 'err' : 'ok';
  const total = c.groups.reduce((a, g) => a + g.rows.length, 0);
  els.out.innerHTML = `<p class="md-count">${total} fields in ${c.groups.length} groups</p>` + c.groups.map((g) => {
    const tr = ([k, v, s, isHtml]) => `<tr class="${s ? 'sens' : ''}"><th scope="row">${escapeHtml(k)}</th><td>${isHtml ? v : escapeHtml(v).replace(/\n/g, '<br>')}</td></tr>`;
    const first = g.rows.slice(0, 30), rest = g.rows.slice(30);
    return `<section class="md-group${g.warn ? ' warn' : ''}"><h3>${escapeHtml(g.title)} <small>${g.rows.length}</small></h3><table class="t-table"><tbody>${first.map(tr).join('')}</tbody>${rest.length ? `<tbody hidden>${rest.map(tr).join('')}</tbody>` : ''}</table>${rest.length ? `<button type="button" class="t-btn sm md-more">Show ${rest.length} more</button>` : ''}</section>`;
  }).join('');
  els.actions.hidden = false;
  els.clean.hidden = !c.cleanable;
  els.clean.textContent = c.kind === 'media' ? 'Remove tags (copy without metadata)' : 'Remove metadata & download';
}
els.out.addEventListener('click', (e) => { const b = e.target.closest('.md-more'); if (!b) return; b.previousElementSibling.querySelector('tbody[hidden]').hidden = false; b.remove(); });

async function open(file) {
  setStatus(els.status, `Reading ${file.name}…`);
  urls.splice(0).forEach((u) => URL.revokeObjectURL(u));
  els.out.innerHTML = ''; els.actions.hidden = true; els.summary.textContent = '';
  try {
    const head = new Uint8Array(await file.slice(0, 4096).arrayBuffer());
    const kind = sniff(head, file.name);
    const groups = [await fileGroup(file, kind)];
    let r = { kind: 'other', groups: [] };
    try {
      if (kind.fam === 'image') r = await readImage(file, kind);
      else if (kind.fam === 'pdf') r = await readPdf(file);
      else if (kind.fam === 'zip') r = await readZip(file);
      else if (kind.fam === 'media') r = await readMedia(file);
      else if (kind.fam === 'svg' || kind.fam === 'html') r = await readMarkup(file, kind.fam);
      else if (kind.fam === 'font') r = await readFont(file, kind);
      else r.groups.push(group('Metadata', [row('—', kind.fam === 'font2' ? 'WOFF2 fonts are compressed with Brotli and can\'t be inspected here yet. Convert to TTF first.' : 'This file type has no standard metadata format that can be read here. Its real type and fingerprints are shown above.', false)]));
    } catch (e) { console.warn(e); r.groups.push(group('Metadata', [row('—', `Part of this file could not be read: ${e.message}`, false)])); }
    current = { file, ...r, groups: [...groups, ...r.groups], cleanable: ['image', 'pdf', 'media', 'ooxml', 'odf', 'svg', 'html'].includes(r.kind) && !(r.kind === 'image' && /heic|avif|tif|cr3|bmp/.test(kind.ext)) };
    render();
    setStatus(els.status, '');
  } catch (e) {
    console.warn(e);
    setStatus(els.status, `This file could not be read: ${e.message}`, 'err');
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
      setStatus(els.status, 'Downloaded a clean copy: EXIF, GPS, camera, software, thumbnails, comments, AI credentials and text chunks removed (orientation kept).', 'ok');
    } else if (c.kind === 'pdf') {
      const R = await loadLib('pdflib');
      const doc = await R.PDFDocument.load(await c.file.arrayBuffer(), { ignoreEncryption: true, updateMetadata: false });
      const N = (n) => R.PDFName.of(n);
      doc.setTitle(''); doc.setAuthor(''); doc.setSubject(''); doc.setKeywords([]); doc.setCreator(''); doc.setProducer('');
      const epoch = new Date(0); doc.setCreationDate(epoch); doc.setModificationDate(epoch);
      const info = doc.context.trailerInfo.Info;
      if (info) { const dict = doc.context.lookup(info); dict.entries().map(([k]) => k).forEach((k) => dict.delete(k)); }
      const MARKUP = /^\/(Text|FreeText|Highlight|Underline|StrikeOut|Squiggly|Ink|Square|Circle|Line|Polygon|PolyLine|Stamp|Caret|FileAttachment|Sound|Redact)$/;
      for (const [, o] of doc.context.enumerateIndirectObjects()) {
        const d = o instanceof R.PDFDict ? o : o && o.dict instanceof R.PDFDict ? o.dict : null; if (!d) continue;
        d.delete(N('Metadata')); d.delete(N('PieceInfo')); d.delete(N('LastModified'));
        if (MARKUP.test(String(d.get(N('Subtype')) || ''))) { d.delete(N('T')); d.delete(N('M')); }   // comment author & time
      }
      doc.catalog.delete(N('Metadata')); doc.catalog.delete(N('PieceInfo'));
      const out = await doc.save({ updateFieldAppearances: false });
      downloadBlob(new Blob([out], { type: 'application/pdf' }), `${base}-no-metadata.pdf`);
      setStatus(els.status, 'Downloaded a clean PDF: properties, XMP, editor data, comment authors and earlier saved versions removed. Pages are unchanged.', 'ok');
    } else if (c.kind === 'ooxml' || c.kind === 'odf') {
      const zip = c.zip, names = Object.keys(zip.files);
      const edit = async (n, fn) => { if (zip.file(n)) zip.file(n, fn(await zip.file(n).async('string')), { createFolders: false }); };
      if (c.kind === 'ooxml') {
        await edit('docProps/core.xml', (x) => x.replace(/<(dc:creator|cp:lastModifiedBy|cp:lastPrinted|cp:revision|dc:description|cp:keywords|cp:category|cp:contentStatus|dc:subject|dc:identifier)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g, '').replace(/(<dcterms:(created|modified)[^>]*>)[^<]*(<\/dcterms:\2>)/g, '$11980-01-01T00:00:00Z$3'));
        await edit('docProps/app.xml', (x) => x.replace(/<(Company|Manager|Template|TotalTime|HyperlinkBase|Application|AppVersion)>[^<]*<\/\1>/g, ''));
        if (zip.file('docProps/custom.xml')) {
          zip.remove('docProps/custom.xml');
          await edit('[Content_Types].xml', (x) => x.replace(/<Override[^>]*PartName="\/docProps\/custom\.xml"[^>]*\/>/, ''));
          await edit('_rels/.rels', (x) => x.replace(/<Relationship[^>]*Target="\/?docProps\/custom\.xml"[^>]*\/>/, ''));
        }
        for (const n of names.filter((x) => /\.xml$/.test(x) && /^(word|xl|ppt)\//.test(x))) {
          await edit(n, (x) => x.replace(/(w:author|author)="[^"]*"/g, '$1="Author"').replace(/w:initials="[^"]*"/g, 'w:initials="A"').replace(/(displayName|userId)="[^"]*"/g, '$1="Author"').replace(/<author>[^<]*<\/author>/g, '<author>Author</author>').replace(/(<p:cmAuthor[^>]*\bname=")[^"]*(")/g, '$1Author$2').replace(/(<p:cmAuthor[^>]*\binitials=")[^"]*(")/g, '$1A$2'));
        }
      } else {
        await edit('meta.xml', (x) => x.replace(/<(meta:initial-creator|dc:creator|meta:printed-by|meta:print-date|meta:editing-cycles|meta:editing-duration|meta:generator|meta:user-defined)\b[^>]*?(\/>|>[\s\S]*?<\/\1>)/g, ''));
      }
      // preview thumbnails can show the first page; entry dates reveal when (and in which time zone) the file was edited
      for (const n of Object.keys(zip.files).filter((x) => /^docProps\/thumbnail\.|^Thumbnails\//i.test(x))) zip.remove(n);
      await edit('_rels/.rels', (x) => x.replace(/<Relationship[^>]*Target="\/?docProps\/thumbnail\.[^"]*"[^>]*\/>/, ''));
      await edit('META-INF/manifest.xml', (x) => x.replace(/<manifest:file-entry[^>]*full-path="Thumbnails\/[^"]*"[^>]*\/>/g, ''));
      const epoch = new Date(1980, 0, 1, 12);
      Object.keys(zip.files).filter((n) => zip.files[n].dir && !names.includes(n)).forEach((n) => zip.remove(n));
      zip.forEach((_, f) => { f.date = epoch; });
      if (c.kind === 'odf' && zip.file('mimetype')) zip.file('mimetype', await zip.file('mimetype').async('string'), { compression: 'STORE', date: epoch, createFolders: false });   // must stay first and uncompressed
      const type = c.kind === 'odf' ? (await zip.file('mimetype').async('string')) : c.file.type || 'application/octet-stream';
      const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: type });
      downloadBlob(blob, `${base}-no-metadata.${ext}`);
      setStatus(els.status, 'Downloaded a clean copy: author, last editor, company, template, editing time, custom properties, comment authors, preview thumbnail and file dates removed. Content is unchanged; tracked changes and comments themselves are kept, so accept or delete them in your editor if they are private.', 'ok');
    } else if (c.kind === 'svg' || c.kind === 'html') {
      let t = c.text.replace(/<!--[\s\S]*?-->/g, '');
      if (c.kind === 'svg') t = t.replace(/<metadata[\s\S]*?<\/metadata>/g, '').replace(/<sodipodi:namedview[\s\S]*?(\/>|<\/sodipodi:namedview>)/g, '').replace(/\s(sodipodi|inkscape):[\w-]+="[^"]*"/g, '').replace(/\sxmlns:(sodipodi|inkscape)="[^"]*"/g, '');
      else t = t.replace(/<meta\s+name="(generator|author|creator|publisher|copyright)"[^>]*>/gi, '');
      downloadBlob(new Blob([t], { type: c.kind === 'svg' ? 'image/svg+xml' : 'text/html' }), `${base}-no-metadata.${ext}`);
      setStatus(els.status, 'Downloaded a clean copy without comments, editor data and author tags.', 'ok');
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
      setStatus(els.status, 'Downloaded a copy without title, artist, location, device, cover art or other tags. Audio and video are copied without re-encoding.', 'ok');
    }
  } catch (e) { console.warn(e); setStatus(els.status, e.message || 'Could not remove metadata from this file.', 'err'); }
  els.clean.disabled = false;
}

setupDropzone(els.drop, els.input, (files) => open(files[0]));
els.clean.addEventListener('click', clean);
const plain = (v) => String(v).replace(/<[^>]+>/g, '').trim();
els.json.addEventListener('click', () => current && downloadBlob(new Blob([JSON.stringify({ file: current.file.name, groups: current.groups.map((g) => ({ title: g.title, fields: g.rows.map((r) => ({ name: r[0], value: plain(r[1]), sensitive: r[2] })) })) }, null, 2)], { type: 'application/json' }), `${splitName(current.file.name)[0]}-metadata.json`));
els.copy.addEventListener('click', async () => { if (!current) return; const txt = current.groups.map((g) => `${g.title}\n${g.rows.map((r) => `  ${r[0]}: ${plain(r[1])}`).join('\n')}`).join('\n\n'); setStatus(els.status, (await copyText(txt)) ? 'Copied.' : 'Copy failed.', 'ok'); });
