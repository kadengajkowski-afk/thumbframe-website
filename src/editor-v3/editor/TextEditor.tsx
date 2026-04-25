import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { history } from "@/lib/history";
import { ensureFontLoaded } from "@/lib/fonts";
import { pixiToHex } from "@/lib/color";
import { getCurrentCompositor } from "./compositorRef";
import { PLACEHOLDER_TEXT_VALUE } from "./tools/TextTool";

/** Excalidraw-pattern inline edit. While uiStore.editingTextLayerId
 * is set, this overlay renders a positioned <textarea> on top of the
 * canvas at the layer's screen position, matching the layer's font
 * styling. The Pixi text node is alpha=0 during the edit so the user
 * sees only the textarea.
 *
 * Commit triggers: blur, Escape, Cmd/Ctrl+Enter. Empty commit deletes
 * the layer entirely. Local state holds the in-progress text — we do
 * NOT mutate docStore on every keystroke (would explode the undo
 * stack and re-trigger Compositor reconciles). */
export function TextEditor() {
  const editingId = useUiStore((s) => s.editingTextLayerId);
  const layer = useDocStore((d) =>
    d.layers.find((l) => l.id === editingId && l.type === "text"),
  );
  // DIAGNOSTIC — remove after bug closed.
  console.log("[TE/render] editingId=", editingId, "layerFound=", !!layer);
  if (!editingId || !layer || layer.type !== "text") return null;
  return <ActiveEditor key={editingId} layerId={editingId} />;
}

function ActiveEditor({ layerId }: { layerId: string }) {
  const layer = useDocStore((d) =>
    d.layers.find((l) => l.id === layerId && l.type === "text"),
  );
  const [draft, setDraft] = useState(
    layer && layer.type === "text" ? layer.text : "",
  );
  const [, setTick] = useState(0);
  const taRef = useRef<HTMLTextAreaElement>(null);

  // Keep the overlay aligned through pan/zoom by re-rendering on
  // viewport movement.
  useEffect(() => {
    const compositor = getCurrentCompositor();
    if (!compositor) return;
    const bump = () => setTick((n) => n + 1);
    compositor.viewport.on("moved", bump);
    compositor.viewport.on("zoomed", bump);
    return () => {
      compositor.viewport.off("moved", bump);
      compositor.viewport.off("zoomed", bump);
    };
  }, []);

  // Auto-focus + select-all on mount so the placeholder ("Type
  // something") is fully selected — first keystroke replaces it.
  useLayoutEffect(() => {
    const ta = taRef.current;
    console.log("[TE/useLayoutEffect] ta=", !!ta);
    if (!ta) return;
    ta.focus();
    ta.select();
    console.log("[TE/useLayoutEffect] focus called, activeElement=", document.activeElement?.tagName, "isTa=", document.activeElement === ta);
  }, []);

  // Re-paint when the font lands so the textarea metrics line up
  // with the rendered Pixi text after commit.
  const fontFamily = layer && layer.type === "text" ? layer.fontFamily : null;
  const fontWeight = layer && layer.type === "text" ? layer.fontWeight : null;
  useEffect(() => {
    if (!fontFamily || fontWeight == null) return;
    void ensureFontLoaded(fontFamily, fontWeight).then(() => {
      setTick((n) => n + 1);
    });
  }, [fontFamily, fontWeight]);

  if (!layer || layer.type !== "text") return null;

  const compositor = getCurrentCompositor();
  if (!compositor) return null;
  const screen = compositor.canvasToScreen({ x: layer.x, y: layer.y });
  const scale = compositor.viewportScale;

  function commit() {
    const trimmed = draft.trim();
    const original = layer && layer.type === "text" ? layer.text : "";
    const ui = useUiStore.getState();
    ui.setEditingTextLayerId(null);
    if (trimmed.length === 0) {
      history.deleteLayer(layerId);
      return;
    }
    if (draft !== original) history.setText(layerId, draft);
  }

  function cancel() {
    // Cancel mirrors commit but doesn't push the draft. If the layer
    // still has the placeholder text from a fresh placement, dropping
    // it tidies up — otherwise leave the original untouched.
    const ui = useUiStore.getState();
    ui.setEditingTextLayerId(null);
    if (layer && layer.type === "text" && layer.text === PLACEHOLDER_TEXT_VALUE) {
      history.deleteLayer(layerId);
    }
  }

  const style: CSSProperties = {
    position: "absolute",
    top: screen.y,
    left: screen.x,
    transformOrigin: "top left",
    transform: `scale(${scale})`,
    fontFamily: `"${layer.fontFamily}", system-ui, sans-serif`,
    fontSize: `${layer.fontSize}px`,
    fontWeight: layer.fontWeight,
    fontStyle: layer.fontStyle,
    color: pixiToHex(layer.color),
    opacity: layer.fillAlpha,
    textAlign: layer.align,
    lineHeight: layer.lineHeight,
    letterSpacing: `${layer.letterSpacing}px`,
    background: "transparent",
    border: "1px dashed var(--accent-orange)",
    outline: "none",
    padding: "2px 4px",
    margin: "-3px -5px",
    minWidth: 60,
    minHeight: layer.fontSize * layer.lineHeight,
    width: "auto",
    resize: "none",
    overflow: "hidden",
    whiteSpace: "pre",
    zIndex: 30,
    boxSizing: "content-box",
    pointerEvents: "auto",
  };

  return (
    <textarea
      ref={taRef}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          // Stop the global hotkey from also firing.
          e.stopPropagation();
          cancel();
        } else if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
          e.preventDefault();
          e.stopPropagation();
          commit();
        }
      }}
      style={style}
      rows={1}
      cols={1}
      data-text-editor="true"
    />
  );
}
