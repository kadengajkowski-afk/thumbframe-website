import { useUiStore } from "@/state/uiStore";
import { getCrew } from "@/lib/crew";
import { ThumbFriendShipIcon } from "./ThumbFriendShipIcon";
import { Tooltip } from "./Tooltip";

/** Day 53 — ThumbFriend toolbar entry. Click toggles the panel; the
 * ship icon's porthole shows the active crew avatar so the user can
 * see at a glance who's "on watch". Tooltip surfaces the crew name +
 * the Cmd+/ shortcut.
 *
 * Stays a separate component so the toolbar doesn't grow another
 * branch — the ship icon, the active-state mapping, and the tooltip
 * shape all belong together. */
export function ThumbFriendToolbarButton() {
  const open = useUiStore((s) => s.thumbfriendPanelOpen);
  const setOpen = useUiStore((s) => s.setThumbfriendPanelOpen);
  const crewId = useUiStore((s) => s.activeCrewMember);
  const crew = getCrew(crewId);

  return (
    <Tooltip label={`ThumbFriend — ${crew.name}`} shortcut="⌘/">
      <button
        type="button"
        className={open ? "tool-button tool-button--active" : "tool-button"}
        onClick={() => setOpen(!open)}
        aria-label={`ThumbFriend (${crew.name})`}
        aria-pressed={open}
        data-testid="tool-palette-thumbfriend"
      >
        <ThumbFriendShipIcon crewId={crew.id} active={open} />
      </button>
    </Tooltip>
  );
}
