import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { supabase } from "./supabase";
import {
  serializeDoc,
  saveDraftToLocalStorage,
  loadDraftFromLocalStorage,
  deserializeDoc,
} from "./projectSerializer";

/** Day 20 — auto-save. Subscribes to docStore.layers; on any change,
 * waits 2s of quiet, then saves:
 *   - Signed-in user → upsert into Supabase `projects`. New project
 *     creates a row, subsequent saves update by currentProjectId.
 *   - Signed-out user → write to localStorage as a single "draft".
 * Save status flows into uiStore.saveStatus so the TopBar indicator
 * reflects in-flight / saved / error. */

const DEBOUNCE_MS = 2000;

let timer: number | null = null;
let inFlight: Promise<void> | null = null;
let pending = false;
let unsubscribeDoc: (() => void) | null = null;

export function startAutoSave(): () => void {
  if (unsubscribeDoc) return () => {};
  unsubscribeDoc = useDocStore.subscribe(
    (state) => state.layers,
    () => scheduleSave(),
  );
  return stopAutoSave;
}

export function stopAutoSave(): void {
  unsubscribeDoc?.();
  unsubscribeDoc = null;
  if (timer) {
    window.clearTimeout(timer);
    timer = null;
  }
}

function scheduleSave() {
  if (timer) window.clearTimeout(timer);
  timer = window.setTimeout(() => {
    timer = null;
    void runSave();
  }, DEBOUNCE_MS);
}

async function runSave() {
  if (inFlight) {
    pending = true;
    return;
  }
  inFlight = doSave();
  try {
    await inFlight;
  } finally {
    inFlight = null;
    if (pending) {
      pending = false;
      void runSave();
    }
  }
}

async function doSave() {
  const ui = useUiStore.getState();
  const layers = useDocStore.getState().layers;
  ui.setSaveStatus({ kind: "saving" });
  try {
    const doc = await serializeDoc(layers);
    if (ui.user && supabase) {
      // Logged-in: Supabase round-trip. New project on first save,
      // update on subsequent saves.
      if (ui.currentProjectId) {
        const { error } = await supabase
          .from("v3_projects")
          .update({ doc, name: ui.projectName })
          .eq("id", ui.currentProjectId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("v3_projects")
          .insert({ user_id: ui.user.id, name: ui.projectName, doc })
          .select("id")
          .single();
        if (error) throw error;
        if (data?.id) ui.setCurrentProjectId(data.id);
      }
    } else {
      // Logged-out: localStorage draft.
      saveDraftToLocalStorage(doc);
    }
    ui.setSaveStatus({ kind: "saved", at: Date.now() });
  } catch (err) {
    ui.setSaveStatus({
      kind: "error",
      message: err instanceof Error ? err.message : "Couldn't save",
    });
  }
}

/** Manually trigger a save right now (Cmd+S). Skips the debounce. */
export async function saveNow(): Promise<void> {
  if (timer) {
    window.clearTimeout(timer);
    timer = null;
  }
  await runSave();
}

/** Load the localStorage draft into docStore — boot-time recovery
 * for signed-out users. No-op if there's no draft. Logged-in users
 * skip this because their Supabase row drives the initial load. */
export async function loadDraftIfPresent(): Promise<boolean> {
  const draft = loadDraftFromLocalStorage();
  if (!draft) return false;
  const layers = await deserializeDoc(draft);
  useDocStore.setState({ layers });
  return true;
}
