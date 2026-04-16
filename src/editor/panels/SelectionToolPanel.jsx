// src/editor/panels/SelectionToolPanel.jsx
import { useEffect, useState } from 'react';
import { selectionManager } from '../tools/SelectionState';
import { magicWand, lasso } from '../tools/toolInstances';

export function MagicWandPanel() {
  const [tolerance,  setToleranceState]  = useState(32);
  const [contiguous, setContiguousState] = useState(true);
  const [antiAlias,  setAntiAliasState]  = useState(false);
  const [selInfo,    setSelInfo]         = useState(null);

  useEffect(() => {
    return selectionManager.subscribe(sm => {
      setSelInfo(sm.hasSelection()
        ? { count: sm.pixelCount, bounds: sm.bounds }
        : null);
    });
  }, []);

  const applyTolerance = (v) => {
    setToleranceState(v);
    magicWand.setTolerance(v);
  };
  const applyContiguous = (v) => {
    setContiguousState(v);
    magicWand.setContiguous(v);
  };
  const applyAntiAlias = (v) => {
    setAntiAliasState(v);
    magicWand.setAntiAlias(v);
  };

  const label = { fontSize: 11, color: 'var(--text-3)', marginBottom: 2 };
  const row   = { display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Magic Wand
      </div>

      <div style={label}>Tolerance <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{tolerance}</span></div>
      <input
        type="range" min={0} max={255} value={tolerance}
        onChange={e => applyTolerance(+e.target.value)}
        style={{ width: '100%', marginBottom: 8, accentColor: 'var(--accent)' }}
      />

      <label style={{ ...row, cursor: 'pointer' }}>
        <input type="checkbox" checked={contiguous} onChange={e => applyContiguous(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Contiguous</span>
      </label>

      <label style={{ ...row, cursor: 'pointer' }}>
        <input type="checkbox" checked={antiAlias} onChange={e => applyAntiAlias(e.target.checked)} style={{ accentColor: 'var(--accent)' }} />
        <span style={{ fontSize: 12, color: 'var(--text-2)' }}>Anti-alias</span>
      </label>

      {selInfo && (
        <div style={{ marginTop: 8, padding: '6px 8px', background: 'rgba(249,115,22,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)' }}>
          {selInfo.count.toLocaleString()} px selected
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-4)', lineHeight: 1.6 }}>
        <div>Click — replace selection</div>
        <div>Shift+Click — add to selection</div>
        <div>Alt+Click — subtract</div>
        <div>Delete — erase selected pixels</div>
        <div>Ctrl+D — deselect</div>
        <div>Ctrl+Shift+I — invert</div>
      </div>
    </div>
  );
}

export function LassoPanel() {
  const [subTool, setSubToolState] = useState('freehand');
  const [feather, setFeatherState] = useState(0);
  const [selInfo, setSelInfo]      = useState(null);

  useEffect(() => {
    return selectionManager.subscribe(sm => {
      setSelInfo(sm.hasSelection() ? { count: sm.pixelCount } : null);
    });
  }, []);

  const applySubTool = (v) => {
    setSubToolState(v);
    lasso.setSubTool(v);
  };
  const applyFeather = (v) => {
    setFeatherState(v);
    lasso.setFeather(v);
  };

  const label = { fontSize: 11, color: 'var(--text-3)', marginBottom: 2 };

  return (
    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-2)', marginBottom: 8, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
        Lasso
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
        {['freehand', 'polygonal'].map(t => (
          <button
            key={t}
            onClick={() => applySubTool(t)}
            style={{
              flex: 1, padding: '5px 0', borderRadius: 6, border: 'none', cursor: 'pointer', fontSize: 11,
              background: subTool === t ? 'var(--accent)' : 'var(--surface-2)',
              color: subTool === t ? 'white' : 'var(--text-2)',
              fontWeight: subTool === t ? 700 : 400,
            }}
          >
            {t === 'freehand' ? 'Freehand' : 'Polygonal'}
          </button>
        ))}
      </div>

      <div style={label}>Feather <span style={{ color: 'var(--text-1)', fontWeight: 600 }}>{feather}px</span></div>
      <input
        type="range" min={0} max={50} value={feather}
        onChange={e => applyFeather(+e.target.value)}
        style={{ width: '100%', marginBottom: 8, accentColor: 'var(--accent)' }}
      />

      {selInfo && (
        <div style={{ marginTop: 4, padding: '6px 8px', background: 'rgba(249,115,22,0.08)', borderRadius: 6, fontSize: 11, color: 'var(--text-3)' }}>
          {selInfo.count.toLocaleString()} px selected
        </div>
      )}

      <div style={{ marginTop: 10, fontSize: 10, color: 'var(--text-4)', lineHeight: 1.6 }}>
        {subTool === 'freehand'
          ? <><div>Click+drag — draw freehand</div><div>Release — close selection</div></>
          : <><div>Click — add point</div><div>Click near start — close</div></>
        }
        <div>Delete — erase selected pixels</div>
        <div>Escape — cancel / deselect</div>
      </div>
    </div>
  );
}
