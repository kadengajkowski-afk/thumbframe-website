import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";

/**
 * Inline-rename text field for LayerPanel rows. Mounted when the user
 * double-clicks a layer name. Auto-selects the whole value on mount so
 * typing replaces the name in one motion. Enter / blur commit; Escape
 * reverts. Empty string reverts.
 */
type Props = {
  initialValue: string;
  onCommit: (next: string) => void;
  onCancel: () => void;
};

export function RenameInput({ initialValue, onCommit, onCancel }: Props) {
  const [value, setValue] = useState(initialValue);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const finish = () => {
    const trimmed = value.trim();
    if (trimmed.length === 0 || trimmed === initialValue) {
      onCancel();
      return;
    }
    onCommit(trimmed);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      finish();
    } else if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
    }
    // Stop arrow keys from reaching the global hotkey listener (layer
    // nudge) while the user is editing text.
    if (
      e.key === "ArrowLeft" ||
      e.key === "ArrowRight" ||
      e.key === "ArrowUp" ||
      e.key === "ArrowDown"
    ) {
      e.stopPropagation();
    }
  };

  return (
    <input
      ref={inputRef}
      type="text"
      className="layer-row__rename"
      value={value}
      onChange={(e) => setValue(e.target.value)}
      onBlur={finish}
      onKeyDown={onKey}
      onClick={(e) => e.stopPropagation()}
      onDoubleClick={(e) => e.stopPropagation()}
      maxLength={120}
      aria-label="Layer name"
    />
  );
}
