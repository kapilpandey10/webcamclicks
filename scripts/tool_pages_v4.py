# WebcamClicks — tool pages, 2026-11 batch 3 (voice typing, photo booth, organize PDF, screenshot beautifier, collage).
# Executed by build-tool-pages.py with its globals (PAGES, DROP, icon, html) and tool_pages_v2's PRIVACY.

# ------------------------------------------------------------------------------------------- voice typing
PAGES['voice-typing'] = dict(
  name='Voice typing', cat='text', script='voice-typing.js', appcat='UtilitiesApplication', badge='Free · Nothing to install · Works in Chrome',
  title='Voice Typing Online — Free Speech to Text in Nepali, Hindi & 49 Languages | WebcamClicks',
  desc='Free online voice typing: speak and your words appear as text. 49 languages including Nepali, Hindi and English, spoken punctuation, copy or download. No sign-up.',
  lead='Click the microphone and talk: your words appear as text as you speak. Say “comma”, “full stop” or “new line” for punctuation, fix anything by typing, then copy or download it. Works in 49 languages, including Nepali, Hindi, Bengali and English.',
  ui='''<div class="t-grid vt-grid">
    <div>
      <div class="vt-editor">
        <textarea class="vt-text" id="vt-text" placeholder="Press the microphone and start speaking… your words appear here. You can also type and edit." aria-label="Your text"></textarea>
        <p class="vt-live" id="vt-live" aria-live="off"></p>
      </div>
      <div class="vt-foot"><span id="vt-count" class="muted">0 words</span>
        <div class="t-actions" style="margin:0"><button class="t-btn sm" id="vt-undo" type="button">↶ Undo</button><button class="t-btn sm" id="vt-clear" type="button">Clear</button><button class="t-btn sm" id="vt-download" type="button">Download .txt</button><button class="t-btn sm primary" id="vt-copy" type="button">Copy text</button></div></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <div class="vt-micwrap"><button class="vt-mic" id="vt-mic" type="button" aria-pressed="false" aria-label="Start or stop voice typing"><span class="vt-level" id="vt-level"></span><svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg></button>
        <p class="vt-mic-label" id="vt-mic-label">Tap to start speaking</p><p class="muted vt-kbd">Shortcut: <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>Space</kbd></p></div>
      <p class="cap-model" id="vt-note" data-state="off" hidden></p>
      <label class="t-field">Language <select class="t-select" id="vt-lang"></select></label>
      <label class="t-check"><input type="checkbox" id="vt-cmds" checked> Spoken punctuation (“comma”, “full stop”, “new line”)</label>
      <label class="t-check"><input type="checkbox" id="vt-caps" checked> Capital letter at the start of sentences</label>
      <details class="vt-help"><summary>Voice commands</summary>
        <ul><li><b>comma</b>, <b>full stop</b> / <b>period</b>, <b>question mark</b>, <b>exclamation mark</b>, <b>colon</b>, <b>semicolon</b></li>
        <li><b>new line</b>, <b>new paragraph</b></li><li><b>open quote</b> … <b>close quote</b>, <b>open bracket</b> … <b>close bracket</b>, <b>dash</b></li>
        <li>Nepali &amp; Hindi: <b>पूर्णविराम</b> (।), <b>अल्पविराम</b> (,), <b>नयाँ लाइन</b></li></ul></details>
    </div>
  </div>''',
  article='''<h2>How to type with your voice</h2>
<ol><li><strong>Choose your language</strong>, including regional English (US, UK, India, Australia) and Spanish (Spain, Mexico, US).</li>
<li><strong>Press the microphone</strong> and allow microphone access the first time.</li>
<li><strong>Speak naturally.</strong> Grey text shows what is being heard; it turns into normal text when you pause. Text goes where your cursor is, so you can click anywhere to dictate into the middle of a document.</li>
<li><strong>Edit, then copy or download.</strong> Your text is saved in this browser, so it is still here if you close the tab by accident.</li></ol>
<h2>Tips for accurate dictation</h2>
<ul><li>Use a headset or sit close to the microphone, and speak at a normal pace with short pauses between sentences.</li>
<li>Say punctuation out loud: “I'll be there at five <em>comma</em> see you soon <em>full stop</em>”.</li>
<li>Names and jargon can come out wrong: just click and fix them by typing.</li>
<li>Check your microphone first with the <a href="/mic-test">mic test</a>.</li></ul>
<h2>Which browsers work?</h2>
<p>Voice typing uses the speech recognition built into your browser, so there is nothing to install. It works best in <strong>Google Chrome</strong> on a computer or Android phone; Microsoft Edge and Safari work too. Brave, Firefox and Opera do not include speech recognition. In Chrome and Edge your voice is sent to Google's or Microsoft's speech service to be turned into text (unless your browser can recognise the language on the device); the text itself stays in this browser.</p>
<p>Need to turn a video into text instead? Use <a href="/auto-captions">auto captions</a>, or <a href="/image-to-text">image to text</a> for photos and scans.</p>''',
  faqs=[('Is voice typing free?', 'Yes, completely free with no sign-up and no time limit.'),
        ('Does it work in Nepali and Hindi?', 'Yes. Choose Nepali or Hindi and speak; the text is written in Devanagari. Say “पूर्णविराम” for a full stop.'),
        ('Why does it stop listening?', 'It keeps listening through pauses until you press the microphone again. If it stops, check that the microphone is allowed for this site and that you are online.'),
        ('Is my text saved?', 'Your text is saved only in this browser on this device, so it survives a refresh. Press Clear to remove it.'),
        ('Can I use it on my phone?', 'Yes, in Chrome on Android and Safari on iPhone. Tap the microphone and allow access.')])

# ------------------------------------------------------------------------------------------- photo booth
PAGES['photo-booth'] = dict(
  name='Photo booth: GIF & boomerang', cat='camera', script='photo-booth.js', appcat='MultimediaApplication',
  title='Online Photo Booth — Photo Strip, GIF & Boomerang from Webcam, Free | WebcamClicks',
  desc='Free online photo booth: take a 4-photo strip, an animated GIF or a boomerang with your webcam. Filters, countdown, captions. Download JPG, GIF or MP4. No upload.',
  lead='Turn your webcam into a photo booth. Take a classic four-photo strip with a caption, an animated GIF, or a back-and-forth boomerang, with filters and a countdown. Everything is captured and made on your device.',
  ui='''<div class="t-grid">
    <div>
      <div class="pb-stage" id="pb-stage">
        <video id="pb-video" playsinline muted autoplay></video>
        <div class="pb-idle" id="pb-idle">Your camera preview appears here</div>
        <div class="pb-count" id="pb-count" hidden></div><div class="pb-flash" id="pb-flash"></div><span class="pb-rec">● REC</span>
      </div>
      <div class="t-actions">
        <button class="t-btn primary" id="pb-start" type="button">📷 Start camera</button>
        <button class="t-btn primary" id="pb-shoot" type="button" disabled>📸 Take 4 photos</button>
        <select class="t-select" id="pb-camera" hidden aria-label="Camera" style="width:auto"></select>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="pb-result" id="pb-result" hidden>
        <div class="pb-result-media" id="pb-result-media"></div>
        <div class="t-actions"><button class="t-btn primary" id="pb-save" type="button">⬇ Download</button><button class="t-btn" id="pb-again" type="button">Take another</button><span class="muted" id="pb-result-info"></span></div>
        <div class="pb-gallery" id="pb-gallery" aria-label="Your takes"></div>
      </div>
    </div>
    <div class="t-panel">
      <h2>Mode</h2>
      <div class="pb-modes" id="pb-modes" role="radiogroup" aria-label="Mode">
        <button type="button" role="radio" data-mode="strip" aria-checked="true"><b>Photo strip</b><small>4 photos + caption</small></button>
        <button type="button" role="radio" data-mode="gif" aria-checked="false"><b>GIF</b><small>animated loop</small></button>
        <button type="button" role="radio" data-mode="boomerang" aria-checked="false"><b>Boomerang</b><small>forwards &amp; back</small></button>
      </div>
      <h2 style="margin-top:16px">Filter</h2>
      <div class="pb-filters" id="pb-filters"></div>
      <div class="t-row" style="margin-top:12px">
        <label class="t-field">Countdown <select class="t-select" id="pb-timer"><option value="1">1 s</option><option value="3" selected>3 s</option><option value="5">5 s</option><option value="10">10 s</option></select></label>
        <label class="t-check" style="align-self:end"><input type="checkbox" id="pb-mirror" checked> Mirror</label>
      </div>
      <div id="pb-strip-opts">
        <div class="t-row">
          <label class="t-field">Layout <select class="t-select" id="pb-layout"><option value="strip">Classic strip (4 tall)</option><option value="grid">2 × 2 grid</option><option value="row">Wide row</option></select></label>
          <label class="t-field">Frame colour <input type="color" id="pb-framec" value="#ffffff" style="width:100%;height:40px"></label>
        </div>
        <label class="t-field">Caption <input class="t-input" id="pb-caption" maxlength="40" placeholder="e.g. Sara's 21st 🎉"></label>
        <label class="t-check"><input type="checkbox" id="pb-date" checked> Add today's date</label>
      </div>
      <div id="pb-motion-opts" hidden>
        <div class="t-row">
          <label class="t-field">Length <select class="t-select" id="pb-len"><option value="1.5">1.5 s</option><option value="2" selected>2 s</option><option value="3">3 s</option></select></label>
          <label class="t-field">Shape <select class="t-select" id="pb-shape"><option value="square">Square</option><option value="portrait">Portrait 4:5</option><option value="story">Story 9:16</option><option value="wide">Wide 16:9</option></select></label>
        </div>
        <label class="t-field">Save as <select class="t-select" id="pb-out"><option value="gif">GIF (plays everywhere)</option><option value="mp4">MP4 video (sharper, for Instagram)</option></select></label>
      </div>
      <label class="t-check"><input type="checkbox" id="pb-sound" checked> Shutter sounds</label>
    </div>
  </div>''',
  article='''<h2>Three ways to have fun with your webcam</h2>
<ul><li><strong>Photo strip:</strong> four photos with a countdown between each, laid out like a classic photo-booth strip, a 2 × 2 grid or a wide row, with your caption and the date. Perfect for parties, video calls with friends and long-distance birthdays.</li>
<li><strong>GIF:</strong> a short animated loop to send in chats or post anywhere GIFs work.</li>
<li><strong>Boomerang:</strong> a quick burst that plays forwards and then backwards, over and over. Save it as an MP4 for Instagram and TikTok, or as a GIF.</li></ul>
<h2>How to use the photo booth</h2>
<ol><li>Press <strong>Start camera</strong> and allow camera access.</li>
<li>Choose a mode and a filter (B&amp;W, Vintage, Warm, Vivid, Noir and more), and set the countdown.</li>
<li>Press the shoot button and pose. Your result appears below; download it, or take another. Earlier takes stay in the gallery until you close the page.</li></ol>
<p>Want more effects? The <a href="/#camera">webcam studio</a> has 90+ live filters, and the <a href="/background-remover">background remover</a> can cut you out of any photo.</p>''' + PRIVACY,
  faqs=[('Is the photo booth free?', 'Yes. No sign-up and no watermark.'),
        ('Are my photos uploaded?', 'No. Photos, GIFs and boomerangs are made in your browser and only saved when you download them.'),
        ('How do I post a boomerang on Instagram?', 'Choose Boomerang, save as MP4 video, then upload it as a Reel or story. Instagram doesn\'t accept GIF uploads.'),
        ('Can I use my phone?', 'Yes. Open this page in your phone\'s browser and allow the camera. Use the camera menu to switch between front and back cameras.'),
        ('Why is my GIF grainy?', 'GIFs can only use 256 colours. For the sharpest result, save the boomerang as MP4, and use good, even light.')])

# ------------------------------------------------------------------------------------------- organize PDF
PAGES['organize-pdf'] = dict(
  name='Organize PDF pages', cat='pdf', script='pdf-organize.js', appcat='UtilitiesApplication',
  title='Organize PDF Pages — Reorder, Rotate, Delete & Add Pages Free | WebcamClicks',
  desc='Rearrange PDF pages by dragging, rotate, delete, duplicate and add blank pages, or combine several PDFs. Free, private: your PDF never leaves your device.',
  lead='See every page of your PDF as a thumbnail. Drag pages into a new order, rotate the sideways ones, delete what you don\'t need, add blank pages or pages from another PDF, then save. Your files never leave your device.',
  ui=f'''<div>
    {DROP("application/pdf,.pdf", "Drop PDF files here", "One or more PDFs · thumbnails appear below · nothing is uploaded")}
    <p class="t-status" id="t-status" role="status"></p>
    <div class="po-bar" id="po-bar" hidden>
      <div class="po-tools">
        <button class="t-btn sm" id="po-selall" type="button">Select all</button>
        <button class="t-btn sm" id="po-rotl" type="button" title="Rotate selected left">⟲ Left</button>
        <button class="t-btn sm" id="po-rotr" type="button" title="Rotate selected right">⟳ Right</button>
        <button class="t-btn sm" id="po-dup" type="button">Duplicate</button>
        <button class="t-btn sm" id="po-del" type="button">Delete</button>
        <button class="t-btn sm" id="po-blank" type="button">+ Blank page</button>
        <button class="t-btn sm" id="po-add" type="button">+ Add PDF</button><input type="file" id="po-add-in" accept="application/pdf,.pdf" multiple hidden>
        <button class="t-btn sm" id="po-reverse" type="button">Reverse order</button>
        <button class="t-btn sm" id="po-undo" type="button">↶ Undo</button>
      </div>
      <div class="po-save"><span class="muted" id="po-info"></span><label class="po-zoom" title="Thumbnail size">🔍<input type="range" id="po-size" min="110" max="260" value="160" aria-label="Thumbnail size"></label>
        <button class="t-btn sm" id="po-extract" type="button">Save selected only</button><button class="t-btn primary" id="po-save" type="button">⬇ Save PDF</button></div>
    </div>
    <ol class="po-grid" id="po-grid" aria-label="Pages"></ol>
  </div>''',
  article='''<h2>How to rearrange PDF pages</h2>
<ol><li><strong>Drop your PDF.</strong> Every page appears as a thumbnail. Drop more PDFs (or use <em>Add PDF</em>) to combine them.</li>
<li><strong>Drag pages</strong> to put them in order. Select several with Shift- or Ctrl-click and drag them together. On a phone, press and hold a page, then drag.</li>
<li><strong>Rotate, delete or duplicate</strong> with the buttons on each page or in the toolbar. Add blank pages for notes or double-sided printing.</li>
<li><strong>Save PDF</strong> downloads the new file, or <strong>Save selected only</strong> keeps just the pages you picked.</li></ol>
<h2>Keyboard shortcuts</h2>
<ul><li><kbd>←</kbd> <kbd>→</kbd> <kbd>↑</kbd> <kbd>↓</kbd> move between pages; with <kbd>Ctrl</kbd> they move the page.</li>
<li><kbd>R</kbd> rotates right, <kbd>Shift</kbd>+<kbd>R</kbd> left; <kbd>Delete</kbd> removes; <kbd>Ctrl</kbd>+<kbd>Z</kbd> undoes.</li></ul>
<h2>Nothing is lost</h2>
<p>Pages are copied exactly as they are, so text stays selectable and searchable, links keep working and images keep their quality. Rotation is saved as a page setting, not by re-drawing the page. For other jobs, try <a href="/merge-pdf">merge PDF</a>, <a href="/split-pdf">split PDF</a> or the <a href="/pdf-editor">PDF editor</a>.</p>''' + PRIVACY,
  faqs=[('Is it free and private?', 'Yes. Your PDF is opened and saved in your browser; it is never uploaded.'),
        ('Can I combine pages from different PDFs?', 'Yes. Drop several PDFs (or use Add PDF), then drag pages from any of them into the order you want and save one file.'),
        ('Does rotating reduce quality?', 'No. Rotation is stored as a page setting, so text and images are untouched.'),
        ('Can I open a password-protected PDF?', 'Not directly. Remove the password first in a PDF reader where you know it, then organize the pages here.'),
        ('Is there a page limit?', 'No fixed limit. Very large PDFs (hundreds of pages) take a little longer to show thumbnails.')])

# ------------------------------------------------------------------------------------------- screenshot beautifier
PAGES['screenshot-beautifier'] = dict(
  name='Screenshot beautifier', cat='image', script='screenshot-beautifier.js', appcat='DesignApplication',
  title='Screenshot Beautifier — Beautiful Screenshots with Background & Mac Frame, Free | WebcamClicks',
  desc='Make screenshots beautiful: gradient background, padding, rounded corners, shadow and a Mac window, browser or phone frame. Paste, copy or download. Free, no upload.',
  lead='Paste a screenshot and make it presentation-ready in seconds: a gradient background, rounded corners, a soft shadow and a Mac window, browser or phone frame. Sized for X, LinkedIn, Instagram and slides. Copy it straight to the clipboard or download it.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Paste (Ctrl+V) or drop a screenshot", "PNG, JPG, WebP, HEIC · nothing is uploaded", multiple=False)}
      <div class="sb-wrap" id="sb-wrap" hidden><canvas id="sb-canvas" aria-label="Preview"></canvas></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Background</h2>
      <div class="sb-bgs" id="sb-bgs"></div>
      <div class="t-row cap-colors"><label class="t-field"><span>From</span><input type="color" id="sb-c1" value="#00c6ff"></label><label class="t-field"><span>To</span><input type="color" id="sb-c2" value="#7b2ff7"></label>
        <label class="t-field">Angle <input class="t-range" type="range" id="sb-angle" min="0" max="360" value="45"></label></div>
      <h2 style="margin-top:14px">Frame</h2>
      <div class="t-row">
        <label class="t-field">Style <select class="t-select" id="sb-frame"><option value="mac">Mac window</option><option value="dark">Dark window</option><option value="browser">Browser</option><option value="phone">Phone</option><option value="none">None</option></select></label>
        <label class="t-field">Shadow <select class="t-select" id="sb-shadow"><option value="soft">Soft</option><option value="strong">Strong</option><option value="hard">Hard edge</option><option value="glow">Colour glow</option><option value="none">None</option></select></label>
      </div>
      <label class="t-field" id="sb-title-row">Title / address <input class="t-input" id="sb-title" placeholder="e.g. My app or example.com"></label>
      <div class="t-row">
        <label class="t-field">Padding <input class="t-range" type="range" id="sb-pad" min="0" max="30" value="10"></label>
        <label class="t-field">Corners <input class="t-range" type="range" id="sb-radius" min="0" max="40" value="12"></label>
      </div>
      <div class="t-row">
        <label class="t-field">Size <input class="t-range" type="range" id="sb-scale" min="50" max="100" value="100"></label>
        <label class="t-field">3D tilt <input class="t-range" type="range" id="sb-tilt" min="-20" max="20" value="0"></label>
      </div>
      <label class="t-field">Canvas <select class="t-select" id="sb-size"><option value="auto">Fit to screenshot</option><option value="16:9">16:9 slides (1920×1080)</option><option value="twitter">X / Twitter (1600×900)</option><option value="linkedin">LinkedIn (1200×627)</option><option value="1:1">Square (1600×1600)</option><option value="4:5">Instagram 4:5 (1080×1350)</option><option value="9:16">Story 9:16 (1080×1920)</option></select></label>
      <div class="t-row"><label class="t-field">Handle or watermark <input class="t-input" id="sb-mark" placeholder="@yourname"></label>
        <label class="t-field">Position <select class="t-select" id="sb-markpos"><option value="right">Bottom right</option><option value="center">Bottom centre</option><option value="left">Bottom left</option></select></label></div>
      <div class="t-row" style="margin-top:6px"><label class="t-field">Format <select class="t-select" id="sb-fmt"><option value="image/png">PNG</option><option value="image/jpeg">JPG</option><option value="image/webp">WebP</option></select></label><p class="muted" id="sb-info" style="align-self:end;margin:0 0 10px"></p></div>
      <div class="t-actions" style="margin-top:0"><button class="t-btn primary" id="sb-save" type="button" disabled>⬇ Download</button><button class="t-btn" id="sb-copy" type="button" disabled>Copy image</button></div>
    </div>
  </div>''',
  article='''<h2>Make any screenshot look polished</h2>
<p>Raw screenshots look flat on social media and in slides. Put them on a colourful gradient with breathing room, round the corners, add a soft shadow and a window frame, and they instantly look designed. Ideal for product launches, changelogs, tweets, LinkedIn posts, tutorials, portfolios and pitch decks.</p>
<h2>How it works</h2>
<ol><li>Take a screenshot (Windows: <kbd>Win</kbd>+<kbd>Shift</kbd>+<kbd>S</kbd>, Mac: <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>4</kbd>) and press <kbd>Ctrl</kbd>+<kbd>V</kbd> on this page, or drop an image.</li>
<li>Pick a background (14 gradients, solid colours, a blurred copy of your screenshot, or transparent), a frame and a shadow.</li>
<li>Choose a canvas size for where you're posting, add your handle, then <strong>Copy image</strong> to paste it anywhere or <strong>Download</strong> it as PNG, JPG or WebP.</li></ol>
<h2>Frames</h2>
<ul><li><strong>Mac window</strong> and <strong>Dark window</strong> with the familiar traffic-light buttons and an optional title.</li>
<li><strong>Browser</strong> with an address bar showing your site's address.</li>
<li><strong>Phone</strong> with a rounded bezel for mobile app screenshots.</li></ul>
<p>Need to hide personal details first? Blur or black them out in the <a href="/pdf-editor">PDF editor</a> or crop with the <a href="/image-resizer">image resizer</a>. Making a YouTube cover? Try the <a href="/youtube-thumbnail-maker">thumbnail maker</a>.</p>''' + PRIVACY,
  faqs=[('Is it free? Is there a watermark?', 'Free, with no watermark. The handle field is optional and only adds text you type.'),
        ('Are my screenshots uploaded?', 'No. Everything is drawn in your browser, which matters for screenshots of private apps, emails and dashboards.'),
        ('What resolution is the result?', 'Full resolution: your screenshot is never shrunk unless you choose a fixed canvas smaller than it. Retina screenshots stay sharp.'),
        ('Can I make the background transparent?', 'Yes. Choose the checkered transparent background and save as PNG or WebP.'),
        ('Can I copy the image instead of downloading?', 'Yes. Copy image puts it on your clipboard, ready to paste into X, Slack, Notion, Google Docs or an email.')])

# ------------------------------------------------------------------------------------------- collage maker
PAGES['collage-maker'] = dict(
  name='Collage maker', cat='image', script='collage-maker.js', appcat='DesignApplication',
  title='Photo Collage Maker Online — Free Grid Layouts for Instagram & Print | WebcamClicks',
  desc='Make photo collages free: 20 grid layouts, drag to swap and position photos, spacing, borders and rounded corners. Sizes for Instagram, stories, Facebook and A4. No upload.',
  lead='Drop your photos and pick a layout: 2 to 16 photos, side by side, grids, a big photo with small ones and more. Drag photos to position or swap them, set the spacing, border and corners, and save a sharp collage sized for Instagram, stories, Facebook or print.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Drop your photos", "JPG, PNG, HEIC, WebP · up to 16 photos · nothing is uploaded")}
      <div class="cm-wrap" id="cm-wrap" hidden><canvas id="cm-canvas" aria-label="Collage preview: drag photos to move or swap them"></canvas></div>
      <p class="muted" id="cm-info" style="font-size:.82rem;margin:6px 0 0"></p>
      <div class="cm-cell" id="cm-cell" hidden>
        <b id="cm-cell-name"></b>
        <label class="t-field" style="margin:0">Zoom <input class="t-range" type="range" id="cm-zoom" min="100" max="400" value="100"></label>
        <div class="t-actions" style="margin:0"><button class="t-btn sm" id="cm-replace" type="button">Replace photo</button><input type="file" id="cm-replace-in" accept="image/*,.heic,.heif" hidden><button class="t-btn sm" id="cm-remove" type="button">Remove</button></div>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Layout</h2>
      <div class="cm-layouts" id="cm-layouts"></div>
      <div class="t-actions" style="margin-top:8px"><button class="t-btn sm" id="cm-add" type="button">+ Add photos</button><input type="file" id="cm-add-in" accept="image/*,.heic,.heif" multiple hidden><button class="t-btn sm" id="cm-shuffle" type="button">🔀 Shuffle</button></div>
      <label class="t-field" style="margin-top:12px">Size <select class="t-select" id="cm-size"><option value="square">Instagram square (2160×2160)</option><option value="portrait">Instagram portrait 4:5 (2160×2700)</option><option value="story">Story / Reel 9:16 (2160×3840)</option><option value="landscape">Landscape 16:9 (3840×2160)</option><option value="fbcover">Facebook cover (1640×624)</option><option value="a4">A4 print, 300 DPI (2480×3508)</option></select></label>
      <div class="t-row">
        <label class="t-field">Spacing <input class="t-range" type="range" id="cm-gap" min="0" max="60" value="12"></label>
        <label class="t-field">Border <input class="t-range" type="range" id="cm-border" min="0" max="80" value="12"></label>
      </div>
      <div class="t-row cap-colors">
        <label class="t-field">Corners <input class="t-range" type="range" id="cm-radius" min="0" max="80" value="0"></label>
        <label class="t-field"><span>Background</span><input type="color" id="cm-bg" value="#ffffff"></label>
      </div>
      <div class="t-row" style="margin-top:4px"><label class="t-field">Format <select class="t-select" id="cm-fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label>
        <div class="t-field">&nbsp;<button class="t-btn primary" id="cm-save" type="button" disabled style="width:100%">⬇ Download collage</button></div></div>
    </div>
  </div>''',
  article='''<h2>How to make a photo collage</h2>
<ol><li><strong>Drop your photos</strong> (or add them from your phone's gallery). A layout that fits the number of photos is chosen for you.</li>
<li><strong>Pick a layout</strong>: 20 to choose from, for 2 to 16 photos.</li>
<li><strong>Arrange:</strong> drag a photo to choose which part shows in its frame, or drop it on another frame to swap them. Click a frame to zoom, replace or remove its photo. On a computer, scroll over a photo to zoom.</li>
<li><strong>Style</strong> the spacing, outer border, rounded corners and background colour, choose the size, and download.</li></ol>
<h2>Sizes for every use</h2>
<ul><li><strong>Instagram</strong> square and 4:5 portrait posts, and 9:16 stories and Reels covers.</li>
<li><strong>Facebook cover</strong> and 16:9 for YouTube community posts, slides and desktop wallpapers.</li>
<li><strong>A4 at 300 DPI</strong> for printing photo pages, mood boards and school projects.</li></ul>
<p>Collages are saved at high resolution (up to 3840 pixels), so they stay sharp after upload. Want a single photo with a border instead? Use the <a href="/instagram-photo-border">Instagram photo border</a> tool. Photos from an iPhone? HEIC works directly, or convert them with <a href="/heic-to-jpg">HEIC to JPG</a>.</p>''' + PRIVACY,
  faqs=[('Is the collage maker free? Any watermark?', 'Free, with no watermark and no sign-up.'),
        ('Are my photos uploaded?', 'No. Photos are combined in your browser and never leave your device.'),
        ('How many photos can I use?', 'Layouts hold 2 to 16 photos. Add more photos than frames and you can drag or replace to pick which ones show.'),
        ('How do I move a photo inside its frame?', 'Drag it. Release inside the same frame to reposition, or over another frame to swap the two photos.'),
        ('Will my collage be blurry on Instagram?', 'No. Collages are saved at 2160 pixels or more, which Instagram scales down cleanly.')])

# =========================================================================================== batch 4: essentials
# ------------------------------------------------------------------------------------------- compress PDF
PAGES['compress-pdf'] = dict(
  name='Compress PDF', cat='pdf', script='pdf-compress.js', appcat='UtilitiesApplication',
  title='Compress PDF — Reduce PDF File Size Online Free, No Upload | WebcamClicks',
  desc='Make PDFs smaller for email, WhatsApp and upload portals. Shrinks photos and scans inside the PDF while text stays sharp and selectable. Free, private, batch.',
  lead='Make PDFs small enough for email, WhatsApp and government or job portals. The photos and scans inside are shrunk, while text, links and drawings stay sharp and selectable. Compress several PDFs at once; nothing is uploaded.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("application/pdf,.pdf", "Drop PDF files here", "One or many PDFs · nothing is uploaded")}
      <ul class="t-list" id="pc-list"></ul>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Compression</h2>
      <div class="pc-levels">
        <label class="pc-level"><input type="radio" name="pc-level" value="light"><span><b>Light</b><small>Best quality, smaller file</small></span></label>
        <label class="pc-level"><input type="radio" name="pc-level" value="medium" checked><span><b>Recommended</b><small>Good quality, much smaller</small></span></label>
        <label class="pc-level"><input type="radio" name="pc-level" value="strong"><span><b>Strong</b><small>Smallest while keeping text as text</small></span></label>
        <label class="pc-level"><input type="radio" name="pc-level" value="max"><span><b>Maximum (scans)</b><small>Pages become compact images; text is no longer selectable</small></span></label>
      </div>
      <select id="pc-level" hidden><option value="light">light</option><option value="medium" selected>medium</option><option value="strong">strong</option><option value="max">max</option></select>
      <label class="t-check"><input type="checkbox" id="pc-gray"> Black &amp; white (smaller for scanned documents)</label>
      <label class="t-check"><input type="checkbox" id="pc-meta"> Remove title, author and other details</label>
      <button class="t-btn primary" id="pc-run" type="button" disabled style="width:100%;margin-top:8px">Compress PDF</button>
      <button class="t-btn" id="pc-all" type="button" hidden style="width:100%;margin-top:8px">Download all (ZIP)</button>
    </div>
  </div>
  <script>document.querySelectorAll('input[name="pc-level"]').forEach(function(r){{r.addEventListener('change',function(){{document.getElementById('pc-level').value=r.value;}});}});</script>''',
  article='''<h2>How much smaller will my PDF get?</h2>
<p>It depends on what is inside. PDFs made from phone photos and scans often shrink by 70–90%, because each page holds a large photo. PDFs that are mostly text (from Word, Google Docs or a website) are usually already small; compression can't do much for them, and the tool keeps your original if it can't make it smaller.</p>
<h2>Which level should I choose?</h2>
<ul><li><strong>Recommended</strong> suits almost everything: photos are resized to about 1600 pixels and saved as good-quality JPEG. On screen and on paper it looks the same.</li>
<li><strong>Strong</strong> for strict upload limits (2 MB, 1 MB): photos are smaller and more compressed, while text stays perfectly sharp.</li>
<li><strong>Maximum</strong> for scanned documents: every page becomes a compact 100 DPI image. Combine with <em>Black &amp; white</em> for the smallest scans.</li></ul>
<h2>What stays untouched</h2>
<p>Text, fonts, links, form fields, bookmarks and vector drawings are copied as they are; only the pictures are re-encoded. Colour-managed print images (CMYK) are left alone so their colours don't shift. Need to edit or reorder pages too? Use the <a href="/pdf-editor">PDF editor</a> or <a href="/organize-pdf">organize PDF pages</a>.</p>''' + PRIVACY,
  faqs=[('Is it free and private?', 'Yes. Your PDFs are compressed in your browser and never uploaded, so you can safely compress contracts, IDs and bank statements.'),
        ('Will the text become blurry?', 'No. Only images are compressed; text stays sharp and selectable, except with Maximum, which turns pages into images.'),
        ('Why didn\'t my PDF get smaller?', 'PDFs that are mostly text are already compact. If compression can\'t reduce the size, the original is kept. Try Maximum for scanned documents.'),
        ('Can I compress a PDF to under 1 MB or 200 KB?', 'Usually, yes: use Strong, or Maximum with Black & white for scans. Very long documents may need splitting with Split PDF.'),
        ('Can I compress several PDFs at once?', 'Yes. Drop them all, press Compress, then download each one or all of them as a ZIP.')])

# ------------------------------------------------------------------------------------------- video converter
PAGES['video-converter'] = dict(
  name='Video converter', cat='video', script='video-tools.js', mode='convert', appcat='MultimediaApplication',
  title='Video Converter — MOV to MP4, WebM to MP4, MKV to MP4 Free | WebcamClicks',
  desc='Convert MOV, WebM and MKV to MP4 (or MP4 to WebM/MOV) in your browser. Copies the video without quality loss when it can; H.264 for WhatsApp and iPhone. No upload.',
  lead='Turn MOV, WebM and MKV videos into MP4 that plays everywhere: WhatsApp, iPhone, Windows, TVs and video editors. When the video is already in a compatible format it is copied without re-encoding, so it is instant and lossless.',
  ui=video_shell('convert', '''<h2>Convert to</h2>
      <div class="t-row">
        <label class="t-field">Format <select class="t-select" id="vt-format"><option value="mp4">MP4 (recommended)</option><option value="mov">MOV (QuickTime)</option><option value="webm">WebM (VP9, for the web)</option><option value="mkv">MKV</option></select></label>
        <label class="t-field">Quality <select class="t-select" id="vt-quality"><option value="same">Same as original</option><option value="high">High</option><option value="medium">Balanced (smaller)</option><option value="low">Small file</option></select></label>
      </div>
      <div class="t-row">
        <label class="t-field">Resolution <select class="t-select" id="vt-res"><option value="0">Keep original</option><option value="2160">4K</option><option value="1080">1080p</option><option value="720">720p</option><option value="480">480p</option></select></label>
        <label class="t-field">&nbsp;<span class="t-check" style="margin:8px 0 0"><input type="checkbox" id="vt-compat" checked> Plays everywhere (H.264 + AAC)</span></label>
      </div>
      ''' + TRIM_FIELDS),
  article='''<h2>Common conversions</h2>
<ul><li><strong>MOV to MP4:</strong> iPhone and Mac videos. Usually copied without re-encoding in seconds.</li>
<li><strong>WebM to MP4:</strong> screen recordings and web downloads, re-encoded to H.264 so they play on iPhone and in WhatsApp.</li>
<li><strong>MKV to MP4:</strong> for phones, TVs and editors that don't open MKV.</li>
<li><strong>MP4 to WebM:</strong> smaller files for websites.</li></ul>
<h2>Lossless when possible</h2>
<p>A video file is a container (MP4, MOV, MKV, WebM) holding video and audio streams. If the streams are already compatible with the new container, the converter simply re-packages them: no quality loss, and even long videos convert in seconds. Otherwise it re-encodes with your device's hardware video encoder. Keep <em>Plays everywhere</em> on for MP4 to get H.264 video and AAC audio, the combination every phone, browser and TV understands.</p>
<p>Need a smaller file? Use the <a href="/video-compressor">video compressor</a>. Only want the sound? <a href="/mp4-to-mp3">MP4 to MP3</a>.</p>''' + PRIVACY,
  faqs=[('Is the video converter free?', 'Yes, with no watermark, no sign-up and no file size limit.'),
        ('Will converting reduce quality?', 'Not when the video can be copied (shown in the result). When it must be re-encoded, Same as original uses high quality.'),
        ('Why won\'t my MP4 play on iPhone or WhatsApp?', 'It probably uses a codec like VP9 or HEVC. Convert it to MP4 with Plays everywhere on to get H.264 + AAC.'),
        ('Can it convert AVI or WMV?', 'Not yet: browsers can\'t decode those old formats. MP4, MOV, MKV and WebM work.'),
        ('Does it work on phones?', 'Yes, in recent Chrome on Android and Safari on iPhone.')])

# ------------------------------------------------------------------------------------------- merge videos
PAGES['merge-videos'] = dict(
  name='Merge videos', cat='video', script='video-merge.js', appcat='MultimediaApplication',
  title='Merge Videos Online — Join MP4 Clips Into One Video Free | WebcamClicks',
  desc='Join several video clips into one MP4: drag to reorder, mix sizes and formats, add a fade between clips, vertical or landscape. Free, no watermark, no upload.',
  lead='Join clips into one video. Add them in any order, drag to rearrange, pick a size (landscape, vertical or square) and download a single MP4. Different sizes and formats are fine; everything runs on your device.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("video/*,.mp4,.mov,.m4v,.webm,.mkv", "Drop your video clips", "MP4, MOV, WebM, MKV · add as many as you like · nothing is uploaded")}
      <div id="vm-work" hidden><ol class="vm-list" id="vm-list"></ol><p class="muted" id="vm-total" style="font-size:.85rem"></p></div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="vm-bar" hidden><div id="vm-fill"></div></div>
      <div class="vt-result" id="vm-result" hidden><video id="vm-result-video" controls playsinline class="vt-video"></video><p id="vm-result-info"></p><button class="t-btn primary" id="vm-dl" type="button">⬇ Download</button></div>
    </div>
    <div class="t-panel">
      <h2>Output</h2>
      <label class="t-field">Size <select class="t-select" id="vm-size"><option value="first">Same as clip 1</option><option value="1920x1080">Landscape 16:9 (1920×1080)</option><option value="1280x720">Landscape 720p</option><option value="1080x1920">Vertical 9:16 (1080×1920)</option><option value="1080x1080">Square (1080×1080)</option></select></label>
      <div class="t-row">
        <label class="t-field">Fit clips <select class="t-select" id="vm-fit"><option value="contain">Show whole clip (bars)</option><option value="cover">Fill the frame (crop)</option></select></label>
        <label class="t-field"><span>Bar colour</span><input type="color" id="vm-bg" value="#000000" style="width:100%;height:40px"></label>
      </div>
      <label class="t-field">Quality <select class="t-select" id="vm-quality"><option value="high">High</option><option value="medium" selected>Balanced</option><option value="low">Small file</option></select></label>
      <label class="t-check"><input type="checkbox" id="vm-fade"> Fade between clips</label>
      <button class="t-btn primary" id="vm-run" type="button" disabled style="width:100%;margin-top:8px">Merge videos</button>
    </div>
  </div>''',
  article='''<h2>How to merge videos</h2>
<ol><li><strong>Drop your clips</strong>, or add them from your phone's gallery. Add more any time.</li>
<li><strong>Put them in order</strong> with the arrows, or drag them (on a computer).</li>
<li><strong>Choose the size:</strong> keep the first clip's size, or pick landscape for YouTube, vertical 9:16 for Reels, TikTok and Shorts, or square.</li>
<li><strong>Merge</strong>, watch the result, and download one MP4.</li></ol>
<h2>Clips of different sizes</h2>
<p>Mixing phone videos (vertical) and camera clips (landscape)? Choose <em>Show whole clip</em> to keep every clip complete with bars, or <em>Fill the frame</em> to crop them to fill the screen. Clips without sound get silence, so the audio always stays in sync.</p>
<p>Want to cut clips first? Use the <a href="/video-trimmer">video trimmer</a>. Need to change the shape of one clip? <a href="/crop-video">Crop video</a>.</p>''' + PRIVACY,
  faqs=[('Is it free? Is there a watermark?', 'Free, with no watermark and no sign-up.'),
        ('Can I merge videos of different formats and sizes?', 'Yes. MP4, MOV, WebM and MKV clips of any size can be joined; each is fitted to the output size you pick.'),
        ('How long can the merged video be?', 'There is no fixed limit; very long 4K projects are limited by your device\'s memory. Keep the total under about 30 minutes on phones.'),
        ('Is the sound kept?', 'Yes. Each clip\'s sound is kept in sync, and clips without sound get silence.'),
        ('Can I add music?', 'Not in this tool yet. Merge the clips, then add music in the screen recorder\'s editor.')])

# ------------------------------------------------------------------------------------------- crop video
PAGES['crop-video'] = dict(
  name='Crop & rotate video', cat='video', script='video-crop.js', appcat='MultimediaApplication',
  title='Crop Video Online — Resize to 9:16, 1:1, 16:9, Rotate & Flip Free | WebcamClicks',
  desc='Crop videos to 9:16 for TikTok and Reels, 1:1 square or 16:9 for YouTube. Rotate sideways videos, flip, choose the size. Free, no watermark, no upload.',
  lead='Draw a box on your video to keep just the part you want: 9:16 for TikTok, Reels and Shorts, square for the feed, or 16:9 for YouTube. Rotate sideways phone videos and flip mirrored ones too. The sound is kept.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("video/*,.mp4,.mov,.m4v,.webm,.mkv", "Drop a video", "MP4, MOV, WebM, MKV · nothing is uploaded", multiple=False)}
      <div id="vc-work" hidden>
        <div class="crop-stage" id="vc-stage"><canvas id="vc-canvas"></canvas></div>
        <video id="vc-video" playsinline muted preload="auto" hidden></video>
        <div class="vc-controls"><button class="t-icon-btn" id="vc-play" type="button" aria-label="Play or pause">▶</button><input type="range" id="vc-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="vc-time" class="muted">0:00</span></div>
        <p class="t-status" id="vc-info"></p>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="vc-bar" hidden><div id="vc-fill"></div></div>
    </div>
    <div class="t-panel">
      <h2>Shape</h2>
      <div class="crop-aspects" id="vc-aspects"></div>
      <h2 style="margin-top:14px">Rotate &amp; flip</h2>
      <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="vc-rotl" type="button">⟲ 90° left</button><button class="t-btn sm" id="vc-rotr" type="button">⟳ 90° right</button><button class="t-btn sm" id="vc-flip" type="button">⇋ Mirror</button></div>
      <div class="t-row" style="margin-top:12px">
        <label class="t-field">Size <select class="t-select" id="vc-size"><option value="0">Keep (no upscaling)</option><option value="1080" selected>1080p</option><option value="720">720p</option><option value="480">480p</option></select></label>
        <label class="t-field">Quality <select class="t-select" id="vc-quality"><option value="high" selected>High</option><option value="medium">Balanced</option><option value="low">Small file</option></select></label>
      </div>
      <label class="t-check"><input type="checkbox" id="vc-mute"> Remove sound</label>
      <p class="muted" id="vc-out" style="font-size:.85rem;margin:6px 0"></p>
      <button class="t-btn primary" id="vc-run" type="button" disabled style="width:100%">Crop video</button>
    </div>
  </div>''',
  article='''<h2>Crop a video for every platform</h2>
<ul><li><strong>9:16</strong> for TikTok, Instagram Reels and Stories, YouTube Shorts and WhatsApp Status.</li>
<li><strong>4:5</strong> and <strong>1:1</strong> for Instagram and Facebook feed posts.</li>
<li><strong>16:9</strong> for YouTube, presentations and TVs.</li></ul>
<h2>How to crop a video</h2>
<ol><li>Drop your video. A crop box appears on the first frame.</li>
<li>Pick a shape, then drag the box to choose what stays in view, and its corners to zoom in. Play or scrub to check the whole video.</li>
<li>Rotate or mirror if needed, pick the size, and press <strong>Crop video</strong>. The MP4 downloads when it's ready.</li></ol>
<p>Talking-head video that needs to follow the speaker? <a href="/auto-reframe">Auto-reframe</a> moves the crop with the face automatically. Need to cut the length? Use the <a href="/video-trimmer">trimmer</a>.</p>''' + PRIVACY,
  faqs=[('Is it free? Watermark?', 'Free, with no watermark and no sign-up.'),
        ('How do I fix a sideways video?', 'Press 90° left or right until it looks right, then Crop video. Choose Free shape to keep the whole picture.'),
        ('Will cropping reduce quality?', 'The video is re-encoded at high quality. Cropping keeps fewer pixels, so a 9:16 crop of a 1080p landscape video is narrower than 1080 pixels; it is never upscaled.'),
        ('Is the sound kept?', 'Yes, unless you tick Remove sound.'),
        ('Can I crop on my phone?', 'Yes, in recent Chrome on Android and Safari on iPhone.')])

# ------------------------------------------------------------------------------------------- audio cutter
PAGES['audio-cutter'] = dict(
  name='Audio cutter & ringtone maker', cat='video', script='audio-cutter.js', appcat='MultimediaApplication',
  title='Audio Cutter & Ringtone Maker — Cut MP3 Online, iPhone M4R Free | WebcamClicks',
  desc='Cut MP3, M4A, WAV or a video\'s sound on a waveform. Fade in/out, make iPhone (M4R) and Android ringtones, save MP3 or WAV. Free, private, no upload.',
  lead='Cut the best part of a song, voice note or video\'s sound. Drag the handles on the waveform, listen, add a fade in and out, and save it as MP3, M4A, WAV or an iPhone ringtone.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("audio/*,video/*,.mp3,.m4a,.aac,.wav,.ogg,.opus,.flac,.mp4,.mov,.webm", "Drop a song, recording or video", "MP3, M4A, WAV, OGG, FLAC, MP4 · nothing is uploaded", multiple=False)}
      <div id="ac-work" hidden>
        <div class="ac-wave" id="ac-wave-wrap"><canvas id="ac-wave" aria-label="Waveform: drag the handles to choose the part to keep"></canvas></div>
        <div class="ac-row"><button class="t-btn primary sm" id="ac-play" type="button">▶ Play selection</button><span id="ac-len" class="muted"></span></div>
        <div class="t-row" style="margin-top:8px"><label class="t-field">Start (s) <input class="t-input" type="number" id="ac-start" min="0" step="0.1"></label><label class="t-field">End (s) <input class="t-input" type="number" id="ac-end" min="0" step="0.1"></label></div>
        <p class="t-status" id="ac-info"></p>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Cut</h2>
      <label class="t-field">Length <select class="t-select" id="ac-preset"><option value="free">Free selection</option><option value="ring30">Ringtone: 30 seconds</option><option value="ring40">iPhone ringtone: 40 seconds</option></select></label>
      <div class="t-row">
        <label class="t-field">Fade in <span id="ac-fin-v" class="muted">0 s</span><input class="t-range" type="range" id="ac-fin" min="0" max="5" step="0.5" value="0"></label>
        <label class="t-field">Fade out <span id="ac-fout-v" class="muted">0 s</span><input class="t-range" type="range" id="ac-fout" min="0" max="5" step="0.5" value="0"></label>
      </div>
      <label class="t-check"><input type="checkbox" id="ac-norm"> Make it louder (normalise)</label>
      <h2 style="margin-top:14px">Save as</h2>
      <div class="t-row">
        <label class="t-field">Format <select class="t-select" id="ac-fmt"><option value="mp3">MP3 (Android ringtone, everywhere)</option><option value="m4r">M4R (iPhone ringtone)</option><option value="m4a">M4A (AAC)</option><option value="wav">WAV (lossless)</option><option value="ogg">OGG (Opus)</option></select></label>
        <label class="t-field">Quality <select class="t-select" id="ac-bitrate"><option value="128">128 kbps</option><option value="192" selected>192 kbps</option><option value="256">256 kbps</option><option value="320">320 kbps</option></select></label>
      </div>
      <p class="muted" id="ac-note" hidden style="color:#9a3412;font-size:.85rem"></p>
      <button class="t-btn primary" id="ac-run" type="button" disabled style="width:100%;margin-top:6px">✂ Cut &amp; save</button>
    </div>
  </div>''',
  article='''<h2>How to cut a song</h2>
<ol><li>Drop an MP3, M4A, WAV or even a video. Its waveform appears.</li>
<li>Drag the two handles to the start and end you want (or drag the highlighted part to move it). Press <strong>Play selection</strong>, or the space bar, to listen.</li>
<li>Add a short fade in and out for a smooth start and finish, then save.</li></ol>
<h2>Make a ringtone</h2>
<ul><li><strong>Android:</strong> save as MP3, copy it to your phone, then Settings → Sound → Phone ringtone → add (the + button).</li>
<li><strong>iPhone:</strong> choose <em>iPhone ringtone: 40 seconds</em> and save as M4R. Add it with GarageBand on the iPhone (Share → Ringtone) or by dragging it onto your iPhone in Finder (Mac) or iTunes (Windows).</li></ul>
<p>Need the sound from a video first? <a href="/mp4-to-mp3">MP4 to MP3</a>. Recording your own voice? Try the <a href="/voice-recorder">voice recorder</a>.</p>''' + PRIVACY,
  faqs=[('Is the audio cutter free?', 'Yes, with no sign-up, no ads in the file and no length limit.'),
        ('Can I cut the audio from a video?', 'Yes. Drop an MP4, MOV or WebM and cut its sound like a song.'),
        ('How long can an iPhone ringtone be?', 'Up to 40 seconds. Alert and text tones should be shorter, about 5–15 seconds.'),
        ('Why is M4R unavailable?', 'Some browsers (for example Chrome on Linux) can\'t create AAC audio. Use Chrome on Windows, Mac or Android, or Safari.'),
        ('Will the quality drop?', 'Choose WAV for a lossless cut, or MP3 at 256–320 kbps, which sounds identical to the original for most music.')])

# ------------------------------------------------------------------------------------------- crop image
PAGES['crop-image'] = dict(
  name='Crop image', cat='image', script='image-crop.js', appcat='DesignApplication',
  title='Crop Image Online — Crop Photos to 1:1, 4:5, 16:9 or Circle, Free | WebcamClicks',
  desc='Crop photos to any size or ratio: square, 4:5, 16:9, 9:16 or a circle for profile pictures. Rotate, flip, straighten, set exact pixels. Free, full quality, no upload.',
  lead='Crop a photo to exactly what you need: a square for Instagram, 4:5 for the feed, 16:9 for YouTube, or a circle for a profile picture. Rotate, flip and straighten, set an exact size in pixels and save at full quality.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Drop or paste an image", "JPG, PNG, WebP, HEIC · nothing is uploaded", multiple=False)}
      <div id="ic-work" hidden><div class="crop-stage" id="ic-stage"><canvas id="ic-canvas"></canvas></div><p class="t-status" id="ic-info"></p></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Ratio</h2>
      <div class="crop-aspects" id="ic-aspects"></div>
      <h2 style="margin-top:14px">Rotate &amp; straighten</h2>
      <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="ic-rotl" type="button">⟲ 90°</button><button class="t-btn sm" id="ic-rotr" type="button">⟳ 90°</button><button class="t-btn sm" id="ic-fliph" type="button">⇋ Flip</button><button class="t-btn sm" id="ic-flipv" type="button">⇅ Flip</button><button class="t-btn sm" id="ic-reset" type="button">Reset</button></div>
      <label class="t-field" style="margin-top:10px">Straighten <span id="ic-straight-v" class="muted">0°</span><input class="t-range" type="range" id="ic-straight" min="-45" max="45" step="0.5" value="0"></label>
      <h2 style="margin-top:14px">Output</h2>
      <div class="t-row"><label class="t-field">Width (px) <input class="t-input" type="number" id="ic-w" min="1"></label><label class="t-field">Height (px) <input class="t-input" type="number" id="ic-h" min="1"></label></div>
      <label class="t-check"><input type="checkbox" id="ic-lock" checked> Keep proportions</label>
      <div class="t-row">
        <label class="t-field">Format <select class="t-select" id="ic-fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option><option value="image/avif">AVIF</option></select></label>
        <label class="t-field">Quality <input class="t-range" type="range" id="ic-q" min="50" max="100" value="92"><span class="muted">92%</span></label>
      </div>
      <label class="t-field" hidden><span>Circle background (JPG)</span><input type="color" id="ic-bg" value="#ffffff" style="width:100%;height:40px"></label>
      <button class="t-btn primary" id="ic-save" type="button" disabled style="width:100%;margin-top:6px">⬇ Crop &amp; download</button>
    </div>
  </div>''',
  article='''<h2>Common sizes</h2>
<div class="t-table-wrap"><table class="t-table"><thead><tr><th>Where</th><th>Ratio</th><th>Size</th></tr></thead><tbody>
<tr><td>Instagram post</td><td>1:1 or 4:5</td><td>1080×1080 or 1080×1350</td></tr>
<tr><td>Story, Reels cover, TikTok</td><td>9:16</td><td>1080×1920</td></tr>
<tr><td>YouTube thumbnail</td><td>16:9</td><td>1280×720</td></tr>
<tr><td>Profile picture</td><td>Circle</td><td>400×400 or larger</td></tr>
<tr><td>Print photo 6×4 in</td><td>3:2</td><td>1800×1200 at 300 DPI</td></tr></tbody></table></div>
<h2>How to crop a photo</h2>
<ol><li>Drop or paste (Ctrl+V) your image.</li>
<li>Pick a ratio, then drag the box and its corners. Use the arrow keys to nudge it a pixel at a time (Shift for 10).</li>
<li>Rotate, flip or straighten a tilted horizon, set an exact output size if you need one, and download.</li></ol>
<p>Making a passport or visa photo? Use the <a href="/passport-photo">passport photo maker</a>, which knows every country's rules. Need many images resized at once? <a href="/image-resizer">Image resizer</a>.</p>''' + PRIVACY,
  faqs=[('Does cropping reduce quality?', 'No. The crop is taken from the full-resolution image. Only the format and quality you choose affect the file.'),
        ('How do I make a round profile picture?', 'Choose Circle and save as PNG: the corners become transparent, ready for any app.'),
        ('Can I crop to an exact pixel size?', 'Yes. Type the width and height under Output; with Keep proportions on, the other side follows the crop box.'),
        ('Does it work with iPhone HEIC photos?', 'Yes. HEIC photos open directly and can be saved as JPG.'),
        ('Is it private?', 'Yes. Images are cropped in your browser and never uploaded.')])

# ------------------------------------------------------------------------------------------- slideshow maker
PAGES['slideshow-maker'] = dict(
  name='Slideshow maker', cat='video', script='slideshow.js', appcat='MultimediaApplication',
  title='Slideshow Maker — Photos to Video with Music, 35 Transitions & Effects, Free | WebcamClicks',
  desc='Pro photo slideshow maker: 12 editing styles, 35 transitions (random or your pick), 17 colour looks, film grain, light leaks, confetti, snow, text styles, music, beat sync, full-screen preview. Free MP4, no watermark.',
  lead='Turn photos into a video that looks professionally edited. Pick an editing style (Wedding, Travel, Birthday, Cinematic, Hype…) or mix your own from 35 transitions, 17 colour looks, animated effects and text styles. Add music, preview in full screen, and download an MP4.',
  ui=f'''<div class="t-grid ss-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Drop your photos", "JPG, PNG, HEIC, WebP · as many as you like · nothing is uploaded")}
      <div id="ss-work" hidden>
        <div class="ss-player" id="ss-player">
          <canvas id="ss-canvas" aria-label="Slideshow preview: click to play or pause"></canvas>
          <button class="ss-bigplay" id="ss-bigplay" type="button" aria-label="Play">▶</button>
          <div class="ss-bar">
            <button type="button" id="ss-play" aria-label="Play or pause">▶</button>
            <input type="range" id="ss-seek" min="0" max="1000" value="0" aria-label="Seek">
            <span id="ss-time">0:00</span>
            <button type="button" id="ss-fs" aria-label="Full screen" title="Full screen (F)">⛶</button>
          </div>
        </div>
        <div class="ss-striphead"><b>Photos</b><span class="muted" id="ss-total"></span>
          <span class="ss-stripbtns"><button class="t-btn sm" id="ss-shuffle" type="button">🔀 Shuffle</button><button class="t-btn sm" id="ss-add" type="button">+ Add photos</button></span><input type="file" id="ss-add-in" accept="image/*,.heic,.heif" multiple hidden></div>
        <ol class="ss-strip" id="ss-strip" aria-label="Photos in order: click one to edit it, drag to reorder"></ol>
        <div class="ss-sel" id="ss-sel" hidden>
          <div class="ss-selhead"><b id="ss-sel-name"></b><span><button class="t-icon-btn" id="ss-sel-prev" type="button" aria-label="Move earlier">‹</button><button class="t-icon-btn" id="ss-sel-next" type="button" aria-label="Move later">›</button><button class="t-btn sm" id="ss-sel-dup" type="button">Duplicate</button><button class="t-btn sm" id="ss-sel-del" type="button">Remove</button></span></div>
          <div class="t-row">
            <label class="t-field">Caption <input class="t-input" id="ss-sel-cap" maxlength="80" placeholder="Text on this photo"></label>
            <label class="t-field">Duration <select class="t-select" id="ss-sel-dur"></select></label>
          </div>
          <label class="t-field">Transition into this photo <select class="t-select" id="ss-sel-trans"></select></label>
        </div>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="ss-bar" hidden><div id="ss-fill"></div></div>
      <div class="vt-result" id="ss-result" hidden><video controls playsinline class="vt-video"></video><p id="ss-result-info"></p><button class="t-btn primary" id="ss-dl" type="button">⬇ Download MP4</button></div>
    </div>
    <div class="t-panel ss-panel">
      <div class="t-row">
        <label class="t-field">Size <select class="t-select" id="ss-aspect"><option value="9:16">9:16 Reels / TikTok / Shorts</option><option value="1:1">1:1 Square</option><option value="4:5">4:5 Instagram feed</option><option value="16:9">16:9 YouTube / TV</option></select></label>
        <label class="t-field">Quality <select class="t-select" id="ss-quality"><option value="1080">1080p</option><option value="720">720p (faster)</option></select></label>
      </div>
      <div class="ss-tabs" id="ss-tabs" role="tablist">
        <button type="button" role="tab" data-tab="style" aria-selected="true">✨ Styles</button><button type="button" role="tab" data-tab="trans" aria-selected="false">🔀 Transitions</button>
        <button type="button" role="tab" data-tab="fx" aria-selected="false">🎨 Effects</button><button type="button" role="tab" data-tab="text" aria-selected="false">🔤 Text</button><button type="button" role="tab" data-tab="music" aria-selected="false">🎵 Music</button>
      </div>
      <div class="ss-pane" data-pane="style">
        <div class="ss-templates" id="ss-templates"></div>
        <button class="t-btn" id="ss-surprise" type="button" style="width:100%;margin-top:8px">🎲 Surprise me (random style)</button>
        <label class="t-field" style="margin-top:12px">Seconds per photo <span class="muted" id="ss-per-v">3.0 s</span><input class="t-range" type="range" id="ss-per" min="0.8" max="10" step="0.1" value="3"></label>
      </div>
      <div class="ss-pane" data-pane="trans" hidden>
        <div class="t-row">
          <label class="t-field">Use <select class="t-select" id="ss-tmode"><option value="random">Random from the ones picked</option><option value="cycle">In turn (cycle)</option><option value="one">The same for every photo</option></select></label>
          <label class="t-field">Length <span class="muted" id="ss-tdur-v">0.8 s</span><input class="t-range" type="range" id="ss-tdur" min="0.2" max="2" step="0.1" value="0.8"></label>
        </div>
        <div class="t-actions" style="margin:0 0 6px"><button class="t-btn sm" id="ss-reshuffle" type="button">🎲 Reshuffle random</button><button class="t-btn sm" id="ss-tall" type="button">Use all</button></div>
        <p class="muted" style="font-size:.8rem;margin:0 0 6px">Tap transitions to add or remove them. Tap one to preview it.</p>
        <div id="ss-tlist"></div>
      </div>
      <div class="ss-pane" data-pane="fx" hidden>
        <p class="ss-tgroup">Colour look</p><div class="ss-looks" id="ss-looks"></div>
        <p class="ss-tgroup">Overlays &amp; particles</p><div class="ss-chips" id="ss-overlays"></div>
        <div class="t-row" style="margin-top:10px">
          <label class="t-field">Motion <select class="t-select" id="ss-motion"><option value="kb">Ken Burns (random)</option><option value="in">Slow zoom in</option><option value="out">Slow zoom out</option><option value="pan">Pan</option><option value="beat">Beat pulse</option><option value="none">Still</option></select></label>
          <label class="t-field">Photo frame <select class="t-select" id="ss-fit"><option value="blur">Whole photo, blurred edges</option><option value="fill">Fill the screen</option><option value="polaroid">Polaroid card</option><option value="card">Rounded card</option><option value="color">Whole photo, colour edges</option></select></label>
        </div>
        <label class="t-field"><span>Edge colour</span><input type="color" id="ss-bg" value="#111111" style="width:100%;height:40px"></label>
      </div>
      <div class="ss-pane" data-pane="text" hidden>
        <label class="t-field">Title <input class="t-input" id="ss-title" maxlength="60" placeholder="e.g. Summer in Pokhara"></label>
        <label class="t-field">Subtitle <input class="t-input" id="ss-sub" maxlength="80" placeholder="e.g. July 2026"></label>
        <p class="ss-tgroup">Text style</p><div class="ss-tstyles" id="ss-tstyles"></div>
        <label class="t-check" style="margin-top:10px"><input type="checkbox" id="ss-captions" checked> Show photo captions (click a photo to write one)</label>
        <label class="t-check"><input type="checkbox" id="ss-end"> End card</label>
        <div class="t-row"><label class="t-field">End title <input class="t-input" id="ss-end-title" placeholder="Thanks for watching"></label><label class="t-field">End subtitle <input class="t-input" id="ss-end-sub" placeholder="@yourname"></label></div>
      </div>
      <div class="ss-pane" data-pane="music" hidden>
        <label class="t-field">Track <select class="t-select" id="ss-music"></select></label><input type="file" id="ss-music-in" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden>
        <p class="muted" id="ss-music-name" style="margin:-4px 0 6px;font-size:.85rem"></p>
        <label class="t-check" hidden><input type="checkbox" id="ss-fitmusic" checked> Fit the photos to the length of my song</label>
        <label class="t-check" hidden><input type="checkbox" id="ss-beat"> Sync photo changes to the beat</label>
        <label class="t-field">Volume <input class="t-range" type="range" id="ss-vol" min="0" max="100" value="80"></label>
      </div>
      <button class="t-btn primary" id="ss-run" type="button" disabled style="width:100%;margin-top:12px">🎬 Create video</button>
    </div>
  </div>''',
  article='''<h2>How to make a photo slideshow</h2>
<ol><li><strong>Drop your photos.</strong> They appear in the order you added them; drag them (or use the arrows) to reorder.</li>
<li><strong>Pick a size:</strong> 9:16 for Reels, TikTok, Shorts and WhatsApp Status, square or 4:5 for the feed, 16:9 for YouTube and TVs.</li>
<li><strong>Style it:</strong> seconds per photo, a transition (crossfade, slide, zoom, wipe or a mix), the slow zoom and a title for the first photo.</li>
<li><strong>Add music:</strong> five royalty-free tracks are built in (lo-fi, upbeat, ambient, corporate, cinematic), or use your own song. With your own song, the photos can be timed to fit it exactly.</li>
<li><strong>Preview</strong> with ▶ or in full screen (⛶ or the F key), then <strong>Create video</strong> and download the MP4.</li></ol>
<h2>Editing styles, transitions and effects</h2>
<ul><li><strong>12 editing styles</strong> set everything in one click: Travel vlog, Wedding, Birthday, Memories, Cinematic, Hype (cuts on the beat), Love story, Retro VHS, Holidays, Film noir, Polaroid and Business. Or press <em>Surprise me</em> for a random look.</li>
<li><strong>35 transitions</strong>: crossfades, fades through black or white, slides, pushes, whip pans, zooms, spins, wipes, circle, diamond and heart reveals, blinds, checkerboard, doors, flip, cube, flash, glitch, pixelate and film burn. Use them at random, in turn, or one for every photo, and set a different one for any photo.</li>
<li><strong>17 colour looks</strong> such as Film, Cinematic teal &amp; orange, Golden hour, Vintage, Noir and Duotone, plus overlays: film grain, vignette, light leaks, cinematic bars, VHS, dust &amp; scratches, and animated snow, confetti, hearts, sparkles, bubbles, petals and bokeh lights.</li>
<li><strong>Text styles</strong> for the title, captions and an end card: clean, bold, elegant, script, neon, typewriter, comic and label.</li></ul>
<h2>Ideas</h2>
<ul><li>Birthday, wedding and anniversary videos, or a memorial tribute.</li>
<li>Travel recaps and “photo dump” Reels.</li>
<li>Real-estate tours, product showcases and menus for social media.</li>
<li>School projects and event recaps.</li></ul>
<p>The built-in music is generated on your device, so it is free to use anywhere, including monetised videos. If you use your own song, make sure you have the rights to it. Want to merge video clips instead? Use <a href="/merge-videos">merge videos</a>; for a single picture collage, the <a href="/collage-maker">collage maker</a>.</p>''' + PRIVACY,
  faqs=[('Is the slideshow maker free? Watermark?', 'Free, with no watermark, no sign-up and no limit on photos.'),
        ('Can I use my own music?', 'Yes. Choose “My own song”, pick an MP3 or M4A, and tick “Fit the photos to the length of my song” to time the slideshow to it.'),
        ('Is the built-in music copyright-free?', 'Yes. It is composed on your device for your video, so you can use it on YouTube, Instagram and TikTok without claims.'),
        ('How many photos can I add?', 'As many as you like. A 60-second Reel fits about 20 photos at 3 seconds each.'),
        ('Are my photos uploaded?', 'No. The video is made in your browser, which keeps family and private photos private.')])

# ------------------------------------------------------------------------------------------- ID card maker
PAGES['id-card-maker'] = dict(
  name='ID card maker', cat='image', script='idcard-maker.js', appcat='DesignApplication',
  title='ID Card Maker Online — Free Templates, Bulk from Excel/CSV, Print PDF | WebcamClicks',
  desc='Free ID card maker: professional employee, student, event and membership templates. Front & back, photos, logo, QR code, barcode. Bulk create from Excel or CSV and export PNG, ZIP or print-ready PDF.',
  lead='Design professional ID cards and badges, then make one for everyone at once. Pick a template, add your logo and colours, link the text, photo, QR code and barcode to your spreadsheet columns, upload the photos, and download every card as a 300 DPI PNG, a ZIP, or a print-ready PDF with cut marks.',
  ui='''<div class="t-grid ic-grid">
    <div>
      <div class="ic-toolbar">
        <div class="ic-seg" id="ic-side"><button type="button" data-side="front" aria-pressed="true">Front</button><button type="button" data-side="back" aria-pressed="false">Back</button></div>
        <div class="ic-rec"><button class="t-icon-btn" id="ic-prev" type="button" aria-label="Previous person">‹</button><span id="ic-rec">1 / 3</span><button class="t-icon-btn" id="ic-next" type="button" aria-label="Next person">›</button><b id="ic-rec-name"></b></div>
      </div>
      <div class="ic-stage" id="ic-stage">
        <canvas id="ic-canvas" aria-label="Card editor: click an element to select it, drag to move"></canvas>
        <div class="ic-sel" id="ic-sel" hidden><i data-h="nw"></i><i data-h="n"></i><i data-h="ne"></i><i data-h="e"></i><i data-h="se"></i><i data-h="s"></i><i data-h="sw"></i><i data-h="w"></i></div>
        <div class="ic-guide v" id="ic-guide-v" hidden></div><div class="ic-guide h" id="ic-guide-h" hidden></div>
      </div>
      <p class="muted ic-hint">Click to select · drag to move · drag the handles to resize · arrows nudge · Delete removes · Ctrl+Z undo</p>
      <p class="t-status" id="t-status" role="status"></p>
      <section class="ic-data">
        <div class="ic-datahead"><h2>People &amp; data</h2><span class="muted" id="ic-data-info"></span></div>
        <div class="t-actions" style="margin-top:0">
          <label class="t-btn sm primary" style="cursor:pointer">📄 Upload Excel / CSV<input type="file" id="ic-data-in" accept=".csv,.xlsx,.xls,.ods,.tsv,.txt,text/csv" hidden></label>
          <label class="t-btn sm" style="cursor:pointer">🖼️ Upload photos<input type="file" id="ic-photos-in" accept="image/*,.heic,.heif" multiple hidden></label>
          <button class="t-btn sm" id="ic-addrow" type="button">+ Person</button><button class="t-btn sm" id="ic-addcol" type="button">+ Field</button>
          <button class="t-btn sm" id="ic-sample-csv" type="button">Sample CSV</button><button class="t-btn sm" id="ic-clear-data" type="button">Clear</button>
        </div>
        <div class="ic-tablewrap"><table class="ic-table" id="ic-table"></table></div>
        <p class="muted" style="font-size:.8rem;margin:6px 0 0">The first row of your file is used as field names (Name, ID, Role…). Click any cell or heading to edit it. Name photo files after the person's ID (e.g. <code>EMP-1042.jpg</code>) or add a <b>Photo</b> column with the file names.</p>
      </section>
      <input type="file" id="ic-img-in" accept="image/*,.heic,.heif" hidden><input type="file" id="ic-photo1-in" accept="image/*,.heic,.heif" hidden>
    </div>
    <div class="t-panel ic-panel">
      <div class="ss-tabs" id="ic-tabs" role="tablist">
        <button type="button" role="tab" data-tab="tpl" aria-selected="true">🎨 Templates</button><button type="button" role="tab" data-tab="add" aria-selected="false">➕ Elements</button>
        <button type="button" role="tab" data-tab="edit" aria-selected="false">✏️ Edit</button><button type="button" role="tab" data-tab="card" aria-selected="false">🪪 Card</button><button type="button" role="tab" data-tab="export" aria-selected="false">⬇ Export</button>
      </div>
      <div class="ic-pane" data-pane="tpl"><div class="ic-templates" id="ic-templates"></div></div>
      <div class="ic-pane" data-pane="add" hidden>
        <div class="ic-add" id="ic-add">
          <button type="button" data-add="field"><b>{{ }}</b>Data field</button><button type="button" data-add="text"><b>T</b>Text</button><button type="button" data-add="photo"><b>👤</b>Photo</button>
          <button type="button" data-add="logo"><b>🏢</b>Logo / image</button><button type="button" data-add="signature"><b>✍️</b>Signature</button><button type="button" data-add="qr"><b>▦</b>QR code</button>
          <button type="button" data-add="barcode"><b>║▌║</b>Barcode</button><button type="button" data-add="rect"><b>▬</b>Rectangle</button><button type="button" data-add="circle"><b>●</b>Circle</button>
          <button type="button" data-add="line"><b>─</b>Line</button><button type="button" data-add="band"><b>〰</b>Wave band</button>
        </div>
        <p class="ss-tgroup">Layers (top first)</p><ul class="ic-layers" id="ic-layers"></ul>
      </div>
      <div class="ic-pane" data-pane="edit" hidden><div id="ic-props"></div></div>
      <div class="ic-pane" data-pane="card" hidden>
        <label class="t-field">Card size <select class="t-select" id="ic-size"></select></label>
        <label class="t-field">Corner rounding <input class="t-range" type="range" id="ic-radius" min="0" max="80" value="28"></label>
        <p class="ss-tgroup">Background (this side)</p>
        <div class="t-row"><label class="t-field">Type <select class="t-select" id="ic-bgtype"><option value="solid">Colour</option><option value="gradient">Gradient</option><option value="image">Image</option></select></label><button class="t-btn sm" id="ic-bgimg" type="button" style="align-self:end;margin-bottom:10px">Choose image</button></div>
        <div class="t-row cap-colors"><label class="t-field"><span>Colour</span><input type="color" id="ic-bgc1"></label><label class="t-field"><span>To</span><input type="color" id="ic-bgc2"></label><label class="t-field">Angle <input class="t-range" type="range" id="ic-bgangle" min="0" max="360"></label></div>
        <div class="t-row"><label class="t-field">Security pattern <select class="t-select" id="ic-pattern"><option value="none">None</option><option value="guilloche">Guilloche (banknote)</option><option value="waves">Waves</option><option value="lines">Diagonal lines</option><option value="dots">Dots</option><option value="grid">Grid</option><option value="hex">Hexagons</option></select></label><label class="t-field"><span>Pattern colour</span><input type="color" id="ic-patc"></label></div>
        <label class="t-field">Pattern strength <input class="t-range" type="range" id="ic-pato" min="0" max="40"></label>
        <button class="t-btn sm" id="ic-copyback" type="button">Use the front background on the back</button>
      </div>
      <div class="ic-pane" data-pane="export" hidden>
        <div class="t-row"><label class="t-field">Sides <select class="t-select" id="ic-sides"><option value="both">Front and back</option><option value="front">Front only</option><option value="back">Back only</option></select></label><label class="t-field">File names from <select class="t-select" id="ic-namecol"></select></label></div>
        <button class="t-btn primary" id="ic-png" type="button" style="width:100%">⬇ This card (PNG, 300 DPI)</button>
        <button class="t-btn" id="ic-zip" type="button" style="width:100%;margin-top:8px">⬇ All cards (ZIP of PNGs)</button>
        <div class="t-row" style="margin-top:8px"><label class="t-field">Paper <select class="t-select" id="ic-paper"><option value="a4">A4</option><option value="letter">US Letter</option></select></label><div class="t-field">&nbsp;<button class="t-btn" id="ic-pdf" type="button" style="width:100%">🖨 Print sheet (PDF)</button></div></div>
        <p class="muted" style="font-size:.78rem">The PDF places cards at their true size with cut marks; backs are mirrored so double-sided printing lines up.</p>
        <p class="ss-tgroup">Your designs</p>
        <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="ic-save-design" type="button">💾 Save in browser</button><button class="t-btn sm" id="ic-dl-design" type="button">Download design file</button><label class="t-btn sm" style="cursor:pointer">Open design file<input type="file" id="ic-design-in" accept=".json,application/json" hidden></label></div>
        <ul class="ic-saved" id="ic-saved"></ul>
      </div>
    </div>
  </div>''',
  article='''<h2>Make ID cards for a whole team in minutes</h2>
<ol><li><strong>Pick a template:</strong> corporate, modern gradient, minimal, student, medical, tech, event badge, visitor pass, elegant gold, security, membership or volunteer. Each has a front and a back.</li>
<li><strong>Make it yours:</strong> click anything to change it. Add your logo, colours, a security pattern (guilloche, waves, hexagons), shapes, a signature (the white paper is removed automatically), a QR code or a barcode.</li>
<li><strong>Add your people:</strong> upload an Excel (.xlsx) or CSV file. The first row becomes the field names, so <code>{{Name}}</code>, <code>{{ID}}</code> or <code>{{Department}}</code> on the card are filled in for each person. Or type the data straight into the table.</li>
<li><strong>Add photos:</strong> select all the photos at once. They're matched to people by a Photo column with file names, or by file names that match an ID or name (EMP-1042.jpg).</li>
<li><strong>Export:</strong> one card or all of them as 300 DPI PNG images (in a ZIP), or a PDF sheet with cards at their real size and cut marks, ready for any printer or print shop.</li></ol>
<h2>Fields: the {{Name}} placeholders</h2>
<p>Any text on the card can mix fixed words and fields, like <code>Dept: {{Department}}</code> or <code>Valid until {{Valid Until}}</code>. Use the <em>Insert field</em> menu when editing a text, QR code or barcode. A QR code can hold a link such as <code>https://example.com/verify/{{ID}}</code> so security staff can check a card with a phone. Long names shrink automatically to fit their box.</p>
<h2>Card sizes</h2>
<ul><li><strong>Standard ID card (CR80):</strong> 85.6 × 54 mm, the size of a bank card, landscape or portrait, for PVC card printers and laminating pouches.</li>
<li><strong>Event badges:</strong> 3 × 4 in and 4 × 3 in for lanyards and badge holders, and a large 4 × 6 in badge.</li></ul>
<p>Need a photo with a plain background first? Use the <a href="/background-remover">background remover</a> or the <a href="/passport-photo">passport photo maker</a>. Generating QR codes on their own? <a href="/qr-code-generator">QR code generator</a>.</p>
<p>This tool is for making identification cards for your own organisation, school, event or club. Don't use it to copy government, police or other official IDs.</p>''' + PRIVACY,
  faqs=[('Is the ID card maker free?', 'Yes, with no watermark, no sign-up and no limit on the number of cards.'),
        ('Can I make cards for many people at once?', 'Yes. Upload an Excel or CSV file with one row per person and the photos, and export every card in one go as a ZIP of PNGs or a print-ready PDF.'),
        ('Is my data uploaded?', 'No. The spreadsheet, photos and design stay in your browser. That matters for staff and student records.'),
        ('What resolution are the cards?', '300 DPI, the standard for print: a CR80 card is 1011 × 638 pixels.'),
        ('How do I print double-sided?', 'Export the PDF with Front and back. Fronts and backs are on alternate pages, with the backs mirrored so they line up. Print at 100% / Actual size, double-sided (flip on long edge).'),
        ('Can I reuse my design?', 'Yes. Save it in your browser, or download the design file to open it on another computer.')])

# ------------------------------------------------------------------------------------------- ringtone makers (audio cutter engine)
PAGES['ringtone-maker'] = dict(
  name='Ringtone maker', cat='video', script='audio-cutter.js', mode='ringtone', appcat='MultimediaApplication',
  title='Ringtone Maker — Make a Ringtone from Any Song, Free (MP3 & iPhone M4R) | WebcamClicks',
  desc='Free ringtone maker: pick the best 30 seconds of any song or video on a waveform, add a fade, and save an MP3 for Android or an M4R for iPhone. No app, no upload.',
  lead='Make a ringtone from your favourite song in under a minute. Drop the song (or a video), drag the highlighted part to the chorus, listen, add a smooth fade in and out, and save it as an MP3 for Android or an M4R for iPhone.',
  ui=PAGES['audio-cutter']['ui'],
  article='''<h2>How to make a ringtone</h2>
<ol><li><strong>Drop your song.</strong> MP3, M4A, WAV, FLAC and even videos work. A 30-second part is selected for you.</li>
<li><strong>Find the best part.</strong> Drag the highlighted part to the chorus, or drag its edges. Press <strong>Play selection</strong> (or the space bar) to listen.</li>
<li><strong>Smooth it:</strong> a 1-second fade in and 2-second fade out are already set, so the ringtone doesn't start or stop abruptly. Tick <em>Make it louder</em> for quiet songs.</li>
<li><strong>Save:</strong> MP3 for Android, M4R for iPhone.</li></ol>
<h2>Set a ringtone on Android</h2>
<ol><li>Copy the MP3 to your phone (it's already there if you made it on the phone).</li>
<li>Open <strong>Settings → Sound &amp; vibration → Phone ringtone</strong>.</li>
<li>Tap <strong>+</strong> or <em>Add ringtone</em> (on Samsung: <em>Ringtone → +</em>) and choose the file.</li></ol>
<h2>Set a ringtone on iPhone</h2>
<p>Use the <a href="/iphone-ringtone-maker">iPhone ringtone maker</a> for step-by-step instructions: iPhone ringtones must be M4R files of 40 seconds or less, added with GarageBand on the iPhone or by syncing from a computer.</p>
<h2>Tips for a good ringtone</h2>
<ul><li>Start a beat before the hook, so the best part plays before you answer.</li>
<li>20–30 seconds is plenty; most calls are answered within 15 seconds.</li>
<li>Notification and alarm sounds should be short: 3–10 seconds.</li></ul>
<p>Only want to trim a song? Use the <a href="/audio-cutter">audio cutter</a>. Need the sound from a video first? <a href="/mp4-to-mp3">MP4 to MP3</a>.</p>''' + PRIVACY,
  faqs=[('Is the ringtone maker free?', 'Yes, with no app, no sign-up and no watermark sound.'),
        ('Can I make a ringtone from a YouTube video?', 'Only from files you have on your device. Downloading YouTube videos is against YouTube\'s terms; use songs you own or have the rights to.'),
        ('How long should a ringtone be?', 'Up to 30 seconds for Android and 40 seconds for iPhone. Text and alert tones are best at 3–10 seconds.'),
        ('Which format do I need?', 'MP3 for Android phones. M4R (AAC audio) for iPhone.'),
        ('Is my music uploaded?', 'No. The song is cut and saved in your browser.')])

PAGES['iphone-ringtone-maker'] = dict(
  name='iPhone ringtone maker', cat='video', script='audio-cutter.js', mode='iphone', appcat='MultimediaApplication',
  title='iPhone Ringtone Maker — Make an M4R Ringtone from Any Song, Free | WebcamClicks',
  desc='Make an iPhone ringtone (M4R) from any song or video: pick up to 40 seconds on a waveform, add a fade, download. Step-by-step guide to add it with GarageBand or a computer. Free.',
  lead='Turn any song into an iPhone ringtone. Pick up to 40 seconds, add a fade, and download an M4R file, the format iPhone ringtones use. Then follow the steps below to add it with GarageBand on your iPhone or from your computer.',
  ui=PAGES['audio-cutter']['ui'],
  article='''<h2>Make the ringtone</h2>
<ol><li><strong>Drop the song</strong> (MP3, M4A, WAV, FLAC or a video). A 30-second part is selected and set to M4R.</li>
<li><strong>Drag</strong> the highlighted part to the bit you love, press <strong>Play selection</strong> to listen, and keep it under 40 seconds.</li>
<li><strong>Cut &amp; save</strong> to download the <code>.m4r</code> file.</li></ol>
<h2>Add it to your iPhone: without a computer (GarageBand)</h2>
<ol><li>Install Apple's free <strong>GarageBand</strong> app and save the ringtone to the Files app (Downloads).</li>
<li>In GarageBand, start any project (e.g. Audio Recorder), tap the <strong>tracks view</strong> button, then the <strong>loop</strong> icon → <strong>Files</strong> → <em>Browse items from the Files app</em>, and choose your ringtone. Drag it onto the track.</li>
<li>Tap the down arrow → <strong>My Songs</strong>, long-press the project → <strong>Share</strong> → <strong>Ringtone</strong> → <strong>Export</strong>.</li>
<li>Choose <strong>Use sound as… → Standard Ringtone</strong>. It now appears in <em>Settings → Sounds &amp; Haptics → Ringtone</em>.</li></ol>
<h2>Add it to your iPhone: with a computer</h2>
<ul><li><strong>Mac (Finder):</strong> connect the iPhone, select it in Finder, and drag the <code>.m4r</code> file onto the iPhone window (General tab).</li>
<li><strong>Windows (Apple Devices app or iTunes):</strong> connect the iPhone, open the device, and drag the <code>.m4r</code> file onto <em>Tones</em> / <em>On My Device</em>.</li></ul>
<p>Then pick it in <strong>Settings → Sounds &amp; Haptics → Ringtone</strong>. You can also give a contact their own ringtone in the Contacts app (Edit → Ringtone).</p>
<p>Making a ringtone for Android instead? Use the <a href="/ringtone-maker">ringtone maker</a> and save as MP3.</p>''' + PRIVACY,
  faqs=[('Why does my iPhone ringtone have to be 40 seconds or less?', 'iPhone ignores ringtones longer than 40 seconds. The tool warns you if your selection is longer.'),
        ('What is an M4R file?', 'An M4R is an AAC audio file (the same as M4A) with the extension iPhone expects for ringtones.'),
        ('Why can\'t I choose M4R?', 'Some browsers, such as Chrome on Linux, can\'t create AAC audio. Use Safari, or Chrome or Edge on Windows or Mac.'),
        ('Can I set it as a text tone or alarm?', 'Yes. In GarageBand choose Standard Text Tone, or pick it under Sounds & Haptics → Text Tone. Alarms can use any ringtone in the Clock app.'),
        ('Is it free and private?', 'Yes. The song is cut on your device and never uploaded.')])

# ------------------------------------------------------------------------------------------- meme generator
PAGES['meme-generator'] = dict(
  name='Meme generator', cat='image', script='meme-generator.js', appcat='DesignApplication',
  title='Meme Generator — Make Memes from Your Photos, Free, No Watermark | WebcamClicks',
  desc='Make a meme in seconds: top & bottom text, caption memes, this-vs-that, side by side, 4-panel comics and motivational posters. Outlined text, emoji stickers, deep fry. No watermark, no upload.',
  lead='Turn any photo, screenshot or webcam selfie into a meme. Pick a layout (classic top & bottom text, caption on top, this vs that, expectation vs reality, a 4-panel comic or a motivational poster), type your text, drag it where you want, add stickers, and copy or download it.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Drop or paste a picture", "JPG, PNG, WebP, GIF frame, HEIC · nothing is uploaded")}
      <div class="t-actions" style="margin-top:8px"><button class="t-btn sm" id="mg-cam" type="button">📷 Use my webcam</button><button class="t-btn sm" id="mg-blank" type="button">⬜ Text-only meme</button></div>
      <div class="mg-cambox" id="mg-cambox" hidden><video id="mg-camvideo" playsinline muted></video><div class="t-actions"><button class="t-btn primary" id="mg-snap" type="button">📸 Snap</button><button class="t-btn" id="mg-camclose" type="button">Cancel</button></div></div>
      <div id="mg-work" hidden>
        <div class="mg-stage" id="mg-stage"><canvas id="mg-canvas" aria-label="Meme preview: drag texts and stickers"></canvas><div class="mg-sel" id="mg-sel" hidden><i data-h="se"></i></div></div>
        <div class="t-actions" style="margin-top:8px"><span id="mg-slotbtns" class="mg-slotbtns"></span><button class="t-btn sm" id="mg-del" type="button" hidden>🗑 Delete selected</button><span class="muted" id="mg-info" style="align-self:center;font-size:.82rem"></span></div>
        <input type="file" id="mg-slot-in" accept="image/*,.heic,.heif" hidden>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Layout</h2>
      <div class="mg-layouts" id="mg-layouts"></div>
      <h2 style="margin-top:14px">Text</h2>
      <div id="mg-texts" class="mg-texts"></div>
      <button class="t-btn sm" id="mg-addtext" type="button">+ Add text</button>
      <div class="t-row" style="margin-top:10px"><label class="t-field">Font <select class="t-select" id="mg-font"></select></label><label class="t-field">Size <input class="t-input" type="number" id="mg-size" min="12" max="240" value="84"></label></div>
      <div class="t-row cap-colors"><label class="t-field"><span>Text</span><input type="color" id="mg-color" value="#ffffff"></label><label class="t-field"><span>Outline</span><input type="color" id="mg-stroke" value="#000000"></label><label class="t-field">Outline width <input class="t-range" type="range" id="mg-strokew" min="0" max="20" value="8"></label></div>
      <div class="t-row"><label class="t-field">Align <select class="t-select" id="mg-align"><option value="center">Centre</option><option value="left">Left</option><option value="right">Right</option></select></label><label class="t-check" style="align-self:end"><input type="checkbox" id="mg-upper" checked> CAPITALS</label></div>
      <button class="t-btn sm" id="mg-apply-all" type="button">Apply this style to all texts</button>
      <h2 style="margin-top:14px">Stickers</h2>
      <div class="mg-stickers" id="mg-stickers"></div>
      <h2 style="margin-top:14px">Effect</h2>
      <div class="ss-chips" id="mg-fx"></div>
      <div class="t-row" style="margin-top:12px"><label class="t-field">Format <select class="t-select" id="mg-fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG</option></select></label></div>
      <div class="t-actions" style="margin-top:0"><button class="t-btn primary" id="mg-save" type="button" disabled>⬇ Download meme</button><button class="t-btn" id="mg-copy" type="button" disabled>Copy</button></div>
    </div>
  </div>''',
  article='''<h2>How to make a meme</h2>
<ol><li><strong>Add a picture:</strong> drop or paste (Ctrl+V) a photo or screenshot, snap one with your webcam, or start a text-only meme.</li>
<li><strong>Pick a layout:</strong> classic top &amp; bottom text, caption on top (the Twitter/Instagram style), this vs that, side by side (expectation vs reality), a 4-panel comic, or a motivational poster.</li>
<li><strong>Write your text</strong> in the boxes on the right. It is outlined so it reads on any picture, and long text shrinks to fit. Drag any text on the picture to move it, and drag its corner to make it wider.</li>
<li><strong>Add stickers</strong> (😂 💀 🔥 🗿…) and an effect such as <em>Deep fried</em>, then <strong>download</strong> or <strong>copy</strong> it straight into a chat.</li></ol>
<h2>Meme layouts</h2>
<ul><li><strong>Top &amp; bottom:</strong> the classic white Impact text with a black outline.</li>
<li><strong>Caption on top:</strong> a white bar with plain text above the picture, the most common style today.</li>
<li><strong>This vs that:</strong> two pictures with a line of text next to each, for comparing a bad and a good choice.</li>
<li><strong>Side by side</strong> for expectation vs reality, before vs after, and <strong>4-panel comics</strong> for a story.</li>
<li><strong>Motivational poster:</strong> a framed picture with a big serif title and a sarcastic subtitle.</li></ul>
<p>Use pictures you took or are allowed to use. Want animated reactions instead? Make a GIF with the <a href="/photo-booth">photo booth</a> or <a href="/video-to-gif">video to GIF</a>.</p>''' + PRIVACY,
  faqs=[('Is the meme generator free? Watermark?', 'Free, with no watermark and no sign-up.'),
        ('Can I use my own photos?', 'Yes. Your photos stay on your device; nothing is uploaded.'),
        ('Which font do memes use?', 'Classic memes use Impact in white with a black outline. Caption-style memes use a plain bold font like Arial. Both are included.'),
        ('How do I make a deep-fried meme?', 'Choose the Deep fried effect: colours are pushed to the max, noise is added and the image is crunched with low-quality JPEG.'),
        ('Can I paste the meme into WhatsApp or Discord?', 'Yes. Press Copy and paste it into WhatsApp Web, Discord, Slack or X, or download it on your phone and share it from your gallery.')])
