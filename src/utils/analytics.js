const GA_ID = 'G-T7ZLMB1Q65';

export function trackEvent(eventName, params = {}) {
  if (window.gtag) {
    window.gtag('event', eventName, params);
  }
}

export function trackPageView(pagePath) {
  if (window.gtag) {
    window.gtag('config', GA_ID, { page_path: pagePath });
  }
}
