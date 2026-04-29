import { supabase } from "./supabase";
import { useUiStore } from "@/state/uiStore";
import { toast } from "@/toasts/toastStore";
import type { BrandKit, BrandKitFont } from "./brandKit";

/** Day 32 — per-user saved Brand Kits.
 *
 * Reads/writes public.brand_kits via the user-scoped supabase client
 * (RLS gates own-only). When supabase is null or the user is signed
 * out, every call no-ops (signed-out users can still extract kits but
 * can't save them — the panel surfaces a "Sign in to save kits" hint). */

export type SavedBrandKitRow = {
  id: string;
  channel_id: string;
  channel_title: string;
  custom_url: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  primary_accent: string | null;
  colors: string[];
  fonts: BrandKitFont[];
  recent_thumbnails: BrandKit["recentThumbnails"];
  created_at: string;
  updated_at: string;
};

/** Hydrate a SavedBrandKitRow back into the BrandKit shape the panel
 * uses for display, so loading a saved kit and extracting fresh both
 * render the same way. */
export function rowToBrandKit(row: SavedBrandKitRow): BrandKit {
  return {
    channelId:        row.channel_id,
    channelTitle:     row.channel_title,
    customUrl:        row.custom_url,
    description:      "",
    avatarUrl:        row.avatar_url,
    bannerUrl:        row.banner_url,
    country:          null,
    subscriberCount:  0,
    videoCount:       0,
    viewCount:        0,
    recentThumbnails: row.recent_thumbnails ?? [],
    palette:          row.colors ?? [],
    primaryAccent:    row.primary_accent,
    fonts:            row.fonts ?? [],
    fromCache:        true,
  };
}

export async function listSavedBrandKits(): Promise<SavedBrandKitRow[]> {
  if (!supabase) return [];
  const user = useUiStore.getState().user;
  if (!user) return [];
  const { data, error } = await supabase
    .from("brand_kits")
    .select("id, channel_id, channel_title, custom_url, avatar_url, banner_url, primary_accent, colors, fonts, recent_thumbnails, created_at, updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    toast(`Couldn't load saved kits — ${error.message}`);
    return [];
  }
  return (data ?? []) as SavedBrandKitRow[];
}

/** Upsert by (user_id, channel_id) — re-extracting the same channel
 * overwrites the prior save so the user sees the freshest palette. */
export async function saveBrandKit(kit: BrandKit): Promise<boolean> {
  if (!supabase) return false;
  const user = useUiStore.getState().user;
  if (!user) return false;
  const { error } = await supabase
    .from("brand_kits")
    .upsert(
      {
        user_id:           user.id,
        channel_id:        kit.channelId,
        channel_title:     kit.channelTitle,
        custom_url:        kit.customUrl,
        avatar_url:        kit.avatarUrl,
        banner_url:        kit.bannerUrl,
        primary_accent:    kit.primaryAccent,
        colors:            kit.palette,
        fonts:             kit.fonts,
        recent_thumbnails: kit.recentThumbnails,
      },
      { onConflict: "user_id,channel_id" },
    );
  if (error) {
    toast(`Couldn't save kit — ${error.message}`);
    return false;
  }
  return true;
}

export async function deleteSavedBrandKit(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("brand_kits").delete().eq("id", id);
  if (error) {
    toast(`Couldn't delete kit — ${error.message}`);
    return false;
  }
  return true;
}
