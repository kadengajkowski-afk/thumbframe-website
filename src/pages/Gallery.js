import React, { useEffect, useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';
import { useAuth } from '../context/AuthContext';
import db from '../db';

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
  const min  = Math.floor(diff / 60000);
  const hr   = Math.floor(diff / 3600000);
  const day  = Math.floor(diff / 86400000);
  if (min < 1)  return 'Just now';
  if (min < 60) return `${min}m ago`;
  if (hr  < 24) return `${hr}h ago`;
  if (day < 7)  return `${day}d ago`;
  return new Date(ms).toLocaleDateString();
}

const S = `
  .tf-gallery-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 0 24px 100px;
    max-width: 1200px;
    margin: 0 auto;
  }
  @media (max-width: 900px) { .tf-gallery-grid { grid-template-columns: repeat(3, 1fr); } }
  @media (max-width: 640px) { .tf-gallery-grid { grid-template-columns: repeat(2, 1fr); padding: 0 16px 80px; gap: 10px; } }

  .tf-showcase-card {
    aspect-ratio: 16/9;
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07);
    display: flex; align-items: center; justify-content: center;
    overflow: hidden; position: relative; cursor: pointer;
    transition: transform 0.2s, border-color 0.2s, box-shadow 0.2s;
  }
  .tf-showcase-card:hover {
    transform: translateY(-3px) scale(1.01);
    border-color: rgba(255,107,0,0.2);
    box-shadow: 0 8px 24px rgba(0,0,0,0.4);
  }
  .tf-showcase-card .hover-overlay {
    position: absolute; inset: 0;
    background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center;
    opacity: 0; transition: opacity 0.2s;
  }
  .tf-showcase-card:hover .hover-overlay { opacity: 1; }

  .tf-project-card {
    border-radius: 10px;
    border: 1px solid rgba(255,255,255,0.07);
    background: #0c0c0f;
    overflow: hidden; cursor: pointer;
    transition: transform 0.2s, border-color 0.2s;
    display: flex; flex-direction: column;
    position: relative;
  }
  .tf-project-card:hover {
    transform: translateY(-2px);
    border-color: rgba(255,107,0,0.25);
  }
  .tf-project-actions {
    display: flex; gap: 4px;
    position: absolute; top: 6px; right: 6px;
    opacity: 0; transition: opacity 0.15s;
  }
  .tf-project-card:hover .tf-project-actions { opacity: 1; }

  .tf-skeleton {
    aspect-ratio: 16/9; border-radius: 10px;
    background: linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%);
    background-size: 200% 100%;
    animation: tf-shimmer 1.4s infinite;
    border: 1px solid rgba(255,255,255,0.05);
  }
  @keyframes tf-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

  .tf-lightbox-overlay {
    position: fixed; inset: 0;
    background: rgba(0,0,0,0.92);
    z-index: 900; display: flex;
    align-items: center; justify-content: center;
    animation: lb-in 0.2s ease;
  }
  @keyframes lb-in { from { opacity: 0; } to { opacity: 1; } }
`;

function Lightbox({ items, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const touchStartX   = useRef(null);
  const prev = useCallback(() => setIdx((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    const h = (e) => {
      if (e.key === 'Escape')     onClose();
      if (e.key === 'ArrowLeft')  prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose, prev, next]);

  const item = items[idx];
  return (
    <div
      className="tf-lightbox-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={(e) => { touchStartX.current = e.touches[0].clientX; }}
      onTouchEnd={(e) => { const dx = e.changedTouches[0].clientX - touchStartX.current; if (dx < -50) next(); else if (dx > 50) prev(); }}
    >
      <button onClick={onClose} style={navBtnStyle}>✕</button>
      <button onClick={prev} style={{ ...navBtnStyle, position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)' }}>‹</button>
      <div style={{
        maxWidth: 900, width: '90%', aspectRatio: '16/9',
        borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)',
        overflow: 'hidden', position: 'relative',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: item.bg,
      }}>
        {item.text && (
          <span style={{ fontSize: 20, fontWeight: 900, color: item.color, fontFamily: 'Impact,sans-serif', textShadow: '2px 2px 0 rgba(0,0,0,0.5)', textAlign: 'center', padding: '0 20px' }}>
            {item.text}
          </span>
        )}
        <div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>
          {idx + 1} / {items.length}
        </div>
      </div>
      <button onClick={next} style={{ ...navBtnStyle, position: 'absolute', right: 16, top: '50%', transform: 'translateY(-50%)' }}>›</button>
    </div>
  );
}

const navBtnStyle = {
  position: 'absolute', top: 16, right: 16,
  width: 44, height: 44, borderRadius: '50%',
  background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.15)',
  color: '#fff', fontSize: 18, cursor: 'pointer',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
};

function ProjectCard({ project, onOpen, onDelete }) {
  const [thumbSrc, setThumbSrc] = useState(null);

  useEffect(() => {
    db.blobs.where('projectId').equals(project.id).first().then((blob) => {
      if (blob?.data) setThumbSrc(blob.data);
    }).catch(() => {});
  }, [project.id]);

  const bgColor = (project.data?.layers || []).find((l) => l.type === 'background')?.bgColor || '#1a1a1a';

  return (
    <div className="tf-project-card" onClick={() => onOpen(project.id)}>
      <div style={{ aspectRatio: '16/9', overflow: 'hidden', background: bgColor, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {thumbSrc
          ? <img src={thumbSrc} alt={project.name || 'Project'} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
          : <div style={{ opacity: 0.3, fontSize: 24 }}>🖼</div>
        }
      </div>
      <div style={{ padding: '10px 12px 12px' }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#f0f0f3', marginBottom: 3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontFamily: "'Satoshi',sans-serif" }}>
          {project.name || 'Untitled Project'}
        </div>
        <div style={{ fontSize: 11, color: '#55555e', fontFamily: "'Satoshi',sans-serif" }}>
          {formatRelativeTime(project.updatedAt)}
        </div>
      </div>
      <div className="tf-project-actions">
        <button
          style={{ width: 26, height: 26, borderRadius: 5, border: 'none', cursor: 'pointer', fontSize: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.85)', color: '#fff' }}
          title="Delete project"
          onClick={(e) => { e.stopPropagation(); onDelete(project.id); }}
        >✕</button>
      </div>
    </div>
  );
}

const fadeUp = {
  hidden:  { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: [0.16, 1, 0.3, 1] } },
};
const stagger = { visible: { transition: { staggerChildren: 0.07 } } };

export default function Gallery({ setPage }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  const [projects,    setProjects]    = useState([]);
  const [projLoading, setProjLoading] = useState(false);

  const { user, isLoading } = useAuth();

  useSEO({
    title: 'Gallery — ThumbFrame',
    description: "Your saved ThumbFrame projects. Open, continue, or export any thumbnail you've created.",
    url: 'https://thumbframe.com/gallery',
  });

  useEffect(() => {
    if (!user) return;
    setProjLoading(true);
    db.projects.orderBy('updatedAt').reverse().toArray()
      .then(async (all) => {
        // Include projects owned by this user OR projects with no userId (pre-fix,
        // local to this browser so they belong to whoever is logged in).
        const mine = all.filter(p => !p.userId || p.userId === user.id);

        // Backfill missing userId so future queries work correctly.
        const untagged = mine.filter(p => !p.userId);
        if (untagged.length > 0) {
          await Promise.all(untagged.map(p => db.projects.update(p.id, { userId: user.id })));
        }

        setProjects(mine);
        setProjLoading(false);
      })
      .catch(() => setProjLoading(false));
  }, [user]);

  function openProject(id) {
    localStorage.setItem('tf_open_project', id);
    setPage('editor');
    window.scrollTo({ top: 0 });
  }

  async function deleteProject(id) {
    if (!window.confirm('Delete this project? This cannot be undone.')) return;
    await db.projects.delete(id);
    await db.blobs.where('projectId').equals(id).delete().catch(() => {});
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div style={{ background: '#050507', minHeight: '100vh', fontFamily: "'Satoshi', sans-serif", color: '#f0f0f3' }}>
      <style>{S}</style>
      <Navbar setPage={setPage} currentPage="gallery" />

      {/* Hero */}
      <motion.div
        variants={stagger} initial="hidden" animate="visible"
        style={{
          textAlign: 'center',
          padding: '140px 24px 60px',
          position: 'relative', overflow: 'hidden',
        }}
      >
        <div style={{
          position: 'absolute', inset: 0,
          background: 'radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <motion.p variants={fadeUp} style={{
          fontSize: 11, fontWeight: 700, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: '#FF6B00', margin: '0 0 16px',
        }}>
          {user ? 'MY PROJECTS' : 'GALLERY'}
        </motion.p>
        <motion.h1 variants={fadeUp} style={{ margin: '0 0 16px' }}>
          {user
            ? 'Your Thumbnails'
            : <><span style={{ color: '#FF6B00' }}>Made with</span><br />ThumbFrame.</>
          }
        </motion.h1>
        <motion.p variants={fadeUp} style={{ fontSize: 16, color: '#8a8a93', margin: '0 auto', maxWidth: 420, lineHeight: 1.6 }}>
          {user
            ? 'Click any project to continue editing.'
            : 'Real thumbnails made by real creators using ThumbFrame.'
          }
        </motion.p>
      </motion.div>

      {/* Sign-in CTA for logged-out visitors */}
      {!isLoading && !user && (
        <div style={{ maxWidth: 1200, margin: '0 auto 32px', padding: '0 24px' }}>
          <div style={{
            background: '#0c0c0f', border: '1px solid rgba(255,255,255,0.07)',
            borderRadius: 12, padding: '20px 24px',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            gap: 16, flexWrap: 'wrap',
          }}>
            <p style={{ fontSize: 14, color: '#8a8a93', margin: 0 }}>
              <span style={{ color: '#f0f0f3', fontWeight: 600 }}>Save your thumbnails</span> — sign in to keep your projects and access them anywhere.
            </p>
            <button
              onClick={() => { setPage('signup'); window.scrollTo({ top: 0 }); }}
              style={{
                padding: '8px 18px', borderRadius: 8, border: 'none',
                background: '#FF6B00', color: '#fff', cursor: 'pointer',
                fontSize: 13, fontWeight: 700, fontFamily: "'Satoshi',sans-serif",
                whiteSpace: 'nowrap',
              }}
            >
              Get Started Free →
            </button>
          </div>
        </div>
      )}

      {/* Content */}
      {isLoading ? (
        <div className="tf-gallery-grid">
          {Array.from({ length: 8 }, (_, i) => <div key={i} className="tf-skeleton" />)}
        </div>
      ) : user ? (
        <div className="tf-gallery-grid">
          {projLoading ? (
            Array.from({ length: 6 }, (_, i) => <div key={i} className="tf-skeleton" />)
          ) : projects.length === 0 ? (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ fontSize: 40, marginBottom: 16, opacity: 0.3 }}>🖼</div>
              <h3 style={{ fontSize: 22, fontWeight: 700, color: '#f0f0f3', marginBottom: 10 }}>No projects yet</h3>
              <p style={{ fontSize: 15, color: '#8a8a93', marginBottom: 24 }}>Create your first thumbnail and it'll show up here.</p>
              <button
                onClick={() => { setPage('editor'); window.scrollTo({ top: 0 }); }}
                style={{
                  padding: '11px 24px', borderRadius: 9, border: 'none',
                  background: '#FF6B00', color: '#fff', cursor: 'pointer',
                  fontSize: 14, fontWeight: 700, fontFamily: "'Satoshi',sans-serif",
                  boxShadow: '0 0 20px rgba(255,107,0,0.25)',
                }}
              >
                Create Thumbnail →
              </button>
            </div>
          ) : (
            projects.map((project) => (
              <ProjectCard key={project.id} project={project} onOpen={openProject} onDelete={deleteProject} />
            ))
          )}
        </div>
      ) : (
        <>
          <div className="tf-gallery-grid">
            {SHOWCASE.map((item, i) => (
              <div
                key={i}
                className="tf-showcase-card"
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
                <div className="hover-overlay">
                  <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,107,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 18 }}>⤢</div>
                </div>
              </div>
            ))}
          </div>
          {lightboxIdx !== null && (
            <Lightbox items={SHOWCASE} startIdx={lightboxIdx} onClose={() => setLightboxIdx(null)} />
          )}
        </>
      )}

      <Footer setPage={setPage} />
    </div>
  );
}
