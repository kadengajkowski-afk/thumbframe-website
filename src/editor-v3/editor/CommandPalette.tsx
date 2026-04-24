import { useEffect, useMemo } from "react";
import { Command } from "cmdk";
import { useUiStore } from "@/state/uiStore";
import {
  listCommands,
  runCommand,
  type Command as EditorCommand,
} from "@/lib/commands";
import "./command-palette.css";

/**
 * Cmd+K command palette. Wraps the cmdk primitive so we get fuzzy
 * matching + keyboard nav for free, then styles it into the
 * Observatory aesthetic: centered modal, --bg-space-2 with
 * --accent-orange on the highlighted row, backdrop at 70% opacity.
 *
 * Every user-invokable action lives in lib/commands.ts; hotkeys and
 * the palette share the same runCommand dispatch so the palette is
 * never "ahead" of what's reachable by keyboard.
 */
export function CommandPalette() {
  const open = useUiStore((s) => s.commandPaletteOpen);
  const setOpen = useUiStore((s) => s.setCommandPaletteOpen);

  const commands = useMemo(() => listCommands(), []);
  const sections = useMemo(() => groupBySection(commands), [commands]);

  // Close on Escape. cmdk handles it internally for its <Dialog>
  // mode, but we use inline mount so add the listener ourselves.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, setOpen]);

  if (!open) return null;

  const fire = (id: string) => {
    runCommand(id);
    setOpen(false);
  };

  return (
    <div
      className="cmd-scrim"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false);
      }}
      role="presentation"
    >
      <Command className="cmd" label="Command palette">
        <Command.Input
          className="cmd__input"
          placeholder="Run a command…"
          autoFocus
        />
        <Command.List className="cmd__list">
          <Command.Empty className="cmd__empty">
            Nothing matches.
          </Command.Empty>
          {sections.map(({ section, items }) => (
            <Command.Group
              key={section}
              heading={section}
              className="cmd__group"
            >
              {items.map((cmd) => (
                <Command.Item
                  key={cmd.id}
                  value={searchValue(cmd)}
                  onSelect={() => fire(cmd.id)}
                  className="cmd__item"
                >
                  <span className="cmd__label">{cmd.label}</span>
                  {cmd.hotkey && (
                    <span className="cmd__hotkey">{cmd.hotkey}</span>
                  )}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
        </Command.List>
      </Command>
    </div>
  );
}

function searchValue(cmd: EditorCommand): string {
  return [cmd.label, cmd.id, ...(cmd.aliases ?? [])].join(" ");
}

function groupBySection(commands: readonly EditorCommand[]) {
  const map = new Map<string, EditorCommand[]>();
  for (const c of commands) {
    const arr = map.get(c.section) ?? [];
    arr.push(c);
    map.set(c.section, arr);
  }
  return Array.from(map, ([section, items]) => ({ section, items }));
}
