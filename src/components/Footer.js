import React from 'react';

const S = `
  .tf-footer {
    background: #0c0c0f;
    border-top: 1px solid rgba(255,255,255,0.06);
    padding: 64px 24px 0;
    font-family: 'Satoshi', sans-serif;
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
    box-shadow: 0 0 12px rgba(255,107,0,0.25);
  }
  .tf-footer-logo-text {
    font-family: 'Satoshi', sans-serif;
    font-weight: 700;
    font-size: 17px;
    color: #f0f0f3;
    letter-spacing: -0.3px;
  }
  .tf-footer-tagline {
    font-size: 14px;
    color: #55555e;
    line-height: 1.65;
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
    border-radius: 8px;
    border: 1px solid rgba(255,255,255,0.07);
    background: transparent;
    color: #55555e;
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    font-size: 15px;
    transition: border-color 150ms ease, color 150ms ease;
    text-decoration: none;
  }
  .tf-footer-social:hover {
    border-color: rgba(255,107,0,0.35);
    color: #FF6B00;
  }
  .tf-footer-col h4 {
    font-family: 'Satoshi', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #f0f0f3;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    margin: 0 0 16px;
  }
  .tf-footer-col ul {
    list-style: none;
    padding: 0;
    margin: 0;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .tf-footer-col ul li button,
  .tf-footer-col ul li a {
    background: none;
    border: none;
    cursor: pointer;
    font-family: 'Satoshi', sans-serif;
    font-size: 14px;
    color: #55555e;
    padding: 0;
    text-align: left;
    text-decoration: none;
    transition: color 150ms ease;
    display: inline-block;
  }
  .tf-footer-col ul li button:hover,
  .tf-footer-col ul li a:hover {
    color: #f0f0f3;
  }
  .tf-footer-bottom {
    margin-top: 48px;
    padding: 20px 0;
    border-top: 1px solid rgba(255,255,255,0.05);
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .tf-footer-bottom p {
    font-size: 13px;
    color: #55555e;
    margin: 0;
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
      grid-template-columns: 1fr 1fr;
      gap: 32px;
    }
    .tf-footer-brand {
      grid-column: 1 / -1;
    }
    .tf-footer-bottom {
      flex-direction: column;
      align-items: flex-start;
      gap: 8px;
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
      <style>{S}</style>
      <footer className="tf-footer">
        <div className="tf-footer-inner">
          <div className="tf-footer-grid">

            {/* Col 1 — Brand */}
            <div className="tf-footer-brand">
              <button className="tf-footer-logo" onClick={() => go('home')}>
                <img src="/logo.jpg" alt="ThumbFrame" />
                <span className="tf-footer-logo-text">ThumbFrame</span>
              </button>
              <p className="tf-footer-tagline">
                The AI-powered thumbnail editor built by a creator, for creators.
              </p>
              <div className="tf-footer-socials">
                <a href="https://twitter.com/thumbframe" target="_blank" rel="noopener noreferrer" className="tf-footer-social" aria-label="Twitter / X">𝕏</a>
                <a href="https://youtube.com/@thumbframe" target="_blank" rel="noopener noreferrer" className="tf-footer-social" aria-label="YouTube">▶</a>
                <a href="https://discord.gg/thumbframe" target="_blank" rel="noopener noreferrer" className="tf-footer-social" aria-label="Discord">◈</a>
              </div>
            </div>

            {/* Col 2 — Product */}
            <div className="tf-footer-col">
              <h4>Product</h4>
              <ul>
                <li><button onClick={() => go('features')}>Features</button></li>
                <li><button onClick={() => go('pricing')}>Pricing</button></li>
                <li><button onClick={() => go('gallery')}>Gallery</button></li>
                <li><button onClick={() => go('editor')}>Editor</button></li>
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
            <p>Built for creators who give a damn.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
