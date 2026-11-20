# WebcamClicks — tool pages, 2026-11 batch 2 (scanners, recording, video AI, redaction, upscaling).
# Executed by build-tool-pages.py with its globals (PAGES, DROP, icon, html) and tool_pages_v2's PRIVACY.

# ------------------------------------------------------------------------------------------- QR & barcode scanner
PAGES['qr-scanner'] = dict(
  name='QR & barcode scanner', cat='util', script='qr-scanner.js', appcat='UtilitiesApplication',
  title='QR Code & Barcode Scanner Online — Camera or Image, Free | WebcamClicks',
  desc='Scan QR codes and barcodes with your webcam or phone camera, or from a photo or screenshot. Wi-Fi, links, contacts, UPI, EAN/UPC. Free, private, no app.',
  lead='Scan any QR code or barcode with your camera, or drop a photo or screenshot. WebcamClicks reads the code on your device and shows what is inside before you open anything: links, Wi-Fi passwords, contacts, events, payments and product numbers.',
  ui=f'''<div class="t-grid">
    <div>
      <div class="qr-stage" id="qr-stage">
        <video id="qr-video" playsinline muted autoplay></video>
        <canvas id="qr-overlay" aria-hidden="true"></canvas>
        <div class="qr-frame" aria-hidden="true"></div>
        <div class="qr-idle">Press “Start camera” or drop an image below</div>
      </div>
      <div class="t-actions">
        <button class="t-btn primary" id="qr-start" type="button">📷 Start camera</button>
        <select class="t-select" id="qr-camera" hidden aria-label="Camera" style="width:auto"></select>
        <button class="t-btn" id="qr-torch" type="button" hidden aria-pressed="false">🔦 Torch</button>
      </div>
      <div style="margin-top:14px">{DROP("image/*,.heic,.heif", "Or drop a photo or screenshot", "PNG, JPG, HEIC, screenshot (Ctrl+V) · nothing is uploaded", multiple=True)}</div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Result</h2>
      <ul class="qr-list" id="qr-results"><li class="muted">Scan a code to see what it contains.</li></ul>
      <label class="t-check" style="margin-top:12px"><input type="checkbox" id="qr-beep" checked> Beep when a code is found</label>
      <label class="t-check"><input type="checkbox" id="qr-multi"> Find several codes in one image</label>
      <h2 style="margin-top:16px">History <button class="t-btn sm" id="qr-clear" type="button" hidden style="float:right">Clear</button></h2>
      <ul class="qr-list" id="qr-history"></ul>
    </div>
  </div>''',
  article='''<h2>How to scan a QR code on a computer or phone</h2>
<ol><li>Press <strong>Start camera</strong> and allow camera access. On phones the back camera is used; on laptops, your webcam.</li>
<li>Hold the code inside the frame. It is read in a fraction of a second, with a beep, and the result appears on the right.</li>
<li>No camera, or the code is on your screen? Take a screenshot and press <kbd>Ctrl</kbd>+<kbd>V</kbd>, or drop the image into the box.</li></ol>
<h2>Supported codes</h2>
<p><strong>2D codes:</strong> QR, Micro QR, Data Matrix, Aztec, PDF417 (boarding passes, ID cards) and MaxiCode. <strong>Barcodes:</strong> EAN-13, EAN-8, UPC-A, UPC-E (products and books), Code 128, Code 39, Code 93, ITF, Codabar and GS1 DataBar. The scanner uses your browser's built-in barcode detector where available, and ZXing (an open-source scanning engine compiled to WebAssembly) everywhere else.</p>
<h2>See what's inside before you open it</h2>
<p>QR codes can hide phishing links, so nothing opens automatically. Each result shows its type and content in plain words:</p>
<ul><li><strong>Links</strong> show the real website, with a warning for insecure (http), shortened or look-alike addresses.</li>
<li><strong>Wi-Fi codes</strong> show the network name and password, with a button to copy the password.</li>
<li><strong>Contacts</strong> (vCard, MeCard) can be saved straight to your address book.</li>
<li><strong>UPI and payment codes</strong> show the payee and amount so you can check them first.</li>
<li><strong>Product barcodes</strong> can be searched with one click.</li></ul>
<p>Need to make a code instead? Use the <a href="/qr-code-generator">QR code generator</a>.</p>''' + PRIVACY,
  faqs=[('Can I scan a QR code with my laptop webcam?', 'Yes. Press Start camera and hold the code about 15–30 cm from the webcam. Good light helps.'),
        ('How do I scan a QR code that is on my screen?', 'Take a screenshot (Windows: Win+Shift+S, Mac: Cmd+Shift+4) and paste it here with Ctrl+V or Cmd+V.'),
        ('Is it safe?', 'Codes are read on your device and nothing opens automatically, so you can check a link before visiting it.'),
        ('Why won\'t my barcode scan?', 'Make sure the whole code is in view, flat and sharp. For barcodes, hold the camera parallel and a little further away. Glossy packaging may need the torch or a different angle.'),
        ('Does it keep a history?', 'Your recent scans are stored only in this browser, so you can find them again. Clear them anytime.')])

# ------------------------------------------------------------------------------------------- document scanner
PAGES['document-scanner'] = dict(
  name='Document scanner', cat='camera', script='doc-scanner.js', appcat='UtilitiesApplication',
  title='Document Scanner Online — Scan to PDF with Camera, Free | WebcamClicks',
  desc='Scan documents with your phone or webcam: automatic edge detection, perspective correction, shadow removal and crisp black & white. Multi-page PDF. Free, no app, no upload.',
  lead='Turn your phone or webcam into a scanner. Point it at a page: WebcamClicks finds the edges, straightens the page, removes shadows and makes the text crisp, then saves all your pages as one PDF. Nothing is uploaded.',
  ui=f'''<div class="ds-top">
    <button class="t-btn primary" id="ds-cam" type="button">📷 Scan with camera</button>
    <span class="muted">or</span>
  </div>
  <div class="ds-cambox" id="ds-cambox" hidden>
    <div class="ds-camview"><video id="ds-video" playsinline muted autoplay></video><canvas id="ds-camoverlay" aria-hidden="true"></canvas></div>
    <div class="t-actions"><button class="t-btn primary" id="ds-capture" type="button">◉ Capture page</button><button class="t-btn" id="ds-camdone" type="button">Done</button>
      <label class="t-check" style="margin:0"><input type="checkbox" id="ds-autocap" checked> Auto-capture when steady</label></div>
  </div>
  {DROP("image/*,.heic,.heif", "Drop photos of documents", "Receipts, letters, forms, notes, ID cards · several at once · nothing is uploaded")}
  <p class="t-status" id="t-status" role="status"></p>
  <div class="ds-work" id="ds-work" hidden>
    <div class="ds-col">
      <h2>1 · Adjust the corners</h2>
      <div class="ds-stage" id="ds-stage"><canvas id="ds-src"></canvas><svg id="ds-svg" preserveAspectRatio="none" aria-label="Drag the corners to the page edges"></svg></div>
      <div class="t-actions"><button class="t-btn sm" id="ds-auto" type="button">✨ Auto-detect</button><button class="t-btn sm" id="ds-full" type="button">Use whole photo</button><button class="t-btn sm" id="ds-rotate" type="button">⟳ Rotate</button><button class="t-btn sm" id="ds-delete" type="button">🗑 Delete page</button></div>
    </div>
    <div class="ds-col">
      <h2>2 · Result</h2>
      <canvas id="ds-preview" class="ds-preview"></canvas>
      <label class="t-field" style="margin-top:10px">Look <select class="t-select" id="ds-filter"><option value="color">Colour, shadows removed</option><option value="bw">Black &amp; white (crisp text)</option><option value="grey">Greyscale</option><option value="original">Original colours</option></select></label>
    </div>
  </div>
  <h2 class="ds-h">Pages</h2>
  <ol class="ds-pages" id="ds-pages"></ol>
  <div class="t-actions">
    <label class="t-field" style="margin:0;min-width:180px">PDF page size <select class="t-select" id="ds-size"><option value="a4">A4</option><option value="letter">US Letter</option><option value="fit">Same as scan</option></select></label>
    <button class="t-btn primary" id="ds-pdf" type="button" disabled>⬇ Download PDF</button>
    <button class="t-btn" id="ds-zip" type="button" disabled>Download JPGs</button>
  </div>''',
  article='''<h2>How to scan a document with your phone or webcam</h2>
<ol><li>Put the page on a darker, plain surface (a table works) in good light, and avoid casting a shadow over it.</li>
<li>Press <strong>Scan with camera</strong> and hold the phone above the page. A green outline appears when the page is found; keep still and it captures automatically, or press <strong>Capture page</strong>. Repeat for each page.</li>
<li>Already have photos? Drop them in instead, several at once.</li>
<li>Check each page: drag the orange corners if the edges aren't exact, choose a look, rotate if needed, and reorder pages with the arrows.</li>
<li>Press <strong>Download PDF</strong> for one multi-page PDF, or download the pages as JPGs.</li></ol>
<h2>What the scanner does to your photo</h2>
<ul><li><strong>Edge detection</strong> finds the paper by its brightness against the background and fits the best four-cornered shape to it.</li>
<li><strong>Perspective correction</strong> turns a page photographed at an angle back into a flat rectangle, like a flatbed scanner.</li>
<li><strong>Shadow removal</strong> measures the paper's brightness across the page and evens it out, so a hand or phone shadow and uneven room light disappear.</li>
<li><strong>Black &amp; white</strong> uses adaptive thresholding to make text and signatures pure black on pure white: the clearest, smallest files for forms, contracts and homework.</li></ul>
<h2>Tips for perfect scans</h2>
<ul><li>Daylight from a window, or two lights from the sides, gives the most even result.</li>
<li>Hold the phone parallel to the page and fill most of the frame.</li>
<li>For receipts, use Black &amp; white; for photos and colourful documents, use Colour.</li>
<li>Need to edit or search the text? Run the PDF through <a href="/image-to-text">Image to text (OCR)</a>, then fill or sign it in the <a href="/pdf-editor">PDF editor</a>.</li></ul>''' + PRIVACY,
  faqs=[('Is this document scanner free?', 'Yes, with unlimited pages, no watermark and no account or app.'),
        ('Does it work on iPhone and Android?', 'Yes, in Safari and Chrome. The back camera is used automatically.'),
        ('Can I scan with a laptop webcam?', 'Yes. Hold the page in front of the webcam, or lay it on the desk and tilt the screen. Phone cameras give sharper results.'),
        ('Are my documents uploaded?', 'No. Detection, straightening and the PDF are all made on your device, so it is safe for IDs, bank letters and medical documents.'),
        ('Why weren\'t the edges found?', 'The page needs to stand out from the background. Use a darker surface, include all four corners in the photo, or drag the corners into place by hand.')])

# ------------------------------------------------------------------------------------------- voice recorder
PAGES['voice-recorder'] = dict(
  name='Voice recorder', cat='camera', script='voice-recorder.js', appcat='MultimediaApplication',
  title='Online Voice Recorder with Noise Removal — Free MP3 | WebcamClicks',
  desc='Record your voice online and clean it up in one click: remove background noise and hum, enhance the voice, level the volume, trim silence. Save MP3 or WAV. Free, no upload.',
  lead='Record a voice note, podcast, voice-over or lesson straight from your browser, then make it sound studio-clean with one click: background noise and electrical hum removed, voice enhanced and levelled, silence trimmed. Everything stays on your device.',
  ui=f'''<div class="t-grid">
    <div>
      <div class="vr-recbox">
        <canvas id="vr-meter" class="vr-meter" aria-hidden="true"></canvas>
        <div class="vr-timer" id="vr-timer">0:00</div>
        <div class="t-actions" style="justify-content:center">
          <button class="t-btn primary vr-recbtn" id="vr-rec" type="button">● Record</button>
          <button class="t-btn" id="vr-pause" type="button" hidden>❚❚ Pause</button>
          <button class="t-btn dark" id="vr-stop" type="button" hidden>■ Stop</button>
        </div>
        <div class="t-row" style="margin-top:12px">
          <label class="t-field">Microphone <select class="t-select" id="vr-mic"><option value="">Default microphone</option></select></label>
          <label class="t-check" style="align-self:end"><input type="checkbox" id="vr-browserns"> Browser noise filter while recording</label>
        </div>
      </div>
      <div style="margin-top:14px">{DROP("audio/*,video/*", "Or drop an audio or video file to clean up", "MP3, M4A, WAV, OGG, voice memos, MP4 · nothing is uploaded", multiple=False)}</div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="vr-bar" hidden><div id="vr-fill"></div></div>
      <div id="vr-edit" hidden>
        <div class="vr-wavebox"><canvas id="vr-wave"></canvas><div class="vr-sel" id="vr-sel"></div></div>
        <p class="t-status" id="vr-info"></p>
        <audio id="vr-audio" controls style="width:100%"></audio>
      </div>
    </div>
    <div class="t-panel">
      <h2>Clean-up</h2>
      <label class="t-check"><input type="checkbox" id="vr-noise" checked> Remove background noise</label>
      <label class="t-field" style="padding-left:26px">Strength <input class="t-range" type="range" id="vr-noise-amt" min="20" max="100" value="65"></label>
      <label class="t-field">Electrical hum <select class="t-select" id="vr-hum"><option value="auto">Remove if detected</option><option value="0">Off</option><option value="50">50 Hz (Europe, Asia, Africa)</option><option value="60">60 Hz (Americas)</option></select></label>
      <label class="t-check"><input type="checkbox" id="vr-enhance" checked> Enhance voice (clarity &amp; warmth)</label>
      <label class="t-check"><input type="checkbox" id="vr-level" checked> Level the volume</label>
      <label class="t-check"><input type="checkbox" id="vr-autotrim" checked> Trim silence at start and end</label>
      <div class="t-actions"><button class="t-btn" id="vr-process" type="button">↻ Clean up again</button><button class="t-btn" id="vr-ab" type="button" disabled>Hear original</button></div>
      <h2 style="margin-top:16px">Save</h2>
      <label class="t-field">Format <select class="t-select" id="vr-format"><option value="mp3">MP3 (plays everywhere)</option><option value="wav">WAV (uncompressed, for editing)</option><option value="ogg">OGG Opus (smallest)</option></select></label>
      <button class="t-btn primary" id="vr-dl" type="button" disabled style="width:100%">⬇ Download</button>
    </div>
  </div>''',
  article='''<h2>How to record and clean up your voice</h2>
<ol><li>Press <strong>Record</strong> and allow microphone access. The live waveform warns you if you are too quiet or too loud.</li>
<li>Pause and resume as often as you like, then press <strong>Stop</strong>.</li>
<li>The recording is cleaned automatically. Press play, and use <strong>Hear original</strong> to compare.</li>
<li>Drag the edges of the waveform to cut the start or end, choose MP3 or WAV and download.</li></ol>
<p>Already have a recording? Drop a voice memo, Zoom audio, lecture or podcast file to clean it the same way.</p>
<h2>What each clean-up step does</h2>
<ul><li><strong>Remove background noise</strong> learns the sound of the room from the quiet moments (fans, air-con, computer hiss, traffic rumble) and subtracts it from the whole recording. Raise the strength for noisy rooms; lower it if voices start to sound watery.</li>
<li><strong>Electrical hum</strong> removes the 50 or 60 Hz buzz (and its harmonics) from cheap cables, chargers and lighting. It is detected automatically.</li>
<li><strong>Enhance voice</strong> applies a broadcast-style chain: low rumble filtered, muddiness reduced, presence and air added, and a gentle compressor so every word is clear.</li>
<li><strong>Level the volume</strong> brings speech to a consistent loudness (about −16 LUFS, the podcast standard) with a limiter so nothing clips.</li>
<li><strong>Trim silence</strong> cuts dead air before you start talking and after you stop.</li></ul>
<h2>Tips for a better recording</h2>
<ul><li>Record in a small room with soft furnishings; curtains and a sofa absorb echo better than any filter.</li>
<li>Stay a hand-width from the microphone and speak across it, not straight into it, to avoid pops.</li>
<li>Test your microphone first with the <a href="/mic-test">mic test</a>. Recording a video? Use the <a href="/screen-recorder">screen recorder</a> or <a href="/teleprompter">teleprompter</a>, and add <a href="/auto-captions">captions</a>.</li></ul>''' + PRIVACY,
  faqs=[('Is this online voice recorder free?', 'Yes, with no time limit, watermark or sign-up.'),
        ('Is my voice uploaded anywhere?', 'No. Recording and every clean-up step run in your browser.'),
        ('Does it work on iPhone and Android?', 'Yes, in Safari and Chrome. Keep the screen on while recording.'),
        ('How long can I record?', 'As long as you like. Very long recordings (over an hour) take a while to clean on older phones.'),
        ('Can it remove echo?', 'It reduces background noise and hum very well, but room echo is hard to remove after recording. Record in a furnished room for the best sound.')])
