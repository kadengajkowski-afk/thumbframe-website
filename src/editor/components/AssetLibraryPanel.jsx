import React, { useState, useEffect, useCallback, useRef } from 'react';
import { processImageFile } from '../utils/imageUpload';
import { apiFetch, API_URL } from '../utils/apiClient';

const PHOTO_CATEGORIES = ['All', 'YouTube', 'Gaming', 'Fitness', 'Tech', 'Nature', 'People', 'Abstract', 'Dark'];

// ── Gradient placeholder cards for unconfigured Unsplash ─────────────────────
const PLACEHOLDER_GRADIENTS = [
  'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  'linear-gradient(135deg, #2d1b69 0%, #11998e 100%)',
  'linear-gradient(135deg, #f97316 0%, #dc2626 100%)',
  'linear-gradient(135deg, #0f4c81 0%, #1a8cff 100%)',
  'linear-gradient(135deg, #134e4a 0%, #065f46 100%)',
  'linear-gradient(135deg, #581c87 0%, #7c3aed 100%)',
];

// ── Spinner ───────────────────────────────────────────────────────────────────
const spinKeyframes = `
@keyframes tf-asset-spin {
  to { transform: rotate(360deg); }
}
`;

function Spinner({ size = 24 }) {
  return (
    <>
      <style>{spinKeyframes}</style>
      <div style={{
        width: size,
        height: size,
        borderRadius: '50%',
        border: `2px solid var(--border-1)`,
        borderTopColor: 'var(--accent)',
        animation: 'tf-asset-spin 0.8s linear infinite',
        flexShrink: 0,
      }} />
    </>
  );
}

// ── Photo card ────────────────────────────────────────────────────────────────
function PhotoCard({ photo, onAdd }) {
  const [hovered, setHovered] = useState(false);
  const [adding, setAdding]   = useState(false);

  const handleAdd = useCallback(async (e) => {
    e.stopPropagation();
    if (adding) return;
    setAdding(true);
    await onAdd(photo);
    setAdding(false);
  }, [photo, onAdd, adding]);

  return (
    <div
      style={{
        position: 'relative',
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: 'pointer',
        breakInside: 'avoid',
        marginBottom: 8,
        background: 'var(--bg-4)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={handleAdd}
    >
      <img
        src={photo.urls.small}
        alt={photo.alt_description || 'Stock photo'}
        loading="lazy"
        style={{
          width: '100%',
          display: 'block',
          borderRadius: 'var(--radius-md)',
          transition: 'opacity 0.2s',
          opacity: hovered ? 0.7 : 1,
        }}
      />

      {/* Hover overlay */}
      {hovered && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(0,0,0,0.45)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          padding: 8,
        }}>
          {photo.user?.name && (
            <span style={{
              color: '#ffffffcc',
              fontSize: 10,
              textAlign: 'center',
              lineHeight: 1.3,
            }}>
              {photo.user.name}
            </span>
          )}
          <button
            onClick={handleAdd}
            style={{
              background: 'var(--accent)',
              color: '#fff',
              border: 'none',
              borderRadius: 'var(--radius-md)',
              padding: '5px 12px',
              fontSize: 12,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
            }}
          >
            {adding ? <Spinner size={12} /> : null}
            {adding ? 'Adding…' : 'Add to Canvas'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Upload thumbnail card ─────────────────────────────────────────────────────
function UploadCard({ upload, onAdd }) {
  const [adding, setAdding] = useState(false);

  const handleAdd = useCallback(async () => {
    if (adding) return;
    setAdding(true);
    await onAdd(upload);
    setAdding(false);
  }, [upload, onAdd, adding]);

  return (
    <div
      onClick={handleAdd}
      style={{
        borderRadius: 'var(--radius-md)',
        overflow: 'hidden',
        cursor: 'pointer',
        background: 'var(--bg-4)',
        border: '1px solid var(--border-1)',
        aspectRatio: '16/9',
        position: 'relative',
      }}
    >
      <img
        src={upload.url || upload.thumbnail_url || upload.src}
        alt={upload.name || 'Upload'}
        loading="lazy"
        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
      />
      {adding && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'rgba(0,0,0,0.5)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Spinner />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function AssetLibraryPanel({ user, onClose }) {
  const [tab, setTab]           = useState('photos');
  const [query, setQuery]       = useState('');
  const [category, setCategory] = useState('All');
  const [photos, setPhotos]     = useState([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState(null);    // null | 'unsplash_not_configured' | 'generic'
  const [uploads, setUploads]   = useState([]);
  const [pngs, setPngs]         = useState([]);
  const [page, setPage]         = useState(1);
  const [hasMore, setHasMore]   = useState(true);
  const [unsplashError, setUnsplashError] = useState(false);

  const sentinelRef   = useRef(null);
  const debounceTimer = useRef(null);
  const observerRef   = useRef(null);

  // ── Fetch stock photos ───────────────────────────────────────────────────
  const fetchPhotos = useCallback(async (searchQuery, cat, pageNum, append = false) => {
    if (loading) return;
    setLoading(true);

    try {
      const q   = searchQuery.trim() || (cat !== 'All' ? cat : 'thumbnail');
      const resp = await apiFetch(`/api/assets/photos?q=${encodeURIComponent(q)}&category=${encodeURIComponent(cat)}&page=${pageNum}&per_page=20`);

      if (!resp.ok) {
        const json = await resp.json().catch(() => ({}));
        if (json.error === 'unsplash_not_configured') {
          setError('unsplash_not_configured');
        } else {
          setPhotos([]);
          setUnsplashError(true);
        }
        setLoading(false);
        return;
      }

      const json = await resp.json();

      if (json.error === 'unsplash_not_configured') {
        setError('unsplash_not_configured');
        setLoading(false);
        return;
      }

      const results    = json.results || json.photos || [];
      const totalPages = json.total_pages || 1;

      setPhotos((prev) => append ? [...prev, ...results] : results);
      setHasMore(totalPages > pageNum);
      setError(null);
    } catch (err) {
      console.error('[AssetLibrary] fetchPhotos failed:', err);
      setPhotos([]);
      setUnsplashError(true);
    } finally {
      setLoading(false);
    }
  }, [loading]);

  // ── Fetch uploads ─────────────────────────────────────────────────────────
  const fetchUploads = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/assets/my-uploads');
      if (!resp.ok) { setUploads([]); setLoading(false); return; }

      const json = await resp.json();
      setUploads(json.uploads || json.assets || []);
    } catch (err) {
      console.error('[AssetLibrary] fetchUploads failed:', err);
      setUploads([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Fetch PNG library ─────────────────────────────────────────────────────
  const fetchPngs = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await apiFetch('/api/assets/png-library');
      if (!resp.ok) { setPngs([]); setLoading(false); return; }
      const json = await resp.json();
      setPngs(json.assets || json.pngs || []);
    } catch (err) {
      console.error('[AssetLibrary] fetchPngs failed:', err);
      setPngs([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // ── Tab switch effects ────────────────────────────────────────────────────
  useEffect(() => {
    if (tab === 'photos') {
      setPhotos([]);
      setPage(1);
      setHasMore(true);
      setError(null);
      setUnsplashError(false);
      fetchPhotos(query, category, 1, false);
    } else if (tab === 'uploads') {
      fetchUploads();
    } else if (tab === 'pngs') {
      fetchPngs();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ── Debounced search / category change ────────────────────────────────────
  useEffect(() => {
    if (tab !== 'photos') return;

    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setPhotos([]);
      setPage(1);
      setHasMore(true);
      setUnsplashError(false);
      fetchPhotos(query, category, 1, false);
    }, 500);

    return () => clearTimeout(debounceTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, category]);

  // ── Infinite scroll via IntersectionObserver ──────────────────────────────
  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();

    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && hasMore && !loading && tab === 'photos') {
          const nextPage = page + 1;
          setPage(nextPage);
          fetchPhotos(query, category, nextPage, true);
        }
      },
      { threshold: 0.1 },
    );

    if (sentinelRef.current) observerRef.current.observe(sentinelRef.current);

    return () => observerRef.current?.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasMore, loading, tab, page, query, category]);

  // ── Add photo to canvas ───────────────────────────────────────────────────
  const handleAddPhoto = useCallback(async (photo) => {
    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: 'Adding photo…' },
    }));

    try {
      // Unsplash download tracking (best-effort)
      apiFetch('/api/assets/photos/download', {
        method: 'POST',
        body: JSON.stringify({ downloadUrl: photo.links?.download }),
      }).catch(() => {});

      // Fetch via proxy to avoid CORS
      const proxyUrl = `${API_URL}/proxy-image?url=${encodeURIComponent(photo.urls.regular)}`;
      const resp     = await fetch(proxyUrl);
      const blob     = await resp.blob();
      const filename = `unsplash-${photo.id}.jpg`;
      const file     = new File([blob], filename, { type: blob.type || 'image/jpeg' });
      await processImageFile(file);
    } catch (err) {
      console.error('[AssetLibrary] handleAddPhoto failed:', err);
      // Fallback: fetch directly
      try {
        const resp = await fetch(photo.urls.regular);
        const blob = await resp.blob();
        const file = new File([blob], `unsplash-${photo.id}.jpg`, { type: 'image/jpeg' });
        await processImageFile(file);
      } catch (err2) {
        console.error('[AssetLibrary] direct fetch fallback failed:', err2);
        window.dispatchEvent(new CustomEvent('tf:toast', {
          detail: { message: 'Could not add photo. Try again.' },
        }));
      }
    }
  }, []);

  // ── Add upload to canvas ──────────────────────────────────────────────────
  const handleAddUpload = useCallback(async (upload) => {
    const imageUrl = upload.url || upload.thumbnail_url || upload.src;
    if (!imageUrl) return;

    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: 'Adding image…' },
    }));

    try {
      const resp = await fetch(imageUrl);
      const blob = await resp.blob();
      const ext  = blob.type.includes('png') ? 'png' : 'jpg';
      const file = new File([blob], upload.name || `upload.${ext}`, { type: blob.type });
      await processImageFile(file);
    } catch (err) {
      console.error('[AssetLibrary] handleAddUpload failed:', err);
      window.dispatchEvent(new CustomEvent('tf:toast', {
        detail: { message: 'Could not add image. Try again.' },
      }));
    }
  }, []);

  // ── Render: not-configured state ──────────────────────────────────────────
  function renderUnsplashNotConfigured() {
    return (
      <div style={{ padding: '24px 0' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
          <p style={{ margin: '0 0 4px', fontWeight: 700, color: 'var(--text-2)', fontSize: 14 }}>
            Stock Photos Require Setup
          </p>
          <p style={{ margin: 0, color: 'var(--text-4)', fontSize: 12, lineHeight: 1.5 }}>
            Add{' '}
            <code style={{ background: 'var(--bg-5)', padding: '1px 5px', borderRadius: 4 }}>
              UNSPLASH_ACCESS_KEY
            </code>{' '}
            to your Railway<br />environment variables to enable 3M+ stock photos.
          </p>
        </div>

        {/* Gradient placeholder grid */}
        <div style={{ columns: 2, columnGap: 8 }}>
          {PLACEHOLDER_GRADIENTS.map((grad, i) => (
            <div
              key={i}
              style={{
                height: i % 2 === 0 ? 110 : 80,
                background: grad,
                borderRadius: 'var(--radius-md)',
                marginBottom: 8,
                breakInside: 'avoid',
                opacity: 0.6,
              }}
            />
          ))}
        </div>
      </div>
    );
  }

  // ── Render: empty state ───────────────────────────────────────────────────
  function renderEmptyState(icon, title, subtitle) {
    return (
      <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-4)' }}>
        <div style={{ fontSize: 36, marginBottom: 12 }}>{icon}</div>
        <p style={{ margin: '0 0 6px', fontWeight: 700, color: 'var(--text-3)', fontSize: 14 }}>{title}</p>
        <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5 }}>{subtitle}</p>
      </div>
    );
  }

  // ── Render: photos tab ────────────────────────────────────────────────────
  function renderPhotos() {
    if (error === 'unsplash_not_configured') return renderUnsplashNotConfigured();

    if (unsplashError) {
      return (
        <div style={{
          textAlign: 'center', padding: '40px 20px',
          color: 'rgba(245,245,247,0.30)',
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>📷</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(245,245,247,0.50)', marginBottom: 6 }}>
            Stock photos not configured
          </div>
          <div style={{ fontSize: 11, lineHeight: 1.6 }}>
            Add UNSPLASH_ACCESS_KEY to Railway environment variables to enable the stock photo library.
          </div>
        </div>
      );
    }

    return (
      <>
        {/* Photo masonry grid */}
        {photos.length === 0 && !loading && (
          <div style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--text-4)', fontSize: 13 }}>
            No results. Try a different search.
          </div>
        )}

        {photos.length > 0 && (
          <div style={{ columns: 2, columnGap: 8 }}>
            {photos.map((photo) => (
              <PhotoCard key={photo.id} photo={photo} onAdd={handleAddPhoto} />
            ))}
          </div>
        )}

        {/* Infinite scroll sentinel */}
        <div ref={sentinelRef} style={{ height: 1 }} />

        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 20 }}>
            <Spinner />
          </div>
        )}

        {/* Unsplash attribution */}
        {photos.length > 0 && !loading && (
          <p style={{ textAlign: 'center', color: 'var(--text-4)', fontSize: 11, marginTop: 12 }}>
            Photos by{' '}
            <a
              href="https://unsplash.com"
              target="_blank"
              rel="noreferrer"
              style={{ color: 'var(--accent)', textDecoration: 'none' }}
            >
              Unsplash
            </a>
          </p>
        )}
      </>
    );
  }

  // ── Render: PNG assets tab ────────────────────────────────────────────────
  function renderPngs() {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner />
        </div>
      );
    }

    if (pngs.length === 0) {
      return renderEmptyState(
        '🎨',
        'PNG Asset Packs Coming Soon',
        'Stickers, shapes, and design elements\nwill appear here once uploaded.',
      );
    }

    return (
      <div style={{ columns: 2, columnGap: 8 }}>
        {pngs.map((png, i) => (
          <div
            key={png.id || i}
            style={{ breakInside: 'avoid', marginBottom: 8 }}
          >
            <img
              src={png.url || png.src}
              alt={png.name || 'PNG asset'}
              loading="lazy"
              onClick={() => handleAddUpload(png)}
              style={{
                width: '100%',
                display: 'block',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                background: 'var(--bg-4)',
              }}
            />
          </div>
        ))}
      </div>
    );
  }

  // ── Render: uploads tab ───────────────────────────────────────────────────
  function renderUploads() {
    if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
          <Spinner />
        </div>
      );
    }

    if (uploads.length === 0) {
      return renderEmptyState(
        '📁',
        'No Uploads Yet',
        'Images you upload to projects will appear here\nfor easy reuse across thumbnails.',
      );
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
        {uploads.map((upload, i) => (
          <UploadCard key={upload.id || i} upload={upload} onAdd={handleAddUpload} />
        ))}
      </div>
    );
  }

  // ── Shared styles ─────────────────────────────────────────────────────────
  const tabStyle = (active) => ({
    flex: 1,
    padding: '8px 4px',
    background: 'none',
    border: 'none',
    borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
    color: active ? 'var(--accent)' : 'var(--text-4)',
    fontWeight: active ? 700 : 400,
    fontSize: 13,
    cursor: 'pointer',
    transition: 'color 0.15s, border-color 0.15s',
    whiteSpace: 'nowrap',
  });

  const pillStyle = (active) => ({
    padding: '5px 12px',
    borderRadius: 20,
    border: `1px solid ${active ? 'var(--accent)' : 'var(--border-1)'}`,
    background: active ? 'var(--accent)' : 'var(--bg-4)',
    color: active ? '#fff' : 'var(--text-3)',
    fontSize: 12,
    fontWeight: active ? 600 : 400,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'all 0.15s',
    flexShrink: 0,
  });

  // ── Root render ───────────────────────────────────────────────────────────
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 200,
        }}
      />

      {/* Slide-in panel */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        width: 380,
        height: '100%',
        background: 'var(--bg-3)',
        borderLeft: '1px solid var(--border-1)',
        zIndex: 201,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 16px 0',
          flexShrink: 0,
        }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>
            Asset Library
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-3)',
              fontSize: 22,
              lineHeight: 1,
              padding: 4,
            }}
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Tab bar */}
        <div style={{
          display: 'flex',
          borderBottom: '1px solid var(--border-1)',
          padding: '0 16px',
          marginTop: 12,
          flexShrink: 0,
        }}>
          <button style={tabStyle(tab === 'photos')}  onClick={() => setTab('photos')}>Stock Photos</button>
          <button style={tabStyle(tab === 'pngs')}    onClick={() => setTab('pngs')}>PNG Assets</button>
          <button style={tabStyle(tab === 'uploads')} onClick={() => setTab('uploads')}>My Uploads</button>
        </div>

        {/* Search bar — photos tab only */}
        {tab === 'photos' && error !== 'unsplash_not_configured' && !unsplashError && (
          <div style={{ padding: '12px 16px 0', flexShrink: 0 }}>
            <div style={{ position: 'relative' }}>
              <svg
                width="14" height="14" viewBox="0 0 24 24"
                fill="none" stroke="var(--text-4)"
                strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}
              >
                <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <input
                type="text"
                placeholder="Search photos…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: '100%',
                  padding: '8px 10px 8px 32px',
                  background: 'var(--bg-4)',
                  border: '1px solid var(--border-1)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-2)',
                  fontSize: 13,
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>
        )}

        {/* Category pills — photos tab only */}
        {tab === 'photos' && error !== 'unsplash_not_configured' && !unsplashError && (
          <div style={{
            display: 'flex',
            gap: 6,
            padding: '10px 16px',
            overflowX: 'auto',
            flexShrink: 0,
            scrollbarWidth: 'none',
          }}>
            {PHOTO_CATEGORIES.map((cat) => (
              <button
                key={cat}
                style={pillStyle(category === cat)}
                onClick={() => setCategory(cat)}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable content area */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '8px 16px 16px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'var(--border-1) transparent',
        }}>
          {tab === 'photos'  && renderPhotos()}
          {tab === 'pngs'    && renderPngs()}
          {tab === 'uploads' && renderUploads()}
        </div>
      </div>
    </>
  );
}
