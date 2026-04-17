// src/editor/components/RightPanel.jsx
// Container for the right properties panel.
// Shows: BrushSettingsPanel (paint tools), TextPanel, EffectsPanel, ShapePanel, or nothing-selected state.

import React, { useState } from 'react';
import useEditorStore from '../engine/Store';
import {
  ImagePlus, Type, Layers, Scissors, GitBranch,
  Sparkles, LayoutTemplate, Package, Wand2, Target,
} from 'lucide-react';

import BrushSettingsPanel  from '../panels/BrushSettingsPanel';
import { MagicWandPanel, LassoPanel } from '../panels/SelectionToolPanel';
import EffectsPanel        from '../panels/EffectsPanel';
import TextPanel           from '../panels/TextPanel';
import ShapePanel          from '../panels/ShapePanel';
import NichePresetBrowser  from './NichePresetBrowser';
import BackgroundPicker    from './BackgroundPicker';
import FaceCutoutFlow      from './FaceCutoutFlow';
import VariantGenerator    from '../ai/VariantGenerator';
import ExpressionCoach     from '../ai/ExpressionCoach';
import CTRScoreWidget      from '../ai/CTRScoreWidget';
import FaceEnhancement     from '../ai/FaceEnhancement';
import StyleTransfer       from '../ai/StyleTransfer';
import TextSuggestions     from '../ai/TextSuggestions';

const ICON_STYLE = { opacity: 0.55, flexShrink: 0 };
const ICON_SIZE  = 13;

const PAINT_TOOLS = new Set([
  'brush','eraser','clone_stamp','healing_brush','spot_healing',
  'dodge','burn','sponge','blur_brush','sharpen_brush','smudge','light_painting',
]);

const COMING_SOON = () => window.dispatchEvent( // eslint-disable-line no-unused-vars
  new CustomEvent('tf:toast', { detail: { message: 'Coming soon — this feature is being built.', type: 'info' } })
);

export default function RightPanel({
  user,
  supabaseSession,
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
  onShowAutoThumbnail,
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

      {activeTool === 'magic_wand' && <MagicWandPanel />}
      {activeTool === 'lasso'      && <LassoPanel />}

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
        <>
          <TextPanel
            layer={selectedTextLayer}
            onFontChange={onFontChange}
            onTextDataChange={onTextDataChange}
            onCommit={onTextDataCommit}
            onUpdate={onUpdate}
          />
          {/* AI Text Suggestions */}
          <div className="obs-section" style={{ padding: '0 12px 8px' }}>
            <div className="obs-section-label">AI Text Suggestions</div>
            <TextSuggestions layer={selectedTextLayer} />
          </div>
        </>
      ) : selectedImageLayer ? (
        <>
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
          {/* Face Enhancement */}
          <div className="obs-section" style={{ padding: '0 12px 8px' }}>
            <div className="obs-section-label">Face Enhancement</div>
            <FaceEnhancement layer={selectedImageLayer} user={user} supabaseSession={supabaseSession} />
          </div>
          {/* Style Transfer */}
          <div className="obs-section" style={{ padding: '0 12px 8px' }}>
            <div className="obs-section-label">Creator Style</div>
            <StyleTransfer />
          </div>
        </>
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

            {/* Sub-panel: Background Remover */}
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

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
              {[
                { Icon: ImagePlus,      label: 'Add Image',     hint: 'Upload an image layer',                  onClick: onFileUpload,                                                                    panelId: null },
                { Icon: Type,           label: 'Add Text',      hint: 'Switch to text tool',                    onClick: () => setActiveTool('text'),                                                     panelId: null },
                { Icon: Target,         label: 'Niche Presets',  hint: 'Apply a niche style preset',             onClick: () => setOpenPanel(p => p === 'niches' ? null : 'niches'),                        panelId: 'niches' },
                { Icon: Layers,         label: 'Background',     hint: 'Add a solid or gradient background',     onClick: () => setOpenPanel(p => p === 'background' ? null : 'background'),                panelId: 'background' },
                { Icon: Scissors,       label: 'BG Remover',     hint: 'Remove background from an image',        onClick: () => setShowBackgroundRemover(true),                                            panelId: null },
                { Icon: GitBranch,      label: 'A/B Variants',   hint: 'Apply a style variant to all layers',    onClick: () => setOpenPanel(p => p === 'variants' ? null : 'variants'),                    panelId: 'variants' },
                { Icon: Sparkles,       label: 'AI Generate',    hint: 'Generate AI image',                      onClick: () => setShowAIGeneratePanel(true),                                              panelId: null },
                { Icon: LayoutTemplate, label: 'Templates',      hint: 'Browse templates',                       onClick: () => setShowTemplateBrowser(true),                                              panelId: null },
                { Icon: Package,        label: 'Assets',         hint: 'Browse stock photos and assets',         onClick: () => setShowAssetLibrary(true),                                                 panelId: null },
                { Icon: Wand2,          label: 'Auto Thumb',     hint: 'AI generates a full thumbnail layout',   onClick: () => onShowAutoThumbnail?.(),                                                   panelId: null },
              ].map(({ Icon, label, hint, onClick, panelId }) => {
                const isActive = panelId && openPanel === panelId;
                return (
                  <button
                    key={label}
                    title={hint}
                    onClick={onClick}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '7px 10px',
                      background: isActive ? 'rgba(249,115,22,0.10)' : 'rgba(255,255,255,0.04)',
                      border: isActive ? '1px solid rgba(249,115,22,0.35)' : '1px solid rgba(255,255,255,0.06)',
                      borderRadius: 6, cursor: 'pointer',
                      color: isActive ? '#f97316' : 'rgba(245,245,247,0.70)',
                      fontSize: 11, fontWeight: 500, textAlign: 'left',
                      whiteSpace: 'nowrap', overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.08)'; }}
                    onMouseLeave={e => { if (!isActive) e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
                  >
                    <Icon size={ICON_SIZE} style={isActive ? { ...ICON_STYLE, opacity: 0.9 } : ICON_STYLE} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
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
