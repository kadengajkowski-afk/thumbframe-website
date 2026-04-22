// src/editor-v2/ui/EmptyState.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6.c empty state. Renders before the cockpit chrome
//           appears — canvas placeholder + "Upload to set sail" /
//           "or start blank →" + sailship logo watermark + faint
//           starfield (dark) or rippled ocean (light).
//
//           Upload triggers: file picker, drag-and-drop anywhere,
//           and clipboard paste. "Start blank" produces an empty
//           project. Either path fires onBegin(kind) so EditorV2
//           can kick off the 4.6.c ship-alive sequence.
// Exports:  default (EmptyState)
// Depends:  ./tokens, ./ThemeProvider, ./copy, ./Sailship
// -----------------------------------------------------------------------------

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  SPACING, TYPOGRAPHY, MOTION_TOKENS, EASING, buildTransition,
} from './tokens';
import { useTheme } from './ThemeProvider';
import { COPY } from './copy';
import Sailship from './Sailship';

/**
 * @param {{
 *   onUpload: (files: File[]) => void | Promise<void>,
 *   onStartBlank: () => void,
 *   onBegin?: (kind: 'upload' | 'blank') => void,
 * }} props
 */
export default function EmptyState({ onUpload, onStartBlank, onBegin }) {
  const { theme } = useTheme();
  const fileInputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const fireUpload = useCallback(async (files) => {
    if (!files || files.length === 0) return;
    await Promise.resolve(onUpload?.(Array.from(files)));
    onBegin?.('upload');
  }, [onUpload, onBegin]);

  // Clipboard paste — any editor-level paste with an image item counts.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onPaste = async (e) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const files = [];
      for (const it of items) {
        if (it.kind === 'file' && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) files.push(f);
        }
      }
      if (files.length > 0) await fireUpload(files);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [fireUpload]);

  const startBlank = useCallback(() => {
    onStartBlank?.();
    onBegin?.('blank');
  }, [onStartBlank, onBegin]);

  return (
    <div
      data-empty-state
      data-theme={theme}
      onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
      onDragLeave={() => setDragOver(false)}
      onDrop={async (e) => {
        e.preventDefault();
        setDragOver(false);
        await fireUpload(e.dataTransfer?.files);
      }}
      style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: SPACING.xxl,
        color: 'var(--text-primary)',
        fontFamily: TYPOGRAPHY.body,
        zIndex: 50,
      }}
    >
      {/* Sailship watermark — top-left, 15% opacity per brief */}
      <div
        aria-hidden
        style={{
          position: 'absolute', top: SPACING.lg, left: SPACING.lg,
          opacity: 0.15,
          pointerEvents: 'none',
        }}
      >
        <Sailship size={32} />
      </div>

      {/* Ghostly canvas placeholder */}
      <div
        data-empty-canvas-placeholder
        style={{
          position: 'relative',
          width:  1280,
          height: 720,
          maxWidth:  '100%',
          maxHeight: '100%',
          border: '1px dashed var(--border-soft)',
          borderColor: dragOver ? 'var(--accent-cream)' : 'var(--border-soft)',
          borderRadius: 6,
          background: dragOver
            ? 'rgba(249, 240, 225, 0.04)'
            : 'transparent',
          transition: buildTransition('all', 'standard'),
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          gap: SPACING.md,
        }}
      >
        <div
          style={{
            fontFamily: TYPOGRAPHY.display,
            fontSize: TYPOGRAPHY.sizeXl + 8,
            fontWeight: TYPOGRAPHY.weightMedium,
            color: 'var(--text-primary)',
          }}
        >
          {COPY.emptyState.headline}
        </div>

        <button
          type="button"
          onClick={startBlank}
          data-start-blank
          style={{
            background: 'transparent',
            border: 0,
            color: 'var(--text-secondary)',
            fontSize: TYPOGRAPHY.sizeSm,
            cursor: 'pointer',
            padding: 0,
            fontFamily: TYPOGRAPHY.body,
          }}
        >
          {COPY.emptyState.secondary}
        </button>

        <label
          data-upload-label
          htmlFor="editor-v2-empty-upload"
          style={{
            position: 'absolute', top: SPACING.md, right: SPACING.md,
            fontSize: TYPOGRAPHY.sizeXs,
            color: 'var(--text-muted)',
          }}
        >
          {COPY.emptyState.dragHint}
        </label>

        <input
          id="editor-v2-empty-upload"
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: 'none' }}
          onChange={async (e) => await fireUpload(e.target.files)}
        />
      </div>

      {/* Large uploader click-target (covers the whole frame) */}
      <button
        aria-label={COPY.emptyState.uploadLabel}
        onClick={() => fileInputRef.current?.click()}
        style={{
          position: 'absolute', inset: 0,
          background: 'transparent',
          border: 0, cursor: 'pointer',
          // Must sit BEHIND the "start blank" button + the drop copy so
          // they remain interactive.
          zIndex: -1,
        }}
      />

      <AmbientBelow theme={theme} />
    </div>
  );
}

// Faint starfield / ripple below the placeholder.
function AmbientBelow({ theme }) {
  const isDark = theme === 'dark';
  return (
    <div
      aria-hidden
      style={{
        position: 'absolute', inset: 0,
        pointerEvents: 'none',
        backgroundImage: isDark
          ? [
              'radial-gradient(1px 1px at 15% 20%, rgba(249,240,225,0.5), transparent 60%)',
              'radial-gradient(1px 1px at 60% 65%, rgba(249,240,225,0.4), transparent 60%)',
              'radial-gradient(1px 1px at 85% 35%, rgba(249,240,225,0.3), transparent 60%)',
              'radial-gradient(1px 1px at 35% 80%, rgba(249,240,225,0.35), transparent 60%)',
            ].join(', ')
          : [
              'radial-gradient(800px 500px at 30% 75%, rgba(180, 210, 225, 0.25), transparent 70%)',
            ].join(', '),
        opacity: 0.5,
        transition: `opacity ${MOTION_TOKENS.theme}ms ${EASING.theme}`,
      }}
    />
  );
}
