import React, { useState, useEffect } from 'react';
import { apiFetch } from '../utils/apiClient';

const STRATEGY_COLORS = {
  'Curiosity Gap': '#f97316',
  'Controversy':   '#ef4444',
  'Personal':      '#3b82f6',
  'Warning':       '#eab308',
  'Transformation':'#22c55e',
  'Number':        '#8b5cf6',
  'Question':      '#06b6d4',
};

export default function TextSuggestions({ layer, onApply }) {
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [applied, setApplied] = useState(null);

  useEffect(() => {
    if (!layer?.textData?.content) return;
    setLoading(true);
    setSuggestions([]);
    setApplied(null);

    apiFetch('/api/ai/suggest-text', {
      method: 'POST',
      body: JSON.stringify({ currentText: layer.textData.content }),
    })
      .then(r => r.json())
      .then(data => { setSuggestions(data.suggestions || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, [layer?.id, layer?.textData?.content]);

  const applySuggestion = (s, idx) => {
    const { updateLayer, commitChange } = require('../engine/Store').default.getState();
    updateLayer(layer.id, { textData: { ...layer.textData, content: s.text } });
    commitChange('AI Text Suggestion');
    setApplied(idx);
    onApply?.();
  };

  if (loading) {
    return <div style={{ padding: '8px 0', fontSize: 11, color: 'var(--text-4)', textAlign: 'center' }}>Generating suggestions...</div>;
  }

  if (suggestions.length === 0) return null;

  return (
    <div>
      {suggestions.map((s, i) => {
        const stratColor = STRATEGY_COLORS[s.strategy] || '#9ca3af';
        return (
          <button
            key={i}
            onClick={() => applySuggestion(s, i)}
            style={{
              width: '100%', marginBottom: 6, padding: '8px 10px',
              background: applied === i ? 'rgba(249,115,22,0.08)' : 'var(--bg-3)',
              border: `1px solid ${applied === i ? 'rgba(249,115,22,0.4)' : 'var(--border-1)'}`,
              borderRadius: 8, cursor: 'pointer', textAlign: 'left',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
              <span style={{ fontSize: 10, fontWeight: 700, color: stratColor, background: `${stratColor}20`, padding: '2px 6px', borderRadius: 4 }}>{s.strategy}</span>
              <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 700 }}>{s.ctrImpact}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-1)', marginBottom: 2 }}>{s.text}</div>
            <div style={{ fontSize: 10, color: 'var(--text-4)', lineHeight: 1.4 }}>{s.reasoning}</div>
          </button>
        );
      })}
      <div style={{ fontSize: 10, color: 'var(--text-4)', textAlign: 'center', paddingTop: 4 }}>Free for Pro users · No credits used</div>
    </div>
  );
}
