# WebcamClicks

Free online webcam effects, filters, face-detection tools and camera games — all running
100% in the browser at **https://webcamclicks.com**.

## What's inside

| Area | Details |
|------|---------|
| Camera engine | `getUserMedia` + dual-canvas pipeline (work + display), mirror, flip camera, FPS monitor |
| Effects | 45+ Canvas 2D filters (Classic, Vintage, Art, Fun, Mirror categories) |
| Face effects | 12+ effects powered by face-api.js (glasses, crown, dog ears, mustache, big eyes, blur background, emotion bubble, age/gender badge, face mesh, fire breath, confetti smile) |
| Games | Motion Catch, Face Pong, Freeze Pose — controlled by your face or motion |
| Photo tools | Capture, flash, gallery (localStorage), download PNG/JPEG, Web Share, clipboard copy |
| Monetization | Google AdSense auto-ads + 4 manual responsive slots (configured in `index.html`) |
| SEO | Pre-rendered content, FAQ schema, JSON-LD, sitemap.xml, robots.txt, Open Graph, canonical URLs, privacy & terms pages |

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

1. **AdSense**: replace every `ca-pub-XXXXXXXXXXXXXXXX` and `data-ad-slot="XXXXXXXXXX"`
   placeholder in `index.html`, `ads.txt`, and `privacy.html` / `terms.html` with your real
   AdSense publisher ID and ad unit slot IDs.
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
