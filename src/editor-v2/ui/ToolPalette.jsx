// src/editor-v2/ui/ToolPalette.jsx
// -----------------------------------------------------------------------------
// Purpose:  Vertical icon strip for the editor's active tool. Lists the
//           tool set defined in TOOL_GROUPS, shows a tooltip with the
//           ThumbFrame-voice hint + shortcut, and dispatches through
//           the action registry.
// Exports:  ToolPalette (default), TOOL_GROUPS
// Depends:  ../actions/registry (executeAction), ./tokens
//
// Voice in tooltips: direct address, short, honest, action-oriented.
//   • Brush       — "Paint on the canvas. [B]"
//   • Eraser      — "Erase what's there. [E]"
//   • Magic wand  — "Click an area to select similar pixels. [W]"
//
// Lucide icons were specced in the queue, but we ship our own tiny
// inline SVGs here to avoid pulling more iconography into the bundle.
// They are drawn in the cream accent and consistently stroke-weighted.
// -----------------------------------------------------------------------------

import React, { useState } from 'react';
import { COLORS, SPACING, SHADOWS, transition } from './tokens';
import { executeAction } from '../actions/registry';

// ── Tool definitions ───────────────────────────────────────────────────────
export const TOOL_GROUPS = Object.freeze([
  {
    id: 'select',
    tools: [
      { id: 'select.move', label: 'Move', hint: 'Move layers around. [V]',
        shortcut: 'V', actionId: 'selection.clear', icon: 'move' },
      { id: 'select.lasso', label: 'Lasso', hint: 'Draw a freeform selection. [L]',
        shortcut: 'L', actionId: null, icon: 'lasso' },
      { id: 'select.wand', label: 'Magic wand',
        hint: 'Click an area to select similar pixels. [W]',
        shortcut: 'W', actionId: null, icon: 'wand' },
    ],
  },
  {
    id: 'shapes',
    tools: [
      { id: 'shape.rect',   label: 'Rectangle',  hint: 'Drag to place a rectangle. [U]',   shortcut: 'U', actionId: 'shape.create',
        actionArgs: { shapeData: { shapeType: 'rect'   } }, icon: 'rect' },
      { id: 'shape.circle', label: 'Ellipse',    hint: 'Drag to place a circle.',           shortcut: null, actionId: 'shape.create',
        actionArgs: { shapeData: { shapeType: 'circle' } }, icon: 'circle' },
      { id: 'shape.polygon',label: 'Polygon',    hint: 'Drag to place a polygon.',          shortcut: null, actionId: 'shape.create',
        actionArgs: { shapeData: { shapeType: 'polygon'} }, icon: 'hex' },
      { id: 'shape.star',   label: 'Star',       hint: 'Drag to place a star sticker.',     shortcut: null, actionId: 'shape.create',
        actionArgs: { shapeData: { shapeType: 'star'   } }, icon: 'star' },
    ],
  },
  {
    id: 'brushes',
    tools: [
      { id: 'tool.brush',        label: 'Brush',       hint: "Paint on the canvas. [B]",                           shortcut: 'B', actionId: 'tool.brush.select',        icon: 'brush' },
      { id: 'tool.eraser',       label: 'Eraser',      hint: "Erase what's there. [E]",                            shortcut: 'E', actionId: 'tool.eraser.select',       icon: 'eraser' },
      { id: 'tool.blur',         label: 'Blur',        hint: 'Soften details under the cursor.',                   shortcut: null, actionId: 'tool.blur.select',         icon: 'blur' },
      { id: 'tool.sharpen',      label: 'Sharpen',     hint: 'Crisp up details under the cursor.',                 shortcut: null, actionId: 'tool.sharpen.select',      icon: 'sharpen' },
      { id: 'tool.dodge',        label: 'Dodge',       hint: 'Brighten the area you paint. [O]',                   shortcut: 'O', actionId: 'tool.dodge.select',        icon: 'dodge' },
      { id: 'tool.burn',         label: 'Burn',        hint: 'Darken the area you paint.',                         shortcut: null, actionId: 'tool.burn.select',         icon: 'burn' },
    ],
  },
  {
    id: 'text',
    tools: [
      { id: 'text.add', label: 'Text', hint: 'Type text onto the canvas. [T]',
        shortcut: 'T', actionId: 'text.create', icon: 'text' },
    ],
  },
  {
    id: 'transform',
    tools: [
      { id: 'transform.crop',  label: 'Crop',   hint: 'Trim the canvas. [C]',      shortcut: 'C', actionId: null, icon: 'crop' },
      { id: 'viewport.hand',   label: 'Hand',   hint: 'Pan the canvas. [Space]',   shortcut: 'Space', actionId: null, icon: 'hand' },
      { id: 'viewport.zoom',   label: 'Zoom',   hint: 'Zoom in or out. [Z]',       shortcut: 'Z', actionId: null, icon: 'zoom' },
    ],
  },
]);

// ── ToolPalette component ──────────────────────────────────────────────────
export default function ToolPalette({ activeToolId = 'tool.brush', onSelect }) {
  const [hoverId, setHoverId] = useState(null);

  return (
    <div role="toolbar" aria-label="Editor tools" style={{ display: 'contents' }}>
      {TOOL_GROUPS.map((group, gi) => (
        <React.Fragment key={group.id}>
          {gi > 0 && <Divider />}
          {group.tools.map(tool => (
            <ToolButton
              key={tool.id}
              tool={tool}
              active={tool.id === activeToolId}
              hovered={hoverId === tool.id}
              onHover={(on) => setHoverId(on ? tool.id : null)}
              onClick={() => {
                if (tool.actionId) executeAction(tool.actionId, tool.actionArgs);
                if (typeof onSelect === 'function') onSelect(tool);
              }}
            />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
}

function Divider() {
  return (
    <div
      aria-hidden
      style={{
        width: 24, height: 1,
        background: COLORS.borderFaint,
        margin: `${SPACING.xs}px 0`,
      }}
    />
  );
}

function ToolButton({ tool, active, hovered, onHover, onClick }) {
  return (
    <div
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
      style={{ position: 'relative' }}
    >
      <button
        type="button"
        onClick={onClick}
        aria-label={tool.label}
        data-tool-id={tool.id}
        aria-pressed={active}
        style={{
          width: 40, height: 40,
          border: 0,
          background: active ? COLORS.bgPanelRaised : 'transparent',
          color: active ? COLORS.cream : COLORS.textSecondary,
          borderRadius: 8,
          cursor: 'pointer',
          boxShadow: active ? SHADOWS.activeToolGlow : 'none',
          transition: transition('all', 'fast'),
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: hovered && !active ? 'scale(1.05)' : 'scale(1)',
        }}
      >
        <Icon kind={tool.icon} />
      </button>

      {hovered && (
        <Tooltip hint={tool.hint} shortcut={tool.shortcut} />
      )}
    </div>
  );
}

// Tooltip positioned to the right of the tool strip. Appears on hover;
// shortcut text sits at the right edge.
function Tooltip({ hint, shortcut }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute',
        left: '100%',
        top: '50%',
        transform: 'translate(10px, -50%)',
        background: COLORS.bgPanelRaised,
        color: COLORS.textPrimary,
        padding: `${SPACING.xs + 2}px ${SPACING.sm}px`,
        borderRadius: 8,
        fontSize: 12,
        border: `1px solid ${COLORS.borderSoft}`,
        boxShadow: SHADOWS.panel,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: SPACING.sm,
      }}
    >
      {hint}
      {shortcut && (
        <kbd
          style={{
            fontFamily: 'inherit',
            fontSize: 10,
            padding: '1px 5px',
            background: COLORS.borderSoft,
            borderRadius: 4,
            color: COLORS.textSecondary,
          }}
        >
          {shortcut}
        </kbd>
      )}
    </div>
  );
}

// ── Inline SVG icons ───────────────────────────────────────────────────────
function Icon({ kind }) {
  const common = { width: 18, height: 18, viewBox: '0 0 24 24', fill: 'none',
                   stroke: 'currentColor', strokeWidth: 1.6, strokeLinecap: 'round',
                   strokeLinejoin: 'round' };
  switch (kind) {
    case 'move':    return <svg {...common}><path d="M5 12h14M12 5v14M8 8L4 12l4 4M16 8l4 4-4 4M8 4l4-4 4 4M8 20l4 4 4-4" /></svg>;
    case 'lasso':   return <svg {...common}><path d="M4 18c0-6 4-12 8-12s8 6 8 12M4 18c0 2 2 3 4 3M14 21c-2 2-6 1-6-2" /></svg>;
    case 'wand':    return <svg {...common}><path d="M15 3l6 6-12 12H3v-6L15 3zM15 9l0 0M14 4l2 2" /></svg>;
    case 'rect':    return <svg {...common}><rect x="4" y="4" width="16" height="16" rx="2" /></svg>;
    case 'circle':  return <svg {...common}><circle cx="12" cy="12" r="8" /></svg>;
    case 'hex':     return <svg {...common}><path d="M12 3l8 5v8l-8 5-8-5V8z" /></svg>;
    case 'star':    return <svg {...common}><path d="M12 3l2.5 5.5 6 .8-4.3 4.2 1 6-5.2-2.7-5.2 2.7 1-6-4.3-4.2 6-.8z" /></svg>;
    case 'brush':   return <svg {...common}><path d="M4 20c3 0 4-2 4-4l10-10-4-4L4 12c-2 0-4 1-4 4s2 4 4 4z" /></svg>;
    case 'eraser':  return <svg {...common}><path d="M16 3l5 5L10 19H5l-2-2v-2L16 3z" /></svg>;
    case 'blur':    return <svg {...common}><circle cx="6" cy="12" r="1" /><circle cx="10" cy="12" r="1.5" /><circle cx="14" cy="12" r="2" /><circle cx="18" cy="12" r="2.5" /></svg>;
    case 'sharpen': return <svg {...common}><path d="M4 18l8-14 8 14M8 18h8" /></svg>;
    case 'dodge':   return <svg {...common}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>;
    case 'burn':    return <svg {...common}><circle cx="12" cy="12" r="8" fill="currentColor" fillOpacity="0.3" /><path d="M12 4v16" /></svg>;
    case 'text':    return <svg {...common}><path d="M5 6h14M12 6v14M9 20h6" /></svg>;
    case 'crop':    return <svg {...common}><path d="M6 2v16h16M2 6h16v16" /></svg>;
    case 'hand':    return <svg {...common}><path d="M7 8v-3a2 2 0 014 0v3M11 8v-4a2 2 0 014 0v4M15 9v-3a2 2 0 014 0v10a6 6 0 01-6 6H9a6 6 0 01-6-6v-4a2 2 0 014 0v2" /></svg>;
    case 'zoom':    return <svg {...common}><circle cx="10" cy="10" r="7" /><path d="M15 15l6 6M7 10h6M10 7v6" /></svg>;
    default:        return <svg {...common}><circle cx="12" cy="12" r="2" /></svg>;
  }
}
