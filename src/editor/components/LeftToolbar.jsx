// src/editor/components/LeftToolbar.jsx
// 52px left toolbar with all tool buttons, separators, and color swatches.

import React, { useState, useRef } from 'react';
import useEditorStore from '../engine/Store';

const ACCENT = '#f97316';

const RETOUCH_TOOLS = ['dodge','burn','sponge','blur_brush','sharpen_brush','smudge'];

function ToolBtn({ toolId, activeTool, setActiveTool, title, children, onClick }) {
  const [hov, setHov] = useState(false);
  const isActive = Array.isArray(toolId) ? toolId.includes(activeTool) : activeTool === toolId;

  return (
    <div style={{ position: 'relative' }}>
      <button
        onPointerDown={e => e.stopPropagation()}
        onClick={onClick || (() => setActiveTool(Array.isArray(toolId) ? toolId[0] : toolId))}
        title={title}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: isActive ? 'var(--accent-dim)' : hov ? 'rgba(255,255,255,0.06)' : 'transparent',
          border: isActive ? '1px solid var(--accent-border)' : '1px solid transparent',
          borderRadius: 'var(--radius-lg)', cursor: 'pointer',
          color: isActive ? 'var(--accent)' : hov ? 'var(--text-2)' : 'var(--text-3)',
          transition: 'background var(--dur-fast), color var(--dur-fast), border-color var(--dur-fast)',
          position: 'relative',
        }}
      >{children}</button>

      {/* Tooltip */}
      {hov && (
        <div style={{
          position: 'absolute', left: '100%', top: '50%', transform: 'translateY(-50%)',
          marginLeft: 8, background: 'var(--bg-3)', border: '1px solid var(--border-2)',
          borderRadius: 'var(--radius-md)', padding: '4px 8px', fontSize: 11, fontWeight: 500,
          color: 'var(--text-2)', whiteSpace: 'nowrap', zIndex: 200, pointerEvents: 'none',
          boxShadow: '0 4px 12px rgba(0,0,0,0.4)',
        }}>{title}</div>
      )}
    </div>
  );
}

function Sep() {
  return <div style={{ width: 32, height: 1, background: 'var(--border-1)', margin: '4px 0', flexShrink: 0 }} />;
}

// ── SVG icons ────────────────────────────────────────────────────────────────
const Icons = {
  Select:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M5 3l14 9-7 1-4 7z"/></svg>,
  Hand:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8"/><path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"/></svg>,
  Text:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/></svg>,
  Image:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Brush:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M3 17c3.6-3.6 5.4-5.4 9-5.4s5.4 1.8 5.4 5.4c0 2-1.2 3-3 3-2.4 0-3-1.5-3-3"/><path d="M9.5 6.5L17 3l1 8-3 3"/></svg>,
  Eraser:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M20 20H7L3 16l10-10 7 7-3 3"/><path d="M6.5 17.5l4-4"/></svg>,
  Clone:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>,
  Retouch:  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3m0 14v3M2 12h3m14 0h3m-3.3-6.7-2.1 2.1M7.4 16.6l-2.1 2.1M16.6 16.6l2.1 2.1M7.4 7.4 5.3 5.3"/></svg>,
  Heal:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a5 5 0 0 1 5 5c0 5-5 11-5 11S7 12 7 7a5 5 0 0 1 5-5z"/><line x1="9" y1="12" x2="15" y2="12"/><line x1="12" y1="9" x2="12" y2="15"/></svg>,
  Light:    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/><circle cx="12" cy="12" r="3" fillOpacity="0.3" fill="currentColor"/></svg>,
  Crop:     <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M6 2v14a2 2 0 0 0 2 2h14"/><path d="M18 22V8a2 2 0 0 0-2-2H2"/></svg>,
  Upload:   <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
};

const RETOUCH_LABELS = { dodge:'Dodge', burn:'Burn', sponge:'Sponge', blur_brush:'Blur', sharpen_brush:'Sharpen', smudge:'Smudge' };

export default function LeftToolbar({ onFileUpload, fileInputRef }) {
  const activeTool      = useEditorStore(s => s.activeTool);
  const setActiveTool   = useEditorStore(s => s.setActiveTool);
  const cycleRetouchTool = useEditorStore(s => s.cycleRetouchTool);
  const toolParams      = useEditorStore(s => s.toolParams);

  const [retouchFlyout, setRetouchFlyout] = useState(false);
  const retouchRef = useRef(null);

  // Active retouch tool label for tooltip
  const activeRetouchTool = RETOUCH_TOOLS.includes(activeTool) ? activeTool : 'dodge';
  const retouchLabel = RETOUCH_LABELS[activeRetouchTool] || 'Retouch';

  // Foreground color from brush tool
  const fgColor = toolParams?.brush?.color ?? '#ffffff';

  return (
    <div style={{
      width: 52, minWidth: 52, flexShrink: 0, height: '100%',
      background: 'var(--bg-2)', borderRight: '1px solid var(--border-1)',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '8px 0', gap: 2,
      zIndex: 10,
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>

      <ToolBtn toolId="select"   activeTool={activeTool} setActiveTool={setActiveTool} title="Select (V)">{Icons.Select}</ToolBtn>
      <ToolBtn toolId="hand"     activeTool={activeTool} setActiveTool={setActiveTool} title="Hand (H)">{Icons.Hand}</ToolBtn>

      <Sep />

      <ToolBtn toolId="text"     activeTool={activeTool} setActiveTool={setActiveTool} title="Text (T)">{Icons.Text}</ToolBtn>

      {/* Upload image */}
      <ToolBtn toolId="_upload"  activeTool={activeTool} setActiveTool={setActiveTool} title="Upload Image" onClick={onFileUpload}>{Icons.Upload}</ToolBtn>

      <Sep />

      <ToolBtn toolId="brush"       activeTool={activeTool} setActiveTool={setActiveTool} title="Brush (B)">{Icons.Brush}</ToolBtn>
      <ToolBtn toolId="eraser"      activeTool={activeTool} setActiveTool={setActiveTool} title="Eraser (E)">{Icons.Eraser}</ToolBtn>
      <ToolBtn toolId="clone_stamp" activeTool={activeTool} setActiveTool={setActiveTool} title="Clone Stamp (S)">{Icons.Clone}</ToolBtn>

      {/* Retouch — click cycles, has flyout for direct sub-tool select */}
      <div ref={retouchRef} style={{ position: 'relative' }}>
        <ToolBtn
          toolId={RETOUCH_TOOLS}
          activeTool={activeTool}
          setActiveTool={setActiveTool}
          title={`Retouch (R) — ${retouchLabel}`}
          onClick={cycleRetouchTool}
        >
          {Icons.Retouch}
        </ToolBtn>
        {/* Right-click flyout trigger — tiny triangle */}
        <div
          onPointerDown={e => { e.stopPropagation(); setRetouchFlyout(f => !f); }}
          style={{
            position: 'absolute', bottom: 2, right: 2,
            width: 0, height: 0,
            borderLeft: '4px solid transparent',
            borderBottom: `4px solid ${RETOUCH_TOOLS.includes(activeTool) ? ACCENT : 'rgba(245,245,247,0.25)'}`,
            cursor: 'pointer',
          }}
        />
        {retouchFlyout && (
          <>
            <div style={{ position: 'fixed', inset: 0, zIndex: 98 }} onPointerDown={() => setRetouchFlyout(false)} />
            <div style={{
              position: 'absolute', left: '100%', top: 0, marginLeft: 8,
              background: 'var(--bg-4)', border: '1px solid var(--border-2)',
              borderRadius: 'var(--radius-lg)', padding: 4, zIndex: 99,
              minWidth: 130, boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            }}>
              {RETOUCH_TOOLS.map(tid => (
                <button
                  key={tid}
                  onClick={() => { setActiveTool(tid); setRetouchFlyout(false); }}
                  style={{
                    width: '100%', height: 30, display: 'flex', alignItems: 'center',
                    padding: '0 10px', background: activeTool === tid ? 'var(--accent-dim)' : 'transparent',
                    border: 'none', borderRadius: 4, cursor: 'pointer',
                    color: activeTool === tid ? 'var(--accent)' : 'var(--text-2)',
                    fontSize: 12, fontWeight: 500, gap: 8,
                    transition: 'background var(--dur-fast)',
                  }}
                  onMouseEnter={e => { if (activeTool !== tid) e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
                  onMouseLeave={e => { if (activeTool !== tid) e.currentTarget.style.background = 'transparent'; }}
                >
                  {RETOUCH_LABELS[tid]}
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      <ToolBtn toolId="spot_healing"  activeTool={activeTool} setActiveTool={setActiveTool} title="Spot Healing (J)">{Icons.Heal}</ToolBtn>
      <ToolBtn toolId="light_painting" activeTool={activeTool} setActiveTool={setActiveTool} title="Light Painting">{Icons.Light}</ToolBtn>

      <Sep />

      <ToolBtn toolId="crop" activeTool={activeTool} setActiveTool={setActiveTool} title="Crop (C)">{Icons.Crop}</ToolBtn>

      {/* Spacer */}
      <div style={{ flex: 1 }} />

      {/* Foreground / background color swatches */}
      <div style={{ position: 'relative', width: 36, height: 36, marginBottom: 8, flexShrink: 0 }}>
        {/* Background swatch */}
        <div style={{
          position: 'absolute', right: 2, bottom: 2,
          width: 20, height: 20, borderRadius: 3,
          background: '#000000', border: '1px solid var(--border-3)',
        }} />
        {/* Foreground swatch */}
        <div
          title={`Brush color: ${fgColor}`}
          style={{
            position: 'absolute', left: 2, top: 2,
            width: 20, height: 20, borderRadius: 3,
            background: fgColor,
            border: '1.5px solid rgba(255,255,255,0.40)',
            cursor: 'default',
          }}
        />
      </div>
    </div>
  );
}
