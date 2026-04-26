#!/usr/bin/env node
/* eslint-disable no-console */
/**
 * Day 13 — one-time fetch script for the 19 new OFL fonts (Day 12
 * shipped 6). Idempotent — skips files that already exist on disk.
 *
 * Usage:
 *   node scripts/fetch-fonts.mjs
 *
 * For each font we hit the Google Fonts CSS2 API with a modern
 * desktop UA (so it serves woff2), parse out the latin-subset @font-
 * face block (the one whose unicode-range starts with U+0000-00FF),
 * download that woff2 to public/fonts/, and append a matching @font-
 * face declaration to styles/fonts.css if missing.
 *
 * Variable fonts are downloaded once with a wght-axis range request
 * (`wght@100..900` etc.) — one woff2 covers every weight in the band.
 * Single-weight fonts get their one weight only.
 */

import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const FONTS_DIR = path.join(ROOT, "public", "fonts");
const FONTS_CSS = path.join(ROOT, "styles", "fonts.css");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 " +
  "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

/** Each entry: family name (as Google knows it), filename stem (PascalCase
 * no spaces — keeps consistent with Day 12's BebasNeue / ArchivoBlack /
 * PermanentMarker), and the Google Fonts axis spec.
 *
 * For variable fonts we request a wght range so one woff2 covers the
 * whole weight band. For single-weight fonts we request the single
 * weight directly. */
const FONTS = [
  { family: "Roboto", file: "Roboto", axis: "wght@100..900" },
  { family: "Montserrat", file: "Montserrat", axis: "wght@100..900" },
  // Poppins is not exposed as a true variable font on Google Fonts
  // CSS2 — it returns 400 on a wght-range request. Bundle the
  // canonical weights individually.
  { family: "Poppins", file: "Poppins-300", axis: "wght@300" },
  { family: "Poppins", file: "Poppins-400", axis: "wght@400" },
  { family: "Poppins", file: "Poppins-600", axis: "wght@600" },
  { family: "Poppins", file: "Poppins-700", axis: "wght@700" },
  { family: "Poppins", file: "Poppins-900", axis: "wght@900" },
  // Lato lacks a true variable font — combine 400/700/900 into one css call.
  { family: "Lato", file: "Lato-400", axis: "wght@400" },
  { family: "Lato", file: "Lato-700", axis: "wght@700" },
  { family: "Lato", file: "Lato-900", axis: "wght@900" },
  { family: "Open Sans", file: "OpenSans", axis: "wght@300..800" },
  { family: "Raleway", file: "Raleway", axis: "wght@100..900" },
  { family: "Source Sans 3", file: "SourceSans3", axis: "wght@200..900" },
  { family: "Nunito", file: "Nunito", axis: "wght@200..900" },
  { family: "Work Sans", file: "WorkSans", axis: "wght@100..900" },
  { family: "Rubik", file: "Rubik", axis: "wght@300..900" },
  { family: "DM Serif Display", file: "DMSerifDisplay", axis: "wght@400" },
  { family: "Playfair Display", file: "PlayfairDisplay", axis: "wght@400..900" },
  { family: "Merriweather", file: "Merriweather-300", axis: "wght@300" },
  { family: "Merriweather", file: "Merriweather-400", axis: "wght@400" },
  { family: "Merriweather", file: "Merriweather-700", axis: "wght@700" },
  { family: "Merriweather", file: "Merriweather-900", axis: "wght@900" },
  { family: "Lora", file: "Lora", axis: "wght@400..700" },
  { family: "Bangers", file: "Bangers", axis: "wght@400" },
  { family: "Russo One", file: "RussoOne", axis: "wght@400" },
  { family: "Squada One", file: "SquadaOne", axis: "wght@400" },
  { family: "Black Ops One", file: "BlackOpsOne", axis: "wght@400" },
  { family: "Press Start 2P", file: "PressStart2P", axis: "wght@400" },
];

async function fetchCss(family, axis) {
  const url =
    "https://fonts.googleapis.com/css2?family=" +
    encodeURIComponent(family).replace(/%20/g, "+") +
    ":" +
    axis +
    "&display=block";
  const res = await fetch(url, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`CSS fetch failed for ${family}: ${res.status}`);
  return res.text();
}

/** Pick the @font-face block whose unicode-range starts with the basic
 * Latin block (U+0000-00FF). Returns the woff2 URL inside src:url(). */
function pickLatinWoff2(css) {
  const blocks = css.split("@font-face").slice(1);
  for (const block of blocks) {
    const range = /unicode-range:\s*([^;]+);/.exec(block);
    if (!range) continue;
    if (!range[1].includes("U+0000-00FF")) continue;
    const src = /src:\s*url\((https?:\/\/[^)]+\.woff2)\)/.exec(block);
    if (src) return src[1];
  }
  // Fallback — some fonts (Press Start 2P) don't carry a U+0000-00FF
  // unicode-range; just take the first woff2 url in the css.
  const fallback = /src:\s*url\((https?:\/\/[^)]+\.woff2)\)/.exec(css);
  return fallback ? fallback[1] : null;
}

async function downloadOne({ family, file, axis }) {
  const out = path.join(FONTS_DIR, `${file}.woff2`);
  try {
    await fs.access(out);
    console.log(`✔  ${file}.woff2 already exists, skipping`);
    return { family, file, axis, skipped: true };
  } catch {
    /* doesn't exist, fetch */
  }
  const css = await fetchCss(family, axis);
  const woff2Url = pickLatinWoff2(css);
  if (!woff2Url) throw new Error(`No latin woff2 for ${family} ${axis}`);
  const buf = Buffer.from(await (await fetch(woff2Url)).arrayBuffer());
  await fs.writeFile(out, buf);
  console.log(`↓  ${file}.woff2 (${(buf.length / 1024).toFixed(1)} KB)`);
  return { family, file, axis, skipped: false };
}

async function main() {
  await fs.mkdir(FONTS_DIR, { recursive: true });
  const results = [];
  for (const spec of FONTS) {
    try {
      results.push(await downloadOne(spec));
    } catch (err) {
      console.error(`✗  ${spec.file}: ${err.message}`);
    }
  }
  console.log(
    `\nDone — ${results.length}/${FONTS.length} fonts processed ` +
      `(${results.filter((r) => !r.skipped).length} new).`,
  );
  console.log(
    "Make sure styles/fonts.css carries an @font-face for each new file.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
