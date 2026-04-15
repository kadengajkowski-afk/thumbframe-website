// src/editor/components/CommandPalette.jsx
// Cmd+K command palette with fuzzy search, keyboard navigation.

import React, { useState, useEffect, useRef, useCallback } from 'react';
import useEditorStore from '../engine/Store';

const COMMANDS = [
  // Tools
  { id: 'select',        label: 'Select Tool',         category: 'Tools',   shortcut: 'V', action: (s) => s.setActiveTool('select') },
  { id: 'text',          label: 'Text Tool',            category: 'Tools',   shortcut: 'T', action: (s) => s.setActiveTool('text') },
  { id: 'brush',         label: 'Brush Tool',           category: 'Tools',   shortcut: 'B', action: (s) => s.setActiveTool('brush') },
  { id: 'eraser',        label: 'Eraser Tool',          category: 'Tools',   shortcut: 'E', action: (s) => s.setActiveTool('eraser') },
  { id: 'clone_stamp',   label: 'Clone Stamp Tool',     category: 'Tools',   shortcut: 'S', action: (s) => s.setActiveTool('clone_stamp') },
  { id: 'spot_healing',  label: 'Spot Healing Tool',    category: 'Tools',   shortcut: 'J', action: (s) => s.setActiveTool('spot_healing') },
  { id: 'light_painting',label: 'Light Painting Tool',  category: 'Tools',   shortcut: '',  action: (s) => s.setActiveTool('light_painting') },
  { id: 'dodge',         label: 'Dodge Tool',           category: 'Tools',   shortcut: '',  action: (s) => s.setActiveTool('dodge') },
  { id: 'burn',          label: 'Burn Tool',            category: 'Tools',   shortcut: '',  action: (s) => s.setActiveTool('burn') },
  { id: 'crop',          label: 'Crop Tool',            category: 'Tools',   shortcut: 'C', action: (s) => s.setActiveTool('crop') },
  // Actions
  { id: 'undo',          label: 'Undo',                 category: 'Actions', shortcut: '⌘Z', action: (s) => s.undo() },
  { id: 'redo',          label: 'Redo',                 category: 'Actions', shortcut: '⌘⇧Z', action: (s) => s.redo() },
  { id: 'select_all',    label: 'Select All',           category: 'Actions', shortcut: '⌘A', action: (s) => s.selectAll() },
  { id: 'deselect',      label: 'Deselect All',         category: 'Actions', shortcut: '⌘⇧A', action: (s) => s.clearSelection() },
  { id: 'delete',        label: 'Delete Selected',      category: 'Actions', shortcut: '⌫', action: (s) => s.deleteSelectedLayers() },
  { id: 'duplicate',     label: 'Duplicate Layer',      category: 'Actions', shortcut: '⌘D', action: (s) => { const id = s.selectedLayerIds[0]; if (id) s.duplicateLayer(id); } },
  { id: 'front',         label: 'Bring to Front',       category: 'Actions', shortcut: '⌘⇧]', action: (s) => { const id = s.selectedLayerIds[0]; if (id) s.bringToFront(id); } },
  { id: 'back',          label: 'Send to Back',         category: 'Actions', shortcut: '⌘⇧[', action: (s) => { const id = s.selectedLayerIds[0]; if (id) s.sendToBack(id); } },
  { id: 'zoom_fit',      label: 'Fit Canvas to Screen', category: 'Actions', shortcut: '',    action: (s) => s.resetViewport() },
  { id: 'zoom_100',      label: 'Zoom to 100%',         category: 'Actions', shortcut: '',    action: (s) => s.setZoom(1) },
];

function highlight(text, query) {
  if (!query) return text;
  const lower = text.toLowerCase();
  const ql    = query.toLowerCase();
  const idx   = lower.indexOf(ql);
  if (idx < 0) return text;
  return (
    <>
      {text.slice(0, idx)}
      <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{text.slice(idx, idx + ql.length)}</span>
      {text.slice(idx + ql.length)}
    </>
  );
}

function fuzzyMatch(str, query) {
  if (!query) return true;
  return str.toLowerCase().includes(query.toLowerCase());
}

export default function CommandPalette({ isOpen, onClose }) {
  const [query,    setQuery]    = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef(null);
  const listRef  = useRef(null);

  const results = COMMANDS.filter(c => fuzzyMatch(c.label, query));

  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelected(0);
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  useEffect(() => { setSelected(0); }, [query]);

  const execute = useCallback((cmd) => {
    const store = useEditorStore.getState();
    cmd.action(store);
    onClose();
  }, [onClose]);

  const handleKey = useCallback((e) => {
    if (e.key === 'Escape') { onClose(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { execute(results[selected]); }
  }, [results, selected, execute, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, handleKey]);

  // Auto-scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const el = listRef.current.querySelector(`[data-idx="${selected}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [selected]);

  if (!isOpen) return null;

  // Group by category
  const categories = [...new Set(results.map(r => r.category))];

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: 'fixed', inset: 0, zIndex: 9990,
          background: 'rgba(0,0,0,0.50)',
          backdropFilter: 'blur(4px)',
        }}
        onClick={onClose}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed', left: '50%', top: '20%',
          transform: 'translateX(-50%)',
          width: 520, zIndex: 9991,
          background: 'var(--bg-3)', border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 'var(--radius-xl)',
          boxShadow: '0 16px 64px rgba(0,0,0,0.6)',
          overflow: 'hidden',
          animation: 'obs-scale-in 200ms var(--ease-spring) both',
          fontFamily: 'Inter, -apple-system, sans-serif',
        }}
        onPointerDown={e => e.stopPropagation()}
      >
        {/* Search */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 16px', height: 48, borderBottom: '1px solid var(--border-1)', gap: 10 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ color: 'var(--text-4)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search commands…"
            style={{
              flex: 1, background: 'transparent', border: 'none', outline: 'none',
              color: 'var(--text-1)', fontSize: 15, fontWeight: 500,
              fontFamily: 'inherit',
            }}
          />
          {query && (
            <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--text-4)', cursor: 'pointer', padding: 0, fontSize: 14 }}>✕</button>
          )}
        </div>

        {/* Results */}
        <div ref={listRef} className="obs-scroll" style={{ maxHeight: 360, overflowY: 'auto', padding: 4 }}>
          {results.length === 0 ? (
            <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-4)', fontSize: 13 }}>
              No results for "{query}"
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat}>
                <div style={{ padding: '6px 16px 2px', fontSize: 10, fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text-4)', position: 'sticky', top: 0, background: 'var(--bg-3)' }}>
                  {cat}
                </div>
                {results.filter(r => r.category === cat).map((cmd, _localIdx) => {
                  const globalIdx = results.indexOf(cmd);
                  const isSelected = globalIdx === selected;
                  return (
                    <div
                      key={cmd.id}
                      data-idx={globalIdx}
                      onClick={() => execute(cmd)}
                      onMouseEnter={() => setSelected(globalIdx)}
                      style={{
                        height: 36, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 16px',
                        background: isSelected ? 'rgba(255,255,255,0.06)' : 'transparent',
                        borderRadius: 4, cursor: 'pointer',
                        transition: 'background var(--dur-fast)',
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-1)' }}>
                        {highlight(cmd.label, query)}
                      </span>
                      {cmd.shortcut && (
                        <span style={{
                          fontSize: 10, color: 'var(--text-4)',
                          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)',
                          borderRadius: 3, padding: '1px 5px',
                          fontFamily: 'monospace',
                        }}>{cmd.shortcut}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
}
