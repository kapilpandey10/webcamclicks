# WebcamClicks — tool pages, 2026-11 batch (media, PDF, OCR, metadata).
# Executed by build-tool-pages.py with its globals (PAGES, DROP, icon, html).

VIDEO_ACCEPT = 'video/*,audio/*,.mp4,.mov,.m4v,.webm,.mkv,.mp3,.m4a,.wav,.ogg,.flac'
PRIVACY = '<p>Like every WebcamClicks tool, this runs entirely in your browser. Your files are never uploaded, so it is fast, private and free from upload limits.</p>'

def video_shell(mode, controls, extra_result=''):
    return f'''<div class="t-grid">
    <div>
      {DROP(VIDEO_ACCEPT, "Drop a video or audio file", "MP4, MOV, WebM, MKV, MP3, M4A, WAV · nothing is uploaded", multiple=False)}
      <div id="vt-work" hidden>
        <video id="vt-video" class="vt-video" controls playsinline preload="metadata"></video>
        <p class="t-status" id="vt-info"></p>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="vt-bar" hidden><div id="vt-fill"></div></div>
      <div id="vt-result" class="vt-result" hidden>
        {extra_result}
        <p id="vt-result-info"></p>
        <button class="t-btn primary" id="vt-dl" type="button">Download</button>
      </div>
    </div>
    <div class="t-panel">
      {controls}
      <button class="t-btn primary" id="vt-run" type="button" disabled style="width:100%;margin-top:6px">{ {"mp3": "Extract audio", "compress": "Compress video", "trim": "Trim video", "gif": "Create GIF"}[mode] }</button>
    </div>
  </div>'''

TRIM_FIELDS = '''<div class="t-row">
        <label class="t-field">Start (s) <input class="t-input" type="number" id="vt-start" min="0" step="0.1" value="0"></label>
        <label class="t-field">End (s) <input class="t-input" type="number" id="vt-end" min="0" step="0.1"></label>
      </div>
      <div class="t-actions" style="margin-top:-4px"><button class="t-btn sm" id="vt-set-start" type="button">Start at playhead</button><button class="t-btn sm" id="vt-set-end" type="button">End at playhead</button></div>
      <p class="t-status" id="vt-range" style="font-size:.84rem"></p>'''

# ------------------------------------------------------------------------------------------- MP4 to MP3
PAGES['mp4-to-mp3'] = dict(
  name='MP4 to MP3', cat='video', script='video-tools.js', mode='mp3', appcat='MultimediaApplication',
  title='MP4 to MP3 Converter — Extract Audio from Video, Free | WebcamClicks',
  desc='Convert MP4, MOV, WebM or MKV to MP3, WAV, M4A, OGG or FLAC. Choose bitrate and trim the clip. Free, private, no upload, no file size limit.',
  lead='Extract the soundtrack from any video as MP3, WAV, M4A, OGG or FLAC. Pick a quality, optionally cut out just the part you need, and download. The file never leaves your device.',
  ui=video_shell('mp3', '''<h2>Audio settings</h2>
      <label class="t-field">Format <select class="t-select" id="vt-format"><option value="mp3">MP3 (plays everywhere)</option><option value="m4a">M4A / AAC (small, Apple-friendly)</option><option value="ogg">OGG Opus (smallest)</option><option value="wav">WAV (uncompressed)</option><option value="flac">FLAC (lossless)</option></select></label>
      <label class="t-field">Quality <select class="t-select" id="vt-bitrate"><option value="128">128 kbps (podcasts, voice)</option><option value="192" selected>192 kbps (music, recommended)</option><option value="320">320 kbps (best)</option></select></label>
      ''' + TRIM_FIELDS),
  article='''<h2>How to convert MP4 to MP3</h2>
<ol><li>Drop your video into the box (MP4, MOV from iPhone, WebM, MKV and most others work).</li>
<li>Choose a format and quality. MP3 at 192 kbps is right for music; 128 kbps is plenty for speech.</li>
<li>Optionally set a start and end to keep only part of the audio, for example a single song from a concert video.</li>
<li>Press <strong>Extract audio</strong> and download the file.</li></ol>
<h2>Which audio format should I choose?</h2>
<ul><li><strong>MP3</strong> plays on every phone, car stereo and app. The safe choice.</li>
<li><strong>M4A (AAC)</strong> sounds slightly better than MP3 at the same size and is the native format on iPhone and in iTunes.</li>
<li><strong>OGG Opus</strong> is the most efficient: excellent quality at small sizes, ideal for voice notes and the web.</li>
<li><strong>WAV</strong> is uncompressed, so it's best for editing in audio software but files are large.</li>
<li><strong>FLAC</strong> is lossless but smaller than WAV. Use it to archive audio with no quality loss.</li></ul>
<p>Converting can't add quality that wasn't there: if the video's audio is 128 kbps AAC, exporting a 320 kbps MP3 makes a bigger file, not a better one.</p>''' + PRIVACY,
  faqs=[('Is this MP4 to MP3 converter free?', 'Yes. There are no limits on file size or number of conversions, and no watermark or sign-up.'),
        ('Is my video uploaded?', 'No. The audio is decoded and encoded in your browser using your computer\'s own media engine.'),
        ('Can I convert iPhone MOV videos?', 'Yes. MOV, MP4, M4V, WebM and MKV are supported, as long as your browser can decode the audio codec inside (AAC, Opus, MP3 and most others).'),
        ('Why is M4A or OGG greyed out or failing?', 'Some browsers cannot encode AAC or Opus on every operating system. MP3 and WAV always work.')])

# ------------------------------------------------------------------------------------------- video compressor
PAGES['video-compressor'] = dict(
  name='Video compressor', cat='video', script='video-tools.js', mode='compress', appcat='MultimediaApplication',
  title='Video Compressor — Reduce Video File Size Online, Free | WebcamClicks',
  desc='Compress MP4, MOV and WebM videos for email, WhatsApp, Discord and uploads. Choose resolution and quality, trim, mute. Hardware-accelerated, private, no upload.',
  lead='Make videos small enough for email, WhatsApp, Discord or an upload form. Lower the resolution, pick a quality and see exactly how much smaller the file gets. Compression runs on your device using its video hardware.',
  ui=video_shell('compress', '''<h2>Compression</h2>
      <div class="t-row">
        <label class="t-field">Resolution <select class="t-select" id="vt-res"><option value="0">Keep original</option><option value="1080">1080p</option><option value="720" selected>720p (recommended)</option><option value="480">480p</option><option value="360">360p (smallest)</option></select></label>
        <label class="t-field">Quality <select class="t-select" id="vt-quality"><option value="high">High</option><option value="medium" selected>Balanced</option><option value="low">Small file</option><option value="tiny">Smallest</option></select></label>
      </div>
      <div class="t-row">
        <label class="t-field">Format <select class="t-select" id="vt-format"><option value="mp4">MP4 (H.264, plays everywhere)</option><option value="webm">WebM (VP9)</option></select></label>
        <label class="t-field">&nbsp;<span class="t-check" style="margin:8px 0 0"><input type="checkbox" id="vt-mute"> Remove audio</span></label>
      </div>
      ''' + TRIM_FIELDS),
  article='''<h2>How much can a video be compressed?</h2>
<p>Phones record at very high bitrates: a minute of 4K iPhone video can be 300–400 MB. Re-encoding at 720p with balanced quality usually brings that minute down to 15–30 MB, more than 90% smaller, with no visible difference on a phone screen. Screen recordings and talking-head videos compress even better because little changes between frames.</p>
<h2>Recommended settings</h2>
<div class="t-table-wrap"><table class="t-table"><thead><tr><th>Where you're sending it</th><th>Settings</th></tr></thead><tbody>
<tr><td>Email (25 MB limit)</td><td>720p · Small file · trim to what matters</td></tr>
<tr><td>WhatsApp / Telegram</td><td>720p · Balanced</td></tr>
<tr><td>Discord (10 MB free limit)</td><td>480p · Small file, or 360p for longer clips</td></tr>
<tr><td>YouTube / Vimeo upload</td><td>Keep original or 1080p · High</td></tr>
<tr><td>Website background video</td><td>720p · Small file · Remove audio · WebM</td></tr></tbody></table></div>
<h2>Fast, because it uses your hardware</h2>
<p>The compressor uses your device's built-in video encoder through the WebCodecs standard, the same chips that record and play video on your computer or phone. A one-minute clip typically compresses in seconds, and nothing has to be uploaded or downloaded again.</p>''' + PRIVACY,
  faqs=[('Is there a file size limit?', 'No upload means no upload limit. Very long 4K videos are only limited by your device\'s memory.'),
        ('Will compression reduce quality?', 'Slightly, by design. Balanced quality at 720p looks the same as the original on phones and laptops for most videos. Use High if you plan to edit the result further.'),
        ('Why is my compressed file bigger?', 'If the original was already heavily compressed, re-encoding at High quality can grow it. Choose a lower resolution or the Small file setting.'),
        ('Does it work on iPhone and Android?', 'Yes, in recent Safari and Chrome. Older browsers without the WebCodecs video encoder cannot compress video.')])

# ------------------------------------------------------------------------------------------- video trimmer
PAGES['video-trimmer'] = dict(
  name='Video trimmer', cat='video', script='video-tools.js', mode='trim', appcat='MultimediaApplication',
  title='Video Trimmer — Cut MP4 Videos Online Without Uploading | WebcamClicks',
  desc='Trim the start and end of MP4, MOV or WebM videos in seconds. Fast lossless cut or frame-precise re-encode. Free, private, no watermark, no upload.',
  lead='Cut the boring start and end off a video. Play it, set the start and end at the playhead and download. Fast mode copies the video without re-encoding, so there is no quality loss.',
  ui=video_shell('trim', '<h2>Trim</h2>' + TRIM_FIELDS + '''
      <label class="t-check"><input type="checkbox" id="vt-precise"> Frame-precise cut (re-encodes; slower)</label>
      <p class="muted" style="font-size:.82rem;margin:0 0 6px">Fast mode is lossless and instant, but cuts can only start on a keyframe (usually within a second or two of your mark).</p>'''),
  article='''<h2>How to trim a video</h2>
<ol><li>Drop your video in and press play.</li><li>Pause where the good part starts and press <strong>Start at playhead</strong>; do the same for the end.</li>
<li>Press <strong>Trim video</strong>. The new file downloads in seconds.</li></ol>
<h2>Fast vs frame-precise</h2>
<p>Videos are stored as keyframes (complete pictures) followed by changes. <strong>Fast mode</strong> copies the original frames without decoding them, so it takes seconds and loses no quality, but the cut snaps to the nearest keyframe. <strong>Frame-precise</strong> mode re-encodes the video so the cut is exactly where you set it; it takes longer and re-compresses the picture slightly.</p>
<p>Need more than one cut, captions, zooms or music? Use the <a href="/screen-recorder">screen recorder's editor</a> or <a href="/auto-captions">auto captions</a>.</p>''' + PRIVACY,
  faqs=[('Does trimming reduce quality?', 'Not in fast mode, which copies the original video data. Frame-precise mode re-encodes at high quality.'),
        ('Can I cut a section out of the middle?', 'This tool keeps one continuous part. To remove a middle section, use the clip editor in the screen recorder: split twice and delete the part you don\'t want.'),
        ('Which formats are supported?', 'MP4, MOV, M4V, WebM and MKV, plus audio files such as M4A and MP3.')])

# ------------------------------------------------------------------------------------------- video to GIF
PAGES['video-to-gif'] = dict(
  name='Video to GIF', cat='video', script='video-tools.js', mode='gif', appcat='MultimediaApplication',
  title='Video to GIF Maker — Convert MP4 to GIF Free, No Upload | WebcamClicks',
  desc='Turn a video clip into a looping GIF. Choose the start, length, frame rate and width. Free, no watermark, made on your device.',
  lead='Turn a moment from any video into a looping GIF for chats, docs and social posts. Pick the part, the size and the smoothness, then download.',
  ui=video_shell('gif', '<h2>GIF settings</h2>' + TRIM_FIELDS + '''
      <div class="t-row">
        <label class="t-field">Frame rate <select class="t-select" id="vt-fps"><option value="8">8 fps (smallest)</option><option value="12" selected>12 fps</option><option value="15">15 fps (smooth)</option><option value="20">20 fps</option></select></label>
        <label class="t-field">Width <select class="t-select" id="vt-width"><option value="320">320 px</option><option value="480" selected>480 px</option><option value="640">640 px</option><option value="800">800 px</option></select></label>
      </div>
      <p class="muted" style="font-size:.82rem;margin:0 0 6px">GIFs are limited to 20 seconds. Smaller width and fewer frames make much smaller files.</p>''',
      extra_result='<img id="vt-gif" class="vt-gif" alt="GIF preview" hidden>'),
  article='''<h2>Making GIFs that look good and stay small</h2>
<p>GIF is an old format: it stores every frame with at most 256 colours and compresses poorly, so a few seconds of full-HD video can easily become 30 MB. The tricks are to keep clips short (2–6 seconds), use 12–15 frames per second and a width of 480 px or less. This maker builds an optimised colour palette from your clip and refreshes it as the scene changes, which keeps colours accurate.</p>
<h2>Where GIFs still win</h2>
<ul><li>Slack, Teams, Discord and email, where a GIF plays inline everywhere without a play button.</li>
<li>GitHub READMEs and documentation, to show a feature in action.</li>
<li>Reaction clips and memes.</li></ul>
<p>For websites, a short muted MP4 or WebM is 5–10× smaller than the same GIF; the <a href="/video-compressor">video compressor</a> can make one.</p>''' + PRIVACY,
  faqs=[('Is there a watermark?', 'No. GIFs are made on your device with no watermark.'),
        ('Why is my GIF so large?', 'GIF compression is inefficient. Shorten the clip, lower the frame rate to 8–12 fps and reduce the width to 320–480 px.'),
        ('Can I make a GIF from a YouTube video?', 'Only from video files on your device. Downloading YouTube videos is against YouTube\'s terms.')])

# ------------------------------------------------------------------------------------------- auto captions
PAGES['auto-captions'] = dict(
  name='Auto captions & subtitles', cat='video', script='auto-captions.js', appcat='MultimediaApplication',
  title='Auto Caption Generator — Free AI Subtitles, SRT & Burned-in | WebcamClicks',
  desc='Free AI caption generator with word-by-word timing and 12 animated styles (bold pop, karaoke, highlight box, one word). 35+ languages, SRT/VTT, burn-in. No upload.',
  lead='Drop a video and get perfectly timed captions, word by word, from an AI speech model that runs in your browser. Pick a trending animated style, edit any line, translate, then download subtitles or a video with the captions burned in.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP(VIDEO_ACCEPT, "Drop a video or audio file", "MP4, MOV, WebM, MP3, M4A, WAV · nothing is uploaded", multiple=False)}
      <div id="cap-editor" hidden>
        <div class="cap-stage" id="cap-stage"><video id="cap-video" controls playsinline preload="metadata"></video><canvas id="cap-overlay" aria-hidden="true"></canvas></div>
        <div class="cap-tl" id="cap-tl">
          <div class="cap-tl-top"><span class="cap-tl-time" id="cap-tl-time">0:00</span><span class="cap-tl-hint">Click to jump · drag a caption's edge to retime it</span>
            <span class="cap-tl-zoom"><button type="button" class="t-icon-btn" id="cap-tl-out" aria-label="Zoom out">−</button><button type="button" class="t-icon-btn" id="cap-tl-in" aria-label="Zoom in">+</button></span></div>
          <div class="cap-tl-scroll" id="cap-tl-scroll"><div class="cap-tl-track" id="cap-tl-track">
            <div class="cap-tl-ruler" id="cap-tl-ruler"></div><div class="cap-tl-prog" id="cap-tl-prog"></div><div class="cap-tl-cues" id="cap-tl-cues"></div><div class="cap-tl-head" id="cap-tl-head"></div>
          </div></div>
        </div>
        <p class="t-status" id="cap-info"></p>
      </div>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="cap-bar" hidden><div id="cap-fill"></div></div>
      <h2 class="cap-h">Captions</h2>
      <ol class="cap-cues" id="cap-cues"></ol>
      <div class="t-actions"><button class="t-btn sm" id="cap-add" type="button">+ Add caption at playhead</button>
        <label class="t-btn sm" style="cursor:pointer">Import SRT / VTT<input type="file" id="cap-import" accept=".srt,.vtt,text/vtt" hidden></label></div>
    </div>
    <div class="t-panel">
      <h2>1 · Generate</h2>
      <label class="t-field">Spoken language <select class="t-select" id="cap-lang"></select></label>
      <div class="t-row">
        <label class="t-field">Accuracy <select class="t-select" id="cap-model"><option value="fast">Fast (≈40 MB)</option><option value="balanced" selected>Balanced (≈80 MB)</option><option value="accurate">Accurate (≈250 MB)</option><option value="best">Best, for Nepali, Hindi &amp; more (≈600 MB, graphics chip)</option></select></label>
        <label class="t-field">Captions in <select class="t-select" id="cap-task"><option value="transcribe">Same language</option><option value="translate">Translate to English</option></select></label>
      </div>
      <label class="t-check"><input type="checkbox" id="cap-auto" checked> Generate automatically when I add a video</label>
      <button class="t-btn primary" id="cap-run" type="button" disabled style="width:100%">✨ Generate captions</button>
      <p class="cap-model" id="cap-model-status" aria-live="polite"></p>
      <p class="cap-detected" id="cap-detected" hidden aria-live="polite"></p>
      <h2 style="margin-top:18px">2 · Style</h2>
      <div class="cap-styles" id="cap-styles" role="radiogroup" aria-label="Caption style"></div>
      <div class="t-row">
        <label class="t-field">Words per caption <select class="t-select" id="cap-group"><option value="auto">Style default</option><option value="1">1 word</option><option value="2">2 words</option><option value="3">Up to 3 words</option><option value="short">Short line</option><option value="lines">Full subtitle (2 lines)</option></select></label>
        <label class="t-field">Size <input class="t-range" type="range" id="cap-size" min="30" max="120" value="70"></label>
      </div>
      <label class="t-field">Position (top ↔ bottom) <input class="t-range" type="range" id="cap-pos" min="8" max="92" value="72"></label>
      <div class="t-row cap-colors">
        <label class="t-field"><span>Text</span><input type="color" id="cap-fillc" value="#ffffff"></label>
        <label class="t-field"><span>Spoken word</span><input type="color" id="cap-activec" value="#ffe14d"></label>
        <label class="t-check" style="align-self:end"><input type="checkbox" id="cap-upper"> CAPITALS</label>
      </div>
      <div class="t-row"><label class="t-field">Shift all (s) <input class="t-input" type="number" id="cap-shift" step="0.1" value="0.5"></label><div class="t-field">&nbsp;<button class="t-btn sm" id="cap-shift-btn" type="button">Apply shift</button></div></div>
      <h2 style="margin-top:18px">3 · Translate</h2>
      <div id="cap-tr-wrap">
        <label class="t-field">Translate captions to <select class="t-select" id="cap-tr-lang"></select></label>
        <div class="t-actions" style="margin-top:0"><button class="t-btn sm" id="cap-tr-run" type="button" disabled>Translate</button><button class="t-btn sm" id="cap-tr-undo" type="button" hidden>Restore original</button></div>
        <p class="muted" style="font-size:.8rem;margin:6px 0 0" id="cap-tr-note"></p>
      </div>
      <h2 style="margin-top:18px">4 · Export</h2>
      <div class="t-actions" style="margin-top:0">
        <button class="t-btn" id="cap-srt" type="button" disabled>SRT</button><button class="t-btn" id="cap-vtt" type="button" disabled>VTT</button><button class="t-btn" id="cap-txt" type="button" disabled>Transcript</button>
      </div>
      <button class="t-btn primary" id="cap-burn" type="button" disabled style="width:100%;margin-top:10px">Burn captions into video (MP4)</button>
    </div>
  </div>''',
  article='''<h2>How the caption generator works</h2>
<p>WebcamClicks runs <strong>Whisper</strong>, an open speech-recognition model trained on 680,000 hours of audio, directly in your browser using WebGPU or WebAssembly. Your video's soundtrack is decoded on your device, the model turns it into timed text, and the editor splits that text into readable captions: at most two lines of about 42 characters, as broadcasters recommend. Nothing is uploaded, which also makes it suitable for confidential meetings, lectures and client work.</p>
<h2>Step by step</h2>
<ol><li><strong>Drop a video or audio file.</strong> MP4, MOV, WebM, MKV, MP3, M4A and WAV all work.</li>
<li><strong>Choose the spoken language</strong> or leave it on automatic, and pick Fast, Balanced or Accurate. Accurate is noticeably better for accents, names and noisy audio but downloads a bigger model once.</li>
<li><strong>Check the captions.</strong> Play the video: the captions appear exactly as they will in the final file. Click any line to jump there and fix a word or a timestamp.</li>
<li><strong>Translate</strong> if you need another language, then <strong>export</strong> an SRT/VTT file or burn the captions into an MP4.</li></ol>
<h2>Animated caption styles, timed word by word</h2>
<p>The speech model reports when every single word is spoken, so captions can highlight each word the moment it is said, the look that keeps viewers watching on TikTok, Reels and Shorts. Choose from 12 styles:</p>
<ul><li><strong>Bold pop</strong>: heavy white capitals with a black outline; the spoken word turns yellow and springs up.</li>
<li><strong>Karaoke</strong>: words fill with colour as they are said.</li>
<li><strong>Highlight box</strong>: a coloured box jumps from word to word.</li>
<li><strong>One word</strong>: one big word at a time in changing colours, for fast-paced edits.</li>
<li><strong>Gradient, Comic, Neon and Marker</strong> for a more playful look.</li>
<li><strong>Coral bar, Typewriter, Classic subtitle and Minimal</strong> for interviews, tutorials and films.</li></ul>
<p>Set how many words appear at once (one, two, three, a short line or a full two-line subtitle), the size, the colours and the position, and see it live on your video before exporting. Burned-in captions keep the animation exactly as previewed.</p>
<h2>Fast, because the AI is ready before you need it</h2>
<p>When you open this page, the speech model starts downloading quietly in the background (unless your device has Data Saver turned on), and a small note shows the progress. By the time you have chosen a video, it is usually ready, and captions start automatically when you add the file. The model is stored by your browser, so later visits work instantly and even offline.</p>
<h2>SRT, VTT or burned-in captions?</h2>
<ul><li><strong>SRT</strong> is the universal subtitle file: upload it to YouTube, Facebook, LinkedIn or Vimeo next to your video, or load it in VLC. Viewers can switch captions on and off, and platforms index the text for search.</li>
<li><strong>VTT</strong> is the web standard used by HTML5 video players and many course platforms.</li>
<li><strong>Burned-in</strong> (open) captions are part of the picture. Use them for Instagram Reels, TikTok, Shorts and X, where most people watch without sound and uploaded subtitle files aren't supported.</li></ul>
<h2>Languages and translation</h2>
<p>Whisper understands about 100 languages; the menu lists the most common. It can transcribe in the original language or translate straight to English. To translate captions into other languages, WebcamClicks uses the on-device translator built into recent Chrome on desktop. Where that isn't available, download the SRT and translate it in your usual tool.</p>
<p>Tip: clear audio gives the best captions. Use the <a href="/mic-test">mic test</a> before recording, and the noise removal in the <a href="/screen-recorder">screen recorder's editor</a> for noisy rooms.</p>''',
  faqs=[('Is the caption generator really free and private?', 'Yes. The AI model runs in your browser, so your video is never uploaded and there are no per-minute fees or watermarks.'),
        ('How accurate are the captions?', 'Very good for clear speech in major languages, especially with the Accurate model. Always skim the result: names, jargon and overlapping speakers may need a quick fix in the editor.'),
        ('Does it time each word?', 'Yes. Captions are timed word by word, so styles like Bold pop and Karaoke highlight each word exactly when it is spoken. If a model can\'t provide word timings on your device, the words are spread over the detected speech instead.'),
        ('Why are captions in the wrong language?', 'Leave Spoken language on Detect automatically and the language is identified from up to three parts of your video; the result is shown with how sure the AI is. If it is wrong, or for languages that sound alike (Nepali, Hindi, Marathi, Urdu), choose the language yourself. For less common languages, Accurate or Best give far better text than Fast.'),
        ('How long does it take?', 'With a graphics chip (WebGPU), a 10-minute video usually takes one to three minutes on the Balanced model. Without one it runs on the processor and is slower; use the Fast model for long videos.'),
        ('Can I translate captions into Spanish, Hindi or other languages?', 'Yes, in Chrome 138 or newer on a computer, which has an on-device translator. In other browsers you can transcribe in the original language or translate to English.'),
        ('Can I upload the SRT to YouTube?', 'Yes. In YouTube Studio open Subtitles, choose your video, then Add > Upload file > With timing, and select the SRT.')])

# ------------------------------------------------------------------------------------------- teleprompter
PAGES['teleprompter'] = dict(
  name='Teleprompter', cat='camera', script='teleprompter.js', appcat='MultimediaApplication',
  title='Online Teleprompter with Webcam Recording — Free | WebcamClicks',
  desc='Free online teleprompter: your script scrolls over your webcam near the lens while you record. Adjustable speed (WPM), size, mirror mode, countdown. Records on your device.',
  lead='Read your script while looking at the camera. The text scrolls over your webcam right next to the lens, at the speed you choose, and the recording is saved on your device. The script is never recorded.',
  ui='''<div class="tp-wrap">
    <div class="tp-stage" id="tp-stage">
      <video id="tp-video" playsinline muted autoplay></video>
      <div class="tp-shade"></div>
      <div class="tp-scroller" id="tp-scroller"><div class="tp-text" id="tp-text"></div></div>
      <div class="tp-cd" id="tp-cd" hidden>3</div>
      <div class="tp-timer" id="tp-timer" hidden>● 0:00</div>
      <div class="tp-bar">
        <button class="t-btn" id="tp-cam" type="button">📷 Camera on</button>
        <button class="t-btn" id="tp-start" type="button">▶ Scroll</button>
        <button class="t-btn" id="tp-reset" type="button" title="Back to the start (Home)">⟲</button>
        <button class="t-btn primary" id="tp-rec" type="button" disabled>● Record</button>
        <button class="t-btn dark" id="tp-stopbtn" type="button" hidden>■ Stop</button>
        <button class="t-btn" id="tp-full" type="button" title="Fullscreen">⛶</button>
      </div>
    </div>
    <div class="tp-side">
      <label class="t-field">Your script <textarea class="t-textarea" id="tp-script" rows="10">Hi, I'm [your name], and in this video I'll show you three ways to look great on camera.

First, put a light in front of you, not behind you.

Second, raise your camera to eye level so you're not looking down at it.

And third, look at the lens, not at yourself on the screen. A teleprompter right under the camera makes that easy.

Thanks for watching, see you in the next one.</textarea></label>
      <p class="muted" style="font-size:.82rem;margin:-4px 0 12px" id="tp-wpm"></p>
      <label class="t-field">Speed <span id="tp-speed-val"></span><input class="t-range" type="range" id="tp-speed" min="60" max="260" step="5" value="140"></label>
      <div class="t-row">
        <label class="t-field">Text size <input class="t-range" type="range" id="tp-size" min="18" max="72" value="34"></label>
        <label class="t-field">Text area <input class="t-range" type="range" id="tp-band" min="25" max="100" value="45"></label>
      </div>
      <div class="t-row">
        <label class="t-field">Background dim <input class="t-range" type="range" id="tp-opacity" min="0" max="90" value="55"></label>
        <label class="t-field">Align <select class="t-select" id="tp-align"><option value="center">Centre</option><option value="left">Left</option></select></label>
      </div>
      <label class="t-check"><input type="checkbox" id="tp-mirror"> Mirror text (for teleprompter glass)</label>
      <label class="t-check"><input type="checkbox" id="tp-mirrorcam" checked> Mirror my camera preview</label>
      <label class="t-field">Recording quality <select class="t-select" id="tp-quality"><option value="720">720p</option><option value="1080" selected>1080p</option></select></label>
      <p class="t-status" id="t-status" role="status"></p>
      <div id="tp-result" hidden><video id="tp-playback" controls playsinline class="vt-video"></video><button class="t-btn primary" id="tp-dl" type="button" style="margin-top:8px">Download recording</button></div>
    </div>
  </div>''',
  article='''<h2>How to use the online teleprompter</h2>
<ol><li><strong>Paste your script</strong> on the right. It saves automatically in your browser, so you won't lose it if you close the tab.</li>
<li><strong>Turn the camera on</strong> and move the text area up so the words sit just under your webcam. Your eyes stay near the lens, and viewers feel you're talking to them.</li>
<li><strong>Set the speed.</strong> 130–150 words per minute is natural conversation; 110 suits tutorials; 170+ is energetic social content. The page tells you how long the script will take.</li>
<li>Press <strong>Record</strong>. After a 3-2-1 countdown the text starts scrolling and your camera and microphone are recorded. Press <kbd>Space</kbd> to pause the text and <kbd>↑</kbd> <kbd>↓</kbd> to change speed without stopping.</li>
<li>Press <strong>Stop</strong> to watch the take and download it.</li></ol>
<h2>Tips for a natural delivery</h2>
<ul><li>Write the way you speak: short sentences, contractions, one idea per paragraph. Blank lines become pauses.</li>
<li>Keep the text area small and high. The less your eyes travel, the less it looks like reading.</li>
<li>Do a practice run without recording, then record two takes and keep the best.</li>
<li>Using a physical teleprompter with a beam-splitter glass? Turn on <em>Mirror text</em>.</li></ul>
<h2>Next steps</h2>
<p>Add subtitles with <a href="/auto-captions">auto captions</a>, shrink the file with the <a href="/video-compressor">video compressor</a>, or record your screen and camera together with the <a href="/screen-recorder">screen recorder</a>. Check your lighting first with the <a href="/webcam-test">webcam test</a>.</p>''' + PRIVACY,
  faqs=[('Is the teleprompter text recorded in the video?', 'No. Only your camera and microphone are recorded. The script is an on-screen overlay.'),
        ('Can I control the speed while recording?', 'Yes. Use the up and down arrow keys, or press Space to pause and resume the text.'),
        ('Does it work on phones?', 'Yes, in Chrome and Safari. Hold the phone in landscape or portrait, put the text area near the front camera and keep the screen awake.'),
        ('What format is the recording?', 'MP4 in browsers that support it (recent Chrome, Edge and Safari), otherwise WebM. Both upload directly to YouTube and social networks.')])

# ------------------------------------------------------------------------------------------- photo enhancer
PAGES['photo-enhancer'] = dict(
  name='Photo enhancer', cat='image', script='photo-enhancer.js', appcat='PhotographyApplication',
  title='Free Photo Enhancer — Fix Dark, Blurry & Noisy Photos, 2× Upscale | WebcamClicks',
  desc='Enhance photos for free: auto exposure, colour balance, noise reduction, sharpening and 2× upscaling. Batch process, before/after slider. Runs on your device, no upload.',
  lead='Rescue dull, dark, noisy or soft photos in one click. The enhancer fixes exposure and colour, reduces noise, sharpens detail and can double the resolution, all on your device, for as many photos as you like.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*", "Drop photos to enhance", "JPG, PNG, WebP · batch supported · nothing is uploaded")}
      <div class="pe-compare" id="t-compare" hidden style="--split:50%">
        <img id="t-before" alt="Before"><img id="t-after" alt="After">
        <span class="pe-lbl l">Before</span><span class="pe-lbl r">After</span>
        <input type="range" id="t-split" min="0" max="100" value="50" aria-label="Compare before and after">
      </div>
      <ul class="t-list" id="t-list"></ul>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Enhancement</h2>
      <label class="t-field">Photo type <select class="t-select" id="t-preset"><option value="auto">Auto (recommended)</option><option value="portrait">Portrait / selfie</option><option value="lowlight">Low light / night</option><option value="landscape">Landscape / travel</option><option value="document">Document / whiteboard</option></select></label>
      <label class="t-field">Strength <input class="t-range" type="range" id="t-strength" min="0" max="100" value="70"></label>
      <label class="t-field">Noise reduction <input class="t-range" type="range" id="t-denoise" min="0" max="100" value="30"></label>
      <label class="t-field">Sharpening <input class="t-range" type="range" id="t-sharpen" min="0" max="100" value="45"></label>
      <div class="t-row">
        <label class="t-field">Size <select class="t-select" id="t-upscale"><option value="1">Original</option><option value="2">2× upscale</option></select></label>
        <label class="t-field">Save as <select class="t-select" id="t-format"><option value="same">Same as original</option><option value="image/jpeg">JPG</option><option value="image/png">PNG</option><option value="image/webp">WebP</option></select></label>
      </div>
      <div class="t-actions">
        <button class="t-btn primary" id="t-run" type="button" disabled>Enhance again</button>
        <button class="t-btn" id="t-dl-one" type="button">Download shown</button>
        <button class="t-btn" id="t-zip" type="button" disabled>Download all</button>
        <button class="t-btn" id="t-clear" type="button">Clear</button>
      </div>
    </div>
  </div>''',
  article='''<h2>What the photo enhancer does</h2>
<ul><li><strong>Auto levels and colour balance</strong> stretch each colour channel to its full range, which removes the grey haze from phone and webcam photos and neutralises yellow or blue casts from indoor lighting.</li>
<li><strong>Exposure</strong> brightens or darkens the mid-tones towards a natural level and gently lifts deep shadows without blowing out skies.</li>
<li><strong>Vibrance</strong> boosts muted colours more than already-strong ones, so skin tones stay natural.</li>
<li><strong>Noise reduction</strong> smooths the colour speckles of low-light photos and uses an edge-preserving filter on brightness so detail survives.</li>
<li><strong>Sharpening</strong> works on brightness only, with a threshold that ignores noise, so edges get crisp without halos or colour fringes.</li>
<li><strong>2× upscale</strong> doubles the width and height with high-quality interpolation followed by detail sharpening. Ideal for small images you need to print or use as a thumbnail.</li></ul>
<p>Pick the photo type that matches your picture: <em>Low light</em> applies more brightening and noise reduction, <em>Document</em> makes paper white and text dark, and <em>Portrait</em> keeps skin soft. Drag the slider on the preview to compare before and after, then fine-tune and press <strong>Enhance again</strong>.</p>
<h2>Honest expectations</h2>
<p>This enhancer uses proven image-processing techniques, not generative AI, so it never invents faces, text or details that weren't in the photo. It can make a dark, flat, noisy picture look clean and vivid. It cannot recover a photo that is badly out of focus or motion-blurred.</p>''' + PRIVACY,
  faqs=[('Is the photo enhancer free?', 'Yes, with no watermark, sign-up or limit on the number of photos.'),
        ('Are my photos uploaded?', 'No. All processing happens in a background thread in your browser.'),
        ('Does 2× upscaling add real detail?', 'It produces a smooth, sharp image at double the size, which is great for printing and screens. It does not invent new detail like generative AI upscalers do.'),
        ('Can I enhance many photos at once?', 'Yes. Drop a whole batch; each photo is processed in turn and you can download them all as a ZIP.')])

# ------------------------------------------------------------------------------------------- PDF to JPG
PAGES['pdf-to-jpg'] = dict(
  name='PDF to JPG', cat='pdf', script='pdf-to-jpg.js', appcat='BusinessApplication',
  title='PDF to JPG — Convert PDF Pages to Images Free, No Upload | WebcamClicks',
  desc='Convert PDF pages to high-quality JPG, PNG or WebP images at up to 300 DPI. Pick pages, download one image or a ZIP. Free, private, no upload.',
  lead='Turn PDF pages into images for slides, social posts, websites or messaging. Choose the pages and the resolution, then download a single image or a ZIP of all of them.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("application/pdf,.pdf", "Drop a PDF here", "Any size · password-protected PDFs work too · nothing is uploaded", multiple=False)}
      <p class="t-status" id="t-info"></p>
      <div class="t-actions"><button class="t-btn sm" id="t-all" type="button" disabled>Select all</button><button class="t-btn sm" id="t-none" type="button" disabled>Select none</button></div>
      <div class="pg-grid" id="t-pages"></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Image settings</h2>
      <label class="t-field">Format <select class="t-select" id="t-fmt"><option value="image/jpeg">JPG</option><option value="image/png">PNG (sharp text, transparent-free)</option><option value="image/webp">WebP</option></select></label>
      <label class="t-field">Resolution <select class="t-select" id="t-dpi"><option value="72">72 DPI (screen, small)</option><option value="150" selected>150 DPI (recommended)</option><option value="200">200 DPI</option><option value="300">300 DPI (print)</option></select></label>
      <label class="t-field">JPG / WebP quality <input class="t-range" type="range" id="t-quality" min="50" max="100" value="90"></label>
      <button class="t-btn primary" id="t-run" type="button" disabled style="width:100%">Convert to images</button>
    </div>
  </div>''',
  article='''<h2>How to convert a PDF to JPG</h2>
<ol><li>Drop your PDF in. Thumbnails of every page appear.</li><li>Untick any pages you don't need.</li>
<li>Choose JPG for photos and mixed content, PNG for crisp text and diagrams, and 150 DPI for screens or 300 DPI for printing.</li>
<li>Press <strong>Convert to images</strong>. One page downloads as an image; several download together as a ZIP.</li></ol>
<h2>Which resolution should I use?</h2>
<p>DPI controls how many pixels each inch of the page gets. An A4 page at 150 DPI is about 1240 × 1754 pixels, sharp on any screen and small enough to share. 300 DPI (2480 × 3508) is print quality. 72 DPI makes small previews and thumbnails.</p>
<p>Pages are rendered with pdf.js, the same engine Firefox uses to display PDFs, so fonts, vector graphics and images look exactly like the original. Going the other way? Use <a href="/jpg-to-pdf">JPG to PDF</a>.</p>''' + PRIVACY,
  faqs=[('Is PDF to JPG free?', 'Yes, unlimited and without watermarks.'),
        ('Can I convert a password-protected PDF?', 'Yes. You will be asked for the password, which never leaves your device.'),
        ('Will text stay sharp?', 'Yes at 150 DPI and above. For documents with small text, choose PNG or 200–300 DPI.'),
        ('How many pages can I convert?', 'There is no limit; very long PDFs at 300 DPI just take longer.')])

# ------------------------------------------------------------------------------------------- PDF editor
PAGES['pdf-editor'] = dict(
  name='PDF editor', cat='pdf', script='pdf-editor.js', appcat='BusinessApplication',
  title='Free PDF Editor — Edit Existing Text, Sign, Fill & Annotate | WebcamClicks',
  desc='Edit the existing text in a PDF, matched to its font, size and colour. Also add text, sign, highlight, white-out, insert images, rotate or delete pages. Free, no upload.',
  lead='Change the words already in your PDF: click a line and type, and the new text matches the original font, size and colour. Fill in forms, sign, highlight, add images and rotate or delete pages too. Everything happens on your device.',
  ui=f'''{DROP("application/pdf,.pdf", "Drop a PDF to edit", "Nothing is uploaded · works offline once loaded", multiple=False)}
  <p class="t-status" id="t-status" role="status"></p>
  <div id="pe-editor" class="pe-editor" hidden>
    <div class="pe-toolbar">
      <div class="pe-tools" id="pe-tools" role="toolbar" aria-label="PDF tools">
        <button type="button" data-tool="select" aria-pressed="true">↖ Select</button>
        <button type="button" data-tool="edittext" aria-pressed="false" class="pe-hot">Aa Edit text</button>
        <button type="button" data-tool="text" aria-pressed="false">T Add text</button>
        <button type="button" data-tool="sign" aria-pressed="false">✍ Sign</button>
        <button type="button" data-tool="draw" aria-pressed="false">✎ Draw</button>
        <button type="button" data-tool="highlight" aria-pressed="false">▮ Highlight</button>
        <button type="button" data-tool="whiteout" aria-pressed="false">▭ White-out</button>
        <button type="button" data-tool="rect" aria-pressed="false">□ Box</button>
        <button type="button" data-tool="image" aria-pressed="false">🖼 Image</button>
      </div>
      <div class="pe-props">
        <label>Colour <input type="color" id="pe-color" value="#0e0e12"></label>
        <label>Text <input type="number" id="pe-size" min="6" max="72" value="12"> pt</label>
        <label>Line <input type="number" id="pe-width" min="1" max="12" value="2"> pt</label>
        <button class="t-btn sm" id="pe-undo" type="button" disabled>↶ Undo</button>
        <button class="t-btn primary sm" id="pe-save" type="button" disabled>⬇ Save PDF</button>
      </div>
    </div>
    <p class="t-status" id="pe-info"></p>
    <div class="pe-pages" id="pe-pages" data-tool="select"></div>
    <input type="file" id="pe-img" accept="image/*" hidden>
  </div>
  <div class="pe-modal" id="pe-sig" hidden role="dialog" aria-label="Signature">
    <div class="pe-modal-card">
      <h2>Your signature</h2>
      <p class="muted">Draw with your mouse, finger or stylus, or type your name.</p>
      <canvas id="pe-sigpad" width="900" height="300"></canvas>
      <label class="t-field" style="margin-top:10px">Or type it <input class="t-input" id="pe-sigtext" placeholder="Your name"></label>
      <div class="t-actions"><button class="t-btn primary" id="pe-sig-use" type="button">Add signature</button><button class="t-btn" id="pe-sig-clear" type="button">Clear</button><button class="t-btn" id="pe-sig-cancel" type="button">Cancel</button></div>
    </div>
  </div>''',
  article='''<h2>What you can do</h2>
<ul><li><strong>Edit existing text:</strong> choose <em>Edit text</em> and every line of text on the page becomes clickable. Click a line, put the cursor where you want and type. WebcamClicks detects the original font style (sans-serif, serif or monospace, bold, italic), the size and the text and background colours, and when you save, the old words are removed from the page and the new ones written in their place, so copying and searching the PDF find your new wording.</li>
<li><strong>Fill in forms:</strong> choose <em>Text</em> and click where you want to type. Drag the box to line it up and set the size in points.</li>
<li><strong>Sign documents:</strong> <em>Sign</em> lets you draw your signature or type your name; place it, then drag the corner to resize.</li>
<li><strong>Highlight</strong> important passages and add <strong>boxes</strong> to draw attention.</li>
<li><strong>White-out</strong> covers text or images with a white box. Note: it hides content visually; for confidential redaction, also remove the hidden text (see below).</li>
<li><strong>Draw</strong> freehand notes, arrows and ticks.</li>
<li><strong>Insert images</strong> such as a logo, stamp or photo.</li>
<li><strong>Rotate or delete pages</strong> with the buttons above each page.</li></ul>
<p>Shortcuts: <kbd>Ctrl</kbd>+<kbd>Z</kbd> undo, <kbd>Delete</kbd> removes the selected item, <kbd>Esc</kbd> returns to Select.</p>
<h2>Quality and compatibility</h2>
<p>Your edits are written into the original PDF with pdf-lib, so the existing pages keep their original text, fonts and image quality. English and other Latin-alphabet text you add stays real, searchable PDF text; text in other scripts (Hindi, Nepali, Arabic, Chinese…) is embedded as a high-resolution image so it displays correctly everywhere without font files.</p>
<h2>Important: white-out is not redaction</h2>
<p>A white box covers what's underneath, but the original text is still inside the file and can be copied out. To truly remove sensitive text, white it out here, then use <a href="/pdf-to-jpg">PDF to JPG</a> and <a href="/jpg-to-pdf">JPG to PDF</a> to flatten the pages into images.</p>''' + PRIVACY,
  faqs=[('Is this PDF editor free?', 'Yes, with no watermark, page limit or account.'),
        ('Can I edit the existing text in a PDF?', 'Yes. Choose Edit text and click any line. The replacement uses a matching standard font (Helvetica, Times or Courier in the right weight), size and colour. The exact original typeface is only reused if it is a standard one, so a custom brand font will look slightly different. Scanned PDFs have no text to edit: run them through Image to text (OCR) first.'),
        ('Is the old text really removed?', 'In most PDFs, yes: the old words are taken out of the page, and the editor re-checks the saved file to make sure nothing else changed. If a page is built in an unusual way, the old text is covered with the exact background colour instead, which looks identical on screen and in print.'),
        ('Is it safe for contracts and IDs?', 'Yes. The file never leaves your device. Close the tab and nothing remains.'),
        ('Can I sign a PDF on my phone?', 'Yes. Tap Sign and draw with your finger, then place and resize the signature.'),
        ('Why can\'t I open my PDF?', 'Encrypted PDFs need to be unlocked first. Damaged files may also fail to open.')])

# ------------------------------------------------------------------------------------------- lock PDF
PAGES['lock-pdf'] = dict(
  name='Lock PDF', cat='pdf', script='pdf-lock.js', appcat='SecurityApplication',
  title='Lock PDF — Password Protect a PDF with AES-256, Free | WebcamClicks',
  desc='Add a password to any PDF with strong AES-256 encryption. Control printing, copying and editing. Free, private, encrypted on your device without uploading.',
  lead='Protect a PDF with a password before you email or share it. Encryption uses AES-256, the strongest PDF standard, and happens on your device, so the unprotected file never travels anywhere.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("application/pdf,.pdf", "Drop a PDF to protect", "Nothing is uploaded", multiple=False)}
      <p class="t-status" id="t-info"></p>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Password</h2>
      <label class="t-field">Password to open <input class="t-input" type="password" id="t-pw" autocomplete="new-password"></label>
      <div class="pw-meter" id="t-meter"></div>
      <label class="t-field">Repeat password <input class="t-input" type="password" id="t-pw2" autocomplete="new-password"></label>
      <label class="t-check"><input type="checkbox" id="t-show"> Show passwords</label>
      <h2 style="margin-top:14px">Permissions</h2>
      <label class="t-check"><input type="checkbox" id="t-print" checked> Allow printing</label>
      <label class="t-check"><input type="checkbox" id="t-copy"> Allow copying text</label>
      <label class="t-check"><input type="checkbox" id="t-edit"> Allow editing &amp; page changes</label>
      <label class="t-check"><input type="checkbox" id="t-annot" checked> Allow comments &amp; form filling</label>
      <label class="t-field">Owner password (optional) <input class="t-input" type="password" id="t-owner" autocomplete="new-password" placeholder="Lets you change permissions later"></label>
      <button class="t-btn primary" id="t-run" type="button" disabled style="width:100%">🔒 Protect PDF</button>
    </div>
  </div>''',
  article='''<h2>How to password-protect a PDF</h2>
<ol><li>Drop the PDF into the box.</li><li>Type a password twice. Use at least 10 characters; the meter shows how strong it is. Our <a href="/password-generator">password generator</a> can make one.</li>
<li>Choose what people who know the password may do: print, copy text, edit, comment or fill forms.</li>
<li>Press <strong>Protect PDF</strong>. The protected copy downloads; your original file is unchanged.</li></ol>
<h2>How secure is it?</h2>
<p>The PDF is encrypted with <strong>AES-256</strong> (PDF 2.0, revision 6), the same standard Adobe Acrobat uses for its highest security setting. Without the password, the content is unreadable. Security depends on the password: a long, unique password cannot realistically be guessed, while a short dictionary word can be cracked by offline tools.</p>
<p>Permissions (no printing, no copying) are honoured by Acrobat, browsers and most PDF readers, but they are a polite request rather than encryption: some software ignores them. The open password is the real protection.</p>
<p><strong>Keep your password safe.</strong> There is no "forgot password" for an encrypted PDF.</p>''' + PRIVACY,
  faqs=[('Which apps can open the protected PDF?', 'Any modern PDF reader: Adobe Acrobat, Chrome, Edge, Safari, Firefox, Preview on Mac, and phone PDF apps. Very old readers (before 2008) may not support AES-256.'),
        ('Can I remove the password later?', 'Open the PDF with the password in your PDF reader and print or save it without protection, or use a tool that removes passwords when you know the password.'),
        ('Is my PDF uploaded?', 'No. Encryption happens entirely in your browser.'),
        ('What is the owner password?', 'A second password for changing permissions in tools like Acrobat. If you leave it empty, a random one is created so the permissions can\'t be lifted.')])

# ------------------------------------------------------------------------------------------- OCR
PAGES['image-to-text'] = dict(
  name='Image to text (OCR)', cat='text', script='ocr.js', appcat='UtilitiesApplication',
  title='Image to Text (OCR) — Extract Text from Photos & PDFs Free | WebcamClicks',
  desc='Free OCR in 38 languages: extract text from photos, screenshots, scanned PDFs or your webcam. Copy, download TXT or a searchable PDF. Runs on your device, no upload.',
  lead='Copy text out of photos, screenshots, scanned documents and PDFs, or hold a page up to your webcam. OCR runs on your device in 38 languages, including Hindi, Nepali, Arabic, Chinese and Japanese.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("image/*,application/pdf,.pdf", "Drop an image or scanned PDF", "JPG, PNG, WebP, screenshot (Ctrl+V) or PDF · nothing is uploaded", multiple=False)}
      <div class="t-actions"><button class="t-btn sm" id="t-cam" type="button">📷 Use webcam</button></div>
      <div id="t-cambox" class="ocr-cam" hidden><video id="t-camvideo" playsinline muted></video><button class="t-btn primary" id="t-snap" type="button">Capture &amp; read</button></div>
      <img id="t-preview" class="ocr-preview" alt="Image being read" hidden>
      <p class="t-status" id="t-status" role="status"></p>
      <div class="sr-progress" id="t-bar" hidden><div id="t-fill"></div></div>
    </div>
    <div class="t-panel">
      <div class="t-row">
        <label class="t-field">Language <select class="t-select" id="t-lang"></select></label>
        <label class="t-field">Second language <select class="t-select" id="t-lang2"></select></label>
      </div>
      <label class="t-check"><input type="checkbox" id="t-cleanup" checked> Clean up image first (better for phone photos)</label>
      <label class="t-field">Recognised text <textarea class="t-textarea" id="t-text" rows="12" placeholder="Text will appear here. You can edit it."></textarea></label>
      <p class="muted" style="font-size:.8rem;margin:-6px 0 8px" id="t-conf"></p>
      <div class="t-actions"><button class="t-btn primary" id="t-copy" type="button" disabled>Copy text</button><button class="t-btn" id="t-txt" type="button" disabled>Download .txt</button><button class="t-btn" id="t-pdf" type="button" disabled>Searchable PDF</button></div>
    </div>
  </div>''',
  article='''<h2>How to extract text from an image</h2>
<ol><li>Drop an image, paste a screenshot with <kbd>Ctrl</kbd>+<kbd>V</kbd>, choose a scanned PDF, or use your webcam to snap a page.</li>
<li>Pick the language of the text. Add a second language for mixed documents, such as English and Hindi.</li>
<li>The text appears in the box. Fix any mistakes, then copy it, download it as TXT, or download a <strong>searchable PDF</strong>: your image with an invisible text layer, so you can search and select text in any PDF reader.</li></ol>
<h2>Getting the best results</h2>
<ul><li>Use a sharp, well-lit photo taken straight on. Shadows and steep angles cause most errors.</li>
<li>Keep "Clean up image" on for phone photos; it converts to high-contrast greyscale and enlarges small text.</li>
<li>Choose the correct language: it tells the engine which letters and words to expect.</li>
<li>Printed text works best. Neat handwriting sometimes works, messy handwriting usually doesn't.</li></ul>
<h2>Under the hood</h2>
<p>WebcamClicks uses Tesseract, the open-source OCR engine originally developed at HP and Google, compiled to WebAssembly so it runs in your browser. Each language's trained model (a few megabytes) downloads the first time you use it and is cached. Your images are processed locally, so it is safe for receipts, IDs, contracts and medical letters.</p>''' + PRIVACY,
  faqs=[('Is the OCR free?', 'Yes, with no limits and no sign-up.'),
        ('Which languages are supported?', '38 languages in the menu, including English, Spanish, French, German, Hindi, Nepali, Bengali, Tamil, Arabic, Russian, Chinese, Japanese and Korean.'),
        ('Can it read a multi-page scanned PDF?', 'Yes, up to 30 pages at a time. Each page is read in turn and you can download a searchable PDF.'),
        ('Are my images uploaded?', 'No. Recognition runs in your browser; only the language model is downloaded once.')])

# ------------------------------------------------------------------------------------------- metadata
PAGES['metadata-viewer'] = dict(
  name='Metadata viewer & remover', cat='file', script='metadata.js', appcat='UtilitiesApplication',
  title='Metadata Viewer & Remover — Photos, PDF, Word, Excel, Video | WebcamClicks',
  desc='See everything hidden in your files: GPS, camera, author, last editor, company, editing time, comments, AI markers, fonts, links. Photos, PDF, Word, Excel, video. Remove it free.',
  lead='See everything your files reveal about you: where a photo was taken and with which phone, who wrote and last edited a document, the company, total editing time, comment authors, hidden sheets, earlier versions, AI-generation markers and more. Then remove it with one click before you share.',
  ui=f'''<div class="t-grid">
    <div>
      {DROP("", "Drop any file", "Photos, PDF, Word, Excel, PowerPoint, OpenDocument, EPUB, ZIP, SVG, fonts, video, audio · nothing is uploaded", multiple=False)}
      <p class="t-status" id="t-summary"></p>
      <div class="md-out" id="t-out"></div>
      <p class="t-status" id="t-status" role="status"></p>
    </div>
    <div class="t-panel">
      <h2>Actions</h2>
      <div id="t-actions" hidden>
        <button class="t-btn primary" id="t-clean" type="button" style="width:100%">Remove metadata &amp; download</button>
        <div class="t-actions"><button class="t-btn sm" id="t-copy" type="button">Copy as text</button><button class="t-btn sm" id="t-json" type="button">Download JSON</button></div>
      </div>
      <p class="muted" style="font-size:.84rem;margin-top:12px">Fields highlighted in orange can reveal personal information: location, device serial numbers, names and software.</p>
    </div>
  </div>''',
  article='''<h2>What is metadata, and why remove it?</h2>
<p>Most files carry hidden information alongside their content. A photo from your phone usually records the <strong>exact GPS location</strong> where it was taken, the date and time, the phone model and sometimes its serial number. A PDF can contain the author's name, the company, the software and the editing history. Video files store the device, location and creation date. Posting such files online can reveal your home address, your daily routine or confidential details.</p>
<h2>What this tool reads</h2>
<p>Every file gets a <strong>real type check</strong> (from its contents, so a renamed file is caught) and <strong>SHA-256 and SHA-1 fingerprints</strong> to prove a file hasn't changed. Then, depending on the file:</p>
<ul><li><strong>Photos:</strong> EXIF (camera, lens, serial numbers, exposure, date), GPS with a map link, IPTC captions and credits, XMP editing history, maker notes, colour profiles, JPEG comments, PNG text chunks, the <em>embedded thumbnail</em> (which can show a photo before it was cropped) and <em>AI markers</em>: Content Credentials (C2PA), declared AI generation, and the prompt and settings that Stable Diffusion tools save inside images. Works with JPG, HEIC, PNG, WebP, TIFF and camera raw files.</li>
<li><strong>PDFs:</strong> every document property including custom ones, the full XMP record (editing history, document IDs), fonts, images, links, comments and their authors, form fields and values, attachments, layers, digital signatures, JavaScript, hidden editor data and how many times the file was saved (earlier versions can often be recovered).</li>
<li><strong>Word, Excel and PowerPoint:</strong> author, last editor, company, manager, template path, total editing time, revision count, last printed, custom properties, the names and accounts of everyone who commented or made tracked changes, deleted text still in the file, hidden sheets, hidden slides, speaker notes, external links and file paths, macros, embedded files and the preview thumbnail. Also OpenDocument (LibreOffice) and EPUB e-books.</li>
<li><strong>ZIP archives, SVG, HTML and fonts:</strong> file lists with dates, archive comments, editor data such as Inkscape file paths, generator comments, meta tags and font designer and licence details.</li>
<li><strong>Video and audio:</strong> container, duration, bitrate, codecs, resolution, frame rate, sample rate, language and tags such as title, artist, date and recording device.</li></ul>
<h2>How removal works</h2>
<ul><li><strong>Photos</strong> are re-saved from their pixels at high quality, which drops every metadata block while keeping the picture the right way up.</li>
<li><strong>PDFs</strong> have their document properties, XMP, editor data, comment authors and earlier saved versions removed; pages are untouched.</li>
<li><strong>Office and OpenDocument files</strong> lose their author, last editor, company, template, editing time, custom properties and comment author names; the content is unchanged.</li>
<li><strong>Videos and audio</strong> are copied into a new file without tags. The audio and video streams aren't re-encoded, so there is no quality loss.</li></ul>
<p>Social networks like Instagram and Facebook strip photo metadata on upload, but email, WhatsApp documents, cloud links, forums and your own website often don't. When in doubt, clean it here first.</p>''' + PRIVACY,
  faqs=[('Does removing metadata reduce photo quality?', 'Photos are re-saved at 95% quality, which is visually identical. PDFs and videos are not re-compressed at all.'),
        ('Can it show who edited a Word or Excel file?', 'Yes. It lists the author, the last person to save it, the company, the template, total editing time and everyone who left comments or tracked changes, often with their account e-mail. Removing metadata replaces those names with “Author”.'),
        ('Can it tell if an image was made by AI?', 'It shows the markers AI tools leave: Content Credentials (C2PA), the IPTC “AI-generated” source type, and the prompts and settings some generators save inside PNG files. Images without these markers may still be AI-generated, because the markers are easy to strip.'),
        ('Can it remove GPS from iPhone HEIC photos?', 'It can read HEIC everywhere. Removing metadata requires the browser to decode the image, which works in Safari; in other browsers, convert to JPG first with the image converter.'),
        ('Is my file uploaded?', 'No. Everything is read and cleaned in your browser.'),
        ('Why does my file have no metadata?', 'Screenshots, images saved from social networks and files already cleaned usually contain little or none, which is good for privacy.')])
