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
// Day 58 retry — "Captain at the helm". The body bg now is a
// CSS-composited cosmic horizon gradient (see tokens.css). No more
// landing-hero PNG; the editor has its own first-person POV that
// doesn't compete with the canvas.

preloadBundledFonts();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
