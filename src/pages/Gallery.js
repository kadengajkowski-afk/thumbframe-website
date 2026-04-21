import React, { useState, useEffect } from 'react';
import '@fontsource-variable/fraunces';
import { Trash2 } from 'lucide-react';
import AuroraScene from '../landing/scenes/AuroraScene';
import Navbar from '../landing/components/layout/Navbar';
import Footer from '../landing/components/layout/Footer';
import { useAuth } from '../context/AuthContext';
import { useSEO } from '../hooks/useSEO';
import supabase from '../supabaseClient';

const FRAUNCES = "'Fraunces Variable', 'Fraunces', Georgia, serif";
const INTER    = "'Inter Variable', 'Inter', system-ui, sans-serif";
const CREAM    = '#faecd0';
const CREAM_50 = 'rgba(250,236,208,0.5)';
const CREAM_70 = 'rgba(250,236,208,0.7)';
const CREAM_80 = 'rgba(250,236,208,0.8)';
const DANGER   = '#e87050';
const BORDER   = 'rgba(255,255,255,0.08)';
const BORDER_HOVER = 'rgba(250,236,208,0.2)';
const CARD_BG  = 'rgba(10,7,20,0.75)';

const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');

// ── Shared styles ─────────────────────────────────────────────────────────────
const cardStyle = {
  background: CARD_BG,
  backdropFilter: 'blur(12px)',
  WebkitBackdropFilter: 'blur(12px)',
  border: `1px solid ${BORDER}`,
  borderRadius: 16,
  padding: 32,
};

const creamBtn = {
  display: 'inline-block',
  padding: '12px 22px',
  borderRadius: 10,
  border: 'none',
  background: 'rgba(255,244,224,1)',
  color: 'rgba(10,7,20,1)',
  fontFamily: INTER,
  fontSize: 14,
  fontWeight: 600,
  cursor: 'pointer',
  transition: 'background-color 0.15s',
};

// ── Helpers ────────────────────────────────────────────────────────────────────
function getProjectName(design) {
  if (design?.name && design.name.trim()) return design.name.trim();
  const fromJson = design?.json_data?.name;
  if (fromJson && typeof fromJson === 'string' && fromJson.trim()) return fromJson.trim();
  if (design?.id) return `Project ${String(design.id).slice(-6)}`;
  return 'Untitled project';
}

function formatEditedDate(value) {
  if (!value) return 'Edited: unknown';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'Edited: unknown';
  const now = Date.now();
  const diffMs = now - d.getTime();
  const min = Math.floor(diffMs / 60000);
  const hr  = Math.floor(diffMs / 3600000);
  const day = Math.floor(diffMs / 86400000);
  if (min < 1)  return 'Edited just now';
  if (min < 60) return `Edited ${min}m ago`;
  if (hr  < 24) return `Edited ${hr}h ago`;
  if (day < 7)  return `Edited ${day}d ago`;
  return `Edited ${d.toLocaleDateString()}`;
}

// ── Delete modal ──────────────────────────────────────────────────────────────
function DeleteDesignModal({ design, onClose, onConfirm, loading }) {
  const name = getProjectName(design);
  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        background: 'rgba(5,3,12,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{ ...cardStyle, maxWidth: 440, width: '100%', fontFamily: INTER }}
      >
        <h3 style={{
          fontFamily: FRAUNCES,
          fontSize: 22,
          fontWeight: 500,
          color: CREAM,
          margin: '0 0 8px',
        }}>
          Delete this design?
        </h3>
        <p style={{
          fontSize: 14,
          color: CREAM_80,
          margin: '0 0 6px',
          fontWeight: 600,
        }}>
          {name}
        </p>
        <p style={{ fontSize: 13, color: CREAM_70, margin: '0 0 24px' }}>
          This can't be undone.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: `1px solid ${BORDER}`,
              background: 'transparent',
              color: CREAM,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: INTER,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: DANGER,
              color: '#fff',
              fontSize: 13,
              fontWeight: 700,
              fontFamily: INTER,
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Deleting…' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Design card ───────────────────────────────────────────────────────────────
function DesignCard({ design, onOpen, onDelete, isDeleting }) {
  const [hover, setHover] = useState(false);
  const name = getProjectName(design);

  return (
    <div
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      onClick={() => !isDeleting && onOpen(design.id)}
      style={{
        position: 'relative',
        background: CARD_BG,
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: `1px solid ${hover ? BORDER_HOVER : BORDER}`,
        borderRadius: 12,
        padding: 12,
        cursor: isDeleting ? 'wait' : 'pointer',
        transform: hover && !isDeleting ? 'translateY(-2px)' : 'translateY(0)',
        transition: 'transform 0.15s, border-color 0.15s, opacity 0.15s',
        opacity: isDeleting ? 0.55 : 1,
        fontFamily: INTER,
      }}
    >
      {/* Thumbnail */}
      <div style={{
        aspectRatio: '16/9',
        background: 'rgba(5,3,12,0.5)',
        borderRadius: 8,
        overflow: 'hidden',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        {design.thumbnail ? (
          <img
            src={design.thumbnail}
            alt={name}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <div style={{ color: CREAM_50, fontSize: 12 }}>No preview</div>
        )}
      </div>

      {/* Info */}
      <div style={{ padding: '12px 4px 4px' }}>
        <div
          title={name}
          style={{
            fontSize: 15,
            fontWeight: 600,
            color: CREAM,
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            marginBottom: 4,
          }}
        >
          {name}
        </div>
        <div style={{ fontSize: 12, color: CREAM_50 }}>
          {formatEditedDate(design.last_edited || design.updated_at || design.created_at)}
        </div>
      </div>

      {/* Delete icon — hover only */}
      <button
        onClick={(e) => { e.stopPropagation(); onDelete(design); }}
        aria-label="Delete design"
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          width: 32,
          height: 32,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: 8,
          border: `1px solid ${BORDER}`,
          background: 'rgba(5,3,12,0.75)',
          color: DANGER,
          cursor: 'pointer',
          opacity: hover ? 1 : 0,
          pointerEvents: hover ? 'auto' : 'none',
          transition: 'opacity 0.15s',
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────────────
export default function Gallery({ setPage }) {
  const { user } = useAuth();
  const [designs, setDesigns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [toDelete, setToDelete] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useSEO({
    title: 'Your designs — ThumbFrame',
    description: 'Your saved ThumbFrame designs.',
  });

  // Fetch designs — same endpoint the legacy Dashboard used.
  useEffect(() => {
    const userEmail = user?.email;
    if (!userEmail) {
      setDesigns([]);
      setLoadError('');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setLoadError('');

    supabase.auth.getSession().then(({ data: { session } }) => {
      const authToken = session?.access_token;
      return fetch(`${API_URL}/designs`, {
        signal: controller.signal,
        headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
      });
    })
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))))
      .then((payload) => {
        const list = Array.isArray(payload) ? payload
          : Array.isArray(payload?.designs) ? payload.designs
          : Array.isArray(payload?.data) ? payload.data : [];
        setDesigns(list);
        setLoading(false);
      })
      .catch((err) => {
        if (err.name === 'AbortError') return;
        setDesigns([]);
        setLoadError('Could not load saved designs right now.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [user?.email]);

  function handleOpen(id) {
    window.history.replaceState(null, '', `/editor?project=${encodeURIComponent(id)}`);
    setPage('editor');
  }

  function handleNewDesign() {
    window.history.replaceState(null, '', '/editor');
    setPage('editor');
  }

  async function handleConfirmDelete() {
    if (!toDelete?.id) return;
    setDeletingId(toDelete.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) throw new Error('No auth token');
      const res = await fetch(`${API_URL}/designs/${encodeURIComponent(toDelete.id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const body = await res.text().catch(() => '');
        throw new Error(`Delete failed (${res.status}): ${body}`);
      }
      setDesigns((prev) => prev.filter((d) => d.id !== toDelete.id));
      setToDelete(null);
    } catch (err) {
      console.error('[Gallery] delete error:', err.message);
      alert(`Could not delete design: ${err.message}`);
    } finally {
      setDeletingId(null);
    }
  }

  const count = designs.length;
  const isPro = !!user?.is_pro;

  return (
    <div style={{
      minHeight: '100vh',
      position: 'relative',
      fontFamily: INTER,
      color: CREAM,
    }}>
      <AuroraScene />
      <Navbar onNavigate={setPage} />

      <div style={{
        position: 'relative',
        zIndex: 1,
        maxWidth: 1180,
        margin: '0 auto',
        padding: '120px 24px 96px',
      }}>
        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'space-between',
          gap: 20,
          flexWrap: 'wrap',
          marginBottom: 40,
        }}>
          <div>
            <h1 style={{
              fontFamily: FRAUNCES,
              fontSize: 'clamp(36px, 5vw, 52px)',
              fontWeight: 500,
              letterSpacing: '-0.02em',
              color: CREAM,
              lineHeight: 1.05,
              margin: '0 0 12px',
              textShadow: '0 4px 32px rgba(0,0,0,0.5)',
            }}>
              Your designs
            </h1>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              flexWrap: 'wrap',
            }}>
              <span style={{ fontSize: 15, color: CREAM_70 }}>
                {count} design{count === 1 ? '' : 's'}
                {isPro ? ' · Unlimited storage' : ''}
              </span>
              <PlanBadge isPro={isPro} />
            </div>
          </div>

          <button
            onClick={handleNewDesign}
            style={creamBtn}
            onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,244,224,1)')}
          >
            + New design
          </button>
        </div>

        {/* Body */}
        {loading ? (
          <div style={{ ...cardStyle, textAlign: 'center', color: CREAM_70, fontSize: 14 }}>
            Loading designs…
          </div>
        ) : loadError ? (
          <div style={{ ...cardStyle, textAlign: 'center' }}>
            <h2 style={{
              fontFamily: FRAUNCES, fontSize: 22, fontWeight: 500, color: CREAM,
              margin: '0 0 8px',
            }}>
              Saved designs are unavailable
            </h2>
            <p style={{ fontSize: 14, color: CREAM_70, margin: 0, lineHeight: 1.6 }}>
              {loadError}
            </p>
          </div>
        ) : count === 0 ? (
          <EmptyState onOpenEditor={handleNewDesign} />
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 20,
          }}>
            {designs.map((d) => (
              <DesignCard
                key={d.id}
                design={d}
                onOpen={handleOpen}
                onDelete={setToDelete}
                isDeleting={deletingId === d.id}
              />
            ))}
          </div>
        )}
      </div>

      {toDelete && (
        <DeleteDesignModal
          design={toDelete}
          onClose={() => setToDelete(null)}
          onConfirm={handleConfirmDelete}
          loading={deletingId === toDelete?.id}
        />
      )}

      <Footer setPage={setPage} />
    </div>
  );
}

// ── Plan badge pill ───────────────────────────────────────────────────────────
function PlanBadge({ isPro }) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      padding: '3px 12px',
      borderRadius: 999,
      background: isPro ? 'rgba(255,244,224,0.92)' : 'rgba(255,255,255,0.06)',
      color: isPro ? '#f97316' : CREAM_70,
      fontFamily: INTER,
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      border: isPro ? 'none' : `1px solid ${BORDER}`,
    }}>
      {isPro ? 'Pro' : 'Free'}
    </span>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────
function EmptyState({ onOpenEditor }) {
  return (
    <div style={{
      ...cardStyle,
      maxWidth: 520,
      margin: '40px auto 0',
      textAlign: 'center',
      padding: 48,
    }}>
      <h2 style={{
        fontFamily: FRAUNCES,
        fontSize: 28,
        fontWeight: 500,
        color: CREAM,
        letterSpacing: '-0.01em',
        margin: '0 0 10px',
      }}>
        Your gallery is empty
      </h2>
      <p style={{
        fontFamily: INTER,
        fontSize: 15,
        color: CREAM_70,
        margin: '0 0 28px',
        lineHeight: 1.6,
      }}>
        Start creating and your designs will auto-save here.
      </p>
      <button
        onClick={onOpenEditor}
        style={creamBtn}
        onMouseEnter={(e) => (e.currentTarget.style.background = '#ffffff')}
        onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,244,224,1)')}
      >
        Open editor →
      </button>
    </div>
  );
}
