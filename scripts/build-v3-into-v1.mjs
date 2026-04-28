#!/usr/bin/env node
/**
 * Day 20 — bundle v3's Vite build into v1's public/editor/.
 *
 * Runs as part of v1's "npm run build" so a single Vercel deploy
 * ships both editors. v1 keeps the apex; v3 lives under /editor
 * via a Vercel rewrite.
 *
 * Steps:
 *   1. cd src/editor-v3 && npm install (Vercel may not have run it).
 *   2. cd src/editor-v3 && npm run build → produces dist/.
 *   3. Wipe public/editor/ so stale assets from prior builds don't
 *      linger (hashed filenames mean the old ones aren't even
 *      referenced, but they bloat the deploy).
 *   4. Recursively copy dist/* into public/editor/.
 *
 * No third-party deps — uses node:fs/promises and node:child_process
 * so this script runs on a fresh Vercel instance without npm install
 * tax at the root.
 */

import { execSync } from "node:child_process";
import { mkdir, rm, cp, stat } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const V3_DIR    = resolve(REPO_ROOT, "src", "editor-v3");
const V3_DIST   = resolve(V3_DIR, "dist");
const V1_DEST   = resolve(REPO_ROOT, "public", "editor");

async function exists(path) {
  try { await stat(path); return true; }
  catch { return false; }
}

async function main() {
  console.log("[v3-build] cwd =", V3_DIR);

  if (!(await exists(resolve(V3_DIR, "node_modules")))) {
    console.log("[v3-build] node_modules absent — running npm install");
    execSync("npm install", { cwd: V3_DIR, stdio: "inherit" });
  }

  console.log("[v3-build] running vite build");
  execSync("npm run build", { cwd: V3_DIR, stdio: "inherit" });

  if (await exists(V1_DEST)) {
    console.log("[v3-build] wiping", V1_DEST);
    await rm(V1_DEST, { recursive: true, force: true });
  }
  await mkdir(V1_DEST, { recursive: true });

  console.log("[v3-build] copying", V3_DIST, "→", V1_DEST);
  await cp(V3_DIST, V1_DEST, { recursive: true });

  console.log("[v3-build] done");
}

main().catch((err) => {
  console.error("[v3-build] FAILED:", err);
  process.exit(1);
});
