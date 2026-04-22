// src/editor-v2/ui/CommandPalette.jsx
// -----------------------------------------------------------------------------
// Purpose:  Cmd+K palette powered by cmdk. Fuzzy searches every action
//           registered with actions/registry, groups by category, shows
//           keyboard shortcuts, promotes recent actions to the top.
// Exports:  CommandPalette (default), useCommandPalette
// Depends:  cmdk, ../actions/registry, ./tokens
//
// UX rules from the queue:
//   • ⌘K opens
//   • Escape closes
//   • arrow keys navigate
//   • Enter executes the highlighted action
//   • Shortcut hints shown on every row (teaches passively)
//   • Recent actions promoted
//
// Deliberately not implemented here:
//   • The "Run AI op" items that check Thumb Token balance — that
//     ships alongside the ThumbFriend module in src/ai/, not the
//     editor core. A Phase 4.e extension point accepts an extra
//     `extraItems` prop so that module can inject them later.
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Command } from 'cmdk';
import { COLORS, TYPOGRAPHY, SPACING, SHADOWS } from './tokens';
import { listActions, executeAction } from '../actions/registry';

const RECENT_KEY = 'editor-v2.palette.recent';
const RECENT_MAX = 8;

/**
 * Hook to wire ⌘K / Ctrl+K → open state. Returns [open, setOpen].
 */
export function useCommandPalette() {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        setOpen(v => !v);
      }
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return [open, setOpen];
}

export default function CommandPalette({
  open,
  onOpenChange,
  extraItems = [],
}) {
  const [recent, setRecent] = useState(() => _readRecent());

  const actions = useMemo(() => {
    const all = listActions().filter(a => !a.id.startsWith('paint.__debug'));
    return all;
  }, []);

  const grouped = useMemo(() => _groupByCategory(actions), [actions]);

  const run = useCallback((action, args) => {
    try { executeAction(action.id, args); }
    catch (err) { console.warn('[palette] action failed:', err); }
    _pushRecent(action.id);
    setRecent(_readRecent());
    onOpenChange?.(false);
  }, [onOpenChange]);

  if (!open) return null;

  const recentRows = recent
    .map(id => actions.find(a => a.id === id))
    .filter(Boolean);

  return (
    <div
      data-testid="command-palette"
      onClick={() => onOpenChange?.(false)}
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'rgba(2, 3, 8, 0.6)',
        display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        paddingTop: '12vh',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 560, maxWidth: '90vw',
          background: COLORS.bgPanelRaised,
          border: `1px solid ${COLORS.borderSoft}`,
          borderRadius: 12,
          boxShadow: SHADOWS.panelRaised,
          overflow: 'hidden',
          fontFamily: TYPOGRAPHY.body,
          color: COLORS.textPrimary,
        }}
      >
        <Command>
          <Command.Input
            autoFocus
            placeholder="Search actions, layers, templates…"
            style={{
              width: '100%', padding: `${SPACING.md}px ${SPACING.lg}px`,
              background: 'transparent',
              border: 0,
              color: COLORS.textPrimary,
              fontSize: TYPOGRAPHY.sizeLg,
              outline: 'none',
              borderBottom: `1px solid ${COLORS.borderFaint}`,
            }}
          />
          <Command.List style={{ maxHeight: 480, overflow: 'auto', padding: SPACING.xs }}>
            <Command.Empty
              style={{
                padding: SPACING.md,
                color: COLORS.textMuted, fontSize: TYPOGRAPHY.sizeSm,
              }}
            >
              Nothing matches. Try fewer letters.
            </Command.Empty>

            {recentRows.length > 0 && (
              <Command.Group heading="Recent" style={groupStyle}>
                {recentRows.map(a => (
                  <PaletteItem key={'r-' + a.id} action={a} onSelect={() => run(a)} />
                ))}
              </Command.Group>
            )}

            {extraItems.length > 0 && (
              <Command.Group heading="AI" style={groupStyle}>
                {extraItems.map(item => (
                  <Command.Item
                    key={'x-' + item.id}
                    value={`${item.label} ${item.description || ''}`}
                    onSelect={() => { item.onSelect?.(); onOpenChange?.(false); }}
                    style={itemStyle}
                  >
                    <span style={{ flex: 1 }}>{item.label}</span>
                    {item.cost != null && (
                      <kbd style={kbdStyle}>{item.cost} tokens</kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {Object.entries(grouped).map(([cat, items]) => (
              <Command.Group key={cat} heading={cat.toUpperCase()} style={groupStyle}>
                {items.map(a => (
                  <PaletteItem key={a.id} action={a} onSelect={() => run(a)} />
                ))}
              </Command.Group>
            ))}
          </Command.List>
        </Command>
      </div>
    </div>
  );
}

function PaletteItem({ action, onSelect }) {
  return (
    <Command.Item
      value={`${action.label} ${action.id} ${action.category} ${action.description || ''}`}
      onSelect={onSelect}
      style={itemStyle}
    >
      <span style={{ flex: 1 }}>{action.label}</span>
      <span style={{ fontSize: 10, color: COLORS.textMuted, marginRight: SPACING.sm }}>
        {action.id}
      </span>
      {action.shortcut && <kbd style={kbdStyle}>{action.shortcut}</kbd>}
    </Command.Item>
  );
}

const groupStyle = {
  padding: `${SPACING.xs}px ${SPACING.sm}px`,
  fontSize: 11, letterSpacing: '0.08em',
  color: COLORS.textSecondary,
};

const itemStyle = {
  display: 'flex', alignItems: 'center',
  padding: `${SPACING.xs + 2}px ${SPACING.sm}px`,
  fontSize: TYPOGRAPHY.sizeSm,
  borderRadius: 6,
  cursor: 'pointer',
};

const kbdStyle = {
  fontFamily: TYPOGRAPHY.numeric,
  fontSize: 10,
  padding: '1px 6px',
  background: COLORS.borderSoft,
  borderRadius: 4,
  color: COLORS.textSecondary,
};

// ── helpers ────────────────────────────────────────────────────────────────
function _groupByCategory(actions) {
  const out = {};
  for (const a of actions) {
    out[a.category] = out[a.category] || [];
    out[a.category].push(a);
  }
  const categoryOrder = [
    'layer', 'shape', 'text', 'selection', 'tool', 'paint',
    'transform', 'effects', 'mask', 'font', 'lut', 'preset',
    'history', 'project',
  ];
  const ordered = {};
  for (const cat of categoryOrder) if (out[cat]) ordered[cat] = out[cat];
  for (const cat of Object.keys(out)) if (!ordered[cat]) ordered[cat] = out[cat];
  return ordered;
}

function _readRecent() {
  if (typeof localStorage === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function _pushRecent(id) {
  if (typeof localStorage === 'undefined') return;
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const next = [id, ...prev.filter(x => x !== id)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* ignore */ }
}
