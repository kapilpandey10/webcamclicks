/* WebcamClicks — site navigation: Tools mega menu, instant tool search (Ctrl/⌘+K or "/"), mobile drawer.
   The tool list comes from the mega menu's links, so there is one source of truth in the HTML. */
(() => {
  if (window.__wcNav) return; window.__wcNav = true;
  const header = document.querySelector('.site-header');
  const trigger = document.querySelector('.nav-trigger');
  const mega = document.getElementById('mega-tools');
  if (!header || !trigger || !mega) return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tools = [...mega.querySelectorAll('.mega-col li a')].map((a) => ({ href: a.getAttribute('href'), name: a.querySelector('span').textContent, desc: a.dataset.desc || '', cat: a.dataset.cat || '', icon: a.querySelector('svg') ? a.querySelector('svg').outerHTML : '', isNew: !!a.querySelector('i') }));

  /* ------------------------------------------------------------ mega menu (desktop) */
  let hoverT = 0;
  const openMega = (v) => { mega.hidden = !v; trigger.setAttribute('aria-expanded', String(v)); header.classList.toggle('mega-open', v); };
  trigger.addEventListener('click', () => openMega(mega.hidden));
  const item = trigger.parentElement;
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
  item.addEventListener('mouseenter', () => { if (!fine.matches) return; clearTimeout(hoverT); hoverT = setTimeout(() => openMega(true), 120); });
  item.addEventListener('mouseleave', () => { if (!fine.matches) return; clearTimeout(hoverT); hoverT = setTimeout(() => openMega(false), 220); });
  document.addEventListener('click', (e) => { if (!mega.hidden && !item.contains(e.target)) openMega(false); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !mega.hidden) { openMega(false); trigger.focus(); } });

  /* ------------------------------------------------------------ search (command palette) */
  const SYN = { mp3: 'audio music extract sound', jpg: 'jpeg image photo', pdf: 'document', heic: 'iphone apple', compress: 'reduce shrink smaller size', resize: 'scale dimensions', record: 'capture', subtitle: 'caption srt vtt', caption: 'subtitle srt', background: 'remove cutout transparent', qr: 'barcode scan', ocr: 'text extract read scan', merge: 'combine join', split: 'separate extract pages', sign: 'signature', password: 'lock protect encrypt', metadata: 'exif gps privacy', upscale: 'enlarge enhance resolution super', thumbnail: 'youtube cover', voice: 'audio microphone podcast', silence: 'pause jump cut', reframe: 'vertical tiktok reels shorts 9:16', redact: 'black out hide censor', scanner: 'scan camera document', teleprompter: 'script autocue', gif: 'animation', trim: 'cut', convert: 'change format' };
  const hay = (t) => `${t.name} ${t.desc} ${t.cat} ${Object.entries(SYN).filter(([k]) => `${t.name} ${t.desc}`.toLowerCase().includes(k)).map(([, v]) => v).join(' ')}`.toLowerCase();
  tools.forEach((t) => { t.hay = hay(t); });
  function search(q) {
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return tools.filter((t) => t.isNew).slice(0, 8).concat(tools.filter((t) => !t.isNew).slice(0, 4));
    const score = (t, all) => {
      let s = 0;
      for (const w of words) { const n = t.name.toLowerCase(); if (n.startsWith(w)) s += 6; else if (n.includes(w)) s += 4; else if (t.hay.includes(w)) s += 1; else if (all) return null; }
      return s ? [s, t] : null;
    };
    let r = tools.map((t) => score(t, true)).filter(Boolean);
    if (!r.length) r = tools.map((t) => score(t, false)).filter(Boolean);   // nothing matches every word: show the closest tools
    return r.sort((a, b) => b[0] - a[0]).map((x) => x[1]).slice(0, 12);
  }
  const pal = document.createElement('div');
  pal.className = 'nav-palette'; pal.hidden = true; pal.setAttribute('role', 'dialog'); pal.setAttribute('aria-modal', 'true'); pal.setAttribute('aria-label', 'Search tools');
  pal.innerHTML = `<div class="nav-palette-card"><div class="nav-palette-in"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input type="search" placeholder="Search ${tools.length} tools: pdf, mp3, compress…" aria-label="Search tools" autocomplete="off" spellcheck="false"><button type="button" class="nav-palette-x" aria-label="Close search">✕</button></div><ul class="nav-palette-list" role="listbox"></ul><p class="nav-palette-foot"><span>↑↓ to move · Enter to open</span><a href="/tools">All tools →</a></p></div>`;
  document.body.appendChild(pal);
  const pin = pal.querySelector('input'), plist = pal.querySelector('ul');
  let sel = 0, results = [];
  function renderResults() {
    results = search(pin.value); sel = Math.min(sel, Math.max(0, results.length - 1));
    plist.innerHTML = results.length ? results.map((t, i) => `<li role="option" aria-selected="${i === sel}"><a href="${esc(t.href)}">${t.icon}<span><b>${esc(t.name)}</b><small>${esc(t.desc)}</small></span><em>${esc(t.cat)}</em></a></li>`).join('')
      : `<li class="nav-palette-empty">No tool matches “${esc(pin.value)}”. <a href="/tools">Browse all tools</a></li>`;
  }
  function openPal() { closeDrawer(); openMega(false); pal.hidden = false; document.documentElement.classList.add('nav-lock'); pin.value = ''; sel = 0; renderResults(); setTimeout(() => pin.focus(), 0); }
  function closePal() { pal.hidden = true; document.documentElement.classList.remove('nav-lock'); }
  pin.addEventListener('input', () => { sel = 0; renderResults(); });
  pin.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); renderResults(); plist.children[sel]?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'ArrowUp') { e.preventDefault(); sel = Math.max(0, sel - 1); renderResults(); plist.children[sel]?.scrollIntoView({ block: 'nearest' }); }
    if (e.key === 'Enter' && results[sel]) { e.preventDefault(); location.href = results[sel].href; }
  });
  pal.addEventListener('click', (e) => { if (e.target === pal || e.target.closest('.nav-palette-x')) closePal(); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !pal.hidden) closePal();
    const typing = /INPUT|TEXTAREA|SELECT/.test(e.target.tagName) || e.target.isContentEditable;
    if (((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing)) { e.preventDefault(); pal.hidden ? openPal() : closePal(); }
  });
  document.querySelectorAll('[data-open-search]').forEach((b) => b.addEventListener('click', openPal));

  /* ------------------------------------------------------------ mobile drawer */
  const burger = document.querySelector('.nav-burger');
  const drawer = document.createElement('div');
  drawer.className = 'nav-drawer'; drawer.hidden = true; drawer.id = 'nav-drawer';
  const main = [...document.querySelectorAll('.site-nav > a')].map((a) => `<a class="nav-drawer-main" href="${esc(a.getAttribute('href'))}">${esc(a.textContent)}</a>`).join('');
  const cats = [...mega.querySelectorAll('.mega-col')].map((c, i) => `<details${i === 0 ? ' open' : ''}><summary>${esc(c.querySelector('h3').textContent)}<span>${c.querySelectorAll('li').length}</span></summary><ul>${[...c.querySelectorAll('li a')].map((a) => `<li><a href="${esc(a.getAttribute('href'))}">${a.querySelector('svg') ? a.querySelector('svg').outerHTML : ''}<span>${esc(a.querySelector('span').textContent)}</span>${a.querySelector('i') ? '<i>New</i>' : ''}</a></li>`).join('')}</ul></details>`).join('');
  drawer.innerHTML = `<div class="nav-drawer-panel" role="dialog" aria-modal="true" aria-label="Menu"><div class="nav-drawer-top"><button type="button" class="nav-drawer-search" data-open-search>${pal.querySelector('svg').outerHTML}<span>Search ${tools.length} tools</span></button><button type="button" class="nav-drawer-x" aria-label="Close menu">✕</button></div>
    <a class="nav-drawer-cta" href="/#camera">📷 Open camera</a><div class="nav-drawer-links">${main}</div><div class="nav-drawer-cats">${cats}</div><a class="nav-drawer-all" href="/tools">All tools on one page →</a></div>`;
  document.body.appendChild(drawer);
  drawer.querySelector('[data-open-search]').addEventListener('click', openPal);
  function openDrawer() { drawer.hidden = false; requestAnimationFrame(() => drawer.classList.add('open')); burger && burger.setAttribute('aria-expanded', 'true'); document.documentElement.classList.add('nav-lock'); }
  function closeDrawer() { if (drawer.hidden) return; drawer.classList.remove('open'); burger && burger.setAttribute('aria-expanded', 'false'); document.documentElement.classList.remove('nav-lock'); setTimeout(() => { drawer.hidden = true; }, 220); }
  if (burger) burger.addEventListener('click', () => (drawer.hidden ? openDrawer() : closeDrawer()));
  drawer.addEventListener('click', (e) => { if (e.target === drawer || e.target.closest('.nav-drawer-x')) closeDrawer(); else if (e.target.closest('a[href^="#"], a[href^="/#"]')) closeDrawer(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeDrawer(); });
  // the bottom bar's "Tools" opens the drawer instead of leaving the page (it's faster on a phone)
  window.__wcNav = { openPal, openDrawer };
})();
