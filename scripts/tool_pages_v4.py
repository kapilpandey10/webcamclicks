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
