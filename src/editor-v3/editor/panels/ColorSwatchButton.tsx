import { useEffect, useRef, useState, type CSSProperties } from "react";
import { pixiToHex } from "@/lib/color";
import { ColorPicker } from "./ColorPicker";

/**
 * Swatch button that opens a ColorPicker popover below it. Parent
 * supplies history-aware begin/end callbacks so one picker session
 * yields one undo entry.
 *
 * `onChange` fires live (during the stroke) so the canvas previews
 * the color in real time. `onEndEdit` fires on close — that's when
 * we close the stroke and push the final hex onto recents.
 */
type Props = {
  color: number; // 0xRRGGBB
  alpha: number; // 0..1
  onBeginEdit: () => void;
  onChange: (color: number, alpha: number) => void;
  onEndEdit: () => void;
  label?: string;
};

export function ColorSwatchButton({
  color,
  alpha,
  onBeginEdit,
  onChange,
  onEndEdit,
  label,
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const close = () => {
    setOpen(false);
    onEndEdit();
  };

  const toggle = () => {
    if (open) close();
    else {
      onBeginEdit();
      setOpen(true);
    }
  };

  const hex = pixiToHex(color);
  const swatchStyle: CSSProperties = {
    background: hex,
    opacity: alpha,
  };

  return (
    <div ref={rootRef} className="color-swatch">
      <button
        type="button"
        className="color-swatch__btn"
        style={swatchStyle}
        onClick={toggle}
        aria-label={label ? `${label} color ${hex}` : `Color ${hex}`}
        aria-expanded={open}
        aria-haspopup="dialog"
      />
      {open && (
        <div className="color-swatch__popover" role="dialog">
          <ColorPicker
            color={color}
            alpha={alpha}
            onColorChange={(next) => onChange(next, alpha)}
            onAlphaChange={(next) => onChange(color, next)}
          />
        </div>
      )}
    </div>
  );
}
