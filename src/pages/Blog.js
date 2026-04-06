import React, { useState, useEffect, useCallback } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useScrollAnimation } from '../hooks/useScrollAnimation';
import { useSEO } from '../hooks/useSEO';

const API = process.env.REACT_APP_API_URL || '';

const blogStyles = `
  .tf-blog-hero {
    padding: 140px 24px 72px;
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
    margin: 0 auto 16px;
    max-width: 600px;
  }
  .tf-blog-hero p {
    font-size: 18px;
    color: var(--text-secondary);
    max-width: 400px;
    margin: 0 auto;
    line-height: 1.6;
  }
  .tf-blog-layout {
    max-width: 1200px;
    margin: 0 auto;
    padding: 0 24px 100px;
    display: grid;
    grid-template-columns: 1fr 300px;
    gap: 56px;
    align-items: start;
  }
  @media (max-width: 960px) {
    .tf-blog-layout { grid-template-columns: 1fr; gap: 40px; }
  }

  /* ── Category filter ─────────────────────────────── */
  .tf-blog-filter {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    margin-bottom: 36px;
  }
  .tf-cat-pill {
    background: none;
    border: 1px solid var(--border);
    border-radius: 100px;
    padding: 6px 14px;
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    cursor: pointer;
    transition: all 0.15s;
    font-family: var(--font-body);
  }
  .tf-cat-pill:hover { border-color: var(--accent); color: var(--accent); }
  .tf-cat-pill.active { background: var(--accent); border-color: var(--accent); color: #fff; }

  /* ── Post cards ────────────────────────────────────── */
  .tf-blog-posts { display: flex; flex-direction: column; gap: 24px; }
  .tf-blog-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    overflow: hidden;
    display: grid;
    grid-template-columns: 220px 1fr;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
  }
  .tf-blog-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
    box-shadow: 0 8px 32px rgba(0,0,0,0.3);
  }
  @media (max-width: 580px) {
    .tf-blog-card { grid-template-columns: 1fr; }
  }
  .tf-blog-card-img {
    overflow: hidden;
  }
  .tf-blog-card-img img {
    width: 100%; height: 100%;
    object-fit: cover;
    display: block;
  }
  .tf-blog-card-img-placeholder {
    width: 100%; height: 100%;
    min-height: 140px;
    background: linear-gradient(135deg, #141414 0%, #1c1c1c 100%);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 36px;
    opacity: 0.35;
  }
  .tf-blog-card-body {
    padding: 24px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
  }
  .tf-blog-cat-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    background: rgba(255,107,0,0.1);
    border-radius: 100px;
    padding: 3px 10px;
    margin-bottom: 10px;
    font-family: var(--font-body);
  }
  .tf-blog-card-title {
    font-family: var(--font-display);
    font-size: 17px;
    font-weight: 700;
    color: var(--text-primary);
    line-height: 1.3;
    letter-spacing: -0.02em;
    margin-bottom: 8px;
    transition: color 0.15s;
  }
  .tf-blog-card:hover .tf-blog-card-title { color: var(--accent); }
  .tf-blog-card-excerpt {
    font-size: 13px;
    color: var(--text-secondary);
    line-height: 1.65;
    margin-bottom: 14px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .tf-blog-card-meta {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    gap: 8px;
    align-items: center;
    flex-wrap: wrap;
  }
  .tf-meta-dot { opacity: 0.4; }

  /* ── Sidebar ─────────────────────────────────────── */
  .tf-blog-sidebar {
    position: sticky;
    top: 88px;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }
  .tf-sidebar-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 12px;
    padding: 22px;
  }
  .tf-sidebar-label {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--text-muted);
    margin-bottom: 14px;
  }
  .tf-sidebar-cat-list { display: flex; flex-direction: column; gap: 2px; }
  .tf-sidebar-cat-btn {
    background: none;
    border: none;
    text-align: left;
    padding: 7px 10px;
    border-radius: 7px;
    font-size: 13px;
    color: var(--text-secondary);
    cursor: pointer;
    font-family: var(--font-body);
    display: flex;
    align-items: center;
    justify-content: space-between;
    transition: background 0.15s, color 0.15s;
  }
  .tf-sidebar-cat-btn:hover, .tf-sidebar-cat-btn.active {
    background: rgba(255,107,0,0.08);
    color: var(--accent);
  }
  .tf-sidebar-count { font-size: 11px; opacity: 0.45; }
  .tf-sidebar-popular-list { display: flex; flex-direction: column; gap: 14px; }
  .tf-sidebar-popular-item {
    cursor: pointer;
    display: flex;
    gap: 10px;
    align-items: flex-start;
    padding: 6px 8px;
    margin: 0 -8px;
    border-radius: 8px;
    transition: background 0.15s;
  }
  .tf-sidebar-popular-item:hover { background: rgba(255,107,0,0.05); }
  .tf-sidebar-popular-num {
    font-size: 16px;
    font-weight: 800;
    color: var(--accent);
    opacity: 0.35;
    line-height: 1.2;
    flex-shrink: 0;
    font-family: var(--font-display);
    min-width: 22px;
  }
  .tf-sidebar-popular-title {
    font-size: 13px;
    font-weight: 500;
    color: var(--text-secondary);
    line-height: 1.4;
    transition: color 0.15s;
  }
  .tf-sidebar-popular-item:hover .tf-sidebar-popular-title { color: var(--text-primary); }

  .tf-newsletter-input {
    width: 100%;
    box-sizing: border-box;
    background: #141414;
    border: 1.5px solid var(--border);
    border-radius: 8px;
    padding: 10px 12px;
    font-size: 13px;
    font-family: var(--font-body);
    color: var(--text-primary);
    outline: none;
    margin-bottom: 8px;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .tf-newsletter-input:focus {
    border-color: var(--accent);
    box-shadow: 0 0 0 3px rgba(255,107,0,0.12);
  }
  .tf-newsletter-input::placeholder { color: #3a3a3a; }
  .tf-newsletter-btn {
    width: 100%;
    padding: 10px;
    border-radius: 8px;
    border: none;
    background: var(--accent);
    color: #fff;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    font-family: var(--font-body);
    transition: background 0.2s;
  }
  .tf-newsletter-btn:hover { background: #e55f00; }

  .tf-blog-skeleton {
    background: linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%);
    background-size: 200% 100%;
    animation: blog-shimmer 1.4s infinite;
    border-radius: 12px;
    height: 120px;
    margin-bottom: 24px;
  }
  @keyframes blog-shimmer {
    0% { background-position: 200% 0; }
    100% { background-position: -200% 0; }
  }
  .tf-blog-empty {
    text-align: center;
    padding: 80px 0;
    color: var(--text-muted);
    font-size: 15px;
  }
`;

const CAT_ICONS = {
  Tutorial: '📖', Guide: '📋', Comparison: '⚖️',
  'Case Study': '📈', Tips: '💡', Feature: '✨', News: '📣',
};

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

export default function Blog({ setPage, onOpenPost }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [email, setEmail] = useState('');
  const [subscribed, setSubscribed] = useState(false);

  useScrollAnimation();

  useSEO({
    title: 'Blog — ThumbFrame',
    description: 'Tips, tutorials, and insights for YouTube thumbnail strategy. Learn how to create thumbnails that actually get clicks.',
    url: 'https://thumbframe.com/blog',
  });

  useEffect(() => {
    fetch(`${API}/api/blog/posts`)
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const categories = ['All', ...new Set(posts.map((p) => p.category).filter(Boolean))];
  const filtered = activeCategory === 'All' ? posts : posts.filter((p) => p.category === activeCategory);
  const popular = posts.slice(0, 3);

  const openPost = useCallback((slug) => {
    if (onOpenPost) onOpenPost(slug);
  }, [onOpenPost]);

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <style>{blogStyles}</style>
      <Navbar setPage={setPage} currentPage="blog" />

      <section className="tf-blog-hero">
        <div className="animate-on-scroll" style={{ marginBottom: 16 }}>
          <span className="badge badge-accent">Blog</span>
        </div>
        <h1 className="animate-on-scroll" style={{ animationDelay: '60ms' }}>
          Creator resources.
        </h1>
        <p className="animate-on-scroll" style={{ animationDelay: '120ms' }}>
          Tips, tutorials, and insights for YouTube thumbnail strategy.
        </p>
      </section>

      <div className="tf-blog-layout">
        <main>
          {categories.length > 1 && (
            <div className="tf-blog-filter">
              {categories.map((cat) => (
                <button
                  key={cat}
                  className={`tf-cat-pill${activeCategory === cat ? ' active' : ''}`}
                  onClick={() => setActiveCategory(cat)}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {loading ? (
            <><div className="tf-blog-skeleton" /><div className="tf-blog-skeleton" /><div className="tf-blog-skeleton" /></>
          ) : filtered.length === 0 ? (
            <div className="tf-blog-empty">
              {activeCategory === 'All' ? 'No posts yet — check back soon.' : `No posts in "${activeCategory}" yet.`}
            </div>
          ) : (
            <div className="tf-blog-posts">
              {filtered.map((post) => (
                <article
                  key={post.slug}
                  className="tf-blog-card animate-on-scroll"
                  onClick={() => openPost(post.slug)}
                  role="link"
                  tabIndex={0}
                  onKeyDown={(e) => e.key === 'Enter' && openPost(post.slug)}
                >
                  <div className="tf-blog-card-img">
                    {post.heroImage
                      ? <img src={post.heroImage} alt={post.title} loading="lazy" />
                      : <div className="tf-blog-card-img-placeholder">{CAT_ICONS[post.category] || '✦'}</div>
                    }
                  </div>
                  <div className="tf-blog-card-body">
                    <div>
                      <div className="tf-blog-cat-badge">{post.category}</div>
                      <div className="tf-blog-card-title">{post.title}</div>
                      <p className="tf-blog-card-excerpt">{post.metaDescription}</p>
                    </div>
                    <div className="tf-blog-card-meta">
                      <span>{post.author || 'Kaden'}</span>
                      <span className="tf-meta-dot">·</span>
                      <span>{formatDate(post.publishedAt)}</span>
                      <span className="tf-meta-dot">·</span>
                      <span>{post.readTimeMinutes} min read</span>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </main>

        <aside className="tf-blog-sidebar">
          {categories.length > 1 && (
            <div className="tf-sidebar-card">
              <div className="tf-sidebar-label">Categories</div>
              <div className="tf-sidebar-cat-list">
                {categories.map((cat) => {
                  const count = cat === 'All' ? posts.length : posts.filter((p) => p.category === cat).length;
                  return (
                    <button
                      key={cat}
                      className={`tf-sidebar-cat-btn${activeCategory === cat ? ' active' : ''}`}
                      onClick={() => setActiveCategory(cat)}
                    >
                      <span>{cat}</span>
                      <span className="tf-sidebar-count">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {popular.length > 0 && (
            <div className="tf-sidebar-card">
              <div className="tf-sidebar-label">Popular posts</div>
              <div className="tf-sidebar-popular-list">
                {popular.map((post, i) => (
                  <div key={post.slug} className="tf-sidebar-popular-item" onClick={() => openPost(post.slug)}>
                    <div className="tf-sidebar-popular-num">0{i + 1}</div>
                    <div className="tf-sidebar-popular-title">{post.title}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="tf-sidebar-card">
            <div className="tf-sidebar-label">Newsletter</div>
            <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 14 }}>
              Thumbnail tips, new features, and creator resources — weekly.
            </p>
            {subscribed ? (
              <p style={{ fontSize: 13, color: '#22c55e', fontWeight: 600 }}>✓ You're on the list!</p>
            ) : (
              <>
                <input className="tf-newsletter-input" type="email" placeholder="your@email.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                <button className="tf-newsletter-btn" onClick={() => { if (email.includes('@')) setSubscribed(true); }}>Subscribe</button>
              </>
            )}
          </div>
        </aside>
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
