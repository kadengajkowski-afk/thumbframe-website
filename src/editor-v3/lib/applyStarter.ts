import { history } from "./history";
import { executeAiTool } from "@/editor/aiToolExecutor";
import type { StarterTemplateId } from "@/state/onboardingStore";

/** Day 52 — Apply a starter template's basic structure to the
 * canvas. NOT a full template (those are v3.1) — just enough to give
 * the user a non-empty canvas to start editing. Per-starter recipe:
 *
 *   gaming   → dark navy background + big yellow placeholder title
 *   tutorial → clean dark grey background + white placeholder title
 *   vlog     → warm tan background + white placeholder title
 *   blank    → no-op (user wants a blank canvas)
 *
 * Wrapped in one history stroke so a single Cmd+Z reverts the whole
 * starter (matches the multi-tool turn pattern from Day 40).
 *
 * Returns true on success. Returns false on no-op (blank starter).
 *
 * The text content is intentionally generic ("Your title") because
 * niche-specific copy lands awkwardly when wrong. Day 53+ may
 * personalize from Brand Kit context. */
export function applyStarter(id: StarterTemplateId): boolean {
  if (id === "blank") return false;

  const recipe = RECIPES[id];
  if (!recipe) return false;
  history.beginStroke(`Apply ${id} starter`);
  try {
    executeAiTool("set_canvas_background", { color: recipe.bg });
    executeAiTool("add_text_layer", {
      content: recipe.titleText,
      size: recipe.titleSize,
      color: recipe.titleColor,
      font: recipe.titleFont,
      position: recipe.titlePosition,
    });
  } finally {
    history.endStroke();
  }
  return true;
}

type StarterRecipe = {
  bg: string;
  titleText: string;
  titleSize: number;
  titleColor: string;
  titleFont: string;
  titlePosition: "top" | "center" | "bottom";
};

const RECIPES: Record<Exclude<StarterTemplateId, "blank">, StarterRecipe> = {
  gaming: {
    bg: "#0A0E1A",
    titleText: "DAY ONE",
    titleSize: 200,
    titleColor: "#FFD700",
    titleFont: "Bebas Neue",
    titlePosition: "center",
  },
  tutorial: {
    bg: "#1F2330",
    titleText: "How to start",
    titleSize: 120,
    titleColor: "#FFFFFF",
    titleFont: "Inter",
    titlePosition: "center",
  },
  vlog: {
    bg: "#3D2B1F",
    titleText: "Today's vlog",
    titleSize: 140,
    titleColor: "#FFE3B0",
    titleFont: "Anton",
    titlePosition: "center",
  },
};
