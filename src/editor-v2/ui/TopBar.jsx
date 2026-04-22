// src/editor-v2/ui/TopBar.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6.f top bar. Left-to-right: sailship brand mark →
//           project-name rename field → pen save indicator → settings
//           gear → theme toggle → Ship it button.
//
//           Non-negotiable spec items per the brief:
//             - Sailship logo is the ONE brand mark in the editor
//             - Pen save indicator tilts during save, rests flat when
//               saved ("Logging…" / "Logged")
//             - "Ship it" button scales 1.0 → 1.03 → 1.0 over 800ms
//               on hover, infinite loop; shortcut ⌘E
//             - Theme toggle is a moon (dark) or sun (light) icon
//
// Exports:  default (TopBar), ProjectNameField, SaveIndicator,
//           ShipItButton, ThemeToggle, SettingsMenu
// Depends:  ./tokens, ./copy, ./ThemeProvider, ./Sailship, lucide-react
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Moon, Sun, Settings, ChevronDown, PenLine, Lock } from 'lucide-react';
import { SPACING, TYPOGRAPHY, buildTransition } from './tokens';
import { useTheme } from './ThemeProvider';
import { COPY } from './copy';
import Sailship from './Sailship';

/**
 * @param {{
 *   projectName: string,
 *   onRename: (name: string) => void,
 *   saveStatus: 'saved' | 'saving' | 'offline' | 'error',
 *   onShipIt: (format: 'png' | 'jpeg' | 'youtube' | '4k') => void,
 *   isPro?: boolean,
 *   onOpenUpgrade?: () => void,
 *   onOpenSettings?: () => void,
 *   onOpenShortcuts?: () => void,
 *   onSignOut?: () => void,
 *   soundEnabled?: boolean,
 *   onToggleSound?: () => void,
 * }} props
 */
export default function TopBar({
  projectName = COPY.topBar.projectPlaceholder,
  onRename,
  saveStatus = 'saved',
  onShipIt,
  isPro = false,
  onOpenUpgrade,
  onOpenSettings,
  onOpenShortcuts,
  onSignOut,
  soundEnabled = false,
  onToggleSound,
}) {
  return (
    <div
      data-topbar
      style={{
        display: 'flex', alignItems: 'center',
        gap: SPACING.md,
        width: '100%', height: '100%',
      }}
    >
      {/* Sailship brand mark */}
      <div aria-label="ThumbFrame" style={{ display: 'flex', alignItems: 'center' }}>
        <Sailship size={24} color="var(--accent-cream)" title="ThumbFrame" />
      </div>

      {/* Project name (click to rename inline) */}
      <ProjectNameField value={projectName} onChange={onRename} />

      {/* Save indicator */}
      <SaveIndicator status={saveStatus} />

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Settings */}
      <SettingsMenu
        onOpenShortcuts={onOpenShortcuts}
        onOpenAccountSettings={onOpenSettings}
        onSignOut={onSignOut}
        soundEnabled={soundEnabled}
        onToggleSound={onToggleSound}
      />

      {/* Theme toggle */}
      <ThemeToggle />

      {/* Ship it */}
      <ShipItButton onShip={onShipIt} isPro={isPro} onOpenUpgrade={onOpenUpgrade} />
    </div>
  );
}

// ── Project name field ────────────────────────────────────────────────────
export function ProjectNameField({ value, onChange }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value || '');

  useEffect(() => { setDraft(value || ''); }, [value]);

  const commit = () => {
    setEditing(false);
    if (draft && draft !== value) onChange?.(draft);
    else setDraft(value || '');
  };

  return editing ? (
    <input
      autoFocus
      data-project-name-input
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') commit();
        if (e.key === 'Escape') { setDraft(value || ''); setEditing(false); }
      }}
      style={{
        background: 'transparent',
        color: 'var(--text-primary)',
        fontFamily: TYPOGRAPHY.numeric,
        fontSize: 16,
        border: '1px solid var(--border-soft)',
        borderRadius: 6,
        padding: '2px 8px',
        outline: 'none',
      }}
    />
  ) : (
    <button
      data-project-name
      type="button"
      onClick={() => setEditing(true)}
      style={{
        background: 'transparent', border: 0,
        color: 'var(--text-primary)',
        fontFamily: TYPOGRAPHY.numeric,
        fontSize: 16,
        padding: '2px 6px',
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {value || COPY.topBar.projectPlaceholder}
    </button>
  );
}

// ── Save indicator ────────────────────────────────────────────────────────
// Pen icon tilts ±3px side-to-side during save, loops at 400ms, rests
// flat when saved. Honest labels from copy.js.
export function SaveIndicator({ status }) {
  const saving = status === 'saving';
  const text =
    status === 'saving' ? COPY.topBar.savingText
  : status === 'saved'  ? COPY.topBar.savedText
  :                       status;
  return (
    <div
      data-save-indicator
      data-status={status}
      style={{
        display: 'flex', alignItems: 'center', gap: SPACING.xs,
        color: 'var(--text-secondary)',
        fontFamily: TYPOGRAPHY.numeric, fontSize: 12,
      }}
    >
      <span
        aria-hidden
        data-save-pen
        style={{
          display: 'inline-flex',
          transform: saving ? 'rotate(-6deg)' : 'rotate(0deg)',
          transition: 'transform 400ms ease-in-out',
          animation: saving ? 'saveWriggle 400ms ease-in-out infinite alternate' : 'none',
        }}
      >
        <PenLine size={14} />
        <style>{`
          @keyframes saveWriggle {
            from { transform: translateX(-1.5px) rotate(-8deg); }
            to   { transform: translateX( 1.5px) rotate( 4deg); }
          }
        `}</style>
      </span>
      <span>{text}</span>
    </div>
  );
}

// ── Ship it button ────────────────────────────────────────────────────────
export function ShipItButton({ onShip, isPro = false, onOpenUpgrade }) {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(false);

  // Cmd/Ctrl+E opens the dropdown. tinykeys registration happens in
  // 4.6.g — this listener is a local fallback so the shortcut works
  // immediately when just this button is mounted.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const pick = (kind) => {
    setOpen(false);
    if (kind === '4k' && !isPro) { onOpenUpgrade?.(); return; }
    onShip?.(kind);
  };

  return (
    <div data-ship-it-root style={{ position: 'relative' }}>
      <style>{`
        @keyframes shipItBreath {
          0%, 100% { transform: scale(1.0);  filter: brightness(1.0); }
          50%      { transform: scale(1.03); filter: brightness(1.08); }
        }
      `}</style>
      <button
        type="button"
        data-ship-it
        aria-label={COPY.topBar.shipItLabel}
        onMouseEnter={() => setHover(true)}
        onMouseLeave={() => setHover(false)}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: SPACING.xs,
          padding: '10px 18px',
          background: 'var(--ship-it-bg)',
          color:      'var(--ship-it-fg)',
          border: 0, borderRadius: 8,
          fontFamily: TYPOGRAPHY.body,
          fontSize: TYPOGRAPHY.sizeSm,
          fontWeight: TYPOGRAPHY.weightMedium,
          cursor: 'pointer',
          animation: hover ? 'shipItBreath 800ms ease-in-out infinite' : 'none',
          transition: buildTransition('all', 'fast'),
        }}
      >
        <Sailship size={14} color="currentColor" title="" strokeWidth={2} />
        {COPY.topBar.shipItLabel}
      </button>

      {open && (
        <div
          role="menu"
          data-ship-it-menu
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)',
            background: 'var(--panel-bg-raised)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            padding: SPACING.xs,
            minWidth: 220,
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            zIndex: 100,
          }}
        >
          <ShipItMenuItem label={COPY.topBar.shipAsPng}      onClick={() => pick('png')} />
          <ShipItMenuItem label={COPY.topBar.shipAsJpeg}     onClick={() => pick('jpeg')} />
          <ShipItMenuItem label={COPY.topBar.shipForYoutube} onClick={() => pick('youtube')} />
          <ShipItMenuItem
            label={COPY.topBar.shipIn4K}
            locked={!isPro}
            onClick={() => pick('4k')}
          />
        </div>
      )}
    </div>
  );
}

function ShipItMenuItem({ label, onClick, locked = false }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      data-locked={locked ? 'true' : undefined}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        width: '100%',
        padding: `${SPACING.xs + 2}px ${SPACING.sm}px`,
        background: 'transparent', border: 0,
        color: 'var(--text-primary)',
        fontSize: TYPOGRAPHY.sizeSm,
        fontFamily: TYPOGRAPHY.body,
        borderRadius: 6,
        cursor: 'pointer',
        textAlign: 'left',
      }}
    >
      <span>{label}</span>
      {locked && (
        <span aria-label={COPY.topBar.proLockHint} style={{ color: 'var(--text-muted)' }}>
          <Lock size={12} />
        </span>
      )}
    </button>
  );
}

// ── Theme toggle ──────────────────────────────────────────────────────────
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const icon = theme === 'dark' ? <Moon size={16} /> : <Sun size={16} />;
  const label = theme === 'dark' ? COPY.topBar.themeToLight : COPY.topBar.themeToDark;
  return (
    <button
      type="button"
      data-theme-toggle
      aria-label={label}
      onClick={toggleTheme}
      style={iconButtonStyle()}
    >
      {icon}
    </button>
  );
}

// ── Settings menu ─────────────────────────────────────────────────────────
export function SettingsMenu({
  onOpenShortcuts, onOpenAccountSettings, onSignOut,
  soundEnabled, onToggleSound,
}) {
  const [open, setOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();
  const rootRef = useRef(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div data-settings-root ref={rootRef} style={{ position: 'relative' }}>
      <button
        type="button"
        data-settings-toggle
        aria-label={COPY.topBar.openSettings}
        onClick={() => setOpen((o) => !o)}
        style={iconButtonStyle()}
      >
        <Settings size={16} />
        <ChevronDown size={10} style={{ marginLeft: 2 }} />
      </button>
      {open && (
        <div
          role="menu"
          data-settings-menu
          style={{
            position: 'absolute', right: 0, top: 'calc(100% + 6px)',
            background: 'var(--panel-bg-raised)',
            border: '1px solid var(--border-soft)',
            borderRadius: 8,
            padding: SPACING.xs,
            minWidth: 220,
            boxShadow: '0 20px 50px rgba(0,0,0,0.35)',
            zIndex: 100,
            color: 'var(--text-primary)',
          }}
        >
          <SettingsRow
            label={`${COPY.settings.theme} — ${theme === 'dark' ? 'space' : 'ocean'}`}
            onClick={() => { toggleTheme(); setOpen(false); }}
          />
          <SettingsRow
            label={`${COPY.settings.soundEffects} — ${soundEnabled ? 'on' : 'off'}`}
            onClick={() => { onToggleSound?.(); }}
          />
          <SettingsRow
            label={COPY.settings.shortcuts}
            onClick={() => { onOpenShortcuts?.(); setOpen(false); }}
          />
          <SettingsRow
            label={COPY.settings.account}
            onClick={() => { onOpenAccountSettings?.(); setOpen(false); }}
          />
          <SettingsRow
            label={COPY.settings.signOut}
            onClick={() => { onSignOut?.(); setOpen(false); }}
          />
        </div>
      )}
    </div>
  );
}

function SettingsRow({ label, onClick }) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      style={{
        display: 'block', width: '100%', textAlign: 'left',
        padding: `${SPACING.xs + 2}px ${SPACING.sm}px`,
        background: 'transparent', border: 0,
        color: 'var(--text-primary)',
        fontSize: TYPOGRAPHY.sizeSm,
        fontFamily: TYPOGRAPHY.body,
        borderRadius: 6,
        cursor: 'pointer',
      }}
    >
      {label}
    </button>
  );
}

function iconButtonStyle() {
  return {
    width: 32, height: 32,
    background: 'transparent',
    color: 'var(--text-secondary)',
    border: 0, borderRadius: 8,
    cursor: 'pointer',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    transition: buildTransition('all', 'fast'),
    padding: 0,
  };
}
