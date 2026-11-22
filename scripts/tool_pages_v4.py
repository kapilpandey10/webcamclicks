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
  title='Slideshow Maker — Photos to Video with Music, Free, No Watermark | WebcamClicks',
  desc='Turn photos into a video slideshow with music: slow zoom and pan, smooth transitions, a title, royalty-free music or your own song. Reels, TikTok, YouTube sizes. Free MP4, no upload.',
  lead='Turn your photos into a video in a minute. Add photos, pick a size for Reels, TikTok or YouTube, choose a transition and royalty-free music (or your own song), add a title, and download an MP4. Every photo gets a slow, cinematic zoom.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,.heic,.heif", "Drop your photos", "JPG, PNG, HEIC, WebP · as many as you like · nothing is uploaded")}
      <div id="ss-work" hidden>
        <div class="ss-stage"><canvas id="ss-canvas" aria-label="Slideshow preview"></canvas></div>
        <div class="vc-controls"><button class="t-icon-btn" id="ss-play" type="button" aria-label="Play or pause">▶</button><input type="range" id="ss-seek" min="0" max="1000" value="0" aria-label="Seek"><span id="ss-time" class="muted">0:00</span></div>
        <ol class="ss-strip" id="ss-strip" aria-label="Photos in order"></ol>
        <div class="t-actions" style="margin-top:6px"><button class="t-btn sm" id="ss-add" type="button">+ Add photos</button><input type="file" id="ss-add-in" accept="image/*,.heic,.heif" multiple hidden><span class="muted" id="ss-total" style="align-self:center;font-size:.85rem"></span></div>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="ss-bar" hidden><div id="ss-fill"></div></div>
      <div class="vt-result" id="ss-result" hidden><video controls playsinline class="vt-video"></video><p id="ss-result-info"></p><button class="t-btn primary" id="ss-dl" type="button">⬇ Download MP4</button></div>
    </div>
    <div class="t-panel">
      <h2>Video</h2>
      <div class="t-row">
        <label class="t-field">Size <select class="t-select" id="ss-aspect"><option value="9:16">9:16 Reels / TikTok / Shorts</option><option value="1:1">1:1 Square</option><option value="4:5">4:5 Instagram feed</option><option value="16:9">16:9 YouTube / TV</option></select></label>
        <label class="t-field">Transition <select class="t-select" id="ss-trans"><option value="fade">Crossfade</option><option value="mixed">Mixed</option><option value="slide">Slide</option><option value="zoom">Zoom</option><option value="wipe">Wipe</option><option value="none">Cut (none)</option></select></label>
      </div>
      <label class="t-field">Seconds per photo <span class="muted" id="ss-per-v">3.0 s</span><input class="t-range" type="range" id="ss-per" min="1" max="10" step="0.1" value="3"></label>
      <div class="t-row">
        <label class="t-field">Photo fit <select class="t-select" id="ss-fit"><option value="blur">Whole photo, blurred edges</option><option value="fill">Fill the frame (crop)</option><option value="color">Whole photo, colour edges</option></select></label>
        <label class="t-field"><span>Edge colour</span><input type="color" id="ss-bg" value="#111111" style="width:100%;height:40px"></label>
      </div>
      <label class="t-check"><input type="checkbox" id="ss-kb" checked> Slow zoom &amp; pan (Ken Burns)</label>
      <h2 style="margin-top:14px">Title</h2>
      <label class="t-field">Title <input class="t-input" id="ss-title" maxlength="60" placeholder="e.g. Summer in Pokhara"></label>
      <label class="t-field">Subtitle <input class="t-input" id="ss-sub" maxlength="80" placeholder="e.g. July 2026"></label>
      <h2 style="margin-top:14px">Music</h2>
      <label class="t-field">Track <select class="t-select" id="ss-music"></select></label><input type="file" id="ss-music-in" accept="audio/*,.mp3,.m4a,.wav,.ogg" hidden>
      <p class="muted" id="ss-music-name" style="margin:-4px 0 6px;font-size:.85rem"></p>
      <label class="t-check" hidden><input type="checkbox" id="ss-fitmusic" checked> Fit the photos to the length of my song</label>
      <label class="t-field">Volume <input class="t-range" type="range" id="ss-vol" min="0" max="100" value="80"></label>
      <button class="t-btn primary" id="ss-run" type="button" disabled style="width:100%;margin-top:8px">🎬 Create video</button>
    </div>
  </div>''',
  article='''<h2>How to make a photo slideshow</h2>
<ol><li><strong>Drop your photos.</strong> They appear in the order you added them; drag them (or use the arrows) to reorder.</li>
<li><strong>Pick a size:</strong> 9:16 for Reels, TikTok, Shorts and WhatsApp Status, square or 4:5 for the feed, 16:9 for YouTube and TVs.</li>
<li><strong>Style it:</strong> seconds per photo, a transition (crossfade, slide, zoom, wipe or a mix), the slow zoom and a title for the first photo.</li>
<li><strong>Add music:</strong> five royalty-free tracks are built in (lo-fi, upbeat, ambient, corporate, cinematic), or use your own song. With your own song, the photos can be timed to fit it exactly.</li>
<li><strong>Preview</strong> with ▶, then <strong>Create video</strong> and download the MP4.</li></ol>
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
