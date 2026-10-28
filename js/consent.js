/**
 * WebcamClicks — Cookie Consent Banner & Google Consent Mode v2 Manager
 * Compliant with GDPR, ePrivacy Directive, CCPA/CPRA, and Google AdSense CMP policies.
 */
(function() {
  const CONSENT_KEY = 'wc_cookie_consent_v2';

  // Helper to push consent updates to Google Tag Manager / gtag
  function updateGoogleConsent(granted) {
    if (typeof window.gtag === 'function') {
      const state = granted ? 'granted' : 'denied';
      window.gtag('consent', 'update', {
        'ad_storage': state,
        'ad_user_data': state,
        'ad_personalization': state,
        'analytics_storage': state
      });
    }
  }

  // Check saved state
  const savedConsent = localStorage.getItem(CONSENT_KEY);
  if (savedConsent) {
    updateGoogleConsent(savedConsent === 'granted');
    return;
  }

  // If no consent recorded yet, show the modern banner on DOMContentLoaded
  function initConsentBanner() {
    if (document.getElementById('wc-cookie-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'wc-cookie-banner';
    banner.className = 'wc-cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', 'Cookie and privacy choices');

    banner.innerHTML = `
      <div class="wc-cookie-container">
        <div class="wc-cookie-content">
          <div class="wc-cookie-icon">🍪</div>
          <div class="wc-cookie-text">
            <strong>Your Privacy Choices:</strong> We use cookies and similar technologies for analytics, performance, and Google advertising. Your webcam feed and captured photos are processed <strong>100% locally on your device</strong> and are never transmitted to our servers. Learn more in our <a href="/privacy" target="_blank" rel="noopener">Privacy Policy</a>.
          </div>
        </div>
        <div class="wc-cookie-actions">
          <button type="button" class="wc-cookie-btn wc-btn-reject" id="wc-cookie-reject">Essential Only</button>
          <button type="button" class="wc-cookie-btn wc-btn-accept" id="wc-cookie-accept">Accept All</button>
        </div>
      </div>
    `;

    document.body.appendChild(banner);

    // Fade in
    requestAnimationFrame(() => {
      banner.classList.add('visible');
    });

    const acceptBtn = document.getElementById('wc-cookie-accept');
    const rejectBtn = document.getElementById('wc-cookie-reject');

    function closeBanner(granted) {
      localStorage.setItem(CONSENT_KEY, granted ? 'granted' : 'denied');
      updateGoogleConsent(granted);
      banner.classList.remove('visible');
      setTimeout(() => banner.remove(), 350);
    }

    if (acceptBtn) {
      acceptBtn.addEventListener('click', () => closeBanner(true));
    }
    if (rejectBtn) {
      rejectBtn.addEventListener('click', () => closeBanner(false));
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initConsentBanner);
  } else {
    initConsentBanner();
  }
})();
