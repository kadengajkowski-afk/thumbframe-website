// Site-wide footer. Mounted on every page EXCEPT:
//   - /editor (needs full canvas real estate)
//   - / landing hero (fixed-viewport single-screen; non-scrolling)
//   - old-theme pages pending rework (/about, /blog, /support, /account, /examples, /howitworks)
//
// Transparent background so the page's scene shows through. Uses
// setPage(...) for routing to match the rest of the site.

import React from 'react';
import '@fontsource-variable/fraunces';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const FONT_UI  = "'Inter Variable', 'Inter', system-ui, sans-serif";

const CREAM    = '#faecd0';
const CREAM_40 = 'rgba(250,236,208,0.4)';
const CREAM_50 = 'rgba(250,236,208,0.5)';
const CREAM_60 = 'rgba(250,236,208,0.6)';
const CREAM_70 = 'rgba(250,236,208,0.7)';

const TOP_DIVIDER    = 'rgba(255,255,255,0.10)';
const COPY_DIVIDER   = 'rgba(255,255,255,0.05)';

const PRODUCT_LINKS = [
  { label: 'Features',   page: 'features'  },
  { label: 'Pricing',    page: 'pricing'   },
  { label: 'Changelog',  page: 'changelog' },
];

const LEGAL_LINKS = [
  { label: 'Terms',          page: 'terms'   },
  { label: 'Privacy',        page: 'privacy' },
  { label: 'Refund policy',  page: 'refund'  },
  { label: 'DMCA',           page: 'dmca'    },
  { label: 'Support',        page: 'support' },
];

// Styles live in a single <style> tag so media queries work without a
// dependency on the project's CSS pipeline.
const CSS = `
  .tf-footer {
    position: relative;
    z-index: 1;
    width: 100%;
    padding: 64px 32px 48px;
    font-family: ${FONT_UI};
    color: ${CREAM};
    border-top: 1px solid ${TOP_DIVIDER};
  }
  .tf-footer-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .tf-footer-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 48px;
    align-items: flex-start;
  }
  .tf-footer-col { min-width: 0; }
  .tf-footer-wordmark {
    font-family: ${FRAUNCES};
    font-size: 24px;
    font-weight: 500;
    letter-spacing: -0.01em;
    color: ${CREAM};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
  }
  .tf-footer-tagline {
    margin: 12px 0 0;
    font-size: 14px;
    color: ${CREAM_60};
    line-height: 1.5;
  }
  .tf-footer-heading {
    margin: 0 0 16px;
    font-family: ${FONT_UI};
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: ${CREAM_50};
  }
  .tf-footer-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .tf-footer-link {
    font-family: ${FONT_UI};
    font-size: 14px;
    color: ${CREAM_70};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: color 150ms ease;
  }
  .tf-footer-link:hover { color: ${CREAM}; }

  .tf-footer-copy {
    margin-top: 48px;
    padding-top: 24px;
    border-top: 1px solid ${COPY_DIVIDER};
    font-size: 12px;
    color: ${CREAM_40};
    text-align: left;
  }

  @media (max-width: 640px) {
    .tf-footer { padding: 56px 20px 40px; }
    .tf-footer-grid {
      grid-template-columns: 1fr;
      gap: 40px;
    }
    .tf-footer-copy { text-align: center; }
  }
`;

export default function Footer({ setPage, onNavigate }) {
  const go = (page) => {
    if (typeof onNavigate === 'function') return onNavigate(page);
    if (typeof setPage === 'function') return setPage(page);
  };

  return (
    <footer className="tf-footer" aria-label="Site footer">
      <style>{CSS}</style>
      <div className="tf-footer-inner">
        <div className="tf-footer-grid">
          {/* Brand */}
          <div className="tf-footer-col">
            <button
              type="button"
              className="tf-footer-wordmark"
              onClick={() => go('home')}
            >
              ThumbFrame
            </button>
            <p className="tf-footer-tagline">Thumbnails that ship.</p>
          </div>

          {/* Product */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-heading">Product</h3>
            <ul className="tf-footer-list">
              {PRODUCT_LINKS.map((l) => (
                <li key={l.page}>
                  <button
                    type="button"
                    className="tf-footer-link"
                    onClick={() => go(l.page)}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          {/* Legal */}
          <div className="tf-footer-col">
            <h3 className="tf-footer-heading">Legal</h3>
            <ul className="tf-footer-list">
              {LEGAL_LINKS.map((l) => (
                <li key={l.page}>
                  <button
                    type="button"
                    className="tf-footer-link"
                    onClick={() => go(l.page)}
                  >
                    {l.label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="tf-footer-copy">
          © 2026 ThumbFrame. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
