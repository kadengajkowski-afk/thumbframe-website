import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import "./opacity-control.css";

/**
 * Pointer-driven opacity slider with click-to-type numeric entry.
 * Replaces the native <input type="range"> because native sliders
 * can't do shift-for-fine-drag or show our orange fill track
 * consistently across browsers.
 *
 * Behavior:
 *   - Click track → jump to that value, then drag follows cursor
 *   - Shift+drag → delta mode (fine, 1/10× sensitivity), no jump
 *   - Arrow keys when focused → ±1%
 *   - Click the numeric label → input swaps in, Enter/blur commits
 *
 * Value is a 0..1 float (matches docStore). Display is 0..100 integer.
 */
type Props = {
  value: number;
  onChange: (next: number) => void;
  onBeginStroke?: () => void;
  onEndStroke?: () => void;
};

export function OpacityControl({
  value,
  onChange,
  onBeginStroke,
  onEndStroke,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const trackRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const dragRef = useRef<DragState | null>(null);

  const percent = Math.round(value * 100);

  useEffect(() => {
    if (editing) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [editing]);

  const set = (raw: number) => {
    const clamped = Math.max(0, Math.min(100, raw));
    onChange(clamped / 100);
  };

  const onPointerDown = (e: ReactPointerEvent<HTMLDivElement>) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect) return;
    e.preventDefault();
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const startShift = e.shiftKey;
    let startValue = percent;
    if (!startShift) {
      // Non-shift click snaps to cursor position like a native range.
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      set(pct);
      startValue = Math.max(0, Math.min(100, pct));
    }
    onBeginStroke?.();
    dragRef.current = {
      startX: e.clientX,
      startValue,
      width: rect.width,
      startShift,
    };
    window.addEventListener("pointermove", onWindowMove);
    window.addEventListener("pointerup", onWindowUp);
  };

  const onWindowMove = (e: PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    if (e.shiftKey || d.startShift) {
      const delta = ((e.clientX - d.startX) / d.width) * 10; // fine mode
      set(d.startValue + delta);
    } else {
      const rect = trackRef.current?.getBoundingClientRect();
      if (!rect) return;
      const pct = ((e.clientX - rect.left) / rect.width) * 100;
      set(pct);
    }
  };

  const onWindowUp = () => {
    if (!dragRef.current) return;
    dragRef.current = null;
    window.removeEventListener("pointermove", onWindowMove);
    window.removeEventListener("pointerup", onWindowUp);
    onEndStroke?.();
  };

  const onTrackKey = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowRight" || e.key === "ArrowUp") {
      e.preventDefault();
      e.stopPropagation();
      set(percent + (e.shiftKey ? 10 : 1));
    } else if (e.key === "ArrowLeft" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      set(percent - (e.shiftKey ? 10 : 1));
    }
  };

  const startEditing = () => {
    setText(String(percent));
    setEditing(true);
  };

  const commitText = () => {
    const n = Number.parseInt(text, 10);
    if (Number.isFinite(n)) set(n);
    setEditing(false);
  };

  const onInputKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      commitText();
    } else if (e.key === "Escape") {
      e.preventDefault();
      setEditing(false);
    } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
      e.preventDefault();
      e.stopPropagation();
      const current = Number.parseInt(text, 10);
      const base = Number.isFinite(current) ? current : percent;
      setText(String(base + (e.key === "ArrowUp" ? 1 : -1)));
    }
  };

  return (
    <div className="opacity-control">
      <div
        ref={trackRef}
        className="opacity-control__track"
        role="slider"
        tabIndex={0}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Opacity"
        onPointerDown={onPointerDown}
        onKeyDown={onTrackKey}
      >
        <div
          className="opacity-control__fill"
          style={{ width: `${percent}%` }}
        />
        <div
          className="opacity-control__thumb"
          style={{ left: `${percent}%` }}
          aria-hidden="true"
        />
      </div>
      {editing ? (
        <input
          ref={inputRef}
          className="opacity-control__input"
          type="text"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commitText}
          onKeyDown={onInputKey}
          aria-label="Opacity percent"
        />
      ) : (
        <button
          type="button"
          className="opacity-control__value"
          onClick={startEditing}
          aria-label="Edit opacity value"
          title="Click to type a value"
        >
          {percent}%
        </button>
      )}
    </div>
  );
}

type DragState = {
  startX: number;
  startValue: number;
  width: number;
  startShift: boolean;
};
