import "pixi.js/advanced-blend-modes";
import "@/styles/tokens.css";
import "@/styles/fonts.css";
// Day 58 — Fraunces variable for the wordmark + decorative headers.
// Variable axis fonts: 100..900 weight, italic + roman.
import "@fontsource-variable/fraunces";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { preloadBundledFonts } from "@/lib/fonts";
// Day 63 — painterly cosmic backdrop baked from the live landing
// scene (Three.js + PainterlyPost: Kuwahara + outline + paper grain).
// One captured frame at 2560×1440 JPEG q90 → ~760 KB. Static asset
// avoids shipping three/r3f to the editor route while reusing the
// EXACT brand aesthetic. Vite hashes + base-rewrites the import.
import cosmicSceneUrl from "./atmosphere/cosmic-scene-v2.jpg";

preloadBundledFonts();
// Set body bg via inline style so Vite's asset pipeline rewrites
// the URL correctly in both dev (`/src/editor-v3/atmosphere/...`) and
// prod (`/editor/assets/cosmic-scene-v2-HASH.jpg` once Vite hashes +
// relocates it). Putting the URL in CSS literally would break one or
// the other since v3's vite base is `/editor/` in prod.
document.body.style.backgroundImage = `url("${cosmicSceneUrl}")`;

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
