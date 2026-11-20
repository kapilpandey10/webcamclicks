/**
 * WebcamClicks — Consent manager (Google Consent Mode v2).
 *
 * How consent works on this site:
 *  - EEA / UK / Switzerland: consent is collected by Google's certified CMP
 *    (AdSense → Privacy & messaging → "European regulations" message, IAB TCF v2.2).
 *    Google requires a certified CMP in these regions, so this script does NOT show
 *    its own banner there — it would conflict with the TCF signal.
 *  - Everywhere else: a lightweight first-party banner lets visitors opt out of
 *    analytics/ad cookies (US state privacy laws, general good practice).
 *  - Any element with [data-privacy-choices] re-opens the right consent UI.
 */
(function () {
  'use strict';

  var CONSENT_KEY = 'wc_cookie_consent_v2';

  /* ---------- storage (private mode / blocked storage safe) ---------- */
  function readChoice() {
    try { return localStorage.getItem(CONSENT_KEY); } catch (_) { return null; }
  }
  function saveChoice(value) {
    try { localStorage.setItem(CONSENT_KEY, value); } catch (_) { /* ignore */ }
  }

  /* ---------- Google Consent Mode update ---------- */
  function updateGoogleConsent(granted) {
    if (typeof window.gtag !== 'function') return;
    var state = granted ? 'granted' : 'denied';
    window.gtag('consent', 'update', {
      ad_storage: state,
      ad_user_data: state,
      ad_personalization: state,
      analytics_storage: state
    });
  }

  /* ---------- Region detection ----------
     Best-effort: a TCF CMP on the page is authoritative; otherwise use the
     visitor's time zone. Google's own CMP decides per-IP server-side, so a
     wrong guess here only affects whether the fallback banner appears. */
  var TCF_ZONES = /^(Europe\/|Atlantic\/(Reykjavik|Canary|Madeira|Azores|Faroe)|Arctic\/Longyearbyen)/;
  function inTcfRegion() {
    if (typeof window.__tcfapi === 'function') return true;
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      // Europe/* also covers Russia, Turkey, Ukraine etc. — showing Google's
      // message (or nothing) there is harmless.
      return TCF_ZONES.test(tz);
    } catch (_) {
      return false;
    }
  }

  function openGoogleCmp() {
    // Re-open Google's certified consent dialog (Funding Choices API).
    window.googlefc = window.googlefc || {};
    window.googlefc.callbackQueue = window.googlefc.callbackQueue || [];
    window.googlefc.callbackQueue.push(function () {
      if (typeof window.googlefc.showRevocationMessage === 'function') {
        window.googlefc.showRevocationMessage();
      }
    });
    return typeof window.googlefc.showRevocationMessage === 'function';
  }

  /* ---------- First-party banner (non-EEA) ---------- */
  function showBanner() {
    if (document.getElementById('wc-cookie-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'wc-cookie-banner';
    banner.className = 'wc-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and privacy choices');
    banner.innerHTML =
      '<div class="wc-cookie-container">' +
        '<div class="wc-cookie-content">' +
          '<div class="wc-cookie-icon" aria-hidden="true">🍪</div>' +
          '<div class="wc-cookie-text">' +
            '<strong>Your privacy choices:</strong> We use cookies for analytics and Google ads. ' +
            'Your camera feed and photos are processed <strong>only on your device</strong> and are never uploaded. ' +
            'See our <a href="/privacy">Privacy Policy</a>.' +
          '</div>' +
        '</div>' +
        '<div class="wc-cookie-actions">' +
          '<button type="button" class="wc-cookie-btn wc-btn-reject" id="wc-cookie-reject">Essential only</button>' +
          '<button type="button" class="wc-cookie-btn wc-btn-accept" id="wc-cookie-accept">Accept all</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(banner);
    requestAnimationFrame(function () { banner.classList.add('visible'); });

    function close(granted) {
      saveChoice(granted ? 'granted' : 'denied');
      updateGoogleConsent(granted);
      banner.classList.remove('visible');
      setTimeout(function () { banner.remove(); }, 350);
    }
    banner.querySelector('#wc-cookie-accept').addEventListener('click', function () { close(true); });
    banner.querySelector('#wc-cookie-reject').addEventListener('click', function () { close(false); });
  }

  /* ---------- "Privacy choices" links ---------- */
  function bindChoiceLinks() {
    document.addEventListener('click', function (e) {
      var link = e.target.closest && e.target.closest('[data-privacy-choices]');
      if (!link) return;
      e.preventDefault();
      if (inTcfRegion()) {
        if (!openGoogleCmp()) window.location.href = '/privacy';
      } else {
        showBanner();
      }
    });
  }

  function init() {
    bindChoiceLinks();
    if (inTcfRegion()) return;          // Google's certified CMP handles consent
    var saved = readChoice();
    if (saved) return;                  // choice already applied in <head>
    showBanner();
  }

  // Apply a saved first-party choice as early as possible (outside TCF regions).
  var early = readChoice();
  if (early && !inTcfRegion()) updateGoogleConsent(early === 'granted');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
