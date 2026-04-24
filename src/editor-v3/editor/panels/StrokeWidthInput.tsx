import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

/**
 * Compact stroke-width input. Click-to-type numeric (integer, 0..50)
 * and drag the "w" label for a scrub-to-change gesture. One history
 * entry per interaction thanks to the begin/endStroke wrappers.
 */
type Props = {
  value: number;
  onChange: (next: number) => void;
  onBeginStroke?: () => void;
  onEndStroke?: () => void;
  max?: number;
};

export function StrokeWidthInput({
  value,
  onChange,
  onBeginStroke,
  onEndStroke,
  max = 50,
}: Props) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const dragRef = useRef<{ startX: number; startValue: number } | null>(null);

  const set = (raw: number) => {
    const clamped = Math.max(0, Math.min(max, Math.round(raw)));
    onChange(clamped);
  };

  const tryCommit = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) set(n);
    else setText(String(value));
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      tryCommit();
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setText(String(value));
      (e.target as HTMLInputElement).blur();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      set(value + (e.shiftKey ? 10 : 1));
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      set(value - (e.shiftKey ? 10 : 1));
    }
  };

  const onLabelDown = (e: ReactPointerEvent<HTMLSpanElement>) => {
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    dragRef.current = { startX: e.clientX, startValue: value };
    onBeginStroke?.();
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  const onWindowMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const delta = Math.round((e.clientX - d.startX) / 4);
    set(d.startValue + delta);
  };

  const onWindowUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
    onEndStroke?.();
  };

  return (
    <label className="stroke-width">
      <span
        className="stroke-width__label"
        onPointerDown={onLabelDown}
        aria-label="Drag to change stroke width"
      >
        w
      </span>
      <input
        type="text"
        inputMode="numeric"
        className="stroke-width__input"
        value={text}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          setText(e.target.value.replace(/[^0-9]/g, ""))
        }
        onBlur={tryCommit}
        onKeyDown={onKey}
        aria-label="Stroke width in pixels"
      />
    </label>
  );
}
