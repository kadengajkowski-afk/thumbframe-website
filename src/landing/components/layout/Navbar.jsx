import React, { useState } from 'react';
import { Menu, X } from 'lucide-react';
import Button from '../ui/Button';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'Pricing',  href: '#pricing' },
  { label: 'FAQ',      href: '#faq' },
];

export default function Navbar({ onNavigate }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const goTo = (page) => {
    setMobileOpen(false);
    onNavigate?.(page);
  };

  return (
    <>
      <nav className="fixed top-0 left-0 right-0 z-50 h-16 flex items-center border-b border-space-3 bg-space-0/60 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 w-full flex items-center justify-between">
          {/* Logo */}
          <a href="/" onClick={e => { e.preventDefault(); goTo('home'); }} className="flex items-center gap-2.5">
            <img src="/logo.jpg" alt="" width={24} height={24} className="rounded-md" style={{ boxShadow: '0 0 12px rgba(249,115,22,0.35)' }} />
            <span className="text-base font-bold text-text-0 tracking-tight" style={{ fontFamily: 'var(--font-display)' }}>ThumbFrame</span>
          </a>

          {/* Desktop links */}
          <div className="hidden md:flex items-center gap-6">
            {NAV_LINKS.map(l => (
              <a key={l.label} href={l.href} className="text-sm text-text-1 hover:text-text-0 transition-colors">
                {l.label}
              </a>
            ))}
            <button onClick={() => goTo('login')} className="text-sm text-text-1 hover:text-text-0 transition-colors cursor-pointer">
              Login
            </button>
            <Button size="sm" onClick={() => goTo('signup')}>Start free</Button>
          </div>

          {/* Mobile hamburger */}
          <button className="md:hidden text-text-1 hover:text-text-0 cursor-pointer" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={22} />
          </button>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-[60] bg-space-0/95 backdrop-blur-lg flex flex-col items-center justify-center gap-8">
          <button className="absolute top-5 right-6 text-text-1 hover:text-text-0 cursor-pointer" onClick={() => setMobileOpen(false)} aria-label="Close menu">
            <X size={24} />
          </button>
          {NAV_LINKS.map(l => (
            <a key={l.label} href={l.href} onClick={() => setMobileOpen(false)} className="text-2xl font-semibold text-text-0">
              {l.label}
            </a>
          ))}
          <button onClick={() => goTo('login')} className="text-xl text-text-1 hover:text-text-0 cursor-pointer">Login</button>
          <Button size="lg" onClick={() => goTo('signup')}>Start free</Button>
        </div>
      )}
    </>
  );
}
