import { useRef } from "react";
import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { DraggableLayerRow } from "./DraggableLayerRow";
import "./layer-panel.css";

/**
 * Full-width bottom panel. Rows reverse docStore.layers so the
 * visually-topmost layer renders first (Figma/Photoshop convention).
 * The display-index ↔ array-index translation happens in
 * handleDragEnd so DraggableLayerRow can stay oblivious to it.
 *
 * Day 15 multi-select rules — applied to row clicks via the modifier
 * flags forwarded from DraggableLayerRow:
 *   - plain          → replace selection with just this row
 *   - cmd / ctrl     → toggle this row's membership (preserve rest)
 *   - shift          → select range from anchor to this row (visual
 *                      order — same row order the panel renders)
 *
 * The shift-anchor is the most-recently single-clicked row id, kept
 * in a ref so range selects don't drift when re-renders happen.
 */
export function LayerPanel() {
  const layers = useDocStore((s) => s.layers);
  const selectedIds = useUiStore((s) => s.selectedLayerIds);
  const setSelectedLayerIds = useUiStore((s) => s.setSelectedLayerIds);
  const shiftAnchorRef = useRef<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reversed = [...layers].reverse();
  const reversedIds = reversed.map((l) => l.id);

  function handleRowSelect(layerId: string, mods: { shift: boolean; meta: boolean }) {
    if (mods.shift && shiftAnchorRef.current && shiftAnchorRef.current !== layerId) {
      // Range select — visual (reversed) order. Pick every id between
      // the anchor and the click, inclusive of both ends.
      const a = reversedIds.indexOf(shiftAnchorRef.current);
      const b = reversedIds.indexOf(layerId);
      if (a >= 0 && b >= 0) {
        const lo = Math.min(a, b);
        const hi = Math.max(a, b);
        setSelectedLayerIds(reversedIds.slice(lo, hi + 1));
        return;
      }
    }
    if (mods.meta) {
      // Toggle membership.
      setSelectedLayerIds(
        selectedIds.includes(layerId)
          ? selectedIds.filter((id) => id !== layerId)
          : [...selectedIds, layerId],
      );
      shiftAnchorRef.current = layerId;
      return;
    }
    // Plain click — replace selection.
    setSelectedLayerIds([layerId]);
    shiftAnchorRef.current = layerId;
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const toDisplay = reversedIds.indexOf(String(over.id));
    if (toDisplay < 0) return;
    // Display index → array index: the list is rendered reversed, so
    // display[0] is the last array entry and vice versa.
    const arrayTarget = layers.length - 1 - toDisplay;
    history.reorderLayer(String(active.id), arrayTarget);
  }

  return (
    <section
      className="layer-panel"
      aria-label="Layers"
      data-alive="layerpanel"
    >
      <header className="layer-panel__header">Layers</header>
      {layers.length === 0 ? (
        <div className="layer-panel__empty">
          Drop something here, or press R to draw a rectangle.
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={reversedIds}
            strategy={verticalListSortingStrategy}
          >
            <ul className="layer-panel__list">
              {reversed.map((layer) => (
                <DraggableLayerRow
                  key={layer.id}
                  layer={layer}
                  selected={selectedIds.includes(layer.id)}
                  onSelect={(mods) => handleRowSelect(layer.id, mods)}
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
