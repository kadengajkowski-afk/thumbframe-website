import "pixi.js/advanced-blend-modes";
import "@/styles/tokens.css";
import "@/styles/fonts.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { preloadBundledFonts } from "@/lib/fonts";
// Day 58 — watercolor cosmic atmosphere. One frame snapshotted from
// the landing hero scene (Three.js + painterly shaders) so the
// editor reuses the EXACT brand asset without shipping three/r3f.
import atmosphereCosmicUrl from "./atmosphere/landing-hero-cosmic.jpg";

preloadBundledFonts();
// Set body bg via inline style — see tokens.css for why this lives
// in JS instead of CSS literal (Vite base path translation).
document.body.style.backgroundImage = `url("${atmosphereCosmicUrl}")`;

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
