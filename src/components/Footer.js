import React from 'react';

const footerStyles = `
  .tf-footer {
    background: var(--bg-secondary);
    border-top: 1px solid var(--border);
    padding: 64px 24px 0;
    font-family: var(--font-body);
  }
  .tf-footer-inner {
    max-width: 1200px;
    margin: 0 auto;
  }
  .tf-footer-grid {
    display: grid;
    grid-template-columns: 2fr 1fr 1fr 1fr;
    gap: 48px;
  }
  .tf-footer-brand {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .tf-footer-logo {
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    width: fit-content;
  }
  .tf-footer-logo img {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    object-fit: cover;
  }
  .tf-footer-logo-text {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 17px;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }
  .tf-footer-logo-text span { color: var(--accent); }
  .tf-footer-tagline {
    font-size: 14px;
    color: var(--text-muted);
    line-height: 1.6;
    max-width: 280px;
  }
  .tf-footer-socials {
    display: flex;
    gap: 8px;
    margin-top: 4px;
  }
  .tf-footer-social {
    width: 36px;
    height: 36px;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: transparent;
    color: var(--text-muted);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 16px;
    transition: all var(--transition-base);
    text-decoration: none;
  }
  .tf-footer-social:hover {
    border-color: var(--border-hover);
    color: var(--accent);
    background: var(--accent-glow);
  }
  .tf-footer-col h4 {
    font-family: var(--font-display);
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    letter-spacing: 0.06em;
    text-transform: uppercase;
    margin-bottom: 16px;
  }
  .tf-footer-col ul {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tf-footer-col ul li button,
  .tf-footer-col ul li a {
    background: none;
    border: none;
    cursor: pointer;
    font-family: var(--font-body);
    font-size: 14px;
    color: var(--text-muted);
    padding: 0;
    text-align: left;
    text-decoration: none;
    transition: color var(--transition-base);
    display: inline-block;
  }
  .tf-footer-col ul li button:hover,
  .tf-footer-col ul li a:hover {
    color: var(--text-primary);
  }
  .tf-footer-bottom {
    margin-top: 48px;
    padding: 20px 0;
    border-top: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .tf-footer-bottom p {
    font-size: 13px;
    color: var(--text-muted);
  }

  @media (max-width: 900px) {
    .tf-footer-grid {
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }
    .tf-footer-brand {
      grid-column: 1 / -1;
    }
  }
  @media (max-width: 500px) {
    .tf-footer-grid {
      grid-template-columns: 1fr;
    }
    .tf-footer-brand { grid-column: auto; }
    .tf-footer-bottom {
      flex-direction: column;
      align-items: flex-start;
    }
  }
`;

export default function Footer({ setPage }) {
  const go = (page) => {
    setPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <style>{footerStyles}</style>
      <footer className="tf-footer">
        <div className="tf-footer-inner">
          <div className="tf-footer-grid">

            {/* Col 1 — Brand */}
            <div className="tf-footer-brand">
              <button className="tf-footer-logo" onClick={() => go('home')}>
                <img src="/logo.jpg" alt="ThumbFrame" />
                <span className="tf-footer-logo-text">
                  Thumb<span>Frame</span>
                </span>
              </button>
              <p className="tf-footer-tagline">
                The AI-powered thumbnail editor built by a creator, for creators.
              </p>
              <div className="tf-footer-socials">
                <a
                  href="https://twitter.com/thumbframe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-footer-social"
                  aria-label="Twitter / X"
                >
                  𝕏
                </a>
                <a
                  href="https://youtube.com/@thumbframe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-footer-social"
                  aria-label="YouTube"
                >
                  ▶
                </a>
                <a
                  href="https://discord.gg/thumbframe"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="tf-footer-social"
                  aria-label="Discord"
                >
                  ◈
                </a>
              </div>
            </div>

            {/* Col 2 — Product */}
            <div className="tf-footer-col">
              <h4>Product</h4>
              <ul>
                <li><button onClick={() => go('features')}>Features</button></li>
                <li><button onClick={() => go('pricing')}>Pricing</button></li>
                <li><button onClick={() => go('gallery')}>Gallery</button></li>
                <li><button onClick={() => go('editor')}>Templates</button></li>
                <li><button onClick={() => go('changelog')}>Changelog</button></li>
              </ul>
            </div>

            {/* Col 3 — Resources */}
            <div className="tf-footer-col">
              <h4>Resources</h4>
              <ul>
                <li><button onClick={() => go('blog')}>Blog</button></li>
                <li><button onClick={() => go('support')}>Support</button></li>
                <li><a href="mailto:hi@thumbframe.app">Contact</a></li>
                <li><a href="/docs">Documentation</a></li>
              </ul>
            </div>

            {/* Col 4 — Company */}
            <div className="tf-footer-col">
              <h4>Company</h4>
              <ul>
                <li><button onClick={() => go('about')}>About</button></li>
                <li><button onClick={() => go('privacy')}>Privacy Policy</button></li>
                <li><button onClick={() => go('terms')}>Terms of Service</button></li>
                <li><button onClick={() => go('refund')}>Refund Policy</button></li>
              </ul>
            </div>

          </div>

          <div className="tf-footer-bottom">
            <p>&copy; 2025 ThumbFrame. All rights reserved.</p>
            <p>Made with 🔥 for creators</p>
          </div>
        </div>
      </footer>
    </>
  );
}
