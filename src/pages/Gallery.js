import React, { useEffect, useState, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useSEO } from '../hooks/useSEO';
import supabase from '../supabaseClient';
import db from '../db';

// ── Static showcase items (shown when logged out) ─────────────────────────────
const SHOWCASE = [
  { bg: 'linear-gradient(135deg,#1a1a2e,#4a3060)', text: 'WATCH THIS',        color: '#FFD700' },
  { bg: 'linear-gradient(135deg,#0f2027,#2c5364)', text: 'THE TRUTH',          color: '#fff'    },
  { bg: 'linear-gradient(135deg,#c45c2e,#f7a642)', text: "YOU WON'T BELIEVE",  color: '#fff'    },
  { bg: 'linear-gradient(135deg,#1a472a,#2d6a4f)', text: 'How I Did It',        color: '#95d5b2' },
  { bg: 'linear-gradient(135deg,#2c2c54,#706fd3)', text: 'EPIC MOMENT',         color: '#fff'    },
  { bg: 'linear-gradient(135deg,#3d0000,#c0392b)', text: 'GONE WRONG',          color: '#fff'    },
  { bg: 'linear-gradient(135deg,#f7971e,#ffd200)', text: '5 TIPS',              color: '#1a1a1a' },
  { bg: 'linear-gradient(135deg,#11998e,#38ef7d)', text: 'I TRIED IT',          color: '#fff'    },
  { bg: 'linear-gradient(135deg,#4776E6,#8E54E9)', text: 'THE RESULTS',         color: '#fff'    },
  { bg: 'linear-gradient(135deg,#c45c2e,#1a1a2e)', text: '10 MISTAKES',         color: '#ffd700' },
  { bg: 'linear-gradient(135deg,#1a2a4a,#3a6ea8)', text: 'EXPOSED',             color: '#fff'    },
  { bg: 'linear-gradient(135deg,#2d1b69,#11998e)', text: 'INSANE TRICK',        color: '#fff'    },
];

function formatRelativeTime(ms) {
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  const hr  = Math.floor(diff / 3600000);
  const day = Math.floor(diff / 86400000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

// ── Styles ────────────────────────────────────────────────────────────────────
const galleryStyles = `
  .tf-gallery-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tf-gallery-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-gallery-hero h1 {
    font-size: clamp(36px, 5vw, 58px);
    letter-spacing: -0.03em;
    line-height: 1.08;
    max-width: 580px;
    margin: 0 auto 20px;
  }
  .tf-gallery-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 420px;
    margin: 0 auto;
    line-height: 1.6;
  }

  /* ── Project grid ──────────────────────────────────────────────────────── */
  .tf-gallery-full-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 0 24px 100px;
    max-width: 1200px;
    margin: 0 auto;
  }
  @media (max-width: 900px) { .tf-gallery-full-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 640px) { .tf-gallery-full-grid { grid-template-columns: repeat(2, 1fr); padding: 0 16px 80px; gap: 10px; } }
  @media (max-width: 480px) { .tf-gallery-full-grid { grid-template-columns: repeat(2, 1fr); padding: 0 12px 60px !important; gap: 10px !important; } }

  /* Showcase card (logged-out) */
  .tf-gallery-full-card {
    aspect-ratio: 16/9;
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .tf-gallery-full-card:hover {
    transform: translateY(-3px) scale(1.01);
    border-color: var(--border-hover);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .tf-gallery-full-card .tf-gallery-hover-overlay {
    position: absolute;
    inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    opacity: 0;
    transition: opacity 0.2s;
  }
  .tf-gallery-full-card:hover .tf-gallery-hover-overlay { opacity: 1; }
  .tf-gallery-zoom-icon {
    color: #fff;
    font-size: 20px;
    background: rgba(255,107,0,0.8);
    width: 40px; height: 40px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  /* Project card (logged-in) */
  .tf-project-card {
    border-radius: var(--radius-md);
    border: 1px solid var(--border);
    background: var(--bg-secondary);
    overflow: hidden;
    cursor: pointer;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
    display: flex;
    flex-direction: column;
  }
  .tf-project-card:hover {
    transform: translateY(-2px);
    border-color: var(--accent);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .tf-project-card-thumb {
    aspect-ratio: 16/9;
    overflow: hidden;
    background: var(--bg-tertiary);
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tf-project-card-thumb img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .tf-project-card-info {
    padding: 10px 12px 12px;
  }
  .tf-project-card-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 3px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-body);
  }
  .tf-project-card-time {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-body);
  }
  .tf-project-actions {
    display: flex;
    gap: 4px;
    position: absolute;
    top: 6px;
    right: 6px;
    opacity: 0;
    transition: opacity 0.15s;
  }
  .tf-project-card:hover .tf-project-actions { opacity: 1; }
  .tf-project-action-btn {
    width: 26px;
    height: 26px;
    border-radius: 5px;
    border: none;
    cursor: pointer;
    font-size: 11px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
  }

  /* Empty state */
  .tf-gallery-empty {
    grid-column: 1 / -1;
    text-align: center;
    padding: 80px 24px;
  }
  .tf-gallery-empty h3 {
    font-size: 22px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 10px;
  }
  .tf-gallery-empty p {
    font-size: 15px;
    color: var(--text-secondary);
    margin-bottom: 24px;
  }

  /* Sign-in CTA banner */
  .tf-gallery-signin-banner {
    max-width: 1200px;
    margin: 0 auto 40px;
    padding: 0 24px;
  }
  .tf-gallery-signin-inner {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 16px;
    flex-wrap: wrap;
  }
  .tf-gallery-signin-inner p { font-size: 14px; color: var(--text-secondary); margin: 0; }
  .tf-gallery-signin-inner strong { color: var(--text-primary); }

  /* Lightbox */
  .tf-lightbox-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 900;
    display: flex;
    align-items: center;
    justify-content: center;
    animation: lb-in 0.2s ease;
  }
  @keyframes lb-in { from { opacity: 0; } to { opacity: 1; } }
  .tf-lightbox-close {
    position: absolute;
    top: 16px; right: 16px;
    width: 44px; height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff; font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    z-index: 10; transition: background 0.15s;
  }
  .tf-lightbox-close:hover { background: rgba(255,255,255,0.18); }
  .tf-lightbox-nav {
    position: absolute; top: 50%; transform: translateY(-50%);
    width: 44px; height: 44px; border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff; font-size: 18px; cursor: pointer;
    display: flex; align-items: center; justify-content: center;
    transition: background 0.15s; z-index: 10;
  }
  .tf-lightbox-nav:hover { background: rgba(255,107,0,0.4); border-color: var(--accent); }
  .tf-lightbox-prev { left: 16px; }
  .tf-lightbox-next { right: 16px; }
  .tf-lightbox-content {
    max-width: 900px; width: 90%;
    aspect-ratio: 16/9; border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    overflow: hidden; position: relative;
    display: flex; align-items: center; justify-content: center;
  }
  .tf-lightbox-counter {
    position: absolute; bottom: 16px; left: 50%; transform: translateX(-50%);
    font-size: 13px; color: rgba(255,255,255,0.5);
  }

  /* Skeleton loader */
  .tf-project-skeleton {
    aspect-ratio: 16/9;
    border-radius: var(--radius-md);
    background: linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%);
    background-size: 200% 100%;
    animation: gal-shimmer 1.4s infinite;
    border: 1px solid var(--border);
  }
  @keyframes gal-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
`;

// ── Lightbox ──────────────────────────────────────────────────────────────────
function Lightbox({ items, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const touchStartX   = useRef(null);
  const prev = useCallback(() => setIdx((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose(); if (e.key === 'ArrowLeft') prev(); if (e.key === 'ArrowRight') next(); };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, prev, next]);

  const item = items[idx];
  return (
    <div className="tf-lightbox-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (dx < -50) next(); else if (dx > 50) prev(); }}
    >
      <button className="tf-lightbox-close" onClick={onClose}>✕</button>
      <button className="tf-lightbox-nav tf-lightbox-prev" onClick={prev}>‹</button>
      <div className="tf-lightbox-content" style={{ background: item.bg }}>
        {item.text && (
          <span style={{ fontSize: 20, fontWeight: 900, color: item.color, fontFamily: 'Impact,sans-serif', textShadow: '2px 2px 0 rgba(0,0,0,0.5)', textAlign: 'center', padding: '0 20px' }}>
            {item.text}
          </span>
        )}
        <div className="tf-lightbox-counter">{idx + 1} / {items.length}</div>
      </div>
      <button className="tf-lightbox-nav tf-lightbox-next" onClick={next}>›</button>
    </div>
  );
}

// ── User project card ─────────────────────────────────────────────────────────
function ProjectCard({ project, onOpen, onDelete }) {
  const [thumbSrc, setThumbSrc] = useState(null);

  useEffect(() => {
    // Try to load first image blob for this project as thumbnail
    db.blobs.where('projectId').equals(project.id).first().then((blob) => {
      if (blob?.data) setThumbSrc(blob.data);
    }).catch(() => {});
  }, [project.id]);

  const layers = project.data?.layers || [];
  const bgColor = layers.find((l) => l.type === 'background')?.bgColor || '#1a1a1a';

  return (
    <div className="tf-project-card" onClick={() => onOpen(project.id)} style={{ position: 'relative' }}>
      <div className="tf-project-card-thumb" style={{ background: bgColor }}>
        {thumbSrc ? (
          <img src={thumbSrc} alt={project.name || 'Project'} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, opacity: 0.4 }}>
            <div style={{ fontSize: 24 }}>🖼</div>
            <div style={{ fontSize: 9, color: '#666', fontFamily: 'monospace' }}>No preview</div>
          </div>
        )}
      </div>
      <div className="tf-project-card-info">
        <div className="tf-project-card-name">{project.name || 'Untitled Project'}</div>
        <div className="tf-project-card-time">{formatRelativeTime(project.updatedAt)}</div>
      </div>
      <div className="tf-project-actions">
        <button
          className="tf-project-action-btn"
          style={{ background: 'rgba(239,68,68,0.85)', color: '#fff' }}
          title="Delete project"
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
        >✕</button>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function Gallery({ setPage }) {
  const [lightboxIdx,  setLightboxIdx]  = useState(null);
  const [authUser,     setAuthUser]     = useState(undefined); // undefined = loading
  const [projects,     setProjects]     = useState([]);
  const [projLoading,  setProjLoading]  = useState(false);

  useScrollAnimation();

  useSEO({
    title: 'Gallery — ThumbFrame',
    description: 'Your saved ThumbFrame projects. Open, continue, or export any thumbnail you\'ve created.',
    url: 'https://thumbframe.com/gallery',
  });

  // Auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthUser(session?.user || null);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      setAuthUser(session?.user || null);
    });
    return () => subscription.unsubscribe();
  }, []);

  // Load projects when logged in
  useEffect(() => {
    if (!authUser) return;
    setProjLoading(true);
    db.projects.orderBy('updatedAt').reverse().toArray()
      .then((rows) => { setProjects(rows); setProjLoading(false); })
      .catch(() => setProjLoading(false));
  }, [authUser]);

  function openProject(id) {
    setPage(`editor?project=${id}`);
    // Also store the project id for the editor to pick up
    localStorage.setItem('tf_open_project', id);
    setPage('editor');
  }

  async function deleteProject(id) {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await db.projects.delete(id);
    await db.blobs.where('projectId').equals(id).delete().catch(() => {});
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  const isLoading = authUser === undefined;

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{galleryStyles}</style>
      <Navbar setPage={setPage} currentPage="gallery" />

      <div className="tf-gallery-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Gallery</span>
        <h1 className="animate-on-scroll">
          {authUser ? 'My Projects' : <><span className="text-gradient">Made with</span><br />ThumbFrame.</>}
        </h1>
        <p className="animate-on-scroll">
          {authUser
            ? 'Your saved thumbnails. Click any to continue editing.'
            : 'Real thumbnails made by real creators using ThumbFrame.'}
        </p>
      </div>

      {/* Sign-in CTA for logged-out visitors */}
      {!isLoading && !authUser && (
        <div className="tf-gallery-signin-banner">
          <div className="tf-gallery-signin-inner">
            <p><strong>Save your thumbnails</strong> — sign in to keep your projects and access them from any device.</p>
            <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={() => setPage('signup')}>
              Get Started Free →
            </button>
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="tf-gallery-full-grid">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="tf-project-skeleton" />)}
        </div>
      ) : authUser ? (
        /* ── Logged-in: show user projects ──────────────────────────────── */
        <div className="tf-gallery-full-grid">
          {projLoading ? (
            Array.from({ length: 6 }, (_, i) => <div key={i} className="tf-project-skeleton" />)
          ) : projects.length === 0 ? (
            <div className="tf-gallery-empty">
              <h3>No projects yet</h3>
              <p>Create your first thumbnail and it'll show up here.</p>
              <button className="btn btn-primary" onClick={() => setPage('editor')}>
                Create Thumbnail →
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard
                key={project.id}
                project={project}
                onOpen={openProject}
                onDelete={deleteProject}
              />
            ))
          )}
        </div>
      ) : (
        /* ── Logged-out: static showcase + lightbox ──────────────────────── */
        <>
          <div className="tf-gallery-full-grid stagger-children">
            {SHOWCASE.map((item, i) => (
              <div
                key={i}
                className="tf-gallery-full-card"
                style={{ background: item.bg }}
                onClick={() => setLightboxIdx(i)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => e.key === 'Enter' && setLightboxIdx(i)}
                aria-label={`View thumbnail ${i + 1}`}
              >
                <span style={{ fontSize: 13, fontWeight: 900, color: item.color, fontFamily: 'Impact,sans-serif', textShadow: '1px 1px 0 rgba(0,0,0,0.5)', textAlign: 'center', padding: '0 8px', lineHeight: 1.2, zIndex: 1, position: 'relative' }}>
                  {item.text}
                </span>
                <div style={{ position: 'absolute', bottom: 4, right: 5, background: 'rgba(0,0,0,0.7)', borderRadius: 2, padding: '1px 4px', fontSize: 8, color: '#fff' }}>0:00</div>
                <div className="tf-gallery-hover-overlay">
                  <div className="tf-gallery-zoom-icon">⤢</div>
                </div>
              </div>
            ))}
          </div>

          {lightboxIdx !== null && (
            <Lightbox
              items={SHOWCASE}
              startIdx={lightboxIdx}
              onClose={() => setLightboxIdx(null)}
            />
          )}
        </>
      )}

      <Footer setPage={setPage} />
    </div>
  );
}
