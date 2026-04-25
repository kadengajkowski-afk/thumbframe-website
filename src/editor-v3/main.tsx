import "pixi.js/advanced-blend-modes";
import "@/styles/tokens.css";
import "@/styles/fonts.css";

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@/App";
import { preloadBundledFonts } from "@/lib/fonts";

preloadBundledFonts();

// DIAGNOSTIC — global focus + click tracking. Remove after bug closed.
window.addEventListener("focusin", (e) => {
  const t = e.target as HTMLElement | null;
  console.log("[FOCUS/in]", t?.tagName, t?.getAttribute("data-text-editor") ? "(textarea)" : t?.className?.slice(0, 40));
}, true);
window.addEventListener("focusout", (e) => {
  const t = e.target as HTMLElement | null;
  console.log("[FOCUS/out]", t?.tagName, t?.getAttribute("data-text-editor") ? "(textarea)" : t?.className?.slice(0, 40));
}, true);
window.addEventListener("click", (e) => {
  const t = e.target as HTMLElement | null;
  console.log("[CLICK]", t?.tagName, t?.getAttribute("aria-label") || t?.className?.slice(0, 40));
}, true);

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Missing #root element in index.html");

createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
