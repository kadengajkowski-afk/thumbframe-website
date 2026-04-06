import React, { useState, useEffect, useRef } from 'react';

const NAV_LINKS = [
  { label: 'Home',     page: 'home' },
  { label: 'Features', page: 'features' },
  { label: 'Gallery',  page: 'gallery' },
  { label: 'Pricing',  page: 'pricing' },
  { label: 'Blog',     page: 'blog' },
  { label: 'About',    page: 'about' },
  { label: 'Support',  page: 'support' },
];

const styles = `
  .tf-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 1000;
    transition: background 300ms ease, border-color 300ms ease, backdrop-filter 300ms ease;
    padding: 0 24px;
    transform: translateY(0);
    transition: background 300ms ease, border-color 300ms ease, transform 300ms ease;
  }
  .tf-nav.scrolled {
    background: rgba(10,10,10,0.95);
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
    border-bottom: 1px solid var(--border);
  }
  .tf-nav.hidden {
    transform: translateY(-100%);
  }
  .tf-nav-inner {
    max-width: 1200px;
    margin: 0 auto;
    height: 64px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
  }
  .tf-nav-logo {
    display: flex;
    align-items: center;
    gap: 9px;
    cursor: pointer;
    background: none;
    border: none;
    padding: 0;
    flex-shrink: 0;
    text-decoration: none;
  }
  .tf-nav-logo img {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    object-fit: cover;
    box-shadow: 0 0 20px rgba(255,107,0,0.2);
  }
  .tf-nav-logo-text {
    font-family: var(--font-display);
    font-weight: 700;
    font-size: 18px;
    color: var(--text-primary);
    letter-spacing: -0.3px;
  }
  .tf-nav-logo-text span {
    color: var(--accent);
  }
  .tf-nav-links {
    display: flex;
    align-items: center;
    gap: 2px;
  }
  .tf-nav-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 7px 12px;
    border-radius: 7px;
    font-family: var(--font-body);
    font-size: 15px;
    font-weight: 500;
    color: var(--text-secondary);
    transition: color var(--transition-base), background var(--transition-base);
    white-space: nowrap;
  }
  .tf-nav-link:hover {
    color: var(--text-primary);
    background: var(--bg-hover);
  }
  .tf-nav-link.active {
    color: var(--text-primary);
  }
  .tf-nav-cta {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-shrink: 0;
  }
  .tf-hamburger {
    display: none;
    background: none;
    border: none;
    cursor: pointer;
    font-size: 22px;
    color: var(--text-primary);
    padding: 4px 8px;
    border-radius: 6px;
    transition: background var(--transition-fast);
  }
  .tf-hamburger:hover { background: var(--bg-hover); }

  .tf-mobile-overlay {
    position: fixed;
    inset: 0;
    background: #0A0A0A;
    z-index: 999;
    display: flex;
    flex-direction: column;
    padding: 80px 32px 40px;
    transform: translateX(100%);
    transition: transform 300ms ease;
  }
  .tf-mobile-overlay.open {
    transform: translateX(0);
  }
  .tf-mobile-links {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .tf-mobile-link {
    background: none;
    border: none;
    cursor: pointer;
    padding: 14px 0;
    font-family: var(--font-display);
    font-size: 24px;
    font-weight: 600;
    color: var(--text-secondary);
    text-align: left;
    border-bottom: 1px solid var(--border);
    transition: color var(--transition-base);
  }
  .tf-mobile-link:hover { color: var(--text-primary); }
  .tf-mobile-cta {
    margin-top: 32px;
  }
  .tf-mobile-cta button {
    width: 100%;
    padding: 16px;
    border-radius: var(--radius-lg);
    border: none;
    background: var(--accent-gradient);
    color: #fff;
    font-family: var(--font-body);
    font-size: 16px;
    font-weight: 600;
    cursor: pointer;
    box-shadow: var(--shadow-accent);
  }

  @media (max-width: 768px) {
    .tf-nav-links { display: none; }
    .tf-nav-cta .btn { display: none; }
    .tf-hamburger { display: block; }
  }
`;

export default function Navbar({ setPage, currentPage }) {
  const [scrolled, setScrolled]   = useState(false);
  const [hidden, setHidden]       = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const prevScrollY = useRef(0);

  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      if (y > 100) {
        setHidden(y > prevScrollY.current);
      } else {
        setHidden(false);
      }
      prevScrollY.current = y;
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navigate = (page) => {
    setPage(page);
    setMobileOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <>
      <style>{styles}</style>

      <nav className={`tf-nav${scrolled ? ' scrolled' : ''}${hidden ? ' hidden' : ''}`}>
        <div className="tf-nav-inner">
          <button className="tf-nav-logo" onClick={() => navigate('home')}>
            <img src="/logo.jpg" alt="ThumbFrame logo" />
            <span className="tf-nav-logo-text">
              Thumb<span>Frame</span>
            </span>
          </button>

          <div className="tf-nav-links">
            {NAV_LINKS.map(({ label, page }) => (
              <button
                key={page}
                className={`tf-nav-link${currentPage === page ? ' active' : ''}`}
                onClick={() => navigate(page)}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="tf-nav-cta">
            <button
              className="btn btn-ghost"
              style={{ fontSize: 13 }}
              onClick={() => navigate('login')}
            >
              Log in
            </button>
            <button
              className="btn btn-primary"
              style={{ fontSize: 13 }}
              onClick={() => navigate('editor')}
            >
              Get Started Free
            </button>
          </div>

          <button
            className="tf-hamburger"
            onClick={() => setMobileOpen(v => !v)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div className={`tf-mobile-overlay${mobileOpen ? ' open' : ''}`}>
        <div className="tf-mobile-links">
          {NAV_LINKS.map(({ label, page }) => (
            <button
              key={page}
              className="tf-mobile-link"
              onClick={() => navigate(page)}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="tf-mobile-cta">
          <button onClick={() => navigate('editor')}>
            Get Started Free →
          </button>
        </div>
      </div>
    </>
  );
}
