import { useState, useEffect, useRef, lazy, Suspense } from 'react';
import { trackPageView } from './utils/analytics';
import FabricCanvas from './FabricCanvas';
import NewEditor from './editor/NewEditor';
import MobileEditor from './mobile/MobileEditor';
import CookieBanner from './components/CookieBanner';
import { useAuth } from './context/AuthContext';
import { handleUpgrade } from './utils/checkout';

// ── Code-split marketing pages ────────────────────────────────────────────────
const Home      = lazy(() => import('./landing/LandingPageV2'));
const Features  = lazy(() => import('./pages/Features'));
const PricingPage = lazy(() => import('./pages/Pricing'));
const About     = lazy(() => import('./pages/About'));
const Gallery   = lazy(() => import('./pages/Gallery'));
const Blog      = lazy(() => import('./pages/Blog'));
const BlogPost  = lazy(() => import('./pages/BlogPost'));
const BlogAdmin = lazy(() => import('./pages/BlogAdmin'));
const Support   = lazy(() => import('./pages/Support'));
const Privacy   = lazy(() => import('./pages/legal/Privacy'));
const Terms     = lazy(() => import('./pages/legal/Terms'));
const Refund    = lazy(() => import('./pages/legal/Refund'));
const Changelog = lazy(() => import('./pages/legal/Changelog'));
const NotFound  = lazy(() => import('./pages/NotFound'));
const Login     = lazy(() => import('./pages/Login'));
const Signup    = lazy(() => import('./pages/Signup'));
const Account   = lazy(() => import('./pages/Account'));
const SettingsPage = lazy(() => import('./pages/Settings'));
const ForgotPasswordPage = lazy(() => import('./pages/ForgotPassword'));
const UpdatePasswordPage = lazy(() => import('./pages/UpdatePassword'));

function PageLoader() {
  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid #1c1c1c', borderTopColor: '#f97316', animation: 'thumbframe-spin 0.7s linear infinite' }} />
    </div>
  );
}


// ── Mobile detection ──────────────────────────────────────────────────────────
function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    window.innerWidth < 768 ||
    (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
  );
  useEffect(() => {
    const check = () => setIsMobile(
      window.innerWidth < 768 ||
      (window.matchMedia && window.matchMedia('(pointer: coarse)').matches)
    );
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);
  return isMobile;
}

// ── Palette ────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#0a0a0a',
  bg2:      '#0f0f0f',
  bg3:      '#1c1c1c',
  panel:    '#141414',
  border:   '#202020',
  border2:  '#2d2d2d',
  text:     '#f4f4f5',
  text2:    '#a1a1aa',
  muted:    '#52525b',
  accent:   '#f97316',
  accent2:  '#ea580c',
  accent3:  '#fb923c',
  success:  '#22c55e',
  warning:  '#f59e0b',
  cream:    '#0f0f0f',
};

// ── Sidebar ────────────────────────────────────────────────────────────────────
function Sidebar({ open, onClose, setPage }) {
  const ref = useRef(null);

  useEffect(() => {
    function handleClick(e) {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    }
    if (open) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [open, onClose]);

  const sections = [
    {
      title: 'Projects',
      items: [
        { icon: '✦', label: 'New design',    action: () => { setPage('editor'); onClose(); } },
        { icon: '⊡', label: 'Saved designs', action: () => { setPage('gallery'); onClose(); } },
        { icon: '↑', label: 'Import image',  action: () => { setPage('editor'); onClose(); } },
        { icon: '↓', label: 'Export / Download', action: () => { setPage('editor'); onClose(); } },
      ],
    },
    {
      title: 'Account',
      items: [
        { icon: '◎', label: 'Log in',    action: () => { setPage('login'); onClose(); } },
        { icon: '✚', label: 'Sign up',   action: () => { setPage('signup'); onClose(); } },
        { icon: '⚡', label: 'Go Pro — $15/mo', action: () => { onClose(); handleUpgrade(); }, highlight: true },
        { icon: '⚙️', label: 'Settings', action: () => { setPage('settings'); onClose(); } },
      ],
    },
    {
      title: 'Help & info',
      items: [
        { icon: '?', label: 'How it works',   action: () => { setPage('home'); onClose(); } },
        { icon: '✉', label: 'Contact support', action: () => { window.location.href = 'mailto:support@thumbframe.app'; onClose(); } },
        { icon: '★', label: 'Examples',        action: () => { setPage('examples'); onClose(); } },
        { icon: '$', label: 'Pricing',          action: () => { setPage('pricing'); onClose(); } },
      ],
    },
    {
      title: 'Tools',
      items: [
        { icon: '⬜', label: 'Safe zones overlay', action: () => { setPage('editor'); onClose(); } },
        { icon: '📱', label: 'Mobile stamp test',  action: () => { setPage('editor'); onClose(); } },
        { icon: '✂️', label: 'Background remover',  action: () => { setPage('editor'); onClose(); } },
      ],
    },
  ];

  return (
    <>
      {/* Overlay */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 199,
        background: 'rgba(26,22,18,0.35)',
        opacity: open ? 1 : 0,
        pointerEvents: open ? 'all' : 'none',
        transition: 'opacity 0.25s',
        backdropFilter: 'blur(2px)',
      }}/>
      {/* Drawer */}
      <div ref={ref} style={{
        position: 'fixed', top: 0, left: 0, bottom: 0, zIndex: 200,
        width: 280,
        background: C.cream,
        borderRight: `1px solid ${C.border}`,
        boxShadow: '4px 0 32px rgba(0,0,0,0.12)',
        transform: open ? 'translateX(0)' : 'translateX(-100%)',
        transition: 'transform 0.28s cubic-bezier(0.4,0,0.2,1)',
        display: 'flex', flexDirection: 'column',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
        overflowY: 'auto',
      }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 24, height: 24, borderRadius: 6, background: C.accent, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 12, color: '#fff', fontWeight: '800' }}>S</span>
            </div>
            <span style={{ fontSize: 15, fontWeight: '700', color: C.text }}>ThumbFrame</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: C.muted, fontSize: 18, padding: '2px 6px', borderRadius: 4 }}>×</button>
        </div>

        {/* Open editor CTA */}
        <div style={{ padding: '14px 16px', borderBottom: `1px solid ${C.border}` }}>
          <button onClick={() => { setPage('editor'); onClose(); }} style={{
            width: '100%', padding: '10px 16px', borderRadius: 8, border: 'none',
            background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 13,
            fontWeight: '700', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
            ✦ Open editor
          </button>
        </div>

        {/* Sections */}
        <div style={{ flex: 1, padding: '8px 0' }}>
          {sections.map((section, si) => (
            <div key={si} style={{ marginBottom: 4 }}>
              <div style={{ padding: '10px 20px 4px', fontSize: 10, fontWeight: '700', color: C.muted, letterSpacing: '0.8px', textTransform: 'uppercase' }}>
                {section.title}
              </div>
              {section.items.map((item, ii) => (
                <button key={ii} onClick={item.action} style={{
                  width: '100%', padding: '9px 20px', background: 'none', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 10,
                  color: item.highlight ? C.accent : C.text2, fontSize: 13,
                  fontWeight: item.highlight ? '700' : '400', textAlign: 'left',
                  borderLeft: item.highlight ? `3px solid ${C.accent}` : '3px solid transparent',
                  transition: 'background 0.15s',
                }}
                  onMouseEnter={e => e.currentTarget.style.background = C.bg2}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span style={{ width: 18, textAlign: 'center', fontSize: 12, opacity: 0.7 }}>{item.icon}</span>
                  {item.label}
                  {item.highlight && <span style={{ marginLeft: 'auto', fontSize: 9, background: C.accent, color: '#fff', padding: '2px 6px', borderRadius: 10, fontWeight: '700' }}>PRO</span>}
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: `1px solid ${C.border}`, fontSize: 11, color: C.muted }}>
          Built for YouTubers who care about their craft.
        </div>
      </div>
    </>
  );
}

// ── Nav ────────────────────────────────────────────────────────────────────────
function Nav({ page, setPage, user, onLogout }) {
  const [scrolled,     setScrolled]     = useState(false);
  const [sidebarOpen,  setSidebarOpen]  = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  return (
    <>
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} setPage={setPage} />
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        background: scrolled ? 'rgba(245,240,232,0.95)' : C.bg,
        backdropFilter: scrolled ? 'blur(12px)' : 'none',
        borderBottom: `1px solid ${scrolled ? C.border : 'transparent'}`,
        transition: 'all 0.3s',
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
      }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px', height: 54, display: 'flex', alignItems: 'center', gap: 12 }}>

          {/* Hamburger menu */}
          <button onClick={() => setSidebarOpen(true)} style={{
            background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer',
            padding: '6px 9px', borderRadius: 6, display: 'flex', flexDirection: 'column',
            gap: 4, color: C.text, flexShrink: 0,
          }}>
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
            <div style={{ width: 16, height: 1.5, background: C.text2, borderRadius: 1 }} />
          </button>

          {/* Logo */}
          <div onClick={() => setPage('home')} style={{ display: 'flex', alignItems: 'center', gap: 7, cursor: 'pointer', flexShrink: 0 }}>
            <img src="/logo.jpg" alt="ThumbFrame" style={{ width: 22, height: 22, borderRadius: 5, objectFit: 'cover' }} />
            <span style={{ fontSize: 15, fontWeight: '700', color: C.text, letterSpacing: '-0.2px' }}>ThumbFrame</span>
          </div>

          {/* Nav links */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 2, marginLeft: 8 }}>
            {[['How it works', 'howitworks'], ['Examples', 'examples'], ['Pricing', 'pricing']].map(([label, key]) => (
              <button key={key} onClick={() => setPage(key)} style={{
                padding: '5px 12px', borderRadius: 6, border: 'none',
                background: page === key ? C.bg2 : 'transparent',
                color: page === key ? C.text : C.muted,
                cursor: 'pointer', fontSize: 13,
                fontWeight: page === key ? '600' : '400',
              }}>
                {label}
              </button>
            ))}
          </div>

          <div style={{ flex: 1 }} />

          {/* Right actions */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {user ? (
              <>
                <span style={{ fontSize: 13, color: C.text2, fontWeight: '500' }}>{user.name}</span>
                <button onClick={() => setPage('gallery')} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 13, fontWeight: '500' }}>
                  Gallery
                </button>
                <button onClick={onLogout} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                  Log out
                </button>
              </>
            ) : (
              <>
                <button onClick={() => setPage('login')} style={{ padding: '6px 14px', borderRadius: 6, border: 'none', background: 'transparent', color: C.muted, cursor: 'pointer', fontSize: 13 }}>
                  Log in
                </button>
                <button onClick={() => setPage('signup')} style={{ padding: '6px 14px', borderRadius: 6, border: `1px solid ${C.border2}`, background: 'transparent', color: C.text2, cursor: 'pointer', fontSize: 13, fontWeight: '500' }}>
                  Sign up
                </button>
              </>
            )}
            <button onClick={() => setPage('editor')} style={{
              padding: '7px 16px', borderRadius: 6, border: 'none',
              background: C.accent, color: '#fff', cursor: 'pointer',
              fontSize: 13, fontWeight: '700',
            }}>
              Open editor →
            </button>
          </div>
        </div>
      </nav>
    </>
  );
}

// ── How it works ───────────────────────────────────────────────────────────────
function HowItWorks({ setPage }) {
  const steps = [
    { n:'01', title:'Upload your image',      desc:'Drag in a photo or start from scratch. Your image is never uploaded to our servers — everything happens in your browser.' },
    { n:'02', title:'Remove the background',  desc:'Click the AI background remover. It handles hair, complex edges, everything. Takes about 3 seconds.' },
    { n:'03', title:'Add text and elements',  desc:'Use our text tool to add bold, high-contrast text. Add shapes, stickers, or elements from the library.' },
    { n:'04', title:'Check the mobile view',  desc:"Toggle the mobile stamp test to see exactly how your thumbnail looks at 150×84px — how most viewers see it before clicking." },
    { n:'05', title:'Check safe zones',        desc:"Turn on the safe zones overlay to make sure nothing important is covered by YouTube's timestamp or watch-later button." },
    { n:'06', title:'Download at full res',    desc:'Export as PNG or JPG at 1280×720 — the exact spec YouTube recommends for thumbnails.' },
  ];
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 720, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>How it works</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', marginBottom: 14, color: C.text }}>From photo to finished thumbnail in under 5 minutes</h1>
          <p style={{ fontSize: 15, color: C.muted, lineHeight: 1.7 }}>No tutorial needed. But here's the flow most creators use.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
          {steps.map((s, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '56px 1fr', gap: 20, padding: '28px 0', borderBottom: i < steps.length - 1 ? `1px solid ${C.border}` : 'none', alignItems: 'start' }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: C.bg2, border: `1px solid ${C.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: '800', color: C.accent, fontFamily: 'monospace' }}>
                {s.n}
              </div>
              <div>
                <div style={{ fontSize: 16, fontWeight: '700', color: C.text, marginBottom: 6 }}>{s.title}</div>
                <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: 48, textAlign: 'center' }}>
          <button onClick={() => setPage('editor')} style={{ padding: '13px 28px', borderRadius: 8, border: 'none', background: C.accent, color: '#fff', cursor: 'pointer', fontSize: 15, fontWeight: '700' }}>
            Try it now — it's free →
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Examples ───────────────────────────────────────────────────────────────────
function Examples({ setPage }) {
  const all = [
    { bg:'linear-gradient(135deg,#1a1a2e,#4a3060)', text:'WATCH THIS',        textColor:'#FFD700', tag:'Gaming',     desc:'Bold Impact font with gold text' },
    { bg:'linear-gradient(135deg,#0f2027,#2c5364)', text:'RESULTS',           textColor:'#ffffff', tag:'Business',   desc:'Clean and professional' },
    { bg:'linear-gradient(135deg,#c45c2e,#f7a642)', text:"YOU WON'T BELIEVE", textColor:'#ffffff', tag:'Viral',      desc:'High energy, warm tones' },
    { bg:'linear-gradient(135deg,#1a472a,#2d6a4f)', text:'How I Did It',      textColor:'#95d5b2', tag:'Vlog',       desc:'Personal, approachable' },
    { bg:'linear-gradient(135deg,#2c2c54,#706fd3)', text:'EPIC MOMENT',       textColor:'#ffffff', tag:'Minecraft',  desc:'Deep purple gaming style' },
    { bg:'linear-gradient(135deg,#3d0000,#c0392b)', text:'GONE WRONG',        textColor:'#ffffff', tag:'Challenge',  desc:'Dramatic red for high drama' },
    { bg:'linear-gradient(135deg,#f7971e,#ffd200)', text:'5 TIPS',            textColor:'#1a1a1a', tag:'Tutorial',   desc:'Bright and optimistic' },
    { bg:'linear-gradient(135deg,#11998e,#38ef7d)', text:'I TRIED IT',        textColor:'#ffffff', tag:'Lifestyle',  desc:'Fresh green energy' },
    { bg:'linear-gradient(135deg,#4776E6,#8E54E9)', text:'THE TRUTH',         textColor:'#ffffff', tag:'Commentary', desc:'Mysterious purple gradient' },
  ];
  return (
    <div style={{ background: C.bg, minHeight: '100vh', color: C.text, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif', paddingTop: 80 }}>
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <div style={{ fontSize: 12, fontWeight: '700', color: C.accent, letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 10 }}>Examples</div>
          <h1 style={{ fontSize: 'clamp(28px, 4vw, 42px)', fontWeight: '800', letterSpacing: '-1px', marginBottom: 12, color: C.text }}>Made with ThumbFrame</h1>
          <p style={{ fontSize: 15, color: C.muted }}>Click any example to open it in the editor and customize it.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
          {all.map((ex, i) => (
            <div key={i} onClick={() => setPage('editor')}
              style={{ borderRadius: 10, overflow: 'hidden', border: `1px solid ${C.border}`, cursor: 'pointer', background: C.panel, transition: 'transform 0.2s' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)'; }}
              onMouseLeave={e => { e.currentTarget.style.transform = 'none'; e.currentTarget.style.boxShadow = 'none'; }}>
              <div style={{ aspectRatio: '16/9', background: ex.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', overflow: 'hidden' }}>
                <span style={{ fontSize: 20, fontWeight: '900', color: ex.textColor, fontFamily: 'Impact, sans-serif', textShadow: '2px 2px 0 rgba(0,0,0,0.5)', letterSpacing: 1, textAlign: 'center', padding: '0 16px' }}>
                  {ex.text}
                </span>
                <div style={{ position: 'absolute', bottom: 5, right: 5, padding: '1px 5px', borderRadius: 2, background: 'rgba(0,0,0,0.8)', fontSize: 8, color: '#fff', fontFamily: 'monospace' }}>0:00</div>
              </div>
              <div style={{ padding: '12px 16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 12, color: C.accent, fontWeight: '700', background: `${C.accent}18`, padding: '2px 8px', borderRadius: 10 }}>{ex.tag}</span>
                  <span style={{ fontSize: 11, color: C.muted }}>Open →</span>
                </div>
                <div style={{ fontSize: 12, color: C.muted }}>{ex.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── App ────────────────────────────────────────────────────────────────────────

function getInitialPage() {
  const path = window.location.pathname.toLowerCase();
  if (path === '/editor') return 'editor';
  // /dashboard is retired — redirect bookmarks to the new /gallery route.
  if (path === '/dashboard') return 'gallery';
  if (path === '/settings') return 'settings';
  if (path === '/login') return 'login';
  if (path === '/signup') return 'signup';
  if (path === '/pricing') return 'pricing';
  if (path === '/examples') return 'examples';
  if (path === '/howitworks') return 'howitworks';
  if (path === '/account') return 'account';
  if (path === '/forgot-password') return 'forgot-password';
  if (path === '/update-password') return 'update-password';
  if (path === '/features') return 'features';
  if (path === '/about') return 'about';
  if (path === '/gallery') return 'gallery';
  if (path === '/blog') return 'blog';
  if (path.startsWith('/blog/') && path.length > 6) return 'blog-post';
  if (path === '/support') return 'support';

  if (path === '/admin/blog' || path.startsWith('/admin')) return 'admin-blog';
  if (path === '/privacy') return 'privacy';
  if (path === '/terms') return 'terms';
  if (path === '/refund' || path === '/refunds') return 'refund';
  if (path === '/changelog') return 'changelog';
  return path === '/' ? 'home' : 'notfound';
}

function syncPath(page) {
  // These pages manage their own URLs
  if (page === 'blog-post' || page === 'admin-blog') return;
  const nextPath = page === 'home' ? '/' : `/${page}`;
  // Preserve query params (e.g. ?engine=fabric, ?project=xxx)
  const search = window.location.search || '';
  const fullPath = nextPath + search;
  if (window.location.pathname !== nextPath) {
    window.history.replaceState(null, '', fullPath);
  }
}

const PROTECTED_PAGES = new Set(['editor', 'gallery', 'settings', 'account']);


export default function App() {
  const isMobile = useIsMobile();
  const [page, setPage] = useState(getInitialPage);
  const [blogSlug, setBlogSlug] = useState(() => {
    const p = window.location.pathname;
    return p.startsWith('/blog/') ? p.replace('/blog/', '') : null;
  });

  // Auth state comes from context — token is reactive, auto-refreshed by Supabase.
  const { user, token: authToken, logout: handleLogout } = useAuth();

  useEffect(() => {
    syncPath(page);
    trackPageView(window.location.pathname + window.location.search);
  }, [page]);

  // Redirect away from protected pages when logged out.
  useEffect(() => {
    if (!user && PROTECTED_PAGES.has(page)) {
      setPage('home');
    }
  }, [page, user]);

  if (page === 'editor') {
    if (isMobile) return <MobileEditor user={user} />;
    // ?engine=fabric escapes to the legacy Fabric.js canvas (dev fallback only)
    const engineParam = new URLSearchParams(window.location.search).get('engine');
    if (engineParam === 'fabric') {
      return <FabricCanvas user={user} darkMode={true} />;
    }
    return <NewEditor user={user} setPage={setPage} />;
  }

  // Marketing pages — self-contained with own Navbar/Footer (code-split with Suspense)
  const marketingPages = {
    home:        <Home setPage={setPage} user={user} />,
    features:    <Features setPage={setPage} />,
    pricing:     <PricingPage setPage={setPage} />,
    about:       <About setPage={setPage} />,
    gallery:     <Gallery setPage={setPage} user={user} />,
    login:       <Login setPage={setPage} />,
    signup:      <Signup setPage={setPage} />,
    account:     <Account setPage={setPage} />,
    settings:    <SettingsPage setPage={setPage} />,
    'forgot-password': <ForgotPasswordPage setPage={setPage} />,
    'update-password': <UpdatePasswordPage setPage={setPage} />,
    blog:        <Blog setPage={setPage} onOpenPost={(slug) => { setBlogSlug(slug); setPage('blog-post'); window.history.pushState(null, '', `/blog/${slug}`); }} />,
    'blog-post': <BlogPost slug={blogSlug} setPage={setPage} onBack={() => { setPage('blog'); window.history.pushState(null, '', '/blog'); }} />,
    'admin-blog': <BlogAdmin setPage={setPage} user={user} token={authToken} />,
    support:     <Support setPage={setPage} />,
    privacy:     <Privacy setPage={setPage} />,
    terms:       <Terms setPage={setPage} />,
    refund:      <Refund setPage={setPage} />,
    changelog:   <Changelog setPage={setPage} />,
    notfound:    <NotFound setPage={setPage} />,
  };
  if (marketingPages[page]) {
    return (
      <div className="tf-marketing-shell">
        <Suspense fallback={<PageLoader />}>{marketingPages[page]}</Suspense>
        <CookieBanner />
      </div>
    );
  }

  return (
    <div>
      <Nav page={page} setPage={setPage} user={user} onLogout={handleLogout} />
      {page === 'howitworks' && <HowItWorks   setPage={setPage} />}
      {page === 'pricing'    && <PricingPage  setPage={setPage} />}
      {page === 'examples'   && <Examples     setPage={setPage} />}
      <CookieBanner />
    </div>
  );
}