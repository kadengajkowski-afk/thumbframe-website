import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

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
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    position: relative;
    cursor: pointer;
    transition: transform var(--transition-base), border-color var(--transition-base);
  }
  .tf-gallery-full-card:hover {
    transform: translateY(-3px) scale(1.01);
    border-color: var(--border-hover);
  }
  .tf-gallery-full-card::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,107,0,0.03) 0%, transparent 60%);
  }
  .tf-gallery-full-card span {
    font-size: 11px;
    color: var(--text-muted);
    font-family: var(--font-body);
    z-index: 1;
    text-align: center;
    padding: 8px;
  }
  @media (max-width: 900px) {
    .tf-gallery-full-grid { grid-template-columns: repeat(3, 1fr); }
  }
  @media (max-width: 640px) {
    .tf-gallery-full-grid { grid-template-columns: repeat(2, 1fr); padding: 0 16px 80px; }
  }
`;

export default function Gallery({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Gallery | ThumbFrame — AI YouTube Thumbnail Editor';
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
        {Array.from({ length: 20 }, (_, i) => (
          <div key={i} className="tf-gallery-full-card">
            <span>Made with ThumbFrame</span>
          </div>
        ))}
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
