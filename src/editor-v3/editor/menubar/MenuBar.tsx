import { useCallback, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { MENUS, type Menu, type MenuItem } from "./menubar-data";
import "./menubar.css";

/** Day 64c — Photopea-style top menu bar.
 *
 *  Hand-rolled (no Radix). Behaviors per spec:
 *    - Click menu trigger: open dropdown (or close if same trigger).
 *    - Click outside / Esc: close.
 *    - Hover from one open menu trigger to an adjacent trigger:
 *      switch dropdown without closing first (Photopea pattern).
 *    - Arrow Up/Down inside an open menu: move focus through items.
 *    - Arrow Left/Right inside an open menu: switch to neighbor menu.
 *    - Enter on a focused item: trigger it + close.
 *
 *  Dropdowns render via a Portal anchored under each trigger so the
 *  parchment shadow can extend past the wood-strip without clipping. */

export function MenuBar() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [focusIndex, setFocusIndex] = useState(0);
  const triggerRefs = useRef<Map<string, HTMLButtonElement>>(new Map());

  const openMenu = useCallback((id: string) => {
    setOpenId(id);
    setFocusIndex(0);
  }, []);

  const closeMenu = useCallback(() => {
    setOpenId(null);
  }, []);

  // Esc closes globally. Listener mounts only when a menu is open
  // so it doesn't shadow hotkeys when closed.
  useEffect(() => {
    if (!openId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        closeMenu();
        triggerRefs.current.get(openId)?.focus();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [openId, closeMenu]);

  const onTriggerEnter = useCallback(
    (id: string) => {
      // Photopea behavior — once one menu is open, hovering an
      // adjacent trigger swaps the dropdown.
      setOpenId((prev) => (prev !== null && prev !== id ? id : prev));
      if (openId !== null) setFocusIndex(0);
    },
    [openId],
  );

  const onTriggerKey = useCallback(
    (e: React.KeyboardEvent<HTMLButtonElement>, idx: number) => {
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const nextIdx = (idx + dir + MENUS.length) % MENUS.length;
        const nextMenu = MENUS[nextIdx]!;
        triggerRefs.current.get(nextMenu.id)?.focus();
        if (openId !== null) {
          setOpenId(nextMenu.id);
          setFocusIndex(0);
        }
      } else if (e.key === "ArrowDown" || e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        const m = MENUS[idx];
        if (m) openMenu(m.id);
      }
    },
    [openId, openMenu],
  );

  return (
    <div className="tf-menubar" data-alive="menubar">
      {MENUS.map((menu, idx) => (
        <MenuTrigger
          key={menu.id}
          menu={menu}
          isOpen={openId === menu.id}
          index={idx}
          registerRef={(el) => {
            if (el) triggerRefs.current.set(menu.id, el);
            else triggerRefs.current.delete(menu.id);
          }}
          onClick={() => (openId === menu.id ? closeMenu() : openMenu(menu.id))}
          onPointerEnter={() => onTriggerEnter(menu.id)}
          onKeyDown={(e) => onTriggerKey(e, idx)}
        />
      ))}

      {openId && (
        <DropdownPortal
          menu={MENUS.find((m) => m.id === openId)!}
          anchor={triggerRefs.current.get(openId) ?? null}
          focusIndex={focusIndex}
          setFocusIndex={setFocusIndex}
          close={closeMenu}
          switchToMenu={(id) => {
            setOpenId(id);
            setFocusIndex(0);
            triggerRefs.current.get(id)?.focus();
          }}
        />
      )}
    </div>
  );
}

function MenuTrigger({
  menu,
  isOpen,
  index,
  registerRef,
  onClick,
  onPointerEnter,
  onKeyDown,
}: {
  menu: Menu;
  isOpen: boolean;
  index: number;
  registerRef: (el: HTMLButtonElement | null) => void;
  onClick: () => void;
  onPointerEnter: () => void;
  onKeyDown: (e: React.KeyboardEvent<HTMLButtonElement>) => void;
}) {
  void index;
  return (
    <button
      ref={registerRef}
      type="button"
      className={`tf-menubar-trigger${isOpen ? " is-open" : ""}`}
      onClick={onClick}
      onPointerEnter={onPointerEnter}
      onKeyDown={onKeyDown}
      aria-haspopup="menu"
      aria-expanded={isOpen}
    >
      {menu.label}
    </button>
  );
}

function DropdownPortal({
  menu,
  anchor,
  focusIndex,
  setFocusIndex,
  close,
  switchToMenu,
}: {
  menu: Menu;
  anchor: HTMLElement | null;
  focusIndex: number;
  setFocusIndex: (i: number) => void;
  close: () => void;
  switchToMenu: (id: string) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const itemIndices = menu.items
    .map((it, i) => ({ it, i }))
    .filter(({ it }) => it.kind === "item");

  // Outside-click close. Bound on document at capture so it fires
  // before any onClick swallows the event.
  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (ref.current?.contains(target)) return;
      if (anchor?.contains(target)) return;
      // If click landed on another menu trigger inside the menubar,
      // the parent's pointerenter / click logic will handle the swap.
      // Bail out of close so we don't double-toggle.
      const inMenubar = (target as HTMLElement)?.closest?.(".tf-menubar");
      if (inMenubar) return;
      close();
    };
    document.addEventListener("mousedown", onDown, true);
    return () => document.removeEventListener("mousedown", onDown, true);
  }, [anchor, close]);

  // Arrow nav within the dropdown. Enter triggers the focused item.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = (focusIndex + 1) % itemIndices.length;
        setFocusIndex(next);
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        const prev = (focusIndex - 1 + itemIndices.length) % itemIndices.length;
        setFocusIndex(prev);
      } else if (e.key === "Enter") {
        e.preventDefault();
        const target = itemIndices[focusIndex];
        if (target && target.it.kind === "item" && !target.it.disabled) {
          target.it.onSelect();
          close();
        }
      } else if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
        e.preventDefault();
        const dir = e.key === "ArrowRight" ? 1 : -1;
        const idx = MENUS.findIndex((m) => m.id === menu.id);
        const nextIdx = (idx + dir + MENUS.length) % MENUS.length;
        const nextMenu = MENUS[nextIdx];
        if (nextMenu) switchToMenu(nextMenu.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [focusIndex, itemIndices, menu.id, setFocusIndex, close, switchToMenu]);

  if (!anchor) return null;
  const rect = anchor.getBoundingClientRect();
  const dropdownStyle: CSSProperties = {
    position: "fixed",
    top: rect.bottom,
    left: rect.left,
  };

  return createPortal(
    <div
      ref={ref}
      className="tf-menubar-dropdown"
      style={dropdownStyle}
      role="menu"
    >
      {menu.items.map((item, i) => {
        if (item.kind === "divider") {
          return <div key={`d-${i}`} className="tf-menubar-divider" role="separator" />;
        }
        const focused = itemIndices.findIndex((x) => x.i === i) === focusIndex;
        return (
          <button
            key={item.label}
            type="button"
            role="menuitem"
            className={`tf-menubar-item${focused ? " is-focused" : ""}${item.disabled ? " is-disabled" : ""}`}
            disabled={item.disabled}
            onMouseEnter={() => {
              const idx = itemIndices.findIndex((x) => x.i === i);
              if (idx >= 0) setFocusIndex(idx);
            }}
            onClick={() => {
              if (item.disabled) return;
              item.onSelect();
              close();
            }}
          >
            <span className="tf-menubar-item-label">{item.label}</span>
            {item.hotkey && (
              <span className="tf-menubar-item-hotkey">{prettyHotkey(item.hotkey)}</span>
            )}
          </button>
        );
      })}
    </div>,
    document.body,
  );
}

const IS_MAC = typeof navigator !== "undefined" && /Mac|iPad|iPhone/.test(navigator.platform);

function prettyHotkey(s: string): string {
  if (!IS_MAC) return s.replace(/Cmd/g, "Ctrl");
  return s.replace(/Cmd/g, "⌘").replace(/Shift/g, "⇧").replace(/Alt/g, "⌥").replace(/\+/g, "");
}

export type { MenuItem };
