import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useSEO } from '../hooks/useSEO';

const API = process.env.REACT_APP_API_URL || '';

/* ── Simple markdown → HTML renderer (no external dependency) ─────────────
   Handles: headings, bold, italic, code blocks, inline code, lists,
            blockquotes, horizontal rules, paragraphs, links, images.
   For production a full marked.js import would replace this.           */
function parseMarkdown(md) {
  if (!md) return '';
  let html = md
    // Fenced code blocks
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre class="tf-code-block"><code class="language-${lang || 'text'}">${escHtml(code.trim())}</code></pre>`)
    // H1–H4
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Blockquote
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // HR
    .replace(/^---$/gm, '<hr>')
    // Unordered lists
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>[\s\S]*?<\/li>(?:\n<li>[\s\S]*?<\/li>)*)/g, '<ul>$1</ul>')
    // Ordered lists
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Bold + italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="tf-inline-code">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    // Images
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy" style="max-width:100%;border-radius:8px;margin:24px 0">')
    // Paragraphs — wrap lines that aren't already in block tags
    .split('\n\n')
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return '';
      if (/^<(h[1-6]|ul|ol|li|pre|blockquote|hr|img)/.test(trimmed)) return trimmed;
      return `<p>${trimmed.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
  return html;
}

function escHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

const postStyles = `
  /* ── Hero ─────────────────────────────────────────── */
  .tf-post-hero {
    min-height: 420px;
    display: flex;
    align-items: flex-end;
    position: relative;
    overflow: hidden;
    background: #0d0d0d;
    padding: 0;
  }
  .tf-post-hero-bg {
    position: absolute;
    inset: 0;
    background: linear-gradient(135deg, rgba(255,107,0,0.08) 0%, transparent 60%);
  }
  .tf-post-hero-img {
    position: absolute;
    inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    opacity: 0.25;
  }
  .tf-post-hero-overlay {
    position: absolute;
    inset: 0;
    background: linear-gradient(to top, rgba(10,10,10,0.95) 0%, rgba(10,10,10,0.4) 50%, transparent 100%);
  }
  .tf-post-hero-content {
    position: relative;
    width: 100%;
    max-width: 800px;
    margin: 0 auto;
    padding: 160px 24px 56px;
  }
  .tf-post-cat-badge {
    display: inline-block;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--accent);
    background: rgba(255,107,0,0.12);
    border-radius: 100px;
    padding: 4px 12px;
    margin-bottom: 16px;
    font-family: var(--font-body);
  }
  .tf-post-title {
    font-family: var(--font-display);
    font-size: clamp(28px, 4vw, 46px);
    font-weight: 800;
    line-height: 1.1;
    letter-spacing: -0.03em;
    color: var(--text-primary);
    margin: 0 0 20px;
  }
  .tf-post-byline {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
  }
  .tf-post-author-avatar {
    width: 36px; height: 36px;
    border-radius: 50%;
    background: rgba(255,107,0,0.15);
    border: 1.5px solid rgba(255,107,0,0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
  }
  .tf-post-byline-text {
    font-size: 14px;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .tf-post-byline-name {
    font-weight: 600;
    color: var(--text-primary);
    font-size: 14px;
  }
  .tf-post-byline-meta {
    font-size: 12px;
    color: var(--text-muted);
    display: flex;
    gap: 8px;
  }
  .tf-meta-sep { opacity: 0.4; }

  /* ── Article body ─────────────────────────────────── */
  .tf-post-body-wrap {
    max-width: 760px;
    margin: 0 auto;
    padding: 56px 24px 80px;
  }
  .tf-post-body {
    font-size: 17px;
    line-height: 1.78;
    color: var(--text-secondary);
  }
  .tf-post-body h1, .tf-post-body h2, .tf-post-body h3, .tf-post-body h4 {
    font-family: var(--font-display);
    color: var(--text-primary);
    letter-spacing: -0.02em;
    margin: 2em 0 0.6em;
    line-height: 1.2;
  }
  .tf-post-body h2 { font-size: 26px; padding-top: 8px; border-top: 1px solid var(--border); }
  .tf-post-body h3 { font-size: 20px; }
  .tf-post-body h4 { font-size: 17px; }
  .tf-post-body p {
    margin: 0 0 1.4em;
    color: var(--text-secondary);
  }
  .tf-post-body strong { color: var(--text-primary); font-weight: 600; }
  .tf-post-body em { font-style: italic; }
  .tf-post-body a { color: var(--accent); text-decoration: underline; text-decoration-color: rgba(255,107,0,0.4); }
  .tf-post-body a:hover { text-decoration-color: var(--accent); }
  .tf-post-body ul, .tf-post-body ol {
    margin: 0 0 1.4em 0;
    padding-left: 24px;
  }
  .tf-post-body li { margin-bottom: 8px; }
  .tf-post-body blockquote {
    border-left: 3px solid var(--accent);
    margin: 1.6em 0;
    padding: 12px 20px;
    background: rgba(255,107,0,0.04);
    border-radius: 0 8px 8px 0;
    font-style: italic;
    color: var(--text-primary);
  }
  .tf-post-body hr {
    border: none;
    border-top: 1px solid var(--border);
    margin: 2.5em 0;
  }
  .tf-code-block {
    background: #0d0d0d;
    border: 1px solid var(--border);
    border-radius: 10px;
    padding: 20px 24px;
    overflow-x: auto;
    margin: 1.4em 0;
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 14px;
    line-height: 1.6;
    color: #e4e4e7;
  }
  .tf-inline-code {
    background: #1c1c1c;
    border: 1px solid var(--border);
    border-radius: 4px;
    padding: 2px 6px;
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    font-size: 0.875em;
    color: var(--accent);
  }

  /* ── Share buttons ─────────────────────────────────── */
  .tf-post-share {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 24px 0;
    border-top: 1px solid var(--border);
    border-bottom: 1px solid var(--border);
    margin-bottom: 64px;
    flex-wrap: wrap;
  }
  .tf-post-share-label {
    font-size: 13px;
    font-weight: 600;
    color: var(--text-muted);
    text-transform: uppercase;
    letter-spacing: 0.08em;
    margin-right: 4px;
  }
  .tf-share-btn {
    padding: 7px 16px;
    border-radius: 8px;
    border: 1px solid var(--border);
    background: none;
    color: var(--text-secondary);
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    font-family: var(--font-body);
    transition: all 0.15s;
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .tf-share-btn:hover { border-color: var(--accent); color: var(--accent); }
  .tf-share-copied { color: #22c55e !important; border-color: #22c55e !important; }

  /* ── Related posts ─────────────────────────────────── */
  .tf-post-related-title {
    font-family: var(--font-display);
    font-size: 22px;
    font-weight: 700;
    letter-spacing: -0.02em;
    margin-bottom: 24px;
  }
  .tf-post-related-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 20px;
    margin-bottom: 80px;
  }
  @media (max-width: 720px) {
    .tf-post-related-grid { grid-template-columns: 1fr; }
  }
  .tf-post-related-card {
    background: var(--bg-secondary);
    border: 1px solid var(--border);
    border-radius: 10px;
    overflow: hidden;
    cursor: pointer;
    transition: border-color 0.2s, transform 0.2s;
  }
  .tf-post-related-card:hover {
    border-color: var(--border-hover);
    transform: translateY(-2px);
  }
  .tf-post-related-thumb {
    aspect-ratio: 16/9;
    background: #141414;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 24px;
    opacity: 0.35;
  }
  .tf-post-related-body { padding: 16px; }
  .tf-post-related-cat { font-size: 10px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--accent); margin-bottom: 6px; }
  .tf-post-related-title-text { font-size: 14px; font-weight: 600; color: var(--text-primary); line-height: 1.3; letter-spacing: -0.01em; }

  /* ── CTA ──────────────────────────────────────────── */
  .tf-post-cta {
    background: linear-gradient(135deg, rgba(255,107,0,0.08) 0%, transparent 60%);
    border: 1px solid rgba(255,107,0,0.15);
    border-radius: 16px;
    padding: 48px;
    text-align: center;
    margin-bottom: 80px;
  }
  .tf-post-cta h3 {
    font-family: var(--font-display);
    font-size: 26px;
    font-weight: 800;
    letter-spacing: -0.02em;
    margin: 0 0 12px;
  }
  .tf-post-cta p {
    font-size: 16px;
    color: var(--text-secondary);
    max-width: 440px;
    margin: 0 auto 28px;
    line-height: 1.6;
  }
`;

const CAT_ICONS = {
  Tutorial: '📖', Guide: '📋', Comparison: '⚖️',
  'Case Study': '📈', Tips: '💡', Feature: '✨', News: '📣',
};

export default function BlogPost({ slug, onBack, setPage }) {
  const [post, setPost] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    window.scrollTo({ top: 0 });
    setLoading(true);
    fetch(`${API}/api/blog/posts/${slug}`)
      .then((r) => r.json())
      .then((d) => {
        setPost(d.post || null);
        setRelated(d.related || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [slug]);

  useSEO({
    title: post ? `${post.title} — ThumbFrame Blog` : 'Blog — ThumbFrame',
    description: post?.metaDescription || '',
    url: post ? `https://thumbframe.com/blog/${post.slug}` : undefined,
    type: 'article',
    jsonLd: post ? {
      '@context': 'https://schema.org',
      '@type': 'Article',
      headline: post.title,
      description: post.metaDescription,
      author: { '@type': 'Person', name: 'Kaden', url: 'https://thumbframe.com/about' },
      publisher: {
        '@type': 'Organization',
        name: 'ThumbFrame',
        url: 'https://thumbframe.com',
        logo: { '@type': 'ImageObject', url: 'https://thumbframe.com/logo192.png' },
      },
      datePublished: post.publishedAt,
      url: `https://thumbframe.com/blog/${post.slug}`,
      image: post.heroImage || 'https://thumbframe.com/og-default.png',
    } : undefined,
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const shareTwitter = () => {
    const url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(window.location.href)}`;
    window.open(url, '_blank', 'noopener');
  };

  if (loading) {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <style>{postStyles}</style>
        <Navbar setPage={setPage} currentPage="blog" />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '160px 24px 80px' }}>
          {[1, 2, 3, 4].map((n) => (
            <div key={n} style={{ height: 20, background: '#1c1c1c', borderRadius: 6, marginBottom: 16, width: `${70 + n * 7}%`, animation: 'blog-shimmer 1.4s infinite', backgroundSize: '200% 100%', backgroundImage: 'linear-gradient(90deg, #141414 25%, #1c1c1c 50%, #141414 75%)' }} />
          ))}
        </div>
      </div>
    );
  }

  if (!post) {
    return (
      <div style={{ background: 'var(--bg-primary)', minHeight: '100vh' }}>
        <style>{postStyles}</style>
        <Navbar setPage={setPage} currentPage="blog" />
        <div style={{ maxWidth: 760, margin: '0 auto', padding: '160px 24px 80px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28, marginBottom: 12 }}>Post not found</h1>
          <p style={{ color: 'var(--text-muted)', marginBottom: 32 }}>This post doesn't exist or has been removed.</p>
          <button className="btn-primary" onClick={onBack}>← Back to blog</button>
        </div>
        <Footer setPage={setPage} />
      </div>
    );
  }

  return (
    <div style={{ background: 'var(--bg-primary)', minHeight: '100vh', color: 'var(--text-primary)', fontFamily: 'var(--font-body)' }}>
      <style>{postStyles}</style>
      <Navbar setPage={setPage} currentPage="blog" />

      {/* Hero */}
      <header className="tf-post-hero">
        <div className="tf-post-hero-bg" />
        {post.heroImage && <img className="tf-post-hero-img" src={post.heroImage} alt={post.title} loading="lazy" />}
        <div className="tf-post-hero-overlay" />
        <div className="tf-post-hero-content">
          <button
            onClick={onBack}
            style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 13, padding: 0, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 6 }}
          >
            ← Back to blog
          </button>
          <div className="tf-post-cat-badge">{post.category}</div>
          <h1 className="tf-post-title">{post.title}</h1>
          <div className="tf-post-byline">
            <div className="tf-post-author-avatar">👤</div>
            <div className="tf-post-byline-text">
              <span className="tf-post-byline-name">{post.author || 'Kaden, Founder of ThumbFrame'}</span>
              <span className="tf-post-byline-meta">
                <span>{formatDate(post.publishedAt)}</span>
                <span className="tf-meta-sep">·</span>
                <span>{post.readTimeMinutes} min read</span>
                {post.tags?.length > 0 && (
                  <>
                    <span className="tf-meta-sep">·</span>
                    <span>{post.tags.slice(0, 2).join(', ')}</span>
                  </>
                )}
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Article body */}
      <div className="tf-post-body-wrap">
        <div
          className="tf-post-body"
          dangerouslySetInnerHTML={{ __html: parseMarkdown(post.body) }}
        />

        {/* Share */}
        <div className="tf-post-share">
          <span className="tf-post-share-label">Share</span>
          <button className="tf-share-btn" onClick={shareTwitter}>𝕏 Twitter</button>
          <button className={`tf-share-btn${copied ? ' tf-share-copied' : ''}`} onClick={handleCopy}>
            {copied ? '✓ Copied!' : '🔗 Copy link'}
          </button>
        </div>

        {/* CTA */}
        <div className="tf-post-cta">
          <h3>Make better thumbnails, right now.</h3>
          <p>ThumbFrame gives you AI background removal, CTR scoring, and a full professional editor — free to start.</p>
          <button className="btn-primary" onClick={() => setPage('editor')}>
            Start creating free →
          </button>
        </div>

        {/* Related posts */}
        {related.length > 0 && (
          <>
            <div className="tf-post-related-title">More from the blog</div>
            <div className="tf-post-related-grid">
              {related.map((r) => (
                <div key={r.slug} className="tf-post-related-card" onClick={() => {
                  window.history.pushState(null, '', `/blog/${r.slug}`);
                  window.scrollTo({ top: 0 });
                }}>
                  <div className="tf-post-related-thumb">{CAT_ICONS[r.category] || '✦'}</div>
                  <div className="tf-post-related-body">
                    <div className="tf-post-related-cat">{r.category}</div>
                    <div className="tf-post-related-title-text">{r.title}</div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <Footer setPage={setPage} />
    </div>
  );
}
