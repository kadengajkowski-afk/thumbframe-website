// Top navigation — adapted for Thumbtown per spec §7.
//   • Fixed at top, TRANSPARENT background (sits over the painted scene)
//   • Links: Features / Pricing / Login
//   • Primary CTA: "Open Editor →"
//   • Mobile: hamburger → painterly full-screen panel
//
// When scroll content lands below the scene in Phase 7 we'll add a
// scroll-opacity ramp so the nav fades to opaque; for Phase 2 it stays
// transparent throughout.

import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';

const NAV_LINKS = [
  { label: 'Features', kind: 'anchor', href: '#features' },
  { label: 'Pricing',  kind: 'anchor', href: '#pricing'  },
  { label: 'Login',    kind: 'action', href: '/login', target: 'login' },
];

export default function Navbar({ onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (target) => {
    setMobileOpen(false);
    onNavigate?.(target);
  };

  const handleLink = (e, link) => {
    if (link.kind === 'action') {
      e.preventDefault();
      goTo(link.target);
    }
    // Anchor links bubble naturally to the hash target.
  };

  return (
    <>
      <nav
        className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center"
        style={{ background: 'transparent' }}
      >
        <div className="max-w-6xl mx-auto px-6 w-full flex items-center justify-between">
          {/* Logo — ThumbFrame wordmark (painterly serif) */}
          <a
            href="/"
            onClick={(e) => { e.preventDefault(); goTo('home'); }}
            className="flex items-center gap-2.5"
            style={{ textShadow: '0 1px 8px rgba(20, 12, 28, 0.9)' }}
          >
            <img
              src="/logo.jpg"
              alt=""
              width={24}
              height={24}
              className="rounded-md"
              style={{ boxShadow: '0 0 12px rgba(249,115,22,0.45)' }}
            />
            <span
              className="text-base font-bold tracking-tight"
              style={{
                fontFamily: "'Fraunces Variable', 'Fraunces', Georgia, serif",
                fontWeight: 500,
                letterSpacing: '-0.01em',
                color: '#f5ebd4',
              }}
            >
              ThumbFrame
            </span>
          </a>

          {/* Desktop links */}
          <div
            className="hidden md:flex items-center gap-7"
            style={{ textShadow: '0 1px 8px rgba(20, 12, 28, 0.9)' }}
          >
            {NAV_LINKS.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={(e) => handleLink(e, link)}
                className="text-sm transition-colors"
                style={{ color: '#d6c9a8' }}
                onMouseEnter={(e) => (e.currentTarget.style.color = '#f5ebd4')}
                onMouseLeave={(e) => (e.currentTarget.style.color = '#d6c9a8')}
              >
                {link.label}
              </a>
            ))}
            <button
              onClick={() => goTo('editor')}
              style={{
                background: '#f97316',
                color: '#1a0a00',
                fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
                fontWeight: 600,
                fontSize: 13,
                padding: '8px 16px',
                borderRadius: 8,
                border: 'none',
                cursor: 'pointer',
                boxShadow:
                  '0 0 20px -4px rgba(249, 115, 22, 0.55), 0 3px 10px rgba(249, 115, 22, 0.28)',
                transition: 'transform 160ms ease, box-shadow 160ms ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-1px)';
                e.currentTarget.style.boxShadow =
                  '0 0 28px -2px rgba(249, 115, 22, 0.75), 0 4px 14px rgba(249, 115, 22, 0.38)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow =
                  '0 0 20px -4px rgba(249, 115, 22, 0.55), 0 3px 10px rgba(249, 115, 22, 0.28)';
              }}
            >
              Open Editor →
            </button>
          </div>

          {/* Mobile hamburger */}
          <button
            className="md:hidden cursor-pointer"
            style={{ color: '#f5ebd4', filter: 'drop-shadow(0 1px 6px rgba(20, 12, 28, 0.95))' }}
            onClick={() => setMobileOpen(true)}
            aria-label="Open menu"
          >
            <Menu size={24} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-8"
          style={{
            background: 'rgba(20, 12, 28, 0.96)',
            backdropFilter: 'blur(10px)',
            WebkitBackdropFilter: 'blur(10px)',
            fontFamily: "'Inter Variable', 'Inter', system-ui, sans-serif",
          }}
        >
          <button
            className="absolute top-5 right-6 cursor-pointer"
            style={{ color: '#f5ebd4' }}
            onClick={() => setMobileOpen(false)}
            aria-label="Close menu"
          >
            <X size={26} />
          </button>
          {NAV_LINKS.map((link) => (
            // eslint-disable-next-line jsx-a11y/anchor-is-valid
            <a
              key={link.label}
              href={link.href}
              onClick={(e) => {
                if (link.kind === 'action') e.preventDefault();
                setMobileOpen(false);
                if (link.kind === 'action') goTo(link.target);
              }}
              className="text-2xl font-semibold"
              style={{ color: '#f5ebd4' }}
            >
              {link.label}
            </a>
          ))}
          <button
            onClick={() => goTo('editor')}
            style={{
              background: '#f97316',
              color: '#1a0a00',
              fontFamily: 'inherit',
              fontWeight: 600,
              fontSize: 16,
              padding: '14px 28px',
              borderRadius: 10,
              border: 'none',
              cursor: 'pointer',
              boxShadow:
                '0 0 28px -4px rgba(249, 115, 22, 0.55), 0 4px 14px rgba(249, 115, 22, 0.28)',
            }}
          >
            Open Editor →
          </button>
        </div>
      )}
    </>
  );
}
