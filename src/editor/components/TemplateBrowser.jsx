// src/editor/components/TemplateBrowser.jsx
// Phase 11 — Template Browser
// 960px modal. Left: category sidebar. Right: 3-column grid with search + sort.
// Applies via store.applyTemplate (full undo support).

import React, { useState, useCallback, useMemo } from 'react';
import useEditorStore from '../engine/Store';
import { SEED_TEMPLATES, TEMPLATE_CATEGORIES } from '../templates/seedTemplates';

// ── Gradient preview helper ───────────────────────────────────────────────────
function gradientStyle(tpl) {
  const gp = tpl.gradientPreview;
  if (!gp) return 'var(--bg-5)';
  return `linear-gradient(135deg, ${gp.from}, ${gp.to})`;
}

// ── Category pill icon map ────────────────────────────────────────────────────
const CAT_ICONS = {
  All: '◈', Gaming: '🎮', Vlog: '📸', Horror: '💀', Tech: '💻',
  Fitness: '💪', Tutorial: '📋', Reaction: '😮', Music: '🎵',
  Sports: '⚽', General: '✦',
};

// ── TemplateCard ──────────────────────────────────────────────────────────────
function TemplateCard({ template, onSelect }) {
  const [hov, setHov] = useState(false);
  const placeholderCount = template.layers.filter(l => l.placeholder?.required).length;

  return (
    <button
      onClick={() => onSelect(template)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        display: 'flex', flexDirection: 'column',
        background: 'var(--bg-3)',
        border: hov ? '1px solid rgba(249,115,22,0.40)' : '1px solid var(--border-1)',
        borderRadius: 10, overflow: 'hidden', cursor: 'pointer',
        transform: hov ? 'translateY(-2px)' : 'none',
        boxShadow: hov ? '0 6px 20px rgba(0,0,0,0.35)' : '0 2px 8px rgba(0,0,0,0.20)',
        transition: 'all 150ms',
        textAlign: 'left',
        padding: 0,
      }}
    >
      {/* 16:9 Preview */}
      <div style={{
        width: '100%', paddingTop: '56.25%',
        position: 'relative', overflow: 'hidden',
        background: gradientStyle(template),
        flexShrink: 0,
      }}>
        {/* Layer count badge */}
        <div style={{
          position: 'absolute', top: 6, left: 6,
          background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)',
          borderRadius: 4, padding: '2px 6px',
          fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,0.70)',
        }}>
          {template.layers.length} layers
        </div>
        {/* Free badge */}
        {template.is_free && (
          <div style={{
            position: 'absolute', top: 6, right: 6,
            background: 'rgba(34,197,94,0.20)', backdropFilter: 'blur(4px)',
            border: '1px solid rgba(34,197,94,0.35)',
            borderRadius: 4, padding: '2px 6px',
            fontSize: 9, fontWeight: 700, color: '#22c55e',
          }}>FREE</div>
        )}
        {/* Placeholder indicator dots */}
        {placeholderCount > 0 && (
          <div style={{
            position: 'absolute', bottom: 6, left: 6,
            display: 'flex', gap: 3,
          }}>
            {template.layers.filter(l => l.placeholder).map((l, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: l.placeholder.required ? '#f97316' : 'rgba(249,115,22,0.40)',
              }} />
            ))}
          </div>
        )}
        {/* Gradient overlay on hover */}
        {hov && (
          <div style={{
            position: 'absolute', inset: 0,
            background: 'rgba(249,115,22,0.08)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{
              padding: '6px 14px', borderRadius: 20,
              background: '#f97316', color: '#fff',
              fontSize: 11, fontWeight: 700,
            }}>Use Template</div>
          </div>
        )}
      </div>

      {/* Info row */}
      <div style={{ padding: '8px 10px 10px', flex: 1 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-1)', marginBottom: 3, lineHeight: 1.2 }}>
          {template.name}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ fontSize: 10, color: 'var(--text-4)' }}>{template.category}</span>
          {placeholderCount > 0 && (
            <span style={{ fontSize: 9, color: 'rgba(249,115,22,0.65)' }}>
              {placeholderCount} slot{placeholderCount > 1 ? 's' : ''} to fill
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ template, hasLayers, onConfirm, onCancel }) {
  return (
    <>
      <div
        onClick={onCancel}
        style={{ position: 'fixed', inset: 0, zIndex: 402, background: 'rgba(0,0,0,0.40)' }}
      />
      <div style={{
        position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
        zIndex: 403, width: 380,
        background: 'var(--bg-3)', border: '1px solid var(--border-2)',
        borderRadius: 14, padding: 24,
        boxShadow: '0 20px 60px rgba(0,0,0,0.6)',
        fontFamily: 'Inter, -apple-system, sans-serif',
      }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-1)', marginBottom: 8 }}>
          Apply "{template.name}"?
        </div>
        {hasLayers ? (
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 20 }}>
            This will replace your current canvas with the template layers.
            Your current work will be saved to <strong style={{ color: 'var(--text-2)' }}>Undo history</strong> — press{' '}
            <kbd style={{ background: 'var(--bg-5)', padding: '1px 5px', borderRadius: 4, fontSize: 11 }}>Cmd+Z</kbd>{' '}
            to restore it.
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5, marginBottom: 20 }}>
            Load "{template.name}" onto your canvas?
          </div>
        )}
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={onCancel}
            style={{
              flex: 1, height: 36, background: 'var(--bg-5)',
              border: '1px solid var(--border-1)', borderRadius: 8,
              color: 'var(--text-3)', fontSize: 12, fontWeight: 600, cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={onConfirm}
            style={{
              flex: 2, height: 36, background: '#f97316',
              border: 'none', borderRadius: 8,
              color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >Apply Template</button>
        </div>
      </div>
    </>
  );
}

// ── Main TemplateBrowser ──────────────────────────────────────────────────────
export default function TemplateBrowser({ onClose }) {
  const [category, setCategory]   = useState('All');
  const [search,   setSearch]     = useState('');
  const [sort,     setSort]       = useState('featured');
  const [confirm,  setConfirm]    = useState(null); // template to confirm

  const applyTemplate = useEditorStore(s => s.applyTemplate);
  const layers        = useEditorStore(s => s.layers);
  const hasLayers     = layers.length > 0;

  // Filter + sort
  const displayed = useMemo(() => {
    let list = [...SEED_TEMPLATES];

    if (category !== 'All') {
      list = list.filter(t => t.category === category);
    }

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        t.name.toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q) ||
        t.tags.some(tag => tag.includes(q))
      );
    }

    if (sort === 'featured') {
      list.sort((a, b) => (b.is_featured ? 1 : 0) - (a.is_featured ? 1 : 0));
    }
    // Other sorts (trending, newest) behave the same with static data

    return list;
  }, [category, search, sort]);

  const handleSelect = useCallback((template) => {
    setConfirm(template);
  }, []);

  const handleConfirm = useCallback(() => {
    if (!confirm) return;
    applyTemplate(confirm.layers, confirm.name);
    window.__renderer?.markDirty();
    window.dispatchEvent(new CustomEvent('tf:toast', {
      detail: { message: `Template "${confirm.name}" applied`, type: 'success' },
    }));
    onClose?.();
  }, [confirm, applyTemplate, onClose]);

  // Close on Escape
  React.useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape' && !confirm) onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose, confirm]);

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 300,
          background: 'rgba(0,0,0,0.60)',
          backdropFilter: 'blur(6px)',
        }}
      />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%', zIndex: 301,
        transform: 'translate(-50%, -50%)',
        width: '92vw', maxWidth: 960, height: '84vh',
        background: 'var(--bg-2)',
        border: '1px solid var(--border-2)',
        borderRadius: 16,
        boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
        display: 'flex', flexDirection: 'column',
        fontFamily: 'Inter, -apple-system, sans-serif',
        overflow: 'hidden',
      }}>

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border-1)',
          flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-1)' }}>Templates</div>
            <div style={{ fontSize: 11, color: 'var(--text-4)', marginTop: 2 }}>
              {displayed.length} template{displayed.length !== 1 ? 's' : ''} · click to apply
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Search */}
            <div style={{ position: 'relative' }}>
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search templates…"
                style={{
                  height: 32, width: 200,
                  background: 'var(--bg-5)', border: '1px solid var(--border-1)',
                  borderRadius: 8, color: 'var(--text-2)', fontSize: 12, padding: '0 10px',
                  outline: 'none', fontFamily: 'inherit',
                }}
              />
            </div>

            {/* Sort */}
            <select
              value={sort}
              onChange={e => setSort(e.target.value)}
              style={{
                height: 32, background: 'var(--bg-5)', border: '1px solid var(--border-1)',
                borderRadius: 8, color: 'var(--text-2)', fontSize: 11, padding: '0 8px',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
            </select>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                width: 32, height: 32, background: 'var(--bg-5)',
                border: '1px solid var(--border-1)',
                borderRadius: 8, cursor: 'pointer', color: 'var(--text-3)', fontSize: 16,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >✕</button>
          </div>
        </div>

        {/* ── Body ───────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>

          {/* Left sidebar — categories */}
          <div style={{
            width: 160, flexShrink: 0,
            borderRight: '1px solid var(--border-1)',
            overflowY: 'auto', padding: '12px 8px',
          }}>
            {TEMPLATE_CATEGORIES.map(cat => {
              const isActive = category === cat;
              const count = cat === 'All'
                ? SEED_TEMPLATES.length
                : SEED_TEMPLATES.filter(t => t.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  style={{
                    width: '100%', height: 34,
                    display: 'flex', alignItems: 'center', gap: 8, padding: '0 10px',
                    background: isActive ? 'rgba(249,115,22,0.12)' : 'transparent',
                    border: isActive ? '1px solid rgba(249,115,22,0.35)' : '1px solid transparent',
                    borderRadius: 7, cursor: 'pointer', marginBottom: 3,
                    color: isActive ? '#f97316' : 'var(--text-3)',
                    fontSize: 12, fontWeight: isActive ? 700 : 500,
                    textAlign: 'left',
                    transition: 'all 100ms',
                  }}
                  onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'var(--bg-5)'; }}
                  onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'transparent'; }}
                >
                  <span style={{ fontSize: 14, flexShrink: 0 }}>{CAT_ICONS[cat] || '◈'}</span>
                  <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cat}</span>
                  <span style={{ fontSize: 10, color: isActive ? 'rgba(249,115,22,0.65)' : 'var(--text-5)', flexShrink: 0 }}>{count}</span>
                </button>
              );
            })}
          </div>

          {/* Right: template grid */}
          <div className="obs-scroll" style={{ flex: 1, overflowY: 'auto', padding: 16 }}>
            {displayed.length === 0 ? (
              <div style={{
                height: '100%', display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <div style={{ fontSize: 32 }}>🔍</div>
                <div style={{ fontSize: 14, color: 'var(--text-4)' }}>No templates found</div>
                <button
                  onClick={() => { setSearch(''); setCategory('All'); }}
                  style={{
                    height: 32, padding: '0 16px', background: 'var(--bg-5)',
                    border: '1px solid var(--border-1)', borderRadius: 8,
                    color: 'var(--text-3)', fontSize: 12, cursor: 'pointer',
                  }}
                >Clear filters</button>
              </div>
            ) : (
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: 14,
              }}>
                {displayed.map(tpl => (
                  <TemplateCard key={tpl.id} template={tpl} onSelect={handleSelect} />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer ─────────────────────────────────────────────────────── */}
        <div style={{
          padding: '8px 20px', borderTop: '1px solid var(--border-1)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ fontSize: 10, color: 'var(--text-5)' }}>
            Orange dots = required image slots to fill after applying
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-5)' }}>
            More templates coming soon
          </div>
        </div>
      </div>

      {/* Confirm dialog */}
      {confirm && (
        <ConfirmDialog
          template={confirm}
          hasLayers={hasLayers}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </>
  );
}
