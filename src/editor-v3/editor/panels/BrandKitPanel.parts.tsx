import { useUiStore } from "@/state/uiStore";
import { useDocStore } from "@/state/docStore";
import { history } from "@/lib/history";
import { hexToPixi, normalizeHex } from "@/lib/color";
import { toast } from "@/toasts/toastStore";
import { THUMBNAIL_DRAG_MIME } from "@/lib/thumbnailReference";
import type { BrandKit } from "@/lib/brandKit";
import type { SavedBrandKitRow } from "@/lib/savedBrandKits";
import * as s from "./BrandKitPanel.styles";

/** Day 32 — Brand Kit panel sub-components, split out of
 * BrandKitPanel.tsx to keep it under the 250-line panel ceiling. */

export function BrandKitResult({ kit }: { kit: BrandKit }) {
  const setPinned = useUiStore((u) => u.setPinnedBrandKit);
  const pinned    = useUiStore((u) => u.pinnedBrandKit);
  const isPinned  = pinned?.channelId === kit.channelId;

  return (
    <div style={s.resultWrap} data-testid="brand-kit-success">
      <div style={s.channelHeader}>
        {kit.avatarUrl ? (
          <img src={kit.avatarUrl} alt="" style={s.avatar} />
        ) : (
          <div style={s.avatarPlaceholder}>—</div>
        )}
        <div style={s.channelText}>
          <div style={s.channelName}>{kit.channelTitle}</div>
          {kit.customUrl && <div style={s.channelHandle}>{kit.customUrl}</div>}
        </div>
        <button
          type="button"
          style={isPinned ? s.pinBtnActive : s.pinBtn}
          onClick={() => {
            if (isPinned) {
              setPinned(null);
              toast("Kit unpinned");
            } else {
              setPinned({
                channelId:     kit.channelId,
                channelTitle:  kit.channelTitle,
                customUrl:     kit.customUrl,
                avatarUrl:     kit.avatarUrl,
                primaryAccent: kit.primaryAccent,
                palette:       kit.palette,
              });
              toast(`Pinned ${kit.channelTitle}`);
            }
          }}
          data-testid="brand-kit-pin"
        >
          {isPinned ? "Unpin" : "Pin Kit"}
        </button>
      </div>

      {kit.palette.length > 0 ? (
        <section style={s.section}>
          <div style={s.sectionLabel}>Colors — click to apply or pin</div>
          <div style={s.swatchRow} data-testid="brand-kit-swatches">
            {kit.primaryAccent && <Swatch hex={kit.primaryAccent} primary />}
            {kit.palette.map((hex) => <Swatch key={hex} hex={hex} />)}
          </div>
        </section>
      ) : (
        <div style={s.emptyHint}>Couldn't extract colors — try a channel with more public uploads.</div>
      )}

      {kit.recentThumbnails.length > 0 && (
        <section style={s.section}>
          <div style={s.sectionLabel}>Recent thumbnails — drag onto canvas</div>
          <div style={s.thumbStrip} data-testid="brand-kit-thumbs">
            {kit.recentThumbnails.slice(0, 6).map((t) => (
              <img
                key={t.videoId}
                src={t.url}
                alt={t.title}
                title={t.title}
                draggable
                style={s.thumbImg}
                onDragStart={(e) => {
                  const payload = JSON.stringify({ url: t.url, title: t.title });
                  e.dataTransfer.setData(THUMBNAIL_DRAG_MIME, payload);
                  e.dataTransfer.setData("text/plain", t.url);
                  e.dataTransfer.effectAllowed = "copy";
                }}
                data-testid="brand-kit-thumb"
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Swatch({ hex, primary = false }: { hex: string; primary?: boolean }) {
  return (
    <button
      type="button"
      style={{
        ...s.swatchBox,
        outline: "none",
        border: "none",
        padding: 0,
        background: "transparent",
        cursor: "pointer",
      }}
      onClick={() => applySwatch(hex)}
      title={primary ? `${hex} — primary` : hex}
      data-testid="brand-kit-swatch"
    >
      <div
        style={{
          ...s.swatchChip,
          background: hex,
          outline: primary ? "2px solid var(--accent-cream)" : "1px solid var(--border-ghost)",
        }}
      />
      <div style={s.swatchLabel}>{primary ? "Primary" : hex}</div>
    </button>
  );
}

/** Click a brand swatch:
 *   - always pin to recentColors (so it appears in the ColorPicker).
 *   - if a fillable layer is selected, also commit it as the layer's
 *     fill color through history.
 *   - else: mark it as the "next fill" via lastFillColor too. */
function applySwatch(hex: string) {
  const normalized = normalizeHex(hex);
  if (!normalized) return;

  const ui = useUiStore.getState();
  ui.addRecentColor(normalized);

  const ids = ui.selectedLayerIds;
  const layers = useDocStore.getState().layers;
  const targets = ids
    .map((id) => layers.find((l) => l.id === id))
    .filter((l): l is NonNullable<typeof l> =>
      !!l && (l.type === "rect" || l.type === "ellipse" || l.type === "text"));

  if (targets.length > 0) {
    const pixi = hexToPixi(normalized);
    if (pixi !== null) {
      history.beginStroke("Apply brand color");
      for (const t of targets) history.setLayerFillColor(t.id, pixi);
      history.endStroke();
    }
    toast(`Applied ${normalized}`);
  } else {
    ui.setLastFillColor(normalized);
    toast("Pinned to recent colors");
  }
}

export function SavedKitsTab({
  user,
  rows,
  onOpen,
  onDelete,
}: {
  user: { id: string } | null;
  rows: SavedBrandKitRow[];
  onOpen: (row: SavedBrandKitRow) => void;
  onDelete: (row: SavedBrandKitRow) => void;
}) {
  if (!user) {
    return <div style={s.emptyHint}>Sign in to save and revisit your brand kits.</div>;
  }
  if (rows.length === 0) {
    return <div style={s.emptyHint}>No saved kits yet — extract one to start.</div>;
  }
  return (
    <div style={s.savedList} data-testid="brand-kit-saved-list">
      {rows.map((row) => (
        <div key={row.id} style={s.savedRow}>
          <button type="button" style={s.savedRowOpen} onClick={() => onOpen(row)}>
            {row.avatar_url ? (
              <img src={row.avatar_url} alt="" style={s.savedAvatar} />
            ) : (
              <div style={s.savedAvatarPlaceholder}>—</div>
            )}
            <div style={s.savedText}>
              <div style={s.savedTitle}>{row.channel_title}</div>
              {row.custom_url && <div style={s.savedHandle}>{row.custom_url}</div>}
            </div>
            <div style={s.savedSwatches}>
              {(row.colors ?? []).slice(0, 5).map((c) => (
                <span key={c} style={{ ...s.savedSwatch, background: c }} />
              ))}
            </div>
          </button>
          <button type="button" style={s.savedDelete} onClick={() => onDelete(row)} title="Remove">×</button>
        </div>
      ))}
    </div>
  );
}
