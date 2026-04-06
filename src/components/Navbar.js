import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';

const NAV_LINKS = [
  { label: 'Features', page: 'features' },
  { label: 'Gallery',  page: 'gallery'  },
  { label: 'Pricing',  page: 'pricing'  },
  { label: 'About',    page: 'about'    },
];

const S = `
  .tf-nav {
    position: fixed;
    top: 0; left: 0; right: 0;
    z-index: 1000;
    padding: 0 24px;
    background: rgba(5,5,7,0.6);
    backdrop-filter: blur(24px);
    -webkit-backdrop-filter: blur(24px);
    border-bottom: 1px solid rgba(255,255,255,0.05);
    transition: background 300ms ease, transform 300ms ease;
  }
  .tf-nav.scrolled {
    background: rgba(5,5,7,0.85);
  }
  .tf-nav.hidden { transform: translateY(-100%); }
  .tf-nav-inner {
    max-width: 1200px; margin: 0 auto;
    height: 60px; display: flex; align-items: center;
    justify-content: space-between; gap: 16px;
  }
  .tf-nav-logo {
    display: flex; align-items: center; gap: 9px;
    cursor: pointer; background: none; border: none;
    padding: 0; flex-shrink: 0;
  }
  .tf-nav-logo img {
    width: 28px; height: 28px; border-radius: 6px;
    object-fit: cover; box-shadow: 0 0 16px rgba(255,107,0,0.3);
  }
  .tf-nav-logo-text {
    font-family: 'Satoshi', sans-serif;
    font-weight: 700; font-size: 17px;
    color: #f0f0f3; letter-spacing: -0.3px;
  }
  .tf-nav-links {
    display: flex; align-items: center; gap: 2px;
  }
  .tf-nav-link {
    background: none; border: none; cursor: pointer;
    padding: 6px 12px; border-radius: 7px;
    font-family: 'Satoshi', sans-serif;
    font-size: 14px; font-weight: 500;
    color: #8a8a93;
    transition: color 150ms ease, background 150ms ease;
    white-space: nowrap;
  }
  .tf-nav-link:hover { color: #f0f0f3; background: rgba(255,255,255,0.05); }
  .tf-nav-link.active { color: #f0f0f3; }
  .tf-nav-cta {
    display: flex; align-items: center; gap: 8px; flex-shrink: 0;
  }
  .tf-nav-btn-ghost {
    background: none; border: none; cursor: pointer;
    padding: 6px 14px; border-radius: 7px;
    font-family: 'Satoshi', sans-serif;
    font-size: 14px; font-weight: 500; color: #8a8a93;
    transition: color 150ms;
  }
  .tf-nav-btn-ghost:hover { color: #f0f0f3; }
  .tf-nav-btn-primary {
    border: none; cursor: pointer;
    padding: 7px 16px; border-radius: 8px;
    background: #FF6B00; color: #fff;
    font-family: 'Satoshi', sans-serif;
    font-size: 14px; font-weight: 700;
    box-shadow: 0 0 20px rgba(255,107,0,0.25);
    transition: background 150ms, box-shadow 150ms;
    white-space: nowrap;
  }
  .tf-nav-btn-primary:hover {
    background: #FF8533;
    box-shadow: 0 0 30px rgba(255,107,0,0.35);
  }

  /* Avatar + dropdown */
  .tf-nav-avatar-wrap { position: relative; }
  .tf-nav-avatar {
    width: 32px; height: 32px; border-radius: 50%;
    background: rgba(255,107,0,0.15);
    border: 1.5px solid rgba(255,107,0,0.35);
    display: flex; align-items: center; justify-content: center;
    cursor: pointer; font-size: 13px; font-weight: 700;
    color: #FF6B00; font-family: 'Satoshi', sans-serif;
    transition: border-color 150ms;
  }
  .tf-nav-avatar:hover { border-color: rgba(255,107,0,0.7); }
  .tf-nav-dropdown {
    position: absolute; top: calc(100% + 10px); right: 0;
    min-width: 160px;
    background: #0c0c0f;
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 10px;
    box-shadow: 0 8px 30px rgba(0,0,0,0.5);
    overflow: hidden;
    animation: tf-dd-in 150ms ease;
  }
  @keyframes tf-dd-in {
    from { opacity: 0; transform: translateY(-6px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  .tf-nav-dd-item {
    width: 100%; background: none; border: none;
    padding: 10px 16px; text-align: left; cursor: pointer;
    font-family: 'Satoshi', sans-serif;
    font-size: 14px; color: #8a8a93;
    transition: background 100ms, color 100ms; display: block;
  }
  .tf-nav-dd-item:hover { background: rgba(255,255,255,0.05); color: #f0f0f3; }
  .tf-nav-dd-item.danger { color: #f87171; }
  .tf-nav-dd-item.danger:hover { background: rgba(239,68,68,0.06); }
  .tf-nav-dd-sep {
    height: 1px; background: rgba(255,255,255,0.06); margin: 4px 0;
  }

  /* Hamburger */
  .tf-hamburger {
    display: none; background: none; border: none; cursor: pointer;
    font-size: 22px; color: #f0f0f3;
    padding: 4px 8px; border-radius: 6px;
  }

  /* Mobile overlay */
  .tf-mobile-overlay {
    position: fixed; inset: 0; background: #050507;
    z-index: 999; display: flex; flex-direction: column;
    padding: 80px 32px 40px;
    transform: translateX(100%); transition: transform 300ms ease;
  }
  .tf-mobile-overlay.open { transform: translateX(0); }
  .tf-mobile-links { display: flex; flex-direction: column; gap: 4px; flex: 1; }
  .tf-mobile-link {
    background: none; border: none; cursor: pointer;
    padding: 14px 0; font-family: 'Satoshi', sans-serif;
    font-size: 22px; font-weight: 700; color: #8a8a93;
    text-align: left; border-bottom: 1px solid rgba(255,255,255,0.06);
    transition: color 150ms;
  }
  .tf-mobile-link:hover { color: #f0f0f3; }
  .tf-mobile-cta { margin-top: 32px; }
  .tf-mobile-cta button {
    width: 100%; padding: 15px; border-radius: 10px; border: none;
    background: #FF6B00; color: #fff;
    font-family: 'Satoshi', sans-serif;
    font-size: 15px; font-weight: 700; cursor: pointer;
    box-shadow: 0 0 30px rgba(255,107,0,0.25);
  }

  @media (max-width: 768px) {
    .tf-nav-links { display: none; }
    .tf-nav-cta .tf-nav-btn-ghost,
    .tf-nav-cta .tf-nav-btn-primary,
    .tf-nav-avatar-wrap { display: none; }
    .tf-hamburger { display: block; }
  }
`;

export default function Navbar({ setPage, currentPage }) {
  const [scrolled,    setScrolled]    = useState(false);
  const [hidden,      setHidden]      = useState(false);
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [dropOpen,    setDropOpen]    = useState(false);
  const prevScrollY   = useRef(0);
  const dropRef       = useRef(null);

  const { user, logout } = useAuth();

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      setHidden(y > 100 && y > prevScrollY.current);
      prevScrollY.current = y;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    if (!dropOpen) return;
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setDropOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [dropOpen]);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const navigate = (page) => {
    setPage(page);
    setMobileOpen(false);
    setDropOpen(false);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const initial = user?.name?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || '?';

  return (
    <>
      <style>{S}</style>
      <nav className={`tf-nav${scrolled ? ' scrolled' : ''}${hidden ? ' hidden' : ''}`}>
        <div className="tf-nav-inner">

          {/* Logo */}
          <button className="tf-nav-logo" onClick={() => navigate('home')}>
            <img src="/logo.jpg" alt="ThumbFrame" />
            <span className="tf-nav-logo-text">ThumbFrame</span>
          </button>

          {/* Links */}
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

          {/* CTA */}
          <div className="tf-nav-cta">
            {user ? (
              <>
                <button className="tf-nav-btn-ghost" onClick={() => navigate('editor')}>
                  Open Editor
                </button>
                <div className="tf-nav-avatar-wrap" ref={dropRef}>
                  <button className="tf-nav-avatar" onClick={() => setDropOpen(v => !v)}>
                    {initial}
                  </button>
                  {dropOpen && (
                    <div className="tf-nav-dropdown">
                      <button className="tf-nav-dd-item" onClick={() => navigate('account')}>Account</button>
                      <button className="tf-nav-dd-item" onClick={() => navigate('editor')}>Editor</button>
                      <div className="tf-nav-dd-sep" />
                      <button className="tf-nav-dd-item danger" onClick={() => { logout(); navigate('home'); }}>
                        Log out
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <button className="tf-nav-btn-ghost" onClick={() => navigate('login')}>Log in</button>
                <button className="tf-nav-btn-primary" onClick={() => navigate('signup')}>Get Started →</button>
              </>
            )}
          </div>

          <button className="tf-hamburger" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
            {mobileOpen ? '✕' : '☰'}
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      <div className={`tf-mobile-overlay${mobileOpen ? ' open' : ''}`}>
        <div className="tf-mobile-links">
          {NAV_LINKS.map(({ label, page }) => (
            <button key={page} className="tf-mobile-link" onClick={() => navigate(page)}>{label}</button>
          ))}
          {user && <button className="tf-mobile-link" onClick={() => navigate('account')}>Account</button>}
        </div>
        <div className="tf-mobile-cta">
          {user
            ? <button onClick={() => navigate('editor')}>Open Editor →</button>
            : <button onClick={() => navigate('signup')}>Get Started Free →</button>
          }
        </div>
      </div>
    </>
  );
}
