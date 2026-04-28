import { supabase } from "./supabase";
import { useDocStore } from "@/state/docStore";
import { useUiStore } from "@/state/uiStore";
import { deserializeDoc, serializeDoc } from "./projectSerializer";
import { toast } from "@/toasts/toastStore";
import type { ProjectDoc } from "./supabase.types";

/** Day 20 — Supabase CRUD for v3_projects.
 *
 * Every call here gates on `supabase` non-null + a signed-in user
 * (server's RLS would reject anon writes anyway, but a client-side
 * check spares us a round-trip). Most operations toast on failure
 * so the panel layer doesn't have to repeat the boilerplate.
 *
 * The shape returned by listProjects is intentionally narrow —
 * just what the ProjectsPanel needs to render a row, not the full
 * doc. The doc only loads on Open. */

export type ProjectRow = {
  id: string;
  name: string;
  thumbnail_url: string | null;
  updated_at: string;
};

export async function listProjects(): Promise<ProjectRow[]> {
  if (!supabase) return [];
  const ui = useUiStore.getState();
  if (!ui.user) return [];
  const { data, error } = await supabase
    .from("v3_projects")
    .select("id, name, thumbnail_url, updated_at")
    .eq("user_id", ui.user.id)
    .order("updated_at", { ascending: false })
    .limit(50);
  if (error) {
    toast(`Couldn't load projects — ${error.message}`);
    return [];
  }
  return (data ?? []) as ProjectRow[];
}

/** Open a project: fetch the row, deserialize the doc, swap docStore.
 * Sets currentProjectId + projectName so subsequent auto-saves write
 * back to this row instead of creating a new one. */
export async function openProject(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { data, error } = await supabase
    .from("v3_projects")
    .select("id, name, doc")
    .eq("id", id)
    .single();
  if (error || !data) {
    toast("Couldn't open project");
    return false;
  }
  const layers = await deserializeDoc(data.doc as ProjectDoc);
  useDocStore.setState({ layers });
  const ui = useUiStore.getState();
  ui.setCurrentProjectId(data.id);
  ui.setProjectName(data.name ?? "Untitled");
  ui.setSelectedLayerIds([]);
  ui.setSaveStatus({ kind: "saved", at: Date.now() });
  return true;
}

export async function renameProject(id: string, name: string): Promise<void> {
  if (!supabase) return;
  const trimmed = name.trim() || "Untitled";
  const { error } = await supabase
    .from("v3_projects")
    .update({ name: trimmed })
    .eq("id", id);
  if (error) {
    toast(`Couldn't rename — ${error.message}`);
    return;
  }
  // If the renamed project is the one currently loaded, mirror the
  // change into uiStore so the TopBar updates.
  const ui = useUiStore.getState();
  if (ui.currentProjectId === id) ui.setProjectName(trimmed);
}

export async function deleteProject(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.from("v3_projects").delete().eq("id", id);
  if (error) {
    toast(`Couldn't delete — ${error.message}`);
    return false;
  }
  // If the deleted project was loaded, blank the editor so we don't
  // try to auto-save into a row that no longer exists.
  const ui = useUiStore.getState();
  if (ui.currentProjectId === id) {
    useDocStore.setState({ layers: [] });
    ui.setCurrentProjectId(null);
    ui.setProjectName("Untitled");
    ui.setSaveStatus({ kind: "idle" });
  }
  return true;
}

/** Server-side duplicate: serialize the current state, INSERT a new
 * row with " (copy)" appended to the name, return the new id. */
export async function duplicateProject(id: string): Promise<string | null> {
  if (!supabase) return null;
  const ui = useUiStore.getState();
  if (!ui.user) return null;
  const { data, error } = await supabase
    .from("v3_projects")
    .select("name, doc")
    .eq("id", id)
    .single();
  if (error || !data) {
    toast("Couldn't duplicate project");
    return null;
  }
  const insert = await supabase
    .from("v3_projects")
    .insert({
      user_id: ui.user.id,
      name: `${data.name} (copy)`,
      doc: data.doc,
    })
    .select("id")
    .single();
  if (insert.error || !insert.data) {
    toast("Couldn't duplicate project");
    return null;
  }
  return insert.data.id as string;
}

/** Manual create — used by the "+ New project" button in
 * ProjectsPanel. Inserts an empty doc and switches the editor onto
 * the new row. Returns the new project id. */
export async function createNewProject(name = "Untitled"): Promise<string | null> {
  if (!supabase) return null;
  const ui = useUiStore.getState();
  if (!ui.user) return null;
  const doc = await serializeDoc([]);
  const { data, error } = await supabase
    .from("v3_projects")
    .insert({ user_id: ui.user.id, name, doc })
    .select("id")
    .single();
  if (error || !data) {
    toast("Couldn't create project");
    return null;
  }
  useDocStore.setState({ layers: [] });
  ui.setCurrentProjectId(data.id);
  ui.setProjectName(name);
  ui.setSaveStatus({ kind: "saved", at: Date.now() });
  return data.id as string;
}
