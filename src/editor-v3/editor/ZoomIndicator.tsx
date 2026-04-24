import { useEffect, useRef, useState } from "react";
import { useUiStore } from "@/state/uiStore";
import { getCurrentCompositor } from "./compositorRef";
import "./zoom-indicator.css";

/**
 * Bottom-right zoom indicator. Shows current zoom %, opens a small
 * popover with Fit + preset zoom levels on click. Positioned
 * absolutely inside the canvas surface <main> in App.tsx.
 */
export function ZoomIndicator() {
  const scale = useUiStore((s) => s.zoomScale);
  const isFit = useUiStore((s) => s.isFitMode);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const label = isFit ? "Fit" : `${Math.round(scale * 100)}%`;

  return (
    <div ref={rootRef} className="zoom-indicator">
      {open && (
        <div className="zoom-indicator__menu" role="menu">
          <PresetItem label="Fit" onPick={() => getCurrentCompositor()?.fit(true)} onClose={() => setOpen(false)} />
          <PresetItem label="50%" onPick={() => getCurrentCompositor()?.setZoomPercent(50, true)} onClose={() => setOpen(false)} />
          <PresetItem label="100%" onPick={() => getCurrentCompositor()?.setZoomPercent(100, true)} onClose={() => setOpen(false)} />
          <PresetItem label="200%" onPick={() => getCurrentCompositor()?.setZoomPercent(200, true)} onClose={() => setOpen(false)} />
          <PresetItem label="400%" onPick={() => getCurrentCompositor()?.setZoomPercent(400, true)} onClose={() => setOpen(false)} />
        </div>
      )}
      <button
        type="button"
        className="zoom-indicator__display"
        onClick={() => setOpen((o) => !o)}
        aria-label="Zoom menu"
        aria-expanded={open}
      >
        {label}
      </button>
    </div>
  );
}

type PresetProps = { label: string; onPick: () => void; onClose: () => void };

function PresetItem({ label, onPick, onClose }: PresetProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className="zoom-indicator__item"
      onClick={() => {
        onPick();
        onClose();
      }}
    >
      {label}
    </button>
  );
}
