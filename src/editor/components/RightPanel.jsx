// src/editor/components/RightPanel.jsx
// Container for the right properties panel.
// Shows: BrushSettingsPanel (paint tools), TextPanel, EffectsPanel, ShapePanel, or nothing-selected state.

import React, { useState } from 'react';
import useEditorStore from '../engine/Store';

import BrushSettingsPanel  from '../panels/BrushSettingsPanel';
import EffectsPanel        from '../panels/EffectsPanel';
import TextPanel           from '../panels/TextPanel';
import ShapePanel          from '../panels/ShapePanel';
import NichePresetBrowser  from './NichePresetBrowser';
import BackgroundPicker    from './BackgroundPicker';
import FaceCutoutFlow      from './FaceCutoutFlow';
import VariantGenerator    from '../ai/VariantGenerator';
import ExpressionCoach     from '../ai/ExpressionCoach';
import CTRScoreWidget      from '../ai/CTRScoreWidget';

const PAINT_TOOLS = new Set([
  'brush','eraser','clone_stamp','healing_brush','spot_healing',
  'dodge','burn','sponge','blur_brush','sharpen_brush','smudge','light_painting',
]);

const COMING_SOON = () => window.dispatchEvent(
  new CustomEvent('tf:toast', { detail: { message: 'Coming soon — this feature is being built.', type: 'info' } })
);

export default function RightPanel({
  user,
  onUpdate,
  onCommit,
  onAdjustmentChange,
  onAdjustmentCommit,
  onAdjustmentReset,
  onColorGradeSelect,
  onGradeStrengthChange,
  onMakeItPop,
  onFontChange,
  onTextDataChange,
  onTextDataCommit,
  onFileUpload,
}) {
  const [openPanel, setOpenPanel] = useState(null); // 'niches' | 'background' | 'facecutout' | 'variants' | null

  const activeTool              = useEditorStore(s => s.activeTool);
  const setActiveTool           = useEditorStore(s => s.setActiveTool);
  const layers                  = useEditorStore(s => s.layers);
  const selectedLayerIds        = useEditorStore(s => s.selectedLayerIds);
  const setShowTemplateBrowser   = useEditorStore(s => s.setShowTemplateBrowser);
  const setShowAIGeneratePanel   = useEditorStore(s => s.setShowAIGeneratePanel);
  const setShowBackgroundRemover = useEditorStore(s => s.setShowBackgroundRemover);
  const setShowAssetLibrary      = useEditorStore(s => s.setShowAssetLibrary);

  const isPainting = PAINT_TOOLS.has(activeTool);

  // Derive selected layer info
  const selectedLayer = selectedLayerIds.length === 1
    ? layers.find(l => l.id === selectedLayerIds[0])
    : null;

  const selectedTextLayer  = selectedLayer?.type === 'text'  ? selectedLayer : null;
  const selectedImageLayer = selectedLayer?.type === 'image' ? selectedLayer : null;
  const selectedShapeLayer = selectedLayer?.type === 'shape' ? selectedLayer : null;

  return (
    <div className="obs-scroll" style={{
      width: 260, minWidth: 260, flexShrink: 0, height: '100%',
      background: 'rgba(17,17,19,0.90)',
      backdropFilter: 'blur(12px)',
      WebkitBackdropFilter: 'blur(12px)',
      borderLeft: '1px solid var(--border-1)',
      boxShadow: 'inset 1px 0 0 rgba(249,115,22,0.06)',
      overflowY: 'auto', overflowX: 'hidden',
      fontFamily: 'Inter, -apple-system, sans-serif',
    }}>

      {isPainting ? (
        <>
          <BrushSettingsPanel />
          {/* Show layer props below brush settings if an image is selected */}
          {selectedImageLayer && (
            <EffectsPanel
              layer={selectedImageLayer}
              user={user}
              onUpdate={onUpdate}
              onCommit={onCommit}
              onAdjustmentChange={onAdjustmentChange}
              onAdjustmentCommit={onAdjustmentCommit}
              onAdjustmentReset={onAdjustmentReset}
              onColorGradeSelect={onColorGradeSelect}
              onGradeStrengthChange={onGradeStrengthChange}
              onMakeItPop={onMakeItPop}
            />
          )}
        </>
      ) : selectedTextLayer ? (
        <TextPanel
          layer={selectedTextLayer}
          onFontChange={onFontChange}
          onTextDataChange={onTextDataChange}
          onCommit={onTextDataCommit}
          onUpdate={onUpdate}
        />
      ) : selectedImageLayer ? (
        <EffectsPanel
          layer={selectedImageLayer}
          user={user}
          onUpdate={onUpdate}
          onCommit={onCommit}
          onAdjustmentChange={onAdjustmentChange}
          onAdjustmentCommit={onAdjustmentCommit}
          onAdjustmentReset={onAdjustmentReset}
          onColorGradeSelect={onColorGradeSelect}
          onGradeStrengthChange={onGradeStrengthChange}
          onMakeItPop={onMakeItPop}
        />
      ) : selectedShapeLayer ? (
        <ShapePanel
          layer={selectedShapeLayer}
          onUpdate={onUpdate}
          onCommit={onCommit}
        />
      ) : (
        /* Nothing selected */
        <div style={{
          padding: '0 12px',
        }}>
          {/* Canvas info */}
          <div className="obs-section" style={{ marginTop: 8 }}>
            <div className="obs-section-label">Canvas</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 3 }}>Width</div>
                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, SF Mono, monospace', color: 'var(--text-2)' }}>1280</div>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 10, color: 'var(--text-4)', marginBottom: 3 }}>Height</div>
                <div style={{ fontSize: 12, fontFamily: 'JetBrains Mono, SF Mono, monospace', color: 'var(--text-2)' }}>720</div>
              </div>
            </div>
          </div>

          {/* Quick actions */}
          <div className="obs-section">
            <div className="obs-section-label">Quick Actions</div>

            {/* Sub-panel: Niche Presets */}
            {openPanel === 'niches' && (
              <div style={{ marginBottom: 6, border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden' }}>
                <NichePresetBrowser onClose={() => setOpenPanel(null)} />
              </div>
            )}

            {/* Sub-panel: Background Picker */}
            {openPanel === 'background' && (
              <div style={{ marginBottom: 6, border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden' }}>
                <BackgroundPicker onClose={() => setOpenPanel(null)} />
              </div>
            )}

            {/* Sub-panel: Face Cutout */}
            {openPanel === 'facecutout' && (
              <div style={{ marginBottom: 6, border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden' }}>
                <FaceCutoutFlow onClose={() => setOpenPanel(null)} />
              </div>
            )}

            {/* Sub-panel: A/B Variants */}
            {openPanel === 'variants' && (
              <div style={{ marginBottom: 6, border: '1px solid var(--border-1)', borderRadius: 8, overflow: 'hidden' }}>
                <VariantGenerator onClose={() => setOpenPanel(null)} />
              </div>
            )}

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {[
                { icon: '🖼', label: 'Add Image',    hint: 'Upload an image layer',    onClick: onFileUpload,                          id: null },
                { icon: 'T',  label: 'Add Text',     hint: 'Switch to text tool',      onClick: () => setActiveTool('text'),            id: null },
                { icon: '⛏️', label: 'Niche Presets', hint: 'Apply a niche style preset', onClick: () => setOpenPanel(p => p === 'niches' ? null : 'niches'), id: 'niches' },
                { icon: '🌄', label: 'Background',   hint: 'Add a solid or gradient background', onClick: () => setOpenPanel(p => p === 'background' ? null : 'background'), id: 'background' },
                { icon: '✂️', label: 'Face Cutout',  hint: 'Remove background from an image', onClick: () => setShowBackgroundRemover(true), id: null },
                { icon: '⚡', label: 'A/B Variants', hint: 'Apply a style variant to all image layers', onClick: () => setOpenPanel(p => p === 'variants' ? null : 'variants'), id: 'variants' },
                { icon: '✦',  label: 'AI Generate', hint: 'Generate AI image',        onClick: () => setShowAIGeneratePanel(true),     id: null },
                { icon: '📋', label: 'Templates',   hint: 'Browse templates',         onClick: () => setShowTemplateBrowser(true),     id: null },
                { icon: '🖼', label: 'Assets',      hint: 'Browse stock photos and assets', onClick: () => setShowAssetLibrary(true), id: null },
              ].map(({ icon, label, hint, onClick, id }) => {
                const isActive = id && openPanel === id;
                return (
                  <button
                    key={label}
                    title={hint}
                    onClick={onClick}
                    style={{
                      height: 48, display: 'flex', flexDirection: 'column', alignItems: 'center',
                      justifyContent: 'center', gap: 4,
                      background: isActive ? 'rgba(249,115,22,0.10)' : 'var(--bg-3)',
                      border: isActive ? '1px solid rgba(249,115,22,0.40)' : '1px solid var(--border-1)',
                      borderRadius: 'var(--radius-lg)', cursor: 'pointer',
                      color: isActive ? '#f97316' : 'var(--text-3)', fontSize: 11, fontWeight: 600,
                      transition: 'background var(--dur-fast), color var(--dur-fast)',
                    }}
                    onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-5)'; e.currentTarget.style.color = 'var(--text-2)'; } }}
                    onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-3)'; e.currentTarget.style.color = 'var(--text-3)'; } }}
                  >
                    <span style={{ fontSize: 18 }}>{icon}</span>
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* CTR Score Widget — always shown in nothing-selected state */}
          <div className="obs-section">
            <div className="obs-section-label">CTR Score</div>
            <CTRScoreWidget />
          </div>

          {/* Expression Coach — always shown in nothing-selected state */}
          <div className="obs-section" style={{ paddingBottom: 8 }}>
            <div className="obs-section-label">Expression Coach</div>
            <ExpressionCoach />
          </div>

          {/* Hint */}
          <div style={{ padding: '4px 0 12px', fontSize: 11, color: 'var(--text-4)', textAlign: 'center', lineHeight: 1.5 }}>
            Select a layer to edit its properties
          </div>
        </div>
      )}
    </div>
  );
}
