// src/editor/panels/BrushSettingsPanel.jsx
// Right panel shown when any painting tool is active.

import React from 'react';
import useEditorStore from '../engine/Store';

const PAINT_TOOLS = new Set([
  'brush', 'eraser', 'clone_stamp', 'healing_brush', 'spot_healing',
  'dodge', 'burn', 'sponge', 'blur_brush', 'sharpen_brush', 'smudge',
  'light_painting',
]);

const BLEND_MODES = [
  'normal','multiply','screen','overlay','darken','lighten',
  'color-dodge','color-burn','hard-light','soft-light',
  'difference','exclusion','hue','saturation','color','luminosity',
];

const TOOL_LABELS = {
  brush: 'Brush', eraser: 'Eraser', clone_stamp: 'Clone Stamp',
  healing_brush: 'Healing Brush', spot_healing: 'Spot Healing',
  dodge: 'Dodge', burn: 'Burn', sponge: 'Sponge',
  blur_brush: 'Blur', sharpen_brush: 'Sharpen', smudge: 'Smudge',
  light_painting: 'Light Painting',
};

const label = { fontSize: 10, fontWeight: 600, color: 'rgba(245,245,247,0.40)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 };
const section = { padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' };
const sliderStyle = { width: '100%', accentColor: '#f97316', margin: '2px 0' };
const selectStyle = {
  width: '100%', background: '#1f1f23', color: '#F5F5F7',
  border: '1px solid rgba(255,255,255,0.10)', borderRadius: 5,
  padding: '4px 6px', fontSize: 11, cursor: 'pointer',
};

function Slider({ label: lbl, min, max, step, value, onChange, hint }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
        <span style={{ fontSize: 10, fontWeight: 500, color: 'rgba(245,245,247,0.65)' }}>{lbl}</span>
        <span style={{ fontSize: 10, color: 'rgba(245,245,247,0.35)', fontFamily: 'monospace' }}>
          {hint ?? Math.round(value)}{lbl === 'Size' || lbl === 'Spacing' ? 'px' : '%'}
        </span>
      </div>
      <input type="range" min={min} max={max} step={step || 1} value={value} onChange={onChange} style={sliderStyle} />
    </div>
  );
}

export default function BrushSettingsPanel() {
  const activeTool     = useEditorStore(s => s.activeTool);
  const toolParams     = useEditorStore(s => s.toolParams);
  const updateToolParam = useEditorStore(s => s.updateToolParam);

  if (!PAINT_TOOLS.has(activeTool)) return null;

  const p  = toolParams[activeTool] || {};
  const up = (key, val) => updateToolParam(activeTool, key, val);

  const showBlend     = activeTool === 'brush' || activeTool === 'clone_stamp';
  const showDodgeBurn = activeTool === 'dodge' || activeTool === 'burn';
  const showSponge    = activeTool === 'sponge';
  const showEraser    = activeTool === 'eraser';
  const showStrength  = ['blur_brush', 'sharpen_brush', 'smudge'].includes(activeTool);
  const showAligned   = activeTool === 'clone_stamp';
  const showLight     = activeTool === 'light_painting';
  const showColor     = ['brush', 'light_painting'].includes(activeTool);

  return (
    <div style={{ padding: 0 }}>
      {/* Header */}
      <div style={{ padding: '10px 14px', fontSize: 11, fontWeight: 700, color: 'rgba(245,245,247,0.60)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        {TOOL_LABELS[activeTool] || activeTool}
      </div>

      {/* Color picker (brush + light painting) */}
      {showColor && (
        <div style={section}>
          <div style={label}>Color</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <input
              type="color"
              value={p.color ?? '#ffffff'}
              onChange={(e) => up('color', e.target.value)}
              style={{ width: 28, height: 28, border: 'none', padding: 0, borderRadius: 4, cursor: 'pointer', background: 'none' }}
            />
            <span style={{ fontSize: 11, color: 'rgba(245,245,247,0.40)', fontFamily: 'monospace' }}>{p.color ?? '#ffffff'}</span>
          </div>
        </div>
      )}

      {/* Core sliders */}
      <div style={section}>
        <Slider label="Size"     min={1}   max={500} step={1}   value={p.size     ?? 20}  onChange={(e) => up('size',     Number(e.target.value))} />
        <Slider label="Hardness" min={0}   max={100} step={1}   value={p.hardness ?? 80}  onChange={(e) => up('hardness', Number(e.target.value))} hint={`${p.hardness ?? 80}%`} />
        <Slider label="Opacity"  min={0}   max={100} step={1}   value={p.opacity  ?? 100} onChange={(e) => up('opacity',  Number(e.target.value))} hint={`${p.opacity ?? 100}%`} />
        <Slider label="Flow"     min={1}   max={100} step={1}   value={p.flow     ?? 100} onChange={(e) => up('flow',     Number(e.target.value))} hint={`${p.flow ?? 100}%`} />
        <Slider label="Spacing"  min={1}   max={200} step={1}   value={p.spacing  ?? 25}  onChange={(e) => up('spacing',  Number(e.target.value))} />
      </div>

      {/* Blend mode (brush, clone stamp) */}
      {showBlend && (
        <div style={section}>
          <div style={label}>Blend Mode</div>
          <select value={p.blendMode ?? 'normal'} onChange={(e) => up('blendMode', e.target.value)} style={selectStyle}>
            {BLEND_MODES.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
      )}

      {/* Dodge/Burn: exposure + range */}
      {showDodgeBurn && (
        <div style={section}>
          <Slider label="Exposure" min={0} max={100} step={1} value={p.exposure ?? 50} onChange={(e) => up('exposure', Number(e.target.value))} hint={`${p.exposure ?? 50}%`} />
          <div style={label}>Range</div>
          <select value={p.range ?? 'midtones'} onChange={(e) => up('range', e.target.value)} style={selectStyle}>
            {['shadows','midtones','highlights'].map(r => <option key={r} value={r}>{r[0].toUpperCase() + r.slice(1)}</option>)}
          </select>
        </div>
      )}

      {/* Sponge: mode */}
      {showSponge && (
        <div style={section}>
          <div style={label}>Mode</div>
          <select value={p.spongeMode ?? 'saturate'} onChange={(e) => up('spongeMode', e.target.value)} style={selectStyle}>
            <option value="saturate">Saturate</option>
            <option value="desaturate">Desaturate</option>
          </select>
        </div>
      )}

      {/* Eraser: mode + tolerance */}
      {showEraser && (
        <div style={section}>
          <div style={label}>Mode</div>
          <select value={p.eraserMode ?? 'normal'} onChange={(e) => up('eraserMode', e.target.value)} style={selectStyle}>
            <option value="normal">Normal</option>
            <option value="background">Background</option>
          </select>
          {p.eraserMode === 'background' && (
            <div style={{ marginTop: 8 }}>
              <Slider label="Tolerance" min={0} max={100} step={1} value={p.tolerance ?? 30} onChange={(e) => up('tolerance', Number(e.target.value))} hint={`${p.tolerance ?? 30}%`} />
            </div>
          )}
        </div>
      )}

      {/* Blur/Sharpen/Smudge: strength */}
      {showStrength && (
        <div style={section}>
          <Slider label="Strength" min={0} max={100} step={1} value={p.strength ?? 50} onChange={(e) => up('strength', Number(e.target.value))} hint={`${p.strength ?? 50}%`} />
        </div>
      )}

      {/* Clone stamp: aligned */}
      {showAligned && (
        <div style={section}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'rgba(245,245,247,0.65)' }}>
            <input type="checkbox" checked={p.aligned !== false} onChange={(e) => up('aligned', e.target.checked)} />
            Aligned
          </label>
        </div>
      )}

      {/* Light painting: brush type + intensity + sparkle points */}
      {showLight && (
        <div style={section}>
          <div style={label}>Brush Type</div>
          <select value={p.brushType ?? 'glow'} onChange={(e) => up('brushType', e.target.value)} style={{ ...selectStyle, marginBottom: 10 }}>
            <option value="glow">Glow</option>
            <option value="sparkle">Sparkle</option>
            <option value="streak">Streak</option>
            <option value="lens_flare">Lens Flare</option>
          </select>
          <Slider label="Intensity" min={0} max={100} step={1} value={p.intensity ?? 100} onChange={(e) => up('intensity', Number(e.target.value))} hint={`${p.intensity ?? 100}%`} />
          {p.brushType === 'sparkle' && (
            <Slider label="Points" min={3} max={12} step={1} value={p.sparklePoints ?? 6} onChange={(e) => up('sparklePoints', Number(e.target.value))} hint={`${p.sparklePoints ?? 6}`} />
          )}
        </div>
      )}

      {/* Dynamics */}
      <div style={section}>
        <div style={label}>Dynamics</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'rgba(245,245,247,0.65)', marginBottom: 6 }}>
          <input type="checkbox" checked={p.dynamicSize ?? false} onChange={(e) => up('dynamicSize', e.target.checked)} />
          Size by speed
        </label>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 11, color: 'rgba(245,245,247,0.65)' }}>
          <input type="checkbox" checked={p.dynamicOpacity ?? false} onChange={(e) => up('dynamicOpacity', e.target.checked)} />
          Opacity by speed
        </label>
      </div>

      {/* Keyboard shortcut hints */}
      <div style={{ padding: '8px 14px' }}>
        <div style={{ ...label, marginBottom: 4 }}>Shortcuts</div>
        {[
          ['[ ]',           'Decrease / increase size'],
          ['Shift+[ ]',     'Decrease / increase hardness'],
          ['0 – 9',         'Set opacity (0% – 100%)'],
        ].map(([k, v]) => (
          <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontSize: 9, fontFamily: 'monospace', color: 'rgba(245,245,247,0.50)', background: 'rgba(255,255,255,0.06)', borderRadius: 3, padding: '1px 4px' }}>{k}</span>
            <span style={{ fontSize: 9, color: 'rgba(245,245,247,0.30)' }}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
