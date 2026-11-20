# WebcamClicks

Brand: clean light & bold. Ink `#0e0e12` on white, coral accent `#ff4d2e`, Inter. Tokens live at the top of `styles/main.css`; the "BRAND 2026 LAYER" at the end restyles shared components.

Free online webcam effects, filters, face-detection tools and camera games — all running
100% in the browser at **https://webcamclicks.com**.

## What's inside

| Area | Details |
|------|---------|
| Camera engine | `getUserMedia` + dual-canvas pipeline (work + display), mirror, flip camera, FPS monitor |
| Effects | 94 effects: Canvas 2D + WebGL filters in Styles, Trending, Scenes, Art and Distort, plus 27 face lenses |
| Face effects | 12+ effects powered by face-api.js (glasses, crown, dog ears, mustache, big eyes, blur background, emotion bubble, age/gender badge, face mesh, fire breath, confetti smile) |
| AI background | `js/segmentation/`: on-device MediaPipe selfie segmentation (models in `assets/models/mediapipe`), blur / studio / scenes / colour / your photo; runs before effects |
| Passport photo | `/passport-photo` (`js/passport.js`): background removal, head measurement, crop to 10 document specs at 300 DPI, compliance checks, 4x6 and A4 sheets |
| Webcam test | `/webcam-test`: measures real resolution, fps, exposure, clipping, contrast, sharpness and colour cast, then scores it out of 100 with fixes (`js/webcam-test.js`) |
| Games | Balloon Pop, Motion Catch, Face Pong, Freeze Pose — controlled by your face or motion |
| Photo tools | Capture, flash, gallery (localStorage), download PNG/JPEG, Web Share, clipboard copy |
| Monetization | Google AdSense auto-ads + 4 manual responsive slots (configured in `index.html`) |
| SEO | Pre-rendered content, FAQ schema, JSON-LD, sitemap.xml, robots.txt, Open Graph, canonical URLs, privacy & terms pages |

## Tools hub

`/tools` lists every tool by category. The new tool pages, the hub, the shared footer/nav and the
home-page "Free everyday tools" section are generated from one registry:

```bash
python3 scripts/build-tool-pages.py
```

Edit `TOOLS` / `PAGES` in that script, re-run it, and commit the regenerated HTML. Tool logic lives in
`js/tools/` (shared helpers in `common.js`) and styles in `styles/tools.css`. Libraries load on demand
from jsDelivr at pinned versions: jszip 3.10.1, pdf-lib 1.17.1, qrcode-generator 1.4.4.

## Run locally

Camera access requires `localhost` or HTTPS. ES modules require a server (not `file://`):

```bash
cd webcamclicks
python3 -m http.server 8080
# open http://localhost:8080
```

Any static server works (`npx serve`, `php -S`, VS Code Live Server, etc).

## Deploy

Static site — deploy the folder to any static host (Netlify, Vercel, Cloudflare Pages,
GitHub Pages, or classic shared hosting). No build step, no dependencies to install.

### Checklist before going live

1. **AdSense consent (required for EEA/UK/CH ads)**: in AdSense go to *Privacy & messaging →
   European regulations*, create and publish the Google consent message (a certified CMP using IAB
   TCF v2.2). `js/consent.js` already skips its own banner for European visitors and leaves consent
   to that message. Optionally also publish the *US state regulations* message.
   **Auto ads**: in *Ads → By site → Edit*, use *Page exclusions* or *Excluded areas* so ads are never
   placed inside the camera studio controls (`/`, `/pro-camera`, `/webcam-test`, `/mic-test`).
2. **Open Graph image**: `assets/img/og-image.png` is a generated placeholder — replace it
   with your own 1200x630 branding if you like (keep the same filename).
3. **Domain**: point `webcamclicks.com` DNS at your host (Netlify: add domain in dashboard
   and follow DNS instructions; Vercel: same pattern).
4. **HTTPS**: required for `getUserMedia`. All the hosts above provide free TLS.
5. **Search Console**: submit `https://webcamclicks.com/sitemap.xml`.

Netlify users: `netlify.toml` and `_headers` are included (security headers, cache policy).

## Browser support

Chrome, Edge, Firefox, Safari (desktop + mobile), Opera, Samsung Internet.
WebGL/face features degrade gracefully; motion games work even without face detection.
