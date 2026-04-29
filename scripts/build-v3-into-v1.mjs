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
 *      linger.
 *   4. Recursively copy dist/* into public/editor/.
 *   5. Verify the copy actually produced index.html + an assets/
 *      subdirectory; bail if not. The whole react-scripts build is
 *      pointless if /editor is empty — better to crash the deploy
 *      than silently ship stale assets cached in Vercel's pipeline.
 *
 * No third-party deps — uses node:fs/promises and node:child_process
 * so this script runs on a fresh Vercel instance without npm install
 * tax at the root.
 */

import { execSync } from "node:child_process";
import { mkdir, rm, cp, stat, readdir, readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "..");
const V3_DIR    = resolve(REPO_ROOT, "src", "editor-v3");
const V3_DIST   = resolve(V3_DIR, "dist");
const V1_DEST   = resolve(REPO_ROOT, "public", "editor");

const BANNER = "═══════════════════════════════════════════════════════════════";

function logBanner(msg) {
  console.log("");
  console.log(BANNER);
  console.log(`  ${msg}`);
  console.log(BANNER);
  console.log("");
}

async function exists(path) {
  try { await stat(path); return true; }
  catch { return false; }
}

function bail(msg) {
  console.error("");
  console.error(BANNER);
  console.error(`  [v3-build] FATAL: ${msg}`);
  console.error(`  [v3-build] Crashing the deploy so Vercel doesn't ship stale /editor assets.`);
  console.error(BANNER);
  console.error("");
  process.exit(1);
}

async function main() {
  logBanner(`[v3-build] START — building v3 editor into ${V1_DEST}`);
  console.log("[v3-build] node    =", process.version);
  console.log("[v3-build] cwd     =", process.cwd());
  console.log("[v3-build] V3_DIR  =", V3_DIR);
  console.log("[v3-build] V3_DIST =", V3_DIST);
  console.log("[v3-build] V1_DEST =", V1_DEST);

  // Print the v3 package version so the build log shows whether
  // Vercel cloned the latest commit (version bumps every Day-N).
  try {
    const pkg = JSON.parse(await readFile(resolve(V3_DIR, "package.json"), "utf8"));
    console.log("[v3-build] v3 package =", pkg.name, "@", pkg.version);
  } catch (err) {
    bail(`Couldn't read src/editor-v3/package.json — wrong checkout? (${err.message})`);
  }

  if (!(await exists(V3_DIR))) {
    bail(`src/editor-v3 missing — wrong checkout?`);
  }

  // Always run `npm ci` — never trust a cached node_modules. Vercel's
  // build cache can restore a stale node_modules from a prior commit
  // that predates new deps (Day 36's onnxruntime-web hit this), and
  // the v3 build then fails with "Cannot find module" even though
  // package.json + package-lock.json have the entry. `npm ci` is
  // deterministic from the lockfile and reproducible across runs.
  console.log("[v3-build] running npm ci (always — no skip)");
  try {
    execSync("npm ci", { cwd: V3_DIR, stdio: "inherit" });
  } catch (err) {
    bail(`npm ci failed in src/editor-v3 (${err.message})`);
  }

  console.log("[v3-build] running vite build");
  try {
    execSync("npm run build", { cwd: V3_DIR, stdio: "inherit" });
  } catch (err) {
    bail(`vite build failed in src/editor-v3 (${err.message})`);
  }

  if (!(await exists(V3_DIST))) {
    bail(`vite build did not produce ${V3_DIST}`);
  }
  if (!(await exists(resolve(V3_DIST, "index.html")))) {
    bail(`vite build did not produce ${V3_DIST}/index.html`);
  }

  if (await exists(V1_DEST)) {
    console.log("[v3-build] wiping", V1_DEST);
    await rm(V1_DEST, { recursive: true, force: true });
  }
  await mkdir(V1_DEST, { recursive: true });

  console.log("[v3-build] copying", V3_DIST, "→", V1_DEST);
  await cp(V3_DIST, V1_DEST, { recursive: true });

  // Post-copy assertions. If any of these fail, the deploy must
  // crash — react-scripts will happily build an /editor route
  // that 404s if these aren't here.
  if (!(await exists(resolve(V1_DEST, "index.html")))) {
    bail(`post-copy: ${V1_DEST}/index.html missing`);
  }
  const assetsDir = resolve(V1_DEST, "assets");
  if (!(await exists(assetsDir))) {
    bail(`post-copy: ${assetsDir} missing`);
  }
  const assetEntries = await readdir(assetsDir);
  const indexJs = assetEntries.find((f) => f.startsWith("index-") && f.endsWith(".js"));
  if (!indexJs) {
    bail(`post-copy: no index-*.js in ${assetsDir} — got ${assetEntries.length} files`);
  }
  console.log("[v3-build] post-copy assets count =", assetEntries.length);
  console.log("[v3-build] post-copy main bundle  =", indexJs);

  logBanner(`[v3-build] DONE — public/editor populated (${assetEntries.length} files, main = ${indexJs})`);
}

main().catch((err) => {
  console.error("");
  console.error(BANNER);
  console.error("  [v3-build] FAILED:", err?.stack || err);
  console.error(BANNER);
  console.error("");
  process.exit(1);
});
