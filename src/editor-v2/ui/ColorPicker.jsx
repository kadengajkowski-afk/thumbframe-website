// src/editor-v2/ui/ColorPicker.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6.e color picker. Wraps react-colorful with:
//           - Recent swatches (localStorage, 8-item LRU)
//           - Eyedropper (EyeDropper API, fallback invisible when absent)
//           - Hex input + inline swatch
//
// Exports:  default (ColorPicker)
// Depends:  react-colorful, ./tokens, ./copy
// -----------------------------------------------------------------------------

import React, { useCallback, useMemo, useState } from 'react';
import { HexColorPicker, HexColorInput } from 'react-colorful';
import { SPACING, TYPOGRAPHY } from './tokens';
import { Pipette } from 'lucide-react';

const RECENT_KEY = 'thumbframe.editor.swatches.recent';
const RECENT_MAX = 8;

/**
 * @param {{
 *   value: string,
 *   onChange: (hex: string) => void,
 *   label?: string,
 * }} props
 */
export default function ColorPicker({ value = '#000000', onChange, label }) {
  const [recent, setRecent] = useState(() => _readRecent());

  const commit = useCallback((next) => {
    onChange?.(next);
    if (/^#[0-9a-f]{6}$/i.test(next)) {
      _pushRecent(next);
      setRecent(_readRecent());
    }
  }, [onChange]);

  const hasEyeDropper = useMemo(
    () => typeof window !== 'undefined' && typeof window.EyeDropper === 'function',
    [],
  );

  const pickWithEyeDropper = useCallback(async () => {
    if (!hasEyeDropper) return;
    try {
      // eslint-disable-next-line no-undef
      const ed = new window.EyeDropper();
      const result = await ed.open();
      if (result?.sRGBHex) commit(result.sRGBHex);
    } catch { /* user cancelled */ }
  }, [commit, hasEyeDropper]);

  return (
    <div
      data-color-picker
      style={{
        display: 'flex', flexDirection: 'column',
        gap: SPACING.xs, padding: SPACING.xs,
      }}
    >
      {label && (
        <span style={{
          fontSize: TYPOGRAPHY.sizeXs,
          color: 'var(--text-secondary)',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
        }}>{label}</span>
      )}

      <HexColorPicker color={value} onChange={commit} style={{ width: '100%' }} />

      <div style={{ display: 'flex', gap: SPACING.xs, alignItems: 'center' }}>
        <span
          aria-hidden
          style={{
            width: 24, height: 24,
            borderRadius: 4,
            background: value,
            border: '1px solid var(--border-soft)',
          }}
        />
        <HexColorInput
          color={value}
          onChange={commit}
          prefixed
          style={{
            flex: 1,
            background: 'var(--panel-bg-raised)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border-soft)',
            borderRadius: 4,
            padding: '4px 6px',
            fontFamily: TYPOGRAPHY.numeric,
            fontSize: TYPOGRAPHY.sizeSm,
          }}
        />
        {hasEyeDropper && (
          <button
            type="button"
            aria-label="Pick a color from the screen"
            data-eyedropper
            onClick={pickWithEyeDropper}
            style={{
              width: 28, height: 28,
              background: 'transparent',
              border: '1px solid var(--border-soft)',
              borderRadius: 4,
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              padding: 0,
            }}
          >
            <Pipette size={14} />
          </button>
        )}
      </div>

      {recent.length > 0 && (
        <div
          data-color-recent
          style={{ display: 'flex', gap: SPACING.xs, flexWrap: 'wrap' }}
        >
          {recent.map((sw) => (
            <button
              key={sw}
              type="button"
              aria-label={`Apply recent color ${sw}`}
              onClick={() => commit(sw)}
              style={{
                width: 20, height: 20,
                background: sw,
                border: '1px solid var(--border-soft)',
                borderRadius: 3,
                cursor: 'pointer', padding: 0,
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── helpers ───────────────────────────────────────────────────────────────
function _readRecent() {
  if (typeof localStorage === 'undefined') return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]'); }
  catch { return []; }
}

function _pushRecent(hex) {
  if (typeof localStorage === 'undefined') return;
  try {
    const prev = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
    const norm = hex.toLowerCase();
    const next = [norm, ...prev.filter((h) => h !== norm)].slice(0, RECENT_MAX);
    localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch { /* noop */ }
}
