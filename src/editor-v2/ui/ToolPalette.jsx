// src/editor-v2/ui/ToolPalette.jsx
// -----------------------------------------------------------------------------
// Purpose:  Phase 4.6.d tool palette. Vertical 48px strip with Lucide
//           icons, six tool groups separated by dividers, and voice-
//           matched tooltips sourced from copy.js.
//
//           Active state: cream-accent glow + icon tint. Hover: 102%
//           scale + brightness(1.15). Collapsible via a chevron at
//           the top — collapsed width is 12px with just the chevron.
//
// Exports:  default (ToolPalette), TOOL_GROUPS
// Depends:  ./tokens, ./copy, ../actions/registry, lucide-react (icons)
// -----------------------------------------------------------------------------

import React, { useState } from 'react';
import {
  MousePointer2, Lasso, Wand2, Target,
  Square, Circle, Hexagon, Star, ArrowRight, Minus, MessageSquare,
  Paintbrush, Eraser, Sun, Flame, Droplet, Wind, Zap, Fingerprint, Copy,
  Bandage, Sparkles,
  Type, Crop, Hand, ZoomIn,
  ChevronLeft, ChevronRight,
} from 'lucide-react';
import { TYPOGRAPHY, SPACING, SHADOWS, buildTransition } from './tokens';
import { COPY } from './copy';
import { executeAction } from '../actions/registry';

// ── Tool definitions ──────────────────────────────────────────────────────
export const TOOL_GROUPS = Object.freeze([
  {
    id: 'select',
    header: 'selection',
    tools: [
      { id: 'tool.move',      label: 'move',      icon: MousePointer2, shortcut: 'V', actionId: 'selection.clear' },
      { id: 'tool.lasso',     label: 'lasso',     icon: Lasso,         shortcut: 'L', actionId: null },
      { id: 'tool.wand',      label: 'magicWand', icon: Wand2,         shortcut: 'W', actionId: null },
      { id: 'tool.sam',       label: 'samSelect', icon: Target,        shortcut: 'S', actionId: null },
    ],
  },
  {
    id: 'shapes',
    header: 'shapes',
    tools: [
      { id: 'shape.rect',         label: 'rectangle',    icon: Square,        shortcut: 'R', actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'rect'   } } },
      { id: 'shape.ellipse',      label: 'ellipse',      icon: Circle,        shortcut: 'O', actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'circle' } } },
      { id: 'shape.polygon',      label: 'polygon',      icon: Hexagon,       shortcut: null, actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'polygon'} } },
      { id: 'shape.star',         label: 'star',         icon: Star,          shortcut: null, actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'star'   } } },
      { id: 'shape.arrow',        label: 'arrow',        icon: ArrowRight,    shortcut: null, actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'arrow'  } } },
      { id: 'shape.line',         label: 'line',         icon: Minus,         shortcut: null, actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'line'   } } },
      { id: 'shape.speechBubble', label: 'speechBubble', icon: MessageSquare, shortcut: null, actionId: 'shape.create', actionArgs: { shapeData: { shapeType: 'speechBubble' } } },
    ],
  },
  {
    id: 'paint',
    header: 'paint',
    tools: [
      { id: 'tool.brush',         label: 'brush',         icon: Paintbrush,  shortcut: 'B', actionId: 'tool.brush.select' },
      { id: 'tool.eraser',        label: 'eraser',        icon: Eraser,      shortcut: 'E', actionId: 'tool.eraser.select' },
      { id: 'tool.dodge',         label: 'dodge',         icon: Sun,         shortcut: null, actionId: 'tool.dodge.select' },
      { id: 'tool.burn',          label: 'burn',          icon: Flame,       shortcut: null, actionId: 'tool.burn.select' },
      { id: 'tool.sponge',        label: 'sponge',        icon: Droplet,     shortcut: null, actionId: 'tool.sponge.select' },
      { id: 'tool.blur',          label: 'blur',          icon: Wind,        shortcut: null, actionId: 'tool.blur.select' },
      { id: 'tool.sharpen',       label: 'sharpen',       icon: Zap,         shortcut: null, actionId: 'tool.sharpen.select' },
      { id: 'tool.smudge',        label: 'smudge',        icon: Fingerprint, shortcut: null, actionId: 'tool.smudge.select' },
      { id: 'tool.clone',         label: 'clone',         icon: Copy,        shortcut: null, actionId: 'tool.cloneStamp.select' },
      { id: 'tool.spotHeal',      label: 'spotHeal',      icon: Bandage,     shortcut: null, actionId: 'tool.spotHeal.select' },
      { id: 'tool.lightPainting', label: 'lightPainting', icon: Sparkles,    shortcut: null, actionId: 'tool.lightPainting.select' },
    ],
  },
  {
    id: 'text',
    header: 'text',
    tools: [
      { id: 'tool.text', label: 'text', icon: Type, shortcut: 'T', actionId: 'text.create' },
    ],
  },
  {
    id: 'crop',
    header: 'crop',
    tools: [
      { id: 'tool.crop', label: 'crop', icon: Crop, shortcut: 'C', actionId: null },
    ],
  },
  {
    id: 'viewport',
    header: 'viewport',
    tools: [
      { id: 'tool.hand', label: 'hand', icon: Hand,   shortcut: 'H', actionId: null },
      { id: 'tool.zoom', label: 'zoom', icon: ZoomIn, shortcut: 'Z', actionId: null },
    ],
  },
]);

/**
 * @param {{
 *   activeToolId?: string,
 *   onSelect?: (tool: any) => void,
 * }} props
 */
export default function ToolPalette({ activeToolId = 'tool.brush', onSelect }) {
  const [collapsed, setCollapsed] = useState(false);
  const [hoverId, setHoverId] = useState(null);

  return (
    <div
      role="toolbar"
      aria-label={COPY.tools.groupHeaders.selection}
      data-tool-palette
      data-collapsed={collapsed ? 'true' : 'false'}
      style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        gap: SPACING.xs,
        paddingBlock: SPACING.xs,
        width: collapsed ? 12 : 48,
        transition: buildTransition('width', 'standard'),
      }}
    >
      <button
        type="button"
        aria-label={collapsed ? 'Expand tool palette' : 'Collapse tool palette'}
        onClick={() => setCollapsed(v => !v)}
        data-tool-palette-toggle
        style={iconButtonStyle(false, false)}
      >
        {collapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
      </button>

      {!collapsed && TOOL_GROUPS.map((group, gi) => (
        <React.Fragment key={group.id}>
          {gi > 0 && <Divider />}
          {group.tools.map(tool => (
            <ToolButton
              key={tool.id}
              tool={tool}
              active={activeToolId === tool.id}
              hovered={hoverId === tool.id}
              onHover={(on) => setHoverId(on ? tool.id : null)}
              onClick={() => {
                if (tool.actionId) executeAction(tool.actionId, tool.actionArgs);
                onSelect?.(tool);
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
        background: 'var(--border-subtle)',
        margin: `${SPACING.xs}px 0`,
      }}
    />
  );
}

function ToolButton({ tool, active, hovered, onHover, onClick }) {
  const Icon = tool.icon;
  return (
    <div
      style={{ position: 'relative' }}
      onMouseEnter={() => onHover(true)}
      onMouseLeave={() => onHover(false)}
    >
      <button
        type="button"
        aria-label={COPY.tools[tool.label]}
        aria-pressed={active}
        data-tool-id={tool.id}
        onClick={onClick}
        style={iconButtonStyle(active, hovered)}
      >
        <Icon size={20} />
      </button>
      {hovered && <Tooltip text={COPY.tools[tool.label]} />}
    </div>
  );
}

function Tooltip({ text }) {
  return (
    <div
      role="tooltip"
      style={{
        position: 'absolute', left: '100%', top: '50%',
        transform: 'translate(10px, -50%)',
        background: 'var(--panel-bg-raised)',
        color: 'var(--text-primary)',
        padding: `${SPACING.xs + 2}px ${SPACING.sm}px`,
        borderRadius: 8,
        fontSize: TYPOGRAPHY.sizeSm,
        border: '1px solid var(--border-soft)',
        boxShadow: SHADOWS.panel,
        whiteSpace: 'nowrap',
        pointerEvents: 'none',
        zIndex: 100,
      }}
    >
      {text}
    </div>
  );
}

function iconButtonStyle(active, hovered) {
  return {
    width: 36, height: 36,
    border: 0,
    background: active ? 'var(--panel-bg-raised)' : 'transparent',
    color: active ? 'var(--accent-cream)' : 'var(--text-secondary)',
    borderRadius: 8,
    cursor: 'pointer',
    boxShadow: active ? SHADOWS.activeToolGlow : 'none',
    transition: buildTransition('all', 'fast'),
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    transform: hovered && !active ? 'scale(1.02)' : 'scale(1)',
    filter: hovered && !active ? 'brightness(1.15)' : 'brightness(1)',
    padding: 0,
  };
}
