// src/editor/components/ToastManager.jsx
// Listens to window 'tf:toast' events and renders a stacked toast list.
// Event detail: { message: string, type?: 'success'|'error'|'warning'|'info' }
// Legacy callers that pass only { message } get type='info' automatically.

import React, { useState, useEffect, useCallback } from 'react';

const MAX_TOASTS = 3;

const VARIANT = {
  success: { bg: '#22c55e',          text: '#fff',    icon: '✓'  },
  error:   { bg: '#ef4444',          text: '#fff',    icon: '⚠'  },
  warning: { bg: '#eab308',          text: '#000',    icon: '⚠'  },
  info:    { bg: 'var(--bg-3)',       text: 'var(--text-1)', icon: 'ℹ', border: '1px solid var(--border-2)' },
};

const DISMISS_MS = { success: 3000, info: 3000, warning: 4000, error: 5000 };

let _nextId = 1;

export default function ToastManager() {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  useEffect(() => {
    const handler = (e) => {
      const { message, type = 'info' } = e.detail || {};
      if (!message) return;

      const id = _nextId++;
      const variant = VARIANT[type] || VARIANT.info;
      const ms = DISMISS_MS[type] ?? 3000;

      setToasts(prev => {
        const next = [{ id, message, type, variant }, ...prev].slice(0, MAX_TOASTS);
        return next;
      });

      setTimeout(() => dismiss(id), ms);
    };

    window.addEventListener('tf:toast', handler);
    return () => window.removeEventListener('tf:toast', handler);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', top: 60, left: '50%', transform: 'translateX(-50%)',
      display: 'flex', flexDirection: 'column', gap: 8,
      zIndex: 100000, pointerEvents: 'none',
    }}>
      {toasts.map(({ id, message, variant }) => (
        <div key={id} style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '10px 16px', borderRadius: 10,
          background: variant.bg,
          border: variant.border || 'none',
          backdropFilter: 'blur(12px)',
          color: variant.text,
          fontSize: 13, fontWeight: 600,
          minWidth: 200, maxWidth: 400,
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
          animation: 'obs-toast-in 200ms var(--ease-out) both',
          pointerEvents: 'all',
        }}>
          <span style={{ flexShrink: 0, fontSize: 14 }}>{variant.icon}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{message}</span>
        </div>
      ))}
    </div>
  );
}

/** Helper: dispatch a typed toast from anywhere in the app */
export function toast(message, type = 'info') {
  window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message, type } }));
}
