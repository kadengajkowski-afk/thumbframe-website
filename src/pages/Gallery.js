import React, { useEffect, useState, useRef, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useSEO } from '../hooks/useSEO';

const ITEMS = Array.from({ length: 20 }, (_, i) => ({
  id: i,
  label: 'Made with ThumbFrame',
  color: `hsl(${(i * 23 + 10) % 360}, 15%, 14%)`,
}));

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
  .tf-gallery-full-grid {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 16px;
    padding: 0 24px 100px;
    max-width: 1200px;
    margin: 0 auto;
  }
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
  .tf-gallery-full-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,107,0,0.04) 0%, transparent 60%);
  }
  .tf-gallery-full-card span {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-body);
    z-index: 1;
    text-align: center;
    padding: 8px;
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
  @media (max-width: 900px) {
    .tf-gallery-full-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 640px) {
    .tf-gallery-full-grid { grid-template-columns: repeat(2, 1fr); padding: 0 16px 80px; gap: 10px; }
  }

  /* ── Lightbox ───────────────────────────────────────────────────────── */
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
    top: 16px;
    right: 16px;
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10;
    transition: background 0.15s;
  }
  .tf-lightbox-close:hover { background: rgba(255,255,255,0.18); }
  .tf-lightbox-nav {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: rgba(255,255,255,0.1);
    border: 1px solid rgba(255,255,255,0.15);
    color: #fff;
    font-size: 18px;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: background 0.15s;
    z-index: 10;
  }
  .tf-lightbox-nav:hover { background: rgba(255,107,0,0.4); border-color: var(--accent); }
  .tf-lightbox-prev { left: 16px; }
  .tf-lightbox-next { right: 16px; }
  .tf-lightbox-content {
    max-width: 900px;
    width: 90%;
    aspect-ratio: 16/9;
    border-radius: 12px;
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    color: var(--text-muted);
    overflow: hidden;
    position: relative;
  }
  .tf-lightbox-counter {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 13px;
    color: rgba(255,255,255,0.5);
  }
`;

function Lightbox({ items, startIdx, onClose }) {
  const [idx, setIdx] = useState(startIdx);
  const touchStartX = useRef(null);

  const prev = useCallback(() => setIdx((i) => (i - 1 + items.length) % items.length), [items.length]);
  const next = useCallback(() => setIdx((i) => (i + 1) % items.length), [items.length]);

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, prev, next]);

  const onTouchStart = (e) => { touchStartX.current = e.touches[0].clientX; };
  const onTouchEnd = (e) => {
    if (!touchStartX.current) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    if (dx < -50) next();
    else if (dx > 50) prev();
    touchStartX.current = null;
  };

  const item = items[idx];

  return (
    <div
      className="tf-lightbox-overlay"
      onClick={(e) => e.target === e.currentTarget && onClose()}
      onTouchStart={onTouchStart}
      onTouchEnd={onTouchEnd}
    >
      <button className="tf-lightbox-close" onClick={onClose} aria-label="Close">✕</button>
      <button className="tf-lightbox-nav tf-lightbox-prev" onClick={prev} aria-label="Previous">‹</button>
      <div className="tf-lightbox-content" style={{ background: item.color }}>
        <span>{item.label}</span>
        <div className="tf-lightbox-counter">{idx + 1} / {items.length}</div>
      </div>
      <button className="tf-lightbox-nav tf-lightbox-next" onClick={next} aria-label="Next">›</button>
    </div>
  );
}

export default function Gallery({ setPage }) {
  const [lightboxIdx, setLightboxIdx] = useState(null);
  useScrollAnimation();

  useSEO({
    title: 'Gallery — ThumbFrame',
    description: 'Real thumbnails made by real creators using ThumbFrame. See what\'s possible with AI thumbnail editing.',
    url: 'https://thumbframe.com/gallery',
  });

  useEffect(() => {
    document.title = 'Gallery — ThumbFrame';
  }, []);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{galleryStyles}</style>
      <Navbar setPage={setPage} currentPage="gallery" />

      <div className="tf-gallery-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Gallery</span>
        <h1 className="animate-on-scroll">
          Made with<br />
          <span className="text-gradient">ThumbFrame.</span>
        </h1>
        <p className="animate-on-scroll">
          Real thumbnails made by real creators using ThumbFrame.
        </p>
      </div>

      <div className="tf-gallery-full-grid stagger-children">
        {ITEMS.map((item) => (
          <div
            key={item.id}
            className="tf-gallery-full-card"
            style={{ background: item.color }}
            onClick={() => setLightboxIdx(item.id)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => e.key === 'Enter' && setLightboxIdx(item.id)}
            aria-label={`View thumbnail ${item.id + 1}`}
          >
            <span>{item.label}</span>
            <div className="tf-gallery-hover-overlay">
              <div className="tf-gallery-zoom-icon">⤢</div>
            </div>
          </div>
        ))}
      </div>

      {lightboxIdx !== null && (
        <Lightbox
          items={ITEMS}
          startIdx={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
        />
      )}

      <Footer setPage={setPage} />
    </div>
  );
}
