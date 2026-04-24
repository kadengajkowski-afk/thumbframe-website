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
 */
export function LayerPanel() {
  const layers = useDocStore((s) => s.layers);
  const selectedIds = useUiStore((s) => s.selectedLayerIds);
  const setSelectedLayerIds = useUiStore((s) => s.setSelectedLayerIds);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reversed = [...layers].reverse();
  const reversedIds = reversed.map((l) => l.id);

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
                  onSelect={() =>
                    setSelectedLayerIds(
                      selectedIds.includes(layer.id) ? [] : [layer.id],
                    )
                  }
                />
              ))}
            </ul>
          </SortableContext>
        </DndContext>
      )}
    </section>
  );
}
