import type { ToolId } from "@/editor/tools/tools";
import {
  SelectIcon,
  HandIcon,
  RectIcon,
  EllipseIcon,
  TextIcon,
  UploadIcon as Day63UploadIcon,
} from "@/editor/icons/Icons";

/** Day 65a — ToolPalette icons re-export the Day 63 painterly icon
 *  set (src/editor-v3/editor/icons/Icons.tsx).
 *
 *  Drawing tools dispatched by ToolId:
 *    select  → SelectIcon (quill-nib cursor, brass shoulder bead)
 *    hand    → HandIcon (4 fingers + palm + brass wrist anchor)
 *    rect    → RectIcon (irregular corners + 4 brass rivets)
 *    ellipse → EllipseIcon (organic path, 4 compass-point rivets)
 *    text    → TextIcon (inkwell + rising quill + brass ink drop)
 *
 *  The Upload action icon also re-exports from Day 63 so the
 *  toolbar's upload button gets the new parchment-scroll glyph
 *  with brass wax seal.
 *
 *  Maintains the same exported names + signatures the ToolPalette
 *  already imports — zero call-site changes.
 */

export function ToolIcon({ id }: { id: ToolId }) {
  if (id === "select")  return <SelectIcon />;
  if (id === "hand")    return <HandIcon />;
  if (id === "ellipse") return <EllipseIcon />;
  if (id === "text")    return <TextIcon />;
  return <RectIcon />;
}

export function UploadIcon() {
  return <Day63UploadIcon />;
}
