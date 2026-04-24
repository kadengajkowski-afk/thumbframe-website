import { useState, type CSSProperties } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { Layer } from "@/state/types";
import { history } from "@/lib/history";
import {
  EyeIcon,
  EyeOffIcon,
  LockClosedIcon,
  LockOpenIcon,
  TrashIcon,
} from "./LayerPanel.icons";
import { RenameInput } from "./RenameInput";

/**
 * A single, sortable layer row. Wraps @dnd-kit's useSortable around
 * the row markup so LayerPanel only has to plant a DndContext +
 * SortableContext and hand us the layers.
 *
 * Icon toggles stopPropagation so clicking an eye doesn't also start
 * a drag or toggle the row selection.
 */
type Props = {
  layer: Layer;
  selected: boolean;
  onSelect: () => void;
};

export function DraggableLayerRow({ layer, selected, onSelect }: Props) {
  const [renaming, setRenaming] = useState(false);
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
    isOver,
    activeIndex,
    overIndex,
    index,
  } = useSortable({ id: layer.id });

  const dropAbove = !isDragging && isOver && activeIndex > overIndex;
  const dropBelow = !isDragging && isOver && activeIndex < overIndex;

  const liStyle: CSSProperties = {
    listStyle: "none",
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
    filter: isDragging
      ? "drop-shadow(0 8px 14px rgba(0,0,0,0.45))"
      : undefined,
    position: "relative",
  };

  const classes = [
    "layer-row",
    selected ? "layer-row--selected" : "",
    layer.hidden ? "layer-row--hidden" : "",
    isDragging ? "layer-row--dragging" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <li ref={setNodeRef} style={liStyle}>
      {dropAbove && <div className="layer-row__drop layer-row__drop--above" />}
      <div
        {...attributes}
        {...listeners}
        className={classes}
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onSelect();
          }
        }}
      >
        <span
          className="layer-row__swatch"
          style={{ background: swatchBackground(layer) }}
          aria-hidden="true"
        />
        {renaming ? (
          <RenameInput
            initialValue={layer.name}
            onCommit={(next) => {
              history.setLayerName(layer.id, next);
              setRenaming(false);
            }}
            onCancel={() => setRenaming(false)}
          />
        ) : (
          <span
            className="layer-row__name"
            onDoubleClick={(e) => {
              e.stopPropagation();
              setRenaming(true);
            }}
            title="Double-click to rename"
          >
            {layer.name}
          </span>
        )}
        <LayerMeta layer={layer} />
        <VisibilityToggle
          hidden={layer.hidden}
          onClick={(e) => {
            e.stopPropagation();
            history.toggleLayerVisibility(layer.id);
          }}
        />
        <LockToggle
          locked={layer.locked}
          onClick={(e) => {
            e.stopPropagation();
            history.toggleLayerLock(layer.id);
          }}
        />
        <DeleteButton
          onClick={(e) => {
            e.stopPropagation();
            history.deleteLayer(layer.id);
          }}
        />
      </div>
      {dropBelow && <div className="layer-row__drop layer-row__drop--below" />}
    </li>
  );
}

function swatchBackground(layer: Layer): string {
  if (layer.type === "rect") {
    return `#${layer.color.toString(16).padStart(6, "0")}`;
  }
  return "linear-gradient(135deg, var(--bg-space-2) 0%, var(--accent-navy) 100%)";
}

function LayerMeta({ layer }: { layer: Layer }) {
  const parts: string[] = [];
  if (layer.blendMode !== "normal") parts.push(prettyBlend(layer.blendMode));
  if (layer.opacity < 1) parts.push(`${Math.round(layer.opacity * 100)}%`);
  if (parts.length === 0) return null;
  return <span className="layer-row__meta">{parts.join(" · ")}</span>;
}

function prettyBlend(mode: Layer["blendMode"]): string {
  return mode
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

type ToggleProps = { onClick: (e: React.MouseEvent) => void };

function VisibilityToggle({
  hidden,
  onClick,
}: ToggleProps & { hidden: boolean }) {
  return (
    <button
      type="button"
      className={
        "layer-row__toggle" + (hidden ? "" : " layer-row__toggle--active")
      }
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={hidden ? "Show layer" : "Hide layer"}
    >
      {hidden ? <EyeOffIcon /> : <EyeIcon />}
    </button>
  );
}

function LockToggle({
  locked,
  onClick,
}: ToggleProps & { locked: boolean }) {
  return (
    <button
      type="button"
      className={
        "layer-row__toggle" + (locked ? " layer-row__toggle--active" : "")
      }
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label={locked ? "Unlock layer" : "Lock layer"}
    >
      {locked ? <LockClosedIcon /> : <LockOpenIcon />}
    </button>
  );
}

function DeleteButton({ onClick }: ToggleProps) {
  return (
    <button
      type="button"
      className="layer-row__delete"
      onClick={onClick}
      onPointerDown={(e) => e.stopPropagation()}
      aria-label="Delete layer"
    >
      <TrashIcon />
    </button>
  );
}
