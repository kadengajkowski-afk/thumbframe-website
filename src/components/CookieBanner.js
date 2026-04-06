import { useState, useEffect } from 'react';

const GA_ID = 'G-T7ZLMB1Q65';
const STORAGE_KEY = 'tf_cookie_consent';

export default function CookieBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      // Slight delay so it doesn't flash on first paint
      const t = setTimeout(() => setVisible(true), 1200);
      return () => clearTimeout(t);
    }
    if (saved === 'declined') {
      window[`ga-disable-${GA_ID}`] = true;
    }
  }, []);

  function accept() {
    localStorage.setItem(STORAGE_KEY, 'accepted');
    setVisible(false);
  }

  function decline() {
    localStorage.setItem(STORAGE_KEY, 'declined');
    window[`ga-disable-${GA_ID}`] = true;
    setVisible(false);
  }

  if (!visible) return null;

  return (
    <>
      <style>{`
        .tf-cookie-banner {
          position: fixed;
          bottom: 0;
          left: 0;
          right: 0;
          z-index: 9999;
          background: #141414;
          border-top: 1px solid #202020;
          padding: 14px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          animation: tf-cookie-slide-up 0.3s ease;
        }
        @keyframes tf-cookie-slide-up {
          from { transform: translateY(100%); opacity: 0; }
          to   { transform: translateY(0);    opacity: 1; }
        }
        .tf-cookie-text {
          flex: 1;
          min-width: 200px;
          font-size: 13px;
          color: #a1a1aa;
          line-height: 1.5;
        }
        .tf-cookie-text a {
          color: #f97316;
          text-decoration: none;
        }
        .tf-cookie-text a:hover { text-decoration: underline; }
        .tf-cookie-actions {
          display: flex;
          gap: 8px;
          flex-shrink: 0;
        }
        .tf-cookie-btn {
          padding: 8px 18px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 600;
          cursor: pointer;
          border: none;
          transition: opacity 0.15s;
          min-height: 36px;
        }
        .tf-cookie-btn:hover { opacity: 0.85; }
        .tf-cookie-accept {
          background: #f97316;
          color: #fff;
        }
        .tf-cookie-decline {
          background: transparent;
          border: 1px solid #2d2d2d !important;
          color: #a1a1aa;
        }
        @media (max-width: 500px) {
          .tf-cookie-banner { padding: 12px 16px; gap: 12px; }
          .tf-cookie-btn { padding: 8px 14px; }
        }
      `}</style>
      <div className="tf-cookie-banner" role="region" aria-label="Cookie consent">
        <p className="tf-cookie-text">
          We use cookies to improve your experience and analyze site traffic.{' '}
          <a href="/privacy" onClick={(e) => { e.preventDefault(); window.location.href = '/privacy'; }}>
            Learn more
          </a>
        </p>
        <div className="tf-cookie-actions">
          <button className="tf-cookie-btn tf-cookie-decline" onClick={decline}>Decline</button>
          <button className="tf-cookie-btn tf-cookie-accept" onClick={accept}>Accept</button>
        </div>
      </div>
    </>
  );
}
