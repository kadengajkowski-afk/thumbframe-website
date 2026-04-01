// ── FabricCanvas.js — V2 Canvas Engine (fabric.js 7.x) ─────────────────────
// Parallel component: runs alongside the existing Editor.js canvas.
// Activated via ?engine=fabric URL param or feature flag.

import React, { useEffect, useRef, useState, useCallback, useImperativeHandle, forwardRef } from 'react';
import * as fabric from 'fabric';
import supabase from './supabaseClient';

const CANVAS_W = 1280;
const CANVAS_H = 720;

// ── Utility: CORS-safe image loader ─────────────────────────────────────────
function loadFabricImage(url) {
  return fabric.FabricImage.fromURL(url, { crossOrigin: 'anonymous' });
}

// ── The Component ───────────────────────────────────────────────────────────
const FabricCanvas = forwardRef(function FabricCanvas({ user, onSaveStatus, darkMode = true }, ref) {
  const canvasElRef = useRef(null);
  const fabricRef = useRef(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef(null);

  // Theme
  const T = {
    bg:     darkMode ? '#0f0f0f' : '#f2f2f2',
    panel:  darkMode ? '#1a1a1a' : '#ffffff',
    border: darkMode ? '#2a2a2a' : '#e8e8e8',
    text:   darkMode ? '#e8e8e8' : '#1a1a1a',
    muted:  darkMode ? '#5a5a5a' : '#9a9a9a',
    accent: '#f97316',
  };

  // ── Phase 2: Init fabric.Canvas with cleanup ────────────────────────────
  useEffect(() => {
    if (!canvasElRef.current) return;

    const canvas = new fabric.Canvas(canvasElRef.current, {
      width: CANVAS_W,
      height: CANVAS_H,
      backgroundColor: '#1a1a1a',
      preserveObjectStacking: true,
      selection: true,
      controlsAboveOverlay: true,
    });

    fabricRef.current = canvas;
    setReady(true);

    // Auto-save on every modification
    canvas.on('object:modified', () => triggerAutoSave());
    canvas.on('object:added', () => triggerAutoSave());
    canvas.on('object:removed', () => triggerAutoSave());

    // Cleanup: React Strict Mode double-mounts in dev.
    // dispose() destroys all event listeners, DOM elements, and fabric objects.
    // Without this, the second mount stacks a second canvas = memory leak + crash.
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      canvas.dispose();
      fabricRef.current = null;
      setReady(false);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Phase 3: Save (canvas.toJSON → Supabase) ───────────────────────────
  const saveToSupabase = useCallback(async () => {
    const canvas = fabricRef.current;
    if (!canvas || !user?.email) return;

    setSaving(true);
    if (onSaveStatus) onSaveStatus('Saving...');

    try {
      const jsonData = canvas.toJSON([
        'id', 'name', 'crossOrigin', 'isSubject',
        'selectable', 'evented', 'lockMovementX', 'lockMovementY',
      ]);

      // Generate thumbnail
      const thumbDataUrl = canvas.toDataURL({
        format: 'jpeg',
        quality: 0.7,
        multiplier: 0.5, // 640x360 thumbnail
      });

      const API_URL = (process.env.REACT_APP_API_URL || 'https://thumbframe-api-production.up.railway.app').replace(/\/$/, '');
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;

      const res = await fetch(`${API_URL}/designs/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          email: user.email,
          name: 'Untitled (Fabric V2)',
          json_data: jsonData,
          thumbnail: thumbDataUrl,
          engine: 'fabric',
        }),
      });

      if (!res.ok) throw new Error(`Save failed: ${res.status}`);
      if (onSaveStatus) onSaveStatus('Saved');
    } catch (err) {
      console.error('[FabricCanvas] Save error:', err);
      if (onSaveStatus) onSaveStatus('Error');
    } finally {
      setSaving(false);
    }
  }, [user, onSaveStatus]);

  // Debounced auto-save
  const triggerAutoSave = useCallback(() => {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(() => saveToSupabase(), 3000);
  }, [saveToSupabase]);

  // ── Phase 3: Load (Supabase → canvas.loadFromJSON) ──────────────────────
  const loadFromJSON = useCallback(async (jsonData) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    try {
      await canvas.loadFromJSON(jsonData);
      canvas.renderAll();
      // Re-apply crossOrigin to all images after load
      canvas.getObjects().forEach(obj => {
        if (obj.type === 'image') {
          obj.set({ crossOrigin: 'anonymous' });
        }
      });
    } catch (err) {
      console.error('[FabricCanvas] Load error:', err);
    }
  }, []);

  // ── Phase 4: Tool methods (exposed via ref) ────────────────────────────
  const addText = useCallback((text = 'YOUR TEXT', options = {}) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    const textbox = new fabric.Textbox(text, {
      left: 100,
      top: CANVAS_H / 2 - 30,
      width: 400,
      fontSize: 64,
      fontFamily: 'Anton, sans-serif',
      fontWeight: 900,
      fill: '#ffffff',
      stroke: '#000000',
      strokeWidth: 6,
      paintFirst: 'stroke', // fabric.js native — stroke renders BEHIND fill
      shadow: new fabric.Shadow({
        color: 'rgba(0,0,0,0.8)',
        blur: 15,
        offsetX: 3,
        offsetY: 3,
      }),
      textAlign: 'center',
      editable: true,
      ...options,
    });

    canvas.add(textbox);
    canvas.setActiveObject(textbox);
    canvas.renderAll();
  }, []);

  const addImage = useCallback(async (url, options = {}) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    try {
      const img = await loadFabricImage(url);
      // Scale to fit canvas while maintaining aspect ratio
      const maxW = CANVAS_W * 0.6;
      const maxH = CANVAS_H * 0.8;
      const scale = Math.min(maxW / img.width, maxH / img.height, 1);

      img.set({
        left: CANVAS_W / 2,
        top: CANVAS_H / 2,
        originX: 'center',
        originY: 'center',
        scaleX: scale,
        scaleY: scale,
        crossOrigin: 'anonymous',
        ...options,
      });

      canvas.add(img);
      canvas.setActiveObject(img);
      canvas.renderAll();
    } catch (err) {
      console.error('[FabricCanvas] Image load error:', err);
    }
  }, []);

  const setBackground = useCallback((color) => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.backgroundColor = color;
    canvas.renderAll();
  }, []);

  const setBackgroundImage = useCallback(async (url) => {
    const canvas = fabricRef.current;
    if (!canvas) return;

    try {
      const img = await loadFabricImage(url);
      const scaleX = CANVAS_W / img.width;
      const scaleY = CANVAS_H / img.height;
      img.set({ scaleX, scaleY, crossOrigin: 'anonymous' });
      canvas.backgroundImage = img;
      canvas.renderAll();
    } catch (err) {
      console.error('[FabricCanvas] Background image error:', err);
    }
  }, []);

  const exportCanvas = useCallback((format = 'png', quality = 1.0) => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return canvas.toDataURL({
      format,
      quality,
      multiplier: 1, // Full 1280x720
    });
  }, []);

  const getJSON = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return null;
    return canvas.toJSON(['id', 'name', 'crossOrigin', 'isSubject']);
  }, []);

  const deleteSelected = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    const active = canvas.getActiveObjects();
    active.forEach(obj => canvas.remove(obj));
    canvas.discardActiveObject();
    canvas.renderAll();
  }, []);

  const clearCanvas = useCallback(() => {
    const canvas = fabricRef.current;
    if (!canvas) return;
    canvas.clear();
    canvas.backgroundColor = '#1a1a1a';
    canvas.renderAll();
  }, []);

  // Expose methods to parent via ref
  useImperativeHandle(ref, () => ({
    addText,
    addImage,
    setBackground,
    setBackgroundImage,
    exportCanvas,
    getJSON,
    loadFromJSON,
    saveToSupabase,
    deleteSelected,
    clearCanvas,
    get fabricCanvas() { return fabricRef.current; },
  }), [addText, addImage, setBackground, setBackgroundImage, exportCanvas, getJSON, loadFromJSON, saveToSupabase, deleteSelected, clearCanvas]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    function onKeyDown(e) {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === 'Delete' || e.key === 'Backspace') deleteSelected();
      if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveToSupabase(); }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [deleteSelected, saveToSupabase]);

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      background: T.bg, padding: 24, borderRadius: 12,
      border: `1px solid ${T.border}`,
    }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <button onClick={() => addText()} style={btnStyle(T)}>T+ Add Text</button>
        <button onClick={() => {
          const url = prompt('Image URL (or paste after upload):');
          if (url) addImage(url);
        }} style={btnStyle(T)}>🖼 Add Image</button>
        <button onClick={() => setBackground('#0a0a0a')} style={btnStyle(T)}>⬛ Dark BG</button>
        <button onClick={() => setBackground('#ffffff')} style={btnStyle(T)}>⬜ Light BG</button>
        <button onClick={deleteSelected} style={{ ...btnStyle(T), background: '#ef4444' }}>🗑 Delete</button>
        <button onClick={saveToSupabase} disabled={saving}
          style={{ ...btnStyle(T), background: saving ? T.muted : 'linear-gradient(135deg,#f97316,#ea580c)' }}>
          {saving ? '💾 Saving...' : '💾 Save'}
        </button>
        <button onClick={() => {
          const dataUrl = exportCanvas('png');
          if (!dataUrl) return;
          const link = document.createElement('a');
          link.download = 'thumbframe-fabric-export.png';
          link.href = dataUrl;
          link.click();
        }} style={{ ...btnStyle(T), background: '#22c55e' }}>⬇ Export PNG</button>
      </div>

      {/* Status */}
      <div style={{ fontSize: 11, color: T.muted, marginBottom: 8 }}>
        Fabric.js v7 Engine {ready ? '● Ready' : '○ Loading...'} · {CANVAS_W}×{CANVAS_H}
        {saving && ' · Saving...'}
      </div>

      {/* Canvas */}
      <div style={{
        border: `2px solid ${T.border}`,
        borderRadius: 8,
        overflow: 'hidden',
        boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
        maxWidth: '100%',
      }}>
        <canvas ref={canvasElRef} />
      </div>
    </div>
  );
});

function btnStyle(T) {
  return {
    padding: '8px 14px',
    borderRadius: 7,
    border: `1px solid ${T.border}`,
    background: T.panel,
    color: T.text,
    fontSize: 12,
    fontWeight: 600,
    cursor: 'pointer',
    fontFamily: 'inherit',
  };
}

export default FabricCanvas;
