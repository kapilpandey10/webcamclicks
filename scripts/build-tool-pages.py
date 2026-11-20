#!/usr/bin/env python3
"""Generate the WebcamClicks tool pages, the /tools hub and the shared footer.

Run from the repository root:   python3 scripts/build-tool-pages.py

Single source of truth: TOOLS (every tool on the site, grouped by category) and
PAGES (content for the tool pages this script owns). Re-running is safe: pages are
regenerated, and the footer / nav on other English pages are updated in place.
"""
import glob, html, json, os, re

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(ROOT)
V = '20261120c'                       # cache-busting version for CSS/JS links
SITE = 'https://webcamclicks.com'

# ----------------------------------------------------------------------------- icons
ICONS = {
  'camera': '<path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/>',
  'person': '<circle cx="12" cy="8" r="3.5"/><path d="M5 20c.8-3.6 3.6-5.5 7-5.5s6.2 1.9 7 5.5"/><path d="M3 4h4M3 4v4M21 4h-4M21 4v4" opacity=".6"/>',
  'screen': '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/><circle cx="12" cy="10" r="2.2" fill="currentColor"/>',
  'film': '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M7 5v14M17 5v14M3 9h4M3 15h4M17 9h4M17 15h4"/>',
  'check': '<circle cx="12" cy="12" r="9"/><path d="m8 12.5 2.7 2.7L16.5 9.5"/>',
  'mic': '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  'compare': '<rect x="3" y="5" width="8" height="14" rx="1.5"/><rect x="13" y="5" width="8" height="14" rx="1.5"/>',
  'id': '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16.5c.6-1.6 1.8-2.4 3.2-2.4s2.6.8 3.2 2.4M14.5 10h4M14.5 13.5h3"/>',
  'scissors': '<circle cx="6" cy="7" r="2.5"/><circle cx="6" cy="17" r="2.5"/><path d="M8 8.5 20 18M8 15.5 20 6"/>',
  'convert': '<path d="M4 7h12l-3-3M20 17H8l3 3"/>',
  'compress': '<path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/>',
  'resize': '<path d="M4 9V4h5M20 15v5h-5M4 4l7 7M20 20l-7-7"/>',
  'frame': '<rect x="3" y="3" width="18" height="18" rx="2"/><rect x="7" y="7" width="10" height="10" rx="1"/>',
  'sparkle': '<path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4z"/><path d="M19 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8z"/>',
  'pdf': '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 17h4"/>',
  'merge': '<path d="M6 4v5a4 4 0 0 0 4 4h4a4 4 0 0 1 4 4v3M18 4v5M6 20v-3"/><path d="m15 7 3-3 3 3"/>',
  'split': '<path d="M12 3v6M12 9l-6 6v6M12 9l6 6v6"/>',
  'rename': '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/>',
  'text': '<path d="M4 6h16M4 12h10M4 18h13"/>',
  'qr': '<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v.01M14 20h.01M17 20h4v-3"/>',
  'key': '<circle cx="8" cy="15" r="4"/><path d="m11 12 9-9M17 6l3 3M15 8l2 2"/>',
  'palette': '<path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.8 1.6-1.6 0-.9-.7-1.3-.7-2.2 0-.8.7-1.4 1.5-1.4H17a4 4 0 0 0 4-4C21 6.9 17 3 12 3z"/><circle cx="7.5" cy="11" r="1.2"/><circle cx="10" cy="7" r="1.2"/><circle cx="15" cy="7.5" r="1.2"/>',
}
def icon(k, size=22):
    return f'<svg width="{size}" height="{size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[k]}</svg>'

# ----------------------------------------------------------------------------- registry
CATEGORIES = [
  ('camera', 'Camera & video', 'Record, test and upgrade your webcam, all in the browser.'),
  ('image', 'Photo & image', 'Convert, compress, resize and edit photos in bulk without uploading them.'),
  ('pdf', 'PDF', 'Create, merge and split PDFs privately on your device.'),
  ('file', 'File', 'Organise many files at once.'),
  ('text', 'Text & writing', 'Count, clean and transform text.'),
  ('util', 'Everyday utilities', 'Small tools you reach for every week.'),
]
# (slug/href, name, category, icon, description, new?)
TOOLS = [
  ('/#camera', 'Webcam studio', 'camera', 'camera', '90+ live effects, photo booth strips and HD recording.', False),
  ('/#background', 'AI background changer', 'camera', 'person', 'Blur or replace your webcam background in real time.', False),
  ('/screen-recorder', 'Screen recorder', 'camera', 'screen', 'Record your screen with mic and a webcam bubble.', True),
  ('/webcam-test', 'Webcam test', 'camera', 'check', 'Real resolution, fps, lighting and a quality score.', False),
  ('/mic-test', 'Mic test', 'camera', 'mic', 'Check levels, noise and playback before a call.', False),
  ('/pro-camera', 'Pro camera', 'camera', 'film', 'Cinema aspect ratios and manual controls.', False),
  ('/compare-webcams', 'Compare two webcams', 'camera', 'compare', 'Side-by-side quality comparison.', False),
  ('/passport-photo', 'Passport photo maker', 'image', 'id', 'Official sizes for 10 countries at 300 DPI.', False),
  ('/background-remover', 'Background remover', 'image', 'scissors', 'Remove the background from photos of people.', True),
  ('/image-converter', 'Image converter', 'image', 'convert', 'Convert to JPG, PNG, WebP or AVIF in bulk.', True),
  ('/image-compressor', 'Image compressor', 'image', 'compress', 'Shrink photos for email, web and uploads.', True),
  ('/image-resizer', 'Image resizer', 'image', 'resize', 'Resize many images by pixels or percent.', True),
  ('/instagram-photo-border', 'Instagram photo border', 'image', 'frame', 'White borders for 1:1, 4:5 and 9:16.', False),
  ('/filters', 'Photo filters gallery', 'image', 'palette', 'Browse every live effect and film look.', False),
  ('/jpg-to-pdf', 'JPG to PDF', 'pdf', 'pdf', 'Turn photos and scans into one PDF.', True),
  ('/merge-pdf', 'Merge PDF', 'pdf', 'merge', 'Combine PDFs in the order you choose.', True),
  ('/split-pdf', 'Split PDF', 'pdf', 'split', 'Extract pages or split a PDF into parts.', True),
  ('/bulk-file-rename', 'Bulk file renamer', 'file', 'rename', 'Rename hundreds of files with patterns and numbering.', True),
  ('/word-counter', 'Word counter', 'text', 'text', 'Words, characters, reading time and text tools.', True),
  ('/qr-code-generator', 'QR code generator', 'util', 'qr', 'QR codes for links, Wi-Fi, contacts and more.', True),
  ('/password-generator', 'Password generator', 'util', 'key', 'Strong random passwords with a strength meter.', True),
]
CAT_NAME = {c[0]: c[1] for c in CATEGORIES}

def tool_card(t):
    href, name, cat, ico, desc, new = t
    return (f'<a class="tool-card" href="{href}"><span class="ico">{icon(ico)}</span>'
            f'<span><strong>{html.escape(name)}{" <span class=\"new\">New</span>" if new else ""}</strong>'
            f'<span class="d">{html.escape(desc)}</span></span></a>')

# ----------------------------------------------------------------------------- shared chrome
def read(p): return open(p, encoding='utf-8').read()

TEMPLATE = read('passport-photo.html')
HEAD_TOP = TEMPLATE[:TEMPLATE.index('<title>')]          # doctype, consent mode, GTM, AdSense, consent.js
BODY_OPEN = TEMPLATE[TEMPLATE.index('<body>'):TEMPLATE.index('</header>') + len('</header>')]

NAV = [('/#camera', 'Studio'), ('/tools', 'Tools'), ('/passport-photo', 'Passport photo'), ('/webcam-test', 'Webcam test'),
       ('/mic-test', 'Mic test'), ('/filters', 'Filters'), ('/guides', 'Guides')]

def header_nav(current_href, home=False):
    out = []
    for href, label in NAV:
        h = '#camera' if (home and href == '/#camera') else href
        cur = href == current_href or (home and href == '/#camera')
        out.append(f'    <a href="{h}"{" aria-current=\"page\"" if cur else ""}>{label}</a>')
    cta = '#camera' if home else '/#camera'
    return ('<nav class="site-nav" aria-label="Main navigation">\n' + '\n'.join(out) +
            f'\n  </nav>\n  <a class="header-cta" href="{cta}">Open camera</a>')

def footer():
    cols = []
    for cid, cname, _ in CATEGORIES:
        links = ''.join(f'<li><a href="{t[0]}">{html.escape(t[1])}</a></li>' for t in TOOLS if t[2] == cid)
        cols.append((cname, links))
    # merge small categories so the footer stays compact
    merged = [cols[0], cols[1], ('PDF, file &amp; text', cols[2][1] + cols[3][1] + cols[4][1]), cols[5]]
    blocks = ''.join(f'<div><h3>{n}</h3><ul>{l}</ul></div>' for n, l in merged)
    return f'''<footer class="site-footer">
  <div class="footer-cols footer-v2">
    <div class="footer-brand">
      <a class="logo" href="/" aria-label="WebcamClicks home"><span class="logo-mark" aria-hidden="true"></span><span class="logo-word">webcam<b>clicks</b></span></a>
      <p>Free camera, photo, PDF and everyday tools that run in your browser. Your files and video never leave your device.</p>
      <p><a href="/tools">All tools →</a></p>
    </div>
    {blocks}
    <div><h3>Company</h3><ul><li><a href="/guides">Guides</a></li><li><a href="/about">About</a></li><li><a href="/contact">Contact</a></li><li><a href="/privacy">Privacy policy</a></li><li><a href="/privacy" data-privacy-choices>Privacy choices</a></li><li><a href="/terms">Terms</a></li><li><a href="/languages">Languages</a></li></ul></div>
  </div>
  <p class="fineprint">© 2026 WebcamClicks.com · Everything runs on your device. No uploads, no accounts.</p>
</footer>'''

def bottom_nav(current):
    def item(href, k, label):
        cur = ' active' if href == current else ''
        return f'  <a href="{href}" class="mb-nav-item{cur}">\n    <svg class="mb-ico" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">{ICONS[k]}</svg>\n    <span class="mb-nav-label">{label}</span>\n  </a>'
    return ('<nav class="mobile-bottom-nav" aria-label="Mobile app navigation">\n' +
            '\n'.join([item('/#camera', 'camera', 'Studio'), item('/tools', 'sparkle', 'Tools'), item('/passport-photo', 'id', 'Passport'),
                       item('/webcam-test', 'check', 'Cam test'), item('/mic-test', 'mic', 'Mic test')]) + '\n</nav>')

def page(slug, title, desc, body, schema, script=None, current=None, extra_head=''):
    url = f'{SITE}/{slug}' if slug else f'{SITE}/'
    body_open = re.sub(r'<nav class="site-nav".*?</nav>\s*<a class="header-cta"[^>]*>[^<]*</a>', lambda m: header_nav(current or f'/{slug}'), BODY_OPEN, count=1, flags=re.S)
    head = f'''<title>{title}</title>
<meta name="description" content="{html.escape(desc, quote=True)}">
<link rel="canonical" href="{url}">
<link rel="icon" href="/favicon.ico" sizes="any">
<link rel="icon" href="/assets/icons/icon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png">
<link rel="manifest" href="/manifest.json">
<meta name="robots" content="index, follow, max-snippet:-1, max-image-preview:large">
<meta name="theme-color" content="#ffffff">
<meta property="og:type" content="website">
<meta property="og:site_name" content="WebcamClicks">
<meta property="og:url" content="{url}">
<meta property="og:title" content="{html.escape(title.split(' | ')[0], quote=True)}">
<meta property="og:description" content="{html.escape(desc, quote=True)}">
<meta property="og:image" content="{SITE}/assets/img/og-image.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="{SITE}/assets/img/og-image.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" media="print" onload="this.media='all'">
<noscript><link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap"></noscript>
<link rel="stylesheet" href="/styles/main.css?v={V}">
<link rel="stylesheet" href="/styles/tools.css?v={V}">
{extra_head}''' + ''.join(f'<script type="application/ld+json">\n{json.dumps(s, ensure_ascii=False, indent=1)}\n</script>\n' for s in schema) + '</head>\n'
    scr = f'<script type="module" src="/js/tools/{script}?v={V}"></script>\n' if script else ''
    return HEAD_TOP + head + body_open + '\n\n' + body + '\n' + footer() + '\n\n' + bottom_nav(current or f'/{slug}') + '\n\n' + scr + '</body>\n</html>\n'

def faq_html(faqs):
    return '<section class="t-faq"><h2>Frequently asked questions</h2>' + ''.join(
        f'<details><summary>{html.escape(q)}</summary><p>{a}</p></details>' for q, a in faqs) + '</section>'

def faq_schema(faqs):
    return {'@context': 'https://schema.org', '@type': 'FAQPage', 'mainEntity': [
        {'@type': 'Question', 'name': q, 'acceptedAnswer': {'@type': 'Answer', 'text': re.sub('<[^>]+>', '', a)}} for q, a in faqs]}

def crumbs_schema(items):
    return {'@context': 'https://schema.org', '@type': 'BreadcrumbList', 'itemListElement': [
        {'@type': 'ListItem', 'position': i + 1, 'name': n, 'item': SITE + h} for i, (n, h) in enumerate(items)]}

def app_schema(name, slug, desc, cat):
    return {'@context': 'https://schema.org', '@type': 'WebApplication', 'name': name, 'url': f'{SITE}/{slug}',
            'applicationCategory': cat, 'operatingSystem': 'Any (browser-based)', 'description': desc,
            'offers': {'@type': 'Offer', 'price': '0', 'priceCurrency': 'USD'}, 'provider': {'@id': f'{SITE}/#organization'}}

DROP = lambda accept, title, sub, multiple=True: f'''<div class="t-drop" id="t-drop" role="button" tabindex="0" aria-label="{html.escape(title)}">
      <div class="t-drop-ico">{icon("convert", 26) if "pdf" not in accept else icon("pdf", 26)}</div>
      <strong>{title}</strong><span>{sub}</span>
      <input type="file" id="t-input" accept="{accept}" {"multiple" if multiple else ""} hidden>
    </div>'''

# ----------------------------------------------------------------------------- page content
PAGES = {}

def image_tool(mode):
    lead = {
      'convert': 'Convert photos between JPG, PNG, WebP and AVIF in bulk. Drop in as many images as you like, choose a format and download them one by one or as a ZIP.',
      'compress': 'Make photos smaller for email, websites and upload limits without visible quality loss. Compress dozens of images at once and see exactly how much space you saved.',
      'resize': 'Resize many images at once to an exact width, height, longest side or percentage. Perfect for websites, marketplaces, forms and social media.',
    }[mode]
    ui = f'''<div class="t-grid">
    <div>
      {DROP("image/*", "Drop images here or click to choose", "JPG, PNG, WebP, AVIF, GIF, BMP · paste with Ctrl+V · nothing is uploaded")}
      <ul class="t-list" id="t-list" aria-live="polite"></ul>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Settings</h2>
      <label class="t-field">Output format <select class="t-select" id="t-format"></select></label>
      <label class="t-field">Quality <span id="t-quality-val"></span><input class="t-range" type="range" id="t-quality" min="30" max="100" value="85"><small>Lower = smaller files. 70–85% looks identical for most photos.</small></label>
      <label class="t-field">Resize
        <select class="t-select" id="t-resize-mode">
          <option value="none">Keep original size</option><option value="longest">Max longest side</option>
          <option value="width">Width</option><option value="height">Height</option><option value="percent">Percentage</option>
        </select></label>
      <label class="t-field">Size <span style="display:flex;gap:8px;align-items:center"><input class="t-input" type="number" id="t-resize-val" min="1" value="1280"><span id="t-resize-unit">px</span></span></label>
      <label class="t-field">Background for transparent images (JPG) <input class="t-input" type="color" id="t-bg" value="#ffffff" style="height:42px;padding:4px"></label>
      <div class="t-actions">
        <button class="t-btn primary" id="t-run" type="button">{ {"convert": "Convert", "compress": "Compress", "resize": "Resize"}[mode] } images</button>
        <button class="t-btn" id="t-zip" type="button" disabled>Download all</button>
        <button class="t-btn" id="t-clear" type="button">Clear</button>
      </div>
      <p class="t-status" id="t-summary"></p>
    </div>
  </div>'''
    return lead, ui

ART_IMAGE = '''<h2>Which image format should I use?</h2>
<p><strong>JPG</strong> is the universal choice for photos and works everywhere. <strong>PNG</strong> is lossless and keeps transparency, so use it for logos, screenshots and graphics with text. <strong>WebP</strong> makes photos 25–35% smaller than JPG at the same quality and is supported by every modern browser, which makes it ideal for websites. <strong>AVIF</strong> compresses even better than WebP but takes longer to encode and isn't accepted everywhere yet.</p>
<h2>How this tool works</h2>
<p>Your images are opened directly by your browser, drawn onto a canvas at the size you choose and re-encoded in the new format. Large reductions are done in several half-size steps, which keeps detail sharper than a single resize. Phone photos are rotated correctly using their EXIF orientation. Everything happens on your computer or phone, so it is fast even for big batches and your photos stay private.</p>
<h3>Bonus: location data is removed</h3>
<p>Photos from phones often contain hidden metadata such as GPS coordinates, the date and the camera model. Re-encoding removes it, so converted or compressed images are safer to share publicly.</p>
<h2>Tips for the best results</h2>
<ul>
<li>For websites, resize to the largest size the image is actually displayed at (often 1600–2400 px wide) and export WebP at 75–85% quality.</li>
<li>For email attachments, a longest side of 1600 px at 75% JPG quality keeps most photos under 400 KB.</li>
<li>Keep screenshots and graphics as PNG: JPG adds blurry artefacts around text.</li>
<li>HEIC photos from iPhones can be opened in Safari. On other browsers, set your iPhone to Settings → Camera → Formats → Most Compatible.</li>
</ul>'''

FAQ_IMAGE = [
  ('Are my images uploaded to a server?', 'No. Conversion, compression and resizing run entirely in your browser. Your photos never leave your device, which is also why it works offline once the page has loaded.'),
  ('Is there a limit on the number or size of images?', 'There is no fixed limit. Batches of hundreds of photos work fine on a laptop; very large images (above about 50 megapixels) may be slow on older phones.'),
  ('Will converting reduce the quality?', 'JPG, WebP and AVIF are lossy formats, so each re-encode discards some detail. At 80–90% quality the difference is invisible for most photos. PNG is lossless.'),
  ('Can I convert HEIC to JPG?', 'Yes in Safari on Mac, iPhone and iPad, which can decode HEIC. Chrome and Firefox cannot read HEIC files yet.'),
  ('Does it keep transparency?', 'PNG, WebP and AVIF keep transparent areas. JPG has no transparency, so transparent areas are filled with the background colour you choose.'),
]

for mode, slug, name, title, desc in [
  ('convert', 'image-converter', 'Image converter', 'Image Converter — JPG, PNG, WebP &amp; AVIF in Bulk, Free | WebcamClicks',
   'Convert images to JPG, PNG, WebP or AVIF in bulk, free and private. Resize while converting, download as ZIP. Runs in your browser; nothing is uploaded.'),
  ('compress', 'image-compressor', 'Image compressor', 'Image Compressor — Compress JPG, PNG &amp; WebP in Bulk | WebcamClicks',
   'Compress images online in bulk without uploading them. Shrink JPG, PNG and WebP for email, web and upload limits and see the savings for every file.'),
  ('resize', 'image-resizer', 'Image resizer', 'Image Resizer — Resize Images in Bulk by Pixels or % | WebcamClicks',
   'Resize multiple images at once to an exact width, height, longest side or percentage. Free bulk image resizer that runs privately in your browser.'),
]:
    lead, ui = image_tool(mode)
    PAGES[slug] = dict(name=name, title=title, desc=desc, cat='image', lead=lead, ui=ui, mode=mode, script='image-tools.js',
                       article=ART_IMAGE, faqs=FAQ_IMAGE, appcat='MultimediaApplication')

PAGES['background-remover'] = dict(
  name='Background remover', cat='image', script='bg-remover.js', appcat='PhotographyApplication',
  title='Background Remover with Brush &amp; Eraser — Free, Private | WebcamClicks',
  desc='Remove image backgrounds free: AI cut-out for people plus Erase and Restore brushes to fix edges, or go fully manual for objects and pets. Transparent PNG, white or colour background. No uploads.',
  lead='AI removes the background from photos of people in seconds. Then fix any edge with the Erase and Restore brushes, or start fully manual to cut out objects, pets and products. Download a transparent PNG or a new background. Nothing is uploaded.',
  ui=f'''<div class="t-grid bgr-grid">
    <div>
      {DROP("image/*", "Drop photos here", "JPG, PNG or WebP · batch supported · nothing is uploaded")}
      <label class="t-field" style="margin-top:14px">Start from
        <select class="t-select" id="t-startfrom">
          <option value="ai">AI cut-out (people)</option>
          <option value="keep">Keep whole photo, then erase (manual)</option>
          <option value="remove">Remove everything, then restore (manual)</option>
        </select></label>
      <ul class="t-list" id="t-list"></ul>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="t-panel" style="margin-top:12px">
        <div class="t-row">
          <label class="t-field">New background <select class="t-select" id="t-out"><option value="transparent">Transparent (PNG)</option><option value="white">White</option><option value="color">Colour</option><option value="blur">Blurred original</option></select></label>
          <label class="t-field">Colour <input class="t-input" type="color" id="t-color" value="#2563eb" style="height:42px;padding:4px"></label>
        </div>
        <label class="t-field">AI edge: soft ↔ crisp <input class="t-range" type="range" id="t-edge" min="0" max="100" value="35"></label>
        <div class="t-actions">
          <button class="t-btn primary" id="t-dl-one" type="button" disabled>Download this photo</button>
          <button class="t-btn" id="t-zip" type="button" disabled>Download all</button>
          <button class="t-btn" id="t-run" type="button" hidden>Process</button>
          <button class="t-btn" id="t-clear" type="button">Clear</button>
        </div>
      </div>
    </div>
    <div class="bgr-editor">
      <div class="bgr-toolbar" role="toolbar" aria-label="Refine tools">
        <div class="t-seg bgr-tools">
          <button type="button" data-tool="view" aria-pressed="true" title="View / pan (V)">✋ View</button>
          <button type="button" data-tool="erase" aria-pressed="false" title="Erase brush (E)">⌫ Erase</button>
          <button type="button" data-tool="restore" aria-pressed="false" title="Restore brush (R)">✎ Restore</button>
        </div>
        <label class="bgr-ctl">Size <input class="t-range" type="range" id="t-brush" min="4" max="200" value="40"><span id="t-brush-val"></span></label>
        <label class="bgr-ctl">Softness <input class="t-range" type="range" id="t-soft" min="0" max="100" value="30"></label>
        <div class="bgr-btns">
          <button class="t-icon-btn" id="t-undo" type="button" title="Undo (Ctrl+Z)" aria-label="Undo" disabled>↶</button>
          <button class="t-icon-btn" id="t-redo" type="button" title="Redo (Ctrl+Shift+Z)" aria-label="Redo" disabled>↷</button>
          <button class="t-btn sm" id="t-reset" type="button" disabled>Reset edits</button>
          <span class="bgr-zoom"><button class="t-icon-btn" id="t-zoom-out" type="button" aria-label="Zoom out">−</button><button class="t-btn sm" id="t-zoom-fit" type="button" title="Fit to view"><span id="t-zoom-val">100%</span></button><button class="t-icon-btn" id="t-zoom-in" type="button" aria-label="Zoom in">+</button></span>
          <label class="t-check" style="margin:0"><input type="checkbox" id="t-ghost" checked> Show removed areas</label>
        </div>
      </div>
      <div class="bgr-stage" id="t-stage" data-tool="view">
        <canvas id="t-preview-canvas" width="1" height="1" aria-label="Editable result preview"></canvas>
        <div class="bgr-cursor" id="t-cursor" aria-hidden="true"></div>
      </div>
      <p class="bgr-hint" id="t-edit-hint"></p>
    </div>
  </div>
  <style>
  .bgr-grid {{ grid-template-columns: minmax(0, .9fr) minmax(0, 1.6fr); }}
  .bgr-toolbar {{ display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; padding: 10px; border: 1px solid var(--line); border-radius: 14px; background: #fff; margin-bottom: 10px; }}
  .bgr-tools {{ flex: 0 0 auto; }}
  .bgr-tools button {{ flex: 0 0 auto; }}
  .bgr-tools button[data-tool="erase"][aria-pressed="true"] {{ background: #d92d20; border-color: #d92d20; }}
  .bgr-tools button[data-tool="restore"][aria-pressed="true"] {{ background: #067647; border-color: #067647; }}
  .bgr-ctl {{ display: flex; align-items: center; gap: 8px; font-weight: 700; font-size: .84rem; }}
  .bgr-ctl input {{ width: 110px; }}
  .bgr-ctl span {{ min-width: 44px; color: var(--ink-2); font-weight: 600; }}
  .bgr-btns {{ display: flex; flex-wrap: wrap; align-items: center; gap: 6px 10px; }}
  .bgr-zoom {{ display: inline-flex; gap: 4px; align-items: center; }}
  .bgr-stage {{ position: relative; height: min(68vh, 620px); overflow: auto; border-radius: 14px; border: 1px solid var(--line);
    background: repeating-conic-gradient(#eef0f3 0 25%, #fff 0 50%) 0 0 / 18px 18px; display: grid; place-items: center; padding: 16px; touch-action: none; overscroll-behavior: contain; }}
  .bgr-stage.zoomed {{ place-items: start; cursor: grab; }}
  .bgr-stage canvas {{ max-width: 100%; max-height: 100%; height: auto; display: block; box-shadow: 0 2px 12px rgba(14,14,18,.12); }}
  .bgr-stage[data-tool="erase"] canvas, .bgr-stage[data-tool="restore"] canvas {{ cursor: none; }}
  .bgr-cursor {{ position: absolute; left: 0; top: 0; border-radius: 50%; pointer-events: none; opacity: 0; border: 2px solid #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.6); }}
  .bgr-cursor[data-mode="erase"] {{ background: rgba(217,45,32,.18); }}
  .bgr-cursor[data-mode="restore"] {{ background: rgba(6,118,71,.18); }}
  .bgr-hint {{ margin: 8px 0 0; font-size: .84rem; color: var(--ink-2); }}
  .t-item.sel {{ border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }}
  @media (max-width: 860px) {{ .bgr-grid {{ grid-template-columns: 1fr; }} .bgr-stage {{ height: 60vh; }} }}
  </style>''',
  article='''<h2>How the background remover works</h2>
<p>This tool uses a compact segmentation model, the same family Google uses for video-call background effects, to decide for every pixel whether it belongs to a person. It runs inside your browser with WebAssembly and your graphics chip, so your photos are never uploaded. The model downloads once (about 250 KB plus the shared runtime) and is cached for next time.</p>
<p>It is designed for <strong>photos of people</strong>: portraits, selfies, team photos, profile pictures and product shots that include a person. Objects without people, such as a lone mug on a table, aren't detected; use a dedicated object cut-out tool for those.</p>
<h2>Refine with the brush and eraser</h2>
<ul>
<li><strong>Erase</strong> (E) paints away anything the AI kept by mistake, such as a chair back or a gap between arm and body.</li>
<li><strong>Restore</strong> (R) paints back anything that was cut off, like a strand of hair, a hand or a held object. With <em>Show removed areas</em> on, removed parts appear as a faint red ghost so you can see exactly where to paint.</li>
<li><strong>Size and softness:</strong> use a soft, large brush for hair and smooth edges and a small, hard brush for crisp outlines. Press <kbd>[</kbd> and <kbd>]</kbd> to change the size quickly.</li>
<li><strong>Zoom</strong> in for detail with the + button or Ctrl/⌘ + scroll, and drag in View mode to move around.</li>
<li><strong>Undo / redo</strong> with Ctrl+Z and Ctrl+Shift+Z. <em>Reset edits</em> returns to the AI result. Changing the AI edge setting keeps your brush edits.</li>
</ul>
<h3>Cut out objects, pets and products manually</h3>
<p>The AI is trained on people. For anything else, set <strong>Start from</strong> to <em>Keep whole photo</em> and erase the background with a big brush, then zoom in to tidy the edges. Or choose <em>Remove everything</em> and paint the object back in with Restore, which is often faster when the object is small.</p>
<h2>Getting a clean cut-out</h2>
<ul>
<li><strong>Contrast helps.</strong> A person in dark clothes against a light wall separates more cleanly than beige on beige.</li>
<li><strong>Use the edge slider.</strong> Keep it low for natural, soft hair edges; raise it for a crisp sticker-style outline.</li>
<li><strong>Transparent PNG</strong> is best for design tools such as Canva, PowerPoint and Figma. Choose <strong>White</strong> for marketplace listings and ID-style photos.</li>
<li>For official ID photos with exact sizes, use the <a href="/passport-photo">passport photo maker</a>, which also crops to your country's rules.</li>
</ul>
<h2>Live background replacement</h2>
<p>Want to change your background on camera instead? The <a href="/#background">AI background changer</a> blurs or replaces your webcam background in real time and works with every effect in the studio.</p>''',
  faqs=[
    ('Is this background remover free?', 'Yes, with no watermark, sign-up or limits on how many photos you process.'),
    ('Are my photos uploaded?', 'No. The AI model runs in your browser and your photos never leave your device.'),
    ('Does it work on objects, pets and products?', 'The automatic cut-out is trained on people. For objects and pets, set Start from to "Keep whole photo" and remove the background with the Erase brush, or "Remove everything" and paint the subject back with Restore.'),
    ('How do I fix hair or missing parts?', 'Choose Restore and paint over the missing area with a soft brush. Turn on "Show removed areas" to see what was cut away. Use Erase for leftovers of the old background.'),
    ('What resolution do I get?', 'Up to 2,400 pixels on the long side, which is enough for social media, documents and most print uses.'),
    ('Why does the edge look soft?', 'Hair and motion blur create partly transparent edges. Move the Edge slider toward "crisp" for a harder outline.'),
  ])

PAGES['bulk-file-rename'] = dict(
  name='Bulk file renamer', cat='file', script='bulk-rename.js', appcat='UtilitiesApplication',
  title='Bulk File Renamer — Rename Multiple Files Online, Free | WebcamClicks',
  desc='Rename hundreds of files at once with patterns, numbering, dates, find & replace and case changes. Preview every name, then download as ZIP or rename in place.',
  lead='Rename hundreds of photos, documents or any files at once. Build names from patterns, numbers, dates and find-and-replace, preview every change, then download a ZIP or rename the files directly in a folder.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("", "Drop files here or click to choose", "Any file type · or pick a whole folder below · nothing is uploaded")}
      <div class="t-actions">
        <button class="t-btn sm" id="t-folder-btn" type="button">Choose a folder</button>
        <input type="file" id="t-folder-input" webkitdirectory multiple hidden>
        <button class="t-btn sm dark" id="t-disk-btn" type="button">Rename files in a folder (Chrome / Edge)</button>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <p class="t-status" id="t-count"></p>
      <div class="t-table-wrap" style="max-height:440px;overflow:auto"><table class="t-table"><thead><tr><th>#</th><th>Current name</th><th>New name</th></tr></thead><tbody id="t-tbody"></tbody></table></div>
    </div>
    <div class="t-panel">
      <h2>Rename rules</h2>
      <label class="t-field">Name pattern <input class="t-input t-rename-opt" id="t-pattern" value="{{name}}" spellcheck="false"></label>
      <div class="t-seg" style="margin:-4px 0 12px">
        <button type="button" data-token="{{name}}">{{name}}</button><button type="button" data-token="{{n}}">{{n}}</button>
        <button type="button" data-token="{{date}}">{{date}}</button><button type="button" data-token="{{time}}">{{time}}</button><button type="button" data-token="{{folder}}">{{folder}}</button>
      </div>
      <div class="t-row">
        <label class="t-field">Find <input class="t-input t-rename-opt" id="t-find" spellcheck="false"></label>
        <label class="t-field">Replace with <input class="t-input t-rename-opt" id="t-replace" spellcheck="false"></label>
      </div>
      <label class="t-check"><input type="checkbox" class="t-rename-opt" id="t-regex"> Use regular expression</label>
      <label class="t-check"><input type="checkbox" class="t-rename-opt" id="t-matchcase"> Match case</label>
      <div class="t-row">
        <label class="t-field">Case <select class="t-select t-rename-opt" id="t-case"><option value="keep">Keep</option><option value="lower">lowercase</option><option value="upper">UPPERCASE</option><option value="title">Title Case</option><option value="sentence">Sentence case</option><option value="kebab">kebab-case</option><option value="snake">snake_case</option><option value="camel">camelCase</option></select></label>
        <label class="t-field">Spaces <select class="t-select t-rename-opt" id="t-spaces"><option value="keep">Keep</option><option value="-">→ -</option><option value="_">→ _</option><option value="remove">Remove</option></select></label>
      </div>
      <div class="t-row">
        <label class="t-field">Number start <input class="t-input t-rename-opt" type="number" id="t-start" value="1"></label>
        <label class="t-field">Digits <input class="t-input t-rename-opt" type="number" id="t-pad" value="3" min="1" max="8"></label>
      </div>
      <div class="t-row">
        <label class="t-field">Step <input class="t-input t-rename-opt" type="number" id="t-step" value="1"></label>
        <label class="t-field">Order <select class="t-select t-rename-opt" id="t-sort"><option value="name">Name (natural)</option><option value="date">Date modified</option><option value="size">Size</option><option value="added">As added</option></select></label>
      </div>
      <label class="t-field">Extension <select class="t-select t-rename-opt" id="t-ext"><option value="keep">Keep</option><option value="lower">lowercase (.JPG → .jpg)</option><option value="upper">UPPERCASE</option><option value="jpeg2jpg">.jpeg → .jpg</option><option value="remove">Remove</option></select></label>
      <div class="t-actions">
        <button class="t-btn primary" id="t-zip" type="button" disabled>Download as ZIP</button>
        <button class="t-btn dark" id="t-apply" type="button" hidden disabled>Rename files</button>
        <button class="t-btn" id="t-clear" type="button">Clear</button>
      </div>
    </div>
  </div>''',
  article='''<h2>Rename many files in three steps</h2>
<ol>
<li><strong>Add your files.</strong> Drag them in, choose a folder, or in Chrome and Edge open a folder to rename files where they are.</li>
<li><strong>Set the rules.</strong> Type a pattern using the tokens below, add find &amp; replace, change the case or replace spaces. The preview updates instantly and warns you about duplicate names.</li>
<li><strong>Apply.</strong> Download the renamed copies as a ZIP (works in every browser), or press <em>Rename files</em> to rename them inside the folder you opened.</li>
</ol>
<h2>Pattern tokens</h2>
<ul>
<li><code>{name}</code>: the original file name without its extension.</li>
<li><code>{n}</code>: a running number using the start, step and digits you set. Use <code>{n:2}</code> to force two digits.</li>
<li><code>{date}</code> and <code>{time}</code>: the file's last-modified date (2026-05-14) and time (09-41-07).</li>
<li><code>{folder}</code>: the name of the folder the file came from.</li>
</ul>
<h2>Popular recipes</h2>
<ul>
<li><strong>Holiday photos in order:</strong> pattern <code>Italy-2026-{n}</code>, order by date modified → Italy-2026-001.jpg, Italy-2026-002.jpg…</li>
<li><strong>Date-stamped scans:</strong> <code>{date}_{name}</code> → 2026-03-02_invoice.pdf.</li>
<li><strong>Web-friendly names:</strong> keep <code>{name}</code>, case kebab-case, extension lowercase → my-holiday-photo.jpg.</li>
<li><strong>Remove camera prefixes:</strong> find <code>IMG_</code>, replace with nothing.</li>
<li><strong>Regular expressions:</strong> tick "Use regular expression", find <code>(\\d{4})(\\d{2})(\\d{2})</code> and replace with <code>$1-$2-$3</code> to format dates.</li>
</ul>
<p>Your files are read locally and never uploaded. Renaming in place uses your browser's built-in File System Access permission, which you grant for one folder at a time.</p>''',
  faqs=[
    ('Does it upload my files?', 'No. Files are read by your browser and renamed or zipped on your device.'),
    ('Can it rename the original files instead of making a ZIP?', 'Yes, in Chrome and Edge on desktop: choose "Rename files in a folder", allow access to the folder, review the preview and press Rename files. Other browsers can download a ZIP of renamed copies.'),
    ('How many files can I rename at once?', 'Thousands. The preview shows the first 500 rows to stay fast, but every file is renamed.'),
    ('Can I undo a rename?', 'Downloading a ZIP never changes your originals. When renaming in place there is no automatic undo, so check the preview first; you can rename back with a find &amp; replace.'),
    ('Why are some names marked as duplicates?', 'Two files would end up with the same name. Add {n} to the pattern so each file gets a unique number.'),
  ])

PDF_ART_COMMON = '<p>All PDF processing happens in your browser using the open-source pdf-lib library. Your documents are never uploaded, which matters for contracts, bank statements, IDs and other private files.</p>'
PAGES['jpg-to-pdf'] = dict(
  name='JPG to PDF', cat='pdf', script='pdf-tools.js', mode='jpg2pdf', appcat='BusinessApplication',
  title='JPG to PDF — Convert Images to PDF Free, No Upload | WebcamClicks',
  desc='Convert JPG, PNG and other images to a single PDF. Reorder pages, choose A4, Letter or fit-to-image, set margins. Free, private, runs in your browser.',
  lead='Turn photos, scans and screenshots into one PDF. Put the pages in order, pick the page size and margins, and download. Ideal for receipts, homework, ID scans and forms.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*", "Drop images here or click to choose", "JPG, PNG, WebP, HEIC (Safari) · reorder with the arrows · nothing is uploaded")}
      <ul class="t-list" id="t-list"></ul>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>PDF settings</h2>
      <label class="t-field">Page size <select class="t-select" id="t-pagesize"><option value="a4">A4</option><option value="letter">US Letter</option><option value="fit">Same as image</option></select></label>
      <label class="t-field">Orientation <select class="t-select" id="t-orient"><option value="auto">Automatic (match each image)</option><option value="portrait">Portrait</option><option value="landscape">Landscape</option></select></label>
      <label class="t-field">Margin <select class="t-select" id="t-margin"><option value="none">None</option><option value="small" selected>Small</option><option value="large">Large</option></select></label>
      <div class="t-actions"><button class="t-btn primary" id="t-run" type="button" disabled>Create PDF</button><button class="t-btn" id="t-clear" type="button">Clear</button></div>
    </div>
  </div>''',
  article='''<h2>How to convert JPG to PDF</h2>
<ol><li>Add your images by dragging them in or clicking the box. You can also paste a screenshot with Ctrl+V.</li>
<li>Use the arrows to put pages in the right order.</li>
<li>Choose A4 or US Letter for printing and forms, or <em>Same as image</em> to keep each photo's shape.</li>
<li>Press <strong>Create PDF</strong>. Each image becomes one page.</li></ol>
<h2>Tips</h2>
<ul><li><strong>Scanning documents with a phone?</strong> Take photos in good light, straight from above, then convert them here. Automatic orientation turns landscape photos into landscape pages.</li>
<li><strong>File too big for an upload form?</strong> Run your photos through the <a href="/image-compressor">image compressor</a> first (longest side 1600 px, 75% quality) and the PDF will be a fraction of the size.</li>
<li>Phone photos are rotated correctly using their EXIF orientation.</li></ul>''' + PDF_ART_COMMON,
  faqs=[('Is JPG to PDF free?', 'Yes, unlimited and without watermarks.'),
        ('Are my images uploaded?', 'No. The PDF is built in your browser and saved straight to your device.'),
        ('Can I add PNG or screenshots?', 'Yes. JPG, PNG, WebP, GIF and BMP work in every modern browser, and HEIC works in Safari.'),
        ('How do I make the PDF smaller?', 'Compress or resize your images first with the image compressor, then convert them.')])

PAGES['merge-pdf'] = dict(
  name='Merge PDF', cat='pdf', script='pdf-tools.js', mode='merge', appcat='BusinessApplication',
  title='Merge PDF — Combine PDF Files Free &amp; Private | WebcamClicks',
  desc='Combine multiple PDF files into one in the order you choose. Free online PDF merger with no upload, no watermark and no sign-up.',
  lead='Combine several PDFs into a single document. Add the files, arrange them in order and download one merged PDF, with no uploads and no watermark.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("application/pdf,.pdf", "Drop PDF files here or click to choose", "Add two or more PDFs · reorder with the arrows · nothing is uploaded")}
      <ul class="t-list" id="t-list"></ul>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Merge</h2>
      <p class="muted" style="font-size:.9rem;margin:0 0 6px">Files are joined top to bottom. Every page, link and form field is copied as-is.</p>
      <div class="t-actions"><button class="t-btn primary" id="t-run" type="button" disabled>Merge PDFs</button><button class="t-btn" id="t-clear" type="button">Clear</button></div>
    </div>
  </div>''',
  article='''<h2>How to merge PDF files</h2>
<ol><li>Drop in two or more PDF files.</li><li>Arrange them with the up and down arrows; the page count is shown for each file.</li><li>Press <strong>Merge PDFs</strong> to download one combined file.</li></ol>
<h2>Common uses</h2>
<ul><li>Combine a cover letter, CV and certificates into one application file.</li>
<li>Join monthly statements or invoices for your accountant.</li>
<li>Put scanned pages from different sessions back together. Need to remove a page first? Use <a href="/split-pdf">Split PDF</a>.</li></ul>
<p>Password-protected PDFs need to be unlocked in your PDF reader first, because their pages are encrypted.</p>''' + PDF_ART_COMMON,
  faqs=[('Is there a limit on files or pages?', 'No fixed limit. Very large documents (hundreds of MB) depend on your device memory.'),
        ('Are my PDFs uploaded?', 'No. Merging happens in your browser.'),
        ('Does it keep the quality?', 'Yes. Pages are copied without re-compressing, so text stays sharp and searchable.'),
        ('Can I merge password-protected PDFs?', 'Not directly. Open them in your PDF reader, remove the password, then merge.')])

PAGES['split-pdf'] = dict(
  name='Split PDF', cat='pdf', script='pdf-tools.js', mode='split', appcat='BusinessApplication',
  title='Split PDF — Extract Pages or Split a PDF Free | WebcamClicks',
  desc='Extract pages from a PDF or split it into separate files by page ranges, every page, or every N pages. Free, private and in your browser.',
  lead='Pull out the pages you need or break a long PDF into smaller files. Choose page ranges, every single page, or fixed chunks, all without uploading your document.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("application/pdf,.pdf", "Drop a PDF here or click to choose", "One PDF at a time · nothing is uploaded", multiple=False)}
      <ul class="t-list" id="t-list"></ul>
      <p class="t-status" id="t-pages"></p>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Split settings</h2>
      <label class="t-field">Mode <select class="t-select" id="t-splitmode">
        <option value="extract">Extract pages into one PDF</option><option value="ranges">Split by ranges (one file each)</option>
        <option value="each">Every page as its own PDF</option><option value="every">Every N pages</option></select></label>
      <label class="t-field" id="t-ranges-wrap">Pages <input class="t-input" id="t-ranges" placeholder="e.g. 1-3, 5, 8-end"><small>Use commas between pages or ranges. "end" means the last page.</small></label>
      <label class="t-field" id="t-every-wrap" hidden>Pages per file <input class="t-input" type="number" id="t-every" value="2" min="1"></label>
      <div class="t-actions"><button class="t-btn primary" id="t-run" type="button" disabled>Split PDF</button><button class="t-btn" id="t-clear" type="button">Clear</button></div>
    </div>
  </div>''',
  article='''<h2>Four ways to split a PDF</h2>
<ul><li><strong>Extract pages:</strong> type pages such as <code>1-3, 7</code> to get one new PDF with just those pages, the quickest way to delete unwanted pages.</li>
<li><strong>Split by ranges:</strong> each range becomes its own file, e.g. <code>1-4, 5-9, 10-end</code> for chapters.</li>
<li><strong>Every page:</strong> one PDF per page, downloaded together as a ZIP.</li>
<li><strong>Every N pages:</strong> fixed-size chunks, handy for upload portals with page limits.</li></ul>
<p>Pages are copied exactly, so text stays selectable and quality doesn't change. To put pages back together in a new order, use <a href="/merge-pdf">Merge PDF</a>.</p>''' + PDF_ART_COMMON,
  faqs=[('How do I delete a page from a PDF?', 'Choose "Extract pages" and list every page except the one you want to remove, for example 1-4, 6-end.'),
        ('Is my PDF uploaded?', 'No. Splitting runs in your browser.'),
        ('Why do I get a ZIP file?', 'When the result is several PDFs they are bundled into one ZIP so you only download once.')])

PAGES['word-counter'] = dict(
  name='Word counter', cat='text', script='word-counter.js', appcat='UtilitiesApplication',
  title='Word Counter — Count Words, Characters &amp; Reading Time | WebcamClicks',
  desc='Free word counter with characters, sentences, paragraphs, reading and speaking time, keyword density, case converter and text clean-up tools. Private and auto-saved.',
  lead='Count words and characters as you type, see reading and speaking time and keyword density, then convert case or clean up your text in one click. Your draft is saved only in this browser.',
  ui='''<div class="t-grid">
    <div>
      <label class="t-field" for="t-text" style="margin:0 0 8px">Your text</label>
      <textarea class="t-textarea" id="t-text" style="min-height:380px" placeholder="Start typing or paste your text here…"></textarea>
      <div class="t-actions">
        <button class="t-btn sm" data-tx="upper" type="button">UPPERCASE</button><button class="t-btn sm" data-tx="lower" type="button">lowercase</button>
        <button class="t-btn sm" data-tx="title" type="button">Title Case</button><button class="t-btn sm" data-tx="sentence" type="button">Sentence case</button>
        <button class="t-btn sm" data-tx="spaces" type="button">Fix spacing</button><button class="t-btn sm" data-tx="breaks" type="button">Remove line breaks</button>
        <button class="t-btn sm" data-tx="dedupe" type="button">Remove duplicate lines</button><button class="t-btn sm" data-tx="sort" type="button">Sort lines A–Z</button>
        <button class="t-btn sm" data-tx="reverse" type="button">Reverse lines</button><button class="t-btn sm" data-tx="slug" type="button">URL slug</button>
      </div>
      <div class="t-actions"><button class="t-btn primary" id="t-copy" type="button">Copy text</button><button class="t-btn" id="t-download" type="button">Download .txt</button><button class="t-btn" id="t-clear" type="button">Clear</button></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div>
      <div class="t-stats">
        <div class="t-stat"><b id="s-words">0</b><span>Words</span></div><div class="t-stat"><b id="s-chars">0</b><span>Characters</span></div>
        <div class="t-stat"><b id="s-chars-ns">0</b><span>No spaces</span></div><div class="t-stat"><b id="s-sentences">0</b><span>Sentences</span></div>
        <div class="t-stat"><b id="s-paragraphs">0</b><span>Paragraphs</span></div><div class="t-stat"><b id="s-avg">0</b><span>Avg word length</span></div>
        <div class="t-stat"><b id="s-read">0 sec</b><span>Reading time</span></div><div class="t-stat"><b id="s-speak">0 sec</b><span>Speaking time</span></div>
      </div>
      <div class="t-panel" style="margin-top:12px"><h3>Top keywords</h3><ol class="t-kw" id="t-keywords"></ol></div>
    </div>
  </div>
  <style>.t-kw{margin:0;padding-left:20px;display:grid;gap:6px}.t-kw li{font-size:.9rem}.t-kw li span{font-weight:700}.t-kw li b{float:right;font-weight:600;color:var(--ink-2)}</style>''',
  article='''<h2>What this word counter measures</h2>
<ul><li><strong>Words</strong> are counted with your browser's language-aware word segmenter, so contractions, hyphenated words and non-English text are counted correctly.</li>
<li><strong>Characters</strong> are shown with and without spaces, which is what many forms and social networks limit.</li>
<li><strong>Reading time</strong> assumes 238 words per minute (the average for adults reading non-fiction) and <strong>speaking time</strong> assumes 140 words per minute, a comfortable presentation pace.</li>
<li><strong>Keyword density</strong> lists your ten most frequent meaningful words, ignoring common words like "the" and "and". It's useful for checking that an article focuses on its topic without overusing a phrase.</li></ul>
<h2>Common length limits</h2>
<div class="t-table-wrap"><table class="t-table"><thead><tr><th>Where</th><th>Limit</th></tr></thead><tbody>
<tr><td>X (Twitter) post</td><td>280 characters</td></tr><tr><td>Instagram caption</td><td>2,200 characters</td></tr>
<tr><td>LinkedIn post</td><td>3,000 characters</td></tr><tr><td>Google title tag (shown)</td><td>about 50–60 characters</td></tr>
<tr><td>Meta description (shown)</td><td>about 150–160 characters</td></tr><tr><td>Common College App essay</td><td>650 words</td></tr></tbody></table></div>
<h2>Text tools included</h2>
<p>Select part of your text to transform only that part, or leave nothing selected to change everything: convert case, fix double spaces, remove line breaks from copied PDF text, remove duplicate lines, sort lists alphabetically, reverse lines, or turn a title into a URL slug.</p>
<p>Your text is never sent anywhere. It is saved in this browser's local storage so you don't lose a draft if you close the tab. Press Clear to remove it.</p>''',
  faqs=[('Is my text stored or uploaded?', 'No upload ever happens. A copy is kept only in your own browser so drafts survive a refresh; Clear removes it.'),
        ('How is reading time calculated?', 'Word count divided by 238 words per minute, the average silent reading speed for adults.'),
        ('Does it count words in other languages?', 'Yes. It uses the browser\'s Unicode word segmentation, which handles accented letters, Cyrillic, Devanagari, CJK and more.'),
        ('Why do my character counts differ from another tool?', 'Some tools count emoji or accented letters as two characters. This counter counts what you see, so 👍 is one character.')])

PAGES['qr-code-generator'] = dict(
  name='QR code generator', cat='util', script='qr-code.js', appcat='UtilitiesApplication',
  title='QR Code Generator — Free for URL, Wi-Fi, vCard &amp; More | WebcamClicks',
  desc='Create free QR codes for links, Wi-Fi, contacts, email, SMS and text. Custom colours, dot style, PNG and SVG download. Static codes that never expire, no tracking.',
  lead='Make a QR code for a website, Wi-Fi network, business card, email, phone number or SMS. Pick colours and style, then download a sharp PNG or a scalable SVG for print. These codes never expire.',
  ui='''<div class="t-grid even">
    <div class="t-panel">
      <label class="t-field">QR code type <select class="t-select" id="t-qrtype"><option value="url">Website / link</option><option value="wifi">Wi-Fi network</option><option value="vcard">Contact card (vCard)</option><option value="text">Plain text</option><option value="email">Email</option><option value="phone">Phone call</option><option value="sms">SMS</option></select></label>
      <div id="t-qrfields"></div>
      <div class="t-row">
        <label class="t-field">Code colour <input class="t-input" type="color" id="t-fg" value="#0e0e12" style="height:42px;padding:4px"></label>
        <label class="t-field">Background <input class="t-input" type="color" id="t-bg" value="#ffffff" style="height:42px;padding:4px"></label>
      </div>
      <div class="t-row">
        <label class="t-field">Style <select class="t-select" id="t-style"><option value="square">Squares</option><option value="dots">Dots</option></select></label>
        <label class="t-field">Error correction <select class="t-select" id="t-ecc"><option value="L">Low (7%)</option><option value="M" selected>Medium (15%)</option><option value="Q">Quartile (25%)</option><option value="H">High (30%)</option></select></label>
      </div>
      <div class="t-row">
        <label class="t-field">Size <span id="t-size-val"></span><input class="t-range" type="range" id="t-size" min="200" max="2000" step="50" value="800"></label>
        <label class="t-field">Quiet zone <select class="t-select" id="t-margin"><option value="2">Small</option><option value="4" selected>Standard</option><option value="6">Large</option></select></label>
      </div>
    </div>
    <div>
      <div class="t-preview" style="min-height:340px"><canvas id="t-qr" width="1" height="1" style="max-width:320px;width:100%;image-rendering:pixelated" aria-label="QR code preview"></canvas></div>
      <div class="t-actions"><button class="t-btn primary" id="t-png" type="button">Download PNG</button><button class="t-btn" id="t-svg" type="button">Download SVG</button></div>
      <p class="t-status" id="t-status" role="status"></p>
      <p class="muted" style="font-size:.8rem;word-break:break-all;margin:8px 0 0">Encoded: <code id="t-payload"></code></p>
    </div>
  </div>''',
  article='''<h2>Static QR codes that never expire</h2>
<p>Many "free" QR generators create <em>dynamic</em> codes that point to their own short link. They stop working when a trial ends and they track every scan. This generator makes <strong>static</strong> codes: your link or data is stored inside the pattern itself, so the code works forever and nobody tracks who scans it. The code is generated in your browser.</p>
<h2>What each type does when scanned</h2>
<ul><li><strong>Website:</strong> opens the link in the phone's browser.</li>
<li><strong>Wi-Fi:</strong> joins the network without typing the password. Great for guests, cafés and Airbnbs.</li>
<li><strong>Contact card:</strong> offers to save your name, phone, email and website to contacts.</li>
<li><strong>Email / SMS / Phone:</strong> opens a pre-filled email, text message or call.</li></ul>
<h2>Printing tips</h2>
<ul><li>Download the <strong>SVG</strong> for print. It stays perfectly sharp at any size.</li>
<li>Print at least 2 × 2 cm (0.8 in); for posters, make the code about one tenth of the scanning distance.</li>
<li>Keep a dark code on a light background with the standard quiet zone. Inverted or low-contrast codes fail on many phones.</li>
<li>Use <strong>High</strong> error correction if the code may get scratched or if you'll place a small logo on top.</li>
<li>Always test with two different phones before printing in bulk.</li></ul>''',
  faqs=[('Do these QR codes expire?', 'No. They are static, so the information is inside the code and it works forever.'),
        ('Can I track scans?', 'Not with static codes. That is by design: there is no middleman and no tracking.'),
        ('Is it free for commercial use?', 'Yes. Use the codes on packaging, menus, flyers and business cards.'),
        ('Why won\'t my QR code scan?', 'Usually low contrast, a missing quiet zone, or printing too small. Use dark on light, keep the standard margin and print larger.')])

PAGES['password-generator'] = dict(
  name='Password generator', cat='util', script='password.js', appcat='SecurityApplication',
  title='Password Generator — Strong Random Passwords | WebcamClicks',
  desc='Generate strong, random passwords with your browser\'s cryptographic generator. Choose length and characters, see entropy and crack time, create 10 at once. Nothing is stored.',
  lead='Create strong, truly random passwords using your browser\'s cryptographic random generator. Choose the length and characters, see how strong each password is, and copy it straight into your password manager.',
  ui='''<div class="t-grid even">
    <div>
      <label class="t-field">Your new password
        <span style="display:flex;gap:8px"><input class="t-input" id="t-pw" readonly style="font:600 1.15rem ui-monospace,Menlo,Consolas,monospace;letter-spacing:.02em"><button class="t-btn" id="t-regen" type="button" aria-label="Generate another">↻</button></span></label>
      <div style="height:8px;border-radius:999px;background:var(--surface-3);overflow:hidden"><div id="t-meter" style="height:100%;width:0;transition:width .2s,background .2s"></div></div>
      <p style="margin:8px 0 0;font-weight:800" id="t-meter-label"></p>
      <p class="muted" style="margin:4px 0 0;font-size:.86rem" id="t-bits"></p>
      <div class="t-actions"><button class="t-btn primary" id="t-copy" type="button">Copy password</button></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <label class="t-field">Length: <span id="t-len-val"></span><input class="t-range" type="range" id="t-len" min="8" max="64" value="20"></label>
      <label class="t-check"><input type="checkbox" id="t-upper" checked> Uppercase (A–Z)</label>
      <label class="t-check"><input type="checkbox" id="t-lower" checked> Lowercase (a–z)</label>
      <label class="t-check"><input type="checkbox" id="t-digits" checked> Numbers (0–9)</label>
      <label class="t-check"><input type="checkbox" id="t-symbols" checked> Symbols (!@#$…)</label>
      <label class="t-check"><input type="checkbox" id="t-ambiguous"> Avoid look-alikes (I, l, 1, O, 0)</label>
      <div class="t-actions"><button class="t-btn sm" id="t-bulk-btn" type="button">Generate 10</button><button class="t-btn sm" id="t-bulk-copy" type="button" disabled>Copy all</button></div>
      <textarea class="t-textarea" id="t-bulk" readonly style="min-height:150px;margin-top:10px;font-family:ui-monospace,Menlo,Consolas,monospace" aria-label="Ten generated passwords"></textarea>
    </div>
  </div>''',
  article='''<h2>What makes a password strong?</h2>
<p>Length matters most. Every extra character multiplies the number of possible passwords, while adding symbols helps less than people think. A random 20-character password using upper and lower case, numbers and symbols has about 130 bits of entropy, far beyond what any attacker can brute-force. Randomness also matters: passwords people invent follow patterns (names, years, "!" at the end) that cracking tools try first.</p>
<h2>How this generator works</h2>
<p>Passwords are created with <code>crypto.getRandomValues</code>, the cryptographically secure random number generator built into your browser, using rejection sampling so every character is equally likely. At least one character from each type you select is included, and the result is shuffled. Nothing is stored, logged or sent anywhere. Close the page and the password exists only where you saved it.</p>
<h2>Good password habits</h2>
<ul><li>Use a <strong>different password for every account</strong>, so one breach doesn't unlock the rest.</li>
<li>Keep them in a <strong>password manager</strong> (the one built into your browser or phone is fine) instead of memorising them.</li>
<li>Turn on <strong>two-factor authentication</strong> or passkeys for email, banking and social accounts.</li>
<li>Use "avoid look-alikes" when you'll need to type the password by hand, for example a Wi-Fi password.</li></ul>''',
  faqs=[('Is it safe to generate passwords online?', 'Here, yes: the password is created in your browser and never transmitted. You can even disconnect from the internet after the page loads and it still works.'),
        ('How long should my password be?', 'At least 16 characters for important accounts. Length adds more security than complexity.'),
        ('What is entropy?', 'A measure of how unpredictable a password is, in bits. Each extra bit doubles the guesses an attacker needs. 80+ bits is very strong.'),
        ('Do you store generated passwords?', 'No. Nothing is saved or sent anywhere.')])

PAGES['screen-recorder'] = dict(
  name='Screen recorder', cat='camera', script='screen-recorder.js', appcat='MultimediaApplication',
  title='Screen Recorder with Auto Zoom, Crop &amp; Device Frames — Free | WebcamClicks',
  desc='Free online screen recorder with a built-in editor: smart auto-zoom, trim, crop, 16:9 / 9:16 / 1:1 export, gradient backgrounds, Mac, Windows, laptop and phone frames, webcam bubble. No install, no watermark.',
  lead='Record your screen, a window or a tab with your voice and webcam. Then polish it in the built-in editor: smart auto-zoom, trim, crop, beautiful backgrounds, a device frame that matches your computer, and a movable webcam bubble. Export for YouTube, Shorts or Reels. Nothing is uploaded.',
  ui=r"""<div id="t-rec-panel">
  <div class="t-grid">
    <div>
      <div class="t-preview sr-live"><video id="t-preview" playsinline muted></video><div class="sr-cd" id="t-cd" hidden>3</div>
        <p class="sr-live-empty">Your screen preview appears here while recording.</p></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <div id="t-unsupported" hidden><p><strong>Screen recording isn't available in this browser.</strong> Phones and tablets don't allow websites to capture the screen. Use Chrome, Edge, Firefox or Safari on a computer.</p></div>
      <div id="t-controls">
        <p class="sr-timer" id="t-timer" aria-live="off">00:00</p>
        <label class="t-check"><input type="checkbox" id="t-mic" checked> Record my microphone</label>
        <label class="t-check"><input type="checkbox" id="t-sys" checked> Record tab / system audio</label>
        <label class="t-check"><input type="checkbox" id="t-cam"> Record my webcam (bubble added in the editor)</label>
        <label class="t-check"><input type="checkbox" id="t-countdown" checked> 3-2-1 countdown</label>
        <div class="t-row">
          <label class="t-field">Mouse pointer <select class="t-select" id="t-cursor-mode"><option value="always">Always show</option><option value="motion">Only while moving</option><option value="never">Hide</option></select></label>
          <label class="t-field">Quality <select class="t-select" id="t-quality"><option value="standard">Standard</option><option value="high" selected>High</option><option value="max">Maximum</option></select></label>
        </div>
        <div class="t-actions">
          <button class="t-btn primary" id="t-start" type="button">● Start recording</button>
          <button class="t-btn dark" id="t-stop" type="button" hidden>■ Stop</button>
          <button class="t-btn" id="t-pause" type="button" hidden>Pause</button>
        </div>
        <p class="sr-note">After you stop, the editor opens automatically so you can zoom, crop, frame and export.</p>
      </div>
    </div>
  </div>
</div>

<div id="t-editor" class="sr-editor" hidden>
  <div class="sr-main">
    <div class="sr-stage" id="t-ed-stage">
      <canvas id="t-ed-canvas" width="1280" height="720" aria-label="Edited video preview"></canvas>
      <div class="sr-crop" id="t-crop-box" hidden><span data-h="tl"></span><span data-h="tr"></span><span data-h="bl"></span><span data-h="br"></span></div>
    </div>
    <div class="sr-transport">
      <button class="t-btn dark sm" id="t-ed-play" type="button" aria-label="Play or pause">▶</button>
      <span class="sr-time" id="t-ed-time">00:00 / 00:00</span>
      <span class="sr-zoomcount" id="t-zoom-count"></span>
    </div>
    <div class="sr-track" id="t-ed-track" aria-label="Timeline">
      <div class="sr-trim" id="t-ed-trim"></div>
      <div class="sr-lane sr-scenes" id="t-ed-scenes" hidden></div>
      <div class="sr-lane sr-zooms" id="t-ed-zooms"></div>
      <div class="sr-playhead" id="t-ed-playhead"></div>
    </div>
    <div class="sr-legend"><span><i class="lg-scene"></i>Scenes</span><span><i class="lg-zoom"></i>Zooms (light = auto)</span><span>Drag a block to move it · drag its edges to resize</span></div>
    <p class="t-status" id="t-ed-status" role="status"></p>
    <p class="sr-hint">Click the preview to add a zoom right there. Space plays or pauses, ← → skip, Delete removes the selected zoom.</p>
  </div>
  <aside class="sr-side">
    <details open class="sr-auto"><summary>✨ Auto edit</summary>
      <p class="sr-note" style="margin:0 0 10px">One click: gentle zooms on your clicks<span id="t-intro-note"> and camera scenes</span>, then fine-tune anything below.</p>
      <div class="t-row">
        <label class="t-field">Zoom strength <select class="t-select" id="t-zoom-strength"><option value="subtle" selected>Subtle (1.25×)</option><option value="medium">Medium (1.5×)</option><option value="strong">Strong (1.8×)</option></select></label>
        <label class="t-field">Amount <select class="t-select" id="t-zoom-amount"><option value="fewer">Fewer</option><option value="normal" selected>Normal</option><option value="more">More</option></select></label>
      </div>
      <label class="t-check" id="t-intro-wrap" hidden><input type="checkbox" id="t-intro-outro" checked> Camera intro &amp; outro</label>
      <button class="t-btn primary" id="t-auto-edit" type="button" style="width:100%">✨ Auto edit</button>
    </details>
    <details open id="t-scenes-wrap" hidden><summary>Scenes</summary>
      <p class="sr-note" id="t-scene-info" style="margin:0 0 8px"></p>
      <div class="sr-layouts">
        <button type="button" data-layout="camera" aria-pressed="false"><span class="ly ly-camera"></span>Camera full</button>
        <button type="button" data-layout="split" aria-pressed="false"><span class="ly ly-split"></span>Split screen</button>
        <button type="button" data-layout="bubble" aria-pressed="false"><span class="ly ly-bubble"></span>Screen + bubble</button>
        <button type="button" data-layout="screen" aria-pressed="false"><span class="ly ly-screen"></span>Screen only</button>
      </div>
      <div class="t-actions" style="margin-top:10px"><button class="t-btn sm" id="t-scene-split" type="button">✂ Split at playhead</button><button class="t-btn sm" id="t-scene-del" type="button">Delete scene</button></div>
      <div class="t-row" style="margin-top:12px">
        <label class="t-field">Transition <select class="t-select" id="t-trans-style"><option value="smooth" selected>Smooth</option><option value="fade">Fade</option><option value="cut">Cut</option></select></label>
        <label class="t-field">Length <span id="t-trans-dur-val">0.6s</span><input class="t-range" type="range" id="t-trans-dur" min="0.2" max="1.5" step="0.1" value="0.6"></label>
      </div>
    </details>
    <details open><summary>Zoom</summary>
      <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="t-auto-zoom" type="button">Auto zoom only</button><button class="t-btn sm" id="t-add-zoom" type="button">+ Zoom at playhead</button></div>
      <div id="t-zoom-panel" class="sr-zoom-panel" hidden>
        <label class="t-field">Strength <span id="t-zoom-scale-val"></span><input class="t-range" type="range" id="t-zoom-scale" min="1.1" max="2.5" step="0.05" value="1.25"></label>
        <div class="t-row"><label class="t-field">Start (s) <input class="t-input" type="number" id="t-zoom-start" step="0.1"></label><label class="t-field">End (s) <input class="t-input" type="number" id="t-zoom-end" step="0.1"></label></div>
        <p class="sr-note">Click the preview to move the zoom focus.</p>
        <button class="t-btn sm" id="t-zoom-del" type="button">Delete zoom</button>
      </div>
    </details>
    <details open><summary>Trim &amp; crop</summary>
      <div class="t-row"><label class="t-field">Start (s) <input class="t-input" type="number" id="t-trim-in" min="0" step="0.1" value="0"></label><label class="t-field">End (s) <input class="t-input" type="number" id="t-trim-out" min="0" step="0.1"></label></div>
      <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="t-set-in" type="button">Start here</button><button class="t-btn sm" id="t-set-out" type="button">End here</button></div>
      <div class="t-row" style="margin-top:12px"><label class="t-field">Crop shape <select class="t-select" id="t-crop-aspect"><option value="free">Free</option><option value="16:9">16:9</option><option value="9:16">9:16</option><option value="1:1">1:1</option><option value="4:3">4:3</option></select></label>
        <div class="t-field">&nbsp;<button class="t-btn sm" id="t-crop-toggle" type="button">Edit crop</button></div></div>
      <button class="t-btn sm" id="t-crop-reset" type="button">Reset crop</button>
    </details>
    <details open><summary>Background &amp; frame</summary>
      <div class="t-row">
        <label class="t-field">Video size <select class="t-select" id="t-aspect"><option value="auto">Fit recording</option><option value="16:9">16:9 YouTube</option><option value="9:16">9:16 Shorts / Reels / TikTok</option><option value="1:1">1:1 Square</option><option value="4:5">4:5 Feed</option></select></label>
        <label class="t-field">Device frame <select class="t-select" id="t-frame"><option value="none">None</option><option value="mac">Mac window</option><option value="windows">Windows window</option><option value="laptop">Laptop</option><option value="monitor">Monitor</option><option value="phone">Phone</option></select></label>
      </div>
      <div class="t-row">
        <label class="t-field">Background <select class="t-select" id="t-bgsel"><option value="brand">Coral</option><option value="ocean">Ocean</option><option value="mint">Mint</option><option value="grape">Grape</option><option value="night">Night</option><option value="sand">Sand</option><option value="paper">Light grey</option><option value="blur">Blurred video</option><option value="solid">Solid colour</option><option value="none">None (full frame)</option></select></label>
        <label class="t-field">Colour <input class="t-input" type="color" id="t-bgcolor" value="#0e0e12" style="height:42px;padding:4px"></label>
      </div>
      <div class="t-row">
        <label class="t-field">Padding <input class="t-range" type="range" id="t-padding" min="0" max="15" value="6"></label>
        <label class="t-field">Corners <input class="t-range" type="range" id="t-radius" min="0" max="8" step="0.5" value="2"></label>
      </div>
      <label class="t-check"><input type="checkbox" id="t-shadow" checked> Drop shadow</label>
    </details>
    <details open id="t-cam-settings" hidden><summary>Webcam bubble</summary>
      <label class="t-check"><input type="checkbox" id="t-cam-show" checked> Show webcam</label>
      <div class="t-row">
        <label class="t-field">Position <select class="t-select" id="t-cam-pos"><option value="br">Bottom right</option><option value="bl">Bottom left</option><option value="tr">Top right</option><option value="tl">Top left</option></select></label>
        <label class="t-field">Shape <select class="t-select" id="t-cam-shape"><option value="circle">Circle</option><option value="rounded">Rounded</option><option value="square">Square</option></select></label>
      </div>
      <label class="t-field">Size <input class="t-range" type="range" id="t-cam-size" min="12" max="40" value="22"></label>
    </details>
    <details open><summary>Export</summary>
      <div class="t-row">
        <label class="t-field">Resolution <select class="t-select" id="t-res"><option value="720">720p</option><option value="1080" selected>1080p</option><option value="1440">1440p</option></select></label>
        <label class="t-field">Speed <select class="t-select" id="t-speed"><option value="1">1×</option><option value="1.25">1.25×</option><option value="1.5">1.5×</option><option value="2">2×</option></select></label>
      </div>
      <div class="sr-progress" id="t-export-bar" hidden><div id="t-export-fill"></div></div>
      <div class="t-actions"><button class="t-btn primary" id="t-export" type="button">Export video</button><button class="t-btn sm" id="t-dl-raw" type="button">Download original</button></div>
      <div class="t-actions" id="t-ed-result" hidden><button class="t-btn dark" id="t-dl-final" type="button">⬇ Download edited video</button></div>
      <p class="sr-note">Export plays the video once in real time (faster at higher speeds). Keep this tab visible.</p>
      <button class="t-btn sm" id="t-new-rec" type="button" style="margin-top:6px">New recording</button>
    </details>
  </aside>
</div>
<style>
.sr-live {{ background:#0e0e12; min-height:300px; position:relative; }}
.sr-live video {{ width:100%; max-height:520px; background:#0e0e12; position:relative; z-index:1; }}
.sr-live video:not([src]):not(.on) {{ }}
.sr-live-empty {{ position:absolute; color:#8a8e99; font-size:.9rem; margin:0; }}
.sr-cd {{ position:absolute; inset:0; z-index:2; display:grid; place-items:center; font:800 7rem/1 var(--font); color:#fff; background:rgba(14,14,18,.55); }}
.sr-timer {{ margin:0 0 12px; font:800 2rem/1 ui-monospace,Menlo,monospace; letter-spacing:-.02em; }}
.sr-note {{ font-size:.8rem; color:var(--ink-2); margin:8px 0 0; line-height:1.5; }}
.sr-editor {{ display:grid; grid-template-columns:minmax(0,1fr) 340px; gap:20px; align-items:start; }}
.sr-stage {{ position:relative; background:repeating-conic-gradient(#eef0f3 0 25%,#fff 0 50%) 0 0/18px 18px; border-radius:14px; border:1px solid var(--line); padding:12px; display:grid; place-items:center; }}
.sr-stage canvas {{ max-width:100%; max-height:62vh; height:auto; display:block; border-radius:6px; cursor:crosshair; }}
.sr-stage.cropping canvas {{ cursor:default; }}
.sr-crop {{ position:absolute; border:2px solid #fff; box-shadow:0 0 0 9999px rgba(14,14,18,.55); cursor:move; touch-action:none; }}
.sr-crop span {{ position:absolute; width:16px; height:16px; background:#fff; border:2px solid var(--accent); border-radius:4px; }}
.sr-crop [data-h=tl] {{ left:-8px; top:-8px; cursor:nwse-resize; }} .sr-crop [data-h=tr] {{ right:-8px; top:-8px; cursor:nesw-resize; }}
.sr-crop [data-h=bl] {{ left:-8px; bottom:-8px; cursor:nesw-resize; }} .sr-crop [data-h=br] {{ right:-8px; bottom:-8px; cursor:nwse-resize; }}
.sr-transport {{ display:flex; align-items:center; gap:12px; margin:12px 0 8px; }}
.sr-time {{ font:600 .9rem ui-monospace,Menlo,monospace; color:var(--ink-2); }}
.sr-zoomcount {{ margin-left:auto; font-size:.82rem; color:var(--ink-2); font-weight:600; }}
.sr-track {{ position:relative; height:44px; border-radius:12px; background:var(--surface-3); cursor:pointer; touch-action:none; overflow:hidden; }}
.sr-track.has-scenes {{ height:76px; }}
.sr-lane {{ position:absolute; left:0; right:0; height:26px; }}
.sr-scenes {{ top:8px; }}
.sr-track .sr-zooms {{ top:10px; height:24px; }}
.sr-track.has-scenes .sr-zooms {{ top:42px; }}
.ed-block {{ position:absolute; top:0; height:100%; border-radius:7px; font:800 .7rem/24px var(--font); color:#fff; cursor:grab; overflow:hidden; white-space:nowrap; padding:0 8px; box-sizing:border-box; user-select:none; touch-action:none; }}
.ed-block::before, .ed-block::after {{ content:""; position:absolute; top:4px; bottom:4px; width:3px; border-radius:2px; background:rgba(255,255,255,.7); }}
.ed-block::before {{ left:3px; }} .ed-block::after {{ right:3px; }}
.ed-block:active {{ cursor:grabbing; }}
.ed-scene {{ border:2px solid #fff; line-height:22px; }}
.sc-camera {{ background:#7c3aed; }} .sc-split {{ background:#0ea5e9; }} .sc-bubble {{ background:#0e0e12; }} .sc-screen {{ background:#5b5f6b; }}
.sr-legend {{ display:flex; flex-wrap:wrap; gap:6px 16px; margin-top:6px; font-size:.76rem; color:var(--ink-3); }}
.sr-legend i {{ display:inline-block; width:10px; height:10px; border-radius:3px; margin-right:5px; vertical-align:-1px; }}
.lg-scene {{ background:#0e0e12; }} .lg-zoom {{ background:var(--accent); }}
.sr-layouts {{ display:grid; grid-template-columns:1fr 1fr; gap:8px; }}
.sr-layouts button {{ display:flex; flex-direction:column; align-items:center; gap:6px; padding:10px 6px; border:1px solid var(--line-strong); border-radius:12px; background:#fff; font:700 .78rem var(--font); color:var(--ink); cursor:pointer; }}
.sr-layouts button[aria-pressed="true"] {{ border-color:var(--ink); box-shadow:0 0 0 2px var(--ink); }}
.ly {{ position:relative; width:56px; height:34px; border-radius:5px; background:#dfe2e8; overflow:hidden; }}
.ly::before, .ly::after {{ content:""; position:absolute; }}
.ly-camera::before {{ inset:0; background:#7c3aed; }}
.ly-split::before {{ left:3px; top:3px; bottom:3px; width:30px; background:#5b5f6b; border-radius:2px; }} .ly-split::after {{ right:3px; top:3px; bottom:3px; width:17px; background:#7c3aed; border-radius:2px; }}
.ly-bubble::before {{ inset:3px; background:#5b5f6b; border-radius:2px; }} .ly-bubble::after {{ right:5px; bottom:5px; width:11px; height:11px; border-radius:50%; background:#7c3aed; border:1.5px solid #fff; }}
.ly-screen::before {{ inset:3px; background:#5b5f6b; border-radius:2px; }}
.sr-auto {{ border-color:var(--ink) !important; }}
.sr-trim {{ position:absolute; top:0; bottom:0; background:#fff; border:2px solid var(--ink); border-radius:12px; box-sizing:border-box; }}
.sr-zooms {{ position:absolute; left:0; right:0; top:26px; height:24px; }}
.ed-zoom {{ background:var(--accent); }}
.ed-zoom.auto {{ background:#ff9a82; }}
.ed-block.sel {{ outline:3px solid var(--ink); outline-offset:1px; z-index:2; }}
.sr-playhead {{ position:absolute; top:-2px; bottom:-2px; width:2px; background:var(--ink); pointer-events:none; }}
.sr-hint {{ font-size:.8rem; color:var(--ink-3); margin:6px 0 0; }}
.sr-side details {{ border:1px solid var(--line); border-radius:14px; padding:12px 14px; margin-bottom:10px; background:#fff; }}
.sr-side summary {{ font-weight:800; cursor:pointer; margin-bottom:10px; }}
.sr-side .t-field {{ font-size:.8rem; }}
.sr-zoom-panel {{ margin-top:12px; padding:12px; border-radius:12px; background:var(--surface-2); }}
.sr-progress {{ height:8px; border-radius:999px; background:var(--surface-3); overflow:hidden; margin:6px 0; }}
.sr-progress div {{ height:100%; width:0; background:var(--accent); transition:width .2s; }}
@media (max-width: 980px) {{ .sr-editor {{ grid-template-columns:1fr; }} }}
</style>""".format(),
  article='''<h2>How to record your screen</h2>
<ol><li>Choose your options: microphone, system or tab audio, and an optional webcam bubble.</li>
<li>Press <strong>Start recording</strong> and pick what to share: an entire screen, a window or a browser tab.</li>
<li>Do your demo, lesson or walkthrough. Switch apps freely; the recording continues.</li>
<li>Press <strong>Stop</strong> (or your browser's "Stop sharing" button), preview the video and download it.</li></ol>
<h2>Polish it in the built-in editor</h2>
<p>When you stop recording, the editor opens with your video, ready to export in seconds or fine-tune:</p>
<ul>
<li><strong>One-click Auto edit.</strong> Adds gentle zooms on your clicks and, if you recorded your webcam, a camera intro and outro with smooth transitions. Everything it creates can be changed.</li>
<li><strong>Click-aware zoom.</strong> The editor looks for what a click does: a small area of the screen that suddenly reacts after being still, such as a menu opening or a button highlighting. Typing, videos and scrolling are ignored, and nearby clicks share one zoom so the picture doesn't chase every movement. Choose Subtle, Medium or Strong and Fewer, Normal or More, drag zooms on the timeline, or click the preview to add one exactly where you want.</li>
<li><strong>Scenes with full control.</strong> Split the video at any moment and choose what viewers see in each part: your camera full screen, a split screen with you beside the screen, the screen with a webcam bubble, or the screen only. For example, camera full for the first 5 seconds, then split screen, then the screen with a bubble. Drag scene edges to retime them, and pick Smooth, Fade or Cut transitions.</li>
<li><strong>Trim and crop.</strong> Cut the start and end, and crop away browser tabs, taskbars or a second monitor, freely or locked to 16:9, 9:16, 1:1 or 4:3.</li>
<li><strong>Video size for every platform.</strong> 16:9 for YouTube and courses, 9:16 for Shorts, Reels and TikTok, 1:1 and 4:5 for feeds.</li>
<li><strong>Backgrounds and device frames.</strong> Place your recording on a gradient, solid colour or blurred backdrop with padding, rounded corners and a soft shadow, inside a Mac or Windows window, a laptop, a monitor or a phone. The frame is chosen automatically from what you recorded (tab, window or screen) and your operating system.</li>
<li><strong>Speed and resolution.</strong> Export at 720p, 1080p or 1440p and speed up slow parts with 1.25× to 2×.</li>
</ul>
<h3>About the mouse pointer</h3>
<p>Choose whether the pointer is always recorded, only while it moves, or hidden. Browsers that don't support this choice always record the pointer, and the page tells you when that happens. Browsers don't share the pointer position or clicks outside the page, so custom pointer styles and click ripples aren't possible in a web app. Auto zoom finds your clicks from what changes on screen instead.</p>
<h2>The webcam bubble</h2>
<p>Tick <em>Record my webcam</em> and your camera is recorded alongside the screen as a separate track. In the editor you choose where the bubble goes, its size and its shape (circle, rounded or square), or hide it for parts of a project, and it is mirrored like a selfie. Want to check your lighting and background first? Open the <a href="/webcam-test">webcam test</a> or the <a href="/#background">AI background changer</a>.</p>
<h2>Audio tips</h2>
<ul><li><strong>System audio</strong> is available when sharing a browser tab in Chrome and Edge, or the whole screen on Windows. macOS doesn't let browsers capture system audio from a full screen or window.</li>
<li>Test your microphone level with the <a href="/mic-test">mic test</a> before an important recording.</li>
<li>Use headphones to stop speaker sound echoing into your microphone.</li></ul>
<h2>Formats</h2>
<p>Recordings are saved as MP4 where your browser supports it (recent Chrome, Edge and Safari) and as WebM otherwise. WebM plays in all modern browsers, VLC and YouTube uploads; convert it to MP4 with any video editor if you need to.</p>''',
  faqs=[('Is there a time limit or watermark?', 'No. Record as long as your device has free storage, with no watermark.'),
        ('Is my recording uploaded?', 'No. The video is recorded in your browser and saved directly to your device.'),
        ('Can I record on my phone?', 'Mobile browsers do not allow websites to capture the screen. Use the built-in screen recorder on iPhone or Android instead.'),
        ('Why is there no system sound?', 'Share a browser tab (and tick "Share tab audio") in Chrome or Edge, or share the entire screen on Windows. macOS blocks system audio capture from browsers.')])

# ----------------------------------------------------------------------------- build tool pages
def related_cards(slug, cat):
    same = [t for t in TOOLS if t[2] == cat and t[0] != f'/{slug}']
    others = [t for t in TOOLS if t[2] != cat and t[5]][:4]
    return ''.join(tool_card(t) for t in (same + others)[:8])

for slug, p in PAGES.items():
    cat = p['cat']
    crumbs = [('Home', '/'), ('Tools', '/tools'), (CAT_NAME[cat], f'/tools#{cat}'), (p['name'], f'/{slug}')]
    body = f'''<main class="t-main"{f' data-mode="{p["mode"]}"' if p.get("mode") else ''}>
  <nav class="t-crumbs" aria-label="Breadcrumb"><a href="/">Home</a> › <a href="/tools">Tools</a> › <a href="/tools#{cat}">{CAT_NAME[cat]}</a> › {p["name"]}</nav>
  <section class="t-hero">
    <p class="t-badge">Free · Private · No upload</p>
    <h1>{p["name"]}</h1>
    <p>{p["lead"]}</p>
  </section>
  <section class="t-card" aria-label="{p["name"]} tool">
  {p["ui"]}
  </section>
  <article class="t-article">
{p["article"]}
  </article>
  {faq_html(p["faqs"])}
  <section class="t-related"><h2>More free tools</h2><div class="t-related-grid">{related_cards(slug, cat)}</div></section>
</main>'''
    schema = [crumbs_schema(crumbs), app_schema(p['name'], slug, re.sub('<[^>]+>', '', p['desc']), p['appcat']), faq_schema(p['faqs'])]
    open(f'{slug}.html', 'w', encoding='utf-8').write(page(slug, p['title'], html.unescape(p['desc']), body, schema, p['script']))
    print('wrote', slug)

# ----------------------------------------------------------------------------- hub
hub_sections = ''
for cid, cname, cdesc in CATEGORIES:
    cards = ''.join(tool_card(t) for t in TOOLS if t[2] == cid)
    hub_sections += f'<section class="hub-section" id="{cid}" data-cat><h2>{cname}</h2><p>{cdesc}</p><div class="hub-grid">{cards}</div></section>\n'
hub_body = f'''<main class="t-main">
  <section class="t-hero">
    <p class="t-badge">{len(TOOLS)} free tools · Nothing is uploaded</p>
    <h1>Free online tools</h1>
    <p>Camera, photo, PDF, file and text tools for everyday jobs. Every tool runs in your browser, so your files stay on your device, there's nothing to install and no account is needed.</p>
  </section>
  <div class="hub-search"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
    <input type="search" id="hub-q" placeholder="Search tools: pdf, compress, rename, qr…" aria-label="Search tools"></div>
  <nav class="hub-cats" aria-label="Tool categories">{''.join(f'<a href="#{c[0]}">{c[1]}</a>' for c in CATEGORIES)}</nav>
  {hub_sections}
  <p class="hub-empty" id="hub-empty" hidden>No tools match that search.</p>
  <article class="t-article">
    <h2>Why use browser-based tools?</h2>
    <p>Most free online converters upload your files to a server, process them there and send them back. That is slow for big files and risky for private documents like IDs, contracts and family photos. Every WebcamClicks tool runs locally using modern browser technology: the canvas for images, WebAssembly and your graphics chip for AI, the File System Access API for renaming, and open-source libraries such as pdf-lib for PDFs. Your files never leave your device, so the tools are fast, private and keep working even on a weak connection.</p>
    <h2>Popular tasks</h2>
    <ul>
      <li><a href="/image-compressor">Compress photos for email</a> or an upload form with a size limit.</li>
      <li><a href="/jpg-to-pdf">Turn phone scans into a PDF</a> and <a href="/merge-pdf">merge documents</a> for an application.</li>
      <li><a href="/bulk-file-rename">Rename a folder of holiday photos</a> in date order.</li>
      <li><a href="/passport-photo">Make a passport photo</a> and print it on 4×6 paper.</li>
      <li><a href="/screen-recorder">Record a tutorial</a> with your webcam in the corner.</li>
      <li><a href="/qr-code-generator">Create a Wi-Fi QR code</a> for guests.</li>
    </ul>
  </article>
</main>
<script>
(function () {{
  var q = document.getElementById('hub-q'), empty = document.getElementById('hub-empty');
  q.addEventListener('input', function () {{
    var t = q.value.trim().toLowerCase(), any = false;
    document.querySelectorAll('[data-cat]').forEach(function (sec) {{
      var shown = 0;
      sec.querySelectorAll('.tool-card').forEach(function (c) {{
        var ok = !t || c.textContent.toLowerCase().indexOf(t) > -1; c.hidden = !ok; if (ok) shown++;
      }});
      sec.hidden = !shown; if (shown) any = true;
    }});
    empty.hidden = any;
  }});
}})();
</script>'''
hub_schema = [crumbs_schema([('Home', '/'), ('Tools', '/tools')]),
  {'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'WebcamClicks free online tools',
   'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'name': t[1], 'url': SITE + (t[0] if t[0].startswith('/') else '/' + t[0])} for i, t in enumerate(TOOLS)]}]
open('tools.html', 'w', encoding='utf-8').write(page('tools', 'Free Online Tools — Image, PDF, File, Camera &amp; Text | WebcamClicks',
  'Free browser-based tools: image converter, compressor and resizer, background remover, JPG to PDF, merge and split PDF, bulk file renamer, QR codes, passwords, screen recorder and more. No uploads.',
  hub_body, hub_schema, None, '/tools'))
print('wrote tools')

# ----------------------------------------------------------------------------- update other English pages: nav + footer + bottom bar + versions
OWN = set(PAGES) | {'tools'}
FOOT = footer()
for f in sorted(glob.glob('*.html')):
    slug = f[:-5]
    if slug in OWN: continue
    s = read(f); o = s
    home = slug == 'index'
    cur = '/#camera' if home else f'/{slug}'
    s = re.sub(r'<nav class="site-nav".*?</nav>\s*<a class="header-cta"[^>]*>[^<]*</a>', lambda m: header_nav(cur, home), s, count=1, flags=re.S)
    s = re.sub(r'<footer class="site-footer">.*?</footer>', lambda m: FOOT, s, count=1, flags=re.S)
    if not home:   # index keeps its app-specific bar (gallery button)
        s = re.sub(r'<nav class="mobile-bottom-nav"[^>]*>.*?</nav>', lambda m: bottom_nav(cur), s, count=1, flags=re.S)
    s = re.sub(r'(href="/styles/[a-z-]+\.css)\?v=[^"]*"', rf'\1?v={V}"', s)
    s = re.sub(r'(src="/js/[a-z-]+\.js)\?v=[^"]*"', rf'\1?v={V}"', s)
    if s != o: open(f, 'w', encoding='utf-8').write(s); print('updated', f)

# ----------------------------------------------------------------------------- sitemap + llms.txt
sm = read('sitemap.xml')
for slug in sorted(OWN):
    loc = f'{SITE}/{slug}'
    if f'<loc>{loc}</loc>' not in sm:
        sm = sm.replace('</urlset>', f'  <url>\n    <loc>{loc}</loc>\n    <lastmod>2026-11-20</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>{"0.9" if slug == "tools" else "0.8"}</priority>\n  </url>\n</urlset>')
open('sitemap.xml', 'w', encoding='utf-8').write(sm)
llms = read('llms.txt')
block = '\n## Free browser tools (no uploads)\n' + ''.join(f'- [{t[1]}]({SITE}{t[0] if t[0] != "/#camera" else "/"}): {t[4]}\n' for t in TOOLS if t[0].lstrip('/') in OWN) + f'- [All tools]({SITE}/tools): hub of every tool by category.\n'
llms = re.sub(r'\n## Free browser tools \(no uploads\)\n.*?(?=\n## |\Z)', '', llms, flags=re.S)
open('llms.txt', 'w', encoding='utf-8').write(llms.rstrip('\n') + '\n' + block)
print('sitemap + llms updated')

# ----------------------------------------------------------------------------- home page: "Free everyday tools" section
s = read('index.html')
cards = ''.join(tool_card(t) for t in TOOLS if t[5])
block = f'''<section class="content-section home-tools" id="tools">
  <h2 class="section-title">Free everyday tools</h2>
  <p class="muted" style="max-width:640px">Convert and compress images, make PDFs, rename files in bulk and more. Like the camera, every tool runs on your device, so nothing is uploaded.</p>
  <div class="hub-grid" style="margin-top:18px">{cards}</div>
  <p style="margin-top:18px"><a class="t-btn" href="/tools">See all {len(TOOLS)} tools →</a></p>
</section>
'''
if '<section class="content-section home-tools"' in s:
    s = re.sub(r'<section class="content-section home-tools".*?</section>\n', lambda m: block, s, count=1, flags=re.S)
else:
    i = s.index('<section id="faq"')
    s = s[:i] + block + '\n' + s[i:]
if '/styles/tools.css' not in s:
    s = re.sub(r'(<link rel="stylesheet" href="/styles/main\.css\?v=[^"]*">)', rf'\1\n<link rel="stylesheet" href="/styles/tools.css?v={V}">', s, count=1)
open('index.html', 'w', encoding='utf-8').write(s)
print('home tools section updated')


# ----------------------------------------------------------------------------- content-hash cache busting
# Every local stylesheet/script URL gets ?v=<hash of that file>, so a changed file always gets a
# new URL and a browser can never pair new HTML with an old cached script (or the other way round).
import hashlib
_hash_cache = {}
def asset_hash(rel):
    if rel not in _hash_cache:
        try: _hash_cache[rel] = hashlib.sha1(open(rel.lstrip('/'), 'rb').read()).hexdigest()[:10]
        except FileNotFoundError: _hash_cache[rel] = V
    return _hash_cache[rel]
ASSET_RE = re.compile(r'((?:href|src)=")(/(?:styles|js)/[A-Za-z0-9_./-]+\.(?:css|js))(?:\?v=[^"]*)?"')
changed = 0
for f in sorted(glob.glob('*.html') + glob.glob('*/index.html')):
    t = read(f)
    n = ASSET_RE.sub(lambda m: f'{m.group(1)}{m.group(2)}?v={asset_hash(m.group(2))}"', t)
    if n != t: open(f, 'w', encoding='utf-8').write(n); changed += 1
print('asset versions updated on', changed, 'pages')
