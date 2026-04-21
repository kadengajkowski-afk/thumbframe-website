// Top navigation — used on /, /login, /signup.
//
// Inline-styled (no Tailwind classes) so it renders correctly on
// pages that don't load landing.built.css (e.g. /login, /signup).
//
// Layout:
//   • Left  : ThumbFrame wordmark
//   • Right : Features, Pricing, [Account ▾] or [Login], primary CTA
//   • Mobile: hamburger → painterly full-screen panel
//
// Logged-in state shows an Account dropdown (hover desktop, tap mobile)
// with Settings / Billing / Log out.

import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';

const PUBLIC_LINKS = [
  { label: 'Features', kind: 'action', target: 'features', href: '/features' },
  { label: 'Pricing',  kind: 'action', target: 'pricing',  href: '/pricing'  },
];

const FONT_UI = "'Inter Variable', 'Inter', system-ui, sans-serif";
const FONT_DISPLAY = "'Fraunces Variable', 'Fraunces', Georgia, serif";

function useIsMobileViewport(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(
    typeof window !== 'undefined' && window.innerWidth < breakpoint
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
    const handle = (e) => setIsMobile(e.matches);
    mq.addEventListener('change', handle);
    return () => mq.removeEventListener('change', handle);
  }, [breakpoint]);
  return isMobile;
}

export default function Navbar({ onNavigate }) {
  const isMobile = useIsMobileViewport();
  const [mobileOpen,  setMobileOpen]  = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const closeTimer = useRef(null);

  const { user, logout } = useAuth();
  const isLoggedIn = !!user;
  const accountLabel = user?.name || user?.email?.split('@')[0] || 'Account';

  const goTo = (target) => {
    setMobileOpen(false);
    setAccountOpen(false);
    onNavigate?.(target);
  };

  const handleLogout = async () => {
    setMobileOpen(false);
    setAccountOpen(false);
    await logout();
    onNavigate?.('home');
  };

  const handleLink = (e, link) => {
    if (link.kind === 'action') {
      e.preventDefault();
      goTo(link.target);
    }
    // Anchor links bubble naturally to the hash target.
  };

  // Hover-open with small leave delay so cursor can travel to the panel.
  const openAccount = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setAccountOpen(true);
  };
  const scheduleCloseAccount = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    closeTimer.current = setTimeout(() => setAccountOpen(false), 140);
  };

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 20,
        left: 0,
        right: 0,
        zIndex: 50,
        padding: '0 32px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        pointerEvents: 'none', // children re-enable; lets clicks pass through gaps
      }}>
        {/* Ship mark + wordmark */}
        <a
          href="/"
          onClick={(e) => { e.preventDefault(); goTo('home'); }}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            textDecoration: 'none',
            pointerEvents: 'auto',
            textShadow: '0 1px 8px rgba(20, 12, 28, 0.9)',
          }}
        >
          <img
            src="/brand/ship-hero.png"
            alt=""
            aria-hidden="true"
            style={{
              height: isMobile ? 20 : 24,
              width: 'auto',
              display: 'block',
              filter: 'drop-shadow(0 1px 6px rgba(20, 12, 28, 0.85))',
            }}
          />
          <span style={{
            fontFamily: FONT_DISPLAY,
            fontWeight: 500,
            fontSize: 16,
            letterSpacing: '-0.01em',
            color: '#faecd0',
          }}>
            ThumbFrame
          </span>
        </a>

        {/* Right cluster (desktop) */}
        {!isMobile && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            pointerEvents: 'auto',
            textShadow: '0 1px 8px rgba(20, 12, 28, 0.9)',
            fontFamily: FONT_UI,
          }}>
            {PUBLIC_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleLink(e, link)}
                style={{
                  fontSize: 14,
                  color: '#faecd0',
                  textDecoration: 'none',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#faecd0')}
              >
                {link.label}
              </a>
            ))}

            {isLoggedIn ? (
              <div
                style={{ position: 'relative' }}
                onMouseEnter={openAccount}
                onMouseLeave={scheduleCloseAccount}
              >
                <button
                  type="button"
                  onClick={() => setAccountOpen((v) => !v)}
                  style={{
                    fontFamily: FONT_UI,
                    fontSize: 14,
                    color: '#faecd0',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 4,
                    transition: 'color 150ms ease',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                  onMouseLeave={(e) => (e.currentTarget.style.color = '#faecd0')}
                  aria-haspopup="menu"
                  aria-expanded={accountOpen}
                >
                  Account
                  <ChevronDown
                    size={14}
                    style={{
                      transition: 'transform 150ms ease',
                      transform: accountOpen ? 'rotate(180deg)' : 'rotate(0)',
                    }}
                  />
                </button>

                <div
                  role="menu"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 8px)',
                    right: 0,
                    minWidth: 220,
                    background: 'rgba(10, 7, 20, 0.92)',
                    backdropFilter: 'blur(12px)',
                    WebkitBackdropFilter: 'blur(12px)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: 8,
                    boxShadow: '0 16px 40px rgba(0,0,0,0.45)',
                    fontFamily: FONT_UI,
                    opacity: accountOpen ? 1 : 0,
                    transform: accountOpen ? 'translateY(0)' : 'translateY(-4px)',
                    pointerEvents: accountOpen ? 'auto' : 'none',
                    transition: 'opacity 150ms ease, transform 150ms ease',
                    overflow: 'hidden',
                    textShadow: 'none',
                  }}
                >
                  <div style={{
                    padding: '12px 14px',
                    fontSize: 12,
                    color: '#a0a0a0',
                    wordBreak: 'break-all',
                  }}>
                    {user?.email || accountLabel}
                  </div>
                  <Divider />
                  <DropdownItem onClick={() => goTo('gallery')}>Gallery</DropdownItem>
                  <DropdownItem onClick={() => goTo('settings')}>Settings</DropdownItem>
                  <DropdownItem onClick={() => goTo('billing')}>Billing</DropdownItem>
                  <Divider />
                  <DropdownItem onClick={handleLogout} color="#e87050">Log out</DropdownItem>
                </div>
              </div>
            ) : (
              <a
                href="/login"
                onClick={(e) => { e.preventDefault(); goTo('login'); }}
                style={{
                  fontSize: 14,
                  color: '#faecd0',
                  textDecoration: 'none',
                  transition: 'color 150ms ease',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#ffffff')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#faecd0')}
              >
                Login
              </a>
            )}

          </div>
        )}

        {/* Mobile hamburger */}
        {isMobile && (
          <button
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              padding: 6,
              color: '#faecd0',
              filter: 'drop-shadow(0 1px 6px rgba(20, 12, 28, 0.95))',
              pointerEvents: 'auto',
            }}
          >
            <Menu size={24} />
          </button>
        )}
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 60,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 28,
            background: 'rgba(20, 12, 28, 0.96)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontFamily: FONT_UI,
          }}
        >
          <button
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
            style={{
              position: 'absolute', top: 20, right: 24,
              background: 'none', border: 'none', cursor: 'pointer',
              color: '#faecd0',
            }}
          >
            <X size={26} />
          </button>

          {PUBLIC_LINKS.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => {
                if (link.kind === 'action') e.preventDefault();
                setMobileOpen(false);
                if (link.kind === 'action') goTo(link.target);
              }}
              style={{ fontSize: 22, fontWeight: 600, color: '#faecd0', textDecoration: 'none' }}
            >
              {link.label}
            </a>
          ))}

          {isLoggedIn ? (
            <>
              <div style={{
                fontSize: 13, color: '#a0a0a0',
                wordBreak: 'break-all', textAlign: 'center', maxWidth: '80%',
              }}>
                {user?.email}
              </div>
              <a
                href="/gallery"
                onClick={(e) => { e.preventDefault(); goTo('gallery'); }}
                style={{ fontSize: 22, fontWeight: 600, color: '#faecd0', textDecoration: 'none' }}
              >
                Gallery
              </a>
              <a
                href="/settings"
                onClick={(e) => { e.preventDefault(); goTo('settings'); }}
                style={{ fontSize: 22, fontWeight: 600, color: '#faecd0', textDecoration: 'none' }}
              >
                Settings
              </a>
              <a
                href="/billing"
                onClick={(e) => { e.preventDefault(); goTo('billing'); }}
                style={{ fontSize: 22, fontWeight: 600, color: '#faecd0', textDecoration: 'none' }}
              >
                Billing
              </a>
              <button
                onClick={handleLogout}
                style={{
                  fontSize: 22, fontWeight: 600, color: '#e87050',
                  background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                }}
              >
                Log out
              </button>
            </>
          ) : (
            <a
              href="/login"
              onClick={(e) => { e.preventDefault(); goTo('login'); }}
              style={{ fontSize: 22, fontWeight: 600, color: '#faecd0', textDecoration: 'none' }}
            >
              Login
            </a>
          )}
        </div>
      )}
    </>
  );
}

function Divider() {
  return <div style={{ height: 1, background: 'rgba(255,255,255,0.08)' }} />;
}

function DropdownItem({ onClick, color = '#faecd0', children }) {
  return (
    <button
      type="button"
      role="menuitem"
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '10px 14px',
        background: 'transparent',
        border: 'none',
        cursor: 'pointer',
        textAlign: 'left',
        fontFamily: 'inherit',
        fontSize: 14,
        color,
        transition: 'background-color 120ms ease',
      }}
      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(255,255,255,0.05)')}
      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
    >
      {children}
    </button>
  );
}
