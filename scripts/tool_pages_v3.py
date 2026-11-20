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

# ------------------------------------------------------------------------------------------- silence remover
PAGES['silence-remover'] = dict(
  name='Silence remover', cat='video', script='silence-remover.js', appcat='MultimediaApplication',
  title='Silence Remover — Auto Jump Cuts for Videos, Free Online | WebcamClicks',
  desc='Automatically remove silences and pauses from talking videos, lectures and podcasts. Adjustable threshold, preview, smooth cuts, MP4 or MP3 export. Free, private, no upload.',
  lead='Cut the dead air out of talking-head videos, tutorials, lectures and podcasts automatically. WebcamClicks finds every pause, shows you exactly what will be cut, and exports a tighter, faster-paced video with clean jump cuts, all on your device.',
  ui=f'''{DROP("video/*,audio/*", "Drop a video or audio recording", "MP4, MOV, WebM, MP3, M4A, WAV · nothing is uploaded", multiple=False)}
  <p class="t-status" id="t-status" role="status"></p>
  <div id="sl-work" hidden>
    <div class="t-grid">
      <div>
        <video id="sl-video" class="vt-video" controls playsinline preload="metadata"></video>
        <p class="t-status" id="sl-info"></p>
        <canvas id="sl-wave" class="sl-wave" title="Click to jump"></canvas>
        <p class="sl-stats" id="sl-stats"></p>
        <label class="t-check"><input type="checkbox" id="sl-preview" checked> Preview with silences skipped</label>
        <div class="sr-progress" id="sl-bar" hidden><div id="sl-fill"></div></div>
      </div>
      <div class="t-panel">
        <h2>What counts as silence</h2>
        <label class="t-field">Quieter than <span id="sl-thr-val"></span><input class="t-range" type="range" id="sl-thr" min="-70" max="-15" step="1" value="-40"><small>Set automatically from your recording's background noise.</small></label>
        <label class="t-field">For at least <span id="sl-min-val"></span><input class="t-range" type="range" id="sl-min" min="0.2" max="3" step="0.05" value="0.6"><small>Shorter = snappier edit; longer keeps natural pauses.</small></label>
        <label class="t-field">Keep around speech <span id="sl-pad-val"></span><input class="t-range" type="range" id="sl-pad" min="0" max="0.5" step="0.01" value="0.12"><small>A little padding stops words being clipped.</small></label>
        <label class="t-field">Resolution <select class="t-select" id="sl-res"><option value="0">Same as original</option><option value="1080">1080p</option><option value="720" selected>720p (faster)</option></select></label>
        <button class="t-btn primary" id="sl-run" type="button" disabled style="width:100%">✂ Remove silences &amp; export</button>
      </div>
    </div>
  </div>''',
  article='''<h2>How to remove silences from a video</h2>
<ol><li>Drop your recording in. The sound is analysed in seconds and every pause is marked in red on the waveform.</li>
<li>The threshold is set automatically from the background noise of your recording. Raise it to cut more, lower it if quiet words are being treated as silence.</li>
<li>Choose how long a pause must be before it is cut, and how much breathing room to keep around speech.</li>
<li>Play the video with <em>Preview with silences skipped</em> on to hear the result, then press <strong>Remove silences &amp; export</strong>.</li></ol>
<h2>Why remove silences?</h2>
<p>Pauses, "umm, let me think" moments and fumbling between takes make videos feel slow; viewers on YouTube, TikTok and Instagram swipe away within seconds. Jump cuts keep the energy up, and editors normally spend hours making them by hand. Typical results: a 10-minute tutorial becomes 7–8 minutes without losing a word, and lecture recordings shrink by a third.</p>
<h2>Settings that work</h2>
<div class="t-table-wrap"><table class="t-table"><thead><tr><th>Content</th><th>Min. pause</th><th>Padding</th></tr></thead><tbody>
<tr><td>Fast-paced social video (Shorts, Reels, TikTok)</td><td>0.3 s</td><td>0.05 s</td></tr>
<tr><td>YouTube tutorial, talking head</td><td>0.5–0.6 s</td><td>0.1 s</td></tr>
<tr><td>Lecture, interview, podcast</td><td>1–1.5 s</td><td>0.2 s</td></tr></tbody></table></div>
<p>Every cut gets a tiny audio crossfade so there are no clicks. For full editing (zooms, captions, music) record with the <a href="/screen-recorder">screen recorder</a>; for subtitles use <a href="/auto-captions">auto captions</a> on the exported video.</p>''' + PRIVACY,
  faqs=[('Is the silence remover free?', 'Yes, with no watermark, length limit or sign-up.'),
        ('Will it cut off my words?', 'Not with the default padding. If the start or end of quiet words is clipped, lower the threshold a few dB or increase the padding.'),
        ('Does it work on podcasts and audio files?', 'Yes. Audio files are exported as MP3 with the silences removed.'),
        ('How long does it take?', 'Analysis takes seconds. Exporting re-encodes the video with your device\'s hardware encoder: usually faster than real time; choose 720p to speed it up.'),
        ('Is my video uploaded?', 'No. Everything runs in your browser.')])

# ------------------------------------------------------------------------------------------- auto-reframe
PAGES['auto-reframe'] = dict(
  name='Auto-reframe to vertical', cat='video', script='auto-reframe.js', appcat='MultimediaApplication',
  title='Auto Reframe Video to 9:16 — Landscape to Vertical, Face Tracking | WebcamClicks',
  desc='Turn landscape videos into vertical 9:16 Reels, TikToks and Shorts that follow the speaker\'s face automatically. Also 1:1 and 4:5, or blurred-background fit. Free, no upload.',
  lead='Turn any landscape video into a vertical video for Reels, TikTok and YouTube Shorts. AI face tracking keeps the speaker in frame and moves the crop smoothly like a camera operator, or fit the whole shot over a blurred background. Runs on your device.',
  ui=f'''{DROP("video/*", "Drop a landscape video", "MP4, MOV, WebM · podcasts, interviews, webinars, vlogs · nothing is uploaded", multiple=False)}
  <p class="t-status" id="t-status" role="status"></p>
  <div id="rf-work" hidden>
    <div class="rf-grid">
      <div>
        <div class="rf-wrap" id="rf-wrap"><video id="rf-video" controls playsinline preload="auto"></video><div class="rf-box" id="rf-box"></div></div>
        <p class="t-status" id="rf-info"></p>
        <div class="sr-progress" id="rf-bar" hidden><div id="rf-fill"></div></div>
      </div>
      <div class="rf-side">
        <canvas id="rf-preview" class="rf-preview" aria-label="Preview of the reframed video"></canvas>
        <div class="t-panel">
          <label class="t-field">Format <select class="t-select" id="rf-aspect"><option value="9:16">9:16 vertical (Reels, TikTok, Shorts)</option><option value="4:5">4:5 portrait (Instagram feed)</option><option value="1:1">1:1 square</option></select></label>
          <label class="t-field">Framing <select class="t-select" id="rf-mode"><option value="smooth">Follow the speaker (smooth)</option><option value="steady">Follow the speaker (steady shots)</option><option value="center">Fixed position</option><option value="blur">Whole video on blurred background</option></select></label>
          <label class="t-field" id="rf-nudge-wrap"><span>Aim offset</span><input class="t-range" type="range" id="rf-nudge" min="-100" max="100" value="0"></label>
          <label class="t-field">Size <select class="t-select" id="rf-size"><option value="hd">1080 wide (recommended)</option><option value="native">Original pixels (no upscaling)</option></select></label>
          <button class="t-btn primary" id="rf-run" type="button" disabled style="width:100%">⬇ Export video</button>
        </div>
      </div>
    </div>
  </div>''',
  article='''<h2>How to turn a landscape video into a vertical one</h2>
<ol><li>Drop your video in. Faces are found automatically, five times per second, on your device.</li>
<li>Play it: the orange box shows the part that will be kept, and the phone-shaped preview shows the result live.</li>
<li>Pick a format and a framing style, then press <strong>Export video</strong>. The sound is copied as it is.</li></ol>
<h2>Framing styles</h2>
<ul><li><strong>Follow the speaker (smooth)</strong> glides with the person as they move: best for vlogs, walking shots and lively speakers.</li>
<li><strong>Follow the speaker (steady shots)</strong> holds a still frame and only re-centres when the speaker leaves the middle of the shot, the way a camera operator works. Best for podcasts and interviews.</li>
<li><strong>Fixed position</strong> keeps the crop where you put it with the slider, useful for screen-shares with a webcam in the corner.</li>
<li><strong>Whole video on blurred background</strong> keeps everything in the shot and fills the rest of the vertical frame with a blurred, zoomed copy, perfect for slides, gameplay and group shots.</li></ul>
<p>Vertical video gets more reach: it fills the whole phone screen, and short-form feeds give it priority. Repurpose one long landscape recording into many clips: cut them with the <a href="/video-trimmer">video trimmer</a>, remove pauses with the <a href="/silence-remover">silence remover</a>, reframe here, then add animated <a href="/auto-captions">captions</a>.</p>''' + PRIVACY,
  faqs=[('Is it free?', 'Yes, with no watermark, sign-up or length limit.'),
        ('What if there are two people?', 'The largest (closest) face is followed. For two-person podcasts, the steady style switches between speakers less often; the blurred-background style keeps both in view.'),
        ('Will the quality drop?', 'A vertical crop of a 1080p video is 608 pixels wide, enlarged to 1080. For the sharpest result, record in 4K or choose “Original pixels”.'),
        ('Is my video uploaded?', 'No. Face detection and encoding run in your browser.')])
