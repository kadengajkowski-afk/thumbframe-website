import { type CSSProperties } from "react";
import { useUiStore } from "@/state/uiStore";
import {
  groupBySection,
  LIVE_SURFACES,
  SECTION_LABEL,
  type SurfaceSpec,
} from "@/editor/previewSurfaces";
import { SidebarUpNextSurface } from "./surfaces/SidebarUpNext";
import { MobileFeedSurface } from "./surfaces/MobileFeed";
import { DesktopHomeGridSurface } from "./surfaces/DesktopHomeGrid";
import { DesktopSearchResultsSurface } from "./surfaces/DesktopSearchResults";
import { MobileShortsShelfSurface } from "./surfaces/MobileShortsShelf";
import { TVLeanbackSurface } from "./surfaces/TVLeanback";
import { LockscreenPushSurface } from "./surfaces/LockscreenPush";

/** Day 21 — multi-surface PreviewRack. Slides in over the right
 * panel slot (ContextPanel hides when this is open). One live
 * surface today (sidebar-up-next); the rest render as placeholder
 * cards labeled with their dimensions. Days 22-26 add the rest. */

export function PreviewRack() {
  const open = useUiStore((s) => s.previewRackOpen);
  const close = useUiStore((s) => s.setPreviewRackOpen);
  const mode = useUiStore((s) => s.previewMode);
  const setMode = useUiStore((s) => s.setPreviewMode);

  if (!open) return null;
  const sections = groupBySection();

  return (
    <aside style={panel} aria-label="Preview rack" data-alive="preview-rack" data-testid="preview-rack">
      <header style={header}>
        <span style={title}>Preview</span>
        <div style={modeToggle} role="group" aria-label="Preview mode">
          <button
            type="button"
            onClick={() => setMode("dark")}
            style={{ ...modeBtn, ...(mode === "dark" ? modeBtnActive : null) }}
            data-testid="preview-mode-dark"
          >
            Dark
          </button>
          <button
            type="button"
            onClick={() => setMode("light")}
            style={{ ...modeBtn, ...(mode === "light" ? modeBtnActive : null) }}
            data-testid="preview-mode-light"
          >
            Light
          </button>
        </div>
        <button
          type="button"
          onClick={() => close(false)}
          style={closeBtn}
          aria-label="Close preview rack"
          title="Close (Cmd+Shift+P)"
        >
          ×
        </button>
      </header>

      <div style={scroll}>
        {sections.map((section) => (
          section.surfaces.length > 0 && (
            <div key={section.section} style={sectionWrap}>
              <div style={sectionHeader}>{SECTION_LABEL[section.section]}</div>
              {section.surfaces.map((surface) => (
                <SurfaceCard key={surface.id} surface={surface} />
              ))}
            </div>
          )
        ))}
      </div>
    </aside>
  );
}

function SurfaceCard({ surface }: { surface: SurfaceSpec }) {
  const live = LIVE_SURFACES.has(surface.id);
  return (
    <div style={card} data-testid={`surface-card-${surface.id}`}>
      <div style={cardHeader}>{surface.label}</div>
      {live ? (
        <SurfaceContent surface={surface} />
      ) : (
        <div
          style={{
            ...placeholder,
            width: Math.min(280, surface.chrome.width),
            aspectRatio: `${surface.chrome.width} / ${surface.chrome.height}`,
          }}
        >
          {surface.chrome.thumbW}×{surface.chrome.thumbH}
        </div>
      )}
    </div>
  );
}

function SurfaceContent({ surface }: { surface: SurfaceSpec }) {
  if (surface.id === "sidebar-up-next") return <SidebarUpNextSurface surface={surface} />;
  if (surface.id === "mobile-feed") return <MobileFeedSurface surface={surface} />;
  if (surface.id === "desktop-home") return <DesktopHomeGridSurface surface={surface} />;
  if (surface.id === "desktop-search") return <DesktopSearchResultsSurface surface={surface} />;
  if (surface.id === "shorts-shelf") return <MobileShortsShelfSurface surface={surface} />;
  if (surface.id === "tv-leanback") return <TVLeanbackSurface surface={surface} />;
  if (surface.id === "lockscreen-push") return <LockscreenPushSurface surface={surface} />;
  return null;
}

const panel: CSSProperties = {
  // Match ContextPanel's width (280) so swapping in/out doesn't
  // overflow the editorRow flex container. Spec asked for 320 but
  // the layout was tuned for 280; widen later if we redesign the row.
  width: 280, height: "100%", flexShrink: 0,
  display: "flex", flexDirection: "column",
  background: "var(--bg-space-1)",
  borderLeft: "1px solid var(--border-ghost)",
  color: "var(--text-primary)",
};
const header: CSSProperties = {
  display: "flex", alignItems: "center", gap: 10,
  padding: "10px 12px",
  borderBottom: "1px solid var(--border-ghost)",
};
const title: CSSProperties = {
  fontSize: 13, fontWeight: 600,
  color: "var(--accent-cream)", letterSpacing: "0.04em",
  textTransform: "uppercase", flex: 1,
};
const modeToggle: CSSProperties = {
  display: "flex", border: "1px solid var(--border-ghost)",
  borderRadius: 5, overflow: "hidden",
};
const modeBtn: CSSProperties = {
  background: "transparent", border: "none",
  color: "var(--text-secondary)", fontSize: 11,
  padding: "4px 10px", cursor: "pointer",
};
const modeBtnActive: CSSProperties = {
  background: "var(--accent-orange)", color: "var(--bg-space-0)",
};
const closeBtn: CSSProperties = {
  background: "transparent", border: "none",
  color: "var(--text-secondary)", fontSize: 16,
  cursor: "pointer", padding: "0 4px",
};
const scroll: CSSProperties = {
  flex: 1, overflowY: "auto",
  padding: "12px 12px 24px",
};
const sectionWrap: CSSProperties = { marginBottom: 18 };
const sectionHeader: CSSProperties = {
  fontSize: 10, fontWeight: 600,
  color: "var(--text-secondary)", letterSpacing: "0.08em",
  textTransform: "uppercase", marginBottom: 8,
};
const card: CSSProperties = {
  background: "var(--bg-space-2)",
  border: "1px solid var(--border-ghost)", borderRadius: 6,
  padding: 10, marginBottom: 8,
};
const cardHeader: CSSProperties = {
  fontSize: 11, color: "var(--text-secondary)",
  marginBottom: 8, letterSpacing: "0.02em",
};
const placeholder: CSSProperties = {
  background: "var(--bg-space-0)",
  border: "1px dashed var(--border-ghost)", borderRadius: 4,
  display: "flex", alignItems: "center", justifyContent: "center",
  color: "var(--text-secondary)", fontSize: 11,
};
