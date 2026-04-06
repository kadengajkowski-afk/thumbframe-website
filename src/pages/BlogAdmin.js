import React, { useState, useEffect, useCallback } from 'react';

const API = process.env.REACT_APP_API_URL || '';

/* ── Markdown preview (reuse same lightweight renderer) ────────────────── */
function parseMarkdownPreview(md) {
  if (!md) return '';
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return md
    .replace(/```(\w+)?\n([\s\S]*?)```/g, (_, lang, code) =>
      `<pre style="background:#0d0d0d;border:1px solid #222;border-radius:8px;padding:14px;overflow:auto;font-size:13px;margin:12px 0"><code>${esc(code.trim())}</code></pre>`)
    .replace(/^### (.+)$/gm, '<h3 style="font-size:18px;font-weight:700;margin:1.5em 0 0.5em;color:#f4f4f5">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 style="font-size:22px;font-weight:700;margin:1.8em 0 0.5em;color:#f4f4f5;border-top:1px solid #202020;padding-top:0.5em">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 style="font-size:28px;font-weight:800;margin:1em 0 0.5em;color:#f4f4f5">$1</h1>')
    .replace(/^> (.+)$/gm, '<blockquote style="border-left:3px solid #f97316;margin:1em 0;padding:8px 16px;background:rgba(249,115,22,0.04);font-style:italic">$1</blockquote>')
    .replace(/^---$/gm, '<hr style="border:none;border-top:1px solid #202020;margin:1.5em 0">')
    .replace(/^[-*] (.+)$/gm, '<li style="margin-bottom:6px">$1</li>')
    .replace(/(<li[^>]*>[\s\S]*?<\/li>)/g, '<ul style="padding-left:20px;margin:0 0 1em">$1</ul>')
    .replace(/\*\*(.+?)\*\*/g, '<strong style="color:#f4f4f5">$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code style="background:#1c1c1c;border:1px solid #2d2d2d;border-radius:4px;padding:2px 5px;font-size:0.875em;color:#f97316">$1</code>')
    .split('\n\n')
    .map((block) => {
      const t = block.trim();
      if (!t) return '';
      if (/^<(h[1-6]|ul|ol|blockquote|pre|hr)/.test(t)) return t;
      return `<p style="margin:0 0 1em;line-height:1.7;color:#a1a1aa">${t.replace(/\n/g, '<br>')}</p>`;
    })
    .join('\n');
}

const CATEGORIES = ['Tutorial', 'Guide', 'Tips', 'Comparison', 'Case Study', 'Feature', 'News'];

const BLANK_FORM = {
  title: '', slug: '', category: '', heroImage: '', body: '',
  metaDescription: '', tags: '', status: 'draft',
  publishedAt: new Date().toISOString().split('T')[0],
  readTimeMinutes: 5, author: 'Kaden, Founder of ThumbFrame',
};

function slugify(str) {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

function formatDate(iso) {
  if (!iso) return '—';
  try { return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }); }
  catch { return iso; }
}

const adminStyles = `
  .tf-admin-root {
    background: #0a0a0a;
    min-height: 100vh;
    color: #f4f4f5;
    font-family: -apple-system, BlinkMacSystemFont, 'Inter', sans-serif;
  }
  .tf-admin-topbar {
    height: 56px;
    background: #0f0f0f;
    border-bottom: 1px solid #1c1c1c;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    position: sticky;
    top: 0;
    z-index: 100;
  }
  .tf-admin-logo {
    font-size: 16px;
    font-weight: 700;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tf-admin-logo span { color: #f97316; }
  .tf-admin-content {
    max-width: 1200px;
    margin: 0 auto;
    padding: 40px 24px;
  }
  .tf-admin-header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 32px;
    gap: 12px;
    flex-wrap: wrap;
  }
  .tf-admin-title {
    font-size: 24px;
    font-weight: 700;
    letter-spacing: -0.02em;
  }
  .tf-admin-actions { display: flex; gap: 10px; flex-wrap: wrap; }
  .tf-admin-btn {
    padding: 9px 18px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    font-family: inherit;
    transition: all 0.15s;
  }
  .tf-admin-btn-primary { background: #f97316; color: #fff; }
  .tf-admin-btn-primary:hover { background: #e55f00; }
  .tf-admin-btn-secondary {
    background: none;
    border: 1px solid #2d2d2d;
    color: #a1a1aa;
  }
  .tf-admin-btn-secondary:hover { border-color: #f97316; color: #f97316; }
  .tf-admin-btn-ghost {
    background: none;
    border: 1px solid #1c1c1c;
    color: #52525b;
  }
  .tf-admin-btn-ghost:hover { border-color: #3f3f46; color: #a1a1aa; }
  .tf-admin-btn:disabled { opacity: 0.4; cursor: not-allowed; }

  /* ── Posts table ─────────────────────────────── */
  .tf-posts-table {
    border: 1px solid #1c1c1c;
    border-radius: 10px;
    overflow: hidden;
  }
  .tf-posts-table-header {
    display: grid;
    grid-template-columns: 1fr 120px 140px 100px 80px;
    padding: 12px 20px;
    background: #0f0f0f;
    border-bottom: 1px solid #1c1c1c;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #52525b;
    gap: 16px;
  }
  .tf-posts-row {
    display: grid;
    grid-template-columns: 1fr 120px 140px 100px 80px;
    padding: 16px 20px;
    border-bottom: 1px solid #141414;
    gap: 16px;
    align-items: center;
    transition: background 0.15s;
    cursor: pointer;
  }
  .tf-posts-row:last-child { border-bottom: none; }
  .tf-posts-row:hover { background: #0f0f0f; }
  .tf-posts-row-title { font-size: 14px; font-weight: 500; color: #e4e4e7; line-height: 1.3; }
  .tf-posts-row-cat { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.08em; color: #f97316; }
  .tf-posts-row-date { font-size: 12px; color: #52525b; }
  .tf-posts-row-time { font-size: 12px; color: #52525b; }
  .tf-status-badge {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 3px 9px;
    border-radius: 100px;
  }
  .tf-status-published { background: rgba(34,197,94,0.12); color: #22c55e; }
  .tf-status-draft { background: rgba(161,161,170,0.12); color: #71717a; }
  .tf-status-scheduled { background: rgba(234,179,8,0.12); color: #eab308; }
  @media (max-width: 720px) {
    .tf-posts-table-header { grid-template-columns: 1fr 80px; }
    .tf-posts-row { grid-template-columns: 1fr 80px; }
    .tf-posts-row > *:not(:nth-child(1)):not(:nth-child(5)) { display: none; }
  }

  /* ── Editor ──────────────────────────────────── */
  .tf-editor-overlay {
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.7);
    z-index: 200;
    backdrop-filter: blur(4px);
    display: flex;
    align-items: stretch;
    justify-content: center;
    padding: 0;
    overflow: auto;
  }
  .tf-editor-panel {
    background: #0a0a0a;
    width: 100%;
    max-width: 1440px;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
  }
  .tf-editor-topbar {
    height: 56px;
    background: #0f0f0f;
    border-bottom: 1px solid #1c1c1c;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 0 24px;
    flex-shrink: 0;
  }
  .tf-editor-title-input {
    font-size: 22px;
    font-weight: 700;
    background: none;
    border: none;
    color: #f4f4f5;
    outline: none;
    flex: 1;
    font-family: inherit;
    letter-spacing: -0.02em;
  }
  .tf-editor-title-input::placeholder { color: #3f3f46; }
  .tf-editor-body {
    flex: 1;
    display: grid;
    grid-template-columns: 280px 1fr 1fr;
    overflow: hidden;
  }
  @media (max-width: 900px) {
    .tf-editor-body { grid-template-columns: 1fr; }
  }
  .tf-editor-sidebar {
    border-right: 1px solid #1c1c1c;
    padding: 24px;
    overflow-y: auto;
    background: #0d0d0d;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }
  .tf-editor-main {
    border-right: 1px solid #1c1c1c;
    display: flex;
    flex-direction: column;
  }
  .tf-editor-preview {
    overflow-y: auto;
    padding: 32px 40px;
    background: #0a0a0a;
    font-size: 15px;
    line-height: 1.7;
    color: #a1a1aa;
  }
  .tf-editor-pane-label {
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.1em;
    color: #3f3f46;
    padding: 10px 16px;
    border-bottom: 1px solid #141414;
    background: #0d0d0d;
  }
  .tf-editor-textarea {
    flex: 1;
    background: #0a0a0a;
    border: none;
    outline: none;
    color: #e4e4e7;
    font-size: 14px;
    font-family: 'Menlo', 'Monaco', 'Consolas', monospace;
    line-height: 1.7;
    padding: 24px;
    resize: none;
    min-height: 500px;
  }
  .tf-field-group {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .tf-field-label {
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: #52525b;
  }
  .tf-field-input, .tf-field-select, .tf-field-textarea {
    background: #141414;
    border: 1px solid #1c1c1c;
    border-radius: 7px;
    color: #e4e4e7;
    font-size: 13px;
    font-family: inherit;
    padding: 8px 12px;
    outline: none;
    transition: border-color 0.2s;
    -webkit-appearance: none;
  }
  .tf-field-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='7' viewBox='0 0 10 7'%3E%3Cpath fill='%23555' d='M5 7L0 0h10z'/%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    padding-right: 28px;
    cursor: pointer;
  }
  .tf-field-select option { background: #141414; }
  .tf-field-input:focus, .tf-field-select:focus, .tf-field-textarea:focus {
    border-color: #f97316;
  }
  .tf-field-input::placeholder, .tf-field-textarea::placeholder { color: #3f3f46; }
  .tf-field-textarea { resize: vertical; min-height: 80px; }
  .tf-generate-box {
    background: #0d0d0d;
    border: 1px solid #1c1c1c;
    border-radius: 10px;
    padding: 24px;
    margin-bottom: 24px;
  }
  .tf-generate-box h3 { font-size: 15px; font-weight: 600; margin: 0 0 4px; }
  .tf-generate-box p { font-size: 12px; color: #52525b; margin: 0 0 16px; line-height: 1.5; }
  .tf-ai-loading {
    text-align: center;
    padding: 40px;
    color: #52525b;
    font-size: 14px;
  }
  .tf-ai-loading .spinner {
    width: 28px; height: 28px;
    border: 2px solid #1c1c1c;
    border-top-color: #f97316;
    border-radius: 50%;
    animation: admin-spin 0.7s linear infinite;
    margin: 0 auto 12px;
  }
  @keyframes admin-spin { to { transform: rotate(360deg); } }
  .tf-empty-state {
    text-align: center;
    padding: 64px 24px;
    color: #3f3f46;
  }
  .tf-empty-state h3 { font-size: 18px; margin-bottom: 8px; color: #52525b; }
  .tf-empty-state p { font-size: 14px; }
  .tf-toast {
    position: fixed;
    bottom: 24px;
    right: 24px;
    padding: 12px 20px;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    z-index: 999;
    animation: toast-in 0.2s ease;
  }
  .tf-toast-success { background: #166534; color: #bbf7d0; border: 1px solid #15803d; }
  .tf-toast-error { background: #7f1d1d; color: #fecaca; border: 1px solid #b91c1c; }
  @keyframes toast-in { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }
`;

// ── Toast helper ─────────────────────────────────────────────────────────────
function Toast({ message, type }) {
  if (!message) return null;
  return <div className={`tf-toast tf-toast-${type}`}>{message}</div>;
}

// ── Post editor ───────────────────────────────────────────────────────────────
function PostEditor({ post: editPost, adminKey, onSave, onClose }) {
  const [form, setForm] = useState(editPost ? {
    ...editPost,
    tags: Array.isArray(editPost.tags) ? editPost.tags.join(', ') : editPost.tags || '',
    publishedAt: editPost.publishedAt ? editPost.publishedAt.split('T')[0] : new Date().toISOString().split('T')[0],
  } : { ...BLANK_FORM });
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [previewMode, setPreviewMode] = useState(false);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const handleSave = async (status) => {
    if (!form.title.trim()) { showToast('Title is required.', 'error'); return; }
    if (!form.body.trim()) { showToast('Body is required.', 'error'); return; }
    setSaving(true);
    try {
      const slug = form.slug || slugify(form.title);
      const payload = {
        ...form,
        slug,
        status,
        tags: form.tags.split(',').map((t) => t.trim()).filter(Boolean),
        readTimeMinutes: Math.max(1, Math.ceil(form.body.split(' ').length / 200)),
      };
      const isEdit = !!editPost;
      const res = await fetch(`${API}/api/admin/blog/posts${isEdit ? `/${editPost.slug}` : ''}`, {
        method: isEdit ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('Save failed');
      showToast(status === 'published' ? 'Published!' : 'Saved as draft');
      setTimeout(() => onSave(), 1000);
    } catch (err) {
      showToast(err.message || 'Save failed', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="tf-editor-overlay">
      <div className="tf-editor-panel">
        <div className="tf-editor-topbar">
          <input
            className="tf-editor-title-input"
            placeholder="Post title…"
            value={form.title}
            onChange={(e) => {
              set('title', e.target.value);
              if (!editPost) set('slug', slugify(e.target.value));
            }}
          />
          <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
            <button className="tf-admin-btn tf-admin-btn-ghost" onClick={() => setPreviewMode(!previewMode)}>
              {previewMode ? 'Edit' : 'Preview'}
            </button>
            <button className="tf-admin-btn tf-admin-btn-secondary" onClick={() => handleSave('draft')} disabled={saving}>
              Save draft
            </button>
            <button className="tf-admin-btn tf-admin-btn-primary" onClick={() => handleSave('published')} disabled={saving}>
              {saving ? 'Publishing…' : 'Publish'}
            </button>
            <button className="tf-admin-btn tf-admin-btn-ghost" onClick={onClose}>✕</button>
          </div>
        </div>

        <div className="tf-editor-body">
          {/* Sidebar fields */}
          <aside className="tf-editor-sidebar">
            <div className="tf-field-group">
              <label className="tf-field-label">Slug</label>
              <input className="tf-field-input" value={form.slug} onChange={(e) => set('slug', e.target.value)} placeholder="auto-generated" />
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Category</label>
              <select className="tf-field-select" value={form.category} onChange={(e) => set('category', e.target.value)}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Status</label>
              <select className="tf-field-select" value={form.status} onChange={(e) => set('status', e.target.value)}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="scheduled">Scheduled</option>
              </select>
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Publish date</label>
              <input className="tf-field-input" type="date" value={form.publishedAt} onChange={(e) => set('publishedAt', e.target.value)} />
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Author</label>
              <input className="tf-field-input" value={form.author} onChange={(e) => set('author', e.target.value)} />
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Hero image URL</label>
              <input className="tf-field-input" value={form.heroImage} onChange={(e) => set('heroImage', e.target.value)} placeholder="https://…" />
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Meta description</label>
              <textarea className="tf-field-textarea" value={form.metaDescription} onChange={(e) => set('metaDescription', e.target.value)} placeholder="150 chars for Google snippets…" rows={3} />
            </div>
            <div className="tf-field-group">
              <label className="tf-field-label">Tags (comma-separated)</label>
              <input className="tf-field-input" value={form.tags} onChange={(e) => set('tags', e.target.value)} placeholder="youtube, thumbnails, seo" />
            </div>
          </aside>

          {/* Body editor */}
          <div className="tf-editor-main">
            <div className="tf-editor-pane-label">Markdown</div>
            <textarea
              className="tf-editor-textarea"
              value={form.body}
              onChange={(e) => set('body', e.target.value)}
              placeholder="Write your post in markdown…&#10;&#10;## Heading&#10;**bold** *italic* `code`&#10;&#10;- list item"
              spellCheck
            />
          </div>

          {/* Preview */}
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            <div className="tf-editor-pane-label">Preview</div>
            <div
              className="tf-editor-preview"
              dangerouslySetInnerHTML={{ __html: parseMarkdownPreview(form.body) }}
            />
          </div>
        </div>
      </div>
      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}

// ── AI Generator ─────────────────────────────────────────────────────────────
function AIGenerator({ adminKey, onGenerated }) {
  const [keyword, setKeyword] = useState('');
  const [topic, setTopic] = useState('');
  const [wordCount, setWordCount] = useState(1800);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');

  const generate = async () => {
    if (!keyword.trim() || !topic.trim()) { setError('Keyword and topic are required.'); return; }
    setGenerating(true);
    setError('');
    try {
      const res = await fetch(`${API}/api/admin/generate-post`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-admin-key': adminKey },
        body: JSON.stringify({ keyword: keyword.trim(), topic: topic.trim(), wordCount }),
      });
      if (!res.ok) throw new Error('Generation failed');
      const d = await res.json();
      onGenerated(d.draft);
    } catch (err) {
      setError(err.message || 'Generation failed. Try again.');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="tf-generate-box">
      <h3>✦ Generate post with AI</h3>
      <p>Claude writes an SEO-optimized draft. Review before publishing.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <input className="tf-field-input" placeholder="Target keyword (e.g. youtube thumbnail size)" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <input className="tf-field-input" placeholder="Topic / angle (e.g. complete 2025 guide)" value={topic} onChange={(e) => setTopic(e.target.value)} />
        <select className="tf-field-select" value={wordCount} onChange={(e) => setWordCount(Number(e.target.value))}>
          <option value={1500}>~1500 words</option>
          <option value={1800}>~1800 words</option>
          <option value={2200}>~2200 words</option>
          <option value={2500}>~2500 words</option>
        </select>
        {error && <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>}
        <button className="tf-admin-btn tf-admin-btn-primary" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : 'Generate draft →'}
        </button>
        {generating && (
          <div className="tf-ai-loading">
            <div className="spinner" />
            Writing your post… this takes ~30 seconds
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main BlogAdmin ────────────────────────────────────────────────────────────
export default function BlogAdmin({ setPage, user }) {
  const [posts, setPosts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editingPost, setEditingPost] = useState(null); // null = no editor, 'new' = new, {post} = edit
  const [showEditor, setShowEditor] = useState(false);
  const [toast, setToast] = useState(null);

  // Simple admin key: use JWT_SECRET placeholder — in prod, set ADMIN_KEY env var
  const adminKey = process.env.REACT_APP_ADMIN_KEY || 'thumbframe-admin-2024';

  const isAdmin = user?.email === 'kadengajkowski@gmail.com';

  const showToast = (msg, type = 'success') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const loadPosts = useCallback(() => {
    setLoading(true);
    fetch(`${API}/api/admin/blog/posts`, {
      headers: { 'x-admin-key': adminKey },
    })
      .then((r) => r.json())
      .then((d) => { setPosts(d.posts || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [adminKey]);

  useEffect(() => {
    if (isAdmin) loadPosts();
    else setLoading(false);
  }, [isAdmin, loadPosts]);

  useEffect(() => {
    document.title = 'Blog Admin — ThumbFrame';
  }, []);

  if (!isAdmin) {
    return (
      <div className="tf-admin-root" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <style>{adminStyles}</style>
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 40, marginBottom: 16 }}>🔒</div>
          <h2 style={{ fontSize: 22, marginBottom: 8 }}>Admin only</h2>
          <p style={{ color: '#52525b', marginBottom: 24, fontSize: 15 }}>
            {user ? `${user.email} doesn't have admin access.` : 'Please log in with your admin account.'}
          </p>
          <button className="tf-admin-btn tf-admin-btn-secondary" onClick={() => setPage('home')}>← Back to home</button>
        </div>
      </div>
    );
  }

  const handleDelete = async (slug) => {
    if (!window.confirm('Delete this post? This cannot be undone.')) return;
    try {
      const res = await fetch(`${API}/api/admin/blog/posts/${slug}`, {
        method: 'DELETE',
        headers: { 'x-admin-key': adminKey },
      });
      if (!res.ok) throw new Error();
      showToast('Post deleted.');
      loadPosts();
    } catch {
      showToast('Delete failed.', 'error');
    }
  };

  const openEditor = (post = null) => {
    setEditingPost(post);
    setShowEditor(true);
  };

  const handleAIGenerated = (draft) => {
    setEditingPost(draft);
    setShowEditor(true);
  };

  return (
    <div className="tf-admin-root">
      <style>{adminStyles}</style>

      <header className="tf-admin-topbar">
        <div className="tf-admin-logo">
          Thumb<span>Frame</span> Admin
        </div>
        <button className="tf-admin-btn tf-admin-btn-ghost" onClick={() => setPage('blog')} style={{ fontSize: 12 }}>
          ← View blog
        </button>
      </header>

      <div className="tf-admin-content">
        <AIGenerator adminKey={adminKey} onGenerated={handleAIGenerated} />

        <div className="tf-admin-header">
          <h1 className="tf-admin-title">Blog posts</h1>
          <div className="tf-admin-actions">
            <button className="tf-admin-btn tf-admin-btn-primary" onClick={() => openEditor(null)}>
              + New post
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#52525b' }}>Loading…</div>
        ) : posts.length === 0 ? (
          <div className="tf-empty-state">
            <h3>No posts yet</h3>
            <p>Create your first post or generate one with AI above.</p>
          </div>
        ) : (
          <div className="tf-posts-table">
            <div className="tf-posts-table-header">
              <span>Title</span>
              <span>Category</span>
              <span>Published</span>
              <span>Read time</span>
              <span>Status</span>
            </div>
            {posts.map((post) => (
              <div key={post.slug} className="tf-posts-row" onClick={() => openEditor(post)}>
                <div className="tf-posts-row-title">{post.title}</div>
                <div className="tf-posts-row-cat">{post.category}</div>
                <div className="tf-posts-row-date">{formatDate(post.publishedAt)}</div>
                <div className="tf-posts-row-time">{post.readTimeMinutes} min</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className={`tf-status-badge tf-status-${post.status}`}>{post.status}</span>
                  <button
                    className="tf-admin-btn tf-admin-btn-ghost"
                    style={{ padding: '3px 8px', fontSize: 11 }}
                    onClick={(e) => { e.stopPropagation(); handleDelete(post.slug); }}
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showEditor && (
        <PostEditor
          post={editingPost}
          adminKey={adminKey}
          onSave={() => { setShowEditor(false); loadPosts(); showToast('Post saved!'); }}
          onClose={() => setShowEditor(false)}
        />
      )}

      {toast && <Toast message={toast.msg} type={toast.type} />}
    </div>
  );
}
