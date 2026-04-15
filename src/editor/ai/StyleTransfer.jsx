import React, { useState } from 'react';
import useEditorStore from '../engine/Store';
import { CREATOR_STYLES } from './StyleAnalyzer';

export default function StyleTransfer() {
  const [applied, setApplied] = useState(null);
  const applyStyleToCanvas = useEditorStore(s => s.applyStyleToCanvas);

  const apply = (style) => {
    applyStyleToCanvas(style);
    setApplied(style.id);
    window.dispatchEvent(new CustomEvent('tf:toast', { detail: { message: `${style.name} style applied!`, type: 'success' } }));
    window.dispatchEvent(new CustomEvent('tf:achievement-trigger', { detail: { styleTransferred: true } }));
  };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {CREATOR_STYLES.map(style => (
          <button
            key={style.id}
            onClick={() => apply(style)}
            title={style.name}
            style={{
              padding: '8px 6px',
              background: applied === style.id ? 'rgba(249,115,22,0.12)' : 'var(--bg-3)',
              border: `1px solid ${applied === style.id ? 'rgba(249,115,22,0.4)' : 'var(--border-1)'}`,
              borderRadius: 8,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <div style={{ fontSize: 10, fontWeight: 700, color: applied === style.id ? '#f97316' : 'var(--text-2)', marginBottom: 4, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {style.name}
            </div>
            <div style={{ display: 'flex', gap: 3 }}>
              {style.palette.map((c, i) => (
                <div key={i} style={{ width: 10, height: 10, borderRadius: '50%', background: c, border: '1px solid rgba(255,255,255,0.1)' }} />
              ))}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
