import React, { useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';

const blogStyles = `
  .tf-blog-hero {
    padding: 140px 24px 80px;
    text-align: center;
    position: relative;
    overflow: hidden;
  }
  .tf-blog-hero::before {
    content: '';
    position: absolute;
    inset: 0;
    background: radial-gradient(ellipse 70% 50% at 50% 0%, rgba(255,107,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  .tf-blog-hero h1 {
    font-size: clamp(36px, 5vw, 58px);
    letter-spacing: -0.03em;
    margin-bottom: 20px;
  }
  .tf-blog-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.6;
  }
  .tf-blog-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 24px;
    padding: 0 24px 100px;
    max-width: 1200px;
    margin: 0 auto;
  }
  .tf-blog-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: var(--radius-lg);
    overflow: hidden;
    cursor: pointer;
    transition: all var(--transition-base);
  }
  .tf-blog-card:hover {
    transform: translateY(-3px);
    border-color: var(--border-hover);
  }
  .tf-blog-card-img {
    aspect-ratio: 16/9;
    background: var(--bg-tertiary);
    border-bottom: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .tf-blog-card-img span { font-size: 32px; opacity: 0.3; }
  .tf-blog-card-body { padding: 24px; }
  .tf-blog-card-cat {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    margin-bottom: 10px;
    font-family: var(--font-body);
  }
  .tf-blog-card-title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    margin-bottom: 10px;
    letter-spacing: -0.02em;
    line-height: 1.3;
  }
  .tf-blog-card-excerpt {
    font-size: 14px;
    color: var(--text-secondary);
    line-height: 1.6;
  }
  .tf-blog-card-meta {
    margin-top: 16px;
    font-size: 12px;
    color: var(--text-muted);
  }
  @media (max-width: 900px) {
    .tf-blog-grid { grid-template-columns: repeat(2, 1fr); }
  }
  @media (max-width: 580px) {
    .tf-blog-grid { grid-template-columns: 1fr; padding: 0 16px 80px; }
  }
`;

const POSTS = [
  {
    cat: 'Tips',
    icon: '📊',
    title: 'The 5 thumbnail mistakes killing your CTR (and how to fix them)',
    excerpt: 'Most creators make the same 5 mistakes on every thumbnail. Here\'s what they are and how ThumbFrame helps you avoid them.',
    date: 'March 2025',
  },
  {
    cat: 'Tutorial',
    icon: '🎨',
    title: 'How to remove backgrounds with AI in 30 seconds',
    excerpt: 'A step-by-step walkthrough of ThumbFrame\'s AI background removal — from import to clean cutout.',
    date: 'February 2025',
  },
  {
    cat: 'Case Study',
    icon: '📈',
    title: 'How one creator went from 3% to 7% CTR with better thumbnails',
    excerpt: 'A real case study on using CTR Intelligence scoring to identify what\'s working and what isn\'t.',
    date: 'February 2025',
  },
  {
    cat: 'Feature',
    icon: '✨',
    title: 'Introducing Prompt-to-Thumbnail: generate a full design in seconds',
    excerpt: 'Describe your thumbnail idea in plain English and get a fully composed, export-ready design.',
    date: 'January 2025',
  },
  {
    cat: 'Tips',
    icon: '😮',
    title: 'Expression matters: the psychology behind high-CTR faces',
    excerpt: 'Why exaggerated expressions work, when they don\'t, and how to nail the emotion that gets clicks.',
    date: 'January 2025',
  },
  {
    cat: 'Tutorial',
    icon: '🔤',
    title: 'Text that gets read: font and hierarchy in YouTube thumbnails',
    excerpt: 'The complete guide to text in thumbnails — size, contrast, font choice, and when to skip text entirely.',
    date: 'December 2024',
  },
];

export default function Blog({ setPage }) {
  useScrollAnimation();

  useEffect(() => {
    document.title = 'Blog | ThumbFrame — AI YouTube Thumbnail Editor';
  }, []);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
      <style>{blogStyles}</style>
      <Navbar setPage={setPage} currentPage="blog" />

      <div className="tf-blog-hero">
        <span className="badge badge-accent" style={{ marginBottom: 24 }}>Blog</span>
        <h1 className="animate-on-scroll">
          Creator resources.
        </h1>
        <p className="animate-on-scroll">
          Tips, tutorials, and insights for YouTube thumbnail strategy.
        </p>
      </div>

      <div className="tf-blog-grid stagger-children">
        {POSTS.map((post) => (
          <div key={post.title} className="tf-blog-card">
            <div className="tf-blog-card-img">
              <span>{post.icon}</span>
            </div>
            <div className="tf-blog-card-body">
              <div className="tf-blog-card-cat">{post.cat}</div>
              <div className="tf-blog-card-title">{post.title}</div>
              <p className="tf-blog-card-excerpt">{post.excerpt}</p>
              <div className="tf-blog-card-meta">{post.date}</div>
            </div>
          </div>
        ))}
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
